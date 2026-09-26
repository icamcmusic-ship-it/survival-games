import { chromium } from 'playwright';
const BASE = 'http://localhost:3000/survival-games/';
const out = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const theme of ['light', 'dark']) for (const w of [380, 1280]) {
  const page = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: theme });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  const tag = `${w}-${theme}`;
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /may the odds/i }).waitFor();
  await page.screenshot({ path: `${out}/setup-${tag}.png` });
  await page.goto(`${BASE}?seed=SHOTS1&arena=frozen&gamemaker=false&mutators=blind-night,blind-night,hazard-storm`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'The Reaping' }).waitFor();
  await page.screenshot({ path: `${out}/reaping-${tag}.png` });
  await page.getByRole('button', { name: /confirm tributes/i }).click();
  await page.getByRole('button', { name: /skip to the gong/i }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/chronicle-${tag}.png` });
  await page.getByRole('button', { name: /sound the gong/i }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '/arena'; });
  await page.getByRole('button', { name: /^proceed$/i }).first().waitFor();
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: /^proceed$/i }).first().click(); await page.waitForTimeout(150); }
  await page.screenshot({ path: `${out}/arena-${tag}.png` });
  await page.locator('tbody .standings-pin button').first().click();
  await page.getByRole('dialog').first().waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/sheet-${tag}.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /run to end/i }).first().click().catch(async () => {
    await page.getByRole('button', { name: /more|controls/i }).first().click(); await page.getByRole('button', { name: /run to end/i }).first().click(); });
  await page.getByRole('button', { name: /^cancel$/i }).waitFor({ state: 'detached', timeout: 60000 });
  const iv = page.getByRole('button', { name: /review the debrief/i });
  if (await iv.count()) await iv.click();
  await page.getByRole('heading', { name: /the arena closes/i }).waitFor();
  console.log(tag, page.url());
  await page.screenshot({ path: `${out}/end-${tag}.png` });
  const wi = page.locator('.panel', { has: page.getByRole('heading', { name: /what if\?/i }) });
  await wi.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/whatif-${tag}.png` });
  await page.close();
}
await b.close();
