#!/usr/bin/env node
/**
 * check-seedling-wasm-ship — **THE ONLY ARM THAT CAN SEE A REAL SOLVE'S VERDICT.**
 *
 * `watch.html`'s ▶ load-in-wasm button ships what the page holds into the real
 * recompiled Seedling and prints TWO verdicts beside the JS run's own answer:
 * the END STATE (did the real game finish where the model finished) and, since
 * the per-tick slice, the whole run TICK BY TICK. This row drives one SOLVE
 * ship all the way to `finished`, past the `drain`, and reads both off the page.
 *
 * ⚠ IT IS NO LONGER THE ONLY ARM THAT CAN SEE `agrees per tick`.
 * `check-seedling-wasm-pages.mjs` now drives a 30-tick COMMITTED tape through
 * `?side=wasm` headless, on any root, and sees one there. What is still only
 * visible here is a **SOLVE's** verdict — 255 ticks that the page produced
 * itself, which swiftshader would spend eight minutes rasterising.
 *
 * ── ⛔ WHY IT IS A SEPARATE ROW AND NOT A FLAG ON THE PAGES ROW ──────────────
 *
 * `check-seedling-wasm-pages.mjs` is a `playwright`/WSL-chromium script and its
 * whole point is that it can run against ANY root, including the deployed site,
 * from a Linux box with no GPU. This row drives **real-GPU Windows Chrome
 * through `/mnt/c/Windows/py.exe`** by the standing ⚖ rule, which is a
 * different machine with a different driver and a different prerequisite — and
 * one that CANNOT run in CI (§18.13 residue 4). Folding the two into one file
 * would give it two launch paths, one of which is dead on every runner.
 *
 * ⇒ THE SPLIT IS BY WHAT EACH CAN ANSWER:
 *   pages row (headless)   the ship REACHES `tape` and `running` — the stages
 *                          up to the first tick, which is all ~0.5 ticks/s can
 *                          honestly reach
 *   THIS row (real GPU)    the ship reaches `finished`, and the VERDICT is real
 *
 * ⛔ EACH VERDICT IS PRINTED WITH ITS OWN BOUND, and this row asserts BOTH are
 * on screen: the end-state line compares ONE frame, and the per-tick line is
 * against the JS MODEL of this same tape rather than a recorded expectation —
 * and it is blind to any defect in the code both runtimes SHARE (trap 389).
 * The instrument that compares the game against RECORDED oracles is still
 * `verify-seedling-bot-differential.mjs`.
 *
 * ⚠ REAL-GPU WINDOWS CHROME ONLY. WSL's own chromium is SwiftShader at ~0.5
 * ticks/s, so a 255-tick solve would take eight minutes of software rasterising
 * and any deadline becomes a race against machine load rather than a fact.
 *
 * Prerequisites: a dev server on :8000 at the REPO ROOT, and a Windows
 * playwright install (`C:\playwright`).
 *
 * Run:
 *   node scripts/procgen/check-seedling-wasm-ship.mjs
 *   node scripts/procgen/check-seedling-wasm-ship.mjs --host=http://localhost:8000
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const WIN_WSL = '/mnt/c/playwright';
const WIN_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const DRIVER = join(HERE, 'seedling-watch-ship-win.py');

/**
 * ⛓ THE SAME SEGMENT `check-seedling-editor-solve.mjs` ACCEPTS ON — a committed
 * boot block, one unambiguous goal, and a solve the page runs in the page. ⛔
 * Reusing it rather than inventing a segment means a red here is about the SHIP
 * and not about a solve nobody else runs.
 */
const BOOT = 'frontend/modules/seedlingDemo/fixtures/tapes/r7-act2-4.json';
const GOALS = 'exit:64,16';
const NAME = 'r8-solve-4';
const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?level=4&boot=${BOOT}&goals=${encodeURIComponent(GOALS)}&solve=1&name=${NAME}`;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failed += 1;
};

const alive = await fetch(`${HOST}/${BOOT}`).then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${BOOT} — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}

/**
 * ⛔ THE PLAN IS THE WHOLE PROTOCOL, AND IT LIVES HERE. The driver presses and
 * polls; every expression below is this row's claim about what the page should
 * be doing at that moment.
 */
const steps = [
    {
        what: 'the SOLVE arm mounted and solved in the page',
        wait: "window.__editorSolve && window.__editorSolve.status === 'ok'",
        sec: 240,
    },
    {
        what: '…and ▶ load in wasm became ENABLED, with what it will ship in its title',
        wait: "!document.getElementById('loadWasm').disabled",
        sec: 60,
    },
    { read: "document.getElementById('loadWasm').title", as: 'buttonTitle' },
    { read: "document.getElementById('wasmShip').hidden", as: 'buttonHiddenInSolve' },
    { click: '#loadWasm', what: 'press ▶ load in wasm' },
    {
        what: 'the ship reached `runtime` and is waiting for a REAL ▶ Start',
        wait: "window.__watch?.wasm?.reached?.includes('runtime')",
        sec: 300,
    },
    // ⛔ THE ONE CLICK THE PAGE MAY NEVER MAKE. Playwright's click carries real
    // user activation; the parent document's does not.
    { frame_click: '#btn-start', frame: '/game.html', what: 'press ▶ Start INSIDE the frame' },
    {
        what: 'the game accepted the tape and started running it',
        wait: "window.__watch?.wasm?.reached?.includes('running')",
        sec: 300,
    },
    {
        what: '⛓ the ship reached `finished` — the real game ran the solve to its end',
        wait: "window.__watch?.wasm?.verdict && window.__watch.wasm.verdict.kind !== 'not-finished'",
        sec: 600,
    },
    { read: 'window.__watch.wasm', as: 'wasm' },
    { read: "document.getElementById('wasmVerdict').textContent", as: 'verdictText' },
    { read: 'window.__editorSolve', as: 'solve' },
];

mkdirSync(WIN_WSL, { recursive: true });
writeFileSync(join(WIN_WSL, 'seedling-watch-ship-win.py'), readFileSync(DRIVER));
const planWsl = join(WIN_WSL, 'watch-ship-plan.json');
const outWsl = join(WIN_WSL, 'watch-ship-results.json');
writeFileSync(planWsl, JSON.stringify({ url: PAGE, steps }));
try { unlinkSync(outWsl); } catch { /* first run */ }

console.log('# ▶ load in wasm, driven to `finished` on real-GPU Windows Chrome');
console.log(`  ${PAGE}\n`);

let driverOut = '';
try {
    driverOut = execFileSync(WIN_PY, [
        '-3.12', `${WIN_DOS}\\seedling-watch-ship-win.py`,
        '--plan', `${WIN_DOS}\\watch-ship-plan.json`,
        '--out', `${WIN_DOS}\\watch-ship-results.json`,
    ], { cwd: WIN_WSL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
    driverOut = [e.stdout, e.stderr].filter(Boolean).join('\n');
    console.log(`DRIVER FAILED: ${e.message}`);
}
driverOut.replace(/\r/g, '').split('\n')
    .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
    .forEach((l) => console.log(`  ${l}`));

let res = null;
try { res = JSON.parse(readFileSync(outWsl, 'utf8')); } catch { /* named below */ }
console.log('');
check(res !== null && res.crashed !== true, 'the driver completed every step',
    res === null ? 'no results file — the driver died before writing one'
        : (res.error ?? `${res.steps.length} step(s)`));
if (res === null) { console.log('\n1 FAILURE(S)'); process.exit(1); }

const wasm = res.reads?.wasm ?? null;
const solve = res.reads?.solve ?? null;
check(res.reads?.buttonHiddenInSolve === false,
    '⛓ the ▶ load-in-wasm button is UP in SOLVE (it is hidden only in REPLAY)',
    `#wasmShip hidden = ${res.reads?.buttonHiddenInSolve}`);
check(typeof res.reads?.buttonTitle === 'string' && /ship the solve/i.test(res.reads.buttonTitle),
    '…and its title NAMES what pressing it will send',
    res.reads?.buttonTitle ?? '(no title)');

check(wasm !== null, 'the page published `__watch.wasm`', wasm ? wasm.stage : 'null');
if (wasm) {
    /**
     * ⛔ THE STAGES ARE ASSERTED AS A SEQUENCE, NOT AS A COUNT. A ship that
     * reached six of seven stages and a ship that reached six DIFFERENT ones
     * both report six.
     */
    const want = ['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain',
        'verdict'];
    check(JSON.stringify(wasm.reached) === JSON.stringify(want),
        '⛓ every stage was reached, in order, and none was skipped',
        `${JSON.stringify(wasm.reached)}`);
    check(wasm.refusal === null, 'no stage refused', JSON.stringify(wasm.refusal));
    check(wasm.status?.finished === true, 'the game reports the run FINISHED',
        `tick ${wasm.status?.tick}, level ${wasm.status?.level}, `
        + `(${wasm.status?.x}, ${wasm.status?.y})`);
    /**
     * ⛓⛓⛓ THE CLAIM THIS ROW EXISTS FOR. Everything above is reachable
     * headless; this line is not.
     */
    check(wasm.verdict?.agrees === true,
        '⛓⛓⛓ end-state verdict: AGREES — the real game ended where the JS model ended',
        `${wasm.verdict?.text} · Δx ${wasm.verdict?.deltas?.dx} Δy ${wasm.verdict?.deltas?.dy} `
        + `· level ${wasm.verdict?.deltas?.level} vs ${wasm.verdict?.deltas?.expectedLevel}`);
    /**
     * ── ⛓⛓⛓ THE CLAIM THE PER-TICK SLICE EXISTS FOR ─────────────────────────
     *
     * ⛔ THE DRAIN IS ASSERTED NON-EMPTY, SEPARATELY FROM THE VERDICT. A build
     * whose `botDrain` answered nothing degrades to the labelled end-state
     * verdict BY DESIGN, and a row that only read the verdict could not tell
     * that fallback from a real per-tick agreement — the fallback would read as
     * a quieter pass on the one claim this row is for (trap 403's shape at the
     * claim rather than at the readout).
     */
    check((wasm.drain?.observations ?? 0) > 0,
        '⛓ the game DRAINED its whole observation stream — a buffered read, once',
        `${wasm.drain?.observations ?? 'no drain'} observation(s), `
        + `${wasm.drain?.reportedTransitions ?? '?'} reported transition(s)`);
    check(wasm.verdict?.perTick?.kind === 'agrees',
        '⛓⛓⛓ wasm verdict: AGREES PER TICK — the real game reproduced the model '
        + 'observation for observation',
        `${wasm.verdict?.perTick?.text} (kind ${wasm.verdict?.perTick?.kind})`);
    /**
     * ⛓ THE TWO SIDES COUNTED THE SAME RUN. `botStatus.tick` is the game's own
     * counter and the drain is what it handed over; a stream shorter than the
     * run would make a per-tick `agrees` a claim about a prefix.
     */
    check(wasm.drain?.observations === (wasm.status?.tick ?? -1) + 1,
        '…and the drained stream is the WHOLE run, not a prefix of it',
        `${wasm.drain?.observations} observation(s) vs tick ${wasm.status?.tick} + 1`);
    /**
     * ⛔ AND BOTH BOUNDS ARE ON SCREEN. An `agrees` with no scope beside it
     * reads as "the real game reproduced the model" without saying against
     * WHAT, and a per-tick agreement still cannot see a defect in the code both
     * runtimes share (trap 389).
     */
    const verdictText = res.reads?.verdictText ?? '';
    check(/end state only/.test(verdictText),
        '⛔ …and the page prints the END-STATE bound beside it',
        verdictText.split('\n')[0]);
    check(/per tick against the JS MODEL/.test(verdictText)
        && /invisible here/.test(verdictText),
        '⛔⛔ …and the PER-TICK bound too — against the MODEL, and blind to what '
        + 'both runtimes SHARE',
        verdictText.split('\n')[0]);
    check(wasm.status?.tick === solve?.tickCount,
        'the game ran the SAME number of ticks the solve produced',
        `game ${wasm.status?.tick} vs solve ${solve?.tickCount}`);
}

/**
 * ⛔ `pageerror` ONLY — an uncaught exception in the page. A console `[error]`
 * line is not the same fact, and the first run of this row proved it: the run
 * died on an encoding error before making a claim, and the only page log it
 * carried was `[error] Failed to load resource: … 404`, which names NO FILE.
 * A claim reading that could only guess, and my guess (headed Chrome's
 * `/favicon.ico`, which headless never asks for) is **unverified** — the very
 * next run recorded ZERO non-2xx responses and the 404 has not recurred.
 *
 * ⇒ ⛓ THE DRIVER RECORDS EVERY NON-2xx **WITH ITS URL**, so the next
 * occurrence is a fact instead of a hypothesis, and the filter below excuses
 * one address BY NAME rather than tolerating 404s wholesale. A 404 on a module
 * is a finding; a 404 on a favicon is a browser being a browser — and which
 * one it was is now answerable.
 */
const IGNORABLE_404 = /\/favicon\.ico(\?|$)/;
const pageErrors = (res.console ?? []).filter((l) => /pageerror/i.test(l));
check(pageErrors.length === 0, 'no uncaught page errors during the ship',
    pageErrors.slice(0, 2).join(' | ') || 'none');
const bad = (res.bad_responses ?? []).filter((r) => !IGNORABLE_404.test(r));
check(bad.length === 0, 'and nothing the page ASKED FOR came back 4xx/5xx',
    bad.slice(0, 3).join(' | ')
    || `none (${(res.bad_responses ?? []).length} ignorable, e.g. the favicon)`);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
