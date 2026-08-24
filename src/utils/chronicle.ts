import { EventLog, GameState } from '../models/types';

/**
 * SIDE-level export: a run produces ~900 lines of genuinely readable prose and
 * there was no way to get it out of the feed. Renders the chronicle as
 * Markdown, grouped the same way the EventFeed groups it, with the seed in the
 * header so a shared chronicle carries everything needed to replay it.
 */
export interface ChronicleFilter {
    importantOnly?: boolean;
    /** §2.7: "everything involving Rue" — one tribute's whole story. */
    tributeId?: string;
}

export function chronicleMarkdown(state: GameState, filter: boolean | ChronicleFilter = false): string {
    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const logs = state.log.filter(l =>
        (!f.importantOnly || l.important)
        && (!f.tributeId || l.tributesInvolved.includes(f.tributeId)));
    const followed = f.tributeId ? state.tributes.find(t => t.id === f.tributeId) : undefined;
    const winner = state.tributes.find(t => t.status === 'alive');
    const lines: string[] = [
        followed ? `# ${followed.name} of District ${followed.district} — The ${state.arena.name} Games` : `# The ${state.arena.name} Games`,
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

/**
 * §2.11: the same chronicle in the two formats people actually paste it into.
 *
 * Markdown was the only export, which is the wrong format for a forum post and
 * unreadable as a plain-text file. Plain text drops every marker; BBCode is
 * what the fan communities this genre lives in use.
 */
export type ChronicleFormat = 'markdown' | 'text' | 'bbcode' | 'prose';

export function chronicleText(
    state: GameState,
    filter: boolean | ChronicleFilter = false,
    format: ChronicleFormat = 'markdown',
): string {
    if (format === 'markdown') return chronicleMarkdown(state, filter);
    if (format === 'prose') return chronicleProse(state, filter);

    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const logs = state.log.filter(l =>
        (!f.importantOnly || l.important)
        && (!f.tributeId || l.tributesInvolved.includes(f.tributeId)));
    const winner = state.tributes.find(t => t.status === 'alive');
    const bb = format === 'bbcode';

    const title = `The ${state.arena.name} Games`;
    const lines: string[] = [
        bb ? `[size=150][b]${title}[/b][/size]` : title.toUpperCase(),
        bb ? '' : '='.repeat(title.length),
        `Seed: ${state.seed}`,
        `Arena: ${state.arena.name}`,
        `Tributes: ${state.tributes.length}`,
        winner
            ? `Victor: ${winner.name} of District ${winner.district}`
            : (state.phase === 'ended' ? 'Victor: none — the arena won' : 'Status: in progress'),
        '',
    ];

    let currentKey = '';
    logs.forEach(log => {
        const key = log.day === 0
            ? log.phase.charAt(0).toUpperCase() + log.phase.slice(1)
            : `Day ${log.day} — ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
        if (key !== currentKey) {
            currentKey = key;
            lines.push('', bb ? `[b]${key}[/b]` : `-- ${key} --`, '');
        }
        lines.push(log.important
            ? (bb ? `[b]${log.text}[/b]` : `* ${log.text}`)
            : log.text);
    });

    return lines.join('\n');
}

/**
 * §2.3: the chronicle as something a person would actually read.
 *
 * The three existing formats are all *transcripts* — a bulleted or tagged dump
 * of every line, with the phase headers as scaffolding. That is the right shape
 * for an archive and the wrong shape for the thing people actually share about
 * a simulator like this, which is a story. Prose keeps the day structure as
 * headings, drops the bullets and the markers, and joins each phase's lines
 * into paragraphs — the engine's flavour text is written in whole sentences, so
 * it reads as continuous narration the moment it stops being a list.
 */
export function chronicleProse(state: GameState, filter: boolean | ChronicleFilter = false): string {
    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const logs = state.log.filter(l =>
        (!f.importantOnly || l.important)
        && (!f.tributeId || l.tributesInvolved.includes(f.tributeId)));
    const winner = state.tributes.find(t => t.status === 'alive');
    const subject = f.tributeId ? state.tributes.find(t => t.id === f.tributeId) : undefined;

    const out: string[] = [];
    out.push(subject
        ? `${subject.name} of District ${subject.district}, in the ${state.arena.name}.`
        : `The ${state.arena.name} Games.`);
    out.push('');
    out.push(
        `${state.tributes.length} tributes went in. `
        + (winner
            ? `${winner.name} of District ${winner.district} came out, ${state.day} days later.`
            : state.phase === 'ended'
                ? `Nobody came out. The arena took all ${state.tributes.length} of them across ${state.day} days.`
                : 'It has not finished yet.')
        + ` (Seed ${state.seed} — the same seed replays the same Games.)`
    );

    let currentKey = '';
    let paragraph: string[] = [];
    const flush = () => {
        if (paragraph.length === 0) return;
        out.push('', paragraph.join(' '));
        paragraph = [];
    };
    logs.forEach(log => {
        const key = log.day === 0
            ? log.phase.charAt(0).toUpperCase() + log.phase.slice(1)
            : `Day ${log.day}, ${log.phase}`;
        if (key !== currentKey) {
            flush();
            currentKey = key;
            out.push('', key, '-'.repeat(key.length));
        }
        // A blank line every few sentences: one wall of text is no more
        // readable than a wall of bullets.
        paragraph.push(log.text);
        if (paragraph.length >= 4) flush();
    });
    flush();
    return out.join('\n');
}

const EXTENSION: Record<ChronicleFormat, string> = { markdown: 'md', text: 'txt', bbcode: 'bbcode.txt', prose: 'prose.txt' };
const MIME: Record<ChronicleFormat, string> = { markdown: 'text/markdown', text: 'text/plain', bbcode: 'text/plain', prose: 'text/plain' };

export function downloadChronicleAs(
    state: GameState,
    filter: boolean | ChronicleFilter,
    format: ChronicleFormat,
) {
    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const body = chronicleText(state, f, format);
    const blob = new Blob([body], { type: MIME[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const who = f.tributeId ? `-${state.tributes.find(t => t.id === f.tributeId)?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'tribute'}` : '';
    a.href = url;
    a.download = `games-${state.seed}${f.importantOnly ? '-highlights' : ''}${who}.${EXTENSION[format]}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function downloadChronicle(state: GameState, filter: boolean | ChronicleFilter = false) {
    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const md = chronicleMarkdown(state, f);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const who = f.tributeId ? `-${state.tributes.find(t => t.id === f.tributeId)?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'tribute'}` : '';
    a.href = url;
    a.download = `games-${state.seed}${f.importantOnly ? '-highlights' : ''}${who}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * S-6: the machine-readable export — the full log with the metadata players
 * would need to build their own tooling (stats sites, highlight reels,
 * cross-run analysis), plus the seed and config to reproduce the run.
 */
export function chronicleJson(state: GameState): string {
    return JSON.stringify({
        seed: state.seed,
        arena: { id: state.arena.id, name: state.arena.name },
        config: state.baseConfig,
        day: state.day,
        phase: state.phase,
        tributes: state.tributes.map(t => ({
            id: t.id, name: t.name, district: t.district, gender: t.gender, age: t.age,
            status: t.status, kills: t.kills, causeOfDeath: t.causeOfDeath, dayOfDeath: t.dayOfDeath,
        })),
        log: state.log.map(l => ({
            id: l.id, day: l.day, phase: l.phase, category: l.category,
            important: l.important, zone: l.zone, tributesInvolved: l.tributesInvolved, text: l.text,
        })),
    }, null, 2);
}

export function downloadChronicleJson(state: GameState) {
    const blob = new Blob([chronicleJson(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `games-${state.seed}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export async function copyChronicle(
    state: GameState,
    filter: boolean | ChronicleFilter = false,
    format: ChronicleFormat = 'markdown',
): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(chronicleText(state, filter, format));
        return true;
    } catch {
        return false;
    }
}

/** 74th, 71st, 103rd — the suffix the Capitol would use. */
function ordinal(n: number): string {
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/**
 * §2.6: one line, on its own.
 *
 * `ChronicleExport` handles the whole record and a per-tribute cut of it, both
 * of which are documents. What had no affordance at all was the single moment
 * — the line somebody actually wants to paste into a message — even though
 * `EventCategory` and the `important` flag already identify exactly which
 * lines those are.
 *
 * Carries the day, the phase and the seed, because a moment out of context is
 * just a sentence, and the seed is what makes it a thing somebody else can go
 * and watch.
 */
export function momentText(state: GameState, log: EventLog): string {
    const when = log.day === 0
        ? log.phase.charAt(0).toUpperCase() + log.phase.slice(1)
        : `Day ${log.day}, ${log.phase}`;
    const games = state.gamesProfile?.gamesNumber
        ? `the ${ordinal(state.gamesProfile.gamesNumber)} Hunger Games`
        : 'the Hunger Games';
    return `"${log.text}"\n\n— ${when}, ${games} (seed ${state.seed})`;
}

/** Copies one moment. Returns false when the clipboard is unavailable. */
export async function copyMoment(state: GameState, log: EventLog): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(momentText(state, log));
        return true;
    } catch {
        return false;
    }
}
