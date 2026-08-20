import { SimContext, getAlive } from './context';
import { ITEMS } from '../data/constants';
import { QUALITY_BIAS, WILDCARD } from '../data/balance';
import { giveItem, itemPhrase, mintItem } from './items';
import { triggerGamemakerEvent } from './gamemaker';
import { addExcitement } from './audience';
import { clampTribute } from './vitals';
import { RNG } from '../utils/rng';
import { Wildcard } from '../data/gamesProfile';
import { calendarOf } from './gamesProfile';
import { cycleOf, noteSighting, rememberedRivals } from './memory';
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

    calendar.forEach((wildcard, index) => {
        if (wildcard.day === 0 || ctx.state.day < wildcard.day) return;
        if (fired.includes(index)) return;
        fired.push(index);
        ctx.rng = new RNG(`${ctx.state.seed}-wildcard-${index}-${ctx.state.day}`);
        if (wildcard.onFire) {
            ctx.logEvent(wildcard.onFire, [], { important: true, category: 'gamemaker' });
        }
        resolveWildcard(ctx, wildcard);
    });
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
                ctx.state.phase = 'feast';
            }
            break;

        case 'mutt-release':
            // Forced through regardless of Gamemaker mode: this is the Capitol's
            // schedule, not the player's intervention.
            withGamemakerMode(ctx, () => triggerGamemakerEvent(ctx, 'mutt'));
            break;

        case 'weather-front':
            withGamemakerMode(ctx, () => triggerGamemakerEvent(ctx, 'weather'));
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
            withGamemakerMode(ctx, () => triggerGamemakerEvent(ctx, 'weather'));
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
