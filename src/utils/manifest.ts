import { GameState } from '../models/types';
import { ARENAS } from '../data/constants';
import { ACHIEVEMENTS } from '../data/achievements';
import { TRAIT_DEFS } from '../data/traits';
import { ARCHETYPES } from '../data/archetypes';

/**
 * AUDIT-9 batch 5: what a run actually needs to be reproduced.
 *
 * The audit's §3 asks the export to carry "engine/content version, base and
 * resolved config, arena identity, campaign snapshot and interventions",
 * and says plainly why: *"a seed alone is not a complete replay
 * specification."*
 *
 * It is not, and the daily challenge is the proof. Two players on the same
 * daily seed are playing the same Games only if they also agree about the
 * cast tables, the arena roster, the balance constants, whether the campaign
 * carried anything in, and whether anybody reached in and changed something
 * mid-run. Every one of those has moved during this audit alone: batch 3
 * changed combat and stance constants, batch 4 added two chains and moved a
 * third, and the achievement catalogue went 398 -> 396. A seed replayed
 * across that boundary is a different run wearing the same name.
 *
 * So the manifest records what the run was played *under*, not just what it
 * was played *from*. A consumer that finds a mismatch can say "this replay
 * was recorded on different content" instead of quietly producing a
 * different arena and calling it the same seed.
 */

/**
 * A fingerprint of the content tables this build was compiled with.
 *
 * Deliberately derived rather than hand-maintained: a version constant
 * somebody has to remember to bump is a version constant that is wrong. These
 * four counts move whenever the content does — and they moved three times in
 * this audit, which is exactly the drift the field exists to catch.
 *
 * Not a hash of the content: two builds agreeing here are *probably* the same
 * content, and a mismatch is *certainly* different content. That asymmetry is
 * the useful direction — the manifest's job is to stop somebody claiming two
 * runs are comparable when they demonstrably are not.
 */
export function contentFingerprint(): string {
    return [
        `a${ARENAS.length}`,
        `c${ACHIEVEMENTS.length}`,
        `t${Object.keys(TRAIT_DEFS).length}`,
        `y${Object.keys(ARCHETYPES).length}`,
    ].join('.');
}

export interface RunManifest {
    /** The seed, which is necessary and — see above — not sufficient. */
    seed: string;
    /** What the tables looked like. See `contentFingerprint`. */
    content: string;
    /**
     * Arena identity, not its display name.
     *
     * REPLAY-12's lesson, applied here: 4 biomes x 12 name suffixes collapse
     * genuinely distinct generated maps into a handful of display names, so a
     * manifest keyed on the name cannot tell two procedural arenas apart.
     */
    arena: { id: string; mapId?: string; name: string };
    /**
     * Both configs. `base` is what the player chose; `resolved` is what the
     * Games actually ran under once a Quell, an off-season skin or an arena
     * law had finished overriding it. A replay needs the first to reproduce
     * the choice and the second to check it reproduced.
     */
    config: { base: GameState['baseConfig']; resolved: GameState['config'] };
    /** The year's temperament, Quell and cast shape, if it had one. */
    profile?: { gamesNumber?: number; quellId?: string; temperament?: string; castShape?: string };
    /** What the campaign carried into this run, if anything. */
    campaign?: GameState['campaign'];
    /**
     * Whether anybody reached in, and how many times.
     *
     * The audit lists interventions among the things a manifest must carry,
     * and they are the single most replay-breaking thing in the game: they do
     * not enter through a phase, so they have no (seed, phase, day) to reseed
     * from. A run with interventions is not comparable to one without, and
     * this is the field that says so.
     */
    interventions: { gamemakerMode: boolean; commands: number };
}

export function runManifest(state: GameState): RunManifest {
    return {
        seed: state.seed,
        content: contentFingerprint(),
        arena: { id: state.arena.id, mapId: state.arena.mapId, name: state.arena.name },
        config: { base: state.baseConfig, resolved: state.config },
        profile: state.gamesProfile
            ? {
                gamesNumber: state.gamesProfile.gamesNumber,
                quellId: state.gamesProfile.quell?.id,
                temperament: state.gamesProfile.temperament?.name,
                castShape: state.gamesProfile.castShape?.name,
            }
            : undefined,
        campaign: state.campaign,
        interventions: {
            gamemakerMode: state.gamemakerMode === true,
            commands: state.gamemakerCommands ?? 0,
        },
    };
}

/**
 * Can these two runs be compared?
 *
 * The question the daily challenge has to answer before it puts two scores on
 * the same board, and the reason the manifest exists at all. Returns the
 * reasons they cannot, so a UI can say which one rather than just refusing.
 */
export function comparabilityGaps(a: RunManifest, b: RunManifest): string[] {
    const gaps: string[] = [];
    if (a.seed !== b.seed) gaps.push('different seed');
    if (a.content !== b.content) gaps.push(`different content (${a.content} vs ${b.content})`);
    if ((a.arena.mapId ?? a.arena.id) !== (b.arena.mapId ?? b.arena.id)) gaps.push('different arena');
    if (JSON.stringify(a.config.resolved) !== JSON.stringify(b.config.resolved)) gaps.push('different rules');
    // A run somebody reached into is not a run anybody else can reproduce.
    if (a.interventions.commands > 0 || b.interventions.commands > 0) gaps.push('interventions were used');
    if (a.interventions.gamemakerMode !== b.interventions.gamemakerMode) gaps.push('different Gamemaker mode');
    // The campaign is the quiet one: two players on the same seed with
    // different career histories get different sponsors, mentors and
    // heirlooms, and the run diverges without either of them touching a
    // setting.
    if ((a.campaign?.runs ?? 0) !== (b.campaign?.runs ?? 0)) gaps.push('different campaign history');
    return gaps;
}
