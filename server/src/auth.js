import crypto from 'node:crypto';
import { config } from './config.js';

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
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function safeEqualString(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function checkAdminCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return false;
  const userOk = safeEqualString(username, config.adminUsername);
  // 아이디가 틀려도 해시 계산은 수행해서 응답 시간 차이를 줄입니다.
  const passOk = verifyPassword(password, config.adminPasswordHash);
  return userOk && passOk;
}

function sign(payload) {
  return crypto.createHmac('sha256', config.tokenSecret).update(payload).digest('base64url');
}

export function issueToken() {
  const exp = Date.now() + config.tokenTtlHours * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

export function isValidToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!safeEqualString(signature, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.role === 'admin' && typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function isAdminRequest(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return isValidToken(token);
}

export function requireAdmin(req, res, next) {
  if (!isAdminRequest(req)) {
    return res.status(401).json({ error: '선생님 로그인이 필요합니다.' });
  }
  next();
}
