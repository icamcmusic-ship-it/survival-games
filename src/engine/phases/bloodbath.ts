import { dreadOf } from '../intent';
import { targetDrawOf } from '../targeting';
import { SimContext, getAlive } from '../context';
import { tickRunRecords } from '../runRecords';
import { RNG } from '../../utils/rng';
import { Item, Tribute } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { traitMod } from '../../data/traits';
import { ARCHETYPES } from '../../data/archetypes';
import { ALLIANCES, BLOODBATH, QUALITY_BIAS, TRAINING } from '../../data/balance';
import { registerAlliance } from '../alliance';
import { resolveCombat, resolveGroupCombat, selfInflictedDeath } from '../combat';
import { BLOODBATH_TEXTS,
    PEDESTAL_ARENA_SHOTS, PEDESTAL_REACTIONS, EARLY_STEP_OFF, GONG_DECISIONS,
} from '../../data/flavorText';
import { giveItem, itemPhrase, mintItem, itemPoolFor, pickForDistrict } from '../items';
import { personaThreat } from './alliances';
import { getRel, setRel } from '../relationships';
import { noteContact, noteSighting, ensureMemory } from '../memory';
import { addFear } from '../fear';
import { wildcardIs, arenaHasLaw } from '../gamesProfile';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export function startGames(ctx: SimContext) {
    ctx.state.phase = 'bloodbath';
    ctx.state.day = 1;
    initializeCareerAlliance(ctx);
    // §(requests): ...and everybody else's, which used to evaporate at the gong.
    initializePactAlliances(ctx);
}

function initializeCareerAlliance(ctx: SimContext) {
    const allCareers = getAlive(ctx.state).filter(t => t.isCareer);
    // The pack is subject to the same ALLIANCES.maxSize cap as any other
    // alliance — a career field bigger than that splits into a pack and
    // stragglers rather than one oversized, permanently-outnumbering gang.
    // §9 (requests): the pack is allowed to be larger than an ordinary
    // alliance. A Career year in the source material is one bloc that
    // outnumbers everything else in the arena, and capping it at the generic
    // `maxSize` split a six-Career field into a pack and two loose Careers who
    // then read as ordinary solo tributes. `grandCoalitionExtra` is the same
    // allowance the recruitment ceiling already grants a Career-heavy year.
    const packCap = ALLIANCES.maxSize + ALLIANCES.grandCoalitionExtra;
    const capped = allCareers.length > packCap
        ? ctx.rng.shuffle(allCareers).slice(0, packCap)
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
        // §(requests 17): recorded, not narrated here. Nobody is talking to
        // anybody on a plate — this is a decision that shows itself at the gong
        // and is reported then, by what the tribute does.
        ctx.state.careerOptOutIds = [...(ctx.state.careerOptOutIds ?? []), t.id];
    });

    const careers = capped.filter(t => !optOuts.includes(t));

    if (careers.length > 1 && ctx.rng.chance(ALLIANCES.careerEarlyCollapseChance)) {
        // Same rule: this is a fact about the bloodbath, reported after it.
        ctx.state.careerPackCollapsed = true;
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
    }
}

/**
 * §(requests): the packs the floor built, made real at the gong.
 *
 * Three days of training produced `trainingPact` — a flat list of
 * pre-agreements — and at the gong precisely one of them mattered: the Career
 * pack, which `initializeCareerAlliance` builds separately. Everybody else's
 * agreement bought a warmer bloodbath line and nothing else, then had to be
 * re-discovered from scratch by the day-phase formation roll, which only ever
 * pairs two alliance-free tributes. So the only group of three or more in the
 * arena at first light was the Careers, and the arena's most interesting
 * counterweight — the outer-district coalition that forms *because* the pack
 * exists — could not be there to meet them.
 *
 * The pact graph already describes those groups: two tributes who agreed on
 * the floor are an edge, and a connected component is a pack. They are
 * assembled here, capped at the same `maxSize` every other alliance obeys, and
 * seeded with the regard three days of agreeing is worth.
 *
 * Careers are excluded outright — their pack is built above, and a pact
 * between a Career and an outer-district tribute is a recruitment, which the
 * alliance layer already owns.
 */
function initializePactAlliances(ctx: SimContext) {
    const alive = getAlive(ctx.state).filter(t => !t.isCareer && t.allianceId === undefined);
    const byId = new Map(alive.map(t => [t.id, t]));
    const seen = new Set<string>();

    alive.forEach(seed => {
        if (seen.has(seed.id)) return;
        // Breadth-first across the pact graph: everybody this tribute agreed
        // with, everybody *they* agreed with, and so on. That is what makes a
        // five-person coalition possible from a handful of two-way handshakes,
        // which is exactly how one forms on a real training floor.
        const group: Tribute[] = [];
        const queue = [seed];
        while (queue.length > 0 && group.length < ALLIANCES.maxSize) {
            const t = queue.shift()!;
            if (seen.has(t.id)) continue;
            seen.add(t.id);
            group.push(t);
            (t.trainingPact ?? []).forEach(id => {
                const other = byId.get(id);
                if (other && !seen.has(other.id)) queue.push(other);
            });
        }
        if (group.length < 2) return;

        const allianceId = `floor-pact-${seed.id}`;
        group.forEach(t => {
            t.allianceId = allianceId;
            group.forEach(other => {
                if (t.id === other.id) return;
                // Agreeing on the floor is worth less than an academy
                // childhood — the Career floor is 45 — but it is not nothing,
                // and it is what they are walking off the plates on.
                setRel(t, other.id, Math.max(ALLIANCES.floorPactRegard, getRel(t, other.id)));
            });
        });
        registerAlliance(ctx, allianceId, group);
        ctx.logEvent(
            group.length > 2
                ? `${group.map(t => `${t.name} (D${t.district})`).join(', ')} come off the plates together. `
                    + 'Nobody trained them to do this. They agreed to it on the floor, in front of everybody, and they meant it.'
                : `${group[0].name} and ${group[1].name} find each other in the first seconds and stay found.`,
            group.map(t => t.id),
            { important: true, category: 'alliance' },
        );
    });
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
    // §23: a Career knows what is at the mouth of the horn and which end of it
    // to run to. Arrival order is what decides who comes away armed, and being
    // armed is most of what makes the pack dangerous in the first minute.
    const trained = t.isCareer ? BLOODBATH.careerReachBonus : 0;
    return proximity * 10 + t.attributes.agility + trained + ctx.rng.nextFloat() * 3;
}

/** Weapons only. What is actually laid out at the mouth of the horn. */
const HORN_WEAPONS = ITEMS.filter(i => i.type === 'weapon');
// §5 `noWeapons`: an arena with nothing in it to pick up. The Quell already
// did this through `quell-weapons-fixed`; as a law it is declarable by any
// arena, and what the horn holds is everything except the blades.

/**
 * 'The Cornucopia Forfeit': no weapons anywhere near the horn this year,
 * only food — every loot draw in the bloodbath routes through this instead
 * of the unfiltered `ITEMS`/`HORN_WEAPONS` when the Quell is standing.
 */
function lootPool(ctx: SimContext): Item[] {
    const base = wildcardIs(ctx.state, 'quell-cornucopia-forfeit') ? ITEMS.filter(i => i.type === 'food') : ITEMS;
    // §5 `noWeapons` composes with the Quell rather than overriding it.
    return itemPoolFor(ctx.state, base);
}
function hornWeaponsPool(ctx: SimContext): Item[] {
    if (arenaHasLaw(ctx.state, 'noWeapons')) return lootPool(ctx);
    return wildcardIs(ctx.state, 'quell-cornucopia-forfeit') ? lootPool(ctx) : HORN_WEAPONS;
}

/**
 * §(requests 17): the sixty seconds, as the country sees them.
 *
 * One arena-wide shot, then one line for as many tributes as the minute has
 * room for — chosen by who they are rather than by a roll, so the same cast
 * produces the same minute and a frightened fourteen-year-old never reads as
 * a Career limbering up. Capped: twenty-four reaction lines before the gong
 * would bury the gong.
 */
function pedestalMinute(ctx: SimContext, alive: Tribute[]) {
    const horn = ctx.state.arena.zones[0]?.name ?? 'the Cornucopia';
    ctx.logEvent(
        ctx.pickText(PEDESTAL_ARENA_SHOTS)
            .split('{arena}').join(ctx.state.arena.name)
            .split('{horn}').join(horn),
        [],
        { important: true, category: 'arena' }
    );

    const kindOf = (t: Tribute): keyof typeof PEDESTAL_REACTIONS => {
        const partner = t.trainingPact?.length
            ? alive.find(o => t.trainingPact!.includes(o.id))
            : undefined;
        if (partner && ctx.rng.chance(BLOODBATH.pedestalAlliedShare)) return 'allied';
        if (t.isCareer || traitMod(t, 'hornCommitment') > 0) return 'eager';
        const dread = dreadOf(ctx, t);
        if (dread >= BLOODBATH.pedestalFrightenedDread || t.vitals.sanity < BLOODBATH.pedestalFrightenedSanity) return 'frightened';
        if (ARCHETYPES[t.archetype].caution > ARCHETYPES[t.archetype].aggression) return 'fleeing';
        return 'calculating';
    };

    ctx.rng.shuffle([...alive]).slice(0, BLOODBATH.pedestalReactionCap).forEach(t => {
        const kind = kindOf(t);
        const partner = t.trainingPact?.length
            ? alive.find(o => t.trainingPact!.includes(o.id))
            : undefined;
        if (kind === 'allied' && !partner) return;
        const involved = kind === 'allied' && partner ? [t.id, partner.id] : [t.id];
        ctx.logEvent(
            ctx.pickText([...PEDESTAL_REACTIONS[kind]])
                .split('{tribute}').join(t.name)
                .split('{other}').join(partner?.name ?? '')
                .split('{arena}').join(ctx.state.arena.name)
                .split('{horn}').join(horn),
            involved,
            { category: kind === 'frightened' ? 'sanity' : 'system' }
        );
    });
}

/**
 * §(requests 18): one line per tribute, naming what they did at the gong.
 *
 * The decision is derived, not rolled: the fighter/runner split has already
 * been decided by plate position, archetype, traits, the horn's shape and the
 * persona they sold on the couch, so this reads that decision back and says
 * which *kind* of it this tribute's was. A fighter who is going for a person
 * rather than for supplies is a hunt; a runner who has somebody to meet is an
 * ally; a runner with a very low read of their own chances freezes.
 */
function announceGongDecisions(ctx: SimContext, alive: Tribute[], fighters: Tribute[], _runners: Tribute[]) {
    const horn = ctx.state.arena.zones[0]?.name ?? 'the Cornucopia';
    const isFighter = new Set(fighters.map(t => t.id));
    // Arrival order tells us who is going *into* the horn and who is working
    // its edge: the front of the charge gets the mouth, the back gets scraps.
    const order = scrambleOrder(ctx, fighters);
    const deepIds = new Set(order.slice(0, Math.max(1, Math.ceil(order.length * BLOODBATH.gongDeepShare))).map(t => t.id));

    alive.forEach(t => {
        const partner = (t.trainingPact ?? [])
            .map(id => alive.find(o => o.id === id))
            .find((o): o is Tribute => !!o);
        const sworn = ensureMemory(t).vengeance
            .map(id => alive.find(o => o.id === id))
            .find((o): o is Tribute => !!o);

        let kind: keyof typeof GONG_DECISIONS;
        let other: Tribute | undefined;
        if (isFighter.has(t.id)) {
            if (sworn && ctx.rng.chance(BLOODBATH.gongHuntShare)) { kind = 'hunt'; other = sworn; }
            else if (deepIds.has(t.id)) kind = 'horn';
            else kind = 'edge';
        } else if (partner && ctx.rng.chance(BLOODBATH.gongAllyShare)) {
            kind = 'ally'; other = partner;
        } else if ((dreadOf(ctx, t) >= BLOODBATH.gongFreezeDread || t.age <= BLOODBATH.gongFreezeAge)
            && ctx.rng.chance(BLOODBATH.gongFreezeShare)) {
            // Sanity is full on the plates by construction, so freezing reads
            // off the two things that are actually true up there: how much of
            // the field this tribute is already afraid of, and how young they
            // are. A fourteen-year-old who has not moved is the shot.
            kind = 'freeze';
        } else if (ARCHETYPES[t.archetype].caution > BLOODBATH.gongWaitCaution && ctx.rng.chance(BLOODBATH.gongWaitShare)) {
            kind = 'wait';
        } else {
            kind = 'flee';
        }

        ctx.logEvent(
            ctx.pickText([...GONG_DECISIONS[kind]])
                .split('{tribute}').join(t.name)
                .split('{other}').join(other?.name ?? '')
                .split('{horn}').join(horn),
            other ? [t.id, other.id] : [t.id],
            { category: kind === 'hunt' || kind === 'horn' ? 'combat' : 'travel' }
        );
    });
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

    // §(requests 17): the minute on the plates, as the tributes experience it.
    //
    // This replaces the Gamemakers' arena briefing, which was a specification
    // read aloud at the one moment nobody in the fiction is reading anything.
    // What is here instead is the shot the country actually gets: the arena
    // arriving all at once, and sixty seconds of twenty-four people looking at
    // it. Still gated on the same preference, which now controls this.
    if (ctx.state.arenaBriefingOnDrop !== false) pedestalMinute(ctx, alive);

    // §(requests 17): the plates are mined until the gong, which is the first
    // rule anybody learns about the Games and was the one thing the plates
    // could not do. Half a percent, per tribute, per Games.
    const steppedOff = alive.filter(_t => ctx.rng.chance(BLOODBATH.earlyStepOffChance));
    steppedOff.forEach(t => {
        ctx.logEvent(
            ctx.pickText(EARLY_STEP_OFF)
                .split('{tribute}').join(t.name)
                .split('{arena}').join(ctx.state.arena.name),
            [t.id],
            { important: true, category: 'death' }
        );
        selfInflictedDeath(ctx, t, 'Stepped off the plate before the gong', true);
    });

    const onTheGong = getAlive(ctx.state);
    ctx.logEvent(
        `The gong sounds. ${onTheGong.length} tributes come off their plates at once.`,
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
        // §5: what the horn is shaped like changes who runs at it. A walled
        // horn is a box — fewer take it on, and those who do are past talking
        // themselves out of it. An island has to be swum or waded to, so it
        // selects for whoever is at home in water rather than whoever is
        // nearest.
        const layout = ctx.state.arena.cornucopiaLayout ?? 'plate';
        if (layout === 'walled') {
            fightChance -= BLOODBATH.walledHornDeterrent;
            if (t.isCareer || t.traits.includes('Bloodthirsty')) fightChance += BLOODBATH.walledHornCommitment;
        } else if (layout === 'island') {
            fightChance -= BLOODBATH.islandHornDeterrent;
            fightChance += traitMod(t, 'water') * BLOODBATH.islandHornSwimmer;
        }
        fightChance += (t.attributes.agility - 5) * BLOODBATH.fightChanceAgility;
        if (t.attributes.strength > 7) fightChance += 0.15;
        fightChance += traitMod(t, 'hornCommitment');
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

    // §(requests 18): what each of them decided, said out loud, before any of
    // it resolves.
    //
    // The bloodbath opened with a headcount and then started printing fights,
    // so the single most consequential decision any tribute makes all Games —
    // which way they went at the gong — was inferred by the reader from who
    // turned up dead. Every tribute gets a line, and which line they get is
    // read off the same state that decides what actually happens to them.
    announceGongDecisions(ctx, onTheGong, fighters, runners);

    // §(requests 17): and what the pack turned out to be, now that the plates
    // have emptied and it is a thing that can be observed rather than agreed.
    const optedOut = (ctx.state.careerOptOutIds ?? [])
        .map(id => ctx.state.tributes.find(o => o.id === id))
        .filter((t): t is Tribute => !!t && t.status === 'alive');
    optedOut.forEach(t => ctx.logEvent(
        `${t.name} of District ${t.district} comes off the plate and goes the other way from the rest of the Careers. Some years the academy's arithmetic does not convince everybody.`,
        [t.id],
        { important: true, category: 'alliance' }
    ));
    const pack = getAlive(ctx.state).filter(t => t.allianceId?.startsWith('career-pack-'));
    if (ctx.state.careerPackCollapsed) {
        const careers = getAlive(ctx.state).filter(t => t.isCareer);
        if (careers.length > 1) {
            ctx.logEvent(
                `The Careers reach ${ctx.state.arena.zones[0]?.name ?? 'the Cornucopia'} together and get no further than that. `
                + `${careers.map(c => c.name).join(', ')} scatter before the bloodbath is finished — there is no pack this year.`,
                careers.map(c => c.id),
                { important: true, category: 'alliance' }
            );
        }
    } else if (pack.length > 1) {
        ctx.logEvent(
            `The Careers — ${pack.map(c => `${c.name} (D${c.district})`).join(', ')} — converge on the horn and close ranks around it. Everyone else in the arena just became prey.`,
            pack.map(c => c.id),
            { important: true, category: 'alliance' }
        );
    }

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
        // §(requests): they reach for what they know. The girl from District 4
        // does not come up from the mouth of the horn holding a mace as often
        // as she comes up holding the trident — see `pickForDistrict`.
        const base = first
            ? pickForDistrict(ctx.rng, t, hornWeaponsPool(ctx))
            : pickForDistrict(ctx.rng, t, lootPool(ctx));
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
        const hunter = ctx.rng.pickOrUndefined(hunters.filter(h => h.status === 'alive' && h.id !== t.id));
        if (!hunter) return;
        /*
         * §(requests): say what they were caught *with*.
         *
         * "runs them down" named the pursuit and nothing else, and the
         * exchange that follows may or may not produce its own line, so a
         * share of bloodbath deaths read as somebody being generically killed
         * by a named tribute with no method attached. The hunter is selected
         * out of `hunters`, which is by definition everybody who came up from
         * the horn holding something, so the weapon is always known here —
         * it simply was not being said.
         */
        const held = hunter.inventory.find(i => i.type === 'weapon');
        ctx.logEvent(
            `${t.name} turns for the treeline and does not get there. ${hunter.name} runs them down before they clear `
            + `the ring of plates, ${held ? `${itemPhrase(held)} already in hand` : 'with nothing but their hands'}.`,
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
    // §23: a Career inside the knot hits harder than anybody else inside it.
    const zoneMultiplier = (t: Tribute) => (killingZone.has(t.id)
        ? BLOODBATH.killingZoneDamage * (t.isCareer ? BLOODBATH.careerKillingZoneBonus : 1)
        : 1);

    let rounds = pool.length * 6 + 12;
    while (pool.length > 1 && rounds-- > 0) {
        // The pack does not queue up for duels. If enough of them are still in
        // the scrum they pick one target and go through them together, which is
        // the entire reason a Career pack is frightening.
        const packed = pool.filter(t => t.isCareer && t.allianceId);
        if (packed.length >= 2 && pool.length > packed.length && ctx.rng.chance(BLOODBATH.packGangUpChance)) {
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
            const item = mintItem(ctx.rng, pickForDistrict(ctx.rng, t, lootPool(ctx)), QUALITY_BIAS.hornScatter);
            giveItem(t, item);
            ctx.logEvent(`${t.name} grabs ${itemPhrase(item)} on the way out.`, [t.id], { category: 'loot' });
        });
    }

    else if (pool.length === 1) {
        const winner = pool[0];
        const item1 = mintItem(ctx.rng, pickForDistrict(ctx.rng, winner, lootPool(ctx)), QUALITY_BIAS.hornMouth);
        const item2 = mintItem(ctx.rng, pickForDistrict(ctx.rng, winner, lootPool(ctx)), QUALITY_BIAS.hornMouth);
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
    // §1.3: the run-record differ used to be driven by the day/night
    // orchestrator only, so a dip below the near-death line and back inside
    // the bloodbath — the most violent phase in the game — was never seen.
    // The tick itself skips the met-anybody record while the phase is
    // 'bloodbath', so calling it here only seeds the watch and counts the
    // health recovery.
    tickRunRecords(ctx);
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
        // §8: the trait that claims nobody is looking at them. The bloodbath
        // is a third of every run's deaths and it was reading everything about
        // a target except how little anybody wanted to pick them.
        weight += targetDrawOf(target) * BLOODBATH.targetDrawWeight;
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
