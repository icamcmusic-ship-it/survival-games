import { GameState, Tribute } from '../../models/types';
import { SimContext } from '../context';
import { adjustRel, getRel } from '../relationships';
import { scenarioCard } from '../../data/replayCards';
export { SCENARIO_CARDS, scenarioCard } from '../../data/replayCards';

/**
 * AUDIT-13 P1: scenario cards.
 *
 * An authored starting state, picked at setup like a mutator and carried in
 * the config (so saves, share links and replays reproduce it). Applied to the
 * cast the seed produced, at the reaping, with no RNG draws: the seed still
 * decides everybody, and the card decides only the one thing it is about.
 * Each card has its own achievement in `achievements.ts` (`a13-scenario-*`).
 */
const CAREER_DISTRICTS = [1, 2, 4];

/** The tributes a card is about, derived from the cast so it reads the same after the run. */
export function scenarioCast(state: Pick<GameState, 'tributes' | 'config'>): Tribute[] {
    const cast = state.tributes;
    const districts = [...new Set(cast.map(t => t.district))].sort((a, b) => a - b);
    const outer = districts.filter(d => !CAREER_DISTRICTS.includes(d));
    const byAge = (a: Tribute, b: Tribute) => a.age - b.age || a.district - b.district || a.id.localeCompare(b.id);
    switch (state.config.scenario) {
        case 'career-six': {
            // AUDIT-14 S9: with 2 or 3 districts there is no pack of six, and a
            // card called "The Pack of Six" that builds a pack of four is lying.
            // The setup screen disables it below four districts; a card that
            // arrives anyway (a hand-edited link) simply does not apply.
            const pack = cast.filter(t => CAREER_DISTRICTS.includes(t.district));
            return new Set(pack.map(t => t.district)).size === CAREER_DISTRICTS.length ? pack : [];
        }
        case 'lone-volunteer': {
            const top = Math.max(...cast.map(t => t.district));
            return cast.filter(t => t.district === top).slice(0, 1);
        }
        case 'rival-allies': {
            if (districts.length < 2) return [];
            // AUDIT-14 S9: the low end is the lowest district whose tribute is
            // not a Career, when there is one, so the pair is not folded into
            // the Career pack at the gong instead of forming their own.
            const lowPick = districts.map(d => cast.find(t => t.district === d && !t.isCareer)).find(Boolean)
                ?? cast.find(t => t.district === districts[0]);
            const hi = cast.find(t => t.district === districts[districts.length - 1]);
            return lowPick && hi && lowPick.district !== hi.district ? [lowPick, hi] : [];
        }
        case 'twins': {
            const d = outer[0];
            const pair = cast.filter(t => t.district === d);
            return pair.length === 2 ? pair : [];
        }
        case 'career-defector': {
            const careers = cast.filter(t => t.isCareer || CAREER_DISTRICTS.includes(t.district));
            return careers.slice(0, 1);
        }
        case 'mentors-favourite': {
            const top = Math.max(...cast.map(t => t.district));
            return [...cast].filter(t => t.district === top).sort(byAge).slice(-1);
        }
        case 'blind-draw':
            return cast.filter(t => CAREER_DISTRICTS.includes(t.district));
        case 'old-grudge': {
            for (let i = 0; i + 1 < districts.length; i++) {
                const a = cast.find(t => t.district === districts[i]);
                const b = cast.find(t => t.district === districts[i + 1]);
                if (a && b && districts[i + 1] - districts[i] === 1) return [a, b];
            }
            return [];
        }
        case 'youngest-reaped':
            return [...cast].sort(byAge).slice(0, 1);
        case 'the-favourite': {
            const careers = cast.filter(t => t.isCareer);
            return [...careers].sort(byAge).slice(-1);
        }
        case 'district-feud': {
            const d = outer[outer.length - 1];
            const pair = cast.filter(t => t.district === d);
            return pair.length === 2 ? pair : [];
        }
        case 'the-outsiders':
            return cast.filter(t => t.isCareer);
        case 'second-chance': {
            // The highest district: in every Panem the one with the thinnest record.
            const top = Math.max(...cast.map(t => t.district));
            return cast.filter(t => t.district === top).sort(byAge).slice(0, 1);
        }
        case 'packless':
            return cast.filter(t => t.isCareer);
        case 'the-understudy': {
            const d = outer[Math.floor(outer.length / 2)];
            return cast.filter(t => t.district === d).sort(byAge).slice(0, 1);
        }
        default:
            return [];
    }
}

const bond = (a: Tribute, b: Tribute, regard: number) => {
    adjustRel(a, b.id, Math.max(0, regard - getRel(a, b.id)));
    adjustRel(b, a.id, Math.max(0, regard - getRel(b, a.id)));
};

const sour = (a: Tribute, b: Tribute, regard: number) => {
    adjustRel(a, b.id, Math.min(0, regard - getRel(a, b.id)));
    adjustRel(b, a.id, Math.min(0, regard - getRel(b, a.id)));
};

/** Called once at the reaping, before the ledger's carry-over. No RNG. */
export function applyScenario(ctx: SimContext, cast: Tribute[]): void {
    const card = scenarioCard(ctx.state.config.scenario);
    if (!card) return;
    const who = scenarioCast({ tributes: cast, config: ctx.state.config });
    if (who.length === 0) return;
    const others = (t: Tribute) => cast.filter(o => o.id !== t.id);
    if (card.id === 'career-six') {
        who.forEach(t => {
            t.isCareer = true;
            t.volunteered = true;
        });
        who.forEach(a => who.forEach(b => { if (a.id < b.id) bond(a, b, 60); }));
    } else if (card.id === 'lone-volunteer') {
        cast.forEach(t => { t.volunteered = false; });
        who[0].volunteered = true;
        who[0].resolve = Math.min(100, (who[0].resolve ?? 50) + 15);
    } else if (card.id === 'rival-allies' && who.length === 2) {
        bond(who[0], who[1], 75);
        // AUDIT-14 S9: "sworn" means sworn. A mutual pact, which the gong
        // turns into a registered alliance with a charter like any floor pact.
        const [a, b] = who;
        if (!(a.trainingPact ?? []).includes(b.id)) a.trainingPact = [...(a.trainingPact ?? []), b.id];
        if (!(b.trainingPact ?? []).includes(a.id)) b.trainingPact = [...(b.trainingPact ?? []), a.id];
    } else if (card.id === 'twins' && who.length === 2) {
        bond(who[0], who[1], 90);
    } else if (card.id === 'career-defector') {
        const d = who[0];
        d.isCareer = false;
        d.volunteered = false;
        cast.filter(o => o.id !== d.id && (o.isCareer || CAREER_DISTRICTS.includes(o.district)))
            .forEach(o => sour(d, o, -30));
    } else if (card.id === 'mentors-favourite') {
        who[0].sponsorTrust = Math.min(100, who[0].sponsorTrust + 25);
    } else if (card.id === 'blind-draw') {
        cast.forEach(t => { t.volunteered = false; });
    } else if (card.id === 'old-grudge' && who.length === 2) {
        sour(who[0], who[1], -60);
    } else if (card.id === 'youngest-reaped') {
        who[0].resolve = Math.min(100, (who[0].resolve ?? 50) + 20);
    } else if (card.id === 'the-favourite') {
        who[0].sponsorTrust = Math.min(100, who[0].sponsorTrust + 20);
        others(who[0]).filter(o => !o.isCareer).forEach(o => sour(o, who[0], -20));
    } else if (card.id === 'district-feud' && who.length === 2) {
        sour(who[0], who[1], -50);
    } else if (card.id === 'the-outsiders') {
        who.forEach(c => cast.filter(o => !o.isCareer).forEach(o => sour(c, o, -25)));
    } else if (card.id === 'second-chance') {
        who[0].resolve = Math.min(100, (who[0].resolve ?? 50) + 10);
        who[0].sponsorTrust = Math.min(100, who[0].sponsorTrust + 10);
    } else if (card.id === 'packless') {
        who.forEach(a => who.forEach(b => { if (a.id < b.id) sour(a, b, 0); }));
    } else if (card.id === 'the-understudy') {
        who[0].resolve = Math.min(100, (who[0].resolve ?? 50) + 10);
        cast.filter(o => o.district === who[0].district && o.id !== who[0].id).forEach(o => bond(o, who[0], 70));
    }
    ctx.logEvent(`Scenario: ${card.name}. ${card.blurb} (${who.map(t => `${t.name}, D${t.district}`).join('; ')})`,
        who.map(t => t.id), { important: true, category: 'system' });
}
