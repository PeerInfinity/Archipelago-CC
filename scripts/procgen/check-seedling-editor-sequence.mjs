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
 * page queues `?tapes=r8-d2`, its windows step ONE live run, and the
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
 *  1. **THE HEADLINE EXPANDS** — `?tapes=r8-d2` is ONE member and N windows,
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
 * 10. **THE WASM ARM TAKES THE SAME WINDOWS** — the JS walk admits them,
 *     the stage list carries `window k/N`, and the ship STOPS at ▶ Start
 *     because the page may never press it. The per-tick verdicts and
 *     `continuationFindings` belong to the announced Windows row.
 * 11. **A NON-CONTINUABLE PAIR IS REFUSED BEFORE THE FRAME IS TOUCHED** — no
 *     `__editorWasm` at all: a real GPU run is not spent to learn what the
 *     model already knew by name.
 * 12. **⛓⛓⛓ ONE CLICK PLAYS THE CAMPAIGN** (R9 slice 10, ⚖ ruling 19) — the
 *     ▶ campaign button is PRESSED, and what it writes is `?tapes=<the chain
 *     this row derives for itself>` with the single-tape selection dropped.
 *     ⛔ A PRESS, not an existence check: a control nobody presses is a control
 *     nobody has gated (trap 479).
 * 13. **⛓⛓⛓ EVERY READOUT FIELD IS RE-DERIVED** — rooms crossed, the ledger
 *     rows credited and their segments, the end level, and the frontier —
 *     computed HERE from the chain table, the committed tapes and the committed
 *     frontier artifact, and compared to `window.__campaign`. ⛔ Never echoed.
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
const { PAGE_CHAINS, campaignChoice } = await import(join(MODULE, 'director.js'));
/**
 * ⛓ R9 SLICE 10 — the gate RE-DERIVES the readout's ledger with the same two
 * functions the page uses, from the committed tapes, in node. ⛔ That is not an
 * echo (trap 269): the page and this row compute the same thing from the same
 * artifacts by two separate call paths, and a page that stopped computing it
 * would still have to produce the right answer to pass.
 */
const { goalEarnedWitness, R7_GOAL_LEDGER, seamBootFields } = await import(
    join(MODULE, 'r7Acceptance.js'));
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));

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
    `⛓⛓⛓ CLAIM 2 — ALL ${PAGE_CHAINS['r8-d2'].length} WINDOWS ON ONE GAME STATE `
    + 'PRODUCE THE HEADLINE STREAM, TICK FOR TICK',
    `page ${mine.length} observation(s) vs the headline's ${oracle.ticks.length}; `
    + `first differing tick ${firstDiff}`
    + (firstDiff >= 0 ? ` — page ${JSON.stringify(mine[firstDiff])} vs headline `
        + `${JSON.stringify(oracle.ticks[firstDiff])}` : ''));

const endMine = mine.at(-1);
const endOracle = oracle.ticks.at(-1);
check(JSON.stringify(endMine) === JSON.stringify(endOracle),
    '⛓ CLAIM 3 — …AND IT ENDS EQUAL',
    `${JSON.stringify(endMine)} vs ${JSON.stringify(endOracle)}`);

/**
 * ⛓ R9 SLICE 3 — EVERY BOUNDARY, NOT "the first one". The splice made `r8-d2`
 * three segments, so there are TWO boundaries; a row that read `boundaries[0]`
 * and compared it against a hardcoded `r8-d2-20` was checking the wrong pair
 * against the wrong tape the moment a segment was added. The list and the
 * expected latch both come from `PAGE_CHAINS` now.
 */
const boundaries = got.seq.boundaries ?? [];
const refusalsAt = (f) => (f ?? []).filter((x) => !x.informational);
const SEGS = PAGE_CHAINS['r8-d2'];
check(boundaries.length === SEGS.length - 1
    && boundaries.every((x) => refusalsAt(x.admission).length === 0
        && (x.stream ?? []).length === 0 && (x.status ?? []).length === 0),
'⛓ CLAIM 4 — EVERY BOUNDARY HELD, on the director\'s own two checks',
boundaries.length
    ? boundaries.map((x) => `[${x.label}] admission refusals `
        + `${refusalsAt(x.admission).length} (${x.admission.length} row(s), `
        + `${x.admission.filter((y) => y.informational).length} UNASSERTED by name), `
        + `streamBoundaryFindings ${(x.stream ?? []).length}, `
        + `boundaryFindings ${(x.status ?? []).length}`).join('; ')
    : 'no boundary was recorded');
check(boundaries.length === SEGS.length - 1 && boundaries.every((x, i) => {
    const t = tapeOf(SEGS[i + 1]);
    return x.live.level === t.boot.level && x.live.ctor.x === t.boot.x
        && x.live.ctor.y === t.boot.y
        && x.live.cleared.length === t.persistence.length;
}),
'⛓⛓ …and every later window\'s declared LATCH was admitted because it MATCHES '
    + 'the live world',
boundaries.map((x, i) => {
    const t = tapeOf(SEGS[i + 1]);
    return `[${SEGS[i + 1]}] live L${x.live.level} constructed at `
        + `(${x.live.ctor.x},${x.live.ctor.y}) vs boot L${t.boot.level} (${t.boot.x},`
        + `${t.boot.y}); ${x.live.cleared.length} cleared flag(s) vs the `
        + `${t.persistence.length} the tape declares`;
}).join('; '));

/**
 * ⛔⛔ CLAIM 3b — THE DISCRIMINATING ONE, AND CLAIM 2 IS NOT IT.
 *
 * A build whose resume face silently RE-STAGED was measured reproducing the
 * headline byte for byte (first differing tick −1). `r8-d2`'s cut is a level
 * ARRIVAL, so the world is freshly constructed on that tick and the player is
 * on the spawn at rest — exactly what `r8-d2-20`'s boot block rebuilds — and
 * since R1 every chain in the roster has been cut at an arrival. ⇒ NO STREAM
 * CLAIM HERE CAN TELL A RESUME FROM A RE-STAGE. What can is that it is the
 * SAME RUN: window 2's `finished` carries window 1's transition too, because a
 * re-staged run's ledgers start at zero.
 */
const w = got.seq.windows;
/**
 * ⛓ R9 slice 3: the ledger claim is over EVERY window and its numbers are
 * DERIVED — window k's `transitions` is k (each segment ends at exactly one
 * level arrival, which is what a cut IS on this roster), and its span is the
 * running sum of the tapes' own `tick_count`s. The old row typed 864 and 1645.
 */
let runningFrom = 0;
const spans = SEGS.map((n) => {
    const from = runningFrom;
    runningFrom += tapeOf(n).tick_count;
    return { from, to: runningFrom };
});
check(w.length === SEGS.length
    && w.every((x, i) => x.finished.transitions === i + 1
        && x.from === spans[i].from && x.to === spans[i].to),
'⛔⛔ CLAIM 3b — ONE RUN: every later window\'s LEDGERS ARE THE SEQUENCE\'S, not its own',
w.map((x, i) => `window ${i + 1} ${x.finished?.transitions} transition(s) over `
    + `[${x.from},${x.to}] (want ${i + 1} over [${spans[i].from},${spans[i].to}])`).join('; ')
    + ' — a re-staged window k would report 1');

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
const granted = await land('tapes=r8-solve-1,r4-walk-2-feather&side=js');
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
/**
 * ⛔⛔ THE PICKER IS SET WITHOUT `selectOption`, AND THE FIRST CUT OF THIS ROW
 * IS WHY. `#tapes`'s own `onchange` assigns `window.location.search`, which
 * NAVIGATES — so a `selectOption` here tears the page down and the `#queueAdd`
 * click lands on a document that is reloading. It passed against a warm server
 * and failed against a cold one, which is the shape of every timing-luck green
 * there is. The queue control reads `sel.value`, so setting the value is
 * exactly what a reader picking a tape leaves behind, minus the navigation.
 *
 * ⚠ AND THE WAIT IS FOR THE QUEUE CONTROL TO HAVE MOUNTED, not for
 * `#queueAdd` to be enabled: that button is never disabled, so waiting on it is
 * a condition the PREVIOUS state already satisfies — not a wait at all.
 */
await page.waitForFunction(
    () => !document.getElementById('tapes').disabled
        && /^queue:/.test(document.getElementById('queueList').textContent),
    null, { timeout: 120000 });
const pick = async (name) => {
    await page.evaluate((v) => { document.getElementById('tapes').value = v; },
        `frontend/modules/seedlingDemo/fixtures/tapes/${name}.json`);
    await page.click('#queueAdd');
};
await pick('r8-d2-19');
await pick('r8-d2-20');
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

// ══ 9. RETIRED — THE act2 REPORT ═══════════════════════════════════════
/**
 * ⛓⛓⛓ R9 SLICE 7 — **CLAIM 9 RETIRED WITH ITS SUBJECT (⚖ ruling 14).**
 *
 * This was the HAND chain's report: `?tapes=act2-the-sword&side=js`, eleven
 * windows, ten boundaries, pinned at *"nothing refused"* after ⚖ ruling 14's
 * timed-row admission rule, plus the free oracle that its rebased forward rows
 * `{5,0}@1559`, `{8,0}@2515`, `{8,1}@3067` are exactly what `r7-act2-full`
 * declares. All of it is in the R9 § of `seedling-bot.md` as history.
 *
 * The chain retired from `PLAYTHROUGH_CHAINS` and `PAGE_CHAINS` this slice, so
 * the rows could not be re-pointed — there is nothing to point them at. What
 * they claimed is claimed by CLAIMS 9b–9e below, one chain over and on a
 * stronger footing: `r9-campaign` is fifteen windows on ONE game state where
 * every boot after the first is a MEASURED LATCH rather than a hand
 * declaration, and 9e makes the same free-oracle claim about ITS forward rows.
 *
 * ⛔ NOT DELETED SILENTLY. A gate that loses a claim without saying so reads
 * exactly like a gate that still makes it (trap 119), which is the whole
 * reason this block is a paragraph and not an absence.
 */

// ══ 9b. THE TRUE-START SOLVER CHAIN, AS ONE SEQUENCE ════════════════════
/**
 * ⛓⛓⛓ R9 SLICE 6 (⚖ ruling 11) — **THE CHAIN THE CENSUS ASKED FOR, PLAYED.**
 *
 * Claim 9 above is the HAND chain's report; this is the SOLVER chain's claim,
 * and the difference is what ruling 11 is about: every boot after the first is
 * its predecessor's MEASURED LATCH, so the fifteen windows are one game the
 * page steps from `new Game(0,80,128)` to the L14 arrival.
 *
 * ⛔ THE ORACLE IS THE HEADLINE PLAYED ALONE, exactly as claim 2's is — one
 * tape, one staged run, no windows at all. A page that agreed with itself
 * would be an echo (trap 269); this compares two different runs of the same
 * walk, one of them stitched out of fifteen.
 */
const camp = await land('tapes=r9-campaign&side=js');
const CAMP = PAGE_CHAINS['r9-campaign'];
if (!camp.seq) {
    check(false, 'CLAIM 9b — the true-start chain answered at all',
        `${camp.status} — ${camp.detail}`);
} else {
    const campBoundaries = camp.seq.boundaries ?? [];
    const campRefused = campBoundaries.find((x) => refusalsAt(x.admission).length > 0);
    check(camp.seq.admitted === true && campRefused === undefined
        && (camp.seq.windows ?? []).length === CAMP.length
        && campBoundaries.length === CAMP.length - 1,
    `⛓⛓⛓ CLAIM 9b — ALL ${CAMP.length} WINDOWS OF THE TRUE-START CHAIN STEP ON ONE `
        + `GAME STATE, and all ${CAMP.length - 1} boundaries ADMIT`,
    `${(camp.seq.windows ?? []).length} window(s), ${camp.seq.ticks} tick(s); `
        + `${campBoundaries.length} boundary(ies); `
        + `${campRefused ? `stopped at ${campRefused.label}` : 'nothing refused'}`);

    const campOracle = runTapeToStream(tapeOf('r9-campaign'),
        { levelSource: atlasLevelSource() });
    const campMine = camp.seq.stream ?? [];
    let campDiff = -1;
    for (let i = 0; i < Math.max(campMine.length, campOracle.ticks.length); i += 1) {
        if (JSON.stringify(campMine[i]) !== JSON.stringify(campOracle.ticks[i])) {
            campDiff = i;
            break;
        }
    }
    check(campMine.length === campOracle.ticks.length && campDiff === -1,
        '⛓⛓⛓ CLAIM 9c — …AND THE FIFTEEN WINDOWS PRODUCE THE HEADLINE STREAM, TICK '
        + 'FOR TICK',
        `page ${campMine.length} observation(s) vs the headline's `
        + `${campOracle.ticks.length}; first differing tick ${campDiff}`
        + (campDiff >= 0 ? ` — page ${JSON.stringify(campMine[campDiff])} vs headline `
            + `${JSON.stringify(campOracle.ticks[campDiff])}` : ''));
    check(JSON.stringify(campMine.at(-1)) === JSON.stringify(campOracle.ticks.at(-1)),
        '⛓ CLAIM 9d — …AND IT ENDS EQUAL, at the L14 arrival',
        `${JSON.stringify(campMine.at(-1))} vs ${JSON.stringify(campOracle.ticks.at(-1))}`);

    /**
     * ⛓⛓ THE FORWARD ROWS, REBASED — the three timed clears the chain's own
     * segments declare, lifted into the sequence's numbering. ⛔ DERIVED from
     * the tapes rather than typed: the expected list is each segment's own
     * `at` plus the running sum of the tick counts before it, which is the
     * same arithmetic `watchViewer` does and a different spelling of it.
     */
    const want = [];
    let running = 0;
    for (const name of CAMP) {
        const t = tapeOf(name);
        for (const c of (t.persistence ?? []).filter((x) => x.at !== undefined)) {
            want.push(`${c.level}:${c.tag}@${c.at + running}`);
        }
        running += t.tick_count;
    }
    const campForward = campBoundaries.flatMap((b) => b.forwardRows ?? []);
    check(JSON.stringify(campForward) === JSON.stringify(want),
        '⛓⛓ CLAIM 9e — …and the FORWARD declarations are named per boundary, REBASED '
        + 'into the sequence\'s own numbering — the three the HEADLINE itself declares',
        `${JSON.stringify(campForward)} against ${JSON.stringify(want)}`);
    /**
     * ⛓⛓⛓ AND THE FREE ORACLE NOBODY WROTE FOR IT, the same one claim 9 has:
     * those rebased ticks are EXACTLY what `r9-campaign` declares as its own
     * v9 rows — a tape the producer emitted from a different derivation.
     */
    const headRows = (tapeOf('r9-campaign').persistence ?? [])
        .filter((c) => c.at !== undefined).map((c) => `${c.level}:${c.tag}@${c.at}`);
    check(JSON.stringify(campForward) === JSON.stringify(headRows),
        '⛓⛓⛓ …and they are the HEADLINE\'s OWN declared rows, tick for tick — two '
        + 'derivations, one answer',
        `${JSON.stringify(campForward)} vs ${JSON.stringify(headRows)}`);
}

// ══ 10–11. THE WASM ARM, AS FAR AS A HEADLESS BROWSER CAN GO ═══════════
/**
 * ⛔ HEADLESS STOPS AT ▶ Start, AND THAT IS THE LAW WORKING. The frame's own
 * start path must run inside a real user gesture (WebGPU init + AudioContext
 * consume the activation), and this page may never press it. So what a
 * headless row can assert is: the JS walk ADMITTED the windows, the ship
 * reached `runtime`, it is WAITING, and the stage list it will walk carries the
 * WINDOW VOCABULARY. The per-tick verdicts and `continuationFindings` are the
 * announced Windows row's (`check-seedling-wasm-ship.mjs`'s two-window plan).
 */
const { stagesOf } = await import(join(MODULE, 'watchWasm.js'));
await page.goto(`${origin}${PAGE_PATH}?tapes=r8-d2&side=wasm`);
await page.waitForFunction(
    () => (window.__editorWasm && window.__editorWasm.reached?.includes('runtime'))
        || document.getElementById('status').className === 'bad',
    null, { timeout: 180000 });
const ship = await page.evaluate(() => ({
    stages: window.__editorWasm?.stages ?? null,
    reached: window.__editorWasm?.reached ?? null,
    refusal: window.__editorWasm?.refusal ?? null,
    windows: window.__editorWasm?.windows ?? null,
    admitted: window.__editorSequence?.admitted ?? null,
    labels: (window.__editorSequence?.windows ?? []).map((x) => x.label),
}));
// ⛓ R9 slice 3: `windows: SEGS.length`, not a literal 2 — the stage list is a
// function of how many windows the chain has, and typing the count here would
// re-red this row on every future segment for no reason of its own.
check(ship.admitted === true
    && JSON.stringify(ship.stages) === JSON.stringify(stagesOf({ windows: SEGS.length })),
`⛓⛓ CLAIM 10 — THE WASM ARM TAKES THE SAME ${SEGS.length} WINDOWS, and its stages say so`,
`admitted ${ship.admitted}, windows ${JSON.stringify(ship.labels)}, stages `
    + `${JSON.stringify(ship.stages)}`);
check(JSON.stringify(ship.reached) === JSON.stringify(['probe', 'runtime'])
    && ship.refusal === null,
'⛔ …and it STOPS at ▶ Start — the page never presses it, once per page, by law',
`reached ${JSON.stringify(ship.reached)}`);

const badWasm = await page.goto(`${origin}${PAGE_PATH}?tapes=r8-d2-19,r8-solve-4&side=wasm`)
    .then(() => page.waitForFunction(
        () => window.__editorSequence?.refusal
            || (window.__editorWasm && window.__editorWasm.reached?.includes('runtime')),
        null, { timeout: 180000 }))
    .then(() => page.evaluate(() => ({
        refusal: window.__editorSequence?.refusal ?? null,
        ship: window.__editorWasm ?? null,
        detail: document.getElementById('detail').textContent,
    })));
check(!!badWasm.refusal && /cannot continue/.test(badWasm.refusal.reason)
    && badWasm.ship === null,
'⛓⛓ CLAIM 11 — a NON-CONTINUABLE PAIR IS REFUSED BEFORE THE FRAME IS TOUCHED',
`${badWasm.refusal?.reason ?? 'not refused'} — __editorWasm is `
    + `${badWasm.ship === null ? 'ABSENT (no ship began)' : 'PRESENT (a ship began!)'}`);

// ══ 12–13. ⛓⛓⛓ R9 SLICE 10 — THE CAMPAIGN PLAYER (⚖ ruling 19) ══════════
/**
 * ⛔⛔ THIS IS A PRESS PATH, AND THAT IS THE WHOLE POINT (trap 479). A row that
 * LANDED on `?tapes=<chain>` and read the readout would pass with the ▶ campaign
 * button broken, missing or wired to nothing — it would be checking the arm the
 * button delegates to, not the button. So the row starts on a page with NO
 * `?tapes=` at all, clicks, and asserts what the click produced.
 *
 * ⛔ AND THE EXPECTED CHAIN IS DERIVED HERE, not typed and not read off the
 * page: `campaignChoice()` in node, over the same two tables the browser has.
 */
const CHOICE = campaignChoice();
await page.goto(`${origin}${PAGE_PATH}?tape=frontend/modules/seedlingDemo/fixtures/tapes/`
    + 'r8-solve-1.json&side=js');
await page.waitForFunction(
    () => !document.getElementById('tapes').disabled
        && /^queue:/.test(document.getElementById('queueList').textContent),
    null, { timeout: 120000 });
const control = await page.evaluate(() => ({
    disabled: document.getElementById('campaignRun').disabled,
    title: document.getElementById('campaignRun').title,
    camp: window.__campaignControl
        ? JSON.parse(JSON.stringify(window.__campaignControl)) : null,
}));
/**
 * ⛔⛔ TRAP 480 — A SPOKEN REFUSAL MUST ALSO FAIL BY NAME. If the control is
 * disabled, clicking it would produce nothing and every row below would wait out
 * its timeout to learn what the page already knew. So the refusal is READ, and
 * the row fails NAMING it — and a control that greyed out without publishing a
 * structural reason fails for THAT, which is the shape the trap is about.
 */
if (control.disabled) {
    check(false, '⛔ CLAIM 12 — ▶ campaign is DISABLED, so no click can be gated',
        control.camp?.campaignRefusal
            ? `${control.camp.campaignRefusal.reason} — ${control.camp.campaignRefusal.detail}`
            : '…and `__campaign.campaignRefusal` is ABSENT: the control greyed out with '
              + 'its reason nowhere a gate can read it, which is exactly trap 480');
} else {
    check(CHOICE.refusal === null && control.camp?.campaign === CHOICE.id
        && control.camp?.campaignRefusal === null
        && control.title.includes(CHOICE.id),
    '⛓ …and BEFORE any walk it already names the chain it would play, and why',
    `title "${control.title}" · __campaign.campaign ${control.camp?.campaign}`);

    await page.click('#campaignRun');
    /**
     * ⛔⛔ TRAP 480, THE OTHER HALF — AND A MUTANT IS WHAT FOUND IT HERE.
     *
     * The DISABLED control is handled above: its reason is read and the row
     * fails naming it. The control that EXISTS, is ENABLED, and does NOTHING is
     * the harder case, and the first spelling of this row let the wait THROW —
     * an uncaught `TimeoutError` with a stack trace, 300 seconds after a press
     * that never did anything, and no named row at all. A gate that dies of a
     * timeout has not said what is wrong; it has only said that it waited.
     *
     * ⇒ the wait is CAUGHT and turned into a row that names the button, the
     * press, and the readout that never arrived. Measured: a build with
     * `btn.onclick = () => {}` produced exactly the throw described above.
     */
    let pressWait = null;
    try {
        await page.waitForFunction(
            () => window.__editorSequence !== undefined
                || document.getElementById('status').className === 'bad',
            null, { timeout: 300000 });
    } catch (e) { pressWait = e.message; }
    check(pressWait === null,
        '⛔ …and THE PRESS ACTUALLY STARTED A WALK — `#campaignRun` is wired to '
        + 'something',
        pressWait === null ? 'the sequence arm answered'
            : `${pressWait}\n          The button EXISTS and is ENABLED, and clicking it `
              + 'produced no `__editorSequence` and no red status. A control wired to '
              + 'nothing looks exactly like a control that works, from every angle '
              + 'except this one.');
    const camp = pressWait !== null ? null : await page.evaluate(() => ({
        search: window.location.search,
        camp: JSON.parse(JSON.stringify(window.__campaign)),
        windows: (window.__editorSequence?.windows ?? []).map((w) => w.label),
        readout: document.getElementById('campaignReadout').textContent,
        readoutHidden: document.getElementById('campaignReadout').hidden,
    }));
    if (camp === null) {
        // ⛔ NAMED, NOT SILENT. The rows below all read `camp`; skipping them
        // without saying so would make a dead button and a clean run print the
        // same nine absences (trap 119).
        check(false, '⛔ CLAIMS 12–13 CANNOT RUN — the press produced no readout',
            'every row below reads `window.__campaign`, which the click never '
            + 'created. A check that cannot run is not a check that passed.');
    } else {
    const q = new URLSearchParams(camp.search);
    check(q.get('tapes') === CHOICE.id && q.get('tape') === null,
        '⛓⛓⛓ CLAIM 12 — ONE CLICK writes `?tapes=<the derived chain>`, as a LINK',
        `?tapes=${q.get('tapes')} · ?tape=${q.get('tape')}`);
    check(JSON.stringify(camp.windows) === JSON.stringify(CHOICE.segments),
        `⛓ …and the arm played the chain's own ${CHOICE.segments.length} segments, in order`,
        JSON.stringify(camp.windows));

    // ── CLAIM 13 — every readout field, RE-DERIVED here ──────────────
    /**
     * ⛓ THE LEDGER, COMPUTED IN NODE FROM THE COMMITTED TAPES. Segment k's boot
     * against segment k+1's — which for a custody chain IS segment k's measured
     * latch — through `goalEarnedWitness`, the same function `chainGoalFindings`
     * uses. The LAST window has no successor and is unasserted on both sides.
     */
    const boots = CHOICE.segments.map(
        (n) => seamBootFields(parseTape(tapeOf(n))));
    const mine = [];
    for (let k = 0; k < boots.length - 1; k += 1) {
        for (const row of R7_GOAL_LEDGER) {
            if (mine.some((c) => c.id === row.id)) continue;
            if (goalEarnedWitness(row, boots[k], boots[k + 1])) {
                mine.push({ id: row.id, segment: CHOICE.segments[k] });
            }
        }
    }
    const theirs = camp.camp.ledger.credited.map((c) => ({ id: c.id, segment: c.segment }));
    check(JSON.stringify(theirs) === JSON.stringify(mine)
        && camp.camp.ledger.creditedCount === mine.length
        && camp.camp.ledger.total === R7_GOAL_LEDGER.length,
    `⛓⛓⛓ CLAIM 13 — THE LEDGER LINE IS RE-DERIVED: ${mine.length} / `
        + `${R7_GOAL_LEDGER.length} credited, and the ROWS agree`,
    `page ${JSON.stringify(theirs)} · this row ${JSON.stringify(mine)}`);
    check(camp.camp.ledger.unasserted.length === 1
        && camp.camp.ledger.unasserted[0].label === CHOICE.segments.at(-1),
    '⛔ …and the LAST window is UNASSERTED BY NAME, never silently credited',
    JSON.stringify(camp.camp.ledger.unasserted));

    /**
     * ⛓ ROOMS AND END STATE, against this row's OWN model walk of the headline
     * — `runTapeToStream` on the chain's own headline tape, the same oracle
     * claim 2 uses. ⛔ Not against the page's numbers restated.
     */
    const campOracle = runTapeToStream(tapeOf(CHOICE.id),
        { levelSource: atlasLevelSource() });
    const endOracle = campOracle.ticks.at(-1);
    check(camp.camp.rooms.crossed === CHOICE.segments.length
        && camp.camp.rooms.of === CHOICE.segments.length
        && camp.camp.rooms.rows.length === CHOICE.segments.length
        && camp.camp.rooms.rows.every((r, i) => r.segment === CHOICE.segments[i]),
    `⛓ …and ROOMS CROSSED is ${CHOICE.segments.length}, one row per segment, in order`,
    `${camp.camp.rooms.crossed} of ${camp.camp.rooms.of}`);
    check(camp.camp.end.level === endOracle.level && camp.camp.end.x === endOracle.x
        && camp.camp.end.y === endOracle.y
        && camp.camp.end.ticks === campOracle.ticks.length - 1
        && camp.camp.end.seamTime === null && Boolean(camp.camp.end.seamTimeWhy),
    '⛓⛓ …and the END STATE is the HEADLINE played alone — with `seam.time` '
        + 'UNASSERTED BY NAME on this side',
    `page L${camp.camp.end.level} (${camp.camp.end.x},${camp.camp.end.y}) `
        + `${camp.camp.end.ticks}t · oracle L${endOracle.level} `
        + `(${endOracle.x},${endOracle.y}) ${campOracle.ticks.length - 1}t`);

    /**
     * ⛓ THE WORK ORDER, against the COMMITTED ARTIFACT this row reads itself.
     * ⛔ The artifact is the census's checked projection of the route survey
     * (`--check-frontier`); this row asserts the page prints it VERBATIM rather
     * than paraphrasing a refusal the reader is owed in full.
     */
    const frontier = JSON.parse(readFileSync(
        join(MODULE, 'fixtures', 'campaign-frontier.json'), 'utf8'));
    check(JSON.stringify(camp.camp.frontier.nextStep) === JSON.stringify(frontier.nextStep)
        && JSON.stringify(camp.camp.frontier.refusal) === JSON.stringify(frontier.refusal)
        && camp.camp.frontier.chain === CHOICE.id,
    `⛓⛓ …and the NEXT WORK ORDER is the artifact's, verbatim — route step `
        + `${frontier.nextStep?.step} (L${frontier.nextStep?.level})`,
    `${camp.camp.frontier.refusal?.family?.slice(0, 70)}…`);
    check(camp.readoutHidden === false
        && camp.readout.includes(`${mine.length} / ${R7_GOAL_LEDGER.length}`)
        && camp.readout.includes(frontier.refusal.text),
    '⛔ …and the READER SEES IT: `#campaignReadout` is visible and carries the '
        + 'same ledger line and the same refusal sentence',
    `hidden=${camp.readoutHidden}, ${camp.readout.length} chars`);

    /**
     * ⛔⛔ THE SCOPE RULING, ASSERTED AS AN ABSENCE (⚖ ruling 19). The detached
     * `r8-d2` tail is a real, playable chain and is NOT part of the campaign —
     * "not offered" is the claim, so the row looks for it and requires it not to
     * be there. An absence nobody checks is a scope rule nobody has.
     */
    check(!camp.readout.includes('r8-d2') && !camp.readout.includes('r8-solve-18')
        && !JSON.stringify(camp.camp).includes('r8-d2'),
    '⛔ …and the DETACHED TAIL is NOT offered — ⚖ ruling 19 scopes the player to '
        + 'what plays continuously from a fresh game start',
    'no `r8-d2` / `r8-solve-18` anywhere in the readout or in `__campaign`');
    check(/unsolved/i.test(camp.readout),
        '⛓ …but the readout SAYS the rooms beyond the arrival are unsolved',
        camp.readout.slice(-160));
    }
}

check(errors.length === 0, 'ZERO console errors and pageerrors across every landing',
    errors.slice(0, 3).join(' | '));

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
