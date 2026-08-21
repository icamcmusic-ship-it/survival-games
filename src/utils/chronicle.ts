import { GameState } from '../models/types';

/**
 * SIDE-level export: a run produces ~900 lines of genuinely readable prose and
 * there was no way to get it out of the feed. Renders the chronicle as
 * Markdown, grouped the same way the EventFeed groups it, with the seed in the
 * header so a shared chronicle carries everything needed to replay it.
 */
export function chronicleMarkdown(state: GameState, importantOnly = false): string {
    const logs = importantOnly ? state.log.filter(l => l.important) : state.log;
    const winner = state.tributes.find(t => t.status === 'alive');
    const lines: string[] = [
        `# The ${state.arena.name} Games`,
        '',
        `- **Seed:** \`${state.seed}\``,
        `- **Arena:** ${state.arena.name}`,
        `- **Tributes:** ${state.tributes.length}`,
        winner
            ? `- **Victor:** ${winner.name} of District ${winner.district}`
            : (state.phase === 'ended' ? '- **Victor:** none — the arena won' : '- **Status:** in progress'),
        '',
    ];

    let currentKey = '';
    logs.forEach(log => {
        const key = log.day === 0
            ? log.phase.charAt(0).toUpperCase() + log.phase.slice(1)
            : `Day ${log.day} — ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
        if (key !== currentKey) {
            currentKey = key;
            lines.push(`## ${key}`, '');
        }
        lines.push(log.important ? `**${log.text}**` : log.text, '');
    });

    return lines.join('\n');
}

export function downloadChronicle(state: GameState, importantOnly = false) {
    const md = chronicleMarkdown(state, importantOnly);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `games-${state.seed}${importantOnly ? '-highlights' : ''}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export async function copyChronicle(state: GameState, importantOnly = false): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(chronicleMarkdown(state, importantOnly));
        return true;
    } catch {
        return false;
    }
}
