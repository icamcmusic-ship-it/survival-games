import { GameState, Tribute } from '../models/types';
import { fearOf } from '../engine/fear';
import { TRAIT_DEFS } from '../data/traits';

/**
 * SIDE: a tribute's-eye chronicle (§9.3 of the audit).
 *
 * All the data for "their whole story" already exists — memory.mourned,
 * memory.rivals, memory.fear, debts, protectorBonds, proficiencies,
 * lastDamage and the involved-tribute index on every log line. This
 * assembles it into one readable Markdown narrative: who they feared, who
 * they owed, who they mourned, and what ended them. Turns 24 tributes into
 * 24 stories.
 */
export function tributeStoryMarkdown(state: GameState, tribute: Tribute): string {
    const name = (id: string) => state.tributes.find(t => t.id === id)?.name ?? 'someone';
    const mem = tribute.memory;
    const lines: string[] = [
        `# ${tribute.name} of District ${tribute.district}`,
        '',
        `*${state.arena.name} — seed \`${state.seed}\`*`,
        '',
    ];

    // The arc in one line.
    if (tribute.status === 'alive' && state.phase === 'ended') {
        lines.push(`**Victor.** ${tribute.name} outlived ${state.tributes.length - 1} others and walked out of the arena on day ${state.day}.`);
    } else if (tribute.status === 'dead') {
        lines.push(`**Fallen — day ${tribute.dayOfDeath ?? '?'}.** ${tribute.causeOfDeath ?? 'Cause unrecorded.'}`);
    } else {
        lines.push(`**Still in the arena** — day ${state.day}, ${tribute.health} health, ${tribute.kills} kill${tribute.kills === 1 ? '' : 's'}.`);
    }
    lines.push('');

    // The people in their story.
    const people: string[] = [];
    const feared = state.tributes
        .map(o => ({ o, v: fearOf(tribute, o.id) }))
        .filter(f => f.o.id !== tribute.id && f.v >= 25)
        .sort((a, b) => b.v - a.v)
        .slice(0, 3);
    if (feared.length > 0) {
        people.push(`They feared ${feared.map(f => f.o.name).join(', ')} — and acted on it.`);
    }
    const debts = Object.entries(tribute.debts ?? {}).filter(([, v]) => v > 0);
    if (debts.length > 0) {
        people.push(`They owed ${debts.map(([id]) => name(id)).join(' and ')} for keeping them alive.`);
    }
    if ((mem?.stoodBy?.length ?? 0) > 0) {
        people.push(`They took real risks for ${mem!.stoodBy.map(name).join(', ')}.`);
    }
    if ((tribute.protectorBonds?.length ?? 0) > 0) {
        people.push(`They appointed themselves protector of ${tribute.protectorBonds!.map(name).join(' and ')}.`);
    }
    if ((mem?.betrayedBy?.length ?? 0) > 0) {
        people.push(`They were sold out by ${mem!.betrayedBy.map(name).join(' and ')}, and did not forget it.`);
    }
    if ((mem?.vengeance?.length ?? 0) > 0) {
        people.push(`They swore vengeance against ${mem!.vengeance.map(name).join(' and ')}.`);
    }
    const feuds = Object.entries(mem?.rivals ?? {})
        .filter(([, r]) => r.fights >= 2)
        .sort((a, b) => b[1].fights - a[1].fights)
        .slice(0, 3);
    if (feuds.length > 0) {
        people.push(`Their feuds: ${feuds.map(([id, r]) => `${name(id)} (${r.fights} fights)`).join(', ')}.`);
    }
    if ((mem?.mourned?.length ?? 0) > 0) {
        people.push(`They grieved for ${mem!.mourned.map(name).join(', ')}.`);
    }
    if (people.length > 0) {
        lines.push('## The people', '', ...people.map(p => `- ${p}`), '');
    }

    // What they became.
    const profs = Object.entries(tribute.proficiencies ?? {})
        .filter(([, v]) => (v ?? 0) >= 1.5)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    const became: string[] = [];
    if (profs.length > 0) became.push(`The arena taught them ${profs.map(([k]) => k).join(', ')}.`);
    const earned = tribute.traits.filter(t => TRAIT_DEFS[t]?.earned);
    if (earned.length > 0) became.push(`It named them: ${earned.join(', ')}.`);
    if (became.length > 0) lines.push('## What they became', '', ...became.map(p => `- ${p}`), '');

    // The chronicle itself, filtered to them.
    const personal = state.log.filter(l => l.tributesInvolved.includes(tribute.id));
    lines.push(`## Their chronicle (${personal.length} entries)`, '');
    let currentKey = '';
    personal.forEach(log => {
        const key = log.day === 0
            ? log.phase.charAt(0).toUpperCase() + log.phase.slice(1)
            : `Day ${log.day} — ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
        if (key !== currentKey) {
            currentKey = key;
            lines.push(`### ${key}`, '');
        }
        lines.push(log.important ? `**${log.text}**` : log.text, '');
    });

    return lines.join('\n');
}

export async function copyTributeStory(state: GameState, tribute: Tribute): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(tributeStoryMarkdown(state, tribute));
        return true;
    } catch {
        return false;
    }
}

export function downloadTributeStory(state: GameState, tribute: Tribute) {
    const blob = new Blob([tributeStoryMarkdown(state, tribute)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tribute.name.toLowerCase().replace(/\s+/g, '-')}-${state.seed}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
