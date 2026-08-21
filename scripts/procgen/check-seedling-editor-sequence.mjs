#!/usr/bin/env node
/**
 * check-seedling-editor-sequence — A SEQUENCE OF TAPES, ON ONE GAME STATE.
 *
 * ⚖ Ruling 10 (user, 2026-08-20): *"I want the second tape to continue from
 * the game state at the end of the first tape. I don't want it to reload a
 * fresh page."* R9 slice 2's acceptance for the JS half. The wasm half is the
 * Windows ship row's two-window plan (`check-seedling-wasm-ship.mjs`).
 *
 * ── ⛔ THE HEADLINE CLAIM, AND WHY ITS ORACLE IS OUTSIDE THE PAGE ──────
 *
 * `r8-d2` is `r8-d2-19`'s inputs then `r8-d2-20`'s, driven by ONE model run
 * over both goal lists (`solve-seedling-r8-d2-chain.mjs:207-265`) and checked
 * since by ARITHMETIC — the segments' tick counts sum, and
 * `playthroughAcceptance.chainFindings` slices the headline's stream at the
 * cut and compares each slice to its segment's own recording. ⛔ NO GAME AND
 * NO RUN HAD EVER PLAYED BOTH WINDOWS AS ONE. That is this row's subject: the
 * page queues `?tapes=r8-d2`, the two windows step ONE live run, and the
 * stream that comes out must be the headline's TICK FOR TICK.
 *
 * ⛔ THE ORACLE IS RE-DERIVED HERE, in node, with `runTapeToStream` — the same
 * function `verify-seedling-bot-differential.mjs` feeds. A digest computed in
 * the page and compared to a digest computed here would be an ECHO (trap 269):
 * two spellings of one derivation agreeing with themselves. So the row takes
 * the page's OBSERVATIONS and diffs them against a stream this process made.
 *
 * ── THE CLAIMS ────────────────────────────────────────────────────────
 *
 *  1. **THE HEADLINE EXPANDS** — `?tapes=r8-d2` is ONE member and TWO windows,
 *     and the page says which two.
 *  2. **⛓⛓⛓ THE STREAM IS THE HEADLINE'S** — 1646 observations, first
 *     differing tick −1, from ONE run.
 *  3. **…AND IT ENDS EQUAL** — the last observation and the level.
 *  4. **THE BOUNDARY HELD** — `director.streamBoundaryFindings` and
 *     `boundaryFindings` both empty over the model's own samples, and window
 *     2's declared LATCH was admitted because it MATCHES (six persistence
 *     rows, exactly the live cleared set).
 *  5. **A NON-CONTINUABLE PAIR IS REFUSED BY NAME** — `r8-d2-19,r8-solve-4`:
 *     L4 is not where the world is, the refusal says so, and it names the
 *     nearest chain the roster has.
 *  6. **A LATER WINDOW'S GRANTS ARE REFUSED AT QUEUE TIME** — before anything
 *     plays at all.
 *  7. **`?tapes=` ROUND-TRIPS** through the queue control's own writer, and
 *     an empty queue DELETES the key rather than leaving `?tapes=` behind.
 *  8. **THE SINGLE-TAPE ARM IS UNMOVED** — `?tape=` still replays one tape.
 *  9. **⛓ THE act2 REPORT** — which of the true-start chain's windows admit,
 *     and the NAME of the refusal that stops the rest. A refusal there is a
 *     finding about the roster (or about the model), not a defect in this
 *     arm, so it is REPORTED and pinned rather than asserted green.
 *
 * Run: node scripts/procgen/check-seedling-editor-sequence.mjs
 *      node scripts/procgen/check-seedling-editor-sequence.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const { runTapeToStream } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { PAGE_CHAINS } = await import(join(MODULE, 'director.js'));

const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';
const tapeOf = (n) => JSON.parse(readFileSync(join(MODULE, 'fixtures', 'tapes', `${n}.json`), 'utf8'));

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};
/** ⚠ REPORTED, NOT ASSERTED — claim 9's shape. */
const report = (what, detail) => console.log(`REPORT: ${what}${detail ? ` — ${detail}` : ''}`);

let server = null;
const host = arg('host', '');
if (!host) server = await serveRepoRoot();
const origin = host || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const finish = async (code) => {
    await browser.close().catch(() => {});
    await closeServer(server);
    process.exit(code);
};

/**
 * Land on a sequence URL and wait for the arm to have ANSWERED — either the
 * readout exists or the page went red.
 *
 * ⛔ NOT "wait for the readout to EXIST" alone (trap: a wait on a readout
 * existing reads a MID-RUN page). `__editorSequence` is published by the
 * sequence arm both when it stops and when it finishes, and a red status is
 * the other terminal state — so the condition is terminal in both directions.
 */
const land = async (query) => {
    await page.goto(`${origin}${PAGE_PATH}?${query}`);
    await page.waitForFunction(
        () => window.__editorSequence !== undefined
            || document.getElementById('status').className === 'bad',
        null, { timeout: 180000 });
    return page.evaluate(() => ({
        status: document.getElementById('status').textContent,
        cls: document.getElementById('status').className,
        detail: document.getElementById('detail').textContent,
        scrubMax: document.getElementById('scrub').max,
        queue: document.getElementById('queueList').textContent,
        seq: window.__editorSequence
            ? JSON.parse(JSON.stringify(window.__editorSequence)) : null,
    }));
};

// ══ 1–4. THE HEADLINE SUBJECT ═══════════════════════════════════════════
const got = await land('tapes=r8-d2&side=js');
if (!got.seq) {
    check(false, 'the sequence arm answered at all', `${got.status} — ${got.detail}`);
    await finish(1);
}

check(got.seq.expansions.length === 1
    && got.seq.expansions[0].from === 'r8-d2'
    && got.seq.expansions[0].to.join(',') === PAGE_CHAINS['r8-d2'].join(','),
'⛓ CLAIM 1 — the chain HEADLINE expands to its segments, and the page says which',
`asked ${JSON.stringify(got.seq.asked)} → ${got.seq.windows.length} window(s): `
    + `${got.seq.windows.map((w) => w.label).join(' → ')}`);

check(got.seq.admitted === true && got.seq.refusal === null,
    'the sequence was ADMITTED and ran',
    `${got.seq.windows.length} window(s), ${got.seq.ticks} tick(s)`);

/**
 * ⛓⛓⛓ THE ORACLE, MADE HERE. `runTapeToStream(r8-d2)` is the headline played
 * ALONE — one tape, one staged run, no windows at all.
 */
const oracle = runTapeToStream(tapeOf('r8-d2'), { levelSource: atlasLevelSource() });
const mine = got.seq.stream ?? [];
let firstDiff = -1;
for (let i = 0; i < Math.max(mine.length, oracle.ticks.length); i += 1) {
    if (JSON.stringify(mine[i]) !== JSON.stringify(oracle.ticks[i])) { firstDiff = i; break; }
}
check(mine.length === oracle.ticks.length && firstDiff === -1,
    '⛓⛓⛓ CLAIM 2 — TWO WINDOWS ON ONE GAME STATE PRODUCE THE HEADLINE STREAM, '
    + 'TICK FOR TICK',
    `page ${mine.length} observation(s) vs the headline's ${oracle.ticks.length}; `
    + `first differing tick ${firstDiff}`
    + (firstDiff >= 0 ? ` — page ${JSON.stringify(mine[firstDiff])} vs headline `
        + `${JSON.stringify(oracle.ticks[firstDiff])}` : ''));

const endMine = mine.at(-1);
const endOracle = oracle.ticks.at(-1);
check(JSON.stringify(endMine) === JSON.stringify(endOracle),
    '⛓ CLAIM 3 — …AND IT ENDS EQUAL',
    `${JSON.stringify(endMine)} vs ${JSON.stringify(endOracle)}`);

const b = (got.seq.boundaries ?? [])[0];
const refusalsAt = (f) => (f ?? []).filter((x) => !x.informational);
check(!!b && refusalsAt(b.admission).length === 0
    && (b.stream ?? []).length === 0 && (b.status ?? []).length === 0,
'⛓ CLAIM 4 — THE BOUNDARY HELD, on the director\'s own two checks',
b ? `admission refusals ${refusalsAt(b.admission).length} `
    + `(${b.admission.length} row(s), ${b.admission.filter((x) => x.informational).length} `
    + `UNASSERTED by name), streamBoundaryFindings ${(b.stream ?? []).length}, `
    + `boundaryFindings ${(b.status ?? []).length}` : 'no boundary was recorded');
check(!!b && b.live.level === 20 && b.live.ctor.x === 192 && b.live.ctor.y === 64
    && b.live.cleared.length === tapeOf('r8-d2-20').persistence.length,
'⛓⛓ …and window 2\'s declared LATCH was admitted because it MATCHES the live world',
b ? `live L${b.live.level} constructed at (${b.live.ctor.x},${b.live.ctor.y}); `
    + `${b.live.cleared.length} cleared flag(s) vs the ${tapeOf('r8-d2-20').persistence.length} `
    + 'the tape declares' : '');

check(got.scrubMax === String(oracle.ticks.length - 1),
    '⛓ …and the SCRUB SPANS THE SEQUENCE, not one window',
    `scrub max ${got.scrubMax}`);

// ══ 5. A NON-CONTINUABLE PAIR ═══════════════════════════════════════════
const bad = await land('tapes=r8-d2-19,r8-solve-4&side=js');
check(bad.cls === 'bad' && /cannot continue/.test(bad.status)
    && /the boot names a level the live world is not in/.test(bad.detail),
'⛓⛓ CLAIM 5 — A PAIR THAT CANNOT CONTINUE IS REFUSED BY NAME, never silently rebuilt',
`${bad.status} · ${bad.detail.split('\n')[0].slice(0, 200)}`);
check(/nearest continuation the roster has/.test(bad.detail),
    '…and the refusal NAMES ITS NEXT WORK ORDER — the nearest chain the roster does have',
    (bad.detail.match(/nearest continuation the roster has is [^.]*/) ?? [''])[0].slice(0, 140));

// ══ 6. GRANTS, AT QUEUE TIME ════════════════════════════════════════════
const granted = await land('tapes=r7-act2-1,r4-walk-2-feather&side=js');
check(granted.cls === 'bad' && /refused at queue time/.test(granted.status)
    && /a later window declares grants/.test(granted.detail),
'⛓ CLAIM 6 — A LATER WINDOW\'S GRANTS ARE REFUSED **BEFORE ANYTHING PLAYS**',
`${granted.status} · ${granted.detail.split('\n')[0].slice(0, 180)}`);
check((granted.seq?.windows ?? []).length === 0,
    '…and nothing was stepped: the refusal is at TIER 1, not mid-walk',
    `${(granted.seq?.windows ?? []).length} window(s) ran`);

// ══ 7. THE CODEC ROUND-TRIPS THROUGH THE PAGE'S OWN WRITER ══════════════
await page.goto(`${origin}${PAGE_PATH}?tape=frontend/modules/seedlingDemo/fixtures/tapes/`
    + 'r8-d2-19.json&side=js');
await page.waitForFunction(() => !document.getElementById('queueAdd').disabled
    && !document.getElementById('tapes').disabled, null, { timeout: 120000 });
await page.selectOption('#tapes', 'frontend/modules/seedlingDemo/fixtures/tapes/r8-d2-19.json');
await page.click('#queueAdd');
await page.selectOption('#tapes', 'frontend/modules/seedlingDemo/fixtures/tapes/r8-d2-20.json');
await page.click('#queueAdd');
const written = await page.evaluate(() => window.location.search);
check(/[?&]tapes=r8-d2-19%2Cr8-d2-20|[?&]tapes=r8-d2-19,r8-d2-20/.test(written),
    '⛓ CLAIM 7 — the queue control WRITES `?tapes=` in order, and it is a LINK',
    written);
await page.click('#queueClear');
const cleared = await page.evaluate(() => window.location.search);
check(!/tapes=/.test(cleared),
    '⛓ …and an EMPTY queue DELETES the key rather than leaving `?tapes=` behind',
    cleared);

// ══ 8. THE SINGLE-TAPE ARM IS UNMOVED ═══════════════════════════════════
await page.goto(`${origin}${PAGE_PATH}?tape=frontend/modules/seedlingDemo/fixtures/tapes/`
    + 'r8-d2-19.json&side=js');
await page.waitForFunction(
    () => /observations/.test(document.getElementById('status').textContent)
        || document.getElementById('status').className === 'bad',
    null, { timeout: 180000 });
const solo = await page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    cls: document.getElementById('status').className,
    seq: window.__editorSequence ?? null,
}));
check(solo.cls === 'ok' && /865 observations/.test(solo.status) && solo.seq === null,
    '⛓ CLAIM 8 — `?tape=` IS UNMOVED: one tape, one staged run, no sequence readout',
    solo.status);

// ══ 9. THE act2 REPORT ══════════════════════════════════════════════════
const act2 = await land('tapes=act2-the-sword&side=js');
const admitted = (act2.seq?.boundaries ?? []).filter((x) => refusalsAt(x.admission).length === 0);
const refusedAt = (act2.seq?.boundaries ?? []).find((x) => refusalsAt(x.admission).length > 0);
report('⛓ CLAIM 9 — the TRUE-START chain, as a sequence: which windows continue',
    `${act2.seq?.windows?.length ?? 0} of ${PAGE_CHAINS['act2-the-sword'].length} window(s) `
    + `stepped; ${admitted.length} boundary(ies) admitted`);
report('…and the window that stops it, BY NAME',
    refusedAt
        ? `${refusedAt.label}: ${refusalsAt(refusedAt.admission).map((f) => f.what).join('; ')}`
        : 'none — the whole chain continues');
/**
 * ⛔ PINNED, so a change in the ANSWER is a change somebody has to explain.
 * The finding itself is not this arm's to fix: `r7-act2-5` declares the clear
 * `{5,0}` and the live JS run does not hold it (window 1 declares none, and
 * `run.earnedClears` is empty through the cut — measured, plus 160 ticks of
 * coasting in L5 that write nothing). Either the GAME holds it at that latch
 * and the MODEL does not produce it, or the segment declares a flag its
 * predecessor never earned. ⛓ THE WASM ROW IS THE INSTRUMENT THAT SETTLES IT:
 * `botSeam()` reports the game's own `persistence_cleared` at that boundary.
 */
check(act2.seq?.admitted === false && refusedAt?.label === 'r7-act2-5'
    && (act2.seq?.windows ?? []).length === 5,
'⛓ …and that answer is PINNED — a change here is a finding somebody must explain',
`stopped at ${refusedAt?.label} after ${(act2.seq?.windows ?? []).length} window(s)`);

check(errors.length === 0, 'ZERO console errors and pageerrors across every landing',
    errors.slice(0, 3).join(' | '));

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
