import { Tribute } from '../models/types';

/**
 * Traits, as data with hooks rather than chips with prose.
 *
 * The old table was fifteen strings and a documentation file, consumed by a
 * dozen scattered `traits.includes('...')` checks. A grep found the real cost:
 * Pyromaniac had one reference, Charismatic one (pre-game only), and four more
 * had exactly one each. Two thirds of a tribute's character sheet did nothing
 * once the gong sounded.
 *
 * The fix is not "add more if-statements". It is to make a trait a row of
 * modifiers against a fixed set of named hooks, so a new trait costs a line of
 * data and every hook is consumed in exactly one place. `traitMod(t, key)` sums
 * the row across whatever the tribute happens to be carrying.
 *
 * Every key below is read somewhere. If you add a key, add the read site in the
 * same change — an unread modifier is the bug this file exists to fix.
 */
export type TraitMod =
    // survival.ts — per-cycle drains and recovery
    | 'hungerDrain'          // flat, added to VITALS.hungerDrain
    | 'thirstDrain'          // flat
    | 'fatigueDay'           // flat
    | 'fatigueNight'         // flat
    | 'sanityDrain'          // multiplier offset: -0.3 = loses 30% less sanity
    | 'sanityRecovery'       // flat, added to a rest cycle's sanity gain
    | 'bleedResist'          // fraction of bleed damage ignored
    // exposure.ts — weather, venom, fire, cold
    | 'poisonResist'         // fraction of poison-contraction chance removed
    | 'burnResist'
    | 'coldResist'
    | 'heatResist'
    // stealth.ts
    | 'awareness'            // flat, on the awareness scale (intelligence * 0.6-ish)
    | 'awarenessNight'       // flat, added to awareness only after dark
    | 'targetDraw'           // flat, on the hunt-scoring scale: how much the field wants you
    | 'concealment'          // flat, 0-1 scale
    | 'ambush'               // flat, 0-1 scale
    // combat.ts
    | 'combatPower'          // flat, on the ~20-point power scale
    | 'meleePower'
    | 'rangedPower'
    | 'unarmedPower'
    | 'retreat'              // flat, 0-1 chance of breaking off
    | 'killSanity'           // multiplier offset on the sanity cost of a kill
    | 'fearGain'             // multiplier offset on fear picked up
    // stance.ts
    | 'aggressionScore'      // flat, on the stance scoring scale
    // resolve.ts — the will to keep going, per cycle
    | 'resolveDrift'         // flat, added to the per-cycle resolve drift
    // fieldcraft.ts / survival foraging
    | 'forage'               // flat, 0-1 chance
    | 'medicine'             // flat, 0-1 chance a field dressing takes
    | 'trapSkill'            // flat, 0-1
    | 'campSkill'            // flat, 0-1 — fires, shelters, camouflage
    // movement.ts
    | 'highland'             // flat, on the destination scoring scale
    | 'water'
    | 'nightMovement'
    // social
    | 'allianceAffinity'     // flat, on the 0-1 alliance willingness scale
    | 'betrayalResist'       // fraction removed from being betrayed / betraying
    | 'treachery'            // flat, added to betrayal willingness
    | 'griefResist'          // fraction of the sanity hit from a death removed
    // audience
    | 'sponsorTrust'         // flat, per-cycle drift
    | 'excitement'           // multiplier offset on excitement earned
    // odds.ts — the betting line and how the field reads them
    | 'odds'
    // items.ts
    | 'capacity'             // flat, extra inventory slots
    | 'scavenge';            // flat, 0-1 chance of finding something

export interface TraitDef {
    /** What it does, in the engine's own terms. Shown on the tribute sheet. */
    info: string;
    /** Not rollable at the reaping — earned in the arena. See `earnTrait`. */
    earned?: boolean;
    mods?: Partial<Record<TraitMod, number>>;
}

/**
 * The pool.
 *
 * Ordered roughly by what they touch, because that is how they are maintained.
 * A trait with no `mods` has bespoke logic somewhere and says so in its `info`.
 */
export const TRAIT_DEFS: Record<string, TraitDef> = {
    // ---- deprivation and the body -------------------------------------
    'Hydrophilic': {
        info: 'At home in water. Loses less to thirst every cycle, and prefers wet ground when choosing where to go.',
        mods: { thirstDrain: -5, water: 1.2 },
    },
    'Iron Stomach': {
        info: 'Eats what others will not. Loses less to hunger every cycle and shrugs off bad food.',
        mods: { hungerDrain: -5, poisonResist: 0.2 },
    },
    'Insomniac': {
        info: 'Cannot sleep in the arena. Recovers far less fatigue at night — but they are awake, and awake is worth something after dark.',
        // §8c: the worst-designed trait in the file at 3.15% — a flat penalty
        // with no compensating upside, and the only trait it was unambiguously
        // bad to draw. Power budget: a real fatigue cost, paid back as the
        // best night-watch in the game. They are lying there listening anyway.
        mods: { fatigueNight: 10, awarenessNight: 2 },
    },
    'Light Sleeper': {
        info: 'Wakes at a snapped twig. A steady awareness bonus that works around the clock.',
        mods: { awareness: 1.2 },
    },
    'Hardy': {
        info: 'Clots fast and keeps going. Takes markedly less damage from an open wound.',
        mods: { bleedResist: 0.35, fatigueDay: -2 },
    },
    'Venom-Blooded': {
        info: 'Something in them fights the venom. Far less likely to be poisoned by anything the arena serves.',
        mods: { poisonResist: 0.5 },
    },
    'Frost-Born': {
        info: 'Raised somewhere cold. Frostbite and freezing weather are much less likely to take hold, and a long night costs them less than it costs anyone else.',
        // §8c: second-highest average days of any reaping trait and second-
        // worst win rate — the signature of a pure environmental niche that
        // stops mattering the moment the endgame arrives. Power budget: keep
        // the resist as the headline, and add a small rider that still fires
        // in the last five days whatever arena this turned out to be.
        mods: { coldResist: 0.5, fatigueNight: -2, resolveDrift: 0.25 },
    },
    'Sun-Hardened': {
        info: 'Worked outdoors through worse summers than this. Heat and burns land softer.',
        mods: { heatResist: 0.45, burnResist: 0.3 },
    },
    'Fire-Shy': {
        info: 'Something in their history involved a fire. Burns badly, and will not sit near one willingly.',
        mods: { burnResist: -0.4, campSkill: -0.15 },
    },

    // ---- the mind -----------------------------------------------------
    'Stoic': {
        info: 'Does not come apart. Loses far less sanity to deprivation, darkness and the sky at night.',
        mods: { sanityDrain: -0.35, sanityRecovery: 4, resolveDrift: 1 },
    },
    'Fragile': {
        info: 'The arena is louder inside their head than anyone else\'s. Loses sanity faster and recovers it slower.',
        mods: { sanityDrain: 0.4, sanityRecovery: -3, resolveDrift: -1 },
    },
    'Cool-Headed': {
        info: 'Registers a threat without becoming afraid of it. Barely accumulates fear of specific tributes.',
        mods: { fearGain: -0.5, retreat: -0.05 },
    },
    'Skittish': {
        info: 'Frightens easily and stays frightened. Picks up fear fast and breaks off sooner.',
        mods: { fearGain: 0.5, retreat: 0.1 },
    },
    'Paranoid': {
        info: 'Never fully relaxes. Notices people trying not to be noticed, and trusts nobody enough to be sold out easily.',
        mods: { awareness: 1.5, betrayalResist: 0.3, allianceAffinity: -0.15 },
    },
    'Grim': {
        info: 'Has buried people before. A death in front of them costs much less than it costs anyone else.',
        mods: { griefResist: 0.5, sanityDrain: -0.1, resolveDrift: 0.75 },
    },

    // ---- moving through the arena -------------------------------------
    'Nimble': {
        info: 'Quick and quiet. Better at opening a fight from cover and at getting out of one.',
        mods: { ambush: 0.06, concealment: 0.05, retreat: -0.02 },
    },
    'Clumsy': {
        info: 'Heavy-footed. Markedly worse at opening a fight from cover, and easier to hear coming.',
        mods: { ambush: -0.12, concealment: -0.08 },
    },
    'Climber': {
        info: 'Goes up when cornered. Favours high ground, and is much harder to corner on it.',
        mods: { highland: 2, concealment: 0.05, retreat: -0.04 },
    },
    'Swimmer': {
        info: 'Crosses water others walk around. Favours water and wetland and stays hidden in both.',
        mods: { water: 2, concealment: 0.04 },
    },
    'Fleet': {
        info: 'Simply faster than the rest of the field. Gets clear of a losing fight and travels at night.',
        mods: { retreat: -0.06, nightMovement: 1.5 },
    },
    'Night-Sighted': {
        info: 'Sees in the dark. The night is not the handicap for them that it is for everyone else.',
        mods: { nightMovement: 2.5, awareness: 0.8 },
    },
    'Chameleon': {
        info: 'Disappears into whatever they are standing in. The strongest concealment bonus in the game.',
        mods: { concealment: 0.12, campSkill: 0.12 },
    },

    // ---- eyes ----------------------------------------------------------
    'Eagle-Eyed': {
        info: 'Sees the treeline. The strongest awareness bonus in the game — very hard to sneak up on.',
        mods: { awareness: 2.5, rangedPower: 1.5 },
    },
    'Tracker': {
        info: 'Reads sign. Better at foraging, better at noticing people, and better at building traps.',
        mods: { awareness: 1.8, forage: 0.08, trapSkill: 0.12 },
    },

    // ---- the fight -----------------------------------------------------
    'Bloodthirsty': {
        info: 'Wants the fight. Pushes hard toward the Aggressive stance and is much less willing to break off.',
        mods: { aggressionScore: 1.5, retreat: -0.25, killSanity: -0.5 },
    },
    'Pacifist': {
        info: 'Will not do this. Resists the Aggressive stance, retreats far sooner — and a kill costs them a catastrophic amount of sanity.',
        mods: { aggressionScore: -1.5, retreat: 0.25, killSanity: 1.5, allianceAffinity: 0.15 },
    },
    'Brute': {
        info: 'Built for it. Hits harder with anything heavy and with nothing at all, and the field reads them as dangerous.',
        mods: { meleePower: 2, unarmedPower: 2.5, odds: 1.5, ambush: -0.04 },
    },
    'Marksman': {
        info: 'Trained on the range. Genuinely dangerous with a bow, a slingshot or a blowgun.',
        mods: { rangedPower: 3, odds: 1 },
    },
    'Wrestler': {
        info: 'Grew up settling things with their hands. Much more dangerous unarmed than anyone expects.',
        mods: { unarmedPower: 4, retreat: -0.05 },
    },
    'Butcher': {
        // §8: `meleePower: 2.5` made this the single strongest thing on the
        // reaping table by a wide margin — an 11.4% win rate against a field
        // mean near 5%, and the top end of the trait spread the balance
        // indicators guard. It is still the best blade trait; it is no longer
        // worth more than every other reaping trait combined.
        info: 'Handy with a blade for reasons that predate the arena. A real edge with melee weapons.',
        mods: { meleePower: 1.7, killSanity: -0.3 },
    },
    'Strategist': {
        info: 'Picks their moment. Improves their odds, fights only on favourable ground, and sets better traps.',
        mods: { odds: 1.5, retreat: 0.06, trapSkill: 0.1, aggressionScore: -0.3 },
    },
    'Pyromaniac': {
        info: 'Fights with whatever burns. Every landed hit has a real chance to leave the defender scorched, and they are never short of a fire.',
        mods: { campSkill: 0.2, burnResist: 0.25 },
    },
    'Vengeful': {
        info: 'Does not let go. Fights markedly harder against anyone who has already hurt them, and will not break off from a rival.',
        mods: { retreat: -0.08 },
    },
    'Ruthless': {
        // §8: the worst reaping trait in the game at 2.2%, and structurally so
        // — it carried no upside at all beyond a sanity saving, while its
        // `treachery` actively drew retaliation. What the flavour promises is
        // someone who does not hesitate, so it now buys the thing hesitation
        // costs: a finishing edge, and a will that does not waver.
        info: 'Feels nothing afterwards. A kill costs them almost no sanity, they finish what they start, and they will not hesitate over an unfair one.',
        mods: { killSanity: -0.8, treachery: 0.15, combatPower: 0.9, resolveDrift: 0.15 },
    },

    // ---- other people --------------------------------------------------
    'Charismatic': {
        info: 'Reads well on camera and in a clearing. Forms alliances more easily and holds sponsor trust all run.',
        mods: { allianceAffinity: 0.2, sponsorTrust: 1.5, excitement: 0.2 },
    },
    'Loyal': {
        info: 'Will not sell anyone out, and is hard to convince that anyone has sold them out.',
        mods: { allianceAffinity: 0.25, treachery: -0.3, betrayalResist: 0.2 },
    },
    'Treacherous': {
        info: 'Always weighing it. Far more likely to be the one who moves first on an alliance.',
        mods: { treachery: 0.35, allianceAffinity: -0.1 },
    },
    'Softhearted': {
        info: 'Cannot finish it. Allies more readily, grieves harder, and a kill sits badly.',
        mods: { allianceAffinity: 0.2, griefResist: -0.4, killSanity: 0.6, resolveDrift: -0.75 },
    },
    'Showman': {
        info: 'Plays to the cameras constantly. Everything they do earns more excitement than it should.',
        mods: { excitement: 0.5, sponsorTrust: 1 },
    },
    'Silver-Tongued': {
        info: 'Talks the Capitol into things. A steady drift upward in sponsor trust all run.',
        mods: { sponsorTrust: 2.5, allianceAffinity: 0.1 },
    },
    'Unremarkable': {
        info: 'Nobody is watching. Draws very little excitement and almost no sponsorship — and is genuinely the last person anyone goes looking for.',
        // §8c: at 2.18% the worst trait in the game, because the promise in
        // its own info string was never mechanical: the targeting layer did
        // not weight it at all. `targetDraw` is that discount made real and
        // made large — being overlooked is the entire trait, so it has to be
        // worth as much as a weapon. The sponsor rider pays out late, when
        // the crowd finally notices somebody they have not been shown.
        mods: { excitement: -0.4, sponsorTrust: -1.5, odds: -1, targetDraw: -28, concealment: 0.08 },
    },

    // ---- the pack and the pantry ---------------------------------------
    'Herbalist': {
        info: 'Knows the plants. Forages more reliably and dresses a wound properly.',
        mods: { forage: 0.1, medicine: 0.2, poisonResist: 0.25 },
    },
    'Trapper': {
        info: 'Builds things that wait. The best trap-setter in the field, and a competent camp.',
        mods: { trapSkill: 0.2, campSkill: 0.1 },
    },
    'Scavenger': {
        info: 'Finds what other people walked past. Turns up supplies with no obvious source.',
        mods: { scavenge: 0.15, forage: 0.06 },
    },
    'Hoarder': {
        info: 'Carries more than is sensible, and it keeps paying off.',
        mods: { capacity: 2, scavenge: 0.08 },
    },

    // ---- bonded ---------------------------------------------------------
    'Star-Crossed': {
        info: 'Bonded to their district partner. The two of them will refuse to fight each other under any circumstances, and the Capitol adores it — a steady drip of sponsor trust and excitement all run.',
        earned: true,
    },

    // ---- earned in the arena --------------------------------------------
    'Bloodied': {
        info: 'Earned with their first kill. It was easier than they expected, and everything after it is easier still.',
        earned: true,
        mods: { killSanity: -0.3, retreat: -0.06, odds: 1 },
    },
    'Haunted': {
        info: 'Earned watching someone they cared about die. They are not sleeping, and they are not letting anyone close again.',
        earned: true,
        mods: { sanityDrain: 0.3, allianceAffinity: -0.25, retreat: -0.05 },
    },
    'Broken': {
        info: 'Earned the moment what they swore they would not do became what they had done. §3.2: the resolution of Pacifist and Bloodied held at once — they no longer flinch from it and no longer believe in anything either.',
        earned: true,
        mods: { killSanity: -0.2, sanityDrain: 0.4, resolveDrift: -1, allianceAffinity: -0.3, retreat: -0.1 },
    },
    'Hollow': {
        info: 'The end of the road that started at Skittish and went through Haunted. Nothing frightens them any more, because nothing reaches them any more.',
        earned: true,
        mods: { fearGain: -0.8, sanityDrain: 0.25, allianceAffinity: -0.4, retreat: -0.15, excitement: 0.2 },
    },
    'Hardened': {
        info: 'Earned surviving a mutt. Whatever the Gamemakers send next, they have already met worse.',
        earned: true,
        mods: { fearGain: -0.4, sanityDrain: -0.2, combatPower: 1, resolveDrift: 1 },
    },
    'Merciful': {
        info: 'Earned by letting someone live who did not have to. The Capitol finds it fascinating; the arena finds it expensive.',
        earned: true,
        mods: { excitement: 0.3, sponsorTrust: 2, killSanity: 0.4 },
    },
    'Starved': {
        info: 'Earned going days without food and coming out the other side. They know how to be hungry now.',
        earned: true,
        mods: { hungerDrain: -4, forage: 0.08, sanityDrain: 0.1 },
    },
    'Venom-Wise': {
        info: 'Earned surviving a poisoning. They will not make that mistake twice.',
        earned: true,
        mods: { poisonResist: 0.4, forage: 0.05 },
    },
    'Marked': {
        info: 'Earned being sold out by someone they trusted. They will not be caught like that again, and they will not trust like that again.',
        earned: true,
        mods: { betrayalResist: 0.4, awareness: 1, allianceAffinity: -0.3 },
    },
    'Feared': {
        info: 'Earned by killing enough people that the rest of the field knows the name. Everyone gives them room; nobody gives them help.',
        earned: true,
        mods: { odds: 2, combatPower: 1, excitement: 0.3, allianceAffinity: -0.2 },
    },
    // §8.9: the second wave of earned traits — arcs the arena could already
    // produce (fires survived, traps unpicked, promises kept) with no visible
    // mark left on the person afterwards.
    'Firetouched': {
        info: 'Earned walking out of a burning sector. Fire holds no novelty for them now, and they read dry ground the way other people read faces.',
        earned: true,
        mods: { burnResist: 0.35, heatResist: 0.2, campSkill: 0.1 },
    },
    'Trapwise': {
        info: 'Earned pulling apart other people\'s traps. They see the arena as a set of mechanisms now — and they build better ones themselves.',
        earned: true,
        mods: { trapSkill: 0.15, awareness: 0.8 },
    },
    'Waterborn': {
        info: 'Earned in the current. Enough hard crossings and the water stops being an obstacle and starts being a road nobody else will take.',
        earned: true,
        mods: { water: 1.5, concealment: 0.04, fatigueDay: -1 },
    },
    'Silent Step': {
        info: 'Earned by simply never being found. Days of moving unseen have made quiet a habit rather than an effort.',
        earned: true,
        mods: { concealment: 0.08, ambush: 0.04, nightMovement: 0.8 },
    },
    'Oathbound': {
        info: 'Earned keeping a truce all the way to its end. The field knows their word holds, which is worth more than a weapon to the right ally.',
        earned: true,
        mods: { allianceAffinity: 0.15, treachery: -0.2, sponsorTrust: 1 },
    },
    'Vulture': {
        info: 'Earned stripping the fallen. They are never short of supplies, and nobody wants to catch them at work.',
        earned: true,
        mods: { scavenge: 0.12, capacity: 1, sponsorTrust: -1 },
    },
};

/** Everything the reaping can roll. Earned traits are excluded by definition. */
export const ROLLABLE_TRAITS = Object.keys(TRAIT_DEFS).filter(name => !TRAIT_DEFS[name].earned);

/** Every trait name, rollable or earned. */
export const ALL_TRAITS = Object.keys(TRAIT_DEFS);

/**
 * The sum of one modifier across everything this tribute is carrying.
 *
 * Deliberately additive: two traits that both help with fire should both help
 * with fire. The read sites clamp where clamping matters.
 */
export function traitMod(t: Tribute, key: TraitMod): number {
    let total = 0;
    for (const name of t.traits) {
        const mod = TRAIT_DEFS[name]?.mods?.[key];
        if (mod) total += mod;
    }
    return total;
}

/** Documentation lookup, tolerating a trait from an older save. */
export function traitInfo(trait: string): string {
    return TRAIT_DEFS[trait]?.info ?? 'No recorded effect.';
}
