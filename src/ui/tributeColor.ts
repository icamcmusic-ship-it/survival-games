/**
 * §2.2: per-tribute colour identity, carried across every surface.
 *
 * Identity in the interface was name-only: the same string in the feed, on
 * the map, on the odds board and in the relationship graph, with nothing
 * tying them together at a glance. Twenty-four names is more than a reader
 * can hold, and the chronicle moves faster than they can look each one up.
 *
 * Derived rather than stored: the hue comes from the district (so the two
 * tributes from one district are visibly related, which is a real fact about
 * them) and is split by gender within it, so the colour is stable across a
 * run, across a replay of the same seed, and across an archived Games —
 * without adding a field that every save migration would then have to carry.
 */

/** Twelve district hues, evenly spread and hand-nudged off each other. */
const DISTRICT_HUE: Record<number, number> = {
    1: 45, 2: 12, 3: 205, 4: 190, 5: 265, 6: 285,
    7: 105, 8: 320, 9: 60, 10: 25, 11: 135, 12: 220,
};

export function tributeColor(district: number, gender: 'Male' | 'Female'): string {
    const hue = DISTRICT_HUE[district] ?? (district * 30) % 360;
    // The pair from a district share a hue and differ in weight, so they read
    // as siblings rather than as strangers who happen to be adjacent.
    return gender === 'Male'
        ? `hsl(${hue} 55% 38%)`
        : `hsl(${hue} 62% 52%)`;
}

/** The CSS custom property every surface reads, ready to spread onto a style. */
export function tributeColorVar(district: number, gender: 'Male' | 'Female'): Record<string, string> {
    return { '--tribute': tributeColor(district, gender) };
}
