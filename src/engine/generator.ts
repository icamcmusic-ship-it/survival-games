import { RNG } from '../utils/rng';
import { Tribute, Attributes, Build, GameConfig, ArchetypeId, Gender } from '../models/types';
import { TRAITS, BUILDS, DEFAULT_GAME_CONFIG, traitFits } from '../data/constants';
import { ARCHETYPES, archetypeWeightsFor } from '../data/archetypes';
import { GENERATION } from '../data/balance';
import { DISTRICT_NAMES } from '../data/names';
import { LEGACY_EFFECTS, legacyOf } from '../data/districts';
import { blankMemory } from './memory';
import { blankProficiencies } from './proficiency';
import { seedBackstoryRelationships } from './relationships';

/** Weighted draw from the district's archetype table. */
function pickArchetype(rng: RNG, district: number): ArchetypeId {
    const weights = archetypeWeightsFor(district);
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    let roll = rng.nextFloat() * total;
    for (const [id, w] of weights) {
        roll -= w;
        if (roll <= 0) return id;
    }
    return weights[weights.length - 1][0];
}

/** The most raw strength a tribute of this age can possibly have. */
export function strengthCapForAge(age: number): number {
    return Math.min(10, GENERATION.strengthCapAtMinAge + (age - GENERATION.minAge) * GENERATION.strengthCapPerYear);
}

function buildFromStrength(rng: RNG, strength: number): Build {
    // Roughly correlate build with strength while keeping some randomness.
    const idx = Math.min(BUILDS.length - 1, Math.max(0, Math.floor(strength / 2) + rng.nextInt(-1, 1)));
    return BUILDS[idx];
}

/**
 * Age is no longer decorative.
 *
 * A twelve-year-old and an eighteen-year-old were previously mechanically
 * identical, which is how the roster ended up printing a 12-year-old with a
 * strength of 9 and a straight face. Physical stats now scale with age, the
 * youngest are quicker but frailer, and the crowd is softer on them.
 */
function applyAgeProfile(attributes: Attributes, age: number) {
    const yearsFromMid = age - GENERATION.ageMidpoint;
    attributes.strength += Math.round(yearsFromMid * GENERATION.strengthPerYear);
    // Agility peaks in the mid-teens and tails off either side of it.
    attributes.agility -= Math.round(Math.abs(age - GENERATION.agilityPeakAge) * 0.35);
    // Years in school and years watching the Games both count for something.
    if (age >= 17) attributes.intelligence += 1;
    if (age <= 13) {
        attributes.stealth += 1;
        attributes.strength -= 1;
    }
}

/**
 * Per-tribute identity.
 *
 * Base rolls plus archetype bias made everyone in a given archetype read the
 * same. Every tribute now gets a talent level (are they simply better or worse
 * than average?) and one spiked and one dumped attribute, so "the survivalist
 * from 11" is a person rather than a template.
 */
function applyPersonalVariance(rng: RNG, attributes: Attributes) {
    const talent = rng.nextInt(-GENERATION.talentSpread, GENERATION.talentSpread);
    const keys = rng.shuffle(Object.keys(attributes) as Array<keyof Attributes>);

    // Talent is spread thinly across everything.
    keys.forEach(k => { attributes[k] += Math.round(talent / 2.5); });

    for (let i = 0; i < GENERATION.spikeCount && i < keys.length; i++) {
        attributes[keys[i]] += GENERATION.spikeSize;
    }
    for (let i = 0; i < GENERATION.dumpCount && keys.length - 1 - i >= GENERATION.spikeCount; i++) {
        attributes[keys[keys.length - 1 - i]] -= GENERATION.dumpSize;
    }
}

export function generateTributes(seed: string, config: GameConfig = DEFAULT_GAME_CONFIG, startZone: string = 'The Cornucopia'): Tribute[] {
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

            const age = rng.nextInt(GENERATION.minAge, GENERATION.maxAge);
            applyAgeProfile(attributes, age);
            applyPersonalVariance(rng, attributes);

            // Archetype: shapes stats, traits, and in-game behavior
            const archetype = pickArchetype(rng, district);
            const archetypeDef = ARCHETYPES[archetype];
            (Object.entries(archetypeDef.statBias) as Array<[keyof Attributes, number]>).forEach(([k, bonus]) => {
                attributes[k] += bonus;
            });

            // Clamp into the playable band. A floor of 1 matters now that age
            // and dump stats can both bite the same attribute.
            (Object.keys(attributes) as Array<keyof Attributes>).forEach(k => {
                attributes[k] = Math.max(1, Math.min(10, Math.round(attributes[k])));
            });
            // Age is a hard ceiling on raw strength, not just a modifier —
            // otherwise a District 2 twelve-year-old still rolls a 9.
            attributes.strength = Math.min(attributes.strength, strengthCapForAge(age));

            // Traits: first trait leans toward the archetype's preferred pool,
            // and nothing contradictory is ever stacked on top of it.
            const numTraits = rng.nextInt(1, 3);
            const traits: string[] = [];
            if (archetypeDef.preferredTraits.length > 0 && rng.chance(0.6)) {
                traits.push(rng.pick(archetypeDef.preferredTraits));
            }
            let traitAttempts = TRAITS.length * 4;
            while (traits.length < numTraits && traitAttempts-- > 0) {
                const trait = rng.pick(TRAITS);
                if (traitFits(traits, trait)) traits.push(trait);
            }

            const chosenName = drawName(district, gender);
            const heightCm = gender === 'Male'
                ? rng.nextInt(148 + (age - GENERATION.minAge) * 4, 168 + (age - GENERATION.minAge) * 4)
                : rng.nextInt(142 + (age - GENERATION.minAge) * 4, 160 + (age - GENERATION.minAge) * 4);
            const build = buildFromStrength(rng, attributes.strength);

            // Reputation: the trust level the crowd keeps drifting back toward.
            // A district's Games record travels with its tributes — the crowd
            // has been betting on District 2 for decades and has never had a
            // reason to learn District 9's names.
            const legacy = legacyOf(district);
            const reputation = GENERATION.baseSponsorTrust
                + rng.nextInt(-GENERATION.trustSpread, GENERATION.trustSpread)
                + (age <= 13 ? GENERATION.youthSympathy : 0)
                + Math.round((attributes.charisma - 5) * 1.5)
                + LEGACY_EFFECTS[legacy.tier].reputation;

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
                sponsorTrust: Math.max(5, Math.min(95, reputation)),
                reputation: Math.max(5, Math.min(95, reputation)),
                trainingScore: 0,
                kills: 0,
                zone: startZone,
                daysSurvived: 0,
                mentorLegacy: rng.pick(legacy.mentors),
                memory: blankMemory(),
                proficiencies: blankProficiencies(archetype),
                bleedSeverity: 0,
                momentum: 0,
                objective: { kind: 'survive' },
                stanceHeld: 0,
                fanFavourite: false,
            });
        }
    }

    // Audience meta: the Capitol has favourites before the gong.
    // Charisma, a good story and a career pedigree all feed the pre-Games buzz.
    const buzz = tributes.map(t => ({
        t,
        score: t.attributes.charisma * 3
            + (t.isCareer ? 6 : 0)
            + (t.age <= 13 ? 5 : 0)
            + (t.traits.includes('Charismatic') ? 8 : 0)
            + rng.nextInt(0, 10),
    })).sort((a, b) => b.score - a.score);

    buzz.slice(0, Math.min(GENERATION.fanFavouriteCount, tributes.length)).forEach(({ t }) => {
        t.fanFavourite = true;
        t.reputation = Math.min(95, t.reputation + GENERATION.fanFavouriteTrust);
        t.sponsorTrust = t.reputation;
        t.excitementRating += GENERATION.fanFavouriteExcitement;
    });

    // Nobody walks in a stranger.
    seedBackstoryRelationships(tributes, rng);

    return tributes;
}
