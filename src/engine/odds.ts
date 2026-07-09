import { Tribute } from '../models/types';
import { getArchetypeModifiers } from '../data/archetypes';

export function computeOddsScore(t: Tribute): number {
    const strength = t.attributes.strength;
    const agility = t.attributes.agility;
    const training = t.trainingScore || 5;
    const modifiers = getArchetypeModifiers(t);
    let score = 100 * 0.4 + strength * 2 + agility * 2 + training * 4;
    score += modifiers.combatPower * 3 + modifiers.sponsorAppeal;
    if (t.traits.includes('Brute')) score += 15;
    if (t.traits.includes('Bloodthirsty')) score += 15;
    if (t.traits.includes('Pacifist')) score -= 10;
    if (t.traits.includes('Strategist')) score += 12;
    return Math.max(10, score);
}

export function computeOddsAndMultiplier(t: Tribute, totalScore: number): { pct: number, mult: number } {
    const rawOdds = computeOddsScore(t) / totalScore;
    const pct = Math.round(rawOdds * 100) || 4;
    const mult = Math.max(1.1, Math.min(25.0, 100 / pct));
    return { pct, mult };
}
