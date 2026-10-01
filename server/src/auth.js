import crypto from 'node:crypto';
import { config } from './config.js';
import { query } from './db.js';

// 비밀번호 해시 형식: scrypt$<salt hex>$<hash hex>
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// 아이디가 없을 때도 비슷한 시간이 걸리도록 쓰는 가짜 해시
const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString('hex'));

function safeEqualString(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ---------- 코드 만들기 ----------

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 0, O, 1, I, L 제외
export function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return code;
}

export function normalizeClassCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

// ---------- 선생님 조회 (짧게 캐시) ----------

const CACHE_MS = 30 * 1000;
const byId = new Map();
const byCode = new Map();

export function forgetTeacher(t) {
  if (!t) return;
  byId.delete(t.id);
  byCode.delete(t.class_code);
}

function remember(t) {
  const at = Date.now();
  byId.set(t.id, { t, at });
  byCode.set(t.class_code, { t, at });
  return t;
}

export async function getTeacherById(id) {
  const hit = byId.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.t;
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const { rows } = await query('SELECT * FROM teachers WHERE id = $1', [id]);
  return rows[0] ? remember(rows[0]) : null;
}

export async function getTeacherByClassCode(code) {
  const c = normalizeClassCode(code);
  if (!c || c.length > 12) return null;
  const hit = byCode.get(c);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.t;
  const { rows } = await query('SELECT * FROM teachers WHERE class_code = $1', [c]);
  return rows[0] ? remember(rows[0]) : null;
}

export async function findTeacherForLogin(loginId, password) {
  const id = String(loginId || '').trim().toLowerCase();
  const { rows } = id ? await query('SELECT * FROM teachers WHERE login_id = $1', [id]) : { rows: [] };
  const t = rows[0];
  const ok = verifyPassword(String(password || ''), t ? t.password_hash : DUMMY_HASH);
  return ok && t ? remember(t) : null;
}

// ---------- 로그인 토큰 ----------
// 비밀번호 해시를 서명 키에 섞어서, 비밀번호를 바꾸면 기존 로그인(유지 포함)이 모두 풀리게 함

function sign(payload, passwordHash) {
  return crypto.createHmac('sha256', `${config.tokenSecret}:${passwordHash}`).update(payload).digest('base64url');
}

export function issueToken(teacher, { remember: keep = false } = {}) {
  const ttlMs = keep ? config.rememberDays * 86400 * 1000 : config.tokenTtlHours * 3600 * 1000;
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ tid: teacher.id, exp })).toString('base64url');
  return { token: `${payload}.${sign(payload, teacher.password_hash)}`, expiresAt: new Date(exp).toISOString() };
}

/** 요청을 보낸 선생님 (로그인 안 했으면 null) */
export async function teacherFromRequest(req) {
  if (req._teacher !== undefined) return req._teacher;
  req._teacher = null;
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data?.tid || typeof data.exp !== 'number' || data.exp <= Date.now()) return null;
  const t = await getTeacherById(data.tid);
  if (!t || !safeEqualString(signature, sign(payload, t.password_hash))) return null;
  req._teacher = t;
  return t;
}

export function requireTeacher(req, res, next) {
  teacherFromRequest(req)
    .then((t) => (t ? next() : res.status(401).json({ error: '선생님 로그인이 필요합니다.' })))
    .catch(next);
}

export function requireAdmin(req, res, next) {
  teacherFromRequest(req)
    .then((t) => {
      if (!t) return res.status(401).json({ error: '선생님 로그인이 필요합니다.' });
      if (!t.is_admin) return res.status(403).json({ error: '관리자만 할 수 있어요.' });
      next();
    })
    .catch(next);
}

/**
 * 이 요청이 속한 학급(선생님)
 * - 선생님이 로그인했으면 그 선생님 반
 * - 학생은 X-Class-Code 헤더의 학급 코드로 찾음
 */
export async function classTeacherFromRequest(req) {
  const t = await teacherFromRequest(req);
  if (t) return t;
  const code = req.get('x-class-code');
  return code ? getTeacherByClassCode(code) : null;
}

// ---------- 관리자 계정 (.env 의 ADMIN_USERNAME / ADMIN_PASSWORD_HASH) ----------

export async function ensureAdminTeacher() {
  const loginId = config.adminUsername.trim().toLowerCase();
  let { rows } = await query('SELECT * FROM teachers WHERE login_id = $1', [loginId]);
  let admin = rows[0];
  if (!admin) {
    for (let i = 0; i < 10 && !admin; i += 1) {
      try {
        ({ rows } = await query(
          `INSERT INTO teachers (login_id, name, password_hash, class_code, is_admin)
           VALUES ($1, '관리자 선생님', $2, $3, TRUE) RETURNING *`,
          [loginId, config.adminPasswordHash, randomCode()],
        ));
        admin = rows[0];
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
  } else if (admin.password_hash !== config.adminPasswordHash || !admin.is_admin) {
    ({ rows } = await query('UPDATE teachers SET password_hash = $2, is_admin = TRUE WHERE id = $1 RETURNING *', [
      admin.id,
      config.adminPasswordHash,
    ]));
    admin = rows[0];
  }
  // 학급 기능 이전에 쓴 글과 설정은 관리자 반으로
  await query('UPDATE essays SET teacher_id = $1 WHERE teacher_id IS NULL', [admin.id]);
  await query(
    `INSERT INTO settings (key, value) SELECT $1, value FROM settings WHERE key = 'writing'
     ON CONFLICT (key) DO NOTHING`,
    [`writing:${admin.id}`],
  );
  forgetTeacher(admin);
  return admin;
}
