import { createStore } from '../store/createStore';
import { GameState } from '../models/types';
import { gameActions, gameStore } from '../store/gameStore';
import { prefsStore } from '../store/prefsStore';

/**
 * AUDIT-11 §4: small shell-level UI state that is not a preference and not
 * part of a run — which overlays are open, the resume recap.
 */
export interface UiState {
    settingsOpen: boolean;
    /** "Previously: …" shown once after resuming a saved run. */
    recap: string | null;
}

export const uiStore = createStore<UiState>({ settingsOpen: false, recap: null });

export function setUi(patch: Partial<UiState>) {
    uiStore.setState(patch);
}

/** §4: "Previously: Day 4, 9 alive, Rue and Thresh allied…". */
export function recapOf(state: GameState): string {
    const alive = state.tributes.filter(t => t.status === 'alive');
    const when = state.day === 0 ? `before the arena (${state.phase})` : `Day ${state.day}, ${state.phase}`;
    const parts = [`${when}`, `${alive.length} alive`];
    const groups = new Map<string, string[]>();
    alive.forEach(t => {
        if (!t.allianceId) return;
        groups.set(t.allianceId, [...(groups.get(t.allianceId) ?? []), t.name]);
    });
    const biggest = [...groups.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length)[0];
    if (biggest) {
        parts.push(biggest.length === 2
            ? `${biggest[0]} and ${biggest[1]} allied`
            : `${biggest.slice(0, -1).join(', ')} and ${biggest[biggest.length - 1]} allied`);
    }
    const leader = [...alive].sort((a, b) => b.kills - a.kills)[0];
    if (leader && leader.kills > 0) parts.push(`${leader.name} leads with ${leader.kills} kill${leader.kills === 1 ? '' : 's'}`);
    const lastDeath = [...state.log].reverse().find(l => l.category === 'death');
    if (lastDeath && state.day > 0 && !prefsStore.getState().spoilerSafe) {
        const fallen = state.tributes.find(t => lastDeath.tributesInvolved.includes(t.id) && t.status === 'dead');
        if (fallen) parts.push(`${fallen.name} was the last to fall`);
    }
    return `Previously: ${parts.join(', ')}.`;
}

/** Resume a slot and leave a one-line recap for the shell to show. */
export async function resumeWithRecap(slot: 1 | 2 | 3) {
    await gameActions.resumeFromSlot(slot);
    const { gameState } = gameStore.getState();
    setUi({ recap: gameState ? recapOf(gameState) : null });
}
