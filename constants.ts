// 미니PC API 서버 주소
// 다른 주소로 바꾸려면 Vercel 환경 변수 VITE_API_BASE_URL 을 설정하세요.
export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL || 'https://write-api.xsw.kr';

// 학생이 고를 수 있는 학년
export const GRADES = ['1', '2', '3', '4', '5', '6'];
