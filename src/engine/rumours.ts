/**
 * §4.7: rumours with content, as opposed to intel with a value.
 *
 * `memory.ts` already trades information, and it is good — but everything it
 * trades is a *number about a place*: how dangerous, how many people, how
 * picked-over. That is enough to move somebody and not enough to be a claim.
 * Nobody in this arena could say a thing that was either true or false.
 *
 * A rumour is a proposition with a subject: the horn restocked early, somebody
 * is dug in at the ruins with a bow, there is a cache in the wetland. It is
 * born either from the world (in which case it is true) or from a tribute who
 * wants somebody to go somewhere (in which case it is not), and once it exists
 * it is passed around independently of whoever started it — which is what
 * makes it a rumour rather than a lie. A tribute repeating something false is
 * usually not lying; they heard it from somebody who heard it.
 *
 * Believing one bends where a tribute goes, and finding out it was wrong costs
 * whoever told them — but only them, not the whole chain, because that is how
 * this actually works.
 *
 * Distinct from §3.5's notoriety, which is reputation *about people* and is a
 * scalar. This is content, and it can be checked.
 */
import { GameState, Tribute } from '../models/types';
import { RUMOURS } from '../data/balance';
import { SimContext, getAlive } from './context';
import { cycleOf, ensureMemory } from './memory';
import { adjustRel, getRel } from './relationships';
import { raiseSuspicion } from './memory';
import { depletionOf, getZone } from './map';
import { ZONE_RUMOUR_CLAIMS } from '../data/flavorText';

export type RumourKind = 'restock' | 'holed-up' | 'cache' | 'empty';

/**
 * §11.7: what each kind claims, drawn from a real pool.
 *
 * Each kind used to render through exactly one hard-coded sentence, so the
 * whole social information layer said the same four things every run —
 * repetition inside a single Games, which is the failure `test:flavor` guards
 * every other pool against. `ZONE_RUMOUR_CLAIMS` carries a dozen phrasings
 * per kind; the draw goes through `ctx.pickText` so the same claim is not
 * said twice in a row.
 */
function claim(ctx: SimContext, kind: RumourKind, zone: string): string {
    const pool = ZONE_RUMOUR_CLAIMS[kind];
    const template = pool && pool.length > 0 ? ctx.pickText(pool) : `something about ${zone}`;
    return template.split('{zone}').join(zone);
}

function pool(state: GameState) {
    if (!state.rumours) state.rumours = [];
    return state.rumours;
}

function heard(t: Tribute): string[] {
    const mem = ensureMemory(t);
    if (!mem.heardRumours) mem.heardRumours = [];
    return mem.heardRumours;
}

export function believes(t: Tribute, rumourId: string): boolean {
    return heard(t).includes(rumourId);
}

/** The claims `t` currently believes, for movement and for prose. */
export function believedRumours(state: GameState, t: Tribute) {
    const ids = new Set(heard(t));
    return pool(state).filter(r => ids.has(r.id));
}

/**
 * §4.7: how a believed rumour bends a destination score. Positive draws them,
 * negative pushes them away. This is the entire mechanical effect and it is
 * deliberately modest — a rumour changes where somebody looks first, not what
 * they are capable of.
 */
export function rumourPull(state: GameState, t: Tribute, zoneName: string): number {
    let pull = 0;
    believedRumours(state, t).forEach(r => {
        if (r.zone !== zoneName) return;
        pull += r.kind === 'restock' || r.kind === 'cache' ? RUMOURS.lurePull
            : -RUMOURS.warningPush;
    });
    return pull;
}

/**
 * The world generating true things to say about itself. One a cycle at most,
 * and only claims that are actually checkable against state — which is what
 * makes the false ones cost something when they are found out.
 */
export function mintTrueRumours(ctx: SimContext) {
    const state = ctx.state;
    if (pool(state).length >= RUMOURS.poolCap) return;
    if (!ctx.rng.chance(RUMOURS.trueMintChance)) return;

    const alive = getAlive(state);
    const candidates: Array<{ kind: RumourKind; zone: string; originId?: string }> = [];

    // Somebody armed and stationary is the most useful true thing anybody
    // could tell you, and the most dangerous thing to be the subject of.
    alive.forEach(t => {
        if (!t.inventory.some(i => i.type === 'weapon')) return;
        if ((t.zoneHeld ?? 0) < RUMOURS.holedUpCycles) return;
        candidates.push({ kind: 'holed-up', zone: t.zone, originId: t.id });
    });
    // Ground that genuinely is stripped.
    state.arena.zones.forEach(z => {
        if (depletionOf(state, z.name) >= RUMOURS.emptyDepletion) candidates.push({ kind: 'empty', zone: z.name });
    });

    if (candidates.length === 0) return;
    const pick = ctx.rng.pick(candidates);
    // Nothing is served by two identical rumours in circulation.
    if (pool(state).some(r => r.kind === pick.kind && r.zone === pick.zone && !r.exposed)) return;

    const rumour = {
        id: `rumour-${state.logCounter}-${pool(state).length}`,
        kind: pick.kind,
        zone: pick.zone,
        aboutId: pick.originId,
        isTrue: true,
        bornCycle: cycleOf(state),
    };
    pool(state).push(rumour);

    // §4.7: somebody has to have *seen* it, or there is nothing to pass on.
    //
    // The first cut minted true claims straight into the pool and left it at
    // that, so no tribute ever acquired one — `tradeRumours` only forwards
    // what a teller already believes, and nobody believed anything. 210 true
    // rumours minted across 80 runs and 51 rumour-cycles with a single
    // believer between them. A claim about the arena starts with a witness:
    // whoever was standing near enough to notice, and not the person the
    // claim is about, who is unlikely to be spreading it.
    const witnesses = alive.filter(w =>
        w.id !== pick.originId
        && (w.zone === pick.zone || (getZone(state.arena, w.zone)?.adjacent ?? []).includes(pick.zone)));
    if (witnesses.length === 0) {
        state.rumours = pool(state).filter(r => r !== rumour);
        return;
    }
    const witness = ctx.rng.pick(witnesses);
    heard(witness).push(rumour.id);
    ctx.logEvent(
        `${witness.name} sees enough of ${pick.zone} from where they are to be sure of one thing: ${claim(ctx, pick.kind, pick.zone)}. `
        + 'It is the first genuinely useful thing anybody has had to say all day.',
        [witness.id],
        { category: 'travel', zone: pick.zone }
    );
}

/**
 * A tribute planting one. This is the deliberate half: somebody wants the
 * field to go somewhere, or to stay away from somewhere, and says a thing
 * that is not so.
 */
export function plantRumour(ctx: SimContext, planter: Tribute, listener: Tribute): boolean {
    const state = ctx.state;
    if (pool(state).length >= RUMOURS.poolCap) return false;
    // The cleanest plant is a lure into somewhere the planter is not, or a
    // warning off somewhere the planter is.
    const away = state.arena.zones.filter(z => z.name !== planter.zone);
    if (away.length === 0) return false;
    const lure = ctx.rng.chance(RUMOURS.plantLureShare);
    const zone = lure ? ctx.rng.pick(away).name : planter.zone;

    const rumour = {
        id: `rumour-${state.logCounter}-plant-${pool(state).length}`,
        kind: (lure ? 'cache' : 'holed-up') as RumourKind,
        zone,
        isTrue: false,
        plantedById: planter.id,
        bornCycle: cycleOf(state),
    };
    pool(state).push(rumour);
    tell(state, planter, listener, rumour.id);
    ctx.logEvent(
        `${planter.name} mentions to ${listener.name}, as though it were an afterthought, that ${claim(ctx, rumour.kind, zone)}. `
        + 'It is said well. There is no reason at all for it to be true.',
        [planter.id, listener.id],
        { category: 'alliance' }
    );
    return true;
}

/** One rumour crossing from one person to another. */
function tell(state: GameState, teller: Tribute, listener: Tribute, rumourId: string) {
    if (believes(listener, rumourId)) return;
    heard(listener).push(rumourId);
    const mem = ensureMemory(listener);
    mem.rumourSource = mem.rumourSource ?? {};
    mem.rumourSource[rumourId] = teller.id;
}

/**
 * Two people talking. Passes on what each of them has heard, and sometimes
 * — for the sort of person who does this — invents something.
 *
 * Called from the same peaceable-meeting sites that already trade reputations,
 * so the whole social information layer moves at the same points.
 */
export function tradeRumours(ctx: SimContext, a: Tribute, b: Tribute) {
    const state = ctx.state;
    const swap = (from: Tribute, to: Tribute) => {
        heard(from).forEach(id => {
            if (!ctx.rng.chance(RUMOURS.passOnChance)) return;
            tell(state, from, to, id);
        });
    };
    swap(a, b);
    swap(b, a);

    // And the deliberate half. Only somebody with a reason to.
    [[a, b], [b, a]].forEach(([planter, mark]) => {
        if (getRel(planter, mark.id) > RUMOURS.plantMaxRegard) return;
        if (!ctx.rng.chance(RUMOURS.plantChance)) return;
        plantRumour(ctx, planter, mark);
    });
}

/**
 * Camp talk.
 *
 * §4.7: a parley is not where most talking happens. Allies sitting in the same
 * zone are the arena's high-bandwidth channel by a wide margin, and routing
 * rumours only through peaceable meetings between strangers meant a claim
 * essentially never reached a second person before its first believer walked
 * into the place it was about and found out — 4 rumour-cycles with two
 * believers across 80 runs. A chain of one is not a rumour.
 *
 * Deliberately allies-only: this is people who talk to each other, not
 * everybody standing in a clearing.
 */
export function shareRumoursInCamp(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(a => {
        if (!a.allianceId) return;
        alive.forEach(b => {
            if (b.id <= a.id) return;
            if (b.allianceId !== a.allianceId || b.zone !== a.zone) return;
            if (!ctx.rng.chance(RUMOURS.campShareChance)) return;
            const swap = (from: Tribute, to: Tribute) => {
                heard(from).forEach(id => {
                    if (!ctx.rng.chance(RUMOURS.passOnChance)) return;
                    tell(ctx.state, from, to, id);
                });
            };
            swap(a, b);
            swap(b, a);
        });
    });
}

/**
 * Standing in the place a rumour was about.
 *
 * The check is the whole point of having content rather than a number: a
 * tribute who walked three zones on somebody's word finds out whether the word
 * was good, and holds it against whoever told *them* — not against whoever
 * started it, who they have most likely never met. That is the difference
 * between a rumour and a lie, and it is why a planter can poison a field they
 * never speak to again.
 */
export function checkRumours(ctx: SimContext) {
    const state = ctx.state;
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));

    getAlive(state).forEach(t => {
        const mem = ensureMemory(t);
        believedRumours(state, t).forEach(rumour => {
            if (rumour.zone !== t.zone) return;
            // They are standing in it. Whatever it said is now checkable.
            heard(t).splice(heard(t).indexOf(rumour.id), 1);
            const sourceId = mem.rumourSource?.[rumour.id];
            if (mem.rumourSource) delete mem.rumourSource[rumour.id];
            if (rumour.isTrue) return;

            rumour.exposed = true;
            const source = sourceId ? byId.get(sourceId) : undefined;
            if (!source || source.status !== 'alive' || source.id === t.id) {
                ctx.logEvent(
                    `${t.name} gets to ${rumour.zone} and finds nothing anybody described. They cannot even remember now who told them.`,
                    [t.id],
                    { category: 'travel' }
                );
                return;
            }
            const planted = rumour.plantedById === source.id;
            adjustRel(t, source.id, -(planted ? RUMOURS.plantedRegardCost : RUMOURS.repeatedRegardCost));
            raiseSuspicion(t, source.id, planted ? RUMOURS.plantedSuspicion : RUMOURS.repeatedSuspicion);
            ctx.logEvent(
                planted
                    ? `${t.name} reaches ${rumour.zone} and there is nothing there and never was. ${source.name} told them that, `
                        + 'looking them in the face, and knew.'
                    : `${t.name} reaches ${rumour.zone} and there is nothing there. ${source.name} passed it on in good faith, `
                        + 'which is going to be difficult to prove to somebody who has just walked a day for it.',
                [t.id, source.id],
                { category: 'travel' }
            );
        });
    });

    // Retire what nobody can act on any more.
    state.rumours = pool(state).filter(r =>
        !r.exposed && cycleOf(state) - r.bornCycle < RUMOURS.lifetime);
}
