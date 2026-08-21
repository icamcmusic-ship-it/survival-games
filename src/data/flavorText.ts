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
        "{killer} reaps {victim} like wheat with a curved sickle.",
        "{killer} catches {victim}'s guard on the hook of the sickle and pulls it aside. What follows takes one movement.",
        "{victim} learns too late that a sickle does not need to be swung hard, only close."
    ],
    'blowgun': [
        "{killer} sends a poisoned dart into {victim}'s neck from the shadows.",
        "{victim} slaps at what they think is an insect bite — {killer}'s dart has already done its work.",
        "{killer} watches from the canopy as their venom-tipped dart drops {victim} mid-stride.",
        "{victim} makes it another forty metres before the dart {killer} put in their shoulder finishes the argument.",
        "{killer} does not move at all. {victim} walks into the open, and a dart crosses the distance the hunter never has to."
    ],
    'garrote': [
        "{killer} slips a wire garrote around {victim}'s throat in total silence.",
        "{victim} never hears {killer} approach before the wire tightens.",
        "{killer} strangles {victim} with a length of razor wire.",
        "{killer} takes {victim} from behind and holds the wire for a great deal longer than is strictly necessary.",
        "It is over so quietly that {killer} can hear the wire itself. {victim} makes no sound worth the name."
    ],
    'slingshot': [
        "{killer} cracks {victim}'s skull with a stone from their slingshot.",
        "{killer} lands a perfect slingshot strike on {victim}'s temple.",
        "{victim} laughs at {killer}'s slingshot — right up until the stone hits.",
        "{killer} puts three stones into {victim} from forty metres, and the third one is the one that counts.",
        "{victim} goes down looking for the weapon that did it. There is only {killer}, a strip of leather, and the creek bed it came from."
    ],
    'club': [
        "{killer} brings the cudgel down on {victim}'s skull, and once is enough.",
        "{killer} beats {victim} down with a crude wooden cudgel and does not stop until the cannon.",
        "{victim} raises an arm against {killer}'s cudgel. It breaks the arm first, then everything else.",
        "{killer} swings the cudgel like a tool rather than a weapon, which is what it is, and {victim} dies of the difference.",
        "The cudgel {killer} made two days ago in the treeline does for {victim} what better weapons failed to."
    ],
    'sharpstone': [
        "{killer} drives a sharpened stone into {victim}'s throat.",
        "{killer} opens {victim}'s artery with a flake of sharpened stone.",
        "{victim} never expects the crude stone edge in {killer}'s fist to cut as deep as it does.",
        "{killer} loses the stone in {victim} somewhere around the fourth strike and keeps going anyway.",
        "It takes {killer} longer than a blade would. {victim} is aware of every part of how much longer."
    ],
    'reedspear': [
        "{killer} puts a fire-dried reed shaft through {victim} at eight paces.",
        "{victim} does not credit the reed spear as a weapon until {killer} throws it.",
        "{killer} braces the reed spear in the mud and lets {victim}'s own charge finish the job.",
        "The shaft snaps off in {victim}. {killer} leaves it where it is and walks away with the rest."
    ],
    'rebar': [
        "{killer} runs {victim} through with a length of rusted rebar.",
        "{killer} swings the rebar two-handed and {victim} does not get a second look at it.",
        "{victim} is put against a wall by {killer} and pinned there with a steel rod out of the same wall.",
        "{killer} beats {victim} down with a bar of reinforcing steel, and the ruins do not echo for long."
    ],
    'sling': [
        "{killer} whirls the sling twice and drops {victim} at thirty metres with a river stone.",
        "{victim} hears the sling before they see {killer}, and hearing it does not help.",
        "{killer} takes the shot while {victim} is still deciding whether the sound mattered.",
        "A stone out of a strip of pack leather, thrown by {killer}, is what finally ends {victim}."
    ],
    'stake': [
        "{killer} drives a fire-hardened stake into {victim} and leans on it.",
        "{victim} blocks the swing and takes the point. {killer} spent a whole night in the fire getting it that sharp.",
        "{killer} finishes {victim} with a length of wood and two hours of patience.",
        "The stake goes in blackened and comes out otherwise. {killer} does not look at {victim} afterwards."
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
    },
    {
        strategy: "The Silent Threat",
        success: [
            "{tribute} answers most questions in three words or fewer. By the fourth one the room has stopped expecting more, and started paying closer attention.",
            "{tribute} lets Caesar do most of the talking and simply watches the audience while he does. It is more unsettling than anything they could have said.",
            "{tribute} says almost nothing for three minutes, and every second of it reads as a decision rather than a failure to perform.",
        ],
        failure: [
            "{tribute} tries to be quietly menacing and just comes across as somebody with nothing to say.",
            "The silence stretches too long and Caesar has to fill it himself, which nobody in the room mistakes for mystery.",
            "{tribute}'s short answers land as sullen rather than dangerous, and sullen does not sell.",
        ],
        charismaBuff: 0,
        trustMultiplier: 1.15
    },
    {
        strategy: "The Grieving Sibling",
        success: [
            "{tribute} talks about who they left behind — plainly, without performing it — and the room goes very still.",
            "{tribute} says one name, explains who it belongs to, and does not elaborate. Nobody asks them to.",
            "{tribute} admits they are terrified of what this does to the people at home, and the honesty lands harder than bravado would have.",
        ],
        failure: [
            "{tribute} breaks down mid-answer and cannot recover the thread. Caesar is kind about it, which somehow makes it worse.",
            "The grief reads as unrehearsed in the wrong way — raw instead of affecting — and the room does not know where to look.",
            "{tribute} tries to compose themselves and the pause runs long enough that the moment curdles into something else.",
        ],
        charismaBuff: 0,
        trustMultiplier: 1.35
    },
    {
        strategy: "The Cold Strategist",
        success: [
            "{tribute} answers every question like a problem with a solution already attached. The Capitol finds it clinical and cannot look away.",
            "{tribute} lays out, in order, exactly what they intend to do and why. It is unnervingly organised.",
            "{tribute} treats the interview itself as a tactical problem and solves it in front of everyone, which is its own kind of performance.",
        ],
        failure: [
            "{tribute} comes across as a spreadsheet with a pulse, and the room's attention drifts within a minute.",
            "The calculation shows too plainly and the audience decides they are watching someone who does not actually feel anything, which reads badly.",
            "{tribute}'s plan sounds thin the moment it is said out loud, and everyone in the room can hear the gaps.",
        ],
        charismaBuff: 0,
        trustMultiplier: 1.1
    },
    {
        strategy: "The Reluctant Hero",
        success: [
            "{tribute} makes it clear they did not want any of this, and that they intend to do what is necessary anyway. The room respects it more than bravado.",
            "{tribute} says plainly that they are frightened and are going to try regardless, and the audience decides that is the bravest thing anyone has said all night.",
            "{tribute} refuses to pretend this is an honour, and refuses to fall apart about it either. It is a difficult tone to hold, and they hold it.",
        ],
        failure: [
            "The reluctance reads as self-pity instead of honesty, and the room's sympathy curdles fast.",
            "{tribute} cannot find the line between frightened and pathetic, and lands on the wrong side of it.",
            "{tribute} says all the right things and none of them land, because nobody in the room believes they mean it.",
        ],
        charismaBuff: 1,
        trustMultiplier: 1.25
    },
    {
        strategy: "The District Loyalist",
        success: [
            "{tribute} spends the whole three minutes talking about District {district} — its people, its work, what it deserves — and barely mentions themselves at all.",
            "{tribute} wears something small from home and explains exactly what it means. The gesture costs nothing and the district will remember it forever.",
            "{tribute} promises, simply, to make their district proud, and says it like someone who has actually thought about what that means.",
        ],
        failure: [
            "The district pride reads as rehearsed, a line delivered rather than meant, and the room can tell the difference.",
            "{tribute} talks about home so long that Caesar has to steer the segment back on track, and the audience loses the thread.",
            "{tribute}'s devotion to their district comes across as provincial rather than admirable to a Capitol audience that does not know the place.",
        ],
        charismaBuff: 0,
        trustMultiplier: 1.2
    },
    {
        strategy: "The Wildcard",
        success: [
            "{tribute} contradicts themselves twice in three minutes and somehow makes both versions convincing. Nobody can predict what they will say next, and that is the entire appeal.",
            "{tribute} answers the question Caesar meant to ask next, before he asks it, and the room decides they are either very sharp or very lucky.",
            "{tribute} changes the subject entirely, twice, and both detours are more interesting than the original question.",
        ],
        failure: [
            "The unpredictability just reads as unfocused, and the segment goes nowhere in particular.",
            "{tribute} contradicts themselves and it is not charming, just confusing, and Caesar has to work to recover the thread.",
            "{tribute} swings for something clever and the room is a half-second too slow to follow, which kills it.",
        ],
        charismaBuff: 1,
        trustMultiplier: 1.15
    }
];

export const ENCOUNTER_TEXTS = {
    /**
     * The moment two people with no quarrel do the arithmetic and realise there
     * is only one way either of them goes home. Fires only late, when the field
     * has narrowed enough that indifference stops being an option.
     */
    desperation: [
        "{t1} and {t2} meet in {zone} with nothing between them but the count. There are too few left for either to walk away.",
        "Neither {t1} nor {t2} wanted this. In {zone}, with the field this thin, wanting has stopped mattering.",
        "{t1} looks at {t2} across {zone} and does the arithmetic. So does {t2}. Only one of them is going home.",
        "There is no grudge between {t1} and {t2} — only the number of tributes still breathing, and it is small enough now to decide things.",
        "{t1} and {t2} have avoided each other all week. In {zone}, with the sky counting down, the week runs out.",
    ],
    peaceful: [
        "{t1} and {t2} cross paths in {zone}. They nod at each other and walk away.",
        "{t1} spots {t2} resting in {zone}, but decides to leave them alone.",
        "{t1} and {t2} share a tense moment of eye contact in {zone} before going their separate ways.",
        "{t1} and {t2} see each other across {zone} at the same moment, and both decide today is not the day.",
        "{t1} raises an empty hand to {t2} in {zone}. {t2} raises one back. Neither moves closer.",
        "{t1} and {t2} pass on opposite banks in {zone} without a word between them.",
        "{t1} steps aside in {zone} and lets {t2} go by. Somewhere a Gamemaker sighs."
    ],
    friendly: [
        "{t1} and {t2} agree to a temporary truce and share a moment of peace.",
        "{t1} and {t2} tell stories about their districts to keep their sanity intact.",
        "{t1} helps {t2} bandage a minor scrape, strengthening their bond.",
        "{t1} and {t2} split a fire in {zone} and argue about whose district has better bread.",
        "{t1} teaches {t2} a knot their father taught them. For an hour in {zone} they are just two kids.",
        "{t1} and {t2} count the cannons together in {zone} and get the same number.",
        "{t1} lets {t2} sleep first in {zone}, and actually keeps watch."
    ],
    unnoticed: [
        '{t2} passes within twenty metres of {t1} in {zone} and never knows it.',
        '{t1} holds their breath in the cover of {zone} until {t2} has gone.',
        '{t1} watches {t2} search {zone} from six feet away and does not move a muscle.',
        '{t2} sweeps {zone} and finds nothing. {t1} is right there.',
        "{t2} sits down to rest in {zone} with {t1} already inside arm's reach, and never once looks up.",
        "{t1} times their breathing to {t2}'s footsteps in {zone} until the footsteps go away."
    ],
    shareResources: [
        "{t1} and {t2} share their rations in {zone}.",
        "{t1} trades supplies with {t2} to ensure mutual survival.",
        "{t1} points {t2} toward a fresh water source they found earlier.",
        "{t1} splits a water ration with {t2} in {zone} without being asked twice.",
        "{t2} shows {t1} which roots in {zone} are safe, and which ones are not.",
        "{t1} and {t2} pool what they have in {zone}. It is not much, and it is more than either had.",
    ],
};

export const SANITY_TEXTS = {
    hallucination: [
        "{tribute} begins to hallucinate, seeing phantom mutts in the shadows of {zone}.",
        "{tribute} hears the voices of fallen tributes whispering in {zone}.",
        "{tribute} starts talking to a tree in {zone}, convinced it's an old friend.",
        "{tribute} panics and attacks a non-existent threat in {zone}.",
        "{tribute} carries on a long, reasonable conversation with somebody who is not in {zone}.",
        "{tribute} sees the sky over {zone} peel back and the Capitol looking down through it.",
        "{tribute} is certain the trees in {zone} have moved since yesterday. They count them again.",
        "{tribute} laughs at something in {zone} for a long time, and then stops very suddenly."
    ],
    dropItem: [
        "{tribute} becomes disoriented and accidentally drops their {item} in {zone}.",
        "In a fit of paranoia, {tribute} throws away their {item}, thinking it's bugged.",
        "{tribute} loses track of their {item} while fleeing from imaginary enemies.",
        "{tribute} buries their {item} in {zone} for reasons that made perfect sense at the time, and cannot find it afterwards.",
        "{tribute} becomes convinced their {item} belongs to someone else and leaves it on a rock in {zone}, neatly, like a returned tool.",
        "{tribute} wakes in {zone} with no memory of the last hour and no {item}."
    ],
    ruinStealth: [
        "{tribute} lets out a blood-curdling scream in {zone}, alerting anyone nearby.",
        "{tribute} starts laughing hysterically, completely ruining their cover in {zone}.",
        "{tribute} begins singing loudly to drown out the voices, drawing attention to themselves.",
        "{tribute} shouts an answer in {zone} to a question nobody asked out loud.",
        "{tribute} starts an argument with the dark in {zone} and loses it loudly.",
        "{tribute} calls out a dead tribute's name across {zone}, twice, and the whole sector hears it."
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
        'A Gamemaker checks the time while {tribute} is still going.',
        '{tribute} finishes, and the gallery has already looked away.',
    ],
    solid: [
        'A respectable number. Enough to be taken seriously, not enough to be feared.',
        'The Gamemakers make a note. Nothing more.',
        'Bookmakers shift their line by a fraction and move on.',
        'Solid work — the kind that keeps a tribute alive through the first week.',
        'A few sponsors circle the name and wait to see more.',
        'Competent, unspectacular, and enough to stay off everyone\'s list. {tribute} will take it.',
        'The Gamemakers make a note about {tribute} and move on.',
    ],
    elite: [
        'The Gamemakers stop talking. All of them.',
        'The room goes quiet, and every other tribute in it does the maths.',
        'Sponsor terminals light up across the Capitol before the score is even posted.',
        'That number will be on every broadcast in Panem by tonight.',
        'Caesar Flickerman will lead with this. Everyone in the room knows it.',
        'Two of the Gamemakers lean forward at the same time.',
        'The room notices {tribute}, and {tribute} notices the room noticing.',
    ],
    legendary: [
        'Nobody has posted a number like that in living memory. The Head Gamemaker stands up.',
        'The scoreboard holds the number an extra beat, as if checking it.',
        'The Capitol crowd outside hears the score and the noise carries into the training centre.',
        'Every alliance in the arena has just been redrawn around one name.',
        'The Gamemakers stop talking among themselves. That does not happen.',
        'Nobody in the gallery writes anything down. They just watch {tribute}.',
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
        'The cannon over {zone} is for {tribute}. {cause}, and the arena does not pause for it.',
        '{tribute} does not get up again in {zone}. {cause}.',
        'They will show {tribute}\'s face in the sky tonight. {cause}, alone in {zone}.',
    ],
    /**
     * CONTENT-05: the same six sentences used to cover a twelve-year-old dying
     * of exposure, a Career bleeding out, and a fan favourite drowning. Keyed
     * pools, chosen by who the tribute actually was — see `pickDeathPool` in
     * `engine/combat.ts`.
     */
    environmentalChild: [
        '{tribute} dies alone in {zone}, {age} years old. {cause}. The anthem tonight will run long.',
        'There is no dignifying it: {tribute} is {age}, and {tribute} dies in {zone}. {cause}.',
        '{tribute} does not get up again in {zone}. They are {age}. {cause}.',
        'The Capitol cuts away before the medics reach {zone}. {tribute} was {age}. {cause}.',
        'In a district square somewhere, a family stops watching. {tribute} was {age}. {cause}, in {zone}.',
        'The commentators have nothing to say for once. {tribute}, {age} years old, dead in {zone}. {cause}.',
        'Twelve is too young for this arena, and the arena does not care. {tribute}, in {zone}. {cause}.',
        'The escort who read out the name will hear it read back tonight. {tribute}, {age}, gone in {zone}. {cause}.',
        'Whoever dressed {tribute} for the parade is watching {zone} now, like everyone else. {age} years old. {cause}.',
        '{tribute} called out once, in {zone}, and the arena answered instead of anyone kind. They were {age}. {cause}.',
    ],
    environmentalFanFavourite: [
        'Every screen in the Capitol is on {zone} within seconds. {tribute} — everybody\'s {tribute} — is dead. {cause}.',
        'The betting boards freeze mid-payout. {tribute} dies in {zone}, and half of Panem watches it happen live. {cause}.',
        '{tribute} was supposed to be different. {cause}, in {zone}, on schedule with everybody else.',
        'The sponsors who spent all week on {tribute} are still watching when the cannon sounds in {zone}. {cause}.',
        'The merchandise was printed this morning. {tribute} is dead in {zone} by nightfall. {cause}.',
        'For a full minute the broadcast does not cut away from {zone}, because nobody in the control room can believe it either. {tribute} is gone. {cause}.',
        'The sponsors\' lounge goes silent mid-toast. {tribute} — the one they had all backed — is gone in {zone}. {cause}.',
        'Caesar has interviewed a thousand tributes and needs a moment before he can talk about this one. {tribute}, in {zone}. {cause}.',
        'Half the Capitol went to sleep sure {tribute} would win. {zone} had other plans. {cause}.',
        'The odds board takes a full minute to update, as if it too were reluctant. {tribute} is dead in {zone}. {cause}.',
    ],
    environmentalCareer: [
        '{tribute} — trained for this since childhood — dies in {zone} anyway. {cause}. The academy did not cover this part.',
        'Nobody expected {zone} to be what finally got {tribute}. {cause}.',
        '{tribute} spent years preparing for the wrong Games. {cause}, in {zone}.',
        'All that training, and the arena kills {tribute} without sending anyone. {cause}, in {zone}.',
        'The academy will not screen this one for the recruits: {tribute}, dead in {zone}. {cause}.',
        'The odds board had {tribute} in the final three. The arena had other arithmetic. {cause}, in {zone}.',
        '{tribute} was the safe money. {zone} did not take the bet. {cause}.',
        'There is a room in District 2 where this footage will be studied for years: {tribute}, in {zone}. {cause}.',
        'The pack will not talk about it tonight. {tribute} — one of theirs — dead in {zone}, and not to any enemy. {cause}.',
        'A career of training answers everything except this. {tribute}, alone against {zone}. {cause}.',
    ],
    environmentalWitnessed: [
        '{witness} is standing close enough in {zone} to hear it happen. {tribute} is dead. {cause}.',
        '{witness} watches {tribute} die in {zone} and does not move for a long time afterward. {cause}.',
        '{tribute} dies in front of {witness} in {zone}. {cause}. There is nothing {witness} could have done, and {witness} knows it.',
        '{witness} reaches {tribute} in {zone} in time for the end and not a second more. {cause}.',
        '{witness} shouts a warning across {zone} that arrives too late to matter. {tribute} is dead. {cause}.',
        '{witness} will carry the sound {zone} made out of the arena, if they get out of the arena. {tribute} is dead. {cause}.',
        '{witness} looks away first. That is the detail the cameras keep. {tribute} is dead in {zone}. {cause}.',
        'Afterward {witness} marks the spot in {zone} with whatever is to hand. Nobody taught them to; some things predate the arena. {tribute} is gone. {cause}.',
        '{witness} says something over {tribute} that the microphones do not catch and the Capitol does not subtitle. {cause}, in {zone}.',
        'For the rest of the Games, {witness} will not go back through {zone}. {tribute} died there. {cause}.',
    ],
    environmentalAlone: [
        '{tribute} dies with nobody in {zone} to see it. {cause}. The cameras find the body before anyone else does.',
        'No witness, no ally, no last words — {tribute} dies alone in {zone}. {cause}.',
        '{tribute} goes quietly in {zone}, entirely alone. {cause}. Somewhere, a district is about to find out from the sky.',
        'The arena keeps {tribute}\'s last hour to itself. Alone, in {zone}. {cause}.',
        'By the time the hovercraft reaches {zone}, there is no story to reconstruct — just {tribute}, alone. {cause}.',
        'Nobody in the arena notices the cannon change anything. That is how alone {tribute} was in {zone}. {cause}.',
        'The cannon is the first anyone hears of it. {tribute}, somewhere in {zone}, sometime in the last hour. {cause}.',
        '{tribute} had a plan for tomorrow — the cameras caught them rehearsing it. {zone} kept them instead. {cause}.',
        'It takes the Gamemakers a minute to even find the body in {zone}. That is how quietly {tribute} went. {cause}.',
        'The sky will name {tribute} tonight and the whole arena will realise nobody had seen them in days. {zone}. {cause}.',
    ],
};

export const ALLIANCE_TEXTS = {
    form: [
        '{t1} and {t2} shake on it. For now, they are a pair.',
        '{t1} and {t2} agree to watch each other\'s backs. Neither says for how long.',
        '{t1} offers {t2} a place at their fire, and {t2} takes it.',
        '{t1} and {t2} formalise an alliance in {zone}.',
        '{t1} and {t2} do not shake on it. They just start walking in the same direction from {zone}.',
        '{t1} says the arithmetic is better with two. {t2} does not argue.',
        '{t1} and {t2} agree on one rule in {zone}: whoever breaks it first says so out loud.',
    ],
    support: [
        '{t1} and {t2} keep watch in shifts in {zone}.',
        '{t1} and {t2} share the last of the water in {zone} without arguing about it.',
        '{t1} patches up {t2} in {zone}, working fast and badly.',
        '{t1} and {t2} sit back to back in {zone} and say nothing for an hour.',
        '{t1} splints {t2}\'s ankle in {zone} with a strip of pack webbing and a stick.',
        '{t1} takes the bad watch in {zone} so {t2} can sleep through the cold hours.',
        '{t1} and {t2} count what is left between them in {zone} and make it stretch another day.',
        '{t2} talks {t1} down from something in {zone}, quietly, until it passes.',
    ],
    betray: [
        'BETRAYAL: {betrayer} waits until {victim} is asleep, then moves.',
        'BETRAYAL: {betrayer} decides the alliance has served its purpose and turns on {victim}.',
        'BETRAYAL: {betrayer} smiles at {victim}, then draws.',
        'BETRAYAL: {betrayer} breaks the alliance the moment {victim} turns their back.',
        'BETRAYAL: {betrayer} hands {victim} the last of the water in {zone}, waits for them to drink, and moves.',
        'BETRAYAL: {betrayer} has been counting down to this since the alliance formed. In {zone}, they finish counting.',
        'BETRAYAL: {victim} realises what is happening in {zone} about half a second too late.',
    ],
    recruit: [
        '{group} talk it over in {zone} and wave {tribute} in. The circle is bigger tonight.',
        '{tribute} makes their case to {group} in {zone}, and to their own surprise it works.',
        '{group} decide {tribute} is worth more inside the group than outside it.',
        '{tribute} shares what they have with {group} in {zone}, and nobody asks them to leave.',
        '{group} watch {tribute} handle themselves in {zone} and decide they would rather have that pointed away from them.',
        '{tribute} walks into the camp of {group} in {zone} with their hands visible, and it goes better than it usually does.',
        'It is not friendship. {group} need another set of eyes for the watches, and {tribute} has two.',
        '{group} argue about {tribute} for an hour in {zone}. The side that wins is the side that counted the sentries needed.',
    ],
    dissolve: [
        'The alliance around {tribute} has come apart. They are alone again.',
        '{tribute} is the last of their alliance left standing.',
        'Whatever held {tribute}\'s alliance together is gone. So is the alliance.',
        '{tribute} wakes up in an empty camp. Nobody said goodbye.',
        'The fire is cold and the packs are gone. {tribute} does the arithmetic alone.',
        'Nobody says the alliance is over out loud. {tribute} just watches it end.',
        '{tribute} keeps the watch schedule for a night after everyone is gone, out of habit, and then stops.',
        'It ends the way these things end: quietly, overnight, and {tribute} is alone in the morning.',
    ],
};

export const ROMANCE_TEXTS = [
    'ROMANCE: {t1} and {t2} of District {district} stop pretending. The Capitol has its love story, and sponsors are already queuing.',
    'ROMANCE: {t1} and {t2} of District {district} are inseparable now. Caesar Flickerman devotes an entire segment to them.',
    'ROMANCE: Something has shifted between {t1} and {t2} of District {district}. The audience can see it, and so can everyone else in the arena.',
    'ROMANCE: {t1} says it first and badly, and {t2} of District {district} does not make them say it again. Every screen in the Capitol carries the whole thing.',
    'ROMANCE: {t1} and {t2} of District {district} stop keeping separate watches. It is the least strategic decision either of them has made, and they make it anyway.',
    'ROMANCE: The cameras find {t1} and {t2} of District {district} asleep against the same rock and stay on the shot for four minutes. The sponsor lines do not stop ringing.',
    'ROMANCE: Nobody in the sponsor rooms cares which of {t1} or {t2} of District {district} wins now — only that the other one is there at the end to see it.',
    'ROMANCE: {t1} and {t2} of District {district} have started finishing each other\'s watches, sentences and rations. The Capitol has a word for this and is using it constantly.',
    'ROMANCE: Whatever {t1} and {t2} of District {district} agreed on, they agreed on it quietly and neither has looked at the odds since.',
    'ROMANCE: {t1} and {t2} of District {district} both know exactly how this arithmetic ends. They have decided to be in love for the part before that.',
];

/**
 * CONTENT-06: a bond that is not romance. {older} has taken {younger} under
 * something like a wing — protective rather than romantic, and it does not
 * require either of them to be single, or of an age where romance would even
 * make sense. See `growProtectorBond` in `phases/alliances.ts`.
 */
export const PROTECTOR_BOND_TEXTS = [
    'BOND: {older} has started putting themselves between {younger} and anything dangerous, without ever quite saying why.',
    'BOND: Something has settled between {older} and {younger} — not an alliance exactly. More like {older} has decided {younger} is theirs to look after.',
    'BOND: {younger} has stopped flinching when {older} moves fast nearby. That took a while to earn.',
    'BOND: The Capitol is calling it the closest thing this arena has to family. {older} would probably just call it {younger}\'s good luck.',
    'BOND: {older} has taken the bad watch three nights running so {younger} can sleep through the cold hours, and has not mentioned doing it once.',
    'BOND: {older} eats second now. {younger} has not worked out that this is deliberate, which is how {older} prefers it.',
    'BOND: {younger} has started walking where {older} walks, stepping where {older} steps. Neither of them agreed to this out loud.',
    'BOND: Asked by a camera what {younger} is to them, {older} says "mine" and does not elaborate. The broadcast runs it twice.',
    'BOND: {older} teaches {younger} the same three things over and over — water, cover, when to run — because those are the three that keep working.',
    'BOND: There is a version of this where {older} leaves {younger} behind and is better off for it. {older} has evidently stopped considering that version.',
];


export const FEAST_TEXTS = {
    announce: [
        "CLAUDIUS TEMPLESMITH: 'Attention, tributes. There will be a feast at the Cornucopia at dawn. Each of you needs something — and we have it.'",
        "CLAUDIUS TEMPLESMITH: 'Congratulations to the remaining tributes. A feast is called at the Cornucopia. Refusing is, of course, your right.'",
        'The Gamemakers sound the feast horn. Whatever a tribute is missing most is now sitting in the open, in the most dangerous place in the arena.',
        'The Gamemakers announce a feast at the Cornucopia. Everyone knows what a feast is really for.',
        'A table rises at the Cornucopia with something on it that every tribute needs. That is the entire trap.',
    ],
    decline: [
        '{tribute} weighs the feast against the odds and stays exactly where they are.',
        '{tribute} decides that whatever is on that table is not worth the Cornucopia.',
        '{tribute} hears the feast horn and deliberately walks the other way.',
        '{tribute} watches the Cornucopia from cover, counts the ways it ends badly, and stays put.',
        '{tribute} has seen this before. They let the feast happen without them.',
    ],
    attend: [
        '{tribute} breaks cover and runs for the Cornucopia.',
        '{tribute} approaches the feast low and fast, using every scrap of cover.',
        '{tribute} arrives at the feast already knowing it is a trap, and goes anyway.',
        '{tribute} decides hunger is the more certain death and starts walking to the Cornucopia.',
        '{tribute} circles the Cornucopia twice before committing to it.',
    ],
    claim: [
        '{tribute} survives the feast and walks away with {items}, restored and dangerous.',
        '{tribute} is the last one standing at the Cornucopia. They take {items} and disappear into the treeline.',
        'The feast belongs to {tribute}. They leave with {items} and a full stomach.',
        '{tribute} takes {items} off the table and is gone before the others reach the clearing.',
        'The feast belongs to {tribute}. They leave with {items} and no one willing to follow.',
    ],
};

export const BLOODBATH_TEXTS = {
    flee: [
        '{tribute} sprints from the Cornucopia without looking back.',
        '{tribute} takes one look at the Careers and runs.',
        '{tribute} clears the plate and keeps running until the screaming fades.',
        '{tribute} makes it out of the bloodbath with nothing but their life.',
        '{tribute} trips off the pedestal, scrambles up, and gets clear.',
        '{tribute} is off the plate and into the treeline before the gong finishes sounding.',
        '{tribute} looks at the Cornucopia once, decides against all of it, and runs.',
        '{tribute} goes the opposite way to everyone else and does not look back.',
    ],
    fleeWithItem: [
        '{tribute} grabs {item} off the edge of the pile and runs.',
        '{tribute} snatches {item} out of another tribute\'s reach and bolts.',
        '{tribute} takes {item} from the outer ring of the Cornucopia and disappears into cover.',
        '{tribute} snatches {item} off the outer ring and keeps running.',
        '{tribute} gets a hand to {item} half a second before someone else does, and takes it into the trees.',
    ],
    survive: [
        '{tribute} holds the Cornucopia when the dust settles, claiming {items}.',
        'The bloodbath ends with {tribute} standing over the supply pile. They take {items}.',
        '{tribute} walks out of the bloodbath with {items} and blood that is not theirs.',
        '{tribute} is the last one standing in the mouth of the horn. They take {items} and walk out unhurried.',
        'When the dust settles at the Cornucopia it is {tribute} still upright, holding {items}.',
    ],
};

export const SPONSOR_TEXTS = [
    'A silver parachute drifts down to {tribute} in {zone}: {item}.',
    "{tribute}'s sponsors come through in {zone}. A parachute delivers {item}.",
    '{tribute} hears the whine of a parachute over {zone}. Inside: {item}.',
    'The Capitol has been watching {tribute}. Their reward, delivered to {zone} by parachute: {item}.',
    'A parachute drifts into {zone} and {tribute} has it open before it lands. Inside: {item}.',
    'Somebody in the Capitol has been watching {tribute}. A silver parachute brings {item} down into {zone}.',
    '{tribute} hears the chime over {zone} and does not believe it until {item} is in their hands.',
    'The sponsors have seen enough. {item} comes down to {tribute} in {zone}.',
];

/**
 * A parachute with a name attached. The crowd sends the ordinary gifts; these
 * come because one person in the sponsor rooms spent their own standing on it,
 * and the chronicle should say whose.
 */
export const MENTOR_PARACHUTE_TEXTS = [
    '{mentor} {need}. A parachute drops into {zone} with {item} inside, and everyone in the sponsor rooms knows who paid for it.',
    'Somewhere above the arena {mentor} calls in a favour for {tribute}. {item}, down into {zone}, exactly what was needed.',
    '{mentor} {need}. {tribute} finds {item} in the parachute and does not have to guess who sent it.',
    'A parachute settles beside {tribute} in {zone}. {item} — {mentor} has spent something to put it there.',
    "{mentor} has been arguing {tribute}'s case all afternoon. In {zone}, a parachute finally answers with {item}.",
    'The chime over {zone} is {mentor} keeping a promise. Inside the parachute: {item}.',
    '{mentor} {need}, and has stopped waiting for the crowd. {item} comes down to {tribute} in {zone}.',
];

/** The mentor tried and the room said no. The audience only ever hears about the ones that land, otherwise. */
export const MENTOR_PLEA_FAILED_TEXTS = [
    '{mentor} works the sponsor rooms for {tribute} and comes away with nothing.',
    'No parachute reaches {zone}. {mentor} has run out of people who owe them anything.',
    'The cameras catch {mentor} being turned down for {tribute}, twice, by people who used to take their calls.',
    '{mentor} makes the case for {tribute} to a room that has already decided, politely, that {zone} is not worth the money.',
    'Nothing comes down into {zone}. It is not that {mentor} did not ask; it is that asking has stopped being enough.',
    '{mentor} names a price for {tribute} and the sponsor rooms name a lower one. Neither side moves, and the parachute is not packed.',
    'The escort has to steer {mentor} away from a patron\'s box before it becomes a scene. {tribute} goes without.',
    '{mentor} spends the afternoon on {tribute} and gets three maybes, which in the sponsor rooms is a no said slowly.',
];

export const AMBIENT_TEXTS = [
    'The anthem plays across the arena. Tonight\'s faces burn in the sky.',
    'A hovercraft descends somewhere out of sight and lifts a body away.',
    'The Gamemakers cut the temperature by ten degrees, just to watch what happens.',
    'Capitol betting odds are updated live on every screen in the city.',
    'Somewhere far above, an audience of millions leans in.',
    'The arena lights come up an hour early. Nobody is told why.',
    'Somewhere out past the treeline, something very large changes position.',
    'The Capitol feed cuts to a wide shot and holds it, waiting for something to happen.',
    'A silence settles over the whole arena at once, the way it does before the Gamemakers do something.',
    'The odds board in the Capitol flickers and resettles. Someone just moved.',
    // CONTENT-03: the studio, the crowd, and the machinery behind the broadcast.
    'A commentator\'s voice, half-heard from a Capitol screen a thousand miles away, calls the play-by-play nobody in the arena can hear.',
    'The arena cameras rack focus on nothing in particular and hold there, the way they do when a producer wants tension instead of an event.',
    'A Capitol bar goes suddenly quiet as every screen in it cuts to the same shot.',
    'Somewhere, a sponsor stares at their balance and decides against spending it just yet.',
    'The studio audience applauds a highlight reel of the day\'s best moments. Half of them are already dead.',
    'A Gamemaker\'s voice, caught on an open mic for half a second, says a number and then goes quiet.',
    'The broadcast crosses to a panel of former victors, all of whom have opinions about how slow this year is.',
    'A child in the Capitol asks their parent who is winning. The parent does not have a good answer.',
    'The feed lingers on an empty stretch of arena for a beat too long, as if daring something to happen in it.',
    'Somewhere in the control room, a hand hovers over a switch and does not press it. Not yet.',
    'The scoreboard in the town square of a distant district updates itself, and a crowd gathers to read it.',
    'A stylist watches their own work walk across the screen and holds their breath the way they did at the parade.',
    'The Capitol logo fades in over a wide shot of the arena, the way it does before something changes.',
    'A mentor, somewhere off-camera, mutters something the microphones almost catch.',
];

/**
 * CONTENT-03: ambient lines that read the run's actual state rather than
 * being purely decorative. Templated with `{alive}`, `{fallen}`, `{day}` and
 * `{favourite}` — filled in by `dynamicAmbientLine` in `engine/phases/dayNight.ts`.
 */
export const DYNAMIC_AMBIENT_TEXTS = [
    '{alive} tributes are still breathing on day {day}. The Capitol has opinions about the pace.',
    'Day {day}. {fallen} tributes down, {alive} left, and the studio panel is already arguing about who wins.',
    'The commentary track spends a full minute on {favourite} without anyone asking it to.',
    'Somewhere, someone is doing the arithmetic on {alive} tributes and not liking the answer.',
    'Day {day} closes with {alive} left in it. The odds board barely has room to print them all anymore.',
    'The studio cuts to a graphic: {fallen} down, {alive} to go. Nobody needed the graphic.',
    'In the Capitol, {favourite} merchandise sells out by lunchtime. In the districts, nobody buys anything.',
    'The betting parlours re-price {favourite} twice before noon on day {day}. Somebody in a velvet booth is very pleased with themselves.',
    'Day {day}, and the recap editors are already cutting {fallen} obituaries into a montage with string music.',
    'A Capitol street interview asks a woman in a wig who she wants to win. She says {favourite} and gets the name slightly wrong.',
    'The mandatory viewing hours stretch on day {day}. In twelve districts, {alive} families are still allowed to hope.',
    'The panel spends the slow hours of day {day} ranking the remaining {alive} by "star quality". The arena, mercifully, cannot hear them.',
];

/**
 * Grief, vengeance and relief. A cannon reshapes everyone still breathing —
 * these are the lines that let the feed show it instead of only tallying it.
 */
export const GRIEF_TEXTS = [
    '{mourner} hears the cannon and stops dead in {zone}. {victim} is gone, and it takes a long moment before they move again.',
    '{mourner} watches the sky over {zone} and sees {victim}\'s face. They sit down in the dirt and stay there.',
    'The anthem plays. {mourner} counts the faces, finds {victim} among them, and something closes behind their eyes.',
    '{mourner} says {victim}\'s name out loud in {zone}, once, to nobody.',
    '{mourner} keeps walking through {zone} because stopping means thinking about {victim}, and they cannot afford to think about {victim}.',
    '{mourner} finds something {victim} would have laughed at in {zone}, and the laugh that does not happen is the worst sound in the arena.',
    'The sky shows {victim}\'s face and {mourner} looks away from it. Looking away does not work.',
    '{mourner} makes a small pile of stones in {zone}. It is not much of a grave, but {victim} gets one, which is more than most.',
    '{mourner} realises in {zone} that they were saving a joke to tell {victim}, and now it belongs to nobody.',
    '{mourner} sleeps badly in {zone} and wakes up having forgotten. Remembering {victim} again takes about four seconds and all of them are terrible.',
    '{mourner} hums something from home in {zone}, off-key, until it stops sounding like {victim}\'s song and starts being theirs alone.',
    '{mourner} carries on down the trail with {victim}\'s name going around in their head like a stone in a boot.',
    'For one long minute in {zone}, {mourner} lets themselves grieve for {victim} properly. Then they wipe their face and check the treeline.',
    '{mourner} tells the nearest camera exactly what they think of the Capitol taking {victim}. The broadcast does not air it.',
    'Something {victim} taught {mourner} saves their life in {zone} not an hour after the cannon. They say thank you to the air.',
];

export const VENGEANCE_TEXTS = [
    'VENGEANCE: {mourner} learns it was {killer} who killed {victim}. They stop running and start hunting.',
    'VENGEANCE: {mourner} will not say {victim}\'s name again until {killer} is dead. They mean it.',
    'VENGEANCE: Something in {mourner} snaps clean through. {killer} took {victim}, and nothing else matters now.',
    'VENGEANCE: {mourner} says it once, quietly, to the sky where {victim}\'s face was: {killer} does not leave this arena.',
    'VENGEANCE: {mourner} stops being afraid the moment they learn {killer}\'s name. Fear needed room, and grief for {victim} has taken all of it.',
    'VENGEANCE: {mourner} starts carrying their weapon differently. Anyone watching closely could tell you {killer} is the reason.',
    'VENGEANCE: The plan {mourner} had — survive, hide, outlast — ends the day {killer} killed {victim}. The new plan is shorter.',
    'VENGEANCE: {mourner} does not cry over {victim}. They sharpen instead, and think about {killer} with every stroke.',
    'VENGEANCE: The Capitol cameras find {mourner}\'s face when they learn what {killer} did to {victim}, and the betting on {killer} shifts within the hour.',
    'VENGEANCE: {mourner} scratches {killer}\'s district number into a tree. It is a promise, and half the arena has seen it by nightfall.',
];

export const RELIEF_TEXTS = [
    '{tribute} hears the cannon and lets out a breath they have been holding since the reaping. {victim} was never going to let them live.',
    '{tribute} sees {victim}\'s face in the sky over {zone} and feels nothing at all. That frightens them more than grief would.',
    '{tribute} allows themselves one hard, ugly smile in {zone}. {victim} is off the board.',
    '{tribute} does the maths again in {zone} with {victim} taken out of it, and for the first time the answer is not hopeless.',
    '{tribute} sleeps a full night in {zone} for the first time since the gong. {victim} was the reason they had not.',
    '{tribute} hears the cannon, hopes it was {victim}, and the anthem confirms it. They are not proud of the hope. They keep it anyway.',
    'The sky says {victim} is gone and {tribute} stops checking over their shoulder every ten steps. The habit takes another day to die.',
    '{tribute} catches themselves whistling in {zone} and stops, appalled. {victim}\'s face was in the sky not an hour ago.',
];

/** Multi-round duels: the exchanges between the opening and the ending. */
export const DUEL_TEXTS = {
    open: [
        '{t1} and {t2} come together in {zone} and there is no talking.',
        '{t1} closes on {t2} in {zone}. Neither of them backs up.',
        'It starts badly and fast: {t1} and {t2}, alone in {zone}.',
        '{t1} and {t2} both reach for whatever they are carrying at the same moment in {zone}.',
        'There is a second where {t1} and {t2} could both still walk away from {zone}. It passes.',
        'Whatever {t1} and {t2} might have said to each other in {zone}, neither of them says it.',
        '{t1} plants their feet in {zone} and waits for {t2} to close the distance.',
    ],
    exchange: [
        '{winner} opens {loser} up and drives them back a step.',
        '{loser} takes the worse of it — {winner} lands clean and keeps coming.',
        '{winner} gets inside {loser}\'s guard and makes them pay for it.',
        '{loser} blocks two and misses the third. {winner} presses.',
        '{winner} turns {loser} around and puts them on the back foot in one movement.',
        '{loser} gives ground. {winner} takes every inch of it.',
        '{winner} lands something that makes {loser} stop making noise.',
        '{loser} misjudges the reach and wears it across the ribs.',
        '{winner} reads the next move before {loser} makes it.',
        '{loser} tries to close the distance and {winner} makes them regret it.',
        '{winner} finds a gap {loser} did not know they were leaving open.',
        '{loser} is a half-second slow and {winner} makes the whole fight out of it.',
    ],
    exchangeFinishing: [
        '{loser} is barely upright. {winner} does not slow down.',
        '{loser} has nothing left to block with. {winner} finishes what they started.',
        'There is no fight left in {loser}, only {winner} still swinging.',
        '{winner} presses the advantage all the way through. {loser} cannot answer it.',
        '{loser} goes down and {winner} follows them down. The commentators stop narrating.',
        'The end of it is quick, which is the only kindness left in {winner}.',
        '{loser} raises a hand — to block, to plead, it never becomes clear which. {winner} does not wait to find out.',
        'It stops being a fight and becomes something the Capitol will replay in slow motion. {winner} finishes it.',
    ],
    exchangeRematch: [
        '{winner} has seen this exact move from {loser} before, and this time they are ready for it.',
        '{loser} tries the same opening that worked last time. {winner} remembers, and it does not work twice.',
        'They have done this before, and it shows. {winner} is not guessing anymore.',
        '{loser} realises halfway through the exchange that {winner} has been studying them, and the realisation costs them the exchange.',
        'Third time these two have met, and {winner} has spent every day since the last one thinking about it.',
        'The commentators pull up the footage of the last fight while this one is still happening. {winner} has clearly watched it too.',
        '{winner} baits the counter they lost to before, and when it comes, they are already somewhere else.',
        'Whatever {loser} learned from beating {winner} before, {winner} learned more from losing.',
    ],
    ambush: [
        'AMBUSH: {attacker} comes out of the cover in {zone} before {victim} registers there was cover.',
        'AMBUSH: {victim} never hears {attacker} at all. The first they know of it is the blade.',
        'AMBUSH: {attacker} has been lying still in {zone} for an hour waiting for exactly this, and {victim} walks straight into it.',
        'AMBUSH: {attacker} takes {victim} from behind in {zone}. It is not a fight yet — it is a head start.',
        'AMBUSH: {victim} is watching the wrong direction. {attacker} makes sure it stays that way.',
        'AMBUSH: {attacker} closes the last ten feet in total silence, and {victim} finds out about it the hard way.',
    ],
    stalemate: [
        '{t1} and {t2} circle, breathing hard, and neither finds an opening.',
        'The exchange comes to nothing. {t1} and {t2} reset, watching hands.',
        'Both of them are too tired to close and too proud to walk. Nothing lands in {zone}.',
        '{t1} and {t2} feint at each other for a full minute and achieve nothing at all.',
        'Neither {t1} nor {t2} commits to the opening they both see. It closes again.',
        '{t1} and {t2} trade nothing but distance in {zone} for a long, tense minute.',
    ],
    retreat: [
        '{fleer} decides this is not the hill and breaks off, leaving {stayer} bleeding in {zone}.',
        '{fleer} disengages and runs. {stayer} does not follow far.',
        '{fleer} throws everything they are carrying at {stayer} and uses the second it buys to get clear.',
        '{fleer} takes the first gap that opens and is gone into the cover of {zone}.',
        '{fleer} decides being alive beats being right, and breaks contact with {stayer}.',
        '{fleer} breaks and runs, and {stayer} lets them go rather than chase into unknown ground.',
        '{fleer} is done. Whatever this was worth, it was not worth the rest of it.',
    ],
    mutualBreak: [
        '{t1} and {t2} break apart at the same moment, both bleeding, neither willing to finish it.',
        'It ends the way most of them do: {t1} and {t2} back away from each other, wrecked and alive.',
        '{t1} and {t2} run out of whatever was carrying them and simply stop, ten feet apart, in {zone}.',
        'Neither of them can finish it. {t1} and {t2} go opposite ways out of {zone}.',
        '{t1} and {t2} have both had enough at the same instant, and the fight simply ends.',
    ],
};

/** Group brawls: three or more tributes in one zone with nowhere to be polite. */
export const GROUP_COMBAT_TEXTS = {
    open: [
        'GROUP FIGHT: {names} all reach {zone} at once, and the arithmetic goes bad immediately.',
        'GROUP FIGHT: {zone} turns into a scrum — {names}, all of them at once.',
        'GROUP FIGHT: {names} collide in {zone}. Nobody has time to pick a side carefully.',
        'GROUP FIGHT: It starts with a shout in {zone} and then {names} are all in it.',
        'GROUP FIGHT: {names} meet in {zone} and every one of them decides the others started it.',
        'GROUP FIGHT: There is one way out of {zone} and {names} all want it. It goes the way that goes.',
        'GROUP FIGHT: {names} find each other in {zone} at the worst possible moment for everyone involved.',
        'GROUP FIGHT: Somebody moves first in {zone} — afterwards, nobody agrees who — and then {names} are all moving.',
        'GROUP FIGHT: The cover in {zone} was only ever hiding {names} from each other. It stops working all at once.',
        'GROUP FIGHT: {names} converge on the same cache in {zone}, and the cache stops mattering almost immediately.',
        'GROUP FIGHT: A twig, a breath, a glint of metal — something gives someone away in {zone}, and {names} all pay for it.',
        'GROUP FIGHT: {zone} is not big enough for {names}, and all of them reach that conclusion at the same time.',
        'GROUP FIGHT: The Gamemakers could not have staged it better: {names}, one clearing, no way past each other.',
        'GROUP FIGHT: {names} all break cover in {zone} at once, and there is a terrible second of everyone realising it.',
    ],
    gangUp: [
        '{attackers} converge on {target} together. It is not a fight so much as a decision.',
        '{target} is caught in the open by {attackers} and cannot cover every angle.',
        '{attackers} work {target} from three sides at once.',
        '{attackers} do not give {target} a direction to face.',
        '{target} keeps one of them off and the rest of {attackers} make that irrelevant.',
        'It is over before {target} understands the shape of it: {attackers}, moving as one thing.',
        '{attackers} herd {target} away from the cover first. The rest is method.',
        '{target} picks the biggest of {attackers} and goes down facing them. The Capitol notes it.',
        'There is a word for what {attackers} do to {target}, and nobody on the broadcast uses it.',
    ],
    scatter: [
        'The brawl in {zone} comes apart. {names} scatter into cover in different directions.',
        'Whatever that was in {zone}, it ends with {names} running the other way.',
        '{names} lose their nerve at the same moment and the fight in {zone} simply stops.',
        'Something breaks in the middle of it and {names} are all running.',
        'The numbers stop making sense to everyone at once, and {names} break for different exits of {zone}.',
        'A cannon somewhere else does it: {names} remember there are worse things loose than each other, and scatter.',
        'One of {names} runs first, and then all of them are running, and {zone} is empty inside a minute.',
        'The fight in {zone} dissolves rather than ends — {names} backing away, then turning, then gone.',
        'Nobody wins it. {names} bleed apart into the ground around {zone} and the cameras have to pick one to follow.',
    ],
    standDown: [
        '{names} all reach {zone} at once, recognise each other, and stand down.',
        '{names} converge in {zone} expecting a fight and find only allies.',
        'Weapons come up in {zone} and go down again — {names} know each other.',
        '{names} nearly kill each other in {zone} before anyone says a name. There is shaky laughter afterwards, of a kind.',
        'The moment in {zone} stretches, and then {names} lower their weapons more or less together.',
        'It almost happens in {zone}. Then somebody says the right name, and {names} let each other live.',
    ],
};

/** Training-floor reactions — the rest of the cast watching a rival score high. */
export const INTIMIDATION_TEXTS = [
    '{tribute} posts a {score} and the training floor goes quiet. Every tribute in the room recalculates.',
    'Word of {tribute}\'s {score} is around the Training Centre before dinner. Nobody sleeps well.',
    '{tribute}\'s {score} is the only number anyone repeats that night. It gets larger each time it is told.',
    'The {score} goes up under {tribute}\'s name and two alliances quietly re-open negotiations.',
    'A {score}. Half the cast decides to avoid {tribute} entirely; the other half starts planning for them.',
    '{tribute}\'s {score} makes the evening broadcast twice. In the Training Centre, nobody mentions it to their face.',
    'After {tribute}\'s {score} posts, the dinner tables go quieter. The arithmetic of the arena has a new largest number.',
    'Somebody asks {tribute} at breakfast how they got the {score}. {tribute} keeps eating, which is answer enough.',
];

/**
 * SIDE-05: the interview as three beats rather than one roll.
 *
 * Caesar's job on that couch is to find the thing the tribute did not intend to
 * say. The follow-up is where the persona is actually decided — a tribute walks
 * out with the angle they rehearsed only if they hold it under one question.
 */
export const CAESAR_FOLLOWUPS: Record<string, { question: string; held: string[]; broke: string[] }> = {
    'The Star-Crossed Lover': {
        question: "Caesar leans in: 'And if it comes down to the two of you out there?'",
        held: [
            "{tribute} does not blink. 'Then I hope they're the one who comes home.' The room makes a sound it has not made in years.",
            "'It won't,' {tribute} says, and says nothing else. Caesar lets it stand.",
            "{tribute} looks past Caesar, finds the right camera, and answers to the person on the other side of it instead. The Capitol swoons.",
            "'Ask me anything else,' {tribute} says softly, and Caesar — who has never in his life let a question go — lets this one go.",
            "{tribute} answers with the date of a promise the two of them made on the train. No one else knows what it means. That is the point.",
        ],
        broke: [
            "{tribute} opens their mouth and nothing comes out. The silence goes on a beat too long, and the audience watches the story come apart.",
            "'I — I'd do what I had to.' The front row shifts in its seats. That is not the answer anybody wanted.",
            "{tribute} laughs, one nervous note, at exactly the wrong moment. The romance loses half its buyers in a single second.",
            "{tribute} looks to the wings for help. The cameras follow the look. There is nobody there.",
            "'That's — we agreed not to talk about that.' Which is, everyone understands at once, an answer.",
        ],
    },
    'The Ruthless Warrior': {
        question: "Caesar smiles: 'Big words. Who in that arena actually worries you?'",
        held: [
            "'Nobody.' {tribute} lets it sit there, and the Careers in the wings stop finding it funny.",
            "{tribute} names three tributes, in order, and explains what they will do about each. Nobody laughs.",
            "{tribute} turns the question around: 'Who should?' Caesar consults his cards and finds no one.",
            "'The arena worries me,' {tribute} says. 'The people in it don't.' The bookmakers write it down verbatim.",
            "{tribute} lists their training scores from memory — everyone's, not just their own. The point lands.",
        ],
        broke: [
            "{tribute} names a Career and then, hearing it out loud, tries to take it back. The damage is done both ways.",
            "'I'm not — I mean, I'm not worried.' The 'I'm not' arrives half a second too late.",
            "{tribute} laughs the question off, and the laugh has an edge of something that is not laughter in it.",
            "{tribute}'s knee has not stopped moving the entire interview, and the camera operators have noticed too.",
            "'Next question,' {tribute} says, which is a thing you can only say once, and it was the wrong question to spend it on.",
        ],
    },
    'The Humble Underdog': {
        question: "Caesar, gently: 'What would you say to your district right now?'",
        held: [
            "{tribute} thanks their district by name, and then their mentor, and then somebody nobody has heard of. It costs nothing and buys everything.",
            "'That I'm going to try.' It is not a promise, and everyone in the room understands why they did not make one.",
            "{tribute} talks about what they'll do the morning after they get home, as if it were ordinary, and half the room decides to believe it.",
            "'They already know,' {tribute} says. 'We said everything before I left.' Caesar lets the quiet do the rest.",
            "{tribute} apologises for not being more interesting, and the apology is the most endearing thing said all night.",
        ],
        broke: [
            "{tribute} freezes at the question and manages 'thank you' twice. The applause is kind, which is worse.",
            "{tribute} recites something obviously written for them, and the Capitol can hear the punctuation.",
            "{tribute} starts to answer and then asks Caesar if they can start over. There are no second takes on live television.",
            "The answer trails off into a shrug. Humility reads as defeat when it stops being a choice.",
            "{tribute} thanks the Capitol instead of their district, and back home the square goes very quiet.",
        ],
    },
    'The Mysterious Enigma': {
        question: "Caesar tilts his head: 'You have told us nothing at all. Is that the plan?'",
        held: [
            "{tribute} smiles once and says nothing. The bookmakers move the line on a smile.",
            "'You'll see it when everyone else does.' Caesar throws up his hands and the crowd howls.",
            "Caesar tries three angles. {tribute} deflects all three, pleasantly, like closing doors. The line moves anyway.",
            "'No,' {tribute} says — to which question, no one is sure, and that is somehow the best answer of the night.",
            "{tribute} lets a pause run four full seconds and then thanks Caesar for the question without answering it. The sponsors take notes.",
        ],
        broke: [
            "Pressed, {tribute} fills the silence — and fills it, and keeps filling it. The mystery evaporates on live television.",
            "{tribute} explains the strategy. Out loud. On camera. To everyone.",
            "Needled, {tribute} answers one question honestly, and it is the one question they needed to keep.",
            "The silence stops reading as mystery and starts reading as having nothing to say. There is no way back from that in ninety seconds.",
            "Caesar guesses the plan on air, as a joke, and {tribute}'s face confirms it for free.",
        ],
    },
    'The Charming Flirt': {
        question: "Caesar grins: 'Half the Capitol is already in love. What do you want from them?'",
        held: [
            "'Everything,' {tribute} says, to the cameras rather than to Caesar, and the switchboard lights up.",
            "{tribute} answers with a question of their own and lets Caesar flounder for once. The crowd is delighted.",
            "{tribute} winks at the cheap seats and the expensive ones both. Everyone is sure it was meant for them.",
            "'Sponsors,' {tribute} says sweetly, 'I want sponsors.' The honesty is so shameless the room applauds it.",
            "{tribute} compliments Caesar's suit mid-answer without losing the thread, and the clip runs all night.",
        ],
        broke: [
            "{tribute} pushes it one line too far and the laughter turns into the other kind of laughter.",
            "The charm slips for a second and something much more frightened shows underneath it.",
            "{tribute} flirts with the wrong patron's box, and half the front row's smiles cool by several degrees.",
            "The lines are good but they are lines, and tonight the room can hear the rehearsal in them.",
            "{tribute} forgets a name they were supposed to remember. It was an important name.",
        ],
    },
    'The Arrogant Brute': {
        question: "Caesar, evenly: 'Some would call that arrogance.'",
        held: [
            "'Some would be right.' {tribute} does not smile, and neither does anybody else.",
            "{tribute} shrugs so completely that the question stops existing.",
            "'Arrogance is when you can't back it up.' {tribute} lets the sentence end there.",
            "{tribute} agrees with the word, spells it, and asks for the next question. It should not work. It works.",
            "{tribute} looks at the recap screen showing their training score and back at Caesar. That is the entire answer.",
        ],
        broke: [
            "{tribute} takes offence at the word and spends thirty seconds proving it fits.",
            "The comeback lands badly, and for the rest of the segment {tribute} is a large person in a chair.",
            "{tribute} argues with the premise, then with Caesar, then briefly with the audience. Nobody wins arguments with an audience.",
            "The boast comes out a size too big even for this room, and the laughter has teeth in it.",
            "{tribute} repeats the same boast twice, louder the second time, which is the opposite of proof.",
        ],
    },
    'The Quirky Oddball': {
        question: "Caesar, delighted: 'I have no idea what you are going to say next. Do you?'",
        held: [
            "{tribute} says something that makes no sense whatsoever and brings the house down.",
            "{tribute} answers a question Caesar did not ask, perfectly, and the Capitol decides it adores them.",
            "{tribute} produces something small from a pocket and gives it to Caesar with great ceremony. It is never explained. It does not need to be.",
            "{tribute} asks the audience a riddle and refuses to give the answer until after the Games. The bet slips write themselves.",
            "Halfway through the answer {tribute} switches to addressing the ceiling. Somehow the ceiling deserves it.",
        ],
        broke: [
            "The joke does not land. {tribute} tries it again, slower. It lands worse.",
            "{tribute} misjudges the room by a wide margin and finishes the answer into complete silence.",
            "The bit needs a partner and Caesar, for once, does not play along. It dies alone out there.",
            "{tribute} commits to the strange answer past the point the room stops enjoying it, and cannot find the exit.",
            "What was endearing in the training centre is, under the lights, just odd, and everyone can feel the difference.",
        ],
    },
    'The Silent Threat': {
        question: "Caesar, leaning forward: 'You have said almost nothing. Is there anything you want to say?'",
        held: [
            "{tribute} looks at the camera for a long moment and says only, 'You'll see.' The room does not breathe for a second.",
            "{tribute} shakes their head once, and the refusal to elaborate is more menacing than any threat could have been.",
            "'No.' A full second. 'Nothing.' Somehow it is the most quotable answer of the night.",
            "{tribute} looks slowly along the row of rival tributes in the wings, and does not say what they are counting.",
            "Caesar makes a joke to fill the quiet. {tribute} does not help him with it. The quiet wins.",
        ],
        broke: [
            "Pressed, {tribute} finally talks — too much, too fast, and the mystery collapses in real time.",
            "{tribute} tries to hold the silence and it curdles into something that just looks like nerves.",
            "Someone in the audience laughs during the pause, and the menace does not survive being laughed at.",
            "{tribute}'s hands give it away — the stillness everywhere else only makes them louder.",
            "Held too long, the silence stops being a message and becomes a person who does not know what to say.",
        ],
    },
    'The Grieving Sibling': {
        question: "Caesar, gently: 'Tell me about them.'",
        held: [
            "{tribute} does, briefly, steadily, and stops before it becomes too much. The room is with them the entire time.",
            "{tribute} says the name once more, clearly, so it is on the record. Caesar does not push further.",
            "{tribute} tells one small, specific story — a breakfast, an argument, a borrowed coat — and it does what no speech could.",
            "'They'd hate this suit,' {tribute} says, and the laugh and the ache arrive in the same breath.",
            "{tribute} promises nothing except to be worth the grief. The room stands.",
        ],
        broke: [
            "{tribute} cannot get through it and the segment has to be cut short. The sympathy is real and it is not the same as trust.",
            "{tribute} says too much, too raw, and the room's discomfort outweighs its sympathy.",
            "Caesar offers a handkerchief and the gesture becomes the story instead of the person it was for.",
            "{tribute} goes somewhere in the middle of the answer that the cameras cannot follow, and comes back to a room of strangers.",
            "The grief is real and the room is hungry for it, and watching {tribute} realise that is the worst moment of the night.",
        ],
    },
    'The Cold Strategist': {
        question: "Caesar: 'And if the plan falls apart on day one?'",
        held: [
            "'Then I have a second plan,' {tribute} says, without missing a beat, and the room believes them.",
            "{tribute} outlines a contingency in under ten seconds. It is unnervingly thorough.",
            "'Plans fall apart on day one. That's what day one is for.' The bookmakers adjust in {tribute}'s favour.",
            "{tribute} declines to share the plan but names, precisely, the three ways it could fail. The precision is the threat.",
            "{tribute} answers with a question: 'Whose plan do you think survives me?' Nobody offers a candidate.",
        ],
        broke: [
            "{tribute} has no answer ready, and the gap where a contingency should be is very visible.",
            "'It won't,' {tribute} says, with a confidence the room does not share.",
            "{tribute} explains the plan in enough detail that three other tributes in the wings quietly memorise it.",
            "Pressed on the contingency, {tribute} restates the original plan slightly slower.",
            "The word 'probably' gets into the answer and cannot be gotten back out.",
        ],
    },
    'The Reluctant Hero': {
        question: "Caesar, quietly: 'Are you afraid?'",
        held: [
            "'Yes,' {tribute} says, simply, and does not look away from the camera when they say it.",
            "{tribute} admits it without apologising for it, and the room respects the difference.",
            "'Anyone who isn't is lying to you,' {tribute} adds, and every camera cuts to the Careers to check.",
            "'Afraid of not coming home,' {tribute} says. 'Not of them.' The distinction lands hard.",
            "{tribute} names the exact thing they are afraid of, and it is so human the room forgets to applaud until too late.",
        ],
        broke: [
            "{tribute} tries to deny it and the denial does not land — everyone in the room can see it is not true.",
            "The admission turns into something closer to panic, live, on camera, and Caesar has to move the segment along.",
            "'No,' {tribute} says, and their own voice does not believe them, and everyone hears both things at once.",
            "{tribute} deflects with a joke about the arena food, and the joke is fine, and the fear is still sitting there when it ends.",
            "Asked a second time, gently, {tribute} just nods — and cannot stop nodding for a moment too long.",
        ],
    },
    'The District Loyalist': {
        question: "Caesar: 'What do you want District {district} to know?'",
        held: [
            "{tribute} says it directly to the camera, by name, and means every word of it.",
            "{tribute} thanks somebody specific back home, and the specificity is what makes it land.",
            "{tribute} describes the exact view from their front step at dusk, and twelve districts see their own.",
            "'Keep the shift schedule,' {tribute} says. 'I'll be back for mine.' The square back home erupts.",
            "{tribute} speaks for thirty seconds in the district's own idiom, untranslated, and does not explain it to the Capitol.",
        ],
        broke: [
            "The message comes out generic — the kind of thing anyone could say about any district — and the room can tell.",
            "{tribute} gets lost partway through and the message never actually arrives.",
            "{tribute} promises the district a victory in a voice that is asking them for one.",
            "The shout-out goes to the wrong neighbourhood — a small thing anywhere but home.",
            "{tribute} chokes on the district's name, of all words, and the moment everyone was waiting for passes unfinished.",
        ],
    },
    'The Wildcard': {
        question: "Caesar, half-laughing: 'I genuinely don't know what you're going to say.'",
        held: [
            "Neither does {tribute}, and what comes out is somehow exactly right anyway.",
            "{tribute} answers with something nobody expected and the room decides they like being surprised.",
            "{tribute} gives three different answers to the same question and dares the room to pick one. The room picks all three.",
            "{tribute} predicts, on air, exactly how Caesar will end the segment. Caesar, cornered, ends it exactly that way.",
            "Asked the standard question, {tribute} answers the one underneath it, and the interview is suddenly very interesting.",
        ],
        broke: [
            "The unpredictability finally lands on something that just does not work, and there is nowhere to go but forward.",
            "{tribute} swings and misses, visibly, and the room's patience for the bit runs out.",
            "The chaos stops looking like strategy and starts looking like a tribute who has no plan at all — because tonight, it is.",
            "{tribute} contradicts something they said thirty seconds earlier and the room catches it in real time.",
            "The gamble on a strange answer comes up empty, and there is no ordinary answer ready behind it.",
        ],
    },
};

/** Where a persona goes when the tribute cannot hold it under one question. */
export const PERSONA_DRIFT: Record<string, string> = {
    'The Star-Crossed Lover': 'The Humble Underdog',
    'The Ruthless Warrior': 'The Arrogant Brute',
    'The Humble Underdog': 'The Mysterious Enigma',
    'The Mysterious Enigma': 'The Quirky Oddball',
    'The Charming Flirt': 'The Quirky Oddball',
    'The Arrogant Brute': 'The Humble Underdog',
    'The Quirky Oddball': 'The Mysterious Enigma',
    'The Silent Threat': 'The Mysterious Enigma',
    'The Grieving Sibling': 'The Humble Underdog',
    'The Cold Strategist': 'The Ruthless Warrior',
    'The Reluctant Hero': 'The Humble Underdog',
    'The District Loyalist': 'The Humble Underdog',
    'The Wildcard': 'The Quirky Oddball',
};

export const INTERVIEW_CLOSERS = {
    strong: [
        "Caesar takes {tribute}'s hand and holds it up. 'District {district}, remember that face.' The applause runs past the buzzer.",
        "{tribute} stands, turns to the cameras rather than the crowd, and lets the silence do the last of the work.",
        "'Sixty seconds,' Caesar says, 'and I already want to bet on you.' The Capitol agrees loudly enough to hear in the training centre.",
        "The band comes in early and the crowd talks over it. Caesar has to raise his voice to get {tribute}'s name out at all.",
        "{tribute} is halfway off the couch before the applause starts, which somehow only makes it louder.",
        "Caesar keeps hold of {tribute}'s hand a beat longer than the format allows. In the wings, three other tributes watch him do it.",
        "'District {district},' Caesar says, and does not need to finish the sentence. The room finishes it for him.",
        "{tribute} walks off to a noise the Capitol usually saves for victors. Every mentor in the building notes the hour.",
        "The segment overruns by forty seconds and nobody in the control room cuts it. That has not happened this week.",
    ],
    weak: [
        "The buzzer catches {tribute} mid-sentence. Caesar covers it professionally and moves on.",
        "{tribute} leaves the couch to the applause the Capitol gives everybody, which is the least useful sound in Panem.",
        "Caesar says {tribute}'s name warmly, twice, which is what he does when there is nothing else to say.",
        "The band starts up over {tribute}'s last answer. Whatever the end of it was, District {district} will not hear it.",
        "{tribute} stands, and half the room is already looking at the next name on the card.",
        "Caesar thanks {tribute} for their time, which is the phrase he uses when the segment has run out of anything else.",
        "The applause for {tribute} is exactly as long as the applause for everyone, and in this room that is the whole verdict.",
        "{tribute} makes it to the wings without dropping anything or saying anything. Tonight that is the best that can be said.",
        "There is a beat after {tribute} sits down where Caesar could rescue it, and he decides not to spend the effort.",
    ],
};

/**
 * Parley: the outcomes that are neither a fight nor a friendship. See
 * `engine/parley.ts` — a standoff, a payment, or an agreement with a clock on it.
 */
export const PARLEY_TEXTS = {
    standoff: [
        '{t1} and {t2} see each other at the same instant in {zone}. Weapons come up. Nobody closes. They back out of the clearing the way they came in, watching each other the whole way.',
        'STANDOFF: {t1} and {t2} hold twenty feet apart in {zone} for a very long minute, and then both decide, separately, that today is not the day.',
        '{t1} and {t2} circle each other in {zone} without ever committing. Two people who have both done the arithmetic and both got the same answer.',
        'Neither {t1} nor {t2} wants to be the one who moves first in {zone}. Eventually they stop pretending either of them will.',
        '{t1} raises a hand — not a weapon, a hand — and {t2} lets them walk. It is not mercy. It is arithmetic.',
        'STANDOFF: {zone} holds two armed tributes and no fight. {t1} and {t2} leave by different routes and neither turns their back.',
    ],
    tribute: [
        '{weak} hands {strong} {item} in {zone} and is allowed to walk away. Everybody watching understands exactly what just happened.',
        '{strong} does not have to say anything in {zone}. {weak} works out the price on their own and pays it: {item}, handed over, no argument.',
        'It costs {weak} {item} to get out of {zone} alive. {strong} takes it without a word and lets them go.',
        '{weak} offers {item} before {strong} has finished closing the distance in {zone}. The Capitol finds this very entertaining.',
        'A toll, in everything but name: {weak} gives up {item} in {zone}, and {strong} steps aside.',
    ],
    truce: [
        'TRUCE: {t1} and {t2} agree, out loud and in {zone}, not to do this. Neither of them says for how long, and both of them are counting.',
        'TRUCE: {t1} makes the offer in {zone} and {t2} takes it. Not allies. Just two people who would both rather it were somebody else.',
        'TRUCE: whatever {t1} and {t2} say to each other in {zone}, they both lower their weapons at the end of it.',
        'TRUCE: {t1} and {t2} shake on nothing in {zone} — no alliance, no camp, no shared food. Only an agreement that today is not the day.',
    ],
    truceHeld: [
        '{t1} and {t2} pass each other in {zone} and neither reaches for anything. The agreement is holding.',
        '{t1} and {t2} nod once in {zone} and keep walking. Whatever they agreed, it is still worth more than the fight.',
        'There is a truce between {t1} and {t2}, and in {zone} it holds for one more day.',
        '{t1} and {t2} share {zone} for the better part of an hour and say nothing at all. Nothing is what they agreed on.',
        '{t2} could take {t1} in {zone} and both of them know it. {t2} does not. That is what the word was for.',
        'The truce between {t1} and {t2} costs them both something in {zone} today, and neither of them says what.',
        '{t1} steps aside in {zone} to let {t2} through. It looks like courtesy. It is a contract.',
        '{t1} and {t2} camp within sight of each other in {zone}, and both of them sleep badly, and neither of them moves.',
    ],
    /**
     * Going back on it. The prose has to sell that this was a decision rather
     * than a lapse — a truce that merely lapsed is what expiry is for.
     */
    truceBroken: [
        '{breaker} waits until {victim} has both hands full in {zone}, and then there was never any agreement at all.',
        'The truce ends in {zone} the way most of them do: {breaker} decides the arithmetic has changed, and does not mention it to {victim} first.',
        '{victim} turns their back in {zone} because there was an agreement. {breaker} has just stopped honouring it.',
        '"We said," {victim} gets out, in {zone}. {breaker} does not argue the point. Arguing would take longer.',
        '{breaker} breaks their word in {zone}, and the Capitol replays the handshake twice before showing what came after.',
        'Whatever {breaker} and {victim} agreed in front of the cameras, {breaker} is finished with it now, here, in {zone}.',
    ],
    /**
     * The toll paid by somebody carrying nothing — see PARLEY.tollInfo* in
     * balance.ts for why this shape of payment has to exist for extortion to
     * be reachable at all.
     */
    tributeInformation: [
        '{weak} has nothing in {zone} that {strong} wants, so they pay in directions instead: stay out of {told}. {strong} files it away and lets them go.',
        '{strong} searches {weak} in {zone}, finds nothing worth taking, and asks a question instead. {weak} tells them what happened in {told}.',
        'Empty pockets buy nothing in {zone}. {weak} buys their way out with {told} — what is in it, and what it cost to find out.',
        '"{told}," {weak} says in {zone}, and then says why. {strong} steps aside. Information is the only currency either of them has left.',
        '{weak} gives up the one thing they own in {zone}: knowing better than to go back to {told}. {strong} takes it.',
    ],
    /**
     * §4.1: a truce that reaches its expiry has to resolve on-screen. 80 of 84
     * negotiated truces used to simply evaporate from a Record with no line at
     * all — an entire negotiation subsystem whose overwhelmingly common outcome
     * was nothing observable. Silence was the bug.
     */
    truceRenewed: [
        '{t1} and {t2} find each other before the agreement runs out, and neither reaches for a weapon. The truce holds another stretch, because it has been working.',
        'The pact between {t1} and {t2} was due to lapse today. A look across open ground is the whole renegotiation: same terms, both still in.',
        'Against every instinct the arena has taught them, {t1} and {t2} renew the agreement. The commentators cannot decide if it is wisdom or weakness.',
        '{t1} owes {t2} nothing but a promise, and keeps it anyway. The truce rolls over, and the betting shops adjust.',
    ],
    truceLapsed: [
        'The truce between {t1} and {t2} runs out quietly. They part the way they met: armed, watchful, and alive because of a promise both of them kept.',
        'No handshake ends it. The agreement between {t1} and {t2} simply expires, and from tomorrow they are strangers with weapons again.',
        'Whatever {t1} and {t2} agreed, the clock on it has run out. Neither renews it. Neither breaks it. The arena takes note.',
        '{t1} and {t2} let the pact lapse. Each of them files away everything they learned about the other while it held.',
        'The truce is over. {t1} and {t2} both kept their word to the end of it, which in this arena counts as a kind of victory.',
    ],
    truceTurned: [
        'The truce between {t1} and {t2} expires in {zone}, and {t1} was counting the hours. The moment it lapses, the hunt is on.',
        '{t1} honoured the agreement to the letter — to the last minute of it. Now, in {zone}, {t2} discovers what the letter was worth.',
        'The pact runs out in {zone} and {t1} turns on {t2} before the echo of it fades. Technically, no promise was broken. Nobody in the Capitol is discussing the technicality.',
        '{t1} kept the truce like a blade kept sheathed. It expires in {zone}, and {t2} is still standing close enough to regret it.',
    ],
};

/** Settling up. See `engine/debts.ts` — somebody paying somebody back. */
export const DEBT_TEXTS = {
    repayItem: [
        '{debtor} puts the {item} into {creditor}\'s hands in {zone} without being asked. Neither of them mentions why.',
        '"You kept me alive," {debtor} says in {zone}, and gives {creditor} the {item}. That is the whole conversation.',
        '{debtor} has been carrying the {item} for {creditor} since {zone} stopped being dangerous. They hand it over now.',
        '{debtor} settles up in {zone}: the {item}, pressed on {creditor} until they take it.',
    ],
    repayWatch: [
        '{debtor} takes {creditor}\'s watch tonight without being asked, and the second one too. The ledger between them gets shorter.',
        '{creditor} wakes once in the night and finds {debtor} already sitting up, facing the dark. They go back to sleep.',
        '"Sleep," {debtor} says to {creditor}. "I owe you the hours." Neither of them argues the accounting.',
        '{debtor} has nothing to give {creditor} in {zone} but the watch, so they take it, all of it, and let {creditor} sleep.',
        '{debtor} owes {creditor} more than they own. In {zone} they pay what they can: {creditor} gets a full night for the first time since the gong.',
        '"Sleep," {debtor} tells {creditor} in {zone}. "I owe you one." It is not much and it is not nothing.',
    ],
};

/**
 * High-frequency survival and arena beats. These each used to be a single
 * hardcoded sentence at their call site, firing hundreds of times per run —
 * the heaviest repeat offenders in the whole chronicle. `ctx.pickText` never
 * got a chance because there was nothing to pick from.
 */
export const SURVIVAL_TEXTS = {
    /** T-4: exhaustion taking the turn a tribute would not give it. */
    microsleep: [
        '{tribute} comes to on their feet in {zone} with no idea how long they have been standing there. Long enough.',
        'Somewhere in {zone}, {tribute} blinks and loses a piece of the afternoon. The cameras keep rolling through it.',
        '{tribute} sits down in {zone} for a moment and is gone before their shoulders touch the ground.',
        'The exhaustion in {zone} finally collects what it is owed: {tribute} sleeps standing, for as long as their knees allow.',
        '{tribute} catches themselves falling in {zone}. They were asleep before they started to fall.',
        'For most of an hour {tribute} is not really in {zone} at all. Nothing finds them. It easily could have.',
    ],

    drinkClean: [
        '{tribute} drinks their fill from the water in {zone}.',
        '{tribute} kneels at the water in {zone} and drinks until their stomach aches.',
        '{tribute} cups water from {zone} with both hands, again and again.',
        '{tribute} finds the water in {zone} clear enough to trust and drinks deep.',
        '{tribute} lies flat at the edge of the water in {zone} and drinks like an animal.',
        '{tribute} refills at the water in {zone}, drinking slowly, watching the treeline the whole time.',
        '{tribute} takes a long drink in {zone}. For a moment the Games are just water and quiet.',
        '{tribute} drinks from {zone} in short, careful sips, the way the survival instructor said to.',
    ],
    drinkTreated: [
        '{tribute} treats water from {zone} before drinking it, and keeps it down.',
        '{tribute} does not like the look of the water in {zone}, purifies it, and drinks anyway.',
        '{tribute} boils the doubt out of the water in {zone} before letting themselves swallow.',
        '{tribute} works through the ritual — treat, wait, drink — with the water in {zone}.',
        'The water in {zone} smells wrong. {tribute} treats it first and gets it down.',
        '{tribute} makes the foul water of {zone} drinkable, which is not the same as pleasant.',
    ],
    craftStone: [
        '{tribute} spends an hour in {zone} knapping a stone into something with an edge.',
        '{tribute} sorts through rocks in {zone} until one splits into a usable edge.',
        '{tribute} grinds a shard of stone against another in {zone} until it will cut.',
        'Empty-handed in {zone}, {tribute} makes the oldest weapon there is: a sharp rock.',
        '{tribute} chips at a flint core in {zone}, swearing quietly, until it takes an edge.',
        '{tribute} comes out of {zone} with bloody knuckles and a stone that will open skin.',
    ],
    craftClub: [
        '{tribute} breaks a limb off a deadfall in {zone} and works it into a cudgel.',
        '{tribute} hauls a green branch down in {zone} and strips it into a club.',
        '{tribute} tests fallen wood in {zone} until one piece swings heavy and true.',
        'In {zone}, {tribute} makes a weapon the way the first tribute ever did: a length of hard wood.',
        '{tribute} snaps a sapling in {zone} and shaves it down to something that will break bone.',
        '{tribute} finds a root-club in the deadfall of {zone} and likes the weight of it.',
    ],
    craftReed: [
        '{tribute} cuts reeds in {zone} until one is straight enough, and dries the point over an hour of patience.',
        '{tribute} works a reed shaft down in {zone} and fire-dries the tip until it will hold an edge.',
        'The standing water of {zone} grows nothing useful except this: {tribute} comes out of it with a reed spear.',
        '{tribute} spends the afternoon in the shallows of {zone} choosing a shaft, and rejects nine before keeping one.',
        '{tribute} binds a hardened reed point with wet grass in {zone}. It will hold for a while. A while is the plan.',
        'It is a stick from a marsh, and {tribute} makes it a spear in {zone} because that is what {zone} has.',
    ],
    craftRebar: [
        '{tribute} works a length of reinforcing steel out of a broken wall in {zone} and tests the weight of it.',
        'The ruins of {zone} are held together with rusted bar. {tribute} takes a metre of it back out.',
        '{tribute} rocks a rebar stub loose in {zone} until the concrete gives, and walks away with a metre of steel.',
        '{tribute} finds the one thing {zone} was built with that outlasted {zone}: a rusted bar, and now it is theirs.',
        '{tribute} grinds one end of a steel bar against the concrete of {zone} until it is closer to a point than not.',
        'Nothing in {zone} grows and nothing in {zone} is soft. {tribute} arms themselves accordingly.',
    ],
    craftSling: [
        '{tribute} cuts their rope down to a pouch and two cords in {zone}, and spends the rest of the light learning the release.',
        '{tribute} unpicks a length of rope in {zone} and braids a sling out of it. The stones {zone} provides for free.',
        'A rope is worth more as a sling, {tribute} decides in {zone}, and cuts it up before they can talk themselves out of it.',
        '{tribute} whirls the finished sling twice in {zone} and puts a stone through a trunk at thirty paces. It is not much. It has reach.',
        '{tribute} sacrifices the rope in {zone} for something that lets them hurt somebody from further away than arm\'s length.',
    ],
    craftStake: [
        '{tribute} turns the cudgel over the fire in {zone} for an hour until the point is black and hard.',
        '{tribute} shaves the end of their club to a point in {zone} and cures it in the coals.',
        'The fire in {zone} does what {tribute} cannot: it takes a length of wood and makes it a weapon that holds a point.',
        '{tribute} works the cudgel down to a stake in {zone}, turning it in the flame the way they were shown at the fireside station.',
        '{tribute} spends a night in {zone} and a good fire on hardening a stick, which is a fair trade for both.',
    ],
    flee: [
        '{tribute} wants to be anywhere but {zone}.',
        '{tribute} has seen enough of {zone} and moves out fast.',
        '{tribute} puts {zone} behind them without looking back.',
        'Whatever {zone} was to {tribute}, it is over. They go.',
        '{tribute} leaves {zone} at a pace just short of running.',
        '{tribute} clears out of {zone}, checking over their shoulder the whole way.',
        'Staying in {zone} stopped being an option for {tribute}. They do not argue with the feeling.',
    ],
};

export const BORDER_TEXTS = {
    telegraph: [
        'The Gamemakers announce the border will close around {zone} by tomorrow. Anyone still there tonight is choosing to be.',
        'Klaxons, then the voice from everywhere: {zone} leaves the arena tomorrow. The Capitol likes its warnings public.',
        'The sky over {zone} flickers with the boundary grid. By tomorrow it will not be part of the Games.',
        'The announcement is almost polite: {zone} closes tomorrow. The tributes inside it hear it as a countdown.',
        'The border posts around {zone} begin their slow strobe — the Gamemakers\' way of saying tomorrow this ground is gone.',
        'A drone circuit traces the edge of {zone} in light. Everyone in the arena understands the message: out, by tomorrow.',
    ],
    collapse: [
        'BORDER COLLAPSE: {tribute} is caught inside the failing border of {trapped}. They take {damage} damage clawing their way into {safe}.',
        'BORDER COLLAPSE: the wall of light closes over {trapped} with {tribute} still inside. They come out the {safe} side burned for {damage} and lucky.',
        'BORDER COLLAPSE: {tribute} outruns the failing border of {trapped} by seconds, taking {damage} damage before falling into {safe}.',
        'BORDER COLLAPSE: {trapped} dies around {tribute} — ground, air, everything. They tear through to {safe} at a cost of {damage}.',
        'BORDER COLLAPSE: {tribute} gambles on one more minute in {trapped} and loses {damage} of themselves getting out into {safe}.',
    ],
};

/** S-5: the voice from the sky, when the Gamemakers want the board moved without touching it. */
export const GAMEMAKER_TEXTS = {
    announcement: [
        'GAMEMAKER: the sky clears its throat. "Attention, tributes. The Gamemakers thank you for your patience and remind you that the arena is not, in fact, infinite." Then nothing. Everyone stands very still for a while afterwards.',
        'GAMEMAKER: an announcement rolls across the whole arena in a voice designed to be pleasant. It says nothing anybody can act on, which is the point — it is a reminder that the sky can talk whenever it wants to.',
        'GAMEMAKER: "Congratulations to the remaining tributes." The voice from the sky lists no names and offers no terms. Somewhere a bird that is not a bird repeats the last three words for an hour.',
        'GAMEMAKER: the Capitol seal booms out over the arena and every tribute in it stops moving. The announcement that follows is entirely procedural. The stopping was the announcement.',
        'GAMEMAKER: the sky says there will be an event of interest shortly, does not say what, where or when, and goes quiet. The commentators call it masterful. The tributes call it nothing, out loud.',
    ],
};

/**
 * §8.3: Caesar as a running voice rather than a bookend.
 *
 * He hosts the interviews and he hosts the debrief, and in between the Games
 * happen without him — which is the wrong way round. The Capitol audience does
 * not watch an arena, it watches a broadcast, and the broadcast has a man in it
 * whose job is to make eleven hours of children starving in a forest feel like
 * an occasion. These are his desk lines: warm, tireless, professionally kind,
 * and once in a while letting slip something he covers a beat too late.
 *
 * Placeholders, by key. Anything not listed here is not substituted and will
 * print raw into the feed:
 *  - `openingDay`, `quietDay`, `nightfall`: `{alive}`, `{day}`
 *  - `afterDeath`: `{victim}`
 *  - `finalEight`, `finalThree`, `feastCalled`: none
 */
export const CAESAR_COMMENTARY = {
    /** Day 1-2. The broadcast finding its feet. `{alive}`, `{day}` available. */
    openingDay: [
        "CAESAR: 'Good morning, Panem. {alive} of them out there, all of them still learning where the water is. Stay with us.'",
        "CAESAR: 'Day {day} and already I can tell you this is not a quiet field. Look at them move.'",
        "CAESAR: 'They always look smaller on the first morning. Give it a day. They grow into it, every year.'",
        "CAESAR: 'Now, the odds board says one thing and my gut says another, and my gut has been wrong about eleven Games running.'",
        "CAESAR: 'Somebody in that arena is going to surprise us today. They always do. That is the whole reason we watch.'",
        "CAESAR: 'Look at that. Look at that. Forty seconds off the plate and already thinking two moves ahead.'",
        "CAESAR: 'The first day is the one nobody knows how to have. Watch who stops running first — that is your tribute to follow.'",
        "CAESAR: 'I have been doing this a long time and I still cannot call a Games from the opening morning. Neither can you. Isn't that marvellous.'",
        "CAESAR: 'Every one of them woke up this morning believing it. That does something to a broadcast, it really does.'",
    ],
    /** Nothing is happening and the desk has to fill. `{alive}`, `{day}` available. */
    quietDay: [
        "CAESAR: 'Quiet hour in the arena, and a quiet hour is where the good ones do their best work. Somebody out there is building something.'",
        "CAESAR: 'Now, some of you at home are asking why nobody is fighting. Because they are clever. Patience is a strategy, it is simply a strategy without a highlight reel.'",
        "CAESAR: '{alive} still with us, and not one of them has moved in twenty minutes. I find that thrilling. I understand if you do not.'",
        "CAESAR: 'While we wait, let me remind you of the training scores, which — and I say this every year — have never once predicted a winner.'",
        "CAESAR: 'They are all resting at the same time. That never lasts. Somebody always gets an idea.'",
        "CAESAR: 'Day {day} is doing what day {day} usually does, which is absolutely nothing until it does everything at once.'",
        "CAESAR: 'A slow afternoon is the Capitol's way of making tomorrow worth the wait. That is not me speaking for the Gamemakers. That is just true.'",
        "CAESAR: 'You can hear the arena on days like this. We do not often let you. Listen to that.'",
        "CAESAR: 'I am told the betting parlours are struggling. Good. A Games you can predict is not a Games, it is a schedule.'",
    ],
    /** A cannon has just been announced. `{victim}` available. */
    afterDeath: [
        "CAESAR: 'And there it is. {victim}. A cannon for {victim}, and Panem, that one had a real chance.'",
        "CAESAR: 'Oh. Oh, that is — that is {victim}, and I did not expect that today.' There is a pause before he finds the next sentence.",
        "CAESAR: '{victim} goes out fighting, which is the way you want to be remembered, and we will remember them.'",
        "CAESAR: 'A cannon. {victim}. Sixteen years old and braver than the room they interviewed in. We'll have the full tribute after the break.'",
        "CAESAR: 'That is {victim}, and I will be honest with you — I liked that one.' He smiles. 'They all have something. That one had rather a lot of it.'",
        "CAESAR: 'The board changes for {victim}. It always changes fast. Take a moment, Panem, and then let us look at what it means for the rest.'",
        "CAESAR: '{victim} lasted longer than anybody at this desk said they would, and I include myself in that, gladly.'",
        "CAESAR: 'And we say goodbye to {victim}. Somewhere a district is watching this. We do not forget that here.' A beat. 'Now — the odds.'",
        "CAESAR: 'One cannon changes the shape of everything. {victim} is gone, and every tribute still out there just became a different tribute.'",
    ],
    /** The field narrows to a manageable number. No placeholders. */
    finalEight: [
        "CAESAR: 'Final eight, Panem. From here on nobody is anonymous. We know all their names and so do they.'",
        "CAESAR: 'This is my favourite part of any Games. Eight left, and every single one of them has done something to earn it.'",
        "CAESAR: 'Eight. Which means the interviews start over — the families, the districts, the whole of it. Have your handkerchiefs ready.'",
        "CAESAR: 'The alliances do not survive the final eight. They never have. Watch the ones smiling at each other tonight.'",
        "CAESAR: 'Eight left, and I want you to notice that half of them were not on anybody's card a week ago.'",
        "CAESAR: 'Nobody gets to the final eight by luck. Not all the way here. Whatever else you say about them, they earned the number.'",
        "CAESAR: 'From here the arena gets smaller and the days get shorter. That is not a figure of speech.'",
        "CAESAR: 'Eight. If you have not picked somebody yet, pick now, because after tonight it stops being a choice and starts being a hope.'",
    ],
    /** Three left. No placeholders. */
    finalThree: [
        "CAESAR: 'Three. Panem, we are down to three, and I do not think anybody at this desk saw this three coming.'",
        "CAESAR: 'Three left. Two of them are not going home and all three of them know the arithmetic.'",
        "CAESAR: 'This is where they stop hiding. There is nowhere left that the Gamemakers have not thought of.'",
        "CAESAR: 'Whatever happens in the next day, remember it. Final threes are the ones people talk about twenty years on.'",
        "CAESAR: 'I have watched a great many of these and the final three never once looks like the one I predicted. Never once.'",
        "CAESAR: 'Three, and none of them sleeping. You can see it. They have that look.'",
        "CAESAR: 'The whole Capitol has stopped working. I am told the shops are shut. Three people in a forest have done that.'",
        "CAESAR: 'They have all come further than anybody let themselves say out loud on interview night. All three of them.'",
    ],
    /** The feast is announced. No placeholders. */
    feastCalled: [
        "CAESAR: 'A feast! The Gamemakers have called a feast, and Panem, nobody has ever come out of one of those the way they went in.'",
        "CAESAR: 'A feast. Which means everybody knows where everybody is going to be, at the same time, with something they all need.'",
        "CAESAR: 'Now this is television. Every tribute in that arena is doing the same sum right now and half of them are getting it wrong.'",
        "CAESAR: 'The Cornucopia again. It is always the Cornucopia. They walk out of it on the first day and they walk back into it in the end.'",
        "CAESAR: 'A feast, and the honest ones will tell you they are going whether it is a trap or not. It is always a trap. They always go.'",
        "CAESAR: 'The clever move is to stay away. Watch how many of them make the clever move.'",
        "CAESAR: 'Clear your afternoon. A feast has never once been dull, and I have seen every one of them.'",
        "CAESAR: 'The Gamemakers set the table and the tributes decide who sits. I could not have written it better, and believe me, I have tried.'",
    ],
    /** The anthem, the faces, the end of a day. `{alive}`, `{day}` available. */
    nightfall: [
        "CAESAR: 'The anthem, then. Faces in the sky, and {alive} still down there watching them go by.'",
        "CAESAR: 'Goodnight from the desk, Panem. They do not get to say goodnight to anybody, so we will say it for them.'",
        "CAESAR: 'The night is the long part. We cut away. They do not.'",
        "CAESAR: 'That is day {day}. Sleep well, all of you, and we will see what the morning has decided.'",
        "CAESAR: 'Nobody wins at night. But a great many of them lose at night, so do keep your screens on.'",
        "CAESAR: 'Look at the sky over that arena. Every one of those faces sat on my couch a week ago. Every single one.' He straightens his tie. 'Right. Tomorrow.'",
        "CAESAR: 'The temperature is dropping out there and the ones without fire are about to learn what that means.'",
        "CAESAR: 'Goodnight, Panem. {alive} of them going to sleep tonight in the most watched place in the world, entirely alone.'",
    ],
};

/**
 * §8.3: the audience as a thing the broadcast happens to.
 *
 * The Capitol is not a set of odds and a betting board — it is bars, streets,
 * viewing parties and children with painted faces, and what it does in a given
 * second is the fastest read on what the arena just did. A death lands
 * differently depending on whether the room cheers or goes quiet, and the
 * chronicle should be able to say which. No placeholders except `{tribute}`.
 */
export const CROWD_REACTIONS = {
    cheer: [
        'A Capitol bar comes off its stools all at once and stays standing for a full minute.',
        'The noise in the viewing squares carries three streets in every direction.',
        'Somebody in the Capitol pours champagne over somebody else in the Capitol, and neither of them minds.',
        'The studio audience is on its feet before the replay has even started, and it does not sit down for the replay either.',
        'A viewing party in the fashion district loses its composure entirely, which for that district is quite an admission.',
        'They are chanting {tribute}\'s name in a bar that could not have found their district on a map a week ago.',
        'The betting parlours erupt, and for once it is not about the money.',
        'Somewhere in the Capitol a crowd starts applauding and cannot explain to itself why it has not stopped.',
    ],
    hush: [
        'Every screen in a Capitol bar shows the same thing and nobody in it says a word.',
        'The studio audience makes a sound halfway to a gasp and then thinks better of finishing it.',
        'A viewing party goes quiet the way a room goes quiet when somebody drops something expensive.',
        'In the squares, the noise falls away in a ring outward from the nearest screen.',
        'A thousand people in a Capitol plaza hold still at once, waiting to be told what they just watched.',
        'The commentary track has nothing prepared for this, and for four seconds the broadcast is only the arena.',
        'Glasses go down on tables all over the Capitol and stay down.',
    ],
    outrage: [
        'A Capitol bar boos its own screen, which is a thing that happens perhaps twice a Games.',
        'The studio audience turns on the replay and has to be talked back down between segments.',
        'Somebody throws something at a viewing screen in a public square and is quietly removed.',
        'The Capitol decides, all at once and without discussion, that it did not care for that.',
        'The complaint lines to the broadcast light up, as if there were anyone at the other end who could undo it.',
        'A viewing party turns ugly about {tribute} and stays ugly long after the feed has moved on.',
        'For an hour the Capitol talks about nothing else, and none of it is kind.',
    ],
    heartbreak: [
        'A Capitol bar full of people who have never met a tribute cries about one anyway.',
        'The studio audience makes the small sound it makes when it has decided to be sad about something.',
        'Somewhere in the Capitol a child asks whether that means the tribute is coming back, and nobody answers.',
        'They put {tribute}\'s interview footage up on the plaza screens and a crowd stands in the cold to watch it through.',
        'A viewing party ends early. People collect their coats without much being said.',
        'The Capitol grieves the way it does everything, loudly and for about a day, and it is not entirely false.',
        'Flowers appear against the base of a screen in one of the squares by morning.',
    ],
};

/**
 * §8.3: district as a way of speaking, not only a number on a jacket.
 *
 * Twelve years of the same work leaves the same marks on the language as it
 * does on the hands. A District 12 tribute calls a hopeless prospect a dry
 * seam; a District 8 tribute says a plan is coming apart at the seams and means
 * something specific by it. Short phrases, so they can be dropped into dialogue
 * and banter without a line of setup. Industries follow `districts.ts`.
 */
export const DISTRICT_IDIOMS: Record<number, string[]> = {
    // Luxury goods: everything is appraisal, polish and what a thing is worth.
    1: [
        'that one is paste, not stone',
        'polish it and nobody asks what it is underneath',
        'you do not haggle over your own price',
        'cut well, set badly',
    ],
    // Masonry: load, courses, foundations, and what a wall does when you lean.
    2: [
        'built on sand, that plan',
        'you find the load-bearing one and you take it out',
        'straight courses, or the whole thing comes down',
        'that is a crack in the footing, not the render',
    ],
    // Technology: circuits, current, tolerances, and things that fail closed.
    3: [
        'that circuit is open at both ends',
        'run it and see what smokes',
        'they are wired in series, those two — take one, lose both',
        'no tolerance left in it',
    ],
    // Fishing: tides, nets, deep water, and knowing when to cut a line.
    4: [
        'wait for the tide, do not swim it',
        'that is a net with a hole in it',
        'cut the line before it takes the boat',
        'they are out past the shelf now',
    ],
    // Power: load, current, and the grid going down one station at a time.
    5: [
        'that is a short, not a fault',
        'somebody is drawing more than the line can carry',
        'the whole grid goes down from one bad relay',
        'it is running hot',
    ],
    // Transport: schedules, routes, couplings, and being long gone.
    6: [
        'that one is uncoupled already',
        'wrong line, wrong direction',
        'they are running ahead of schedule and it will cost them',
        'no track laid past here',
    ],
    // Lumber: the cut, the lean, and knowing which way a thing falls.
    7: [
        'that one is leaning, you just have to be ready when it goes',
        'you cut on the side you want it to fall',
        'rotten through, and green on the outside',
        'timber said too late is no warning at all',
    ],
    // Textiles: thread, seams, weave, and everything coming apart.
    8: [
        'coming apart at the seams',
        'one loose thread and the whole bolt runs',
        'that is a weak weave',
        'stitch it now or lose the piece',
    ],
    // Grain: seasons, lean years, threshing and what is actually in the sack.
    9: [
        'all chaff, that talk',
        'lean year, thin sack',
        'that field was never going to come in',
        'you do not eat next season\'s seed',
    ],
    // Livestock: herds, culls, penning, and the sound before a stampede.
    10: [
        'that herd is about to break',
        'they will cull the slow ones first',
        'pen them and they turn on each other',
        'you can hear it in them before they run',
    ],
    // Agriculture: the orchard, the harvest, and what is safe to put in a mouth.
    11: [
        'that fruit is bruised right through',
        'wait for it to ripen or waste it',
        'the ones that look best are the ones that kill you',
        'harvest comes whether you are ready or not',
    ],
    // Mining: seams, dark, bad air, and the sound a roof makes first.
    12: [
        'that is a dry seam',
        'bad air down that way',
        'the roof talks before it comes in',
        'you go down with the people you go down with',
    ],
};
