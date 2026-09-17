import React, { useId } from 'react';

/**
 * Audit 4 §2.2: a gloss on a *value* that a phone and a screen reader can read.
 *
 * `Hint` (Audit 3 §2.1) solved this for controls: a button already has an
 * accessible name, so the explanation becomes its description, in real DOM,
 * revealed on hover and focus-within. It cannot solve it for the other
 * two-thirds of the problem, because a `<span>` showing a number has no
 * accessible name, takes no focus, and therefore never triggers
 * `:focus-within` at all.
 *
 * A census found **94** real HTML `title=` attributes across the components and
 * screens — the audit's own figure of 47 was a `grep 'title="'` that missed
 * every `title={...}`. 31 sit on controls, which `test:ui-affordances` already
 * ratchets. The other 63 sit on spans, divs and table cells, where `title` is
 * the *only* statement of what a number means, and where it is invisible on
 * touch, invisible to the keyboard, and usually unannounced.
 *
 * So: the description is real DOM, so a screen reader reaches it via
 * `aria-describedby`; the span takes focus, so the keyboard and a tap both
 * reveal it; and it is not a button, because it does nothing when activated —
 * it is a label with a footnote, which is exactly what `title` was pretending
 * to be.
 *
 * Distinct from `Explainer`, which is a click-to-open panel with a heading and
 * prose, for concepts. This is one line about one value.
 *
 *   <Glossed text="Worn weapons hit softer, not just closer to breaking.">
 *       <span>62%</span>
 *   </Glossed>
 */
export function Glossed({ text, children, align = 'left', className = '' }: {
    /** The explanation. One line — this is a footnote, not a panel. */
    text: string;
    /** The value being glossed. Must not itself be interactive. */
    children: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}) {
    const id = useId();
    return (
        <span className={`hint-wrap relative inline-flex ${className}`}>
            <span
                tabIndex={0}
                aria-describedby={id}
                className="border-b border-dotted border-[var(--color-ink-600)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--red)]"
            >
                {children}
            </span>
            {/*
              Always in the DOM so `aria-describedby` resolves whether or not it
              is visible; `.hint-bubble` in index.css keeps it out of the layout
              until the wrapper is hovered or holds focus.
            */}
            <span id={id} role="tooltip" className={`hint-bubble ${align === 'right' ? 'right-0' : 'left-0'}`}>
                {text}
            </span>
        </span>
    );
}
