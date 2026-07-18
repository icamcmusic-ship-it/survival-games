import { SimContext, getAlive } from '../context';
import { Tribute } from '../../models/types';
import { resolveCombat } from '../combat';
import { ARCHETYPES, archetypeCompatibility } from '../../data/archetypes';

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

    // 2. Betrayal Logic
    alliances.forEach((members) => {
        // Betrayal chance increases as fewer tributes remain
        const betrayalThreshold = (alive.length <= 4 ? 0.3 : 0.05) * ctx.state.config.betrayalRate;

        if (ctx.rng.chance(betrayalThreshold)) {
            // Treacherous archetypes are the likeliest to turn on their allies
            const weighted = members.flatMap(m => {
                const copies = 1 + Math.max(0, Math.round(ARCHETYPES[m.archetype].treachery * 10));
                return Array(copies).fill(m) as Tribute[];
            });
            const betrayer = ctx.rng.pick(weighted);
            const victim = ctx.rng.pick(members.filter(m => m.id !== betrayer.id));

            if (victim) {
                // Star-crossed lovers never betray each other
                if (betrayer.traits.includes('Star-Crossed') && victim.traits.includes('Star-Crossed') && betrayer.district === victim.district) {
                    return;
                }
                ctx.logEvent(`${betrayer.name} betrays the alliance and attacks ${victim.name}!`, [betrayer.id, victim.id], true);
                delete betrayer.allianceId; // Betrayer leaves
                resolveCombat(ctx, betrayer, victim);
            }
        }
    });

    // 3. Dynamic Alliance Formation & Star-Crossed Lovers
    if (alive.length > 4) {
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const t1 = alive[i];
                const t2 = alive[j];

                if (!t1.allianceId && !t2.allianceId) {
                    const rel = t1.relationships[t2.id] || 0;
                    // Archetype chemistry: affinity of both parties plus pair compatibility
                    const affinity = (ARCHETYPES[t1.archetype].allianceAffinity + ARCHETYPES[t2.archetype].allianceAffinity) / 2;
                    const compat = archetypeCompatibility(t1.archetype, t2.archetype);
                    const formChance = Math.max(0.02, 0.2 + affinity + compat);
                    const relThreshold = 40 - compat * 100; // compatible pairs need less history
                    if (rel > relThreshold && ctx.rng.chance(formChance)) {
                        const newId = `alliance-${t1.id}-${t2.id}`;
                        t1.allianceId = newId;
                        t2.allianceId = newId;
                        ctx.logEvent(`${t1.name} and ${t2.name} form a formal alliance.`, [t1.id, t2.id], true);
                    }
                }
            }
        }
    }

    // 4. Romantic "Star-Crossed Lovers" formation check (District partners of opposite gender)
    for (let dist = 1; dist <= 12; dist++) {
        const districtTributes = alive.filter(t => t.district === dist);
        if (districtTributes.length === 2 && districtTributes[0].gender !== districtTributes[1].gender) {
            const t1 = districtTributes[0];
            const t2 = districtTributes[1];
            let currentRel = t1.relationships[t2.id] || 0;

            // Romance grows if they reside in the same zone or support each other
            if (t1.zone === t2.zone) {
                currentRel = Math.min(100, currentRel + ctx.rng.nextInt(4, 10));
                t1.relationships[t2.id] = currentRel;
                t2.relationships[t1.id] = currentRel;
            }

            if (currentRel >= 80 && !t1.traits.includes('Star-Crossed')) {
                t1.traits.push('Star-Crossed');
                t2.traits.push('Star-Crossed');

                const bondId = `lovers-${dist}-${ctx.state.seed}`;
                t1.allianceId = bondId;
                t2.allianceId = bondId;

                t1.sponsorTrust = Math.min(100, t1.sponsorTrust + 40);
                t2.sponsorTrust = Math.min(100, t2.sponsorTrust + 40);
                t1.excitementRating += 50;
                t2.excitementRating += 50;

                ctx.logEvent(`ROMANCE: ${t1.name} and ${t2.name} of District ${dist} have formed an unshakeable bond as Star-Crossed Lovers! The Capitol audience is completely captivated.`, [t1.id, t2.id], true);
            }
        }
    }
}
