import { GameState, Terrain, Tribute, ZoneEffect, ZoneEffectKind } from '../models/types';
import { injure, openWound } from './wounds';
import { BLEEDING, ZONE_EFFECTS } from '../data/balance';
import { SimContext } from './context';
import { traitMod } from '../data/traits';
import { applyDamage, checkDeath } from './combat';
import { cycleOf } from './memory';
import { depleteZone, getZone, hasForceField, severEdge } from './map';
import { clampTribute } from './vitals';
import { climateOf } from './climate';
import { arenaHasLaw } from './gamesProfile';
import { earnTrait } from './earnedTraits';

/**
 * Zone effects: the arena in a state other than its printed one.
 *
 * `Zone.danger` and `Zone.resources` were immutable printed numbers forever;
 * only `zoneDepletion`, a parallel record, ever changed under them. Terrain
 * never changed — a flooded zone stayed forest. This module is what lets a
 * zone actually be burning, flooded, frozen, contaminated or fogbound for a
 * while, the way `zoneDepletion` already lets it be quietly stripped.
 *
 * Everything here is zone-scoped rather than tribute-scoped: an effect hits
 * everyone standing in the zone when it ticks, not the one tribute a random
 * roll happened to land on. That is the difference between a hazard and an
 * environment.
 */

function effectsFor(state: GameState, zone: string): ZoneEffect[] {
    state.zoneEffects = state.zoneEffects ?? {};
    if (!state.zoneEffects[zone]) state.zoneEffects[zone] = [];
    return state.zoneEffects[zone];
}

export function effectsIn(state: GameState, zone: string): ZoneEffect[] {
    return state.zoneEffects?.[zone] ?? [];
}

export function hasEffect(state: GameState, zone: string, kind: ZoneEffectKind): boolean {
    return effectsIn(state, zone).some(e => e.kind === kind);
}

const DURATION_BY_KIND: Record<ZoneEffectKind, number> = {
    burning: ZONE_EFFECTS.burningDuration,
    flooded: ZONE_EFFECTS.floodedDuration,
    frozen: ZONE_EFFECTS.frozenDuration,
    contaminated: ZONE_EFFECTS.contaminatedDuration,
    fogbound: ZONE_EFFECTS.fogboundDuration,
    stripped: ZONE_EFFECTS.strippedDuration,
    blooming: ZONE_EFFECTS.bloomingDuration,
    irradiated: ZONE_EFFECTS.irradiatedDuration,
};

/**
 * Starts (or refreshes) an effect on a zone. Refreshing rather than stacking —
 * a second fire in an already-burning zone extends it, it does not double the
 * damage — keeps this from compounding into something unreadable.
 *
 * `severity` is a per-instance multiplier on top of whatever `Arena.effectVocab`
 * declares for this arena — most callers omit it and get 1, so nothing existing
 * changes; a signature or law that wants a fiercer or gentler version of the
 * same effect passes its own number.
 */
export function startZoneEffect(ctx: SimContext, zone: string, kind: ZoneEffectKind, announce = true, severity = 1) {
    const vocab = ctx.state.arena.effectVocab?.[kind];
    const list = effectsFor(ctx.state, zone);
    const cycle = cycleOf(ctx.state);
    const expiresCycle = cycle + Math.round(DURATION_BY_KIND[kind] * (vocab?.durationMult ?? 1));
    const existing = list.find(e => e.kind === kind);

    if (existing) {
        existing.expiresCycle = expiresCycle;
        existing.severity = severity;
        return;
    }

    // §5.7: effects meet each other instead of stacking blindly. An incoming
    // effect landing on a zone that already carries its opposite resolves the
    // physics first — sometimes consuming the new effect entirely.
    if (resolveEffectInteraction(ctx, zone, kind, list)) return;

    list.push({
        kind,
        expiresCycle,
        nextSpreadCycle: kind === 'burning' ? cycle + ZONE_EFFECTS.spreadEveryCycles : undefined,
        severity,
    });

    // §5.7: contamination meeting standing floodwater is carried downstream.
    // Runs after the push so the zone already reads as contaminated — the
    // spread can't circle back through a flooded neighbour and recurse.
    if ((kind === 'contaminated' && list.some(e => e.kind === 'flooded'))
        || (kind === 'flooded' && list.some(e => e.kind === 'contaminated'))) {
        spreadContamination(ctx, zone);
    }

    if (!announce) return;
    if (vocab?.label) {
        ctx.logEvent(`${vocab.label} takes hold of ${zone}, and it is not letting go on its own.`, [], { important: true, zone, category: 'hazard' });
        return;
    }
    const lines: Record<ZoneEffectKind, string> = {
        burning: `Fire takes hold in ${zone}. Anyone still there needs to not be, and it is not done spreading.`,
        flooded: `${zone} goes under. What was solid ground an hour ago is now a hazard in its own right.`,
        frozen: `A hard freeze locks down ${zone}. The cold here is worse than the arena's own.`,
        contaminated: `Something in ${zone} is wrong — the air, the water, the ground itself. It lingers.`,
        fogbound: `A fog bank rolls into ${zone} and does not lift. Nobody in it can see past their own hands.`,
        stripped: `${zone} is burned down to ash and bare rock. There is nothing left here worth finding.`,
        blooming: `Something has come good in ${zone} — fruit, fish, run-off water, all of it at once. It will not last, and everyone who can see it knows that.`,
        irradiated: `Whatever the Gamemakers have let loose in ${zone}, it is not going to lift. The ground itself is the hazard now, and the edge of it is moving.`,
    };
    ctx.logEvent(lines[kind], [], { important: true, zone, category: 'hazard' });
}

/**
 * §5.7: what happens when one effect arrives in a zone another already holds.
 * Returns true when the incoming effect was consumed by the interaction and
 * must not be applied. Mutates `list` in place (it is the zone's live list).
 *
 * - fire onto flood, or flood onto fire: both cancel in a wall of steam.
 * - fire onto a frozen zone, or a freeze onto a burning one: the fire dies
 *   and the ice comes down as meltwater — the zone floods instead.
 * - contamination meeting standing floodwater (either order): the water
 *   carries it downstream into one or two neighbouring zones.
 */
function resolveEffectInteraction(ctx: SimContext, zone: string, incoming: ZoneEffectKind, list: ZoneEffect[]): boolean {
    const state = ctx.state;
    const has = (kind: ZoneEffectKind) => list.some(e => e.kind === kind);

    if ((incoming === 'burning' && has('flooded')) || (incoming === 'flooded' && has('burning'))) {
        endZoneEffect(state, zone, incoming === 'burning' ? 'flooded' : 'burning');
        ctx.logEvent(
            `Fire and floodwater meet in ${zone} and cancel each other in a wall of steam. When it clears, both are gone.`,
            [],
            { important: true, zone, category: 'hazard' }
        );
        return true;
    }

    if ((incoming === 'burning' && has('frozen')) || (incoming === 'frozen' && has('burning'))) {
        endZoneEffect(state, zone, incoming === 'burning' ? 'frozen' : 'burning');
        ctx.logEvent(
            `Heat meets the ice locked over ${zone}, and the freeze lets go all at once — the zone goes under its own meltwater.`,
            [],
            { important: true, zone, category: 'hazard' }
        );
        startZoneEffect(ctx, zone, 'flooded', false);
        return true;
    }

    return false;
}

/** §5.7: floodwater carrying contamination into 1-2 neighbouring zones. */
function spreadContamination(ctx: SimContext, from: string) {
    const zone = getZone(ctx.state.arena, from);
    if (!zone) return;
    const collapsed = ctx.state.collapsedZones ?? [];
    const candidates = zone.adjacent.filter(n => !collapsed.includes(n) && !hasEffect(ctx.state, n, 'contaminated'));
    if (candidates.length === 0) return;
    const targets = ctx.rng.shuffle(candidates).slice(0, ctx.rng.nextInt(1, Math.min(2, candidates.length)));
    targets.forEach(n => {
        startZoneEffect(ctx, n, 'contaminated', false);
        ctx.logEvent(
            `The floodwater running out of ${from} carries whatever is wrong with it into ${n}.`,
            [],
            { important: true, zone: n, category: 'hazard' }
        );
    });
}

function endZoneEffect(state: GameState, zone: string, kind: ZoneEffectKind) {
    const list = state.zoneEffects?.[zone];
    if (!list) return;
    state.zoneEffects![zone] = list.filter(e => e.kind !== kind);
}

/** Everyone currently standing in a zone, alive. */
function presentIn(state: GameState, zone: string): Tribute[] {
    return state.tributes.filter(t => t.status === 'alive' && t.zone === zone);
}

/**
 * Per-cycle upkeep: apply what each active effect does to whoever is standing
 * in it, spread fire along the adjacency graph, and expire anything whose time
 * is up. Call once per cycle, after movement has resolved (so damage lands on
 * whoever is actually there this cycle, not wherever they started it).
 */
export function tickZoneEffects(ctx: SimContext) {
    const state = ctx.state;
    if (!state.zoneEffects) return;
    const cycle = cycleOf(state);

    Object.keys(state.zoneEffects).forEach(zoneName => {
        const list = state.zoneEffects![zoneName];
        const zone = getZone(state.arena, zoneName);
        const occupants = presentIn(state, zoneName);

        list.forEach(effect => {
            applyEffectTick(ctx, zoneName, effect, occupants);

            // §5.2: irradiation is permanent and it creeps. Slowly — a zone a
            // cycle at the outside — so an arena can be permanently narrowed
            // by its own accident rather than only by the border.
            if (effect.kind === 'irradiated' && ctx.rng.chance(ZONE_EFFECTS.irradiatedCreepChance)) {
                const here = getZone(state.arena, zoneName);
                const outward = (here?.adjacent ?? []).filter(n =>
                    !(state.collapsedZones ?? []).includes(n) && !hasEffect(state, n, 'irradiated'));
                if (outward.length > 0) {
                    const next = ctx.rng.pick(outward);
                    startZoneEffect(ctx, next, 'irradiated', false);
                    ctx.logEvent(
                        `The edge of whatever is wrong with ${zoneName} has reached ${next}. It does not appear to be stopping.`,
                        [],
                        { important: true, zone: next, category: 'hazard' }
                    );
                }
            }

            if (effect.kind === 'burning' && effect.nextSpreadCycle !== undefined && cycle >= effect.nextSpreadCycle) {
                effect.nextSpreadCycle = cycle + ZONE_EFFECTS.spreadEveryCycles;
                spreadFire(ctx, zoneName);
            }
        });

        // Fire burns out into stripped ground rather than simply vanishing —
        // the zone is worse off after a fire than before it, which is the
        // point of the mechanic existing at all.
        const burningExpired = list.find(e => e.kind === 'burning' && cycle >= e.expiresCycle);
        if (burningExpired) {
            endZoneEffect(state, zoneName, 'burning');
            depleteZone(state, zoneName, ZONE_EFFECTS.strippedDepletion);
            startZoneEffect(ctx, zoneName, 'stripped');
        }

        state.zoneEffects![zoneName] = (state.zoneEffects![zoneName] ?? [])
            .filter(e => cycle < e.expiresCycle);
        if (state.zoneEffects![zoneName].length === 0) delete state.zoneEffects![zoneName];

        void zone; // terrain is read inside spreadFire/applyEffectTick, not needed here directly
    });
}

/**
 * Combined severity for one effect instance: the per-instance roll on the
 * `ZoneEffect` itself (a signature or law asking for a fiercer/gentler hit
 * than normal) times this arena's own retuning of the whole kind, if any.
 * Every magnitude below is scaled by this rather than the raw constant, so
 * "flooded" can be lethal in one arena and a mere nuisance in another.
 */
function severityOf(ctx: SimContext, effect: ZoneEffect): number {
    const vocab = ctx.state.arena.effectVocab?.[effect.kind];
    return (effect.severity ?? 1) * (vocab?.severityMult ?? 1);
}

function applyEffectTick(ctx: SimContext, zoneName: string, effect: ZoneEffect, occupants: Tribute[]) {
    const severity = severityOf(ctx, effect);
    occupants.forEach(t => {
        // The occupant list is snapshotted once per zone, before any of its
        // effects tick. A zone can carry several at once (a flood on top of a
        // fire), so by the time the second one runs the first may have killed
        // somebody — and damaging the corpse overwrote `lastDamage` after
        // `checkDeath` had already written the true cause of death.
        if (t.status !== 'alive') return;
        switch (effect.kind) {
            case 'burning':
                applyDamage(ctx, t, Math.round(ZONE_EFFECTS.burningDamage * severity), { cause: `Caught in the fire in ${zoneName}`, kind: 'arena' });
                if (ctx.rng.chance(ZONE_EFFECTS.burningBurnChance * severity) && !t.injuries.burned) {
                    injure(t, 'burned');
                    ctx.logEvent(`${t.name} does not get clear of the fire in ${zoneName} fast enough.`, [t.id], { important: true, category: 'hazard' });
                }
                clampTribute(t);
                checkDeath(ctx, t, `Caught in the fire in ${zoneName}`);
                // §8.9: walking out of a burning sector leaves a mark that is
                // not always a scar.
                if (t.status === 'alive') earnTrait(ctx, t, 'Firetouched');
                break;

            case 'flooded':
                if (ctx.rng.chance(ZONE_EFFECTS.floodDrownChance * severity)) {
                    // §7: can they swim? Everyone in a flooded sector used to
                    // take the same battering and, if it killed them, the same
                    // generic hazard obituary — so drowning did not exist as a
                    // cause of death in a game with water terrain, a Swimmer
                    // trait and arenas that name swimming as a requirement.
                    const swim = ZONE_EFFECTS.drownBase
                        + (t.attributes.strength + t.attributes.agility) * ZONE_EFFECTS.drownPerAttribute
                        + traitMod(t, 'water') * ZONE_EFFECTS.drownSwimmerBonus
                        - t.vitals.fatigue * ZONE_EFFECTS.drownFatiguePenalty;
                    if (ctx.rng.chance(Math.max(0.05, Math.min(0.97, swim)))) {
                        applyDamage(ctx, t, Math.round(ZONE_EFFECTS.floodDamage * severity), { cause: `Caught in the flooding of ${zoneName}`, kind: 'arena' });
                        ctx.logEvent(`${t.name} is dragged under by the current in flooded ${zoneName} and barely surfaces.`, [t.id], { important: true, category: 'hazard' });
                        clampTribute(t);
                        checkDeath(ctx, t, `Caught in the flooding of ${zoneName}`);
                    } else {
                        applyDamage(ctx, t, ZONE_EFFECTS.drownDamage, { cause: `Drowned in ${zoneName}`, kind: 'arena' });
                        ctx.logEvent(
                            `${t.name} goes into the water in flooded ${zoneName} and does not come up where anyone is looking. `
                            + `They were never taught, and the current does not care when you learn.`,
                            [t.id],
                            { important: true, category: 'hazard' }
                        );
                        clampTribute(t);
                        checkDeath(ctx, t, `Drowned in ${zoneName}`);
                    }
                }
                break;

            case 'frozen':
                t.vitals.fatigue += ZONE_EFFECTS.frozenFatigue * severity;
                if (!t.injuries.frostbitten && ctx.rng.chance(ZONE_EFFECTS.frozenFrostbiteChance * severity)) {
                    injure(t, 'frostbitten');
                    ctx.logEvent(`${t.name}'s fingers go white in the hard freeze over ${zoneName}.`, [t.id], { important: true, category: 'injury' });
                }
                clampTribute(t);
                break;

            case 'contaminated':
                if (!t.injuries.poisoned && ctx.rng.chance(ZONE_EFFECTS.contaminatedPoisonChance * severity)) {
                    injure(t, 'poisoned');
                    ctx.logEvent(`${t.name} has been breathing whatever is wrong with ${zoneName} for too long.`, [t.id], { important: true, category: 'injury' });
                }
                t.vitals.sanity -= ZONE_EFFECTS.contaminatedSanityLoss * severity;
                clampTribute(t);
                break;

            case 'blooming':
                // §5.2: the inverse effect. A bloom feeds and settles whoever
                // is standing in it — the arena's only unambiguous kindness,
                // and a reason to fight over a zone that is not the horn.
                t.vitals.sanity = Math.min(100, t.vitals.sanity + ZONE_EFFECTS.bloomingSanityRelief);
                clampTribute(t);
                break;

            case 'irradiated':
                applyDamage(ctx, t, Math.round(ZONE_EFFECTS.irradiatedDamage * severity), { cause: `Poisoned by whatever is loose in ${zoneName}`, kind: 'arena' });
                t.vitals.sanity -= ZONE_EFFECTS.irradiatedSanityLoss * severity;
                if (!t.injuries.poisoned) injure(t, 'poisoned');
                clampTribute(t);
                checkDeath(ctx, t, `Poisoned by whatever is loose in ${zoneName}`);
                break;

            case 'fogbound':
            case 'stripped':
                // Fog is read by the stealth system directly (see hasFog below);
                // stripped ground only affects forage, via effectiveResources.
                break;
        }
    });
}

/**
 * §5.8: how dry the arena is running. A standing climate that multiplies
 * thirst (desert glare, furnace heat) or a live weather front that reads as
 * drought-adjacent means everything catches easier; a soaked coast dampens it.
 */
function arenaDryness(ctx: SimContext): number {
    const climate = climateOf(ctx.state.arena.id);
    if (climate?.drains?.thirstMultiplier && climate.drains.thirstMultiplier > 1) return ZONE_EFFECTS.spreadDrynessHotClimate;
    return 1;
}

/** §5.8: per-terrain fuel: dry scrub and timber carry a fire; a marsh resists it. */
const TERRAIN_DRYNESS: Partial<Record<Terrain, number>> = {
    forest: 1.15,
    open: 1.0,
    wetland: 0.55,
};

/**
 * Fire catching on an adjacent zone whose terrain can actually burn.
 *
 * §5.8: the odds compound instead of being one flat constant — a zone with
 * several burning neighbours is being attacked from all sides, a parched
 * arena carries flame further, and wet ground still resists. This is what
 * makes a genuine multi-zone conflagration possible without making every
 * campfire the end of the map.
 */
function spreadFire(ctx: SimContext, from: string) {
    const state = ctx.state;
    const zone = getZone(state.arena, from);
    if (!zone) return;
    const collapsed = state.collapsedZones ?? [];
    const dryness = arenaDryness(ctx);

    zone.adjacent.forEach(neighborName => {
        if (collapsed.includes(neighborName)) return;
        if (hasEffect(state, neighborName, 'burning') || hasEffect(state, neighborName, 'stripped')) return;
        const neighbor = getZone(state.arena, neighborName);
        if (!neighbor || !(ZONE_EFFECTS.flammableTerrain as readonly Terrain[]).includes(neighbor.terrain)) return;

        // Every burning neighbour beyond this one is another front the zone
        // is catching sparks from — each adds to the odds.
        const burningNeighbors = neighbor.adjacent.filter(n => hasEffect(state, n, 'burning')).length;
        const chance = Math.min(ZONE_EFFECTS.spreadChanceMax,
            ZONE_EFFECTS.spreadChance
            * dryness
            * (TERRAIN_DRYNESS[neighbor.terrain] ?? 1)
            + Math.max(0, burningNeighbors - 1) * ZONE_EFFECTS.spreadPerExtraFront);
        if (!ctx.rng.chance(chance)) return;

        startZoneEffect(ctx, neighborName, 'burning', false);
        // §10.1: 'Ashes to Ashes' — the chain runs one zone deeper than the
        // fire it jumped from, and the run remembers its longest.
        const parentChain = effectsIn(state, from).find(e => e.kind === 'burning')?.chainLength ?? 1;
        const child = effectsIn(state, neighborName).find(e => e.kind === 'burning');
        if (child) child.chainLength = Math.max(child.chainLength ?? 1, parentChain + 1);
        state.fireChainMax = Math.max(state.fireChainMax ?? 1, parentChain + 1);
        ctx.logEvent(`The fire in ${from} jumps to ${neighborName}.`, [], { important: true, zone: neighborName, category: 'hazard' });
    });
}

/** Read by the stealth system: fog suppresses awareness for everyone in it. */
export function fogAwarenessPenalty(state: GameState, zone: string): number {
    return hasEffect(state, zone, 'fogbound') ? ZONE_EFFECTS.fogAwarenessPenalty : 0;
}

/**
 * A collapsed bridge, a burned-out crossing: an event that removes a route
 * rather than damaging a person. `nearby` is the tribute's current zone, used
 * to pick which of its edges actually gets cut.
 */
export function severRandomEdge(ctx: SimContext, zoneName: string): string | undefined {
    const zone = getZone(ctx.state.arena, zoneName);
    if (!zone || zone.adjacent.length === 0) return undefined;
    const target = ctx.rng.pick(zone.adjacent);
    severEdge(ctx.state, zoneName, target);
    return target;
}

/**
 * The arena starting something on its own.
 *
 * Every zone effect above is real, but nothing in the hand-authored hazard
 * pool sets `startsZoneEffect`/`severesRoute` — those fields exist and are
 * wired through `applyArenaEvent`, but firing only through a per-tribute event
 * flag meant the mechanism would sit unused until someone hand-tagged a
 * thousand-plus lines of flavour text. The arena itself needs to be able to
 * originate these, the way the standing climate and the border collapse
 * already act on the map without waiting for a tribute to trigger them.
 *
 * Chances are deliberately small and gated to the escalation window (day 5+,
 * the same point the border starts closing) — this is the Gamemakers turning
 * up the pressure everywhere at once, not background noise from day one.
 */
export function rollAmbientZoneEffects(ctx: SimContext) {
    const state = ctx.state;
    // Escalation is now audience-driven, so gate on whether the Gamemakers have
    // actually started rather than on the calendar.
    if (ZONE_EFFECTS.ambientEscalatedOnly && state.escalationDay === undefined) return;

    const collapsed = state.collapsedZones ?? [];
    const active = state.arena.zones.filter(z => !collapsed.includes(z.name));
    if (active.length === 0) return;
    const climate = climateOf(state.arena.id);

    // Fire: catches in flammable terrain. More likely in a hot standing climate.
    const flammable = active.filter(z =>
        (ZONE_EFFECTS.flammableTerrain as readonly Terrain[]).includes(z.terrain) && !hasEffect(state, z.name, 'burning'));
    if (flammable.length > 0 && ctx.rng.chance(ZONE_EFFECTS.ambientFireChance)) {
        startZoneEffect(ctx, ctx.rng.pick(flammable).name, 'burning');
    }

    // Flooding: open water rising over its banks.
    const floodable = active.filter(z => (z.terrain === 'water' || z.terrain === 'wetland') && !hasEffect(state, z.name, 'flooded'));
    if (floodable.length > 0 && ctx.rng.chance(ZONE_EFFECTS.ambientFloodChance)) {
        startZoneEffect(ctx, ctx.rng.pick(floodable).name, 'flooded');
    }

    // Freezing: a hard local freeze, likelier where the standing climate is
    // already cold, but not impossible to catch anyone off guard elsewhere.
    const freezeChance = climate?.drains?.fatigue ? ZONE_EFFECTS.ambientFreezeChance * 2.5 : ZONE_EFFECTS.ambientFreezeChance;
    const freezable = active.filter(z => !hasEffect(state, z.name, 'frozen'));
    if (freezable.length > 0 && ctx.rng.chance(freezeChance)) {
        startZoneEffect(ctx, ctx.rng.pick(freezable).name, 'frozen');
    }

    // Contamination: likelier in an arena whose water is already foul.
    const contaminateChance = climate?.foulWater ? ZONE_EFFECTS.ambientContaminateChance * 3 : ZONE_EFFECTS.ambientContaminateChance;
    const contaminable = active.filter(z => !hasEffect(state, z.name, 'contaminated'));
    if (contaminable.length > 0 && ctx.rng.chance(contaminateChance)) {
        startZoneEffect(ctx, ctx.rng.pick(contaminable).name, 'contaminated');
    }

    // Fog: settles anywhere.
    const foggable = active.filter(z => !hasEffect(state, z.name, 'fogbound'));
    if (foggable.length > 0 && ctx.rng.chance(ZONE_EFFECTS.ambientFogChance)) {
        startZoneEffect(ctx, ctx.rng.pick(foggable).name, 'fogbound');
    }

    // A route giving out — a bridge, a tunnel, a crossing the arena decides to
    // take away. Only from a zone that actually has somewhere to sever to.
    const severable = active.filter(z => z.adjacent.some(n => active.some(a => a.name === n)));
    if (severable.length > 0 && ctx.rng.chance(ZONE_EFFECTS.ambientSeverChance)) {
        const from = ctx.rng.pick(severable);
        const to = severRandomEdge(ctx, from.name);
        if (to) {
            ctx.logEvent(
                `The route between ${from.name} and ${to} gives out. Whatever crossed it, nothing is crossing it now.`,
                [],
                { important: true, zone: from.name, category: 'hazard' }
            );
        }
    }
}

/**
 * §7.1: the arena's force field, as a discoverable object.
 *
 * Every arena has always ended somewhere; nothing in the simulation ever let a
 * tribute find the edge. Border zones (see `hasForceField` in engine/map) carry
 * the field: a tribute standing in one can discover it — a shimmer where the
 * sky meets the ground, once per tribute — and after that it is a thing in
 * their world: rarely, they misjudge it and take a rebound; rarely, a sharp
 * one turns it into a tool, the way canon tributes bounced knives and cooked
 * off it. Called once per cycle after movement has resolved.
 */
export function tickForceField(ctx: SimContext) {
    const state = ctx.state;
    state.forceFieldSeen = state.forceFieldSeen ?? [];
    const seen = state.forceFieldSeen;
    const collapsed = state.collapsedZones ?? [];

    state.tributes.forEach(t => {
        if (t.status !== 'alive' || collapsed.includes(t.zone)) return;
        if (!hasForceField(state.arena, t.zone)) return;

        if (!seen.includes(t.id)) {
            if (!ctx.rng.chance(ZONE_EFFECTS.forceFieldDiscoverChance)) return;
            seen.push(t.id);
            ctx.logEvent(
                `${t.name} throws a stone past the treeline of ${t.zone} and it comes straight back. A faint shimmer, a hum under the birdsong — the arena ends here.`,
                [t.id],
                { important: true, zone: t.zone, category: 'arena' }
            );
            return;
        }

        // A high-intellect tribute who knows the field is there can use it.
        if (t.attributes.intelligence >= ZONE_EFFECTS.forceFieldExploitIntellect
            && ctx.rng.chance(ZONE_EFFECTS.forceFieldExploitChance)) {
            t.vitals.hunger = Math.max(0, t.vitals.hunger - ZONE_EFFECTS.forceFieldExploitHungerRelief);
            ctx.logEvent(
                `${t.name} spears a scrap of meat on a green stick and holds it against the force field at ${t.zone} until it chars. The Gamemakers did not design it as a cooker, but it is one.`,
                [t.id],
                { important: true, zone: t.zone, category: 'survival' }
            );
            return;
        }

        // Everyone else who knows it is there still occasionally misjudges it.
        if (ctx.rng.chance(ZONE_EFFECTS.forceFieldReboundChance)) {
            applyDamage(ctx, t, ZONE_EFFECTS.forceFieldReboundDamage, { cause: `Thrown back by the force field at ${t.zone}`, kind: 'arena' });
            openWound(t, BLEEDING.hazardSeverity);
            ctx.logEvent(
                `${t.name} strays a step too close to the edge of ${t.zone} and the force field throws them back into the dirt, smoking at the shoulder.`,
                [t.id],
                { important: true, zone: t.zone, category: 'hazard' }
            );
            clampTribute(t);
            checkDeath(ctx, t, `Thrown back by the force field at ${t.zone}`);
        }
    });
}

/**
 * The Cornucopia after the bloodbath: the highest-value, highest-danger tile,
 * permanently. Its printed `resources` is deliberately low (risk without much
 * reward is the point of the opening bloodbath), but a zone nobody ever has a
 * reason to return to is a zone that stops mattering by day three. A periodic
 * restock — the Gamemakers dropping fresh supply at the hub everyone already
 * knows the layout of — is what keeps it the place worth the risk of going
 * back to.
 */
export function restockCornucopia(ctx: SimContext) {
    // `cornucopiaRefills`: the Cornucopia restocks every cycle, no schedule
    // gate and no roll — the centre of the arena never stops being worth the
    // risk of going back to.
    if (arenaHasLaw(ctx.state, 'cornucopiaRefills')) { dropSupplies(ctx); return; }
    const cycle = cycleOf(ctx.state);
    if (cycle % ZONE_EFFECTS.cornucopiaRestockEveryCycles !== 0) return;
    if (!ctx.rng.chance(ZONE_EFFECTS.cornucopiaRestockChance)) return;
    dropSupplies(ctx);
}

/**
 * The restock itself, without the schedule gating — so a Gamemaker-mode
 * player can order a drop directly (§6.4) through the same mechanism the
 * arena's own cadence uses.
 */
export function dropSupplies(ctx: SimContext) {
    const cornucopia = ctx.state.arena.zones.find(z => /cornucopia/i.test(z.name));
    if (!cornucopia) return;
    const state = ctx.state;
    state.zoneDepletion = state.zoneDepletion ?? {};
    const current = state.zoneDepletion[cornucopia.name] ?? 0;
    const next = Math.max(0, current - ZONE_EFFECTS.cornucopiaRestockAmount);
    if (next >= current) return;
    state.zoneDepletion[cornucopia.name] = next;

    ctx.logEvent(
        `A supply drop lands over the Cornucopia. Everyone in range of it just recalculated the risk.`,
        [],
        { important: true, zone: cornucopia.name, category: 'arena' }
    );
}
