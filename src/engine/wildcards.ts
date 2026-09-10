import { SimContext, getAlive } from './context';
import { ITEMS } from '../data/constants';
import { QUALITY_BIAS, WILDCARD } from '../data/balance';
import { giveItem, itemPhrase, mintItem } from './items';
import { triggerGamemakerEvent } from './gamemaker';
import { announceFeastTheme } from './phases/feast';
import { addExcitement } from './audience';
import { clampTribute } from './vitals';
import { RNG } from '../utils/rng';
import { Wildcard } from '../data/gamesProfile';
import { calendarOf } from './gamesProfile';
import { cycleOf, noteSighting, rememberedRivals, addZoneThreat } from './memory';
import { fearOf } from './fear';
import { OBJECTIVES } from '../data/balance';

/**
 * REPLAY-01: the one scheduled disruption a run gets.
 *
 * Each wildcard resolves through machinery that already exists — the feast
 * phase, the Gamemaker triggers, the sponsor stream — rather than adding a
 * subsystem of its own. That is the constraint that keeps the pool cheap to
 * extend: a new wildcard is a data row plus, at most, a case here.
 *
 * Standing conditions (`day: 0`) are not handled here at all; they are folded
 * into the run's config by `configForProfile`, or asked about directly by the
 * system they affect.
 */
export function fireScheduledWildcard(ctx: SimContext) {
    const profile = ctx.state.gamesProfile;
    if (!profile) return;
    const calendar = calendarOf(profile);
    const fired = ctx.state.firedWildcards ?? (ctx.state.firedWildcards = []);

    // §5.3: excitement drives *frequency*, not only intensity.
    //
    // `audience.ts` documents excitement as the metric the Gamemakers escalate
    // on, and everything downstream of it made the arena harsher — never
    // sooner. A run that has gone quiet is the exact case where the Capitol
    // reaches for the schedule: a flatlining audience pulls the next scheduled
    // beat forward rather than waiting for its day, so a slow run is rewarded
    // with intervention instead of merely with worse numbers when something
    // finally does happen.
    const pullForward = excitementFlatlined(ctx) ? WILDCARD.flatlinePullForwardDays : 0;

    calendar.forEach((wildcard, index) => {
        if (wildcard.day === 0 || ctx.state.day < wildcard.day - pullForward) return;
        if (fired.includes(index)) return;
        fired.push(index);
        ctx.state.lastWildcardCycle = cycleOf(ctx.state);
        ctx.rng = new RNG(`${ctx.state.seed}-wildcard-${index}-${ctx.state.day}`);
        if (wildcard.onFire) {
            ctx.logEvent(wildcard.onFire, [], { important: true, category: 'gamemaker' });
        }
        resolveWildcard(ctx, wildcard);
    });

    fireExtraDisruption(ctx);
}

/**
 * §10.7: beyond the calendar. The Capitol's patience is not a fixed list —
 * up to WILDCARD.maxExtraDisruptions unscheduled beats can land per run, at
 * diminishing odds, never inside the spacing window of the last disruption.
 */
const EXTRA_DISRUPTIONS: Array<{ kind: Wildcard['kind']; name: string; onFire: string }> = [
    { kind: 'supply-drop', name: 'an unscheduled supply drop', onFire: 'Unaddressed parachutes come down all over the arena. Nobody in the booth is saying whose idea it was.' },
    { kind: 'mutt-release', name: 'an unscheduled release', onFire: 'A gate nobody has used since the bloodbath grinds open. The Gamemakers have decided the field needs company.' },
    { kind: 'weather-front', name: 'an unscheduled storm', onFire: 'The weather systems spin up without an announcement. Whatever this is, it was not on the calendar.' },
    { kind: 'crowd-revolt', name: 'a crowd revolt', onFire: 'The Capitol audience turns on its own favourites, live, and the sponsor boards start rewriting themselves.' },
    { kind: 'bounty', name: 'a surprise bounty', onFire: 'A voice over the arena names a name. The Capitol wants somebody watched, and now everybody is watching them.' },
];

function fireExtraDisruption(ctx: SimContext) {
    const state = ctx.state;
    const extras = state.extraWildcardsFired ?? 0;
    if (extras >= WILDCARD.maxExtraDisruptions) return;
    if (state.day < WILDCARD.extraDisruptionEarliestDay) return;
    const cycle = cycleOf(state);
    if (cycle - (state.lastWildcardCycle ?? -99) < WILDCARD.extraDisruptionSpacingCycles) return;

    const rng = new RNG(`${state.seed}-extra-wildcard-${cycle}`);
    const chance = WILDCARD.extraDisruptionBaseChance * Math.pow(WILDCARD.extraDisruptionDecay, extras);
    if (!rng.chance(chance)) return;

    const pick = rng.pick(EXTRA_DISRUPTIONS);
    state.extraWildcardsFired = extras + 1;
    state.lastWildcardCycle = cycle;
    ctx.rng = rng;
    ctx.logEvent(pick.onFire, [], { important: true, category: 'gamemaker' });
    resolveWildcard(ctx, { kind: pick.kind, name: pick.name, announcement: '', day: state.day });
}

/**
 * §5.3: has the audience gone flat, as opposed to merely low?
 *
 * Low excitement is a quiet field, which is a legitimate way for a Games to
 * be. A flat one is a Games that has stopped moving in either direction —
 * nothing has changed for several cycles running — and that is what a
 * Gamemaker actually reacts to. Tracked on the state as a run of unchanged
 * totals so a save resumes mid-flatline rather than resetting the count.
 */
function excitementFlatlined(ctx: SimContext): boolean {
    const state = ctx.state;
    const total = Math.round(getAlive(state).reduce((sum, t) => sum + t.excitementRating, 0));
    const moved = Math.abs(total - (state.lastExcitementTotal ?? total)) > WILDCARD.flatlineTolerance;
    state.lastExcitementTotal = total;
    state.excitementFlatCycles = moved ? 0 : (state.excitementFlatCycles ?? 0) + 1;
    return (state.excitementFlatCycles ?? 0) >= WILDCARD.flatlineCycles;
}

function resolveWildcard(ctx: SimContext, wildcard: Wildcard) {
    const alive = getAlive(ctx.state);

    switch (wildcard.kind) {
        case 'early-feast':
        case 'double-feast':
            // The feast phase already handles the whole scene; this only moves
            // when the horn sounds, and the guard in `gamemaker.ts` still stops
            // two feasts landing on the same day.
            if (ctx.state.config.enableFeast && (ctx.state.phase === 'day' || ctx.state.phase === 'night')) {
                ctx.state.feastDay = ctx.state.day;
                announceFeastTheme(ctx);
                ctx.state.phase = 'feast';
            }
            break;

        case 'mutt-release':
            // Forced through regardless of Gamemaker mode: this is the Capitol's
            // schedule, not the player's intervention.
            withGamemakerMode(ctx, () => triggerGamemakerEvent(ctx, 'mutt', undefined, true));
            break;

        case 'weather-front':
            withGamemakerMode(ctx, () => triggerGamemakerEvent(ctx, 'weather', undefined, true));
            break;

        case 'supply-drop': {
            // Unaddressed parachutes: everyone still standing gets one thing,
            // which is a genuinely different shape from the sponsor stream
            // (that one only ever rewards the tributes already being watched).
            const pool = ITEMS.filter(i => i.value >= WILDCARD.dropMinValue);
            alive.forEach(t => {
                const gift = mintItem(ctx.rng, ctx.rng.pick(pool), QUALITY_BIAS.scavenged);
                giveItem(t, gift);
                ctx.logEvent(
                    `${t.name} gets to an unaddressed parachute in ${t.zone} first and comes away with ${itemPhrase(gift)}.`,
                    [t.id],
                    { category: 'sponsor' }
                );
            });
            break;
        }

        case 'sponsor-freeze':
            // The freeze lifting is the event; the crowd has been saving up.
            alive.forEach(t => {
                addExcitement(t, WILDCARD.freezeLiftExcitement);
                clampTribute(t);
            });
            break;

        case 'gamemaker-malfunction': {
            // The arena does something nobody planned: one zone effect, one
            // severed route, and a field that suddenly trusts nothing.
            withGamemakerMode(ctx, () => triggerGamemakerEvent(ctx, 'weather', undefined, true));
            alive.forEach(t => {
                t.vitals.sanity = Math.max(0, t.vitals.sanity - WILDCARD.malfunctionSanity);
                clampTribute(t);
            });
            break;
        }

        case 'career-collapse': {
            const pack = alive.filter(t => t.isCareer && t.allianceId?.startsWith('career-pack'));
            if (pack.length < 2) break;
            pack.forEach(t => { delete t.allianceId; });
            ctx.logEvent(
                `The Career pack comes apart in the open: ${pack.map(p => p.name).join(', ')} are no longer anybody's allies.`,
                pack.map(p => p.id),
                { important: true, category: 'alliance' }
            );
            break;
        }

        case 'blackout':
            // Several cycles where the arena simply does not get its day back —
            // an "extended darkness" that lasted exactly one phase was the
            // announcement writing a cheque the implementation did not honour.
            // `processDayNight` reads this and holds the arena in night.
            ctx.state.blackoutUntilCycle = (ctx.state.cycle ?? 0) + WILDCARD.blackoutCycles;
            ctx.state.timeOfDay = 'night';
            break;

        case 'drought': {
            // Strips every water zone the way a stripped-bare forage zone works,
            // through the depletion system rather than a bespoke flag.
            ctx.state.zoneDepletion = ctx.state.zoneDepletion ?? {};
            ctx.state.arena.zones
                .filter(z => z.terrain === 'water' || z.terrain === 'wetland')
                .forEach(z => { ctx.state.zoneDepletion![z.name] = WILDCARD.droughtDepletion; });
            break;
        }

        // §7: seven provisions that resolve through machinery already present.

        case 'bounty-on-the-hidden': {
            // The opposite of the ordinary bounty: not the tribute nobody is
            // invested in, but the one nobody has *seen*. Their position is
            // handed to the whole field, which is the only thing a tribute
            // who has survived by not being found actually fears.
            const hidden = [...alive].sort((a, b) => (b.unseenStreak ?? 0) - (a.unseenStreak ?? 0))[0];
            if (!hidden || (hidden.unseenStreak ?? 0) === 0) break;
            ctx.state.bountyTargetId = hidden.id;
            addExcitement(hidden, WILDCARD.bountyExcitement);
            alive.filter(o => o.id !== hidden.id).forEach(o => {
                noteSighting(ctx.state, o, hidden.zone, 1, 0);
            });
            hidden.unseenStreak = 0;
            ctx.logEvent(
                `The Gamemakers have decided that a tribute nobody has footage of is not a tribute. `
                + `${hidden.name} is in ${hidden.zone}, and now so is everybody else's attention.`,
                [hidden.id],
                { important: true, zone: hidden.zone, category: 'gamemaker' }
            );
            break;
        }

        case 'drop-between-rivals': {
            // A crate placed exactly where two people who hate each other both
            // have to come for it.
            const pairs = alive.flatMap(a => alive
                .filter(b => b.id !== a.id)
                .map(b => ({ a, b, spite: -(a.relationships[b.id] ?? 0) })));
            const worst = pairs.sort((x, y) => y.spite - x.spite)[0];
            if (!worst) break;
            const zone = worst.a.zone;
            const crate = mintItem(ctx.rng, ctx.rng.pick(ITEMS), QUALITY_BIAS.feast);
            // Whoever is standing in it takes it; the other one is told where
            // it went, which is the part that makes it a provocation rather
            // than a gift. There is no ground-loot layer to leave it lying in,
            // so the crate is resolved now and the grudge is the payload.
            giveItem(worst.a, crate);
            [worst.a, worst.b].forEach(t => noteSighting(ctx.state, t, zone, 1, 0));
            ctx.state.bountyTargetId = worst.a.id;
            ctx.logEvent(
                `A crate comes down in ${zone} carrying ${itemPhrase(crate)}, and ${worst.a.name} is the one standing under it. `
                + `${worst.b.name} is told exactly where it landed and exactly who has it, which everybody watching understands was the point.`,
                [worst.a.id, worst.b.id],
                { important: true, zone, category: 'loot' }
            );
            break;
        }

        case 'cannon-misfire': {
            // A death report for nobody. Every tribute now believes the field
            // is one smaller than it is, and acts on it.
            const ghost = ctx.rng.pick(alive);
            if (!ghost) break;
            ctx.logEvent(
                `A cannon fires over the arena. Nobody has died. Every tribute still breathing spends the rest of the day `
                + 'counting a field that is one larger than the one they think they are in.',
                [], { important: true, category: 'system' }
            );
            alive.filter(o => o.id !== ghost.id).forEach(o => {
                addExcitement(o, WILDCARD.misfireExcitement);
            });
            break;
        }

        case 'mentor-broadcast': {
            // One open channel. Sponsor trust moves for everybody whose mentor
            // had something worth saying.
            alive.forEach(t => {
                if (!t.mentorLegacy) return;
                t.sponsorTrust = Math.min(100, t.sponsorTrust + WILDCARD.broadcastTrust);
                clampTribute(t);
            });
            ctx.logEvent(
                'For one minute the arena hears the mentors. Some of them give directions, some of them give reassurance, '
                + 'and at least one of them says a name that was not supposed to be said on an open channel.',
                [], { important: true, category: 'sponsor' }
            );
            break;
        }

        case 'cleansing-rain': {
            // Half a day of rain across the whole arena: forage depletion
            // resets, and anything burning stops burning.
            ctx.state.zoneDepletion = {};
            ctx.logEvent(
                'It rains on the whole arena at once, for half a day, without any obvious cruelty attached to it. '
                + 'By evening the ground everybody had written off is worth searching again.',
                [], { important: true, category: 'survival' }
            );
            break;
        }

        case 'mutt-migration': {
            // The dangerous half of the map moves. Remembered threat follows
            // the herd rather than staying where it was earned.
            const zones = ctx.state.arena.zones
                .filter(z => !(ctx.state.collapsedZones ?? []).includes(z.name));
            const heading = ctx.rng.pick(zones);
            if (!heading) break;
            alive.forEach(t => addZoneThreat(ctx.state, t, heading.name, WILDCARD.migrationThreat));
            ctx.logEvent(
                `Everything with teeth in this arena is moving, and it is all moving toward ${heading.name}. `
                + 'For the next two days the dangerous half of the map is somewhere it has not been.',
                [], { important: true, zone: heading.name, category: 'mutt' }
            );
            break;
        }

        case 'the-faces-lie': {
            // A face in the sky belonging to somebody still walking around.
            // Everybody who cared about them grieves for nothing.
            const liveOne = ctx.rng.pick(alive);
            if (!liveOne) break;
            alive.filter(o => o.id !== liveOne.id).forEach(o => {
                if ((o.relationships[liveOne.id] ?? 0) <= 0) return;
                o.vitals.sanity -= WILDCARD.falseFaceSanity;
                clampTribute(o);
            });
            ctx.logEvent(
                `${liveOne.name}'s face is in the sky tonight. ${liveOne.name} watches it from ${liveOne.zone}, alive, `
                + 'and works out several things at once about what the broadcast is for.',
                [liveOne.id],
                { important: true, zone: liveOne.zone, category: 'system' }
            );
            break;
        }

        case 'bounty': {
            // The Capitol picks the tribute the crowd is least invested in and
            // makes them interesting by fiat. An event named "bounty" that
            // produced one log line and some excitement was not a bounty: it
            // now actually points the field at one person, by writing a hunt
            // objective onto everyone with the stomach for it and seeding a
            // sighting so they can act on it.
            const target = [...alive].sort((a, b) => a.excitementRating - b.excitementRating)[0];
            if (!target) break;
            addExcitement(target, WILDCARD.bountyExcitement);
            target.sponsorTrust = Math.min(100, target.sponsorTrust + WILDCARD.bountyTrust);
            clampTribute(target);
            ctx.state.bountyTargetId = target.id;
            ctx.logEvent(
                `The bounty is on ${target.name} of District ${target.district}. Every sponsor in the Capitol is now watching one person, and so is everybody left in the arena.`,
                [target.id],
                { important: true, category: 'sponsor' }
            );

            const hunters = alive.filter(t =>
                t.id !== target.id
                && (t.allianceId === undefined || t.allianceId !== target.allianceId)
                && fearOf(t, target.id) < OBJECTIVES.huntAbandonFear);
            hunters.forEach(t => {
                // The Capitol broadcasts where they are: this is public
                // information, which is the entire point of a bounty.
                noteSighting(ctx.state, t, target.zone, Math.max(1, rememberedRivals(ctx.state, t, target.zone)), 0);
                t.objective = {
                    kind: 'hunt',
                    targetId: target.id,
                    expires: cycleOf(ctx.state) + OBJECTIVES.huntCycles,
                };
            });
            if (hunters.length > 0) {
                ctx.logEvent(
                    `${hunters.map(h => h.name).join(', ')} all change direction at once. There is only one thing worth walking toward now.`,
                    hunters.map(h => h.id),
                    { important: true, category: 'travel' }
                );
            }
            break;
        }

        case 'crowd-revolt': {
            // "Viewing figures are down, fix it" was a 1.3x hazard multiplier
            // and nothing else. A crowd that has lost patience turns on its own
            // favourites: the tributes the Capitol has been carrying lose their
            // sponsors, and the ones nobody was watching become the story.
            const ranked = [...alive].sort((a, b) => b.excitementRating - a.excitementRating);
            const top = ranked.slice(0, Math.ceil(ranked.length / 3));
            const bottom = ranked.slice(-Math.ceil(ranked.length / 3));
            top.forEach(t => {
                t.sponsorTrust = Math.max(0, t.sponsorTrust - WILDCARD.revoltTrustSwing);
                t.excitementRating = Math.max(0, t.excitementRating - WILDCARD.revoltTrustSwing);
                clampTribute(t);
            });
            bottom.forEach(t => {
                t.sponsorTrust = Math.min(100, t.sponsorTrust + WILDCARD.revoltTrustSwing);
                addExcitement(t, WILDCARD.revoltTrustSwing);
                clampTribute(t);
            });
            ctx.logEvent(
                `The Capitol turns on its own favourites. ${top.map(t => t.name).join(', ')} find the parachutes have stopped; ` +
                `${bottom.map(t => t.name).join(', ')} are suddenly the story nobody saw coming.`,
                [...top, ...bottom].map(t => t.id),
                { important: true, category: 'sponsor' }
            );
            break;
        }

        default:
            break;
    }
}

/**
 * The Gamemaker triggers are gated on the player's Gamemaker mode, which is
 * correct for a button in the UI and wrong for the Capitol's own schedule.
 * Lifts the gate for exactly one call and puts it back.
 */
function withGamemakerMode(ctx: SimContext, fn: () => void) {
    const previous = ctx.state.gamemakerMode;
    ctx.state.gamemakerMode = true;
    try {
        fn();
    } finally {
        ctx.state.gamemakerMode = previous;
    }
}
