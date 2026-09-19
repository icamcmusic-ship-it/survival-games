import React, { useState } from 'react';
import { Hint } from './Hint';
import { useTransientFlag } from '../ui/useTransientFlag';
import { Share2, Check, Copy } from 'lucide-react';
import { CampaignSnapshot, GameConfig } from '../models/types';
import { encodeCampaign } from '../utils/campaignLink';

/**
 * AUDIT-7 §1.1: the share payload, hoisted out of the component so a check can
 * read it.
 *
 * A Share link is the game's second replay path (the Hall of Fame's "relaunch"
 * is the first), and it is only a replay if it carries everything the run was
 * played under. Three separate audits have found a field missing from this
 * list — `vanillaRules`, then `singleVictor` and the age pair, then the five
 * sanity dials — each one found by somebody noticing a replay that did not
 * replay, never by a check.
 *
 * So the list is now *enumerable*. `check-storage-migrations` asserts that
 * every key of `GameConfig` is either produced here or named in
 * `SHARE_OMITS`, and fails the build otherwise. Adding a field to the type and
 * forgetting it here is no longer something a player has to discover.
 */
export const SHARE_OMITS: ReadonlyArray<keyof GameConfig> = [
    // Nothing. Every setting a player can change travels with the link. Entries
    // here need a reason in a comment, and "we forgot" is not one.
];

export function shareParams(
    { seed, arenaId, gamemakerMode, config, quellId, campaign }:
    {
        seed: string; arenaId: string; gamemakerMode: boolean; config: GameConfig; quellId: string | null;
        /**
         * AUDIT-9 B06: the sender's record book, when they are sharing the
         * *run* rather than the *seed*.
         *
         * Campaign history is a real input to a run — district standing,
         * sponsor trust, patronage, mentors, the incumbent Head Gamemaker —
         * and it was the one input a link never carried, so two players with
         * different careers got different Games from the same link and neither
         * had any way to know. Included, the link reproduces the run;
         * omitted, it hands over the seed and the receiver's own campaign
         * applies. Both are useful; the difference is now a choice.
         */
        campaign?: CampaignSnapshot;
    },
): URLSearchParams {
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
        // §8/§18 (requests): the same argument as `vanillaRules`. The age
        // distribution decides the cast, and "one victor only" decides how
        // the run can end, so a link that dropped either replayed somebody
        // else's Games under their seed. 'bowl' is the absent case — the
        // canon draw — which is not the same as any particular mean.
        singleVictor: String(!!config.singleVictor),
        ageMean: config.ageMean === undefined ? 'bowl' : String(config.ageMean),
        ageSpread: config.ageSpread === undefined ? 'bowl' : String(config.ageSpread),
        // Pin this run's exact Quarter Quell (or explicit lack of one) the
        // same way HallOfFameEntry.quellId does — without it a link to a
        // forced-Quell run replays as an ordinary year.
        quell: quellId ?? 'none',
        /*
         * AUDIT-7 §1.1: the sanity block, which had sliders, read sites in
         * four engine files, and no place in this list.
         *
         * `sanityStart` decides where the whole cast begins, the two rates
         * scale everything that wears a mind down or builds it back, and
         * the two switches gate the hallucination set pieces and the
         * night-time breakdowns. Measured over twelve seeds, changing any
         * one of them diverged the run 12 times out of 12 — so a link
         * copied from a frayed-field run replayed an ordinary one, with a
         * different victor, under the same seed.
         *
         * Same argument as `vanillaRules`, `singleVictor` and the age pair
         * above. The rule this list is now held to: every key of
         * `GameConfig` is either here or named in SHARE_OMITS, and
         * `check-storage-migrations` fails the build if one is neither.
         */
        sanityDrainRate: String(config.sanityDrainRate ?? 1),
        sanityRecoveryRate: String(config.sanityRecoveryRate ?? 1),
        sanityStart: String(config.sanityStart ?? 100),
        enableHallucinations: String(config.enableHallucinations !== false),
        enableBreakdowns: String(config.enableBreakdowns !== false),
    });
    // AUDIT-9 B06: opaque and optional, so a seed link stays as short as it
    // has always been and a run link is complete.
    if (campaign) params.set('campaign', encodeCampaign(campaign));
    return params;
}

export function ShareButton(
    { seed, arenaId, gamemakerMode, config, quellId, campaign }:
    {
        seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig, quellId: string | null,
        campaign?: CampaignSnapshot,
    },
) {
    const [status, setStatus] = useTransientFlag<'idle' | 'copied' | 'failed'>('idle', 2000);
    // On copy failure the URL is shown in a selectable field so the player can
    // copy it by hand instead of being told "Copy failed" with nothing to copy.
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
    const [seedCopied, setSeedCopied] = useTransientFlag(false, 2000);

    // §1.10: the seed as text, not only as a URL. The full seed (base plus
    // any reroll suffix) is what every screen shows and what this copies.
    const copySeed = async () => {
        try {
            await navigator.clipboard?.writeText(seed);
            setSeedCopied(true);
        } catch {
            /* clipboard unavailable — the seed is on screen in the chip */
        }
    };

    const buildUrl = (withCampaign: boolean) => {
        const params = shareParams({
            seed, arenaId, gamemakerMode, config, quellId,
            campaign: withCampaign ? campaign : undefined,
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const handleShare = async (withCampaign = false) => {
        const url = buildUrl(withCampaign);
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
    };

    return (
        <span className="inline-flex items-center gap-2">
            <Hint text={`Copy a link that replays seed ${seed}`}>
            <button
                onClick={() => handleShare(false)}
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
            >
                {status === 'copied'
                    ? <Check aria-hidden="true" className="w-3.5 h-3.5 text-[var(--color-coin-400)]" />
                    : <Share2 aria-hidden="true" className="w-3.5 h-3.5" />}
                {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Share'}
            </button>
            </Hint>
            {campaign && campaign.runs > 0 && (
                /*
                 * AUDIT-9 B06: the second, explicit action.
                 *
                 * Only offered when there is a career to carry — with an empty
                 * record book the two links are identical and a second button
                 * would be noise. The plain Share button above is unchanged
                 * and still means "this seed, your campaign", which is what
                 * every link written before this meant.
                 */
                <Hint text="Copy a link that reproduces this exact run, including the record book it was played under">
                    <button onClick={() => handleShare(true)} className="btn btn-sm">
                        <Share2 aria-hidden="true" className="w-3.5 h-3.5" />
                        Share run
                    </button>
                </Hint>
            )}
            <Hint text={`Copy the seed ${seed} as text`}>
                <button onClick={copySeed} className="chip">
                    {seedCopied ? <Check aria-hidden="true" className="w-3 h-3 inline" /> : <Copy aria-hidden="true" className="w-3 h-3 inline" />}
                    {' '}seed {seed}
                </button>
            </Hint>
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
