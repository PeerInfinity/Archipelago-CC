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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ ⚖ WATCH-PAGE ITEMS (v) AND (iv) — THE FIRST PAINT SHOWS THE BODIES
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ The user, 2026-08-22: (v) *"the page does not draw the ENEMIES on the
 * first draw when a level is selected in solve mode"* and (iv) *"the JS UI
 * does not DRAW SAND TRAPS"*.
 *
 * ⛔ ONE ROOM ANSWERS BOTH, AND THAT IS WHY L6 IS THE SUBJECT. It holds TWO
 * bridged `bob`s — live bodies the run steps, which item (v) is about — and
 * FOUR `sandtrap`s — static `"Enemy"` census rows the run never steps, which
 * item (iv) is about. The two halves come from different sources and fail
 * independently, so they are two rows, and a build with item (v) and without
 * item (iv) sees two bobs and ZERO sandtraps. That is the measurement that
 * they are two changes.
 *
 * ⛔ READ OFF THE PUBLISHED DRAW MANIFEST, NOT OFF PIXELS. `__editorStill.
 * drawn` is what the renderer's LAST `draw` actually put on the canvas — a
 * check that recomputed the boxes would agree with a renderer that drew none.
 *
 * ⛔ AND BEFORE ANY PRESS. The whole defect was that the bodies appeared only
 * once something drove the run; a row taken after a press could not see it.
 */
{
    const L6 = `${HOST}/frontend/modules/seedlingDemo/watch.html?source=solve&level=6`;
    await page.goto(L6, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorStill !== undefined,
        null, { timeout: 180000 });
    const still = await page.evaluate(() => (window.__editorStill ? {
        level: window.__editorStill.level,
        samples: window.__editorStill.samples,
        hitboxes: window.__editorStill.drawn.hitboxes.boxes
            .map((b) => `${b.tag ?? b.kind}@${b.rect.x},${b.rect.y}`).sort(),
        hitboxWhy: window.__editorStill.drawn.hitboxes.why,
        statics: window.__editorStill.drawn.staticEnemies.boxes
            .map((b) => `${b.tag}@${b.rect.x},${b.rect.y}`).sort(),
        staticWhy: window.__editorStill.drawn.staticEnemies.why,
        staticReading: window.__editorStill.drawn.staticEnemies.reading,
    } : null));
    check(still !== null && still.level === 6,
        '⛓ the still frame is L6 and it published what it drew',
        JSON.stringify(still && { level: still.level, samples: still.samples }));
    /**
     * ⛔ THE BODIES ARE NAMED, NOT COUNTED. A count cannot tell a swap from a
     * match (trap 565) and here the risk is precisely a mix-up between the two
     * families — two sandtraps drawn as bobs would satisfy any count.
     */
    check(still?.hitboxes.length === 2
        && still.hitboxes.every((b) => b.startsWith('bob@')),
    '⛓⛓⛓ ⚖ ITEM (v): the FIRST PAINT in solve mode carries L6\'s TWO live `bob` bodies — '
        + 'before any press, from the run the still frame already held',
    JSON.stringify(still?.hitboxes));
    /**
     * ⛔ AND THE FOUR SANDTRAPS, FROM THE OTHER SOURCE. Named, not counted, and
     * for a sharper reason than usual: the two families are drawn from
     * DIFFERENT channels, so a build that mixed them up — a bob priced as a
     * placement, or a sandtrap sampled as live — would satisfy "six boxes" and
     * fail this.
     */
    check(still?.statics.length === 4
        && still.statics.every((b) => b.startsWith('sandtrap@')),
    '⛓⛓⛓ ⚖ ITEM (iv): …and L6\'s FOUR `sandtrap`s, at their census `contactRect`s — bodies '
        + 'that were in NO layer this page had: not a tile, not an object solid, not a '
        + 'pixelmask, not a bridged chaser',
    JSON.stringify(still?.statics));
    /**
     * ⛔ THE TWO SETS ARE DISJOINT, which is the row that says the partition
     * really partitions. A body drawn in BOTH channels would be painted twice
     * and would be told two different stories about where it is.
     */
    check(still !== null
        && still.statics.every((b) => !still.hitboxes.includes(b)),
    '⛓⛓ …and the two sets are DISJOINT — the run\'s own verdict partitions them, so nothing '
        + 'is drawn as a live body AND as a placement',
    `live ${JSON.stringify(still?.hitboxes)} vs static ${JSON.stringify(still?.statics)}`);
    /**
     * ⛔ AND THE READING IS NAMED. A placement is not a position; the layer has
     * to say which it is showing, or the reader takes a spawn cell for a body's
     * current whereabouts.
     */
    check(typeof still?.staticReading === 'string' && still.staticReading.length > 0,
        '…and the layer NAMES its reading — a PLACEMENT is not a position, and the readout '
        + 'says which this is',
        JSON.stringify(still?.staticReading));
}

check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');

await browser.close();
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
