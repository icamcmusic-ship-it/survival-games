import { Item, Proficiency, Tribute, Zone } from '../models/types';
import { SimContext, getAlive } from './context';
import { AUDIT14_CONTENT as C } from '../data/balance';
import { ITEMS, IMPROVISED_ITEMS } from '../data/constants';
import { craftOf } from '../data/districts';
import {
    drownedOnce, hasHandMeDown, hasIronLungs, hasSharpElbows, hasShortFuse, hasSoftStep, isFeverProof,
    isHornShy, isLateBloomer, isQuickStudy, isRearguard, isSoreLoser, isTrapwise, sleepsLight,
} from '../data/traits';
import { cycleOf, ensureMemory, improveRead, noteRivalSighting, rememberedRivals, swearVengeance } from './memory';
import { allianceOf, allied } from './alliance';
import { isActive, isDowned } from './downed';
import { getZone, hopsTo, reachableZones, severedEdgeSet } from './map';
import { profOf, trainProficiency } from './proficiency';
import { clampTribute } from './vitals';
import { getRel } from './relationships';
import { addExcitement } from './audience';
import { dropParachute } from './parachutes';
import { resolveCombat } from './combat';
import { getMark, setMark } from './arenaRules';
import { forceStance } from './stance';
import { adjustRel } from './relationships';
import { carryCapacity, giveItem, mintItem } from './items';

/**
 * AUDIT-14 §7: the hooks behind the sixteen traits, eight skills, six
 * archetypes, eight quirks, three stances and four personas this pass added,
 * and the §7 balance proposals that needed code rather than a number (A28's
 * small-field horn, A34's isolate objective, A35's side bet).
 *
 * Built the way `audit13Content.ts` was: each helper is small and read at
 * exactly one site, named in its comment; the per-cycle pieces run from
 * `tickAudit14Content`, which `postActionUpkeep` calls after
 * `tickAudit13Content`. Every number is in `AUDIT14_CONTENT`.
 */

const quirk = (t: Tribute, label: string) => t.quirks?.includes(label) ?? false;

// ---------------------------------------------------------------------------
// Per-cycle pass
// ---------------------------------------------------------------------------

/** Called once per cycle from `postActionUpkeep`, after `tickAudit13Content`. */
export function tickAudit14Content(ctx: SimContext) {
    const cycle = cycleOf(ctx.state);
    gamesDay = ctx.state.day ?? 1;
    getAlive(ctx.state).forEach(t => {
        if (!isActive(t)) return;
        // K8: a cache is dug back up by whoever buried it, once they are back.
        if (t.cache && t.cache.zone === t.zone) retrieveCache(ctx, t);
        // R5: the run's goods are a target only while they are being carried.
        if (t.smugglingUntil !== undefined && t.smugglingUntil < cycle) t.smugglingUntil = undefined;
        // K4: holding a roof over your head is how a roof is learned.
        if (t.stance === 'Sheltering') trainProficiency(t, 'shelterwright', ctx);
        // K7: something is on their trail and they are on wet ground — which
        // is the whole lesson of breaking one.
        const zone = getZone(ctx.state.arena, t.zone);
        if ((zone?.terrain === 'water' || zone?.terrain === 'wetland')
            && (ctx.state.activeMutts ?? []).some(m => m.targetId === t.id)) trainProficiency(t, 'scentcraft', ctx);
        // Q7: a mark for every body they pass, and the name of whoever did it.
        if (quirk(t, 'marks every body they pass')) markBodies(ctx, t);
        // Q8: the last sip, drunk on the worst day.
        if (quirk(t, 'keeps one sip for later') && !t.sipDrunk && t.vitals.thirst >= C.keptSipThirst) {
            t.sipDrunk = true;
            t.vitals.thirst = Math.max(0, t.vitals.thirst - C.keptSipRelief);
            clampTribute(t);
            ctx.logEvent(`${t.name} drinks the one mouthful they have been saving since the first day. It is the best thing they have ever tasted.`,
                [t.id], { category: 'survival', zone: t.zone });
        }
    });
}

/** Q7: the dead in this zone, marked once each, and the killer's name kept. */
function markBodies(ctx: SimContext, t: Tribute) {
    ctx.state.tributes.forEach(body => {
        if (body.status !== 'dead' || body.zone !== t.zone) return;
        const key = `a14mark:${t.id}:${body.id}`;
        if (getMark(ctx.state, key) === 1) return;
        setMark(ctx.state, key, 1);
        const killer = body.lastDamage?.sourceId ? ctx.state.tributes.find(o => o.id === body.lastDamage!.sourceId) : undefined;
        if (killer && killer.status === 'alive' && killer.id !== t.id) improveRead(t, killer.id, C.marksBodiesRead);
    });
}

// ---------------------------------------------------------------------------
// A28: the small-field horn; T1 Horn-Shy; T14 Sharp Elbows; T15 Hand-Me-Down
// ---------------------------------------------------------------------------

/**
 * Read by the bloodbath's fight roll. A28: in a field where the Careers are
 * more than a quarter of the cast, the horn is visibly theirs, and everybody
 * else can count — a non-Career scatters rather than charges. At 12 districts
 * the share is exactly the line and nothing changes.
 */
export function smallFieldHornShift(alive: Tribute[], t: Tribute): number {
    if (t.isCareer || alive.length === 0) return 0;
    const share = alive.filter(o => o.isCareer).length / alive.length;
    if (share <= C.smallFieldCareerShare) return 0;
    return -Math.min(C.smallFieldScatterCap, (share / C.smallFieldCareerShare - 1) * C.smallFieldScatter);
}

/** Read by `chooseHornPlan`: T1 Horn-Shy always works the edge. */
export function forcedHornPlan(t: Tribute): 'scatter' | undefined {
    return isHornShy(t) ? 'scatter' : undefined;
}

/** Called by `startGames`: T15 the family weapon, carried onto the plate. */
export function issueHandMeDowns(ctx: SimContext) {
    gamesDay = 1;
    ctx.state.tributes.forEach(t => {
        if (t.status !== 'alive' || !hasHandMeDown(t)) return;
        const id = craftOf(t.district).signatureWeapon;
        const base = ITEMS.find(i => i.id === id && i.type === 'weapon');
        if (!base || t.inventory.some(i => i.id === id)) return;
        giveItem(t, mintItem(ctx.rng, base));
    });
}

/** Read by the training score: T4 a Quick Study looked worse than they are. */
export function quickStudyScorePenalty(t: Tribute): number {
    return isQuickStudy(t) ? C.quickStudyTrainingScore : 0;
}

/** Read by `trainProficiency`: T4 Quick Study. */
export function audit14TrainingScale(t: Tribute): number {
    return isQuickStudy(t) ? C.quickStudyScale : 1;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/**
 * The fight `resolveCombat` is running right now: who opened it. Module state
 * rather than a parameter because `combatPower` is called from a dozen places
 * that never see the fight; it is set and cleared around each fight.
 */
let currentFight: { opener: string; defender: string } | undefined;

/**
 * Read by `combatPower`: T2 Sore Loser, T10 Late Bloomer, T14 Sharp Elbows,
 * T16 Short Fuse, K2 feinting and S1 Rallying.
 */
export function audit14PowerHooks(ctx: SimContext, t: Tribute, opponent?: Tribute): number {
    let power = 0;
    const day = ctx.state.day ?? 1;
    if (opponent && isSoreLoser(t) && t.lastDamage?.sourceId === opponent.id) power += C.soreLoserEdge;
    if (isLateBloomer(t)) {
        if (day <= C.lateBloomerEarlyDay) power -= C.lateBloomerEarlyPower;
        else if (day >= C.lateBloomerLateDay) power += C.lateBloomerLatePower;
    }
    if (hasSharpElbows(t) && ctx.state.phase === 'bloodbath') power += C.sharpElbowsHornPower;
    // T16: the one who did not start it, once the other side has drawn blood.
    if (opponent && hasShortFuse(t) && currentFight?.defender === t.id && t.lastDamage?.sourceId === opponent.id) {
        power += C.shortFusePower;
    }
    if (opponent) power += profOf(t, 'feinting') * C.feintingPowerPerLevel;
    if (t.stance === 'Rallying') {
        const arrived = getAlive(ctx.state).filter(o => o.id !== t.id && o.zone === t.zone && allied(o, t)).length;
        power += arrived * C.rallyingPowerPerAlly;
    }
    return power;
}

/** What `beforeFight` noted about the fight, for `afterFight`. */
interface FightNote {
    health: [number, number];
    fled: [number, number];
    bets: Array<{ gambler: Tribute; on: Tribute; underdog: boolean }>;
}

/** The Gambler's own reading of who wins a fight (the self-wager's `worth`). */
function worth(x: Tribute): number {
    return x.health + x.attributes.strength * 5 + x.attributes.agility * 3
        + (x.inventory.some(i => i.type === 'weapon') ? 20 : 0);
}

/** Called by `resolveCombat` before a fight: bets are placed, the room is read. */
export function beforeFight(ctx: SimContext, a: Tribute, b: Tribute, bloodbath: boolean): FightNote {
    currentFight = { opener: a.id, defender: b.id };
    const bets: FightNote['bets'] = [];
    // A35: a Gambler watching two people who are not on the same side.
    if (!bloodbath && !allied(a, b)) {
        getAlive(ctx.state).forEach(g => {
            if (g.archetype !== 'gambler' || g.id === a.id || g.id === b.id || g.zone !== a.zone || !isActive(g)) return;
            if (!ctx.rng.chance(C.sideBetChance)) return;
            const favourite = worth(a) >= worth(b) ? a : b;
            // A Gambler bets on the underdog when they can read them better.
            const underdog = favourite === a ? b : a;
            const on = getRel(g, underdog.id) > getRel(g, favourite.id) ? underdog : favourite;
            bets.push({ gambler: g, on, underdog: on === underdog });
        });
    }
    return {
        health: [a.health, b.health],
        fled: [ensureMemory(a).rivals[b.id]?.timesFled ?? 0, ensureMemory(b).rivals[a.id]?.timesFled ?? 0],
        bets,
    };
}

/**
 * Called by `resolveCombat` after a fight. Who won, who ran, and what follows:
 * A35 the side bet, S2 a blood trail to follow, S3 the loser's withdrawal, K2
 * feinting (a fight won without a kill), P3 the Scrapper's first fight.
 */
export function afterFight(ctx: SimContext, a: Tribute, b: Tribute, note: FightNote) {
    currentFight = undefined;
    const cycle = cycleOf(ctx.state);
    const out = (x: Tribute) => x.status !== 'alive' || isDowned(x);
    const ranA = (ensureMemory(a).rivals[b.id]?.timesFled ?? 0) > note.fled[0];
    const ranB = (ensureMemory(b).rivals[a.id]?.timesFled ?? 0) > note.fled[1];
    const lostA = note.health[0] - a.health;
    const lostB = note.health[1] - b.health;
    let winner: Tribute | undefined;
    if (out(b) && !out(a)) winner = a;
    else if (out(a) && !out(b)) winner = b;
    else if (ranB && !ranA) winner = a;
    else if (ranA && !ranB) winner = b;
    else if (lostA !== lostB) winner = lostA < lostB ? a : b;
    const loser = winner === a ? b : winner === b ? a : undefined;

    [[a, b, ranA, lostA], [b, a, ranB, lostB]].forEach(([x, y, ran, lost]) => {
        const me = x as Tribute, them = y as Tribute;
        if (me.status !== 'alive') return;
        // S3: lost the exchanges and still standing.
        if (loser === me && (lost as number) > 0) me.lostFightAt = cycle;
        // S2: the other one ran from this, bleeding.
        if (ran === false && (them.status === 'alive') && winner === me
            && (a === me ? ranB : ranA) && (them.injuries.bleeding || them.health < C.trailingQuarryHealth)) {
            me.quarryFled = { id: them.id, cycle };
        }
        // S3 / S2: the fight's own ending picks the posture — the one who got
        // clear hurt is withdrawing; the one who watched them go, bleeding,
        // may go after them. Reactions, like the break-off Evasive in a brawl.
        if (ran && me.health < C.retreatingHealth && isActive(me) && me.stance !== 'Desperate') {
            forceStance(me, 'Retreating', 'lost the fight and is getting clear', true);
        } else if (me.quarryFled?.id === them.id && me.quarryFled.cycle === cycle && isActive(me)
            && me.health >= C.retreatingHealth && ctx.rng.chance(C.trailingForceChance)) {
            forceStance(me, 'BloodTrailing', 'following the blood', true);
        }
        // K2: won it without finishing it.
        if (winner === me && them.status === 'alive') trainProficiency(me, 'feinting', ctx, C.feintingTrainShare);
        // P3: stood through a first fight.
        if (me.interviewStrategy === 'The Scrapper') me.scrapperStood = true;
    });

    // A35: the Gambler's side bet pays out on the result.
    if (winner) {
        note.bets.forEach(({ gambler, on, underdog }) => {
            if (gambler.status !== 'alive') return;
            const right = on.id === winner!.id;
            if (!right) return;
            addExcitement(gambler, C.sideBetExcitement);
            if (!gambler.signatureFired) gambler.signatureFired = true;
            ctx.logEvent(
                underdog
                    ? `${gambler.name} said out loud, before it started, that ${on.name} would take it. Nobody in ${gambler.zone} believed them. Somewhere a sponsor pays up.`
                    : `${gambler.name} called ${on.name} before the first blow landed, and was right. It is the only fight in ${gambler.zone} today that made anybody money.`,
                [gambler.id, on.id],
                { type: 'gambler-side-bet', important: underdog, category: 'combat', zone: gambler.zone },
            );
            if (underdog) {
                const gift = ctx.rng.pickOrUndefined(ITEMS.filter(i => i.type === 'medical' || i.type === 'food'));
                if (gift) dropParachute(ctx, gambler, mintItem(ctx.rng, gift));
            }
        });
    }
}

/**
 * Called by `landHit` on a blow that landed: K1 poisoncraft, K3 disarming (and
 * Q6 the boot knife that answers it).
 */
export function afterLandedHit(ctx: SimContext, attacker: Tribute, defender: Tribute, weapon?: Item) {
    if (defender.status !== 'alive' || isDowned(defender)) return;
    // K1: a poisoner's coat takes where a careless one would not.
    if (weapon?.poison && !defender.injuries.poisoned && profOf(attacker, 'poisoncraft') > 0
        && ctx.rng.chance(profOf(attacker, 'poisoncraft') * C.poisoncraftPerLevel)) {
        defender.injuries.poisoned = true;
        defender.poisonedByWeapon = true;
    }
    // K3: an unarmed hand on an armed one is how disarming is learned.
    const theirs = defender.inventory.filter(i => i.type === 'weapon' && !i.keepsake);
    if (theirs.length === 0) return;
    if (!weapon) trainProficiency(attacker, 'disarming', undefined, C.disarmUnarmedShare);
    const level = profOf(attacker, 'disarming');
    if (level <= 0 || !ctx.rng.chance(level * C.disarmPerLevel)) return;
    const best = theirs.reduce((m, i) => ((i.damage ?? 0) > (m.damage ?? 0) ? i : m));
    defender.inventory = defender.inventory.filter(i => i !== best);
    const dropped = giveItem(attacker, best);
    trainProficiency(attacker, 'disarming', ctx);
    ctx.logEvent(
        dropped.includes(best)
            ? `${attacker.name} twists the ${best.name} out of ${defender.name}'s hand and flings it away into ${attacker.zone}.`
            : `${attacker.name} twists the ${best.name} out of ${defender.name}'s hand and keeps it.`,
        [attacker.id, defender.id],
        { category: 'combat', zone: attacker.zone },
    );
    // Q6: and the boot knife comes out, once.
    if (quirk(defender, 'hides a blade in their boot') && !defender.bootBladeUsed && ctx.rng.chance(C.bootBladeChance)) {
        defender.bootBladeUsed = true;
        const knife = ITEMS.find(i => i.id === 'knife' && i.type === 'weapon');
        if (knife) {
            giveItem(defender, mintItem(ctx.rng, knife));
            ctx.logEvent(`${defender.name} is not unarmed for long: there was a knife in the boot the whole time.`,
                [defender.id], { category: 'combat', zone: defender.zone });
        }
    }
}

/** Read by the retreat roll: S3 Retreating breaks off sooner; P3 a Scrapper stands the first fight. */
export function audit14RetreatShift(t: Tribute): number {
    let shift = 0;
    if (t.stance === 'Retreating') shift += C.retreatingRetreat;
    if (t.interviewStrategy === 'The Scrapper' && !t.scrapperStood) shift -= C.scrapperRetreat;
    return shift;
}

/** Read by the parting-shot roll: T8 a Rearguard ally covers the one breaking off. */
export function rearguardCover(ctx: SimContext, fleer: Tribute): number {
    const cover = getAlive(ctx.state).some(o => o.id !== fleer.id && o.zone === fleer.zone && allied(o, fleer)
        && isActive(o) && isRearguard(o));
    return cover ? 1 - C.rearguardCover : 1;
}

/** Read by `executeDrive`: S2 somebody on a blood trail finishes it. */
export function audit14ExecuteDrive(t: Tribute): number {
    return t.stance === 'BloodTrailing' ? C.trailingExecute : 0;
}

/**
 * Read by `rollAmbush`: T8 a Rearguard is the first one an ambush finds, S2 a
 * blood trail leads into one, and R6 a Nightwarden turns the first one of the
 * night aside. Returns `undefined` when the ambush is refused outright.
 */
export function audit14AmbushShift(ctx: SimContext, attacker: Tribute, defender: Tribute): number | undefined {
    const cycle = cycleOf(ctx.state);
    const dark = ctx.state.timeOfDay === 'night' || ctx.state.phase === 'night';
    if (dark) {
        const warden = getAlive(ctx.state).find(o => o.archetype === 'nightwarden' && o.zone === defender.zone
            && o.id !== defender.id && allied(o, defender) && isActive(o) && o.wardenHeldAt !== cycle);
        if (warden) {
            warden.wardenHeldAt = cycle;
            warden.wardenHeld = (warden.wardenHeld ?? 0) + 1;
            ctx.logEvent(
                `${attacker.name} comes for ${defender.name} in the dark and finds ${warden.name} already on their feet between them.`,
                [warden.id, attacker.id, defender.id],
                { category: 'combat', zone: defender.zone },
            );
            return undefined;
        }
    }
    let shift = 0;
    if (isRearguard(defender)) shift += C.rearguardAmbushed;
    if (defender.stance === 'BloodTrailing') shift += C.trailingAmbushed;
    return shift;
}

/**
 * The Games day, as last seen by the per-cycle pass. `targetDrawOf` is a pure
 * read of a tribute with no state to hand, and T14's draw is a day-one fact.
 */
let gamesDay = 1;

/** Read by `targetDrawOf`: T14 Sharp Elbows on day one, S1 a rally call, R5 a loaded Smuggler. */
export function audit14TargetDraw(t: Tribute): number {
    let draw = 0;
    if (hasSharpElbows(t) && gamesDay <= 1) draw += C.sharpElbowsDayOneDraw;
    if (t.stance === 'Rallying') draw += C.rallyingDraw;
    if (t.smugglingUntil !== undefined) draw += C.smuggleDraw;
    return draw;
}

// ---------------------------------------------------------------------------
// Damage, infection, noise, exposure, rescue, mutts
// ---------------------------------------------------------------------------

/** Read by `applyDamage`: T13 Iron Lungs against the arena's non-burn hazards; K6 bracing against falls and collapses. */
export function audit14DamageScale(ctx: SimContext, t: Tribute, kind: string, code: string | undefined): number {
    let scale = 1;
    const arena = kind === 'arena' || kind === 'hazard' || kind === 'gamemaker';
    if (hasIronLungs(t) && arena && code !== 'burns') scale *= C.ironLungsScale;
    if (code === 'fall' || code === 'collapse' || code === 'impact' || code === 'crush') {
        scale *= Math.max(C.bracingFloor, 1 - profOf(t, 'bracing') * C.bracingPerLevel);
        if (t.health > 0) trainProficiency(t, 'bracing', ctx, C.bracingTrainShare);
    }
    return scale;
}

/** Read by `infectionChance`: T7 Fever-Proof. */
export function feverProofScale(t: Tribute): number {
    return isFeverProof(t) ? C.feverProofInfectionScale : 1;
}

/** Read by `crossingNoise`: T12 Soft Step. */
export function softStepNoise(t: Tribute): number {
    return hasSoftStep(t) ? C.softStepNoiseScale : 1;
}

/** Read by `exposureScale`: K4 shelterwright. */
export function shelterwrightScale(t: Tribute): number {
    return Math.max(0.5, 1 - profOf(t, 'shelterwright') * C.shelterwrightPerLevel);
}

/** Read by `shelterSkill`: K4 shelterwright makes Sheltering reachable. */
export function shelterwrightSkill(t: Tribute): number {
    return profOf(t, 'shelterwright') * C.shelterwrightSkillPerLevel;
}

/** Read by `rescueChance`: K5 triage. */
export function triageBonus(t: Tribute): number {
    return profOf(t, 'triage') * C.triagePerLevel;
}

/** Read by the rescue attempt on a downed ally: K5 triage trains on it. */
export function noteTriage(ctx: SimContext, rescuer: Tribute) {
    trainProficiency(rescuer, 'triage', ctx);
}

/** Read by the persistent mutt's re-attack roll: K7 scentcraft. */
export function scentcraftScale(t: Tribute): number {
    return Math.max(0.5, 1 - profOf(t, 'scentcraft') * C.scentcraftPerLevel);
}

/** Read by `poisonWeapon` on a coat that took: K1 poisoncraft trains. */
export function notePoisoncraft(ctx: SimContext, t: Tribute) {
    trainProficiency(t, 'poisoncraft', ctx);
}

/** Read by the survival drain: A37 Drowned Once goes thirsty away from water. */
export function audit14ThirstDrain(state: SimContext['state'], t: Tribute): number {
    if (!drownedOnce(t)) return 0;
    const zone = getZone(state.arena, t.zone);
    const wet = (z?: Zone) => z?.terrain === 'water' || z?.terrain === 'wetland';
    if (wet(zone) || (zone?.adjacent ?? []).some(n => wet(getZone(state.arena, n)))) return 0;
    return C.drownedDryThirst;
}

// ---------------------------------------------------------------------------
// K8 caching
// ---------------------------------------------------------------------------

/**
 * Read by `enforceCapacity`: what would be dropped is buried instead, by
 * somebody who knows how. Every overflow is a lesson in it.
 */
export function buryOverflow(t: Tribute, dropped: Item[]): Item[] {
    if (dropped.length === 0) return dropped;
    trainProficiency(t, 'caching', undefined, C.cacheTrainShare);
    if (profOf(t, 'caching') < C.cacheLevel) return dropped;
    if (t.cache && t.cache.zone !== t.zone) return dropped;
    const cache = t.cache ?? { zone: t.zone, items: [] };
    const room = C.cacheMax - cache.items.length;
    if (room <= 0) return dropped;
    const buried = dropped.filter(i => i.type !== 'weapon').slice(0, room);
    if (buried.length === 0) return dropped;
    cache.items.push(...buried);
    t.cache = cache;
    return dropped.filter(i => !buried.includes(i));
}

function retrieveCache(ctx: SimContext, t: Tribute) {
    const cache = t.cache!;
    const room = Math.max(0, carryRoom(t));
    if (room === 0) return;
    const taken = cache.items.splice(0, room);
    if (cache.items.length === 0) t.cache = undefined;
    if (taken.length === 0) return;
    giveItem(t, ...taken);
    trainProficiency(t, 'caching', ctx);
    ctx.logEvent(`${t.name} digs up what they buried in ${t.zone}: ${taken.map(i => i.name).join(', ')}. Nobody else found it.`,
        [t.id], { category: 'loot', zone: t.zone });
}

function carryRoom(t: Tribute): number {
    return carryCapacity(t) - t.inventory.length;
}

// ---------------------------------------------------------------------------
// Stances S1-S3
// ---------------------------------------------------------------------------

/** People of theirs who are elsewhere. */
function separated(state: SimContext['state'], t: Tribute): Tribute[] {
    return state.tributes.filter(o => o.status === 'alive' && o.id !== t.id && allied(o, t) && o.zone !== t.zone);
}

/**
 * S1's precondition: some of the group is elsewhere, and this is where the
 * rest of it is — the leader, or anybody standing with at least one ally
 * while the others are out there. The hub calls the stragglers in.
 */
export function rallyingAvailable(ctx: SimContext, t: Tribute): boolean {
    if (!t.allianceId) return false;
    if (separated(ctx.state, t).length === 0) return false;
    if (allianceOf(ctx.state, t.allianceId)?.leaderId === t.id) return true;
    return ctx.state.tributes.some(o => o.status === 'alive' && o.id !== t.id && o.zone === t.zone && allied(o, t));
}

export function rallyingScore(ctx: SimContext, t: Tribute): number {
    return C.rallyingBase + Math.min(3, separated(ctx.state, t).length) * C.rallyingPerSeparated;
}

/** S2's precondition: somebody ran from them last cycle, hurt, and is a zone away at most. */
export function trailingQuarry(ctx: SimContext, t: Tribute): Tribute | undefined {
    const q = t.quarryFled;
    if (!q || cycleOf(ctx.state) - q.cycle > C.trailingWindow) return undefined;
    const quarry = ctx.state.tributes.find(o => o.id === q.id);
    if (!quarry || !isActive(quarry) || allied(quarry, t)) return undefined;
    if (quarry.zone === t.zone) return quarry;
    const here = getZone(ctx.state.arena, t.zone);
    return (here?.adjacent ?? []).includes(quarry.zone) ? quarry : undefined;
}

/** S3's precondition: lost the last fight, hurt, and somewhere to go. */
export function retreatingAvailable(ctx: SimContext, t: Tribute): boolean {
    if (t.lostFightAt === undefined || cycleOf(ctx.state) - t.lostFightAt > C.retreatingWindow) return false;
    if (t.health >= C.retreatingHealth) return false;
    const collapsed = ctx.state.collapsedZones ?? [];
    return reachableZones(ctx.state.arena, t.zone, collapsed, severedEdgeSet(ctx.state)).some(z => z.name !== t.zone);
}

/** Read by `move`: Rallying stands where the group can find them. */
export function holdsGround(t: Tribute): boolean {
    return t.stance === 'Rallying';
}

/** Read by `move`: a blood trail and a withdrawal are walked, not wandered. */
export function mustMove(t: Tribute): boolean {
    return t.stance === 'BloodTrailing' || t.stance === 'Retreating';
}

/**
 * Read by the destination scorer: S1 a rally pulls the group in, S2 the blood
 * trail, S3 away from the last fight; A34 the Hermit's empty ground; §3 T12 a
 * ward walks back to their elder.
 */
export function audit14DestinationScore(ctx: SimContext, t: Tribute, z: Zone): number {
    const state = ctx.state;
    let score = 0;
    const rallier = state.tributes.find(o => o.status === 'alive' && o.id !== t.id && o.stance === 'Rallying' && allied(o, t));
    if (rallier && rallier.zone === z.name) score += C.rallyingPull;
    if (t.stance === 'BloodTrailing') {
        const quarry = trailingQuarry(ctx, t);
        if (quarry && quarry.zone === z.name) score += C.trailingPull;
    }
    if (t.stance === 'Retreating') {
        const last = t.quarryFled?.id;
        score += z.name !== t.zone ? C.retreatingPull : -C.retreatingPull;
        if (last && state.tributes.some(o => o.id === last && o.zone === z.name)) score -= C.retreatingPull;
    }
    const elder = t.relationsArc?.wardOf ? state.tributes.find(o => o.id === t.relationsArc!.wardOf && o.status === 'alive') : undefined;
    if (elder && elder.zone === z.name && elder.zone !== t.zone) score += C.wardPull;
    return score;
}

/** Read by the forage roll: S3 Retreating does not stop to look for food. */
export function noForage(t: Tribute): boolean {
    return t.stance === 'Retreating';
}

// ---------------------------------------------------------------------------
// A34: the Hermit's isolate objective
// ---------------------------------------------------------------------------

/** The emptiest ground the Hermit knows of within reach, if it is emptier than here. */
export function isolationZone(ctx: SimContext, t: Tribute): string | undefined {
    const state = ctx.state;
    const company = state.tributes.filter(o => o.status === 'alive' && o.id !== t.id && o.zone === t.zone && !allied(o, t)).length;
    if (company < C.isolateCrowd) return undefined;
    const collapsed = state.collapsedZones ?? [];
    const severed = severedEdgeSet(state);
    let best: { zone: string; crowd: number } | undefined;
    state.arena.zones.forEach(z => {
        if (z.name === t.zone || collapsed.includes(z.name)) return;
        const hops = hopsTo(state.arena, t.zone, z.name, collapsed, severed);
        if (hops === undefined || hops > C.isolateHops) return;
        const crowd = rememberedRivals(state, t, z.name) + hops * C.isolatePerHop;
        if (!best || crowd < best.crowd) best = { zone: z.name, crowd };
    });
    const found = best as { zone: string; crowd: number } | undefined;
    return found && found.crowd < company ? found.zone : undefined;
}

// ---------------------------------------------------------------------------
// Pilgrim (signature table): the landmark is within reach of the plate
// ---------------------------------------------------------------------------

/** Read by `pickLandmark`: zones no more than a couple of hops from where they stand. */
export function nearLandmarks(state: SimContext['state'], t: Tribute, zones: string[]): string[] {
    const collapsed = state.collapsedZones ?? [];
    const severed = severedEdgeSet(state);
    const near = zones.filter(z => (hopsTo(state.arena, t.zone, z, collapsed, severed) ?? 99) <= C.pilgrimLandmarkHops);
    return near.length > 0 ? near : zones;
}

// ---------------------------------------------------------------------------
// Personas P1-P4
// ---------------------------------------------------------------------------

/** Read by the per-cycle sponsor drift: P1 The Outsider, while the Careers lead. */
export function outsiderSponsor(state: SimContext['state'], t: Tribute): number {
    if (t.interviewStrategy !== 'The Outsider' || t.isCareer) return 0;
    const alive = state.tributes.filter(o => o.status === 'alive');
    const careers = alive.filter(o => o.isCareer).length;
    return careers * 2 >= alive.length && careers > 0 ? C.outsiderSponsor : 0;
}

/** Read by alliance formation: P1 an Outsider is an easy yes for somebody else outside. */
export function outsiderPull(a: Tribute, b: Tribute): number {
    const one = (x: Tribute, y: Tribute) => x.interviewStrategy === 'The Outsider' && !y.isCareer;
    return one(a, b) || one(b, a) ? C.outsiderAlliance : 0;
}

/** Read by `addExcitement`: P2 The Showboat plays to the crowd. */
export function showboatExcitement(t: Tribute): number {
    return t.interviewStrategy === 'The Showboat' ? C.showboatExcitement : 0;
}

/** Called on a kill: P2 the Showboat's first one is paid double. */
export function noteShowboatKill(killer: Tribute, excitement: number) {
    if (killer.interviewStrategy !== 'The Showboat' || killer.showboatPaid) return;
    killer.showboatPaid = true;
    addExcitement(killer, excitement * (C.showboatFirstKillScale - 1));
    killer.sponsorTrust = Math.min(100, killer.sponsorTrust + excitement * (C.showboatFirstKillScale - 1) / 2);
}

/** Read by the rumour plant roll: P4 The Oracle's first rumours are believed. */
export function oracleCredibility(t: Tribute): number {
    return t.interviewStrategy === 'The Oracle' && (t.oracleTold ?? 0) < C.oracleRumours ? C.oracleCredibility : 0;
}

/** Called when a rumour is planted. */
export function noteOracleTold(t: Tribute) {
    if (t.interviewStrategy === 'The Oracle') t.oracleTold = (t.oracleTold ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// §7 R1-R6 archetype signatures (registered in `archetypeHooks.SIGNATURES`)
// ---------------------------------------------------------------------------

/** R1 Cutpurse: something of a sleeping or distracted tribute's, gone. */
export function liftPurse(ctx: SimContext, t: Tribute): boolean {
    const night = ctx.state.phase === 'night' || ctx.state.timeOfDay === 'night';
    const distracted = (o: Tribute) => ['Mourning', 'Sheltering', 'Nursing', 'Tending', 'Hiding'].includes(o.stance);
    const marks = getAlive(ctx.state).filter(o => o.id !== t.id && o.zone === t.zone && isActive(o) && !allied(o, t)
        && (night || distracted(o)) && o.inventory.some(i => !i.keepsake)
        // Q3: whoever sleeps on their pack is not robbed asleep.
        && !(night && quirk(o, 'sleeps under their pack')));
    const mark = ctx.rng.pickOrUndefined(marks);
    if (!mark) return false;
    const wake = C.liftWakeBase + profOf(mark, 'vigilance') * C.liftWakePerVigilance
        + (sleepsLight(mark) ? C.liftWakeBase : 0);
    if (ctx.rng.chance(wake)) {
        ctx.logEvent(`${t.name}'s hand is in ${mark.name}'s pack in ${t.zone} when ${mark.name}'s eyes open.`,
            [t.id, mark.id], { type: 'cutpurse-lift', important: true, category: 'combat', zone: t.zone });
        resolveCombat(ctx, mark, t);
        return true;
    }
    const item = mark.inventory.filter(i => !i.keepsake).reduce((m, i) => (i.value > m.value ? i : m));
    mark.inventory = mark.inventory.filter(i => i !== item);
    giveItem(t, item);
    trainProficiency(t, 'caching', ctx);
    ctx.logEvent(`${t.name} passes close by ${mark.name} in ${t.zone} and walks on carrying their ${item.name}. ${mark.name} will not notice until later.`,
        [t.id, mark.id], { type: 'cutpurse-lift', important: true, category: 'loot', zone: t.zone });
    return true;
}

/** R2 Undertaker: a body buried, read, and its killer known. */
export function lastRites(ctx: SimContext, t: Tribute): boolean {
    const body = ctx.state.tributes.find(o => o.status === 'dead' && o.zone === t.zone
        && getMark(ctx.state, `a14buried:${o.id}`) !== 1);
    if (!body) return false;
    setMark(ctx.state, `a14buried:${body.id}`, 1);
    t.vitals.sanity = Math.min(100, t.vitals.sanity + C.lastRitesSanity);
    t.sponsorTrust = Math.min(100, t.sponsorTrust + C.lastRitesSponsor);
    trainProficiency(t, 'triage', ctx);
    const killer = body.lastDamage?.sourceId ? ctx.state.tributes.find(o => o.id === body.lastDamage!.sourceId && o.status === 'alive') : undefined;
    if (killer && killer.id !== t.id) {
        noteRivalSighting(t, killer.id, ctx.state, killer);
        improveRead(t, killer.id, C.lastRitesRead);
        if (getRel(t, body.id) > 0 && !allied(killer, t)) swearVengeance(t, killer.id);
    }
    ctx.logEvent(
        killer && killer.id !== t.id
            ? `${t.name} buries ${body.name} in ${t.zone}, properly, and reads the wounds while doing it. They know whose work it was: ${killer.name}.`
            : `${t.name} buries ${body.name} in ${t.zone}, properly, and says the words their district says. The cameras stay on it longer than they need to.`,
        killer ? [t.id, body.id, killer.id] : [t.id, body.id],
        { type: 'last-rites', important: true, category: 'survival', zone: t.zone },
    );
    return true;
}

/** R3 Poacher: a snare that catches a person. Lays one first if they have none out. */
export function snareHunt(ctx: SimContext, t: Tribute): boolean {
    const here = getZone(ctx.state.arena, t.zone);
    const ground = new Set([t.zone, ...(here?.adjacent ?? [])]);
    const lines = (ctx.state.traps ?? []).filter(tr => tr.ownerId === t.id && ground.has(tr.zone));
    if (lines.length === 0) {
        ctx.state.traps = ctx.state.traps ?? [];
        ctx.state.traps.push({ id: `snare-${t.id}-${cycleOf(ctx.state)}`, kind: 'snare', zone: t.zone, ownerId: t.id,
            concealment: C.snareConcealment, setCycle: cycleOf(ctx.state) });
        return false;
    }
    const zones = new Set(lines.map(l => l.zone));
    const quarry = ctx.rng.pickOrUndefined(getAlive(ctx.state).filter(o => o.id !== t.id && zones.has(o.zone) && isActive(o)
        && !allied(o, t) && !isTrapwise(o) && profOf(o, 'tracking') < C.snareTrackerLevel));
    if (!quarry) return false;
    const line = lines.find(l => l.zone === quarry.zone)!;
    ctx.state.traps = (ctx.state.traps ?? []).filter(tr => tr !== line);
    // Downs, never kills: the snare holds them for whoever comes.
    const damage = Math.min(C.snareDamage, Math.max(0, quarry.health - 1));
    quarry.health -= damage;
    quarry.injuries.legs = true;
    clampTribute(quarry);
    trainProficiency(t, 'scentcraft', ctx);
    ctx.logEvent(`${quarry.name} walks the trail through ${quarry.zone} and the ground takes their leg out from under them. It is ${t.name}'s snare, and it was set for somebody exactly their size.`,
        [t.id, quarry.id], { type: 'snare-hunt', important: true, category: 'combat', zone: quarry.zone });
    return true;
}

/** R4 Tinker: a broken weapon mended, or junk made into one that will not last. */
export function juryRig(ctx: SimContext, t: Tribute): boolean {
    const worn = t.inventory.find(i => i.type === 'weapon' && i.durability !== undefined && i.maxDurability !== undefined
        && i.durability < i.maxDurability * C.juryRigDurability);
    if (worn) {
        worn.durability = worn.maxDurability;
        trainProficiency(t, 'shelterwright', ctx);
        ctx.logEvent(`${t.name} sits in ${t.zone} with the ${worn.name} across their knees and a length of wire, and when they stand up it is whole again.`,
            [t.id], { type: 'jury-rig', important: true, category: 'loot', zone: t.zone });
        return true;
    }
    if (t.inventory.some(i => i.type === 'weapon')) return false;
    const junk = t.inventory.find(i => (i.type === 'utility' || i.type === 'tool') && !i.keepsake);
    if (!junk) return false;
    const def = ctx.rng.pickOrUndefined(IMPROVISED_ITEMS.filter(i => i.type === 'weapon'));
    if (!def) return false;
    const made = mintItem(ctx.rng, def);
    // Crude: it breaks at twice the rate.
    if (made.durability !== undefined) made.durability = Math.max(1, Math.round(made.durability * C.juryRigDurability));
    t.inventory = t.inventory.filter(i => i !== junk);
    giveItem(t, made);
    trainProficiency(t, 'crafting', ctx);
    ctx.logEvent(`${t.name} takes the ${junk.name} apart in ${t.zone} and puts it back together as a ${made.name}. It will not last. It does not have to.`,
        [t.id], { type: 'jury-rig', important: true, category: 'loot', zone: t.zone });
    return true;
}

/** R5 Smuggler: carries something to an ally who needs it, and the sponsors pay the carrier. */
export function runGoods(ctx: SimContext, t: Tribute): boolean {
    const collapsed = ctx.state.collapsedZones ?? [];
    const severed = severedEdgeSet(ctx.state);
    const goods = t.inventory.filter(i => !i.keepsake && (i.type === 'food' || i.type === 'water' || i.type === 'medical'));
    if (goods.length === 0) return false;
    const client = getAlive(ctx.state).find(o => o.id !== t.id && isActive(o) && o.zone !== t.zone
        && (allied(o, t) || getRel(t, o.id) > 0)
        && (hopsTo(ctx.state.arena, t.zone, o.zone, collapsed, severed) ?? 99) <= C.smuggleHops
        && goods.some(g => !o.inventory.some(i => i.type === g.type)));
    if (!client) return false;
    const parcel = goods.find(g => !client.inventory.some(i => i.type === g.type))!;
    t.inventory = t.inventory.filter(i => i !== parcel);
    giveItem(client, parcel);
    t.sponsorTrust = Math.min(100, t.sponsorTrust + C.smuggleCut);
    addExcitement(t, C.smuggleCut);
    t.smugglingUntil = cycleOf(ctx.state) + C.smuggleCycles;
    adjustRel(client, t.id, C.smuggleRegard);
    ctx.logEvent(`${t.name} crosses into ${client.zone} with ${parcel.name} for ${client.name}, and the Capitol, which loves a middleman, pays them for the trip.`,
        [t.id, client.id], { type: 'run-goods', important: true, category: 'alliance', zone: client.zone });
    return true;
}

/** R6 Nightwarden: the watch has turned a knife aside at least once. */
export function holdTheLine(ctx: SimContext, t: Tribute): boolean {
    if ((t.wardenHeld ?? 0) === 0) return false;
    t.sponsorTrust = Math.min(100, t.sponsorTrust + C.wardenSponsor);
    ctx.logEvent(`The footage of ${t.name} standing up in the dark between a knife and a sleeping ally is played in every district that night.`,
        [t.id], { type: 'hold-the-line', important: true, category: 'alliance', zone: t.zone });
    return true;
}

/** The new skills, for the training-floor and the tribute sheet. */
export const AUDIT14_SKILLS: Proficiency[] = ['poisoncraft', 'feinting', 'disarming', 'shelterwright', 'triage', 'bracing', 'scentcraft', 'caching'];

/** Read by `declareTruce` / `grantTruce`: T16 a Short Fuse keeps a truce one cycle less. */
export function shortFuseTruce(a: Tribute, b: Tribute): number {
    return (hasShortFuse(a) || hasShortFuse(b)) ? 1 : 0;
}
