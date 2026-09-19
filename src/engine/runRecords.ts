import { Tribute } from '../models/types';
import { SimContext } from './context';
import { EARNED_TRAIT_RULES, RUN_RECORDS } from '../data/balance';
import { effectsIn } from './zoneEffects';
import { earnTrait } from './earnedTraits';

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

/*
 * AUDIT-9 B04: per-tribute scratch from last cycle, so a change can be noticed.
 *
 * Found by the sweep the audit asked for after the abandoned-camp `WeakMap`:
 * "review other persistent caches, module state and singleton references for
 * the same resume risk". This is the same defect. A module-level `WeakMap` is
 * process memory, so a resumed run started with an empty one — the first cycle
 * after a reload could not see a health change and so could not count a
 * recovery off the near-death line, and the weather-front tracking reset with
 * it. `lowHealthRecoveries` feeds 'Hairsbreadth' and 'Unbroken', so a reload
 * quietly changed which achievements a run could produce.
 *
 * On the tribute, where it serialises.
 */

export function tickRunRecords(ctx: SimContext) {
    const state = ctx.state;
    const front = state.weatherFront;

    state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        const last = t.recordWatch;

        // Reaped trait count, captured the first time we see them, so a trait
        // shed by an arc later is visible as a change rather than invisible.
        if (t.startingTraitCount === undefined) t.startingTraitCount = t.traits.length;

        // Came off the floor: below the near-death line last cycle, above it
        // now. Three of these is 'Hairsbreadth'.
        if (last && last.health < RUN_RECORDS.nearDeathHealth && t.health >= RUN_RECORDS.nearDeathHealth) {
            t.lowHealthRecoveries = (t.lowHealthRecoveries ?? 0) + 1;
        }

        /*
         * AUDIT-8 §12.3: 'Unbroken' — a week and more in the arena without
         * ever having been on the wrong side of the near-death line. Read off
         * the same threshold 'Hairsbreadth' uses, from the other direction:
         * one counts the times they came back, this one is the absence of any.
         * `everDowned` is in the test because being downed is the same claim
         * by a different route.
         */
        if (t.daysSurvived >= EARNED_TRAIT_RULES.unbrokenDays
            && t.health >= RUN_RECORDS.nearDeathHealth
            && (t.lowHealthRecoveries ?? 0) === 0
            && t.everDowned !== true) {
            earnTrait(ctx, t, 'Unbroken');
        }

        /*
         * AUDIT-8 §12.3: 'Outlived The Pack' — the last one standing out of a
         * group of four or more. `formerAllies` is the set of people this
         * tribute was in a dissolved alliance with, and it is already written
         * on every ordinary ending; the trait is what it means when all of
         * them are in the sky and the tribute is not.
         */
        const pack = t.formerAllies ?? [];
        if (pack.length >= EARNED_TRAIT_RULES.outlivedPackSize - 1
            && pack.every(id => state.tributes.find(o => o.id === id)?.status === 'dead')) {
            earnTrait(ctx, t, 'Outlived The Pack');
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

        t.recordWatch = { health: t.health, zone: t.zone, frontZone: front?.zone };
    });

    /*
     * Audit 3 §1.6: the high-water marks for everything that only exists while
     * the run is running.
     *
     * Seventeen achievements never unlocked across 200 runs, and the largest
     * single cause was this module's own opening paragraph read the wrong way
     * round. The table is evaluated once, at the end, against the final state —
     * which is the right design — and five entries were asking it about things
     * that are *gone* by then. `state.rumours` has a six-cycle lifetime and is
     * pruned, so "a planted rumour still believed at the end" was asking for a
     * claim that had survived being retired. `state.alliances` at the end of a
     * run belongs to the one tribute left standing, so "an alliance with three
     * clauses in its charter" was asking the wreckage.
     *
     * None of these needed a new mechanic. They needed somebody to write down
     * that it happened, the way `sharedGriefAllies` already does.
     */
    const rumours = state.rumours ?? [];
    const planted = rumours.filter(r => r.plantedById !== undefined);
    state.maxPlantedInCirculation = Math.max(state.maxPlantedInCirculation ?? 0, planted.length);
    if (planted.some(r => r.exposed)) state.plantedRumourExposed = true;
    // A lie that is still standing, still false, and still believed by
    // somebody who has not been to look. Recorded per planter, because the
    // achievement is about the person who told it.
    planted.forEach(r => {
        if (r.isTrue || r.exposed) return;
        const believed = state.tributes.some(o =>
            o.status === 'alive' && o.id !== r.plantedById && (o.memory?.heardRumours ?? []).includes(r.id));
        if (!believed) return;
        state.liarsAtLarge = [...new Set([...(state.liarsAtLarge ?? []), r.plantedById!])];
    });

    Object.values(state.alliances ?? {}).forEach(a => {
        state.deepestCharter = Math.max(state.deepestCharter ?? 0, a.charter?.length ?? 0);
    });

    // Every bloc down to a quarter of what it opened with. The opening purses
    // have to be captured on the first tick that sees them — computing an
    // "opening" from the live maximum, which is what this used to do, asks for
    // the largest remaining purse to be a quarter of itself.
    const purses = state.sponsorBlocBudgets;
    if (purses && Object.keys(purses).length > 0) {
        if (!state.openingBlocBudgets) state.openingBlocBudgets = { ...purses };
        const opening = state.openingBlocBudgets;
        const allSpent = Object.entries(purses)
            .every(([bloc, left]) => left <= (opening[bloc] ?? left) * RUN_RECORDS.blocExhaustedShare);
        if (allSpent) state.everySponsorBlocExhausted = true;
    }
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
