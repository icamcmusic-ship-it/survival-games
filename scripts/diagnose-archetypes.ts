/**
 * AUDIT-9 batch 3 step 2: why a weak archetype loses, before anything is tuned.
 *
 * The audit's instruction for the three social archetypes is explicit and is
 * the reason this file exists rather than a balance edit:
 *
 *   "A weak archetype may be failing before its signature has an opportunity,
 *    rather than needing a larger signature bonus."
 *
 * A win rate cannot tell those apart. It is one number at the end of a run,
 * and every hypothesis about *why* — dies too early, never meets anybody,
 * meets people and loses, fires its set piece into an empty zone — predicts
 * the same low number. So this asks the questions a win rate cannot:
 *
 *   - When do they die, by phase? An archetype that dies at the horn is not
 *     the same problem as one that dies on day nine.
 *   - Do they live long enough for their signature to become legal at all,
 *     and how long do they wait once they are alive to want it?
 *   - What kills them, by cause family? Losing fights and starving are
 *     different diseases with different treatments.
 *   - Who is standing near them? A social archetype with nobody in the zone
 *     has no opportunity to be social, and no bonus fixes that.
 *   - For the ones whose plan is violence: what do they pick, and does it
 *     go well?
 *
 * Reported with Wilson intervals at the sample sizes actually achieved,
 * because the whole point of batch 3 step 1 was that point estimates on small
 * archetype populations have been read as findings before.
 *
 *   node --import tsx scripts/diagnose-archetypes.ts
 *   DIAGNOSE_RUNS=1600 node --import tsx scripts/diagnose-archetypes.ts
 */
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { ArchetypeId, GameConfig, GameState, Tribute } from '../src/models/types';
import { ARCHETYPES } from '../src/data/archetypes';
import { CAUSE_FAMILY, deathCodeOf } from '../src/engine/causes';
import { initialRunState } from './runInit';
import { victorsOf } from '../src/utils/notables';

const RUNS = Number(process.env.DIAGNOSE_RUNS ?? 400);
/** Which archetypes to report in full. Everything is measured; this is print. */
const FOCUS = (process.env.DIAGNOSE_FOCUS ?? 'zealot,broker,confessor,career').split(',');

const configs: GameConfig[] = [
    DEFAULT_GAME_CONFIG,
    { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 8, betrayalRate: 1.5 },
];

interface Row {
    entrants: number;
    wins: number;
    days: number;
    /** Died at the horn, before any of the rest of the game happened to them. */
    horn: number;
    /** Died on days 1-3, 4-7, 8+ — the three acts. */
    early: number;
    mid: number;
    late: number;
    /** Signature fired at all. */
    sigFired: number;
    /** Died without their signature ever firing. */
    sigNever: number;
    /** Died at the horn without it firing — no opportunity, by definition. */
    sigNeverHorn: number;
    causes: Record<string, number>;
    /** Sum over sampled cycles of how many other living tributes shared the zone. */
    company: number;
    companySamples: number;
    /** Sampled cycles where they were completely alone in their zone. */
    aloneSamples: number;
    kills: number;
    health: number;
}

const blank = (): Row => ({
    entrants: 0, wins: 0, days: 0, horn: 0, early: 0, mid: 0, late: 0,
    sigFired: 0, sigNever: 0, sigNeverHorn: 0, causes: {},
    company: 0, companySamples: 0, aloneSamples: 0, kills: 0, health: 0,
});

const rows: Record<string, Row> = {};
const row = (id: string) => (rows[id] = rows[id] ?? blank());

/** Wilson score interval, as used by metrics.ts — small rates, small samples. */
function wilson(successes: number, n: number): { lo: number; hi: number } {
    if (n === 0) return { lo: 0, hi: 0 };
    const z = 1.959964;
    const p = successes / n;
    const d = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return { lo: Math.max(0, (centre - spread) / d), hi: Math.min(1, (centre + spread) / d) };
}

const pct = (a: number, b: number) => (b === 0 ? '   n/a' : `${((a / b) * 100).toFixed(1)}%`);
const ci = (a: number, b: number) => {
    const { lo, hi } = wilson(a, b);
    return `${((a / b) * 100).toFixed(2)}% [${(lo * 100).toFixed(2)}–${(hi * 100).toFixed(2)}]`;
};

for (let i = 0; i < RUNS; i++) {
    const arenaId = i % 8 === 7 ? 'procedural' : ARENAS[i % ARENAS.length].id;
    const state = initialRunState({
        seed: `diagnose-${i}`,
        arenaId,
        config: configs[i % configs.length],
    });
    const sim = new Simulator(state);

    // Company is a property of the run, not of the end state, so it has to be
    // sampled while the run is happening — an archetype that spends the whole
    // game alone looks identical at the end to one that was never alone.
    sim.observe((s: GameState) => {
        s.tributes.filter(t => t.status === 'alive').forEach(t => {
            const r = row(t.archetype);
            const here = s.tributes.filter(o =>
                o.status === 'alive' && o.id !== t.id && o.zone === t.zone).length;
            r.company += here;
            r.companySamples += 1;
            if (here === 0) r.aloneSamples += 1;
        });
    });

    let steps = 0;
    while (!sim.isFinished() && steps++ < 400) sim.advance();
    const s = sim.getState();
    const winners = new Set(victorsOf(s).map(w => w.id));

    s.tributes.forEach((t: Tribute) => {
        const r = row(t.archetype);
        r.entrants += 1;
        r.days += t.daysSurvived;
        r.kills += t.kills;
        if (winners.has(t.id)) { r.wins += 1; r.health += t.health; }
        if (t.signatureFired) r.sigFired += 1;
        if (t.status !== 'dead') return;
        if (!t.signatureFired) {
            r.sigNever += 1;
            if (t.diedInBloodbath) r.sigNeverHorn += 1;
        }
        const day = t.dayOfDeath ?? 0;
        if (t.diedInBloodbath) r.horn += 1;
        else if (day <= 3) r.early += 1;
        else if (day <= 7) r.mid += 1;
        else r.late += 1;
        const family = CAUSE_FAMILY[deathCodeOf(t)] ?? 'other';
        r.causes[family] = (r.causes[family] ?? 0) + 1;
    });
}

const ids = Object.keys(ARCHETYPES) as ArchetypeId[];
const ranked = ids
    .filter(id => rows[id])
    .sort((a, b) => (rows[a].wins / rows[a].entrants) - (rows[b].wins / rows[b].entrants));

console.log(`archetype diagnosis over ${RUNS} runs\n`);
console.log('win rate, worst first (Wilson 95%):');
ranked.slice(0, 8).forEach(id => {
    const r = rows[id];
    console.log(`  ${id.padEnd(14)} ${ci(r.wins, r.entrants).padEnd(26)} n=${r.entrants}`);
});

console.log('\nwhere they die (share of that archetype\'s deaths), and how long they last:');
console.log(`  ${'archetype'.padEnd(14)} ${'horn'.padStart(7)} ${'d1-3'.padStart(7)} ${'d4-7'.padStart(7)} ${'d8+'.padStart(7)}   avg days`);
ranked.forEach(id => {
    const r = rows[id];
    const deaths = r.horn + r.early + r.mid + r.late;
    if (deaths === 0) return;
    console.log(`  ${id.padEnd(14)} ${pct(r.horn, deaths).padStart(7)} ${pct(r.early, deaths).padStart(7)} `
        + `${pct(r.mid, deaths).padStart(7)} ${pct(r.late, deaths).padStart(7)}   ${(r.days / r.entrants).toFixed(2)}`);
});

console.log('\nopportunity: did the set piece ever become legal for them?');
console.log(`  ${'archetype'.padEnd(14)} ${'fired'.padStart(8)} ${'died w/o it'.padStart(12)} ${'of those, at the horn'.padStart(22)}`);
ranked.forEach(id => {
    const r = rows[id];
    console.log(`  ${id.padEnd(14)} ${pct(r.sigFired, r.entrants).padStart(8)} ${pct(r.sigNever, r.entrants).padStart(12)} `
        + `${pct(r.sigNeverHorn, Math.max(1, r.sigNever)).padStart(22)}`);
});

console.log('\ncompany: is there anybody in the zone to be social at?');
console.log(`  ${'archetype'.padEnd(14)} ${'avg others here'.padStart(16)} ${'cycles alone'.padStart(14)}`);
ranked.forEach(id => {
    const r = rows[id];
    console.log(`  ${id.padEnd(14)} ${(r.company / Math.max(1, r.companySamples)).toFixed(2).padStart(16)} `
        + `${pct(r.aloneSamples, r.companySamples).padStart(14)}`);
});

console.log('\nwhat kills them, for the focus archetypes:');
FOCUS.forEach(id => {
    const r = rows[id];
    if (!r) return;
    const deaths = Object.values(r.causes).reduce((a, b) => a + b, 0);
    const top = Object.entries(r.causes).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  ${id}: ${top.map(([c, n]) => `${c} ${pct(n, deaths)}`).join('  ')}  (n=${deaths})`);
});

console.log('\nfield average, for reference:');
const all = Object.values(rows).reduce((acc, r) => {
    acc.entrants += r.entrants; acc.days += r.days;
    acc.company += r.company; acc.companySamples += r.companySamples;
    acc.aloneSamples += r.aloneSamples; acc.sigFired += r.sigFired;
    return acc;
}, { entrants: 0, days: 0, company: 0, companySamples: 0, aloneSamples: 0, sigFired: 0 });
console.log(`  avg days ${(all.days / all.entrants).toFixed(2)}`
    + `   avg others in zone ${(all.company / all.companySamples).toFixed(2)}`
    + `   cycles alone ${pct(all.aloneSamples, all.companySamples)}`
    + `   signature fired ${pct(all.sigFired, all.entrants)}`);
