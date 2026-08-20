/**
 * What each trait actually does, in the engine's own terms.
 *
 * Traits were generated, displayed as bare chips, and read by a dozen scattered
 * checks across `survival.ts`, `combat.ts`, `stealth.ts` and the phase files —
 * with nothing anywhere telling a reader that "Pyromaniac" means a 20% chance to
 * leave a defender burned, or that "Star-Crossed" means two tributes from the
 * same district will refuse to fight each other at all.
 *
 * Every line here is written from the code that consumes the trait, so this file
 * has to be updated when the effect changes. It is documentation of behaviour,
 * not marketing copy.
 */
export const TRAIT_INFO: Record<string, string> = {
    'Hydrophilic': 'At home in water. Loses less to thirst every cycle than anyone else in the same terrain.',
    'Insomniac': 'Cannot sleep in the arena. Recovers far less fatigue at night, so the days compound.',
    'Paranoid': 'Never fully relaxes. Notices people trying not to be noticed, which makes them hard to ambush.',
    'Charismatic': 'Reads well on camera and in a clearing. Forms alliances more easily and draws sponsors.',
    'Clumsy': 'Heavy-footed. Markedly worse at opening a fight from cover.',
    'Eagle-Eyed': 'Sees the treeline. The strongest awareness bonus in the game — very hard to sneak up on.',
    'Iron Stomach': 'Eats what others will not. Loses less to hunger every cycle.',
    'Light Sleeper': 'Wakes at a snapped twig. A smaller awareness bonus that works around the clock.',
    'Bloodthirsty': 'Wants the fight. Pushes hard toward the Aggressive stance and is much less willing to break off.',
    'Pacifist': 'Will not do this. Resists the Aggressive stance, retreats far sooner — and a kill costs them a catastrophic amount of sanity.',
    'Pyromaniac': 'Fights with whatever burns. Every landed hit has a real chance to leave the defender scorched.',
    'Nimble': 'Quick and quiet. Better at opening a fight from cover.',
    'Brute': 'Built for it. A straight bonus to the betting line and to how the field reads them.',
    'Strategist': 'Picks their moment. Improves their odds and biases them toward fighting only on favourable ground.',
    'Tracker': 'Reads sign. Better at foraging, better at noticing people, and better at building traps.',
    'Star-Crossed': 'Bonded to their district partner. The two of them will refuse to fight each other under any circumstances, and the Capitol adores it — a steady drip of sponsor trust and excitement all run.',
};

/** Fallback for a trait added to the pool but not yet documented here. */
export function traitInfo(trait: string): string {
    return TRAIT_INFO[trait] ?? 'No recorded effect.';
}
