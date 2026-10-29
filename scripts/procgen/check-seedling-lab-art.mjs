#!/usr/bin/env node
/**
 * check-seedling-lab-art — THE LAB ARC L2 ACCEPTANCE ROW (seedling-lab-static-art): does `watch.html` boot, load
 * the Seedling art, and draw the room in it (statically) in every arm — and fall back to the rectangles when told?
 *
 * ── WHAT THIS ADDS OVER THE VITEST ROWS ───────────────────────────────
 * `watchArt.test.js` pins the DRAW LISTS, the layer cache and the static frame in node. This proves the PAGE'S
 * path: the packs fetched and decoded in a real browser, the toggle as DOM, and the PIXELS — the canvas is not
 * the rectangle palette.
 *
 * ⛔ READ FROM THE DRIVEN SYSTEM. `window.__labArt.drawn` is written by `makeRenderer.draw` itself (the main
 * canvas only), and the pixel census reads the canvas — not the checkbox, not the load status alone. A page whose
 * toggle said "on" while the renderer drew rectangles fails on both.
 *
 *   per arm (replay, solve, edit, generate): the art loads (`status: 'ready'`, no failed sheet), the last draw
 *   painted sprites, and at most `RECT_MAX` of the canvas is rectangle-palette colour — then `?art=off` (and the
 *   checkbox) draws rectangles: `drawn: null` and at least `RECT_MIN` of the canvas in the palette. The replay arm
 *   also scrubs BACKWARDS. The set editor's strip draws its room stills, and the toggle re-draws them.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like its siblings.
 * Run: node scripts/procgen/check-seedling-lab-art.mjs [--host=http://localhost:8000] [--shots=<dir>]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp } from './argvHelp.js';
import { FLOOR_COLOUR, SOLID_COLOUR, TILE_COLOURS } from '../../frontend/modules/seedlingDemo/rectPalette.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'check-seedling-lab-art.mjs', kind: 'browser' });

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const SHOTS = arg('shots', '');
const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`;
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';
/** The share of canvas pixels in the rectangle palette: an art draw stays under the first, a rect draw over the second. */
const RECT_MAX = 0.2;
const RECT_MIN = 0.5;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

// (the body is drained: an unread body kills Node 22's undici — trap 1057)
const alive = await fetch(`${HOST}/${TAPES}/index.json`)
    .then(async (r) => { await r.arrayBuffer(); return r.ok; }).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO ROOT (or pass --host=)`);
    process.exit(0);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/** The palette the rectangle view fills with (the floor, the walls, every tile colour) plus the background. */
const PALETTE = [...new Set([FLOOR_COLOUR, SOLID_COLOUR, ...Object.values(TILE_COLOURS), '#101014'])]
    .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

const browser = await chromium.launch();

/** The share of the main canvas's pixels that are EXACTLY a palette colour (the rect view's flat fills). */
const paletteShare = (page) => page.evaluate((palette) => {
    const c = document.getElementById('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const keys = new Set(palette.map(([r, g, b]) => (r << 16) | (g << 8) | b));
    let hit = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { n += 1; if (keys.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) hit += 1; }
    return { share: hit / n, w: c.width, h: c.height };
}, PALETTE);

const ARMS = Object.freeze([
    { name: 'replay', q: `tape=${TAPES}/r8-solve-1.json&side=js&tick=40`, scrub: true },
    { name: 'solve', q: 'source=solve' },
    { name: 'edit', q: 'source=edit&level=4' },
    { name: 'generate', q: 'source=generate&seed=1' },
]);

for (const arm of ARMS) {
    console.log(`\n## ${arm.name}`);
    for (const mode of ['on', 'off']) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        const q = [arm.q, mode === 'off' ? 'art=off' : ''].filter(Boolean).join('&');
        await page.goto(`${PAGE}${q ? `?${q}` : ''}`, { waitUntil: 'domcontentloaded' });
        const ready = await page.waitForFunction((want) => {
            const a = window.__labArt;
            if (!a || a.status === 'loading' || a.status === 'idle') return false;
            return want === 'on' ? (a.status !== 'ready' || a.drawn !== null) : a.status === 'ready';
        }, mode, { timeout: 90000 }).then(() => true).catch(() => false);
        // the replay arm keeps drawing; give every arm a beat to settle its first frame
        await page.waitForTimeout(1500);
        const art = await page.evaluate(() => window.__labArt ?? null);
        const px = await paletteShare(page);
        if (mode === 'on') {
            check(ready && art?.status === 'ready' && art.failedSheets === 0,
                `${arm.name}: the art loads (graphics.seedling), every sheet decoded`, JSON.stringify(art && { status: art.status, why: art.why, failedSheets: art.failedSheets }));
            check(art?.active === true && (art.drawn?.sprites ?? 0) > 0,
                `${arm.name}: the main canvas's last draw painted SPRITES (read off the renderer)`, JSON.stringify(art?.drawn));
            check(px.share <= RECT_MAX, `${arm.name}: the canvas is NOT the rectangle palette (≤ ${RECT_MAX})`,
                `${(px.share * 100).toFixed(1)}% palette over ${px.w}×${px.h}`);
            const box = await page.$eval('#lab-art', (i) => ({ checked: i.checked, disabled: i.disabled, inLayers: !!i.closest('#layers') }));
            check(box.checked && !box.disabled && !box.inLayers,
                `${arm.name}: the "Seedling art" toggle is on, enabled, and NOT inside #layers`, JSON.stringify(box));
            if (SHOTS) await page.locator('#canvas').screenshot({ path: join(SHOTS, `lab-art-${arm.name}.png`) });
            if (arm.scrub) {
                // ⛔ STATIC: scrubbing BACKWARDS needs no re-step — the frame is not a function of the tick
                await page.$eval('#scrub', (el) => { el.value = '5'; el.dispatchEvent(new Event('input')); });
                await page.waitForTimeout(500);
                const back = await page.evaluate(() => window.__labArt);
                const pxBack = await paletteShare(page);
                check((back.drawn?.sprites ?? 0) > 0 && pxBack.share <= RECT_MAX && errors.length === 0,
                    `${arm.name}: a scrub BACKWARDS (tick 40 → 5) still draws the art, with no error`,
                    `${JSON.stringify(back.drawn)}, ${(pxBack.share * 100).toFixed(1)}% palette`);
            }
            // the checkbox turns it off on the live page (the arm's registered redraw repaints)
            await page.uncheck('#lab-art');
            await page.waitForTimeout(800);
            const off = await page.evaluate(() => window.__labArt);
            const pxOff = await paletteShare(page);
            check(off.active === false && off.drawn === null && pxOff.share >= RECT_MIN,
                `${arm.name}: unticking the box repaints in rectangles`,
                `drawn ${JSON.stringify(off.drawn)}, ${(pxOff.share * 100).toFixed(1)}% palette`);
        } else {
            check(art?.on === false && art.drawn === null, `${arm.name} ?art=off: the toggle starts off and the draw is rectangles`,
                JSON.stringify(art && { on: art.on, drawn: art.drawn }));
            check(px.share >= RECT_MIN, `${arm.name} ?art=off: the canvas IS the rectangle palette (≥ ${RECT_MIN})`,
                `${(px.share * 100).toFixed(1)}% palette`);
            if (SHOTS) await page.locator('#canvas').screenshot({ path: join(SHOTS, `lab-art-${arm.name}-off.png`) });
        }
        check(errors.length === 0, `${arm.name} (${mode}): no page errors`, errors.slice(0, 2).join(' | '));
        await page.close();
    }
}

// ── the SET editor's strip: the stills draw (in art), and the toggle re-keys them ──
console.log('\n## set editor — the room stills');
{
    const R = new URL('../../frontend/modules/seedlingDemo/', import.meta.url).href;
    const { buildLevelSet } = await import(`${R}levelSetExporter.js`);
    const { emptyLevel } = await import(`${R}procgenLevel.js`);
    // three exit-free rooms (a vanilla room's stairs name levels outside a 3-room set, which the validator refuses)
    const set = buildLevelSet([0, 1, 2].map((l) => ({ seed: 0, record: emptyLevel({ level: l, width: 10, height: 8 }),
        summary: null, name: `E${l}` })), { setId: 'lab-art-probe', generator: 'check-seedling-lab-art.mjs' }).set;
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${PAGE}?source=edit&level=4`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__labArt?.status === 'ready', null, { timeout: 90000 });
    await page.fill('#editLoad', JSON.stringify(set));
    await page.click('#editLoadGo');
    await page.waitForTimeout(1500);
    /** The strip's distinct colours inside room 0's still (a failed still is the flat cell fill). */
    const stillColours = () => page.evaluate(() => {
        const c = document.getElementById('editSetOverview');
        const cell = c.width / 3;
        const d = c.getContext('2d').getImageData(Math.round(cell * 0.2), Math.round(c.height * 0.4),
            Math.round(cell * 0.6), Math.round(c.height * 0.4)).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return [...seen];
    });
    const detail = await page.textContent('#detail');
    const on = await stillColours();
    check(!/clientWidth/.test(detail) && on.length > 4,
        'the set strip DRAWS its room stills (before L2 every still threw `null.clientWidth` in `fit`: a detached canvas)',
        `${on.length} colours in room 0's still; detail "${detail.slice(0, 80)}"`);
    if (SHOTS) await page.locator('#editSetOverview').screenshot({ path: join(SHOTS, 'lab-art-set-strip.png') });
    await page.uncheck('#lab-art');
    await page.waitForTimeout(800);
    const off = await stillColours();
    check(JSON.stringify(off.sort()) !== JSON.stringify(on.sort()),
        '⛓ unticking the art RE-DRAWS the stills (`labStillKey`: one key per source AND mode)',
        `${on.length} → ${off.length} colours`);
    check(errors.length === 0, 'set editor: no page errors', errors.slice(0, 2).join(' | '));
    await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
