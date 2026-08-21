import { Terrain, Tribute } from '../models/types';
import { ITEMS } from '../data/constants';
import { BLEEDING, CRAFTING, DESPERATION, ENCOUNTERS, ESCALATION, HUNTING, MEMORY, PROFICIENCY, VITALS, ZONES } from '../data/balance';
import { ALLIANCE_TEXTS, ENCOUNTER_TEXTS, SANITY_TEXTS } from '../data/flavorText';
import { ArenaEventDef, arenaFlavor } from '../data/arenaFlavor';
import { SimContext } from './context';
import { applyDamage, checkDeath, resolveCombat } from './combat';
import { depleteZone, depletionOf, effectiveResources, getZone } from './map';
import { addZoneThreat, hasVengeanceAgainst, noteContact, noteSighting, noteStoodBy } from './memory';
import { adjustMutual, adjustRel, getRel } from './relationships';
import { hasTruce, tryParley } from './parley';
import { areLovers } from './alliance';
import { incurDebt } from './debts';
import { DEBTS } from '../data/balance';
import { giveItem, hasTool, itemPhrase, mintItem, spoilageBonus } from './items';
import { clampTribute } from './vitals';
import { attemptFieldDressing, clearBleeding, openWound, shouldDressWound } from './wounds';
import { profOf, trainProficiency } from './proficiency';
import { attemptFieldcraft } from './fieldcraft';
import { resolveMuttAttack as resolveMuttAttackImpl } from './mutts';
import { severRandomEdge, startZoneEffect } from './zoneEffects';
import { traitMod } from '../data/traits';
import { QUALITY_BIAS } from '../data/balance';

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
    const penalty = t.injuries.legs ? 2 : 0;

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
    if (event.poisoned) t.injuries.poisoned = true;
    if (event.burned) t.injuries.burned = true;
    if (event.frostbitten) t.injuries.frostbitten = true;
    if (event.infected) t.injuries.infected = true;
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
export function pickTerrainEvent(ctx: SimContext, events: ArenaEventDef[], terrain: Terrain | undefined): ArenaEventDef {
    if (!terrain) return ctx.rng.pick(events);
    const fits = (event: ArenaEventDef) => {
        const tags = event.terrains ?? inferredTerrains(event);
        return !tags || tags.includes(terrain);
    };
    const matching = events.filter(fits);
    return ctx.rng.pick(matching.length > 0 ? matching : events);
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
            needer.injuries.infected = false;
            needer.injuries.burned = false;
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
    const alive = ctx.state.tributes.filter(o => o.status === 'alive').length;
    if (alive > DESPERATION.fieldSize) return false;
    const mutual = Math.min(getRel(t, other.id), getRel(other, t.id));
    if (mutual >= DESPERATION.sparedBond) return false;
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
    } else if (t.stance === 'Aggressive' || other.stance === 'Aggressive' || relationship < -10) {
        // Even a hostile meeting can end in a negotiation rather than a fight,
        // if neither of them likes the odds enough to start one.
        if (!tryParley(ctx, t, other)) resolveCombat(ctx, t, other);
    } else if (isDesperate(ctx, t, other)) {
        ctx.logEvent(
            fill(ctx.pickText(ENCOUNTER_TEXTS.desperation), vars),
            [t.id, other.id],
            { important: true, category: 'combat' }
        );
        resolveCombat(ctx, t, other);
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
    trainProficiency(t, 'forage');
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
    const gameChance = HUNTING.gameChance + profOf(t, 'tracking') * HUNTING.trackingBonus;
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
    ctx.logEvent(fill(ctx.pickText(flavor.actions.hunt), { tribute: t.name, zone: t.zone }), [t.id], { category: 'survival' });
}

export function idleAction(ctx: SimContext, t: Tribute, flavor: ReturnType<typeof arenaFlavor>) {
    const zone = getZone(ctx.state.arena, t.zone);
    const available = effectiveResources(ctx.state, zone);
    // A net in still water is not foraging, it is fishing, and it works.
    const fishing = hasTool(t, 'fishing')
        && (zone?.terrain === 'water' || zone?.terrain === 'wetland');
    const baseForageChance = ZONES.baseForageChance
        + (fishing ? ZONES.fishingBonus : 0)
        + available * ZONES.yieldForageWeight
        + (t.archetype === 'survivalist' ? ZONES.survivalistForageBonus : 0)
        + traitMod(t, 'forage')
        + profOf(t, 'forage') * PROFICIENCY.forageWeight;

    // A wound that is actually running is the most urgent thing in their life,
    // whatever stance they are in. This is the move the simulation was missing:
    // it needs no item and it is available to everyone.
    if (shouldDressWound(t)) {
        attemptFieldDressing(ctx, t);
        return;
    }

    // Preparation is a use of a turn. A tribute who is not bleeding, not being
    // hunted and not starving sometimes spends the hour on a snare, a fire or a
    // shelter instead of picking berries — which is the whole difference
    // between surviving the arena and working it.
    if (t.vitals.hunger < VITALS.eatThreshold && ctx.rng.chance(CRAFTING.fieldcraftChance)
        && attemptFieldcraft(ctx, t)) {
        return;
    }

    if (t.stance === 'Evasive') {
        // Hiding does not mean starving — there is still a stream in whatever
        // zone they went to ground in, just a much smaller chance they risk
        // reaching for it instead of staying still.
        if (attemptForage(ctx, t, flavor, baseForageChance * ZONES.evasiveForageMultiplier)) {
            noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
            return;
        }
        ctx.logEvent(fill(ctx.pickText(flavor.actions.hide), { tribute: t.name, zone: t.zone }), [t.id], { category: 'survival' });
        return;
    }

    if (t.stance === 'Defensive') {
        if (!attemptForage(ctx, t, flavor, baseForageChance)) {
            const stripped = depletionOf(ctx.state, t.zone) > ENCOUNTERS.strippedZoneNotice;
            ctx.logEvent(
                stripped
                    ? `${t.name} works over ${t.zone} and finds it already stripped bare. Someone has been here first.`
                    : fill(ctx.pickText(flavor.actions.rest), { tribute: t.name, zone: t.zone }),
                [t.id],
                { category: 'survival' }
            );
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
