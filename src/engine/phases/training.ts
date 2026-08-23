import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Attributes, Proficiency, Tribute } from '../../models/types';
import {
    TRAINING_STATIONS, TRAINING_VERDICTS, INTIMIDATION_TEXTS,
    TRAINING_ALTERCATION, TRAINING_EVENING, TRAINING_FAILURE, TRAINING_MINGLE,
    TRAINING_OBSERVATION, TRAINING_STRUGGLE, TRAINING_TEAMUP,
} from '../../data/flavorText';
import { FEAR, PREGAMES, TRAINING, TRAINING_FLOOR, TRAINING_SCORE } from '../../data/balance';
import { addFear, reduceFear } from '../fear';
import { strengthCapForAge } from '../generator';
import { LEGACY_EFFECTS, craftOf, legacyOf } from '../../data/districts';
import { adjustMutual, adjustRel, adjustRespect, getRel } from '../relationships';
import { noteContact, noteFight } from '../memory';
import { archetypeAntipathy } from '../../data/archetypes';
import { clampTribute } from '../vitals';
import { addExcitement } from '../audience';
import { profOf, trainProficiency } from '../proficiency';
import { traitMod } from '../../data/traits';

/**
 * Three days on the training floor, and then a room with the Gamemakers in it.
 *
 * This used to be a single roll: +1 to a random attribute, a score derived from
 * total stats, printed immediately. Everything the source material does with
 * the training centre — choosing what to work on, deciding whether to show the
 * Capitol what you can do or hide it, the private session, and the scores
 * arriving as a broadcast the whole cast watches — happened nowhere.
 *
 * Four things now happen, in order:
 *
 *  1. Each tribute picks stations for three days, from what they are good at,
 *     what their district trained them for, and what they know they lack.
 *  2. They pick a strategy: showcase, conceal, or neither. A Career sells it; a
 *     small tribute with any sense hides.
 *  3. The private session produces the number, from merit, from strategy, and
 *     occasionally from doing something the Gamemakers did not expect.
 *  4. The scores are announced together, as a broadcast, and *then* the rest of
 *     the cast reacts to them.
 */

/**
 * Training scores 1-8 are earned on merit; every point above 8 is a separate
 * gate. The numbers behind both live in `TRAINING_SCORE` in balance.ts.
 */
function meritMultiplier(t: Tribute): number {
    let m = 1;
    if (t.isCareer) m += TRAINING_SCORE.meritCareer;
    if (t.archetype === 'career') m += TRAINING_SCORE.meritCareerArchetype;
    if (t.traits.includes('Brute')) m += TRAINING_SCORE.meritBrute;
    if (t.traits.includes('Strategist')) m += TRAINING_SCORE.meritStrategist;
    if (t.traits.includes('Eagle-Eyed')) m += TRAINING_SCORE.meritEagleEyed;
    if (t.traits.includes('Nimble')) m += TRAINING_SCORE.meritNimble;
    if (t.traits.includes('Clumsy')) m += TRAINING_SCORE.meritClumsy;
    if (t.traits.includes('Pacifist')) m += TRAINING_SCORE.meritPacifist;
    // A twelve-year-old does not out-score the Careers on the gauntlet, however
    // fast they are — age is a real ceiling on the elite band.
    m += (t.age - TRAINING_SCORE.meritAgePivot) * TRAINING_SCORE.meritPerYear;
    // Coaching is worth something, and the districts with victors have the
    // coaches. This is the mentor layer showing up where it should.
    m += LEGACY_EFFECTS[legacyOf(t.district).tier].trainingMerit;
    return Math.max(TRAINING_SCORE.meritFloor, m);
}

export function eliteGateChance(t: Tribute, pointAboveEight: number): number {
    return Math.min(TRAINING_SCORE.eliteGateCap,
        TRAINING_SCORE.eliteGateBase
        * Math.pow(TRAINING_SCORE.eliteGateDecay, pointAboveEight - 1)
        * meritMultiplier(t));
}

const ATTRS = ['strength', 'agility', 'intelligence', 'stealth', 'charisma'] as const;

/** The proficiency a station trains, where it trains one at all. */
const STATION_SKILL: Record<keyof Attributes, Proficiency> = {
    strength: 'melee',
    agility: 'ranged',
    intelligence: 'forage',
    stealth: 'tracking',
    // §1.4: charisma was the one attribute with training-floor prose
    // ('sponsor pitch booth', 'mock-interview couch') and no proficiency
    // behind it, so three days there bought raw charisma and nothing else.
    charisma: 'persuasion',
    // §3.1: the two new attributes train on the floor like everything else —
    // the endurance course is a rope and a treadmill, and the willpower
    // station is the one nobody talks about.
    endurance: 'forage',
    willpower: 'medicine',
};

/**
 * What a tribute works on for a day.
 *
 * Not random: they lean toward what their district already taught them and what
 * they are naturally good at, but a tribute with any sense also spends a day on
 * the survival stations they know they will need. The gap between those two
 * instincts is most of what separates a Career from everybody else.
 */
function pickStation(ctx: SimContext, t: Tribute, alreadyWorked: Array<keyof Attributes>): keyof Attributes {
    const craft = craftOf(t.district);
    const weights = ATTRS.map(attr => {
        let weight = 1 + t.attributes[attr] * TRAINING_FLOOR.perAttributePoint;
        // District trade: a District 7 tribute goes to the heavy blades.
        if (craft.affinityClasses.includes('melee') && attr === 'strength') weight += TRAINING_FLOOR.craftAffinity;
        if (Object.keys(craft.proficiencies).includes('forage') && attr === 'intelligence') weight += TRAINING_FLOOR.forageCraftAffinity;
        // Careers do not spend three days learning which berries are safe.
        if (t.isCareer && (attr === 'strength' || attr === 'agility')) weight += TRAINING_FLOOR.careerCombat;
        if (t.isCareer && attr === 'intelligence') weight += TRAINING_FLOOR.careerSurvival;
        // Everyone else knows the arena kills more people than the Careers do.
        if (!t.isCareer && attr === 'intelligence') weight += TRAINING_FLOOR.outsiderSurvival;
        // Repeating a station has diminishing appeal.
        weight *= Math.pow(TRAINING_FLOOR.repeatDecay, alreadyWorked.filter(a => a === attr).length);
        return Math.max(TRAINING_FLOOR.minWeight, weight);
    });
    let roll = ctx.rng.nextFloat() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ATTRS.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return ATTRS[i];
    }
    return ATTRS[ATTRS.length - 1];
}

export type TrainingStrategy = 'showcase' | 'conceal' | 'balanced';

/**
 * Whether to show the Capitol everything or none of it.
 *
 * Hiding is the underdog's move and it is a real trade: a low score keeps you
 * off everybody's list, and it also keeps the sponsors away.
 */
function pickStrategy(ctx: SimContext, t: Tribute): TrainingStrategy {
    let conceal = TRAINING.concealChance;
    let showcase = TRAINING.showcaseChance;
    if (t.isCareer) { showcase += TRAINING_FLOOR.careerShowcase; conceal += TRAINING_FLOOR.careerConceal; }
    if (t.archetype === 'trickster' || t.archetype === 'strategist') conceal += TRAINING_FLOOR.schemerConceal;
    if (t.archetype === 'underdog') conceal += TRAINING_FLOOR.underdogConceal;
    if (t.attributes.intelligence >= TRAINING_FLOOR.cleverIntelligence) conceal += TRAINING_FLOOR.cleverConceal;
    if (t.traits.includes('Showman')) showcase += TRAINING_FLOOR.showmanShowcase;
    if (t.traits.includes('Unremarkable')) conceal += TRAINING_FLOOR.unremarkableConceal;
    if (t.fanFavourite) showcase += TRAINING_FLOOR.fanFavouriteShowcase;

    const roll = ctx.rng.nextFloat();
    if (roll < Math.max(0, conceal)) return 'conceal';
    if (roll < Math.max(0, conceal) + Math.max(0, showcase)) return 'showcase';
    return 'balanced';
}

const STRATEGY_LINES: Record<TrainingStrategy, (t: Tribute, station: string) => string> = {
    showcase: (t, station) => `${t.name} works the ${station} where the gallery can see them, and makes sure it can.`,
    conceal: (t, station) => `${t.name} spends the day at the ${station} doing nothing they could not have done at home. Whatever they can actually do, they are not doing it here.`,
    balanced: (t, station) => `${t.name} works the ${station} steadily and gives the gallery nothing to talk about either way.`,
};

/** Which flavour variant a tribute reads under — same convention as DEATH_TEXTS. */
function variantFor(t: Tribute): 'career' | 'child' | 'generic' {
    if (t.isCareer || t.archetype === 'career') return 'career';
    if (t.age <= PREGAMES.childAge) return 'child';
    return 'generic';
}

/** Reads a keyed pool with its generic fallback. */
function variantPool(pools: Record<string, string[]>, t: Tribute): string[] {
    const keyed = pools[variantFor(t)];
    return keyed && keyed.length > 0 ? keyed : pools.generic;
}

function fillLine(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
        (text, [k, v]) => text.split(`{${k}}`).join(v), template);
}

type StationOutcome = 'success' | 'struggle' | 'failure';

/**
 * A4(a): a station attempt with a visible outcome.
 *
 * The gain used to be unconditional — three days at a station always worked,
 * which is why `trainingStrategy: 'conceal'` was a flat score penalty with no
 * upside anybody could see. Rolling it means the floor has a public record: a
 * tribute seen floundering is a tribute the room revises downward, and a
 * Career who watched it happen has a name for later.
 */
function attemptStation(
    ctx: SimContext,
    t: Tribute,
    attr: keyof Attributes,
    station: string,
    day: number,
    floor: Tribute[],
): StationOutcome {
    const craft = craftOf(t.district);
    let chance = TRAINING.stationBaseSuccess
        + t.attributes[attr] * TRAINING.stationPerAttributePoint
        - day * TRAINING.stationFatiguePerDay;
    if (craft.affinityClasses.includes('melee') && attr === 'strength') chance += TRAINING.stationCraftBonus;
    if (Object.keys(craft.proficiencies).includes('forage') && attr === 'intelligence') chance += TRAINING.stationCraftBonus;
    // Somebody deliberately playing it down is not trying to pass.
    if (t.trainingStrategy === 'conceal') chance -= TRAINING.stationConcealPenalty;

    const roll = ctx.rng.nextFloat();
    const outcome: StationOutcome = roll < chance ? 'success'
        : roll < chance + TRAINING.stationStruggleBand ? 'struggle'
        : 'failure';

    const aptitude = TRAINING_FLOOR.aptitudeBase + t.attributes[attr] / TRAINING_FLOOR.aptitudeDivisor;
    const ceiling = attr === 'strength' ? strengthCapForAge(t.age) : TRAINING_FLOOR.attributeCeiling;
    const gainFactor = outcome === 'success' ? 1 : outcome === 'struggle' ? TRAINING.struggleGainFactor : 0;

    if (gainFactor > 0) {
        t.attributes[attr] = Math.min(ceiling,
            t.attributes[attr] + TRAINING.stationAttributeGain * aptitude * gainFactor);
        const skill = STATION_SKILL[attr];
        const steps = Math.round(TRAINING.stationProficiencyGain * gainFactor / TRAINING_FLOOR.proficiencyStep);
        for (let i = 0; i < steps; i++) trainProficiency(t, skill);
    }

    t.trainingLog = [...(t.trainingLog ?? []), { day: day + 1, station, outcome }];

    if (outcome === 'success') {
        ctx.logEvent(
            STRATEGY_LINES[t.trainingStrategy ?? 'balanced'](t, station),
            [t.id],
            { category: 'training' }
        );
        // Being visibly good at something in a room of twenty-three people who
        // are all counting is worth exactly what it sounds like.
        const seen = t.trainingStrategy === 'showcase'
            ? TRAINING.successRespect + TRAINING.showcaseRespectBonus
            : TRAINING.successRespect;
        floor.forEach(o => { if (o.id !== t.id) adjustRespect(o, t.id, seen); });
        return outcome;
    }

    if (outcome === 'struggle') {
        ctx.logEvent(
            fillLine(ctx.pickText(variantPool(TRAINING_STRUGGLE, t)), { tribute: t.name, station }),
            [t.id],
            { category: 'training' }
        );
        floor.forEach(o => { if (o.id !== t.id) adjustRespect(o, t.id, -TRAINING.struggleRespect); });
        return outcome;
    }

    ctx.logEvent(
        fillLine(ctx.pickText(variantPool(TRAINING_FAILURE, t)), { tribute: t.name, station }),
        [t.id],
        { important: true, category: 'training' }
    );
    t.vitals.sanity = Math.max(0, t.vitals.sanity - TRAINING.failureSanity);
    clampTribute(t);
    floor.forEach(o => {
        if (o.id === t.id) return;
        adjustRespect(o, t.id, -TRAINING.failureRespect);
        // A Career who watches somebody fail publicly stops being wary of them
        // and starts thinking of them as a name to get out of the way early.
        // This is the other half of what makes concealing a genuine gamble.
        if (o.isCareer || o.archetype === 'career') reduceFear(o, t.id, TRAINING.failureCareerFearDrop);
    });
    return outcome;
}

/**
 * A4(b/c/d): what happens between two tributes who spent the day at the same
 * station — which, before this, was nothing at all. The only inter-tribute
 * interaction in the entire training phase was the post-broadcast intimidation
 * pass, which is also why `performed` measured 8 across 400 runs: a showmance
 * needs a contact streak, and there was no way to start one before the arena.
 */
function runFloorSocial(
    ctx: SimContext,
    day: number,
    stationsToday: Map<string, keyof Attributes>,
    stationNames: Map<keyof Attributes, string>,
    cast: Tribute[],
) {
    const byStation = new Map<keyof Attributes, Tribute[]>();
    cast.forEach(t => {
        const attr = stationsToday.get(t.id);
        if (!attr) return;
        byStation.set(attr, [...(byStation.get(attr) ?? []), t]);
    });

    byStation.forEach((group, attr) => {
        if (group.length < 2) return;
        const station = stationNames.get(attr) ?? ctx.rng.pick(TRAINING_STATIONS[attr]);
        // Disjoint pairs rather than every combination: a station has people
        // working next to each other, not each tribute holding a separate
        // conversation with all four of the others. The full cross-product
        // produced roughly eighty social lines a day, which drowned the
        // station outcomes it was supposed to sit alongside.
        const partners = ctx.rng.shuffle(group);
        for (let i = 0; i + 1 < partners.length; i += 2) {
            {
                const a = partners[i];
                const b = partners[i + 1];
                const regard = Math.min(getRel(a, b.id), getRel(b, a.id));

                // (d) Altercation. `seedBackstoryRelationships` already
                // produces these — fan-favourite envy, career rivalry,
                // archetype antipathy — and nothing ever cashed them in before
                // the gong. `feuds` measured 142 per 400 runs, which is far
                // too rare for something this central.
                const hostile = regard <= TRAINING.altercationRegard
                    || archetypeAntipathy(a.archetype, b.archetype);
                if (hostile && ctx.rng.chance(TRAINING.altercationChance)) {
                    const instigator = getRel(a, b.id) <= getRel(b, a.id) ? a : b;
                    const target = instigator === a ? b : a;
                    ctx.logEvent(
                        fillLine(ctx.pickText(variantPool(TRAINING_ALTERCATION, instigator)), {
                            tribute: instigator.name, other: target.name, station,
                        }),
                        [instigator.id, target.id],
                        { important: true, category: 'training' }
                    );
                    // No damage — the trainers get between them — but the feud
                    // escalation curve starts here rather than at the gong.
                    addFear(a, b.id, TRAINING.altercationFear);
                    addFear(b, a.id, TRAINING.altercationFear);
                    noteFight(ctx.state, a, b);
                    adjustMutual(ctx.state, a, b, TRAINING.altercationRegard);
                    [a, b].forEach(x => {
                        addExcitement(x, TRAINING.altercationExcitement);
                        x.sponsorTrust = Math.max(0, x.sponsorTrust + TRAINING.altercationTrust);
                    });
                    continue;
                }

                // (b) Mingling.
                if (!ctx.rng.chance(TRAINING.mingleChance)) continue;
                adjustMutual(ctx.state, a, b, TRAINING.mingleWarmth);
                noteContact(ctx.state, a, b);
                ctx.logEvent(
                    fillLine(ctx.pickText(TRAINING_MINGLE), { tribute: a.name, other: b.name, station }),
                    [a.id, b.id],
                    { category: 'training' }
                );

                // (c) Team-ups, from day 2 — except the Careers, who do this on
                // day 1 and make sure it is seen, which is most of where the
                // pack's menace comes from in the source material.
                const bothCareer = (a.isCareer || a.archetype === 'career')
                    && (b.isCareer || b.archetype === 'career');
                const eligibleDay = bothCareer ? TRAINING.careerPactDay : 2;
                if (day + 1 < eligibleDay) continue;
                if (Math.min(getRel(a, b.id), getRel(b, a.id)) < TRAINING.pactMinRegard) continue;
                if (a.trainingPact?.includes(b.id)) continue;
                if (!ctx.rng.chance(TRAINING.pactChance)) continue;

                a.trainingPact = [...(a.trainingPact ?? []), b.id];
                b.trainingPact = [...(b.trainingPact ?? []), a.id];
                adjustMutual(ctx.state, a, b, TRAINING.pactWarmth);
                ctx.logEvent(
                    fillLine(ctx.pickText(TRAINING_TEAMUP), { tribute: a.name, other: b.name, station }),
                    [a.id, b.id],
                    { important: true, category: 'training' }
                );
            }
        }
    });
}

/**
 * A4(e): everybody watches everybody.
 *
 * Before this the only pre-arena threat information anyone had was the training
 * score, which is why `assessZone`'s `concealDiscount` was carrying the whole
 * deception mechanic on its own.
 */
function observeFloor(
    ctx: SimContext,
    day: number,
    stationsToday: Map<string, keyof Attributes>,
    stationNames: Map<keyof Attributes, string>,
    cast: Tribute[],
) {
    cast.forEach(observer => {
        cast.forEach(subject => {
            if (subject.id === observer.id) return;
            const attr = stationsToday.get(subject.id);
            if (!attr) return;
            const combat = attr === 'strength' || attr === 'agility';
            if (combat && subject.attributes[attr] >= TRAINING.observationThreatAttribute) {
                addFear(observer, subject.id, TRAINING.observationFear);
                adjustRespect(observer, subject.id, TRAINING.observationRespect);
            }
        });
    });

    // One line, from one tribute, so the observation pass reads as a beat
    // rather than as twenty-four silent bookkeeping updates.
    const watcher = ctx.rng.pick(cast);
    if (!ctx.rng.chance(TRAINING.observationLineChance)) return;
    const subject = ctx.rng.pick(cast.filter(o => o.id !== watcher.id));
    if (!subject) return;
    const attr = stationsToday.get(subject.id) ?? 'strength';
    ctx.logEvent(
        fillLine(ctx.pickText(TRAINING_OBSERVATION), {
            tribute: watcher.name,
            other: subject.name,
            station: stationNames.get(attr) ?? ctx.rng.pick(TRAINING_STATIONS[attr]),
            day: String(day + 1),
        }),
        [watcher.id, subject.id],
        { category: 'training' }
    );
}

/** A4(f): the hours nobody trains in. */
function eveningBeat(ctx: SimContext, day: number) {
    const keyed = TRAINING_EVENING[`day${day + 1}`];
    const pool = keyed && ctx.rng.chance(TRAINING.eveningDayPoolChance) ? keyed : TRAINING_EVENING.generic;
    ctx.logEvent(ctx.pickText(pool), [], { category: 'training' });
}

/**
 * A4(c): the Career pack, agreed in public on day one.
 *
 * Not an alliance — nothing is an alliance until the gong, and
 * `initializeCareerAlliance` still decides whether the pack actually forms.
 * This is the agreement that makes it likely, and the moment the rest of the
 * floor learns who has already decided about them.
 */
function declareCareerPact(ctx: SimContext, cast: Tribute[]) {
    const careers = cast.filter(t => t.isCareer || t.archetype === 'career');
    if (careers.length < 2) return;
    careers.forEach(a => careers.forEach(b => {
        if (a.id === b.id || a.trainingPact?.includes(b.id)) return;
        a.trainingPact = [...(a.trainingPact ?? []), b.id];
    }));
    ctx.logEvent(
        `The Careers find each other before the first rotation is over — ${careers.map(c => `${c.name} (D${c.district})`).join(', ')} — `
        + `and spend the rest of the day training as a unit in the middle of the floor, where everybody has to walk around them.`,
        careers.map(c => c.id),
        { important: true, category: 'training' }
    );
    // Twenty-odd people have just watched a pack assemble itself.
    cast.forEach(o => {
        if (careers.some(c => c.id === o.id)) return;
        careers.forEach(c => addFear(o, c.id, TRAINING.careerPactFear));
    });
}

const DAY_HEADLINES = [
    'DAY ONE ON THE TRAINING FLOOR. The doors open on twenty-four people who have never been in a room like this and will never be in one again.',
    'DAY TWO. The floor has settled. Everybody now knows where they are going first and, more importantly, who else is going there.',
    'DAY THREE. Last day before the private sessions, and it shows in everything anybody does.',
];

export function processTraining(ctx: SimContext) {
    ctx.state.phase = 'training';
    ctx.rng = new RNG(`${ctx.state.seed}-training`);
    const cast = getAlive(ctx.state);

    // ---- 1-2. A decision about being watched, then three days on the floor ----
    cast.forEach(t => {
        // §6.10: player coaching. A pinned strategy for the chosen tribute
        // replaces the roll; everyone else decides for themselves.
        const coached = ctx.state.playerCoaching;
        t.trainingStrategy = coached?.tributeId === t.id && coached.trainingStrategy
            ? coached.trainingStrategy
            : pickStrategy(ctx, t);
        t.trainingLog = [];
    });

    const worked = new Map<string, Array<keyof Attributes>>();
    cast.forEach(t => worked.set(t.id, []));

    for (let day = 0; day < TRAINING.days; day++) {
        // A4: each day gets its own stream so the three days are independently
        // replayable — a change to day three must not reshuffle day one.
        ctx.rng = new RNG(`${ctx.state.seed}-training-day${day + 1}`);
        ctx.logEvent(DAY_HEADLINES[day] ?? `DAY ${day + 1} ON THE TRAINING FLOOR.`, [], {
            important: true, category: 'training',
        });

        const stationsToday = new Map<string, keyof Attributes>();
        cast.forEach(t => {
            const history = worked.get(t.id)!;
            const attr = pickStation(ctx, t, history);
            history.push(attr);
            stationsToday.set(t.id, attr);
        });
        // One named station per discipline per day, so the tribute described
        // working the grappling mat is the tribute described arguing at the
        // grappling mat an hour later. Picking a fresh name in each pass read
        // as two different places.
        const stationNames = new Map<keyof Attributes, string>();
        ATTRS.forEach(attr => stationNames.set(attr, ctx.rng.pick(TRAINING_STATIONS[attr])));

        cast.forEach(t => {
            const attr = stationsToday.get(t.id)!;
            attemptStation(ctx, t, attr, stationNames.get(attr)!, day, cast);
        });
        // The Careers form theirs on day one and make sure the room sees it —
        // which is most of where the pack's menace comes from in the source
        // material. Leaving it to the ordinary station pairing meant the pack
        // only announced itself if the roll happened to put two of them at the
        // same drill, which is exactly the thing the pack does not leave to
        // chance.
        if (day + 1 === TRAINING.careerPactDay) declareCareerPact(ctx, cast);
        runFloorSocial(ctx, day, stationsToday, stationNames, cast);
        observeFloor(ctx, day, stationsToday, stationNames, cast);
        eveningBeat(ctx, day);
    }

    // Attributes settle once, at the end of the three days, rather than being
    // rounded three separate times.
    ctx.rng = new RNG(`${ctx.state.seed}-training-sessions`);
    cast.forEach(t => {
        (Object.keys(t.attributes) as Array<keyof Attributes>).forEach(k => {
            t.attributes[k] = Math.max(TRAINING_FLOOR.attributeFloor,
                Math.min(TRAINING_FLOOR.attributeCeiling, Math.round(t.attributes[k])));
        });
        t.attributes.strength = Math.min(t.attributes.strength, strengthCapForAge(t.age));
    });

    // ---- 3. The private sessions ----
    // Scored but not published: nobody knows anyone's number until the
    // broadcast, which is how the source material orders it.
    const stunts: Tribute[] = [];
    cast.forEach(t => {
        const totalStats = Object.values(t.attributes).reduce((a, b) => a + b, 0);
        const bestSkill = Math.max(
            profOf(t, 'melee'), profOf(t, 'ranged'), profOf(t, 'forage'), profOf(t, 'tracking'));

        // Base band: 1-8, from what they can actually do in front of a panel.
        // Calibrated against the source material rather than against the stat
        // block: the middle of the board is a 5 or a 6, an 8 is a good tribute,
        // a 9 or 10 is a Career or a genuine threat, and 11 is a talking point
        // for a decade. See the training-score band in `scripts/soak.ts`.
        let score = Math.floor(totalStats / TRAINING_SCORE.statsPerPoint)
            + Math.floor(bestSkill / TRAINING_SCORE.skillPerPoint)
            + ctx.rng.nextInt(TRAINING_SCORE.jitterMin, TRAINING_SCORE.jitterMax);
        if (t.isCareer) score += TRAINING_SCORE.careerBonus;

        if (t.trainingStrategy === 'showcase') score += TRAINING.showcaseBonus;
        if (t.trainingStrategy === 'conceal') score -= TRAINING.concealPenalty;

        // The Katniss beat: the gallery has stopped watching, and somebody does
        // something they cannot ignore.
        const stunt = t.trainingStrategy !== 'conceal' && ctx.rng.chance(TRAINING.stuntChance);
        if (stunt) {
            score += TRAINING.stuntBonus;
            stunts.push(t);
        }
        score = Math.min(TRAINING_SCORE.baseCeiling, Math.max(TRAINING_SCORE.baseFloor, score));

        // Elite band: 9-12, each step exponentially harder than the last.
        if (score === TRAINING_SCORE.baseCeiling) {
            for (let extra = 1; extra <= TRAINING_SCORE.eliteGates; extra++) {
                if (ctx.rng.chance(eliteGateChance(t, extra) * (stunt ? TRAINING_SCORE.stuntGateMultiplier : 1))) score = TRAINING_SCORE.baseCeiling + extra;
                else break;
            }
        }

        t.trainingScore = score;
    });

    stunts.forEach(t => {
        ctx.logEvent(
            `Behind the doors of the private session, ${t.name} does something the Gamemakers were not expecting, at a moment when half of them had stopped watching. Nobody in that room will forget it.`,
            [t.id],
            { important: true, category: 'training' }
        );
    });

    // ---- 4. The broadcast ----
    ctx.logEvent(
        'The training scores are read out on Capitol television, district by district. Twenty-four tributes watch a number appear beside their own face.',
        [],
        { important: true, category: 'training' }
    );

    cast.forEach(t => {
        addExcitement(t, t.trainingScore * TRAINING.broadcastExcitementPerPoint);
        if (t.trainingStrategy === 'showcase') t.sponsorTrust += TRAINING.showcaseTrust;
        if (t.trainingStrategy === 'conceal') t.sponsorTrust += TRAINING.concealTrust;
        if (t.trainingScore >= TRAINING.eliteTrustScore) t.sponsorTrust += TRAINING.eliteTrust;
        else if (t.trainingScore >= TRAINING.strongTrustScore) t.sponsorTrust += TRAINING.strongTrust;
        t.sponsorTrust = Math.max(0, Math.min(100, t.sponsorTrust + traitMod(t, 'sponsorTrust')));
        clampTribute(t);

        const verdictPool = t.trainingScore >= TRAINING.legendaryVerdictScore ? TRAINING_VERDICTS.legendary
            : t.trainingScore >= TRAINING.eliteVerdictScore ? TRAINING_VERDICTS.elite
            : t.trainingScore >= TRAINING.solidVerdictScore ? TRAINING_VERDICTS.solid
            : TRAINING_VERDICTS.poor;
        const verdict = ctx.pickText(verdictPool).replace(/\{tribute\}/g, t.name);

        ctx.logEvent(
            `${t.name} of District ${t.district} scores a ${t.trainingScore}. ${verdict}`,
            [t.id],
            { important: t.trainingScore >= TRAINING.eliteVerdictScore, category: 'training' }
        );
    });

    // Training does not happen in a vacuum. Twenty-three tributes are
    // watching that broadcast, and a 10 changes how every one of them sleeps.
    cast.forEach(t => {
        if (t.trainingScore < TRAINING.intimidationScore) return;

        t.vitals.sanity = Math.min(100, t.vitals.sanity + TRAINING.confidenceSanity);
        ctx.logEvent(
            ctx.pickText(INTIMIDATION_TEXTS)
                .split('{tribute}').join(t.name)
                .split('{score}').join(String(t.trainingScore)),
            [t.id],
            { important: true, category: 'training' }
        );

        const severity = (t.trainingScore - TRAINING.intimidationScore + 1) / TRAINING.intimidationSeverityBand;
        cast.forEach(other => {
            if (other.id === t.id) return;
            if (other.isCareer || other.traits.includes('Bloodthirsty')) {
                // Careers do not flinch; they file it under 'rival'.
                adjustRel(other, t.id, -TRAINING.careerRespect * severity);
            } else {
                other.vitals.sanity -= TRAINING.intimidationSanity * severity;
                adjustRel(other, t.id, -TRAINING.intimidationRelationship * severity);
                // The intimidation used to evaporate the moment the sanity hit
                // landed. It should stick to the person: this is how a Career's
                // reputation follows them into the arena.
                addFear(other, t.id, (t.trainingScore - TRAINING_SCORE.baseCeiling) * FEAR.perTrainingPointOverEight);
            }
            clampTribute(other);
        });
        clampTribute(t);
    });

    // The Capitol always crowns a favourite.
    const ranked = [...cast].sort((a, b) => b.trainingScore - a.trainingScore);
    const top = ranked[0];
    if (top) {
        const tied = ranked.filter(t => t.trainingScore === top.trainingScore);
        const names = tied.map(t => `${t.name} (D${t.district})`).join(', ');
        ctx.logEvent(
            tied.length > 1
                ? `TRAINING RESULTS: A ${top.trainingScore} is shared at the top of the board by ${names}. The bookmakers rewrite their odds overnight.`
                : `TRAINING RESULTS: ${top.name} of District ${top.district} tops the board with a ${top.trainingScore}. Every other tribute now knows exactly who to avoid.`,
            tied.map(t => t.id),
            { important: true, category: 'training' }
        );
    }

    // Somebody hid what they can do, and the arena is about to find out.
    const hidden = cast.filter(t => t.trainingStrategy === 'conceal' && t.trainingScore <= TRAINING.hiddenScore);
    if (hidden.length > 0) {
        ctx.logEvent(
            `Nobody is talking about ${hidden.map(t => t.name).join(', ')}. That is, in every case, the entire point.`,
            hidden.map(t => t.id),
            { category: 'training' }
        );
    }
}
