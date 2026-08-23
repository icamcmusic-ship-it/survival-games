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
];

/**
 * §6.8: the reaping-day line — how they came to be standing on that plate.
 *
 * Four hardcoded strings in the generator became four one-line stories told
 * identically every Games. Each is a pool now, and the categories the square
 * actually produces — the faint, the silence, the parent held back, the escort
 * getting the name wrong — get lines of their own. Placeholders: {district}
 * always; {blurb} in the Career pool (the district craft's blurb, lowercase
 * mid-sentence); {partner} in the pair-bond pool.
 */
export const REAPING_NOTE_TEXTS = {
    tesserae: [
        'Their name was in the bowl {slips} times — {tesserae} of those slips bought grain, one winter at a time. Everyone in the square knew whose names the bowl was heavy with.',
        '{slips} slips carried their name, and {tesserae} of them were the price of keeping a family fed. The odds were never in their favour; the odds were purchased against them, a tessera at a time.',
        'The escort drew one slip out of {slips} that said the same name, {tesserae} of them signed for grain. Nobody in District {district} calls that bad luck.',
        'They took the tesserae every year the family needed it, and this year the arithmetic came due: {slips} slips in the bowl, {tesserae} of them bought with hunger.',
        'A rich child stands in that square with one slip a year. This one stood with {slips}, {tesserae} of them traded for grain, and the bowl did what bowls full of a poor family\'s name eventually do.',
        'The grain those {tesserae} extra slips bought is long since eaten. The slips were still in the bowl — all {slips} of them — and one of them came out.',
    ],
    careerVolunteer: [
        'Volunteered before the escort had finished reading the card — {blurb}, and eighteen years of waiting for their turn.',
        'Volunteered. The academy decided months ago whose year this was, and the reaped child stepped down before the applause had even settled.',
        'Volunteered the way District {district} volunteers: loudly, first, and with the academy rows chanting the name before the stage was reached.',
        'Volunteered. The card in the escort\'s hand never mattered — {blurb}, and everyone in that square knew the name that would answer it.',
        'Volunteered off the academy\'s front row, exactly on cue. In District {district} the reaping is a formality with a bowl in it.',
        'Volunteered at a dead run, taking the steps two at a time. Whoever the slip actually named will spend the rest of their life grateful and never once say so.',
    ],
    siblingVolunteer: [
        'Volunteered for a sibling. District {district} has not had a volunteer in living memory, and the crowd did not applaud — they touched three fingers to their lips instead.',
        'Volunteered for a sibling — stepped in front of the stage before the name had finished echoing, and would not be moved. The square went silent the way a square only goes for this.',
        'Volunteered the moment their sibling\'s name was read. The escort asked twice to be sure. They said it louder the second time.',
        'Volunteered for a younger sibling, and the two of them had to be pulled apart at the steps. The cameras kept the shot; District {district} will never forgive them for it.',
        'Volunteered for a sibling with a voice that did not shake until afterwards, in the goodbye room, where the cameras could not follow.',
        'Volunteered for family. It is the only reason anyone volunteers in District {district}, and everyone in the square understood it before the sentence was finished.',
    ],
    pairBond: [
        'Reaped as one half of a bonded pair with {partner}. Neither of them chose the other, and it will not matter.',
        'Bound to {partner} by this year\'s rules before either of them had left the square. The Capitol calls it a twist; District {district} calls it two children instead of one.',
        'Reaped alongside {partner} under the pair rule, and made to stand together on the stage while the escort explained what that will mean. Neither reacted, which took more than reacting would have.',
        'One half of a bonded pair with {partner}. They looked at each other exactly once on the stage, and whatever passed between them was not for the cameras.',
        'Paired with {partner} by a rule neither had heard of before the escort read it out. The square had no idea how to respond, so it did not.',
    ],
    // The square's other stories — assigned when nothing louder happened.
    stunnedSilence: [
        'When the name was read, the square made no sound at all — not a gasp, not a shuffle. The escort waited for a reaction that never came, and moved on.',
        'Nobody reacted to the name. Not the crowd, not the family, not even them — a whole square deciding together that if they did not respond, it might not be true.',
        'The silence after the name lasted long enough that the broadcast cut to the escort\'s face. District {district} gave the cameras nothing, which was the point.',
    ],
    defiantWalk: [
        'Walked to the stage slowly — unhurried, head level, making the whole square and every camera wait. It is the only protest the reaping permits, and they used all of it.',
        'Took the steps at their own pace, without help and without hurry, and looked at the escort until the escort looked away.',
        'Did not cry, did not stumble, did not blink. Walked up like the stage owed them something, and half of District {district} stood a little straighter watching it.',
    ],
    fainted: [
        'Went down on the second step — flat, sudden, the whole square lurching forward against the ropes. They finished the walk two minutes later, grey-faced, refusing the Peacekeeper\'s arm.',
        'Fainted when the name was read and had to be carried the first ten metres. The Capitol replayed it all evening; District {district} turned its screens off.',
        'Their legs quit before their face did. They sat down in the aisle, got up unaided, and made the stage on the second attempt — which is its own kind of resolve.',
    ],
    parentHeldBack: [
        'A parent broke the rope line before the name had finished echoing, and it took three Peacekeepers to hold them. The tribute walked the rest of the way not looking back, because looking back would have finished them.',
        'Their mother had to be restrained at the barricade, and the sound she made followed them all the way up the steps. The microphones caught every second of it.',
        'A father\'s voice came out of the crowd once — one word, their name — and then the sound of him being quieted. The stage pretended not to hear. Nobody else in District {district} did.',
    ],
    allyShouted: [
        'A friend from their crew shouted something from the roped section as they climbed the steps — quick, in district slang, and the escort did not understand a word of it. They visibly did.',
        'Somebody their age yelled their name from the back of the square, once, like a promise. They did not turn around, and their shoulders came down half an inch.',
        'Half their work gang was in the square, and every one of them shouted together the moment the name was read. The Peacekeepers let it go. Some things are cheaper to allow.',
    ],
    escortMispronounced: [
        'The escort mispronounced the name — twice, differently each time — and they had to walk to the stage anyway, to a version of themselves that does not exist. District {district} will not forget it.',
        'The escort got the name wrong, and they corrected it from the floor of the square, clearly, before walking up. It was the first thing the Capitol learned about them.',
        'The name the escort read was theirs the way a Capitol accent makes anything theirs — barely. They answered to it because somebody had to, and the square hated every syllable.',
    ],
    tooCalm: [
        'Reacted to the name with a nod, as if a question they had been expecting had finally been asked. It unsettled the square more than tears would have.',
        'Was halfway to the aisle before the escort finished reading, as though they had counted the slips themselves and knew. The calm read strangely on camera, and the commentators noticed.',
        'Handed their jacket to the person beside them, said something short, and walked up. Whatever they had been carrying that morning, they had evidently already set it down.',
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
