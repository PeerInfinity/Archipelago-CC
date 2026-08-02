#!/usr/bin/env node
/**
 * probe-seedling-watch-page — does `watch.html` actually DRAW a tape, all
 * the way through, without dying?
 *
 * Region-atlas Phase 8. The watch page gates nothing and makes no claims —
 * see `watchViewer.js`'s docblock — so this is not a gate either. It exists
 * because the page had NO coverage of any kind and a defect in it presents
 * as *silence*: the animation stops and the status bar still says "ok".
 *
 * ── The failure this was written for ──────────────────────────────────
 *
 * R4 gave the census a THIRD proximity-hazard shape (a `BossLock`'s
 * `collideLine` row of integer probes, which carries neither `rect` nor
 * `disc`). `avoidVolumesAt` learned it; the RENDERER did not, and its
 * `if (h.rect) ... else <disc>` dereferenced `h.disc.x`. The throw landed
 * inside the `requestAnimationFrame` callback, ABOVE the line that re-arms
 * it — so the loop simply stopped, with no status, no detail and nothing on
 * the page to read.
 *
 * The symptom, verbatim: *"it got stuck near the beginning when it entered
 * level 12"*. This probe reproduces it as `scrub at 2114 (STUCK)` — 2114
 * being the first observation in level 12, which holds five bosslocks.
 *
 * ⚠ The vitest guard for the underlying contract is in `levelWorld.test.js`
 * ("every BUILT hazard has exactly one shape"), and THAT is the regression
 * net: it runs in CI and this needs a browser and a dev server. What this
 * adds is the other half — that a renderer arm exists for each shape and the
 * page survives a whole tape.
 *
 * Prereqs: a dev server on :8000 at the REPO ROOT. SKIPs (exit 0) without
 * one, like every other seedling probe.
 *
 * Run: node scripts/procgen/probe-seedling-watch-page.mjs
 *      node scripts/procgen/probe-seedling-watch-page.mjs --tape=r4-walk-full
 */

import { chromium } from 'playwright';

const HOST = 'http://localhost:8000';
const NAME = (process.argv.find((a) => a.startsWith('--tape=')) ?? '--tape=r4-walk-full')
    .slice('--tape='.length);
const TAPE = `frontend/modules/seedlingDemo/fixtures/tapes/${NAME}.json`;
const STREAM = `frontend/modules/seedlingDemo/fixtures/expectations/${NAME}.json`;
const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?tape=${TAPE}&side=js&speed=8`;
/** How long the play test runs, and the floor it has to clear. */
const PLAY_MS = 6000;

const alive = await fetch(`${HOST}/${TAPE}`).then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPE} — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000`');
    process.exit(0);
}
/**
 * The observation stream, for the LEVELS the walk visits.
 *
 * ⚠ An oracle recording, used here only as an INDEX — "which ticks are in
 * which level" — so the probe can aim at the level a renderer is most likely
 * to choke on rather than at a tick number somebody typed. It asserts
 * nothing about the values.
 */
const stream = await (await fetch(`${HOST}/${STREAM}`)).json();

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const scrubValue = () => page.evaluate(() => Number(document.getElementById('scrub').value));
/** Scrub to an observation and read the HUD's level back. */
async function seek(t) {
    await page.evaluate((tick) => {
        const s = document.getElementById('scrub');
        s.value = String(tick);
        s.dispatchEvent(new Event('input'));
    }, t);
    await page.waitForTimeout(100);
    const hud = (await page.textContent('#hud')).replace(/\s/g, '');
    return Number(/level(\d+)\(/.exec(hud)?.[1]);
}

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
    () => document.getElementById('status')?.textContent.includes('observations'),
    null, { timeout: 300000 },
);
check(true, `loaded ${NAME}`, await page.textContent('#status'));

// ── every level the walk enters, drawn at its FIRST tick there ────────
// A renderer arm is per GEOMETRY, so the level is the unit: one tick in
// each is what makes this a coverage claim rather than a spot check.
const firstIn = new Map();
for (const o of stream.ticks) if (!firstIn.has(o.level)) firstIn.set(o.level, o.t);
for (const [level, t] of [...firstIn].sort((a, b) => a[1] - b[1])) {
    const drawn = await seek(t);
    check(drawn === level, `level ${level} draws (first at observation ${t})`,
        drawn === level ? '' : `the HUD says level ${drawn}`);
}

// ── and it PLAYS, which is the thing that actually broke ──────────────
// ⚠ Scrubbing exercises `hud()` once; PLAYING exercises the rAF loop, and
// the defect this probe exists for killed the loop rather than the draw.
// Start a little before the level with the most volumes on the route.
const busiest = [...firstIn].sort((a, b) => a[1] - b[1])
    .find(([lvl]) => lvl === 12) ?? [...firstIn][1];
const from = Math.max(0, busiest[1] - 200);
await seek(from);
if (await page.textContent('#play') === 'Play') await page.click('#play');
await page.waitForTimeout(PLAY_MS);
const after = await scrubValue();
check(after > busiest[1],
    `plays THROUGH level ${busiest[0]} (from ${from}, ${PLAY_MS / 1000}s at 8x)`,
    `scrub reached ${after}; level ${busiest[0]} starts at ${busiest[1]}`);

check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');
// ...and the renderer's own report of shapes it had no arm for.
const detail = await page.textContent('#detail');
check(!detail.includes('NOT DRAWN'), 'every volume shape has a renderer arm', detail);

await browser.close();
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
