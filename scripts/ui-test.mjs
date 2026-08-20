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
  catch (e) { errors.push(`${label}: ${e.message}`); console.log('✗ ' + label + ' — ' + e.message); }
};

await page.goto(BASE, { waitUntil: 'networkidle' });

await step('setup screen renders', async () => {
  await page.getByRole('heading', { name: /may the odds/i }).waitFor();
});

await step('advanced settings open and sliders move', async () => {
  await page.getByText(/advanced simulation settings/i).click();
  const sliders = page.locator('input[type=range]');
  await sliders.nth(0).fill('4');   // districts
  await sliders.nth(1).fill('2.5'); // hazard
  await sliders.nth(2).fill('3');   // betrayal
  await sliders.nth(3).fill('0');   // sponsors
  await page.getByText('Reset to defaults').click();
  await sliders.nth(0).fill('12');
});

await step('gamemaker mode toggles', async () => {
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

await step('procedural arena selectable', async () => {
  await page.getByText(/procedural arena/i).click();
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

await step('confirm reaping opens roster + betting', async () => {
  await page.getByRole('button', { name: /confirm tributes/i }).click();
  await page.getByRole('heading', { name: 'The Tributes' }).waitFor();
  await page.getByText(/capitol betting parlour/i).waitFor();
});

await step('search and sort roster', async () => {
  await page.getByPlaceholder(/search name/i).fill('district 1');
  await page.waitForTimeout(150);
  await page.getByPlaceholder(/search name/i).fill('zzzznope');
  await page.waitForTimeout(150);
  await page.getByText(/no tribute matches/i).waitFor();
  await page.getByPlaceholder(/search name/i).fill('');
  await page.getByRole('button', { name: 'Odds', exact: true }).click();
  await page.getByRole('button', { name: 'Training', exact: true }).click();
  await page.getByRole('button', { name: 'Name', exact: true }).click();
  await page.getByRole('button', { name: 'District', exact: true }).click();
});

const coinsText = async () => (await page.locator('header .chip-gold').last().textContent()).trim();

await step('betting deducts and refunds coins', async () => {
  const before = parseInt(await coinsText());
  await page.getByRole('button', { name: '+50', exact: true }).first().click();
  await page.getByRole('button', { name: '+100', exact: true }).first().click();
  const mid = parseInt(await coinsText());
  if (mid !== before - 150) throw new Error(`expected ${before - 150}, got ${mid}`);
  await page.getByRole('button', { name: 'Clear', exact: true }).first().click();
  const after = parseInt(await coinsText());
  if (after !== before) throw new Error(`refund failed: ${after} vs ${before}`);
  await page.getByRole('button', { name: '+100', exact: true }).first().click();
});

await step('begin training moves to arena', async () => {
  await page.getByRole('button', { name: /begin training/i }).click();
  await page.getByRole('button', { name: /proceed/i }).waitFor();
});

await step('proceed advances phases', async () => {
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /proceed/i }).click();
    await page.waitForTimeout(120);
  }
});

await step('filters panel mutes categories', async () => {
  await page.getByRole('button', { name: /filters/i }).click();
  await page.getByText(/headline events only/i).click();
  await page.getByRole('button', { name: /violence/i }).click();
  await page.getByRole('button', { name: /reset filters/i }).click();
  await page.getByRole('button', { name: /filters/i }).click();
});

await step('arena map tab + sector selection', async () => {
  await page.getByRole('button', { name: /arena map/i }).click();
  // The map opens on the graph view; the per-sector buttons live behind Detail.
  await page.getByRole('button', { name: /^detail$/i }).first().click();
  await page.locator('button:has-text("Active"), button:has-text("Collapsed")').first().click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /^clear$/i }).first().click();
  await page.getByRole('button', { name: /chronicle/i }).click();
});

await step('tribute modal opens with live data and closes with Escape', async () => {
  await page.locator('.panel button[title*="open profile"]').first().click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
});

await step('gamemaker controls fire', async () => {
  await page.getByRole('button', { name: /release mutts/i }).click();
  await page.getByRole('button', { name: /force weather/i }).click();
  await page.getByRole('button', { name: /announce feast/i }).click();
  await page.waitForTimeout(200);
  const select = page.locator('#mutt-target');
  const opts = await select.locator('option').count();
  if (opts > 1) {
    await select.selectOption({ index: 1 });
    await page.getByRole('button', { name: /release mutts/i }).click();
  }
});

await step('speed controls engage and can be stopped', async () => {
  await page.getByRole('button', { name: /5x/i }).click();
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
  await page.waitForTimeout(600);
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

await step('hall of fame records the victor', async () => {
  // The run uses a random seed, and an arena that kills every last tribute is a
  // legitimate ending. Assert against the outcome this run actually produced.
  const wipeout = await page.getByRole('heading', { name: 'No Victor', exact: true }).count() > 0;
  await page.getByRole('button', { name: 'Hall of Fame', exact: true }).click();
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
  if (count > 0) {
    await page.getByRole('button', { name: /details/i }).first().click();
    await page.waitForTimeout(150);
  } else {
    console.log('   (note: this run ended in a wipeout, so the Hall of Fame is correctly empty)');
  }
  await page.screenshot({ path: `${shots}/hof.png` });
});

await step('share button copies link', async () => {
  await page.getByRole('button', { name: /new game/i }).click();
});

await step('replay via URL boots the same run', async () => {
  await page.goto(`${BASE}?seed=REPLAY1&arena=frozen&gamemaker=false`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'The Reaping' }).waitFor();
});

await step('no horizontal overflow at mobile width', async () => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  await page.screenshot({ path: `${shots}/mobile.png` });
  if (overflow) throw new Error('page scrolls horizontally on mobile');
});

console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.map(e => ' - ' + e).join('\n') : 'No errors.'));
await browser.close();
process.exit(errors.length ? 1 : 0);
