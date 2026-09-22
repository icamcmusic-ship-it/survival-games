/**
 * AUDIT-10: run locally what CI runs, so "I checked" means the same thing here
 * as it does there.
 *
 * Written after a batch went red on `test:achievements` — a check skipped
 * locally because it takes four minutes and nothing in the diff *looked* like
 * an achievement. That reasoning is exactly wrong for a check that measures the
 * consequences of behaviour across 500 runs: the changes least likely to look
 * relevant are the ones most likely to move it. Three of this session's four
 * reds came from a human deciding something did not need checking.
 *
 * So the decision is removed. The list is not maintained by hand either — it is
 * read out of `.github/workflows/ci.yml`, because a hand-kept copy of CI's list
 * is a thing that silently falls behind, which is the same failure one level up.
 *
 *   npm run gate              # everything CI runs, except the browser suite
 *   npm run gate -- --fast    # skip the two multi-minute sweeps
 *   npm run gate -- --ui      # include the browser suites (need `npm run dev`)
 *
 * `test:ui` is opt-in because it needs a dev server on port 3000; everything
 * else is self-contained.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const fast = args.has('--fast');
const withUi = args.has('--ui');

/** The slow ones, named so `--fast` is a decision rather than a guess. */
const SLOW = new Set(['test:metrics', 'test:achievements']);
/**
 * Needs a browser or a server, or builds output nothing else depends on.
 *
 * `test:textscale` drives Chromium the same way `test:ui` does — found by
 * running this, which is the point of running it.
 */
const BROWSER = ['test:ui', 'test:textscale'];
const SKIP = new Set(['dev', 'build', ...(withUi ? [] : BROWSER)]);

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const scripts = [...new Set([...workflow.matchAll(/npm run ([a-z:0-9-]+)/g)].map(m => m[1]))]
    .filter(s => !SKIP.has(s))
    .filter(s => !(fast && SLOW.has(s)));

if (scripts.length === 0) {
    console.error('Read no scripts out of .github/workflows/ci.yml — the gate is not checking anything.');
    process.exit(1);
}

console.log(`Running ${scripts.length} checks from ci.yml${fast ? ' (--fast: skipping the sweeps)' : ''}.\n`);
const failed = [];
const started = Date.now();

for (const script of scripts) {
    const at = Date.now();
    process.stdout.write(`  ${script.padEnd(26)}`);
    try {
        execSync(`npm run -s ${script}`, { stdio: 'pipe' });
        console.log(`ok    ${((Date.now() - at) / 1000).toFixed(0)}s`);
    } catch (e) {
        console.log(`FAIL  ${((Date.now() - at) / 1000).toFixed(0)}s`);
        failed.push({ script, output: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '') });
    }
}

console.log(`\n${scripts.length - failed.length}/${scripts.length} passed in ${((Date.now() - started) / 1000 / 60).toFixed(1)} minutes.`);
if (fast) console.log('--fast was used: test:metrics and test:achievements did NOT run. CI runs both.');
if (!withUi) console.log(`${BROWSER.join(' and ')} did not run; they need a browser and \`npm run dev\` serving. Pass --ui once it is.`);

if (failed.length > 0) {
    failed.forEach(({ script, output }) => {
        console.error(`\n--- ${script} ---`);
        // The tail is where these scripts put their verdict.
        console.error(output.trim().split('\n').slice(-25).join('\n'));
    });
    process.exit(1);
}
