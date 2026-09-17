/**
 * Audit 3 §2.1/§2.2: the two interface affordances a static check can see.
 *
 * 1. A `title=` on an interactive element is a hover-only hint. It does not
 *    open on keyboard focus, it never appears on touch — on a phone, a screen
 *    this app supports and tests at 380px, it is simply invisible — and where
 *    the element already has an accessible name most screen readers will not
 *    announce it either. `components/Hint.tsx` is the replacement: same idea,
 *    real DOM, shown on hover *and* focus, wired through `aria-describedby`.
 *
 *    The count is baselined rather than banned outright: a `title` on a
 *    *non*-interactive cell that expands a truncated value is a reasonable use,
 *    and several of the remaining ones are that. What this stops is the number
 *    going back up.
 *
 * 2. A component that renders interactive or graphical content and carries no
 *    `aria-*` or `role` at all. Four did.
 *
 *   npm run test:ui-affordances
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const problems: string[] = [];
const notes: string[] = [];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.tsx$/.test(entry) ? [full] : [];
    });
}

const files = [...walk('src/components'), ...walk('src/screens')].sort();

/**
 * Hover-only hints *on controls*, counted per file.
 *
 * Only interactive elements are counted. A `title` on a `<span>` that expands a
 * truncated value is a reasonable use of the attribute — the value is visible,
 * the title is an unabbreviation, and nothing is lost if it never opens. A
 * `title` on a button is different: it is frequently the only statement of what
 * the button does, and a phone or a keyboard never sees it.
 *
 * The ceiling is a ratchet. Lower it whenever a conversion lands; never raise it.
 */
// Audit 5 §2.3: a ceiling that has been reached has stopped ratcheting. 30 -> 21.
const TITLE_CEILING = 21;

const INTERACTIVE = /<(button|a|input|select|textarea)\b/;

/** Counts `title=` attributes that sit inside an interactive element's own tag. */
function hoverOnlyControlHints(src: string): number {
    let count = 0;
    // Walk each JSX tag opening and read its attributes up to the closing '>',
    // ignoring '>' inside braces or strings well enough for this source.
    const tagStart = /<([a-zA-Z][\w.]*)/g;
    let m: RegExpExecArray | null;
    while ((m = tagStart.exec(src)) !== null) {
        if (!INTERACTIVE.test(`<${m[1]}`)) continue;
        let depth = 0, i = m.index + m[0].length, end = -1;
        for (; i < src.length; i++) {
            const c = src[i];
            if (c === '{') depth++;
            else if (c === '}') depth--;
            else if (c === '>' && depth === 0) { end = i; break; }
        }
        if (end < 0) continue;
        if (/\btitle=/.test(src.slice(m.index, end))) count++;
    }
    return count;
}

let titles = 0;
const perFile: Array<[string, number]> = [];
files.forEach(file => {
    const n = hoverOnlyControlHints(readFileSync(file, 'utf8'));
    if (n > 0) perFile.push([file.replace('src/', ''), n]);
    titles += n;
});
perFile.sort((a, b) => b[1] - a[1]);

if (titles > TITLE_CEILING) {
    problems.push(
        `${titles} hover-only \`title=\` hints on interactive controls, over the ceiling of ${TITLE_CEILING}. `
        + 'Use `components/Hint.tsx` — a title is invisible on touch and on the keyboard.'
    );
}

/**
 * Audit 4 §2.2: hover-only hints on *values*, which the check above is
 * deliberately silent about.
 *
 * The comment on `hoverOnlyControlHints` argues that a `title` on a span is a
 * reasonable use of the attribute — "the value is visible, the title is an
 * unabbreviation, and nothing is lost if it never opens". A census found that
 * is not what most of them are. There are **63** of them (the audit's own
 * figure of 47 was a `grep 'title="'` that missed every `title={...}`), and on
 * the dossier and the standings table the `title` is frequently the only
 * statement of what a number *means* — "Steadied 4 last cycle", "Current stock
 * 40% · potential 80%" — not an unabbreviation of anything on screen.
 *
 * Those now carry `role="group"` and an `aria-label`, so the text reaches a
 * screen reader instead of sitting in an attribute most of them skip over an
 * element that already has content. Touch is still not solved for a value:
 * `components/Glossed.tsx` is the surface that does solve it, and converting
 * the rest to it is the remaining work this ratchet holds the line on.
 */
const UNNAMED_VALUE_HINT_CEILING = 0;

function hoverOnlyValueHints(src: string): number {
    let count = 0;
    const tagStart = /<([a-zA-Z][\w.]*)/g;
    let m: RegExpExecArray | null;
    while ((m = tagStart.exec(src)) !== null) {
        // Lowercase tags only: an uppercase name is a component, and `title` on
        // a component is an ordinary prop (`Explainer`, `Hint`), not the HTML
        // attribute this check is about.
        if (!/^[a-z]/.test(m[1])) continue;
        if (INTERACTIVE.test(`<${m[1]}`)) continue;
        let depth = 0, i = m.index + m[0].length, end = -1;
        for (; i < src.length; i++) {
            const c = src[i];
            if (c === '{') depth++;
            else if (c === '}') depth--;
            else if (c === '>' && depth === 0) { end = i; break; }
        }
        if (end < 0) continue;
        const attrs = src.slice(m.index, end);
        // A gloss that also states itself accessibly is fine. One that does not
        // is invisible to touch, to the keyboard and to most screen readers.
        if (/\btitle=/.test(attrs) && !/aria-label=/.test(attrs)) count++;
    }
    return count;
}

let valueHints = 0;
const perFileValues: Array<[string, number]> = [];
files.forEach(file => {
    const n = hoverOnlyValueHints(readFileSync(file, 'utf8'));
    if (n > 0) perFileValues.push([file.replace('src/', ''), n]);
    valueHints += n;
});
perFileValues.sort((a, b) => b[1] - a[1]);

if (valueHints > UNNAMED_VALUE_HINT_CEILING) {
    problems.push(
        `${valueHints} \`title=\` hints on non-interactive elements carry no accessible name, over the ceiling of ${UNNAMED_VALUE_HINT_CEILING}. `
        + 'Use `components/Glossed.tsx`, or at minimum add `role="group"` and an `aria-label`.'
    );
}

/**
 * Components with no accessibility surface at all. A file that renders nothing
 * interactive and no graphics does not need one; the list below is the set that
 * was audited and found to genuinely not need it, so a new file lands here
 * rather than being silently exempt.
 */
const NO_ARIA_EXEMPT = new Set<string>([]);

const bare: string[] = [];
files.forEach(file => {
    const src = readFileSync(file, 'utf8');
    const short = file.replace('src/', '');
    if (NO_ARIA_EXEMPT.has(short)) return;
    // Only files that actually render something a reader interacts with or
    // has to interpret: a control, or a drawing.
    const interactive = /<button|<input|<select|<textarea|onClick=|<svg/.test(src);
    if (!interactive) return;
    if (/aria-[a-z]+=|role="/.test(src)) return;
    bare.push(short);
});
bare.forEach(f => problems.push(`${f} renders controls or graphics and carries no aria-* or role at all`));

notes.push(`${files.length} component/screen files scanned`);
notes.push(`hover-only hints on controls: ${titles} (ceiling ${TITLE_CEILING}); heaviest ${perFile.slice(0, 5).map(([f, n]) => `${f} ${n}`).join(', ')}`);
notes.push(`value hints with no accessible name: ${valueHints} (ceiling ${UNNAMED_VALUE_HINT_CEILING})`
    + (perFileValues.length ? `; heaviest ${perFileValues.slice(0, 5).map(([f, n]) => `${f} ${n}`).join(', ')}` : ''));

console.log(notes.map(n => `  ${n}`).join('\n'));
if (problems.length) {
    console.log('\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n'));
    process.exit(1);
}
console.log('\nInterface affordances hold.');
