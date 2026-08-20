#!/usr/bin/env node
/**
 * check-seedling-wasm-element — **ONE GENERATED LEVEL CONTAINING A NAMED
 * ELEMENT, SHIPPED TO THE REAL GAME AND VERDICTED PER TICK — HEADLESS.**
 *
 * PROCGEN ELEMENTS arc 5, ⚖ **ruling 5** (the standing acceptance gate): *each
 * NEW element family ships one generated level containing it to the real game
 * and verdicts per tick, via the cheapest arm that produces a tape.* Slice 3
 * adds the `chamber` family and this is the arm.
 *
 * ── ⛔ WHY IT IS NOT A FOURTH PLAN IN `check-seedling-wasm-ship.mjs` ──
 *
 * That row drives **real-GPU Windows Chrome** through `/mnt/c/Windows/py.exe`
 * by the standing ⚖ rule: it is a different machine, a different driver and a
 * prerequisite no runner has, and every Windows run is ANNOUNCED first. The
 * per-element gate is owed ONCE PER FAMILY and will be owed again by the arena
 * (slice 4), so it needs an arm that a session can run on the box it is
 * already sitting at. ⛓ Slice 1 proved the reach: a SHORT generated tape is
 * inside a headless swiftshader budget (154 ticks in 719 s, with a 224-cell
 * census competing for the machine), which is the whole reason the subject
 * below is chosen for its TICK COUNT and not for its prettiness.
 *
 * ⛔ **WHAT THIS ARM CAN SEE.** `?source=generate` ships the room the page
 * generated as a one-room level SET plus the certification tape that proved it
 * — and the model's whole observation stream carries level **900** while the
 * mounted set calls the same room **0**. A per-tick agreement is therefore the
 * 900→0 remap witnessed at EVERY observation, in a room built around an
 * element the game has never been shown before.
 *
 * ⛔ **AND WHAT IT CANNOT.** It is blind to any defect the two runtimes SHARE
 * (trap 389) — the instrument that compares the game against RECORDED oracles
 * is `verify-seedling-bot-differential.mjs`. And swiftshader emits a few
 * hundred `A valid external Instance reference no longer exists` page errors
 * during any headless ship; slice 1 measured a DENSE control emitting the same
 * number, so they are the renderer's and this row does not assert zero of
 * them (the Windows row does, and passes).
 *
 * ── ⛓⛓ THE SUBJECT IS MEASURED, NOT CHOSEN ───────────────────────────
 *
 * The defaults below are the SHORTEST tape found over `winding`/`branchy`/
 * `loopy`/`open` x seeds 1..16 x {10x10, 12x10} whose chamber PLACED and whose
 * `--areas=1` graph ACCEPTED: **`branchy` seed 5 at 10x10, 259 ticks, 3 locks
 * and 1 flag** (30 candidates; the runner-up is 273). So the level that ships
 * has the element in it AND a lock-and-key graph over the area it declared,
 * which is the whole of what slice 3 built — and it is short enough that
 * swiftshader's ~4.7 s/tick is twenty minutes rather than an afternoon. ⛔ The two preconditions are CLAIMS below and
 * not assumptions: a row that shipped a room whose element REFUSED would pass
 * while witnessing nothing (vacuity at the SUBJECT, slice 1 §9.6's lesson).
 *
 * Prerequisites: a dev server on :8000 at the REPO ROOT.
 *
 * Run:
 *   node scripts/procgen/check-seedling-wasm-element.mjs
 *   node scripts/procgen/check-seedling-wasm-element.mjs \
 *       --elements='chamber;w=2;h=3' --seed=5 --skeleton=branchy \
 *       --width=10 --height=10 --areas=1
 *
 * ⚠ QUOTE THE SPEC: `;` is a shell statement separator.
 */

import { chromium } from 'playwright';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const ELEMENTS = arg('elements', 'chamber;w=2;h=3');
const SEED = arg('seed', '5');
const SKELETON = arg('skeleton', 'branchy');
const BIOME = arg('biome', 'pre-sword');
const WIDTH = arg('width', '10');
const HEIGHT = arg('height', '10');
const AREAS = arg('areas', '1');
const COUNT = Number(arg('count', '1'));
/** ⛓ NAMED, AND THE REFUSAL SAYS IT: a headless swiftshader ship is ~0.5
 *  ticks/s, so this is a wall-clock bound on the whole run and not a guess. */
const SHIP_SEC = Number(arg('shipsec', '2400'));

const WATCH = `${HOST}/frontend/modules/seedlingDemo/watch.html`
    + `?source=generate&seed=${SEED}&biome=${BIOME}&skeleton=${SKELETON}`
    + `&width=${WIDTH}&height=${HEIGHT}&elements=${encodeURIComponent(ELEMENTS)}`
    + `&areas=${AREAS}&count=${COUNT}&run=1`;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failed += 1;
};
const say = (l = '') => console.log(l);

const alive = await fetch(WATCH).then((r) => r.ok).catch(() => false);
if (!alive) {
    say(`SKIP: no dev server serving ${HOST} — start one at the REPO ROOT with `
        + '`python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}

say(`# a GENERATED level containing \`${ELEMENTS}\`, shipped to the real game, HEADLESS`);
say(`  ${WATCH}`);
say('');

/** ⛔ The WebGPU flags are `verify-seedling-wasm-bridge.mjs`' own and are not
 *  optional: without them the page reaches `runtime ready`, the ▶ click
 *  invokes `runSWF`, the renderer cannot initialise and `botStatus` never
 *  appears — a failure that looks like a tape problem and is not. */
const browser = await chromium.launch({
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(WATCH, { waitUntil: 'domcontentloaded' });

const t0 = Date.now();
/** ⛔ Poll a CONDITION, never "a readout exists" — a mid-run page has one. */
const until = async (expr, sec, what) => {
    for (let i = 0; i < sec * 2; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        if (await page.evaluate(`Boolean(${expr})`)) return true;
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(500);
    }
    check(false, `${what} — TIMED OUT after ${sec}s`, expr);
    return false;
};

/**
 * ⛔ THE WHOLE LADDER, NOT ITS FIRST `ok` (§18.15.5's trap): `status === 'ok'`
 * flips at every accepted step, so a wait on it alone ships step 1 of N.
 */
const ladder = await until(
    `window.__editorGenerate?.status === 'ok' && window.__editorGenerate?.step === ${COUNT}`
    + " && !document.getElementById('genRunAll').disabled"
    + " && !document.getElementById('loadWasm').disabled",
    600, 'the generator ran its WHOLE ladder');
if (!ladder) { await browser.close(); say(`\n${failed} FAILURE(S)`); process.exit(1); }

const gen = await page.evaluate(() => ({
    step: window.__editorGenerate.step,
    ticks: window.__editorGenerate.ticks,
    certified: window.__editorGenerate.certified,
    room: window.__editorGenerate.room,
    identity: window.__editorGenerate.identity,
    elements: window.__editorGenerate.elements ?? null,
    areas: window.__editorGenerate.areas ?? null,
}));
say(`  generated: ${JSON.stringify(gen.identity)}`);
say(`  room:      ${JSON.stringify(gen.room)}`);
say(`  elements:  ${JSON.stringify(gen.elements)}`);
say(`  areas:     ${JSON.stringify(gen.areas)}`);
say(`  ticks:     ${gen.ticks}   certified: ${gen.certified}`);
say('');

/**
 * ⛔⛔ THE PRECONDITIONS ARE CLAIMS. A ship whose element REFUSED is a ship of
 * an ordinary room, and reading `agrees per tick` off it would witness nothing
 * this gate is about.
 */
check(gen.step === COUNT, '⛔ the room that shipped is the LADDER\'S LAST step',
    `step ${gen.step} of ${COUNT}`);
check(gen.elements?.ran === true,
    '⛓⛓⛓ the shipped room really CONTAINS the element — it was PLACED, not refused',
    gen.elements?.ran ? `${gen.elements.placed?.[0]?.instance} at `
        + `(${gen.elements.placed?.[0]?.site?.x},${gen.elements.placed?.[0]?.site?.y})`
        : `REFUSED: ${gen.elements?.refused?.reason}`);
/**
 * ⛓⛓⛓ **THE SECOND PRECONDITION IS WHAT THE ELEMENT DECLARED** (arc 5, slice 4)
 * — the arc's own rule, applied to this gate rather than to the binding.
 *
 * Slice 3's family was the CHAMBER, whose whole point is to give a room an
 * AREA, so *"a lock-and-key graph was adjudicated over it"* is exactly the
 * fact that makes its ship non-vacuous. Slice 4's family is the ARENA, whose
 * point is a FIGHT: its own payload is `bodies` spinners and a `tset:-1` kill
 * lock on a main-path cut, and a graph over it is optional decoration. ⛔ A row
 * that demanded the graph of an arena would fail for a reason that has nothing
 * to do with the family it is gating; one that demanded nothing would ship an
 * ordinary room and read `agrees per tick` off it.
 */
const placed = gen.elements?.placed?.[0] ?? null;
if ((placed?.bodies?.length ?? 0) > 0) {
    check(Boolean(placed.killLockCell),
        '⛓⛓ …and the room really carries THIS element\'s payload — its bodies and the '
        + 'KILL LOCK their death opens',
        `${placed.bodies.length} body/bodies at `
        + `${placed.bodies.map((b) => `(${b.x},${b.y})`).join(' ')}, kill lock at `
        + `(${placed.killLockCell?.x},${placed.killLockCell?.y})`);
} else {
    check((gen.areas?.locks?.length ?? 0) > 0,
        '⛓⛓ …and a lock-and-key GRAPH was adjudicated over the room the element made',
        `${gen.areas?.locks?.length ?? 0} lock(s), ${gen.areas?.flags?.length ?? 0} flag(s), `
        + `refused ${gen.areas?.refused?.reason ?? 'no'}`);
}

await page.click('#loadWasm');
if (!await until("window.__watch?.wasm?.reached?.includes('runtime')", 600,
    'the ship reached `runtime` and is waiting for a REAL ▶ Start')) {
    await browser.close(); say(`\n${failed} FAILURE(S)`); process.exit(1);
}
/** ⛓ Playwright's click IS a real input event with real user activation — the
 *  page's own warning is about what the PARENT document can do, not a driver. */
const frame = page.frames().find((f) => /\/game\.html/.test(f.url()));
check(Boolean(frame), 'the game frame is mounted', frame?.url() ?? 'no /game.html frame');
if (!frame) { await browser.close(); say(`\n${failed} FAILURE(S)`); process.exit(1); }
await frame.click('#btn-start');

await until("window.__watch?.wasm?.reached?.includes('levels') || window.__watch?.wasm?.refusal",
    600, '⛓ the ONE-ROOM level set MOUNTED and was read back out of the artifact');
const finished = await until(
    "window.__watch?.wasm?.verdict && window.__watch.wasm.verdict.kind !== 'not-finished'",
    SHIP_SEC, '⛓ the ship reached `finished` — the real game ran the tape out');

const wasm = await page.evaluate(() => window.__watch?.wasm ?? null);
const verdictText = await page.evaluate(
    () => document.getElementById('wasmVerdict')?.textContent ?? '');
await browser.close();

say('');
say(`  ${Math.round((Date.now() - t0) / 1000)} s · reached ${JSON.stringify(wasm?.reached)}`);
say(`  drain   ${wasm?.drain?.observations} observation(s), `
    + `${wasm?.drain?.reportedTransitions} reported transition(s)`);
verdictText.split('\n').forEach((l) => l && say(`  verdict ${l}`));
say('');

check(finished && wasm !== null, 'the ship produced a verdict at all',
    wasm?.verdict?.kind ?? 'none');
if (wasm) {
    check((wasm.drain?.observations ?? 0) > 0,
        '⛓ the game DRAINED its whole observation stream — a buffered read, once',
        `${wasm.drain?.observations} observation(s)`);
    check(wasm.verdict?.perTick?.kind === 'agrees',
        '⛓⛓⛓ wasm verdict: AGREES PER TICK — the real game reproduced the model '
        + 'observation for observation, in a room built around this element',
        `${wasm.verdict?.perTick?.text} (kind ${wasm.verdict?.perTick?.kind})`);
    /**
     * ⛔ THE SENTENCE'S OWN COUNT, PARSED — three independent accounts of how
     * long the run was, asserted equal. `kind === 'agrees'` alone is the same
     * word an END-STATE agreement uses and would pass over a PREFIX.
     */
    const said = /agrees per tick \((\d+) observations?\)/.exec(wasm.verdict?.perTick?.text ?? '');
    const n = said ? Number(said[1]) : null;
    check(n !== null && n === (wasm.status?.tick ?? -1) + 1 && n === wasm.drain?.observations,
        '⛔⛔ …and the PER-TICK sentence\'s OWN count is the whole run',
        `sentence ${n} · drain ${wasm.drain?.observations} · game tick ${wasm.status?.tick} + 1`);
    check(wasm.verdict?.agrees === true,
        '⛓ end-state verdict: AGREES — the real game ended where the model ended',
        `${wasm.verdict?.text} · Δx ${wasm.verdict?.deltas?.dx} Δy ${wasm.verdict?.deltas?.dy}`);
    check(wasm.status?.level === 0,
        '⛔ …and the GAME was in room 0 the whole time — the 900→0 remap is what made a '
        + 'stream of 900s agree with it',
        `game level ${wasm.status?.level}, model record level 900`);
    check(wasm.status?.tick === gen.ticks,
        'the game ran the SAME number of ticks the certification produced',
        `game ${wasm.status?.tick} vs certification ${gen.ticks}`);
}
/** ⛓ NOT a claim — swiftshader's own noise (slice 1 measured a dense control
 *  emitting the same count). Printed so a reader is not surprised by it. */
say(`\n  [headless] ${pageErrors.length} page error(s) `
    + `— e.g. ${JSON.stringify(pageErrors[0] ?? 'none')}`);

say(`\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
