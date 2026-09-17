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
    // §1.1: districts 13-16 had no entry here at all, so a reaping in the
    // expanded Games simply skipped the square scene for four whole districts.
    13: 'District 13 assembles on the shell-line yard, in ranks, because that is the only way District 13 assembles. Nobody coughs. Half of them cannot help it.',
    14: 'The District 14 square is the loading floor of the cold house, and the Capitol did not think to turn the refrigeration off. Everyone stands in their own breath for an hour.',
    15: 'District 15 gathers on the annealing floor with the furnaces banked but not out. The heat comes up through everyone\'s boots the entire time the escort is talking.',
    16: 'District 16 holds its reaping on the supply pier, because half the district is offshore and the other half is waiting for them. The names are read twice: once for the square, once over the radio.',
};

/*
 * §5 (requests): `REAPING_REACTIONS` lived here — three pools of thirty-odd
 * lines describing how each tribute took the news, drawn once per tribute and
 * logged immediately beside their reaping note. That is the "reaping extra
 * flavour" the request names: twenty-four lines a run, none of which said
 * anything the tribute's own sheet does not, all of them in the register the
 * request asks to be rid of. The square's crowd line above and the one
 * factual note per tribute are what is left, and they are the record.
 */


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
    '{tribute}\'s sister gets one sentence out before the Peacekeepers move her. It is the sentence {tribute} keeps.',
    'A neighbour {tribute} barely knows comes in with bread and does not explain why, and leaves without saying anything else.',
    '{tribute}\'s father does not touch them until the last ten seconds, and then will not let go until he is made to.',
    '{tribute} is told to win. The word sits in the velvet room afterwards like something dropped.',
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
    '{tribute} finds the compartment with the window that opens and is told, politely, that it does not.',
    '{mentor} puts the recaps on again and makes {tribute} name every tribute in them. {tribute} gets nineteen of twenty-three.',
    '{tribute} asks how long the journey is and is told, and spends the rest of it not asking anything else.',
    'Somebody on the train tells {tribute} what the Capitol smells like. {tribute} does not believe them until the doors open.',
    '{tribute} washes for the first time in hot water on the train and stays in it until somebody knocks.',
    '{mentor} tries the speech they have given four times before, and {tribute} listens to all of it, which nobody usually does.',
    '{tribute} counts the districts going past the window and stops when they run out of ones they can name.',
    'The escort talks the whole way. {tribute} does not hear a word of it and is grateful for the noise anyway.',
    '{tribute} eats nothing on the train and drinks four glasses of water, which their mentor notes and does not comment on.',
    '{tribute} sleeps for eleven hours on the train and wakes up further from home than anyone in their family has ever been.',
    '{mentor} shows {tribute} the footage of their own Games, once, without saying anything, and turns it off before the end.',
    '{tribute} writes something on a napkin on the train and puts it in a pocket, and it is still there at the reaping of the Games after this one.',
];

/** Stylists, and the angle they take at the Remake Center. */
export const STYLISTS = [
    'Cinna Vela', 'Portia Ashgrove', 'Octavia Lune', 'Flavius Marr', 'Venia Sol',
    'Tigris Snow', 'Lucian Frost', 'Delphine Kray', 'Castor Vine', 'Aurelia Pike',
    'Marcus Quill-Vane',
    'Sable Odain',
    'Perenna Glass',
    'Junius Hale',
    'Corvina Mire',
    'Atticus Brine',
    'Lysandra Pell',
    'Rufus Crane',
    'Vesper Alaine',
    'Gaius Thorne',
    'Nerissa Vale',
    'Bellamy Roche',
    'Caspia Wren',
    'Drusilla Fane',
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
    { angle: 'in mourning', line: '{stylist} dresses {tribute} in funeral black, for everyone the Games have taken. The Capitol finds it delicious. The districts find it something else.', pull: 2.5 },
    { angle: 'as royalty', line: '{stylist} crowns {tribute} and drapes them in a cape that takes up half the chariot. The crowd cheers the audacity of it.', pull: 1.5 },
    { angle: 'in smoke', line: '{stylist} wreathes {tribute} in cold grey smoke, so the crowd only catches them in glimpses. By the fountain, half the Capitol is craning for a look.', pull: 2 },
    { angle: 'barefoot', line: '{stylist} sends {tribute} out plainly dressed and barefoot, the way the district actually works. It is quiet, and it lands harder than the fireworks either side of it.', pull: 1 },
    { angle: 'in glass', line: '{stylist} builds {tribute} a costume of hanging glass that chimes with the chariot. It is beautiful, fragile, and everyone watching understands the metaphor.', pull: 1.5 },
    { angle: 'matched', line: '{stylist} dresses {tribute} and their district partner as two halves of one design, and the pair of them are worth more together than either alone. The sponsors take note.', pull: 2 },
    { angle: 'in mourning', line: '{stylist} dresses {tribute} entirely in black and gives them nothing to hold. The avenue goes quiet in patches as the chariot passes, which no stylist has managed in years.', pull: 2.5 },
    { angle: 'as a child', line: '{stylist} makes no attempt to make {tribute} look older. The Capitol finds this either unbearable or delicious, and there is no way to tell which until the sponsor lines open.', pull: 1.5 },
    { angle: 'in the district\'s own dirt', line: '{stylist} sends {tribute} down the avenue unwashed, in working clothes, exactly as District {district} looks on a Tuesday. It is the most shocking thing on the road.', pull: 1.5 },
    { angle: 'armoured', line: '{stylist} puts {tribute} in something that looks like it was built to stop a blade. It is a promise to the sponsors and a warning to the other chariots.', pull: 2 },
    { angle: 'unadorned', line: '{stylist} does almost nothing to {tribute} at all, and the restraint reads, to about a third of the avenue, as contempt for the whole exercise.', pull: 0.5 },
    { angle: 'in water', line: '{stylist} rigs {tribute} with something that catches and sheets light like running water. It photographs better than anything else on the avenue and says nothing whatsoever about District {district}.', pull: 1.5 },
    { angle: 'as the last victor', line: '{stylist} dresses {tribute} as the last tribute District {district} sent home. Half the Capitol gets the reference immediately and the other half has it explained to them twice.', pull: 3 },
    { angle: 'in the Capitol\'s own colours', line: '{stylist} puts {tribute} in Capitol colours, which is either flattery or something much sharper, and the commentary desk spends the evening arguing about which.', pull: 1 },
];

/**
 * §5/§12 (requests): the reaping-day line, stripped to the facts.
 *
 * This was seven pools of decoration and four of information. The decoration
 * pools — the stunned square, the defiant walk, the faint, the parent held
 * back, the friend who shouted, the escort who got the name wrong, the tribute
 * who took it too calmly — are gone entirely: none of them told the reader
 * anything about the tribute that the tribute's own sheet does not already
 * say, and two thirds of the roster arrived carrying one, which made the
 * roster read as a short story collection rather than a list of people.
 *
 * What is left is the four cases that are *facts about how this tribute came
 * to be on the plate*, and each of them now states that fact and stops.
 * "Volunteered at a dead run, taking the steps two at a time. Whoever the slip
 * actually named will spend the rest of their life grateful and never once say
 * so." became "Volunteered. District 2 fields a volunteer most years."
 *
 * Placeholders: {district} always; {blurb} in the Career pool; {partner} in
 * the pair-bond pool; {slips}/{tesserae} in the tesserae pool.
 */
export const REAPING_NOTE_TEXTS = {
    tesserae: [
        'Name in the bowl {slips} times. {tesserae} of those slips were taken for grain.',
        '{slips} slips, {tesserae} of them tesserae.',
        'Took tesserae {tesserae} times. That put {slips} slips in the bowl under their name.',
        'Drawn from {slips} slips. {tesserae} were signed for grain rations.',
    ],
    careerVolunteer: [
        'Volunteered. Trained at the District {district} academy — {blurb}.',
        'Volunteered before the escort finished reading the card. Academy-trained.',
        'Volunteered. District {district} fields a volunteer most years and this was the one they put forward.',
        'Volunteered off the academy roster. The reaped tribute stood down.',
    ],
    siblingVolunteer: [
        'Volunteered in place of a sibling.',
        'Volunteered for a younger sibling whose name was drawn.',
        'Volunteered for a sibling. District {district} has had no other volunteer in living memory.',
    ],
    pairBond: [
        'Reaped as one half of a bonded pair with {partner}, under this year\'s rule.',
        'Bound to {partner} by the pair rule. Both were reaped from District {district}.',
        'One of a bonded pair with {partner}.',
    ],
};

/**
 * §6.9: the district token — the one thing from home a tribute is allowed to
 * carry into the arena. Pressed into their hands in the goodbye room, stored on
 * the tribute, and it surfaces again where it matters: on the sheet, at the
 * death, in the victor's hands. One pool per district; the object is always
 * small, always legal, and always heavier than it weighs.
 */
export const DISTRICT_TOKENS: Record<number, string[]> = {
    1: [
        'a flawed gemstone, the one reject their family\'s workshop was allowed to keep',
        'a ring of gold wire, plaited from bench scraps swept up over a year',
        'a glass bead their mother wore at her own reaping',
        'a sliver of polished onyx on a silk cord',
        'a tiny silver clasp, the first piece they ever finished unsupervised',
        'a cufflink with the family maker\'s mark stamped inside it',
        'a drop pearl that never sold, worn smooth from being worried at',
        'a coil of gold thread tied into a knot with no name',
    ],
    2: [
        'a chip of marble from the quarry face their father cut',
        'a whetstone the size of a thumbnail, worn hollow in the middle',
        'a lead soldier from the academy, one arm long gone',
        'a square of granite polished to a mirror, small enough to swallow',
        'an old Peacekeeper button with the crest worn to a shadow',
        'a plumb bob on a foot of string, their grandfather\'s',
        'a shard of slate with a mountain scratched into it',
        'a knuckle of iron ore that has been in the family longer than anyone can say',
    ],
    3: [
        'a resistor on a loop of wire, banded in their birth-year colours',
        'a vacuum tube that still lights if you warm it in your hands',
        'a fragment of circuit board sanded smooth as sea glass',
        'a magnet the size of a coin that has held the family\'s notes to the stove for years',
        'a watch mechanism with no watch around it, still ticking',
        'a coil of copper wire bent into a ring',
        'a key to a factory door that no longer exists',
        'a glass fuse, blown, kept from the night the whole block went dark together',
    ],
    4: [
        'a fish hook filed from a nail, their first',
        'a knot of green sailcloth from a boat that came home when it should not have',
        'a cowrie shell drilled for a cord, worn by three generations of reapings',
        'a scale from a fish nobody believed the size of, lacquered stiff',
        'a wooden float carved with the family boat\'s name',
        'a twist of tarred netting tied into a bracelet',
        'a shark tooth on a leather lace',
        'a compass needle, unhoused, that still finds north on a still day',
    ],
    5: [
        'a stub of copper busbar, buffed until it shines like an award',
        'a glass insulator bead from the first pylon their mother strung',
        'a switch toggle from a decommissioned board, kept for luck through every shift since',
        'a filament bulb the size of an acorn, unbroken',
        'a meter dial with the needle stuck forever at full',
        'a knot of rubber cable insulation braided into a ring',
        'a brass terminal screw their father carried through his whole working life',
        'a sliver of turbine blade, no bigger than a leaf',
    ],
    6: [
        'a punched ticket from the only passenger train they ever rode',
        'a rail spike ground down to the size of a finger',
        'a brass hub cap from a child\'s wagon, polished to sunlight',
        'a length of engine chain, three links, worn like a bracelet',
        'a compass with a cracked face that still swings true',
        'a station token from a stop the maps stopped printing',
        'a valve cap their brother turned into a whistle',
        'a scrap of timetable with one departure circled in pencil',
    ],
    7: [
        'a curl of cedar shaving that still smells of the cut',
        'an acorn from the tree behind their house, drilled and strung',
        'a whittled songbird small enough to close a fist around',
        'a wedge of heartwood from the biggest fell their crew ever brought down',
        'a knot of pine resin gone amber-hard, with a midge caught in it',
        'a carved thimble of birch, their grandmother\'s',
        'a sliver of their own axe handle, snapped the week before the reaping',
        'a maple seed that spins when you drop it, kept flat in a fold of paper',
    ],
    8: [
        'a spool of thread wound from the last of their mother\'s good silk',
        'a scrap of the first bolt of cloth they ever wove, hemmed to a square',
        'a brass thimble with a dent for every year of their apprenticeship',
        'a button from a coat that went to somebody who needed it more',
        'a braided cord of every colour the mill dyed that year',
        'a needle case carved from a loom shuttle',
        'a patch of quilt from the bed they were born in',
        'a ribbon that has been re-tied on every birthday since their first',
    ],
    9: [
        'a single head of wheat, dried whole and wrapped in cloth',
        'a worry-stone of bread crust, fired hard as pottery in the oven',
        'a mill token, good for one grind, never spent',
        'a corn dolly the size of a finger, plaited at last year\'s harvest home',
        'a scythe stone worn crescent-thin',
        'a knot of straw braided into a ring on their last morning in the fields',
        'a seed head of barley kept from the best year anyone remembers',
        'a heel of flour sacking with the family\'s stencil still legible',
    ],
    10: [
        'a brass bell no bigger than an acorn, off the first lamb they raised',
        'a plait of mane hair from a horse who will notice they are gone',
        'a brand token stamped with the family\'s mark',
        'a knot of rawhide tied by their father, never untied',
        'a river-worn stone from a trough where every animal they ever raised has drunk',
        'a shirt button carved from cattle horn',
        'a feather from a rooster mean enough to be famous in three counties',
        'a coil of fence wire bent into a ring',
    ],
    11: [
        'a peach stone, sanded satin-smooth over years in a pocket',
        'a seed packet, folded shut, of a flower their mother never had ground to plant',
        'a plaited grass ring from the orchard rows',
        'a dried apple blossom pressed flat in a scrap of waxed paper',
        'a pecan shell half worn to velvet',
        'a thumb-length of sugar cane, cut the morning of the reaping',
        'a scrap of head-cloth in the pattern their grandmother wore into the fields',
        'a smooth black bean their little brother swore was lucky',
    ],
    12: [
        'a lump of coal with a fern fossil caught in it, sharp as a photograph',
        'a canary feather sealed in a locket that will not open anymore',
        'a mine tag stamped with their father\'s shift number',
        'a shard of lamp glass from the seam, worn soft-edged in a pocket',
        'a knot of blackberry root from the fence line of the Meadow',
        'a button of pressed coal dust and resin, made in the school workshop',
        'a pinch of Seam earth in a twist of cloth, tied with mending thread',
        'a fragment of pit pony harness brass, polished to gold',
    ],
    // §1.1: without these rows no tribute reaped out of 13-16 ever received a
    // district token at all, which silently disabled the 'The Token'
    // achievement path for a quarter of an expanded reaping.
    13: [
        'a spent primer cap, the first one they ever seated correctly',
        'a graphite stub worn to the length of a thumbnail',
        'a strip of measuring tape, the eleven inches their mother cut off for them',
        'a shell casing with a name punched into the base that is not theirs',
        'a fuse cord tied in a ring, the length of one safe second',
        'a dosimeter badge that never turned, kept for luck',
        'a lead weight from the assay bench, exactly one ounce',
        'a folded requisition slip signed by somebody who is dead now',
    ],
    14: [
        'a salt crystal the size of a knuckle, grown in the family evaporation pan',
        'a cold-house key for a door that was bricked up years ago',
        'a strip of cured hide, soft from a decade of handling',
        'a brine hydrometer float, glass, impossibly light',
        'a nail of frost-blackened iron pulled from the old pier',
        'a twist of preserving twine their grandmother tied and never explained',
        'a thermometer bulb with the scale rubbed off it',
        'a pressed flower that has been in the cold store so long it is still perfect',
    ],
    15: [
        'a cullet chip in a colour the works stopped making',
        'a glass bird with one wing shorter than the other, their own first attempt',
        'a punty scar disc, snapped off a piece their father signed',
        'a lens ground for spectacles nobody ever collected',
        'a marble with a spiral in it that catches the light wrong',
        'a shard of annealed pane, edges fired smooth so it cannot cut',
        'a thimble of silica sand from the pit their family has worked for four generations',
        'a fused lump of two colours that were never meant to touch',
    ],
    16: [
        'a drill bit tooth, blunted, on a bootlace',
        'a fathom of sounding line with the marks still knotted into it',
        'a fish hook with the barb filed off so it cannot catch anything',
        'a piece of pressure glass from a gauge that failed at depth',
        'a shell dredged up from further down than anything is supposed to live',
        'a brass rig tag stamped with a crew number that is one short now',
        'a knot their mother taught them, tied in a loop of hawser and never undone',
        'a vial of the black water they pulled up on the day they were born',
    ],
};

/**
 * §(requests 21): the salute.
 *
 * `three-fingers` has been in the achievement table reading the reaping notes
 * for a district gesture that no pool has ever written — so it could not be
 * earned, and the check reported it as unreachable. The gesture is the most
 * recognisable thing a district does at a reaping; it belongs in the square.
 */
export const DISTRICT_SALUTE: string[] = [
    'Nobody applauds. One by one, the whole square raises three fingers to {tribute}, and holds them there until the escort stops waiting.',
    'The crowd in District {district} presses three fingers to their lips and lifts them towards {tribute}. The broadcast cuts away from it as fast as it can.',
    'An old woman at the front raises three fingers. Then the row behind her. Then the whole of District {district}, in silence, at {tribute}.',
    'Every hand in the square goes up with three fingers on it. {tribute} does not manage to keep their face still, and the Capitol feed holds on it a beat too long.',
    'The three-finger salute goes up across the square for {tribute}. It is illegal in nothing and permitted in nothing, and the Peacekeepers look at the floor.',
    'The district gives {tribute} the old salute — three fingers, no sound — and the anchor has to talk over it, and does, badly.',
    'Three fingers, raised at {tribute} by a square that has not made a sound since the name was read.',
    'A boy at the back raises three fingers at {tribute} before anybody else does, and gets the whole square to follow him.',
];
