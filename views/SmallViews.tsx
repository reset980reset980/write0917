import React, { useState } from 'react';
import { ArrowRight, Check, Copy, KeyRound, Pencil, PartyPopper, Search, Trash2, Eye } from 'lucide-react';
import type { Essay } from '../types';
import { Button, Card, Field, Input, useFeedback } from '../components/ui';
import { findEssayByEditCode } from '../services/api';
import { studentLabel } from '../utils';

// ---------- 글 올리기 성공 ----------

export const WritingSuccessView: React.FC<{ essay: Essay; wasEdit: boolean; onRead: () => void; onFinish: () => void }> = ({
    essay,
    wasEdit,
    onRead,
    onFinish,
}) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(essay.editCode || '');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* 복사가 막힌 환경 */
        }
    };

    return (
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg items-center px-4 py-10">
            <Card className="w-full text-center animate-rise">
                <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-leaf-50 text-leaf-500">
                    <PartyPopper className="size-8" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">{wasEdit ? '글을 고쳤어요!' : '글을 올렸어요!'}</h1>
                <p className="mt-2 text-ink-500">
                    <span className="font-semibold text-ink-700">“{essay.topic}”</span>
                    <br />
                    {wasEdit ? '고친 내용이 바로 반영됐어요.' : '이제 친구들이 읽고 응원할 수 있어요.'}
                </p>

                {!wasEdit && essay.editCode && (
                    <div className="mt-7 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-5">
                        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-700">
                            <KeyRound className="size-4" /> 나의 수정 코드
                        </p>
                        <p className="mt-2 font-mono text-3xl font-extrabold tracking-[0.3em] text-brand-700">{essay.editCode}</p>
                        <Button variant="secondary" size="sm" onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} className="mt-3">
                            {copied ? '복사했어요' : '코드 복사'}
                        </Button>
                        <p className="mt-3 text-xs leading-relaxed text-ink-500">
                            이 기기에서는 코드 없이도 <b>내 글</b>에서 고칠 수 있어요.
                            <br />
                            다른 컴퓨터에서 고치려면 이 코드를 꼭 적어 두세요.
                        </p>
                    </div>
                )}

                <div className="mt-7 grid gap-2 sm:grid-cols-2">
                    <Button variant="secondary" size="lg" icon={<Eye className="size-4" />} onClick={onRead}>
                        내 글 보기
                    </Button>
                    <Button size="lg" onClick={onFinish}>
                        친구 글 보러 가기 <ArrowRight className="size-4" />
                    </Button>
                </div>
            </Card>
        </div>
    );
};

// ---------- 수정 코드로 글 찾기 ----------

export const FindByCodeView: React.FC<{
    onCancel: () => void;
    onEdit: (essay: Essay) => void;
    onRead: (essay: Essay) => void;
    onDelete: (essay: Essay) => Promise<boolean>;
}> = ({ onCancel, onEdit, onRead, onDelete }) => {
    const [code, setCode] = useState('');
    const [found, setFound] = useState<Essay | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { confirm } = useFeedback();

    const find = async (e: React.FormEvent) => {
        e.preventDefault();
        const c = code.trim();
        if (!c) return;
        setLoading(true);
        setError('');
        setFound(null);
        try {
            const essay = await findEssayByEditCode(c);
            if (essay) setFound(essay);
            else setError('이 코드와 맞는 글이 없어요. 글자를 다시 확인해 주세요.');
        } catch (err: any) {
            setError(err?.message || '글을 찾는 중 문제가 생겼어요.');
        } finally {
            setLoading(false);
        }
    };

    const remove = async () => {
        if (!found) return;
        const ok = await confirm({
            title: '글을 지울까요?',
            message: (
                <>
                    <b>“{found.topic}”</b> 글과 달린 댓글이 모두 사라지고, 되돌릴 수 없어요.
                </>
            ),
            confirmText: '지우기',
            tone: 'danger',
        });
        if (ok && (await onDelete(found))) onCancel();
    };

    return (
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center px-4 py-10">
            <Card className="w-full animate-rise">
                <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <KeyRound className="size-6" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">수정 코드로 내 글 찾기</h1>
                <p className="mt-1 text-sm text-ink-500">글을 올릴 때 받은 6자리 코드를 적어 주세요.</p>

                <form onSubmit={find} className="mt-6 flex gap-2">
                    <Field label="수정 코드" htmlFor="editCode" srOnlyLabel className="flex-1">
                        <Input
                            id="editCode"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value);
                                setError('');
                            }}
                            autoCapitalize="none"
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={20}
                            placeholder="예: a1b2c3"
                            className="font-mono text-lg tracking-widest"
                            autoFocus
                        />
                    </Field>
                    <Button type="submit" loading={loading} icon={<Search className="size-4" />}>
                        찾기
                    </Button>
                </form>
                {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

                {found && (
                    <div className="mt-6 animate-rise rounded-2xl bg-paper p-4 ring-1 ring-line/60">
                        <p className="font-bold text-ink-900">{found.topic}</p>
                        <p className="mt-1 text-xs text-ink-500">{studentLabel(found.student)}</p>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <Button variant="secondary" size="sm" icon={<Eye className="size-4" />} onClick={() => onRead(found)}>
                                읽기
                            </Button>
                            <Button size="sm" icon={<Pencil className="size-4" />} onClick={() => onEdit(found)}>
                                고치기
                            </Button>
                            <Button variant="secondary" size="sm" icon={<Trash2 className="size-4" />} onClick={remove} className="hover:text-rose-600">
                                지우기
                            </Button>
                        </div>
                    </div>
                )}

                <Button variant="ghost" block onClick={onCancel} className="mt-4">
                    목록으로 돌아가기
                </Button>
            </Card>
        </div>
    );
};
