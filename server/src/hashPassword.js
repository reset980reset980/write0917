// 사용법: npm run hash-password -- '새비밀번호'
// 출력된 값을 server/.env 의 ADMIN_PASSWORD_HASH 에 넣으세요.
import crypto from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error("사용법: npm run hash-password -- '비밀번호'");
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
