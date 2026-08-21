import React, { useState } from 'react';
import { GameState } from '../models/types';
import { copyChronicle, downloadChronicle, downloadChronicleJson } from '../utils/chronicle';

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

    return (
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Export the chronicle">
            <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-live="polite"
                aria-label={copied === 'ok' ? 'Chronicle copied to clipboard' : 'Copy the chronicle to the clipboard as Markdown'}
                onClick={async () => {
                    const ok = await copyChronicle(gameState, importantOnly);
                    setCopied(ok ? 'ok' : 'fail');
                    setTimeout(() => setCopied('idle'), 2500);
                }}
            >
                {copied === 'ok' ? 'Chronicle copied' : copied === 'fail' ? 'Copy failed' : 'Copy chronicle'}
            </button>
            <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label="Download the chronicle as a Markdown file"
                onClick={() => downloadChronicle(gameState, importantOnly)}
            >
                Download as Markdown
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
