#!/usr/bin/env node
/**
 * check-seedling-editor-world — THE EDITOR ARC SLICE 9 ACCEPTANCE ROW.
 *
 * Three questions, in a real browser, about the three layers slice 9 added
 * (kickoff §12b item 8(c) + ⚖ item 9):
 *
 *   1. Does the page MARK what the run has changed over the build-time world
 *      — and does it MARK rather than repaint, so a reader can still see the
 *      stale box the mark is about?
 *   2. Does it draw the CRUSHERS at last — the `frames[].crushers` /
 *      `frames[].crusherScans` forward that has ridden on every frame since
 *      R5 slice 16 and was read by nobody (§14.4b)?
 *   3. ⚖ Does the DANGER layer draw what the SOLVER RECORDED on a solve, and
 *      report its own absence BY NAME on a replay — default OFF, never
 *      recomputed?
 *
 * ── ⛔ WHAT MAKES THESE ROWS NON-VACUOUS ──────────────────────────────
 *
 * The sibling rows' law, unchanged: nothing here asserts on a derivation's
 * return value, on a checkbox or on the roster. Every row reads
 * `window.__editorOverlays.drawn`, which the RENDERER fills in INSIDE its own
 * `if (on.has(…))` arms — so a layer whose maths is perfect and whose draw
 * call sits behind the wrong key reports EMPTY here.
 *
 * ⛔⛔ AND THIS ROW IS THE ONLY THING THAT EXERCISES `get drawn()`. Slice 8's
 * own defect (§16.5) was a copier that still spread a changed shape as a bare
 * array: every module test was green and the page would not load. All three
 * of this slice's layers are `{…, why}` PAIRS, and the accessor that copies
 * them is DOM-side, so these rows are the only place the shape is chased into
 * it (trap 198).
 *
 * ⛓⛓⛓ EVERY ABSENCE IS ASSERTED AS A PAIR. An empty layer means two things
 * (trap 196):
 *
 *   L11 (`r7-act2-11`) — tick 0: NO mark, and the reason names the ONE chest
 *                        standing there; tick 6: the chest marked GONE
 *   L40 (`r5-l40-part0`) — a mark that is true from tick 0, because the base
 *                        picture draws a LIVE ice turret as a wall and it is
 *                        not one
 *   L41 (`r5-l41-part3`) — a crusher drawn where the RUN has it, its four
 *                        trigger lanes, and at t300 a SHIELDED one
 *   L4  (`r7-act2-4`)  — solved in page: the danger the bot was told, at the
 *                        ticks it asked; and the same page on REPLAY saying
 *                        "no solver ran" by name
 *
 * ⚠ THE CHANGE TICK IS MEASURED, NOT CHOSEN (trap 169 is live on this
 * roster): the row scrubs and asks the page for the first tick it drew a
 * world-state mark on, rather than naming one that would quietly become
 * "some frame" the day a fixture drifted.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * its siblings — `export-seedling-view.mjs` is the arc's non-skipping browser
 * gate and `probe-seedling-watch-page --strict` the addressable refusal.
 *
 * Run: node scripts/procgen/check-seedling-editor-world.mjs
 *      node scripts/procgen/check-seedling-editor-world.mjs --host=http://localhost:8007
 *      node scripts/procgen/check-seedling-editor-world.mjs --shot=/tmp/shots
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

const alive = await fetch(`${HOST}/${TAPES}/r7-act2-11.json`)
    .then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}
if (SHOT) mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch();

async function openUrl(url) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorOverlays, null, { timeout: 300000 });
    return { page, errors };
}

const open = (name, tick, extra = '') => openUrl(
    `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?tape=${TAPES}/${name}.json&side=js&tick=${tick}${extra}`);

const readout = (page) => page.evaluate(() => ({
    drawn: window.__editorOverlays.drawn,
    changeCounts: window.__editorOverlays.changeCounts,
    dangerQueries: window.__editorOverlays.dangerQueries,
    channels: window.__editorOverlays.channels,
    cursor: Number(document.getElementById('scrub').value),
    detail: document.getElementById('detail').textContent,
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

// ── 1. THE WORLD-STATE LAYER — THE PAIR, AND THE TICK IS MEASURED ───────
console.log('## r7-act2-11 (L11) — one chest, drawn shut at tick 0 and MARKED at the tick it opens');
{
    const { page, errors } = await open('r7-act2-11', 0);
    const before = await readout(page);
    check(before.drawn.worldstate.changes.length === 0,
        'at tick 0 the layer marks NOTHING',
        `${before.drawn.worldstate.changes.length} mark(s)`);
    // ⛔ THE POPULATION COUNT, from the page's own readout — trap 196: never
    // read an absence without it. "Nothing marked" is only meaningful beside
    // "and there IS something here that could change".
    check(before.changeCounts && before.changeCounts.placed === 1
        && before.changeCounts.byFamily.openChests === 1,
    '⛓ …while the page reports ONE changeable object standing in the room',
    JSON.stringify(before.changeCounts));
    check(/1 changeable object\(s\) stand in this room and the run has changed NONE/
        .test(before.drawn.worldstate.why ?? ''),
    '⛓⛓⛓ …and the layer NAMES which nothing it is, with the count in it',
    (before.drawn.worldstate.why ?? '(none)').slice(0, 110));

    // ⚠ MEASURED: scrub and ask the page for the first tick it drew a mark.
    const found = await page.evaluate(() => {
        const s = document.getElementById('scrub');
        const max = Number(s.max);
        for (let t = 0; t <= max; t += 1) {
            s.value = String(t);
            s.dispatchEvent(new Event('input'));
            const w = window.__editorOverlays.drawn.worldstate;
            if (w.changes.length > 0) return { tick: t, changes: w.changes, why: w.why };
        }
        return null;
    });
    check(found !== null && found.tick === 6,
        '⛓⛓⛓ the page MARKS the chest the tick the run opens it',
        found ? `first at tick ${found.tick}, ${found.changes.length} mark(s)` : 'never marked');
    check(found !== null && found.why === null,
        '⛓ …and stops explaining itself the moment it has something to mark',
        `why=${found?.why ?? 'null'}`);
    const mark = found?.changes?.[0];
    check(Boolean(mark) && mark.id === 'chest@32,48' && mark.effect === 'gone'
        && mark.rect === null,
    '⛓⛓ …as GONE, carrying the CHEST\'s own id and no live box',
    mark ? `${mark.id} ${mark.effect} rect=${mark.rect}` : 'none');
    // ⛔⛔ THE MARK IS ON THE BOX THE LEVEL BUILT — which is what makes this a
    // MARK and not a repaint. A layer that had un-drawn the chest would have
    // no `base` to report and the reader would have no way to tell a
    // corrected picture from one that never needed correcting.
    check(Boolean(mark) && mark.base && mark.base.x === 32 && mark.base.y === 48
        && mark.base.right === 48 && mark.base.bottom === 64,
    '⛔⛔ …drawn ON the build-time box, which is still there to be marked',
    mark ? JSON.stringify(mark.base) : 'none');
    if (SHOT && found) {
        await page.locator('#canvas').screenshot({ path: `${SHOT}/r7-act2-11-chest-gone.png` });
    }
    check(unexpectedErrors(errors).length === 0, 'no page errors',
        unexpectedErrors(errors).join(' | ') || 'clean');
    await page.close();
}

// ── 2. THE INVERTED POLARITY — a wall the base draws and the run has not ─
console.log('\n## r5-l40-part0 (L40) — the ice turret: drawn as a wall, and it is not one');
{
    const a = await at('r5-l40-part0', 0);
    const turret = a.drawn.worldstate.changes.find((c) => c.family === 'turrets');
    check(Boolean(turret) && turret.effect === 'notsolid',
        '⛓⛓⛓ at TICK 0 — before the run has changed anything — the page marks a live turret',
        turret ? `${turret.id} ${turret.effect}` : 'no turret mark');
    check(Boolean(turret) && /ALIVE/.test(turret.verb),
        '⛓ …and says WHY in the family\'s own vocabulary: an ice turret is an Enemy',
        turret?.verb ?? 'none');
    // ⛓ THE ROOM'S POPULATION across all six families, so the single mark is
    // legible as one of sixteen rather than as "the layer found one thing".
    check(a.changeCounts && a.changeCounts.placed === 16
        && a.changeCounts.byFamily.brokenRocks === 3,
    '⛓ …in a room the page counts SIXTEEN changeable objects in, three of them rocks',
    JSON.stringify(a.changeCounts.byFamily));
    check(a.drawn.worldstate.why === null,
        '⛔ …and `why` is NULL — a layer with something to draw explains nothing',
        `why=${a.drawn.worldstate.why ?? 'null'}`);
    check(unexpectedErrors(a.errors).length === 0, 'no page errors',
        unexpectedErrors(a.errors).join(' | ') || 'clean');
}

// ── 3. THE CRUSHERS — the R5 forward, drawn at last ─────────────────────
console.log('\n## r5-l41-part3 (L41) — the crusher forward gets its reader');
{
    const a = await at('r5-l41-part3', 0);
    const c = a.drawn.crushers.crushers[0];
    check(a.drawn.crushers.crushers.length === 1 && a.drawn.crushers.why === null,
        '⛓⛓⛓ the page DRAWS the room\'s crusher, from the frame\'s own forward',
        c ? `${c.id} at (${c.x},${c.y})` : 'none drawn');
    check(Boolean(c) && c.lanes.length === 4,
        '⛓ …with all FOUR trigger lanes, the ones `scanCrusher` itself walks',
        c ? c.lanes.map((l) => l.dir).join(',') : 'none');
    // ⛔ THE LIVE LANE IS THE RUN'S OWN VERDICT, not a page-side geometry
    // test: `matched` comes off `crusherScans`, and a layer that re-tested
    // the player box against the rects would be a second scanner.
    check(Boolean(c) && c.live.length === 1 && c.live[0] === 'W',
        '⛓⛓ …and exactly the lane the RUN\'s own scan matched is live',
        c ? `live=[${c.live.join(',')}]` : 'none');

    const late = await at('r5-l41-part3', 300);
    const c2 = late.drawn.crushers.crushers[0];
    check(Boolean(c2) && (c2.rect.x !== c.rect.x || c2.rect.y !== c.rect.y),
        '⛓⛓⛓ …and by tick 300 the BODY HAS MOVED — which is why the base picture cannot be trusted',
        c2 ? `t0 (${c.rect.x},${c.rect.y}) → t300 (${c2.rect.x},${c2.rect.y})` : 'none');
    // ⛔ AN EARLY EXIT IS A DIFFERENT PICTURE FROM "SEES NOTHING". A shielded
    // crusher never walks a lane at all, so an empty `live` here has nothing
    // to do with where the player is standing — and the readout says which.
    check(Boolean(c2) && c2.shieldedBy === 'tile:Blue Wall' && c2.live.length === 0,
        '⛔ …and a SHIELDED crusher says so by name, rather than reporting "sees nothing"',
        c2 ? `shieldedBy=${c2.shieldedBy}, live=[${c2.live.join(',')}]` : 'none');
    if (SHOT) { /* the canvas shots are taken by `at` above */ }
    check(unexpectedErrors(a.errors).length === 0 && unexpectedErrors(late.errors).length === 0,
        'no page errors',
        [...unexpectedErrors(a.errors), ...unexpectedErrors(late.errors)].join(' | ') || 'clean');
}

// ── 4. ⚖ THE DANGER LAYER — ITS FOUR CONDITIONS, ON THE PAGE ────────────
console.log('\n## ⚖ item 9 — the danger the SOLVER was told, and the absence NAMED on replay');
{
    // (a) DEFAULT OFF, and "off" means the arm never ran — not merely that a
    //     checkbox is unticked. The pair is what makes the row non-vacuous.
    const def = await at('r7-act2-11', 0);
    const danger = def.toggles.find(([id]) => id === 'danger');
    check(Boolean(danger) && danger[1] === false,
        '⚖ `danger` has a toggle and defaults OFF — the ruling\'s own condition',
        `danger=${danger?.[1]}`);
    check(def.drawn.danger.queries.length === 0 && def.drawn.danger.why === null,
        '⛔ …and OFF means the draw arm never ran: no queries AND no reason',
        `${def.drawn.danger.queries.length} query(s), why=${def.drawn.danger.why ?? 'null'}`);

    // (b) SWITCHED ON over a REPLAY: the absence is reported BY NAME and the
    //     page does not recompute a single thing.
    const on = await at('r7-act2-11', 0, '&layers=player,danger');
    check(/^no solver ran — no danger data/.test(on.drawn.danger.why ?? ''),
        '⚖⚖ switched ON over a REPLAY, the layer says "no solver ran — no danger data"',
        (on.drawn.danger.why ?? '(none)').slice(0, 90));
    check(/a window, not a third opinion/.test(on.drawn.danger.why ?? ''),
        '⛔ …and says WHY it will not simply compute it — the standing law, quoted',
        (on.drawn.danger.why ?? '').slice(-60));
    check(on.dangerQueries === null,
        '⛓ …with the page\'s own readout agreeing there is no record at all, not an empty one',
        `dangerQueries=${JSON.stringify(on.dangerQueries)}`);
    check(unexpectedErrors(on.errors).length === 0, 'no page errors',
        unexpectedErrors(on.errors).join(' | ') || 'clean');
}

console.log('\n## …and the SOLVE that gives it something to draw (L4, in page)');
{
    const BOOT = `${TAPES}/r7-act2-4.json`;
    const { page, errors } = await openUrl(
        `${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?level=4&boot=${BOOT}&goals=${encodeURIComponent('exit:64,16')}&solve=1`
        + '&name=slice9-L4&layers=player,danger');
    const solved = await readout(page);
    check(typeof solved.dangerQueries === 'number' && solved.dangerQueries > 0,
        '⛓⛓⛓ an in-page SOLVE carries its OWN danger record into the replay',
        `${solved.dangerQueries} recorded query(s)`);

    // ⚠ MEASURED, NOT CHOSEN: the bot asks at DECISION points, so the row
    // scrubs and asks the page for the first tick it drew one.
    const found = await page.evaluate(() => {
        const s = document.getElementById('scrub');
        const max = Number(s.max);
        for (let t = 0; t <= max; t += 1) {
            s.value = String(t);
            s.dispatchEvent(new Event('input'));
            const d = window.__editorOverlays.drawn.danger;
            if (d.queries.length > 0) return { tick: t, queries: d.queries, why: d.why };
        }
        return null;
    });
    check(found !== null,
        '⛓⛓ the page DRAWS the boxes the solver asked about',
        found ? `first at tick ${found.tick}, ${found.queries.length} query(s)` : 'never drawn');
    const q = found?.queries?.[0];
    // ⛔ THE BOX IS `playerBoxAt`'s — the very builder the solver's own probe
    // used. A rect assembled page-side from `(x, y)` without `right`/`bottom`
    // would never overlap anything and would look perfectly fine on screen.
    check(Boolean(q) && Number.isFinite(q.box?.right) && Number.isFinite(q.box?.bottom),
        '⛓ …at the ENGINE\'s own player box, `right`/`bottom` and all',
        q ? JSON.stringify(q.box) : 'none');
    check(Boolean(q) && ['sense', 'gate'].includes(q.where) && q.runTick >= q.tick,
        '⛓ …carrying WHERE the bot asked and BOTH clocks — the tape\'s and the run\'s',
        q ? `${q.where} tick=${q.tick} runTick=${q.runTick}` : 'none');
    /**
     * ⛓⛓⛓ THE SLICE'S FINDING, ON THE PAGE: every query a SUCCESSFUL segment
     * records is CLEAR, and that is a theorem rather than an accident —
     * `refuseDanger` THROWS when the union answers danger, so a segment that
     * reaches its goal cannot have had a dangerous gate. The layer's danger
     * ink is the colour of a refusal.
     */
    const anyDanger = await page.evaluate(() => {
        const s = document.getElementById('scrub');
        const max = Number(s.max);
        let hot = 0;
        let seen = 0;
        for (let t = 0; t <= max; t += 1) {
            s.value = String(t);
            s.dispatchEvent(new Event('input'));
            for (const d of window.__editorOverlays.drawn.danger.queries) {
                seen += 1;
                if (d.danger) hot += 1;
            }
        }
        return { seen, hot };
    });
    check(anyDanger.seen > 0 && anyDanger.hot === 0,
        '⛓⛓⛓ …and EVERY box this solve was told about is CLEAR — the purple is a refusal\'s colour',
        `${anyDanger.seen} drawn over the walk, ${anyDanger.hot} dangerous`);
    if (SHOT && found) {
        await page.evaluate((t) => {
            const s = document.getElementById('scrub');
            s.value = String(t); s.dispatchEvent(new Event('input'));
        }, found.tick);
        await page.locator('#canvas').screenshot({ path: `${SHOT}/slice9-L4-danger.png` });
    }
    check(unexpectedErrors(errors).length === 0, 'no page errors',
        unexpectedErrors(errors).join(' | ') || 'clean');
    await page.close();
}

// ── 5. THE THREE AS LAYERS — roster, legend, and OFF really is off ──────
console.log('\n## the three as LAYERS — legend, defaults, and the driven-system check');
{
    const all = await at('r5-l40-part0', 0);
    const ids = all.toggles.map(([id]) => id);
    check(ids.includes('worldstate') && ids.includes('crushers') && ids.includes('danger')
        && all.toggles.length === 15,
    '⛓ all three have a toggle, generated from the roster — FIFTEEN now',
    `${all.toggles.length}: ${ids.join(', ')}`);
    const byId = (id) => all.toggles.find(([i]) => i === id)?.[1];
    check(byId('worldstate') === true && byId('crushers') === true && byId('danger') === false,
        '⚖⚖ two ON (the base picture is KNOWN stale) and the OPINION one OFF',
        `worldstate=${byId('worldstate')} crushers=${byId('crushers')} danger=${byId('danger')}`);
    // ⛔ SIX LEGEND ROWS FOR THREE LAYERS, because three of the strokes are
    // CORRECTIONS to the base and a reader who cannot tell a correction from
    // a fact has the picture's distinction and not the legend's.
    check(all.legend.some((t) => /GONE/.test(t))
        && all.legend.some((t) => /REALLY there now/.test(t))
        && all.legend.some((t) => /drawn as a wall and NOT one/.test(t))
        && all.legend.some((t) => /crusher body/.test(t))
        && all.legend.some((t) => /trigger lane/.test(t))
        && all.legend.some((t) => /HEURISTIC, not what happened/.test(t)),
    '⛓ …and SIX legend rows that say which stroke means what',
    `${all.legend.length} legend entr(ies)`);

    // ⛔ THE DRIVEN-SYSTEM CHECK: a layer left out of `?layers=` must draw
    // nothing AT THE RENDERER — not merely be unticked.
    const off = await at('r5-l40-part0', 0, '&layers=player,crushers');
    check(off.drawn.worldstate.changes.length === 0 && off.drawn.worldstate.why === null,
        '⛔ `worldstate` left out of ?layers= draws NOTHING and reports NOTHING — the arm never ran',
        `${off.drawn.worldstate.changes.length} mark(s), why=${off.drawn.worldstate.why ?? 'null'}`);
    // ⛓ …and the check is not vacuous: the layer that WAS named still reports.
    check(off.drawn.crushers.why !== null,
        '⛓ …while `crushers`, which WAS named, still explains itself',
        (off.drawn.crushers.why ?? 'null').slice(0, 60));
    check(unexpectedErrors(all.errors).length === 0 && unexpectedErrors(off.errors).length === 0,
        'no page errors',
        [...unexpectedErrors(all.errors), ...unexpectedErrors(off.errors)].join(' | ') || 'clean');
}

await browser.close();
console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
