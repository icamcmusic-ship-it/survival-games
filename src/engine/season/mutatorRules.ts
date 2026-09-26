import { GameConfig } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { hasMutator } from '../../data/mutators';

/**
 * AUDIT-12 wave 3: the mutator effects other systems read through one call,
 * so their files carry a single hook each rather than the mutator logic.
 */

/** `mutts-only-kills`: the pens are opened more readily. */
export function mutatorMuttFactor(config: Pick<GameConfig, 'mutators'>): number {
    return hasMutator(config, 'mutts-only-kills') ? AUDIT12_WAVE3.mutators.muttsOnlyMuttChance : 1;
}
