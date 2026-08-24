import { SimContext, getAlive } from './context';
import { InterviewPersona, Tribute } from '../models/types';
import { PRE_ARENA } from '../data/balance';
import { addExcitement } from './audience';
import { adjustRespect } from './relationships';
import { addFear } from './fear';
import { stanceFamily } from '../data/stances';
import { ensureMemory } from './memory';
import { clampTribute } from './vitals';

/**
 * §6.3: the persona, tested against the arena.
 *
 * The interview persona was written once on Caesar's couch and then read
 * forever — bloodbath targeting, alliance chemistry, sponsor appeal — without
 * anybody ever checking whether the tribute was still the person they had sold.
 * A tribute who spent three minutes promising a short Games and then hid in a
 * culvert for four days was, to the crowd, exactly as terrifying on day five as
 * on day one.
 *
 * This is the crowd doing the arithmetic. Every cycle, what the persona
 * promised is compared against what the tribute is actually doing; playing
 * against type accrues backlash, and the backlash is eventually spent out loud
 * and in sponsor money. Living it is worth the opposite.
 *
 * §6.2: the concealed tribute's cover breaking is the same shape of event —
 * the arena discovering that a public number was a lie — so the detection for
 * it lives here rather than in combat.ts.
 */

/** What each persona promised the country it would look like in the arena. */
type PersonaTest = (t: Tribute) => boolean | undefined;

/**
 * `undefined` means the persona makes no testable promise: nobody can be
 * accused of failing to be a wildcard, and an oddball is an oddball wherever
 * they are sitting. Those tributes neither accrue backlash nor earn credit.
 */
const PERSONA_TESTS: Record<InterviewPersona, PersonaTest> = {
    // Menace has to be visible. A threat nobody has seen press anybody is a
    // threat the crowd stops believing in.
    'The Ruthless Warrior': t => t.kills > 0 || stanceFamily(t.stance) === 'aggressive',
    'The Arrogant Brute': t => t.kills > 0 || stanceFamily(t.stance) === 'aggressive',
    // Quiet is half of it; the other half is that the quiet ends in somebody
    // not getting up. Shadowing and Hunting both count: they are the stance of
    // somebody working a person rather than avoiding one.
    'The Silent Threat': t => t.kills > 0 || t.stance === 'Shadowing' || t.stance === 'Hunting',
    // The strategist promised a plan, and a plan in this arena looks like
    // people standing where you put them, or ground you chose.
    'The Cold Strategist': t => t.allianceId !== undefined || stanceFamily(t.stance) === 'defensive',
    // The enigma's promise is to stay unexplained.
    'The Mysterious Enigma': t => stanceFamily(t.stance) === 'evasive',
    // The two romance angles are held by having somebody at all.
    'The Star-Crossed Lover': t => t.traits.includes('Star-Crossed') || t.allianceId !== undefined,
    'The Charming Flirt': t => t.traits.includes('Star-Crossed') || t.allianceId !== undefined,
    // A Career who sold the room a humble underdog is the one shape of this
    // the crowd will not forgive.
    'The Humble Underdog': t => !t.isCareer,
    // Grief that has already turned into a body count was never grief.
    'The Grieving Sibling': t => t.kills === 0,
    // The reluctant hero is held by standing with somebody, or by having stood
    // over somebody and walked away.
    'The Reluctant Hero': t => t.allianceId !== undefined || (t.sparedDowned?.length ?? 0) > 0,
    'The District Loyalist': t => t.allianceId !== undefined || (t.sparedDowned?.length ?? 0) > 0,
    'The Quirky Oddball': () => undefined,
    'The Wildcard': () => undefined,
};

const BACKLASH_LINES: Record<string, (t: Tribute) => string> = {
    aggressive: t => `The Capitol feed cuts to ${t.name} for the fourth time in a day and finds them doing nothing at all. Caesar's panel replays the interview — the short Games, the promise — and lets it sit there without comment. It does not need one.`,
    romantic: t => `Somewhere in the Capitol a bookmaker moves ${t.name}'s line, and the reason given on air is that the great love story has now spent a week entirely alone.`,
    quiet: t => `The mystery around ${t.name} has stopped being a mystery. A tribute the country cannot explain is worth watching; a tribute the country has simply stopped being shown is worth nothing.`,
    generic: t => `${t.name} sold the country one person on that couch and has spent every cycle since being somebody else. The Capitol has noticed, and the Capitol is not sentimental about being lied to.`,
};

function backlashLine(persona: InterviewPersona): keyof typeof BACKLASH_LINES {
    if (persona === 'The Ruthless Warrior' || persona === 'The Arrogant Brute' || persona === 'The Silent Threat') return 'aggressive';
    if (persona === 'The Star-Crossed Lover' || persona === 'The Charming Flirt') return 'romantic';
    if (persona === 'The Mysterious Enigma') return 'quiet';
    return 'generic';
}

/**
 * Per-cycle. Wire after `tickResolve` in `processDayNight`, once the cycle's
 * fighting, moving and stance changes have all landed — this reads the state
 * the cycle left behind, and writes nothing anybody else reads mid-cycle.
 */
export function tickPersona(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(t => {
        revealConcealed(ctx, t, alive);

        const persona = t.interviewStrategy;
        if (!persona) return;
        const holding = PERSONA_TESTS[persona]?.(t);
        if (holding === undefined) return;

        if (holding) {
            // Living it in front of the cameras is the whole trade the persona
            // was: the crowd paid attention on the couch and is being paid back.
            addExcitement(t, PRE_ARENA.personaHeldExcitement);
            return;
        }

        t.personaBacklash = (t.personaBacklash ?? 0) + PRE_ARENA.backlashPerCycle;
        if (t.personaBacklash < PRE_ARENA.backlashThreshold) return;

        // Said out loud, paid for once, and then the clock starts again — a
        // tribute can be caught out twice in a long Games, but the crowd does
        // not charge them for the same week of hiding every cycle.
        t.personaBacklash = 0;
        t.sponsorTrust = Math.max(0, t.sponsorTrust - PRE_ARENA.backlashTrustCost);
        clampTribute(t);
        ctx.logEvent(
            BACKLASH_LINES[backlashLine(persona)](t),
            [t.id],
            { important: true, category: 'sponsor' }
        );
    });
}

/**
 * §6.2: the payoff for three days of doing nothing well on purpose.
 *
 * `trainingStrategy: 'conceal'` cost sponsor trust and a training score and
 * bought exactly one thing downstream — a discount in `assessZone`'s threat
 * read — with no moment where anybody found out. This is that moment: the
 * first time a concealed tribute fights for real, everyone alive revises at
 * once, and the crowd, which loves nothing better than having been wrong,
 * pays for the privilege.
 */
function revealConcealed(ctx: SimContext, t: Tribute, alive: Tribute[]) {
    if (t.trainingStrategy !== 'conceal' || t.concealRevealed) return;
    // Training-floor altercations are recorded the same way and are emphatically
    // not this: a fight only counts once the Games are running, which is what
    // the cycle stamp distinguishes.
    const mem = ensureMemory(t);
    const foughtInArena = Object.values(mem.rivals ?? {}).some(r => r.fights > 0 && r.lastFightCycle > 0);
    if (t.kills === 0 && !foughtInArena) return;

    t.concealRevealed = true;
    ctx.logEvent(
        `Whatever ${t.name} was doing on the training floor, this is not it. The number beside their face on the broadcast was a decision, and every person still alive in this arena has just watched them make a different one.`,
        [t.id],
        { important: true, category: 'combat' }
    );
    alive.forEach(o => {
        if (o.id === t.id) return;
        adjustRespect(o, t.id, PRE_ARENA.concealRevealRespect);
        addFear(o, t.id, PRE_ARENA.concealRevealFear);
    });
    t.sponsorTrust = Math.min(100, t.sponsorTrust + PRE_ARENA.concealRevealTrust);
    clampTribute(t);
}
