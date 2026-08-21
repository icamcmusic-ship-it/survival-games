import { SimContext, getAlive } from './context';
import { Tribute } from '../models/types';
import { areLovers } from './alliance';
import { hasModifier, wildcardIs } from './gamesProfile';

/**
 * §7.1: the dual-victor endgame.
 *
 * "Two may win" was announced by two wildcards — rule-change-allies and the
 * district-pairs Quarter Quell — and enforced by nothing: the run always
 * ground on to a single survivor, so the most famous rule in the source
 * material was pure flavour text. This module gives the final two a way to
 * actually walk out together, three ways:
 *
 * 1. The standing "two may win" rule change, when the final two are allied
 *    (a declared alliance or a lovers' bond both count — the rule as
 *    announced only requires them to be standing together).
 * 2. The district-pairs Quarter Quell, when the final two are from the same
 *    district — the year's premise honoured at its natural conclusion.
 * 3. The nightlock standoff: star-crossed lovers as the final two, with no
 *    rule to protect them, refuse to play. This is the canon ending — the
 *    berries come out, the Gamemakers blink, and the Capitol crowns two
 *    rather than none. It also resolves the stalemate §1.9 identified:
 *    a lover pair that cannot fight each other used to be unable to end
 *    the Games at all.
 */
export function checkDualVictory(ctx: SimContext): [Tribute, Tribute] | undefined {
    const alive = getAlive(ctx.state);
    if (alive.length !== 2) return undefined;
    const [a, b] = alive;

    const allied = (a.allianceId !== undefined && a.allianceId === b.allianceId) || areLovers(a, b);

    if ((wildcardIs(ctx.state, 'rule-change-allies') || hasModifier(ctx.state, 'twin-victors')) && allied) {
        ctx.logEvent(
            `The cannon does not fire. The anthem does. Under this year's rule change, ${a.name} and ${b.name} `
            + `are both still standing — and two may win. The Games are over.`,
            [a.id, b.id],
            { important: true, category: 'system' }
        );
        return crown(ctx, a, b);
    }

    if (wildcardIs(ctx.state, 'quarter-quell-pairs') && a.district === b.district) {
        ctx.logEvent(
            `District ${a.district} stands alone at the end. In the year the Capitol reaped its tributes in bonded pairs, `
            + `it can hardly object to crowning one: ${a.name} and ${b.name} go home together.`,
            [a.id, b.id],
            { important: true, category: 'system' }
        );
        return crown(ctx, a, b);
    }

    if (areLovers(a, b)) {
        // No rule protects them. They make their own.
        ctx.logEvent(
            `${a.name} and ${b.name} stand alone in the arena, and neither reaches for a weapon.`,
            [a.id, b.id],
            { important: true, category: 'alliance' }
        );
        ctx.logEvent(
            `${a.name} opens a hand. Nightlock — enough for two. ${b.name} takes their share without a word. `
            + `The Capitol is about to have no victor at all, on live broadcast, and every Gamemaker in the booth knows it.`,
            [a.id, b.id],
            { important: true, category: 'system' }
        );
        ctx.logEvent(
            `The announcement comes before the berries reach their mouths: this year, the Games have two victors. `
            + `${a.name} and ${b.name} let the nightlock fall.`,
            [a.id, b.id],
            { important: true, category: 'system' }
        );
        return crown(ctx, a, b);
    }

    return undefined;
}

function crown(ctx: SimContext, a: Tribute, b: Tribute): [Tribute, Tribute] {
    ctx.state.victorIds = [a.id, b.id];
    // The run ends here, so the alliance-phase reconciliation that would
    // normally repair records next cycle never runs again. A pair whose
    // third member (or leader) died in the final fight would otherwise leave
    // a record led by a corpse. Fixed silently — no one elects a leader on
    // the victory podium.
    Object.values(ctx.state.alliances ?? {}).forEach(record => {
        const living = ctx.state.tributes.filter(t => t.status === 'alive' && t.allianceId === record.id);
        record.memberIds = living.map(t => t.id);
        if (living.length >= 2 && !living.some(t => t.id === record.leaderId)) {
            record.leaderId = living[0].id;
        }
    });
    return [a, b];
}

/** Everyone who walked out. Empty on a wipeout; length 2 on a dual victory. */
export function victorsOf(state: { tributes: Tribute[] }): Tribute[] {
    return state.tributes.filter(t => t.status === 'alive');
}
