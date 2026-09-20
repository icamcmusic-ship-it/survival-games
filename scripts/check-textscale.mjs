/**
 * AUDIT-9 batch 3: the text-size preference, in a real browser.
 *
 * The audit could not launch Chromium, so every UI finding in it — including
 * B16, that ~200 labels were written in fixed pixels and did not move with the
 * setting — is a static finding and an acceptance test rather than a verified
 * one. B16's repair was verified on one viewport at one moment; that is a
 * measurement, not an acceptance pass.
 *
 * This is the pass. For every text-scale setting, on a phone and on a desktop
 * width, across the screens that carry the dense labels:
 *
 *   - the scaled type tokens actually change size with the preference;
 *   - nothing overflows horizontally;
 *   - no interactive control gets clipped out of its container;
 *   - the smallest rendered player-facing text stays legible.
 *
 * Requires `npm run dev` on port 3000.
 *   CHROMIUM_PATH=/path/to/chrome node scripts/check-textscale.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/survival-games/';
const SCALES = ['small', 'medium', 'large', 'larger'];
const WIDTHS = [{ name: 'phone', width: 380, height: 780 }, { name: 'desktop', width: 1400, height: 950 }];
const failures = [];
const note = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures.push(msg); };

const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

/**
 * Drive into a live run, because the setup screen is not where the dense
 * labels are. The dossier rows, filter chips, standings table and map
 * annotations are the ~200 labels B16 was about, and none of them exist until
 * the Games have started.
 */
async function intoTheArena(page) {
    await page.getByRole('button', { name: /reap the tributes/i }).click();
    await page.getByRole('heading', { name: 'The Reaping' }).waitFor();
    await page.getByRole('button', { name: /confirm tributes/i }).click();
    await page.getByRole('heading', { name: /the chronicle/i }).waitFor();
    const PRE_GAMES = /hold the reaping|board the train|run the parade|open the training floor|training day \d|read the scores|start the interviews|sound the gong|run the bloodbath/i;
    for (let i = 0; i < 12; i++) {
        const next = page.getByRole('button', { name: PRE_GAMES });
        if (await next.count() === 0) break;
        await next.last().click();
        await page.waitForTimeout(150);
    }
    // A few cycles in, so the feed, the standings and the dossiers have content.
    for (let i = 0; i < 3; i++) {
        const next = page.getByRole('button', { name: /next phase|advance/i });
        if (await next.count() === 0) break;
        await next.last().click();
        await page.waitForTimeout(200);
    }
}

for (const vp of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    console.log(`\n${vp.name} (${vp.width}px)`);
    try {
        await intoTheArena(page);
    } catch (e) {
        console.log(`  ! could not reach the arena: ${e.message.split('\n')[0]}`);
        failures.push(`${vp.name}: could not reach the arena`);
    }

    const sizes = {};
    for (const scale of SCALES) {
        await page.evaluate(s => document.documentElement.setAttribute('data-scale', s), scale);
        await page.waitForTimeout(60);
        sizes[scale] = await page.evaluate(() => {
            const read = cls => {
                const el = document.querySelector('.' + cls);
                return el ? parseFloat(getComputedStyle(el).fontSize) : null;
            };
            return {
                nano: read('text-nano'), micro: read('text-micro'),
                mini: read('text-mini'), label: read('text-label'),
                root: parseFloat(getComputedStyle(document.documentElement).fontSize),
            };
        });
    }

    // 1. The tokens move with the preference. This is the B16 claim itself.
    for (const token of ['micro', 'mini', 'label']) {
        const small = sizes.small[token];
        const larger = sizes.larger[token];
        if (small === null || larger === null) {
            note(true, `text-${token} not present on this screen (skipped)`);
            continue;
        }
        note(larger > small * 1.3,
            `text-${token} scales: ${small}px at "small" -> ${larger}px at "larger"`);
    }

    // 2. Nothing overflows sideways at the largest setting — the case that
    //    actually breaks, because every label just got a third bigger.
    await page.evaluate(() => document.documentElement.setAttribute('data-scale', 'larger'));
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
    note(overflow <= 1, `no horizontal overflow at "larger" (${overflow}px past the viewport)`);

    // 3. No control clipped out of its own container at the largest setting.
    const clipped = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('button, a[href], select, input').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (r.right > window.innerWidth + 1 || r.left < -1) {
                bad.push((el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40));
            }
        });
        return bad;
    });
    note(clipped.length === 0,
        `no control pushed outside the viewport at "larger"${clipped.length ? `: ${clipped.slice(0, 4).join(' | ')}` : ''}`);

    // 4. The smallest player-facing text is still legible at the smallest
    //    setting — the other end of the same preference, and the one a
    //    scaling change can quietly break.
    const smallest = sizes.small.nano ?? sizes.small.micro;
    if (smallest !== null && smallest !== undefined) {
        note(smallest >= 8.5, `smallest scaled label is ${smallest}px at "small" (floor 8.5px)`);
    }

    await page.close();
}

await browser.close();
console.log(`\ntext scale: ${failures.length === 0 ? 'all checks hold' : `${failures.length} FAILED`}`);
process.exit(failures.length ? 1 : 0);
