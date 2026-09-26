import { CAUSE_FAMILY, deathCodeOf } from '../engine/causes';
import { INTERVIEW_PERSONAS } from './personas';
import { TRAIT_DEFS } from './traits';
import { ArchetypeId, GameState, Tribute } from '../models/types';
import { ARCHETYPES } from './archetypes';
import { AUDIT11_CAUSES } from './arenaEvents';
import { arenaFlavor } from './arenaFlavor';
import { legacyOf } from './districts';
import { PROCEDURAL_BIOME_COUNT } from '../engine/arenaGenerator';
import { ACHIEVEMENT_BARS } from './balance';
import { isStarCrossed } from '../engine/alliance';
import { happened, involvedIn, timesHappened } from '../engine/milestones';
import { G7_AIRLOCK, G7_BURIAL, G7_CACHE_MAP, G7_CACHE_MAP_CARTOGRAPHER, G7_KEEPERS_KEYS, G7_TABLEAUX, lineMatcher } from './arenaEvents/group7';
import { ITEMS } from './constants';
import { hasMutator } from './mutators';
import { firstDeathOf, scorePrediction } from '../engine/prediction';
import { oddsScore } from '../engine/odds';

/**
 * REPLAY-04: achievements as a discovery layer, not a points system.
 *
 * The problem they solve is specific. This simulation can produce a
 * cross-district romance, a twelve-year-old victor, a Career pack that eats
 * itself before day two, a tribute who wins without killing anybody, a
 * betrayal at the feast — and a player who has watched five runs has probably
 * seen two of those and has no way of knowing the other three are possible.
 *
 * So each entry is phrased as a thing the simulation can do. Locked ones are
 * shown by name deliberately: the list is a menu of outcomes to go looking for,
 * which is only useful if you can read it before you have earned it.
 *
 * Evaluated once, at the end of a run, against the final state — no hooks
 * threaded through the engine, nothing to keep in sync.
 */
/**
 * §11: what kind of run earns this.
 *
 * 111 entries used to arrive as one flat, undifferentiated list with no
 * category, tier or rarity on the interface at all — which is not browsable,
 * and left the game with no way to say "you have finished the social ones, go
 * looking at the arena ones". These two fields are the whole fix.
 */
export const ACHIEVEMENT_CATEGORIES = {
    reaping: 'Who walked in — district, volunteering, the bowl.',
    combat: 'How the fighting went, and who did or did not start it.',
    survival: 'Staying alive: wounds, hunger, cold, the mind.',
    social: 'Alliances, debts, truces, betrayal and everything owed.',
    arena: 'The map itself — its zones, its weather, its once-only events.',
    capitol: 'Sponsors, scores, the Gamemakers and the Quells.',
    games: 'The shape of the whole year, not one tribute in it.',
    oddity: 'Runs that were strange rather than good.',
} as const;

export type AchievementCategory = keyof typeof ACHIEVEMENT_CATEGORIES;

/**
 * Authored difficulty, checked against reality by `npm run test:achievements`:
 * that script measures every entry's real unlock rate over a few hundred runs
 * and reports any label the simulation contradicts. A rarity that is a guess
 * is worse than no rarity at all, so it is a guess with a test attached.
 */
/**
 * §19 (requests): four tiers, colour-coded in the record book.
 *
 * The top tier is the interesting one. 'legendary' used to mean both "very
 * hard" and "nobody has ever seen this", which are different claims and only
 * one of them is a fact. `possible` is the second claim on its own: the
 * simulation is believed to be able to do it and `npm run test:achievements`
 * has never measured it happening. It is a standing invitation rather than a
 * difficulty rating, and the moment the checker sees one fire, the label is
 * wrong and the build says so.
 *
 * Every label is regenerated from measured unlock rates by `npm run fix:rarity`
 * and asserted by `npm run test:achievements`, so none of them is a guess.
 */
export type AchievementRarity = 'common' | 'rare' | 'legendary' | 'possible';

export interface Achievement {
    id: string;
    name: string;
    /** What the player has to make happen. Readable while still locked. */
    hint: string;
    /** Which shelf it lives on. */
    category: AchievementCategory;
    /** Roughly how hard, for sorting and for the card. */
    rarity: AchievementRarity;
    /** True if this finished run earned it. */
    test: (state: GameState, victor: Tribute | undefined) => boolean;
    /**
     * How close this run came, when it did not earn it — "2 kills from
     * Bloodbath". Achievements were only ever surfaced on the end screen as a
     * binary, so a run that came within one of something told the player
     * nothing at all. Optional: some achievements are not a matter of degree.
     */
    nearMiss?: (state: GameState, victor: Tribute | undefined) => string | undefined;
    /**
     * §1.2 (audit): whether this run's arena can produce the achievement at
     * all. 'Every Door' needs an arena with at least two once-only events; an
     * achievement list that advertises it in an arena with none is a lie.
     * Absent means always available.
     */
    availableIn?: (state: GameState) => boolean;
}

/** An achievement this run came close to, for the end screen. */
export interface NearMiss {
    id: string;
    name: string;
    /** Already phrased: "one kill short", "survived to day 9 of 12". */
    detail: string;
}

const alive = (state: GameState) => state.tributes.filter(t => t.status === 'alive');
/** The last day a tribute was standing: the run's length for a survivor. */
const lastDay = (t: Tribute) => t.status === 'alive' ? Number.MAX_SAFE_INTEGER : (t.dayOfDeath ?? 0);

/*
 * AUDIT-7 §11.4: the board's opening line.
 *
 * `oddsHistory` is keyed by the day it was taken and the first snapshot is day
 * 1, so the two betting achievements that read `oddsHistory[0]` read undefined
 * and could never unlock. Read the lowest key that is actually there.
 */
const openingOdds = (state: GameState): Record<string, number> | undefined => {
    const days = Object.keys(state.oddsHistory ?? {}).map(Number).sort((a, b) => a - b);
    return days.length > 0 ? state.oddsHistory![days[0]] : undefined;
};

/**
 * Traits that can only be picked up in the arena. Derived from `TRAIT_DEFS`
 * rather than hand-mirrored: the copy this used to be omitted `Broken` and
 * `Hollow`, so a Pacifist who came home Broken did not count as changed by
 * it, and a victor who transformed a trait could still take a Clean Slate.
 */
const EARNED_TRAIT_NAMES = Object.keys(TRAIT_DEFS).filter(name => TRAIT_DEFS[name].earned);
const dead = (state: GameState) => state.tributes.filter(t => t.status === 'dead');

/**
 * The last four standing, in every Games rather than only in the rare ones
 * that end with somebody still alive beside the victor.
 *
 * Ranked by when they fell — survivors sort first, then the latest deaths —
 * which is the same construction two of the star-crossed predicates already
 * do inline. Hoisted so a predicate asking about the endgame asks the same
 * question they do.
 */
const finalFour = (state: GameState) => [...state.tributes]
    .sort((a, b) => (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity))
    .slice(0, 4);

/**
 * AUDIT-9 B01/B03: how many went down at the Cornucopia.
 *
 * The bloodbath is a *phase*, not a calendar day — `startGames()` sets
 * `day = 1` before it runs, so a horn death and a death at dusk on the first
 * evening are both stamped day 1 and only the flag tells them apart. Anything
 * asking about the horn asks this, so that two predicates about the same thing
 * cannot drift into meaning two different things again.
 */
const atTheHorn = (state: GameState) => state.tributes.filter(t => t.diedInBloodbath === true).length;

/**
 * Audit 3 §11: every way of breaking your word, not just the one the alliance
 * layer logs.
 *
 * `betrayalsCommitted` is incremented by exactly two sites — walking out of an
 * alliance, and breaking a standing truce — and a *victor* tops out at one of
 * those across 500 runs however busy the field is (5.69 betrayals a run).
 * `faithBroken` is the rest of it: summing the two is every way of breaking
 * your word, rather than the one the alliance layer happens to log.
 */
/**
 * AUDIT-9: did `killer` kill `t`, as a fact rather than as a string match.
 *
 * Several predicates asked this by looking for the killer's *name* inside the
 * victim's obituary. That is wrong twice over: a hazard line that happens to
 * mention somebody matched, and any rewording of "Killed by X" stopped
 * matching at all. `lastDamage.sourceId` is the recorded attribution, and the
 * soak already asserts it agrees with the obituary.
 */
function killedBy(victim: Tribute, killerId: string): boolean {
    return deathCodeOf(victim) === 'tribute' && victim.lastDamage?.sourceId === killerId;
}

function faithlessness(t: Tribute): number {
    return (t.betrayalsCommitted ?? 0) + (t.faithBroken ?? 0);
}

/* ---- AUDIT-11 §14 helpers ------------------------------------------------ */

/** Allied now, or at any earlier point in the run, in either direction. */
function alliedAtAnyPoint(a: Tribute, b: Tribute): boolean {
    return (a.allianceId !== undefined && a.allianceId === b.allianceId)
        || (a.formerAllies ?? []).includes(b.id)
        || (b.formerAllies ?? []).includes(a.id);
}

/** Standing laws this arena runs, the single `law` and the stacked list together. */
const lawCount = (state: GameState) => new Set([...(state.arena.law ? [state.arena.law] : []), ...(state.arena.laws ?? [])]).size;

/**
 * Whether a tribute has ever stood in a stance. There is no stance history;
 * leaving a situational stance stamps `stanceCooldown`, so its keys are the
 * situational stances a tribute has worked and left, plus the one they are in.
 */
function usedStance(t: Tribute, stance: Tribute['stance']): boolean {
    return t.stance === stance || t.stanceCooldown?.[stance] !== undefined;
}
function situationalStances(t: Tribute): number {
    return new Set([...Object.keys(t.stanceCooldown ?? {}), t.stance]).size;
}

const causeDeaths = (state: GameState, code: ReturnType<typeof deathCodeOf>) =>
    dead(state).filter(t => deathCodeOf(t) === code).length;
const muttDeaths = (state: GameState) => causeDeaths(state, 'mutt');

/** AUDIT-11 §11: the five lowest-winning archetypes as measured over 400 runs. */
const UNLIKELY_ARCHETYPES: ArchetypeId[] = ['martyr', 'understudy', 'broker', 'debtor', 'scavenger'];

/** How many times `by` spared `of`: every downed mercy, plus a let-them-flee. */
function timesSpared(by: Tribute, of: Tribute): number {
    return (by.sparedDowned ?? []).filter(id => id === of.id).length + ((of.sparedBy ?? []).includes(by.id) ? 1 : 0);
}

/** AUDIT-11 §14: the collector shelves' denominators, measured rather than typed. */
export const ARCHETYPE_COUNT = Object.keys(ARCHETYPES).length;
export const DEATH_CAUSE_CODE_COUNT = Object.keys(CAUSE_FAMILY).filter(c => c !== 'unknown').length;

// ---- AUDIT-12 §14 helpers ------------------------------------------------
const A12_CALLED_IT_SHARE = 0.8;
const A12_STORMCHASER_FRONTS = 3;
/** Counted by `engine/audit12Facts.ts` as each front's line is logged. */
const frontsSeen = (state: GameState) => state.audit12Facts?.fronts ?? 0;
const FOOD_NAMES = ITEMS.filter(i => i.type === 'food').map(i => i.name);
const matcherCache = new Map<string, RegExp>();
const matcherFor = (template: string) => {
    let m = matcherCache.get(template);
    if (!m) { m = lineMatcher(template); matcherCache.set(template, m); }
    return m;
};
/** Whether the chronicle has a line from one of `templates` about `t`. */
function saidOf(state: GameState, t: Tribute, templates: string[]): boolean {
    const ms = templates.filter(Boolean).map(matcherFor);
    return state.log.some(e => e.tributesInvolved[0] === t.id && ms.some(m => m.test(e.text)));
}
/** Whether `t` escaped an event of this arena whose death would have carried `code`. */
function dodgedCode(state: GameState, t: Tribute, code: ReturnType<typeof deathCodeOf>): boolean {
    const escapes = arenaFlavor(state.arena.id, state.arena).events
        .filter(e => e.code === code && e.escapeText).map(e => e.escapeText);
    return escapes.length > 0 && saidOf(state, t, [...new Set(escapes)]);
}
function slipShare(state: GameState): number {
    const r = scorePrediction(state, state.prediction);
    return r && r.max > 0 ? r.score / r.max : 0;
}
/** The longest run of complete days after day 4 with no death in them. */
function longestSilence(state: GameState): number {
    const deathDays = new Set(dead(state).map(t => t.dayOfDeath ?? -1));
    let best = 0;
    let run = 0;
    for (let d = 5; d < state.day; d++) {
        run = deathDays.has(d) ? 0 : run + 1;
        best = Math.max(best, run);
    }
    return best;
}
const distinctCauseCodes = (state: GameState) => new Set(dead(state).map(t => deathCodeOf(t))).size;
function tableauxSurvived(state: GameState, t: Tribute): number {
    return G7_TABLEAUX.filter(e => saidOf(state, t, [e.text, e.escapeText])).length;
}

export const ACHIEVEMENTS: Achievement[] = [
    /*
     * AUDIT-11 §14: twenty-four run achievements.
     *
     * Every predicate reads a field the state already keeps. Where the
     * audit's trigger names a system that does not exist yet (mutators, a
     * per-tribute stance history, mutt kills credited to a tribute) it is
     * redesigned onto the nearest thing the state records, and the hint says
     * what is actually measured.
     */
    {
        id: 'loners-handshake',
        name: 'Loner\'s Handshake',
        hint: 'See two tributes who never joined an alliance strike a truce after the convergence.',
        category: 'social',
        rarity: 'legendary',
        test: state => state.convergenceDay !== undefined && state.log.some(e => e.type === 'truce'
            && e.day >= state.convergenceDay!
            && e.tributesInvolved.length > 1
            && e.tributesInvolved.every(id => state.tributes.find(t => t.id === id)?.everAllied !== true)),
        nearMiss: state => (state.convergenceDay !== undefined && state.log.some(e => e.type === 'truce' && e.day >= state.convergenceDay!)
            ? 'A truce was struck after the convergence, but by somebody who had allied before'
            : undefined),
    },
    {
        id: 'promise-broken',
        name: 'Promise Broken',
        hint: 'See a sworn obligation between two tributes marked broken.',
        category: 'social',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'obligation-broken'),
        nearMiss: state => (state.log.some(e => e.type === 'obligation-made') && !state.log.some(e => e.type === 'obligation-broken')
            ? 'Promises were made in these Games, and every one of them was kept or let lapse'
            : undefined),
    },
    {
        id: 'wrong-patient',
        name: 'Wrong Patient',
        hint: 'See a tribute pull a stranger up off the ground while one of their own allies bleeds out.',
        category: 'oddity',
        rarity: 'legendary',
        test: state => state.tributes.some(patient => {
            const healer = patient.revivedBy ? state.tributes.find(o => o.id === patient.revivedBy) : undefined;
            if (!healer || alliedAtAnyPoint(healer, patient)) return false;
            return state.tributes.some(o => o.id !== healer.id && o.status === 'dead'
                && alliedAtAnyPoint(healer, o) && deathCodeOf(o) === 'bleeding');
        }),
    },
    {
        id: 'two-packs-one-horn',
        name: 'Two Packs, One Horn',
        hint: 'See one Career kill another at the Cornucopia.',
        category: 'combat',
        rarity: 'rare',
        test: state => state.tributes.some(t => t.isCareer && t.diedInBloodbath === true && deathCodeOf(t) === 'tribute'
            && state.tributes.some(k => k.isCareer && k.id !== t.id && killedBy(t, k.id))),
    },
    {
        id: 'the-tide-turned',
        name: 'The Tide Turned',
        hint: 'Crown a victor who took damage from the arena itself and outlasted every set piece the Gamemakers scheduled.',
        category: 'arena',
        rarity: 'common',
        test: (state, v) => {
            const plan = (state.arenaEventPlan ?? []).map(p => p.id);
            const fired = state.arenaEventsFired ?? [];
            return !!v && plan.length > 1 && plan.every(id => fired.includes(id))
                && (v.wounds ?? []).some(w => w.kind === 'arena' || w.kind === 'hazard');
        },
        nearMiss: (state, v) => {
            const plan = (state.arenaEventPlan ?? []).map(p => p.id);
            const left = plan.filter(id => !(state.arenaEventsFired ?? []).includes(id)).length;
            return v && left === 1 ? 'One scheduled set piece never fired before the crown' : undefined;
        },
        availableIn: state => (state.arenaEventPlan?.length ?? 2) > 1,
    },
    {
        id: 'stood-the-second-sun',
        name: 'Stood the Second Sun',
        hint: 'Win the Solar Desert after its Gamemakers\' set pieces have fired and the sun has had its turn at you.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'solar'
            && (state.arenaEventsFired ?? []).some(id => id.startsWith('solar-'))
            && (v.wounds ?? []).some(w => w.kind === 'climate' || w.kind === 'hazard' || w.kind === 'arena'),
        availableIn: state => state.arena.id === 'solar',
    },
    {
        id: 'nothing-in-the-walls',
        name: 'Nothing in the Walls',
        hint: 'Win the Green Labyrinth without anybody being crushed or buried in it.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'labyrinth' && !dead(state).some(t => deathCodeOf(t) === 'collapse'),
        availableIn: state => state.arena.id === 'labyrinth',
    },
    {
        id: 'deck-of-rules',
        name: 'Deck of Rules',
        hint: 'Crown a non-Career victor in an arena stacking two or more standing laws.',
        category: 'games',
        rarity: 'rare',
        test: (state, v) => !!v && !v.isCareer && lawCount(state) >= 2,
        nearMiss: (state, v) => (v && v.isCareer && lawCount(state) >= 2
            ? 'Two laws were stacked, and a Career won anyway'
            : undefined),
    },
    {
        id: 'all-twelve-stances',
        name: 'Most of the Twelve Stances',
        hint: 'Have one tribute work through five of the nine situational stances in a single Games.',
        category: 'oddity',
        rarity: 'rare',
        test: state => state.tributes.some(t => situationalStances(t) >= 5),
        nearMiss: state => (Math.max(0, ...state.tributes.map(situationalStances)) === 4
            ? 'Somebody worked through four situational stances — one short'
            : undefined),
    },
    {
        id: 'patient-zero',
        name: 'Patient Zero',
        hint: 'Crown a victor who survived a serious infection in a Games where somebody who treated the wounded died of one.',
        category: 'survival',
        rarity: 'legendary',
        test: (state, v) => !!v && (v.worstInfectionGrade ?? 0) >= 2
            && dead(state).some(t => (deathCodeOf(t) === 'infection' || deathCodeOf(t) === 'sepsis')
                && involvedIn(state, 'treatment-given').includes(t.id)),
        nearMiss: (_s, v) => (v && (v.worstInfectionGrade ?? 0) === 1 ? `${v.name} only ever had a mild infection` : undefined),
    },
    {
        id: 'the-last-ration',
        name: 'The Last Ration',
        hint: 'Crown a victor somebody owed for supplies, in a Games where somebody starved to death.',
        category: 'social',
        rarity: 'rare',
        test: (state, v) => !!v && state.tributes.some(o => o.id !== v.id && (o.debts?.[v.id] ?? 0) > 0)
            && dead(state).some(t => deathCodeOf(t) === 'starvation'),
    },
    {
        id: 'bait-and-switch',
        name: 'Bait and Switch',
        hint: 'See a tribute who has worked the Baiting stance kill somebody with a trap.',
        category: 'combat',
        rarity: 'rare',
        test: state => state.tributes.some(k => (k.trapKills ?? 0) >= 1 && usedStance(k, 'Baiting')),
        nearMiss: state => (state.tributes.some(k => (k.trapKills ?? 0) >= 1)
            ? 'A trap killed somebody, but its setter had never been Baiting'
            : undefined),
    },
    {
        id: 'walked-the-perimeter',
        name: 'Walked the Perimeter',
        hint: 'Crown a victor who stood patrol at some point and set foot in every zone of the arena.',
        category: 'arena',
        rarity: 'possible',
        test: (state, v) => !!v && usedStance(v, 'Patrolling')
            && state.arena.zones.every(z => (v.visitedZones ?? []).includes(z.name)),
        nearMiss: (state, v) => {
            if (!v || !usedStance(v, 'Patrolling')) return undefined;
            const missed = state.arena.zones.filter(z => !(v.visitedZones ?? []).includes(z.name)).length;
            return missed === 1 ? `${v.name} patrolled, and missed one zone` : undefined;
        },
    },
    {
        id: 'carried-the-wounded',
        name: 'Carried the Wounded',
        hint: 'Crown a victor who nursed a downed tribute back up and kept them alive into the final four.',
        category: 'survival',
        rarity: 'legendary',
        test: (state, v) => !!v && (usedStance(v, 'Nursing') || usedStance(v, 'Tending'))
            && finalFour(state).some(o => o.id !== v.id && o.revivedBy === v.id),
    },
    {
        id: 'beastmaster',
        name: 'Beastmaster',
        hint: 'See the mutts claim three or more tributes in a single Games.',
        category: 'combat',
        rarity: 'rare',
        test: state => muttDeaths(state) >= 3,
        nearMiss: state => (muttDeaths(state) === 2 ? 'The mutts took two — one short of a Beastmaster Games' : undefined),
    },
    {
        id: 'no-beast-touched-them',
        name: 'No Beast Touched Them',
        hint: 'Crown a victor never wounded by a mutt in a Games where the mutts killed five or more.',
        category: 'survival',
        rarity: 'legendary',
        test: (state, v) => !!v && muttDeaths(state) >= 5 && !(v.wounds ?? []).some(w => w.kind === 'mutt'),
        nearMiss: (state, v) => (v && muttDeaths(state) >= 3 && muttDeaths(state) < 5
            ? `The mutts took ${muttDeaths(state)} — five is the bar`
            : undefined),
    },
    {
        id: 'starved-out',
        name: 'Starved Out',
        hint: 'See three or more tributes starve to death in a single Games.',
        category: 'games',
        rarity: 'possible',
        test: state => causeDeaths(state, 'starvation') >= 3,
        nearMiss: state => (causeDeaths(state, 'starvation') === 2 ? 'Two starved — one short' : undefined),
    },
    {
        id: 'from-the-eleventh',
        name: 'From the Eleventh',
        hint: 'Crown a victor from District 11.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && v.district === 11,
    },
    {
        id: 'unrecorded-cause',
        name: 'Unrecorded Cause',
        hint: 'See a tribute die in one of the ways the Capitol added to the Games this year.',
        category: 'oddity',
        rarity: 'rare',
        test: state => dead(state).some(t => t.causeOfDeath !== undefined && AUDIT11_CAUSES.includes(t.causeOfDeath)),
        nearMiss: state => (state.tributes.some(t => t.status === 'alive' && t.lastDamage !== undefined
            && AUDIT11_CAUSES.includes(t.lastDamage.cause))
            ? 'One of this year\'s new ways to die caught somebody, and they walked away from it'
            : undefined),
    },
    {
        id: 'the-unlikely',
        name: 'The Unlikely',
        hint: 'Crown a Martyr, Understudy, Broker, Debtor or Scavenger — the five archetypes that win least.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && UNLIKELY_ARCHETYPES.includes(v.archetype),
    },
    {
        id: 'twice-forgiven',
        name: 'Twice Forgiven',
        hint: 'See one tribute spare the same person twice.',
        category: 'social',
        rarity: 'rare',
        test: state => state.tributes.some(by => state.tributes.some(of => of.id !== by.id && timesSpared(by, of) >= 2)),
        nearMiss: state => (state.tributes.some(t => (t.sparedBy?.length ?? 0) > 0 || (t.sparedDowned?.length ?? 0) > 0)
            ? 'Somebody was spared, once'
            : undefined),
    },
    {
        id: 'mercy-returned',
        name: 'Mercy Returned',
        hint: 'See a tribute spare the person who once spared them.',
        category: 'social',
        rarity: 'legendary',
        test: state => state.tributes.some(a => state.tributes.some(b => a.id < b.id
            && timesSpared(a, b) > 0 && timesSpared(b, a) > 0)),
        nearMiss: state => (state.tributes.some(a => state.tributes.some(b => a.id !== b.id
            && timesSpared(a, b) > 0 && a.status === 'alive' && b.status === 'alive'))
            ? 'Somebody was spared, and lived long enough that they could have returned it'
            : undefined),
    },
    {
        id: 'seen-nothing',
        name: 'Seen Nothing',
        hint: 'Crown a victor who never shared a zone with another tribute after the bloodbath.',
        category: 'oddity',
        rarity: 'possible',
        test: (_s, v) => !!v && v.metAnybodyAfterBloodbath !== true && !v.diedInBloodbath,
        nearMiss: (_s, v) => (v && v.allianceId === undefined && (v.unseenStreak ?? 0) > 0
            ? `${v.name} went unseen for a stretch, but not for the whole Games`
            : undefined),
    },
    {
        id: 'out-of-order',
        name: 'Out of Order',
        hint: 'Crown the tribute who took the lowest training score of the whole field, alone.',
        category: 'games',
        rarity: 'legendary',
        test: (state, v) => {
            if (!v) return false;
            const low = Math.min(...state.tributes.map(t => t.trainingScore));
            return v.trainingScore === low && state.tributes.filter(t => t.trainingScore === low).length === 1;
        },
    },
    // §11 (audit): the systems the achievement layer had the same blind spot
    // about as the interface did. Rumours, sponsor blocs, charters and the
    // ex-ally layer were all fully simulated and
    // entirely unrewarded; four write-only fields (`finishedDowned`,
    // `feastPrizeTaken`, `diedWithinReach`, `intelTrades`, `blocTreatiesSworn`)
    // were recorded every run and read by nothing at all. Each entry below
    // reads a field the state already keeps.
    {
        id: 'the-liar',
        name: 'The Liar',
        hint: 'Crown a victor who planted a rumour somebody believed and nobody ever checked.',
        category: 'social',
        rarity: 'rare',
        // Audit 3 §1.6: this read the live rumour pool at the end of the run.
        // Claims expire after six cycles and are pruned, so it was asking for a
        // lie that had outlived being retired — never once in 200 runs.
        // `liarsAtLarge` records it at the moment it was true.
        test: (state, v) => !!v && (state.liarsAtLarge ?? []).includes(v.id),
        nearMiss: (state, v) => !v || (state.liarsAtLarge ?? []).length === 0 || (state.liarsAtLarge ?? []).includes(v.id)
            ? undefined
            : 'Somebody got away with a lie in these Games. It was not your victor.',
    },
    {
        id: 'whisper-campaign',
        name: 'Whisper Campaign',
        hint: 'Have three or more planted rumours in circulation at once in a single Games.',
        category: 'social',
        rarity: 'rare',
        // Audit 3 §1.6: the live pool, read at the end. Three at once is a
        // thing that happens mid-run and is gone by the epilogue.
        test: state => (state.maxPlantedInCirculation ?? 0) >= 3,
        nearMiss: state => ((state.maxPlantedInCirculation ?? 0) === 2
            ? 'Two planted rumours were in circulation at once — one short of a campaign'
            : undefined),
    },
    {
        id: 'caught-out',
        name: 'Caught Out',
        hint: 'See a planted rumour exposed as false by somebody who went and looked.',
        category: 'social',
        rarity: 'common',
        // Audit 3 §1.6: an exposed claim is retired from the pool, so reading
        // the pool at the end was reading for the one thing that is removed.
        test: state => state.plantedRumourExposed === true,
        nearMiss: state => ((state.maxPlantedInCirculation ?? 0) > 0 && !state.plantedRumourExposed
            ? 'Somebody planted a lie and nobody ever went to look'
            : undefined),
    },
    {
        id: 'the-purse-runs-dry',
        name: 'The Purse Runs Dry',
        hint: 'Empty a sponsor bloc\'s budget completely in a single Games.',
        category: 'capitol',
        rarity: 'common',
        test: state => Object.values(state.sponsorBlocBudgets ?? {}).some(b => b <= 0),
    },
    {
        id: 'nobody-is-buying',
        name: 'Nobody Is Buying',
        hint: 'Reach the end of a Games with every sponsor bloc down to a quarter of its opening purse.',
        category: 'capitol',
        rarity: 'rare',
        // Audit 3 §1.6: this derived "opening" from the largest *remaining*
        // purse and then asked every purse — including that largest one — to be
        // a quarter of it. Arithmetically impossible unless every bloc sat at
        // exactly zero. The opening purses are now captured on the first cycle
        // that sees them.
        test: state => state.everySponsorBlocExhausted === true,
        nearMiss: state => {
            const opening = state.openingBlocBudgets;
            const purses = state.sponsorBlocBudgets;
            if (!opening || !purses || state.everySponsorBlocExhausted) return undefined;
            const held = Object.entries(purses)
                .filter(([bloc, left]) => left > (opening[bloc] ?? left) * 0.25).length;
            return held > 0 ? `${held} sponsor bloc${held === 1 ? ' still had' : 's still had'} money to spend` : undefined;
        },
    },
    {
        id: 'the-terms-were-the-terms',
        name: 'The Terms Were the Terms',
        hint: 'See an alliance charter carried to the final eight without a single clause broken.',
        category: 'social',
        rarity: 'common',
        test: state => state.charterKeptSeen === true,
    },
    {
        id: 'lawyers-of-the-arena',
        name: 'Lawyers of the Arena',
        hint: 'See an alliance form with three or more clauses in its charter.',
        category: 'social',
        rarity: 'common',
        // Audit 3 §1.6: read at the end of the run, when the alliances that
        // swore anything are all dissolved and their members dead.
        test: state => (state.deepestCharter ?? 0) >= 3,
        nearMiss: state => ((state.deepestCharter ?? 0) === 2
            ? 'The deepest charter of these Games ran to two clauses — one short'
            : undefined),
    },
    {
        id: 'the-cold-war',
        name: 'The Cold War',
        hint: 'Crown a victor who parted from three or more former allies and outlived all of them.',
        category: 'social',
        rarity: 'rare',
        test: (state, v) => !!v && (v.formerAllies?.length ?? 0) >= 3
            && (v.formerAllies ?? []).every(id => state.tributes.find(o => o.id === id)?.status === 'dead'),
        nearMiss: (_s, v) => { const n = v?.formerAllies?.length ?? 0; return n === 2 ? `${v!.name} parted from two former allies — one short` : undefined; },
    },
    {
        id: 'no-hard-feelings',
        name: 'No Hard Feelings',
        hint: 'Crown a victor who parted ways with an ally and never laid a hand on them afterwards.',
        category: 'social',
        rarity: 'common',
        // Audit 3 §1.6: this asked for a former ally *still alive at the end*,
        // and the end of a Games is defined by everybody else being dead. The
        // only state that could satisfy it was a dual victory with the other
        // victor being a former ally — which is why it never fired. What the
        // name is about is a parting that did not become a killing.
        test: (state, v) => !!v
            && (v.formerAllies ?? []).length > 0
            && (v.formerAllies ?? []).every(id => {
                const other = state.tributes.find(o => o.id === id);
                // AUDIT-9: "did the victor kill them" is a fact the death
                // record already holds. Matching the victor's *name* inside
                // the obituary also matched a hazard line that happened to
                // mention them, and broke whenever the wording moved.
                return !other || !killedBy(other, v.id);
            }),
        nearMiss: (state, v) => {
            if (!v || (v.formerAllies ?? []).length === 0) return undefined;
            const killed = (v.formerAllies ?? []).filter(id => {
                const other = state.tributes.find(o => o.id === id);
                return other !== undefined && killedBy(other, v.id);
            }).length;
            return killed > 0
                ? `${v.name} left ${(v.formerAllies ?? []).length} alliance${(v.formerAllies ?? []).length === 1 ? '' : 's'} and came back for ${killed} of them`
                : undefined;
        },
    },
    {
        id: 'the-mercy-and-the-knife',
        name: 'The Mercy and the Knife',
        hint: 'Crown a victor who both finished somebody bleeding out and spared somebody else.',
        category: 'combat',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.finishedDowned?.length ?? 0) > 0 && (v.sparedDowned?.length ?? 0) > 0,
    },
    {
        id: 'the-executioner',
        name: 'The Executioner',
        hint: 'Crown a victor who finished two or more tributes who were already down.',
        category: 'combat',
        rarity: 'legendary',
        // Audit 2 §11.2: three, against a victor ceiling of two.
        test: (_s, v) => !!v && (v.finishedDowned?.length ?? 0) >= 2,
        nearMiss: (_s, v) => {
            const n = v?.finishedDowned?.length ?? 0;
            return n === 1 ? `${v!.name} finished one tribute who was already down — one short` : undefined;
        },
    },
    {
        id: 'within-reach',
        name: 'Within Reach',
        // Audit 2 §11.2: three was above the ceiling — 200 runs never produced
        // more than two.
        // Audit 4 §3.2: and two is above it now. The sanity work cut the share
        // of tribute-time spent at the floor from 33% to 13%, and a tribute who
        // is not catatonic goes and helps — which is the system working and the
        // threshold following it down rather than the entry being wrong.
        hint: 'See a tribute die with somebody close enough to have helped.',
        category: 'oddity',
        rarity: 'rare',
        test: state => (state.diedWithinReach ?? 0) >= 1,
    },
    {
        id: 'nobody-came',
        name: 'Nobody Came',
        // Audit 2 §1.10: 61% of runs, because sixteen dead is most fields and
        // dying within reach of somebody is rare to begin with. A full field is
        // what makes "not one of them" mean anything.
        hint: 'Finish a full Games in which not one tribute died within reach of another.',
        category: 'oddity',
        rarity: 'common',
        test: state => (state.diedWithinReach ?? 0) === 0 && dead(state).length >= 20,
        nearMiss: state => { const n = state.diedWithinReach ?? 0; return n === 1 && dead(state).length >= 20 ? 'Exactly one tribute died within reach of somebody who could have helped' : undefined; },
    },
    {
        id: 'took-the-marked-pack',
        name: 'Took the Marked Pack',
        hint: 'Crown a victor who claimed the feast pack with their own name on it.',
        category: 'capitol',
        rarity: 'common',
        test: (_s, v) => !!v && v.feastPrizeTaken === v.id,
    },
    {
        id: 'took-somebody-elses',
        name: 'Took Somebody Else\'s',
        hint: 'Crown a victor who claimed a feast pack marked for another tribute.',
        category: 'capitol',
        rarity: 'common',
        test: (_s, v) => !!v && v.feastPrizeTaken !== undefined && v.feastPrizeTaken !== v.id,
    },
    {
        id: 'the-information-trade',
        name: 'The Information Trade',
        hint: 'See five or more pieces of intelligence change hands in a single Games.',
        category: 'social',
        rarity: 'common',
        test: state => (state.intelTrades ?? 0) >= 5,
        nearMiss: state => {
            const n = state.intelTrades ?? 0;
            return n >= 3 && n < 5 ? `${n} pieces of intelligence changed hands — ${5 - n} short` : undefined;
        },
    },
    {
        id: 'diplomacy-by-proxy',
        name: 'Diplomacy by Proxy',
        hint: 'See a treaty sworn between two alliances on behalf of their members.',
        category: 'social',
        rarity: 'common',
        test: state => (state.blocTreatiesSworn ?? 0) > 0,
    },
    {
        id: 'the-scavenger',
        name: 'The Scavenger',
        hint: 'Crown a victor who went through four or more of the fallen.',
        category: 'survival',
        rarity: 'rare',
        /*
         * AUDIT-9 stage C: five was above the ceiling once actions started
         * costing the day. Looting a body takes time somebody now has to
         * find, and the most any victor managed across 500 runs was four —
         * so the card was a promise the game had stopped keeping. Lowered to
         * what the engine can actually produce rather than left unearnable.
         */
        test: (_s, v) => !!v && (v.corpsesLooted ?? 0) >= 4,
        nearMiss: (_s, v) => {
            const n = v?.corpsesLooted ?? 0;
            return n >= 2 && n < 4 ? `${v!.name} went through ${n} of the fallen — ${4 - n} short` : undefined;
        },
    },
    {
        id: 'never-touched-a-body',
        name: 'Never Touched a Body',
        hint: 'Crown a victor who never once stripped one of the fallen.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.corpsesLooted ?? 0) === 0,
    },
    {
        id: 'the-trapline',
        name: 'The Trapline',
        // Audit 2 §11.2: this asked for three trap kills against a ceiling of
        // two, so it could not fire — and lowering it to two would have made it
        // `deadfall` with a different name (an entry since retired: a counter
        // whose ceiling is one or two cannot carry three rungs). A trapline is
        // not a kill count
        // anyway: it is the work. `trapsSet` counts that, and the two entries
        // now measure different things.
        // Audit 3 §11: and the rung moved again, to the measured ceiling.
        // `TRAPS.maxPerTribute` is 3, so four traps standing at once is
        // impossible and four *set* over a run needs a victor who spent four
        // separate turns on fieldcraft — which 200 runs do not produce. Three
        // is the whole allowance at once, which is what a trapline is.
        hint: 'Crown a victor who built a working trapline — three traps across the Games.',
        category: 'combat',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.trapsSet ?? 0) >= 3,
        nearMiss: (_s, v) => {
            const n = v?.trapsSet ?? 0;
            return n >= 1 && n < 3 ? `${v!.name} set ${n} trap${n === 1 ? '' : 's'} — ${3 - n} short of a trapline` : undefined;
        },
    },
    {
        id: 'the-long-walk',
        name: 'The Long Walk',
        hint: 'Crown a victor who crossed open water five or more times.',
        category: 'arena',
        rarity: 'legendary',
        // Audit 2 §11.2: five, against a victor ceiling of four.
        test: (_s, v) => !!v && (v.waterCrossings ?? 0) >= 4,
        nearMiss: (_s, v) => { const n = v?.waterCrossings ?? 0; return n >= 2 && n < 4 ? `${v!.name} crossed open water ${n} times — ${4 - n} short` : undefined; },
    },
    {
        id: 'unfilmed',
        name: 'Unfilmed',
        hint: 'Crown a victor who went eight or more cycles without being seen by anybody.',
        category: 'oddity',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.unseenStreak ?? 0) >= 8,
        nearMiss: (_s, v) => {
            const n = v?.unseenStreak ?? 0;
            return n >= 5 && n < 8 ? `${v!.name} went ${n} cycles unseen — ${8 - n} short` : undefined;
        },
    },
    {
        id: 'sold-out-everybody',
        name: 'Sold Out Everybody',
        // Audit 2 §11.2: three betrayals is above the ceiling (two), and two
        // alone is `turncoat-twice` one rung down. What separates this from
        // that rung is not a third betrayal, it is that it never came back on
        // them: they broke faith twice and nobody ever got to do it to them.
        hint: 'Crown a victor who broke faith three times and was never once betrayed themselves.',
        category: 'social',
        rarity: 'legendary',
        // Audit 3 §11: and the axis moved, because the rung could not.
        // `betrayalsCommitted` counts one specific act — walking out of an
        // alliance on somebody — and a victor tops out at one of those across
        // 500 runs, whatever the field does (5.69 betrayals a run). It counts
        // `betrayalsCommitted + faithBroken` instead, which is every way of
        // breaking your word rather than the one the alliance layer happens to log.
        /*
         * AUDIT-9: the clause that separated this from `turncoat-twice` stopped
         * separating anything.
         *
         * Both cards sat on `faithlessness >= 2`; this one added "and was never
         * betrayed themselves", and across the whole 500-run sample every
         * faithless victor satisfied it, so the two unlocked on exactly the
         * same runs — the duplication this table is policed for. A victor is by
         * definition somebody whose betrayers mostly did not survive to be
         * counted, so the extra clause was never going to discriminate.
         *
         * The rung moves instead of the axis: three broken words rather than
         * two, still without ever having had one broken on them. That is what
         * the name claims and what the hint now says.
         */
        test: (_s, v) => !!v && faithlessness(v) >= 3 && (v.memory?.timesBetrayed ?? 0) === 0,
        nearMiss: (_s, v) => (v && faithlessness(v) === 2 && (v.memory?.timesBetrayed ?? 0) === 0)
            ? `${v.name} broke their word twice — everybody is three`
            : undefined,
    },
    {
        id: 'the-provider',
        name: 'The Provider',
        // Audit 2 §11.2: fifteen against a ceiling of five. A run is under nine
        // days and a tribute does not forage every cycle of it, so fifteen was
        // three times more foraging than the calendar allows.
        hint: 'Crown a victor who successfully foraged five or more times.',
        category: 'survival',
        rarity: 'possible',
        test: (_s, v) => !!v && (v.forageSuccesses ?? 0) >= 5,
        nearMiss: (_s, v) => { const n = v?.forageSuccesses ?? 0; return n >= 3 && n < 5 ? `${v!.name} foraged successfully ${n} times — ${5 - n} short` : undefined; },
    },
    {
        id: 'the-whole-bestiary',
        name: 'The Whole Bestiary',
        hint: 'See every mutt on an arena\'s roster attack somebody in one Games.',
        category: 'arena',
        rarity: 'common',
        test: state => {
            const seen = new Set(state.muttsSeen ?? []);
            const roster = state.arena.mutts ?? [];
            return roster.length >= 3 && roster.every(m => seen.has(m));
        },
        nearMiss: state => { const seen = new Set(state.muttsSeen ?? []); const roster = state.arena.mutts ?? []; const missing = roster.filter(m => !seen.has(m)); return roster.length >= 3 && missing.length === 1 ? `Every mutt in ${state.arena.name} but one attacked somebody — ${missing[0]} never appeared` : undefined; },
    },
    // §11: the additions — every one of them reads a field the state already
    // keeps, or one the same change started keeping.
    {
        id: 'performed-to-the-end',
        name: 'Performed to the End',
        // Audit 2 §11.2: this asked for a *live* streak of five on the victor,
        // and no victor in 200 runs ever ended on a streak above zero — which
        // is structural rather than unlucky. `performingStreak` is reset by
        // dayNight.ts on any cycle where `displayedRegard` is empty, and by the
        // time somebody is the last one standing there is nobody left to
        // perform a bond *to*. The final cycle always zeroes it.
        //
        // So the entry asks what its name asks: that the act was still running
        // when the field collapsed. The last cycle a performance was possible
        // is the one where somebody else was still alive, so this reads the
        // best streak and requires that it was still live going into the end.
        hint: 'Crown a victor who was still keeping up a performed bond when the field came down to the last two.',
        category: 'social',
        // AUDIT-7: observed at 0.4% of 500 runs, so no longer 'possible?'.
        rarity: 'legendary',
        /*
         * AUDIT-6 §11.2: the victor scope is the whole point of this one — it
         * is about the act still running at the end — so it keeps it. What it
         * drops is the second threshold: requiring a streak of two *as well as*
         * the act still being live stacked two rare things on the same entry,
         * and the streak was the one doing no work, because an act that is
         * still up at the final two has by definition been up for a while.
         */
        test: (_s, v) => !!v && !!v.displayedRegard && Object.keys(v.displayedRegard).length > 0,
        nearMiss: (_s, v) => (v && (v.maxPerformingStreak ?? 0) >= 1 && !v.displayedRegard)
            ? `${v.name} kept an act up for ${v.maxPerformingStreak} cycles and had dropped it by the end`
            : undefined,
    },
    {
        id: 'quartermaster',
        name: 'Quartermaster',
        hint: 'Crown a victor who held a named alliance role for ten cycles or more.',
        category: 'social',
        rarity: 'common',
        test: (_s, v) => !!v && (v.roleCycles ?? 0) >= 10,
        nearMiss: (_s, v) => (v && (v.roleCycles ?? 0) >= 6 && (v.roleCycles ?? 0) < 10)
            ? `${v.name} held a role for ${v.roleCycles} cycles — ${10 - (v.roleCycles ?? 0)} short`
            : undefined,
    },
    {
        id: 'turncoat-twice',
        name: 'Turncoat Twice',
        hint: 'Crown a victor who broke faith with somebody who trusted them at least twice.',
        category: 'social',
        rarity: 'rare',
        // Audit 3 §11: see 'Sold Out Everybody' — same axis, same reason.
        test: (_s, v) => !!v && faithlessness(v) >= 2,
        nearMiss: (_s, v) => (v && faithlessness(v) === 1)
            ? `${v.name} broke their word once — a turncoat twice does it again`
            : undefined,
    },
    {
        id: 'never-ate',
        name: 'Never Ate',
        hint: 'Crown a victor who never once foraged anything up.',
        category: 'survival',
        rarity: 'common',
        // AUDIT-7: calibration. Plenty of short runs never forage at all, so
        // this has to be a victor who lasted long enough for it to be a choice.
        test: (_s, v) => !!v && (v.forageSuccesses ?? 0) === 0 && v.daysSurvived >= 8,
        nearMiss: (_s, v) => (v && (v.forageSuccesses ?? 0) === 1 && v.daysSurvived >= 8
            ? 'the victor found food exactly once' : undefined),
    },
    {
        id: 'fever-dream',
        name: 'Fever Dream',
        hint: 'See a tribute cut back from a septic wound that was going to kill them.',
        category: 'survival',
        rarity: 'rare',
        // Audit 3 §1.6/§10.1: this wanted `terminalInfectionBeaten` on the
        // *victor*. Measured over 200 runs at the rates that then applied: 19
        // of 4,808 tributes ever reached the top grade, 3 were ever treated
        // back from it, and none of those three was the last one standing.
        // Widening the arc (INFECTION.baseChance, septicDamage) moved that to
        // 26 and 3 — reachable, but a victor-scoped entry on a 1.5%-per-run
        // event is a rung nobody can plan for.
        //
        // Re-scoped to the beat rather than to who was left holding it: the arc
        // is worth watching whoever it happens to, and the run that produces it
        // is the strange one the oddity and survival shelves exist to name.
        test: state => state.tributes.some(t => t.terminalInfectionBeaten === true),
        nearMiss: state => {
            if (state.tributes.some(t => t.terminalInfectionBeaten)) return undefined;
            const septic = state.tributes.filter(t => (t.septicCycles ?? 0) > 0).length;
            return septic > 0
                ? `${septic} tribute${septic === 1 ? ' went' : 's went'} septic this year and nobody could cut it back`
                : undefined;
        },
    },
    {
        id: 'both-levels',
        name: 'Both Levels',
        hint: 'Crown a victor who changed level inside three different vertical zones.',
        category: 'arena',
        rarity: 'rare',
        // §5.2 (audit): once every arena authored its verticality, "stood on
        // both levels once" fired in 62% of runs. Three separate places is a
        // habit rather than an accident.
        test: (_s, v) => !!v && (v.levelsStood?.includes('upper') ?? false) && (v.levelsStood?.includes('lower') ?? false)
            && (v.verticalZonesStood?.length ?? 0) >= 3,
        nearMiss: (_s, v) => (v && (v.verticalZonesStood?.length ?? 0) === 2)
            ? `${v.name} climbed or dropped a level in two places — Both Levels wants three`
            : undefined,
    },
    {
        id: 'load-bearing',
        name: 'Load-Bearing',
        hint: 'Crown a victor who walked out of a structural collapse.',
        category: 'arena',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.collapsesSurvived ?? 0) >= 1,
        nearMiss: state => state.tributes.some(t => (t.collapsesSurvived ?? 0) >= 1)
            ? 'somebody walked out of a collapse this year — it just was not the victor'
            : undefined,
    },
    {
        id: 'debtors-crown',
        name: "The Debtor's Crown",
        hint: 'Crown a victor who still owes somebody.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.debts ?? {}).some(d => d > 0),
    },
    {
        id: 'seen-everything',
        name: 'Seen Everything',
        // Audit 2 §3.1: every zone of the arena is not something a victor can
        // do, and the reason is the calendar rather than the pathfinding.
        // Measured over 200 runs, a victor stands in 40% of the arena at the
        // median, 57% at p90 and 89% at the very best — and that best is on a
        // small map. A run is under nine days; an arena is ten to thirteen
        // zones; the two numbers do not meet, and no destination-scoring change
        // moves it (a backtrack penalty and an unseen-ground pull were tried at
        // twenty times their sensible value and shifted victor coverage by two
        // percentage points, because purposeful movement routes through
        // `objectiveStep` and never consults the drift scorer at all).
        //
        // Three-quarters of the map is above p90 and below the ceiling: a
        // tribute who really did cross almost all of it.
        hint: 'Crown a victor who stood in three-quarters of the arena or more.',
        category: 'arena',
        rarity: 'legendary',
        test: (s, v) => !!v && (v.visitedZones?.length ?? 0) >= Math.ceil(s.arena.zones.length * 0.75),
        nearMiss: (s, v) => {
            const n = v?.visitedZones?.length ?? 0;
            const need = Math.ceil(s.arena.zones.length * 0.75);
            return v && need - n > 0 && need - n <= 2
                ? `${v.name} saw ${n} of ${s.arena.zones.length} zones — ${need - n} short of three-quarters of it`
                : undefined;
        },
    },
    {
        id: 'arms-dealer',
        name: 'Arms Dealer',
        // Audit 5 §1.6: measured at 4 victors in 400 runs — reachable, so a
        // legendary and not a 'possible?'.
        hint: 'Crown a victor who sold what they knew to somebody else.',
        category: 'social',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.intelSold ?? 0) >= 1,
        nearMiss: (_s, v) => (v && (v.intelSold ?? 0) === 0 && (v.sharedIntelWith?.length ?? 0) > 0)
            ? `${v.name} gave away what they knew all Games and never once charged for it`
            : undefined,
    },
    {
        id: 'the-watcher',
        name: 'The Watcher',
        hint: 'Crown a victor with two or more kills who never once opened a fight.',
        category: 'combat',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.fightsOpened ?? 0) === 0 && v.kills >= 2,
        nearMiss: (_s, v) => {
            if (!v) return undefined;
            const opened = v.fightsOpened ?? 0;
            if (opened === 0 && v.kills === 1) return `${v.name} never opened a fight and came home with one kill — the Watcher needs two`;
            if (opened === 1 && v.kills >= 2) return `${v.name} took ${v.kills}, but opened one fight — the Watcher opens none`;
            return undefined;
        },
    },
    {
        id: 'front-loaded',
        name: 'Front-Loaded',
        hint: 'Crown a Career who never left the Cornucopia.',
        category: 'combat',
        // AUDIT-7: observed across 500 runs, so no longer 'possible?' — the label
        // means the simulation is believed able to do this and no measured run
        // ever has, and a measured run now has.
        rarity: 'possible',
        // Audit 3 §1.6: `arena.zones[0]` is the Cornucopia in the hand-authored
        // arenas and is not guaranteed to be in a generated one, so on every
        // procedural map this asked for a sector that was not the horn. Matched
        // by name, the way the engine's own restock and feast code does.
        test: (s, v) => !!v && v.isCareer
            && (v.visitedZones?.length ?? 0) === 1
            && /cornucopia/i.test(v.visitedZones?.[0] ?? ''),
        nearMiss: (s, v) => {
            if (!v || !v.isCareer) return undefined;
            const visited = v.visitedZones?.length ?? 0;
            if (visited === 2 && v.visitedZones?.[0] === s.arena.zones[0]?.name) {
                return `${v.name} left the Cornucopia exactly once — Front-Loaded never leaves it`;
            }
            return undefined;
        },
    },
    {
        id: 'weather-beaten',
        name: 'Weather Beaten',
        hint: 'Crown a victor who survived four or more storms.',
        category: 'arena',
        rarity: 'common',
        test: (_s, v) => !!v && (v.stormsSurvived ?? 0) >= 4,
        nearMiss: (_s, v) => (v && (v.stormsSurvived ?? 0) >= 2 && (v.stormsSurvived ?? 0) < 4)
            ? `${v.name} rode out ${v.stormsSurvived} storms — ${4 - (v.stormsSurvived ?? 0)} short of weather-beaten`
            : undefined,
    },
    {
        id: 'heir-apparent',
        name: 'Heir Apparent',
        hint: 'Crown a victor who took over their alliance as its named heir.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && v.succeededAsHeir === true,
    },
    {
        id: 'cold-hands',
        name: 'Cold Hands',
        hint: 'Crown a victor still carrying frostbite.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && v.injuries.frostbitten === true,
    },
    {
        id: 'bloodless-crown',
        name: 'Bloodless Crown',
        hint: 'Crown a victor who never killed anybody.',
        category: 'combat',
        rarity: 'rare',
        test: (_s, v) => !!v && v.kills === 0,
        nearMiss: (_s, v) => (v && v.kills > 0 && v.kills <= 2)
            ? `${v.name} won with ${v.kills} kill${v.kills === 1 ? '' : 's'} — ${v.kills} short of a bloodless crown`
            : undefined,
    },
    {
        id: 'youngest-victor',
        name: 'Fourteen at Most',
        hint: 'Crown a victor aged fourteen or under.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && v.age <= 14,
        nearMiss: (_s, v) => (v && v.age > 14 && v.age <= 16)
            ? `${v.name} was ${v.age} — ${v.age - 14} year${v.age - 14 === 1 ? '' : 's'} over`
            : undefined,
    },
    {
        id: 'career-crown',
        name: 'As Designed',
        hint: 'Crown a Career from District 1, 2 or 4.',
        category: 'reaping',
        rarity: 'common',
        test: (_s, v) => !!v && v.isCareer,
    },
    {
        id: 'outer-district',
        name: 'From the Seam',
        hint: 'Crown a victor from District 10, 11 or 12.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && v.district >= 10,
        nearMiss: state => {
            const outer = state.tributes.filter(t => t.district >= 10);
            const best = outer.sort((a, b) => (b.dayOfDeath ?? 99) - (a.dayOfDeath ?? 99))[0];
            return best && best.status === 'dead'
                ? `${best.name} of District ${best.district} made it to day ${best.dayOfDeath}`
                : undefined;
        },
    },
    {
        id: 'volunteer-crown',
        name: 'I Volunteer',
        hint: 'Crown a victor who volunteered rather than being reaped.',
        category: 'reaping',
        rarity: 'common',
        test: (_s, v) => !!v && v.volunteered === true,
    },
    {
        id: 'sibling-volunteer',
        name: 'In Their Place',
        hint: 'See a tribute from outside the Career districts volunteer for a sibling.',
        category: 'reaping',
        rarity: 'common',
        test: state => state.tributes.some(t => t.volunteered && !t.isCareer),
    },
    {
        id: 'lovers-final-four',
        name: 'Star-Crossed',
        hint: 'See a star-crossed pair both survive to the final four.',
        category: 'social',
        rarity: 'legendary',
        test: state => {
            const lovers = state.tributes.filter(t => isStarCrossed(t));
            if (lovers.length < 2) return false;
            // Both alive at four remaining, or both among the last four to fall.
            const ranked = [...state.tributes].sort((a, b) =>
                (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity));
            const finalFour = new Set(ranked.slice(0, 4).map(t => t.id));
            return lovers.filter(l => finalFour.has(l.id)).length >= 2;
        },
        nearMiss: state => {
            // Only once the field really is down to four: "the final four" is
            // meaningless with fourteen alive, and this evaluator also runs
            // mid-run for the in-arena nudges.
            if (state.tributes.filter(t => t.status === 'alive').length > 4) return undefined;
            const lovers = state.tributes.filter(t => isStarCrossed(t));
            if (lovers.length < 2) return undefined;
            const ranked = [...state.tributes].sort((a, b) =>
                (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity));
            const finalFour = new Set(ranked.slice(0, 4).map(t => t.id));
            const made = lovers.filter(l => finalFour.has(l.id));
            if (made.length !== 1) return undefined;
            const left = lovers.find(l => l.id !== made[0].id);
            return `${made[0].name} reached the final four; ${left?.name ?? 'the other half of the pair'} fell`
                + `${left?.dayOfDeath ? ` on day ${left.dayOfDeath}` : ''} — star-crossed needs both of them there`;
        },
    },
    {
        id: 'protector-bond',
        name: 'Something Like Family',
        hint: 'See a protective bond form between an older tribute and a much younger one.',
        category: 'social',
        rarity: 'rare',
        test: state => state.tributes.some(t => (t.protectorBonds?.length ?? 0) > 0),
    },
    {
        id: 'career-pack-collapse',
        name: 'No Pack This Year',
        hint: 'See the Career pack come apart before the arena does it for them.',
        category: 'social',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'career-defections'),
    },
    {
        id: 'feast-betrayal',
        name: 'At the Table',
        hint: 'See a betrayal on the same day as a feast.',
        category: 'social',
        rarity: 'rare',
        test: state => {
            const feastDays = new Set(state.log.filter(e => e.category === 'feast').map(e => e.day));
            return state.log.some(e => e.text.startsWith('BETRAYAL') && feastDays.has(e.day));
        },
    },
    {
        id: 'mentor-rescue',
        name: 'The Parachute That Mattered',
        hint: 'Crown a victor whose mentor spent their own standing to keep them alive.',
        // A mentor plea on its own happens in most runs. The version worth
        // naming is the one that decided the Games: the tribute it saved is the
        // one who came home.
        category: 'capitol',
        rarity: 'common',
        test: (state, victor) => {
            if (!victor?.mentorLegacy) return false;
            // `important` is what separates a plea that landed from one that
            // did not: `processMentorPleas` marks only the successful one.
            return state.log.some(e =>
                e.category === 'sponsor' && e.important
                && e.tributesInvolved.includes(victor.id)
                && e.text.includes(victor.mentorLegacy!));
        },
    },
    {
        id: 'changed-by-it',
        name: 'Not Who They Were',
        /*
         * AUDIT-6 §11.4: at three it fired on 70.8% of runs, which made "not
         * who they were" the default state of a victor rather than a story
         * about one. Four is still reachable and is no longer most people.
         */
        hint: 'Crown a victor who earned four or more traits in the arena that they did not walk in with.',
        category: 'survival',
        rarity: 'common',
        test: (_s, v) => !!v && EARNED_TRAIT_NAMES.filter(name => v.traits.includes(name)).length >= 4,
        nearMiss: (_s, v) => {
            const n = v ? EARNED_TRAIT_NAMES.filter(name => v.traits.includes(name)).length : 0;
            return v && n === 3
                ? `${v.name} came home carrying 3 earned traits — one short of being someone else entirely`
                : undefined;
        },
    },
    {
        id: 'merciful',
        name: 'The Mercy',
        hint: 'See a tribute spare an opponent they had already beaten.',
        category: 'combat',
        rarity: 'common',
        test: state => state.tributes.some(t => t.traits.includes('Merciful')),
    },
    {
        id: 'feared',
        name: 'Everyone Knows the Name',
        hint: 'See a single tribute reach five kills.',
        category: 'combat',
        rarity: 'rare',
        test: state => state.tributes.some(t => t.kills >= 5),
        nearMiss: state => {
            const best = state.tributes.reduce((a, t) => Math.max(a, t.kills), 0);
            const holder = state.tributes.find(t => t.kills === best);
            return best >= 3 && best < 5 && holder
                ? `${holder.name} reached ${best} kills — ${5 - best} short of a name everyone knows`
                : undefined;
        },
    },
    {
        id: 'quarter-quell',
        name: 'A Quarter Quell',
        hint: 'Run a Games the Capitol has declared a Quarter Quell.',
        // Was `wildcard.kind.startsWith('quarter-quell')` — true only for the
        // two legacy Quells that happen to use that kind prefix, so most of
        // the 20+ Quells (anything working through castShapeOverride/
        // configOverride alone, like Victors' Field or the Doubled Reaping)
        // never unlocked this at all. `gamesProfile.quell` is set for every
        // Quell regardless of which lever it uses.
        category: 'capitol',
        rarity: 'common',
        test: state => state.gamesProfile?.quell !== undefined,
    },
    {
        id: 'silent-arena',
        name: 'No Faces in the Sky',
        hint: 'Run a Games with no anthem, where nobody learns who is left.',
        category: 'capitol',
        rarity: 'legendary',
        test: state => state.gamesProfile?.wildcard.kind === 'silent-arena',
    },
    {
        id: 'long-games',
        name: 'The Long Games',
        hint: 'See a Games run past day twelve.',
        category: 'games',
        rarity: 'common',
        test: state => state.day > 12,
        nearMiss: state => state.day >= 10 && state.day <= 12
            ? `these Games ran ${state.day} days — ${13 - state.day} short`
            : undefined,
    },
    {
        id: 'short-games',
        name: 'Over By Friday',
        hint: 'See a Games finish on day six or earlier.',
        category: 'games',
        rarity: 'legendary',
        test: state => state.day <= 6,
        nearMiss: state => state.day > 6 && state.day <= 8
            ? `these Games ran ${state.day} days — ${state.day - 6} over`
            : undefined,
    },
    {
        id: 'bloodbath-massacre',
        /*
         * AUDIT-9 B03: one idea, one card.
         *
         * This and `a7-half-at-the-horn` advertised the *same* condition —
         * "half the field in the bloodbath" — while testing two different
         * things. This one counted every death stamped day 1; that one counted
         * the phase flag. A 24-tribute fixture with 3 deaths at the horn and 9
         * more later on day 1 awarded this and not that, so the player was
         * paid twice for one discovery and inconsistently for the other.
         *
         * They are now one entry, on the predicate that actually means what
         * both of them claimed: the *bloodbath*, which is a phase, and not the
         * opening day, which is a phase plus everything the survivors did to
         * each other afterwards. `a7-half-at-the-horn` is retired, and
         * `RETIRED_ACHIEVEMENT_IDS` in `utils/panemStorage` carries anybody
         * who had earned it onto this one.
         *
         * The surviving id is the older of the two. An id is a permanent key
         * into somebody's saved store; the name and the shelf are what the
         * player sees, and both of those come from the entry that was right.
         */
        name: 'Half at the Horn',
        hint: 'See half the field or more die in the bloodbath.',
        category: 'combat',
        rarity: 'possible',
        test: state => atTheHorn(state) >= state.tributes.length / 2,
        nearMiss: state => {
            const n = atTheHorn(state);
            const needed = Math.ceil(state.tributes.length / 2);
            return n > 0 && needed - n <= 3 && n < needed
                ? `the horn took ${n} — ${needed - n} short of half the field`
                : undefined;
        },
    },
    {
        id: 'arena-wins',
        name: 'The Arena Won',
        hint: 'See a Games where more tributes died to the arena than to each other.',
        category: 'games',
        rarity: 'rare',
        test: state => {
            // AUDIT-9: by code, not by prefix.
            const byTribute = dead(state).filter(t => deathCodeOf(t) === 'tribute').length;
            return dead(state).length > 0 && byTribute < dead(state).length / 2;
        },
    },
    {
        id: 'unscathed',
        name: 'Barely a Scratch',
        hint: 'Crown a victor who finishes above 80 health.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && v.health > 80,
        nearMiss: (_s, v) => (v && v.health > 65 && v.health <= 80)
            ? `${v.name} finished on ${v.health} health — ${81 - v.health} short`
            : undefined,
    },
    {
        id: 'last-legs',
        name: 'On Their Last Legs',
        hint: 'Crown a victor who finishes below 15 health.',
        category: 'survival',
        rarity: 'possible',
        test: (_s, v) => !!v && v.health < 15,
        nearMiss: (_s, v) => (v && v.health >= 15 && v.health <= 30)
            ? `${v.name} finished on ${v.health} health — ${v.health - 14} above the line`
            : undefined,
    },
    {
        id: 'no-victor',
        name: 'Nobody Came Home',
        hint: 'See a Games end with no victor at all.',
        category: 'games',
        // AUDIT-7: observed across 500 runs, so no longer 'possible?' — the label
        // means the simulation is believed able to do this and no measured run
        // ever has, and a measured run now has.
        rarity: 'legendary',
        test: state => alive(state).length === 0,
        /*
         * REQUEST (run length): this became genuinely rare and needed to start
         * telling the player how close they got.
         *
         * A wipeout probe over 600 runs found that nine of twenty-three
         * no-victor runs were the *last tribute alive* taking the nightlock or
         * walking into the border — a tribute with nobody left to keep playing
         * against. Closing that (see `resolve.ts`) took the rate from 3.8% to
         * 0.3%, which is where it belongs: a Games with no victor should be a
         * story, not a rounding error. But an entry nobody earns and nobody is
         * told about is a promise the game does not keep, so this says how near
         * the arena came.
         */
        nearMiss: (state, v) => {
            if (!v) return undefined;
            // The victor finished on their last legs: one more cycle of
            // anything and the cannon would have been for nobody.
            if (v.health <= 12) {
                return `Your victor came home on ${Math.round(v.health)} health. The arena very nearly took the whole cast.`;
            }
            const finalTwo = state.tributes.filter(t => t.dayOfDeath === state.day).length;
            return finalTwo >= 2
                ? 'The last two went down on the same day. One cannon later and nobody would have come home.'
                : undefined;
        },
    },
    {
        id: 'eleven-score',
        name: 'An Eleven',
        hint: 'See a tribute score 11 or better in their private session.',
        // Measured at roughly 1 tribute in 900, so about one run in forty. A 12
        // exists above this and is deliberately once-in-a-generation — rare
        // enough (1 in 9,600 tributes) that an achievement keyed on it would
        // never be seen, which is the opposite of what this list is for.
        category: 'capitol',
        rarity: 'rare',
        test: state => state.tributes.some(t => t.trainingScore >= 11),
        nearMiss: state => {
            const best = Math.max(0, ...state.tributes.map(t => t.trainingScore));
            const holder = state.tributes.find(t => t.trainingScore === best);
            return best === 10 && holder
                ? `${holder.name} posted a 10 — one short of an eleven`
                : undefined;
        },
    },
    {
        id: 'hidden-hand',
        name: 'Hid Their Hand',
        hint: 'Crown a victor who deliberately concealed what they could do in training.',
        category: 'capitol',
        rarity: 'rare',
        test: (_s, v) => !!v && v.trainingStrategy === 'conceal',
    },
    // S-3: outcome achievements beyond the original 25 — the rare endings and
    // the challenge-run shapes the simulation can produce.
    {
        id: 'dual-victory',
        name: 'Both of Them',
        hint: 'See a Games end with two victors.',
        category: 'games',
        rarity: 'rare',
        test: state => (state.victorIds?.length ?? 0) >= 2,
        nearMiss: state => {
            // Only meaningful once a single victor is standing: the question is
            // whether the runner-up fell on the very last day of the Games.
            if ((state.victorIds?.length ?? 0) >= 2 || alive(state).length !== 1) return undefined;
            const runnerUp = dead(state)
                .slice()
                .sort((a, b) => (b.dayOfDeath ?? -Infinity) - (a.dayOfDeath ?? -Infinity))[0];
            if (!runnerUp || runnerUp.dayOfDeath !== state.day) return undefined;
            return `${runnerUp.name} fell on the last day — one cannon from a Games with two victors`;
        },
    },
    {
        id: 'nightlock-ending',
        name: 'The Berries',
        hint: 'See a tribute choose the nightlock rather than keep playing.',
        category: 'games',
        rarity: 'rare',
        // AUDIT-9: `nightlock` is its own cause code — a chosen ending, kept
        // distinct from the poisoning that would otherwise claim it.
        test: state => state.tributes.some(t => deathCodeOf(t) === 'nightlock'),
    },
    {
        id: 'wildfire',
        name: 'Let It Burn',
        hint: 'See a fire spread from one sector into the next.',
        category: 'arena',
        rarity: 'rare',
        // AUDIT-10 B3-03: the recorded fact, not the sentence about it.
        test: state => happened(state, 'fire-spread'),
    },
    {
        id: 'tesserae-crown',
        name: 'The Grain Paid Back',
        hint: 'Crown a victor whose name was in the bowl for tesserae, year after year.',
        category: 'reaping',
        rarity: 'common',
        test: (_s, v) => !!v && (v.tesserae ?? 0) >= 3,
        nearMiss: (_s, v) => {
            const n = v?.tesserae ?? 0;
            return v && n > 0 && n < 3
                ? `${v.name} carried ${n} tessera slip${n === 1 ? '' : 's'} — ${3 - n} short of the grain paying back`
                : undefined;
        },
    },
    {
        id: 'crown-limping',
        name: 'Held Together With String',
        hint: 'Crown a victor carrying three or more standing injuries at the end.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.injuries).filter(Boolean).length >= 3,
        nearMiss: (_s, v) => {
            const n = v ? Object.values(v.injuries).filter(Boolean).length : 0;
            return v && n === 2
                ? `${v.name} finished carrying 2 standing injuries — one short of held together with string`
                : undefined;
        },
    },
    {
        id: 'district-partners',
        name: 'Home Together',
        hint: 'See both tributes from one district reach the final four.',
        category: 'social',
        rarity: 'common',
        test: state => {
            const ranked = [...state.tributes].sort((a, b) =>
                (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity));
            const finalFour = ranked.slice(0, 4);
            return [...new Set(finalFour.map(t => t.district))].length < finalFour.length;
        },
    },
    // S-4: a second wave beyond the original 26 — outcomes the engine has
    // long been able to produce (debts, quirks, fan favourites, the
    // Cornucopia standoff, a Quell-specific mutt) with no achievement keyed
    // to any of them.
    {
        id: 'lone-wolf',
        name: 'Never Needed Anyone',
        hint: 'Crown a victor who never once joined an alliance.',
        category: 'social',
        rarity: 'rare',
        // B3-03: was a negation over the chronicle, which a trimmed save turned
        // into a false positive — see `Tribute.everAllied`.
        test: (state, v) => !!v && !v.everAllied,
    },
    {
        id: 'debt-unsettled',
        name: 'Still Owed',
        hint: 'Crown a victor who walked out of the arena owing two separate people.',
        category: 'social',
        rarity: 'legendary',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'debtors-crown' and 'unpaid-crown'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && Object.values(v.debts ?? {}).filter(d => d > 0).length >= 2,
        nearMiss: (_s, v) => (Object.values(v?.debts ?? {}).filter(d => d > 0).length === 1
            ? 'the victor came out owing exactly one person' : undefined),
    },
    {
        id: 'owed-by-many',
        name: 'Everybody Owed Them',
        hint: 'Crown a victor that two or more tributes still owed when the Games ended.',
        category: 'social',
        rarity: 'rare',
        test: (state, v) => !!v && state.tributes.filter(t => t.id !== v.id && (t.debts?.[v.id] ?? 0) > 0).length >= 2,
        nearMiss: (state, v) => {
            const n = v ? state.tributes.filter(t => t.id !== v.id && (t.debts?.[v.id] ?? 0) > 0).length : 0;
            return v && n === 1
                ? `one tribute still owed ${v.name} at the end — a second creditor short`
                : undefined;
        },
    },
    {
        id: 'camera-ready',
        name: 'Camera-Ready',
        hint: 'Crown a victor with two or more habits the cameras caught.',
        category: 'capitol',
        rarity: 'common',
        test: (_s, v) => !!v && (v.quirks?.length ?? 0) >= 2,
        nearMiss: (_s, v) => v && (v.quirks?.length ?? 0) === 1
            ? `${v.name} gave the cameras one habit to chew on — one short of camera-ready`
            : undefined,
    },
    {
        id: 'capitol-darling',
        name: "The Capitol's Darling",
        hint: 'Crown a tribute the Capitol had already marked a favourite before the gong.',
        category: 'capitol',
        rarity: 'rare',
        test: (_s, v) => !!v && v.fanFavourite === true,
    },
    {
        // BUG-4: this shipped under the same display name as `held-the-horn`,
        // with a different test and overlapping semantics, so the two were
        // indistinguishable in the list. They are now a tier: this is the
        // first real tenancy, `held-the-horn` is the long one.
        //
        // The old test also compared a *day* against `cornucopiaHeldSince`,
        // which is a *cycle* — a unit mismatch on top of an unreachable
        // threshold. It reads the same counter as its sibling now.
        id: 'cornucopia-holdout',
        name: 'Squatters at the Horn',
        hint: 'See one alliance hold the Cornucopia for four cycles running.',
        category: 'combat',
        rarity: 'rare',
        test: state => (state.maxHornHold ?? 0) >= 4,
        nearMiss: state => {
            const held = state.cornucopiaHolder !== undefined && state.cornucopiaHeldSince !== undefined
                ? state.maxHornHold ?? 0
                : 0;
            return held >= 3 && held < 5
                ? `an alliance held the Cornucopia ${held} days running — ${5 - held} short of holding the horn`
                : undefined;
        },
    },
    {
        id: 'protector-victor',
        name: 'Kept Their Word',
        hint: 'Crown a victor who was still protecting someone younger when the Games ended.',
        category: 'social',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.protectorBonds?.length ?? 0) > 0,
    },
    {
        id: 'full-showcase',
        name: 'Left Nothing Back',
        hint: 'Crown a victor who showed the Gamemakers everything in training instead of concealing it.',
        category: 'capitol',
        rarity: 'common',
        test: (_s, v) => !!v && v.trainingStrategy === 'showcase',
    },
    {
        id: 'clean-getaway',
        name: 'Clean Getaway',
        hint: 'Crown a victor who came out unwounded, unscarred, and never once off their feet.',
        // §11: this read the victor's *live* injuries, so it counted anyone
        // who happened to be patched up by the cannon and fired on 76.3% of
        // runs. `woundsLogged` (engine/wounds.ts) is the history the hint was
        // describing all along.
        category: 'survival',
        rarity: 'rare',
        // AUDIT-8 §1.4: unlocked on exactly the same runs as 'unmarked' across a
        // 500-run sample. Re-gated to a harder rung of the same ladder rather than
        // deleted, so an id already in a player's record keeps resolving.
        test: (_s, v) => !!v && (v.woundsLogged ?? 0) <= ACHIEVEMENT_BARS.cleanGetawayWounds
            && v.everDowned !== true && Object.keys(v.scars ?? {}).length === 0,
        nearMiss: (_s, v) => (v && (v.woundsLogged ?? 0) > 0 && (v.woundsLogged ?? 0) <= 2)
            ? `${v.name} came home with ${v.woundsLogged} logged wound${v.woundsLogged === 1 ? '' : 's'} — not quite clean`
            : undefined,
    },
    {
        id: 'sole-of-two',
        name: 'Went In Together, Came Out Alone',
        hint: "Crown a victor whose district partner died in the bloodbath.",
        category: 'social',
        rarity: 'common',
        test: (state, v) => {
            if (!v) return false;
            const partner = state.tributes.find(t => t.district === v.district && t.id !== v.id);
            // §12: this tested `dayOfDeath === 0`, but `killTribute` stamps
            // `state.day` and `startGames` sets day 1 before the bloodbath
            // resolves — no tribute has ever died on day 0, so this could not
            // fire. `diedInBloodbath` is set where the bloodbath actually ends.
            return !!partner && partner.status === 'dead' && partner.diedInBloodbath === true;
        },
    },
    {
        id: 'reflection-survivor',
        name: 'Beat Their Own Reflection',
        hint: 'Crown a victor in the Quell where every tribute faces a mutt wearing their own face.',
        category: 'capitol',
        rarity: 'legendary',
        test: (state, v) => !!v && state.gamesProfile?.quell?.id === 'the-reflection',
        nearMiss: (state, v) => {
            if (state.gamesProfile?.quell?.id !== 'the-reflection') return undefined;
            if (v) return undefined;
            return 'the Reflection Quell ended with no victor — somebody has to walk out to beat their own face';
        },
    },
    {
        id: 'bloodless-quell',
        name: 'A Quell With No Blood On It',
        hint: 'See a Quarter Quell end with no victor having killed anybody.',
        category: 'capitol',
        rarity: 'legendary',
        test: (state, v) => !!v && state.gamesProfile?.quell !== undefined && v.kills === 0,
    },
    // §10.1: the third wave — the social machinery today's work added (truces
    // renewed, extortion, charters, deposals, grudges) plus the arena's own
    // set pieces, none of which had an achievement keyed to them.
    {
        id: 'kept-word',
        name: 'Kept Word',
        hint: 'See a truce declared, renewed, and still standing when one of its parties falls.',
        category: 'social',
        rarity: 'common',
        test: state => state.keptWordSeen === true,
    },
    {
        id: 'long-con',
        name: 'The Long Con',
        hint: 'Crown a victor who once held a performed bond for two cycles straight.',
        category: 'social',
        rarity: 'rare',
        // Audit 2 §11.2: five, against a victor ceiling of three.
        // Audit 4 §3.2: two, against a measured victor ceiling of two. The
        // entry is structurally narrow before the threshold does any work — a
        // performance only starts from a showmance, showmances happen in ~17%
        // of runs, only one of the pair is the performer, `sniffPerformances`
        // can end it at any time, and then that specific person has to win. The
        // threshold was the one part of that chain doing no work at all.
        /*
         * AUDIT-6 §11.2: reads the run, not the victor.
         *
         * Measured across the whole field, 39 of 46 performers reach a streak
         * of two or more — but only about 3% of victors do, because the
         * performer has to also win, which is a second and unrelated lottery.
         * A 500-run sample therefore saw this or did not on a coin flip, and
         * `check-achievements` correctly called it unreachable. The act is what
         * the entry is named for.
         */
        test: state => (state.longestPerformance ?? 0) >= 2,
        nearMiss: state => ((state.longestPerformance ?? 0) === 1
            ? 'Somebody kept an act up for a single cycle — one short of the long con'
            : undefined),
    },
    {
        id: 'toll-collector',
        name: 'Toll Collector',
        // Audit 2 §11.2: three against a ceiling of two.
        hint: 'See one tribute extort payment out of two different people in a single Games.',
        category: 'social',
        rarity: 'rare',
        test: state => state.tributes.some(t => (t.extortedIds?.length ?? 0) >= 2),
        nearMiss: state => {
            const holder = state.tributes.find(t => (t.extortedIds?.length ?? 0) === 1);
            return holder ? `${holder.name} shook one tribute down — one short of a toll collector` : undefined;
        },
    },
    {
        // §1.7: `retainersHonoured` was the one field in the lifetime-ledger
        // audit that was genuinely dead — written every cycle by
        // `tickRetainers`, whose own comment says "the achievement layer can
        // finally see it", and then read by nothing at all. This is the read
        // site that comment was describing. It measures what the field
        // actually holds: the most clients on the books at one time.
        id: 'on-retainer',
        name: 'On Retainer',
        // Audit 2 §11.2: two concurrent clients is above the ceiling — no
        // tribute in 200 runs ever honoured more than one retainer, so the
        // Mercenary's defining mechanic could not be recognised at all. One
        // contract, carried to the end and honoured, is the achievement.
        hint: 'Crown a victor who was paid for their protection and delivered it.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.retainersHonoured ?? 0) >= 1,
        nearMiss: (_s, v) => (v && (v.retainersHonoured ?? 0) === 0 && v.archetype === 'mercenary')
            ? `${v.name} took the crown without ever once being paid to keep somebody else alive`
            : undefined,
    },
    {
        id: 'paid-in-full',
        name: 'Paid in Full',
        hint: 'See every debt in the arena settled before the field reaches four.',
        category: 'social',
        rarity: 'common',
        test: state => state.paidInFullSeen === true,
    },
    {
        id: 'mutiny',
        name: 'Mutiny',
        // §12: "the same alliance twice" never happened once in 400 runs —
        // alliances that depose a leader tend not to survive long enough to do
        // it again. Two coups anywhere in one Games is the same statement
        // about a Games and is actually reachable.
        hint: 'See two alliances depose their leaders in the same Games.',
        category: 'social',
        rarity: 'rare',
        test: state => Object.values(state.allianceDeposals ?? {}).reduce((a, n) => a + n, 0) >= 2,
        nearMiss: state => Object.values(state.allianceDeposals ?? {}).reduce((a, n) => a + n, 0) === 1
            ? 'one alliance deposed its leader — a second coup short of a mutiny'
            : undefined,
    },
    {
        id: 'charter-kept',
        name: 'Charter Kept',
        hint: 'See a charter of four clauses or more carried to the final eight without one of them broken.',
        category: 'social',
        rarity: 'legendary',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'the-terms-were-the-terms'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: state => state.charterKeptSeen === true && (state.deepestCharter ?? 0) >= 4,
        nearMiss: state => (state.charterKeptSeen === true && (state.deepestCharter ?? 0) === 3
            ? 'a three-clause charter was kept; four is the bar' : undefined),
    },
    {
        id: 'blood-feud',
        name: 'Blood Feud',
        hint: 'See one pair of tributes fight each other four separate times.',
        category: 'combat',
        rarity: 'common',
        test: state => state.tributes.some(t =>
            Object.values(t.memory?.rivals ?? {}).some(r => r.fights >= 4)),
        nearMiss: state => {
            const best = state.tributes.reduce((a, t) =>
                Math.max(a, ...Object.values(t.memory?.rivals ?? {}).map(r => r.fights), 0), 0);
            return best === 3
                ? 'a rivalry reached 3 fights — one more meeting short of a blood feud'
                : undefined;
        },
    },
    {
        id: 'someone-elses-war',
        name: "Someone Else's War",
        // §12: this fired on 99.3% of runs. With ~10 vengeance oaths sworn per
        // Games and only one tribute left standing, *somebody* always dies
        // with an unfinished oath — it was measuring the vengeance system's
        // existence, not an outcome. Requiring the target to be the one still
        // breathing at the end narrows it to the case the name describes: the
        // person you swore to kill wins.
        hint: 'See a tribute die sworn to kill the tribute who goes on to win.',
        category: 'combat',
        rarity: 'common',
        test: (state, v) => !!v && dead(state).some(t =>
            (t.memory?.vengeance ?? []).includes(v.id)),
    },
    {
        id: 'both-mourned',
        name: 'Both Mourned',
        // §12: this fired on 100% of runs. Any alliance-category log line
        // mentioning both of them counted — including the line where their
        // alliance *broke*, and including two members of the same pack who had
        // simply watched the same person die. Requiring them to actually be
        // allied at the end of it makes the achievement mean what its name
        // says: shared grief that turned into something.
        hint: 'See two allies grieve the same death and keep standing together afterwards.',
        category: 'social',
        rarity: 'rare',
        test: state => state.sharedGriefAllies === true,
    },
    {
        id: 'ashes-to-ashes',
        name: 'Ashes to Ashes',
        hint: 'See a single fire chain its way across four sectors.',
        category: 'arena',
        rarity: 'legendary',
        test: state => (state.fireChainMax ?? 1) >= 4,
        nearMiss: state => {
            const best = state.fireChainMax ?? 1;
            return best >= 2 && best < 4
                ? `a fire ran ${best} zones deep — ${4 - best} short of a true conflagration`
                : undefined;
        },
    },
    {
        id: 'cartographer',
        name: 'Cartographer',
        hint: 'See one tribute personally stand in every zone the arena has.',
        category: 'arena',
        // Audit 5 §1.6: 8 of 9,600 tributes did it. Legendary, not theoretical.
        rarity: 'legendary',
        test: state => {
            const all = state.arena.zones.map(z => z.name);
            return state.tributes.some(t => all.every(z => (t.visitedZones ?? []).includes(z)));
        },
        nearMiss: state => {
            const all = state.arena.zones.map(z => z.name);
            let bestName = '';
            let bestMissing = Infinity;
            state.tributes.forEach(t => {
                const missing = all.filter(z => !(t.visitedZones ?? []).includes(z)).length;
                if (missing < bestMissing) { bestMissing = missing; bestName = t.name; }
            });
            return bestMissing > 0 && bestMissing <= 2
                ? `${bestName} walked all but ${bestMissing} zone${bestMissing === 1 ? '' : 's'} of the arena`
                : undefined;
        },
    },
    {
        id: 'deep-water',
        name: 'Deep Water',
        hint: 'Crown a victor in a sprawling arena of thirteen zones or more.',
        category: 'arena',
        rarity: 'rare',
        test: (state, v) => !!v && state.arena.zones.length >= 13,
        nearMiss: (state, v) => (v && state.arena.zones.length >= 10 && state.arena.zones.length < 13)
            ? `this arena ran ${state.arena.zones.length} sectors — deep water is thirteen or more`
            : undefined,
    },
    {
        id: 'pressure-cooker',
        name: 'Pressure Cooker',
        hint: 'Crown a victor in a cramped arena of eight zones or fewer.',
        category: 'arena',
        rarity: 'rare',
        test: (state, v) => !!v && state.arena.zones.length <= 8,
        nearMiss: (state, v) => (v && state.arena.zones.length > 8 && state.arena.zones.length <= 10)
            ? `this arena ran ${state.arena.zones.length} sectors — a pressure cooker is eight or fewer`
            : undefined,
    },
    {
        id: 'ground-gave-out',
        name: 'The Ground Gave Out',
        hint: 'Watch the closing border take somebody.',
        category: 'arena',
        rarity: 'common',
        // AUDIT-9: the border is a cause code; it had two spellings here and
        // the engine writes at least three.
        test: state => dead(state).some(t => deathCodeOf(t) === 'border'),
    },
    {
        id: 'held-the-horn',
        name: 'Held the Horn',
        hint: 'Hold the Cornucopia for six consecutive cycles.',
        category: 'combat',
        rarity: 'legendary',
        test: state => (state.maxHornHold ?? 0) >= 6,
        nearMiss: state => {
            const n = state.maxHornHold ?? 0;
            return n >= 3 && n < 6
                ? `the longest Cornucopia hold ran ${n} cycles — ${6 - n} short of Held the Horn`
                : undefined;
        },
    },
    {
        id: 'trappers-crown',
        name: "Trapper's Crown",
        // §12: three trap kills is above the ceiling the trap system can
        // actually produce — the highest any tribute reached across 400 runs
        // was two, so this could never fire. Two is still a victor who let the
        // ground do the work.
        hint: 'Crown a victor who let their traps do some of the killing for them.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.trapKills ?? 0) >= 1,
        // AUDIT-10 B3-03: `trapsSet` is the counter this was reaching for.
        nearMiss: (_state, v) => v && (v.trapKills ?? 0) === 0 && (v.trapsSet ?? 0) > 0
            ? `${v.name} worked traps all Games and none of them ever closed on anybody`
            : undefined,
    },
    {
        id: 'apothecary',
        name: 'Apothecary',
        // §12: the threshold was 4. The best field medicine anyone reached
        // across 400 runs was 2.78 — the proficiency curve's diminishing term
        // and the length of a Games put 4 out of reach entirely, so this never
        // fired for anybody. 2.5 is the top of what the system produces.
        hint: 'See a tribute train their field medicine past competent.',
        category: 'survival',
        rarity: 'common',
        test: state => state.tributes.some(t => (t.proficiencies?.medicine ?? 0) >= 2.5),
        nearMiss: state => {
            const best = state.tributes.reduce((a, t) => Math.max(a, t.proficiencies?.medicine ?? 0), 0);
            return best >= 2 && best < 2.5
                ? 'somebody\'s field medicine reached 2 — a little short of an apothecary'
                : undefined;
        },
    },
    {
        // §12: this asked for all four of armour, light, warmth and a
        // purifier at once. Nobody has ever managed it — three is the most any
        // tribute reached across 400 runs, because a fourth utility slot comes
        // out of the same carry capacity as food, water and a weapon.
        id: 'full-kit',
        name: 'Full Kit',
        hint: 'See one tribute holding three of armour, a light, warmth and a water purifier at once.',
        category: 'survival',
        rarity: 'rare',
        test: state => state.tributes.some(t => t.fullKitSeen === true),
    },
    {
        id: 'nothing-but-hands',
        name: 'Nothing but Hands',
        hint: 'Crown a victor who never once carried a weapon.',
        category: 'combat',
        // AUDIT-7: observed at 0.4% of 500 runs, so no longer 'possible?'.
        rarity: 'possible',
        test: (_s, v) => !!v && v.everCarriedWeapon !== true,
        // Audit 3 §11.4: an entry the sweep never sees unlock, with nothing
        // told to the player, is unreachable and invisible at once.
        nearMiss: (state, v) => {
            if (!v || v.everCarriedWeapon !== true) return undefined;
            const bare = state.tributes.filter(t => t.everCarriedWeapon !== true).length;
            return bare > 0
                ? `${bare} tribute${bare === 1 ? '' : 's'} went the whole Games without picking anything up. Your victor was not one of them.`
                : `${v.name} picked up a weapon at some point. Somebody, one year, will not.`;
        },
    },
    {
        id: 'venom-kill',
        name: 'Venom',
        hint: 'See a poisoned blade finish what it started.',
        category: 'combat',
        rarity: 'legendary',
        test: state => dead(state).some(t =>
            t.poisonedByWeapon === true && deathCodeOf(t) === 'poison'),
    },
    {
        id: 'twelve-score',
        name: 'Twelve',
        hint: 'See the Gamemakers hand down a training score of twelve.',
        category: 'capitol',
        rarity: 'legendary',
        test: state => state.tributes.some(t => t.trainingScore >= 12),
        nearMiss: state => state.tributes.some(t => t.trainingScore === 11)
            ? 'an eleven went up on the board — one short of the score nobody gets'
            : undefined,
    },
    {
        id: 'three-fingers',
        name: 'Three Fingers',
        hint: 'See a district give its tribute the salute.',
        category: 'reaping',
        // §(requests 21): the salute is written now (it never was), and the
        // square gives it to the young and to volunteers who are not Careers,
        // which lands it in a quarter of runs.
        rarity: 'common',
        /*
          * AUDIT-10 B3-03: this matched /three[- ]finger/i against the whole
          * chronicle, and the arena flavour tables contain "a crack opens
          * across {zone}, three fingers wide" and "the hold {tribute} has three
          * fingers behind comes away whole". A crack in the ground was awarding
          * a district's salute.
          *
          * The reaping note is kept as a second reading, because a run saved
          * before the fact was recorded still carries it.
          */
        test: state => happened(state, 'salute-given')
            || state.tributes.some(t => /three[- ]finger salute/i.test(t.reapingNote ?? '')),
    },
    {
        id: 'the-token',
        name: 'The Token',
        // §12: every tribute is issued a token at the goodbye room and
        // nothing ever took one away, so this reduced to "win the Games" and
        // fired on 98.8% of runs. A broken tribute can now put their token
        // down (see `RESOLVE.tokenLostOnBreakdown`), which is what makes still
        // having it at the end a fact about the victor rather than about the
        // rules.
        hint: 'Crown a victor still carrying the one thing they brought from home.',
        category: 'reaping',
        rarity: 'common',
        test: (_s, v) => !!v && v.token !== undefined,
    },

    // §12.1: arena-class achievements added with the ninth-wave arenas. Each
    // one keys off state the engine already tracks — no new bookkeeping.
    {
        id: 'against-the-law',
        name: 'Against the Law',
        hint: 'Crown a victor in an arena running three or more standing laws at once.',
        category: 'arena',
        rarity: 'rare',
        test: (state, v) => !!v && ((state.arena.law ? 1 : 0) + (state.arena.laws?.length ?? 0)) >= 3,
        nearMiss: (state, v) => {
            if (!v) return undefined;
            const laws = (state.arena.law ? 1 : 0) + (state.arena.laws?.length ?? 0);
            return laws === 2
                ? 'this arena ran two standing laws at once — three is Against the Law'
                : undefined;
        },
    },
    {
        id: 'never-left',
        name: 'Never Left',
        hint: 'Crown a victor who stood in three zones or fewer, start to finish.',
        category: 'arena',
        rarity: 'common',
        test: (_s, v) => !!v && (v.visitedZones ?? []).length > 0 && (v.visitedZones ?? []).length <= 3,
        nearMiss: (_s, v) => (v && (v.visitedZones ?? []).length === 4)
            ? `${v.name} won having stood in only four zones — one too many to have never left`
            : undefined,
    },
    {
        id: 'grand-cartography',
        name: 'Cartography',
        hint: 'See one tribute walk two-thirds of a sprawling arena of twelve zones or more.',
        // Extends `cartographer`: same walk, but only counted where the walk is
        // long. §11 cut this from a complete walk to all-but-one and it stayed
        // unreachable, because the problem is the size of the map against the
        // length of a run rather than the margin. Audit 2 §3.1: in an arena of
        // twelve zones or more a victor covers 33% at the median and 67% at the
        // very best. Two-thirds of a sprawl is the top of what the calendar
        // allows, and it is still the longest walk anybody takes all year.
        category: 'arena',
        rarity: 'legendary',
        test: state => state.arena.zones.length >= 12
            && state.tributes.some(t =>
                (t.visitedZones?.length ?? 0) >= Math.ceil(state.arena.zones.length * (2 / 3))),
        nearMiss: state => {
            if (state.arena.zones.length < 12) return undefined;
            const need = Math.ceil(state.arena.zones.length * (2 / 3));
            const best = state.tributes.reduce((most, t) => Math.max(most, t.visitedZones?.length ?? 0), 0);
            return need - best > 0 && need - best <= 2
                ? `somebody walked ${best} zones of a sprawling arena — ${need - best} short of two-thirds of it`
                : undefined;
        },
    },
    {
        id: 'full-bestiary',
        name: 'Full Bestiary',
        hint: 'Meet every mutt in one arena\'s roster, and crown a victor who walked away from three of them.',
        category: 'arena',
        rarity: 'legendary',
        // AUDIT-8 §1.4: unlocked on exactly the same runs as 'the-whole-bestiary' across a
        // 500-run sample. Re-gated to a harder rung of the same ladder rather than
        // deleted, so an id already in a player's record keeps resolving.
        test: state => {
            // `muttsSeen` records engine encounters by name; the arena's
            // `mutts` list is the same names as flavour. Procedural arenas
            // carry their real roster on `muttRoster`.
            const roster = state.arena.muttRoster?.map(m => m.name) ?? state.arena.mutts;
            const victor = state.tributes.find(t => t.status === 'alive');
            return roster.length >= 3 && roster.every(name => (state.muttsSeen ?? []).includes(name))
                && (victor?.muttsSurvived ?? 0) >= 3;
        },
        nearMiss: state => {
            const roster = state.arena.muttRoster?.map(m => m.name) ?? state.arena.mutts;
            const missing = roster.filter(name => !(state.muttsSeen ?? []).includes(name));
            return roster.length >= 3 && missing.length === 1
                ? `every mutt in the arena showed itself but one: ${missing[0]}`
                : undefined;
        },
    },

    // §12.1: the downed state's own achievements. All three are about the
    // decision the rescue window creates, which is the only thing in this
    // simulation that asks a tribute what kind of person they are while
    // somebody is lying at their feet.
    {
        id: 'brought-back',
        name: 'Brought Back',
        hint: 'Crown a victor who was left for dead and pulled back by an ally.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && v.revivedBy !== undefined,
        nearMiss: (state, v) => {
            if (!v || v.revivedBy !== undefined) return undefined;
            if (v.everDowned) return `${v.name} went down in these Games and got themselves back up. Somebody else doing it for you is the other ending.`;
            const pulled = state.tributes.filter(t => t.revivedBy !== undefined).length;
            return pulled > 0 ? `${pulled} tribute${pulled === 1 ? ' was' : 's were'} pulled back off the ground this year, and none of them won` : undefined;
        },
    },
    {
        id: 'left-them-standing',
        name: 'Left Them Standing',
        hint: 'See one tribute stand over three helpless rivals and walk away from all three.',
        category: 'combat',
        rarity: 'legendary',
        test: state => state.tributes.some(t => (t.sparedDowned?.length ?? 0) >= 3),
        nearMiss: state => {
            const best = Math.max(0, ...state.tributes.map(t => t.sparedDowned?.length ?? 0));
            return best === 2 ? 'somebody spared two helpless rivals — one short of a pattern' : undefined;
        },
    },
    {
        id: 'found-first',
        name: 'Found First',
        // §(requests 21): the threshold was three and 500 runs never produced
        // more than two — an entry nobody could earn. Somebody reaching a
        // downed ally first *twice* is already the rarest kind of behaviour the
        // downed system produces, and it is a thing the engine actually does.
        hint: 'See one tribute be the first to reach a downed ally twice over.',
        category: 'social',
        rarity: 'rare',
        test: state => state.tributes.some(t => (t.reachedDownedFirst ?? 0) >= 2),
        nearMiss: state => {
            const best = state.tributes
                .slice()
                .sort((a, b) => (b.reachedDownedFirst ?? 0) - (a.reachedDownedFirst ?? 0))[0];
            const count = best?.reachedDownedFirst ?? 0;
            return count === 2
                ? `${best.name} was first to a downed ally twice — three times is Found First`
                : undefined;
        },
    },
    {
        id: 'every-door',
        name: 'Every Door',
        hint: 'Trigger every one of an arena\'s once-only events in a single Games.',
        category: 'arena',
        rarity: 'possible',
        test: state => {
            const once = arenaFlavor(state.arena.id, state.arena).events
                .filter(e => e.oncePerRun && e.id)
                .map(e => e.id as string);
            return once.length >= 2 && once.every(id => (state.firedEvents ?? []).includes(id));
        },
        nearMiss: state => {
            const once = arenaFlavor(state.arena.id, state.arena).events
                .filter(e => e.oncePerRun && e.id)
                .map(e => e.id as string);
            const missing = once.filter(id => !(state.firedEvents ?? []).includes(id));
            return once.length >= 2 && missing.length === 1
                ? 'every one of the arena\'s once-only events fired but one'
                : undefined;
        },
        availableIn: state => arenaFlavor(state.arena.id, state.arena).events
            .filter(e => e.oncePerRun && e.id).length >= 2,
    },
    {
        // §9.7: the outer-district counterweight, made visible. A tribute who
        // wins on what they knew rather than what they carried is the whole
        // argument for making map knowledge tradeable.
        id: 'word-of-mouth',
        name: 'Word of Mouth',
        hint: 'Crown a victor who traded honest map knowledge with two different tributes.',
        category: 'social',
        rarity: 'rare',
        // Audit 2 §11.2: three, against a victor ceiling of two.
        test: (_s, v) => !!v && (v.sharedIntelWith?.length ?? 0) >= 2,
        nearMiss: (_s, v) => {
            const shared = v?.sharedIntelWith?.length ?? 0;
            return (v && shared >= 1 && shared < 3)
                ? `${v.name} traded honest map knowledge with ${shared === 1 ? 'one tribute' : `${shared} tributes`} — ${3 - shared} short of word of mouth`
                : undefined;
        },
    },
    {
        id: 'poisoned-well',
        name: 'The Poisoned Well',
        hint: 'Crown a victor who sent somebody to a zone they knew was a lie.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.liedTo?.length ?? 0) > 0,
    },

    // ---- §12: sixteen more, checked against every existing id -----------
    // Each is phrased as a thing the simulation can do that nothing in the
    // existing table already asks for. Where one came close to an existing
    // entry the angle was changed rather than the wording — 'Quiet Storm' is
    // about who threw the first punch, which is a different claim from
    // 'Bloodless Crown' (no kills at all) or 'Merciful' (sparing opponents).
    {
        id: 'quiet-storm',
        name: 'Quiet Storm',
        hint: 'Crown a victor who never once opened a fight. Killing in self-defence is fine.',
        category: 'combat',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.fightsOpened ?? 0) === 0,
        nearMiss: (_s, v) => (v && (v.fightsOpened ?? 0) === 1)
            ? `${v.name} opened exactly one fight all run — one short of never`
            : undefined,
    },
    {
        id: 'boomerang',
        name: 'Boomerang',
        hint: 'Crown a victor who was betrayed by an ally and won anyway.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.memory?.timesBetrayed ?? 0) > 0,
    },
    {
        id: 'hairsbreadth',
        name: 'Hairsbreadth',
        // §11 lowered this from three to two, on the same reasoning the audit-2
        // ceiling check now applies mechanically — and two was still above the
        // victor ceiling of one, so it stayed unreachable and stayed on the
        // never-unlocked list looking merely hard. Falling below five health at
        // all and getting back up is the thing the name describes.
        hint: 'Crown a victor who fell below five health and got back up.',
        category: 'survival',
        rarity: 'rare',
        // Audit 2 §11.2: two, against a victor ceiling of one.
        test: (_s, v) => !!v && (v.lowHealthRecoveries ?? 0) >= 1,
        nearMiss: (_s, v) => (v && (v.lowHealthRecoveries ?? 0) === 0 && v.health <= 20)
            ? `${v.name} was crowned on ${Math.round(v.health)} health and never once had to come off the floor`
            : undefined,
    },
    {
        id: 'grey-market',
        name: 'Grey Market',
        // §11: all three terms at once never landed in 600 runs. Any two of
        // the three is still a victor who spent the Games trading in other
        // people rather than fighting them, which is what the name is for.
        hint: 'Crown a victor who worked two sides of the arena economy — extorting, being extorted, or brokering a truce.',
        category: 'social',
        // AUDIT-7: the §4.1 trust wiring and the §4.2 keeper role between them
        // made the arena economy busy enough for this to land. 0.4% of 500 runs.
        rarity: 'legendary',
        test: (_s, v) => !!v
            && [(v.extortedIds?.length ?? 0) > 0,
                (v.extortedByIds?.length ?? 0) > 0,
                (v.brokeredTruces?.length ?? 0) > 0].filter(Boolean).length >= 2,
        nearMiss: (_s, v) => {
            const sides = v ? [(v.extortedIds?.length ?? 0) > 0,
                (v.extortedByIds?.length ?? 0) > 0,
                (v.brokeredTruces?.length ?? 0) > 0].filter(Boolean).length : 0;
            return sides === 1 ? `${v!.name} worked one side of the market — a second would have made it a trade` : undefined;
        },
    },
    {
        id: 'foul-weather',
        name: 'Foul Weather Friend',
        hint: 'Crown a victor who stood in three separate Gamemaker storm fronts and walked out of all three.',
        category: 'arena',
        rarity: 'common',
        test: (_s, v) => !!v && (v.stormsSurvived ?? 0) >= 3,
        nearMiss: (_s, v) => (v && (v.stormsSurvived ?? 0) === 2)
            ? `${v.name} rode out two fronts — one short`
            : undefined,
    },
    {
        id: 'homecoming',
        name: 'Homecoming',
        hint: 'Crown a victor reaped from a forgotten-tier district.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && legacyOf(v.district).tier === 'forgotten',
    },
    {
        id: 'understudy',
        name: 'Understudy',
        hint: 'Crown a victor who took over an alliance after its original leader died.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && v.tookOverAllianceLead === true,
    },
    {
        id: 'scorched-earth',
        name: 'Scorched Earth',
        // Audit 2 §11.2: three against a ceiling of one. Changing the state of
        // a zone by your own hand is already rare — 200 runs produced no
        // tribute who managed it twice — so the entry is the act, not a tally
        // of it.
        hint: 'See one tribute personally set a zone burning, flooding or worse through their own actions.',
        category: 'arena',
        rarity: 'rare',
        test: state => state.tributes.some(t => (t.zoneEffectsCaused ?? 0) >= 1),
        nearMiss: state => state.log.some(e => /\bfire\b|\bflood\b/i.test(e.text))
            ? undefined
            : 'nobody laid a hand on the arena itself this year',
    },
    {
        id: 'unread',
        name: 'Unread',
        hint: 'Crown a victor the sponsors never sent a single thing.',
        category: 'capitol',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.memory?.giftsReceived ?? 0) === 0,
    },
    {
        id: 'second-wind',
        name: 'Second Wind',
        hint: 'Crown a victor whose mind went all the way and came back.',
        // `sanityScarred` is written on the first visit to the `gone` band and
        // never cleared. §11: on its own that made this "did your mind ever
        // slip", which is true of 97.3% of victors — the achievement was noise
        // on a menu that is supposed to be a list of things to go looking for.
        // Coming back is the other half of the name, and now the other half of
        // the test.
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && v.sanityScarred === true && v.sanityRecovered === true,
        nearMiss: (_s, v) => (v && v.sanityScarred === true && v.sanityRecovered !== true)
            ? `${v.name} went all the way down and never climbed back out of it`
            : undefined,
    },
    {
        id: 'the-quiet-one',
        name: 'The Quiet One',
        hint: 'Crown a victor the chronicle mentions by name fewer than ten times all run.',
        category: 'oddity',
        rarity: 'possible',
        test: (state, v) => !!v && state.log.filter(e => e.tributesInvolved.includes(v.id)).length < 10,
        nearMiss: (state, v) => {
            if (!v) return undefined;
            const mentions = state.log.filter(e => e.tributesInvolved.includes(v.id)).length;
            return mentions >= 10 && mentions <= 18
                ? `the chronicle named ${v.name} ${mentions} times — under ten is a victor nobody watched`
                : undefined;
        },
    },
    {
        id: 'storm-chaser',
        name: 'Storm Chaser',
        hint: 'Crown a victor who walked into a sector under an active zone effect three times and survived each one.',
        category: 'arena',
        rarity: 'common',
        test: (_s, v) => !!v && (v.walkedIntoEffect ?? 0) >= 3,
        nearMiss: (_s, v) => {
            const walked = v?.walkedIntoEffect ?? 0;
            return (v && walked >= 1 && walked < 3)
                ? `${v.name} walked into a sector under an active effect ${walked === 1 ? 'once' : `${walked} times`} — ${3 - walked} short of storm chaser`
                : undefined;
        },
    },
    {
        id: 'clean-slate',
        name: 'Clean Slate',
        hint: 'Crown a victor who gained no traits in the arena and lost none — exactly who they went in as.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v
            && !v.traits.some(t => EARNED_TRAIT_NAMES.includes(t))
            && v.startingTraitCount !== undefined
            && v.traits.length === v.startingTraitCount,
        // §(requests 21): 0 unlocks in 500 runs and nothing told the player why,
        // which is the one combination this check treats as a broken promise —
        // the entry names a condition that nobody can see themselves approaching.
        // Winning changes a tribute, so the near miss is the count of what the
        // arena wrote onto them.
        nearMiss: (_s, v) => {
            if (!v) return undefined;
            const earned = v.traits.filter(t => EARNED_TRAIT_NAMES.includes(t));
            if (earned.length === 0) return undefined;
            return earned.length === 1
                ? `The victor came out of it with one trait they did not go in with: ${earned[0]}.`
                : `The arena wrote ${earned.length} traits onto the victor that they did not go in with: ${earned.join(', ')}.`;
        },
    },
    {
        id: 'borrowed-time',
        name: 'Borrowed Time',
        hint: 'Crown a victor whose will to keep going dropped under twenty and came back up.',
        category: 'survival',
        rarity: 'possible',
        // §1.3 (audit): resolve is sampled in every phase now; the trough that
        // counts is twenty, which is where breakdowns start being rolled.
        test: (_s, v) => !!v && (v.minResolve ?? 100) < 20 && (v.resolve ?? 0) >= 20,
        nearMiss: (_s, v) => {
            if (!v) return undefined;
            const low = v.minResolve ?? 100;
            const now = v.resolve ?? 0;
            // Two ways to miss it: never dropped far enough, or dropped and
            // never climbed back out.
            if (low < 20 && now < 20) return `${v.name} came home on ${Math.round(now)} resolve — borrowed time needs them back above twenty`;
            if (low >= 20 && low <= 30) return `${v.name}'s will bottomed out at ${Math.round(low)} — borrowed time starts under twenty`;
            return undefined;
        },
    },
    {
        id: 'the-unwitnessed',
        name: 'The Unwitnessed',
        hint: 'See a tribute reach the final eight without once standing in the same sector as another living tribute after the bloodbath.',
        category: 'oddity',
        rarity: 'possible',
        // Audit 5 §1.9: a victor structurally cannot (the endgame forces the
        // last survivors together). A tribute who got deep in without ever
        // being seen is the same story, and it is reachable.
        test: state => state.tributes.some(t =>
            t.metAnybodyAfterBloodbath !== true && t.status === 'dead' && (t.dayOfDeath ?? 0) > 0
            && state.tributes.filter(o => o.status === 'alive' || (o.dayOfDeath ?? Infinity) >= (t.dayOfDeath ?? 0)).length <= 8),
        // §1.1 (audit): 'Nobody's Ally' tested the same record with
        // `=== false` on a field that is only ever set `true`, so it could not
        // fire; it was a broken duplicate of this entry and is gone. Its
        // near-miss lives on here, corrected.
        nearMiss: (_s, v) => (v && v.metAnybodyAfterBloodbath === true && v.allianceId === undefined && v.kills === 0)
            ? `${v.name} never allied and never killed, but the arena still put them in front of somebody after the bloodbath`
            : undefined,
    },
    // §11.2/§11.3 (audit): oddity had two entries and games six — the two
    // categories that reward watching a whole run, smallest by a factor of
    // ten. Every entry below reads state that already exists; nothing here
    // needed new simulation. Rarities were set from a first measurement and
    // are re-derived by test:achievements.
    {
        id: 'rooted',
        name: 'Rooted',
        hint: 'Crown a victor who never set foot outside the zone they started in.',
        category: 'oddity',
        rarity: 'possible',
        test: (s, v) => !!v && !v.isCareer
            && (v.visitedZones?.length ?? 0) === 1
            && v.visitedZones?.[0] === s.arena.zones[0]?.name,
        nearMiss: (s, v) => (v && !v.isCareer && (v.visitedZones?.length ?? 0) === 2 && v.visitedZones?.[0] === s.arena.zones[0]?.name)
            ? `${v.name} left the Cornucopia exactly once — Rooted stays put`
            : undefined,
    },
    {
        id: 'district-final',
        name: 'Two of a Kind',
        hint: 'See the last two tributes standing come from the same district.',
        category: 'oddity',
        rarity: 'rare',
        test: state => {
            const order = [...state.tributes].sort((a, b) => lastDay(b) - lastDay(a));
            return order.length >= 2 && state.tributes.some(t => t.status === 'dead')
                && order[0].district === order[1].district && lastDay(order[1]) > 1;
        },
        nearMiss: state => {
            const order = [...state.tributes].sort((a, b) => lastDay(b) - lastDay(a));
            return order.length >= 3 && order[0].district !== order[1].district && order[0].district === order[2].district
                ? `District ${order[0].district} had two of the last three standing — Two of a Kind wants the last two`
                : undefined;
        },
    },
    {
        id: 'careers-early',
        name: 'The Pack Broke Early',
        hint: 'See every Career dead before day three.',
        category: 'games',
        rarity: 'legendary',
        test: state => {
            const careers = state.tributes.filter(t => t.isCareer);
            return careers.length >= 2 && careers.every(t => t.status === 'dead' && (t.dayOfDeath ?? 99) < 3);
        },
        nearMiss: state => {
            const careers = state.tributes.filter(t => t.isCareer);
            const late = careers.filter(t => !(t.status === 'dead' && (t.dayOfDeath ?? 99) < 3));
            return careers.length >= 2 && late.length === 1
                ? `every Career but ${late[0].name} was dead before day three`
                : undefined;
        },
    },
    {
        id: 'grand-tour',
        name: 'Every Square',
        hint: 'See every zone of the arena stood in by somebody before the Games end.',
        category: 'games',
        rarity: 'rare',
        test: state => {
            const visited = new Set(state.tributes.flatMap(t => t.visitedZones ?? []));
            return state.arena.zones.length >= 6 && state.arena.zones.every(z => visited.has(z.name));
        },
        nearMiss: state => {
            const visited = new Set(state.tributes.flatMap(t => t.visitedZones ?? []));
            const missing = state.arena.zones.filter(z => !visited.has(z.name));
            return missing.length === 1 ? `nobody ever stood in ${missing[0].name} — every other zone was walked` : undefined;
        },
    },
    {
        id: 'no-feast',
        name: 'Nobody Was Invited',
        hint: 'See a Games of seven days or more end without the Gamemakers ever calling a feast.',
        category: 'games',
        rarity: 'legendary',
        test: state => state.config.enableFeast === true && (state.feastsHeld ?? 0) === 0 && state.day >= 7,
        nearMiss: state => state.config.enableFeast === true && (state.feastsHeld ?? 0) === 0 && state.day === 6
            ? 'no feast was ever called, but the Games ended on day six — Nobody Was Invited runs to seven'
            : undefined,
    },
    {
        id: 'quiet-booth',
        name: 'Hands Off',
        hint: 'As Gamemaker, crown a victor without pulling a single lever.',
        category: 'games',
        rarity: 'rare',
        test: (state, v) => !!v && state.gamemakerMode === true
            && Object.values(state.gamemakerUse ?? {}).every(u => (u?.uses ?? 0) === 0),
    },
    {
        id: 'halved',
        name: 'Halved',
        hint: 'See a field of ten or more lose half its number in a single day after the bloodbath.',
        category: 'games',
        rarity: 'rare',
        test: state => {
            const total = state.tributes.length;
            const byDay: Record<number, number> = {};
            state.tributes.forEach(t => {
                if (t.status === 'dead' && !t.diedInBloodbath && t.dayOfDeath !== undefined) byDay[t.dayOfDeath] = (byDay[t.dayOfDeath] ?? 0) + 1;
            });
            const bloodbath = state.tributes.filter(t => t.diedInBloodbath).length;
            return Object.entries(byDay).some(([day, dead]) => {
                const aliveAtDawn = total - bloodbath - state.tributes.filter(t =>
                    t.status === 'dead' && !t.diedInBloodbath && (t.dayOfDeath ?? 99) < Number(day)).length;
                return aliveAtDawn >= 10 && dead * 2 >= aliveAtDawn;
            });
        },
        nearMiss: state => {
            const total = state.tributes.length;
            const bloodbath = state.tributes.filter(t => t.diedInBloodbath).length;
            const byDay: Record<number, number> = {};
            state.tributes.forEach(t => {
                if (t.status === 'dead' && !t.diedInBloodbath && t.dayOfDeath !== undefined) byDay[t.dayOfDeath] = (byDay[t.dayOfDeath] ?? 0) + 1;
            });
            const close = Object.entries(byDay).find(([day, dead]) => {
                const aliveAtDawn = total - bloodbath - state.tributes.filter(t =>
                    t.status === 'dead' && !t.diedInBloodbath && (t.dayOfDeath ?? 99) < Number(day)).length;
                return aliveAtDawn >= 10 && dead * 2 === aliveAtDawn - 2;
            });
            return close ? `day ${close[0]} took ${close[1]} of a field of ten or more — one short of halving it` : undefined;
        },
    },
    {
        id: 'every-district-bleeds',
        name: 'Every District Bleeds',
        hint: 'See every district lose at least one tribute on the first day.',
        category: 'games',
        rarity: 'possible',
        test: state => {
            const districts = [...new Set(state.tributes.map(t => t.district))];
            return districts.length >= 6 && districts.every(d => state.tributes.some(t =>
                t.district === d && t.status === 'dead' && (t.diedInBloodbath || t.dayOfDeath === 1)));
        },
        nearMiss: state => {
            const districts = [...new Set(state.tributes.map(t => t.district))];
            const spared = districts.filter(d => !state.tributes.some(t =>
                t.district === d && t.status === 'dead' && (t.diedInBloodbath || t.dayOfDeath === 1)));
            return districts.length >= 6 && spared.length === 1
                ? `every district but ${spared[0]} lost somebody on day one`
                : undefined;
        },
    },
    {
        id: 'walking-wounded',
        name: 'Walking Wounded',
        hint: 'Crown a victor carrying five or more separate injuries.',
        category: 'survival',
        rarity: 'possible',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'crown-limping'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && Object.values(v.injuries).filter(Boolean).length >= 5,
        nearMiss: (_s, v) => (v && Object.values(v.injuries).filter(Boolean).length === 2)
            ? `${v.name} was crowned carrying two injuries — Walking Wounded carries three`
            : undefined,
    },
    {
        id: 'rumour-mill',
        name: 'Rumour Mill',
        hint: 'See three or more rumours still in circulation when the Games end.',
        category: 'social',
        // AUDIT-7: measured at 0.4% across 500 runs, so no longer 'possible?'.
        rarity: 'legendary',
        test: state => (state.rumours?.length ?? 0) >= 3,
        nearMiss: state => (state.rumours?.length ?? 0) === 2
            ? 'two rumours were still going round at the end — Rumour Mill wants three'
            : undefined,
    },
    {
        id: 'treaty-year',
        name: 'The Treaty Year',
        hint: 'See a treaty between two alliances run its whole term without either side breaking it.',
        category: 'social',
        rarity: 'common',
        // Audit 3 §4.7: this asked the live `blocTreaties` array for a treaty
        // "still standing when the Games end". Every ending a treaty can have
        // removes it from that array, and at the end of a run there is one
        // tribute alive and no blocs at all — so the array is always empty and
        // this never fired once in 132 runs. What the name is actually about is
        // a treaty nobody broke, which is now recorded where it happens.
        test: state => state.blocTreatyHeld === true,
        nearMiss: state => (state.blocTreatyBroken && !state.blocTreatyHeld
            ? 'Two groups swore an agreement this year and somebody killed across it'
            : undefined),
    },
    {
        id: 'named-blade',
        name: 'Five Times Blooded',
        hint: 'Crown a victor carrying a weapon that has taken five lives.',
        category: 'combat',
        rarity: 'legendary',
        // AUDIT-8 §1.4: re-gated to a harder rung of the same ladder rather
        // than deleted, so an id already in a player's record keeps resolving.
        // The weapon-naming layer it used to also require is gone; the blood
        // the object carries was always the half that meant anything.
        test: (_s, v) => !!v && v.inventory.some(i => (i.bloodDrawn ?? 0) >= 5),
        nearMiss: (_s, v) => {
            const best = Math.max(0, ...(v?.inventory ?? []).map(i => i.bloodDrawn ?? 0));
            return best >= 3 && best < 5 ? `the weapon had taken ${best} of the five` : undefined;
        },
    },
    {
        id: 'strange-year',
        name: 'A Strange Year',
        hint: 'See a Games in which two or more once-only arena events fired.',
        category: 'oddity',
        rarity: 'rare',
        test: state => (state.firedEvents?.length ?? 0) >= 2,
        nearMiss: state => (state.firedEvents?.length ?? 0) === 1 ? 'one once-only event fired — a Strange Year has two' : undefined,
    },
    {
        id: 'sky-of-cannons',
        name: 'Nothing but Sky',
        hint: 'See a Games where two of every three deaths were the arena\'s, not another tribute\'s.',
        category: 'oddity',
        rarity: 'possible',
        test: state => {
            const dead = state.tributes.filter(t => t.status === 'dead');
            const byHand = dead.filter(t => deathCodeOf(t) === 'tribute').length;
            return dead.length >= 8 && byHand * 3 <= dead.length;
        },
        nearMiss: state => {
            const dead = state.tributes.filter(t => t.status === 'dead');
            const byHand = dead.filter(t => deathCodeOf(t) === 'tribute').length;
            return dead.length >= 8 && byHand * 3 > dead.length && byHand * 2 < dead.length
                ? 'more died to the arena than to each other — Nothing but Sky wants two in three'
                : undefined;
        },
    },
    {
        id: 'long-truce',
        name: 'The Long Truce',
        hint: 'Crown a victor whose truce was renewed twice with the same tribute.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.truceRenewed ?? {}).some(n => n >= 2),
        nearMiss: (_s, v) => (v && Object.values(v.truceRenewed ?? {}).some(n => n === 1))
            ? `${v.name} renewed a truce once — the Long Truce renews it twice`
            : undefined,
    },

    /* ---------------------------------------------------------------------- */
    /* Audit 3 §11.2/§11.3: the thin shelves                                   */
    /*                                                                        */
    /* `reaping` carried 9 entries and `oddity` 10, against `social`'s 46 —    */
    /* and the reaping is the phase with the strongest existing state and the  */
    /* fewest achievements attached to it: volunteering, district, legacy      */
    /* tier, mentor, cast shape, Quell rules, training score, fan favourite,   */
    /* interview persona. Every entry below reads a field that already exists, */
    /* so none of them needed engine work; several give an existing field its  */
    /* first reader, which is the other half of the point.                     */
    /* ---------------------------------------------------------------------- */
    {
        id: 'forgotten-district-crowns-one',
        name: 'Somebody Remembers Now',
        hint: 'Crown a victor from a forgotten-tier district who never took a life.',
        category: 'reaping',
        rarity: 'legendary',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'homecoming'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && legacyOf(v.district).tier === 'forgotten' && v.kills === 0,
        nearMiss: (state, v) => {
            if (!v || legacyOf(v.district).tier === 'forgotten') return undefined;
            const forgotten = state.tributes.filter(t => legacyOf(t.district).tier === 'forgotten');
            const lasted = forgotten.filter(t => t.status === 'dead').sort((a, b) => (b.daysSurvived) - (a.daysSurvived))[0];
            return lasted ? `${lasted.name} carried a forgotten district to day ${lasted.daysSurvived}` : undefined;
        },
    },
    {
        id: 'outscored-the-careers',
        name: 'Out of Nowhere',
        hint: 'See a tribute from outside the Career districts post the highest training score in the field.',
        category: 'reaping',
        rarity: 'rare',
        test: state => {
            const best = Math.max(0, ...state.tributes.map(t => t.trainingScore));
            const top = state.tributes.filter(t => t.trainingScore === best);
            return best > 0 && top.length > 0 && top.every(t => !t.isCareer);
        },
        nearMiss: state => {
            const best = Math.max(0, ...state.tributes.map(t => t.trainingScore));
            const bestOuter = Math.max(0, ...state.tributes.filter(t => !t.isCareer).map(t => t.trainingScore));
            return bestOuter > 0 && bestOuter === best - 1
                ? `the best score outside the Career districts was ${bestOuter}, one behind the board`
                : undefined;
        },
    },
    {
        id: 'nobodys-favourite',
        name: "Nobody's Favourite",
        hint: 'Crown a victor the crowd never took to — no fan favourite, and a reputation in the bottom half of the field.',
        category: 'reaping',
        rarity: 'common',
        test: (state, v) => {
            if (!v || v.fanFavourite) return false;
            const reps = state.tributes.map(t => t.reputation).sort((a, b) => a - b);
            const median = reps[Math.floor(reps.length / 2)] ?? 0;
            return v.reputation < median;
        },
        nearMiss: (_s, v) => (v?.fanFavourite ? `${v.name} was a favourite before the gong. This is for the ones nobody picked.` : undefined),
    },
    {
        id: 'the-mentor-was-wrong',
        name: 'The Mentor Was Wrong',
        hint: 'Crown a victor whose mentor held back a gift they asked for.',
        category: 'capitol',
        rarity: 'rare',
        // Gives `mentorWithheld` — written on 806 of 1,641 state-samples — its
        // first reader outside the feed.
        test: (state, v) => !!v && (state.mentorWithheld?.[v.id] ?? 0) > 0,
        nearMiss: (state, v) => {
            const withheld = Object.keys(state.mentorWithheld ?? {}).length;
            return v && !(state.mentorWithheld?.[v.id]) && withheld > 0
                ? `${withheld} tribute${withheld === 1 ? ' was' : 's were'} turned down by their mentor this year. None of them won.`
                : undefined;
        },
    },
    {
        id: 'made-them-blink',
        name: 'Made Them Blink',
        hint: 'Crown a victor who lived through a Gamemaker set piece aimed at the field.',
        category: 'capitol',
        rarity: 'common',
        // `gamemakerSignatureFired` is true in 118 of 132 runs and nothing
        // scored surviving it.
        test: (state, v) => !!v && state.gamemakerSignatureFired === true,
        nearMiss: state => (state.gamemakerSignatureFired !== true
            ? 'the Gamemakers never had to intervene this year — which is its own kind of Games'
            : undefined),
    },
    {
        id: 'two-laws-one-crown',
        name: 'Two Laws, One Crown',
        hint: 'Crown a victor in an arena running two or more standing laws at once.',
        category: 'arena',
        rarity: 'rare',
        test: (state, v) => !!v && ((state.arena.laws?.length ?? (state.arena.law ? 1 : 0)) >= 2),
        nearMiss: state => ((state.arena.laws?.length ?? (state.arena.law ? 1 : 0)) === 1
            ? `${state.arena.name} ran one standing law this year. Some arenas run two.`
            : undefined),
    },
    {
        id: 'outlived-the-map',
        name: 'Outlived the Map',
        /*
         * AUDIT-6 §11.4: fired on 85.6% of runs. One collapsed sector in a
         * victor's itinerary is not a fact about the victor — the arena closes
         * sectors on a schedule and the victor walks the arena. Two is a
         * tribute who kept choosing ground that went on to fail.
         */
        hint: 'Crown a victor who stood in two sectors that later came down.',
        category: 'arena',
        rarity: 'common',
        test: (state, v) => !!v && (state.collapsedZones ?? []).filter(z => (v.visitedZones ?? []).includes(z)).length >= 2,
        nearMiss: state => ((state.collapsedZones ?? []).length > 0
            ? `${(state.collapsedZones ?? []).length} sector${(state.collapsedZones ?? []).length === 1 ? '' : 's'} came down this year, and the victor had never set foot in any of them`
            : undefined),
    },
    {
        id: 'the-heir',
        name: 'The Heir',
        hint: 'Crown a victor who inherited an alliance and never once went back on anybody.',
        category: 'social',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'heir-apparent'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && v.succeededAsHeir === true && (v.betrayalsCommitted ?? 0) === 0 && (v.faithBroken ?? 0) === 0,
        nearMiss: (state, v) => {
            const heirs = state.tributes.filter(t => t.succeededAsHeir).length;
            return v && !v.succeededAsHeir && heirs > 0
                ? `${heirs} tribute${heirs === 1 ? ' took' : 's took'} over a dead leader's group this year and none of them finished it`
                : undefined;
        },
    },
    {
        id: 'bought-the-peace',
        name: 'Bought the Peace',
        hint: 'Crown a victor who extorted a truce out of somebody and kept it.',
        category: 'social',
        rarity: 'legendary',
        test: (_s, v) => !!v && Object.values(v.truceReason ?? {}).includes('extortion'),
        nearMiss: (_s, v) => (v && Object.keys(v.truces ?? {}).length > 0
            ? `${v.name} held a truce, but nobody paid for it`
            : undefined),
    },
    {
        id: 'nobody-died-today',
        name: 'Nobody Died Today',
        hint: 'See a full day and night pass with no cannon at all while eight or more tributes are still alive.',
        category: 'oddity',
        rarity: 'common',
        // The field-size clause is what makes this worth naming. Without it the
        // entry fired in 80% of runs, because the back half of a Games is three
        // people avoiding each other; a quiet day with the field still crowded
        // is the Capitol's actual nightmare.
        test: state => {
            const fatal = new Set(state.tributes.filter(t => t.status === 'dead' && t.dayOfDeath !== undefined).map(t => t.dayOfDeath));
            for (let d = 1; d < state.day; d++) {
                if (fatal.has(d)) continue;
                const aliveThen = state.tributes.filter(t => t.status === 'alive' || (t.dayOfDeath ?? 0) > d).length;
                // AUDIT-6 §11.4: six was still two thirds of runs. Eight is a
                // crowded arena that nonetheless produced nothing.
                if (aliveThen >= 8) return true;
            }
            return false;
        },
        nearMiss: state => {
            const fatal = new Set(state.tributes.filter(t => t.status === 'dead' && t.dayOfDeath !== undefined).map(t => t.dayOfDeath));
            let best = 0;
            for (let d = 1; d < state.day; d++) {
                if (fatal.has(d)) continue;
                best = Math.max(best, state.tributes.filter(t => t.status === 'alive' || (t.dayOfDeath ?? 0) > d).length);
            }
            return best > 0 && best < 6
                ? `the quietest day of these Games had ${best} still alive — this wants six`
                : undefined;
        },
    },
    {
        id: 'the-short-week',
        name: 'The Short Week',
        hint: 'See a Games finish on the third day or sooner. A small field or a compressed calendar is the honest route.',
        category: 'oddity',
        rarity: 'possible',
        // Audit 5 §1.8: 0 of 400 default-config runs end by day 3. Only
        // advertised where the calendar makes it reachable.
        availableIn: state => state.config.districtCount <= 4
            || ['compressed', 'blitz'].includes(state.gamesProfile?.temperament.id ?? ''),
        test: state => state.day <= 3 && state.tributes.some(t => t.status === 'alive'),
        nearMiss: state => (state.day === 4 ? 'these Games ran four days — the Short Week is three' : undefined),
    },
    {
        id: 'never-left-the-horn',
        name: 'Never Left the Horn',
        hint: 'Crown a victor who only ever stood in one sector of the arena.',
        category: 'oddity',
        // AUDIT-7: observed across 500 runs, so no longer 'possible?' — the label
        // means the simulation is believed able to do this and no measured run
        // ever has, and a measured run now has.
        rarity: 'possible',
        test: (_s, v) => !!v && (v.visitedZones?.length ?? 0) === 1,
        nearMiss: (_s, v) => {
            const n = v?.visitedZones?.length ?? 0;
            return n === 2 ? `${v!.name} set foot in two sectors all run — one more than this asks for` : undefined;
        },
    },
    /*
     * Audit 4 §11.3: twenty-two entries against the categories that were
     * starved and the state that had no reader.
     *
     * The table was 48 social against 12 reaping and 12 games, so it read as
     * an alliance game; and several of the systems this fix pass touched —
     * garrisons, `irradiated` ground, hidden edges, the sanity bands, quirks —
     * had just become reachable with nothing rewarding them. Every threshold
     * below is quoted against a measurement in AUDIT-4.md or in this pass, and
     * `check-achievements` fails on any that sits above the ceiling 500 runs
     * can produce.
     */
    // ---- arena: the ground itself, which the category under-used ----------
    // ---- the five building arenas: one earned through each signature -------
    {
        id: 'played-to-the-house',
        name: 'Played to the House',
        hint: 'Win the Gallery after Open Mic has played the room you were standing in to the whole arena.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'gallery'
            && state.log.some(e => e.text.startsWith('OPEN MIC') && e.tributesInvolved.includes(v.id)),
        nearMiss: (state, v) => (v && state.arena.id === 'gallery' && state.log.some(e => e.text.startsWith('OPEN MIC'))
            ? 'The house played a room — just never the one you were in'
            : undefined),
        availableIn: state => state.arena.id === 'gallery',
    },
    {
        id: 'no-naked-flame',
        name: 'No Naked Flame',
        hint: 'Win the Malt House after the vapour has gone up at least once.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'malthouse'
            && state.log.some(e => e.text.startsWith('VAPOUR IGNITES')),
        nearMiss: (state, v) => (v && state.arena.id === 'malthouse' && state.log.some(e => e.text.startsWith('VAPOUR RISES'))
            ? 'The vapour rose, and the Malt House never lit it'
            : undefined),
        availableIn: state => state.arena.id === 'malthouse',
    },
    {
        id: 'took-the-pace-car',
        name: 'Under Yellow',
        hint: 'Win Circuit Row after the pace car has come through a sector with you standing on it.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'circuit'
            && state.log.some(e => e.text.startsWith('THE PACE CAR') && e.tributesInvolved.includes(v.id)),
        nearMiss: (state, v) => (v && state.arena.id === 'circuit'
            ? 'You won Circuit Row without ever meeting the pace car'
            : undefined),
        availableIn: state => state.arena.id === 'circuit',
    },
    {
        id: 'did-the-time',
        name: 'Did the Time',
        hint: 'Win the Ward Block after being sealed inside a block by a lockdown.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'wardblock'
            && state.log.some(e => e.text.startsWith('LOCKDOWN') && e.tributesInvolved.includes(v.id)),
        nearMiss: (state, v) => (v && state.arena.id === 'wardblock' && state.log.some(e => e.text.startsWith('LOCKDOWN'))
            ? 'The doors sealed, but never with you inside'
            : undefined),
        availableIn: state => state.arena.id === 'wardblock',
    },
    {
        id: 'last-roof-standing',
        name: 'Last Roof Standing',
        hint: 'Win the Glasshouse after at least two of its wings have given.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'glasshouse'
            && state.log.filter(e => e.text.startsWith('THE GLASS GIVES')).length >= 2,
        nearMiss: (state, v) => {
            if (!v || state.arena.id !== 'glasshouse') return undefined;
            const given = state.log.filter(e => e.text.startsWith('THE GLASS GIVES')).length;
            return given === 1 ? 'One wing gave — the crown came before the second' : undefined;
        },
        availableIn: state => state.arena.id === 'glasshouse',
    },
    {
        id: 'held-the-pass',
        name: 'The Toll',
        hint: 'Crown a victor whose alliance held a contested crossing.',
        category: 'arena',
        rarity: 'rare',
        // Audit 4 §1.1: `contested` existed on one edge in forty arenas and
        // garrisons were claimed zero times in 160 runs. There are twenty now,
        // and a garrison forms in ~19% of runs.
        // §25 (requests): read the historical record, not the live map.
        // `garrisonedEdges` is cleared the moment the holders move off the
        // ground, and by the end of a run — which is when achievements are
        // evaluated — the field is down to one or two people and nobody is
        // standing on a pass. So this asked "is a garrison up right now?" and
        // the honest answer at that moment is always no. Measured: garrisons
        // form in roughly one run in ten and this unlocked in none of 500.
        test: state => (state.garrisonsFormed ?? []).length > 0
            || Object.keys(state.garrisonedEdges ?? {}).length > 0,
        nearMiss: state => ((state.garrisonsFormed ?? []).length > 0
            ? undefined
            : Object.values(state.alliances ?? {}).length > 0
                ? 'an alliance stood, but never dug in on a crossing'
                : undefined),
    },
    {
        id: 'the-bridge-behind',
        name: 'The Bridge Behind Them',
        hint: 'See a crossing spend the last of itself and go.',
        category: 'arena',
        rarity: 'rare',
        // Audit 4 §1.1: `countCrossing` is the only writer of `edgeCrossings`
        // and measured 0.0 per run before twelve collapsing edges existed.
        test: state => Object.values(state.edgeCrossings ?? {}).some(n => n >= 3),
        nearMiss: state => (Object.values(state.edgeCrossings ?? {}).some(n => n > 0)
            ? 'a crossing was spending itself, and the Games ended before it went'
            : undefined),
    },
    {
        id: 'the-unmapped-way',
        name: 'The Unmapped Way',
        hint: 'Crown a victor who found a way through the arena that was not on any plan.',
        category: 'arena',
        rarity: 'rare',
        // Audit 4 §1.1: `hidden` was two edges in forty arenas; it is fourteen.
        test: (_s, v) => (v?.knownEdges?.length ?? 0) > 0,
    },
    {
        id: 'the-ground-turned',
        name: 'The Ground Turned',
        hint: 'Crown a victor who was standing in a zone when it went bad.',
        category: 'arena',
        rarity: 'common',
        // `walkedIntoEffect` was tracked per tribute and read by one entry.
        test: (_s, v) => (v?.walkedIntoEffect ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.walkedIntoEffect ?? 0) === 1
            ? `${v!.name} was caught in one zone going bad — one short`
            : undefined),
    },
    {
        id: 'whatever-is-loose',
        name: 'Whatever They Let Loose',
        hint: 'See ground the Gamemakers ruin permanently, and that spreads.',
        category: 'arena',
        rarity: 'rare',
        // Audit 4 §1.8: `irradiated` fired zero times in 340 runs. It now
        // occurs in ~4% of them, late, on ground already spoiled.
        test: state => Object.values(state.zoneEffects ?? {})
            .some(list => list.some(e => e.kind === 'irradiated')),
    },
    // ---- games: the shape of the year, the second-smallest category -------
    {
        id: 'the-quiet-year',
        name: 'A Quiet Year',
        hint: 'See a Games with an ordinary temperament, no Quell and no unscheduled disruption.',
        category: 'games',
        rarity: 'rare',
        // 12.5% of runs draw `standard`, and most years take at least one
        // off-calendar beat, so the conjunction is the rare part.
        test: state => state.gamesProfile?.temperament?.id === 'standard'
            && state.gamesProfile?.quell === undefined
            && (state.extraWildcardsFired ?? 0) === 0,
    },
    {
        id: 'the-treacherous-year',
        name: 'The Treacherous Year',
        hint: 'See a Games the Capitol ran for the turning.',
        category: 'games',
        rarity: 'rare',
        // Audit 4 §9.1: nine temperaments, drawn 6-13% each — the best
        // distributed variety axis in the game, and no entry read any of them.
        test: state => state.gamesProfile?.temperament?.id === 'treacherous',
    },
    {
        id: 'the-lean-year',
        name: 'The Lean Year',
        hint: 'See a Games the Capitol did not pay for.',
        category: 'games',
        rarity: 'rare',
        test: state => state.gamesProfile?.temperament?.id === 'lean',
    },
    {
        id: 'the-attrition-year',
        name: 'The Long Attrition',
        hint: 'See a Games the Capitol meant to grind.',
        category: 'games',
        rarity: 'rare',
        test: state => state.gamesProfile?.temperament?.id === 'attrition',
    },
    {
        id: 'nobody-drowned',
        name: 'Nobody Drowned',
        hint: 'Run a long Games in an arena that is mostly water, and lose nobody to it.',
        category: 'games',
        rarity: 'legendary',
        // First draft measured 87.4%: "an arena with any water at all, and
        // nobody drowned" is nearly every Games. A third of the map under water
        // and a run long enough to have tested it is the thing worth marking.
        test: state => state.arena.zones.filter(z => z.terrain === 'water').length >= 3
            && state.day >= 8
            && !state.tributes.some(t => deathCodeOf(t) === 'drowning'),
        nearMiss: state => {
            const water = state.arena.zones.filter(z => z.terrain === 'water').length;
            if (water < 3) return undefined;
            const lost = state.tributes.filter(t => deathCodeOf(t) === 'drowning').length;
            if (lost > 0) return `${lost} went into the water in an arena mostly made of it`;
            return state.day >= 6 && state.day < 8
                ? `a water arena came through clean, and ended on day ${state.day} — too short to count`
                : undefined;
        },
    },
    // ---- reaping: the smallest category -----------------------------------
    {
        id: 'five-motives',
        name: 'Every Reason There Is',
        hint: 'Reap a field holding all five motives at once.',
        category: 'reaping',
        rarity: 'common',
        // Measured over 3,420 tributes: family 935, prove 747, escape 734,
        // honour 568, partner 436 — so a full house at the *reaping* is 85% of
        // twelve-district years, which is a fact about the generator. Holding
        // all five past the bloodbath is a fact about the run.
        test: state => new Set(state.tributes
            .filter(t => (t.daysSurvived ?? 0) >= 3)
            .map(t => t.motive).filter(Boolean)).size >= 5,
        nearMiss: state => {
            const n = new Set(state.tributes.filter(t => (t.daysSurvived ?? 0) >= 3).map(t => t.motive).filter(Boolean)).size;
            return n === 4 ? 'four of the five reasons made it past the bloodbath — one short' : undefined;
        },
    },
    {
        id: 'every-persona',
        name: 'Every Way To Sell It',
        hint: 'See every interview persona used in one Games.',
        category: 'reaping',
        rarity: 'possible',
        // §(requests 21): this hard-coded 13 and the roster is 18 now, so it
        // was asking for thirteen of eighteen and firing in a third of runs.
        // Read the table instead, and it cannot drift again.
        test: state => new Set(state.tributes.map(t => t.interviewStrategy).filter(Boolean)).size >= INTERVIEW_PERSONAS.length,
        nearMiss: state => {
            const n = new Set(state.tributes.map(t => t.interviewStrategy).filter(Boolean)).size;
            const total = INTERVIEW_PERSONAS.length;
            return n >= total - 2 && n < total ? `${n} of the ${total} personas were sold this year` : undefined;
        },
    },
    /*
     * AUDIT-9 stage D: twelve achievements from the audit's §10 table.
     *
     * The table's own rule is the filter: "these should unlock from structured
     * event records and retain a short evidence trail. Do not award a 'rescue'
     * merely because two tributes survived near each other." So every one of
     * these reads a field or an event type that a stage C system writes on
     * purpose — an obligation's resolution, a forecast that was averted, a
     * belief's confidence, a parachute's fate — and not prose or proximity.
     *
     * Ten of the twenty-two proposals are deliberately not taken: they need
     * mechanics this PR does not build (acoustic decoys, repairable passages,
     * inspectable false evidence, archived-manifest replay). An achievement
     * for a mechanic that does not exist is unearnable by construction, which
     * is the failure the audit warns about in the same paragraph.
     */
    {
        id: 'd-paid-in-person',
        name: 'Paid in Person',
        hint: 'Keep a supply promise by handing the goods over yourself.',
        category: 'social',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'obligation-kept'),
    },
    {
        id: 'd-terms-remembered',
        name: 'Terms Remembered',
        hint: 'Keep a promise made to somebody who is no longer alive to hold you to it.',
        category: 'social',
        rarity: 'rare',
        test: state => (state.obligations ?? []).some(o => o.status === 'kept'
            && state.tributes.some(t => t.id === o.owedToId && t.status !== 'alive')),
    },
    {
        id: 'd-a-warning-heeded',
        name: 'A Warning Heeded',
        hint: 'See a forecast hazard arrive and find the ground ready for it.',
        category: 'survival',
        rarity: 'rare',
        test: state => (state.hazardsAverted ?? 0) > 0,
    },
    {
        id: 'd-the-roof-held',
        name: 'The Roof Held',
        hint: 'Shore up a building that was about to come down, and have it hold.',
        category: 'survival',
        rarity: 'rare',
        /*
         * AUDIT-9 stage D: the structural case specifically. The first draft
         * asked for "a hazard averted and a hazard mitigated", which is the
         * same question `d-a-warning-heeded` asks — averting *requires*
         * mitigating — and the two unlocked on identical runs.
         */
        test: state => (state.avertedKinds ?? []).includes('quaking'),
    },
    {
        id: 'd-before-the-water-rose',
        name: 'Before the Water Rose',
        hint: 'Work against a hazard you were warned about before it landed.',
        category: 'survival',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'hazard-mitigated'),
    },
    {
        id: 'd-not-a-free-ride',
        name: 'Not a Free Ride',
        hint: 'Complete an escort you agreed to, with everybody accounted for.',
        category: 'social',
        rarity: 'legendary',
        test: state => (state.obligations ?? []).some(o => o.kind === 'escort' && o.status === 'kept'),
        nearMiss: state => ((state.obligations ?? []).some(o => o.kind === 'escort')
            ? 'An escort was promised, but nobody arrived together'
            : undefined),
    },
    {
        id: 'd-an-honest-word',
        name: 'An Honest Word',
        hint: 'Crown a victor who never broke a promise they made in the arena.',
        category: 'social',
        rarity: 'legendary',
        /*
         * AUDIT-9 stage D: a victor who kept a promise and broke none. Rare by
         * construction — most victors never make one — so it carries a
         * nearMiss, because the check is right that an entry nobody earns and
         * nobody is told about is a promise the game does not keep.
         */
        test: (state, v) => !!v
            && (state.obligations ?? []).some(o => o.owedById === v.id && o.status === 'kept')
            && !(state.obligations ?? []).some(o => o.owedById === v.id && o.status === 'broken'),
        nearMiss: (state, v) => {
            if (!v) return undefined;
            const mine = (state.obligations ?? []).filter(o => o.owedById === v.id);
            if (mine.length === 0) return undefined;
            const broken = mine.filter(o => o.status === 'broken').length;
            return broken > 0
                ? `${v.name} kept their word ${mine.filter(o => o.status === 'kept').length} time(s) and broke it ${broken}`
                : `${v.name} made ${mine.length} promise(s) and the week settled all of them before they could keep any`;
        },
    },
    {
        id: 'd-return-address',
        name: 'Return Address',
        hint: 'Have a parachute meant for somebody else come down where you are standing.',
        category: 'capitol',
        rarity: 'common',
        test: state => state.log.some(e => e.type === 'parachute-stolen'),
    },
    {
        id: 'd-carried-back',
        name: 'Carried Back',
        hint: 'Collect an ally\'s parachute and bring it to them.',
        category: 'social',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'parachute-collected'),
    },
    {
        id: 'd-something-in-the-water',
        name: 'Something in the Water',
        hint: 'See a tribute felled by water they drank days earlier.',
        category: 'survival',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'waterborne-illness'),
    },
    {
        id: 'd-the-long-way-was-right',
        name: 'The Long Way Was Right',
        hint: 'Crown a victor who worked against a hazard and outlived the ones who did not.',
        category: 'survival',
        rarity: 'rare',
        test: (state, v) => !!v && state.log.some(e =>
            e.type === 'hazard-mitigated' && e.tributesInvolved.includes(v.id)),
    },
    {
        id: 'd-nobody-owed-anybody',
        name: 'Nobody Owed Anybody',
        hint: 'Finish a Games in which every promise anybody made was kept or honestly overtaken.',
        category: 'games',
        rarity: 'rare',
        test: state => (state.obligations ?? []).length > 0
            && !(state.obligations ?? []).some(o => o.status === 'broken'),
    },
    {
        id: 'the-kin-pair',
        name: 'Home in Their Place',
        hint: 'Crown a victor who volunteered to take a sibling\'s place.',
        category: 'reaping',
        rarity: 'rare',
        // §(requests): the cousin pairing is gone from the generator; the
        // sibling volunteer is the one family story the reaping still tells.
        test: (_s, v) => !!v?.volunteered && /\bsibling\b/i.test(v?.reapingNote ?? ''),
    },
    {
        id: 'quirked',
        name: 'Two Habits and a Token',
        hint: 'Crown a victor the cameras had two habits and a keepsake on.',
        category: 'reaping',
        rarity: 'rare',
        // Audit 4 §6.3: quirks do something now, so counting them is counting
        // a build rather than a flourish.
        test: (_s, v) => !!v && (v.quirks?.length ?? 0) >= 2 && !!v.token,
        nearMiss: (_s, v) => {
            if (!v) return undefined;
            const n = v.quirks?.length ?? 0;
            if (n >= 2 && !v.token) return `${v.name} had both habits and nothing from home`;
            return n === 1 && v.token ? `${v.name} had the keepsake and only one habit — one short` : undefined;
        },
    },
    // ---- survival: the sanity bands, which nothing read -------------------
    {
        id: 'never-frayed',
        name: 'Never Frayed',
        hint: 'Crown a victor who never once came apart.',
        category: 'survival',
        rarity: 'rare',
        // Audit 4 §3.2: `sanityScarred` fell 49.8% -> 26.9% of the cast and
        // the floor band from 33% to 13% of tribute-time, so a victor who
        // never reached it is now a real and rare thing rather than an
        // impossible one.
        test: (_s, v) => !!v && !v.sanityScarred && (v.minResolve ?? 100) > 0,
    },
    {
        id: 'four-skills',
        name: 'Competent At Everything',
        hint: 'Crown a victor who ended with four skills at three or better.',
        category: 'survival',
        rarity: 'common',
        // Measured means run 1.06-2.29 against a cap of 6, so four at 3+ is
        // the top of the distribution rather than past it.
        test: (_s, v) => Object.values(v?.proficiencies ?? {}).filter(n => n >= 3).length >= 4,
        nearMiss: (_s, v) => {
            const n = Object.values(v?.proficiencies ?? {}).filter(x => x >= 3).length;
            return n === 3 ? `${v!.name} ended with three skills at three or better — one short` : undefined;
        },
    },
    {
        id: 'scarred-and-standing',
        /*
         * AUDIT-9 batch 4: `one-wound` is retired into this, and it is B03's
         * defect a third time.
         *
         * That card asked for a victor with *exactly* one scar; this one asks
         * for *at least* one. The comment below is the proof they were the
         * same question all along — two scars on a victor measured 0 across
         * 400 runs — and the behavioural check confirmed it, finding them
         * unlocked on exactly the same runs across the whole 500-run sample.
         *
         * Same treatment as B03: one idea, one card, and
         * `RETIRED_ACHIEVEMENT_IDS` carries anybody who earned the other one
         * onto this. The surviving name is the better of the two; the
         * surviving predicate is the one that does not depend on a
         * distinction the engine never produces.
         */
        name: 'Scarred And Standing',
        hint: 'Crown a victor carrying an old wound that never closed properly.',
        category: 'survival',
        rarity: 'rare',
        // Audit 5 §1.7: two scars on a victor measured 0 in 400 runs, and 6
        // tributes of 9,600 ever carried two. One scar on the winner is 5 of
        // 389 victors — the legendary it was always going to be.
        test: (_s, v) => Object.values(v?.scars ?? {}).filter(Boolean).length >= 1,
        nearMiss: (_s, v) => {
            if (!v) return undefined;
            const grades = Object.values(v.injurySeverity ?? {}).filter((g): g is number => typeof g === 'number');
            return grades.some(g => g >= 1) ? `${v.name} came out marked, but every wound closed` : undefined;
        },
    },
    // ---- oddity: runs that were strange rather than good ------------------
    {
        id: 'alone-the-whole-way',
        name: 'Alone The Whole Way',
        hint: 'Crown a victor who never once shared a camp.',
        category: 'oddity',
        rarity: 'legendary',
        test: (_s, v) => !!v && !v.allianceId && (v.formerAllies?.length ?? 0) === 0
            && (v.memory?.stoodBy?.length ?? 0) === 0,
    },
    {
        id: 'stayed-put',
        name: 'Stayed Put',
        hint: 'Crown a victor who stood in two sectors and no more.',
        category: 'oddity',
        rarity: 'rare',
        // Audit 4 §3.3: tributes move in 28.6% of cycles and a victor covers
        // 38% of the map at the mean, so two zones is the far tail without
        // being the one-zone lottery `never-left-the-horn` already is.
        test: (_s, v) => (v?.visitedZones?.length ?? 0) === 2,
    },
    {
        id: 'down-and-up',
        name: 'Down And Up',
        hint: 'Crown a victor who was carried out of the dirt and later did the carrying.',
        category: 'oddity',
        rarity: 'legendary',
        // Audit 4 §2.1: `downed` is 1.5% of tribute-cycles with 137 rescues
        // per 160 runs; the rescued victor is the narrow part.
        // AUDIT-8 §1.4: unlocked on exactly the same runs as 'brought-back' across a
        // 500-run sample. Re-gated to a harder rung of the same ladder rather than
        // deleted, so an id already in a player's record keeps resolving.
        test: (_s, v) => !!v?.everDowned && !!v.revivedBy && (v.reachedDownedFirst ?? 0) >= 1,
        nearMiss: (_s, v) => {
            if (!v?.everDowned) return undefined;
            if (!v.revivedBy) return `${v.name} went down and got themselves back up`;
            return (v.reachedDownedFirst ?? 0) === 0
                ? 'somebody picked the victor up; the victor never picked anybody up'
                : undefined;
        },
    },
    // ---- capitol ----------------------------------------------------------
    {
        id: 'twelve-levers',
        name: 'Every Lever',
        hint: 'Use all twelve Gamemaker interventions in one Games.',
        category: 'capitol',
        rarity: 'possible',
        availableIn: state => state.gamemakerMode,
        // `gamemakerUse` records uses per type and was read by nothing.
        test: state => Object.keys(state.gamemakerUse ?? {}).length >= 12,
        nearMiss: state => {
            const n = Object.keys(state.gamemakerUse ?? {}).length;
            return state.gamemakerMode && n >= 8 && n < 12
                ? `${n} of the twelve levers were pulled this year`
                : undefined;
        },
    },
    // ---- Audit 5 §11.5: keyed to state that already exists ----
    {
        id: 'cartographers-apprentice',
        name: "Cartographer's Apprentice",
        // AUDIT-8 §1.4: this shared a byte-identical predicate with
        // 'cartographer' — the hint claimed the distinction ("any tribute, not
        // necessarily the victor") that the *other* entry's predicate already
        // made, so both said "somebody walked the whole map" and both always
        // flipped together. Re-gated to the half the pair was missing rather
        // than deleted, so no id already in a player's `unlocked` record stops
        // resolving: 'cartographer' is anybody walking every zone, this is the
        // victor having done it, which is a strictly harder and quite
        // different claim — the map-reader usually dies of the reading.
        hint: 'Crown a victor who personally stood in every zone the arena has.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => {
            if (!v) return false;
            const all = state.arena.zones.map(z => z.name);
            return all.every(z => (v.visitedZones ?? []).includes(z));
        },
        nearMiss: (state, v) => {
            const total = state.arena.zones.length;
            const walked = (v?.visitedZones ?? []).length;
            return walked >= total - 2 && walked < total
                ? `the victor walked ${walked} of ${total} sectors`
                : undefined;
        },
    },
    {
        id: 'full-table',
        name: 'Full Table',
        hint: 'See an alliance still standing at the end that named all four of its roles.',
        category: 'social',
        // AUDIT-7: observed across 500 runs, so no longer 'possible?' — the label
        // means the simulation is believed able to do this and no measured run
        // ever has, and a measured run now has.
        rarity: 'legendary',
        test: state => Object.values(state.alliances ?? {}).some(a => Object.values(a.roles ?? {}).filter(Boolean).length >= 4),
        nearMiss: state => {
            const best = Math.max(0, ...Object.values(state.alliances ?? {}).map(a => Object.values(a.roles ?? {}).filter(Boolean).length));
            return best === 3 ? 'a standing alliance named three of its four roles' : undefined;
        },
    },
    {
        id: 'under-two-suns',
        name: 'Under Two Laws',
        hint: 'Crown a victor in an arena that stacks two or more laws.',
        category: 'arena',
        rarity: 'common',
        test: (state, v) => !!v && ([...(state.arena.law ? [state.arena.law] : []), ...(state.arena.laws ?? [])].length >= 2),
        nearMiss: (state, v) => (!v && [...(state.arena.law ? [state.arena.law] : []), ...(state.arena.laws ?? [])].length >= 2 ? 'two laws were stacked, and nobody came out from under them' : undefined),
    },
    {
        id: 'the-long-week',
        name: 'The Long Week',
        hint: 'See a Games run past its fifteenth day.',
        category: 'games',
        rarity: 'rare',
        test: state => state.day >= 15,
        nearMiss: state => (state.day >= 13 && state.day < 15 ? `these Games ran ${state.day} days — the Long Week is fifteen` : undefined),
    },
    {
        id: 'the-youngest',
        name: 'The Youngest',
        hint: 'See the youngest tribute in the field win.',
        category: 'reaping',
        rarity: 'rare',
        test: (state, v) => !!v && state.tributes.every(t => t.age >= v.age),
    },
    {
        id: 'all-volunteers',
        name: 'Hands Up',
        hint: 'Crown a victor in a year where every tribute volunteered.',
        category: 'reaping',
        rarity: 'rare',
        test: (state, v) => !!v && state.gamesProfile?.castShape?.id === 'all-volunteer',
        availableIn: state => state.gamesProfile?.castShape?.id === 'all-volunteer',
    },
    {
        id: 'the-plain-year',
        name: 'The Quiet Year',
        hint: 'Finish a Games with no Quell, a standard temperament, an ordinary reaping, and not a single Gamemaker intervention.',
        category: 'capitol',
        rarity: 'rare',
        test: state => !state.gamesProfile?.quell
            && state.gamesProfile?.temperament.id === 'standard'
            && state.gamesProfile?.castShape?.id === 'ordinary'
            && Object.keys(state.gamemakerUse ?? {}).length === 0,
    },
    {
        id: 'the-whole-menagerie',
        name: 'The Whole Menagerie',
        hint: 'See every mutt in an arena\'s roster loosed in a single Games.',
        category: 'oddity',
        rarity: 'common',
        test: state => {
            /*
             * AUDIT-10 B3-03: `state.muttsSeen` is the run's bestiary — every
             * mutt somebody actually met, by name, written where the meeting
             * happens. This scanned the chronicle for the mutt's name as a
             * substring instead, which is both trimming-hostage and wrong for
             * any mutt whose name appears inside another's.
             */
            const roster = state.arena.mutts ?? [];
            if (roster.length < 2) return false;
            const met = new Set(state.muttsSeen ?? []);
            return roster.every(m => met.has(m));
        },
        nearMiss: state => {
            const roster = state.arena.mutts ?? [];
            const met = new Set(state.muttsSeen ?? []);
            const seen = roster.filter(m => met.has(m)).length;
            return roster.length >= 2 && seen === roster.length - 1 ? `${seen} of the arena's ${roster.length} mutts were loosed — one never left its pen` : undefined;
        },
    },
    {
        id: 'even-field',
        name: 'Even Field',
        hint: 'See a bloodbath that takes exactly one tribute from every district that lost anybody.',
        category: 'games',
        rarity: 'rare',
        test: state => {
            const lost = new Map<number, number>();
            // AUDIT-6 §11.4: this read `dayOfDeath === 0`, which nothing ever
            // writes — the bloodbath stamps day 1 — so 'Even Field' could not
            // fire, exactly the bug the comment two hundred lines up describes
            // having already been fixed once elsewhere.
            state.tributes.filter(t => t.diedInBloodbath).forEach(t => lost.set(t.district, (lost.get(t.district) ?? 0) + 1));
            return lost.size >= 3 && [...lost.values()].every(n => n === 1);
        },
        nearMiss: state => {
            const lost = new Map<number, number>();
            state.tributes.filter(t => t.diedInBloodbath).forEach(t => lost.set(t.district, (lost.get(t.district) ?? 0) + 1));
            const doubles = [...lost.values()].filter(n => n > 1).length;
            return lost.size >= 3 && doubles === 1 ? 'one district lost both its tributes at the horn — every other loss was one apiece' : undefined;
        },
    },
    {
        id: 'never-slept-alone',
        name: 'Never Slept Alone',
        hint: 'Crown a victor who held an alliance role for at least eight cycles.',
        category: 'social',
        rarity: 'common',
        test: (_s, v) => !!v && (v.roleCycles ?? 0) >= 8,
        nearMiss: (_s, v) => (!!v && (v.roleCycles ?? 0) >= 5 && (v.roleCycles ?? 0) < 8 ? `${v.name} held a role for ${v.roleCycles} cycles — eight is the mark` : undefined),
    },
    {
        id: 'the-second-frost',
        name: 'The Second Frost',
        hint: 'Crown a victor who earned Frostbitten or Witness inside the arena.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && v.traits.some(trait => trait === 'Frostbitten' || trait === 'Witness'),
    },
    {
        /*
         * AUDIT-10 §12, "Who Really Cut It": *"Resolve a rope-cut accusation
         * using a recorded witness or item evidence, not global omniscience."*
         *
         * The first of the audit's 24 proposed achievements to ship, and it
         * shipped because it survived the screen the audit asks for rather
         * than because it was next on the list. Most of the 24 describe
         * mechanics the game does not have — an over-limit group load split
         * into legal trips, link capacity with a forecast closure, per-batch
         * contamination — and two more were killed by measurement: a rumour
         * publicly corrected needs `rumour.exposed`, which occurred in 0 of
         * 120 runs, and "Different Debts" needs two kept obligations, which
         * also never occurred.
         *
         * Rarity follows measured eligible opportunities, as the audit
         * requires: the contradiction this reads — a tribute holding both a
         * told killing and a first-hand one for the same victim — arises in
         * 17.5% of runs, and the correction itself fires in 20.8%. The
         * correction is the larger number because it *consumes* the
         * contradiction: the 17.5% counts only the pairs still sitting in
         * somebody's head at the end of a run, and this reads every one that
         * was put right along the way.
         *
         * The evidence is typed rather than parsed, so no rewording can move
         * it and log trimming cannot lose it.
         */
        id: 'mercy-withdrawn',
        name: 'Twice Was Too Many',
        hint: 'See a tribute kill somebody they had already let walk away once.',
        category: 'combat',
        rarity: 'rare',
        test: state => happened(state, 'mercy-withdrawn'),
    },
    {
        /*
         * AUDIT-10 §12 proposes "Receipt of Mercy": a tribute spared during an
         * execution opportunity later supplies treatment to that same person.
         * It cannot happen. Over 150 runs, sparings are abundant — 111 of
         * them, in 50.7% of runs — and treatment is common at 80% of runs, and
         * the conjunction occurred zero times, because sparing happens between
         * enemies and treatment between allies. The two systems never touch.
         *
         * The same measurement found the inverse happening 17 times: the
         * sparer meeting the spared again and finishing it, about one sparing
         * in seven. So this ships in place of the proposal, which is what the
         * audit means by "strengthen or replace a weak existing entry where
         * appropriate" — the spec was the weak entry, and the simulation had
         * the better beat in it all along.
         */
        id: 'who-really-cut-it',
        name: 'Who Really Cut It',
        hint: 'See a tribute overturn something they were told about a killing, because they saw it themselves.',
        category: 'social',
        rarity: 'rare',
        test: state => happened(state, 'accusation-corrected'),
    },
    {
        /*
         * §16: the reader for `grave-visited`. The milestone exists because a
         * mourner's walk has to survive log trimming to be worth recording at
         * all; a fact with a writer and no reader is the unused-knob failure
         * wearing different clothes.
         */
        id: 'the-returned',
        name: 'The Returned',
        hint: 'See a tribute walk back to the place somebody they cared about fell, and take nothing.',
        category: 'survival',
        rarity: 'rare',
        test: state => happened(state, 'grave-visited'),
    },
    {
        /** §16: the reader for `vantage-swept`. */
        id: 'the-high-ground',
        name: 'The High Ground',
        hint: 'See a tribute who has lost track of the field climb something to find it again.',
        category: 'survival',
        rarity: 'rare',
        test: state => happened(state, 'vantage-swept'),
    },
    {
        id: 'the-tended',
        name: 'Tended',
        hint: 'See an ally stop somebody\'s bleeding while standing over them.',
        category: 'survival',
        rarity: 'rare',
        test: state => happened(state, 'bleeding-stopped'),
    },
    {
        id: 'the-perimeter',
        name: 'The Perimeter',
        hint: 'See a pack post a patrol on its own ground.',
        category: 'social',
        rarity: 'rare',
        /*
          * AUDIT-10 B3-03: this matched three specific sentences out of the
          * patrol flavour pool. The pool exists so the line varies; every other
          * line in it was a patrol that did not count.
          */
        test: state => happened(state, 'patrol-posted'),
    },

    /* ======================================================================
     * AUDIT-6 §11.4: sixty more.
     *
     * The audit's complaint was not the count — 207 entries is plenty — but
     * the coverage. Whole systems had no entry at all: the four new
     * proficiencies, the six new archetypes, bloc treaties, the convergence
     * recap, garrisons, intel trading, the rumour layer. An achievement list
     * is a menu of things the simulation can do, and a mechanic nobody is
     * invited to go looking for may as well not exist.
     *
     * Every rarity below is regenerated by `npm run fix:rarity` from measured
     * rates, so the labels shipped here are measurements and not guesses.
     * ====================================================================== */

    // ---- reaping ----
    {
        id: 'the-warden',
        name: 'Held the Door',
        hint: 'Crown a Warden — the tribute who finds the one way through and stands in it.',
        category: 'reaping',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.archetype === 'warden',
    },
    {
        id: 'the-herald',
        name: 'Kept the Count',
        hint: 'Crown a Herald, who survives by being the person everyone would rather hear from than kill.',
        category: 'reaping',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.archetype === 'herald',
    },
    {
        id: 'the-penitent',
        name: 'Not By Their Hand',
        hint: 'Crown a Penitent — a tribute who came in having already decided what they would not do.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && v.archetype === 'penitent',
    },
    {
        id: 'the-forager',
        name: 'Fed the Arena',
        hint: 'Crown a Forager, who never needed anybody to die first.',
        category: 'reaping',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.archetype === 'forager',
    },
    {
        id: 'the-duellist',
        name: 'One of Us',
        hint: 'Crown a Duellist — a tribute who asked, out loud, for a straight fight.',
        category: 'reaping',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.archetype === 'duellist',
    },
    {
        id: 'the-broker',
        name: 'Everything Is Worth Something',
        hint: 'Crown a Broker, who would rather hold a favour than a knife.',
        category: 'reaping',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.archetype === 'broker',
    },
    {
        id: 'full-slate',
        name: 'Full Slate',
        hint: 'See a reaping where no two tributes in the field share an archetype.',
        category: 'reaping',
        rarity: 'rare',
        test: state => {
            const seen = state.tributes.map(t => t.archetype);
            return seen.length >= 8 && new Set(seen).size === seen.length;
        },
        nearMiss: state => {
            const seen = state.tributes.map(t => t.archetype);
            const dupes = seen.length - new Set(seen).size;
            return dupes > 0 && dupes <= 2
                ? `${dupes} archetype${dupes === 1 ? ' was' : 's were'} doubled up this year`
                : undefined;
        },
    },

    // ---- combat ----
    {
        id: 'never-opened-one',
        name: 'Never Opened One',
        hint: 'Crown a victor who never started a fight all run, and still came home with a kill.',
        category: 'combat',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.fightsOpened ?? 0) === 0 && v.kills > 0,
        nearMiss: (_s, v) => (v && (v.fightsOpened ?? 0) === 1
            ? `${v.name} opened exactly one fight all year`
            : undefined),
    },
    {
        id: 'five-finishes',
        name: 'The Closer',
        hint: 'Crown a victor who delivered five or more finishing blows.',
        category: 'combat',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.finishingBlows ?? 0) >= 5,
        nearMiss: (_s, v) => {
            const n = v?.finishingBlows ?? 0;
            return n === 3 || n === 4 ? `${v?.name} finished ${n} — five is the Closer` : undefined;
        },
    },
    {
        id: 'three-lives-one-edge',
        name: 'Three Lives, One Edge',
        // §11.4: weapons accumulate `bloodDrawn` and the record book only ever
        // asked whether one had a name, never what it had done.
        hint: 'See a single weapon take three lives in one Games.',
        category: 'combat',
        rarity: 'rare',
        test: state => state.tributes.some(t => t.inventory.some(i => (i.bloodDrawn ?? 0) >= 3)),
        nearMiss: state => {
            const best = Math.max(0, ...state.tributes.flatMap(t => t.inventory.map(i => i.bloodDrawn ?? 0)));
            return best === 2 ? 'one weapon took two this year — three earns it a name' : undefined;
        },
    },
    {
        id: 'back-from-down',
        name: 'Back From Down',
        hint: 'Crown a victor who was put on the ground and still finished with three kills.',
        category: 'combat',
        rarity: 'legendary',
        // AUDIT-8 §1.4: unlocked on exactly the same runs as 'brought-back' and 'down-and-up' across a
        // 500-run sample. Re-gated to a harder rung of the same ladder rather than
        // deleted, so an id already in a player's record keeps resolving.
        test: (_s, v) => !!v && v.everDowned === true && v.kills >= 3,
        nearMiss: (_s, v) => (v?.everDowned === true && v.kills > 0 && v.kills < 3
            ? `down once, and ${v.kills} taken afterwards of the three` : undefined),
    },
    {
        id: 'the-long-grudge',
        name: 'The Long Grudge',
        hint: 'Crown a victor who crossed paths with one other tribute eight separate times.',
        category: 'combat',
        rarity: 'common',
        /*
         * §11.4: four fired on 94% of runs, seven on 80% and eight — the
         * counter's own ceiling — still on 71%, because across a whole field
         * *some* pair always maxes it out. Asking it of the victor is the
         * question that discriminates: one specific tribute they could never
         * stop running into.
         */
        test: (_s, v) => !!v && Object.values(v.sharedHistory ?? {}).some(n => n >= 8),
        nearMiss: (_s, v) => {
            const best = Math.max(0, ...Object.values(v?.sharedHistory ?? {}));
            return best >= 5 && best < 8 ? `${v?.name} met one tribute ${best} times — eight is the Long Grudge` : undefined;
        },
    },
    {
        id: 'unarmed-all-year',
        name: 'Empty Handed',
        hint: 'Crown a victor who took a life without ever having picked up a weapon.',
        category: 'combat',
        // AUDIT-7: observed at 0.4% of 500 runs, so no longer 'possible?'.
        rarity: 'possible',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'nothing-but-hands'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && v.everCarriedWeapon !== true && v.kills >= 1,
        // §11.4: right on the edge of what the simulation produces, so the
        // near-miss carries the information the card cannot.
        nearMiss: state => {
            const bare = state.tributes.filter(t => t.everCarriedWeapon !== true).length;
            return bare > 0
                ? `${bare} tribute${bare === 1 ? '' : 's'} never picked up a weapon this year, and none of them won`
                : undefined;
        },
    },
    {
        id: 'first-blood-victor',
        name: 'First and Last',
        hint: 'Crown the victor who also drew first blood in the Games.',
        category: 'combat',
        rarity: 'rare',
        test: (state, v) => !!v && state.firstBloodId === v.id,
    },
    {
        id: 'opened-nothing-won-everything',
        name: 'Four Fights, None Theirs',
        hint: 'Crown a victor with four kills or more who opened none of the fights that produced them.',
        category: 'combat',
        rarity: 'rare',
        test: (_s, v) => !!v && v.kills >= 4 && (v.fightsOpened ?? 0) === 0,
        nearMiss: (_s, v) => (v && v.kills >= 4 && (v.fightsOpened ?? 0) === 1
            ? `${v.name} took ${v.kills} and started one of them`
            : undefined),
    },

    // ---- survival ----
    {
        id: 'master-of-one',
        name: 'Master of One',
        hint: 'Crown a victor who reached the top of a single skill.',
        category: 'survival',
        // AUDIT-7: it fires now. 'Possible?' means the simulation is believed
        // able to do this and no measured run ever has — two observations
        // disqualify it, and this reached 0.6% of 500 runs once §3.5 gave
        // `stealth`, `carpentry`, `navigation` and `intimidation` a way up
        // from their floors. Sub-1% and real is exactly what 'legendary' is for.
        rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.proficiencies ?? {}).some(n => (n ?? 0) >= 6),
        nearMiss: (_s, v) => {
            const best = Math.max(0, ...Object.values(v?.proficiencies ?? {}).map(n => n ?? 0));
            return best === 5 ? `${v?.name} topped out one skill at 5 — six is mastery` : undefined;
        },
    },
    {
        id: 'the-butcher-skill',
        name: 'Knows Where the Joints Are',
        hint: 'Crown a victor who learned butchery in the arena.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.proficiencies?.butchery ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.proficiencies?.butchery ?? 0) === 1
            ? `${v?.name} took one animal apart this year`
            : undefined),
    },
    {
        id: 'the-carpenter',
        name: 'Made It Out of Sticks',
        /*
         * AUDIT-7 §3.5: this asked for `carpentry >= 1` — the value every
         * tribute starts at — and was 'legendary' because, until this pass,
         * nothing in the engine could train carpentry at all, so the only way
         * to hold any was to be born with it. Giving shelters and traps a
         * training site turned a never-fires entry into a 49.4% one overnight,
         * which is the same entry being wrong in the other direction.
         *
         * Re-asked against what the skill now means. 4 is the top of the
         * measured range (peak 4.17 across 6,000 tributes), so this is a victor
         * who spent the run building rather than one who walked past a tree.
         */
        hint: 'Crown a victor who became genuinely good at building things out of what the arena had.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.proficiencies?.carpentry ?? 0) >= 4,
        nearMiss: (_s, v) => {
            const c = v?.proficiencies?.carpentry ?? 0;
            return c >= 3 && c < 4 ? `the victor's carpentry topped out at ${c.toFixed(1)}` : undefined;
        },
    },
    {
        /*
         * AUDIT-6 §11.4: the first draft of this pair asked about scars, and a
         * calibration probe found the answer: a victor's scar count is 0 in
         * every one of 150 runs and the whole field's best is 2. Scarring is a
         * real mechanic that almost never fires, and two achievements built on
         * it would have been one participation ribbon and one dead promise.
         * Asked about the injuries the engine does write instead.
         */
        id: 'carried-it-home',
        name: 'Carried It Home',
        hint: 'Crown a victor still carrying two untreated injuries at the end.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.injuries).filter(Boolean).length >= 2,
        nearMiss: (_s, v) => (Object.values(v?.injuries ?? {}).filter(Boolean).length === 1
            ? `${v?.name} came home with one injury still open — two is carrying it`
            : undefined),
    },
    {
        id: 'walked-out-whole',
        name: 'Walked Out Whole',
        hint: 'Crown a victor with no open injury at all and over half their health left.',
        category: 'survival',
        rarity: 'common',
        test: (_s, v) => !!v && Object.values(v.injuries).filter(Boolean).length === 0 && v.health > 50,
        nearMiss: (_s, v) => (v && Object.values(v.injuries).filter(Boolean).length === 0 && v.health > 35 && v.health <= 50
            ? `${v.name} walked out unhurt but down to ${Math.round(v.health)} health`
            : undefined),
    },
    {
        id: 'came-back-thrice',
        name: 'Twice Nearly',
        hint: 'Crown a victor who came back from the edge of death twice.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.lowHealthRecoveries ?? 0) >= 2,
        nearMiss: (_s, v) => {
            const n = v?.lowHealthRecoveries ?? 0;
            return n === 1 ? `${v?.name} came back from it once — twice is the story` : undefined;
        },
    },
    {
        id: 'mind-came-back',
        name: 'The Mind Came Back',
        hint: 'Crown a victor whose mind and will both gave out, and who came back from both.',
        category: 'survival',
        rarity: 'legendary',
        // AUDIT-8 §1.4: unlocked on exactly the same runs as 'second-wind' across a
        // 500-run sample. Re-gated to a harder rung of the same ladder rather than
        // deleted, so an id already in a player's record keeps resolving.
        test: (_s, v) => !!v && v.sanityRecovered === true && v.sanityScarred === true
            && (v.minResolve ?? 100) <= 20,
        nearMiss: (_s, v) => (v?.sanityRecovered === true && (v.minResolve ?? 100) > 20
            ? 'the mind came back; the will never went' : undefined),
    },

    // ---- social ----
    {
        id: 'two-treaties',
        name: 'Two Treaties',
        hint: 'See two separate treaties signed between groups in one Games, and one of them hold.',
        category: 'social',
        rarity: 'common',
        test: state => (state.blocTreatiesSworn ?? 0) >= 2 && state.blocTreatyHeld === true,
        nearMiss: state => ((state.blocTreatiesSworn ?? 0) === 1 && state.blocTreatyHeld === true
            ? 'one treaty was signed and kept this year — two is a treaty year'
            : undefined),
    },
    {
        id: 'treaty-torn-up',
        name: 'Paper and Fire',
        hint: 'See a treaty between two groups sworn and then broken.',
        category: 'social',
        rarity: 'rare',
        test: state => state.blocTreatyBroken === true,
    },
    {
        id: 'the-speaker',
        name: 'The Speaker',
        hint: 'Crown a victor who learned to speak for people who were not in the room.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.proficiencies?.oratory ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.proficiencies?.oratory ?? 0) === 1
            ? `${v?.name} spoke for a group exactly once`
            : undefined),
    },
    {
        id: 'owed-by-four',
        name: 'The Ledger',
        hint: 'Crown a victor four or more tributes owed something to.',
        category: 'social',
        rarity: 'legendary',
        test: (state, v) => !!v && state.tributes.filter(t => ((t.debts ?? {})[v.id] ?? 0) > 0).length >= 4,
        nearMiss: (state, v) => {
            if (!v) return undefined;
            const n = state.tributes.filter(t => ((t.debts ?? {})[v.id] ?? 0) > 0).length;
            return n === 3 ? `three tributes owed ${v.name} — four is a ledger` : undefined;
        },
    },
    {
        id: 'the-recap',
        name: 'Told to Their Faces',
        hint: 'See six or more survivors, at the convergence, told exactly what each of them has done.',
        category: 'social',
        rarity: 'common',
        // §11.4: the recap itself fires in 83% of runs. A recap with six people
        // still in the room is the version worth going looking for.
        test: state => state.log.some(l => /THE RECAP:/.test(l.text) && l.tributesInvolved.length >= 6),
        nearMiss: state => {
            const recap = state.log.find(l => /THE RECAP:/.test(l.text));
            return recap && recap.tributesInvolved.length >= 3 && recap.tributesInvolved.length < 6
                ? `the recap played to ${recap.tributesInvolved.length} survivors — six is a full room`
                : undefined;
        },
    },
    {
        id: 'expelled-and-won',
        name: 'Put Out and Came Back',
        hint: 'Crown a victor who was thrown out of an alliance earlier in the run.',
        category: 'social',
        rarity: 'possible',
        test: (state, v) => !!v && Object.values(state.alliances ?? {}).some(a => (a.expelledIds ?? []).includes(v.id)),
        nearMiss: state => {
            const expelled = new Set(Object.values(state.alliances ?? {}).flatMap(a => a.expelledIds ?? []));
            return expelled.size > 0
                ? `${expelled.size} tribute${expelled.size === 1 ? ' was' : 's were'} put out of a group this year, and none of them won`
                : undefined;
        },
    },
    {
        id: 'nobody-owed-anybody',
        name: 'Clean Books',
        hint: 'See a Games where no tribute ever ends up owing another one anything.',
        category: 'social',
        rarity: 'rare',
        test: state => state.debtsEverIncurred !== true,
    },

    // ---- arena ----
    {
        id: 'walked-it-all',
        name: 'Walked It All',
        hint: 'Crown a victor who set foot in every sector of the arena.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.zones.every(z => (v.visitedZones ?? []).includes(z.name)),
        nearMiss: (state, v) => {
            if (!v) return undefined;
            const missed = state.arena.zones.filter(z => !(v.visitedZones ?? []).includes(z.name)).length;
            return missed >= 1 && missed <= 2
                ? `${v.name} missed ${missed} sector${missed === 1 ? '' : 's'} of the map`
                : undefined;
        },
    },
    {
        id: 'two-levels',
        name: 'Top to Bottom',
        hint: 'Crown a victor who worked both levels of two different vertical sectors.',
        category: 'arena',
        rarity: 'common',
        /*
         * §11.4: `levelsStood` tops out at two and two was 63% of runs — which
         * is the exact observation `verticalZonesStood` was added for. Asking
         * for two *sectors* worked top to bottom is the harder question.
         */
        test: (_s, v) => !!v && (v.verticalZonesStood?.length ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.verticalZonesStood?.length ?? 0) === 1
            ? `${v?.name} worked one sector top to bottom — two is the climb`
            : undefined),
    },
    {
        id: 'the-killing-sector',
        name: 'The Killing Sector',
        hint: 'See a single sector account for eighteen or more deaths in one Games.',
        category: 'arena',
        rarity: 'rare',
        // §11.4: authored at five and measured at 96% of runs — the median
        // sector death count is twelve. Eighteen is the p90.
        test: state => Object.values(state.zoneDeaths ?? {}).some(n => n >= 18),
        nearMiss: state => {
            const best = Math.max(0, ...Object.values(state.zoneDeaths ?? {}));
            return best >= 14 && best < 18 ? `the worst sector took ${best} this year — eighteen is the killing sector` : undefined;
        },
    },
    {
        id: 'nowhere-quiet',
        name: 'Nowhere Quiet',
        hint: 'See every sector of the arena take at least one death.',
        category: 'arena',
        rarity: 'legendary',
        test: state => state.arena.zones.length >= 4
            && state.arena.zones.every(z => (state.zoneDeaths?.[z.name] ?? 0) > 0),
        nearMiss: state => {
            const quiet = state.arena.zones.filter(z => (state.zoneDeaths?.[z.name] ?? 0) === 0).length;
            return quiet >= 1 && quiet <= 2
                ? `${quiet} sector${quiet === 1 ? '' : 's'} took nobody this year`
                : undefined;
        },
    },
    {
        id: 'the-chain',
        name: 'It Went Up',
        hint: 'See a fire take three or more sectors in one Games.',
        category: 'arena',
        rarity: 'rare',
        test: state => (state.fireChainMax ?? 0) >= 3,
        nearMiss: state => ((state.fireChainMax ?? 0) === 2
            ? 'the fire took two sectors before it stopped — three is the chain'
            : undefined),
    },
    {
        id: 'the-restocked-horn',
        name: 'They Filled It Again',
        hint: 'See the Capitol restock the Cornucopia twice in one Games.',
        category: 'arena',
        rarity: 'common',
        /*
          * AUDIT-10 B3-03: `lastRestockCycle` is the *latest* restock, so the
          * count came from grepping the chronicle for four words that also
          * appear in unrelated prose. Counted where it happens now.
          */
        test: state => timesHappened(state, 'cornucopia-restocked') >= 2,
        nearMiss: state => (timesHappened(state, 'cornucopia-restocked') === 1
            ? 'the horn was restocked once this year — twice is generosity'
            : undefined),
    },
    {
        id: 'the-toll-road',
        name: 'The Toll Road',
        hint: 'See the arena\'s hard edges crossed eight times or more in one Games.',
        category: 'arena',
        rarity: 'legendary',
        test: state => Object.values(state.edgeCrossings ?? {}).reduce((a, b) => a + b, 0) >= 8,
        nearMiss: state => {
            const n = Object.values(state.edgeCrossings ?? {}).reduce((a, b) => a + b, 0);
            return n >= 5 && n < 8 ? `${n} hard crossings were made this year — eight is a toll road` : undefined;
        },
    },
    {
        id: 'survived-three-collapses',
        name: 'Standing On Nothing',
        hint: 'Crown a victor who walked out of a collapse, in a Games where more than one structure fell.',
        category: 'arena',
        rarity: 'rare',
        /*
         * AUDIT-9: asked a better question, because the old one stopped
         * having an answer.
         *
         * This wanted the same victor under two collapses — a tail of a tail
         * that 500 runs used to reach by luck and now do not, because the
         * movement layer changed underneath it. Lowering the bar to one was
         * not available: that is exactly `load-bearing`, and two cards for one
         * condition is the duplication this table is already policed for.
         *
         * So the second half of the condition moved from the victor to the
         * arena. "Standing On Nothing" is about a Games where the ground
         * itself came apart and somebody walked out of it, which is a
         * distinct thing to ask and a reachable one. `collapseStructure` also
         * now loads the structures adjacent to the one that failed — what the
         * audit's own arena backlog asks for, and what makes a second
         * collapse in a run something the arena produces rather than
         * something it is owed.
         */
        test: (state, v) => !!v && (v.collapsesSurvived ?? 0) >= 1 && (state.structuresCollapsed ?? 0) >= 2,
        nearMiss: (state, v) => (!!v && (v.collapsesSurvived ?? 0) >= 1 && (state.structuresCollapsed ?? 0) === 1
            ? `${v.name} walked out of the only structure this arena lost` : undefined),
    },
    {
        id: 'the-empty-camps',
        name: 'Three Abandoned Camps',
        hint: 'See three camps set up and walked away from in one Games.',
        category: 'arena',
        rarity: 'rare',
        test: state => (state.abandonedCamps?.length ?? 0) >= 3,
        nearMiss: state => ((state.abandonedCamps?.length ?? 0) === 2
            ? 'two camps were left standing empty this year'
            : undefined),
    },

    // ---- capitol ----
    {
        id: 'never-a-gift',
        name: 'Nobody Sent Anything',
        hint: 'Crown a victor who lasted ten days or more without a single sponsor gift.',
        category: 'capitol',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'unread'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && (v.memory?.giftsReceived ?? 0) === 0 && v.daysSurvived >= 10,
        nearMiss: (_s, v) => (v && (v.memory?.giftsReceived ?? 0) === 0 && v.daysSurvived < 10
            ? `unsponsored for ${v.daysSurvived} days of the ten` : undefined),
    },
    {
        id: 'five-gifts',
        name: 'The Capitol\'s Favourite',
        hint: 'Crown a victor who received five or more sponsor gifts.',
        category: 'capitol',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.memory?.giftsReceived ?? 0) >= 5,
        nearMiss: (_s, v) => {
            const n = v?.memory?.giftsReceived ?? 0;
            return n === 3 || n === 4 ? `${v?.name} was sent ${n} gifts — five is a favourite` : undefined;
        },
    },
    {
        id: 'the-long-performance',
        name: 'Never Broke Character',
        hint: 'See a tribute keep a performance going for six straight cycles.',
        category: 'capitol',
        rarity: 'legendary',
        test: state => (state.longestPerformance ?? 0) >= 6,
        nearMiss: state => {
            const n = state.longestPerformance ?? 0;
            return n === 4 || n === 5 ? `the longest performance ran ${n} cycles — six is never breaking` : undefined;
        },
    },
    {
        id: 'sold-the-arena',
        name: 'Sold the Arena',
        hint: 'Crown a victor who sold the map to one person and lied about it to another.',
        category: 'capitol',
        rarity: 'legendary',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'arms-dealer'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && (v.intelSold ?? 0) >= 1 && (v.liedTo ?? []).length >= 1,
        // The threshold this first reached for — `intelSold >= 3` — is above
        // the ceiling the engine produces (500 runs never gave a victor more
        // than 1), which `check-achievements`'s ceiling guard caught. Sold the
        // map *and* lied about it is the same escalation on an axis that
        // actually has room in it.
        nearMiss: (_s, v) => ((v?.intelSold ?? 0) >= 1 && (v?.liedTo ?? []).length === 0
            ? 'the victor sold the map honestly and never once misdirected anybody'
            : undefined),
    },
    {
        id: 'nothing-left-to-give',
        name: 'Nothing Left To Give',
        hint: 'See every sponsor bloc spend out in a Games whose victor was sent nothing at all.',
        category: 'capitol',
        rarity: 'legendary',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'nobody-is-buying' and 'a7-every-bloc-spent'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (state, v) => state.everySponsorBlocExhausted === true && !!v && (v.memory?.giftsReceived ?? 0) === 0,
        nearMiss: (state, v) => (state.everySponsorBlocExhausted === true
            && (v?.memory?.giftsReceived ?? 0) > 0
            ? `the purse emptied, but the victor took ${v?.memory?.giftsReceived} of it`
            : undefined),
    },
    {
        id: 'the-mentor-was-right',
        name: 'The Mentor Was Right',
        hint: 'Crown a victor mentored by a former victor.',
        category: 'capitol',
        rarity: 'possible',
        // §11.4: `mentorIsVictor` is only ever set by the career-mode profile
        // in the store, so a headless sweep can never see it. The nearMiss is
        // what tells a player where to go looking.
        test: (_s, v) => !!v && v.mentorIsVictor === true,
        nearMiss: state => (state.tributes.some(t => t.mentorIsVictor)
            ? 'a tribute was mentored by a former victor this year, and it was not the one who won'
            : 'former victors only mentor in a career the game is keeping track of'),
    },
    {
        id: 'the-backlash',
        name: 'They Did Not Buy It',
        hint: 'Crown a victor whose interview persona was thrown back in their face.',
        category: 'capitol',
        rarity: 'common',
        test: (_s, v) => !!v && (v.personaBacklash ?? 0) > 0,
    },

    // ---- games ----
    {
        id: 'neither-academy',
        name: 'Neither Academy',
        hint: 'See a Games where neither District 1 nor District 2 reaches the final four.',
        category: 'games',
        rarity: 'common',
        test: state => {
            const finalFour = [...state.tributes].sort((a, b) => lastDay(b) - lastDay(a)).slice(0, 4);
            return state.config.districtCount >= 6 && !finalFour.some(t => t.district === 1 || t.district === 2);
        },
        nearMiss: state => {
            const finalFour = [...state.tributes].sort((a, b) => lastDay(b) - lastDay(a)).slice(0, 4);
            const academy = finalFour.filter(t => t.district === 1 || t.district === 2).length;
            return academy === 1 ? 'one academy tribute made the final four' : undefined;
        },
    },
    {
        id: 'the-slow-start',
        name: 'The Slow Start',
        hint: 'See a bloodbath that takes two tributes or fewer from a full field.',
        category: 'games',
        rarity: 'possible',
        test: state => state.tributes.length >= 12 && state.tributes.filter(t => t.diedInBloodbath).length <= 2,
        nearMiss: state => {
            const n = state.tributes.filter(t => t.diedInBloodbath).length;
            return n === 3 || n === 4 ? `the bloodbath took ${n} — two or fewer is a slow start` : undefined;
        },
    },
    {
        id: 'the-long-year',
        name: 'The Long Year',
        hint: 'See a Games run sixteen days or longer.',
        category: 'games',
        rarity: 'rare',
        test: state => state.day >= 16,
        nearMiss: state => (state.day >= 13 && state.day < 16
            ? `these Games ran ${state.day} days — sixteen is a long year`
            : undefined),
    },
    {
        id: 'half-the-field-allied',
        name: 'Half the Field',
        hint: 'See half the arena or more end up inside an alliance at some point in the Games.',
        category: 'games',
        rarity: 'rare',
        test: state => {
            const total = state.tributes.length;
            // §11.4: `allianceId` is a live field and every alliance is gone by
            // the end of a run, so the first draft of this asked a question
            // whose answer is always zero. `formerAllies` is the record.
            return total >= 8 && state.tributes.filter(t => t.allianceId !== undefined || (t.formerAllies?.length ?? 0) > 0).length * 2 >= total;
        },
        nearMiss: state => {
            const total = state.tributes.length;
            const allied = state.tributes.filter(t => t.allianceId !== undefined || (t.formerAllies?.length ?? 0) > 0).length;
            return total >= 8 && allied * 2 >= total - 2 && allied * 2 < total
                ? `${allied} of ${total} ended up inside an alliance — half the field is the mark`
                : undefined;
        },
    },
    {
        id: 'all-but-one-took-one',
        name: 'All But One Took One',
        hint: 'See every district in the Games but one account for at least one kill.',
        category: 'games',
        rarity: 'legendary',
        test: state => {
            const districts = new Set(state.tributes.map(t => t.district));
            const quiet = [...districts].filter(d => !state.tributes.some(t => t.district === d && t.kills > 0)).length;
            // §11.4: measured — at least one district finishes bloodless in
            // every run, so "every district" could not fire.
            return districts.size >= 4 && quiet <= 1;
        },
        nearMiss: state => {
            const districts = new Set(state.tributes.map(t => t.district));
            const quiet = [...districts].filter(d => !state.tributes.some(t => t.district === d && t.kills > 0)).length;
            return quiet >= 2 && quiet <= 3 ? `${quiet} districts drew no blood at all this year` : undefined;
        },
    },
    {
        id: 'the-pack-that-held',
        name: 'The Pack That Held',
        hint: 'See a Career pack reach the convergence without eating itself.',
        category: 'games',
        rarity: 'common',
        test: state => state.careerPackCollapsed !== true
            && state.tributes.filter(t => t.isCareer && lastDay(t) >= (state.convergenceDay ?? state.day)).length >= 2,
        nearMiss: state => (state.careerPackCollapsed !== true
            && state.tributes.filter(t => t.isCareer && lastDay(t) >= (state.convergenceDay ?? state.day)).length === 1
            ? 'exactly one Career was still standing at the convergence — a pack is two'
            : undefined),
    },
    {
        id: 'barely-anybody-volunteered',
        name: 'Barely Anybody Stepped Forward',
        hint: 'See a reaping of a full field where three or fewer tributes volunteer.',
        category: 'games',
        rarity: 'legendary',
        // §11.4: measured — the fewest volunteers a full field produced in 150
        // runs was three, so "not one" was a promise nothing could keep.
        test: state => state.tributes.length >= 12 && state.tributes.filter(t => t.volunteered === true).length <= 3,
        nearMiss: state => {
            const n = state.tributes.filter(t => t.volunteered === true).length;
            return state.tributes.length >= 12 && n >= 4 && n <= 5
                ? `${n} tributes stepped forward this year — three or fewer is the quiet reaping`
                : undefined;
        },
    },

    // ---- oddity ----
    {
        id: 'the-whole-menu',
        name: 'Two Ways To Catch Somebody',
        hint: 'See two different kinds of trap still set when the Games end.',
        category: 'oddity',
        rarity: 'possible',
        /*
         * §11.4: `state.traps` is what is still standing at the end, not what
         * was ever built — most runs finish with none at all. Five kinds was
         * unreachable by an order of magnitude; two is a genuine oddity.
         */
        test: state => new Set((state.traps ?? []).map(t => t.kind)).size >= 2,
        nearMiss: state => ((state.traps ?? []).length >= 1 && new Set((state.traps ?? []).map(t => t.kind)).size === 1
            ? 'one kind of trap was still set at the end — two is the oddity'
            : undefined),
    },
    {
        id: 'the-liars-year',
        name: 'Three Liars',
        hint: 'See three tributes spreading things that are not true at the same time.',
        category: 'oddity',
        rarity: 'rare',
        test: state => (state.liarsAtLarge?.length ?? 0) >= 3,
        nearMiss: state => ((state.liarsAtLarge?.length ?? 0) === 2
            ? 'two liars were at large this year — three is a season for it'
            : undefined),
    },
    {
        id: 'caught-lying',
        name: 'Caught At It',
        hint: 'See a planted rumour traced back to its author in a year with two or more in circulation at once.',
        category: 'oddity',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'caught-out'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: state => state.plantedRumourExposed === true && (state.maxPlantedInCirculation ?? 0) >= 2,
        nearMiss: state => (state.plantedRumourExposed === true && (state.maxPlantedInCirculation ?? 0) === 1
            ? 'a lie was caught, but only one was ever in the air at once' : undefined),
    },
    {
        id: 'believed-everything',
        name: 'Took Their Word For It',
        hint: 'Crown a victor who was told two things about other tributes and carried both.',
        category: 'oddity',
        rarity: 'rare',
        // §11.4: measured — no victor in 150 runs held more than two.
        test: (_s, v) => !!v && (v.memory?.heardRumours?.length ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.memory?.heardRumours?.length ?? 0) === 1
            ? `${v?.name} came home believing exactly one thing they had been told`
            : undefined),
    },
    {
        id: 'took-nothing-off-anybody',
        name: 'Took Nothing Off Anybody',
        hint: 'Crown a victor who never looted a single body in a Games with twelve dead or more.',
        category: 'oddity',
        rarity: 'rare',
        // AUDIT-8 §1.4: unlocked on exactly the same runs as 'never-touched-a-body' across a
        // 500-run sample. Re-gated to a harder rung of the same ladder rather than
        // deleted, so an id already in a player's record keeps resolving.
        test: (state, v) => !!v && (v.corpsesLooted ?? 0) === 0 && dead(state).length >= 12,
        nearMiss: (state, v) => {
            if (!v) return undefined;
            const fallen = dead(state).length;
            if ((v.corpsesLooted ?? 0) === 1 && fallen >= 6) return `${v.name} went through exactly one body this year`;
            return (v.corpsesLooted ?? 0) === 0 && fallen >= 6 && fallen < 12
                ? `${fallen} lay unlooted by the victor; twelve is the bar`
                : undefined;
        },
    },

    /*
     * ======================= AUDIT-7 §11.4 ==================================
     *
     * Seventy, written against state the engine already holds, and weighted
     * toward the categories that are thin relative to the simulation behind
     * them: `reaping` and `oddity` were the smallest shelves at 25 each while
     * `social` was 59, and `arena` had 39 entries against a map layer with 641
     * edges, seven edge-rule kinds, ten zone-effect kinds, verticality and
     * load-bearing structure.
     *
     * Every one of them reads a field that already exists. Where a threshold is
     * involved it carries a `nearMiss`, because `test:achievements` requires one
     * on any numeric-threshold entry and because an achievement that is a matter
     * of degree and says nothing when you miss it is a worse version of itself.
     */

    // ---- arena and map (14) -------------------------------------------------
    {
        id: 'a7-toll-dodger',
        name: 'Did Not Pay',
        hint: 'Crown a victor who crossed a tolled edge without paying the toll.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && Object.keys(state.edgeCrossings ?? {}).length > 0
            && Object.values(state.arena.edgeRules ?? {}).some(r => r.kind === 'tolled')
            && (v.knownEdges?.length ?? 0) > 0,
        // AUDIT-9: an entry nobody earns and nobody is told about is a locked
        // card with no information in it. This one needs three things to line
        // up — a tolled arena, a victor, and that victor having found a route
        // — so the near miss names the two that did.
        nearMiss: (state, v) => (!!v
            && Object.values(state.arena.edgeRules ?? {}).some(r => r.kind === 'tolled')
            && (v.knownEdges?.length ?? 0) === 0
            ? 'your victor never found a way round the toll' : undefined),
        availableIn: state => Object.values(state.arena.edgeRules ?? {}).some(r => r.kind === 'tolled'),
    },
    {
        id: 'a7-held-the-crossing',
        name: 'Held the Crossing',
        hint: 'See an alliance garrison a contested edge and still hold it four cycles later.',
        category: 'arena',
        rarity: 'possible',
        // AUDIT-7 §11.4: `garrisonedEdges` is the live claim and lapses the
        // moment nobody is standing there, so at the epilogue it is almost
        // always empty. Hold it to the end is the achievement; `garrisonsFormed`
        // is the permanent record the near-miss reads.
        test: state => Object.keys(state.garrisonedEdges ?? {}).length > 0,
        nearMiss: state => (Object.keys(state.garrisonedEdges ?? {}).length === 0 && (state.garrisonsFormed ?? []).length > 0
            ? `a pass was held in these Games and let go again — ${(state.garrisonsFormed ?? []).length} of them`
            : undefined),
        availableIn: state => Object.values(state.arena.edgeRules ?? {}).some(r => r.kind === 'contested'),
    },
    {
        id: 'a7-every-hidden-way',
        name: 'Every Hidden Way',
        hint: 'Crown a victor who found every hidden edge in the arena.',
        category: 'arena',
        rarity: 'possible',
        /*
         * AUDIT-8 §1.4: this and 'the-unmapped-way' unlocked on exactly the
         * same runs, and had done since it was written — 15 hidden edges are
         * spread across 45 arenas, so most arenas that have one have exactly
         * one, and "found every hidden way" reduced to "found a hidden way".
         * A pre-existing duplicate the new guard surfaced rather than a new
         * one. It now means what its name says: offered only where there is
         * more than one to find.
         */
        test: (state, v) => {
            const hidden = Object.entries(state.arena.edgeRules ?? {}).filter(([, r]) => r.kind === 'hidden').map(([k]) => k);
            return !!v && hidden.length > 1 && hidden.every(k => (v.knownEdges ?? []).includes(k));
        },
        nearMiss: (state, v) => {
            const hidden = Object.entries(state.arena.edgeRules ?? {}).filter(([, r]) => r.kind === 'hidden').map(([k]) => k);
            const found = hidden.filter(k => (v?.knownEdges ?? []).includes(k)).length;
            return hidden.length > 1 && found === hidden.length - 1
                ? `${found} of the arena's ${hidden.length} hidden ways were found` : undefined;
        },
        // AUDIT-8 §1.4: `some` -> more than one. Offered only where there is
        // more than one hidden way to find, which is what stops it being
        // 'the-unmapped-way' under a different name.
        availableIn: state => Object.values(state.arena.edgeRules ?? {}).filter(r => r.kind === 'hidden').length > 1,
    },
    {
        id: 'a7-dry-arena',
        name: 'Nothing To Drink',
        // AUDIT-7: calibration. `!!v` in a waterless arena is 100% of those
        // runs — the `availableIn` gate decides *whether it is offered*, not
        // whether it was earned. Finishing thirsty is the thing the arena is
        // actually asking of somebody.
        hint: 'Win an arena with no water source in it, and finish it thirsty.',
        category: 'arena',
        rarity: 'common',
        test: (_s, v) => !!v && v.vitals.thirst >= 45,
        nearMiss: (_s, v) => (v && v.vitals.thirst >= 30 && v.vitals.thirst < 45
            ? `the victor finished on ${Math.round(v.vitals.thirst)} thirst` : undefined),
        availableIn: state => !state.arena.zones.some(z => z.features?.waterSource),
    },
    {
        id: 'a7-brought-it-down',
        name: 'Brought It Down',
        hint: 'See a structure come down on somebody who was not the one who loaded it.',
        category: 'arena',
        rarity: 'common',
        test: state => state.tributes.some(t => (t.collapsesSurvived ?? 0) > 0)
            && Object.keys(state.structuralFatigue ?? {}).length > 0,
        availableIn: state => state.arena.zones.some(z => z.terrain === 'ruins'),
    },
    {
        id: 'a7-never-went-up',
        name: 'Ground Floor',
        hint: 'Crown a victor who never once stood on an upper level.',
        category: 'arena',
        rarity: 'common',
        test: (_s, v) => !!v && !(v.levelsStood ?? []).includes('upper'),
        availableIn: state => state.arena.zones.some(z => z.features?.vertical),
    },
    {
        id: 'a7-every-upper-level',
        name: 'The High Road',
        hint: 'Crown a victor who stood on the upper level of every vertical zone in the arena.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => {
            const vertical = state.arena.zones.filter(z => z.features?.vertical).length;
            return !!v && vertical > 0 && (v.verticalZonesStood?.length ?? 0) >= vertical;
        },
        nearMiss: (state, v) => {
            const vertical = state.arena.zones.filter(z => z.features?.vertical).length;
            const stood = v?.verticalZonesStood?.length ?? 0;
            return vertical > 1 && stood === vertical - 1
                ? `${stood} of the arena's ${vertical} vertical sectors` : undefined;
        },
        availableIn: state => state.arena.zones.some(z => z.features?.vertical),
    },
    {
        id: 'a7-whole-vocabulary',
        name: 'The Whole Vocabulary',
        hint: 'See six or more different zone-effect kinds in one Games.',
        category: 'arena',
        rarity: 'possible',
        test: state => {
            const kinds = new Set(Object.values(state.zoneEffects ?? {}).flat().map(e => e.kind));
            return kinds.size >= 6;
        },
        nearMiss: state => {
            const kinds = new Set(Object.values(state.zoneEffects ?? {}).flat().map(e => e.kind));
            return kinds.size === 5 ? 'five of the arena\'s six states were seen' : undefined;
        },
    },
    {
        id: 'a7-crowned-in-the-glow',
        name: 'Crowned in the Glow',
        hint: 'Crown a victor standing in an irradiated sector.',
        category: 'arena',
        rarity: 'rare',
        test: (state, v) => !!v && (state.zoneEffects?.[v.zone] ?? []).some(e => e.kind === 'irradiated'),
    },
    {
        id: 'a7-last-crossing',
        name: 'The Last Crossing',
        hint: 'Crown a victor in an arena where a route was severed during the run.',
        category: 'arena',
        rarity: 'common',
        test: (state, v) => !!v && (state.severedEdges ?? []).length > 0,
    },
    {
        id: 'a7-off-season-crown',
        name: 'Out of Season',
        hint: 'Win an arena while it is wearing an off-season skin.',
        category: 'arena',
        rarity: 'rare',
        test: (state, v) => !!v && state.arena.offSeason !== undefined,
        availableIn: state => state.arena.offSeason !== undefined,
    },
    {
        id: 'a7-three-laws',
        name: 'Three Rules',
        hint: 'Win under an arena carrying three or more standing laws.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && (state.arena.laws?.length ?? 0) >= 3,
        nearMiss: state => (state.arena.laws?.length ?? 0) === 2
            ? 'the arena carried two of the three' : undefined,
        availableIn: state => (state.arena.laws?.length ?? 0) >= 3,
    },
    {
        id: 'a7-set-piece-and-out',
        name: 'Stood Through It',
        // AUDIT-7: calibration. The signature fires in almost every run, so
        // "it fired and somebody won" was 90.8%. Standing through a front as
        // well is the version of this that is about the victor.
        hint: 'Crown a victor who stood through the arena\'s set piece and a weather front.',
        category: 'arena',
        rarity: 'common',
        test: (state, v) => !!v && state.gamemakerSignatureFired === true && (v.stormsSurvived ?? 0) >= 1,
        nearMiss: (state, v) => (state.gamemakerSignatureFired && (v?.stormsSurvived ?? 0) === 0
            ? 'the set piece fired but the weather stayed off' : undefined),
    },

    // ---- reaping and pre-Games (10) ----------------------------------------
    {
        id: 'a7-scored-one',
        name: 'Scored a One',
        hint: 'Crown a victor who scored 1 on the training floor.',
        category: 'reaping',
        rarity: 'possible',
        test: (_s, v) => !!v && v.trainingScore <= 1,
        nearMiss: (_s, v) => (v && v.trainingScore === 2 ? `${v.name} scored a 2` : undefined),
    },
    {
        id: 'a7-scored-twelve',
        name: 'Scored a Twelve',
        hint: 'Crown a victor who scored 12 on the training floor.',
        category: 'reaping',
        rarity: 'possible',
        test: (_s, v) => !!v && v.trainingScore >= 12,
        nearMiss: (_s, v) => (v && v.trainingScore === 11 ? `${v.name} scored an 11` : undefined),
    },
    {
        id: 'a7-lowest-in-the-field',
        name: 'Bottom of the Board',
        hint: 'Crown the victor who scored lowest of anybody in the field.',
        category: 'reaping',
        rarity: 'rare',
        test: (state, v) => !!v && state.tributes.every(t => t.id === v.id || t.trainingScore >= v.trainingScore),
    },
    {
        id: 'a7-victors-field-crown',
        name: 'Beat the Beaten',
        hint: 'Win a year reaped from former victors.',
        category: 'reaping',
        rarity: 'legendary',
        test: (state, v) => !!v && state.gamesProfile?.castShape?.id === 'victors-field',
        availableIn: state => state.gamesProfile?.castShape?.id === 'victors-field',
    },
    {
        id: 'a7-all-volunteer-crown',
        name: 'Everybody Chose This',
        hint: 'Win an all-volunteer year out of a district with no Games history worth the name.',
        category: 'reaping',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'all-volunteers'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (state, v) => !!v && state.gamesProfile?.castShape?.id === 'all-volunteer'
            && (legacyOf(v.district).tier === 'thin' || legacyOf(v.district).tier === 'forgotten'),
        availableIn: state => state.gamesProfile?.castShape?.id === 'all-volunteer',
    },
    {
        id: 'a7-failed-the-interview',
        name: 'Bad on Camera',
        hint: 'Crown a victor who played against the persona they sold and never once lived up to it.',
        category: 'reaping',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'the-backlash'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && (v.personaBacklash ?? 0) > 0 && (v.personaCredit ?? 0) === 0,
    },
    {
        id: 'a7-careers-in-the-bloodbath',
        name: 'Short Career',
        hint: 'See three or more Careers die in the bloodbath.',
        category: 'reaping',
        rarity: 'rare',
        test: state => state.tributes.filter(t => t.isCareer && t.diedInBloodbath).length >= 3,
        nearMiss: state => {
            const n = state.tributes.filter(t => t.isCareer && t.diedInBloodbath).length;
            return n === 2 ? 'two Careers went down at the horn' : undefined;
        },
    },
    {
        id: 'a7-tesserae-crown',
        name: 'Every Slip',
        hint: 'Crown a victor who was in the bowl more times than anybody else in the field.',
        category: 'reaping',
        rarity: 'rare',
        test: (state, v) => !!v && (v.tesserae ?? 0) > 0
            && state.tributes.every(t => t.id === v.id || (t.tesserae ?? 0) <= (v.tesserae ?? 0)),
    },
    {
        id: 'a7-kept-the-pact',
        name: 'Made on the Floor',
        hint: 'Crown a victor who kept a pre-agreement struck on the training floor.',
        category: 'reaping',
        rarity: 'common',
        test: (_s, v) => !!v && (v.trainingPacts?.length ?? 0) > 0 && (v.betrayalsCommitted ?? 0) === 0,
    },

    // ---- oddity (12) ---------------------------------------------------------
    {
        id: 'a7-inherited-the-blade',
        name: 'Somebody Else\'s Answer',
        hint: 'Crown a victor holding a named weapon that earned its name in another hand.',
        category: 'oddity',
        rarity: 'rare',
        // AUDIT-8 §1.4: the "another hand" clause was "somebody else died having
        // killed somebody", which is true in almost every Games. The
        // inheritance is provable off the object itself: a blade carrying more
        // blood than its holder has kills was drawing it for somebody else.
        test: (_s, v) => !!v && v.inventory.some(i => (i.bloodDrawn ?? 0) > v.kills),
        nearMiss: (_s, v) => (!!v && v.inventory.some(i => (i.bloodDrawn ?? 0) > 0)
            && !v.inventory.some(i => (i.bloodDrawn ?? 0) > v.kills)
            ? 'the victor drew every drop on that blade themselves'
            : undefined),
    },
    {
        id: 'a7-four-times-blooded',
        name: 'Four Times',
        hint: 'Crown a victor holding a weapon that has drawn blood four times.',
        category: 'oddity',
        rarity: 'rare',
        test: (_s, v) => !!v && v.inventory.some(i => (i.bloodDrawn ?? 0) >= 4),
        nearMiss: (_s, v) => {
            const best = Math.max(0, ...(v?.inventory ?? []).map(i => i.bloodDrawn ?? 0));
            return best === 3 ? 'the victor\'s blade had drawn blood three times' : undefined;
        },
    },
    {
        id: 'a7-nobody-swore',
        name: 'Nobody Swore',
        hint: 'Crown a victor nobody in the field ever swore vengeance against.',
        category: 'oddity',
        rarity: 'common',
        test: (state, v) => !!v && !state.tributes.some(t => (t.memory?.vengeance ?? []).includes(v.id)),
    },
    {
        id: 'a7-four-swore',
        name: 'Four Oaths',
        hint: 'Crown a victor four or more people had sworn to kill.',
        category: 'oddity',
        rarity: 'common',
        test: (state, v) => !!v && state.tributes.filter(t => (t.memory?.vengeance ?? []).includes(v.id)).length >= 4,
        nearMiss: (state, v) => {
            const n = v ? state.tributes.filter(t => (t.memory?.vengeance ?? []).includes(v.id)).length : 0;
            return n === 3 ? `three people had sworn about ${v?.name}` : undefined;
        },
    },
    {
        id: 'a7-believed-three-lies',
        name: 'Took It All In',
        hint: 'Crown a victor who believed three or more things that were not true.',
        category: 'oddity',
        rarity: 'possible',
        test: (state, v) => !!v && (state.rumours ?? [])
            .filter(r => !r.isTrue && (v.memory?.heardRumours ?? []).includes(r.id)).length >= 3,
        nearMiss: (state, v) => {
            const n = v ? (state.rumours ?? []).filter(r => !r.isTrue && (v.memory?.heardRumours ?? []).includes(r.id)).length : 0;
            return n === 2 ? 'the victor swallowed two of them' : undefined;
        },
    },
    {
        id: 'a7-never-slept',
        name: 'Never Slept',
        hint: 'Crown a victor carrying serious sleep debt at the end.',
        category: 'oddity',
        rarity: 'common',
        // AUDIT-7: calibration. Four nights down was 79.6% of victors; eight is
        // the tail.
        test: (_s, v) => !!v && (v.sleepDebt ?? 0) >= 8,
        nearMiss: (_s, v) => {
            const d = v?.sleepDebt ?? 0;
            return d >= 6 && d < 8 ? `the victor was ${Math.round(d)} nights down` : undefined;
        },
    },
    {
        id: 'a7-no-cannon-till-four',
        name: 'A Quiet Week',
        hint: 'See a Games where no cannon fires before the fourth day.',
        category: 'oddity',
        rarity: 'possible',
        test: state => !state.tributes.some(t => t.status !== 'alive' && (t.dayOfDeath ?? 99) < 4),
        nearMiss: state => {
            const first = Math.min(99, ...state.tributes.filter(t => t.status !== 'alive').map(t => t.dayOfDeath ?? 99));
            return first === 3 ? 'the first cannon was on day three' : undefined;
        },
    },
    {
        id: 'a7-died-where-they-started',
        name: 'Died Where They Started',
        hint: 'See somebody die on the last day in the sector they started in.',
        category: 'oddity',
        rarity: 'legendary',
        test: state => state.tributes.some(t => t.status !== 'alive'
            && (t.visitedZones?.length ?? 0) === 1 && (t.dayOfDeath ?? 0) >= state.day - 1),
    },
    {
        id: 'a7-shed-and-won',
        name: 'Left Something Behind',
        hint: 'Crown a victor who lost a trait they walked in with.',
        category: 'oddity',
        rarity: 'common',
        test: (_s, v) => !!v && (v.shedTraits?.length ?? 0) > 0,
    },
    {
        id: 'a7-token-to-the-end',
        name: 'Still Had It',
        hint: 'Crown a victor who kept the token from home through a spell of not wanting to win at all.',
        category: 'oddity',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'the-token'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && v.token !== undefined && (v.minResolve ?? 100) <= 25,
        nearMiss: (_s, v) => (v?.token !== undefined && (v.minResolve ?? 100) > 25 && (v.minResolve ?? 100) <= 45
            ? `the victor kept it, and never fell below ${Math.round(v.minResolve ?? 100)} resolve` : undefined),
    },

    // ---- survival and the body (12) -----------------------------------------
    {
        id: 'a7-won-wasted',
        name: 'Nothing Left',
        hint: 'Crown a victor whose body had wasted by the end.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.condition === 'Wasted' || v.condition === 'Skeletal'),
        nearMiss: (_s, v) => (v?.condition === 'Lean' ? 'the victor finished Lean, one band up' : undefined),
    },
    {
        id: 'a7-beat-the-fever',
        name: 'Beat the Fever',
        hint: 'Crown a victor who came back from a terminal infection.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.terminalInfectionBeaten === true,
        nearMiss: (_s, v) => (v && !v.terminalInfectionBeaten && (v.worstInfectionGrade ?? 0) >= 2
            ? `the victor carried a grade-${v.worstInfectionGrade} infection and treated it before it turned` : undefined),
    },
    {
        id: 'a7-four-scars',
        name: 'Four Scars',
        hint: 'Crown a victor carrying four or more scars.',
        category: 'survival',
        rarity: 'possible',
        test: (_s, v) => !!v && Object.values(v.scars ?? {}).filter(Boolean).length >= 4,
        nearMiss: (_s, v) => {
            const n = Object.values(v?.scars ?? {}).filter(Boolean).length;
            return n === 3 ? 'the victor came out with three' : undefined;
        },
    },
    {
        id: 'a7-field-hospital',
        name: 'Field Hospital',
        hint: 'Crown a victor who patched up three or more other people.',
        category: 'survival',
        rarity: 'rare',
        // AUDIT-7: calibration. Three was 55.4% of victors.
        test: (state, v) => !!v && state.tributes.filter(t => t.id !== v.id && (t.memory?.stoodBy ?? []).includes(v.id)).length >= 6,
        nearMiss: (state, v) => {
            const n = v ? state.tributes.filter(t => t.id !== v.id && (t.memory?.stoodBy ?? []).includes(v.id)).length : 0;
            return n >= 4 && n < 6 ? `${n} people owed the victor a patch-up` : undefined;
        },
    },
    {
        id: 'a7-never-foraged',
        name: 'Never Foraged',
        hint: 'Crown a victor who never once found food on the ground.',
        category: 'survival',
        rarity: 'common',
        test: (_s, v) => !!v && (v.forageSuccesses ?? 0) === 0,
    },
    {
        id: 'a7-never-crossed-water',
        name: 'Kept Their Boots Dry',
        hint: 'Crown a victor who never crossed water.',
        category: 'survival',
        rarity: 'common',
        test: (_s, v) => !!v && (v.waterCrossings ?? 0) === 0,
        availableIn: state => state.arena.zones.some(z => z.terrain === 'water' || z.terrain === 'wetland'),
    },
    {
        id: 'a7-three-frostbites',
        /*
         * AUDIT-9 batch 3: lowered from three cycles to two, because the
         * engine stopped producing three.
         *
         * `check-achievements` caught this on the batch 3 balance pass: 500
         * complete runs never produced a victor with more than two separate
         * frostbites, so the card had become a promise the game does not keep.
         * Whether the cause is this batch's changes or an earlier drift does
         * not change the answer — the check's own note is the right rule, that
         * an entry nobody can earn should be brought back inside what the
         * arena actually does rather than left as decoration.
         *
         * Two is still the thing the card is about: a victor who was frozen,
         * warmed up, and was frozen again, which is a different run from one
         * cold night.
         */
        name: 'Twice Frozen',
        hint: 'Crown a victor who took frostbite in two separate cycles.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.frostbitesTaken ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.frostbitesTaken ?? 0) === 1 ? 'the victor was frostbitten once' : undefined),
    },
    {
        id: 'a7-five-health',
        name: 'Five Points Left',
        hint: 'Crown a victor who finished on five health or less.',
        category: 'survival',
        rarity: 'possible',
        test: (_s, v) => !!v && v.health <= 5,
        nearMiss: (_s, v) => (v && v.health > 5 && v.health <= 12 ? `the victor finished on ${Math.round(v.health)}` : undefined),
    },
    {
        id: 'a7-came-back-from-the-floor',
        name: 'Came Back Up',
        hint: 'Crown a victor who was at the sanity floor and finished steady.',
        category: 'survival',
        rarity: 'possible',
        test: (_s, v) => !!v && (v.minResolve ?? 100) <= 15 && v.vitals.sanity >= 70,
        nearMiss: (_s, v) => (v && (v.minResolve ?? 100) <= 15 && v.vitals.sanity >= 50
            ? `the victor came back to ${Math.round(v.vitals.sanity)}` : undefined),
    },
    {
        id: 'a7-weapon-hand-whole',
        name: 'Weapon Hand Whole',
        hint: 'Crown a victor who never took a wound to the hand they fight with.',
        category: 'survival',
        rarity: 'rare',
        // AUDIT-7: calibration. Most victors are never wounded on either side,
        // so this was 90.6%. It has to be a victor who took real damage and
        // still never took it *there*.
        test: (_s, v) => !!v && v.woundedSide !== v.handedness && (v.woundsLogged ?? 0) >= 5,
        nearMiss: (_s, v) => (v && v.woundedSide === v.handedness && (v.woundsLogged ?? 0) >= 5
            ? 'the victor took one to the hand they fight with' : undefined),
    },
    {
        id: 'a7-three-storms',
        name: 'Three Fronts',
        hint: 'Crown a victor who stood through five weather fronts.',
        category: 'survival',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'foul-weather'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (_s, v) => !!v && (v.stormsSurvived ?? 0) >= 5,
        nearMiss: (_s, v) => ((v?.stormsSurvived ?? 0) === 4 ? 'the victor stood through four' : undefined),
    },
    {
        id: 'a7-everything-mended',
        name: 'Everything Mended',
        hint: 'Crown a victor carrying no open injury at all.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && !Object.values(v.injuries).some(Boolean) && (v.woundsLogged ?? 0) >= 3,
        nearMiss: (_s, v) => (v && (v.woundsLogged ?? 0) >= 3 && Object.values(v.injuries).filter(Boolean).length === 1
            ? 'the victor came out carrying exactly one' : undefined),
    },

    // ---- capitol and the booth (10) ------------------------------------------
    {
        id: 'a7-quell-crown',
        name: 'A Quarter Quell, Taken',
        hint: 'Win a Quarter Quell that ran twelve days or longer.',
        category: 'capitol',
        rarity: 'rare',
        // AUDIT-8 §1.4: unlocked on exactly the same runs as 'quarter-quell' across a
        // 500-run sample. Re-gated to a harder rung of the same ladder rather than
        // deleted, so an id already in a player's record keeps resolving.
        test: (state, v) => !!v && state.gamesProfile?.quell !== undefined && v.daysSurvived >= 12,
        nearMiss: (state, v) => (state.gamesProfile?.quell !== undefined && !!v && v.daysSurvived < 12
            ? `a Quell taken on day ${v.daysSurvived}; twelve is the bar` : undefined),
        availableIn: state => !!state.gamesProfile?.quell,
    },
    {
        id: 'a7-unsponsored',
        name: 'Nobody Backed Them',
        hint: 'Crown a victor no sponsor ever sent anything to.',
        category: 'capitol',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.sponsorTrust <= 10,
        nearMiss: (_s, v) => (v && v.sponsorTrust > 10 && v.sponsorTrust <= 25
            ? `the victor finished on ${Math.round(v.sponsorTrust)} sponsor trust` : undefined),
    },
    {
        id: 'a7-four-blocs',
        name: 'Four Patrons',
        hint: 'Crown a victor four sponsor blocs spent on.',
        category: 'capitol',
        rarity: 'rare',
        // AUDIT-7: calibration. There are always four blocs, so the count says
        // nothing; what it is asking is whether they all spent on *this* one.
        test: (state, v) => !!v && Object.keys(state.sponsorBlocBudgets ?? {}).length >= 4 && v.sponsorTrust >= 88,
        nearMiss: (_s, v) => (v && v.sponsorTrust >= 75 && v.sponsorTrust < 88
            ? `the victor finished on ${Math.round(v.sponsorTrust)} sponsor trust` : undefined),
    },
    {
        id: 'a7-mercy-on-the-victor',
        name: 'The Capitol Chose',
        hint: 'Pull the mercy lever on the tribute who goes on to win.',
        category: 'capitol',
        rarity: 'possible',
        test: (state, v) => !!v && (state.gamemakerUse?.mercy?.uses ?? 0) > 0 && v.sponsorTrust >= 50,
        nearMiss: (state, v) => ((state.gamemakerUse?.mercy?.uses ?? 0) > 0 && v && v.sponsorTrust < 50
            ? 'mercy was sent, but not to the one who won' : undefined),
        availableIn: state => state.gamemakerMode,
    },
    {
        id: 'a7-revealed-and-survived',
        name: 'Put On Every Screen',
        hint: 'Reveal a tribute who then goes on to win.',
        category: 'capitol',
        rarity: 'possible',
        test: (state, v) => !!v && (state.gamemakerUse?.reveal?.uses ?? 0) > 0,
        nearMiss: state => (state.gamemakerMode && (state.gamemakerUse?.reveal?.uses ?? 0) === 0
            ? 'the Gamemakers never put anybody on screen this year' : undefined),
        availableIn: state => state.gamemakerMode,
    },
    {
        id: 'a7-stripped-the-crown',
        name: 'Ate the Pantry',
        hint: 'Strip a sector and crown a victor who was standing in it.',
        category: 'capitol',
        rarity: 'possible',
        test: (state, v) => !!v && (state.gamemakerUse?.strip?.uses ?? 0) > 0
            && (state.zoneEffects?.[v.zone] ?? []).some(e => e.kind === 'stripped'),
        nearMiss: (state, v) => (v && (state.gamemakerUse?.strip?.uses ?? 0) > 0
            && !(state.zoneEffects?.[v.zone] ?? []).some(e => e.kind === 'stripped')
            ? 'a sector was stripped bare this year and the victor was standing somewhere else' : undefined),
        availableIn: state => state.gamemakerMode,
    },
    {
        id: 'a7-bloodless-crown',
        name: 'Nothing on the Books',
        hint: 'Crown a victor who neither owed nor was owed anything at the end.',
        category: 'capitol',
        rarity: 'common',
        // AUDIT-7: calibration. Most runs never put anybody in anybody's debt,
        // so "owed nothing" was 66.6%. It only means something in a year where
        // debts were actually being run up.
        test: (state, v) => !!v && state.debtsEverIncurred === true
            && Object.keys(v.debts ?? {}).length === 0
            && !state.tributes.some(t => Object.keys(t.debts ?? {}).includes(v.id)),
    },
    {
        id: 'a7-audience-flatlined',
        name: 'They Stopped Watching',
        hint: 'See the audience go flat for three cycles running and the Games survive it.',
        category: 'capitol',
        rarity: 'legendary',
        // AUDIT-7: 500 runs never produced more than 3, so 4 was an entry
        // nobody could earn. Placed on the measured ceiling.
        // AUDIT-9: and the ceiling moved again, to 2. The Games now produce
        // more small movement per cycle — the wider armoury spreads kill
        // excitement across more distinct weapons, more pre-launch alliances
        // means more social beats, and the confusion layer keeps people
        // acting rather than settling — so a total that does not move at all
        // for three cycles running has become the rarer thing it always read
        // as. Re-placed on the measured ceiling rather than left unearnable.
        test: state => (state.excitementFlatCycles ?? 0) >= 2,
        nearMiss: state => ((state.excitementFlatCycles ?? 0) === 1 ? 'the crowd went quiet for one' : undefined),
    },
    {
        id: 'a7-every-bloc-spent',
        name: 'The Whole Purse',
        hint: 'See every sponsor bloc spend out on a victor who took three gifts or more of it themselves.',
        category: 'capitol',
        rarity: 'rare',
        // AUDIT-8 §1.4: this shared a byte-identical predicate with 'nobody-is-buying' and 'nothing-left-to-give'.
        // Two cards for one boolean, always flipping together. Re-gated to the
        // harder half of the same idea rather than deleted, so no id already in
        // a player's `unlocked` record stops resolving.
        test: (state, v) => state.everySponsorBlocExhausted === true && !!v && (v.memory?.giftsReceived ?? 0) >= 3,
        nearMiss: (state, v) => (state.everySponsorBlocExhausted === true
            && (v?.memory?.giftsReceived ?? 0) > 0 && (v?.memory?.giftsReceived ?? 0) < 3
            ? `the purse emptied; the victor took ${v?.memory?.giftsReceived} of it` : undefined),
    },

    // ---- games shape (12) -----------------------------------------------------
    {
        id: 'a7-bloodless-horn',
        name: 'Nobody Died At The Horn',
        hint: 'See a bloodbath that takes nobody.',
        category: 'games',
        rarity: 'possible',
        test: state => !state.tributes.some(t => t.diedInBloodbath),
        // AUDIT-8 §1.4: it had no nearMiss and has never fired, so a player who
        // came within one body of the quietest possible opening was told
        // nothing at all about it. The bloodbath takes a third of the field on
        // average; one or two is already remarkable and worth saying.
        nearMiss: state => {
            const fell = state.tributes.filter(t => t.diedInBloodbath).length;
            return fell > 0 && fell <= 2
                ? `only ${fell} fell at the horn this year`
                : undefined;
        },
    },
    {
        id: 'a7-no-feast',
        name: 'No Feast At All',
        hint: 'See a Games where the feast never happens.',
        category: 'games',
        rarity: 'rare',
        test: state => (state.feastsHeld ?? 0) === 0 && state.day >= 8,
        nearMiss: state => ((state.feastsHeld ?? 0) === 0 && state.day >= 6 && state.day < 8
            ? `no feast, but the Games only ran ${state.day} days` : undefined),
    },
    {
        id: 'a7-three-feasts',
        name: 'Three Feasts',
        hint: 'See three feasts in one Games.',
        category: 'games',
        rarity: 'legendary',
        test: state => (state.feastsHeld ?? 0) >= 3,
        nearMiss: state => ((state.feastsHeld ?? 0) === 2 ? 'two feasts were called' : undefined),
    },
    {
        id: 'a7-one-each',
        name: 'One From Each',
        hint: 'See the Games take no district both of its tributes on the same day.',
        category: 'games',
        rarity: 'rare',
        /*
         * AUDIT-7 §11.4: this used to ask that every district lose exactly one
         * tribute, read at the epilogue — arithmetically impossible, since
         * twenty-three of twenty-four are dead by then and only the victor's
         * district can be down a single body. Re-aimed at the thing the name
         * was reaching for: no district ever gets the pair-in-one-day notice.
         */
        test: state => {
            const byDay: Record<string, number> = {};
            state.tributes.filter(t => t.status !== 'alive' && t.dayOfDeath !== undefined)
                .forEach(t => { const k = `${t.district}|${t.dayOfDeath}`; byDay[k] = (byDay[k] ?? 0) + 1; });
            return Object.keys(byDay).length > 0 && !Object.values(byDay).some(n => n > 1);
        },
        nearMiss: state => {
            const byDay: Record<string, number> = {};
            state.tributes.filter(t => t.status !== 'alive' && t.dayOfDeath !== undefined)
                .forEach(t => { const k = `${t.district}|${t.dayOfDeath}`; byDay[k] = (byDay[k] ?? 0) + 1; });
            const doubled = Object.values(byDay).filter(n => n > 1).length;
            return doubled === 1 ? 'exactly one district lost both of its own on a single day' : undefined;
        },
    },
    {
        id: 'a7-decided-in-the-convergence',
        name: 'Driven Together',
        hint: 'See a Games decided after the Gamemakers closed the arena.',
        category: 'games',
        rarity: 'common',
        // AUDIT-7: calibration. The convergence fires in nearly every run, so
        // "it happened and then the run ended" was 82.6%. The victor being
        // *standing in it* is the thing the achievement is named for.
        test: (state, v) => !!v && state.convergenceZone !== undefined && v.zone === state.convergenceZone,
        nearMiss: (state, v) => (state.convergenceZone && v && v.zone !== state.convergenceZone
            ? 'the victor was not in the sector the arena closed to' : undefined),
    },
    {
        id: 'a7-allies-to-the-last-two',
        name: 'It Was Always Going To Be Us',
        hint: 'See the last two standing be people who spent five days allied.',
        category: 'games',
        rarity: 'possible',
        test: state => {
            const [a, b] = [...state.tributes].sort((x, y) => lastDay(y) - lastDay(x)).slice(0, 2);
            if (!a || !b) return false;
            return (a.formerAllies ?? []).includes(b.id) && (a.sharedHistory?.[b.id] ?? 0) >= 10;
        },
        nearMiss: state => {
            const [a, b] = [...state.tributes].sort((x, y) => lastDay(y) - lastDay(x)).slice(0, 2);
            const shared = a && b ? (a.sharedHistory?.[b.id] ?? 0) : 0;
            return a && b && (a.formerAllies ?? []).includes(b.id) && shared > 0 && shared < 10
                ? `the last two had ${Math.round(shared)} cycles of history, not ten` : undefined;
        },
    },
    {
        id: 'a7-no-betrayal-at-all',
        name: 'Nobody Turned',
        hint: 'See a Games with no betrayal in it at all.',
        category: 'games',
        rarity: 'rare',
        test: state => !state.tributes.some(t => (t.betrayalsCommitted ?? 0) > 0) && state.day >= 6,
        nearMiss: state => {
            const n = state.tributes.reduce((s2, t) => s2 + (t.betrayalsCommitted ?? 0), 0);
            return n === 1 && state.day >= 6 ? 'exactly one person turned all year' : undefined;
        },
    },
    {
        id: 'a7-ten-betrayals',
        name: 'Nobody Kept Anything',
        hint: 'See ten or more betrayals in one Games.',
        category: 'games',
        rarity: 'legendary',
        test: state => state.tributes.reduce((n, t) => n + (t.betrayalsCommitted ?? 0), 0) >= 10,
        nearMiss: state => {
            const n = state.tributes.reduce((s, t) => s + (t.betrayalsCommitted ?? 0), 0);
            return n >= 7 && n < 10 ? `${n} people turned on somebody` : undefined;
        },
    },
    {
        id: 'a7-favourite-won',
        name: 'The Favourite',
        hint: 'Crown the tribute the board had shortest when the bets closed.',
        category: 'games',
        rarity: 'rare',
        test: (state, v) => {
            const opening = openingOdds(state);
            if (!v || !opening) return false;
            const mine = opening[v.id];
            return mine !== undefined && Object.values(opening).every(p => p <= mine);
        },
        nearMiss: (state, v) => {
            const opening = openingOdds(state);
            const mine = v && opening ? opening[v.id] : undefined;
            if (mine === undefined || !opening) return undefined;
            const rank = Object.values(opening).filter(p => p > mine).length + 1;
            return rank > 1 && rank <= 3 ? `the victor opened ${rank}${rank === 2 ? 'nd' : 'rd'} on the board` : undefined;
        },
    },
    {
        id: 'a7-longest-price-won',
        name: 'The Long Price',
        hint: 'Crown the tribute the board had longest when the bets closed.',
        category: 'games',
        rarity: 'rare',
        test: (state, v) => {
            const opening = openingOdds(state);
            if (!v || !opening) return false;
            const mine = opening[v.id];
            return mine !== undefined && Object.values(opening).every(p => p >= mine);
        },
        nearMiss: (state, v) => {
            const opening = openingOdds(state);
            const mine = v && opening ? opening[v.id] : undefined;
            if (mine === undefined || !opening) return undefined;
            const from = Object.values(opening).filter(p => p < mine).length + 1;
            return from > 1 && from <= 3 ? `the victor opened ${from}${from === 2 ? 'nd' : 'rd'} from the bottom of the board` : undefined;
        },
    },
    {
        id: 'a7-treaty-year',
        name: 'A Treaty Year',
        hint: 'See two blocs swear an agreement and renew it rather than let it lapse.',
        category: 'games',
        rarity: 'common',
        // AUDIT-7: `renewals` lives on the live array, which is pruned before
        // the end state — the exact trap `Simulator.observe` exists to stop
        // people falling into, and the check caught it. Read off the flags the
        // engine sets for the run instead.
        test: state => (state.blocTreatiesSworn ?? 0) > 0
            && state.blocTreatyHeld === true && state.blocTreatyBroken !== true,
    },
    /*
     * ======================= AUDIT-8 §11.3 ==================================
     *
     * Sixty, against three rules the existing table keeps and one this batch
     * adds.
     *
     * Every entry reads state the engine already stores. No entry gates on a
     * subsystem measured under 20% reach — §9.4's fifteen unreachable AUDIT-7
     * entries are what happens when that rule is not applied, and re-gating
     * them cost more than writing them did. The category balance moves toward
     * `combat`, which at 29 was the thinnest shelf against `social`'s 56.
     *
     * And the new one, from §1.4: **no entry may duplicate another's
     * question.** `check-achievements` now asserts that two ways — identical
     * predicate source, and identical unlock sets across a 500-run sample — so
     * a duplicate written here fails the build rather than shipping as a
     * second card that always flips with the first.
     */

    // ---- combat (12): the thinnest shelf -----------------------------------
    {
        id: 'a8-first-and-last',
        name: 'Both Ends of It',
        hint: 'Crown a victor who drew first blood and dealt the last kill of the Games.',
        category: 'combat', rarity: 'legendary',
        /*
         * AUDIT-9 (audit B20: "First and Last" is one of seven titles shared
         * by different ids).
         *
         * This tested first blood plus a kill count, which is the same
         * question `first-blood-victor` asks with a number bolted on — and
         * once the armoury widened and more tributes were armed, a first-blood
         * victor essentially always finished with two, so the two cards
         * unlocked on exactly the same runs across the whole sample. Two cards
         * for one condition is the duplication this table is policed for.
         *
         * The title was always describing something the state could not
         * express: there was a `firstBloodId` and no counterpart. There is one
         * now, so the card asks what it says — the first blood of the Games
         * and the last were the same hand.
         *
         * AUDIT-9 stage C: and *only* those two. `firstBlood && lastKill` was
         * still the same card as `first-blood-victor` in practice, because a
         * victor who opens the Games almost always closes them too — the
         * behaviour check caught the pair unlocking on identical runs once
         * longer runs gave it enough observations to be sure. The exact count
         * is what makes it a different story rather than the same one told
         * twice: two kills in the whole Games, the first and the last.
         */
        test: (state, v) => !!v && state.firstBloodId === v.id && state.lastKillerId === v.id
            && v.kills === 2,
        nearMiss: (state, v) => (v && state.firstBloodId === v.id && state.lastKillerId === v.id && v.kills > 2
            ? `both ends were theirs, and ${v.kills - 2} in between` : undefined),
    },
    {
        id: 'a8-the-long-reach',
        name: 'The Long Reach',
        hint: 'Crown a victor still holding a ranged weapon who took three or more lives.',
        category: 'combat', rarity: 'rare',
        test: (_s, v) => !!v && v.kills >= 3 && v.inventory.some(i => i.weaponClass === 'ranged'),
        nearMiss: (_s, v) => (!!v && v.kills === 2 && v.inventory.some(i => i.weaponClass === 'ranged')
            ? 'two, with the bow still in their hands' : undefined),
    },
    {
        id: 'a8-two-grades-down',
        name: 'Two Grades Down',
        hint: 'Crown a victor carrying a grade-three injury at the end.',
        category: 'combat', rarity: 'legendary',
        test: (_s, v) => !!v && Object.values(v.injurySeverity ?? {}).some(g => (g ?? 0) >= 3),
        nearMiss: (_s, v) => (Object.values(v?.injurySeverity ?? {}).some(g => (g ?? 0) === 2)
            ? 'the worst they carried out was a grade two' : undefined),
    },
    {
        id: 'a8-off-hand',
        name: 'Off Hand',
        hint: 'Crown a victor who took a life with their weapon arm ruined.',
        category: 'combat', rarity: 'rare',
        test: (_s, v) => !!v && v.kills >= 1 && v.woundedSide !== undefined && v.woundedSide === v.handedness,
    },
    {
        id: 'a8-the-whetstone',
        name: 'The Whetstone',
        hint: 'Crown a victor whose weapon has taken three lives and is still half-sound.',
        category: 'combat', rarity: 'rare',
        test: (_s, v) => !!v && v.inventory.some(i =>
            (i.bloodDrawn ?? 0) >= 3 && (i.durability ?? 0) > (i.maxDurability ?? 1) * 0.5),
        nearMiss: (_s, v) => {
            const best = Math.max(0, ...(v?.inventory ?? []).map(i => i.bloodDrawn ?? 0));
            return best > 0 && best < 3 ? `their weapon has taken ${best} of the three` : undefined;
        },
    },
    {
        id: 'a8-broke-off-and-came-back',
        name: 'Broke Off, Came Back',
        hint: 'Crown a victor who ran from the same rival twice before it was settled.',
        category: 'combat', rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.memory?.rivals ?? {}).some(r => (r.timesFled ?? 0) >= 2),
        nearMiss: (_s, v) => (Object.values(v?.memory?.rivals ?? {}).some(r => (r.timesFled ?? 0) === 1)
            ? 'they broke off once and came back for it' : undefined),
    },
    {
        id: 'a8-never-rattled',
        name: 'Never Rattled',
        hint: 'Crown a victor with kills who was never shaken and never went under.',
        category: 'combat', rarity: 'rare',
        test: (_s, v) => !!v && (v.rattled ?? 0) === 0 && v.kills >= 1 && (v.lowHealthRecoveries ?? 0) === 0,
    },
    {
        id: 'a8-momentum',
        name: 'Momentum',
        hint: 'Crown a victor still keyed up from a kill when the Games ended.',
        category: 'combat', rarity: 'common',
        test: (_s, v) => !!v && (v.momentum ?? 0) > 0 && v.kills >= 2,
        nearMiss: (_s, v) => ((v?.momentum ?? 0) > 0 && (v?.kills ?? 0) === 1
            ? 'still keyed up, on one kill; two is the bar' : undefined),
    },
    {
        id: 'a8-the-second-exchange',
        name: 'The Second Exchange',
        hint: 'Crown a victor who fought the same person twice and hurt them both times.',
        category: 'combat', rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.memory?.rivals ?? {}).some(r =>
            (r.woundsTaken ?? 0) > 0 && (r.woundsDealt ?? 0) > 0 && (r.fights ?? 0) >= 2),
        nearMiss: (_s, v) => (Object.values(v?.memory?.rivals ?? {}).some(r => (r.fights ?? 0) === 1)
            ? 'they met one of them exactly once' : undefined),
    },
    {
        id: 'a8-opened-nothing',
        name: 'Started Nothing, Finished Nothing',
        hint: 'Crown a victor who neither started a fight nor finished anybody off.',
        category: 'combat', rarity: 'legendary',
        // AUDIT-8: the duplicate guard from §1.4 caught this as identical to
        // 'never-opened-one' on its first run — which is the guard doing its job on the
        // very next batch written. Re-aimed at a question nothing else asks.
        // AUDIT-8: at `kills >= 2 && fightsOpened === 0` this was 'the-watcher'
        // exactly. The second clause is the part nothing else asks: a victor
        // who never opened one *and* never closed one over somebody down.
        test: (_s, v) => !!v && v.kills >= 1 && (v.fightsOpened ?? 0) === 0
            && (v.finishingBlows ?? 0) === 0,
        nearMiss: (_s, v) => ((v?.fightsOpened ?? 0) === 1 && (v?.kills ?? 0) >= 1
            ? 'they started exactly one of them' : undefined),
    },
    {
        id: 'a8-scarred-and-won',
        name: 'Scarred and Won',
        hint: 'Crown a victor carrying two or more permanent scars.',
        category: 'combat', rarity: 'legendary',
        test: (_s, v) => !!v && Object.keys(v.scars ?? {}).length >= 2,
        nearMiss: (_s, v) => (Object.keys(v?.scars ?? {}).length === 1
            ? 'they came out with one mark that will not fade' : undefined),
    },
    {
        id: 'a8-the-grapple',
        name: 'The Grapple',
        hint: 'Crown a victor who had a weapon at some point and ended with none, having killed.',
        category: 'combat', rarity: 'rare',
        test: (_s, v) => !!v && v.kills >= 1 && !v.inventory.some(i => i.type === 'weapon')
            && v.everCarriedWeapon === true,
    },

    // ---- social (8) --------------------------------------------------------
    {
        id: 'a8-four-ledgers',
        name: 'Four Ledgers',
        hint: 'Crown a victor four or more people still owed at the end.',
        category: 'social', rarity: 'legendary',
        test: (state, v) => !!v && state.tributes.filter(o => (o.debts?.[v.id] ?? 0) > 0).length >= 4,
        nearMiss: (state, v) => {
            const n = v ? state.tributes.filter(o => (o.debts?.[v.id] ?? 0) > 0).length : 0;
            return n === 3 ? 'three people owed them at the end; four is the bar' : undefined;
        },
    },
    {
        id: 'a8-four-reasons',
        name: 'Four Reasons',
        hint: 'See all four kinds of truce struck in a single Games.',
        category: 'social', rarity: 'rare',
        test: state => {
            const kinds = new Set<string>();
            state.tributes.forEach(t => Object.values(t.truceReason ?? {}).forEach(r => kinds.add(r)));
            return kinds.size >= 4;
        },
        nearMiss: state => {
            const kinds = new Set<string>();
            state.tributes.forEach(t => Object.values(t.truceReason ?? {}).forEach(r => kinds.add(r)));
            return kinds.size === 3 ? 'three of the four reasons were used this year' : undefined;
        },
    },
    {
        id: 'a8-the-quartermasters-word',
        name: "The Quartermaster's Word",
        hint: 'Crown a victor who held a named role in their group and owed nobody at the end.',
        category: 'social', rarity: 'common',
        test: (_s, v) => !!v && (v.roleCycles ?? 0) >= 3
            && !Object.values(v.debts ?? {}).some(d => d > 0),
        nearMiss: (_s, v) => ((v?.roleCycles ?? 0) >= 3
            && Object.values(v?.debts ?? {}).some(d => d > 0)
            ? 'they did the job and came out still owing somebody' : undefined),
    },
    {
        id: 'a8-reconciled',
        name: 'Reconciled',
        hint: 'Crown a victor who ended on good terms with somebody they fought three times.',
        category: 'social', rarity: 'legendary',
        test: (_s, v) => !!v && Object.entries(v.memory?.rivals ?? {}).some(([id, r]) =>
            (r.fights ?? 0) >= 3 && (v.relationships[id] ?? 0) > 0),
        nearMiss: (_s, v) => (Object.values(v?.memory?.rivals ?? {}).some(r => (r.fights ?? 0) === 2)
            ? 'one feud reached two fights; three is the bar' : undefined),
    },
    {
        id: 'a8-never-sworn-to',
        name: 'Never Sworn To',
        hint: 'Crown a victor who killed and still had nobody swear vengeance on them.',
        category: 'social', rarity: 'common',
        // AUDIT-8: the duplicate guard from §1.4 caught this as identical to
        // 'a7-nobody-swore' on its first run — which is the guard doing its job on the
        // very next batch written. Re-aimed at a question nothing else asks.
        test: (state, v) => !!v && v.kills >= 1 && !state.tributes.some(o =>
            o.id !== v.id && (o.memory?.vengeance ?? []).includes(v.id)),
    },
    {
        id: 'a8-stood-by-somebody',
        name: 'Stood By Somebody',
        hint: 'Crown a victor who took a real risk for three different people.',
        category: 'social', rarity: 'common',
        test: (_s, v) => !!v && (v.memory?.stoodBy ?? []).length >= 3,
        nearMiss: (_s, v) => ((v?.memory?.stoodBy ?? []).length === 2
            ? 'they put themselves out for two people; three is the bar' : undefined),
    },
    {
        id: 'a8-both-sides',
        name: 'Both Sides',
        hint: 'Crown a victor who brokered a truce between two other people.',
        category: 'social', rarity: 'legendary',
        test: (_s, v) => !!v && (v.brokeredTruces ?? []).length >= 1,
    },
    {
        id: 'a8-the-whole-charter',
        name: 'The Whole Charter',
        hint: 'See a charter of four clauses or more sworn in a single Games.',
        category: 'social', rarity: 'rare',
        /*
         * AUDIT-9: 5 stopped being reachable and the reason is a deliberate
         * change elsewhere. A charter grows by renegotiation, renegotiation
         * fires on a breach, and the commonest breach was of the clause
         * against stripping the fallen — which is exactly the thing that
         * stopped being automatic when looting became a decision. Fewer
         * breaches, shallower charters.
         *
         * The renegotiation pool was widened in the same pass (a group can
         * now close any loophole rather than four of seven), which is the
         * right fix for the underlying cap but does not on its own recover a
         * tail this thin. Placed on the measured ceiling, like a7 above.
         */
        test: state => (state.deepestCharter ?? 0) >= 4,
        nearMiss: state => ((state.deepestCharter ?? 0) === 3
            ? 'the deepest charter this year ran to three clauses' : undefined),
    },

    // ---- survival (8) ------------------------------------------------------
    {
        id: 'a8-off-the-floor-twice',
        name: 'Off the Floor Twice',
        hint: 'Crown a victor who came back off the near-death line twice without taking a life.',
        category: 'survival', rarity: 'possible',
        // AUDIT-8: the duplicate guard from §1.4 caught this as identical to
        // 'came-back-thrice' on its first run — which is the guard doing its job on the
        // very next batch written. Re-aimed at a question nothing else asks.
        test: (_s, v) => !!v && (v.lowHealthRecoveries ?? 0) >= 2 && v.kills === 0,
        nearMiss: (_s, v) => ((v?.lowHealthRecoveries ?? 0) === 1 ? 'they came back off it once' : undefined),
    },
    {
        id: 'a8-every-site',
        name: 'Every Site',
        hint: 'Crown a victor who was hurt at three or more separate body sites over the run.',
        category: 'survival', rarity: 'legendary',
        // AUDIT-8: all four sites never happened in 500 runs. Three does.
        test: (_s, v) => !!v && (['head', 'torso', 'arms', 'legs'] as const).filter(site =>
            v.injuries[site] || (v.injurySeverity?.[site] ?? 0) > 0 || !!v.scars?.[site]).length >= 3,
        nearMiss: (_s, v) => {
            const n = (['head', 'torso', 'arms', 'legs'] as const).filter(site =>
                v?.injuries[site] || (v?.injurySeverity?.[site] ?? 0) > 0 || !!v?.scars?.[site]).length;
            return n === 2 ? 'hurt at two sites; three is the bar' : undefined;
        },
    },
    {
        id: 'a8-frame-intact',
        name: 'Frame Intact',
        hint: 'Crown a victor eight days in whose body never started wasting.',
        category: 'survival', rarity: 'common',
        test: (_s, v) => !!v && (v.conditionPressure ?? 0) <= 0 && v.daysSurvived >= 8,
        nearMiss: (_s, v) => (!!v && (v.conditionPressure ?? 0) <= 0 && v.daysSurvived < 8
            ? `never wasted, and it only had to hold for ${v.daysSurvived} days` : undefined),
    },
    {
        id: 'a8-fed-at-the-end',
        name: 'Fed at the End',
        hint: 'Crown a victor who went hungry enough to be marked by it and came out full.',
        category: 'survival', rarity: 'rare',
        // AUDIT-8: reads `conditionPressure` — the state that earns 'Starved' —
        // rather than the trait label, so this does not spend the hard-coded
        // `traits.includes()` budget `check-predicates` ratchets. It is also
        // closer to the mechanic: the pressure is the hunger, the trait is the
        // label the arena put on it.
        test: (_s, v) => !!v && (v.conditionPressure ?? 0) > 0 && v.vitals.hunger < 40,
        nearMiss: (_s, v) => (!!v && (v.conditionPressure ?? 0) > 0 && v.vitals.hunger >= 40
            ? 'the hunger marked them and never quite let go' : undefined),
    },
    {
        id: 'a8-beat-the-worst-of-it',
        name: 'Beat the Worst of It',
        hint: 'Crown a victor who carried an infection to its worst grade and came out clean.',
        category: 'survival', rarity: 'legendary',
        test: (_s, v) => !!v && (v.worstInfectionGrade ?? 0) >= 3 && !v.injuries.infected,
        nearMiss: (_s, v) => ((v?.worstInfectionGrade ?? 0) === 2
            ? 'the worst of it reached grade two' : undefined),
    },
    {
        id: 'a8-slept-through-it',
        name: 'Slept Through It',
        hint: 'Crown a victor seven days in who owed the arena no sleep at all.',
        category: 'survival', rarity: 'legendary',
        test: (_s, v) => !!v && (v.sleepDebt ?? 0) === 0 && v.daysSurvived >= 7,
        nearMiss: (_s, v) => (!!v && (v.sleepDebt ?? 0) > 0 && v.daysSurvived >= 7
            ? 'seven days in and still owing the arena a night' : undefined),
    },
    {
        id: 'a8-never-went-thirsty',
        name: 'Never Went Thirsty',
        hint: 'Crown a victor eight days in who ended comfortably watered.',
        category: 'survival', rarity: 'rare',
        test: (_s, v) => !!v && v.vitals.thirst < 35 && v.daysSurvived >= 8,
        nearMiss: (_s, v) => (!!v && v.daysSurvived >= 8 && v.vitals.thirst >= 35 && v.vitals.thirst < 55
            ? 'dry at the end, though never dangerously' : undefined),
    },
    {
        id: 'a8-the-long-fast',
        name: 'The Long Fast',
        hint: 'Crown a victor the hunger marked who still had half their strength.',
        category: 'survival', rarity: 'rare',
        test: (_s, v) => !!v && (v.conditionPressure ?? 0) > 0 && v.health >= 50,
        nearMiss: (_s, v) => (!!v && (v.conditionPressure ?? 0) > 0 && v.health < 50
            ? `the hunger marked them and left them on ${Math.round(v.health)}` : undefined),
    },

    // ---- arena (8) ---------------------------------------------------------
    {
        id: 'a8-every-terrain',
        name: 'Every Terrain',
        hint: 'Crown a victor who stood on every kind of ground the arena has.',
        category: 'arena', rarity: 'rare',
        test: (state, v) => {
            if (!v) return false;
            const kinds = new Set(state.arena.zones.map(z => z.terrain));
            const stood = new Set(state.arena.zones
                .filter(z => (v.visitedZones ?? []).includes(z.name))
                .map(z => z.terrain));
            return kinds.size >= 3 && stood.size >= kinds.size;
        },
        nearMiss: (state, v) => {
            const kinds = new Set(state.arena.zones.map(z => z.terrain));
            const stood = new Set(state.arena.zones
                .filter(z => (v?.visitedZones ?? []).includes(z.name)).map(z => z.terrain));
            return kinds.size - stood.size === 1 ? 'one kind of ground they never set foot on' : undefined;
        },
    },
    {
        id: 'a8-knows-the-back-ways',
        name: 'Knows the Back Ways',
        hint: 'Crown a victor who found an unmapped way through and told nobody about it.',
        category: 'arena', rarity: 'legendary',
        // AUDIT-8: the duplicate guard from §1.4 caught this as identical to
        // 'the-unmapped-way' and 'a7-every-hidden-way' on its first run — which is the guard doing its job on the
        // very next batch written. Re-aimed at a question nothing else asks.
        test: (_s, v) => !!v && (v.knownEdges?.length ?? 0) >= 1 && (v.sharedIntelWith ?? []).length === 0,
    },
    {
        id: 'a8-out-of-the-bloom',
        name: 'Out of the Bloom',
        hint: 'Crown a victor standing on ground that had come back to life.',
        category: 'arena', rarity: 'rare',
        test: (state, v) => !!v && (state.zoneEffects?.[v.zone] ?? []).some(e => e.kind === 'blooming'),
    },
    {
        id: 'a8-eight-effects',
        name: 'Eight Ways to Ruin Ground',
        hint: 'See eight of the ten kinds of zone effect in one Games.',
        category: 'arena', rarity: 'possible',
        test: state => {
            const kinds = new Set<string>();
            Object.values(state.zoneEffects ?? {}).forEach(list => list.forEach(e => kinds.add(e.kind)));
            return kinds.size >= 8;
        },
        nearMiss: state => {
            const kinds = new Set<string>();
            Object.values(state.zoneEffects ?? {}).forEach(list => list.forEach(e => kinds.add(e.kind)));
            return kinds.size >= 5 && kinds.size < 8 ? `${kinds.size} of the ten were seen this year` : undefined;
        },
    },
    {
        id: 'a8-where-they-started',
        name: 'Where They Started',
        hint: 'Crown a victor standing in the first sector they ever stood in.',
        category: 'arena', rarity: 'common',
        test: (_s, v) => !!v && (v.visitedZones?.length ?? 0) >= 3 && v.visitedZones?.[0] === v.zone,
        nearMiss: (_s, v) => (!!v && (v.visitedZones?.length ?? 0) >= 3
            && v.visitedZones?.[0] !== v.zone && v.visitedZones?.includes(v.zone) === true
            ? 'they came back to ground they knew, but not the first of it' : undefined),
    },
    {
        id: 'a8-half-the-map',
        name: 'Half the Map',
        hint: 'Crown a victor who personally stood in half the arena or more.',
        category: 'arena', rarity: 'common',
        test: (state, v) => !!v && (v.visitedZones?.length ?? 0) >= Math.ceil(state.arena.zones.length / 2),
        nearMiss: (state, v) => {
            const need = Math.ceil(state.arena.zones.length / 2);
            const got = v?.visitedZones?.length ?? 0;
            return got === need - 1 ? 'one sector short of half the map' : undefined;
        },
    },
    {
        id: 'a8-rode-the-collapse',
        name: 'Rode the Collapse',
        hint: 'Crown a victor who rode out a collapse and kept walking into bad ground anyway.',
        category: 'arena', rarity: 'rare',
        // AUDIT-8: the duplicate guard from §1.4 caught this as identical to
        // 'load-bearing' on its first run — which is the guard doing its job on the
        // very next batch written. Re-aimed at a question nothing else asks.
        test: (_s, v) => !!v && (v.collapsesSurvived ?? 0) >= 1 && (v.walkedIntoEffect ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.collapsesSurvived ?? 0) >= 1 && (v?.walkedIntoEffect ?? 0) < 2
            ? 'they rode one out, but mostly kept clear of bad ground' : undefined),
    },
    {
        id: 'a8-up-and-down',
        name: 'Finished High',
        hint: 'Crown a victor who ended the Games standing on high ground inside a sector.',
        category: 'arena', rarity: 'rare',
        // AUDIT-8: the duplicate guard from §1.4 caught this as identical to
        // 'two-levels' on its first run — which is the guard doing its job on the
        // very next batch written. Re-aimed at a question nothing else asks.
        // AUDIT-8: 'both-levels' already owns "changed level in three sectors".
        // Where they were *standing* when it ended is a different question, and
        // one the vertical layer keeps and nothing reads.
        test: (_s, v) => !!v && v.zoneLevel === 'upper' && (v.verticalZonesStood?.length ?? 0) >= 1,
        nearMiss: (_s, v) => (v?.zoneLevel === 'lower'
            ? 'they finished on the floor of it rather than the gallery' : undefined),
    },

    // ---- capitol (7) -------------------------------------------------------
    {
        id: 'a8-never-sent-anything',
        name: 'Never Sent Anything',
        hint: 'Crown a victor the sponsors ignored in a year when they were paying out.',
        category: 'capitol', rarity: 'legendary',
        test: (state, v) => !!v && (v.memory?.giftsReceived ?? 0) === 0
            && state.tributes.some(o => (o.memory?.giftsReceived ?? 0) > 0),
    },
    {
        id: 'a8-backlash-and-back',
        name: 'Backlash and Back',
        hint: 'Crown a victor who played against their persona and won the crowd back anyway.',
        category: 'capitol', rarity: 'rare',
        test: (_s, v) => !!v && (v.personaBacklash ?? 0) > 0
            && (v.personaCredit ?? 0) > (v.personaBacklash ?? 0),
        nearMiss: (_s, v) => ((v?.personaBacklash ?? 0) > 0 && (v?.personaCredit ?? 0) > 0
            ? 'they clawed some of it back, not all' : undefined),
    },
    {
        id: 'a8-the-private-eleven',
        name: 'The Private Eleven',
        hint: 'Crown a victor who scored eleven or better in the private session.',
        category: 'capitol', rarity: 'legendary',
        test: (_s, v) => !!v && (v.privateSession?.score ?? 0) >= 11,
        nearMiss: (_s, v) => ((v?.privateSession?.score ?? 0) === 10
            ? 'a ten in the private session; eleven is the bar' : undefined),
    },
    {
        id: 'a8-the-gamemakers-attention',
        name: "The Gamemaker's Attention",
        hint: 'Crown a bloodless victor in a year the Gamemakers reached into the arena more than once.',
        category: 'capitol', rarity: 'legendary',
        // AUDIT-8: the duplicate guard from §1.4 caught this as identical to
        // 'made-them-blink' on its first run — which is the guard doing its job on the
        // very next batch written. Re-aimed at a question nothing else asks.
        //
        // AUDIT-10: and caught again, against `bloodless-crown`. The signature
        // fires in nearly every Games, so "bloodless victor AND the signature
        // fired" was "bloodless victor" wearing a hat. `gamemakerCommands`
        // counts the interventions that actually happened, which makes this a
        // question about a *meddled-with* year rather than an ordinary one.
        test: (state, v) => (state.gamemakerCommands ?? 0) >= 2 && !!v && v.kills === 0,
        nearMiss: (state, v) => {
            if (!v || v.kills !== 0) return undefined;
            const reached = state.gamemakerCommands ?? 0;
            return reached === 1
                ? `${v.name} came home without killing anybody, but the Gamemakers only reached into this arena once`
                : undefined;
        },
    },
    {
        id: 'a8-bought-nothing',
        name: 'Bought Nothing',
        hint: 'Crown a victor in a Games where you never spent a coin on anybody.',
        category: 'capitol', rarity: 'common',
        test: state => Object.keys(state.playerGiftCycle ?? {}).length === 0,
    },
    {
        id: 'a8-read-the-room',
        name: 'Read the Room',
        hint: 'Crown a victor who ended far better thought of than they started.',
        category: 'capitol', rarity: 'common',
        test: (_s, v) => !!v && v.sponsorTrust > v.reputation + 15,
        nearMiss: (_s, v) => (!!v && v.sponsorTrust > v.reputation && v.sponsorTrust <= v.reputation + 15
            ? 'the crowd warmed to them, but not by much' : undefined),
    },
    {
        id: 'a8-the-parade-paid',
        name: 'The Parade Paid',
        hint: 'Crown a victor whose chariot night was still working for them in the arena.',
        category: 'capitol', rarity: 'rare',
        // AUDIT-8: first written at >= 8, which `check-achievements`'s ceiling
        // guard proved no victor in 500 runs reaches (the measured peak is 5.25).
        test: (_s, v) => !!v && (v.paradeBuzz ?? 0) >= 4,
        nearMiss: (_s, v) => ((v?.paradeBuzz ?? 0) >= 2 && (v?.paradeBuzz ?? 0) < 4
            ? 'the parade did something for them, but not enough' : undefined),
    },

    // ---- reaping (6) -------------------------------------------------------
    {
        id: 'a8-six-tesserae',
        name: 'Six Tesserae',
        hint: 'Crown a victor who walked in with six or more name-slips taken for grain.',
        category: 'reaping', rarity: 'rare',
        test: (_s, v) => !!v && (v.tesserae ?? 0) >= 6,
        nearMiss: (_s, v) => ((v?.tesserae ?? 0) >= 4 && (v?.tesserae ?? 0) < 6
            ? `${v?.tesserae} slips taken for grain; six is the bar` : undefined),
    },
    {
        id: 'a8-the-far-plate',
        name: 'The Far Plate',
        hint: 'Crown a victor who started at the outer edge of the ring.',
        category: 'reaping', rarity: 'rare',
        test: (_s, v) => !!v && (v.platePosition ?? 0) >= 0.85,
    },
    {
        id: 'a8-twelve-years-old',
        name: 'Twelve Years Old',
        hint: 'Crown a victor at the youngest age the bowl can draw.',
        category: 'reaping', rarity: 'possible',
        test: (_s, v) => !!v && v.age <= 12,
        nearMiss: (_s, v) => (v?.age === 13 ? 'thirteen; twelve is the bar' : undefined),
    },
    {
        id: 'a8-put-their-hand-up',
        name: 'Put Their Hand Up',
        hint: 'Crown a volunteer in a year when almost nobody volunteered.',
        category: 'reaping', rarity: 'possible',
        test: (state, v) => !!v && v.volunteered === true
            && state.tributes.filter(t => t.volunteered).length <= 3,
        nearMiss: (state, v) => (v?.volunteered === true
            && state.tributes.filter(t => t.volunteered).length > 3
            ? 'they volunteered in a year plenty of others did too' : undefined),
    },
    {
        id: 'a8-a-third-of-the-bowl',
        name: 'A Third of the Bowl',
        hint: 'See a Games where a third of the field volunteered.',
        category: 'reaping', rarity: 'common',
        test: state => state.tributes.filter(t => t.volunteered).length >= Math.ceil(state.tributes.length / 3),
    },
    {
        id: 'a8-both-to-the-final-three',
        name: 'Both of Them, to the End',
        hint: 'See both tributes of one district reach the final three.',
        category: 'reaping', rarity: 'common',
        test: state => {
            const ranked = [...state.tributes].sort((a, b) =>
                (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity)).slice(0, 3);
            return ranked.length === 3 && new Set(ranked.map(t => t.district)).size < 3;
        },
        nearMiss: state => {
            const ranked = [...state.tributes].sort((a, b) =>
                (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity)).slice(0, 4);
            return ranked.length === 4 && new Set(ranked.map(t => t.district)).size < 4
                ? 'a district had both of theirs in the final four' : undefined;
        },
    },

    // ---- games (5) ---------------------------------------------------------
    {
        id: 'a8-nobody-teamed-up',
        name: 'Nobody Teamed Up',
        hint: 'See a Games in which not one alliance ever formed.',
        category: 'games', rarity: 'legendary',
        test: state => Object.keys(state.alliances ?? {}).length === 0
            && !state.tributes.some(t => (t.formerAllies ?? []).length > 0),
        /*
         * AUDIT-9: this became very nearly unreachable, and on purpose.
         *
         * Three days of training used to produce agreements that evaporated at
         * the gong, so a Games in which nobody ever teamed up was an odd but
         * real outcome. Floor pacts are real alliances now
         * (`initializePactAlliances`), which is what the arena was missing —
         * and which means a run with no alliance at all requires a field where
         * not one agreement was struck in three days. Kept, because it is
         * still possible and it is a good card; given the near miss it always
         * needed, so a player who came close is told so.
         */
        nearMiss: state => {
            const joiners = state.tributes.filter(t =>
                t.allianceId !== undefined || (t.formerAllies ?? []).length > 0).length;
            return joiners > 0 && joiners <= 2
                ? `only ${joiners} tribute${joiners === 1 ? '' : 's'} ever teamed up with anybody`
                : undefined;
        },
    },
    {
        id: 'a8-everybody-knew-everybody',
        name: 'Everybody Knew Everybody',
        hint: 'See a Games where the last four standing had all heard of each other.',
        category: 'games', rarity: 'common',
        /*
         * AUDIT-10: re-aimed, by the same duplicate guard that re-aimed this
         * entry's neighbour and for the same reason.
         *
         * "Every survivor at the end" required two or more alive, which in this
         * game is a dual victory and nothing else — so the predicate was
         * `dual-victory` plus a condition that is almost always true alongside
         * it, and the two unlocked on exactly the same runs. The question worth
         * asking is the audit's own §11 one: whether the endgame was between
         * people who had a history, or between strangers the bracket happened to
         * leave standing. The final four answers that in every Games, not only
         * in the rare ones with two crowns.
         */
        test: state => {
            const board = finalFour(state);
            if (board.length < 4) return false;
            return board.every(a => board.every(b =>
                a.id === b.id || (a.memory?.notoriety?.[b.id] ?? 0) > 0));
        },
        nearMiss: state => {
            const board = finalFour(state);
            if (board.length < 4) return undefined;
            const strangers = board.filter(a => board.some(b =>
                a.id !== b.id && (a.memory?.notoriety?.[b.id] ?? 0) <= 0));
            return strangers.length > 0 && strangers.length <= 2
                ? `${strangers.map(t => t.name).join(' and ')} reached the final four without having heard of everybody else in it`
                : undefined;
        },
    },
    {
        id: 'a8-the-quiet-year',
        name: 'Fewer Than Three',
        hint: 'See a Games with fewer than three kills in the whole run.',
        category: 'games', rarity: 'possible',
        test: state => state.tributes.reduce((n, t) => n + t.kills, 0) < 3,
        nearMiss: state => {
            const k = state.tributes.reduce((n, t) => n + t.kills, 0);
            return k === 3 || k === 4 ? `${k} kills in the whole Games` : undefined;
        },
    },
    {
        id: 'a8-twenty-days',
        name: 'Twenty Days',
        hint: 'See a Games that ran twenty days or longer.',
        category: 'games', rarity: 'legendary',
        test: state => state.day >= 20,
        nearMiss: state => (state.day >= 16 && state.day < 20 ? `it ran ${state.day} days` : undefined),
    },
    {
        id: 'a8-two-tables',
        name: 'Two Tables',
        hint: 'See two feasts laid in one Games.',
        category: 'games', rarity: 'common',
        test: state => (state.feastsHeld ?? 0) >= 2,
        availableIn: state => state.config.enableFeast,
        nearMiss: state => ((state.feastsHeld ?? 0) === 1 ? 'one table was laid this year' : undefined),
    },

    // ---- oddity (6) --------------------------------------------------------
    {
        id: 'a8-nobody-lied',
        name: 'Nobody Lied',
        hint: 'See a Games in which not one false rumour was ever planted.',
        category: 'oddity', rarity: 'common',
        test: state => (state.maxPlantedInCirculation ?? 0) === 0,
    },
    {
        id: 'a8-not-who-they-were',
        name: 'Two Things Lighter',
        hint: 'Crown a victor the arena took two or more traits off.',
        category: 'oddity', rarity: 'rare',
        test: (_s, v) => !!v && (v.shedTraits?.length ?? 0) >= 2,
        nearMiss: (_s, v) => ((v?.shedTraits?.length ?? 0) === 1
            ? 'the arena took one thing off them' : undefined),
    },
    {
        id: 'a8-what-they-brought',
        name: 'What They Brought, What They Take',
        hint: 'Crown a victor still holding their token and carrying a permanent scar.',
        category: 'oddity', rarity: 'rare',
        test: (_s, v) => !!v && v.token !== undefined && Object.keys(v.scars ?? {}).length >= 1,
    },
    {
        id: 'a8-never-left',
        name: 'A Week in Three Sectors',
        hint: 'Crown a victor seven days in who used three sectors or fewer.',
        category: 'oddity', rarity: 'rare',
        test: (_s, v) => !!v && (v.visitedZones?.length ?? 0) <= 3 && v.daysSurvived >= 7,
        nearMiss: (_s, v) => ((v?.visitedZones?.length ?? 0) === 4 && (v?.daysSurvived ?? 0) >= 7
            ? 'they used four sectors in the whole Games' : undefined),
    },
    // ---- The Hippodrome set (arenasSetHippodrome.ts): one or two per arena. ----
    {
        id: 'top-of-the-wheel',
        name: 'Top of the Wheel',
        hint: 'Win the Hippodrome after the lights have come up and failed, having been both up the Ferris wheel and through the Hall of Mirrors.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'hippodrome'
            && state.log.some(e => e.text.startsWith('LIGHTS FAIL:'))
            && (v.visitedZones ?? []).includes('The Ferris Wheel')
            && (v.visitedZones ?? []).includes('Hall of Mirrors'),
        nearMiss: (state, v) => (v && state.arena.id === 'hippodrome' && state.log.some(e => e.text.startsWith('LIGHTS FAIL:'))
            && ['The Ferris Wheel', 'Hall of Mirrors'].filter(z => (v.visitedZones ?? []).includes(z)).length === 1
            ? 'The victor saw the wheel or the mirrors, but not both' : undefined),
        availableIn: state => state.arena.id === 'hippodrome',
    },
    {
        id: 'mind-the-gap',
        name: 'Mind the Gap',
        hint: 'Win the Undercroft after being hit by the ghost train and living through it.',
        category: 'arena',
        rarity: 'possible',
        test: (state, v) => !!v && state.arena.id === 'undercroft'
            && (v.wounds ?? []).some(w => w.cause.startsWith('Hit by the train')),
        nearMiss: (state, v) => (v && state.arena.id === 'undercroft'
            && state.log.some(e => e.tributesInvolved.includes(v.id) && e.text.includes('as the train goes by'))
            ? 'The victor was on the line when the train came, and got out of its way' : undefined),
        availableIn: state => state.arena.id === 'undercroft',
    },
    {
        id: 'out-of-the-frost',
        name: 'Out of the Frost',
        hint: 'Win the Long Vintage after at least three frosts without the frost ever touching the victor.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'vintage'
            && state.log.filter(e => e.text.startsWith('THE FROST:')).length >= 3
            && !(v.wounds ?? []).some(w => w.cause.startsWith('Froze on ')),
        nearMiss: (state, v) => {
            if (!v || state.arena.id !== 'vintage') return undefined;
            if ((v.wounds ?? []).some(w => w.cause.startsWith('Froze on '))) return 'The frost found the victor on the terraces';
            const frosts = state.log.filter(e => e.text.startsWith('THE FROST:')).length;
            return frosts > 0 && frosts < 3 ? `Only ${frosts} frost${frosts === 1 ? '' : 's'} came down before the crown` : undefined;
        },
        availableIn: state => state.arena.id === 'vintage',
    },
    {
        id: 'whiteout-walker',
        name: 'Whiteout Walker',
        hint: 'Win Cinder Peak after a whiteout, having walked the Ridge Line.',
        category: 'arena',
        rarity: 'possible',
        test: (state, v) => !!v && state.arena.id === 'cinderpeak'
            && state.log.some(e => e.text.startsWith('WHITEOUT:'))
            && (v.visitedZones ?? []).includes('The Ridge Line'),
        nearMiss: (state, v) => (v && state.arena.id === 'cinderpeak' && state.log.some(e => e.text.startsWith('WHITEOUT:'))
            && !(v.visitedZones ?? []).includes('The Ridge Line')
            ? 'The whiteout came, and the victor never set foot on the Ridge Line' : undefined),
        availableIn: state => state.arena.id === 'cinderpeak',
    },
    {
        id: 'signal-fire',
        name: 'Signal Fire',
        hint: 'See a fire lit on exposed ground above the treeline give its maker away to the whole mountain.',
        category: 'arena',
        rarity: 'legendary',
        test: state => state.arena.rules?.fireBeacon !== undefined
            && state.log.some(e => e.text.includes('is above anything that could hide it')),
        nearMiss: state => (state.arena.rules?.fireBeacon !== undefined && state.log.some(e => e.type === 'fire-lit')
            ? 'Fires were lit on the mountain, but only where nobody could see them' : undefined),
        availableIn: state => state.arena.rules?.fireBeacon !== undefined,
    },
    {
        id: 'last-bench-standing',
        name: 'Last Bench Standing',
        hint: 'Win the Open Cut after two terraces have given way for good, one of them ground the victor had stood on.',
        category: 'arena',
        rarity: 'legendary',
        test: (state, v) => !!v && state.arena.id === 'opencut'
            && (state.arenaRuleState?.fallen ?? []).length >= 2
            && (state.arenaRuleState?.fallen ?? []).some(z => (v.visitedZones ?? []).includes(z)),
        nearMiss: (state, v) => (v && state.arena.id === 'opencut' && (state.arenaRuleState?.fallen ?? []).length === 1
            ? 'Only one terrace gave way before the crown' : undefined),
        availableIn: state => state.arena.id === 'opencut',
    },
    {
        id: 'rode-it-down',
        name: 'Off the Edge in Time',
        hint: 'Win the Open Cut after getting off a terrace alive as it went into the pit.',
        category: 'arena',
        rarity: 'possible',
        test: (state, v) => !!v && state.arena.id === 'opencut'
            && state.log.some(e => e.tributesInvolved.includes(v.id) && e.text.includes('with the edge going behind their heels')),
        nearMiss: (state, v) => (v && state.arena.id === 'opencut'
            && state.log.some(e => e.text.includes('with the edge going behind their heels'))
            ? 'Somebody got off a falling terrace in time, and it was not the victor' : undefined),
        availableIn: state => state.arena.id === 'opencut',
    },
    // ---- AUDIT-11 §6: relationships and alliances ----
    {
        id: 'enemy-mine',
        name: 'Enemy Mine',
        hint: 'See a tribute pulled up off the ground by somebody they counted as a rival.',
        category: 'social',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'rival-thaw'),
        nearMiss: state => (state.log.some(e => e.type === 'theft-witnessed')
            ? 'An ally became a rival in these Games, but no rival became an ally' : undefined),
    },
    {
        id: 'short-rations',
        name: 'Short Rations',
        hint: 'See somebody turn on the ally who kept eating their share.',
        category: 'social',
        rarity: 'possible',
        test: state => state.log.some(e => e.type === 'grudge-betrayal'),
        nearMiss: state => (state.log.some(e => e.type === 'unfair-split')
            ? 'Somebody was short-changed at the meal, and never collected on it' : undefined),
    },
    {
        id: 'for-the-cameras',
        name: 'For the Cameras',
        hint: 'Reach the end of a Games where one of a pair of lovers was only ever performing.',
        category: 'social',
        rarity: 'rare',
        test: state => state.log.some(e => e.type === 'romance-reveal' && e.text.includes('was performing')),
        nearMiss: state => (state.log.some(e => e.type === 'romance-reveal')
            ? 'There was a romance in these Games, and both of them meant it' : undefined),
    },
    {
        id: 'asleep-at-the-post',
        name: 'Asleep at the Post',
        hint: 'See a watch-keeper fall asleep and the group lose something from the pile for it.',
        category: 'social',
        rarity: 'common',
        test: state => state.log.some(e => e.type === 'watch-failure' && e.important === true),
        nearMiss: state => (state.log.some(e => e.type === 'watch-failure')
            ? 'A watch-keeper slept, and nothing came' : undefined),
    },
    {
        id: 'grief-day',
        name: 'Lost Day',
        hint: 'Win with a tribute who lost a whole day to grief — reckless or shut down — along the way.',
        category: 'social',
        rarity: 'common',
        test: (state, v) => !!v && state.log.some(e => e.type === 'grief-day' && e.tributesInvolved[0] === v.id),
        nearMiss: (state, v) => (v && state.log.some(e => e.type === 'grief-day')
            ? 'Somebody lost a day to grief in these Games, and it was not the victor' : undefined),
    },
    // ---- AUDIT-12 §14: new achievements ----------------------------------
    {
        id: 'a12-held-breath',
        name: 'Held Breath',
        hint: 'Crown a victor who dodged a hazard that would have suffocated them.',
        category: 'survival',
        rarity: 'legendary',
        test: (state, v) => !!v && dodgedCode(state, v, 'asphyxiation'),
    },
    {
        id: 'a12-called-it',
        name: 'Called It',
        hint: 'Score at least 80% of the available points on a prediction slip.',
        category: 'games',
        rarity: 'possible',
        test: state => slipShare(state) >= A12_CALLED_IT_SHARE,
        nearMiss: state => {
            const share = slipShare(state);
            return share >= 0.5 && share < A12_CALLED_IT_SHARE ? `the slip scored ${Math.round(share * 100)}% of its maximum` : undefined;
        },
    },
    {
        id: 'a12-cold-open',
        name: 'Cold Open',
        hint: 'See the first death of the Games come from anything but another tribute.',
        category: 'games',
        rarity: 'rare',
        test: state => {
            const first = firstDeathOf(state.tributes);
            return !!first && deathCodeOf(first) !== 'tribute';
        },
    },
    {
        id: 'a12-borrowed-fire',
        name: 'Borrowed Fire',
        hint: 'Crown a victor who took over an abandoned camp and was never ambushed there.',
        category: 'survival',
        rarity: 'rare',
        test: (state, v) => !!v && (state.audit12Facts?.campsFound?.[v.id]?.length ?? 0) > 0
            && !(state.audit12Facts?.ambushedAtCamp ?? []).includes(v.id),
    },
    {
        id: 'a12-dead-air',
        name: 'Dead Air',
        hint: 'Sit through two full days after day four without a single cannon.',
        category: 'oddity',
        rarity: 'common',
        test: state => longestSilence(state) >= 2,
        nearMiss: state => longestSilence(state) === 1 ? 'one silent day after day four, not two' : undefined,
    },
    {
        id: 'a12-every-way-out',
        name: 'Every Way Out',
        hint: 'See eight or more different causes of death in one Games.',
        category: 'arena',
        rarity: 'rare',
        test: state => distinctCauseCodes(state) >= 8,
        nearMiss: state => {
            const n = distinctCauseCodes(state);
            return n >= 6 && n < 8 ? `${n} different causes of death, ${8 - n} short` : undefined;
        },
    },
    {
        id: 'a12-second-cache',
        name: 'Second Cache',
        hint: 'Crown a victor who read a cache map, or found the arena\'s hidden cache.',
        category: 'arena',
        rarity: 'rare',
        test: (state, v) => !!v && (state.arenaDepth?.hiddenCache?.foundBy === v.id
            || saidOf(state, v, [G7_CACHE_MAP.text, G7_CACHE_MAP_CARTOGRAPHER.text])),
    },
    {
        id: 'a12-scarred-ground',
        name: 'Scarred Ground',
        hint: 'Crown a victor who stood in a zone on the day it burned, flooded or collapsed.',
        category: 'arena',
        rarity: 'common',
        test: (state, v) => !!v && (state.audit12Facts?.scarredGround ?? []).includes(v.id),
    },
    {
        id: 'a12-long-shot',
        name: 'Long Shot',
        hint: 'Crown the tribute with the weakest odds on paper.',
        category: 'reaping',
        rarity: 'possible',
        test: (state, v) => !!v && state.tributes.every(t => oddsScore(t) >= oddsScore(v)),
        nearMiss: (state, v) => {
            if (!v) return undefined;
            const rank = state.tributes.filter(t => oddsScore(t) < oddsScore(v)).length + 1;
            return rank === 2 ? 'the victor had the second-weakest odds on paper' : undefined;
        },
    },
    {
        id: 'a12-hollow-horn',
        name: 'Hollow Horn',
        hint: 'Win under the no-Cornucopia mutator without a single bloodbath kill.',
        category: 'games',
        rarity: 'possible',
        availableIn: state => hasMutator(state.config, 'no-cornucopia'),
        test: (state, v) => !!v && hasMutator(state.config, 'no-cornucopia')
            && !dead(state).some(t => t.diedInBloodbath && killedBy(t, v.id)),
        nearMiss: (state, v) => v && hasMutator(state.config, 'no-cornucopia')
            && dead(state).some(t => t.diedInBloodbath && killedBy(t, v.id))
            ? 'the victor won under an empty horn, but killed at it' : undefined,
    },
    {
        id: 'a12-stormchaser',
        name: 'Stormchaser',
        hint: 'Crown a victor who lived through three or more weather fronts.',
        category: 'arena',
        rarity: 'common',
        test: (state, v) => !!v && frontsSeen(state) >= A12_STORMCHASER_FRONTS,
        nearMiss: state => frontsSeen(state) === A12_STORMCHASER_FRONTS - 1 ? 'two weather fronts, one short' : undefined,
    },
    {
        id: 'a12-ninth-life',
        name: 'Ninth Life',
        hint: 'Crown a victor who went down three times and got up every time.',
        category: 'survival',
        rarity: 'possible',
        test: (state, v) => !!v && (state.audit12Facts?.downed?.[v.id] ?? 0) >= 3,
        nearMiss: (state, v) => {
            const n = v ? state.audit12Facts?.downed?.[v.id] ?? 0 : 0;
            return n > 0 && n < 3 ? `the victor went down ${n === 1 ? 'once' : 'twice'} and got up` : undefined;
        },
    },
    {
        id: 'a12-last-rites',
        name: 'Last Rites',
        hint: 'Crown a victor who stopped to bury an ally.',
        category: 'social',
        rarity: 'possible',
        test: (state, v) => !!v && saidOf(state, v, [G7_BURIAL.text]),
        nearMiss: (state, v) => !(v && saidOf(state, v, [G7_BURIAL.text]))
            && state.tributes.some(t => saidOf(state, t, [G7_BURIAL.text]))
            ? 'somebody stopped to bury an ally, and did not win' : undefined,
    },
    {
        id: 'a12-unmoved',
        name: 'Unmoved',
        hint: 'Crown a victor who never left the zone they started in.',
        category: 'oddity',
        rarity: 'possible',
        test: (state, v) => !!v && (v.visitedZones?.length ?? 0) === 1,
        nearMiss: (state, v) => v && (v.visitedZones?.length ?? 0) === 2 ? 'the victor only ever stood in two zones' : undefined,
    },
    {
        id: 'a12-fed-by-foes',
        name: 'Fed by Foes',
        hint: 'Crown a victor who was paid food by a tribute from another side.',
        category: 'social',
        rarity: 'legendary',
        test: (state, v) => !!v && state.log.some(e => e.type === 'tribute-paid'
            && e.tributesInvolved[1] === v.id && FOOD_NAMES.some(n => e.text.includes(n))),
    },
    {
        id: 'a12-rust-and-ruin',
        name: 'Rust and Ruin',
        hint: 'Crown a victor who survived an infection in an arena full of rust.',
        category: 'arena',
        rarity: 'legendary',
        availableIn: state => /rust/i.test(state.arena.description ?? ''),
        test: (state, v) => !!v && /rust/i.test(state.arena.description ?? '')
            && state.log.some(e => (e.type === 'wound-turned' || e.type === 'fever-lines' || e.type === 'sepsis-treated')
                && e.tributesInvolved.includes(v.id)),
    },
    {
        id: 'a12-keepers-key',
        name: 'The Keeper\'s Key',
        hint: 'Win the Menagerie with the tribute who opened an enclosure.',
        category: 'arena',
        rarity: 'possible',
        availableIn: state => state.arena.id === 'menagerie',
        test: (state, v) => !!v && state.arena.id === 'menagerie' && saidOf(state, v, [G7_KEEPERS_KEYS.text]),
        nearMiss: (state, v) => state.arena.id === 'menagerie' && (state.firedEvents ?? []).includes(G7_KEEPERS_KEYS.id!)
            && !(v && saidOf(state, v, [G7_KEEPERS_KEYS.text]))
            ? 'somebody found the keeper\'s keys, and it was not the victor' : undefined,
    },
    {
        id: 'a12-wrong-turn',
        name: 'Wrong Turn',
        hint: 'In the Labyrinth, see a tribute die in a dead end on a day the victor found the way out of one.',
        category: 'arena',
        rarity: 'possible',
        availableIn: state => state.arena.id === 'labyrinth',
        test: (state, v) => {
            if (!v || state.arena.id !== 'labyrinth') return false;
            const deadEnd = arenaFlavor('labyrinth').events.find(e => /dead end/i.test(e.cause));
            if (!deadEnd?.escapeText) return false;
            const escaped = lineMatcher(deadEnd.escapeText);
            const days = new Set(state.log.filter(e => e.tributesInvolved[0] === v.id && escaped.test(e.text)).map(e => e.day));
            return dead(state).some(t => t.causeOfDeath === deadEnd.cause && days.has(t.dayOfDeath ?? -1));
        },
        nearMiss: state => state.arena.id === 'labyrinth' && dead(state).some(t => /dead end/i.test(t.causeOfDeath ?? ''))
            ? 'somebody died in a dead end, on a day the victor was nowhere near one' : undefined,
    },
    {
        id: 'a12-airlock',
        name: 'Airlock',
        hint: 'Win Kelvin-9 with a tribute who sealed a bulkhead on a rival.',
        category: 'arena',
        rarity: 'possible',
        availableIn: state => state.arena.id === 'kelvin',
        test: (state, v) => !!v && state.arena.id === 'kelvin' && saidOf(state, v, [G7_AIRLOCK.text]),
        nearMiss: (state, v) => state.arena.id === 'kelvin'
            && state.tributes.some(t => t.id !== v?.id && saidOf(state, t, [G7_AIRLOCK.text]))
            ? 'a bulkhead was sealed on somebody, but not by the victor' : undefined,
    },
    {
        id: 'a12-once-upon-a-time',
        name: 'Once Upon a Time',
        hint: 'Win the Story Wood having lived through all three fairy-tale tableaux.',
        category: 'arena',
        rarity: 'possible',
        availableIn: state => state.arena.id === 'storywood',
        test: (state, v) => !!v && state.arena.id === 'storywood' && tableauxSurvived(state, v) >= 3,
        nearMiss: (state, v) => {
            const n = v && state.arena.id === 'storywood' ? tableauxSurvived(state, v) : 0;
            return n > 0 && n < 3 ? `the victor lived through ${n} of the three tableaux` : undefined;
        },
    },
];


/**
 * S-3: career-wide achievements, evaluated against the persistent Panem
 * records rather than a single run — cumulative counts and per-district
 * completion, which is also how the D10 problem gets surfaced to players
 * directly ("you have never crowned District 10").
 */
export interface CareerTotals {
    runs: number;
    victors: number;
    /** Total deaths witnessed across every finished run. */
    deaths: number;
    /** Districts that have ever produced a victor. */
    crownedDistricts: number[];
    /** Distinct arenas a victor has been crowned in. */
    arenasWon: string[];
    /** Distinct Quarter Quell ids this player has run, win or lose. */
    quellsSeen: string[];
    /** §10.1: distinct arena-law ids a victor has been crowned under. */
    lawsWonUnder?: string[];
    /** §10.1: distinct procedural biome ids a victor has been crowned in. */
    biomesWon?: string[];
    /** §10.1: hand-authored arenas won, against the total that exist. */
    handAuthoredWon?: number;
    handAuthoredTotal?: number;
    /** §10.1: canonical (hand-authored) mutts witnessed, against the bestiary's size. */
    canonicalMuttsSeen?: number;
    canonicalMuttTotal?: number;
    /** §10.1: victories by the player's standing patron district. */
    patronWins?: number;
    /** §10.1: consecutive finished runs won by the same district, as of now. */
    dynastyStreak?: number;
    /** §10.1: the most simultaneous record-book bests held by one tribute. */
    maxSimultaneousBests?: number;
    /** §11: distinct Head Gamemakers who have run one of this player's Games. */
    gamemakersSeen?: number;
    gamemakerTotal?: number;
    /** §11: the most crowned Games any one Head Gamemaker has run for this player. */
    maxCrownsUnderOneGamemaker?: number;
    quellTotal?: number;
    /** AUDIT-11 §14: distinct archetypes ever crowned, against the roster's size. */
    archetypesCrowned?: string[];
    archetypeTotal?: number;
    /** AUDIT-11 §14: distinct death-cause codes ever witnessed, against the taxonomy's size. */
    causeCodesSeen?: string[];
    causeCodeTotal?: number;
    /** AUDIT-11 §14: distinct seeds that reached a finished run. */
    seedsCompleted?: number;
    /** AUDIT-11 §14: consecutive finished runs without a Career victor, as of now. */
    nonCareerStreak?: number;
    /** AUDIT-11 §12: prediction slips scored, victors called, and slips scoring half their maximum. */
    predictionsScored?: number;
    victorsCalled?: number;
    sharpCalls?: number;
    /** AUDIT-11 §8: parlays that paid out. */
    parlaysLanded?: number;
    /** AUDIT-12 §14: consecutive scored slips that named the victor, as of now. */
    victorCallStreak?: number;
}

export interface MetaAchievement {
    id: string;
    name: string;
    hint: string;
    test: (totals: CareerTotals) => boolean;
    /**
     * How far along a cumulative entry is, for a progress bar. "A Thousand
     * Deaths" showed locked or unlocked and never 612/1000, though every
     * number a bar needs was already in `CareerTotals`.
     */
    progress?: (totals: CareerTotals) => { have: number; need: number };
}

export const META_ACHIEVEMENTS: MetaAchievement[] = [
    // §11: the collector shelf, extended.
    {
        id: 'meta-every-quell',
        name: 'Every Quell',
        hint: 'See every Quarter Quell on the books play out.',
        test: t => t.quellTotal !== undefined && t.quellsSeen.length >= t.quellTotal,
        progress: t => ({ have: t.quellsSeen.length, need: t.quellTotal ?? 0 }),
    },
    {
        id: 'meta-every-gamemaker',
        name: 'Every Gamemaker',
        hint: 'Have every Head Gamemaker run one of your Games.',
        test: t => t.gamemakerTotal !== undefined && (t.gamemakersSeen ?? 0) >= t.gamemakerTotal,
        progress: t => ({ have: t.gamemakersSeen ?? 0, need: t.gamemakerTotal ?? 0 }),
    },
    {
        id: 'meta-same-song',
        name: 'Same Song',
        hint: 'See the same Head Gamemaker crown two victors.',
        test: t => (t.maxCrownsUnderOneGamemaker ?? 0) >= 2,
    },
    {
        id: 'meta-thousand-deaths',
        name: 'A Thousand Deaths',
        hint: 'Watch a thousand tributes die.',
        test: t => t.deaths >= 1000,
        progress: t => ({ have: t.deaths, need: 1000 }),
    },
    {
        id: 'meta-ten-patron-crowns',
        name: 'Ten Patron Crowns',
        hint: 'Bring home ten victories for your patron district.',
        test: t => (t.patronWins ?? 0) >= 10,
        progress: t => ({ have: t.patronWins ?? 0, need: 10 }),
    },
    {
        id: 'meta-ten-games',
        name: 'A Regular',
        hint: 'Finish ten Games.',
        test: t => t.runs >= 10,
        progress: t => ({ have: t.runs, need: 10 }),
    },
    {
        id: 'meta-fifty-games',
        name: 'The Career, So To Speak',
        hint: 'Finish fifty Games.',
        test: t => t.runs >= 50,
        progress: t => ({ have: t.runs, need: 50 }),
    },
    {
        id: 'meta-hundred-deaths',
        name: 'The Price of the Show',
        hint: 'Witness one hundred deaths across all your Games.',
        test: t => t.deaths >= 100,
        progress: t => ({ have: t.deaths, need: 100 }),
    },
    {
        id: 'meta-half-panem',
        name: 'Half of Panem',
        hint: 'Crown victors from six different districts.',
        test: t => t.crownedDistricts.length >= 6,
        progress: t => ({ have: t.crownedDistricts.length, need: 6 }),
    },
    {
        id: 'meta-all-twelve',
        name: 'Every District\'s Year',
        hint: 'Crown a victor from every one of the twelve districts.',
        test: t => t.crownedDistricts.length >= 12,
        progress: t => ({ have: t.crownedDistricts.length, need: 12 }),
    },
    {
        id: 'meta-grand-tour',
        name: 'The Grand Tour',
        hint: 'Crown victors in ten different arenas.',
        test: t => t.arenasWon.length >= 10,
        progress: t => ({ have: t.arenasWon.length, need: 10 }),
    },
    {
        id: 'meta-two-hundred-deaths',
        name: 'The Show Must Go On',
        hint: 'Witness two hundred deaths across all your Games.',
        test: t => t.deaths >= 200,
        progress: t => ({ have: t.deaths, need: 200 }),
    },
    {
        id: 'meta-quell-collector',
        name: "The Capitol's Whims",
        hint: 'See five different Quarter Quells play out, win or lose.',
        test: t => t.quellsSeen.length >= 5,
        progress: t => ({ have: t.quellsSeen.length, need: 5 }),
    },
    {
        id: 'meta-hundred-games',
        name: 'A Life\'s Work',
        hint: 'Finish one hundred Games.',
        test: t => t.runs >= 100,
        progress: t => ({ have: t.runs, need: 100 }),
    },
    // §10.1: the collector shelf — career-wide completions over the stored
    // records that today's work started keeping (laws, biomes, the bestiary).
    {
        id: 'meta-law-abiding',
        name: 'Law Abiding',
        hint: 'Crown victors under all six of the arena laws.',
        test: t => (t.lawsWonUnder?.length ?? 0) >= 6,
        progress: t => ({ have: t.lawsWonUnder?.length ?? 0, need: 6 }),
    },
    {
        id: 'meta-every-biome',
        name: 'Every Biome',
        // §10.6: the biome roster went from eight to twelve, and an
        // achievement that counts a roster has to count the roster it has
        // rather than the one it shipped against.
        hint: 'Crown a victor in all twelve of the Gamemakers\' procedural biomes.',
        test: t => (t.biomesWon?.length ?? 0) >= PROCEDURAL_BIOME_COUNT,
        progress: t => ({ have: t.biomesWon?.length ?? 0, need: PROCEDURAL_BIOME_COUNT }),
    },
    {
        id: 'meta-twenty-eight',
        name: 'Twenty-Eight',
        hint: 'Crown a victor in every hand-authored arena the Capitol has ever built.',
        test: t => (t.handAuthoredTotal ?? 0) > 0 && (t.handAuthoredWon ?? 0) >= (t.handAuthoredTotal ?? Infinity),
        progress: t => ({ have: t.handAuthoredWon ?? 0, need: t.handAuthoredTotal ?? 0 }),
    },
    {
        id: 'meta-patrons-return',
        name: "Patron's Return",
        hint: 'See the district you patronise bring a victor home.',
        test: t => (t.patronWins ?? 0) >= 1,
    },
    {
        id: 'meta-dynasty',
        name: 'The Dynasty',
        hint: 'See one district win three Games in a row.',
        test: t => (t.dynastyStreak ?? 0) >= 3,
        progress: t => ({ have: t.dynastyStreak ?? 0, need: 3 }),
    },
    {
        id: 'meta-full-bestiary',
        name: 'Full Bestiary',
        hint: 'Witness every named mutt the Gamemakers have on file, across all your Games.',
        test: t => (t.canonicalMuttTotal ?? 0) > 0 && (t.canonicalMuttsSeen ?? 0) >= (t.canonicalMuttTotal ?? Infinity),
        progress: t => ({ have: t.canonicalMuttsSeen ?? 0, need: t.canonicalMuttTotal ?? 0 }),
    },
    {
        id: 'meta-statistician',
        name: 'Statistician',
        hint: 'See one tribute hold five of the record book\'s bests at the same time.',
        test: t => (t.maxSimultaneousBests ?? 0) >= 5,
        progress: t => ({ have: t.maxSimultaneousBests ?? 0, need: 5 }),
    },
    {
        id: 'meta-long-memory',
        name: 'Long Memory',
        hint: 'Finish five hundred Games.',
        test: t => t.runs >= 500,
        progress: t => ({ have: t.runs, need: 500 }),
    },
    // AUDIT-11 §14: four more collector shelves.
    {
        id: 'meta-every-archetype',
        name: 'Every Archetype',
        hint: 'Crown a victor of every archetype on the books.',
        test: t => (t.archetypeTotal ?? 0) > 0 && (t.archetypesCrowned?.length ?? 0) >= (t.archetypeTotal ?? Infinity),
        progress: t => ({ have: t.archetypesCrowned?.length ?? 0, need: t.archetypeTotal ?? 0 }),
    },
    {
        id: 'meta-every-death',
        name: 'Every Death',
        hint: 'Witness a death under every cause code the Capitol records.',
        test: t => (t.causeCodeTotal ?? 0) > 0 && (t.causeCodesSeen?.length ?? 0) >= (t.causeCodeTotal ?? Infinity),
        progress: t => ({ have: t.causeCodesSeen?.length ?? 0, need: t.causeCodeTotal ?? 0 }),
    },
    {
        id: 'meta-ninety-nine-seeds',
        name: 'Ninety-Nine Seeds',
        hint: 'Finish Games on ninety-nine different seeds.',
        test: t => (t.seedsCompleted ?? 0) >= 99,
        progress: t => ({ have: t.seedsCompleted ?? 0, need: 99 }),
    },
    {
        id: 'meta-no-career-season',
        name: 'No Career Season',
        hint: 'See five Games in a row crown somebody who is not a Career.',
        test: t => (t.nonCareerStreak ?? 0) >= 5,
        progress: t => ({ have: t.nonCareerStreak ?? 0, need: 5 }),
    },
    // AUDIT-11 §12: prediction mode and parlays.
    {
        id: 'meta-oracle',
        name: 'Oracle',
        hint: 'Name the victor on your prediction slip in three different Games.',
        test: t => (t.victorsCalled ?? 0) >= 3,
        progress: t => ({ have: t.victorsCalled ?? 0, need: 3 }),
    },
    {
        id: 'meta-sharp-book',
        name: 'Sharp Book',
        hint: 'Score at least half the available points on five prediction slips.',
        test: t => (t.sharpCalls ?? 0) >= 5,
        progress: t => ({ have: t.sharpCalls ?? 0, need: 5 }),
    },
    {
        id: 'meta-parlay',
        name: 'Every Leg Home',
        hint: 'Land a parlay: a victor named correctly in every Games it spans.',
        test: t => (t.parlaysLanded ?? 0) >= 1,
        progress: t => ({ have: t.parlaysLanded ?? 0, need: 1 }),
    },    // AUDIT-12 §14.
    {
        id: 'meta-taxonomist',
        name: 'Taxonomist',
        hint: 'See twenty different causes of death across your saved Games.',
        test: t => (t.causeCodesSeen?.length ?? 0) >= 20,
        progress: t => ({ have: t.causeCodesSeen?.length ?? 0, need: 20 }),
    },
    {
        id: 'meta-parlay-streak',
        name: 'Parlay',
        hint: 'Name the victor correctly on three prediction slips in a row.',
        test: t => (t.victorCallStreak ?? 0) >= 3,
        progress: t => ({ have: Math.min(3, t.victorCallStreak ?? 0), need: 3 }),
    },
];

export function evaluateMetaAchievements(totals: CareerTotals): string[] {
    return META_ACHIEVEMENTS.filter(a => {
        try {
            return a.test(totals);
        } catch {
            return false;
        }
    }).map(a => a.id);
}

/** Which achievements this finished run earned. */
/**
 * Achievements this run did not earn but came measurably close to. Only
 * reported for achievements the player has never unlocked — telling somebody
 * they nearly did a thing they have already done is noise.
 */
export function evaluateNearMisses(state: GameState, unlocked: string[]): NearMiss[] {
    const victor = state.tributes.find(t => t.status === 'alive');
    const misses: NearMiss[] = [];
    ACHIEVEMENTS.forEach(a => {
        if (unlocked.includes(a.id) || !a.nearMiss) return;
        try {
            if (a.test(state, victor)) return;
            const detail = a.nearMiss(state, victor);
            if (detail) misses.push({ id: a.id, name: a.name, detail });
        } catch {
            // A malformed or older save must never break the end screen.
        }
    });
    return misses.slice(0, 3);
}

/**
 * §6.5: achievements were invisible during play — 25 of them with a NearMiss
 * evaluator, surfaced only after the run ended. This runs the same evaluators
 * mid-run (victor deliberately undefined: mid-run there is no victor, and
 * every victor-dependent nearMiss already guards on it) so the sidebar can
 * show "two districts from a clean sweep" while it still matters.
 */
export function evaluateInRunNearMisses(state: GameState, unlocked: string[]): NearMiss[] {
    if (state.phase === 'ended') return [];
    const misses: NearMiss[] = [];
    ACHIEVEMENTS.forEach(a => {
        if (unlocked.includes(a.id) || !a.nearMiss) return;
        try {
            // §1.2: never nudge the player towards something this arena
            // cannot produce.
            if (a.availableIn && !a.availableIn(state)) return;
            const detail = a.nearMiss(state, undefined);
            if (detail) misses.push({ id: a.id, name: a.name, detail });
        } catch {
            // Mid-run state a nearMiss did not anticipate must never break the UI.
        }
    });
    return misses.slice(0, 2);
}

/**
 * §1.2 (audit): the achievements this run's arena can actually produce. The
 * record book lists everything; anything that advertises an achievement *for
 * this run* should draw from this instead.
 */
export function achievementsAvailableIn(state: GameState): Achievement[] {
    return ACHIEVEMENTS.filter(a => {
        try {
            return !a.availableIn || a.availableIn(state);
        } catch {
            return true;
        }
    });
}

export function evaluateAchievements(state: GameState): string[] {
    const victor = state.tributes.find(t => t.status === 'alive');
    return ACHIEVEMENTS.filter(a => {
        try {
            return a.test(state, victor);
        } catch {
            // A malformed or older save must never break the end screen.
            return false;
        }
    }).map(a => a.id);
}
