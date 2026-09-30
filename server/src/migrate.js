import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('✅ DB 테이블 준비 완료');
} catch (err) {
  console.error('❌ DB 테이블 생성 실패:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
