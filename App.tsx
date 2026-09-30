import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Essay, EssayData, Student } from './types';
import { FeedbackProvider, Spinner, useFeedback } from './components/ui';
import { AppHeader } from './components/AppHeader';
import { LandingView, StudentEntryView, TeacherLoginView } from './views/EntryViews';
import { GalleryView } from './views/GalleryView';
import { EssayDetailView } from './views/EssayDetailView';
import { WritingWizard } from './views/WritingWizard';
import { FindByCodeView, WritingSuccessView } from './views/SmallViews';
import { addEssay, deleteEssay, getAllEssays, incrementLike, setAdminToken, updateEssay, verifyAdminToken } from './services/api';
import { likedStore, myEssaysStore, sessionStore } from './storage';

type View =
    | { name: 'booting' }
    | { name: 'landing' }
    | { name: 'student-entry' }
    | { name: 'teacher-login' }
    | { name: 'gallery' }
    | { name: 'detail'; essay: Essay }
    | { name: 'write' }
    | { name: 'edit'; essay: Essay }
    | { name: 'success'; essay: Essay; wasEdit: boolean }
    | { name: 'find' };

const AppInner: React.FC = () => {
    const { toast, confirm } = useFeedback();
    const [view, setView] = useState<View>({ name: 'booting' });
    const [student, setStudent] = useState<Student | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    const [essays, setEssays] = useState<Essay[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [likedIds, setLikedIds] = useState<Set<string>>(() => likedStore.get());
    const [myEssays, setMyEssays] = useState(() => myEssaysStore.all());
    const myEssayIds = new Set(myEssays.map((e) => e.id));

    // ---------- 화면 이동 (브라우저 뒤로가기 지원) ----------
    const viewRef = useRef(view);
    viewRef.current = view;

    const go = useCallback((next: View, { push = true } = {}) => {
        setView(next);
        window.scrollTo({ top: 0 });
        if (push && next.name !== 'gallery' && next.name !== 'landing') {
            window.history.pushState({ w917: next.name }, '');
        }
    }, []);

    useEffect(() => {
        const onPop = () => {
            const current = viewRef.current.name;
            if (current === 'write' || current === 'edit') {
                // 글쓰기 중 뒤로가기: 임시저장돼 있으니 목록으로
                toast('쓰던 글은 임시저장돼 있어요.', 'info');
            }
            if (['detail', 'write', 'edit', 'success', 'find'].includes(current)) setView({ name: 'gallery' });
            else if (current === 'student-entry' || current === 'teacher-login') setView({ name: 'landing' });
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [toast]);

    // ---------- 글 목록 ----------
    const loadEssays = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setEssays(await getAllEssays());
        } catch (err: any) {
            setLoadError(err?.message || '글 목록을 불러오지 못했어요.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view.name === 'gallery') loadEssays();
    }, [view.name, loadEssays]);

    // ---------- 새로고침해도 로그인 유지 ----------
    useEffect(() => {
        (async () => {
            const token = sessionStore.getAdminToken();
            if (token) {
                setAdminToken(token);
                if (await verifyAdminToken()) {
                    setIsAdmin(true);
                    setView({ name: 'gallery' });
                    return;
                }
                setAdminToken(null);
                sessionStore.setAdminToken(null);
            }
            const s = sessionStore.getStudent();
            if (s) {
                setStudent(s);
                setView({ name: 'gallery' });
                return;
            }
            setView({ name: 'landing' });
        })();
    }, []);

    const logout = async () => {
        if (view.name === 'write' || view.name === 'edit') {
            const ok = await confirm({ title: '나갈까요?', message: '쓰던 글은 이 기기에 임시저장돼 있어요.', confirmText: '나가기' });
            if (!ok) return;
        }
        setStudent(null);
        setIsAdmin(false);
        setAdminToken(null);
        sessionStore.setStudent(null);
        sessionStore.setAdminToken(null);
        setEssays([]);
        go({ name: 'landing' });
    };

    // ---------- 동작 ----------
    const rememberMine = (essay: Essay) => {
        myEssaysStore.add(essay);
        setMyEssays(myEssaysStore.all());
    };

    const handleCreate = async (data: EssayData): Promise<boolean> => {
        if (!student) return false;
        try {
            const essay = await addEssay({ ...data, student });
            rememberMine(essay);
            setEssays((prev) => [essay, ...prev]);
            go({ name: 'success', essay, wasEdit: false }, { push: false });
            return true;
        } catch (err: any) {
            toast(err?.message || '글을 올리지 못했어요. 임시저장은 되어 있으니 잠시 뒤 다시 눌러 주세요.', 'error');
            return false;
        }
    };

    const handleUpdate = (original: Essay) => async (data: EssayData): Promise<boolean> => {
        if (!original.editCode) return false;
        try {
            const essay = await updateEssay(original.editCode, data);
            if (myEssayIds.has(essay.id)) {
                myEssaysStore.update(essay.id, essay.topic);
                setMyEssays(myEssaysStore.all());
            }
            setEssays((prev) => prev.map((e) => (e.id === essay.id ? { ...e, ...essay } : e)));
            go({ name: 'success', essay, wasEdit: true }, { push: false });
            return true;
        } catch (err: any) {
            toast(err?.message || '고친 내용을 저장하지 못했어요.', 'error');
            return false;
        }
    };

    const startEdit = (essay: Essay) => {
        const code = essay.editCode || myEssaysStore.codeFor(essay.id);
        if (!code) {
            go({ name: 'find' });
            return;
        }
        go({ name: 'edit', essay: { ...essay, editCode: code } });
    };

    const handleDelete = async (essay: Essay, { skipConfirm = false } = {}): Promise<boolean> => {
        if (!skipConfirm) {
            const ok = await confirm({
                title: '글을 지울까요?',
                message: (
                    <>
                        <b>{essay.student.name}</b> 학생의 <b>“{essay.topic}”</b> 글과 댓글이 모두 사라지고, 되돌릴 수 없어요.
                    </>
                ),
                confirmText: '지우기',
                tone: 'danger',
            });
            if (!ok) return false;
        }
        try {
            await deleteEssay(essay.id, isAdmin ? undefined : essay.editCode || myEssaysStore.codeFor(essay.id));
            setEssays((prev) => prev.filter((e) => e.id !== essay.id));
            myEssaysStore.remove(essay.id);
            setMyEssays(myEssaysStore.all());
            toast('글을 지웠어요.');
            if (view.name === 'detail') go({ name: 'gallery' }, { push: false });
            return true;
        } catch (err: any) {
            toast(err?.message || '글을 지우지 못했어요.', 'error');
            return false;
        }
    };

    const handleLike = async (essay: Essay) => {
        if (likedIds.has(essay.id)) return;
        const next = new Set(likedIds).add(essay.id);
        setLikedIds(next);
        likedStore.set(next);
        const bump = (e: Essay) => (e.id === essay.id ? { ...e, likes: e.likes + 1 } : e);
        setEssays((prev) => prev.map(bump));
        setView((v) => (v.name === 'detail' ? { ...v, essay: bump(v.essay) } : v));
        try {
            const updated = await incrementLike(essay.id);
            setEssays((prev) => prev.map((e) => (e.id === updated.id ? { ...e, likes: updated.likes } : e)));
            setView((v) => (v.name === 'detail' && v.essay.id === updated.id ? { ...v, essay: { ...v.essay, likes: updated.likes } } : v));
        } catch (err: any) {
            const reverted = new Set(next);
            reverted.delete(essay.id);
            setLikedIds(reverted);
            likedStore.set(reverted);
            const unbump = (e: Essay) => (e.id === essay.id ? { ...e, likes: Math.max(0, e.likes - 1) } : e);
            setEssays((prev) => prev.map(unbump));
            setView((v) => (v.name === 'detail' ? { ...v, essay: unbump(v.essay) } : v));
            toast(err?.message || '좋아요를 누르지 못했어요.', 'error');
        }
    };

    const startWriting = () => {
        if (!student) {
            toast('글쓰기는 학생으로 들어와야 할 수 있어요.', 'info');
            return;
        }
        go({ name: 'write' });
    };

    // ---------- 그리기 ----------
    switch (view.name) {
        case 'booting':
            return (
                <div className="flex min-h-dvh items-center justify-center">
                    <Spinner className="size-7" />
                </div>
            );
        case 'landing':
            return <LandingView onStudent={() => go({ name: 'student-entry' })} onTeacher={() => go({ name: 'teacher-login' })} />;
        case 'student-entry':
            return (
                <StudentEntryView
                    onBack={() => go({ name: 'landing' })}
                    onStart={(s) => {
                        setStudent(s);
                        sessionStore.setStudent(s);
                        go({ name: 'gallery' });
                    }}
                />
            );
        case 'teacher-login':
            return (
                <TeacherLoginView
                    onBack={() => go({ name: 'landing' })}
                    onLogin={(token) => {
                        sessionStore.setAdminToken(token);
                        setIsAdmin(true);
                        setStudent(null);
                        go({ name: 'gallery' });
                        toast('선생님으로 로그인했어요.');
                    }}
                />
            );
    }

    let body: React.ReactNode = null;
    switch (view.name) {
        case 'gallery':
            body = (
                <GalleryView
                    essays={essays}
                    loading={loading}
                    error={loadError}
                    onRetry={loadEssays}
                    student={student}
                    isAdmin={isAdmin}
                    likedIds={likedIds}
                    myEssayIds={myEssayIds}
                    onSelect={(essay) => go({ name: 'detail', essay })}
                    onNewEssay={startWriting}
                    onFindByCode={() => go({ name: 'find' })}
                    onDelete={(e) => handleDelete(e)}
                />
            );
            break;
        case 'detail':
            body = (
                <EssayDetailView
                    essay={view.essay}
                    student={student}
                    isAdmin={isAdmin}
                    isLiked={likedIds.has(view.essay.id)}
                    canEdit={!isAdmin && myEssayIds.has(view.essay.id)}
                    onBack={() => window.history.back()}
                    onLike={handleLike}
                    onEdit={() => startEdit(view.essay)}
                    onDelete={(e) => handleDelete(e)}
                />
            );
            break;
        case 'write':
            body = student && <WritingWizard student={student} onExit={() => go({ name: 'gallery' })} onSubmit={handleCreate} />;
            break;
        case 'edit':
            body = (
                <WritingWizard
                    student={view.essay.student}
                    initialData={view.essay}
                    onExit={() => go({ name: 'gallery' })}
                    onSubmit={handleUpdate(view.essay)}
                />
            );
            break;
        case 'success':
            body = (
                <WritingSuccessView
                    essay={view.essay}
                    wasEdit={view.wasEdit}
                    onRead={() => go({ name: 'detail', essay: view.essay })}
                    onFinish={() => go({ name: 'gallery' })}
                />
            );
            break;
        case 'find':
            body = (
                <FindByCodeView
                    onCancel={() => go({ name: 'gallery' })}
                    onRead={(essay) => {
                        rememberMine(essay);
                        go({ name: 'detail', essay });
                    }}
                    onEdit={(essay) => {
                        rememberMine(essay);
                        go({ name: 'edit', essay });
                    }}
                    onDelete={(essay) => handleDelete(essay, { skipConfirm: true })}
                />
            );
            break;
    }

    return (
        <div className="min-h-dvh">
            <AppHeader student={student} isAdmin={isAdmin} onHome={() => go({ name: 'gallery' })} onLogout={logout} />
            <main>{body}</main>
        </div>
    );
};

const App: React.FC = () => (
    <FeedbackProvider>
        <AppInner />
    </FeedbackProvider>
);

export default App;
