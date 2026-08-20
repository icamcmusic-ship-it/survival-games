import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * The "why is this number what it is" affordance.
 *
 * Sponsor trust, excitement, stance, training score and the rest all appeared as
 * bare values with nothing anywhere telling the reader that stance is
 * auto-selected by threat assessment, or that excitement decays 12% a cycle. The
 * simulation models all of it; the interface simply never said so.
 *
 * Implemented as a real popover rather than a `title` attribute: `title` does
 * not open on keyboard focus, cannot be read by touch users at all, and cannot
 * hold the structured detail these explanations need.
 */
export function Explainer({
    label,
    title,
    children,
    className = '',
    align = 'right',
}: {
    /** The visible trigger — usually the value itself. */
    label: React.ReactNode;
    /** Heading inside the popover. */
    title: string;
    children: React.ReactNode;
    className?: string;
    align?: 'left' | 'right';
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLSpanElement>(null);
    const popoverId = useId();

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            // Scoped to this popover only: Escape inside a tribute modal must
            // close the explainer first and leave the modal alone.
            if (e.key === 'Escape' && open) {
                e.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    return (
        <span ref={wrapRef} className={`relative inline-flex ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-controls={open ? popoverId : undefined}
                className="inline-flex items-center gap-1 border-b border-dotted border-[var(--color-ink-500)] hover:border-[var(--red)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--red)]"
            >
                {label}
                <span aria-hidden="true" className="text-[9px] text-[var(--color-ink-500)]">ⓘ</span>
                <span className="sr-only">— explain {title}</span>
            </button>
            {open && (
                <span
                    id={popoverId}
                    role="dialog"
                    aria-label={title}
                    className={`absolute z-50 top-full mt-1.5 w-64 panel p-3 text-left normal-case tracking-normal animate-fadeIn ${
                        align === 'right' ? 'right-0' : 'left-0'
                    }`}
                    style={{ boxShadow: 'var(--shadow-ink-sm)' }}
                >
                    <span className="eyebrow block mb-1.5">{title}</span>
                    <span className="block text-xs leading-relaxed text-[var(--color-ink-300)] font-normal">
                        {children}
                    </span>
                </span>
            )}
        </span>
    );
}
