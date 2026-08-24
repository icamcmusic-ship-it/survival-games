import React from 'react';
import { Tribute } from '../models/types';
import { BODY_SITES, severityOf } from './TributeSummary';

const SEVERITY_LABEL = ['unhurt', 'bruised', 'hurt', 'broken'];
const SEVERITY_COLOR = [
    'var(--paper-flush)',
    'color-mix(in srgb, var(--cat-training) 45%, var(--paper-flush))',
    'color-mix(in srgb, var(--cat-injury) 60%, var(--paper-flush))',
    'var(--cat-death)',
];

/**
 * A5: injuries as a figure rather than a list of booleans-with-adjectives.
 *
 * `injurySeverity` is graded 0-3 per site and rendered as a row of chips, so
 * the reader had to parse four short strings to answer "how bad is it, and
 * where". Forty lines of SVG answers it at a glance, and the list stays below
 * for anyone who wants the exact words.
 */
export function BodyDiagram({ tribute }: { tribute: Tribute }) {
    const fill = (site: (typeof BODY_SITES)[number]) => SEVERITY_COLOR[Math.min(3, severityOf(tribute, site))];
    const label = (site: (typeof BODY_SITES)[number]) =>
        `${site}: ${SEVERITY_LABEL[Math.min(3, severityOf(tribute, site))]}`;

    const stroke = 'var(--ink)';
    // §2.2: `favouring` and `scars` were tracked, read by the engine's own
    // threat assessment, and drawn nowhere — so the two most *legible* things
    // about a hurt tribute at fifty yards were invisible on the diagram of
    // exactly that. A favoured limb gets a heavy outline; a scarred site gets a
    // hatch; and §3.1's handedness decides which arm the wound is drawn on.
    const favouring = tribute.favouring;
    const scarred = (site: (typeof BODY_SITES)[number]) => tribute.scars?.[site] === true;
    const outline = (site: (typeof BODY_SITES)[number]) => (favouring === site ? 'var(--red)' : stroke);
    const outlineWidth = (site: (typeof BODY_SITES)[number]) => (favouring === site ? 3 : 1.5);
    const woundedSide = tribute.woundedSide ?? (tribute.handedness ?? 'right');
    const armFill = (side: 'left' | 'right') =>
        // Only the hurt arm is tinted once a side is known; the other one is sound.
        tribute.injuries.arms && side !== woundedSide ? SEVERITY_COLOR[0] : fill('arms');

    const summary = BODY_SITES.map(label).join(', ')
        + (favouring ? `, favouring their ${favouring}` : '')
        + (BODY_SITES.some(scarred) ? `, scarred ${BODY_SITES.filter(scarred).join(' and ')}` : '');

    return (
        <svg
            viewBox="0 0 60 110"
            width="70"
            height="128"
            className="flex-none"
            role="img"
            aria-label={`Injury map — ${summary}`}
        >
            <defs>
                {/* A scar is old damage: hatched rather than tinted, so it never
                    reads as a fresh wound. */}
                <pattern id="scar-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink)" strokeWidth="1" opacity="0.45" />
                </pattern>
            </defs>
            {/* head */}
            <circle cx="30" cy="13" r="10" fill={fill('head')} stroke={outline('head')} strokeWidth={outlineWidth('head')}>
                <title>{label('head')}{scarred('head') ? ' (scarred)' : ''}</title>
            </circle>
            {scarred('head') && <circle cx="30" cy="13" r="10" fill="url(#scar-hatch)" stroke="none" pointerEvents="none" />}
            {/* torso */}
            <rect x="19" y="26" width="22" height="34" fill={fill('torso')} stroke={outline('torso')} strokeWidth={outlineWidth('torso')}>
                <title>{label('torso')}{scarred('torso') ? ' (scarred)' : ''}</title>
            </rect>
            {scarred('torso') && <rect x="19" y="26" width="22" height="34" fill="url(#scar-hatch)" stroke="none" pointerEvents="none" />}
            {/* arms — drawn asymmetrically once we know which one took it */}
            <rect x="7" y="28" width="10" height="30" fill={armFill('left')} stroke={outline('arms')} strokeWidth={outlineWidth('arms')}>
                <title>{label('arms')}{woundedSide === 'left' && tribute.injuries.arms ? ' (left)' : ''}{tribute.handedness === 'left' ? ' — their weapon hand' : ''}</title>
            </rect>
            <rect x="43" y="28" width="10" height="30" fill={armFill('right')} stroke={outline('arms')} strokeWidth={outlineWidth('arms')}>
                <title>{label('arms')}{woundedSide === 'right' && tribute.injuries.arms ? ' (right)' : ''}{(tribute.handedness ?? 'right') === 'right' ? ' — their weapon hand' : ''}</title>
            </rect>
            {scarred('arms') && (
                <g pointerEvents="none">
                    <rect x="7" y="28" width="10" height="30" fill="url(#scar-hatch)" stroke="none" />
                    <rect x="43" y="28" width="10" height="30" fill="url(#scar-hatch)" stroke="none" />
                </g>
            )}
            {/* legs */}
            <rect x="20" y="63" width="9" height="40" fill={fill('legs')} stroke={outline('legs')} strokeWidth={outlineWidth('legs')}>
                <title>{label('legs')}{scarred('legs') ? ' (scarred)' : ''}</title>
            </rect>
            <rect x="31" y="63" width="9" height="40" fill={fill('legs')} stroke={outline('legs')} strokeWidth={outlineWidth('legs')}>
                <title>{label('legs')}{scarred('legs') ? ' (scarred)' : ''}</title>
            </rect>
            {scarred('legs') && (
                <g pointerEvents="none">
                    <rect x="20" y="63" width="9" height="40" fill="url(#scar-hatch)" stroke="none" />
                    <rect x="31" y="63" width="9" height="40" fill="url(#scar-hatch)" stroke="none" />
                </g>
            )}
            {/* Bleeding is a rate rather than a site: a mark, not a tint. */}
            {tribute.injuries.bleeding && (
                <g>
                    <circle cx="47" cy="66" r="3.5" fill="var(--cat-death)" />
                    <title>bleeding</title>
                </g>
            )}
        </svg>
    );
}
