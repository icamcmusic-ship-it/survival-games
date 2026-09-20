import { Alliance, CharterRule, Tribute } from '../models/types';
import { easeSuspicion, noteFormerAllies, raiseSuspicion } from './memory';
import { SUSPICION, CHARTER, ENDGAME, ALLIANCES } from '../data/balance';
import { SimContext, getAlive } from './context';
import { allianceOf, cacheDivisionLine, distributeCache } from './alliance';
import { noteBreach } from './alliancePolitics';
import { adjustRel, getRel } from './relationships';
import { RNG } from '../utils/rng';
import { traitMod } from '../data/traits';
import { isAggressiveStance } from '../data/stances';

/**
 * The alliance charter: rules a group agrees to, and what happens when somebody
 * breaks one.
 *
 * An alliance had exactly three exits — death, betrayal, and the pact running
 * out — so the entire middle of group life was missing. Nobody ever argued
 * about rations, nobody ever slipped away on their own against the group's
 * wishes, nobody ever did something small and selfish that cost them trust
 * without ending the alliance. Every disagreement had to escalate to a knife or
 * not exist.
 *
 * A charter is 1-2 clauses agreed when the group forms. Breaking one is real
 * fallout — the group's regard for the offender drops, the leader may lose the
 * room — but it is not a betrayal, and the alliance survives it. That is the
 * missing register.
 */

const RULE_TEXT: Record<CharterRule, string> = {
    'share-food': 'everything edible goes in the pile',
    'no-fighting': 'nobody raises a hand to anybody here',
    'hold-the-camp': 'somebody is always at the camp',
    'no-hunting-alone': 'nobody goes out on their own',
    // §4.5: the endgame is finally expressible as a pact.
    'split-at-eight': 'when eight are left, this ends — everyone walks away clean',
    'no-looting-the-fallen': 'nobody strips a body',
    'share-intel': 'what one of us hears, all of us hear',
    'leader-decides-targets': 'nobody picks a fight the leader has not picked',
};

/** Rolls the clauses a new alliance agrees to, from its members' natures. */
export function rollCharter(rng: RNG, members: Tribute[]): CharterRule[] {
    // Each clause is weighted by who is signing it. A group with somebody
    // hungry writes the food rule; two members who already dislike each other
    // write the no-fighting rule; a strategist wants the intel shared; a
    // Career leader wants to pick the fights. `members` used to be `void`ed
    // — the doc said "from its members' natures" and the body rolled flat.
    const has = (pred: (t: Tribute) => boolean) => members.some(pred);
    const regardFloor = Math.min(...members.flatMap(m => members.filter(o => o.id !== m.id).map(o => getRel(m, o.id))));
    /*
     * AUDIT-6 §4.2: the biases were right and far too quiet.
     *
     * Measured over 200 runs the eight clauses came out at 833/723/681/676/
     * 642/618/576/558 — near enough uniform that a Career pack and four
     * frightened outer-district kids signed the same constitution. The reason
     * is arithmetic rather than design: a flat base of 1 against bonuses of
     * 0.5-1.5 meant even a maximally-biased group only moved a clause from 12%
     * to 25% of the draw.
     *
     * Base down to `CHARTER.baseWeight`, bonuses up. A group whose composition
     * points hard at a clause now writes that clause most of the time, which is
     * what "from its members' natures" was always supposed to mean.
     */
    const base = CHARTER.baseWeight;
    const weights: Array<[CharterRule, number]> = [
        ['share-food', base + (has(t => t.vitals.hunger > 50) ? 2 : 0) + (has(t => t.archetype === 'survivalist' || t.archetype === 'quartermaster') ? 1.5 : 0)],
        ['no-fighting', base + (regardFloor < 10 ? 2.5 : 0) + (has(t => t.archetype === 'diplomat' || t.archetype === 'confessor' || t.traits.includes('Pacifist')) ? 2 : 0)],
        ['hold-the-camp', base + (has(t => t.archetype === 'protector' || t.archetype === 'medic' || t.archetype === 'bellwether') ? 2.5 : 0)],
        ['no-hunting-alone', base + (has(t => t.isCareer || isAggressiveStance(t.stance)) ? 2 : 0) + (has(t => t.archetype === 'tracker') ? 1 : 0)],
        ['no-looting-the-fallen', base + (has(t => t.traits.includes('Merciful') || t.traits.includes('Softhearted') || t.archetype === 'martyr') ? 2.5 : 0)],
        ['share-intel', base + (has(t => t.archetype === 'strategist' || t.archetype === 'scholar') ? 2.5 : 0)],
        ['leader-decides-targets', base + (has(t => t.archetype === 'career' || t.archetype === 'zealot') ? 2.5 : 0)],
    ];
    const count = rng.chance(CHARTER.twoClauseChance) ? 2 : 1;
    const chosen: CharterRule[] = [];
    for (let i = 0; i < count; i++) {
        const remaining = weights.filter(([r]) => !chosen.includes(r));
        if (remaining.length === 0) break;
        const total = remaining.reduce((sum, [, w]) => sum + w, 0);
        let roll = rng.nextFloat() * total;
        let pick = remaining[remaining.length - 1][0];
        for (const [rule, w] of remaining) { roll -= w; if (roll <= 0) { pick = rule; break; } }
        chosen.push(pick);
    }
    // §4.5: a cautious group writes the ending into the terms up front —
    // "we split at the final eight" is a pact, and now it is a clause.
    if (rng.chance(CHARTER.endgameClauseChance)) chosen.push('split-at-eight');
    return chosen;
}

/** Announces the terms, so the reader knows what can later be broken. */
export function announceCharter(ctx: SimContext, record: Alliance, members: Tribute[]) {
    if (!record.charter || record.charter.length === 0) return;
    const terms = record.charter.map(r => RULE_TEXT[r]).join(', and ');
    ctx.logEvent(
        `${members.map(m => m.name).join(', ')} set their terms: ${terms}.`,
        members.map(m => m.id),
        { category: 'alliance' }
    );
}

/**
 * Per-cycle check: did anybody break what they agreed to?
 *
 * Each clause is measured against state the simulation already tracks, so a
 * breach is a real observation rather than a roll — a tribute hoarding food
 * while the group's cache is empty genuinely is hoarding food.
 */
export function enforceCharters(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const groups = new Map<string, Tribute[]>();
    alive.forEach(t => {
        if (!t.allianceId) return;
        if (!groups.has(t.allianceId)) groups.set(t.allianceId, []);
        groups.get(t.allianceId)!.push(t);
    });

    groups.forEach((members, id) => {
        const record = allianceOf(ctx.state, id);
        if (!record?.charter || members.length < 2) return;

        // §10.1: 'Charter Kept' — a group of three or more standing at the
        // final eight with terms agreed and never once broken.
        if (members.length >= 3 && alive.length <= ENDGAME.fieldSize && (record.breaches ?? 0) === 0) {
            ctx.state.charterKeptSeen = true;
        }

        // §4.5: the endgame clause resolves as a scene, not a breach — a
        // pact honoured in full is the rarest and most valuable thing the
        // social layer can produce.
        // §4.1: the same relative-threshold fix the pact layer got. A clause
        // that reads "we stop at eight" in a 24-tribute field is a scheduled
        // parting; in a field of eight it is a clause that was already true
        // when they signed it. It only comes due once the field has actually
        // fallen that far *since* the group formed.
        const splitAt = Math.min(ENDGAME.fieldSize, Math.max(2, record.pactSwornField
            ? record.pactSwornField - ALLIANCES.pactThresholdSlack
            : ENDGAME.fieldSize));
        if (record.charter.includes('split-at-eight') && alive.length <= splitAt) {
            // A clean parting is still a parting: it leaves the ex-ally memory
            // behind, and it is worth a small warmth for a promise kept — not
            // a *breach* cost, which is the constant this used to reuse.
            noteFormerAllies(members);
            // AUDIT-9 B07: the line below has always said they divide the
            // cache. Now they do — before the ids come off, because the record
            // is pruned a moment later and whatever is still in it at that
            // point ceases to exist.
            const division = distributeCache(ctx, record, members);
            members.forEach(m => { delete m.allianceId; });
            members.forEach(m => members.forEach(o => {
                if (o.id !== m.id) adjustRel(m, o.id, CHARTER.honouredPartingRegard);
            }));
            const divisionLine = cacheDivisionLine(division);
            ctx.logEvent(
                `${members.map(m => m.name).join(', ')} count the cannons and stop at ${alive.length}. The terms were the terms: `
                + (divisionLine
                    ? `${divisionLine} They walk away from each other without a word being broken.`
                    : 'there is nothing left in the cache to divide, and they walk away from each other without a word being broken.'),
                members.map(m => m.id),
                { important: true, category: 'alliance' }
            );
            return;
        }

        const cycle = ctx.state.cycle ?? 0;
        // §4.2 (audit): a charter kept is evidence. A window with no breach
        // eases everybody's doubt about everybody, a little.
        const lastAny = Math.max(-Infinity, ...Object.values(record.lastBreachCycle ?? {}).map(n => n ?? -Infinity), record.formedCycle);
        if (cycle - lastAny >= SUSPICION.keptCharterWindow && (cycle - lastAny) % SUSPICION.keptCharterWindow === 0) {
            members.forEach(m => members.forEach(o => { if (o.id !== m.id) easeSuspicion(m, o.id, SUSPICION.easedByKeptCharter); }));
        }
        record.charter.forEach(rule => {
            if (rule === 'split-at-eight') return;
            const last = record.lastBreachCycle?.[rule];
            if (last !== undefined && cycle - last < CHARTER.rebreachCooldownCycles) return;
            const offender = findBreach(ctx, rule, record, members);
            if (!offender) return;
            // AUDIT-6 §12.2 `charterHold`: a Bookkeeper keeps the terms they
            // signed, so the group has less to notice in the first place.
            if (!ctx.rng.chance(CHARTER.noticeChance * Math.max(0, 1 - traitMod(offender, 'charterHold')))) return;
            record.lastBreachCycle = { ...(record.lastBreachCycle ?? {}), [rule]: cycle };
            // The counted clauses move their baseline forward: the offence is
            // the bodies stripped *since the last time it came up*.
            if (rule === 'no-looting-the-fallen') {
                record.lootedAtCharter = { ...(record.lootedAtCharter ?? {}), [offender.id]: offender.corpsesLooted ?? 0 };
            }
            if (rule === 'share-intel') {
                record.intelSoldAtCharter = { ...(record.intelSoldAtCharter ?? {}), [offender.id]: offender.intelSold ?? 0 };
            }
            record.breaches = (record.breaches ?? 0) + 1;
            // §4: a clause broken is a promise broken, and the trait arc counts it.
            offender.faithBroken = (offender.faithBroken ?? 0) + 1;

            // Everybody else thinks less of them. Nobody draws a knife over it.
            members.forEach(m => {
                if (m.id === offender.id) return;
                adjustRel(m, offender.id, -CHARTER.breachRegardCost);
                // §4.2: a breach is exactly the kind of small tell suspicion feeds on.
                raiseSuspicion(m, offender.id, SUSPICION.perCharterBreach);
            });
            ctx.logEvent(
                breachLine(rule, offender, members),
                members.map(m => m.id),
                { type: 'charter-breaches', important: true, category: 'alliance' }
            );

            // §4.2: 222 breaches across a 400-run soak, and the only
            // consequence was a scalar going up. A *second* breach of the same
            // clause by the same person is a scene: the group sits them down
            // and decides to expel, demote or forgive.
            noteBreach(ctx, record, offender, rule, members);

            // §4.5: renegotiation — a breach can produce a new, harsher
            // clause instead of only fallout. The group closes the loophole
            // the offender just walked through.
            if (ctx.rng.chance(CHARTER.renegotiateChance)) {
                /*
                 * AUDIT-9: the group can close any loophole, not four of them.
                 *
                 * This pool held four of the seven clauses `rollCharter` can
                 * write, so a group that had just watched somebody strip a
                 * body could not respond by writing the rule against stripping
                 * bodies — the one clause the breach was actually about. It
                 * also capped how deep a charter could get: an initial charter
                 * is at most three clauses and the pool could only ever add
                 * the ones it listed, which is why `deepestCharter >= 5` sat
                 * right at the edge of reachable and fell off it as soon as
                 * breaches got rarer. Every clause the group can agree at
                 * formation, they can agree after a breach.
                 */
                const pool: CharterRule[] = [
                    'share-food', 'no-fighting', 'hold-the-camp', 'no-hunting-alone',
                    'no-looting-the-fallen', 'share-intel', 'leader-decides-targets',
                ];
                const missing = pool.filter(r => !record.charter!.includes(r));
                if (missing.length > 0) {
                    const added = ctx.rng.pick(missing);
                    record.charter = [...record.charter!, added];
                    ctx.logEvent(
                        // §22: the cast is the whole group agreeing to it, so
                        // the line says which of them are at the fire.
                        `The terms get harsher around the fire that night: from now on, ${RULE_TEXT[added]}. `
                        + `${members.filter(m => m.id !== offender.id).map(m => m.name).join(', ')} agree it. `
                        + `Nobody looks at ${offender.name} while they do.`,
                        members.map(m => m.id),
                        { category: 'alliance' }
                    );
                }
            }
        });
    });
}

function findBreach(ctx: SimContext, rule: CharterRule, record: Alliance, members: Tribute[]): Tribute | undefined {
    switch (rule) {
        case 'share-food': {
            // Sitting on food while the shared cache has none in it.
            if (record.sharedCache.some(i => i.type === 'food')) return undefined;
            return members.find(m => m.inventory.filter(i => i.type === 'food').length >= CHARTER.hoardingFood);
        }
        case 'no-fighting': {
            // Somebody in the group has picked up a grudge against another member.
            return members.find(m => members.some(o => o.id !== m.id && getRel(m, o.id) < CHARTER.hostileRegard));
        }
        case 'hold-the-camp': {
            if (!record.campZone) return undefined;
            const anyoneHome = members.some(m => m.zone === record.campZone);
            if (anyoneHome) return undefined;
            // The one furthest from where they said they would be.
            return members.find(m => m.zone !== record.campZone);
        }
        case 'no-hunting-alone': {
            return members.find(m =>
                isAggressiveStance(m.stance)
                && !members.some(o => o.id !== m.id && o.zone === m.zone));
        }
        case 'no-looting-the-fallen': {
            // Somebody has been through a body since the group agreed not to.
            return members.find(m => (m.corpsesLooted ?? 0) > (record.lootedAtCharter?.[m.id] ?? 0));
        }
        case 'share-intel': {
            // Selling what you heard, when the deal was that everybody hears it.
            return members.find(m => (m.intelSold ?? 0) > (record.intelSoldAtCharter?.[m.id] ?? 0));
        }
        case 'leader-decides-targets': {
            // Hunting somebody the leader is not hunting.
            const leader = members.find(m => m.id === record.leaderId);
            if (!leader) return undefined;
            const sanctioned = leader.objective?.kind === 'hunt' ? leader.objective.targetId : undefined;
            return members.find(m =>
                m.id !== leader.id
                && m.objective?.kind === 'hunt'
                && m.objective.targetId !== sanctioned);
        }
        default:
            return undefined;
    }
}

function breachLine(rule: CharterRule, offender: Tribute, members: Tribute[]): string {
    const others = members.filter(m => m.id !== offender.id).map(m => m.name).join(' and ');
    switch (rule) {
        case 'share-food':
            return `${others} work out that ${offender.name} has been eating out of their own pack while the pile stayed empty. Nobody draws anything over it. Nobody forgets it either.`;
        case 'no-fighting':
            return `It gets loud between ${offender.name} and the rest of them. No blood, and no apology, and the camp is a colder place afterwards.`;
        case 'hold-the-camp':
            return `${offender.name} was supposed to be at the camp. ${others} come back to an empty one and a very obvious conversation waiting to be had.`;
        case 'no-hunting-alone':
            return `${offender.name} went out hunting alone, which is the one thing this group agreed nobody would do. ${others} notice they are gone before they notice why.`;
        case 'no-looting-the-fallen':
            return `${offender.name} has been through somebody's pockets. ${others} agreed nobody would, and now they are looking at what came out of them.`;
        case 'share-intel':
            return `Whatever ${offender.name} knew, they sold it rather than said it. ${others} find out the way everybody finds these things out: late, and from somebody else.`;
        case 'leader-decides-targets':
            return `${offender.name} has picked their own fight. ${others} agreed that was not how this worked, and one of them says so out loud.`;
        default:
            return `${offender.name} breaks the terms.`;
    }
}

/** Used by the UI to explain what a group has actually agreed to. */
export function charterSummary(record: Alliance | undefined): string | undefined {
    if (!record?.charter || record.charter.length === 0) return undefined;
    return record.charter.map(r => RULE_TEXT[r]).join('; ');
}
