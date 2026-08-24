/**
 * §4.6: love triangles, as a shape rather than a coincidence.
 *
 * `alliance.ts` models a Star-Crossed bond between two people, and `ROMANCE`
 * models the performed version of the same thing. Both are strictly pairwise,
 * so two romances that happened to share a member were, to the simulation, two
 * unrelated records that both mentioned the same id. Nothing looked at the
 * overlap, and the overlap is the entire story: it is the one romantic
 * configuration that generates conflict on its own, without anybody having to
 * betray anybody.
 *
 * A triangle here is one *apex* — the person both of the others are attached
 * to — and two rivals. It is detected rather than declared, from regard the
 * rest of the engine was already maintaining, and it produces two things a
 * pair cannot:
 *
 *  - **jealousy**, readable in the feed while nothing is happening. The rivals
 *    have to be in a position to see each other for it to build, which is what
 *    `heat` counts.
 *  - **the choice**, forced at a pressure point rather than drifting. The apex
 *    picks, one of them is not picked, and the arena does what the arena does
 *    with that.
 */
import { GameState, Tribute } from '../models/types';
import { TRIANGLES } from '../data/balance';
import { SimContext, getAlive } from './context';
import { adjustRel, getRel } from './relationships';
import { cycleOf, swearVengeance } from './memory';
import { areLovers } from './alliance';
import { addExcitement } from './audience';
import { clampTribute } from './vitals';

function triangles(state: GameState) {
    if (!state.loveTriangles) state.loveTriangles = [];
    return state.loveTriangles;
}

/** How attached `t` is to `otherId`, counting a declared bond as the ceiling. */
function attachment(t: Tribute, other: Tribute): number {
    if (areLovers(t, other)) return TRIANGLES.declaredBondRegard;
    return getRel(t, other.id);
}

/**
 * Is there an actual romance here, declared or performed?
 *
 * §4.6: the first cut of the detector asked only for high regard on both
 * sides, and produced 3,970 triangles across 400 runs — ten a run, which is
 * not a love triangle, it is the ordinary warmth inside an alliance being
 * relabelled. The report's framing is the correct gate and it is narrower than
 * regard: a triangle is *two romances sharing a member*, so at least one of
 * the two attachments has to be a real romance — a declared Star-Crossed bond,
 * or a performed one, both of which the engine already marks.
 */
function isRomance(t: Tribute, other: Tribute): boolean {
    if (areLovers(t, other)) return true;
    // A performed bond is recorded as a displayed regard for that specific
    // person — the number they are showing the cameras rather than the one
    // they hold.
    return t.displayedRegard?.[other.id] !== undefined
        || other.displayedRegard?.[t.id] !== undefined;
}

/**
 * Detection. Deliberately conservative: at least one leg has to be an actual
 * romance, both rivals have to be genuinely attached, and the apex has to be
 * at least warm to both — a triangle needs the apex to be a real choice rather
 * than one person with two admirers they have never encouraged. Recorded once.
 */
export function detectTriangles(ctx: SimContext) {
    const state = ctx.state;
    const alive = getAlive(state);
    const list = triangles(state);

    alive.forEach(apex => {
        const suitors = alive.filter(o =>
            o.id !== apex.id
            && attachment(o, apex) >= TRIANGLES.suitorRegard
            && getRel(apex, o.id) >= TRIANGLES.apexWarmth);
        if (suitors.length < 2) return;
        // The two most attached. A fourth party is not a squarer triangle, it
        // is the same story with more names in it.
        const [a, b] = suitors.sort((x, y) => attachment(y, apex) - attachment(x, apex));
        // Two admirers is not a triangle. One romance and a rival for it is.
        if (!isRomance(apex, a) && !isRomance(apex, b)) return;
        const already = list.some(tri =>
            tri.apexId === apex.id
            && ((tri.aId === a.id && tri.bId === b.id) || (tri.aId === b.id && tri.bId === a.id)));
        if (already) return;

        list.push({ apexId: apex.id, aId: a.id, bId: b.id, formedCycle: cycleOf(state), heat: 0 });
        ctx.logEvent(
            `It has become obvious to everyone except possibly ${apex.name} that ${a.name} and ${b.name} are not `
            + 'going to be able to go on being polite to each other about this.',
            [apex.id, a.id, b.id],
            { important: true, category: 'romance' }
        );
    });
}

/** One cycle of a triangle being a triangle. */
export function tickTriangles(ctx: SimContext) {
    const state = ctx.state;
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));

    state.loveTriangles = triangles(state).filter(tri => {
        const apex = byId.get(tri.apexId);
        const a = byId.get(tri.aId);
        const b = byId.get(tri.bId);
        // The arena resolves most of these itself.
        if (!apex || !a || !b) return false;
        if (apex.status !== 'alive' || a.status !== 'alive' || b.status !== 'alive') return false;
        if (tri.resolved) return true;

        // Jealousy only builds where the rivals can actually see each other
        // being rivals. Two people in love with the same person four zones
        // apart is not yet a triangle, it is two crushes.
        const together = a.zone === b.zone && (apex.zone === a.zone || apex.zone === b.zone);
        if (!together) return true;

        tri.heat += 1;
        adjustRel(a, b.id, -TRIANGLES.jealousyRegardPerCycle);
        adjustRel(b, a.id, -TRIANGLES.jealousyRegardPerCycle);
        addExcitement(apex, TRIANGLES.excitementPerCycle);

        if (tri.heat === TRIANGLES.jealousyLineHeat) {
            ctx.logEvent(
                `${a.name} and ${b.name} have started arranging themselves around ${apex.name} — who sits where, who takes which watch — `
                + 'and neither of them has said a word about why.',
                [a.id, b.id, apex.id],
                { important: true, category: 'romance' }
            );
        }
        return true;
    });
}

/**
 * The forced choice. Called at a pressure point — the feast, or the field
 * closing — rather than on a timer: the whole point of a triangle is that it
 * holds until something makes it impossible to hold, and then does not.
 */
export function forceTriangleChoice(ctx: SimContext) {
    const state = ctx.state;
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));

    triangles(state).forEach(tri => {
        if (tri.resolved || tri.heat < TRIANGLES.choiceMinHeat) return;
        const apex = byId.get(tri.apexId);
        const a = byId.get(tri.aId);
        const b = byId.get(tri.bId);
        if (!apex || !a || !b) return;
        if ([apex, a, b].some(t => t.status !== 'alive')) return;

        tri.resolved = true;
        // They choose whoever they are actually warmer to. A declared
        // Star-Crossed bond outweighs anything unspoken, which is what
        // declaring it is for.
        const chosen = getRel(apex, a.id) + (areLovers(apex, a) ? TRIANGLES.declaredBondRegard : 0)
            >= getRel(apex, b.id) + (areLovers(apex, b) ? TRIANGLES.declaredBondRegard : 0) ? a : b;
        const passed = chosen.id === a.id ? b : a;

        adjustRel(apex, chosen.id, TRIANGLES.chosenRegard);
        adjustRel(chosen, apex.id, TRIANGLES.chosenRegard);
        adjustRel(passed, apex.id, -TRIANGLES.passedOverRegard);
        adjustRel(passed, chosen.id, -TRIANGLES.passedOverRegard);
        passed.vitals.sanity -= TRIANGLES.passedOverSanity;
        clampTribute(passed);
        addExcitement(apex, TRIANGLES.choiceExcitement);
        addExcitement(passed, TRIANGLES.choiceExcitement);

        // Being passed over in an arena is not the same as being passed over
        // anywhere else, and some people take it the way the arena invites.
        const bitter = ctx.rng.chance(TRIANGLES.vengeanceChance);
        if (bitter) swearVengeance(passed, chosen.id);

        ctx.logEvent(
            bitter
                ? `${apex.name} makes the choice in front of both of them, and it is ${chosen.name}. `
                    + `${passed.name} says that is fine, and means something else entirely by it. There are twelve people left alive in here.`
                : `${apex.name} makes the choice in front of both of them, and it is ${chosen.name}. `
                    + `${passed.name} takes it better than anyone watching expected, which the Capitol finds far less interesting than the alternative.`,
            [apex.id, chosen.id, passed.id],
            { important: true, category: 'romance' }
        );
    });
}
