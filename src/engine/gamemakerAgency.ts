import { announceFeastTheme } from './phases/feast';
import { addCruelty, fairnessAllows, handsOffBooth } from './season/cruelty';
import { answerLoudestSegment, crowdIsBored } from './season/crowd';
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
import { addZoneThreat, noteSighting } from './memory';
import { severEdge } from './map';
import { getRel } from './relationships';
import { grantTruce } from './parley';
import { tributeOdds } from './odds';
import { CONTINUITY, ENDGAME, ESCALATION } from '../data/balance';
import { loseSanity } from './sanityBands';

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

/**
 * §9.3: the Head Gamemaker's second turn.
 *
 * A grudge is earned by the player: beating this Gamemaker before, running a
 * patron district that keeps coming home, holding a live dynasty. It does two
 * things. The signature comes sooner and is likelier to fire unprompted — and
 * at `CONTINUITY.grudgeInterventionTier` the Gamemakers take a turn aimed
 * squarely at the district they are watching, which is the one the player has
 * spent runs building up.
 *
 * The whole of it reads `state.continuity`, which is resolved once at the
 * reaping from records that already persist. A headless run with no record
 * book simply has no continuity and behaves exactly as before.
 */
export function runGrudgeIntervention(ctx: SimContext) {
    const continuity = ctx.state.continuity;
    if (!continuity || ctx.state.grudgeFired) return;
    if (continuity.grudge < CONTINUITY.grudgeInterventionTier) return;
    const watched = continuity.watchedDistrict;
    if (watched === undefined) return;
    const marked = getAlive(ctx.state).filter(t => t.district === watched);
    if (marked.length === 0) return;
    if (ctx.state.day < GAMEMAKER_AGENCY.earliestDay) return;

    ctx.state.grudgeFired = true;
    ctx.logEvent(
        `${ctx.state.headGamemaker ?? 'The Head Gamemaker'} has not forgotten District ${watched}. `
        + `The arena's attention arrives where they are standing, and it is not subtle about it.`,
        marked.map(t => t.id),
        { important: true, category: 'gamemaker' },
    );
    marked.forEach(t => {
        loseSanity(t, CONTINUITY.grudgeSanity);
        t.vitals.fatigue += CONTINUITY.grudgeFatigue;
        clampTribute(t);
        addZoneThreat(ctx.state, t, t.zone, CONTINUITY.grudgeThreat);
    });
    // One of them gets the Gamemakers' full attention rather than the weather.
    const mark = ctx.rng.pick(marked);
    if (mark) asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'mutt', mark.id, true));
}

/**
 * §7 (audit): the Capitol will not crown a coward.
 *
 * A finalist who has reached the last few without drawing blood and has
 * not been in a fight for days is the one tribute the control room most
 * wants tested. Mutts to their zone, aimed — a fight they cannot walk
 * around, once per run. This is what turns "outlast everybody" from a
 * strategy into a gamble at the end, and it is the reason a bloodless
 * crown is rare rather than a third of all crowns.
 */
export function runBloodlessHunt(ctx: SimContext) {
    if (ctx.state.bloodlessHuntFired) return;
    const alive = getAlive(ctx.state);
    if (alive.length > ENDGAME.bloodlessHuntField || alive.length <= 1) return;
    const cycle = ctx.state.cycle ?? 0;
    const hiding = alive.filter(t => t.kills === 0
        && cycle - Math.max(0, ...Object.values(t.memory?.rivals ?? {}).map(r => r.lastFightCycle ?? 0)) >= ENDGAME.bloodlessHuntQuietCycles);
    if (hiding.length === 0) return;
    if (!ctx.rng.chance(ENDGAME.bloodlessHuntChance)) return;
    const mark = ctx.rng.pick(hiding);
    ctx.state.bloodlessHuntFired = true;
    ctx.logEvent(
        `${mark.name} has reached the last ${alive.length} without a drop of blood on their hands, and the Capitol has noticed. `
        + 'The Gamemakers do not crown people who hid. Something is released toward '
        + `${mark.zone}, and it is not looking for anybody else.`,
        [mark.id],
        { important: true, zone: mark.zone, category: 'gamemaker' }
    );
    asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'mutt', mark.id, true));
}

export function runGamemakerSignature(ctx: SimContext) {
    // Called from the same per-cycle hook, and deliberately ahead of the
    // once-per-run guard below: the grudge is a separate turn with its own
    // guard, not a variant of the signature.
    runBloodlessHunt(ctx);
    // A hands-off director does not take the booth's own turns.
    if (handsOffBooth(ctx.state)) return;
    runGrudgeIntervention(ctx);
    if (ctx.state.gamemakerSignatureFired) return;
    const alive = getAlive(ctx.state);
    // Not while the cast is still enormous, and not once it is down to the
    // finalists — this is the Head Gamemaker rescuing the middle of a run,
    // which is exactly the stretch the review found samey.
    if (alive.length > GAMEMAKER_AGENCY.maxFieldSize) return;
    if (alive.length <= ESCALATION.finalistCount) return;
    // §9.3: a Gamemaker with something to prove does not wait as long.
    const grudge = ctx.state.continuity?.grudge ?? 0;
    if (ctx.state.day < GAMEMAKER_AGENCY.earliestDay - grudge * CONTINUITY.grudgeEarlierDays) return;

    /*
     * AUDIT-12 wave 3 §11/§13: boredom is read off the crowd's segments, not
     * the single `audienceInterest` scalar. A crowd with no heat left in any
     * segment is bored; the unprompted draw is unchanged, so a run whose crowd
     * is warm plays exactly as it did.
     */
    const bored = crowdIsBored(ctx.state);
    if (!bored && !ctx.rng.chance(GAMEMAKER_AGENCY.unpromptedChance + grudge * CONTINUITY.grudgeUnpromptedBonus)) return;
    // The fairness guard: a booth that has already leaned this hard waits.
    if (!fairnessAllows(ctx.state)) return;

    const profile = gamemakerProfile(ctx.state.headGamemaker);
    ctx.state.gamemakerSignatureFired = true;
    addCruelty(ctx.state, 'signature', `${ctx.state.headGamemaker ?? 'the Head Gamemaker'}'s signature`);
    // The loudest segment gets a turn of its own first: blood for the
    // bloodthirsty, a table for the romantics, a gift for the underdog fans.
    answerLoudestSegment(ctx);
    ctx.logEvent(profile.signatureLine, [], { type: 'gamemaker-signatures', important: true, category: 'gamemaker' });

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
            const mark = ctx.rng.pickOrUndefined(alive);
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
            const favoured = ctx.rng.pickOrUndefined(alive);
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
                        cause: `Singled out for travelling in company in ${zone}`, kind: 'gamemaker', code: 'gamemaker',
                    });
                    loseSanity(t, GAMEMAKER_AGENCY.punishAllianceSanity);
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
            // Drawn, not sliced: in declaration order this was the Cornucopia
            // and the next few authored zones, the same ones every run.
            const low = ctx.rng.shuffle(ctx.state.arena.zones
                .filter(z => !(ctx.state.collapsedZones ?? []).includes(z.name))
                .filter(z => !zoneFeatures(z).elevation))
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

        case 'poison-the-wells': {
            const wells = ctx.state.arena.zones
                .filter(z => zoneFeatures(z).waterSource !== false && (z.terrain === 'water' || z.terrain === 'wetland'))
                .filter(z => !(ctx.state.collapsedZones ?? []).includes(z.name));
            if (wells.length === 0) break;
            wells.forEach(z => startZoneEffect(ctx, z.name, 'contaminated', false, GAMEMAKER_AGENCY.poisonWellsSeverity));
            ctx.logEvent(
                `Every drinking place in the arena — ${wells.map(z => z.name).join(', ')} — turns in the same minute. The cameras cut between the faces.`,
                [], { important: true, category: 'gamemaker' }
            );
            break;
        }

        case 'cull-the-weak': {
            // The zone whose occupants are, on average, closest to done.
            const byZone = new Map<string, Tribute[]>();
            alive.forEach(t => { byZone.set(t.zone, [...(byZone.get(t.zone) ?? []), t]); });
            let weakest: { zone: string; avg: number } | undefined;
            byZone.forEach((ts, zone) => {
                const avg = ts.reduce((s, t) => s + t.health, 0) / ts.length;
                if (!weakest || avg < weakest.avg) weakest = { zone, avg };
            });
            if (!weakest) break;
            const mark = byZone.get(weakest.zone)![0];
            ctx.logEvent(
                `The control room has been watching ${weakest.zone}, where the field is at its weakest. Cassius Brant calls it tidying.`,
                byZone.get(weakest.zone)!.map(t => t.id), { important: true, zone: weakest.zone, category: 'gamemaker' }
            );
            asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'mutt', mark.id, true));
            break;
        }

        case 'night-without-end': {
            ctx.state.blackoutUntilCycle = (ctx.state.cycle ?? 0) + GAMEMAKER_AGENCY.nightWithoutEndCycles;
            ctx.logEvent(
                'The sun does not come up. It is not scheduled to. Every tribute in the arena works out at the same moment that this is on purpose.',
                [], { important: true, category: 'gamemaker' }
            );
            break;
        }

        case 'seal-the-horn': {
            const horn = ctx.state.arena.zones[0];
            const inside = alive.filter(t => t.zone === horn.name);
            horn.adjacent.forEach(n => severEdge(ctx.state, horn.name, n));
            ctx.state.sealedHornUntilCycle = (ctx.state.cycle ?? 0) + GAMEMAKER_AGENCY.sealHornCycles;
            ctx.logEvent(
                `Every way into ${horn.name} closes at once — force fields, the same colour as the sky. ${inside.length > 0 ? `${inside.map(t => t.name).join(' and ')} ${inside.length === 1 ? 'is' : 'are'} inside it.` : 'Nobody is inside it, which is its own kind of message.'}`,
                inside.map(t => t.id), { important: true, zone: horn.name, category: 'gamemaker' }
            );
            break;
        }

        case 'reveal-all': {
            alive.forEach(watcher => alive.forEach(seen => {
                if (watcher.id !== seen.id) noteSighting(ctx.state, watcher, seen.zone, 1, 0);
            }));
            alive.forEach(t => { t.concealRevealed = true; });
            ctx.logEvent(
                'Every screen in the arena lights up with every tribute at once, live, named, placed. For one long afternoon nobody is hidden from anybody.',
                alive.map(t => t.id), { important: true, category: 'gamemaker' }
            );
            break;
        }

        case 'arm-the-underdog': {
            const ranked = [...alive].sort((a, b) => tributeOdds(a, alive).pct - tributeOdds(b, alive).pct);
            const underdog = ranked[0];
            if (!underdog) break;
            const weapons = ITEMS.filter(i => i.type === 'weapon' && (i.damage ?? 0) >= 4);
            const gift = mintItem(ctx.rng, ctx.rng.pick(weapons.length > 0 ? weapons : ITEMS.filter(i => i.type === 'weapon')), QUALITY_BIAS.parachute);
            giveItem(underdog, gift);
            underdog.sponsorTrust = Math.min(100, underdog.sponsorTrust + GAMEMAKER_AGENCY.favouredTrust);
            ctx.logEvent(
                `A parachute comes down for ${underdog.name} — the tribute the book rates worst — and there is ${itemPhrase(gift)} in it. Silvanus Reed has never explained this and does not start now.`,
                [underdog.id], { important: true, zone: underdog.zone, category: 'sponsor' }
            );
            break;
        }

        case 'call-a-truce': {
            // The two who hate each other most, made to keep the peace.
            let worst: { a: Tribute; b: Tribute; regard: number } | undefined;
            alive.forEach(a => alive.forEach(b => {
                if (a.id >= b.id) return;
                const regard = Math.min(getRel(a, b.id), getRel(b, a.id));
                if (!worst || regard < worst.regard) worst = { a, b, regard };
            }));
            if (!worst || worst.regard > GAMEMAKER_AGENCY.callTruceMinHatred) break;
            grantTruce(ctx, worst.a, worst.b, GAMEMAKER_AGENCY.callTruceCycles, 'brokered');
            ctx.logEvent(
                `The Capitol declares a truce between ${worst.a.name} and ${worst.b.name}, who would each rather die than keep it, and the arena will enforce it for ${GAMEMAKER_AGENCY.callTruceCycles} cycles. Calpurnia Vex finds the strain more interesting than the fight.`,
                [worst.a.id, worst.b.id], { important: true, category: 'gamemaker' }
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
    // Without the wrapper this was a no-op in every non-Gamemaker-mode run:
    // `triggerGamemakerEvent` returns early unless the booth is live.
    asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'mutt', t.id, true));
    addZoneThreat(ctx.state, t, t.zone, GAMEMAKER_AGENCY.favouriteThreat);
}
