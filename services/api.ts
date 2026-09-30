import { Essay, Comment, EssayData } from '../types';
import { API_BASE_URL } from '../constants';

// 선생님 로그인 토큰 (새로고침하면 다시 로그인)
let adminToken: string | null = null;

export function setAdminToken(token: string | null) {
    adminToken = token;
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

// 선생님 로그인 (성공하면 토큰 저장)
export async function loginTeacher(username: string, password: string): Promise<boolean> {
    try {
        const { token } = await request<{ token: string }>('/api/admin/login', {
            method: 'POST',
            json: { username, password },
        });
        setAdminToken(token);
        return true;
    } catch (err) {
        if (err instanceof ApiError && err.status === 401) return false;
        throw err;
    }
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
): Promise<string> {
    const { answer } = await request<{ answer: string }>('/api/ai/assistant', {
        method: 'POST',
        json: { context, question, grade },
    });
    return answer;
}
