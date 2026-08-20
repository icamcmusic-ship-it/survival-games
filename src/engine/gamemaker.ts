import { SimContext, getAlive } from './context';
import { ExposureProfile, applyExposure } from './exposure';
import { getZone } from './map';
import { GAMEMAKER } from '../data/balance';
import { eligibleMutts, engageMutt, rosterFor } from './mutts';

/**
 * Gamemaker weather, expressed as exposure profiles.
 *
 * These used to be a second, independent damage-over-time implementation with
 * its own frostbite roll, its own damage numbers and its own cause-of-death
 * strings — so a manual cold snap on the Frozen Wasteland stacked two different
 * freezing systems on the same tribute. They are the same kind of thing the
 * arena's own climate is, so they are now the same kind of object, run through
 * `applyExposure`. `intensity` is what makes a Gamemaker storm worse than
 * weather: the same profile shape, turned up.
 */
const WEATHER_EFFECTS: ExposureProfile[] = [
    {
        name: 'a torrential downpour',
        cause: 'Drowned in the Gamemakers\' downpour',
        fatigue: 15,
        sanity: 5,
        quench: 30,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a scorching heatwave',
        cause: 'Died of heatstroke in the Gamemakers\' heatwave',
        fatigue: 20,
        sanity: 10,
        thirst: 20,
        burn: 0.1,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a freezing cold snap',
        cause: 'Froze to death in the Gamemakers\' cold snap',
        fatigue: 25,
        sanity: 10,
        frostbite: 0.15,
        intensity: GAMEMAKER.weatherIntensity,
        onFrostbite: t => `${t.name} is caught in the open and suffers frostbite.`,
    },
    {
        name: 'a choking toxic fog',
        cause: 'Suffocated in the Gamemakers\' toxic fog',
        fatigue: 10,
        sanity: 20,
        poison: 0.15,
        intensity: GAMEMAKER.weatherIntensity,
        onPoison: t => `${t.name} inhales the toxic fog and is poisoned.`,
    },
    {
        name: 'a wall of blowing grit',
        cause: 'Flayed by the Gamemakers\' grit storm',
        damage: 6,
        fatigue: 18,
        sanity: 8,
        thirst: 15,
        infection: 0.12,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a sheet of freezing rain',
        cause: 'Died of exposure in the Gamemakers\' freezing rain',
        damage: 4,
        fatigue: 22,
        sanity: 12,
        quench: 20,
        frostbite: 0.1,
        intensity: GAMEMAKER.weatherIntensity,
        onFrostbite: t => `${t.name} cannot get warm again after the freezing rain finds them.`,
    },
    {
        name: 'a dead, airless heat',
        cause: 'Died of heatstroke in the Gamemakers\' dead air',
        damage: 5,
        fatigue: 25,
        sanity: 15,
        thirst: 30,
        intensity: GAMEMAKER.weatherIntensity,
    },
    {
        name: 'a rain of stinging ash',
        cause: 'Choked on the Gamemakers\' ashfall',
        damage: 7,
        fatigue: 12,
        sanity: 10,
        burn: 0.08,
        infection: 0.08,
        intensity: GAMEMAKER.weatherIntensity,
        onBurn: t => `${t.name} is pocked with burns where the ash settled on bare skin.`,
    },
];

export function triggerGamemakerEvent(ctx: SimContext, type: 'mutt' | 'weather' | 'feast', targetId?: string) {
    if (!ctx.state.gamemakerMode) return;

    if (type === 'mutt') {
        // Route through the full per-arena mutt roster (engine/mutts.ts) rather
        // than the vestigial Arena.mutts display strings — a Gamemaker-released
        // mutt gets the same pack size, speed-based evasion, terrain gating and
        // persistent tracking as one the day/night cycle rolls up naturally.
        // Dusk counts as night for the mutts that only come out in it.
        const time = ctx.state.timeOfDay === 'day' ? 'day' : 'night';
        const muttFor = (t: { zone: string }) => {
            const eligible = eligibleMutts(ctx, t as never, time);
            const pool = eligible.length > 0 ? eligible : rosterFor(ctx);
            return pool.length > 0 ? ctx.rng.pick(pool) : undefined;
        };

        if (targetId) {
            const t = ctx.state.tributes.find(tr => tr.id === targetId);
            if (t && t.status === 'alive') {
                const mutt = muttFor(t);
                if (mutt) {
                    ctx.logEvent(`GAMEMAKER: A pack of ${mutt.name} is dropped directly onto ${t.name} in ${t.zone}.`, [t.id], { important: true, category: 'gamemaker' });
                    engageMutt(ctx, t, mutt);
                }
            }
        } else {
            const announceMutt = rosterFor(ctx).length > 0 ? ctx.rng.pick(rosterFor(ctx)).name : 'mutts';
            ctx.logEvent(`GAMEMAKER: ${announceMutt} are released into the arena!`, [], { important: true, category: 'gamemaker' });
            getAlive(ctx.state).forEach(t => {
                // Tributes in dangerous zones are easier prey for released mutts
                const zone = getZone(ctx.state.arena, t.zone);
                const hitChance = GAMEMAKER.muttSweepBaseChance + (zone ? zone.danger * GAMEMAKER.muttSweepDangerWeight : 0.1);
                if (!ctx.rng.chance(hitChance)) return;
                const mutt = muttFor(t);
                if (mutt) engageMutt(ctx, t, mutt);
            });
        }
    } else if (type === 'weather') {
        const weather = ctx.rng.pick(WEATHER_EFFECTS);
        ctx.logEvent(
            `GAMEMAKER: The weather shifts drastically. ${weather.name.charAt(0).toUpperCase() + weather.name.slice(1)} sweeps the arena!`,
            [],
            { important: true, category: 'gamemaker' }
        );
        getAlive(ctx.state).forEach(t => {
            // One exposure system, shared with the arena's own climate.
            applyExposure(ctx, t, weather);
        });
    } else if (type === 'feast') {
        if (!ctx.state.config.enableFeast) {
            ctx.logEvent('GAMEMAKER: A feast is requested, but feasts are disabled for these Games.', [], { category: 'gamemaker' });
            return;
        }
        // A feast during the bloodbath would silently swallow the bloodbath phase.
        if (ctx.state.phase !== 'day' && ctx.state.phase !== 'night') {
            ctx.logEvent('GAMEMAKER: The feast horn can only sound once the Games proper are under way.', [], { category: 'gamemaker' });
            return;
        }
        // One feast per day, however many times the horn is pressed. Resolving a
        // feast returns the run to the same day it started on, so an unguarded
        // trigger lets a caller keyed on (day, phase) call feasts forever — and
        // a tribute who declines every one of them never dies, so the Games
        // never end.
        if (ctx.state.feastDay === ctx.state.day || ctx.state.lastFeastDay === ctx.state.day) {
            ctx.logEvent('GAMEMAKER: The tributes have already been called to the Cornucopia today. The table stays empty.', [], { category: 'gamemaker' });
            return;
        }
        ctx.logEvent(`GAMEMAKER: A feast is announced at the Cornucopia!`, [], { important: true, category: 'gamemaker' });
        ctx.state.feastDay = ctx.state.day;
        ctx.state.phase = 'feast';
    }
}
