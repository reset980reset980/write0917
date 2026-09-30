import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경 변수 ${name} 가 설정되지 않았습니다. server/.env 를 확인하세요.`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3917),
  host: process.env.HOST || '127.0.0.1',
  databaseUrl: required('DATABASE_URL'),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://write0917.vercel.app')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  adminUsername: required('ADMIN_USERNAME'),
  adminPasswordHash: required('ADMIN_PASSWORD_HASH'),
  tokenSecret: required('TOKEN_SECRET'),
  tokenTtlHours: Number(process.env.TOKEN_TTL_HOURS || 12),
  // '로그인 상태 유지'를 켰을 때 유효 기간 (일)
  rememberDays: Number(process.env.REMEMBER_DAYS || 30),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // 첫 번째로 쓸 모델, 한도가 차면 뒤의 모델로 자동 전환
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-2.5-flash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
