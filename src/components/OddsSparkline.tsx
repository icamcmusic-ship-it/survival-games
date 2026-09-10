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
    // §2: the day each point belongs to, kept alongside the value. Without it
    // the line had no axis and no way to answer "when was that?" — a shape
    // with no scale, which is exactly the chart people mistrust.
    const series = useMemo(() => {
        if (!history) return [] as Array<{ day: number; value: number }>;
        return Object.keys(history)
            .map(Number)
            .sort((a, b) => a - b)
            .map(day => ({ day, value: history[day]?.[tributeId] }))
            .filter((p): p is { day: number; value: number } => typeof p.value === 'number');
    }, [history, tributeId]);
    const points = series.map(p => p.value);

    if (points.length < 2) return <span className="flex-none" style={{ width, height }} aria-hidden="true" />;

    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = Math.max(1, max - min);
    const step = width / (points.length - 1);
    const path = points
        .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
        .join(' ');

    const rising = points[points.length - 1] >= points[0];
    // §2: the legend, as a title. A sparkline this size cannot carry printed
    // axes without becoming illegible, so the scale is stated in words on
    // hover and in the accessible name — day by day, high and low, and which
    // way it ended.
    const legend = series.map(p => `d${p.day} ${p.value.toFixed(0)}%`).join(' · ');
    const summary = `Odds ${points[0].toFixed(0)}% on day ${series[0].day} to `
        + `${points[points.length - 1].toFixed(0)}% on day ${series[series.length - 1].day}`
        + ` (high ${max.toFixed(0)}%, low ${min.toFixed(0)}%)`;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="flex-none"
            role="img"
            aria-label={summary}
        >
            <title>{`${summary}\n${legend}`}</title>
            {/* The baseline is the low of the series, so the line's height is
                readable as "distance above their worst day". */}
            <line
                x1="0" y1={height - 0.5} x2={width} y2={height - 0.5}
                stroke="var(--line-soft)" strokeWidth="1" vectorEffect="non-scaling-stroke"
            />
            <polyline
                points={path}
                fill="none"
                strokeWidth="1.5"
                stroke={rising ? 'var(--cat-alliance)' : 'var(--cat-death)'}
                vectorEffect="non-scaling-stroke"
            />
            {/* The latest point, marked, so "where are they now" is one glance. */}
            <circle
                cx={width}
                cy={height - ((points[points.length - 1] - min) / span) * height}
                r="1.5"
                fill={rising ? 'var(--cat-alliance)' : 'var(--cat-death)'}
            />
        </svg>
    );
}
