import React, { useMemo, useState } from 'react';
import { BookOpen, Download, KeyRound, PenLine, Pin, RotateCcw, Search, Settings2, Users, X, ChevronRight } from 'lucide-react';
import { ModelEssayModal } from '../components/ModelEssay';
import { MODEL_ESSAY } from '../modelEssay';
import { WritingSettingsModal } from './SettingsModal';
import type { Essay, Student } from '../types';
import { GRADES } from '../constants';
import { Badge, Button, EmptyState, Input, Select, Spinner, cx } from '../components/ui';
import EssayCard from '../components/EssayCard';
import { downloadEssaysCsv } from '../utils';
import { Tour, useTour, type TourStep } from '../components/Tour';

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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [modelOpen, setModelOpen] = useState(false);

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

    // ---------- 따라하기 ----------
    const tour = useTour(isAdmin ? 'teacher-gallery' : 'student-gallery');
    const studentSteps: TourStep[] = [
        {
            title: `반가워요${student ? `, ${student.name}` : ''}!`,
            body: <>처음 왔군요. 글쓰기 요정이 사용법을 알려 줄게요. <b>1분</b>이면 끝나요!</>,
        },
        {
            target: 'filters',
            title: '우리 반 글부터 보여요',
            body: <>학년·반을 바꾸거나, <b>주제·이름</b>으로 친구 글을 찾을 수 있어요.</>,
        },
        {
            target: 'model-card',
            title: '먼저 예시 글을 살펴봐요',
            body: <>모든 반에 똑같이 보이는 <b>예시 글</b>이에요. 서론·근거·출처·결론이 어떻게 짜여 있는지 색으로 보여 줘요.</>,
        },
        {
            target: 'essay-card',
            skipIfMissing: true,
            title: '카드를 누르면 글을 읽어요',
            body: <>마음에 드는 글에는 <b>좋아요</b>와 <b>응원 댓글</b>을 남겨 주세요. 좋아요는 글마다 한 번씩!</>,
        },
        {
            target: 'tab-mine',
            title: '내 글 모아보기',
            body: <>이 기기에서 쓴 글이 모여요. 여기서 고르면 <b>코드 없이</b> 내 글을 고칠 수 있어요.</>,
        },
        {
            target: 'find-code',
            title: '다른 컴퓨터에서 쓴 글은?',
            body: <>글을 올리면 <b>6자리 수정 코드</b>를 줘요. 그 코드로 내 글을 찾아 고치거나 지울 수 있어요.</>,
        },
        {
            target: 'new-essay',
            title: '이제 첫 글을 써 볼까요?',
            body: <>빛나는 <b>새 글 쓰기</b>를 누르면 글쓰기 따라하기가 이어져요!</>,
        },
    ];
    const teacherSteps: TourStep[] = [
        { title: '선생님, 환영합니다!', body: '학생 글을 관리하는 기능을 짧게 소개할게요.' },
        {
            target: 'stats',
            skipIfMissing: true,
            title: '반별 글 현황',
            body: '반을 누르면 그 반 글만 모아 볼 수 있어요.',
        },
        {
            target: 'filters',
            title: '학년·반·검색',
            body: '학년과 반을 고르거나 주제·학생 이름으로 찾아요.',
        },
        {
            target: 'essay-card',
            skipIfMissing: true,
            title: '수정 코드와 삭제',
            body: <>학생이 코드를 잊어버리면 카드 아래 <b>수정 코드</b>를 알려 주세요. 휴지통으로 글을 지울 수 있어요.</>,
        },
        {
            target: 'settings',
            title: '글쓰기 설정',
            body: <>서론·결론 <b>최소 글자 수</b>를 정하고, 학생에게 <b>남은 글자 수</b>를 보여줄지 켜고 끌 수 있어요.</>,
        },
        {
            target: 'export',
            title: '엑셀로 내려받기',
            body: <>지금 보이는 글을 표로 받아요. 평가나 <b>생활기록부</b> 쓸 때 활용해 보세요.</>,
        },
        {
            title: '댓글 관리',
            body: <>글을 열면 선생님 이름으로 댓글을 달거나, 부적절한 댓글을 <b>지울 수</b> 있어요. 선생님 댓글은 초록색으로 보여요.</>,
        },
    ];

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
                        <>
                        <Button variant="secondary" icon={<Settings2 className="size-4" />} onClick={() => setSettingsOpen(true)} data-tour="settings">
                            글쓰기 설정
                        </Button>
                        <Button
                            variant="secondary"
                            icon={<Download className="size-4" />}
                            data-tour="export"
                            disabled={!visible.length}
                            onClick={() => downloadEssaysCsv(visible, filterLabel)}
                        >
                            {filtered ? '보이는 글' : '전체'} 엑셀로 받기
                        </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="secondary" icon={<KeyRound className="size-4" />} onClick={onFindByCode} data-tour="find-code">
                                수정 코드로 찾기
                            </Button>
                            <Button icon={<PenLine className="size-4" />} onClick={onNewEssay} data-tour="new-essay">
                                새 글 쓰기
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* 선생님: 반별 현황 */}
            {isAdmin && classStats.length > 0 && (
                <div className="mt-6 flex gap-2 overflow-x-auto pb-1" data-tour="stats">
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
                <div className="flex flex-wrap items-center gap-2" data-tour="filters">
                    {!isAdmin && (
                        <div className="flex rounded-xl bg-ink-900/5 p-1" role="tablist" aria-label="글 보기" data-tour="tab-mine">
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

            {/* 모든 반 공통 예시 글 (고정 · 삭제 불가 · 필터와 상관없이 항상 보임) */}
            {tab === 'all' && (
                <button
                    type="button"
                    onClick={() => setModelOpen(true)}
                    data-tour="model-card"
                    className="group mt-6 flex w-full items-center gap-4 rounded-card border border-sun-400/40 bg-gradient-to-r from-sun-50 to-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift sm:p-5"
                >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sun-400 text-white">
                        <BookOpen className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone="sun">
                                <Pin className="size-3" /> 모든 반 공통 예시 글
                            </Badge>
                        </span>
                        <span className="mt-1 block truncate text-[17px] font-bold text-ink-900">{MODEL_ESSAY.topic}</span>
                        <span className="block text-sm text-ink-500">서론·근거·출처·결론이 어떻게 짜여 있는지 살펴봐요</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-400 transition-transform group-hover:translate-x-1" />
                </button>
            )}

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
                            <div key={essay.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }} data-tour={i === 0 ? 'essay-card' : undefined}>
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

            {isAdmin && <WritingSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
            <ModelEssayModal open={modelOpen} onClose={() => setModelOpen(false)} />
            <Tour
                steps={isAdmin ? teacherSteps : studentSteps}
                running={tour.running}
                startAt={tour.startAt}
                onFinish={tour.finish}
                finishLabel={isAdmin ? '시작하기' : '알겠어요!'}
            />

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
