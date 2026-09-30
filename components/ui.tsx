import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, Loader2, X } from 'lucide-react';

export function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'sun';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 select-none ' +
    'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] whitespace-nowrap';

const buttonVariants: Record<ButtonVariant, string> = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
    secondary: 'bg-white text-ink-700 border border-line shadow-sm hover:border-ink-300 hover:text-ink-900',
    ghost: 'text-ink-500 hover:text-ink-900 hover:bg-ink-900/5',
    danger: 'bg-rose-500 text-white shadow-sm hover:bg-rose-600',
    success: 'bg-leaf-500 text-white shadow-sm hover:bg-leaf-600',
    sun: 'bg-sun-100 text-sun-600 hover:bg-sun-400 hover:text-white',
};

const buttonSizes: Record<ButtonSize, string> = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4 text-[15px]',
    lg: 'h-13 px-6 text-base',
};

export const Button = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: ButtonVariant;
        size?: ButtonSize;
        loading?: boolean;
        icon?: React.ReactNode;
        block?: boolean;
    }
>(({ variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest }, ref) => (
    <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], block && 'w-full', className)}
        {...rest}
    >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
        {children}
    </button>
));
Button.displayName = 'Button';

export const IconButton: React.FC<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' }
> = ({ label, tone = 'default', className, children, ...rest }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        className={cx(
            'inline-flex size-9 items-center justify-center rounded-full transition-colors',
            tone === 'danger' ? 'text-ink-400 hover:bg-rose-50 hover:text-rose-600' : 'text-ink-400 hover:bg-ink-900/5 hover:text-ink-900',
            className,
        )}
        {...rest}
    >
        {children}
    </button>
);

// ---------- Card ----------

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }> = ({
    className,
    padded = true,
    ...rest
}) => (
    <div
        className={cx('rounded-card border border-line/70 bg-white shadow-card', padded && 'p-6 sm:p-8', className)}
        {...rest}
    />
);

// ---------- Form fields ----------

const fieldBase =
    'w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink-900 placeholder:text-ink-300 ' +
    'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-paper disabled:text-ink-500';

export const Field: React.FC<{
    label: string;
    hint?: React.ReactNode;
    htmlFor?: string;
    className?: string;
    children: React.ReactNode;
    srOnlyLabel?: boolean;
}> = ({ label, hint, htmlFor, className, children, srOnlyLabel }) => (
    <div className={className}>
        <label htmlFor={htmlFor} className={cx('mb-1.5 block text-sm font-semibold text-ink-700', srOnlyLabel && 'sr-only')}>
            {label}
        </label>
        {children}
        {hint && <div className="mt-1.5 text-xs text-ink-500">{hint}</div>}
    </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...rest }, ref) => <input ref={ref} className={cx(fieldBase, 'h-11', className)} {...rest} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...rest }, ref) => (
        <textarea ref={ref} className={cx(fieldBase, 'min-h-28 resize-y py-3 leading-relaxed', className)} {...rest} />
    ),
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
    ({ className, children, ...rest }, ref) => (
        <select
            ref={ref}
            className={cx(
                fieldBase,
                'h-11 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
                "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b90a0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
                className,
            )}
            {...rest}
        >
            {children}
        </select>
    ),
);
Select.displayName = 'Select';

// ---------- Small pieces ----------

export const Badge: React.FC<{ tone?: 'brand' | 'sun' | 'leaf' | 'ink' | 'rose'; className?: string; children: React.ReactNode }> = ({
    tone = 'ink',
    className,
    children,
}) => {
    const tones = {
        brand: 'bg-brand-50 text-brand-700',
        sun: 'bg-sun-50 text-sun-600',
        leaf: 'bg-leaf-50 text-leaf-600',
        ink: 'bg-ink-900/5 text-ink-700',
        rose: 'bg-rose-50 text-rose-600',
    };
    return (
        <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
            {children}
        </span>
    );
};

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className, label = '불러오는 중' }) => (
    <span role="status" className="inline-flex items-center gap-2 text-ink-500">
        <Loader2 className={cx('animate-spin', className || 'size-5')} aria-hidden />
        <span className="sr-only">{label}</span>
    </span>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode }> = ({
    icon,
    title,
    description,
    action,
}) => (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-white/60 px-6 py-16 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
        <h3 className="text-lg font-bold text-ink-900">{title}</h3>
        {description && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
    </div>
);

/** 글자 속 URL 을 링크로 */
export const Linkify: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return (
        <>
            {parts.map((part, i) =>
                /^https?:\/\//.test(part) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-brand-600 underline underline-offset-2 hover:text-brand-700">
                        {part}
                    </a>
                ) : (
                    <React.Fragment key={i}>{part}</React.Fragment>
                ),
            )}
        </>
    );
};

// ---------- Modal ----------

export const Modal: React.FC<{
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    bodyClassName?: string;
}> = ({ open, onClose, title, children, footer, size = 'sm', bodyClassName }) => {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;
    const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-[2px] animate-fade sm:items-center sm:p-4" onMouseDown={onClose}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
                className={cx(
                    'flex max-h-[90dvh] w-full flex-col rounded-t-card bg-white shadow-lift outline-none animate-rise sm:rounded-card',
                    widths[size],
                )}
            >
                <div className="flex items-center justify-between gap-4 border-b border-line/70 px-6 py-4">
                    <h2 id={titleId} className="text-lg font-bold text-ink-900">
                        {title}
                    </h2>
                    <IconButton label="닫기" onClick={onClose}>
                        <X className="size-5" />
                    </IconButton>
                </div>
                <div className={cx('flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-line/70 px-6 py-4">{footer}</div>}
            </div>
        </div>
    );
};

// ---------- Confirm dialog (window.confirm 대체) ----------

type ConfirmOptions = { title: string; message?: React.ReactNode; confirmText?: string; tone?: 'danger' | 'primary' };
type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

// ---------- Toast ----------

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };

type FeedbackApi = {
    toast: (message: string, tone?: ToastTone) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi>({
    toast: () => {},
    confirm: async () => false,
});

export const useFeedback = () => useContext(FeedbackContext);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
    const nextId = useRef(1);

    const toast = useCallback((message: string, tone: ToastTone = 'success') => {
        const id = nextId.current++;
        setToasts((prev) => [...prev.slice(-2), { id, tone, message }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), tone === 'error' ? 5000 : 3000);
    }, []);

    const confirm = useCallback(
        (options: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
        [],
    );

    const closeConfirm = (ok: boolean) => {
        confirmState?.resolve(ok);
        setConfirmState(null);
    };

    const icons = {
        success: <CheckCircle2 className="size-5 shrink-0 text-leaf-500" />,
        error: <AlertTriangle className="size-5 shrink-0 text-rose-500" />,
        info: <Info className="size-5 shrink-0 text-brand-500" />,
    };

    return (
        <FeedbackContext.Provider value={{ toast, confirm }}>
            {children}
            <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        role={t.tone === 'error' ? 'alert' : 'status'}
                        className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-sm font-medium text-white shadow-lift animate-rise"
                    >
                        {icons[t.tone]}
                        <span className="pt-px">{t.message}</span>
                    </div>
                ))}
            </div>
            <Modal
                open={!!confirmState}
                onClose={() => closeConfirm(false)}
                title={confirmState?.title}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => closeConfirm(false)}>
                            취소
                        </Button>
                        <Button variant={confirmState?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => closeConfirm(true)} autoFocus>
                            {confirmState?.confirmText || '확인'}
                        </Button>
                    </>
                }
            >
                <div className="text-[15px] leading-relaxed text-ink-700">{confirmState?.message}</div>
            </Modal>
        </FeedbackContext.Provider>
    );
};
