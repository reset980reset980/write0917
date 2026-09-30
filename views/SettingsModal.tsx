import React, { useEffect, useState } from 'react';
import { Check, Eye } from 'lucide-react';
import { DEFAULT_WRITING_SETTINGS, type WritingSettings } from '../types';
import { Button, Field, Input, Modal, Spinner, Switch, cx, useFeedback } from '../components/ui';
import { getWritingSettings, saveWritingSettings } from '../services/api';

const PRESETS = [100, 200, 300, 500];

/** 선생님: 글쓰기 글자 수 조건 설정 */
export const WritingSettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const [form, setForm] = useState<WritingSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const { toast } = useFeedback();

    useEffect(() => {
        if (!open) return;
        setForm(null);
        getWritingSettings().then(setForm);
    }, [open]);

    const set = <K extends keyof WritingSettings>(k: K, v: WritingSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
    const num = (v: string) => Math.max(1, Math.min(3000, Math.round(Number(v) || 0)));

    const save = async () => {
        if (!form) return;
        setSaving(true);
        try {
            setForm(await saveWritingSettings({ ...form, minIntro: num(String(form.minIntro)), minConclusion: num(String(form.minConclusion)) }));
            toast('글쓰기 설정을 저장했어요. 학생이 새로 글쓰기를 열면 바로 적용돼요.');
            onClose();
        } catch (err: any) {
            toast(err?.message || '설정을 저장하지 못했어요.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="글쓰기 설정"
            size="md"
            footer={
                <>
                    <Button variant="ghost" onClick={() => setForm({ ...DEFAULT_WRITING_SETTINGS })} disabled={!form} className="mr-auto">
                        기본값으로
                    </Button>
                    <Button variant="secondary" onClick={onClose}>
                        취소
                    </Button>
                    <Button variant="success" onClick={save} loading={saving} disabled={!form} icon={<Check className="size-4" />}>
                        저장
                    </Button>
                </>
            }
        >
            {!form ? (
                <div className="py-10 text-center">
                    <Spinner />
                </div>
            ) : (
                <div className="space-y-6">
                    <Switch
                        checked={form.requireMin}
                        onChange={(v) => set('requireMin', v)}
                        label="최소 글자 수 조건"
                        description="켜면 서론과 결론이 정한 글자 수를 넘어야 다음 단계로 갈 수 있어요. 끄면 한 글자라도 쓰면 넘어가요."
                    />

                    <div className={cx('grid gap-4 sm:grid-cols-2', !form.requireMin && 'pointer-events-none opacity-40')}>
                        {(
                            [
                                ['minIntro', '서론 최소 글자 수'],
                                ['minConclusion', '결론 최소 글자 수'],
                            ] as const
                        ).map(([key, label]) => (
                            <Field key={key} label={label} htmlFor={key} hint="공백은 빼고 세요">
                                <div className="relative">
                                    <Input
                                        id={key}
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={3000}
                                        value={form[key]}
                                        onChange={(e) => set(key, Number(e.target.value))}
                                        onBlur={(e) => set(key, num(e.target.value))}
                                        disabled={!form.requireMin}
                                        className="pr-9"
                                    />
                                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-400">자</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {PRESETS.map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => set(key, n)}
                                            disabled={!form.requireMin}
                                            className={cx(
                                                'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                                                form[key] === n ? 'bg-brand-600 text-white' : 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/10',
                                            )}
                                        >
                                            {n}자
                                        </button>
                                    ))}
                                </div>
                            </Field>
                        ))}
                    </div>

                    <div className="border-t border-line/70 pt-6">
                        <Switch
                            checked={form.showRemaining}
                            onChange={(v) => set('showRemaining', v)}
                            label="남은 글자 수 보여주기"
                            description="학생 화면에 '몇 자 더 쓰면 통과인지'와 진행 막대를 보여줘요. 끄면 지금까지 쓴 글자 수만 보여요."
                            disabled={!form.requireMin}
                        />
                    </div>

                    {/* 학생 화면 미리보기 */}
                    <div className="rounded-2xl bg-paper p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink-500">
                            <Eye className="size-3.5" /> 학생 화면 미리보기 (서론을 40자 쓴 경우)
                        </p>
                        <CharGoal count={40} min={form.requireMin ? form.minIntro : 0} showRemaining={form.requireMin && form.showRemaining} />
                    </div>
                </div>
            )}
        </Modal>
    );
};

/** 글쓰기 칸 옆 글자 수 표시 (학생 화면과 미리보기에서 함께 사용) */
export const CharGoal: React.FC<{ count: number; min: number; showRemaining: boolean }> = ({ count, min, showRemaining }) => {
    const passed = min <= 0 || count >= min;
    if (!showRemaining || min <= 0) {
        return <span className="text-xs font-semibold text-ink-500">{count}자</span>;
    }
    const left = Math.max(0, min - count);
    return (
        <div className="w-36 shrink-0 text-right" aria-live="polite">
            <span className={cx('text-xs font-bold', passed ? 'text-leaf-600' : 'text-ink-700')}>
                {passed ? (
                    <>
                        <Check className="mr-0.5 inline size-3.5" />
                        통과! ({count}자)
                    </>
                ) : (
                    <>
                        <span className="text-brand-600">{left}자</span> 더 쓰면 통과
                    </>
                )}
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink-900/10">
                <span
                    className={cx('block h-full rounded-full transition-all duration-300', passed ? 'bg-leaf-500' : 'bg-brand-500')}
                    style={{ width: `${Math.min(100, (count / min) * 100)}%` }}
                />
            </span>
            {!passed && <span className="mt-0.5 block text-[11px] text-ink-400">{count} / {min}자</span>}
        </div>
    );
};
