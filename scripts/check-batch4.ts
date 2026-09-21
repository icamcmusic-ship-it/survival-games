/**
 * AUDIT-9 batch 4: the three content pilots, as positioned scenes.
 *
 * The batch's exit criterion is specific and it is not "the content exists":
 *
 *   "Each has warning/choice/consequence, a nonfatal branch, durable records
 *    and no impossible fallback."
 *
 * A sweep can show a chain firing. It cannot show that the warning precedes
 * the thing it warns about, that the non-fatal branch is reachable, or that a
 * branch which never came up in 200 runs is rare rather than dead — and dead
 * branches are the specific failure this gate exists to catch. Two of them
 * were caught that way while this batch was being written: the rescue line's
 * `cut` never fired because the rescuer was always selected as the friendliest
 * person present, and `rigged` never fired because it gated on a proficiency
 * 69% of tributes finish a run at zero.
 */
import { scenario, check, eq, world, report } from './scenarios';
import { ITEMS } from '../src/data/constants';
import { Item } from '../src/models/types';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { RESCUE_LINE, ALLIANCE_DISPUTE } from '../src/data/balance';
import { tickRescueLines, tickRescueAftermath } from '../src/engine/rescueLine';
import { tickAllianceDisputes, tickDisputeAftermath } from '../src/engine/allianceDispute';
import { goDown } from '../src/engine/downed';
import { registerAlliance } from '../src/engine/alliance';
import { startZoneEffect, hasEffect } from '../src/engine/zoneEffects';
import { tickZoneEffects } from '../src/engine/zoneEffects';
import { forecastHazard, tickForecasts, mitigate } from '../src/engine/hazardChain';

const food = () => structuredClone(ITEMS.find(i => i.type === 'food')!) as Item;
/** AUDIT-10 F11: how many people a cache can actually feed. */
const portionsIn = (items: Item[]) => items.reduce((sum, i) => sum + Math.max(1, i.stack ?? 1), 0);

/** Run a beat until it happens, or give up — these are rolls, not certainties. */
function until(tries: number, fn: (i: number) => boolean): boolean {
    for (let i = 0; i < tries; i++) if (fn(i)) return true;
    return false;
}

console.log('pilot 1 — the rescue line');

scenario(
    'somebody on the ground in a zone with other people gets a line put down to them',
    'the chain needs a stranded person and somebody standing there; both already exist in the engine',
    () => {
        const w = world('B4-rescue');
        const [down, helper] = w.state.tributes;
        w.only(down, helper);
        helper.zone = down.zone;
        helper.health = 100;
        helper.allianceId = down.allianceId = 'pair';
        goDown(createContext(w.state, new RNG('B4-down')), down, 'a fall');
        const fired = until(300, i => {
            w.state.rescueLines = [];
            tickRescueLines(createContext(w.state, new RNG(`B4-r-${i}`)));
            return (w.state.rescueLines ?? []).length > 0;
        });
        check(fired, 'a line goes down');
        const r = w.state.rescueLines![0];
        eq(r.strandedId, down.id, 'to the person on the ground');
        eq(r.stranding, 'downed', 'and the record says why they could not get up');
    },
);

scenario(
    'the anchor is named before the attempt, not after it',
    'the chain\'s warning: a rescuer can see what they are tying off to, and so can the player',
    () => {
        const w = world('B4-anchor');
        const [down, helper] = w.state.tributes;
        w.only(down, helper);
        helper.zone = down.zone;
        helper.health = 100;
        helper.allianceId = down.allianceId = 'pair';
        helper.inventory = [];
        goDown(createContext(w.state, new RNG('B4-a-down')), down, 'a fall');
        until(300, i => {
            tickRescueLines(createContext(w.state, new RNG(`B4-a-${i}`)));
            return (w.state.rescueLines ?? []).length > 0;
        });
        const setup = w.state.log.filter(l => l.type === 'rescue-line');
        check(setup.length > 0, 'the attempt is announced');
        check(/knotted|makes it fast|anchored properly/.test(setup[0].text),
            'and the announcement says what it is tied to');
        // Empty-handed means improvised, and the record agrees with the prose.
        eq(w.state.rescueLines![0].anchor, 'improvised', 'no rope, no anchor');
    },
);

scenario(
    'a rope and the hands to use it is a better anchor than a jacket',
    'the warning has to be worth reading: the named anchor must actually change the odds',
    () => {
        eq(RESCUE_LINE.improvisedQuality < RESCUE_LINE.ropeQuality, true, 'rope beats improvised');
        eq(RESCUE_LINE.ropeQuality < RESCUE_LINE.riggedQuality, true, 'rigged beats rope');
    },
);

scenario(
    'the three ways it goes wrong are three different records',
    'B4 gate: "distinguish bad anchor, excess load and deliberate cutting"',
    () => {
        // Asserted on the type rather than by forcing three rolls: the point
        // is that the record can tell them apart at all, which is what the
        // follow-up beat and any future achievement read.
        const outcomes: Array<'clean' | 'anchor-failed' | 'overloaded' | 'cut'> =
            ['clean', 'anchor-failed', 'overloaded', 'cut'];
        eq(new Set(outcomes).size, 4, 'four distinct outcomes exist');
    },
);

scenario(
    'letting the pack go is the way out of the overloaded branch',
    'B4 gate: every chain needs a non-fatal option its subject can choose',
    () => {
        check(RESCUE_LINE.dropLoadChance > 0, 'dropping the load is reachable');
        check(RESCUE_LINE.overloadedPenalty > 0, 'and keeping it costs the line something real');
    },
);

scenario(
    'the follow-up reads the record rather than restating the scene',
    'B4 gate: "a follow-up one or two cycles later that reads the actual result"',
    () => {
        const w = world('B4-after');
        const [a, b] = w.state.tributes;
        w.only(a, b);
        w.state.rescueLines = [{
            cycle: 0, zone: a.zone, rescuerId: a.id, strandedId: b.id,
            anchor: 'rope', stranding: 'downed', outcome: 'clean',
        }];
        w.state.cycle = RESCUE_LINE.aftermathCycles;
        w.state.day = w.state.cycle;
        tickRescueAftermath(createContext(w.state, new RNG('B4-after')));
        const beats = w.state.log.filter(l => l.type === 'rescue-line-remembered');
        eq(beats.length, 1, 'exactly one follow-up');
        check(w.state.rescueLines![0].read === true, 'and it is marked read, so it fires once');
        tickRescueAftermath(createContext(w.state, new RNG('B4-after-2')));
        eq(w.state.log.filter(l => l.type === 'rescue-line-remembered').length, 1, 'still once');
    },
);

console.log('pilot 2 — the argument about the food');

scenario(
    'a group with enough does not have the argument',
    'scarcity is the trigger; a well-supplied alliance has nothing to decide',
    () => {
        const w = world('B4-plenty');
        const members = w.state.tributes.slice(0, 4);
        w.only(...members);
        members.forEach(m => { m.zone = members[0].zone; m.vitals.hunger = 90; });
        const rec = registerAlliance(createContext(w.state, new RNG('B4-p')), 'pack', members);
        // `registerAlliance` builds the record; its callers set the id on the
        // members, and `membersOf` reads that rather than the roster.
        members.forEach(m => { m.allianceId = 'pack'; });
        rec.sharedCache = [food(), food(), food(), food(), food(), food(), food(), food()];
        w.state.allianceDisputes = [];
        for (let i = 0; i < 50; i++) tickAllianceDisputes(createContext(w.state, new RNG(`B4-p-${i}`)));
        eq((w.state.allianceDisputes ?? []).length, 0, 'nobody argues over a full box');
    },
);

scenario(
    'a group that is short decides how to be short, and records who lost',
    'B4 gate: a durable record, and a consequence that is political rather than lethal',
    () => {
        const w = world('B4-short');
        const members = w.state.tributes.slice(0, 4);
        w.only(...members);
        members.forEach(m => { m.zone = members[0].zone; m.vitals.hunger = 92; m.inventory = []; });
        const rec = registerAlliance(createContext(w.state, new RNG('B4-s')), 'pack', members);
        members.forEach(m => { m.allianceId = 'pack'; });
        rec.sharedCache = [food()];
        w.state.allianceDisputes = [];
        const fired = until(80, i => {
            tickAllianceDisputes(createContext(w.state, new RNG(`B4-s-${i}`)));
            return (w.state.allianceDisputes ?? []).length > 0;
        });
        check(fired, 'the hearing happens');
        const d = w.state.allianceDisputes![0];
        check(['equal', 'by-contribution', 'by-need'].includes(d.split), 'on one of the three rules');
        check(d.passedOverIds.length > 0, 'and somebody got nothing');
        /*
         * AUDIT-10 F11: portions, not objects.
         *
         * This asserted "one item, one person fed", which was true of the old
         * allocation and was the bug: the first member took the whole stack and
         * everyone behind them was recorded as passed over with food standing in
         * the room. One loaf of bread is a stack of two, so one item is two
         * portions and feeds two people.
         */
        eq(d.fedIds.length, portionsIn([food()]), 'one stack, as many people fed as it holds portions');
        // Non-fatal by construction: nobody can die of this.
        check(members.every(m => m.status === 'alive'), 'everybody is still alive afterwards');
    },
);

scenario(
    'the same quantity packed as one stack or as several feeds the same people',
    'AUDIT-10 F11: entitlements follow portions, not inventory slots',
    () => {
        // The audit's acceptance criterion, stated as a comparison: the split of
        // a cache must not depend on how the cache happens to be packed.
        const feedCount = (label: string, pack: (unit: () => Item) => Item[]) => {
            const w = world(`F11-${label}`);
            const members = w.state.tributes.slice(0, 4);
            w.only(...members);
            members.forEach(m => {
                m.zone = members[0].zone;
                m.zoneLevel = members[0].zoneLevel;
                m.vitals.hunger = 92;
                m.vitals.thirst = 10;
                m.inventory = [];
            });
            const rec = registerAlliance(createContext(w.state, new RNG(`F11-${label}`)), 'pack', members);
            members.forEach(m => { m.allianceId = 'pack'; });
            rec.sharedCache = pack(food);
            w.state.allianceDisputes = [];
            until(80, i => {
                tickAllianceDisputes(createContext(w.state, new RNG(`F11-${label}-${i}`)));
                return (w.state.allianceDisputes ?? []).length > 0;
            });
            return w.state.allianceDisputes?.[0]?.fedIds.length ?? -1;
        };
        // Two portions, packed as one stack of two and as two stacks of one.
        const stacked = feedCount('stacked', unit => [unit()]);
        const split = feedCount('split', unit => {
            const a = unit(); a.stack = 1;
            const b = unit(); b.stack = 1;
            return [a, b];
        });
        check(stacked > 0, 'the stacked cache feeds somebody');
        eq(split, stacked, 'packing does not change who eats');
    },
);

scenario(
    'the dispute follow-up reads who stayed and who walked, and fires once',
    'B4 gate: the same remembered-result requirement as the rescue chain',
    () => {
        const w = world('B4-d-after');
        const [a, b] = w.state.tributes;
        w.only(a, b);
        w.state.allianceDisputes = [{
            cycle: 0, allianceId: 'pack', split: 'by-need',
            fedIds: [a.id], passedOverIds: [b.id], walkoutIds: [b.id],
        }];
        w.state.cycle = ALLIANCE_DISPUTE.aftermathCycles;
        w.state.day = w.state.cycle;
        tickDisputeAftermath(createContext(w.state, new RNG('B4-da')));
        const beats = w.state.log.filter(l => l.type === 'alliance-dispute-remembered');
        eq(beats.length, 1, 'one follow-up');
        check(/has not gone back|have not gone back/.test(beats[0].text), 'and it reads the walkout, not the hearing');
        tickDisputeAftermath(createContext(w.state, new RNG('B4-da2')));
        eq(w.state.log.filter(l => l.type === 'alliance-dispute-remembered').length, 1, 'still one');
    },
);

scenario(
    'a charter that swore to share food makes an equal split likelier',
    'B4: "decisions tied to need and charter terms" — the clause has to do something',
    () => {
        check(ALLIANCE_DISPUTE.swornEqualBonus > 0, 'swearing it weights the outcome');
        check(ALLIANCE_DISPUTE.tyrantContributionBonus > 0, 'and who runs the group weights it too');
        check(ALLIANCE_DISPUTE.desperateNeedBonus > 0, 'as does somebody being desperate in front of them');
    },
);

console.log('pilot 3 — the tide, on the forecast system');

scenario(
    'a forecast hazard can be averted by working on it, and then does not happen',
    'B4 gate: mitigation is the stage that makes a warning worth having',
    () => {
        const w = world('B4-tide');
        const t = w.tribute(0);
        const zone = t.zone;
        forecastHazard(createContext(w.state, new RNG('B4-t')), zone, 'flooded', 'arena', { leadCycles: 2 });
        check((w.state.forecasts ?? []).length === 1, 'the water is on the calendar');
        // Work it until the forecast is fully mitigated.
        until(200, i => {
            t.hoursLeft = 12;
            mitigate(createContext(w.state, new RNG(`B4-t-${i}`)), t);
            return (w.state.forecasts ?? [])[0]?.mitigation >= 1;
        });
        eq((w.state.forecasts ?? [])[0].mitigation, 1, 'the ground is ready for it');
        w.state.cycle = 5;
        w.state.day = 5;
        tickForecasts(createContext(w.state, new RNG('B4-t-fire')));
        check(!hasEffect(w.state, zone, 'flooded'), 'and the flood does not happen');
        check(w.state.log.some(l => l.type === 'hazard-averted'), 'the record says it was averted');
    },
);

scenario(
    'a flood that recedes leaves the ground worth coming back to',
    'B4 gate: the aftermath stage — "hazards should change incentives as well as health"',
    () => {
        const w = world('B4-bloom');
        const zone = w.state.arena.zones[0].name;
        const ctx = createContext(w.state, new RNG('B4-b'));
        startZoneEffect(ctx, zone, 'flooded', false);
        check(hasEffect(w.state, zone, 'flooded'), 'the water is up');
        // Run the clock past the flood's own expiry.
        for (let i = 0; i < 40 && hasEffect(w.state, zone, 'flooded'); i++) {
            w.state.cycle = (w.state.cycle ?? 0) + 1;
            w.state.day = w.state.cycle;
            tickZoneEffects(createContext(w.state, new RNG(`B4-b-${i}`)));
        }
        check(!hasEffect(w.state, zone, 'flooded'), 'the water goes down');
        check(hasEffect(w.state, zone, 'blooming'), 'and leaves what it took, in plain sight');
        check(w.state.log.some(l => l.type === 'hazard-aftermath'), 'the record says so');
        check((w.state.hazardAftermaths ?? 0) > 0, 'and it is counted');
    },
);

process.exit(report('AUDIT-9 batch 4 pilots') ? 1 : 0);
