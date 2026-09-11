import { TRAIT_DEFS } from './traits';
import { GameState, Tribute } from '../models/types';
import { arenaFlavor } from './arenaFlavor';
import { legacyOf } from './districts';
import { PROCEDURAL_BIOME_COUNT } from '../engine/arenaGenerator';
import { ACHIEVEMENT_BARS } from './balance';

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
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

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

/**
 * Traits that can only be picked up in the arena. Derived from `TRAIT_DEFS`
 * rather than hand-mirrored: the copy this used to be omitted `Broken` and
 * `Hollow`, so a Pacifist who came home Broken did not count as changed by
 * it, and a victor who transformed a trait could still take a Clean Slate.
 */
const EARNED_TRAIT_NAMES = Object.keys(TRAIT_DEFS).filter(name => TRAIT_DEFS[name].earned);
const dead = (state: GameState) => state.tributes.filter(t => t.status === 'dead');

export const ACHIEVEMENTS: Achievement[] = [
    // §11: the additions — every one of them reads a field the state already
    // keeps, or one the same change started keeping.
    {
        id: 'performed-to-the-end',
        name: 'Performed to the End',
        hint: 'Crown a victor still keeping up a performed bond when the cannon fired for the last time.',
        category: 'social',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.performingStreak ?? 0) >= 5,
        nearMiss: (_s, v) => (v && (v.performingStreak ?? 0) >= 2 && (v.performingStreak ?? 0) < 5)
            ? `${v.name} was still performing a bond ${v.performingStreak} cycles in — ${5 - (v.performingStreak ?? 0)} short at the cannon`
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
        rarity: 'rare',
        test: (_s, v) => !!v && (v.betrayalsCommitted ?? 0) >= 2,
        nearMiss: (_s, v) => (v && (v.betrayalsCommitted ?? 0) === 1)
            ? `${v.name} broke faith once — a turncoat twice does it again`
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
        id: 'deadfall',
        name: 'Deadfall',
        hint: 'Crown a victor whose traps killed two or more tributes.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.trapKills ?? 0) >= 2,
        nearMiss: (_s, v) => (v && v.trapKills === 1) ? `${v.name}'s traps took one — one short of a deadfall` : undefined,
    },
    {
        id: 'fever-dream',
        name: 'Fever Dream',
        hint: 'Crown a victor who was treated back from a terminal-stage infection.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.terminalInfectionBeaten === true,
        nearMiss: (_s, v) => (v && v.terminalInfectionBeaten !== true && v.injuries.infected)
            ? `${v.name} came home still infected — beating it back from terminal is the other ending`
            : undefined,
    },
    {
        id: 'both-levels',
        name: 'Both Levels',
        hint: 'Crown a victor who stood on both levels of a vertical zone.',
        category: 'arena',
        rarity: 'uncommon',
        test: (_s, v) => !!v && (v.levelsStood?.includes('upper') ?? false) && (v.levelsStood?.includes('lower') ?? false),
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
        hint: 'Crown a victor who stood in every zone of the arena.',
        category: 'arena',
        rarity: 'rare',
        test: (s, v) => !!v && (v.visitedZones?.length ?? 0) >= s.arena.zones.length,
        nearMiss: (s, v) => {
            const n = v?.visitedZones?.length ?? 0;
            const total = s.arena.zones.length;
            return v && total - n > 0 && total - n <= 2
                ? `${v.name} saw ${n} of ${total} zones — ${total - n} short of the whole arena`
                : undefined;
        },
    },
    {
        id: 'arms-dealer',
        name: 'Arms Dealer',
        hint: 'Crown a victor who sold information three times or more.',
        category: 'social',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.intelSold ?? 0) >= 3,
        nearMiss: (_s, v) => (v && (v.intelSold ?? 0) >= 1 && (v.intelSold ?? 0) < 3)
            ? `${v.name} sold what they knew ${v.intelSold} time${v.intelSold === 1 ? '' : 's'} — ${3 - (v.intelSold ?? 0)} short of a trade`
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
        test: (s, v) => !!v && v.isCareer
            && (v.visitedZones?.length ?? 0) === 1
            && v.visitedZones?.[0] === s.arena.zones[0]?.name,
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
            const lovers = state.tributes.filter(t => t.traits.includes('Star-Crossed'));
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
            const lovers = state.tributes.filter(t => t.traits.includes('Star-Crossed'));
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
        rarity: 'uncommon',
        test: state => state.log.some(e =>
            e.text.includes('there is no pack this year') || e.text.includes('no longer anybody\'s allies')),
    },
    {
        id: 'feast-betrayal',
        name: 'At the Table',
        hint: 'See a betrayal on the same day as a feast.',
        category: 'social',
        rarity: 'uncommon',
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
        hint: 'Crown a victor who earned three or more traits in the arena that they did not walk in with.',
        category: 'survival',
        rarity: 'common',
        test: (_s, v) => !!v && EARNED_TRAIT_NAMES.filter(name => v.traits.includes(name)).length >= 3,
        nearMiss: (_s, v) => {
            const n = v ? EARNED_TRAIT_NAMES.filter(name => v.traits.includes(name)).length : 0;
            return v && n === 2
                ? `${v.name} came home carrying 2 earned traits — one short of being someone else entirely`
                : undefined;
        },
    },
    {
        id: 'merciful',
        name: 'The Mercy',
        hint: 'See a tribute spare an opponent they had already beaten.',
        category: 'combat',
        rarity: 'uncommon',
        test: state => state.tributes.some(t => t.traits.includes('Merciful')),
    },
    {
        id: 'feared',
        name: 'Everyone Knows the Name',
        hint: 'See a single tribute reach five kills.',
        category: 'combat',
        rarity: 'uncommon',
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
        rarity: 'uncommon',
        test: state => state.gamesProfile?.quell !== undefined,
    },
    {
        id: 'silent-arena',
        name: 'No Faces in the Sky',
        hint: 'Run a Games with no anthem, where nobody learns who is left.',
        category: 'capitol',
        rarity: 'rare',
        test: state => state.gamesProfile?.wildcard.kind === 'silent-arena',
    },
    {
        id: 'long-games',
        name: 'The Long Games',
        hint: 'See a Games run past day twelve.',
        category: 'games',
        rarity: 'rare',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'rare',
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
        category: 'capitol',
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
        test: state => state.tributes.some(t => t.causeOfDeath?.includes('nightlock')),
    },
    {
        id: 'wildfire',
        name: 'Let It Burn',
        hint: 'See a fire spread from one sector into the next.',
        category: 'arena',
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'rare',
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
        rarity: 'common',
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
        rarity: 'uncommon',
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
        rarity: 'rare',
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
        hint: 'Crown a victor who once held a performed bond for five cycles straight.',
        category: 'social',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.maxPerformingStreak ?? 0) >= 5,
        nearMiss: (_s, v) => {
            const best = v?.maxPerformingStreak ?? 0;
            return v && best >= 3 && best < 5
                ? `${v.name} kept the act up for ${best} cycles — ${5 - best} short of the long con`
                : undefined;
        },
    },
    {
        id: 'toll-collector',
        name: 'Toll Collector',
        hint: 'See one tribute extort payment out of three different people in a single Games.',
        category: 'social',
        rarity: 'legendary',
        test: state => state.tributes.some(t => (t.extortedIds?.length ?? 0) >= 3),
        nearMiss: state => {
            const best = state.tributes.reduce((a, t) => Math.max(a, t.extortedIds?.length ?? 0), 0);
            const holder = state.tributes.find(t => (t.extortedIds?.length ?? 0) === best);
            return best === 2 && holder
                ? `${holder.name} shook down 2 tributes — one short of a toll collector`
                : undefined;
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
        hint: 'Crown a victor who had two tributes paying for their protection at the same time.',
        category: 'social',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.retainersHonoured ?? 0) >= 2,
        nearMiss: (_s, v) => (v && (v.retainersHonoured ?? 0) === 1)
            ? `${v.name} worked one contract — a second client at the same time would have made it a business`
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
        test: state => state.sharedGriefAllies === true,
    },
    {
        id: 'ashes-to-ashes',
        name: 'Ashes to Ashes',
        hint: 'See a single fire chain its way across four sectors.',
        category: 'arena',
        rarity: 'rare',
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
        rarity: 'rare',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
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
        rarity: 'rare',
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
        rarity: 'legendary',
        test: (_s, v) => !!v && v.everCarriedWeapon !== true,
    },
    {
        id: 'venom-kill',
        name: 'Venom',
        hint: 'See a poisoned blade finish what it started.',
        category: 'combat',
        rarity: 'uncommon',
        test: state => dead(state).some(t =>
            t.poisonedByWeapon === true && /poison/i.test(t.causeOfDeath ?? '')),
    },
    {
        id: 'twelve-score',
        name: 'Twelve',
        hint: 'See the Gamemakers hand down a training score of twelve.',
        category: 'capitol',
        rarity: 'rare',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
        test: (_s, v) => !!v && (v.visitedZones ?? []).length > 0 && (v.visitedZones ?? []).length <= 3,
        nearMiss: (_s, v) => (v && (v.visitedZones ?? []).length === 4)
            ? `${v.name} won having stood in only four zones — one too many to have never left`
            : undefined,
    },
    {
        id: 'grand-cartography',
        name: 'Cartography',
        hint: 'See one tribute stand in every zone of a sprawling arena of twelve zones or more.',
        // Extends `cartographer`: same walk, but only counted where the walk
        // is long. §11: a *complete* walk of a 12+ zone sprawl never happened
        // in 600 runs — `cartographer`, the same walk at any size, fires at
        // 1.17% — so this asks for all but one zone. Still a tribute who
        // crossed almost the whole map and lived to be counted.
        category: 'arena',
        rarity: 'legendary',
        test: state => state.arena.zones.length >= 12
            && state.tributes.some(t => {
                const seen = t.visitedZones ?? [];
                return state.arena.zones.filter(z => !seen.includes(z.name)).length <= 1;
            }),
        nearMiss: state => {
            if (state.arena.zones.length < 12) return undefined;
            const best = state.tributes.reduce((fewest, t) => {
                const seen = t.visitedZones ?? [];
                return Math.min(fewest, state.arena.zones.filter(z => !seen.includes(z.name)).length);
            }, state.arena.zones.length);
            return best === 2 ? 'somebody walked all but two zones of a sprawling arena — one short' : undefined;
        },
    },
    {
        id: 'full-bestiary',
        name: 'Full Bestiary',
        hint: 'Meet every mutt in one arena\'s roster in a single Games.',
        category: 'arena',
        rarity: 'uncommon',
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
        rarity: 'rare',
        test: (_s, v) => !!v && v.revivedBy !== undefined,
    },
    {
        id: 'left-them-standing',
        name: 'Left Them Standing',
        hint: 'See one tribute stand over three helpless rivals and walk away from all three.',
        category: 'combat',
        rarity: 'rare',
        test: state => state.tributes.some(t => (t.sparedDowned?.length ?? 0) >= 3),
        nearMiss: state => {
            const best = Math.max(0, ...state.tributes.map(t => t.sparedDowned?.length ?? 0));
            return best === 2 ? 'somebody spared two helpless rivals — one short of a pattern' : undefined;
        },
    },
    {
        id: 'found-first',
        name: 'Found First',
        hint: 'See one tribute be the first to reach a downed ally three times over.',
        category: 'social',
        rarity: 'rare',
        test: state => state.tributes.some(t => (t.reachedDownedFirst ?? 0) >= 3),
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
        rarity: 'legendary',
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
        hint: 'Crown a victor who traded honest map knowledge with three different tributes.',
        category: 'social',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.sharedIntelWith?.length ?? 0) >= 3,
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
        rarity: 'uncommon',
        test: (_s, v) => !!v && (v.memory?.timesBetrayed ?? 0) > 0,
    },
    {
        id: 'hairsbreadth',
        name: 'Hairsbreadth',
        // §11: three separate sub-five-health recoveries in one victor never
        // happened in 600 runs — each term is rare and the conjunction is a
        // stacked long-shot. Two is still the thing the name describes.
        hint: 'Crown a victor who fell below five health twice and got back up both times.',
        category: 'survival',
        rarity: 'legendary',
        test: (_s, v) => !!v && (v.lowHealthRecoveries ?? 0) >= 2,
        nearMiss: (_s, v) => (v && (v.lowHealthRecoveries ?? 0) === 1)
            ? `${v.name} came off the floor once — one short`
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
        rarity: 'rare',
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
        rarity: 'rare',
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
        rarity: 'uncommon',
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
        hint: 'See one tribute personally set three zones burning, flooding or worse through their own actions.',
        category: 'arena',
        rarity: 'legendary',
        test: state => state.tributes.some(t => (t.zoneEffectsCaused ?? 0) >= 3),
        nearMiss: state => {
            const best = Math.max(0, ...state.tributes.map(t => t.zoneEffectsCaused ?? 0));
            return best === 2 ? 'somebody changed the state of two zones by their own hand — one short' : undefined;
        },
    },
    {
        id: 'unread',
        name: 'Unread',
        hint: 'Crown a victor the sponsors never sent a single thing.',
        category: 'capitol',
        rarity: 'uncommon',
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
        rarity: 'legendary',
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
        rarity: 'uncommon',
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
        rarity: 'uncommon',
        test: (state, v) => !!v && state.tributes.some(o =>
            o.id !== v.id && o.district === v.district && o.status === 'dead' && o.diedInBloodbath === true),
    },
    {
        id: 'clean-slate',
        name: 'Clean Slate',
        hint: 'Crown a victor who gained no traits in the arena and lost none — exactly who they went in as.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v
            && !v.traits.some(t => EARNED_TRAIT_NAMES.includes(t))
            && v.startingTraitCount !== undefined
            && v.traits.length === v.startingTraitCount,
    },
    {
        id: 'borrowed-time',
        name: 'Borrowed Time',
        hint: 'Crown a victor whose will to keep going dropped under ten and came back up.',
        category: 'survival',
        rarity: 'rare',
        test: (_s, v) => !!v && (v.minResolve ?? 100) < 10 && (v.resolve ?? 0) >= 10,
        nearMiss: (_s, v) => {
            if (!v) return undefined;
            const low = v.minResolve ?? 100;
            const now = v.resolve ?? 0;
            // Two ways to miss it: never dropped far enough, or dropped and
            // never climbed back out.
            if (low < 10 && now < 10) return `${v.name} came home on ${Math.round(now)} resolve — borrowed time needs them back above ten`;
            if (low >= 10 && low <= 20) return `${v.name}'s will bottomed out at ${Math.round(low)} — borrowed time starts under ten`;
            return undefined;
        },
    },
    {
        id: 'the-unwitnessed',
        name: 'The Unwitnessed',
        hint: 'Crown a victor who never once stood in the same sector as another living tribute after the bloodbath.',
        category: 'oddity',
        rarity: 'legendary',
        test: (_s, v) => !!v && v.metAnybodyAfterBloodbath !== true,
        // §1.1 (audit): 'Nobody's Ally' tested the same record with
        // `=== false` on a field that is only ever set `true`, so it could not
        // fire; it was a broken duplicate of this entry and is gone. Its
        // near-miss lives on here, corrected.
        nearMiss: (_s, v) => (v && v.metAnybodyAfterBloodbath === true && v.allianceId === undefined && v.kills === 0)
            ? `${v.name} never allied and never killed, but the arena still put them in front of somebody after the bloodbath`
            : undefined,
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
}

export const META_ACHIEVEMENTS: MetaAchievement[] = [
    // §11: the collector shelf, extended.
    {
        id: 'meta-every-quell',
        name: 'Every Quell',
        hint: 'See every Quarter Quell on the books play out.',
        test: t => t.quellTotal !== undefined && t.quellsSeen.length >= t.quellTotal,
    },
    {
        id: 'meta-every-gamemaker',
        name: 'Every Gamemaker',
        hint: 'Have every Head Gamemaker run one of your Games.',
        test: t => t.gamemakerTotal !== undefined && (t.gamemakersSeen ?? 0) >= t.gamemakerTotal,
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
    },
    {
        id: 'meta-ten-patron-crowns',
        name: 'Ten Patron Crowns',
        hint: 'Bring home ten victories for your patron district.',
        test: t => (t.patronWins ?? 0) >= 10,
    },
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
        id: 'meta-two-hundred-deaths',
        name: 'The Show Must Go On',
        hint: 'Witness two hundred deaths across all your Games.',
        test: t => t.deaths >= 200,
    },
    {
        id: 'meta-quell-collector',
        name: "The Capitol's Whims",
        hint: 'See five different Quarter Quells play out, win or lose.',
        test: t => t.quellsSeen.length >= 5,
    },
    {
        id: 'meta-hundred-games',
        name: 'A Life\'s Work',
        hint: 'Finish one hundred Games.',
        test: t => t.runs >= 100,
    },
    // §10.1: the collector shelf — career-wide completions over the stored
    // records that today's work started keeping (laws, biomes, the bestiary).
    {
        id: 'meta-law-abiding',
        name: 'Law Abiding',
        hint: 'Crown victors under all six of the arena laws.',
        test: t => (t.lawsWonUnder?.length ?? 0) >= 6,
    },
    {
        id: 'meta-every-biome',
        name: 'Every Biome',
        // §10.6: the biome roster went from eight to twelve, and an
        // achievement that counts a roster has to count the roster it has
        // rather than the one it shipped against.
        hint: 'Crown a victor in all twelve of the Gamemakers\' procedural biomes.',
        test: t => (t.biomesWon?.length ?? 0) >= PROCEDURAL_BIOME_COUNT,
    },
    {
        id: 'meta-twenty-eight',
        name: 'Twenty-Eight',
        hint: 'Crown a victor in every hand-authored arena the Capitol has ever built.',
        test: t => (t.handAuthoredTotal ?? 0) > 0 && (t.handAuthoredWon ?? 0) >= (t.handAuthoredTotal ?? Infinity),
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
    },
    {
        id: 'meta-full-bestiary',
        name: 'Full Bestiary',
        hint: 'Witness every named mutt the Gamemakers have on file, across all your Games.',
        test: t => (t.canonicalMuttTotal ?? 0) > 0 && (t.canonicalMuttsSeen ?? 0) >= (t.canonicalMuttTotal ?? Infinity),
    },
    {
        id: 'meta-statistician',
        name: 'Statistician',
        hint: 'See one tribute hold five of the record book\'s bests at the same time.',
        test: t => (t.maxSimultaneousBests ?? 0) >= 5,
    },
    {
        id: 'meta-long-memory',
        name: 'Long Memory',
        hint: 'Finish five hundred Games.',
        test: t => t.runs >= 500,
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
