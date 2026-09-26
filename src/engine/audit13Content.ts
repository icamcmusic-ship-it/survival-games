import { Proficiency, Tribute, Zone } from '../models/types';
import { SimContext, getAlive } from './context';
import { AUDIT13_CONTENT as C } from '../data/balance';
import {
    hasBadKnee, hasBorrowedLuck, hasDeadfallMind, hasLoudHeart, hasTinEar, isAshLunged, isBellVoiced,
    isBitterRoot, isHungerSharp, isKinSeeker, isMudSkinned, isSlowHealer, isStitchFingered, isTwoFaced,
    drownedOnce, keepsWatchAlone, traitMod,
} from '../data/traits';
import { cycleOf, ensureMemory, hasVengeanceAgainst, swearVengeance } from './memory';
import { allied } from './alliance';
import { isActive } from './downed';
import { getZone } from './map';
import { profOf, trainProficiency } from './proficiency';
import { hasCamp, lightFire, trapsIn } from './fieldcraft';
import { loseSanity } from './sanityBands';
import { clampTribute } from './vitals';
import { getRel } from './relationships';
import { addExcitement } from './audience';
import { climateOf } from './climate';

/**
 * AUDIT-13 §16 N1-N37: the hooks behind the sixteen traits, six skills, six
 * archetypes, six quirks and three stances this pass added.
 *
 * Built the way `traitHooks.ts` was for AUDIT-12: each helper is small and is
 * read at exactly one site, named in its comment, and the per-cycle pieces run
 * from `tickAudit13Content`, which `postActionUpkeep` calls straight after
 * `tickTraitHooks`. Every number is in `AUDIT13_CONTENT`.
 */

// ---------------------------------------------------------------------------
// Per-cycle pass
// ---------------------------------------------------------------------------

/** Called once per cycle from `postActionUpkeep`, after `tickTraitHooks`. */
export function tickAudit13Content(ctx: SimContext) {
    const cycle = cycleOf(ctx.state);
    const night = ctx.state.phase === 'night';
    const alive = getAlive(ctx.state);
    alive.forEach(t => {
        // N2: recomputed every cycle so `addFear`, which has no state, can read it.
        t.heartened = alive.some(o => o.id !== t.id && o.zone === t.zone && hasLoudHeart(o) && allied(o, t));
        // The hearth and the beacon are flags the stateless readers can see;
        // they are cleared here when they lapse.
        if (t.hearthUntil !== undefined && t.hearthUntil < cycle) t.hearthUntil = undefined;
        if (t.beaconUntil !== undefined && t.beaconUntil < cycle) t.beaconUntil = undefined;
        if (!isActive(t)) return;
        if (t.archetype === 'firekeeper') tendFire(ctx, t, night);
        if (t.archetype === 'pilgrim' && !t.pilgrimZone) pickLandmark(ctx, t);
        // Arriving is a fact the moment it happens; the set piece is the camera finding it.
        if (t.archetype === 'pilgrim' && t.pilgrimZone === t.zone) t.pilgrimArrived = true;
        if (t.crownedId) crownShare(ctx, t);
        if (night) hearthWarmth(ctx, t, cycle);
        if (t.stance === 'Mourning') keepVigil(t);
        else if (t.mourning && cycle - t.mourning.cycle > C.mourningWindow) endMourning(ctx, t);
        if (t.stance === 'Sheltering') {
            t.vitals.hunger += C.shelteringHunger;
            t.vitals.fatigue += C.shelteringFatigue;
            clampTribute(t);
        }
        if (t.quirks?.includes('keeps the first thing they find')) markKeepsake(t);
    });
}

/** N23: a Firekeeper lights one when they can, and counts the nights it burns. */
function tendFire(ctx: SimContext, t: Tribute, night: boolean) {
    if (!hasCamp(ctx, t, 'fire') && ctx.rng.chance(C.firekeeperLightChance)) lightFire(ctx, t);
    if (night && hasCamp(ctx, t, 'fire')) t.fireNights = (t.fireNights ?? 0) + 1;
}

/**
 * N26: the landmark is fixed once, the first cycle they are in the arena —
 * one of the sectors that can be seen from the plates, because a vow is made
 * about a place you can point at.
 */
function pickLandmark(ctx: SimContext, t: Tribute) {
    const horn = ctx.state.arena.zones[0];
    const collapsed = ctx.state.collapsedZones ?? [];
    const zones = (horn?.adjacent ?? []).filter(z => !collapsed.includes(z));
    const pick = ctx.rng.pickOrUndefined(zones);
    if (pick) t.pilgrimZone = pick;
}

/** N24: a crowned ally still standing beside them is sponsor attention shared. */
function crownShare(ctx: SimContext, t: Tribute) {
    const ward = ctx.state.tributes.find(o => o.id === t.crownedId);
    if (!ward || ward.status !== 'alive') { t.crownedId = undefined; return; }
    if (ward.zone !== t.zone) return;
    t.sponsorTrust = Math.min(100, t.sponsorTrust + C.crownSponsorShare);
}

/** N23: a kept hearth rests everyone on the Firekeeper's side who is sitting at it. */
function hearthWarmth(ctx: SimContext, t: Tribute, cycle: number) {
    const keeper = getAlive(ctx.state).find(o => (o.hearthUntil ?? -1) >= cycle && o.zone === t.zone
        && o.archetype === 'firekeeper' && (o.id === t.id || allied(o, t)));
    if (!keeper) return;
    t.vitals.fatigue = Math.max(0, t.vitals.fatigue - C.hearthFatigue);
}

/** N36: a cycle standing over the body mends rather than breaks. */
function keepVigil(t: Tribute) {
    const scale = t.archetype === 'mourner' ? 2 : 1;
    t.vitals.sanity = Math.min(100, t.vitals.sanity + C.mourningSanity * scale);
}

/** N36: on the way out of it, the oath — if they know who. */
function endMourning(ctx: SimContext, t: Tribute) {
    const killer = t.mourning?.killerId ? ctx.state.tributes.find(o => o.id === t.mourning!.killerId) : undefined;
    t.mourning = undefined;
    if (!killer || killer.id === t.id || killer.status !== 'alive' || allied(killer, t)) return;
    swearVengeance(t, killer.id);
}

/** N32: the first thing they ever picked up is theirs, and stays theirs. */
function markKeepsake(t: Tribute) {
    if (t.inventory.length === 0 || t.inventory.some(i => i.keepsake)) return;
    t.inventory[0].keepsake = true;
}

// ---------------------------------------------------------------------------
// Death, grief and the Mourning stance
// ---------------------------------------------------------------------------

/**
 * Called by `killTribute` beside `onCannon`, after `propagateDeathFallout`
 * has written who grieves. N36: anyone in or next to the zone who mourned
 * this one gets the stance's window; they know the killer only if they were
 * standing there.
 */
export function onAudit13Death(ctx: SimContext, victim: Tribute, killer?: Tribute) {
    const zone = getZone(ctx.state.arena, victim.zone);
    const cycle = cycleOf(ctx.state);
    getAlive(ctx.state).forEach(t => {
        if (t.id === victim.id) return;
        const near = t.zone === victim.zone || (zone?.adjacent ?? []).includes(t.zone);
        if (!near || !ensureMemory(t).mourned.includes(victim.id) || getRel(t, victim.id) < C.mourningRegard) return;
        t.mourning = { victimId: victim.id, killerId: t.zone === victim.zone ? killer?.id : undefined, cycle };
    });
}

/** Mourning's precondition: a death they grieve, in reach, inside the window. */
export function mourningAvailable(ctx: SimContext, t: Tribute): boolean {
    return !!t.mourning && cycleOf(ctx.state) - t.mourning.cycle <= C.mourningWindow;
}

// ---------------------------------------------------------------------------
// Stances: N35 Regrouping, N37 Sheltering
// ---------------------------------------------------------------------------

/**
 * The people a tribute would walk back to: their group, or — with no group —
 * somebody they are close to and have seen recently enough to know where.
 */
function regroupTargets(state: SimContext['state'], t: Tribute): Tribute[] {
    const cycle = cycleOf(state);
    return state.tributes.filter(o => o.status === 'alive' && o.id !== t.id && o.zone !== t.zone
        && (t.allianceId ? allied(o, t)
            : getRel(t, o.id) >= C.regroupingFriendRegard
                && cycle - (ensureMemory(t).lastContact[o.id] ?? -Infinity) <= C.regroupingContactCycles));
}

/** Regrouping's precondition: somebody of theirs is elsewhere, and they know where. */
export function regroupingAvailable(ctx: SimContext, t: Tribute): boolean {
    return regroupTargets(ctx.state, t).length > 0;
}

/** Read by the destination scorer: Regrouping walks toward the group; a Pilgrim toward the landmark; Drowned Once away from water. */
export function audit13DestinationScore(state: SimContext['state'], t: Tribute, z: Zone): number {
    let score = 0;
    if (t.stance === 'Regrouping' && regroupTargets(state, t).some(o => o.zone === z.name)) score += C.regroupingPull;
    if (t.archetype === 'pilgrim' && !t.pilgrimArrived && t.pilgrimZone === z.name) score += C.pilgrimPull;
    if (drownedOnce(t) && z.terrain === 'water' && !(state.collapsedZones ?? []).includes(t.zone)) {
        score -= C.drownedOnceRefusal;
    }
    return score;
}

/** How well this tribute can put a roof over themselves: the trait and the skill. */
function shelterSkill(t: Tribute): number {
    return traitMod(t, 'campSkill') + profOf(t, 'carpentry') * C.shelteringPerCarpentry;
}

/**
 * Sheltering's precondition: weather is on them or coming, or the arena's
 * standing climate is biting, and they know how to get under something.
 */
export function shelteringAvailable(ctx: SimContext, t: Tribute): boolean {
    if (shelterSkill(t) < C.shelteringSkillMin && !hasCamp(ctx, t, 'shelter')) return false;
    const front = ctx.state.weatherFront;
    const zone = getZone(ctx.state.arena, t.zone);
    if (front && (front.zone === t.zone || (zone?.adjacent ?? []).includes(front.zone))) return true;
    return !!climateOf(ctx.state.arena.id);
}

/** Sheltering's score: the skill, and the dark, which is when the cold kills. */
export function shelterScore(ctx: SimContext, t: Tribute): number {
    return C.shelteringBase + shelterSkill(t) + (ctx.state.phase === 'night' ? C.shelteringNightBonus : 0);
}

// ---------------------------------------------------------------------------
// Exposure, damage, death
// ---------------------------------------------------------------------------

/**
 * Read by `applyExposure`: Sheltering halves it, `weathercraft` takes a
 * share off it (and is trained by it), a Firekeeper's hearth warms against
 * the cold. Ash-Lunged is handled at the damage site.
 */
export function exposureScale(ctx: SimContext, t: Tribute): number {
    let scale = t.stance === 'Sheltering' ? C.shelteringExposureScale : 1;
    scale *= Math.max(C.weathercraftFloor, 1 - profOf(t, 'weathercraft') * C.weathercraftPerLevel);
    if (t.stance !== 'Sheltering') trainProficiency(t, 'weathercraft', ctx);
    if (warmedByHearth(ctx, t)) scale *= 1 - C.hearthColdResist;
    return scale;
}

function warmedByHearth(ctx: SimContext, t: Tribute): boolean {
    const cycle = cycleOf(ctx.state);
    return getAlive(ctx.state).some(o => (o.hearthUntil ?? -1) >= cycle && o.zone === t.zone
        && (o.id === t.id || allied(o, t)));
}

/**
 * Read by `applyDamage`: N9 Ash-Lunged against smoke and ash, and N28 a
 * Lamplighter's marked route against the arena's hazards.
 */
export function audit13DamageScale(t: Tribute, kind: string, cause: string): number {
    let scale = 1;
    if (isAshLunged(t) && /smoke|ash|fume/i.test(cause)) scale *= C.ashLungSmokeScale;
    if (t.beaconUntil !== undefined && kind !== 'tribute' && kind !== 'status') scale *= C.beaconHazardScale;
    return scale;
}

/**
 * Read by `shouldGoDown`: N12 Borrowed Luck. The first lethal blow of the
 * Games puts them on the ground instead, once — outside the bloodbath and
 * above the finalist floor, which the caller checks.
 */
export function spendBorrowedLuck(t: Tribute): boolean {
    if (!hasBorrowedLuck(t) || t.luckSpent) return false;
    t.luckSpent = true;
    return true;
}

// ---------------------------------------------------------------------------
// Combat, fear, stealth
// ---------------------------------------------------------------------------

/** Read by `combatPower`: N11 Hunger-Sharp, and N27 a Mourner against an ally's killer. */
export function audit13PowerHooks(t: Tribute, opponent?: Tribute): number {
    let power = 0;
    if (isHungerSharp(t) && t.vitals.hunger >= C.hungerSharpFrom) power += C.hungerSharpPower;
    if (opponent && t.archetype === 'mourner' && hasVengeanceAgainst(t, opponent.id)) power += C.mournerVengeance;
    return power;
}

/** Read by the Hunting scorer: N11 Hunger-Sharp goes looking when hungry. */
export function hungerSharpHunting(t: Tribute): number {
    return isHungerSharp(t) && t.vitals.hunger >= C.hungerSharpFrom ? C.hungerSharpHunting : 0;
}

/** Read by `addFear`: N2 a Loud Heart beside them. */
export function heartenedScale(t: Tribute): number {
    return t.heartened ? 1 - C.loudHeartFearCut : 1;
}

/** Read by `broadcastDeath`: N10 Tin Ear does not hear the cannon as a threat. */
export function deafToCannon(t: Tribute): boolean {
    return hasTinEar(t);
}

/** Read by `awareness`: N36 Mourning is standing still with your eyes on the ground. */
export function audit13Awareness(t: Tribute): number {
    return t.stance === 'Mourning' ? -C.mourningAwareness : 0;
}

/** Read by `concealment`: N5 Mud-Skinned counts twice over in marsh ground. */
export function mudSkinConcealment(t: Tribute, zone: Zone | undefined): number {
    if (!isMudSkinned(t) || zone?.terrain !== 'wetland') return 0;
    return traitMod(t, 'concealment') * (C.mudSkinWetlandScale - 1);
}

/**
 * Read by `rollAmbush`: N14 Deadfall Mind on held ground with their own
 * traps on it; N35 somebody Regrouping is watching the way they came.
 */
export function audit13AmbushShift(ctx: SimContext, attacker: Tribute, defender: Tribute): number {
    let shift = 0;
    if (hasDeadfallMind(attacker) && attacker.zoneHeldName === attacker.zone
        && trapsIn(ctx, attacker.zone).some(tr => tr.ownerId === attacker.id)) shift += C.deadfallAmbush;
    if (defender.stance === 'Regrouping') shift -= C.regroupingAmbushRelief;
    return shift;
}

/** Read by the hunt target filter: N37 somebody Sheltering is found only by a tracker. */
export function shelteredFromHunt(hunter: Tribute, quarry: Tribute): boolean {
    return quarry.stance === 'Sheltering' && profOf(hunter, 'tracking') < C.shelteringTrackedLevel;
}

/** Read by `targetDrawOf`: N23 a fire that has been kept three nights is seen for miles. */
export function hearthDraw(t: Tribute): number {
    return t.hearthUntil !== undefined ? C.hearthTargetDraw : 0;
}

// ---------------------------------------------------------------------------
// Movement, wounds, resolve, sleep
// ---------------------------------------------------------------------------

/** Read by `beginMove`: N3 Bad Knee on the way up. */
export function badKneeClimb(t: Tribute, dest: Zone | undefined) {
    if (!hasBadKnee(t) || dest?.terrain !== 'highland') return;
    t.vitals.fatigue = Math.min(100, t.vitals.fatigue + C.badKneeHighlandFatigue);
}

/** Read by the Patrolling precondition: N3 a Bad Knee is never the one walking the edge. */
export function cannotPatrol(t: Tribute): boolean {
    return hasBadKnee(t);
}

/** Read by `tickWoundRecovery`: N15 every wound takes a cycle longer. */
export function extraRecoveryCycles(t: Tribute): number {
    return isSlowHealer(t) ? C.slowHealerCycles : 0;
}

/** Read by `dressChance`: N15 bandages take less well on a Slow Healer. */
export function dressingReceived(patient: Tribute): number {
    return isSlowHealer(patient) ? -C.slowHealerDressing : 0;
}

/** Read by `tickResolve`: N15 pain never argues a Slow Healer out of it. */
export function woundsShakeResolve(t: Tribute): boolean {
    return !isSlowHealer(t);
}

/** Read by `tickResolve`: N26 a Pilgrim who arrived. */
export function audit13ResolveDrift(t: Tribute): number {
    return t.pilgrimArrived ? C.pilgrimResolve : 0;
}

/** Read by `attemptFieldDressing` on a dressing that took: N1 Stitch-Fingered on an ally. */
export function noteStitched(ctx: SimContext, medic: Tribute, patient: Tribute) {
    if (medic.id === patient.id || !isStitchFingered(medic)) return;
    patient.stitchedUntil = cycleOf(ctx.state) + C.stitchCycles;
}

/** Read by `infectionChance`: N1 a Stitch-Fingered dressing is a clean one. */
export function stitchedInfectionScale(ctx: SimContext, t: Tribute): number {
    return (t.stitchedUntil ?? -1) >= cycleOf(ctx.state) ? C.stitchInfectionScale : 1;
}

/** Read by `watchFailScale`: N16 on a watch nobody shares. */
export function loneWatchScale(t: Tribute): number {
    return keepsWatchAlone(t) ? C.loneWatchScale : 1;
}

/** Read by the survival drain at night: N22 resting. */
export function restingFatigue(t: Tribute): number {
    return profOf(t, 'resting') * C.restingFatiguePerLevel;
}

/** Read by the sanity recovery: N22 resting. */
export function restingSanity(t: Tribute): number {
    return profOf(t, 'resting') * C.restingSanityPerLevel;
}

/** Read by `applyNaturalRecovery` on a night that qualified: N22 trains on unbroken rest. */
export function noteRest(t: Tribute, ctx: SimContext) {
    trainProficiency(t, 'resting', ctx);
}

// ---------------------------------------------------------------------------
// Skills with a read site elsewhere
// ---------------------------------------------------------------------------

/** Read by the forage roll: N17 angling on water ground. */
export function anglingForage(t: Tribute, zone: Zone | undefined): number {
    if (zone?.terrain !== 'water' && zone?.terrain !== 'wetland') return 0;
    return profOf(t, 'angling') * C.anglingPerLevel;
}

/** Read by `attemptForage` on a find: N17 trains angling on water; N13 Bitter Root's sour mouthful. */
export function afterForage(ctx: SimContext, t: Tribute) {
    const zone = getZone(ctx.state.arena, t.zone);
    if (zone?.terrain === 'water' || zone?.terrain === 'wetland') trainProficiency(t, 'angling', ctx);
    if (isBitterRoot(t) && ctx.rng.chance(C.bitterRootChance)) loseSanity(t, C.bitterRootSanity);
}

/** Read by `attemptForage`: N13 nothing Bitter Root picks is poison. */
export function neverPoisonous(t: Tribute): boolean {
    return isBitterRoot(t);
}

/** Read by `plantRumour`'s roll: N18 mimicry. */
export function mimicryCredibility(t: Tribute): number {
    return profOf(t, 'mimicry') * C.mimicryPerLevel;
}

/** Read by `tickTraitHooks`: N18 at this level anybody can throw a voice. */
export function canThrowVoice(t: Tribute): boolean {
    return profOf(t, 'mimicry') >= C.mimicryLureLevel;
}

/** Read by the bluff roll: N19 bartering, with the `haggle` trait as its floor. */
export function bargainingBase(t: Tribute): number {
    return Math.max(traitMod(t, 'haggle'), profOf(t, 'bartering') * C.barteringPerLevel);
}

/** Read by `keep`: N19 a deal done is a lesson in doing deals. */
export function noteDealDone(from: Tribute | undefined, to: Tribute | undefined, ctx: SimContext) {
    if (from) trainProficiency(from, 'bartering', ctx);
    if (to) trainProficiency(to, 'bartering', ctx);
}

/** Read by `teachSkills`: N21 teaching. */
export function teachingGainScale(teacher: Tribute): number {
    return 1 + profOf(teacher, 'teaching') * C.teachingPerLevel;
}

/** Read by `trainProficiency`: N29 the step-counter learns ground faster. */
export function trainingShareScale(t: Tribute, skill: Proficiency): number {
    return skill === 'navigation' && t.quirks?.includes('counts their steps between trees') ? C.stepCounterNavigation : 1;
}

/** Read by `trainProficiency` on a whole level crossed: N21 an ally watching learns to teach. */
export function watchTeacherLearns(ctx: SimContext, t: Tribute) {
    getAlive(ctx.state).forEach(o => {
        if (o.id === t.id || o.zone !== t.zone || !allied(o, t)) return;
        trainProficiency(o, 'teaching', undefined, C.teachingWatchShare);
    });
}

/**
 * Read by `tradeRumours` after a rumour is passed on: N7 Two-Faced. The
 * listener remembers somebody else as having said it — who takes the blame
 * if it proves false.
 */
export function twoFacedTell(ctx: SimContext, teller: Tribute, listener: Tribute, rumourId: string) {
    if (!isTwoFaced(teller) || !ctx.rng.chance(C.twoFacedMisattribute)) return;
    const others = getAlive(ctx.state).filter(o => o.id !== teller.id && o.id !== listener.id);
    const scapegoat = ctx.rng.pickOrUndefined(others);
    const mem = ensureMemory(listener);
    if (scapegoat && mem.rumourSource) mem.rumourSource[rumourId] = scapegoat.id;
}

/** Read by `signallingPull`: N6 Bell-Voiced reaches one zone further. */
export function bellVoiceReach(state: SimContext['state'], t: Tribute, zone: string): boolean {
    if (!isBellVoiced(t)) return false;
    const z = getZone(state.arena, zone);
    return state.tributes.some(o => o.status === 'alive' && o.id !== t.id && allied(o, t)
        && o.zone !== t.zone && (z?.adjacent ?? []).includes(o.zone));
}

/** Read by alliance formation: N8 a Kin-Seeker on day 1 is not refused by their own district. */
export function kinBound(state: SimContext['state'], a: Tribute, b: Tribute): boolean {
    return (state.day ?? 0) <= 1 && a.district === b.district && (isKinSeeker(a) || isKinSeeker(b));
}

/** Read by `pickLeader`: N24 the ally a Kingmaker is crowning. */
export function crownLeadership(t: Tribute): number {
    return t.crownedById ? C.crownLeadership : 0;
}

/** Read by the grief sanity hit: N27 a Mourner feels every one. */
export function mournerGriefResist(t: Tribute): number {
    return t.archetype === 'mourner' ? -C.mournerGrief : 0;
}

// ---------------------------------------------------------------------------
// §16 archetype signatures (registered in `archetypeHooks.SIGNATURES`)
// ---------------------------------------------------------------------------

/** N23 Firekeeper: the fire kept long enough to become a hearth. */
export function keepFire(ctx: SimContext, t: Tribute): boolean {
    if ((t.fireNights ?? 0) < C.firekeeperNights || !hasCamp(ctx, t, 'fire')) return false;
    t.hearthUntil = cycleOf(ctx.state) + C.hearthCycles;
    trainProficiency(t, 'firecraft', ctx);
    const warmed = getAlive(ctx.state).filter(o => o.id !== t.id && o.zone === t.zone && allied(o, t));
    ctx.logEvent(
        warmed.length > 0
            ? `${t.name} has kept the fire in ${t.zone} going for nights now, and it has stopped being a fire and become a hearth. ${warmed.map(o => o.name).join(' and ')} sleep beside it like people at home.`
            : `${t.name} has kept the fire in ${t.zone} going for nights now. It has stopped being a fire and become a hearth, and it can be seen from everywhere.`,
        [t.id, ...warmed.map(o => o.id)],
        { type: 'hearth-kept', important: true, category: 'survival', zone: t.zone }
    );
    return true;
}

/** N24 Kingmaker: picks the ally worth following and tells the group so. */
export function crownAlly(ctx: SimContext, t: Tribute): boolean {
    const candidates = getAlive(ctx.state).filter(o => o.id !== t.id && isActive(o)
        && (allied(o, t) || (o.zone === t.zone && getRel(t, o.id) > 0)));
    if (candidates.length === 0) return false;
    const ward = candidates.reduce((best, o) => (o.trainingScore + o.kills > best.trainingScore + best.kills ? o : best));
    t.crownedId = ward.id;
    ward.crownedById = t.id;
    trainProficiency(t, 'teaching', ctx);
    ctx.logEvent(
        `${t.name} says it plainly, where everybody can hear: ${ward.name} is the one worth following. It is the kind of thing that becomes true by being said.`,
        [t.id, ward.id],
        { type: 'kingmaker-crown', important: true, category: 'alliance', zone: t.zone }
    );
    return true;
}

/**
 * N25 Ratcatcher: a mutt hunting somebody in a zone with their lines on it
 * is cleared; with no mutt about, the trapline is swept for vermin and eaten.
 */
export function pestSweep(ctx: SimContext, t: Tribute): boolean {
    const here = getZone(ctx.state.arena, t.zone);
    const ground = new Set([t.zone, ...(here?.adjacent ?? [])]);
    const lines = (ctx.state.traps ?? []).filter(tr => tr.ownerId === t.id);
    const covered = lines.some(tr => ground.has(tr.zone));
    const mutts = ctx.state.activeMutts ?? [];
    const cleared = covered ? mutts.filter(m => {
        const quarry = ctx.state.tributes.find(o => o.id === m.targetId);
        return quarry?.status === 'alive' && quarry.zone === t.zone;
    }) : [];
    if (cleared.length > 0) {
        ctx.state.activeMutts = mutts.filter(m => !cleared.includes(m));
        trainProficiency(t, 'animalHandling', ctx);
        ctx.logEvent(
            `Whatever the Gamemakers sent into ${t.zone} walks into ${t.name}'s lines and does not walk out. ${t.name} resets the snare and says nothing about it.`,
            [t.id],
            { type: 'pest-sweep', important: true, category: 'hazard', zone: t.zone }
        );
        return true;
    }
    // With no line down, a handler who knows animals works with their hands.
    if (lines.length < C.pestSweepTraps && profOf(t, 'animalHandling') < C.pestSweepHandling) return false;
    t.vitals.hunger = Math.max(0, t.vitals.hunger - C.pestSweepFeed);
    trainProficiency(t, 'animalHandling', ctx);
    ctx.logEvent(
        lines.length >= C.pestSweepTraps
            ? `${t.name} walks the whole trapline before dawn and comes back with a string of things nobody else in the arena would have thought to eat.`
            : `${t.name} spends the grey hour before dawn turning over logs in ${t.zone}, and comes back with a string of things nobody else in the arena would have thought to eat.`,
        [t.id],
        { type: 'pest-sweep', important: true, category: 'survival', zone: t.zone }
    );
    return true;
}

/** N26 Pilgrim: standing, at last, where they said they would stand. */
export function pilgrimArrival(ctx: SimContext, t: Tribute): boolean {
    if (!t.pilgrimZone || !t.pilgrimArrived) return false;
    t.sponsorTrust = Math.min(100, t.sponsorTrust + C.pilgrimSponsor);
    addExcitement(t, C.pilgrimSponsor);
    trainProficiency(t, 'weathercraft', ctx);
    ctx.logEvent(
        `${t.name} has stood in ${t.pilgrimZone}. They told the cameras at the reaping they would, and nobody believed them, and the footage is being played in every district tonight.`,
        [t.id],
        { type: 'pilgrim-arrival', important: true, category: 'survival', zone: t.zone }
    );
    return true;
}

/** N27 Mourner: a vigil over somebody they lost; sanity back, and an oath. */
export function mournerVigil(ctx: SimContext, t: Tribute): boolean {
    const vigil = t.mourning ?? (() => {
        const body = ctx.state.tributes.find(o => o.status === 'dead' && o.zone === t.zone
            && ensureMemory(t).mourned.includes(o.id));
        return body ? { victimId: body.id, killerId: body.lastDamage?.sourceId, cycle: cycleOf(ctx.state) } : undefined;
    })();
    if (!vigil) return false;
    const victim = ctx.state.tributes.find(o => o.id === vigil.victimId);
    if (!victim) return false;
    t.vitals.sanity = Math.min(100, t.vitals.sanity + C.vigilSanity);
    const killer = vigil.killerId ? ctx.state.tributes.find(o => o.id === vigil.killerId && o.status === 'alive') : undefined;
    if (killer && killer.id !== t.id) swearVengeance(t, killer.id);
    trainProficiency(t, 'resting', ctx);
    ctx.logEvent(
        killer
            ? `${t.name} sits with ${victim.name} in ${t.zone} until it is properly dark, and gets up knowing exactly who they are going to find.`
            : `${t.name} sits with ${victim.name} in ${t.zone} until it is properly dark, and gets up steadier than they sat down.`,
        killer ? [t.id, victim.id, killer.id] : [t.id, victim.id],
        { type: 'mourner-vigil', important: true, category: 'alliance', zone: t.zone }
    );
    return true;
}

/** N28 Lamplighter: a safe way marked for their people, for a day. */
export function lightBeacon(ctx: SimContext, t: Tribute): boolean {
    if ((ctx.state.day ?? 0) < C.beaconMinDay) return false;
    const until = cycleOf(ctx.state) + C.beaconCycles;
    const marked = getAlive(ctx.state).filter(o => o.id === t.id || allied(o, t));
    marked.forEach(o => { o.beaconUntil = until; });
    trainProficiency(t, 'signalling', ctx);
    ctx.logEvent(
        marked.length > 1
            ? `${t.name} spends the evening marking a safe line out of ${t.zone} — cut bark, stacked stones, a strip of cloth — and tells ${marked.filter(o => o.id !== t.id).map(o => o.name).join(' and ')} to walk nowhere else tomorrow.`
            : `${t.name} spends the evening marking a safe line out of ${t.zone} — cut bark, stacked stones, a strip of cloth — for nobody but themself.`,
        marked.map(o => o.id),
        { type: 'beacon-lit', important: true, category: 'survival', zone: t.zone }
    );
    return true;
}
