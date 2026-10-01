import { Essay, Comment, EssayData, WritingSettings, DEFAULT_WRITING_SETTINGS } from '../types';
import { API_BASE_URL } from '../constants';

// 선생님 로그인 토큰 (새로고침하면 다시 로그인)
let adminToken: string | null = null;

export function setAdminToken(token: string | null) {
    adminToken = token;
}

// 학생이 들어온 학급 코드 (모든 요청에 함께 보냄)
let classCode: string | null = null;

export function setClassCode(code: string | null) {
    classCode = code ? code.trim().toUpperCase() : null;
}

export interface TeacherInfo {
    id: string;
    name: string;
    loginId: string;
    classCode: string;
    isAdmin: boolean;
    aiConnected: boolean;
    sharedAi: boolean;
}

class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function request<T>(path: string, options: RequestInit & { json?: unknown; editCode?: string } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.json !== undefined) headers['Content-Type'] = 'application/json';
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    if (classCode) headers['X-Class-Code'] = classCode;
    if (options.editCode) headers['X-Edit-Code'] = options.editCode;

    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, {
            method: options.method || 'GET',
            headers,
            body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
        });
    } catch {
        throw new ApiError('서버에 연결할 수 없습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.', 0);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(data?.error || `요청에 실패했습니다. (${res.status})`, res.status);
    }
    return data as T;
}

// 글 작성 (수정 코드는 서버가 만들어 돌려줍니다)
export function addEssay(essay: Omit<Essay, 'id' | 'createdAt' | 'likes' | 'editCode'>): Promise<Essay> {
    return request<Essay>('/api/essays', { method: 'POST', json: essay });
}

// 모든 글 불러오기
export function getAllEssays(): Promise<Essay[]> {
    return request<Essay[]>('/api/essays');
}

// 수정 코드로 글 찾기
export async function findEssayByEditCode(code: string): Promise<Essay | null> {
    try {
        return await request<Essay>('/api/essays/find', { method: 'POST', json: { code } });
    } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
    }
}

// 글 수정
export function updateEssay(editCode: string, updates: Partial<EssayData>): Promise<Essay> {
    return request<Essay>('/api/essays/by-code', { method: 'PUT', json: { code: editCode, updates } });
}

// 좋아요 증가
export function incrementLike(essayId: string): Promise<Essay> {
    return request<Essay>(`/api/essays/${essayId}/like`, { method: 'POST' });
}

// 글 삭제 (선생님 로그인 상태이거나, 학생이 수정 코드를 가진 경우)
export function deleteEssay(id: string, editCode?: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/essays/${id}`, { method: 'DELETE', editCode });
}

// 댓글 작성
export function addComment(
    essayId: string,
    authorName: string,
    content: string,
    authorInfo: { grade: number; class: number; number: number },
): Promise<Comment> {
    return request<Comment>(`/api/essays/${essayId}/comments`, {
        method: 'POST',
        json: {
            content,
            authorName,
            authorGrade: authorInfo.grade,
            authorClass: authorInfo.class,
            authorNumber: authorInfo.number,
        },
    });
}

// 특정 글의 댓글들 불러오기
export function getComments(essayId: string): Promise<Comment[]> {
    return request<Comment[]>(`/api/essays/${essayId}/comments`);
}

// 댓글 삭제 (선생님만)
export function deleteComment(commentId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/comments/${commentId}`, { method: 'DELETE' });
}

// 글쓰기 설정 (누구나 읽기, 선생님만 저장)
export async function getWritingSettings(): Promise<WritingSettings> {
    try {
        return { ...DEFAULT_WRITING_SETTINGS, ...(await request<Partial<WritingSettings>>('/api/settings')) };
    } catch {
        return DEFAULT_WRITING_SETTINGS; // 서버에 못 닿아도 글쓰기는 기본값으로 계속
    }
}

export function saveWritingSettings(settings: WritingSettings): Promise<WritingSettings> {
    return request<WritingSettings>('/api/settings', { method: 'PUT', json: settings });
}

// 저장해 둔 선생님 토큰이 아직 유효한지 확인 (유효하면 선생님 정보)
export async function verifyAdminToken(): Promise<TeacherInfo | null> {
    if (!adminToken) return null;
    try {
        const { teacher } = await request<{ teacher: TeacherInfo }>('/api/admin/me');
        return teacher;
    } catch {
        return null;
    }
}

export const getTeacherMe = verifyAdminToken;

// 선생님 로그인 (성공하면 토큰 저장)
export async function loginTeacher(
    username: string,
    password: string,
    remember = false,
): Promise<{ token: string; teacher: TeacherInfo } | null> {
    try {
        const data = await request<{ token: string; teacher: TeacherInfo }>('/api/admin/login', {
            method: 'POST',
            json: { username, password, remember },
        });
        setAdminToken(data.token);
        return data;
    } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
    }
}

// 선생님 가입 (초대 코드 필요)
export async function registerTeacher(input: {
    name: string;
    email: string;
    password: string;
    passwordConfirm: string;
    inviteCode: string;
    remember: boolean;
}): Promise<{ token: string; teacher: TeacherInfo }> {
    const data = await request<{ token: string; teacher: TeacherInfo }>('/api/teachers/register', { method: 'POST', json: input });
    setAdminToken(data.token);
    return data;
}

// 학급 코드 확인 (학생 입장)
export async function lookupClass(code: string): Promise<{ classCode: string; teacherName: string; aiReady: boolean } | null> {
    try {
        return await request(`/api/classes/${encodeURIComponent(code.trim().toUpperCase())}`);
    } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
    }
}

// 선생님 AI 키: 브라우저에 저장된 키를 서버 메모리에 연결 (서버 DB에는 저장 안 됨)
export function connectAiKey(key: string, verify = true): Promise<{ aiConnected: boolean }> {
    return request('/api/teacher/ai-key', { method: 'POST', json: { key, verify } });
}

export function disconnectAiKey(): Promise<{ aiConnected: boolean }> {
    return request('/api/teacher/ai-key', { method: 'DELETE' });
}

// 관리자: 가입 초대 코드
export function getInviteCode(): Promise<{ inviteCode: string }> {
    return request('/api/admin/invite-code');
}

export function saveInviteCode(inviteCode: string): Promise<{ inviteCode: string }> {
    return request('/api/admin/invite-code', { method: 'PUT', json: { inviteCode } });
}

// ---------- AI (키는 서버에만 있습니다) ----------

export function getTopicSuggestions(topic: string, grade?: string): Promise<{ refinedTopic: string; suggestions: string[] }> {
    return request<{ refinedTopic: string; suggestions: string[] }>('/api/ai/topic-suggestions', {
        method: 'POST',
        json: { topic, grade },
    }).catch((err) => ({
        refinedTopic: err?.message || 'AI 추천 주제 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        suggestions: [],
    }));
}

export async function getWritingAssistantResponse(
    context: { topic: string; introduction: string; body: string; conclusion: string },
    question: string,
    grade?: string,
    step?: number,
): Promise<string> {
    const { answer } = await request<{ answer: string }>('/api/ai/assistant', {
        method: 'POST',
        json: { context, question, grade, step },
    });
    return answer;
}
