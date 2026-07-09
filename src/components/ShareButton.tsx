import React, { useState } from 'react';
import { Share2 } from 'lucide-react';

export function ShareButton({ seed, arenaId, gamemakerMode }: { seed: string, arenaId: string, gamemakerMode: boolean }) {
    const [copied, setCopied] = useState(false);

    const handleShare = () => {
        const url = `${window.location.origin}${window.location.pathname}?seed=${seed}&arena=${arenaId}&gamemaker=${gamemakerMode}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <button
            onClick={handleShare}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-350 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
        >
            <Share2 className="w-3.5 h-3.5 text-zinc-400" />
            {copied ? 'Copied Link!' : 'Share Run'}
        </button>
    );
}
