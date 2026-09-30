import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft, BookOpen, Bot, Check, ChevronLeft, ChevronRight, CloudCheck, Lightbulb, Link2, Plus, Send, Sparkles, Trash2, X,
} from 'lucide-react';
import { DEFAULT_WRITING_SETTINGS, type BodyPart, type Essay, type EssayData, type Student, type WritingSettings } from '../types';
import { CharGoal } from './SettingsModal';
import { Badge, Button, Card, IconButton, Input, Linkify, Textarea, cx, useFeedback } from '../components/ui';
import { getTopicSuggestions, getWritingAssistantResponse } from '../services/api';
import { draftStore, type Draft } from '../storage';
import { countChars, relativeTime, studentLabel } from '../utils';
import { Tour, useTour, type TourStep } from '../components/Tour';
import { ModelEssayModal } from '../components/ModelEssay';


const STEPS = [
    { n: 1, title: '주제 정하기', short: '주제' },
    { n: 2, title: '내용 쓰기', short: '내용' },
    { n: 3, title: '다듬고 완성', short: '완성' },
];

const partsKeyOf = (intro: string, body: BodyPart[], concl: string) => JSON.stringify([intro, body.map((b) => b.reason), concl]);

/** 따라하기(연습)에서 쓰는 고정 예시. 실제 AI를 부르지 않고, 글도 올라가지 않음 */
const PRACTICE = {
    topic: '쉬는 시간에 스마트폰을 쓰지 말자',
    refined: '쉬는 시간에는 스마트폰 대신 친구와 함께 놀아야 한다',
    others: [
        '학교에서는 스마트폰을 사물함에 보관해야 한다',
        '하루 스마트폰 사용 시간을 스스로 정하자',
        '쉬는 시간 놀이를 반 친구들과 함께 만들자',
    ],
    introduction:
        '요즘 쉬는 시간이 되면 많은 친구들이 자리에 앉아 스마트폰만 봅니다. 예전처럼 운동장에서 뛰어놀거나 친구와 이야기하는 모습은 점점 줄어들고 있습니다. 저는 쉬는 시간에는 스마트폰 대신 친구와 함께 놀아야 한다고 생각합니다. 그 까닭은 다음과 같습니다.',
    body: [
        {
            reason: '첫째, 친구와 직접 이야기하고 놀면 서로를 더 잘 알게 되어 사이가 가까워집니다. 우리 반 설문에서도 쉬는 시간에 친구와 논 날이 더 즐거웠다는 친구가 많았습니다.',
            source: '우리 반 친구 20명 설문',
        },
        {
            reason: '둘째, 화면을 오래 보면 눈이 피로해져서 다음 수업에 집중하기 어렵습니다. 쉬는 시간에는 눈도 쉬어야 합니다.',
            source: '보건 선생님께 들은 이야기',
        },
    ],
    conclusion:
        '지금까지 쉬는 시간에 스마트폰을 쓰지 말아야 하는 까닭을 살펴보았습니다. 친구와 함께 놀면 사이가 가까워지고 눈도 쉬게 할 수 있습니다. 그러므로 우리는 쉬는 시간에 스마트폰 대신 친구와 함께 놀아야 합니다. 오늘부터 함께 실천해 봅씨다.',
    typo: '봅씨다',
    fix: '봅시다',
    chat: {
        default: '좋은 질문이에요! 먼저 내 주장을 한 문장으로 소리 내어 읽어 보세요. 그다음 "왜냐하면?" 하고 스스로 물어보면 근거가 떠오를 거예요. 어떤 근거가 떠올랐나요?',
        answers: {
            1: '주제는 "누가, 무엇을, 어떻게 해야 한다"가 드러나면 좋아요. 예를 들어 "스마트폰은 나쁘다"보다 "쉬는 시간에는 스마트폰을 쓰지 말자"가 더 또렷하죠. 내 주제에서 "누가"와 "무엇을"을 찾아볼까요?',
            2: '근거를 찾을 때는 세 가지를 떠올려 보세요. ① 내가 겪은 일 ② 친구들에게 물어본 결과 ③ 책이나 기사에서 알게 된 사실. 이 중 어떤 걸 써 볼 수 있을까요?',
            3: '다듬을 때는 글을 소리 내어 읽어 보세요. 숨이 차거나 어색한 곳이 고칠 곳이에요. 틀린 글자도 소리 내어 읽으면 잘 보여요!',
        } as Record<number, string>,
    },
};

/** 게임처럼 한 글자씩 입력되는 효과 */
function typewrite(text: string, apply: (partial: string) => void, timers: React.MutableRefObject<number[]>, speedMs = 18) {
    const chars = Array.from(text);
    const stepSize = Math.max(1, Math.ceil(chars.length / 90)); // 긴 글도 2초 안팎
    let i = 0;
    const id = window.setInterval(() => {
        i = Math.min(chars.length, i + stepSize);
        apply(chars.slice(0, i).join(''));
        if (i >= chars.length) window.clearInterval(id);
    }, speedMs);
    timers.current.push(id);
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'error';
    content: string;
}

export const WritingWizard: React.FC<{
    student: Student;
    initialData?: Essay | null;
    onExit: () => void;
    onSubmit: (data: EssayData) => Promise<boolean>;
    settings?: WritingSettings;
}> = ({ student, initialData, onExit, onSubmit, settings = DEFAULT_WRITING_SETTINGS }) => {
    const isEditMode = !!initialData;
    const { toast, confirm } = useFeedback();
    const draftKey = draftStore.key(student, initialData?.id);

    // ----- 임시저장 불러오기 -----
    const [restored] = useState<Draft | null>(() => draftStore.get(draftKey));
    const init = restored ?? {
        step: 1,
        topic: initialData?.topic || '',
        introduction: initialData?.introduction || '',
        body: initialData?.body?.length ? initialData.body.map((b) => ({ ...b })) : [{ reason: '', source: '' }],
        conclusion: initialData?.conclusion || '',
        finalFullText: initialData?.fullText || '',
        partsKey: initialData ? partsKeyOf(initialData.introduction, initialData.body, initialData.conclusion) : '',
        savedAt: '',
    };

    const [step, setStep] = useState(init.step);
    const [topic, setTopic] = useState(init.topic);
    const [introduction, setIntroduction] = useState(init.introduction);
    const [body, setBody] = useState<BodyPart[]>(init.body);
    const [conclusion, setConclusion] = useState(init.conclusion);
    const [finalFullText, setFinalFullText] = useState(init.finalFullText);
    const [partsKey, setPartsKey] = useState(init.partsKey);
    const [savedAt, setSavedAt] = useState(init.savedAt);
    const [submitting, setSubmitting] = useState(false);

    const [suggestions, setSuggestions] = useState<{ refined: string; others: string[] } | null>(null);
    const [refining, setRefining] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [modelOpen, setModelOpen] = useState(false);

    const topRef = useRef<HTMLDivElement>(null);

    // ----- 따라하기(연습) 모드: 고정 예시로 연습, 끝나면 원래 글로 복구 -----
    const [practice, setPractice] = useState(false);
    const snapshotRef = useRef<Draft | null>(null);
    const typeTimers = useRef<number[]>([]);
    const stopTyping = () => {
        typeTimers.current.forEach((id) => window.clearInterval(id));
        typeTimers.current = [];
    };
    useEffect(() => stopTyping, []);

    useEffect(() => {
        if (restored?.savedAt) toast(`${relativeTime(restored.savedAt)} 임시저장한 글을 불러왔어요.`, 'info');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ----- 자동 임시저장 (입력이 멈추고 0.8초 뒤) -----
    const dirty = useMemo(() => {
        const base = partsKeyOf(initialData?.introduction || '', initialData?.body || [{ reason: '', source: '' }], initialData?.conclusion || '');
        return topic !== (initialData?.topic || '') || partsKeyOf(introduction, body, conclusion) !== base;
    }, [topic, introduction, body, conclusion, initialData]);

    useEffect(() => {
        if (practice || (!dirty && !restored)) return;
        const t = window.setTimeout(() => {
            const now = new Date().toISOString();
            draftStore.set(draftKey, { step, topic, introduction, body, conclusion, finalFullText, partsKey, savedAt: now });
            setSavedAt(now);
        }, 800);
        return () => window.clearTimeout(t);
    }, [step, topic, introduction, body, conclusion, finalFullText, partsKey, draftKey, dirty, restored, practice]);

    // 새로고침·창 닫기 전에 한 번 더 확인
    useEffect(() => {
        if (!dirty || practice) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty, practice]);

    // ----- 검사 -----
    const introLen = countChars(introduction);
    const conclLen = countChars(conclusion);
    // 선생님 설정 (연습 중에는 예시 글 기준 100자로 고정)
    const minIntro = practice ? 100 : settings.requireMin ? settings.minIntro : 1;
    const minConcl = practice ? 100 : settings.requireMin ? settings.minConclusion : 1;
    const showRemaining = practice || (settings.requireMin && settings.showRemaining);
    const bodyOk = body.every((b) => b.reason.trim() && b.source.trim());
    const valid = {
        1: topic.trim().length > 0,
        2: introLen >= minIntro && conclLen >= minConcl && bodyOk,
        3: finalFullText.trim().length > 0,
    } as Record<number, boolean>;

    const generateFullText = useCallback(
        () => [introduction.trim(), ...body.map((b) => b.reason.trim()).filter(Boolean), conclusion.trim()].join('\n\n'),
        [introduction, body, conclusion],
    );

    const goTo = async (next: number) => {
        if (next === 3 && step === 2) {
            if (!valid[2]) {
                const parts: string[] = [];
                if (introLen < minIntro) parts.push(settings.requireMin || practice ? `서론 ${minIntro - introLen}자` : '서론');
                if (conclLen < minConcl) parts.push(settings.requireMin || practice ? `결론 ${minConcl - conclLen}자` : '결론');
                if (!bodyOk) parts.push('근거·출처');
                toast(
                    settings.requireMin || practice
                        ? `아직 조금 남았어요: ${parts.join(', ')}${bodyOk ? ' 더 써 주세요.' : '를 채워 주세요.'}`
                        : `${parts.join(', ')}을(를) 채워 주세요.`,
                    'error',
                );
                return;
            }
            // 서론·본론·결론이 바뀌었을 때만 전체 글을 새로 만듦 (3단계에서 고친 내용 보호)
            const key = partsKeyOf(introduction, body, conclusion);
            if (key !== partsKey || !finalFullText.trim()) {
                if (finalFullText.trim() && partsKey) {
                    const ok = await confirm({
                        title: '전체 글을 새로 만들까요?',
                        message: '2단계 내용이 바뀌어서 3단계 글을 다시 만들어요. 3단계에서 직접 고친 부분은 사라져요.',
                        confirmText: '새로 만들기',
                    });
                    if (!ok) return;
                }
                setFinalFullText(generateFullText());
                setPartsKey(key);
            }
        }
        if (next === 2 && !valid[1]) {
            toast('먼저 주제를 적어 주세요.', 'error');
            return;
        }
        setStep(next);
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleRefine = async () => {
        if (!topic.trim()) {
            toast('먼저 떠오르는 주제를 적어 주세요.', 'error');
            return;
        }
        setRefining(true);
        setSuggestions(null);
        if (practice) {
            // 연습에서는 AI를 부르지 않고 미리 정해 둔 추천을 보여 줌
            window.setTimeout(() => {
                setSuggestions({ refined: PRACTICE.refined, others: PRACTICE.others });
                setRefining(false);
            }, 1100);
            return;
        }
        const r = await getTopicSuggestions(topic, student.grade);
        setSuggestions({ refined: r.refinedTopic, others: r.suggestions });
        setRefining(false);
    };

    const updatePart = (i: number, field: keyof BodyPart, value: string) =>
        setBody((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

    const removePart = async (i: number) => {
        const part = body[i];
        if (part.reason.trim() || part.source.trim()) {
            const ok = await confirm({ title: `근거 ${i + 1}을 지울까요?`, confirmText: '지우기', tone: 'danger' });
            if (!ok) return;
        }
        setBody((prev) => prev.filter((_, idx) => idx !== i));
    };

    const handleExit = async () => {
        if (dirty) {
            const ok = await confirm({
                title: '글쓰기를 멈출까요?',
                message: '지금까지 쓴 내용은 이 기기에 임시저장돼 있어요. 다음에 다시 이어서 쓸 수 있어요.',
                confirmText: '나가기',
            });
            if (!ok) return;
        }
        onExit();
    };

    const handleSubmit = async () => {
        if (practice) {
            toast('지금은 연습이라 글이 올라가지 않아요.', 'info');
            return;
        }
        if (!valid[3]) return;
        setSubmitting(true);
        const ok = await onSubmit({ topic: topic.trim(), introduction, body, conclusion, fullText: finalFullText.trim() });
        setSubmitting(false);
        if (ok) draftStore.clear(draftKey);
    };

    const discardDraft = async () => {
        const ok = await confirm({
            title: '처음부터 다시 쓸까요?',
            message: '임시저장된 내용이 모두 지워져요.',
            confirmText: '지우고 새로 쓰기',
            tone: 'danger',
        });
        if (!ok) return;
        draftStore.clear(draftKey);
        setTopic(initialData?.topic || '');
        setIntroduction(initialData?.introduction || '');
        setBody(initialData?.body?.map((b) => ({ ...b })) || [{ reason: '', source: '' }]);
        setConclusion(initialData?.conclusion || '');
        setFinalFullText(initialData?.fullText || '');
        setPartsKey('');
        setSavedAt('');
        setSuggestions(null);
        setStep(1);
    };

    // ---------- 글쓰기 따라하기 (연습 모드) ----------
    const PRACTICE_MIN = 100; // 예시 글이 늘 통과하도록 연습에서는 고정
    const tour = useTour('writing', { autoStart: !isEditMode });

    // 따라하기가 시작되면 지금 글을 잠시 보관하고 빈 연습장으로, 끝나면 원래대로
    useEffect(() => {
        if (tour.running && !practice) {
            snapshotRef.current = { step, topic, introduction, body, conclusion, finalFullText, partsKey, savedAt };
            setPractice(true);
            setStep(1);
            setTopic('');
            setIntroduction('');
            setBody([{ reason: '', source: '' }]);
            setConclusion('');
            setFinalFullText('');
            setPartsKey('');
            setSuggestions(null);
            setRefining(false);
        } else if (!tour.running && practice) {
            stopTyping();
            const snap = snapshotRef.current;
            if (snap) {
                setStep(snap.step);
                setTopic(snap.topic);
                setIntroduction(snap.introduction);
                setBody(snap.body);
                setConclusion(snap.conclusion);
                setFinalFullText(snap.finalFullText);
                setPartsKey(snap.partsKey);
                setSavedAt(snap.savedAt);
            }
            setSuggestions(null);
            setRefining(false);
            setChatOpen(false);
            setPractice(false);
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tour.running]);

    const tourSteps: TourStep[] = [
        {
            title: '글쓰기 따라하기 시작!',
            body: (
                <>
                    주장하는 글은 <b>주제 → 서론·본론·결론 → 다듬기</b>, 세 단계로 써요.
                    <br />
                    <span className="text-ink-500">예시 글로 연습하는 거라 실제로 올라가지 않아요. 끝나면 내 글로 돌아와요.</span>
                </>
            ),
        },
        {
            target: 'model-btn',
            title: '막힐 땐 예시 글을 봐요',
            body: <>잘 쓴 주장하는 글을 언제든 열어 볼 수 있어요. 베끼지 말고 <b>짜임</b>을 살펴보세요.</>,
            cta: { label: '예시 글 열어 보기', onClick: () => setModelOpen(true) },
            skipIf: () => step >= 2,
        },
        {
            target: 'topic-input',
            title: '① 내 주장을 한 문장으로',
            body: <>"~해야 한다", "~하자"로 끝나게 적어요. 직접 적거나 아래 버튼으로 예시를 넣어 보세요.</>,
            done: () => topic.trim().length >= 5,
            required: true,
            praise: '좋은 주장이에요!',
            cta: { label: '예시 입력하기', onClick: () => typewrite(PRACTICE.topic, setTopic, typeTimers) },
            skipIf: () => step >= 2,
        },
        {
            target: 'ai-refine',
            title: '② AI에게 다듬어 달라고 해요',
            body: <>빛나는 <b>AI에게 다듬기</b>를 눌러 보세요. 요정이 주장을 더 또렷하게 고치고 다른 주제도 추천해 줘요.</>,
            done: () => refining || !!suggestions,
            required: true,
            action: true,
            praise: '요정이 추천을 만들고 있어요!',
            skipIf: () => step >= 2,
        },
        {
            target: 'suggestions',
            title: '③ 마음에 드는 주제 고르기',
            body: <>맨 위 <b>다듬은 주제</b>를 눌러 골라 보세요. 실제로 쓸 때는 내 주제가 더 좋으면 그대로 둬도 돼요.</>,
            done: () => topic === PRACTICE.refined,
            required: true,
            praise: '주제가 정해졌어요!',
            cta: { label: '대신 골라 주기', onClick: () => setTopic(PRACTICE.refined) },
            skipIf: () => step >= 2,
        },
        {
            target: 'next-btn',
            title: '④ 다음 단계로!',
            body: <>주제가 정해졌으면 <b>다음</b>을 눌러요.</>,
            action: true,
            done: () => step >= 2,
            praise: '2단계로 출발!',
        },
        {
            target: 'intro-field',
            title: '⑤ 서론: 문제 상황과 내 주장',
            body: <>왜 이 글을 쓰게 됐는지, 내 주장이 무엇인지 적어요. 기준 글자 수를 넘으면 막대가 초록색이 돼요.</>,
            done: () => countChars(introduction) >= PRACTICE_MIN,
            required: true,
            praise: '서론 완성!',
            cta: { label: '예시 입력하기', onClick: () => typewrite(PRACTICE.introduction, setIntroduction, typeTimers) },
            skipIf: () => step >= 3,
        },
        {
            target: 'body-0',
            title: '⑥ 본론: 근거와 출처',
            body: <>"첫째, ~ 때문입니다"처럼 까닭을 쓰고, 아래 칸에 <b>어디서 알았는지</b>(책, 기사, 설문, 경험) 적어요.</>,
            done: () => !!body[0]?.reason.trim() && !!body[0]?.source.trim(),
            required: true,
            praise: '근거와 출처를 모두 썼어요!',
            cta: {
                label: '예시 입력하기',
                onClick: () => {
                    typewrite(PRACTICE.body[0].reason, (t) => updatePart(0, 'reason', t), typeTimers);
                    typewrite(PRACTICE.body[0].source, (t) => updatePart(0, 'source', t), typeTimers, 40);
                },
            },
            skipIf: () => step >= 3,
        },
        {
            target: 'add-reason',
            skipIfMissing: true,
            title: '⑦ 근거가 많을수록 튼튼해요',
            body: <><b>근거 추가하기</b>로 둘째 근거를 더 넣어 볼까요?</>,
            done: () => body.length >= 2 && !!body[1]?.reason.trim() && !!body[1]?.source.trim(),
            praise: '근거가 두 개가 됐어요!',
            cta: {
                label: '근거 하나 더 넣기',
                onClick: () => {
                    setBody((prev) => (prev.length >= 2 ? prev : [...prev, { reason: '', source: '' }]));
                    window.setTimeout(() => {
                        typewrite(PRACTICE.body[1].reason, (t) => updatePart(1, 'reason', t), typeTimers);
                        typewrite(PRACTICE.body[1].source, (t) => updatePart(1, 'source', t), typeTimers, 40);
                    }, 50);
                },
            },
            skipIf: () => step >= 3,
        },
        {
            target: 'conclusion-field',
            title: '⑧ 결론: 정리하고 한 번 더 강조',
            body: '"그러므로 우리는 ~해야 합니다"처럼 주장을 다시 말하며 마무리해요.',
            done: () => countChars(conclusion) >= PRACTICE_MIN,
            required: true,
            praise: '결론 완성!',
            cta: { label: '예시 입력하기', onClick: () => typewrite(PRACTICE.conclusion, setConclusion, typeTimers) },
            skipIf: () => step >= 3,
        },
        {
            target: 'fairy-btn',
            title: '막히면 글쓰기 요정에게!',
            body: '이 버튼을 누르면 요정에게 물어볼 수 있어요. 요정은 대신 써 주지 않고, 스스로 생각하도록 도와줘요.',
            cta: { label: '요정에게 물어보기', onClick: () => setChatOpen(true) },
            skipIf: () => step >= 3,
        },
        {
            target: 'next-btn',
            title: '⑨ 다 썼으면 다음!',
            body: <>서론·본론·결론을 다 썼으면 <b>다음</b>을 눌러 마지막 단계로 가요.</>,
            action: true,
            allowOutside: true,
            done: () => step >= 3,
            praise: '마지막 단계예요!',
        },
        {
            target: 'final-text',
            title: '⑩ 틀린 글자를 찾아라!',
            body: (
                <>
                    서론·본론·결론이 한 글로 합쳐졌어요. 그런데 <b>마지막 문장</b>에 틀린 글자가 하나 숨어 있어요. 찾아서 고쳐 보세요!
                </>
            ),
            done: () => !!finalFullText && !finalFullText.includes(PRACTICE.typo),
            required: true,
            praise: '틀린 글자를 고쳤어요! 소리 내어 읽으면 잘 보여요',
            cta: { label: '힌트: 고쳐 주기', onClick: () => setFinalFullText((t) => t.replace(PRACTICE.typo, PRACTICE.fix)) },
        },
        {
            target: 'submit-btn',
            title: '⑪ 글 올리기로 완성!',
            body: (
                <>
                    진짜로 쓸 때는 이 버튼을 누르면 친구들이 읽을 수 있어요. 받은 <b>수정 코드</b>는 꼭 적어 두세요.
                    <br />
                    <span className="text-ink-500">연습 글은 사라지고, 이제 내 글을 쓸 차례예요!</span>
                </>
            ),
        },
    ];

    return (
        <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-32 pt-6 sm:px-6">
            {/* 상단 */}
            <div className="mb-5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={handleExit} className="-ml-2">
                        {isEditMode ? '수정 그만하기' : '목록으로'}
                    </Button>
                    <Button variant="sun" size="sm" icon={<BookOpen className="size-4" />} onClick={() => setModelOpen(true)} data-tour="model-btn">
                        예시 글 보기
                    </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-500">
                    {practice ? (
                        <Badge tone="sun">따라하기 연습 중 · 저장되지 않아요</Badge>
                    ) : savedAt ? (
                        <span className="inline-flex items-center gap-1" title="이 기기에 자동으로 저장돼요">
                            <CloudCheck className="size-4 text-leaf-500" /> 임시저장됨 · {relativeTime(savedAt)}
                        </span>
                    ) : (
                        <span>쓰는 내용은 자동으로 임시저장돼요</span>
                    )}
                    {savedAt && !practice && (
                        <button type="button" onClick={discardDraft} className="font-medium text-ink-400 underline-offset-2 hover:text-rose-600 hover:underline">
                            새로 쓰기
                        </button>
                    )}
                </div>
            </div>

            {/* 단계 표시 */}
            <nav aria-label="글쓰기 단계" className="mb-6">
                <ol className="grid grid-cols-3 gap-2">
                    {STEPS.map((s) => {
                        const done = s.n < step;
                        const current = s.n === step;
                        return (
                            <li key={s.n}>
                                <button
                                    type="button"
                                    onClick={() => (s.n < step ? goTo(s.n) : s.n === step + 1 ? goTo(s.n) : undefined)}
                                    disabled={s.n > step + 1}
                                    aria-current={current ? 'step' : undefined}
                                    className="group w-full text-left disabled:cursor-default"
                                >
                                    <span className={cx('block h-1.5 rounded-full transition-colors', done || current ? 'bg-brand-600' : 'bg-ink-900/10')} />
                                    <span className={cx('mt-2 flex items-center gap-1.5 text-sm font-semibold', current ? 'text-ink-900' : done ? 'text-brand-600' : 'text-ink-400')}>
                                        <span
                                            className={cx(
                                                'flex size-5 items-center justify-center rounded-full text-[11px]',
                                                done ? 'bg-brand-600 text-white' : current ? 'bg-ink-900 text-white' : 'bg-ink-900/10 text-ink-500',
                                            )}
                                        >
                                            {done ? <Check className="size-3" /> : s.n}
                                        </span>
                                        <span className="hidden sm:inline">{s.title}</span>
                                        <span className="sm:hidden">{s.short}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <Card className="animate-rise" key={step}>
                {step === 1 && (
                    <section>
                        <StepHeading
                            eyebrow="1단계"
                            title="어떤 주장을 하고 싶나요?"
                            desc={'"~해야 한다", "~하자"처럼 내 생각이 또렷하게 드러나게 적어 보세요.'}
                        />
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                            <Input
                                aria-label="주제"
                                value={topic}
                                maxLength={300}
                                onChange={(e) => setTopic(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && goTo(2)}
                                placeholder="예: 초등학생도 스마트폰 사용 시간을 스스로 정해야 한다"
                                className="h-13 text-base"
                                data-tour="topic-input"
                            />
                            <Button variant="sun" size="lg" loading={refining} onClick={handleRefine} icon={<Sparkles className="size-5" />} className="shrink-0" data-tour="ai-refine">
                                AI에게 다듬기
                            </Button>
                        </div>

                        {refining && <p className="mt-4 text-sm text-ink-500">글쓰기 요정이 더 좋은 주장을 찾고 있어요…</p>}

                        {suggestions && (
                            <div className="mt-6 animate-rise" data-tour="suggestions">
                                <p className="mb-2 text-sm font-semibold text-ink-700">마음에 드는 주제를 눌러서 고를 수 있어요</p>
                                <div className="space-y-2">
                                    {[suggestions.refined, ...suggestions.others].filter(Boolean).map((s, i) => {
                                        const chosen = topic === s;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setTopic(s)}
                                                className={cx(
                                                    'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                                                    chosen ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-100' : 'border-line bg-white hover:border-brand-200 hover:bg-brand-50/50',
                                                )}
                                            >
                                                <span className={cx('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border', chosen ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300')}>
                                                    {chosen && <Check className="size-3" />}
                                                </span>
                                                <span>
                                                    <span className="block font-semibold text-ink-900">{s}</span>
                                                    {i === 0 && <span className="text-xs text-ink-500">내 주제를 다듬었어요</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <Tip>
                            좋은 주장은 <b>한 문장</b>이고, 읽는 사람이 <b>찬성이나 반대</b>를 할 수 있어요. "스마트폰은 좋다"보다 "쉬는 시간에는 스마트폰을 쓰지 말자"가 더 또렷해요.
                        </Tip>
                    </section>
                )}

                {step === 2 && (
                    <section className="space-y-8">
                        <StepHeading eyebrow="2단계" title="서론 · 본론 · 결론 쓰기" desc={<span className="font-semibold text-brand-700">“{topic}”</span>} />

                        <div data-tour="intro-field">
                            <PartLabel title="서론" hint="문제 상황과 나의 주장을 밝혀요" count={introLen} min={minIntro} showRemaining={showRemaining} />
                            <Textarea
                                aria-label="서론"
                                value={introduction}
                                onChange={(e) => setIntroduction(e.target.value)}
                                placeholder="요즘 우리 반에서는 … 한 일이 자주 일어납니다. 그래서 저는 … 해야 한다고 생각합니다."
                                className="min-h-36"
                            />
                        </div>

                        <div>
                            <PartLabel title="본론" hint="주장을 뒷받침하는 근거와 그 출처를 적어요" />
                            <div className="space-y-3">
                                {body.map((part, i) => (
                                    <div key={i} className="rounded-2xl bg-paper p-4 ring-1 ring-line/60" data-tour={i === 0 ? 'body-0' : undefined}>
                                        <div className="mb-2 flex items-center justify-between">
                                            <Badge tone="brand">근거 {i + 1}</Badge>
                                            {body.length > 1 && (
                                                <IconButton label={`근거 ${i + 1} 지우기`} tone="danger" onClick={() => removePart(i)} className="size-8">
                                                    <Trash2 className="size-4" />
                                                </IconButton>
                                            )}
                                        </div>
                                        <Textarea
                                            aria-label={`근거 ${i + 1}`}
                                            value={part.reason}
                                            onChange={(e) => updatePart(i, 'reason', e.target.value)}
                                            placeholder={i === 0 ? '첫째, … 때문입니다. 예를 들어 …' : `${['둘', '셋', '넷', '다섯'][i - 1] || i + 1}째, …`}
                                            className="min-h-28 bg-white"
                                        />
                                        <div className="relative mt-2">
                                            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
                                            <Input
                                                aria-label={`근거 ${i + 1} 출처`}
                                                value={part.source}
                                                onChange={(e) => updatePart(i, 'source', e.target.value)}
                                                placeholder="출처: 뉴스 기사 주소, 책 이름, 설문 결과, 내 경험 등"
                                                className={cx('pl-9 text-sm', part.reason.trim() && !part.source.trim() && 'border-sun-400')}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {body.length < 10 && (
                                <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setBody([...body, { reason: '', source: '' }])} className="mt-3 border-dashed" data-tour="add-reason">
                                    근거 추가하기
                                </Button>
                            )}
                        </div>

                        <div data-tour="conclusion-field">
                            <PartLabel title="결론" hint="내용을 정리하고 주장을 한 번 더 강조해요" count={conclLen} min={minConcl} showRemaining={showRemaining} />
                            <Textarea
                                aria-label="결론"
                                value={conclusion}
                                onChange={(e) => setConclusion(e.target.value)}
                                placeholder="지금까지 … 을 살펴보았습니다. 그러므로 우리는 … 해야 합니다."
                                className="min-h-32"
                            />
                        </div>
                    </section>
                )}

                {step === 3 && (
                    <section>
                        <StepHeading eyebrow="3단계" title="마지막으로 다듬어요" desc="소리 내어 읽어 보고, 어색한 문장이나 틀린 글자를 고쳐 보세요." />
                        <div className="mt-6 rounded-2xl bg-paper px-5 py-4">
                            <p className="text-lg font-bold text-ink-900">{topic}</p>
                            <p className="mt-1 text-sm text-ink-500">{studentLabel(student)}</p>
                        </div>
                        <div className="mt-4" data-tour="final-text">
                            <div className="mb-1.5 flex justify-end text-xs text-ink-500">{countChars(finalFullText)}자</div>
                            <Textarea aria-label="완성된 글" value={finalFullText} onChange={(e) => setFinalFullText(e.target.value)} className="min-h-96 text-base leading-8" />
                        </div>
                        {body.some((b) => b.source.trim()) && (
                            <div className="mt-4 rounded-2xl bg-paper px-5 py-4 text-sm">
                                <p className="mb-1 flex items-center gap-1.5 font-bold text-ink-700">
                                    <Link2 className="size-4" /> 출처
                                </p>
                                <ol className="list-decimal space-y-0.5 pl-5 text-ink-700">
                                    {body.filter((b) => b.source.trim()).map((b, i) => (
                                        <li key={i}>
                                            <Linkify text={b.source} />
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                        <Tip>
                            내 글을 친구가 읽는다고 생각해 보세요. <b>근거가 주장과 잘 이어지는지</b>, <b>같은 말을 반복하지 않았는지</b> 확인해요.
                        </Tip>
                    </section>
                )}
            </Card>

            {/* 아래 고정 이동 막대 */}
            <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={step === 1} icon={<ChevronLeft className="size-4" />}>
                        이전
                    </Button>
                    {step === 2 && (
                        <div className="hidden text-xs text-ink-500 sm:block">
                            <Check className={cx('mr-1 inline size-3.5', introLen >= minIntro ? 'text-leaf-500' : 'text-ink-300')} />서론
                            <Check className={cx('ml-3 mr-1 inline size-3.5', bodyOk ? 'text-leaf-500' : 'text-ink-300')} />근거·출처
                            <Check className={cx('ml-3 mr-1 inline size-3.5', conclLen >= minConcl ? 'text-leaf-500' : 'text-ink-300')} />결론
                        </div>
                    )}
                    {step < 3 ? (
                        <Button onClick={() => goTo(step + 1)} disabled={step === 1 && !valid[1]} data-tour="next-btn">
                            다음 <ChevronRight className="size-4" />
                        </Button>
                    ) : (
                        <Button variant="success" onClick={handleSubmit} loading={submitting} disabled={!valid[3]} icon={<Check className="size-4" />} data-tour="submit-btn">
                            {isEditMode ? '수정 완료' : '글 올리기'}
                        </Button>
                    )}
                </div>
            </div>

            {/* AI 도우미 */}
            <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="no-print fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-ink-900 py-3 pl-3.5 pr-4 text-sm font-semibold text-white shadow-lift transition-transform hover:-translate-y-0.5 sm:right-6"
                aria-label="AI 글쓰기 요정에게 물어보기"
                data-tour="fairy-btn"
            >
                <Bot className="size-5 text-sun-400" />
                <span className="hidden sm:inline">글쓰기 요정</span>
            </button>
            <ModelEssayModal open={modelOpen} onClose={() => setModelOpen(false)} />
            <Tour steps={tourSteps} running={tour.running} startAt={tour.startAt} onFinish={tour.finish} finishLabel="내 글 쓰러 가기!" />
            <ChatPanel
                open={chatOpen}
                onClose={() => setChatOpen(false)}
                context={{
                    topic,
                    introduction,
                    body: body.map((p) => `근거: ${p.reason}\n출처: ${p.source}`).join('\n\n'),
                    conclusion,
                }}
                grade={student.grade}
                step={step}
                practice={practice}
            />
        </div>
    );
};

// ---------- 작은 조각들 ----------

const StepHeading: React.FC<{ eyebrow: string; title: string; desc?: React.ReactNode }> = ({ eyebrow, title, desc }) => (
    <div>
        <p className="text-sm font-bold text-brand-600">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {desc && <p className="mt-2 text-[15px] text-ink-500">{desc}</p>}
    </div>
);

const PartLabel: React.FC<{ title: string; hint: string; count?: number; min?: number; showRemaining?: boolean }> = ({
    title,
    hint,
    count,
    min,
    showRemaining = true,
}) => (
    <div className="mb-2 flex items-end justify-between gap-3">
        <div>
            <h2 className="text-lg font-bold text-ink-900">{title}</h2>
            <p className="text-xs text-ink-500">{hint}</p>
        </div>
        {count !== undefined && min !== undefined && <CharGoal count={count} min={min <= 1 ? 0 : min} showRemaining={showRemaining} />}
    </div>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mt-8 flex gap-3 rounded-2xl bg-sun-50 px-4 py-3.5 text-sm leading-relaxed text-ink-700">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-sun-600" />
        <p>{children}</p>
    </div>
);

// ---------- AI 글쓰기 요정 ----------

const QUICK_QUESTIONS: Record<number, string[]> = {
    1: ['주장하는 글 주제는 어떻게 정해요?', '내 주제가 너무 넓은지 봐 주세요'],
    2: ['서론은 어떻게 시작하면 좋아요?', '근거를 하나 더 찾고 싶어요', '내 근거가 주장과 잘 맞나요?'],
    3: ['결론을 더 힘 있게 쓰고 싶어요', '어색한 문장이 있는지 봐 주세요'],
};

const ChatPanel: React.FC<{
    open: boolean;
    onClose: () => void;
    context: { topic: string; introduction: string; body: string; conclusion: string };
    grade: string;
    step: number;
    practice?: boolean;
}> = ({ open, onClose, context, grade, step, practice }) => {
    const [history, setHistory] = useState<ChatMessage[]>([
        { role: 'assistant', content: '안녕하세요! 저는 글쓰기 요정이에요. 글을 대신 써 주지는 않지만, 막히는 부분이 있으면 같이 생각해 볼게요.' },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, loading]);

    useEffect(() => {
        if (!open) return;
        const t = window.setTimeout(() => inputRef.current?.focus(), 50);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => {
            window.clearTimeout(t);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    const send = async (text: string) => {
        const q = text.trim();
        if (!q || loading) return;
        setHistory((h) => [...h, { role: 'user', content: q }]);
        setInput('');
        setLoading(true);
        if (practice) {
            // 연습에서는 미리 정해 둔 답변
            window.setTimeout(() => {
                setHistory((h) => [...h, { role: 'assistant', content: PRACTICE.chat.answers[step] || PRACTICE.chat.default }]);
                setLoading(false);
            }, 900);
            return;
        }
        try {
            const answer = await getWritingAssistantResponse(context, q, grade, step);
            setHistory((h) => [...h, { role: 'assistant', content: answer }]);
        } catch (err: any) {
            setHistory((h) => [...h, { role: 'error', content: err?.message || '답을 만들지 못했어요. 잠시 뒤 다시 물어봐 주세요.' }]);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-ink-900/30 animate-fade" onMouseDown={onClose}>
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="AI 글쓰기 요정"
                onMouseDown={(e) => e.stopPropagation()}
                className="flex h-full w-full max-w-md flex-col bg-white shadow-lift animate-rise"
            >
                <header className="flex items-center justify-between border-b border-line/70 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-ink-900 text-sun-400">
                            <Bot className="size-5" />
                        </span>
                        <div>
                            <p className="font-bold text-ink-900">글쓰기 요정</p>
                            <p className="text-xs text-ink-500">지금 쓰는 글을 보고 도와줘요</p>
                        </div>
                    </div>
                    <IconButton label="닫기" onClick={onClose}>
                        <X className="size-5" />
                    </IconButton>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto bg-paper/60 px-4 py-5">
                    {history.map((m, i) => (
                        <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                            <div
                                className={cx(
                                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
                                    m.role === 'user' && 'rounded-br-md bg-brand-600 text-white',
                                    m.role === 'assistant' && 'rounded-bl-md bg-white text-ink-900 ring-1 ring-line/70',
                                    m.role === 'error' && 'rounded-bl-md bg-rose-50 text-rose-600',
                                )}
                            >
                                <Linkify text={m.content} />
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3.5 ring-1 ring-line/70" aria-label="생각하는 중">
                                {[0, 150, 300].map((d) => (
                                    <span key={d} className="size-2 animate-bounce rounded-full bg-ink-300" style={{ animationDelay: `${d}ms` }} />
                                ))}
                            </div>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                <div className="border-t border-line/70 p-3">
                    <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                        {(QUICK_QUESTIONS[step] || []).map((q) => (
                            <button
                                key={q}
                                type="button"
                                onClick={() => send(q)}
                                disabled={loading}
                                className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            send(input);
                        }}
                        className="flex items-center gap-2"
                    >
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            maxLength={1000}
                            placeholder="궁금한 점을 물어보세요"
                            aria-label="질문"
                            disabled={loading}
                        />
                        <Button type="submit" disabled={loading || !input.trim()} className="size-11 shrink-0 !px-0" aria-label="보내기">
                            <Send className="size-4" />
                        </Button>
                    </form>
                </div>
            </aside>
        </div>
    );
};
