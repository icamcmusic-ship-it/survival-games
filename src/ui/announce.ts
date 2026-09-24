/**
 * AUDIT-11 U17: one app-level live region.
 *
 * Shortcut announcements used to be written into a live region owned by the
 * arena screen, so any shortcut that also switched view (C, `[`, `]`) unmounted
 * the region before a screen reader could speak it. `App` renders
 * `#app-announcer` once and it never unmounts.
 */
let clearTimer: ReturnType<typeof setTimeout> | undefined;

export function announce(message: string) {
    const el = typeof document !== 'undefined' ? document.getElementById('app-announcer') : null;
    if (!el) return;
    // Clear first so an identical repeated message is re-announced.
    el.textContent = '';
    window.setTimeout(() => { el.textContent = message; }, 30);
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}
