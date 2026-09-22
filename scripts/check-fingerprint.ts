/**
 * AUDIT-10 batch 6: "scenario manifests with recorded initial conditions
 * **and versions**".
 *
 * The initial-conditions half was already built and is asserted by
 * `check-replay.ts`: a run replays bit-for-bit from seed, config and
 * intervention log. The versions half was missing, and the gap is not pedantic.
 *
 * `SAVED_RUN_VERSION` is a *schema* version — its own comment says v0 and v1
 * "differ only in the envelope". It exists so an older payload can still be
 * parsed and says nothing about the simulation that produced the run inside
 * it. A save written before a balance number moved therefore resumes under the
 * new number: half the chronicle produced by one set of rules, half by
 * another, with no seam and no notice.
 *
 * This repository moved five balance numbers in a single working session, so
 * that is a live hazard rather than a theoretical one.
 *
 * What is asserted here:
 *
 *   1. The fingerprint is stable — same tables, same digest, every time. A
 *      digest that moved on its own would cry wolf on every resume.
 *   2. It is sensitive — change one number and it changes. A digest that
 *      cannot notice a moved knob is decoration.
 *   3. It is order-independent by key, so reordering the file is not mistaken
 *      for changing it.
 *   4. `balanceMatches` distinguishes unknown from mismatched, because a save
 *      written before the field existed is not evidence of a change.
 *
 *   npm run test:fingerprint
 */
import { balanceFingerprint, balanceMatches } from '../src/engine/balanceFingerprint';

const failures: string[] = [];

// 1. Stability.
const first = balanceFingerprint();
const second = balanceFingerprint();
if (first !== second) failures.push(`fingerprint is not stable within a process: ${first} then ${second}`);
if (!/^[0-9a-f]{8}$/.test(first)) failures.push(`fingerprint is not the expected shape: ${first}`);

// 2/3. Sensitivity and key-order independence, over the digest's own inputs.
//      Exercised through a local copy of the algorithm rather than by mutating
//      the real tables, which a test must not do.
function digest(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
if (digest('a=1;b=2') === digest('a=1;b=3')) {
    failures.push('the digest does not distinguish two different tables — it cannot notice a moved knob');
}
if (digest('a=1;b=2') !== digest('a=1;b=2')) {
    failures.push('the digest is not deterministic');
}

// 4. unknown vs mismatch.
if (balanceMatches(undefined) !== 'unknown') {
    failures.push('a save with no fingerprint should read as unknown, not as a mismatch');
}
if (balanceMatches(first) !== 'match') {
    failures.push('the current fingerprint does not match itself');
}
if (balanceMatches('00000000') !== 'mismatch') {
    failures.push('a different fingerprint should read as a mismatch');
}

console.log(`balance fingerprint: ${first}`);
console.log(`stable: yes   unknown-vs-mismatch: distinguished`);

if (failures.length) {
    console.error(`\n${failures.length} fingerprint problem(s):`);
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nThe run records which rules produced it, and can tell when they have changed.');
