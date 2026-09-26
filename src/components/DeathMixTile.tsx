import { useMemo } from 'react';
import { DeathCauseCode, GameState } from '../models/types';
import { CAUSE_FAMILY, classifyCause, deathCodeOf } from '../engine/causes';
import { readHallOfFame } from '../utils/hofStorage';

type Family = (typeof CAUSE_FAMILY)[DeathCauseCode];

const FAMILIES: Array<[Family, string]> = [
    ['tribute', 'Another tribute'],
    ['body', 'Their own body'],
    ['arena', 'The arena'],
    ['mutt', 'Mutts'],
    ['gamemaker', 'The Gamemakers'],
];

function shares(codes: DeathCauseCode[]): Record<Family, number> {
    const out = { tribute: 0, body: 0, arena: 0, mutt: 0, gamemaker: 0, unknown: 0 } as Record<Family, number>;
    codes.forEach(c => { out[CAUSE_FAMILY[c] ?? 'unknown'] += 1; });
    const n = Math.max(1, codes.length);
    (Object.keys(out) as Family[]).forEach(k => { out[k] /= n; });
    return out;
}

/**
 * AUDIT-12 §4: the death-mix tile — what killed people this Games, against
 * the average of the Games in your Hall of Fame.
 */
export function DeathMixTile({ gameState }: { gameState: GameState }) {
    const mix = useMemo(() => {
        const here = shares(gameState.tributes.filter(t => t.status === 'dead').map(t => deathCodeOf(t)));
        const past = readHallOfFame()
            .filter(e => e.seed !== gameState.seed)
            .flatMap(e => (e.tributeSummaries ?? []).filter(s => s.status === 'dead').map(s => classifyCause(s.causeOfDeath)));
        return { here, avg: past.length > 0 ? shares(past) : null, pastRuns: past.length };
    }, [gameState]);

    return (
        <div className="panel p-4 space-y-2" data-testid="death-mix">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h3 className="panel-title">Death mix</h3>
                <span className="text-micro font-mono text-[var(--color-ink-500)]">
                    {mix.avg ? 'this Games vs your average' : 'no archived Games to compare yet'}
                </span>
            </div>
            <dl className="space-y-1.5">
                {FAMILIES.map(([fam, label]) => {
                    const a = Math.round(mix.here[fam] * 100);
                    const b = mix.avg ? Math.round(mix.avg[fam] * 100) : null;
                    return (
                        <div key={fam} className="text-xs">
                            <div className="flex justify-between gap-2">
                                <dt>{label}</dt>
                                <dd className="font-mono">
                                    {a}%{b !== null && <span className="text-[var(--color-ink-500)]"> · avg {b}%</span>}
                                </dd>
                            </div>
                            <div className="relative h-1.5 bg-[var(--paper-flush)]" aria-hidden="true">
                                <div className="absolute inset-y-0 left-0 bg-[var(--red)]" style={{ width: `${a}%` }} />
                                {b !== null && <div className="absolute inset-y-[-2px] w-0.5 bg-[var(--ink)]" style={{ left: `${b}%` }} />}
                            </div>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}
