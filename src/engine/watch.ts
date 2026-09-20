import { Tribute } from '../models/types';
import { witnessKindness } from './rapport';
import { EARNED_TRAIT_RULES, WATCH_ROTATION } from '../data/balance';
import { SimContext } from './context';
import { allianceRecords, membersOf } from './alliance';
import { awareness } from './stealth';
import { traitMod } from '../data/traits';
import { cycleOf } from './memory';
import { clampTribute } from './vitals';
import { earnTrait } from './earnedTraits';

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
            // Modulo the camp, not the *minimum camp size*. Taking it against
            // `minMembers` meant that in a camp of five only the two
            // best-sighted ever stood a watch, and on odd cycles it went to the
            // worse of those two — so a rotation that exists to spread the cost
            // spread it over two people and halved what sharp night eyes were
            // worth.
            const watcher = ranked[cycle % ranked.length] ?? ranked[0];
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

            // Against `lastWatch`, which survives the sweep at the bottom of
            // this function. `watch` does not: it is cleared every cycle, so
            // this comparison was against `undefined` every night and the line
            // it guards was read out every night of the run.
            const already = record.lastWatch?.watcherId === watcher.id && record.lastWatch?.zone === zone;
            record.watch = { cycle, zone, watcherId: watcher.id, sleeperIds: sleepers.map(m => m.id) };
            /*
             * AUDIT-8 §12.3: consecutive nights on the watch. `already` above
             * is the same-post test; this is the count, which nothing kept.
             * Reset when somebody else takes it, so it is a streak rather than
             * a tally.
             */
            watcher.watchStreak = record.lastWatch?.watcherId === watcher.id
                ? (watcher.watchStreak ?? 0) + 1
                : 1;
            sleepers.forEach(m => { m.watchStreak = 0; });
            if (watcher.watchStreak >= EARNED_TRAIT_RULES.sleeplessWatches) {
                earnTrait(ctx, watcher, 'Sleepless Week');
            }
            record.lastWatch = { zone, watcherId: watcher.id };
            if (!already) {
                // §22: "the others" are on the line's own cast list and were
                // never in the line. In a chronicle the point of the watch is
                // which of them was awake and which of them was not.
                const asleep = sleepers.map(m => m.name).join(', ');
                ctx.logEvent(
                    sentry
                        ? `${watcher.name} takes the first watch in ${zone}. ${asleep} sleep${sleepers.length === 1 ? 's' : ''}.`
                        : `${watcher.name} keeps watch in ${zone}. ${asleep} sleep${sleepers.length === 1 ? 's' : ''}.`,
                    camp.map(m => m.id),
                    { type: 'watch-posted', category: 'alliance', zone }
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
