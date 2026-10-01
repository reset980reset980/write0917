import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, GraduationCap, KeyRound, Lightbulb, MessageCircle, NotebookPen, Sparkles, UserPlus, UserRound } from 'lucide-react';
import type { Student } from '../types';
import { GRADES } from '../constants';
import { Button, Card, Field, Input, Select, useFeedback } from '../components/ui';
import { Logo } from '../components/AppHeader';
import { loginTeacher, lookupClass, registerTeacher, type TeacherInfo } from '../services/api';
import { classCodeStore } from '../storage';

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
    // 학급 코드: 주소(?class=코드) > 지난번에 쓴 코드 순서로 미리 채움
    const [code, setCode] = useState(() => {
        try {
            const fromUrl = new URLSearchParams(window.location.search).get('class');
            if (fromUrl) return fromUrl.trim().toUpperCase();
        } catch {
            /* 무시 */
        }
        return classCodeStore.getLast() || '';
    });
    const [checking, setChecking] = useState(false);
    const [codeError, setCodeError] = useState('');
    const { toast } = useFeedback();
    const set = (k: keyof Student) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setInfo({ ...info, [k]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const classCode = code.trim().toUpperCase().replace(/[\s-]/g, '');
        if (!classCode) {
            setCodeError('선생님께 받은 학급 코드를 적어 주세요.');
            return;
        }
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
        setChecking(true);
        try {
            const found = await lookupClass(classCode);
            if (!found) {
                setCodeError('학급 코드를 찾을 수 없어요. 선생님께 받은 코드를 다시 확인해 주세요.');
                return;
            }
            classCodeStore.setLast(found.classCode);
            toast(`${found.teacherName} 반에 들어왔어요!`);
            onStart({ grade: info.grade, classNumber: String(cls), studentId: String(num), name, classCode: found.classCode });
        } catch (err: any) {
            toast(err?.message || '학급 코드를 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.', 'error');
        } finally {
            setChecking(false);
        }
    };

    return (
        <CenteredPage onBack={onBack}>
            <Card className="w-full max-w-md animate-rise">
                <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <UserRound className="size-6" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">반가워요! 누구인가요?</h1>
                <p className="mt-1 text-sm text-ink-500">학급 코드와 내 학년·반·번호, 이름을 적어 주세요.</p>
                <form onSubmit={submit} className="mt-6 space-y-4">
                    <Field
                        label="학급 코드"
                        htmlFor="classCode"
                        hint={codeError ? <span className="font-semibold text-rose-600">{codeError}</span> : '선생님이 알려 준 6자리 코드예요.'}
                    >
                        <Input
                            id="classCode"
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            maxLength={12}
                            placeholder="예: AB12CD"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value.toUpperCase());
                                setCodeError('');
                            }}
                            className="text-center font-mono text-lg font-bold tracking-[0.3em]"
                            required
                        />
                    </Field>
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
                    <Button type="submit" size="lg" block className="mt-2" loading={checking} icon={<ArrowRight className="size-5" />}>
                        글쓰기 교실 들어가기
                    </Button>
                </form>
            </Card>
        </CenteredPage>
    );
};

// ---------- 비밀번호 입력 (보기 버튼 + Caps Lock 안내) ----------

const PasswordInput: React.FC<{
    id: string;
    value: string;
    onChange: (v: string) => void;
    autoComplete: string;
    show: boolean;
    onToggle: () => void;
    onCapsLock?: (on: boolean) => void;
    invalid?: boolean;
}> = ({ id, value, onChange, autoComplete, show, onToggle, onCapsLock, invalid }) => (
    <div className="relative">
        <Input
            id={id}
            type={show ? 'text' : 'password'}
            autoComplete={autoComplete}
            autoCapitalize="none"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyUp={(e) => onCapsLock?.(e.getModifierState('CapsLock'))}
            required
            className={`pr-11 ${invalid ? 'ring-2 ring-rose-300' : ''}`}
        />
        <button
            type="button"
            onClick={onToggle}
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-900"
            aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={show}
            title={show ? '비밀번호 숨기기' : '비밀번호 보기'}
        >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
    </div>
);

const RememberCheck: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-1 py-1 text-sm text-ink-700 select-none">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-leaf-500"
        />
        <span>
            <span className="font-semibold">로그인 상태 유지</span>
            <span className="block text-xs text-ink-500">30일 동안 다시 로그인하지 않아도 돼요. 학생과 같이 쓰는 컴퓨터에서는 켜지 마세요.</span>
        </span>
    </label>
);

type TeacherAuthDone = (token: string, remember: boolean, teacher: TeacherInfo) => void;

// ---------- 선생님 로그인 ----------

export const TeacherLoginView: React.FC<{ onLogin: TeacherAuthDone; onBack: () => void; onRegister: () => void }> = ({ onLogin, onBack, onRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const result = await loginTeacher(username.trim(), password, remember);
            if (result) onLogin(result.token, remember, result.teacher);
            else setError('이메일(아이디) 또는 비밀번호가 올바르지 않습니다.');
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
                <p className="mt-1 text-sm text-ink-500">우리 반 학생 글 관리, 댓글, 내려받기를 할 수 있어요.</p>
                <form onSubmit={submit} className="mt-6 space-y-4">
                    <Field label="이메일" htmlFor="username" hint="관리자는 아이디(admin)를 적어요.">
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
                    <Field label="비밀번호" htmlFor="password" hint={capsLock ? <span className="font-semibold text-sun-600">Caps Lock이 켜져 있어요</span> : undefined}>
                        <PasswordInput
                            id="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(v) => {
                                setPassword(v);
                                setError('');
                            }}
                            show={showPassword}
                            onToggle={() => setShowPassword((v) => !v)}
                            onCapsLock={setCapsLock}
                        />
                    </Field>
                    <RememberCheck checked={remember} onChange={setRemember} />
                    {error && (
                        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                            {error}
                        </p>
                    )}
                    <Button type="submit" variant="success" size="lg" block loading={loading} className="mt-2">
                        로그인
                    </Button>
                </form>
                <div className="mt-5 border-t border-line/70 pt-4 text-center text-sm text-ink-500">
                    처음 오셨나요?{' '}
                    <button type="button" onClick={onRegister} className="font-semibold text-leaf-600 underline-offset-2 hover:underline">
                        선생님 가입하기
                    </button>
                </div>
            </Card>
        </CenteredPage>
    );
};

// ---------- 선생님 가입 ----------

export const TeacherRegisterView: React.FC<{ onRegistered: TeacherAuthDone; onBack: () => void; onLogin: () => void }> = ({
    onRegistered,
    onBack,
    onLogin,
}) => {
    const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '', inviteCode: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [remember, setRemember] = useState(true);
    const [capsLock, setCapsLock] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const set = (k: keyof typeof form) => (v: string) => {
        setForm((f) => ({ ...f, [k]: v }));
        setError('');
    };

    // 주소에 ?invite=코드 가 있으면 미리 채움
    useEffect(() => {
        try {
            const inv = new URLSearchParams(window.location.search).get('invite');
            if (inv) setForm((f) => ({ ...f, inviteCode: inv.toUpperCase() }));
        } catch {
            /* 무시 */
        }
    }, []);

    const lengthOk = form.password.length >= 8;
    const matchOk = form.passwordConfirm.length > 0 && form.password === form.passwordConfirm;
    const mismatch = form.passwordConfirm.length > 0 && form.password !== form.passwordConfirm;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lengthOk) return setError('비밀번호는 8자 이상으로 해 주세요.');
        if (!matchOk) return setError('비밀번호 확인이 일치하지 않아요.');
        setLoading(true);
        setError('');
        try {
            const r = await registerTeacher({
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
                passwordConfirm: form.passwordConfirm,
                inviteCode: form.inviteCode.trim(),
                remember,
            });
            onRegistered(r.token, remember, r.teacher);
        } catch (err: any) {
            setError(err?.message || '가입하지 못했어요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <CenteredPage onBack={onBack}>
            <Card className="w-full max-w-md animate-rise">
                <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600">
                    <UserPlus className="size-6" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">선생님 가입</h1>
                <p className="mt-1 text-sm text-ink-500">가입하면 우리 반 학급 코드가 생겨요. 학생들은 그 코드로 들어와요.</p>
                <form onSubmit={submit} className="mt-6 space-y-4">
                    <Field label="이름" htmlFor="reg-name">
                        <Input id="reg-name" maxLength={30} autoComplete="name" placeholder="예: 김민지 선생님" value={form.name} onChange={(e) => set('name')(e.target.value)} required />
                    </Field>
                    <Field label="이메일 (로그인 아이디)" htmlFor="reg-email">
                        <Input
                            id="reg-email"
                            type="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={form.email}
                            onChange={(e) => set('email')(e.target.value)}
                            required
                        />
                    </Field>
                    <Field
                        label="비밀번호"
                        htmlFor="reg-password"
                        hint={
                            capsLock ? (
                                <span className="font-semibold text-sun-600">Caps Lock이 켜져 있어요</span>
                            ) : (
                                <span className={lengthOk ? 'font-semibold text-leaf-600' : undefined}>
                                    {lengthOk && <Check className="mr-0.5 inline size-3.5" />}8자 이상
                                </span>
                            )
                        }
                    >
                        <PasswordInput
                            id="reg-password"
                            autoComplete="new-password"
                            value={form.password}
                            onChange={set('password')}
                            show={showPassword}
                            onToggle={() => setShowPassword((v) => !v)}
                            onCapsLock={setCapsLock}
                        />
                    </Field>
                    <Field
                        label="비밀번호 확인"
                        htmlFor="reg-password2"
                        hint={
                            mismatch ? (
                                <span className="font-semibold text-rose-600">비밀번호가 서로 달라요</span>
                            ) : matchOk ? (
                                <span className="font-semibold text-leaf-600">
                                    <Check className="mr-0.5 inline size-3.5" />
                                    일치해요
                                </span>
                            ) : (
                                '한 번 더 입력해 주세요'
                            )
                        }
                    >
                        <PasswordInput
                            id="reg-password2"
                            autoComplete="new-password"
                            value={form.passwordConfirm}
                            onChange={set('passwordConfirm')}
                            show={showConfirm}
                            onToggle={() => setShowConfirm((v) => !v)}
                            onCapsLock={setCapsLock}
                            invalid={mismatch}
                        />
                    </Field>
                    <Field label="초대 코드" htmlFor="reg-invite" hint="관리자 선생님께 받은 코드예요.">
                        <div className="relative">
                            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                            <Input
                                id="reg-invite"
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                value={form.inviteCode}
                                onChange={(e) => set('inviteCode')(e.target.value.toUpperCase())}
                                className="pl-10 font-mono tracking-widest"
                                required
                            />
                        </div>
                    </Field>
                    <RememberCheck checked={remember} onChange={setRemember} />
                    {error && (
                        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                            {error}
                        </p>
                    )}
                    <Button type="submit" variant="success" size="lg" block loading={loading} disabled={!lengthOk || !matchOk} className="mt-2">
                        가입하고 시작하기
                    </Button>
                </form>
                <div className="mt-5 border-t border-line/70 pt-4 text-center text-sm text-ink-500">
                    이미 가입했나요?{' '}
                    <button type="button" onClick={onLogin} className="font-semibold text-leaf-600 underline-offset-2 hover:underline">
                        로그인
                    </button>
                </div>
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
