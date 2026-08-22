#!/usr/bin/env node
/**
 * check-seedling-editor-lanes — THE EDITOR ARC SLICE 8 ACCEPTANCE ROW.
 *
 * Two questions, in a real browser, about the two page features slice 8's
 * engine work rode in on:
 *
 *   1. Does the page DRAW the armed arrow traps' LANES — the layer slice 6
 *      refused (§14.4a) for want of an adapter that now exists?
 *   2. When the `hitboxes` layer draws NOTHING, does the page say WHICH
 *      nothing — and does it stay QUIET when there is nothing to explain?
 *
 * ── ⛔ WHAT MAKES THESE ROWS NON-VACUOUS ──────────────────────────────
 *
 * The sibling rows' law, unchanged: nothing here asserts on a derivation's
 * return value, on a checkbox or on the roster. Every row reads
 * `window.__editorOverlays.drawn`, which the RENDERER fills in INSIDE its own
 * `if (on.has(…))` arms, so a layer whose maths is perfect and whose draw
 * call is behind the wrong key reports EMPTY here.
 *
 * ⛓⛓⛓ AND EVERY ABSENCE IS ASSERTED AS A PAIR. An empty layer means two
 * things (trap 196) and that is the whole subject of this slice, so a row
 * that only showed the empty case would be the defect wearing the check's
 * clothes:
 *
 *   L8  (`r8-solve-8`)  — 0 hitboxes drawn, 2 in the census, room REFUSED
 *   L4  (`r7-act2-4`)   — 1 drawn, 1 in the census, and `why` is NULL
 *
 * ⚠ WHY L8/L4 AND NOT THE SURVEY'S L14/L16 PAIR. §15.6's driven case is
 * L16 (0 of 9) against L14 (6 of 6), and no committed tape BOOTS in either
 * room — the survey reached them through its own generated boots, which are
 * gitignored. A browser row standing on a regenerable artifact is a row that
 * skips the day nobody regenerates it, so this one uses committed tapes in
 * the two rooms that carry the same pair of facts. The L14/L16 numbers are
 * re-measured in `watchOverlays.test.js`, from the run, in CI.
 *
 * ⚠ THE LANE TICK IS MEASURED, NOT CHOSEN (§14.6's lesson, and trap 169 is
 * live on this roster): L8's trap is presser-driven, so the row SCRUBS and
 * asks the page for the first tick it drew a lane on, rather than naming one
 * that would quietly become "some frame" the day a solve drifted.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * its siblings — `export-seedling-view.mjs` is the arc's non-skipping browser
 * gate and `probe-seedling-watch-page --strict` the addressable refusal.
 *
 * Run: node scripts/procgen/check-seedling-editor-lanes.mjs
 *      node scripts/procgen/check-seedling-editor-lanes.mjs --host=http://localhost:8007
 *      node scripts/procgen/check-seedling-editor-lanes.mjs --shot=/tmp/shots
 */

/** ⚠ `@playwright/test`, not `playwright` — slice 1's note. */
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

/** Slice 2 §9.4's rule: the ONE expected 404 class, filtered by URL SHAPE. */
const unexpectedErrors = (errors) =>
    errors.filter((e) => !/fixtures\/traces\/[^\s\]]+\.trace\.json/.test(e));

const alive = await fetch(`${HOST}/${TAPES}/index.json`)
    .then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}
if (SHOT) mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch();

async function open(name, tick, extra = '') {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?tape=${TAPES}/${name}.json&side=js&tick=${tick}${extra}`,
    { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorOverlays, null, { timeout: 180000 });
    return { page, errors };
}

const readout = (page) => page.evaluate(() => ({
    drawn: window.__editorOverlays.drawn,
    census: window.__editorOverlays.census,
    channels: window.__editorOverlays.channels,
    cursor: Number(document.getElementById('scrub').value),
    legend: [...document.querySelectorAll('#legend .sw')].map((s) => s.textContent),
    toggles: [...document.querySelectorAll('#layers input')].map(
        (i) => [i.id.replace(/^layer-/, ''), i.checked]),
}));

async function at(name, tick, extra = '') {
    const { page, errors } = await open(name, tick, extra);
    const out = await readout(page);
    if (SHOT) {
        await page.locator('#canvas').screenshot(
            { path: `${SHOT}/${name}-t${tick}${extra ? '-x' : ''}-canvas.png` });
    }
    await page.close();
    return { ...out, errors };
}

// ── 1. THE `why` CHANNEL — THE REFUSED ROOM AND ITS CONTROL ─────────────
console.log('## r8-solve-8 (L8) @ tick 0 — a room that draws nothing, and says which nothing');
{
    const a = await at('r8-solve-8', 0);
    check(a.drawn.hitboxes.boxes.length === 0,
        'the hitboxes layer drew NOTHING',
        `${a.drawn.hitboxes.boxes.length} box(es)`);
    // ⛔ THE POPULATION COUNT, from the page's own census readout — trap 196:
    // never read an absence without it. "Nothing drawn" is only interesting
    // beside "and there are bodies here".
    check(a.census && a.census.enemies === 2 && a.census.stepped === false,
        '⛓ …while the page reports TWO census bodies standing in it, and a REFUSED roster',
        `enemies=${a.census?.enemies}, stepped=${a.census?.stepped}`);
    check(/^room refused: 2 census bod\(ies\)/.test(a.drawn.hitboxes.why ?? ''),
        '⛓⛓⛓ …and the layer NAMES the reason, with the count in it',
        (a.drawn.hitboxes.why ?? '(none)').slice(0, 120));
    // ⛓ THE ENGINE'S OWN WORDS. A paraphrase would be a second spelling of
    // the reason, and the reason is the entire content of the channel.
    check(/arrow trap\(s\)/.test(a.drawn.hitboxes.why ?? '')
        && /static "Enemy" bod\(ies\)/.test(a.drawn.hitboxes.why ?? ''),
    '⛓ …in `chaserRoomVerdict`\'s OWN words, carried through verbatim',
    (a.drawn.hitboxes.why ?? '').slice(-90));
    check(unexpectedErrors(a.errors).length === 0, 'no page errors',
        unexpectedErrors(a.errors).join(' | ') || 'clean');
}

console.log('\n## …and r7-act2-4 (L4), the control that makes that row mean something');
{
    const b = await at('r8-solve-4', 0);
    check(b.drawn.hitboxes.boxes.length === 1 && b.census.enemies === 1,
        '⛓ ONE census body, and the page DREW it — 1 of 1',
        `${b.drawn.hitboxes.boxes.length} drawn / ${b.census.enemies} census`);
    // ⛔ THE HALF THAT STOPS THE CHANNEL BEING NOISE. A `why` printed on
    // every room would pass every check above and mean nothing.
    check(b.drawn.hitboxes.why === null,
        '⛔⛓ …and `why` is NULL — a room with nothing to explain explains nothing',
        `why=${b.drawn.hitboxes.why ?? 'null'}`);
    check(b.census.stepped === true,
        '⛓ …because THIS room\'s roster is stepped',
        `stepped=${b.census.stepped}`);
    check(unexpectedErrors(b.errors).length === 0, 'no page errors',
        unexpectedErrors(b.errors).join(' | ') || 'clean');
}

// ── 2. THE LANES LAYER — DRAWN, AND MEASURED RATHER THAN CHOSEN ─────────
console.log('\n## r8-solve-8 — the armed trap\'s LANE, at the tick the page itself first drew one');
{
    const { page, errors } = await open('r8-solve-8', 0);
    const before = await readout(page);
    check(before.drawn.lanes.lanes.length === 0
        && /1 arrow trap\(s\) stand here and NONE is armed/.test(before.drawn.lanes.why ?? ''),
    '⛓ at tick 0 the trap is UNARMED, and the layer says so rather than being blank',
    (before.drawn.lanes.why ?? '(none)').slice(0, 100));

    // ⚠ MEASURED: scrub and ask the page for the first tick it drew a lane.
    const found = await page.evaluate(() => {
        const s = document.getElementById('scrub');
        const max = Number(s.max);
        for (let t = 0; t <= max; t += 1) {
            s.value = String(t);
            s.dispatchEvent(new Event('input'));
            const l = window.__editorOverlays.drawn.lanes;
            if (l.lanes.length > 0) return { tick: t, lanes: l.lanes, why: l.why };
        }
        return null;
    });
    check(found !== null, '⛓⛓⛓ the page DRAWS a lane once the presser arms the trap',
        found ? `first at tick ${found.tick}, ${found.lanes.length} lane(s)` : 'never drawn');
    check(found !== null && found.why === null,
        '⛓ …and stops explaining itself the moment it has something to draw',
        `why=${found?.why ?? 'null'}`);
    // ⛔ THE GEOMETRY IS THE TRAP'S, not a page literal: a lane starts at the
    // trap's spawn row and runs to the level's floor. A layer that drew a
    // tile-sized box would satisfy every count above.
    const lane = found?.lanes?.[0];
    check(Boolean(lane) && lane.rect.h > 32 && lane.rect.w > 0 && lane.rect.w <= 16,
        '⛓⛓ …and the lane is a COLUMN — narrow, and running down the room',
        lane ? `${lane.rect.w}x${lane.rect.h} at (${lane.rect.x},${lane.rect.y})` : 'none');
    check(Boolean(lane) && /^arrowtrap@/.test(lane.id),
        '⛓ …carrying the TRAP\'s own id, so the lane names what armed it',
        lane?.id ?? 'none');

    const after = await readout(page);
    check(after.channels.lanes && after.channels.lanes.bodies === 1,
        '⛓ the walk\'s lane channel names exactly one trap across the whole tape',
        JSON.stringify(after.channels.lanes));
    if (SHOT && found) {
        await page.evaluate((t) => {
            const s = document.getElementById('scrub');
            s.value = String(t); s.dispatchEvent(new Event('input'));
        }, found.tick);
        await page.locator('#canvas').screenshot({ path: `${SHOT}/r8-solve-8-lane-armed.png` });
    }
    check(unexpectedErrors(errors).length === 0, 'no page errors',
        unexpectedErrors(errors).join(' | ') || 'clean');
    await page.close();
}

// ── 3. LANES ARE NOT ARROWS, AND THE LAYER IS REALLY A LAYER ────────────
console.log('\n## the layer as a LAYER — legend, defaults, and OFF really is off');
{
    const all = await at('r8-solve-8', 0);
    const ids = all.toggles.map(([id]) => id);
    check(ids.includes('lanes') && all.toggles.length === 15,
        '⛓ `lanes` has a toggle, generated from the roster — FIFTEEN now',
        `${all.toggles.length}: ${ids.join(', ')}`);
    // ⛔ THE DISTINCTION, ON THE PAGE AND NOT ONLY IN THE DOCS. `arrows` is
    // the sampled FLIGHTS and defaults OFF; `lanes` is the trap's GEOMETRY
    // and defaults ON. A legend that said "arrow" twice would be the blur.
    const lanes = all.toggles.find(([id]) => id === 'lanes');
    const arrows = all.toggles.find(([id]) => id === 'arrows');
    check(lanes[1] === true && arrows[1] === false,
        '⛓⛓ lanes ON by default, arrow PATHS still OFF — two layers, two defaults',
        `lanes=${lanes[1]} arrows=${arrows[1]}`);
    check(all.legend.some((t) => /LANE \(the column, not the flights\)/.test(t)),
        '⛓ …and a LEGEND ROW that says which is which',
        all.legend.filter((t) => /lane|arrow/i.test(t)).join(' · '));

    // ⛔ THE DRIVEN-SYSTEM CHECK: a layer left out of `?layers=` must draw
    // nothing AT THE RENDERER — not merely be unticked.
    const off = await at('r8-solve-8', 0, '&layers=player,hitboxes');
    check(off.drawn.lanes.lanes.length === 0 && off.drawn.lanes.why === null,
        '⛔ `lanes` left out of ?layers= draws NOTHING and reports NOTHING — the arm never ran',
        `${off.drawn.lanes.lanes.length} lane(s), why=${off.drawn.lanes.why ?? 'null'}`);
    // ⛓ …and the check is not vacuous: the layer that WAS named still reports.
    check(off.drawn.hitboxes.why !== null,
        '⛓ …while `hitboxes`, which WAS named, still explains itself',
        (off.drawn.hitboxes.why ?? 'null').slice(0, 60));
    check(unexpectedErrors([...all.errors, ...off.errors]).length === 0, 'no page errors',
        unexpectedErrors([...all.errors, ...off.errors]).join(' | ') || 'clean');
}

await browser.close();
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
