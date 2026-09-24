import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * AUDIT-11 U3: one shared dialog manager.
 *
 * Every dialog used to install its own capture-phase `keydown` listener on
 * `window`, and `stopPropagation` does not stop other listeners on the *same*
 * node — so Escape in the command palette also closed the tribute sheet under
 * it, and focus fell to `<body>`. Now there is exactly one window listener and
 * a module-level stack: only the topmost layer handles Escape and Tab.
 *
 * A layer is either a modal (focus trap, `inert` background, body scroll lock)
 * or a light popover (Escape only). Popovers inside a modal close first.
 */
type Layer = {
    id: number;
    modal: boolean;
    panel: () => HTMLElement | null;
    close: () => void;
};

const stack: Layer[] = [];
let nextId = 1;
let listening = false;
const inerted = new Set<HTMLElement>();
let savedOverflow: string | null = null;

function topModal(): Layer | undefined {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].modal) return stack[i];
    return undefined;
}

/** `inert` every sibling on the path from the top modal's panel up to <body>. */
function applyInert() {
    inerted.forEach(el => el.removeAttribute('inert'));
    inerted.clear();
    const modal = topModal();
    const panel = modal?.panel();
    if (!panel) return;
    let node: HTMLElement | null = panel;
    while (node && node !== document.body) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) break;
        for (const sib of Array.from(parent.children)) {
            if (sib === node || !(sib instanceof HTMLElement)) continue;
            if (sib.hasAttribute('inert')) continue;
            // Live regions must keep speaking while a dialog is up.
            if (sib.getAttribute('aria-live') || sib.id === 'app-announcer') continue;
            sib.setAttribute('inert', '');
            inerted.add(sib);
        }
        node = parent;
    }
}

function applyScrollLock() {
    const locked = stack.some(l => l.modal);
    const root = document.documentElement;
    if (locked && savedOverflow === null) {
        savedOverflow = root.style.overflow;
        root.style.overflow = 'hidden';
    } else if (!locked && savedOverflow !== null) {
        root.style.overflow = savedOverflow;
        savedOverflow = null;
    }
}

function onKeyDown(e: KeyboardEvent) {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        top.close();
        return;
    }
    if (e.key !== 'Tab' || !top.modal) return;
    const panel = top.panel();
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.offsetParent !== null || n === document.activeElement);
    if (nodes.length === 0) { e.preventDefault(); panel.focus(); return; }
    const head = nodes[0];
    const tail = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active)) { e.preventDefault(); head.focus(); }
    else if (e.shiftKey && active === head) { e.preventDefault(); tail.focus(); }
    else if (!e.shiftKey && active === tail) { e.preventDefault(); head.focus(); }
}

function sync() {
    if (stack.length && !listening) {
        window.addEventListener('keydown', onKeyDown, true);
        listening = true;
    } else if (!stack.length && listening) {
        window.removeEventListener('keydown', onKeyDown, true);
        listening = false;
    }
    applyInert();
    applyScrollLock();
}

/** Push a layer; returns the function that pops it. */
export function pushLayer(layer: Omit<Layer, 'id'>): () => void {
    const entry: Layer = { ...layer, id: nextId++ };
    stack.push(entry);
    sync();
    return () => {
        const i = stack.findIndex(l => l.id === entry.id);
        if (i >= 0) stack.splice(i, 1);
        sync();
    };
}

/** True while any modal dialog is open — global key handlers stand down. */
export function isDialogOpen(): boolean {
    return stack.some(l => l.modal);
}

/**
 * Escape-only layer for popovers (Explainer, playback menu). Active while
 * `open` is true; the latest `onClose` is read through a ref.
 */
export function useEscapeLayer(open: boolean, onClose: () => void) {
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; });
    useEffect(() => {
        if (!open) return;
        return pushLayer({ modal: false, panel: () => null, close: () => closeRef.current() });
    }, [open]);
}

/**
 * The things every modal dialog owes the keyboard: move focus in on open,
 * keep Tab inside, close on Escape (topmost only), make the page behind inert
 * and unscrollable, and put focus back where it was — if that element is
 * still in the document — on close.
 *
 * The effect runs on mount and unmount only; `onClose` is read through a ref
 * so re-renders of the parent never bounce focus.
 */
export function useDialogFocus<T extends HTMLElement>(onClose: () => void) {
    const panelRef = useRef<T>(null);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; });

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
        const pop = pushLayer({ modal: true, panel: () => panelRef.current, close: () => closeRef.current() });
        (first ?? panel)?.focus();
        return () => {
            pop();
            if (previouslyFocused && previouslyFocused.isConnected && previouslyFocused !== document.body) {
                previouslyFocused.focus();
            } else {
                // The opener is gone: land on the main region, not <body>.
                document.getElementById('main-content')?.focus({ preventScroll: true });
            }
        };
    }, []);
    return panelRef;
}
