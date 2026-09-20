import { EventLog, GameState, Tribute } from '../models/types';
import { factLineOf } from '../ui/chronicleFacts';
import { victorsOf } from './notables';

function castLookup(state: GameState): Map<string, Tribute> {
    return new Map(state.tributes.map(t => [t.id, t]));
}

/**
 * AUDIT-10 B07: the arena's title, formatted once.
 *
 * Every export built `The ${arena.name} Games` by hand, which reads correctly
 * for "Frozen Wasteland" and produces "The The Vault Games" for the several
 * arenas whose authored name already carries the article.
 */
export function arenaTitle(state: GameState): string {
    const name = state.arena.name;
    return /^the\s/i.test(name) ? `${name} Games` : `The ${name} Games`;
}

/**
 * AUDIT-10 B07: what the run actually ended as, for a header line.
 *
 * `find(t => t.status === 'alive')` answered "who is standing" and was used to
 * answer "who won" — so an export taken during setup or mid-run crowned
 * whoever happened to be first in the cast array, and a dual win named one of
 * the two and silently dropped the other. Finished-ness is a property of the
 * run, not of the cast list.
 */
export function outcomeOf(state: GameState): { finished: boolean; winners: Tribute[] } {
    const finished = state.phase === 'ended';
    return { finished, winners: finished ? victorsOf(state) : [] };
}

function winnerNames(winners: Tribute[]): string {
    return winners.map(w => `${w.name} of District ${w.district}`).join(' and ');
}

/**
 * The header's outcome row, in the one wording every export shares — as
 * `Label: value`, so a caller can re-punctuate it for its own format.
 */
function victorLine(state: GameState): string {
    const { finished, winners } = outcomeOf(state);
    if (!finished) return 'Status: in progress';
    if (winners.length === 0) return 'Victor: none — the arena won';
    return `${winners.length > 1 ? 'Victors' : 'Victor'}: ${winnerNames(winners)}`;
}

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

export function chronicleMarkdown(state: GameState, filter: boolean | ChronicleFilter = false, facts = false): string {
    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const logs = state.log.filter(l =>
        (!f.importantOnly || l.important)
        && (!f.tributeId || l.tributesInvolved.includes(f.tributeId)));
    const byId = castLookup(state);
    const followed = f.tributeId ? state.tributes.find(t => t.id === f.tributeId) : undefined;
    const lines: string[] = [
        followed ? `# ${followed.name} of District ${followed.district} — ${arenaTitle(state)}` : `# ${arenaTitle(state)}`,
        '',
        `- **Seed:** \`${state.seed}\``,
        `- **Arena:** ${state.arena.name}`,
        `- **Tributes:** ${state.tributes.length}`,
        `- **${victorLine(state).replace(': ', ':** ')}`,
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
        const line = facts ? factLineOf(log, byId) : log.text;
        lines.push(log.important ? `**${line}**` : line, '');
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
    facts = false,
): string {
    if (format === 'markdown') return chronicleMarkdown(state, filter, facts);
    if (format === 'prose') return chronicleProse(state, filter);

    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const logs = state.log.filter(l =>
        (!f.importantOnly || l.important)
        && (!f.tributeId || l.tributesInvolved.includes(f.tributeId)));
    const byId = castLookup(state);
    const bb = format === 'bbcode';

    const title = arenaTitle(state);
    const lines: string[] = [
        bb ? `[size=150][b]${title}[/b][/size]` : title.toUpperCase(),
        bb ? '' : '='.repeat(title.length),
        `Seed: ${state.seed}`,
        `Arena: ${state.arena.name}`,
        `Tributes: ${state.tributes.length}`,
        victorLine(state),
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
        const line = facts ? factLineOf(log, byId) : log.text;
        lines.push(log.important
            ? (bb ? `[b]${line}[/b]` : `* ${line}`)
            : line);
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
    const { finished, winners } = outcomeOf(state);
    const subject = f.tributeId ? state.tributes.find(t => t.id === f.tributeId) : undefined;

    const out: string[] = [];
    out.push(subject
        ? `${subject.name} of District ${subject.district}, in the ${state.arena.name}.`
        : `${arenaTitle(state)}.`);
    out.push('');
    out.push(
        `${state.tributes.length} tributes went in. `
        + (winners.length > 0
            ? `${winnerNames(winners)} came out, ${state.day} days later.`
            : finished
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
    facts = false,
) {
    const f: ChronicleFilter = typeof filter === 'boolean' ? { importantOnly: filter } : filter;
    const body = chronicleText(state, f, format, facts);
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
        // AUDIT-10 B07: the machine-readable export states the outcome
        // explicitly rather than leaving a consumer to infer it from `status`.
        finished: outcomeOf(state).finished,
        victors: outcomeOf(state).winners.map(w => ({ id: w.id, name: w.name, district: w.district })),
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
    facts = false,
): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(chronicleText(state, filter, format, facts));
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
export function momentText(state: GameState, log: EventLog, facts = false): string {
    const when = log.day === 0
        ? log.phase.charAt(0).toUpperCase() + log.phase.slice(1)
        : `Day ${log.day}, ${log.phase}`;
    const games = state.gamesProfile?.gamesNumber
        ? `the ${ordinal(state.gamesProfile.gamesNumber)} Hunger Games`
        : 'the Hunger Games';
    const line = facts ? factLineOf(log, castLookup(state)) : log.text;
    return `"${line}"\n\n— ${when}, ${games} (seed ${state.seed})`;
}

/** Copies one moment. Returns false when the clipboard is unavailable. */
export async function copyMoment(state: GameState, log: EventLog, facts = false): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(momentText(state, log, facts));
        return true;
    } catch {
        return false;
    }
}
