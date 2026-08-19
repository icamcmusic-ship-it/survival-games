import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

export function ShareButton({ seed, arenaId, gamemakerMode }: { seed: string, arenaId: string, gamemakerMode: boolean }) {
    const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

    const handleShare = async () => {
        const url = `${window.location.origin}${window.location.pathname}?seed=${encodeURIComponent(seed)}&arena=${encodeURIComponent(arenaId)}&gamemaker=${gamemakerMode}`;
        try {
            // navigator.clipboard is unavailable over plain HTTP and in some
            // embedded browsers; fall back to a selection copy rather than
            // failing silently.
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const el = document.createElement('textarea');
                el.value = url;
                el.setAttribute('readonly', '');
                el.style.position = 'fixed';
                el.style.opacity = '0';
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }
            setStatus('copied');
        } catch {
            setStatus('failed');
        }
        setTimeout(() => setStatus('idle'), 2000);
    };

    return (
        <button onClick={handleShare} className="btn btn-sm" title="Copy a link that replays this exact run">
            {status === 'copied' ? <Check className="w-3.5 h-3.5 text-[var(--color-coin-400)]" /> : <Share2 className="w-3.5 h-3.5" />}
            {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Share'}
        </button>
    );
}
