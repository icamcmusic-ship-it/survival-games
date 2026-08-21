import { SimContext, getAlive } from '../context';
import { Tribute } from '../../models/types';
import { RNG } from '../../utils/rng';
import {
    CAESAR_FOLLOWUPS, INTERVIEW_CLOSERS, INTERVIEW_SCENARIOS, PERSONA_DRIFT,
} from '../../data/flavorText';
import { clampTribute } from '../vitals';
import { adjustRel } from '../relationships';
import { addExcitement } from '../audience';
import { INTERVIEWS, INTERVIEW_ANGLES } from '../../data/balance';
import { traitMod } from '../../data/traits';

/**
 * Caesar's couch, in three beats.
 *
 * This used to be one charisma roll and a persona string picked at random. The
 * persona then did real work downstream — `interviewChemistry` and
 * `personaThreat` both read it — which made it the most consequential single
 * random pick in the pre-Games and the least earned.
 *
 * Now the angle is chosen from who the tribute actually is, Caesar finds the
 * seam in it with one follow-up, and the persona they walk out with is the one
 * they managed to hold rather than the one they rehearsed. A tribute who cannot
 * hold "the ruthless one" under a single question leaves the stage as an
 * arrogant brute, and the whole arena watched it happen.
 */

/** How well an angle fits this tribute. The persona emerges from the person. */
function angleWeights(t: Tribute): Array<[typeof INTERVIEW_SCENARIOS[number], number]> {
    return INTERVIEW_SCENARIOS.map(scenario => {
        let weight = 1;
        switch (scenario.strategy) {
            case 'The Star-Crossed Lover':
                weight += t.attributes.charisma * INTERVIEW_ANGLES.starCrossed.perCharisma;
                if (t.traits.includes('Softhearted')) weight += INTERVIEW_ANGLES.starCrossed.softhearted;
                if (t.traits.includes('Ruthless')) weight += INTERVIEW_ANGLES.starCrossed.ruthless;
                break;
            case 'The Ruthless Warrior':
                weight += (t.trainingScore - INTERVIEW_ANGLES.ruthlessWarrior.trainingPivot) * INTERVIEW_ANGLES.ruthlessWarrior.perTrainingPointOverPivot
                    + t.attributes.strength * INTERVIEW_ANGLES.ruthlessWarrior.perStrength;
                if (t.isCareer) weight += INTERVIEW_ANGLES.ruthlessWarrior.career;
                if (t.traits.includes('Bloodthirsty')) weight += INTERVIEW_ANGLES.ruthlessWarrior.bloodthirsty;
                if (t.traits.includes('Pacifist')) weight += INTERVIEW_ANGLES.ruthlessWarrior.pacifist;
                break;
            case 'The Humble Underdog':
                weight += (INTERVIEW_ANGLES.humbleUnderdog.trainingPivot - t.trainingScore) * INTERVIEW_ANGLES.humbleUnderdog.perTrainingPointUnderPivot;
                if (t.age <= INTERVIEW_ANGLES.humbleUnderdog.youngAge) weight += INTERVIEW_ANGLES.humbleUnderdog.young;
                if (t.isCareer) weight += INTERVIEW_ANGLES.humbleUnderdog.career;
                break;
            case 'The Mysterious Enigma':
                weight += t.attributes.stealth * INTERVIEW_ANGLES.mysteriousEnigma.perStealth;
                if (t.trainingStrategy === 'conceal') weight += INTERVIEW_ANGLES.mysteriousEnigma.concealed;
                if (t.traits.includes('Paranoid')) weight += INTERVIEW_ANGLES.mysteriousEnigma.paranoid;
                break;
            case 'The Charming Flirt':
                weight += t.attributes.charisma * INTERVIEW_ANGLES.charmingFlirt.perCharisma;
                if (t.traits.includes('Charismatic')) weight += INTERVIEW_ANGLES.charmingFlirt.charismatic;
                if (t.traits.includes('Unremarkable')) weight += INTERVIEW_ANGLES.charmingFlirt.unremarkable;
                break;
            case 'The Arrogant Brute':
                weight += t.attributes.strength * INTERVIEW_ANGLES.arrogantBrute.perStrength;
                if (t.traits.includes('Brute')) weight += INTERVIEW_ANGLES.arrogantBrute.brute;
                if (t.attributes.charisma >= INTERVIEW_ANGLES.arrogantBrute.charismaCutoff) weight += INTERVIEW_ANGLES.arrogantBrute.charismatic;
                break;
            case 'The Quirky Oddball':
                weight += t.attributes.intelligence * INTERVIEW_ANGLES.quirkyOddball.perIntelligence;
                if (t.traits.includes('Showman')) weight += INTERVIEW_ANGLES.quirkyOddball.showman;
                break;
            case 'The Silent Threat':
                weight += t.attributes.stealth * INTERVIEW_ANGLES.silentThreat.perStealth
                    + t.attributes.strength * INTERVIEW_ANGLES.silentThreat.perStrength;
                if (t.trainingStrategy === 'conceal') weight += INTERVIEW_ANGLES.silentThreat.concealed;
                if (t.attributes.charisma <= INTERVIEW_ANGLES.silentThreat.quietCharisma) weight += INTERVIEW_ANGLES.silentThreat.quiet;
                break;
            case 'The Grieving Sibling':
                if (t.traits.includes('Softhearted') || t.traits.includes('Grim')) weight += INTERVIEW_ANGLES.grievingSibling.mourner;
                if (t.age <= INTERVIEW_ANGLES.grievingSibling.youngAge) weight += INTERVIEW_ANGLES.grievingSibling.young;
                if (t.traits.includes('Ruthless')) weight += INTERVIEW_ANGLES.grievingSibling.ruthless;
                break;
            case 'The Cold Strategist':
                weight += t.attributes.intelligence * INTERVIEW_ANGLES.coldStrategist.perIntelligence;
                if (t.archetype === 'strategist') weight += INTERVIEW_ANGLES.coldStrategist.strategistArchetype;
                if (t.traits.includes('Strategist')) weight += INTERVIEW_ANGLES.coldStrategist.strategistTrait;
                break;
            case 'The Reluctant Hero':
                if (t.traits.includes('Pacifist')) weight += INTERVIEW_ANGLES.reluctantHero.pacifist;
                if (!t.isCareer && !t.volunteered) weight += INTERVIEW_ANGLES.reluctantHero.conscript;
                if (t.isCareer) weight += INTERVIEW_ANGLES.reluctantHero.career;
                break;
            case 'The District Loyalist':
                if (t.volunteered && !t.isCareer) weight += INTERVIEW_ANGLES.districtLoyalist.volunteer;
                weight += t.reputation < INTERVIEW_ANGLES.districtLoyalist.lowReputation ? INTERVIEW_ANGLES.districtLoyalist.lowReputationBonus : 0;
                if (t.isCareer) weight += INTERVIEW_ANGLES.districtLoyalist.career;
                break;
            case 'The Wildcard':
                if (t.archetype === 'wildcard' || t.archetype === 'trickster') weight += INTERVIEW_ANGLES.wildcard.archetype;
                weight += Math.abs(t.attributes.charisma - INTERVIEW_ANGLES.wildcard.charismaMidpoint) * INTERVIEW_ANGLES.wildcard.perCharismaDeviation;
                break;
        }
        return [scenario, Math.max(INTERVIEW_ANGLES.minWeight, weight)] as [typeof INTERVIEW_SCENARIOS[number], number];
    });
}


function pickAngle(ctx: SimContext, t: Tribute) {
    const weights = angleWeights(t);
    let roll = ctx.rng.nextFloat() * weights.reduce((sum, [, w]) => sum + w, 0);
    for (const [scenario, w] of weights) {
        roll -= w;
        if (roll <= 0) return scenario;
    }
    return weights[weights.length - 1][0];
}


export function processInterviews(ctx: SimContext) {
    ctx.state.phase = 'interviews';
    ctx.rng = new RNG(`${ctx.state.seed}-interviews`);

    const cast = getAlive(ctx.state);

    ctx.logEvent(
        'Caesar Flickerman opens the interviews. Three minutes each, live, and the only three minutes any of them will get to speak for themselves.',
        [],
        { important: true, category: 'interview' }
    );

    cast.forEach(t => {
        // ---- Beat one: the angle they walked out with ----
        const scenario = pickAngle(ctx, t);
        const poise = t.attributes.charisma
            + ctx.rng.nextInt(INTERVIEWS.poiseJitterMin, INTERVIEWS.poiseJitterMax)
            + (t.fanFavourite ? INTERVIEWS.poiseFanFavourite : 0)
            + Math.round(traitMod(t, 'excitement') * INTERVIEWS.poiseExcitementWeight);
        const opened = poise >= INTERVIEWS.openingThreshold;

        ctx.logEvent(
            `[${scenario.strategy}] ` + ctx.pickText(opened ? scenario.success : scenario.failure)
                .split('{tribute}').join(t.name)
                .split('{district}').join(String(t.district)),
            [t.id],
            { important: opened, category: 'interview' }
        );

        // ---- Beat two: Caesar finds the seam ----
        const followUp = CAESAR_FOLLOWUPS[scenario.strategy];
        // Holding an angle under pressure is charisma, but it is also whether
        // the angle was true in the first place — a tribute selling something
        // they are not has further to fall.
        const held = ctx.rng.chance(Math.min(INTERVIEWS.holdChanceCeiling, Math.max(INTERVIEWS.holdChanceFloor,
            INTERVIEWS.holdBase
            + t.attributes.charisma * INTERVIEWS.holdPerCharisma
            + (opened ? INTERVIEWS.holdOpenedBonus : -INTERVIEWS.holdOpenedBonus))));

        let persona = scenario.strategy;
        if (followUp) {
            ctx.logEvent(
                followUp.question.split('{district}').join(String(t.district)),
                [t.id],
                { category: 'interview' }
            );
            ctx.logEvent(
                ctx.pickText(held ? followUp.held : followUp.broke)
                    .split('{tribute}').join(t.name)
                    .split('{district}').join(String(t.district)),
                [t.id],
                { important: held, category: 'interview' }
            );
            if (!held) persona = PERSONA_DRIFT[scenario.strategy] ?? scenario.strategy;
        }

        // The persona is public and permanent — the rest of the cast watched it,
        // and the alliance and bloodbath layers read it back.
        t.interviewStrategy = persona;

        // ---- Beat three: the closing line, and the money ----
        const landed = opened && held;
        ctx.logEvent(
            ctx.pickText(landed ? INTERVIEW_CLOSERS.strong : INTERVIEW_CLOSERS.weak)
                .split('{tribute}').join(t.name)
                .split('{district}').join(String(t.district)),
            [t.id],
            { important: landed, category: 'interview' }
        );

        if (opened) {
            t.attributes.charisma = Math.min(INTERVIEWS.charismaCeiling, t.attributes.charisma + scenario.charismaBuff);
            t.sponsorTrust = Math.min(100, Math.floor(t.sponsorTrust * scenario.trustMultiplier));
            t.reputation = Math.min(INTERVIEWS.reputationCeiling,
                Math.round(t.reputation + (scenario.trustMultiplier - 1) * INTERVIEWS.reputationPerTrustMultiplier));
            addExcitement(t, INTERVIEWS.openedExcitement);
        } else {
            t.sponsorTrust = Math.max(0, t.sponsorTrust - INTERVIEWS.fumbledTrust);
            t.reputation = Math.max(INTERVIEWS.reputationFloor, t.reputation - INTERVIEWS.fumbledReputation);
        }
        // Holding the angle is worth as much as choosing a good one — this is
        // where a quiet tribute with nothing to sell can still win the night.
        if (held) {
            t.sponsorTrust = Math.min(100, t.sponsorTrust + INTERVIEWS.heldTrust);
            addExcitement(t, INTERVIEWS.heldExcitement);
        } else {
            t.sponsorTrust = Math.max(0, t.sponsorTrust - INTERVIEWS.brokeTrust);
        }
        clampTribute(t);
    });

    // Everyone watched the same broadcast. A tribute who spent three minutes
    // promising a short Games has made a first impression on twenty-three
    // people, and it is not a warm one.
    cast.forEach(t => {
        const hostile = t.interviewStrategy === 'The Ruthless Warrior' || t.interviewStrategy === 'The Arrogant Brute'
            || t.interviewStrategy === 'The Silent Threat' || t.interviewStrategy === 'The Cold Strategist';
        const warm = t.interviewStrategy === 'The Star-Crossed Lover' || t.interviewStrategy === 'The Humble Underdog'
            || t.interviewStrategy === 'The Grieving Sibling' || t.interviewStrategy === 'The Reluctant Hero'
            || t.interviewStrategy === 'The District Loyalist';
        if (!hostile && !warm) return;
        cast.forEach(other => {
            if (other.id === t.id) return;
            if (hostile) adjustRel(other, t.id, other.isCareer ? INTERVIEWS.hostileCareerRespect : -INTERVIEWS.hostileDistrust);
            if (warm) adjustRel(other, t.id, INTERVIEWS.warmRapport);
        });
    });

    const boldest = cast.filter(t => t.interviewStrategy === 'The Ruthless Warrior' || t.interviewStrategy === 'The Arrogant Brute'
        || t.interviewStrategy === 'The Silent Threat' || t.interviewStrategy === 'The Cold Strategist');
    if (boldest.length > 0) {
        ctx.logEvent(
            `The Capitol replays the threats all night. ${boldest.map(t => t.name).join(', ')} will walk into that arena with a target already painted on.`,
            boldest.map(t => t.id),
            { important: true, category: 'interview' }
        );
    }
}
