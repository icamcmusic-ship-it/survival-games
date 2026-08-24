import { HallOfFameEntry, Tribute } from '../models/types';
import { RNG } from '../utils/rng';
import { traitFits } from '../data/constants';
import { VETERANS } from '../data/balance';

/**
 * §10.5: past victors, reaped again.
 *
 * The Hall of Fame stores every archived victory with the winner's name,
 * district, kills, traits and end health — everything needed to put that
 * person back on a plate — and the only thing that could be done with it was
 * to re-run their Games on the original seed. A Grudge Match is the other
 * obvious use of the same records: hand-pick two victors from different years
 * and watch them meet.
 *
 * A veteran is grafted onto a tribute the generator already produced rather
 * than constructed from scratch, so everything the reaping decides — build,
 * age, vitals, quirks, zone, plate position — is still decided by the seed and
 * a Grudge Match run still replays exactly. What the archive supplies is
 * identity: the name, the district, the traits they won with, and a hardness
 * that a first-timer does not have.
 */

/** Which tribute in the field a given veteran should replace. */
function slotFor(field: Tribute[], entry: HallOfFameEntry, taken: Set<string>): Tribute | undefined {
    const free = field.filter(t => !taken.has(t.id));
    if (free.length === 0) return undefined;
    // Their own district first — a victor from 11 coming back as a tribute
    // from 11 is the version of this that reads as canon.
    return free.find(t => t.district === entry.winnerDistrict) ?? free[0];
}

/**
 * Grafts up to two archived victors onto the reaped field. Returns the names
 * actually seated, for the reaping copy.
 */
export function seatVeterans(seed: string, field: Tribute[], entries: HallOfFameEntry[]): string[] {
    const rng = new RNG(`${seed}-grudge`);
    const taken = new Set<string>();
    const seated: string[] = [];

    entries.filter(e => !e.noVictor).slice(0, VETERANS.maxPerRun).forEach(entry => {
        const slot = slotFor(field, entry, taken);
        if (!slot) return;
        taken.add(slot.id);

        slot.name = entry.winnerName;
        slot.district = entry.winnerDistrict;
        slot.veteranOf = entry.arenaName;
        // The traits they won with, where they do not contradict what the
        // reaping already gave this body. A victor's kit is not a free
        // upgrade — it replaces, it does not stack.
        const carried = (entry.winnerTraits ?? []).filter(t => traitFits(slot.traits, t));
        if (carried.length > 0) {
            slot.traits = [...slot.traits, ...carried].slice(0, VETERANS.maxTraits);
        }
        // Somebody who has already done this once knows what is coming. A flat
        // edge on the two things a second Games is actually about: the crowd
        // already knows them, and they do not frighten easily.
        slot.reputation = Math.min(100, slot.reputation + VETERANS.reputationBonus);
        slot.sponsorTrust = Math.min(100, slot.sponsorTrust + VETERANS.reputationBonus);
        slot.trainingScore = Math.max(slot.trainingScore, VETERANS.minTrainingScore);
        slot.resolve = Math.min(100, (slot.resolve ?? 50) + VETERANS.resolveBonus);
        // And the mark of it, which is the point of the whole feature.
        slot.epithet = rng.chance(VETERANS.keepsEpithetChance)
            ? `Victor of the ${entry.arenaName} Games`
            : slot.epithet;
        seated.push(entry.winnerName);
    });

    return seated;
}
