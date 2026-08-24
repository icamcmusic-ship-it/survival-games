import { EdgeRule, ZoneEffectKind } from '../models/types';
import { SimContext } from './context';
import { CLIMATE_LABELS, LAW_LABELS, lawsOf, terrainMix } from '../data/arenaBriefing';
import { zoneFeatures } from './map';

/**
 * §13.2: the arena briefing, in-fiction, at the moment the tributes rise.
 *
 * The setup screen already carries a pre-game briefing (`data/arenaBriefing.ts`
 * — laws, climate, terrain spread), but that is meta information shown before
 * the seed locks in. Nothing narrated the arena inside the run: the plates came
 * up, the gong went, and a player who had picked "Random Arena (Hidden)" was
 * told nothing about the map they were watching.
 *
 * This fires immediately before the gong, in the terse wire register — it reads
 * as what it is simulating, which is the Gamemakers' own opening notes on the
 * arena rather than a tourism brochure. Everything in it is derived from the
 * `Arena` object the run already carries; nothing new is authored per arena, so
 * the three new maps and the thirty-seven old ones are all briefed the same way.
 *
 * Gated behind the `arenaBriefingOnDrop` preference (default on) so a player
 * who would rather discover the map blind can turn it off.
 */

/** Plain language for what an arena has renamed an effect to. */
function vocabLine(kind: ZoneEffectKind, label: string): string {
    return `${label.toUpperCase()} = ${kind.toUpperCase()}.`;
}

/** "DESCENT ONLY", "TOLLED", "DAYLIGHT ONLY" — what a route rule costs. */
function edgeNote(key: string, rule: EdgeRule): string | undefined {
    const [a, b] = key.split('|');
    switch (rule.kind) {
        case 'oneWay':
        case 'oneWayAfter':
            return rule.from && rule.to ? `${rule.from.toUpperCase()} → ${rule.to.toUpperCase()}, ONE DIRECTION ONLY.` : undefined;
        case 'tolled':
            return `${a.toUpperCase()} ↔ ${b.toUpperCase()}, CROSSING COSTS.`;
        case 'timeGated':
            return `${a.toUpperCase()} ↔ ${b.toUpperCase()}, ${(rule.gatedTime ?? 'day').toUpperCase()} ONLY.`;
        case 'collapsing':
            return `${a.toUpperCase()} ↔ ${b.toUpperCase()}, LIMITED CROSSINGS REMAINING.`;
        case 'contested':
            return `${a.toUpperCase()} ↔ ${b.toUpperCase()}, EXPECT IT HELD.`;
        // A hidden edge is the one thing a brief must not give away: the whole
        // value of it is that nobody knows it is there.
        case 'hidden':
            return undefined;
    }
}

export function arenaBriefingLog(ctx: SimContext) {
    const arena = ctx.state.arena;
    // A hidden-arena run keeps its identity out of the UI until the bloodbath
    // reveals it — briefing it here would be exactly the leak that setting is
    // for.
    if (ctx.state.arenaHidden) return;

    const lines: string[] = [];
    lines.push(`GAMEMAKER LOG — ARENA BRIEF — ${arena.name.toUpperCase()}`
        + (arena.offSeason ? ` (${arena.offSeason.toUpperCase()})` : ''));

    const laws = lawsOf(arena);
    const lawText = laws.length > 0
        ? laws.map(id => {
            const label = LAW_LABELS[id].name.toUpperCase();
            return arena.lawZone && (id === 'sponsorsFixedZone' || id === 'noWaterExceptZone')
                ? `${label} (${arena.lawZone.toUpperCase()} ONLY)`
                : label;
        }).join('; ')
        : 'NONE';
    lines.push(`${arena.zones.length} ZONES. LAW: ${lawText}.`);
    lines.push(`TERRAIN: ${terrainMix(arena).toUpperCase()}.`);

    const climate = CLIMATE_LABELS[arena.id];
    if (climate) lines.push(`CLIMATE: ${climate.toUpperCase()}`);

    // The zones a tribute would want to know about before choosing a direction.
    const water = arena.zones.filter(z => zoneFeatures(z).waterSource).map(z => z.name);
    if (water.length > 0 && water.length <= 3) {
        lines.push(`WATER: ${water.map(w => w.toUpperCase()).join(', ')}.`);
    }
    const chokes = arena.zones.filter(z => zoneFeatures(z).chokepoint).map(z => z.name);
    if (chokes.length > 0 && chokes.length <= 4) {
        lines.push(`CHOKEPOINTS: ${chokes.map(c => c.toUpperCase()).join(', ')}.`);
    }

    const crossings = Object.entries(arena.edgeRules ?? {})
        .map(([key, rule]) => edgeNote(key, rule))
        .filter((n): n is string => n !== undefined);
    crossings.forEach(n => lines.push(`KNOWN HAZARD CROSSING: ${n}`));

    Object.entries(arena.effectVocab ?? {}).forEach(([kind, vocab]) => {
        if (vocab?.label) lines.push(vocabLine(kind as ZoneEffectKind, vocab.label));
    });

    lines.push('NO OTHER NOTES. GONG IN 60.');

    lines.forEach(text => ctx.logEvent(text, [], { important: true, category: 'gamemaker' }));
}
