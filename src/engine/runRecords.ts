import { Tribute } from '../models/types';
import { SimContext } from './context';
import { RUN_RECORDS } from '../data/balance';
import { effectsIn } from './zoneEffects';

/**
 * §12: per-run bookkeeping the achievements read.
 *
 * The achievement table is evaluated once, at the end of a run, against the
 * final state — which is the right design, but it means an achievement can
 * only ask about something the state still remembers. Several of the new ones
 * are about a *shape* rather than a total ("dropped below five health three
 * times and came back each time", "never shared a zone with anybody after the
 * bloodbath"), and nothing was recording any of that.
 *
 * Most of it is derivable by watching each tribute cycle to cycle, so it lives
 * here as one tick rather than as a dozen counters threaded through a dozen
 * subsystems. The handful that genuinely need a call site — who opened a
 * fight, who caused an effect, who took over a dead leader's alliance — are
 * the small exported helpers below.
 */

/** Per-tribute scratch from last cycle, so a change can be noticed. */
interface Watch { health: number; zone: string; frontZone?: string }
const WATCH = new WeakMap<Tribute, Watch>();

export function tickRunRecords(ctx: SimContext) {
    const state = ctx.state;
    const front = state.weatherFront;

    state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        const last = WATCH.get(t);

        // Reaped trait count, captured the first time we see them, so a trait
        // shed by an arc later is visible as a change rather than invisible.
        if (t.startingTraitCount === undefined) t.startingTraitCount = t.traits.length;

        // Came off the floor: below the near-death line last cycle, above it
        // now. Three of these is 'Hairsbreadth'.
        if (last && last.health < RUN_RECORDS.nearDeathHealth && t.health >= RUN_RECORDS.nearDeathHealth) {
            t.lowHealthRecoveries = (t.lowHealthRecoveries ?? 0) + 1;
        }

        // Walked into weather rather than out of it: the zone changed, and the
        // zone they chose was already under an effect.
        if (last && last.zone !== t.zone && effectsIn(state, t.zone).length > 0) {
            t.walkedIntoEffect = (t.walkedIntoEffect ?? 0) + 1;
        }

        // Stood in a front last cycle and is still standing this one.
        if (last?.frontZone !== undefined && last.frontZone === last.zone) {
            t.stormsSurvived = (t.stormsSurvived ?? 0) + 1;
        }

        // The lowest their will to keep going has ever been.
        if (t.resolve !== undefined) {
            t.minResolve = t.minResolve === undefined ? t.resolve : Math.min(t.minResolve, t.resolve);
        }

        // Anybody at all, after the gong stopped.
        if (state.phase !== 'bloodbath'
            && state.tributes.some(o => o.status === 'alive' && o.id !== t.id && o.zone === t.zone)) {
            t.metAnybodyAfterBloodbath = true;
        }

        WATCH.set(t, { health: t.health, zone: t.zone, frontZone: front?.zone });
    });
}

/** §12: `opener` started this fight, against somebody who had not started one. */
export function noteFightOpened(opener: Tribute) {
    opener.fightsOpened = (opener.fightsOpened ?? 0) + 1;
}

/** §12: a zone effect that exists because of something this tribute did. */
export function noteEffectCaused(t: Tribute) {
    t.zoneEffectsCaused = (t.zoneEffectsCaused ?? 0) + 1;
}

/** §12: they picked up an alliance whose original leader is dead. */
export function noteTookOverLead(t: Tribute) {
    t.tookOverAllianceLead = true;
}
