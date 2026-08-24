import { noteFormerAllies } from './memory';
import { Alliance, AlliancePact, GameState, PactEvent, Tribute } from '../models/types';
import { ALLIANCES } from '../data/balance';
import { RNG } from '../utils/rng';
import { SimContext, getAlive } from './context';

/**
 * §4.1: what an alliance agreed about its own ending.
 *
 * The old model had exactly one deadline and it was a hard constant: dissolve
 * when the field is down to eight. `districtCount` is legal from 2, i.e. a
 * field of four, so `remaining <= 8` was true from the gong in any run with
 * four districts or fewer — roughly a third of every alliance formed in a
 * small field was registered and then dissolved on the very next alliance
 * phase, printing a ceremonial line about how far the field had fallen
 * seconds after the handshake.
 *
 * The fix is not to remove the mechanic. A telegraphed, scheduled betrayal the
 * audience can watch approaching is one of the best ideas in the alliance
 * layer. The fix is to stop hard-coding the schedule: roll the threshold
 * *relative to the live field*, and while we are in here, let a pact be about
 * something other than a headcount. "Until the feast", "until the Careers are
 * gone", "until one of us is hurt" and "until it is just the two of us and
 * then we settle it" are all different stories, and none of them could be
 * expressed before.
 */

/** Every pact kind that can be rolled, in the order the weights are declared. */
type RollableKind = keyof typeof ALLIANCES.pactKindWeights;

/**
 * Field thresholds that are still meaningfully in the future.
 *
 * This one filter is the whole small-field bug fix: a threshold is only worth
 * swearing to if the field has at least `pactThresholdSlack` more deaths to go
 * before it comes due.
 */
export function pactThresholdsFor(field: number): number[] {
    return ALLIANCES.pactFieldThresholds.filter(n => n <= field - ALLIANCES.pactThresholdSlack);
}

const PACT_EVENTS: PactEvent[] = ['feast', 'first-blood', 'career-pack-falls', 'arena-closes', 'first-hurt'];

/**
 * Rolls a pact for a newly formed group.
 *
 * Everything that can be out of reach is checked against the live state first,
 * and a kind with nothing left to offer simply falls through to `no-pact`
 * rather than producing an already-expired deadline.
 */
export function rollPact(rng: RNG, state: GameState, members: Tribute[]): AlliancePact {
    if (!rng.chance(ALLIANCES.pactChanceAtAll)) return { kind: 'no-pact' };

    const field = getAlive(state).length;
    const thresholds = pactThresholdsFor(field);
    const memberIds = new Set(members.map(m => m.id));
    // "Until the Careers are gone" is only an agreement if there are Careers,
    // and only a *bet* if they are not in the room.
    const careersStanding = getAlive(state).some(t => t.allianceId?.startsWith('career-pack') && !memberIds.has(t.id));
    const outsiders = getAlive(state).filter(t => !memberIds.has(t.id));

    const available: RollableKind[] = (Object.keys(ALLIANCES.pactKindWeights) as RollableKind[]).filter(kind => {
        if (kind === 'until-field') return thresholds.length > 0;
        if (kind === 'until-goal') return outsiders.length > 0;
        return true;
    });
    if (available.length === 0) return { kind: 'no-pact' };

    const total = available.reduce((sum, k) => sum + ALLIANCES.pactKindWeights[k], 0);
    let roll = rng.nextFloat() * total;
    let picked: RollableKind = available[0];
    for (const kind of available) {
        roll -= ALLIANCES.pactKindWeights[kind];
        if (roll <= 0) { picked = kind; break; }
    }

    switch (picked) {
        case 'to-the-end':
            return { kind: 'to-the-end' };
        case 'until-field':
            return { kind: 'until-field', threshold: rng.pick(thresholds) };
        case 'until-day':
            return { kind: 'until-day', day: (state.day ?? 1) + ALLIANCES.pactDayHorizon };
        case 'until-event': {
            const events = PACT_EVENTS.filter(e => e !== 'career-pack-falls' || careersStanding);
            return { kind: 'until-event', event: rng.pick(events) };
        }
        case 'until-goal':
            return { kind: 'until-goal', goal: 'kill-target', targetId: rng.pick(outsiders).id };
    }
}

/**
 * How binding a pact is, for merge resolution. A merged group keeps the
 * stricter of the two — a conditional ending is stricter than none and looser
 * than a promise to see it through.
 */
export function pactStrictness(pact: AlliancePact): number {
    switch (pact.kind) {
        case 'no-pact': return 0;
        case 'until-day': return 1;
        case 'until-field': return 2;
        case 'until-event': return 2;
        case 'until-goal': return 3;
        case 'to-the-end': return 4;
    }
}

/** The pact as the tributes would say it, used by the feed and the UI alike. */
export function pactLabel(pact: AlliancePact, names?: (id: string) => string): string {
    switch (pact.kind) {
        case 'no-pact': return 'No pact';
        case 'to-the-end': return 'To the end';
        case 'until-day': return `Through day ${pact.day}`;
        case 'until-field':
            return pact.threshold <= 2 ? 'Until it is just us two' : `Until the final ${pact.threshold}`;
        case 'until-event': return PACT_EVENT_LABELS[pact.event];
        case 'until-goal': return `Until ${names?.(pact.targetId) ?? 'the target'} is dead`;
    }
}

const PACT_EVENT_LABELS: Record<PactEvent, string> = {
    feast: 'Until the feast',
    'first-blood': 'Until first blood',
    'career-pack-falls': 'Until the Careers are gone',
    'arena-closes': 'Until the arena closes in',
    'first-hurt': 'Until one of us is hurt',
};

/** The sworn version, said out loud at formation. */
export function pactOath(pact: AlliancePact, names: (id: string) => string): string | undefined {
    switch (pact.kind) {
        case 'no-pact': return undefined;
        case 'to-the-end': return 'see it through to the end, whatever the end turns out to look like';
        case 'until-day': return `run together through day ${pact.day}, and after that all bets are off`;
        case 'until-field':
            return pact.threshold <= 2
                ? 'run together until it is just the two of them, and then settle it properly'
                : `run together until the final ${pact.threshold}, and after that all bets are off`;
        case 'until-event':
            switch (pact.event) {
                case 'feast': return 'hold together until the feast, and no further';
                case 'first-blood': return 'hold together until one of them has killed somebody';
                case 'career-pack-falls': return 'hold together until the Career pack is finished — however long that takes, if it happens at all';
                case 'arena-closes': return 'hold together until the arena starts closing in on them';
                case 'first-hurt': return 'hold together until one of them is badly hurt, and not one hour past it';
            }
            return undefined;
        case 'until-goal': return `hold together until ${names(pact.targetId)} is dead, and not one day longer`;
    }
}

/**
 * Whether a pact has come due, and the sentence explaining why.
 *
 * Returns `undefined` while the pact still stands. Every branch reads live
 * state, so a pact that can never come due (the Careers all died before the
 * group formed) simply never fires — which is a legitimate outcome, not a bug.
 */
export function pactDue(state: GameState, record: Alliance, members: Tribute[]): string | undefined {
    const alive = getAlive(state);
    const pact = record.pact;
    switch (pact.kind) {
        case 'no-pact':
        case 'to-the-end':
            return undefined;
        case 'until-field':
            return alive.length <= pact.threshold
                ? `The field is down to ${alive.length}.`
                : undefined;
        case 'until-day':
            return (state.day ?? 1) > pact.day
                ? `Day ${pact.day} is behind them.`
                : undefined;
        case 'until-event': {
            switch (pact.event) {
                case 'feast':
                    return (state.feastsHeld ?? 0) > 0 ? 'The feast is over.' : undefined;
                case 'first-blood':
                    return members.some(m => m.kills > 0)
                        ? 'One of them has killed somebody, which was the condition.'
                        : undefined;
                case 'career-pack-falls':
                    return alive.some(t => t.allianceId?.startsWith('career-pack'))
                        ? undefined
                        : 'The Career pack is finished.';
                case 'arena-closes':
                    return state.escalationDay !== undefined
                        ? 'The arena has started closing in.'
                        : undefined;
                case 'first-hurt':
                    return members.some(m => m.health <= ALLIANCES.pactHurtHealth)
                        ? 'One of them is badly hurt, which was the condition.'
                        : undefined;
            }
            return undefined;
        }
        case 'until-goal': {
            const target = state.tributes.find(t => t.id === pact.targetId);
            return target && target.status !== 'alive'
                ? `${target.name} is dead, which was the whole agreement.`
                : undefined;
        }
    }
}

/**
 * Resolves every pact that has come due, once per alliance phase.
 *
 * The ceremony scales. "The field is down to four" is a genuinely moving line
 * when the field started at twenty-four and an absurd one when it started at
 * four, so a group that agreed to something the arena reached without much
 * happening simply parts without the fanfare.
 */
export function resolveDuePacts(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const byId = new Map<string, Tribute[]>();
    alive.forEach(t => {
        if (!t.allianceId) return;
        if (!byId.has(t.allianceId)) byId.set(t.allianceId, []);
        byId.get(t.allianceId)!.push(t);
    });

    byId.forEach((members, id) => {
        const record = ctx.state.alliances?.[id];
        if (!record || members.length < 2) return;
        const because = pactDue(ctx.state, record, members);
        if (!because) return;

        const sworn = record.pactSwornField ?? alive.length;
        const ceremonial = sworn - alive.length >= ALLIANCES.pactCeremonyAttrition;
        record.pact = { kind: 'no-pact' };
        ctx.logEvent(
            ceremonial
                ? `${because} ${members.map(m => m.name).join(' and ')} agreed this was where it ended, `
                  + 'and none of them pretends otherwise. The alliance dissolves exactly as promised.'
                : `${because} ${members.map(m => m.name).join(' and ')} keep their word without any ceremony about it `
                  + 'and go their separate ways.',
            members.map(m => m.id),
            { important: true, category: 'alliance' }
        );
        // §3.7: they kept their word and walked away from each other. That is
        // not the same as never having met, and the ordinary decay rate treats
        // it as though it were.
        noteFormerAllies(members);
        members.forEach(m => { delete m.allianceId; });
    });
}
