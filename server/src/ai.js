import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { config } from './config.js';

// 선생님마다 자기 Gemini 키를 씀 (서버 .env 키는 관리자 반에서만)
const clients = new Map();
function clientFor(apiKey) {
  if (!clients.has(apiKey)) {
    if (clients.size > 200) clients.delete(clients.keys().next().value);
    clients.set(apiKey, new GoogleGenAI({ apiKey }));
  }
  return clients.get(apiKey);
}
const keyId = (apiKey) => crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 10);

export const isAiConfigured = !!config.geminiApiKey;

// ---------- 선생님 AI 키 (DB에 저장하지 않고 서버 메모리에만 잠시 보관) ----------
const teacherKeys = new Map(); // teacherId -> { key, at }

export function setTeacherAiKey(teacherId, apiKey) {
  if (apiKey) teacherKeys.set(teacherId, { key: apiKey, at: Date.now() });
  else teacherKeys.delete(teacherId);
}

export function hasTeacherAiKey(teacherId) {
  return teacherKeys.has(teacherId);
}

/** 이 반 학생들이 쓸 AI 키 */
export function aiKeyForTeacher(teacher) {
  if (!teacher) return '';
  return teacherKeys.get(teacher.id)?.key || (teacher.is_admin ? config.geminiApiKey : '') || '';
}

/** 키가 진짜 동작하는지 가볍게 확인 (사용량을 거의 쓰지 않는 모델 목록 조회) */
export async function checkGeminiKey(apiKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`);
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => null);
    return { ok: false, message: data?.error?.message || `확인 실패 (${res.status})` };
  } catch {
    return { ok: false, message: 'Google 서버에 연결하지 못했어요.' };
  }
}

/** 모든 모델이 한도 초과·혼잡일 때 */
export class AiUnavailableError extends Error {
  constructor(reason) {
    super(reason === 'quota' ? 'AI 사용량 한도 초과' : reason === 'nokey' ? 'AI 키 없음' : 'AI 일시 오류');
    this.reason = reason; // 'quota' | 'busy' | 'nokey' | 'badkey'
  }
}

// ---------- 모델 순서와 자동 전환 ----------
// 무료 요금제는 모델마다 하루 한도가 따로 있어서, 한 모델이 막히면 다음 모델로 넘어감
const MODELS = [config.geminiModel, ...config.geminiFallbackModels].filter((m, i, a) => m && a.indexOf(m) === i);

// 한도가 찬 모델은 잠시 건너뜀 (매 요청마다 실패를 기다리지 않도록)
const cooldownUntil = new Map();
const COOLDOWN_QUOTA_MS = 30 * 60 * 1000; // 하루 한도 초과: 30분 뒤 다시 시도
const COOLDOWN_BUSY_MS = 60 * 1000; // 일시 혼잡: 1분

// 빠른 응답을 위해 '생각' 단계를 최소로 (모델 세대마다 설정 방식이 다름)
function thinkingFor(model) {
  if (/^gemini-(3|flash)/.test(model)) return { thinkingLevel: 'minimal' };
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  return undefined;
}

function errorStatus(err) {
  const msg = String(err?.message || '');
  const code = err?.status || Number((msg.match(/"code":\s*(\d{3})/) || [])[1]);
  return { code, msg };
}

async function generate(params, apiKey) {
  if (!apiKey) throw new AiUnavailableError('nokey');
  const ai = clientFor(apiKey);
  const kid = keyId(apiKey);
  const cd = (m) => `${kid}:${m}`;
  let sawQuota = false;
  const now = Date.now();
  const candidates = MODELS.filter((m) => (cooldownUntil.get(cd(m)) || 0) <= now);
  for (const model of candidates.length ? candidates : MODELS) {
    const thinking = thinkingFor(model);
    const attempt = (withThinking) =>
      ai.models.generateContent({
        model,
        contents: params.contents,
        config: { ...params.config, ...(withThinking && thinking ? { thinkingConfig: thinking } : {}) },
      });
    try {
      try {
        return await attempt(true);
      } catch (err) {
        // 이 모델이 생각 설정을 모르면 설정 없이 한 번 더
        if (thinking && errorStatus(err).code === 400) return await attempt(false);
        throw err;
      }
    } catch (err) {
      const { code, msg } = errorStatus(err);
      if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg) || code === 401 || code === 403) {
        throw new AiUnavailableError('badkey');
      }
      if (code === 429) {
        sawQuota = true;
        cooldownUntil.set(cd(model), Date.now() + (/PerDay/i.test(msg) ? COOLDOWN_QUOTA_MS : COOLDOWN_BUSY_MS));
      } else if (code === 503 || code === 500) {
        cooldownUntil.set(cd(model), Date.now() + COOLDOWN_BUSY_MS);
      } else if (code === 404) {
        cooldownUntil.set(cd(model), Date.now() + 24 * 3600 * 1000); // 없어진 모델
      } else if (code !== 400) {
        throw err;
      }
      console.warn(`[ai] ${model} 실패 (${code}) → 다음 모델`);
    }
  }
  throw new AiUnavailableError(sawQuota ? 'quota' : 'busy');
}

function gradeLabel(grade) {
  const g = Number(grade);
  return Number.isInteger(g) && g >= 1 && g <= 6 ? `초등학교 ${g}학년` : '초등학교';
}

export async function getTopicSuggestions(originalTopic, grade, apiKey) {

  const prompt = `${gradeLabel(grade)} 학생이 주장하는 글(논설문)의 주제를 작성했습니다.
모든 주제는 명확한 '주장'이 드러나도록 "~해야 한다", "~하자"와 같은 서술로 끝나야 합니다. 설명하는 듯한 제목은 피해주세요.
학생의 학년 수준에 맞는 쉬운 말로 써주세요.

1. 원래 주제를 더 명확하고, 흥미로우며, 논리적인 '주장'으로 다듬어 주세요.
2. 원래 주제와 관련하여, 학생들이 흥미를 가질 만한 새로운 대안 '주장' 3가지를 제안해주세요.

원래 주제: "${originalTopic}"

JSON 형식으로 응답해주세요.`;

  const response = await generate({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          refinedTopic: { type: Type.STRING, description: '원래 주제를 다듬은 버전입니다.' },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '대안으로 제시하는 3가지 새로운 주제입니다.',
          },
        },
        required: ['refinedTopic', 'suggestions'],
      },
    },
  }, apiKey);

  const parsed = JSON.parse(response.text);
  return {
    refinedTopic: String(parsed.refinedTopic || ''),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).slice(0, 5) : [],
  };
}

export async function getWritingAssistantResponse(context, question, grade, apiKey) {

  const systemInstruction = `당신은 '글쓰기 요정'입니다. 한국의 ${gradeLabel(grade)} 학생이 '주장하는 글'을 쓰는 것을 돕는, 친절하고 상냥한 AI 조수입니다.
- 항상 학생을 격려하는 말투를 사용하고, 학생의 학년 수준에 맞는 이해하기 쉬운 한국어로 설명해주세요.
- 절대로 학생 대신 글을 써주지 마세요. 서론·본론·결론이나 완성된 문단을 대신 써 달라는 부탁을 받으면 부드럽게 거절하고, 스스로 쓸 수 있도록 질문을 던지세요.
- 대신, 학생이 스스로 생각하고 더 나은 글을 쓸 수 있도록 '질문'을 던지거나, 짧은 '예시'를 보여주거나, '단계별 조언'을 해주세요.
- 글쓰기와 관계없는 질문에는 짧게 답하고 글쓰기로 다시 이끌어 주세요.
- 답변은 5문장 이내로 짧고 명확하게, 이모지는 1개 이하로 써주세요.`;

  const prompt = `학생의 현재 글쓰기 상황:
- 주제: ${context.topic || '(아직 정하지 않았음)'}
- 서론: ${context.introduction || '(아직 작성하지 않았음)'}
- 본론: ${context.body || '(아직 작성하지 않았음)'}
- 결론: ${context.conclusion || '(아직 작성하지 않았음)'}

학생의 질문: "${question}"

위 상황과 질문을 바탕으로, '글쓰기 요정'으로서 학생에게 도움이 되는 답변을 해주세요.`;

  const response = await generate({ contents: prompt, config: { systemInstruction } }, apiKey);
  return response.text || '';
}

// ---------- AI를 못 쓸 때 대신 보여줄 팁 ----------
const OFFLINE_TIPS = {
  1: '주제는 "누가, 무엇을, 어떻게 해야 한다"가 드러나게 한 문장으로 써 보세요. "~해야 한다", "~하자"로 끝나면 주장이 또렷해져요.',
  2: '근거를 찾을 때는 ① 내가 겪은 일 ② 친구들에게 물어본 결과 ③ 책이나 기사에서 알게 된 사실을 떠올려 보세요. 근거마다 어디서 알았는지 출처도 꼭 적어요.',
  3: '글을 소리 내어 읽어 보세요. 숨이 차거나 어색한 곳, 같은 말을 반복한 곳이 고칠 곳이에요. 결론에서 주장을 한 번 더 말했는지도 확인해요.',
};

export function offlineAnswer(reason, step) {
  const head =
    reason === 'quota'
      ? '지금은 글쓰기 요정이 오늘 할 수 있는 이야기를 다 해서 쉬고 있어요. 😴 (AI 사용량 한도) 내일 다시 불러 주세요.'
      : reason === 'nokey'
      ? '글쓰기 요정이 아직 깨어나지 않았어요. 선생님께 "AI 키 연결"을 부탁드려요.'
      : reason === 'badkey'
      ? '글쓰기 요정을 부르는 열쇠(AI 키)가 맞지 않아요. 선생님께 알려 주세요.'
      : '지금은 글쓰기 요정을 찾는 친구들이 너무 많아요. 잠시 뒤 다시 물어봐 주세요.';
  return `${head}\n\n대신 요정의 팁 하나!\n${OFFLINE_TIPS[step] || OFFLINE_TIPS[2]}`;
}
