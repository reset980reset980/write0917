import React, { useState } from 'react';
import { BookOpen, Check, Link2 } from 'lucide-react';
import { MODEL_ESSAY, type ModelTag } from '../modelEssay';
import { Badge, Modal, Switch, cx } from './ui';
import { countChars } from '../utils';

const TAG_STYLE: Record<ModelTag, { bg: string; chip: string }> = {
    '문제 상황': { bg: 'bg-sun-50', chip: 'bg-sun-100 text-sun-600' },
    주장: { bg: 'bg-brand-50', chip: 'bg-brand-600 text-white' },
    근거: { bg: 'bg-brand-50', chip: 'bg-brand-100 text-brand-700' },
    뒷받침: { bg: 'bg-ink-900/[0.03]', chip: 'bg-ink-900/10 text-ink-700' },
    출처: { bg: '', chip: 'bg-leaf-50 text-leaf-600' },
    요약: { bg: 'bg-leaf-50', chip: 'bg-leaf-50 text-leaf-600' },
    '주장 강조': { bg: 'bg-brand-50', chip: 'bg-brand-600 text-white' },
    '실천 제안': { bg: 'bg-rose-50', chip: 'bg-rose-50 text-rose-600' },
};

const PART_COLOR = { 서론: 'border-sun-400', 본론: 'border-brand-500', 결론: 'border-leaf-500' };

/** 학습용 예시 글 보기 */
export const ModelEssayModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const [showStructure, setShowStructure] = useState(true);
    const total = MODEL_ESSAY.sections.reduce((n, s) => n + countChars(s.segments.map((x) => x.text).join('')), 0);

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            title={
                <span className="flex items-center gap-2">
                    <BookOpen className="size-5 text-brand-600" /> 예시 글 살펴보기
                </span>
            }
        >
            <div className="rounded-2xl bg-sun-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
                그대로 베껴 쓰지 말고, <b>어떤 순서로 무엇을 썼는지</b> 살펴보세요. 내 주제로 바꾸어 써 보면 돼요.
            </div>

            <div className="mt-4">
                <Switch checked={showStructure} onChange={setShowStructure} label="글의 짜임 표시하기" description="문제 상황, 주장, 근거 같은 역할을 색으로 보여 줘요." />
            </div>

            <article className="mt-5 rounded-2xl border border-line/70 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="sun">예시 글</Badge>
                    <span className="text-xs text-ink-500">{total}자</span>
                </div>
                <h3 className="mt-2 text-xl font-extrabold leading-snug text-ink-900">{MODEL_ESSAY.topic}</h3>

                <div className="mt-5 space-y-4">
                    {MODEL_ESSAY.sections.map((sec, i) => (
                        <section key={i} className={cx(showStructure && `border-l-4 pl-4 ${PART_COLOR[sec.part]}`)}>
                            {showStructure && <p className="mb-1.5 text-xs font-extrabold text-ink-500">{sec.label}</p>}
                            <p className="text-[15px] leading-8 text-ink-900 indent-[1em]">
                                {sec.segments.map((seg, j) =>
                                    showStructure && seg.tag ? (
                                        <span key={j} className={cx('rounded-md px-0.5 py-0.5 box-decoration-clone', TAG_STYLE[seg.tag].bg)}>
                                            <span className={cx('mr-1 inline-block rounded-full px-1.5 align-[2px] text-[10px] font-bold leading-4 indent-0', TAG_STYLE[seg.tag].chip)}>
                                                {seg.tag}
                                            </span>
                                            {seg.text}
                                        </span>
                                    ) : (
                                        <React.Fragment key={j}>{seg.text}</React.Fragment>
                                    ),
                                )}
                            </p>
                            {sec.source && (
                                <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-500">
                                    <Link2 className="size-3.5" />
                                    {showStructure && <span className={cx('rounded-full px-1.5 text-[10px] font-bold', TAG_STYLE['출처'].chip)}>출처</span>}
                                    {sec.source}
                                </p>
                            )}
                        </section>
                    ))}
                </div>
            </article>

            <div className="mt-5 rounded-2xl bg-paper p-4">
                <p className="mb-2 text-sm font-bold text-ink-900">이 글에서 배울 점</p>
                <ul className="space-y-1.5">
                    {MODEL_ESSAY.goodPoints.map((g) => (
                        <li key={g} className="flex gap-2 text-sm leading-relaxed text-ink-700">
                            <Check className="mt-0.5 size-4 shrink-0 text-leaf-500" />
                            {g}
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
};
