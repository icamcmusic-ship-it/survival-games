import { SimContext, getAlive } from '../context';
import { Tribute } from '../../models/types';
import { RNG } from '../../utils/rng';
import { ARCHETYPES } from '../../data/archetypes';
import { adjustRespect, getRel } from '../relationships';
import {
    CAESAR_FOLLOWUPS, INTERVIEW_CLOSERS, INTERVIEW_SCENARIOS, PERSONA_DRIFT,
} from '../../data/flavorText';
import { clampTribute } from '../vitals';
import { adjustRel } from '../relationships';
import { addExcitement } from '../audience';
import { addFear } from '../fear';
import { FEAR, RESOLVE, RESPECT, ROMANCE, INTERVIEWS, INTERVIEW_ANGLES } from '../../data/balance';
import { traitMod } from '../../data/traits';
import { InterviewPersona } from '../../models/types';
import { COLD_PERSONAS, WARM_PERSONAS } from '../../data/personas';

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


/**
 * §6.3: the angles that are not a persona.
 *
 * `interviewAngle` had exactly one value — showmance — so the couch could
 * produce a romance plot and nothing else. These four are the other things
 * three live minutes are actually good for: refusing to play along, telling
 * the country who you have lost, asking out loud for somebody to find you at
 * the gong, and naming the person you intend to kill.
 */
type SpokenAngle = 'defiance' | 'grief' | 'alliance-signal' | 'target-callout';

/**
 * Chosen the way `angleWeights` chooses a persona: from who the tribute
 * actually is. The `undefined` weight is the ordinary case — most tributes
 * answer the questions they are asked and sit back down.
 */
function pickSpokenAngle(ctx: SimContext, t: Tribute): SpokenAngle | undefined {
    const cold = !!t.interviewStrategy && COLD_PERSONAS.includes(t.interviewStrategy);
    const angles: Array<[SpokenAngle, number]> = [
        ['defiance',
            (t.reputation < INTERVIEW_ANGLES.districtLoyalist.lowReputation ? INTERVIEW_ANGLES.districtLoyalist.lowReputationBonus : 0)
            + (t.traits.includes('Ruthless') ? INTERVIEW_ANGLES.grievingSibling.ruthless * -1 : 0)
            + (t.volunteered && !t.isCareer ? INTERVIEW_ANGLES.districtLoyalist.volunteer : 0)
            + (t.isCareer ? INTERVIEW_ANGLES.reluctantHero.career : 0)],
        ['grief',
            (t.traits.includes('Softhearted') || t.traits.includes('Grim') ? INTERVIEW_ANGLES.grievingSibling.mourner : 0)
            + (t.age <= INTERVIEW_ANGLES.grievingSibling.youngAge ? INTERVIEW_ANGLES.grievingSibling.young : 0)
            + (t.motive === 'family' || t.motive === 'partner' ? INTERVIEW_ANGLES.starCrossed.softhearted : 0)
            + (t.isCareer ? INTERVIEW_ANGLES.humbleUnderdog.career : 0)],
        ['alliance-signal',
            t.attributes.charisma * INTERVIEW_ANGLES.starCrossed.perCharisma
            + (t.isCareer ? INTERVIEW_ANGLES.ruthlessWarrior.career * -1 : INTERVIEW_ANGLES.reluctantHero.conscript)
            + (t.trainingScore < INTERVIEW_ANGLES.humbleUnderdog.trainingPivot ? INTERVIEW_ANGLES.humbleUnderdog.young : 0)],
        ['target-callout',
            (t.trainingScore - INTERVIEW_ANGLES.ruthlessWarrior.trainingPivot) * INTERVIEW_ANGLES.ruthlessWarrior.perTrainingPointOverPivot
            + (cold ? INTERVIEW_ANGLES.ruthlessWarrior.bloodthirsty : 0)
            + (t.traits.includes('Pacifist') ? INTERVIEW_ANGLES.ruthlessWarrior.pacifist : 0)],
    ];
    // Most tributes answer the question they were asked and sit back down: the
    // ordinary interview is weighted against the four angles as a body, not
    // against each of them separately, which is the difference between an
    // angle being a beat and an angle being what everybody does.
    const weights: Array<[SpokenAngle | undefined, number]> = [[undefined, angles.length], ...angles];
    const floored = weights.map(([angle, w]) => [angle, Math.max(INTERVIEW_ANGLES.minWeight, w)] as [SpokenAngle | undefined, number]);
    let roll = ctx.rng.nextFloat() * floored.reduce((sum, [, w]) => sum + w, 0);
    for (const [angle, w] of floored) {
        roll -= w;
        if (roll <= 0) return angle;
    }
    return undefined;
}

/** Whoever a tribute would actually name, if they were going to name anybody. */
function calloutTarget(t: Tribute, cast: Tribute[]): Tribute | undefined {
    const candidates = cast.filter(o => o.id !== t.id);
    if (candidates.length === 0) return undefined;
    // The person you already dislike, weighted by how much the country would
    // care — naming the top of the board is a bigger night than naming a
    // twelve-year-old from Nine, and the tribute knows it.
    return candidates.reduce((best, o) => {
        const score = (o.trainingScore - INTERVIEW_ANGLES.ruthlessWarrior.trainingPivot) - getRel(t, o.id) / RESPECT.trainingWeight;
        const bestScore = (best.trainingScore - INTERVIEW_ANGLES.ruthlessWarrior.trainingPivot) - getRel(t, best.id) / RESPECT.trainingWeight;
        return score > bestScore ? o : best;
    }, candidates[0]);
}

/**
 * The angle, said out loud, and what it costs. Every one of these has to reach
 * something downstream or it is decoration: the signal moves recruitment, the
 * callout moves fear in both directions, defiance moves sponsor money hard in
 * a direction nobody chose, and grief moves the crowd and the tribute.
 */
function speakAngle(ctx: SimContext, t: Tribute, angle: SpokenAngle, cast: Tribute[]) {
    t.interviewAngle = angle;
    const others = cast.filter(o => o.id !== t.id);

    if (angle === 'alliance-signal') {
        ctx.logEvent(
            `${t.name} looks past Caesar and into the camera and says it plainly: they are not doing this alone, and there is room for somebody. Twenty-three people watch that from a chair backstage, and at least four of them are still thinking about it at the gong.`,
            [t.id],
            { important: true, category: 'interview' }
        );
        others.forEach(o => {
            adjustRel(o, t.id, INTERVIEWS.warmRapport);
            adjustRespect(o, t.id, RESPECT.witnessCompetence);
        });
        addExcitement(t, INTERVIEWS.heldExcitement);
        return;
    }

    if (angle === 'target-callout') {
        const target = calloutTarget(t, cast);
        if (!target) return;
        t.interviewCalloutId = target.id;
        ctx.logEvent(
            `${t.name} is asked who worries them and answers with a name: ${target.name}, District ${target.district}. Not a boast — an appointment. Caesar lets the silence run for a second longer than he should.`,
            [t.id, target.id],
            { important: true, category: 'interview' }
        );
        // Animosity in both directions, and it is not symmetrical: the named
        // party has been threatened in front of the country, and the one doing
        // the naming has just told everybody else where to look first.
        adjustRel(target, t.id, -INTERVIEWS.hostileDistrust * 2);
        adjustRel(t, target.id, -INTERVIEWS.hostileDistrust);
        addFear(target, t.id, FEAR.lostExchange);
        addFear(t, target.id, FEAR.realityCorrection);
        adjustRespect(target, t.id, RESPECT.witnessKill);
        others.forEach(o => {
            if (o.id === target.id) return;
            adjustRel(o, t.id, -INTERVIEWS.hostileCareerRespect);
        });
        addExcitement(t, INTERVIEWS.openedExcitement);
        addExcitement(target, INTERVIEWS.heldExcitement);
        return;
    }

    if (angle === 'defiance') {
        // The Capitol is not uniformly charmed by being told what it is. Charm
        // decides which way the room breaks, and it breaks hard either way.
        const charmed = ctx.rng.chance(INTERVIEWS.holdChanceFloor + t.attributes.charisma * INTERVIEWS.holdPerCharisma);
        ctx.logEvent(
            charmed
                ? `${t.name} declines the question Caesar actually asked and answers a different one, about District ${t.district} and what it costs to live there. The band comes in early. It does not help; half the audience has already stopped clapping to listen.`
                : `${t.name} says something about the Games that is not in anybody's script, and the camera cuts to Caesar's face while the sound engineer finds something else to do. It is over in four seconds and everybody watching will remember it.`,
            [t.id],
            { important: true, category: 'interview' }
        );
        t.sponsorTrust = charmed
            ? Math.min(100, t.sponsorTrust + INTERVIEWS.heldTrust * 2)
            : Math.max(0, t.sponsorTrust - INTERVIEWS.fumbledTrust * 2);
        t.reputation = Math.max(INTERVIEWS.reputationFloor, Math.min(INTERVIEWS.reputationCeiling,
            t.reputation + (charmed ? INTERVIEWS.fumbledReputation : -INTERVIEWS.fumbledReputation)));
        // Either way, it is the most interesting thing that happened all night.
        addExcitement(t, INTERVIEWS.openedExcitement);
        return;
    }

    ctx.logEvent(
        `Caesar asks ${t.name} who is watching at home, and the answer takes a while to arrive. When it does it is a name, and then a second name, and the audience makes a sound the Capitol does not usually make on this programme.`,
        [t.id],
        { important: true, category: 'interview' }
    );
    others.forEach(o => adjustRel(o, t.id, INTERVIEWS.warmRapport));
    t.sponsorTrust = Math.min(100, t.sponsorTrust + INTERVIEWS.heldTrust);
    addExcitement(t, INTERVIEWS.openedExcitement);
    // Saying it out loud is not catharsis; it is a reason, and a reason is
    // what `engine/resolve.ts` spends when the arena starts taking things away.
    t.resolve = Math.min(RESOLVE.max, (t.resolve ?? RESOLVE.start) + RESOLVE.vengeanceBonus);
}

/**
 * §6.3: Caesar has a memory.
 *
 * No interview referenced any other, which is the one thing a live programme
 * with a running order absolutely does. The tributes go on in order; the man
 * on the couch has been listening to all of it.
 */
function caesarCallback(ctx: SimContext, previous: Tribute, current: Tribute, cast: Tribute[]) {
    if (previous.interviewAngle === 'target-callout' && previous.interviewCalloutId) {
        const named = cast.find(o => o.id === previous.interviewCalloutId);
        if (named && named.id === current.id) {
            ctx.logEvent(
                `Caesar does not waste it: "${previous.name} sat in that chair four minutes ago and said your name." ${current.name} has had four minutes to decide what to do with that.`,
                [current.id, previous.id],
                { important: true, category: 'interview' }
            );
            return;
        }
        ctx.logEvent(
            `"You will have heard what ${previous.name} said just now," Caesar begins, because of course they heard it — there is one screen backstage and nobody is allowed to turn it off.`,
            [current.id, previous.id],
            { category: 'interview' }
        );
        return;
    }
    if (previous.interviewAngle === 'alliance-signal') {
        ctx.logEvent(
            `Caesar opens by mentioning that ${previous.name} was just here looking for company in that arena, and asks ${current.name} whether they were listening. The pause before the answer is the answer.`,
            [current.id, previous.id],
            { category: 'interview' }
        );
        return;
    }
    if (previous.interviewAngle === 'defiance') {
        ctx.logEvent(
            `Caesar is still recovering from ${previous.name} and greets ${current.name} a shade too warmly, the way a man does when he wants the next three minutes to be easier than the last three.`,
            [current.id, previous.id],
            { category: 'interview' }
        );
    }
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

    // §4.1: the training scores were broadcast; everyone in the cast has
    // done the arithmetic on everyone else. Respect (professional esteem) is
    // seeded here, distinct from regard.
    cast.forEach(t => {
        cast.forEach(o => {
            if (o.id === t.id) return;
            const read = (o.trainingScore - 5) * RESPECT.trainingWeight;
            if (read !== 0) adjustRespect(t, o.id, read);
        });
    });

    // §6.3: the running order, held so the man on the couch can refer back to
    // it. The phase already ran the cast in order; nothing was listening.
    let previous: Tribute | undefined;
    cast.forEach(t => {
        if (previous) caesarCallback(ctx, previous, t, cast);
        previous = t;
        // §11.2: Caesar opens off the parade. The chariot angle is the last
        // thing the Capitol saw of them, and a memorable one is the intro.
        if (t.chariotAngle && (t.paradeBuzz ?? 0) >= 2) {
            ctx.logEvent(
                `Caesar opens on the parade footage: ${t.name}, sent down the avenue ${t.chariotAngle} — "the whole city is still talking about that entrance," and for once he is not exaggerating.`,
                [t.id],
                { category: 'interview' }
            );
        }
        // ---- Beat one: the angle they walked out with ----
        // §6.10: a coached tribute walks on with the angle the player chose
        // for them; whether they can hold it under Caesar is still their own
        // charisma's problem.
        const coached = ctx.state.playerCoaching;
        const pinned = coached?.tributeId === t.id && coached.interviewStrategy
            ? INTERVIEW_SCENARIOS.find(s => s.strategy === coached.interviewStrategy)
            : undefined;
        const scenario = pinned ?? pickAngle(ctx, t);
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

        let persona = scenario.strategy as InterviewPersona;
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
            if (!held) persona = (PERSONA_DRIFT[scenario.strategy] ?? scenario.strategy) as InterviewPersona;
        }

        // §4.4: Star-Crossed as strategy. A charismatic tribute with the
        // nerve for it decides *here*, on the couch, that a romance will be
        // worth sponsors — and carries that plan into the arena, where the
        // performed-bond machinery pays it off (see ROMANCE.showmanceMultiplier).
        if (t.attributes.charisma >= ROMANCE.performerCharisma
            && ctx.rng.chance(ROMANCE.showmanceInterviewChance)
            // balance-exempt: archetype-table band test, not an independent dial
            && (ARCHETYPES[t.archetype].treachery > 0.15 || t.archetype === 'trickster')) {
            t.interviewAngle = 'showmance';
            ctx.logEvent(
                `${t.name} lets one answer hang a half-second too long, glances into the wings, and the Capitol decides on the spot that somebody in that arena holds their heart. Nobody backstage can say who. That is the point.`,
                [t.id],
                { important: true, category: 'interview' }
            );
        }

        // §6.3: and what else they did with the three minutes. A showmance is
        // already a whole strategy; anybody who did not plan one has the other
        // four things a live microphone is good for.
        if (t.interviewAngle !== 'showmance') {
            const spoken = pickSpokenAngle(ctx, t);
            if (spoken) speakAngle(ctx, t, spoken, cast);
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
        // §1.7: read from the shared persona tables rather than a fourth
        // hand-typed copy of the same strings.
        const hostile = !!t.interviewStrategy && COLD_PERSONAS.includes(t.interviewStrategy)
            && t.interviewStrategy !== 'The Mysterious Enigma';
        const warm = !!t.interviewStrategy && WARM_PERSONAS.includes(t.interviewStrategy)
            && t.interviewStrategy !== 'The Charming Flirt' && t.interviewStrategy !== 'The Quirky Oddball';
        if (!hostile && !warm) return;
        cast.forEach(other => {
            if (other.id === t.id) return;
            if (hostile) adjustRel(other, t.id, other.isCareer ? INTERVIEWS.hostileCareerRespect : -INTERVIEWS.hostileDistrust);
            if (warm) adjustRel(other, t.id, INTERVIEWS.warmRapport);
        });
    });

    const boldest = cast.filter(t => !!t.interviewStrategy
        && COLD_PERSONAS.includes(t.interviewStrategy)
        && t.interviewStrategy !== 'The Mysterious Enigma');
    if (boldest.length > 0) {
        ctx.logEvent(
            `The Capitol replays the threats all night. ${boldest.map(t => t.name).join(', ')} will walk into that arena with a target already painted on.`,
            boldest.map(t => t.id),
            { important: true, category: 'interview' }
        );
    }
}
