import { Arena } from '../models/types';
import type { GamesProfile } from './gamesProfile';
import { ARENAS } from '../data/constants';
import { applyOffSeason, offSeasonFor } from '../data/offSeason';
import { generateArena } from './arenaGenerator';

/**
 * AUDIT-6 §1.3: the one place an arena is turned into *this run's* arena.
 *
 * This block used to live inline in `gameStore.newGame`, which is the UI path
 * and only the UI path. `soak.ts`, `metrics.ts`, `check-decisions.ts`,
 * `validate-arenas.ts` and `check-flavor-pools.ts` each built their own
 * `GameState` literal with a bare `ARENAS.find(...)`, so every headless check in
 * the repository skipped four steps the real game always takes:
 *
 *   1. the per-zone clone, without which a run mutates the shared `ARENAS`
 *      objects and leaks into the next run in the same process;
 *   2. the off-season skin — **120 definitions across 40 arenas**, which
 *      `applyOffSeason` uses to lift the arena's own law, impose another, and
 *      shift both what the ground yields and what it costs to cross;
 *   3. the Quell's `arenaLawOverride`;
 *   4. the `lawZone` default that stops `sponsorsFixedZone` and
 *      `noWaterExceptZone` from silently applying to no zone at all.
 *
 * A 300-run probe against the old harness shape saw **0 of 40 skins**. Step 2
 * is balance-affecting content that nothing measured, and steps 1 and 3 were
 * quietly diverging between the app and its own tests.
 *
 * So this is not a refactor for tidiness: it is the fix for "the checks do not
 * play the game the player plays". Every caller — the store and every script —
 * goes through here now.
 */
export function resolveArenaForRun(
    seed: string,
    arenaId: string,
    gamesProfile?: { quell?: GamesProfile['quell'] },
): Arena {
    // BUG-1.1: `procedural-<biome>` from a share link pins the biome — a check
    // that only sees the `procedural` prefix throws the encoded identity away.
    const proceduralBiome = arenaId.startsWith('procedural-')
        ? arenaId.slice('procedural-'.length)
        : undefined;
    const baseArena = arenaId.startsWith('procedural')
        ? generateArena(seed, proceduralBiome)
        : (ARENAS.find(a => a.id === arenaId) || ARENAS[0]);

    // Never mutate the shared ARENAS/generated-arena objects: a per-zone
    // shallow clone gives this run its own zone objects (the law override
    // below, and the Moving Arena Quell later, both write to them).
    const arena: Arena = { ...baseArena, zones: baseArena.zones.map(z => ({ ...z })) };

    // §5/§6.4: the off-season skin. Rolled from the seed, so a shared seed
    // still replays exactly. Applied to this run's clone only.
    const skin = offSeasonFor(seed, arena);
    if (skin) applyOffSeason(arena, skin);

    const override = gamesProfile?.quell?.arenaLawOverride;
    if (override) {
        arena.law = override;
        // 'sponsorsFixedZone' and 'noWaterExceptZone' both compare a tribute's
        // zone against `arena.lawZone`. On the handful of arenas that declare
        // one of these natively that is already set, but a Quell forces the law
        // onto whichever arena the run landed on, most of which carry no
        // `lawZone` at all. Left undefined, `t.zone === lawZone` is never true
        // for any real zone: gifts would land nowhere for the entire run, or
        // every zone would come up dry, for a Quell whose whole point was to
        // concentrate the drama on one sector. The Cornucopia is the default.
        if ((override === 'sponsorsFixedZone' || override === 'noWaterExceptZone') && !arena.lawZone) {
            arena.lawZone = arena.zones[0]?.name;
        }
    }
    return arena;
}
