import { Alliance, GameState, Tribute } from '../models/types';
import { ALLIANCE_BONDS } from '../data/balance';
import { ARCHETYPES } from '../data/archetypes';
import { traitMod } from '../data/traits';
import { SimContext } from './context';
import { allianceOf, allianceRecords, membersOf } from './alliance';
import { adjustRel, adjustTrust, getRel, setRel } from './relationships';
import { cycleOf } from './memory';
import { clampTribute } from './vitals';

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
    const provider = camp.find(m => m.id === (record.roles?.quartermaster ?? record.roles?.muscle ?? record.leaderId));
    if (!provider) return;
    const fairness = record.fairness ?? (record.fairness = { ate: {}, grudges: {} });
    const others = camp.filter(m => m.id !== provider.id);
    const treachery = Math.max(0, treacheryOf(provider)) * 10;
    const greedy = treachery > 0
        && ctx.rng.chance(ALLIANCE_BONDS.greedBase + treachery * ALLIANCE_BONDS.greedPerTreachery);
    if (!greedy) {
        camp.forEach(m => { fairness.ate[m.id] = (fairness.ate[m.id] ?? 0) + 1; });
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
    short.vitals.hunger += ALLIANCE_BONDS.shortHunger;
    provider.vitals.hunger -= ALLIANCE_BONDS.greedyHunger;
    clampTribute(short); clampTribute(provider);
    const prior = fairness.grudges[short.id];
    const amount = (prior?.againstId === provider.id ? prior.amount : 0) + ALLIANCE_BONDS.grudgePerSplit;
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
        const members = membersOf(ctx.state, record.id).filter(m => m.status === 'alive');
        if (members.length < 2) return;
        const campZone = record.campZone ?? members.find(m => m.id === record.leaderId)?.zone;
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
    const failed = ctx.rng.chance(chance);
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
    const g = allianceOf(state, holder.allianceId)?.fairness?.grudges[holder.id];
    return g && g.againstId === targetId ? g.amount : 0;
}

/** Total grudge `holder` carries in their current group. */
export function grudgeTotal(state: GameState, holder: Tribute): number {
    return allianceOf(state, holder.allianceId)?.fairness?.grudges[holder.id]?.amount ?? 0;
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
