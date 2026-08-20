import { GameState, Terrain, Tribute, ZoneEffect, ZoneEffectKind } from '../models/types';
import { ESCALATION, ZONE_EFFECTS } from '../data/balance';
import { SimContext } from './context';
import { applyDamage, checkDeath } from './combat';
import { cycleOf } from './memory';
import { depleteZone, getZone, severEdge } from './map';
import { clampTribute } from './vitals';
import { climateOf } from './climate';

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
};

/**
 * Starts (or refreshes) an effect on a zone. Refreshing rather than stacking —
 * a second fire in an already-burning zone extends it, it does not double the
 * damage — keeps this from compounding into something unreadable.
 */
export function startZoneEffect(ctx: SimContext, zone: string, kind: ZoneEffectKind, announce = true) {
    const list = effectsFor(ctx.state, zone);
    const cycle = cycleOf(ctx.state);
    const expiresCycle = cycle + DURATION_BY_KIND[kind];
    const existing = list.find(e => e.kind === kind);

    if (existing) {
        existing.expiresCycle = expiresCycle;
        return;
    }

    list.push({
        kind,
        expiresCycle,
        nextSpreadCycle: kind === 'burning' ? cycle + ZONE_EFFECTS.spreadEveryCycles : undefined,
    });

    if (!announce) return;
    const lines: Record<ZoneEffectKind, string> = {
        burning: `Fire takes hold in ${zone}. Anyone still there needs to not be, and it is not done spreading.`,
        flooded: `${zone} goes under. What was solid ground an hour ago is now a hazard in its own right.`,
        frozen: `A hard freeze locks down ${zone}. The cold here is worse than the arena's own.`,
        contaminated: `Something in ${zone} is wrong — the air, the water, the ground itself. It lingers.`,
        fogbound: `A fog bank rolls into ${zone} and does not lift. Nobody in it can see past their own hands.`,
        stripped: `${zone} is burned down to ash and bare rock. There is nothing left here worth finding.`,
    };
    ctx.logEvent(lines[kind], [], { important: true, zone, category: 'hazard' });
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

function applyEffectTick(ctx: SimContext, zoneName: string, effect: ZoneEffect, occupants: Tribute[]) {
    occupants.forEach(t => {
        switch (effect.kind) {
            case 'burning':
                applyDamage(ctx, t, ZONE_EFFECTS.burningDamage, { cause: `Caught in the fire in ${zoneName}`, kind: 'arena' });
                if (ctx.rng.chance(ZONE_EFFECTS.burningBurnChance) && !t.injuries.burned) {
                    t.injuries.burned = true;
                    ctx.logEvent(`${t.name} does not get clear of the fire in ${zoneName} fast enough.`, [t.id], { important: true, category: 'hazard' });
                }
                clampTribute(t);
                checkDeath(ctx, t, `Caught in the fire in ${zoneName}`);
                break;

            case 'flooded':
                if (ctx.rng.chance(ZONE_EFFECTS.floodDrownChance)) {
                    applyDamage(ctx, t, ZONE_EFFECTS.floodDamage, { cause: `Caught in the flooding of ${zoneName}`, kind: 'arena' });
                    ctx.logEvent(`${t.name} is dragged under by the current in flooded ${zoneName} and barely surfaces.`, [t.id], { important: true, category: 'hazard' });
                    clampTribute(t);
                    checkDeath(ctx, t, `Caught in the flooding of ${zoneName}`);
                }
                break;

            case 'frozen':
                t.vitals.fatigue += ZONE_EFFECTS.frozenFatigue;
                if (!t.injuries.frostbitten && ctx.rng.chance(ZONE_EFFECTS.frozenFrostbiteChance)) {
                    t.injuries.frostbitten = true;
                    ctx.logEvent(`${t.name}'s fingers go white in the hard freeze over ${zoneName}.`, [t.id], { important: true, category: 'injury' });
                }
                clampTribute(t);
                break;

            case 'contaminated':
                if (!t.injuries.poisoned && ctx.rng.chance(ZONE_EFFECTS.contaminatedPoisonChance)) {
                    t.injuries.poisoned = true;
                    ctx.logEvent(`${t.name} has been breathing whatever is wrong with ${zoneName} for too long.`, [t.id], { important: true, category: 'injury' });
                }
                t.vitals.sanity -= ZONE_EFFECTS.contaminatedSanityLoss;
                clampTribute(t);
                break;

            case 'fogbound':
            case 'stripped':
                // Fog is read by the stealth system directly (see hasFog below);
                // stripped ground only affects forage, via effectiveResources.
                break;
        }
    });
}

/** Fire catching on an adjacent zone whose terrain can actually burn. */
function spreadFire(ctx: SimContext, from: string) {
    const state = ctx.state;
    const zone = getZone(state.arena, from);
    if (!zone) return;
    const collapsed = state.collapsedZones ?? [];

    zone.adjacent.forEach(neighborName => {
        if (collapsed.includes(neighborName)) return;
        if (hasEffect(state, neighborName, 'burning') || hasEffect(state, neighborName, 'stripped')) return;
        const neighbor = getZone(state.arena, neighborName);
        if (!neighbor || !(ZONE_EFFECTS.flammableTerrain as readonly Terrain[]).includes(neighbor.terrain)) return;
        if (!ctx.rng.chance(ZONE_EFFECTS.spreadChance)) return;

        startZoneEffect(ctx, neighborName, 'burning', false);
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
    if (ZONE_EFFECTS.ambientEscalatedOnly && state.day < ESCALATION.startDay) return;

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
 * The Cornucopia after the bloodbath: the highest-value, highest-danger tile,
 * permanently. Its printed `resources` is deliberately low (risk without much
 * reward is the point of the opening bloodbath), but a zone nobody ever has a
 * reason to return to is a zone that stops mattering by day three. A periodic
 * restock — the Gamemakers dropping fresh supply at the hub everyone already
 * knows the layout of — is what keeps it the place worth the risk of going
 * back to.
 */
export function restockCornucopia(ctx: SimContext) {
    const cycle = cycleOf(ctx.state);
    if (cycle % ZONE_EFFECTS.cornucopiaRestockEveryCycles !== 0) return;
    if (!ctx.rng.chance(ZONE_EFFECTS.cornucopiaRestockChance)) return;

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
