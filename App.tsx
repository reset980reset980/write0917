import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_WRITING_SETTINGS, type Essay, type EssayData, type Student, type WritingSettings } from './types';
import { FeedbackProvider, Spinner, useFeedback } from './components/ui';
import { AppHeader } from './components/AppHeader';
import { LandingView, StudentEntryView, TeacherLoginView, TeacherRegisterView } from './views/EntryViews';
import { TeacherPanel } from './components/TeacherPanel';
import { GalleryView } from './views/GalleryView';
import { EssayDetailView } from './views/EssayDetailView';
import { WritingWizard } from './views/WritingWizard';
import { FindByCodeView, WritingSuccessView } from './views/SmallViews';
import {
    addEssay,
    connectAiKey,
    deleteEssay,
    getAllEssays,
    getWritingSettings,
    incrementLike,
    setAdminToken,
    setClassCode,
    updateEssay,
    verifyAdminToken,
    type TeacherInfo,
} from './services/api';
import { aiKeyStore, likedStore, myEssaysStore, sessionStore } from './storage';

type View =
    | { name: 'booting' }
    | { name: 'landing' }
    | { name: 'student-entry' }
    | { name: 'teacher-login' }
    | { name: 'teacher-register' }
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
    // 로그인한 선생님 (isAdmin = 선생님 화면인지)
    const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
    const isAdmin = Boolean(teacher);

    const [essays, setEssays] = useState<Essay[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [likedIds, setLikedIds] = useState<Set<string>>(() => likedStore.get());
    const [writingSettings, setWritingSettings] = useState<WritingSettings>(DEFAULT_WRITING_SETTINGS);
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
            else if (current === 'student-entry' || current === 'teacher-login' || current === 'teacher-register') setView({ name: 'landing' });
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

    // 글쓰기 화면을 열 때마다 선생님이 정한 최신 설정을 받아 옴
    useEffect(() => {
        if (view.name === 'write' || view.name === 'edit') getWritingSettings().then(setWritingSettings);
    }, [view.name]);

    // ---------- 새로고침해도 로그인 유지 ----------
    // 브라우저에 저장된 AI 키를 서버에 다시 연결 (서버가 재시작돼도 선생님 화면을 열면 자동 복구)
    const syncAiKey = useCallback(async (t: TeacherInfo) => {
        const key = aiKeyStore.get();
        if (!key) return t;
        try {
            const r = await connectAiKey(key, false);
            const next = { ...t, aiConnected: r.aiConnected };
            setTeacher(next);
            return next;
        } catch {
            return t;
        }
    }, []);

    const startTeacher = useCallback(
        (t: TeacherInfo) => {
            setTeacher(t);
            setStudent(null);
            setClassCode(null);
            syncAiKey(t);
        },
        [syncAiKey],
    );

    useEffect(() => {
        (async () => {
            const token = sessionStore.getAdminToken();
            if (token) {
                setAdminToken(token);
                const t = await verifyAdminToken();
                if (t) {
                    startTeacher(t);
                    setView({ name: 'gallery' });
                    return;
                }
                setAdminToken(null);
                sessionStore.setAdminToken(null);
            }
            const params = new URLSearchParams(window.location.search);
            const s = sessionStore.getStudent();
            if (s?.classCode && (!params.get('class') || params.get('class')!.toUpperCase() === s.classCode)) {
                setStudent(s);
                setClassCode(s.classCode);
                setView({ name: 'gallery' });
                return;
            }
            if (s) sessionStore.setStudent(null); // 학급 코드 없이 들어왔던 예전 기록은 다시 입장
            // 링크로 들어온 경우 바로 해당 화면으로
            if (params.get('class')) setView({ name: 'student-entry' });
            else if (params.get('invite')) setView({ name: 'teacher-register' });
            else setView({ name: 'landing' });
        })();
    }, [startTeacher]);

    // 선생님 화면이 열려 있는 동안 10분마다 AI 키 연결 확인 (서버 재시작 대비)
    useEffect(() => {
        if (!teacher) return;
        const id = setInterval(() => {
            if (aiKeyStore.get()) connectAiKey(aiKeyStore.get()!, false).catch(() => {});
        }, 10 * 60 * 1000);
        return () => clearInterval(id);
    }, [teacher?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const logout = async () => {
        if (view.name === 'write' || view.name === 'edit') {
            const ok = await confirm({ title: '나갈까요?', message: '쓰던 글은 이 기기에 임시저장돼 있어요.', confirmText: '나가기' });
            if (!ok) return;
        }
        setStudent(null);
        setTeacher(null);
        setAdminToken(null);
        setClassCode(null);
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
                        setClassCode(s.classCode || null);
                        sessionStore.setStudent(s);
                        go({ name: 'gallery' });
                    }}
                />
            );
        case 'teacher-login':
            return (
                <TeacherLoginView
                    onBack={() => go({ name: 'landing' })}
                    onRegister={() => go({ name: 'teacher-register' })}
                    onLogin={(token, remember, t) => {
                        sessionStore.setAdminToken(token, remember);
                        startTeacher(t);
                        go({ name: 'gallery' });
                        toast(`${t.name}, 반가워요!`);
                    }}
                />
            );
        case 'teacher-register':
            return (
                <TeacherRegisterView
                    onBack={() => go({ name: 'landing' })}
                    onLogin={() => go({ name: 'teacher-login' })}
                    onRegistered={(token, remember, t) => {
                        sessionStore.setAdminToken(token, remember);
                        startTeacher(t);
                        go({ name: 'gallery' });
                        toast(`가입을 환영해요! 우리 반 학급 코드는 ${t.classCode} 예요.`);
                    }}
                />
            );
    }

    let body: React.ReactNode = null;
    switch (view.name) {
        case 'gallery':
            body = (
                <>
                {teacher && <TeacherPanel teacher={teacher} onChange={setTeacher} />}
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
                </>
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
            body = student && <WritingWizard student={student} settings={writingSettings} onExit={() => go({ name: 'gallery' })} onSubmit={handleCreate} />;
            break;
        case 'edit':
            body = (
                <WritingWizard
                    student={view.essay.student}
                    initialData={view.essay}
                    settings={writingSettings}
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
            <AppHeader student={student} isAdmin={isAdmin} teacherName={teacher?.name} onHome={() => go({ name: 'gallery' })} onLogout={logout} />
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
