import { CAUSE_FAMILY, deathCodeOf } from '../engine/causes';
import { EventLog, GameState, Tribute } from '../models/types';
import { PanemRecords } from './panemStorage';
import { areLovers, isStarCrossed } from '../engine/alliance';

/**
 * "How did that happen."
 *
 * The record book was a trophy case: it recorded that something was a personal
 * best and never reacted to anything else. Most of what makes a run memorable
 * is not a record — it is the two or three statistically unusual things that
 * happened in it, which the player has no way of recognising as unusual because
 * they have nothing to compare against.
 *
 * This reads the finished run against the player's own Panem history and
 * surfaces the handful of things worth remarking on. Everything here is derived
 * from state the run already holds; nothing new is tracked for it.
 */

/**
 * AUDIT-9 batch 3: which part of the run a highlight is about.
 *
 * Used for diversity in selection. Three true sentences about the same thing
 * are a worse summary than three about different things, and the old selector
 * — sort by weight, take three — had no way to know it was doing that.
 */
export type NotableCategory =
    | 'victor'      // who won and what it cost them
    | 'shape'       // the run's overall arc: length, mortality, the horn
    | 'deaths'      // how people died
    | 'social'      // alliances, betrayal, love, vengeance
    | 'capitol';    // sponsors, Quells, the Gamemakers, the odds board

/**
 * AUDIT-9 batch 3: what a highlight is standing on.
 *
 * The audit's P1 for the end screen is that "each highlight can open the exact
 * event, phase and people supporting it", and that "invalid or unknown facts
 * are omitted". The second half shipped in batch 1 — B01's repair reports an
 * unreconstructible bloodbath count as unknown rather than as zero. This is
 * the first half: a line that makes a claim about something that happened
 * carries the log entries it read, so the player can go and look.
 *
 * Absent means "derived from the whole run rather than from particular
 * events" — a mortality rate has no single moment to open — not "unverified".
 */
export interface NotableEvidence {
    /** Log entry ids this line was derived from. */
    logIds: string[];
    /** Everyone the line is about, so the UI can open their dossiers. */
    tributeIds: string[];
    /** Where in the run to jump to. */
    day?: number;
    phase?: string;
}

export interface Notable {
    /** One sentence, already phrased for the end screen. */
    text: string;
    /** Rough interest, used only for ordering. */
    weight: number;
    /** Which part of the run this is about. See `NotableCategory`. */
    category: NotableCategory;
    /**
     * AUDIT-9 batch 3: a measured comparison against the player's own history,
     * or a thing that is simply notable about this run.
     *
     * The audit's objection: "Several summary lines are threshold-based
     * flavour, although the UI describes them as measured against personal
     * history." The panel is headed "What made these Games unusual", which is
     * a claim about a baseline — and most of these lines never had one. They
     * are not wrong, they are a different kind of true, and the two are now
     * labelled apart so the heading can stop overclaiming.
     */
    kind: 'moment' | 'comparison';
    /** What it read, when it can name it. See `NotableEvidence`. */
    evidence?: NotableEvidence;
}

/**
 * AUDIT-10 B04/B07: everyone who came out, not the first row of the cast that
 * happens to still be breathing.
 *
 * A dual win is a real ending in this game, and reading `find(alive)` made the
 * second victor invisible to every line below — including the star-crossed one,
 * which then told the audience their partner was dead while the partner was
 * standing next to them on the podium. `victorIds` is the run's own record of
 * who the Games crowned; the living-cast scan is the fallback for a state that
 * predates it, and it returns *all* of them either way.
 */
export function victorsOf(state: GameState): Tribute[] {
    const byId = new Map(state.tributes.map(t => [t.id, t]));
    const declared = (state.victorIds ?? [])
        .map(id => byId.get(id))
        .filter((t): t is Tribute => t !== undefined);
    if (declared.length > 0) return declared;
    return state.tributes.filter(t => t.status === 'alive');
}

/**
 * AUDIT-10 B01: how many actually died at the horn.
 *
 * `dayOfDeath === 0` was a question no death in the game can answer:
 * `startGames()` sets `day = 1` before the bloodbath runs, so every horn death
 * is stamped day 1 — as is every death for the rest of that first day. The
 * count was therefore always zero, and the quiet-bloodbath highlight fired with
 * a confident "nobody" over a massacre.
 *
 * The phase flag is the only thing that separates the two, so an old record
 * that predates it cannot be reconstructed: it returns `undefined` rather than
 * a fabricated zero, and the caller says nothing instead of saying something
 * false.
 */
/**
 * AUDIT-9 batch 3: turn the log entries a line was derived from into the
 * receipt the end screen can open.
 *
 * Capped, because a highlight about nine betrayals does not need to hand the
 * UI nine jump targets — the first few are what somebody actually wants to
 * look at, and the sentence already carries the count.
 */
function evidenceFrom(logs: EventLog[]): NotableEvidence | undefined {
    if (logs.length === 0) return undefined;
    const shown = logs.slice(0, 4);
    return {
        logIds: shown.map(l => l.id),
        tributeIds: [...new Set(shown.flatMap(l => l.tributesInvolved))],
        day: shown[0].day,
        phase: shown[0].phase,
    };
}

export function bloodbathDeathCount(state: GameState): number | undefined {
    const dead = state.tributes.filter(t => t.status === 'dead');
    if (dead.length === 0) return 0;
    if (dead.every(t => t.diedInBloodbath === undefined)) return undefined;
    return dead.filter(t => t.diedInBloodbath === true).length;
}

function ordinalSuffix(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/**
 * Everything true about this run that is worth a sentence, before selection.
 *
 * `runNotables` shows the best three, which is right for the end screen and
 * wrong for anything that wants to ask whether a given fact was *found* — a
 * test, or a "see everything" expansion. Selection and derivation are separate
 * concerns and this is the derivation.
 */
export function allNotables(state: GameState, records: PanemRecords): Notable[] {
    const notables: Notable[] = [];
    const winners = victorsOf(state);
    const victor = winners[0];
    const dead = state.tributes.filter(t => t.status === 'dead');
    const cast = state.tributes.length;
    const gamesNumber = state.gamesProfile?.gamesNumber;
    const gamesName = gamesNumber ? `the ${ordinalSuffix(gamesNumber)} Games` : 'these Games';

    // §(requests): the old version asserted things it had not measured — a
    // hard-coded "Twenty-four went in", a zero-kill count read off the total
    // victor count, "the longest feud on record" against no record, "the odds
    // board never had them near the top" without reading the odds board.
    // Every line below is derived from a number the state actually holds.

    // --- The victor ---
    if (victor) {
        if (victor.kills === 0) {
            const prior = records.recentRuns?.slice(1).filter(r => r.victorKills === 0).length ?? 0;
            notables.push({
                weight: 9,
                text: `${victor.name} won ${gamesName} without killing anybody.`
                    + (prior > 0 ? ` You have seen that ${prior === 1 ? 'once' : `${prior} times`} before in your recent Games.` : ' That is a first in your recent Games.'), category: 'victor', kind: 'comparison' });
        }
        if (victor.age <= 13) {
            notables.push({ weight: 10, text: `${victor.name} was ${victor.age} years old. The Capitol will be talking about this one for a long time.`, category: 'victor', kind: 'moment' });
        }
        if (victor.health <= 15) {
            notables.push({ weight: 8, text: `${victor.name} came out of the arena on ${Math.round(victor.health)} health. Another exchange either way and there is no victor at all.`, category: 'victor', kind: 'moment' });
        }
        if (victor.kills >= 6) {
            notables.push({ weight: 8, text: `${victor.name} finished with ${victor.kills} kills — a body count the Capitol has to edit down for the recap.`, category: 'victor', kind: 'moment' });
        }
        // The odds board, actually read: where the book had them on day one.
        const history = state.oddsHistory ?? {};
        const firstDay = Object.keys(history).map(Number).sort((a, b) => a - b)[0];
        const opening = firstDay !== undefined ? history[firstDay] : undefined;
        if (opening && opening[victor.id] !== undefined) {
            const ranked = Object.entries(opening).sort((a, b) => b[1] - a[1]);
            const rank = ranked.findIndex(([id]) => id === victor.id) + 1;
            if (rank > Math.ceil(ranked.length / 2)) {
                notables.push({
                    weight: 7,
                    text: `The book opened ${victor.name} ${ordinalSuffix(rank)} of ${ranked.length} at ${opening[victor.id]}%. Nobody in the Capitol had money on this.`, category: 'capitol', kind: 'moment' });
            }
        }
        // AUDIT-10 B04: "came out of them alone" is a claim about a specific
        // other person, so it reads that person. The trait alone said only that
        // this tribute loved somebody — not that the somebody is dead, and not
        // that they are not also standing on the podium.
        if (isStarCrossed(victor)) {
            const partner = state.tributes.find(o => areLovers(victor, o));
            const bothWon = partner !== undefined && winners.some(w => w.id === partner.id);
            if (bothWon) {
                notables.push({ weight: 11, text: `${victor.name} and ${partner!.name} both came out. The Capitol wanted the romance and got it, and is now working out what to do about having promised one victor.`, category: 'social', kind: 'moment' });
            } else if (partner && partner.status === 'dead') {
                notables.push({ weight: 9, text: `${victor.name} went into these Games in love with ${partner.name} and came out of them alone. The broadcast will not dwell on the arithmetic of that.`, category: 'social', kind: 'moment' });
            }
        }
    } else {
        const priorWipeouts = records.recentRuns?.slice(1).filter(r => r.victorName === undefined).length ?? 0;
        notables.push({
            weight: 12,
            text: `Nobody won ${gamesName}. ${cast} went in and the arena kept all of them`
                + (priorWipeouts > 0 ? `, which has happened ${priorWipeouts === 1 ? 'once' : `${priorWipeouts} times`} before in your recent Games.` : '.'), category: 'shape', kind: 'comparison' });
    }

    // --- The shape of the run --- counted from who actually died at the horn.
    const bloodbathDeaths = bloodbathDeathCount(state);
    if (bloodbathDeaths !== undefined && bloodbathDeaths >= Math.ceil(cast * 0.55)) {
        notables.push({ weight: 7, text: `The bloodbath took ${bloodbathDeaths} of ${cast}. More than half the cast never got clear of the Cornucopia.`, category: 'shape', kind: 'moment' });
    } else if (bloodbathDeaths !== undefined && bloodbathDeaths <= 2 && cast >= 12) {
        notables.push({ weight: 7, text: `${bloodbathDeaths === 0 ? 'Nobody' : bloodbathDeaths === 1 ? 'Only one tribute' : 'Only two tributes'} died at the Cornucopia. A bloodbath that quiet usually means the Gamemakers have to work harder later.`, category: 'shape', kind: 'moment' });
    }

    if (state.day >= 14) {
        notables.push({ weight: 6, text: `These Games ran ${state.day} days. The Capitol schedules a fortnight and hates being made to keep to it.`, category: 'shape', kind: 'moment' });
    } else if (state.day <= 4 && victor) {
        notables.push({ weight: 6, text: `Over in ${state.day} days. Somebody in programming is being asked why the broadcast window was booked for two weeks.`, category: 'shape', kind: 'moment' });
    }

    // --- The longest feud, from the rivalry ledger. Stated as this run's, not "on record". ---
    let worstFeud: { a: Tribute; b: Tribute; fights: number } | undefined;
    state.tributes.forEach(t => {
        Object.entries(t.memory?.rivals ?? {}).forEach(([id, record]) => {
            const other = state.tributes.find(o => o.id === id);
            if (!other) return;
            if (!worstFeud || record.fights > worstFeud.fights) worstFeud = { a: t, b: other, fights: record.fights };
        });
    });
    if (worstFeud && worstFeud.fights >= 3) {
        notables.push({ weight: 7, text: `${worstFeud.a.name} and ${worstFeud.b.name} fought each other ${worstFeud.fights} separate times — the longest feud in these Games.`, category: 'social', kind: 'moment' });
    }

    // --- How people actually died. A tribute-dealt death is "Killed by" or a
    // wound somebody opened; everything else is the arena's. ---
    const arenaDeaths = dead.filter(t => {
        // AUDIT-9: "the arena killed them" is a cause family, not a pair of
        // string tests. The old version also had to special-case "a wound X
        // opened" by hand, because a tribute-attributed bleed does not start
        // with "Killed by" — exactly the kind of exception a taxonomy exists
        // to stop everybody re-deriving.
        const code = deathCodeOf(t);
        return CAUSE_FAMILY[code] === 'arena' || CAUSE_FAMILY[code] === 'body';
    }).length;
    if (dead.length >= 6 && arenaDeaths >= Math.ceil(dead.length * 0.5)) {
        notables.push({ weight: 6, text: `${arenaDeaths} of the ${dead.length} dead were killed by the arena rather than by each other. This was a Games about supplies.`, category: 'deaths', kind: 'moment' });
    }
    // AUDIT-9: both chosen endings, by code. `nightlock` and `self-inflicted`
    // are separate codes because they are separate beats, and this line is
    // about the choice rather than about the berry.
    const nightlock = dead.filter(t => {
        const code = deathCodeOf(t);
        return code === 'nightlock' || code === 'self-inflicted';
    }).length;
    if (nightlock > 0) {
        notables.push({ weight: 11, text: `${nightlock === 1 ? 'One tribute' : `${nightlock} tributes`} chose to end it rather than keep playing. The Capitol cut away and had to cut back.`, category: 'deaths', kind: 'moment' });
    }

    // --- Social ---
    const betrayalLogs = state.log.filter(l => l.category === 'betrayal');
    const betrayals = betrayalLogs.length;
    if (betrayals === 0 && cast >= 12) {
        notables.push({ weight: 8, text: 'Not one tribute betrayed an ally this year. In an arena built to make that happen, nobody did.', category: 'social', kind: 'moment' });
    } else if (betrayals >= 5) {
        notables.push({
            weight: 6,
            text: `${betrayals} separate betrayals. Nobody in this arena could afford to sleep.`,
            category: 'social', kind: 'moment',
            evidence: evidenceFrom(betrayalLogs),
        });
    }
    /*
     * AUDIT-10 B05: a historical statement read from a historical record.
     *
     * This used to read the *surviving* alliance registry, which at the end of
     * a run is almost always empty — 119 of 120 probe runs had a pack of five
     * or more during play and none of them still had one at the end, so the
     * line essentially never fired and, when it did, described the wreckage
     * rather than the pack. `allianceChronicle` keeps the peak.
     */
    const peak = [...(state.allianceChronicle ?? [])].sort((a, b) => b.peakSize - a.peakSize)[0];
    if (peak && peak.peakSize >= 5) {
        const held = Math.max(1, peak.lastCycle - peak.formedCycle + 1);
        notables.push({
            weight: 5,
            text: `${peak.name ? `${peak.name} ran ${peak.peakSize} deep` : `A pack of ${peak.peakSize} held together`} in there, for ${held === 1 ? 'a single cycle' : `${held} cycles`}. Groups that size usually eat themselves long before the final eight.`, category: 'social', kind: 'moment' });
    }
    const allianceLines = state.log.filter(l => l.category === 'alliance').length;
    if (allianceLines === 0 && cast >= 12) {
        notables.push({ weight: 8, text: 'Not one alliance formed this year. Every tribute in that arena played it completely alone.', category: 'social', kind: 'moment' });
    }
    const lovers = state.tributes.filter(t => isStarCrossed(t));
    if (lovers.length >= 2 && lovers.every(l => l.status === 'dead')) {
        notables.push({ weight: 9, text: 'The romance the Capitol built its broadcast around ended with neither of them coming home.', category: 'social', kind: 'moment' });
    }
    /*
     * AUDIT-10 B06: the sentence claims a pursuit was carried out, so it reads
     * the event that records one.
     *
     * The old detector matched the `VENGEANCE` prose prefix, which is the
     * *oath* — sworn in 120 of 120 probe runs, and paid in 32. It was reporting
     * a completed hunt every single time somebody said they would.
     */
    const paid = state.log.filter(l => l.type === 'vengeance-paid');
    const sworn = state.log.filter(l => l.type === 'vengeance-sworn');
    if (paid.length > 0) {
        notables.push({
            weight: 7,
            text: 'Somebody in that arena did not just survive — they went and found the specific person who took someone from them.',
            category: 'social', kind: 'moment',
            evidence: evidenceFrom(paid),
        });
    } else if (sworn.length > 0) {
        notables.push({
            weight: 4,
            text: 'An oath was sworn over a body in there, and the arena ended before anybody collected on it.',
            category: 'social', kind: 'moment',
            evidence: evidenceFrom(sworn),
        });
    }

    // --- What the Capitol had planned before the gong ---
    const profile = state.gamesProfile;
    if (profile?.quell) {
        notables.push({ weight: 13, text: `This was ${profile.quell.name} — a Quarter Quell. ${profile.quell.announcement.replace(/^QUARTER QUELL:\s*/i, '')}`, category: 'capitol', kind: 'moment' });
    }
    if (profile && profile.temperament.id !== 'standard') {
        notables.push({ weight: 4, text: `The Capitol billed this as ${profile.temperament.name}. ${profile.temperament.blurb}`, category: 'capitol', kind: 'moment' });
    }
    if (profile?.castShape && profile.castShape.id !== 'ordinary' && profile.castShape.id !== 'victors-field') {
        notables.push({ weight: 4, text: `The reaping itself was unusual: ${profile.castShape.name}. ${profile.castShape.blurb}`, category: 'capitol', kind: 'moment' });
    }

    // --- The mentor who mattered ---
    if (victor?.mentorLegacy) {
        const landed = state.log.some(l =>
            l.category === 'sponsor' && l.important && l.tributesInvolved.includes(victor.id) && l.text.includes(victor.mentorLegacy!));
        if (landed) {
            notables.push({ weight: 7, text: `${victor.mentorLegacy} spent everything they had on ${victor.name}, and it is the reason there was a victor to talk about at all.`, category: 'capitol', kind: 'moment' });
        }
    }

    // --- A favourite the Capitol lost early ---
    // AUDIT-10 B02: same day-zero mistake as B01 — the horn is a phase, not a
    // calendar day, so this never found anybody.
    const earlyFavourite = dead.find(t => t.fanFavourite && t.diedInBloodbath === true);
    if (earlyFavourite) {
        notables.push({ weight: 8, text: `${earlyFavourite.name} was supposed to be this year's story. The bloodbath did not care.`, category: 'capitol', kind: 'moment' });
    }

    return notables.sort((a, b) => b.weight - a.weight);
}

/**
 * The three the end screen shows — chosen for spread, not just for weight.
 *
 * AUDIT-9 batch 3: "avoid selecting three variations of the same story".
 *
 * `sort by weight, take three` has no way to notice that it has picked the
 * victor's kill count, the victor's health and the victor's age, and in a run
 * with a dramatic victor that is exactly what it picked — three sentences
 * about one person, while the pack that ran the arena for five days and the
 * betrayal that ended it went unmentioned.
 *
 * So: the strongest line wins outright, and each subsequent slot prefers the
 * best line from a category not already used. Weight still decides inside a
 * category, and a run that genuinely only has one kind of story to tell still
 * fills its three slots from that kind rather than padding with nothing.
 */
export function runNotables(state: GameState, records: PanemRecords): Notable[] {
    const pool = allNotables(state, records);
    const picked: Notable[] = [];
    const used = new Set<NotableCategory>();
    while (picked.length < 3) {
        const fresh = pool.find(n => !picked.includes(n) && !used.has(n.category))
            ?? pool.find(n => !picked.includes(n));
        if (!fresh) break;
        picked.push(fresh);
        used.add(fresh.category);
    }
    return picked;
}

/**
 * §10.7: the post-run delta — how this Games compared with the player's own
 * last few in the same arena.
 *
 * Every other panel on the end screen is about this run in isolation, or about
 * a personal best. Neither of those is how a repeat player actually experiences
 * progress: what they want to know is whether this one went differently from
 * the last ones, and in which direction. The per-run stats already existed and
 * simply reset every time; this turns them into a felt sense of a series.
 *
 * Compares against runs in the same arena where there are any, and against the
 * whole recent window where there are not — a first run in a new arena is
 * still worth situating.
 */
export function runDelta(state: GameState, records: PanemRecords): string[] {
    // `recentRuns[0]` is this run, written by `commitRun` immediately before
    // the outcome is assembled, so the comparison set excludes it.
    const history = (records.recentRuns ?? []).slice(1);
    if (history.length === 0) return [];

    const sameArena = history.filter(r => r.arenaName === state.arena.name);
    const pool = sameArena.length > 0 ? sameArena : history;
    const scope = sameArena.length > 0 ? `your last ${sameArena.length} in ${state.arena.name}` : `your last ${history.length} Games`;
    const out: string[] = [];

    const victor = state.tributes.find(t => t.status === 'alive');
    const mean = (pick: (r: typeof pool[number]) => number | undefined) => {
        const values = pool.map(pick).filter((v): v is number => typeof v === 'number');
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
    };

    const avgDays = mean(r => r.day);
    if (avgDays !== undefined && Math.abs(state.day - avgDays) >= 1.5) {
        out.push(state.day > avgDays
            ? `Longer than usual: ${state.day} days against an average of ${avgDays.toFixed(1)} across ${scope}.`
            : `Shorter than usual: ${state.day} days against an average of ${avgDays.toFixed(1)} across ${scope}.`);
    }

    /*
     * AUDIT-10: "bloodier" as a share of the field, not a raw body count.
     *
     * With one victor, final deaths are cast size minus one almost by
     * definition, so comparing raw totals across runs of different cast sizes
     * was mostly reporting that the last field was bigger. The rate is
     * comparable; runs whose cast size the store never recorded are excluded
     * rather than assumed to match.
     */
    const deaths = state.tributes.filter(t => t.status === 'dead').length;
    const rate = deaths / Math.max(1, state.tributes.length);
    const avgRate = mean(r => (r.cast ? r.deaths / r.cast : undefined));
    if (avgRate !== undefined && Math.abs(rate - avgRate) >= 0.08) {
        const pct = (v: number) => `${Math.round(v * 100)}%`;
        out.push(rate > avgRate
            ? `Bloodier: ${pct(rate)} of the field died, against ${pct(avgRate)} across ${scope}.`
            : `Quieter: ${pct(rate)} of the field died, against ${pct(avgRate)} across ${scope}.`);
    }

    if (victor) {
        const seenArchetypes = new Set(pool.map(r => r.victorArchetype).filter(Boolean));
        if (seenArchetypes.size > 0 && !seenArchetypes.has(victor.archetype)) {
            out.push(`A kind of victor you have not crowned lately — no ${victor.archetype} has won in ${scope}.`);
        }
        const districts = pool.map(r => r.victorDistrict).filter((d): d is number => typeof d === 'number');
        const streak = districts.length > 0 && districts.every(d => d === districts[0]);
        if (streak && victor.district !== districts[0]) {
            out.push(`District ${districts[0]} had won every one of ${scope}. District ${victor.district} just broke that.`);
        }
        const avgKills = mean(r => r.victorKills);
        if (avgKills !== undefined && Math.abs(victor.kills - avgKills) >= 2) {
            out.push(victor.kills > avgKills
                ? `A harder crown: ${victor.kills} kills against ${avgKills.toFixed(1)} for your recent victors.`
                : `A cleaner crown: ${victor.kills} kills against ${avgKills.toFixed(1)} for your recent victors.`);
        }
    }

    return out;
}
