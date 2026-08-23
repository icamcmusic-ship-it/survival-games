import { Terrain, Tribute } from '../models/types';
import { ITEMS } from '../data/constants';
import { BLEEDING, COMPOSURE, CRAFTING, DESPERATION, ENCOUNTERS, ESCALATION, HUNTING, MEMORY, POISONING, PROFICIENCY, ROMANCE, SANITY_BANDS, TOOLS, VITALS, ZONES, STANCE_MODES } from '../data/balance';
import { ALLIANCE_TEXTS, ENCOUNTER_TEXTS, SANITY_TEXTS } from '../data/flavorText';
import { ArenaActionKey, ArenaEventDef, actionPool, arenaFlavor } from '../data/arenaFlavor';
import { QUIRKS } from '../data/quirks';
import { SimContext } from './context';
import { applyDamage, checkDeath, resolveCombat } from './combat';
import { depleteZone, depletionOf, effectiveResources, getZone } from './map';
import { addZoneThreat, hasVengeanceAgainst, noteContact, noteSighting, noteStoodBy, raiseSuspicion } from './memory';
import { adjustMutual, adjustRel, getRel } from './relationships';
import { hasTruce, tryParley } from './parley';
import { areLovers, maintainPerformance } from './alliance';
import { incurDebt } from './debts';
import { DEBTS } from '../data/balance';
import { giveItem, hasTool, itemPhrase, mintItem, spoilageBonus } from './items';
import { clampTribute } from './vitals';
import { attemptFieldDressing, clearBleeding, healInjury, injure, injuryGrade, openWound, shouldDressWound } from './wounds';
import { profOf, trainProficiency, observeProficiency } from './proficiency';
import { attemptFieldcraft, poisonWeapon } from './fieldcraft';
import { composureOf } from './composure';
import { sanityBandOf } from './sanityBands';
import { resolveMuttAttack as resolveMuttAttackImpl } from './mutts';
import { hasEffect, severRandomEdge, startZoneEffect } from './zoneEffects';
import { arenaHasLaw } from './gamesProfile';
import { traitMod } from '../data/traits';
import { QUALITY_BIAS } from '../data/balance';
import { isAggressiveStance, isDefensiveStance, isEvasiveStance } from '../data/stances';

export function fill(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(value),
        template
    );
}


/**
 * Escaping an arena hazard — the whole of it, in one place, for both the
 * tribute the event fired on and anyone else caught in a zone-wide one.
 *
 * SIDE-09: across the hundred authored arena events the dodge stats were
 * intelligence 34, agility 29, stealth 15, strength 5, charisma 1. Two of the
 * five attributes were very nearly irrelevant to surviving the arena itself,
 * which quietly made them dump stats: a tribute could be strong and beloved
 * and still be exactly as likely to drown as anyone else.
 *
 * Rather than rewrite a hundred pieces of authored copy — the primary stat on
 * each event is usually the right one, and "you read the chimes correctly" is
 * not a strength check — the two missing attributes get structural lanes that
 * apply across every event:
 *
 *  - **Strength is the brace.** Anything that hits hard or tries to take hold
 *    of the body can be endured rather than avoided. A failed dodge on a heavy
 *    physical hazard gets a second roll against strength, and strength shaves
 *    damage off whatever still lands.
 *  - **Charisma is the hand.** Somebody in the zone who likes you can pull you
 *    out. That is only available to a tribute who has people, which is exactly
 *    what charisma buys.
 */

/** Whether a hazard is the kind of thing a strong tribute can simply take. */
function bracingHelps(event: ArenaEventDef): boolean {
    return (event.damage ?? 0) >= ENCOUNTERS.braceDamageThreshold
        || event.frostbitten === true || event.infected === true
        || event.poisoned === true || event.burned === true;
}

/** Damage actually taken after bracing for it. */
function bracedDamage(t: Tribute, event: ArenaEventDef): number {
    const raw = event.damage ?? 0;
    if (raw <= 0 || !bracingHelps(event)) return raw;
    const soak = Math.min(ENCOUNTERS.braceMaxSoak, t.attributes.strength * ENCOUNTERS.bracePerStrength);
    return Math.max(1, Math.round(raw * (1 - soak)));
}

/**
 * The full escape check. Returns true if the tribute got clear, having already
 * logged whichever way they managed it.
 */
function rollEscape(ctx: SimContext, t: Tribute, event: ArenaEventDef, isBoon: boolean): boolean {
    const vars = { tribute: t.name, zone: t.zone };
    const log = (text: string) =>
        ctx.logEvent(fill(text, vars), [t.id], { category: isBoon ? 'survival' : 'hazard' });

    const difficulty = event.dodgeDifficulty ?? ENCOUNTERS.defaultDodgeDifficulty;
    // T-5: how well you get out of the way depends on how bad the leg is.
    const penalty = injuryGrade(t, 'legs') * ENCOUNTERS.legsDodgePenaltyPerGrade;

    if (event.dodgeStat) {
        const roll = t.attributes[event.dodgeStat] + ctx.rng.nextInt(0, 4) - penalty;
        if (roll > difficulty) {
            log(event.escapeText);
            return true;
        }
    }

    // The brace. Harder than getting out of the way, because it is not getting
    // out of the way — it is being built to survive not getting out of the way.
    const alt = event.dodgeAlt ?? (bracingHelps(event) ? 'strength' : undefined);
    if (alt && alt !== event.dodgeStat) {
        const roll = t.attributes[alt] + ctx.rng.nextInt(0, 4) - penalty;
        if (roll > difficulty + ENCOUNTERS.altDodgePenalty) {
            log(alt === 'strength'
                ? `{tribute} takes the worst of it in {zone} and is still standing when it passes.`
                : event.escapeText);
            return true;
        }
    }

    // The hand. Only a tribute who has people gets this, and only from people
    // who are actually standing there.
    if (!isBoon) {
        const helpers = ctx.state.tributes.filter(o =>
            o.status === 'alive' && o.id !== t.id && o.zone === t.zone
            && (o.allianceId !== undefined && o.allianceId === t.allianceId));
        if (helpers.length > 0) {
            const helper = helpers[0];
            // R-4: the absence of aid is as socially informative as aid. An
            // ally who holds you in low regard may simply not reach — and you
            // see it, which is worth resentment and a watched back, not a
            // shrug. Refusal is a decision, so it is logged like one.
            if (getRel(helper, t.id) < DEBTS.refusalRegardThreshold && ctx.rng.chance(DEBTS.refusalChance)) {
                adjustRel(t, helper.id, -DEBTS.refusalResentment);
                raiseSuspicion(t, helper.id, DEBTS.refusalSuspicion);
                ctx.logEvent(
                    `${helper.name} is close enough to reach ${t.name} in ${t.zone}, and doesn't. ${t.name} sees exactly how close, and files it away.`,
                    [t.id, helper.id],
                    { category: 'alliance' }
                );
                return false;
            }
            const chance = Math.min(ENCOUNTERS.rescueMaxChance,
                t.attributes.charisma * ENCOUNTERS.rescuePerCharisma
                + helper.attributes.strength * ENCOUNTERS.rescuePerHelperStrength);
            if (ctx.rng.chance(chance)) {
                ctx.logEvent(
                    `${helper.name} has a fistful of ${t.name}'s jacket before ${t.name} knows what is happening, and hauls them clear of it in ${t.zone}.`,
                    [t.id, helper.id],
                    { important: true, category: 'alliance' }
                );
                // Deliberately not `noteStoodBy`: that is the gate romance is
                // built on, and hauling an ally out of a rockslide is common
                // enough that counting it there quietly doubled the number of
                // runs with star-crossed lovers in them.
                adjustRel(t, helper.id, ENCOUNTERS.rescueGratitude);
                return true;
            }
        }
    }

    return false;
}

/**
 * Applies one arena-specific event to a tribute, honouring their dodge stat.
 * Shared by the tribute who triggers the event and by anyone else caught in
 * it when it's `zoneWide` — every field the event carries (damage, injuries,
 * vitals, item grants) lands on a secondary tribute exactly as it does on the
 * primary one. `narrate` suppresses the per-tribute log line for secondaries,
 * who get one grouped line instead — see `applyArenaEvent` below.
 */
function applyEventTo(ctx: SimContext, t: Tribute, event: ArenaEventDef, narrate: boolean): boolean {
    const isBoon = (event.heal ?? 0) > 0 || (event.quench ?? 0) > 0 || (event.feed ?? 0) > 0;
    const vars = { tribute: t.name, zone: t.zone };

    if (rollEscape(ctx, t, event, isBoon)) return false;

    if (event.damage) applyDamage(ctx, t, bracedDamage(t, event), { cause: event.cause, kind: 'hazard' });
    if (event.heal) t.health = Math.min(100, t.health + event.heal);
    if (event.bleeding) openWound(t, BLEEDING.hazardSeverity);
    if (event.poisoned) injure(t, 'poisoned');
    if (event.burned) injure(t, 'burned');
    if (event.frostbitten) injure(t, 'frostbitten');
    if (event.infected) injure(t, 'infected');
    if (event.sanity) t.vitals.sanity -= event.sanity;
    if (event.thirst) t.vitals.thirst += event.thirst;
    if (event.hunger) t.vitals.hunger += event.hunger;
    if (event.fatigue) t.vitals.fatigue += event.fatigue;
    if (event.quench) t.vitals.thirst = Math.max(0, t.vitals.thirst - event.quench);
    if (event.feed) t.vitals.hunger = Math.max(0, t.vitals.hunger - event.feed);
    if (event.grantItem) {
        const item = ITEMS.find(i => i.id === event.grantItem);
        if (item) giveItem(t, mintItem(ctx.rng, item, QUALITY_BIAS.scavenged));
    }
    clampTribute(t);

    if (!isBoon) addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat);

    if (narrate) {
        ctx.logEvent(fill(event.text, vars), [t.id], {
            important: !isBoon,
            category: isBoon ? 'survival' : 'hazard',
        });
    }
    if (!isBoon) checkDeath(ctx, t, event.cause);
    return true;
}

/** Applies one arena-specific event to a tribute, honouring their dodge stat. */
export function applyArenaEvent(ctx: SimContext, t: Tribute, event: ArenaEventDef) {
    const isBoon = (event.heal ?? 0) > 0 || (event.quench ?? 0) > 0 || (event.feed ?? 0) > 0;
    if (!applyEventTo(ctx, t, event, true)) return;

    // ARENA-03: hazards used to touch exactly one tribute and nothing else —
    // never a whole zone, never the graph, never anything that outlasted the
    // instant it fired. A flash flood or a rockslide is not a private accident;
    // everyone standing there lives through the same thing, with the same
    // effects (not just damage) and a line in the chronicle naming them.
    if (event.zoneWide) {
        const caught = ctx.state.tributes
            .filter(o => o.status === 'alive' && o.id !== t.id && o.zone === t.zone)
            .filter(o => applyEventTo(ctx, o, event, false));
        if (caught.length > 0) {
            ctx.logEvent(
                `${caught.map(o => o.name).join(', ')} ${caught.length > 1 ? 'are' : 'is'} caught in it with ${t.name}.`,
                [t.id, ...caught.map(o => o.id)],
                { important: !isBoon, category: isBoon ? 'survival' : 'hazard' }
            );
        }
    }
    // §7e: a zone-wide event that nobody else was caught by was still seen.
    // Being a witness is its own thing — it feeds nothing mechanical here, it
    // simply means the feed names the people who watched it happen.
    if (event.witnesses) {
        const watching = ctx.state.tributes.filter(o =>
            o.status === 'alive' && o.id !== t.id && o.zone === t.zone);
        if (watching.length > 0) {
            ctx.logEvent(
                `${watching.map(o => o.name).join(', ')} ${watching.length > 1 ? 'watch' : 'watches'} it happen to ${t.name} from close enough to have done something about it.`,
                [t.id, ...watching.map(o => o.id)],
                { category: isBoon ? 'survival' : 'hazard' }
            );
        }
    }
    // §7e: one-time beats, recorded so the arena's set piece stays a set piece.
    if (event.oncePerRun && event.id) {
        ctx.state.firedEvents = [...(ctx.state.firedEvents ?? []), event.id];
    }
    // §7e: and the second half of a two-part story, queued on this tribute.
    if (event.chain) {
        ctx.state.eventChains = ctx.state.eventChains ?? {};
        ctx.state.eventChains[t.id] = event.chain;
    }
    if (event.startsZoneEffect) startZoneEffect(ctx, t.zone, event.startsZoneEffect);
    if (event.severesRoute) {
        const cut = severRandomEdge(ctx, t.zone);
        if (cut) {
            ctx.logEvent(
                `The route between ${t.zone} and ${cut} is gone. Whatever crossed it, nothing is crossing it now.`,
                [],
                { important: true, zone: t.zone, category: 'hazard' }
            );
        }
    }
}

/** Rough terrain a hand-authored event was written for, guessed from its own words. */
const TERRAIN_KEYWORDS: Array<[Terrain, RegExp]> = [
    ['water', /flood|drown|riptide|whirlpool|surf|tidal|river|current|swim|lake|geothermal vent|steam vent|water tank/i],
    ['highland', /rockfall|rockslide|avalanche|crevasse|cliff|peak|ridge|summit|whiteout|blizzard/i],
    ['wetland', /swamp|bog|marsh|leech|quicksand|sinkhole|mud|spore/i],
    ['forest', /canopy|vine|timber|jungle fruit|army ants|insect swarm|falling branch/i],
    ['ruins', /building collapse|stairwell|sewer|tunnel|wire|tank water|gas explosion|rubble/i],
    ['open', /sandstorm|dust devil|mirage|sun|solar flare|dune|ash storm|lava|magma|volcanic/i],
];

/** Best-guess terrain(s) for an event that never had `terrains` set explicitly. Cached per event def — the defs are shared module-level objects, and the regex sweep was previously re-run on every pick. */
const inferredTerrainsCache = new WeakMap<ArenaEventDef, Terrain[] | undefined>();
function inferredTerrains(event: ArenaEventDef): Terrain[] | undefined {
    if (inferredTerrainsCache.has(event)) return inferredTerrainsCache.get(event);
    const haystack = `${event.cause} ${event.text}`;
    const hits = TERRAIN_KEYWORDS.filter(([, pattern]) => pattern.test(haystack)).map(([terrain]) => terrain);
    const result = hits.length > 0 ? hits : undefined;
    inferredTerrainsCache.set(event, result);
    return result;
}

/**
 * ARENA-10: event selection used to be a uniform draw from the whole arena
 * event list regardless of which zone the tribute stood in — a tribute on
 * Glacier Peak could trigger "Thin Ice Collapse" on solid rock. Events tagged
 * with `terrains` are filtered to zones that actually match; untagged legacy
 * events fall back to a keyword guess from their own `cause`/`text` rather than
 * needing every hand-authored event rewritten by hand. An event that matches
 * nothing (no explicit tag, no keyword hit) is terrain-neutral by default and
 * stays eligible everywhere, which is the correct behaviour for genuinely
 * generic hazards like a Gamemaker-triggered storm.
 */
/**
 * §7e: whether an event's `requires` block holds right now.
 *
 * Terrain was the only thing an event could key off, which is why every
 * authored event reads as weather: there was no way to write "only once the
 * zone is already burning", "only after dark", "only when six are left" or
 * "only under this law". Absent fields are unconstrained, so every existing
 * event is eligible exactly as before.
 */
function requirementsHold(ctx: SimContext, t: Tribute, event: ArenaEventDef): boolean {
    const need = event.requires;
    if (!need) return true;
    if (need.effect && !hasEffect(ctx.state, t.zone, need.effect)) return false;
    if (need.time && ctx.state.phase !== need.time) return false;
    if (need.law && !arenaHasLaw(ctx.state, need.law)) return false;
    if (need.minSurvivors !== undefined || need.maxSurvivors !== undefined) {
        const alive = ctx.state.tributes.filter(o => o.status === 'alive').length;
        if (need.minSurvivors !== undefined && alive < need.minSurvivors) return false;
        if (need.maxSurvivors !== undefined && alive > need.maxSurvivors) return false;
    }
    return true;
}

/** §7e: an event that has already had its one turn this run. */
function spent(ctx: SimContext, event: ArenaEventDef): boolean {
    return event.oncePerRun === true && event.id !== undefined
        && (ctx.state.firedEvents ?? []).includes(event.id);
}

/**
 * §7e: the event this tribute is owed from last cycle, if the arena set one up.
 * Consumed on read — a chain is a two-part story, not a standing condition.
 */
export function pendingChain(ctx: SimContext, t: Tribute, events: ArenaEventDef[]): ArenaEventDef | undefined {
    const queued = ctx.state.eventChains?.[t.id];
    if (!queued) return undefined;
    delete ctx.state.eventChains![t.id];
    return events.find(e => e.id === queued);
}

export function pickTerrainEvent(ctx: SimContext, events: ArenaEventDef[], terrain: Terrain | undefined, t?: Tribute): ArenaEventDef {
    const fits = (event: ArenaEventDef) => {
        const tags = event.terrains ?? inferredTerrains(event);
        return !tags || tags.includes(terrain!);
    };
    // §7e: state gates first — an event whose preconditions do not hold is not
    // a worse fit for this zone, it is not an option at all.
    const eligible = events.filter(e => !spent(ctx, e) && (!t || requirementsHold(ctx, t, e)));
    const gated = eligible.length > 0 ? eligible : events.filter(e => !spent(ctx, e));
    events = gated.length > 0 ? gated : events;
    const pool = terrain ? events.filter(fits) : events;
    const candidates = pool.length > 0 ? pool : events;
    // §1.3: weighted, not uniform. `withUniversalEvents` marks the shared pool
    // down so an arena with five authored events still reads as itself.
    const total = candidates.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    if (total <= 0) return ctx.rng.pick(candidates);
    let roll = ctx.rng.nextFloat() * total;
    for (const event of candidates) {
        roll -= event.weight ?? 1;
        if (roll <= 0) return event;
    }
    return candidates[candidates.length - 1];
}

/**
 * A mutt pack finds someone.
 *
 * ARENA-04: every mutt used to be an interchangeable flavour string, a fixed
 * evasion threshold and a flat 40 damage — Tick-Tock Monkeys and Acid Fog did
 * the same thing. Resolution now lives in ./mutts, keyed off a real per-arena
 * roster (src/data/mutts.ts) with its own speed, pack size, injuries, terrain
 * and time-of-day gating. `time` is optional so this call site keeps working
 * unchanged; the lead should thread the real `time` through from dayNight.ts.
 */
export function resolveMuttAttack(ctx: SimContext, t: Tribute, time: 'day' | 'night' = 'day') {
    resolveMuttAttackImpl(ctx, t, time);
}

/**
 * One direction of ally-to-ally aid: `giver` hands `needer` whatever they're
 * short on, if the giver is carrying it to spare. Called both ways so a
 * bleeding tribute next to a medkit — or one dying of thirst next to a
 * spare bottle — actually gets helped, not just the hungry one.
 */
function shareAllianceSupplies(ctx: SimContext, needer: Tribute, giver: Tribute) {
    if (needer.injuries.bleeding || needer.injuries.infected || needer.injuries.burned) {
        const medIdx = giver.inventory.findIndex(i => i.type === 'medical');
        if (medIdx >= 0) {
            const item = giver.inventory.splice(medIdx, 1)[0];
            healInjury(needer, 'infected');
            healInjury(needer, 'burned');
            clearBleeding(needer);
            needer.health = Math.min(100, needer.health + 15);
            trainProficiency(giver, 'medicine');
            incurDebt(needer, giver, DEBTS.patchedUp);
            ctx.logEvent(`${giver.name} presses their ${item.name} into ${needer.name}'s hands and helps patch them up.`, [needer.id, giver.id], { important: true, category: 'alliance' });
            return;
        }
        // No supplies is not the same as no help. An ally with free hands and a
        // clear view of the wound is the best field dressing available, and it
        // gives an alliance a medical reason to exist as well as a tactical one.
        if (needer.injuries.bleeding && attemptFieldDressing(ctx, needer, giver)) {
            adjustMutual(ctx.state, needer, giver, 8);
            incurDebt(needer, giver, DEBTS.patchedUp);
            return;
        }
    }
    if (needer.vitals.thirst > 40) {
        const waterIdx = giver.inventory.findIndex(i => i.type === 'water');
        if (waterIdx >= 0) {
            const item = giver.inventory.splice(waterIdx, 1)[0];
            needer.vitals.thirst = Math.max(0, needer.vitals.thirst - 40);
            // Handing over water you might need yourself is a real risk, and it
            // is what romance is gated on rather than mere proximity.
            if (giver.vitals.thirst > 30) incurDebt(needer, giver, DEBTS.gaveSupplies);
            ctx.logEvent(`${giver.name} hands ${needer.name} their ${item.name} without being asked.`, [needer.id, giver.id], { category: 'alliance' });
            return;
        }
    }
    if (needer.vitals.hunger > 40) {
        const foodIdx = giver.inventory.findIndex(i => i.type === 'food');
        if (foodIdx >= 0) {
            const item = giver.inventory.splice(foodIdx, 1)[0];
            needer.vitals.hunger = Math.max(0, needer.vitals.hunger - 40);
            if (giver.vitals.hunger > 30) incurDebt(needer, giver, DEBTS.gaveSupplies);
            ctx.logEvent(`${giver.name} hands ${needer.name} their ${item.name} without being asked.`, [needer.id, giver.id], { category: 'alliance' });
        }
    }
}

/**
 * Whether the arithmetic of the arena has finally caught up with two people who
 * have no particular quarrel. Only one tribute goes home; a genuine bond can
 * still hold, but indifference cannot.
 */
function isDesperate(ctx: SimContext, t: Tribute, other: Tribute): boolean {
    const mutual = Math.min(getRel(t, other.id), getRel(other, t.id));
    if (mutual >= DESPERATION.sparedBond) return false;
    // A1/§1.11: somebody actually *in* the Desperate stance does not need the
    // field to have narrowed. That was the whole complaint — `desperationFights`
    // measured 15 across 400 runs because desperation was a coin flip gated on
    // an endgame field size rather than a state a tribute can be in. Now it is
    // a state, and being in it is itself the reason the meeting goes this way.
    if (t.stance === 'Desperate' || other.stance === 'Desperate') {
        return ctx.rng.chance(DESPERATION.stanceHostility);
    }
    const alive = ctx.state.tributes.filter(o => o.status === 'alive').length;
    if (alive > DESPERATION.fieldSize) return false;
    const chance = DESPERATION.baseHostility
        + Math.max(0, DESPERATION.fieldSize - alive) * DESPERATION.perTributeBelow;
    return ctx.rng.chance(Math.min(0.95, chance));
}

/** A pair who happen to be standing in the same zone with time on their hands. */
export function resolvePairEncounter(ctx: SimContext, t: Tribute, other: Tribute) {
    const inSameAlliance = t.allianceId !== undefined && t.allianceId === other.allianceId;
    const relationship = getRel(t, other.id);
    const vars = { t1: t.name, t2: other.name, zone: t.zone };
    noteContact(ctx.state, t, other);

    // A sworn debt overrides everything else in the arena.
    if (hasVengeanceAgainst(t, other.id) || hasVengeanceAgainst(other, t.id)) {
        resolveCombat(ctx, t, other);
        return;
    }

    // §7: the forced finale. Once the Gamemakers have drained the arena down
    // to the horn (see forceFinale in dayNight.ts), a meeting between the last
    // two is the finale, whatever they feel about each other — warmth, a
    // truce, shared supplies, none of it holds when the arena has made itself
    // this small. Lovers are the one exception: their refusal to fight is the
    // nightlock standoff, and `checkDualVictory` resolves it.
    const aliveNow = ctx.state.tributes.filter(o => o.status === 'alive').length;
    if (aliveNow <= ESCALATION.finalistCount
        && (ctx.state.finalistCycles ?? 0) >= ESCALATION.finaleAfterFinalistCycles
        && !areLovers(t, other)) {
        ctx.logEvent(
            `${t.name} and ${other.name}, and nowhere left in the arena that is not ${t.zone}. Both of them know what the Gamemakers have arranged.`,
            [t.id, other.id],
            { important: true, category: 'combat' }
        );
        resolveCombat(ctx, t, other);
        return;
    }

    if (inSameAlliance) {
        // Share resources within alliance — in both directions, and not just food.
        shareAllianceSupplies(ctx, t, other);
        shareAllianceSupplies(ctx, other, t);
        adjustMutual(ctx.state, t, other, 5);
        // §11.1: a shared camp scene is a performance opportunity — the
        // performer's shown warmth is refreshed by playing it.
        maintainPerformance(t, other.id, ROMANCE.performedUpkeep);
        maintainPerformance(other, t.id, ROMANCE.performedUpkeep);
        ctx.logEvent(fill(ctx.pickText(ALLIANCE_TEXTS.support), vars), [t.id, other.id], { category: 'alliance' });
    } else if (hasTruce(ctx.state, t, other.id)) {
        // An explicit agreement with a clock on it outranks a bad mood *and*
        // ordinary warmth — it is the more specific thing that is true about
        // this pair. It sat below the `relationship > 20` branch, and since
        // striking a truce grants mutual regard and a `stoodBy` credit, truce
        // partners were reliably warm enough to be captured by that branch
        // first: the truce branch never once executed across a 240-run soak,
        // taking every `truceHeld` line and the whole break path with it.
        //
        // Sworn vengeance (handled above) still overrides it, and so does the
        // endgame arithmetic once somebody breaks the truce below.
        if (!tryParley(ctx, t, other)) {
            // tryParley returns null here only when one of them has just gone
            // back on their word. The knife is the point of doing that.
            resolveCombat(ctx, t, other);
        } else if (relationship > 20) {
            // Still on good terms underneath the agreement: they eat together.
            t.vitals.hunger = Math.max(0, t.vitals.hunger - 10);
            other.vitals.hunger = Math.max(0, other.vitals.hunger - 10);
            adjustMutual(ctx.state, t, other, 5);
        }
    } else if (relationship > 20) {
        ctx.logEvent(fill(ctx.pickText(ENCOUNTER_TEXTS.shareResources), vars), [t.id, other.id], { category: 'alliance' });
        t.vitals.hunger = Math.max(0, t.vitals.hunger - 10);
        other.vitals.hunger = Math.max(0, other.vitals.hunger - 10);
        adjustMutual(ctx.state, t, other, 5);
        maintainPerformance(t, other.id, ROMANCE.performedUpkeep);
        maintainPerformance(other, t.id, ROMANCE.performedUpkeep);
    } else if (isDesperate(ctx, t, other)) {
        // Ordered ahead of the hostile-meeting branch on purpose: a tribute
        // past caring is not going to be talked out of anything, so routing
        // them through `tryParley` first would just describe them negotiating.
        ctx.logEvent(
            fill(ctx.pickText(ENCOUNTER_TEXTS.desperation), vars),
            [t.id, other.id],
            { important: true, category: 'combat' }
        );
        resolveCombat(ctx, t, other);
    } else if (isAggressiveStance(t.stance) || isAggressiveStance(other.stance) || relationship < -10) {
        // Even a hostile meeting can end in a negotiation rather than a fight,
        // if neither of them likes the odds enough to start one.
        if (!tryParley(ctx, t, other)) resolveCombat(ctx, t, other);
    } else if (tryParley(ctx, t, other)) {
        // Two wary strangers who talked their way out of it — the outcome the
        // encounter layer had no vocabulary for.
    } else if (ctx.rng.chance(0.5)) {
        ctx.logEvent(fill(ctx.pickText(ENCOUNTER_TEXTS.peaceful), vars), [t.id, other.id], { category: 'survival' });
    } else {
        ctx.logEvent(fill(ctx.pickText(ENCOUNTER_TEXTS.friendly), vars), [t.id, other.id], { category: 'alliance' });
        t.vitals.sanity = Math.min(100, t.vitals.sanity + 10);
        other.vitals.sanity = Math.min(100, other.vitals.sanity + 10);
        adjustMutual(ctx.state, t, other, 10);
    }
    clampTribute(t);
    clampTribute(other);
}

/**
 * Idle turn. Foraging draws a zone down, so a rich forest is a prize two
 * tributes can strip between them rather than an infinite larder.
 */
/** Attempts to forage in the tribute's current zone; returns whether anything was found. */
function attemptForage(
    ctx: SimContext,
    t: Tribute,
    flavor: ReturnType<typeof arenaFlavor>,
    chance: number,
): boolean {
    if (!ctx.rng.chance(chance)) {
        depleteZone(ctx.state, t.zone, ZONES.depletionPerAttempt);
        return false;
    }
    // Foraging mostly turns up food and water, but the woods also hold things
    // that are only useful to someone who does not intend to eat them.
    // A scavenger turns up things nobody left on purpose: a dropped pack, a
    // coil of wire in the ruins, matches in a dead tribute's coat.
    const pool = ctx.rng.chance(ZONES.nightlockChance)
        ? ITEMS.filter(i => i.id === 'nightlock')
        : ctx.rng.chance(traitMod(t, 'scavenge'))
            ? ITEMS.filter(i => i.type === 'utility' && i.id !== 'nightlock')
            : ITEMS.filter(i => i.type === 'food' || i.type === 'water');
    const item = ctx.rng.pick(pool);
    // Clone before touching spoilage: `item` is the shared ITEMS entry.
    const fresh = mintItem(ctx.rng, item, QUALITY_BIAS.scavenged);
    if (fresh.type === 'food' && fresh.spoilage !== undefined) fresh.spoilage += spoilageBonus(t);
    const dropped = giveItem(t, fresh);
    trainProficiency(t, 'forage', ctx);
    // §3.10: anybody standing here watched them do it.
    observeProficiency(ctx, t, 'forage');
    depleteZone(ctx.state, t.zone, ZONES.depletionPerForage);
    ctx.logEvent(
        fill(ctx.pickText(flavor.actions.forage), { tribute: t.name, zone: t.zone, item: itemPhrase(fresh) }),
        [t.id],
        { category: 'loot' }
    );
    if (dropped.length > 0) {
        ctx.logEvent(
            `${t.name} cannot carry it all and leaves ${dropped.map(i => i.name).join(', ')} behind in ${t.zone}.`,
            [t.id],
            { category: 'loot' }
        );
    }
    return true;
}

/**
 * The Aggressive turn: a directed sweep of the zone rather than a flavour line.
 *
 * Hunting used to be strictly dominated — you could not forage, you took the
 * same status damage as everyone else, and a rival standing in your zone still
 * only had a 40% chance of turning into an encounter. It was a stance that cost
 * you food and bought you nothing, which is why almost nobody picked it.
 */
function huntAction(ctx: SimContext, t: Tribute, flavor: ReturnType<typeof arenaFlavor>) {
    const zone = getZone(ctx.state.arena, t.zone);
    // §11.5: a fishing kit makes still water a hunter's larder too.
    const fishingEdge = hasTool(t, 'fishing') && (zone?.terrain === 'water' || zone?.terrain === 'wetland')
        ? TOOLS.fishingHuntBonus
        : 0;
    const gameChance = HUNTING.gameChance + profOf(t, 'tracking') * HUNTING.trackingBonus + fishingEdge;
    if (ctx.rng.chance(gameChance)) {
        t.vitals.hunger = Math.max(0, t.vitals.hunger - HUNTING.gameFeed);
        trainProficiency(t, 'tracking');
        clampTribute(t);
        ctx.logEvent(
            `${t.name} runs down something small in ${t.zone} and eats it where it fell.`,
            [t.id],
            { category: 'survival' }
        );
        return;
    }
    ctx.logEvent(fill(ctx.pickText(actionPool(flavor, 'hunt')), { tribute: t.name, zone: t.zone }), [t.id], { category: 'survival' });
}

export function idleAction(ctx: SimContext, t: Tribute, flavor: ReturnType<typeof arenaFlavor>) {
    const zone = getZone(ctx.state.arena, t.zone);
    const available = effectiveResources(ctx.state, zone);
    // A net in still water is not foraging, it is fishing, and it works.
    const fishing = hasTool(t, 'fishing')
        && (zone?.terrain === 'water' || zone?.terrain === 'wetland');
    const baseForageChance = ZONES.baseForageChance
        + (fishing ? ZONES.fishingBonus : 0)
        // §11.5: a light after dark turns groping into searching.
        + (ctx.state.timeOfDay === 'night' && hasTool(t, 'light') ? TOOLS.lightNightForageBonus : 0)
        + available * ZONES.yieldForageWeight
        + (t.archetype === 'survivalist' ? ZONES.survivalistForageBonus : 0)
        + traitMod(t, 'forage')
        + profOf(t, 'forage') * PROFICIENCY.forageWeight
        // §3.4: steady hands find food; shaking ones miss it.
        + composureOf(t) * COMPOSURE.forageWeight
        // §3.5: a tribute who is unravelling stops trusting what they pick.
        - (sanityBandOf(t) === 'unravelling' || sanityBandOf(t) === 'gone' ? SANITY_BANDS.unravellingForagePenalty : 0);

    // §6.4: anyone holding a clean blade and something to coat it with takes
    // the opportunity — nightlock spoils, and a poisoned edge is the outer
    // districts' great equaliser.
    if (t.inventory.some(i => i.type === 'weapon' && !i.poison)
        && t.inventory.some(i => (POISONING.sources as readonly string[]).includes(i.id))
        && ctx.rng.chance(POISONING.coatOpportunityChance)
        && poisonWeapon(ctx, t)) {
        return;
    }

    // A wound that is actually running is the most urgent thing in their life,
    // whatever stance they are in. This is the move the simulation was missing:
    // it needs no item and it is available to everyone.
    if (shouldDressWound(t)) {
        attemptFieldDressing(ctx, t);
        return;
    }

    // T-7: a quiet cycle is when the cameras find the habit. Colour only —
    // the turn still proceeds to whatever they were going to do.
    if (t.quirks?.length && ctx.rng.chance(ZONES.quirkLineChance)) {
        const quirk = QUIRKS.find(q => q.label === ctx.rng.pick(t.quirks!));
        if (quirk) {
            ctx.logEvent(
                quirk.line.split('{name}').join(t.name).split('{zone}').join(t.zone),
                [t.id],
                { category: 'survival' }
            );
        }
    }

    // Preparation is a use of a turn. A tribute who is not bleeding, not being
    // hunted and not starving sometimes spends the hour on a snare, a fire or a
    // shelter instead of picking berries — which is the whole difference
    // between surviving the arena and working it.
    if (t.vitals.hunger < VITALS.eatThreshold && ctx.rng.chance(CRAFTING.fieldcraftChance)
        && attemptFieldcraft(ctx, t)) {
        return;
    }

    // A1: the conditional stances each spend an idle turn differently. Handled
    // ahead of the family fallbacks below so a Fortified tribute is described
    // fortifying rather than "resting", which is what the stance would have
    // degraded to on its family alone.
    const say = (key: ArenaActionKey) => ctx.logEvent(
        fill(ctx.pickText(actionPool(flavor, key)), { tribute: t.name, zone: t.zone }),
        [t.id],
        { category: 'survival' }
    );

    if (t.stance === 'Fortified') {
        // Prepared ground feeds its occupant: they know where everything in it
        // is by now. Failing that, the hour goes on the position itself.
        if (attemptForage(ctx, t, flavor, baseForageChance)) {
            noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
            return;
        }
        // Another trap, another sightline — the fortification is the turn.
        if (attemptFieldcraft(ctx, t)) return;
        say('fortify');
        noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
        return;
    }

    if (t.stance === 'Scavenging') {
        // Ground others have stripped of food still holds what they dropped.
        if (attemptForage(ctx, t, flavor, baseForageChance + STANCE_MODES.scavenging.pickingsBonus)) {
            noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
            return;
        }
        say('scavenge');
        noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
        return;
    }

    if (t.stance === 'Shadowing') {
        // A shadow does not stop to forage. The turn is the following.
        say('shadow');
        return;
    }

    if (t.stance === 'Desperate') {
        // They will eat anything and they will look anywhere.
        if (attemptForage(ctx, t, flavor, baseForageChance * ZONES.aggressiveForageMultiplier)) {
            return;
        }
        say('flail');
        return;
    }

    if (isEvasiveStance(t.stance)) {
        // Hiding does not mean starving — there is still a stream in whatever
        // zone they went to ground in, just a much smaller chance they risk
        // reaching for it instead of staying still.
        if (attemptForage(ctx, t, flavor, baseForageChance * ZONES.evasiveForageMultiplier)) {
            noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
            return;
        }
        say('hide');
        return;
    }

    if (isDefensiveStance(t.stance)) {
        if (!attemptForage(ctx, t, flavor, baseForageChance)) {
            const stripped = depletionOf(ctx.state, t.zone) > ENCOUNTERS.strippedZoneNotice;
            if (stripped) {
                ctx.logEvent(
                    `${t.name} works over ${t.zone} and finds it already stripped bare. Someone has been here first.`,
                    [t.id],
                    { category: 'survival' }
                );
            } else {
                say('rest');
            }
        }
        noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
        return;
    }

    // Aggressive: hunting still passes a stream or a berry bush in the same
    // zone, just at a reduced chance since finding food was not the point.
    if (attemptForage(ctx, t, flavor, baseForageChance * ZONES.aggressiveForageMultiplier)) {
        noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
        return;
    }
    huntAction(ctx, t, flavor);
}

/** A tribute whose mind has come apart loses the turn to it. */
export function handleInsanity(ctx: SimContext, t: Tribute) {
    const roll = ctx.rng.nextFloat();
    const vars = { tribute: t.name, zone: t.zone };
    if (roll < 0.4) {
        ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.hallucination), vars), [t.id], { important: true, category: 'sanity' });
        t.vitals.sanity -= 5;
    } else if (roll < 0.7) {
        // A generated identity stat should not ratchet toward zero every time
        // sanity dips below the breakdown threshold — cap the lifetime damage
        // a breakdown can do to it.
        const lost = t.sanityStealthLoss ?? 0;
        const SANITY_STEALTH_LOSS_CAP = 2;
        const loss = Math.min(2, SANITY_STEALTH_LOSS_CAP - lost);
        if (loss > 0) {
            ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.ruinStealth), vars), [t.id], { important: true, category: 'sanity' });
            t.attributes.stealth = Math.max(0, t.attributes.stealth - loss);
            t.sanityStealthLoss = lost + loss;
        } else {
            ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.hallucination), vars), [t.id], { important: true, category: 'sanity' });
            t.vitals.sanity -= 5;
        }
    } else if (t.inventory.length > 0) {
        const itemIdx = ctx.rng.nextInt(0, t.inventory.length - 1);
        const item = t.inventory.splice(itemIdx, 1)[0];
        ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.dropItem), { ...vars, item: item.name }), [t.id], { important: true, category: 'sanity' });
    } else {
        ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.hallucination), vars), [t.id], { important: true, category: 'sanity' });
    }
    clampTribute(t);
}

/** True once a tribute's sanity has broken far enough to cost them the turn. */
export function isBreakingDown(ctx: SimContext, t: Tribute): boolean {
    return ctx.state.config.enableSanity
        && t.vitals.sanity < VITALS.breakdownThreshold
        && ctx.rng.chance(VITALS.breakdownChance);
}
