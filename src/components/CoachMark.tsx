import React, { useEffect, useMemo, useState } from 'react';
import { GameState } from '../models/types';
import { X } from 'lucide-react';
import { markCoachMarkSeen, prefsStore } from '../store/prefsStore';
import { useStore } from '../store/createStore';
import { categoryMeta } from '../ui/eventStyles';

/**
 * §2.9: contextual onboarding, as against front-loaded onboarding.
 *
 * `Explainer.tsx` is good and it is on-demand: a reader who already knows to
 * ask "why is this number what it is" gets a very good answer. What was missing
 * is the other reader — the one who does not yet know there is a question. All
 * the teaching for them lived in one static panel shown before the first
 * tribute has done anything, which is the worst possible moment for it: there
 * is nothing on screen yet to attach any of it to.
 *
 * These are the three moments a first run generates its own teachable
 * instants — the first death, the first alliance, the first sponsor gift — and
 * each gets exactly one line, once, at the moment the thing happens. Then it is
 * marked seen in prefs and never appears again, on any run.
 *
 * Deliberately one line and deliberately dismissible. A tooltip that has to be
 * read before the run continues is a modal wearing a hat.
 */

interface Mark {
    id: string;
    /** The log category whose first appearance triggers it. */
    categories: readonly string[];
    title: string;
    body: string;
}

const MARKS: readonly Mark[] = [
    {
        id: 'first-death',
        categories: ['death', 'kill'],
        title: 'A cannon',
        body: 'One cannon, one tribute. Their sheet stays readable for the rest of the run — how they died is part '
            + 'of the record, and the people who saw it will carry it.',
    },
    {
        id: 'first-alliance',
        categories: ['alliance'],
        title: 'An alliance',
        body: 'Nobody was told to do that. Alliances form out of regard, shared districts and plain need, and every '
            + 'one of them ends — the question the arena is asking is how.',
    },
    {
        id: 'first-sponsor',
        categories: ['sponsor'],
        title: 'A sponsor gift',
        body: 'The crowd is watching, and somebody just paid for a parachute. What arrives is what that tribute '
            + 'needed most, which is why keeping them interesting matters as much as keeping them alive.',
    },
];

/**
 * Watches the log for the first line of each kind and shows one line about it.
 *
 * Reads the whole log rather than only new entries so a resumed save does not
 * fire three marks at once for things that happened days ago: anything already
 * in the log when this mounts is treated as already seen.
 */
export function CoachMarks({ gameState }: { gameState: GameState }) {
    const seen = useStore(prefsStore, p => p.seenCoachMarks);
    const [dismissed, setDismissed] = useState<string[]>([]);
    // The log length at mount. Everything before it is history, not a moment.
    const [baseline] = useState(() => gameState.log.length);

    const active = useMemo(() => {
        const fresh = gameState.log.slice(baseline);
        return MARKS.find(mark =>
            !seen.includes(mark.id)
            && !dismissed.includes(mark.id)
            && fresh.some(l => mark.categories.includes(l.category)));
    }, [gameState.log, baseline, seen, dismissed]);

    // Marked seen as soon as it is shown, not when it is dismissed: a reader
    // who navigates away rather than clicking the X has still had their one
    // chance at it, and firing it again next run would be worse than not.
    useEffect(() => {
        if (active) markCoachMarkSeen(active.id);
    }, [active]);

    if (!active) return null;
    const meta = categoryMeta(active.categories[0] as never);

    return (
        <div
            className="panel-flush p-3 flex items-start gap-3 animate-riseIn"
            role="note"
            // The death interstitial in EventFeed is also role="note", so this
            // carries a stable data hook as well as its label — a test (or a
            // reader tabbing through) has to be able to tell them apart.
            data-coach-mark={active.id}
            aria-label={`First time: ${active.title}`}
            style={{ borderLeft: `3px solid ${meta.color}` }}
        >
            <span className="cat-glyph text-lg leading-none mt-0.5" aria-hidden="true" style={{ color: meta.color }}>
                {meta.glyph}
            </span>
            <div className="min-w-0 flex-1">
                <div className="eyebrow">{active.title}</div>
                <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{active.body}</p>
            </div>
            <button
                type="button"
                onClick={() => setDismissed(d => [...d, active.id])}
                className="btn btn-sm btn-ghost flex-none"
                aria-label="Dismiss this hint"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
