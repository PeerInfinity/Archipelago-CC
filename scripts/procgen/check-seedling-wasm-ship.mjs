#!/usr/bin/env node
/**
 * check-seedling-wasm-ship — **THE ONLY ARM THAT CAN SEE A REAL SOLVE'S VERDICT.**
 *
 * `watch.html`'s ▶ load-in-wasm button ships what the page holds into the real
 * recompiled Seedling and prints TWO verdicts beside the JS run's own answer:
 * the END STATE (did the real game finish where the model finished) and, since
 * the per-tick slice, the whole run TICK BY TICK. This row drives THREE ships
 * all the way to `finished`, past the `drain`, and reads both verdicts off the
 * page.
 *
 * ── ⛓⛓⛓ THREE PLANS, AND EACH ONE ANSWERS WHAT THE LAST COULD NOT ──
 *
 *   SOLVE     a committed staging, solved IN the page, its tape shipped. The
 *             tape's rooms are the atlas's own, so nothing is remapped.
 *   GENERATE  a room the page GENERATED, shipped as a one-room level SET plus
 *             the certification tape that proved it — and the model's whole
 *             observation stream carries level **900** while the mounted set
 *             calls the same room **0**. The per-tick verdict therefore rides
 *             `watchWasm.remapStreamRooms` at EVERY observation rather than at
 *             one, and until this plan existed that remap had never been
 *             witnessed across a stream against the real game (arc-3 §18.17.9
 *             residue 6: *"the GENERATE arm's per-tick verdict has never been
 *             SEEN"*). ⛔ It is a ROW gap, not a mechanism gap: the mechanism
 *             shipped with the per-tick slice and is unit-tested; what was
 *             missing was an arm that could run it against the real game.
 *   ROOM      ⛓⛓⛓ arc 5, slice 1 — a **MULTI-SCREEN, SHELL-FORMAT** generated
 *             room: 12x10, so the camera CLAMP stops pinning at 0 and the two
 *             runtimes each scroll with code they do not share; and 40 of its
 *             120 cells written, so most of its walls are cells that hold NO
 *             TILE AT ALL. Every level shipped before it was one screen and
 *             densely written, so neither claim had ever been put to the real
 *             game. See its own docblock for how the subject was measured.
 *
 * ⚠ IT IS NO LONGER THE ONLY ARM THAT CAN SEE `agrees per tick`.
 * `check-seedling-wasm-pages.mjs` now drives a 30-tick COMMITTED tape through
 * `?side=wasm` headless, on any root, and sees one there. What is still only
 * visible HERE is a verdict over a tape THE PAGE PRODUCED ITSELF — 255 ticks
 * from a solve, 360 from a generated room's certification — which swiftshader
 * would spend eight and twelve minutes rasterising respectively.
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
 *                          — for a SOLVE's tape and for a GENERATED room's
 *                          certification tape, both produced in the page
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
const SOLVE_STEPS = [
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

/**
 * ── ⛓⛓⛓ THE GENERATE PLAN — THE SUBJECT, AND WHY IT IS THIS SEED ─────
 *
 * ⛔ THE ROOM MUST HOLD AN ELEMENT AND ITS CERTIFICATION MUST HAVE PRODUCED A
 * TAPE, because the tape IS what gets shipped: the GENERATE arm sends the
 * one-room level set plus `displaySolve`'s tape, and a room whose display solve
 * refused arms no button at all (`setShippable`'s `why`). The biome DEFAULT
 * post-sword spec is `guard+killgate+blockpocket+chamber;w=2;h=3`, so which
 * element a seed draws is a DRAW and not a choice — this one was measured
 * rather than assumed:
 *
 *   node scripts/procgen/generate-seedling-level.mjs --seed=38 --biome=post-sword
 *   ⇒ element: guard+killgate+blockpocket+chamber;w=2;h=3 -> drew `killgate` —
 *     kill-gate door (5,6) [tag 1]; clearer (4,5); wall GREW 7 cell(s)
 *     ⛔⛔ CERTIFIED: true — SOLVED
 *     kept: 6 obstacle(s) over 11 attempt(s); solve 383 (skeleton) -> 360 (final)
 *
 * ⛓⛓⛓ **AND ARC 5 SLICE 6a MOVED THAT SPEC WITHOUT MOVING THIS SUBJECT** — the
 * default's `+` list went from three heads to four and its guard member started
 * drawing `len`, and seed 38's dump is **byte-identical apart from the spec's own
 * printed name**: the same `killgate`, the same door, the same clearer, the same
 * 7-cell grown wall, the same 360-tick tape, the same level sha. The list's ONE
 * `pick` landed on the same head, and `killgate` declares no parameter, so every
 * draw after the pick stayed where it was. ⇒ the subject did not need
 * re-picking and was not re-picked; the claim below
 * (`elementFamilies === ['killgate']`) stands as written.
 *
 * ⇒ a CERTIFIED KILL GATE — a room whose lock is opened by killing a live
 * spinner — and a 360-tick certification tape, which is ~19 s of real game at
 * the rig's measured ~18.6 ticks/s. ⛔ `--count=` is omitted above because the
 * CLI's default obstacle target IS 6; the URL names `count=6` because the ROW
 * has to wait for `step === 6` and a wait cannot read a default it did not name
 * (the two-streams law, from the instrument's side).
 *
 * ⛔⛔ AND THE WAIT IS FOR THE LADDER TO **FINISH**, NOT FOR ITS FIRST `ok`
 * (arc-3 §18.15.5, MEASURED there rather than reasoned): `?run=1&count=N`
 * publishes `status: 'ok'` at EVERY step, so a row that pressed on the first one
 * would ship step 1 while the mounted set named step N — the button title said
 * `step 3` and the set said `-4-`. Three independent readings say the ladder is
 * done: the published `step` equals the target, `#genRunAll` is re-enabled (the
 * page's own "the ladder is over"), and ▶ load in wasm is armed.
 */
const GEN_SEED = 38;
const GEN_BIOME = 'post-sword';
const GEN_COUNT = 6;
const GEN_PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?source=generate&seed=${GEN_SEED}&biome=${GEN_BIOME}&count=${GEN_COUNT}&run=1`;

const GENERATE_STEPS = [
    {
        what: '⛔ the generator ran its WHOLE ladder — not merely its first `ok`',
        wait: "window.__editorGenerate?.status === 'ok'"
            + ` && window.__editorGenerate?.step === ${GEN_COUNT}`
            + " && !document.getElementById('genRunAll').disabled"
            + " && !document.getElementById('loadWasm').disabled",
        sec: 300,
    },
    { read: 'window.__editorGenerate.step', as: 'genStep' },
    { read: 'window.__editorGenerate.ticks', as: 'genTicks' },
    { read: 'window.__editorGenerate.certified', as: 'genCertified' },
    { read: 'window.__editorGenerate.elements.certified', as: 'elementCertified' },
    {
        read: '(window.__editorGenerate.elements.placed ?? []).map((p) => p.family)',
        as: 'elementFamilies',
    },
    { read: "document.getElementById('loadWasm').title", as: 'buttonTitle' },
    { click: '#loadWasm', what: 'press ▶ load in wasm' },
    {
        what: 'the ship reached `runtime` and is waiting for a REAL ▶ Start',
        wait: "window.__watch?.wasm?.reached?.includes('runtime')",
        sec: 300,
    },
    { frame_click: '#btn-start', frame: '/game.html', what: 'press ▶ Start INSIDE the frame' },
    {
        what: '⛓ the ONE-ROOM level set MOUNTED and was read back out of the artifact',
        wait: "window.__watch?.wasm?.reached?.includes('levels') || window.__watch?.wasm?.refusal",
        sec: 300,
    },
    {
        what: '⛓ the ship reached `finished` — the real game ran the certification tape out',
        wait: "window.__watch?.wasm?.verdict && window.__watch.wasm.verdict.kind !== 'not-finished'",
        sec: 900,
    },
    { read: 'window.__watch.wasm', as: 'wasm' },
    { read: "document.getElementById('wasmVerdict').textContent", as: 'verdictText' },
];

/**
 * ── ⛓⛓⛓ THE ROOM-CONTRACT PLAN — A **MULTI-SCREEN, SHELL-FORMAT** ROOM ──
 *
 * PROCGEN ELEMENTS arc 5, slice 1 (⚖ rulings 1 and 2). The third plan, and the
 * first level this repo has ever shipped to the real game that is NOT one
 * screen and NOT densely written.
 *
 * ⛔ **WHAT MAKES IT A WITNESS RATHER THAN A THIRD SHIP.** Two claims neither
 * of the other plans can make:
 *
 *  1. **THE CAMERA BAND IS IN PLAY.** A 12-wide room is 192 px against a 160 px
 *     screen, so `cameraFor`'s clamp stops pinning the camera at 0 and the two
 *     runtimes each scroll with their own code — the JS model's `stepCamera`
 *     and the recompiled game's `Game.view()` share NOTHING. Every level
 *     shipped before this one was 10x10, where the clamp holds the camera at 0
 *     for the whole run and the disagreement could not arise.
 *  2. **NULL IS NOT WALL, IN THE REAL GAME.** The room is written in the
 *     `shell` fill: 40 tiles of a 120-cell rectangle, the other 80 ABSENT. The
 *     JS side proves the strip changes no tick (`procgenRoomContract.test.js`
 *     solves the same room dense and stripped and compares the whole verdict
 *     object); this is the arm that asks the RECOMPILED GAME the same question,
 *     and its answer is per-tick.
 *
 * ⛓ **THE SUBJECT WAS MEASURED, NOT CHOSEN.** Over `empty`/`winding` x seeds
 * 1..40 x {12x10, 14x10, 15x10, 20x10}, filtered to the rooms whose model
 * camera actually MOVES and whose display solve is under 200 ticks, seed 28 is
 * the shortest carved one: **154 ticks**, camera x 0 -> 32 (the whole range a
 * 12-wide room has), and **40 of 120 cells written**. ⛔ The tape being short is
 * what puts this claim inside a HEADLESS row's reach — slice 0's residue 4,
 * discharged: 154 ticks is under half of seed 38's 360, which headless ran in
 * ~20 minutes.
 *
 * ⛓⛓ **RE-MEASURED AT ARC 5 SLICE 6a, AND THE SUBJECT IS KEPT RATHER THAN
 * RE-PICKED — with the clause that could not be re-run NAMED.** The new biome
 * default draws a `chamber;w=2;h=3` into this room, where it REFUSES
 * (`the-entry-port-cannot-be-joined`), so the room ships element-less as before
 * — but pass 2 then keeps a different obstacle and the two numbers above move:
 *
 *     display solve   154 ticks  ->  **197 ticks**   (still under the 200 filter)
 *     cells written    40 of 120 ->  **79 of 120**   (41 still ABSENT)
 *
 * ⛔ THE "SHORTEST" HALF IS UNVERIFIED AND THAT IS SAID RATHER THAN IMPLIED.
 * Re-running the scan headlessly reproduces every clause except *"whose model
 * camera actually MOVES"*: the solve hands back an INPUT tape, not a position
 * trace, so the camera range cannot be derived without replaying the world. On
 * the two clauses that ARE computable the reconstruction picks `winding` 12x10
 * seed 26 at 73 ticks on BOTH sides of the change — i.e. it disagrees with the
 * published pick at the BASE commit too, which is how the missing clause was
 * identified rather than guessed. ⇒ seed 28 still satisfies every clause this
 * slice could check (carved, multi-screen, shell, under 200 ticks) and is KEPT;
 * a genuine re-pick wants a camera replay nobody has built.
 */
const ROOM_SEED = 28;
const ROOM_BIOME = 'pre-sword';
const ROOM_COUNT = 1;
const ROOM_W = 12;
const ROOM_H = 10;
const ROOM_PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?source=generate&seed=${ROOM_SEED}&biome=${ROOM_BIOME}&skeleton=winding`
    + `&width=${ROOM_W}&height=${ROOM_H}&fill=shell&count=${ROOM_COUNT}&run=1`;

const ROOM_STEPS = [
    {
        what: '⛔ the generator ran its WHOLE ladder — not merely its first `ok`',
        wait: "window.__editorGenerate?.status === 'ok'"
            + ` && window.__editorGenerate?.step === ${ROOM_COUNT}`
            + " && !document.getElementById('genRunAll').disabled"
            + " && !document.getElementById('loadWasm').disabled",
        sec: 300,
    },
    { read: 'window.__editorGenerate.step', as: 'genStep' },
    { read: 'window.__editorGenerate.ticks', as: 'genTicks' },
    { read: 'window.__editorGenerate.certified', as: 'genCertified' },
    /** ⛓ THE CHANNEL THE ROOM CLAIMS ARE ABOUT — published by the page for
     *  exactly this row (trap 430: read the channel the claim names). */
    { read: 'window.__editorGenerate.room', as: 'room' },
    { read: 'window.__editorGenerate.identity', as: 'identity' },
    { read: "document.getElementById('loadWasm').title", as: 'buttonTitle' },
    { click: '#loadWasm', what: 'press ▶ load in wasm' },
    {
        what: 'the ship reached `runtime` and is waiting for a REAL ▶ Start',
        wait: "window.__watch?.wasm?.reached?.includes('runtime')",
        sec: 300,
    },
    { frame_click: '#btn-start', frame: '/game.html', what: 'press ▶ Start INSIDE the frame' },
    {
        what: '⛓ the ONE-ROOM level set MOUNTED and was read back out of the artifact',
        wait: "window.__watch?.wasm?.reached?.includes('levels') || window.__watch?.wasm?.refusal",
        sec: 300,
    },
    {
        what: '⛓ the ship reached `finished` — the real game ran the tape out',
        wait: "window.__watch?.wasm?.verdict && window.__watch.wasm.verdict.kind !== 'not-finished'",
        sec: 900,
    },
    { read: 'window.__watch.wasm', as: 'wasm' },
    { read: "document.getElementById('wasmVerdict').textContent", as: 'verdictText' },
];

mkdirSync(WIN_WSL, { recursive: true });
writeFileSync(join(WIN_WSL, 'seedling-watch-ship-win.py'), readFileSync(DRIVER));

/**
 * ⛔ ONE PLAN = ONE BROWSER = ONE SHIP. The wasm cannot rewind (`botReset`
 * forgets the tape, not the world), so two ships in one document would make the
 * second one start wherever the first stopped and report it as data. The driver
 * opens and closes a browser per invocation, which is what keeps that law free.
 *
 * @returns {object|null} the driver's own results record, or null if it died
 *   before writing one — which is a RESULT and is claimed as such.
 */
function drive(label, url, steps, stem) {
    const planWsl = join(WIN_WSL, `${stem}-plan.json`);
    const outWsl = join(WIN_WSL, `${stem}-results.json`);
    writeFileSync(planWsl, JSON.stringify({ url, steps }));
    try { unlinkSync(outWsl); } catch { /* first run */ }

    console.log(`\n# ${label}`);
    console.log(`  ${url}\n`);

    let driverOut = '';
    try {
        driverOut = execFileSync(WIN_PY, [
            '-3.12', `${WIN_DOS}\\seedling-watch-ship-win.py`,
            '--plan', `${WIN_DOS}\\${stem}-plan.json`,
            '--out', `${WIN_DOS}\\${stem}-results.json`,
        ], { cwd: WIN_WSL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
        driverOut = [e.stdout, e.stderr].filter(Boolean).join('\n');
        console.log(`DRIVER FAILED: ${e.message}`);
    }
    driverOut.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`  ${l}`));
    console.log('');
    try { return JSON.parse(readFileSync(outWsl, 'utf8')); } catch { return null; }
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
function pageHygiene(res, arm) {
    const pageErrors = (res.console ?? []).filter((l) => /pageerror/i.test(l));
    check(pageErrors.length === 0, `${arm}: no uncaught page errors during the ship`,
        pageErrors.slice(0, 2).join(' | ') || 'none');
    const bad = (res.bad_responses ?? []).filter((r) => !IGNORABLE_404.test(r));
    check(bad.length === 0, `${arm}: and nothing the page ASKED FOR came back 4xx/5xx`,
        bad.slice(0, 3).join(' | ')
        || `none (${(res.bad_responses ?? []).length} ignorable, e.g. the favicon)`);
}

/**
 * ⛔ THE DETAIL MUST BE THE LINE THAT CARRIES THE MATCH, NOT LINE 0. The
 * readout is THREE lines on a GENERATE ship — the per-tick headline, the
 * end-state one, and the remap note, each with its own scope — and printing the
 * first line as evidence for a claim about the third reports a string that does
 * not contain what the claim just asserted. Caught on this row's own first
 * green run at the per-tick slice; kept as one spelling since.
 */
const lineWith = (text, re) => text.split('\n').find((l) => re.test(l))
    ?? `(no line matched ${re} in: ${text.split('\n')[0]})`;

/**
 * ── ⛓⛓⛓ THE CLAIMS BOTH SHIPS OWE, AND THE ONE THAT IS NOT AN ECHO ───
 *
 * ⛔ THE PER-TICK SENTENCE'S **OWN COUNT** IS PARSED AND COMPARED, not merely
 * its kind. `verdict.perTick.kind === 'agrees'` is the same word an END-STATE
 * agreement uses, so a row that asserted only that could not tell the two
 * verdicts apart — it would pass on a build whose per-tick channel was never
 * asked, exactly the way a `perTick: null` reads like "nobody asked" (trap
 * 403's shape, one level up at the CLAIM). The sentence carries the number of
 * observations the COMPARATOR saw; `botStatus.tick + 1` is the GAME's own
 * account of the same run and `drain.observations` is a third. Three accounts,
 * asserted equal, is what stops `agrees per tick` from being a claim about a
 * PREFIX.
 */
function perTickClaims(wasm, arm) {
    check((wasm.drain?.observations ?? 0) > 0,
        `${arm}: ⛓ the game DRAINED its whole observation stream — a buffered read, once`,
        `${wasm.drain?.observations ?? 'no drain'} observation(s), `
        + `${wasm.drain?.reportedTransitions ?? '?'} reported transition(s)`);
    check(wasm.verdict?.perTick?.kind === 'agrees',
        `${arm}: ⛓⛓⛓ wasm verdict: AGREES PER TICK — the real game reproduced the model `
        + 'observation for observation',
        `${wasm.verdict?.perTick?.text} (kind ${wasm.verdict?.perTick?.kind})`);
    const said = /agrees per tick \((\d+) observations?\)/.exec(
        wasm.verdict?.perTick?.text ?? '');
    const n = said ? Number(said[1]) : null;
    check(n !== null && n === (wasm.status?.tick ?? -1) + 1
        && n === wasm.drain?.observations,
        `${arm}: ⛔⛔ …and the PER-TICK sentence's OWN count is the whole run — three `
        + 'independent accounts of how long it was',
        `sentence ${n} · drain ${wasm.drain?.observations} · game tick `
        + `${wasm.status?.tick} + 1`);
    /**
     * ⛔ AND BOTH BOUNDS ARE ON SCREEN. An `agrees` with no scope beside it
     * reads as "the real game reproduced the model" without saying against
     * WHAT, and a per-tick agreement still cannot see a defect in the code both
     * runtimes share (trap 389).
     *
     * ⛔ THE DETAIL MUST BE THE LINE THAT CARRIES THE MATCH, NOT LINE 0. The
     * readout is TWO lines now — the per-tick headline and the end-state one,
     * each with its own scope — and printing the first line as evidence for a
     * claim about the second reports a string that does not contain what the
     * claim just asserted. Caught on this row's own first green run: both scope
     * claims passed while quoting a line neither of them was about.
     */
    const verdictText = wasm.__verdictText ?? '';
    check(/end state only/.test(verdictText),
        `${arm}: ⛔ …and the page prints the END-STATE bound beside it`,
        lineWith(verdictText, /end state only/));
    check(/per tick against the JS MODEL/.test(verdictText)
        && /invisible here/.test(verdictText),
        `${arm}: ⛔⛔ …and the PER-TICK bound too — against the MODEL, and blind to what `
        + 'both runtimes SHARE',
        lineWith(verdictText, /per tick against the JS MODEL/));
}

// ── ARM 1: SOLVE — a tape the page produced itself ───────────────────────
{
    const res = drive('▶ load in wasm, SOLVE, driven to `finished` on real-GPU Windows Chrome',
        PAGE, SOLVE_STEPS, 'watch-ship');
    check(res !== null && res.crashed !== true, 'SOLVE: the driver completed every step',
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

    check(wasm !== null, 'SOLVE: the page published `__watch.wasm`', wasm ? wasm.stage : 'null');
    if (wasm) {
        wasm.__verdictText = res.reads?.verdictText ?? '';
        /**
         * ⛔ THE STAGES ARE ASSERTED AS A SEQUENCE, NOT AS A COUNT. A ship that
         * reached six of seven stages and a ship that reached six DIFFERENT ones
         * both report six.
         */
        const want = ['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain',
            'verdict'];
        check(JSON.stringify(wasm.reached) === JSON.stringify(want),
            'SOLVE: ⛓ every stage was reached, in order, and none was skipped',
            `${JSON.stringify(wasm.reached)}`);
        check(wasm.refusal === null, 'SOLVE: no stage refused', JSON.stringify(wasm.refusal));
        check(wasm.status?.finished === true, 'SOLVE: the game reports the run FINISHED',
            `tick ${wasm.status?.tick}, level ${wasm.status?.level}, `
            + `(${wasm.status?.x}, ${wasm.status?.y})`);
        /**
         * ⛓⛓⛓ THE CLAIM THIS ROW EXISTS FOR. Everything above is reachable
         * headless; this line is not.
         */
        check(wasm.verdict?.agrees === true,
            'SOLVE: ⛓⛓⛓ end-state verdict: AGREES — the real game ended where the JS model ended',
            `${wasm.verdict?.text} · Δx ${wasm.verdict?.deltas?.dx} Δy ${wasm.verdict?.deltas?.dy} `
            + `· level ${wasm.verdict?.deltas?.level} vs ${wasm.verdict?.deltas?.expectedLevel}`);
        perTickClaims(wasm, 'SOLVE');
        check(wasm.status?.tick === solve?.tickCount,
            'SOLVE: the game ran the SAME number of ticks the solve produced',
            `game ${wasm.status?.tick} vs solve ${solve?.tickCount}`);
    }
    pageHygiene(res, 'SOLVE');
}

/**
 * ── ⛓⛓⛓ ARM 2: GENERATE — A ROOM THIS PAGE MADE, IN THE REAL GAME ────
 *
 * ⛔ WHAT THIS ARM CAN SEE THAT THE SOLVE ONE CANNOT: the 900→room-0 remap
 * across a WHOLE observation stream. Every observation of a generated walk
 * carries `level: 900` (`SEEDLING_DEFAULTS.level`) while `buildLevelSet` calls
 * the same room `0`, so a raw comparison would print `tick 0 differs … level=900
 * … level=0` on a ship that worked perfectly — a verdict about two id spaces, at
 * every tick instead of at one. `watchWasm.remapStreamRooms` is the one place
 * that mapping is written; this is the first arm that runs it against the real
 * game rather than against a fixture.
 */
{
    const res = drive('▶ load in wasm, GENERATE, driven to `finished` on real-GPU Windows Chrome',
        GEN_PAGE, GENERATE_STEPS, 'watch-ship-generate');
    check(res !== null && res.crashed !== true, 'GENERATE: the driver completed every step',
        res === null ? 'no results file — the driver died before writing one'
            : (res.error ?? `${res.steps.length} step(s)`));
    if (res === null) { console.log(`\n${failed} FAILURE(S)`); process.exit(1); }

    const wasm = res.reads?.wasm ?? null;
    /**
     * ⛔ THE LADDER FINISHED, ASSERTED AS A NUMBER RATHER THAN AS A WAIT. The
     * wait above is what the driver blocked on; this is the row saying which
     * step the page was showing when the button was pressed, so a reader of the
     * log can tell a ship of step 6 from a ship of step 1 (§18.15.5's measured
     * defect, in the readout instead of in the reasoning).
     */
    check(res.reads?.genStep === GEN_COUNT,
        'GENERATE: ⛔ the room that shipped is the LADDER\'S LAST step, not its first',
        `step ${res.reads?.genStep} of ${GEN_COUNT}`);
    /**
     * ⛓ AND THE ROOM HOLDS AN ELEMENT WHOSE CERTIFICATION MADE THE TAPE. A
     * generated room with no element still ships and still verdicts — and would
     * witness the remap just as well — but it would not witness it over a room
     * whose puzzle is a live body the real game has to simulate.
     */
    check(res.reads?.elementFamilies?.length === 1
        && res.reads.elementFamilies[0] === 'killgate',
        'GENERATE: ⛓ the shipped room holds a KILL GATE — a lock opened by killing a live body',
        `placed families ${JSON.stringify(res.reads?.elementFamilies)}`);
    check(res.reads?.elementCertified === true && res.reads?.genCertified === true,
        '…and BOTH certifications passed — the element\'s and the level\'s',
        `element ${res.reads?.elementCertified}, level ${res.reads?.genCertified}, `
        + `${res.reads?.genTicks} ticks`);
    check(typeof res.reads?.buttonTitle === 'string'
        && /ship this room as a ONE-ROOM level set/i.test(res.reads.buttonTitle),
        'GENERATE: …and the button title NAMES what pressing it will send',
        res.reads?.buttonTitle ?? '(no title)');

    check(wasm !== null, 'GENERATE: the page published `__watch.wasm`', wasm ? wasm.stage : 'null');
    if (wasm) {
        wasm.__verdictText = res.reads?.verdictText ?? '';
        /** ⛓ `levels` IS IN THIS SEQUENCE AND NOT IN SOLVE'S — it is conditional
         *  on DATA (a level set was given), never on a flag. */
        const want = ['probe', 'runtime', 'start', 'levels', 'tape', 'running', 'finished',
            'drain', 'verdict'];
        check(JSON.stringify(wasm.reached) === JSON.stringify(want),
            'GENERATE: ⛓ every stage was reached, in order, `levels` included',
            `${JSON.stringify(wasm.reached)}`);
        check(wasm.refusal === null, 'GENERATE: no stage refused', JSON.stringify(wasm.refusal));
        /**
         * ⛔ THE READBACK IS THE CLAIM, NOT THE DELIVERY. `levels` is only
         * entered once `botLevelSet` AGREED with what was sent, field by field —
         * the only check that does not share the sender's assumptions.
         */
        check(wasm.set?.rooms === 1 && typeof wasm.set?.set_id === 'string'
            && wasm.set.set_id.startsWith('watch-oneroom-'),
            'GENERATE: ⛓⛓ exactly ONE room mounted, under the set_id the exporter stamped',
            JSON.stringify(wasm.set ?? null));
        check(wasm.status?.finished === true, 'GENERATE: the game reports the run FINISHED',
            `tick ${wasm.status?.tick}, level ${wasm.status?.level}, `
            + `(${wasm.status?.x}, ${wasm.status?.y})`);
        /**
         * ⛔⛔ THE REMAP IS PRINTED, AND THE ROW READS IT **OFF THE READOUT**. A
         * verdict about two id spaces would print `disagrees (level 0≠900)` on a
         * perfect ship; the note beside the verdict is what lets a reader audit
         * which mapping was applied instead of inferring it from an agreement.
         *
         * ⛔ AND THE CHANNEL IS THE ONE THE CLAIM NAMES. The first cut asserted
         * `__watch.wasm.note` and FAILED on this row's own first Windows run,
         * because `publishShip` projected `{drain, label, reached, refusal,
         * scope, set, stage, stages, status, verdict}` and `note` was not in it:
         * the field was `undefined` while the readout said the line perfectly.
         * ⛓ **R9 slice 1 (E3) ADDED THE FIELD RATHER THAN KEEPING THE REGEX**,
         * so both claims are now askable of their own channel — the STRUCTURAL
         * one below reads `wasm.note`, and the READOUT one still reads the
         * painted text, because *does a reader SEE it* is a different question
         * from *which mapping did the ship apply* (trap 430's family: read the
         * channel you are making the claim about).
         */
        const genVerdictText = res.reads?.verdictText ?? '';
        /**
         * ⛓⛓⛓ **READ STRUCTURALLY SINCE R9 SLICE 1 (E3)** — `publishShip` now
         * projects `note`, so the claim *which mapping was applied* is asserted
         * off the SHIP's own field instead of by regexing the painted string.
         * ⛔ THE READOUT CLAIM STAYS BESIDE IT and is still a regex, because it
         * is a different claim: *does the reader SEE the mapping named*. Two
         * facts, two channels — the row that collapsed them into one regex was
         * asserting the second and being credited for the first.
         */
        check(wasm.note !== null && wasm.note !== undefined,
            'GENERATE: ⛓⛓ the SHIP PUBLISHES its verdict note — a field, not a painted string',
            JSON.stringify(wasm.note));
        check(typeof wasm.note === 'string' && /remapped 900\u21920/.test(wasm.note),
            'GENERATE: ⛓⛓⛓ …and the note IS the 900→0 remap, read STRUCTURALLY',
            String(wasm.note));
        check(/remapped 900\u21920/.test(genVerdictText),
            'GENERATE: ⛔ …and the readout NAMES it beside the verdict, where a reader sees it',
            lineWith(genVerdictText, /remapped/));
        check(wasm.verdict?.agrees === true,
            'GENERATE: ⛓⛓⛓ end-state verdict: AGREES — the real game ended where the JS '
            + 'model ended, in the REMAPPED room',
            `${wasm.verdict?.text} · Δx ${wasm.verdict?.deltas?.dx} Δy ${wasm.verdict?.deltas?.dy} `
            + `· level ${wasm.verdict?.deltas?.level} vs ${wasm.verdict?.deltas?.expectedLevel}`);
        perTickClaims(wasm, 'GENERATE');
        /**
         * ⛓⛓⛓ AND THE REMAP HELD AT EVERY TICK. The model's stream is all 900s
         * and the game's is all 0s; a per-tick `agrees` over the whole run is
         * the remap witnessed at each observation, and the game's own last
         * `level` says which id space the game was in while it agreed.
         */
        check(wasm.status?.level === 0,
            'GENERATE: ⛔⛔ …and the GAME was in room 0 the whole time — the remap is what '
            + 'made a stream of 900s agree with it',
            `game level ${wasm.status?.level}, model record level 900`);
        check(wasm.status?.tick === res.reads?.genTicks,
            'GENERATE: the game ran the SAME number of ticks the certification produced',
            `game ${wasm.status?.tick} vs certification ${res.reads?.genTicks}`);
    }
    pageHygiene(res, 'GENERATE');
}

// ── ARM 3: THE ROOM CONTRACT — a MULTI-SCREEN, SHELL-FORMAT generated room ──
{
    const res = drive('▶ load in wasm, a MULTI-SCREEN SHELL room, driven to `finished`',
        ROOM_PAGE, ROOM_STEPS, 'watch-ship-room');
    check(res !== null && res.crashed !== true, 'ROOM: the driver completed every step',
        res === null ? 'no results file — the driver died before writing one'
            : (res.error ?? `${res.steps.length} step(s)`));
    if (res === null) { console.log(`\n${failed} FAILURE(S)`); process.exit(1); }

    const wasm = res.reads?.wasm ?? null;
    const room = res.reads?.room ?? null;
    check(res.reads?.genStep === ROOM_COUNT,
        'ROOM: ⛔ the room that shipped is the LADDER\'S LAST step, not its first',
        `step ${res.reads?.genStep} of ${ROOM_COUNT}`);
    /**
     * ⛔⛔ THE TWO PRECONDITIONS ARE CLAIMS, NOT ASSUMPTIONS. A row that shipped
     * a 10x10 dense room and read `agrees per tick` off it would pass while
     * witnessing NOTHING this slice is about — the vacuity shape, at the
     * subject instead of at the assertion. Both are read off the page's own
     * `room` block, which is the channel the claim is about.
     */
    check(room?.width === ROOM_W && room?.height === ROOM_H && room?.multiScreen === true,
        'ROOM: ⛓⛓⛓ the shipped room is MULTI-SCREEN — bigger than the 10x10 pin every '
        + 'level shipped before it, so the CAMERA BAND is in play',
        `${room?.width}x${room?.height}, multiScreen ${room?.multiScreen}`);
    check(room?.fill === 'shell' && room?.tiles > 0 && room?.tiles < room?.cells,
        'ROOM: ⛓⛓⛓ …and it is written in the SHELL fill — the strip really ran, measured '
        + 'rather than taken off the flag',
        `${room?.tiles} of ${room?.cells} cell(s) written, fill ${room?.fill}`);
    /** ⛓ AND THE PAGE SAYS SO IN WORDS — the identity line names the room the
     *  level was built in, which until this slice it could not. */
    check(typeof res.reads?.identity === 'string'
        && new RegExp(`room: ${ROOM_W}x${ROOM_H}`).test(res.reads.identity)
        && /fill: shell/.test(res.reads.identity),
        'ROOM: ⛓ the page\'s IDENTITY LINE names the room and the fill',
        lineWith(res.reads?.identity ?? '', /room:/));
    check(typeof res.reads?.buttonTitle === 'string'
        && /ship this room as a ONE-ROOM level set/i.test(res.reads.buttonTitle),
        'ROOM: …and the button title NAMES what pressing it will send',
        res.reads?.buttonTitle ?? '(no title)');

    check(wasm !== null, 'ROOM: the page published `__watch.wasm`', wasm ? wasm.stage : 'null');
    if (wasm) {
        wasm.__verdictText = res.reads?.verdictText ?? '';
        const want = ['probe', 'runtime', 'start', 'levels', 'tape', 'running', 'finished',
            'drain', 'verdict'];
        check(JSON.stringify(wasm.reached) === JSON.stringify(want),
            'ROOM: ⛓ every stage was reached, in order, `levels` included',
            `${JSON.stringify(wasm.reached)}`);
        check(wasm.refusal === null, 'ROOM: no stage refused', JSON.stringify(wasm.refusal));
        check(wasm.set?.rooms === 1 && typeof wasm.set?.set_id === 'string'
            && wasm.set.set_id.startsWith('watch-oneroom-'),
            'ROOM: ⛓⛓ exactly ONE room mounted, under the set_id the exporter stamped',
            JSON.stringify(wasm.set ?? null));
        check(wasm.status?.finished === true, 'ROOM: the game reports the run FINISHED',
            `tick ${wasm.status?.tick}, level ${wasm.status?.level}, `
            + `(${wasm.status?.x}, ${wasm.status?.y})`);
        check(wasm.verdict?.agrees === true,
            'ROOM: ⛓⛓⛓ end-state verdict: AGREES — in a room the camera SCROLLED and whose '
            + 'walls are mostly not written at all',
            `${wasm.verdict?.text} · Δx ${wasm.verdict?.deltas?.dx} Δy ${wasm.verdict?.deltas?.dy}`);
        perTickClaims(wasm, 'ROOM');
        check(wasm.status?.level === 0,
            'ROOM: ⛔ …and the GAME was in room 0 the whole time — the 900→0 remap again, '
            + 'now over a room that is not one screen',
            `game level ${wasm.status?.level}, model record level 900`);
        check(wasm.status?.tick === res.reads?.genTicks,
            'ROOM: the game ran the SAME number of ticks the certification produced',
            `game ${wasm.status?.tick} vs certification ${res.reads?.genTicks}`);
    }
    pageHygiene(res, 'ROOM');
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
