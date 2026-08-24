import { GameState, InjurySite, Tribute } from '../models/types';
import { objectiveLabel } from '../engine/objectives';
import { sanityBandOf } from '../engine/sanityBands';
import { resolveOf } from '../engine/resolve';
import { fearOf } from '../engine/fear';
import { STANCE_PROFILES } from '../data/stances';
import { bodyLabel, isGrowingInto } from '../engine/physique';

/**
 * A5: the plain-English sentence that goes above every number.
 *
 * The tribute sheet opens with a header that can stack twelve chips, several of
 * them popovers containing paragraphs — genuinely the most information-dense
 * thing in the app and the hardest to read. One generated sentence, assembled
 * from age, build, stance, objective, the worst vital and the person they are
 * most afraid of, does more for comprehension than the whole chip wall.
 */

const STANCE_PHRASE: Record<string, string> = {
    Aggressive: 'looking for a fight',
    Defensive: 'holding their ground',
    Evasive: 'hiding',
    Hunting: 'hunting somebody in particular',
    Fortified: 'dug in',
    Desperate: 'past caring',
    Scavenging: 'picking over what other people left',
    Shadowing: 'following somebody who has not noticed',
};

/** The vital in the worst shape, phrased as a person would say it. */
function worstVital(t: Tribute): string | null {
    const candidates: Array<[number, string]> = [
        [t.vitals.thirst, 'badly dehydrated'],
        [t.vitals.hunger, 'starving'],
        [t.vitals.fatigue, 'exhausted'],
    ];
    const [value, phrase] = candidates.sort((a, b) => b[0] - a[0])[0];
    if (value < 60) return null;
    return phrase;
}

/** Who they are most afraid of, if anybody. */
export function worstFear(gameState: GameState, t: Tribute): Tribute | undefined {
    let worst: Tribute | undefined;
    let worstValue = 0;
    gameState.tributes.forEach(o => {
        if (o.id === t.id || o.status !== 'alive') return;
        const value = fearOf(t, o.id);
        if (value > worstValue) { worstValue = value; worst = o; }
    });
    return worstValue >= 20 ? worst : undefined;
}

export function summarySentence(gameState: GameState, t: Tribute): string {
    if (t.status === 'dead') {
        return `${t.name}, ${t.age}, of District ${t.district}. `
            + `Died on day ${t.dayOfDeath ?? '—'} — ${(t.causeOfDeath ?? 'eliminated').toLowerCase()}`
            + `${t.kills > 0 ? `, having taken ${t.kills} with them` : ''}.`;
    }

    // §3.1: two axes, so the sentence can say what the run has done to them.
    // A tribute who walked in Padded and is now Wasted is a different body,
    // and this is where the audience hears about it.
    const phrase = bodyLabel(t);
    const build = `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`
        + (isGrowingInto(t) ? ', and nowhere near grown into it yet' : '');
    const stance = STANCE_PHRASE[t.stance] ?? STANCE_PROFILES[t.stance]?.label.toLowerCase() ?? 'moving';
    const opener = `${t.name}, ${t.age}, of District ${t.district}. ${build} and ${stance}`;

    const clauses: string[] = [];
    // Lowercase only the leading character: `objectiveLabel` embeds zone and
    // tribute names, and flattening the whole string turned "The Cornucopia"
    // into "the cornucopia" mid-sentence.
    const rawObjective = objectiveLabel(gameState, t);
    const objective = rawObjective.charAt(0).toLowerCase() + rawObjective.slice(1);
    if (objective && !/^surviving/i.test(objective)) clauses.push(`they are ${objective}`);

    const vital = worstVital(t);
    if (vital) clauses.push(`they are ${vital}`);
    else if (t.health < 40) clauses.push('they are badly hurt');

    const band = sanityBandOf(t);
    if (band === 'gone') clauses.push('they have come apart');
    else if (band === 'unravelling') clauses.push('they are unravelling');

    if (resolveOf(t) < 25) clauses.push('they have stopped wanting to win');

    const feared = worstFear(gameState, t);
    if (feared) clauses.push(`they are afraid of ${feared.name}`);

    if (clauses.length === 0) return `${opener}. Nothing about them is going wrong yet.`;
    // Oxford-and, so the sentence reads rather than lists.
    const last = clauses.pop()!;
    return clauses.length === 0
        ? `${opener} — ${last}.`
        : `${opener} — ${clauses.join(', ')}, and ${last}.`;
}

/** A5: a word above each gauge, so a bar is a state rather than a percentage. */
export function vitalWord(label: string, value: number, tribute?: Tribute): string {
    switch (label) {
        case 'Health':
            return value >= 85 ? 'unhurt' : value >= 60 ? 'walking wounded' : value >= 35 ? 'badly hurt' : 'barely standing';
        case 'Sanity': {
            // `sanityBands.ts` already computes these thresholds; reusing it
            // rather than inventing a second set keeps the word and the
            // behaviour that word describes in step.
            const band = tribute ? sanityBandOf(tribute) : 'steady';
            return { steady: 'steady', frayed: 'fraying', unravelling: 'unravelling', gone: 'gone' }[band];
        }
        case 'Resolve':
            return value >= 70 ? 'set on it' : value >= 45 ? 'holding' : value >= 25 ? 'wavering' : 'finished';
        case 'Hunger':
            return value <= 25 ? 'fed' : value <= 55 ? 'hungry' : value <= 80 ? 'very hungry' : 'starving';
        case 'Thirst':
            return value <= 25 ? 'watered' : value <= 55 ? 'thirsty' : value <= 80 ? 'parched' : 'dying of it';
        case 'Fatigue':
            return value <= 25 ? 'rested' : value <= 55 ? 'tired' : value <= 80 ? 'worn down' : 'exhausted';
        case 'Sponsor trust':
            return value >= 70 ? 'backed' : value >= 45 ? 'watched' : value >= 20 ? 'overlooked' : 'forgotten';
        default:
            return '';
    }
}

/** The four graded injury sites, for the body diagram. */
export const BODY_SITES: InjurySite[] = ['head', 'torso', 'arms', 'legs'];

export function severityOf(t: Tribute, site: InjurySite): number {
    const graded = t.injurySeverity?.[site];
    if (graded !== undefined) return graded;
    return t.injuries[site] ? 1 : 0;
}
