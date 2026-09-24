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
    /*
     * AUDIT-6 §12.2: the social half of the vocabulary, which was still a third
     * the size of the combat half.
     *
     * Counted by what they touch, `TraitMod` was roughly 26 combat-and-body keys
     * against 8 social ones — in a game whose deepest subsystem is social, and
     * whose own §8.3 comment says so. Eight more, each read at exactly one
     * existing site, following the rule this file was built on: a new trait
     * costs a data row and no read site at all.
     */
    | 'trustGain'            // multiplier offset on how fast trust moves (relationships.ts)
    | 'suspicionResist'      // fraction removed from suspicion accrued (memory.ts)
    | 'leadership'           // flat, added to the pickLeader score (alliance.ts)
    | 'charterHold'          // fraction removed from the chance of breaching a charter clause (allianceCharter.ts)
    | 'rumourCredibility'    // flat, how much a claim from this tribute is believed (rumours.ts)
    | 'debtHonour'           // flat, added to repayment likelihood (debts.ts)
    | 'intimidation'         // flat, added to the intimidation proficiency (fear.ts)
    | 'haggle'               // flat, on the parley bargaining scale (parley.ts)
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
    /*
     * AUDIT-9 stage D: five traits from the audit's §9 table.
     *
     * Chosen on one rule, which the audit states plainly: "Avoid making every
     * drawback a tiny numeric penalty. A changed choice is a stronger identity
     * than +3% to an existing roll." Every one of these hooks into a system
     * stage C built, because that is where the choices now are — hours in a
     * day, a promise with a deadline, a warning you can act on, and a belief
     * that knows how sure it is. A trait that could only have been a modifier
     * was not worth adding.
     *
     * Overlap with `Paranoid`, `Rope-Handed`, `Bookkeeper` and `Reads The Sky`
     * was checked first, as the audit asks. `Evidence-Hungry` is the closest
     * call and is deliberately the opposite axis to `Paranoid`: Paranoid
     * distrusts *people*, Evidence-Hungry distrusts *single reports*, and a
     * Paranoid tribute will act on one sighting instantly where this one will
     * not act until a second source agrees.
     */
    'Exit-Minded': {
        info: 'Finds the way out before they need it. Spends part of the day scouting a route off dangerous ground, and is much harder to catch when it goes wrong.',
        mods: { retreat: 0.25 },
    },
    'Evidence-Hungry': {
        info: 'Will not move on one person\'s word. Needs a second source before acting on a report, which costs them time when the first source was telling the truth.',
    },
    'Overprepared': {
        info: 'Carries the spare and the spare\'s spare. Never short of what a situation needs, and slower out of camp than anybody who is not.',
        mods: { capacity: 2 },
    },
    'Bargain-Shy': {
        info: 'Takes the deal in front of them over the promise of a better one. Hard to defraud on credit, and never has anybody owing them a favour when it matters.',
        mods: { haggle: 0.25 },
    },
    'Shared-Burden': {
        info: 'Will carry somebody. Volunteers for the injured ally and the long way round, and pays for it in exhaustion.',
        mods: { allianceAffinity: 0.2 },
    },

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
        // AUDIT-11 §11.5: ~20% off (1.2). 11.2% win rate at the audit's n=400.
        mods: { awareness: 0.95 },
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
        // AUDIT-11 §11.5: ~20% off every term (-0.35 / 4 / 1).
        mods: { sanityDrain: -0.28, sanityRecovery: 3.2, resolveDrift: 0.8 },
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
        // AUDIT-7 §1.4: `intimidation` is read at `fear.ts:36` and, until this
        // pass, was carried by no trait and no quirk in the game — so the whole
        // term contributed a flat zero to every fear roll ever made. Three
        // traits whose own `info` already said they frighten people now say it
        // in the modifier table too. See the rule at the top of this file: a
        // key with a read site and no writer is the same bug as a modifier with
        // no read site, wearing the other hat.
        // AUDIT-11 §11.5: ~20% off every positive term (2 / 2.5 / 1.5 / 0.8).
        mods: { meleePower: 1.6, unarmedPower: 2, odds: 1.2, ambush: -0.04, intimidation: 0.64 },
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
        // AUDIT-11 §11.6: capped at 2 sd of the combat category (it was 3.3 sd,
        // nearly all `targetDraw`). -15 is still one of the largest draw discounts in
        // the game; concealment keeps the trait's promise where it lives.
        mods: { excitement: -0.4, sponsorTrust: -0.4, odds: -1, targetDraw: -15, concealment: 0.12 },
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
    // ---- Audit 5 §12.3: filling the single-carrier hooks -----------------
    'Camel': {
        info: 'Can go a long time on very little water. Loses less to thirst every cycle and shrugs off the heat.',
        mods: { thirstDrain: -4, heatResist: 0.1 },
    },
    'Grappler': {
        info: 'Fights close. Hard to throw, hard to shake off, and does not break away easily.',
        mods: { wrestle: 0.4, unarmedPower: 1.5, retreat: -0.03 },
    },
    'Kindler': {
        info: 'Good with fire and unafraid of it. Their hits burn a little more often, and burns hurt them a little less.',
        mods: { burnOnHit: 0.12, burnResist: 0.2 },
    },
    'Houndsman': {
        info: 'Grew up around animals. Takes less from mutts and hears them coming.',
        mods: { muttDamage: -0.15, awareness: 0.4 },
    },
    'Crowd-Pleaser': {
        info: 'Plays to the cameras. Sponsors like it; the people trying to hide from the cameras do not.',
        mods: { sponsorAppeal: 1.5, excitement: 0.2, concealment: -0.05 },
    },
    'Sleepless': {
        info: 'Sleeps badly and wakes fast. Worse fatigue at night, far better awareness after dark, and the mind wears a little quicker.',
        mods: { fatigueNight: 2, awarenessNight: 0.8, sanityDrain: 0.15 },
    },
    'Deep-Lunged': {
        info: 'A strong swimmer with a long breath. Prefers water when choosing where to go, and survives it.',
        mods: { water: 0.6, fatigueDay: -0.5 },
    },
    'Sure-Footed': {
        info: 'At home on high ground and steep ground. Chooses it, and gets off it in a hurry when they have to.',
        mods: { highland: 0.5, retreat: 0.1 },
    },
    'Quartermaster': {
        info: 'Packs and carries well. More room in the bag, and a better eye for what is worth picking up.',
        mods: { capacity: 2, scavenge: 0.3 },
    },
    'Unlucky': {
        info: 'Things happen to them. The book prices them down, and the field somehow always ends up looking their way.',
        mods: { odds: -0.3, targetDraw: 1.0 },
    },
    // ---- requests item 3: more traits ---------------------------------
    // Every row below is built from keys that already have a read site; no
    // new hooks, so nothing here can be inert the way the pre-A2 table was.
    'Dead-Eyed': {
        info: 'Something behind the eyes has already left. Killing costs them almost nothing, and the field can tell.',
        mods: { killSanity: -0.5, targetDraw: 0.6, allianceAffinity: -0.25, excitement: 0.15, intimidation: 1.2 },
    },
    'Rope-Handed': {
        info: 'Grew up on lines and knots. Very hard to hold onto in a grapple, and their traps hold what other people\'s let go.',
        mods: { wrestle: 2.5, trapSkill: 0.12, highland: 0.6 },
    },
    'Cold-Blooded': {
        info: 'Does not startle and does not warm up. Frightening to stand near and slow to take fright themselves, but nobody wants them at their back.',
        mods: { fearGain: -0.35, targetDraw: 0.4, allianceAffinity: -0.3, ambush: 0.05 },
    },
    'Barterer': {
        info: 'Talks a price out of anybody. Holds truces together, gets more out of a reconciliation, and knows what a thing is worth.',
        mods: { persuasion: 1.5, rapport: 0.3, scavenge: 0.1 },
    },
    'Feral': {
        info: 'Raised half-wild, or has decided to be. Dangerous without a weapon, at home off the path, and difficult to talk to.',
        mods: { unarmedPower: 3, forage: 0.12, allianceAffinity: -0.35, persuasion: -1 },
    },
    'Lightfooted': {
        info: 'Moves without weight. Quieter than they have any right to be, and the ground never gives them away.',
        mods: { concealment: 0.07, nightMovement: 0.7, fatigueDay: -1 },
    },
    'Sunburnt': {
        info: 'A childhood spent outdoors under it. Heat is an old acquaintance; cold is not.',
        mods: { heatResist: 0.35, coldResist: -0.15, thirstDrain: -3 },
    },
    'Field Surgeon': {
        info: 'Learned it at home, badly lit, on somebody who mattered. Dressings take, and bleeding stops sooner.',
        mods: { medicine: 0.18, bleedResist: 0.2 },
    },
    'Sleepless Watch': {
        info: 'Takes the long shift and gives it to nobody else. Best eyes in the camp after dark, at a real cost by morning.',
        mods: { awarenessNight: 2.5, fatigueDay: 2, defended: 0.6 },
    },
    'Contrarian': {
        info: 'Does the opposite on principle. Impossible to predict, impossible to organise, and the book cannot price them.',
        mods: { ambush: 0.05, treachery: 0.15, allianceAffinity: -0.2, odds: -0.15, excitement: 0.2 },
    },
    'Broad-Backed': {
        info: 'Built for carrying. More in the bag, more behind a swing, less left at the end of the day.',
        mods: { capacity: 1, meleePower: 2, fatigueDay: 1 },
    },
    'Thin-Skinned': {
        info: 'Takes everything personally, including the arena. Fast to hate, slow to steady, and dangerous when slighted.',
        mods: { vengeanceEdge: 2, sanityDrain: 0.25, aggressionScore: 1.5, griefResist: -0.2 },
    },
    'Devout': {
        info: 'Believes something the Capitol did not issue. Grief lands softer, resolve holds, and dying is not the worst outcome they can name.',
        mods: { griefResist: 0.3, resolveDrift: 0.6, retreat: -0.1, sanityRecovery: 1 },
    },

    'Witness': {
        info: 'Earned by watching a betrayal happen. Grief lands harder, resolve holds longer, and they are very hard to fool twice.',
        earned: true,
        mods: { griefResist: -0.2, resolveDrift: 0.3, betrayalResist: 0.2 },
    },
    'Frostbitten': {
        info: 'Earned in the cold. The body has learnt what it costs; it resists the next freeze and pays for it in sleep.',
        earned: true,
        mods: { coldResist: 0.3, fatigueNight: 1.0 },
    },
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
        // AUDIT-11 §11.6: capped at 2 sd of the combat category (it was 4.1 sd,
        // almost all of it `combatPower` and `resolveDrift`). The mutt discount
        // is the trait's identity and keeps most of its size.
        mods: { fearGain: -0.4, sanityDrain: -0.13, combatPower: 0.5, resolveDrift: 0.5, retreat: 0.12, muttDamage: -0.45 },
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

    // ---- AUDIT-6 §12.3: the social ten -------------------------------------
    //
    // The category the trait table needed most. Every one of these reads
    // through a key added in §12.2, so none of them costs a read site.
    'Vouched': {
        info: 'Somebody in the field already speaks for them. Trust comes faster than it should, and they are asked into things.',
        mods: { trustGain: 0.3, allianceAffinity: 0.1 },
    },
    'Stone-Faced': {
        info: 'Nothing shows. Very hard to suspect of anything, nearly impossible to warm to, and unreadable across a clearing.',
        mods: { suspicionResist: 0.4, rapport: -0.2, intimidation: 0.6 },
    },
    'Standard-Bearer': {
        info: 'People follow them. So does everybody else: the field knows exactly who to take out of a group first.',
        mods: { leadership: 2, targetDraw: 1 },
    },
    'Bookkeeper': {
        info: 'Keeps the accounts and keeps the terms. Pays what they owe and holds the charter they signed.',
        mods: { debtHonour: 0.4, charterHold: 0.3 },
    },
    'Fabulist': {
        info: 'Lies well and often. What they say is believed, whether or not it is true.',
        mods: { rumourCredibility: 0.3, sponsorTrust: -0.2 },
    },
    'Quiet Room': {
        info: 'Talks people round when nothing is happening, and not at all when something is. Persuasive out of a fight, useless in one.',
        mods: { persuasion: 1.5, combatPower: -1 },
    },
    'Sworn Off': {
        info: 'Will not join anything early. Once they do, they stay — and the arena has usually thinned by then.',
        mods: { allianceAffinity: -0.25, betrayalResist: 0.3 },
    },
    'Tallyman': {
        info: 'Remembers every slight and forgives none of them. Hard to betray twice; takes a death badly.',
        mods: { betrayalResist: 0.3, griefResist: -0.2, treachery: 0.1 },
    },
    'Open Hand': {
        info: 'Gives things away. Warm to, easy to trust, and never carrying as much as they should be.',
        mods: { rapport: 0.4, treachery: -0.3, capacity: -1 },
    },
    'Hard Bargain': {
        info: 'Drives a price. Gets more out of a standoff than anybody and less out of the Capitol.',
        mods: { haggle: 0.4, sponsorAppeal: -0.5, sponsorTrust: -0.2 },
    },

    // ---- AUDIT-6 §12.3: the body and the ground ----------------------------
    'Thin-Blooded': {
        info: 'Bleeds badly and does not feel the cold. A wound is worse for them; a night in the open is not.',
        mods: { bleedResist: -0.3, coldResist: 0.4 },
    },
    'Gut-Wise': {
        info: 'Knows what is safe to eat and eats more of it. Finds food, shrugs off bad water, and is hungry either way.',
        mods: { poisonResist: 0.4, forage: 0.15, hungerDrain: 3 },
    },
    'Sun-Blind': {
        info: 'Useless in daylight glare and very good after dark. The night watch nobody wants to relieve.',
        mods: { awareness: -1, awarenessNight: 3 },
    },
    'Salt-Cured': {
        info: 'Built for heat and thirsty for it. Takes the sun better than anyone and drinks more than anyone.',
        mods: { thirstDrain: 4, heatResist: 0.5 },
    },
    'Second Wind': {
        info: 'Comes back from exhaustion once. Recovers hard at night and pays for it during the day.',
        mods: { fatigueNight: -8, fatigueDay: 4 },
    },
    'Deep-Rooted': {
        info: 'Settles. Forages the same ground long after anybody else would have moved on, and does better at it.',
        mods: { forage: 0.12, campSkill: 0.15, highland: -0.8 },
    },

    // ---- AUDIT-6 §12.3: the fight ------------------------------------------
    'Left-Handed': {
        info: 'Fights from the wrong side. The first exchange goes their way more often than it should.',
        mods: { ambush: 0.12, meleePower: 1 },
    },
    'Shield-Wise': {
        info: 'Knows what armour is for. Whatever they are wearing works better than it does on anybody else.',
        mods: { defended: 1.5, wrestle: 1 },
    },
    'Reach': {
        info: 'Long arms and the sense to use them. Better with anything held at a distance; poor in close.',
        mods: { meleePower: 2, unarmedPower: -2 },
    },
    'Cold Opener': {
        info: 'Starts a fight well and finishes one badly. Ambushes hard, and does not know when to break off.',
        mods: { ambush: 0.25, retreat: -0.2 },
    },

    // ---- AUDIT-6 §12.3: four more earned in the arena ----------------------
    'Oath-Breaker': {
        info: 'Earned breaking terms they agreed to. Nobody signs anything with them again.',
        earned: true,
        mods: { treachery: 0.3, allianceAffinity: -0.4, trustGain: -0.3 },
    },
    'Fire-Walker': {
        info: 'Earned walking out of a burning sector twice. Fire has stopped being a reason to go around.',
        earned: true,
        mods: { burnResist: 0.5, targetDraw: 0.5 },
    },
    'Twice-Downed': {
        info: 'Earned getting up twice. They know exactly how much a body can take, which is more than they thought.',
        earned: true,
        mods: { retreat: 0.3, combatPower: 1 },
    },
    'Namesake': {
        info: 'Earned carrying a named weapon to a second kill. The Capitol talks about the blade, and about them.',
        earned: true,
        mods: { sponsorAppeal: 2, targetDraw: 1, meleePower: 1 },
    },

    /*
     * ---- AUDIT-7 §12.3: thirty, and the first thirteen have a job ----------
     *
     * The vocabulary was 59 `TraitMod` keys against 119 traits, and thirteen of
     * those keys were carried by two traits or fewer — six of them by exactly
     * one. A key carried by a single trait is a key whose effect is
     * indistinguishable from that trait: you cannot tell whether `haggle`
     * matters or whether Barterer matters, because they are the same row.
     *
     * So the first thirteen below are chosen to double up the thinnest keys
     * rather than to be individually clever, which is also how the roster stops
     * being 42 combat modifiers against 26 social ones. The rest fill out the
     * families the measured tail of §8.1 says are weak.
     */

    // -- carrying an under-used key ------------------------------------------
    'Watchful': {
        info: 'Hard to work on. Slow to take against somebody on nothing but a feeling, and misses very little.',
        mods: { suspicionResist: 0.25, awareness: 0.3 },
    },
    "Standard-Bearer's Second": {
        info: 'Has carried somebody else\'s colours before. The group finds itself deferring without deciding to.',
        mods: { leadership: 1.2, allianceAffinity: 0.05, rapport: 0.1 },
    },
    'Good For It': {
        info: 'Pays what they owe, and is known for it. A debt to them is worth more than a debt to anybody else.',
        mods: { debtHonour: 0.4, trustGain: 0.2 },
    },
    'Letter Of The Law': {
        info: 'Holds to what was agreed past the point of sense. Will not breach a charter clause and cannot see why anyone would.',
        mods: { charterHold: 0.3, treachery: -0.05 },
    },
    'Straight Story': {
        info: 'Tells it the way it happened. Believed when it counts, and hopeless at getting a price.',
        mods: { rumourCredibility: 0.8, haggle: -0.2 },
    },
    'Horse Trader': {
        info: 'Knows what a thing is worth to the person who needs it, which is never what it is worth.',
        mods: { haggle: 0.6, persuasion: 0.4 },
    },
    'Finisher': {
        info: 'Does not leave people on the ground. It costs them something every time and they do it anyway.',
        mods: { executeDrive: 0.15, killSanity: 0.2 },
    },
    'Long Sight': {
        info: 'Reads distance better than anybody. Formidable at range and awkward once it closes.',
        mods: { rangedPower: 1.5, meleePower: -0.5 },
    },
    'First Off The Plate': {
        info: 'Moves on the gong before the sound has finished. Goes for the horn, and does not know how to break off.',
        mods: { hornCommitment: 0.2, retreat: -0.03 },
    },
    'Cinder-Handed': {
        info: 'Something about them and fire. What they hit tends to catch, and what catches does not catch them.',
        mods: { burnOnHit: 0.1, burnResist: 0.2 },
    },
    'Grudge-Fed': {
        info: 'Fights hardest against the one they swore about. It eats them the rest of the time.',
        mods: { vengeanceEdge: 2, sanityDrain: 0.1 },
    },
    'Beast-Wise': {
        info: 'Grew up around animals that could kill them. Reads a mutt the way other people read weather.',
        mods: { muttDamage: -0.2, awareness: 0.2 },
    },
    'Takes People As They Come': {
        info: 'Slow to suspect and quick to trust, which is either the best or the worst way to play this.',
        mods: { trustGain: 0.4, suspicionResist: 0.15 },
    },

    // -- body and deprivation -------------------------------------------------
    'Thrifty': {
        info: 'Makes a day\'s food last two. Pays for it in the legs by the afternoon.',
        mods: { hungerDrain: -3, fatigueDay: 0.5 },
    },
    'Sun-Fed': {
        info: 'Comes alive in heat and shuts down in cold. Whichever arena they drew, they know by the first evening.',
        mods: { heatResist: 0.3, coldResist: -0.15 },
    },
    'Slow Burn': {
        info: 'Sleeps properly and starts badly. Worth having on the fourth day and not the first.',
        mods: { fatigueNight: -1.5, fatigueDay: 0.8 },
    },
    'Hollow Leg': {
        info: 'Can go a long time without water and will drink anything when they do.',
        mods: { thirstDrain: -3, poisonResist: -0.1 },
    },
    'Set Bones': {
        info: 'Has been broken before and healed straight. Bleeds less and moves like somebody remembering an injury.',
        mods: { bleedResist: 0.2, fatigueDay: 0.4 },
    },

    // -- combat ----------------------------------------------------------------
    'Left-Guard': {
        info: 'Fights from the wrong side. Keeps somebody else standing, and is dangerous with nothing in their hands.',
        mods: { defended: 0.15, unarmedPower: 1 },
    },
    'Overreach': {
        info: 'Hits harder than their frame should allow by committing to it. Cannot take the blow back.',
        mods: { meleePower: 2, retreat: -0.08 },
    },
    'Counterpuncher': {
        info: 'Better at being attacked than at attacking. Very hard to hold on to.',
        mods: { wrestle: 0.5, defended: 0.1 },
    },
    'Spent': {
        info: 'Earned by surviving something that used everything they had. Quieter afterwards, and rests properly for the first time.',
        earned: true,
        mods: { combatPower: -1.5, sanityRecovery: 2, resolveDrift: 0.2 },
    },
    'Blooded Twice': {
        info: 'Earned killing a second time. The fear that came with the first one is gone, and so is something else.',
        earned: true,
        mods: { vengeanceEdge: 1.5, fearGain: -0.15 },
    },

    // -- social ------------------------------------------------------------------
    'Reads The Room': {
        info: 'Knows when to speak and, more usefully, when somebody else has already decided.',
        mods: { rapport: 0.5, persuasion: 0.3 },
    },
    'Owes Nobody': {
        info: 'Will not be put under an obligation. Hard to buy, hard to betray, and hard to like.',
        mods: { debtHonour: -0.3, betrayalResist: 0.2, allianceAffinity: -0.1 },
    },
    'Keeps Books': {
        info: 'Writes down what was agreed, in their head, exactly. The group ends up running on it.',
        mods: { charterHold: 0.25, leadership: 0.4 },
    },
    'Spoken For': {
        info: 'Somebody at home is watching, and the arena knows it. Sponsors like it; so do hunters.',
        mods: { allianceAffinity: 0.1, targetDraw: 0.5, sponsorAppeal: 1 },
    },

    // -- field and mind ------------------------------------------------------------
    'Reads Ground': {
        info: 'Can tell what a place will give before walking into it, and remembers the way back.',
        mods: { forage: 0.06, highland: 0.4 },
    },
    'Night Ear': {
        info: 'Hears everything after dark and misses things in daylight, which nobody warns them about.',
        mods: { awarenessNight: 0.6, awareness: -0.1 },
    },
    'Steady Hand': {
        info: 'Does fiddly work under pressure. Dressings hold and snares sit where they were put.',
        mods: { medicine: 0.08, trapSkill: 0.05 },
    },

    /*
     * ======================= AUDIT-8 §12.3 ==================================
     *
     * Thirty, weighted deliberately toward the modifier keys almost nothing
     * carried.
     *
     * `TraitMod` has 59 keys and every one is read somewhere — the check at
     * `test:flavor` holds that line at a ceiling of zero unwritten keys. But
     * *carried* is a different question from *read*, and the census was
     * lopsided: `allianceAffinity` sat on 35 traits, `resolveDrift` and
     * `retreat` on 30 each, while nine keys were carried by three rows or
     * fewer — `rumourCredibility` by two, and `executeDrive`,
     * `hornCommitment`, `intimidation`, `leadership`, `charterHold`,
     * `suspicionResist`, `debtHonour` and `haggle` by three apiece. A
     * modifier carried by two traits out of 149 is a modifier the player will
     * essentially never meet, however diligently the engine reads it.
     *
     * Eighteen of the thirty below exist to fix that specifically. The rest
     * fill the body and deprivation axes and the earned set, which is 25
     * against 124 rollable and is the half a player actually notices arriving.
     *
     * The file's founding rule is unchanged and is why this is a data-only
     * change: a new trait costs a row and no read site at all.
     */

    // ---- the social keys almost nothing carried ----------------------------
    'Straight Dealer': {
        info: 'Says what the terms are and then keeps to them. Pays what they owe; gets a worse price for being predictable about it.',
        mods: { debtHonour: 0.15, haggle: 0.1, treachery: -0.1 },
    },
    'Known Liar': {
        info: 'Has been caught at it. Nothing they say is taken at face value again, which is occasionally useful and mostly not.',
        mods: { rumourCredibility: -0.4, haggle: 0.15, suspicionResist: -0.1 },
    },
    'Takes The Floor': {
        info: 'Speaks to a room rather than to a person. Groups form around them and arguments end where they say they do.',
        mods: { leadership: 0.2, persuasion: 0.05, excitement: 0.1 },
    },
    'Clause-Minded': {
        info: 'Treats an agreement as a list of things that were agreed. Keeps charters to the letter and expects the same.',
        mods: { charterHold: 0.2, debtHonour: 0.1, allianceAffinity: 0.1 },
    },
    'Slow To Doubt': {
        info: 'Needs to see it twice before believing it of somebody. Suspicion slides off them, and so does the first warning.',
        mods: { suspicionResist: 0.25, betrayalResist: -0.1 },
    },
    'Trusted Voice': {
        info: 'Somehow believed. What they repeat gets repeated, whether or not it was true when they got it.',
        mods: { rumourCredibility: 0.3, persuasion: 0.05 },
    },
    'Hard Look': {
        info: 'Frightens people without doing anything. Useful at a standoff and a liability everywhere the field can see them.',
        mods: { intimidation: 0.2, targetDraw: 0.5, rapport: -0.1 },
    },
    'Settles Up': {
        info: 'Does not like owing. Pays debts early, carries what is needed to be able to, and is short of space for anything else.',
        mods: { debtHonour: 0.2, capacity: 1, treachery: -0.05 },
    },
    'Pack Sense': {
        info: 'Knows where everyone in the group is without looking. Leads by being where the gap was.',
        mods: { leadership: 0.15, defended: 0.1 },
    },
    'Never Renegotiates': {
        info: 'The first price is the price. Sworn terms hold with them long after the reason for them has gone.',
        mods: { haggle: -0.2, charterHold: 0.25 },
    },
    'Reads The Sky': {
        info: 'Pays attention to the anthem and the cannon and puts it together faster than most. What they tell you about the field is usually right.',
        mods: { rumourCredibility: 0.2, awareness: 0.2 },
    },
    'Owes The Room': {
        info: 'Carries a debt to everybody who has ever helped them and behaves accordingly. Slow to run out on anyone.',
        mods: { debtHonour: 0.3, allianceAffinity: 0.2, retreat: 0.05 },
    },

    // ---- the combat keys almost nothing carried ---------------------------
    'First Through': {
        info: 'Goes at the horn without deciding to. The sixty seconds on the plate are the easiest of their Games.',
        mods: { hornCommitment: 0.25, combatPower: 1 },
    },
    'Hangs Back': {
        info: 'Lets the first wave go and watches what it costs them. Never at the front, and harder to find.',
        mods: { hornCommitment: -0.3, concealment: 0.15 },
    },
    'Finishes It': {
        info: 'Does not leave somebody on the ground. Closes every fight they win, and carries all of them afterwards.',
        mods: { executeDrive: 0.25, killSanity: 0.2 },
    },
    'Cannot Finish It': {
        info: 'Wins the exchange and then stops. Leaves people alive who were not going to return the favour.',
        mods: { executeDrive: -0.35, griefResist: -0.15 },
    },
    'Grips Hard': {
        info: 'Gets hold and does not let go. Dangerous with nothing in their hands and hard to shake off.',
        mods: { wrestle: 0.2, unarmedPower: 1.5 },
    },
    'Fights Wounded': {
        info: 'Does not fight worse for bleeding. Everybody who reads them as finished is wrong once.',
        mods: { bleedResist: 0.2, retreat: -0.15 },
    },

    // ---- the body and the ground ------------------------------------------
    'Long Wind': {
        info: 'Goes all day at the same pace. Not fast, and still walking when the fast ones have stopped.',
        mods: { fatigueDay: -3, water: 0.2 },
    },
    'Heat-Bred': {
        info: 'Raised somewhere the sun means it. Works through the afternoon and is useless after dark.',
        mods: { heatResist: 0.3, coldResist: -0.2 },
    },
    'Runs Cold': {
        info: 'Comfortable in weather that has everybody else shaking, and finished by an hour of real sun.',
        mods: { coldResist: 0.3, heatResist: -0.2 },
    },
    'Eats Late': {
        info: 'Can go a long time on very little and then needs it all at once. Poor at finding food; excellent at not needing it yet.',
        mods: { hungerDrain: -4, forage: -0.04 },
    },
    'Thin Sleeper': {
        info: 'Never fully under. Gets less out of a night than they should and hears everything that happens in one.',
        mods: { fatigueNight: -2, awarenessNight: 0.4 },
    },
    'Heavy Bones': {
        info: 'Dense through the frame. Very hard to move and very hard to hide behind anything.',
        mods: { wrestle: 0.15, concealment: -0.1 },
    },

    // ---- earned in the arena ----------------------------------------------
    'Unbroken': {
        info: 'Never went under. Eight days in the arena and the near-death line is a thing that happened to other people.',
        earned: true,
        mods: { resolveDrift: 0.5, sponsorTrust: 0.3, odds: 0.4 },
    },
    'Sleepless Week': {
        info: 'Took the watch four nights running. Sees what is coming and is nearly out on their feet.',
        earned: true,
        mods: { awarenessNight: 0.5, fatigueDay: 3 },
    },
    'Trapline': {
        info: 'Has built enough of them to stop thinking about it. The ground around them stops being neutral.',
        earned: true,
        mods: { trapSkill: 0.12, campSkill: 0.05 },
    },
    'Mapmaker': {
        info: 'Has found two ways through this arena that were not on anybody\'s plan, and is looking for a third.',
        earned: true,
        mods: { highland: 0.5, awareness: 0.3, concealment: 0.05 },
    },
    'Kept The Peace': {
        info: 'Three truces run to term. The field has worked out that a deal with them is worth something.',
        earned: true,
        mods: { persuasion: 0.08, rumourCredibility: 0.25, targetDraw: -0.5 },
    },
    'Outlived The Pack': {
        info: 'The last of a group of four or more. Everyone they trained with is in the sky and they are still walking.',
        earned: true,
        mods: { resolveDrift: -0.3, griefResist: 0.3, treachery: 0.15, odds: 0.3 },
    },
    /*
     * AUDIT-11 §16: sixteen traits, each built from modifier keys that
     * already have a read site. Where the audit's effect names a mechanic
     * with no hook of its own (a voice imitated, a promise that cannot be
     * broken, a hazard read a cycle early) it is approximated by the nearest
     * existing axis, and the info line says only what the mods actually do.
     */
    'Night Owl': {
        info: 'Comes alive after dark. Sharper and quicker at night, and pays for it in the daytime.',
        mods: { awarenessNight: 2, nightMovement: 0.4, ambush: 0.03, fatigueDay: 3 },
    },
    'Salt-Tongued': {
        info: 'Lies easily and is hard to catch at it — and is believed a little less even when telling the truth.',
        mods: { suspicionResist: 0.25, rumourCredibility: -0.2 },
    },
    'Bone-Setter': {
        info: 'Knows how a body goes back together. Field dressings and treatment take far more often.',
        mods: { medicine: 0.25 },
    },
    'Heavy Sleeper': {
        info: 'Sleeps like the dead and wakes rested. Recovers much more at night, and hears much less of it.',
        mods: { fatigueNight: -6, awarenessNight: -2 },
    },
    'Pack Rat': {
        info: 'Keeps everything. Carries one more item than anybody else, and rattles when they walk.',
        mods: { capacity: 1, concealment: -0.05 },
    },
    'Forgets Faces': {
        info: 'Cannot hold on to a face, or a grudge. Regard moves faster in both directions, and old hatreds sharpen them less.',
        mods: { trustGain: 0.3, vengeanceEdge: -1 },
    },
    'Oathkeeper': {
        info: 'Their word is a fixed point. Almost never breaks a promise or an alliance, pays what they owe, and is trusted for it.',
        mods: { treachery: -0.3, betrayalResist: 0.3, debtHonour: 0.4, trustGain: 0.1, charterHold: 0.3 },
    },
    'Glass Jaw': {
        info: 'Goes down to a clean hit and knows it. Frightens easily, and is very good at not being where the hit lands.',
        mods: { fearGain: 0.3, retreat: 0.15 },
    },
    'Firewalker': {
        info: 'Grew up next to heat. Burns and heatstroke land much softer, and the cold gets in faster.',
        mods: { burnResist: 0.45, heatResist: 0.2, coldResist: -0.3 },
    },
    'Wanderlust': {
        info: 'Cannot stay put. Covers more ground, turns up more caches — and is turned up by more people.',
        mods: { scavenge: 0.1, forage: 0.04, targetDraw: 0.5 },
    },
    'Homebody': {
        info: 'Makes a camp and defends it. Builds better shelter and fights harder with somebody beside them, and is slow to leave.',
        mods: { campSkill: 0.15, defended: 0.1, retreat: -0.05 },
    },
    'Mimic': {
        info: 'Can throw a voice or borrow one. Better at drawing people into an ambush, and at holding a room.',
        mods: { ambush: 0.06, persuasion: 0.05, excitement: 0.1 },
    },
    'Cannon-Counter': {
        info: 'Counts every cannon and always knows the number. Steadier in the endgame, and harder to surprise.',
        mods: { awareness: 0.4, resolveDrift: 0.3, odds: 0.2 },
    },
    "Sponsor's Pet": {
        info: 'The Capitol adores them. More parachutes, a warmer sponsor line — and allies who notice.',
        mods: { sponsorAppeal: 1.5, sponsorTrust: 0.5, trustGain: -0.15 },
    },
    'Twitchy Trigger': {
        info: 'Swings first, every time. Quicker into a fight and quicker to strike from cover, and harder to stop once started.',
        mods: { aggressionScore: 0.6, ambush: 0.05, retreat: -0.1, treachery: 0.05 },
    },
    'Weather-Nose': {
        info: 'Smells the weather coming. Takes less from cold and heat and notices the arena turning before it turns.',
        mods: { coldResist: 0.15, heatResist: 0.15, awareness: 0.3 },
    },
};


/** Everything the reaping can roll. Earned traits are excluded by definition. */
export const ROLLABLE_TRAITS = Object.keys(TRAIT_DEFS).filter(name => !TRAIT_DEFS[name].earned);

/** Every trait name, rollable or earned. */

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

/*
 * AUDIT-9 stage D: named predicates for the five traits added here.
 *
 * `check-predicates` ratchets hard-coded `traits.includes('X')` sites outside
 * this file, and it is right to: a disposition scattered as a string literal
 * across four engine modules is four places to misspell it and no place to
 * document it. These traits are behavioural rather than numeric — the whole
 * point of picking them was that they change a choice rather than a roll — so
 * a `mods` row is not available, and a named predicate is what the check asks
 * for instead. The name is also the explanation.
 */

/** Will not act on a single report; wants a second source. */
export function needsSecondSource(t: { traits: string[] }): boolean {
    return t.traits.includes('Evidence-Hungry');
}

/** Carries the spare and the spare's spare, and is slower out of camp for it. */
export function isOverprepared(t: { traits: string[] }): boolean {
    return t.traits.includes('Overprepared');
}

/** Finds the way out before committing to dangerous ground. */
export function scoutsTheExit(t: { traits: string[] }): boolean {
    return t.traits.includes('Exit-Minded');
}

/** Takes the deal in hand over the promise of a better one. */
export function refusesCredit(t: { traits: string[] }): boolean {
    return t.traits.includes('Bargain-Shy');
}

/** Volunteers for the injured ally and the long way round. */
export function volunteersToCarry(t: { traits: string[] }): boolean {
    return t.traits.includes('Shared-Burden');
}
