import { GameState, RivalRecord, Tribute, TributeMemory, ZoneMemory } from '../models/types';
import { FEAR, HUNTING, INTEL, MEMORY, RELATIONSHIPS, SANITY_BANDS, SUSPICION, ZONES } from '../data/balance';
import { profOf } from './proficiency';
import { ARCHETYPES } from '../data/archetypes';
import { traitMod } from '../data/traits';
import { addFear } from './fear';
import { getZone } from './map';
import { believes } from './rapport';
import { SimContext } from './context';
import { arenaIsSilent } from './gamesProfile';

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

/**
 * §4.4/§5.9: the scout's sighting, pooled to their group.
 *
 * ZoneMemory is per-tribute and was never shared, so an alliance of five had
 * five private and mostly redundant maps — holding ground bought no
 * informational advantage at all, and the scout role had nothing to do that a
 * bystander did not. What the scout sees, the group knows: the same slot,
 * written to each living ally, so the group moves on the group's information.
 */
export function shareScoutSighting(state: GameState, scout: Tribute, zone: string, rivals: number, barren: number) {
    if (!scout.allianceId) return;
    const record = state.alliances?.[scout.allianceId];
    if (record?.roles?.scout !== scout.id) return;
    state.tributes.forEach(mate => {
        if (mate.id === scout.id || mate.status !== 'alive' || mate.allianceId !== scout.allianceId) return;
        // §4.3: a report is only information if you rate the person giving it.
        // A scout the group has written off is a scout the group does not act
        // on, which is the whole reason professional esteem is a separate
        // number from liking.
        if (!believes(mate, scout)) return;
        noteSighting(state, mate, zone, rivals, barren);
    });
}

/** Adds dread to a tribute's impression of a place. */
/** The ceiling every zone impression's dread is held under. */
// balance-exempt: the range ZoneMemory.threat is defined over, asserted by the soak
const MEMORY_THREAT_CAP = 6;

export function addZoneThreat(state: GameState, t: Tribute, zone: string, amount: number) {
    const slot = zoneSlot(t, zone);
    slot.threat = Math.min(MEMORY_THREAT_CAP, slot.threat + amount);
    slot.seen = Math.max(slot.seen, cycleOf(state));
}

/**
 * §1.3/§3.4: whether this tribute's recollection can be trusted at all.
 *
 * `sanityScarred` set a flag, took one point of stealth, printed a genuinely
 * good line — "something in {name} goes quiet and does not come back" — and
 * then did nothing whatsoever for the rest of the run. A permanent mark that is
 * neither permanent nor a mark.
 *
 * This is the consequence it was always describing. Dissociation is not a stat
 * penalty; it is not knowing whether the thing you remember happened. A scarred
 * tribute (or one currently in the bottom band) misremembers *places* — a zone
 * that killed two people reads as safe ground, a zone they were never touched
 * in reads as somewhere terrible happened. That is far more interesting than a
 * modifier and it costs almost nothing, because the whole decision layer
 * already routes through remembered threat rather than truth.
 */
export function memoryUnreliable(t: Tribute): boolean {
    return !!t.sanityScarred || t.vitals.sanity <= SANITY_BANDS.gone;
}

/**
 * Deterministic per-tribute-per-zone distortion, in [0, 1).
 *
 * Deliberately *not* an RNG draw: a corrupted memory has to be stable, or the
 * tribute flickers between believing a zone is safe and believing it is not,
 * which reads as noise rather than as damage. It also means this consumes no
 * seeded draws and cannot change a replay.
 */
function distortion(t: Tribute, zone: string): number {
    let hash = 2166136261;
    const key = `${t.id}:${zone}`;
    for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000) / 1000;
}

/**
 * §9.7: how old a piece of knowledge *feels*.
 *
 * Something you were told ages faster than something you saw. That is not
 * cynicism about tellers, it is that hearsay was already second-hand when it
 * arrived — the teller's own sighting was some cycles stale before they opened
 * their mouth — and it is the honest counterweight to intel being tradeable at
 * all. Traded knowledge is real knowledge with a shorter shelf life.
 */
function hearsayAge(slot: ZoneMemory, age: number): number {
    return slot.hearsay ? age * INTEL.hearsayDecayMultiplier : age;
}

/** Threat as remembered now, faded by however many cycles have passed. */
export function rememberedThreat(state: GameState, t: Tribute, zone: string): number {
    const slot = ensureMemory(t).zones[zone];
    const age = slot ? hearsayAge(slot, Math.max(0, cycleOf(state) - slot.seen)) : 0;
    const real = slot ? slot.threat * Math.pow(MEMORY.threatDecay, age) : 0;
    if (!memoryUnreliable(t)) return real;

    // Two failure modes, both real: a place that hurt them reads as nothing,
    // and a place nothing happened reads as the worst ground in the arena.
    const d = distortion(t, zone);
    if (d < MEMORY.dissociationBlankShare) return 0;
    if (d > 1 - MEMORY.dissociationInventShare) return Math.max(real, MEMORY.dissociationInventedThreat);
    return real;
}

/** Rivals believed to be in a zone, or 0 once the sighting has gone stale. */
export function rememberedRivals(state: GameState, t: Tribute, zone: string): number {
    const slot = ensureMemory(t).zones[zone];
    if (!slot) return 0;
    if (hearsayAge(slot, cycleOf(state) - slot.seen) > MEMORY.sightingLifetime) return 0;
    return slot.rivals;
}

/** How stripped a tribute believes a zone's forage to be, decayed toward 0. */
export function rememberedBarren(state: GameState, t: Tribute, zone: string): number {
    const slot = ensureMemory(t).zones[zone];
    if (!slot) return 0;
    const age = hearsayAge(slot, Math.max(0, cycleOf(state) - slot.seen));
    return slot.barren * Math.pow(0.75, age);
}

/**
 * §11.1: when a tribute reckons a stripped zone will be worth working again.
 *
 * `rememberedBarren` decays their impression at a fixed rate, but that is
 * forgetting, not knowledge — nothing in the simulation understood that the
 * arena regrows what nobody is stripping, so the deepest thing a tribute could
 * do with depletion was avoid it forever. A tribute who actually knows how
 * ground recovers can do the useful thing instead: leave, let it come back,
 * and be standing in it on the day it does.
 *
 * The reckoning is a skill. It needs forage proficiency (they have watched
 * ground come back before) or plain intelligence (they can work it out), and
 * it is only as good as the impression it is computed from — a tribute
 * working off three-day-old hearsay gets a three-day-old answer, which is
 * exactly right.
 *
 * Returns the cycle they believe the zone is due, or undefined if they have no
 * usable impression or are not the sort of person who thinks this way.
 */
export function regrowthDueCycle(state: GameState, t: Tribute, zone: string): number | undefined {
    const slot = ensureMemory(t).zones[zone];
    // Only ground they actually stripped is worth timing a return to. Without
    // this floor, any faintly-picked-over zone came "due" within a cycle or
    // two, so the pull below fired constantly and walked the archetypes that
    // qualify for the read — the high-intelligence ones — straight back into
    // ground they had just worked. Scholar's win rate fell by two thirds.
    if (!slot || slot.barren < MEMORY.regrowthMinBarren) return undefined;
    const reads = profOf(t, 'forage') >= MEMORY.regrowthReadForage
        || t.attributes.intelligence >= MEMORY.regrowthReadIntelligence;
    if (!reads) return undefined;
    // Their own estimate of how long the ground needs, from what they saw and
    // the rate the arena actually restocks at. Deliberately computed from the
    // real constant: a tribute who can read ground reads it correctly, and the
    // error in their answer comes from the age of their impression instead.
    const cycles = Math.ceil(slot.barren / Math.max(0.001, ZONES.regenPerCycle));
    return slot.seen + cycles;
}

/**
 * §11.1: true when a tribute reckons a zone they stripped has had long enough.
 * Read by movement, where it cancels the barren penalty that would otherwise
 * keep them away from ground that is worth returning to.
 */
export function reckonsRegrown(state: GameState, t: Tribute, zone: string): boolean {
    const due = regrowthDueCycle(state, t, zone);
    return due !== undefined && cycleOf(state) >= due;
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
        // A witnessed kill is seen in person, whatever the arena's cannon law
        // says — only the arena-wide broadcast to everyone else is suppressed.
        const silent = !witnessed && arenaIsSilent(state);
        addZoneThreat(state, other, zone, witnessed ? MEMORY.deathThreat : silent ? 0 : MEMORY.cannonThreat);
        if (witnessed && killer && killer.id !== other.id) {
            // Seeing who did it is worth far more than hearing the cannon.
            noteSighting(state, other, zone, Math.max(1, rememberedRivals(state, other, zone)), rememberedBarren(state, other, zone));
        }
        // §3.2: a cannon one zone over is a belief, not an observation. The
        // near-miss observer learns to fear a killer they did not see — and a
        // share of the time they pin it on the wrong person entirely: whoever
        // they last crossed paths with, or already dreaded. Nothing writes a
        // false impression like a half-heard death. Direct contact (a landed
        // hit — see reduceFear) is what corrects it. None of this happens at
        // all with no cannon to hear in the first place.
        if (!witnessed && !silent && killer && killer.id !== other.id
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
            // §9.7: what you were told fades faster than what you saw.
            slot.threat *= Math.pow(MEMORY.threatDecay, hearsayAge(slot, 1));
            if (slot.threat < 0.02) slot.threat = 0;
        });
    });
}

/* ------------------------------------------------------------------ *
 * §9.7: map knowledge as an object — tradeable, sellable, poisonable.
 *
 * `zones` has always been the one thing in this simulation that is earned
 * purely by walking about, and it has always been locked inside the skull that
 * earned it. That is a straight loss for the outer districts: a Career pack
 * arrives able to take anything it can see, and a tribute from Eleven who knows
 * which two clearings still have water arrives with nothing to bargain with,
 * despite holding the single thing the pack cannot take by force.
 *
 * Making the map tradeable gives them a currency. Making it *poisonable* is
 * what stops that currency being free money: intel a Career takes at knifepoint
 * is intel they have no way of verifying until they are standing in it.
 * ------------------------------------------------------------------ */

/** Local clamp — relationships.ts imports this module, so it cannot be imported back. */
function nudgeRel(t: Tribute, otherId: string, delta: number) {
    const next = (t.relationships[otherId] || 0) + delta;
    t.relationships[otherId] = Math.max(RELATIONSHIPS.min, Math.min(RELATIONSHIPS.max, Math.round(next * 10) / 10));
}

/** Treachery bias, archetype plus whatever the Treacherous trait adds. */
function treacheryOf(t: Tribute): number {
    return ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery');
}

/** Whether `t` would sooner die than misdirect `other`. Loyalty is the one brake. */
function genuinelyLoyalTo(t: Tribute, other: Tribute): boolean {
    return (t.relationships[other.id] || 0) >= RELATIONSHIPS.stickyMagnitude;
}

/** Impressions worth handing over, best first. */
function tradeableZones(state: GameState, teller: Tribute, listener: Tribute): string[] {
    const cycle = cycleOf(state);
    const tellerMem = ensureMemory(teller);
    const listenerMem = ensureMemory(listener);
    return Object.keys(tellerMem.zones)
        .filter(zone => {
            // You cannot sell what you no longer reliably know.
            const slot = tellerMem.zones[zone];
            if (cycle - slot.seen > MEMORY.sightingLifetime) return false;
            // Nor is it worth anything to somebody who was there yesterday.
            const held = listenerMem.zones[zone];
            return !held || held.hearsay || cycle - held.seen > MEMORY.sightingLifetime;
        })
        .map(zone => ({
            zone,
            novel: listenerMem.zones[zone] === undefined,
            // What makes an impression worth having: quiet ground with
            // something still on it. Threat and rivals are worth knowing too,
            // but a warning is cheap and directions to water are not.
            worth: (1 - rememberedBarren(state, teller, zone)) * MEMORY.barrenWeight
                - rememberedThreat(state, teller, zone)
                - rememberedRivals(state, teller, zone) * MEMORY.rivalAvoidWeight,
        }))
        .sort((a, b) => (Number(b.novel) - Number(a.novel)) || (b.worth - a.worth))
        .map(entry => entry.zone);
}

/** Copies one of the teller's impressions into the listener, flagged as told. */
function writeHearsay(state: GameState, teller: Tribute, listener: Tribute, zone: string,
                      threat: number, rivals: number, barren: number) {
    const slot = zoneSlot(listener, zone);
    slot.seen = cycleOf(state);
    // Clamped to the same 0-6 band `addZoneThreat` enforces. Hearsay is the
    // only path that writes a threat straight into a slot rather than
    // accumulating one, so it is the only path that could put a tribute's
    // memory outside the range every reader of it assumes.
    slot.threat = Math.max(0, Math.min(MEMORY_THREAT_CAP, threat));
    slot.rivals = Math.max(0, rivals);
    slot.barren = Math.max(0, Math.min(1, barren));
    slot.hearsay = true;
    slot.toldById = teller.id;
}

/**
 * §9.7: an honest exchange. The teller hands over the most useful things they
 * know that the listener does not, and both of them are worth more to each
 * other afterwards — which is precisely the trade the outer districts have to
 * offer and the Careers do not.
 */
export function shareZoneIntel(ctx: SimContext, teller: Tribute, listener: Tribute,
                               opts: { maxZones?: number; silent?: boolean } = {}): string[] {
    const state = ctx.state;
    const limit = opts.maxZones ?? INTEL.zonesPerShare;
    const zones = tradeableZones(state, teller, listener).slice(0, limit);
    if (zones.length === 0) return [];

    zones.forEach(zone => writeHearsay(state, teller, listener, zone,
        rememberedThreat(state, teller, zone),
        rememberedRivals(state, teller, zone),
        rememberedBarren(state, teller, zone)));

    teller.sharedIntelWith = teller.sharedIntelWith ?? [];
    if (!teller.sharedIntelWith.includes(listener.id)) teller.sharedIntelWith.push(listener.id);
    nudgeRel(teller, listener.id, INTEL.honestIntelBond);
    nudgeRel(listener, teller.id, INTEL.honestIntelBond);
    // The Capitol has always paid better for a broker than for a brawler.
    // balance-exempt: 100 is the sponsorTrust ceiling, not a tunable.
    teller.sponsorTrust = Math.min(100, teller.sponsorTrust + INTEL.intelSponsorTrust);
    noteContact(state, teller, listener);
    state.intelTrades = (state.intelTrades ?? 0) + 1;

    // The caller sometimes owns the scene itself — a parley paid in directions
    // is one beat, not two.
    if (opts.silent) return zones;
    ctx.logEvent(
        `${teller.name} scratches the shape of the arena into the dirt for ${listener.name} — `
        + `${zones.join(' and ')}, and what is waiting in each. It is the only thing they own that `
        + 'nobody has been able to take off them, and they are spending it deliberately.',
        [teller.id, listener.id],
        { category: 'alliance', zone: teller.zone }
    );
    return zones;
}

/**
 * §9.7: the poisoned version, indistinguishable from the honest one until the
 * listener is standing in it. Two shapes, both of which move somebody: a safe
 * clearing described as a killing ground, or stripped ground described as
 * plenty. The first keeps them away from something the teller wants; the
 * second sends them somewhere that will cost them a day.
 */
export function lieAboutZone(ctx: SimContext, teller: Tribute, listener: Tribute,
                             opts: { silent?: boolean } = {}): string | undefined {
    const state = ctx.state;
    const listenerMem = ensureMemory(listener);
    const tellerMem = ensureMemory(teller);

    // A quiet zone the listener has no opinion about is the cleanest lie
    // available: nothing they already believe has to be argued with.
    const quiet = state.arena.zones
        .filter(z => (state.zoneDeaths?.[z.name] ?? 0) === 0
            && rememberedThreat(state, teller, z.name) === 0
            && listenerMem.zones[z.name] === undefined);
    if (quiet.length > 0) {
        const zone = ctx.rng.pick(quiet).name;
        writeHearsay(state, teller, listener, zone, INTEL.lieThreat, 0, 0);
        noteLie(state, teller, listener);
        if (opts.silent) return zone;
        ctx.logEvent(
            `${teller.name} tells ${listener.name}, quite steadily, what they saw in ${zone}. `
            + 'None of it happened. It is a good enough account that neither of them blinks.',
            [teller.id, listener.id],
            { category: 'alliance', zone: teller.zone }
        );
        return zone;
    }

    // Otherwise: ground the teller has personally stripped, sold as untouched.
    const stripped = Object.keys(tellerMem.zones)
        .filter(zone => rememberedBarren(state, teller, zone) > 0);
    if (stripped.length === 0) return undefined;
    const zone = ctx.rng.pick(stripped);
    writeHearsay(state, teller, listener, zone, 0, 0, 0);
    noteLie(state, teller, listener);
    if (opts.silent) return zone;
    ctx.logEvent(
        `${teller.name} mentions to ${listener.name} that ${zone} is barely touched. `
        + `${teller.name} picked it clean themselves, two days ago.`,
        [teller.id, listener.id],
        { category: 'alliance', zone: teller.zone }
    );
    return zone;
}

function noteLie(state: GameState, teller: Tribute, listener: Tribute) {
    teller.liedTo = teller.liedTo ?? [];
    if (!teller.liedTo.includes(listener.id)) teller.liedTo.push(listener.id);
    noteContact(state, teller, listener);
}

/**
 * Whether standing here contradicts what they were told.
 *
 * Deliberately checked against the world rather than against a stored copy of
 * the claim: a tribute does not remember the exact words, they notice that the
 * clearing they were warned off is empty, or that the rich ground they were
 * sent to has nothing left in it.
 */
function lieIsExposed(t: Tribute, zone: string, slot: ZoneMemory, state: GameState): boolean {
    if (slot.threat >= INTEL.lieThreat) return (state.zoneDeaths?.[zone] ?? 0) === 0;
    return (ensureMemory(t).forageFailures?.[zone] ?? 0) > 0;
}

/**
 * §9.7: per-cycle — somebody works out they were sold a story.
 *
 * This is the whole reason lying is a decision rather than a free action. The
 * teller gains a real advantage for as long as it holds, and loses far more
 * than the trade was worth the moment the listener walks into the evidence.
 */
export function checkIntelLies(ctx: SimContext) {
    const state = ctx.state;
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));
    state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        const slot = ensureMemory(t).zones[t.zone];
        if (!slot?.hearsay || !slot.toldById) return;
        const teller = byId.get(slot.toldById);
        // Note: a teller who both lied to and levelled with the same person
        // can have an honest impression caught by this. That is not a defect
        // worth fixing — it is what being caught out once does to everything
        // else you were told by the same mouth.
        if (!teller || !teller.liedTo?.includes(t.id)) return;
        if (!lieIsExposed(t, t.zone, slot, state)) return;
        if (!ctx.rng.chance(INTEL.lieDiscoveryChance)) return;

        delete ensureMemory(t).zones[t.zone];
        nudgeRel(t, teller.id, -INTEL.lieDiscoveredCost);
        raiseSuspicion(t, teller.id, SUSPICION.perWitnessedBetrayal);
        const severe = (t.relationships[teller.id] || 0) <= -RELATIONSHIPS.stickyMagnitude;
        if (severe) swearVengeance(t, teller.id);
        ctx.logEvent(
            `${t.name} stands in ${t.zone} and looks at it properly, and the account ${teller.name} gave `
            + `does not survive the looking. ${severe ? `${t.name} starts working out where ${teller.name} sleeps.`
                : `${t.name} says nothing about it to anyone, and files it.`}`,
            [t.id, teller.id],
            { important: true, category: 'betrayal', zone: t.zone }
        );
    });
}

/**
 * §9.7: per-cycle — allies camped together talk about the map.
 *
 * Most of this is honest and unremarkable, which is the point: the group's
 * knowledge pools, and holding ground finally buys something. The share of it
 * that is not honest is the teller's treachery, and nothing else.
 */
export function tickIntelSharing(ctx: SimContext) {
    const state = ctx.state;
    const alive = state.tributes.filter(t => t.status === 'alive');
    alive.forEach(teller => {
        if (teller.allianceId === undefined) return;
        const mates = alive.filter(o => o.id !== teller.id
            && o.allianceId === teller.allianceId && o.zone === teller.zone);
        if (mates.length === 0) return;
        if (!ctx.rng.chance(INTEL.shareChance)) return;
        const listener = ctx.rng.pick(mates);
        const lieChance = INTEL.lieChanceBase + Math.max(0, treacheryOf(teller)) * INTEL.lieChancePerTreachery;
        if (!genuinelyLoyalTo(teller, listener) && ctx.rng.chance(lieChance)) {
            lieAboutZone(ctx, teller, listener);
            return;
        }
        shareZoneIntel(ctx, teller, listener);
    });
}

/**
 * Relationship decay: a rivalry from day 2 should not still be a
 * rivalry on day 10 if the two never met again. Strong bonds and deep hatreds
 * fade at half speed — those are the ones that define a run.
 */
/**
 * §3.7: records that these two were allies and it ended cleanly. Called only
 * from the dissolution paths — a betrayal or an expulsion is a different thing
 * entirely and has its own machinery.
 */
export function noteFormerAllies(members: Tribute[]) {
    members.forEach(a => {
        members.forEach(b => {
            if (a.id === b.id) return;
            a.formerAllies = a.formerAllies ?? [];
            if (!a.formerAllies.includes(b.id)) a.formerAllies.push(b.id);
        });
    });
}

export function decayRelationships(state: GameState) {
    const alive = state.tributes.filter(t => t.status === 'alive');
    alive.forEach(t => {
        Object.keys(t.relationships).forEach(otherId => {
            const value = t.relationships[otherId];
            if (value === 0) return;
            if (cyclesSinceContact(state, t, otherId) <= RELATIONSHIPS.contactWindow) return;
            let rate = Math.abs(value) >= RELATIONSHIPS.stickyMagnitude
                ? RELATIONSHIPS.decayPerCycle / 2
                : RELATIONSHIPS.decayPerCycle;
            // §3.7: the cold war. A pair who were in an alliance together and
            // parted without a betrayal decay slower and stop above zero —
            // whatever they are to each other now, it is not what they were to
            // each other before they met.
            const wasAllied = (t.formerAllies ?? []).includes(otherId);
            if (wasAllied) rate *= RELATIONSHIPS.exAllyDecayShare;
            const floor = wasAllied && value > 0 ? RELATIONSHIPS.exAllyFloor : 0;
            const next = value > 0
                ? Math.max(Math.min(value, floor), value - rate)
                : Math.min(0, value + rate);
            t.relationships[otherId] = Math.round(next * 10) / 10;
        });
    });
}
