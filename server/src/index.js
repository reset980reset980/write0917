import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool, query } from './db.js';
import { checkAdminCredentials, issueToken, isAdminRequest, requireAdmin } from './auth.js';
import { isAiConfigured, getTopicSuggestions, getWritingAssistantResponse } from './ai.js';
import { rateLimit } from './rateLimit.js';

const app = express();

// Caddy 뒤에서 실행되므로 실제 접속 IP를 X-Forwarded-For 에서 읽습니다.
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, callback) {
      // 브라우저가 아닌 요청(curl, 헬스체크)은 Origin 이 없습니다.
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Edit-Code'],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: '200kb' }));

// 한 학교(같은 공인 IP)에서 여러 학생이 동시에 쓰므로 넉넉하게 잡습니다.
const writeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 400 });
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  message: 'AI 도우미 사용이 잠시 많아요. 몇 분 뒤에 다시 물어봐 주세요.',
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: '로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해주세요.',
});

// ---------- 입력값 검사 ----------

class BadRequest extends Error {}

function text(value, field, { max = 20000, allowEmpty = false } = {}) {
  if (typeof value !== 'string') throw new BadRequest(`${field} 값이 올바르지 않습니다.`);
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) throw new BadRequest(`${field}을(를) 입력해주세요.`);
  if (value.length > max) throw new BadRequest(`${field}이(가) 너무 깁니다.`);
  return value;
}

function int(value, field, { min, max }) {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequest(`${field} 값이 올바르지 않습니다.`);
  return n;
}

function bodyParts(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new BadRequest('본론 내용이 올바르지 않습니다.');
  }
  return value.map((part, i) => ({
    reason: text(part?.reason ?? '', `본론 ${i + 1}번 근거`, { max: 5000, allowEmpty: true }),
    source: text(part?.source ?? '', `본론 ${i + 1}번 출처`, { max: 1000, allowEmpty: true }),
  }));
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

// ---------- DB 행 → 화면용 데이터 ----------

function essayOut(row, { includeEditCode = false } = {}) {
  const essay = {
    id: row.id,
    topic: row.title,
    introduction: row.introduction,
    body: Array.isArray(row.body) ? row.body : [],
    conclusion: row.conclusion,
    fullText: row.full_text,
    student: {
      grade: String(row.author_grade),
      classNumber: String(row.author_class),
      studentId: String(row.author_number),
      name: row.author_name,
    },
    createdAt: new Date(row.created_at).toISOString(),
    likes: row.likes || 0,
  };
  if (includeEditCode) essay.editCode = row.edit_code;
  return essay;
}

function commentOut(row) {
  return {
    id: row.id,
    essayId: row.essay_id,
    content: row.content,
    authorGrade: row.author_grade,
    authorClass: row.author_class,
    authorNumber: row.author_number,
    authorName: row.author_name,
    isTeacher: row.is_teacher,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const EDIT_CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // 헷갈리는 글자(0,o,1,l,i) 제외
function newEditCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += EDIT_CODE_CHARS[crypto.randomInt(EDIT_CODE_CHARS.length)];
  return code;
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- 라우트 ----------

app.get('/api/health', wrap(async (_req, res) => {
  await query('SELECT 1');
  res.json({ ok: true, ai: isAiConfigured });
}));

// 글 목록 (수정 코드는 로그인한 선생님에게만 보여줌)
app.get('/api/essays', wrap(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.grade) {
    params.push(int(req.query.grade, '학년', { min: 1, max: 6 }));
    where.push(`author_grade = $${params.length}`);
  }
  if (req.query.class) {
    params.push(int(req.query.class, '반', { min: 1, max: 99 }));
    where.push(`author_class = $${params.length}`);
  }
  const sql = `SELECT * FROM essays ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 1000`;
  const { rows } = await query(sql, params);
  const includeEditCode = isAdminRequest(req);
  res.json(rows.map((r) => essayOut(r, { includeEditCode })));
}));

// 글 작성 → 수정 코드는 서버가 만들어서 한 번만 돌려줌
app.post('/api/essays', writeLimiter, wrap(async (req, res) => {
  const b = req.body || {};
  const s = b.student || {};
  const values = [
    text(b.topic, '주제', { max: 300 }),
    text(b.introduction, '서론', { max: 10000 }),
    JSON.stringify(bodyParts(b.body)),
    text(b.conclusion, '결론', { max: 10000 }),
    text(b.fullText, '글 전체', { max: 40000 }),
    int(s.grade, '학년', { min: 1, max: 6 }),
    int(s.classNumber, '반', { min: 1, max: 99 }),
    int(s.studentId, '번호', { min: 1, max: 99 }),
    text(s.name, '이름', { max: 30 }).trim(),
  ];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await query(
        `INSERT INTO essays (title, introduction, body, conclusion, full_text,
           author_grade, author_class, author_number, author_name, edit_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [...values, newEditCode()],
      );
      return res.status(201).json(essayOut(rows[0], { includeEditCode: true }));
    } catch (err) {
      if (err.code !== '23505') throw err; // 수정 코드 중복이면 다시 시도
    }
  }
  throw new Error('수정 코드 생성에 실패했습니다.');
}));

// 수정 코드로 내 글 찾기
app.post('/api/essays/find', writeLimiter, wrap(async (req, res) => {
  const code = text(req.body?.code, '수정 코드', { max: 20 }).trim().toLowerCase();
  const { rows } = await query('SELECT * FROM essays WHERE edit_code = $1', [code]);
  if (!rows[0]) return res.status(404).json({ error: '코드가 일치하는 글을 찾을 수 없습니다.' });
  res.json(essayOut(rows[0], { includeEditCode: true }));
}));

// 수정 코드로 글 수정
app.put('/api/essays/by-code', writeLimiter, wrap(async (req, res) => {
  const code = text(req.body?.code, '수정 코드', { max: 20 }).trim().toLowerCase();
  const u = req.body?.updates || {};
  const sets = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (u.topic !== undefined) add('title', text(u.topic, '주제', { max: 300 }));
  if (u.introduction !== undefined) add('introduction', text(u.introduction, '서론', { max: 10000 }));
  if (u.body !== undefined) add('body', JSON.stringify(bodyParts(u.body)));
  if (u.conclusion !== undefined) add('conclusion', text(u.conclusion, '결론', { max: 10000 }));
  if (u.fullText !== undefined) add('full_text', text(u.fullText, '글 전체', { max: 40000 }));
  if (!sets.length) throw new BadRequest('수정할 내용이 없습니다.');

  params.push(code);
  const { rows } = await query(
    `UPDATE essays SET ${sets.join(', ')}, updated_at = NOW() WHERE edit_code = $${params.length} RETURNING *`,
    params,
  );
  if (!rows[0]) return res.status(404).json({ error: '코드가 일치하는 글을 찾을 수 없습니다.' });
  res.json(essayOut(rows[0], { includeEditCode: true }));
}));

// 좋아요 +1
app.post('/api/essays/:id/like', writeLimiter, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw new BadRequest('잘못된 글 번호입니다.');
  const { rows } = await query('UPDATE essays SET likes = likes + 1 WHERE id = $1 RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
  res.json(essayOut(rows[0]));
}));

// 글 삭제: 선생님이거나, 그 글의 수정 코드를 가진 학생만
app.delete('/api/essays/:id', writeLimiter, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw new BadRequest('잘못된 글 번호입니다.');
  let result;
  if (isAdminRequest(req)) {
    result = await query('DELETE FROM essays WHERE id = $1', [req.params.id]);
  } else {
    const code = String(req.get('x-edit-code') || '').trim().toLowerCase();
    if (!code) return res.status(401).json({ error: '글을 삭제할 권한이 없습니다.' });
    result = await query('DELETE FROM essays WHERE id = $1 AND edit_code = $2', [req.params.id, code]);
  }
  if (!result.rowCount) return res.status(404).json({ error: '글을 찾을 수 없거나 삭제 권한이 없습니다.' });
  res.json({ success: true });
}));

// 댓글 목록
app.get('/api/essays/:id/comments', wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw new BadRequest('잘못된 글 번호입니다.');
  const { rows } = await query(
    'SELECT * FROM comments WHERE essay_id = $1 ORDER BY created_at ASC',
    [req.params.id],
  );
  res.json(rows.map(commentOut));
}));

// 댓글 작성 ('선생님' 댓글은 로그인한 선생님만)
app.post('/api/essays/:id/comments', writeLimiter, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw new BadRequest('잘못된 글 번호입니다.');
  const b = req.body || {};
  const content = text(b.content, '댓글', { max: 2000 });
  const isTeacher = isAdminRequest(req);

  let author;
  if (isTeacher) {
    author = { grade: 0, class: 0, number: 0, name: '선생님' };
  } else {
    const name = text(b.authorName, '이름', { max: 30 }).trim();
    if (name.replace(/\s/g, '') === '선생님') {
      return res.status(403).json({ error: '선생님 이름은 선생님 로그인 후에만 쓸 수 있어요.' });
    }
    author = {
      grade: int(b.authorGrade, '학년', { min: 1, max: 6 }),
      class: int(b.authorClass, '반', { min: 1, max: 99 }),
      number: int(b.authorNumber, '번호', { min: 1, max: 99 }),
      name,
    };
  }

  try {
    const { rows } = await query(
      `INSERT INTO comments (essay_id, content, author_grade, author_class, author_number, author_name, is_teacher)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, content, author.grade, author.class, author.number, author.name, isTeacher],
    );
    res.status(201).json(commentOut(rows[0]));
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    throw err;
  }
}));

// 댓글 삭제 (선생님만)
app.delete('/api/comments/:id', requireAdmin, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw new BadRequest('잘못된 댓글 번호입니다.');
  const result = await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
  res.json({ success: true });
}));

// 선생님 로그인
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!checkAdminCredentials(username, password)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  res.json(issueToken({ remember: req.body?.remember === true }));
});

app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ ok: true }));

// ---------- 글쓰기 설정 (선생님이 바꿈) ----------

const DEFAULT_WRITING_SETTINGS = {
  requireMin: true, // 서론·결론 최소 글자 수 조건 사용
  minIntro: 100, // 서론 최소 글자 수 (공백 제외)
  minConclusion: 100, // 결론 최소 글자 수 (공백 제외)
  showRemaining: true, // 학생에게 '몇 자 남았는지' 보여주기
};

async function readWritingSettings() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'writing'");
  return { ...DEFAULT_WRITING_SETTINGS, ...(rows[0]?.value || {}) };
}

app.get('/api/settings', wrap(async (_req, res) => {
  res.json(await readWritingSettings());
}));

app.put('/api/settings', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const bool = (v, field) => {
    if (typeof v !== 'boolean') throw new BadRequest(`${field} 값이 올바르지 않습니다.`);
    return v;
  };
  const current = await readWritingSettings();
  const next = {
    requireMin: b.requireMin === undefined ? current.requireMin : bool(b.requireMin, '글자 수 조건'),
    minIntro: b.minIntro === undefined ? current.minIntro : int(b.minIntro, '서론 최소 글자 수', { min: 1, max: 3000 }),
    minConclusion: b.minConclusion === undefined ? current.minConclusion : int(b.minConclusion, '결론 최소 글자 수', { min: 1, max: 3000 }),
    showRemaining: b.showRemaining === undefined ? current.showRemaining : bool(b.showRemaining, '남은 글자 수 표시'),
  };
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('writing', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(next)],
  );
  res.json(next);
}));

// AI: 주제 다듬기
app.post('/api/ai/topic-suggestions', aiLimiter, wrap(async (req, res) => {
  const topic = text(req.body?.topic, '주제', { max: 300 });
  try {
    res.json(await getTopicSuggestions(topic, req.body?.grade));
  } catch (err) {
    console.error('[ai] topic-suggestions', err.message);
    res.json({
      refinedTopic: 'AI 추천 주제 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      suggestions: [],
    });
  }
}));

// AI: 글쓰기 도우미
app.post('/api/ai/assistant', aiLimiter, wrap(async (req, res) => {
  const question = text(req.body?.question, '질문', { max: 1000 });
  const c = req.body?.context || {};
  const context = {
    topic: text(c.topic ?? '', '주제', { max: 300, allowEmpty: true }),
    introduction: text(c.introduction ?? '', '서론', { max: 10000, allowEmpty: true }),
    body: text(c.body ?? '', '본론', { max: 20000, allowEmpty: true }),
    conclusion: text(c.conclusion ?? '', '결론', { max: 10000, allowEmpty: true }),
  };
  try {
    res.json({ answer: await getWritingAssistantResponse(context, question, req.body?.grade) });
  } catch (err) {
    console.error('[ai] assistant', err.message);
    res.json({ answer: 'AI 조수와 대화하는 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' });
  }
}));

app.use('/api', (_req, res) => res.status(404).json({ error: '없는 주소입니다.' }));

// 에러 처리
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: '잘못된 요청 형식입니다.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: '글이 너무 깁니다.' });
  console.error('[server]', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
});

const server = app.listen(config.port, config.host, () => {
  console.log(`✅ write0917 API 실행 중: http://${config.host}:${config.port} (AI: ${isAiConfigured ? '켜짐' : '꺼짐'})`);
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
