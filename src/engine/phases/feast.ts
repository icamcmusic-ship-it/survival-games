import { forceTriangleChoice } from '../triangles';
import { SimContext, getAlive } from '../context';
import { tickRunRecords } from '../runRecords';
import { RNG } from '../../utils/rng';
import { EventType, GameState, Item, Tribute } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ARCHETYPES } from '../../data/archetypes';
import { FEAST, POISONING, PRE_ARENA, TRAINING_FLOOR } from '../../data/balance';
import { resolveCombat, resolveGroupCombat } from '../combat';
import { FEAST_TEXTS } from '../../data/flavorText';
import { clampTribute } from '../vitals';
import { consumeOne, giveItem, itemPhrase, itemPoolFor } from '../items';
import { applyDamage, checkDeath } from '../combat';
import { injure } from '../wounds';
import { traitMod } from '../../data/traits';
import { cycleOf } from '../memory';
import { adjustRel, getRel } from '../relationships';
import { addFear } from '../fear';
import { advanceCycle, hasVengeanceAgainst, noteSighting } from '../memory';
import { mintItem } from '../items';
import { QUALITY_BIAS } from '../../data/balance';
import { hopsTo, severedEdgeSet } from '../map';
import { pickNeededGift } from '../sponsors';
import { isAggressiveStance, isEvasiveStance } from '../../data/stances';
import { loseSanity } from '../sanityBands';
import { isActive } from '../downed';
import { decayUpkeep, postActionUpkeep, preActionUpkeep } from './upkeep';

/**
 * The global attribute ceiling, borrowed as a normaliser: arrival order needs
 * speed as a fraction of the fastest anybody can be, not as raw points.
 */
const TRIBUTE_ATTRIBUTE_CEILING = TRAINING_FLOOR.attributeCeiling;

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/**
 * §10.6: what is on the table this time. Rolled when the feast is announced
 * (deterministically from seed+day) and said out loud, so a tribute can weigh
 * the risk against what is actually offered — a wounded tribute risks the
 * medical table; a well-fed Career shrugs at the food one.
 */
const FEAST_THEMES: Array<NonNullable<GameState['feastTheme']>> = [
    'weapons', 'medical', 'food', 'district-gifts',
    // Audit 3 §5.4: four more. The feast is the single most anticipated
    // scheduled event in the format and it had four flavours, so a player who
    // has watched ten runs has seen every table there is. None of these needs a
    // new mechanic — each is a different pool, a different announcement, and a
    // different answer to the only question the feast poses, which is whether
    // to go.
    'single-pack', 'tokens', 'fieldcraft', 'empty',
];

const THEME_ANNOUNCEMENTS: Record<NonNullable<GameState['feastTheme']>, string> = {
    weapons: 'The announcement is specific: a weapons cache. Steel on the table, and nothing to eat — the Gamemakers want a fight over the means of one.',
    medical: 'The announcement is specific: medicine. Kits, antidotes, dressings — everything a wound needs, laid out for whoever is desperate enough to come claim it.',
    food: 'The announcement is specific: a banquet. Bread, meat and clean water — the Gamemakers are betting on empty stomachs overruling good judgement.',
    'district-gifts': 'The announcement is specific: packs marked by district number, each holding the one thing its tribute needs most.',
    'single-pack': 'The announcement is specific, and short: one pack. Not one each — one. The Gamemakers do not say what is in it, and they do not have to.',
    tokens: 'The announcement is specific and nobody believes it at first: the tokens. Every keepsake taken at the reaping, laid out on the table, and nothing else. It is worth nothing. Everybody comes anyway.',
    fieldcraft: 'The announcement is specific: rope, wire, flint, needles, line. Nothing on that table will kill anybody, and everything on it is the difference between a week and a fortnight.',
    empty: 'The announcement is specific: a feast, at the Cornucopia, at first light. It is the fourth thing the Gamemakers have said all week and the only one anybody acts on.',
};

export function announceFeastTheme(ctx: SimContext, quietly = false) {
    const rng = new RNG(`${ctx.state.seed}-feast-theme-${ctx.state.day}`);
    ctx.state.feastTheme = rng.pick(FEAST_THEMES);
    // The Feast Quell lays a table every night; after the first proclamation
    // the theme is still rolled and the packs still named, but the Capitol
    // does not re-read the announcement to a field that already knows it.
    if (!quietly) ctx.logEvent(THEME_ANNOUNCEMENTS[ctx.state.feastTheme], [], { important: true, category: 'feast' });
    nameFeastPrizes(ctx);
}

/**
 * §6.4: one pack per living tribute, with their name on it.
 *
 * The feast's whole hold over the cast in the source material is that the
 * table is personal — it is not loot, it is *your* pack, and everybody knows
 * which one is yours. Here it was an anonymous pile that produced a `pickNeededGift`
 * roll for whoever survived the scrum, so declining cost nothing and arriving
 * meant nothing in particular. Named packs are what make both of those
 * decisions have a shape.
 */
function nameFeastPrizes(ctx: SimContext) {
    ctx.state.feastPrizes = getAlive(ctx.state).map(t => ({
        tributeId: t.id,
        // The token is the cruel touch and the Gamemakers know it: the one
        // thing from home, packed by people who took it off them at the reaping.
        label: t.token
            ? `a pack marked ${t.name.toUpperCase()}, D${t.district} — and pinned to the flap, ${t.token}`
            : `a pack marked ${t.name.toUpperCase()}, D${t.district}`,
    }));
}

/** The loot pool the announced theme actually lays out. */
function themedPool(theme: GameState['feastTheme']): Item[] {
    switch (theme) {
        case 'weapons': return ITEMS.filter(i => i.type === 'weapon' || i.type === 'armour');
        case 'medical': return ITEMS.filter(i => i.type === 'medical');
        case 'food': return ITEMS.filter(i => i.type === 'food' || i.type === 'water');
        // Audit 3 §5.4: everything that keeps somebody alive and nothing that
        // ends anybody. A tribute who walks away from this table with a coil of
        // wire has just got a week, which is a harder call than it sounds.
        case 'fieldcraft': return ITEMS.filter(i => i.type === 'utility' || i.type === 'tool');
        // One pack on an empty table, so the pool does not matter much — what
        // matters is that there is one of it.
        case 'single-pack': return ITEMS.filter(i => i.type !== 'food' && i.type !== 'water');
        default: return ITEMS;
    }
}

/**
 * §6.4: the packs come off the table, and it matters whose they were.
 *
 * Claiming your own is a small, grim relief. Taking one with somebody else's
 * name on it is a different act entirely — it is theft from a named person who
 * is going to arrive and find the gap — and the two used to be the same
 * `giveItem` call with the same sentence attached.
 */
/**
 * §7: "The Tamper" — poisoning the table before anybody else arrives.
 *
 * The feast's whole shape is a head start: whoever gets there first has the
 * unclaimed packs to themselves for a while. Until now the only thing that
 * head start could buy was more supplies. This is the other thing a person
 * standing alone over somebody else's food can do with it, and it is the
 * intersection of a social betrayal and a cause of death — the tamperer is
 * usually two zones away by the time it resolves.
 *
 * Gated on a tribute who actually has something to do it with (a poison
 * source in their pack) and on disposition, so it stays a character beat
 * rather than a tax on arriving late.
 */
function tamperWithFeast(ctx: SimContext, early: Tribute[], cornucopia: string) {
    const remaining = ctx.state.feastPrizes ?? [];
    if (remaining.length === 0) return;
    const candidates = early.filter(t =>
        t.status === 'alive'
        && POISONING.sources.some(id => t.inventory.some(i => i.id === id)));
    if (candidates.length === 0) return;

    const actor = candidates
        .map(t => ({ t, appetite: ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery') }))
        .sort((a, b) => b.appetite - a.appetite)[0];
    if (!ctx.rng.chance(Math.min(0.9, PRE_ARENA.feastTamperBaseChance + actor.appetite * PRE_ARENA.feastTamperPerTreachery))) return;

    const source = POISONING.sources.find(id => actor.t.inventory.some(i => i.id === id))!;
    consumeOne(actor.t, i => i.id === source);
    ctx.state.feastTampering = [...(ctx.state.feastTampering ?? []), { byId: actor.t.id, cycle: cycleOf(ctx.state) }];
    // Deliberately not witnessed: the entire value of the act is that it is
    // done while nobody who will eat it is standing there.
    ctx.logEvent(
        `${actor.t.name} has the table to themselves for a minute longer than anyone realises, and spends it working something out of their own pack into the packs that are left.`,
        [actor.t.id],
        { important: true, zone: cornucopia, category: 'betrayal' }
    );
}

function claimPacks(
    ctx: SimContext,
    arrivals: Tribute[],
    cornucopia: string,
    themedGift: (t: Tribute) => Item,
    claimed: Set<string>,
    /**
     * Audit 3 §5.4: a `tokens` or `empty` table. Everything about the feast
     * happens — the journey, the arrival order, the scrum, the fighting — and
     * nobody leaves holding anything.
     */
    barren = false,
) {
    arrivals.forEach(t => {
        if (t.status !== 'alive') return;
        const prizes = ctx.state.feastPrizes ?? [];
        const own = prizes.find(p => p.tributeId === t.id);
        const others = prizes.filter(p => p.tributeId !== t.id);
        const takeSomebodyElses = others.length > 0
            && (!own || ctx.rng.chance(PRE_ARENA.feastStealPackChance));
        const prize = takeSomebodyElses ? ctx.rng.pick(others) : own;
        if (!prize) return;

        ctx.state.feastPrizes = prizes.filter(p => p !== prize);
        claimed.add(t.id);
        if (barren) {
            // The pack is theirs and it is worth nothing. `feastPrizeTaken` is
            // still written, because who took whose is still the story.
            t.feastPrizeTaken = prize.tributeId;
            ctx.logEvent(
                takeSomebodyElses
                    ? `${t.name} picks up somebody else's keepsake off the table in ${cornucopia}, looks at it, and pockets it anyway. There is nothing else to take and they came a long way.`
                    : `${t.name} finds their own token on the table in ${cornucopia} and closes their hand round it. It is worth nothing. They crossed the arena for it.`,
                [t.id],
                { zone: cornucopia, category: 'feast' }
            );
            return;
        }
        const minted = themedGift(t);
        giveItem(t, minted);
        // AUDIT-9 B13: only what the pack actually contained feeds them.
        eatAtTable(ctx, t, [minted]);

        // §7: whoever tampered with the table is long gone; the pack is not.
        const tampering = (ctx.state.feastTampering ?? []).find(x => x.byId !== t.id);
        if (tampering && !t.injuries.poisoned) {
            const tamperer = ctx.state.tributes.find(o => o.id === tampering.byId);
            injure(t, 'poisoned');
            const cause = tamperer ? `Poisoned at the feast by ${tamperer.name}` : 'Poisoned at the feast';
            applyDamage(ctx, t, PRE_ARENA.feastTamperDamage, tamperer
                ? { cause, sourceId: tamperer.id, kind: 'tribute', code: 'tribute' }
                : { cause, kind: 'hazard', code: 'poison' });
            ctx.logEvent(
                `${t.name} eats out of the pack they just took off the table in ${cornucopia}, and something in it is wrong. They work out roughly when, and never work out who.`,
                [t.id],
                { important: true, zone: cornucopia, category: 'betrayal' }
            );
            clampTribute(t);
            checkDeath(ctx, t, cause);
            if (t.status !== 'alive' && tamperer && tamperer.status === 'alive') tamperer.kills += 1;
        }
        clampTribute(t);
        if (t.status !== 'alive') return;

        // Audit 3 §1.6: recorded for both outcomes, not only for theft.
        // 'Took the Marked Pack' asks for a victor who claimed the pack with
        // their *own* name on it (`feastPrizeTaken === v.id`), and this field
        // was only ever written inside the branch below — the one that runs
        // when the pack belongs to somebody else. The achievement was testing
        // for a value the engine had no path to write, and never fired.
        t.feastPrizeTaken = prize.tributeId;

        if (!takeSomebodyElses) {
            ctx.logEvent(
                `${t.name} finds ${prize.label} and takes it off the table without looking up — ${itemPhrase(minted)}.`,
                [t.id],
                { zone: cornucopia, category: 'feast' }
            );
            return;
        }

        const victim = ctx.state.tributes.find(o => o.id === prize.tributeId);
        ctx.logEvent(
            `${t.name} takes ${prize.label}. It is not theirs and they take it anyway — ${itemPhrase(minted)} — and the Capitol will have that on three cameras.`,
            victim ? [t.id, victim.id] : [t.id],
            { important: true, zone: cornucopia, category: 'feast' }
        );
        if (!victim || victim.status !== 'alive') return;
        // Finding the space where your own name should have been is worse than
        // never having been offered anything.
        loseSanity(victim, PRE_ARENA.feastPackLostSanity);
        clampTribute(victim);
        adjustRel(victim, t.id, -PRE_ARENA.feastPackLostSanity);
        addFear(victim, t.id, PRE_ARENA.feastPackLostSanity, t);
        ctx.logEvent(
            `${victim.name} works out, from the gap in the row and the name still printed beside it, that ${t.name} has walked off with the one thing on that table that was theirs.`,
            [victim.id, t.id],
            { type: 'hidden-moments', important: true, zone: cornucopia, category: 'sanity' }
        );
    });
}

/**
 * AUDIT-9 B13: recovery has to have a physical cause.
 *
 * Every branch of the feast used to hand out a flat `hunger -= 40; thirst -=
 * 40` for having been at the table, whatever was on it. Reproduced: a
 * weapons-only table — which the announcement explicitly describes as "not a
 * crumb of food anywhere on it" — took hunger and thirst from 100 to 60 on
 * every tribute who walked away with a sword. The feast was quietly the
 * strongest food source in the game and the announced tradeoff was a lie.
 *
 * Nourishment now comes from provisions that actually exist: the food and
 * water the table laid out (which is theme-dependent and can be nothing at
 * all), plus whatever the tribute eats out of their own pack while they are
 * standing somewhere safe enough to. A weapons table feeds nobody; a banquet
 * feeds everybody; a district pack feeds you if the Gamemakers packed food in
 * it, which is what `pickNeededGift` decides.
 *
 * Returns what was actually eaten and drunk, for the narration.
 */
function eatAtTable(ctx: SimContext, t: Tribute, provisions: Item[]): { ate: boolean; drank: boolean } {
    let ate = false;
    let drank = false;
    const take = (kind: 'food' | 'water') => {
        // The table first: a gift they have just been handed is right there.
        const offered = provisions.find(i => i.type === kind);
        if (offered) {
            if (kind === 'food') t.vitals.hunger = Math.max(0, t.vitals.hunger - FEAST.mealHunger);
            else t.vitals.thirst = Math.max(0, t.vitals.thirst - FEAST.mealThirst);
            return true;
        }
        // Otherwise their own pack, which is a real cost: the ration is gone.
        const own = consumeOne(t, i => i.type === kind);
        if (!own) return false;
        if (kind === 'food') t.vitals.hunger = Math.max(0, t.vitals.hunger - FEAST.packMealHunger);
        else t.vitals.thirst = Math.max(0, t.vitals.thirst - FEAST.packMealThirst);
        return true;
    };
    if (t.vitals.hunger > 0) ate = take('food');
    if (t.vitals.thirst > 0) drank = take('water');
    clampTribute(t);
    return { ate, drank };
}

/** One line for what the table did or did not do for somebody's stomach. */
function mealNote(fed: { ate: boolean; drank: boolean }): string {
    if (fed.ate && fed.drank) return 'They eat and drink before they go.';
    if (fed.ate) return 'They eat before they go.';
    if (fed.drank) return 'They drink before they go.';
    return 'There is nothing on the table to eat and nothing to drink.';
}

export function processFeast(ctx: SimContext) {
    // §4.6: the feast is the arena's own pressure point — everybody in one
    // place, wanting the same things — which makes it exactly where a triangle
    // stops being something anyone can go on not addressing.
    forceTriangleChoice(ctx);
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-feast`);
    // §1.10: a feast *replaces* that day's day-phase, and it was the one phase
    // that never advanced the cycle counter. Everything counted in cycles —
    // stance holds and cooldowns, `finalistCycles`, the blackout clock, trap
    // and memory decay, contact recency — therefore lost a beat on every feast
    // day, at half rate relative to every other day in the run. The scheduled
    // day/night phases both advance it; so does this one.
    advanceCycle(ctx.state);
    /*
     * AUDIT-9 B01: a feast replaces the day's *action*, not the day.
     *
     * This phase advanced the cycle and then did none of the work a cycle
     * costs. Reproduced: an isolated non-attendee came out of a feast day at
     * exactly the same health, hunger and thirst it went in with, bleeding
     * included; a downed tribute at zero health crossed the map and was still
     * downed at the end. Scheduling a feast changed physiology for the whole
     * arena, attendees and hermits alike, which is both unrealistic and — since
     * the Gamemakers choose when to schedule one — a balance lever nobody
     * declared.
     *
     * The same three-stage lifecycle the day phase runs, from the same module.
     * Stage 1 here, before attendance is decided, so the body a tribute weighs
     * the walk with is the one the elapsed time actually left them. A feast is
     * held in daylight, so the day profile is the honest one.
     */
    preActionUpkeep(ctx, 'day');
    const alive = getAlive(ctx.state);
    // The same omission one field over. `daysSurvived` is written by the day
    // phase and by the bloodbath, and a feast *replaces* that day's day-phase —
    // so everyone alive through a feast day quietly lost a day off their count,
    // and that count is what the epilogue, the Hall of Fame entry and every
    // achievement predicate that reads it are told the tribute lasted. The
    // Feast Quell, which can replace half the days in a run, compounded it.
    alive.forEach(t => { t.daysSurvived = ctx.state.day; });
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
    /*
     * AUDIT-9 B13: what is on this table that anybody can eat or drink.
     *
     * Sampled from the theme's own pool rather than asserted, so the answer
     * tracks the announcement exactly: the banquet is full of it, the district
     * packs may or may not hold any, and the weapons, medical, fieldcraft,
     * token and empty tables hold none at all — which is what their
     * announcements say and what the feed now reflects.
     */
    const tableProvisions = tablePool.filter(i => i.type === 'food' || i.type === 'water');
    /*
     * Audit 3 §5.4: two of the new themes are about there being nothing worth
     * taking, which is the feast's most interesting shape and the one it could
     * not express.
     *
     * `tokens` puts every keepsake taken at the reaping on the table and
     * nothing else: the pack is handed back, it is worth nothing mechanically,
     * and the whole field converges on open ground for it anyway. `empty` is
     * the Gamemakers lying — there is no table, and everybody who came is
     * standing in the middle of the arena with everybody else who came.
     *
     * Both resolve through the machinery that already exists. The journey, the
     * arrival order, the scrum and the fighting all happen exactly as they do
     * for a real table; the only thing that changes is that nobody leaves
     * holding anything.
     */
    const barrenTable = theme === 'tokens' || theme === 'empty';
    const themedGift = (t: Tribute) =>
        mintItem(ctx.rng, theme === 'district-gifts'
            ? pickNeededGift(ctx, t, itemPoolFor(ctx.state, ITEMS))
            : pickNeededGift(ctx, t, itemPoolFor(ctx.state, tablePool)), QUALITY_BIAS.feast);

    // §6.4: a feast announced before packs were named, or one called straight
    // into `processFeast` by a wildcard, still gets its table set properly.
    if (!ctx.state.feastPrizes || ctx.state.feastPrizes.length === 0) nameFeastPrizes(ctx);

    const decliners = [] as typeof alive;
    const strandedFar = [] as typeof alive;
    const hopsOut = new Map<string, number>();
    const collapsed = ctx.state.collapsedZones ?? [];
    const severed = severedEdgeSet(ctx.state);
    const incapable = [] as typeof alive;
    alive.forEach(t => {
        /*
         * AUDIT-9 B02: coming to the feast is an action, and a tribute on the
         * ground cannot take one.
         *
         * Attendance selected from `alive`, not from *capable*, so a downed
         * tribute at zero health walked across the arena under their own power
         * and arrived at the Cornucopia still downed. `isActive` is the
         * engine's existing answer to "can this person do a thing", and it is
         * the same gate the day phase puts in front of crafting, stance,
         * intention and movement. Somebody may still be carried out of the
         * feast by an ally — the rescue window in stage 2 below owns that —
         * but they do not travel to one on their own legs.
         */
        if (!isActive(t)) { incapable.push(t); return; }
        // The feast was announced a day ago and the journey was real: anyone
        // still more than two hops out did not make it, whatever they wanted.
        const hops = hopsTo(ctx.state.arena, t.zone, cornucopia, collapsed, severed);
        if (hops === undefined || hops > 2) {
            strandedFar.push(t);
            return;
        }
        hopsOut.set(t.id, hops);
        // Desperation still overrides everything — a starving tribute goes.
        if (t.vitals.hunger > FEAST.desperateHunger || t.vitals.thirst > FEAST.desperateThirst) {
            attendees.push(t);
            return;
        }
        const named = (ctx.state.feastPrizes ?? []).some(p => p.tributeId === t.id);
        if (ctx.rng.chance(attendanceChance(t, alive, theme, named))) attendees.push(t);
        else decliners.push(t);
    });

    // One line per tribute turned the feed into a wall of near-identical
    // sentences; past a couple of names these are summarised instead.
    const announce = (group: typeof alive, pool: string[], summary: (names: string) => string, absent = false, type?: EventType) => {
        if (group.length === 0) return;
        /*
         * AUDIT-9 B18: these lines are filed under the Cornucopia because
         * that is what they are *about*, and some of them name people who are
         * deliberately nowhere near it. `absent` marks those, so the replay
         * scrubber stops reading a mention as a position.
         */
        if (group.length <= 2) {
            group.forEach(t => ctx.logEvent(
                fill(ctx.pickText(pool), { tribute: t.name }),
                [t.id],
                { zone: cornucopia, category: 'feast', absentIds: absent ? [t.id] : undefined }
            ));
        } else {
            ctx.logEvent(
                summary(group.map(t => t.name).join(', ')),
                group.map(t => t.id),
                { type, zone: cornucopia, category: 'feast', absentIds: absent ? group.map(t => t.id) : undefined },
            );
        }
    };

    announce(decliners, FEAST_TEXTS.decline, names => `${names} weigh the feast against the odds and stay exactly where they are.`, true);
    if (incapable.length > 0) {
        ctx.logEvent(
            `${incapable.map(t => t.name).join(', ')} ${incapable.length > 1 ? 'are' : 'is'} in no condition to walk anywhere, `
            + 'and the table is not brought to them.',
            incapable.map(t => t.id),
            { category: 'feast' }
        );
    }
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
            'single-pack': 'On the table: one pack, dead centre, on four square metres of nothing. Everybody arrives, sees it, and does the same arithmetic at the same moment.',
            tokens: 'On the table: a locket, a carved bird, a scrap of cloth, a ring — every token taken at the reaping, set out in a row with the names beside them. There is no food. There is no steel. They came anyway.',
            fieldcraft: 'On the table: coils of wire, rope, flint, needles, waxed line. Nothing on it will kill anybody. Everything on it is a week.',
            empty: 'There is no table. There is the Cornucopia, the open ground around it, and every living tribute standing on it looking at each other.',
        };
        ctx.logEvent(tableLines[theme], [], { zone: cornucopia, category: 'feast' });
    }

    if (attendees.length === 0) {
        ctx.logEvent('Not one tribute comes to the feast. The table sits untouched until the Gamemakers withdraw it.', [], { important: true, category: 'feast' });
        return;
    }

    // §6.4: nobody arrives at the same instant, and everything about the feast
    // reads differently if you are the one already standing over the table.
    // Distance first, then how fast they cross it: a tribute one zone out
    // cannot be beaten there by a sprinter two zones out, but two tributes the
    // same distance out arrive in the order their legs decide.
    const arrivalKey = (t: Tribute) => (hopsOut.get(t.id) ?? 0)
        - (t.attributes.agility + t.attributes.endurance) / (2 * TRIBUTE_ATTRIBUTE_CEILING);
    const ordered = [...attendees].sort((a, b) => arrivalKey(a) - arrivalKey(b));
    const firstIn = arrivalKey(ordered[0]);
    const early = new Set(ordered
        .filter(t => arrivalKey(t) < firstIn + PRE_ARENA.feastEarlyArrivalEdge)
        .map(t => t.id));
    const latecomers = ordered.filter(t => !early.has(t.id));

    const claimed = new Set<string>();
    if (latecomers.length > 0) {
        ctx.logEvent(
            `${ordered.filter(t => early.has(t.id)).map(t => t.name).join(', ')} reach the Cornucopia first and have the table to themselves for a while — long enough to read the names on it and choose where to stand.`,
            [...early],
            { important: true, zone: cornucopia, category: 'feast' }
        );
    }
    // The head start is spent on the packs: whoever is there first decides
    // which of them are still on the table when everybody else arrives.
    claimPacks(ctx, ordered.filter(t => early.has(t.id)), cornucopia, themedGift, claimed, barrenTable);
    // §7: the head start's other use. Runs after the early arrivals have taken
    // what they want and before anyone else reaches the table.
    if (latecomers.length > 0) tamperWithFeast(ctx, ordered.filter(t => early.has(t.id)), cornucopia);
    if (latecomers.length > 0) {
        ctx.logEvent(
            `${latecomers.map(t => t.name).join(', ')} come in late, into a clearing that is already occupied and a table that has already been gone through.`,
            latecomers.map(t => t.id),
            { zone: cornucopia, category: 'feast' }
        );
    }

    const shuffled = ctx.rng.shuffle(attendees);
    // Everyone at the table sees everyone else at the table.
    attendees.forEach(t => noteSighting(ctx.state, t, cornucopia, attendees.length - 1, 0));
    // The early arrival's advantage is spent once, on whoever they meet first.
    const edgeSpent = new Set<string>();

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
            // AUDIT-9 B13: what covering each other buys them is an unhurried
            // few minutes at the table — which feeds them only if there is
            // anything on it, and otherwise only from their own packs.
            [t1, t2].forEach(t => eatAtTable(ctx, t, tableProvisions));
            continue;
        }

        // §6.4: an early arrival meeting a latecomer is not a fair exchange.
        // They chose the ground, they have had their hands free, and they see
        // them coming across open ground — which lands as the opening blow.
        const ambusher = early.has(t1.id) && !early.has(t2.id) && !edgeSpent.has(t1.id) ? t1
            : early.has(t2.id) && !early.has(t1.id) && !edgeSpent.has(t2.id) ? t2
            : undefined;
        if (ambusher) {
            edgeSpent.add(ambusher.id);
            const late = ambusher === t1 ? t2 : t1;
            resolveCombat(ctx, ambusher, late, false, false, 0, 1 + PRE_ARENA.feastEarlyAmbushBonus);
        } else {
            resolveCombat(ctx, t1, t2);
        }
        // A draw usually means they break off rather than immediately
        // re-engaging the same opponent.
        if (t1.status === 'alive' && ctx.rng.chance(0.55)) shuffled.push(t1);
        if (t2.status === 'alive' && ctx.rng.chance(0.55)) shuffled.push(t2);
    }

    // Whoever is still standing goes through what is left of the row — the
    // latecomers' own packs, if nobody took them while they were walking.
    claimPacks(ctx, attendees.filter(t => t.status === 'alive' && !claimed.has(t.id)), cornucopia, themedGift, claimed, barrenTable);
    // The table is withdrawn with the unclaimed packs still on it.
    ctx.state.feastPrizes = undefined;
    ctx.state.feastTampering = undefined;

    // Anybody who died in the row above is not still standing at the table.
    // `shuffled` is built by pushing tributes back while they are alive, but
    // the final `claimPacks` pass runs after the fighting and can itself kill
    // somebody (§7's tampered pack is the case that surfaced this) — and the
    // branches below hand the survivor food and fifty health, which on a
    // corpse produced a dead tribute at full health.
    const standing = shuffled.filter(t => t.status === 'alive');
    shuffled.length = 0;
    shuffled.push(...standing);

    if (shuffled.length > 1) {
        ctx.logEvent(
            `${shuffled.map(t => t.name).join(' and ')} take what they can carry and back away from the Cornucopia without settling it.`,
            shuffled.map(t => t.id),
            { important: true, zone: cornucopia, category: 'feast' }
        );
        shuffled.splice(1).forEach(t => {
            // Their own district pack: the thing they actually need, per the
            // same need arithmetic the sponsor stream uses. A tribute who has
            // already been through the row takes nothing twice.
            if (claimed.has(t.id)) return;
            // Audit 3 §5.4: a barren table has nothing to hand out. They fought
            // over it anyway, which is the point of the theme.
            if (barrenTable) return;
            const minted = themedGift(t);
            giveItem(t, minted);
            // AUDIT-9 B13: "and a full stomach" was printed over a weapons
            // table. The line now reports what the pack actually held.
            const fed = eatAtTable(ctx, t, [minted]);
            ctx.logEvent(
                `${t.name} leaves the feast with the District ${t.district} pack — ${itemPhrase(minted)}. ${mealNote(fed)}`,
                [t.id], { zone: cornucopia, category: 'feast' },
            );
        });
    }

    else if (shuffled.length === 1) {
        const winner = shuffled[0];
        // Their own pack, plus whichever of the unclaimed ones suits them best
        // — or, if they already went through the row before the fighting
        // started, just the one still lying there when it finished.
        if (barrenTable) {
            // Audit 3 §5.4: they won the ground and the ground is all there was.
            ctx.logEvent(
                `${winner.name} is the last one standing at ${cornucopia}, and there is nothing on the table worth `
                + 'the walk, let alone the rest of it. They stand there a while before they leave.',
                [winner.id],
                { important: true, zone: cornucopia, category: 'feast' }
            );
        } else {
        const item1 = themedGift(winner);
        const item2 = themedGift(winner);
        if (claimed.has(winner.id)) giveItem(winner, item1);
        else giveItem(winner, item1, item2);
        // AUDIT-9 B13: winning the ground is not a meal. The health is the
        // Capitol's medical package, which every table carries; the stomach is
        // whatever was actually laid out, eaten twice over because they have
        // the whole table and all the time in the world.
        winner.health = Math.min(100, winner.health + FEAST.winnerHeal);
        eatAtTable(ctx, winner, [item1, item2]);
        eatAtTable(ctx, winner, [item1, item2]);
        clampTribute(winner);
        ctx.logEvent(
            fill(ctx.pickText(FEAST_TEXTS.claim), { tribute: winner.name, items: `${item1.name} and ${item2.name}` }),
            [winner.id],
            { important: true, zone: cornucopia, category: 'feast' }
        );
        }
    }
    // AUDIT-9 B01: lifecycle stages 2 and 3. The rescue window resolves after
    // the fighting, exactly as it does in the day phase — which is also the
    // only way somebody who was on the ground when the table was laid leaves
    // this phase in a different state than they entered it — and then
    // everything that fades on the cycle clock fades, because the cycle
    // happened whatever the Gamemakers scheduled in it.
    postActionUpkeep(ctx);
    decayUpkeep(ctx);
    // §1.3: the feast is the one place everybody is in the same zone by
    // design, and the run-record differ never observed it.
    tickRunRecords(ctx);
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
function attendanceChance(
    t: Tribute,
    alive: Tribute[],
    theme: NonNullable<GameState['feastTheme']> = 'district-gifts',
    namedPack: boolean = false,
): number {
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
    // §6.4: your own name is on one of those packs, and staying away does not
    // mean it stays there — somebody else carries it out. That pulls as hard
    // as an ally standing at the table, but only on somebody it is worth
    // something to: a tribute who needs what is in it, or whose token they
    // took off them at the reaping and pinned to the flap. A well-fed tribute
    // with nothing from home on that table can still, sensibly, stay away.
    // balance-exempt: same hunger band the food-theme draw below already uses
    if (namedPack && (wounded || !!t.token || t.vitals.hunger > 40)) {
        chance += FEAST.allyDrawWeight;
    }
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
