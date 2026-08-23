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
    const summary = BODY_SITES.map(label).join(', ');

    return (
        <svg
            viewBox="0 0 60 110"
            width="70"
            height="128"
            className="flex-none"
            role="img"
            aria-label={`Injury map — ${summary}`}
        >
            {/* head */}
            <circle cx="30" cy="13" r="10" fill={fill('head')} stroke={stroke} strokeWidth="1.5">
                <title>{label('head')}</title>
            </circle>
            {/* torso */}
            <rect x="19" y="26" width="22" height="34" fill={fill('torso')} stroke={stroke} strokeWidth="1.5">
                <title>{label('torso')}</title>
            </rect>
            {/* arms */}
            <rect x="7" y="28" width="10" height="30" fill={fill('arms')} stroke={stroke} strokeWidth="1.5">
                <title>{label('arms')}</title>
            </rect>
            <rect x="43" y="28" width="10" height="30" fill={fill('arms')} stroke={stroke} strokeWidth="1.5">
                <title>{label('arms')}</title>
            </rect>
            {/* legs */}
            <rect x="20" y="63" width="9" height="40" fill={fill('legs')} stroke={stroke} strokeWidth="1.5">
                <title>{label('legs')}</title>
            </rect>
            <rect x="31" y="63" width="9" height="40" fill={fill('legs')} stroke={stroke} strokeWidth="1.5">
                <title>{label('legs')}</title>
            </rect>
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
