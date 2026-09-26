import { SimContext, getAlive } from './context';
import { GameState, Tribute, ZoneStateKind } from '../models/types';
import { AUDIT13_ARENA } from '../data/balance';
import { RNG } from '../utils/rng';
import { getZone, zoneFeatures } from './map';
import { loseSanity } from './sanityBands';
import { cycleOf } from './memory';

/**
 * AUDIT-13 W11–W16: the arena as a thing that changes.
 *
 * Before this the ground was the same on day twelve as on day one: a zone that
 * had burned, flooded or been shelled by the arena's own mechanic foraged and
 * hid exactly as it did at the gong. This module holds the small amount of
 * state that makes the arena remember — what each zone has been through, where
 * the weather is in its chain, where people died — and the readers the rest of
 * the engine asks (`zoneForageScale`, `zoneConcealmentDelta`, `zoneIsBroken`).
 *
 * Everything here is non-lethal on purpose. The death mix is owned by the
 * arena events and signatures; this layer moves the odds under them.
 */

/** The state a zone is in, `intact` when nothing has happened to it. */
export function zoneStateOf(state: GameState, zone: string): ZoneStateKind {
    return state.zoneStates?.[zone]?.kind ?? 'intact';
}

function setZoneState(ctx: SimContext, zone: string, kind: ZoneStateKind, line?: string) {
    const states = ctx.state.zoneStates ?? (ctx.state.zoneStates = {});
    const prev = states[zone]?.kind ?? 'intact';
    if (prev === kind) return;
    if (kind === 'intact') delete states[zone];
    else states[zone] = { kind, since: cycleOf(ctx.state) };
    if (line) ctx.logEvent(line, [], { zone, category: 'arena' });
}

/** W11: forage multiplier for the zone's current state. */
export function zoneForageScale(state: GameState, zone: string): number {
    return AUDIT13_ARENA.zoneForage[zoneStateOf(state, zone)];
}

/** W11: added to a hider's concealment for the zone's current state. */
export function zoneConcealmentDelta(state: GameState, zone: string): number {
    return AUDIT13_ARENA.zoneHide[zoneStateOf(state, zone)];
}

/**
 * W11/W2: whether the ground here has anything to fall from. A ruined zone
 * has — rubble and broken floors — even on an arena that started flat.
 */
export function zoneHasDrop(state: GameState, zoneName: string): boolean {
    if (zoneStateOf(state, zoneName) === 'ruined') return true;
    const zone = getZone(state.arena, zoneName);
    if (!zone) return false;
    const f = zoneFeatures(zone);
    return f.elevation === true || f.vertical === true;
}

/** W15: where the arena is in its arc. */
export function arenaArcStage(state: GameState): 'quiet' | 'signature' | 'finale' {
    if (state.day <= AUDIT13_ARENA.arcQuietUntilDay) return 'quiet';
    if (state.day < AUDIT13_ARENA.arcFinaleFromDay) return 'signature';
    return 'finale';
}

/**
 * W13: whether the Hiding stance (Evasive) gets the arena's night bonus. The
 * bonus is general — the dark is the dark — but arenas whose night rule is
 * loud (a mimic, rides waking) give less of it.
 */
export function nightHideBonus(state: GameState, t: Tribute, dark: boolean): number {
    if (!dark || t.stance !== 'Evasive') return 0;
    const rule = NIGHT_RULES[state.arena.id];
    return rule === 'wake' || rule === 'mimic'
        ? AUDIT13_ARENA.nightHidingBonus * 0.5
        : AUDIT13_ARENA.nightHidingBonus;
}

type NightRule = 'cold' | 'wake' | 'mimic';
const NIGHT_RULES: Record<string, NightRule> = {
    glacier: 'cold', frozen: 'cold', floe: 'cold', alpine: 'cold', cabin: 'cold', kelvin: 'cold', seapeaks: 'cold',
    carnival: 'wake', menagerie: 'wake', clockwork: 'wake', thresher: 'wake', culdesac: 'wake', vault: 'wake',
    acousticforest: 'mimic', canopyweb: 'mimic', storywood: 'mimic', nooneplace: 'mimic', silkwood: 'mimic',
};
const NIGHT_LINES: Record<NightRule, string> = {
    cold: 'The cold comes down properly after dark. Anybody without a roof over them spends the night working just to stay warm.',
    wake: 'Something in the arena wakes up after dark that sleeps through the day, and it is not quiet about it.',
    mimic: 'The voices start again after dark, closer than they were last night, and some of them use names.',
};

/** Which damage codes push a zone into which state. */
const DAMAGE_STATE: Partial<Record<string, ZoneStateKind>> = {
    burns: 'burning', asphyxiation: 'burning',
    drowning: 'flooded',
    collapse: 'damaged', machinery: 'damaged', gamemaker: 'damaged', fall: 'damaged',
};

/**
 * Run once per day/night phase, after the weather front has moved.
 */
export function tickArenaDynamics(ctx: SimContext, time: 'day' | 'night') {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const rng = new RNG(`${state.seed}-arena-dynamics-${cycle}`);
    const collapsed = state.collapsedZones ?? [];
    const open = state.arena.zones.map(z => z.name).filter(n => !collapsed.includes(n));

    // --- W11: damage this cycle moves the ground on. Signature damage counts
    // double: it is the arena's mechanic acting on it.
    const pushed = new Set<string>();
    state.tributes.forEach(t => {
        const d = t.lastDamage;
        if (!d || d.cycle !== cycle || !d.code) return;
        if (d.kind === 'tribute' || d.kind === 'status') return;
        const next = DAMAGE_STATE[d.code];
        if (!next || pushed.has(t.zone)) return;
        if (!d.signature && !rng.chance(AUDIT13_ARENA.damageAdvanceChance)) return;
        pushed.add(t.zone);
        advanceZone(ctx, t.zone, next);
    });

    // --- W11: time moves it on too.
    Object.entries(state.zoneStates ?? {}).forEach(([zone, s]) => {
        if (pushed.has(zone)) return;
        const age = cycle - s.since;
        if (s.kind === 'burning' && age >= AUDIT13_ARENA.burningCycles) {
            setZoneState(ctx, zone, 'ash', `The fire in ${zone} has run out of things to burn. What is left is ash, and nothing hides in ash.`);
        } else if (s.kind === 'ash' && age >= AUDIT13_ARENA.ashCycles) {
            setZoneState(ctx, zone, 'regrowth', `Green is coming back through the ash in ${zone}, faster than anybody would expect. The arena wants its cover back.`);
        } else if (s.kind === 'regrowth' && age >= AUDIT13_ARENA.regrowthCycles) {
            setZoneState(ctx, zone, 'intact');
        } else if (s.kind === 'flooded' && age >= AUDIT13_ARENA.floodCycles) {
            setZoneState(ctx, zone, 'intact', `The water goes down in ${zone}, and leaves the ground there soaked and stripped.`);
        }
    });

    // --- W12: the weather chain.
    tickWeatherChain(ctx, rng, open);

    // --- W13: the arena's night rule.
    if (time === 'night') {
        const rule = NIGHT_RULES[state.arena.id];
        if (rule) {
            const living = getAlive(state);
            if (living.length > 0 && arenaArcStage(state) !== 'quiet' && rng.chance(AUDIT13_ARENA.nightRuleChance)) {
                ctx.logEvent(NIGHT_LINES[rule], [], { category: 'arena' });
                living.forEach(t => {
                    const zone = getZone(state.arena, t.zone);
                    const shelter = zone ? zoneFeatures(zone).shelterQuality ?? 0 : 0;
                    if (rule === 'cold') {
                        t.vitals.fatigue = Math.min(100, t.vitals.fatigue + Math.round(AUDIT13_ARENA.nightColdFatigue * (1 - shelter)));
                    } else {
                        const alone = !living.some(o => o.id !== t.id && o.zone === t.zone);
                        loseSanity(t, AUDIT13_ARENA.nightSanity * (alone && rule === 'mimic' ? 2 : 1));
                    }
                });
            }
        }
    }

    // --- W15: the finale mutation, once.
    if (arenaArcStage(state) === 'finale' && !state.arenaFinaleMutated && open.length > 2) {
        state.arenaFinaleMutated = true;
        const targets = rng.shuffle(open.filter(n => !/cornucopia/i.test(n) && zoneStateOf(state, n) !== 'ruined'))
            .slice(0, AUDIT13_ARENA.finaleRuinedZones);
        if (targets.length > 0) {
            ctx.logEvent(
                `The arena changes its mind about itself. ${targets.join(' and ')} ${targets.length === 1 ? 'comes' : 'come'} apart overnight, `
                + 'and the ground the tributes had learned is not the ground they wake up on.',
                [],
                { important: true, category: 'gamemaker' },
            );
            targets.forEach(z => setZoneState(ctx, z, 'ruined'));
        }
    }

    // --- W16: where people died. Recorded once per body; a zone with a
    // cairn in it weighs on whoever camps there.
    const sites = state.deathSites ?? (state.deathSites = {});
    const noted = state.deathSitesNoted ?? (state.deathSitesNoted = []);
    state.tributes.forEach(t => {
        if (t.status !== 'dead' || noted.includes(t.id)) return;
        noted.push(t.id);
        sites[t.zone] = (sites[t.zone] ?? 0) + 1;
    });
    getAlive(state).forEach(t => {
        const n = sites[t.zone] ?? 0;
        if (n < AUDIT13_ARENA.hauntedSiteDeaths) return;
        loseSanity(t, AUDIT13_ARENA.hauntedSanity);
    });

    // --- B6: corpse kit does not sit on the body for the rest of the Games.
    sweepCorpseKit(ctx);
}

function advanceZone(ctx: SimContext, zone: string, toward: ZoneStateKind) {
    const now = zoneStateOf(ctx.state, zone);
    if (toward === 'damaged') {
        if (now === 'intact' || now === 'regrowth') {
            setZoneState(ctx, zone, 'damaged', `${zone} has taken a beating. There is less of it standing than there was this morning.`);
        } else if (now === 'damaged') {
            setZoneState(ctx, zone, 'ruined', `${zone} is ruined now: broken footing, open drops, nothing left growing.`);
        }
        return;
    }
    if (toward === 'burning' && (now === 'burning' || now === 'ash' || now === 'flooded')) return;
    if (toward === 'flooded' && now === 'burning') {
        setZoneState(ctx, zone, 'ash', `Water puts out what was left of the fire in ${zone}.`);
        return;
    }
    setZoneState(ctx, zone, toward, toward === 'burning'
        ? `${zone} is burning.`
        : `${zone} is under water.`);
}

type ChainName = 'wet' | 'cold' | 'heat';
const CHAINS: Record<ChainName, { lines: [string, string, string]; last: ZoneStateKind | 'thaw' }> = {
    wet: {
        lines: [
            'The air goes thick and warm and wet. Everybody in the arena can feel something building.',
            'The storm breaks. Rain comes down hard enough to hurt.',
            'The rain has nowhere left to go, and the low ground starts to fill.',
        ],
        last: 'flooded',
    },
    cold: {
        lines: [
            'A cold snap comes in off nowhere. Breath shows by midday.',
            'The freeze sets in. Standing water turns to plate, and so does anything left wet.',
            'The thaw comes as fast as the freeze did, and the ground cracks open as it goes.',
        ],
        last: 'thaw',
    },
    heat: {
        lines: [
            'The heat climbs and keeps climbing. Shade is worth more than food today.',
            'Nothing has fallen from the sky in days. Streams are down to stones.',
            'Something dry catches, and the wind does the rest.',
        ],
        last: 'burning',
    },
};

function chainFor(state: GameState): ChainName {
    const toward = state.climateDrift?.toward;
    return toward === 'cold' ? 'cold' : toward === 'wet' ? 'wet' : toward ? 'heat' : 'wet';
}

/**
 * W12: three-step weather chains. A chain starts with a small chance, and each
 * step makes the next one likelier than the last — the arena is seen building
 * to it. The last step changes a zone (W11).
 */
function tickWeatherChain(ctx: SimContext, rng: RNG, open: string[]) {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const chain = state.weatherChain;
    if (!chain) {
        if (arenaArcStage(state) === 'quiet' || !rng.chance(AUDIT13_ARENA.chainStartChance)) return;
        const name = chainFor(state);
        state.weatherChain = { name, step: 0, cycle };
        ctx.logEvent(CHAINS[name].lines[0], [], { category: 'arena' });
        return;
    }
    if (cycle - chain.cycle < AUDIT13_ARENA.chainStepCycles) return;
    const name = chain.name as ChainName;
    const def = CHAINS[name];
    if (!def) { delete state.weatherChain; return; }
    // The next step's weight is set by the one before it.
    if (!rng.chance(AUDIT13_ARENA.chainAdvanceChance[chain.step] ?? 0)) {
        // A chain that stalls blows itself out.
        if (cycle - chain.cycle > AUDIT13_ARENA.chainStepCycles * 3) delete state.weatherChain;
        return;
    }
    chain.step += 1;
    chain.cycle = cycle;
    ctx.logEvent(def.lines[chain.step], [], { important: chain.step === 2, category: 'arena' });
    if (chain.step === 1) {
        getAlive(state).forEach(t => { t.vitals.fatigue = Math.min(100, t.vitals.fatigue + AUDIT13_ARENA.chainMidFatigue); });
        return;
    }
    // The last step lands on a zone and the chain is done.
    const candidates = open.filter(n => !/cornucopia/i.test(n));
    const target = candidates.length > 0 ? rng.pick(candidates) : undefined;
    if (target) {
        if (def.last === 'thaw') advanceZone(ctx, target, 'damaged');
        else advanceZone(ctx, target, def.last);
    }
    state.weatherChainsCompleted = (state.weatherChainsCompleted ?? 0) + 1;
    delete state.weatherChain;
}

/**
 * AUDIT-13 B6: a corpse's kit goes to the ground after a while.
 *
 * Looting a fresh body is a real beat (`stanceBeats`), so the kit stays on it
 * for `corpseKitDays`. After that the hovercraft has taken the body and what
 * it was carrying is left where it fell as an abandoned cache — the same
 * pattern AUDIT-9 B07 uses for a dead pack's shared store — so nothing that
 * reads inventory without a status filter counts a dead tribute's steel.
 */
function sweepCorpseKit(ctx: SimContext) {
    const state = ctx.state;
    state.tributes.forEach(t => {
        if (t.status !== 'dead' || t.inventory.length === 0) return;
        if (t.dayOfDeath === undefined || state.day - t.dayOfDeath < AUDIT13_ARENA.corpseKitDays) return;
        state.abandonedCamps = state.abandonedCamps ?? [];
        state.abandonedCamps.push({
            zone: t.zone,
            ownerId: t.id,
            ownerName: t.name,
            cycle: cycleOf(state),
            items: t.inventory.map(i => i.id),
        });
        t.inventory = [];
    });
}
