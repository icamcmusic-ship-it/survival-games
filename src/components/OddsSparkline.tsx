import React, { useMemo } from 'react';

/**
 * §2.8: the odds board had no history.
 *
 * `GameState.oddsHistory` has been written every day since the odds board
 * landed — day -> tribute id -> percentage — and nothing has ever drawn it. A
 * tribute's line over the run is the single best "story so far" widget the app
 * has available, and it is a dozen points on a polyline.
 */
export function OddsSparkline({ history, tributeId, width = 34, height = 12 }: {
    history?: Record<number, Record<string, number>>;
    tributeId: string;
    width?: number;
    height?: number;
}) {
    const points = useMemo(() => {
        if (!history) return [];
        return Object.keys(history)
            .map(Number)
            .sort((a, b) => a - b)
            .map(day => history[day]?.[tributeId])
            .filter((v): v is number => typeof v === 'number');
    }, [history, tributeId]);

    if (points.length < 2) return <span className="flex-none" style={{ width, height }} aria-hidden="true" />;

    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = Math.max(1, max - min);
    const step = width / (points.length - 1);
    const path = points
        .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
        .join(' ');

    const rising = points[points.length - 1] >= points[0];
    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="flex-none"
            role="img"
            aria-label={`Odds from ${points[0]}% to ${points[points.length - 1]}% over ${points.length} days`}
        >
            <polyline
                points={path}
                fill="none"
                strokeWidth="1.5"
                stroke={rising ? 'var(--cat-alliance)' : 'var(--cat-death)'}
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
