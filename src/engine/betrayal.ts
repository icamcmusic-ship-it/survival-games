import { Tribute } from '../models/types';
import { ALLIANCE_TEXTS } from '../data/flavorText';
import { BETRAYAL, MEMORY, RELATIONSHIPS, SUSPICION } from '../data/balance';
import { SimContext } from './context';
import { resolveCombat } from './combat';
import { allianceOf, cacheValue, emptyCache } from './alliance';
import { addZoneThreat, noteContact, raiseSuspicion, rememberedThreat, suspicionOf } from './memory';
import { giveItem } from './items';
import { reachableZones, severedEdgeSet } from './map';
import { adjustRel, applyBetrayalFallout } from './relationships';
import { addExcitement } from './audience';

/**
 * Betrayal, in more than one shape.
 *
 * The targeting logic was already good — genuinely opportunistic, weighing the
 * payday, the grudge and how winnable the fight is — but the only thing it could
 * ever express was "attack them now". Every betrayal in the game therefore read
 * the same, and the epilogue could only ever say the same thing about it.
 *
 * These are the other ways a person sells someone out. Each produces a distinct
 * chronicle line, and each leaves a different mark: a thief is still in the
 * alliance afterwards, a deserter is not, and someone who withheld medicine has
 * done something the victim may not even know about yet.
 */

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export type BetrayalKind = 'knife' | 'steal' | 'lure' | 'abandon' | 'withhold';

/** Which forms are actually available given the situation the pair are in. */
function availableKinds(ctx: SimContext, betrayer: Tribute, victim: Tribute): BetrayalKind[] {
    const kinds: BetrayalKind[] = ['knife'];
    const record = allianceOf(ctx.state, betrayer.allianceId);

    if (cacheValue(record) >= BETRAYAL.minCacheValueToSteal) kinds.push('steal');

    // Leading someone somewhere lethal requires the betrayer to actually know
    // the place is lethal — which is exactly what zone memory already tracks.
    const options = reachableZones(ctx.state.arena, betrayer.zone, ctx.state.collapsedZones ?? [], severedEdgeSet(ctx.state));
    if (options.some(z => rememberedThreat(ctx.state, betrayer, z.name) >= BETRAYAL.lureMinRememberedThreat)) {
        kinds.push('lure');
    }

    if (victim.health < BETRAYAL.withholdMaxHealth
        && (victim.injuries.bleeding || victim.injuries.infected || victim.injuries.poisoned)
        && betrayer.inventory.some(i => i.type === 'medical')
        // You only ask the person you still believe. Once suspicion has taken
        // hold, the ask never happens — which is also what stops the same pair
        // replaying this beat every cycle.
        && suspicionOf(victim, betrayer.id) < SUSPICION.departThreshold) {
        kinds.push('withhold');
    }

    // Abandoning is only a betrayal if there is something to abandon them to.
    if (victim.health < 60 || victim.injuries.bleeding) kinds.push('abandon');

    return kinds;
}

function pickKind(ctx: SimContext, kinds: BetrayalKind[]): BetrayalKind {
    const weights = kinds.map(k => BETRAYAL.weights[k]);
    let roll = ctx.rng.nextFloat() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < kinds.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return kinds[i];
    }
    return kinds[kinds.length - 1];
}

/**
 * Carries out one betrayal. Returns the kind chosen so the caller can log
 * around it if it wants to.
 */
export function resolveBetrayal(ctx: SimContext, betrayer: Tribute, victim: Tribute, members: Tribute[]): BetrayalKind {
    const kind = pickKind(ctx, availableKinds(ctx, betrayer, victim));
    const record = allianceOf(ctx.state, betrayer.allianceId);
    noteContact(ctx.state, betrayer, victim);

    switch (kind) {
        case 'steal': {
            // The quiet one. They take the group's supplies and are simply gone
            // in the morning — no cannon, no fight, and a pack that wakes up
            // with nothing.
            const spoils = record ? emptyCache(record) : [];
            const dropped = giveItem(betrayer, ...spoils);
            applyBetrayalFallout(ctx, betrayer, victim, members);
            delete betrayer.allianceId;
            ctx.logEvent(
                `${betrayer.name} waits until the others are asleep, empties the group's stash in ${betrayer.zone}, and walks. ` +
                `${victim.name} wakes to find ${spoils.length > 0 ? `the ${spoils.map(i => i.name).join(', ')} gone` : 'nothing but the shape of where they had been lying'}.`,
                [betrayer.id, victim.id],
                { important: true, category: 'betrayal' }
            );
            if (dropped.length > 0) {
                ctx.logEvent(
                    `${betrayer.name} cannot carry all of it and leaves ${dropped.map(i => i.name).join(', ')} scattered behind them.`,
                    [betrayer.id],
                    { category: 'loot' }
                );
            }
            return kind;
        }

        case 'lure': {
            // Sending someone somewhere you know people have died. No blood on
            // the betrayer's hands, which is the point of doing it this way.
            const options = reachableZones(ctx.state.arena, betrayer.zone, ctx.state.collapsedZones ?? [], severedEdgeSet(ctx.state));
            const deathTrap = options
                .filter(z => rememberedThreat(ctx.state, betrayer, z.name) >= BETRAYAL.lureMinRememberedThreat)
                .sort((a, b) => rememberedThreat(ctx.state, betrayer, b.name) - rememberedThreat(ctx.state, betrayer, a.name))[0];
            if (!deathTrap) return resolveKnife(ctx, betrayer, victim, members);

            victim.zone = deathTrap.name;
            // The victim does not know why they are there; the betrayer does.
            addZoneThreat(ctx.state, betrayer, deathTrap.name, MEMORY.hazardThreat);
            applyBetrayalFallout(ctx, betrayer, victim, members);
            delete betrayer.allianceId;
            ctx.logEvent(
                `${betrayer.name} tells ${victim.name} there is water in ${deathTrap.name}, and watches them go. ` +
                `${betrayer.name} knows exactly what happened in ${deathTrap.name}.`,
                [betrayer.id, victim.id],
                { zone: deathTrap.name, important: true, category: 'betrayal' }
            );
            return kind;
        }

        case 'withhold': {
            // The betrayal of omission. The victim may never find out, so the
            // relationship hit is smaller — but they are still bleeding. No
            // vengeance sworn, no fallout ledger: the victim has nothing but a
            // refusal and a feeling, so what they get is suspicion — the thing
            // §4.2 exists to track — not certainty.
            const med = betrayer.inventory.find(i => i.type === 'medical')!;
            adjustRel(victim, betrayer.id, -RELATIONSHIPS.betrayalDirectPenalty / 2);
            raiseSuspicion(victim, betrayer.id, SUSPICION.perWitnessedBetrayal);
            addExcitement(betrayer, 15);
            ctx.logEvent(
                `${victim.name} asks ${betrayer.name} for the ${med.name}. ${betrayer.name} says they used it days ago, ` +
                `and keeps their hand over the pocket it is in.`,
                [betrayer.id, victim.id],
                { important: true, category: 'betrayal' }
            );
            return kind;
        }

        case 'abandon': {
            // Walking away from someone who needed you there.
            applyBetrayalFallout(ctx, betrayer, victim, members);
            delete betrayer.allianceId;
            const away = reachableZones(ctx.state.arena, betrayer.zone, ctx.state.collapsedZones ?? [], severedEdgeSet(ctx.state))
                .filter(z => z.name !== betrayer.zone);
            if (away.length > 0) betrayer.zone = ctx.rng.pick(away).name;
            ctx.logEvent(
                `${victim.name} calls out for ${betrayer.name} in ${victim.zone}. ${betrayer.name} hears it, and keeps walking.`,
                [betrayer.id, victim.id],
                { important: true, category: 'betrayal' }
            );
            return kind;
        }

        default:
            return resolveKnife(ctx, betrayer, victim, members);
    }
}

/** The original: the knife, and the fight that follows it. */
function resolveKnife(ctx: SimContext, betrayer: Tribute, victim: Tribute, members: Tribute[]): BetrayalKind {
    ctx.logEvent(
        fill(ctx.pickText(ALLIANCE_TEXTS.betray), { betrayer: betrayer.name, victim: victim.name, zone: betrayer.zone }),
        [betrayer.id, victim.id],
        { important: true, category: 'betrayal' }
    );
    applyBetrayalFallout(ctx, betrayer, victim, members);
    delete betrayer.allianceId;
    resolveCombat(ctx, betrayer, victim, false, true);
    return 'knife';
}
