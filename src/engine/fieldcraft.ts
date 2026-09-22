import { Item, Tribute, Trap } from '../models/types';
import { ACTION_BUDGET, BLEEDING, CRAFTING, EARNED_TRAIT_RULES, ENDGAME, HUNTING, POISONING, PROFICIENCY, TRAPS, STANCE_MODES } from '../data/balance';
import { SimContext } from './context';
import { canAfford, progressOf, projectAt, work } from './actionBudget';
import { applyDamage, checkDeath } from './combat';
import { addZoneThreat, cycleOf, rattle, noteSighting } from './memory';
import { endgameEdge } from './objectives';
import { getZone, zoneFeatures } from './map';
import { hasEffect } from './zoneEffects';
import { clampTribute } from './vitals';
import { injure, openWound } from './wounds';
import { arenaHasLaw } from './gamesProfile';
import { profOf, trainProficiency, observeProficiency } from './proficiency';
import { earnTrait } from './earnedTraits';
import { awareness } from './stealth';
import { traitMod } from '../data/traits';
import { conditionOf, consumeOne, hasTool } from './items';
import { isAggressiveStance, isEvasiveStance } from '../data/stances';
import { sanityBandOf } from './sanityBands';
import { offerApprenticeship } from './apprenticeship';
import { noteMilestone } from './milestones';

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

/** §6: what each kind reads as when it goes in, and when it goes off. */
const TRAP_SET_LINES: Record<Trap['kind'], (name: string, zone: string) => string> = {
    snare: (n, z) => `${n} sets a snare across a game trail in ${z} and covers the line with leaf litter.`,
    deadfall: (n, z) => `${n} balances a deadfall over a gap in ${z} and backs away from it very carefully.`,
    pit: (n, z) => `${n} spends most of the day digging in ${z}, and most of the rest of it making the ground look untouched.`,
    tripwire: (n, z) => `${n} runs a line at ankle height across the approach to ${z}. It is not meant to hurt anybody. It is meant to say something.`,
    stake: (n, z) => `${n} sets a line in ${z} over something sharpened, and considers for a while whether there is anything left to paint the point with.`,
};

const TRAP_SPRING_LINES: Record<Trap['kind'], (name: string, zone: string) => string> = {
    snare: (n, z) => `${n} puts a foot wrong in ${z} and the snare closes on their leg.`,
    deadfall: (n, z) => `A deadfall comes down on ${n} in ${z} with a sound like the arena clearing its throat.`,
    pit: (n, z) => `The ground in ${z} stops being ground under ${n}, and they are at the bottom of it before they have finished falling.`,
    tripwire: (n, z) => `${n} walks through a line strung across ${z}. Nothing happens to them at all, which is the worst part of it.`,
    stake: (n, z) => `Something sharpened comes up out of the floor of ${z} into ${n}, and whatever else is true of it, it went all the way in.`,
};

/** Spends the turn setting a snare or a deadfall in the tribute's current zone. */
export function setTrap(ctx: SimContext, t: Tribute) {
    const materialIdx = t.inventory.findIndex(i => i.id === 'rope' || i.id === 'wire');
    // Audit 3 §1.2: a stake wanted a mutt venom gland *and* looted cordage, a
    // conjunction of two rare draws on top of the trap roll itself — zero were
    // built across 132 runs. Any of the four things that can coat a blade can
    // paint a point, which is the same act with the same materials.
    //
    // The gate that keeps it from swamping the other kinds is the one the
    // design comment on `Trap.kind` already implies: somebody holding a blade
    // coats the blade. A stake is what you build when the venom is the only
    // weapon you have.
    const venomIdx = t.inventory.findIndex(i => (POISONING.sources as readonly string[]).includes(i.id));
    const hasBlade = t.inventory.some(i => i.type === 'weapon');
    /*
     * AUDIT-6 §6.3: measured over 400 runs the five-kind menu read
     * deadfall 223 · pit 211 · snare 105 · tripwire 53 · stake 6. Two of five
     * kinds were statistically absent, and the cause for `stake` was this
     * conjunction: a venom gland AND no blade at all. A tribute holding a
     * knife who also has a gland still has a reason to put the gland in the
     * ground rather than on the edge — a stake works while they are asleep —
     * they just have it less often than somebody with no other option.
     */
    const venomIsTheWeapon = venomIdx >= 0
        && (!hasBlade || ctx.rng.chance(TRAPS.stakeWithBladeChance));
    // §6: what they build is what they have and what they mean to do with it.
    // A line plus a gland is a stake; a line alone is a snare, or an alarm if
    // they are hiding rather than hunting; a shovel-worth of soft ground is a
    // pit; and with nothing at all it is a deadfall.
    const zone = getZone(ctx.state.arena, t.zone);
    const diggable = zone !== undefined
        && (zone.terrain === 'forest' || zone.terrain === 'wetland' || zone.terrain === 'desert' || zone.terrain === 'open');
    // Audit 3 §1.2: cordage was the sole gate on three of the five kinds, and
    // rope and wire are Cornucopia loot. Measured across 132 runs: pit 137,
    // deadfall 205, snare 4, tripwire 1, stake 0 — a five-kind menu that was
    // a two-kind menu in play, and the archetype built around it (saboteur,
    // 2.21%) was the worst in the game.
    //
    // Ground that grows a line gives you one. Vines in a forest, cable in
    // ruins, sinew and reed in a wetland — a tribute who knows what they are
    // looking at does not need to have looted rope. It costs the turn either
    // way, it is gated on the fieldcraft they actually have, and carried
    // cordage is still strictly better (it works anywhere, including the open).
    const improvisable = zone !== undefined
        && (zone.terrain === 'forest' || zone.terrain === 'wetland' || zone.terrain === 'ruins');
    const hasLine = materialIdx >= 0
        || (improvisable && profOf(t, 'tracking') >= TRAPS.improvisedLineTracking);
    // A gland is what makes a stake a stake; the sharpened point is whittled
    // from whatever is to hand, which is why this no longer also wants a line.
    /*
     * §6.3: and a stake without venom is still a stake. Soft ground plus
     * somebody who can work wood is all a sharpened point needs; the gland is
     * what makes it a *treated* one, which is the difference between a wound
     * and a death sentence. `Trap.treated` carries that.
     */
    const canWhittle = diggable && profOf(t, 'carpentry') >= TRAPS.stakeCarpentry;
    const kind: Trap['kind'] =
        venomIsTheWeapon ? 'stake'
            // §6.3: and `tripwire` was gated on the Evasive family alone.
            // Patrolling is the stance whose entire content is knowing who is
            // coming — an alarm on the approach is what it wants most.
            : hasLine && (isEvasiveStance(t.stance) || t.stance === 'Patrolling') ? 'tripwire'
                : hasLine ? 'snare'
                    // §6.3: an untreated stake is what somebody builds when
                    // they have no line to run. Deliberately *below* the line
                    // kinds rather than above them — the first draft put it at
                    // the top and every trapper with a rope started building
                    // stakes instead of snares, which took the Saboteur from
                    // 3% to 2.05% at n=1,600.
                    : canWhittle ? 'stake'
                        : diggable && t.attributes.strength >= TRAPS.pitStrength ? 'pit'
                            : 'deadfall';

    /*
     * AUDIT-9 stage C §3: a trap set properly takes most of an afternoon, and
     * a half-set trap is not a trap. Same partial-work rule as the shelter:
     * the hours carry, changing your mind loses them.
     */
    if (!work(t, `trap:${kind}`, ACTION_BUDGET.trapHours, { state: ctx.state, cycle: cycleOf(ctx.state) })) {
        if (progressOf(t, `trap:${kind}`, ACTION_BUDGET.trapHours) > 0) {
            ctx.logEvent(
                `${t.name} works on a ${kind} in ${t.zone} until the light goes, and leaves it unset rather than leave it badly set.`,
                [t.id],
                { type: 'partial-work', category: 'survival' }
            );
        }
        return;
    }

    /*
     * AUDIT-6 §12.4 `carpentry`: the build. `crafting` was doing this *and*
     * repair, so the tribute who can fix a blade and the tribute who can put up
     * a deadfall that holds were the same person by definition.
     */
    let chance = TRAPS.buildBaseChance
        + t.attributes.intelligence * TRAPS.buildPerIntelligence
        + profOf(t, 'carpentry') * TRAPS.buildPerCarpentry
        + profOf(t, 'tracking') * TRAPS.buildPerTracking;
    /*
     * AUDIT-6 §9.1/§8: the Saboteur gets this too, which it never did.
     *
     * The trap bonus sat on `trickster` alone, and the archetype whose own
     * description is "poisons caches, springs other people's traps, and takes
     * the bridge out behind them" built traps at the field rate. It has been
     * the worst archetype in the game across three audits — 2.21%, then
     * 2.37% — and the mechanic it is named for was somebody else's.
     */
    if (t.archetype === 'trickster' || t.archetype === 'saboteur') chance += TRAPS.trickeryBonus;
    chance += traitMod(t, 'trapSkill');
    /*
     * AUDIT-6 §6.3: 598 traps set and 176 triggered — 29% — so trap-setting
     * was mostly a way to spend a cycle. The engine knows `chokepoint` on
     * every zone and knows `zoneTraffic` on every edge, and the trap layer read
     * neither: a deadfall in a dead-end and a deadfall in the only pass through
     * the arena were built at exactly the same rate. Somebody who has decided
     * to spend a day on this picks the ground people have to walk over.
     */
    if (zone && zoneFeatures(zone).chokepoint) chance += TRAPS.buildChokepointBonus;
    const traffic = Object.entries(ctx.state.zoneTraffic ?? {})
        .filter(([key]) => key.split('|').includes(t.zone))
        .reduce((a, [, n]) => a + n, 0);
    chance += Math.min(TRAPS.buildTrafficCap, traffic * TRAPS.buildPerTraffic);

    if (!ctx.rng.chance(Math.min(0.95, chance))) {
        ctx.logEvent(
            `${t.name} spends an hour on a ${kind} in ${t.zone} and ends up with a tangle of nothing.`,
            [t.id],
            { category: 'survival' }
        );
        return;
    }

    // Improvised cordage costs no item; carried cordage is spent, and only by
    // the kinds that actually run a line. A stake burns the gland instead.
    const spendsLine = (kind === 'snare' || kind === 'tripwire') && materialIdx >= 0;
    const treated = kind === 'stake' && venomIsTheWeapon;
    if (treated) t.inventory.splice(venomIdx, 1);
    // Only a stake spends the venom, and a stake never also spends a line, so
    // `materialIdx` is never shifted by the splice above.
    if (spendsLine) t.inventory.splice(materialIdx, 1);
    ctx.state.traps = ctx.state.traps ?? [];
    /*
     * AUDIT-8 §6.1: a trapline goes on the approaches, not under your feet.
     *
     * Every trap in the game was placed in the zone the builder happened to be
     * standing in, and 71.9% of them were never triggered — 1,151 built, 323
     * sprung, across 400 runs. That is not a construction problem, which is
     * what `Baiting` was written to address and did not move; it is a
     * placement problem. A trap is a bet on somebody else's movement, and the
     * builder was betting exclusively on the one square they were already
     * occupying, which is the square a rival is least likely to walk into
     * unannounced.
     *
     * `zoneTraffic` is already tracked, already decayed, and already read two
     * dozen lines above to decide whether the trap gets built at all. Reading
     * it once more to decide *where* is the whole fix: a tribute who has spent
     * the hour picks the busiest way in rather than their own doorstep, and
     * only when the difference is worth the walk. They still know where it is
     * — `ownerId` is unchanged — so nothing about springing your own trap
     * changes.
     */
    let placement = t.zone;
    if (zone) {
        const trafficOf = (name: string) => Object.entries(ctx.state.zoneTraffic ?? {})
            .filter(([key]) => key.split('|').includes(name))
            .reduce((a, [, n]) => a + n, 0);
        const here = trafficOf(t.zone);
        const approaches = zone.adjacent
            .filter(n => !(ctx.state.collapsedZones ?? []).includes(n))
            .map(n => [n, trafficOf(n)] as const)
            .sort((a, b) => b[1] - a[1]);
        const best = approaches[0];
        if (best && best[1] > here + TRAPS.approachTrafficEdge) placement = best[0];
    }
    ctx.state.traps.push({
        id: `trap-${t.id}-${cycleOf(ctx.state)}-${ctx.state.traps.length}`,
        kind,
        zone: placement,
        ownerId: t.id,
        concealment: concealmentFor(ctx, t),
        setCycle: cycleOf(ctx.state),
        treated,
    });
    t.trapsSet = (t.trapsSet ?? 0) + 1;
    // AUDIT-8 §12.3: enough of them that the ground around them stops being
    // neutral. `trapsSet` was already counted and read by nothing but the
    // achievement table.
    if (t.trapsSet >= EARNED_TRAIT_RULES.traplineTraps) earnTrait(ctx, t, 'Trapline');
    // AUDIT-7 §3.5: a trap is read *and* built. Tracking is choosing where it
    // goes; carpentry is making it hold. The second half was not being trained.
    trainProficiency(t, 'tracking');
    trainProficiency(t, 'carpentry', ctx, PROFICIENCY.trapCarpentryShare);
    ctx.logEvent(TRAP_SET_LINES[kind](t.name, t.zone), [t.id], { type: `trap-set-${kind}`, category: 'survival' });
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
    // §7: an owner steps over their own work because they remember it is
    // there. A tribute in the `gone` sanity band does not reliably remember
    // anything, including where they tied a wire at throat height four days
    // ago. Rare, and the darkest edge case `trapKills` has.
    const ownHere = trapsIn(ctx, t.zone).filter(tr => tr.ownerId === t.id);
    if (ownHere.length > 0 && sanityBandOf(t) === 'gone' && ctx.rng.chance(TRAPS.ownSnareForgetChance)) {
        springOwnTrap(ctx, t, ownHere[0]);
        return;
    }

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
            if (t.archetype === 'trickster' || t.archetype === 'saboteur') disarmChance += TRAPS.trickeryBonus;
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
                    { type: 'trap-triggered', important: true, category: 'survival' }
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

    // §6: an alarm is the one that does not hurt anybody. It tells its owner
    // exactly where somebody is, which for a tribute who is hiding rather than
    // hunting is worth more than a wound.
    if (trap.kind === 'tripwire') {
        rattle(t, HUNTING.rattledPerTrap + TRAPS.tripwireRattle);
        if (owner && owner.status === 'alive') {
            noteSighting(ctx.state, owner, t.zone, 1, 0);
        }
        ctx.logEvent(
            TRAP_SPRING_LINES.tripwire(t.name, t.zone),
            owner ? [t.id, owner.id] : [t.id],
            { important: true, category: 'survival' }
        );
        return;
    }

    const baseDamage =
        trap.kind === 'snare' ? TRAPS.snareDamage
            : trap.kind === 'pit' ? TRAPS.pitDamage
                // §6.3: an untreated point is a hole with a spike in it.
                : trap.kind === 'stake' ? (trap.treated ? TRAPS.stakeDamage : TRAPS.stakeUntreatedDamage)
                    : TRAPS.deadfallDamage;
    const damage = baseDamage * (fortifiedOwner ? STANCE_MODES.fortified.trapTriggerMultiplier : 1);
    // A trap whose owner is still breathing is a kill and credited as one —
    // that is the entire point of building the thing days earlier. A trap set by
    // someone who has since died is just part of the arena now: crediting a
    // corpse produces a 'tribute' death with nobody to attribute it to.
    const claimant = owner && owner.status === 'alive' ? owner : undefined;
    const cause = claimant
        ? `Killed by ${claimant.name}'s ${trap.kind}`
        : `Caught in an abandoned ${trap.kind}`;
    applyDamage(ctx, t, damage, claimant
        ? { cause, sourceId: claimant.id, kind: 'tribute', code: 'tribute' }
        : { cause, kind: 'hazard', code: 'trap' });
    const bleedChance =
        trap.kind === 'snare' ? TRAPS.snareBleedChance
            : trap.kind === 'pit' ? TRAPS.pitBleedChance
                : trap.kind === 'stake' ? TRAPS.stakeBleedChance
                    : TRAPS.deadfallBleedChance;
    if (ctx.rng.chance(bleedChance)) openWound(t, BLEEDING.combatSeverity);
    if (trap.kind === 'snare' && ctx.rng.chance(TRAPS.snareLegInjuryChance)) injure(t, 'legs');
    if (trap.kind === 'pit' && ctx.rng.chance(TRAPS.pitLegInjuryChance)) injure(t, 'legs');
    // A treated point is the whole reason to build one — when there was
    // anything to treat it with. §6.3: an untreated stake is a hole with a
    // spike in it, which is still a very bad afternoon.
    if (trap.kind === 'stake' && trap.treated) injure(t, 'poisoned');
    // §3.4: walking into someone's trap is exactly the kind of moment that rattles.
    rattle(t, HUNTING.rattledPerTrap);

    ctx.logEvent(
        TRAP_SPRING_LINES[trap.kind](t.name, t.zone),
        owner ? [t.id, owner.id] : [t.id],
        { type: 'trap-triggered', important: true, category: 'hazard' }
    );
    clampTribute(t);
    checkDeath(ctx, t, cause);
    // §10.1: 'Trapper's Crown' — a kill the builder earned days earlier.
    //
    // Audit 3 §8.2: and it counts as a kill. `trapKills` was incremented here
    // and `kills` was not, so the two archetypes built on other people's
    // mechanisms — saboteur 2.21%, trapper the worst large trait sample —
    // could work all run and register as having killed nobody. A tribute who
    // dies in a snare was killed by whoever tied it; the arena is not a third
    // party here. This also feeds `victors with zero kills`, which is the one
    // design goal the metrics sweep has never met.
    if (t.status === 'dead' && claimant) {
        claimant.trapKills = (claimant.trapKills ?? 0) + 1;
        claimant.kills += 1;
    }
}

/**
 * §7: a tribute walking into their own trap.
 *
 * Credited to `trapKills` like any other trap kill, deliberately — the owner
 * and the victim are the same person, which is the whole reason the case is
 * worth having. Nothing else in the simulation can produce a tribute killed
 * by their own hands days after the fact.
 */
function springOwnTrap(ctx: SimContext, t: Tribute, trap: Trap) {
    removeTrap(ctx, trap.id);
    // A tripwire is an alarm. Walking into your own is a bad moment, not a wound.
    if (trap.kind === 'tripwire') {
        rattle(t, HUNTING.rattledPerTrap + TRAPS.tripwireRattle);
        ctx.logEvent(
            `${t.name} sets off a tripwire in ${t.zone} and spins to face whoever set it. Nobody did. They did, days ago, and they stand there a long time working that out.`,
            [t.id],
            { important: true, category: 'hazard' }
        );
        return;
    }
    const cause = `Caught in their own ${trap.kind}`;
    // Every kind used to resolve as a deadfall here — the pit lost its leg,
    // the stake lost its poison, and the tripwire above dealt deadfall damage.
    const damage =
        trap.kind === 'snare' ? TRAPS.snareDamage
            : trap.kind === 'pit' ? TRAPS.pitDamage
                // §6.3: an untreated point is a hole with a spike in it.
                : trap.kind === 'stake' ? (trap.treated ? TRAPS.stakeDamage : TRAPS.stakeUntreatedDamage)
                    : TRAPS.deadfallDamage;
    applyDamage(ctx, t, damage, { cause, kind: 'hazard', code: 'trap' });
    openWound(t, BLEEDING.combatSeverity);
    if (trap.kind === 'snare' || trap.kind === 'pit') injure(t, 'legs');
    if (trap.kind === 'stake' && trap.treated) injure(t, 'poisoned');
    const line: Record<Trap['kind'], string> = {
        snare: `${t.name} walks into a snare in ${t.zone} tied with their own knot, at their own working height, by themselves, days ago. They do not appear to recognise it.`,
        deadfall: `${t.name} trips their own deadfall in ${t.zone}. They set it. They have not been able to hold on to that kind of thing for a while now.`,
        pit: `${t.name} goes into a pit in ${t.zone} that they dug, covered, and forgot, in that order. The forgetting is the part that should worry them.`,
        stake: `${t.name} walks onto a treated stake in ${t.zone}. Their own — the poison is the batch they mixed. They know exactly what happens next, which is the worst part.`,
        tripwire: '',
    };
    ctx.logEvent(line[trap.kind], [t.id], { important: true, category: 'hazard' });
    clampTribute(t);
    checkDeath(ctx, t, cause);
    if (t.status === 'dead') t.trapKills = (t.trapKills ?? 0) + 1;
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
                const feed = TRAPS.gameFeed + profOf(owner, 'butchery') * TRAPS.gameFeedPerButchery;
                owner.vitals.hunger = Math.max(0, owner.vitals.hunger - feed);
                trainProficiency(owner, 'butchery');
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
            // §1.4: this used to be narrated only when the owner happened to be
            // standing in the zone, which is why a real and rather good
            // interaction between two systems fired 21 times across 400 runs as
            // far as anybody watching could tell. The feed is a broadcast, not
            // one tribute's point of view — the cameras are on the trap whether
            // or not its owner is.
            const present = owner.zone === trap.zone;
            ctx.logEvent(
                destroyer === 'burning'
                    ? present
                        ? `${owner.name}'s trap in ${trap.zone} is so much ash. Whatever else the fire took, it took that.`
                        : `The fire in ${trap.zone} takes ${owner.name}'s trap with everything else. ${owner.name} is two sectors away and does not know yet.`
                    : present
                        ? `The water in ${trap.zone} lifts ${owner.name}'s trap clean off its anchor and carries it away.`
                        : `The water in ${trap.zone} lifts ${owner.name}'s trap clean off its anchor. ${owner.name} will come back for it and find bare ground.`,
                [owner.id],
                { type: 'trap-destroyed', category: 'survival' }
            );
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
    // AUDIT-9 stage C §3: gathering fuel and getting it lit is an evening.
    if (!canAfford(t, ACTION_BUDGET.fireHours)) return false;
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
        { type: 'fire-lit', important: true, category: 'survival' }
    );
    return true;
}

/** Building somewhere to actually sleep. Needs cover to build it in. */
export function buildShelter(ctx: SimContext, t: Tribute): boolean {
    if (hasCamp(ctx, t, 'shelter')) return false;
    const zone = getZone(ctx.state.arena, t.zone);
    if (!zone || (zone.terrain !== 'forest' && zone.terrain !== 'ruins' && zone.terrain !== 'highland')) return false;
    if (!ctx.rng.chance(buildChance(t))) return false;
    /*
     * AUDIT-9 stage C §3: "interruptions leave partial work".
     *
     * A shelter is most of a day. A tribute who has spent the morning walking
     * does not finish one by evening — they get it half up, and if they are
     * still there tomorrow they finish it. Before budgets this was one roll
     * that either produced a whole shelter or produced nothing, which is why
     * travel and building never competed for anything.
     *
     * `work` also abandons progress if they start building something else, so
     * a tribute who keeps changing their mind ends the week with no shelter —
     * which is the cost of indecision the audit asked to be legible.
     */
    /*
     * AUDIT-10 B5-02: somebody else's half-built shelter is a thing you can
     * find.
     *
     * The project ledger is keyed by site, so a tribute arriving where somebody
     * has been working picks up the hours already in it rather than starting
     * from nothing. That is the audit's "discovered, finished ... or
     * appropriated by somebody else", and it costs one line here because the
     * ledger is doing the work — which is the argument for the ledger.
     *
     * Announced, because finding a stranger's frame standing in the trees is
     * the kind of thing a chronicle should say out loud: it tells the reader
     * somebody was here, which is information the finder has and the audience
     * would otherwise miss.
     */
    // B5-03: somebody who knows how, standing right there, while it goes badly.
    offerApprenticeship(ctx, t, 'carpentry');
    const inherited = projectAt(ctx.state, t, 'shelter');
    if (inherited && !inherited.workerIds.includes(t.id) && inherited.hoursDone > 0) {
        const builders = inherited.workerIds
            .map(id => ctx.state.tributes.find(o => o.id === id))
            .filter((o): o is Tribute => o !== undefined);
        noteMilestone(ctx, 'project-inherited', [t.id, ...inherited.workerIds]);
        ctx.logEvent(
            `${t.name} finds the frame of a shelter already standing in ${t.zone} — somebody's afternoon, `
            + `abandoned. ${builders.some(b => b.status === 'alive')
                ? 'Whoever left it may well come back for it.'
                : 'Whoever put it up is not coming back for it.'} ${t.name} picks up where they left off.`,
            [t.id, ...inherited.workerIds],
            { category: 'survival', zone: t.zone }
        );
    }
    if (!work(t, 'shelter', ACTION_BUDGET.shelterHours, { state: ctx.state, cycle: cycleOf(ctx.state) })) {
        const done = progressOf(t, 'shelter', ACTION_BUDGET.shelterHours);
        if (done > 0) {
            ctx.logEvent(
                `${t.name} gets the frame of a shelter up in ${t.zone} before the light goes. It is not weatherproof yet.`,
                [t.id],
                { type: 'partial-work', category: 'survival' }
            );
        }
        return false;
    }

    campOf(ctx, t).shelter = cycleOf(ctx.state) + CRAFTING.shelterCycles;
    /*
     * AUDIT-7 §3.5: building a shelter trains `carpentry`, which is what
     * building is.
     *
     * It used to train `forage` — gathering the branches, at a stretch — and
     * `carpentry` had **no `trainProficiency` call site anywhere in the
     * engine**. Measured across 6,000 tributes its peak value was 1.00, the
     * value everybody starts at: a whole axis on the tribute sheet that no
     * tribute could ever move. `crafting` peaked at 5.85 off one call site,
     * which is the same verb wearing the other name.
     *
     * Forage keeps a share, because finding the materials is genuinely part of
     * it, and `share` is what a partial contribution is for.
     */
    trainProficiency(t, 'carpentry', ctx);
    trainProficiency(t, 'forage', ctx, PROFICIENCY.shelterForageShare);
    // §3.10: a shelter going up in front of you is a lesson whether or not
    // the person building it meant it as one.
    observeProficiency(ctx, t, 'carpentry');
    ctx.logEvent(
        `${t.name} lashes together a shelter in ${t.zone} — branches, a rock overhang, and something almost like a roof.`,
        [t.id],
        { type: 'shelter-built', category: 'survival' }
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
        { type: 'camouflaged', category: 'survival' }
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
        { type: 'weapon-poisoned', important: true, category: 'loot' }
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
    // §8: a genuine trapper lays the trap first. This used to be the last
    // option in the queue, behind sharpening, poisoning, a fire, a shelter and
    // camouflage, so the whole field set 0.57 traps per run and the trait that
    // exists to do this was the worst-performing in the game.
    if (traitMod(t, 'trapSkill') >= TRAPS.prioritySkill && wantsToSetTrap(ctx, t)) {
        setTrap(ctx, t);
        return true;
    }
    if (!isEvasiveStance(t.stance) && lightFire(ctx, t)) return true;
    if (buildShelter(ctx, t)) return true;
    if (isEvasiveStance(t.stance) && applyCamouflage(ctx, t)) return true;
    if (wantsToSetTrap(ctx, t)) {
        setTrap(ctx, t);
        return true;
    }
    return false;
}
