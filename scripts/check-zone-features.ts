/**
 * §5.2 (audit): authored versus derived zone interiors.
 *
 * Acoustics, verticality and shelter are shared primitives every arena can
 * use, and `zoneFeatures()` derives a value for any zone that does not author
 * one — which means nothing is ever broken, and also that nothing tells you
 * 37 of 40 arenas are running on a name-hash. This is the same ratchet the
 * flavour pools use: the counts below may rise and may not fall.
 *
 *   npm run test:zone-features
 */
import { ARENAS } from '../src/data/constants';

const rows = ARENAS.map(a => ({
    id: a.id,
    zones: a.zones.length,
    authored: a.zones.filter(z => z.features).length,
    vertical: a.zones.filter(z => z.features?.vertical).length,
    acoustic: a.zones.filter(z => z.features?.acoustics !== undefined && Math.abs(z.features.acoustics - 1) > 0.19).length,
    shelter: a.zones.filter(z => z.features?.shelterQuality !== undefined).length,
}));

const total = (k: keyof typeof rows[number]) => rows.reduce((s, r) => s + Number(r[k]), 0);
console.log('zone interiors: authored vs derived');
console.log('  arena            zones  authored  vertical  acoustic  shelter');
rows.forEach(r => console.log(`  ${r.id.padEnd(16)} ${String(r.zones).padStart(5)}  ${String(r.authored).padStart(8)}  ${String(r.vertical).padStart(8)}  ${String(r.acoustic).padStart(8)}  ${String(r.shelter).padStart(7)}`));
console.log(`  ${'total'.padEnd(16)} ${String(total('zones')).padStart(5)}  ${String(total('authored')).padStart(8)}  ${String(total('vertical')).padStart(8)}  ${String(total('acoustic')).padStart(8)}  ${String(total('shelter')).padStart(7)}`);

/**
 * Floors. Raise these when you author more; they may not be lowered. The
 * per-arena floors are what make an arena *feel* like it has an inside: two
 * places with a top and a bottom, and three that sound different from a field.
 */
const FLOORS = { authoredShare: 0.95, verticalPerArena: 2, acousticPerArena: 3 };

const problems: string[] = [];
const share = total('authored') / total('zones');
if (share < FLOORS.authoredShare) problems.push(`authored zone features cover ${(share * 100).toFixed(1)}% of zones, under the floor of ${FLOORS.authoredShare * 100}%`);
rows.filter(r => r.vertical < FLOORS.verticalPerArena).forEach(r => problems.push(`${r.id}: ${r.vertical} vertical zone(s), floor ${FLOORS.verticalPerArena}`));
rows.filter(r => r.acoustic < FLOORS.acousticPerArena).forEach(r => problems.push(`${r.id}: ${r.acoustic} zone(s) with a non-neutral authored acoustic, floor ${FLOORS.acousticPerArena}`));

if (problems.length > 0) {
    console.log(`\nFAIL: ${problems.length} zone-feature floor(s) not met:`);
    problems.forEach(p => console.log(`  ${p}`));
    process.exit(1);
}
console.log('\nEvery arena carries an authored interior.');
