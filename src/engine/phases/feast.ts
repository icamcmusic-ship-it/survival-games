import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { GameState, Item, Tribute } from '../../models/types';
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
import { hopsTo, severedEdgeSet } from '../map';
import { pickNeededGift } from '../sponsors';
import { isAggressiveStance, isEvasiveStance } from '../../data/stances';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/**
 * §10.6: what is on the table this time. Rolled when the feast is announced
 * (deterministically from seed+day) and said out loud, so a tribute can weigh
 * the risk against what is actually offered — a wounded tribute risks the
 * medical table; a well-fed Career shrugs at the food one.
 */
const FEAST_THEMES: Array<NonNullable<GameState['feastTheme']>> = ['weapons', 'medical', 'food', 'district-gifts'];

const THEME_ANNOUNCEMENTS: Record<NonNullable<GameState['feastTheme']>, string> = {
    weapons: 'The announcement is specific: a weapons cache. Steel on the table, and nothing to eat — the Gamemakers want a fight over the means of one.',
    medical: 'The announcement is specific: medicine. Kits, antidotes, dressings — everything a wound needs, laid out for whoever is desperate enough to come claim it.',
    food: 'The announcement is specific: a banquet. Bread, meat and clean water — the Gamemakers are betting on empty stomachs overruling good judgement.',
    'district-gifts': 'The announcement is specific: packs marked by district number, each holding the one thing its tribute needs most.',
};

export function announceFeastTheme(ctx: SimContext) {
    const rng = new RNG(`${ctx.state.seed}-feast-theme-${ctx.state.day}`);
    ctx.state.feastTheme = rng.pick(FEAST_THEMES);
    ctx.logEvent(THEME_ANNOUNCEMENTS[ctx.state.feastTheme], [], { important: true, category: 'feast' });
}

/** The loot pool the announced theme actually lays out. */
function themedPool(theme: GameState['feastTheme']): Item[] {
    switch (theme) {
        case 'weapons': return ITEMS.filter(i => i.type === 'weapon' || i.type === 'armour');
        case 'medical': return ITEMS.filter(i => i.type === 'medical');
        case 'food': return ITEMS.filter(i => i.type === 'food' || i.type === 'water');
        default: return ITEMS;
    }
}

export function processFeast(ctx: SimContext) {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-feast`);
    const alive = getAlive(ctx.state);
    const attendees = [] as typeof alive;
    const cornucopia = ctx.state.arena.zones[0]?.name ?? 'The Cornucopia';

    ctx.state.feastsHeld = (ctx.state.feastsHeld ?? 0) + 1;
    // Consumed: leaving this set kept the 'feast' objective pulling the whole
    // cast toward the Cornucopia for the rest of the run.
    ctx.state.feastDay = undefined;
    ctx.state.lastFeastDay = ctx.state.day;
    // §10.6: the table the announcement promised. Consumed here, defaulting
    // to the classic district packs for feasts announced before themes existed.
    const theme = ctx.state.feastTheme ?? 'district-gifts';
    ctx.state.feastTheme = undefined;
    const tablePool = themedPool(theme);
    const themedGift = (t: Tribute) =>
        mintItem(ctx.rng, theme === 'district-gifts' ? pickNeededGift(ctx, t, ITEMS) : pickNeededGift(ctx, t, tablePool), QUALITY_BIAS.feast);

    const decliners = [] as typeof alive;
    const strandedFar = [] as typeof alive;
    const collapsed = ctx.state.collapsedZones ?? [];
    const severed = severedEdgeSet(ctx.state);
    alive.forEach(t => {
        // The feast was announced a day ago and the journey was real: anyone
        // still more than two hops out did not make it, whatever they wanted.
        const hops = hopsTo(ctx.state.arena, t.zone, cornucopia, collapsed, severed);
        if (hops === undefined || hops > 2) {
            strandedFar.push(t);
            return;
        }
        // Desperation still overrides everything — a starving tribute goes.
        if (t.vitals.hunger > FEAST.desperateHunger || t.vitals.thirst > FEAST.desperateThirst) {
            attendees.push(t);
            return;
        }
        if (ctx.rng.chance(attendanceChance(t, alive, theme))) attendees.push(t);
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
    if (strandedFar.length > 0) {
        ctx.logEvent(
            `${strandedFar.map(t => t.name).join(', ')} ${strandedFar.length > 1 ? 'are' : 'is'} too far out to reach the Cornucopia before the table is withdrawn.`,
            strandedFar.map(t => t.id),
            { category: 'feast' }
        );
    }
    attendees.forEach(t => { t.zone = cornucopia; });
    announce(attendees, FEAST_TEXTS.attend, names => `${names} break cover and converge on the Cornucopia.`);
    if (attendees.length > 0) {
        // Canon's defining feast image, themed: what the announcement
        // promised is what is actually on the table.
        const tableLines: Record<typeof theme, string> = {
            weapons: 'On the table: racked steel and stacked armour, and not a crumb of food anywhere on it.',
            medical: 'On the table: kits, vials and dressings, laid out like an infirmary with the walls taken away.',
            food: 'On the table: bread still warm, meat, and clean water in sealed flasks.',
            'district-gifts': 'On the table sit packs marked by district number. Whatever each tribute needs most, the Gamemakers have packed it.',
        };
        ctx.logEvent(tableLines[theme], [], { zone: cornucopia, category: 'feast' });
    }

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
            // Their own district pack: the thing they actually need, per the
            // same need arithmetic the sponsor stream uses.
            const minted = themedGift(t);
            giveItem(t, minted);
            t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
            t.vitals.thirst = Math.max(0, t.vitals.thirst - 40);
            clampTribute(t);
            ctx.logEvent(`${t.name} leaves the feast with the District ${t.district} pack — ${itemPhrase(minted)} — and a full stomach.`, [t.id], { zone: cornucopia, category: 'feast' });
        });
    }

    else if (shuffled.length === 1) {
        const winner = shuffled[0];
        // Their own pack, plus whichever of the unclaimed ones suits them best.
        const item1 = themedGift(winner);
        const item2 = themedGift(winner);
        giveItem(winner, item1, item2);
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
function attendanceChance(t: Tribute, alive: Tribute[], theme: NonNullable<GameState['feastTheme']> = 'district-gifts'): number {
    let chance = FEAST.baseAttendChance;
    const arch = ARCHETYPES[t.archetype];

    chance += arch.aggression * FEAST.aggressionDraw;
    chance -= arch.caution * FEAST.aggressionDraw;
    if (t.health < 50) chance -= FEAST.woundedDeterrent;

    // §10.6: the announced table changes the calculus. A medical feast is
    // worth the wounded tribute's risk; a weapons cache draws the unarmed and
    // bores the well-equipped; a banquet pulls hardest on empty stomachs.
    // balance-exempt: same wounded band the deterrent line above already uses
    const wounded = t.health < 50 || t.injuries.bleeding || t.injuries.infected || t.injuries.poisoned;
    if (theme === 'medical' && wounded) chance += FEAST.woundedDeterrent + FEAST.medicalThemeWoundedDraw;
    if (theme === 'weapons') {
        chance += t.inventory.some(i => i.type === 'weapon')
            ? -FEAST.weaponsThemeArmedDeter
            : FEAST.weaponsThemeUnarmedDraw;
    }
    // balance-exempt: same hunger band the ally supply-sharing logic uses; the draw weight is the knob
    if (theme === 'food' && t.vitals.hunger > 40) chance += FEAST.foodThemeHungerDraw;
    if (isEvasiveStance(t.stance)) chance -= 0.15;
    if (isAggressiveStance(t.stance)) chance += 0.15;

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
