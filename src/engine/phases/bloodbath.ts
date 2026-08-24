import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Item, Tribute } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ARCHETYPES } from '../../data/archetypes';
import { ALLIANCES, BLOODBATH, QUALITY_BIAS, TRAINING } from '../../data/balance';
import { registerAlliance } from '../alliance';
import { resolveCombat, resolveGroupCombat } from '../combat';
import { BLOODBATH_TEXTS } from '../../data/flavorText';
import { giveItem, itemPhrase, mintItem } from '../items';
import { personaThreat } from './alliances';
import { getRel, setRel } from '../relationships';
import { noteContact, noteSighting } from '../memory';
import { addFear } from '../fear';
import { wildcardIs } from '../gamesProfile';
import { arenaBriefingLog } from '../arenaBriefingLog';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export function startGames(ctx: SimContext) {
    ctx.state.phase = 'bloodbath';
    ctx.state.day = 1;
    initializeCareerAlliance(ctx);
}

function initializeCareerAlliance(ctx: SimContext) {
    const allCareers = getAlive(ctx.state).filter(t => t.isCareer);
    // The pack is subject to the same ALLIANCES.maxSize cap as any other
    // alliance — a career field bigger than that splits into a pack and
    // stragglers rather than one oversized, permanently-outnumbering gang.
    const capped = allCareers.length > ALLIANCES.maxSize
        ? ctx.rng.shuffle(allCareers).slice(0, ALLIANCES.maxSize)
        : allCareers;

    // The pack is a marriage of convenience, and it should look like one. Some
    // years a Career decides their odds are better alone — usually the one who
    // trusts the others least — and it should be possible, rarely, for the whole
    // arrangement to fall apart before the bloodbath is over.
    const optOuts: Tribute[] = [];
    const ordered = [...capped].sort((a, b) => ARCHETYPES[b.archetype].treachery - ARCHETYPES[a.archetype].treachery);
    ordered.forEach(t => {
        if (optOuts.length >= ALLIANCES.careerMaxOptOuts) return;
        if (capped.length - optOuts.length <= 2) return;
        if (!ctx.rng.chance(ALLIANCES.careerOptOutChance)) return;
        optOuts.push(t);
        ctx.logEvent(
            `${t.name} of District ${t.district} looks at the pack forming around the Cornucopia and walks the other way. ` +
            `Some years the academy's arithmetic does not convince everybody.`,
            [t.id],
            { important: true, category: 'alliance' }
        );
    });

    const careers = capped.filter(t => !optOuts.includes(t));

    if (careers.length > 1 && ctx.rng.chance(ALLIANCES.careerEarlyCollapseChance)) {
        ctx.logEvent(
            `The Careers get as far as dividing the Cornucopia between them and no further. ` +
            `${careers.map(c => c.name).join(', ')} scatter before the bloodbath is even finished — there is no pack this year.`,
            careers.map(c => c.id),
            { important: true, category: 'alliance' }
        );
    } else if (careers.length > 1) {
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
        registerAlliance(ctx, allianceId, careers);
        ctx.logEvent(
            `The Careers — ${careers.map(c => `${c.name} (D${c.district})`).join(', ')} — close ranks into a single pack. Everyone else in the arena just became prey.`,
            careers.map(c => c.id),
            { important: true, category: 'alliance' }
        );
    }
}

/**
 * The scramble: sixty seconds on the plates, and then the run.
 *
 * Who reaches the mouth of the horn is not a coin flip. It is where the plate
 * landed, how fast they are, and whether they came here intending to do this.
 * Everything about the bloodbath's lethality follows from that ordering — the
 * tributes in the killing zone are in a knot of armed people with nowhere to
 * back up to, and the ones who turned for the treeline are simply not part of
 * it.
 */
function scrambleOrder(ctx: SimContext, tributes: Tribute[]): Tribute[] {
    return [...tributes].sort((a, b) => reachScore(ctx, b) - reachScore(ctx, a));
}

function reachScore(ctx: SimContext, t: Tribute): number {
    const proximity = 1 - (t.platePosition ?? 0.5);
    return proximity * 10 + t.attributes.agility + ctx.rng.nextFloat() * 3;
}

/** Weapons only. What is actually laid out at the mouth of the horn. */
const HORN_WEAPONS = ITEMS.filter(i => i.type === 'weapon');

/**
 * 'The Cornucopia Forfeit': no weapons anywhere near the horn this year,
 * only food — every loot draw in the bloodbath routes through this instead
 * of the unfiltered `ITEMS`/`HORN_WEAPONS` when the Quell is standing.
 */
function lootPool(ctx: SimContext): Item[] {
    return wildcardIs(ctx.state, 'quell-cornucopia-forfeit') ? ITEMS.filter(i => i.type === 'food') : ITEMS;
}
function hornWeaponsPool(ctx: SimContext): Item[] {
    return wildcardIs(ctx.state, 'quell-cornucopia-forfeit') ? lootPool(ctx) : HORN_WEAPONS;
}

export function processBloodbath(ctx: SimContext) {
    ctx.state.phase = 'bloodbath';
    ctx.rng = new RNG(`${ctx.state.seed}-bloodbath`);
    const alive = getAlive(ctx.state);
    // Anyone who reaches the gong has survived to day 1. Without this, a
    // Cornucopia death was recorded as daysSurvived 0 — the day-phase loop
    // that normally stamps it never runs for them — which fed bad data to
    // ODDS.survivalDayWeight and the Panem record book.
    alive.forEach(t => { t.daysSurvived = ctx.state.day; });

    // §6.1: sixty seconds on the plates. Each tribute has genuinely *seen*
    // whoever landed on the neighbouring plates — a real contact in the
    // sighting memory, not a blank slate — and a neighbour with a legendary
    // training score is frightening before anyone has moved a muscle.
    let worstNeighbourFear = 0;
    let worstPair: [Tribute, Tribute] | undefined;
    for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
            const a = alive[i], b = alive[j];
            const apart = Math.abs((a.platePosition ?? 0.5) - (b.platePosition ?? 0.5));
            if (apart > BLOODBATH.plateNeighbourRange) continue;
            noteContact(ctx.state, a, b);
            [[a, b], [b, a]].forEach(([watcher, watched]) => {
                if (watched.trainingScore < BLOODBATH.plateNeighbourFearScore || watcher.isCareer) return;
                const dread = (watched.trainingScore - 8) * BLOODBATH.plateNeighbourFearPerPoint;
                addFear(watcher, watched.id, dread);
                if (dread > worstNeighbourFear) {
                    worstNeighbourFear = dread;
                    worstPair = [watcher, watched];
                }
            });
        }
    }
    if (worstPair) {
        ctx.logEvent(
            `${worstPair[0].name} comes up on the plate two metres from ${worstPair[1].name} — the ${worstPair[1].trainingScore} in training — and spends the whole minute not looking at the horn.`,
            [worstPair[0].id, worstPair[1].id],
            { category: 'system' }
        );
    }

    // §13.2: the Gamemakers' own opening notes on the arena, in-fiction, at
    // the moment the tributes actually rise into it — immediately before the
    // gong, and only if the player has left the briefing on.
    if (ctx.state.arenaBriefingOnDrop !== false) arenaBriefingLog(ctx);

    ctx.logEvent(
        `The gong sounds. ${alive.length} tributes come off their plates at once.`,
        [],
        { important: true, category: 'system' }
    );

    // 1. Who runs at the horn and who runs away from it.
    const runners: Tribute[] = [];
    const fighters: Tribute[] = [];

    ctx.rng.shuffle(alive).forEach(t => {
        const proximity = 1 - (t.platePosition ?? 0.5);
        let fightChance = BLOODBATH.fightChanceBase;
        if (t.isCareer) fightChance += BLOODBATH.fightChanceCareer;
        // A plate in the horn's shadow is an invitation, and a plate on the far
        // edge of the ring is permission to leave.
        fightChance += (proximity - 0.5) * 2 * BLOODBATH.fightChanceProximity;
        fightChance += (t.attributes.agility - 5) * BLOODBATH.fightChanceAgility;
        if (t.attributes.strength > 7) fightChance += 0.15;
        if (t.traits.includes('Bloodthirsty')) fightChance += 0.3;
        if (t.traits.includes('Pacifist')) fightChance -= 0.35;
        fightChance += ARCHETYPES[t.archetype].aggression - ARCHETYPES[t.archetype].caution * 0.5;
        // The persona sold on the interview couch is a promise the crowd — and
        // everyone else on the plates — remembers.
        fightChance += personaThreat(t) * 0.6;

        if (ctx.rng.chance(fightChance)) fighters.push(t);
        else runners.push(t);
    });

    // A4: a pre-agreement struck on the training floor pulls two tributes the
    // same way off the plates. Nothing binding — nobody in this arena is bound
    // by anything — but two people who agreed on where to meet mostly do the
    // same thing when the gong goes, which is the entire point of having made
    // the agreement.
    const sideOf = new Map<string, 'fight' | 'run'>();
    fighters.forEach(t => sideOf.set(t.id, 'fight'));
    runners.forEach(t => sideOf.set(t.id, 'run'));
    alive.forEach(t => {
        const partnerId = (t.trainingPact ?? []).find(id => sideOf.has(id));
        if (!partnerId) return;
        const mine = sideOf.get(t.id);
        const theirs = sideOf.get(partnerId);
        if (!mine || !theirs || mine === theirs) return;
        if (!ctx.rng.chance(TRAINING.pactBloodbathPull)) return;
        // The one who committed to the horn is the one who is harder to move.
        const follower = theirs === 'fight' ? t : ctx.state.tributes.find(o => o.id === partnerId);
        if (!follower) return;
        const from = sideOf.get(follower.id) === 'fight' ? fighters : runners;
        const to = sideOf.get(follower.id) === 'fight' ? runners : fighters;
        const idx = from.indexOf(follower);
        if (idx < 0) return;
        from.splice(idx, 1);
        to.push(follower);
        sideOf.set(follower.id, sideOf.get(follower.id) === 'fight' ? 'run' : 'fight');
    });

    // 2. The race itself. Arrival order decides who is inside the horn when the
    //    knot closes, and the front of the pack is the part that gets armed.
    const arrivals = scrambleOrder(ctx, fighters);
    const killingZone = new Set(arrivals.slice(0, Math.max(2, Math.ceil(arrivals.length * 0.6))).map(t => t.id));

    arrivals.forEach((t, index) => {
        const first = index < Math.ceil(arrivals.length / 2);
        if (t.inventory.some(i => i.type === 'weapon')) return;
        if (!ctx.rng.chance(first ? BLOODBATH.armedAtHornChance : BLOODBATH.armedAtHornChance * 0.5)) return;
        // The good steel is stacked at the mouth of the horn; the outer ring is
        // backpacks and whatever was scattered on the grass.
        const base = first ? ctx.rng.pick(hornWeaponsPool(ctx)) : ctx.rng.pick(lootPool(ctx));
        const item = mintItem(ctx.rng, base, first ? QUALITY_BIAS.hornMouth : QUALITY_BIAS.hornScatter);
        giveItem(t, item);
        ctx.logEvent(
            `${t.name} reaches the ${first ? 'mouth of the horn' : 'scatter around the horn'} and comes up holding ${itemPhrase(item)}.`,
            [t.id],
            { category: 'loot' }
        );
    });

    // 2b. The tributes who turned and ran are not automatically clear of it.
    //     A plate near the mouth of the horn means several seconds inside the
    //     reach of people who came to the Cornucopia to kill, and the bloodbath
    //     of the source material is full of tributes cut down from behind.
    const hunters = arrivals.filter(t => t.status === 'alive' && t.inventory.some(i => i.type === 'weapon'));
    runners.forEach(t => {
        if (t.status !== 'alive' || hunters.length === 0) return;
        const proximity = 1 - (t.platePosition ?? 0.5);
        const caught = BLOODBATH.runDownChance * proximity * Math.max(0.3, 1 - t.attributes.agility / 12);
        if (!ctx.rng.chance(caught)) return;
        const hunter = ctx.rng.pick(hunters.filter(h => h.status === 'alive' && h.id !== t.id));
        if (!hunter) return;
        ctx.logEvent(
            `${t.name} turns for the treeline and does not get there. ${hunter.name} runs them down before they clear the ring of plates.`,
            [hunter.id, t.id],
            { important: true, category: 'combat' }
        );
        // Being caught from behind is an ambush by any definition, and nobody
        // is thinking clearly enough to break off in the first seconds.
        resolveCombat(ctx, hunter, t, true, true, BLOODBATH.noRetreatRounds, BLOODBATH.killingZoneDamage);
    });

    runners.forEach(t => {
        if (t.status !== 'alive') return;
        if (ctx.rng.chance(0.8)) {
            ctx.logEvent(fill(ctx.pickText(BLOODBATH_TEXTS.flee), { tribute: t.name }), [t.id], { category: 'survival' });
        } else {
            const item = mintItem(ctx.rng, ctx.rng.pick(lootPool(ctx)), QUALITY_BIAS.hornScatter);
            giveItem(t, item);
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

    // 3. The scrum. The pool is the arrival order, so the tributes who got there
    //    first meet each other rather than being paired off at random.
    const pool = arrivals.filter(t => t.status === 'alive');
    const zoneMultiplier = (t: Tribute) => (killingZone.has(t.id) ? BLOODBATH.killingZoneDamage : 1);

    let rounds = pool.length * 6 + 12;
    while (pool.length > 1 && rounds-- > 0) {
        // The pack does not queue up for duels. If enough of them are still in
        // the scrum they pick one target and go through them together, which is
        // the entire reason a Career pack is frightening.
        const packed = pool.filter(t => t.isCareer && t.allianceId);
        if (packed.length >= 2 && pool.length > packed.length && ctx.rng.chance(0.6)) {
            const prey = pool.filter(t => !packed.includes(t));
            const target = prey[pickOpponentIndex(ctx, packed[0], prey)];
            const party = [...packed.slice(0, 3), target];
            party.forEach(t => {
                const idx = pool.indexOf(t);
                if (idx >= 0) pool.splice(idx, 1);
            });
            resolveGroupCombat(ctx, party);
            party.forEach(t => {
                if (t.status === 'alive' && ctx.rng.chance(BLOODBATH.groupReengageChance)) pool.push(t);
            });
            continue;
        }

        // A knot of three at the mouth of the horn is not three tidy duels.
        if (pool.length >= 3 && ctx.rng.chance(BLOODBATH.groupFightChance)) {
            const party = pool.splice(0, 3);
            resolveGroupCombat(ctx, party);
            party.forEach(t => {
                if (t.status === 'alive' && ctx.rng.chance(BLOODBATH.groupReengageChance)) pool.push(t);
            });
            continue;
        }

        const t1 = pool.splice(0, 1)[0];
        // Targeting is not blind: a tribute goes for whoever they already have
        // reason to hate, or whoever promised the crowd a bloodbath.
        const t2 = pool.splice(pickOpponentIndex(ctx, t1, pool), 1)[0];

        resolveCombat(
            ctx, t1, t2, true, false,
            BLOODBATH.noRetreatRounds,
            Math.max(zoneMultiplier(t1), zoneMultiplier(t2)),
        );
        if (t1.status === 'alive' && ctx.rng.chance(BLOODBATH.reengageChance)) pool.push(t1);
        if (t2.status === 'alive' && ctx.rng.chance(BLOODBATH.reengageChance)) pool.push(t2);
    }

    if (pool.length > 1) {
        ctx.logEvent(
            `The survivors at the Cornucopia — ${pool.map(f => f.name).join(', ')} — break off and scatter rather than finish it here.`,
            pool.map(f => f.id),
            { category: 'combat' }
        );
        pool.splice(1).forEach(t => {
            const item = mintItem(ctx.rng, ctx.rng.pick(lootPool(ctx)), QUALITY_BIAS.hornScatter);
            giveItem(t, item);
            ctx.logEvent(`${t.name} grabs ${itemPhrase(item)} on the way out.`, [t.id], { category: 'loot' });
        });
    }

    else if (pool.length === 1) {
        const winner = pool[0];
        const item1 = mintItem(ctx.rng, ctx.rng.pick(lootPool(ctx)), QUALITY_BIAS.hornMouth);
        const item2 = mintItem(ctx.rng, ctx.rng.pick(lootPool(ctx)), QUALITY_BIAS.hornMouth);
        giveItem(winner, item1, item2);
        ctx.logEvent(
            fill(ctx.pickText(BLOODBATH_TEXTS.survive), { tribute: winner.name, items: `${item1.name} and ${item2.name}` }),
            [winner.id],
            { important: true, category: 'loot' }
        );
    }

    // §12: mark the Cornucopia dead as Cornucopia dead. `dayOfDeath` cannot
    // distinguish them from anyone who dies later on day 1, which is why
    // 'Went In Together, Came Out Alone' had never fired for anybody.
    const cornucopiaDead = alive.filter(t => t.status === 'dead');
    cornucopiaDead.forEach(t => { t.diedInBloodbath = true; });

    const fallen = cornucopiaDead.length;
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
