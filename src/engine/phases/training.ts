import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Attributes, Proficiency, Tribute } from '../../models/types';
import { TRAINING_STATIONS, TRAINING_VERDICTS, INTIMIDATION_TEXTS } from '../../data/flavorText';
import { FEAR, TRAINING, TRAINING_FLOOR, TRAINING_SCORE } from '../../data/balance';
import { addFear } from '../fear';
import { strengthCapForAge } from '../generator';
import { LEGACY_EFFECTS, craftOf, legacyOf } from '../../data/districts';
import { adjustRel } from '../relationships';
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
const STATION_SKILL: Partial<Record<keyof Attributes, Proficiency>> = {
    strength: 'melee',
    agility: 'ranged',
    intelligence: 'forage',
    stealth: 'tracking',
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

export function processTraining(ctx: SimContext) {
    ctx.state.phase = 'training';
    ctx.rng = new RNG(`${ctx.state.seed}-training`);
    const cast = getAlive(ctx.state);

    // ---- 1-2. Three days on the floor, and a decision about being watched ----
    const worked = new Map<string, Array<keyof Attributes>>();
    cast.forEach(t => {
        t.trainingStrategy = pickStrategy(ctx, t);
        const stations: Array<keyof Attributes> = [];
        for (let day = 0; day < TRAINING.days; day++) {
            stations.push(pickStation(ctx, t, stations));
        }
        worked.set(t.id, stations);

        stations.forEach(attr => {
            // Aptitude compounds: a day on something you are already good at
            // gets you further than a day on something you are not.
            const aptitude = TRAINING_FLOOR.aptitudeBase + t.attributes[attr] / TRAINING_FLOOR.aptitudeDivisor;
            const ceiling = attr === 'strength' ? strengthCapForAge(t.age) : TRAINING_FLOOR.attributeCeiling;
            t.attributes[attr] = Math.min(ceiling,
                t.attributes[attr] + TRAINING.stationAttributeGain * aptitude);
            const skill = STATION_SKILL[attr];
            if (skill) {
                for (let i = 0; i < Math.round(TRAINING.stationProficiencyGain / TRAINING_FLOOR.proficiencyStep); i++) {
                    trainProficiency(t, skill);
                }
            }
        });

        (Object.keys(t.attributes) as Array<keyof Attributes>).forEach(k => {
            t.attributes[k] = Math.max(TRAINING_FLOOR.attributeFloor,
                Math.min(TRAINING_FLOOR.attributeCeiling, Math.round(t.attributes[k])));
        });
        t.attributes.strength = Math.min(t.attributes.strength, strengthCapForAge(t.age));

        const headline = ctx.rng.pick(stations);
        ctx.logEvent(
            STRATEGY_LINES[t.trainingStrategy](t, ctx.rng.pick(TRAINING_STATIONS[headline])),
            [t.id],
            { category: 'training' }
        );
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
