import { GameState, RivalRecord, Tribute, TributeMemory, ZoneMemory } from '../models/types';
import { FEAR, HUNTING, MEMORY, RELATIONSHIPS, SUSPICION } from '../data/balance';
import { traitMod } from '../data/traits';
import { addFear } from './fear';
import { getZone } from './map';
import { SimContext } from './context';

/**
 * Tribute memory: the difference between an AI that reacts to the current
 * board state and one that reacts to what it has actually seen.
 *
 * Nothing in here is omniscient. A tribute only learns a zone is crawling with
 * Careers by standing in it, and only learns a zone is a graveyard from the
 * cannon and the faces in the sky — which is exactly what a real tribute gets.
 */

export function blankMemory(): TributeMemory {
    return {
        zones: {},
        vengeance: [],
        betrayedBy: [],
        timesBetrayed: 0,
        lastContact: {},
        mourned: [],
        giftsReceived: 0,
        fear: {},
        rivals: {},
        stoodBy: [],
    };
}

/** States saved before memory existed still have to load. */
export function ensureMemory(t: Tribute): TributeMemory {
    if (!t.memory) t.memory = blankMemory();
    if (!t.memory.zones) t.memory.zones = {};
    if (!t.memory.vengeance) t.memory.vengeance = [];
    if (!t.memory.betrayedBy) t.memory.betrayedBy = [];
    if (!t.memory.lastContact) t.memory.lastContact = {};
    if (!t.memory.mourned) t.memory.mourned = [];
    if (!t.memory.fear) t.memory.fear = {};
    if (!t.memory.rivals) t.memory.rivals = {};
    if (!t.memory.stoodBy) t.memory.stoodBy = [];
    if (t.memory.timesBetrayed === undefined) t.memory.timesBetrayed = 0;
    if (t.memory.giftsReceived === undefined) t.memory.giftsReceived = 0;
    return t.memory;
}

/** Monotonic day/night counter. Days alone are too coarse for decay maths. */
export function cycleOf(state: GameState): number {
    return state.cycle ?? 0;
}

export function advanceCycle(state: GameState): number {
    state.cycle = cycleOf(state) + 1;
    return state.cycle;
}

function zoneSlot(t: Tribute, zone: string): ZoneMemory {
    const mem = ensureMemory(t);
    if (!mem.zones[zone]) {
        mem.zones[zone] = { seen: -99, threat: 0, rivals: 0, barren: 0 };
    }
    return mem.zones[zone];
}

/** Records what a tribute can see from where they are standing right now. */
export function noteSighting(state: GameState, t: Tribute, zone: string, rivals: number, barren: number) {
    const slot = zoneSlot(t, zone);
    slot.seen = cycleOf(state);
    slot.rivals = rivals;
    slot.barren = barren;
}

/** Adds dread to a tribute's impression of a place. */
export function addZoneThreat(state: GameState, t: Tribute, zone: string, amount: number) {
    const slot = zoneSlot(t, zone);
    slot.threat = Math.min(6, slot.threat + amount);
    slot.seen = Math.max(slot.seen, cycleOf(state));
}

/** Threat as remembered now, faded by however many cycles have passed. */
export function rememberedThreat(state: GameState, t: Tribute, zone: string): number {
    const slot = ensureMemory(t).zones[zone];
    if (!slot) return 0;
    const age = Math.max(0, cycleOf(state) - slot.seen);
    return slot.threat * Math.pow(MEMORY.threatDecay, age);
}

/** Rivals believed to be in a zone, or 0 once the sighting has gone stale. */
export function rememberedRivals(state: GameState, t: Tribute, zone: string): number {
    const slot = ensureMemory(t).zones[zone];
    if (!slot) return 0;
    if (cycleOf(state) - slot.seen > MEMORY.sightingLifetime) return 0;
    return slot.rivals;
}

/** How stripped a tribute believes a zone's forage to be, decayed toward 0. */
export function rememberedBarren(state: GameState, t: Tribute, zone: string): number {
    const slot = ensureMemory(t).zones[zone];
    if (!slot) return 0;
    const age = Math.max(0, cycleOf(state) - slot.seen);
    return slot.barren * Math.pow(0.75, age);
}

/**
 * The cannon and the faces in the sky. Everyone learns that someone died and
 * roughly where — that is public information in the arena, and it is what
 * turns a zone into a place nobody wants to walk into.
 */
export function broadcastDeath(ctx: SimContext, victim: Tribute, killer?: Tribute) {
    const state = ctx.state;
    const zone = victim.zone;
    state.zoneDeaths = state.zoneDeaths || {};
    state.zoneDeaths[zone] = (state.zoneDeaths[zone] || 0) + 1;

    const killZone = getZone(state.arena, zone);
    state.tributes.forEach(other => {
        if (other.status !== 'alive' || other.id === victim.id) return;
        // §4.2 R-3: kills are public knowledge — the cannon now, the face in
        // the sky tonight. An ally whose count keeps climbing gets watched by
        // their own group, which is one of the cracks a Career pack breaks
        // along.
        if (killer && killer.id !== other.id
            && other.allianceId !== undefined && other.allianceId === killer.allianceId
            && killer.kills >= SUSPICION.allyKillCountWary) {
            raiseSuspicion(other, killer.id, SUSPICION.perAllyKill);
        }
        const witnessed = other.zone === zone;
        addZoneThreat(state, other, zone, witnessed ? MEMORY.deathThreat : MEMORY.cannonThreat);
        if (witnessed && killer && killer.id !== other.id) {
            // Seeing who did it is worth far more than hearing the cannon.
            noteSighting(state, other, zone, Math.max(1, rememberedRivals(state, other, zone)), rememberedBarren(state, other, zone));
        }
        // §3.2: a cannon one zone over is a belief, not an observation. The
        // near-miss observer learns to fear a killer they did not see — and a
        // share of the time they pin it on the wrong person entirely: whoever
        // they last crossed paths with, or already dreaded. Nothing writes a
        // false impression like a half-heard death. Direct contact (a landed
        // hit — see reduceFear) is what corrects it.
        if (!witnessed && killer && killer.id !== other.id
            && killZone?.adjacent.includes(other.zone)
            && ctx.rng !== undefined) {
            if (ctx.rng.chance(FEAR.misattributionChance)) {
                const suspects = state.tributes.filter(o =>
                    o.status === 'alive' && o.id !== other.id && o.id !== killer.id && o.id !== victim.id
                    && cyclesSinceContact(state, other, o.id) <= MEMORY.sightingLifetime * 2);
                const suspect = suspects.length > 0 ? ctx.rng.pick(suspects) : undefined;
                if (suspect) addFear(other, suspect.id, FEAR.distantKill);
            } else {
                addFear(other, killer.id, FEAR.distantKill);
            }
        }
    });
}

/** Records that two tributes actually interacted this cycle. */
export function noteContact(state: GameState, a: Tribute, b: Tribute) {
    const cycle = cycleOf(state);
    ensureMemory(a).lastContact[b.id] = cycle;
    ensureMemory(b).lastContact[a.id] = cycle;
}

/** Cycles since these two last shared a scene, or Infinity if never. */
export function cyclesSinceContact(state: GameState, a: Tribute, bId: string): number {
    const last = ensureMemory(a).lastContact[bId];
    if (last === undefined) return Infinity;
    return cycleOf(state) - last;
}

/** Swears vengeance, deduplicated and bounded. */
export function swearVengeance(t: Tribute, targetId: string) {
    const mem = ensureMemory(t);
    if (mem.vengeance[0] === targetId) return;
    mem.vengeance = [targetId, ...mem.vengeance.filter(id => id !== targetId)].slice(0, 4);
}

export function hasVengeanceAgainst(t: Tribute, targetId: string): boolean {
    return ensureMemory(t).vengeance.includes(targetId);
}

/**
 * The running history of one specific feud.
 *
 * A rivalry used to be a decaying scalar, which meant a third fight between the
 * same two people read exactly like the first. This is what lets a rematch
 * escalate: the loser has learned something, and neither of them wants to walk
 * away again.
 */
export function rivalRecord(t: Tribute, otherId: string): RivalRecord {
    const mem = ensureMemory(t);
    if (!mem.rivals[otherId]) {
        mem.rivals[otherId] = { fights: 0, woundsTaken: 0, woundsDealt: 0, timesFled: 0, lastFightCycle: -99 };
    }
    return mem.rivals[otherId];
}

/** Records that these two have now fought, from both sides. */
export function noteFight(state: GameState, a: Tribute, b: Tribute) {
    const cycle = cycleOf(state);
    [[a, b], [b, a]].forEach(([x, y]) => {
        const record = rivalRecord(x, y.id);
        record.fights += 1;
        record.lastFightCycle = cycle;
    });
}

/** §4.2: how much `t` distrusts a specific ally. */
export function suspicionOf(t: Tribute, otherId: string): number {
    return ensureMemory(t).suspicion?.[otherId] ?? 0;
}

export function raiseSuspicion(t: Tribute, otherId: string, amount: number) {
    const mem = ensureMemory(t);
    mem.suspicion = mem.suspicion ?? {};
    // The Paranoid read more into everything they see.
    const sharpened = amount * (1 + traitMod(t, 'betrayalResist'));
    mem.suspicion[otherId] = Math.min(SUSPICION.max, (mem.suspicion[otherId] ?? 0) + sharpened);
}

export function decaySuspicion(state: GameState) {
    state.tributes.forEach(t => {
        const sus = t.memory?.suspicion;
        if (!sus) return;
        Object.keys(sus).forEach(id => {
            sus[id] = Math.max(0, sus[id] - SUSPICION.decayPerCycle);
            if (sus[id] === 0) delete sus[id];
        });
    });
}

/** §3.4: a bad moment leaves a mark that outlasts the moment. */
export function rattle(t: Tribute, amount: number) {
    t.rattled = Math.min(HUNTING.rattledMax, (t.rattled ?? 0) + amount);
}

/** Records that `t` broke off a fight with `otherId` — and shakes them. */
export function noteFled(t: Tribute, otherId: string) {
    rivalRecord(t, otherId).timesFled += 1;
    rattle(t, HUNTING.rattledPerFlee);
}

/** Records a landed hit, on both sides of the pair. */
export function noteWound(attacker: Tribute, defender: Tribute) {
    rivalRecord(attacker, defender.id).woundsDealt += 1;
    rivalRecord(defender, attacker.id).woundsTaken += 1;
}

/**
 * Records that `t` took a real risk for `otherId` — shared a fight, handed over
 * supplies they needed themselves, or patched them up. This is the gate romance
 * hangs on, instead of a number ticking up from standing in the same clearing.
 */
export function noteStoodBy(t: Tribute, otherId: string) {
    const mem = ensureMemory(t);
    if (!mem.stoodBy.includes(otherId)) mem.stoodBy.push(otherId);
}

export function hasStoodBy(t: Tribute, otherId: string): boolean {
    return ensureMemory(t).stoodBy.includes(otherId);
}

/**
 * Blanket distrust multiplier: someone burned twice trusts nobody.
 *
 * Capped, because uncapped this compounded into a mathematical wall — the
 * alliance threshold is multiplied by this factor, so a tribute betrayed three
 * or four times needed a relationship above the maximum possible value to ever
 * ally again, which is a bug dressed as characterisation. Deeply burned
 * tributes should be very hard to recruit, not impossible.
 */
export function distrustFactor(t: Tribute): number {
    return Math.min(RELATIONSHIPS.maxDistrustFactor, 1 + ensureMemory(t).timesBetrayed * 0.75);
}

/**
 * Per-cycle upkeep: dread fades, and the sighting board ages out on its own
 * through `rememberedRivals`. Runs once per day/night from the phase driver.
 */
export function decayMemories(state: GameState) {
    state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        const mem = ensureMemory(t);
        Object.values(mem.zones).forEach(slot => {
            slot.threat *= MEMORY.threatDecay;
            if (slot.threat < 0.02) slot.threat = 0;
        });
    });
}

/**
 * Relationship decay: a rivalry from day 2 should not still be a
 * rivalry on day 10 if the two never met again. Strong bonds and deep hatreds
 * fade at half speed — those are the ones that define a run.
 */
export function decayRelationships(state: GameState) {
    const alive = state.tributes.filter(t => t.status === 'alive');
    alive.forEach(t => {
        Object.keys(t.relationships).forEach(otherId => {
            const value = t.relationships[otherId];
            if (value === 0) return;
            if (cyclesSinceContact(state, t, otherId) <= RELATIONSHIPS.contactWindow) return;
            const rate = Math.abs(value) >= RELATIONSHIPS.stickyMagnitude
                ? RELATIONSHIPS.decayPerCycle / 2
                : RELATIONSHIPS.decayPerCycle;
            const next = value > 0 ? Math.max(0, value - rate) : Math.min(0, value + rate);
            t.relationships[otherId] = Math.round(next * 10) / 10;
        });
    });
}
