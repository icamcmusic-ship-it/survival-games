import React, { useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';
import { GameConfig } from '../models/types';

export function ShareButton({ seed, arenaId, gamemakerMode, config, quellId }: { seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig, quellId: string | null }) {
    const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    // On copy failure the URL is shown in a selectable field so the player can
    // copy it by hand instead of being told "Copy failed" with nothing to copy.
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
    const [seedCopied, setSeedCopied] = useState(false);

    // §1.10: the seed as text, not only as a URL. The full seed (base plus
    // any reroll suffix) is what every screen shows and what this copies.
    const copySeed = async () => {
        try {
            await navigator.clipboard?.writeText(seed);
            setSeedCopied(true);
            setTimeout(() => setSeedCopied(false), 2000);
        } catch {
            /* clipboard unavailable — the seed is on screen in the chip */
        }
    };

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
            // §2.6: "Vanilla Games" is not a cosmetic slider — it suppresses
            // the whole profile draw (temperament, calendar, cast shape), so a
            // link that left it out replayed a plain run as a modified one,
            // with a different cast.
            vanillaRules: String(!!config.vanillaRules),
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
                // §2.6: this used to carry four lines apologising for a bug —
                // the link and the on-screen seed disagreed after a reroll.
                // They do not any more: every screen shows the composite
                // `base~SUFFIX` seed, the link carries that same string plus
                // the arena, the Quell and the rules the run is executing, and
                // the reroll draws its cast from the same base config
                // `startGame` does. So the tooltip is one line again.
                title={`Copy a link that replays seed ${seed}`}
            >
                {status === 'copied'
                    ? <Check aria-hidden="true" className="w-3.5 h-3.5 text-[var(--color-coin-400)]" />
                    : <Share2 aria-hidden="true" className="w-3.5 h-3.5" />}
                {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Share'}
            </button>
            <button
                onClick={copySeed}
                className="chip"
                title={`Copy the seed ${seed} as text`}
            >
                {seedCopied ? <Check aria-hidden="true" className="w-3 h-3 inline" /> : <Copy aria-hidden="true" className="w-3 h-3 inline" />}
                {' '}seed {seed}
            </button>
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
