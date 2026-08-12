#!/usr/bin/env node
/**
 * check-seedling-editor-overlays — THE EDITOR ARC SLICE 2 ACCEPTANCE ROW.
 *
 * Does the PAGE, in a browser, draw the overlays the run's own ledgers
 * imply — and does the trace pane find its sidecar?
 *
 * ── WHAT THIS ADDS OVER THE VITEST ROWS ───────────────────────────────
 *
 * `watchOverlays.test.js` already asserts both of kickoff §4's slice-2
 * ledger facts against `collectRun`/`overlaysFor` — the same derivation the
 * page uses — in node, in CI. It is the row that proves the DERIVATION.
 *
 * This is the row that proves the PAGE'S PATH TO IT, which is the unshared
 * part and the part that has broken before: the module graph loading in a
 * browser at all (⛔ slice 1 found `watch.html` unloadable for TWO RUNGS
 * behind an exit-0 skip), the `?layers=` parameter reaching the layer set,
 * the toggles being generated from the roster, the sidecar fetch resolving
 * over HTTP, and chromium instead of node.
 *
 * ⚠ SCREENSHOTS ARE EVIDENCE, NOT GATES (kickoff §5). Every check below is
 * a ledger fact — a tick, a count, a body id. `--shot=<dir>` writes PNGs
 * for a human or an agent to look at; nothing is asserted about pixels.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * every other seedling probe — ⚠ and slice 4 owns the ruling that this arc
 * ends with a browser gate that does NOT skip (kickoff §8.9).
 *
 * Run: node scripts/procgen/check-seedling-editor-overlays.mjs
 *      node scripts/procgen/check-seedling-editor-overlays.mjs --host=http://localhost:8003
 *      node scripts/procgen/check-seedling-editor-overlays.mjs --shot=/tmp/shots
 */

/**
 * ⚠ FROM `@playwright/test`, NOT FROM `playwright` — `package.json` PINS
 * the former and FLOATS the latter, and only the pinned one's browser build
 * is in `~/.cache/ms-playwright` after a plain `npm ci`. Slice 1's own note.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const SHOT = arg('shot', '');
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

const alive = await fetch(`${HOST}/${TAPES}/r8-solve-18.json`).then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}
if (SHOT) mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch();

/**
 * Load one tape in the page and hand back its overlay readout.
 *
 * `shotAt` is an EVIDENCE tick, not a gate: `r8-solve-18` ends in L19, and
 * the overlays are filtered to the level being drawn (a body sampled in L18
 * must not be painted on L19's canvas), so a screenshot of the last frame
 * shows an empty room and proves nothing to a reader. The extra shot is
 * taken mid-walk, where the room being drawn is the room the run was in.
 */
async function load(name, extra = '', shotAt = null) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    // ⚠ WITH THE RESOURCE URL. A bare "Failed to load resource: 404" names
    // nothing, so a row that wanted to allow ONE expected 404 could only
    // allow them all — which is how a real missing file rides in behind an
    // expected one. `location().url` is the failing request's own URL.
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const url = `${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?tape=${TAPES}/${name}.json&side=js${extra}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorOverlays, null, { timeout: 180000 });
    const overlays = await page.evaluate(() => window.__editorOverlays);
    // Scrub to the END so every marker is past the cursor and drawn.
    await page.evaluate(() => {
        const s = document.getElementById('scrub');
        s.value = s.max;
        s.dispatchEvent(new Event('input'));
    });
    const pane = await page.evaluate(() => ({
        rows: document.querySelectorAll('#trace .tr').length,
        none: document.querySelector('#trace .traceNone')?.textContent ?? null,
        lit: document.querySelectorAll('#trace .tr.past').length,
        toggles: [...document.querySelectorAll('#layers input')].map(
            (i) => [i.id.replace(/^layer-/, ''), i.checked]),
        legend: document.querySelectorAll('#legend .sw').length,
        detail: document.getElementById('detail').textContent,
    }));
    if (SHOT) {
        await page.screenshot({ path: `${SHOT}/${name}${extra ? '-layers' : ''}.png` });
        if (shotAt !== null) {
            await page.evaluate((t) => {
                const s = document.getElementById('scrub');
                s.value = String(t);
                s.dispatchEvent(new Event('input'));
            }, shotAt);
            await page.screenshot({ path: `${SHOT}/${name}-t${shotAt}.png` });
        }
    }
    return { page, overlays, pane, errors, url };
}

// ── ROW 1: r8-solve-18 — both spinner paths, the presses, no damage ──────

{
    const { page, overlays, pane, errors, url } = await load('r8-solve-18', '', 300);
    console.log(`\n## r8-solve-18 — ${overlays.frames} frames\n   ${url}`);

    const enemies = overlays.channels.enemies;
    check(enemies.bodies === 2 && enemies.ids.join(',') === 'spinner@112,48,spinner@48,96',
        'BOTH spinner paths are sampled, by id',
        `${enemies.bodies} body/ies (${enemies.ids.join(' ')}), ${enemies.points} sampled point(s)`);

    const action = overlays.markers.filter((m) => m.layer === 'action');
    const ticks = action.map((m) => m.tick);
    check(JSON.stringify(ticks) === JSON.stringify([33, 66, 104, 179, 212, 270]),
        'the press markers stand at the recorded press ticks',
        `[${ticks.join(', ')}]`);

    const damage = overlays.markers.filter((m) => m.layer === 'damage');
    check(damage.length === 0, 'ZERO damage markers — the honest L18 took nothing',
        `${damage.length} marker(s)`);

    check(pane.rows > 0 && pane.none === null,
        'the trace pane rendered the fetched sidecar',
        `${pane.rows} row(s); ${pane.lit} lit at the end of the scrub`);
    check(pane.lit === pane.rows,
        'every row is lit once the cursor is past the last decision',
        `${pane.lit}/${pane.rows}`);

    // Click the FIRST trace row and land on its tick — §3.3's click-to-seek.
    const firstTick = await page.evaluate(() => {
        document.querySelector('#trace .tr').click();
        return Number(document.getElementById('scrub').value);
    });
    check(firstTick === overlays.trace.firstTick,
        'clicking a trace row seeks to ITS tick',
        `cursor ${firstTick}, first row t${overlays.trace.firstTick}`);

    check(pane.toggles.length === 8 && pane.legend >= 10,
        'eight layer toggles and a legend, generated from the roster',
        `${pane.toggles.length} toggle(s), ${pane.legend} legend entr(ies)`);
    const arrows = pane.toggles.find(([id]) => id === 'arrows');
    check(arrows && arrows[1] === false, '⚖ arrow paths default OFF', JSON.stringify(arrows));

    check(overlays.unplaced.length === 0 && overlays.unknownGlyphs.length === 0,
        'nothing unplaced and no marker without a glyph',
        `${overlays.unplaced.length} unplaced, ${overlays.unknownGlyphs.length} glyphless`);
    check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');
    await page.close();
}

// ── ROW 2: r8-hammer-control — exactly ONE damage marker, at tick 247 ────

{
    const { page, overlays, pane, errors, url } = await load('r8-hammer-control');
    console.log(`\n## r8-hammer-control — ${overlays.frames} frames\n   ${url}`);

    const damage = overlays.markers.filter((m) => m.layer === 'damage');
    check(damage.length === 1, 'exactly ONE damage marker', `${damage.length} marker(s)`);
    check(damage[0]?.tick === 247, 'and it is at tick 247', `tick ${damage[0]?.tick}`);
    check(/spinner-hammer/.test(damage[0]?.label ?? ''),
        'the marker names its source', damage[0]?.label);

    check(pane.rows === 0 && /no trace for this tape/.test(pane.none ?? ''),
        '⚠ a tape with no sidecar says so BY NAME rather than showing an empty pane',
        pane.none);
    /**
     * ⚠ ONE EXPECTED CONSOLE LINE, AND IT IS NAMED RATHER THAN TOLERATED.
     * Chromium logs a 404 for the sidecar this tape does not have; the pane
     * reports the SAME 404 by name, so the fetch behaved correctly and the
     * absence is the finding. Filtered by that one URL — not by "404" —
     * so any OTHER missing resource still reds this row.
     */
    const unexpected = errors.filter((e) => !e.includes('r8-hammer-control.trace.json'));
    check(unexpected.length === 0,
        'no page errors beyond the expected missing-sidecar 404',
        unexpected.join(' | ') || `clean (${errors.length} expected sidecar 404)`);
    await page.close();
}

// ── ROW 3: ?layers= reaches the layer set ───────────────────────────────

{
    const { page, overlays, pane, errors, url } = await load(
        'r8-solve-18', '&layers=player,arrows,nonesuch');
    console.log(`\n## ?layers=player,arrows,nonesuch\n   ${url}`);
    const onIds = overlays.layers.filter((l) => l.on).map((l) => l.id);
    check(JSON.stringify(onIds) === JSON.stringify(['player', 'arrows']),
        '?layers= sets the ON set exactly — everything unnamed is OFF',
        `on: ${onIds.join(', ')}`);
    check(JSON.stringify(pane.toggles.filter(([, on]) => on).map(([id]) => id))
        === JSON.stringify(['player', 'arrows']),
        'and the checkboxes agree with it', JSON.stringify(pane.toggles));
    check(overlays.unknownLayerParams.join(',') === 'nonesuch'
        && /unknown layer/.test(pane.detail),
        '⚠ an unknown layer name is REPORTED on the page, not silently ignored',
        pane.detail.split('\n').filter((l) => l.includes('unknown')).join(' '));
    check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');
    await page.close();
}

// ── ROW 4: SOURCE=SOLVE feeds the pane from the solve's OWN trace ───────

{
    /**
     * ⛓ THE PANE'S OTHER ARM. A committed tape's trace is FETCHED; an
     * in-page solve's is already in memory and goes straight in. Two
     * sources, one pane — and the arm with no sidecar on disk is exactly the
     * one a sidecar-only test would leave uncovered.
     */
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const url = `${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?level=4&boot=${TAPES}/r7-act2-4.json&goals=exit%3A64%2C16&solve=1&name=r8-solve-4`;
    console.log(`\n## SOURCE=SOLVE — the pane from the solve's own trace\n   ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorOverlays, null, { timeout: 180000 });
    const solved = await page.evaluate(() => ({
        rows: document.querySelectorAll('#trace .tr').length,
        none: document.querySelector('#trace .traceNone')?.textContent ?? null,
        traceRows: window.__editorSolve?.traceRows ?? null,
        overlayRows: window.__editorOverlays.trace.rows,
        markers: window.__editorOverlays.markers.length,
    }));
    check(solved.none === null && solved.rows > 0,
        'the pane rendered the SOLVE\'s own trace — no sidecar involved',
        `${solved.rows} row(s)`);
    check(solved.rows === solved.traceRows && solved.rows === solved.overlayRows,
        'and it rendered ALL of them — the pane and the solve agree on the count',
        `pane ${solved.rows}, solve ${solved.traceRows}, readout ${solved.overlayRows}`);
    check(solved.markers > 0, 'the solved walk carries markers too',
        `${solved.markers} marker(s)`);
    check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');
    if (SHOT) await page.screenshot({ path: `${SHOT}/solve-r8-solve-4.png` });
    await page.close();
}

await browser.close();
if (SHOT) console.log(`\nscreenshots (EVIDENCE, not gates) in ${SHOT}`);
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
