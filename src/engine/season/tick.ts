import { Tribute } from '../../models/types';
import { AUDIT12_WAVE3, BLEEDING, ESCALATION } from '../../data/balance';
import { hasMutator } from '../../data/mutators';
import { SimContext, getAlive } from '../context';
import { CAUSE_FAMILY, deathCodeOf } from '../causes';
import { applyDamage, checkDeath } from '../combat';
import { openWound } from '../wounds';
import { clampTribute } from '../vitals';
import { getRel } from '../relationships';
import { addExcitement, decayExcitement } from '../audience';
import { decayCruelty } from './cruelty';
import { runDirectorPlays } from './directorPlays';
import { notePatronRegret } from './sponsorWars';
import { holdTruces } from './eventMechanics';
import { tickStoryChain } from './storyChains';
import { tickMentorNotes } from './carry';
import { enforceBarredAlliance } from './barredAlliance';
import { seasonOf, sideRng } from './runState';

/**
 * AUDIT-12 wave 3: the side features' per-cycle pass, called once from
 * `worldClockUpkeep` (every phase that advances the cycle), and the
 * phase-start pass called once from `Simulator.processTurn`.
 *
 * Each step is its own module; this file only orders them. Everything here
 * draws from side streams (`runState.ts`), so the main simulation's draws are
 * where they always were.
 */
const MU = AUDIT12_WAVE3.mutators;

export function tickSeason(ctx: SimContext): void {
    enforceBarredAlliance(ctx);
    readNewDeaths(ctx);
    tickMutators(ctx);
    holdTruces(ctx);
    tickMentorNotes(ctx);
    tickStoryChain(ctx);
    runDirectorPlays(ctx);
    decayCruelty(ctx.state);
    decayExcitement(ctx.state.tributes, AUDIT12_WAVE3.audience.excitementKeep);
}

/** Once at the top of every simulated turn, before the phase runs. */
export function beforeTurnSeason(ctx: SimContext): void {
    const state = ctx.state;
    if (state.phase === 'bloodbath' && hasMutator(state.config, 'wounded-start')) {
        const s = seasonOf(state);
        const applied = s.mutatorsApplied ?? (s.mutatorsApplied = []);
        if (applied.includes('wounded-start')) return;
        applied.push('wounded-start');
        const rng = sideRng(state, 'wounded-start');
        getAlive(state).forEach(t => {
            t.health = Math.max(1, t.health - MU.woundedStartDamage);
            if (rng.chance(MU.woundedStartBleedChance)) openWound(t, BLEEDING.hazardSeverity);
            clampTribute(t);
        });
        ctx.logEvent('Every tribute rises on the plate already hurt: the Capitol saw to it in the tubes. The countdown does not care.', [], { important: true, category: 'gamemaker' });
    }
}

/** Patron's regret and the mutts-only crowd, from each death exactly once. */
function readNewDeaths(ctx: SimContext): void {
    const state = ctx.state;
    const s = seasonOf(state);
    const read = new Set(s.readDead ?? []);
    const fresh = state.tributes.filter(t => t.status === 'dead' && !read.has(t.id));
    if (fresh.length === 0) return;
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));
    const muttsOnly = hasMutator(state.config, 'mutts-only-kills');
    fresh.forEach(dead => {
        read.add(dead.id);
        const code = deathCodeOf(dead);
        const killer = dead.lastDamage?.sourceId ? byId.get(dead.lastDamage.sourceId) : undefined;
        if (killer && killer.id !== dead.id) {
            if (muttsOnly) {
                killer.excitementRating = Math.max(0, killer.excitementRating - MU.muttsOnlyKillPenalty);
                killer.sponsorTrust = Math.max(0, killer.sponsorTrust - MU.muttsOnlyKillPenalty / 2);
            }
        }
        if (muttsOnly && CAUSE_FAMILY[code] === 'mutt') {
            // The crowd credits the mutt's kill to whoever was hunting the victim.
            const rival = nearestRival(state.tributes, dead);
            if (rival) {
                const credit = s.muttCredit ?? (s.muttCredit = {});
                credit[rival.id] = (credit[rival.id] ?? 0) + 1;
                addExcitement(rival, MU.muttsOnlyCredit);
            }
        }
        const regret = notePatronRegret(state, dead);
        if (regret) ctx.logEvent(regret, [dead.id], { category: 'sponsor' });
    });
    s.readDead = [...read];
}

function nearestRival(all: Tribute[], dead: Tribute): Tribute | undefined {
    return all
        .filter(t => t.status === 'alive' && t.id !== dead.id)
        .sort((a, b) => Number(b.zone === dead.zone) - Number(a.zone === dead.zone)
            || getRel(dead, a.id) - getRel(dead, b.id)
            || a.id.localeCompare(b.id))[0];
}

function tickMutators(ctx: SimContext): void {
    const state = ctx.state;
    const cards = state.config.mutators;
    if (!cards || cards.length === 0 || state.day < 1) return;
    const alive = getAlive(state);
    if (hasMutator(state.config, 'water-ration')) {
        alive.forEach(t => { t.vitals.thirst += MU.waterRationThirst; clampTribute(t); });
    }
    if (hasMutator(state.config, 'border-doubles')) {
        if (state.escalationDay === undefined && state.day >= ESCALATION.startDay - MU.borderEarlyDays) {
            state.escalationDay = state.day;
            ctx.logEvent('The border starts moving early this year, and it is not moving alone: every closing will be followed by a second pulse.', [], { important: true, category: 'gamemaker' });
        }
        const s = seasonOf(state);
        const collapsed = state.collapsedZones ?? [];
        const before = s.lastCollapsedCount ?? 0;
        s.lastCollapsedCount = collapsed.length;
        if (collapsed.length > before) {
            const newest = collapsed.slice(before);
            const beside = new Set(state.arena.zones.filter(z => newest.includes(z.name)).flatMap(z => z.adjacent).filter(n => !collapsed.includes(n)));
            const rng = sideRng(state, 'border-pulse');
            const caught = alive.filter(t => beside.has(t.zone));
            if (caught.length > 0) {
                ctx.logEvent(`The second pulse runs out from the closed border through ${[...beside].join(', ')}.`, caught.map(t => t.id), { important: true, category: 'hazard' });
            }
            caught.forEach(t => {
                if (rng.chance(MU.borderPulseDodge + t.attributes.agility * 0.02)) return;
                const cause = `Caught by the second pulse as the border closed`;
                applyDamage(ctx, t, MU.borderPulseDamage, { cause, code: 'border', kind: 'arena' });
                clampTribute(t);
                checkDeath(ctx, t, cause);
            });
        }
    }
}
