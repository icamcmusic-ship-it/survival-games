import { useState } from 'react';
import { Prediction, Tribute } from '../models/types';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { AUDIT12_WAVE3, PARLAY, PREDICTION } from '../data/balance';
import { FIRST_DEATH_CAUSES } from '../engine/prediction';
import { lengthLine } from '../engine/sideMarkets';
import { slipText } from '../data/replayHooks';
import { copyMessage, copyText } from '../utils/copyText';

/**
 * AUDIT-11 §12/§8: the prediction slip and the campaign parlay, side by side
 * in the betting parlour. Both close with the book at the gong.
 *
 * The slip costs nothing and changes nothing in the simulation; it is scored
 * when the Games end, archived with the Hall of Fame entry, and feeds the
 * Oracle / Sharp Book meta achievements. The parlay spans several Games: one
 * victor named per Games, all of which have to come home.
 */
export function PredictionSlip({ tributes }: { tributes: Tribute[] }) {
    const prediction = useStore(gameStore, s => s.gameState?.prediction);
    const parlay = useStore(gameStore, s => s.panem.parlay);
    const coins = useStore(gameStore, s => s.coins);
    const seed = useStore(gameStore, s => s.gameState?.seed);
    const [stake, setStake] = useState<number>(PARLAY.minStake * 4);
    const [legs, setLegs] = useState<number>(PARLAY.minLegs);
    const bank = useStore(gameStore, s => s.panem.ledger?.predictionBank);
    const mutators = useStore(gameStore, s => s.gameState?.config.mutators);
    const [copied, setCopied] = useState<string | null>(null);

    const slip: Prediction = prediction ?? {};
    const sorted = [...tributes].sort((a, b) => a.district - b.district || a.name.localeCompare(b.name));
    const update = (patch: Partial<Prediction>) => {
        const next = { ...slip, ...patch };
        gameActions.setPrediction(next);
    };
    const eight = slip.finalEight ?? [];
    const setPlace = (i: number, id: string) => {
        // A fixed eight-slot array: empties stay in place (dropped only when
        // scoring), and picking a tribute already placed moves them here.
        const next = Array.from({ length: PREDICTION.finalSize }, (_, j) => eight[j] ?? '');
        if (id !== '') next.forEach((x, j) => { if (x === id) next[j] = ''; });
        next[i] = id;
        update({ finalEight: next.some(x => x !== '') ? next : undefined });
    };

    const picker = (label: string, value: string | undefined, onChange: (id: string | undefined) => void, testId: string) => (
        <label className="flex flex-col gap-1 text-micro">
            <span className="eyebrow">{label}</span>
            <select
                data-testid={testId}
                className="field text-xs"
                value={value ?? ''}
                onChange={e => onChange(e.target.value || undefined)}
            >
                <option value="">—</option>
                {sorted.map(t => <option key={t.id} value={t.id}>D{t.district} · {t.name}</option>)}
            </select>
        </label>
    );

    const pending = parlay?.pending && parlay.pending.seed === seed ? parlay.pending : undefined;

    return (
        <div className="panel p-4 space-y-4" data-testid="prediction-slip" role="group" aria-label="Prediction slip and campaign parlay">
            <div>
                <h3 className="panel-title">Prediction slip</h3>
                <p className="text-micro text-[var(--color-ink-500)] mt-1">
                    Free to fill in, scored when the Games end and kept in the Hall of Fame.
                    Victor {PREDICTION.winnerPoints} pts, first death {PREDICTION.firstDeathPoints}, top killer {PREDICTION.topKillerPoints};
                    each of your final eight who makes the last eight {PREDICTION.finalEightPoints}, plus {PREDICTION.exactPlacePoints} for the exact place.
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {picker('Victor', slip.winnerId, id => update({ winnerId: id }), 'predict-winner')}
                {picker('First to fall', slip.firstDeathId, id => update({ firstDeathId: id }), 'predict-first-death')}
                {picker('Top killer', slip.topKillerId, id => update({ topKillerId: id }), 'predict-top-killer')}
            </div>
            {/* AUDIT-12 wave 3 §11: how the first one dies, and when it ends. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-micro">
                    <span className="eyebrow">First death, by ({AUDIT12_WAVE3.prediction.causePoints} pts)</span>
                    <select
                        data-testid="predict-first-cause"
                        className="field text-xs"
                        value={slip.firstDeathCause ?? ''}
                        onChange={e => update({ firstDeathCause: (e.target.value || undefined) as Prediction['firstDeathCause'] })}
                    >
                        <option value="">—</option>
                        {FIRST_DEATH_CAUSES.map(c => <option key={c} value={c}>{c === 'body' ? 'their own body (wounds, thirst, cold)' : c === 'tribute' ? 'another tribute' : c === 'gamemaker' ? 'the Gamemakers' : c === 'mutt' ? 'a mutt' : 'the arena'}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-micro">
                    <span className="eyebrow">The Games end ({AUDIT12_WAVE3.prediction.overUnderPoints} pts)</span>
                    <select
                        data-testid="predict-end-day"
                        className="field text-xs"
                        value={slip.endDayPick ?? ''}
                        onChange={e => {
                            const pick = e.target.value as 'over' | 'under' | '';
                            update(pick ? { endDayPick: pick, endDayLine: slip.endDayLine ?? lengthLine(tributes) } : { endDayPick: undefined, endDayLine: undefined });
                        }}
                    >
                        <option value="">—</option>
                        <option value="over">after day {slip.endDayLine ?? lengthLine(tributes)}</option>
                        <option value="under">before day {slip.endDayLine ?? lengthLine(tributes)}</option>
                    </select>
                </label>
            </div>
            <p className="text-micro text-[var(--color-ink-500)]" data-testid="prediction-bank">
                Call a victor with no kills or from a thin district and it is an upset: +{AUDIT12_WAVE3.prediction.upsetPoints} pts and {AUDIT12_WAVE3.prediction.upsetCoins} coins.
                {' '}Slip bankroll {bank?.bankroll ?? AUDIT12_WAVE3.prediction.bankrollStart} pts (each slip stakes {AUDIT12_WAVE3.prediction.slipStake})
                {bank ? ` · sharp streak ${bank.streak} (best ${bank.bestStreak}) · upsets called ${bank.upsetsCalled}` : ''}.
            </p>
            <div className="flex items-center gap-2">
                <button
                    className="btn btn-sm"
                    data-testid="copy-slip"
                    onClick={async () => setCopied(copyMessage(await copyText(slipText(seed ?? '', mutators, slip, tributes)), 'slip'))}
                >
                    Copy slip to share
                </button>
                {copied && <span className="text-micro" role="status">{copied}</span>}
            </div>
            <details>
                <summary className="text-xs cursor-pointer">Rank a final eight ({eight.filter(Boolean).length}/{PREDICTION.finalSize})</summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {Array.from({ length: PREDICTION.finalSize }, (_, i) => (
                        <label key={i} className="flex items-center gap-2 text-micro">
                            <span className="font-mono w-6 text-right">{i + 1}.</span>
                            <select
                                className="field text-xs flex-1"
                                aria-label={`Final eight, place ${i + 1}`}
                                value={eight[i] ?? ''}
                                onChange={e => setPlace(i, e.target.value)}
                            >
                                <option value="">—</option>
                                {sorted.map(t => <option key={t.id} value={t.id}>D{t.district} · {t.name}</option>)}
                            </select>
                        </label>
                    ))}
                </div>
            </details>

            <div className="border-t border-[var(--line)] pt-3 space-y-2">
                <h4 className="eyebrow">Campaign parlay</h4>
                {!parlay ? (
                    <div className="flex flex-wrap items-end gap-2 text-micro">
                        <label className="flex flex-col gap-1">
                            <span>Stake</span>
                            <input
                                type="number" className="field text-xs w-24" min={PARLAY.minStake} max={coins}
                                value={stake} onChange={e => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span>Games</span>
                            <select className="field text-xs" value={legs} onChange={e => setLegs(Number(e.target.value))}>
                                {Array.from({ length: PARLAY.maxLegs - PARLAY.minLegs + 1 }, (_, i) => PARLAY.minLegs + i)
                                    .map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </label>
                        <button
                            className="btn btn-sm"
                            disabled={stake < PARLAY.minStake || coins < stake}
                            onClick={() => gameActions.startParlay(stake, legs)}
                        >
                            Open parlay
                        </button>
                        <span className="text-[var(--color-ink-500)]">
                            Name a victor in each of the next {legs} Games; every leg must come home. Pays the stake times every leg&rsquo;s price (each capped at {PARLAY.legMultCap}x).
                        </span>
                    </div>
                ) : (
                    <div className="space-y-2 text-micro">
                        <p>
                            {parlay.stake}-coin ticket, {parlay.won.length} of {parlay.legs} legs in
                            {parlay.won.length > 0 ? ` (${parlay.won.map(l => `${l.name} ${l.mult.toFixed(1)}x`).join(', ')})` : ''}.
                        </p>
                        <label className="flex items-center gap-2">
                            <span>This Games&rsquo; leg</span>
                            <select
                                data-testid="parlay-leg"
                                aria-label="This Games' parlay leg"
                                className="field text-xs"
                                value={pending?.tributeId ?? ''}
                                onChange={e => gameActions.setParlayLeg(e.target.value || null)}
                            >
                                <option value="">—</option>
                                {sorted.map(t => <option key={t.id} value={t.id}>D{t.district} · {t.name}</option>)}
                            </select>
                            {pending && <span className="font-mono">{pending.mult.toFixed(1)}x</span>}
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}
