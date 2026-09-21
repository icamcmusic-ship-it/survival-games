/**
 * AUDIT-10 F16: one copy helper that verifies, for every control that claims
 * to have copied something.
 *
 * `ShareButton` had two different copy paths and both could report success
 * without copying:
 *
 *   - the seed chip awaited `navigator.clipboard?.writeText(seed)`, which is
 *     `await undefined` when the API is absent. That resolves, so the button
 *     ticked and said "copied" in every browser without a clipboard — which is
 *     exactly the set of browsers where the player most needed the fallback.
 *   - the URL path called `document.execCommand('copy')` and ignored the
 *     boolean it returns. A refused copy is reported as a successful one.
 *
 * Four outcomes, all distinguishable, because the UI has to do different
 * things with them:
 *
 *   - `copied`      — the text is on the clipboard.
 *   - `unavailable` — no clipboard API and no fallback path (a non-browser
 *                     host, or a document that cannot host the textarea).
 *   - `refused`     — an API was there and said no: a denied permission, a
 *                     non-user-gesture call, or `execCommand` returning false.
 *   - `failed`      — it threw.
 *
 * Everything except `copied` means the caller must expose the text as
 * selectable content instead of claiming anything.
 */
export type CopyResult = 'copied' | 'unavailable' | 'refused' | 'failed';

/** Did this actually reach the clipboard? Only one value does. */
export function copySucceeded(result: CopyResult): boolean {
    return result === 'copied';
}

/**
 * The legacy path: a hidden, read-only textarea, selected and copied.
 *
 * Kept because `navigator.clipboard` is unavailable over plain HTTP and inside
 * several embedded browsers, which are real places this game is opened from.
 * The difference from before is that its return value is read.
 */
function execCommandCopy(text: string): CopyResult {
    if (typeof document === 'undefined' || !document.body) return 'unavailable';
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    try {
        el.select();
        // Deliberately not ignored. `execCommand` returns false for a copy the
        // browser declined, and the old call site treated that as a success.
        return document.execCommand('copy') ? 'copied' : 'refused';
    } catch {
        return 'failed';
    } finally {
        document.body.removeChild(el);
    }
}

/**
 * Put `text` on the clipboard and report what actually happened.
 *
 * Never throws: every caller of this is a button, and a button that throws is
 * a white screen.
 */
export async function copyText(text: string): Promise<CopyResult> {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard?.writeText) {
        try {
            await clipboard.writeText(text);
            return 'copied';
        } catch {
            // A rejected write is usually a permissions or gesture problem, and
            // the legacy path often still works in exactly those cases.
            const fallback = execCommandCopy(text);
            return fallback === 'copied' ? 'copied' : 'refused';
        }
    }
    return execCommandCopy(text);
}

/** A short, honest sentence for a result, for an alert or a status region. */
export function copyMessage(result: CopyResult, what = 'text'): string {
    switch (result) {
        case 'copied': return `${what} copied.`;
        case 'refused': return `The browser would not let the ${what.toLowerCase()} be copied. It is selectable below.`;
        case 'unavailable': return `This browser has no clipboard available. The ${what.toLowerCase()} is selectable below.`;
        default: return `Copying the ${what.toLowerCase()} failed. It is selectable below.`;
    }
}
