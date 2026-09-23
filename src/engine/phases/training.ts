import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Attributes, Proficiency, TrainingPact, Tribute, trainingPhaseFor } from '../../models/types';
import {
    TRAINING_STATIONS, TRAINING_VERDICTS, INTIMIDATION_TEXTS,
    TRAINING_ALTERCATION, TRAINING_EVENING, TRAINING_FAILURE, TRAINING_MINGLE,
    TRAINING_OBSERVATION, TRAINING_STRUGGLE, TRAINING_TEAMUP,
    FLOOR_TOPICS, TRAINING_SNUB, TRAINING_THREAT, TRAINING_MOCK, TRAINING_THEFT,
    TRAINING_EXCLUSION, TRAINING_PACT_BROKEN, TRAINING_LUNCH_SIT, TRAINING_LUNCH_ALONE, TRAINING_LUNCH_CAREER,
    TRAINING_GROUP_TALK, TRAINING_GROUP_TENSION, TRAINING_LUNCH_TABLE, TRAINING_LUNCH_CLASH,
    TRAINING_LUNCH_KIND, TRAINING_LUNCH_INTRO, TRAINING_LUNCH_COLD, TRAINING_LUNCH_SHUNNED,
    TRAINING_LUNCH_SMALLTALK, TRAINING_LUNCH_WATCH,
    SCORE_REACTIONS,
} from '../../data/flavorText';
import { FEAR, PREGAMES, PRE_ARENA, RESPECT, TRAINING, TRAINING_FLOOR, TRAINING_SCORE } from '../../data/balance';
import { addFear, reduceFear } from '../fear';
import { strengthCapForAge } from '../generator';
import { LEGACY_EFFECTS, craftOf, legacyOf } from '../../data/districts';
import { adjustMutual, adjustRel, adjustRespect, adjustTrust, getRel, respectOf } from '../relationships';
import { noteContact, noteFight } from '../memory';
import { ARCHETYPES, archetypeAntipathy } from '../../data/archetypes';
import { clampTribute } from '../vitals';
import { addExcitement } from '../audience';
import { profOf, trainProficiency } from '../proficiency';
import { traitMod } from '../../data/traits';
import { loseSanity } from '../sanityBands';

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
    // §8a: `meritCareerArchetype` removed — it was redundant with
    // `meritCareer` (a Career-archetype tribute is almost always from a Career
    // district) and was one of six stacking advantages behind the Career
    // archetype's 2.2x win rate.
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
    // `careerConceal` is kept as the shove on the balanced/showcase split; the
    // conceal branch itself is closed to Careers outright, below.
    if (t.isCareer) { showcase += TRAINING_FLOOR.careerShowcase; conceal += TRAINING_FLOOR.careerConceal; }
    if (t.archetype === 'trickster' || t.archetype === 'strategist') conceal += TRAINING_FLOOR.schemerConceal;
    if (t.archetype === 'underdog') conceal += TRAINING_FLOOR.underdogConceal;
    if (t.attributes.intelligence >= TRAINING_FLOOR.cleverIntelligence) conceal += TRAINING_FLOOR.cleverConceal;
    if (t.traits.includes('Showman')) showcase += TRAINING_FLOOR.showmanShowcase;
    if (t.traits.includes('Unremarkable')) conceal += TRAINING_FLOOR.unremarkableConceal;
    if (t.fanFavourite) showcase += TRAINING_FLOOR.fanFavouriteShowcase;

    /*
     * §(requests): a Career never hides what they can do.
     *
     * The academy districts spend a decade building a reputation and then send
     * it into the arena ahead of the tribute — the whole Career strategy is
     * that everybody else already knows. Sandbagging is the opposite move, and
     * it belongs to the underdog. `careerConceal` was a -0.18 nudge, which
     * still left a clever Career (`cleverConceal`) or an Unremarkable one
     * concealing often enough to see it happen, and a District 2 tribute
     * quietly scoring a 4 reads as a bug to anybody watching.
     *
     * So it is a rule rather than a weight. A Career still chooses between
     * showcasing and playing it straight; they do not choose to look weak.
     */
    const roll = ctx.rng.nextFloat();
    if (!t.isCareer && roll < Math.max(0, conceal)) return 'conceal';
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
 * §6.2: one training-log entry, with the room attached.
 *
 * Written as an intersection rather than by widening the declared field: the
 * entry type is owned elsewhere, and an entry carrying `witnessIds` is still
 * assignable to it, so the extra column costs nothing at any existing reader.
 */
type TrainingLogEntry = NonNullable<Tribute['trainingLog']>[number];

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
    witnesses: Tribute[],
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

    // §6.2: who else was standing at that station. The log recorded the work
    // and never the room, so a tribute's three days read as a solitary
    // training montage — and nothing downstream could ask the one question
    // that matters about a training floor, which is who saw it.
    const entry: TrainingLogEntry = {
        day: day + 1, station, attr, outcome,
        witnessIds: witnesses.filter(w => w.id !== t.id).map(w => w.id),
    };
    t.trainingLog = [...(t.trainingLog ?? []), entry];

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

    /*
     * REQUEST: "sometimes in training logs, it mentions other tributes but does
     * not name the tribute and give an effect".
     *
     * Exactly right, and it was only ever the prose. The floor already lost
     * respect and the Careers already stopped being afraid — the mechanics were
     * there. What the line said was "four people notice and one of them files
     * it away", which names nobody, so the reader cannot follow it up and the
     * one who filed it away was not a person the run contains.
     *
     * The lines that reference a watcher carry a `{watcher}` token now, and it
     * is filled with somebody who is actually standing there. That tribute is
     * named in the event's participants — so the chronicle filter finds it —
     * and takes a sharper read than the rest of the room, because paying
     * attention is the thing the line says they did.
     */
    const line = ctx.pickText(variantPool(TRAINING_FAILURE, t));
    const audience = floor.filter(o => o.id !== t.id);
    const watcher = line.includes('{watcher}') && audience.length > 0
        ? audience[ctx.rng.nextInt(0, audience.length)]
        : undefined;
    ctx.logEvent(
        fillLine(line, { tribute: t.name, station, watcher: watcher?.name ?? 'somebody' }),
        watcher ? [t.id, watcher.id] : [t.id],
        { type: 'tribute-paid', important: true, category: 'training' }
    );
    loseSanity(t, TRAINING.failureSanity);
    clampTribute(t);
    floor.forEach(o => {
        if (o.id === t.id) return;
        adjustRespect(o, t.id, -TRAINING.failureRespect);
        // The one who was watching properly reads more into it than the room did.
        if (o.id === watcher?.id) adjustRespect(o, t.id, -TRAINING.watcherExtraRespect);
        // A Career who watches somebody fail publicly stops being wary of them
        // and starts thinking of them as a name to get out of the way early.
        // This is the other half of what makes concealing a genuine gamble.
        if (o.isCareer || o.archetype === 'career') reduceFear(o, t.id, TRAINING.failureCareerFearDrop);
    });
    return outcome;
}

/**
 * §6.2: the room revises, from what it actually watched.
 *
 * `attemptStation` already moves the whole floor's respect — everybody hears
 * about a spectacular failure by the evening. This is the closer read: the
 * five people standing at the same rack saw the work itself, and they revise
 * harder for it. Two tributes who spent a day failing at the same thing come
 * away with something the rest of the floor does not have, which is the other
 * half of why a shared station is worth simulating at all.
 */
function runWitnessRevisions(
    ctx: SimContext,
    groups: Map<keyof Attributes, Tribute[]>,
    outcomes: Map<string, StationOutcome>,
    stationNames: Map<keyof Attributes, string>,
) {
    groups.forEach((group, attr) => {
        if (group.length < 2) return;
        group.forEach(t => {
            const outcome = outcomes.get(t.id);
            if (outcome === 'success') {
                // Watching skilled work done properly, from a metre away.
                group.forEach(w => { if (w.id !== t.id) adjustRespect(w, t.id, RESPECT.witnessCompetence); });
                return;
            }
            if (outcome === undefined) return;
            group.forEach(w => {
                // Ordered so each struggling pair is counted once.
                if (w.id <= t.id) return;
                const theirs = outcomes.get(w.id);
                if (theirs !== 'struggle' && theirs !== 'failure') return;
                adjustMutual(ctx.state, t, w, TRAINING.mingleWarmth);
                noteContact(ctx.state, t, w);
                if (!ctx.rng.chance(TRAINING.observationLineChance)) return;
                ctx.logEvent(
                    `${t.name} and ${w.name} spend the afternoon failing at the ${stationNames.get(attr) ?? 'same station'} in front of each other, and by the end of it neither is pretending otherwise.`,
                    [t.id, w.id],
                    { category: 'training' }
                );
            });
        });
    });
}

/**
 * A4(b/c/d): what happens between two tributes who spent the day at the same
 * station — which, before this, was nothing at all. The only inter-tribute
 * interaction in the entire training phase was the post-broadcast intimidation
 * pass, which is also why `performed` measured 8 across 400 runs: a showmance
 * needs a contact streak, and there was no way to start one before the arena.
 */
/**
 * §(requests 8/13): district partners work together.
 *
 * `runFloorSocial` pairs a station's occupants off disjointly by walking the
 * list two at a time, so who ends up with whom is decided entirely by list
 * order. This pulls each district pair adjacent before that walk, most
 * aggressively on day one — two people from the same district standing at the
 * same bench on the first morning will find each other before either of them
 * talks to a stranger.
 */
function pairDistrictsFirst(ctx: SimContext, group: Tribute[], day: number): Tribute[] {
    /*
     * §(requests, sociability pass): the pull is a roll, not a rule.
     *
     * It used to be unconditional on days one and two and off on day three,
     * so a district pair standing at the same bench on the first morning
     * *always* worked together — which, stacked on `affinityPartner`, is most
     * of why 52.9% of measured two-tribute training lines were same-district
     * in a room where 23 of anybody's 23 neighbours are from elsewhere.
     */
    const pull = (TRAINING.partnerDayDecay[day - 1] ?? 1) * TRAINING.partnerPairChance;
    const out: Tribute[] = [];
    const taken = new Set<string>();
    group.forEach(t => {
        if (taken.has(t.id)) return;
        taken.add(t.id);
        out.push(t);
        if (!ctx.rng.chance(pull)) return;
        const partner = group.find(o => !taken.has(o.id) && o.district === t.district);
        if (partner) { taken.add(partner.id); out.push(partner); }
    });
    return out;
}

/**
 * §(requests, sociability pass): the knot that forms at a busy station.
 *
 * The floor's only social unit was the disjoint pair, and it showed: 4.9% of
 * measured training-phase lines named three or more tributes, and *none* of
 * the hostile ones did. Five people at one rack do not hold two private
 * conversations and leave one person out of both — they form a group, and the
 * group either closes around somebody or excludes them. Both halves are here,
 * split by `clusterHostileShare`.
 *
 * Deliberately drawn across districts first: the group is the cheapest way a
 * tribute meets somebody they were not reaped beside.
 */
function runStationCluster(ctx: SimContext, group: Tribute[], station: string, day: number) {
    if (group.length < TRAINING.clusterMinSize) return;
    if (!ctx.rng.chance(TRAINING.clusterChance)) return;

    const shuffled = ctx.rng.shuffle(group);
    const picked: Tribute[] = [];
    const districts = new Set<number>();
    // One pass taking only new districts, then a second to top up: a group of
    // three from the same district is a district pair with an audience, which
    // the floor already had plenty of.
    shuffled.forEach(t => {
        if (picked.length >= TRAINING.clusterMaxSize || districts.has(t.district)) return;
        picked.push(t); districts.add(t.district);
    });
    shuffled.forEach(t => {
        if (picked.length >= TRAINING.clusterMaxSize || picked.includes(t)) return;
        picked.push(t);
    });
    if (picked.length < TRAINING.clusterMinSize) return;

    const [tribute, other, third] = picked;
    const vars = {
        tribute: tribute.name, other: other.name, third: third.name,
        station, topic: ctx.pickText(FLOOR_TOPICS),
    };
    // A group of people who already dislike each other turns more often than
    // the base share; the share alone made the cold groups feel unmotivated.
    const sour = picked.some(a => picked.some(b => a.id !== b.id && getRel(a, b.id) <= TRAINING.negativeRegard));
    const hostile = ctx.rng.chance(sour ? TRAINING.clusterHostileShare * 2 : TRAINING.clusterHostileShare);

    if (hostile) {
        ctx.logEvent(
            fillLine(ctx.pickText(TRAINING_GROUP_TENSION), vars),
            picked.slice(0, 3).map(t => t.id),
            { important: true, category: 'training' }
        );
        // `other` is the one the group closed around — every template above is
        // written that way round, so the bookkeeping matches the sentence.
        picked.forEach(t => {
            if (t.id === other.id) return;
            adjustMutual(ctx.state, t, other, TRAINING.clusterTensionRegard);
            addFear(other, t.id, TRAINING.clusterTensionFear, t);
            addExcitement(t, TRAINING.clusterExcitement);
        });
        loseSanity(other, TRAINING.lunchAloneSanity);
        clampTribute(other);
        noteFight(ctx.state, tribute, other);
        return;
    }

    ctx.logEvent(
        fillLine(ctx.pickText(TRAINING_GROUP_TALK), vars),
        picked.slice(0, 3).map(t => t.id),
        { category: 'training' }
    );
    picked.forEach(a => picked.forEach(b => {
        if (a.id >= b.id) return;
        adjustMutual(ctx.state, a, b, Math.round(TRAINING.clusterWarmth * floorAffinity(a, b, day).weight));
        noteContact(ctx.state, a, b);
    }));
    picked.forEach(t => trainProficiency(t, 'persuasion'));
}

/**
 * §(requests 10): the cold half of the training floor.
 *
 * Returns true when it produced a beat, so the caller skips the warm path for
 * that pair — a tribute who has just been threatened is not then going to
 * compare grips with the person who did it. Ordered by severity: the rarest
 * and most consequential first, so a theft is not pre-empted by a snub.
 */
function runNegativeBeat(ctx: SimContext, a: Tribute, b: Tribute, station: string, day: number): boolean {
    const regard = Math.min(getRel(a, b.id), getRel(b, a.id));
    const antipathy = archetypeAntipathy(a.archetype, b.archetype);
    // Who is doing it to whom: the one who thinks less of the other, and who
    // has some standing to be doing it from.
    const aggressor = getRel(a, b.id) <= getRel(b, a.id) ? a : b;
    const target = aggressor === a ? b : a;
    const say = (pool: string[], category: 'training' = 'training', important = false) => {
        ctx.logEvent(
            fillLine(ctx.pickText(pool), {
                tribute: aggressor.name, other: target.name, station,
                topic: ctx.pickText(FLOOR_TOPICS),
            }),
            [aggressor.id, target.id],
            { important, category }
        );
    };

    // A pact that does not survive the week. This is checked before the regard
    // gate below: an agreement coming apart is about the agreement, and a pair
    // who struck one are warm almost by definition — gating it on coldness
    // meant it fired in three runs in a hundred.
    if (aggressor.trainingPact?.includes(target.id)
        && ctx.rng.chance(TRAINING.pactBreakChance * (1 + Math.max(0, traitMod(aggressor, 'treachery'))))) {
        aggressor.trainingPact = aggressor.trainingPact.filter(id => id !== target.id);
        target.trainingPact = (target.trainingPact ?? []).filter(id => id !== aggressor.id);
        say(TRAINING_PACT_BROKEN, 'training', true);
        adjustMutual(ctx.state, aggressor, target, TRAINING.pactBreakRegard);
        return true;
    }

    if (regard > TRAINING.negativeRegard && !antipathy) return false;

    // Taking something is the one that carries into the arena as a grudge.
    if (ctx.rng.chance(TRAINING.theftChance)) {
        say(TRAINING_THEFT, 'training', true);
        adjustMutual(ctx.state, aggressor, target, TRAINING.theftRegard);
        addFear(target, aggressor.id, TRAINING.threatFear / 2, aggressor);
        aggressor.sponsorTrust = Math.max(0, aggressor.sponsorTrust - TRAINING.aggressorTrust);
        return true;
    }

    // A threat is a Career's instrument, and it is worth sponsor money.
    // Read through the trait table rather than by name: anybody the mods row
    // says presses is somebody who would do this.
    if ((isCareerish(aggressor) || traitMod(aggressor, 'aggressionScore') > 0)
        && ctx.rng.chance(TRAINING.threatChance)) {
        say(TRAINING_THREAT, 'training', true);
        adjustMutual(ctx.state, aggressor, target, TRAINING.threatRegard);
        addFear(target, aggressor.id, TRAINING.threatFear, aggressor);
        addExcitement(aggressor, TRAINING.mockExcitement);
        trainProficiency(aggressor, 'intimidation');
        return true;
    }

    // Mockery plays to the gallery, which is exactly why it is done.
    if (ctx.rng.chance(TRAINING.mockChance)) {
        say(TRAINING_MOCK);
        adjustMutual(ctx.state, aggressor, target, TRAINING.mockRegard);
        addExcitement(aggressor, TRAINING.mockExcitement);
        loseSanity(target, 2);
        return true;
    }

    // Shutting somebody out of a group is quieter and lands just as hard.
    if (ctx.rng.chance(TRAINING.exclusionChance)) {
        say(TRAINING_EXCLUSION);
        adjustMutual(ctx.state, aggressor, target, TRAINING.exclusionRegard);
        loseSanity(target, 2);
        return true;
    }

    if (ctx.rng.chance(TRAINING.snubChance)) {
        say(TRAINING_SNUB);
        adjustMutual(ctx.state, aggressor, target, TRAINING.snubRegard);
        return true;
    }
    // Day three is when a room that has been cold all week finally settles.
    if (day >= TRAINING.days && regard < 0 && ctx.rng.chance(TRAINING.snubChance)) {
        say(TRAINING_SNUB);
        adjustMutual(ctx.state, aggressor, target, TRAINING.snubRegard);
        return true;
    }
    return false;
}

/**
 * §(requests 13): how much these two want an agreement with each other.
 *
 * Most of it is the district: the person you were reaped beside is the one ally
 * you have any reason to trust, and almost every pairing in the source material
 * starts there. On top of that sits who they each are — an archetype that wants
 * company, a trait that keeps a word or breaks one — so a Loyal district partner
 * and a Treacherous one are not the same offer.
 */
function pactWillingness(a: Tribute, b: Tribute): number {
    let weight = a.district === b.district ? TRAINING.pactPartnerMultiplier : 1;
    [a, b].forEach(t => {
        weight *= 1 + ARCHETYPES[t.archetype].allianceAffinity;
        weight *= 1 + traitMod(t, 'allianceAffinity');
        // Somebody who is already planning to break it is readier to make it.
        weight *= 1 + Math.max(0, traitMod(t, 'treachery')) * 0.5;
    });
    return Math.max(0.05, weight);
}

/**
 * §(requests 9): the lunch hour, which is where the politics actually happens.
 *
 * The three floor days were three days of stations: every social beat had to
 * take place while two people were holding weapons at a drill, which is a very
 * narrow window for "these two decided to trust each other". A cast eats in the
 * same room every day. Who sits with whom is the most legible social fact of
 * the week, and it was the one thing the pre-Games never showed.
 *
 * Deliberately station-free: no work happens here, only people. District pairs
 * find each other first on day one and the room widens out across the three,
 * which is the same curve `floorAffinity` runs on.
 */
function runLunchClashes(ctx: SimContext, day: number, cast: Tribute[]) {
    for (let attempt = 0; attempt < TRAINING.lunchClashAttempts; attempt++) {
        if (!ctx.rng.chance(TRAINING.lunchClashChance)) continue;
        // The coldest pair in the hall, and whoever is sitting closest to it.
        const pairs: Array<{ a: Tribute; b: Tribute; regard: number }> = [];
        cast.forEach(a => cast.forEach(b => {
            if (a.id >= b.id) return;
            pairs.push({ a, b, regard: Math.min(getRel(a, b.id), getRel(b, a.id)) });
        }));
        const worst = pairs.sort((x, y) => x.regard - y.regard)[0];
        if (!worst || worst.regard > TRAINING.negativeRegard) continue;
        const third = ctx.rng.pickOrUndefined(cast.filter(t => t.id !== worst.a.id && t.id !== worst.b.id));
        if (!third) continue;
        // The aggressor is the one who thinks less of the other, same rule the
        // station beats use, so the hall and the floor agree about who is who.
        const aggressor = getRel(worst.a, worst.b.id) <= getRel(worst.b, worst.a.id) ? worst.a : worst.b;
        const target = aggressor === worst.a ? worst.b : worst.a;
        ctx.logEvent(
            fillLine(ctx.pickText(TRAINING_LUNCH_CLASH), {
                tribute: aggressor.name, other: target.name, third: third.name,
                topic: ctx.pickText(FLOOR_TOPICS),
            }),
            [aggressor.id, target.id, third.id],
            { important: true, category: 'training' }
        );
        adjustMutual(ctx.state, aggressor, target, TRAINING.lunchClashRegard);
        addFear(target, aggressor.id, TRAINING.lunchClashFear, aggressor);
        addExcitement(aggressor, TRAINING.lunchClashExcitement);
        loseSanity(target, TRAINING.lunchAloneSanity);
        clampTribute(target);
        noteFight(ctx.state, aggressor, target);
        // A witness is not neutral: they have watched somebody decide, in front
        // of the room, what they are prepared to do before the Games start.
        addFear(third, aggressor.id, TRAINING.lunchClashFear, aggressor);
    }
}

/**
 * §(requests): what happens at lunch that is not the seating plan.
 *
 * Who sat with whom was the whole hour, and it had exactly two consequences:
 * warmth for a seated pair, and a clash between the coldest pair in the hall.
 * A canteen is mostly smaller than that — a plate pushed across, a portion
 * lifted on the way past, an introduction, a bench closed against somebody,
 * half an hour of nothing much — and each of those is a different thing to
 * have happened to two people, so each moves them differently.
 *
 * Three registers, weighted: warm raises regard and trust, cold lowers regard
 * and leaves fear behind, flat barely moves the numbers but still counts as
 * contact, because two people who ate at the same bench know each other a
 * little better than two who did not. Partners are drawn from a shortlist of
 * the warmest (or coldest) people to hand rather than straight off the top,
 * so the hour is not the same two tributes over and over.
 */
function runLunchBeats(ctx: SimContext, cast: Tribute[]) {
    const careers = cast.filter(isCareerish);
    const pack = careers.length >= 2 ? careers : [];
    const room = cast.filter(t => !pack.includes(t));

    /** Somebody, and one of the people they have most (or least) time for. */
    const pair = (pool: Tribute[], tone: 'warm' | 'cold' | 'flat'): [Tribute, Tribute] | undefined => {
        if (pool.length < 2) return undefined;
        const a = ctx.rng.pick(pool);
        const others = pool.filter(t => t.id !== a.id);
        if (others.length === 0) return undefined;
        if (tone === 'flat') return [a, ctx.rng.pick(others)];
        const sorted = [...others].sort((x, y) => tone === 'warm'
            ? getRel(a, y.id) - getRel(a, x.id)
            : getRel(a, x.id) - getRel(a, y.id));
        const pick = ctx.rng.pickOrUndefined(sorted.slice(0, TRAINING.lunchBeatShortlist));
        return pick ? [a, pick] : undefined;
    };

    const log = (line: string, who: Tribute[], important: boolean, category: 'training' | 'sanity') =>
        ctx.logEvent(line, who.map(t => t.id), { important, category });

    for (let attempt = 0; attempt < TRAINING.lunchBeatAttempts; attempt++) {
        if (!ctx.rng.chance(TRAINING.lunchBeatChance)) continue;
        const total = TRAINING.lunchBeatWarmWeight + TRAINING.lunchBeatColdWeight + TRAINING.lunchBeatFlatWeight;
        const roll = ctx.rng.nextFloat() * total;
        const tone = roll < TRAINING.lunchBeatWarmWeight
            ? 'warm'
            : roll < TRAINING.lunchBeatWarmWeight + TRAINING.lunchBeatColdWeight ? 'cold' : 'flat';

        if (tone === 'warm') {
            const two = pair(room.length >= 2 ? room : cast, 'warm');
            if (!two) continue;
            const [a, b] = two;
            // A share or a held seat is between two people; an introduction is
            // the one warm thing that needs a third, and is worth less to each
            // pair because none of them chose it.
            if (ctx.rng.chance(TRAINING.lunchKindChance)) {
                log(fillLine(ctx.pickText(TRAINING_LUNCH_KIND), { tribute: a.name, other: b.name }), [a, b], false, 'training');
                adjustMutual(ctx.state, a, b, TRAINING.lunchKindRegard);
                adjustTrust(b, a.id, TRAINING.lunchKindTrust);
                noteContact(ctx.state, a, b);
                continue;
            }
            const third = ctx.rng.pickOrUndefined(cast.filter(t => t.id !== a.id && t.id !== b.id));
            if (!third) continue;
            log(fillLine(ctx.pickText(TRAINING_LUNCH_INTRO), {
                tribute: a.name, other: b.name, third: third.name, topic: ctx.pickText(FLOOR_TOPICS),
            }), [a, b, third], true, 'training');
            [[a, b], [a, third], [b, third]].forEach(([x, y]) => {
                adjustMutual(ctx.state, x, y, TRAINING.lunchIntroRegard);
                noteContact(ctx.state, x, y);
            });
            adjustTrust(b, third.id, TRAINING.lunchIntroTrust);
            adjustTrust(third, b.id, TRAINING.lunchIntroTrust);
            continue;
        }

        if (tone === 'cold') {
            const two = pair(cast, 'cold');
            if (!two) continue;
            // The aggressor is the one who thinks less of the other, the same
            // rule the floor and the clashes use.
            const [x, y] = two;
            const aggressor = getRel(x, y.id) <= getRel(y, x.id) ? x : y;
            const target = aggressor === x ? y : x;
            if (ctx.rng.chance(TRAINING.lunchColdChance)) {
                log(fillLine(ctx.pickText(TRAINING_LUNCH_COLD), { tribute: aggressor.name, other: target.name }), [aggressor, target], false, 'training');
                adjustMutual(ctx.state, aggressor, target, TRAINING.lunchColdRegard);
                addFear(target, aggressor.id, TRAINING.lunchColdFear, aggressor);
                loseSanity(target, TRAINING.lunchColdSanity);
                clampTribute(target);
                noteContact(ctx.state, aggressor, target);
                continue;
            }
            // Shutting somebody out takes two, and the one who went along with
            // it is not neutral afterwards either.
            const third = ctx.rng.pickOrUndefined(cast.filter(t => t.id !== aggressor.id && t.id !== target.id));
            if (!third) continue;
            log(fillLine(ctx.pickText(TRAINING_LUNCH_SHUNNED), {
                tribute: aggressor.name, other: target.name, third: third.name,
            }), [aggressor, target, third], true, 'sanity');
            adjustMutual(ctx.state, aggressor, target, TRAINING.lunchShunRegard);
            adjustRel(target, third.id, TRAINING.lunchShunWitnessRegard);
            addFear(target, aggressor.id, TRAINING.lunchShunFear, aggressor);
            loseSanity(target, TRAINING.lunchShunSanity);
            clampTribute(target);
            noteContact(ctx.state, aggressor, target);
            noteContact(ctx.state, target, third);
            continue;
        }

        // Flat. Nothing is decided; the two of them simply ate near each other.
        const two = pair(room.length >= 2 ? room : cast, 'flat');
        if (!two) continue;
        const [a, b] = two;
        if (pack.length === 0 || ctx.rng.chance(TRAINING.lunchSmallTalkChance)) {
            log(fillLine(ctx.pickText(TRAINING_LUNCH_SMALLTALK), {
                tribute: a.name, other: b.name, topic: ctx.pickText(FLOOR_TOPICS),
            }), [a, b], false, 'training');
            adjustMutual(ctx.state, a, b, TRAINING.lunchSmallTalkRegard);
            noteContact(ctx.state, a, b);
            continue;
        }
        // Watching the pack eat: flat between the two watching, and the reason
        // the rest of the hall is afraid of the table they are watching.
        const head = [...pack].sort((p, q) => q.trainingScore - p.trainingScore || q.attributes.strength - p.attributes.strength)[0];
        log(fillLine(ctx.pickText(TRAINING_LUNCH_WATCH), {
            tribute: a.name, other: b.name, third: head.name, topic: ctx.pickText(FLOOR_TOPICS),
        }), [a, b, head], false, 'training');
        adjustMutual(ctx.state, a, b, TRAINING.lunchWatchRegard);
        noteContact(ctx.state, a, b);
        [a, b].forEach(w => addFear(w, head.id, TRAINING.lunchWatchFear, head));
    }
}

/**
 * §(requests, sociability pass): the lunch hall's cold register.
 *
 * A room with no weapons in it and no trainers between people is where a week
 * of this comes out, and the canteen had no hostile beats at all — measured,
 * zero of 12.9 negative training lines per run happened at lunch and zero
 * involved three people. Rolled twice a day so it is a register rather than a
 * rarity, and a witness is always named.
 */
function lunchPeriod(ctx: SimContext, day: number, cast: Tribute[]) {
    ctx.logEvent(
        day === 1
            ? 'The lunch bell goes on the first day. Twenty-four tributes carry trays into a room with no weapons in it and have to decide, in front of each other, where to sit.'
            : day === TRAINING.days
                ? 'The last lunch before the scores. By now everybody knows where they sit, and everybody knows what that means.'
                : `Lunch on the second day. The room has started to have a shape to it.`,
        [],
        { important: true, category: 'training' }
    );

    const careers = cast.filter(isCareerish);
    if (careers.length >= 2) {
        const head = [...careers].sort((x, y) => y.trainingScore - x.trainingScore || y.attributes.strength - x.attributes.strength)[0];
        // Whoever the line points at is named in it and is in its cast — the
        // pack is the subject, but a line about "two tributes" nobody names is
        // exactly the vagueness §(requests 11) is about.
        const outsiders = ctx.rng.shuffle(cast.filter(t => !isCareerish(t)));
        const first = outsiders[0];
        const second = outsiders[1];
        if (first && second) {
            // The template is drawn first so the cast can be built from the
            // placeholders it actually uses: a line that only names the head
            // must not claim two other people are in it.
            const template = ctx.pickText(TRAINING_LUNCH_CAREER);
            const involved = [head.id];
            if (template.includes('{first}')) involved.push(first.id);
            if (template.includes('{second}')) involved.push(second.id);
            ctx.logEvent(
                fillLine(template, { tribute: head.name, first: first.name, second: second.name }),
                involved,
                { important: true, category: 'training' }
            );
        }
        careers.forEach(c => { addExcitement(c, TRAINING.lunchCareerExcitement); });
        cast.filter(t => !isCareerish(t)).forEach(o => careers.forEach(c => addFear(o, c.id, TRAINING.lunchCareerFear, c)));
    }

    // Everyone who is not sitting at the Career table pairs off — district
    // partners first, then whoever they have most reason to sit with.
    const room = ctx.rng.shuffle(cast.filter(t => !(careers.length >= 2 && isCareerish(t))));
    /*
     * §(requests): one lunch, one table.
     *
     * The rounds below used to re-seat the room from scratch each time — the
     * comment above defended that as somebody moving to a second bench before
     * the bell. In practice it put the same tribute at two and three different
     * tables in the same sitting, which is not a canteen, it is a continuity
     * error: measured over 180 lunches, every one of them had somebody
     * double-seated — 3,122 instances, a mean of 17 per sitting.
     *
     * `seated` is now the whole hour rather than one round. The rounds still
     * earn their place — a tribute nobody sat with on the first pass can be
     * drawn in on the second — but once somebody has a bench they keep it.
     * Re-measured the same way: 0 double-seatings in 180 lunches.
     *
     * That costs lunch lines, which were what the rounds were for: 1,827 down
     * to 927 per 60 runs. The volume comes back as more *kinds* of lunch beat
     * (below) rather than as the same people seated twice.
     */
    const seated = new Set<string>();
    for (let round = 0; round < TRAINING.lunchRounds; round++) {
        room.forEach(t => {
            if (seated.has(t.id)) return;
            const candidates = room.filter(o => o.id !== t.id && !seated.has(o.id));
            if (candidates.length === 0) return;
            // Score the room the way the floor does, so lunch and the stations
            // agree about who these people are.
            const best = candidates
                .map(o => ({ o, weight: floorAffinity(t, o, day).weight * mingleWillingness(t, o) }))
                .sort((x, y) => y.weight - x.weight);
            const pick = best[0];
            if (!pick || !ctx.rng.chance(TRAINING.lunchPairChance * Math.min(2, pick.weight))) return;
            seated.add(t.id);
            seated.add(pick.o.id);
            const affinity = floorAffinity(t, pick.o, day);
            adjustMutual(ctx.state, t, pick.o, Math.round(TRAINING.lunchWarmth * Math.min(2, affinity.weight)));
            noteContact(ctx.state, t, pick.o);
            trainProficiency(t, 'persuasion');

            /*
             * §(requests, sociability pass): a seated pair draws a table.
             *
             * Lunch was twelve disjoint pairs a day — 32.7 lunch lines per run, of
             * which 0.25 named three or more people. Nobody eats in a hall of
             * twenty-four in strict twos, and the table is the thing the rest of
             * the room reads the week's alliances off. Preference goes to a
             * district the bench does not already have, for the same reason the
             * station groups draw that way.
             */
            const table = [t, pick.o];
            if (ctx.rng.chance(TRAINING.lunchTableChance)) {
                best.slice(1).forEach(c => {
                    if (table.length >= TRAINING.lunchTableMax) return;
                    if (seated.has(c.o.id)) return;
                    if (table.some(x => x.district === c.o.district)) return;
                    table.push(c.o);
                    seated.add(c.o.id);
                });
            }

            if (table.length >= 3) {
                const [a, b, c] = table;
                const extras = table.slice(3);
                const line = fillLine(ctx.pickText(TRAINING_LUNCH_TABLE), {
                    tribute: a.name, other: b.name, third: c.name, topic: ctx.pickText(FLOOR_TOPICS),
                }) + (extras.length > 0
                    // Named rather than implied: `npm run test:unnamed` ratchets on
                    // exactly this, and everybody at the bench is on the cast list.
                    ? ` ${extras.map(x => x.name).join(' and ')} ${extras.length > 1 ? 'pull' : 'pulls'} up at the same bench.`
                    : '');
                table.forEach(x => table.forEach(y => {
                    if (x.id >= y.id) return;
                    adjustMutual(ctx.state, x, y, TRAINING.lunchTableWarmth);
                    noteContact(ctx.state, x, y);
                }));
                table.forEach(x => trainProficiency(x, 'persuasion'));
                ctx.logEvent(line, table.map(x => x.id), { important: true, category: 'training' });
                return;
            }

            ctx.logEvent(
                fillLine(ctx.pickText(TRAINING_LUNCH_SIT), {
                    tribute: t.name, other: pick.o.name, topic: ctx.pickText(FLOOR_TOPICS),
                }),
                [t.id, pick.o.id],
                { category: 'training' }
            );
        });
    }

    runLunchClashes(ctx, day, cast);
    runLunchBeats(ctx, cast);

    // And the ones nobody sat with, which is its own fact about the week.
    cast.filter(t => !seated.has(t.id) && !(careers.length >= 2 && isCareerish(t))).forEach(t => {
        ctx.logEvent(
            fillLine(ctx.pickText(TRAINING_LUNCH_ALONE), { tribute: t.name }),
            [t.id],
            { category: 'sanity' }
        );
        loseSanity(t, TRAINING.lunchAloneSanity);
        // The Capitol has always had time for a tribute nobody will sit with.
        t.sponsorTrust = Math.min(100, t.sponsorTrust + TRAINING.lunchAloneTrust);
        clampTribute(t);
    });
}

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
        // §9 (requests): Careers at a station work with each other first.
        //
        // The shuffle paired everybody uniformly, so a Career spent most of the
        // three days making small talk with District 8 — which is neither what
        // the source material shows nor what the pack's menace is built out of.
        // Sorting the group so Careers are adjacent makes the disjoint pairing
        // below pair them together whenever two of them are at the same
        // station, and leaves the outer districts to each other.
        // §(requests 8/13): district partners are pulled adjacent before the
        // disjoint pairing runs, so two tributes from the same district who
        // happen to be at the same station work together rather than being
        // split across two other people. The pull is strongest on day one.
        const ordered = ctx.rng.shuffle(group)
            .sort((a, b) => Number(isCareerish(b)) - Number(isCareerish(a)));
        const partners = pairDistrictsFirst(ctx, ordered, day + 1);
        // §(requests, sociability pass): the station's group beat, before the
        // pairs — a knot forming is what the pairs then happen inside.
        runStationCluster(ctx, group, station, day + 1);
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
                    addFear(a, b.id, TRAINING.altercationFear, b);
                    addFear(b, a.id, TRAINING.altercationFear, a);
                    noteFight(ctx.state, a, b);
                    adjustMutual(ctx.state, a, b, TRAINING.altercationRegard);
                    [a, b].forEach(x => {
                        addExcitement(x, TRAINING.altercationExcitement);
                        x.sponsorTrust = Math.max(0, x.sponsorTrust + TRAINING.altercationTrust);
                    });
                    continue;
                }

                // §(requests 10): the floor's other register. Three days used
                // to produce warmth, one altercation pool and nothing else, so
                // a room of people who are about to kill each other read as a
                // summer course. A hostile pair that does not come to blows
                // still does something, and so does a confident tribute who
                // has decided somebody is beneath them.
                if (runNegativeBeat(ctx, a, b, station, day + 1)) continue;

                // (b) Mingling.
                //
                // §9 (requests): a Career does not chat with an outer-district
                // tribute. They will if that tribute is genuinely dangerous —
                // the pack recruits exactly one kind of outsider, and it is the
                // kind that can fight — or if the two of them already have an
                // agreement. Otherwise the Career is not interested, and the
                // measured effect of the old uniform roll was a floor on which
                // the pack was on cordial terms with half the field by day three.
                // §21: and how much they have in common, which the roll and
                // the line now agree about because both read the same call.
                const affinity = floorAffinity(a, b, day + 1);
                if (!ctx.rng.chance(TRAINING.mingleChance * mingleWillingness(a, b) * affinity.weight)) continue;
                // Warmth scales with the reason, so a district partner and two
                // strangers at the same bench are no longer the same event.
                adjustMutual(ctx.state, a, b, Math.round(TRAINING.mingleWarmth * affinity.weight));
                noteContact(ctx.state, a, b);
                ctx.logEvent(
                    fillLine(ctx.pickText(TRAINING_MINGLE), {
                        tribute: a.name, other: b.name, station, reason: affinity.reason,
                        // §(requests 11): the lines say what was discussed.
                        topic: ctx.pickText(FLOOR_TOPICS),
                    }),
                    [a.id, b.id],
                    { category: 'training' }
                );

                // (c) Team-ups, from day 2 — except the Careers, who do this on
                // day 1 and make sure it is seen, which is most of where the
                // pack's menace comes from in the source material.
                const bothCareer = (a.isCareer || a.archetype === 'career')
                    && (b.isCareer || b.archetype === 'career');
                // §(requests 13): a district pair can agree on day one. Anybody
                // else needs to have watched each other work for a day first.
                const samePartner = a.district === b.district;
                const eligibleDay = bothCareer ? TRAINING.careerPactDay : samePartner ? 1 : 2;
                if (day + 1 < eligibleDay) continue;
                if (Math.min(getRel(a, b.id), getRel(b, a.id)) < TRAINING.pactMinRegard) continue;
                if (a.trainingPact?.includes(b.id)) continue;
                // §(requests 13): a tribute whose own district partner is
                // still standing and still unpartnered is not out looking yet.
                // They can still take a cross-district offer — the Careers do
                // nothing else — but home comes first.
                const shopping = !samePartner
                    && [a, b].some(t => {
                        const partner = cast.find(o => o.id !== t.id && o.district === t.district && o.status === 'alive');
                        return !!partner && !t.trainingPact?.includes(partner.id);
                    });
                // §(requests): a cross-district agreement is the interesting
                // one, and it was the rare one. It gets the draw now, not
                // only the penalty for not having gone home first.
                const gate = TRAINING.pactChance * pactWillingness(a, b)
                    * (shopping ? TRAINING.crossBeforePartner : 1)
                    * (samePartner ? 1 : TRAINING.crossDistrictDraw);
                if (!ctx.rng.chance(gate)) continue;

                strikePact(a, b, day + 1);
                recordPactTerms(ctx, a, b, day + 1);
                adjustMutual(ctx.state, a, b, TRAINING.pactWarmth);
                ctx.logEvent(
                    fillLine(ctx.pickText(TRAINING_TEAMUP), {
                        tribute: a.name, other: b.name, station, reason: affinity.reason,
                        topic: ctx.pickText(FLOOR_TOPICS),
                    }),
                    [a.id, b.id],
                    { important: true, category: 'training' }
                );
            }
        }
    });
}

/**
 * §6.2: a pre-agreement, with the terms it was actually struck on.
 *
 * The flat `trainingPact` id list is still written exactly as before —
 * bloodbath.ts and proficiency.ts both read it, and neither needs to know any
 * of this. Alongside it goes the same agreement as an object: struck on a
 * given day, meant to a given degree, and lapsing. Terms and confidence are
 * finalised after the broadcast (`settlePacts`), because half of what a
 * tribute is agreeing to depends on a number neither of them has seen yet.
 */
function strikePact(a: Tribute, b: Tribute, _day: number) {
    a.trainingPact = [...(a.trainingPact ?? []), b.id];
    b.trainingPact = [...(b.trainingPact ?? []), a.id];
}

/**
 * A pact with real terms, as opposed to a handshake on the way to lunch. Rolled
 * per agreement; the ones that fail the roll stay in the flat list and nowhere
 * else, which is precisely what a handshake is worth.
 */
function recordPactTerms(ctx: SimContext, a: Tribute, b: Tribute, day: number) {
    if (!ctx.rng.chance(PRE_ARENA.pactTermsChance)) return;
    [[a, b], [b, a]].forEach(([x, y]) => {
        if (x.trainingPacts?.some(p => p.withId === y.id)) return;
        x.trainingPacts = [...(x.trainingPacts ?? []), {
            withId: y.id,
            // Provisional: settled once the scores are read out.
            kind: 'non-aggression',
            confidence: PRE_ARENA.pactConfidenceDay1 + (day - 1) * PRE_ARENA.pactConfidencePerDay,
            day,
            expiresCycle: PRE_ARENA.pactExpiryCycles,
        }];
    });
}

/**
 * §6.2: the scores are read out, and every agreement on the floor is quietly
 * repriced. A day-three pact with somebody who then scored a ten is a very
 * different object from a day-one handshake with somebody who scored a three,
 * and this is where the two stop being the same row.
 */
function settlePacts(cast: Tribute[]) {
    const byId = new Map(cast.map(t => [t.id, t]));
    cast.forEach(t => {
        t.trainingPacts = (t.trainingPacts ?? []).map(pact => {
            const other = byId.get(pact.withId);
            const scoreRead = other
                ? (other.trainingScore - TRAINING.solidVerdictScore) * PRE_ARENA.pactConfidencePerScorePoint
                : 0;
            const confidence = Math.max(0, Math.min(1, pact.confidence + scoreRead));
            const bothCareer = !!other && (t.isCareer || t.archetype === 'career')
                && (other.isCareer || other.archetype === 'career');
            // Terms follow conviction. Two Careers who agreed on day one are
            // agreeing about the Cornucopia and nothing else; two tributes who
            // have watched each other for three days and mean it are agreeing
            // to walk out of the bloodbath together.
            const kind: TrainingPact['kind'] = bothCareer ? 'cornucopia-rush'
                : confidence >= PRE_ARENA.pactConfidenceDay1 + PRE_ARENA.pactConfidencePerDay * 2 ? 'arena-alliance'
                : confidence >= PRE_ARENA.pactConfidenceDay1 + PRE_ARENA.pactConfidencePerDay ? 'share-supplies'
                : 'non-aggression';
            return {
                ...pact,
                kind,
                confidence,
                // Nobody says out loud that the agreement has an end date. It
                // does: how long it runs is how much they meant it.
                expiresCycle: Math.round(PRE_ARENA.pactExpiryCycles + confidence * PRE_ARENA.pactExpiryPerConfidence),
            };
        });
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
                addFear(observer, subject.id, TRAINING.observationFear, subject);
                adjustRespect(observer, subject.id, TRAINING.observationRespect);
            }
        });
    });

    // One line, from one tribute, so the observation pass reads as a beat
    // rather than as twenty-four silent bookkeeping updates.
    const watcher = ctx.rng.pick(cast);
    if (!ctx.rng.chance(TRAINING.observationLineChance)) return;
    const subject = ctx.rng.pickOrUndefined(cast.filter(o => o.id !== watcher.id));
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
/**
 * §21 (requests): why these two are getting on, and how much.
 *
 * The social engine already held every one of these facts and none of them
 * reached either the rolls or the log, so three days of pairings came out as
 * twenty-four interchangeable people being uniformly warm at each other, and
 * the chronicle could not say why any alliance existed. This returns both the
 * weight and the sentence, from the same data, so the two can never disagree.
 *
 * Deliberately a small list of legible reasons rather than a scoring model:
 * the point is that a reader of the finished log can follow it.
 */
function floorAffinity(a: Tribute, b: Tribute, day = 3): { weight: number; reason: string } {
    // District partners have known each other since before the reaping.
    //
    // §(requests 8): and on day one that is nearly the only thing anybody has
    // to go on. Twenty-three strangers and one person from home is not a hard
    // choice, so the partner weight is at its highest on the first day and
    // decays across the three — by day three the room has sorted itself by
    // who is actually useful, which is what the last day is for.
    if (a.district === b.district) {
        const pull = TRAINING.affinityPartner * (TRAINING.partnerDayDecay[day - 1] ?? 1);
        return { weight: pull, reason: `They are both from District ${a.district}.` };
    }
    // ...and the mirror of it: on day one a stranger from another district is
    // a stranger, and most of the room is not ready to talk to one yet.
    const strangerPenalty = TRAINING.strangerDayWeight[day - 1] ?? 1;
    // Districts that trade with each other: 3 and 6, 7 and 8, 9 and 10, 4 and 11.
    if (Math.abs(a.district - b.district) === 1) {
        return {
            weight: TRAINING.affinityNeighbour * strangerPenalty,
            reason: `Districts ${Math.min(a.district, b.district)} and ${Math.max(a.district, b.district)} work next to each other at home.`,
        };
    }
    // Two twelve-year-olds in a room of eighteen-year-olds find each other.
    if (a.age <= TRAINING.affinityYoungAge && b.age <= TRAINING.affinityYoungAge) {
        return { weight: TRAINING.affinityYoung * strangerPenalty, reason: `${a.name} is ${a.age} and ${b.name} is ${b.age}. Everybody else in the room is older.` };
    }
    // Somebody who rates you is somebody who will talk to you.
    const rated = Math.max(respectOf(a, b.id), respectOf(b, a.id));
    if (rated >= TRAINING.affinityRespect) {
        const admirer = respectOf(a, b.id) >= respectOf(b, a.id) ? a : b;
        const rate = admirer === a ? b : a;
        return { weight: TRAINING.affinityRated * strangerPenalty, reason: `${admirer.name} has been watching ${rate.name} work, and was impressed.` };
    }
    // The outer districts have the reaping in common and not much else.
    if (!isCareerish(a) && !isCareerish(b) && a.district >= TRAINING.affinityOuterFrom && b.district >= TRAINING.affinityOuterFrom) {
        return { weight: TRAINING.affinityOuter * strangerPenalty, reason: 'Neither of them volunteered and neither of them has been trained for this.' };
    }
    return { weight: strangerPenalty, reason: 'Neither of them has a reason beyond being put at the same station.' };
}

/** A Career by district or by temperament — both read as one on the floor. */
function isCareerish(t: Tribute): boolean {
    return t.isCareer || t.archetype === 'career';
}

/**
 * §9 (requests): how much a Career wants anything to do with an outer-district
 * tribute, as a multiplier on the social rolls.
 *
 * Three ways through: be a Career yourself, be strong enough that the pack
 * wants you (they recruit muscle and nothing else), or already have an
 * agreement with them, which is the "formally accepted into an alliance" case.
 * Everyone else gets `careerOutlierMingle`, which is small on purpose.
 *
 * Symmetric, because it takes two people to have a conversation: an outer
 * tribute who is keen is still not getting one.
 */
function mingleWillingness(a: Tribute, b: Tribute): number {
    const pair: Array<[Tribute, Tribute]> = [[a, b], [b, a]];
    return pair.reduce((lowest, [self, other]) => {
        if (!isCareerish(self) || isCareerish(other)) return lowest;
        if (self.trainingPact?.includes(other.id)) return lowest;
        if (self.allianceId !== undefined && self.allianceId === other.allianceId) return lowest;
        const dangerous = other.trainingScore >= TRAINING.careerRespectScore
            || other.attributes.strength >= TRAINING.careerRespectStrength;
        return Math.min(lowest, dangerous ? TRAINING.careerStrongOutlierMingle : TRAINING.careerOutlierMingle);
    }, 1);
}

function declareCareerPact(ctx: SimContext, cast: Tribute[]) {
    const careers = cast.filter(t => t.isCareer || t.archetype === 'career');
    if (careers.length < 2) return;
    careers.forEach(a => careers.forEach(b => {
        if (a.id === b.id || a.trainingPact?.includes(b.id)) return;
        a.trainingPact = [...(a.trainingPact ?? []), b.id];
        // The pack's terms are not a secret and never were: they are agreeing
        // about the first ninety seconds of the Games.
        recordPactTerms(ctx, a, b, TRAINING.careerPactDay);
    }));
    ctx.logEvent(
        // §12: the fact, which is the part that matters.
        `The Careers form a pack on the training floor: ${careers.map(c => `${c.name} (D${c.district})`).join(', ')}. `
        + `They train together for the rest of the day.`,
        careers.map(c => c.id),
        { important: true, category: 'training' }
    );
    // Twenty-odd people have just watched a pack assemble itself.
    cast.forEach(o => {
        if (careers.some(c => c.id === o.id)) return;
        careers.forEach(c => addFear(o, c.id, TRAINING.careerPactFear, c));
    });
}

/**
 * §9/§21/§22 (requests): the pack's daily block, and the list it makes.
 *
 * Two problems at once. The Careers had no group behaviour on the training
 * floor beyond the day-one declaration, so "they train in a bloc" was a
 * sentence rather than a mechanic; and the floor's social beats regularly said
 * somebody was watching somebody without saying who, which is the one thing a
 * reader of the chronicle actually wants to know.
 *
 * So the pack works as a unit each day, and each day it names — by name — the
 * outer-district tributes it has decided are worth paying attention to. Those
 * tributes learn they are being watched, and the pack's regard for them rises,
 * which is the only route by which an outsider is ever "formally accepted".
 */
function runCareerBloc(ctx: SimContext, cast: Tribute[], day: number) {
    const careers = cast.filter(isCareerish);
    if (careers.length < 2) return;
    const outsiders = cast.filter(t => !isCareerish(t));
    if (outsiders.length === 0) return;

    // Training as a unit: everybody in the pack drills with everybody else in
    // it, which is worth real warmth and a real proficiency tick.
    careers.forEach(a => careers.forEach(b => {
        if (a.id === b.id) return;
        adjustRel(a, b.id, TRAINING.careerBlocWarmth);
    }));
    careers.forEach(c => trainProficiency(c, 'melee'));

    // Who the pack has marked. Strength first, because that is what a Career
    // is actually assessing, and the list is short so it reads as a decision.
    const marked = [...outsiders]
        .sort((x, y) => (y.trainingScore + y.attributes.strength) - (x.trainingScore + x.attributes.strength))
        .slice(0, TRAINING.careerWatchlistSize);
    if (marked.length === 0) return;

    ctx.logEvent(
        `The Careers train as one block for the ${day === 1 ? 'first' : day === 2 ? 'second' : 'third'} day: `
        + `${careers.map(c => `${c.name} (D${c.district})`).join(', ')}. `
        + `They spend part of it watching ${marked.map(m => `${m.name} (D${m.district})`).join(' and ')}.`,
        [...careers.map(c => c.id), ...marked.map(m => m.id)],
        { important: true, category: 'training' },
    );

    marked.forEach(m => {
        careers.forEach(c => {
            // Being marked cuts both ways: the pack rates them, which is the
            // one door into the pack, and the marked tribute knows it.
            adjustRel(c, m.id, TRAINING.careerWatchlistRegard);
            addFear(m, c.id, TRAINING.careerWatchlistFear, c);
        });
    });
}

/**
 * §6.2: the private session, which existed here only as the number it
 * produced.
 *
 * Fifteen minutes, one room, twenty bored people on a balcony with a table of
 * food behind them, and the last chance anybody gets to change what the
 * country thinks of them before the gong. `stunt` is what they did; `landed`
 * and `botched` are how the room took it, because the same idea is a legend or
 * an embarrassment depending on whether it comes off.
 */
interface SessionAttempt { stunt: string; landed: string; botched: string; }

const PRIVATE_SESSION_ATTEMPTS: SessionAttempt[] = [
    {
        stunt: '{tribute} works the {station} in silence and then, without being asked, does the whole sequence again blindfolded.',
        landed: 'The Head Gamemaker puts his glass down for it, which is the only review anybody in that room understands.',
        botched: 'They lose the sequence halfway, stand there in the blindfold listening to nothing, and have to take it off themselves.',
    },
    {
        stunt: '{tribute} asks for the dummies to be moved to the far wall before they will begin.',
        landed: 'They hit every one of them from a distance the panel had to lean forward to judge, and two of the Gamemakers do exactly that.',
        botched: 'The distance was a bluff and everybody in the room can see it inside a minute.',
    },
    {
        stunt: '{tribute} spends eleven of their fifteen minutes building something at the {station} and refuses to say what it is.',
        landed: 'It is a snare, and it takes a hundred-kilo weighted dummy off the floor and leaves it swinging. The room goes quiet in a way it has not all day.',
        botched: 'It is a snare, and it collapses under its own weight in front of them. Somebody on the balcony laughs before they can stop themselves.',
    },
    {
        stunt: '{tribute} climbs the {station} rig to the ceiling and works from up there for the rest of the session.',
        landed: 'Nobody on the balcony can see them properly, which is the entire demonstration, and at least one Gamemaker understands that.',
        botched: 'A trainer has to talk them down, which the panel watches all the way through in silence.',
    },
    {
        stunt: '{tribute} takes the heaviest thing at the {station} and carries it the length of the hall without setting it down.',
        landed: 'It is not clever and it is not meant to be. Two of the panel are still watching when they finally put it down.',
        botched: 'Their grip goes at the halfway mark and the noise it makes on the tiles is the loudest thing in the session.',
    },
    {
        stunt: '{tribute} lays out every edible plant in the arena catalogue in order of how long it takes to kill you.',
        landed: 'The one Gamemaker who actually knows the catalogue checks the order twice and finds no fault in it.',
        botched: 'The order is wrong in two places, and one of the two is the kind of wrong that ends a Games on the first afternoon.',
    },
    {
        stunt: '{tribute} asks a trainer to come at them properly, and then asks again when the first attempt is too gentle.',
        landed: 'The second attempt puts the trainer on the mat inside four seconds, and the panel notices that they did not enjoy it.',
        botched: 'The second attempt puts *them* on the mat, and they get up slower than a room like that forgives.',
    },
    {
        stunt: '{tribute} sets a fire at the {station} with wet tinder and no flint, and talks the panel through it while they do it.',
        landed: 'It catches. They put it out themselves, thank the room, and leave four minutes early.',
        botched: 'It never catches, and they keep talking long after everybody has stopped pretending to listen.',
    },
    {
        stunt: '{tribute} throws one knife, badly, and then spends the rest of the session doing nothing but throwing that same knife.',
        landed: 'By the twentieth throw it is going in the same handspan every time, and the panel has watched the whole arc of it.',
        botched: 'By the twentieth throw it is going nowhere near, and the panel has watched the whole arc of that too.',
    },
    {
        stunt: '{tribute} paints themselves into the wall of the hall with what they took off the camouflage bench.',
        landed: 'It takes the panel a genuine moment to find them again, and Gamemakers do not enjoy being made to look for things.',
        botched: 'It takes the panel no time at all, and one of them says so, loudly, to somebody else.',
    },
    {
        stunt: '{tribute} works the {station} with one arm strapped to their side.',
        landed: 'They finish the drill anyway, which tells the balcony something more useful about them than the drill would have.',
        botched: 'They do not finish the drill, and the strap comes off in front of everybody.',
    },
    {
        stunt: '{tribute} says nothing at all, does the {station} drill exactly as trained, and stands still until dismissed.',
        landed: 'It is the most disciplined thing the panel has seen all afternoon, and one of them writes for a long time.',
        botched: 'It is the fourteenth time the panel has seen that drill today and their faces do not trouble to hide it.',
    },
    {
        stunt: '{tribute} opens by asking the Gamemakers what they would like to see.',
        landed: 'It is such an odd thing to be asked that somebody actually answers, and then watches them do it.',
        botched: 'Nobody answers. They have to fill fifteen minutes after that, and they fill it badly.',
    },
    {
        stunt: '{tribute} runs the whole gauntlet at the {station} and then, breathing hard, runs it again immediately.',
        landed: 'The second run is faster than the first. The panel notes the number rather than the trick.',
        botched: 'The second run ends with them on their knees at the halfway mark, and the room lets them stay there.',
    },
];

/**
 * The rare ones — the sessions that get talked about for a decade. Two of
 * these are not demonstrations of skill at all; they are a tribute telling a
 * roomful of Gamemakers exactly what they think of them, which is its own kind
 * of score.
 */
const UNFORGETTABLE_SESSIONS: SessionAttempt[] = [
    {
        stunt: '{tribute} waits until the panel has turned to the roast pig behind them, and then puts an arrow through the apple in its mouth.',
        landed: 'The arrow is still humming in the wall when they bow — a small, precise, entirely insolent bow — and walk out without being dismissed.',
        botched: 'The arrow is still humming in the wall when they bow — a small, precise, entirely insolent bow — and walk out without being dismissed.',
    },
    {
        stunt: '{tribute} paints the face of last year\'s victor across the whole floor of the hall in what they took off the camouflage bench, and stands in the middle of it.',
        landed: 'Nobody on that balcony says a word. Several of them look at the door instead.',
        botched: 'Nobody on that balcony says a word. Several of them look at the door instead.',
    },
    {
        stunt: '{tribute} throws the spear over the panel\'s heads and into the wall behind them, then apologises for their aim in a voice nobody believes.',
        landed: 'The Head Gamemaker holds their eye for four full seconds before writing anything down at all.',
        botched: 'The Head Gamemaker holds their eye for four full seconds before writing anything down at all.',
    },
    {
        stunt: '{tribute} takes the {station} apart, uses the pieces to build something the trainers do not have a name for, and demonstrates it on a dummy.',
        landed: 'The dummy comes apart. So, briefly, does the balcony\'s composure.',
        botched: 'The dummy comes apart. So, briefly, does the balcony\'s composure.',
    },
    {
        stunt: '{tribute} stands in front of the panel and recites the names of every tribute their district has lost, in order, for the full fifteen minutes.',
        landed: 'They get to the end of the list with time to spare, and use it to stand there in silence. Not one Gamemaker interrupts.',
        botched: 'They get to the end of the list with time to spare, and use it to stand there in silence. Not one Gamemaker interrupts.',
    },
];

/** Everybody else: fifteen minutes, competently used, politely received. */
const ROUTINE_SESSIONS = [
    'They show the panel the {station} work they have been doing all week, and the panel thanks them for it.',
    'They do what they came to do at the {station}, neatly and without flourish, and are dismissed on time.',
    'They give the panel fifteen minutes of solid, unremarkable work at the {station}. Somebody on the balcony is refilling a glass throughout.',
    'They work the {station} exactly as trained. Two Gamemakers are talking to each other by the end of it.',
    'They keep to the {station} and to what they know, which is the sensible thing to do and reads as exactly that.',
];

/**
 * §21 (requests): the day's social state, in one line.
 *
 * The training phase emits somewhere north of eighty lines a day — a station
 * outcome, a mingle or an altercation per pair, an observation, an evening
 * beat — and none of them is a summary. Read back after the Games, that is a
 * transcript rather than a record: the reader can see that Leaf and Ash talked
 * at the ropes on day two and cannot see who ended the week with an ally and
 * who ended it with nobody, which is the only thing about the training floor
 * that predicts anything.
 *
 * So one line per day, `important`, naming the pairs that actually agreed
 * something, the tributes who fell out, and the count still unattached. Every
 * number in it is read off the same state the arena will run on — no separate
 * bookkeeping, nothing that can drift from what happens next.
 */
/**
 * §(requests 14): the reactions to a scoring night, beyond the numbers.
 *
 * Every branch is gated on something the run actually produced — a score that
 * contradicts three days of footage, a district that has not had one in years,
 * a concealer whose plan worked — so a quiet scoring night stays quiet and a
 * remarkable one says why it was remarkable.
 */
function scoreReactions(ctx: SimContext, cast: Tribute[]) {
    const say = (pool: readonly string[], ids: string[], vars: Record<string, string>, important = false) =>
        ctx.logEvent(fillLine(ctx.pickText([...pool]), vars), ids, { important, category: 'training' });

    // What the floor suggested they were worth, against what the panel said.
    const floorRead = (t: Tribute) => {
        const log = t.trainingLog ?? [];
        if (log.length === 0) return 0;
        const good = log.filter(e => e.outcome === 'success').length;
        return (good / log.length) * TRAINING_SCORE.baseCeiling;
    };

    cast.forEach(t => {
        const read = floorRead(t);
        if (t.trainingStrategy === 'conceal' && t.trainingScore <= TRAINING.hiddenScore) {
            say(SCORE_REACTIONS.concealed, [t.id], { tribute: t.name, score: String(t.trainingScore) });
            return;
        }
        if (read > 0 && t.trainingScore - read >= TRAINING.scoreSurpriseGap) {
            say(SCORE_REACTIONS.surprise, [t.id], { tribute: t.name, score: String(t.trainingScore) }, true);
        } else if (read > 0 && read - t.trainingScore >= TRAINING.scoreSurpriseGap) {
            say(SCORE_REACTIONS.collapse, [t.id], { tribute: t.name, score: String(t.trainingScore) });
        }
    });

    // A tie at the top, which the Capitol dislikes because it has two stories.
    const best = Math.max(...cast.map(t => t.trainingScore));
    const tied = cast.filter(t => t.trainingScore === best);
    if (tied.length > 1) {
        say(SCORE_REACTIONS.tie, tied.map(t => t.id), {
            names: tied.map(t => t.name).join(' and '), score: String(best),
        }, true);
    }

    // A district with nothing to celebrate, celebrating.
    cast.forEach(t => {
        if (t.trainingScore < TRAINING.eliteVerdictScore) return;
        if (legacyOf(t.district).tier === 'storied' || legacyOf(t.district).tier === 'strong') return;
        say(SCORE_REACTIONS.districtPride, [t.id], {
            tribute: t.name, score: String(t.trainingScore), district: String(t.district),
        }, true);
    });

    // The pack, re-ranking the room around somebody who is not one of them.
    const careers = cast.filter(isCareerish);
    const outsider = cast
        .filter(t => !isCareerish(t) && t.trainingScore >= TRAINING.eliteVerdictScore)
        .sort((a, b) => b.trainingScore - a.trainingScore)[0];
    if (careers.length >= 2 && outsider) {
        say(SCORE_REACTIONS.careerResponse, [outsider.id, ...careers.map(c => c.id)], {
            tribute: outsider.name, score: String(outsider.trainingScore),
        }, true);
        careers.forEach(c => addFear(c, outsider.id, TRAINING.careerWatchlistFear / 2, outsider));
    }

    // And the book, which moves on whoever moved furthest.
    const mover = [...cast].sort((a, b) => b.trainingScore - a.trainingScore)[0];
    if (mover && mover.trainingScore >= TRAINING.strongTrustScore) {
        say(SCORE_REACTIONS.bookmakers, [mover.id], {
            tribute: mover.name, score: String(mover.trainingScore),
        });
    }
}

function floorDigest(ctx: SimContext, day: number, cast: Tribute[]) {
    const seen = new Set<string>();
    const pairs: string[] = [];
    cast.forEach(t => (t.trainingPact ?? []).forEach(id => {
        const other = cast.find(o => o.id === id);
        if (!other) return;
        const key = [t.id, other.id].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        // The Career pact is its own announcement and would otherwise fill the
        // whole digest with the same six names every day.
        if (isCareerish(t) && isCareerish(other)) return;
        pairs.push(`${t.name} (D${t.district}) and ${other.name} (D${other.district})`);
    }));

    // Somebody counts as unattached when nobody has agreed anything with them.
    const attached = new Set<string>();
    cast.forEach(t => {
        if (isCareerish(t) && cast.filter(isCareerish).length > 1) { attached.add(t.id); return; }
        if ((t.trainingPact ?? []).length > 0) attached.add(t.id);
    });
    const alone = cast.filter(t => !attached.has(t.id));

    // The sharpest mutual dislikes on the floor, which is where the arena's
    // first grudges come from.
    const feuds: string[] = [];
    cast.forEach(a => cast.forEach(b => {
        if (a.id >= b.id) return;
        if (Math.min(getRel(a, b.id), getRel(b, a.id)) > TRAINING.digestFeudRegard) return;
        feuds.push(`${a.name} and ${b.name}`);
    }));

    const parts = [
        `End of training day ${day}.`,
        pairs.length > 0
            ? `Agreements standing: ${pairs.join('; ')}.`
            : 'No agreements between tributes outside the Career pack.',
        feuds.length > 0 ? `Bad blood: ${feuds.slice(0, 3).join('; ')}.` : '',
        alone.length > 0
            ? `${alone.length} tribute${alone.length === 1 ? '' : 's'} with nobody: ${alone.map(t => t.name).join(', ')}.`
            : 'Every tribute on the floor has somebody.',
    ].filter(Boolean);

    // §22: the cast list is who the line actually names, not everyone who was
    // in the room. Claiming all twenty-four would put this digest into every
    // tribute's own chronicle filter while naming three of them, which is
    // exactly the defect `npm run test:unnamed` exists to catch — and it did.
    const named = new Set<string>();
    cast.forEach(t => { if (parts.join(' ').includes(t.name)) named.add(t.id); });
    ctx.logEvent(parts.join(' '), [...named], { important: true, category: 'training' });
}

const DAY_HEADLINES = [
    'TRAINING, DAY ONE. Every tribute is on the floor together for the first time.',
    'TRAINING, DAY TWO. The tributes have settled into stations and into groups.',
    'TRAINING, DAY THREE. The last day before the private sessions with the Gamemakers.',
];

/**
 * §(requests): the three days on the floor and the scores are four phases.
 *
 * This wrapper runs them all for the headless scripts; the store advances one
 * at a time through `Simulator.advance`, so the chronicle pages
 * `TRAINING — DAY 1`, `DAY 2`, `DAY 3` and `THE SCORES` separately.
 */
export function processTraining(ctx: SimContext) {
    for (let day = 1; day <= TRAINING.days; day++) processTrainingDay(ctx, day);
    processTrainingScores(ctx);
}

/** The station history per tribute across the floor days. Rebuilt from `trainingLog`. */
function workedSoFar(t: Tribute): Array<keyof Attributes> {
    return (t.trainingLog ?? []).map(e => e.attr).filter((a): a is keyof Attributes => !!a);
}

/** One day on the training floor. `day` is 1-based. */
export function processTrainingDay(ctx: SimContext, dayNumber: number) {
    const phase = trainingPhaseFor(dayNumber);
    if (ctx.state.phase === phase) return;
    ctx.state.phase = phase;
    const cast = getAlive(ctx.state);
    const day = dayNumber - 1;

    if (day === 0) {
        ctx.rng = new RNG(`${ctx.state.seed}-training`);
        // ---- 1. A decision about being watched ----
        cast.forEach(t => {
            // §6.10: player coaching. A pinned strategy for the chosen tribute
            // replaces the roll; everyone else decides for themselves.
            const coached = ctx.state.playerCoaching;
            t.trainingStrategy = coached?.tributeId === t.id && coached.trainingStrategy
                ? coached.trainingStrategy
                : pickStrategy(ctx, t);
            t.trainingLog = [];
        });
    }

    const worked = new Map<string, Array<keyof Attributes>>();
    cast.forEach(t => worked.set(t.id, workedSoFar(t)));

    {
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

        // §6.2: the room, before anybody works in it. Who is standing where is
        // decided first so a station attempt can record its own witnesses.
        const groups = new Map<keyof Attributes, Tribute[]>();
        cast.forEach(t => {
            const attr = stationsToday.get(t.id)!;
            groups.set(attr, [...(groups.get(attr) ?? []), t]);
        });

        const outcomes = new Map<string, StationOutcome>();
        cast.forEach(t => {
            const attr = stationsToday.get(t.id)!;
            outcomes.set(t.id, attemptStation(
                ctx, t, attr, stationNames.get(attr)!, day, cast, groups.get(attr) ?? []));
        });
        runWitnessRevisions(ctx, groups, outcomes, stationNames);
        // The Careers form theirs on day one and make sure the room sees it —
        // which is most of where the pack's menace comes from in the source
        // material. Leaving it to the ordinary station pairing meant the pack
        // only announced itself if the roll happened to put two of them at the
        // same drill, which is exactly the thing the pack does not leave to
        // chance.
        if (day + 1 === TRAINING.careerPactDay) declareCareerPact(ctx, cast);
        // §9: and then the pack works as a bloc, every day, for the rest of it.
        if (day + 1 >= TRAINING.careerPactDay) runCareerBloc(ctx, cast, day + 1);
        runFloorSocial(ctx, day, stationsToday, stationNames, cast);
        // §(requests 9): stations, then lunch, then the rest of the afternoon.
        lunchPeriod(ctx, day + 1, cast);
        observeFloor(ctx, day, stationsToday, stationNames, cast);
        eveningBeat(ctx, day);
        // §21: and then say, once, what the day actually came to.
        floorDigest(ctx, day + 1, cast);
    }
}

/** The private sessions and the broadcast of the scores. */
export function processTrainingScores(ctx: SimContext) {
    if (ctx.state.phase === 'scores') return;
    ctx.state.phase = 'scores';
    const cast = getAlive(ctx.state);

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
        // §6.2: what they chose to show them. A tribute shows the panel the
        // thing they spent three days on — which is why the station choice up
        // on the floor is a decision with a consequence rather than colour.
        const worked = (Object.entries(
            (t.trainingLog ?? []).reduce<Record<string, number>>((counts, e) => {
                counts[e.station] = (counts[e.station] ?? 0) + 1;
                return counts;
            }, {})) as Array<[string, number]>).sort((a, b) => b[1] - a[1]);
        const showStation = worked[0]?.[0] ?? ctx.rng.pick(TRAINING_STATIONS.strength);
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

        // §6.2: the session itself. Most tributes go in, do the thing they are
        // best at, and are thanked politely; a third of them try something,
        // and trying something in front of a bored panel is a swing in both
        // directions. A concealer, by definition, tries nothing.
        const showcaseAttr = ATTRS.reduce((best, a) => t.attributes[a] > t.attributes[best] ? a : best, ATTRS[0]);
        const attempted = stunt
            || (t.trainingStrategy !== 'conceal' && ctx.rng.chance(PRE_ARENA.privateSessionStuntChance));
        // Landing it is harder than landing the same thing on the floor: this
        // is the last session of a long day in front of a panel that has
        // already watched twenty of them and started on the wine. The two
        // subtractions are that room — the width of the band between "got
        // through it" and "did not", and three days' accumulated impatience.
        const landed = stunt || ctx.rng.chance(
            TRAINING.stationBaseSuccess
            + t.attributes[showcaseAttr] * TRAINING.stationPerAttributePoint
            - TRAINING.stationStruggleBand
            - TRAINING.stationFatiguePerDay * TRAINING.days);
        const attempt = attempted
            ? ctx.rng.pick(stunt ? UNFORGETTABLE_SESSIONS : PRIVATE_SESSION_ATTEMPTS)
            : undefined;
        if (attempted && !stunt) score += landed ? PRE_ARENA.privateSessionSwing : -PRE_ARENA.privateSessionSwing;

        score = Math.min(TRAINING_SCORE.baseCeiling, Math.max(TRAINING_SCORE.baseFloor, score));

        // §16 (requests): a Career who volunteered has a floor.
        //
        // These are the tributes who spent eighteen years in an academy for
        // this exact week and then put their hand up for it, in front of the
        // whole district. A 5 from that tribute is not a story about an
        // underrated Career, it is the score generator failing to model who
        // they are — and it wrecks the odds board, the sponsor weighting and
        // every threat read the rest of the cast makes at them. So they land
        // at or above the floor unless they deliberately concealed, which is
        // the one case where a low score is a choice rather than an accident.
        if (t.isCareer && t.volunteered && t.trainingStrategy !== 'conceal'
            && score < TRAINING_SCORE.careerVolunteerFloor
            && ctx.rng.chance(TRAINING_SCORE.careerVolunteerFloorChance)) {
            score = TRAINING_SCORE.careerVolunteerFloor;
        }

        // Elite band: 9-12, each step exponentially harder than the last.
        if (score === TRAINING_SCORE.baseCeiling) {
            for (let extra = 1; extra <= TRAINING_SCORE.eliteGates; extra++) {
                if (ctx.rng.chance(eliteGateChance(t, extra) * (stunt ? TRAINING_SCORE.stuntGateMultiplier : 1))) score = TRAINING_SCORE.baseCeiling + extra;
                else break;
            }
        }

        t.trainingScore = score;
        const reaction = attempt
            ? fillLine(landed ? attempt.landed : attempt.botched, { tribute: t.name, station: showStation })
            : fillLine(ctx.pickText(ROUTINE_SESSIONS), { tribute: t.name, station: showStation });
        t.privateSession = {
            station: showStation,
            stunt: attempt ? fillLine(attempt.stunt, { tribute: t.name, station: showStation }) : 'nothing the floor had not already seen them do',
            reaction,
            score,
        };
        if (attempt) {
            ctx.logEvent(
                `Behind the doors of the private session, ${t.privateSession.stunt} ${reaction}`,
                [t.id],
                { important: stunt, category: 'training' }
            );
        }
    });

    // §6.2: the agreements struck on the floor are repriced against the board
    // the whole cast has now seen.
    settlePacts(cast);

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
                loseSanity(other, TRAINING.intimidationSanity * severity);
                adjustRel(other, t.id, -TRAINING.intimidationRelationship * severity);
                // The intimidation used to evaporate the moment the sanity hit
                // landed. It should stick to the person: this is how a Career's
                // reputation follows them into the arena.
                addFear(other, t.id, (t.trainingScore - TRAINING_SCORE.baseCeiling) * FEAR.perTrainingPointOverEight, t);
            }
            clampTribute(other);
        });
        clampTribute(t);
    });

    // §(requests 14): what the room does with the numbers.
    //
    // The broadcast used to be one verdict line per tribute and one line about
    // whoever topped the board. A scoring night is the last public event before
    // the arena and the only one where the whole country forms an opinion at
    // once — these are the other things that happen in it.
    scoreReactions(ctx, cast);

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
