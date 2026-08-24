import { ArchetypeId, Objective, Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { ARCHETYPE_HOOKS, HUNTING } from '../data/balance';
import { SimContext, getAlive } from './context';
import { getRel, adjustMutual, adjustRel } from './relationships';
import { fearOf, addFear } from './fear';
import { addExcitement } from './audience';
import { grantTruce } from './parley';
import { giveItem, inventoryValue } from './items';
import { healInjury, clearBleeding } from './wounds';
import { clampTribute } from './vitals';
import { getZone, zoneNames } from './map';
import { ARCHETYPE_SIGNATURE_TEXTS } from '../data/flavorText';

/**
 * A2: the behavioural half of an archetype.
 *
 * `ArchetypeDef` grew hooks — a target preference, a risk curve, an objective
 * bias, and one signature beat per run — precisely so an archetype could stop
 * being four scalars with a name attached. This is where those hooks are read.
 * Nothing here is optional-by-omission: an archetype that declares no hook
 * behaves exactly as it did before, which is what keeps the original seven
 * comparable while the eight new ones do something visibly different.
 */

/**
 * How much this tribute's caution has moved by today.
 *
 * `riskCurve` is the shape: `flat` never wavers (a Zealot on day 9 is the
 * Zealot from day 1), `escalating` gets warier as the field narrows, and
 * `front-loaded` spends everything at the gong and settles afterwards. Read
 * anywhere the raw `arch.caution` used to be the whole story.
 */
export function effectiveCaution(t: Tribute, day: number): number {
    const arch = ARCHETYPES[t.archetype];
    const base = arch.caution;
    switch (arch.riskCurve) {
        case 'flat':
            return base;
        case 'escalating':
            return base + Math.min(ARCHETYPE_HOOKS.escalatingCap, day * ARCHETYPE_HOOKS.escalatingPerDay);
        case 'front-loaded':
            return base + Math.min(ARCHETYPE_HOOKS.frontLoadedCap, day * ARCHETYPE_HOOKS.frontLoadedPerDay);
        default:
            return base;
    }
}

/** The archetype's declared pull toward a kind of standing intention. */
export function objectiveBiasFor(t: Tribute, kind: Objective['kind']): number {
    return ARCHETYPES[t.archetype].objectiveBias?.[kind] ?? 0;
}

/**
 * The archetype's own weighting on a candidate target, on top of the shared
 * opportunism arithmetic.
 *
 * The base score is "who is the easiest kill worth the most loot" for
 * everybody. A Mercenary should not read the board that way — they want the
 * richest pack in the arena — and a Zealot wants whoever is hardest, because
 * that is the point they are making.
 */
export function targetPreferenceScore(t: Tribute, candidate: Tribute, hopsAway: number): number {
    const pref = ARCHETYPES[t.archetype].targetPreference;
    const w = ARCHETYPE_HOOKS.targetPreferenceWeight;
    switch (pref) {
        case 'weakest':
            return (100 - candidate.health) * w;
        case 'strongest':
            return candidate.health * w + candidate.trainingScore * ARCHETYPE_HOOKS.strongestPerTrainingPoint;
        case 'nearest':
            return -hopsAway * ARCHETYPE_HOOKS.nearestPerHop;
        case 'richest':
            return inventoryValue(candidate) * ARCHETYPE_HOOKS.richestPerValue;
        case 'rival':
            return Math.max(0, -getRel(t, candidate.id)) * w;
        default:
            return 0;
    }
}

// ---------------------------------------------------------------------------
// Signatures: the one beat per run that makes an archetype a character.
// ---------------------------------------------------------------------------

type Signature = (ctx: SimContext, t: Tribute) => boolean;

/** Everyone alive who is not this tribute and not their ally. */
function others(ctx: SimContext, t: Tribute): Tribute[] {
    return getAlive(ctx.state).filter(o =>
        o.id !== t.id && (o.allianceId === undefined || o.allianceId !== t.allianceId));
}

function say(ctx: SimContext, t: Tribute, key: keyof typeof ARCHETYPE_SIGNATURE_TEXTS, cast: string[], vars: Record<string, string> = {}) {
    let text = ctx.pickText(ARCHETYPE_SIGNATURE_TEXTS[key] as string[]);
    Object.entries({ tribute: t.name, zone: t.zone, ...vars }).forEach(([k, v]) => {
        text = text.split(`{${k}}`).join(v);
    });
    ctx.logEvent(text, cast, { important: true, category: 'system' });
}

const SIGNATURES: Record<string, Signature> = {
    /** Career: the pack declares itself, out loud, at somebody's expense. */
    careerDeclaration: (ctx, t) => {
        const pack = getAlive(ctx.state).filter(o => o.allianceId !== undefined && o.allianceId === t.allianceId);
        if (pack.length < 2) return false;
        const mark = others(ctx, t).sort((a, b) => a.health - b.health)[0];
        if (!mark) return false;
        say(ctx, t, 'careerDeclaration', [...pack.map(p => p.id), mark.id], { target: mark.name });
        others(ctx, t).forEach(o => addFear(o, t.id, ARCHETYPE_HOOKS.declarationFear));
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Strategist: they were counting, and they cash it in. */
    strategistGambit: (ctx, t) => {
        const mark = others(ctx, t).sort((a, b) => a.health - b.health)[0];
        if (!mark) return false;
        say(ctx, t, 'strategistGambit', [t.id, mark.id], { target: mark.name });
        t.objective = { kind: 'hunt', targetId: mark.id, expires: (ctx.state.cycle ?? 0) + ARCHETYPE_HOOKS.signatureObjectiveCycles };
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Survivalist: they have been building a larder nobody else noticed. */
    survivalistLarder: (ctx, t) => {
        say(ctx, t, 'survivalistLarder', [t.id]);
        t.vitals.hunger = Math.max(0, t.vitals.hunger - ARCHETYPE_HOOKS.larderRelief);
        t.vitals.thirst = Math.max(0, t.vitals.thirst - ARCHETYPE_HOOKS.larderRelief);
        clampTribute(t);
        return true;
    },

    /** Protector: they put themselves between somebody and the arena. */
    protectorStand: (ctx, t) => {
        const ward = getAlive(ctx.state).find(o =>
            o.id !== t.id && o.zone === t.zone
            && (o.allianceId === t.allianceId || getRel(t, o.id) > ARCHETYPE_HOOKS.standRegard));
        if (!ward) return false;
        say(ctx, t, 'protectorStand', [t.id, ward.id], { ward: ward.name });
        t.objective = { kind: 'protect', wardId: ward.id, expires: (ctx.state.cycle ?? 0) + ARCHETYPE_HOOKS.signatureObjectiveCycles };
        adjustMutual(ctx.state, t, ward, ARCHETYPE_HOOKS.standBond);
        t.sponsorTrust = Math.min(100, t.sponsorTrust + ARCHETYPE_HOOKS.signatureTrust);
        return true;
    },

    /** Trickster: the snare nobody watched them build. */
    tricksterSnare: (ctx, t) => {
        say(ctx, t, 'tricksterSnare', [t.id]);
        others(ctx, t).forEach(o => addFear(o, t.id, ARCHETYPE_HOOKS.snareFear));
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Wildcard: the turn nobody, including them, saw coming. */
    wildcardTurn: (ctx, t) => {
        say(ctx, t, 'wildcardTurn', [t.id]);
        t.momentum = Math.min(HUNTING.momentumMax, (t.momentum ?? 0) + ARCHETYPE_HOOKS.wildcardMomentum);
        t.vitals.sanity = Math.max(0, t.vitals.sanity - ARCHETYPE_HOOKS.wildcardSanity);
        clampTribute(t);
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Underdog: the moment they stop apologising for being here. */
    underdogRefusal: (ctx, t) => {
        say(ctx, t, 'underdogRefusal', [t.id]);
        t.resolve = Math.min(100, (t.resolve ?? 50) + ARCHETYPE_HOOKS.refusalResolve);
        t.sponsorTrust = Math.min(100, t.sponsorTrust + ARCHETYPE_HOOKS.signatureTrust);
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Mercenary: the contract, stated out loud, with a price on it. */
    mercenaryContract: (ctx, t) => {
        const client = getAlive(ctx.state).find(o =>
            o.id !== t.id && o.zone === t.zone && o.inventory.some(i => i.type !== 'weapon'));
        if (!client) return false;
        const idx = client.inventory.findIndex(i => i.type !== 'weapon');
        const fee = client.inventory.splice(idx, 1)[0];
        giveItem(t, fee);
        t.retainerPaidBy = [...(t.retainerPaidBy ?? []), client.id];
        say(ctx, t, 'mercenaryContract', [t.id, client.id], { client: client.name, fee: fee.name });
        // §4.3: a retainer is peace bought, and it lasts as long as the fee.
        grantTruce(ctx, t, client, ARCHETYPE_HOOKS.contractTruceCycles, 'extortion');
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Zealot: the sermon. Nobody asked for it and nobody forgets it. */
    zealotSermon: (ctx, t) => {
        say(ctx, t, 'zealotSermon', [t.id]);
        t.resolve = 100;
        others(ctx, t).forEach(o => {
            addFear(o, t.id, ARCHETYPE_HOOKS.sermonFear);
            o.vitals.sanity = Math.max(0, o.vitals.sanity - ARCHETYPE_HOOKS.sermonSanity);
            clampTribute(o);
        });
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Medic: triage, in the open, on somebody who was going to die. */
    medicTriage: (ctx, t) => {
        const patient = getAlive(ctx.state).find(o =>
            o.id !== t.id && o.zone === t.zone
            && (o.injuries.bleeding || o.injuries.infected || o.health < ARCHETYPE_HOOKS.triageHealth));
        if (!patient) return false;
        clearBleeding(patient);
        healInjury(patient, 'infected');
        patient.health = Math.min(100, patient.health + ARCHETYPE_HOOKS.triageHeal);
        clampTribute(patient);
        say(ctx, t, 'medicTriage', [t.id, patient.id], { patient: patient.name });
        adjustMutual(ctx.state, t, patient, ARCHETYPE_HOOKS.triageBond);
        t.sponsorTrust = Math.min(100, t.sponsorTrust + ARCHETYPE_HOOKS.signatureTrust);
        return true;
    },

    /** Saboteur: one arena-scale act of vandalism per run. */
    saboteurStrike: (ctx, t) => {
        const traps = (ctx.state.traps ?? []).filter(tr => tr.ownerId !== t.id);
        const caches = getAlive(ctx.state).filter(o => o.id !== t.id && o.inventory.some(i => i.type === 'food'));
        if (traps.length === 0 && caches.length === 0) return false;
        if (traps.length > 0) {
            const sprung = traps.slice(0, ARCHETYPE_HOOKS.sabotageTraps);
            ctx.state.traps = (ctx.state.traps ?? []).filter(tr => !sprung.includes(tr));
            sprung.forEach(tr => { t.trapsDisarmed = (t.trapsDisarmed ?? 0) + 1; });
            say(ctx, t, 'saboteurTraps', [t.id], { count: String(sprung.length) });
        } else {
            const victim = caches[0];
            const idx = victim.inventory.findIndex(i => i.type === 'food');
            const spoiled = victim.inventory[idx];
            spoiled.poison = true;
            say(ctx, t, 'saboteurCache', [t.id, victim.id], { victim: victim.name, item: spoiled.name });
        }
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /** Beast: the sound, and what it does to everybody who hears it. */
    beastRoar: (ctx, t) => {
        say(ctx, t, 'beastRoar', [t.id]);
        others(ctx, t).forEach(o => {
            addFear(o, t.id, ARCHETYPE_HOOKS.roarFear);
            o.vitals.sanity = Math.max(0, o.vitals.sanity - ARCHETYPE_HOOKS.roarSanity);
            clampTribute(o);
        });
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement * 2);
        return true;
    },

    /** Diplomat: a truce between two people who are not them. */
    diplomatAccord: (ctx, t) => {
        const here = getAlive(ctx.state).filter(o => o.id !== t.id && o.zone === t.zone);
        if (here.length < 2) return false;
        const [a, b] = here;
        grantTruce(ctx, a, b, ARCHETYPE_HOOKS.brokeredTruceCycles, 'brokered');
        t.brokeredTruces = [...(t.brokeredTruces ?? []), [a.id, b.id]];
        say(ctx, t, 'diplomatAccord', [t.id, a.id, b.id], { first: a.name, second: b.name });
        adjustRel(a, t.id, ARCHETYPE_HOOKS.accordGratitude);
        adjustRel(b, t.id, ARCHETYPE_HOOKS.accordGratitude);
        t.sponsorTrust = Math.min(100, t.sponsorTrust + ARCHETYPE_HOOKS.signatureTrust);
        return true;
    },

    /** Scholar: they say what the arena is about to do, and are right. */
    scholarReading: (ctx, t) => {
        const zone = getZone(ctx.state.arena, t.zone);
        const elsewhere = zoneNames(ctx.state.arena).find(z => z !== t.zone) ?? t.zone;
        say(ctx, t, 'scholarReading', [t.id], { read: zone?.name ?? t.zone, elsewhere });
        // Being right about the arena is worth more than being strong in it.
        t.objective = {
            kind: 'reach', zone: elsewhere, reason: 'shelter',
            expires: (ctx.state.cycle ?? 0) + ARCHETYPE_HOOKS.signatureObjectiveCycles,
        };
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement);
        return true;
    },

    /**
     * Ghost: at the final eight, a tribute nobody has any footage of gets
     * named personally by the Gamemakers — which is the last thing they want.
     */
    ghostNaming: (ctx, t) => {
        if (getAlive(ctx.state).length > ARCHETYPE_HOOKS.ghostNamingField) return false;
        if (t.kills > 0) return false;
        say(ctx, t, 'ghostNaming', [t.id]);
        addExcitement(t, ARCHETYPE_HOOKS.signatureExcitement * 3);
        t.sponsorTrust = Math.min(100, t.sponsorTrust + ARCHETYPE_HOOKS.signatureTrust * 2);
        // ...and every other survivor now knows there is somebody they have
        // never once seen.
        others(ctx, t).forEach(o => addFear(o, t.id, ARCHETYPE_HOOKS.namingFear));
        return true;
    },
};

/**
 * Fires at most one signature per tribute per run, once the conditions for
 * that particular beat are met.
 *
 * Deliberately cheap to reason about: a signature that returns false has not
 * fired and will be offered again next cycle, so a Ghost's naming waits for
 * the final eight and a Career's declaration waits for a pack.
 */
export function runArchetypeSignatures(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        if (t.signatureFired) return;
        const key = ARCHETYPES[t.archetype].signature;
        if (!key) return;
        const fn = SIGNATURES[key];
        if (!fn) return;
        // Signatures are set pieces, not per-cycle noise: they wait for a
        // cycle the beat can plausibly land on.
        if (!ctx.rng.chance(ARCHETYPE_HOOKS.signatureChancePerCycle)) return;
        if (fn(ctx, t)) t.signatureFired = true;
    });
}

/**
 * A2: the Ghost's tension, resolved once per cycle.
 *
 * `unseenStreak` is their scoring currency: a bloc of sponsors is betting on
 * the one tribute nobody can film, and the audience-interest system — which
 * escalates on `excitementRating` — punishes them for exactly the same thing.
 * Running both directions at once is the whole point of the archetype, and it
 * is a genuine tension rather than a bonus.
 */
export function tickGhosts(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        if (t.archetype !== 'ghost') return;
        const streak = t.unseenStreak ?? 0;
        if (streak <= 0) return;
        const credit = Math.min(ARCHETYPE_HOOKS.ghostTrustCap, streak * ARCHETYPE_HOOKS.ghostTrustPerCycle);
        t.ghostTrust = (t.ghostTrust ?? 0) + credit;
        t.sponsorTrust = Math.min(100, t.sponsorTrust + credit);
        // ...and the crowd, which cannot love what it cannot find, drifts.
        addExcitement(t, -ARCHETYPE_HOOKS.ghostExcitementDrain);
    });
}

/**
 * A2: a Diplomat's death dissolves every truce they brokered.
 *
 * The whole reason a truce brokered by somebody else holds is that they are
 * standing there. Called from the death path.
 */
export function dissolveBrokeredTruces(ctx: SimContext, dead: Tribute) {
    const brokered = dead.brokeredTruces;
    if (!brokered || brokered.length === 0) return;
    let dissolved = 0;
    brokered.forEach(([aId, bId]) => {
        const a = ctx.state.tributes.find(o => o.id === aId);
        const b = ctx.state.tributes.find(o => o.id === bId);
        if (!a || !b) return;
        if (a.truces?.[bId] === undefined && b.truces?.[aId] === undefined) return;
        if (a.truces) delete a.truces[bId];
        if (b.truces) delete b.truces[aId];
        dissolved += 1;
    });
    if (dissolved === 0) return;
    ctx.logEvent(
        `${dead.name} is dead, and so is every agreement they talked anyone into. ${dissolved === 1 ? 'One truce' : `${dissolved} truces`} across the arena quietly stop meaning anything.`,
        [dead.id],
        { important: true, category: 'alliance' }
    );
}

/** True when the two archetypes come into the arena already disliking each other. */
export function archetypeDislike(a: ArchetypeId, b: ArchetypeId): boolean {
    return (ARCHETYPES[a]?.hatesArchetypes ?? []).includes(b)
        || (ARCHETYPES[b]?.hatesArchetypes ?? []).includes(a);
}
