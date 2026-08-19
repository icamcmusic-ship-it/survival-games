import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ARCHETYPES } from '../../data/archetypes';
import { resolveCombat, resolveGroupCombat } from '../combat';
import { BLOODBATH_TEXTS } from '../../data/flavorText';
import { itemPhrase } from '../items';
import { personaThreat } from './alliances';
import { getRel, setRel } from '../relationships';
import { noteSighting } from '../memory';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export function startGames(ctx: SimContext) {
    ctx.state.phase = 'bloodbath';
    ctx.state.day = 1;
    initializeCareerAlliance(ctx);
}

function initializeCareerAlliance(ctx: SimContext) {
    const careers = getAlive(ctx.state).filter(t => t.isCareer);
    if (careers.length > 1) {
        const allianceId = `career-pack-${ctx.state.seed}`;
        careers.forEach(t => {
            t.allianceId = allianceId;
            // Set initial positive relationships within the pack. They already
            // knew each other from the academy; closing ranks in the
            // arena raises that to working trust without erasing the history.
            careers.forEach(other => {
                if (t.id !== other.id) {
                    setRel(t, other.id, Math.max(45, getRel(t, other.id) + 20));
                }
            });
        });
        ctx.logEvent(
            `The Careers — ${careers.map(c => `${c.name} (D${c.district})`).join(', ')} — close ranks into a single pack. Everyone else in the arena just became prey.`,
            careers.map(c => c.id),
            { important: true, category: 'alliance' }
        );
    }
}

export function processBloodbath(ctx: SimContext) {
    ctx.state.phase = 'bloodbath';
    ctx.rng = new RNG(`${ctx.state.seed}-bloodbath`);
    const alive = getAlive(ctx.state);

    ctx.logEvent(
        `The gong sounds. ${alive.length} tributes come off their plates at once.`,
        [],
        { important: true, category: 'system' }
    );

    const shuffled = ctx.rng.shuffle(alive);

    const runners: Tribute[] = [];
    const fighters: Tribute[] = [];

    shuffled.forEach(t => {
        let fightChance = 0.3;
        if (t.isCareer) fightChance += 0.4;
        if (t.attributes.strength > 7) fightChance += 0.2;
        if (t.traits.includes('Bloodthirsty')) fightChance += 0.3;
        if (t.traits.includes('Pacifist')) fightChance -= 0.3;
        fightChance += ARCHETYPES[t.archetype].aggression - ARCHETYPES[t.archetype].caution * 0.5;
        // The persona sold on the interview couch is a promise the crowd — and
        // everyone else on the plates — remembers.
        fightChance += personaThreat(t) * 0.6;

        if (ctx.rng.chance(fightChance)) {
            fighters.push(t);
        } else {
            runners.push(t);
        }
    });

    runners.forEach(t => {
        if (ctx.rng.chance(0.8)) {
            ctx.logEvent(fill(ctx.pickText(BLOODBATH_TEXTS.flee), { tribute: t.name }), [t.id], { category: 'survival' });
        } else {
            const item = ctx.rng.pick(ITEMS);
            t.inventory.push({ ...item });
            ctx.logEvent(
                fill(ctx.pickText(BLOODBATH_TEXTS.fleeWithItem), { tribute: t.name, item: itemPhrase(item) }),
                [t.id],
                { category: 'loot' }
            );
        }
    });

    // Everyone in the scrum can see everyone else — that is what the Cornucopia
    // is. The sighting seeds every survivor's memory of the place.
    const cornucopia = ctx.state.arena.zones[0]?.name ?? 'The Cornucopia';
    [...fighters, ...runners].forEach(t => {
        noteSighting(ctx.state, t, cornucopia, Math.max(0, fighters.length - 1), 0);
    });

    // Bounded brawl: two tributes who never manage to kill each other (a draw
    // every round, or star-crossed lovers who refuse to fight) used to spin
    // this loop forever and hang the whole simulation.
    let rounds = fighters.length * 6 + 12;
    while (fighters.length > 1 && rounds-- > 0) {
        // A knot of three at the mouth of the horn is not three tidy duels.
        if (fighters.length >= 3 && ctx.rng.chance(0.35)) {
            const party = fighters.splice(0, 3);
            resolveGroupCombat(ctx, party);
            party.forEach(t => { if (t.status === 'alive' && ctx.rng.chance(0.5)) fighters.push(t); });
            continue;
        }

        const t1 = fighters.splice(ctx.rng.nextInt(0, fighters.length - 1), 1)[0];
        // Targeting is not blind: a tribute goes for whoever they already have
        // reason to hate, or whoever promised the crowd a bloodbath.
        const t2 = fighters.splice(pickOpponentIndex(ctx, t1, fighters), 1)[0];

        resolveCombat(ctx, t1, t2, true);
        // A draw usually means they break off rather than immediately
        // re-engaging the same opponent.
        if (t1.status === 'alive' && ctx.rng.chance(0.55)) fighters.push(t1);
        if (t2.status === 'alive' && ctx.rng.chance(0.55)) fighters.push(t2);
    }

    if (fighters.length > 1) {
        ctx.logEvent(
            `The survivors at the Cornucopia — ${fighters.map(f => f.name).join(', ')} — break off and scatter rather than finish it here.`,
            fighters.map(f => f.id),
            { category: 'combat' }
        );
        fighters.splice(1).forEach(t => {
            const item = ctx.rng.pick(ITEMS);
            t.inventory.push({ ...item });
            ctx.logEvent(`${t.name} grabs ${itemPhrase(item)} on the way out.`, [t.id], { category: 'loot' });
        });
    }

    if (fighters.length === 1) {
        const winner = fighters[0];
        const item1 = ctx.rng.pick(ITEMS);
        const item2 = ctx.rng.pick(ITEMS);
        winner.inventory.push({ ...item1 }, { ...item2 });
        ctx.logEvent(
            fill(ctx.pickText(BLOODBATH_TEXTS.survive), { tribute: winner.name, items: `${item1.name} and ${item2.name}` }),
            [winner.id],
            { important: true, category: 'loot' }
        );
    }

    const fallen = alive.filter(t => t.status === 'dead').length;
    ctx.logEvent(
        fallen === 0
            ? 'The bloodbath ends without a single cannon. The Gamemakers are not pleased.'
            : `${fallen} cannon${fallen === 1 ? '' : 's'} mark the end of the bloodbath.`,
        [],
        { important: true, category: fallen === 0 ? 'system' : 'death' }
    );

    ctx.state.phase = 'day';
}

/**
 * Who a tribute swings at first. Weighted by grudge, by the threat the target
 * advertised in their interview, and by how easy they look — never uniform.
 */
function pickOpponentIndex(ctx: SimContext, attacker: Tribute, pool: Tribute[]): number {
    if (pool.length <= 1) return 0;
    const weights = pool.map(target => {
        let weight = 1;
        weight += Math.max(0, -getRel(attacker, target.id)) * 0.03;
        weight += personaThreat(target) * 2;
        // Careers hunt the weak first; that is the whole strategy.
        if (attacker.isCareer) weight += (10 - target.attributes.strength) * 0.15;
        weight *= Math.max(0.1, 1 - Math.max(0, getRel(attacker, target.id)) / 120);
        return Math.max(0.05, weight);
    });
    let roll = ctx.rng.nextFloat() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return i;
    }
    return weights.length - 1;
}
