import { Alliance, Tribute } from '../models/types';
import { PACK_PARLEY } from '../data/balance';
import { SimContext, getAlive } from './context';
import { allianceOf, allianceRecords, leaderFor, membersOf, mergeAllianceRecords, pickLeader } from './alliance';
import { adjustMutual, getRel } from './relationships';
import { cycleOf, noteContact } from './memory';
import { assessZone } from './stance';
import { addExcitement } from './audience';

/**
 * R-2: two groups meeting.
 *
 * `parley.ts` negotiates between individuals. Two *alliances* arriving in the
 * same zone had no negotiation path at all — the encounter layer resolved them
 * as a pile of individual meetings, so the only outcomes were merge, brawl, or
 * everyone ignoring each other. A pack-to-pack standoff is one of the most
 * cinematic scenes the source material has and it was unrepresentable.
 *
 * Three outcomes, decided by the two leaders rather than by the crowd:
 *
 *  - **terms** — an explicit pack-level non-aggression pact, recorded on both
 *    alliance records, that the encounter layer then honours;
 *  - **merge offer** — the smaller group folds into the larger, when the
 *    leaders already get on and the arithmetic is obvious;
 *  - **standoff** — they back out of the clearing in formation, which is the
 *    default and the one the cameras like.
 *
 * Deliberately leader-driven: this is the one social decision in the engine
 * that a group makes as a group, and the leader is the person the group has
 * already agreed makes it.
 */

/** Whether these two groups are inside a standing pack-level pact. */
export function hasPackTruce(state: { cycle?: number; alliances?: Record<string, Alliance> }, a: string, b: string): boolean {
    const record = state.alliances?.[a];
    const until = record?.packTruces?.[b];
    return until !== undefined && (state.cycle ?? 0) < until;
}

function declarePackTruce(ctx: SimContext, a: Alliance, b: Alliance) {
    const until = cycleOf(ctx.state) + PACK_PARLEY.truceCycles;
    a.packTruces = { ...(a.packTruces ?? {}), [b.id]: until };
    b.packTruces = { ...(b.packTruces ?? {}), [a.id]: until };
}

/**
 * Runs once per cycle, after movement: any zone holding two or more standing
 * groups gets one negotiation between the two largest.
 */
export function resolvePackEncounters(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const byZone = new Map<string, Map<string, Tribute[]>>();
    alive.forEach(t => {
        if (!t.allianceId) return;
        // A lovers' bond is not a faction; it has no leader worth negotiating
        // with and no group to speak for.
        if (t.allianceId.startsWith('lovers-')) return;
        const zone = byZone.get(t.zone) ?? new Map<string, Tribute[]>();
        zone.set(t.allianceId, [...(zone.get(t.allianceId) ?? []), t]);
        byZone.set(t.zone, zone);
    });

    byZone.forEach((groups, zone) => {
        const standing = [...groups.entries()]
            .filter(([, members]) => members.length >= 2)
            .sort((a, b) => b[1].length - a[1].length);
        if (standing.length < 2) return;

        const [[aId, aMembers], [bId, bMembers]] = standing;
        if (hasPackTruce(ctx.state, aId, bId)) return;
        const a = allianceOf(ctx.state, aId);
        const b = allianceOf(ctx.state, bId);
        if (!a || !b) return;
        if (!ctx.rng.chance(PACK_PARLEY.chance)) return;

        const aLeader = leaderFor(ctx.state, aMembers[0]) ?? aMembers[0];
        const bLeader = leaderFor(ctx.state, bMembers[0]) ?? bMembers[0];
        noteContact(ctx.state, aLeader, bLeader);

        const regard = Math.min(getRel(aLeader, bLeader.id), getRel(bLeader, aLeader.id));
        const aName = a.name ?? `${aLeader.name}'s group`;
        const bName = b.name ?? `${bLeader.name}'s group`;

        // MERGE: the leaders already get on and one group is clearly the
        // junior partner. The smaller folds in rather than being fought.
        if (regard > 0 && aMembers.length > bMembers.length && ctx.rng.chance(PACK_PARLEY.mergeChance)) {
            bMembers.forEach(m => { m.allianceId = aId; });
            const merged = [...aMembers, ...bMembers];
            mergeAllianceRecords(ctx, aId, bId, merged);
            const record = allianceRecords(ctx.state)[aId];
            if (record) record.leaderId = pickLeader(merged).id;
            merged.forEach(m => addExcitement(m, 8));
            ctx.logEvent(
                `${bLeader.name} walks out into the open in ${zone} with empty hands and does the arithmetic out loud. `
                + `${bName} is now part of ${aName}, and everyone on both sides knows what that will be worth and what it will cost.`,
                merged.map(m => m.id),
                { important: true, category: 'alliance' }
            );
            return;
        }

        // TERMS: neither leader likes the odds enough to start it, and there
        // is enough between them to take a promise at face value.
        const aRatio = assessZone(aLeader, [...aMembers, ...bMembers], ctx.state).ratio;
        const outmatched = aRatio > 1;
        if (regard >= PACK_PARLEY.minLeaderRegard && !outmatched) {
            declarePackTruce(ctx, a, b);
            adjustMutual(ctx.state, aLeader, bLeader, PACK_PARLEY.standoffRegard);
            ctx.logEvent(
                `${aLeader.name} and ${bLeader.name} meet in the middle of ${zone} while both groups watch the other's hands. `
                + `Whatever they agree takes under a minute: ${aName} and ${bName} are not each other's problem today.`,
                [aLeader.id, bLeader.id],
                { important: true, category: 'alliance' }
            );
            return;
        }

        // STANDOFF: nobody moves first, and both groups leave by the way they
        // came in. Nothing is agreed and everything is noted.
        aMembers.concat(bMembers).forEach(m => { m.vitals.fatigue += PACK_PARLEY.standoffRegard; });
        ctx.logEvent(
            `${aName} and ${bName} end up facing each other across ${zone} with nobody willing to be the one who starts it. `
            + `Both groups back out the way they came, and neither turns around until they are out of sight.`,
            [aLeader.id, bLeader.id],
            { important: true, category: 'combat' }
        );
    });
}

/** Per-cycle upkeep: pack-level pacts simply lapse. */
export function decayPackTruces(state: { cycle?: number; alliances?: Record<string, Alliance> }) {
    const cycle = state.cycle ?? 0;
    Object.values(state.alliances ?? {}).forEach(record => {
        if (!record.packTruces) return;
        Object.keys(record.packTruces).forEach(id => {
            if (cycle >= record.packTruces![id]) delete record.packTruces![id];
        });
        if (Object.keys(record.packTruces).length === 0) delete record.packTruces;
    });
}

/** Whether these two tributes are covered by a pact between their groups. */
export function packTruceBetween(ctx: SimContext, a: Tribute, b: Tribute): boolean {
    if (!a.allianceId || !b.allianceId || a.allianceId === b.allianceId) return false;
    return hasPackTruce(ctx.state, a.allianceId, b.allianceId);
}

/** Exposed for the encounter layer: members of `id` currently standing in `zone`. */
export function groupInZone(ctx: SimContext, id: string, zone: string): Tribute[] {
    return membersOf(ctx.state, id).filter(m => m.zone === zone);
}
