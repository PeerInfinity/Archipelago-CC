#!/usr/bin/env node
/**
 * check-seedling-editor-solve — THE EDITOR ARC SLICE 1 ACCEPTANCE ROW.
 *
 * Does the PAGE, solving in a browser from nothing but URL parameters,
 * derive the same `perTick` the runner derives in node?
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * The editor page builds a run of its own to solve. A viewer that builds a
 * DIFFERENT world from the runner is the two-cost-models trap with
 * geometry: the page would render a plausible walk through a room the game
 * never had, and nothing on the page could tell. The slice's answer is that
 * the page and the runner share ONE construction (`createRunForStaging`),
 * and this script is what proves the sharing actually reaches the browser.
 *
 * ── WHAT IT CAN CATCH, AND WHAT IT CANNOT ─────────────────────────────
 *
 * Both sides call the same seam, so this is NOT a check that the seam is
 * correct — it is a check that the PAGE'S OWN PATH TO IT is. Everything
 * between a URL and that call is page-owned and unshared, and every one of
 * these has broken a viewer before: parsing `?goals=`, fetching `?boot=`
 * and extracting the staging block from a full tape, fetching the atlas
 * over HTTP and building a `levelSource` from it, and running the whole
 * thing in chromium rather than node. A defect in any of them shows here as
 * a tick-count or input-span mismatch.
 *
 * ⛔ It does NOT re-derive the solver's answer independently — nothing can,
 * short of a second solver. The independent anchor is the PINNED NUMBER
 * below, which came from outside both paths.
 *
 * ── ⛓ 255, AND THE GAP TRAP 169 NAMED IS CLOSED (R9 slice 3) ──────────
 *
 * This row used to carry a SECOND pinned number, `COMMITTED_TICKS = 253`,
 * and assert that the committed artifact DISAGREED with today's derivation
 * by two ticks. R9 slice 3 spent its re-record licence and moved
 * `r8-solve-4.json` to 255; the literal did not move with it, so from that
 * slice onward the row asserted a gap that no longer existed and went RED
 * on a repair. A typed count that outlives its subject is trap 495's family
 * and this is its third instance in the arc (§15.6's `r8-battery-4.endsAt`
 * 253 -> 255 is the same two ticks, one constant over).
 *
 * ⇒ ⚖ ruling 17: the committed count is READ OFF THE ARTIFACT and asserted
 * EQUAL to today's derivation. The row keeps its teeth — a future
 * re-record that moves the tape away from the derivation reds here, by
 * name, with both numbers — and it can no longer decay, because there is
 * only one number left and the tape supplies it.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * every other seedling probe.
 *
 * Run: node scripts/procgen/check-seedling-editor-solve.mjs
 *      node scripts/procgen/check-seedling-editor-solve.mjs --host=http://localhost:8003
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ⛓ FROM `@playwright/test`, WHICH USED TO BE THE ONLY RUNNABLE CHOICE AND
 * IS NOW MERELY THE EXPLICIT ONE. `package.json` pinned `@playwright/test`
 * at 1.56.0 while FLOATING `playwright` at ^1.57.0, so the two resolved to
 * different browser builds (1194 vs 1200) and only the pinned one's build
 * was in `~/.cache/ms-playwright` after an `npm ci` — the sibling probes,
 * which import `playwright`, died on "Executable doesn't exist …
 * chromium_headless_shell-1200" before their first check.
 * ⇒ 2026-08-19 `playwright` is pinned to EXACTLY 1.56.0 as well, `npm ls`
 * shows one of them, and both imports now resolve to the same install. The
 * import stays as it is: naming the package whose browser build the pin is
 * about costs nothing and survives the next dependency move.
 */
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
/** The acceptance row's segment: `r8-solve-4`, boot block and goals. */
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';
const BOOT = `${TAPES}/r8-solve-4.json`;
const GOALS = 'exit:64,16';          // = the battery's `goalsFor(4)`
const NAME = 'r8-solve-4';
/**
 * ⛓ THE ONE PINNED NUMBER — today's derivation, from outside both paths.
 * The COMMITTED count is not typed beside it; it is read off the tape below.
 */
const EXPECTED_TICKS = 255;

const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?level=4&boot=${BOOT}&goals=${encodeURIComponent(GOALS)}&solve=1&name=${NAME}`;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

const alive = await fetch(`${HOST}/${TAPES}/index.json`).then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}

// ── the runner's derivation, in node ──────────────────────────────────
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { parseTape } = await M('tapeFormat.js');
const { stagingFromTape } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const { parseGoalsParam, solveForPage } = await M('watchSolve.js');

const staging = stagingFromTape(parseTape(JSON.parse(readFileSync(join(REPO, BOOT), 'utf8'))));
const nodeT0 = Date.now();
const node = solveForPage({
    levelSource: atlasLevelSource(),
    staging,
    goals: parseGoalsParam(GOALS),
    name: NAME,
});
console.log(`node: ${node.out.perTick.length} ticks in ${Date.now() - nodeT0} ms `
    + `(solve ${node.ms} ms), ${node.tape.inputs.length} input span(s)`);

check(node.out.perTick.length === EXPECTED_TICKS,
    `the node derivation is ${EXPECTED_TICKS} ticks (the PINNED anchor, from outside `
    + 'both paths)', `got ${node.out.perTick.length}`);
const committed = JSON.parse(readFileSync(
    join(REPO, `frontend/modules/seedlingDemo/fixtures/tapes/${NAME}.json`), 'utf8'));
check(committed.tick_count === EXPECTED_TICKS,
    `⛓ trap 169's gap is CLOSED: the committed ${NAME} and today's derivation are the `
    + `SAME ${EXPECTED_TICKS} ticks — read off the tape, never typed beside it`,
    `committed ${committed.tick_count} vs derived ${EXPECTED_TICKS}; a re-record that `
    + 'moves one and not the other reds HERE, which is what the old literal could not do');

// ── the page's derivation, in chromium ────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
try {
    await page.waitForFunction(() => window.__editorSolve, null, { timeout: 180000 });
} catch (e) {
    const status = await page.textContent('#status').catch(() => '(no #status)');
    const detail = await page.textContent('#detail').catch(() => '');
    check(false, 'the page reached a solve at all',
        `${e.message} — status: ${status} | detail: ${detail} | `
        + `errors: ${errors.join(' | ') || 'none'}`);
    await browser.close();
    process.exit(1);
}
const web = await page.evaluate(() => window.__editorSolve);

if (web.status !== 'ok') {
    check(false, 'the page solved without refusing',
        `${web.status}: ${web.message}${web.rows !== undefined ? ` (${web.rows} trace row(s) `
            + 'before the refusal)' : ''}`);
} else {
    console.log(`page: ${web.tickCount} ticks, solve ${web.solveMs} ms, `
        + `replay ${web.replayMs} ms, ${web.frames} frame(s)`);

    check(web.tickCount === node.out.perTick.length,
        'the PAGE and the RUNNER agree on the tick count',
        `page ${web.tickCount}, node ${node.out.perTick.length}`);

    // ⛔ THE ROW ITSELF: the held-key set, tick for tick. Compared as the
    // key arrays the solver emitted, in the solver's own order — not
    // sorted, not normalised, because a page that produced the same keys
    // in a different order produced a different tape.
    const nodeKeys = node.out.perTick.map((s) => [...s]);
    const same = JSON.stringify(nodeKeys) === JSON.stringify(web.perTick);
    let firstDiff = '';
    if (!same) {
        const n = Math.max(nodeKeys.length, web.perTick.length);
        for (let i = 0; i < n; i++) {
            if (JSON.stringify(nodeKeys[i]) !== JSON.stringify(web.perTick[i])) {
                firstDiff = ` — first difference at tick ${i}: node `
                    + `${JSON.stringify(nodeKeys[i])} vs page ${JSON.stringify(web.perTick[i])}`;
                break;
            }
        }
    }
    check(same, 'perTick is BYTE-IDENTICAL between the page and the runner',
        same ? `${nodeKeys.length} ticks` : `⛔ THE PAGE BUILT A DIFFERENT WORLD${firstDiff}`);

    // …and the fold the page would hand to the scrubber.
    check(JSON.stringify(node.tape.inputs) === JSON.stringify(web.inputs),
        'the folded input spans are byte-identical',
        `${node.tape.inputs.length} span(s)`);

    // The datum the deferred live-mode ruling turns on (⚖ kickoff §1.2).
    console.log(`\n## IN-PAGE SOLVE LATENCY: ${web.solveMs} ms `
        + `(${web.tickCount} ticks; node ${node.ms} ms on the same machine)`);
}

check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');

await browser.close();
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
