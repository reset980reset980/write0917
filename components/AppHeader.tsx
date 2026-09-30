import React from 'react';
import { LogOut, PenLine, GraduationCap, UserRound } from 'lucide-react';
import type { Student } from '../types';
import { cx } from './ui';

export const Logo: React.FC<{ className?: string; onClick?: () => void }> = ({ className, onClick }) => (
    <button type="button" onClick={onClick} className={cx('group flex items-center gap-2.5 text-left', className)} aria-label="처음 화면으로">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm transition-transform group-hover:-rotate-6">
            <PenLine className="size-5" />
        </span>
        <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-tight text-ink-900">주장하는 글쓰기</span>
            <span className="block text-[11px] font-medium text-ink-500">AI 글쓰기 도우미</span>
        </span>
    </button>
);

export const AppHeader: React.FC<{
    student: Student | null;
    isAdmin: boolean;
    onHome: () => void;
    onLogout: () => void;
    children?: React.ReactNode;
}> = ({ student, isAdmin, onHome, onLogout, children }) => (
    <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <Logo onClick={onHome} />
            <div className="flex items-center gap-2">
                {children}
                {(student || isAdmin) && (
                    <div className="flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-3 pr-1 shadow-sm">
                        {isAdmin ? (
                            <GraduationCap className="size-4 text-leaf-600" aria-hidden />
                        ) : (
                            <UserRound className="size-4 text-brand-600" aria-hidden />
                        )}
                        <span className="max-w-[9rem] truncate text-sm font-semibold text-ink-700">
                            {isAdmin ? '선생님' : `${student!.grade}-${student!.classNumber} ${student!.name}`}
                        </span>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="ml-1 inline-flex size-7 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-900"
                            aria-label="나가기"
                            title="나가기"
                        >
                            <LogOut className="size-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    </header>
);
