export function xmur3(str: string) {
    for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    } return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}

export function sfc32(a: number, b: number, c: number, d: number) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = c << 21 | c >>> 11;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

/**
 * A rerolled cast composes its seed as `base~SUFFIX` (see `rerollCast`). The
 * suffix rerolls the cast and the year's profile, but NOT the things that were
 * already locked in when the reroll button was pressed — the arena and the
 * Quarter Quell. Anything that must stay stable across a reroll derives its
 * stream from this, so that replaying the composite seed from a share link
 * resolves the same arena and the same Quell as the session it was copied from.
 */
export function baseSeedOf(seed: string): string {
    return seed.split('~')[0];
}

export class RNG {
    private random: () => number;
    constructor(seed: string) {
        const seedFunc = xmur3(seed);
        this.random = sfc32(seedFunc(), seedFunc(), seedFunc(), seedFunc());
    }
    nextFloat(): number {
        return this.random();
    }
    nextInt(min: number, max: number): number {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }
    /**
     * Picks from a non-empty array. An empty array is a call-site bug — every
     * caller of this overload has already guarded, or is picking from a
     * literal pool — so it throws rather than handing back an `undefined`
     * wearing a `T`, which used to travel silently into fields the soak's
     * undefined/NaN grep (it reads rendered log text) could never see.
     * Use `pickOrUndefined` where an empty pool is a legitimate outcome.
     */
    pick<T>(arr: T[]): T {
        const picked = this.pickOrUndefined(arr);
        if (picked === undefined) throw new Error('RNG.pick called with an empty array — use pickOrUndefined for pools that may be empty');
        return picked;
    }
    /**
     * The honest form: an empty pool yields `undefined` and, crucially, does
     * not consume a draw. nextInt(0, -1) burned one and returned undefined, so
     * the stream position depended on data the call site had already guarded
     * against — a replay-divergence hazard.
     */
    pickOrUndefined<T>(arr: readonly T[]): T | undefined {
        if (arr.length === 0) return undefined;
        return arr[this.nextInt(0, arr.length - 1)];
    }
    chance(probability: number): boolean {
        return this.random() < probability;
    }
    /**
     * Deterministic Fisher-Yates. `[...arr].sort(() => rng() - 0.5)` was used
     * previously, which is both biased and dependent on the engine's sort
     * implementation — the same seed could produce different runs.
     */
    shuffle<T>(arr: T[]): T[] {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }
}
