import { generateTributes } from '../src/engine/generator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
const PAT: Record<string, RegExp> = {
  'lunch: bell': /The lunch bell goes|Lunch on the second day|The last lunch before the scores/,
  'lunch: sat together': /sits down opposite|moves their tray|saves .* a place|at the same end of the table|joins them\.$|head to head/,
  'lunch: alone': /eats alone|Nobody sits with|takes their tray to the window|does not eat at all/,
  'lunch: career table': /Career table|pack eats together|Careers rank the room/,
  'negative: snub': /does not answer, and does not look up|leaves it there|station is taken|says nothing at all, which is worse/,
  'negative: threat': /exactly where they intend to find them|a beat too long while looking|not to bother running|nothing personal is going to be involved/,
  'negative: mock': /does an impression of|what odds they would give|ever held one of those before|gives .* a nickname/,
  'negative: theft': /is gone before|find their kit moved|swaps a blunted blade|pockets the good rope/,
  'negative: exclusion': /close the circle|stops when .* is close enough|the group is full|leaves .* standing/,
  'negative: pact broken': /the arrangement is off|does not survive the|The pact is dead|gets a better offer/,
  'score: surprise': /expected a |spent three days being unremarkable|no footage worth showing/,
  'score: collapse': /Something went wrong in that room|puts a hand over their eyes|does not match a single thing/,
  'score: tie': /finish level at|A shared |are tied at/,
  'score: district pride': /has not had a score like|square is still full at midnight|cheering in District/,
  'score: career response': /has a short conversation about it|made the pack change a plan|where .* comes on the list/,
  'score: bookmakers': /odds board is rewritten|Capitol money comes off|close the market on/,
  'score: concealed': /showed the panel almost nothing|wanted a |not worth watching/,
};
const hits: Record<string, number> = {}; const runsWith: Record<string, number> = {};
let sameDistrictPacts = 0, crossPacts = 0;
const RUNS = 40;
for (let i = 0; i < RUNS; i++) {
    const seed = `l-${i}`; const arena = ARENAS[i % ARENAS.length];
    const gp = gamesProfileFor(seed); const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const sim = new Simulator({ seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape), phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0 });
    let s = sim.getState(); let g = 40;
    while (s.phase !== 'interviews' && g-- > 0) { if (!sim.advance()) break; s = sim.getState(); }
    for (const [k, re] of Object.entries(PAT)) {
        const n = s.log.filter(l => re.test(l.text)).length;
        hits[k] = (hits[k] ?? 0) + n; if (n > 0) runsWith[k] = (runsWith[k] ?? 0) + 1;
    }
    // Share of tributes who struck a pact with their own district partner,
    // and of those with any pact at all. Career-pack pacts are excluded: the
    // pack is a declared bloc, not a choice about districts.
    for (const t of s.tributes) {
        const partner = s.tributes.find(o => o.id !== t.id && o.district === t.district);
        const pacts = (t.trainingPact ?? []).map(id => s.tributes.find(x => x.id === id)).filter(Boolean) as typeof s.tributes;
        const nonCareer = pacts.filter(o => !(t.isCareer && o.isCareer));
        if (nonCareer.length === 0) continue;
        if (partner && nonCareer.some(o => o.id === partner.id)) sameDistrictPacts++; else crossPacts++;
    }
}
console.log('feature'.padEnd(26), 'per run'.padStart(8), 'runs'.padStart(7));
for (const [k, n] of Object.entries(hits)) console.log(k.padEnd(26), (n / RUNS).toFixed(2).padStart(8), `${Math.round(100*(runsWith[k]??0)/RUNS)}%`.padStart(7));
console.log(`\ntributes with a pact (careers' own pack excluded): ${sameDistrictPacts + crossPacts}; of those, ${sameDistrictPacts} include their own district partner (${(100*sameDistrictPacts/(sameDistrictPacts+crossPacts)).toFixed(1)}%)`);
