import { announceFeastTheme } from './phases/feast';
import { ITEMS } from '../data/constants';
import { GAMEMAKER_AGENCY, QUALITY_BIAS } from '../data/balance';
import { gamemakerProfile } from '../data/gamemakers';
import { SimContext, getAlive } from './context';
import { triggerGamemakerEvent } from './gamemaker';
import { giveItem, itemPhrase, mintItem } from './items';
import { pickNeededGift } from './sponsors';
import { depleteZone } from './map';
import { clampTribute } from './vitals';
import { ESCALATION } from '../data/balance';

/**
 * The Head Gamemaker actually doing something.
 *
 * Nine named Gamemakers existed, each with a style line the reaping read out,
 * and between them they differed by exactly two multipliers — a boredom
 * threshold and a hazard scalar. A player could not tell Coriolanus Dray's
 * Games from Larkspur Ainsel's except by reading the header, which makes the
 * whole roster a tooltip rather than a mechanic.
 *
 * Each now has one signature intervention, fired once per run when the feed
 * needs it: when the audience has gone quiet and the arena has not yet started
 * closing. What they reach for is the thing their own style line advertises.
 */

/** Lifts the Gamemaker-mode gate for exactly one call, as `wildcards.ts` does. */
function asGamemaker(ctx: SimContext, fn: () => void) {
    const previous = ctx.state.gamemakerMode;
    ctx.state.gamemakerMode = true;
    try {
        fn();
    } finally {
        ctx.state.gamemakerMode = previous;
    }
}

export function runGamemakerSignature(ctx: SimContext) {
    if (ctx.state.gamemakerSignatureFired) return;
    const alive = getAlive(ctx.state);
    // Not while the cast is still enormous, and not once it is down to the
    // finalists — this is the Head Gamemaker rescuing the middle of a run,
    // which is exactly the stretch the review found samey.
    if (alive.length > GAMEMAKER_AGENCY.maxFieldSize) return;
    if (alive.length <= ESCALATION.finalistCount) return;
    if (ctx.state.day < GAMEMAKER_AGENCY.earliestDay) return;

    const bored = ctx.state.audienceInterest !== undefined
        && ctx.state.audienceInterest < GAMEMAKER_AGENCY.boredomThreshold;
    if (!bored && !ctx.rng.chance(GAMEMAKER_AGENCY.unpromptedChance)) return;

    const profile = gamemakerProfile(ctx.state.headGamemaker);
    ctx.state.gamemakerSignatureFired = true;
    ctx.logEvent(profile.signatureLine, [], { important: true, category: 'gamemaker' });

    switch (profile.signature) {
        case 'release-mutts':
            asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'mutt', undefined, true));
            break;

        case 'weather-front':
            asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'weather', undefined, true));
            break;

        case 'call-the-feast':
            // Only if a feast is actually available; otherwise Voss settles for
            // the weather, which he will describe afterwards as intentional.
            if (ctx.state.config.enableFeast && ctx.state.feastDay === undefined) {
                ctx.state.feastDay = ctx.state.day + 1;
                ctx.logEvent(
                    'The horn sounds a day ahead. There will be a feast, and everybody in the arena now has somewhere to be.',
                    [],
                    { important: true, category: 'feast' }
                );
                announceFeastTheme(ctx);
            } else {
                asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'weather', undefined, true));
            }
            break;

        case 'close-the-border':
            // Impatience expressed as geography: the collapse schedule jumps
            // forward, which the border layer reads directly.
            ctx.state.escalationDay = Math.min(ctx.state.escalationDay ?? ctx.state.day, ctx.state.day);
            break;

        case 'spare-the-young': {
            const youngest = [...alive].sort((a, b) => a.age - b.age)[0];
            if (!youngest) break;
            const gift = mintItem(ctx.rng, pickNeededGift(ctx, youngest, ITEMS), QUALITY_BIAS.parachute);
            giveItem(youngest, gift);
            clampTribute(youngest);
            ctx.logEvent(
                `${youngest.name} — the youngest tribute still alive — opens a parachute in ${youngest.zone} and finds ${itemPhrase(gift)}.`,
                [youngest.id],
                { important: true, category: 'sponsor' }
            );
            break;
        }

        case 'grind':
            // Nothing dramatic. Everything slightly worse, everywhere.
            ctx.state.arena.zones.forEach(z => {
                depleteZone(ctx.state, z.name, GAMEMAKER_AGENCY.grindDepletion);
            });
            alive.forEach(t => {
                t.vitals.thirst += GAMEMAKER_AGENCY.grindThirst;
                t.vitals.fatigue += GAMEMAKER_AGENCY.grindFatigue;
                clampTribute(t);
            });
            break;

        case 'do-nothing':
            // The intervention is the refusal, and it is on the record. The
            // crowd finds restraint genuinely interesting for about a day.
            break;
    }
}
