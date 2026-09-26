import { Item, Obligation, Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { AUDIT12_TRIBUTES, AUDIT12_WAVE2_TRIBUTES as W2 } from '../data/balance';
import {
    countsCannons, forgetsFaces, hasTwitchyTrigger, isBoneSetter, isCorneredRat, isHeavySleeper,
    isHomebody, isMimic, isNightOwl, isOathkeeper, isPackRat, isPlateSprinter, isRationer, readsScars,
} from '../data/traits';
import { cycleOf, raiseSuspicion, rivalRecord } from './memory';
import { allied, allianceRecords, membersOf } from './alliance';
import { hasTruce } from './parley';
import { isActive, isDowned, widenRescueWindow } from './downed';
import { getZone } from './map';
import { awareness, concealment } from './stealth';
import { adjustRel, adjustTrust, getRel } from './relationships';
import { addFear } from './fear';
import { loseSanity } from './sanityBands';
import { clampTribute } from './vitals';
import { profOf, trainProficiency } from './proficiency';
import { healInjury, injuryGrade } from './wounds';
import { applyDamage, checkDeath, resolveCombat } from './combat';
import { giveItem, mintItem } from './items';
import { IMPROVISED_ITEMS, ITEMS } from '../data/constants';
import { dropParachute } from './parachutes';
import { addExcitement } from './audience';
import { arenaIsDark } from './arenaRules';
import { RNG } from '../utils/rng';

/**
 * AUDIT-12 T15 and §16: the trait, skill, stance and archetype hooks that are
 * a choice or an event rather than a number.
 *
 * AUDIT-11 §16 shipped eleven traits as modifier rows and promised behaviour
 * none of them had — Mimic, Twitchy Trigger, Homebody, Forgets Faces,
 * Oathkeeper, Heavy Sleeper, Bone-Setter, Cannon-Counter, Salt-Tongued, Pack
 * Rat and Night Owl had zero references in `src/engine`. This file is where
 * that behaviour lives. The helpers are small and each is read at exactly one
 * site, named in its comment; the per-cycle pieces run from
 * `tickTraitHooks`, which `postActionUpkeep` calls before the rescue window.
 */

// ---------------------------------------------------------------------------
// Per-cycle pass
// ---------------------------------------------------------------------------

/** Called once per cycle from `postActionUpkeep`, ahead of the rescue window. */
export function tickTraitHooks(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        if (!isActive(t)) return;
        if (isMimic(t)) mimicLure(ctx, t);
        if (isBoneSetter(t)) boneSetterSplint(ctx, t);
        if (t.stance === 'Hiding') hidingCost(t);
    });
}

/**
 * Mimic: a voice thrown into the next sector. A hostile there who is no
 * healthier than the mimic walks toward it and is ambushed on arrival. Anybody
 * who sees the trick worked — a bystander in either sector — writes it down as
 * deceit, and so does the target if they walk away from it.
 */
function mimicLure(ctx: SimContext, t: Tribute) {
    if (t.transit || !ctx.rng.chance(W2.mimicLureChance)) return;
    const here = getZone(ctx.state.arena, t.zone);
    if (!here) return;
    const collapsed = new Set(ctx.state.collapsedZones ?? []);
    const marks = getAlive(ctx.state).filter(o => o.id !== t.id && isActive(o) && !o.transit
        && here.adjacent.includes(o.zone) && !collapsed.has(o.zone)
        && !allied(o, t) && !hasTruce(ctx.state, t, o.id)
        && o.health <= t.health + W2.mimicLureHealthMargin);
    const mark = ctx.rng.pickOrUndefined(marks);
    if (!mark) return;
    const from = mark.zone;
    const bystanders = getAlive(ctx.state).filter(o => o.id !== t.id && o.id !== mark.id
        && (o.zone === t.zone || o.zone === from));
    mark.zone = t.zone;
    mark.zoneLevel = t.zoneLevel;
    t.lure = { targetId: mark.id, cycle: cycleOf(ctx.state) };
    ctx.logEvent(
        `${t.name} calls out from ${t.zone} in a voice that is not their own, and ${mark.name} comes out of ${from} toward it.`,
        [t.id, mark.id],
        { type: 'mimic-lure', important: true, category: 'combat', zone: t.zone }
    );
    const seen = bystanders.filter(o => ctx.rng.chance(W2.mimicWitnessBase + awareness(o) * W2.mimicWitnessPerAwareness));
    seen.forEach(o => raiseSuspicion(o, t.id, AUDIT12_TRIBUTES.deceitSuspicion));
    if (seen.length > 0) {
        ctx.logEvent(
            `${seen.map(o => o.name).join(' and ')} heard the voice too, and saw whose mouth it came out of. They will not take ${t.name}'s word for anything now.`,
            [t.id, ...seen.map(o => o.id)],
            { category: 'betrayal', zone: t.zone }
        );
    }
    resolveCombat(ctx, t, mark);
    t.lure = undefined;
    if (mark.status === 'alive') raiseSuspicion(mark, t.id, AUDIT12_TRIBUTES.deceitSuspicion);
}

/** Read by `rollAmbush`: the lure is what makes the opener land. */
export function lureAmbushBonus(ctx: SimContext, attacker: Tribute, defender: Tribute): number {
    const lure = attacker.lure;
    return lure && lure.targetId === defender.id && lure.cycle === cycleOf(ctx.state) ? W2.mimicLureAmbushBonus : 0;
}

/** Bone-Setter: a broken limb set without a kit, once per site per run. */
function boneSetterSplint(ctx: SimContext, t: Tribute) {
    const site = (['legs', 'arms'] as const).find(s =>
        injuryGrade(t, s) >= W2.boneSetterSplintGrade && !(t.splinted ?? []).includes(s));
    if (!site || !ctx.rng.chance(W2.boneSetterSplintChance)) return;
    healInjury(t, site, 1);
    t.splinted = [...(t.splinted ?? []), site];
    trainProficiency(t, 'medicine', ctx);
    ctx.logEvent(
        `${t.name} finds two straight sticks in ${t.zone}, sets their own ${site === 'legs' ? 'leg' : 'arm'} against them, and ties it off without making a sound.`,
        [t.id],
        { type: 'self-splint', category: 'survival', zone: t.zone }
    );
}

/** Hiding: lying still in a hole is cheap on the legs and dear on the stomach. */
function hidingCost(t: Tribute) {
    t.vitals.hunger += W2.hidingHunger;
    t.vitals.thirst += W2.hidingThirst;
    clampTribute(t);
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/**
 * Read by `combatPower`: Homebody on first-camp ground, Night Owl in the dark,
 * and the Cornered Rat with nowhere left to go.
 */
export function traitPowerHooks(ctx: SimContext, t: Tribute): number {
    let power = 0;
    if (isHomebody(t) && t.firstCampZone === t.zone) power += W2.homebodyCampPower;
    if (isNightOwl(t) && arenaIsDark(ctx.state)) power += W2.nightOwlNightPower;
    if (isCorneredRat(t) && t.health < W2.corneredRatHealth
        && t.retreatFailedCycle !== undefined
        && cycleOf(ctx.state) - t.retreatFailedCycle <= W2.corneredRatCycles) {
        power += W2.corneredRatPower;
    }
    return power;
}

/** A retreat that did not work: a parting shot landed, or a runner was caught. */
export function noteRetreatFailed(ctx: SimContext, t: Tribute) {
    t.retreatFailedCycle = cycleOf(ctx.state);
}

/** Read by `wantsToRetreat`: the Evasion skill. */
export function evasionRetreat(t: Tribute): number {
    return profOf(t, 'evasion') * W2.evasionRetreatPerLevel;
}

/** Read by the horn run-down: Plate-Sprinter and the Evasion skill. */
export function runDownCatchScale(t: Tribute): number {
    let scale = isPlateSprinter(t) ? W2.plateSprinterCatch : 1;
    scale *= Math.max(0, 1 - profOf(t, 'evasion') * W2.evasionCatchPerLevel);
    return scale;
}

/**
 * Twitchy Trigger, in a crowded brawl: swings before looking and catches
 * somebody on their own side. Once per brawl per tribute. Called from
 * `resolveGroupCombat` for whichever side is swinging this round.
 */
export function twitchyAllyHit(ctx: SimContext, side: Tribute[], crowd: number, done: Set<string>) {
    if (crowd < W2.twitchyCrowd) return;
    side.forEach(t => {
        if (done.has(t.id) || !hasTwitchyTrigger(t) || !isActive(t)) return;
        const allies = side.filter(o => o.id !== t.id && isActive(o) && o.zone === t.zone);
        if (allies.length === 0) return;
        done.add(t.id);
        if (!ctx.rng.chance(W2.twitchyAllyHitChance)) return;
        const hit = ctx.rng.pick(allies);
        const cause = `Struck by ${t.name}, swinging too early in a crowded fight`;
        applyDamage(ctx, hit, W2.twitchyAllyDamage, { cause, kind: 'tribute', code: 'tribute', sourceId: t.id });
        adjustRel(hit, t.id, -W2.twitchyAllyRegard);
        adjustTrust(hit, t.id, -W2.twitchyAllyTrust);
        ctx.logEvent(
            `${t.name} swings the moment something moves at the edge of their eye, and it is ${hit.name}. They were on the same side a second ago.`,
            [t.id, hit.id],
            { type: 'twitchy-hit', important: true, category: 'combat', zone: t.zone }
        );
        clampTribute(hit);
        checkDeath(ctx, hit, cause);
    });
}

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

/** Read by `decayRelationships`: Forgets Faces lets a grudge go twice as fast. */
export function grudgeDecayScale(t: Tribute, value: number): number {
    return value < 0 && forgetsFaces(t) ? W2.forgetsFacesGrudgeDecay : 1;
}

/** Read by `watchFails`: Heavy Sleeper nods off, Night Owl does not. */
export function watchFailScale(t: Tribute): number {
    return (isHeavySleeper(t) ? W2.heavySleeperWatchFail : 1) * (isNightOwl(t) ? W2.nightOwlWatchFail : 1);
}

/**
 * Oathkeeper: a promise about to be broken is kept instead, whatever it costs.
 * Returns true when the oath held, so the caller skips the breach. A supply
 * promise is paid out of the last ration; a rescue is made across the sector
 * at a run. Either way it is paid for in sanity and legs.
 */
export function oathHolds(ctx: SimContext, o: Obligation, from: Tribute, to: Tribute): boolean {
    if (!isOathkeeper(from) || !isActive(from) || to.status !== 'alive') return false;
    if (o.kind === 'supply') {
        const idx = from.inventory.findIndex(i => i.type === 'food' || i.type === 'water' || i.type === 'medical');
        if (idx < 0) return false;
        const item = from.inventory.splice(idx, 1)[0];
        const dropped = giveItem(to, item);
        if (dropped.includes(item)) { from.inventory.push(item); to.inventory = to.inventory.filter(i => i !== item); return false; }
    } else if (o.kind === 'rescue') {
        if (!isDowned(to)) return false;
        from.zone = to.zone;
        from.zoneLevel = to.zoneLevel;
        from.transit = undefined;
    } else {
        return false;
    }
    loseSanity(from, W2.oathkeeperStrainSanity);
    from.vitals.fatigue += W2.oathkeeperStrainFatigue;
    clampTribute(from);
    o.status = 'kept';
    adjustTrust(to, from.id, W2.scoutWarnTrust);
    ctx.logEvent(
        o.kind === 'supply'
            ? `${from.name} has nothing spare and gives ${to.name} the last of it anyway. They said they would, and they are the kind of person who cannot un-say a thing.`
            : `${from.name} is a sector away when ${to.name} goes down, and runs the whole of it, because they promised. It costs them more than they have.`,
        [from.id, to.id],
        { type: 'oath-kept', important: true, category: 'alliance', zone: from.zone }
    );
    return true;
}

/** Read by the betrayal roll: an Oathkeeper picked to betray does not, and pays for not wanting to. */
export function oathRefusesBetrayal(ctx: SimContext, t: Tribute): boolean {
    if (!isOathkeeper(t)) return false;
    loseSanity(t, W2.oathkeeperBetrayalSanity);
    ctx.logEvent(
        `${t.name} has every reason to turn on the group tonight, and does not. They gave their word, and it sits in them like a stone.`,
        [t.id],
        { type: 'oath-kept', category: 'alliance', zone: t.zone }
    );
    return true;
}

/** Read by `impressionOf`: a Scar-Reader knows how hurt anybody they have fought is. */
export function scarReaderSees(t: Tribute, other: Tribute): boolean {
    return readsScars(t) && other.status === 'alive' && (rivalRecord(t, other.id).fights ?? 0) > 0;
}

/** Read by `shareMeal`: a Rationer never takes the second share. */
export function neverGreedy(t: Tribute): boolean {
    return isRationer(t);
}

/**
 * Read by `consumeSupplies`: whether this meal comes out of the pack at all.
 * A Rationer eats half and keeps half, so every other meal is the saved half.
 * Eating from a thin pack is what trains Rationing.
 */
export function rationMeal(ctx: SimContext, t: Tribute): 'eat' | 'saved' {
    const rations = t.inventory.filter(i => i.type === 'food').reduce((n, i) => n + (i.stack ?? 1), 0);
    if (rations > 0 && rations <= W2.rationingLowStock) trainProficiency(t, 'rationing', ctx);
    if (!isRationer(t)) return 'eat';
    if (t.halfRation) { t.halfRation = false; return 'saved'; }
    t.halfRation = true;
    return 'eat';
}

/** Read by the hunger drain: the Rationing skill. */
export function rationingDrain(t: Tribute): number {
    return profOf(t, 'rationing') * W2.rationingDrainPerLevel;
}

// ---------------------------------------------------------------------------
// Cannons, movement, hiding, stances
// ---------------------------------------------------------------------------

/** Called by `killTribute` after the cannon is recorded. */
export function onCannon(ctx: SimContext, victim: Tribute) {
    getAlive(ctx.state).forEach(t => {
        if (!countsCannons(t) || t.id === victim.id) return;
        t.vitals.sanity = Math.min(100, t.vitals.sanity + W2.cannonCounterSanity);
        const fear = t.memory?.fear;
        if (fear) Object.keys(fear).forEach(id => { fear[id] = fear[id] * (1 - W2.cannonCounterFearShed); });
    });
}

/** Read by the destination scorer: a cannon next door is a direction not to go. */
export function cannonAvoidance(state: SimContext['state'], t: Tribute, zone: string): number {
    if (!countsCannons(t)) return 0;
    const cycle = state.cycle ?? 0;
    const cannons = (state.recentCannonZones ?? []).filter(c => c.zone === zone && c.cycle >= cycle - 1).length;
    return -cannons * W2.cannonCounterAvoid;
}

/** Read by the destination scorer: Signalling pulls an ally back together. */
export function signallingPull(state: SimContext['state'], t: Tribute, zone: string): number {
    if (!t.allianceId) return 0;
    const level = profOf(t, 'signalling');
    if (level <= 0) return 0;
    const absent = state.tributes.some(o => o.status === 'alive' && o.id !== t.id && allied(o, t)
        && o.zone === zone && o.zone !== t.zone);
    return absent ? level * W2.signallingPullPerLevel : 0;
}

/** Read by the hunt target filter: somebody Hiding is found only by a tracker who knows them. */
export function hiddenFromHunt(hunter: Tribute, quarry: Tribute): boolean {
    if (quarry.stance !== 'Hiding') return false;
    return profOf(hunter, 'tracking') < W2.hidingTrackedLevel && (rivalRecord(hunter, quarry.id).fights ?? 0) === 0;
}

/** Hiding's precondition: good ground to hide in, and something to hide from. */
export function hidingAvailable(ctx: SimContext, t: Tribute, hostile: number, cannonNearby: boolean, alliesHere: number): number | undefined {
    if (hostile <= 0 && !cannonNearby) return undefined;
    const zone = getZone(ctx.state.arena, t.zone);
    const value = concealment(t, zone, alliesHere, undefined, arenaIsDark(ctx.state));
    return value >= W2.hidingConcealmentMin ? value : undefined;
}

/**
 * Parleying: in a hostile meeting, talk comes first; a talk that fails is
 * frightening. Returns whether the parley settled it.
 */
export function noteParleyFailed(ctx: SimContext, talker: Tribute, other: Tribute) {
    talker.parleysFailed = (talker.parleysFailed ?? 0) + 1;
    addFear(talker, other.id, W2.parleyingFailFear);
    ctx.logEvent(
        `${talker.name} tries to talk ${other.name} down in ${talker.zone}, and ${other.name} is not listening.`,
        [talker.id, other.id],
        { type: 'parley-failed', category: 'combat', zone: talker.zone }
    );
}

// ---------------------------------------------------------------------------
// Skills with a read site elsewhere
// ---------------------------------------------------------------------------

/** Read by `rollAmbush`: the Ambush skill, and a Scout-Runner's warning on the defender. */
export function ambushSkillShift(ctx: SimContext, attacker: Tribute, defender: Tribute): number {
    let shift = profOf(attacker, 'ambush') * W2.ambushChancePerLevel;
    if ((defender.ambushWarnedUntil ?? -1) >= cycleOf(ctx.state)) shift -= W2.scoutWarnAmbushRelief;
    return shift;
}

/** Read by `mutts.ts`: Animal handling turns a mutt aside. */
export function muttHandlingScale(t: Tribute): number {
    return Math.max(0.4, 1 - profOf(t, 'animalHandling') * W2.animalHandlingMuttPerLevel);
}

/** Read by the snare catch: Animal handling dresses the game better. */
export function huntingYield(t: Tribute): number {
    return profOf(t, 'animalHandling') * W2.animalHandlingFeedPerLevel;
}

/** Read by the Menagerie's release: the prey is somebody the animal does not know how to avoid. */
export function menageriePrey(rng: RNG, candidates: Tribute[]): Tribute {
    const unhandled = candidates.filter(t => profOf(t, 'animalHandling') < W2.animalHandlingMenagerieLevel);
    return rng.pick(unhandled.length > 0 ? unhandled : candidates);
}

/** Read at the two body-looting sites: Pack Rat and the Scavenging skill. */
export function lootChanceBonus(t: Tribute, stripping: boolean): number {
    return profOf(t, 'scavenging') * W2.scavengingLootPerLevel
        + (isPackRat(t) ? (stripping ? W2.packRatStripBonus : W2.packRatLootBonus) : 0);
}

/** Read at a left camp: Salvage finds it, and at competence opens the rigged spare. */
export function salvageFindBonus(t: Tribute): number {
    return profOf(t, 'salvage') * W2.salvageFindPerLevel;
}

export function salvageExtra(ctx: SimContext, t: Tribute, pool: readonly string[]): Item | undefined {
    trainProficiency(t, 'salvage', ctx);
    if (profOf(t, 'salvage') < W2.salvageExtraLevel || pool.length === 0) return undefined;
    const id = ctx.rng.pick([...pool]);
    const def = ITEMS.find(i => i.id === id) ?? IMPROVISED_ITEMS.find(i => i.id === id);
    return def ? mintItem(ctx.rng, def as Item) : undefined;
}

// ---------------------------------------------------------------------------
// §16 archetype signatures (registered in `archetypeHooks.SIGNATURES`)
// ---------------------------------------------------------------------------

/** Scout-Runner: a sighting brought back that takes the surprise out of an ambush. */
export function scoutSighting(ctx: SimContext, t: Tribute): boolean {
    const here = getZone(ctx.state.arena, t.zone);
    if (!here) return false;
    const allies = getAlive(ctx.state).filter(o => o.id !== t.id && allied(o, t) && isActive(o));
    const threatened = allies.find(a => {
        const zone = getZone(ctx.state.arena, a.zone);
        return getAlive(ctx.state).some(h => !allied(h, a) && h.id !== t.id
            && (h.zone === a.zone || (zone?.adjacent ?? []).includes(h.zone)));
    });
    if (!threatened) return false;
    threatened.ambushWarnedUntil = cycleOf(ctx.state) + W2.scoutWarnCycles;
    adjustTrust(threatened, t.id, W2.scoutWarnTrust);
    adjustRel(threatened, t.id, W2.scoutWarnTrust);
    trainProficiency(t, 'signalling', ctx);
    ctx.logEvent(
        `${t.name} comes back into ${threatened.zone} at a run with what they saw on the ridge: somebody is lying up on the way ${threatened.name} was going to take. ${threatened.name} does not take it.`,
        [t.id, threatened.id],
        { type: 'scout-warning', important: true, category: 'alliance', zone: threatened.zone }
    );
    return true;
}

/** Turncoat: the timed betrayal — the leader out, the cache and the roles theirs. */
export function turncoatCoup(ctx: SimContext, t: Tribute): boolean {
    if (!t.allianceId || (ctx.state.day ?? 0) < W2.turncoatMinDay) return false;
    const record = allianceRecords(ctx.state)[t.allianceId];
    if (!record) return false;
    const members = membersOf(ctx.state, record.id).filter(m => m.status === 'alive');
    if (members.length < W2.turncoatMinMembers || record.leaderId === t.id) return false;
    const leader = members.find(m => m.id === record.leaderId);
    if (!leader) return false;
    const cache = record.sharedCache.splice(0, record.sharedCache.length);
    const dropped = giveItem(t, ...cache);
    record.sharedCache.push(...dropped);
    record.leaderId = t.id;
    const roles = record.roles ?? {};
    (Object.keys(roles) as Array<keyof typeof roles>).forEach(role => { if (roles[role] === leader.id) roles[role] = t.id; });
    delete leader.allianceId;
    adjustRel(leader, t.id, -W2.turncoatRegard);
    raiseSuspicion(leader, t.id, W2.turncoatSuspicion);
    members.filter(m => m.id !== t.id && m.id !== leader.id).forEach(m => raiseSuspicion(m, t.id, W2.turncoatSuspicion / 2));
    ctx.logEvent(
        `${t.name} waits until ${leader.name} is asleep, and in the morning it is ${t.name}'s group: the pile is in ${t.name}'s pack, the jobs are ${t.name}'s to hand out, and ${leader.name} is told to walk.`,
        [t.id, leader.id],
        { type: 'turncoat-coup', important: true, category: 'betrayal', zone: t.zone }
    );
    return true;
}

/** Warden-of-the-Weak: stands between a downed ally and whoever put them there. */
export function guardianStand(ctx: SimContext, t: Tribute): boolean {
    const hostileHere = (o: Tribute) => getAlive(ctx.state).find(h => h.id !== t.id && h.id !== o.id
        && h.zone === t.zone && isActive(h) && !allied(h, o) && !allied(h, t));
    const ward = getAlive(ctx.state).find(o => o.id !== t.id && o.zone === t.zone
        && (allied(o, t) || getRel(t, o.id) > 0)
        && (isDowned(o) || (o.health < W2.guardianWeakHealth && !!hostileHere(o))));
    if (!ward) return false;
    widenRescueWindow(ward, W2.guardianWindow);
    adjustTrust(ward, t.id, W2.guardianTrust);
    adjustRel(ward, t.id, W2.guardianTrust);
    const killer = ctx.state.tributes.find(o => o.id === ward.downed?.byId && o.status === 'alive' && o.zone === t.zone && isActive(o))
        ?? (isDowned(ward) ? undefined : hostileHere(ward));
    ctx.logEvent(
        killer
            ? `${ward.name} is on the ground in ${t.zone} and ${killer.name} is walking over to finish it. ${t.name} steps into the gap between them.`
            : `${t.name} plants themself over ${ward.name} in ${t.zone} and does not move. Whoever comes next goes through them first.`,
        killer ? [t.id, ward.id, killer.id] : [t.id, ward.id],
        { type: 'guardian-stand', important: true, category: 'combat', zone: t.zone }
    );
    t.objective = { kind: 'protect', wardId: ward.id, expires: cycleOf(ctx.state) + W2.scoutWarnCycles };
    if (killer) resolveCombat(ctx, t, killer);
    return true;
}

/** Forger: a weapon made from what the ground has, with a working edge on it. */
export function forgeWeapon(ctx: SimContext, t: Tribute): boolean {
    const zone = getZone(ctx.state.arena, t.zone);
    if (!zone) return false;
    const held = t.inventory.filter(i => i.type === 'weapon').reduce((m, i) => Math.max(m, i.damage ?? 0), 0);
    const pool = IMPROVISED_ITEMS.filter(i => i.type === 'weapon' && (i.damage ?? 0) > held);
    if (pool.length === 0) return false;
    const def = pool.reduce((best, i) => ((i.damage ?? 0) > (best.damage ?? 0) ? i : best));
    const made = mintItem(ctx.rng, def);
    if (made.durability !== undefined) made.durability += W2.forgerDurability;
    const dropped = giveItem(t, made);
    if (dropped.includes(made)) return false;
    trainProficiency(t, 'crafting', ctx);
    ctx.logEvent(
        `${t.name} spends the afternoon in ${t.zone} with a stone and what the ground gave them, and walks away with a ${made.name} that will hold an edge.`,
        [t.id],
        { type: 'forged-weapon', important: true, category: 'loot', zone: t.zone }
    );
    return true;
}

/**
 * Gambler: picks a fight the numbers say they lose, because the sponsors are
 * paying to see it — and a parachute comes down if they win it.
 */
export function gamblerWager(ctx: SimContext, t: Tribute, odds: (a: Tribute, b: Tribute) => number): boolean {
    if ((ctx.state.day ?? 0) < W2.gamblerMinDay || !isActive(t)) return false;
    const mark = getAlive(ctx.state).find(o => o.id !== t.id && o.zone === t.zone && isActive(o)
        && !allied(o, t) && !hasTruce(ctx.state, t, o.id) && odds(t, o) < W2.gamblerOddsMax);
    if (!mark) return false;
    ctx.logEvent(
        `${t.name} looks ${mark.name} over in ${t.zone}, knows exactly how this goes on paper, and starts it anyway. Somewhere in the Capitol a great deal of money changes hands.`,
        [t.id, mark.id],
        { type: 'gambler-wager', important: true, category: 'combat', zone: t.zone }
    );
    resolveCombat(ctx, t, mark);
    addExcitement(t, W2.gamblerExcitement);
    if (t.status === 'alive' && (mark.status !== 'alive' || isDowned(mark))) {
        const gift = ctx.rng.pick(ITEMS.filter(i => i.type === 'medical' || i.type === 'food'));
        if (gift) dropParachute(ctx, t, mintItem(ctx.rng, gift));
    }
    return true;
}
