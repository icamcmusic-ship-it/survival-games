import { RNG } from '../utils/rng';
import { Tribute, Attributes, Build, GameConfig, ArchetypeId, Gender } from '../models/types';
import { TRAITS, BUILDS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { ARCHETYPES } from '../data/archetypes';
import { DISTRICT_NAMES } from '../data/names';

const NON_CAREER_ARCHETYPES: ArchetypeId[] = ['strategist', 'survivalist', 'protector', 'trickster', 'wildcard', 'underdog'];

function pickArchetype(rng: RNG, isCareer: boolean, district: number): ArchetypeId {
    // Careers usually embrace their training, but a few break the mold.
    if (isCareer && rng.chance(0.8)) return 'career';
    if (district === 3 && rng.chance(0.4)) return 'strategist';
    if ((district === 11 || district === 12) && rng.chance(0.35)) return 'survivalist';
    return rng.pick(NON_CAREER_ARCHETYPES);
}

function buildFromStrength(rng: RNG, strength: number): Build {
    // Roughly correlate build with strength while keeping some randomness.
    const idx = Math.min(BUILDS.length - 1, Math.max(0, Math.floor(strength / 2) + rng.nextInt(-1, 1)));
    return BUILDS[idx];
}

export function generateTributes(seed: string, config: GameConfig = DEFAULT_GAME_CONFIG): Tribute[] {
    const rng = new RNG(seed);
    const tributes: Tribute[] = [];
    const districtCount = Math.min(12, Math.max(1, config.districtCount));

    // Names must be unique across the whole cast — two tributes called "Amber"
    // made the chronicle feed and the kill log ambiguous.
    const usedNames = new Set<string>();
    const drawName = (district: number, gender: Gender): string => {
        const pool = DISTRICT_NAMES[district][gender];
        const available = pool.filter(n => !usedNames.has(n));
        const name = available.length > 0 ? rng.pick(available) : `${rng.pick(pool)} ${['II', 'III', 'IV', 'V'][rng.nextInt(0, 3)]}`;
        usedNames.add(name);
        return name;
    };

    for (let district = 1; district <= districtCount; district++) {
        for (const gender of ['Male', 'Female'] as const) {
            const isCareer = [1, 2, 4].includes(district);

            // Base attributes
            const attributes: Attributes = {
                strength: rng.nextInt(3, 7),
                agility: rng.nextInt(3, 7),
                intelligence: rng.nextInt(3, 7),
                charisma: rng.nextInt(3, 7),
                stealth: rng.nextInt(3, 7),
            };

            // District bonuses
            if (isCareer) {
                attributes.strength += rng.nextInt(1, 3);
                attributes.agility += rng.nextInt(1, 3);
            }
            if (district === 3) {
                attributes.intelligence += rng.nextInt(2, 4);
            }
            if (district === 7) {
                attributes.strength += rng.nextInt(1, 3);
            }
            if (district === 11 || district === 12) {
                attributes.stealth += rng.nextInt(2, 4);
                attributes.agility += rng.nextInt(1, 2);
            }

            // Archetype: shapes stats, traits, and in-game behavior
            const archetype = pickArchetype(rng, isCareer, district);
            const archetypeDef = ARCHETYPES[archetype];
            (Object.entries(archetypeDef.statBias) as Array<[keyof Attributes, number]>).forEach(([k, bonus]) => {
                attributes[k] += bonus;
            });

            // Cap at 10
            (Object.keys(attributes) as Array<keyof Attributes>).forEach(k => {
                attributes[k] = Math.min(10, attributes[k]);
            });

            // Traits: first trait leans toward the archetype's preferred pool
            const numTraits = rng.nextInt(1, 3);
            const traits: string[] = [];
            if (archetypeDef.preferredTraits.length > 0 && rng.chance(0.6)) {
                traits.push(rng.pick(archetypeDef.preferredTraits));
            }
            while (traits.length < numTraits) {
                const trait = rng.pick(TRAITS);
                if (!traits.includes(trait)) {
                    traits.push(trait);
                }
            }

            const chosenName = drawName(district, gender);
            const age = rng.nextInt(12, 18);
            const heightCm = gender === 'Male' ? rng.nextInt(155, 195) : rng.nextInt(148, 185);
            const build = buildFromStrength(rng, attributes.strength);

            tributes.push({
                id: `d${district}-${gender.toLowerCase()}`,
                district,
                gender,
                name: chosenName,
                age,
                heightCm,
                build,
                isCareer,
                archetype,
                attributes,
                traits,
                vitals: { hunger: 0, thirst: 0, fatigue: 0, sanity: 100 },
                injuries: { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false, poisoned: false, burned: false, frostbitten: false },
                health: 100,
                status: 'alive',
                inventory: [],
                stance: 'Defensive',
                relationships: {},
                excitementRating: 0,
                sponsorTrust: 50,
                trainingScore: 0,
                kills: 0,
                zone: 'The Cornucopia'
            });
        }
    }

    return tributes;
}
