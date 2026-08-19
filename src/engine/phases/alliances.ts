import { SimContext, getAlive } from '../context';
import { Tribute } from '../../models/types';
import { resolveCombat } from '../combat';
import { ARCHETYPES, archetypeCompatibility } from '../../data/archetypes';
import { ALLIANCES } from '../../data/balance';
import { ALLIANCE_TEXTS, ROMANCE_TEXTS } from '../../data/flavorText';
import { adjustRel, applyBetrayalFallout, getRel } from '../relationships';
import { distrustFactor, ensureMemory, noteContact } from '../memory';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/** Everything a betrayer stands to walk away with. */
function lootValue(t: Tribute): number {
    return t.inventory.reduce((sum, i) => sum + i.value, 0);
}

/** How easy this ally would be to put down right now. */
function weakness(t: Tribute): number {
    return (100 - t.health) + (t.injuries.bleeding ? 20 : 0) + (t.inventory.some(i => i.type === 'weapon') ? 0 : 25);
}

/**
 * Who gets the knife.
 *
 * Target selection used to be a uniform pick from the alliance, which meant a
 * treacherous Career was exactly as likely to turn on the ally they loved and
 * who was carrying nothing as on the wounded stranger hauling a medkit and a
 * trident. Betrayal is opportunism: it weighs the payday, the grudge, and how
 * winnable the fight is.
 */
function pickBetrayalTarget(ctx: SimContext, betrayer: Tribute, members: Tribute[]): Tribute | undefined {
    const candidates = members.filter(m => m.id !== betrayer.id);
    if (candidates.length === 0) return undefined;

    const scored = candidates.map(m => {
        // Star-crossed lovers are never a target.
        const bonded = betrayer.traits.includes('Star-Crossed') && m.traits.includes('Star-Crossed') && betrayer.district === m.district;
        if (bonded) return { m, weight: 0 };

        let weight = 1;
        weight += lootValue(m) * ALLIANCES.betrayalLootWeight;
        weight += Math.max(0, -getRel(betrayer, m.id)) * ALLIANCES.betrayalDislikeWeight;
        weight += weakness(m) * ALLIANCES.betrayalWeaknessWeight;
        // Genuine affection is the one thing that stays a betrayer's hand.
        weight *= Math.max(0.05, 1 - Math.max(0, getRel(betrayer, m.id)) / 110);
        // Someone who already burned you goes to the top of the list.
        if (ensureMemory(betrayer).betrayedBy.includes(m.id)) weight *= ALLIANCES.betrayedFirstStrikeWeight;
        return { m, weight: Math.max(0, weight) };
    }).filter(s => s.weight > 0);

    if (scored.length === 0) return undefined;
    let roll = ctx.rng.nextFloat() * scored.reduce((sum, s) => sum + s.weight, 0);
    for (const s of scored) {
        roll -= s.weight;
        if (roll <= 0) return s.m;
    }
    return scored[scored.length - 1].m;
}

/** Who does the betraying: treachery, plus how badly they have already been burned. */
function pickBetrayer(ctx: SimContext, members: Tribute[]): Tribute {
    const scored = members.map(m => ({
        m,
        weight: Math.max(0.2, (1 + ARCHETYPES[m.archetype].treachery * 10) * distrustFactor(m)
            * (m.traits.includes('Paranoid') ? 1.6 : 1)
            * (m.vitals.sanity < 40 ? 1.4 : 1)),
    }));
    let roll = ctx.rng.nextFloat() * scored.reduce((sum, s) => sum + s.weight, 0);
    for (const s of scored) {
        roll -= s.weight;
        if (roll <= 0) return s.m;
    }
    return scored[scored.length - 1].m;
}

export function processAlliances(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const alliances = new Map<string, Tribute[]>();

    alive.forEach(t => {
        if (t.allianceId) {
            if (!alliances.has(t.allianceId)) alliances.set(t.allianceId, []);
            alliances.get(t.allianceId)!.push(t);
        }
    });

    // 1. Dissolve small alliances
    alliances.forEach((members, id) => {
        if (members.length < 2) {
            members.forEach(m => delete m.allianceId);
            alliances.delete(id);
        }
    });

    // 1b. An alliance whose trust has rotted through falls apart on its own.
    alliances.forEach((members, id) => {
        if (members.length < 2) return;
        const averageTrust = members.reduce((sum, m) =>
            sum + members.reduce((inner, o) => inner + (o.id === m.id ? 0 : getRel(m, o.id)), 0) / (members.length - 1), 0) / members.length;
        if (averageTrust < -15) {
            members.forEach(m => {
                delete m.allianceId;
                ctx.logEvent(
                    fill(ctx.pickText(ALLIANCE_TEXTS.dissolve), { tribute: m.name }),
                    [m.id],
                    { category: 'alliance' }
                );
            });
            alliances.delete(id);
        }
    });

    // 2. Betrayal Logic
    alliances.forEach((members) => {
        if (members.length < 2) return;
        // Betrayal chance increases as fewer tributes remain
        const betrayalThreshold = (alive.length <= ALLIANCES.betrayalEndgameFieldSize
            ? ALLIANCES.betrayalEndgame
            : ALLIANCES.betrayalBase) * ctx.state.config.betrayalRate;

        if (ctx.rng.chance(betrayalThreshold)) {
            const betrayer = pickBetrayer(ctx, members);
            const victim = pickBetrayalTarget(ctx, betrayer, members);

            if (victim) {
                ctx.logEvent(
                    fill(ctx.pickText(ALLIANCE_TEXTS.betray), { betrayer: betrayer.name, victim: victim.name, zone: betrayer.zone }),
                    [betrayer.id, victim.id],
                    { important: true, category: 'betrayal' }
                );
                // The knife lands on the relationship graph whether or not the
                // fight that follows resolves in a kill.
                applyBetrayalFallout(ctx, betrayer, victim, members);
                delete betrayer.allianceId; // Betrayer leaves
                noteContact(ctx.state, betrayer, victim);
                resolveCombat(ctx, betrayer, victim);
            }
        }
    });

    // 3. Dynamic Alliance Formation & Star-Crossed Lovers
    // Re-read the living: betrayals above may have killed someone since the
    // snapshot at the top of this function.
    const stillAlive = getAlive(ctx.state);
    if (stillAlive.length > ALLIANCES.formationFieldSize) {
        for (let i = 0; i < stillAlive.length; i++) {
            for (let j = i + 1; j < stillAlive.length; j++) {
                const t1 = stillAlive[i];
                const t2 = stillAlive[j];

                if (!t1.allianceId && !t2.allianceId) {
                    const rel = getRel(t1, t2.id);
                    // Archetype chemistry: affinity of both parties plus pair compatibility
                    const affinity = (ARCHETYPES[t1.archetype].allianceAffinity + ARCHETYPES[t2.archetype].allianceAffinity) / 2;
                    const compat = archetypeCompatibility(t1.archetype, t2.archetype);
                    // The persona each sold on the interview couch matters here.
                    const persona = interviewChemistry(t1, t2);
                    // Someone who has been sold out before is far harder to recruit.
                    const trustCost = (distrustFactor(t1) + distrustFactor(t2)) / 2;

                    const formChance = Math.max(
                        ALLIANCES.minFormChance,
                        (ALLIANCES.baseFormChance + affinity + compat + persona) / trustCost
                    );
                    const relThreshold = (ALLIANCES.baseRelThreshold - compat * 100 - persona * 60) * trustCost;

                    if (rel > relThreshold && ctx.rng.chance(formChance)) {
                        const newId = `alliance-${t1.id}-${t2.id}`;
                        t1.allianceId = newId;
                        t2.allianceId = newId;
                        noteContact(ctx.state, t1, t2);
                        ctx.logEvent(
                            fill(ctx.pickText(ALLIANCE_TEXTS.form), { t1: t1.name, t2: t2.name, zone: t1.zone }),
                            [t1.id, t2.id],
                            { important: true, category: 'alliance' }
                        );
                    }
                }
            }
        }
    }

    // 4. Romantic "Star-Crossed Lovers" formation check (District partners of opposite gender)
    for (let dist = 1; dist <= ctx.state.config.districtCount; dist++) {
        const districtTributes = getAlive(ctx.state).filter(t => t.district === dist);
        if (districtTributes.length === 2 && districtTributes[0].gender !== districtTributes[1].gender) {
            const t1 = districtTributes[0];
            const t2 = districtTributes[1];
            let currentRel = getRel(t1, t2.id);

            // Romance grows if they reside in the same zone or support each other
            if (t1.zone === t2.zone) {
                const growth = ctx.rng.nextInt(4, 10);
                adjustRel(t1, t2.id, growth);
                adjustRel(t2, t1.id, growth);
                noteContact(ctx.state, t1, t2);
                currentRel = getRel(t1, t2.id);
            }

            if (currentRel >= 80 && !t1.traits.includes('Star-Crossed')) {
                t1.traits.push('Star-Crossed');
                t2.traits.push('Star-Crossed');

                const bondId = `lovers-${dist}-${ctx.state.seed}`;
                t1.allianceId = bondId;
                t2.allianceId = bondId;

                t1.sponsorTrust = Math.min(100, t1.sponsorTrust + 40);
                t2.sponsorTrust = Math.min(100, t2.sponsorTrust + 40);
                t1.reputation = Math.min(95, t1.reputation + 20);
                t2.reputation = Math.min(95, t2.reputation + 20);
                t1.excitementRating += 50;
                t2.excitementRating += 50;

                ctx.logEvent(
                    fill(ctx.pickText(ROMANCE_TEXTS), { t1: t1.name, t2: t2.name, district: String(dist) }),
                    [t1.id, t2.id],
                    { important: true, category: 'romance' }
                );
            }
        }
    }
}

/**
 * Interview personas as social currency.
 *
 * The strategy a tribute sold on Caesar's couch used to move `sponsorTrust` and
 * then vanish. It is a public persona — the rest of the cast watched the same
 * broadcast, and it should shape who wants to stand next to whom.
 */
export function interviewChemistry(a: Tribute, b: Tribute): number {
    const x = a.interviewStrategy;
    const y = b.interviewStrategy;
    if (!x || !y) return 0;

    const warm = ['The Star-Crossed Lover', 'The Humble Underdog', 'The Charming Flirt', 'The Quirky Oddball'];
    const cold = ['The Ruthless Warrior', 'The Arrogant Brute', 'The Mysterious Enigma'];

    let score = 0;
    if (warm.includes(x) && warm.includes(y)) score += 0.12;
    if (cold.includes(x) && cold.includes(y)) score -= 0.08;
    if (warm.includes(x) && cold.includes(y)) score -= 0.05;
    if (cold.includes(x) && warm.includes(y)) score -= 0.05;
    if (x === y) score += 0.05;
    return score;
}

/** Public personas that make a tribute a priority target in the bloodbath. */
export function personaThreat(t: Tribute): number {
    switch (t.interviewStrategy) {
        case 'The Ruthless Warrior': return 0.35;
        case 'The Arrogant Brute': return 0.3;
        case 'The Mysterious Enigma': return 0.15;
        case 'The Star-Crossed Lover': return -0.1;
        case 'The Humble Underdog': return -0.15;
        case 'The Quirky Oddball': return -0.05;
        default: return 0;
    }
}
