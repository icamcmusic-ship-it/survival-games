import { Alliance, GameState, Tribute } from '../models/types';
import { neverGreedy, watchFailScale } from './traitHooks';
import { ALLIANCE_BONDS, AUDIT12_TRIBUTES } from '../data/balance';
import { ARCHETYPES } from '../data/archetypes';
import { traitMod } from '../data/traits';
import { SimContext } from './context';
import { allianceOf, allianceRecords, allied, membersOf } from './alliance';
import { adjustRel, adjustTrust, getRel, setRel } from './relationships';
import { cycleOf, raiseSuspicion } from './memory';
import { loseSanity } from './sanityBands';
import { grantTruce } from './parley';
import { clampTribute } from './vitals';
import { isActive } from './downed';
import { consumeOne } from './items';

/**
 * AUDIT-11 §6: relationships and alliances.
 *
 * The group already had roles, a watch, a cache, charter hearings and schisms.
 * What it did not have was an account of whether anybody *did* their job,
 * who actually ate, and how two particular people's story bends: a rival who
 * pulls you out of the dirt, an ally caught emptying the stash, a romance one
 * of them was only ever playing, a death that costs the mourner a day.
 *
 * Everything here draws from `ctx.rng` in a fixed order and reads its numbers
 * from `ALLIANCE_BONDS`, so a seed replays exactly.
 */

/** Traits that can sell a romance the tribute does not feel. */
const CAMERA_TRAITS: readonly string[] = ['Showman', 'Charismatic'];

type Duty = 'leader' | 'scout' | 'medic' | 'provider' | 'watch';

const DUTY_LABEL: Record<Duty, string> = {
    leader: 'leading', scout: 'scouting', medic: 'patching people up', provider: 'sharing out the food', watch: 'the watch',
};

function treacheryOf(t: Tribute): number {
    return ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery');
}

/** Record one kept or neglected duty on the group's ledger. */
function note(record: Alliance, id: string, kept: boolean): { kept: number; neglected: number } {
    const ledger = record.roleLedger ?? (record.roleLedger = {});
    const row = ledger[id] ?? (ledger[id] = { kept: 0, neglected: 0 });
    if (kept) row.kept++; else row.neglected++;
    return row;
}

function judge(ctx: SimContext, record: Alliance, holder: Tribute, others: Tribute[], duty: Duty, kept: boolean) {
    const row = note(record, holder.id, kept);
    others.forEach(o => adjustTrust(o, holder.id, kept ? ALLIANCE_BONDS.roleTrustGain : -ALLIANCE_BONDS.roleTrustLoss));
    if (others.length === 0) return;
    if (!kept && (row.neglected === 1 || row.neglected % 3 === 0)) {
        ctx.logEvent(
            `${holder.name} was meant to be ${DUTY_LABEL[duty]} for the group and was not. ${others.map(o => o.name).join(' and ')} notice${others.length === 1 ? 's' : ''}.`,
            [holder.id, ...others.map(o => o.id)],
            { type: 'role-neglected', category: 'alliance', zone: holder.zone }
        );
    } else if (kept && row.kept === 3) {
        ctx.logEvent(
            `Three times now ${holder.name} has done the ${DUTY_LABEL[duty]} without being asked. ${others.map(o => o.name).join(' and ')} ${others.length === 1 ? 'has' : 'have'} stopped checking.`,
            [holder.id, ...others.map(o => o.id)],
            { type: 'role-kept', category: 'alliance', zone: holder.zone }
        );
    }
}

function dutyChance(attr: number): number {
    return ALLIANCE_BONDS.roleBaseSuccess + attr * ALLIANCE_BONDS.rolePerAttribute;
}

/** Leader, scout and medic: one roll each, for whoever holds the job and is at camp. */
function runRoleDuties(ctx: SimContext, record: Alliance, camp: Tribute[]) {
    const at = (id: string | undefined) => camp.find(m => m.id === id);
    const rest = (h: Tribute) => camp.filter(m => m.id !== h.id);

    const leader = at(record.leaderId);
    if (leader && camp.length >= 3) {
        const a = leader.attributes;
        judge(ctx, record, leader, rest(leader), 'leader', ctx.rng.chance(dutyChance((a.charisma + a.willpower) / 2)));
    }
    const scout = at(record.roles?.scout);
    if (scout && scout.id !== leader?.id) {
        judge(ctx, record, scout, rest(scout), 'scout', ctx.rng.chance(dutyChance(scout.attributes.stealth)));
    }
    const medic = at(record.roles?.medic);
    if (medic) {
        const patient = rest(medic).filter(m => m.health < ALLIANCE_BONDS.medicHurtHealth)
            .sort((x, y) => x.health - y.health || (x.id < y.id ? -1 : 1))[0];
        if (patient) {
            const kept = ctx.rng.chance(dutyChance(medic.attributes.intelligence + (medic.proficiencies?.medicine ?? 0)));
            if (kept) {
                patient.health = Math.min(100, patient.health + ALLIANCE_BONDS.medicHeal);
                clampTribute(patient);
            }
            judge(ctx, record, medic, rest(medic), 'medic', kept);
        }
    }
}

/**
 * The shared meal. Everybody at camp eats a portion; a provider with the
 * treachery for it sometimes takes a second one out of somebody else's. The
 * short-changed member remembers, and it is written down.
 */
function shareMeal(ctx: SimContext, record: Alliance, camp: Tribute[]) {
    // AUDIT-12 E4: the first *living, present* holder of the job, not the
    // first id on the list — a dead quartermaster used to cancel every meal.
    const provider = [record.roles?.quartermaster, record.roles?.muscle, record.leaderId]
        .map(id => camp.find(m => m.id === id))
        .find((m): m is Tribute => !!m);
    if (!provider) return;
    // AUDIT-12 T13 / T3: a meal is only a duty when there is food to deal out,
    // and dealing it out uses some.
    const hasFood = record.sharedCache.some(i => i.type === 'food') || provider.inventory.some(i => i.type === 'food');
    if (!hasFood) return;
    const fairness = record.fairness ?? (record.fairness = { ate: {}, grudges: {} });
    const others = camp.filter(m => m.id !== provider.id);
    const treachery = Math.max(0, treacheryOf(provider)) * 10;
    // AUDIT-12 §16: a Rationer deals out the food and never takes two shares.
    const greedy = treachery > 0 && !neverGreedy(provider)
        && ctx.rng.chance(Math.min(AUDIT12_TRIBUTES.greedChanceCap,
            ALLIANCE_BONDS.greedBase + treachery * ALLIANCE_BONDS.greedPerTreachery));
    const cacheIdx = record.sharedCache.findIndex(i => i.type === 'food');
    if (cacheIdx >= 0) {
        const item = record.sharedCache[cacheIdx];
        if (item.stack !== undefined && item.stack > 1) item.stack -= 1;
        else record.sharedCache.splice(cacheIdx, 1);
    } else {
        consumeOne(provider, i => i.type === 'food');
    }
    const portion = AUDIT12_TRIBUTES.campMealPortion / Math.max(1, camp.length - 1);
    if (!greedy) {
        camp.forEach(m => {
            fairness.ate[m.id] = (fairness.ate[m.id] ?? 0) + 1;
            m.vitals.hunger = Math.max(0, m.vitals.hunger - portion);
        });
        judge(ctx, record, provider, others, 'provider', true);
        return;
    }
    // The one they like least goes without.
    const short = [...others].sort((x, y) => getRel(provider, x.id) - getRel(provider, y.id) || (x.id < y.id ? -1 : 1))[0];
    camp.forEach(m => {
        if (m.id === short.id) return;
        fairness.ate[m.id] = (fairness.ate[m.id] ?? 0) + (m.id === provider.id ? 2 : 1);
    });
    fairness.ate[short.id] = fairness.ate[short.id] ?? 0;
    camp.forEach(m => {
        if (m.id !== short.id) m.vitals.hunger = Math.max(0, m.vitals.hunger - portion);
    });
    short.vitals.hunger += ALLIANCE_BONDS.shortHunger;
    provider.vitals.hunger -= ALLIANCE_BONDS.greedyHunger;
    clampTribute(short); clampTribute(provider);
    const prior = fairness.grudges[short.id];
    // AUDIT-12 §6: the per-pair ledger. A grudge is held against a person,
    // not against whoever holds the ladle, so it survives a role change.
    const pairs = record.pairGrudges ?? (record.pairGrudges = {});
    const row = pairs[short.id] ?? (pairs[short.id] = {});
    row[provider.id] = (row[provider.id] ?? 0) + ALLIANCE_BONDS.grudgePerSplit;
    const amount = row[provider.id];
    fairness.grudges[short.id] = { againstId: provider.id, amount };
    adjustRel(short, provider.id, -ALLIANCE_BONDS.grudgeRegard);
    judge(ctx, record, provider, others, 'provider', false);
    if (!prior || prior.againstId !== provider.id || (prior.amount < ALLIANCE_BONDS.grudgeMotive && amount >= ALLIANCE_BONDS.grudgeMotive)) {
        ctx.logEvent(
            amount >= ALLIANCE_BONDS.grudgeMotive
                ? `Again ${provider.name} deals out the food and again ${short.name}'s share is the one that comes up short. ${short.name} has stopped saying anything, which is worse.`
                : `${provider.name} splits the group's food in ${provider.zone} and somehow ends up with two shares. ${short.name} ends up with none, and counts.`,
            [provider.id, short.id],
            { type: 'unfair-split', important: amount >= ALLIANCE_BONDS.grudgeMotive, category: 'alliance', zone: provider.zone }
        );
    }
}

/** The per-cycle pass over every standing group: duties, then the meal. */
export function tickAllianceBonds(ctx: SimContext) {
    Object.values(allianceRecords(ctx.state)).forEach(record => {
        if (record.id.startsWith('lovers-')) return;
        // AUDIT-12 T9: a downed member does no duty and deals out no meal.
        const members = membersOf(ctx.state, record.id).filter(m => m.status === 'alive' && isActive(m));
        if (members.length < 2) return;
        const campZone = record.campZone ?? (members.find(m => m.id === record.leaderId) ?? members[0])?.zone;
        const camp = members.filter(m => m.zone === campZone);
        if (camp.length < 2) return;
        runRoleDuties(ctx, record, camp);
        shareMeal(ctx, record, camp);
    });
}

/**
 * The watch: whether the watcher stays awake. Returns true on a failure, after
 * logging it and charging it to the watcher's trust and the group's ledger.
 */
export function watchFails(ctx: SimContext, record: Alliance, watcher: Tribute, sleepers: Tribute[], zone: string): boolean {
    const chance = ALLIANCE_BONDS.watchFailBase
        + (watcher.sleepDebt ?? 0) * ALLIANCE_BONDS.watchFailPerDebt
        + Math.max(0, watcher.vitals.fatigue - ALLIANCE_BONDS.watchFailFatigueLine) * ALLIANCE_BONDS.watchFailPerFatigue;
    // AUDIT-12 T15: Heavy Sleeper nods off; Night Owl does not.
    const failed = ctx.rng.chance(chance * watchFailScale(watcher));
    note(record, watcher.id, !failed);
    if (!failed) return false;
    sleepers.forEach(s => adjustTrust(s, watcher.id, -ALLIANCE_BONDS.watchFailTrustLoss));
    const lost = record.sharedCache.length > 0 ? record.sharedCache.pop() : undefined;
    ctx.logEvent(
        `${watcher.name} falls asleep on watch in ${zone} while ${sleepers.map(x => x.name).join(' and ')} sleep${sleepers.length === 1 ? 's' : ''}.${lost ? ` In the morning the ${lost.name} is gone from the pile, and nobody heard a thing.` : ' Nothing comes. Nobody thanks them for that.'}`,
        [watcher.id, ...sleepers.map(s => s.id)],
        { type: 'watch-failure', important: !!lost, category: 'alliance', zone }
    );
    return true;
}

/** Grudge `holder` carries against `targetId` from unfair splits, in their own group. */
export function grudgeAgainst(state: GameState, holder: Tribute, targetId: string): number {
    const record = allianceOf(state, holder.allianceId);
    const pair = record?.pairGrudges?.[holder.id]?.[targetId];
    if (pair !== undefined) return pair;
    const g = record?.fairness?.grudges[holder.id];
    return g && g.againstId === targetId ? g.amount : 0;
}

/** Total grudge `holder` carries in their current group. */
export function grudgeTotal(state: GameState, holder: Tribute): number {
    const record = allianceOf(state, holder.allianceId);
    const row = record?.pairGrudges?.[holder.id];
    if (row) return Object.values(row).reduce((a, b) => a + b, 0);
    return record?.fairness?.grudges[holder.id]?.amount ?? 0;
}

/** Whether a betrayal just chosen is the fairness ledger coming due; logs it if so. */
export function noteGrudgeMotive(ctx: SimContext, betrayer: Tribute, victim: Tribute) {
    const g = grudgeAgainst(ctx.state, betrayer, victim.id);
    if (g < ALLIANCE_BONDS.grudgeMotive) return;
    ctx.logEvent(
        `${betrayer.name} has been going hungry while ${victim.name} ate twice. That account is about to be settled.`,
        [betrayer.id, victim.id],
        { type: 'grudge-betrayal', important: true, category: 'betrayal', zone: betrayer.zone }
    );
}

/**
 * Rivals to allies: somebody who thought of the rescuer as a rival, pulled up
 * off the ground by them. The grudge does not survive it.
 */
export function thawRivals(ctx: SimContext, rescuer: Tribute, rescued: Tribute) {
    if (getRel(rescued, rescuer.id) > ALLIANCE_BONDS.rivalRegard) return;
    setRel(rescued, rescuer.id, Math.max(getRel(rescued, rescuer.id), ALLIANCE_BONDS.thawRegard));
    setRel(rescuer, rescued.id, Math.max(getRel(rescuer, rescued.id), ALLIANCE_BONDS.thawRegard / 2));
    adjustTrust(rescued, rescuer.id, ALLIANCE_BONDS.roleTrustLoss);
    ctx.logEvent(
        `${rescued.name} spent days wanting ${rescuer.name} dead, and it was ${rescuer.name} who kept them alive. Whatever it was between them is something else now.`,
        [rescuer.id, rescued.id],
        { type: 'rival-thaw', important: true, category: 'alliance', zone: rescued.zone }
    );
}

/** Allies to rivals: members who saw the stash emptied. */
export function witnessTheft(ctx: SimContext, thief: Tribute, witnesses: Tribute[]) {
    const seen = witnesses.filter(w => w.id !== thief.id && w.status === 'alive' && w.zone === thief.zone);
    if (seen.length === 0) return;
    seen.forEach(w => setRel(w, thief.id, Math.min(getRel(w, thief.id), ALLIANCE_BONDS.theftRivalRegard)));
    // AUDIT-12 §6: witnessed deceit is evidence, not only a grudge.
    seen.forEach(w => raiseSuspicion(w, thief.id, AUDIT12_TRIBUTES.deceitSuspicion));
    ctx.logEvent(
        `${seen.map(w => w.name).join(' and ')} ${seen.length === 1 ? 'is' : 'are'} not asleep. ${seen.length === 1 ? 'They watch' : 'They watch'} ${thief.name} go through the pile, say nothing, and from that night on ${thief.name} is not an ally who left — they are a rival.`,
        [thief.id, ...seen.map(w => w.id)],
        { type: 'theft-witnessed', important: true, category: 'betrayal', zone: thief.zone }
    );
}

/** Whether a tribute can play a romance for the cameras on temperament alone. */
export function performsForCameras(t: Tribute): boolean {
    return t.traits.some(x => CAMERA_TRAITS.includes(x));
}

/**
 * Grief scaled by bond. Returns the extra hatred toward the killer the bond is
 * worth, and — for a bond strong enough — may cost the mourner a day.
 */
export function griefScaling(ctx: SimContext, mourner: Tribute, victim: Tribute, bond: number, knowsKiller: boolean, isLover: boolean): number {
    const strength = isLover ? 100 : Math.max(0, bond);
    // Once a run: the second loss numbs where the first one floored them.
    if (!mourner.griefDayHad && strength >= ALLIANCE_BONDS.griefDayBond
        && ctx.rng.chance(ALLIANCE_BONDS.griefDayChance * strength / 100)) {
        const kind: 'reckless' | 'shutdown' = knowsKiller ? 'reckless' : 'shutdown';
        mourner.griefDayHad = true;
        mourner.griefDay = { kind, untilCycle: cycleOf(ctx.state) + ALLIANCE_BONDS.griefDayCycles, forId: victim.id };
        ctx.logEvent(
            kind === 'reckless'
                ? `${mourner.name} does not stop to grieve ${victim.name}. They stop being careful instead.`
                : `${mourner.name} hears the cannon for ${victim.name} and does not get up. For a day the arena can do what it likes.`,
            [mourner.id, victim.id],
            { type: 'grief-day', important: true, category: 'sanity', zone: mourner.zone }
        );
    }
    return strength * ALLIANCE_BONDS.vengeancePerBond;
}

/** The stance a live grief day forces, if any. */
export function griefStance(state: GameState, t: Tribute): 'Aggressive' | 'Fortified' | undefined {
    const g = t.griefDay;
    if (!g) return undefined;
    if (cycleOf(state) > g.untilCycle) {
        // The day is over: the scorer gets them back without a hold to serve
        // on a posture they never chose.
        t.griefDay = undefined;
        t.stanceHeld = Number.MAX_SAFE_INTEGER;
        t.stanceChurn = 0;
        return undefined;
    }
    return g.kind === 'reckless' ? 'Aggressive' : 'Fortified';
}

/** End of the Games: every lovers' bond says which side meant it. */
export function revealRomances(ctx: SimContext) {
    (ctx.state.romances ?? []).forEach(r => {
        const a = ctx.state.tributes.find(t => t.id === r.aId);
        const b = ctx.state.tributes.find(t => t.id === r.bId);
        if (!a || !b) return;
        const fake = [a, b].filter(t => r.sincere[t.id] === false);
        ctx.logEvent(
            fake.length === 0
                ? `For the record: ${a.name} and ${b.name} meant every word of it.`
                : `For the record: ${fake[0].name} was performing. ${(fake[0] === a ? b : a).name} was not.`,
            [a.id, b.id],
            { type: 'romance-reveal', important: true, category: 'romance' }
        );
    });
}

/** Training: tally cross-district station-mates for one day's groups. */
export function noteStationMates(ctx: SimContext, groups: Iterable<Tribute[]>) {
    for (const group of groups) {
        group.forEach(a => group.forEach(b => {
            if (a.id === b.id || a.district === b.district) return;
            const mates = a.stationMates ?? (a.stationMates = {});
            mates[b.id] = (mates[b.id] ?? 0) + 1;
            adjustRel(a, b.id, ALLIANCE_BONDS.stationWarmth);
            if (mates[b.id] === ALLIANCE_BONDS.stationNamedAt && a.id < b.id) {
                ctx.logEvent(
                    `${a.name} and ${b.name} keep ending up at the same station. By now they nod to each other on the way in.`,
                    [a.id, b.id],
                    { type: 'station-bond', category: 'training' }
                );
            }
        }));
    }
}

/** Shared station days between two tributes. */
export function stationBondOf(a: Tribute, b: Tribute): number {
    return Math.min(a.stationMates?.[b.id] ?? 0, b.stationMates?.[a.id] ?? 0);
}

/**
 * AUDIT-12 §6: the hollow victory. Killing somebody you once kept a camp with
 * costs sanity, and it follows the killer: everybody else who was in a group
 * with both of them knows what it means, and suspects them for it.
 */
export function tickHollowVictories(ctx: SimContext) {
    const byId = new Map(ctx.state.tributes.map(t => [t.id, t] as const));
    ctx.state.tributes.forEach(victim => {
        if (victim.status !== 'dead') return;
        const killer = victim.lastDamage?.sourceId ? byId.get(victim.lastDamage.sourceId) : undefined;
        if (!killer || killer.id === victim.id || killer.status !== 'alive') return;
        if (killer.hollowVictims?.includes(victim.id)) return;
        const wasAlly = (killer.formerAllies ?? []).includes(victim.id)
            || allied(killer, victim);
        if (!wasAlly) return;
        killer.hollowVictims = [...(killer.hollowVictims ?? []), victim.id];
        loseSanity(killer, AUDIT12_TRIBUTES.hollowVictorySanity);
        clampTribute(killer);
        const knowers = ctx.state.tributes.filter(o => o.status === 'alive' && o.id !== killer.id
            && ((o.formerAllies ?? []).includes(victim.id) || allied(o, victim)));
        knowers.forEach(o => raiseSuspicion(o, killer.id, AUDIT12_TRIBUTES.hollowVictorySuspicion));
        ctx.logEvent(
            `${killer.name} has ${victim.name}'s blood on them, and ${victim.name} once slept a watch away from them. `
            + 'It does not feel like winning. It keeps not feeling like winning.',
            [killer.id, victim.id],
            { type: 'hollow-victory', important: true, category: 'sanity', zone: killer.zone, actorId: killer.id }
        );
    });
}

/**
 * AUDIT-12 §6: loner support. Two tributes with nobody who meet in the same
 * zone at nightfall, neither hunting the other, can strike a one-night shared
 * camp — a truce with a shared watch, no roles, no cache. And a truce is
 * transitive for one step: the loner who has a truce with both of two
 * strangers sitting at the same fire brings them into it (a truce chain).
 */
export function tickLonerCamps(ctx: SimContext) {
    const state = ctx.state;
    if (state.phase !== 'night') return;
    const cycle = cycleOf(state);
    const loners = state.tributes.filter(t => t.status === 'alive' && !t.allianceId && isActive(t));
    const byZone = new Map<string, Tribute[]>();
    loners.forEach(t => byZone.set(t.zone, [...(byZone.get(t.zone) ?? []), t]));
    const hunting = (a: Tribute, b: Tribute) =>
        (a.objective?.kind === 'hunt' && a.objective.targetId === b.id)
        || (b.objective?.kind === 'hunt' && b.objective.targetId === a.id);
    const truced = (a: Tribute, b: Tribute) => (a.truces?.[b.id] ?? -1) > cycle;
    byZone.forEach((here, zone) => {
        if (here.length < 2) return;
        // Truce chains first: A–B and B–C at one fire makes A–C.
        here.forEach(b => here.forEach(a => here.forEach(c => {
            if (a.id >= c.id || a.id === b.id || c.id === b.id) return;
            if (!truced(a, b) || !truced(b, c) || truced(a, c) || hunting(a, c)) return;
            if (!ctx.rng.chance(AUDIT12_TRIBUTES.truceChainChance)) return;
            grantTruce(ctx, a, c, AUDIT12_TRIBUTES.sharedCampCycles, 'brokered');
            ctx.logEvent(
                `${b.name} has an understanding with ${a.name} and another with ${c.name}, and in ${zone} that turns out to be enough for the three of them to share a fire.`,
                [b.id, a.id, c.id],
                { type: 'shared-camp', category: 'alliance', zone }
            );
        })));
        // Then the one-night pact between two who have nobody.
        const pool = [...here].sort((x, y) => (x.id < y.id ? -1 : 1));
        for (let i = 0; i + 1 < pool.length; i++) {
            const a = pool[i];
            const b = pool.slice(i + 1).find(o => !hunting(a, o) && !truced(a, o)
                && Math.min(getRel(a, o.id), getRel(o, a.id)) >= AUDIT12_TRIBUTES.sharedCampRegard);
            if (!b) continue;
            const hermit = ARCHETYPES[a.archetype].caution + ARCHETYPES[b.archetype].caution;
            if (!ctx.rng.chance(AUDIT12_TRIBUTES.sharedCampChance + Math.max(0, hermit) * 0.2)) continue;
            grantTruce(ctx, a, b, AUDIT12_TRIBUTES.sharedCampCycles, 'mutual-threat');
            [a, b].forEach(m => {
                m.sleepDebt = Math.max(0, (m.sleepDebt ?? 0) - AUDIT12_TRIBUTES.sharedCampDebtRepaid);
                adjustTrust(m, (m === a ? b : a).id, AUDIT12_TRIBUTES.sharedCampTrust);
            });
            ctx.logEvent(
                `${a.name} and ${b.name}, each alone, end up on either side of the same fire in ${zone}. `
                + 'Nothing is agreed except that tonight one of them sleeps while the other watches, and then they swap.',
                [a.id, b.id],
                { type: 'shared-camp', category: 'alliance', zone }
            );
            pool.splice(pool.indexOf(b), 1);
        }
    });
}
