# 주장하는 글쓰기 도우미

초등학생을 위한 AI 논설문(주장하는 글) 작성 도우미입니다. 주제 정하기부터 글 완성까지 단계별로 돕고, 친구들 글에 좋아요와 댓글을 남길 수 있습니다.

- 화면: Vercel — https://write0917.vercel.app (이 폴더, React + Vite)
- DB·AI 서버: 미니PC — https://write-api.xsw.kr (`server/` 폴더, 설치 방법은 [server/README.md](server/README.md))

## 화면 로컬 실행

```bash
npm install
npm run dev
```

기본으로 `https://write-api.xsw.kr` 서버를 씁니다. 다른 서버를 쓰려면 `.env.local` 에 `VITE_API_BASE_URL=http://localhost:3917` 처럼 적으세요. (그 주소를 서버 `.env` 의 `ALLOWED_ORIGINS` 에도 추가해야 합니다.)
