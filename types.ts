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
  editCode: string;
  likes: number;
}

export interface Comment {
  id: string;
  createdAt: string;
  essayId: string;
  authorName: string;
  content: string;
}
