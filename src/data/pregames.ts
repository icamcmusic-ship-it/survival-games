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
    ],
    ordinary: [
        '{tribute} climbs the steps without being told twice. Their district watches them do it.',
        '{tribute} finds a face in the crowd, holds it for exactly as long as they can, and then looks at the escort instead.',
        '{tribute} says something to the girl beside them before they go. Nobody on the broadcast hears what.',
    ],
    hardened: [
        '{tribute} is on the stage before the escort has finished saying the name, and looks out at the square like they own it.',
        '{tribute} takes the steps two at a time. The Capitol cameras like that very much.',
        '{tribute} shakes the escort\'s hand. Half the square applauds and the other half does not.',
    ],
};

export const GOODBYE_SCENES = [
    'Three minutes in the Justice Building. {tribute}\'s family says almost nothing useful and every word of it will be remembered.',
    '{tribute} is given a token from home — small enough to be allowed, heavy enough to matter — and told to keep it where nobody can take it.',
    'Nobody comes for {tribute}. They sit in the velvet room by themselves for the full three minutes and then stand up when the door opens.',
    '{tribute}\'s mother makes them promise to try. {tribute} promises, and both of them know what the promise is worth.',
    'A neighbour comes instead of family, and spends the three minutes explaining exactly how to find water. It is the most useful thing anyone says to {tribute} all week.',
    '{tribute} is told to win. Just that, over and over, until the Peacekeepers come.',
];

export const TRAIN_SCENES = [
    '{tribute} eats better on the train than they have in their life, and is quietly sick afterwards.',
    '{tribute} spends the journey at the window watching a country they were never allowed to see.',
    '{tribute} does not sleep. The compartment is soft and warm and moving, and none of that helps.',
    '{tribute} watches every second of the reaping recaps, twice, taking notes on the faces.',
    '{mentor} finds {tribute} on the train and says one true thing. It is not encouraging, and it is the reason {tribute} lasts as long as they do.',
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
];
