import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { GameConfig } from '../models/types';

export function ShareButton({ seed, arenaId, gamemakerMode, config, quellId }: { seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig, quellId: string | null }) {
    const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    // On copy failure the URL is shown in a selectable field so the player can
    // copy it by hand instead of being told "Copy failed" with nothing to copy.
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

    const buildUrl = () => {
        const params = new URLSearchParams({
            seed,
            arena: arenaId,
            gamemaker: String(gamemakerMode),
            districtCount: String(config.districtCount),
            hazardRate: String(config.hazardRate),
            betrayalRate: String(config.betrayalRate),
            sponsorGenerosity: String(config.sponsorGenerosity),
            enableFeast: String(config.enableFeast),
            enableSanity: String(config.enableSanity),
            plainNames: String(!!config.plainNames),
            // Pin this run's exact Quarter Quell (or explicit lack of one) the
            // same way HallOfFameEntry.quellId does — without it a link to a
            // forced-Quell run replays as an ordinary year.
            quell: quellId ?? 'none',
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const handleShare = async () => {
        const url = buildUrl();
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
            setFallbackUrl(null);
        } catch {
            setStatus('failed');
            setFallbackUrl(url);
        }
        setTimeout(() => setStatus('idle'), 2000);
    };

    return (
        <span className="inline-flex items-center gap-2">
            <button
                onClick={handleShare}
                className="btn btn-sm"
                // No aria-label here on purpose: the button's own text is what
                // changes to "Copied", and a static label would silence that.
                // §1.8: a rerolled cast composes its seed as `base~SUFFIX`,
                // where the suffix is a non-seeded `Math.random()`. The share
                // link encodes the composite verbatim, which replays correctly
                // — but the UI elsewhere shows the base, so the displayed seed
                // and the "real" one diverge. Say the composite out loud here.
                title={seed.includes('~')
                    ? `Copy a link that replays this exact rerolled cast. The full seed is ${seed} — the part after the ~ is what the reroll drew, and a link without it replays the original cast instead.`
                    : `Copy a link that replays seed ${seed}`}
            >
                {status === 'copied'
                    ? <Check aria-hidden="true" className="w-3.5 h-3.5 text-[var(--color-coin-400)]" />
                    : <Share2 aria-hidden="true" className="w-3.5 h-3.5" />}
                {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Share'}
            </button>
            {seed.includes('~') && (
                <span
                    className="chip"
                    title={`This cast was rerolled. The full seed is ${seed}; the base seed alone (${seed.split('~')[0]}) replays the original cast.`}
                >
                    seed {seed}
                </span>
            )}
            {fallbackUrl && (
                <input
                    className="field text-xs w-52"
                    readOnly
                    value={fallbackUrl}
                    aria-label="Share link — copy manually"
                    onFocus={e => e.currentTarget.select()}
                />
            )}
        </span>
    );
}
