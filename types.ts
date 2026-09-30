
export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
}

export interface Student {
  grade: string;
  classNumber: string;
  studentId: string;
  name: string;
}

export interface BodyPart {
  reason: string;
  source: string;
}

export interface EssayData {
  topic: string;
  introduction: string;
  body: BodyPart[];
  conclusion: string;
  fullText: string;
}

export interface Essay extends EssayData {
  id: string; // uuid
  createdAt: string; // timestamp string
  student: Student;
  editCode?: string; // 작성자 본인(수정 코드 입력 후)과 선생님에게만 내려옵니다
  likes: number;
}

export interface Comment {
  id: string;
  createdAt: string;
  essayId: string;
  authorName: string;
  authorGrade: number;
  authorClass: number;
  authorNumber: number;
  content: string;
  isTeacher?: boolean;
}

// 선생님이 정하는 글쓰기 조건
export interface WritingSettings {
  requireMin: boolean; // 서론·결론 최소 글자 수 조건 사용
  minIntro: number; // 서론 최소 글자 수 (공백 제외)
  minConclusion: number; // 결론 최소 글자 수 (공백 제외)
  showRemaining: boolean; // 학생에게 남은 글자 수 보여주기
}

export const DEFAULT_WRITING_SETTINGS: WritingSettings = {
  requireMin: true,
  minIntro: 100,
  minConclusion: 100,
  showRemaining: true,
};
