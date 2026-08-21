/**
 * The half of the source material that happens before the arena.
 *
 * SIDE-06: the pre-Games was three clicks — a static grid of names, a training
 * roll, an interview roll. No district crowd, no reaction when a name is read,
 * no goodbye room, no train, no Remake Center, no stylists, no chariot parade.
 * That is roughly half the page count of the books and all of the reason the
 * audience cares who any of these people are before they start dying.
 */

/** How a district square behaves when the escort reaches into the bowl. */
export const REAPING_CROWDS: Record<number, string> = {
    1: 'The square in District 1 is decorated like a holiday. Being reaped here is a career opportunity and everybody present treats it as one.',
    2: 'District 2 fills its square early. The academy stands at the front in matching rows, and every one of them is hoping.',
    3: 'District 3 gathers under the factory floodlights, silent, counting. They have done the arithmetic on their own odds and they do not like it.',
    4: 'The District 4 square smells of salt and engine oil. There is applause when the escort steps up, and it is genuine.',
    5: 'District 5 assembles between the cooling towers. The Peacekeepers outnumber the families in the front rows.',
    6: 'District 6 stands in the rail yard because there is nowhere else that holds them all. Nobody looks at the stage.',
    7: 'The District 7 square is sawdust underfoot. Whole crews come straight from the cut, still carrying their axes, and are made to leave them at the barricade.',
    8: 'District 8 packs into a square too small for it. Somebody faints in the third row before the escort has finished the anthem.',
    9: 'District 9 lines up between the grain silos in the heat, and the escort reads the card quickly because of it.',
    10: 'District 10 gathers in the stockyard. The smell is the same as every other day and so are the faces.',
    11: 'District 11 is the largest square in Panem and the most heavily guarded. The Peacekeepers walk the aisles the entire time.',
    12: 'The District 12 square is roped off in front of the Justice Building. Everyone knows everyone, which is the worst part of it.',
};

export const REAPING_REACTIONS = {
    child: [
        '{tribute} does not move until a Peacekeeper takes their arm. Somewhere behind them a woman starts screaming and is helped out of the square.',
        '{tribute} walks to the stage the way children walk to the front of a classroom, and the square makes no sound at all.',
        'A boy in the fourteens tries to get to {tribute} and is put on the ground for it.',
        '{tribute} looks for their mother in the crowd and cannot find her. They stop looking before they reach the steps, which is worse.',
        'The escort has to say the name twice. {tribute} heard it the first time; their legs simply did not.',
        '{tribute} carries a stuffed animal to the stage because no one thought to take it from them. The cameras cannot get enough of it.',
        'Somebody in the square starts the three-finger salute for {tribute}, and by the time the anthem plays the whole district is holding it.',
        '{tribute} asks the escort a question on the way up the steps. The microphone does not catch it, and the escort does not answer.',
        '{tribute} is small enough that the Peacekeeper walking them up looks like a parent taking a child to their first day of school. The broadcast lingers on it.',
        'The mayor will not meet {tribute}\'s eyes during the anthem. Nobody on that stage will.',
        '{tribute} waves at someone in the crowd because they do not fully understand yet. The square understands for them.',
        'When the escort asks for volunteers for {tribute}, the silence lasts four full seconds. The cameras count every one of them.',
    ],
    ordinary: [
        '{tribute} climbs the steps without being told twice. Their district watches them do it.',
        '{tribute} finds a face in the crowd, holds it for exactly as long as they can, and then looks at the escort instead.',
        '{tribute} says something to the girl beside them before they go. Nobody on the broadcast hears what.',
        '{tribute} takes a breath at the bottom of the steps that the whole square hears, and then takes the steps.',
        '{tribute} nods once — at nobody, at everybody — and walks up like someone reporting for a shift.',
        '{tribute} stumbles on the second step and recovers. It is the only thing about them the Capitol commentators will remember.',
        'The escort offers {tribute} a hand up the steps. {tribute} does not take it.',
        '{tribute}\'s friends push to the rope line to see them go. None of them can think of anything to shout.',
        '{tribute} stands on the stage looking at the roofs of their district like they are memorising them. They are.',
        '{tribute} keeps their hands still at their sides the entire time, which costs them more than the square will ever know.',
        'A dog follows {tribute} to the barricade and has to be held back. It is somehow the hardest thing anyone in the square has watched all morning.',
        '{tribute} mouths something to the sky before the anthem. The commentators decide it was a prayer. It was a name.',
    ],
    hardened: [
        '{tribute} is on the stage before the escort has finished saying the name, and looks out at the square like they own it.',
        '{tribute} takes the steps two at a time. The Capitol cameras like that very much.',
        '{tribute} shakes the escort\'s hand. Half the square applauds and the other half does not.',
        '{tribute} rolls their shoulders on the way up like someone stepping into a ring, because that is exactly what this is.',
        '{tribute} smiles at the cameras before they smile at their district, and everybody watching notices the order.',
        '{tribute} raises a fist on the stage. The academy rows answer it. The rest of the square does not.',
        '{tribute} looks bored during the anthem, and it is not an act, and the commentators cannot decide if they love it.',
        'The applause for {tribute} starts before their name is fully read. The betting shops in the Capitol hear it and adjust.',
        '{tribute} finds the nearest camera and holds it for a slow three-count. The sponsors will remember that.',
        '{tribute} pats the escort on the shoulder like a colleague. The escort visibly does not know what to do about it.',
        '{tribute} does not look at their family once. They have been told not to, and they were told by someone who has done this before.',
        '{tribute} steps up onto the stage and immediately checks the other name, the way a fighter checks a card. The square notices; the Capitol notices harder.',
    ],
};

export const GOODBYE_SCENES = [
    'Three minutes in the Justice Building. {tribute}\'s family says almost nothing useful and every word of it will be remembered.',
    '{tribute} is given a token from home — small enough to be allowed, heavy enough to matter — and told to keep it where nobody can take it.',
    'Nobody comes for {tribute}. They sit in the velvet room by themselves for the full three minutes and then stand up when the door opens.',
    '{tribute}\'s mother makes them promise to try. {tribute} promises, and both of them know what the promise is worth.',
    'A neighbour comes instead of family, and spends the three minutes explaining exactly how to find water. It is the most useful thing anyone says to {tribute} all week.',
    '{tribute} is told to win. Just that, over and over, until the Peacekeepers come.',
    '{tribute}\'s father does not cry, which {tribute} has never seen before either.',
    'The three minutes are mostly silence. On the way out, {tribute}\'s brother finally says the thing, and the door closes on the second half of it.',
    '{tribute} spends the whole visit comforting the people who came to comfort them. It is good practice for the interview.',
    'Someone {tribute} barely knows from school comes, and cries harder than the family did. {tribute} never learns why.',
    '{tribute}\'s little sister will not let go of their sleeve. A Peacekeeper has to unpick her fingers one at a time.',
    'The family brings food from home. Nobody eats it. It sits on the velvet cushion like an accusation.',
    '{tribute} gives their coat away in the goodbye room. Where they are going, somebody else will need it more.',
    '{tribute} is handed a folded note and told not to read it until the arena. They read it on the train. It says what notes like that always say.',
    'An old woman who once lost her own child to the Games comes to sit with {tribute}. She does not say a word, and it helps more than anything else does.',
    '{tribute} asks their family to not watch. All of them promise. None of them will keep it.',
    'The whole three minutes goes to practical things — boots, blisters, which berries lie. Love, in the only grammar the district knows.',
    '{tribute} memorises the room instead of the faces, because the room is easier.',
    '{tribute}\'s best friend swears loudly through the door after time is called. The Peacekeepers pretend not to hear it, which is the closest thing to kindness in the building.',
    'Nobody in the goodbye room says the word "win". They say "come home", which is a different and harder instruction.',
];

export const TRAIN_SCENES = [
    '{tribute} eats better on the train than they have in their life, and is quietly sick afterwards.',
    '{tribute} spends the journey at the window watching a country they were never allowed to see.',
    '{tribute} does not sleep. The compartment is soft and warm and moving, and none of that helps.',
    '{tribute} watches every second of the reaping recaps, twice, taking notes on the faces.',
    '{mentor} finds {tribute} on the train and says one true thing. It is not encouraging, and it is the reason {tribute} lasts as long as they do.',
    '{tribute} pockets bread rolls from the dining car out of habit, and then remembers there will always be more, and then keeps them anyway.',
    'The tunnels through the mountains take an hour. {tribute} spends all of it in the dark deciding who they are going to be when the doors open.',
    '{tribute} tries every button in the compartment once, methodically, like an inventory. Some habits are worth keeping.',
    '{mentor} deals cards across the dinner table and beats {tribute} eleven hands straight. "That," says {mentor}, "is what the arena is like."',
    '{tribute} asks the escort what the Capitol is like, and gets twenty minutes on restaurants. It is somehow exactly what they needed.',
    'Somewhere past midnight {tribute} finds the other tribute from their district awake in the dining car. Neither mentions it in the morning.',
    '{tribute} washes their hands four times on the train. The district does not come off.',
    'The recaps play {tribute}\'s own reaping and they watch themselves walk to the stage like a stranger. The stranger looks calmer than they remember being.',
    '{mentor} makes {tribute} list everything they are good at, and does not let them stop until the list is longer than {tribute} believed it was.',
    'The train slows through a district that is not theirs, and the people in the fields do not look up. {tribute} understands: the train only means one thing.',
];

/** Stylists, and the angle they take at the Remake Center. */
export const STYLISTS = [
    'Cinna Vela', 'Portia Ashgrove', 'Octavia Lune', 'Flavius Marr', 'Venia Sol',
    'Tigris Snow', 'Lucian Frost', 'Delphine Kray', 'Castor Vine', 'Aurelia Pike',
    'Fabrizia Plume', 'Cassia Bellwether', 'Percival Gauze', 'Livia Mordant', 'Aureus Trill',
    'Solene Vitrine', 'Marcellus Drape', 'Oleander Fen', 'Vespera Chine', 'Crispin Volaille',
    'Junia Lamé', 'Sabellius Ort', 'Thessaly Grave', 'Pomponia Wick',
];

export const CHARIOT_ANGLES = [
    { angle: 'on fire', line: '{stylist} sends {tribute} down the avenue wrapped in synthetic flame. The Capitol has never seen the district done like this and will not stop talking about it.', pull: 3 },
    { angle: 'in mirrors', line: '{stylist} puts {tribute} in a costume that throws the crowd\'s own faces back at them. It is unsettling and it is completely unforgettable.', pull: 2.5 },
    { angle: 'as their district', line: '{stylist} dresses {tribute} in something honest about District {district}. It is dignified, it photographs well, and it is not what the Capitol came for.', pull: 1 },
    { angle: 'in gold', line: '{stylist} gilds {tribute} head to foot. It is obvious, it is expensive, and it works exactly as well as obvious and expensive usually does.', pull: 1.5 },
    { angle: 'in feathers', line: '{stylist} builds {tribute} something enormous out of feathers and wire. Half the avenue adores it; the other half laughs.', pull: 0.5 },
    { angle: 'as a warning', line: '{stylist} sends {tribute} out looking like something that has already killed. The cheering falters in places, which is the point.', pull: 2 },
    { angle: 'badly', line: '{stylist} misjudges it completely, and {tribute} spends the parade visibly uncomfortable in front of the entire Capitol.', pull: -1.5 },
    { angle: 'plainly', line: '{stylist} does almost nothing to {tribute} at all, and the cameras find somebody else within seconds.', pull: -0.5 },
    { angle: 'in living light', line: '{stylist} threads {tribute}\'s costume with something bioluminescent that pulses with their heartbeat. The avenue can see exactly how afraid they are, and loves them for it.', pull: 2.5 },
    { angle: 'in armour', line: '{stylist} sends {tribute} down the avenue in ceremonial plate half a millimetre thick. It protects nothing and promises everything.', pull: 1.5 },
    { angle: 'in mourning', line: '{stylist} dresses {tribute} in funeral black, for everyone the Games have taken. The Capitol finds it delicious. The districts find it something else.', pull: 2 },
    { angle: 'as royalty', line: '{stylist} crowns {tribute} and drapes them in a cape that takes up half the chariot. The crowd cheers the audacity of it.', pull: 1.5 },
    { angle: 'in smoke', line: '{stylist} wreathes {tribute} in cold grey smoke, so the crowd only catches them in glimpses. By the fountain, half the Capitol is craning for a look.', pull: 2 },
    { angle: 'barefoot', line: '{stylist} sends {tribute} out plainly dressed and barefoot, the way the district actually works. It is quiet, and it lands harder than the fireworks either side of it.', pull: 1 },
    { angle: 'in glass', line: '{stylist} builds {tribute} a costume of hanging glass that chimes with the chariot. It is beautiful, fragile, and everyone watching understands the metaphor.', pull: 1.5 },
    { angle: 'matched', line: '{stylist} dresses {tribute} and their district partner as two halves of one design, and the pair of them are worth more together than either alone. The sponsors take note.', pull: 2 },
    { angle: 'in water', line: '{stylist} sheathes {tribute} in something that runs and pools like water and never quite settles. The avenue keeps watching to see where it goes.', pull: 2 },
    { angle: 'in ash', line: '{stylist} sends {tribute} out grey from head to heel, as though the district had already burned. It is not a costume so much as an argument.', pull: 2 },
    { angle: 'in white', line: '{stylist} puts {tribute} in unbroken white, and every camera on the avenue understands what white is for. Nobody says the word out loud.', pull: 1.5 },
    { angle: 'in machinery', line: '{stylist} builds {tribute} a costume of working gears that turn as the chariot turns. The Capitol adores anything that moves by itself.', pull: 1.5 },
    { angle: 'as a child', line: '{stylist} dresses {tribute} exactly their own age, which nobody has done in years, and the avenue goes strange and quiet in patches.', pull: 2 },
    { angle: 'in thorns', line: '{stylist} wraps {tribute} in black briar that catches the light and looks like it would cost you a hand. The front rows lean back.', pull: 2 },
    { angle: 'in the district\'s colours', line: '{stylist} sends {tribute} down in District {district}\'s working colours and nothing else, and the district watching at home sits up. The Capitol shrugs.', pull: 0.5 },
    { angle: 'overdressed', line: '{stylist} loads {tribute} with so much construction that they can barely stand upright in the chariot. It photographs magnificently and it is agony.', pull: 0.5 },
    { angle: 'in salvage', line: '{stylist} assembles {tribute}\'s costume out of scrap from District {district} and makes it look like treasure. The critics call it the cleverest thing on the avenue.', pull: 2 },
    { angle: 'unfinished', line: '{stylist} sends {tribute} out with the costume deliberately half-made, pins and all. Half the Capitol thinks it is a disaster and half of them think it is genius.', pull: 1 },
    { angle: 'in the dark', line: '{stylist} kills every light on the chariot but one, and {tribute} comes down the avenue as a single moving point. It is the quietest thing all night and nobody looks away.', pull: 2.5 },
];
