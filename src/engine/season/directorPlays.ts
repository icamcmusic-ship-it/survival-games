import { Tribute } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { DirectorTasteId, NEUTRAL_TASTE, directorTaste } from '../../data/directors';
import { SimContext, getAlive } from '../context';
import { calendarOf } from '../gamesProfile';
import { GamemakerEventType, triggerGamemakerEvent } from '../gamemaker';
import { eligibleMutts, engageMutt, rosterFor } from '../mutts';
import { startZoneEffect } from '../zoneEffects';
import { applyDamage, checkDeath } from '../combat';
import { adjustRel } from '../relationships';
import { SPONSOR_BLOCS } from '../sponsorBlocs';
import { addExcitement } from '../audience';
import { clampTribute } from '../vitals';
import { addCruelty, fairnessAllows } from './cruelty';
import { firstTime, withSideRng } from './runState';

/**
 * AUDIT-12 wave 3 §11/§12: directors who visibly play differently.
 *
 * A taste used to be a weight on draws the engine was already making, which
 * moved its metric by less than run-to-run noise (S3). Each taste now also has
 * two or three authored interventions — named turns, on named days, that only
 * that kind of director takes: the mutt-lover lets the rarest thing in the
 * pens loose on day five; the fire-lover scars a zone; the alliance-breaker
 * whispers to one member of the biggest pack about another.
 *
 * Every one draws from its own seeded stream (`withSideRng`), passes the
 * fairness guard (the cruelty meter), and is scheduled by the Capitol rather
 * than by the player's booth — so it is in the intervention log as scheduled
 * and is never double-fired by a replay.
 */
const D = AUDIT12_WAVE3.directors;

interface DirectorPlay {
    id: string;
    day: number;
    /** Returns true when the play actually landed. */
    run: (ctx: SimContext) => boolean;
}

function asGamemaker(ctx: SimContext, type: GamemakerEventType, targetId?: string) {
    const previous = ctx.state.gamemakerMode;
    ctx.state.gamemakerMode = true;
    try { triggerGamemakerEvent(ctx, type, targetId, true); } finally { ctx.state.gamemakerMode = previous; }
}

const mostWatched = (alive: Tribute[]) => [...alive].sort((a, b) => b.excitementRating - a.excitementRating || a.id.localeCompare(b.id))[0];
const busiestZone = (alive: Tribute[]) => {
    const counts = new Map<string, number>();
    alive.forEach(t => counts.set(t.zone, (counts.get(t.zone) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
};
const biggestPack = (alive: Tribute[]) => {
    const packs = new Map<string, Tribute[]>();
    alive.forEach(t => { if (t.allianceId) packs.set(t.allianceId, [...(packs.get(t.allianceId) ?? []), t]); });
    return [...packs.values()].sort((a, b) => b.length - a.length)[0];
};

const PLAYS: Record<DirectorTasteId, DirectorPlay[]> = {
    'mutt-lover': [
        {
            id: 'first-pens', day: D.earliestDay + 1, run: ctx => {
                ctx.logEvent('The Head Gamemaker has been itching to open the pens since the gong. Today nobody stops them.', [], { category: 'gamemaker', important: true });
                asGamemaker(ctx, 'mutt');
                return true;
            },
        },
        {
            id: 'rarest-mutt', day: D.rareMuttDay, run: ctx => {
                const alive = getAlive(ctx.state);
                // The rarest thing in the pens goes to whoever can least outrun it.
                const mark = [...alive].sort((a, b) => a.health - b.health || a.id.localeCompare(b.id))[0];
                if (!mark) return false;
                const seen = new Set(ctx.state.muttsSeen ?? []);
                const roster = rosterFor(ctx);
                const eligible = eligibleMutts(ctx, mark, ctx.state.timeOfDay === 'day' ? 'day' : 'night');
                const pool = (eligible.length > 0 ? eligible : roster);
                // The rarest: one this Games has not shown yet, and the most dangerous of those.
                const rare = [...pool].sort((a, b) => Number(seen.has(a.name)) - Number(seen.has(b.name))
                    || (b.damage * b.speed) - (a.damage * a.speed) || a.id.localeCompare(b.id))[0];
                if (!rare) return false;
                ctx.logEvent(
                    `Day ${ctx.state.day}, as promised in the Head Gamemaker's last interview: the rarest thing in the pens. ${rare.name} are loosed on ${mark.name} in ${mark.zone}.`,
                    [mark.id],
                    { category: 'gamemaker', important: true, zone: mark.zone },
                );
                engageMutt(ctx, mark, rare);
                // It does not stop at one.
                alive.filter(t => t.id !== mark.id && t.zone === mark.zone && t.status === 'alive').forEach(t => engageMutt(ctx, t, rare));
                return true;
            },
        },
        {
            id: 'hunting-season', day: D.rareMuttDay + 2, run: ctx => {
                const weakest = [...getAlive(ctx.state)].sort((a, b) => a.health - b.health || a.id.localeCompare(b.id)).slice(0, 3);
                if (weakest.length === 0) return false;
                ctx.logEvent('The pens are left open overnight. The mutts find the ones who are already bleeding.', weakest.map(t => t.id), { category: 'gamemaker', important: true });
                weakest.forEach(t => asGamemaker(ctx, 'mutt', t.id));
                return true;
            },
        },
    ],
    'fire-lover': [
        {
            id: 'scar-a-zone', day: D.scarDay, run: ctx => {
                const alive = getAlive(ctx.state);
                const zone = busiestZone(alive);
                if (!zone) return false;
                ctx.logEvent(`The Head Gamemaker wants a scar on the map. ${zone} is set alight from end to end, with whoever is standing in it.`, [], { category: 'gamemaker', important: true, zone });
                startZoneEffect(ctx, zone, 'burning');
                alive.filter(t => t.zone === zone).forEach(t => {
                    if (ctx.rng.chance(D.scarDodge)) return;
                    applyDamage(ctx, t, D.scarDamage, { cause: `Caught in the fire that scarred ${zone}`, code: 'burns', kind: 'gamemaker' });
                    clampTribute(t);
                    checkDeath(ctx, t, `Caught in the fire that scarred ${zone}`);
                });
                return true;
            },
        },
        {
            id: 'second-burn', day: D.scarDay + 3, run: ctx => {
                ctx.logEvent('Another fire, because the last one rated so well.', [], { category: 'gamemaker', important: true });
                asGamemaker(ctx, 'burn');
                asGamemaker(ctx, 'weather');
                return true;
            },
        },
    ],
    'alliance-breaker': [
        {
            id: 'whisper', day: D.whisperDay, run: ctx => {
                const pack = biggestPack(getAlive(ctx.state));
                if (!pack || pack.length < 2) return false;
                const [a, b] = [...pack].sort((x, y) => x.id.localeCompare(y.id));
                adjustRel(a, b.id, D.whisperRegard);
                adjustRel(b, a.id, D.whisperRegard / 2);
                ctx.logEvent(
                    `A note comes down on a parachute for ${a.name}, in no mentor's handwriting. It says what ${b.name} has been saying about them when they are asleep. None of it is true. ${a.name} reads it three times.`,
                    [a.id, b.id],
                    { category: 'gamemaker', important: true },
                );
                return true;
            },
        },
        {
            id: 'second-whisper', day: D.whisperDay + 2, run: ctx => {
                const packs = new Map<string, Tribute[]>();
                getAlive(ctx.state).forEach(t => { if (t.allianceId) packs.set(t.allianceId, [...(packs.get(t.allianceId) ?? []), t]); });
                const hit = [...packs.values()].filter(p => p.length >= 2);
                if (hit.length === 0) return false;
                hit.forEach(pack => {
                    const [a, b] = [...pack].sort((x, y) => y.id.localeCompare(x.id));
                    adjustRel(a, b.id, D.whisperRegard);
                    adjustRel(b, a.id, D.whisperRegard);
                });
                ctx.logEvent('Every pack left in the arena gets a note tonight, and every note names somebody inside it.', hit.flat().map(t => t.id), { category: 'gamemaker', important: true });
                return true;
            },
        },
        {
            id: 'price-on-the-leader', day: D.whisperDay + 3, run: ctx => {
                const pack = biggestPack(getAlive(ctx.state));
                if (!pack || pack.length < 2) return false;
                asGamemaker(ctx, 'bounty', mostWatched(pack)?.id);
                return true;
            },
        },
    ],
    'weather-obsessed': [
        {
            id: 'front', day: D.frontDay, run: ctx => { asGamemaker(ctx, 'weather'); return true; },
        },
        {
            id: 'fog', day: D.frontDay + 2, run: ctx => { asGamemaker(ctx, 'fog'); asGamemaker(ctx, 'weather'); return true; },
        },
        {
            id: 'flood', day: D.frontDay + 4, run: ctx => { asGamemaker(ctx, 'flood'); return true; },
        },
    ],
    'sponsor-friendly': [
        {
            id: 'open-house', day: D.openHouseDay, run: ctx => {
                const purse = ctx.state.sponsorBlocBudgets;
                if (purse) {
                    SPONSOR_BLOCS.forEach(b => { purse[b.id] = Math.round((purse[b.id] ?? 0) + b.budget * D.purseTopUp); });
                }
                ctx.logEvent('The Head Gamemaker throws the sponsors a party in the Training Center. Every bloc leaves with a fuller purse and a list of names.', [], { category: 'sponsor', important: true });
                return true;
            },
        },
        {
            id: 'supply-day', day: D.openHouseDay + 2, run: ctx => { asGamemaker(ctx, 'drop'); return true; },
        },
        {
            id: 'second-open-house', day: D.openHouseDay + 4, run: ctx => {
                const purse = ctx.state.sponsorBlocBudgets;
                if (purse) SPONSOR_BLOCS.forEach(b => { purse[b.id] = Math.round((purse[b.id] ?? 0) + b.budget * D.purseTopUp); });
                asGamemaker(ctx, 'drop');
                ctx.logEvent('The sponsors are invited back, and the purses are refilled again. The drop that follows is not subtle.', [], { category: 'sponsor', important: true });
                return true;
            },
        },
    ],
    showrunner: [
        {
            id: 'spotlight', day: D.spotlightDay, run: ctx => {
                const star = [...getAlive(ctx.state)].sort((a, b) => b.kills - a.kills || b.excitementRating - a.excitementRating || a.id.localeCompare(b.id))[0];
                if (!star) return false;
                addExcitement(star, D.bountyExcitement);
                asGamemaker(ctx, 'reveal', star.id);
                asGamemaker(ctx, 'bounty', star.id);
                return true;
            },
        },
        {
            id: 'set-piece', day: D.spotlightDay + 2, run: ctx => { asGamemaker(ctx, 'mutt'); asGamemaker(ctx, 'weather'); return true; },
        },
        {
            id: 'finale-staging', day: D.spotlightDay + 4, run: ctx => {
                const star = [...getAlive(ctx.state)].sort((a, b) => b.excitementRating - a.excitementRating || a.id.localeCompare(b.id))[0];
                if (!star) return false;
                ctx.logEvent(`The showrunner wants a finale, and stages it around ${star.name}.`, [star.id], { category: 'gamemaker', important: true });
                asGamemaker(ctx, 'reveal', star.id);
                asGamemaker(ctx, 'burn');
                return true;
            },
        },
    ],
    'hands-off': [
        {
            id: 'quiet-day', day: D.earliestDay + 2, run: ctx => {
                const s = ctx.state.season;
                if (s?.cruelty) s.cruelty = Math.round(s.cruelty * D.quietRelief * 10) / 10;
                cancelNextBeat(ctx, 'The control room is told to keep its hands in its lap today');
                return true;
            },
        },
        {
            id: 'one-mercy', day: D.earliestDay + 5, run: ctx => {
                asGamemaker(ctx, 'mercy');
                cancelNextBeat(ctx, 'The Head Gamemaker lets one more thing go');
                return true;
            },
        },
    ],
};

/**
 * Hands-off: the next harmful beat on the Capitol's calendar is quietly struck
 * off. The calendar was announced, so the chronicle says it was cancelled.
 */
function cancelNextBeat(ctx: SimContext, lead: string): void {
    const profile = ctx.state.gamesProfile;
    if (!profile) return;
    const fired = ctx.state.firedWildcards ?? (ctx.state.firedWildcards = []);
    const calendar = calendarOf(profile);
    const next = calendar.findIndex((w, i) => w.day > ctx.state.day && !fired.includes(i)
        && ['mutt-release', 'weather-front', 'bounty', 'crowd-revolt'].includes(w.kind));
    if (next < 0) {
        ctx.logEvent(`${lead}. Nothing is released, nothing is changed; the arena is left to the tributes.`, [], { category: 'gamemaker' });
        return;
    }
    fired.push(next);
    const season = ctx.state.season ?? (ctx.state.season = {});
    season.cancelledBeats = (season.cancelledBeats ?? 0) + 1;
    ctx.logEvent(`${lead}: ${calendar[next].name}, due on day ${calendar[next].day}, is struck off the schedule.`, [], { category: 'gamemaker', important: true });
}

/** The authored plays of a taste, for the briefing and the checks. */
export function directorPlaysOf(taste: DirectorTasteId): Array<{ id: string; day: number }> {
    return PLAYS[taste].map(p => ({ id: p.id, day: p.day }));
}

/** Called once per cycle. Fires at most one authored play per cycle. */
export function runDirectorPlays(ctx: SimContext): void {
    const state = ctx.state;
    if (state.config.vanillaRules || !state.headGamemaker) return;
    if (state.day < D.earliestDay || getAlive(state).length <= 2) return;
    const taste = directorTaste(state.headGamemaker);
    if (taste === NEUTRAL_TASTE) return;
    const due = (PLAYS[taste.id] ?? []).find(p => p.day <= state.day && !(state.season?.directorFired ?? []).includes(`dir:${p.id}`));
    if (!due) return;
    // The fairness guard: a booth that has already leaned too hard waits.
    // Hands-off plays are kindnesses and are never held back.
    if (taste.id !== 'hands-off' && !fairnessAllows(state)) return;
    if (!firstTime(state, `dir:${due.id}`)) return;
    const landed = withSideRng(ctx, `director-${due.id}`, () => due.run(ctx));
    if (landed && taste.id !== 'hands-off') addCruelty(state, 'director', `${state.headGamemaker}: ${due.id}`);
}
