import React, { useEffect, useRef, useState } from 'react';

/**
 * AUDIT-11 §4/U12: a destructive action that takes two presses.
 *
 * The first press arms it — the label changes to say what is about to be
 * lost — and the second, within a few seconds, carries it out. It disarms on
 * its own, on blur, and on Escape, so a stray tap never costs anything.
 */
export function ConfirmButton({ onConfirm, children, confirmLabel, className = 'btn btn-sm', needsConfirm = true, ariaLabel, disabled }: {
    onConfirm: () => void;
    children: React.ReactNode;
    confirmLabel: string;
    className?: string;
    /** When false the button acts on the first press (nothing to lose). */
    needsConfirm?: boolean;
    ariaLabel?: string;
    disabled?: boolean;
}) {
    const [armed, setArmed] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const disarm = () => { window.clearTimeout(timer.current); setArmed(false); };
    return (
        <button
            type="button"
            disabled={disabled}
            className={`${className}${armed ? ' btn-danger-armed' : ''}`}
            aria-label={armed ? confirmLabel : ariaLabel}
            onBlur={disarm}
            onKeyDown={e => { if (e.key === 'Escape' && armed) { e.stopPropagation(); disarm(); } }}
            onClick={() => {
                if (!needsConfirm || armed) { disarm(); onConfirm(); return; }
                setArmed(true);
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => setArmed(false), 4000);
            }}
        >
            {armed ? confirmLabel : children}
            <span className="sr-only" aria-live="polite">{armed ? ' — press again to confirm' : ''}</span>
        </button>
    );
}
