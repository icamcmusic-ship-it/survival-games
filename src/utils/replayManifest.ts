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
 * B3-01 finishes the part that was deliberately left out: the intervention log
 * now exists (`GameState.interventionLog`) and travels in the payload, so a run
 * the player steered is reproducible rather than merely declared
 * unreproducible. See `carriedInterventions` below for what that costs and what
 * it does not fix.
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
    /**
     * B3-01: how many of those interventions the link actually carries.
     *
     * The distinction is the whole point. A count of interventions says the run
     * was steered; a *log* of them says how, and a replay that fires the same
     * list at the same cycles reproduces the run, because each command's stream
     * is derived from (seed, cycle, type, index) rather than from the ambient
     * one. Equal to `interventions` means the link carries the lot.
     *
     * Not simply folded into `interventions`, because a link written before the
     * log existed, or truncated because the log outgrew a URL, carries some and
     * not all — and the honest answer for that is still `conditions`.
     */
    carriedInterventions?: number;
}

export function fidelityOf(inputs: ManifestInputs): ReplayFidelity {
    if (inputs.campaignRejected) return 'rules-only';
    if (!inputs.campaign) return 'seed';
    if (inputs.veteransSeated > 0) return 'conditions';
    // B3-01: interventions only cost fidelity when the link does not carry them.
    if (inputs.interventions > (inputs.carriedInterventions ?? 0)) return 'conditions';
    // An absent revision is a link written before the field existed, which is
    // by definition not this build.
    if (inputs.revision !== CONTENT_REVISION) return 'conditions';
    return 'exact';
}

/** One sentence the receiver can act on. Safe to show verbatim. */
export function fidelityMessage(fidelity: ReplayFidelity, inputs: ManifestInputs): string {
    switch (fidelity) {
        case 'exact':
            return 'This link carries the seed, the rules and the record book the run was played under, on this build'
                + ((inputs.carriedInterventions ?? 0) > 0
                    ? `, along with the ${inputs.carriedInterventions} Gamemaker intervention${inputs.carriedInterventions === 1 ? '' : 's'} that steered it`
                    : '')
                + '. It replays that Games.';
        case 'conditions':
            return 'This link carries the same starting conditions — seed, rules and record book — but not everything the original run had'
                + (inputs.veteransSeated > 0 ? `, including ${inputs.veteransSeated} archived victor${inputs.veteransSeated === 1 ? '' : 's'} seated from the sender's Hall of Fame` : '')
                + (inputs.interventions > (inputs.carriedInterventions ?? 0)
                    ? `, and ${inputs.interventions - (inputs.carriedInterventions ?? 0)} of the ${inputs.interventions} Gamemaker intervention${inputs.interventions === 1 ? '' : 's'} the player made during it`
                    : '')
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

/**
 * AUDIT-10 B3-01: read an intervention log back out of a link.
 *
 * The encoding is `cycle.type[.targetId][!]`, tilde-separated — chosen because
 * every part of it is already URL-safe, so the log does not need a second layer
 * of escaping inside a query string that is itself escaped.
 *
 * This parses a string a stranger produced, so it validates rather than trusts:
 * a malformed entry is dropped and the rest are kept, and the caller learns how
 * many survived. That number is what the manifest reports as *carried*, so a
 * link whose log was mangled in transit degrades to `conditions` instead of
 * claiming an `exact` replay it cannot perform.
 */
/**
 * The commands a link is allowed to carry.
 *
 * Duplicated from `GamemakerEventType` on purpose: this module is imported by
 * `App` and the share control, and pulling the engine in to validate a query
 * string would put the simulation in the boot path of a page that may never
 * start a run. `check-replay` asserts the two lists agree, so the duplication
 * cannot drift.
 */
export const REPLAYABLE_COMMANDS: ReadonlySet<string> = new Set([
    'mutt', 'weather', 'feast', 'burn', 'flood', 'fog', 'sever', 'bounty', 'drop',
    'mercy', 'reveal', 'strip',
]);

export interface ParsedIntervention {
    cycle: number;
    type: string;
    targetId?: string;
    scheduled?: boolean;
}

export function parseInterventionLog(raw: string | null | undefined): ParsedIntervention[] {
    if (!raw) return [];
    const out: ParsedIntervention[] = [];
    for (const entry of raw.split('~')) {
        const scheduled = entry.endsWith('!');
        const parts = (scheduled ? entry.slice(0, -1) : entry).split('.');
        if (parts.length < 2 || parts.length > 3) continue;
        // An empty cycle is not a cycle, and `Number('')` is 0 — which is a
        // perfectly good cycle, so the emptiness has to be caught before the
        // conversion rather than after it.
        if (!/^\d+$/.test(parts[0])) continue;
        const cycle = Number(parts[0]);
        // The type is checked against the list rather than for mere presence.
        // '3.5.burn' splits into a cycle of 3 and a type of '5', which is
        // shaped exactly like a valid entry and would queue a command the
        // engine has no case for; only the whitelist can tell them apart.
        if (!REPLAYABLE_COMMANDS.has(parts[1])) continue;
        out.push({
            cycle, type: parts[1],
            ...(parts[2] ? { targetId: parts[2] } : {}),
            ...(scheduled ? { scheduled: true } : {}),
        });
    }
    // Cycle order, because the queue is drained in order and the sender's own
    // ordering is the one being reproduced. A link that arrived shuffled
    // replays correctly; one that arrived complete is unaffected.
    return out.sort((a, b) => a.cycle - b.cycle);
}
