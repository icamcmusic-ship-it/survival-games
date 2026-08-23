import React, { useState } from 'react';
import { GameState } from '../models/types';
import { ChronicleFormat, copyChronicle, downloadChronicleAs, downloadChronicleJson } from '../utils/chronicle';

/**
 * "Copy chronicle" / "Download as Markdown" — the cheapest retention feature
 * available: people share stories, and every exported chronicle carries the
 * seed needed to replay it.
 */
export function ChronicleExport({ gameState, importantOnly = false }: {
    gameState: GameState;
    importantOnly?: boolean;
}) {
    const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
    // §2.7: per-tribute chronicle — "everything involving Rue" as one file.
    const [tributeId, setTributeId] = useState('');
    // §2.11: markdown was the only format. A forum post wants BBCode and a
    // plain-text file wants no markers at all.
    const [format, setFormat] = useState<ChronicleFormat>('markdown');
    const filter = { importantOnly, tributeId: tributeId || undefined };

    return (
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Export the chronicle">
            <select
                value={tributeId}
                onChange={e => setTributeId(e.target.value)}
                className="field text-xs w-auto"
                aria-label="Export only one tribute's story"
                title="Export only the lines involving one tribute"
            >
                <option value="">Whole chronicle</option>
                {[...gameState.tributes].sort((a, b) => a.district - b.district).map(t => (
                    <option key={t.id} value={t.id}>{t.name} (D{t.district}){t.status === 'dead' ? ' †' : ''}</option>
                ))}
            </select>
            <select
                value={format}
                onChange={e => setFormat(e.target.value as ChronicleFormat)}
                className="field text-xs w-auto"
                aria-label="Export format"
                title="Markdown for a document, BBCode for a forum post, plain text for anything else"
            >
                <option value="markdown">Markdown</option>
                <option value="text">Plain text</option>
                <option value="bbcode">BBCode</option>
            </select>
            <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-live="polite"
                aria-label={copied === 'ok' ? 'Chronicle copied to clipboard' : 'Copy the chronicle to the clipboard as Markdown'}
                onClick={async () => {
                    const ok = await copyChronicle(gameState, filter, format);
                    setCopied(ok ? 'ok' : 'fail');
                    setTimeout(() => setCopied('idle'), 2500);
                }}
            >
                {copied === 'ok' ? 'Chronicle copied' : copied === 'fail' ? 'Copy failed' : 'Copy chronicle'}
            </button>
            <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label="Download the chronicle as a file"
                onClick={() => downloadChronicleAs(gameState, filter, format)}
            >
                Download
            </button>
            <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label="Download the full run as machine-readable JSON, including the seed and settings needed to replay it"
                title="The full log with metadata — for building your own tooling"
                onClick={() => downloadChronicleJson(gameState)}
            >
                Download as JSON
            </button>
        </div>
    );
}
