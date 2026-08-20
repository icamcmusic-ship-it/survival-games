import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Attributes, Tribute } from '../../models/types';
import { TRAINING_STATIONS, TRAINING_VERDICTS, INTIMIDATION_TEXTS } from '../../data/flavorText';
import { TRAINING } from '../../data/balance';
import { strengthCapForAge } from '../generator';
import { LEGACY_EFFECTS, legacyOf } from '../../data/districts';
import { adjustRel } from '../relationships';
import { clampTribute } from '../vitals';

/**
 * Training scores 1-8 are earned on merit. Every point above 8 is a separate
 * gate whose odds decay exponentially, so a 9 is rare, an 11 is a talking
 * point, and a 12 is a once-in-a-generation reaping.
 */
const ELITE_GATE_BASE = 0.3;
const ELITE_GATE_DECAY = 0.3;
const ELITE_GATE_CAP = 0.55;

function meritMultiplier(t: Tribute): number {
    let m = 1;
    if (t.isCareer) m += 0.45;
    if (t.archetype === 'career') m += 0.2;
    if (t.traits.includes('Brute')) m += 0.15;
    if (t.traits.includes('Strategist')) m += 0.15;
    if (t.traits.includes('Eagle-Eyed')) m += 0.1;
    if (t.traits.includes('Nimble')) m += 0.1;
    if (t.traits.includes('Clumsy')) m -= 0.25;
    if (t.traits.includes('Pacifist')) m -= 0.2;
    // A twelve-year-old does not out-score the Careers on the gauntlet, however
    // fast they are — age is a real ceiling on the elite band.
    m += (t.age - 15) * 0.08;
    // Coaching is worth something, and the districts with victors have the
    // coaches. This is the mentor layer showing up where it should.
    m += LEGACY_EFFECTS[legacyOf(t.district).tier].trainingMerit;
    return Math.max(0.15, m);
}

export function eliteGateChance(t: Tribute, pointAboveEight: number): number {
    return Math.min(ELITE_GATE_CAP, ELITE_GATE_BASE * Math.pow(ELITE_GATE_DECAY, pointAboveEight - 1) * meritMultiplier(t));
}

export function processTraining(ctx: SimContext) {
    ctx.state.phase = 'training';
    ctx.rng = new RNG(`${ctx.state.seed}-training`);

    getAlive(ctx.state).forEach(t => {
        const attrs = ['strength', 'agility', 'intelligence', 'stealth', 'charisma'] as const;
        const boosted = ctx.rng.pick([...attrs]) as keyof Attributes;
        // A week on the gauntlet does not undo the age ceiling on raw strength.
        const ceiling = boosted === 'strength' ? strengthCapForAge(t.age) : 10;
        t.attributes[boosted] = Math.min(ceiling, t.attributes[boosted] + 1);

        const totalStats = Object.values(t.attributes).reduce((a, b) => a + b, 0);

        // Base band: 1-8, driven by raw stats plus a small roll.
        let score = Math.floor(totalStats / 5) + ctx.rng.nextInt(-1, 1);
        if (t.isCareer) score += 1;
        score = Math.min(8, Math.max(1, score));

        // Elite band: 9-12, each step exponentially harder than the last.
        if (score === 8) {
            for (let extra = 1; extra <= 4; extra++) {
                if (ctx.rng.chance(eliteGateChance(t, extra))) {
                    score = 8 + extra;
                } else {
                    break;
                }
            }
        }

        t.trainingScore = score;
        t.excitementRating += score * 5;
        if (score >= 10) t.sponsorTrust = Math.min(100, t.sponsorTrust + 15);
        else if (score >= 9) t.sponsorTrust = Math.min(100, t.sponsorTrust + 8);

        const station = ctx.rng.pick(TRAINING_STATIONS[boosted]);
        const verdictPool = score >= 11 ? TRAINING_VERDICTS.legendary
            : score >= 9 ? TRAINING_VERDICTS.elite
            : score >= 6 ? TRAINING_VERDICTS.solid
            : TRAINING_VERDICTS.poor;
        const verdict = ctx.pickText(verdictPool).replace(/\{tribute\}/g, t.name);

        ctx.logEvent(
            `${t.name} works the ${station} and scores a ${score}. ${verdict}`,
            [t.id],
            { important: score >= 9, category: 'training' }
        );
    });

    // Training does not happen in a vacuum. Twenty-three tributes are
    // on that floor watching, and a 10 changes how every one of them sleeps.
    const cast = getAlive(ctx.state);
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

        const severity = (t.trainingScore - TRAINING.intimidationScore + 1) / 4;
        cast.forEach(other => {
            if (other.id === t.id) return;
            if (other.isCareer || other.traits.includes('Bloodthirsty')) {
                // Careers do not flinch; they file it under 'rival'.
                adjustRel(other, t.id, -TRAINING.careerRespect * severity);
            } else {
                other.vitals.sanity -= TRAINING.intimidationSanity * severity;
                adjustRel(other, t.id, -TRAINING.intimidationRelationship * severity);
            }
            clampTribute(other);
        });
        clampTribute(t);
    });

    // The Capitol always crowns a favourite.
    const ranked = [...getAlive(ctx.state)].sort((a, b) => b.trainingScore - a.trainingScore);
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
}
