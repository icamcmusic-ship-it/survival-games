import type { ArenaEventDef } from '../arenaFlavor';

/**
 * AUDIT-13 §10.2: arena-specific events V33–V76, and at least three more each
 * for the arenas with the lowest signature share (tidewrack, thresher, kiln,
 * vigil, malthouse, glasshouse and undercroft).
 *
 * Almost all are non-lethal: they change the zone, a vital or the sanity
 * track, which is what gives a run somewhere to go other than the next death.
 * The few that can hurt carry a declared `code`.
 */
const boon = (text: string, fields: Partial<ArenaEventDef>): ArenaEventDef => ({ text, escapeText: '', cause: 'Worn down by the arena', ...fields });

export const EXTRA_ARENA_EVENTS_GROUP9: Record<string, ArenaEventDef[]> = {
    clockwork: [
        boon('The hands of the clock stop over {zone}. For a whole hour nothing ticks, and {tribute} does not trust a minute of it, and rests anyway.', { fatigue: -14, sanity: 6 }),
        boon('The sector under {zone} runs backward: the tide goes out that came in, the fog lifts that fell. {tribute} walks through the same hour twice.', { sanity: 10, quench: 10 }),
    ],
    frozen: [
        boon('The aurora comes down low over {zone} and, somehow, the air under it is warm. {tribute} sleeps out in the open for the first time in days.', { fatigue: -18, sanity: -8, requires: { time: 'night' } }),
        boon('{tribute} finds a seal hole in the ice of {zone} and fishes it until dark.', { feed: 25, terrains: ['water'] }),
    ],
    concrete: [
        boon('{tribute} finds a sniper nest on the twentieth floor above {zone}: a mattress, a view, and nobody.', { fatigue: -10, sanity: -6, terrains: ['highland', 'ruins'] }),
        boon('The elevator in the tower over {zone} works. It should not. {tribute} rides it up and back down just to feel something go right.', { fatigue: -8, sanity: -8, terrains: ['ruins', 'highland'] }),
    ],
    toxic: [
        boon('There is a bubble of clean air over {zone}, a hollow in the fog where the smell stops. {tribute} breathes in it until their lungs stop aching.', { heal: 8, sanity: -6 }),
    ],
    solar: [
        boon('An eclipse takes the sun off {zone} for an hour. {tribute} walks further in that hour than in the whole day before it.', { fatigue: -10, quench: 10, requires: { time: 'day' } }),
    ],
    ashfall: [
        boon('The ash in {zone} has buried somebody\'s cache under a grey drift. {tribute} kicks it open by accident.', { feed: 20, grantItem: 'bandages' }),
    ],
    tempest: [
        boon('The eye of the storm passes over {zone}. Blue sky, dead calm, birds. {tribute} gets a fire lit and dries everything before the far wall arrives.', { fatigue: -10, sanity: -8, requires: { storm: true } }),
    ],
    saltflats: [
        boon('A brine pool in {zone} is thick with tiny shrimp. {tribute} strains them through a shirt and eats them by the handful.', { feed: 20, terrains: ['water', 'open'] }),
    ],
    sporefields: [
        boon('The spore bloom lights {zone} from below, every cap glowing blue-green. {tribute} walks through it and cannot stop looking.', { sanity: -10, startsZoneEffect: 'blooming', requires: { time: 'night' } }),
        boon('It is the edible-cap season in {zone}. Even {tribute}, who trusts nothing here, eats well.', { feed: 30 }),
    ],
    canopy: [
        boon('Fruit bats pour out of {zone} at dusk, thousands of them, and drop half the fruit in the canopy on the way. {tribute} eats what falls.', { feed: 20, sanity: -4 }),
    ],
    vault: [
        boon('A room in {zone} that has been sealed since the start hisses and opens. {tribute} goes in: shelves, dust and a first aid kit.', { grantItem: 'medkit', terrains: ['ruins'] }),
    ],
    warren: [
        boon('The lower tunnels of {zone} flood without warning. {tribute} makes it up to the dry level, and the water drives something fat and edible up with them.', { feed: 15, fatigue: 12, startsZoneEffect: 'flooded' }),
    ],
    islands: [
        boon('At the lowest tide of the week a land bridge rises out of {zone}. {tribute} walks across dry-shod to an island nobody has touched.', { feed: 15, fatigue: -6 }),
    ],
    eclipse: [
        boon('The dusk in {zone} has settled for good, neither day nor night. {tribute} learns to move in it, and it starts to feel like cover.', { sanity: -6 }),
    ],
    reef: [
        boon('The coral in {zone} spawns tonight, the whole reef releasing at once like snow falling upward. {tribute} watches until moonset.', { sanity: -12, requires: { time: 'night' } }),
    ],
    abattoir: [
        boon('The power in {zone} goes out. The machines stop. In the silence {tribute} can hear exactly where everybody is.', { sanity: -6, fatigue: -6 }),
    ],
    carnival: [
        boon('The parade goes round {zone} on its own: floats with nobody on them, a band that is a recording. {tribute} walks behind it where nobody will look.', { sanity: 6, fatigue: -6 }),
        boon('The prize booth in {zone} is still stocked. {tribute} knocks every can off the shelf and takes home the top prize, which turns out to be useful.', { grantItem: 'rope', sanity: -6 }),
    ],
    ashwaste: [
        boon('It rains glass on {zone} — fine and bright, the ash fused in the high heat. {tribute} shelters and gathers a handful of edges worth keeping.', { sanity: 6, grantItem: 'knife' }),
    ],
    quarry: [
        boon('{tribute} finds a water-filled pit on the lower bench of {zone}, deep, clear and cold.', { quench: 40, terrains: ['water', 'open', 'highland'] }),
    ],
    glacier: [
        boon('An ice cave opens off {zone}, blue and still and out of the wind. {tribute} sleeps in it like a stone.', { fatigue: -20, sanity: -6 }),
    ],
    floe: [
        boon('Two floes in {zone} grind together and freeze, and suddenly {tribute} is not alone on a small piece of ice but on a large one with food on it.', { feed: 15, sanity: -6 }),
    ],
    alpine: [
        boon('{tribute} finds a mountain hut above {zone}, shutters closed and the stove still laid. There are matches.', { fatigue: -16, grantItem: 'matches' }),
    ],
    terraces: [
        boon('The paddies of {zone} flood overnight, the old channels finding their way. By morning there are fish in them, and {tribute} is standing in the water with both hands full.', { feed: 20, startsZoneEffect: 'flooded' }),
    ],
    seapeaks: [
        boon('The ledge in {zone} is covered with seabird nests, and the birds are out at sea. {tribute} fills their pockets.', { feed: 25, terrains: ['highland'] }),
    ],
    canopyweb: [
        boon('The spider eggs in {zone} hatch all at once and the web glitters with young for a morning. They are gone by noon, and so is half the game in the zone. {tribute} goes hungry watching it.', { sanity: 8, hunger: 6 }),
    ],
    acousticforest: [
        boon('{tribute} learns the note in {zone} that the mutts go quiet for, and hums it all the way across.', { sanity: -8, fatigue: -4 }),
    ],
    burnscar: [
        boon('Green is coming back in {zone}: fireweed, fern, shoots between the snags. {tribute} eats some and sits in the rest.', { feed: 15, sanity: -8, startsZoneEffect: 'blooming' }),
    ],
    craterfield: [
        boon('{tribute} pulls a fragment of meteor out of a crater in {zone}, heavy and edged. It makes a better weapon than most of what the Cornucopia held.', { grantItem: 'mace' }),
    ],
    culdesac: [
        boon('One house in {zone} is intact: lights, a lock, a larder. {tribute} sleeps in a bed.', { fatigue: -18, feed: 15 }),
    ],
    labyrinth: [
        boon('The walls of {zone} rotate an eighth of a turn and a whole new corridor opens where {tribute} is standing, and it leads to water.', { quench: 25, sanity: 6 }),
    ],
    ashgrove: [
        boon('The ashgrove in the courtyard off {zone} blooms: a phoenix-tree gone red and gold all at once. {tribute} sits under it and remembers school, the real one.', { sanity: -12 }),
    ],
    kelvin: [
        boon('A thaw day on {zone}: the heaters come back on for no reason anyone explains, and {tribute} gets warm for the first time since the launch.', { fatigue: -12, heal: 6 }),
    ],
    silkwood: [
        boon('{tribute} strips silk off an empty web in {zone} and twists it into a rope, which is stronger than anything the Cornucopia had.', { grantItem: 'rope' }),
    ],
    nooneplace: [
        boon('{tribute} recognises a stain on the carpet of {zone}. They have been here. They know which way is out of here.', { sanity: -10, fatigue: -4 }),
    ],
    redcathedral: [
        boon('The bells ring through {zone} from nowhere, down the whole canyon. Every tribute stops to listen. {tribute} counts them, and the counting helps.', { sanity: -6, zoneWide: true }),
    ],
    menagerie: [
        boon('The gates open on the grazing paddocks and the animals come out into {zone}, goats and deer and something like a llama. {tribute} does not go hungry tonight.', { feed: 25, sanity: -4 }),
    ],
    storywood: [
        boon('A path appears in {zone} lined with white stones, and a voice from nowhere offers {tribute} safe passage at a price it does not name. They take the path and the price is not called in. Yet.', { fatigue: -10, sanity: 8 }),
    ],
    cabin: [
        boon('The woodpile behind {zone} is down to the last few rounds. {tribute} splits them all before dark and does the arithmetic on tomorrow.', { fatigue: 12, sanity: 6 }),
    ],
    magmatube: [
        boon('The lava in the lower tube of {zone} drains away overnight, leaving a warm black cave that nobody has ever stood in. {tribute} is the first.', { fatigue: -14, sanity: -6 }),
    ],
    // ---- ≥3 more each for the lowest signature-share arenas -----------------
    tidewrack: [
        boon('The tide goes out further than it has all Games and leaves the whole of {zone} glittering with stranded fish, and {tribute} is out on it with a sack.', { feed: 30, terrains: ['wetland', 'open', 'water'] }),
        boon('{tribute} finds the high-water line in {zone} strung with wreckage, and in it a crate that floated in from somewhere.', { grantItem: 'waterskin' }),
        boon('The fog rolls in off the flats over {zone} at dusk, and {tribute} follows the sound of the surf to a sandbar nobody else knows.', { sanity: -6, fatigue: -6, requires: { time: 'night' } }),
        {
            text: 'The tide comes in over {zone} faster than the tables say, and {tribute} has to swim the last of it with everything they own.',
            escapeText: '{tribute} reads the tide in {zone} early and is on the high sand when it floods.',
            cause: 'Caught by the flood tide on the flats', code: 'drowning',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 6,
            damage: 30, fatigue: 12, terrains: ['wetland', 'water', 'open'],
        },
    ],
    thresher: [
        boon('A shift change on {zone}: every belt stops for ten minutes. {tribute} sleeps for nine of them.', { fatigue: -12 }),
        boon('The sorting floor of {zone} spits out a crate of rations from somewhere upstream. {tribute} gets to it first.', { feed: 25 }),
        boon('The coolant race runs clean in {zone} for once, and {tribute} fills everything they have.', { quench: 35, terrains: ['water'] }),
        {
            text: 'A belt in {zone} snaps and whips across the floor. {tribute} is on the floor.',
            escapeText: '{tribute} hears the belt go in {zone} and drops flat under the whip of it.',
            cause: 'Struck by a snapped thresher belt', code: 'impact',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 6,
            damage: 32, bleeding: true, terrains: ['urban', 'ruins', 'open'],
        },
    ],
    kiln: [
        boon('The kiln in {zone} has gone cold overnight and the pots inside it are sound. {tribute} carries water in one all day.', { quench: 20, grantItem: 'gourd' }),
        boon('Between firings, {zone} is the warmest place in the arena to sleep. {tribute} sleeps against the brick.', { fatigue: -16, requires: { time: 'night' } }),
        boon('{tribute} finds the potters\' store in {zone}: dried food in sealed jars, untouched.', { feed: 25 }),
        {
            text: 'The chimney in {zone} throws a gout of hot ash down on the yard as the kiln fires, and {tribute} is crossing it.',
            escapeText: '{tribute} is under the eaves in {zone} when the chimney coughs.',
            cause: 'Scalded by chimney ash as the kiln fired', code: 'burns',
            dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 6,
            damage: 30, burned: true, terrains: ['open', 'highland', 'desert'],
        },
    ],
    vigil: [
        boon('The watchfires of {zone} are relit by nobody at dusk, and for one night the whole line of them makes a road. {tribute} walks it.', { sanity: -8, fatigue: -6, requires: { time: 'night' } }),
        boon('A sentry post in {zone} has its stores intact. {tribute} eats a soldier\'s ration standing at attention, out of habit that is not theirs.', { feed: 20 }),
        boon('The parade ground in {zone} is silent at dawn except for a single bugle that nobody is playing. {tribute} stands until it stops.', { sanity: 8, requires: { time: 'day' } }),
        {
            text: 'The drill ground in {zone} fires a salute at dawn from guns nobody is manning. {tribute} is standing in front of one of them.',
            escapeText: '{tribute} sees the gun barrels swing in {zone} and steps out of the line of them.',
            cause: 'Deafened and thrown by the dawn salute', code: 'sound',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 6,
            damage: 30, sanity: 10, terrains: ['open'], requires: { time: 'day' },
        },
    ],
    malthouse: [
        boon('{tribute} finds a sack of kilned malt in {zone}, sweet and dry, and eats it by the fistful.', { feed: 25 }),
        boon('The mash tun in {zone} has cooled to bathwater. {tribute} climbs in and, for an hour, is warm.', { fatigue: -14, sanity: -6 }),
        boon('The fermentation floor of {zone} goes quiet when the yeast dies off, and {tribute} can hear every footstep in the building.', { sanity: -4, requires: { time: 'night' } }),
    ],
    glasshouse: [
        boon('The misting system in {zone} comes on at dawn, and {tribute} stands under it with their mouth open.', { quench: 30, requires: { time: 'day' } }),
        boon('{tribute} finds the fruiting wall in {zone}: figs, citrus, a banana tree nobody else has noticed.', { feed: 25, terrains: ['forest', 'open'] }),
        boon('Rain drums on the glass over {zone} all night, and underneath it {tribute} is dry and the noise hides everything.', { fatigue: -12, sanity: -6, requires: { storm: true } }),
    ],
    undercroft: [
        boon('A maintenance cupboard in {zone} is still locked, and {tribute} gets it open: a lamp, a tin of biscuits, and a first aid kit.', { grantItem: 'lantern', feed: 10 }),
        boon('A train that is not running goes through {zone} anyway, lights on, carriages empty. {tribute} watches it pass and sleeps better for knowing where the tracks go.', { sanity: -6, fatigue: -6 }),
        boon('{tribute} finds a dry side-chamber off {zone} above the waterline, full of old bones stacked neatly, and nobody alive.', { fatigue: -12, sanity: 6 }),
    ],
};
