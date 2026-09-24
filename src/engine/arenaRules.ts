import { ArenaRuleState, ArenaSightline, GameState, Tribute, Zone } from '../models/types';
import { ARENA_RULES, ARENA_RULE_MECHANICS, STEALTH } from '../data/balance';
import type { SimContext } from './context';
import { edgeKey, getZone, nearestSafeZone, severedEdgeSet, zoneFeatures } from './map';
import { noteSighting } from './memory';
import { applyDamage, checkDeath } from './combat';
import { startZoneEffect } from './zoneEffects';
import { injure } from './wounds';

/**
 * Generic arena rules.
 *
 * The arena signatures are bespoke functions, one per map, and that is right
 * for the *moment* an arena takes a swing. It is wrong for the standing
 * mechanics those moments lean on — "the whole arena can suddenly see", "this
 * ground does not come back", "a fire up here is a flare" — because those are
 * not one arena's idea. Written inline in a signature they would be reachable
 * from exactly one map; written here, behind `Arena.rules` flags and a handful
 * of state setters, any authored or generated arena can opt in.
 *
 * Every reader in this file is inert when the arena declares nothing and the
 * run has set nothing: it returns the neutral value (1, 0, undefined), so the
 * call sites in the core engine cost nothing for the arenas that do not care.
 *
 * Mechanics:
 *   - Sightline swing (`setSightline`): arena-wide lit / blackout / clear /
 *     whiteout, moving acoustics, concealment, ambush, ranged power, transit
 *     time and the engine's notion of dark all at once.
 *   - Soundscape (`rules.acousticsFloor`, `rules.acousticsFlux`): no zone is
 *     ever quiet, and each zone each cycle either masks or betrays movement.
 *   - Disorienting zones (`rules.disorientZones`): fighting there is blunted
 *     and leaving takes longer.
 *   - Slow regrowth (`rules.regrowthByTerrain`): forage recovers at a
 *     per-terrain fraction of the normal rate.
 *   - Fire beacon (`rules.fireBeacon`): a fire on exposed ground reveals its
 *     maker to the whole field.
 *   - Permanent collapse (`collapseZonePermanently`): a zone lost for the rest
 *     of the run — the border recomputation and the reopening tick both
 *     respect it.
 *   - Latent edges (`rules.latentEdges` + `openLatentEdge`): routes that exist
 *     in the graph but stay shut until something opens them mid-run — the
 *     remap half of a collapse.
 *   - Zone eviction (`evictZone`): everybody standing somewhere is driven to
 *     the nearest zone that is not in a given set.
 *   - Permanent cuts (`cutPermanently`): a severed edge the reopening tick may
 *     never put back.
 */

function ruleState(state: GameState): ArenaRuleState {
    if (!state.arenaRuleState) state.arenaRuleState = {};
    return state.arenaRuleState;
}

function cycleNow(state: GameState): number {
    return state.cycle ?? 0;
}

// ---- Sightline swing -------------------------------------------------------

/** Puts an arena-wide sightline in force through `untilCycle` inclusive. */
export function setSightline(state: GameState, mode: ArenaSightline, untilCycle: number) {
    ruleState(state).sightline = { mode, untilCycle };
}

/** Ends any sightline in force. */
export function clearSightline(state: GameState) {
    if (state.arenaRuleState) state.arenaRuleState.sightline = undefined;
}

/** The sightline in force this cycle, if any. */
export function currentSightline(state: GameState): ArenaSightline | undefined {
    const s = state.arenaRuleState?.sightline;
    if (!s || cycleNow(state) > s.untilCycle) return undefined;
    return s.mode;
}

function sightlineKnobs(state: GameState) {
    const mode = currentSightline(state);
    return mode ? ARENA_RULES.sightline[mode] : undefined;
}

/** Overrides the clock's darkness: true/false while a sightline says so, else undefined. */
export function sightlineDark(state: GameState): boolean | undefined {
    const k = sightlineKnobs(state);
    if (!k || k.dark === null) return undefined;
    return k.dark;
}

/** Multiplier on the chance to stay unseen. */
export function sightlineConcealment(state: GameState): number {
    return sightlineKnobs(state)?.concealment ?? 1;
}

/** Additive shift on ambush chance. */
export function sightlineAmbush(state: GameState): number {
    return sightlineKnobs(state)?.ambush ?? 0;
}

/** Combat power for a ranged or thrown weapon under the current sightline. */
export function sightlineRanged(state: GameState): number {
    return sightlineKnobs(state)?.ranged ?? 0;
}

// ---- Soundscape -------------------------------------------------------------

/** Deterministic [0,1) hash, so the soundscape replays without touching any RNG stream. */
function hash01(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
}

/** Whether this zone's soundscape is betraying movement this cycle (vs masking it). */
export function soundscapeBetrays(state: GameState, zoneName: string): boolean {
    return hash01(`${state.seed}|${zoneName}|${cycleNow(state)}`) >= 0.5;
}

/**
 * How far sound carries in this zone right now: the authored acoustics,
 * lifted to the arena's floor, swung by the soundscape and the sightline.
 */
export function effectiveAcoustics(state: GameState, zone: Zone): number {
    const base = zoneFeatures(zone).acoustics ?? 1;
    const rules = state.arena.rules;
    let value = base;
    if (rules?.acousticsFloor !== undefined) value = Math.max(value, rules.acousticsFloor);
    if (rules?.acousticsFlux) {
        value *= soundscapeBetrays(state, zone.name) ? 1 + rules.acousticsFlux : 1 - rules.acousticsFlux;
    }
    value *= sightlineKnobs(state)?.acoustics ?? 1;
    return Math.max(0, Math.min(ARENA_RULES.acousticsCeiling, value));
}

/**
 * The concealment shift the arena's rules make to a hider in `zone`, on the
 * same scale `stealth.concealment` already charges authored acoustics at —
 * only the difference from the authored value, so a zone with no rules
 * applying to it is untouched.
 */
export function acousticsConcealmentShift(state: GameState, zone: Zone | undefined): number {
    if (!zone) return 0;
    const base = zoneFeatures(zone).acoustics ?? 1;
    const effective = effectiveAcoustics(state, zone);
    return -(effective - base) * STEALTH.acousticsScale;
}

// ---- Disorientation ---------------------------------------------------------

export function isDisorienting(state: GameState, zoneName: string): boolean {
    return state.arena.rules?.disorientZones?.includes(zoneName) ?? false;
}

/** Combat power lost by a fighter standing in a disorienting zone. */
export function disorientCombatPenalty(state: GameState, t: Tribute): number {
    return isDisorienting(state, t.zone) ? ARENA_RULES.disorientCombatPenalty : 0;
}

/** Extra transit cycles on a crossing: the sightline's, plus finding the way out of a disorienting zone. */
export function ruleTransitCycles(state: GameState, from: string): number {
    const sight = sightlineKnobs(state)?.transit ?? 0;
    const lost = isDisorienting(state, from) ? ARENA_RULES.disorientTransit : 0;
    return sight + lost;
}

// ---- Slow regrowth -------------------------------------------------------------

/** Multiplier on this zone's forage regrowth rate. */
export function regrowthScale(state: GameState, zoneName: string): number {
    const table = state.arena.rules?.regrowthByTerrain;
    if (!table) return 1;
    const zone = getZone(state.arena, zoneName);
    return zone ? (table[zone.terrain] ?? 1) : 1;
}

// ---- Fire beacon ------------------------------------------------------------------

/** Whether a fire lit in this zone is seen by the whole arena. */
export function isBeaconGround(state: GameState, zoneName: string): boolean {
    const rule = state.arena.rules?.fireBeacon;
    if (!rule) return false;
    if (rule.zones?.includes(zoneName)) return true;
    const zone = getZone(state.arena, zoneName);
    if (!zone) return false;
    const f = zoneFeatures(zone);
    return f.elevation && f.cover <= rule.maxCover;
}

/**
 * Called when a tribute gets a fire going. On beacon ground every other living
 * tribute learns exactly where they are. Returns true when it fired.
 */
export function fireBeacon(ctx: SimContext, t: Tribute): boolean {
    if (!isBeaconGround(ctx.state, t.zone)) return false;
    const watchers = ctx.state.tributes.filter(o => o.status === 'alive' && o.id !== t.id);
    const rivals = ctx.state.tributes.filter(o => o.status === 'alive' && o.zone === t.zone).length;
    watchers.forEach(w => noteSighting(ctx.state, w, t.zone, rivals, 0));
    ctx.logEvent(
        `${t.name}'s fire in ${t.zone} is above anything that could hide it. Every tribute left in the arena can see it, and now knows where ${t.name} is sleeping.`,
        [t.id],
        { important: true, zone: t.zone, category: 'arena' },
    );
    return true;
}

// ---- Permanent collapse, latent edges, permanent cuts ----------------------------

/** Zones this run has lost for good. */
export function fallenZones(state: GameState): string[] {
    return state.arenaRuleState?.fallen ?? [];
}

/**
 * Takes a zone out of the arena for the rest of the run. Anybody standing in
 * it is moved to the nearest zone still standing (the caller decides what the
 * fall cost them first). Refuses the Cornucopia and refuses to leave fewer
 * than three zones. Returns whether it happened.
 */
export function collapseZonePermanently(ctx: SimContext, zone: string): boolean {
    const state = ctx.state;
    if (zone === state.arena.zones[0]?.name) return false;
    const collapsed = state.collapsedZones ?? (state.collapsedZones = []);
    const standing = state.arena.zones.map(z => z.name).filter(n => !collapsed.includes(n) && n !== zone);
    if (standing.length < 3) return false;
    const rs = ruleState(state);
    rs.fallen = [...new Set([...(rs.fallen ?? []), zone])];
    if (!collapsed.includes(zone)) collapsed.push(zone);
    evictZone(ctx, zone, [zone]);
    return true;
}

/** Keeps permanent losses in a recomputed collapse list (the border overwrites it daily). */
export function withFallen(state: GameState, collapsed: string[]): string[] {
    const fallen = fallenZones(state);
    if (fallen.length === 0) return collapsed;
    return [...new Set([...collapsed, ...fallen])];
}

/** Whether this edge is latent and not yet opened (closed to everybody). */
export function latentEdgeClosed(state: GameState | undefined, arenaRules: GameState['arena']['rules'], a: string, b: string): boolean {
    const latent = arenaRules?.latentEdges;
    if (!latent || latent.length === 0) return false;
    const key = edgeKey(a, b);
    if (!latent.some(([x, y]) => edgeKey(x, y) === key)) return false;
    return !(state?.arenaRuleState?.openedEdges ?? []).includes(key);
}

/** Opens a latent edge for the rest of the run. Returns false if it was not latent or already open. */
export function openLatentEdge(state: GameState, a: string, b: string): boolean {
    if (!latentEdgeClosed(state, state.arena.rules, a, b)) return false;
    const rs = ruleState(state);
    rs.openedEdges = [...(rs.openedEdges ?? []), edgeKey(a, b)];
    return true;
}

/** Latent edges still shut, as [a, b] pairs. */
export function closedLatentEdges(state: GameState): Array<[string, string]> {
    return (state.arena.rules?.latentEdges ?? []).filter(([a, b]) => latentEdgeClosed(state, state.arena.rules, a, b));
}

const PERMANENT_CUT_MARK = 'permanentCut:';

/** Severs an edge that the reopening tick may never put back. */
export function cutPermanently(state: GameState, a: string, b: string) {
    const key = edgeKey(a, b);
    state.severedEdges = state.severedEdges ?? [];
    if (!state.severedEdges.includes(key)) state.severedEdges.push(key);
    const rs = ruleState(state);
    rs.marks = { ...(rs.marks ?? {}), [PERMANENT_CUT_MARK + key]: 1 };
}

/** Whether a severed edge is permanent — read by `tickOpeningEdges`. */
export function isPermanentCut(state: GameState, key: string): boolean {
    return state.arenaRuleState?.marks?.[PERMANENT_CUT_MARK + key] !== undefined;
}

// ---- Eviction ------------------------------------------------------------------------

/**
 * Drives everybody standing in `zone` to the nearest zone not in `forbidden`
 * (and not collapsed). A tribute mid-crossing into it has the crossing
 * cancelled. Returns the tributes moved and where each went.
 */
export function evictZone(ctx: SimContext, zone: string, forbidden: string[]): Array<{ t: Tribute; to: string }> {
    const state = ctx.state;
    const collapsed = state.collapsedZones ?? [];
    const safe = state.arena.zones.map(z => z.name).filter(n => !forbidden.includes(n) && !collapsed.includes(n));
    if (safe.length === 0) return [];
    const moved: Array<{ t: Tribute; to: string }> = [];
    state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        if (t.transit && forbidden.includes(t.transit.to)) t.transit = undefined;
        if (t.zone !== zone) return;
        const to = nearestSafeZone(state.arena, zone, safe, severedEdgeSet(state));
        if (to === zone) return;
        t.zone = to;
        t.transit = undefined;
        moved.push({ t, to });
    });
    return moved;
}

// ---- Scratch marks for signatures ---------------------------------------------------

export function getMark(state: GameState, key: string): number | string | undefined {
    return state.arenaRuleState?.marks?.[key];
}

export function setMark(state: GameState, key: string, value: number | string | undefined) {
    const rs = ruleState(state);
    const marks = { ...(rs.marks ?? {}) };
    if (value === undefined) delete marks[key];
    else marks[key] = value;
    rs.marks = marks;
}

// =====================================================================================
// Structural rules: lockdown, blackout, enclosed ignition, remap, rotating shelter.
//
// Added alongside the five building-shaped arenas (the Gallery, the Malt House,
// Circuit Row, the Ward Block, the Glasshouse) but written against any arena:
// each is either an `Arena.rules` flag or a setter a signature drives, and each
// keeps its run-local bookkeeping in `arenaRuleState.marks` so it serialises
// and replays with the save like everything above.
// =====================================================================================

const LOCK_MARK = 'lockdown:';
const LOCK_CUT_MARK = 'lockcut:';
const BLACKOUT_MARK = 'blackout';
const SHELTER_MARK = 'shelter:';
const SHELTER_BASE_MARK = 'shelterBase:';

// ---- Zone lockdown -----------------------------------------------------------------

/** Whether this zone is sealed right now. */
export function isZoneLocked(state: GameState, zone: string): boolean {
    const until = state.arenaRuleState?.marks?.[LOCK_MARK + zone];
    return typeof until === 'number' && cycleNow(state) <= until;
}

/** Every zone currently sealed. */
export function lockedZones(state: GameState): string[] {
    return Object.keys(state.arenaRuleState?.marks ?? {})
        .filter(k => k.startsWith(LOCK_MARK))
        .map(k => k.slice(LOCK_MARK.length))
        .filter(z => isZoneLocked(state, z));
}

/**
 * Seals a zone through `untilCycle` inclusive: every edge out of it is cut,
 * and only the edges this call cut are put back on release — a route some
 * other mechanic had already severed stays severed. Anybody mid-crossing into
 * it is turned back. Under `rules.lockdownBlackout` the first lockdown of the
 * run also starts the communications blackout. Returns the tributes trapped.
 */
export function lockZone(state: GameState, zone: string, untilCycle: number): Tribute[] {
    const z = getZone(state.arena, zone);
    if (!z) return [];
    const rs = ruleState(state);
    const marks = { ...(rs.marks ?? {}) };
    const severed = state.severedEdges ?? (state.severedEdges = []);
    z.adjacent.forEach(n => {
        const key = edgeKey(zone, n);
        if (severed.includes(key)) return;
        severed.push(key);
        marks[LOCK_CUT_MARK + key] = 1;
    });
    marks[LOCK_MARK + zone] = untilCycle;
    if (state.arena.rules?.lockdownBlackout && marks[BLACKOUT_MARK] === undefined) {
        marks[BLACKOUT_MARK] = cycleNow(state);
    }
    rs.marks = marks;
    state.tributes.forEach(t => {
        if (t.status === 'alive' && t.transit && t.transit.to === zone && t.zone !== zone) t.transit = undefined;
    });
    return state.tributes.filter(t => t.status === 'alive' && t.zone === zone);
}

/**
 * Releases every lockdown whose timer has run out, restoring the edges it cut.
 * Returns the zones released this call, so the caller can say so.
 */
export function tickLockdowns(state: GameState): string[] {
    const marks = state.arenaRuleState?.marks;
    if (!marks) return [];
    const released: string[] = [];
    const next = { ...marks };
    Object.keys(marks).filter(k => k.startsWith(LOCK_MARK)).forEach(k => {
        const zone = k.slice(LOCK_MARK.length);
        if (isZoneLocked(state, zone)) return;
        delete next[k];
        released.push(zone);
    });
    if (released.length === 0) return [];
    const stillLocked = Object.keys(next).filter(k => k.startsWith(LOCK_MARK)).map(k => k.slice(LOCK_MARK.length));
    Object.keys(marks).filter(k => k.startsWith(LOCK_CUT_MARK)).forEach(k => {
        const key = k.slice(LOCK_CUT_MARK.length);
        const [a, b] = key.split('|');
        // An edge between two sealed zones stays cut until both are open.
        if (stillLocked.includes(a) || stillLocked.includes(b)) return;
        if (!released.includes(a) && !released.includes(b)) return;
        delete next[k];
        state.severedEdges = (state.severedEdges ?? []).filter(e => e !== key);
    });
    ruleState(state).marks = next;
    return released;
}

// ---- Communications blackout -------------------------------------------------------

/**
 * Whether the arena has gone dark to its own announcements: no cannon, no
 * faces in the sky. Read by `arenaIsSilent`, which every broadcast consumer
 * already honours. Started by the first lockdown under `rules.lockdownBlackout`
 * or directly by `startBlackout`.
 */
export function commsBlackout(state: GameState): boolean {
    return state.arenaRuleState?.marks?.[BLACKOUT_MARK] !== undefined;
}

export function startBlackout(state: GameState) {
    if (!commsBlackout(state)) setMark(state, BLACKOUT_MARK, cycleNow(state));
}

// ---- Enclosed ignition ----------------------------------------------------------------

/** Whether a flame in this zone can find the air (an `enclosedIgnition` zone). */
export function isEnclosedIgnitionZone(state: GameState, zone: string): boolean {
    return state.arena.rules?.enclosedIgnition?.zones.includes(zone) ?? false;
}

/**
 * The chain: `origin` goes up, and so does every enclosed-ignition zone that
 * touches it, and every one that touches those — the air is one room, however
 * many doors it has. Returns the zones in the order they went, origin first.
 * The caller applies the damage: this only decides where the fire reached.
 */
export function ignitionChain(state: GameState, origin: string): string[] {
    const zones = state.arena.rules?.enclosedIgnition?.zones ?? [];
    const collapsed = state.collapsedZones ?? [];
    const cut = severedEdgeSet(state);
    const reached = [origin];
    let frontier = [origin];
    while (frontier.length > 0) {
        const next: string[] = [];
        frontier.forEach(z => {
            (getZone(state.arena, z)?.adjacent ?? []).forEach(n => {
                if (reached.includes(n) || !zones.includes(n) || collapsed.includes(n)) return;
                if (cut.has(edgeKey(z, n))) return;
                reached.push(n);
                next.push(n);
            });
        });
        frontier = next;
    }
    return reached;
}

/**
 * Whether a fire just lit by `t` finds the air. Rolled at the rule's own
 * chance, raised by any vapour the arena's signature has recorded for the zone
 * (`marks['vapour:<zone>']`, 0-1). Returns the chain it set off, or [].
 */
export function flameFindsTheAir(ctx: SimContext, t: Tribute): string[] {
    const rule = ctx.state.arena.rules?.enclosedIgnition;
    if (!rule || !rule.zones.includes(t.zone)) return [];
    const vapour = Number(getMark(ctx.state, `vapour:${t.zone}`) ?? 0);
    if (!ctx.rng.chance(Math.min(0.95, rule.chance + vapour * ARENA_RULE_MECHANICS.vapourIgnitionBonus))) return [];
    return ignitionChain(ctx.state, t.zone);
}

// ---- Permanent remap of a zone's features --------------------------------------------

/**
 * Rewrites a zone's features for the rest of the run — a roof gone, a wall
 * down, a door welded. Written to this run's own zone object (the run's arena
 * is a per-zone clone, see `resolveArenaForRun`), replacing the features object
 * rather than editing it so the shared definition is never touched. The arena's
 * acoustics floor still holds afterwards.
 */
export function remapZoneFeatures(state: GameState, zone: string, patch: Partial<NonNullable<Zone['features']>>) {
    const z = getZone(state.arena, zone);
    if (!z) return;
    const current = zoneFeatures(z);
    const next = { ...current, ...patch };
    const floor = state.arena.rules?.acousticsFloor;
    if (floor !== undefined && (next.acoustics ?? 1) < floor) next.acoustics = floor;
    z.features = next;
}

// ---- Rotating safe shelter ------------------------------------------------------------

/** The zone currently designated as the arena's reliable shelter, if any. */
export function safeShelter(state: GameState): string | undefined {
    const v = getMark(state, SHELTER_MARK + 'current');
    return typeof v === 'string' ? v : undefined;
}

/**
 * Moves the designation to `zone`: its shelter is lifted to at least
 * `ARENA_RULE_MECHANICS.safeShelterQuality`, and the previous holder's shelter
 * goes back to what it was before it was designated (or to whatever a remap
 * has since made it, if lower). `undefined` clears the designation.
 */
export function rotateSafeShelter(state: GameState, zone: string | undefined) {
    const previous = safeShelter(state);
    if (previous === zone) return;
    if (previous) {
        const base = getMark(state, SHELTER_BASE_MARK + previous);
        const z = getZone(state.arena, previous);
        if (z && typeof base === 'number') {
            const now = zoneFeatures(z).shelterQuality ?? 0;
            remapZoneFeatures(state, previous, { shelterQuality: Math.min(now, base) });
        }
        setMark(state, SHELTER_BASE_MARK + previous, undefined);
    }
    setMark(state, SHELTER_MARK + 'current', zone);
    if (!zone) return;
    const z = getZone(state.arena, zone);
    if (!z) return;
    const base = zoneFeatures(z).shelterQuality ?? 0;
    setMark(state, SHELTER_BASE_MARK + zone, base);
    remapZoneFeatures(state, zone, { shelterQuality: Math.max(base, ARENA_RULE_MECHANICS.safeShelterQuality) });
}

/**
 * `enclosedIgnition`'s read site: called when a tribute gets a fire going.
 * If the flame finds the air, every zone in the chain burns and everybody
 * standing in one is caught — the lighter worst. Returns the chain.
 */
export function igniteFromFlame(ctx: SimContext, t: Tribute): string[] {
    const chain = flameFindsTheAir(ctx, t);
    if (chain.length === 0) return [];
    ctx.logEvent(
        chain.length > 1
            ? `${t.name}'s fire in ${t.zone} finds the vapour in the air, and the flash goes through the doors into ${chain.slice(1).join(', ')}.`
            : `${t.name}'s fire in ${t.zone} finds the vapour in the air. The whole room goes up at once.`,
        [t.id],
        { important: true, zone: t.zone, category: 'hazard' },
    );
    burnChain(ctx, chain, `Caught in the flash in {zone}`, t.id);
    return chain;
}

/**
 * Burns every zone of an ignition chain: a `burning` effect on each, the
 * vapour record cleared, and damage to everybody standing in one. `cause` may
 * carry `{zone}`. `lighterId`, if given, takes an extra share.
 */
export function burnChain(ctx: SimContext, chain: string[], cause: string, lighterId?: string) {
    chain.forEach(zone => {
        startZoneEffect(ctx, zone, 'burning', false);
        setMark(ctx.state, `vapour:${zone}`, undefined);
        const why = cause.replace('{zone}', zone);
        ctx.state.tributes.filter(o => o.status === 'alive' && o.zone === zone).forEach(o => {
            const amount = ARENA_RULE_MECHANICS.ignitionDamage + (o.id === lighterId ? ARENA_RULE_MECHANICS.ignitionLighterDamage : 0);
            injure(o, 'burned');
            applyDamage(ctx, o, amount, { cause: why, kind: 'arena', code: 'burns' });
            checkDeath(ctx, o, why);
        });
    });
}
