import { GameState, Tribute } from '../models/types';
import { PanemRecords } from './panemStorage';

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

export interface Notable {
    /** One sentence, already phrased for the end screen. */
    text: string;
    /** Rough interest, used only for ordering. */
    weight: number;
}

function victorOf(state: GameState): Tribute | undefined {
    return state.tributes.find(t => t.status === 'alive');
}

function ordinalSuffix(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function runNotables(state: GameState, records: PanemRecords): Notable[] {
    const notables: Notable[] = [];
    const victor = victorOf(state);
    const dead = state.tributes.filter(t => t.status === 'dead');
    const cast = state.tributes.length;

    // --- The victor, measured against the player's own history ---
    if (victor) {
        if (victor.kills === 0) {
            notables.push({
                weight: 9,
                text: `${victor.name} won the ${ordinalSuffix(state.gamesProfile?.gamesNumber ?? 0)} Games without killing anybody. `
                    + `That has happened ${ordinalSuffix(records.victors)} time in your Panem.`,
            });
        }
        if (victor.age <= 13) {
            notables.push({
                weight: 10,
                text: `${victor.name} was ${victor.age} years old. The Capitol will be talking about this one for a long time.`,
            });
        }
        if (victor.health <= 15) {
            notables.push({
                weight: 8,
                text: `${victor.name} came out of the arena on ${victor.health} health. Another exchange either way and there is no victor at all.`,
            });
        }
        if (victor.kills >= 6) {
            notables.push({
                weight: 8,
                text: `${victor.name} finished with ${victor.kills} kills — a body count the Capitol has to edit down for the recap.`,
            });
        }
        if (!victor.isCareer && victor.district >= 9) {
            notables.push({
                weight: 6,
                text: `District ${victor.district} has a victor. The odds board never had ${victor.name} anywhere near the top of it.`,
            });
        }
        if (victor.traits.includes('Star-Crossed')) {
            notables.push({
                weight: 9,
                text: `${victor.name} went into these Games in love and came out of them alone. The broadcast will not dwell on the arithmetic of that.`,
            });
        }
    } else {
        notables.push({
            weight: 12,
            text: `Nobody won the ${ordinalSuffix(state.gamesProfile?.gamesNumber ?? 0)} Games. `
                + `Twenty-four went in and the arena kept all of them — the ${ordinalSuffix(records.runs - records.victors)} time that has happened here.`,
        });
    }

    // --- The shape of the run ---
    const bloodbathDeaths = state.log.filter(l => l.day === 0 && l.category === 'kill').length;
    if (bloodbathDeaths >= Math.ceil(cast * 0.55)) {
        notables.push({
            weight: 7,
            text: `The bloodbath took ${bloodbathDeaths} of ${cast}. More than half the cast never saw a second day.`,
        });
    } else if (bloodbathDeaths <= 2 && cast >= 12) {
        notables.push({
            weight: 7,
            text: `Only ${bloodbathDeaths} died at the Cornucopia. A bloodbath that quiet usually means the Gamemakers have to work harder later, and they did.`,
        });
    }

    if (state.day >= 14) {
        notables.push({
            weight: 6,
            text: `These Games ran ${state.day} days. The Capitol schedules a fortnight and hates being made to keep to it.`,
        });
    } else if (state.day <= 4 && victor) {
        notables.push({
            weight: 6,
            text: `Over in ${state.day} days. Somebody in programming is being asked why the broadcast window was booked for two weeks.`,
        });
    }

    // --- The longest feud, from the rivalry ledger ---
    let worstFeud: { a: Tribute; b: Tribute; fights: number } | undefined;
    state.tributes.forEach(t => {
        const rivals = t.memory?.rivals ?? {};
        Object.entries(rivals).forEach(([id, record]) => {
            const other = state.tributes.find(o => o.id === id);
            if (!other) return;
            if (!worstFeud || record.fights > worstFeud.fights) {
                worstFeud = { a: t, b: other, fights: record.fights };
            }
        });
    });
    if (worstFeud && worstFeud.fights >= 3) {
        notables.push({
            weight: 7,
            text: `${worstFeud.a.name} and ${worstFeud.b.name} fought each other ${worstFeud.fights} separate times. The longest feud on record here.`,
        });
    }

    // --- How people actually died ---
    const statusDeaths = dead.filter(t => /thirst|dehydration|starvation|Bled out|infect/i.test(t.causeOfDeath ?? '')).length;
    if (statusDeaths >= Math.ceil(dead.length * 0.35) && dead.length >= 6) {
        notables.push({
            weight: 6,
            text: `${statusDeaths} of the ${dead.length} dead were killed by the arena rather than by each other. This was a Games about supplies.`,
        });
    }
    const nightlock = dead.filter(t => t.causeOfDeath?.includes('nightlock')).length;
    if (nightlock > 0) {
        notables.push({
            weight: 11,
            text: `${nightlock === 1 ? 'One tribute' : `${nightlock} tributes`} chose the nightlock rather than keep playing. The Capitol cut away both times and had to cut back.`,
        });
    }

    // --- Social oddities ---
    const betrayals = state.log.filter(l => l.category === 'betrayal').length;
    if (betrayals === 0 && cast >= 12) {
        notables.push({
            weight: 8,
            text: `Not one tribute betrayed an ally this year. In an arena built to make that happen, nobody did.`,
        });
    } else if (betrayals >= 5) {
        notables.push({
            weight: 6,
            text: `${betrayals} separate betrayals. Nobody in this arena could afford to sleep.`,
        });
    }

    const biggestPack = Math.max(0, ...Object.values(
        state.tributes.reduce<Record<string, number>>((acc, t) => {
            if (t.status !== 'alive' && !t.allianceId) return acc;
            if (!t.allianceId) return acc;
            acc[t.allianceId] = (acc[t.allianceId] ?? 0) + 1;
            return acc;
        }, {})
    ));
    if (biggestPack >= 5) {
        notables.push({
            weight: 5,
            text: `A pack of ${biggestPack} held together in there. Groups that size usually eat themselves long before the final eight.`,
        });
    }

    // --- What the Capitol had planned before the gong even sounded ---
    //
    // A Quarter Quell, a temperament and a cast shape are the three biggest
    // levers this simulation has for making one run read differently from
    // the last, and none of them had a single notable reacting to them —
    // the section was built to explain the *outcome* of a run and never
    // once credited the *conditions* that shaped it. Weighted high: a Quell
    // especially is the rarest and most structurally different thing a run
    // can be, and belongs at the top of the list when it happens.
    const profile = state.gamesProfile;
    if (profile?.quell) {
        notables.push({
            weight: 13,
            text: `This was ${profile.quell.name} — a Quarter Quell. ${profile.quell.announcement.replace(/^QUARTER QUELL:\s*/i, '')}`,
        });
    }
    if (profile && !['standard'].includes(profile.temperament.id)) {
        notables.push({
            weight: 4,
            text: `The Capitol billed this as ${profile.temperament.name}. ${profile.temperament.blurb}`,
        });
    }
    if (profile?.castShape && profile.castShape.id !== 'ordinary' && profile.castShape.id !== 'victors-field') {
        notables.push({
            weight: 4,
            text: `The reaping itself was unusual: ${profile.castShape.name}. ${profile.castShape.blurb}`,
        });
    }

    // --- The social shape of the run ---
    const allianceCount = state.log.filter(l => l.category === 'alliance').length;
    if (allianceCount === 0 && cast >= 12) {
        notables.push({
            weight: 8,
            text: `Not one alliance formed this year. Every tribute in that arena played it completely alone.`,
        });
    }
    const romances = state.log.filter(l => l.category === 'romance');
    if (romances.length > 0) {
        const lovers = state.tributes.filter(t => t.traits.includes('Star-Crossed'));
        const bothGone = lovers.length >= 2 && lovers.every(l => l.status === 'dead');
        if (bothGone) {
            notables.push({
                weight: 9,
                text: `The romance the Capitol built its broadcast around ended with neither of them coming home.`,
            });
        }
    }
    if (state.log.some(l => l.text.startsWith('VENGEANCE'))) {
        notables.push({
            weight: 7,
            text: `Somebody in that arena did not just survive — they went and found the specific person who took someone from them.`,
        });
    }

    // --- The mentor who mattered ---
    if (victor?.mentorLegacy) {
        const landed = state.log.some(l =>
            l.category === 'sponsor' && l.important && l.tributesInvolved.includes(victor.id) && l.text.includes(victor.mentorLegacy!));
        if (landed) {
            notables.push({
                weight: 7,
                text: `${victor.mentorLegacy} spent everything they had on ${victor.name}, and it is the reason there was a victor to talk about at all.`,
            });
        }
    }

    // --- A favourite the Capitol lost early ---
    const earlyFavourite = dead.find(t => t.fanFavourite && t.dayOfDeath === 0);
    if (earlyFavourite) {
        notables.push({
            weight: 8,
            text: `${earlyFavourite.name} was supposed to be this year's story. The bloodbath did not care.`,
        });
    }

    return notables.sort((a, b) => b.weight - a.weight).slice(0, 3);
}
