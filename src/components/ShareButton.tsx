import React, { useState } from 'react';
import { Hint } from './Hint';
import { useTransientFlag } from '../ui/useTransientFlag';
import { Share2, Check, Copy } from 'lucide-react';
import { CampaignSnapshot, GameConfig, GameState } from '../models/types';
import { encodeCampaign } from '../utils/campaignLink';
import { DEFAULT_GAME_CONFIG } from '../data/constants';
import { copyMessage, copySucceeded, copyText } from '../utils/copyText';
import { CONTENT_REVISION, fidelityOf, shareLabelFor } from '../utils/replayManifest';

/**
 * B3-01: how many interventions fit in the link.
 *
 * Browsers and the places links get pasted both have limits, and the campaign
 * snapshot is already the expensive passenger. An entry is around twenty
 * characters; forty of them is under a kilobyte, and a run with more than forty
 * Gamemaker commands in it is a run the receiver will be told diverges rather
 * than one silently truncated into a false 'exact'.
 */
// balance-exempt: a URL length budget, not a lever on anything the simulation does
const MAX_LOGGED_ACTS = 40;

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
    { seed, arenaId, gamemakerMode, config, quellId, campaign, veteransSeated, interventions, interventionLog }:
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
        /**
         * AUDIT-10 F19: inputs the link cannot carry, declared so the receiver
         * is told what kind of reproduction this is.
         *
         * Grudge-Match veterans are identities out of the *sender's* Hall of
         * Fame and cannot be resolved against the receiver's archive;
         * interventions are player actions with no place in a static payload.
         * Both are counted into the manifest so the link can say "same starting
         * conditions" instead of "exact run".
         */
        veteransSeated?: number;
        interventions?: number;
        /**
         * AUDIT-10 B3-01: the interventions themselves, not just how many.
         *
         * Each command's random stream is derived from (seed, cycle, type,
         * command index), so firing the same list at the same cycles reproduces
         * them exactly. Target ids are `d{district}-{gender}`, which is fixed by
         * the config rather than the seed, so they resolve in the receiver's
         * field too.
         */
        interventionLog?: GameState['interventionLog'];
    },
): URLSearchParams {
    const params = new URLSearchParams({
        seed,
        arena: arenaId,
        gamemaker: String(gamemakerMode),
        districtCount: String(config.districtCount),
        hazardRate: String(config.hazardRate),
        betrayalRate: String(config.betrayalRate),
        // The death-mix dials decide how many people the arena kills and how
        // many the tributes do, so a link that dropped either replayed a
        // different Games under the same seed.
        naturalDeathRate: String(config.naturalDeathRate ?? DEFAULT_GAME_CONFIG.naturalDeathRate),
        bloodbathDeathShare: String(config.bloodbathDeathShare ?? DEFAULT_GAME_CONFIG.bloodbathDeathShare),
        arenaDeathShare: String(config.arenaDeathShare ?? DEFAULT_GAME_CONFIG.arenaDeathShare),
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
        // AUDIT-11 §12: the mutator cards change the run; empty is none.
        mutators: (config.mutators ?? []).join(','),
    });
    // AUDIT-9 B06: opaque and optional, so a seed link stays as short as it
    // has always been and a run link is complete.
    if (campaign) params.set('campaign', encodeCampaign(campaign));
    /*
     * AUDIT-10 F19: version the manifest and state what it could not carry.
     *
     * `mv` is the manifest version — 2 since B3-01 added `log` — so a payload
     * shape can be told from an older one rather than guessed at. `rev` is the engine/content revision the
     * run executed on, so a link recorded on another build is describable as
     * such instead of presented as a replay that quietly diverges. `vets` and
     * `acts` are counts of the two kinds of input the link is known not to
     * carry. None of them changes the simulation; all of them change what the
     * receiver is told.
     */
    params.set('mv', '2');
    params.set('rev', CONTENT_REVISION);
    if (veteransSeated) params.set('vets', String(veteransSeated));
    if (interventions) params.set('acts', String(interventions));
    /*
     * B3-01: `acts` is the count and `log` is the recording. A URL is a bounded
     * place to put a list, so the log is capped and the count is not — which is
     * exactly why the manifest asks how many were *carried* rather than
     * assuming a log means all of them. A truncated log reads as `conditions`,
     * which is the truth.
     */
    const carried = (interventionLog ?? []).slice(0, MAX_LOGGED_ACTS);
    if (carried.length > 0) {
        params.set('log', carried
            .map(a => `${a.cycle}.${a.type}${a.targetId ? `.${a.targetId}` : ''}${a.scheduled ? '!' : ''}`)
            .join('~'));
    }
    return params;
}

export function ShareButton(
    { seed, arenaId, gamemakerMode, config, quellId, campaign, veteransSeated = 0, interventions = 0, interventionLog }:
    {
        seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig, quellId: string | null,
        campaign?: CampaignSnapshot,
        /** F19: inputs a link cannot carry. See `shareParams`. */
        veteransSeated?: number,
        interventions?: number,
        /** B3-01: the ones it now can. */
        interventionLog?: GameState['interventionLog'],
    },
) {
    const [status, setStatus] = useTransientFlag<'idle' | 'copied' | 'failed'>('idle', 2000);
    // On copy failure the URL is shown in a selectable field so the player can
    // copy it by hand instead of being told "Copy failed" with nothing to copy.
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
    const [seedCopied, setSeedCopied] = useTransientFlag(false, 2000);
    /**
     * AUDIT-10 F16: what the last copy attempt actually did, announced.
     *
     * A tick that appears whether or not anything reached the clipboard is
     * worse than no tick: the player walks away believing they have the link.
     * This is the status the live region reads out, and it is only ever set
     * from a verified result.
     */
    const [copyStatus, setCopyStatus] = useState<string | null>(null);

    // §1.10: the seed as text, not only as a URL. The full seed (base plus
    // any reroll suffix) is what every screen shows and what this copies.
    //
    // F16: this used to `await navigator.clipboard?.writeText(seed)` — which is
    // `await undefined` when there is no clipboard, and therefore resolved, and
    // therefore ticked, in exactly the browsers that cannot copy. It goes
    // through the shared helper, which verifies, and the seed stays visible in
    // the chip as its own fallback.
    const copySeed = async () => {
        const result = await copyText(seed);
        setCopyStatus(copyMessage(result, 'Seed'));
        if (copySucceeded(result)) setSeedCopied(true);
    };

    /**
     * F19: what the strongest link this run can produce actually promises.
     * Computed from the run, not asserted by the button's caption.
     */
    const runFidelity = fidelityOf({
        campaign: !!campaign,
        campaignRejected: false,
        revision: CONTENT_REVISION,
        veteransSeated,
        interventions,
        carriedInterventions: Math.min(interventions, (interventionLog ?? []).length, MAX_LOGGED_ACTS),
    });

    const buildUrl = (withCampaign: boolean) => {
        const params = shareParams({
            seed, arenaId, gamemakerMode, config, quellId,
            campaign: withCampaign ? campaign : undefined,
            veteransSeated, interventions, interventionLog,
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const handleShare = async (withCampaign = false) => {
        const url = buildUrl(withCampaign);
        /*
         * F16: the fallback path's own return value used to be discarded —
         * `document.execCommand('copy')` returns false for a copy the browser
         * declined, and this reported it as a success. One helper now owns
         * every path and every outcome, and "Copy failed" is shown with the
         * link in a selectable field rather than on its own.
         */
        const result = await copyText(url);
        setCopyStatus(copyMessage(result, 'Link'));
        if (copySucceeded(result)) {
            setStatus('copied');
            setFallbackUrl(null);
        } else {
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
                /*
                 * AUDIT-10 F19: the label and the tooltip say what this link
                 * can actually do. "Reproduces this exact run" was untrue for
                 * any run that seated archived victors or that the player
                 * intervened in, because neither travels in a URL.
                 */
                <Hint text={runFidelity === 'exact'
                    ? 'Copy a link that reproduces this run: the seed, the rules and the record book it was played under'
                    : 'Copy a link that reproduces this run\'s starting conditions. Seated victors and Gamemaker interventions cannot travel in a link, so the Games will diverge.'}>
                    <button onClick={() => handleShare(true)} className="btn btn-sm">
                        <Share2 aria-hidden="true" className="w-3.5 h-3.5" />
                        {shareLabelFor(runFidelity)}
                    </button>
                </Hint>
            )}
            <Hint text={`Copy the seed ${seed} as text`}>
                <button onClick={copySeed} className="chip">
                    {seedCopied ? <Check aria-hidden="true" className="w-3 h-3 inline" /> : <Copy aria-hidden="true" className="w-3 h-3 inline" />}
                    {' '}seed {seed}
                </button>
            </Hint>
            {/*
              * F16: announced rather than only drawn. A tick changing colour is
              * not a result a screen reader user is told about, and the failure
              * cases are precisely the ones worth hearing.
              */}
            <span role="status" aria-live="polite" className="sr-only">{copyStatus ?? ''}</span>
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
