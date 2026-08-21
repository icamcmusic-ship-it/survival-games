import { SimContext, getAlive } from '../context';
import { EpilogueQA, EventLog, GameState, Tribute } from '../../models/types';
import { ensureMemory } from '../memory';
import { getRel } from '../relationships';
import { ENDINGS } from '../../data/balance';
import { RNG } from '../../utils/rng';

/** Picks one variant, seeded so the same run always gives the same interview. */
function pick(rng: RNG, variants: string[]): string {
    return rng.pick(variants);
}

/**
 * The victor's interview, assembled from what actually happened.
 *
 * The old version asked about traits, a kill count and a sponsor-trust
 * threshold — all of which are true of a hundred different runs. Caesar now
 * reads the chronicle: the tribute the victor avenged, the rival they could
 * never shake, the manner of the final kill, the night they nearly died. Two
 * runs with the same winning archetype produce two different interviews,
 * because they were two different Games.
 */

interface RunFacts {
    finalKill?: EventLog;
    firstKill?: EventLog;
    betrayals: EventLog[];
    nearDeath?: EventLog;
    alliesLost: Tribute[];
    nemesis?: Tribute;
    avenged?: Tribute;
    avengedFor?: Tribute;
    sponsorGifts: EventLog[];
    romance?: EventLog;
    daysSurvived: number;
    lastFallen?: Tribute;
}

function gatherFacts(ctx: SimContext, winner: Tribute): RunFacts {
    const log = ctx.state.log;
    const byId = new Map(ctx.state.tributes.map(t => [t.id, t]));
    const involving = (l: EventLog) => l.tributesInvolved.includes(winner.id);

    const kills = log.filter(l => l.category === 'kill' && involving(l));
    const betrayals = log.filter(l => l.category === 'betrayal' && involving(l));
    const sponsorGifts = log.filter(l => l.category === 'sponsor' && involving(l));
    const romance = [...log].reverse().find(l => l.category === 'romance' && involving(l));
    const nearDeath = [...log].reverse().find(l =>
        involving(l) && (l.category === 'mutt' || l.category === 'hazard') && l.important);

    const mourned = ensureMemory(winner).mourned
        .map(id => byId.get(id))
        .filter((t): t is Tribute => !!t);

    // The rival the victor hated most, and the one whose death they answered for.
    let nemesis: Tribute | undefined;
    let worst = -20;
    Object.entries(winner.relationships).forEach(([id, value]) => {
        const other = byId.get(id);
        if (!other || value >= worst) return;
        // A nemesis has to be someone they actually tangled with. Blanket
        // distrust penalties used to drift a stranger's number low enough to
        // win this search, so the victor could be handed a "nemesis" they never
        // met — and, before the fix in applyBetrayalFallout, one who had been
        // dead since day two.
        const feud = winner.memory?.rivals?.[id];
        const met = (feud?.fights ?? 0) > 0 || winner.memory?.vengeance?.includes(id);
        if (!met) return;
        worst = value;
        nemesis = other;
    });

    // Vengeance discharged: someone the victor mourned, whose killer the victor killed.
    let avenged: Tribute | undefined;
    let avengedFor: Tribute | undefined;
    mourned.forEach(lost => {
        const killerName = lost.causeOfDeath?.match(/^Killed by ([^(]+)/)?.[1]?.trim();
        if (!killerName) return;
        const killer = ctx.state.tributes.find(t => t.name === killerName);
        if (killer && killer.status === 'dead' && killer.causeOfDeath?.includes(winner.name)) {
            avenged = killer;
            avengedFor = lost;
        }
    });

    const fallen = ctx.state.tributes
        .filter(t => t.status === 'dead' && t.dayOfDeath !== undefined)
        .sort((a, b) => (b.dayOfDeath ?? 0) - (a.dayOfDeath ?? 0));

    return {
        finalKill: kills[kills.length - 1],
        firstKill: kills[0],
        betrayals,
        nearDeath,
        alliesLost: mourned,
        nemesis,
        avenged,
        avengedFor,
        sponsorGifts,
        romance,
        daysSurvived: ctx.state.day,
        lastFallen: fallen[0],
    };
}

/** Strips the leading tag some log lines carry, so quotes read cleanly. */
function quoteLine(text: string): string {
    return text.replace(/^(BETRAYAL|TRAGEDY|VENGEANCE|GROUP FIGHT|ROMANCE|BORDER COLLAPSE|GAMEMAKER|TRAINING RESULTS):\s*/, '');
}

export function processEpilogue(ctx: SimContext) {
    ctx.state.phase = 'epilogue';
    ctx.rng = new RNG(`${ctx.state.seed}-epilogue`);
    const rng = ctx.rng;
    const alive = getAlive(ctx.state);
    const winner = alive[0];

    const qas: EpilogueQA[] = [];

    if (!winner) {
        qas.push({
            question: "Caesar Flickerman: 'The Arena is silent. There is no victor. What are your final thoughts on this dark chapter?'",
            answer: "Official broadcast: 'A grim end. For the first time, no tribute survived the Arena hazards. Deep mourning is declared across all Districts.'"
        });
        ctx.state.epilogueInterview = qas;
        return;
    }

    // §7.1: two victors sit the couch together — a joint interview instead of
    // the single-victor script, which reads wrong with somebody else alive.
    if (alive.length === 2) {
        const [a, b] = alive;
        const lovers = ctx.state.victorIds !== undefined && a.allianceId?.startsWith('lovers-');
        qas.push({
            question: `Caesar Flickerman: 'Ladies and gentlemen — for the first time in living memory, TWO victors! ${a.name} and ${b.name}! Tell us: when did you know you would only leave that arena together?'`,
            answer: `${a.name}: '${pick(rng, [
                'There was never a version where one of us walked out alone, Caesar. We just made the arena admit it.',
                'From the gong. Everything after that was arithmetic.',
                'When the field got small enough to count, Caesar. You start doing the maths, and every answer with one of us missing was wrong.',
            ])}'`,
        });
        qas.push({
            question: `Caesar Flickerman: '${b.name} — the whole Capitol watched those final moments. What was going through your mind?'`,
            answer: `${b.name}: '${pick(rng, lovers ? [
                'That I meant it, Caesar. Whatever happened next, I meant it.',
                'Nothing was going through my mind. There was just their hand, and what was in it, and knowing we would not be needing it.',
                'That the Capitol had a choice to make, and for once it was not ours.',
            ] : [
                `That we had done it the hard way, together, and I was not going to apologise for either half of that.`,
                `Mostly ${a.name}, Caesar. You do not carry someone that far and then start keeping score at the finish line.`,
                'That the anthem was playing and both of us could hear it. I stopped listening to everything else.',
            ])}'`,
        });
        qas.push({
            question: `Caesar Flickerman: 'Two crowns, then. Panem, your victors — ${a.name} and ${b.name} of District${a.district === b.district ? ` ${a.district}` : `s ${a.district} and ${b.district}`}!'`,
            answer: `Official broadcast: 'The ${ctx.state.day}-day Games conclude with two victors — a first the Capitol assures us was always possible.'`,
        });
        ctx.state.epilogueInterview = qas;
        return;
    }

    const facts = gatherFacts(ctx, winner);

    qas.push({
        question: `Caesar Flickerman: 'Ladies and gentlemen, the victor of the ${facts.daysSurvived}-day Games... ${winner.name} of District ${winner.district}! Tell us — what was going through your mind when you first stepped onto that pedestal?'`,
        answer: `${winner.name}: '${pick(rng, [
            'Honestly, Caesar, that first sound of the gong was terrifying. I just knew I had to survive, no matter what it took.',
            'I remember thinking there was no version of that pedestal that felt real. Then it stopped feeling like a thought and started being a body running.',
            'I do not think I decided anything on that pedestal, Caesar. My legs decided for me the second the gong went.',
            'Everything went very quiet, and then very loud. I have never heard sixty seconds take that long since.',
        ])}'`
    });

    // The specific thing that ended it.
    if (facts.finalKill) {
        qas.push({
            question: `Caesar Flickerman: 'Let us talk about how it ended. "${quoteLine(facts.finalKill.text)}" The whole Capitol was on its feet.'`,
            answer: `${winner.name}: 'I do not remember deciding to do it. I remember it being over, and the cannon, and realising the cannon was not for me.'`
        });
    } else if (winner.kills === 0) {
        qas.push({
            question: "Caesar Flickerman: 'Fascinatingly, you never took a single life out there. You won on stealth and endurance alone — a ghost of the arena!'",
            answer: `${winner.name}: 'I did not want to take a life if I did not have to, Caesar. Letting the arena and the others do the work was my only option.'`
        });
    }

    // Vengeance is the single best story a run can produce.
    if (facts.avenged && facts.avengedFor) {
        qas.push({
            question: `Caesar Flickerman: 'You went after ${facts.avenged.name} directly, after what happened to ${facts.avengedFor.name}. That was not survival. That was personal.'`,
            answer: `${winner.name}: 'It was. I do not apologise for it. ${facts.avengedFor.name} did not get to come home, and I was not going to let the person who did that walk out of there.'`
        });
    } else if (facts.alliesLost.length > 0) {
        const lost = facts.alliesLost[facts.alliesLost.length - 1];
        qas.push({
            question: `Caesar Flickerman: 'You lost ${lost.name} out there. Our cameras caught the moment you heard the cannon. What do you want the districts to know about them?'`,
            answer: `${winner.name}: '${lost.name} was better than this place. ${lost.causeOfDeath ?? 'They did not deserve what happened'} — that is what I have to carry now. I would rather have gone home with them than gone home a victor.'`
        });
    }

    // A rival who defined the run.
    if (facts.nemesis && facts.nemesis.id !== facts.avenged?.id) {
        const rel = getRel(winner, facts.nemesis.id);
        qas.push({
            question: `Caesar Flickerman: 'And ${facts.nemesis.name} of District ${facts.nemesis.district}. You two could not stay away from each other. Was there ever a moment you thought they had you?'`,
            answer: rel < -60
                ? `${winner.name}: 'Every time I closed my eyes, Caesar. I stopped thinking of ${facts.nemesis.name} as another tribute somewhere around the halfway point. That is the honest answer.'`
                : `${winner.name}: 'More than once. ${facts.nemesis.name} was good, Caesar. On a different day it is them sitting in this chair.'`
        });
    }

    // Betrayal, from either side of the knife.
    if (facts.betrayals.length > 0) {
        const moment = facts.betrayals[facts.betrayals.length - 1];
        const betrayedByOther = ensureMemory(winner).timesBetrayed > 0;
        qas.push({
            question: `Caesar Flickerman: 'The alliances. "${quoteLine(moment.text)}" Do you regret how that went?'`,
            answer: betrayedByOther
                ? `${winner.name}: 'I learned what a promise is worth in there, Caesar. I trusted somebody and it nearly killed me. I did not make that mistake twice.'`
                : `${winner.name}: 'The alliance was always going to end, Caesar. Everyone in it knew that. I just picked the moment.'`
        });
    }

    // The night they nearly did not make it.
    if (facts.nearDeath) {
        qas.push({
            question: `Caesar Flickerman: 'We nearly lost you, of course. "${quoteLine(facts.nearDeath.text)}" How close was that, really?'`,
            answer: `${winner.name}: 'Closer than it looked on your screens, Caesar. I could not stand up afterwards. I lay there and listened for the hovercraft.'`
        });
    }

    // The romance, if the arena produced one.
    if (facts.romance) {
        qas.push({
            question: `Caesar Flickerman: 'And the story the whole of Panem followed. "${quoteLine(facts.romance.text)}" How will you hold that now?'`,
            answer: `${winner.name}: 'Every part of this belongs to both of us. I do not get to put that down just because I am home.'`
        });
    }

    // Sponsors — grounded in whether any parachute actually arrived.
    if (facts.sponsorGifts.length > 0) {
        qas.push({
            question: `Caesar Flickerman: '${facts.sponsorGifts.length} silver parachute${facts.sponsorGifts.length === 1 ? '' : 's'} came down for you. Anything you want to say to the people who sent them?'`,
            answer: `${winner.name}: '${pick(rng, [
                'To everyone in the Capitol who sent something down: you saved my life. That first parachute came when I had nothing left. Thank you.',
                'I felt every single one of those, Caesar. Somebody out there was watching closely enough to know exactly what I needed and when. I owe them more than a thank you.',
                'There were nights I had given up finding anything myself, and then the sky would open. I will not pretend that did not keep me alive.',
            ])}'`
        });
    } else {
        qas.push({
            question: "Caesar Flickerman: 'Not one parachute the entire Games! You did this with absolutely nothing from us. That is extraordinary self-reliance!'",
            answer: `${winner.name}: '${pick(rng, [
            'I had to learn to forage, find water, and rely on my own two hands. Nobody was coming. That turned out to be useful to know.',
            'Nobody sent me anything, Caesar, and somewhere around day three I stopped expecting them to. After that it got easier, oddly.',
            'I am not sure anyone in the Capitol knew my name until the third day. By then I had already worked out how to feed myself.',
        ])}'`
        });
    }

    // Character note, still keyed to who they are — but last, not first.
    if (winner.traits.includes('Bloodthirsty')) {
        qas.push({
            question: "Caesar Flickerman: 'You hunted out there. Some would call it bloodthirsty. Did you enjoy it?'",
            answer: `${winner.name}: '${pick(rng, [
                'It is a game of kill or be killed, Caesar. The Capitol wanted a show, and I gave them exactly that.',
                'I stopped apologising for it around the fourth day, Caesar. It was them or me, every single time, and I chose me.',
                'You call it bloodthirsty. I call it the only rule that arena actually enforced.',
            ])}'`
        });
    } else if (winner.traits.includes('Pacifist')) {
        qas.push({
            question: "Caesar Flickerman: 'You never wanted this. The whole audience could see it. How do you feel now that it is over?'",
            answer: `${winner.name}: '${pick(rng, [
                'I feel a profound sorrow for everyone who did not make it. I only defended myself when I had to. I dream of a day where we do not have to fight.',
                'I did not want any of this, Caesar. I want that said plainly, on the broadcast, where it can be heard.',
                'I am glad to be alive and I am not glad about how. I do not think those two things are supposed to sit together, and they do not.',
            ])}'`
        });
    } else if (winner.age <= 13) {
        qas.push({
            question: `Caesar Flickerman: 'You are ${winner.age} years old. The youngest victor this city has seen in a very long time. What do you say to the children watching at home?'`,
            answer: `${winner.name}: 'I would say... I hope they never have to find out what I found out. That is all I want to say about it.'`
        });
    } else if (winner.isCareer) {
        qas.push({
            question: "Caesar Flickerman: 'You trained for this your whole life. Did the arena live up to it?'",
            answer: `${winner.name}: '${pick(rng, [
                `Training in District ${winner.district} makes you strong, but nothing prepares you for the real thing. I am proud to bring the glory home.`,
                `Every drill, every hour on the academy floor — none of it tells you what the cannon actually sounds like. I am proud of what I did with it anyway.`,
                `District ${winner.district} raised me for exactly this, Caesar. I would like to say that made it easy. It did not. It made it survivable.`,
            ])}'`
        });
    } else {
        qas.push({
            question: "Caesar Flickerman: 'You entered as an underdog and outlasted every one of them. What kept you going in those long nights?'",
            answer: `${winner.name}: '${pick(rng, [
            `I kept thinking about home — District ${winner.district}, and the people in it. Whenever I was close to giving up, their faces pushed me forward.`,
            `Nobody expected District ${winner.district} to send anyone home this year, Caesar, least of all me. I intend to enjoy proving everyone wrong.`,
            `I was never supposed to be the one sitting in this chair. I thought about that a lot out there, right up until I stopped being able to afford to.`,
        ])}'`
        });
    }

    // §10.2: how it ends, beyond who is left standing.
    const ending = rollEnding(ctx, winner);
    if (ending !== 'standard') {
        qas.push(endingBeat(ctx, winner, ending));
        ctx.state.epilogueInterview = qas;
        return;
    }

    qas.push({
        question: "Caesar Flickerman: 'Well, champion, the crown is yours, and the Capitol is celebrating your triumphant return!'",
        answer: `${winner.name}: '${pick(rng, [
            'Thank you, Caesar. Let the people of the Capitol hear: I am going home.',
            'Thank you, Caesar. I do not think "triumphant" is the word I would use, but I am going home, and that is the one that matters.',
            'Thank you, Caesar. I have thought about this moment every day I was in there. It does not feel the way I thought it would. I am still going home.',
            'Thank you, Caesar. I would like District {district} to know I am coming back to them, and I have not forgotten who else is not.',
        ]).replace('{district}', String(winner.district))}'`
    });

    ctx.state.epilogueInterview = qas;
}

/**
 * §10.2: which ending this run gets.
 *
 * Three outcomes existed — last one standing, two victors, nobody — so the
 * final beat of a run was the one part a player had genuinely seen before by
 * the third Games. These three are drawn from what actually happened rather
 * than rolled flat: a victor who killed nobody and lost everyone has earned
 * the refusal; one the Gamemakers had to keep alive has earned the
 * overruling; one who arrives home wrecked has earned an epilogue that reads
 * as a loss.
 */
function rollEnding(ctx: SimContext, winner: Tribute): NonNullable<GameState['endingKind']> {
    const mourned = ensureMemory(winner).mourned.length;
    const resolve = winner.resolve ?? 70;

    // Refusal: they will not take the crown from the people who did this.
    if (winner.kills === 0 && mourned > 0 && ctx.rng.chance(ENDINGS.refusedChance)) {
        ctx.state.endingKind = 'refused';
        return 'refused';
    }
    // Overruled: the Gamemakers decide the show needed a different shape.
    if (winner.health <= ENDINGS.overruledMaxHealth && ctx.rng.chance(ENDINGS.overruledChance)) {
        ctx.state.endingKind = 'overruled';
        return 'overruled';
    }
    // Hollow: they won, and the epilogue reads as a loss anyway.
    if ((resolve <= ENDINGS.hollowMaxResolve || winner.vitals.sanity <= ENDINGS.hollowMaxSanity)
        && ctx.rng.chance(ENDINGS.hollowChance)) {
        ctx.state.endingKind = 'hollow';
        return 'hollow';
    }
    ctx.state.endingKind = 'standard';
    return 'standard';
}

function endingBeat(ctx: SimContext, winner: Tribute, kind: NonNullable<GameState['endingKind']>): EpilogueQA {
    const rng = ctx.rng;
    if (kind === 'refused') {
        ctx.logEvent(
            `${winner.name} is brought out to be crowned and will not stand for it. `
            + `The broadcast cuts to the anthem eleven seconds early, and everyone watching noticed.`,
            [winner.id],
            { important: true, category: 'system' }
        );
        return {
            question: "Caesar Flickerman: 'Champion — the crown. The Capitol is waiting.'",
            answer: `${winner.name}: '${pick(rng, [
                'You can put it on the chair, Caesar. I am not going to argue with you about it in front of everybody. I am just not going to wear it.',
                'I did not win anything. I was the last one left. Those are different sentences and I would like the Capitol to hear both of them.',
                'Twenty-three people are not coming home, Caesar, and you would like me to smile in a hat. No. Thank you, but no.',
            ])}'`,
        };
    }
    if (kind === 'overruled') {
        ctx.logEvent(
            `The hovercraft is in the air before the cannon finishes. Whatever the arena was going to do to ${winner.name}, `
            + `the Gamemakers have decided it will not be doing it on camera — the Games are declared over on their terms, not the arena's.`,
            [winner.id],
            { important: true, category: 'gamemaker' }
        );
        return {
            question: "Caesar Flickerman: 'They lifted you out with the arena still closing. How does it feel to be — forgive me — the Gamemakers' decision?'",
            answer: `${winner.name}: '${pick(rng, [
                'It feels like being told the ending, Caesar. I was there. I would have liked to find out for myself.',
                'They needed a victor by the evening broadcast and I was the one still upright. That is the whole of it.',
                'I was thirty seconds from finding out what I was, and somebody in a control room decided the Capitol did not need to see it.',
            ])}'`,
        };
    }
    ctx.logEvent(
        `${winner.name} comes home. The train, the cameras, the crowd on the platform, all of it exactly as it is supposed to be — `
        + `and anyone who has watched a victor come home before can see that this one did not entirely.`,
        [winner.id],
        { important: true, category: 'system' }
    );
    return {
        question: "Caesar Flickerman: 'Champion — the Capitol is celebrating. What are you looking forward to most?'",
        answer: `${winner.name}: '${pick(rng, [
            'Quiet, Caesar. I keep saying quiet and people keep laughing, and I keep meaning it.',
            'I do not know. I had a list. I have been trying to remember what was on it since the hovercraft.',
            'Sleeping, mostly. Though I have been told that part does not go the way you expect either.',
            'Ask me next year, Caesar. I do not think I am back yet.',
        ])}'`,
    };
}
