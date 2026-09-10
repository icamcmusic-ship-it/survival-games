import { announceFeastTheme } from './phases/feast';
import { ITEMS } from '../data/constants';
import { GAMEMAKER_AGENCY, QUALITY_BIAS } from '../data/balance';
import { gamemakerProfile } from '../data/gamemakers';
import { SimContext, getAlive } from './context';
import { triggerGamemakerEvent } from './gamemaker';
import { giveItem, itemPhrase, mintItem } from './items';
import { pickNeededGift } from './sponsors';
import { depleteZone, zoneFeatures } from './map';
import { clampTribute } from './vitals';
import { Tribute } from '../models/types';
import { adjustRel } from './relationships';
import { applyDamage, checkDeath } from './combat';
import { startZoneEffect } from './zoneEffects';
import { addZoneThreat } from './memory';
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

        // §10: five behaviours that make the other thirteen Head Gamemakers
        // somebody rather than a name over the same Games.

        case 'rig-the-feast': {
            // A feast laid for one tribute in particular. The table is real;
            // whose pack is worth having is the part that has been decided.
            const mark = ctx.rng.pick(alive);
            if (!mark) break;
            ctx.state.feastDay = ctx.state.day + 1;
            announceFeastTheme(ctx);
            ctx.state.feastPrizes = alive.map(t => ({
                tributeId: t.id,
                label: t.id === mark.id
                    ? `a pack marked ${t.name.toUpperCase()} — visibly heavier than the rest, and set nearest the horn`
                    : `a pack marked ${t.name.toUpperCase()}, D${t.district}`,
            }));
            ctx.logEvent(
                `The feast is announced, and the table is not even. ${mark.name}'s pack is the one everybody can see from where they are standing.`,
                [mark.id],
                { important: true, category: 'feast' }
            );
            break;
        }

        case 'favour-a-district': {
            // A house tribute. The parachutes are real and so is what it does
            // to how everybody else feels about them.
            const favoured = ctx.rng.pick(alive);
            if (!favoured) break;
            const gift = mintItem(ctx.rng, pickNeededGift(ctx, favoured, ITEMS), QUALITY_BIAS.parachute);
            giveItem(favoured, gift);
            favoured.sponsorTrust = Math.min(100, favoured.sponsorTrust + GAMEMAKER_AGENCY.favouredTrust);
            clampTribute(favoured);
            alive.filter(o => o.id !== favoured.id)
                .forEach(o => adjustRel(o, favoured.id, -GAMEMAKER_AGENCY.favouredResentment));
            ctx.logEvent(
                `District ${favoured.district} is having a good year, and everybody watching can see exactly why. `
                + `${favoured.name} opens ${itemPhrase(gift)} in ${favoured.zone} and nobody in the arena believes it was luck.`,
                [favoured.id],
                { important: true, category: 'sponsor', zone: favoured.zone }
            );
            break;
        }

        case 'punish-alliances': {
            // Groups are the thing being discouraged. Camped-together tributes
            // find the arena markedly less comfortable about it.
            const camped = new Map<string, typeof alive>();
            alive.forEach(t => {
                if (!t.allianceId) return;
                const list = camped.get(t.zone) ?? [];
                list.push(t);
                camped.set(t.zone, list);
            });
            let struck = 0;
            camped.forEach((group, zone) => {
                if (group.length < 2) return;
                struck += 1;
                group.forEach(t => {
                    applyDamage(ctx, t, GAMEMAKER_AGENCY.punishAllianceDamage, {
                        cause: `Singled out for travelling in company in ${zone}`, kind: 'gamemaker',
                    });
                    t.vitals.sanity -= GAMEMAKER_AGENCY.punishAllianceSanity;
                    clampTribute(t);
                    checkDeath(ctx, t, `Singled out for travelling in company in ${zone}`);
                });
                ctx.logEvent(
                    `Whatever the Gamemakers do to ${zone}, it finds everybody standing in it together and nobody standing in it alone. `
                    + 'The message does not need explaining.',
                    group.map(t => t.id),
                    { important: true, zone, category: 'gamemaker' }
                );
            });
            if (struck === 0) {
                ctx.logEvent(
                    'The Gamemakers have prepared something specifically for groups, and this year there are none worth spending it on.',
                    [], { category: 'gamemaker' }
                );
            }
            break;
        }

        case 'flood-the-low': {
            // Geography as an argument. Everything that is not high ground.
            const low = ctx.state.arena.zones
                .filter(z => !(ctx.state.collapsedZones ?? []).includes(z.name))
                .filter(z => !zoneFeatures(z).elevation)
                .slice(0, GAMEMAKER_AGENCY.floodLowZones);
            if (low.length === 0) break;
            low.forEach(z => startZoneEffect(ctx, z.name, 'flooded'));
            ctx.logEvent(
                `The water comes up everywhere that is not high ground. ${low.map(z => z.name).join(', ')} are all the same colour now, `
                + 'and the map everybody has been using is worth rather less than it was this morning.',
                [], { important: true, category: 'gamemaker' }
            );
            break;
        }

        case 'hunt-the-favourite': {
            // Whoever the crowd loves gets the Gamemakers' full attention.
            const favourite = [...alive].sort((a, b) => b.excitementRating - a.excitementRating)[0];
            if (!favourite) break;
            withGamemakerAttention(ctx, favourite);
            break;
        }
    }
}

/**
 * §10: the Gamemakers deciding somebody has been interesting for long enough.
 * Mutts to their zone, and the arena's own attention on them — the crowd's
 * favourite is the one the control room most wants to see tested.
 */
function withGamemakerAttention(ctx: SimContext, t: Tribute) {
    ctx.logEvent(
        `${t.name} is the tribute the Capitol has been watching all week, which turns out not to be the protection everybody assumed it was.`,
        [t.id],
        { important: true, zone: t.zone, category: 'gamemaker' }
    );
    triggerGamemakerEvent(ctx, 'mutt', t.id, true);
    addZoneThreat(ctx.state, t, t.zone, GAMEMAKER_AGENCY.favouriteThreat);
}
