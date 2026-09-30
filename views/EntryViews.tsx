import React, { useState } from 'react';
import { ArrowRight, GraduationCap, Lightbulb, MessageCircle, NotebookPen, Sparkles, UserRound } from 'lucide-react';
import type { Student } from '../types';
import { GRADES } from '../constants';
import { Button, Card, Field, Input, Select, useFeedback } from '../components/ui';
import { Logo } from '../components/AppHeader';
import { loginTeacher } from '../services/api';

// ---------- 첫 화면 ----------

export const LandingView: React.FC<{ onStudent: () => void; onTeacher: () => void }> = ({ onStudent, onTeacher }) => (
    <div className="flex min-h-dvh flex-col">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-10 pt-6 sm:px-8">
            <Logo />
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center animate-rise">
                <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-sun-50 px-3 py-1 text-sm font-semibold text-sun-600">
                    <Sparkles className="size-4" /> AI 글쓰기 요정이 함께해요
                </span>
                <h1 className="text-balance text-4xl font-extrabold leading-[1.15] tracking-tight text-ink-900 sm:text-6xl">
                    내 생각을 <span className="text-brand-600">또렷하게</span>,
                    <br />
                    주장하는 글쓰기
                </h1>
                <p className="mt-5 max-w-md text-balance text-base text-ink-500 sm:text-lg">
                    주제 정하기부터 근거 찾기, 글 완성까지.
                    <br className="hidden sm:block" /> 한 단계씩 차근차근 써 보아요.
                </p>

                <div className="mt-10 grid w-full max-w-xl gap-4 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={onStudent}
                        className="group relative overflow-hidden rounded-card bg-brand-600 p-6 text-left text-white shadow-lift transition-transform hover:-translate-y-1"
                    >
                        <UserRound className="mb-8 size-8 opacity-90" />
                        <span className="block text-xl font-bold">학생으로 시작</span>
                        <span className="mt-1 block text-sm text-white/75">글을 쓰고 친구 글을 읽어요</span>
                        <ArrowRight className="absolute bottom-6 right-6 size-5 transition-transform group-hover:translate-x-1" />
                    </button>
                    <button
                        type="button"
                        onClick={onTeacher}
                        className="group relative overflow-hidden rounded-card border border-line bg-white p-6 text-left shadow-card transition-transform hover:-translate-y-1"
                    >
                        <GraduationCap className="mb-8 size-8 text-leaf-500" />
                        <span className="block text-xl font-bold text-ink-900">선생님</span>
                        <span className="mt-1 block text-sm text-ink-500">학생 글을 보고 관리해요</span>
                        <ArrowRight className="absolute bottom-6 right-6 size-5 text-ink-400 transition-transform group-hover:translate-x-1" />
                    </button>
                </div>
            </div>

            <ol className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
                {[
                    { icon: <Lightbulb className="size-5" />, title: '주제 정하기', desc: 'AI가 주장을 또렷하게 다듬어 줘요' },
                    { icon: <NotebookPen className="size-5" />, title: '서론·본론·결론', desc: '근거와 출처를 하나씩 채워요' },
                    { icon: <MessageCircle className="size-5" />, title: '함께 읽기', desc: '좋아요와 댓글로 응원해요' },
                ].map((s, i) => (
                    <li key={s.title} className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 text-left ring-1 ring-line/60">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{s.icon}</span>
                        <span>
                            <span className="block text-sm font-bold text-ink-900">
                                {i + 1}. {s.title}
                            </span>
                            <span className="block text-xs text-ink-500">{s.desc}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    </div>
);

// ---------- 학생 입장 ----------

export const StudentEntryView: React.FC<{ onStart: (s: Student) => void; onBack: () => void }> = ({ onStart, onBack }) => {
    const [info, setInfo] = useState<Student>({ grade: '', classNumber: '', studentId: '', name: '' });
    const { toast } = useFeedback();
    const set = (k: keyof Student) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setInfo({ ...info, [k]: e.target.value });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const name = info.name.trim();
        const cls = Number(info.classNumber);
        const num = Number(info.studentId);
        if (!info.grade || !name || !Number.isInteger(cls) || cls < 1 || cls > 99 || !Number.isInteger(num) || num < 1 || num > 99) {
            toast('학년, 반, 번호, 이름을 모두 알맞게 입력해 주세요.', 'error');
            return;
        }
        if (name.replace(/\s/g, '') === '선생님') {
            toast('이름에는 내 이름을 적어 주세요.', 'error');
            return;
        }
        onStart({ grade: info.grade, classNumber: String(cls), studentId: String(num), name });
    };

    return (
        <CenteredPage onBack={onBack}>
            <Card className="w-full max-w-md animate-rise">
                <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <UserRound className="size-6" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">반가워요! 누구인가요?</h1>
                <p className="mt-1 text-sm text-ink-500">내 학년·반·번호와 이름을 적어 주세요.</p>
                <form onSubmit={submit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="학년" htmlFor="grade">
                            <Select id="grade" value={info.grade} onChange={set('grade')} required>
                                <option value="" disabled>
                                    선택
                                </option>
                                {GRADES.map((g) => (
                                    <option key={g} value={g}>
                                        {g}학년
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="반" htmlFor="classNumber">
                            <Input id="classNumber" type="number" inputMode="numeric" min={1} max={99} placeholder="1" value={info.classNumber} onChange={set('classNumber')} required />
                        </Field>
                        <Field label="번호" htmlFor="studentId">
                            <Input id="studentId" type="number" inputMode="numeric" min={1} max={99} placeholder="12" value={info.studentId} onChange={set('studentId')} required />
                        </Field>
                    </div>
                    <Field label="이름" htmlFor="name">
                        <Input id="name" maxLength={30} autoComplete="off" placeholder="홍길동" value={info.name} onChange={set('name')} required />
                    </Field>
                    <Button type="submit" size="lg" block className="mt-2" icon={<ArrowRight className="size-5" />}>
                        글쓰기 교실 들어가기
                    </Button>
                </form>
            </Card>
        </CenteredPage>
    );
};

// ---------- 선생님 로그인 ----------

export const TeacherLoginView: React.FC<{ onLogin: (token: string) => void; onBack: () => void }> = ({ onLogin, onBack }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const token = await loginTeacher(username.trim(), password);
            if (token) onLogin(token);
            else setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        } catch (err: any) {
            setError(err?.message || '로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <CenteredPage onBack={onBack}>
            <Card className="w-full max-w-sm animate-rise">
                <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
                    <GraduationCap className="size-6" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">선생님 로그인</h1>
                <p className="mt-1 text-sm text-ink-500">학생 글 관리, 댓글 관리, 내려받기를 할 수 있어요.</p>
                <form onSubmit={submit} className="mt-6 space-y-4">
                    <Field label="아이디" htmlFor="username">
                        <Input
                            id="username"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setError('');
                            }}
                            required
                        />
                    </Field>
                    <Field label="비밀번호" htmlFor="password">
                        <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            required
                        />
                    </Field>
                    {error && (
                        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                            {error}
                        </p>
                    )}
                    <Button type="submit" variant="success" size="lg" block loading={loading} className="mt-2">
                        로그인
                    </Button>
                </form>
            </Card>
        </CenteredPage>
    );
};

export const CenteredPage: React.FC<{ onBack?: () => void; children: React.ReactNode }> = ({ onBack, children }) => (
    <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
            <Logo onClick={onBack} />
            {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack}>
                    처음으로
                </Button>
            )}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
    </div>
);
