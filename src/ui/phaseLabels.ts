import { Phase } from '../models/types';

/**
 * §(requests): what each phase is called on screen.
 *
 * `phase.toUpperCase()` was fine when the phases were DAY, NIGHT and FEAST.
 * The staged pre-Games have ids like `training2` and `square`, which are not
 * headings. One table, read by the arena screen, the chronicle and the feed.
 */
export const PHASE_LABELS: Record<Phase, string> = {
    setup: 'Setup',
    roster: 'Roster',
    reaping: 'The Reaping',
    square: 'The Reaping',
    train: 'The Train to the Capitol',
    parade: 'The Tribute Parade',
    training: 'The Training Floor',
    training1: 'Training — Day 1',
    training2: 'Training — Day 2',
    training3: 'Training — Day 3',
    scores: 'The Training Scores',
    interviews: 'The Interviews',
    bloodbath: 'The Bloodbath',
    day: 'Day',
    night: 'Night',
    feast: 'The Feast',
    epilogue: 'The Epilogue',
    ended: 'The Games Have Ended',
};

export function phaseLabel(phase: string): string {
    return PHASE_LABELS[phase as Phase] ?? phase.charAt(0).toUpperCase() + phase.slice(1);
}

/** `Day 4 — Night`, or just the phase's name before the arena. */
export function dayPhaseLabel(day: number, phase: string): string {
    return day === 0 ? phaseLabel(phase) : `Day ${day} — ${phaseLabel(phase)}`;
}

/** Everything before the gong, for screens that hide arena-only columns. */
export const PRE_ARENA_PHASE_SET = new Set<string>([
    'setup', 'roster', 'reaping', 'square', 'train', 'parade',
    'training', 'training1', 'training2', 'training3', 'scores', 'interviews',
]);
