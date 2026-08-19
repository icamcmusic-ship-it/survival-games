export const WEAPON_KILL_TEMPLATES: Record<string, string[]> = {
    'sword': [
        "{killer} decapitates {victim} with a swift sword strike.",
        "{killer} runs {victim} through with their sword.",
        "{killer} wins a brutal sword duel against {victim}.",
        "{killer} disarms {victim} and delivers a fatal sword thrust.",
        "{killer} slashes {victim}'s chest open with a heavy broadsword."
    ],
    'bow': [
        "{killer} shoots {victim} through the heart from a distance.",
        "{killer} pins {victim} to a tree with an arrow.",
        "{victim} is struck by {killer}'s arrow while trying to flee.",
        "{killer} lands a perfect headshot on {victim} from the high ground.",
        "{victim} steps into a clearing and is instantly pierced by {killer}'s arrow."
    ],
    'axe': [
        "{killer} cleaves {victim}'s skull with an axe.",
        "{killer} buries their axe into {victim}'s chest.",
        "{killer} hacks {victim} to pieces.",
        "{killer} swings their axe in a wide arc, fatally wounding {victim}.",
        "{killer} shatters {victim}'s shield and follows through with a deadly axe chop."
    ],
    'knife': [
        "{killer} backstabs {victim} with a knife.",
        "{killer} throws a knife directly into {victim}'s throat.",
        "{killer} overpowers {victim} and slits their throat.",
        "{killer} engages {victim} in close quarters and stabs them repeatedly.",
        "{victim} loses track of {killer}, who drops from a branch with a readied knife."
    ],
    'spear': [
        "{killer} impales {victim} with a spear.",
        "{killer} throws a spear through {victim}'s chest.",
        "{killer} catches {victim} off guard and spears them.",
        "{killer} uses their spear's reach to keep {victim} at bay before delivering a lethal thrust.",
        "{victim} charges blindly into {killer}'s braced spear."
    ],
    'mace': [
        "{killer} crushes {victim}'s skull with a mace.",
        "{killer} shatters {victim}'s ribs with a heavy mace blow.",
        "{killer} bludgeons {victim} to death.",
        "{killer} swings their mace with terrifying force, breaking {victim}'s defenses.",
        "{victim} is knocked to the ground and mercilessly beaten by {killer}."
    ],
    'trident': [
        "{killer} pins {victim} to the ground with a three-pronged trident strike.",
        "{killer} hurls their trident with deadly precision, skewering {victim}.",
        "{killer} sweeps {victim}'s legs and finishes them with a downward trident thrust.",
        "{victim} is cornered against the rocks and impaled on {killer}'s trident."
    ],
    'machete': [
        "{killer} hacks through the undergrowth and cuts {victim} down with a machete.",
        "{killer} slashes {victim} across the chest with a rusted machete.",
        "{killer} ambushes {victim} from the brush, machete flashing.",
        "{victim} blocks the first machete swing, but not the second."
    ],
    'sickle': [
        "{killer} hooks {victim}'s ankle with a sickle and drags them down for the kill.",
        "{killer} opens {victim}'s throat with a wicked sickle slash.",
        "{killer} reaps {victim} like wheat with a curved sickle."
    ],
    'blowgun': [
        "{killer} sends a poisoned dart into {victim}'s neck from the shadows.",
        "{victim} slaps at what they think is an insect bite — {killer}'s dart has already done its work.",
        "{killer} watches from the canopy as their venom-tipped dart drops {victim} mid-stride."
    ],
    'garrote': [
        "{killer} slips a wire garrote around {victim}'s throat in total silence.",
        "{victim} never hears {killer} approach before the wire tightens.",
        "{killer} strangles {victim} with a length of razor wire."
    ],
    'slingshot': [
        "{killer} cracks {victim}'s skull with a stone from their slingshot.",
        "{killer} lands a perfect slingshot strike on {victim}'s temple.",
        "{victim} laughs at {killer}'s slingshot — right up until the stone hits."
    ],
    'unarmed': [
        "{killer} strangles {victim} to death.",
        "{killer} beats {victim} to death with their bare hands.",
        "{killer} snaps {victim}'s neck in a brutal struggle.",
        "{killer} tackles {victim} off a ledge, surviving the fall while {victim} perishes.",
        "{victim} exhausts themselves fighting {killer}, who easily overpowers them."
    ]
};

export const INTERVIEW_SCENARIOS = [
    {
        strategy: "The Star-Crossed Lover",
        success: [
            "{tribute} tells a heartbreaking story about someone waiting back home. Half the front row is in tears.",
            "{tribute} admits, quietly, that there is a person they intend to survive for. The Capitol falls in love on the spot.",
            "{tribute} says one sentence about home and cannot finish it. Caesar lets the silence run, and the crowd adores them for it.",
        ],
        failure: [
            "{tribute} tries to act heartbroken, but it lands as calculated and cheap.",
            "{tribute} reaches for a tragic backstory and fumbles the details. The audience notices.",
            "{tribute} works the sympathy angle so hard that even Caesar looks embarrassed.",
        ],
        charismaBuff: 1,
        trustMultiplier: 1.5
    },
    {
        strategy: "The Ruthless Warrior",
        success: [
            "{tribute} promises a short Games and a lot of blood. The Careers exchange looks.",
            "{tribute} lists exactly how they intend to win. Nobody in the room laughs.",
            "{tribute} answers every question with cold, flat confidence. The betting odds move before the segment ends.",
        ],
        failure: [
            "{tribute} tries to be intimidating and comes off as a try-hard.",
            "{tribute} makes a threat that would land better from someone larger.",
            "{tribute} snarls at the camera. The crowd giggles, which is worse than silence.",
        ],
        charismaBuff: 0,
        trustMultiplier: 1.2
    },
    {
        strategy: "The Humble Underdog",
        success: [
            "{tribute} speaks with plain modesty and real determination. Sponsors love sincerity.",
            "{tribute} says they only want to go home, and means it so obviously that the room quiets.",
            "{tribute} thanks their district by name. The gesture costs nothing and buys everything.",
        ],
        failure: [
            "{tribute} comes across as too small and too soft to see out the first hour.",
            "{tribute} undersells themselves so thoroughly that the sponsors stop taking notes.",
            "{tribute} apologises for being there. The audience quietly writes them off.",
        ],
        charismaBuff: 1,
        trustMultiplier: 1.3
    },
    {
        strategy: "The Mysterious Enigma",
        success: [
            "{tribute} gives short, cryptic answers that leave the audience leaning forward.",
            "{tribute} refuses to explain a single thing about their strategy, and the room cannot look away.",
            "{tribute} answers three questions with four words and somehow wins the segment.",
        ],
        failure: [
            "{tribute} is so quiet that the interview becomes painfully awkward.",
            "{tribute} says almost nothing, and the mystery reads as terror instead of nerve.",
            "{tribute} stares past the camera. Caesar has to fill ninety seconds alone.",
        ],
        charismaBuff: 0,
        trustMultiplier: 1.1
    },
    {
        strategy: "The Charming Flirt",
        success: [
            "{tribute} winks at the camera and flirts with the host. The Capitol crowd swoons.",
            "{tribute} teases Caesar so smoothly that he loses his own punchline. The room roars.",
            "{tribute} works the audience like a professional. Parachutes are being funded before they sit down.",
        ],
        failure: [
            "{tribute} tries to be charming and completely misreads the room.",
            "{tribute} lands a joke that nobody catches, then explains it.",
            "{tribute} overplays the charm until it curdles into something uncomfortable.",
        ],
        charismaBuff: 2,
        trustMultiplier: 1.4
    },
    {
        strategy: "The Arrogant Brute",
        success: [
            "{tribute} openly mocks the other tributes by name. The Capitol adores the drama.",
            "{tribute} declares the other twenty-three already dead. It is monstrous, and the crowd eats it up.",
            "{tribute} treats the interview as a formality on the way to a win. Somehow, it works.",
        ],
        failure: [
            "{tribute} insults the Capitol audience and is met with dead silence and boos.",
            "{tribute} picks a fight with Caesar and loses it badly.",
            "{tribute} sneers at the wrong section of the crowd. Sponsors close their accounts.",
        ],
        charismaBuff: -1,
        trustMultiplier: 0.8
    },
    {
        strategy: "The Quirky Oddball",
        success: [
            "{tribute} goes on a bizarre but endearing tangent about district life. The crowd finds it hilarious.",
            "{tribute} answers a question about strategy with a story about a goat. It is the best segment of the night.",
            "{tribute} is strange in a way the Capitol has not seen before, and the Capitol is bored of everything else.",
        ],
        failure: [
            "{tribute} mumbles incoherently. Caesar has to change the subject quickly.",
            "{tribute} tells a joke that dies so completely the band starts playing early.",
            "{tribute} is odd without being interesting, which is the only unforgivable thing here.",
        ],
        charismaBuff: 1,
        trustMultiplier: 1.2
    }
];

export const ENCOUNTER_TEXTS = {
    peaceful: [
        "{t1} and {t2} cross paths in {zone}. They nod at each other and walk away.",
        "{t1} spots {t2} resting in {zone}, but decides to leave them alone.",
        "{t1} and {t2} share a tense moment of eye contact in {zone} before going their separate ways."
    ],
    friendly: [
        "{t1} and {t2} agree to a temporary truce and share a moment of peace.",
        "{t1} and {t2} tell stories about their districts to keep their sanity intact.",
        "{t1} helps {t2} bandage a minor scrape, strengthening their bond."
    ],
    shareResources: [
        "{t1} and {t2} share their rations in {zone}.",
        "{t1} trades supplies with {t2} to ensure mutual survival.",
        "{t1} points {t2} toward a fresh water source they found earlier."
    ]
};

export const SANITY_TEXTS = {
    hallucination: [
        "{tribute} begins to hallucinate, seeing phantom mutts in the shadows of {zone}.",
        "{tribute} hears the voices of fallen tributes whispering in {zone}.",
        "{tribute} starts talking to a tree in {zone}, convinced it's an old friend.",
        "{tribute} panics and attacks a non-existent threat in {zone}."
    ],
    dropItem: [
        "{tribute} becomes disoriented and accidentally drops their {item} in {zone}.",
        "In a fit of paranoia, {tribute} throws away their {item}, thinking it's bugged.",
        "{tribute} loses track of their {item} while fleeing from imaginary enemies."
    ],
    ruinStealth: [
        "{tribute} lets out a blood-curdling scream in {zone}, alerting anyone nearby.",
        "{tribute} starts laughing hysterically, completely ruining their cover in {zone}.",
        "{tribute} begins singing loudly to drown out the voices, drawing attention to themselves."
    ]
};

export const TRAINING_STATIONS: Record<string, string[]> = {
    strength: [
        'weight rack', 'heavy-blade station', 'grappling mat', 'log-lift trial', 'shield-wall drill', 'anvil press'
    ],
    agility: [
        'rope course', 'balance beams', 'obstacle gauntlet', 'wall run', 'dodge lanes', 'climbing rig'
    ],
    intelligence: [
        'edible-plants station', 'trap-building bench', 'knot-tying table', 'arena-terrain map room', 'poison identification station', 'shelter-craft workshop'
    ],
    stealth: [
        'camouflage station', 'silent-movement track', 'shadow drill', 'ambush simulator', 'tracking-and-concealment pit'
    ],
    charisma: [
        'sponsor pitch booth', 'interview coaching room', 'alliance negotiation table', 'camera-presence stage'
    ],
};

export const TRAINING_VERDICTS = {
    poor: [
        'The Gamemakers barely look up.',
        'Two of the Gamemakers are openly discussing lunch.',
        'The scoreboard flickers up the number and the room moves on.',
        'Nobody in the Capitol will remember this by morning.',
        'A trainer winces and writes something short on their clipboard.',
    ],
    solid: [
        'A respectable number. Enough to be taken seriously, not enough to be feared.',
        'The Gamemakers make a note. Nothing more.',
        'Bookmakers shift their line by a fraction and move on.',
        'Solid work — the kind that keeps a tribute alive through the first week.',
        'A few sponsors circle the name and wait to see more.',
    ],
    elite: [
        'The Gamemakers stop talking. All of them.',
        'The room goes quiet, and every other tribute in it does the maths.',
        'Sponsor terminals light up across the Capitol before the score is even posted.',
        'That number will be on every broadcast in Panem by tonight.',
        'Caesar Flickerman will lead with this. Everyone in the room knows it.',
    ],
    legendary: [
        'Nobody has posted a number like that in living memory. The Head Gamemaker stands up.',
        'The scoreboard holds the number an extra beat, as if checking it.',
        'The Capitol crowd outside hears the score and the noise carries into the training centre.',
        'Every alliance in the arena has just been redrawn around one name.',
    ],
};

export const DEATH_TEXTS = {
    cannon: [
        'A cannon fires. {tribute} is gone.',
        'A cannon rolls across the arena for {tribute}.',
        'One cannon. {tribute} does not get up.',
        'The cannon for {tribute} sounds, and somewhere a district goes very quiet.',
    ],
    environmental: [
        '{tribute} dies in {zone}. ({cause})',
        '{zone} finishes what the arena started: {tribute} is dead. ({cause})',
        'No blade, no tribute, no mercy — {tribute} dies in {zone}. ({cause})',
    ],
};

export const ALLIANCE_TEXTS = {
    form: [
        '{t1} and {t2} shake on it. For now, they are a pair.',
        '{t1} and {t2} agree to watch each other\'s backs. Neither says for how long.',
        '{t1} offers {t2} a place at their fire, and {t2} takes it.',
        '{t1} and {t2} formalise an alliance in {zone}.',
    ],
    support: [
        '{t1} and {t2} keep watch in shifts in {zone}.',
        '{t1} and {t2} share the last of the water in {zone} without arguing about it.',
        '{t1} patches up {t2} in {zone}, working fast and badly.',
        '{t1} and {t2} sit back to back in {zone} and say nothing for an hour.',
    ],
    betray: [
        'BETRAYAL: {betrayer} waits until {victim} is asleep, then moves.',
        'BETRAYAL: {betrayer} decides the alliance has served its purpose and turns on {victim}.',
        'BETRAYAL: {betrayer} smiles at {victim}, then draws.',
        'BETRAYAL: {betrayer} breaks the alliance the moment {victim} turns their back.',
    ],
    dissolve: [
        'The alliance around {tribute} has come apart. They are alone again.',
        '{tribute} is the last of their alliance left standing.',
    ],
};

export const ROMANCE_TEXTS = [
    'ROMANCE: {t1} and {t2} of District {district} stop pretending. The Capitol has its love story, and sponsors are already queuing.',
    'ROMANCE: {t1} and {t2} of District {district} are inseparable now. Caesar Flickerman devotes an entire segment to them.',
    'ROMANCE: Something has shifted between {t1} and {t2} of District {district}. The audience can see it, and so can everyone else in the arena.',
];

export const FEAST_TEXTS = {
    announce: [
        "CLAUDIUS TEMPLESMITH: 'Attention, tributes. There will be a feast at the Cornucopia at dawn. Each of you needs something — and we have it.'",
        "CLAUDIUS TEMPLESMITH: 'Congratulations to the remaining tributes. A feast is called at the Cornucopia. Refusing is, of course, your right.'",
        'The Gamemakers sound the feast horn. Whatever a tribute is missing most is now sitting in the open, in the most dangerous place in the arena.',
    ],
    decline: [
        '{tribute} weighs the feast against the odds and stays exactly where they are.',
        '{tribute} decides that whatever is on that table is not worth the Cornucopia.',
        '{tribute} hears the feast horn and deliberately walks the other way.',
    ],
    attend: [
        '{tribute} breaks cover and runs for the Cornucopia.',
        '{tribute} approaches the feast low and fast, using every scrap of cover.',
        '{tribute} arrives at the feast already knowing it is a trap, and goes anyway.',
    ],
    claim: [
        '{tribute} survives the feast and walks away with {items}, restored and dangerous.',
        '{tribute} is the last one standing at the Cornucopia. They take {items} and disappear into the treeline.',
        'The feast belongs to {tribute}. They leave with {items} and a full stomach.',
    ],
};

export const BLOODBATH_TEXTS = {
    flee: [
        '{tribute} sprints from the Cornucopia without looking back.',
        '{tribute} takes one look at the Careers and runs.',
        '{tribute} clears the plate and keeps running until the screaming fades.',
        '{tribute} makes it out of the bloodbath with nothing but their life.',
        '{tribute} trips off the pedestal, scrambles up, and gets clear.',
    ],
    fleeWithItem: [
        '{tribute} grabs {item} off the edge of the pile and runs.',
        '{tribute} snatches {item} out of another tribute\'s reach and bolts.',
        '{tribute} takes {item} from the outer ring of the Cornucopia and disappears into cover.',
    ],
    survive: [
        '{tribute} holds the Cornucopia when the dust settles, claiming {items}.',
        'The bloodbath ends with {tribute} standing over the supply pile. They take {items}.',
        '{tribute} walks out of the bloodbath with {items} and blood that is not theirs.',
    ],
};

export const SPONSOR_TEXTS = [
    'A silver parachute drifts down to {tribute} in {zone}: {item}.',
    "{tribute}'s sponsors come through in {zone}. A parachute delivers {item}.",
    '{tribute} hears the whine of a parachute over {zone}. Inside: {item}.',
    'The Capitol has been watching {tribute}. Their reward, delivered to {zone} by parachute: {item}.',
];

export const AMBIENT_TEXTS = [
    'The anthem plays across the arena. Tonight\'s faces burn in the sky.',
    'A hovercraft descends somewhere out of sight and lifts a body away.',
    'The Gamemakers cut the temperature by ten degrees, just to watch what happens.',
    'Capitol betting odds are updated live on every screen in the city.',
    'Somewhere far above, an audience of millions leans in.',
];
