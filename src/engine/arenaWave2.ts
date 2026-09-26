import type { DeathCauseCode, GameState, Tribute } from '../models/types';
import type { ArenaEventDef } from '../data/arenaFlavor';
import { arenaFlavor } from '../data/arenaFlavor';
import { ARENA_DEATH_BUDGET, AUDIT12_WAVE2_ARENA as K, MEMORY } from '../data/balance';
import { ITEMS } from '../data/constants';
import { RNG } from '../utils/rng';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { edgeKey, getZone, severEdge, depleteZone, zoneFeatures } from './map';
import { addZoneThreat, ensureMemory, noteRivalPlace, cycleOf } from './memory';
import { startZoneEffect, hasEffect } from './zoneEffects';
import { injure, openWound } from './wounds';
import { clampTribute } from './vitals';
import { loseSanity } from './sanityBands';
import { giveItem, mintItem } from './items';
import { getMark, setMark, lockZone, isZoneLocked, tickLockdowns } from './arenaRules';
import { readsWeather, currentWeather } from './arenaDepth';
import { adjustRel } from './relationships';
import { allied } from './alliance';
import { applyArenaEvent } from './encounters';

/**
 * AUDIT-12 §8, wave 2: the arena doing its own job.
 *
 * Four generic rules and eleven arenas' worth of mechanics, all expressed
 * through machinery that already exists — marks, lockdowns, severed edges,
 * zone effects, memory, the damage pipeline — so a seed replays exactly:
 *
 *   §8.1  the border kill cap (`borderCapReached`, `arenaHazardForBorder`);
 *   §8.2  own-cause attribution (`stampSignature`, `DamageRecord.signature`);
 *   §8.4  hazard telegraphs (`tickTelegraphs`, `telegraphDodgeBonus`);
 *   §8.6  scarce water for arenas with no water source (`tickScarceWater`);
 *   §8    the thin arenas' own mechanics (`THIN_ARENA_MECHANICS`).
 *
 * Everything here runs from `runArenaSignature` after the arena's own rule,
 * inside the same finalist guard, and every wound it deals is stamped as the
 * arena's own.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function alive(ctx: SimContext): Tribute[] {
    return getAlive(ctx.state);
}

function inZone(ctx: SimContext, zone: string): Tribute[] {
    return alive(ctx).filter(t => t.zone === zone);
}

function zoneLive(ctx: SimContext, zone: string): boolean {
    return getZone(ctx.state.arena, zone) !== undefined && !(ctx.state.collapsedZones ?? []).includes(zone);
}

function num(state: GameState, key: string, fallback = 0): number {
    const v = getMark(state, key);
    return typeof v === 'number' ? v : fallback;
}

function isNight(ctx: SimContext): boolean {
    return ctx.state.timeOfDay === 'night';
}

/** Marks a wound this cycle as the arena's own, whoever dealt it. */
function stamp(t: Tribute) {
    // In place: the same object is the wound ledger's last entry.
    if (t.lastDamage) t.lastDamage.signature = true;
}

/**
 * A finishing blow, sized so the arena-lethality scaling in `applyDamage`
 * does not turn it back into a graze. It is still subject to the arena death
 * budget and the finalist saves, which is the point: the budget decides how
 * many the arena takes, and this decides that the ones it takes are its own.
 */
export function finishingDamage(ctx: SimContext, t: Tribute): number {
    const rate = Math.max(ARENA_DEATH_BUDGET.minNaturalRate, Math.min(ARENA_DEATH_BUDGET.maxNaturalRate, ctx.state.config.naturalDeathRate ?? 1));
    return Math.ceil(t.health / rate) + 1;
}

interface StrikeOpts {
    damage?: number;
    code: DeathCauseCode;
    injury?: 'burned' | 'poisoned' | 'frostbitten' | 'infected';
    bleed?: boolean;
    /** Extra flat dodge chance (a warning, a line, a key). */
    dodgeBonus?: number;
    escape?: string;
}

/**
 * The arena's hit: a dodge on agility (plus sky-reading, plus any bonus), the
 * damage, the injury, and — on somebody already hurt — the finishing blow
 * the machinery in AUDIT-6 §7.3 established.
 */
function strike(ctx: SimContext, rng: RNG, t: Tribute, cause: string, line: string, o: StrikeOpts): boolean {
    if (t.status !== 'alive') return false;
    const dodge = K.mechanicDodgeBase + t.attributes.agility * K.mechanicDodgePerAgility
        + (readsWeather(t) ? K.telegraphDodgeBonus * 0.05 : 0) + (o.dodgeBonus ?? 0);
    if (rng.chance(Math.min(0.9, dodge))) {
        if (o.escape) ctx.logEvent(o.escape.replace('{tribute}', t.name), [t.id], { zone: t.zone, category: 'arena' });
        return false;
    }
    applyDamage(ctx, t, o.damage ?? K.mechanicDamage, { cause, kind: 'arena', code: o.code });
    if (o.injury) injure(t, o.injury);
    if (o.bleed) openWound(t, 1);
    ctx.logEvent(line.replace('{tribute}', t.name), [t.id], { important: true, zone: t.zone, category: 'hazard' });
    if (t.health > 0 && t.health <= K.mechanicFinishBelowHealth && rng.chance(K.mechanicFinishChance)) {
        applyDamage(ctx, t, finishingDamage(ctx, t), { cause, kind: 'arena', code: o.code });
    }
    addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat * 2);
    clampTribute(t);
    stamp(t);
    checkDeath(ctx, t, cause);
    return true;
}

/** Every living tribute learns where `who` is standing. */
function reveal(ctx: SimContext, who: Tribute[]) {
    const everyone = alive(ctx);
    who.forEach(w => everyone.forEach(o => { if (o.id !== w.id) noteRivalPlace(ctx.state, o, w); }));
}

/** Whether the live zone graph stays connected without `key`. */
function staysConnected(ctx: SimContext, cutKey: string): boolean {
    const collapsed = new Set(ctx.state.collapsedZones ?? []);
    const severed = new Set(ctx.state.severedEdges ?? []);
    severed.add(cutKey);
    const live = ctx.state.arena.zones.filter(z => !collapsed.has(z.name));
    if (live.length === 0) return true;
    const seen = new Set([live[0].name]);
    const queue = [live[0].name];
    while (queue.length) {
        const here = getZone(ctx.state.arena, queue.shift()!);
        here?.adjacent.forEach(n => {
            if (seen.has(n) || collapsed.has(n) || severed.has(edgeKey(here.name, n))) return;
            seen.add(n);
            queue.push(n);
        });
    }
    return live.every(z => seen.has(z.name) || isZoneLocked(ctx.state, z.name));
}

const OWNED_CUTS = 'w2cuts';
function ownedCuts(state: GameState): string[] {
    const v = getMark(state, OWNED_CUTS);
    return typeof v === 'string' && v ? v.split('|') : [];
}
/** Cuts an edge this module owns (and will put back), if the map survives it. */
function cutOwned(ctx: SimContext, a: string, b: string): boolean {
    const key = edgeKey(a, b);
    if ((ctx.state.severedEdges ?? []).includes(key)) return false;
    if (!staysConnected(ctx, key)) return false;
    severEdge(ctx.state, a, b);
    setMark(ctx.state, OWNED_CUTS, [...ownedCuts(ctx.state), key].join('|'));
    return true;
}
/** Puts back an edge this module cut. */
function restoreOwned(ctx: SimContext, key: string) {
    const cuts = ownedCuts(ctx.state);
    if (!cuts.includes(key)) return;
    ctx.state.severedEdges = (ctx.state.severedEdges ?? []).filter(k => k !== key);
    setMark(ctx.state, OWNED_CUTS, cuts.filter(k => k !== key).join('|') || undefined);
}

function grant(ctx: SimContext, rng: RNG, t: Tribute, id: string) {
    const item = ITEMS.find(i => i.id === id);
    if (item) giveItem(t, mintItem(rng, item));
}

// ---------------------------------------------------------------------------
// §8.2: own-cause attribution
// ---------------------------------------------------------------------------

/** Snapshot of every living tribute's last wound, taken before the arena acts. */
export function woundSnapshot(state: GameState): Map<string, unknown> {
    const snap = new Map<string, unknown>(state.tributes.map(t => [t.id, t.lastDamage]));
    state.tributes.forEach(t => snap.set(`inj:${t.id}`, { ...t.injuries }));
    Object.values(state.zoneEffects ?? {}).forEach(list => list.forEach(e => snap.set(`fx`, [...((snap.get('fx') as unknown[]) ?? []), e])));
    return snap;
}

/**
 * Anything wounded between the snapshot and now was wounded by the arena's
 * own rule — its signature, a thin-arena mechanic, a telegraphed hazard. The
 * closing border is the one thing that is never the arena's own.
 */
export function stampSignature(state: GameState, before: Map<string, unknown>) {
    // An injury the arena gave is the arena's when it finishes them later.
    state.tributes.forEach(t => {
        const was = before.get(`inj:${t.id}`) as Tribute['injuries'] | undefined;
        if (was) noteArenaInjuries(state, t, was);
    });
    // Any zone effect that did not exist before the arena acted is the arena's.
    const existing = new Set((before.get('fx') as unknown[]) ?? []);
    Object.values(state.zoneEffects ?? {}).forEach(list => list.forEach(e => { if (!existing.has(e) && e.source !== 'tribute' && e.source !== 'gamemaker') e.signature = true; }));
    state.tributes.forEach(t => {
        const d = t.lastDamage;
        if (!d || d === before.get(t.id) || d.signature) return;
        if (d.kind === 'tribute' || d.code === 'border' || d.sourceId) return;
        d.signature = true;
    });
}

/** The body finishing what a wound started. */
const FOLLOW_ON: ReadonlySet<string> = new Set(['bleeding', 'infection', 'sepsis', 'shock', 'status', 'burns', 'poison']);

/**
 * Whether the arena killed this tribute: its own wound was the killing blow,
 * or the killing blow was the body giving out after the arena's own wound was
 * the last real one. Read by the per-arena death-mix guard.
 */
/** Which injury a follow-on death code is the body giving out to. */
const INJURY_OF: Record<string, keyof Tribute['injuries']> = {
    burns: 'burned', poison: 'poisoned', infection: 'infected', sepsis: 'infected', bleeding: 'bleeding', hypothermia: 'frostbitten',
};

export function diedOfArena(t: Tribute, state?: GameState): boolean {
    if (t.status !== 'dead' || t.causeCode === 'tribute') return false;
    if (t.lastDamage?.signature) return true;
    const injury = INJURY_OF[t.causeCode ?? ''];
    if (state && injury && t.lastDamage?.kind === 'status' && getMark(state, `w2inj:${t.id}:${injury}`) === 1) return true;
    if (!FOLLOW_ON.has(t.causeCode ?? '')) return false;
    const ledger = t.wounds ?? [];
    for (let i = ledger.length - 1; i >= 0; i--) {
        const w = ledger[i];
        if (w.kind === 'status' || FOLLOW_ON.has(w.code ?? '')) continue;
        return w.signature === true;
    }
    return false;
}

/** Records which of `t`'s injuries the arena gave them since `was`. */
export function noteArenaInjuries(state: GameState, t: Tribute, was: Tribute['injuries']) {
    if (t.status !== 'alive') return;
    (['burned', 'poisoned', 'infected', 'frostbitten', 'bleeding'] as const).forEach(k => {
        if (t.injuries[k] && !was[k]) setMark(state, `w2inj:${t.id}:${k}`, 1);
    });
}

/**
 * Called by `applyEventTo` after an authored event lands. An arena's own
 * hazard landing on somebody already on their last legs is decisive — the
 * AUDIT-6 §7.3 rule for machinery, extended to every arena's own pack, so a
 * thin arena's deaths are recognisably its own rather than the bleed-out
 * that follows them.
 */
export function stampEventSignature(ctx: SimContext, t: Tribute, event: ArenaEventDef) {
    if (!event.signature || !event.damage) return;
    stamp(t);
    const gave: Array<[boolean | undefined, keyof Tribute['injuries']]> = [
        [event.burned, 'burned'], [event.poisoned, 'poisoned'], [event.infected, 'infected'], [event.frostbitten, 'frostbitten'], [event.bleeding, 'bleeding'],
    ];
    gave.forEach(([on, k]) => { if (on && t.injuries[k]) setMark(ctx.state, `w2inj:${t.id}:${k}`, 1); });
    if (t.status === 'alive' && t.health > 0 && t.health <= K.signatureFinishBelowHealth && ctx.rng.chance(K.signatureFinishChance)) {
        applyDamage(ctx, t, finishingDamage(ctx, t), { cause: event.cause, kind: 'hazard', code: event.code });
        stamp(t);
    }
}

// ---------------------------------------------------------------------------
// §8.1: the border kill cap
// ---------------------------------------------------------------------------

/** §8.2/§8.3: the per-arena death-mix band `check-arena-deathmix` holds every arena to. */
export const DEATH_MIX_BAND = {
    tributeMin: K.tributeShareMin,
    tributeMax: K.tributeShareMax,
    ownMin: K.signatureShareMin,
    borderCap: K.borderKillCap,
} as const;

export function borderKills(state: GameState): number {
    return state.tributes.filter(t => t.status === 'dead' && t.causeCode === 'border').length;
}

export function borderCapReached(state: GameState): boolean {
    return borderKills(state) >= K.borderKillCap;
}

/** The arena's own lethal events, as the stand-in for the closing sector. */
function ownHazards(state: GameState): ArenaEventDef[] {
    return arenaFlavor(state.arena.id, state.arena).events
        .filter(e => e.signature && (e.damage ?? 0) > 0 && e.cause);
}

/**
 * The border has had its share. The sector still closes — the tribute is
 * still herded out of it, and still bloodied, never killed, by the wall — but
 * what is waiting in the closing ground is the arena's own hazard.
 */
export function arenaHazardForBorder(ctx: SimContext, t: Tribute, zone: string): string | undefined {
    const rng = new RNG(`${ctx.state.seed}-w2border-${cycleOf(ctx.state)}-${t.id}`);
    const pool = ownHazards(ctx.state);
    const event = pool.length ? rng.pick(pool) : undefined;
    const cause = event?.cause || `Caught by ${ctx.state.arena.name} as ${zone} closed`;
    if (rng.chance(K.mechanicDodgeBase + t.attributes.agility * K.mechanicDodgePerAgility)) {
        ctx.logEvent(`${t.name} gets out of ${zone} ahead of whatever the arena had waiting in it.`, [t.id], { zone, category: 'arena' });
        return undefined;
    }
    ctx.logEvent(
        `${zone} closes, and the arena does not bother with the wall for ${t.name}: what is in the closing ground is ${ctx.state.arena.name}'s own.`,
        [t.id], { important: true, zone, category: 'hazard' },
    );
    applyDamage(ctx, t, K.borderHazardDamage, { cause, kind: 'arena', code: event?.code ?? 'hazard' });
    if (event?.burned) injure(t, 'burned');
    if (event?.poisoned) injure(t, 'poisoned');
    if (event?.frostbitten) injure(t, 'frostbitten');
    if (event?.startsZoneEffect && zoneLive(ctx, zone)) startZoneEffect(ctx, zone, event.startsZoneEffect, false);
    clampTribute(t);
    stamp(t);
    return cause;
}

// ---------------------------------------------------------------------------
// §8.4: hazard telegraphs
// ---------------------------------------------------------------------------

const TELE = 'w2tele';
const GENERIC_WARN = [
    'Something in {zone} is wrong, and anyone looking can see it: the ground, the air, the quiet. It will go before the cycle is out.',
    'The Gamemakers\' board flickers over {zone}. Everyone who reads this arena knows what that means for the next cycle.',
    '{zone} gives its warning the way this arena always does, once, and not loudly.',
];

interface Telegraph { zone: string; eventId: string; fireAt: number; warned: string[] }

function readTelegraph(state: GameState): Telegraph | undefined {
    const raw = getMark(state, TELE);
    if (typeof raw !== 'string') return undefined;
    try { return JSON.parse(raw) as Telegraph; } catch { return undefined; }
}

/** The telegraphed hazard now firing, if any — read by the escape roll. */
let firing: Telegraph | undefined;

/**
 * Dodge bonus against a telegraphed hazard as it lands: sky-readers get the
 * full bonus, anybody who was standing there when it was called gets some.
 */
export function telegraphDodgeBonus(t: Tribute, event: ArenaEventDef): number {
    if (!firing || firing.eventId !== event.id || firing.zone !== t.zone) return 0;
    if (readsWeather(t)) return K.telegraphDodgeBonus;
    return firing.warned.includes(t.id) ? K.telegraphWarnedBonus : 0;
}

function tickTelegraphs(ctx: SimContext, rng: RNG) {
    const now = cycleOf(ctx.state);
    const pending = readTelegraph(ctx.state);
    if (pending && pending.fireAt <= now) {
        setMark(ctx.state, TELE, undefined);
        const event = ownHazards(ctx.state).find(e => e.id === pending.eventId);
        const caught = inZone(ctx, pending.zone);
        if (event && caught.length > 0 && zoneLive(ctx, pending.zone)) {
            firing = pending;
            try {
                // A called hazard takes the room, not one person in it.
                // Called, and so the arena's full weight: the warning is the mercy.
                const called: ArenaEventDef = {
                    ...event, zoneWide: false,
                    damage: Math.round((event.damage ?? 0) * K.telegraphDamageScale),
                    dodgeDifficulty: (event.dodgeDifficulty ?? 6) + K.telegraphDifficulty,
                };
                caught.slice(0, TELEGRAPH_MAX_CAUGHT).forEach(t => { if (t.status === 'alive') applyArenaEvent(ctx, t, called); });
            } finally {
                firing = undefined;
            }
        } else if (event) {
            ctx.logEvent(`What was coming in ${pending.zone} comes, and finds the place empty. Everybody listened.`, [], { zone: pending.zone, category: 'arena' });
        }
        return;
    }
    if (pending) return;
    if (!rng.chance(TELEGRAPH_CHANCE)) return;
    const pool = ownHazards(ctx.state);
    if (pool.length === 0) return;
    const occupied = [...new Set(alive(ctx).map(t => t.zone))].filter(z => zoneLive(ctx, z));
    if (occupied.length === 0) return;
    // The arena calls its hazard where the people are.
    const crowd = (z: string) => inZone(ctx, z).length;
    const zone = [...occupied].sort((a, b) => crowd(b) - crowd(a) || a.localeCompare(b))[rng.nextInt(0, Math.min(1, occupied.length - 1))];
    const terrain = getZone(ctx.state.arena, zone)?.terrain;
    const fits = pool.filter(e => !e.terrains || (terrain !== undefined && e.terrains.includes(terrain)));
    const event = rng.pick(fits.length ? fits : pool);
    if (!event.id) return;
    const warned = inZone(ctx, zone).map(t => t.id);
    setMark(ctx.state, TELE, JSON.stringify({ zone, eventId: event.id, fireAt: now + 1, warned } satisfies Telegraph));
    const text = (event.warnText ?? rng.pick(GENERIC_WARN)).replace(/\{zone\}/g, zone);
    ctx.logEvent(text, [], { type: 'signature-beats', important: true, zone, category: 'arena' });
    alive(ctx).forEach(t => addZoneThreat(ctx.state, t, zone, MEMORY.cannonThreat));
}
const TELEGRAPH_CHANCE = K.telegraphChance;
const TELEGRAPH_MAX_CAUGHT = K.telegraphMaxCaught;

// ---------------------------------------------------------------------------
// §8.6: scarce water
// ---------------------------------------------------------------------------

interface WaterSource { zone: string; name: string; risk: string; cause: string; code: DeathCauseCode; injury?: StrikeOpts['injury'] }

/** One source per waterless arena, each with the thing it costs. */
const SCARCE_WATER: Record<string, WaterSource> = {
    toxic: { zone: 'The Ruined Shacks', name: 'a rain barrel under the shack eaves', risk: 'The barrel has been catching the bog\'s runoff too.', cause: 'Drank from the shack barrel', code: 'poison', injury: 'poisoned' },
    tempest: { zone: 'The Lighthouse', name: 'the lighthouse cistern', risk: 'The cistern stair is salt-slick and a long way down.', cause: 'Fell on the cistern stair', code: 'fall' },
    saltflats: { zone: 'Scrub Hollow', name: 'a dew trap in the scrub roots', risk: 'The roots are where the brine scorpions sleep.', cause: 'Stung at the dew trap', code: 'poison', injury: 'poisoned' },
    warren: { zone: 'The Old Workings', name: 'a seep dripping off the old pit props', risk: 'Tapping the seep loosens the props it runs down.', cause: 'Brought down the props at the seep', code: 'collapse' },
    reef: { zone: 'The Tidepool Terraces', name: 'rainwater lying on the upper terraces', risk: 'The terrace coral is razor under the water.', cause: 'Opened on the terrace coral', code: 'bleeding' },
    abattoir: { zone: 'The Coolant Vats', name: 'a condensate tap on the coolant line', risk: 'The tap runs clean until it runs coolant.', cause: 'Drank coolant from the vat tap', code: 'poison', injury: 'poisoned' },
    ashwaste: { zone: 'The Steam Field', name: 'condensate off a steam vent', risk: 'The vent does not always breathe out slowly.', cause: 'Scalded at the steam vent', code: 'burns', injury: 'burned' },
    floe: { zone: 'The Big Berg', name: 'meltwater dripping off the berg face', risk: 'The berg face is what the meltwater is taking apart.', cause: 'Under the berg face when it calved', code: 'collapse' },
    seapeaks: { zone: 'The Ice Chimney', name: 'a meltwater drip in the chimney', risk: 'The chimney ice does not hold a person\'s weight for long.', cause: 'Fell in the Ice Chimney', code: 'fall' },
    ashgrove: { zone: 'The Boiler Room', name: 'the boiler\'s condensate line', risk: 'The boiler is still firing, and the line is right up against it.', cause: 'Scalded on the boiler line', code: 'burns', injury: 'burned' },
    kelvin: { zone: 'Generator Hall', name: 'a coolant line weeping clean melt', risk: 'The line is carrying current it should not.', cause: 'Electrocuted on the coolant line', code: 'machinery' },
    menagerie: { zone: 'The Aquarium', name: 'the aquarium\'s top-up tank', risk: 'The tank is fed from the same lines as the eel tanks.', cause: 'Took by the eels at the top-up tank', code: 'mutt', injury: 'infected' },
    gallery: { zone: 'The Green Room', name: 'the green-room sink, still dripping', risk: 'The pipes rattle the length of the building every time it runs.', cause: 'Found at the green-room sink', code: 'hazard' },
    circuit: { zone: 'Pit Lane', name: 'the pit-crew coolant drums', risk: 'Half the drums were never coolant.', cause: 'Drank from the wrong pit drum', code: 'poison', injury: 'poisoned' },
    wardblock: { zone: 'The Laundry', name: 'the laundry\'s rinse tanks', risk: 'The tank lids come down on the same timer as the cell doors.', cause: 'Caught by the laundry tank lid', code: 'machinery' },
    hippodrome: { zone: 'The Petting Barn', name: 'the petting barn\'s trough', risk: 'The animals in the barn are not the animals on the sign.', cause: 'Bitten at the petting-barn trough', code: 'mutt', injury: 'infected' },
};

/** The arena's scarce source, if it has no water of its own. */
export function scarceWaterSource(state: GameState): WaterSource | undefined {
    if (state.arena.zones.some(z => zoneFeatures(z).waterSource)) return undefined;
    const authored = SCARCE_WATER[state.arena.id];
    if (authored && getZone(state.arena, authored.zone)) return authored;
    // Anything else waterless (a procedural roll, a skin): the richest zone
    // that is not the horn keeps a little, and it costs a fall to get at it.
    const zones = state.arena.zones.slice(1).sort((a, b) => b.resources - a.resources || a.name.localeCompare(b.name));
    if (zones.length === 0) return undefined;
    return { zone: zones[0].name, name: 'a seep nobody else has found', risk: 'The seep is at the bottom of the worst ground in the zone.', cause: `Fell getting at the seep in ${zones[0].name}`, code: 'fall' };
}

function tickScarceWater(ctx: SimContext, rng: RNG) {
    const src = scarceWaterSource(ctx.state);
    if (!src || !zoneLive(ctx, src.zone)) return;
    const severed = new Set(ctx.state.severedEdges ?? []);
    alive(ctx).forEach(t => {
        if (t.vitals.thirst < K.scarceWaterThirst) return;
        if (t.zone !== src.zone) {
            // Close enough to smell it: they go.
            const here = getZone(ctx.state.arena, t.zone);
            if (!here?.adjacent.includes(src.zone) || severed.has(edgeKey(t.zone, src.zone)) || isZoneLocked(ctx.state, t.zone) || isZoneLocked(ctx.state, src.zone) || t.transit) return;
            t.zone = src.zone;
            ctx.logEvent(`${t.name} has been thirsty long enough to go to ${src.zone} for ${src.name}, whoever else knows about it.`, [t.id], { zone: src.zone, category: 'survival' });
        }
        t.vitals.thirst = Math.max(0, t.vitals.thirst - K.scarceWaterQuench);
        ctx.logEvent(`${t.name} drinks from ${src.name} in ${src.zone}.`, [t.id], { zone: src.zone, category: 'survival' });
        if (rng.chance(K.scarceWaterRiskChance)) {
            strike(ctx, rng, t, src.cause, `${src.risk} {tribute} finds that out the hard way.`,
                { damage: K.scarceWaterRiskDamage, code: src.code, injury: src.injury, dodgeBonus: 0.15 });
        }
        clampTribute(t);
    });
}

// ---------------------------------------------------------------------------
// §8: the thin arenas
// ---------------------------------------------------------------------------

type Mechanic = (ctx: SimContext, cycle: number, rng: RNG) => void;

/** Red Cathedral: the hour bell, the crypt at vespers, the votives in the nave. */
const redcathedral: Mechanic = (ctx, cycle, rng) => {
    const strikeNo = num(ctx.state, 'w2bell') + 1;
    setMark(ctx.state, 'w2bell', strikeNo);
    const great = strikeNo % 4 === 0;
    if (strikeNo % 4 === 3) {
        ctx.logEvent('The canyon bell strikes the third hour, and the echo comes back off the Slot wrong. The great hour is next, and the rock knows it.', [], { category: 'arena' });
        ['The Slot', 'The Bright Angel Descent'].forEach(z => alive(ctx).forEach(t => addZoneThreat(ctx.state, t, z, MEMORY.cannonThreat)));
    }
    // Every strike carries: whoever is on the high ground is heard.
    const high = alive(ctx).filter(t => getZone(ctx.state.arena, t.zone)?.terrain === 'highland');
    if (high.length) reveal(ctx, high);
    if (great) {
        ctx.logEvent('THE GREAT HOUR: the bell goes twelve times and the canyon rings with it. Rock comes off the walls of the Slot and the Descent.', [], { type: 'signature-beats', important: true, category: 'arena' });
        ['The Slot', 'The Bright Angel Descent'].filter(z => zoneLive(ctx, z)).forEach(z => inZone(ctx, z).forEach(t =>
            strike(ctx, rng, t, `Shaken off the wall of ${z} by the great hour`, `The great hour shakes {tribute} off the wall of ${z}.`, { code: 'fall', bleed: true, damage: K.mechanicHeavyDamage })));
    }
    if (isNight(ctx) && zoneLive(ctx, 'Cliff Dwellings')) {
        ctx.logEvent('Vespers: the flood channel above the Cliff Dwellings opens, and the crypt under them fills to the lintels.', [], { important: true, zone: 'Cliff Dwellings', category: 'arena' });
        startZoneEffect(ctx, 'Cliff Dwellings', 'flooded', false);
        inZone(ctx, 'Cliff Dwellings').forEach(t =>
            strike(ctx, rng, t, 'Drowned in the crypt at vespers', 'The crypt fills faster than {tribute} can find the stair.', { code: 'drowning', escape: '{tribute} is up the stair before the water reaches the lintels.' }));
    }
    if (isNight(ctx) && zoneLive(ctx, 'Rim Pinyon') && inZone(ctx, 'Rim Pinyon').length > 0 && K.thin.votiveIgniteChance) {
        ctx.logEvent('The votive candles along the Rim Pinyon nave have burned down to the dry needles. The nave goes up.', [], { important: true, zone: 'Rim Pinyon', category: 'arena' });
        startZoneEffect(ctx, 'Rim Pinyon', 'burning', false);
        inZone(ctx, 'Rim Pinyon').forEach(t =>
            strike(ctx, rng, t, 'Burned in the votive fire', 'The votive fire takes the nave with {tribute} still in it.', { code: 'burns', injury: 'burned' }));
    }
    void cycle;
};

/** Cul-de-Sac: houses closing in turn, the sprinklers, the garage door, the gas main. */
const culdesac: Mechanic = (ctx, cycle, rng) => {
    const houses = ['Number 14', 'Number 27', 'The Show Home'].filter(z => zoneLive(ctx, z));
    if (!isNight(ctx) && cycle % 3 === 0 && houses.length) {
        const house = houses[num(ctx.state, 'w2house') % houses.length];
        setMark(ctx.state, 'w2house', num(ctx.state, 'w2house') + 1);
        if (!isZoneLocked(ctx.state, house)) {
            const trapped = lockZone(ctx.state, house, cycle + 2);
            ctx.logEvent(`${house} closes: shutters down, deadbolts home, the porch light off. It is not open to visitors for two cycles.`, [], { important: true, zone: house, category: 'arena' });
            trapped.forEach(t => {
                loseSanity(t, 6);
                t.vitals.fatigue += K.thin.closedHouseFatigue;
                clampTribute(t);
                if (t.health < K.thin.closedHouseKeepsBelow) strike(ctx, rng, t, `Kept by ${house}`, `${house} is warm and dark and does not let {tribute} go.`, { code: 'trap' });
            });
        }
    }
    // Sprinklers on a timer: water, and a spotlight.
    if (!isNight(ctx) && cycle % 2 === 1) {
        const lawns = ['The Green', 'Back Gardens'].filter(z => zoneLive(ctx, z));
        const wet = lawns.flatMap(z => inZone(ctx, z));
        if (wet.length) {
            ctx.logEvent('The sprinklers come on across the lawns on their timer. Anyone standing on the grass is soaked, and visible from every window on the loop.', wet.map(t => t.id), { category: 'arena' });
            wet.forEach(t => { t.vitals.thirst = Math.max(0, t.vitals.thirst - K.mechanicRelief); t.vitals.fatigue += K.thin.sprinklerFatigue; clampTribute(t); });
            reveal(ctx, wet);
        }
    }
    // The garage door on the Loading Bay runs on a cycle.
    const bay = getZone(ctx.state.arena, 'The Loading Bay');
    if (bay && zoneLive(ctx, 'The Loading Bay')) {
        const door = bay.adjacent[0];
        const key = edgeKey('The Loading Bay', door);
        if (cycle % 2 === 0) {
            if (cutOwned(ctx, 'The Loading Bay', door)) ctx.logEvent(`The garage door between the Loading Bay and ${door} rolls down on its motor.`, [], { zone: 'The Loading Bay', category: 'arena' });
            inZone(ctx, 'The Loading Bay').filter(() => rng.chance(K.thin.garageDoorChance)).forEach(t =>
                strike(ctx, rng, t, 'Under the garage door', 'The garage door comes down on {tribute} and does not reverse.', { code: 'machinery' }));
        } else {
            restoreOwned(ctx, key);
        }
    }
    // The gas main, once, and only once the street has been lived on.
    if (ctx.state.day >= K.thin.gasMainFromDay && getMark(ctx.state, 'w2gas') === undefined && zoneLive(ctx, 'The Substation') && rng.chance(K.thin.gasMainChance)) {
        setMark(ctx.state, 'w2gas', cycle);
        ctx.logEvent('THE GAS MAIN: the smell comes first, down the whole loop at once. Then the Substation goes up.', [], { type: 'signature-beats', important: true, zone: 'The Substation', category: 'arena' });
        startZoneEffect(ctx, 'The Substation', 'burning', false);
        inZone(ctx, 'The Substation').forEach(t =>
            strike(ctx, rng, t, 'Caught in the gas main blast', 'The blast takes {tribute} off their feet.', { code: 'burns', injury: 'burned', damage: K.mechanicHeavyDamage }));
    }
};

/** Ashgrove Secondary: the period bell, the fire drill, the PA. */
const ashgrove: Mechanic = (ctx, cycle, rng) => {
    const rooms = ['The Library', 'Science Block', 'The Cafeteria', 'The Gymnasium'].filter(z => zoneLive(ctx, z));
    if (rooms.length && !isNight(ctx)) {
        const room = rooms[cycle % rooms.length];
        const next = rooms[(cycle + 1) % rooms.length];
        if (!isZoneLocked(ctx.state, room)) {
            lockZone(ctx.state, room, cycle + 1);
            ctx.logEvent(`The period bell: ${room} is in session and its doors are shut until the next one. ${next} is after.`, [], { zone: room, category: 'arena' });
        }
    }
    // Fire drill: the doors lock, the smoke is real.
    if (cycle % 5 === 3) {
        const hall = ['The Auditorium', 'Lockers'].filter(z => zoneLive(ctx, z));
        ctx.logEvent('FIRE DRILL: the alarm, the lights, and the fire doors dropping on their magnets. This one has smoke in it.', [], { type: 'signature-beats', important: true, category: 'arena' });
        hall.forEach(z => {
            if (!isZoneLocked(ctx.state, z)) lockZone(ctx.state, z, cycle + 1);
            inZone(ctx, z).forEach(t => strike(ctx, rng, t, `Smoke behind the fire doors in ${z}`, `The fire doors seal ${z} with {tribute} and the smoke inside it.`, { code: 'asphyxiation' }));
        });
    }
    // The PA: whoever has done the most, read out to the whole school.
    if (cycle % 3 === 1) {
        const leader = [...alive(ctx)].sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0) || a.id.localeCompare(b.id))[0];
        if (leader && (leader.kills ?? 0) > 0) {
            ctx.logEvent(`The PA crackles: "Would ${leader.name} please report to the office. ${leader.name} is currently in ${leader.zone}." Every classroom hears it.`, [leader.id], { important: true, category: 'arena' });
            reveal(ctx, [leader]);
        }
    }
};

/** Silk Wood: tension lines, cocoon caches, silk tightening as it dries. */
const silkwood: Mechanic = (ctx, cycle, rng) => {
    const moved: Tribute[] = [];
    alive(ctx).forEach(t => {
        const key = `w2silk:${t.id}`;
        const was = getMark(ctx.state, key);
        if (was !== undefined && was !== t.zone && getZone(ctx.state.arena, t.zone)?.terrain === 'forest') moved.push(t);
        setMark(ctx.state, key, t.zone);
    });
    if (moved.length) {
        ctx.logEvent(`The tension lines hum through the wood: ${moved.map(t => t.name).join(', ')} ${moved.length > 1 ? 'have' : 'has'} moved, and every web in the forest says where.`, moved.map(t => t.id), { category: 'arena' });
        moved.forEach(t => { loseSanity(t, K.silkRevealSanity); clampTribute(t); });
        reveal(ctx, moved);
    }
    ['Web Hollow', 'The Nursery'].filter(z => zoneLive(ctx, z)).forEach(z => {
        const t = inZone(ctx, z)[0];
        if (!t || !rng.chance(K.thin.cocoonChance)) return;
        if (rng.chance(K.thin.cocoonCacheShare)) {
            const id = rng.pick(['bandages', 'rope', 'knife', 'medkit', 'dried-meat']);
            grant(ctx, rng, t, id);
            ctx.logEvent(`${t.name} slits a cocoon in ${z} and finds something the last occupant was carrying.`, [t.id], { zone: z, category: 'survival' });
        } else {
            strike(ctx, rng, t, `Bitten opening a cocoon in ${z}`, `The cocoon {tribute} opens in ${z} is not empty.`, { code: 'poison', injury: 'poisoned' });
        }
    });
    // Silk drying: every dry day tightens it; rain resets it.
    const wet = currentWeather(ctx.state) === 'rain' || currentWeather(ctx.state) === 'storm';
    const dry = wet ? 0 : num(ctx.state, 'w2dry') + (isNight(ctx) ? 0 : 1);
    setMark(ctx.state, 'w2dry', dry);
    if (dry >= K.thin.silkDryCycles && zoneLive(ctx, 'The Silk Bridge')) {
        setMark(ctx.state, 'w2dry', 0);
        ctx.logEvent('The silk on the Silk Bridge has dried tight as wire. It sings, and then it closes.', [], { important: true, zone: 'The Silk Bridge', category: 'arena' });
        inZone(ctx, 'The Silk Bridge').forEach(t =>
            strike(ctx, rng, t, 'Bound by drying silk on the Silk Bridge', 'The drying silk closes on {tribute} like a hand.', { code: 'asphyxiation' }));
        const bridge = getZone(ctx.state.arena, 'The Silk Bridge');
        if (bridge?.adjacent[0]) cutOwned(ctx, 'The Silk Bridge', bridge.adjacent[0]);
    } else if (wet) {
        const bridge = getZone(ctx.state.arena, 'The Silk Bridge');
        bridge?.adjacent.forEach(n => restoreOwned(ctx, edgeKey('The Silk Bridge', n)));
    }
    void cycle;
};

/** Snowbound Homestead: the woodpile, the chimney, the well, the roof. */
export function woodpileOf(state: GameState): number {
    return num(state, 'w2wood', K.woodpileStart);
}
const cabin: Mechanic = (ctx, cycle, rng) => {
    let wood = woodpileOf(ctx.state);
    const hearth = ['Front Room', 'Kitchen'].filter(z => zoneLive(ctx, z));
    const warmed = hearth.some(z => inZone(ctx, z).length > 0);
    // Whoever is in the Woodshed splits what is left of the dead fence.
    const splitters = inZone(ctx, 'The Woodshed');
    if (splitters.length && !isNight(ctx) && rng.chance(K.thin.woodSplitChance)) {
        wood += 1;
        splitters.forEach(t => { t.vitals.fatigue += K.thin.woodSplitFatigue; clampTribute(t); });
    }
    if (isNight(ctx) && warmed) {
        wood = Math.max(0, wood - K.woodpileBurnPerNight);
        if (wood === 0) ctx.logEvent('The last of the woodpile goes into the stove. There is no more.', [], { important: true, category: 'arena' });
        // A stove fed hard all night sets the chimney going.
        if (wood > 0 && rng.chance(K.thin.chimneyFireChance)) {
            const room = rng.pick(hearth);
            ctx.logEvent(`CHIMNEY FIRE: the flue over ${room} roars like a train and the ceiling starts to smoke.`, [], { important: true, zone: room, category: 'arena' });
            startZoneEffect(ctx, room, 'burning', false);
            inZone(ctx, room).forEach(t => strike(ctx, rng, t, `Chimney fire in ${room}`, 'The chimney fire comes through the ceiling onto {tribute}.', { code: 'burns', injury: 'burned' }));
        }
    }
    setMark(ctx.state, 'w2wood', wood);
    // The well freezes by night and has to be broken by day.
    if (zoneLive(ctx, 'The Frozen Well')) {
        if (isNight(ctx)) setMark(ctx.state, 'w2well', 1);
        inZone(ctx, 'The Frozen Well').forEach(t => {
            if (getMark(ctx.state, 'w2well') === 1) {
                t.vitals.thirst += K.thin.frozenWellThirst;
                if (rng.chance(K.thin.wellIceChance)) strike(ctx, rng, t, 'Went through the ice at the well', '{tribute} breaks the well ice and the ice breaks further than that.', { code: 'hypothermia', injury: 'frostbitten' });
                else if (!isNight(ctx)) { setMark(ctx.state, 'w2well', 0); t.vitals.thirst = Math.max(0, t.vitals.thirst - K.scarceWaterQuench); }
            } else {
                t.vitals.thirst = Math.max(0, t.vitals.thirst - K.scarceWaterQuench);
            }
            clampTribute(t);
        });
    }
    // Roof load: every night of snow adds to it; the fourth brings a roof in.
    if (isNight(ctx)) {
        const load = num(ctx.state, 'w2roof') + 1;
        setMark(ctx.state, 'w2roof', load >= K.thin.roofLoadNights ? 0 : load);
        if (load >= K.thin.roofLoadNights) {
            const roofs = ['The Loft', 'The Barn'].filter(z => zoneLive(ctx, z));
            if (roofs.length) {
                const roof = rng.pick(roofs);
                ctx.logEvent(`The snow on the ${roof.replace(/^The /, '')} roof has been building for four nights. Tonight it comes in.`, [], { type: 'signature-beats', important: true, zone: roof, category: 'arena' });
                depleteZone(ctx.state, roof, K.thin.roofDepletion);
                inZone(ctx, roof).forEach(t => strike(ctx, rng, t, `Under the roof of ${roof}`, 'The roof comes in on {tribute} under a tonne of snow.', { code: 'collapse', damage: K.mechanicHeavyDamage }));
            }
        }
    }
    void cycle;
};

/** Menagerie: enclosures unlocking by phase, the keeper's keys, feeding time. */
const ENCLOSURES = ['Reptile House', 'Big Cat Terrace', 'Bear Moat', 'Elephant Paddock', 'The Aviary'];
const menagerie: Mechanic = (ctx, cycle, rng) => {
    const phase = Math.min(ENCLOSURES.length, Math.floor(ctx.state.day / 2) + 1);
    const opened = num(ctx.state, 'w2pens');
    if (phase > opened) {
        const pen = ENCLOSURES[opened];
        setMark(ctx.state, 'w2pens', opened + 1);
        if (zoneLive(ctx, pen)) {
            ctx.logEvent(`The keeper's clock turns over and the ${pen} gate unlocks. What lives in it is out.`, [], { type: 'signature-beats', important: true, zone: pen, category: 'arena' });
            const z = getZone(ctx.state.arena, pen);
            if (z) z.danger = Math.min(1, z.danger + K.thin.penDangerRise);
        }
    }
    const open = ENCLOSURES.slice(0, num(ctx.state, 'w2pens')).filter(z => zoneLive(ctx, z));
    // The keys: in the Keeper's Yard until somebody takes them, and dropped where the holder falls.
    let holder = getMark(ctx.state, 'w2keys');
    const holderT = typeof holder === 'string' ? ctx.state.tributes.find(t => t.id === holder) : undefined;
    if (holderT && holderT.status !== 'alive') {
        setMark(ctx.state, 'w2keys', undefined);
        setMark(ctx.state, 'w2keyzone', holderT.zone);
        holder = undefined;
    }
    if (holder === undefined) {
        const where = (getMark(ctx.state, 'w2keyzone') as string | undefined) ?? "Keeper's Yard";
        const finder = inZone(ctx, where)[0];
        if (finder) {
            setMark(ctx.state, 'w2keys', finder.id);
            setMark(ctx.state, 'w2keyzone', undefined);
            ctx.logEvent(`${finder.name} picks up the keeper's keys in ${where}. Every gate in the zoo answers to them.`, [finder.id], { important: true, zone: where, category: 'survival' });
        }
    }
    const keyed = getMark(ctx.state, 'w2keys');
    // Feeding time: the Feed Store feeds; the open pens feed on whoever is in them.
    if (!isNight(ctx) && cycle % 3 === 2) {
        ctx.logEvent('FEEDING TIME: the hoppers in the Feed Store drop, and every animal loose in the zoo turns toward the sound.', [], { important: true, category: 'arena' });
        inZone(ctx, 'The Feed Store').forEach(t => { t.vitals.hunger = Math.max(0, t.vitals.hunger - K.mechanicRelief); clampTribute(t); });
        open.forEach(pen => inZone(ctx, pen).forEach(t => {
            if (t.id === keyed) return;
            strike(ctx, rng, t, `Mauled at feeding time in the ${pen}`, `Feeding time in the ${pen}, and {tribute} is standing where the food goes.`, { code: 'mutt', bleed: true });
        }));
    } else if (open.length && rng.chance(K.thin.looseAnimalChance)) {
        const pen = rng.pick(open);
        inZone(ctx, pen).filter(t => t.id !== keyed).slice(0, 1).forEach(t =>
            strike(ctx, rng, t, `Mauled in the ${pen}`, `Something from the open ${pen} finds {tribute}.`, { code: 'mutt', bleed: true, dodgeBonus: K.thin.smallDodgeBonus }));
    }
    // The keys lock a gate behind the holder, once a day.
    const kh = typeof keyed === 'string' ? ctx.state.tributes.find(t => t.id === keyed && t.status === 'alive') : undefined;
    if (kh && !isNight(ctx) && ENCLOSURES.includes(kh.zone) && !isZoneLocked(ctx.state, kh.zone) && rng.chance(K.thin.keysLockChance)) {
        lockZone(ctx.state, kh.zone, cycle + 2);
        ctx.logEvent(`${kh.name} locks the ${kh.zone} gate from the inside with the keeper's keys.`, [kh.id], { zone: kh.zone, category: 'survival' });
    }
};

/** Undermere: sumps filling with surface rain, air pockets, dive lines. */
const SUMPS = ['The Siphon Passage', 'The Undermere'];
const karst: Mechanic = (ctx, cycle, rng) => {
    const rain = currentWeather(ctx.state) === 'rain' || currentWeather(ctx.state) === 'storm' || cycle % 5 === 4;
    if (!rain) return;
    const pocket = 'The Drip Gallery';
    SUMPS.filter(z => zoneLive(ctx, z)).forEach(sump => {
        ctx.logEvent(`Surface rain reaches the deep: ${sump} fills from the bottom up.`, [], { important: true, zone: sump, category: 'arena' });
        startZoneEffect(ctx, sump, 'flooded', false);
        const lined = getMark(ctx.state, `w2line:${sump}`) === 1;
        inZone(ctx, sump).forEach(t => {
            if (t.inventory.some(i => i.id === 'rope') && !lined) {
                setMark(ctx.state, `w2line:${sump}`, 1);
                ctx.logEvent(`${t.name} ties a dive line through ${sump} before the water closes over it. Anyone can follow it now.`, [t.id], { zone: sump, category: 'survival' });
                return;
            }
            // An air pocket, if they can reach it.
            const z = getZone(ctx.state.arena, sump);
            if (z?.adjacent.includes(pocket) && zoneLive(ctx, pocket) && rng.chance(K.thin.airPocketChance)) {
                t.zone = pocket;
                ctx.logEvent(`${t.name} finds the air pocket under ${pocket} with the last breath they had.`, [t.id], { zone: pocket, category: 'survival' });
                return;
            }
            strike(ctx, rng, t, `Drowned when ${sump} filled`, `${sump} fills over {tribute}'s head.`, { code: 'drowning', dodgeBonus: lined ? K.thin.diveLineDodgeBonus : 0 });
        });
    });
};

/** Throat of the Mountain: skylights, gas pockets, cooling crusts. */
const magmatube: Mechanic = (ctx, cycle, rng) => {
    const skylights = ['The Outer Gallery', 'The Upper Throat', 'The Ember Shaft'].filter(z => zoneLive(ctx, z));
    if (!isNight(ctx) && skylights.length) {
        const lit = skylights[cycle % skylights.length];
        const under = inZone(ctx, lit);
        if (under.length) {
            ctx.logEvent(`The sun finds the skylight over ${lit}. Clean air comes down it, and so does the light: everybody under it can be seen from the rim.`, under.map(t => t.id), { zone: lit, category: 'arena' });
            under.forEach(t => { t.vitals.fatigue = Math.max(0, t.vitals.fatigue - K.mechanicRelief); clampTribute(t); });
            reveal(ctx, under);
        }
    }
    // Gas: smelt one cycle, lethal the next.
    const gas = getMark(ctx.state, 'w2gas');
    if (typeof gas === 'string') {
        setMark(ctx.state, 'w2gas', undefined);
        if (zoneLive(ctx, gas)) {
            ctx.logEvent(`The gas pocket in ${gas} lets go.`, [], { important: true, zone: gas, category: 'arena' });
            startZoneEffect(ctx, gas, 'contaminated', false);
            inZone(ctx, gas).forEach(t => strike(ctx, rng, t, `Gassed in ${gas}`, 'The gas in {zone} takes {tribute} between one breath and the next.'.replace('{zone}', gas), { code: 'asphyxiation', dodgeBonus: K.thin.smallDodgeBonus }));
        }
    } else {
        const deep = ['The Sulfur Shelf', 'The Steam Vents', 'Lower Throat', 'The Long Way Round'].filter(z => zoneLive(ctx, z) && inZone(ctx, z).length > 0);
        if (deep.length && rng.chance(K.thin.gasPocketChance)) {
            const z = rng.pick(deep);
            setMark(ctx.state, 'w2gas', z);
            ctx.logEvent(`Rotten eggs in ${z}, faint and then not faint. The bats have left it.`, [], { zone: z, category: 'arena' });
            alive(ctx).forEach(t => addZoneThreat(ctx.state, t, z, MEMORY.cannonThreat));
        }
    }
    // The crust over the antechamber thickens by night and is broken by a flare.
    const ante = 'The Lava Lake Antechamber';
    if (zoneLive(ctx, ante)) {
        let crust = num(ctx.state, 'w2crust');
        if (hasEffect(ctx.state, ante, 'burning')) crust = 0;
        else if (isNight(ctx)) crust = Math.min(3, crust + 1);
        setMark(ctx.state, 'w2crust', crust);
        if (crust < K.thin.crustSafeAt) inZone(ctx, ante).forEach(t =>
            strike(ctx, rng, t, 'Broke through the cooling crust', 'The crust under {tribute} was not ready to be walked on.', { code: 'burns', injury: 'burned', damage: K.mechanicHeavyDamage, dodgeBonus: 0.2 }));
    }
};

/** Vertical Quarry: blasting on a schedule, spoil slides, the ore buckets. */
const BENCHES = ['The Upper Benches', 'The Middle Benches', 'The Spiral Road'];
const quarry: Mechanic = (ctx, cycle, rng) => {
    const benches = BENCHES.filter(z => zoneLive(ctx, z));
    if (benches.length) {
        const target = benches[Math.floor(cycle / 4) % benches.length];
        if (cycle % 4 === 1) {
            ctx.logEvent(`The blast siren sounds three times over ${target}. The charge goes next cycle.`, [], { type: 'signature-beats', important: true, zone: target, category: 'arena' });
            alive(ctx).forEach(t => addZoneThreat(ctx.state, t, target, MEMORY.cannonThreat));
            setMark(ctx.state, 'w2blastwarned', inZone(ctx, target).map(t => t.id).join('|'));
        } else if (cycle % 4 === 2) {
            const warned = String(getMark(ctx.state, 'w2blastwarned') ?? '').split('|');
            ctx.logEvent(`BLASTING: ${target} goes up in a line of charges.`, [], { important: true, zone: target, category: 'arena' });
            inZone(ctx, target).forEach(t => strike(ctx, rng, t, `Caught in the blast on ${target}`, 'The blast lifts {tribute} off the bench.', { code: 'collapse', damage: K.mechanicHeavyDamage, bleed: true, dodgeBonus: warned.includes(t.id) ? 0.25 : 0 }));
            // The spoil goes downhill.
            const downhill = ['The Seep Wall', 'The Flooded Pit'].filter(z => zoneLive(ctx, z));
            if (downhill.length) {
                const slide = rng.pick(downhill);
                ctx.logEvent(`The spoil from ${target} slides down into ${slide}.`, [], { zone: slide, category: 'arena' });
                startZoneEffect(ctx, slide, 'quaking', false);
                depleteZone(ctx.state, slide, K.thin.spoilDepletion);
                inZone(ctx, slide).forEach(t => strike(ctx, rng, t, `Buried by the spoil slide in ${slide}`, 'The spoil slide takes {tribute} with it.', { code: 'collapse', dodgeBonus: K.thin.smallDodgeBonus }));
            }
            setMark(ctx.state, 'w2blastwarned', undefined);
        }
    }
    // The ore buckets: a way up out of the Crusher House, if you trust the cable.
    const crusher = 'The Crusher House';
    if (zoneLive(ctx, crusher)) inZone(ctx, crusher).forEach(t => {
        if (t.health > K.thin.bucketBelowHealth || !rng.chance(K.thin.bucketChance)) return;
        const top = ctx.state.arena.zones[0].name;
        if (rng.chance(K.thin.bucketFallChance)) {
            strike(ctx, rng, t, 'Fell from an ore bucket', 'The bucket {tribute} rides tips at the halfway pulley.', { code: 'fall', damage: K.mechanicHeavyDamage });
            return;
        }
        t.zone = top;
        ctx.logEvent(`${t.name} rides an ore bucket up out of the Crusher House to ${top}.`, [t.id], { zone: top, category: 'survival' });
    });
};

/** Labyrinth: the dead ends rearrange. */
const labyrinth: Mechanic = (ctx, cycle, rng) => {
    if (cycle % 2 !== 0) return;
    ownedCuts(ctx.state).forEach(key => restoreOwned(ctx, key));
    const candidates = ctx.state.arena.zones.slice(1).filter(z => zoneLive(ctx, z.name) && z.terrain === 'forest');
    for (let tries = 0; tries < 4 && candidates.length; tries++) {
        const z = rng.pick(candidates);
        const open = z.adjacent.filter(n => zoneLive(ctx, n) && !(ctx.state.severedEdges ?? []).includes(edgeKey(z.name, n)));
        if (open.length < 2) continue;
        const n = rng.pick(open);
        if (!cutOwned(ctx, z.name, n)) continue;
        ctx.logEvent(`The hedges move overnight. The way from ${z.name} to ${n} is a dead end now, and has always been, if you ask the hedge.`, [], { important: true, zone: z.name, category: 'arena' });
        inZone(ctx, z.name).concat(inZone(ctx, n)).forEach(t => {
            t.vitals.fatigue += K.thin.hedgeFatigue;
            loseSanity(t, 5);
            delete ensureMemory(t).zones[n === t.zone ? z.name : n];
            clampTribute(t);
        });
        break;
    }
};

/** The No-One Place: it forgets who entered. */
const nooneplace: Mechanic = (ctx, cycle, rng) => {
    const rooms = ctx.state.arena.zones.slice(1).map(z => z.name).filter(z => z !== 'Exit' && zoneLive(ctx, z));
    if (!rooms.length) return;
    const room = rooms[cycle % rooms.length];
    const inside = inZone(ctx, room);
    // Everyone's memory of the room goes, and so does everyone's memory of who was in it.
    alive(ctx).forEach(t => {
        const mem = ensureMemory(t);
        delete mem.zones[room];
        inside.forEach(o => {
            const r = mem.rivals[o.id];
            if (r && o.id !== t.id) { r.lastSeenZone = undefined; r.lastSeenCycle = undefined; }
        });
    });
    if (inside.length) {
        ctx.logEvent(`${room} forgets. ${inside.map(t => t.name).join(', ')} ${inside.length > 1 ? 'were' : 'was'} in it, and now nobody anywhere remembers that, including, a little, ${inside.length > 1 ? 'them' : 'they'}.`, inside.map(t => t.id), { important: true, zone: room, category: 'arena' });
        inside.forEach(t => {
            loseSanity(t, 6);
            // Allies inside forget each other a little too.
            inside.forEach(o => { if (o.id !== t.id && allied(t, o) && rng.chance(K.thin.forgetAllyChance)) adjustRel(t, o.id, -K.forgetRegard); });
            if (t.vitals.sanity < K.thin.forgottenBelowSanity) strike(ctx, rng, t, `Forgotten in ${room}`, `{tribute} forgets which way the door was in ${room}, and then what a door was.`, { code: 'exposure' });
            clampTribute(t);
        });
    }
};

const THIN_ARENA_MECHANICS: Record<string, Mechanic> = {
    redcathedral, culdesac, ashgrove, silkwood, cabin, menagerie, karst, magmatube, quarry, labyrinth, nooneplace,
};

/** Whether the arena has a wave-2 mechanic of its own (used by tests). */
export function hasThinArenaMechanic(arenaId: string): boolean {
    return THIN_ARENA_MECHANICS[arenaId] !== undefined;
}

/** One cycle of everything above. Called from `runArenaSignature`. */
export function runWave2Arena(ctx: SimContext) {
    const cycle = ctx.state.cycle ?? 0;
    const id = ctx.state.arena.id;
    const mech = THIN_ARENA_MECHANICS[id];
    if (mech) mech(ctx, cycle, new RNG(`${ctx.state.seed}-w2mech-${id}-${cycle}`));
    tickScarceWater(ctx, new RNG(`${ctx.state.seed}-w2water-${cycle}`));
    tickTelegraphs(ctx, new RNG(`${ctx.state.seed}-w2tele-${cycle}`));
    releaseAtCycleEnd(ctx);
}

/**
 * A lockdown sealed "through cycle N" stops counting as sealed the moment the
 * cycle counter reaches N+1 — which happens before the next `tickLockdowns`,
 * so for one observation its cut edges are a strand. The thin arenas lock and
 * release on a short rhythm, so their locks are released at the close of
 * their last cycle instead: the same doors, opened a moment earlier.
 */
function releaseAtCycleEnd(ctx: SimContext) {
    if (!THIN_ARENA_MECHANICS[ctx.state.arena.id]) return;
    const cycle = ctx.state.cycle ?? 0;
    ctx.state.cycle = cycle + 1;
    try {
        tickLockdowns(ctx.state).forEach(zone => ctx.logEvent(
            `The doors in ${zone} run back open on their tracks.`, [], { zone, category: 'arena' }));
    } finally {
        ctx.state.cycle = cycle;
    }
}
