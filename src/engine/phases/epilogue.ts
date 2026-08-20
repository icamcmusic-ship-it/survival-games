import { SimContext, getAlive } from '../context';
import { EpilogueQA, EventLog, Tribute } from '../../models/types';
import { ensureMemory } from '../memory';
import { getRel } from '../relationships';
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
