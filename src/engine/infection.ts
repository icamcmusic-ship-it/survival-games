/**
 * §3.1: infection, as a thing that happens to a wound rather than a status a
 * mutt applies.
 *
 * `injuries.infected` already existed, but only ever as something inflicted
 * from outside — a scavenger mutt's bite, a contaminated zone, a signature
 * event. A wound the tribute took in a fight and then never treated could sit
 * at grade 3 for nine days and never go bad, which is the one thing an
 * untreated wound in the field reliably does. Bleeding clots down and heals;
 * there was no state for "this one turned".
 *
 * The model:
 *
 *  - **Where it starts.** Only an open, untreated wound site at grade 2 or
 *    worse, and only after it has been left alone for a few cycles. The delay
 *    is the point — an infection that lands with the blow is just a second
 *    damage type, whereas one that arrives on day four is a consequence of not
 *    having dealt with day one.
 *  - **What raises the odds.** Filth and exposure: bad water, no shelter, a
 *    contaminated or wetland zone, exhaustion and starvation. A tribute with
 *    medicine proficiency, a camp and a full stomach mostly does not get sick.
 *  - **What it does.** It drains rather than spikes. `INJURY_DAMAGE.infected`
 *    already takes health per cycle; sepsis adds a slow, compounding pull on
 *    fatigue and sanity, and — the part that makes it lethal — it *deepens* on
 *    its own if nobody treats it, where every other status only ever holds or
 *    heals.
 *  - **How it is treated.** Differently from a fresh wound, which is the whole
 *    request. A field dressing closes a cut in one action; it does nothing at
 *    all for sepsis. Infection needs a real medical item, and even then it
 *    steps down one grade at a time rather than clearing, so the answer to
 *    "they went septic on day four" is several days of care, not one bandage.
 *
 * The site record is kept alongside the existing whole-body `injuries.infected`
 * flag, which stays the thing every other read site (odds, mentors, stance,
 * sponsors, betrayal opportunism) consults. Nothing downstream had to learn a
 * new field.
 */
import { InjurySite, Tribute } from '../models/types';
import { INFECTION, VITALS } from '../data/balance';
import { SimContext } from './context';
import { applyDamage } from './combat';
import { injure, injuryGrade, healInjury } from './wounds';
import { profOf, trainProficiency } from './proficiency';
import { traitMod } from '../data/traits';
import { hasCamp } from './fieldcraft';
import { getZone, zoneFeatures } from './map';
import { consumeOne } from './items';
import { clampTribute } from './vitals';

/** Sites that can turn septic. Frostbite and venom have their own arcs. */
const INFECTABLE: Exclude<InjurySite, 'bleeding'>[] = ['arms', 'legs', 'torso', 'head', 'burned'];

export function sepsisGrade(t: Tribute, site: InjurySite): number {
    return t.woundInfection?.[site] ?? 0;
}

/** The worst site currently septic, for prose and for the damage scale. */
export function worstSepsis(t: Tribute): { site: InjurySite; grade: number } | undefined {
    let best: { site: InjurySite; grade: number } | undefined;
    INFECTABLE.forEach(site => {
        const grade = sepsisGrade(t, site);
        if (grade > 0 && (!best || grade > best.grade)) best = { site, grade };
    });
    return best;
}

function siteWord(site: InjurySite): string {
    return site === 'burned' ? 'burn' : site === 'torso' ? 'side' : `${site} wound`;
}

/**
 * How likely this cycle is to be the one a neglected wound turns. Everything
 * here is a hygiene term: what they are drinking, what they are sleeping under,
 * what the ground is like, and whether the body has anything left to fight with.
 */
function infectionChance(ctx: SimContext, t: Tribute, grade: number): number {
    let chance = INFECTION.baseChance + (grade - INFECTION.minWoundGrade) * INFECTION.perGradeAbove;
    const zone = getZone(ctx.state.arena, t.zone);
    if (zone) {
        const features = zoneFeatures(zone);
        // Standing water and deep cover are what a wound goes bad in.
        if (zone.terrain === 'wetland') chance += INFECTION.wetlandBonus;
        if (features.waterSource && features.cover > INFECTION.dankCover) chance += INFECTION.dankBonus;
        const effects = ctx.state.zoneEffects?.[zone.name] ?? [];
        if (effects.some(e => e.kind === 'contaminated')) chance += INFECTION.contaminatedBonus;
    }
    // Somewhere clean and dry to lie down is most of field medicine.
    if (hasCamp(ctx, t, 'shelter')) chance -= INFECTION.shelterRelief;
    if (t.vitals.hunger > VITALS.starvingThreshold) chance += INFECTION.starvingBonus;
    if (t.vitals.fatigue > VITALS.exhaustedThreshold) chance += INFECTION.exhaustedBonus;
    // Knowing what a wound needs is the difference, and it is the read site
    // that makes the medicine station worth training at.
    chance -= profOf(t, 'medicine') * INFECTION.perMedicinePoint;
    chance -= traitMod(t, 'bleedResist') * INFECTION.hardyRelief;
    return Math.max(0, Math.min(INFECTION.maxChance, chance));
}

/**
 * One cycle of wounds going bad, sepsis deepening, and the body losing ground
 * to it. Called from the vitals pass, before status damage is applied.
 */
export function tickInfection(ctx: SimContext, t: Tribute) {
    if (t.status !== 'alive') return;
    t.woundInfection = t.woundInfection ?? {};
    t.woundAge = t.woundAge ?? {};

    INFECTABLE.forEach(site => {
        const grade = injuryGrade(t, site);
        const septic = sepsisGrade(t, site);

        if (grade <= 0) {
            // The wound closed. Whatever was in it went with it — but only if
            // it was clean when it closed. A septic site cannot close (see
            // `tickWoundRecovery`, which floors it at grade 1 while the
            // infection stands), so reaching here with sepsis on the record
            // would mean something cleared the wound out from under it.
            delete t.woundAge![site];
            if (septic > 0) delete t.woundInfection![site];
            return;
        }

        // How long this site has gone without closing or being dressed.
        t.woundAge![site] = (t.woundAge![site] ?? 0) + 1;

        if (septic > 0) {
            // §3.1: the part no other status does. An untreated infection does
            // not sit — it gets worse, and grade 3 is what kills.
            if (ctx.rng.chance(INFECTION.worsenChance)) {
                const next = Math.min(INFECTION.maxGrade, septic + 1);
                if (next !== septic) {
                    t.woundInfection![site] = next;
                    ctx.logEvent(
                        next >= INFECTION.maxGrade
                            ? `The skin around ${t.name}'s ${siteWord(site)} has gone dark and the heat of it is coming off them in waves. `
                                + 'This is no longer a wound they are carrying. It is a clock.'
                            : `${t.name}'s ${siteWord(site)} is worse today — swollen, wet, and warm to the back of a hand.`,
                        [t.id],
                        { important: next >= INFECTION.maxGrade, category: 'injury' }
                    );
                }
            }
            return;
        }

        // A fresh or shallow wound does not turn, and neither does one that has
        // only just been taken.
        if (grade < INFECTION.minWoundGrade) return;
        if ((t.woundAge![site] ?? 0) < INFECTION.incubationCycles) return;
        if (!ctx.rng.chance(infectionChance(ctx, t, grade))) return;

        t.woundInfection![site] = 1;
        injure(t, 'infected');
        ctx.logEvent(
            `The ${siteWord(site)} ${t.name} has been walking on for days has stopped looking like a wound and started looking like a problem. `
            + 'The edges are red and they are hotter than the night is.',
            [t.id],
            { important: true, category: 'injury' }
        );
    });

    syncInfectedFlag(t);
}

/**
 * The per-cycle drain, on top of `INJURY_DAMAGE.infected`'s health cost.
 *
 * Deliberately not health: health loss is already modelled, and a second
 * health tap would just make infection a faster poison. What sepsis takes is
 * the ability to keep going — you are exhausted, you cannot think, and the
 * fever is doing something to what you see.
 */
export function applySepsisDrain(ctx: SimContext, t: Tribute) {
    const worst = worstSepsis(t);
    if (!worst) return;
    t.vitals.fatigue += INFECTION.fatiguePerCycle * worst.grade;
    t.vitals.sanity -= INFECTION.sanityPerCycle * worst.grade;
    clampTribute(t);
    if (worst.grade >= INFECTION.maxGrade) {
        // At the top grade it does take health directly, and this is the
        // ending the whole arc exists to reach: a wound nobody treated.
        applyDamage(ctx, t, INFECTION.septicDamage, {
            cause: `Died of sepsis from an untreated ${siteWord(worst.site)}`,
            kind: 'status',
        });
    }
    if (t.status === 'alive' && ctx.rng.chance(INFECTION.feverLineChance)) {
        ctx.logEvent(
            `${t.name} is running a fever they cannot sweat out. They keep checking the ${siteWord(worst.site)} `
            + 'and keep finding it exactly as bad as the last time they looked.',
            [t.id],
            { category: 'survival' }
        );
    }
}

/**
 * Treating sepsis, which is not the same action as dressing a cut.
 *
 * A field dressing — the free, supply-less action in `wounds.ts` — does
 * nothing here on purpose. Infection needs something out of a medical kit, and
 * it comes down one grade per successful treatment rather than clearing, so a
 * bad wound is several days of somebody's attention. `medic` is the ally doing
 * it when it is not the patient themselves; an ally is better at this, for the
 * same reason they are better at a dressing.
 */
export function treatInfection(ctx: SimContext, t: Tribute, medic?: Tribute): boolean {
    const worst = worstSepsis(t);
    if (!worst) return false;
    const carrier = medic ?? t;
    const supply = consumeOne(carrier, i => i.type === 'medical');
    if (!supply) return false;

    const healer = medic ?? t;
    const chance = Math.min(INFECTION.treatMaxChance,
        INFECTION.treatBaseChance
        + profOf(healer, 'medicine') * INFECTION.treatPerMedicine
        + healer.attributes.intelligence * INFECTION.treatPerIntelligence
        + (medic ? INFECTION.treatAllyBonus : 0));
    trainProficiency(healer, 'medicine');

    if (!ctx.rng.chance(chance)) {
        ctx.logEvent(
            medic
                ? `${medic.name} does what they can for ${t.name}'s ${siteWord(worst.site)} and can see it is not enough. The ${supply.name} is gone either way.`
                : `${t.name} works at the ${siteWord(worst.site)} with the last of their ${supply.name}. By morning it looks exactly the same.`,
            medic ? [medic.id, t.id] : [t.id],
            { category: 'survival' }
        );
        return false;
    }

    const next = worst.grade - 1;
    if (next <= 0) {
        delete t.woundInfection![worst.site];
        healInjury(t, 'infected');
    } else {
        t.woundInfection![worst.site] = next;
    }
    syncInfectedFlag(t);
    ctx.logEvent(
        medic
            ? `${medic.name} opens ${t.name}'s ${siteWord(worst.site)} up, cleans it out properly, and packs it again. `
                + 'It is a genuinely unpleasant thing to watch somebody do for someone else, and it works.'
            : `${t.name} cleans the ${siteWord(worst.site)} out with the ${supply.name}, all the way down, without anybody to hold them still for it. `
                + 'The heat is out of it by morning.',
        medic ? [medic.id, t.id] : [t.id],
        { important: true, category: 'survival' }
    );
    return true;
}

/**
 * Keep the whole-body flag honest against the per-site record.
 *
 * `injuries.infected` is what the rest of the engine reads, and it can also be
 * set from outside this module (mutts, contaminated zones). So the rule is
 * one-way: any septic site forces the flag on, and clearing the flag through
 * the ordinary `healInjury` path clears the sites with it.
 */
export function syncInfectedFlag(t: Tribute) {
    const any = worstSepsis(t) !== undefined;
    if (any) {
        if (!t.injuries.infected) injure(t, 'infected');
        return;
    }
    if (!t.injuries.infected && t.woundInfection) {
        Object.keys(t.woundInfection).forEach(k => delete t.woundInfection![k as InjurySite]);
    }
}

/** Cleared when a wound is dressed or a site heals — the record follows the wound. */
export function noteWoundTended(t: Tribute, site: InjurySite) {
    if (t.woundAge) t.woundAge[site] = 0;
}

/** Exposed for the soak's reporting. */
export function isSeptic(t: Tribute): boolean {
    return worstSepsis(t) !== undefined;
}
