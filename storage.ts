import { useEffect, useState } from 'react';
import type { Student, Essay, BodyPart } from './types';

// localStorage / sessionStorage 는 개인정보 보호 모드 등에서 막힐 수 있어 항상 try/catch
function read<T>(storage: Storage | undefined, key: string, fallback: T): T {
    try {
        const raw = storage?.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function write(storage: Storage | undefined, key: string, value: unknown) {
    try {
        if (value === null || value === undefined) storage?.removeItem(key);
        else storage?.setItem(key, JSON.stringify(value));
    } catch {
        /* 저장 실패는 무시 */
    }
}

const local = typeof window !== 'undefined' ? window.localStorage : undefined;
const session = typeof window !== 'undefined' ? window.sessionStorage : undefined;

/** 상태 + 저장소 동기화 */
export function useStoredState<T>(key: string, fallback: T, where: 'local' | 'session' = 'local') {
    const storage = where === 'local' ? local : session;
    const [value, setValue] = useState<T>(() => read(storage, key, fallback));
    useEffect(() => {
        write(storage, key, value);
    }, [storage, key, value]);
    return [value, setValue] as const;
}

// ---------- 로그인 상태 (탭을 닫으면 사라짐) ----------

export const sessionStore = {
    getStudent: () => read<Student | null>(session, 'w917.student', null),
    setStudent: (s: Student | null) => write(session, 'w917.student', s),
    getAdminToken: () => read<string | null>(session, 'w917.adminToken', null),
    setAdminToken: (t: string | null) => write(session, 'w917.adminToken', t),
};

// ---------- 좋아요 누른 글 ----------

export const likedStore = {
    get: () => new Set(read<string[]>(local, 'likedEssays', [])),
    set: (ids: Set<string>) => write(local, 'likedEssays', Array.from(ids)),
};

// ---------- 이 기기에서 쓴 내 글 (수정 코드 기억) ----------

export type MyEssayRef = { id: string; editCode: string; topic: string; createdAt: string };

export const myEssaysStore = {
    all: () => read<MyEssayRef[]>(local, 'w917.myEssays', []),
    add(essay: Essay) {
        if (!essay.editCode) return;
        const list = this.all().filter((e) => e.id !== essay.id);
        list.unshift({ id: essay.id, editCode: essay.editCode, topic: essay.topic, createdAt: essay.createdAt });
        write(local, 'w917.myEssays', list.slice(0, 50));
    },
    update(id: string, topic: string) {
        write(local, 'w917.myEssays', this.all().map((e) => (e.id === id ? { ...e, topic } : e)));
    },
    remove(id: string) {
        write(local, 'w917.myEssays', this.all().filter((e) => e.id !== id));
    },
    codeFor(id: string) {
        return this.all().find((e) => e.id === id)?.editCode;
    },
};

// ---------- 글쓰기 임시저장 ----------

export type Draft = {
    step: number;
    topic: string;
    introduction: string;
    body: BodyPart[];
    conclusion: string;
    finalFullText: string;
    partsKey: string; // 3단계 전체글을 마지막으로 만든 시점의 서론·본론·결론
    savedAt: string;
};

function studentKey(s: Student) {
    return `w917.draft.${s.grade}-${s.classNumber}-${s.studentId}-${s.name}`;
}

export const draftStore = {
    key: (student: Student, essayId?: string) => (essayId ? `w917.draft.edit.${essayId}` : studentKey(student)),
    get: (key: string) => read<Draft | null>(local, key, null),
    set: (key: string, d: Draft) => write(local, key, d),
    clear: (key: string) => write(local, key, null),
};
