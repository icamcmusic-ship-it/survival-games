import { SimContext } from './context';
import { ITEMS } from '../data/constants';
import { legacyOf, LegacyTier } from '../data/districts';
import { arenaHasLaw } from './gamesProfile';
import { MENTOR_PARACHUTE_TEXTS, MENTOR_PLEA_FAILED_TEXTS, MENTOR_POINTED_TEXTS, MENTOR_WITHHELD_TEXTS } from '../data/flavorText';
import { giveItem, itemPhrase } from './items';
import { cycleOf, ensureMemory } from './memory';
import { clampTribute } from './vitals';
import { getZone, zoneFeatures } from './map';
import { Item, Tribute } from '../models/types';
import { mintItem } from './items';
import { MENTOR_DRAMA, QUALITY_BIAS } from '../data/balance';

/**
 * Mentors, as a sponsorship mechanic.
 *
 * `mentorLegacy` was generated with care and then never read again once the
 * Games began — a name on the roster and nothing else. In canon the mentor is
 * the sponsorship system: they work the Capitol rooms, they decide what to
 * spend their standing on, and they choose *when*. That is the half modelled
 * here, in two levers and no more:
 *
 *  1. A standing multiplier on the ordinary gift stream. A storied district's
 *     mentor is simply better at getting a parachute in the air.
 *  2. A targeted plea: when their tribute is visibly dying of a specific thing,
 *     a mentor with contacts can spend their own credibility to send exactly
 *     the item that fixes it.
 *
 * Both are deliberately narrow. The elite-gate and repeat-decay design in
 * sponsors.ts is what keeps parachutes dramatic, so the plea rides the same
 * decay curve rather than running beside it.
 */

/**
 * Multiplier on sponsor generosity for the ordinary gift stream.
 *
 * A weak mentor has to be a real handicap, not a smaller bonus, or the whole
 * pedigree table is just free points for the Careers. District 12's mentor
 * costs their tribute a third of their parachutes.
 */
export const MENTOR_GENEROSITY: Record<LegacyTier, number> = {
    storied: 1.3,
    strong: 1.18,
    modest: 1.0,
    thin: 0.85,
    forgotten: 0.68,
};

/**
 * Per-cycle chance a mentor gets a targeted parachute past the Capitol, before
 * repeat-decay. Rolled only for a tribute in genuine, nameable trouble.
 *
 * `forgotten` is zero on purpose: Haymitch has no contacts and no credibility
 * left to spend, so his tribute is never rescued by anyone but themselves.
 */
export const MENTOR_PULL: Record<LegacyTier, number> = {
    storied: 0.3,
    strong: 0.22,
    modest: 0.13,
    thin: 0.07,
    forgotten: 0,
};

/**
 * A plea only lands if the crowd still rates the tribute. The mentor trades on
 * credibility they do not have an infinite supply of, so each plea burns trust
 * — three of them in a run drops any tribute under the floor and the mentor is
 * out of favours for good. This is the budget; there is no separate counter.
 */
export const MENTOR_TRUST_FLOOR = 34;
export const MENTOR_TRUST_COST = 13;

/** Excitement spent by a plea. Cheaper than a crowd-driven gift: the mentor, not the audience, is paying. */
export const MENTOR_EXCITEMENT_COST = 18;

/** Repeat pleas decay on the same curve as ordinary parachutes, so a favourite cannot farm them. */
export const MENTOR_REPEAT_DECAY = 0.5;

export function mentorTierOf(t: Tribute): LegacyTier {
    return legacyOf(t.district).tier;
}

/** Standing multiplier applied on top of the config's sponsor generosity. */
export function mentorGenerosity(t: Tribute): number {
    return MENTOR_GENEROSITY[mentorTierOf(t)];
}

type Need = 'water' | 'food' | 'medical' | 'weapon';

/**
 * What is actually killing this tribute right now, in the order a mentor
 * watching the feed would triage it. Returns undefined when they are merely
 * having a bad day — the plea is for emergencies, not for topping up a pack.
 */
function urgentNeed(t: Tribute): Need | undefined {
    if (t.injuries.bleeding || t.injuries.infected || t.injuries.poisoned || t.health <= 35) return 'medical';
    if (t.vitals.thirst >= 72) return 'water';
    if (t.vitals.hunger >= 82) return 'food';
    if (t.health <= 60 && !t.inventory.some(i => i.type === 'weapon')) return 'weapon';
    return undefined;
}

/** The best answer to that need the Capitol will actually put on a parachute. */
function itemForNeed(ctx: SimContext, t: Tribute, need: Need): Item {
    if (need === 'medical') {
        const wanted = t.injuries.poisoned ? 'antidote' : t.injuries.burned ? 'ointment' : 'medkit';
        const match = ITEMS.find(i => i.id === wanted);
        if (match) return mintItem(ctx.rng, match, QUALITY_BIAS.parachute);
    }
    if (need === 'weapon') {
        // A plea buys a serviceable weapon, not the trident — that stays behind
        // the rarity gate where the crowd has to pay for it.
        const pool = ITEMS.filter(i => i.type === 'weapon' && i.value <= 45);
        return mintItem(ctx.rng, ctx.rng.pick(pool), QUALITY_BIAS.parachute);
    }
    const pool = ITEMS.filter(i => i.type === need);
    return mintItem(ctx.rng, ctx.rng.pick(pool.length > 0 ? pool : ITEMS.filter(i => i.id === 'water')), QUALITY_BIAS.parachute);
}

const NEED_PHRASES: Record<Need, string> = {
    water: 'has watched them go dry',
    food: 'has watched them go hungry',
    medical: 'has watched the blood on the feed all day',
    weapon: 'has watched them face the arena empty-handed',
};

/**
 * A mentor calling in a favour. Runs before the ordinary sponsor pass so that a
 * tribute rescued by their mentor does not also draw a crowd parachute in the
 * same cycle. Returns the tributes it delivered to.
 */
/**
 * §7.6: whether the tribute is currently making a *survivable* mistake — one
 * the mentor can see the fix for from the booth. Dying of thirst next to a
 * stream, or starving in a zone that is still green, is not an emergency to
 * parachute out of; it is a lesson to let land.
 */
function survivableMistake(ctx: SimContext, t: Tribute): 'water' | 'food' | undefined {
    const zone = getZone(ctx.state.arena, t.zone);
    if (!zone) return undefined;
    if (t.vitals.thirst >= MENTOR_DRAMA.withholdThirst) {
        const nearWater = zoneFeatures(zone).waterSource
            || zone.adjacent.some(n => {
                const neighbour = getZone(ctx.state.arena, n);
                return neighbour !== undefined && zoneFeatures(neighbour).waterSource;
            });
        if (nearWater) return 'water';
    }
    if (t.vitals.hunger >= MENTOR_DRAMA.withholdHunger && zone.resources >= MENTOR_DRAMA.withholdZoneResources) {
        return 'food';
    }
    return undefined;
}

/** §7.6: the lesson landing — the withheld need has been answered by the tribute themselves. */
function selfCorrected(t: Tribute): boolean {
    return t.vitals.thirst < MENTOR_DRAMA.correctedBelow && t.vitals.hunger < MENTOR_DRAMA.correctedBelow;
}

export function processMentorPleas(ctx: SimContext, alive: Tribute[]): Set<string> {
    const helped = new Set<string>();
    // §5.1 `noSponsors`: a communications blackout is a blackout. The law was
    // enforced in `sponsors.ts` and nowhere else, so a mentor's parachute went
    // on landing in arenas where nothing is supposed to reach anybody — which
    // is the exact class of individually-correct, jointly-untested behaviour
    // §5.6's stacked-law check exists to find, and is how this was found.
    if (arenaHasLaw(ctx.state, 'noSponsors')) return helped;
    const cycle = cycleOf(ctx.state);
    alive.forEach(t => {
        const mentor = t.mentorLegacy;
        if (!mentor) return;
        const pull = MENTOR_PULL[mentorTierOf(t)];
        if (pull <= 0) return;
        if (t.sponsorTrust < MENTOR_TRUST_FLOOR) return;

        // §7.6: an outstanding lesson resolves first. If they fixed it
        // themselves, the parachute finally comes — with the point attached.
        const withheldAt = ctx.state.mentorWithheld?.[t.id];
        if (withheldAt !== undefined) {
            if (cycle - withheldAt > MENTOR_DRAMA.lessonWindowCycles) {
                delete ctx.state.mentorWithheld![t.id];
            } else if (selfCorrected(t)) {
                delete ctx.state.mentorWithheld![t.id];
                if (ctx.rng.chance(MENTOR_DRAMA.correctedGiftChance)) {
                    // balance-exempt: fair coin between the two pointed-gift shapes
                    const gift = itemForNeed(ctx, t, ctx.rng.chance(0.5) ? 'water' : 'food');
                    giveItem(t, gift);
                    ensureMemory(t).giftsReceived += 1;
                    clampTribute(t);
                    helped.add(t.id);
                    ctx.logEvent(
                        ctx.pickText(MENTOR_POINTED_TEXTS)
                            .split('{mentor}').join(mentor)
                            .split('{tribute}').join(t.name)
                            .split('{item}').join(itemPhrase(gift))
                            .split('{zone}').join(t.zone),
                        [t.id],
                        { important: true, category: 'sponsor' }
                    );
                    return;
                }
            }
        }

        const need = urgentNeed(t);
        if (!need) return;

        // §7.6: the withheld gift. The mentor could afford this one — and the
        // tribute is dying of something they could fix themselves. No
        // parachute comes; the silence is the note.
        const mistake = survivableMistake(ctx, t);
        if (mistake && withheldAt === undefined && ctx.rng.chance(MENTOR_DRAMA.withholdChance)) {
            ctx.state.mentorWithheld = ctx.state.mentorWithheld ?? {};
            ctx.state.mentorWithheld[t.id] = cycle;
            if (ctx.rng.chance(MENTOR_DRAMA.withholdLineChance)) {
                ctx.logEvent(
                    ctx.pickText(MENTOR_WITHHELD_TEXTS)
                        .split('{mentor}').join(mentor)
                        .split('{tribute}').join(t.name)
                        .split('{zone}').join(t.zone),
                    [t.id],
                    { important: true, category: 'sponsor' }
                );
            }
            return;
        }
        if (withheldAt !== undefined && cycle - withheldAt <= MENTOR_DRAMA.lessonWindowCycles) return;

        const mem = ensureMemory(t);
        const chance = pull * Math.pow(MENTOR_REPEAT_DECAY, mem.giftsReceived);
        if (!ctx.rng.chance(chance)) {
            // A failed plea is worth saying out loud occasionally: it is the
            // only place the audience learns the mentor tried at all.
            if (ctx.rng.chance(0.12)) {
                ctx.logEvent(
                    ctx.pickText(MENTOR_PLEA_FAILED_TEXTS)
                        .split('{mentor}').join(mentor)
                        .split('{tribute}').join(t.name)
                        .split('{zone}').join(t.zone),
                    [t.id],
                    { category: 'sponsor' }
                );
            }
            return;
        }

        const gift = itemForNeed(ctx, t, need);
        giveItem(t, gift);
        mem.giftsReceived += 1;
        t.sponsorTrust = Math.max(0, t.sponsorTrust - MENTOR_TRUST_COST);
        t.excitementRating = Math.max(0, t.excitementRating - MENTOR_EXCITEMENT_COST);
        clampTribute(t);
        helped.add(t.id);

        ctx.logEvent(
            ctx.pickText(MENTOR_PARACHUTE_TEXTS)
                .split('{mentor}').join(mentor)
                .split('{tribute}').join(t.name)
                .split('{item}').join(itemPhrase(gift))
                .split('{zone}').join(t.zone)
                .split('{need}').join(NEED_PHRASES[need]),
            [t.id],
            { important: true, category: 'sponsor' }
        );
    });
    return helped;
}
