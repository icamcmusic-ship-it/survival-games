import { ArchetypeId, Item, Proficiency, Tribute } from '../models/types';
import { DRIFT, PROFICIENCY } from '../data/balance';
import { craftOf } from '../data/districts';
import { strengthCapForAge } from './physique';
import { isAggressiveStance } from '../data/stances';
import { traitProficiencyFloor } from '../data/traits';
import { SimContext, getAlive } from './context';
import { witnessCompetence } from './rapport';
import { injuryGrade } from './wounds';
import { fill } from './encounters';
import { getZone } from './map';
import { RNG } from '../utils/rng';

/**
 * Skills that improve with use.
 *
 * Attributes are rolled at the reaping, nudged once in training, and then
 * frozen for the rest of the run — a tribute who foraged successfully ten times
 * was no better at it on day 8 than on day 1. Proficiencies are the thin layer
 * that fixes that: a few points of swing, earned by doing the thing, feeding
 * back into the roll for the thing.
 *
 * They are deliberately small. The point is that a survivalist visibly becomes
 * a survivalist over a run, not that a second stat system quietly out-weighs
 * the first.
 */

/** The skill each archetype comes into the arena already leaning on. */
const ARCHETYPE_SPECIALITY: Record<ArchetypeId, Proficiency> = {
    career: 'melee',
    strategist: 'tracking',
    survivalist: 'forage',
    protector: 'medicine',
    trickster: 'tracking',
    wildcard: 'ranged',
    underdog: 'forage',
    // A2: the added roster. §1.4's `persuasion` is what makes Diplomat and
    // Mercenary mechanical rather than decorative.
    mercenary: 'melee',
    zealot: 'melee',
    medic: 'medicine',
    saboteur: 'tracking',
    beast: 'melee',
    diplomat: 'persuasion',
    scholar: 'forage',
    ghost: 'stealth',
    scavenger: 'forage',
    captor: 'intimidation',
    bellwether: 'crafting',
    confessor: 'persuasion',
    quartermaster: 'crafting',
    martyr: 'medicine',
    opportunist: 'stealth',
    tracker: 'tracking',
    // §12.5: the six new archetypes, and the four new proficiencies mean four
    // of them lean on something no archetype could lean on before.
    warden: 'carpentry',
    herald: 'oratory',
    penitent: 'medicine',
    forager: 'butchery',
    duellist: 'melee',
    broker: 'persuasion',
    /*
     * AUDIT-7 §12.5. Three of these are deliberately the axes §3.5 had just
     * made trainable — a speciality in a skill nothing could train was the
     * shape of the problem, and these are the archetypes that give
     * `navigation`, `carpentry` and `intimidation` somebody whose character
     * they are.
     */
    cartographer: 'navigation',
    debtor: 'persuasion',
    forecaster: 'navigation',
    understudy: 'forage',
    archivist: 'oratory',
    quiet: 'stealth',
    // AUDIT-9 stage D: the walk is the job.
    courier: 'pacing',
};

/**
 * What a tribute walks in already knowing: their archetype's speciality, plus
 * whatever twelve years of their district's trade taught them. The two stack,
 * capped at the same ceiling as earned skill, so a District 4 survivalist is
 * genuinely the best forager on the plates without being off the scale.
 */
export function blankProficiencies(
    archetype: ArchetypeId,
    district?: number,
    rng?: RNG,
): Partial<Record<Proficiency, number>> {
    const start: Partial<Record<Proficiency, number>> = {
        [ARCHETYPE_SPECIALITY[archetype]]: PROFICIENCY.archetypeHeadStart,
    };
    if (district === undefined) return start;
    const craft = craftOf(district);
    Object.entries(craft.proficiencies).forEach(([skill, value]) => {
        const key = skill as Proficiency;
        start[key] = Math.min(PROFICIENCY.max, (start[key] ?? 0) + (value ?? 0));
    });
    /*
     * §(requests): the district's signature skill, floored at competent.
     *
     * The craft spread above is a nudge — 0.6 against a `competentBand` of 2
     * — so before this every tribute in the field started functionally
     * unskilled and a district was a jersey colour. Sampled over 40 casts
     * (1,280 tributes): mean starting grade in the district's own signature
     * skill 0.17, and 0.0% of tributes arrived with any skill at competent or
     * better — not a rounding artefact, the arithmetic could not get there.
     * After: 2.31, 100% banded, and 15.5% at skilled or better.
     *
     * Floored rather than added, so this never stacks with the archetype head
     * start into a third band, and rolled *before* training and the arena so
     * everything downstream — bands, teaching, `witnessCompetence` — treats it
     * as ordinary skill, because that is what it is. A tribute who has done
     * the work for twelve years is competent at it; the ones who are more than
     * competent are the tail, which is what `wellTrainedChance` is.
     *
     * `rng` is optional only so that callers with no stream (previews, the
     * roster card) still get the deterministic floor; the tail needs a roll.
     */
    const signature = craft.signatureSkill;
    if (!signature) return start;
    let floor = PROFICIENCY.districtSignatureFloor;
    if (rng?.chance(PROFICIENCY.wellTrainedChance)) {
        floor = PROFICIENCY.wellTrainedFloor + rng.nextFloat() * PROFICIENCY.wellTrainedSpread;
    }
    const held = start[signature] ?? 0;
    start[signature] = Math.round(Math.min(PROFICIENCY.max, Math.max(held, floor)) * 100) / 100;
    return start;
}

/**
 * Weapon familiarity, by district of origin.
 *
 * `WEAPON_KILL_TEMPLATES` writes a bespoke death for the trident and the arena
 * then handed it to whoever happened to grab it. A tribute who grew up with a
 * gaff in their hands fights better with a trident than with a mace; a tribute
 * from the Seam is better with a knife than with either. Returns a flat power
 * bonus — familiarity, not mastery, which is what proficiency is for.
 */
export function weaponAffinity(t: Tribute, weapon?: Item): number {
    if (!weapon) return 0;
    const craft = craftOf(t.district);
    if (craft.affinityItems.includes(weapon.id)) return PROFICIENCY.affinityItemBonus;
    if (weapon.weaponClass && craft.affinityClasses.includes(weapon.weaponClass)) return PROFICIENCY.affinityClassBonus;
    return 0;
}

/**
 * §3.2: how well this specific weapon sits in this specific hand.
 *
 * `weaponProficiency` below reads the melee/ranged bucket; this reads the
 * weapon. A tribute six days into a spear is not automatically six days into a
 * bow, and until now they were — which made picking up whatever the feast put
 * on the table a strictly free upgrade. Now a swap costs, briefly, and a
 * weapon carried all run is worth keeping.
 *
 * A weapon from the district's own trade is never cold: they grew up with it,
 * which is what `affinityItems` means.
 */
export function weaponHandling(t: Tribute, weapon?: Item): number {
    if (!weapon) return 0;
    const uses = t.weaponFamiliarity?.[weapon.id] ?? 0;
    const homegrown = craftOf(t.district).affinityItems.includes(weapon.id);
    if (uses < PROFICIENCY.familiarUses && !homegrown) return -PROFICIENCY.unfamiliarPenalty;
    return Math.min(PROFICIENCY.familiarCap, uses) * PROFICIENCY.familiarPerUse;
}

/** Records one swing with a specific weapon. Monotonic, capped at the ceiling. */
export function noteWeaponUse(t: Tribute, weapon?: Item) {
    if (!weapon) return;
    t.weaponFamiliarity = t.weaponFamiliarity ?? {};
    const uses = t.weaponFamiliarity[weapon.id] ?? 0;
    if (uses >= PROFICIENCY.familiarCap) return;
    t.weaponFamiliarity[weapon.id] = uses + 1;
}

/** True when this weapon is still new in their hands — for prose. */
export function isUnfamiliar(t: Tribute, weapon?: Item): boolean {
    if (!weapon) return false;
    if (craftOf(t.district).affinityItems.includes(weapon.id)) return false;
    return (t.weaponFamiliarity?.[weapon.id] ?? 0) < PROFICIENCY.familiarUses;
}

/**
 * Current level, tolerating states saved before proficiencies existed.
 *
 * §3.1: takes the larger of what the tribute has earned and what their traits
 * grant outright, so `Climber` and `Swimmer` are a head start in `climbing`
 * and `swimming` rather than a parallel system that never learns. The floor
 * also applies to saves written before those axes existed.
 */
export function profOf(t: Tribute, skill: Proficiency): number {
    const held = t.proficiencies?.[skill] ?? 0;
    const floor = traitProficiencyFloor(t, skill);
    return floor > held ? floor : held;
}

/**
 * Records a successful use. Returns the new level so callers can narrate a
 * milestone if they want one.
 */
export function trainProficiency(t: Tribute, skill: Proficiency, ctx?: SimContext, share = 1): number {
    if (!t.proficiencies) t.proficiencies = {};
    const current = profOf(t, skill);
    // Each level already held shrinks the next gain, so the curve flattens
    // toward the cap instead of specialists slamming into a wall by mid-run.
    // §3.7: necessity is the arena's tutor — gains accelerate as the run
    // wears on, so the top of the curve is actually reachable and a
    // survivalist visibly arrives somewhere by the endgame.
    const pressure = 1 + Math.min(PROFICIENCY.lateRunGainCap, t.daysSurvived * PROFICIENCY.lateRunGainPerDay);
    // §3.9: the curve was too flat at the bottom to be felt. Board sampling
    // put the average proficiency at 1.85 against a cap of 6, which meant most
    // tributes spent an entire run inside the noise floor of a system that is
    // supposed to be the visible difference between day one and day eight.
    // The first two levels come fast — that is where real skill acquisition
    // lives — and the diminishing term still binds everything above it.
    const early = current < PROFICIENCY.earlyBand ? PROFICIENCY.earlyGainMultiplier : 1;
    // §8: and the mirror at the top. Inside the last band the gain is cut
    // hard, so the ceiling is approached asymptotically — the difference
    // between an expert and the best anybody has ever been at this should not
    // be a few more forage rolls.
    const nearCap = current > PROFICIENCY.max - PROFICIENCY.nearCapBand ? PROFICIENCY.nearCapGainMultiplier : 1;
    /**
     * Audit 4 §3.4: `share` is what a *failed* attempt is worth.
     *
     * Every training site in the engine fired only on success, and for
     * `medicine` that is a cold start: `dressChance` reads medicine, so a
     * tribute needed the skill to get a chance at the skill. Measured across
     * 200 runs it was the only proficiency whose median holder sat below 1.0
     * and whose ceiling over 3,800 tributes was 3.1 against a cap of 6 — on
     * the skill the `medic` archetype is built on and the `medic` alliance
     * role is scored by.
     *
     * A fumbled bandage is still the second time somebody has held one.
     * Defaults to 1, so every existing call site is unchanged.
     */
    const gain = PROFICIENCY.gainPerUse * pressure * early * nearCap * share
        * Math.pow(1 - PROFICIENCY.diminishingPerLevel, current);
    const next = Math.min(PROFICIENCY.max, current + gain);
    // Rounded so the value stays legible in a tooltip and in save files.
    t.proficiencies[skill] = Math.round(next * 100) / 100;
    // §3.1: crossing a whole level of a body-led skill earns back a fraction
    // of the matching attribute — the counterweight to injury and starvation.
    if (Math.floor(next) > Math.floor(current)) {
        t.attributeDrift = t.attributeDrift ?? {};
        // Capped both by DRIFT.maxGain and by the attribute scale itself (10).
        // §3.3: per-attribute ceilings — the frame has more room to grow in
        // eight days than judgement does.
        const capFor = (attr: keyof Tribute['attributes']): number =>
            attr === 'strength' ? DRIFT.maxGainStrength
            : attr === 'agility' ? DRIFT.maxGainAgility
            : attr === 'stealth' ? DRIFT.maxGainStealth
            : attr === 'intelligence' ? DRIFT.maxGainIntelligence
            : attr === 'charisma' ? DRIFT.maxGainCharisma
            : DRIFT.maxGain;
        const drift = (attr: keyof Tribute['attributes'], per: number) => {
            const held = t.attributeDrift![attr] ?? 0;
            if (held >= capFor(attr)) return;
            // Strength drift also respects the age ceiling — a fourteen-year-old
            // does not train past a fourteen-year-old's frame.
            const ceiling = attr === 'strength' ? Math.min(10, strengthCapForAge(t.age)) : 10;
            const inc = Math.min(per, capFor(attr) - held, ceiling - t.attributes[attr]);
            if (inc <= 0) return;
            t.attributeDrift![attr] = Math.round((held + inc) * 100) / 100;
            t.attributes[attr] = Math.round((t.attributes[attr] + inc) * 100) / 100;
        };
        if (skill === 'melee' || skill === 'ranged') drift('agility', DRIFT.agilityPerCombatLevel);
        else if (skill === 'tracking') drift('stealth', DRIFT.stealthPerTrackingLevel);
        // T-1: the arena plausibly changes everything. Fighting hand-to-hand
        // builds the arm behind the blade; working wounds and reading ground
        // sharpens judgement.
        if (skill === 'melee') drift('strength', DRIFT.strengthPerMeleeLevel);
        if (skill === 'medicine' || skill === 'forage') drift('intelligence', DRIFT.intelligencePerFieldcraftLevel);
        // §3: charisma was the only attribute that could not grow in the arena.
        if (skill === 'persuasion') drift('charisma', DRIFT.charismaPerPersuasionLevel);
    }
    // §3.9: crossing into a named band is a visible thing about a person, and
    // the only part of the proficiency system a viewer can see without a
    // tooltip. Narrated at whichever call sites thread a context through.
    if (ctx) {
        const before = bandOf(current);
        const after = bandOf(next);
        if (after && after !== before) {
            ctx.logEvent(fill(ctx.pickText(BAND_LINES[after][skill] ?? BAND_LINES[after].default), {
                tribute: t.name,
            }), [t.id], { category: 'survival' });
            // §3.3: proficiency was invisible to everybody else in the arena.
            // Watching somebody dress a wound competently, or read ground and
            // be right, tells you something no attribute sheet in there can —
            // and it is exactly what `respects` is supposed to hold.
            witnessCompetence(ctx, t);
        }
    }
    return t.proficiencies[skill]!;
}

/** §3.9: the three bands a proficiency can read as, or undefined below them all. */
export type ProficiencyBand = 'competent' | 'skilled' | 'expert';

export function bandOf(level: number): ProficiencyBand | undefined {
    if (level >= PROFICIENCY.expertBand) return 'expert';
    if (level >= PROFICIENCY.skilledBand) return 'skilled';
    if (level >= PROFICIENCY.competentBand) return 'competent';
    return undefined;
}

/** Band label for the tribute sheet — "Skilled forager" and so on. */
export function bandLabel(level: number): string | undefined {
    const band = bandOf(level);
    return band ? band.charAt(0).toUpperCase() + band.slice(1) : undefined;
}

/**
 * The line the feed runs when somebody crosses a band. Per skill where the
 * skill has a picture worth painting, and a fallback where it does not.
 */
const BAND_LINES: Record<ProficiencyBand, Partial<Record<Proficiency, string[]>> & { default: string[] }> = {
    competent: {
        forage: ['{tribute} has stopped guessing at which plants are which. They pick, they check, they move on.'],
        melee: ['{tribute} has stopped swinging like someone who has never swung anything.'],
        medicine: ['{tribute} ties off a dressing without having to think about the order of it.'],
        default: ['{tribute} is getting the hang of this, which is not nothing out here.'],
    },
    skilled: {
        forage: ['{tribute} works the treeline the way somebody works a garden they know.'],
        ranged: ['{tribute} looses without checking their grip first. The arrow goes where they were looking.'],
        tracking: ['{tribute} reads the ground for a moment and then walks straight to where somebody stood.'],
        default: ['{tribute} is good at this now. The arena taught them and they were paying attention.'],
    },
    expert: {
        forage: ['{tribute} has done this a hundred times now, and it shows in how little of it they have to look at.'],
        melee: ['{tribute} fights like it has stopped costing them anything to decide.'],
        medicine: ['{tribute} works the wound with the flat competence of somebody who has stopped being frightened of blood.'],
        default: ['{tribute} has done this a hundred times now. Whatever they were on the plate, they are not that.'],
    },
};

/**
 * §3.10: learning by watching.
 *
 * A tribute could watch an ally build a fire, set a snare or purify water every
 * cycle for a week and come away knowing exactly nothing — skill only ever came
 * from doing. Watching somebody who is better than you is most of how anybody
 * learns anything, and it is gated on the attribute that ought to gate it:
 * intelligence decides whether you saw a technique or merely a person crouching.
 *
 * The teacher must actually be ahead of the student, which makes an alliance
 * with a survivalist in it worth something beyond the shared cache, and gives
 * the Scholar and the district-craft head starts somewhere to propagate to.
 */
export function observeProficiency(ctx: SimContext, actor: Tribute, skill: Proficiency) {
    const teaching = profOf(actor, skill);
    if (teaching < PROFICIENCY.observeMinTeacher) return;
    ctx.state.tributes.forEach(watcher => {
        if (watcher.id === actor.id || watcher.status !== 'alive' || watcher.zone !== actor.zone) return;
        if (profOf(watcher, skill) >= teaching - PROFICIENCY.observeMinGap) return;
        const chance = PROFICIENCY.observeBaseChance
            + (watcher.attributes.intelligence - 5) * PROFICIENCY.observePerIntelligence;
        if (!ctx.rng.chance(Math.max(0, chance))) return;
        // Watching is worth a fraction of doing, and it is deliberately not
        // narrated per instance — the band-crossing line above is where it
        // surfaces, which is the only place it is interesting.
        const before = profOf(watcher, skill);
        trainProficiency(watcher, skill);
        const gained = profOf(watcher, skill) - before;
        watcher.proficiencies![skill] = Math.round((before + gained * PROFICIENCY.observeShare) * 100) / 100;
    });
}

/**
 * §3.1: the three axes the arena teaches without anybody deciding to learn.
 *
 * `melee`, `ranged`, `forage`, `medicine`, `tracking` and `persuasion` all
 * train off a discrete action somebody chose to take, which is why the six of
 * them were the whole list: there was no hook for the things a tribute does
 * simply by being where they are. Going up a cliff face every cycle for four
 * days is practice. So is crossing a channel, and so is keeping a snare line
 * and a fire alive.
 *
 * Gated on a chance rather than granted flat, because a cycle spent in a gorge
 * is exposure to climbing, not a lesson in it — and because these would
 * otherwise be the only skills in the file that train for free.
 */
export function trainTerrainSkills(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        const terrain = getZone(ctx.state.arena, t.zone)?.terrain;
        if ((terrain === 'highland' || terrain === 'ruins' || terrain === 'cave')
            && ctx.rng.chance(PROFICIENCY.terrainTrainChance)) {
            trainProficiency(t, 'climbing', ctx);
        }
        if ((terrain === 'water' || terrain === 'wetland')
            && ctx.rng.chance(PROFICIENCY.terrainTrainChance)) {
            trainProficiency(t, 'swimming', ctx);
        }
        // Something they built is still standing, which is the only honest
        // evidence that they can build.
        const camp = ctx.state.camps?.[t.id];
        const keeping = !!camp && (camp.fire !== undefined || camp.shelter !== undefined || camp.camouflage !== undefined);
        const trapping = (ctx.state.traps ?? []).some(trap => trap.ownerId === t.id);
        if ((keeping || trapping) && ctx.rng.chance(PROFICIENCY.craftTrainChance)) {
            trainProficiency(t, 'crafting', ctx);
        }
    });
}

/** The weapon skill a given weapon class trains and benefits from. */
export function weaponProficiency(weaponClass: string | undefined): Proficiency {
    return weaponClass === 'ranged' || weaponClass === 'thrown' ? 'ranged' : 'melee';
}

/**
 * §3.3: the decay path. Earned combat drift is a habit, and habits fade — a
 * tribute who spends a cycle neither fighting nor hunting loses a sliver of
 * the strength and agility the arena taught them. Fieldcraft judgement
 * (intelligence, stealth) is knowledge and keeps. Drift is a curve, not a
 * ratchet.
 */
export function decayIdleDrift(t: Tribute): void {
    if (!t.attributeDrift) return;
    if (isAggressiveStance(t.stance) || (t.momentum ?? 0) > 0) return;
    (['strength', 'agility'] as const).forEach(attr => {
        const held = t.attributeDrift![attr] ?? 0;
        if (held <= 0) return;
        const dec = Math.min(held, DRIFT.decayPerIdleCycle);
        t.attributeDrift![attr] = Math.round((held - dec) * 100) / 100;
        t.attributes[attr] = Math.round((t.attributes[attr] - dec) * 100) / 100;
    });
}

/**
 * §3.3: teaching.
 *
 * Proficiencies only ever went up, and only ever for the person doing the work.
 * An alliance with a medic role and a member sitting on `medicine: 5` could not
 * transfer a single point of it — and the training-floor pacts (`trainingPact`)
 * already establish that tributes share knowledge *before* the arena, so
 * nothing carrying it afterwards was a hole rather than a design choice.
 *
 * Deliberately narrow: same zone, a real gap in the skill, and a teacher who is
 * actually good at it. The student gains slowly; the teacher gains standing,
 * which for the archetypes that live on being useful rather than dangerous is
 * the only currency they have.
 */
export function teachSkills(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(teacher => {
        if (!teacher.allianceId) return;
        const students = alive.filter(o =>
            o.id !== teacher.id && o.allianceId === teacher.allianceId && o.zone === teacher.zone);
        if (students.length === 0) return;

        const skill = (Object.keys(teacher.proficiencies ?? {}) as Proficiency[])
            .sort((a, b) => profOf(teacher, b) - profOf(teacher, a))[0];
        if (!skill || profOf(teacher, skill) < PROFICIENCY.teachMinLevel) return;

        const student = students
            .filter(o => profOf(teacher, skill) - profOf(o, skill) >= PROFICIENCY.teachMinGap)
            .sort((a, b) => profOf(a, skill) - profOf(b, skill))[0];
        if (!student) return;
        if (!ctx.rng.chance(PROFICIENCY.teachChance)) return;

        student.proficiencies = student.proficiencies ?? {};
        const gained = Math.min(PROFICIENCY.max, profOf(student, skill) + PROFICIENCY.teachGain);
        student.proficiencies[skill] = Math.round(gained * 100) / 100;
        // Being the person who knows things is the whole of what this buys.
        witnessCompetence(ctx, teacher, PROFICIENCY.teachRespectWeight);
        ctx.logEvent(
            `${teacher.name} shows ${student.name} how it is actually done — ${TEACH_PHRASE[skill]} — and makes them do it twice more `
            + 'before letting them stop. It is the only thing anybody in there gives away for free.',
            [teacher.id, student.id],
            { category: 'survival' }
        );
    });
}

const TEACH_PHRASE: Record<Proficiency, string> = {
    melee: 'where the weight of a blade actually wants to go',
    ranged: 'how to breathe out before the release, not during it',
    tracking: 'which of those marks is a day old and which is an hour',
    forage: 'the three things on that bush that mean do not',
    medicine: 'how to pack a wound so it stops instead of merely looking packed',
    persuasion: 'what to say first, and what to leave for them to say',
    climbing: 'where to put a foot on rock that looks like it has nowhere to put one',
    swimming: 'how to let the current do most of it instead of fighting all of it',
    crafting: 'why that snare has been sprung empty three times running',
    stealth: 'that it is the stopping and starting that gets you seen, not the moving',
    intimidation: 'how to stand so that the other person decides it on their own',
    // AUDIT-6 §12.4
    butchery: 'which joint comes apart if you put the blade there instead',
    navigation: 'how to hold a bearing when there is nothing to take one from',
    carpentry: 'why that stake holds and this one comes out in your hand',
    oratory: 'how to say it so that fifteen people all hear the same sentence',
    // AUDIT-7 §12.4
    signalling: 'that two broken twigs mean nothing and three mean somebody wanted you to see them',
    fieldcookery: 'how long that has to sit on the coals before it stops being a gamble',
    pacing: 'to go slower now so that there is still something left at dusk',
    readingPeople: 'to watch the hands rather than the face, because the face has been practised',
    // The post-AUDIT-8 batch.
    firecraft: 'to build the whole thing before lighting any of it, and to stop blowing on it',
    waterlore: 'to take it from where the water is moving, and never from where it is not',
    herbalism: 'which of those two leaves is the one that draws the heat out',
    knots: 'why that knot works loose under a pull and this one only sets harder',
    camouflage: 'that it is the outline that gives you away, not the colour of you',
    throwing: 'to let go earlier than feels right, because it always feels too early',
    sprinting: 'to break the other way off the first step instead of straight back',
    scavenging: 'to look at what is under the thing rather than at the thing',
    deception: 'to say the small true part out loud and let them build the rest of it',
    vigilance: 'to watch the gaps between the trees rather than the trees',
};

/**
 * §3.3: skills can be lost.
 *
 * A tribute with a shattered arm took a combat penalty and kept every point of
 * melee proficiency they had ever earned, so the moment the arm healed they
 * were exactly who they were before it broke. Grade-3 damage to the limb a
 * skill runs through takes the skill down with it — slowly, and not all the
 * way, because the knowledge is still in there somewhere.
 */
export function decaySkillsUnderInjury(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        if (!t.proficiencies) return;
        const armGrade = injuryGrade(t, 'arms');
        const legGrade = injuryGrade(t, 'legs');
        if (armGrade < PROFICIENCY.skillLossGrade && legGrade < PROFICIENCY.skillLossGrade) return;
        const affected: Proficiency[] = [];
        if (armGrade >= PROFICIENCY.skillLossGrade) affected.push('melee', 'ranged', 'medicine');
        if (legGrade >= PROFICIENCY.skillLossGrade) affected.push('tracking', 'forage');
        affected.forEach(skill => {
            const held = profOf(t, skill);
            if (held <= PROFICIENCY.skillLossFloor) return;
            const next = Math.max(PROFICIENCY.skillLossFloor, held - PROFICIENCY.skillLossPerCycle);
            t.proficiencies![skill] = Math.round(next * 100) / 100;
            if (Math.floor(next) < Math.floor(held)) {
                ctx.logEvent(
                    `${t.name} reaches for something they used to be able to do and finds it is not there any more. `
                    + 'The arm will heal. Whether the rest of it comes back is a different question.',
                    [t.id],
                    { category: 'injury' }
                );
            }
        });
    });
}
