import { Proficiency, Tribute } from '../models/types';
import { PROFICIENCY } from './balance';
import { QUIRK_MODS } from './quirks';

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
    | 'defended'             // flat, how much an ally's presence turns a blow aside
    | 'wrestle'              // flat, added to grapple resistance
    | 'killSanity'           // multiplier offset on the sanity cost of a kill
    | 'fearGain'             // multiplier offset on fear picked up
    | 'muttDamage'           // multiplier offset on damage taken from mutts (mutts.ts)
    // stance.ts
    | 'aggressionScore'      // flat, on the stance scoring scale
    | 'hornCommitment'       // flat, 0-1 chance offset of going for the horn at the gong (bloodbath.ts)
    | 'executeDrive'         // flat, chance offset of finishing somebody downed (downed.ts)
    | 'burnOnHit'            // flat, 0-1 chance a landed hit leaves the defender burned (combat.ts)
    | 'vengeanceEdge'        // flat, power against a sworn or hated opponent (combat.ts)
    | 'sponsorAppeal'        // flat, on the pre-Games buzz scale (generator.ts)
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
    // §8.3 (audit): the social engine is the deepest part of the game and
    // the trait layer barely touched it — six social hooks against
    // twenty-six combat ones. Two more, each read at exactly one site.
    | 'persuasion'           // flat, added to the persuasion proficiency where a truce is held together (parley.ts)
    | 'rapport'              // flat, scales the regard two people gain from reconciling (rapport.ts)
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
        // §8: a pure-niche resist with an always-on rider, the way Frost-Born
        // got one — something that is still true on a day nothing bleeds.
        info: 'Clots fast and keeps going. Takes markedly less damage from an open wound, and simply keeps going when others are running out of it.',
        mods: { bleedResist: 0.35, fatigueDay: -2, resolveDrift: 0.3 },
    },
    'Venom-Blooded': {
        // §8: same treatment — the resist is the headline, and knowing what is
        // in a wound is the rider that fires whether or not the arena serves
        // anything venomous this year.
        info: 'Something in them fights the venom. Far less likely to be poisoned by anything the arena serves, and they know what a bad wound looks like.',
        mods: { poisonResist: 0.5, medicine: 0.12 },
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
        // §8.2 (audit): 2.03%. The fear it adds is the point of the trait;
        // the retreat bonus is what is supposed to pay for it, and did not.
        mods: { fearGain: 0.4, retreat: 0.18, rapport: -0.1 },
    },
    'Paranoid': {
        info: 'Never fully relaxes. Notices people trying not to be noticed, and trusts nobody enough to be sold out easily.',
        mods: { awareness: 1.5, betrayalResist: 0.3, allianceAffinity: -0.15 },
    },
    'Grim': {
        info: 'Has buried people before. A death in front of them costs much less than it costs anyone else.',
        mods: { griefResist: 0.5, sanityDrain: -0.1, resolveDrift: 0.75, executeDrive: 0.3 },
    },

    // ---- moving through the arena -------------------------------------
    'Nimble': {
        info: 'Quick and quiet. Better at opening a fight from cover and at getting out of one.',
        mods: { ambush: 0.06, concealment: 0.05, retreat: -0.02 },
    },
    'Clumsy': {
        info: 'Heavy-footed. Markedly worse at opening a fight from cover, and easier to hear coming — but a lifetime of falling badly teaches a body how to land.',
        // §8.2: the last pure-penalty trait in the file after Insomniac got its
        // upside. Same treatment: the penalty stays, and the compensation is
        // the thing a clumsy person genuinely has — practice at getting hurt.
        mods: { ambush: -0.12, concealment: -0.08, bleedResist: 0.15 },
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
        info: 'Simply faster than the rest of the field. Gets clear of a losing fight, travels at night, and crosses ground for less.',
        // §8 (audit): `nightMovement` had no read site, so this was a single
        // retreat modifier — the weakest rollable trait in the game.
        mods: { retreat: -0.06, nightMovement: 1.5, fatigueDay: -1 },
    },
    'Night-Sighted': {
        info: 'Sees in the dark. The night is not the handicap for them that it is for everyone else.',
        mods: { nightMovement: 2.5, awareness: 0.8 },
    },
    'Chameleon': {
        info: 'Disappears into whatever they are standing in. The strongest concealment bonus in the game.',
        // §8.2 (audit): last of the reaping traits at 1.84%. Concealment
        // was read, but 0.12 on a 0-1 scale was not a trait, it was a
        // rounding error; and nothing about it kept the field from looking.
        mods: { concealment: 0.22, campSkill: 0.12, targetDraw: -0.1 },
    },

    // ---- eyes ----------------------------------------------------------
    'Eagle-Eyed': {
        // §8: awareness alone was not saving anybody (4.23%). Seeing it coming
        // is only worth something if it converts into not being there, so the
        // trait now pays out on the way out as well as on the way in.
        info: 'Sees the treeline. The strongest awareness bonus in the game — very hard to sneak up on, and the first to spot the way out.',
        mods: { awareness: 2.5, rangedPower: 1.5, retreat: 0.08, targetDraw: -4 },
    },
    'Tracker': {
        info: 'Reads sign. Better at foraging, better at noticing people, and better at building traps.',
        mods: { awareness: 1.8, forage: 0.08, trapSkill: 0.12 },
    },

    // ---- the fight -----------------------------------------------------
    'Bloodthirsty': {
        info: 'Wants the fight. Pushes hard toward the Aggressive stance and is much less willing to break off.',
        mods: { aggressionScore: 1.5, retreat: -0.25, killSanity: -0.5, hornCommitment: 0.3 },
    },
    'Pacifist': {
        info: 'Will not do this. Resists the Aggressive stance, retreats far sooner — and a kill costs them a catastrophic amount of sanity.',
        mods: { aggressionScore: -1.5, retreat: 0.25, killSanity: 1.5, allianceAffinity: 0.15, hornCommitment: -0.35 },
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
        // §8: 3.13% and last of the reaping traits, because `unarmedPower: 4`
        // is a large bonus to a situation that barely happens — 70% of the
        // living field is carrying a weapon, so the trait was mostly a
        // rounding error with a retreat penalty attached. Half of it converts
        // into things that apply in every fight: being hard to put on the
        // floor, and knowing when the hold has gone.
        info: 'Grew up settling things with their hands. Dangerous unarmed, very hard to take down, and knows the exact moment a hold has gone.',
        mods: { unarmedPower: 2, wrestle: 2, retreat: 0.06 },
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
        // The headline effect was a hardcoded `includes('Pyromaniac')` in
        // combat; it is the hook now, like everything else.
        mods: { campSkill: 0.2, burnResist: 0.25, burnOnHit: 0.2 },
    },
    'Vengeful': {
        info: 'Does not let go. Fights markedly harder against anyone who has already hurt them, will not break off from a rival, and is not frightened of the people they hate.',
        mods: { retreat: -0.08, vengeanceEdge: 3, fearGain: -0.2 },
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
        // §8: the most-assigned trait in the game (n=841) at 4.40%, and partly
        // archetype-confounded — it is handed to the soft archetypes. The
        // honest fix is a survival hook rather than a bigger social number:
        // people like them, so people put themselves in the way for them.
        info: 'Reads well on camera and in a clearing. Forms alliances more easily, holds sponsor trust all run, and the people around them step in when it matters.',
        mods: { allianceAffinity: 0.2, sponsorTrust: 1.5, excitement: 0.2, defended: 0.35, sponsorAppeal: 8 },
    },
    'Loyal': {
        info: 'Will not sell anyone out, and is hard to convince that anyone has sold them out.',
        mods: { allianceAffinity: 0.25, treachery: -0.3, betrayalResist: 0.2, rapport: 0.15 },
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
        mods: { sponsorTrust: 2.5, allianceAffinity: 0.1, persuasion: 0.6, rapport: 0.2 },
    },

    /*
     * Audit 3 §8.4: eight more, because six was not a category.
     *
     * Sorting every trait by the category its modifiers weigh most toward gave
     * combat 25, survival 27 and social 6 — in a game whose deepest subsystem
     * is the social one, which carries the largest achievement shelf (48 of
     * 170) and the busiest engine module. Six social traits cannot
     * differentiate twenty-four tributes' social behaviour, and the reaping
     * was consequently assigning almost everybody a combat or survival
     * identity and letting alliances sort themselves out on regard alone.
     *
     * All eight are built from hooks that already exist and are already read;
     * none needs a new call site. They are written to pull in different
     * directions on purpose — two are liabilities — because a category where
     * every member is an advantage is a category the reaping cannot use to
     * make somebody interesting.
     */
    'Peacemaker': {
        info: 'Gets between people. Talks truces into existence and back from the brink, and takes a betrayal harder than most.',
        mods: { persuasion: 0.8, rapport: 0.35, allianceAffinity: 0.15, treachery: -0.2, betrayalResist: -0.15 },
    },
    'Grudge-Keeper': {
        info: 'Forgives nothing and forgets less. Will not reconcile, will not be talked round, and is very hard to betray twice.',
        mods: { rapport: -0.5, betrayalResist: 0.35, treachery: 0.1, allianceAffinity: -0.15, executeDrive: 0.2 },
    },
    'Broker': {
        info: 'Deals in what other people need. Better at arranging terms than at keeping them, and always has something somebody wants.',
        mods: { persuasion: 0.55, scavenge: 0.1, treachery: 0.15, sponsorTrust: 1, allianceAffinity: 0.1 },
    },
    'Steadfast': {
        info: 'The one everybody ends up relying on. Does not move first, does not move on you, and grief does not take them off their feet.',
        mods: { allianceAffinity: 0.25, treachery: -0.35, griefResist: 0.3, defended: 0.2, resolveDrift: 0.4 },
    },
    'Prickly': {
        info: 'Difficult company. Slower to be taken in, quicker to be left out, and largely indifferent to either.',
        mods: { allianceAffinity: -0.35, rapport: -0.25, sponsorTrust: -1, targetDraw: -0.15, resolveDrift: 0.3 },
    },
    'Needy': {
        info: 'Cannot be alone with it. Allies with almost anybody, feels every loss twice, and comes apart on their own.',
        mods: { allianceAffinity: 0.4, griefResist: -0.35, sanityDrain: 0.25, betrayalResist: -0.2 },
    },
    'Diplomatic Cover': {
        info: 'Reads as harmless and is trusted accordingly. Hard to suspect, easy to underestimate, and perfectly willing to use both.',
        mods: { betrayalResist: 0.25, treachery: 0.2, targetDraw: -0.2, persuasion: 0.3, allianceAffinity: 0.1 },
    },
    'Sworn': {
        info: 'Keeps their word past the point of sense. Whatever they agreed to holds, and being on the wrong end of a broken one is worse for them than for anybody else.',
        mods: { treachery: -0.5, betrayalResist: 0.2, rapport: 0.3, resolveDrift: -0.3, allianceAffinity: 0.2 },
    },
    'Unremarkable': {
        info: 'Nobody is watching. Draws very little excitement and almost no sponsorship — and is genuinely the last person anyone goes looking for.',
        // §8c gave this a large `targetDraw` discount to make the promise in
        // its own info string mechanical, and it worked — but the trait was
        // still last at 3.87% (n=1266), because the riders cost more than
        // being overlooked was worth. `sponsorTrust: -1.5` is applied *per
        // cycle* (survival.ts), so over a full run it drove trust to zero and
        // kept it there: this tribute could never be sponsored at all. Cut to
        // a drift that still reads as "nobody is buying them a parachute"
        // without closing the door, and the concealment rider raised to pay
        // out where the trait's identity actually lives.
        mods: { excitement: -0.4, sponsorTrust: -0.4, odds: -1, targetDraw: -28, concealment: 0.12 },
    },

    // ---- the pack and the pantry ---------------------------------------
    'Herbalist': {
        info: 'Knows the plants. Forages more reliably and dresses a wound properly.',
        mods: { forage: 0.1, medicine: 0.2, poisonResist: 0.25 },
    },
    'Trapper': {
        // §8: the largest sample of any trait (n=4102) and the worst win rate
        // in the game (3.05%) — common AND bad, the worst combination there
        // is for how fair the game feels. The cause was not the numbers here:
        // `attemptFieldcraft` tried sharpening, poisoning, a fire, a shelter
        // and camouflage before it ever considered a trap, so across 400 runs
        // the entire field set 228 of them. Trap-setting now jumps that queue
        // for tributes who are genuinely good at it (see TRAPS.prioritySkill),
        // which is what this trait is for; the skill number went up with it.
        info: 'Builds things that wait. The best trap-setter in the field, and a competent camp.',
        mods: { trapSkill: 0.28, campSkill: 0.1 },
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
        info: 'Bonded to their district partner. The two of them will refuse to fight each other under any circumstances, and the Capitol adores it — a steady drip of sponsor trust and excitement all run. They hold their nerve for each other, and a death in front of them lands twice as hard.',
        earned: true,
        // The only trait in the file with no mods. The bond itself is the
        // string-id test in `alliance.ts`; these are what being in love does
        // to a person in an arena.
        mods: { resolveDrift: 0.75, griefResist: -0.4, allianceAffinity: 0.15 },
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
        info: 'Earned surviving the Gamemakers\' animals twice. Whatever they send next, they have already met worse — and they break off from it sooner.',
        earned: true,
        // §8: the one earned trait that reads below the field (0.65% against a
        // ~5% baseline and 12-25% for the other eleven), because its earning
        // condition is itself two near-deaths: everyone holding it has already
        // been mauled twice. The rate can never look like Feared's — but the
        // mitigation was nowhere near paying for what it cost to get, so the
        // mutt-damage discount and the break-off are both raised. A tribute
        // who has met the Gamemakers' animals twice and walked away should be
        // genuinely hard for the third one to kill.
        mods: { fearGain: -0.4, sanityDrain: -0.2, combatPower: 1.5, resolveDrift: 1, retreat: 0.15, muttDamage: -0.6 },
    },
    'Merciful': {
        info: 'Earned by letting someone live who did not have to. The Capitol finds it fascinating; the arena finds it expensive.',
        earned: true,
        // §8 (audit): net negative in the arena. The sponsor drift stays; the
        // Capitol's fascination is worth more than it was.
        mods: { excitement: 0.45, sponsorTrust: 2, killSanity: 0.4, griefResist: 0.2 },
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
        // `sponsorTrust` is a per-cycle drift: -1 a cycle was -20 over a run,
        // the same failure mode Unremarkable's comment describes being fixed.
        mods: { scavenge: 0.12, capacity: 1, sponsorTrust: -0.3 },
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
    /**
     * Audit 4 §6.3/§10.1: quirks, folded into the same sum.
     *
     * 85 quirks with four-plus lines each were the best character-
     * differentiation content in the repository and were **entirely inert** —
     * read in exactly two places, one that assigns them and one that surfaces
     * a line on a quiet cycle. "Always takes the high ground", "never turns
     * their back on a treeline", "sleeps in short shifts by choice": every one
     * of them is a mechanical hook written out in prose and left as prose.
     *
     * They reuse the trait vocabulary rather than growing one of their own, so
     * a quirk costs a data row and no read site at all — the same argument
     * `TraitMod` was built on. Magnitudes are deliberately about a third of a
     * trait's: a tribute carries one or two, they are free, and they are
     * supposed to be a tilt rather than a build.
     */
    for (const label of t.quirks ?? []) {
        const mod = QUIRK_MODS[label]?.[key];
        if (mod) total += mod;
    }
    return total;
}

/**
 * §3.1: traits that were standing in for a skill.
 *
 * `Climber` and `Swimmer` described a competence and expressed it only as
 * movement-scoring preference, because there was no `climbing` or `swimming`
 * proficiency for them to be an extreme of. That is the same concept written
 * twice in two systems that could not talk to each other — a Swimmer could
 * cross water all week and never get better at it, and a non-Swimmer who
 * crossed it every day could never catch up.
 *
 * The fix is not to delete the trait. It is to make the trait the *head start*
 * and the proficiency the *arc*: a Climber walks in already competent and can
 * still become an expert, and anyone else can get there the slow way. The
 * movement mods stay exactly as they were — preferring high ground is a
 * statement about temperament, not about technique.
 *
 * Read through `profOf()` in engine/proficiency, which takes the larger of the
 * stored level and this floor, so the floor also applies to saves written
 * before these axes existed.
 */
const TRAIT_PROFICIENCY_FLOOR: Record<string, Partial<Record<Proficiency, number>>> = {
    'Climber': { climbing: PROFICIENCY.traitHeadStart },
    'Swimmer': { swimming: PROFICIENCY.traitHeadStart },
    // Trapper is the third of the same shape: a trait that names a craft.
    'Trapper': { crafting: PROFICIENCY.traitHeadStart },
};

/** The competence a tribute's traits grant outright in a skill, before use. */
export function traitProficiencyFloor(t: Tribute, skill: Proficiency): number {
    let floor = 0;
    for (const name of t.traits) {
        const granted = TRAIT_PROFICIENCY_FLOOR[name]?.[skill];
        if (granted && granted > floor) floor = granted;
    }
    return floor;
}

/** Documentation lookup, tolerating a trait from an older save. */
export function traitInfo(trait: string): string {
    return TRAIT_DEFS[trait]?.info ?? 'No recorded effect.';
}
