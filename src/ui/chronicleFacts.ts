import { EventLog, Tribute } from '../models/types';

/**
 * §(requests): the chronicle as a record rather than as a broadcast.
 *
 * "Add a stripped down mode that only shows raw facts without prose" and
 * "lots of chronicle entries are too prose heavy. I only want to see facts".
 *
 * The events themselves are unchanged — this is a renderer, not an engine
 * mode, so the same seed produces the same Games in either register and a
 * player can switch mid-run without the run becoming a different one.
 *
 * Two rules:
 *
 *  1. An entry that carries an explicit `fact` uses it. Those are the events
 *     where the prose is deliberately withholding something the record wants
 *     stated outright — the weapon, the quantity, the name.
 *  2. Everything else is *derived* from the entry's own fields: category,
 *     cast, zone. Derivation rather than authoring is the point; a chronicle
 *     that depended on somebody having written a second sentence for every
 *     one of several thousand log sites would be wrong within a week, and
 *     several of this project's own measurements already break when the
 *     English changes.
 */

/** Atmosphere: true for entries the record has no reason to carry at all. */
export function isAtmosphere(entry: EventLog): boolean {
    if (entry.important) return false;
    // Scene-setting with nobody in it is scenery by definition.
    if (entry.tributesInvolved.length === 0 && (entry.category === 'arena' || entry.category === 'system')) return true;
    return false;
}

/**
 * §(requests): "remove internal sanity reasoning, but still track it. Only
 * show very important sanity changes."
 *
 * `important` is already exactly this distinction in the engine: the marked
 * sanity lines are the breakdowns, the hallucinations, the oaths and the
 * moments a mind goes, and the unmarked ones are the running commentary. The
 * state is untouched either way — sanity still drains, bands, and drives the
 * endgame; it simply stops narrating itself every time it moves.
 */
export function isInternalSanity(entry: EventLog): boolean {
    return entry.category === 'sanity' && !entry.important;
}

const CATEGORY_LABEL: Record<EventLog['category'], string> = {
    death: 'DEATH', kill: 'KILL', combat: 'COMBAT', injury: 'INJURY',
    hazard: 'HAZARD', mutt: 'MUTT', alliance: 'ALLIANCE', betrayal: 'BETRAYAL',
    romance: 'BOND', sponsor: 'SPONSOR', loot: 'ITEM', survival: 'UPKEEP',
    travel: 'MOVE', sanity: 'MIND', arena: 'ARENA', gamemaker: 'GAMEMAKER',
    training: 'TRAINING', interview: 'INTERVIEW', feast: 'FEAST', system: 'NOTE',
};

/**
 * The record's line for one event: `KILL  Marvel (D1) > Rue (D11)  Pine Ridge`.
 *
 * `names` is the cast lookup — a record needs "Rue (D11)", not an id, and the
 * feed already has the roster to hand.
 */
export function factLineOf(entry: EventLog, byId: Map<string, Tribute>): string {
    const label = CATEGORY_LABEL[entry.category] ?? 'NOTE';
    const cast = entry.tributesInvolved
        .map(id => byId.get(id))
        .filter((t): t is Tribute => t !== undefined)
        .map(t => `${t.name} (D${t.district})`);
    const who = cast.join(' · ');
    const where = entry.zone ? ` · ${entry.zone}` : '';
    // An explicit fact replaces the derived middle, not the frame: the label,
    // the cast and the place are the record's columns and stay put.
    const body = entry.fact ?? who;
    if (!body && !where) return label;
    return `${label}${body ? ` · ${body}` : ''}${where}`;
}
