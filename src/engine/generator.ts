import { RNG } from '../utils/rng';
import { Tribute, Attributes, Build, GameConfig, ArchetypeId, Gender } from '../models/types';
import { TRAITS, BUILDS, DEFAULT_GAME_CONFIG, traitFits } from '../data/constants';
import { ARCHETYPES, archetypeWeightsFor } from '../data/archetypes';
import { GENERATION, TESSERAE, VOLUNTEER } from '../data/balance';
import { DISTRICT_NAMES } from '../data/names';
import { LEGACY_EFFECTS, craftOf, legacyOf } from '../data/districts';
import { blankMemory } from './memory';
import { strengthCapForAge } from './physique';
import { blankProficiencies } from './proficiency';
import { seedBackstoryRelationships } from './relationships';
import { addExcitement } from './audience';
import { CastShape, Quell } from '../data/gamesProfile';
import { ITEMS } from '../data/constants';
import { giveItem, mintItem } from './items';
import { QUIRKS } from '../data/quirks';

/** Weighted draw from the district's archetype table. */
function pickArchetype(rng: RNG, district: number, careerBias = 0): ArchetypeId {
    // The cast shape can push the whole field toward or away from the academy
    // archetype — that is what makes a "career-heavy" year read differently on
    // the roster screen from an "outer districts" one.
    const weights = archetypeWeightsFor(district).map(([id, w]): [ArchetypeId, number] =>
        id === 'career' ? [id, Math.max(0, w + careerBias)] : [id, w]);
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    let roll = rng.nextFloat() * total;
    for (const [id, w] of weights) {
        roll -= w;
        if (roll <= 0) return id;
    }
    return weights[weights.length - 1][0];
}

/**
 * §7.1: the reaping draw, weighted the way the bowl actually is.
 *
 * A flat `nextInt(12, 18)` made every age equally likely, which canon is
 * explicit it is not: entries compound one per year (an eighteen-year-old has
 * seven slips to a twelve-year-old's one) *before* tesserae, and tesserae
 * compound too — a poor child takes extra entries for grain every year the
 * family needs feeding. So the draw skews older everywhere, and older fastest
 * exactly where the districts are poorest. This is also a balance lever: the
 * outer-district cast arrives older and more capable, which is part of the
 * Career counterweight the win-share goals need.
 */
function drawReapingAge(rng: RNG, district: number): number {
    const rate = TESSERAE.ratePerTier[legacyOf(district).tier] ?? 0.5;
    const weights: number[] = [];
    for (let age = GENERATION.minAge; age <= GENERATION.maxAge; age++) {
        const years = age - GENERATION.minAge + 1;
        // Statutory slips (one per year) plus tesserae taken every year so
        // far — a triangular accumulation, so poverty steepens the skew.
        weights.push(years + rate * (years * (years + 1)) / 2);
    }
    let roll = rng.nextFloat() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return GENERATION.minAge + i;
    }
    return GENERATION.maxAge;
}

export { strengthCapForAge } from './physique';

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

/**
 * The reaping's second half: who answers the name.
 *
 * A Career district's escort barely finishes reading the card before somebody
 * volunteers, and that somebody is of age, trained, and has been waiting years
 * for this — so the volunteer replaces the reaped tribute's profile rather than
 * merely flagging it. Everywhere else volunteering is vanishingly rare and
 * almost always the same thing: an older sibling stepping in front of a younger
 * one, which the Capitol adores and which rarely ends well.
 */
function applyVolunteer(rng: RNG, t: Tribute, shape?: CastShape) {
    // An all-volunteer year is exactly that; otherwise the cast shape only
    // nudges the odds a district's tribute steps forward.
    const base = t.isCareer ? VOLUNTEER.careerChance : VOLUNTEER.outlyingChance;
    const chance = Math.min(1, base + (shape?.volunteerChance ?? 0));
    if (!rng.chance(chance)) return;

    t.volunteered = true;
    // Nobody volunteers at twelve. Age up first, then let the age cap on raw
    // strength be recomputed against the new age.
    if (t.age < VOLUNTEER.minAge) t.age = rng.nextInt(VOLUNTEER.minAge, GENERATION.maxAge);

    // Compose with any note already on the tribute (the tesserae note is set
    // at construction) rather than overwriting it — the tesserae story is
    // most meaningful in exactly the poor outer districts where the
    // sibling-volunteer case lives.
    const composeNote = (note: string) =>
        t.reapingNote ? `${note} ${t.reapingNote}` : note;
    if (t.isCareer) {
        t.attributes.strength = Math.min(10, t.attributes.strength + VOLUNTEER.careerStrengthBonus);
        t.attributes.agility = Math.min(10, t.attributes.agility + VOLUNTEER.careerAgilityBonus);
        t.reputation = Math.min(95, t.reputation + VOLUNTEER.careerTrust);
        addExcitement(t, VOLUNTEER.careerExcitement);
        t.reapingNote = composeNote(`Volunteered before the escort had finished reading the card — ${craftOf(t.district).blurb}, and eighteen years of waiting for their turn.`);
    } else {
        t.reputation = Math.min(95, t.reputation + VOLUNTEER.sacrificeTrust);
        addExcitement(t, VOLUNTEER.sacrificeExcitement);
        t.reapingNote = composeNote(`Volunteered for a sibling. District ${t.district} has not had a volunteer in living memory, and the crowd did not applaud — they touched three fingers to their lips instead.`);
    }
    t.attributes.strength = Math.min(t.attributes.strength, strengthCapForAge(t.age));
    t.sponsorTrust = t.reputation;
}

export function generateTributes(
    seed: string,
    config: GameConfig = DEFAULT_GAME_CONFIG,
    startZone: string = 'The Cornucopia',
    /**
     * REPLAY-09: the shape of this year's cast. Omitted by callers that only
     * want a plain field (and by states saved before cast shapes existed), in
     * which case the draw behaves exactly as it always did.
     */
    shape?: CastShape,
    quell?: Quell,
): Tribute[] {
    const rng = new RNG(seed);
    const tributes: Tribute[] = [];
    // 2..12, matching the setup slider and the share-URL parser exactly. The
    // old lower bound of 1 was reachable only through a hand-edited save and
    // produced a degenerate two-tribute, one-day run.
    const districtCount = Math.min(12, Math.max(2, config.districtCount));

    // Names must be unique across the whole cast — two tributes called "Amber"
    // made the chronicle feed and the kill log ambiguous.
    const usedNames = new Set<string>();
    // A name is supposed to encode its district's export, but ~200 of the
    // 2,400 pool entries appear in more than one district's pool (Clover in
    // five of them). Prefer names exclusive to this district so the flavour
    // reads true, and so D1 drawing first never denies D11 its own Clover;
    // the shared names remain a fallback if an exclusive pool ever runs dry.
    const nameDistrictCounts = new Map<string, number>();
    for (let d = 1; d <= 12; d++) {
        for (const g of ['Male', 'Female'] as const) {
            for (const n of new Set(DISTRICT_NAMES[d][g])) {
                nameDistrictCounts.set(n, (nameDistrictCounts.get(n) ?? 0) + 1);
            }
        }
    }
    const drawName = (district: number, gender: Gender): string => {
        // Pre-Games option: skip the flavour pools entirely and name every
        // tribute for their number — "District 7 Boy" — the way the books'
        // own reaping scenes sometimes do before a name is ever given. One
        // district+gender pair is already unique across the cast, so this
        // never needs the used-name/disambiguation machinery below it.
        if (config.plainNames) return `District ${district} ${gender === 'Male' ? 'Boy' : 'Girl'}`;
        const pool = DISTRICT_NAMES[district][gender];
        const available = pool.filter(n => !usedNames.has(n));
        const exclusive = available.filter(n => nameDistrictCounts.get(n) === 1);
        let name: string;
        if (exclusive.length > 0) {
            name = rng.pick(exclusive);
        } else if (available.length > 0) {
            name = rng.pick(available);
        } else {
            // Exhausted pool (only possible with a shrunken pool): suffix a
            // generation numeral, and keep going until the result is itself
            // unused — the naked suffix could otherwise collide too.
            const base = rng.pick(pool);
            let ordinal = 2;
            const numerals = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
            name = `${base} ${numerals[ordinal - 2]}`;
            while (usedNames.has(name) && ordinal - 2 < numerals.length - 1) {
                ordinal++;
                name = `${base} ${numerals[ordinal - 2]}`;
            }
        }
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

            // District bonuses.
            //
            // §7: the Career districts used to be the only ones with a
            // combat-relevant stat bonus at all — D3's and D11/D12's bonuses
            // land in intelligence and stealth, which matter for the parts of
            // the game combat power does not read. That, stacked with the
            // Career districts' own training-floor advantage (see
            // pickArchetype/trainingScore), left the win column reading almost
            // entirely as "who rolled melee stats", which is a training
            // academy simulator wearing a twelve-district reaping's clothes.
            // Trimmed the Career head start and gave the districts whose
            // trade is manual labour (5 power plants, 6 transport yards, 8
            // textile floors, 9 grain country, 10 stockyards) a smaller one of
            // their own — a fraction of the Career bonus, in the attribute
            // their actual work would plausibly build, so a hard-labour
            // district tribute is a survivable fight rather than a bye.
            if (isCareer) {
                attributes.strength += rng.nextInt(1, 2);
                attributes.agility += rng.nextInt(1, 2);
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
            if (district === 5 || district === 9 || district === 10) {
                attributes.strength += rng.nextInt(0, 2);
            }
            if (district === 6 || district === 8) {
                attributes.agility += rng.nextInt(0, 2);
            }

            // The cast shape leans on the age roll before it is clamped back
            // into the eligible band, so a "young field" really is younger
            // rather than merely being described that way.
            const age = Math.max(GENERATION.minAge, Math.min(GENERATION.maxAge,
                drawReapingAge(rng, district) + (shape?.ageShift ?? 0)));

            // §7.1: how many tessera slips this particular child carries.
            // Wealthy-tier rates round to zero for almost everyone, which is
            // the point — nobody in District 1 has ever needed the grain.
            const tesseraRate = TESSERAE.ratePerTier[legacyOf(district).tier] ?? 0.5;
            const tesserae = Math.max(0, Math.round(tesseraRate * (age - GENERATION.minAge + 1) + rng.nextInt(-1, 1)));
            applyAgeProfile(attributes, age);
            applyPersonalVariance(rng, attributes);
            if (shape?.talentBonus) {
                (Object.keys(attributes) as Array<keyof Attributes>).forEach(k => {
                    attributes[k] += shape.talentBonus;
                });
            }

            // Archetype: shapes stats, traits, and in-game behavior
            const archetype = pickArchetype(rng, district, shape?.careerBias ?? 0);
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
                proficiencies: blankProficiencies(archetype, district),
                bleedSeverity: 0,
                momentum: 0,
                objective: { kind: 'survive' },
                // Where the plate lands. The ring is drawn at random and the
                // bloodbath is largely decided by it: a tribute who comes off
                // their plate inside the horn's shadow is in the killing zone
                // whether or not they wanted to be.
                platePosition: Math.round(rng.nextFloat() * 100) / 100,
                stanceHeld: 0,
                fanFavourite: false,
                tesserae,
                // T-7: one or two habits the cameras will find. Deduped
                // within the tribute only — with 25 quirks over a 24-strong
                // cast, two tributes sharing a habit across the field is
                // expected and fine; two identical habits on one card is not.
                quirks: [rng.pick(QUIRKS).label, ...(rng.chance(GENERATION.secondQuirkChance) ? [rng.pick(QUIRKS).label] : [])]
                    .filter((q, i, arr) => arr.indexOf(q) === i),
                reapingNote: tesserae >= TESSERAE.notedAt
                    ? `Their name was in the bowl ${age - GENERATION.minAge + 1 + tesserae} times — ${tesserae} of those slips bought grain, one winter at a time. Everyone in the square knew whose names the bowl was heavy with.`
                    : undefined,
            });
        }
    }

    // The reaping is not just a name out of a bowl.
    tributes.forEach(t => applyVolunteer(rng, t, shape));

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
        addExcitement(t, GENERATION.fanFavouriteExcitement);
    });

    // Nobody walks in a stranger.
    seedBackstoryRelationships(tributes, rng);

    // A Quell of bonded pairs means the two names out of each district already
    // know each other, and everybody watching knows what that will cost.
    if (shape?.pairBond) {
        for (let district = 1; district <= districtCount; district++) {
            const pair = tributes.filter(t => t.district === district);
            if (pair.length !== 2) continue;
            const [a, b] = pair;
            a.relationships[b.id] = shape.pairBond;
            b.relationships[a.id] = shape.pairBond;
            a.reapingNote = a.reapingNote
                ?? `Reaped as one half of a bonded pair with ${b.name}. Neither of them chose the other, and it will not matter.`;
            b.reapingNote = b.reapingNote
                ?? `Reaped as one half of a bonded pair with ${a.name}. Neither of them chose the other, and it will not matter.`;
        }
    }

    // 'The Weapons Quell': each tribute arrives with their district's own
    // tool, and nothing else — the normal empty-inventory-until-the-horn
    // start is replaced with exactly one themed item, drawn from the
    // district's craft affinity where it has one.
    if (quell?.standingWildcards?.includes('quell-weapons-fixed')) {
        tributes.forEach(t => {
            t.inventory = [];
            const craft = craftOf(t.district);
            const baseId = craft.affinityItems[0];
            const base = ITEMS.find(i => i.id === baseId) ?? ITEMS.find(i => i.id === 'knife')!;
            giveItem(t, mintItem(rng, base));
        });
    }

    return tributes;
}
