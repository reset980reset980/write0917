import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronLeft, ChevronRight, Hand, PartyPopper } from 'lucide-react';
import { Button, cx } from './ui';

/**
 * 게임 초반처럼 "따라하기" 튜토리얼
 * - 화면을 어둡게 하고 해당 요소만 스포트라이트
 * - 말풍선으로 할 일을 알려줌
 * - `done` 이 있는 단계는 학생이 실제로 해 볼 때까지 기다림 (required 면 다음 버튼 잠금)
 * - `action` 단계는 표시된 버튼을 직접 누르면 넘어감
 */
export type TourStep = {
    /** data-tour="..." 값. 없으면 화면 가운데 말풍선 */
    target?: string;
    title: string;
    body: React.ReactNode;
    /** 해냈는지 확인 (매 프레임 확인) */
    done?: () => boolean;
    /** true 면 done 전까지 '다음' 잠금 */
    required?: boolean;
    /** 표시된 요소를 직접 눌러야 넘어가는 단계 ('다음' 버튼 숨김) */
    action?: boolean;
    /** 잘했어요 문구 */
    praise?: string;
    /** 대상이 없으면 이 단계를 건너뜀 */
    skipIfMissing?: boolean;
    /** 참이면 이 단계를 건너뜀 (이미 지나간 단계 등) */
    skipIf?: () => boolean;
    /** 스포트라이트 밖도 누를 수 있게 */
    allowOutside?: boolean;
};

const TOUR_PREFIX = 'w917.tour.';

export const tourSeen = {
    get: (key: string) => {
        try {
            return window.localStorage.getItem(TOUR_PREFIX + key) === 'done';
        } catch {
            return true; // 저장소가 막힌 환경에서는 매번 뜨지 않게
        }
    },
    set: (key: string) => {
        try {
            window.localStorage.setItem(TOUR_PREFIX + key, 'done');
        } catch {
            /* 무시 */
        }
    },
};

/** 헤더의 '사용법' 버튼 → 지금 화면의 따라하기 다시 시작 */
export const TOUR_REPLAY_EVENT = 'w917:tour-replay';
export const requestTourReplay = () => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));

/** 화면마다 쓰는 훅: 처음이면 자동 시작, '사용법' 누르면 다시 시작 */
export function useTour(
    key: string,
    { autoStart = true, enabled = true, replayIndex }: { autoStart?: boolean; enabled?: boolean; replayIndex?: () => number } = {},
) {
    const replayIndexRef = useRef(replayIndex);
    replayIndexRef.current = replayIndex;
    const [running, setRunning] = useState(false);
    const [startAt, setStartAt] = useState(0);

    useEffect(() => {
        if (!enabled || !autoStart || tourSeen.get(key)) return;
        const t = window.setTimeout(() => setRunning(true), 450); // 화면이 그려진 뒤 시작
        return () => window.clearTimeout(t);
    }, [key, autoStart, enabled]);

    useEffect(() => {
        if (!enabled) return;
        const replay = () => {
            setStartAt(replayIndexRef.current?.() ?? 0);
            setRunning(true);
        };
        window.addEventListener(TOUR_REPLAY_EVENT, replay);
        return () => window.removeEventListener(TOUR_REPLAY_EVENT, replay);
    }, [enabled]);

    const finish = useCallback(() => {
        tourSeen.set(key);
        setRunning(false);
    }, [key]);

    // 따라하기 도중 안내된 버튼을 눌러 화면을 떠나면 본 것으로 기록
    const runningRef = useRef(running);
    runningRef.current = running;
    useEffect(() => () => {
        if (runningRef.current) tourSeen.set(key);
    }, [key]);

    const start = useCallback((index = 0) => {
        setStartAt(index);
        setRunning(true);
    }, []);

    return { running, startAt, start, finish };
}

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const TIP_W = 340;
const GAP = 14;

export const Tour: React.FC<{
    steps: TourStep[];
    running: boolean;
    startAt?: number;
    onFinish: () => void;
    finishLabel?: string;
}> = ({ steps, running, startAt = 0, onFinish, finishLabel = '따라하기 끝!' }) => {
    const [index, setIndex] = useState(startAt);
    const [rect, setRect] = useState<Rect | null>(null);
    const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
    const [tipH, setTipH] = useState(200);
    const [done, setDone] = useState(false);
    const [paused, setPaused] = useState(false);
    const tipRef = useRef<HTMLDivElement>(null);
    const missingSince = useRef<number | null>(null);
    const stepsRef = useRef(steps);
    stepsRef.current = steps;

    useEffect(() => {
        if (running) setIndex(Math.min(startAt, steps.length - 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, startAt]);

    const step = steps[index];
    const isLast = index === steps.length - 1;

    const next = useCallback(() => {
        if (index >= stepsRef.current.length - 1) onFinish();
        else setIndex((i) => i + 1);
    }, [index, onFinish]);

    // 단계가 바뀌면 대상 요소를 화면 가운데로
    useEffect(() => {
        if (!running || !step?.target) return;
        missingSince.current = null;
        setDone(false);
        const t = window.setTimeout(() => {
            const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
        return () => window.clearTimeout(t);
    }, [running, index, step?.target]);

    // 매 프레임: 위치 추적 + 완료 조건 확인
    useEffect(() => {
        if (!running || !step) return;
        let raf = 0;
        let advanceTimer = 0;
        const tick = () => {
            const s = stepsRef.current[index];
            if (!s) return;
            // 확인창·AI 패널 같은 다른 창이 열리면 잠시 숨김
            setPaused(!!document.querySelector('[aria-modal="true"]'));
            if (s.skipIf?.()) {
                next();
                return;
            }
            if (s.target) {
                const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
                if (el && el.offsetParent !== null) {
                    missingSince.current = null;
                    const r = el.getBoundingClientRect();
                    setRect((prev) =>
                        prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5 && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5
                            ? prev
                            : { top: r.top, left: r.left, width: r.width, height: r.height },
                    );
                } else {
                    setRect(null);
                    if (s.skipIfMissing) {
                        missingSince.current ??= performance.now();
                        if (performance.now() - missingSince.current > 700) {
                            missingSince.current = null;
                            next();
                            return;
                        }
                    }
                }
            } else {
                setRect(null);
            }
            if (s.done) {
                const ok = s.done();
                setDone(ok);
                // 직접 눌러야 하는 단계는 해내면 바로 다음으로
                if (ok && s.action && !advanceTimer) {
                    advanceTimer = window.setTimeout(next, 700);
                }
            }
            if (tipRef.current) setTipH(tipRef.current.offsetHeight);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(advanceTimer);
            window.removeEventListener('resize', onResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, index, next]);

    // Esc 로 건너뛰기, → 로 다음
    useEffect(() => {
        if (!running) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onFinish();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [running, onFinish]);

    useLayoutEffect(() => {
        if (tipRef.current) setTipH(tipRef.current.offsetHeight);
    }, [index]);

    if (!running || !step || paused) return null;

    // ----- 말풍선 위치 -----
    const hole = rect
        ? {
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
          }
        : null;
    const tipW = Math.min(TIP_W, vp.w - 24);
    let tipStyle: React.CSSProperties;
    let arrow: 'up' | 'down' | null = null;
    if (!hole) {
        tipStyle = { left: (vp.w - tipW) / 2, top: Math.max(16, (vp.h - tipH) / 2), width: tipW };
    } else {
        const centerX = hole.left + hole.width / 2;
        const left = Math.min(Math.max(12, centerX - tipW / 2), vp.w - tipW - 12);
        const below = hole.top + hole.height + GAP;
        const above = hole.top - GAP - tipH;
        if (below + tipH <= vp.h - 12) {
            tipStyle = { left, top: below, width: tipW };
            arrow = 'up';
        } else if (above >= 12) {
            tipStyle = { left, top: above, width: tipW };
            arrow = 'down';
        } else {
            // 대상이 너무 크면 화면 아래에 붙임
            tipStyle = { left, top: vp.h - tipH - 16, width: tipW };
        }
    }
    const arrowLeft = hole ? Math.min(Math.max(20, hole.left + hole.width / 2 - (tipStyle.left as number)), tipW - 20) : 0;

    const locked = !!step.required && !done;
    const showNext = !step.action || !step.done;

    return (
        <div className="no-print pointer-events-none fixed inset-0 z-[55]" aria-live="polite">
            {/* 어두운 배경 + 스포트라이트 */}
            {hole ? (
                <>
                    <div
                        className="pointer-events-none fixed rounded-2xl transition-all duration-300 ease-out"
                        style={{ ...hole, boxShadow: '0 0 0 9999px rgb(20 22 32 / 0.58)' }}
                    />
                    <div
                        className={cx('pointer-events-none fixed rounded-2xl ring-4 transition-all duration-300', done ? 'ring-leaf-500' : 'ring-sun-400 animate-pulse')}
                        style={hole}
                    />
                    {!step.allowOutside && (
                        <>
                            {/* 스포트라이트 밖 클릭 막기 */}
                            <div className="pointer-events-auto fixed left-0 right-0 top-0" style={{ height: Math.max(0, hole.top) }} />
                            <div className="pointer-events-auto fixed bottom-0 left-0 right-0" style={{ top: hole.top + hole.height }} />
                            <div className="pointer-events-auto fixed left-0" style={{ top: hole.top, height: hole.height, width: Math.max(0, hole.left) }} />
                            <div className="pointer-events-auto fixed right-0" style={{ top: hole.top, height: hole.height, left: hole.left + hole.width }} />
                        </>
                    )}
                </>
            ) : (
                <div className="pointer-events-auto fixed inset-0 bg-ink-900/58 animate-fade" />
            )}

            {/* 말풍선 */}
            <div
                ref={tipRef}
                role="dialog"
                aria-label={`따라하기 ${index + 1}단계: ${step.title}`}
                className="pointer-events-auto fixed rounded-2xl bg-white p-4 shadow-lift transition-[top,left] duration-300 ease-out animate-rise"
                style={tipStyle}
                key={index}
            >
                {arrow && (
                    <span
                        className={cx('absolute size-3.5 rotate-45 bg-white', arrow === 'up' ? '-top-1.5' : '-bottom-1.5')}
                        style={{ left: arrowLeft - 7 }}
                        aria-hidden
                    />
                )}
                <div className="relative flex items-start gap-3">
                    <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl', isLast ? 'bg-leaf-50 text-leaf-500' : 'bg-ink-900 text-sun-400')}>
                        {isLast ? <PartyPopper className="size-5" /> : <Bot className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold tracking-wide text-brand-600">
                                따라하기 {index + 1} / {steps.length}
                            </p>
                            <button type="button" onClick={onFinish} className="text-xs font-medium text-ink-400 hover:text-ink-900">
                                건너뛰기
                            </button>
                        </div>
                        <h3 className="mt-0.5 text-[16px] font-extrabold leading-snug text-ink-900">{step.title}</h3>
                        <div className="mt-1 text-sm leading-relaxed text-ink-700">{step.body}</div>

                        {step.done && (
                            <p
                                className={cx(
                                    'mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors',
                                    done ? 'bg-leaf-50 text-leaf-600' : 'bg-sun-50 text-sun-600',
                                )}
                            >
                                {done ? (
                                    <>
                                        <Check className="size-3.5" /> {step.praise || '잘했어요!'}
                                    </>
                                ) : step.action ? (
                                    <>
                                        <Hand className="size-3.5" /> 빛나는 곳을 직접 눌러 보세요
                                    </>
                                ) : (
                                    <>
                                        <Hand className="size-3.5" /> 직접 해 보세요{step.required ? '' : ' (건너뛰어도 괜찮아요)'}
                                    </>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {/* 진행 점 + 버튼 */}
                <div className="relative mt-3 flex items-center justify-between gap-2">
                    <div className="flex gap-1" aria-hidden>
                        {steps.map((_, i) => (
                            <span key={i} className={cx('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-brand-600' : i < index ? 'w-1.5 bg-brand-200' : 'w-1.5 bg-ink-900/10')} />
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        {index > 0 && (
                            <button
                                type="button"
                                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-900/5 hover:text-ink-900"
                                aria-label="이전"
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                        )}
                        {showNext && (
                            <Button size="sm" variant={isLast ? 'success' : 'primary'} onClick={next} disabled={locked} autoFocus={!step.done}>
                                {isLast ? finishLabel : index === 0 ? '시작!' : '다음'}
                                {!isLast && <ChevronRight className="size-4" />}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
