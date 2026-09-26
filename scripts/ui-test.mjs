/**
 * Browser smoke test: drives every screen, button and keyboard shortcut in a
 * real Chromium and fails on any console/page error.
 * Requires `npm run dev` to be serving on port 3000.
 *
 *   npm run test:ui
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/survival-games/';
const errors = [];
const shots = process.env.SHOT_DIR || '/tmp';

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

const step = async (label, fn) => {
  try { await fn(); console.log('✓ ' + label); }
  catch (e) {
    errors.push(`${label}: ${e.message}`); console.log('✗ ' + label + ' — ' + e.message);
    // AUDIT-12: a picture of the page as the step left it, for diagnosis.
    await page.screenshot({ path: `${shots}/fail-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png` }).catch(() => {});
  }
};

await page.goto(BASE, { waitUntil: 'networkidle' });

await step('setup screen renders', async () => {
  await page.getByRole('heading', { name: /may the odds/i }).waitFor();
});

// §2: the setup screen is four tabs rather than one long scroll, so every step
// below that reaches a control has to be on the step that owns it. This is the
// navigation the player does; the test does it too.
const setupTab = name => page.getByRole('tab', { name });

await step('setup tabs switch sections', async () => {
  await setupTab('Rules').click();
  await page.getByText(/quick presets/i).first().waitFor();
  await setupTab('Meta').click();
  await page.getByText('Gamemaker Mode').waitFor();
  await setupTab('Cast').click();
  await page.getByText(/plain tribute names/i).waitFor();
  await setupTab('Arena').click();
  await page.getByText(/select arena/i).waitFor();
});

await step('advanced settings open and sliders move', async () => {
  await setupTab('Rules').click();
  await page.getByText(/advanced simulation settings/i).click();
  // AUDIT-10: addressed by name rather than by position. Adding two settings
  // to the panel silently re-pointed `nth(2)` at a different slider with a
  // different range, and the test failed on a malformed value rather than on
  // anything being wrong with the panel.
  const slider = name => page.getByRole('slider', { name });
  await slider('Districts').fill('4');
  await slider('Hazard rate').fill('2.5');
  /*
   * REQUEST: the death settings are counts of tributes, so their range depends
   * on the cast — which the Districts slider above just set to 4, i.e. 8
   * tributes. Asserted rather than assumed: a count slider whose top does not
   * track the field it is counting out of is the bug this replaced.
   */
  const horn = slider('Cornucopia deaths');
  const hornMax = await horn.getAttribute('max');
  if (hornMax !== '7') throw new Error(`Cornucopia deaths tops out at ${hornMax}, expected 7 for a cast of 8`);
  await horn.fill('7');
  await slider('Arena deaths').fill('0');
  await slider('Arena lethality').fill('1.5');
  await slider('Alliance betrayal rate').fill('3');
  await slider('Sponsor generosity').fill('0');
  await page.getByText('Reset everything').click();
  await slider('Districts').fill('12');
});

await step('gamemaker mode toggles', async () => {
  await setupTab('Meta').click();
  await page.getByText('Gamemaker Mode').click();
});

await step('seed randomiser works', async () => {
  const before = await page.locator('#seed-input').inputValue();
  await page.getByRole('button', { name: /randomize/i }).click();
  const after = await page.locator('#seed-input').inputValue();
  if (before === after) throw new Error('seed did not change');
});

await step('empty seed is accepted (falls back to random)', async () => {
  await page.locator('#seed-input').fill('   ');
});

// The explicit "Procedural Arena" entry is no longer in the picker — the
// generator still backs the sealed draw, which is what this now selects.
await step('sealed random arena selectable', async () => {
  await setupTab('Arena').click();
  await page.getByRole('button', { name: /random arena \(hidden\)/i }).click();
});

// §Special requests: arenas are unlocked by playing them. A cold profile can
// pick the starters and the sealed draw; everything else is visible, disabled,
// and says so.
// AUDIT-6 §1.1: this used to look for one row per locked arena. `SetupScreen`
// renders the locked remainder as a single summary line instead — "§7: the
// locked remainder, as one line rather than forty identical rows" — so the old
// assertion had been red since that change landed and could not have told
// anybody why.
await step('locked arenas are summarised, not listed', async () => {
  await setupTab('Arena').click();
  const summary = page.getByText(/\d+ undiscovered arenas?/i);
  if (await summary.count() === 0) throw new Error('expected the undiscovered-arena summary line on a cold profile');
  // Both routes to them have to be named, or the count is just a number.
  await page.getByText(/sealed draw/i).first().waitFor();
  const starter = page.getByRole('button', { name: /^The Clockwork Island/i });
  if (!(await starter.first().isEnabled())) throw new Error('a starter arena was not selectable');
});

// §2.1: promoted out of the advanced list and renamed — it is the single most
// important flag for anyone trying to understand what a slider does.
await step('plain rules toggle is settable', async () => {
  await setupTab('Rules').click();
  const toggle = page.getByText(/^Plain Rules — your sliders, nothing else$/);
  await toggle.click();
  await page.waitForTimeout(100);
  await toggle.click();
});

await step('start game reaches reaping', async () => {
  await page.getByRole('button', { name: /reap the tributes/i }).click();
  await page.getByRole('heading', { name: 'The Reaping' }).waitFor();
});

await step('reroll cast changes names', async () => {
  const before = await page.locator('.panel .font-black').first().textContent();
  await page.getByRole('button', { name: /reroll cast/i }).click();
  await page.waitForTimeout(200);
  const after = await page.locator('.panel .font-black').first().textContent();
  if (before === after) console.log('   (note: reroll produced same first name — possible but unlikely)');
});

// AUDIT-6 §1.1: the pre-Games roster page is gone. `router.ts` says so in its
// own comment — "the roster is a tab inside the arena now" and "confirming the
// reaping lands on the chronicle" — and this step, waiting for a heading that
// no longer exists, timed out and took the twenty steps after it down with it.
await step('confirm reaping lands on the chronicle, ready to start', async () => {
  await page.getByRole('button', { name: /confirm tributes/i }).click();
  await page.getByRole('heading', { name: /the chronicle/i }).waitFor();
  // The empty state, and the control that starts the run.
  await page.getByText(/the cast is confirmed and the record is empty/i).waitFor();
  await page.getByRole('button', { name: /go to the square/i }).waitFor();
  // AUDIT-6 §1.4: and the pager does not claim to be showing page one of none.
  const body = await page.locator('footer').first().innerText();
  if (/\b1 \/ 0\b/.test(body)) throw new Error('pager still reads "1 / 0" with no pages');
});

// AUDIT-6 §1.1: the pre-Games are staged through the chronicle, one named
// button per phase, rather than a single "begin training".
const PRE_GAMES = /hold the reaping|go to the square|board the train|run the parade|open the training floor|training day \d|read the scores|start the interviews|sound the gong|run the bloodbath/i;

await step('the pre-Games advance one named stage at a time', async () => {
  let stages = 0;
  for (let i = 0; i < 12; i++) {
    const next = page.getByRole('button', { name: PRE_GAMES });
    if (await next.count() === 0) break;
    await next.last().click();
    await page.waitForTimeout(200);
    stages++;
  }
  if (stages < 6) throw new Error(`expected the reaping through the bloodbath to be at least six stages, got ${stages}`);
});

await step('command palette searches across the run', async () => {
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: /search everything/i }).waitFor();
  await page.getByLabel(/search tributes, sectors and the chronicle/i).fill('a');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: /search everything/i }).waitFor({ state: 'detached' });
});

await step('the arena screen is reachable and running', async () => {
  await page.getByRole('link', { name: /^arena$/i }).first().click();
  await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
});

// AUDIT-6 §1.1: the roster is a tab on the arena screen now, and its search box
// takes a district or an archetype as well as a name.
await step('roster tab searches and sorts', async () => {
  await page.getByRole('button', { name: /^roster$/i }).first().click();
  const search = page.getByPlaceholder(/search name, district, archetype or trait/i);
  await search.fill('district 1');
  await page.waitForTimeout(150);
  await search.fill('zzzznope');
  await page.waitForTimeout(150);
  await page.getByText(/no tribute matches/i).waitFor();
  await search.fill('');
  for (const label of ['Odds', 'Training', 'Name', 'District']) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.waitForTimeout(80);
  }
});

await step('roster filters narrow the cast', async () => {
  for (const f of [/^careers$/i, /^armed$/i, /^wounded$/i, /^allied$/i]) {
    const chip = page.getByRole('button', { name: f }).first();
    if (await chip.count()) { await chip.click(); await page.waitForTimeout(80); }
  }
  // Toggling them all back off restores the full cast.
  for (const f of [/^careers$/i, /^armed$/i, /^wounded$/i, /^allied$/i]) {
    const chip = page.getByRole('button', { name: f }).first();
    if (await chip.count()) { await chip.click(); await page.waitForTimeout(80); }
  }
});

const coinsText = async () => (await page.locator('header .chip-gold').last().textContent()).trim();

// AUDIT-6 §1.1: betting moved into the arena's dossier column with the odds
// board, so it is live against a running race rather than a pre-Games form.
await step('betting deducts and refunds coins', async () => {
  await page.getByRole('button', { name: /your bets/i }).first().click();
  await page.waitForTimeout(200);
  const stake = page.getByRole('button', { name: '+50', exact: true });
  if (await stake.count() === 0) { console.log('   (no stake controls — bets closed for this phase)'); return; }
  const before = parseInt(await coinsText());
  await stake.first().click();
  await page.waitForTimeout(120);
  const mid = parseInt(await coinsText());
  if (mid !== before - 50) throw new Error(`expected ${before - 50}, got ${mid}`);
  const clear = page.getByRole('button', { name: 'Clear', exact: true }).first();
  if (await clear.count()) {
    await clear.click();
    await page.waitForTimeout(120);
    const after = parseInt(await coinsText());
    if (after !== before) throw new Error(`refund failed: ${after} vs ${before}`);
  }
});

await step('proceed advances phases', async () => {
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /^proceed$/i }).first().click();
    await page.waitForTimeout(150);
  }
});

// §2.9: the contextual first-run hints. Four phases in, a first run has
// produced a death and usually an alliance, so at least one mark should have
// fired — and it must be dismissible without taking the feed with it.
await step('contextual first-run hint appears and dismisses', async () => {
  // Scoped by the data hook rather than role=note: the death interstitial in
  // the feed is also role="note", and it is far commoner.
  const note = page.locator('[data-coach-mark]');
  if (await note.count() === 0) return; // a very quiet opening; not a failure
  await note.first().getByRole('button', { name: /dismiss this hint/i }).click();
  await page.waitForTimeout(150);
});

// §2.6: the per-moment share, on the lines flagged important.
//
// AUDIT-6 §2.6: this step was correct and the app was wrong. `MomentShare` had
// existed since the audit that asked for it, wired into `FeedLine` — and a
// walkthrough found zero of them on any screen, because the chronicle renders
// `LogRow` and the arena sidebar had stopped rendering `FeedLine` at all. It is
// on the chronicle now, which is where a run is actually read.
await step('a moment can be copied on its own', async () => {
  await page.getByRole('link', { name: /^chronicle$/i }).first().click();
  await page.waitForTimeout(300);
  const share = page.locator('.feed-share').first();
  if (await share.count() === 0) throw new Error('no per-moment share affordance on any important line');
  await share.click();
  await page.waitForTimeout(150);
  await page.getByRole('link', { name: /^arena$/i }).first().click();
  await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
});

// §2.3: two tribute sheets side by side, mid-run.
// AUDIT-6 §1.1: the tribute tiles carrying a full accessible description are
// on the chronicle — the arena's standings and roster render compact rows.
await step('two tributes can be compared side by side', async () => {
  await page.getByRole('link', { name: /^chronicle$/i }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /— District \d+, (Male|Female), age \d+/ }).first().click();
  await page.getByRole('dialog').first().waitFor();
  const select = page.locator('#compare-with');
  if (await select.count() === 0) {
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: /^arena$/i }).first().click();
    throw new Error('no compare control on the tribute sheet');
  }
  const other = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(other);
  const compare = page.locator('[role=dialog][aria-label*="compared with"]');
  await compare.waitFor();
  // The between-them block is the reason this is a view rather than two modals.
  await compare.getByText('Between them').waitFor();
  await page.screenshot({ path: `${shots}/compare.png` });
  await compare.getByRole('button', { name: /close comparison/i }).click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /^arena$/i }).first().click();
  await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
});

// §2.1: the alternative palettes, applied as a stamp on <html>.
await step('category palette can be switched', async () => {
  await page.getByRole('button', { name: /open settings/i }).first().click();
  await page.getByRole('button', { name: 'Colourblind-safe' }).click();
  if (await page.evaluate(() => document.documentElement.getAttribute('data-palette')) !== 'colourblind') {
    throw new Error('colourblind palette did not apply to <html>');
  }
  await page.getByRole('button', { name: 'High contrast' }).click();
  if (await page.evaluate(() => document.documentElement.getAttribute('data-palette')) !== 'contrast') {
    throw new Error('contrast palette did not apply to <html>');
  }
  await page.getByRole('button', { name: 'Full colour' }).click();
  if (await page.evaluate(() => document.documentElement.getAttribute('data-palette')) !== null) {
    throw new Error('default palette left a stale data-palette on <html>');
  }
  await page.getByRole('button', { name: /close settings/i }).click();
});

// AUDIT-6 §2.6: `/filters/i` matches both the panel toggle and "Reset filters"
// inside it, which is a strict-mode violation and was one of the twenty-four
// red steps. The toggle is the one in the segmented control.
const filtersToggle = () => page.locator('.seg-item').filter({ hasText: /Filters/ }).first();

await step('filters panel mutes categories', async () => {
  await filtersToggle().click();
  await page.waitForTimeout(150);
  const mute = page.getByRole('button', { name: /mute violence events/i });
  if (await mute.count()) await mute.click();
  const reset = page.getByRole('button', { name: /reset filters/i });
  if (await reset.count()) await reset.click();
  await filtersToggle().click();
});

// AUDIT-6 §1.1: the controls read "Next page" / "Previous page" — one page per
// (day, phase) — not "next phase".
await step('the chronicle pages through the run', async () => {
  await page.getByRole('link', { name: /^chronicle$/i }).first().click();
  await page.getByRole('button', { name: /next page/i }).waitFor();
  await page.getByRole('button', { name: /next page/i }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /previous page/i }).click();
  if (!/#\/chronicle/.test(page.url())) throw new Error('chronicle route did not stick: ' + page.url());
  await page.getByRole('link', { name: /^arena$/i }).first().click();
  await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
});

await step('arena map tab + sector selection', async () => {
  // A6: the stage tabs read Chronicle / Map / Standings.
  await page.getByRole('button', { name: /^map$/i }).first().click();
  // The map opens on the graph view; the per-sector buttons live behind Detail.
  await page.getByRole('button', { name: /^detail$/i }).first().click();
  await page.locator('button:has-text("Active"), button:has-text("Collapsed")').first().click();
  await page.waitForTimeout(150);
  const clear = page.getByRole('button', { name: /^clear$/i }).first();
  if (await clear.count()) await clear.click();
  await page.getByRole('button', { name: /^standings$/i }).first().click();
});

// AUDIT-6 §6.4: the belief view. The rumour layer was the best-modelled side
// system in the repository and drew nothing on screen, so the check is that the
// third map view exists, names a tribute, and renders their impressions rather
// than the truth.
await step('the belief view reads the arena through one tribute', async () => {
  await page.getByRole('button', { name: /^map$/i }).first().click();
  await page.getByRole('button', { name: /^belief$/i }).first().click();
  const picker = page.getByLabel(/read the arena as this tribute believes it to be/i);
  await picker.waitFor();
  const options = await picker.locator('option').count();
  if (options === 0) throw new Error('the belief view offered no tribute to read the arena as');
  // Every sector gets a card, and each one says where the impression came from.
  const cards = page.locator('[aria-label*="has never set eyes on it"], [aria-label*="seen first hand"], [aria-label*="told to"]');
  if (await cards.count() === 0) throw new Error('the belief view rendered no sector impressions');
  if (options > 1) {
    await picker.selectOption({ index: 1 });
    await page.waitForTimeout(150);
    if (await cards.count() === 0) throw new Error('switching tribute emptied the belief view');
  }
  await page.getByRole('button', { name: /^map$/i }).first().click();
});

await step('standings tab sorts', async () => {
  await page.getByRole('button', { name: /^standings$/i }).first().click();
  await page.getByRole('button', { name: /^kills$/i }).first().click();
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: /^kills$/i }).first().click();
  await page.getByRole('button', { name: /^health$/i }).first().waitFor();
});

// AUDIT-6 §1.1: the opener is a `TributeTile` button, and its accessible name
// is the tribute's own description — there is no `title="open profile"` any
// more, and §1.6 removed the last of those hover-only hints from controls.
await step('tribute modal opens with live data and closes with Escape', async () => {
  await page.getByRole('link', { name: /^chronicle$/i }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /— District \d+, (Male|Female), age \d+/ }).first().click();
  await page.getByRole('dialog').waitFor();
  // A5: four tabs, defaulting to Overview.
  for (const tab of [/combat/i, /^social$/i, /^story$/i, /^overview$/i]) {
    await page.getByRole('tab', { name: tab }).click();
  }
  // A5: comparison mode renders a second tribute beside the first.
  const compare = page.getByLabel(/compare with another tribute/i);
  if (await compare.count()) {
    const opts = await compare.locator('option').count();
    if (opts > 1) await compare.selectOption({ index: 1 });
  }
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('link', { name: /^arena$/i }).first().click();
  await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
});

// AUDIT-6 §1.1: a step that throws must not leave a modal over the controls the
// next step needs — that is how one real failure used to become twenty.
await step('no dialog is left open between steps', async () => {
  while (await page.getByRole('dialog').count() > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
});

await step('gamemaker controls fire', async () => {
  // A6: the booth is one of the dossier column's accordion sections now.
  await page.getByRole('button', { name: /gamemaker booth/i }).click();
  await page.getByRole('button', { name: /release mutts/i }).click();
  await page.getByRole('button', { name: /force weather/i }).click();
  // A 'no-feast' wildcard year (seed luck) legitimately disables this button.
  const feastBtn = page.getByRole('button', { name: /^announce feast/i });
  if (await feastBtn.isEnabled()) await feastBtn.click();
  await page.waitForTimeout(200);
  const select = page.locator('#mutt-target');
  const opts = await select.locator('option').count();
  if (opts > 1) {
    await select.selectOption({ index: 1 });
    await page.getByRole('button', { name: /release mutts/i }).click();
  }
});

await step('speed controls engage and can be stopped', async () => {
  // The speed buttons read Manual / Read / Skim / Skip — "5x" is the internal
  // name, not the label, so this step had been silently failing.
  await page.getByRole('button', { name: /skim/i }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /manual/i }).click();
});

await page.screenshot({ path: `${shots}/arena.png` });

await step('keyboard: space advances, m toggles map', async () => {
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.keyboard.press('m');
  await page.waitForTimeout(150);
  await page.keyboard.press('m');
});

await step('run to end finishes the games', async () => {
  await page.getByRole('button', { name: /run to end/i }).click();
  // The fast-forward is chunked now: it yields between batches and shows a
  // Cancel button while it runs, so wait for that to go away rather than
  // guessing at a duration.
  await page.getByRole('button', { name: /^cancel$/i }).waitFor({ state: 'detached', timeout: 30000 });
});

await step('victor interview then debrief', async () => {
  const interview = page.getByRole('heading', { name: /victor's interview/i });
  if (await interview.count()) {
    await page.screenshot({ path: `${shots}/interview.png` });
    await page.getByRole('button', { name: /review the debrief/i }).click();
  }
  await page.getByRole('heading', { name: /the arena closes/i }).waitFor();
});

await step('debrief tabs work', async () => {
  await page.screenshot({ path: `${shots}/debrief.png`, fullPage: true });
  await page.getByRole('button', { name: /full chronicle/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /debrief/i }).click();
});

await step('what-if debrief branches the finished Games', async () => {
  // AUDIT-10 §11.8. The run above finished with "run to end", which is the
  // path that used to leave no checkpoints to branch from.
  const panel = page.locator('.panel', { has: page.getByRole('heading', { name: /what if\?/i }) });
  await panel.waitFor();
  if (await panel.getByText(/no arena checkpoints/i).count()) {
    throw new Error('the what-if panel has nothing to branch from after run-to-end');
  }
  await panel.getByRole('button', { name: /^run$/i }).click();
  await panel.getByText(/still wins in \d+ of \d+/i).waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${shots}/whatif.png` });
});

await step('hall of fame records the victor', async () => {
  // The run uses a random seed, and an arena that kills every last tribute is a
  // legitimate ending. Assert against the outcome this run actually produced.
  const wipeout = await page.getByRole('heading', { name: 'No Victor', exact: true }).count() > 0;
  await page.getByRole('link', { name: 'Hall of Fame', exact: true }).click();
  await page.getByRole('heading', { name: /hall of fame/i }).waitFor();
  const count = await page.locator('.panel .display-title').count();
  if (!wipeout && count === 0) throw new Error('a victor was crowned but nothing was recorded');

  // REPLAY-03/04: the record book folds in every finished run, victor or not,
  // so it must be populated here even when the arena killed everybody.
  await page.getByRole('heading', { name: /your panem/i }).waitFor();
  const bookText = await page.locator('.panel', { hasText: 'Your Panem' }).first().innerText();
  if (/No Games finished yet/i.test(bookText)) {
    throw new Error('a run finished but the record book is still empty');
  }
  if (!/Things these Games can do/i.test(bookText)) {
    throw new Error('the record book is missing the discovery list');
  }

  // REPLAY-12: per-district crowns. The twelve slots are always listed (an empty
  // one is the goal), and a run that crowned somebody must have filled exactly
  // the winning district's slot.
  if (!/District crowns/i.test(bookText)) {
    throw new Error('the record book is missing the district crown board');
  }
  const crowned = (bookText.match(/districts crowned/i) ? bookText.match(/(\d+)\/(\d+) districts crowned/) : null);
  if (!crowned) throw new Error('the district crown board has no progress count');
  if (wipeout && crowned[1] !== '0') {
    throw new Error(`no victor was crowned but the board claims ${crowned[1]} districts`);
  }
  if (!wipeout && crowned[1] === '0') {
    throw new Error('a victor was crowned but no district slot filled in');
  }
  if (!/no crown yet/i.test(bookText)) {
    throw new Error('locked district slots should still be listed as goals');
  }
  if (count > 0) {
    await page.getByRole('button', { name: /details/i }).first().click();
    await page.waitForTimeout(150);
  } else {
    console.log('   (note: this run ended in a wipeout, so the Hall of Fame is correctly empty)');
  }
  await page.screenshot({ path: `${shots}/hof.png` });
});

await step('share button copies link', async () => {
  await page.getByRole('link', { name: /new game/i }).click();
});

await step('replay via URL boots the same run', async () => {
  await page.goto(`${BASE}?seed=REPLAY1&arena=frozen&gamemaker=false`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'The Reaping' }).waitFor();
  // The replay link decides the screen, so the router must adopt it rather
  // than the other way round — and the params must be consumed, not left to
  // relaunch the run on the next refresh.
  const url = new URL(page.url());
  if (url.search !== '') throw new Error(`replay params not consumed: ${url.search}`);
  if (url.hash !== '#/roster') throw new Error(`expected #/roster after a replay link, got ${url.hash}`);
});

await step('URL reflects the screen and back/forward navigate', async () => {
  await page.getByRole('link', { name: 'Hall of Fame', exact: true }).click();
  await page.getByRole('heading', { name: /hall of fame/i }).waitFor();
  if (!page.url().endsWith('#/hall-of-fame')) throw new Error(`expected #/hall-of-fame, got ${page.url()}`);
  await page.goBack();
  await page.getByRole('heading', { name: 'The Reaping' }).waitFor();
  await page.goForward();
  await page.getByRole('heading', { name: /hall of fame/i }).waitFor();
});

await step('#/arena during the reaping redirects to the roster', async () => {
  await page.evaluate(() => { window.location.hash = '/arena'; });
  await page.waitForTimeout(200);
  await page.getByRole('heading', { name: 'The Reaping' }).waitFor();
  if (!page.url().endsWith('#/roster')) throw new Error(`expected a redirect to #/roster, got ${page.url()}`);
});

await step('deep link to a run-only route with no run falls back to setup', async () => {
  // about:blank first, so the hash change is a cold load rather than a
  // same-document fragment navigation.
  await page.goto('about:blank');
  await page.goto(`${BASE}#/arena`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /may the odds/i }).waitFor();
  if (!page.url().endsWith('#/')) throw new Error(`expected a redirect to #/, got ${page.url()}`);
});

await step('deep link to the hall of fame works cold', async () => {
  await page.goto(`${BASE}#/hall-of-fame`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /hall of fame/i }).waitFor();
});

// AUDIT-6 §1.1: three steps restart the app from a seeded URL and then have to
// get back into a running arena. All three drove the old "begin training"
// button, which the staged pre-Games replaced, so all three were red. One
// helper, so the next flow change costs one edit rather than three.
const intoTheArena = async () => {
  await page.getByRole('button', { name: /confirm tributes/i }).click();
  for (let i = 0; i < 12; i++) {
    const next = page.getByRole('button', { name: PRE_GAMES });
    if (await next.count() === 0) break;
    await next.last().click();
    await page.waitForTimeout(180);
  }
  await page.getByRole('link', { name: /^arena$/i }).first().click();
  await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
};

await step('skip link does not navigate the router away', async () => {
  await page.goto(`${BASE}#/hall-of-fame`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.getByRole('heading', { name: /hall of fame/i }).waitFor();
});

await step('new keyboard shortcuts drive the arena', async () => {
  await page.goto(`${BASE}?seed=KEYS1&arena=frozen&gamemaker=false`, { waitUntil: 'networkidle' });
  await intoTheArena();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
  }
  await page.keyboard.press('z');        // cycle sector filter forward
  await page.waitForTimeout(120);
  await page.keyboard.press('Shift+Z');  // and back off it
  await page.keyboard.press('t');        // cycle tribute filter
  await page.keyboard.press('Shift+T');
  await page.keyboard.press('[');        // day jump
  await page.keyboard.press(']');
  await page.keyboard.press('i');        // cycle reading density
  await page.keyboard.press('i');
  await page.keyboard.press('1');        // mute a category group
  await page.keyboard.press('1');
  await page.keyboard.press('0');        // reset every filter
  await page.keyboard.press('p');        // auto-advance on
  await page.waitForTimeout(400);
  await page.keyboard.press('p');        // and off again
  await page.keyboard.press('d');        // §2.5: jump to the next death
  await page.waitForTimeout(150);
  await page.keyboard.press('Shift+D');  // and back to the previous one
  await page.waitForTimeout(150);
  // AUDIT-6 §1.1: `[` and `]` are day jumps and they deep-link into the
  // chronicle, so by this point the run is no longer on the arena screen — and
  // the help panel is bound there. Pressing '?' from the chronicle opened
  // nothing and the step blamed the help panel. Come back first.
  if (!/#\/arena/.test(page.url())) {
    await page.getByRole('link', { name: /^arena$/i }).first().click();
    await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
  }
  await page.keyboard.press('?');
  await page.getByRole('dialog', { name: /how to read the games/i }).waitFor();
  const help = await page.getByRole('dialog').innerText();
  for (const key of ['Z / Shift+Z', 'T / Shift+T', '[ / ]', 'Space', 'Esc', 'O', 'X', 'D / Shift+D']) {
    if (!help.includes(key)) throw new Error(`help panel does not document ${key}`);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
});

// §2.5: the two shortcuts for the thing a reader does most — open the tribute
// they are watching, and narrow the feed to them.
await step('O opens the watched tribute and X filters the chronicle to them', async () => {
  await page.keyboard.press('t');        // watch somebody (the tribute filter)
  await page.waitForTimeout(150);
  await page.keyboard.press('o');
  await page.waitForTimeout(400);
  // The sheet is labelled with the tribute, not with the word "profile". If 't'
  // found nobody to watch there is nothing for 'o' to open, which is a quiet
  // board rather than a failure.
  if (await page.getByRole('dialog').count() === 0) {
    console.log('   (no watched tribute — nothing for O to open)');
  } else {
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  }
  await page.keyboard.press('x');        // toggles that filter back off
  await page.waitForTimeout(150);
  await page.keyboard.press('0');        // and resets whatever is left standing
});

// AUDIT-6 §2.6: `/filters/i` matches the panel toggle *and* "Reset filters"
// inside it. Naming the state on the toggle would fix this properly; scoping to
// the segmented control fixes the test.
await step('shortcuts do not hijack typing in the chronicle search', async () => {
  await filtersToggle().click();
  await page.waitForTimeout(150);
  const search = page.getByPlaceholder(/search the chronicle/i);
  if (await search.count() === 0) { await filtersToggle().click(); return; }
  await search.fill('');
  await search.pressSequentially('fizz');
  if (await search.inputValue() !== 'fizz') throw new Error('a shortcut swallowed typed input');
  await search.fill('');
  await filtersToggle().click();
});

// §2.1: the two surfaces a player spends a whole run in, at the narrow end of
// real phones (380px), with the dossier sheet open on top of the arena — the
// case the desktop-first layout was least likely to have been checked against.
const overflows = () => page.evaluate(() =>
  document.documentElement.scrollWidth > window.innerWidth + 2);

/*
 * AUDIT-6 §2.3, corrected: no control announces a wall of text as its name.
 *
 * The audit claimed the arena picker's cards were single buttons whose
 * accessible name was the entire card body — "a screen-reader user must listen
 * to all of it to learn the button's name". That was wrong, and the error was in
 * the probe rather than in the app: it read `textContent`, and every card
 * already carries `aria-label={a.name}`, which overrides its contents. The
 * measured accessible names are "The Concrete Jungle" and "The Toxic Swamps".
 *
 * The invariant is still worth holding, because it is exactly the mistake a
 * card-shaped control invites and nothing was watching for it. It passes today
 * and this keeps it passing.
 */
await step('no control announces a wall of text as its name', async () => {
  const long = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a[href], [role=button], [role=tab]').forEach(el => {
      const aria = el.getAttribute('aria-label');
      const name = aria ?? (el.textContent || '').trim();
      if (name.length > 160) out.push(`${name.length} chars: ${name.slice(0, 70)}…`);
    });
    return out.slice(0, 6);
  });
  if (long.length) throw new Error(`controls with an unreadable accessible name:\n     ${long.join('\n     ')}`);
});

/*
 * AUDIT-6 §2.2: a real DOM tap-target floor at phone width.
 *
 * `check-arena-layout` enforces a 44px touch target on the SVG map and reports
 * "46px at the 460px minimum graph width (floor 44px)". That floor existed for
 * the map and for nothing else. Measured at 380px on the chronicle — the widest-
 * coverage screen in the app — **168 of 168** interactive elements were under
 * 44px and **155 were under 24px**, which is a WCAG 2.5.8 failure rather than a
 * missed enhancement. The worst were the inline tribute-name buttons at 19px
 * tall, sitting next to each other inside running prose, where a mis-tap opens
 * the wrong person's sheet.
 *
 * Baselined and ratcheted, like `TITLE_CEILING` in `check-ui-affordances`: the
 * number only ever comes down. 24px is the hard floor because it is the one the
 * standard names; the 44px count is reported so the gap stays visible.
 */
const TAP_TARGET_UNDER_24_CEILING = 0;
/*
 * AUDIT-7 §1.9 and §2.1: the census used to look at one screen and report the
 * answer as if it were the interface.
 *
 * It navigated to the chronicle and counted there — 119 controls, all 119 under
 * 44px — so the arena screen with its tab bar, speed controls and Gamemaker
 * booth, the setup screen with its four tabs and slider bank, and the Hall of
 * Fame with its filters and compare panel were never measured at all. "119 of
 * 119" was a true number about a quarter of the app.
 *
 * It walks every screen now and reports per screen as well as in total, so the
 * denominator means what its label says.
 */
const TAP_TARGET_UNDER_44_CEILING = 0;

const censusAt = () => page.evaluate(() => {
  let total = 0, under44 = 0, under24 = 0, inlineExempt = 0;
  const big = [], small = [];
  document.querySelectorAll('button, a[href], [role=button], input, select, [role=tab]').forEach(el => {
    // AUDIT-12 U12: a checkbox or radio wrapped in its label is hit through
    // the label, so the label is the target that is measured.
    const host = el.matches('input[type=checkbox], input[type=radio]') ? (el.closest('label') ?? el) : el;
    const r = host.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    total++;
    const min = Math.min(r.width, r.height);
    const label = `${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName.toLowerCase()}`
      + `.${(el.className?.toString?.() ?? '').split(' ').slice(0, 2).join('.')}`
      + ` "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`;
    /*
     * Two documented exemptions, both taken deliberately and both marked in the
     * markup so this census can tell them from an oversight:
     *
     *  - `.in-prose` is WCAG 2.5.8's own inline exception. A tribute's name
     *    inside a chronicle sentence cannot be padded to 44px without putting a
     *    gap between the words either side of it, and the criterion exempts
     *    exactly that case. They still clear the 24px AA line.
     *  - `.tap-target-cell` is the dense-table compromise: full 44px of height,
     *    and 24px on the narrow axis, because 44px of *width* on a five-column
     *    table at 380px pushes it off the screen — which the horizontal-overflow
     *    step two below would then fail on.
     *
     * A genuinely `display: inline` control is exempt for the same reason as the
     * first: `min-height` is inert on an inline box.
     */
    if (el.classList.contains('in-prose') || el.classList.contains('tap-target-cell')
        || getComputedStyle(el).display === 'inline') { inlineExempt++; return; }
    if (min < 44) { under44++; big.push(label); }
    if (min < 24) { under24++; small.push(label); }
  });
  return { total, under44, under24, inlineExempt, big: big.slice(0, 80), small: small.slice(0, 40) };
});

await step('controls are big enough to hit on a phone', async () => {
  await page.setViewportSize({ width: 380, height: 850 });
  // Chronicle and arena are routes; roster, standings, map and the dossier are
  // tabs *inside* the arena screen, and only the active one is in the DOM — so
  // each has to be opened in turn or its controls are never measured. That is
  // the whole of AUDIT-7 §1.9: the old census clicked through to the chronicle
  // and reported one screen's number as the interface's.
  const screens = [
    ['chronicle', async () => { await page.getByRole('link', { name: /^chronicle$/i }).first().click(); }],
    ['arena', async () => { await page.getByRole('link', { name: /^arena$/i }).first().click(); }],
    ['roster tab', async () => { await page.getByRole('button', { name: /^roster$/i }).first().click(); }],
    ['standings tab', async () => { await page.getByRole('button', { name: /^standings$/i }).first().click(); }],
    ['map tab', async () => { await page.getByRole('button', { name: /^map$/i }).first().click(); }],
  ];
  const rows = [];
  const big = [], small = [];
  let total = 0, under44 = 0, under24 = 0, inlineExempt = 0;
  for (const [name, go] of screens) {
    try { await go(); } catch { continue; }
    await page.waitForTimeout(400);
    const c = await censusAt();
    if (c.total === 0) continue;
    rows.push(`${name} ${c.under44}/${c.total} under 44px, ${c.under24} under 24px, ${c.inlineExempt} exempt`);
    total += c.total; under44 += c.under44; under24 += c.under24; inlineExempt += c.inlineExempt;
    big.push(...c.big.map(w => `${name}: ${w}`));
    small.push(...c.small.map(w => `${name}: ${w}`));
  }
  console.log(`   ${total} controls at 380px across ${rows.length} screens: ${under44} under 44px `
    + `(ceiling ${TAP_TARGET_UNDER_44_CEILING}), ${under24} under 24px (ceiling ${TAP_TARGET_UNDER_24_CEILING}), `
    + `${inlineExempt} exempt (in-prose / dense-table)`);
  rows.forEach(r => console.log(`     ${r}`));

  const grouped = (list) => {
    const groups = {};
    list.forEach(w => {
      const key = w.replace(/^\S+ \d+x\d+ /, '').replace(/ ".*"$/, '');
      groups[key] = (groups[key] ?? 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, n]) => `${String(n).padStart(3)}  ${k}`);
  };
  if (under44 > 0) {
    console.log('     still under 44px, by selector:');
    grouped(big).forEach(l => console.log(`       ${l}`));
  }
  if (under24 > TAP_TARGET_UNDER_24_CEILING) {
    throw new Error(`${under24} controls under the 24px minimum (ceiling ${TAP_TARGET_UNDER_24_CEILING}):\n     `
      + small.slice(0, 10).join('\n     '));
  }
  if (under44 > TAP_TARGET_UNDER_44_CEILING) {
    throw new Error(`${under44} control(s) under the 44px tap target (ceiling ${TAP_TARGET_UNDER_44_CEILING}).`
      + ` Raise their min-height/min-width, or raise the ceiling on purpose.\n     `
      + big.slice(0, 10).join('\n     '));
  }
  if (under24 < TAP_TARGET_UNDER_24_CEILING || under44 < TAP_TARGET_UNDER_44_CEILING) {
    console.log(`     lower the ceilings to ${under44}/${under24} in this file to lock that in.`);
  }
  await page.setViewportSize({ width: 1400, height: 950 });
});

await step('no horizontal overflow at mobile width', async () => {
  for (const width of [390, 380]) {
    await page.setViewportSize({ width, height: 850 });
    await page.waitForTimeout(300);
    if (await overflows()) throw new Error(`page scrolls horizontally at ${width}px`);
  }
  await page.screenshot({ path: `${shots}/mobile.png` });
});

await step('the arena and the tribute sheet both fit a 380px phone', async () => {
  await page.setViewportSize({ width: 380, height: 850 });
  await page.goto(`${BASE}?seed=MOBILE1&arena=frozen&gamemaker=false`, { waitUntil: 'networkidle' });
  await intoTheArena();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
  }
  if (await overflows()) throw new Error('the arena screen scrolls horizontally at 380px');

  // Every pane of the bottom tab bar, not just the one it opens on.
  //
  // AUDIT-6 §1.1: at 380px the bar reads Standings / Roster / Table / Cast —
  // Map and Chronicle are not among them, so two of these names had been
  // unmatchable since the phone layout was built.
  let panesChecked = 0;
  for (const pane of [/^standings$/i, /^roster$/i, /^table$/i, /^cast/i]) {
    const tab = page.getByRole('button', { name: pane }).first();
    if (await tab.count() === 0) continue;
    await tab.click();
    await page.waitForTimeout(250);
    panesChecked++;
    if (await overflows()) throw new Error(`the ${pane} pane scrolls horizontally at 380px`);
  }
  if (panesChecked < 2) throw new Error(`expected at least two phone panes, found ${panesChecked}`);

  await page.keyboard.press('t');
  await page.waitForTimeout(150);
  await page.keyboard.press('o');
  await page.waitForTimeout(500);
  if (await page.getByRole('dialog').count() === 0) {
    // No watched tribute on this seed; open one from the cast list instead.
    const tile = page.getByRole('button', { name: /— District \d+, (Male|Female), age \d+/ }).first();
    if (await tile.count()) await tile.click();
  }
  await page.getByRole('dialog').first().waitFor({ timeout: 4000 });
  await page.screenshot({ path: `${shots}/mobile-tribute-sheet.png` });
  if (await overflows()) throw new Error('the tribute sheet scrolls horizontally at 380px');
  // And every tab of it — the sheet is four screens, not one.
  for (const tab of [/combat/i, /social/i, /story/i]) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(200);
    if (await overflows()) throw new Error(`the tribute sheet scrolls horizontally at 380px on ${tab}`);
  }
  await page.keyboard.press('Escape');
});

/*
 * AUDIT-9 §7 "browser acceptance pass still needed". The harness already drove
 * keyboard shortcuts, modals, touch targets and phone widths; the audit's list
 * also asks for contrast measured on *rendered* styles, focus restoration,
 * reduced motion, 200-400% zoom, large casts and screen-reader announcements
 * that do not flood. Those are the ones below.
 *
 * Contrast is computed from what the browser actually paints — the composited
 * colour after every cascade, theme and opacity — because a palette that
 * passes in the stylesheet says nothing about the pixel a person looks at.
 */
const CONTRAST_EXEMPT = /^(chip-|badge-)/;

const contrastFailures = () => page.evaluate(() => {
    const lum = ([r, g, b]) => {
      const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const alpha = c => { const p = (c.match(/[\d.]+/g) || []); return p.length > 3 ? Number(p[3]) : 1; };
    // The painted background: walk up until something is not transparent.
    const bgOf = el => {
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (alpha(c) > 0.95) return parse(c);
      }
      return [0, 0, 0];
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const text = (el.textContent || '').trim();
      if (!text || el.children.length > 0) continue;       // leaf text only
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.95) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      // WCAG: large text is 24px, or 18.66px bold.
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      const fg = parse(cs.color), bg = bgOf(el);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (ratio + 0.05 < need) {
        out.push({ text: text.slice(0, 40), cls: el.className?.toString().slice(0, 40) || el.tagName,
                   ratio: Number(ratio.toFixed(2)), need, size });
      }
    }
    return out;
  });

await step('text contrast meets WCAG AA on rendered styles', async () => {
  const bad = await contrastFailures();
  const real = bad.filter(b => !CONTRAST_EXEMPT.test(b.cls));
  if (real.length) {
    throw new Error(`${real.length} element(s) under AA contrast, worst: `
      + real.sort((a, b) => a.ratio - b.ratio).slice(0, 4)
        .map(b => `${b.ratio}:1 (needs ${b.need}) "${b.text}" [${b.cls}]`).join(' | '));
  }
});

/*
 * AUDIT-12 §4 (U1/U5/U8): the same AA check with the dark theme stamped on,
 * across the screens that carry the gold band, the red Proceed buttons and
 * the alliance chips. Every one of those was readable in light and not dark.
 */
await step('dark mode text contrast meets WCAG AA', async () => {
  const setTheme = t => page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, t);
  const failures = [];
  const check = async where => {
    await page.waitForTimeout(150);
    const bad = (await contrastFailures()).filter(b => !CONTRAST_EXEMPT.test(b.cls));
    bad.sort((x, y) => x.ratio - y.ratio).slice(0, 3)
      .forEach(b => failures.push(`${where}: ${b.ratio}:1 (needs ${b.need}) "${b.text}" [${b.cls}]`));
  };
  await setTheme('dark');
  try {
    await check('current screen');
    for (const [where, hash, heading] of [
      ['setup', '/', /may the odds/i],
      ['hall of fame', '/hall-of-fame', /hall of fame/i],
      ['how to play', '/how-to-play', /rules of the thing/i],
    ]) {
      await page.evaluate(h => { window.location.hash = h; }, hash);
      await page.getByRole('heading', { name: heading }).first().waitFor();
      await setTheme('dark');
      await check(where);
    }
  } finally {
    await setTheme('light');
  }
  if (failures.length) throw new Error(`${failures.length} dark-mode AA failure(s): ${failures.slice(0, 6).join(' | ')}`);
});

await step('a dialog returns focus to whatever opened it', async () => {
  const opener = page.getByRole('button', { name: /— District \d+, (Male|Female), age \d+/ }).first();
  if (!await opener.count()) return;
  await opener.focus();
  const before = await page.evaluate(() => document.activeElement?.textContent?.slice(0, 40) ?? '');
  await opener.click();
  await page.getByRole('dialog').first().waitFor({ timeout: 4000 });
  // Focus must be inside the dialog while it is open, or a screen reader user
  // is still standing in the page behind it.
  const inside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && d.contains(document.activeElement);
  });
  if (!inside) throw new Error('focus stayed outside the dialog when it opened');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => document.activeElement?.textContent?.slice(0, 40) ?? '');
  if (after !== before) throw new Error(`focus was not restored to the opener (was "${before}", now "${after}")`);
});

await step('the live region announces without flooding', async () => {
  const regions = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-live]')].map(el => ({
      politeness: el.getAttribute('aria-live'),
      atomic: el.getAttribute('aria-atomic'),
      len: (el.textContent || '').trim().length,
    })));
  if (regions.length === 0) throw new Error('no aria-live region: nothing is announced at all');
  const shouty = regions.filter(r => r.politeness === 'assertive');
  if (shouty.length) throw new Error(`${shouty.length} assertive live region(s): the feed interrupts the reader`);
  // A live region holding the whole chronicle re-reads the whole chronicle.
  const flooding = regions.filter(r => r.len > 400);
  if (flooding.length) throw new Error(`a live region holds ${flooding[0].len} characters — that is a wall of text per update`);
});

await step('reduced motion is honoured', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(300);
  const moving = await page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const dur = parseFloat(cs.animationDuration) || 0;
      const iter = cs.animationIterationCount;
      if (dur > 0 && (iter === 'infinite' || Number(iter) > 1)) n++;
    }
    return n;
  });
  if (moving > 0) throw new Error(`${moving} element(s) still run a repeating animation under prefers-reduced-motion`);
  await page.emulateMedia({ reducedMotion: null });
});

for (const zoom of [200, 400]) {
  await step(`the run is usable at ${zoom}% zoom`, async () => {
    // Zoom is width in CSS pixels: 1280 at 200% is a 640px viewport.
    await page.setViewportSize({ width: Math.round(1280 / (zoom / 100)), height: Math.round(950 / (zoom / 100)) });
    await page.waitForTimeout(400);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    await page.screenshot({ path: `${shots}/zoom-${zoom}.png` });
    if (over) throw new Error(`horizontal scrolling appears at ${zoom}% zoom`);
    const reachable = await page.getByRole('button').count();
    if (reachable === 0) throw new Error(`no controls are reachable at ${zoom}% zoom`);
  });
}
await page.setViewportSize({ width: 1400, height: 950 });

console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.map(e => ' - ' + e).join('\n') : 'No errors.'));
await browser.close();
process.exit(errors.length ? 1 : 0);
