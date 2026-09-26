import { ArenaScar } from '../../models/seasonTypes';
import { AUDIT13_SIDE } from '../../data/balance';
import { campaignOf } from '../campaign';
import { SimContext, getAlive } from '../context';
import { addZoneThreat } from '../memory';
import { firstTime } from './runState';
import { arenaScarKey } from './replayability';

/** AUDIT-13 P8: the arena hook for incident scars (the rules are in `replayability.ts`). */

const SCAR_LINE: Record<ArenaScar['kind'], (zone: string, run: number) => string> = {
    wipeout: (z, r) => `${z} has not been cleaned since Games ${r}, when nobody walked out of this arena at all. The cameras linger on it. Nobody wants to camp there.`,
    override: (z, r) => `The ground in ${z} is still scorched where the Gamemakers reached in during Games ${r}. It is a landmark now, and a warning.`,
};

/**
 * On the first arena day, a scarred arena says so: every tribute treats the
 * scarred zone as a known danger. No RNG, and nothing at all for an arena the
 * campaign has no incident on.
 */
export function tickArenaScars(ctx: SimContext): void {
    const state = ctx.state;
    if (state.day < 1) return;
    const scars = campaignOf(state.campaign).ledger?.arenaScars?.[arenaScarKey(state.arena)];
    if (!scars || scars.length === 0 || !firstTime(state, 'a13-scars')) return;
    const zones = new Set(state.arena.zones.map(z => z.name));
    scars.filter(s => zones.has(s.zone)).forEach(s => {
        getAlive(state).forEach(t => addZoneThreat(state, t, s.zone, AUDIT13_SIDE.scarThreat));
        ctx.logEvent(SCAR_LINE[s.kind](s.zone, s.run), [], { important: true, category: 'arena', zone: s.zone });
    });
}
