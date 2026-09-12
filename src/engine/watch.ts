import { Tribute } from '../models/types';
import { witnessKindness } from './rapport';
import { WATCH_ROTATION } from '../data/balance';
import { SimContext } from './context';
import { allianceRecords, membersOf } from './alliance';
import { awareness } from './stealth';
import { traitMod } from '../data/traits';
import { cycleOf } from './memory';
import { clampTribute } from './vitals';

/**
 * A §6: the night's watch.
 *
 * `sleepDebt` already modelled what days without real rest do to a tribute,
 * and alliances already gave a flat "somebody is around" bonus — but nobody
 * was ever specifically awake. That left the Light Sleeper trait with nothing
 * to be good at in a group, and made sleeping in company a number rather than
 * an arrangement.
 *
 * One member of a co-located group takes the watch: the best-placed pair of
 * eyes, which is what the trait is for. They pay a shorter night; everybody
 * else sleeps properly and pays down debt for it. Posted once per night per
 * group, and named in the chronicle the first time so the arrangement is
 * visible rather than implied.
 */
export function postWatches(ctx: SimContext) {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const records = allianceRecords(state);

    Object.entries(records).forEach(([id, record]) => {
        const members = membersOf(state, id).filter(m => m.status === 'alive');
        if (members.length < WATCH_ROTATION.minMembers) return;

        // Only the ones actually sleeping in the same place. A group spread
        // across three zones is three people alone, whatever the roster says.
        const byZone = new Map<string, Tribute[]>();
        members.forEach(m => {
            const list = byZone.get(m.zone) ?? [];
            list.push(m);
            byZone.set(m.zone, list);
        });

        byZone.forEach((camp, zone) => {
            if (camp.length < WATCH_ROTATION.minMembers) return;

            // Whoever wakes at a snapped twig, else whoever sees best in the
            // dark. Rotated by cycle so the same tribute is not on watch every
            // night of the run, which is the other half of "rotation".
            const ranked = [...camp].sort((a, b) =>
                (nightEyes(b) - nightEyes(a)) || (a.id < b.id ? -1 : 1));
            const watcher = ranked[cycle % Math.min(ranked.length, WATCH_ROTATION.minMembers)] ?? ranked[0];
            const sleepers = camp.filter(m => m.id !== watcher.id);

            const sentry = nightEyes(watcher) >= WATCH_ROTATION.sentryAwareness;
            sleepers.forEach(m => {
                m.health = Math.min(100, m.health + WATCH_ROTATION.recoveryBonus
                    + (sentry ? WATCH_ROTATION.lightSleeperBonus : 0));
                m.sleepDebt = Math.max(0, (m.sleepDebt ?? 0) - WATCH_ROTATION.debtRepaid);
                clampTribute(m);
            });
            watcher.vitals.fatigue += WATCH_ROTATION.watcherFatigue;
            clampTribute(watcher);
            // A night's watch is a kindness the sleepers can see in the morning.
            sleepers.forEach(m => witnessKindness(ctx, watcher, m, 0.5));

            const already = record.watch?.watcherId === watcher.id && record.watch?.zone === zone;
            record.watch = { cycle, zone, watcherId: watcher.id, sleeperIds: sleepers.map(m => m.id) };
            if (!already) {
                ctx.logEvent(
                    sentry
                        ? `${watcher.name} takes the first watch in ${zone}. Nobody argues: ${watcher.name} wakes at things the rest of them sleep straight through.`
                        : `${watcher.name} takes the watch in ${zone} while the others sleep. It is not much of a system, but it is a system.`,
                    camp.map(m => m.id),
                    { category: 'alliance', zone }
                );
            }
        });
    });

    // A group that has scattered or been cut down stops keeping a watch.
    Object.values(records).forEach(record => {
        if (record.watch && record.watch.cycle < cycle) record.watch = undefined;
    });
}

/** How much use somebody is on watch: awareness in the dark, plus the trait. */
function nightEyes(t: Tribute): number {
    return awareness(t, true) + traitMod(t, 'awarenessNight');
}
