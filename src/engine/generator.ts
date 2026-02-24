import { RNG } from '../utils/rng';
import { Tribute, Attributes } from '../models/types';
import { TRAITS } from '../data/constants';

export function generateTributes(seed: string): Tribute[] {
    const rng = new RNG(seed);
    const tributes: Tribute[] = [];

    for (let district = 1; district <= 12; district++) {
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

            // Cap at 10
            (Object.keys(attributes) as Array<keyof Attributes>).forEach(k => {
                attributes[k] = Math.min(10, attributes[k]);
            });

            // Traits
            const numTraits = rng.nextInt(1, 3);
            const traits: string[] = [];
            while (traits.length < numTraits) {
                const trait = rng.pick(TRAITS);
                if (!traits.includes(trait)) {
                    traits.push(trait);
                }
            }

            tributes.push({
                id: `d${district}-${gender.toLowerCase()}`,
                district,
                gender,
                name: `District ${district} ${gender}`,
                isCareer,
                attributes,
                traits,
                vitals: { hunger: 0, thirst: 0, fatigue: 0, sanity: 100 },
                injuries: { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false },
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
