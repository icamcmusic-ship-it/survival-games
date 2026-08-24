/**
 * T-7: per-tribute quirks — non-mechanical idiosyncrasies that make two
 * tributes with identical traits read as different people.
 *
 * Traits are the mechanical personality layer (53 of them, all with numbers
 * attached). Quirks are the other thing a person is: the habit the cameras
 * find, the line the commentators repeat, the detail a viewer remembers after
 * the name is gone. `label` shows on the tribute sheet; `lines` occasionally
 * surface from the idle beat of a quiet cycle, with `{name}` and `{zone}`
 * filled in.
 */
export interface Quirk {
    label: string;
    /**
     * §11.2: variants, not one fixed line.
     *
     * Every quirk carried exactly one line, and the idle beat draws from a
     * tribute's own one or two quirks — so a tribute who idles often repeated
     * their single quirk sentence verbatim inside a run, which is the exact
     * failure `test:flavor` guards every other pool against. Read through
     * `quirkLine()` rather than indexed directly, so a pool of any depth works.
     */
    lines: string[];
}

/** One line for this quirk, drawn without immediately repeating the last. */
export function quirkLine(quirk: Quirk, pick: (pool: string[]) => string): string {
    return pick(quirk.lines);
}

export const QUIRKS: Quirk[] = [
    {
        label: 'counts the days out loud',
        lines: [
            '{name} counts the days under their breath in {zone}, the way they have since the gong.',
            'The count reaches a number {name} does not like in {zone}, and they say it again anyway, out loud, to make it true.',
        ],
    },
    {
        label: 'will not sleep near water',
        lines: [
            '{name} moves their bedroll twice in {zone}, further from the sound of water each time.',
            'There is water audible somewhere in {zone} and {name} has arranged their whole camp so that it is behind them.',
        ],
    },
    {
        label: 'always takes the high ground',
        lines: [
            '{name} climbs before they rest in {zone}. They always climb first.',
            '{name} will not settle in {zone} until they are above something. Anything. The lip of a rock will do.',
        ],
    },
    {
        label: 'talks to the cameras',
        lines: [
            '{name} finds a camera in {zone} and says something to it the microphones do not quite catch.',
            '{name} looks directly into a lens in {zone} and holds it, for longer than is comfortable for anybody watching.',
        ],
    },
    {
        label: 'never turns their back on a treeline',
        lines: [
            '{name} crosses {zone} sideways, eyes on the treeline the whole way.',
            'Halfway across {zone}, {name} stops and turns fully around to look back at the trees. Nothing is there. There never is.',
        ],
    },
    {
        label: 'hums their district anthem',
        lines: [
            'Somewhere in {zone}, {name} is humming — an old district tune, barely voiced.',
            'The tune comes out of {name} in {zone} before they notice they have started it, and they let it finish before they stop.',
        ],
    },
    {
        label: 'keeps a pebble from home',
        lines: [
            '{name} turns a small stone over in their fingers in {zone}. It came from home. It goes back in the pocket.',
            '{name} loses the stone in {zone} for a bad thirty seconds, finds it in the wrong pocket, and does not speak for a while after.',
        ],
    },
    {
        label: 'sharpens everything twice',
        lines: [
            '{name} checks an edge in {zone} that was already sharp, and sharpens it anyway.',
            'The blade goes over the stone in {zone} more times than the edge needs. {name} counts the passes, and the count is always the same.',
        ],
    },
    {
        label: 'eats in exact halves',
        lines: [
            '{name} splits their food into exact halves in {zone} and wraps one. They always wrap one.',
            '{name} cannot bring themselves to eat the wrapped half in {zone}, even hungry, even now. It is for later. There is always a later.',
        ],
    },
    {
        label: 'names the mutts',
        lines: [
            '{name} mutters a name at a distant shriek in {zone} — they have been naming the things that hunt them.',
            'A shriek carries across {zone} and {name} says a name back at it, conversationally, as though answering.',
        ],
    },
    {
        label: 'sleeps sitting up',
        lines: [
            '{name} settles for the night in {zone} with their back to something solid, upright, the way they always do.',
            '{name} finds the one upright surface in {zone} and puts their spine against it before they will consider sleeping.',
        ],
    },
    {
        label: 'reads the sky before anything else',
        lines: [
            'First thing {name} does in {zone} is look up, for a long moment, at whatever the sky is pretending to be.',
            '{name} is on their back in {zone} reading a sky that is a machine, looking for weather in it the way you would at home.',
        ],
    },
    {
        label: 'walks their camp perimeter three times',
        lines: [
            '{name} walks the edge of their ground in {zone} three times. Exactly three.',
            'Three circuits of the ground in {zone}, and then {name} stops, unsatisfied, and does a fourth. Something about tonight is off.',
        ],
    },
    {
        label: 'never says the fallen’s names',
        lines: [
            'Someone mentions the anthem in {zone} and {name} goes quiet. They never say the names.',
            'The anthem plays over {zone}, and {name} moves their lips through none of it.',
        ],
    },
    {
        label: 'braids or knots something when thinking',
        lines: [
            '{name} sits in {zone} working knots into a cord, tying and untying, thinking.',
            'The cord in {name}\'s hands in {zone} has been tied and untied so many times it has gone soft.',
        ],
    },
    {
        label: 'tastes rain',
        lines: [
            'It is barely drizzling in {zone}, and {name} stands in it with their face up anyway.',
            '{name} tips their head back in {zone} with their mouth open, briefly, and looks about nine years old doing it.',
        ],
    },
    {
        label: 'keeps their laces double-tied',
        lines: [
            '{name} stops mid-stride in {zone} to re-tie a lace that did not need it.',
            '{name} checks both laces in {zone} before standing up, and both again after.',
        ],
    },
    {
        label: 'collects one thing from every zone',
        lines: [
            '{name} pockets something small in {zone} — a leaf, a bolt, a shell. They have one from everywhere they have been.',
            '{name} turns something small over in their fingers in {zone} — from here, from this ground — and it goes into the pocket with the rest.',
        ],
    },
    {
        label: 'apologises to plants they cut',
        lines: [
            '{name} takes what they need from the undergrowth in {zone} and says something quiet to it after.',
            '{name} cuts what they need out of {zone} and then puts a hand flat on the stump for a second, which the microphones do not pick up.',
        ],
    },
    {
        label: 'refuses to drink first',
        lines: [
            '{name} lets the water sit in {zone}, watching it, before they will touch it. Every time.',
            '{name} waits out a full minute over the water in {zone}, watching for something to move in it, before they will lower their face.',
        ],
    },
    {
        label: 'marks the trees as they pass',
        lines: [
            'A thumbnail scratch on bark in {zone}: {name} marking where they have been, or the way back.',
            'A fresh scratch on a trunk in {zone}, at exactly shoulder height, exactly like the last one. {name} is leaving themselves a sentence.',
        ],
    },
    {
        label: 'stretches like an athlete before moving',
        lines: [
            '{name} runs through the same slow stretches in {zone} they must have done every morning of their life.',
            'Before {name} moves out of {zone}, they run the same sequence they have run every morning of their life, and their body cooperates.',
        ],
    },
    {
        label: 'whistles one note when the coast is clear',
        lines: [
            'One flat note carries across {zone}. {name}, telling nobody in particular it is safe.',
            'One clean note out of {zone}. It means nothing to anybody left alive to hear it, and {name} whistles it anyway.',
        ],
    },
    {
        label: 'keeps score against the arena',
        lines: [
            '{name} adds a scratch to their bracer in {zone}. Not kills — days the arena has failed to kill them.',
            'Another mark on the bracer in {zone}. {name} looks at the row of them for a moment and appears, briefly, to be winning.',
        ],
    },
    {
        label: 'always faces the Cornucopia when they rest',
        lines: [
            '{name} settles in {zone} facing, as ever, the direction of the horn.',
            '{name} turns their bedroll in {zone} until it points at the horn, and only then lies down on it.',
        ],
    },
    {
        label: 'chews on a stalk of grass',
        lines: [
            '{name} picks a stalk in {zone} and works it between their teeth, the way half their district does on a break.',
            '{name} pulls a fresh stalk in {zone} the moment the old one goes soft, without breaking stride.',
        ],
    },
    {
        label: 'cracks their knuckles before decisions',
        lines: [
            'A ripple of small pops from {zone}: {name} cracking their knuckles, one hand and then the other, deciding something.',
            'Two small volleys of pops in {zone} — left hand, right hand — and then {name} does whatever they had been standing there not doing.',
        ],
    },
    {
        label: 'sings only when it rains',
        lines: [
            'The rain starts over {zone} and, very quietly under it, so does {name}.',
            'The drizzle over {zone} thickens and {name}\'s voice comes up under it, thin, and stops the instant it eases.',
        ],
    },
    {
        label: 'refuses to step on flowers',
        lines: [
            '{name} adjusts their whole path through {zone} around a patch of something blooming. The cameras never catch them doing it on purpose.',
            '{name} takes three extra paces through {zone} to go around something small and green, and does not look at it as they pass.',
        ],
    },
    {
        label: 'talks in their sleep',
        lines: [
            'From {name}\'s bedroll in {zone}: half a conversation, names included. Anyone listening would learn things.',
            '{name} is talking in {zone} with their eyes shut and their breathing slow. Two of the words are names of people who are not here.',
        ],
    },
    {
        label: 'tests every branch twice',
        lines: [
            '{name} hangs their weight on a limb in {zone}, lets go, and hangs it again before trusting it. Both times, every time.',
            '{name} bounces on a limb in {zone} twice, steps off, and finds another one, unconvinced by a branch that was perfectly sound.',
        ],
    },
    {
        label: 'skips breakfast until they have scouted',
        lines: [
            '{name} walks the ground around {zone} on an empty stomach. Food is for afterwards; it has always been for afterwards.',
            '{name} has been in {zone} an hour and has not eaten. They walk the edges first. They have always walked the edges first.',
        ],
    },
    {
        label: 'wipes their blade on their left sleeve',
        lines: [
            'The left sleeve of {name}\'s jacket in {zone} says everything about the week they are having.',
            '{name} draws the blade across their left forearm in {zone}, wipes, and sheathes it in one movement they clearly do in their sleep.',
        ],
    },
    {
        label: 'salutes the sky after the anthem',
        lines: [
            'The anthem ends over {zone} and {name} touches two fingers to their brow. Nobody has ever asked them who it is for.',
            'Two fingers to the brow in {zone}, held for a beat past the last note. {name} does not explain it and nobody asks.',
        ],
    },
    {
        label: 'builds tiny cairns at camps',
        lines: [
            'Where {name} slept in {zone} there is a stack of five small stones. There always is.',
            'Five stones, smallest on top, on a flat rock in {zone}. {name} does not look back at it walking away.',
        ],
    },
    {
        label: 'never finishes a water skin',
        lines: [
            '{name} drinks in {zone} and stops with a mouthful left, the way people raised on rationing always stop.',
            'There is a swallow left in the skin when {name} stops drinking in {zone}. There is always a swallow left.',
        ],
    },
    {
        label: 'counts everything in dozens',
        lines: [
            '{name} inventories their pack in {zone} in dozens and half-dozens — a habit from a district that counts by the crate.',
            '{name} counts what is left in {zone} — two dozen, and four — and the arithmetic comes out in crates and always will.',
        ],
    },
    {
        label: 'whittles when nervous',
        lines: [
            'A drift of pale shavings marks where {name} waited in {zone}. The stick they were working on is nothing in particular. It never is.',
            '{name}\'s hands are working a knife over a stick in {zone} and their eyes are somewhere else entirely.',
        ],
    },
    {
        label: 'sleeps with their boots on',
        lines: [
            '{name} loosens exactly nothing before closing their eyes in {zone}. Boots stay on. Boots have stayed on since the gong.',
            '{name} lies down in {zone} laced and buckled, arranged as though the night might require running.',
        ],
    },
    {
        label: 'greets the sunrise out loud',
        lines: [
            'First light reaches {zone} and {name} says good morning to it, quietly, like an old arrangement.',
            'The light comes up on {zone} and {name} says something to it, briefly, before the day starts being a day.',
        ],
    },
    {
        label: 'checks their reflection in water',
        lines: [
            '{name} pauses over still water in {zone}, studying the face in it like they are checking who came out of the arena so far.',
            '{name} crouches over the still water in {zone} a beat too long, and whatever they see in it, they do not appear to recognise it.',
        ],
    },
    {
        label: 'keeps their back to the wind',
        lines: [
            '{name} shifts around their fire in {zone} until the wind is behind them. They could not tell you when they started doing it.',
            '{name} moves twice around the fire in {zone} before settling, chasing an angle they could not name if asked.',
        ],
    },
    {
        label: 'ties a fresh knot every morning',
        lines: [
            'A new knot in the cord on {name}\'s wrist in {zone} — one per morning. The cord is getting short.',
            '{name} unties yesterday\'s knot in {zone} before tying today\'s, so the count stays honest. The cord is very short now.',
        ],
    },
    {
        label: 'eats standing up',
        lines: [
            '{name} eats their ration in {zone} on their feet, facing outward, the way you eat when a shift bell might go at any moment.',
            '{name} eats in {zone} standing, facing out, and finishes before anybody would have noticed they had started.',
        ],
    },
    {
        label: 'apologises when they take supplies',
        lines: [
            '{name} lifts what they need from a cache in {zone} and says sorry to it, out of an honesty the arena has no use for.',
            '{name} takes two things out of a cache in {zone} and says something to the empty space where they were.',
        ],
    },
    {
        label: 'draws maps in the dirt and erases them',
        lines: [
            'By the time {name} leaves {zone}, the map they spent an hour scratching into the ground is gone under a boot heel. It is all in their head now.',
            '{name} scratches the whole map of the arena into the dust of {zone}, looks at it for a long minute, and wipes it out with a palm.',
        ],
    },
    {
        label: 'hoards string',
        lines: [
            'Cord, vine, thread, wire — {name} leaves {zone} with a little more of it than they arrived carrying. They always do.',
            'A length of vine goes into {name}\'s pack in {zone} for no reason they could give. It joins several others.',
        ],
    },
    {
        label: 'names their weapons',
        lines: [
            '{name} says a word to the weapon in their hand in {zone} before moving out — a name. It has had it a while.',
            '{name} says one word to their weapon in {zone} and then goes to work with it, and the word was not a curse.',
        ],
    },
    {
        label: 'refuses to eat meat they did not catch',
        lines: [
            '{name} passes over the easier food in {zone} for the snare line. If they did not take it themselves, they do not trust it.',
            'There is food in {zone} that {name} could simply take, and they walk past it to go and check the line they set themselves.',
        ],
    },
    {
        label: 'stacks their supplies in the same order',
        lines: [
            '{name} unpacks and repacks in {zone}, everything in its fixed order, blade on top. The ritual matters more than the arrangement.',
            '{name} takes everything out of the pack in {zone} and puts it all back, same order, blade last. Nothing about the pack has changed.',
        ],
    },
    {
        label: 'listens with their eyes shut',
        lines: [
            '{name} stops in {zone}, closes their eyes for a slow ten-count, and just listens. Then they move like they learned something.',
            '{name} shuts their eyes in {zone} for a ten-count, opens them, and immediately moves off in a direction they did not have before.',
        ],
    },
    {
        label: 'saves the best bite for last',
        lines: [
            '{name} sets one piece of their ration aside in {zone} and eats it last, alone, looking at nothing.',
            '{name} eats everything in {zone} except the one good piece, and then sits with it a while before they will.',
        ],
    },
    {
        label: 'never sits with their back to a door or gap',
        lines: [
            'In {zone}, {name} takes the seat that faces the opening. There is always one opening, and they always face it.',
            '{name} moves once, without comment, in {zone}, so that the gap in the rock is in front of them instead of behind.',
        ],
    },
    {
        label: 'taps out rhythms on their knee',
        lines: [
            'A worksong rhythm, tapped on a knee in {zone}: {name}, keeping time with a shift that is happening a thousand miles away.',
            'A rhythm on a knee in {zone}, four beats and a rest, four beats and a rest. It is a shift pattern, and it is a thousand miles away.',
        ],
    },
    {
        label: 'collects feathers',
        lines: [
            'Tucked into {name}\'s pack strap in {zone}: another feather. The row of them is getting long.',
            '{name} picks a feather off the ground in {zone} and works it into the pack strap alongside the others, without slowing down.',
        ],
    },
    {
        label: 'reads tracks out loud',
        lines: [
            '{name} crouches over the ground in {zone} narrating to nobody — two of them, heavy, hours old. Talking makes the tracks make sense.',
            '{name} talks the ground of {zone} through out loud: one of them, running, not long. Saying it makes it a fact.',
        ],
    },
    {
        label: 'washes before the anthem',
        lines: [
            'Before the sky lights up over {zone}, {name} scrubs their face and hands. If the district is going to see them, they will be clean.',
            '{name} gets their face and hands clean in {zone} before the sky lights up. It is not vanity and it is not for the Capitol.',
        ],
    },
    {
        label: 'leaves food for the birds',
        lines: [
            '{name} scatters crumbs at the edge of {zone} they cannot spare. Somewhere at home, somebody taught them the birds come first.',
            '{name} leaves a small handful at the edge of {zone} that they can very much not spare, and moves off without watching to see if anything takes it.',
        ],
    },
    {
        label: 'braids their hair before a fight',
        lines: [
            '{name}\'s hands are braiding in {zone}, quick and tight, the way they do when they think something is coming.',
            '{name}\'s hands go to their hair in {zone}, quick, tight, practical, and whatever they think is coming, it has not arrived yet.',
        ],
    },
    {
        label: 'quotes their mentor',
        lines: [
            '{name} repeats something in {zone} with the cadence of another person\'s sentence — their mentor\'s, word for word, like a tool taken out of a box.',
            '{name} says something in {zone} in a rhythm that is not theirs, and then stops, having heard whose it is.',
        ],
    },
    {
        label: 'always knows which way is home',
        lines: [
            'Asked nothing by nobody, {name} orients in {zone} and glances, briefly, in one particular direction. District-ward.',
            '{name} squares up in {zone}, works something out from the light, and glances once at a horizon that has their district behind it.',
        ],
    },
    {
        label: 'smells everything before eating it',
        lines: [
            '{name} lifts each piece of food to their nose in {zone}, every time, including the things a sponsor paid for.',
            '{name} holds a piece of food to their face in {zone} for a full second before it goes anywhere near their mouth. Everything. Every time.',
        ],
    },
    {
        label: 'keeps a dead tribute\'s count',
        lines: [
            '{name} recites something under the anthem in {zone} — the tally, all of it, in order. Somebody has to keep the list.',
            'Under the anthem in {zone}, {name} is saying names in order, and gets all of them, and gets them right.',
        ],
    },
    {
        label: 'wraps their knuckles each morning',
        lines: [
            '{name} winds cloth over their knuckles in {zone} with the boredom of long habit. Their hands were their trade before they were their weapon.',
            '{name} winds cloth over their knuckles in {zone} the way a person does a thing ten thousand times, and does not look at their hands doing it.',
        ],
    },
    {
        label: 'never steps in running water',
        lines: [
            '{name} finds the stones and the deadfall across the stream in {zone} rather than wade. Superstition, or something they have never explained.',
            '{name} works twenty metres upstream in {zone} to find a crossing that is not water, rather than put a boot in it.',
        ],
    },
    {
        label: 'hums while working',
        lines: [
            'Any camp chore in {zone} comes with the same three bars, over and over. {name} does not seem to hear themselves doing it.',
            'The same three bars come up out of {name} in {zone} over a camp chore, and go on until the chore does.',
        ],
    },
    {
        label: 'points at the sky when a cannon fires',
        lines: [
            'The cannon sounds and {name}\'s arm comes up in {zone}, pointing at nothing, holding a moment. An acknowledgement. Then it drops.',
            'The cannon goes and {name}\'s arm comes up in {zone}, holds, and drops. Whoever it was, it has been acknowledged.',
        ],
    },
    {
        label: 'sleeps in short shifts by choice',
        lines: [
            'Even safe, even exhausted, {name} wakes in {zone} every two hours on some internal bell, checks the dark, and goes back down.',
            '{name} surfaces in {zone} at some hour of the night, reads the dark for ten seconds, and is gone again.',
        ],
    },
    {
        label: 'talks to their token',
        lines: [
            '{name} has their token out in {zone} again, speaking to it too low for the microphones — a report, by the look of it. The day\'s events, delivered home.',
            '{name} has the token out in {zone} and is telling it, very quietly, what happened today.',
        ],
    },
    {
        label: 'balances things on their fingers',
        lines: [
            'While thinking, {name} stands a knife, then a stick, then a stone upright on one finger in {zone}. The concentration is the point.',
            'A stone stands upright on {name}\'s fingertip in {zone} for four seconds, and something behind their eyes finishes working.',
        ],
    },
    {
        label: 'always shares first',
        lines: [
            'Whatever food comes into {name}\'s hands in {zone} gets divided before they take their share, even now, even alone. The habit does not know the arena has different rules.',
            '{name} halves what they are holding in {zone} before eating any of it, and there is nobody there to give the other half to.',
        ],
    },
    {
        label: 'mutters odds under their breath',
        lines: [
            '{name} looks across {zone} and mutters numbers — chances, distances, counts. Their own private betting book.',
            '{name} looks across {zone} and the numbers come out under their breath — distance, count, odds — and none of them are for anybody else.',
        ],
    },
    {
        label: 'faces threats side-on',
        lines: [
            'Anything sudden in {zone} and {name} turns side-on to it, narrowing themselves, an old fighter\'s geometry nobody taught them in the Training Centre.',
            'Something moves at the edge of {zone} and {name} is instantly side-on to it, narrow, weight back. Nobody taught them that in the Capitol.',
        ],
    },
    {
        label: 'keeps their fire tiny',
        lines: [
            '{name}\'s fire in {zone} would embarrass a candle. They feed it in splinters and warm one hand at a time, and it has never once been spotted.',
            '{name}\'s fire in {zone} is three splinters and a coal, and it warms exactly one hand, and it has never been seen from anywhere.',
        ],
    },
    {
        label: 'buries what they cannot carry',
        lines: [
            '{name} caches the surplus in {zone} and smooths the ground flat over it. They have holes like this all over the arena, and a memory of every one.',
            '{name} puts the surplus in a hole in {zone}, presses the ground back down, and scuffs a leaf over it. That is nine now.',
        ],
    },
    {
        label: 'winds an imaginary watch',
        lines: [
            'Twice a day in {zone}, {name}\'s fingers turn a little crown that is not on their wrist anymore. The watch is at home. The winding stayed.',
            '{name}\'s fingers turn a crown that is not there in {zone}, twice around, and then let go of a wrist with nothing on it.',
        ],
    },
    {
        label: 'thanks the parachutes',
        lines: [
            'The silver chute settles in {zone} and {name} looks up and says thank you to the general sky — loud enough, deliberately, for the sponsors to lip-read.',
            'The chute comes down in {zone} and {name} says thank you upward, clearly, on the assumption that somebody is reading their mouth.',
        ],
    },
    {
        label: 'walks heel-to-toe on soft ground',
        lines: [
            '{name} crosses the soft ground of {zone} heel-to-toe, silent as a shop floor at inspection, without appearing to think about it.',
            '{name} crosses the soft ground of {zone} heel-to-toe without appearing to have decided to, and leaves almost nothing behind them.',
        ],
    },
    {
        label: 'names the stars wrong on purpose',
        lines: [
            '{name} lies back in {zone} naming constellations that do not exist — home names, made-up names. The arena sky does not deserve the real ones.',
            '{name} names three constellations over {zone} that no astronomer would recognise, and gets the names from somewhere much further away than the sky.',
        ],
    },
    {
        label: 'checks on sleeping allies',
        lines: [
            'Twice in the night in {zone}, {name} lifts their head and counts the sleeping shapes around them. The count has to come out right before they lie back down.',
            '{name} counts the sleeping shapes in {zone}, gets the right number, and only then puts their own head down.',
        ],
    },
    {
        label: 'spits for luck before crossing open ground',
        lines: [
            'At the edge of the open stretch in {zone}, {name} spits once, off to the side. District habit. Then they run.',
            '{name} spits once off to the side at the edge of the open ground in {zone}, and then crosses it flat out.',
        ],
    },
    {
        label: 'keeps the last coal of every fire',
        lines: [
            'When {name} breaks camp in {zone}, one cooled coal goes into a pocket. Fires are family where they come from. You keep a piece.',
            'A cold coal goes into {name}\'s pocket as they break camp in {zone}. There are several in there already, and they all came from somewhere.',
        ],
    },
    {
        label: 'sharpens sticks while on watch',
        lines: [
            'Morning in {zone} finds a neat row of sharpened sticks by {name}\'s watch post. Nobody needs them. The watch needed the hands busy.',
            'There are eleven sharpened sticks beside {name}\'s watch post in {zone} by first light. Nobody is going to use any of them.',
        ],
    },
    {
        label: 'won\'t say the word "arena"',
        lines: [
            '{name} calls it the field, the ground, out there — anything, in {zone}, but the word the Capitol uses. Their whole district does the same.',
            '{name} says \'out there\' about {zone} — never the other word, not once, not since the reaping.',
        ],
    },
    {
        label: 'measures time in shifts',
        lines: [
            '"About half a shift," {name} says of the distance across {zone}, to nobody. The district clock is the only clock they carry.',
            '{name} looks across {zone} and says \'a shift and a bit\', to nobody, and is not wrong.',
        ],
    },
];
