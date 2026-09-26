import { Alliance, Tribute } from '../models/types';
import { witnessKindness } from './rapport';
import { AUDIT12_TRIBUTES, EARNED_TRAIT_RULES, WATCH_ROTATION } from '../data/balance';
import { SimContext } from './context';
import { allianceRecords, membersOf } from './alliance';
import { awareness } from './stealth';
import { traitMod } from '../data/traits';
import { cycleOf, raiseSuspicion } from './memory';
import { isActive } from './downed';
import { ARCHETYPES } from '../data/archetypes';
import { witnessTheft } from './allianceBonds';
import { clampTribute } from './vitals';
import { earnTrait } from './earnedTraits';
import { watchFails } from './allianceBonds';

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
        // AUDIT-12 T9: somebody on the ground bleeding does not stand a watch.
        const members = membersOf(state, id).filter(m => m.status === 'alive' && isActive(m));
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
            // AUDIT-12 §6: the rota is ordered by the night-watch trait first
            // (the Light Sleeper and the Night Owl go before anybody who merely
            // sees well), then by eyes in the dark.
            const ranked = [...camp].sort((a, b) =>
                (traitMod(b, 'awarenessNight') - traitMod(a, 'awarenessNight'))
                || (nightEyes(b) - nightEyes(a)) || (a.id < b.id ? -1 : 1));
            // Modulo the camp, not the *minimum camp size*. Taking it against
            // `minMembers` meant that in a camp of five only the two
            // best-sighted ever stood a watch, and on odd cycles it went to the
            // worse of those two — so a rotation that exists to spread the cost
            // spread it over two people and halved what sharp night eyes were
            // worth.
            const watcher = ranked[cycle % ranked.length] ?? ranked[0];
            const sleepers = camp.filter(m => m.id !== watcher.id);

            const sentry = nightEyes(watcher) >= WATCH_ROTATION.sentryAwareness;
            // AUDIT-11 §6: a watcher who nods off gives the sleepers nothing.
            const slept = watchFails(ctx, record, watcher, sleepers, zone);
            if (slept) nightThief(ctx, record, watcher, sleepers, zone);
            if (!slept) sleepers.forEach(m => {
                m.health = Math.min(100, m.health + WATCH_ROTATION.recoveryBonus
                    + (sentry ? WATCH_ROTATION.lightSleeperBonus : 0));
                m.sleepDebt = Math.max(0, (m.sleepDebt ?? 0) - WATCH_ROTATION.debtRepaid);
                clampTribute(m);
            });
            watcher.vitals.fatigue += WATCH_ROTATION.watcherFatigue;
            clampTribute(watcher);
            // A night's watch is a kindness the sleepers can see in the morning.
            if (!slept) sleepers.forEach(m => witnessKindness(ctx, watcher, m, 0.5));

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
            // AUDIT-12 T8: a watch slept through is not a watch kept.
            watcher.watchStreak = slept ? 0 : record.lastWatch?.watcherId === watcher.id
                ? (watcher.watchStreak ?? 0) + 1
                : 1;
            sleepers.forEach(m => { m.watchStreak = 0; });
            if (watcher.watchStreak >= EARNED_TRAIT_RULES.sleeplessWatches) {
                earnTrait(ctx, watcher, 'Sleepless Week');
            }
            record.lastWatch = { zone, watcherId: watcher.id };
            if (!already && !slept) {
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

/**
 * AUDIT-12 §6: a watcher asleep is an opening. The most treacherous sleeper
 * may use it to help themselves to the pile, or to a bedmate's pack. Somebody
 * who wakes (a light sleeper, mostly) sees it, and it is written into their
 * suspicion as well as their regard.
 */
function nightThief(ctx: SimContext, record: Alliance, watcher: Tribute, sleepers: Tribute[], zone: string) {
    const treachery = (t: Tribute) => ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery');
    const thief = [...sleepers].sort((a, b) => treachery(b) - treachery(a) || (a.id < b.id ? -1 : 1))[0];
    if (!thief || treachery(thief) < AUDIT12_TRIBUTES.nightTheftTreachery) return;
    if (!ctx.rng.chance(AUDIT12_TRIBUTES.nightTheftChance)) return;
    const marks = [watcher, ...sleepers].filter(m => m.id !== thief.id && m.inventory.length > 0);
    let taken: string | undefined;
    if (record.sharedCache.length > 0) {
        const item = record.sharedCache.splice(ctx.rng.nextInt(0, record.sharedCache.length - 1), 1)[0];
        thief.inventory.push(item);
        taken = `the ${item.name} from the group's pile`;
    } else if (marks.length > 0) {
        const mark = ctx.rng.pick(marks);
        const item = mark.inventory.splice(ctx.rng.nextInt(0, mark.inventory.length - 1), 1)[0];
        thief.inventory.push(item);
        taken = `${mark.name}'s ${item.name}`;
    }
    if (!taken) return;
    ctx.logEvent(
        `While ${watcher.name} sleeps at their post in ${zone}, ${thief.name} gets up very quietly and takes ${taken}.`,
        [thief.id],
        { type: 'night-theft', category: 'betrayal', zone }
    );
    const witnesses = sleepers.filter(m => m.id !== thief.id
        && ctx.rng.chance(AUDIT12_TRIBUTES.nightTheftSeen + traitMod(m, 'awarenessNight') * 0.1));
    witnesses.forEach(w => raiseSuspicion(w, thief.id, AUDIT12_TRIBUTES.deceitSuspicion));
    if (witnesses.length > 0) witnessTheft(ctx, thief, witnesses);
}

/** How much use somebody is on watch: awareness in the dark, plus the trait. */
function nightEyes(t: Tribute): number {
    return awareness(t, true) + traitMod(t, 'awarenessNight');
}
