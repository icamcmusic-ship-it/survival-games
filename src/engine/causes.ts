import { DamageRecord, DeathCauseCode } from '../models/types';

/**
 * AUDIT-9 (audit §"robustness"): cause codes, so telemetry stops reading English.
 *
 * The audit's closing recommendation was to "introduce structured event types
 * and cause codes, then render prose from them. Several measurements currently
 * depend on matching English text; that makes writing changes capable of
 * breaking telemetry."
 *
 * The problem is real and measured. Across 200 runs the engine produces **373
 * distinct cause-of-death strings** — "Bled out from a wound Cashmere opened",
 * "Buried in the collapse of The Bone Hoppers", "Torn apart by Pan Scuttlers"
 * — and six separate files each re-implement their own regexes over them:
 * `achievements.ts` greps for `nightlock`, `collapsing border|border closed`,
 * `drown|tide|undertow|rip ?tide` and `^Killed by`; `metrics.ts` buckets deaths
 * by string prefix; `soak.ts` tests `/Died of sepsis/`; `notables.ts` matches
 * `nightlock|rather than keep playing`. Every one of those is a separate copy
 * of the same classification, and every one can rot independently the moment a
 * line is reworded. `soak.ts` already carries a comment about two probes that
 * read zero for several commits because their strings had been edited out.
 *
 * So: one code per death, and one place that decides it.
 *
 *   - `DamageRecord.code` is the code set *at the site*, which is the real fix
 *     — the site knows what it is doing and does not have to be guessed at.
 *   - `classifyCause` is the fallback for the sites that have not been
 *     annotated, and it is the *only* classifier in the codebase. Six copies
 *     that can disagree become one that can be checked.
 *   - `scripts/check-cause-codes.ts` runs the engine and fails if any cause
 *     string the simulation actually produces falls out of the taxonomy. That
 *     is what makes rewording safe: change the words, and either the code
 *     still resolves or the build says so by name. Silence stops being an
 *     option.
 *
 * The prose is untouched. A chronicle still reads the way it read; the
 * measurements simply stop depending on it.
 */

/** Ordered most-specific first: the first matching rule wins. */
const RULES: Array<[DeathCauseCode, RegExp]> = [
    // --- deliberate endings, before anything they would otherwise look like ---
    ['nightlock', /nightlock/i],
    ['self-inflicted', /rather than keep playing|went out to the caller/i],

    // --- another tribute ---
    ['tribute', /^Killed by |confusion of a group fight/i],
    // A wound somebody opened is a tribute-attributed bleed; untreated wounds
    // and a failed rescue are not. Both are bleeding.
    ['bleeding', /^Bled out/i],

    // --- the body, in the order the injury layer escalates ---
    ['sepsis', /sepsis/i],
    ['infection', /infected wound|infested/i],
    ['poison', /poison|knew better than to eat|the second thing after the first|stung down by the bloom/i],
    ['dehydration', /dehydration/i],
    ['starvation', /starvation/i],
    ['shock', /went into shock/i],
    ['exhaustion', /exhaustion|did not wake/i],
    ['hypothermia', /froze|exposure|hypotherm/i],
    ['heatstroke', /heatstroke/i],
    ['burns', /burn|caught in the fire|burned on the bog|rendered on the floor/i],
    ['asphyxiation', /choked|suffocated|smoke/i],

    // --- the arena ---
    ['border', /border|force field/i],
    ['mutt', /torn apart by|stampede|devoured by/i],
    ['drowning', /drown|into the sump|flooding|went under/i],
    ['collapse', /buried in the collapse|brought down by the roof|calving|shifting wall|closed$|as .+ closed/i],
    ['fall', /^fell |could not make the climb|ground gave way|down an open shaft|down with the (bench|terrace)|when the anchor went/i],
    ['trap', /deadfall|their own snare|abandoned pit/i],
    ['machinery', /machinery|taken by the ride|pressure pod|steel-jawed/i],
    ['gamemaker', /gamemaker|caught by the clock|defying the|off the plate before the gong/i],
];

/**
 * The code for a cause string, falling back on the damage `kind` where the
 * prose says nothing specific. Never returns `unknown` for a kind that names
 * a source, because "some tribute did it" is itself a classification.
 */
export function classifyCause(cause: string | undefined, kind?: DamageRecord['kind']): DeathCauseCode {
    const text = cause ?? '';
    for (const [code, pattern] of RULES) {
        if (pattern.test(text)) return code;
    }
    // Nothing in the wording matched. The damage record's broad bucket is a
    // weaker answer than a code but a much better one than nothing, and it is
    // structured rather than written.
    switch (kind) {
        case 'tribute': return 'tribute';
        case 'mutt': return 'mutt';
        case 'gamemaker': return 'gamemaker';
        case 'climate': return 'exposure';
        case 'hazard':
        case 'arena': return 'hazard';
        case 'status': return 'status';
        default: return 'unknown';
    }
}

/**
 * The code a death should carry: whatever the site declared, else classified.
 *
 * Every reader goes through this rather than through a regex of its own, so
 * there is exactly one answer to "what killed them" in the codebase.
 */
export function deathCodeOf(t: { causeCode?: DeathCauseCode; causeOfDeath?: string; lastDamage?: DamageRecord }): DeathCauseCode {
    if (t.causeCode) return t.causeCode;
    if (t.lastDamage?.code) return t.lastDamage.code;
    return classifyCause(t.causeOfDeath ?? t.lastDamage?.cause, t.lastDamage?.kind);
}

/** Codes that mean another tribute did it, for the several readers that ask. */
export function isTributeDealt(code: DeathCauseCode): boolean {
    return code === 'tribute';
}

/**
 * The broad family a code belongs to, for the readers that bucket rather than
 * discriminate — the metrics death table, mostly.
 */
export const CAUSE_FAMILY: Record<DeathCauseCode, 'tribute' | 'body' | 'arena' | 'mutt' | 'gamemaker' | 'unknown'> = {
    tribute: 'tribute',
    bleeding: 'body',
    infection: 'body',
    sepsis: 'body',
    poison: 'body',
    dehydration: 'body',
    starvation: 'body',
    exhaustion: 'body',
    hypothermia: 'body',
    heatstroke: 'body',
    burns: 'body',
    shock: 'body',
    asphyxiation: 'body',
    exposure: 'body',
    status: 'body',
    nightlock: 'body',
    'self-inflicted': 'body',
    drowning: 'arena',
    fall: 'arena',
    collapse: 'arena',
    border: 'arena',
    trap: 'arena',
    machinery: 'arena',
    hazard: 'arena',
    mutt: 'mutt',
    gamemaker: 'gamemaker',
    unknown: 'unknown',
};
