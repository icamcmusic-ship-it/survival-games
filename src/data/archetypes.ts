import { ArchetypeId, Attributes, Objective, Stance } from '../models/types';

/**
 * A2: an archetype is a character, not a modifier row.
 *
 * The old shape was four scalars plus a stat bias, which is why the measured
 * win rates clustered so tightly: seven archetypes drawing from the same four
 * dials can only ever differ by degree. The hooks below let an archetype
 * differ in *kind* — who it picks a fight with, how its caution moves across a
 * run, which stances it reaches for, and the one beat per run that makes it
 * recognisable on camera.
 */
export interface ArchetypeDef {
    id: ArchetypeId;
    name: string;
    description: string;
    statBias: Partial<Attributes>;
    preferredTraits: string[];
    // Behavior weights, all roughly -0.3..+0.4 modifiers on base chances
    aggression: number;       // seeks fights (bloodbath, hunting stance)
    allianceAffinity: number; // forms/keeps alliances
    treachery: number;        // betrays alliances
    caution: number;          // avoids dangerous zones, flees when hurt

    // ---- behavioural hooks ----
    /** Direct pull toward or away from particular stances. */
    stanceBias?: Partial<Record<Stance, number>>;
    /** Pull toward particular standing intentions when objectives are chosen. */
    objectiveBias?: Partial<Record<Objective['kind'], number>>;
    /** Who they go for when they have a choice. */
    /*
     * AUDIT-6 §8.2: five values, and eight of twenty-three archetypes picked
     * `weakest` — "goes for whoever is hurt" had become the default rather
     * than a characterisation. Two more, both read off state the engine
     * already keeps:
     *
     *  - `mostWounded` is distinct from `weakest`. `weakest` reads current
     *    health, which a tribute who has never been touched can share with one
     *    who has been patched up four times; `mostWounded` reads the open
     *    wounds and the bleeding, which is what an opportunist actually sees
     *    across a clearing.
     *  - `mostFamous` is the reading no preference had: some tributes pick
     *    their target by who the arena is already talking about. It is the
     *    counterpart to `targetDraw` from the hunter's side.
     */
    targetPreference?: 'weakest' | 'strongest' | 'nearest' | 'richest' | 'rival' | 'mostWounded' | 'mostFamous';
    /**
     * §8: how much the rest of the field wants this archetype dead, on the
     * same hunt-scoring scale as the `targetDraw` trait modifier.
     *
     * Audit 4 §8.3: this was the most interesting column in the table and it
     * had **one entry**. It is the only dial that expresses "the field has
     * decided about you", which is the one pressure a tribute cannot answer by
     * being better at anything — and eleven of the fifteen archetypes have a
     * clear reading of it. Filling it in is also the cheapest lever on the
     * bottom of the win table: the archetypes that cannot fight are precisely
     * the ones nobody should be going out of their way to find.
     *
     * Career measured 9.23% against a 5.0% field at n=1600 — the best win
     * rate, the longest survival AND the most kills, dominant on every axis
     * at once, which meant there was no trade-off left to tune. This is the
     * trade-off: a tribute the whole arena has been told to be afraid of is
     * the one everybody else agrees to deal with first. It is the only
     * weakness that follows from what a Career actually is.
     */
    targetDraw?: number;
    /**
     * How caution moves with the day count. `flat` never wavers, `escalating`
     * gets warier as the field narrows, `front-loaded` spends everything early
     * and settles afterwards, `late-blooming` does the opposite of
     * `front-loaded` — keeps its head down while the field is big and commits
     * once there is little left to hide from.
     *
     * Audit 2 §8.2/§8.3: the first three were all a tribute could be, and
     * between them they could not express "careful early, decisive late" —
     * which is exactly the shape the Ghost needs and cannot have. Ghost has the
     * second-longest survival in the game (4.19 days) and the worst win rate
     * (2.78%): an archetype that outlasts and cannot close. `escalating` makes
     * that worse and `front-loaded` contradicts the character, so there was no
     * row in the table that described it.
     */
    riskCurve?: 'flat' | 'escalating' | 'front-loaded' | 'late-blooming';
    /**
     * The once-per-run archetype beat, keyed into `ARCHETYPE_SIGNATURES` in
     * `engine/archetypeHooks.ts`. Career already effectively had one (the
     * pack); nobody else did, and it is most of what makes an archetype
     * memorable rather than merely statistical.
     */
    signature?: string;
    /** Seeds backstory dislike at the reaping. */
    hatesArchetypes?: ArchetypeId[];
    /**
     * §8 (audit): how much of a frightening thing sticks. 1 is everyone; 0 is
     * the Zealot, for whom the thing they believe is louder than the thing in
     * front of them. This was a hardcoded `archetype === 'zealot'` carve-out
     * in `fear.ts`, the only extreme property on any archetype, with no
     * counterpart for the other extreme-variance ones.
     */
    fearScale?: number;
    /** Sponsor-facing: how the Capitol markets them. */
    tagline?: string;
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
    career: {
        id: 'career',
        name: 'Career',
        description: 'Trained for the Games since childhood. Hunts in packs and dominates the bloodbath.',
        // §7: this used to stack on top of the Career districts' own raw
        // attribute head start (generator.ts) rather than substituting for
        // it, and the `career` archetype itself is what 7-8 out of ~14 total
        // weight in D1/D2 rolls — so most Career-district tributes were
        // getting the district bonus, the archetype bonus, weapon affinity,
        // and the pack numbers bonus all at once. Trimmed here rather than in
        // the district table, since this is the piece that was genuinely
        // redundant with it.
        // §8: and the cost. A Career was fed, housed and drilled by an
        // academy for ten years; nobody ever made them find their own dinner.
        // The negative intelligence bias bites on foraging, water, trap-work,
        // crafting and reading a zone — every part of the run that is not the
        // fight — so the archetype that dominates the bloodbath is the one
        // that struggles once the Cornucopia is picked clean. Deliberately not
        // a combat nerf: the Career should still win the fight it picks.
        /*
         * AUDIT-6 §8.1: Career measured 10.69% at n=1,600 against a 5.0% field
         * — the best win rate, the longest survival (5.72 days against a field
         * around 4.2) AND the most kills (1.22 against 0.55). Dominant on
         * every axis at once means there is nothing left to trade against.
         *
         * Two physical stats compounded: strength feeds combat power and
         * agility feeds both dodging and ambush, so a Career was ahead in the
         * exchange, ahead at starting it, and ahead at leaving it. Keeping the
         * strength and dropping the agility leaves them exactly what they are
         * — the best-fed, best-drilled fighter in the arena — without making
         * them the most slippery one as well.
         */
        statBias: { strength: 1, intelligence: -1 },
        preferredTraits: ['Bloodthirsty', 'Brute'],
        aggression: 0.25,
        allianceAffinity: 0.2,
        /*
         * §8.1: the pack is the Career's whole advantage and, in the source
         * material, its whole problem. At 0.15 it held together almost to the
         * end. The pack should be the reason they dominate the first half and
         * the reason they do not survive the second.
         */
        treachery: 0.3,
        caution: -0.2,
        stanceBias: { Aggressive: 0.6, Hunting: 0.5, Evasive: -0.8 },
        objectiveBias: { hunt: 0.4, hold: 0.2 },
        targetPreference: 'weakest',
        /*
         * §8.1: 5 was not enough. This is the only weakness that follows from
         * what a Career actually is — the whole arena has been told to be
         * afraid of them, so they are who everybody else agrees to deal with
         * first.
         */
        targetDraw: 8,
        riskCurve: 'front-loaded',
        signature: 'careerDeclaration',
        hatesArchetypes: ['underdog', 'ghost'],
        fearScale: 0.8,
        tagline: 'Bred for it.',
    },
    strategist: {
        id: 'strategist',
        name: 'Strategist',
        description: 'Wins with the mind, not the blade. Picks fights only when the odds are stacked.',
        // §8: 3.59% at n=1600, the worst of the fifteen. Counting the board
        // is worth nothing if you cannot leave the fight you counted wrong.
        statBias: { intelligence: 2, charisma: 1, agility: 1 },
        preferredTraits: ['Strategist', 'Eagle-Eyed'],
        aggression: -0.1,
        allianceAffinity: 0.15,
        treachery: 0.25,
        caution: 0.2,
        stanceBias: { Fortified: 0.6, Shadowing: 0.4, Desperate: -0.5 },
        objectiveBias: { hold: 0.4, reach: 0.2 },
        targetPreference: 'weakest',
        riskCurve: 'escalating',
        signature: 'strategistGambit',
        /*
         * AUDIT-6 §8.2: `targetDraw` is the only dial that says "the field has
         * decided about you", and four archetypes still had no reading of it.
         * A Strategist is the tribute everyone suspects of having a plan for
         * them specifically, which is a mild but real reason to be dealt with
         * early.
         */
        targetDraw: 0.5,
        // §8.2: a plan survives contact with anything except somebody who
        // does not have one. The Wildcard is the Strategist's whole problem,
        // and the antipathy already runs the other way.
        hatesArchetypes: ['wildcard', 'beast'],
        tagline: 'Counts the board.',
        // Audit 4 §8.3: Nothing is frightening once it has been priced.
        fearScale: 0.9,
    },
    survivalist: {
        id: 'survivalist',
        name: 'Survivalist',
        description: 'Lives off the land and outlasts everyone. Avoids fights, never starves.',
        statBias: { stealth: 2, intelligence: 1 },
        preferredTraits: ['Tracker', 'Iron Stomach', 'Hydrophilic'],
        aggression: -0.2,
        allianceAffinity: -0.1,
        treachery: -0.1,
        caution: 0.3,
        stanceBias: { Defensive: 0.5, Evasive: 0.3, Scavenging: 0.3 },
        objectiveBias: { reach: 0.3, survive: 0.3 },
                // Audit 2 §8.2: was `nearest`, the null option. A survivalist does not
        // go looking; when the choice is forced, they take the fight they can
        // finish and get back to the business of not being here.
        targetPreference: 'weakest',
                // Audit 2 §8.2: was `flat`. The whole archetype is a downward risk
        // appetite as the odds shorten.
        riskCurve: 'escalating',
        signature: 'survivalistLarder',
        // §8.2: the two archetypes who take without growing. A Survivalist
        // who has spent a week learning which roots are safe has a specific
        // contempt for whoever eats out of a dead tribute's pack.
        hatesArchetypes: ['scavenger'],
        tagline: 'Outlasts the arena.',
        // Audit 4 §8.3: Nobody is frightened of somebody who has never come for them.
        targetDraw: -0.5,
        // Audit 4 §8.3: Familiarity. Most of what frightens the field is weather to them.
        fearScale: 0.85,
    },
    protector: {
        id: 'protector',
        name: 'Protector',
        description: 'Fights hardest for others. Loyal to a fault and beloved by sponsors.',
        statBias: { strength: 1, charisma: 1 },
        preferredTraits: ['Pacifist', 'Charismatic'],
        aggression: -0.05,
        allianceAffinity: 0.35,
        treachery: -0.3,
        caution: 0.05,
        stanceBias: { Defensive: 0.7, Fortified: 0.4 },
        objectiveBias: { protect: 0.6 },
        // Whoever is nearest their ward. 'strongest' had them hunting the
        // single most dangerous tribute in the arena, at odds with every
        // other number on this sheet.
                // Audit 2 §8.2: was `nearest`. A protector picks the biggest thing in
        // the room, because that is the thing their ward cannot survive.
        targetPreference: 'strongest',
                // Audit 2 §8.2: was `flat`. Every day that passes is a day their ward
        // is closer to being the one left.
        riskCurve: 'escalating',
        signature: 'protectorStand',
        hatesArchetypes: ['saboteur', 'mercenary'],
        tagline: 'Stands in front.',
        // Audit 4 §8.3: Standing between people and the thing coming for them is a way of volunteering.
        targetDraw: 1.0,
        // Audit 4 §8.3: Frightened for other people as well as themselves, which is more of it, not less.
        fearScale: 1.2,
    },
    trickster: {
        id: 'trickster',
        name: 'Trickster',
        description: 'Traps, ambushes, and broken promises. Nobody sees them coming — twice.',
        statBias: { stealth: 1, agility: 1, intelligence: 1 },
        preferredTraits: ['Pyromaniac', 'Nimble', 'Paranoid'],
        aggression: 0.15,
        allianceAffinity: 0.1,
        treachery: 0.35,
        caution: 0.1,
        stanceBias: { Shadowing: 0.6, Fortified: 0.4, Aggressive: -0.2 },
        // Audit 3 §3.3: a Trickster watches before they spring anything.
        objectiveBias: { hold: 0.3, hunt: 0.2, stalk: 0.3 },
        targetPreference: 'richest',
        riskCurve: 'escalating',
        signature: 'tricksterSnare',
        // §8.2: the field learns after the first snare. Being known as the
        // one who cheats is worth being looked for.
        targetDraw: 1.0,
        // §8.2: the Tracker is the one kind of tribute a trick does not work
        // on twice.
        hatesArchetypes: ['tracker'],
        tagline: 'Nobody sees them twice.',
        fearScale: 1.0,
    },
    wildcard: {
        id: 'wildcard',
        name: 'Wildcard',
        description: 'Unpredictable and volatile. Even the Gamemakers cannot model their next move.',
        statBias: { agility: 1 },
        preferredTraits: ['Insomniac', 'Clumsy', 'Pyromaniac'],
        aggression: 0.2,
        allianceAffinity: 0.0,
        treachery: 0.2,
        caution: -0.1,
        stanceBias: { Desperate: 0.6, Aggressive: 0.3, Fortified: -0.4 },
        // The only archetype with no objective bias and no declared social
        // relationships. Volatile: pulled toward both the fight and the exit.
        objectiveBias: { hunt: 0.2, flee: 0.2 },
        targetPreference: 'nearest',
        riskCurve: 'flat',
        signature: 'wildcardTurn',
        hatesArchetypes: ['strategist'],
        // §8.2: nobody hunts a Wildcard on purpose, because nobody can
        // predict where they will be. The only archetype whose unreadability
        // is a defence.
        targetDraw: -1.0,
        fearScale: 0.7,
        tagline: 'Unmodellable.',
    },
    underdog: {
        id: 'underdog',
        name: 'Underdog',
        description: 'Overlooked and underestimated. Survives on grit, luck, and the crowd\'s sympathy.',
        statBias: { charisma: 1, stealth: 1 },
        preferredTraits: ['Light Sleeper', 'Nimble', 'Scavenger', 'Skittish'],
        aggression: -0.15,
        allianceAffinity: 0.2,
        treachery: -0.15,
        caution: 0.25,
        /*
         * AUDIT-6 §8.1/§3.1: the worst-performing common archetype at 2.86%,
         * and the reason was visible in this line. Half its stance investment
         * went into `Scavenging`, which is 1.6% of all tribute-time — the
         * archetype's identity was spent on a stance it almost never got to
         * hold. Kept, because scavenging *is* what an Underdog does, but no
         * longer the largest share.
         */
        stanceBias: { Evasive: 0.4, Scavenging: 0.3, Shadowing: 0.2, Desperate: 0.3 },
        objectiveBias: { survive: 0.3, flee: 0.2 },
        // The one target-preference no archetype used: an underdog does not pick
        // fights by the odds, they pick the one person who has earned it.
        targetPreference: 'rival',
        /*
         * §8.1: `escalating` gets warier as the field narrows, which is the
         * exact opposite of what an Underdog run has to do. The convergence
         * closes the arena to one sector and forces a fight; a tribute whose
         * caution is still climbing at that point cannot close, which is how
         * an archetype built on grit ended up with the lowest win rate in the
         * game. `late-blooming` is the shape the description always described:
         * head down while the field is big, committed once there is little
         * left to hide from.
         */
        riskCurve: 'late-blooming',
        signature: 'underdogRefusal',
        hatesArchetypes: ['career'],
        tagline: 'Written off.',
        // Audit 4 §8.3: Overlooked is the entire premise; the field spends its attention elsewhere.
        targetDraw: -1.5,
        // Audit 4 §8.3: Nobody has ever told them they would be fine.
        fearScale: 1.1,
    },

    // ---- A2: eight archetypes built on the hooks rather than the scalars ----

    mercenary: {
        id: 'mercenary',
        name: 'Mercenary',
        description: 'Allies for payment, not affection. Charges a price to stand with you, and leaves the cycle the cache runs dry.',
        statBias: { strength: 1, charisma: 1 },
        preferredTraits: ['Brute', 'Charismatic'],
        aggression: 0.15,
        allianceAffinity: 0.25,
        treachery: 0.3,
        caution: 0.0,
        stanceBias: { Scavenging: 0.5, Aggressive: 0.3 },
        objectiveBias: { hunt: 0.2, reach: 0.2 },
        // §8.2: a contract is worth what the name is worth. A Mercenary goes
        // where the reputation is.
        targetPreference: 'mostFamous',
                // Audit 2 §8.2: was `flat`. A contract is worth most while there is
        // still a field to be paid by; they spend early and coast, which is
        // also why they die fastest.
        riskCurve: 'front-loaded',
        signature: 'mercenaryContract',
        hatesArchetypes: ['zealot', 'protector'],
        tagline: 'Everything has a price.',
        // Audit 4 §8.3: Carries whatever they were last paid, and everybody watched them take it.
        targetDraw: 1.5,
        // Audit 4 §8.3: Professional distance — this is a job, and they have had worse clients.
        fearScale: 0.8,
    },
    zealot: {
        id: 'zealot',
        name: 'Zealot',
        description: 'Believes the Games mean something. Does not frighten, does not break, and does not stop.',
        // Audit 3 §8.2: the Zealot had the highest risk tolerance in the game
        // (aggression 0.3 against a caution of -0.3, and `fearScale: 0` so it
        // never breaks off) on the second-smallest attribute budget — two
        // points, where the Beast charges just as hard on three. It charged
        // harder than anything else in the arena with less to charge with, and
        // it showed: 2.92 days, the shortest life of any archetype, and a
        // 2.16% win rate.
        //
        // The fix is not to make it careful — not stopping is the whole
        // character. It is to pay for the conviction with the attribute the
        // conviction is made of. `willpower` is how steeply resolve falls and
        // how much fear and grief land, and the archetype whose description is
        // "does not frighten, does not break" had none of it.
        statBias: { strength: 1, charisma: 1, willpower: 1 },
        preferredTraits: ['Bloodthirsty', 'Charismatic', 'Sworn', 'Stoic'],
        aggression: 0.3,
        allianceAffinity: -0.05,
        treachery: -0.1,
        caution: -0.3,
        // Audit 3 §8.2: `Desperate: 0.8` was the largest single stance bias on
        // any archetype and it was pointed backwards. Desperate is the stance
        // of somebody who has come apart — the emergency that "holds for
        // nothing" — which is the precise opposite of a tribute who does not
        // break. Kept positive, because a Zealot does end up there, and cut to
        // below the Aggressive bias, because that is the stance they mean.
        stanceBias: { Aggressive: 0.6, Desperate: 0.3, Evasive: -1.2 },
        objectiveBias: { hunt: 0.4 },
        targetPreference: 'strongest',
        riskCurve: 'flat',
        signature: 'zealotSermon',
        hatesArchetypes: ['mercenary', 'ghost'],
        fearScale: 0,
        tagline: 'It means something.',
        // Audit 4 §8.3: Loud, certain and unignorable. Nobody wants to be near it when it goes.
        targetDraw: 1.0,
    },
    medic: {
        id: 'medic',
        name: 'Medic',
        description: 'The reason an alliance holds together. Doubles field-dressing for the people around them; terrible alone.',
        statBias: { intelligence: 2, charisma: 1 },
        preferredTraits: ['Herbalist', 'Charismatic', 'Softhearted', 'Steadfast'],
        aggression: -0.25,
        allianceAffinity: 0.4,
        treachery: -0.35,
        caution: 0.2,
        stanceBias: { Defensive: 0.8, Fortified: 0.3, Aggressive: -0.6 },
        objectiveBias: { protect: 0.5, hold: 0.2 },
                // Audit 2 §8.2: was `nearest`. A medic fights only what they must, and
        // only what they can end quickly.
        targetPreference: 'weakest',
        /*
         * Audit 3 §8.2: was `escalating`, which is the wrong shape for this
         * archetype and is the same diagnosis the Ghost got two audits ago.
         *
         * The Medic has the longest survival of any archetype outside the top
         * three (4.00 days) and the second-lowest kill count (0.38): it lasts
         * and it cannot close, which `escalating` — a steady drift toward
         * boldness — does nothing about, because a steady drift from
         * `aggression: -0.25` never arrives anywhere. `late-blooming` is the
         * curve that exists for exactly this: careful while there is a field to
         * be careful of, decisive once there is not. It took the Ghost from
         * 2.78% to a healthy 5.21%, and a medic's whole case for winning is
         * that they are still standing and whole when everybody else is not.
         */
        riskCurve: 'late-blooming',
        signature: 'medicTriage',
        // §8.2: a Medic's objection is not to violence in general. It is to
        // the people who make more work.
        hatesArchetypes: ['beast', 'captor'],
        tagline: 'Keeps them standing.',
        // Audit 4 §8.3: Killing the person keeping everybody alive is a decision most fields put off.
        targetDraw: -1.0,
        // Audit 4 §8.3: They have seen what the thing in front of them does to a body, in detail.
        fearScale: 1.1,
    },
    saboteur: {
        id: 'saboteur',
        name: 'Saboteur',
        description: 'Does not fight. Poisons caches, springs other people\'s traps, and takes the bridge out behind them.',
        statBias: { intelligence: 2, stealth: 1 },
        preferredTraits: ['Pyromaniac', 'Paranoid', 'Trapper', 'Chameleon'],
        aggression: -0.1,
        allianceAffinity: -0.05,
        treachery: 0.3,
        caution: 0.2,
        stanceBias: { Fortified: 0.7, Shadowing: 0.5, Aggressive: -0.7 },
        // Audit 3 §3.3: a Saboteur is somebody who watches what other people
        // do and then breaks it, which is a stalk followed by a plan.
        objectiveBias: { hold: 0.4, stalk: 0.3 },
        targetPreference: 'richest',
                // Audit 2 §8.2: was `flat`. Somebody who works from cover has less
        // cover every day.
        riskCurve: 'escalating',
        signature: 'saboteurStrike',
        hatesArchetypes: ['career'],
        // §8.2: a Saboteur is not feared until the cache is found poisoned,
        // and then they are the first name on everybody's list.
        targetDraw: 1.0,
        tagline: 'Breaks the board, not the pieces.',
        // Audit 4 §8.3: They are rarely the one in the room when it happens.
        fearScale: 0.9,
    },
    beast: {
        id: 'beast',
        name: 'Beast',
        // §8: the worst archetype in the game at 2.0%, below the regression
        // guard. It is meant to be a tribute who needs nobody, and it was
        // built as one — `allianceAffinity: -0.4` and `caution: -0.25` — but
        // with nothing to survive alone *on*. A body that keeps going is what
        // makes solitude playable, so the bias now buys endurance rather than
        // only reach.
        description: 'A tribute the arena made rather than a district. Unarmed and terrifying; no capacity for company at all.',
        statBias: { strength: 3, endurance: 2, intelligence: -2 },
        preferredTraits: ['Brute', 'Bloodthirsty'],
        aggression: 0.35,
        allianceAffinity: -0.4,
        treachery: 0.1,
        // §8: `caution: -0.25` on top of a front-loaded risk curve and a -0.6
        // Defensive bias made this a tribute that ran at the first thing it
        // saw and was dead by day 2.6 — the shortest life and the lowest win
        // rate of any archetype, under the regression guard. An animal is not
        // reckless; it is unsociable. It keeps every bit of that, and stops
        // being unable to back off a fight it is losing.
        caution: -0.05,
        stanceBias: { Aggressive: 0.7, Hunting: 0.5, Desperate: 0.5, Defensive: -0.2 },
        objectiveBias: { hunt: 0.5 },
        // §8.2: blood in the water. The Beast reads injury, not strength.
        targetPreference: 'mostWounded',
        riskCurve: 'front-loaded',
        signature: 'beastRoar',
        fearScale: 0.5,
        // §8.2: everything that talks first.
        hatesArchetypes: ['diplomat', 'confessor'],
        tagline: 'Underestimated on paper.',
        // Audit 4 §8.3: A tribute the arena made. Everybody left alive has already decided this one is the problem.
        targetDraw: 2.5,
    },
    diplomat: {
        id: 'diplomat',
        name: 'Diplomat',
        description: 'Talks people out of it. Brokers truces between others as easily as for themselves — and their death dissolves every one of them.',
        statBias: { charisma: 3, intelligence: 1 },
        preferredTraits: ['Charismatic', 'Strategist'],
        aggression: -0.25,
        allianceAffinity: 0.35,
        treachery: -0.05,
        caution: 0.2,
        stanceBias: { Defensive: 0.6, Evasive: 0.2, Aggressive: -0.6 },
        objectiveBias: { protect: 0.3, reach: 0.2 },
                // Audit 2 §8.2: was `nearest`. The one person a diplomat will raise a
        // hand to is the one they have already failed to talk round.
        targetPreference: 'rival',
        riskCurve: 'escalating',
        signature: 'diplomatAccord',
        hatesArchetypes: ['zealot'],
        tagline: 'Nobody has to die today.',
        // Audit 4 §8.3: Hard to justify to a group that has been talking to them all week.
        targetDraw: -0.5,
        fearScale: 1.0,
    },
    scholar: {
        id: 'scholar',
        name: 'Scholar',
        description: 'Reads the arena rather than the tributes. Knows what a zone is about to do a cycle before it does it.',
        // §8: 3.65% at n=1600. Reading the arena a cycle early is only worth
        // something if you are not standing in the open while you do it.
        statBias: { intelligence: 3, stealth: 1 },
        // Audit 5 §8.2: four related traits reads as a character; two reads as a stat line.
        preferredTraits: ['Strategist', 'Eagle-Eyed', 'Herbalist', 'Cool-Headed', 'Tracker'],
        aggression: -0.2,
        allianceAffinity: 0.1,
        treachery: 0.05,
        caution: 0.25,
        stanceBias: { Defensive: 0.4, Evasive: 0.3, Scavenging: 0.3 },
        // Audit 3 §3.3: a Scholar's whole method is watching something for long
        // enough to understand it, which is what a stalk is.
        objectiveBias: { reach: 0.4, stalk: 0.25 },
        targetPreference: 'weakest',
                // Audit 2 §8.2: was `flat`. The point of the archetype is that it
        // updates — and what it updates *toward* is confidence, not caution. A
        // scholar who has spent six days reading the arena knows more about it
        // than anyone else left alive, and that is the moment to use it.
        riskCurve: 'late-blooming',
        signature: 'scholarReading',
        // §8.2: a Scholar reads the arena; a Saboteur edits it while they are
        // reading. Nothing is more annoying.
        hatesArchetypes: ['saboteur'],
        tagline: 'Reads the arena.',
        // Audit 4 §8.3: Reads as harmless, and is right up until the arena does what they said it would.
        targetDraw: -1.5,
        // Audit 4 §8.3: They worked out what this place does days ago; being right is steadying.
        fearScale: 0.8,
    },
    ghost: {
        id: 'ghost',
        name: 'Ghost',
        description: 'Never seen. The crowd cannot love what it cannot find, and the Gamemakers hate that more than anything.',
        statBias: { stealth: 3, agility: 1 },
        preferredTraits: ['Unremarkable', 'Nimble'],
        aggression: -0.3,
        allianceAffinity: -0.25,
        treachery: 0.0,
        caution: 0.35,
        stanceBias: { Evasive: 0.8, Shadowing: 0.9, Aggressive: -1.0 },
        // Audit 3 §3.3: the archetype with a 0.9 Shadowing stance bias had no
        // stalk objective bias at all — the stance and the intention it exists
        // to express were not connected.
        objectiveBias: { survive: 0.4, stalk: 0.4 },
        targetPreference: 'weakest',
                // Audit 2 §8.3: was `flat`, and Ghost has the second-longest survival
        // in the game on the worst win rate — an archetype that outlasts and
        // cannot close. `late-blooming` is the shape the table did not have:
        // keep your head down while the field is big, and commit once there is
        // little left to hide from.
        riskCurve: 'late-blooming',
        signature: 'ghostNaming',
        hatesArchetypes: ['career'],
        tagline: 'Nobody has footage.',
        // Audit 4 §8.3: The whole archetype is not being on anybody's list.
        targetDraw: -2.5,
        // Audit 4 §8.3: Fear is the instrument: it is what keeps them moving and unseen.
        fearScale: 1.2,
    },

    // ---- Audit 5 §12.4 ----
    scavenger: {
        id: 'scavenger',
        name: 'Scavenger',
        description: 'Arrives second. Follows the cannons rather than causing them, and is never short of anything.',
        statBias: { intelligence: 1, stealth: 2 },
        preferredTraits: ['Scavenger', 'Hoarder', 'Quartermaster', 'Iron Stomach'],
        aggression: -0.15,
        allianceAffinity: 0.0,
        treachery: 0.15,
        caution: 0.3,
        stanceBias: { Scavenging: 1.2, Evasive: 0.3, Aggressive: -0.6 },
        objectiveBias: { reach: 0.5, survive: 0.3 },
        targetPreference: 'richest',
        riskCurve: 'late-blooming',
        signature: 'scavengerClaim',
        hatesArchetypes: ['beast'],
        // §8.2: a Scavenger has watched more deaths up close than anybody and has
        // built a working relationship with the fact. Fear lands; less of it stays.
        fearScale: 0.8,
        tagline: 'Waste is for people with sponsors.',
        targetDraw: -0.5,
    },
    captor: {
        id: 'captor',
        name: 'Captor',
        description: 'Keeps somebody alive because they are worth something. The most dangerous ally in the arena.',
        statBias: { charisma: 2, strength: 1 },
        preferredTraits: ['Silver-Tongued', 'Broker', 'Treacherous', 'Cool-Headed'],
        aggression: 0.1,
        allianceAffinity: 0.35,
        treachery: 0.45,
        caution: 0.05,
        stanceBias: { Defensive: 0.4, Hunting: 0.3 },
        objectiveBias: { protect: 0.3, hunt: 0.2 },
        targetPreference: 'weakest',
        riskCurve: 'flat',
        signature: 'captorLeverage',
        hatesArchetypes: ['protector', 'diplomat'],
        // §8.2: a Captor's whole method is being the calmest person in the room
        // while somebody else is not. They do not frighten easily and it is not
        // bravery.
        fearScale: 0.7,
        tagline: 'You are worth more to me breathing.',
        targetDraw: 1.0,
    },
    bellwether: {
        id: 'bellwether',
        name: 'Bellwether',
        description: 'Picks the ground and makes everybody else come to it. Holds the one place in the arena worth holding.',
        statBias: { strength: 1, endurance: 2 },
        preferredTraits: ['Steadfast', 'Trapper', 'Sure-Footed', 'Stoic'],
        aggression: 0.05,
        allianceAffinity: 0.25,
        treachery: -0.1,
        caution: 0.15,
        stanceBias: { Fortified: 1.2, Defensive: 0.5, Evasive: -0.4 },
        objectiveBias: { hold: 0.7 },
        // §8.2: holding the ground only means something if the person you take
        // it from is somebody the arena has heard of.
        targetPreference: 'mostFamous',
        riskCurve: 'escalating',
        signature: 'bellwetherHold',
        hatesArchetypes: ['career', 'trickster'],
        // §8.2: standing on ground you chose is the cure for being afraid of it.
        fearScale: 0.85,
        tagline: 'This is where it happens.',
        targetDraw: 1.5,
    },
    quartermaster: {
        id: 'quartermaster',
        name: 'Quartermaster',
        description: 'Wins the week rather than the fight. Carries more, wastes nothing, and is always the one who still has water on day six.',
        statBias: { intelligence: 2, endurance: 1 },
        preferredTraits: ['Hoarder', 'Quartermaster', 'Iron Stomach', 'Scavenger'],
        aggression: -0.2,
        allianceAffinity: 0.3,
        treachery: -0.05,
        caution: 0.25,
        stanceBias: { Fortified: 0.7, Defensive: 0.5, Scavenging: 0.6, Aggressive: -0.7 },
        objectiveBias: { survive: 0.4, hold: 0.3 },
        targetPreference: 'richest',
        riskCurve: 'escalating',
        signature: 'quartermasterInventory',
        hatesArchetypes: ['scavenger'],
        // §8.2: the one who counts the water is the one who knows exactly how
        // bad it is. Nobody is more frightened, and nobody hides it better.
        fearScale: 1.15,
        tagline: 'Everything, accounted for.',
        targetDraw: -0.5,
    },
    martyr: {
        id: 'martyr',
        name: 'Martyr',
        description: 'Intends to be the reason somebody else gets out. The most dangerous ally to be standing beside and the safest to be standing behind.',
        statBias: { endurance: 2, willpower: 2 },
        preferredTraits: ['Softhearted', 'Steadfast', 'Loyal', 'Pacifist'],
        aggression: -0.1,
        allianceAffinity: 0.5,
        treachery: -0.4,
        /*
         * AUDIT-6 §8.1: a Martyr has to still be alive to be standing in front
         * of somebody. At -0.15 they died on day 3.86, which is before most of
         * the run's protect beats exist to be taken — the archetype was
         * spending itself before it had anybody to spend itself on.
         */
        caution: 0.05,
        stanceBias: { Nursing: 1.2, Defensive: 0.6, Evasive: -0.5 },
        objectiveBias: { protect: 0.8 },
        /*
         * AUDIT-6 §8.1: `strongest` with `aggression: -0.1` meant a Martyr
         * picked the one fight they could not win and then declined to start
         * it. `mostWounded` is the truer reading and the one the description
         * already gives: a Martyr does not go looking for the biggest tribute
         * in the arena, they put themselves between an ally and whoever is
         * about to finish them — which is nearly always somebody already hurt.
         */
        targetPreference: 'mostWounded',
        riskCurve: 'front-loaded',
        signature: 'martyrOffer',
        hatesArchetypes: ['captor', 'mercenary'],
        tagline: 'Not them.',
        targetDraw: -1,
        fearScale: 0.6,
    },
    opportunist: {
        id: 'opportunist',
        name: 'Opportunist',
        description: 'Has no plan and does not need one. Takes whatever the last ten minutes just made available, and is never where they were.',
        statBias: { agility: 2, stealth: 1 },
        preferredTraits: ['Nimble', 'Treacherous', 'Silver-Tongued', 'Unlucky'],
        aggression: 0.1,
        allianceAffinity: 0.05,
        treachery: 0.4,
        caution: 0.1,
        stanceBias: { Scavenging: 0.8, Shadowing: 0.6, Fortified: -0.8 },
        objectiveBias: { reach: 0.4, stalk: 0.3 },
        // §8.2: an Opportunist does not pick the weakest — they pick whoever is
        // visibly coming apart in front of them right now.
        targetPreference: 'mostWounded',
        riskCurve: 'flat',
        signature: 'opportunistTurn',
        hatesArchetypes: ['bellwether'],
        // §8.2: fear is information, and an Opportunist acts on information
        // faster than anyone. They are afraid and it makes them quicker.
        fearScale: 1.1,
        tagline: 'Something will come up.',
        targetDraw: 0.5,
    },
    tracker: {
        id: 'tracker',
        name: 'Tracker',
        description: 'Reads the ground. Knows who went which way and how long ago, and is the only kind of tribute a hiding place does not save you from.',
        statBias: { intelligence: 1, stealth: 2 },
        preferredTraits: ['Tracker', 'Eagle-Eyed', 'Sure-Footed', 'Trapwise'],
        aggression: 0.15,
        allianceAffinity: -0.1,
        treachery: 0.05,
        caution: 0.1,
        stanceBias: { Hunting: 1.0, Shadowing: 0.7, Patrolling: 0.5 },
        objectiveBias: { hunt: 0.5, stalk: 0.4 },
        // §8.2: a Tracker follows the trail everyone is talking about, because
        // that is the one worth following.
        targetPreference: 'mostFamous',
        riskCurve: 'late-blooming',
        signature: 'trackerRead',
        hatesArchetypes: ['ghost'],
        // §8.2: a Tracker knows precisely where everybody is, which is the
        // difference between dread and a map.
        fearScale: 0.8,
        tagline: 'You went that way.',
        targetDraw: 1.5,
    },
    confessor: {
        id: 'confessor',
        name: 'Confessor',
        description: 'Wins by being the person nobody can justify killing. Unarmed by choice and never alone for long.',
        /*
         * AUDIT-6 §8.1: three points of charisma and nothing else was the whole
         * problem. Charisma buys sponsors, alliances and the plea below — none
         * of which is any use in the fight the convergence forces on everybody
         * — so the Confessor reliably reached the endgame (4.7 days, third
         * longest in the game) and reliably lost it, at 2.4% the worst win rate
         * on the board.
         *
         * The willpower is not a combat stat either, and that is the point: it
         * is what keeps them upright and deciding when the resolve system would
         * otherwise have them put their weapons down. The archetype still
         * cannot fight. It can now still be standing.
         */
        statBias: { charisma: 3, willpower: 2 },
        preferredTraits: ['Pacifist', 'Softhearted', 'Peacemaker', 'Charismatic'],
        aggression: -0.35,
        allianceAffinity: 0.45,
        treachery: -0.3,
        caution: 0.2,
        /*
         * AUDIT-6 §8.1: 2.37%, the lowest in the game, and `Aggressive: -1.2`
         * was why. The convergence drives whoever is left into one sector and
         * makes them settle it; a tribute who is barred from pressing cannot
         * finish, so a Confessor's run ended the same way every time.
         *
         * The refusal is still the character — this is much the strongest
         * negative on the board — but it is now a reluctance rather than a
         * prohibition, and `Desperate` is the release valve. A Confessor who
         * has run out of people to talk to is the most frightening version of
         * themselves, and that is a beat the archetype could never reach.
         */
        stanceBias: { Defensive: 0.6, Aggressive: -0.4, Evasive: 0.2, Desperate: 0.8 },
        objectiveBias: { protect: 0.5, survive: 0.4 },
        targetPreference: 'nearest',
        // §8.1: as with the Underdog — the archetype's whole argument is that
        // it is still standing at the end, so its caution has to come off then.
        riskCurve: 'late-blooming',
        signature: 'confessorPlea',
        hatesArchetypes: ['zealot', 'beast'],
        tagline: 'Nobody wants to be the one who did it.',
        targetDraw: -1.5,
        fearScale: 0.8,
    },
};

/**
 * Archetype weighting by district.
 *
 * This used to be an if/chance cascade — `if (district === 3 && rng.chance(0.4))`
 * — which meant adding a district flavour or a new archetype required editing
 * control flow rather than data. A weight table says the same thing in a form
 * you can extend, read at a glance, and reason about probabilistically.
 */
export type ArchetypeWeights = Partial<Record<ArchetypeId, number>>;

const BASE_WEIGHTS: ArchetypeWeights = {
    /*
     * AUDIT-6 §8.1: the draw was 12.6:1 top to bottom, and that was the single
     * biggest obstacle to balancing anything.
     *
     * Measured across 1,600 complete Games: `career` drew 3,227 entrants and
     * `martyr` drew 210. Eight of the twenty-three archetypes came in under
     * 500 entrants, which is the threshold `metrics.ts` will not render a
     * verdict below — so the whole-field spread reported 2.94x in one audit
     * and 4.35x in the next without a single archetype changing, because the
     * best and worst rows were whichever rare archetype got lucky. A balance
     * table nobody can read is not a balance table.
     *
     * It was also a content problem. At 0.88% of the draw a Martyr appeared in
     * roughly one Games in twelve: a full character sheet — stance bias,
     * objective bias, target preference, risk curve, a once-per-run signature,
     * a tagline, preferred traits — that most players would never meet.
     *
     * So the tiers are gone. Every archetype outside the original seven sits at
     * 0.8, which puts the whole-field draw at 2.8:1 with nothing under 2.5%,
     * and leaves the district tables (below) as the thing that decides who a
     * district actually reaps. The seven keep their 1.0 because they are the
     * faces a Games is *made* of — a field with no survivalist in it does not
     * read as a Reaping — but the gap between "common" and "distinctive" is
     * now a tilt rather than an order of magnitude.
     *
     * The earlier reasoning for keeping this tier low is in the git history and
     * was sound at the time: raising these archetypes diluted the outer
     * districts with archetypes that lost more often, which pushed Career
     * victors up against their guard. That is addressed at the source in this
     * same change — the weakest archetypes get the `targetDraw`, `fearScale`
     * and `hatesArchetypes` columns they were missing, and Career's all-axis
     * dominance is trimmed — rather than by keeping them rare enough not to
     * matter.
     */
    strategist: 1,
    survivalist: 1,
    protector: 1,
    trickster: 1,
    wildcard: 1,
    underdog: 1,
    /*
     * `career` is deliberately absent, as it always has been: it has no
     * baseline at all and exists only where `DISTRICT_ARCHETYPE_WEIGHTS` says a
     * district trains for it. That is what stops District 9 reaping a Career,
     * and it is load-bearing — adding a base weight here put career at the top
     * of the whole-field draw at 9.1%, which is not what a Career is.
     */
    mercenary: 0.8,
    zealot: 0.8,
    medic: 0.8,
    saboteur: 0.8,
    beast: 0.8,
    diplomat: 0.8,
    scholar: 0.8,
    ghost: 0.8,
    scavenger: 0.8,
    captor: 0.8,
    bellwether: 0.8,
    confessor: 0.8,
    quartermaster: 0.8,
    martyr: 0.8,
    opportunist: 0.8,
    tracker: 0.8,
};

/** Career districts train for it; everyone else is shaped by their industry. */
export const DISTRICT_ARCHETYPE_WEIGHTS: Record<number, ArchetypeWeights> = {
    1:  { career: 7, trickster: 1.5, strategist: 1, diplomat: 1.2 },
    2:  { career: 8, protector: 1.5, wildcard: 1, zealot: 1.5 },
    3:  { strategist: 4, trickster: 2, underdog: 1.5, saboteur: 1.5, scholar: 1.5 },
    4:  { career: 6, survivalist: 2, protector: 1.5, medic: 1.2 },
    5:  { strategist: 2.5, trickster: 2, wildcard: 1.5, mercenary: 1.5, scholar: 1.5 },
    6:  { wildcard: 2.5, underdog: 2, trickster: 1.5, mercenary: 1.5, ghost: 1.5 },
    7:  { protector: 2.5, survivalist: 2, wildcard: 1.5, beast: 1.2 },
    8:  { underdog: 2.5, trickster: 2, protector: 1.5, saboteur: 1.5 },
    9:  { survivalist: 2.5, underdog: 2, protector: 1.5, ghost: 1.5 },
    10: { protector: 2.5, survivalist: 2, wildcard: 1.5, beast: 1.2 },
    11: { survivalist: 3.5, underdog: 2.5, protector: 1.5, zealot: 1.2, medic: 1.5 },
    12: { survivalist: 3, underdog: 3, trickster: 1.5, diplomat: 1.2, ghost: 1.5 },
    // §1.1: the expanded Games. Districts 13-16 previously had no entry at all,
    // so they fell through to the bare baseline and could never roll a Career
    // — a documented, slider-reachable configuration with an unwritten cast.
    13: { survivalist: 3, saboteur: 2.5, strategist: 2, scholar: 1.5 },
    14: { career: 3, mercenary: 2.5, wildcard: 2, beast: 1.2 },
    15: { protector: 2.5, medic: 2, underdog: 2, zealot: 1.5 },
    16: { ghost: 2.5, trickster: 2, survivalist: 2, diplomat: 1.5 },
};

/**
 * A2: the shape of the year itself pulls on the draw.
 *
 * A "Career-heavy" Games and a "no-pack" Games drew identical archetype mixes
 * before this, which made the cast-shape flag a label on the profile card
 * rather than something the reader could see in the roster.
 */
export const CAST_SHAPE_ARCHETYPE_WEIGHTS: Record<string, ArchetypeWeights> = {
    'career-heavy': { career: 3, zealot: 1, mercenary: 0.8, ghost: -0.2 },
    'outer-districts': { career: -6, underdog: 1.5, ghost: 1.2, survivalist: 1, saboteur: 0.8 },
    'young-field': { underdog: 2, ghost: 1, protector: 1, beast: -0.15 },
    'veteran-field': { strategist: 1.5, scholar: 1.2, mercenary: 1, career: 1 },
    'all-volunteer': { career: 2, zealot: 1.5, protector: 1.2 },
    'bonded-pairs': { protector: 1.5, medic: 1.2, diplomat: 1 },
    'victors-field': { strategist: 1.5, career: 1.5, scholar: 1, beast: 0.5 },
};

/**
 * Merged weights for a district, with the shared baseline underneath and the
 * year's cast shape on top.
 */
export function archetypeWeightsFor(district: number, castShape?: string): Array<[ArchetypeId, number]> {
    const merged: ArchetypeWeights = { ...BASE_WEIGHTS };
    const layer = (weights: ArchetypeWeights) => {
        (Object.entries(weights) as Array<[ArchetypeId, number]>).forEach(([id, w]) => {
            merged[id] = (merged[id] ?? 0) + w;
        });
    };
    layer(DISTRICT_ARCHETYPE_WEIGHTS[district] || {});
    if (castShape && CAST_SHAPE_ARCHETYPE_WEIGHTS[castShape]) layer(CAST_SHAPE_ARCHETYPE_WEIGHTS[castShape]);
    // A cast shape that *excludes* an archetype excludes it. Expressed as a
    // large negative weight, 'outer-districts' still reaped Careers from
    // District 2 (8 - 6 = 2 survived the filter).
    (castShape && CAST_SHAPE_EXCLUDES[castShape] ? CAST_SHAPE_EXCLUDES[castShape] : []).forEach(id => { delete merged[id]; });
    return (Object.entries(merged) as Array<[ArchetypeId, number]>).filter(([, w]) => w > 0);
}

/** Archetypes a cast shape rules out entirely, whatever the district weights say. */
export const CAST_SHAPE_EXCLUDES: Record<string, ArchetypeId[]> = {
    'outer-districts': ['career'],
};

// Pairs that get a bonus when considering an alliance
const COMPATIBLE: Array<[ArchetypeId, ArchetypeId]> = [
    ['career', 'career'],
    ['protector', 'underdog'],
    ['strategist', 'trickster'],
    ['survivalist', 'survivalist'],
    ['protector', 'protector'],
    ['strategist', 'protector'],
    // A2: the new roster's natural pairings. A Medic is the reason an alliance
    // holds; a Diplomat is the reason it forms in the first place.
    ['medic', 'protector'],
    ['medic', 'underdog'],
    ['medic', 'diplomat'],
    ['diplomat', 'protector'],
    ['diplomat', 'scholar'],
    ['scholar', 'strategist'],
    ['wildcard', 'trickster'],
    ['wildcard', 'beast'],
    ['saboteur', 'trickster'],
    ['mercenary', 'career'],
    ['zealot', 'career'],
    ['ghost', 'survivalist'],
];

export function archetypeCompatibility(a: ArchetypeId, b: ArchetypeId): number {
    if (COMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 0.15;
    // Declared antipathy is the mirror of it: two archetypes who read each
    // other wrong before they have exchanged a word. Seeds the training-floor
    // altercations (A4) as well as the alliance roll.
    if ((ARCHETYPES[a].hatesArchetypes ?? []).includes(b)
        || (ARCHETYPES[b].hatesArchetypes ?? []).includes(a)) return -0.2;
    return 0;
}

/** True when the two archetypes have a reason to dislike each other on sight. */
export function archetypeAntipathy(a: ArchetypeId, b: ArchetypeId): boolean {
    return (ARCHETYPES[a]?.hatesArchetypes ?? []).includes(b)
        || (ARCHETYPES[b]?.hatesArchetypes ?? []).includes(a);
}
