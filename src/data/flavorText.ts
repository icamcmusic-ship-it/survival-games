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
    'unarmed': [
        "{killer} strangles {victim} to death.",
        "{killer} beats {victim} to death with their bare hands.",
        "{killer} snaps {victim}'s neck in a brutal struggle.",
        "{killer} tackles {victim} off a ledge, surviving the fall while {victim} perishes.",
        "{victim} exhausts themselves fighting {killer}, who easily overpowers them."
    ],
    'trident': [
        "{killer} skewers {victim} with a three-pronged trident.",
        "{killer} traps {victim} against a wall with a trident and finishes them off.",
        "{killer} hurls a trident clean through {victim}'s chest.",
        "{victim} is cornered near the water and run through by {killer}'s trident."
    ],
    'crossbow': [
        "{killer} fires a crossbow bolt straight through {victim}'s skull.",
        "{victim} never hears the crossbow bolt that ends them.",
        "{killer} reloads calmly after dropping {victim} with a single bolt.",
        "{killer} lines up a perfect shot and drops {victim} from the treeline."
    ],
    'whip': [
        "{killer} lashes {victim} until they collapse, then finishes the job.",
        "{killer} disarms {victim} with a whip crack and closes in for the kill.",
        "{victim} is dragged off their feet by {killer}'s whip and overpowered."
    ],
    'machete': [
        "{killer} hacks through the brush and through {victim} in one motion.",
        "{killer} delivers a brutal machete strike to {victim}'s neck.",
        "{victim} is cut down mid-sprint by {killer}'s machete."
    ],
    'sickle': [
        "{killer} catches {victim} across the throat with a sickle.",
        "{killer} hooks {victim}'s leg with a sickle and finishes them on the ground.",
        "{victim} is caught off guard by {killer}'s curved blade."
    ],
    'warhammer': [
        "{killer} crushes {victim} under a single warhammer blow.",
        "{killer} shatters {victim}'s ribcage with a two-handed warhammer swing.",
        "{victim} is flattened before they can even raise a defense against {killer}."
    ],
    'blowgun': [
        "{killer} silently drops {victim} with a poisoned dart.",
        "{victim} never sees {killer} in the brush before the dart lands.",
        "{killer} waits patiently, then ends {victim} with a single blowgun shot."
    ]
};

export const INTERVIEW_SCENARIOS = [
    {
        strategy: "The Star-Crossed Lover",
        success: "{tribute} tells a heartbreaking story about a loved one back home. The audience is moved to tears.",
        failure: "{tribute} tries to act heartbroken, but it comes off as fake and manipulative.",
        charismaBuff: 1,
        trustMultiplier: 1.5
    },
    {
        strategy: "The Ruthless Warrior",
        success: "{tribute} displays cold confidence and promises a bloodbath. The Careers are impressed.",
        failure: "{tribute} tries to be intimidating but ends up looking like a try-hard.",
        charismaBuff: 0,
        trustMultiplier: 1.2
    },
    {
        strategy: "The Humble Underdog",
        success: "{tribute} speaks with genuine modesty and determination. Sponsors appreciate the sincerity.",
        failure: "{tribute} comes across as too weak and unlikely to survive the first hour.",
        charismaBuff: 1,
        trustMultiplier: 1.3
    },
    {
        strategy: "The Mysterious Enigma",
        success: "{tribute} gives short, cryptic answers that leave the audience wanting more.",
        failure: "{tribute} is so quiet that the interview becomes painfully awkward.",
        charismaBuff: 0,
        trustMultiplier: 1.1
    },
    {
        strategy: "The Charming Flirt",
        success: "{tribute} winks at the camera and flirts with the host. The Capitol crowd swoons.",
        failure: "{tribute} tries to be charming, but completely misreads the room.",
        charismaBuff: 2,
        trustMultiplier: 1.4
    },
    {
        strategy: "The Arrogant Brute",
        success: "{tribute} openly mocks the other tributes. The Capitol loves the drama.",
        failure: "{tribute} insults the Capitol audience and is met with dead silence and boos.",
        charismaBuff: -1,
        trustMultiplier: 0.8
    },
    {
        strategy: "The Quirky Oddball",
        success: "{tribute} goes on a bizarre but endearing tangent about district life. The crowd finds it hilarious.",
        failure: "{tribute} mumbles incoherently. Caesar Flickerman has to quickly change the subject.",
        charismaBuff: 1,
        trustMultiplier: 1.2
    }
];

export const SURVIVAL_TEXTS = {
    fleeBloodbath: [
        "{tribute} sprints away from the Cornucopia without looking back.",
        "{tribute} realizes they are outmatched and flees the starting bloodbath.",
        "Panicking, {tribute} scrambles into the wild to avoid the initial slaughter.",
        "{tribute} trips in the chaos but manages to escape the Cornucopia."
    ],
    fleeWithItem: [
        "{tribute} snatches a {item} and sprints into the wilderness.",
        "{tribute} narrowly dodges an attack, grabbing a {item} before escaping.",
        "{tribute} raids the outskirts of the Cornucopia for a {item} and runs."
    ],
    hideEvasive: [
        "{tribute} camouflages themselves in the brush in {zone}.",
        "{tribute} finds a dark crevice in {zone} and hides quietly.",
        "{tribute} stays perfectly still in {zone}, hoping no one walks by.",
        "{tribute} covers themselves in mud in {zone} to avoid detection."
    ],
    campDefensive: [
        "{tribute} sets up a small, hidden camp in {zone} and rests.",
        "{tribute} patches up their gear while resting safely in {zone}.",
        "{tribute} climbs a tall vantage point in {zone} to sleep for the night.",
        "{tribute} builds a makeshift shelter in {zone}."
    ],
    huntAggressive: [
        "{tribute} aggressively stalks through {zone}, hunting for other tributes.",
        "{tribute} lays a trap in {zone} and waits for prey.",
        "{tribute} sharpens their weapon, daring anyone to approach them in {zone}."
    ],
    forageSuccess: [
        "{tribute} forages in {zone} and successfully finds a {item}.",
        "{tribute} discovers a hidden cache in {zone} containing a {item}.",
        "{tribute} follows animal tracks in {zone} and scavenges a {item}."
    ]
};

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

export const SYSTEM_TEXTS = {
    sponsorGifts: [
        "A silver parachute floats down to {tribute} carrying a {item}!",
        "{tribute}'s sponsor pulls through, sending them a much-needed {item}.",
        "{tribute} hears a faint beep. A pod arrives containing a {item}."
    ],
    feastAnnouncements: [
        "CLAUDIUS TEMPLESMITH: 'Attention Tributes! A feast will be held at the Cornucopia tomorrow at dawn. Come for the items you desperately need.'",
        "The Gamemakers sound the horn, announcing a grand Feast. The promise of salvation tempts the starving tributes."
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
