import { GameState, Tribute } from '../models/types';

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
export interface Achievement {
    id: string;
    name: string;
    /** What the player has to make happen. Readable while still locked. */
    hint: string;
    /** True if this finished run earned it. */
    test: (state: GameState, victor: Tribute | undefined) => boolean;
    /**
     * How close this run came, when it did not earn it — "2 kills from
     * Bloodbath". Achievements were only ever surfaced on the end screen as a
     * binary, so a run that came within one of something told the player
     * nothing at all. Optional: some achievements are not a matter of degree.
     */
    nearMiss?: (state: GameState, victor: Tribute | undefined) => string | undefined;
}

/** An achievement this run came close to, for the end screen. */
export interface NearMiss {
    id: string;
    name: string;
    /** Already phrased: "one kill short", "survived to day 9 of 12". */
    detail: string;
}

const alive = (state: GameState) => state.tributes.filter(t => t.status === 'alive');

/** Traits that can only be picked up in the arena. Mirrors `earnedTraits.ts`. */
const EARNED_TRAIT_NAMES = [
    'Bloodied', 'Haunted', 'Hardened', 'Merciful', 'Marked', 'Starved', 'Venom-Wise', 'Feared',
];
const dead = (state: GameState) => state.tributes.filter(t => t.status === 'dead');

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'bloodless-crown',
        name: 'Bloodless Crown',
        hint: 'Crown a victor who never killed anybody.',
        test: (_s, v) => !!v && v.kills === 0,
        nearMiss: (_s, v) => (v && v.kills > 0 && v.kills <= 2)
            ? `${v.name} won with ${v.kills} kill${v.kills === 1 ? '' : 's'} — ${v.kills} short of a bloodless crown`
            : undefined,
    },
    {
        id: 'youngest-victor',
        name: 'The Youngest',
        hint: 'Crown a victor aged fourteen or under.',
        test: (_s, v) => !!v && v.age <= 14,
        nearMiss: (_s, v) => (v && v.age > 14 && v.age <= 16)
            ? `${v.name} was ${v.age} — ${v.age - 14} year${v.age - 14 === 1 ? '' : 's'} over`
            : undefined,
    },
    {
        id: 'career-crown',
        name: 'As Designed',
        hint: 'Crown a Career from District 1, 2 or 4.',
        test: (_s, v) => !!v && v.isCareer,
    },
    {
        id: 'outer-district',
        name: 'From the Seam',
        hint: 'Crown a victor from District 10, 11 or 12.',
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
        test: (_s, v) => !!v && v.volunteered === true,
    },
    {
        id: 'sibling-volunteer',
        name: 'In Their Place',
        hint: 'See a tribute from outside the Career districts volunteer for a sibling.',
        test: state => state.tributes.some(t => t.volunteered && !t.isCareer),
    },
    {
        id: 'lovers-final-four',
        name: 'Star-Crossed',
        hint: 'See a star-crossed pair both survive to the final four.',
        test: state => {
            const lovers = state.tributes.filter(t => t.traits.includes('Star-Crossed'));
            if (lovers.length < 2) return false;
            // Both alive at four remaining, or both among the last four to fall.
            const ranked = [...state.tributes].sort((a, b) =>
                (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity));
            const finalFour = new Set(ranked.slice(0, 4).map(t => t.id));
            return lovers.filter(l => finalFour.has(l.id)).length >= 2;
        },
    },
    {
        id: 'protector-bond',
        name: 'Something Like Family',
        hint: 'See a protective bond form between an older tribute and a much younger one.',
        test: state => state.tributes.some(t => (t.protectorBonds?.length ?? 0) > 0),
    },
    {
        id: 'career-pack-collapse',
        name: 'No Pack This Year',
        hint: 'See the Career pack come apart before the arena does it for them.',
        test: state => state.log.some(e =>
            e.text.includes('there is no pack this year') || e.text.includes('no longer anybody\'s allies')),
    },
    {
        id: 'feast-betrayal',
        name: 'At the Table',
        hint: 'See a betrayal on the same day as a feast.',
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
        hint: 'Crown a victor who earned three or more traits in the arena that they did not walk in with.',
        test: (_s, v) => !!v && EARNED_TRAIT_NAMES.filter(name => v.traits.includes(name)).length >= 3,
    },
    {
        id: 'merciful',
        name: 'The Mercy',
        hint: 'See a tribute spare an opponent they had already beaten.',
        test: state => state.tributes.some(t => t.traits.includes('Merciful')),
    },
    {
        id: 'feared',
        name: 'Everyone Knows the Name',
        hint: 'See a single tribute reach five kills.',
        test: state => state.tributes.some(t => t.kills >= 5),
    },
    {
        id: 'quarter-quell',
        name: 'A Quarter Quell',
        hint: 'Run a Games the Capitol has declared a Quarter Quell.',
        test: state => state.gamesProfile?.wildcard.kind.startsWith('quarter-quell') === true,
    },
    {
        id: 'silent-arena',
        name: 'No Faces in the Sky',
        hint: 'Run a Games with no anthem, where nobody learns who is left.',
        test: state => state.gamesProfile?.wildcard.kind === 'silent-arena',
    },
    {
        id: 'long-games',
        name: 'The Long Games',
        hint: 'See a Games run past day twelve.',
        test: state => state.day > 12,
        nearMiss: state => state.day >= 10 && state.day <= 12
            ? `these Games ran ${state.day} days — ${13 - state.day} short`
            : undefined,
    },
    {
        id: 'short-games',
        name: 'Over By Friday',
        hint: 'See a Games finish on day six or earlier.',
        test: state => state.day <= 6,
        nearMiss: state => state.day > 6 && state.day <= 8
            ? `these Games ran ${state.day} days — ${state.day - 6} over`
            : undefined,
    },
    {
        id: 'bloodbath-massacre',
        name: 'The Cornucopia',
        hint: 'See half the field or more die in the bloodbath.',
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
        test: state => {
            const byTribute = dead(state).filter(t => t.causeOfDeath?.startsWith('Killed by')).length;
            return dead(state).length > 0 && byTribute < dead(state).length / 2;
        },
    },
    {
        id: 'unscathed',
        name: 'Barely a Scratch',
        hint: 'Crown a victor who finishes above 80 health.',
        test: (_s, v) => !!v && v.health > 80,
        nearMiss: (_s, v) => (v && v.health > 65 && v.health <= 80)
            ? `${v.name} finished on ${v.health} health — ${81 - v.health} short`
            : undefined,
    },
    {
        id: 'last-legs',
        name: 'On Their Last Legs',
        hint: 'Crown a victor who finishes below 15 health.',
        test: (_s, v) => !!v && v.health < 15,
        nearMiss: (_s, v) => (v && v.health >= 15 && v.health <= 30)
            ? `${v.name} finished on ${v.health} health — ${v.health - 14} above the line`
            : undefined,
    },
    {
        id: 'no-victor',
        name: 'Nobody Came Home',
        hint: 'See a Games end with no victor at all.',
        test: state => alive(state).length === 0,
    },
    {
        id: 'eleven-score',
        name: 'An Eleven',
        hint: 'See a tribute score 11 or better in their private session.',
        // Measured at roughly 1 tribute in 900, so about one run in forty. A 12
        // exists above this and is deliberately once-in-a-generation — rare
        // enough (1 in 9,600 tributes) that an achievement keyed on it would
        // never be seen, which is the opposite of what this list is for.
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
        test: (_s, v) => !!v && v.trainingStrategy === 'conceal',
    },
    // S-3: outcome achievements beyond the original 25 — the rare endings and
    // the challenge-run shapes the simulation can produce.
    {
        id: 'dual-victory',
        name: 'Both of Them',
        hint: 'See a Games end with two victors.',
        test: state => (state.victorIds?.length ?? 0) >= 2,
    },
    {
        id: 'nightlock-ending',
        name: 'The Berries',
        hint: 'See a tribute choose the nightlock rather than keep playing.',
        test: state => state.tributes.some(t => t.causeOfDeath?.includes('nightlock')),
    },
    {
        id: 'wildfire',
        name: 'Let It Burn',
        hint: 'See a fire spread from one sector into the next.',
        test: state => state.log.some(e => /The fire in .* jumps to/.test(e.text)),
    },
    {
        id: 'tesserae-crown',
        name: 'The Grain Paid Back',
        hint: 'Crown a victor whose name was in the bowl for tesserae, year after year.',
        test: (_s, v) => !!v && (v.tesserae ?? 0) >= 3,
    },
    {
        id: 'crown-limping',
        name: 'Held Together With String',
        hint: 'Crown a victor carrying three or more standing injuries at the end.',
        test: (_s, v) => !!v && Object.values(v.injuries).filter(Boolean).length >= 3,
    },
    {
        id: 'district-partners',
        name: 'Home Together',
        hint: 'See both tributes from one district reach the final four.',
        test: state => {
            const ranked = [...state.tributes].sort((a, b) =>
                (b.dayOfDeath ?? Infinity) - (a.dayOfDeath ?? Infinity));
            const finalFour = ranked.slice(0, 4);
            return [...new Set(finalFour.map(t => t.district))].length < finalFour.length;
        },
    },
    // The endings §10.2 added — each is rare twice over (gated on what
    // happened to the victor, then rolled), so each is worth naming.
    {
        id: 'refused-crown',
        name: 'Not Wearing It',
        hint: 'See a victor refuse the crown in front of the whole Capitol.',
        test: state => state.endingKind === 'refused',
    },
    {
        id: 'lifted-out',
        name: 'On Their Terms',
        hint: 'See the Gamemakers end the Games themselves rather than let the arena finish it.',
        test: state => state.endingKind === 'overruled',
    },
    {
        id: 'hollow-crown',
        name: 'The Long Way Home',
        hint: 'Crown a victor whose homecoming reads as a loss.',
        test: state => state.endingKind === 'hollow',
    },
    // The format modifiers — winning under a changed rule set is a different
    // achievement from winning at all.
    {
        id: 'format-year',
        name: 'The Rules Were Different',
        hint: 'Finish a Games run under two or more format changes at once.',
        test: state => (state.gamesProfile?.modifiers?.length ?? 0) >= 2,
    },
    {
        id: 'empty-horn-victor',
        name: 'Nothing at the Middle',
        hint: 'Crown a victor in a year the Cornucopia stood empty.',
        test: (state, v) => !!v && (state.gamesProfile?.modifiers ?? []).includes('no-cornucopia'),
    },
    {
        id: 'silent-year-victor',
        name: 'Under a Silent Sky',
        hint: 'Crown a victor in a year with no anthem and no faces in the sky.',
        test: (state, v) => !!v && (state.gamesProfile?.modifiers ?? []).includes('no-anthem'),
    },
    {
        id: 'sealed-year-victor',
        name: 'No Parachutes',
        hint: 'Crown a victor in a sealed sponsorship year — nothing sent, nothing received.',
        test: (state, v) => !!v && (state.gamesProfile?.modifiers ?? []).includes('no-sponsors'),
    },
    // What a run can produce that the original list never looked for.
    {
        id: 'ghost-victor',
        name: 'The Ghost',
        hint: 'Crown a victor who was never once in a fight.',
        test: (_s, v) => !!v && Object.values(v.memory?.rivals ?? {}).every(r => r.fights === 0),
    },
    {
        id: 'notorious',
        name: 'The Name They Say Carefully',
        hint: 'See a tribute become so feared that the whole field knows them by reputation alone.',
        test: state => state.tributes.some(t => (t.notoriety ?? 0) >= 60),
    },
    {
        id: 'as-advertised',
        name: 'As Advertised',
        hint: 'Crown a victor the Capitol had already fallen for before the gong.',
        test: (_s, v) => !!v && v.fanFavourite,
    },
    {
        id: 'dark-horse',
        name: 'Nobody Saw Them Coming',
        hint: 'Crown a victor who scored a three or worse in training.',
        test: (_s, v) => !!v && v.trainingScore > 0 && v.trainingScore <= 3,
    },
    {
        id: 'seam-year',
        name: 'Coal Into Diamond',
        hint: 'Crown a victor from District 12 itself.',
        test: (_s, v) => !!v && v.district === 12,
    },
    {
        id: 'half-the-field',
        name: 'A Quarter of Panem',
        hint: 'Crown a victor who personally accounted for a quarter of the field or more.',
        test: (state, v) => !!v && state.tributes.length > 0 && v.kills >= state.tributes.length / 4,
    },
    {
        id: 'steady-hands',
        name: 'Steady Hands',
        hint: 'See one tribute close two or more wounds properly — their own, or somebody else\'s.',
        test: state => state.tributes.some(t =>
            state.log.filter(l => /packs and binds|binds their wound tight/.test(l.text)
                && l.tributesInvolved.includes(t.id)).length >= 2),
    },
    {
        id: 'labs-year',
        name: 'The Labs\' Year',
        hint: 'See the mutts take three or more tributes in one Games.',
        test: state => state.tributes.filter(t =>
            t.status === 'dead' && t.lastDamage?.kind === 'mutt').length >= 3,
    },
    {
        id: 'scarred-earth',
        name: 'Scorched Into the Map',
        hint: 'See fire permanently scar three or more sectors of one arena.',
        test: state => (state.scarredZones?.length ?? 0) >= 3,
    },
    {
        id: 'strange-skies',
        name: 'Strange Skies',
        hint: 'See hail, a static storm, or track-erasing snow cross the arena.',
        test: state => state.log.some(l => /hailstorm|static storm|wet snow/.test(l.text)),
    },
    {
        id: 'oath-keeper',
        name: 'The Word Held',
        hint: 'Crown a victor who renewed a truce rather than letting it lapse.',
        test: (state, v) => !!v && state.log.some(l =>
            /truce holds another stretch|same terms, both still in|renew the agreement|The truce rolls over/.test(l.text)
            && l.tributesInvolved.includes(v.id)),
    },
    {
        id: 'role-crown',
        name: 'Somebody Had To',
        hint: 'Crown a victor who was their alliance\'s scout, quartermaster or medic.',
        test: (state, v) => !!v && Object.values(state.alliances ?? {}).some(a =>
            Object.values(a.roles ?? {}).includes(v.id)),
    },
    {
        id: 'pack-to-pack',
        name: 'The Arithmetic Out Loud',
        hint: 'See one whole alliance fold itself into another rather than fight it.',
        // The terms-agreed beat fires in most runs now that groups negotiate;
        // the *merge* — a leader walking out with empty hands and doing the
        // arithmetic in front of both packs — is the rare one worth naming.
        test: state => state.log.some(l => l.text.includes('does the arithmetic out loud')),
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
    /** Achievements unlocked so far (before this run's are merged). */
    unlockedCount: number;
    /** The most Games any single Head Gamemaker has run for this player. */
    maxGamemakerGames: number;
    /** Victories by districts outside 1, 2 and 4, summed. */
    outerVictories: number;
}

export interface MetaAchievement {
    id: string;
    name: string;
    hint: string;
    test: (totals: CareerTotals) => boolean;
}

export const META_ACHIEVEMENTS: MetaAchievement[] = [
    {
        id: 'meta-ten-games',
        name: 'A Regular',
        hint: 'Finish ten Games.',
        test: t => t.runs >= 10,
    },
    {
        id: 'meta-fifty-games',
        name: 'The Career, So To Speak',
        hint: 'Finish fifty Games.',
        test: t => t.runs >= 50,
    },
    {
        id: 'meta-hundred-deaths',
        name: 'The Price of the Show',
        hint: 'Witness one hundred deaths across all your Games.',
        test: t => t.deaths >= 100,
    },
    {
        id: 'meta-half-panem',
        name: 'Half of Panem',
        hint: 'Crown victors from six different districts.',
        test: t => t.crownedDistricts.length >= 6,
    },
    {
        id: 'meta-all-twelve',
        name: 'Every District\'s Year',
        hint: 'Crown a victor from every one of the twelve districts.',
        test: t => t.crownedDistricts.length >= 12,
    },
    {
        id: 'meta-grand-tour',
        name: 'The Grand Tour',
        hint: 'Crown victors in ten different arenas.',
        test: t => t.arenasWon.length >= 10,
    },
    {
        id: 'meta-first-crown',
        name: 'Somebody Came Home',
        hint: 'Crown your first victor.',
        test: t => t.victors >= 1,
    },
    {
        id: 'meta-twenty-five',
        name: 'Silver Anniversary',
        hint: 'Finish twenty-five Games.',
        test: t => t.runs >= 25,
    },
    {
        id: 'meta-hundred-games',
        name: 'A Century of Games',
        hint: 'Finish one hundred Games.',
        test: t => t.runs >= 100,
    },
    {
        id: 'meta-five-hundred-deaths',
        name: 'The Ledger',
        hint: 'Witness five hundred deaths across all your Games.',
        test: t => t.deaths >= 500,
    },
    {
        id: 'meta-cartographer',
        name: 'The Cartographer',
        hint: 'Crown victors in twenty different arenas.',
        test: t => t.arenasWon.length >= 20,
    },
    {
        id: 'meta-collector',
        name: 'The Collection Begins',
        hint: 'Unlock twenty achievements.',
        test: t => t.unlockedCount >= 20,
    },
    {
        id: 'meta-archivist',
        name: 'The Archivist',
        hint: 'Unlock forty achievements.',
        test: t => t.unlockedCount >= 40,
    },
    {
        id: 'meta-house-gamemaker',
        name: 'The House Gamemaker',
        hint: 'See the same Head Gamemaker run five of your Games.',
        test: t => t.maxGamemakerGames >= 5,
    },
    {
        id: 'meta-against-the-academy',
        name: 'Against the Academy',
        hint: 'Crown five victors from outside Districts 1, 2 and 4.',
        test: t => t.outerVictories >= 5,
    },
    {
        id: 'meta-outer-dynasty',
        name: 'The Outer Dynasty',
        hint: 'Crown fifteen victors from outside Districts 1, 2 and 4.',
        test: t => t.outerVictories >= 15,
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
            const detail = a.nearMiss(state, undefined);
            if (detail) misses.push({ id: a.id, name: a.name, detail });
        } catch {
            // Mid-run state a nearMiss did not anticipate must never break the UI.
        }
    });
    return misses.slice(0, 2);
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
