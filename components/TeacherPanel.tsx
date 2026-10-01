import React, { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, RefreshCw, Sparkles, Ticket } from 'lucide-react';
import { Badge, Button, Field, Input, Modal, useFeedback } from './ui';
import { connectAiKey, disconnectAiKey, getInviteCode, saveInviteCode, type TeacherInfo } from '../services/api';
import { aiKeyStore } from '../storage';

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        window.prompt('아래 내용을 복사하세요', text);
        return false;
    }
}

/** 선생님 화면 위쪽: 우리 반 학급 코드 · AI 키 연결 · (관리자) 가입 초대 코드 */
export const TeacherPanel: React.FC<{ teacher: TeacherInfo; onChange: (t: TeacherInfo) => void }> = ({ teacher, onChange }) => {
    const { toast } = useFeedback();
    const [aiOpen, setAiOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const studentLink = `${origin}/?class=${teacher.classCode}`;

    const copy = async (what: string, text: string) => {
        await copyText(text);
        setCopied(what);
        setTimeout(() => setCopied(null), 1500);
    };

    const aiState = teacher.aiConnected ? 'on' : teacher.sharedAi ? 'shared' : 'off';

    return (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
            <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
                {/* 학급 코드 */}
                <div className="rounded-card border border-line bg-white p-4 shadow-card">
                    <p className="text-xs font-semibold text-ink-500">{teacher.name} · 우리 반 학급 코드</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="font-mono text-3xl font-extrabold tracking-[0.25em] text-brand-600">{teacher.classCode}</span>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" icon={copied === 'code' ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => copy('code', teacher.classCode)}>
                                {copied === 'code' ? '복사됨' : '코드 복사'}
                            </Button>
                            <Button size="sm" variant="secondary" icon={copied === 'link' ? <Check className="size-4" /> : <Link2 className="size-4" />} onClick={() => copy('link', studentLink)}>
                                {copied === 'link' ? '복사됨' : '학생 입장 링크'}
                            </Button>
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-500">학생은 첫 화면 → 학생으로 시작 → 이 코드를 넣고 들어와요. 링크로 들어오면 코드가 자동으로 채워져요.</p>
                </div>

                {/* AI 키 */}
                <div className="rounded-card border border-line bg-white p-4 shadow-card">
                    <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                            <Sparkles className="size-3.5" /> AI 글쓰기 요정
                        </p>
                        {aiState === 'on' ? (
                            <Badge tone="leaf">내 키 연결됨</Badge>
                        ) : aiState === 'shared' ? (
                            <Badge tone="brand">서버 키 사용 중</Badge>
                        ) : (
                            <Badge tone="sun">키 연결 필요</Badge>
                        )}
                    </div>
                    <p className="mt-2 text-sm text-ink-700">
                        {aiState === 'off'
                            ? '내 Gemini API 키를 연결해야 우리 반 학생들이 AI 요정을 쓸 수 있어요.'
                            : aiState === 'shared'
                            ? '관리자 반은 서버에 넣어 둔 키를 써요. 내 키를 연결하면 내 키로 바뀌어요.'
                            : '우리 반 학생들이 내 키로 AI 요정을 쓰고 있어요.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant={aiState === 'off' ? 'primary' : 'secondary'} icon={<KeyRound className="size-4" />} onClick={() => setAiOpen(true)}>
                            AI 키 설정
                        </Button>
                        {teacher.isAdmin && (
                            <Button size="sm" variant="secondary" icon={<Ticket className="size-4" />} onClick={() => setInviteOpen(true)}>
                                선생님 초대 코드
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <AiKeyModal open={aiOpen} onClose={() => setAiOpen(false)} teacher={teacher} onChange={onChange} toast={toast} />
            {teacher.isAdmin && <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} toast={toast} />}
        </div>
    );
};

const AiKeyModal: React.FC<{
    open: boolean;
    onClose: () => void;
    teacher: TeacherInfo;
    onChange: (t: TeacherInfo) => void;
    toast: (msg: string, tone?: any) => void;
}> = ({ open, onClose, teacher, onChange, toast }) => {
    const [key, setKey] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const saved = aiKeyStore.get();

    useEffect(() => {
        if (open) {
            setKey('');
            setShow(false);
        }
    }, [open]);

    const save = async () => {
        const k = key.trim();
        if (!k) return;
        setSaving(true);
        try {
            const r = await connectAiKey(k, true);
            aiKeyStore.set(k);
            onChange({ ...teacher, aiConnected: r.aiConnected });
            toast('AI 키를 연결했어요. 이제 우리 반 학생들이 AI 요정을 쓸 수 있어요.');
            onClose();
        } catch (err: any) {
            toast(err?.message || 'AI 키를 연결하지 못했어요.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setSaving(true);
        try {
            aiKeyStore.set(null);
            const r = await disconnectAiKey();
            onChange({ ...teacher, aiConnected: r.aiConnected });
            toast('이 브라우저와 서버에서 AI 키를 지웠어요.');
            onClose();
        } catch (err: any) {
            toast(err?.message || '지우지 못했어요.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const masked = saved ? `${saved.slice(0, 6)}…${saved.slice(-4)}` : null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="AI 키 설정 (Gemini)"
            size="md"
            footer={
                <>
                    {saved && (
                        <Button variant="ghost" onClick={remove} disabled={saving} className="mr-auto text-rose-600">
                            키 지우기
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onClose}>
                        취소
                    </Button>
                    <Button variant="success" onClick={save} loading={saving} disabled={!key.trim()} icon={<Check className="size-4" />}>
                        저장하고 연결
                    </Button>
                </>
            }
        >
            <div className="space-y-4 text-sm text-ink-700">
                {masked && (
                    <p className="rounded-xl bg-leaf-50 px-3 py-2 text-leaf-700">
                        이 브라우저에 저장된 키: <span className="font-mono">{masked}</span>
                    </p>
                )}
                <Field label={masked ? '새 키로 바꾸기' : 'Gemini API 키'} htmlFor="ai-key">
                    <div className="relative">
                        <Input
                            id="ai-key"
                            type={show ? 'text' : 'password'}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="AIza..."
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            className="pr-11 font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setShow((v) => !v)}
                            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-900/5 hover:text-ink-900"
                            aria-label={show ? '키 숨기기' : '키 보기'}
                        >
                            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                </Field>
                <ul className="list-disc space-y-1 pl-5 text-xs text-ink-500">
                    <li>
                        키는 <b>이 브라우저에만 저장</b>돼요. 서버에는 저장하지 않고, 수업 동안 메모리에만 잠시 올려 둬요.
                    </li>
                    <li>서버가 다시 시작되면 연결이 풀려요. 이 화면(선생님 화면)을 한 번 열면 자동으로 다시 연결돼요.</li>
                    <li>다른 컴퓨터에서 로그인하면 그 브라우저에도 키를 한 번 넣어 주세요.</li>
                    <li>
                        무료 키는{' '}
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">
                            Google AI Studio
                        </a>
                        에서 받을 수 있어요.
                    </li>
                </ul>
            </div>
        </Modal>
    );
};

const InviteModal: React.FC<{ open: boolean; onClose: () => void; toast: (msg: string, tone?: any) => void }> = ({ open, onClose, toast }) => {
    const [code, setCode] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    useEffect(() => {
        if (!open) return;
        setCode(null);
        getInviteCode()
            .then((r) => setCode(r.inviteCode))
            .catch((err) => toast(err?.message || '초대 코드를 불러오지 못했어요.', 'error'));
    }, [open, toast]);

    const regenerate = async () => {
        setSaving(true);
        try {
            const r = await saveInviteCode('');
            setCode(r.inviteCode);
            toast('새 초대 코드를 만들었어요. 예전 코드로는 이제 가입할 수 없어요.');
        } catch (err: any) {
            toast(err?.message || '바꾸지 못했어요.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="선생님 초대 코드" size="sm" footer={<Button onClick={onClose}>닫기</Button>}>
            <div className="space-y-4 text-sm text-ink-700">
                <p>다른 선생님이 가입할 때 이 코드가 필요해요. 코드를 아는 선생님만 가입할 수 있어요.</p>
                <div className="rounded-2xl bg-paper p-4 text-center">
                    <span className="font-mono text-2xl font-extrabold tracking-[0.2em] text-leaf-600">{code ?? '...'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={<Copy className="size-4" />} disabled={!code} onClick={() => code && copyText(code).then(() => toast('초대 코드를 복사했어요.'))}>
                        코드 복사
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={<Link2 className="size-4" />}
                        disabled={!code}
                        onClick={() => code && copyText(`${origin}/?invite=${code}`).then(() => toast('가입 링크를 복사했어요.'))}
                    >
                        가입 링크 복사
                    </Button>
                    <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} loading={saving} onClick={regenerate} className="ml-auto">
                        새 코드 만들기
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
