import type { OffSeasonSkin } from '../offSeason';
import { OFF_SEASON } from '../balance';

/**
 * Seasons for the Hippodrome set (`arenasSetHippodrome.ts`), on the rule the
 * other skins follow: the thing that makes the arena *that* arena is switched
 * off, turned up, or answered by a different law.
 */
export const OFF_SEASON_SKINS_HIPPODROME: Record<string, OffSeasonSkin[]> = {
    hippodrome: [{
        label: 'the closing-night year',
        description: 'The same park on its last night of the season. Every ride is running, every booth is lit, the calliope is playing the finale on a loop, and the Gamemakers have stopped pretending the animatronics are decorations.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the boarded-up year',
        description: 'The same park after a winter nobody came. The rides are sheeted, the booths are boarded, and for the first time the music has stopped — which in an arena built on noise is its own kind of loud.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }],
    undercroft: [{
        label: 'the flood year',
        description: 'The same subway after a wet spring. The sumps are full, the south tunnel is a canal, and the platforms are the only dry ground left under the city.',
        addLaw: 'shrinkingArena',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the maintenance year',
        description: 'The same tunnels with the service trains stabled. The depot is stocked, the lamps are lit, and the only thing still running on schedule is the ghost train.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
    vintage: [{
        label: 'the late-summer year',
        description: 'The same slope a month earlier. The vines are heavy, the nights are mild, and the frost that defines this arena is weeks away yet.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the black-frost year',
        description: 'The same vineyard after the killing frost came early. Every row is dead to the root, the terraces are bare, and the cellar is the only place on the hill anybody can live.',
        resourceShift: OFF_SEASON.barren,
        dangerShift: OFF_SEASON.harsher,
    }],
    cinderpeak: [{
        label: 'the high-summer year',
        description: 'The same summit in the one month the snow goes. The ridge is bare rock, the reservoir is open water, and a whiteout is a rumour.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the storm year',
        description: 'The same observatory in the worst winter on record. The dome is iced shut, the cable car has not moved in a month, and the clear days are few enough to count.',
        addLaw: 'deadlyNight',
        dangerShift: OFF_SEASON.harsher,
    }],
    opencut: [{
        label: 'the working year',
        description: 'The same pit with the shift still on. The crusher runs, the conveyor runs, the blast plan is posted on the site office door, and the Gamemakers are keeping to it.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the abandoned year',
        description: 'The same mine ten years after the last truck left. The benches have grown over, the pit bottom is a lake, and the ground has had time to settle — for now.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.kinder,
    }],
};
