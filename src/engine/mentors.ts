import { SimContext } from './context';
import { ITEMS } from '../data/constants';
import { legacyOf, LegacyTier } from '../data/districts';
import { arenaHasLaw } from './gamesProfile';
import { MENTOR_PARACHUTE_TEXTS, MENTOR_PLEA_FAILED_TEXTS, MENTOR_POINTED_TEXTS, MENTOR_TIER_PARACHUTE, MENTOR_TIER_WITHHELD, MENTOR_WITHHELD_TEXTS } from '../data/flavorText';
import { giveItem, itemPhrase } from './items';
import { cycleOf, ensureMemory } from './memory';
import { clampTribute } from './vitals';
import { getZone, zoneFeatures } from './map';
import { Item, Tribute } from '../models/types';
import { mintItem } from './items';
import { MENTOR_DRAMA, MENTORS, QUALITY_BIAS, VICTOR_MENTOR } from '../data/balance';
import { allied } from './alliance';

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
export const MENTOR_GENEROSITY: Record<LegacyTier, number> = MENTORS.generosity;
export const MENTOR_PULL: Record<LegacyTier, number> = MENTORS.pull;
const MENTOR_TRUST_FLOOR = MENTORS.trustFloor;
const MENTOR_TRUST_COST = MENTORS.trustCost;
const MENTOR_EXCITEMENT_COST = MENTORS.excitementCost;
const MENTOR_REPEAT_DECAY = MENTORS.repeatDecay;

export function mentorTierOf(t: Tribute): LegacyTier {
    return legacyOf(t.district).tier;
}

/**
 * Audit 3 §10.4: the pool this tribute's mentor speaks from.
 *
 * A mentor from a district whose last victor came home twenty years ago and a
 * mentor from District 1 are doing the same job under completely different
 * conditions, and the tier already drives a 2.3x difference in win rate — so
 * the game was already saying they are not alike and only the prose disagreed.
 *
 * The tier pool is merged with the generic one rather than replacing it: most
 * of what a mentor does is the same whoever they are, and a tier pool of three
 * lines used alone would repeat inside one run.
 */
function mentorVoice(t: Tribute, byTier: Record<string, string[]>, generic: string[]): string[] {
    const tier = byTier[mentorTierOf(t)];
    return tier && tier.length > 0 ? [...generic, ...tier] : generic;
}

/**
 * Standing multiplier applied on top of the config's sponsor generosity.
 *
 * §9 (audit): a district whose last victor came home and took the mentor's
 * chair sponsors better than its pedigree alone would suggest. This is what
 * makes a crown carry into the next Games rather than stopping at the record
 * book — and it is deliberately larger for the thin districts, because a
 * District 12 victor is the only credible voice that district has ever had.
 */
export function mentorGenerosity(t: Tribute): number {
    const base = MENTOR_GENEROSITY[mentorTierOf(t)];
    if (!t.mentorIsVictor) return base;
    return base * VICTOR_MENTOR.generosityMultiplier;
}

/** Per-cycle plea chance, with the victor-mentor bonus folded in. */
export function mentorPull(t: Tribute): number {
    const base = MENTOR_PULL[mentorTierOf(t)];
    if (!t.mentorIsVictor) return base;
    // A forgotten district's victor has contacts for the first time in
    // living memory, so the floor lifts off zero rather than scaling from it.
    return Math.min(VICTOR_MENTOR.pullCap, Math.max(base, VICTOR_MENTOR.pullFloor) + VICTOR_MENTOR.pullBonus);
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
        const pull = mentorPull(t);
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
                    ctx.pickText(mentorVoice(t, MENTOR_TIER_WITHHELD, MENTOR_WITHHELD_TEXTS))
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
            ctx.pickText(mentorVoice(t, MENTOR_TIER_PARACHUTE, MENTOR_PARACHUTE_TEXTS))
                .split('{mentor}').join(mentor)
                .split('{tribute}').join(t.name)
                .split('{item}').join(itemPhrase(gift))
                .split('{zone}').join(t.zone)
                .split('{need}').join(NEED_PHRASES[need]),
            [t.id],
            { important: true, category: 'sponsor' }
        );

        // §4: mentor cross-talk. Two mentors whose tributes are in the same
        // alliance are watching the same camp on the same screen, and the
        // obvious thing for them to do — split the cost of one parachute
        // between them so it lands sooner — was not expressible: every gift
        // came from exactly one district's mentor to exactly one tribute.
        const ally = ctx.state.tributes.find(o =>
            o.status === 'alive'
            && o.id !== t.id
            && o.district !== t.district
            && allied(o, t)
            && o.zone === t.zone
            && o.mentorLegacy !== undefined
            && o.sponsorTrust >= MENTOR_TRUST_FLOOR);
        if (ally && ctx.rng.chance(MENTOR_DRAMA.crossTalkChance)) {
            const shared = itemForNeed(ctx, ally, urgentNeed(ally) ?? need);
            giveItem(ally, shared);
            ensureMemory(ally).giftsReceived += 1;
            ally.sponsorTrust = Math.max(0, ally.sponsorTrust - MENTOR_TRUST_COST);
            clampTribute(ally);
            helped.add(ally.id);
            ctx.logEvent(
                `${mentor} and ${ally.mentorLegacy} have evidently been talking. The second parachute comes down beside the first, `
                + `and ${ally.name} gets ${itemPhrase(shared)} out of a conversation happening a long way above their head.`,
                [t.id, ally.id],
                { type: 'mentor-cross-talk', important: true, category: 'sponsor', zone: t.zone }
            );
        }
    });
    return helped;
}
