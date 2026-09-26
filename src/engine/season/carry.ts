import { GameState, Proficiency, Tribute } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { legacyOf } from '../../data/districts';
import { SimContext, getAlive } from '../context';
import { adjustRel, getRel } from '../relationships';
import { profOf, trainProficiency } from '../proficiency';
import { campaignOf } from '../campaign';
import { seasonOf } from './runState';

/**
 * AUDIT-12 wave 3 §11/§12: what a campaign carries into the next reaping, and
 * what a mentor does once the tribute is in the arena.
 *
 * Everything here reads `state.campaign.ledger`, the snapshot taken when the
 * run was created. A run with no campaign reads nothing and changes nothing.
 * None of it draws from any random stream.
 */
const R = AUDIT12_WAVE3.reunions;
const RV = AUDIT12_WAVE3.rivalries;
const M = AUDIT12_WAVE3.mentors;

/** Skills a mentor can tip and an apprenticeship can carry. */
export const CARRYABLE_SKILLS: readonly Proficiency[] = [
    'forage', 'melee', 'ranged', 'medicine', 'tracking', 'climbing', 'swimming', 'crafting', 'carpentry', 'stealth', 'navigation', 'persuasion',
] as Proficiency[];

export function isCarryableSkill(s: string): s is Proficiency {
    return (CARRYABLE_SKILLS as readonly string[]).includes(s);
}

/** Called once at the reaping, after the campaign arc. Returns the lines to log. */
export function applyLedgerAtReaping(ctx: SimContext, cast: Tribute[]): void {
    const ledger = campaignOf(ctx.state.campaign).ledger;
    if (!ledger) return;
    const log = (text: string, ids: string[]) => ctx.logEvent(text, ids, { important: true, category: 'system' });
    const of = (d: number) => cast.filter(t => t.district === d);

    // The apprenticeship the player chose: the district's next tribute walks in knowing it.
    Object.entries(ledger.apprenticeships ?? {}).forEach(([d, choice]) => {
        if (!isCarryableSkill(choice.skill)) return;
        const pupil = of(Number(d)).sort((a, b) => profOf(a, choice.skill as Proficiency) - profOf(b, choice.skill as Proficiency) || a.id.localeCompare(b.id))[0];
        if (!pupil) return;
        trainProficiency(pupil, choice.skill as Proficiency, undefined, AUDIT12_WAVE3.apprenticeship.carriedShare);
        log(`${pupil.name} of District ${d} spent the year being taught ${choice.skill} by ${choice.fromName}, and it shows in how they stand.`, [pupil.id]);
    });

    // Reunions: districts whose tributes found each other again last time.
    // One line for all of them: the bonds are many, the headline is one.
    const bonded: string[] = [];
    const bondIds = new Set<string>();
    (ledger.reunions ?? []).slice(0, R.maxBonds).forEach(bond => {
        const a = of(bond.a);
        const b = of(bond.b);
        if (a.length === 0 || b.length === 0 || bond.a === bond.b) return;
        a.forEach(x => b.forEach(y => { adjustRel(x, y.id, R.bondRegard); adjustRel(y, x.id, R.bondRegard); }));
        bonded.push(`${bond.a} and ${bond.b}`);
        [...a, ...b].forEach(t => bondIds.add(t.id));
    });
    if (bonded.length > 0) {
        log(`Reunions in the last Games are remembered: the tributes of Districts ${bonded.join('; ')} are told to look for each other.`, [...bondIds]);
    }

    Object.entries(ledger.veteranRespect ?? {}).forEach(([d, n]) => {
        of(Number(d)).forEach(t => { t.resolve = Math.min(100, (t.resolve ?? 50) + R.veteranResolve * Math.min(3, n)); });
    });

    // Cross-Games rivalries: districts that have been killing each other.
    const feuding: string[] = [];
    const feudIds = new Set<string>();
    (ledger.rivalries ?? []).filter(r => r.heat >= RV.seedAt).slice(0, RV.maxRivalries).forEach(r => {
        const a = of(r.aDistrict);
        const b = of(r.bDistrict);
        if (a.length === 0 || b.length === 0) return;
        a.forEach(x => b.forEach(y => {
            adjustRel(x, y.id, Math.min(0, RV.regard - getRel(x, y.id)));
            adjustRel(y, x.id, Math.min(0, RV.regard - getRel(y, x.id)));
        }));
        feuding.push(`${r.aDistrict} and ${r.bDistrict}`);
        [...a, ...b].forEach(t => feudIds.add(t.id));
    });
    if (feuding.length > 0) {
        log(`Districts ${feuding.join('; ')} have buried each other's children in Games after Games. Their tributes did not need telling.`, [...feudIds]);
    }

    // Nemesis veterans: a victor reaped again who killed their way through
    // these districts is hated by every tribute from them.
    (ledger.nemeses ?? []).forEach(n => {
        const vet = cast.find(t => t.name === n.name && t.veteranOf);
        if (!vet) return;
        const haters = cast.filter(t => n.victimDistricts.includes(t.district) && t.id !== vet.id);
        haters.forEach(h => adjustRel(h, vet.id, RV.regard));
        vet.reputation = Math.min(100, vet.reputation + RV.nemesisReputation);
        log(`${vet.name} is back. ${n.kills} tributes did not come home from ${n.arenaName} because of them, and District${n.victimDistricts.length === 1 ? '' : 's'} ${n.victimDistricts.join(', ')} ${n.victimDistricts.length === 1 ? 'has' : 'have'} not forgotten a single one.`, [vet.id, ...haters.map(h => h.id)]);
    });
}

/* -------------------------------------------------------------------------- */
/* Mentors in the arena                                                        */
/* -------------------------------------------------------------------------- */

const VOICE: Record<string, (mentor: string, skill: string) => string> = {
    storied: (m, s) => `${m}'s note is two lines long and not unkind: "You were trained for this. Use the ${s}. Do not show off."`,
    strong: (m, s) => `${m} sends one word — "${s}" — and a map with a ring drawn round the water.`,
    modest: (m, s) => `${m}'s note apologises for the handwriting, then explains ${s} better than any trainer did.`,
    thin: (m, s) => `${m} writes like somebody who has been exactly where you are: "Nobody expects anything. Good. ${s[0].toUpperCase()}${s.slice(1)} first, then hide."`,
    forgotten: (m, s) => `${m} has never had a tribute to write to before. The note is long, and all of it is about ${s}.`,
};

function dominantTerrain(zones: Array<{ terrain: string }>): string | undefined {
    const counts = new Map<string, number>();
    zones.forEach(z => counts.set(z.terrain, (counts.get(z.terrain) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

/**
 * The victor-mentor's opening note, once per tribute on the first arena day:
 * a skill tip that trains the skill, in the mentor's own voice, and — when
 * this arena is the kind the mentor won in — a warning that makes the arena's
 * hazards easier to be elsewhere for, for the first few days.
 */
export function tickMentorNotes(ctx: SimContext): void {
    if (ctx.state.day < 1) return;
    const ledger = campaignOf(ctx.state.campaign).ledger;
    const arenas = ledger?.mentorArenas;
    const s = seasonOf(ctx.state);
    const sent = s.mentorNotes ?? (s.mentorNotes = []);
    getAlive(ctx.state).forEach(t => {
        if (!t.mentorIsVictor || sent.includes(t.id)) return;
        sent.push(t.id);
        const record = arenas?.[t.district];
        const skill = record?.bestSkill && isCarryableSkill(record.bestSkill) ? record.bestSkill : 'forage';
        trainProficiency(t, skill as Proficiency, undefined, M.tipShare);
        const mentor = (t.mentorLegacy ?? 'Their mentor').split(',')[0];
        const tier = legacyOf(t.district).tier;
        let text = (VOICE[tier] ?? VOICE.modest)(mentor, skill);
        const here = dominantTerrain(ctx.state.arena.zones);
        if (record && (record.arenaId === ctx.state.arena.id || (record.terrain && record.terrain === here))) {
            text += ` Then, underlined: "I won in a place like this. Watch the ${here ?? 'ground'}."`;
        }
        ctx.logEvent(text, [t.id], { category: 'sponsor', fact: `${mentor} sent ${t.name} a note about ${skill}.` });
    });
}

/** Dodge bonus against the arena's own hazards, for a tribute their victor-mentor warned. */
export function mentorWarningBonus(state: GameState, t: Tribute): number {
    if (!t.mentorIsVictor || state.day > M.warningDays) return 0;
    const record = campaignOf(state.campaign).ledger?.mentorArenas?.[t.district];
    if (!record) return 0;
    const here = dominantTerrain(state.arena.zones);
    return record.arenaId === state.arena.id || (record.terrain !== undefined && record.terrain === here) ? M.warningDodge : 0;
}
