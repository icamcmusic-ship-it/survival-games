/**
 * AUDIT-10 F19: what a share link can and cannot promise.
 *
 * The link carries the seed, the arena, the Quell, every `GameConfig` field and
 * — since AUDIT-9 B06 — the sender's record book. That is a lot, and it is not
 * everything a run was played under. It does not carry:
 *
 *   - the engine and content revision the run executed on;
 *   - the identities of victors seated into the field by a Grudge Match, which
 *     live in the *sender's* Hall of Fame and cannot be read from the receiver's;
 *   - the sequence of Gamemaker interventions the player made during the run.
 *
 * A link missing any of those still reproduces something useful. What it must
 * not do is describe what it reproduces as the same thing in every case, which
 * is what "Copy a link that reproduces this exact run" did. So the manifest is
 * versioned and states its own fidelity, and every surface that offers or
 * consumes a link reads that fidelity rather than asserting the strongest
 * claim.
 *
 * Four honest levels, in descending strength:
 *
 *   - `exact`       — same seed, same rules, same record book, same revision,
 *                     no inputs the link cannot carry. Replays the run.
 *   - `conditions`  — same seed, rules and record book, but the run had inputs
 *                     the link does not carry (seated veterans, interventions)
 *                     or was played on a different revision. Same starting
 *                     conditions; the Games will diverge.
 *   - `seed`        — same seed and rules under the *receiver's* career. A
 *                     different Games that starts from the same draw.
 *   - `rules-only`  — the link's campaign did not validate. The seed and rules
 *                     apply and nothing else does.
 *
 * Deliberately not attempted here: recorded playback and interactive branching,
 * which need an intervention log in the payload and a policy for replaying
 * against a newer engine. Those are named in the plan, not half-built.
 */

/**
 * The engine/content revision a run executed on.
 *
 * Bumped by hand when a change to the engine or the content tables can alter
 * the Games a given seed produces. It does not need to be exact to be useful:
 * its job is to let a link say "this was recorded on a different build" rather
 * than to silently present a divergent run as a replay.
 */
export const CONTENT_REVISION = 'audit10';

export type ReplayFidelity = 'exact' | 'conditions' | 'seed' | 'rules-only';

/** What the link carried, as far as the receiver can tell. */
export interface ManifestInputs {
    /** A campaign snapshot was attached and validated. */
    campaign: boolean;
    /** The campaign was attached and did not validate. */
    campaignRejected: boolean;
    /** Revision the sender's run executed on, if the link stated one. */
    revision?: string;
    /** The sender's run seated archived victors the link cannot carry. */
    veteransSeated: number;
    /** Gamemaker interventions the sender made during the run. */
    interventions: number;
}

export function fidelityOf(inputs: ManifestInputs): ReplayFidelity {
    if (inputs.campaignRejected) return 'rules-only';
    if (!inputs.campaign) return 'seed';
    if (inputs.veteransSeated > 0 || inputs.interventions > 0) return 'conditions';
    // An absent revision is a link written before the field existed, which is
    // by definition not this build.
    if (inputs.revision !== CONTENT_REVISION) return 'conditions';
    return 'exact';
}

/** One sentence the receiver can act on. Safe to show verbatim. */
export function fidelityMessage(fidelity: ReplayFidelity, inputs: ManifestInputs): string {
    switch (fidelity) {
        case 'exact':
            return 'This link carries the seed, the rules and the record book the run was played under, on this build. It replays that Games.';
        case 'conditions':
            return 'This link carries the same starting conditions — seed, rules and record book — but not everything the original run had'
                + (inputs.veteransSeated > 0 ? `, including ${inputs.veteransSeated} archived victor${inputs.veteransSeated === 1 ? '' : 's'} seated from the sender's Hall of Fame` : '')
                + (inputs.interventions > 0 ? `, and ${inputs.interventions} Gamemaker intervention${inputs.interventions === 1 ? '' : 's'} the player made during it` : '')
                + (inputs.revision !== CONTENT_REVISION ? `, and it was recorded on a different build (${inputs.revision ?? 'unstated'})` : '')
                + '. Expect it to diverge.';
        case 'seed':
            return 'This link carries the seed and the rules. The Games runs under your own record book, which is a different Games from the sender\'s.';
        default:
            return 'This link\'s record book could not be read. The seed and the rules still apply; nothing else about the sender\'s run does.';
    }
}

/** The short label a Share control should wear for what it is about to copy. */
export function shareLabelFor(fidelity: ReplayFidelity): string {
    return fidelity === 'exact' ? 'Share run' : fidelity === 'conditions' ? 'Share conditions' : 'Share';
}
