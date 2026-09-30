import React, { useEffect, useState } from 'react';
import { ArrowLeft, Heart, Link2, MessageCircle, Pencil, Printer, Send, Trash2, GraduationCap } from 'lucide-react';
import type { Comment, Essay, Student } from '../types';
import { GRADES } from '../constants';
import { Badge, Button, Card, IconButton, Input, Linkify, Select, Spinner, Textarea, cx, useFeedback } from '../components/ui';
import { addComment, deleteComment, getComments } from '../services/api';
import { countChars, fullDate, relativeTime, studentLabel } from '../utils';

export const EssayDetailView: React.FC<{
    essay: Essay;
    student: Student | null;
    isAdmin: boolean;
    isLiked: boolean;
    canEdit: boolean;
    onBack: () => void;
    onLike: (essay: Essay) => void;
    onEdit: () => void;
    onDelete: (essay: Essay) => void;
}> = ({ essay, student, isAdmin, isLiked, canEdit, onBack, onLike, onEdit, onDelete }) => {
    const [comments, setComments] = useState<Comment[] | null>(null);
    const [commentsError, setCommentsError] = useState('');
    const { toast, confirm } = useFeedback();

    useEffect(() => {
        let alive = true;
        setComments(null);
        setCommentsError('');
        getComments(essay.id)
            .then((list) => alive && setComments(list))
            .catch((err) => alive && setCommentsError(err?.message || '댓글을 불러오지 못했어요.'));
        return () => {
            alive = false;
        };
    }, [essay.id]);

    const sources = essay.body.filter((p) => p.source.trim());
    const paragraphs = essay.fullText.split(/\n{2,}/).filter((p) => p.trim());

    const removeComment = async (c: Comment) => {
        const ok = await confirm({ title: '댓글을 지울까요?', message: `"${c.content.slice(0, 60)}"`, confirmText: '지우기', tone: 'danger' });
        if (!ok) return;
        try {
            await deleteComment(c.id);
            setComments((prev) => prev?.filter((x) => x.id !== c.id) || null);
            toast('댓글을 지웠어요.');
        } catch (err: any) {
            toast(err?.message || '댓글을 지우지 못했어요.', 'error');
        }
    };

    return (
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
            <div className="no-print mb-4 flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={onBack} className="-ml-2">
                    목록으로
                </Button>
                <div className="flex items-center gap-1">
                    {canEdit && (
                        <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={onEdit}>
                            내 글 고치기
                        </Button>
                    )}
                    <IconButton label="인쇄하기" onClick={() => window.print()}>
                        <Printer className="size-5" />
                    </IconButton>
                    {isAdmin && (
                        <IconButton label="글 삭제" tone="danger" onClick={() => onDelete(essay)}>
                            <Trash2 className="size-5" />
                        </IconButton>
                    )}
                </div>
            </div>

            <Card className="print-plain animate-rise" padded={false}>
                <header className="border-b border-line/70 px-6 pb-6 pt-8 sm:px-10 sm:pt-10">
                    <Badge tone="brand" className="no-print">
                        주장하는 글
                    </Badge>
                    <h1 className="mt-3 text-balance text-2xl font-extrabold leading-snug tracking-tight text-ink-900 sm:text-3xl">{essay.topic}</h1>
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
                        <span className="font-semibold text-ink-700">{studentLabel(essay.student)}</span>
                        <span aria-hidden>·</span>
                        <time dateTime={essay.createdAt} title={fullDate(essay.createdAt)}>
                            {relativeTime(essay.createdAt)}
                        </time>
                        <span aria-hidden>·</span>
                        <span>{countChars(essay.fullText)}자</span>
                    </div>
                </header>

                <div className="px-6 py-8 sm:px-10">
                    <div className="notebook space-y-[2.1rem] text-[17px] text-ink-900">
                        {paragraphs.map((p, i) => (
                            <p key={i} className="whitespace-pre-wrap indent-[1em]">
                                {p}
                            </p>
                        ))}
                    </div>

                    {sources.length > 0 && (
                        <section className="mt-10 rounded-2xl bg-paper px-5 py-4">
                            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-700">
                                <Link2 className="size-4" /> 출처
                            </h2>
                            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-700">
                                {sources.map((part, i) => (
                                    <li key={i}>
                                        <Linkify text={part.source} />
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </div>

                <footer className="no-print flex items-center justify-center border-t border-line/70 px-6 py-5">
                    <button
                        type="button"
                        onClick={() => onLike(essay)}
                        disabled={isLiked}
                        className={cx(
                            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-bold transition-all',
                            isLiked ? 'bg-rose-50 text-rose-500' : 'bg-white text-ink-700 ring-1 ring-line hover:bg-rose-50 hover:text-rose-500 hover:ring-rose-500/30 active:scale-95',
                        )}
                        aria-pressed={isLiked}
                    >
                        <Heart className={cx('size-5', isLiked && 'animate-rise')} fill={isLiked ? 'currentColor' : 'none'} />
                        {isLiked ? '좋아요를 눌렀어요' : '좋아요'} · {essay.likes}
                    </button>
                </footer>
            </Card>

            {/* 댓글 */}
            <section className="no-print mt-8" aria-labelledby="comments-title">
                <h2 id="comments-title" className="mb-4 flex items-center gap-2 text-lg font-bold text-ink-900">
                    <MessageCircle className="size-5 text-brand-600" />
                    댓글 {comments ? comments.length : ''}
                </h2>

                <div className="space-y-3">
                    {comments === null && !commentsError && (
                        <div className="py-6 text-center">
                            <Spinner />
                        </div>
                    )}
                    {commentsError && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{commentsError}</p>}
                    {comments?.length === 0 && (
                        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-500">
                            아직 댓글이 없어요. 첫 응원을 남겨 주세요!
                        </p>
                    )}
                    {comments?.map((c) => {
                        const teacher = c.isTeacher || c.authorGrade === 0;
                        return (
                            <div
                                key={c.id}
                                className={cx('group relative rounded-2xl px-4 py-3.5', teacher ? 'bg-leaf-50 ring-1 ring-leaf-500/20' : 'bg-white ring-1 ring-line/70')}
                            >
                                <div className="mb-1 flex items-center gap-2 text-xs">
                                    {teacher ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-leaf-600">
                                            <GraduationCap className="size-3.5" /> 선생님
                                        </span>
                                    ) : (
                                        <span className="font-semibold text-ink-700">
                                            {c.authorGrade}학년 {c.authorClass}반 {c.authorName}
                                        </span>
                                    )}
                                    <span className="text-ink-400" title={fullDate(c.createdAt)}>
                                        {relativeTime(c.createdAt)}
                                    </span>
                                </div>
                                <p className="whitespace-pre-wrap pr-8 text-[15px] leading-relaxed text-ink-900">{c.content}</p>
                                {isAdmin && (
                                    <IconButton label="댓글 지우기" tone="danger" onClick={() => removeComment(c)} className="absolute right-2 top-2 size-8">
                                        <Trash2 className="size-4" />
                                    </IconButton>
                                )}
                            </div>
                        );
                    })}
                </div>

                <CommentForm
                    essayId={essay.id}
                    student={student}
                    isAdmin={isAdmin}
                    onAdded={(c) => setComments((prev) => [...(prev || []), c])}
                />
            </section>
        </div>
    );
};

const CommentForm: React.FC<{
    essayId: string;
    student: Student | null;
    isAdmin: boolean;
    onAdded: (c: Comment) => void;
}> = ({ essayId, student, isAdmin, onAdded }) => {
    const [content, setContent] = useState('');
    const [guest, setGuest] = useState({ grade: '', classNumber: '', studentId: '', name: '' });
    const [sending, setSending] = useState(false);
    const { toast } = useFeedback();
    const needsInfo = !isAdmin && !student;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        const author = isAdmin
            ? { grade: 0, class: 0, number: 0, name: '선생님' }
            : {
                  grade: Number(student?.grade ?? guest.grade),
                  class: Number(student?.classNumber ?? guest.classNumber),
                  number: Number(student?.studentId ?? guest.studentId),
                  name: (student?.name ?? guest.name).trim(),
              };
        if (!isAdmin && (!author.grade || !author.class || !author.number || !author.name)) {
            toast('학년, 반, 번호, 이름을 모두 적어 주세요.', 'error');
            return;
        }
        setSending(true);
        try {
            const c = await addComment(essayId, author.name, content.trim(), author);
            onAdded(c);
            setContent('');
            toast('댓글을 남겼어요!');
        } catch (err: any) {
            toast(err?.message || '댓글을 남기지 못했어요.', 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <form onSubmit={submit} className="mt-5 rounded-card border border-line/70 bg-white p-4 shadow-card">
            {needsInfo && (
                <div className="mb-3 grid grid-cols-4 gap-2">
                    <Select aria-label="학년" value={guest.grade} onChange={(e) => setGuest({ ...guest, grade: e.target.value })} className="!h-10 text-sm">
                        <option value="">학년</option>
                        {GRADES.map((g) => (
                            <option key={g} value={g}>
                                {g}학년
                            </option>
                        ))}
                    </Select>
                    <Input aria-label="반" type="number" min={1} placeholder="반" value={guest.classNumber} onChange={(e) => setGuest({ ...guest, classNumber: e.target.value })} className="!h-10 text-sm" />
                    <Input aria-label="번호" type="number" min={1} placeholder="번호" value={guest.studentId} onChange={(e) => setGuest({ ...guest, studentId: e.target.value })} className="!h-10 text-sm" />
                    <Input aria-label="이름" placeholder="이름" maxLength={30} value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className="!h-10 text-sm" />
                </div>
            )}
            <Textarea
                aria-label="댓글 내용"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={2000}
                placeholder={isAdmin ? '선생님의 한마디를 남겨 주세요.' : '친구 글에서 좋았던 점이나 궁금한 점을 적어 보세요.'}
                className="min-h-20 border-0 px-1 focus:ring-0"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-400">
                    {isAdmin ? '선생님 이름으로 올라가요' : student ? `${student.name}(으)로 올라가요` : '따뜻한 말로 응원해 주세요'}
                </span>
                <Button type="submit" size="sm" loading={sending} disabled={!content.trim()} icon={<Send className="size-4" />}>
                    댓글 달기
                </Button>
            </div>
        </form>
    );
};
