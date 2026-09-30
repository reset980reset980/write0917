import React from 'react';
import { Heart, Trash2, KeyRound, Quote } from 'lucide-react';
import { Essay } from '../types';
import { relativeTime, countChars } from '../utils';
import { Badge, IconButton } from './ui';

interface EssayCardProps {
    essay: Essay;
    onSelect: () => void;
    isAdmin?: boolean;
    isMine?: boolean;
    onDelete?: (essay: Essay) => void;
    isLiked?: boolean;
}

const EssayCard: React.FC<EssayCardProps> = ({ essay, onSelect, isAdmin = false, isMine = false, onDelete, isLiked = false }) => {
    const reasons = essay.body.filter((b) => b.reason.trim()).length;

    return (
        <article className="group relative flex h-full flex-col rounded-card border border-line/70 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
            <button
                type="button"
                onClick={onSelect}
                className="flex flex-1 flex-col p-5 text-left focus-visible:outline-none"
                aria-label={`${essay.topic} 읽기`}
            >
                <div className="mb-3 flex flex-wrap items-center gap-1.5 pr-8">
                    <Badge tone="brand">
                        {essay.student.grade}학년 {essay.student.classNumber}반
                    </Badge>
                    {isMine && <Badge tone="sun">내 글</Badge>}
                </div>
                <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-ink-900 group-hover:text-brand-700">
                    <Quote className="-mt-1 mr-1 inline size-4 rotate-180 text-brand-200" aria-hidden />
                    {essay.topic}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-500">{essay.introduction}</p>
                <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between text-xs text-ink-400">
                        <span className="font-medium text-ink-700">
                            {essay.student.studentId}번 {essay.student.name}
                        </span>
                        <span>{relativeTime(essay.createdAt)}</span>
                    </div>
                </div>
            </button>
            <footer className="flex items-center justify-between gap-2 border-t border-line/60 px-5 py-3 text-xs text-ink-500">
                <span className={`inline-flex items-center gap-1 font-semibold ${isLiked ? 'text-rose-500' : ''}`}>
                    <Heart className="size-4" fill={isLiked ? 'currentColor' : 'none'} aria-hidden />
                    {essay.likes}
                    <span className="sr-only">좋아요</span>
                </span>
                <span className="flex items-center gap-3">
                    <span>근거 {reasons}개</span>
                    <span>{countChars(essay.fullText)}자</span>
                </span>
            </footer>
            {isAdmin && essay.editCode && (
                <div className="flex items-center gap-1.5 border-t border-dashed border-line/80 bg-paper/60 px-5 py-2 font-mono text-xs text-ink-500 rounded-b-card">
                    <KeyRound className="size-3.5" aria-hidden /> 수정 코드
                    <span className="font-bold tracking-widest text-brand-700">{essay.editCode}</span>
                </div>
            )}
            {isAdmin && onDelete && (
                <IconButton label="글 삭제" tone="danger" onClick={() => onDelete(essay)} className="absolute right-3 top-3">
                    <Trash2 className="size-4" />
                </IconButton>
            )}
        </article>
    );
};

export default EssayCard;
