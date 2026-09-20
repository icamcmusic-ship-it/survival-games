import { GameState, HazardSource, Tribute, ZoneEffectKind } from '../models/types';
import { SimContext, getAlive } from './context';
import { HAZARD_CHAIN } from '../data/balance';
import { cycleOf, addZoneThreat } from './memory';
import { isActive } from './downed';
import { startZoneEffect, effectsFor } from './zoneEffects';
import { work, canAfford } from './actionBudget';
import { ACTION_BUDGET } from '../data/balance';
import { profOf, trainProficiency } from './proficiency';

/**
 * AUDIT-9 stage C §5: the missing thirds of a persistent hazard.
 *
 * The audit's definition is exact: *"A persistent hazard has a source,
 * affected area, warning, growth/decay rule, mitigation and aftermath."* The
 * engine had affected area, growth and (for fire) aftermath. It had none of
 * source, warning or mitigation, and the three absences compounded.
 *
 * **No source.** `ZoneEffect` recorded a kind and an expiry. A fire started by
 * a Gamemaker, by a camp fire getting away from somebody, and by an ambient
 * roll were indistinguishable the moment they existed — so nobody could be
 * blamed for one, and no belief about who did it could form.
 *
 * **No warning with lead time.** `startZoneEffect` logs a line at the moment
 * the hazard begins, which is a description, not a warning. The arena
 * signatures do telegraph, elaborately, but those telegraphs feed prose and
 * the occasional attribute save — nobody can *act* on one, because there is
 * nothing to act on until the thing has already happened.
 *
 * **No mitigation.** A tribute could treat an infection and rain could put out
 * a fire. That was the whole list. Nobody could dig a firebreak, shore up a
 * ruin that was groaning, or move a camp off ground that was about to flood.
 *
 * A forecast fixes all three at once, because it is the object the other two
 * hang off: it names what is coming, where, when, and whose fault it is, and
 * it exists for a cycle or two *before* the hazard, which is exactly the
 * window in which acting on it is possible. A hazard that arrives with no
 * warning cannot be prevented, and one that cannot be prevented is weather
 * rather than a decision.
 */

/** Put a hazard on the calendar, with lead time and an author. */
export function forecastHazard(
    ctx: SimContext,
    zone: string,
    kind: ZoneEffectKind,
    source: HazardSource,
    opts: { leadCycles?: number; severity?: number; byId?: string } = {},
) {
    const state = ctx.state;
    state.forecasts = state.forecasts ?? [];
    // One forecast per zone and kind: a hazard announced twice is one hazard.
    if (state.forecasts.some(f => f.zone === zone && f.kind === kind)) return;
    const lead = opts.leadCycles ?? HAZARD_CHAIN.defaultLeadCycles;
    state.forecasts.push({
        zone,
        kind,
        source,
        byId: opts.byId,
        dueCycle: cycleOf(state) + lead,
        severity: opts.severity ?? 1,
        mitigation: 0,
    });
    ctx.logEvent(warningFor(kind, zone, source), [], {
        type: 'hazard-forecast',
        zone,
        important: true,
        category: 'hazard',
    });
    // Everyone standing there learns the ground is about to be a problem. The
    // warning is a *belief*, which is what lets a tribute act on it and lets
    // somebody who was elsewhere not know.
    getAlive(state).filter(t => t.zone === zone).forEach(t => {
        addZoneThreat(state, t, zone, HAZARD_CHAIN.forecastThreat);
    });
}

function warningFor(kind: ZoneEffectKind, zone: string, source: HazardSource): string {
    const blame = source === 'gamemaker'
        ? 'Nobody in the Capitol is pretending this one is weather. '
        : source === 'tribute'
            ? 'Somebody did this, and it is going to be obvious who. '
            : '';
    switch (kind) {
        case 'burning':
            return `${blame}There is smoke on the wind over ${zone}, and it is getting closer rather than thinner.`;
        case 'flooded':
            return `${blame}The water in ${zone} is higher against the banks than it was this morning, and still rising.`;
        case 'frozen':
            return `${blame}The temperature over ${zone} is going the wrong way fast. Whatever is wet there will not be liquid by morning.`;
        case 'contaminated':
            return `${blame}Something upstream of ${zone} has gone bad. It has not arrived yet. It is going to.`;
        case 'quaking':
            return `${blame}The ground under ${zone} has started to make a sound, on and off, that ground should not make.`;
        default:
            return `${blame}${zone} is about to stop being somewhere anybody should be standing.`;
    }
}

/**
 * Work against a forecast hazard: a firebreak, a shored-up wall, a bank of
 * sandbags. Returns true when the job is finished.
 *
 * Mitigation is *work*, in the stage C §3 sense — it takes hours out of a day
 * that has other things in it, and an interrupted job leaves a half-dug
 * firebreak. That is the trade the audit wanted: the tribute who saw the
 * warning and spent the day on it did not spend the day doing anything else.
 */
export function mitigate(ctx: SimContext, t: Tribute): boolean {
    const state = ctx.state;
    const forecast = (state.forecasts ?? []).find(f => f.zone === t.zone && f.mitigation < 1);
    if (!forecast) return false;
    if (!canAfford(t, HAZARD_CHAIN.minHoursToStart)) return false;

    const kindWork = `mitigate:${forecast.kind}`;
    // Somebody who knows what they are doing gets more out of the same hours.
    const hours = ACTION_BUDGET.shelterHours
        * Math.max(HAZARD_CHAIN.minSkillMultiplier, 1 - profOf(t, 'carpentry') * HAZARD_CHAIN.carpentryHourRelief);
    const done = work(t, kindWork, hours);
    trainProficiency(t, 'carpentry', undefined, HAZARD_CHAIN.carpentryTrainShare);
    if (!done) {
        ctx.logEvent(
            `${t.name} works against what is coming to ${t.zone} until the light goes. It is not finished, and they know it.`,
            [t.id],
            { type: 'hazard-mitigated', zone: t.zone, category: 'survival' },
        );
        forecast.mitigation = Math.min(HAZARD_CHAIN.partialCredit, forecast.mitigation + HAZARD_CHAIN.partialCredit);
        return false;
    }
    forecast.mitigation = 1;
    forecast.mitigatedById = t.id;
    ctx.logEvent(
        mitigationLine(forecast.kind, t.name, t.zone),
        [t.id],
        { type: 'hazard-mitigated', zone: t.zone, important: true, category: 'survival' },
    );
    return true;
}

function mitigationLine(kind: ZoneEffectKind, who: string, zone: string): string {
    switch (kind) {
        case 'burning':
            return `${who} cuts a break through the undergrowth on the windward side of ${zone} and clears it down to dirt. When the fire arrives it will have somewhere to stop.`;
        case 'flooded':
            return `${who} spends the day building the bank up at ${zone}'s low side. It is mud and deadfall and it will not hold forever. It will hold tonight.`;
        case 'quaking':
            return `${who} shores the worst of ${zone} with whatever will take a load. The building is still going to complain. It is not going to come down.`;
        default:
            return `${who} spends the day making ${zone} survivable for whatever is coming to it.`;
    }
}

/**
 * One cycle of forecasts coming due.
 *
 * A mitigated forecast does not fire. A partly mitigated one fires weaker,
 * which is what makes a half-finished firebreak worth digging: the audit's
 * "interruptions leave partial work" and "mitigation" are the same idea
 * meeting in one place.
 */
export function tickForecasts(ctx: SimContext) {
    const state = ctx.state;
    if (!state.forecasts?.length) return;
    const cycle = cycleOf(state);
    const remaining: NonNullable<GameState['forecasts']> = [];

    state.forecasts.forEach(f => {
        if (cycle < f.dueCycle) { remaining.push(f); return; }

        if (f.mitigation >= 1) {
            const saved = getAlive(state).filter(t => isActive(t) && t.zone === f.zone).length;
            ctx.logEvent(
                `Whatever was coming to ${f.zone} arrives and finds the ground ready for it. `
                + (saved > 0
                    ? `${saved === 1 ? 'The tribute' : `All ${saved} of the tributes`} standing there ${saved === 1 ? 'is' : 'are'} still standing there afterwards.`
                    : 'There was nobody left there to see it, which does not make the work wasted.'),
                [],
                { type: 'hazard-averted', zone: f.zone, important: true, category: 'hazard' },
            );
            state.hazardsAverted = (state.hazardsAverted ?? 0) + 1;
            return;
        }

        // It lands, at whatever strength the work left it.
        const severity = f.severity * (1 - f.mitigation * HAZARD_CHAIN.partialSeverityRelief);
        startZoneEffect(ctx, f.zone, f.kind, true, severity);
        // AUDIT-9 stage C §5: the effect remembers who authored it.
        const effect = effectsFor(state, f.zone).find(e => e.kind === f.kind);
        if (effect) {
            effect.source = f.source;
            effect.byId = f.byId;
        }
    });

    state.forecasts = remaining;
}
