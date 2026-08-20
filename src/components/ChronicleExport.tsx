import React, { useState } from 'react';
import { GameState } from '../models/types';
import { copyChronicle, downloadChronicle } from '../utils/chronicle';

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
        <div className="flex items-center gap-2 flex-wrap">
            <button
                type="button"
                className="btn btn-sm btn-ghost"
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
                onClick={() => downloadChronicle(gameState, importantOnly)}
            >
                Download as Markdown
            </button>
        </div>
    );
}
