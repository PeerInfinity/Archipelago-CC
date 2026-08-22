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
/**
 * ⛓ R9 slice 7b: the boot moved `r7-act2-4` -> `r8-solve-4` with the hand
 * chain's retirement (⚖ ruling 14). The two blocks were compared field by
 * field before the swap and are BYTE-EQUAL over all eleven boot fields
 * (`boot` `seam` `grants` `persistence` `equips` `pins` `save` `rng`
 * `noclip` `noHazards` `noDamage`), so this row boots the SAME L4 world it
 * always did — only the file that carries the block changed.
 */
const BOOT = 'frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-4.json';
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

/**
 * ══ ⛓⛓⛓ ARM 4: THE SEQUENCE — TWO WINDOWS, ONE GAME STATE ══════════════
 *
 * ⚖ Ruling 10 (user, 2026-08-20): *"I want the second tape to continue from the
 * game state at the end of the first tape. I don't want it to reload a fresh
 * page. And I want it to work like this for both JS playback and wasm
 * playback."* This is the wasm half, and it is the ONLY place it can be
 * measured: everything below `runtime` needs a real ▶ Start inside the frame.
 *
 * ⛔ THE SUBJECT IS THE ONE THE JS HALF ALREADY SETTLED. `?tapes=r8-d2` expands
 * to `[r8-d2-19, r8-d2-20]`, and the JS run of those two windows on ONE live
 * run reproduces the headline `r8-d2` tick for tick (1646 observations, first
 * differing tick −1) and ends equal. So a disagreement here is a fact about the
 * GAME, not about the plan.
 *
 * THE FOUR CLAIMS, in the order they can fail:
 *  1. **THE STAGES CARRY THE WINDOW VOCABULARY** and were reached IN ORDER —
 *     one `start`, two `drain`s, one `boundary` between them.
 *  2. **⛔ WINDOW 2 PAID NO DEAD FRAMES** (`director.continuationFindings`).
 *     This is the discriminating claim and nothing else can make it: a re-boot
 *     ERASES the drift that caused it — the next window's first observation
 *     lands exactly on its declared boot position, so the streams come back
 *     clean and the trace reports a continuation it did not make. What a
 *     re-boot cannot hide is `blackCover`'s room fade, ~19 frames and exactly
 *     20 under the R5 dead-frame pin. `dead_frames != 0` in a window that never
 *     left its room means `botStart` REBUILT the world.
 *  3. **EVERY WINDOW AGREES PER TICK** with its own model stream, AND the whole
 *     CONCATENATION agrees with the sequence's. Two windows can each agree with
 *     their own stream while the boundary between them lost a tick, so both are
 *     asked.
 *  4. **THE END STATE IS THE HEADLINE'S** — `r8-d2` alone ends at L13
 *     (104, 56), measured through the JS model.
 *
 * ⚠ AND THE BOUNDARY'S KEY RELEASES ARE REPORTED EITHER WAY (⚖ §6 Q8).
 * `r8-d2-19`'s last span is `{down 803..864}`, held through `tick_count`;
 * FlashPunk's `Input` is a static nothing clears, so the page dispatches the
 * same `keyup`s the Windows driver does. If the frame will not take them the
 * player DRIFTS, and `movedAtBoundary` is the number that says so.
 */
/**
 * ⛔ THE BOUND IS IMPORTED FROM THE MODULE THAT PUBLISHES IT — a literal here
 * would be a second copy that agreed until one was edited (trap 383).
 */
const { VERDICT_SCOPE: VERDICT_SCOPE_TEXT } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/watchWasm.js'));
/**
 * ⛓⛓ R9 SLICE 3 — THE WINDOW LIST AND EVERY NUMBER DERIVED FROM IT.
 *
 * The splice made `?tapes=r8-d2` THREE windows. This arm typed `2` in six
 * places — the labels, the stage list, `running 1/2`, `boundary 1/2`, and a
 * literal `W2_MODEL_DEAD_FRAMES = 170` — so a segment added to the chain
 * silently decayed the gate (trap 474) rather than reporting. Everything is
 * read from `PAGE_CHAINS` and from the model now.
 */
const { PAGE_CHAINS } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/director.js'));
const { stagesOf, BOOT_COST_FRAMES } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/watchWasm.js'));
const { loadTape } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/index.js'));
const { createTapeStepper } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const { atlasLevelSource: shipLevelSource } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));
/**
 * ⛓ R9 slice 5: the two constants the CHAIN arm's residual is DERIVED from —
 * `LOAD_FADE_FRAMES` computed from `BLACK_COVER`'s own decay loop, and
 * `BOOT_PRESWAP_FRAMES` measured with a negative control (R7 slice 2b). Two
 * constants that must agree are one constant; a literal here would be a number
 * nobody could re-derive when either moved.
 */
const { LOAD_FADE_FRAMES } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/gameClock.js'));
const { BOOT_PRESWAP_FRAMES } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));

/**
 * ⛔⛔⛔ R9 SLICE 3 — **THE SUBJECT IS THE PAIR, AND THE THREE-WINDOW CHAIN IS
 * A SECOND ARM THAT ASSERTS ITS REFUSAL.** Measured on the real GPU, and the
 * mechanism is `SEAM_PREBUILD_FIELDS`, working exactly as designed.
 *
 * `rng.gameplay` and `fp.seed` are PRE-BUILD signature rows: a segment
 * declares the stream position `botStart` will apply ABOVE its own build
 * (R7 slice 2b — the fix that deleted the seam-build-cost bridge). On a FRESH
 * PAGE that is exact: `botStart` writes the declared value and then BUILDS the
 * boot level, spending its draws. In a CONTINUATION `botStart` deliberately
 * does NOT rebuild (`Bot.as:1722-1725` — that is what makes it a
 * continuation), so those build draws are never spent.
 *
 * ⇒ **from window 3 on, a continuation's live stream is behind the committed
 * latch by exactly the window's boot-level build**, because every latch on the
 * roster was measured after a fresh-page replay of its own segment. Slice 2
 * could not see this: N was 2 and window 1 is always a fresh boot, so window
 * 2's declared latch was the only one asked. Measured here at `boundary 2/3`:
 *
 *   r8-d2-20 declares rng {seed 1823918582, fp 1752443622}
 *   the live game after [r8-solve-18, r8-d2-19] holds
 *                       {seed  954659063, fp 2069965047}   ← fp UNMOVED,
 *                                        = r8-d2-19's own boot fp, because
 *                                          L19 was never rebuilt
 *
 * ⛔ THE REFUSAL IS CORRECT AND IS NOT PAPERED OVER. ⚖ Slice 2's ruling: a
 * later window's declared staging is admitted iff it MATCHES the live state; a
 * mismatch is REFUSED BY NAME, never silently rebuilt. Applying 1823918582
 * would MOVE the world. And it cannot be fixed by re-recording: a boot that
 * matched a continuation would stop reproducing the DIFFERENTIAL's fresh-page
 * replay, which is the gate the whole roster rests on. ⇒ a ⚖ ask, recorded,
 * not a retry — and this file asserts the refusal so the fact has a gate.
 */
const SEQ_WINDOWS = ['r8-d2-19', 'r8-d2-20'];
const CHAIN_WINDOWS = PAGE_CHAINS['r8-d2'];
/**
 * ⛓⛓⛓ R9 SLICE 7b — THE CHAIN ARM BECOMES A FUNCTION OF A CHAIN ID, because a
 * SECOND chain now has to play: `r9-campaign`, 15 windows and 3470 ticks, the
 * whole true-start solver chain on the real GPU (§14.11/§15.11 named it twice
 * and never ran it).
 *
 * ⛔ IT IS A PARAMETERISATION, NOT A COPY. This file already says why
 * (trap 383, at the stage-list row): a second copy of a derivation agrees with
 * the first until somebody edits one. So `r8-d2`'s arm and `r9-campaign`'s are
 * the SAME code with the same claims, and a row that would be true of one and
 * not the other is a row about the CHAIN and not about the harness.
 */

/**
 * ⛓⛓⛓ EACH WINDOW'S OWN DEAD-FRAME SHARE, from the MODEL, over ONE run.
 *
 * `botStart` zeroes `dead_frames` at every arm, so window k's count is ITS
 * OWN — and the model knows the same number for the same window
 * (`levelRun.deadFramesOwed` read at each cut, differenced). A re-boot would
 * pay `blackCover`'s room fade ON TOP of it (~19 frames, exactly 20 under the
 * R5 dead-frame pin), so an EXACT match is the continuation, frame for frame.
 * See the CLAIM 2 note below for why this — and not
 * `continuationFindings` — is the makeable claim on a door-crossing subject.
 */
/**
 * ⛔⛔ R9 SLICE 7b — **THE FORWARD TIMED ROWS ARE APPENDED, REBASED**, and the
 * CAMPAIGN arm is what found that they were not.
 *
 * A resumed window does NOT apply its own staging — that is `createTapeStepper`'s
 * whole point, and applying it is what a REBUILD is. But `levelRun` reads a
 * tape's TIMED persistence rows AT CONSTRUCTION (`timedClears`, :533) and
 * refuses to compute a kill-lock clear itself, so a later window's `{level,tag}@at`
 * has to be handed over explicitly. Both shipped chain-steppers already do it —
 * `watchViewer.js` for the page and `census-seedling-campaign.mjs` for the
 * census — and this derivation was a THIRD copy that did not.
 *
 * It agreed with them for two slices because no chain it stepped had a forward
 * timed row in reach: `r8-d2`'s later windows declare none, and `r8-solve-18`'s
 * `{18,0}@385` is window 0's own, applied at construction. `r9-campaign` is the
 * first chain where it matters, and the model threw before the browser started:
 *
 *   levelRun: the removal of bob@48,80 at tick 1056 (an arrow kill) OPENS
 *   1 kill lock(s) in level 5 [{5,0}] — and the tape DECLARES no clear for them
 *
 * — chain tick 1056 is tick 326 of window 5 (`r8-solve-5`), whose own
 * `{5,0}@427` was never handed to the resumed run. Exactly the throw
 * `watchViewer.js`'s own docblock records slice 2 measuring at tick 1067 of
 * `act2-the-sword`, one chain over. ⇒ trap 383's shape, from the inside: a
 * second copy of a derivation agrees with the first until a subject arrives
 * that can tell them apart.
 *
 * ⛔ REBASED BY THE WINDOW'S OFFSET, because a tape's `at` is WINDOW-LOCAL and
 * the resumed run's `ticksCompleted` is the SEQUENCE's — an unrebased row fires
 * in whichever earlier window happens to span that tick, or never.
 */
const deadFrameSharesOf = (windows) => {
    const levelSource = shipLevelSource();
    const shares = [];
    let live = null;
    let owed = 0;
    let offset = 0;
    for (let i = 0; i < windows.length; i += 1) {
        const tape = loadTape(windows[i]);
        if (i > 0) {
            const forward = (tape.persistence ?? []).filter((c) => c.at !== undefined)
                .map((c) => ({ ...c, at: c.at + offset }));
            if (forward.length > 0) live.addTimedClears(forward);
        }
        const st = createTapeStepper(tape, i === 0
            ? { levelSource, onTick: (a, b, c, r) => { live = r; } }
            : { run: live, onTick: (a, b, c, r) => { live = r; } });
        for (let r = st.next(); !r.done; r = st.next()) { /* step to completion */ }
        const now = live.deadFramesOwed;
        shares.push(now - owed);
        owed = now;
        offset += tape.tick_count;
    }
    return shares;
};
const SEQ_DEAD_FRAME_SHARES = deadFrameSharesOf(SEQ_WINDOWS);

/**
 * ⛓⛓⛓ R9 SLICE 5 — THE SAME DERIVATION FOR THE **THREE-WINDOW CHAIN**, which
 * (d) makes measurable for the first time. Derived, never typed: trap 495 is
 * a gate that spelled a count and decayed when the count moved.
 */
/** ⛓ `r8-d2`'s own tick counts — the per-tick allowance every arm's deadline is
 *  derived from. `runChainArm` derives everything else per chain. */
const CHAIN_TICKS = CHAIN_WINDOWS.map((n) => loadTape(n).tick_count);

/**
 * ⛔⛔ THE DEADLINE IS DERIVED FROM THE CHAIN'S OWN TICK TOTAL (trap 495).
 *
 * `r8-d2` waits 1200 s for 2218 ticks of real GPU. That 1200 is the ONE
 * literal here and it keeps its provenance: it is the deadline this arm has
 * run green under since R9 slice 6, and nothing on disk records how long a
 * tick takes on the user's machine — a per-tick rate is a property of the
 * hardware, not of the repo, so nothing derives it. ⚖ ruling 17 allows a
 * literal exactly there, with the sentence saying why.
 *
 * Everything else comes off it. `r9-campaign` is 3470 ticks — 56% more — so a
 * typed 1200 would have killed the run about two thirds of the way through and
 * reported a TIMEOUT that was about the clock and not about the game. The
 * allowance is MEASURED off `r8-d2`'s throughput and multiplied by the other
 * chain's own tick total, so a re-record that lengthens either chain moves its
 * own deadline with it.
 */
const CHAIN_WAIT_SEC = 1200;
const CHAIN_TICK_TOTAL = CHAIN_TICKS.reduce((a, b) => a + b, 0);
const waitSecFor = (ticks) => Math.ceil((CHAIN_WAIT_SEC / CHAIN_TICK_TOTAL) * ticks);

/**
 * ⛓ THE END STATE IS READ OFF THE LAST WINDOW'S COMMITTED EXPECTATION — the
 * room and the pixel, not a level number typed into a claim string. `r8-d2`
 * ends L13 (104, 56); `r9-campaign` ends at L14's arrival (168, 72), which is
 * where route step 16's camera-band refusal stops the chain honestly.
 */
const endStateOf = (windows) => {
    const last = windows[windows.length - 1];
    const exp = JSON.parse(readFileSync(
        join(REPO, 'frontend/modules/seedlingDemo/fixtures/expectations', `${last}.json`),
        'utf8'));
    const t = exp.ticks[exp.ticks.length - 1];
    return `L${t.level} (${t.x}, ${t.y})`;
};

const SEQ_PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?tapes=${SEQ_WINDOWS.join(',')}&side=wasm`;
const SEQ_STEPS = [
    {
        what: 'the JS walk ADMITTED both windows and the ship reached `runtime`',
        wait: "window.__editorSequence?.admitted === true"
            + " && window.__watch?.wasm?.reached?.includes('runtime')",
        sec: 300,
    },
    { read: 'window.__editorSequence.windows.map((w) => w.label)', as: 'seqLabels' },
    { read: 'window.__watch.wasm.stages', as: 'stages' },
    // ⛔ THE ONE CLICK THE PAGE MAY NEVER MAKE.
    { frame_click: '#btn-start', frame: '/game.html', what: 'press ▶ Start INSIDE the frame' },
    {
        what: 'window 1 is running in the real game',
        wait: 'window.__watch?.wasm?.reached?.includes('
            + `'running 1/${SEQ_WINDOWS.length}')`,
        sec: 300,
    },
    {
        what: '⛓ the LAST boundary was crossed — every later window continues the '
            + 'SAME game',
        wait: 'window.__watch?.wasm?.reached?.includes('
            + `'boundary ${SEQ_WINDOWS.length - 1}/${SEQ_WINDOWS.length}')`,
        abort: 'window.__watch?.wasm?.refusal != null',
        sec: 900,
    },
    {
        what: '⛓⛓⛓ every window finished and the SEQUENCE has a verdict',
        wait: "window.__watch?.wasm?.verdict"
            + " && window.__watch.wasm.verdict.kind !== 'not-finished'"
            + " && window.__watch.wasm.reached?.includes('verdict')",
        abort: 'window.__watch?.wasm?.refusal != null',
        sec: 900,
    },
    { read: 'window.__watch.wasm', as: 'wasm' },
    { read: "document.getElementById('wasmVerdict').textContent", as: 'verdictText' },
];

{
    const res = drive(`▶ ${SEQ_WINDOWS.length} WINDOWS on ONE game state — `
        + `[${SEQ_WINDOWS.join(', ')}]`,
        SEQ_PAGE, SEQ_STEPS, 'watch-ship-sequence');
    check(res !== null && res.crashed !== true, 'SEQUENCE: the driver completed every step',
        res === null ? 'no results file — the driver died before writing one'
            : (res.error ?? `${res.steps.length} step(s)`));
    if (res === null) { console.log(`\n${failed} FAILURE(S)`); process.exit(1); }

    const wasm = res.reads?.wasm ?? null;
    check(JSON.stringify(res.reads?.seqLabels) === JSON.stringify([...SEQ_WINDOWS]),
        `SEQUENCE: ⛓ the chain HEADLINE expanded to its ${SEQ_WINDOWS.length} segments`,
        JSON.stringify(res.reads?.seqLabels));
    check(wasm !== null, 'SEQUENCE: the page published `__watch.wasm`',
        wasm ? wasm.stage : 'null');
    if (wasm) {
        wasm.__verdictText = res.reads?.verdictText ?? '';
        // ⛔ THE LIST IS THE PAGE'S OWN GENERATOR (trap 383: a second copy here
        //    would agree until one was edited).
        const want = stagesOf({ windows: SEQ_WINDOWS.length });
        check(JSON.stringify(wasm.reached) === JSON.stringify(want),
            `SEQUENCE: ⛓ CLAIM 1 — every stage reached IN ORDER, and ONE \`start\` for `
            + `${SEQ_WINDOWS.length} windows: \`freshFrame()\` and the human press happen `
            + 'once',
            JSON.stringify(wasm.reached));
        check(wasm.refusal === null, 'SEQUENCE: no stage refused',
            JSON.stringify(wasm.refusal));

        /**
         * ⛔⛔ CLAIM 2 IS NOT THE ONE THE BRIEF ASKED FOR, AND THE FIRST RUN IS
         * WHY. The brief asked for `continuationFindings` EMPTY —
         * `dead_frames == 0` on a continuation window. ⛓ MEASURED: every
         * window of `r8-d2` CROSSES A DOOR, and `continuationFindings` REFUSES
         * to answer for one that does, because a door's fade is not
         * attributable from there ("an unasserted check and a passing one must
         * not print the same thing" — its own rule). So the claim as briefed is
         * UNMAKEABLE on this subject, and a row reading `length === 0` off it
         * would have been asserting a green nobody could earn.
         *
         * ⛓⛓⛓ THE CLAIM THAT IS MAKEABLE, AND IT IS SHARPER: `botStart` zeroes
         * `dead_frames` at every arm, so window k's is ITS OWN — and the MODEL
         * knows the same number for the same window (`SEQ_DEAD_FRAME_SHARES`,
         * differenced out of ONE stepped run). A re-boot would pay
         * `blackCover`'s room fade ON TOP of that — ~19 frames, exactly 20
         * under the R5 dead-frame pin. So an EXACT match is the continuation,
         * frame for frame, on windows `continuationFindings` cannot speak for.
         *
         * ⛓ R9 slice 3: asked of EVERY continuation window, not just the
         * second. With three windows there are two boundaries, and a gate that
         * checked one of them would report a green for the other by silence.
         */
        for (let k = 1; k < SEQ_WINDOWS.length; k += 1) {
            const wk = (wasm.windows ?? [])[k] ?? null;
            check(wk !== null && wk.deadFrames === SEQ_DEAD_FRAME_SHARES[k],
                `SEQUENCE: ⛓⛓⛓ CLAIM 2 — WINDOW ${k + 1} ("${SEQ_WINDOWS[k]}") IS A `
                + 'CONTINUATION: its dead frames are the MODEL\'S OWN SHARE for that '
                + 'window, to the frame — a re-boot would have paid blackCover\'s fade '
                + '(20 under the R5 pin) on top',
                `game ${wk?.deadFrames} vs the model's ${SEQ_DEAD_FRAME_SHARES[k]} `
                + `(per-window shares [${SEQ_DEAD_FRAME_SHARES.join(', ')}])`);
            check(Array.isArray(wk?.continuation)
                && wk.continuation.every((f) => f.informational === true),
            `SEQUENCE: ⛓ …and \`continuationFindings\` raises NO refusal for window `
                + `${k + 1} — it reports UNASSERTED by name, because this window crosses `
                + 'a door',
            wk ? (wk.continuation ?? []).map((f) => f.what).join(' | ')
                : `no window ${k + 1} record`);
            check(wk !== null && wk.movedAtBoundary === false,
                `SEQUENCE: ⚠ …and the player did NOT drift into window ${k + 1} — the `
                + `\`keyup\`s the page dispatched released ${SEQ_WINDOWS[k - 1]}'s held keys`,
                wk ? `movedAtBoundary ${wk.movedAtBoundary}` : '');
        }

        for (const w of wasm.windows ?? []) {
            check(/agrees per tick/.test(w.verdict?.perTick?.text ?? ''),
                `SEQUENCE: ⛓⛓ CLAIM 3 — window "${w.label}" AGREES PER TICK with its own `
                + 'model stream', w.verdict?.perTick?.text ?? '(no per-tick verdict)');
        }
        check(wasm.verdict?.perTick?.agrees === true,
            'SEQUENCE: ⛓⛓⛓ CLAIM 3 — …AND THE WHOLE CONCATENATION AGREES PER TICK with the '
            + 'sequence\'s own model stream — two windows can each agree with their own and '
            + 'still lose the tick between them',
            `${wasm.verdict?.perTick?.text} (${wasm.verdict?.perTick?.observations} observation(s))`);
        check(wasm.verdict?.agrees === true,
            'SEQUENCE: ⛓⛓⛓ CLAIM 4 — the END STATE is where the chain ENDS — L13 (104, 56)',
            `${wasm.verdict?.text} · Δx ${wasm.verdict?.deltas?.dx} Δy ${wasm.verdict?.deltas?.dy} `
            + `· level ${wasm.verdict?.deltas?.level} vs ${wasm.verdict?.deltas?.expectedLevel}`);
        /**
         * ⛔ `perTickClaims` IS NOT CALLED HERE, and the first run is why. Three
         * of its five rows read the PAINTED `#wasmVerdict`, which is the ▶ load-
         * in-wasm BUTTON's channel (⚖ D3). This arm is `?side=wasm` REPLAY,
         * whose readout deliberately does NOT paint the verdict's sentences —
         * ⚖ D4 forbids moving the strings the live pages row asserts on, and
         * `replayWasmReadout.onVerdict` says so in as many words. So the same
         * facts are asserted STRUCTURALLY off `__watch.wasm` instead of off a
         * readout this arm was designed not to write.
         */
        // ⛓ R9 slice 3: DERIVED. `sum(tick_count) + 1` — RECORD-THEN-ACT gives
        //   a window `tick_count + 1` observations and the boundary tick is
        //   shared, so the concatenation is one more than the sum. The literal
        //   1646 was the two-segment headline's, which the splice moved.
        const wantObs = SEQ_WINDOWS.reduce((n, x) => n + loadTape(x).tick_count, 0) + 1;
        check(wasm.verdict?.perTick?.observations === wantObs
            && wasm.drain?.observations === wantObs,
        'SEQUENCE: ⛔ …and THREE INDEPENDENT ACCOUNTS OF HOW LONG THE RUN WAS AGREE — the '
        + `per-tick verdict's own count, the CONCATENATED drain, and the tapes' ${wantObs}`,
        `per-tick ${wasm.verdict?.perTick?.observations} · drain `
        + `${wasm.drain?.observations} · windows `
        + `${(wasm.windows ?? []).map((w) => w.drain?.observations).join(' + ')}`);
        check(wasm.scope === VERDICT_SCOPE_TEXT,
            'SEQUENCE: ⛔ …and the END-STATE bound rides on the readout',
            wasm.scope ?? '(no scope)');
        check(/per tick against the JS MODEL/.test(wasm.verdict?.perTick?.text ?? '')
            || wasm.verdict?.perTick?.agrees === true,
        'SEQUENCE: ⛔⛔ …and the PER-TICK verdict is against the MODEL of these same tapes — '
        + 'blind, by construction, to a defect both runtimes SHARE',
        wasm.verdict?.perTick?.text ?? '');
    }
    pageHygiene(res, 'SEQUENCE');
}

/**
 * ⛔⛔⛔ R9 SLICE 6 — THE CHAIN ARM: `?tapes=r8-d2` IS THREE WINDOWS AND (d′)
 * MAKES ALL THREE RUN. **REWRITTEN FROM A REFUSAL INTO A SUCCESS.**
 *
 * ⛓ WHAT SLICE 3 MEASURED: `boundary 2/3` refused because window 2's
 * `botStart` APPLIED `r8-d2-19`'s declared seed/fp on a continuation
 * (`Bot.as:1772`, `:1782` — applied whenever non-zero) WITHOUT rebuilding
 * (`:1722-1725`), which rewound the live stream by exactly L19's build
 * (§11.12(iii), trap 492).
 *
 * ⛓ WHAT SLICE 5's (d) FIXED: the three stream positions are stripped from
 * the copy `botLoadTape` receives while the declaration stays ASSERTED
 * pre-vs-pre, so `rng` is no longer among the findings at any boundary. The
 * refusal MOVED to `seam.time`: declared 10213, live 10192, Δ **21** on three
 * independent chains, with every other seam row EQUAL (§13.6).
 *
 * ⛓⛓⛓ WHAT (d′) FIXES, ⚖ RULING 15: the copy declares
 * `seam.time + BOOT_COST_FRAMES`, so `Bot.as:1703`'s write lands the walk on
 * the phase its fresh-page recording began at, and by induction the segment's
 * own latch equals the successor's declaration. ⇒ **this arm no longer
 * asserts a refusal. It asserts the chain running end to end**, and the rows
 * are the same shape the SEQUENCE arm's are, plus (d′)'s own.
 *
 * ⛔ THE ARM THAT ASSERTED THE RESIDUAL IS NOT DELETED — IT IS INVERTED. The
 * residual is now asserted to be ZERO at both boundaries, read off the same
 * `live.blocks.seam` DATA slice 5 put on the record so no gate has to regex a
 * sentence (trap 269), and the boot cost is still IMPORTED and summed rather
 * than typed.
 */
/**
 * ⛔⛔⛔ R9 SLICE 7b — **THE INVERTED ARM: A CHAIN THAT REFUSES ASSERTS ITS
 * REFUSAL, BY NAME, WITH THE NUMBERS.**
 *
 * This is the shape slice 3 gave the CHAIN arm and slice 6 inverted when (d′)
 * closed it — *"the arm that asserted the residual is not deleted, it is
 * INVERTED"*. `r9-campaign` goes the other way: the whole true-start chain plays
 * on the real GPU for the first time and STOPS at boundary 5/15, so the arm
 * asserts exactly where and why, and inverts the day the chain continues.
 *
 * ⚖ A REFUSAL IN THIS ARM IS A FINDING ABOUT THE CHAIN ON THE GAME, published
 * by name — NEVER a tape fix. Nothing here re-records anything.
 *
 * ⛔ `REFUSES_AT` IS THE ONE MEASURED LITERAL, and it is a fact about the GAME
 * rather than about the repo: nothing on disk records which boundary the live
 * rng stream first parts company with the declaration, because the JS model
 * does not simulate the game's stream at all (which is why the page's own
 * sequence gate admits all fourteen boundaries in chromium and this arm does
 * not — the exact thing the CAMPAIGN row was owed for). Everything the arm
 * COMPARES it against is derived: the refusing tape is `WINDOWS[REFUSES_AT]`,
 * the declared seed is read off that tape, and the windows that DID run are
 * checked against their own tick counts.
 */
function assertChainRefuses(ARM, WINDOWS, res, wasm, wins, at, TICKS) {
    const N = WINDOWS.length;
    const tape = WINDOWS[at];
    const declared = loadTape(tape).rng ?? null;

    check(res.aborted === true && res.finished !== true,
        `${ARM}: ⛓ the driver STOPPED ON THE REFUSAL and still wrote its reads — a `
        + 'refusal costs seconds now, not the whole derived deadline',
        `aborted ${res.aborted} · steps ${res.steps?.length ?? 0} · reads `
        + `${Object.keys(res.reads ?? {}).length}`);
    check(wasm?.refusal != null,
        `${ARM}: ⛔⛔⛔ THE CHAIN REFUSES — and the refusal is DATA, not a timeout`,
        JSON.stringify(wasm?.refusal ?? null));
    check(wasm?.refusal?.stage === `boundary ${at}/${N}`,
        `${ARM}: ⛔⛔⛔ …AT BOUNDARY ${at}/${N} — window ${at + 1} ("${tape}") cannot `
        + `continue window ${at} ("${WINDOWS[at - 1]}")`,
        `stage ${wasm?.refusal?.stage}`);
    check(wasm?.refusal?.reason === 'window-cannot-continue',
        `${ARM}: ⛓ …and the reason is the ADMISSION's, refused BEFORE anything played`,
        `reason ${wasm?.refusal?.reason}`);
    check(typeof wasm?.refusal?.detail === 'string'
        && wasm.refusal.detail.includes(tape)
        && /declared `rng` is not the live world's/.test(wasm.refusal.detail),
    `${ARM}: ⛔⛔ …and it is the DECLARED \`rng\`, naming the tape`,
    (wasm?.refusal?.detail ?? '').slice(0, 200));
    /**
     * ⛓⛓⛓ THE SHARPEST ROW: the seed the refusal quotes as DECLARED is the one
     * this tape carries on disk. That is what makes the refusal a fact about
     * `${tape}`'s own declaration rather than about anything the page invented.
     */
    check(declared !== null
        && (wasm?.refusal?.detail ?? '').includes(String(declared.seed)),
    `${ARM}: ⛓⛓⛓ …and the DECLARED seed the refusal quotes is the one \`${tape}\` `
        + `carries on disk — ${declared?.seed}`,
    (wasm?.refusal?.detail ?? '').slice(0, 260));
    check((wins[at]?.admission ?? []).some((f) => !f.informational),
        `${ARM}: ⛓ …and window ${at + 1}'s own record carries the refusal too`,
        JSON.stringify((wins[at]?.admission ?? []).map((f) => f.detail?.slice(0, 90))));
    check(wins[at]?.drain == null,
        `${ARM}: ⛔ …and NOTHING of window ${at + 1} was stepped — refused at the `
        + 'boundary, not mid-walk', `drain ${JSON.stringify(wins[at]?.drain ?? null)}`);

    /** ⛓ AND THE WINDOWS THAT DID RUN ARE ASSERTED, not waved past. */
    check(wins.length === at + 1,
        `${ARM}: ⛓ the game reached window ${at + 1} of ${N} and no further`,
        `${wins.length} window record(s)`);
    for (let k = 0; k < at; k += 1) {
        check((wins[k]?.admission ?? []).every((f) => f.informational),
            `${ARM}: ⛓ boundary ${k}/${N} ADMITTED — window ${k + 1} ("${WINDOWS[k]}")`,
            JSON.stringify((wins[k]?.admission ?? []).map((f) => f.what)));
        check(wins[k]?.drain === TICKS[k] + 1,
            `${ARM}: ⛓ …and it drained its own ${TICKS[k]} + 1 observations`,
            `drain ${wins[k]?.drain}`);
        if (k > 0) {
            check(wins[k]?.movedAtBoundary === false,
                `${ARM}: ⛓ …and the player did not drift into it`,
                `movedAtBoundary ${wins[k]?.movedAtBoundary}`);
        }
    }
    console.log(`\n  ${ARM} — the chain reached ${at} of ${N - 1} boundaries:`);
    console.log('  #   window            ticks  drain  deadFrames  moved  clockBumped');
    for (let k = 0; k < wins.length; k += 1) {
        const wk = wins[k] ?? {};
        console.log(`  ${String(k + 1).padStart(2)}  ${WINDOWS[k].padEnd(16)}`
            + `${String(TICKS[k]).padStart(6)}  ${String(wk.drain ?? 'REFUSED').padStart(7)}`
            + `  ${String(wk.deadFrames ?? '—').padStart(10)}`
            + `  ${String(wk.movedAtBoundary ?? '—').padStart(5)}`
            + `  ${wk.clockBumped
                ? `${wk.clockBumped.declared} + ${wk.clockBumped.bootCost}` : '— (fresh)'}`);
    }
}

function runChainArm(ARM, CHAIN_ID, WINDOWS, REFUSES_AT = null) {
    const N = WINDOWS.length;
    const SHARES = deadFrameSharesOf(WINDOWS);
    const TICKS = WINDOWS.map((n) => loadTape(n).tick_count);
    const TICK_TOTAL = TICKS.reduce((a, b) => a + b, 0);
    const WHOLE_OBS = TICK_TOTAL + 1;
    const SEC = waitSecFor(TICK_TOTAL);
    const END = endStateOf(WINDOWS);
    const PAGE_URL = `${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?tapes=${CHAIN_ID}&side=wasm`;
    console.log(`\n# ${ARM}: ${N} window(s), ${TICK_TOTAL} tick(s), `
        + `deadline ${SEC}s (derived: ${CHAIN_WAIT_SEC}s / `
        + `${CHAIN_TICK_TOTAL}t x ${TICK_TOTAL}t), ends ${END}`);
    const res = drive(`▶ ${ARM} — ${N} window(s) as ONE CONTINUATION — [${WINDOWS.join(', ')}]`,
        PAGE_URL, [
            {
                what: 'the JS walk ADMITTED every window and the ship reached `runtime`',
                wait: "window.__editorSequence?.admitted === true"
                    + " && window.__watch?.wasm?.reached?.includes('runtime')",
                sec: 300,
            },
            { frame_click: '#btn-start', frame: '/game.html',
                what: 'press ▶ Start INSIDE the frame' },
            {
                what: `⛓ the LAST boundary (${N - 1}/${N}) was crossed — every later `
                    + 'window continues the SAME game',
                wait: 'window.__watch?.wasm?.reached?.includes('
                    + `'boundary ${N - 1}/${N}')`,
                /**
                 * ⛔⛔ R9 SLICE 7b — A REFUSAL ENDS THE WAIT, IN SECONDS.
                 *
                 * Neither of this arm's conditions can EVER become true once the
                 * page refuses a boundary, so a refusal used to cost the whole
                 * derived deadline and then arrive as `TimeoutError` — a sentence
                 * about the clock, with the page's own refusal (sitting in
                 * `__watch.wasm.refusal` within seconds) nowhere in it. Measured
                 * on the CAMPAIGN arm's first firing: the refusal was up almost
                 * immediately and the run sat on a dead page.
                 */
                abort: 'window.__watch?.wasm?.refusal != null',
                sec: SEC,
            },
            {
                what: '⛓⛓⛓ every window finished and the CHAIN has a verdict',
                wait: "window.__watch?.wasm?.verdict"
                    + " && window.__watch.wasm.verdict.kind !== 'not-finished'"
                    + " && window.__watch.wasm.reached?.includes('verdict')",
                abort: 'window.__watch?.wasm?.refusal != null',
                sec: SEC,
            },
            { read: 'window.__watch.wasm', as: 'wasm' },
            { read: 'window.__editorSequence.windows.map((w) => w.label)', as: 'seqLabels' },
        ], `watch-ship-${CHAIN_ID}`);
    /**
     * ⛓ R9 slice 7b: `aborted` is a THIRD outcome beside completed and crashed.
     * The driver stopped waiting because the page raised a refusal, ran the
     * plan's `read` steps anyway and flushed — so the arm has the stage list,
     * the refusal and every window record, and the row below names them instead
     * of reporting a timeout.
     */
    check(res !== null && res.crashed !== true && res.aborted !== true,
        `${ARM}: the driver completed every step`,
        res === null ? 'no results file'
            : (res.aborted
                ? `ABORTED — the page REFUSED: ${JSON.stringify(res.reads?.wasm?.refusal
                    ?? res.reads?.refusal ?? null)}`
                : (res.error ?? `${res.steps.length} step(s)`)));
    if (res !== null) {
        const wasm = res.reads?.wasm ?? null;
        const wins = wasm?.windows ?? [];
        const reached = wasm?.reached ?? [];
        if (REFUSES_AT !== null) { assertChainRefuses(ARM, WINDOWS, res, wasm, wins, REFUSES_AT, TICKS); pageHygiene(res, ARM); return; }
        check(JSON.stringify(res.reads?.seqLabels) === JSON.stringify([...WINDOWS]),
            `${ARM}: ⛓ the headline expanded to its ${N} segments`,
            JSON.stringify(res.reads?.seqLabels));
        // ⛔ THE LIST IS THE PAGE'S OWN GENERATOR (trap 383).
        check(JSON.stringify(reached) === JSON.stringify(stagesOf({ windows: N })),
            `${ARM}: ⛓⛓ CLAIM 1 — every stage reached IN ORDER, and ONE ▶ Start for ${N} `
                + 'windows', JSON.stringify(reached));
        check(wasm?.refusal === null || wasm?.refusal === undefined,
            `${ARM}: ⛔⛔⛔ CLAIM 2 — NO STAGE REFUSED. Slice 5 measured a refusal at `
                + `boundary ${N - 1}/${N} on \`seam.time\`; (d′) is what closes it`,
            JSON.stringify(wasm?.refusal ?? null));

        /**
         * ⛔⛔⛔ CLAIM 3 — EVERY BOUNDARY ADMITTED, AND THE RESIDUAL IS ZERO.
         * Read as DATA off `live.blocks.seam`, both halves: the clock row
         * agrees, and so does every other seam row (the pair is what makes
         * "the refusal was about the CLOCK and nothing else" checkable in the
         * direction where there is no refusal to read).
         */
        for (let k = 1; k < N; k += 1) {
            const wk = wins[k] ?? null;
            const refusedRows = (wk?.admission ?? []).filter((f) => !f.informational);
            check(refusedRows.length === 0,
                `${ARM}: ⛔⛔⛔ CLAIM 3 — boundary ${k}/${N} ADMITS — zero refusals`,
                JSON.stringify(refusedRows.map((f) => `${f.what}: ${f.detail}`)));
            const liveSeam = wk?.live?.blocks?.seam ?? null;
            const declaredSeam = loadTape(WINDOWS[k]).seam ?? null;
            check(liveSeam !== null && declaredSeam !== null
                && liveSeam.time === declaredSeam.time,
            `${ARM}: ⛔⛔⛔ …and the RESIDUAL AT BOUNDARY ${k}/${N} IS ZERO — slice 5 `
                + `measured ${LOAD_FADE_FRAMES} + ${BOOT_PRESWAP_FRAMES} = `
                + `${LOAD_FADE_FRAMES + BOOT_PRESWAP_FRAMES} here`,
            `declared ${declaredSeam?.time} vs live ${liveSeam?.time} `
                + `(Δ ${liveSeam && declaredSeam ? declaredSeam.time - liveSeam.time : '—'})`);
            check(liveSeam !== null && declaredSeam !== null
                && JSON.stringify(liveSeam) === JSON.stringify(declaredSeam),
            `${ARM}: ⛓ …and EVERY seam row at boundary ${k}/${N} is equal, `
                + '`time` included', liveSeam && declaredSeam
                ? (Object.keys(declaredSeam).filter(
                    (x) => JSON.stringify(declaredSeam[x]) !== JSON.stringify(liveSeam[x]))
                    .join(', ') || 'no differing row')
                : 'no blocks on the record');

            /**
             * ⛔⛔ CLAIM 4 — (d′) HAPPENED, AND THE PAGE SAYS SO AS DATA. The
             * bump is DERIVED here the same way the page derives it, so a
             * physics edit that moves either constant moves both sides.
             */
            const want = loadTape(WINDOWS[k]).seam?.time;
            check(wk?.clockBumped?.declared === want
                && wk?.clockBumped?.applied === want + BOOT_COST_FRAMES
                && wk?.clockBumped?.bootCost === BOOT_COST_FRAMES,
            `${ARM}: ⛔⛔ CLAIM 4 — window ${k + 1} was HANDED \`seam.time + bootCost\` `
                + `(${want} + ${BOOT_COST_FRAMES} = ${want + BOOT_COST_FRAMES})`,
            JSON.stringify(wk?.clockBumped ?? null));

            /** ⛓ (d)'s own row, kept: the rng was declared, asserted, NOT applied. */
            const decl = loadTape(WINDOWS[k]).rng ?? null;
            check(JSON.stringify(wk?.rngStripped ?? null) === JSON.stringify(decl
                ? { seed: decl.seed ?? 0, cosmetic: decl.cosmetic ?? 0, fp: decl.fp ?? 0 }
                : null),
            `${ARM}: ⛓ …and window ${k + 1} reports the rng it DECLARED, ASSERTED and did `
                + 'NOT APPLY', JSON.stringify(wk?.rngStripped ?? null));
            check(wk?.movedAtBoundary === false,
                `${ARM}: ⛓ …and the player did NOT drift into window ${k + 1}`,
                `movedAtBoundary ${wk?.movedAtBoundary}`);
        }
        check((wins[0] ?? {}).rngStripped === null
            && (wins[0] ?? {}).clockBumped === null,
        `${ARM}: ⛔ WINDOW 1 IS UNTOUCHED — a fresh boot applies everything it declares`,
        `rngStripped ${JSON.stringify(wins[0]?.rngStripped)} · clockBumped `
            + `${JSON.stringify(wins[0]?.clockBumped)}`);

        /**
         * ⛔⛔ CLAIM 5 — ALL THREE WINDOWS AGREE WITH THEIR OWN MODEL PER TICK,
         * and so does the whole concatenation. Two windows can each agree with
         * their own and still lose the tick between them.
         */
        for (const w of wins) {
            check(/agrees per tick/.test(w.verdict?.perTick?.text ?? ''),
                `${ARM}: ⛔⛔ CLAIM 5 — window "${w.label}" AGREES PER TICK with its own `
                    + 'model stream', w.verdict?.perTick?.text ?? '(no per-tick verdict)');
        }
        check(wasm?.verdict?.perTick?.agrees === true
            && wasm?.verdict?.perTick?.observations === WHOLE_OBS,
        `${ARM}: ⛔⛔⛔ CLAIM 5 — …AND THE WHOLE CONCATENATION AGREES PER TICK, over the `
            + `${WHOLE_OBS} observations the TAPES imply`,
        `${wasm?.verdict?.perTick?.text} (${wasm?.verdict?.perTick?.observations})`);
        check(wasm?.drain?.observations === WHOLE_OBS,
            `${ARM}: ⛓ …and the CONCATENATED DRAIN is the same number — `
                + `${TICKS.join(' + ')} + 1`,
            `drain ${wasm?.drain?.observations} · windows `
                + `${wins.map((w) => w.drain?.observations).join(' + ')}`);

        /**
         * ⛔⛔ CLAIM 6 — THE DEAD-FRAME SHARES, PER WINDOW, AGAINST THE MODEL'S
         * OWN — the one claim a door-crossing window can make (trap 488).
         *
         * ⚠ AND WINDOW 1 IS THE ONE EXCEPTION, MEASURED RATHER THAN EXCUSED
         * (§13.9(i)): a FRESH BOOT reads one MORE dead frame on the game than
         * the model counts, because `botStart` spends `BOOT_PRESWAP_FRAMES` in
         * the outgoing world before the swap and the model's boot fade starts
         * after it. Pre-existing, never asserted before this line, and DERIVED
         * from the same constant the bump is.
         */
        check(wins[0]?.deadFrames === SHARES[0] + BOOT_PRESWAP_FRAMES,
            `${ARM}: ⛔⛔ CLAIM 6 — window 1 is a FRESH BOOT and pays the model's share `
                + `PLUS the pre-swap frame — ${SHARES[0]} + `
                + `${BOOT_PRESWAP_FRAMES}`,
            `game ${wins[0]?.deadFrames} vs model ${SHARES[0]}`);
        for (let k = 1; k < N; k += 1) {
            check(wins[k]?.deadFrames === SHARES[k],
                `${ARM}: ⛔⛔ …and window ${k + 1} pays the MODEL'S SHARE EXACTLY — a `
                    + `re-boot would have added blackCover's fade (${LOAD_FADE_FRAMES}) `
                    + `on top — ${SHARES[k]}`,
                `game ${wins[k]?.deadFrames} vs model ${SHARES[k]} `
                    + `(shares ${JSON.stringify(SHARES)})`);
        }

        check(wasm?.verdict?.agrees === true,
            `${ARM}: ⛔⛔⛔ CLAIM 7 — the END STATE is where the chain ENDS, and the `
                + `chain reached it for the first time — ${END}`,
            `${wasm?.verdict?.text} · Δx ${wasm?.verdict?.deltas?.dx} Δy `
                + `${wasm?.verdict?.deltas?.dy} · level ${wasm?.verdict?.deltas?.level} `
                + `vs ${wasm?.verdict?.deltas?.expectedLevel}`);

        /**
         * ⛓ THE PER-WINDOW TABLE, PRINTED — the row this arm exists to publish.
         * Not a check: every column above is already asserted. It is here so a
         * fifteen-window run can be READ, and so a slice quoting it does not
         * have to reconstruct it out of forty PASS lines.
         */
        console.log(`\n  ${ARM} — per window (${N}):`);
        console.log('  #   window            ticks  deadFrames  model  moved  clockBumped');
        for (let k = 0; k < N; k += 1) {
            const wk = wins[k] ?? {};
            const want = k === 0 ? SHARES[0] + BOOT_PRESWAP_FRAMES : SHARES[k];
            console.log(`  ${String(k + 1).padStart(2)}  ${WINDOWS[k].padEnd(16)}`
                + `${String(TICKS[k]).padStart(6)}  ${String(wk.deadFrames ?? '—').padStart(10)}`
                + `  ${String(want).padStart(5)}  ${String(wk.movedAtBoundary ?? '—').padStart(5)}`
                + `  ${wk.clockBumped
                    ? `${wk.clockBumped.declared} + ${wk.clockBumped.bootCost}` : '— (fresh)'}`);
        }
    }
    pageHygiene(res, ARM);
}

runChainArm('CHAIN', 'r8-d2', CHAIN_WINDOWS);

/**
 * ⛓⛓⛓ R9 SLICE 7b — **THE CAMPAIGN ARM: THE WHOLE TRUE-START CHAIN ON THE
 * REAL GPU.** `?tapes=r9-campaign&side=wasm` — 15 windows, 14 boundaries,
 * 3470 ticks, from L0's true game start to L14's arrival.
 *
 * ⛔ WHY IT WAS OWED. §14.11 named this row and did not run it ("a 15-window,
 * 3470-tick real-GPU pass and this session had already spent four"); §15.11
 * item 6 named it again. The JS tier plays all fifteen windows (§14.5) and the
 * page's own sequence gate plays them in chromium (CLAIM 9b/9c/9d, 3471
 * observations, ends {"t":3470,"x":168,"y":72,"level":14}). Until this arm
 * runs, the GAME has never played the chain it is the custody record for.
 *
 * ⛔ EVERY NUMBER IS DERIVED — the window list off `PAGE_CHAINS`, the tick
 * totals and observation count off the TAPES, the dead-frame shares off ONE
 * stepped model run, the deadline off `r8-d2`'s measured throughput, the end
 * state off the last window's committed expectation. Nothing about this arm is
 * typed, which is what `windows` typed as 14 (mutant (e)) is there to prove.
 *
 * ⚖ A REFUSAL HERE IS A FINDING ABOUT THE CHAIN ON THE GAME, published by
 * name — never a tape fix. No `--record` is licensed in this slice.
 */
runChainArm('CAMPAIGN', 'r9-campaign', PAGE_CHAINS['r9-campaign'], 5);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
