import { Tribute } from '../models/types';

/**
 * §3.4: momentum and rattled are one mechanic with opposite signs — a
 * signed composure value. Reading them through one helper gives the state
 * more read sites (forage, sponsor appeal, parley willingness) without a
 * save-format change: every existing payload keeps its two counters.
 */
export function composureOf(t: Tribute): number {
    return (t.momentum ?? 0) - (t.rattled ?? 0);
}
