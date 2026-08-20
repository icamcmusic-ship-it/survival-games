import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ARCHETYPES } from '../../data/archetypes';
import { FEAST } from '../../data/balance';
import { resolveCombat, resolveGroupCombat } from '../combat';
import { FEAST_TEXTS } from '../../data/flavorText';
import { clampTribute } from '../vitals';
import { giveItem, itemPhrase } from '../items';
import { getRel } from '../relationships';
import { hasVengeanceAgainst, noteSighting } from '../memory';
import { mintItem } from '../items';
import { QUALITY_BIAS } from '../../data/balance';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export function processFeast(ctx: SimContext) {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-feast`);
    const alive = getAlive(ctx.state);
    const attendees = [] as typeof alive;
    const cornucopia = ctx.state.arena.zones[0]?.name ?? 'The Cornucopia';

    ctx.state.feastsHeld = (ctx.state.feastsHeld ?? 0) + 1;

    const decliners = [] as typeof alive;
    alive.forEach(t => {
        // Desperation still overrides everything — a starving tribute goes.
        if (t.vitals.hunger > FEAST.desperateHunger || t.vitals.thirst > FEAST.desperateThirst) {
            attendees.push(t);
            return;
        }
        if (ctx.rng.chance(attendanceChance(t, alive))) attendees.push(t);
        else decliners.push(t);
    });

    // One line per tribute turned the feed into a wall of near-identical
    // sentences; past a couple of names these are summarised instead.
    const announce = (group: typeof alive, pool: string[], summary: (names: string) => string) => {
        if (group.length === 0) return;
        if (group.length <= 2) {
            group.forEach(t => ctx.logEvent(
                fill(ctx.pickText(pool), { tribute: t.name }),
                [t.id],
                { zone: cornucopia, category: 'feast' }
            ));
        } else {
            ctx.logEvent(summary(group.map(t => t.name).join(', ')), group.map(t => t.id), { zone: cornucopia, category: 'feast' });
        }
    };

    announce(decliners, FEAST_TEXTS.decline, names => `${names} weigh the feast against the odds and stay exactly where they are.`);
    attendees.forEach(t => { t.zone = cornucopia; });
    announce(attendees, FEAST_TEXTS.attend, names => `${names} break cover and converge on the Cornucopia.`);

    if (attendees.length === 0) {
        ctx.logEvent('Not one tribute comes to the feast. The table sits untouched until the Gamemakers withdraw it.', [], { important: true, category: 'feast' });
        return;
    }

    const shuffled = ctx.rng.shuffle(attendees);
    // Everyone at the table sees everyone else at the table.
    attendees.forEach(t => noteSighting(ctx.state, t, cornucopia, attendees.length - 1, 0));

    // Bounded, for the same reason as the bloodbath: an unkillable pairing
    // (mutual draws, or star-crossed lovers) must not spin forever.
    let rounds = shuffled.length * 6 + 12;
    while (shuffled.length > 1 && rounds-- > 0) {
        if (shuffled.length >= 3 && ctx.rng.chance(0.4)) {
            const party = shuffled.splice(0, 3);
            resolveGroupCombat(ctx, party);
            party.forEach(t => { if (t.status === 'alive' && ctx.rng.chance(0.5)) shuffled.push(t); });
            continue;
        }

        const t1 = shuffled.splice(ctx.rng.nextInt(0, shuffled.length - 1), 1)[0];
        const t2 = shuffled.splice(ctx.rng.nextInt(0, shuffled.length - 1), 1)[0];

        // Allies who both showed up do not fight over the table.
        const allied = t1.allianceId !== undefined && t1.allianceId === t2.allianceId;
        if (allied && !hasVengeanceAgainst(t1, t2.id) && !hasVengeanceAgainst(t2, t1.id)) {
            ctx.logEvent(
                `${t1.name} and ${t2.name} load up together and cover each other on the way out.`,
                [t1.id, t2.id],
                { zone: cornucopia, category: 'alliance' }
            );
            [t1, t2].forEach(t => {
                t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
                t.vitals.thirst = Math.max(0, t.vitals.thirst - 40);
                clampTribute(t);
            });
            continue;
        }

        resolveCombat(ctx, t1, t2);
        // A draw usually means they break off rather than immediately
        // re-engaging the same opponent.
        if (t1.status === 'alive' && ctx.rng.chance(0.55)) shuffled.push(t1);
        if (t2.status === 'alive' && ctx.rng.chance(0.55)) shuffled.push(t2);
    }

    if (shuffled.length > 1) {
        ctx.logEvent(
            `${shuffled.map(t => t.name).join(' and ')} take what they can carry and back away from the Cornucopia without settling it.`,
            shuffled.map(t => t.id),
            { important: true, zone: cornucopia, category: 'feast' }
        );
        shuffled.splice(1).forEach(t => {
            const item = ctx.rng.pick(ITEMS);
            giveItem(t, mintItem(ctx.rng, item, QUALITY_BIAS.feast));
            t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
            t.vitals.thirst = Math.max(0, t.vitals.thirst - 40);
            clampTribute(t);
            ctx.logEvent(`${t.name} leaves the feast with ${itemPhrase(item)} and a full stomach.`, [t.id], { zone: cornucopia, category: 'feast' });
        });
    }

    if (shuffled.length === 1) {
        const winner = shuffled[0];
        const item1 = ctx.rng.pick(ITEMS);
        const item2 = ctx.rng.pick(ITEMS);
        giveItem(winner, { ...item1 }, { ...item2 });
        winner.health = Math.min(100, winner.health + 50);
        winner.vitals.hunger = 0;
        winner.vitals.thirst = 0;
        clampTribute(winner);
        ctx.logEvent(
            fill(ctx.pickText(FEAST_TEXTS.claim), { tribute: winner.name, items: `${item1.name} and ${item2.name}` }),
            [winner.id],
            { important: true, zone: cornucopia, category: 'feast' }
        );
    }
}

/**
 * Feast attendance, wired into the relationship graph.
 *
 * Attendance used to be a flat coin flip plus a hunger override, structurally
 * isolated from every social system in the game — so a tribute would stroll
 * into the Cornucopia alone while their whole alliance sat it out, and a
 * tribute who had sworn to kill someone would happily skip the one event that
 * guarantees the target's location.
 */
function attendanceChance(t: Tribute, alive: Tribute[]): number {
    let chance = FEAST.baseAttendChance;
    const arch = ARCHETYPES[t.archetype];

    chance += arch.aggression * FEAST.aggressionDraw;
    chance -= arch.caution * FEAST.aggressionDraw;
    if (t.health < 50) chance -= FEAST.woundedDeterrent;
    if (t.stance === 'Evasive') chance -= 0.15;
    if (t.stance === 'Aggressive') chance += 0.15;

    alive.forEach(other => {
        if (other.id === t.id) return;
        const rel = getRel(t, other.id);
        const allied = t.allianceId !== undefined && t.allianceId === other.allianceId;
        // Trusted allies go together — the table is safer with backup.
        if (allied || rel > 40) chance += FEAST.allyDrawWeight;
        // Rivals are a reason to stay in the trees, unless you want them dead.
        else if (rel < -30) {
            chance += hasVengeanceAgainst(t, other.id) ? FEAST.rivalDeterWeight : -FEAST.rivalDeterWeight;
        }
    });

    return Math.max(0.05, Math.min(0.95, chance));
}
