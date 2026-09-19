import { Tribute } from '../models/types';
import { CONFUSION } from '../data/balance';
import { SimContext } from './context';
import { injuryGrade } from './wounds';
import { traitMod } from '../data/traits';

/**
 * §(requests): how badly this tribute is thinking right now, 0-1.
 *
 * "Most of the time, they act very optimally" was a fair reading of the
 * decision traces: the destination scorer picked its own top-ranked zone about
 * two-thirds of the time and almost never picked from the bottom, *regardless
 * of the state of the person doing the picking*. Every input to that decision
 * degrades under pressure in this simulation already — memory distorts at low
 * sanity, sightings expire, beliefs go stale — but the act of choosing did
 * not. A tribute on their fourth night without sleep, concussed, bleeding and
 * in the dark, weighed eleven zones exactly as carefully as one who had just
 * woken up rested.
 *
 * `confusionOf` is that missing term. It is not a penalty: it does not make a
 * tribute's choices *worse* on average, it makes them *noisier* — the ranking
 * stays honest and the selection off it gets flatter, which is what being
 * unable to think straight actually looks like from outside. A rested,
 * unhurt, sane tribute in daylight sits at zero and behaves exactly as before.
 *
 * Deliberately composed of things a reader can see on the tribute sheet, so
 * an odd decision has a visible explanation rather than being attributable to
 * "the AI".
 */
export function confusionOf(ctx: SimContext, t: Tribute): number {
    let confusion = 0;

    // Exhaustion is the big one, and the one the source material leans on.
    if (t.vitals.fatigue > CONFUSION.fatigueFloor) {
        confusion += ((t.vitals.fatigue - CONFUSION.fatigueFloor) / (100 - CONFUSION.fatigueFloor))
            * CONFUSION.fatigueWeight;
    }
    // A mind coming apart does not weigh options carefully.
    if (t.vitals.sanity < CONFUSION.sanityCeiling) {
        confusion += ((CONFUSION.sanityCeiling - t.vitals.sanity) / CONFUSION.sanityCeiling)
            * CONFUSION.sanityWeight;
    }
    // Thirst before hunger: dehydration takes judgement long before it takes
    // the body, which is exactly the chain the hazard tables already model.
    if (t.vitals.thirst > CONFUSION.thirstFloor) {
        confusion += ((t.vitals.thirst - CONFUSION.thirstFloor) / (100 - CONFUSION.thirstFloor))
            * CONFUSION.thirstWeight;
    }
    // A head wound, and blood loss.
    confusion += injuryGrade(t, 'head') * CONFUSION.headInjuryPerGrade;
    if (t.injuries.bleeding) confusion += CONFUSION.bleeding;
    // The dark, which is half of what makes night dangerous.
    if (ctx.state.timeOfDay !== 'day') confusion += CONFUSION.afterDark;

    // Temperament. `awareness` is the existing trait hook for noticing what
    // is in front of you, which is the same faculty; nothing routes through a
    // separate "confusion resistance" stat nobody can see on the sheet.
    confusion *= Math.max(0, 1 - traitMod(t, 'awareness'));

    return Math.max(0, Math.min(CONFUSION.max, confusion));
}
