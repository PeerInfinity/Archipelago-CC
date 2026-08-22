#!/usr/bin/env node
/**
 * check-seedling-editor-refusal — THE EDITOR ARC SLICE 10 ACCEPTANCE ROW.
 *
 * Two questions, in a real browser, about ⚖ kickoff §12d:
 *
 *   1. **item 10's first move.** When the solver REFUSES, does the page show
 *      the danger record the bot was actually handed — and does it tell the
 *      three different answers apart? Slice 9 measured that across 30 solves
 *      of 9 committed blocks NOT ONE recorded query came back dangerous
 *      (§17.5), which is a theorem rather than an accident: `refuseDanger`
 *      THROWS when the union answers danger, so a segment that reaches its
 *      goal cannot have had a dangerous gate. The interesting half of that
 *      channel therefore lives on the REFUSAL path, and nothing read it until
 *      this slice.
 *   2. **item 11.** Does the L11 crossing — the survey's step 11, REFUSED
 *      since the survey was written because `solid:chest` had no
 *      `OBSTACLE_STRATEGIES` row — now SOLVE by COLLECTING the chest, with
 *      the world-state layer marking that chest GONE?
 *
 * ── ⛔ WHAT MAKES THESE ROWS NON-VACUOUS ──────────────────────────────
 *
 * ⛓⛓⛓ **EVERY ABSENCE IS ASSERTED AS A PAIR** (the sibling rows' law since
 * slice 8, trap 196). There are THREE answers here and a row that collapsed
 * them would report a calm walk for a refusal nobody recorded:
 *
 *   `dangerQueries: n`    the bot WAS told things (L16's exhausted climb),
 *   `dangerousQueries: 0` and every one of them said CLEAR;
 *   `dangerQueries: 0`    the recorder RAN and the bot asked nothing (an
 *                         absent placement, refused at the door);
 *   `dangerQueries: null` there is NO RECORD — the throw is not a
 *                         `SolverRefusal` and no recorder ever existed (an
 *                         exit the room does not have).
 *
 * So the row asserts a POSITIVE population on L16 BEFORE it asserts the zero
 * — a row that merely tolerated the emptiness would be the finding wearing a
 * check's clothes (§17.5 consequence 1).
 *
 * ⚠ AND THE BOOTS ARE THE SURVEY'S OWN staged construction, not invented
 * here: `r7-act2-11`'s committed block re-pointed by `?level=`, which is
 * exactly what `survey-seedling-route.mjs` does for a room with no committed
 * tape. `r7-act2-11` boots at (32,64) — which IS L16's arrival from L15, so
 * the page reaches the survey's step 18 with one parameter.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * its siblings — `export-seedling-view.mjs` is the arc's non-skipping browser
 * gate and `probe-seedling-watch-page --strict` the addressable refusal.
 *
 * Run: node scripts/procgen/check-seedling-editor-refusal.mjs
 *      node scripts/procgen/check-seedling-editor-refusal.mjs --host=http://localhost:8007
 *      node scripts/procgen/check-seedling-editor-refusal.mjs --shot=/tmp/shots
 */

/** ⚠ `@playwright/test`, not `playwright` — slice 1's note. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const SHOT = arg('shot', '');
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';
const BOOT = `${TAPES}/r8-solve-11.json`;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/** Slice 2 §9.4's rule: the ONE expected 404 class, filtered by URL SHAPE. */
const unexpectedErrors = (errors) =>
    errors.filter((e) => !/fixtures\/traces\/[^\s\]]+\.trace\.json/.test(e));

const alive = await fetch(`${HOST}/${TAPES}/index.json`).then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}
if (SHOT) mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch();

async function solveInPage(level, goals, extra = '', boot = BOOT) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?level=${level}&boot=${boot}&goals=${encodeURIComponent(goals)}&solve=1`
        + `&name=slice10-L${level}${extra}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorSolve, null, { timeout: 300000 });
    const out = await page.evaluate(() => ({
        solve: window.__editorSolve,
        detail: document.getElementById('detail').textContent,
        status: document.getElementById('status').textContent,
    }));
    return { page, errors, ...out };
}

// ── 1. ⚖ §12d ITEM 10 — THE DANGER RECORD ON THE REFUSAL PATH ───────────
console.log('## L16 (the survey\'s step 18) — the ladder is EXHAUSTED, and the refusal '
    + 'carries what the bot was told');
{
    const r = await solveInPage(16, 'exit:352,80');
    check(r.solve.status === 'refused',
        '⛓ the page reports the solver\'s own REFUSAL, not a page error',
        `status=${r.solve.status}`);
    check(/combat ladder is EXHAUSTED/.test(r.solve.message ?? ''),
        '⛓⛓ …and it is the LADDER refusal — every rung of ⚖ §11.8a\'s order tried',
        (r.solve.message ?? '').split('\n')[0].slice(0, 100));
    // ⛔ THE POPULATION FIRST. A zero asserted without it is a check that
    // cannot tell "told nothing" from "told nothing dangerous".
    check(typeof r.solve.dangerQueries === 'number' && r.solve.dangerQueries > 0,
        '⛓⛓⛓ the REFUSAL carries the danger record — the channel slice 9 could not reach',
        `${r.solve.dangerQueries} recorded query(s)`);
    check(r.solve.dangerousQueries === 0 && r.solve.dangerSources.length === 0,
        '⛓⛓⛓ …and EVERY gate this climb reached answered CLEAR — §17.5 sharpened',
        `${r.solve.dangerousQueries} dangerous, ${r.solve.dangerSources.length} reason(s)`);
    check(/the danger the bot was told: \d+ query\(s\), 0 DANGEROUS/.test(r.detail)
        && /every gate this walk reached answered CLEAR/.test(r.detail),
        '⛔ …and the page SAYS SO on screen, not only in a readout nobody reads',
        (r.detail.match(/the danger the bot was told[^\n]*/) ?? ['(absent)'])[0].slice(0, 90));
    if (SHOT) await r.page.locator('main').screenshot({ path: `${SHOT}/slice10-L16-refusal.png` });
    check(unexpectedErrors(r.errors).length === 0, 'no page errors',
        unexpectedErrors(r.errors).join(' | ') || 'clean');
    await r.page.close();
}

/**
 * ⛓⛓⛓ AND THE OTHER TWO ANSWERS, EACH WITH A DRIVEN CASE. `n`, `0` and
 * `null` are three different facts, and a readout that could not tell them
 * apart would report a calm walk for a refusal nobody recorded.
 */
console.log('\n## the two OTHER answers — `0` (asked nothing) and `null` (no record at all)');
{
    // (a) `0` — a REAL `SolverRefusal` from the loop's own `refuse()`, raised
    //     before the walk asked anything: a placement with nothing standing
    //     on it is a macro-layer error said at the door.
    const zero = await solveInPage(11, 'place:999,999');
    check(zero.solve.status === 'refused' && /resolves to NOTHING/.test(zero.solve.message ?? ''),
        '⛓ an absent placement REFUSES by name — the macro-layer error, said at the door',
        (zero.solve.message ?? '').split('\n')[0].slice(0, 90));
    check(zero.solve.dangerQueries === 0 && zero.solve.dangerousQueries === 0,
        '⛔ …and its record is `0` — the recorder RAN and the bot asked nothing',
        `dangerQueries=${JSON.stringify(zero.solve.dangerQueries)}`);
    check(/the danger the bot was told: 0 query\(s\), 0 DANGEROUS/.test(zero.detail),
        '⛓ …and the page says so with the count in it',
        (zero.detail.match(/the danger the bot was told[^\n]*/) ?? ['(absent)'])[0].slice(0, 80));
    check(unexpectedErrors(zero.errors).length === 0, 'no page errors',
        unexpectedErrors(zero.errors).join(' | ') || 'clean');
    await zero.page.close();

    // (b) `null` — NOT a `SolverRefusal` at all. An exit the room does not
    //     have is refused before the solve loop exists, so there is no
    //     recorder and no record; `0` here would be a claim about a bot that
    //     never ran.
    const none = await solveInPage(11, 'exit:0,0');
    check(none.solve.status === 'refused',
        '⛓ an exit the room does not have REFUSES too',
        (none.solve.message ?? '').split('\n')[0].slice(0, 90));
    check(none.solve.dangerQueries === null && none.solve.dangerousQueries === null,
        '⛔⛔ …and it carries NO RECORD — `null`, which is not the same claim as `0`',
        `dangerQueries=${JSON.stringify(none.solve.dangerQueries)}`);
    check(/carries NO danger record/.test(none.detail)
        && /outside the solve loop's own recorder/.test(none.detail),
        '⛓ …and the page names WHY there is none, rather than showing an empty list',
        (none.detail.match(/carries NO danger record[^\n]*/) ?? ['(absent)'])[0].slice(0, 90));
    check(unexpectedErrors(none.errors).length === 0, 'no page errors',
        unexpectedErrors(none.errors).join(' | ') || 'clean');
    await none.page.close();
}

// ── 2. ⚖ §12d ITEM 11 — THE CHEST IS AN OBSTACLE THE WALK CLEARS ────────
console.log('\n## L11 (the survey\'s step 11) — the corridor-blocking chest is COLLECTED');
{
    const r = await solveInPage(11, 'exit:32,0', '&layers=player,worldstate');
    check(r.solve.status === 'ok',
        '⛓⛓⛓ the crossing the survey recorded as REFUSED now SOLVES',
        `status=${r.solve.status}, ${r.solve.tickCount ?? '?'} ticks`);
    check(r.solve.tickCount === 119,
        '⛓⛓ …in the SAME 119 ticks the goal-directed collect takes — one walk, two errands',
        `${r.solve.tickCount} ticks`);
    const trace = await r.page.evaluate(() => (window.__editorTrace?.rows ?? []).map((row) => ({
        tick: row.tick,
        obstacle: row.obstacle ? `${row.obstacle.kind}:${row.obstacle.id}` : null,
        verb: row.strategy?.verb ?? null,
    })));
    const chestRow = trace.find((row) => row.obstacle === 'solid:chest@32,48');
    check(Boolean(chestRow) && chestRow.verb === 'chest',
        '⛔ …and the TRACE says the chest was an OBSTACLE with the COLLECT verb selected',
        chestRow ? `tick ${chestRow.tick}: ${chestRow.obstacle} -> ${chestRow.verb}`
            : `no such row (${trace.length} row(s))`);

    /**
     * ⛓⛓⛓ THE VISUAL WITNESS, AND THE TICK IS MEASURED (trap 169 is live on
     * this roster). Slice 9's world-state layer is the instrument: a
     * collected chest IS a `gone` mark, so the page is scrubbed and ASKED for
     * the first tick it drew one. §17.7's committed-tape pair answers 6; this
     * is the SOLVER's own walk answering the same question about the same
     * chest, which is a different derivation reaching the same instant.
     */
    const marked = await r.page.evaluate(() => {
        const s = document.getElementById('scrub');
        const max = Number(s.max);
        for (let t = 0; t <= max; t += 1) {
            s.value = String(t);
            s.dispatchEvent(new Event('input'));
            const w = window.__editorOverlays.drawn.worldstate;
            if (w.changes.length > 0) return { tick: t, changes: w.changes };
        }
        return null;
    });
    check(Boolean(marked) && marked.changes[0].id === 'chest@32,48'
        && marked.changes[0].effect === 'gone',
        '⛓⛓⛓ …and the world-state layer MARKS that chest GONE on the solver\'s own walk',
        marked ? `first at tick ${marked.tick}: ${marked.changes[0].id} `
            + `${marked.changes[0].effect}` : 'never marked');
    check(Boolean(marked) && marked.tick === 6,
        '⛓⛓ …at tick 6 — the same instant `r7-act2-11`\'s committed walk opens it (§17.7)',
        marked ? `tick ${marked.tick}` : 'never');
    if (SHOT) {
        await r.page.locator('#canvas').screenshot({ path: `${SHOT}/slice10-L11-chest-gone.png` });
    }
    check(unexpectedErrors(r.errors).length === 0, 'no page errors',
        unexpectedErrors(r.errors).join(' | ') || 'clean');
    await r.page.close();
}

await browser.close();
console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
