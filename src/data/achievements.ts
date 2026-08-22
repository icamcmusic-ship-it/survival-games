import { GameState, RecordsData, Tribute } from '../models/types';

export interface Achievement {
    id: string;
    name: string;
    description: string;
    check: (state: GameState, winner: Tribute | undefined) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    { id: 'first-blood', name: 'First Blood', description: 'Crown a victor in any simulation.', check: (_s, w) => !!w },
    { id: 'flawless-victor', name: 'Flawless Victor', description: 'Win without landing a single elimination.', check: (_s, w) => !!w && w.kills === 0 },
    { id: 'bloodbath-legend', name: 'Bloodbath Legend', description: 'Win with 5 or more eliminations.', check: (_s, w) => !!w && w.kills >= 5 },
    { id: 'underdog-victory', name: 'The Underdog', description: 'Win as a non-Career tribute.', check: (_s, w) => !!w && !w.isCareer },
    { id: 'career-domination', name: 'Career Domination', description: 'Win as a Career tribute.', check: (_s, w) => !!w && w.isCareer },
    { id: 'pacifist-victor', name: 'Pacifist Victor', description: 'Win with the Pacifist trait.', check: (_s, w) => !!w && w.traits.includes('Pacifist') },
    { id: 'bloodthirsty-victor', name: 'Bloodthirsty Champion', description: 'Win with the Bloodthirsty trait.', check: (_s, w) => !!w && w.traits.includes('Bloodthirsty') },
    { id: 'star-crossed-victor', name: 'Star-Crossed Survivor', description: 'Win as a Star-Crossed Lover.', check: (_s, w) => !!w && w.traits.includes('Star-Crossed') },
    { id: 'untouched', name: 'Untouched', description: 'Win the games at 100% health.', check: (_s, w) => !!w && w.health >= 100 },
    { id: 'district-12-pride', name: 'District 12 Pride', description: 'Win as a tribute from District 12.', check: (_s, w) => !!w && w.district === 12 },
    { id: 'marathon-games', name: 'Marathon Games', description: 'Win a simulation that lasted 10 or more days.', check: (s, w) => !!w && s.day >= 10 },
    { id: 'blitz-games', name: 'Blitz Games', description: 'Win a simulation that ended within the first 2 days.', check: (s, w) => !!w && s.day <= 2 },
    { id: 'quarter-quell-victor', name: 'Quarter Quell Victor', description: 'Win a simulation with a Quarter Quell twist active.', check: (s, w) => !!w && !!s.config.quellId && s.config.quellId !== 'none' },
    { id: 'self-reliant', name: 'Self-Reliant', description: 'Win with sponsor trust of 25 or below.', check: (_s, w) => !!w && w.sponsorTrust <= 25 },
    { id: 'sponsor-darling', name: 'Sponsor Darling', description: 'Win with sponsor trust of 90 or higher.', check: (_s, w) => !!w && w.sponsorTrust >= 90 },
    { id: 'lone-wolf-victor', name: 'Lone Wolf', description: 'Win without ever joining an alliance.', check: (_s, w) => !!w && !w.allianceId },
];

const RECORDS_KEY = 'hungerGamesRecords';

export function loadRecords(): RecordsData {
    try {
        const raw = JSON.parse(localStorage.getItem(RECORDS_KEY) || 'null');
        if (raw && typeof raw === 'object') {
            return {
                gamesPlayed: raw.gamesPlayed || 0,
                gamesWon: raw.gamesWon || 0,
                totalKills: raw.totalKills || 0,
                longestGameDays: raw.longestGameDays || 0,
                shortestVictoryDays: raw.shortestVictoryDays ?? null,
                mostKillsByVictor: raw.mostKillsByVictor || 0,
                mostKillsByVictorName: raw.mostKillsByVictorName ?? null,
                unlockedAchievements: Array.isArray(raw.unlockedAchievements) ? raw.unlockedAchievements : [],
            };
        }
    } catch (e) {
        // fall through to defaults
    }
    return { gamesPlayed: 0, gamesWon: 0, totalKills: 0, longestGameDays: 0, shortestVictoryDays: null, mostKillsByVictor: 0, mostKillsByVictorName: null, unlockedAchievements: [] };
}

export function saveRecords(records: RecordsData) {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function clearRecords() {
    localStorage.removeItem(RECORDS_KEY);
}

/** Updates persisted records/achievements for a finished game and returns the newly unlocked achievements. */
export function recordGameResult(state: GameState): Achievement[] {
    const winner = state.tributes.find(t => t.status === 'alive');
    const records = loadRecords();

    records.gamesPlayed += 1;
    if (winner) records.gamesWon += 1;
    records.totalKills += state.tributes.reduce((sum, t) => sum + t.kills, 0);
    records.longestGameDays = Math.max(records.longestGameDays, state.day);
    if (winner) {
        if (records.shortestVictoryDays === null || state.day < records.shortestVictoryDays) {
            records.shortestVictoryDays = state.day;
        }
        if (winner.kills > records.mostKillsByVictor) {
            records.mostKillsByVictor = winner.kills;
            records.mostKillsByVictorName = winner.name;
        }
    }

    const newlyUnlocked: Achievement[] = [];
    for (const achievement of ACHIEVEMENTS) {
        if (records.unlockedAchievements.includes(achievement.id)) continue;
        if (achievement.check(state, winner)) {
            records.unlockedAchievements.push(achievement.id);
            newlyUnlocked.push(achievement);
        }
    }

    saveRecords(records);
    return newlyUnlocked;
}
