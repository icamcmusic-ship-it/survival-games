import type { TraitMod } from './traits';
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
            "The number {name} says in {zone} is one higher than yesterday, and they hold on it a beat too long before moving.",
            "{name} loses the count somewhere in {zone} and starts again from the gong, patiently, as though the arithmetic were the point.",
        ],
    },
    {
        label: 'will not sleep near water',
        lines: [
            '{name} moves their bedroll twice in {zone}, further from the sound of water each time.',
            'There is water audible somewhere in {zone} and {name} has arranged their whole camp so that it is behind them.',
            "{name} picks a dry corner of {zone} and will not be argued out of it, whatever the better ground is worth.",
            "Water noise starts up somewhere in {zone} in the night and {name} is awake for the rest of it, eyes open, saying nothing.",
        ],
    },
    {
        label: 'always takes the high ground',
        lines: [
            '{name} climbs before they rest in {zone}. They always climb first.',
            '{name} will not settle in {zone} until they are above something. Anything. The lip of a rock will do.',
            "Given two bad options in {zone}, {name} takes the higher one without appearing to consider the other.",
            "{name} scouts the whole of {zone} from a height first, and only then walks down into it, which costs them an hour they do not have.",
        ],
    },
    {
        label: 'talks to the cameras',
        lines: [
            '{name} finds a camera in {zone} and says something to it the microphones do not quite catch.',
            '{name} looks directly into a lens in {zone} and holds it, for longer than is comfortable for anybody watching.',
            "{name} performs something small for a lens in {zone} — a shrug, a half-smile — the way you would for someone at home.",
            "There is a camera in {zone} and {name} tells it something plain and unhurried, like a person leaving a message they expect to be heard late.",
        ],
    },
    {
        label: 'never turns their back on a treeline',
        lines: [
            '{name} crosses {zone} sideways, eyes on the treeline the whole way.',
            'Halfway across {zone}, {name} stops and turns fully around to look back at the trees. Nothing is there. There never is.',
            "{name} chooses the long way round {zone} rather than put trees behind them, and loses daylight doing it.",
            "{name} sits down in {zone} facing the trees and eats without looking at the food once.",
        ],
    },
    {
        label: 'hums their district anthem',
        lines: [
            'Somewhere in {zone}, {name} is humming — an old district tune, barely voiced.',
            'The tune comes out of {name} in {zone} before they notice they have started it, and they let it finish before they stop.',
            "The anthem of another district plays somewhere in {name}'s memory in {zone}, and what comes out is their own.",
            "{name} stops the tune mid-bar in {zone}, listens hard at nothing, and does not pick it up again.",
        ],
    },
    {
        label: 'keeps a pebble from home',
        lines: [
            '{name} turns a small stone over in their fingers in {zone}. It came from home. It goes back in the pocket.',
            '{name} loses the stone in {zone} for a bad thirty seconds, finds it in the wrong pocket, and does not speak for a while after.',
            "{name} sets the stone on a flat rock in {zone} while they work, and puts it away before they move on.",
            "Someone asks about the stone in {zone} and {name} gives an answer so short it closes the subject permanently.",
        ],
    },
    {
        label: 'sharpens everything twice',
        lines: [
            '{name} checks an edge in {zone} that was already sharp, and sharpens it anyway.',
            'The blade goes over the stone in {zone} more times than the edge needs. {name} counts the passes, and the count is always the same.',
            "{name} runs a thumb along an edge in {zone} and goes back to the stone over something only they can feel.",
            "The sharpening in {zone} goes on past any use, and it is obvious to everyone including {name} that the blade is not what is being worked on.",
        ],
    },
    {
        label: 'eats in exact halves',
        lines: [
            '{name} splits their food into exact halves in {zone} and wraps one. They always wrap one.',
            '{name} cannot bring themselves to eat the wrapped half in {zone}, even hungry, even now. It is for later. There is always a later.',
            "{name} weighs the two halves in {zone} against each other and shaves a crumb off the larger one.",
            "The wrapped half in {zone} has been wrapped for two days and is starting to turn, and {name} rewraps it anyway.",
        ],
    },
    {
        label: 'names the mutts',
        lines: [
            '{name} mutters a name at a distant shriek in {zone} — they have been naming the things that hunt them.',
            'A shriek carries across {zone} and {name} says a name back at it, conversationally, as though answering.',
            "{name} has a name for the thing in {zone} that screams at dusk, and uses it without explaining it.",
            "{name} tells an ally in {zone} which of the mutts is which by voice, and is not entirely joking.",
        ],
    },
    {
        label: 'sleeps sitting up',
        lines: [
            '{name} settles for the night in {zone} with their back to something solid, upright, the way they always do.',
            '{name} finds the one upright surface in {zone} and puts their spine against it before they will consider sleeping.',
            "{name} wakes upright in {zone} without the usual moment of not knowing where they are.",
            "There is nothing solid to lean on in {zone}, so {name} sits out the dark with their arms round their knees rather than lie down.",
        ],
    },
    {
        label: 'reads the sky before anything else',
        lines: [
            'First thing {name} does in {zone} is look up, for a long moment, at whatever the sky is pretending to be.',
            '{name} is on their back in {zone} reading a sky that is a machine, looking for weather in it the way you would at home.',
            "The false dawn comes up over {zone} and {name} reads it for a full minute before they will move.",
            "{name} announces the weather to nobody in {zone}, gets it right, and takes no pleasure in it.",
        ],
    },
    {
        label: 'walks their camp perimeter three times',
        lines: [
            '{name} walks the edge of their ground in {zone} three times. Exactly three.',
            'Three circuits of the ground in {zone}, and then {name} stops, unsatisfied, and does a fourth. Something about tonight is off.',
            "The third circuit of {zone} takes {name} longer than the first two put together; they are looking at something now.",
            "{name} interrupts a conversation in {zone} to walk the perimeter, and comes back into it mid-sentence as though nothing happened.",
        ],
    },
    {
        label: 'never says the fallen’s names',
        lines: [
            'Someone mentions the anthem in {zone} and {name} goes quiet. They never say the names.',
            'The anthem plays over {zone}, and {name} moves their lips through none of it.',
            "A name is said aloud in {zone} and {name} finds something to do with their hands until the subject changes.",
            "{name} counts the faces in the sky over {zone} and does not once move their lips.",
        ],
    },
    {
        label: 'braids or knots something when thinking',
        lines: [
            '{name} sits in {zone} working knots into a cord, tying and untying, thinking.',
            'The cord in {name}\'s hands in {zone} has been tied and untied so many times it has gone soft.',
            "The knot {name} is working in {zone} is one they learned from somebody who is not here.",
            "{name} finishes a knot in {zone}, looks at it, unties it, and starts the same knot again.",
        ],
    },
    {
        label: 'tastes rain',
        lines: [
            'It is barely drizzling in {zone}, and {name} stands in it with their face up anyway.',
            '{name} tips their head back in {zone} with their mouth open, briefly, and looks about nine years old doing it.',
            "{name} catches rain off a leaf in {zone} and tastes it before they will let anyone else drink.",
            "{name} says the water in {zone} tastes like metal today, and is not asked to explain what that means.",
        ],
    },
    {
        label: 'keeps their laces double-tied',
        lines: [
            '{name} stops mid-stride in {zone} to re-tie a lace that did not need it.',
            '{name} checks both laces in {zone} before standing up, and both again after.',
            "{name} crouches in {zone} to redo a lace that was not loose.",
            "Before any hard ground in {zone}, {name} checks both laces, in the same order, right then left.",
        ],
    },
    {
        label: 'collects one thing from every zone',
        lines: [
            '{name} pockets something small in {zone} — a leaf, a bolt, a shell. They have one from everywhere they have been.',
            '{name} turns something small over in their fingers in {zone} — from here, from this ground — and it goes into the pocket with the rest.',
            "{name} pockets something small and useless from {zone} — a shard, a seed case, a bent nail of a thing.",
            "The collection weighs more than {name} will admit in {zone}, and they have not thrown any of it away.",
        ],
    },
    {
        label: 'apologises to plants they cut',
        lines: [
            '{name} takes what they need from the undergrowth in {zone} and says something quiet to it after.',
            '{name} cuts what they need out of {zone} and then puts a hand flat on the stump for a second, which the microphones do not pick up.',
            "{name} cuts a stem in {zone} and says something under their breath to it that is not quite a word.",
            "{name} takes the smaller of two plants in {zone}, for reasons that are plainly not practical.",
        ],
    },
    {
        label: 'refuses to drink first',
        lines: [
            '{name} lets the water sit in {zone}, watching it, before they will touch it. Every time.',
            '{name} waits out a full minute over the water in {zone}, watching for something to move in it, before they will lower their face.',
            "{name} hands the skin across in {zone} and waits, watching the other person's throat.",
            "{name} goes last at the water in {zone} even alone, even with nobody to go before them.",
        ],
    },
    {
        label: 'marks the trees as they pass',
        lines: [
            'A thumbnail scratch on bark in {zone}: {name} marking where they have been, or the way back.',
            'A fresh scratch on a trunk in {zone}, at exactly shoulder height, exactly like the last one. {name} is leaving themselves a sentence.',
            "{name} cuts a mark at knee height on a trunk in {zone}, low enough that only somebody looking for it would see.",
            "{name} finds one of their own marks in {zone}, realises they have been circling, and says nothing about it.",
        ],
    },
    {
        label: 'stretches like an athlete before moving',
        lines: [
            '{name} runs through the same slow stretches in {zone} they must have done every morning of their life.',
            'Before {name} moves out of {zone}, they run the same sequence they have run every morning of their life, and their body cooperates.',
            "{name} works through the same sequence in {zone} — calves, hamstrings, shoulders — before they will take a single step.",
            "The stretching in {zone} is unhurried in a way that reads, from a distance, as arrogance.",
        ],
    },
    {
        label: 'whistles one note when the coast is clear',
        lines: [
            'One flat note carries across {zone}. {name}, telling nobody in particular it is safe.',
            'One clean note out of {zone}. It means nothing to anybody left alive to hear it, and {name} whistles it anyway.',
            "A single flat note carries across {zone}, and whoever is listening for it knows what it means.",
            "{name} does not whistle in {zone}, and the silence where the note should be is its own message.",
        ],
    },
    {
        label: 'keeps score against the arena',
        lines: [
            '{name} adds a scratch to their bracer in {zone}. Not kills — days the arena has failed to kill them.',
            'Another mark on the bracer in {zone}. {name} looks at the row of them for a moment and appears, briefly, to be winning.',
            "{name} tallies something against the arena in {zone} — a scratch on a stick, a mark on a sleeve — and the arena is ahead.",
            "'Two–nil,' {name} says to nothing in particular in {zone}, and the score is not explained to anybody.",
        ],
    },
    {
        label: 'always faces the Cornucopia when they rest',
        lines: [
            '{name} settles in {zone} facing, as ever, the direction of the horn.',
            '{name} turns their bedroll in {zone} until it points at the horn, and only then lies down on it.',
            "{name} turns their bedroll in {zone} until the horn is in front of them, then lies down facing it.",
            "{name} sits in {zone} with the Cornucopia at their eyeline, the way you sit facing a door.",
        ],
    },
    {
        label: 'chews on a stalk of grass',
        lines: [
            '{name} picks a stalk in {zone} and works it between their teeth, the way half their district does on a break.',
            '{name} pulls a fresh stalk in {zone} the moment the old one goes soft, without breaking stride.',
            "{name} chews a stalk flat in {zone}, spits it, and picks another without appearing to decide to.",
            "There is nothing green in {zone}, and {name}'s hands keep going to their mouth anyway.",
        ],
    },
    {
        label: 'cracks their knuckles before decisions',
        lines: [
            'A ripple of small pops from {zone}: {name} cracking their knuckles, one hand and then the other, deciding something.',
            'Two small volleys of pops in {zone} — left hand, right hand — and then {name} does whatever they had been standing there not doing.',
            "{name} works each knuckle in {zone} before saying what they have decided.",
            "The knuckles crack in {zone} and everybody nearby looks up, because they have learned what follows.",
        ],
    },
    {
        label: 'sings only when it rains',
        lines: [
            'The rain starts over {zone} and, very quietly under it, so does {name}.',
            'The drizzle over {zone} thickens and {name}\'s voice comes up under it, thin, and stops the instant it eases.',
            "It starts raining on {zone} and {name}'s voice comes up out of it, low, tuneless, entirely private.",
            "{name} sings four bars in {zone} when the rain comes, stops dead when it stops, and looks embarrassed.",
        ],
    },
    {
        label: 'refuses to step on flowers',
        lines: [
            '{name} adjusts their whole path through {zone} around a patch of something blooming. The cameras never catch them doing it on purpose.',
            '{name} takes three extra paces through {zone} to go around something small and green, and does not look at it as they pass.',
            "{name} threads a long way round a patch of something flowering in {zone} rather than walk over it.",
            "{name} rights a trampled stem in {zone} with two fingers and moves on before anybody comments.",
        ],
    },
    {
        label: 'talks in their sleep',
        lines: [
            'From {name}\'s bedroll in {zone}: half a conversation, names included. Anyone listening would learn things.',
            '{name} is talking in {zone} with their eyes shut and their breathing slow. Two of the words are names of people who are not here.',
            "Whatever {name} is saying in their sleep in {zone} is a conversation, and it has two sides.",
            "{name} says a name in their sleep in {zone} that nobody in these Games answers to.",
        ],
    },
    {
        label: 'tests every branch twice',
        lines: [
            '{name} hangs their weight on a limb in {zone}, lets go, and hangs it again before trusting it. Both times, every time.',
            '{name} bounces on a limb in {zone} twice, steps off, and finds another one, unconvinced by a branch that was perfectly sound.',
            "{name} puts weight on a branch in {zone}, takes it off, and puts it on again before trusting it.",
            "A branch holds fine in {zone} and {name} tests it twice anyway, and is late because of it.",
        ],
    },
    {
        label: 'skips breakfast until they have scouted',
        lines: [
            '{name} walks the ground around {zone} on an empty stomach. Food is for afterwards; it has always been for afterwards.',
            '{name} has been in {zone} an hour and has not eaten. They walk the edges first. They have always walked the edges first.',
            "{name} will not eat in {zone} until they have walked the ground and come back, however long that takes.",
            "Someone offers {name} food first thing in {zone} and it is refused politely and completely.",
        ],
    },
    {
        label: 'wipes their blade on their left sleeve',
        lines: [
            'The left sleeve of {name}\'s jacket in {zone} says everything about the week they are having.',
            '{name} draws the blade across their left forearm in {zone}, wipes, and sheathes it in one movement they clearly do in their sleep.',
            "{name} wipes the blade on their left sleeve in {zone}, twice, though the sleeve has long stopped helping.",
            "The left sleeve of {name}'s jacket in {zone} is a different colour from the right, and has been for days.",
        ],
    },
    {
        label: 'salutes the sky after the anthem',
        lines: [
            'The anthem ends over {zone} and {name} touches two fingers to their brow. Nobody has ever asked them who it is for.',
            'Two fingers to the brow in {zone}, held for a beat past the last note. {name} does not explain it and nobody asks.',
            "The anthem finishes over {zone} and {name} lifts two fingers to the sky before they lie back down.",
            "{name} salutes the empty sky over {zone} a beat after the faces are gone, which somehow makes it worse to watch.",
        ],
    },
    {
        label: 'builds tiny cairns at camps',
        lines: [
            'Where {name} slept in {zone} there is a stack of five small stones. There always is.',
            'Five stones, smallest on top, on a flat rock in {zone}. {name} does not look back at it walking away.',
            "{name} balances a fourth stone onto a stack in {zone}, and it is a better stack than it needs to be.",
            "{name} leaves the cairn standing in {zone} when they break camp, a small mark saying somebody was here.",
        ],
    },
    {
        label: 'never finishes a water skin',
        lines: [
            '{name} drinks in {zone} and stops with a mouthful left, the way people raised on rationing always stop.',
            'There is a swallow left in the skin when {name} stops drinking in {zone}. There is always a swallow left.',
            "{name} stops drinking in {zone} with an inch left and stoppers it, thirsty.",
            "The inch at the bottom of {name}'s skin in {zone} is not for drinking, and never has been.",
        ],
    },
    {
        label: 'counts everything in dozens',
        lines: [
            '{name} inventories their pack in {zone} in dozens and half-dozens — a habit from a district that counts by the crate.',
            '{name} counts what is left in {zone} — two dozen, and four — and the arithmetic comes out in crates and always will.',
            "{name} counts something in {zone} in twelves and has to go back when it comes out wrong.",
            "'Two dozen and four,' {name} says of something in {zone}, which is a strange way to say twenty-eight.",
        ],
    },
    {
        label: 'whittles when nervous',
        lines: [
            'A drift of pale shavings marks where {name} waited in {zone}. The stick they were working on is nothing in particular. It never is.',
            '{name}\'s hands are working a knife over a stick in {zone} and their eyes are somewhere else entirely.',
            "The stick in {name}'s hands in {zone} is going to be nothing in particular, and it is getting smaller.",
            "{name} whittles in {zone} until the stick is gone, drops the shavings, and picks up another.",
        ],
    },
    {
        label: 'sleeps with their boots on',
        lines: [
            '{name} loosens exactly nothing before closing their eyes in {zone}. Boots stay on. Boots have stayed on since the gong.',
            '{name} lies down in {zone} laced and buckled, arranged as though the night might require running.',
            "{name} lies down in {zone} fully laced, and is up and moving in the time it takes anyone else to find a boot.",
            "The boots have not been off {name}'s feet since the gong, and what is happening inside them in {zone} does not bear thinking about.",
        ],
    },
    {
        label: 'greets the sunrise out loud',
        lines: [
            'First light reaches {zone} and {name} says good morning to it, quietly, like an old arrangement.',
            'The light comes up on {zone} and {name} says something to it, briefly, before the day starts being a day.',
            "'Morning,' {name} says to the lightening edge of {zone}, to nobody, and means it.",
            "{name} greets the sunrise over {zone} and then looks around quickly to see who heard.",
        ],
    },
    {
        label: 'checks their reflection in water',
        lines: [
            '{name} pauses over still water in {zone}, studying the face in it like they are checking who came out of the arena so far.',
            '{name} crouches over the still water in {zone} a beat too long, and whatever they see in it, they do not appear to recognise it.',
            "{name} crouches at the water in {zone} and looks at their own face longer than they meant to.",
            "There is a reflection in {zone} and {name} does not entirely recognise the person in it.",
        ],
    },
    {
        label: 'keeps their back to the wind',
        lines: [
            '{name} shifts around their fire in {zone} until the wind is behind them. They could not tell you when they started doing it.',
            '{name} moves twice around the fire in {zone} before settling, chasing an angle they could not name if asked.',
            "{name} shifts twice in {zone} until the wind is on their back, and only then settles.",
            "{name} reads the wind in {zone} with a wet finger, turns, and walks the way that puts it behind them.",
        ],
    },
    {
        label: 'ties a fresh knot every morning',
        lines: [
            'A new knot in the cord on {name}\'s wrist in {zone} — one per morning. The cord is getting short.',
            '{name} unties yesterday\'s knot in {zone} before tying today\'s, so the count stays honest. The cord is very short now.',
            "{name} unties yesterday's knot in {zone} and ties a fresh one before doing anything else with the day.",
            "There are eleven old knots in the cord in {name}'s pocket in {zone}, and they know exactly what each one is for.",
        ],
    },
    {
        label: 'eats standing up',
        lines: [
            '{name} eats their ration in {zone} on their feet, facing outward, the way you eat when a shift bell might go at any moment.',
            '{name} eats in {zone} standing, facing out, and finishes before anybody would have noticed they had started.',
            "{name} eats on their feet in {zone}, half-turned, ready to put it down and go.",
            "Somebody in {zone} tells {name} to sit and eat and they do sit, and they do not stay sitting.",
        ],
    },
    {
        label: 'apologises when they take supplies',
        lines: [
            '{name} lifts what they need from a cache in {zone} and says sorry to it, out of an honesty the arena has no use for.',
            '{name} takes two things out of a cache in {zone} and says something to the empty space where they were.',
            "{name} says thank you for a handful of nothing in {zone}, and means it enough to be awkward.",
            "{name} takes the smallest share in {zone} and apologises for the size of it.",
        ],
    },
    {
        label: 'draws maps in the dirt and erases them',
        lines: [
            'By the time {name} leaves {zone}, the map they spent an hour scratching into the ground is gone under a boot heel. It is all in their head now.',
            '{name} scratches the whole map of the arena into the dust of {zone}, looks at it for a long minute, and wipes it out with a palm.',
            "{name} scrapes a map into the dirt of {zone}, studies it, and rubs it out with the side of their boot.",
            "The map in the dirt of {zone} gets one more line than it needs, and then it is gone like it never was.",
        ],
    },
    {
        label: 'hoards string',
        lines: [
            'Cord, vine, thread, wire — {name} leaves {zone} with a little more of it than they arrived carrying. They always do.',
            'A length of vine goes into {name}\'s pack in {zone} for no reason they could give. It joins several others.',
            "{name} coils another length of cord in {zone} and puts it with the rest, which is already more than anyone needs.",
            "Somebody asks {name} for string in {zone} and is given a foot of it, measured, reluctantly.",
        ],
    },
    {
        label: 'names their weapons',
        lines: [
            '{name} says a word to the weapon in their hand in {zone} before moving out — a name. It has had it a while.',
            '{name} says one word to their weapon in {zone} and then goes to work with it, and the word was not a curse.',
            "{name} says something to the weapon in their hand in {zone}, by name, the way you address a dog.",
            "The name {name} has for their knife in {zone} is a person's name, and nobody asks whose.",
        ],
    },
    {
        label: 'refuses to eat meat they did not catch',
        lines: [
            '{name} passes over the easier food in {zone} for the snare line. If they did not take it themselves, they do not trust it.',
            'There is food in {zone} that {name} could simply take, and they walk past it to go and check the line they set themselves.',
            "{name} leaves the meat in {zone} and eats the roots instead, and does not make a speech about it.",
            "Offered a share of somebody else's kill in {zone}, {name} takes the water and leaves the rest.",
        ],
    },
    {
        label: 'stacks their supplies in the same order',
        lines: [
            '{name} unpacks and repacks in {zone}, everything in its fixed order, blade on top. The ritual matters more than the arrangement.',
            '{name} takes everything out of the pack in {zone} and puts it all back, same order, blade last. Nothing about the pack has changed.',
            "{name} restacks their pack in {zone} — cord, tin, cloth, blade — though nothing has moved.",
            "Something is in the wrong place in the pack in {zone} and {name} cannot start the day until it is not.",
        ],
    },
    {
        label: 'listens with their eyes shut',
        lines: [
            '{name} stops in {zone}, closes their eyes for a slow ten-count, and just listens. Then they move like they learned something.',
            '{name} shuts their eyes in {zone} for a ten-count, opens them, and immediately moves off in a direction they did not have before.',
            "{name} sits down in {zone}, shuts their eyes, and turns their head slowly through the whole circle.",
            "{name} puts a hand up in {zone} for quiet, eyes closed, and gets it.",
        ],
    },
    {
        label: 'saves the best bite for last',
        lines: [
            '{name} sets one piece of their ration aside in {zone} and eats it last, alone, looking at nothing.',
            '{name} eats everything in {zone} except the one good piece, and then sits with it a while before they will.',
            "{name} sets the last good mouthful aside in {zone} and eats around it first.",
            "The best of it is still on the leaf in {zone} when {name} decides they are not hungry after all.",
        ],
    },
    {
        label: 'never sits with their back to a door or gap',
        lines: [
            'In {zone}, {name} takes the seat that faces the opening. There is always one opening, and they always face it.',
            '{name} moves once, without comment, in {zone}, so that the gap in the rock is in front of them instead of behind.',
            "{name} shifts twice in {zone} before settling with the gap in the rocks in their eyeline.",
            "There is only one way into {zone} that matters and {name} has sat down facing it without seeming to choose.",
        ],
    },
    {
        label: 'taps out rhythms on their knee',
        lines: [
            'A worksong rhythm, tapped on a knee in {zone}: {name}, keeping time with a shift that is happening a thousand miles away.',
            'A rhythm on a knee in {zone}, four beats and a rest, four beats and a rest. It is a shift pattern, and it is a thousand miles away.',
            "{name} taps a rhythm out on their knee in {zone}, the same eight beats, over and over.",
            "The tapping in {zone} stops the instant something changes in the sound of the place, before anybody else has noticed.",
        ],
    },
    {
        label: 'collects feathers',
        lines: [
            'Tucked into {name}\'s pack strap in {zone}: another feather. The row of them is getting long.',
            '{name} picks a feather off the ground in {zone} and works it into the pack strap alongside the others, without slowing down.',
            "{name} picks a feather out of the dirt in {zone} and stows it with the others, flat, undamaged.",
            "There are feathers from four different zones in {name}'s pocket in {zone}, and they can tell you which came from where.",
        ],
    },
    {
        label: 'reads tracks out loud',
        lines: [
            '{name} crouches over the ground in {zone} narrating to nobody — two of them, heavy, hours old. Talking makes the tracks make sense.',
            '{name} talks the ground of {zone} through out loud: one of them, running, not long. Saying it makes it a fact.',
            "'Two of them, one carrying,' {name} says of the ground in {zone}, to nobody who asked.",
            "{name} reads the tracks in {zone} aloud and gets to a conclusion they visibly do not enjoy.",
        ],
    },
    {
        label: 'washes before the anthem',
        lines: [
            'Before the sky lights up over {zone}, {name} scrubs their face and hands. If the district is going to see them, they will be clean.',
            '{name} gets their face and hands clean in {zone} before the sky lights up. It is not vanity and it is not for the Capitol.',
            "{name} washes their hands and face in {zone} before the sky lights up, however little water there is.",
            "{name} will not watch the faces over {zone} with the day still on them, and finds enough water somewhere to fix that.",
        ],
    },
    {
        label: 'leaves food for the birds',
        lines: [
            '{name} scatters crumbs at the edge of {zone} they cannot spare. Somewhere at home, somebody taught them the birds come first.',
            '{name} leaves a small handful at the edge of {zone} that they can very much not spare, and moves off without watching to see if anything takes it.',
            "{name} tears a corner off what little they have in {zone} and leaves it on a stone for the birds.",
            "The birds in {zone} have started coming closer to {name} than to anything else in the arena.",
        ],
    },
    {
        label: 'braids their hair before a fight',
        lines: [
            '{name}\'s hands are braiding in {zone}, quick and tight, the way they do when they think something is coming.',
            '{name}\'s hands go to their hair in {zone}, quick, tight, practical, and whatever they think is coming, it has not arrived yet.',
            "{name} braids their hair back tight in {zone}, fast, without a mirror, and their hands are steady.",
            "The braid in {zone} is the tell: {name} has decided something and has not said it yet.",
        ],
    },
    {
        label: 'quotes their mentor',
        lines: [
            '{name} repeats something in {zone} with the cadence of another person\'s sentence — their mentor\'s, word for word, like a tool taken out of a box.',
            '{name} says something in {zone} in a rhythm that is not theirs, and then stops, having heard whose it is.',
            "'She'd say hold the line and stay boring,' {name} says in {zone}, and does exactly that.",
            "{name} repeats their mentor's advice in {zone} word for word, and then does the opposite of it.",
        ],
    },
    {
        label: 'always knows which way is home',
        lines: [
            'Asked nothing by nobody, {name} orients in {zone} and glances, briefly, in one particular direction. District-ward.',
            '{name} squares up in {zone}, works something out from the light, and glances once at a horizon that has their district behind it.',
            "{name} points, without much ceremony, at a direction in {zone}, and it is the right direction.",
            "Asked which way home is from {zone}, {name} answers before the question is finished.",
        ],
    },
    {
        label: 'smells everything before eating it',
        lines: [
            '{name} lifts each piece of food to their nose in {zone}, every time, including the things a sponsor paid for.',
            '{name} holds a piece of food to their face in {zone} for a full second before it goes anywhere near their mouth. Everything. Every time.',
            "{name} holds a berry under their nose in {zone} for a long moment before anything else happens.",
            "{name} smells the water in {zone}, puts it down, and does not drink it, and cannot say why.",
        ],
    },
    {
        label: 'keeps a dead tribute\'s count',
        lines: [
            '{name} recites something under the anthem in {zone} — the tally, all of it, in order. Somebody has to keep the list.',
            'Under the anthem in {zone}, {name} is saying names in order, and gets all of them, and gets them right.',
            "'Eleven,' {name} says in {zone}, and it is not eleven of anything anybody else is counting.",
            "{name} adjusts a running total in {zone} at the sound of a distant cannon, without breaking stride.",
        ],
    },
    {
        label: 'wraps their knuckles each morning',
        lines: [
            '{name} winds cloth over their knuckles in {zone} with the boredom of long habit. Their hands were their trade before they were their weapon.',
            '{name} winds cloth over their knuckles in {zone} the way a person does a thing ten thousand times, and does not look at their hands doing it.',
            "{name} winds cloth over their knuckles in {zone}, right hand then left, tight, the same every morning.",
            "The wrappings in {zone} are grey and stiff now, and {name} rewinds them anyway.",
        ],
    },
    {
        label: 'never steps in running water',
        lines: [
            '{name} finds the stones and the deadfall across the stream in {zone} rather than wade. Superstition, or something they have never explained.',
            '{name} works twenty metres upstream in {zone} to find a crossing that is not water, rather than put a boot in it.',
            "{name} finds a crossing of stone rather than wade the shallow water in {zone}, and takes the long way for it.",
            "{name} stops at running water in {zone} the way you stop at an edge, and goes round.",
        ],
    },
    {
        label: 'hums while working',
        lines: [
            'Any camp chore in {zone} comes with the same three bars, over and over. {name} does not seem to hear themselves doing it.',
            'The same three bars come up out of {name} in {zone} over a camp chore, and go on until the chore does.',
            "{name} hums in {zone} while their hands work, and stops the moment they look up.",
            "The humming in {zone} is not a tune, exactly, and {name} does not appear to hear themselves doing it.",
        ],
    },
    {
        label: 'points at the sky when a cannon fires',
        lines: [
            'The cannon sounds and {name}\'s arm comes up in {zone}, pointing at nothing, holding a moment. An acknowledgement. Then it drops.',
            'The cannon goes and {name}\'s arm comes up in {zone}, holds, and drops. Whoever it was, it has been acknowledged.',
            "A cannon goes over {zone} and {name}'s hand comes up and points at the sound without their face changing.",
            "{name} points at the sky over {zone} at the cannon and holds it until the echo is finished.",
        ],
    },
    {
        label: 'sleeps in short shifts by choice',
        lines: [
            'Even safe, even exhausted, {name} wakes in {zone} every two hours on some internal bell, checks the dark, and goes back down.',
            '{name} surfaces in {zone} at some hour of the night, reads the dark for ten seconds, and is gone again.',
            "{name} takes their rest in {zone} in pieces, three short stretches instead of one, and wakes clear-eyed from each.",
            "{name} sets themselves awake in {zone} at intervals nobody asked for and keeps to them exactly.",
        ],
    },
    {
        label: 'talks to their token',
        lines: [
            '{name} has their token out in {zone} again, speaking to it too low for the microphones — a report, by the look of it. The day\'s events, delivered home.',
            '{name} has the token out in {zone} and is telling it, very quietly, what happened today.',
            "{name} turns the token over in {zone} and asks it something, quietly, and answers it themselves.",
            "{name} holds the token up to the light in {zone} and tells it how the day went.",
        ],
    },
    {
        label: 'balances things on their fingers',
        lines: [
            'While thinking, {name} stands a knife, then a stick, then a stone upright on one finger in {zone}. The concentration is the point.',
            'A stone stands upright on {name}\'s fingertip in {zone} for four seconds, and something behind their eyes finishes working.',
            "{name} balances a stripped twig across one finger in {zone}, dead still, for longer than seems reasonable.",
            "{name} is spinning a tin on a fingertip in {zone} when the conversation turns serious, and does not stop.",
        ],
    },
    {
        label: 'always shares first',
        lines: [
            'Whatever food comes into {name}\'s hands in {zone} gets divided before they take their share, even now, even alone. The habit does not know the arena has different rules.',
            '{name} halves what they are holding in {zone} before eating any of it, and there is nobody there to give the other half to.',
            "Whatever there is in {zone}, {name} has divided it and handed it out before taking any.",
            "{name} gives away the better half in {zone} without letting anyone see them choose which half that was.",
        ],
    },
    {
        label: 'mutters odds under their breath',
        lines: [
            '{name} looks across {zone} and mutters numbers — chances, distances, counts. Their own private betting book.',
            '{name} looks across {zone} and the numbers come out under their breath — distance, count, odds — and none of them are for anybody else.',
            "'Four to one, and shortening,' {name} says under their breath in {zone}, pricing something nobody asked about.",
            "{name} mutters a number in {zone} when a name comes up, and it is not a flattering number.",
        ],
    },
    {
        label: 'faces threats side-on',
        lines: [
            'Anything sudden in {zone} and {name} turns side-on to it, narrowing themselves, an old fighter\'s geometry nobody taught them in the Training Centre.',
            'Something moves at the edge of {zone} and {name} is instantly side-on to it, narrow, weight back. Nobody taught them that in the Capitol.',
            "{name} comes into {zone} turned half away, weight on the back foot, presenting as little as possible.",
            "{name} never quite faces the person they are talking to in {zone}, and it is not rudeness.",
        ],
    },
    {
        label: 'keeps their fire tiny',
        lines: [
            '{name}\'s fire in {zone} would embarrass a candle. They feed it in splinters and warm one hand at a time, and it has never once been spotted.',
            '{name}\'s fire in {zone} is three splinters and a coal, and it warms exactly one hand, and it has never been seen from anywhere.',
            "The fire {name} builds in {zone} would fit in two cupped hands and throws almost no light at all.",
            "{name} feeds the fire in {zone} one twig at a time and puts it out well before it is cold.",
        ],
    },
    {
        label: 'buries what they cannot carry',
        lines: [
            '{name} caches the surplus in {zone} and smooths the ground flat over it. They have holes like this all over the arena, and a memory of every one.',
            '{name} puts the surplus in a hole in {zone}, presses the ground back down, and scuffs a leaf over it. That is nine now.',
            "{name} digs a shallow hole in {zone} and puts what they cannot carry into it rather than leave it lying.",
            "{name} covers a cache in {zone} carefully, and does not mark it, and will not find it again.",
        ],
    },
    {
        label: 'winds an imaginary watch',
        lines: [
            'Twice a day in {zone}, {name}\'s fingers turn a little crown that is not on their wrist anymore. The watch is at home. The winding stayed.',
            '{name}\'s fingers turn a crown that is not there in {zone}, twice around, and then let go of a wrist with nothing on it.',
            "{name} winds a watch that is not on their wrist in {zone}, three turns, and checks a face that is not there.",
            "The winding motion in {zone} comes out of {name} whenever the waiting goes on too long.",
        ],
    },
    {
        label: 'thanks the parachutes',
        lines: [
            'The silver chute settles in {zone} and {name} looks up and says thank you to the general sky — loud enough, deliberately, for the sponsors to lip-read.',
            'The chute comes down in {zone} and {name} says thank you upward, clearly, on the assumption that somebody is reading their mouth.',
            "{name} says thank you into the sky over {zone} after the silk comes down, out loud, to whoever is up there.",
            "{name} folds the parachute in {zone} rather than drop it, and keeps the silk.",
        ],
    },
    {
        label: 'walks heel-to-toe on soft ground',
        lines: [
            '{name} crosses the soft ground of {zone} heel-to-toe, silent as a shop floor at inspection, without appearing to think about it.',
            '{name} crosses the soft ground of {zone} heel-to-toe without appearing to have decided to, and leaves almost nothing behind them.',
            "{name} crosses the soft ground of {zone} heel to toe, slowly, and leaves almost nothing behind.",
            "{name} looks back at their own line of prints in {zone} and is not satisfied with them.",
        ],
    },
    {
        label: 'names the stars wrong on purpose',
        lines: [
            '{name} lies back in {zone} naming constellations that do not exist — home names, made-up names. The arena sky does not deserve the real ones.',
            '{name} names three constellations over {zone} that no astronomer would recognise, and gets the names from somewhere much further away than the sky.',
            "{name} gives a constellation over {zone} a name that is not its name, and is entirely consistent about it.",
            "'That's the Kettle,' {name} tells somebody in {zone}, with total confidence, about no such thing.",
        ],
    },
    {
        label: 'checks on sleeping allies',
        lines: [
            'Twice in the night in {zone}, {name} lifts their head and counts the sleeping shapes around them. The count has to come out right before they lie back down.',
            '{name} counts the sleeping shapes in {zone}, gets the right number, and only then puts their own head down.',
            "{name} comes back through {zone} in the dark to check the breathing of everyone asleep, then lies down.",
            "{name} counts the sleeping in {zone} twice, gets the same number twice, and still does not settle for a while.",
        ],
    },
    {
        label: 'spits for luck before crossing open ground',
        lines: [
            'At the edge of the open stretch in {zone}, {name} spits once, off to the side. District habit. Then they run.',
            '{name} spits once off to the side at the edge of the open ground in {zone}, and then crosses it flat out.',
            "{name} spits to the side before stepping out into the open in {zone}, quick, half-embarrassed.",
            "{name} stops at the edge of cover in {zone}, does the small superstitious thing, and then goes.",
        ],
    },
    {
        label: 'keeps the last coal of every fire',
        lines: [
            'When {name} breaks camp in {zone}, one cooled coal goes into a pocket. Fires are family where they come from. You keep a piece.',
            'A cold coal goes into {name}\'s pocket as they break camp in {zone}. There are several in there already, and they all came from somewhere.',
            "{name} rakes a black coal out of the dead fire in {zone} and pockets it while it is still warm.",
            "There are coals from four camps in {name}'s pocket in {zone}, and they know which fire each came from.",
        ],
    },
    {
        label: 'sharpens sticks while on watch',
        lines: [
            'Morning in {zone} finds a neat row of sharpened sticks by {name}\'s watch post. Nobody needs them. The watch needed the hands busy.',
            'There are eleven sharpened sticks beside {name}\'s watch post in {zone} by first light. Nobody is going to use any of them.',
            "{name} takes the watch in {zone} and there is a small pile of pointed sticks by their knee come morning.",
            "{name} sharpens a stick in {zone} that has no use, sets it down, and starts another.",
        ],
    },
    {
        label: 'won\'t say the word "arena"',
        lines: [
            '{name} calls it the field, the ground, out there — anything, in {zone}, but the word the Capitol uses. Their whole district does the same.',
            '{name} says \'out there\' about {zone} — never the other word, not once, not since the reaping.',
            "{name} calls it 'out here' in {zone}, or 'this place', or nothing at all, and never the word itself.",
            "Somebody says the word in {zone} and {name} does not visibly react, which is its own kind of reaction.",
        ],
    },
    {
        label: 'measures time in shifts',
        lines: [
            '"About half a shift," {name} says of the distance across {zone}, to nobody. The district clock is the only clock they carry.',
            '{name} looks across {zone} and says \'a shift and a bit\', to nobody, and is not wrong.',
            "{name} counts the day in {zone} in shifts rather than hours, and tells you there are two left in it.",
            "'End of the second,' {name} says in {zone}, meaning something about the day that only they are tracking.",
        ],
    },
    {
        label: 'sleeps with a knife in their fist',
        lines: [
            '{name} sleeps in {zone} with the blade in their hand and their hand under their cheek, the way they have since the gong.',
            'The knife is in {name}\'s fist before their eyes are open in {zone}. It always is.',
            '{name} wakes in {zone} and checks the knife is still there before checking anything else.',
            'In {zone} {name} loosens their grip on the knife in their sleep and tightens it again without waking.',
        ],
    },
    {
        label: 'never sits with their back to a door',
        lines: [
            '{name} moves twice in {zone} before settling, until the only way in is in front of them.',
            'There is a wall at {name}\'s back in {zone}. There is always a wall at {name}\'s back.',
            '{name} rearranges the camp in {zone} so that nothing can come at them from behind. Nobody argues.',
            'In {zone} {name} sits facing the opening, and eats, and does not once look down at the food.',
        ],
    },
    {
        label: 'talks to the dead by name',
        lines: [
            '{name} says a name in {zone}, quietly, to nobody who is there. Then another.',
            'In {zone} {name} tells somebody who is dead what they did today. It seems to help.',
            '{name} goes through the fallen in {zone} the way other people go through a shopping list, and lingers on one.',
            'There is a conversation happening in {zone} and {name} is the only living half of it.',
        ],
    },
    {
        label: 'rations by the mouthful',
        lines: [
            '{name} eats in {zone} by counting, and stops at the number, and puts the rest away.',
            'In {zone} {name} portions a meal that would not feed a child into three and eats one.',
            '{name} weighs the food in their hand in {zone} before deciding how much of tomorrow it is.',
            'Everybody else eats when they are hungry. In {zone} {name} eats when the count says so.',
        ],
    },
    {
        label: 'whistles when scared',
        lines: [
            'A few bars of something drift out of {zone}. {name} is not aware they are doing it.',
            '{name} whistles in {zone}, badly, and the whistling stops when the thing they were scared of does.',
            'In {zone} {name} starts whistling and the people near them go very still, because they know what it means.',
            'Somewhere in {zone}, a tune. Two notes, over and over. {name} is frightened.',
        ],
    },
    {
        label: 'hoards cordage',
        lines: [
            '{name} picks up a length of something stringy in {zone} and adds it to the bundle. The bundle is now most of their pack.',
            'In {zone} {name} unpicks a bit of cloth for the thread. They have no immediate use for the thread.',
            '{name} spends an hour in {zone} re-coiling every piece of line they own. There are a lot of pieces.',
            'A frayed bit of rope in {zone}. {name} takes it. {name} would take a shoelace.',
        ],
    },
    {
        label: 'checks the sky for cameras',
        lines: [
            '{name} looks up in {zone}, finds the lens, and looks away with an expression the lens does not get.',
            'In {zone} {name} says something to the tree canopy. It is for the Capitol, and it is not friendly.',
            '{name} moves out from under a clear patch of sky in {zone} for no reason anyone can see.',
            'Every so often in {zone} {name} counts the angles something could be watching from. They get a different number each time.',
        ],
    },
    {
        label: 'keeps score on their arm',
        lines: [
            '{name} scratches another mark into the skin of their forearm in {zone}. There are several.',
            'In {zone} {name} counts the marks on their arm and does not say what they are counting.',
            'A line of small cuts on {name}\'s arm, added to in {zone}. Days, or people, or something else.',
            '{name} rolls their sleeve down in {zone} when somebody looks at the marks.',
        ],
    },
    {
        label: 'apologises to the arena',
        lines: [
            '{name} steps on something that cracks in {zone} and says sorry to it.',
            'In {zone} {name} breaks a branch for the fire and apologises, quietly, to the tree.',
            '{name} drinks from the stream in {zone} and thanks it. Out loud. Every time.',
            'Somebody in {zone} is apologising to the ground. It is {name}, and the ground has done nothing.',
        ],
    },
    {
        label: 'sharpens the same stick',
        lines: [
            '{name} takes the stick out in {zone} and puts an edge on it that was already there.',
            'In {zone} {name} whittles the point of a stick they have been whittling since day one. It is very sharp and very short.',
            'The stick in {name}\'s hands in {zone} is not a weapon. It has never been a weapon. It gets sharpened anyway.',
            '{name} finds the stick has finally worn to nothing in {zone}, and picks up another one.',
        ],
    },
    {
        label: 'counts exits before sitting down',
        lines: [
            '{name} walks the edge of {zone} once before doing anything else in it.',
            'In {zone} {name} points, silently, at three ways out, and only then sits down.',
            '{name} will not rest in {zone} until they have found the second way out of it. There is not one. They keep looking.',
            'Two exits is the minimum for {name}. {zone} has one, and {name} is not comfortable.',
        ],
    },
    {
        label: 'wears a dead tribute\'s token',
        lines: [
            '{name} touches the thing at their throat in {zone}. It was not theirs at the start.',
            'In {zone} {name} takes out a token that belonged to somebody who is in the sky now, and holds it, and puts it back.',
            'The token {name} carries through {zone} is somebody else\'s. They are not going to explain that to anyone.',
            '{name} ties the cord tighter in {zone}. Losing it would be losing the person twice.',
        ],
    },
    {
        label: 'eats with their boots on and laced',
        lines: [
            '{name} eats in {zone} on their feet, turning slowly, watching the whole way round.',
            'In {zone} {name} refuses a seat and eats walking, and is done before anybody else has started.',
            'Somebody offers {name} a place by the fire in {zone}. They eat standing behind it instead.',
            '{name} never sits to eat in {zone}. Sitting is for people who are sure nobody is coming.',
        ],
    },
    {
        label: 'names their weapon',
        lines: [
            '{name} says something to the blade in {zone} before putting it away. It has a name. They have not told anyone the name.',
            'In {zone} {name} cleans the weapon and talks to it, low, the way you would to a dog.',
            '{name} refers to the thing in their hand in {zone} by a name, once, and then pretends they did not.',
            'The weapon has a name and {name} uses it in {zone}, quietly, when they think nobody is listening.',
        ],
    },
    {
        label: 'sleeps in shifts with nobody',
        lines: [
            '{name} sleeps two hours in {zone}, wakes, checks nothing, sleeps two more. Nobody is on watch. They do it anyway.',
            'In {zone} {name} wakes at the same hour every night to take a watch nobody asked them to.',
            '{name} has divided the night in {zone} into pieces, and sleeps only inside the pieces.',
            'Alone in {zone}, {name} still keeps a rota. It has one name on it.',
        ],
    },
    {
        label: 'presses flowers in their pack',
        lines: [
            '{name} finds something small and blue in {zone} and puts it between two flat things in their pack.',
            'In {zone} {name} takes out a pressed leaf, looks at it, and puts it back where it will stay flat.',
            'There is a flower in {name}\'s pack in {zone}. There has been a different one every day.',
            '{name} stops in {zone} for something growing that nobody else would have seen, and keeps it.',
        ],
    },
    {
        label: 'salutes the cannon',
        lines: [
            'The cannon goes and {name} stops in {zone} and raises two fingers to their brow. Then walks on.',
            'In {zone} {name} stands for the cannon. Every cannon. Even the ones they are glad about.',
            '{name} hears the cannon in {zone} and, before anything else, salutes whoever it was.',
            'A cannon. In {zone} {name} touches their forehead and says nothing, and then says one word.',
        ],
    },
    {
        label: 'refuses to say the arena\'s name',
        lines: [
            '{name} calls it "here" in {zone}. They have never once used the word the Capitol gave it.',
            'In {zone} somebody says the arena\'s name and {name} winces as if it were a slur.',
            '{name} talks about {zone} and "this place" and "out there". Never the name. The name is the Capitol\'s.',
            'Asked where they are, in {zone}, {name} says "not home". It is the closest they will come.',
        ],
    },
    {
        label: 'counts their own heartbeats',
        lines: [
            '{name} sits in {zone} with two fingers at their throat and their lips moving.',
            'In {zone} {name} takes their own pulse before a decision, and makes it when the number is right.',
            '{name} has a number in their head in {zone} and it is going up, and they are waiting for it to come down.',
            'Two fingers to the neck in {zone}. {name} is checking they are still frightened, or still alive, or both.',
        ],
    },
    {
        label: 'hums the anthem wrong',
        lines: [
            '{name} hums a few bars in {zone} and every note of it is somewhere adjacent to the anthem.',
            'In {zone} {name} gets the Capitol anthem almost right and then, on purpose, does not.',
            'The tune coming out of {zone} is the anthem, sung the way {name}\'s district sings it, which is not the way it is meant to be sung.',
            '{name} finishes the anthem in {zone} on the wrong note, deliberately, and looks happier for it.',
        ],
    },
];

/**
 * Audit 4 §6.3/§10.1: what each quirk actually does.
 *
 * 85 quirks with four-plus lines each were the best character-differentiation
 * content in the repository and were **entirely inert**: read in two places,
 * one that assigns them and one that surfaces a line on a quiet cycle, plus a
 * single achievement that counts how many somebody has. "Always takes the high
 * ground", "never turns their back on a treeline", "sleeps in short shifts by
 * choice" — every one of them is a mechanical hook written out in prose and
 * left as prose, which is precisely the failure `data/traits.ts` exists to
 * document having fixed once already.
 *
 * They reuse `TraitMod` rather than growing a vocabulary of their own, so a
 * quirk costs a data row and no read site at all, and `traitMod()` folds them
 * into the same sum. Every row is derived from what the quirk's own label
 * says, and several of them cost something — somebody who skips breakfast to
 * scout is hungrier, somebody who sleeps in short shifts is more tired — because
 * a habit that is all upside is a trait with the price filed off.
 *
 * Magnitudes are about a third of a trait's. A tribute carries one or two, they
 * are free, and they are meant to be a tilt rather than a build.
 */
export const QUIRK_MODS: Record<string, Partial<Record<TraitMod, number>>> = {
    'counts the days out loud': { resolveDrift: 0.2 },
    'will not sleep near water': { water: -0.6, awarenessNight: 0.3 },
    'always takes the high ground': { highland: 0.7 },
    'talks to the cameras': { excitement: 0.1, concealment: -0.02 },
    'never turns their back on a treeline': { awareness: 0.3, ambush: -0.02 },
    'hums their district anthem': { resolveDrift: 0.15, concealment: -0.02 },
    'keeps a pebble from home': { resolveDrift: 0.2 },
    'sharpens everything twice': { meleePower: 0.3 },
    'eats in exact halves': { hungerDrain: -1.5 },
    'names the mutts': { fearGain: -0.1, muttDamage: -0.05 },
    'sleeps sitting up': { fatigueNight: 1.5, awarenessNight: 0.5 },
    'reads the sky before anything else': { coldResist: 0.08, heatResist: 0.08 },
    'walks their camp perimeter three times': { campSkill: 0.05, awareness: 0.2 },
    'never says the fallen’s names': { griefResist: 0.12 },
    'braids or knots something when thinking': { trapSkill: 0.04, campSkill: 0.03 },
    'tastes rain': { thirstDrain: -1.5 },
    'keeps their laces double-tied': { fatigueDay: -0.8 },
    'collects one thing from every zone': { scavenge: 0.04, capacity: 0 },
    'apologises to plants they cut': { forage: 0.03, treachery: -0.03 },
    'refuses to drink first': { poisonResist: 0.1, thirstDrain: 1 },
    'marks the trees as they pass': { awareness: 0.25 },
    'stretches like an athlete before moving': { fatigueDay: -1, retreat: 0.02 },
    'whistles one note when the coast is clear': { allianceAffinity: 0.04, concealment: -0.02 },
    'keeps score against the arena': { resolveDrift: 0.2, excitement: 0.05 },
    'always faces the Cornucopia when they rest': { awareness: 0.2 },
    'chews on a stalk of grass': { hungerDrain: -1 },
    'cracks their knuckles before decisions': { unarmedPower: 0.3 },
    'sings only when it rains': { sanityRecovery: 1, concealment: -0.02 },
    'refuses to step on flowers': { forage: 0.03 },
    'talks in their sleep': { concealment: -0.04 },
    'tests every branch twice': { retreat: 0.03, fatigueDay: 0.5 },
    'skips breakfast until they have scouted': { awareness: 0.3, hungerDrain: 1 },
    'wipes their blade on their left sleeve': { meleePower: 0.2 },
    'salutes the sky after the anthem': { excitement: 0.08, griefResist: 0.05 },
    'builds tiny cairns at camps': { campSkill: 0.05 },
    'never finishes a water skin': { thirstDrain: -1, scavenge: -0.02 },
    'counts everything in dozens': { scavenge: 0.03 },
    'whittles when nervous': { trapSkill: 0.05 },
    'sleeps with their boots on': { fatigueNight: 1, retreat: 0.04 },
    'greets the sunrise out loud': { resolveDrift: 0.15, concealment: -0.02 },
    'checks their reflection in water': { sponsorAppeal: 0.3, concealment: -0.02 },
    'keeps their back to the wind': { coldResist: 0.1 },
    'ties a fresh knot every morning': { campSkill: 0.04, trapSkill: 0.03 },
    'eats standing up': { awareness: 0.2, hungerDrain: 0.5 },
    'apologises when they take supplies': { rapport: 0.06, treachery: -0.04 },
    'draws maps in the dirt and erases them': { awareness: 0.3 },
    'hoards string': { trapSkill: 0.05, capacity: 0 },
    'names their weapons': { meleePower: 0.25, rangedPower: 0.15 },
    'refuses to eat meat they did not catch': { poisonResist: 0.12, hungerDrain: 1 },
    'stacks their supplies in the same order': { scavenge: 0.04 },
    'listens with their eyes shut': { awareness: 0.4, ambush: -0.02 },
    'saves the best bite for last': { hungerDrain: -1, resolveDrift: 0.1 },
    'never sits with their back to a door or gap': { ambush: -0.04, awareness: 0.2 },
    'taps out rhythms on their knee': { concealment: -0.03, resolveDrift: 0.1 },
    'collects feathers': { rangedPower: 0.25 },
    'reads tracks out loud': { awareness: 0.3, concealment: -0.02 },
    'washes before the anthem': { medicine: 0.05, concealment: -0.02 },
    'leaves food for the birds': { forage: 0.04, hungerDrain: 0.5 },
    'braids their hair before a fight': { combatPower: 0.3, retreat: -0.02 },
    'quotes their mentor': { sponsorTrust: 0.15, resolveDrift: 0.1 },
    'always knows which way is home': { resolveDrift: 0.2, nightMovement: 0.3 },
    'smells everything before eating it': { poisonResist: 0.15 },
    'keeps a dead tribute\'s count': { targetDraw: 0.2, excitement: 0.06 },
    'wraps their knuckles each morning': { unarmedPower: 0.35 },
    'never steps in running water': { water: -0.5, concealment: 0.02 },
    'hums while working': { campSkill: 0.04, concealment: -0.03 },
    'points at the sky when a cannon fires': { griefResist: 0.08, excitement: 0.05 },
    'sleeps in short shifts by choice': { awarenessNight: 0.6, fatigueNight: 2 },
    'talks to their token': { sanityRecovery: 1.5 },
    'balances things on their fingers': { rangedPower: 0.2 },
    'always shares first': { allianceAffinity: 0.06, rapport: 0.05, hungerDrain: 0.5 },
    'mutters odds under their breath': { odds: 0.3, concealment: -0.02 },
    'faces threats side-on': { defended: 0.3, retreat: 0.02 },
    'keeps their fire tiny': { concealment: 0.04, campSkill: -0.02 },
    'buries what they cannot carry': { scavenge: 0.05 },
    'winds an imaginary watch': { resolveDrift: 0.15 },
    'thanks the parachutes': { sponsorTrust: 0.2 },
    'walks heel-to-toe on soft ground': { concealment: 0.05 },
    'names the stars wrong on purpose': { sanityRecovery: 1, nightMovement: 0.2 },
    'checks on sleeping allies': { allianceAffinity: 0.06, betrayalResist: 0.08 },
    'spits for luck before crossing open ground': { retreat: 0.03 },
    'keeps the last coal of every fire': { campSkill: 0.06 },
    'sharpens sticks while on watch': { trapSkill: 0.05, awarenessNight: 0.3 },
    'won\'t say the word "arena"': { resolveDrift: 0.15, sanityDrain: -0.05 },
    'measures time in shifts': { fatigueDay: -0.6, fatigueNight: -0.6 },
    'sleeps with a knife in their fist': { awarenessNight: 0.3, sanityRecovery: -1 },
    'never sits with their back to a door': { ambush: -0.03, awareness: 0.3 },
    'talks to the dead by name': { griefResist: 0.15, sanityDrain: 0.05 },
    'rations by the mouthful': { hungerDrain: -1.0 },
    'whistles when scared': { concealment: -0.03, fearGain: -0.05 },
    'hoards cordage': { trapSkill: 0.15, capacity: 1 },
    'checks the sky for cameras': { sponsorTrust: -0.2, excitement: 0.05 },
    'keeps score on their arm': { killSanity: -0.1, resolveDrift: 0.1 },
    'apologises to the arena': { forage: 0.05, sanityRecovery: 1 },
    'sharpens the same stick': { meleePower: 0.2 },
    'counts exits before sitting down': { retreat: 0.04 },
    'wears a dead tribute\'s token': { griefResist: 0.2, targetDraw: 0.3 },
    'eats with their boots on and laced': { awareness: 0.2, fatigueDay: 0.5 },
    'names their weapon': { combatPower: 0.2, excitement: 0.05 },
    'sleeps in shifts with nobody': { awarenessNight: 0.6, fatigueNight: 1.0 },
    'presses flowers in their pack': { resolveDrift: 0.15, sponsorAppeal: 0.3 },
    'salutes the cannon': { griefResist: 0.1, sponsorTrust: 0.2 },
    'refuses to say the arena\'s name': { resolveDrift: 0.2, sponsorAppeal: -0.3 },
    'counts their own heartbeats': { fearGain: -0.08, sanityDrain: -0.05 },
    'hums the anthem wrong': { excitement: 0.1, concealment: -0.02 },
};

/**
 * Audit 4 §6.3: what a quirk does, in words, for the tribute sheet.
 *
 * The rows above are the mechanic; this is the sentence. Kept next to the data
 * rather than in the component so the two cannot drift — the failure mode
 * `data/traits.ts` describes for its own `info` field.
 */
const MOD_PHRASES: Partial<Record<TraitMod, [string, string]>> = {
    // [what a positive value means, what a negative value means]. Several of
    // these hooks are costs rather than benefits — a drain, a fatigue, a
    // multiplier offset — so the sign that reads as *good* is not the same
    // across the table and the pair has to be written per hook.
    awareness: ['misses less', 'notices less'],
    awarenessNight: ['keeps a better watch after dark', 'keeps a worse watch after dark'],
    concealment: ['is harder to spot', 'is easier to spot'],
    ambush: ['ambushes better', 'is easier to ambush'],
    combatPower: ['fights harder', 'fights softer'],
    meleePower: ['is better in close', 'is worse in close'],
    rangedPower: ['throws and shoots better', 'throws and shoots worse'],
    unarmedPower: ['is worse to grapple with', 'is easier to grapple with'],
    defended: ['is harder to land a blow on', 'is easier to land a blow on'],
    retreat: ['breaks off sooner', 'presses on longer'],
    hungerDrain: ['goes hungry faster', 'goes hungry slower'],
    thirstDrain: ['goes thirsty faster', 'goes thirsty slower'],
    fatigueDay: ['tires faster by day', 'tires slower by day'],
    fatigueNight: ['rests worse', 'rests better'],
    sanityDrain: ['frays faster', 'holds together better'],
    sanityRecovery: ['steadies faster', 'steadies slower'],
    resolveDrift: ['is harder to put out', 'is easier to put out'],
    griefResist: ['carries a death better', 'carries a death worse'],
    poisonResist: ['shrugs off bad food and venom', 'is quicker to be poisoned'],
    coldResist: ['handles cold better', 'handles cold worse'],
    heatResist: ['handles heat better', 'handles heat worse'],
    forage: ['forages better', 'forages worse'],
    medicine: ['treats a wound better', 'treats a wound worse'],
    trapSkill: ['sets a better trap', 'sets a worse trap'],
    campSkill: ['makes a better camp', 'makes a worse camp'],
    scavenge: ['finds more', 'finds less'],
    highland: ['prefers high ground', 'avoids high ground'],
    water: ['prefers water', 'avoids water'],
    nightMovement: ['moves better after dark', 'moves worse after dark'],
    allianceAffinity: ['is easier to ally with', 'is harder to ally with'],
    betrayalResist: ['is harder to turn on', 'is easier to turn on'],
    treachery: ['is quicker to turn', 'is slower to turn'],
    rapport: ['mends a quarrel faster', 'mends a quarrel slower'],
    persuasion: ['argues better', 'argues worse'],
    sponsorTrust: ['keeps sponsors warmer', 'cools sponsors'],
    sponsorAppeal: ['sells better before the gong', 'sells worse before the gong'],
    excitement: ['plays better on camera', 'plays worse on camera'],
    odds: ['is priced shorter', 'is priced longer'],
    targetDraw: ['draws the field toward them', 'draws the field away'],
    fearGain: ['frightens more easily', 'frightens less easily'],
    muttDamage: ['takes more from mutts', 'takes less from mutts'],
    capacity: ['carries more', 'carries less'],
};

/** "notices more; goes hungry faster" — or undefined for a quirk with no row. */
export function quirkEffect(label: string): string | undefined {
    const mods = QUIRK_MODS[label];
    if (!mods) return undefined;
    const parts = (Object.entries(mods) as Array<[TraitMod, number]>)
        .filter(([, v]) => v !== 0)
        .map(([key, v]) => {
            const phrase = MOD_PHRASES[key];
            if (!phrase) return undefined;
            // Several hooks read "less is better" — a drain, a cost, a
            // multiplier offset — so the sign that means *good* is not the same
            // everywhere. The phrase pair is written [positive value, negative
            // value] and the read site does not have to know which is which.
            return v > 0 ? phrase[0] : phrase[1];
        })
        .filter((x): x is string => !!x);
    return parts.length > 0 ? parts.join('; ') : undefined;
}
