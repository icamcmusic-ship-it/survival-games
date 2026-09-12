import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The four things every modal dialog owes the keyboard, in one hook: move
 * focus in on open, keep Tab inside, close on Escape, put focus back where
 * it was on close. `TributeModal` did all four inline; `TributeCompare`,
 * `SettingsPanel` and the help overlay each did somewhere between none and
 * two, and the compare view — which the arena's own key handler stands down
 * for while a tribute is selected — could not be closed with Escape at all.
 */
export function useDialogFocus<T extends HTMLElement>(onClose: () => void) {
    const panelRef = useRef<T>(null);
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panel)?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !panel) return;
            const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (nodes.length === 0) return;
            const head = nodes[0];
            const tail = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
            else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previouslyFocused?.focus();
        };
    }, [onClose]);
    return panelRef;
}
