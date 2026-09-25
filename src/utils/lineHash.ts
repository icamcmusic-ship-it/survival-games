/**
 * AUDIT-11 §12: a short, stable hash of a flavour template (FNV-1a, base 36),
 * which is what the cross-session stale-line memory stores instead of text.
 */
export function lineHash(line: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < line.length; i++) {
        h ^= line.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}
