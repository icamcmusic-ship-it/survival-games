import { INTERVIEW_PERSONAS } from './personas';
import { TRAIT_DEFS } from './traits';
import { GameState, Tribute } from '../models/types';
import { arenaFlavor } from './arenaFlavor';
import { legacyOf } from './districts';
import { PROCEDURAL_BIOME_COUNT } from '../engine/arenaGenerator';
import { ACHIEVEMENT_BARS } from './balance';
import { isStarCrossed } from '../engine/alliance';

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

/**
 * Traits that can only be picked up in the arena. Derived from `TRAIT_DEFS`
 * rather than hand-mirrored: the copy this used to be omitted `Broken` and
 * `Hollow`, so a Pacifist who came home Broken did not count as changed by
 * it, and a victor who transformed a trait could still take a Clean Slate.
 */
const EARNED_TRAIT_NAMES = Object.keys(TRAIT_DEFS).filter(name => TRAIT_DEFS[name].earned);
const dead = (state: GameState) => state.tributes.filter(t => t.status === 'dead');

/**
 * Audit 3 §11: every way of breaking your word, not just the one the alliance
 * layer logs.
 *
 * `betrayalsCommitted` is incremented by exactly two sites — walking out of an
 * alliance, and breaking a standing truce — and a *victor* tops out at one of
 * those across 500 runs however busy the field is (5.69 betrayals a run).
 * `faithBroken` is the rest of it. `engine/epithets.ts` already sums the two to
 * decide who the country calls a Turncoat; the achievement table asks the same
 * question and should count the same way.
 */
function faithlessness(t: Tribute): number {
    return (t.betrayalsCommitted ?? 0) + (t.faithBroken ?? 0);
}

export const ACHIEVEMENTS: Achievement[] = [
    // §11 (audit): the systems the achievement layer had the same blind spot
    // about as the interface did. Rumours, epithets, sponsor blocs, charters,
    // named weapons and the ex-ally layer were all fully simulated and
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
        rarity: 'legendary',
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
        rarity: 'rare',
        // Audit 3 §1.6: an exposed claim is retired from the pool, so reading
        // the pool at the end was reading for the one thing that is removed.
        test: state => state.plantedRumourExposed === true,
        nearMiss: state => ((state.maxPlantedInCirculation ?? 0) > 0 && !state.plantedRumourExposed
            ? 'Somebody planted a lie and nobody ever went to look'
            : undefined),
    },
    {
        id: 'named-by-the-country',
        name: 'Named by the Country',
        hint: 'Crown a victor who earned an epithet in the arena.',
        category: 'capitol',
        rarity: 'common',
        test: (_s, v) => !!v && !!v.epithet,
    },
    {
        id: 'named-early',
        name: 'Named Early',
        // Audit 2 §1.10: four cycles fired on 63.5% of runs, because the
        // bloodbath alone hands out enough kills to earn a name. Two is the
        // window in which the country naming somebody is genuinely early.
        hint: 'Have a tribute earn an epithet within the first two cycles of the Games.',
        category: 'capitol',
        rarity: 'rare',
        test: state => state.tributes.some(t => t.epithet !== undefined && (t.epithetCycle ?? 99) <= 2),
        nearMiss: state => { const e = state.tributes.filter(t => !!t.epithet).map(t => t.epithetCycle ?? 99).sort((a, b) => a - b)[0]; return e !== undefined && e > 2 && e <= 5 ? `The first epithet of these Games was awarded on cycle ${e} — ${e - 2} cycles late` : undefined; },
    },
    {
        id: 'three-names',
        name: 'Three Names',
        hint: 'Have three tributes carrying earned epithets alive at the same time.',
        category: 'capitol',
        rarity: 'common',
        test: state => state.tributes.filter(t => !!t.epithet).length >= 3,
        nearMiss: state => {
            const n = state.tributes.filter(t => !!t.epithet).length;
            return n === 2 ? 'Two tributes were named by the country — one short' : undefined;
        },
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
        id: 'a-weapon-with-a-name',
        name: 'A Weapon With a Name',
        hint: 'Crown a victor holding a weapon that earned a name of its own in the arena.',
        category: 'combat',
        rarity: 'common',
        test: (_s, v) => !!v && v.inventory.some(i => !!i.legendName),
    },
    {
        id: 'it-changed-hands',
        name: 'It Changed Hands',
        hint: 'End a Games with a named weapon held by somebody other than the tribute who named it.',
        category: 'combat',
        rarity: 'common',
        test: state => state.tributes.some(t => t.status === 'alive'
            && t.inventory.some(i => !!i.legendName)
            && state.tributes.some(o => o.id !== t.id && o.status === 'dead' && (o.kills ?? 0) > 0)),
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
                return !other || other.causeOfDeath === undefined || !other.causeOfDeath.includes(v.name);
            }),
        nearMiss: (state, v) => {
            if (!v || (v.formerAllies ?? []).length === 0) return undefined;
            const killed = (v.formerAllies ?? []).filter(id => {
                const other = state.tributes.find(o => o.id === id);
                return other?.causeOfDeath?.includes(v.name);
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
        rarity: 'rare',
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
        hint: 'Crown a victor who went through five or more of the fallen.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.corpsesLooted ?? 0) >= 5,
        nearMiss: (_s, v) => {
            const n = v?.corpsesLooted ?? 0;
            return n >= 3 && n < 5 ? `${v!.name} went through ${n} of the fallen — ${5 - n} short` : undefined;
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
        rarity: 'rare',
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
        rarity: 'rare',
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
        hint: 'Crown a victor who broke faith twice and was never once betrayed themselves.',
        category: 'social',
        rarity: 'legendary',
        // Audit 3 §11: and the axis moved, because the rung could not.
        // `betrayalsCommitted` counts one specific act — walking out of an
        // alliance on somebody — and a victor tops out at one of those across
        // 500 runs, whatever the field does (5.69 betrayals a run). `epithets.ts`
        // already knew the answer: the Turncoat epithet is awarded off
        // `betrayalsCommitted + faithBroken`, which is every way of breaking
        // your word rather than the one the alliance layer happens to log.
        test: (_s, v) => !!v && faithlessness(v) >= 2 && (v.memory?.timesBetrayed ?? 0) === 0,
        nearMiss: (_s, v) => (v && faithlessness(v) >= 2 && (v.memory?.timesBetrayed ?? 0) > 0)
            ? `${v.name} broke their word twice and had it broken right back`
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
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.forageSuccesses ?? 0) >= 5,
        nearMiss: (_s, v) => { const n = v?.forageSuccesses ?? 0; return n >= 3 && n < 5 ? `${v!.name} foraged successfully ${n} times — ${5 - n} short` : undefined; },
    },
    {
        id: 'unmarked',
        name: 'Unmarked',
        hint: 'Crown a victor who never logged a single wound all Games.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.woundsLogged ?? 0) === 0,
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
        rarity: 'rare',
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
        rarity: 'legendary',
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
        test: (_s, v) => !!v && (v.forageSuccesses ?? 0) === 0,
    },
    {
        id: 'fever-dream',
        name: 'Fever Dream',
        hint: 'See a tribute cut back from a septic wound that was going to kill them.',
        category: 'survival',
        rarity: 'legendary',
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
        id: 'one-wound',
        name: 'One Wound',
        hint: 'Crown a victor carrying exactly one scar.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && Object.values(v.scars ?? {}).filter(Boolean).length === 1,
        nearMiss: (_s, v) => {
            const scars = v ? Object.values(v.scars ?? {}).filter(Boolean).length : 0;
            return v && scars > 1
                ? `${v.name} came home with ${scars} scars — one is the achievement, and it is harder than none`
                : undefined;
        },
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
        rarity: 'legendary',
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
        rarity: 'rare',
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
        name: 'The Youngest',
        hint: 'Crown a victor aged fourteen or under.',
        category: 'reaping',
        rarity: 'legendary',
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
        rarity: 'rare',
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
        test: state => state.log.some(e =>
            e.text.includes('there is no pack this year') || e.text.includes('no longer anybody\'s allies')),
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
        rarity: 'common',
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
        rarity: 'rare',
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
        rarity: 'rare',
        test: state => state.day <= 6,
        nearMiss: state => state.day > 6 && state.day <= 8
            ? `these Games ran ${state.day} days — ${state.day - 6} over`
            : undefined,
    },
    {
        id: 'bloodbath-massacre',
        name: 'The Cornucopia',
        hint: 'See half the field or more die in the bloodbath.',
        category: 'combat',
        rarity: 'rare',
        test: state => {
            const day1 = dead(state).filter(t => t.dayOfDeath === 1).length;
            return day1 >= state.tributes.length / 2;
        },
        nearMiss: state => {
            const day1 = dead(state).filter(t => t.dayOfDeath === 1).length;
            const needed = Math.ceil(state.tributes.length / 2);
            return day1 > 0 && needed - day1 <= 3 && day1 < needed
                ? `the bloodbath took ${day1} — ${needed - day1} short of half the field`
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
            const byTribute = dead(state).filter(t => t.causeOfDeath?.startsWith('Killed by')).length;
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
        rarity: 'common',
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
        rarity: 'possible',
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
        rarity: 'legendary',
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
        test: state => state.tributes.some(t => t.causeOfDeath?.includes('nightlock')),
    },
    {
        id: 'wildfire',
        name: 'Let It Burn',
        hint: 'See a fire spread from one sector into the next.',
        category: 'arena',
        rarity: 'rare',
        test: state => state.log.some(e => /The fire in .* jumps to/.test(e.text)),
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
        rarity: 'legendary',
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
        test: (state, v) => !!v && !state.log.some(e => e.category === 'alliance' && e.tributesInvolved.includes(v.id)),
    },
    {
        id: 'debt-unsettled',
        name: 'Still Owed',
        hint: 'Crown a victor who walked out of the arena still owing somebody.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.debts ?? {}).some(d => d > 0),
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
        hint: 'Crown a victor who never once logged a standing injury — not a scratch, not a burn, not a break.',
        // §11: this read the victor's *live* injuries, so it counted anyone
        // who happened to be patched up by the cannon and fired on 76.3% of
        // runs. `woundsLogged` (engine/wounds.ts) is the history the hint was
        // describing all along.
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.woundsLogged ?? 0) <= ACHIEVEMENT_BARS.cleanGetawayWounds,
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
        rarity: 'possible',
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
        rarity: 'legendary',
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
        rarity: 'legendary',
        test: state => Object.values(state.allianceDeposals ?? {}).reduce((a, n) => a + n, 0) >= 2,
        nearMiss: state => Object.values(state.allianceDeposals ?? {}).reduce((a, n) => a + n, 0) === 1
            ? 'one alliance deposed its leader — a second coup short of a mutiny'
            : undefined,
    },
    {
        id: 'charter-kept',
        name: 'Charter Kept',
        hint: 'See an alliance of three or more reach the final eight without a single charter breach.',
        category: 'social',
        rarity: 'common',
        test: state => state.charterKeptSeen === true,
    },
    {
        id: 'blood-feud',
        name: 'Blood Feud',
        hint: 'See one pair of tributes fight each other four separate times.',
        category: 'combat',
        rarity: 'rare',
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
        rarity: 'rare',
        test: state => dead(state).some(t =>
            /collapsing border|border closed/.test(t.causeOfDeath ?? '')),
    },
    {
        id: 'held-the-horn',
        name: 'Held the Horn',
        hint: 'Hold the Cornucopia for six consecutive cycles.',
        category: 'combat',
        rarity: 'rare',
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
        nearMiss: (state, v) => v && (v.trapKills ?? 0) === 0
            && state.log.some(e => e.tributesInvolved.includes(v.id) && /\btrap\b/i.test(e.text))
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
        rarity: 'rare',
        test: state => dead(state).some(t =>
            t.poisonedByWeapon === true && /poison/i.test(t.causeOfDeath ?? '')),
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
        test: state => state.log.some(e => /three[- ]finger/i.test(e.text))
            || state.tributes.some(t => /three[- ]finger|three fingers/i.test(t.reapingNote ?? '')),
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
        hint: 'Meet every mutt in one arena\'s roster in a single Games.',
        category: 'arena',
        rarity: 'common',
        test: state => {
            // `muttsSeen` records engine encounters by name; the arena's
            // `mutts` list is the same names as flavour. Procedural arenas
            // carry their real roster on `muttRoster`.
            const roster = state.arena.muttRoster?.map(m => m.name) ?? state.arena.mutts;
            return roster.length >= 3 && roster.every(name => (state.muttsSeen ?? []).includes(name));
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
        rarity: 'legendary',
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
        rarity: 'common',
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
        rarity: 'rare',
        test: (_s, v) => !!v && (v.walkedIntoEffect ?? 0) >= 3,
        nearMiss: (_s, v) => {
            const walked = v?.walkedIntoEffect ?? 0;
            return (v && walked >= 1 && walked < 3)
                ? `${v.name} walked into a sector under an active effect ${walked === 1 ? 'once' : `${walked} times`} — ${3 - walked} short of storm chaser`
                : undefined;
        },
    },
    {
        id: 'the-tally',
        name: 'The Tally',
        hint: 'Crown a victor whose district partner died in the bloodbath itself, and who outlasted the whole field alone.',
        category: 'social',
        rarity: 'common',
        test: (state, v) => !!v && state.tributes.some(o =>
            o.id !== v.id && o.district === v.district && o.status === 'dead' && o.diedInBloodbath === true),
    },
    {
        id: 'clean-slate',
        name: 'Clean Slate',
        hint: 'Crown a victor who gained no traits in the arena and lost none — exactly who they went in as.',
        category: 'survival',
        rarity: 'possible',
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
        rarity: 'legendary',
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
        rarity: 'possible',
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
        rarity: 'rare',
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
        rarity: 'legendary',
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
        hint: 'Crown a victor carrying three or more separate injuries.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && Object.values(v.injuries).filter(Boolean).length >= 3,
        nearMiss: (_s, v) => (v && Object.values(v.injuries).filter(Boolean).length === 2)
            ? `${v.name} was crowned carrying two injuries — Walking Wounded carries three`
            : undefined,
    },
    {
        id: 'unpaid-crown',
        name: 'Still Owing',
        hint: 'Crown a victor who still owes somebody a debt.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && Object.values(v.debts ?? {}).some(d => d > 0),
    },
    {
        id: 'rumour-mill',
        name: 'Rumour Mill',
        hint: 'See three or more rumours still in circulation when the Games end.',
        category: 'social',
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
        name: 'A Blade With a Name',
        hint: 'Crown a victor carrying a weapon that earned a name in the arena.',
        category: 'combat',
        rarity: 'common',
        test: (_s, v) => !!v && v.inventory.some(i => i.legendName !== undefined),
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
        rarity: 'legendary',
        test: state => {
            const dead = state.tributes.filter(t => t.status === 'dead');
            const byHand = dead.filter(t => (t.causeOfDeath ?? '').startsWith('Killed by ')).length;
            return dead.length >= 8 && byHand * 3 <= dead.length;
        },
        nearMiss: state => {
            const dead = state.tributes.filter(t => t.status === 'dead');
            const byHand = dead.filter(t => (t.causeOfDeath ?? '').startsWith('Killed by ')).length;
            return dead.length >= 8 && byHand * 3 > dead.length && byHand * 2 < dead.length
                ? 'more died to the arena than to each other — Nothing but Sky wants two in three'
                : undefined;
        },
    },
    {
        id: 'epithet-victor',
        name: 'Known As',
        hint: 'Crown a victor who earned an epithet before the crown.',
        category: 'oddity',
        rarity: 'common',
        test: (_s, v) => !!v && v.epithet !== undefined,
    },
    {
        id: 'long-truce',
        name: 'The Long Truce',
        hint: 'Crown a victor whose truce was renewed twice with the same tribute.',
        category: 'social',
        rarity: 'legendary',
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
        hint: 'Crown a victor from a district whose Games history is listed as forgotten.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && legacyOf(v.district).tier === 'forgotten',
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
        rarity: 'common',
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
        hint: 'Crown a victor who inherited an alliance from a leader who died.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && v.succeededAsHeir === true,
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
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.visitedZones?.length ?? 0) === 1,
        nearMiss: (_s, v) => {
            const n = v?.visitedZones?.length ?? 0;
            return n === 2 ? `${v!.name} set foot in two sectors all run — one more than this asks for` : undefined;
        },
    },
    {
        id: 'two-crowns',
        name: 'Two Crowns',
        hint: 'End a Games with two victors still standing.',
        category: 'oddity',
        rarity: 'legendary',
        // Gives `victorIds` its first reader: it is only ever written on a dual
        // victory, so every other run left the field empty and unread.
        test: state => (state.victorIds?.length ?? 0) >= 2
            || state.tributes.filter(t => t.status === 'alive').length >= 2,
        nearMiss: state => (state.tributes.filter(t => t.status === 'alive').length === 1
            && state.gamesProfile?.quell !== undefined
            ? 'a Quell year, and still only one of them walked out'
            : undefined),
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
        rarity: 'rare',
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
    {
        id: 'weathered',
        name: 'Weathered',
        hint: 'Crown a victor who stood through three storm fronts.',
        category: 'arena',
        rarity: 'common',
        test: (_s, v) => (v?.stormsSurvived ?? 0) >= 3,
        nearMiss: (_s, v) => {
            const n = v?.stormsSurvived ?? 0;
            return n >= 1 && n < 3 ? `${v!.name} stood through ${n} — ${3 - n} short` : undefined;
        },
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
            && !state.tributes.some(t => /drown|tide|undertow|rip ?tide/i.test(t.causeOfDeath ?? '')),
        nearMiss: state => {
            const water = state.arena.zones.filter(z => z.terrain === 'water').length;
            if (water < 3) return undefined;
            const lost = state.tributes.filter(t => /drown|tide|undertow|rip ?tide/i.test(t.causeOfDeath ?? '')).length;
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
    {
        id: 'the-kin-pair',
        name: 'In Their Place',
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
        rarity: 'rare',
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
        name: 'Scarred And Standing',
        hint: 'Crown a victor carrying an old wound that never closed properly.',
        category: 'survival',
        rarity: 'legendary',
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
        id: 'named-twice',
        name: 'Named Twice',
        hint: 'Crown a victor the country named, carrying a weapon it also named.',
        category: 'oddity',
        rarity: 'rare',
        // Epithets land on 8.5% of tributes; a named weapon exists in 43% of
        // runs. Both, on the one who wins, is the conjunction.
        test: (_s, v) => !!v?.epithet && v.inventory.some(i => !!i.legendName),
    },
    {
        id: 'alone-the-whole-way',
        name: 'Alone The Whole Way',
        hint: 'Crown a victor who never once shared a camp.',
        category: 'oddity',
        rarity: 'rare',
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
        hint: 'Crown a victor somebody else carried out of the dirt.',
        category: 'oddity',
        rarity: 'legendary',
        // Audit 4 §2.1: `downed` is 1.5% of tribute-cycles with 137 rescues
        // per 160 runs; the rescued victor is the narrow part.
        test: (_s, v) => !!v?.everDowned && !!v.revivedBy,
        nearMiss: (_s, v) => (v?.everDowned && !v.revivedBy
            ? `${v!.name} went down and got themselves back up`
            : undefined),
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
        hint: 'See any tribute — not necessarily the victor — stand in every zone the arena has.',
        category: 'arena',
        rarity: 'legendary',
        test: state => {
            const all = state.arena.zones.map(z => z.name);
            return state.tributes.some(t => all.every(z => (t.visitedZones ?? []).includes(z)));
        },
        nearMiss: state => {
            const total = state.arena.zones.length;
            const best = Math.max(0, ...state.tributes.map(t => (t.visitedZones ?? []).length));
            return best >= total - 2 && best < total ? `somebody walked ${best} of ${total} sectors` : undefined;
        },
    },
    {
        id: 'full-table',
        name: 'Full Table',
        hint: 'See an alliance still standing at the end that named all four of its roles.',
        category: 'social',
        rarity: 'possible',
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
        id: 'the-named-blade',
        name: 'The Named Blade',
        hint: 'Crown a victor still holding a weapon the country gave a name to.',
        category: 'combat',
        rarity: 'common',
        test: (_s, v) => !!v && v.inventory.some(i => !!i.legendName),
    },
    {
        id: 'the-whole-menagerie',
        name: 'The Whole Menagerie',
        hint: 'See every mutt in an arena\'s roster loosed in a single Games.',
        category: 'oddity',
        rarity: 'common',
        test: state => {
            const roster = state.arena.mutts ?? [];
            if (roster.length < 2) return false;
            return roster.every(m => state.log.some(l => l.category === 'mutt' && l.text.includes(m)));
        },
        nearMiss: state => {
            const roster = state.arena.mutts ?? [];
            const seen = roster.filter(m => state.log.some(l => l.category === 'mutt' && l.text.includes(m))).length;
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
        rarity: 'rare',
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
        id: 'the-tended',
        name: 'Tended',
        hint: 'See an ally stop somebody\'s bleeding while standing over them.',
        category: 'survival',
        rarity: 'rare',
        test: state => state.log.some(l => l.category === 'injury' && /bleeding stopped in/.test(l.text)),
    },
    {
        id: 'the-perimeter',
        name: 'The Perimeter',
        hint: 'See a pack post a patrol on its own ground.',
        category: 'social',
        rarity: 'rare',
        test: state => state.log.some(l => /walks the edge of|walks the perimeter of|does a slow lap of/.test(l.text)),
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
        rarity: 'legendary',
        test: (_s, v) => !!v && v.archetype === 'penitent',
    },
    {
        id: 'the-forager',
        name: 'Fed the Arena',
        hint: 'Crown a Forager, who never needed anybody to die first.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && v.archetype === 'forager',
    },
    {
        id: 'the-duellist',
        name: 'One of Us',
        hint: 'Crown a Duellist — a tribute who asked, out loud, for a straight fight.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && v.archetype === 'duellist',
    },
    {
        id: 'the-broker',
        name: 'Everything Is Worth Something',
        hint: 'Crown a Broker, who would rather hold a favour than a knife.',
        category: 'reaping',
        rarity: 'rare',
        test: (_s, v) => !!v && v.archetype === 'broker',
    },
    {
        id: 'full-slate',
        name: 'Full Slate',
        hint: 'See a reaping where no two tributes in the field share an archetype.',
        category: 'reaping',
        rarity: 'legendary',
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
        hint: 'Crown a victor who was on the ground at some point and got up again.',
        category: 'combat',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.everDowned === true,
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
        hint: 'Crown a victor who never picked up a weapon at all.',
        category: 'combat',
        rarity: 'possible',
        test: (_s, v) => !!v && v.everCarriedWeapon !== true,
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
        rarity: 'legendary',
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
        rarity: 'possible',
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
        id: 'read-the-map',
        name: 'Read the Map',
        hint: 'Crown a victor who found a way through the arena that is not on anybody\'s map.',
        category: 'survival',
        rarity: 'rare',
        // §11.4: authored at three and measured against the engine — 500 runs
        // never produced a victor who had found more than one. A hidden edge
        // is rare on purpose; the achievement asks for the one.
        test: (_s, v) => !!v && (v.knownEdges?.length ?? 0) >= 1,
    },
    {
        id: 'the-carpenter',
        name: 'Made It Out of Sticks',
        hint: 'Crown a victor who built something in the arena that held.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.proficiencies?.carpentry ?? 0) >= 1,
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
        rarity: 'rare',
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
        hint: 'Crown a victor who went to pieces in the arena and recovered anyway.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && v.sanityRecovered === true && v.sanityScarred === true,
    },

    // ---- social ----
    {
        id: 'two-treaties',
        name: 'Two Treaties',
        hint: 'See two separate treaties signed between groups in one Games, and one of them hold.',
        category: 'social',
        rarity: 'rare',
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
        rarity: 'legendary',
        test: state => state.blocTreatyBroken === true,
    },
    {
        id: 'the-speaker',
        name: 'The Speaker',
        hint: 'Crown a victor who learned to speak for people who were not in the room.',
        category: 'social',
        rarity: 'legendary',
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
        rarity: 'rare',
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
    {
        id: 'the-garrison',
        name: 'The Garrison',
        hint: 'See a way through the arena put under guard by a pack.',
        category: 'social',
        rarity: 'rare',
        test: state => (state.garrisonsFormed?.length ?? 0) >= 1,
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
        rarity: 'possible',
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
        rarity: 'rare',
        test: state => (state.lastRestockCycle !== undefined)
            && state.log.filter(l => /restock|refilled|new crates|the horn is full again/i.test(l.text)).length >= 2,
        nearMiss: state => (state.log.filter(l => /restock|refilled|new crates|the horn is full again/i.test(l.text)).length === 1
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
        hint: 'Crown a victor who was in two sectors as they came down.',
        category: 'arena',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.collapsesSurvived ?? 0) >= 2,
        nearMiss: (_s, v) => {
            const n = v?.collapsesSurvived ?? 0;
            return n === 1 ? `${v?.name} rode one collapse — two is standing on nothing` : undefined;
        },
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
        hint: 'Crown a victor who received no sponsor gift all run.',
        category: 'capitol',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.memory?.giftsReceived ?? 0) === 0,
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
        hint: 'Crown a victor who traded what they knew about the map for something they needed.',
        category: 'capitol',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.intelSold ?? 0) >= 1,
    },
    {
        id: 'nothing-left-to-give',
        name: 'Nothing Left To Give',
        hint: 'See every sponsor bloc spend its whole budget in one Games.',
        category: 'capitol',
        rarity: 'rare',
        test: state => state.everySponsorBlocExhausted === true,
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
        rarity: 'rare',
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
        rarity: 'rare',
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
        rarity: 'common',
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
        hint: 'See a planted rumour traced back to whoever planted it.',
        category: 'oddity',
        rarity: 'rare',
        test: state => state.plantedRumourExposed === true,
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
        id: 'the-unnamed',
        name: 'No Name For It',
        hint: 'Crown a victor the country never settled on an epithet for.',
        category: 'oddity',
        rarity: 'common',
        test: (_s, v) => !!v && !v.epithet,
    },
    {
        id: 'took-nothing-off-anybody',
        name: 'Took Nothing Off Anybody',
        hint: 'Crown a victor who never looted a single body in a Games with six dead or more.',
        category: 'oddity',
        rarity: 'rare',
        test: (state, v) => !!v && (v.corpsesLooted ?? 0) === 0 && dead(state).length >= 6,
        nearMiss: (state, v) => (v && (v.corpsesLooted ?? 0) === 1 && dead(state).length >= 6
            ? `${v.name} went through exactly one body this year`
            : undefined),
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
