/**
 * AUDIT-14 §8 guard: the achievement fixes (H1-H4), the new a14-* entries and
 * the single-given-name additions.
 *
 *   npm run test:audit14-achievements
 *
 * The coverage sweep itself stays in `check-achievements` (slow); this is the
 * fast half: the facts about each fix that would silently regress.
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { ACHIEVEMENTS, META_ACHIEVEMENTS, evaluateMetaAchievements } from '../src/data/achievements';
import { DISTRICT_NAMES, NEUTRAL_NAMES } from '../src/data/names';
import { dailyCallStreakOf } from '../src/utils/panemStorage';
import { deathCodeOf } from '../src/engine/causes';

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const byId = (id: string) => ACHIEVEMENTS.find(a => a.id === id);

/* ---- H1 ------------------------------------------------------------------ */
{
    const a = byId('a12-fed-by-foes');
    check(!!a?.nearMiss, 'H1: a12-fed-by-foes has no nearMiss');
    check(!!a && /extort/i.test(a.hint), 'H1: a12-fed-by-foes hint does not say the victor extorted the food');
}

/* ---- H3 ------------------------------------------------------------------ */
for (const id of ['a13-mentor-lineage', 'a13-nemesis-avenged', 'a13-rival-final-two', 'a13-apprentice-wins', 'a13-reunion-final']) {
    check(byId(id)?.requiresCampaign === true, `H3: ${id} is ledger-only and not tagged requiresCampaign`);
}

/* ---- new entries --------------------------------------------------------- */
const RUN_IDS = [
    'a14-draft-podium', 'a14-draft-clean', 'a14-draft-bust', 'a14-pirate-feed-upset', 'a14-scar-returned',
    'a14-scar-avoided', 'a14-return-quell-rookie', 'a14-return-quell-repeat', 'a14-gift-last-alive',
    'a14-gift-wasted', 'a14-mentor-feud-final', 'a14-heirloom-home', 'a14-zone-burned-won', 'a14-flooded-hideout',
    'a14-haunted-kill', 'a14-finale-mutation-kill', 'a14-first-cannon-career', 'a14-odds-in-order',
    'a14-all-districts-final-eight', 'a14-bloodless-day-three', 'a14-slip-perfect-cause',
];
const META_IDS = [
    'a14-draft-five', 'a14-weekly-max', 'a14-museum-first', 'a14-mastery-sweep', 'a14-legacy-riser',
    'a14-legacy-fallen', 'a14-daily-called-three',
];
RUN_IDS.forEach(id => {
    const a = byId(id);
    check(!!a, `new achievement ${id} is missing`);
    check(!a || !!a.nearMiss, `${id} has no nearMiss`);
});
META_IDS.forEach(id => check(META_ACHIEVEMENTS.some(a => a.id === id), `new meta achievement ${id} is missing`));
{
    const ids = [...ACHIEVEMENTS, ...META_ACHIEVEMENTS].map(a => a.id);
    check(new Set(ids).size === ids.length, 'duplicate achievement id across the run and meta lists');
}
{
    const got = evaluateMetaAchievements({
        runs: 1, victors: 1, deaths: 0, crownedDistricts: [], arenasWon: [], quellsSeen: [],
        draftsPlayed: 5, weeklyMaxed: true, maxMuseumWing: 1, arenasMastered: 10,
        legacyRisen: true, legacyFallen: true, dailyCallStreak: 3,
    });
    META_IDS.forEach(id => check(got.includes(id), `${id} does not unlock on totals that satisfy it`));
    const none = evaluateMetaAchievements({ runs: 0, victors: 0, deaths: 0, crownedDistricts: [], arenasWon: [], quellsSeen: [] });
    META_IDS.forEach(id => check(!none.includes(id), `${id} unlocks on an empty record book`));
}
check(dailyCallStreakOf([
    { date: '2026-01-03', seed: 'a', pickRight: true },
    { date: '2026-01-02', seed: 'b', pickRight: true },
    { date: '2026-01-01', seed: 'c', pickRight: true },
]) === 3, 'dailyCallStreakOf: three consecutive right calls should read 3');
check(dailyCallStreakOf([
    { date: '2026-01-05', seed: 'a', pickRight: true },
    { date: '2026-01-02', seed: 'b', pickRight: true },
    { date: '2026-01-01', seed: 'c', pickRight: true },
]) === 2, 'dailyCallStreakOf: a gap in the dates must break the streak');

/* ---- behaviour over real runs -------------------------------------------- */
const RUNS = Number(process.env.AUDIT14_RUNS ?? 40);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
let firstBloodHits = 0;
for (let i = 0; i < RUNS; i++) {
    const seed = `A14ACH${i}`;
    const profile = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, arenaIds[i % arenaIds.length], profile);
    const config = configForProfile(DEFAULT_GAME_CONFIG, profile);
    const tributes = generateTributes(seed, config, arena.zones[0].name, profile.castShape, profile.quell);
    const sim = new Simulator({
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: profile, logCounter: 0, feastsHeld: 0, cycle: 0,
    } as GameState);
    let state = sim.getState();
    let guard = 3000;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') {
            state.draft = state.tributes.slice(0, 4).map(t => t.id);
            sim.startGames();
        } else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') state.phase = 'ended';
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    if (state.phase !== 'ended') continue;
    const v = state.tributes.find(t => t.status === 'alive');
    for (const a of ACHIEVEMENTS.filter(x => x.id.startsWith('a14-') || x.id === 'a13-volunteer-first-blood')) {
        let got = false;
        try { got = a.test(state, v); a.nearMiss?.(state, v); } catch (e) { problems.push(`${a.id} threw: ${(e as Error).message}`); }
        if (a.id === 'a13-volunteer-first-blood' && got) {
            firstBloodHits++;
            const fb = state.tributes.filter(t => t.status === 'dead' && deathCodeOf(t) === 'tribute')
                .sort((x, y) => (x.eliminationIndex ?? 0) - (y.eliminationIndex ?? 0))[0];
            check(!!fb && !fb.isCareer && fb.district >= 5 && fb.diedInBloodbath === true,
                `H2: ${seed} unlocked a13-volunteer-first-blood on a Career or inner-district victim`);
        }
        if (a.id === 'a14-draft-podium') check(got === (!!v && state.draft!.includes(v.id)), `${seed}: a14-draft-podium disagrees with the draft`);
    }
}
check(firstBloodHits < RUNS * 0.6, `H2: a13-volunteer-first-blood fired on ${firstBloodHits}/${RUNS} runs — still near-automatic`);

/* ---- names --------------------------------------------------------------- */
const ADDED: Record<string, string> = {
    '1M': 'Zafir Quentin Ysandre Ulisse Xavier Jaspar Onyxian Aurelio Filigran Moissan Sapphiro Tanzan Rubellan Ivoire Damascene Kunzo Ozmund Yves Lazulo Xavi Isandro Zenobio Topazio Lustran Siloam Brillo Tourmal',
    '2F': 'Ursula Ilona Onyxa Masonne Gravella Graniet Brecciana Tufa Cairna Dolmena Plinthe Scoria Zelda Ottavine Vigila Ramparta Glaciska Quarryn Ursa Zofia Olwen Isaura Cantera Chisella Travia',
    '5M': 'Zeppo Yuri Ozias Uziel Tesloy Ignaz Joulian Quade Oberon Ulysses Zorion Izaak Arcward',
    '5F': 'Quenby Yselda Iskra Wattsie Amperelle Joulie Yevna Galvina Ionella Luxie Zdena Ursule Ivette Zoya Oriette Dynamia Gridella Uma Zelma',
    '8M': 'Tatting Quilter Ikat Xeno Zarek Organzo Loomis Shuttleton Vicuna Pashmin Brocard Fustian Calicot Ignatz Izidor Tussore',
    '14F': 'Quiesca Yukiko Xiomara Salina Sleetie Rimeza Glacina Nevada Icelyn Sorbetta Frazil Ozerka Tundria Xarifa Yzolde Snezana Blizza Kristalla Yelena Olga Iglika Zima Quinta Oyuna Xylina Salinda Frostelle Glissade Kryo Hielita',
    '15M': 'Ulrik Zoltan Oskar Ugo Iolo Luxan Diopter Yorick Ilario Vasco Kaleido Ximeno Vitreo Lucernan Yitzak Ottokar Iwan Umbert Zbigniew Refractor Ulf Ingvar Xaver Loupe',
    '16F': 'Naphtha Kerosina Oriana Zaida Yael Ulrica Brinella Zosia Maristel Wellsa Sondra Ysabel Ivana Orsola Yvonne Derricka Pumpella Petrella Oceane',
    '12N': 'Kibble', '13N': 'Isotope', '14N': 'Iceberg', '15N': 'Vial Etching',
};
Object.entries(ADDED).forEach(([k, list]) => {
    const d = Number(k.slice(0, -1));
    const kind = k.slice(-1);
    const pool = kind === 'M' ? DISTRICT_NAMES[d].Male : kind === 'F' ? DISTRICT_NAMES[d].Female : NEUTRAL_NAMES[d] ?? [];
    list.split(' ').forEach(n => check(pool.includes(n), `names: ${n} missing from district ${d} ${kind}`));
});
// Single given names only: one token, no spaces, hyphens or apostrophes, anywhere.
const all = [...Object.values(DISTRICT_NAMES).flatMap(p => [...p.Male, ...p.Female]), ...Object.values(NEUTRAL_NAMES).flat()];
all.forEach(n => check(/^[\p{L}]+$/u.test(n), `names: ${JSON.stringify(n)} is not a single given name`));

if (problems.length > 0) {
    console.log(`AUDIT-14 achievements/names: ${problems.length} problem(s):`);
    problems.forEach(p => console.log(`  - ${p}`));
    process.exit(1);
}
console.log(`AUDIT-14 achievements/names: ok (${RUN_IDS.length} run + ${META_IDS.length} meta entries, ${RUNS} runs, `
    + `volunteer first blood ${firstBloodHits}/${RUNS}).`);
