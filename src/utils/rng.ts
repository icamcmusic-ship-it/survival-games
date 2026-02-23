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
    pick<T>(arr: T[]): T {
        return arr[this.nextInt(0, arr.length - 1)];
    }
    chance(probability: number): boolean {
        return this.random() < probability;
    }
}
