import { GameState, Tribute } from '../models/types';
import { SimContext } from './context';
import { NOISE } from '../data/balance';
import { getZone, zoneFeatures } from './map';
import { noteHeard } from './memory';
import { encumbranceOf } from './items';
import { injuryGrade } from './wounds';
import { profOf } from './proficiency';

/**
 * §16: a crossing makes a sound, and the sound reaches people.
 *
 * `ZoneFeatures.acoustics` has documented itself since it was written as "how
 * far sound carries *out of*, and inside, this zone". Only the inside half was
 * ever built — a single read in `stealth.ts` for how hard a zone is to hide in
 * while standing still. Moving through the arena was silent, so the only way to
 * learn where anybody was, was to be standing next to them.
 *
 * Nothing here invents a new trace record. `zoneTraffic` already logs every
 * crossing, already weights it by how many people moved together, already
 * decays, and is already poisonable by `layFalseTrail` — it just had no reader
 * that was a person. This is that reader, expressed as a per-crossing loudness
 * rather than as a lookup of the trace, because what the listener hears is the
 * crossing happening and not the footprints left behind.
 */

/** How loud this crossing is, before the arena gets hold of it. */
export function crossingNoise(t: Tribute, partySize: number): number {
    const hurt = injuryGrade(t, 'legs') + injuryGrade(t, 'arms') + injuryGrade(t, 'torso');
    let noise = NOISE.baseCrossing
        + Math.max(0, partySize - 1) * NOISE.perExtraMover
        + hurt * NOISE.perInjuryGrade
        + encumbranceOf(t) * NOISE.perEncumbrance;
    noise *= NOISE.stanceScale[t.stance] ?? 1;
    // Fieldcraft is the one thing a tribute can do about any of the above.
    noise -= profOf(t, 'stealth') * NOISE.stealthQuieting;
    return Math.max(NOISE.minCrossing, noise);
}

/**
 * What a listener needs before a sound registers. Vigilance is the proficiency
 * whose whole description is noticing things, so it is what moves this; sleep
 * is what moves it the other way.
 */
function hearingThreshold(listener: Tribute, time: 'day' | 'night'): number {
    return NOISE.hearThreshold
        - profOf(listener, 'vigilance') * NOISE.vigilanceBonus
        + (time === 'night' ? NOISE.nightThresholdBonus : 0);
}

/**
 * Push one crossing out into the arena and let whoever is close enough hear it.
 *
 * Only two ranges exist, and deliberately so: the zone arrived in, and the ones
 * touching it. A falloff curve over the whole adjacency graph would be a more
 * elaborate model of a thing the map does not otherwise measure in metres, and
 * it would put every quiet tribute in earshot of every loud one on a small
 * arena. One hop is what "somebody is moving out there" means.
 */
export function announceCrossing(
    ctx: SimContext,
    movers: Tribute[],
    to: string,
    time: 'day' | 'night',
) {
    if (movers.length === 0) return;
    const state = ctx.state;
    const dest = getZone(state.arena, to);
    if (!dest) return;
    // The loudest member sets the sound: a pack is as quiet as its clumsiest.
    const loudest = movers.reduce((worst, m) =>
        crossingNoise(m, movers.length) > crossingNoise(worst, movers.length) ? m : worst);
    const raw = crossingNoise(loudest, movers.length);
    const acoustics = zoneFeatures(dest).acoustics ?? 1;
    const moverIds = new Set(movers.map(m => m.id));

    state.tributes.forEach(listener => {
        if (listener.status !== 'alive' || moverIds.has(listener.id)) return;
        // Somebody standing in the zone they walked into has eyes, and the
        // ordinary co-presence path already tells them everything this one
        // could. Hearing is only ever the channel for the people who cannot
        // see it happen, so the in-zone case is not this function's business.
        if (listener.zone === to) return;
        if (!dest.adjacent.includes(listener.zone)) return;
        // Acoustics carry sound *out of* the zone it was made in — the half of
        // the documented behaviour that was never built.
        const heard = raw * NOISE.adjacentCarry * acoustics;
        if (heard < hearingThreshold(listener, time)) return;
        const written = noteHeard(state, listener, to, movers.length,
            NOISE.heardConfidence * Math.min(1, heard));
        if (!written) return;
        if (!ctx.rng.chance(NOISE.lineChance)) return;
        ctx.logEvent(
            movers.length > 1
                ? `${listener.name} hears more than one set of feet moving through ${to}, and does not go and look.`
                : `Something crosses ${to} loudly enough for ${listener.name} to hear it from ${listener.zone}.`,
            [listener.id],
            { category: 'travel', zone: listener.zone }
        );
    });
}

/** Whether this run's arena carries sound at all — read by the guard. */
export function arenaMeanAcoustics(state: GameState): number {
    const zones = state.arena.zones;
    if (zones.length === 0) return 1;
    return zones.reduce((sum, z) => sum + (zoneFeatures(z).acoustics ?? 1), 0) / zones.length;
}
