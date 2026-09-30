import React, { useMemo, useState } from 'react';
import { BookOpen, Download, KeyRound, PenLine, RotateCcw, Search, Users, X } from 'lucide-react';
import type { Essay, Student } from '../types';
import { GRADES } from '../constants';
import { Button, EmptyState, Input, Select, Spinner, cx } from '../components/ui';
import EssayCard from '../components/EssayCard';
import { downloadEssaysCsv } from '../utils';

type Tab = 'all' | 'mine';

export const GalleryView: React.FC<{
    essays: Essay[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    student: Student | null;
    isAdmin: boolean;
    likedIds: Set<string>;
    myEssayIds: Set<string>;
    onSelect: (essay: Essay) => void;
    onNewEssay: () => void;
    onFindByCode: () => void;
    onDelete: (essay: Essay) => void;
}> = ({ essays, loading, error, onRetry, student, isAdmin, likedIds, myEssayIds, onSelect, onNewEssay, onFindByCode, onDelete }) => {
    const [tab, setTab] = useState<Tab>('all');
    // 학생은 처음에 우리 반 글부터 보여줌
    const [grade, setGrade] = useState(student?.grade || '');
    const [cls, setCls] = useState(student?.classNumber || '');
    const [query, setQuery] = useState('');

    const classOptions = useMemo(() => {
        const set = new Set<string>();
        essays.forEach((e) => {
            if (!grade || e.student.grade === grade) set.add(e.student.classNumber);
        });
        if (cls) set.add(cls);
        return Array.from(set).sort((a, b) => Number(a) - Number(b));
    }, [essays, grade, cls]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return essays.filter((e) => {
            if (tab === 'mine') return myEssayIds.has(e.id);
            if (grade && e.student.grade !== grade) return false;
            if (cls && e.student.classNumber !== cls) return false;
            if (q && !`${e.topic} ${e.student.name}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [essays, tab, grade, cls, query, myEssayIds]);

    const filtered = tab === 'all' && !!(grade || cls || query);
    const resetFilters = () => {
        setGrade('');
        setCls('');
        setQuery('');
    };

    // 선생님용: 학년·반별 글 수
    const classStats = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map<string, number>();
        essays.forEach((e) => {
            const k = `${e.student.grade}-${e.student.classNumber}`;
            map.set(k, (map.get(k) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([k, n]) => {
                const [g, c] = k.split('-');
                return { g, c, n };
            })
            .sort((a, b) => Number(a.g) - Number(b.g) || Number(a.c) - Number(b.c));
    }, [essays, isAdmin]);

    const filterLabel = [grade && `${grade}학년`, cls && `${cls}반`].filter(Boolean).join('_') || '전체';

    return (
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
            {/* 제목 영역 */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-brand-600">{isAdmin ? '선생님 관리 화면' : '우리들의 글 솜씨'}</p>
                    <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                        {isAdmin ? '학생 글 모아보기' : '친구들의 주장을 읽어 봐요'}
                    </h1>
                    <p className="mt-2 text-ink-500">
                        {isAdmin ? '글을 읽고 댓글을 남기거나, 표로 내려받을 수 있어요.' : '마음에 드는 글에 좋아요와 응원 댓글을 남겨 주세요.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isAdmin ? (
                        <Button
                            variant="secondary"
                            icon={<Download className="size-4" />}
                            disabled={!visible.length}
                            onClick={() => downloadEssaysCsv(visible, filterLabel)}
                        >
                            {filtered ? '보이는 글' : '전체'} 엑셀로 받기
                        </Button>
                    ) : (
                        <>
                            <Button variant="secondary" icon={<KeyRound className="size-4" />} onClick={onFindByCode}>
                                수정 코드로 찾기
                            </Button>
                            <Button icon={<PenLine className="size-4" />} onClick={onNewEssay}>
                                새 글 쓰기
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* 선생님: 반별 현황 */}
            {isAdmin && classStats.length > 0 && (
                <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
                    <StatChip label="전체" value={essays.length} active={!grade && !cls} onClick={resetFilters} />
                    {classStats.map((s) => (
                        <StatChip
                            key={`${s.g}-${s.c}`}
                            label={`${s.g}-${s.c}반`}
                            value={s.n}
                            active={grade === s.g && cls === s.c}
                            onClick={() => {
                                setGrade(s.g);
                                setCls(s.c);
                                setTab('all');
                            }}
                        />
                    ))}
                </div>
            )}

            {/* 도구 막대 */}
            <div className="sticky top-16 z-20 -mx-4 mt-6 border-y border-line/60 bg-paper/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:bg-white/80 sm:px-3">
                <div className="flex flex-wrap items-center gap-2">
                    {!isAdmin && (
                        <div className="flex rounded-xl bg-ink-900/5 p-1" role="tablist" aria-label="글 보기">
                            {(
                                [
                                    ['all', '모든 글', <Users key="u" className="size-4" />],
                                    ['mine', `내 글 ${myEssayIds.size ? myEssayIds.size : ''}`, <BookOpen key="b" className="size-4" />],
                                ] as const
                            ).map(([key, label, icon]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    onClick={() => setTab(key)}
                                    className={cx(
                                        'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
                                        tab === key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900',
                                    )}
                                >
                                    {icon}
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                    {tab === 'all' && (
                        <>
                            <Select
                                aria-label="학년"
                                value={grade}
                                onChange={(e) => {
                                    setGrade(e.target.value);
                                    setCls('');
                                }}
                                className="!h-9 !w-auto min-w-[6.5rem] text-sm"
                            >
                                <option value="">전체 학년</option>
                                {GRADES.map((g) => (
                                    <option key={g} value={g}>
                                        {g}학년
                                    </option>
                                ))}
                            </Select>
                            <Select aria-label="반" value={cls} onChange={(e) => setCls(e.target.value)} className="!h-9 !w-auto min-w-[5.5rem] text-sm">
                                <option value="">전체 반</option>
                                {classOptions.map((c) => (
                                    <option key={c} value={c}>
                                        {c}반
                                    </option>
                                ))}
                            </Select>
                            <div className="relative min-w-[10rem] flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
                                <Input
                                    type="search"
                                    aria-label="주제나 이름으로 찾기"
                                    placeholder="주제나 이름으로 찾기"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="!h-9 pl-9 text-sm"
                                />
                            </div>
                            {filtered && (
                                <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={resetFilters}>
                                    전체 보기
                                </Button>
                            )}
                        </>
                    )}
                    <span className="ml-auto text-sm font-medium text-ink-500">{visible.length}편</span>
                </div>
            </div>

            {/* 목록 */}
            <div className="mt-6">
                {loading && !essays.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-56 animate-pulse rounded-card bg-white/70 ring-1 ring-line/60" />
                        ))}
                        <span className="sr-only">
                            <Spinner />
                        </span>
                    </div>
                ) : error ? (
                    <EmptyState
                        icon={<X className="size-6" />}
                        title="글 목록을 불러오지 못했어요"
                        description={error}
                        action={
                            <Button icon={<RotateCcw className="size-4" />} onClick={onRetry}>
                                다시 시도
                            </Button>
                        }
                    />
                ) : visible.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {visible.map((essay, i) => (
                            <div key={essay.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                                <EssayCard
                                    essay={essay}
                                    onSelect={() => onSelect(essay)}
                                    isAdmin={isAdmin}
                                    isMine={!isAdmin && myEssayIds.has(essay.id)}
                                    onDelete={onDelete}
                                    isLiked={likedIds.has(essay.id)}
                                />
                            </div>
                        ))}
                    </div>
                ) : tab === 'mine' ? (
                    <EmptyState
                        icon={<BookOpen className="size-6" />}
                        title="이 기기에서 쓴 글이 아직 없어요"
                        description="다른 기기에서 쓴 글은 '수정 코드로 찾기'로 불러올 수 있어요."
                        action={
                            <Button icon={<PenLine className="size-4" />} onClick={onNewEssay}>
                                첫 글 쓰기
                            </Button>
                        }
                    />
                ) : filtered ? (
                    <EmptyState
                        icon={<Search className="size-6" />}
                        title="조건에 맞는 글이 없어요"
                        description="학년·반이나 검색어를 바꿔 보세요."
                        action={
                            <Button variant="secondary" onClick={resetFilters}>
                                전체 글 보기
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={<PenLine className="size-6" />}
                        title="아직 등록된 글이 없어요"
                        description={isAdmin ? '학생들이 글을 올리면 여기에 모여요.' : '첫 번째 글의 주인공이 되어 보세요!'}
                        action={
                            !isAdmin && (
                                <Button icon={<PenLine className="size-4" />} onClick={onNewEssay}>
                                    새 글 쓰기
                                </Button>
                            )
                        }
                    />
                )}
            </div>

            {/* 모바일: 떠 있는 글쓰기 버튼 */}
            {!isAdmin && (
                <button
                    type="button"
                    onClick={onNewEssay}
                    className="no-print fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift transition-transform active:scale-95 sm:hidden"
                    aria-label="새 글 쓰기"
                >
                    <PenLine className="size-6" />
                </button>
            )}
        </div>
    );
};

const StatChip: React.FC<{ label: string; value: number; active: boolean; onClick: () => void }> = ({ label, value, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={cx(
            'flex shrink-0 flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition-colors',
            active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-700 hover:border-ink-300',
        )}
    >
        <span className={cx('text-xs font-medium', active ? 'text-white/75' : 'text-ink-500')}>{label}</span>
        <span className="text-lg font-extrabold leading-tight">{value}편</span>
    </button>
);
