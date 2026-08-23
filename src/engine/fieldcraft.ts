import { Item, Tribute, Trap } from '../models/types';
import { BLEEDING, CRAFTING, EARNED_TRAIT_RULES, ENDGAME, HUNTING, POISONING, TRAPS, STANCE_MODES } from '../data/balance';
import { SimContext } from './context';
import { applyDamage, checkDeath } from './combat';
import { addZoneThreat, cycleOf, rattle } from './memory';
import { endgameEdge } from './objectives';
import { getZone, zoneFeatures } from './map';
import { hasEffect } from './zoneEffects';
import { clampTribute } from './vitals';
import { injure, openWound } from './wounds';
import { arenaHasLaw } from './gamesProfile';
import { profOf, trainProficiency } from './proficiency';
import { earnTrait } from './earnedTraits';
import { awareness } from './stealth';
import { traitMod } from '../data/traits';
import { conditionOf, consumeOne, hasTool } from './items';
import { isAggressiveStance, isEvasiveStance } from '../data/stances';

/**
 * Fieldcraft: traps, fire, shelter, camouflage and poison.
 *
 * `craft()` supported two recipes and nothing else. There was no snare, no
 * deadfall, no fire despite matches existing and warding cold, no shelter, no
 * water purification despite the Toxic Swamps' whole premise being undrinkable
 * water, no poison application and no camouflage. The Trickster archetype's
 * `treachery: 0.35` had exactly one mechanical expression in the entire
 * simulation.
 *
 * Traps are the important addition. A trap is the only thing in the arena that
 * keeps working while its owner is somewhere else — it turns preparation into a
 * verb, which is what the scheming archetypes were missing.
 */

/** Cover hides a snare; open ground does not. */
function concealmentFor(ctx: SimContext, t: Tribute): number {
    const zone = getZone(ctx.state.arena, t.zone);
    let concealment = TRAPS.baseConcealment + t.attributes.intelligence * TRAPS.concealmentPerIntelligence;
    if (zone?.terrain === 'forest' || zone?.terrain === 'wetland' || zone?.terrain === 'ruins') {
        concealment += TRAPS.coverConcealmentBonus;
    }
    if (zone?.terrain === 'open') concealment -= TRAPS.openConcealmentPenalty;
    return Math.max(0.05, Math.min(TRAPS.maxConcealment, concealment));
}

export function trapsIn(ctx: SimContext, zone: string): Trap[] {
    return (ctx.state.traps ?? []).filter(tr => tr.zone === zone);
}

function trapsOwnedBy(ctx: SimContext, ownerId: string): Trap[] {
    return (ctx.state.traps ?? []).filter(tr => tr.ownerId === ownerId);
}

/** Whether spending this turn setting a trap is a sensible use of it. */
export function wantsToSetTrap(ctx: SimContext, t: Tribute): boolean {
    if (trapsOwnedBy(ctx, t.id).length >= TRAPS.maxPerTribute) return false;
    // Needs something to build with, or the wit to manage without.
    const hasMaterial = t.inventory.some(i => i.id === 'rope' || i.id === 'wire');
    if (!hasMaterial && t.attributes.intelligence < 6) return false;
    if (t.injuries.bleeding) return false;
    // §3.3: a tribute who has concluded they lose a straight fight turns to
    // the indirect game — the stance gate no longer applies to them.
    const field = ctx.state.tributes.filter(o => o.status === 'alive').length;
    const losing = field <= ENDGAME.fieldSize && endgameEdge(ctx.state, t) < ENDGAME.underdogEdge;
    // Otherwise: a tribute set on hunting has more urgent problems.
    if (isAggressiveStance(t.stance) && !losing) return false;
    return true;
}

/** Spends the turn setting a snare or a deadfall in the tribute's current zone. */
export function setTrap(ctx: SimContext, t: Tribute) {
    const materialIdx = t.inventory.findIndex(i => i.id === 'rope' || i.id === 'wire');
    // A deadfall needs weight to drop and cover to hide the trigger; a snare
    // needs a line. Without a line, only a deadfall is possible.
    const kind: Trap['kind'] = materialIdx >= 0 ? 'snare' : 'deadfall';

    let chance = TRAPS.buildBaseChance
        + t.attributes.intelligence * TRAPS.buildPerIntelligence
        + profOf(t, 'tracking') * TRAPS.buildPerTracking;
    if (t.archetype === 'trickster') chance += TRAPS.trickeryBonus;
    chance += traitMod(t, 'trapSkill');

    if (!ctx.rng.chance(Math.min(0.95, chance))) {
        ctx.logEvent(
            `${t.name} spends an hour on a ${kind} in ${t.zone} and ends up with a tangle of nothing.`,
            [t.id],
            { category: 'survival' }
        );
        return;
    }

    if (materialIdx >= 0) t.inventory.splice(materialIdx, 1);
    ctx.state.traps = ctx.state.traps ?? [];
    ctx.state.traps.push({
        id: `trap-${t.id}-${cycleOf(ctx.state)}-${ctx.state.traps.length}`,
        kind,
        zone: t.zone,
        ownerId: t.id,
        concealment: concealmentFor(ctx, t),
        setCycle: cycleOf(ctx.state),
    });
    trainProficiency(t, 'tracking');
    ctx.logEvent(
        kind === 'snare'
            ? `${t.name} sets a snare across a game trail in ${t.zone} and covers the line with leaf litter.`
            : `${t.name} balances a deadfall over a gap in ${t.zone} and backs away from it very carefully.`,
        [t.id],
        { category: 'survival' }
    );
}

/**
 * Checks a tribute against every trap in the zone they are standing in.
 *
 * Called after movement, so walking into a zone is what springs things. Owners
 * step over their own work; everyone else rolls awareness against concealment.
 */
export function checkTraps(ctx: SimContext, t: Tribute) {
    // A trap this tribute already found and chose to leave standing is a
    // known hazard they step around, not a fresh roll every cycle.
    const here = trapsIn(ctx, t.zone).filter(tr => tr.ownerId !== t.id && !(tr.knownBy ?? []).includes(t.id));
    if (here.length === 0) return;

    const trap = here[0];
    const owner = ctx.state.tributes.find(o => o.id === trap.ownerId);
    // Awareness is already the engine's "did you notice something you were not
    // meant to" roll — reusing it keeps spotting a tripline consistent with
    // spotting a person in cover.
    // A1: a Fortified owner has been tending their ground. Their traps are
    // better hidden and bite harder against anyone who walks onto it.
    const fortifiedOwner = owner?.status === 'alive' && owner.stance === 'Fortified' && owner.zone === trap.zone;
    const concealment = fortifiedOwner
        ? Math.min(0.95, trap.concealment * STANCE_MODES.fortified.trapTriggerMultiplier)
        : trap.concealment;
    const spotted = ctx.rng.chance(Math.max(0.05, Math.min(0.9, awareness(t) / 20)))
        && !ctx.rng.chance(concealment);

    if (spotted) {
        // §6.2: spotting it is a decision point, not an automatic dismantle.
        // Disarm it (and maybe set it off with your own hands), or leave it
        // standing and remember exactly where it is.
        const attemptsDisarm = ctx.rng.chance(TRAPS.attemptDisarmChance + traitMod(t, 'trapSkill'));
        if (attemptsDisarm) {
            let disarmChance = TRAPS.disarmBaseChance
                + t.attributes.intelligence * TRAPS.disarmPerIntelligence
                + profOf(t, 'tracking') * TRAPS.disarmPerTracking;
            if (t.archetype === 'trickster') disarmChance += TRAPS.trickeryBonus;
            if (ctx.rng.chance(Math.min(0.95, disarmChance))) {
                removeTrap(ctx, trap.id);
                trainProficiency(t, 'tracking');
                // §8.9: enough of other people's mechanisms and you start to
                // think in them.
                t.trapsDisarmed = (t.trapsDisarmed ?? 0) + 1;
                if (t.trapsDisarmed >= EARNED_TRAIT_RULES.trapwiseDisarms) earnTrait(ctx, t, 'Trapwise');
                ctx.logEvent(
                    `${t.name} stops dead in ${t.zone}, crouches, and pulls apart a ${trap.kind} someone left for them.`,
                    owner ? [t.id, owner.id] : [t.id],
                    { important: true, category: 'survival' }
                );
                return;
            }
            if (!ctx.rng.chance(TRAPS.failedDisarmTriggerChance)) {
                // Botched it without setting it off: they back away and leave
                // the thing armed, warier of the whole zone.
                trap.knownBy = [...(trap.knownBy ?? []), t.id];
                addZoneThreat(ctx.state, t, t.zone, TRAPS.knownTrapThreat);
                ctx.logEvent(
                    `${t.name} finds a ${trap.kind} in ${t.zone}, works at the mechanism, and thinks better of it. They leave it armed and give it a wide berth.`,
                    owner ? [t.id, owner.id] : [t.id],
                    { category: 'survival' }
                );
                return;
            }
            // Their own hands on the tripline: fall through to the trigger
            // below, having found it the hard way.
            ctx.logEvent(
                `${t.name} spots a ${trap.kind} in ${t.zone} and reaches in to disarm it. The mechanism has other ideas.`,
                owner ? [t.id, owner.id] : [t.id],
                { important: true, category: 'survival' }
            );
        } else {
            // Seen, avoided, remembered — via the same zone-memory system a
            // witnessed death writes to.
            trap.knownBy = [...(trap.knownBy ?? []), t.id];
            addZoneThreat(ctx.state, t, t.zone, TRAPS.knownTrapThreat);
            ctx.logEvent(
                `${t.name} reads the ground in ${t.zone}, steps around a ${trap.kind} without touching it, and files the spot away.`,
                owner ? [t.id, owner.id] : [t.id],
                { category: 'survival' }
            );
            return;
        }
    }

    removeTrap(ctx, trap.id);
    const damage = (trap.kind === 'snare' ? TRAPS.snareDamage : TRAPS.deadfallDamage)
        * (fortifiedOwner ? STANCE_MODES.fortified.trapTriggerMultiplier : 1);
    // A trap whose owner is still breathing is a kill and credited as one —
    // that is the entire point of building the thing days earlier. A trap set by
    // someone who has since died is just part of the arena now: crediting a
    // corpse produces a 'tribute' death with nobody to attribute it to.
    const claimant = owner && owner.status === 'alive' ? owner : undefined;
    const cause = claimant
        ? `Killed by ${claimant.name}'s ${trap.kind}`
        : `Caught in an abandoned ${trap.kind}`;
    applyDamage(ctx, t, damage, claimant
        ? { cause, sourceId: claimant.id, kind: 'tribute' }
        : { cause, kind: 'hazard' });
    const bleedChance = trap.kind === 'snare' ? TRAPS.snareBleedChance : TRAPS.deadfallBleedChance;
    if (ctx.rng.chance(bleedChance)) openWound(t, BLEEDING.combatSeverity);
    if (trap.kind === 'snare' && ctx.rng.chance(TRAPS.snareLegInjuryChance)) injure(t, 'legs');
    // §3.4: walking into someone's trap is exactly the kind of moment that rattles.
    rattle(t, HUNTING.rattledPerTrap);

    ctx.logEvent(
        trap.kind === 'snare'
            ? `${t.name} puts a foot wrong in ${t.zone} and the snare closes on their leg.`
            : `A deadfall comes down on ${t.name} in ${t.zone} with a sound like the arena clearing its throat.`,
        owner ? [t.id, owner.id] : [t.id],
        { important: true, category: 'hazard' }
    );
    clampTribute(t);
    checkDeath(ctx, t, cause);
    // §10.1: 'Trapper's Crown' — a kill the builder earned days earlier.
    if (t.status === 'dead' && claimant) claimant.trapKills = (claimant.trapKills ?? 0) + 1;
}

function removeTrap(ctx: SimContext, id: string) {
    ctx.state.traps = (ctx.state.traps ?? []).filter(tr => tr.id !== id);
}

/**
 * Per-cycle trap upkeep: unsprung snares sometimes catch dinner, and everything
 * eventually rots. Without the expiry a long run accumulates a minefield.
 */
export function tickTraps(ctx: SimContext) {
    const cycle = cycleOf(ctx.state);
    const surviving: Trap[] = [];

    (ctx.state.traps ?? []).forEach(trap => {
        const owner = ctx.state.tributes.find(o => o.id === trap.ownerId);
        if (!owner || owner.status !== 'alive') return;

        if (trap.kind === 'snare' && ctx.rng.chance(TRAPS.gameCatchChance)) {
            // Only useful to an owner who is actually there to collect it.
            if (owner.zone === trap.zone) {
                owner.vitals.hunger = Math.max(0, owner.vitals.hunger - TRAPS.gameFeed);
                clampTribute(owner);
                ctx.logEvent(
                    `${owner.name}'s snare in ${trap.zone} has something in it. They eat well for once.`,
                    [owner.id],
                    { category: 'survival' }
                );
                return;
            }
        }

        // A snare in a burning zone is not a snare any more, and one under a
        // flood has washed out. The zone-effect layer and the trap layer both
        // existed and knew nothing about each other.
        const destroyer = (['burning', 'flooded'] as const).find(k => hasEffect(ctx.state, trap.zone, k));
        if (destroyer) {
            if (owner.zone === trap.zone) {
                ctx.logEvent(
                    destroyer === 'burning'
                        ? `${owner.name}'s trap in ${trap.zone} is so much ash. Whatever else the fire took, it took that.`
                        : `The water in ${trap.zone} lifts ${owner.name}'s trap clean off its anchor and carries it away.`,
                    [owner.id],
                    { category: 'survival' }
                );
            }
            return;
        }

        if (cycle - trap.setCycle >= TRAPS.lifetime) return;
        // §6.2: entropy gets a vote every cycle, not only at the deadline —
        // a line slips, an animal springs it badly, the rain takes the set.
        if (ctx.rng.chance(TRAPS.rotChancePerCycle)) {
            if (owner.zone === trap.zone) {
                ctx.logEvent(
                    `${owner.name} finds their ${trap.kind} in ${trap.zone} sprung on nothing at all. The arena takes its cut.`,
                    [owner.id],
                    { category: 'survival' }
                );
            }
            return;
        }
        surviving.push(trap);
    });

    ctx.state.traps = surviving;
}

/** Fire, shelter and camouflage all live in the same per-tribute camp record. */
type CampKey = 'fire' | 'shelter' | 'camouflage';

function campOf(ctx: SimContext, t: Tribute) {
    ctx.state.camps = ctx.state.camps ?? {};
    ctx.state.camps[t.id] = ctx.state.camps[t.id] ?? {};
    return ctx.state.camps[t.id];
}

export function hasCamp(ctx: SimContext, t: Tribute, key: CampKey): boolean {
    const until = ctx.state.camps?.[t.id]?.[key];
    return until !== undefined && cycleOf(ctx.state) < until;
}

function buildChance(t: Tribute): number {
    return Math.min(0.95, Math.max(0.05,
        CRAFTING.buildBaseChance + t.attributes.intelligence * CRAFTING.buildPerIntelligence
        + traitMod(t, 'campSkill')));
}

/**
 * Lighting a fire. Matches exist in the loot table and warded cold, and that was
 * the whole of it — no cooking, no boiling, and no cost. A fire is now visible
 * for miles, which is the trade the source material is built on.
 */
export function lightFire(ctx: SimContext, t: Tribute): boolean {
    if (hasCamp(ctx, t, 'fire')) return false;
    // `fireImpossible`: no dry fuel anywhere in this arena — every warmth,
    // cooking and signalling use fire would have provided simply isn't available.
    if (arenaHasLaw(ctx.state, 'fireImpossible')) return false;

    // Matches are 1 of 34 loot items with no other ignition source, which
    // made fire — and everything gated on it (revealFires, fire sanity
    // recovery, the concealment penalty) unreachable for most runs. A blade
    // and a whetstone can strike sparks, and anyone can try a bow drill.
    const hasMatches = t.inventory.some(i => i.id === 'matches');
    const hasFlintAndSteel = hasTool(t, 'light')
        || (t.inventory.some(i => i.id === 'whetstone')
            && t.inventory.some(i => i.type === 'weapon' && i.weaponClass === 'melee'));

    let chance: number;
    if (hasMatches) {
        chance = buildChance(t);
    } else if (hasFlintAndSteel) {
        chance = buildChance(t) * CRAFTING.fireWhetstoneMultiplier;
    } else {
        chance = CRAFTING.fireNoToolBaseChance
            + t.attributes.intelligence * CRAFTING.fireNoToolPerIntelligence
            + profOf(t, 'forage') * CRAFTING.fireNoToolPerForageProficiency;
    }
    if (!ctx.rng.chance(chance)) return false;

    campOf(ctx, t).fire = cycleOf(ctx.state) + CRAFTING.fireCycles;
    t.vitals.sanity = Math.min(100, t.vitals.sanity + CRAFTING.fireSanityRecovery);
    clampTribute(t);
    ctx.logEvent(
        `${t.name} gets a fire going in ${t.zone}. It is warm, it is the first hot food in days, and it can be seen from every ridge in the arena.`,
        [t.id],
        { important: true, category: 'survival' }
    );
    return true;
}

/** Building somewhere to actually sleep. Needs cover to build it in. */
export function buildShelter(ctx: SimContext, t: Tribute): boolean {
    if (hasCamp(ctx, t, 'shelter')) return false;
    const zone = getZone(ctx.state.arena, t.zone);
    if (!zone || (zone.terrain !== 'forest' && zone.terrain !== 'ruins' && zone.terrain !== 'highland')) return false;
    if (!ctx.rng.chance(buildChance(t))) return false;

    campOf(ctx, t).shelter = cycleOf(ctx.state) + CRAFTING.shelterCycles;
    trainProficiency(t, 'forage');
    ctx.logEvent(
        `${t.name} lashes together a shelter in ${t.zone} — branches, a rock overhang, and something almost like a roof.`,
        [t.id],
        { category: 'survival' }
    );
    return true;
}

/** Mud, ash and foliage: the cheapest concealment in the arena. */
export function applyCamouflage(ctx: SimContext, t: Tribute): boolean {
    if (hasCamp(ctx, t, 'camouflage')) return false;
    if (!ctx.rng.chance(buildChance(t))) return false;

    // §6.5: camouflage copies the ground, so it is only as good as the
    // ground. Rich cover (forest, deep wetland) supplies the materials and
    // extends the work; open crust and water barely hold a smear of mud.
    const zone = getZone(ctx.state.arena, t.zone);
    const rich = zone !== undefined && zoneFeatures(zone).cover >= CRAFTING.camouflageCoverPivot + 0.2;
    const cycles = CRAFTING.camouflageCycles + (rich ? CRAFTING.camouflageRichTerrainBonusCycles : 0);
    campOf(ctx, t).camouflage = cycleOf(ctx.state) + cycles;
    ctx.logEvent(
        rich
            ? `${t.name} works mud and leaf litter into their clothes until the shape of a person goes out of them.`
            : `${t.name} does what they can with dust and a smear of mud in ${t.zone}. Out here there is not much of anything to look like.`,
        [t.id],
        { category: 'survival' }
    );
    return true;
}

/**
 * Coating a blade. Nightlock and anything else worth being careful with becomes
 * a real tactical option instead of a food item nobody eats.
 */
export function poisonWeapon(ctx: SimContext, t: Tribute): boolean {
    const weapon = t.inventory.find((i): i is Item => i.type === 'weapon' && !i.poison);
    const sourceIdx = t.inventory.findIndex(i => (POISONING.sources as readonly string[]).includes(i.id));
    if (!weapon || sourceIdx < 0) return false;

    const source = t.inventory.splice(sourceIdx, 1)[0];
    const chance = POISONING.baseChance + t.attributes.intelligence * POISONING.perIntelligence;
    if (!ctx.rng.chance(Math.min(0.95, chance))) {
        // Handling something you do not understand is its own risk.
        if (!t.injuries.poisoned && ctx.rng.chance(POISONING.selfPoisonChance)) {
            injure(t, 'poisoned');
            ctx.logEvent(
                `${t.name} tries to render ${source.name} down into something to coat a blade with, and gets it on their hands.`,
                [t.id],
                { important: true, category: 'injury' }
            );
            return false;
        }
        ctx.logEvent(`${t.name} ruins a batch of ${source.name} trying to make a poison of it.`, [t.id], { category: 'survival' });
        return false;
    }

    weapon.poison = true;
    trainProficiency(t, 'medicine');
    ctx.logEvent(
        `${t.name} works ${source.name} into a paste and coats their ${weapon.name} with it.`,
        [t.id],
        { important: true, category: 'loot' }
    );
    return true;
}

/**
 * The preparation turn. A tribute with time on their hands and no immediate
 * problem does one useful thing with it, in rough order of what a person in
 * their situation would actually reach for first.
 *
 * Returns true if the turn was spent, so the caller can skip foraging.
 */
/**
 * An hour with a whetstone. Condition is a real number now rather than a fuse
 * that burns to zero, so maintaining a good weapon is a use of a turn — and a
 * reason to pick a Whetstone up off the ground at all.
 */
export function sharpenWeapon(ctx: SimContext, t: Tribute): boolean {
    const stone = t.inventory.find(i => i.id === 'whetstone');
    if (!stone) return false;
    const weapon = t.inventory.find(i =>
        i.type === 'weapon' && i.weaponClass === 'melee' && conditionOf(i) < CRAFTING.sharpenBelowCondition);
    if (!weapon || weapon.maxDurability === undefined) return false;

    consumeOne(t, i => i === stone);
    weapon.durability = Math.min(weapon.maxDurability,
        (weapon.durability ?? 0) + Math.round(weapon.maxDurability * CRAFTING.sharpenRestore));
    ctx.logEvent(
        `${t.name} sits with a whetstone and their ${weapon.name} until the edge comes back.`,
        [t.id],
        { category: 'survival' }
    );
    return true;
}

export function attemptFieldcraft(ctx: SimContext, t: Tribute): boolean {
    if (sharpenWeapon(ctx, t)) return true;

    // A blade worth coating is worth coating now: nightlock is rare, spoils the
    // moment somebody eats the pack it is in, and turns a scratch into a death
    // sentence. Anyone holding both halves takes the opportunity.
    if (poisonWeapon(ctx, t)) return true;

    // Cold, dark and exhaustion, in the order a person would actually feel them.
    // A fire is a beacon, so it is worth it when warmth or morale is the problem
    // and not when they are trying to disappear.
    if (!isEvasiveStance(t.stance) && lightFire(ctx, t)) return true;
    if (buildShelter(ctx, t)) return true;
    if (isEvasiveStance(t.stance) && applyCamouflage(ctx, t)) return true;
    if (wantsToSetTrap(ctx, t)) {
        setTrap(ctx, t);
        return true;
    }
    return false;
}
