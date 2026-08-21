/**
 * T-7: per-tribute quirks — non-mechanical idiosyncrasies that make two
 * tributes with identical traits read as different people.
 *
 * Traits are the mechanical personality layer (53 of them, all with numbers
 * attached). Quirks are the other thing a person is: the habit the cameras
 * find, the line the commentators repeat, the detail a viewer remembers after
 * the name is gone. `label` shows on the tribute sheet; `line` occasionally
 * surfaces from the idle beat of a quiet cycle, with `{name}` and `{zone}`
 * filled in.
 */
export interface Quirk {
    label: string;
    line: string;
}

export const QUIRKS: Quirk[] = [
    { label: 'counts the days out loud', line: '{name} counts the days under their breath in {zone}, the way they have since the gong.' },
    { label: 'will not sleep near water', line: '{name} moves their bedroll twice in {zone}, further from the sound of water each time.' },
    { label: 'always takes the high ground', line: '{name} climbs before they rest in {zone}. They always climb first.' },
    { label: 'talks to the cameras', line: '{name} finds a camera in {zone} and says something to it the microphones do not quite catch.' },
    { label: 'never turns their back on a treeline', line: '{name} crosses {zone} sideways, eyes on the treeline the whole way.' },
    { label: 'hums their district anthem', line: 'Somewhere in {zone}, {name} is humming — an old district tune, barely voiced.' },
    { label: 'keeps a pebble from home', line: '{name} turns a small stone over in their fingers in {zone}. It came from home. It goes back in the pocket.' },
    { label: 'sharpens everything twice', line: '{name} checks an edge in {zone} that was already sharp, and sharpens it anyway.' },
    { label: 'eats in exact halves', line: '{name} splits their food into exact halves in {zone} and wraps one. They always wrap one.' },
    { label: 'names the mutts', line: '{name} mutters a name at a distant shriek in {zone} — they have been naming the things that hunt them.' },
    { label: 'sleeps sitting up', line: '{name} settles for the night in {zone} with their back to something solid, upright, the way they always do.' },
    { label: 'reads the sky before anything else', line: 'First thing {name} does in {zone} is look up, for a long moment, at whatever the sky is pretending to be.' },
    { label: 'walks their camp perimeter three times', line: '{name} walks the edge of their ground in {zone} three times. Exactly three.' },
    { label: 'never says the fallen’s names', line: 'Someone mentions the anthem in {zone} and {name} goes quiet. They never say the names.' },
    { label: 'braids or knots something when thinking', line: '{name} sits in {zone} working knots into a cord, tying and untying, thinking.' },
    { label: 'tastes rain', line: 'It is barely drizzling in {zone}, and {name} stands in it with their face up anyway.' },
    { label: 'keeps their laces double-tied', line: '{name} stops mid-stride in {zone} to re-tie a lace that did not need it.' },
    { label: 'collects one thing from every zone', line: '{name} pockets something small in {zone} — a leaf, a bolt, a shell. They have one from everywhere they have been.' },
    { label: 'apologises to plants they cut', line: '{name} takes what they need from the undergrowth in {zone} and says something quiet to it after.' },
    { label: 'refuses to drink first', line: '{name} lets the water sit in {zone}, watching it, before they will touch it. Every time.' },
    { label: 'marks the trees as they pass', line: 'A thumbnail scratch on bark in {zone}: {name} marking where they have been, or the way back.' },
    { label: 'stretches like an athlete before moving', line: '{name} runs through the same slow stretches in {zone} they must have done every morning of their life.' },
    { label: 'whistles one note when the coast is clear', line: 'One flat note carries across {zone}. {name}, telling nobody in particular it is safe.' },
    { label: 'keeps score against the arena', line: '{name} adds a scratch to their bracer in {zone}. Not kills — days the arena has failed to kill them.' },
    { label: 'always faces the Cornucopia when they rest', line: '{name} settles in {zone} facing, as ever, the direction of the horn.' },
];
