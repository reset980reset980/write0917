# write0917 API 서버 (미니PC)

주장하는 글쓰기 도우미의 DB·AI 서버입니다. 화면은 Vercel(`write0917.vercel.app`), 이 서버는 미니PC에서 돌아갑니다.

```
브라우저 → write0917.vercel.app (화면)
        → write-api.xsw.kr (Caddy HTTPS) → 127.0.0.1:3917 (이 서버, PM2)
                                           ├─ PostgreSQL DB: write0917
                                           └─ Gemini API (키는 서버에만)
```

## 처음 설치

```bash
cd ~/write0917/server
npm install --omit=dev
cp .env.example .env        # 값 채우기 (아래 참고)
npm run migrate             # 테이블 생성 (여러 번 실행해도 안전)
pm2 start ecosystem.config.cjs && pm2 save
```

`.env` 에서 채울 값

| 항목 | 설명 |
|---|---|
| `DATABASE_URL` | `postgres://write0917:<비밀번호>@127.0.0.1:5432/write0917` |
| `ADMIN_USERNAME` | 선생님 로그인 아이디 |
| `ADMIN_PASSWORD_HASH` | `npm run hash-password -- '비밀번호'` 결과 |
| `TOKEN_SECRET` | `openssl rand -hex 32` 결과 |
| `GEMINI_API_KEY` | Gemini 키 |
| `ALLOWED_ORIGINS` | 화면 주소 (기본 `https://write0917.vercel.app`) |

Caddy 설정 (`/etc/caddy/Caddyfile` 에 추가)

```
write-api.xsw.kr {
    reverse_proxy 127.0.0.1:3917
}
```

## 운영

```bash
pm2 logs write0917-api          # 로그
pm2 restart write0917-api       # 재시작 (.env 수정 후)
curl -s https://write-api.xsw.kr/api/health
```

- 선생님 비밀번호 변경: `npm run hash-password -- '새비밀번호'` → `.env` 의 `ADMIN_PASSWORD_HASH` 교체 → 재시작
- 코드 업데이트: `git pull && npm install --omit=dev && npm run migrate && pm2 restart write0917-api`

## API 요약

| 메서드 | 주소 | 설명 |
|---|---|---|
| GET | `/api/essays?grade=&class=` | 글 목록 (수정 코드는 선생님에게만) |
| POST | `/api/essays` | 글 작성, 수정 코드 발급 |
| POST | `/api/essays/find` | 수정 코드로 글 찾기 |
| PUT | `/api/essays/by-code` | 수정 코드로 글 수정 |
| DELETE | `/api/essays/:id` | 삭제 (선생님 토큰 또는 `X-Edit-Code`) |
| POST | `/api/essays/:id/like` | 좋아요 +1 |
| GET/POST | `/api/essays/:id/comments` | 댓글 목록/작성 |
| POST | `/api/admin/login` | 선생님 로그인 → 토큰 |
| POST | `/api/ai/topic-suggestions` | 주제 다듬기 |
| POST | `/api/ai/assistant` | 글쓰기 도우미 |
