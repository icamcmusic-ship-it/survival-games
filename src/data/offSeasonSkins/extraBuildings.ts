import type { OffSeasonSkin } from '../offSeason';
import { OFF_SEASON } from '../balance';

/**
 * AUDIT-12 §8.8: seasons for the five building arenas (`arenasNew.ts`), which
 * were the only hand-authored arenas with none. Same rule as the rest: the
 * thing that makes the building *that* building is switched off, turned up,
 * or answered by a different law.
 */
export const OFF_SEASON_SKINS_BUILDINGS: Record<string, OffSeasonSkin[]> = {
    gallery: [{
        label: 'the gala year',
        description: 'The same opera house dressed for opening night. The chandeliers are lit, the orchestra pit is full of instruments nobody will play, and every sound in the building arrives at the back row twice as loud as it left.',
        addLaw: 'openMic',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the dark-house year',
        description: 'The same opera house with the season cancelled. Dust sheets over the stalls, the fly loft rigged down, and a silence that swallows footsteps the way the house was built never to.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.kinder,
    }],
    malthouse: [{
        label: 'the dry year',
        description: 'The same brewery with the stills cold and the vats drained. Nothing in the enclosed rooms will catch, and the grain stores the vapour used to guard are standing open.',
        addLaw: 'fireImpossible',
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the full-mash year',
        description: 'The same distillery running flat out. Every still is lit, the vapour is at the ceiling of every room by dusk, and a dropped match in the wrong one is a chain of rooms going up.',
        dangerShift: OFF_SEASON.harsher,
    }],
    circuit: [{
        label: 'the race-day year',
        description: 'The same speedway with the grandstand full of cardboard crowds and the pace car running twice as often. The infield is the only ground that is not on somebody\'s lap.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }, {
        label: 'the off-track year',
        description: 'The same circuit after the season closed. The garages are stocked for a race that never came, the track is still one way, and whatever laps it does so slower.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
    wardblock: [{
        label: 'the riot year',
        description: 'The same prison the week the locks failed open. Doors stand wherever they swung, the blocks carry sound again, and the timers that sealed them are clicking through a schedule no door is listening to.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the inspection year',
        description: 'The same prison scrubbed for a visit that never came. The infirmary is stocked, the mess is full, and the lockdown runs to the minute.',
        addLaw: 'dawnMercy',
        resourceShift: OFF_SEASON.fertile,
    }],
    glasshouse: [{
        label: 'the hail year',
        description: 'The same conservatory under a sky throwing ice. Panes go by the dozen rather than the wing, and there is no longer any glass anyone would call shelter.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the bloom year',
        description: 'The same glasshouse in a season every bed came up at once. The wings are heavy with fruit, the air is thick with it, and the glass is holding — for now.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
};
