import { Tribute } from '../models/types';
import { ITEMS } from '../data/constants';
import { BLEEDING, DESPERATION, ENCOUNTERS, HUNTING, MEMORY, PROFICIENCY, TRAIT_EFFECTS, VITALS, ZONES } from '../data/balance';
import { ALLIANCE_TEXTS, ENCOUNTER_TEXTS, SANITY_TEXTS } from '../data/flavorText';
import { ArenaEventDef, arenaFlavor } from '../data/arenaFlavor';
import { SimContext } from './context';
import { applyDamage, checkDeath, resolveCombat } from './combat';
import { depleteZone, depletionOf, effectiveResources, getZone } from './map';
import { addZoneThreat, hasVengeanceAgainst, noteContact, noteSighting } from './memory';
import { adjustMutual, getRel } from './relationships';
import { giveItem, itemPhrase, spoilageBonus } from './items';
import { clampTribute } from './vitals';
import { attemptFieldDressing, clearBleeding, openWound, shouldDressWound } from './wounds';
import { profOf, trainProficiency } from './proficiency';

export function fill(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(value),
        template
    );
}

/** Applies one arena-specific event to a tribute, honouring their dodge stat. */
export function applyArenaEvent(ctx: SimContext, t: Tribute, event: ArenaEventDef) {
    const isBoon = (event.heal ?? 0) > 0 || (event.quench ?? 0) > 0 || (event.feed ?? 0) > 0;
    const vars = { tribute: t.name, zone: t.zone };

    if (event.dodgeStat) {
        const difficulty = event.dodgeDifficulty ?? 6;
        const roll = t.attributes[event.dodgeStat] + ctx.rng.nextInt(0, 4) - (t.injuries.legs ? 2 : 0);
        if (roll > difficulty) {
            ctx.logEvent(fill(event.escapeText, vars), [t.id], { category: isBoon ? 'survival' : 'hazard' });
            return;
        }
    }

    if (event.damage) applyDamage(ctx, t, event.damage, { cause: event.cause, kind: 'hazard' });
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
        if (item) giveItem(t, { ...item });
    }
    clampTribute(t);

    if (!isBoon) addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat);

    ctx.logEvent(fill(event.text, vars), [t.id], {
        important: !isBoon,
        category: isBoon ? 'survival' : 'hazard',
    });
    if (!isBoon) checkDeath(ctx, t, event.cause);
}

/** A mutt pack finds someone. */
export function resolveMuttAttack(ctx: SimContext, t: Tribute) {
    const mutt = ctx.rng.pick(ctx.state.arena.mutts);
    if (t.attributes.agility > ENCOUNTERS.muttEvasionAgility && ctx.rng.chance(ENCOUNTERS.muttEvasionChance)) {
        ctx.logEvent(`${t.name} outruns a pack of ${mutt} through ${t.zone}.`, [t.id], { category: 'mutt' });
        return;
    }
    applyDamage(ctx, t, ENCOUNTERS.muttDamage, { cause: `Torn apart by ${mutt}`, kind: 'mutt' });
    // Not every mauling opens an artery. An unconditional bleed on every mutt
    // attack was one of the two taps filling the game's deadliest status effect.
    if (ctx.rng.chance(BLEEDING.muttBleedChance)) openWound(t, BLEEDING.muttSeverity);
    addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat * 2);
    ctx.logEvent(`${t.name} is set upon by ${mutt} in ${t.zone} and barely breaks free.`, [t.id], { important: true, category: 'mutt' });
    checkDeath(ctx, t, `Torn apart by ${mutt}`);
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
            ctx.logEvent(`${giver.name} presses their ${item.name} into ${needer.name}'s hands and helps patch them up.`, [needer.id, giver.id], { important: true, category: 'alliance' });
            return;
        }
        // No supplies is not the same as no help. An ally with free hands and a
        // clear view of the wound is the best field dressing available, and it
        // gives an alliance a medical reason to exist as well as a tactical one.
        if (needer.injuries.bleeding && attemptFieldDressing(ctx, needer, giver)) {
            adjustMutual(ctx.state, needer, giver, 8);
            return;
        }
    }
    if (needer.vitals.thirst > 40) {
        const waterIdx = giver.inventory.findIndex(i => i.type === 'water');
        if (waterIdx >= 0) {
            const item = giver.inventory.splice(waterIdx, 1)[0];
            needer.vitals.thirst = Math.max(0, needer.vitals.thirst - 40);
            ctx.logEvent(`${giver.name} hands ${needer.name} their ${item.name} without being asked.`, [needer.id, giver.id], { category: 'alliance' });
            return;
        }
    }
    if (needer.vitals.hunger > 40) {
        const foodIdx = giver.inventory.findIndex(i => i.type === 'food');
        if (foodIdx >= 0) {
            const item = giver.inventory.splice(foodIdx, 1)[0];
            needer.vitals.hunger = Math.max(0, needer.vitals.hunger - 40);
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

    if (inSameAlliance) {
        // Share resources within alliance — in both directions, and not just food.
        shareAllianceSupplies(ctx, t, other);
        shareAllianceSupplies(ctx, other, t);
        adjustMutual(ctx.state, t, other, 5);
        ctx.logEvent(fill(ctx.pickText(ALLIANCE_TEXTS.support), vars), [t.id, other.id], { category: 'alliance' });
    } else if (relationship > 20) {
        ctx.logEvent(fill(ctx.pickText(ENCOUNTER_TEXTS.shareResources), vars), [t.id, other.id], { category: 'alliance' });
        t.vitals.hunger = Math.max(0, t.vitals.hunger - 10);
        other.vitals.hunger = Math.max(0, other.vitals.hunger - 10);
        adjustMutual(ctx.state, t, other, 5);
    } else if (t.stance === 'Aggressive' || other.stance === 'Aggressive' || relationship < -10) {
        resolveCombat(ctx, t, other);
    } else if (isDesperate(ctx, t, other)) {
        ctx.logEvent(
            fill(ctx.pickText(ENCOUNTER_TEXTS.desperation), vars),
            [t.id, other.id],
            { important: true, category: 'combat' }
        );
        resolveCombat(ctx, t, other);
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
    const item = ctx.rng.pick(ITEMS.filter(i => i.type === 'food' || i.type === 'water'));
    // Clone before touching spoilage: `item` is the shared ITEMS entry.
    const fresh = { ...item };
    if (fresh.type === 'food' && fresh.spoilage !== undefined) fresh.spoilage += spoilageBonus(t);
    const dropped = giveItem(t, fresh);
    trainProficiency(t, 'forage');
    depleteZone(ctx.state, t.zone, ZONES.depletionPerForage);
    ctx.logEvent(
        fill(ctx.pickText(flavor.actions.forage), { tribute: t.name, zone: t.zone, item: itemPhrase(item) }),
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
    const baseForageChance = ZONES.baseForageChance
        + available * ZONES.yieldForageWeight
        + (t.archetype === 'survivalist' ? ZONES.survivalistForageBonus : 0)
        + (t.traits.includes('Tracker') ? TRAIT_EFFECTS.trackerForageBonus : 0)
        + profOf(t, 'forage') * PROFICIENCY.forageWeight;

    // A wound that is actually running is the most urgent thing in their life,
    // whatever stance they are in. This is the move the simulation was missing:
    // it needs no item and it is available to everyone.
    if (shouldDressWound(t)) {
        attemptFieldDressing(ctx, t);
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
