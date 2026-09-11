import { GameState, Tribute } from '../models/types';
import { ODDS, SIDE_MARKETS } from '../data/balance';
import { tributeOdds } from './odds';

/**
 * §6.1: the proposition book, live-priced.
 *
 * The victor market was always the good one: `oddsScore` reads live form,
 * `tributeOdds` normalises it with an explicit discrimination exponent and an
 * explicit house margin, and the result measures out at 2.31x calibration —
 * victors priced at 16.0% against a field mean of 6.9%. A book that
 * discriminates.
 *
 * The side market was three rows of a fixed table:
 *
 *     const mult = kind === 'first-blood' ? 8 : kind === 'no-victor' ? 30 : 2.2;
 *
 * Eight-to-one on first blood is the same price whether you name the 2.1m
 * Career volunteer who has trained for this since they were seven, or the
 * twelve-year-old from 11 who spent the interview apologising. Both of those
 * are wrong, in opposite directions, and neither is a decision — you take
 * first blood on the Career every time and the market pays for it.
 *
 * So the side book is priced the same way the main book is: every market
 * declares a probability model over the actual pre-gong field, and the payout
 * falls out of it at the house margin. `SIDE_MARKETS` in balance.ts holds the
 * model's constants; nothing here is a magic number.
 *
 * Determinism is unaffected: pricing reads the field, never the RNG, so the
 * same seed prices the same board.
 */

export type SideBetKind =
    /** A named tribute draws the first blood of the Games. */
    | 'first-blood'
    /** Nobody is crowned. */
    | 'no-victor'
    /** The crown goes to a Career. */
    | 'career-victor'
    /** A named tribute is one of the last three standing. */
    | 'top-three'
    /** More than the line dies at the Cornucopia. */
    | 'bloodbath-over'
    /** Fewer than the line dies at the Cornucopia. */
    | 'bloodbath-under'
    /** The crown goes to a named district. */
    | 'victor-district'
    /** The Games are still running after the line. */
    | 'long-games';

/**
 * Every market, as a runtime list. Save normalisation validates an unknown
 * `kind` against this rather than against a copy of the union, so a market
 * added here is readable from a save the moment it exists.
 */
export const SIDE_BET_KINDS: readonly SideBetKind[] = [
    'first-blood', 'no-victor', 'career-victor', 'top-three',
    'bloodbath-over', 'bloodbath-under', 'victor-district', 'long-games',
] as const;

/** What a market needs beyond its kind to be a specific wager. */
export interface SideBetTarget {
    /** 'first-blood' and 'top-three': whose. */
    targetId?: string;
    /** 'victor-district': which district. */
    targetDistrict?: number;
    /**
     * 'bloodbath-over' / 'bloodbath-under' / 'long-games': the line the wager
     * was struck at. Stored on the bet rather than recomputed at settlement,
     * because the line moves with the field and the field moves during the run.
     */
    line?: number;
}

/** A priced market: what it is, what it pays, and what it is called. */
export interface SideQuote extends SideBetTarget {
    kind: SideBetKind;
    /** The book's implied probability, as a percentage, rounded for display. */
    pct: number;
    /** Payout multiplier on a winning stake. */
    mult: number;
    /** How the market reads on the board. */
    label: string;
}

/** How a settled market came out. A push returns the stake. */
export interface SideSettlement {
    won: boolean;
    /** Neither won nor lost — the line landed exactly on the result. */
    push: boolean;
    label: string;
}

const clampP = (p: number) => Math.min(SIDE_MARKETS.maxProbability, Math.max(SIDE_MARKETS.minProbability, p));

/** Payout from a probability, at the book's margin, in the shape the UI expects. */
function price(p: number): { pct: number; mult: number } {
    const clamped = clampP(p);
    return {
        pct: Math.max(1, Math.round(clamped * 100)),
        mult: Math.max(SIDE_MARKETS.minMult, Math.min(SIDE_MARKETS.maxMult, ODDS.houseMargin / clamped)),
    };
}

/** The field the book is pricing: everybody still standing. */
const liveField = (field: Tribute[]) => field.filter(t => t.status === 'alive');

/** Share of the field's crown probability held by tributes matching a filter. */
function oddsShare(field: Tribute[], match: (t: Tribute) => boolean): number {
    const pool = liveField(field);
    if (pool.length === 0) return 0;
    return pool.filter(match).reduce((sum, t) => sum + tributeOdds(t, pool).pct, 0) / 100;
}

/**
 * How likely each tribute is to open the killing.
 *
 * Not the crown model: first blood is drawn by whoever gets to the horn and
 * swings, which is aggression and reach rather than the ability to still be
 * standing on day nine. A tribute who will win by outlasting everybody is a
 * bad first-blood bet at any price, and the flat 8x said otherwise.
 */
function firstBloodWeight(t: Tribute): number {
    let w = SIDE_MARKETS.firstBloodBase;
    if (t.isCareer) w += SIDE_MARKETS.firstBloodCareer;
    w += t.attributes.strength * SIDE_MARKETS.firstBloodStrength;
    // balance-exempt: the midpoint fallback for an unscored tribute, matching engine/odds.ts
    w += (t.trainingScore || 5) * SIDE_MARKETS.firstBloodTraining;
    if (t.interviewStrategy === 'The Ruthless Warrior' || t.interviewStrategy === 'The Arrogant Brute') {
        w += SIDE_MARKETS.firstBloodAggressivePersona;
    }
    if (t.interviewStrategy === 'The Humble Underdog' || t.interviewStrategy === 'The Reluctant Hero') {
        w -= SIDE_MARKETS.firstBloodAggressivePersona;
    }
    return Math.max(SIDE_MARKETS.firstBloodFloor, w);
}

/**
 * Expected bloodbath body count for this cast.
 *
 * The measured share is about a third of the field, and a Career-heavy field
 * takes more — they are the ones who stay at the horn. Returned as a mean and
 * a spread so the over/under can be priced rather than guessed.
 */
function bloodbathModel(field: Tribute[]): { mean: number; sd: number } {
    const pool = liveField(field);
    const cast = pool.length;
    const careerShare = cast > 0 ? pool.filter(t => t.isCareer).length / cast : 0;
    const mean = cast * (SIDE_MARKETS.bloodbathShare + careerShare * SIDE_MARKETS.bloodbathCareerTilt);
    return { mean, sd: Math.max(SIDE_MARKETS.bloodbathSdFloor, cast * SIDE_MARKETS.bloodbathSdShare) };
}

/** Expected length of these Games, in days. A bigger cast runs longer; a top-heavy one ends sooner. */
function lengthModel(field: Tribute[]): { mean: number; sd: number } {
    const pool = liveField(field);
    const cast = pool.length;
    const careerShare = cast > 0 ? pool.filter(t => t.isCareer).length / cast : 0;
    const mean = SIDE_MARKETS.baseDays
        + cast * SIDE_MARKETS.daysPerTribute
        - careerShare * SIDE_MARKETS.careerDayPull;
    return { mean, sd: SIDE_MARKETS.daySpread };
}

/**
 * P(X > line) for a roughly normal X, via the logistic approximation.
 *
 * A real normal CDF here would be false precision — the underlying
 * distribution is not normal, it is a simulation — but the logistic gets the
 * shape right (symmetric, saturating) for a tenth of the code.
 */
function pOver(mean: number, sd: number, line: number): number {
    // balance-exempt: the logistic-to-normal shape constant, not a design dial
    return 1 / (1 + Math.exp(-(mean - line) / (sd * 0.5513)));
}

/** The default line the board offers for a counting market. */
export function bloodbathLine(field: Tribute[]): number {
    return Math.max(1, Math.round(bloodbathModel(field).mean));
}

export function lengthLine(field: Tribute[]): number {
    return Math.max(1, Math.round(lengthModel(field).mean));
}

const named = (field: Tribute[], id?: string) => field.find(t => t.id === id);

/**
 * Price one market against the current field. Returns undefined for a wager
 * that is not a wager — first blood on nobody, a district with no tributes.
 */
export function priceSideBet(kind: SideBetKind, field: Tribute[], target: SideBetTarget = {}): SideQuote | undefined {
    const pool = liveField(field);
    if (pool.length === 0) return undefined;

    switch (kind) {
        case 'first-blood': {
            const t = named(pool, target.targetId);
            if (!t) return undefined;
            const total = pool.reduce((sum, o) => sum + firstBloodWeight(o), 0);
            return {
                kind, targetId: t.id, ...price(firstBloodWeight(t) / total),
                label: `first blood drawn by ${t.name}`,
            };
        }
        case 'top-three': {
            const t = named(pool, target.targetId);
            if (!t) return undefined;
            // Three slots rather than one, but the favourites do not scale
            // linearly into them — a 30% favourite is not a 90% top-three
            // shot. The multiplier is sublinear and capped.
            const crown = tributeOdds(t, pool).pct / 100;
            const p = 1 - Math.pow(1 - crown, SIDE_MARKETS.topThreeExponent);
            return { kind, targetId: t.id, ...price(p), label: `${t.name} among the last three standing` };
        }
        case 'victor-district': {
            const district = target.targetDistrict;
            if (district === undefined || !pool.some(t => t.district === district)) return undefined;
            return {
                kind, targetDistrict: district,
                ...price(oddsShare(pool, t => t.district === district)),
                label: `the crown taken by District ${district}`,
            };
        }
        case 'career-victor':
            return { kind, ...price(oddsShare(pool, t => t.isCareer)), label: 'a Career victor' };
        case 'no-victor': {
            // A wipeout is rare and stays rare, but a field with no clear
            // closer is measurably likelier to run itself into the ground.
            const careerShare = pool.filter(t => t.isCareer).length / pool.length;
            const p = SIDE_MARKETS.noVictorBase * (1 + (SIDE_MARKETS.careerShareNorm - careerShare) * SIDE_MARKETS.noVictorCareerTilt);
            return { kind, ...price(p), label: 'a Games with no victor' };
        }
        case 'bloodbath-over':
        case 'bloodbath-under': {
            const line = target.line ?? bloodbathLine(pool);
            const { mean, sd } = bloodbathModel(pool);
            const over = pOver(mean, sd, line);
            const isOver = kind === 'bloodbath-over';
            return {
                kind, line, ...price(isOver ? over : 1 - over),
                label: `${isOver ? 'more' : 'fewer'} than ${line} dead at the Cornucopia`,
            };
        }
        case 'long-games': {
            const line = target.line ?? lengthLine(pool);
            const { mean, sd } = lengthModel(pool);
            return {
                kind, line, ...price(pOver(mean, sd, line)),
                label: `the Games still running after day ${line}`,
            };
        }
    }
}

/** The whole board, for a UI that wants to show what is on offer. */
export function quoteSideMarkets(field: Tribute[]): SideQuote[] {
    const pool = liveField(field);
    const districts = [...new Set(pool.map(t => t.district))].sort((a, b) => a - b);
    const quotes: Array<SideQuote | undefined> = [
        priceSideBet('career-victor', pool),
        priceSideBet('no-victor', pool),
        priceSideBet('bloodbath-over', pool),
        priceSideBet('bloodbath-under', pool),
        priceSideBet('long-games', pool),
        ...districts.map(d => priceSideBet('victor-district', pool, { targetDistrict: d })),
        ...pool.map(t => priceSideBet('first-blood', pool, { targetId: t.id })),
        ...pool.map(t => priceSideBet('top-three', pool, { targetId: t.id })),
    ];
    return quotes.filter((q): q is SideQuote => q !== undefined);
}

/**
 * How many tributes strictly outlived this one.
 *
 * A survivor outlives everybody who died; a tribute who died on day nine
 * outlives everybody who died earlier. Tributes who fell on the same day share
 * a position, and the settlement is lenient about it — a three-way tie for
 * third all counts as third. That is both the generous reading and the
 * defensible one: the Capitol pays out on the plate it read on the night.
 */
function outlivedBy(t: Tribute, field: Tribute[]): number {
    const rank = (o: Tribute) => (o.status === 'alive' ? Number.POSITIVE_INFINITY : (o.dayOfDeath ?? 0));
    const mine = rank(t);
    return field.filter(o => o.id !== t.id && rank(o) > mine).length;
}

/** Settles one wager from the finished run's own state. */
export function settleSideBet(state: GameState, bet: SideBetKind extends never ? never : {
    kind: SideBetKind; targetId?: string; targetDistrict?: number; line?: number;
}): SideSettlement {
    const survivors = state.tributes.filter(t => t.status === 'alive');
    const target = state.tributes.find(t => t.id === bet.targetId);
    const no = (label: string): SideSettlement => ({ won: false, push: false, label });
    const yes = (won: boolean, label: string): SideSettlement => ({ won, push: false, label });

    switch (bet.kind) {
        case 'first-blood':
            return yes(state.firstBloodId !== undefined && state.firstBloodId === bet.targetId,
                `first blood drawn by ${target?.name ?? 'a named tribute'}`);
        case 'no-victor':
            return yes(survivors.length === 0, 'a Games with no victor');
        case 'career-victor':
            return yes(survivors.some(t => t.isCareer), 'a Career victor');
        case 'top-three': {
            if (!target) return no('a named tribute among the last three standing');
            return yes(outlivedBy(target, state.tributes) < SIDE_MARKETS.topThreePlaces,
                `${target.name} among the last three standing`);
        }
        case 'victor-district':
            return yes(survivors.some(t => t.district === bet.targetDistrict),
                `the crown taken by District ${bet.targetDistrict}`);
        case 'bloodbath-over':
        case 'bloodbath-under': {
            const line = bet.line ?? 0;
            const dead = state.tributes.filter(t => t.diedInBloodbath).length;
            const label = `${bet.kind === 'bloodbath-over' ? 'more' : 'fewer'} than ${line} dead at the Cornucopia`;
            // The line landing exactly on the count is a push, not a loss —
            // the stake comes back. An over/under with no push is a coin flip
            // the house wins outright on the mode of the distribution.
            if (dead === line) return { won: false, push: true, label };
            return yes(bet.kind === 'bloodbath-over' ? dead > line : dead < line, label);
        }
        case 'long-games': {
            const line = bet.line ?? 0;
            const label = `the Games still running after day ${line}`;
            if (state.day === line) return { won: false, push: true, label };
            return yes(state.day > line, label);
        }
    }
}
