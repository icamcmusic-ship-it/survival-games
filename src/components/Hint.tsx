import React, { useId } from 'react';

/**
 * Audit 3 §2.1: a hint that a keyboard or a phone can actually read.
 *
 * 141 `title=` attributes were counted across the components and screens, and
 * for a lot of controls the `title` was the only place the explanation lived —
 * `SettingsPanel` put the description of what each setting *does* in one.
 *
 * A native tooltip appears on mouse hover and nowhere else. It does not open on
 * keyboard focus. It does not appear on touch at all, so on a phone — a screen
 * this app supports and tests at 380px — every one of those hints was simply
 * invisible. And where the element already has an accessible name, most screen
 * readers will not announce the `title` either, so it was invisible to the one
 * audience most likely to need it.
 *
 * This is the same idea `Explainer` implements for *values*, cut down for
 * *controls*: the child keeps its own accessible name and gains a description,
 * the description is real DOM (so a screen reader reaches it), and it is shown
 * on hover and on focus-within alike. Nothing here is click-to-open, because a
 * control that is already a button cannot host a second button.
 *
 *   <Hint text="Units, sound and brakes back to defaults">
 *       <button className="btn">Reset</button>
 *   </Hint>
 */
export function Hint({ text, children, align = 'left', className = '' }: {
    /** The explanation. Plain text — this is a description, not a panel. */
    text: string;
    /** Exactly one interactive element. */
    children: React.ReactElement;
    align?: 'left' | 'right';
    className?: string;
}) {
    const id = useId();
    const described = React.cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': id,
    });
    return (
        <span className={`hint-wrap relative inline-flex ${className}`}>
            {described}
            {/*
              Always in the DOM so `aria-describedby` resolves whether or not it
              is visible; `.hint-bubble` in index.css keeps it out of the layout
              until the wrapper is hovered or holds focus. `role="tooltip"` and
              no tab stop: it is a description of the control, not a thing to
              land on.
            */}
            <span
                id={id}
                role="tooltip"
                className={`hint-bubble ${align === 'right' ? 'right-0' : 'left-0'}`}
            >
                {text}
            </span>
        </span>
    );
}
