/**
 * H4a — **THE BEFORE/AFTER PAIR FOR THE CONNECTION LINES.**
 *
 * A LOADED rules.json reaches the pipeline panel's composite canvas through
 * `reconstructResultFromSidecars` (`compositeMapDocument.js`), which until H4a
 * placed each region WITHOUT its top-level `exits` — so the renderer's
 * connection pass had nothing to pair and the view drew cells and in-cell exit
 * squares and no inter-region lines (plan §13.1 #6).
 *
 * Loads `procgen_maze/AP_1` through the Presets panel — the same path a person
 * takes — raises the Procgen Pipeline panel, and writes a PNG of its composite
 * canvas. Run it once with the fix stashed and once with it applied; the two
 * PNGs are the pair. The COUNT is asserted by
 * `compositeMapDocument.test.js`'s recording-context rows — this is the picture
 * beside it, not the gate.
 *
 * Prereq: a dev server serving THIS worktree (:8000 by default; PROCGEN_UI_HOST
 * or --host=<url> to point elsewhere).
 * Run: node scripts/procgen/shot-loaded-composite-map.mjs <outfile.png>
 */
import { chromium } from 'playwright';
import { takeBoxLockOrExit } from './boxLock.js';

const out = process.argv.find((a) => a.endsWith('.png')) ?? 'loaded-composite-map.png';
const host = process.env.PROCGEN_UI_HOST
  ?? (process.argv.find((a) => a.startsWith('--host='))?.slice(7))
  ?? 'http://localhost:8000';

takeBoxLockOrExit({ name: 'shot-loaded-composite-map.mjs', kind: 'browser' });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(`${host}/frontend/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.lm_tab', { timeout: 60000 });
await page.waitForTimeout(8000);

/**
 * ⛓ A GoldenLayout tab is NOT clickable through a locator: several docks are
 * laid out off-screen in headless, so Playwright's visibility check never
 * settles. `verify-sphere-steps-ui.mjs` dispatches the events itself, and this
 * follows it rather than inventing a second answer.
 */
const goTab = (title) => page.evaluate((t) => {
  const x = [...document.querySelectorAll('.lm_tab')].find((e) => e.title === t);
  if (!x) return false;
  x.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  x.click();
  return true;
}, title);

// ⛓ MOUNT THE PIPELINE PANEL FIRST. Its loaded-preset intake is a subscription
//   to `stateManager:rawJsonDataLoaded` taken in `initialize()`, and
//   GoldenLayout constructs a panel when its tab is first shown — a preset
//   loaded before the panel exists reaches nobody and no canvas ever appears.
if (!await goTab('Procgen Pipeline')) throw new Error('Procgen Pipeline tab not found');
await page.waitForTimeout(1500);

if (!await goTab('Presets')) throw new Error('Presets tab not found');
await page.waitForSelector('.game-row', { timeout: 15000 });
await page.waitForSelector('button[data-game-directory="procgen_maze"][data-seed-name="AP_1"]',
  { timeout: 15000 });
await page.click('button[data-game-directory="procgen_maze"][data-seed-name="AP_1"]');
await page.waitForTimeout(2500);

await goTab('Procgen Pipeline');
await page.waitForTimeout(2000);
const canvas = page.locator('.procgen-pipeline-canvas').first();
if (await canvas.count() === 0) throw new Error('no composite canvas — the panel has no result');

/**
 * ⛓ The canvas's own geometry, so the two pictures are known to be OF the same
 * grid. ⛔ NOT a region/exit count read off the panel object: the pipeline panel
 * does not publish itself on its root element (only `presetUI` and the APWorld
 * hub set `__panel`), and a probe that silently reads `undefined` would report
 * "0 regions" over a canvas that plainly has three. The COUNT claim belongs to
 * `compositeMapDocument.test.js`'s recording-context rows; this is the picture.
 */
const geom = await page.evaluate(() => {
  const c = document.querySelector('.procgen-pipeline-canvas');
  return c ? { w: c.width, h: c.height, gw: c.dataset.gridW, gh: c.dataset.gridH } : null;
});

await canvas.screenshot({ path: out });
console.log(`wrote ${out} — canvas ${geom.w}×${geom.h}px, grid ${geom.gw}×${geom.gh} cells`);
if (pageErrors.length) console.log(`  note: ${pageErrors.length} pageerror(s): ${pageErrors[0]}`);
await browser.close();
