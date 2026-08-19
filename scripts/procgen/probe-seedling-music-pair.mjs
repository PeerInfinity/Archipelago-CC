#!/usr/bin/env node
/**
 * probe-seedling-music-pair — the Music no-repeat pair, WITNESSED at last.
 * R7 slice 2, discharging §9.4's named bound.
 *
 * ── ⛔ §9.4's BOUND HAD THE WRONG CAUSE, AND THIS PROBE'S FIRST RUN IS
 *    WHAT SAID SO ──────────────────────────────────────────────────────
 *
 * `Music.currentSet`/`currentIndex` are two of the twenty-six fields the v8
 * `seam` block carries. Slice 1's probe declared them and could not witness
 * them, and wrote the reason down as: "the boot write lands at `botStart`,
 * and then THE LEVEL LOAD PLAYS A SOUND OF ITS OWN and `Music.playSound`
 * overwrites both fields, so what the latch reports at tick 30 is the RUN's
 * music in both arms" (§9.4).
 *
 * ⛔ THAT IS NOT WHAT HAPPENED. Measured here, in the same 30-tick L0
 * window with `beam` NOT declared: the undeclared arm ends at `""/-1` — the
 * fresh-page value, untouched. **Thirty ticks of L0 play no indexed sound
 * at all.** What overwrote slice 1's pair was the OTHER field its inert arm
 * declared: `beam: true` runs `Moonrock`'s five-second beam scene, which
 * plays "Light" and then drops the rock, which plays "Rock" — and the arm
 * declared five things at once, so the one that moved the music was read as
 * "the level load". [[feedback_pair_arms_share_the_input]] in a new
 * costume: an arm that varies five fields cannot attribute an effect to
 * one of them.
 *
 * ⇒ **THE SOUND-QUIET WINDOW §9.6 ITEM 3 ASKED FOR ALREADY EXISTED**, and
 * in it the pair is witnessed by the plainest possible means: declare it,
 * read it back, and get exactly what was declared.
 *
 * ── EXPERIMENT 1: THE READBACK, in the quiet window ───────────────────
 *
 *   arm `none`      declares no music — must end at `""/-1`, untouched
 *   arm `index-0`   declares `{set: "Rock", index: 0}` — must end there
 *   arm `index-1`   declares `{set: "Rock", index: 1}` — must end there
 *
 * Three distinct latched values from three declarations is a write that
 * lands and survives. `none` is the negative arm that makes it evidence:
 * without it, "declared and applied" and "the run happened to play that"
 * look identical.
 *
 * ── EXPERIMENT 2: THE DRAW COUNT, where a sound actually plays ────────
 *
 * The readback is not why the pair is in the signature. It is there because
 * it GATES A DRAW COUNT:
 *
 *     do { cplayIndex = Math.floor(Rng.cos() * sounds[strInd].length) }
 *     while (cplayIndex == currentIndex && sounds[strInd].length > 1
 *            && currentSet == strInd)                    // Music.as:726-733
 *
 * With `Rng.split` false (the default) `Rng.cos()` IS the gameplay stream,
 * so a forced redraw lands in `rng.gameplay` — the field the seam already
 * compares. But a window that plays NOTHING can never show it, which is why
 * experiment 1's own result made experiment 2 need a different window.
 *
 * A LEVEL ARRIVAL plays from the "Room" set (four sounds — `soundRoom`,
 * `Music.as:110` — so the rejection loop can fire), and R7's toy chain
 * measured both of its arrivals landing on index 0. So on a tape that
 * CROSSES a level boundary:
 *
 *   arm `room-0`    declares `{set: "Room", index: 0}` — COLLIDES with the
 *                   natural draw, so `playSound` must redraw: one extra
 *                   gameplay draw, and a latched index that is NOT 0
 *   arm `room-1`    declares `{set: "Room", index: 1}` — no collision, so
 *                   the natural draw stands: no extra draw, index 0
 *
 * ⛓ PREDICTED BEFORE IT RAN, both sides, from the toy chain's measurement.
 * If the two arms agree on `rng.gameplay`, the rejection loop did not fire
 * and the declaration did not reach it.
 *
 * ⚠ NO `beam` IN ANY ARM. The 280-draw moonrock flare is exactly the
 * render-side polluter that would drown a one-draw difference (slice 1
 * measured it at 18 -> 469 dead frames) — and it is also what confounded
 * §9.4.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-music-pair.mjs
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { loadTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/fixtures/index.js'));
const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const base = parseTape(loadTape('friction-stop'));
const v8 = (seam) => parseTape({
    tape_version: 8,
    game: 'seedling',
    boot: { ...base.boot },
    noclip: base.noclip,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: [],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    // ⚠ `split: false` ON PURPOSE. It is the default, and it is what makes
    // `Rng.cos()` a GAMEPLAY draw — so the rejection loop's extra draw lands
    // in `rng.gameplay`, the field the seam already compares. Under `split`
    // the same experiment would be about `rng.cosmetic` instead.
    rng: { seed: 0, split: false, cosmetic: 0, fp: 0 },
    ...(seam ? { seam } : {}),
    tick_count: base.tick_count,
    inputs: base.inputs.map((s) => ({ ...s })),
});

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});

const call = (page, name, arg) => page.evaluate(([n, a]) => {
    const g = window.__swfBridge && window.__swfBridge.game;
    if (!g || typeof g[n] !== 'function') return null;
    return a === undefined ? g[n]() : g[n](a);
}, [name, arg]);

async function waitFor(page, desc, fn, timeoutMs = 1800000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
        await page.waitForTimeout(500);
    }
}

async function runArm(label, tape) {
    const page = await browser.newPage();
    const t0 = Date.now();
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
        await page.click('#btn-start');
        await waitFor(page, 'bot callbacks',
            () => page.evaluate(() => !!(window.__swfBridge?.game?.botSeam)));
        const loaded = await call(page, 'botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape(${label}): ${loaded}`);
        const started = await call(page, 'botStart');
        if (started !== 'ok') throw new Error(`botStart(${label}): ${started}`);
        const status = await waitFor(page, `${label} to finish`, async () => {
            const st = JSON.parse(await call(page, 'botStatus'));
            return st.finished ? st : null;
        });
        const drained = JSON.parse(await call(page, 'botDrain'));
        const seam = JSON.parse(await call(page, 'botSeam')).seam;
        console.log(`    ${label}: rng.gameplay=${seam['rng.gameplay']} `
            + `rng.cosmetic=${seam['rng.cosmetic']} music=`
            + `${JSON.stringify(seam['static.Music.currentSet'])}/`
            + `${seam['static.Music.currentIndex']} `
            + `(${drained.ticks.length} obs, ${status.dead_frames} dead, `
            + `${((Date.now() - t0) / 1000).toFixed(0)}s)`);
        return { seam, ticks: drained.ticks };
    } finally {
        await page.close();
    }
}

try {
    console.log('# the Music no-repeat pair — two experiments, and the first one '
        + 'refuted §9.4\'s cause\n');

    // ── EXPERIMENT 1: the READBACK, in the sound-quiet window ─────────
    console.log('## 1. the readback — `friction-stop`, 30 ticks of L0, no beam\n');
    const none = await runArm('none', v8(null));
    const i0 = await runArm('index-0', v8({ music: { set: 'Rock', index: 0 } }));
    const i1 = await runArm('index-1', v8({ music: { set: 'Rock', index: 1 } }));
    const pair = (r) => `${JSON.stringify(r.seam['static.Music.currentSet'])}/`
        + `${r.seam['static.Music.currentIndex']}`;

    // ⛔ THE NEGATIVE ARM FIRST, because it is what makes the other two
    // evidence rather than coincidence — and because it is the measurement
    // that overturns §9.4.
    check('⛔ THIRTY TICKS OF L0 PLAY NO INDEXED SOUND — §9.4\'s cause is refuted',
        none.seam['static.Music.currentSet'] === ''
        && none.seam['static.Music.currentIndex'] === -1,
        `the undeclared arm ended at ${pair(none)}. §9.4 said "the level load plays a `
        + 'sound of its own and `Music.playSound` overwrites both fields"; the fresh-page '
        + `${pair(none)} is still there at tick 30. What moved slice 1's pair was the `
        + 'OTHER field its inert arm declared — `beam: true` runs the moonrock\'s '
        + 'five-second scene, which plays "Light" and then drops the rock ("Rock"). An '
        + 'arm that varies five fields cannot attribute an effect to one of them.');
    check('⛓ THE PAIR IS WITNESSED — declared, and read back exactly',
        i0.seam['static.Music.currentSet'] === 'Rock'
        && i0.seam['static.Music.currentIndex'] === 0
        && i1.seam['static.Music.currentSet'] === 'Rock'
        && i1.seam['static.Music.currentIndex'] === 1,
        `none ${pair(none)}, index-0 ${pair(i0)}, index-1 ${pair(i1)} — three `
        + 'declarations, three distinct latched values, and the negative arm untouched. '
        + '§9.4\'s bound is DISCHARGED: the sound-quiet window it asked for is the one '
        + 'slice 1 was already using, with one field too many in it.');
    check('…and the observation stream is UNMOVED in all three arms',
        JSON.stringify(none.ticks) === JSON.stringify(i0.ticks)
        && JSON.stringify(i0.ticks) === JSON.stringify(i1.ticks),
        JSON.stringify(none.ticks) === JSON.stringify(i0.ticks)
        && JSON.stringify(i0.ticks) === JSON.stringify(i1.ticks)
            ? `${none.ticks.length} observations, identical — a boot field a segment can `
                + 'carry without moving the run'
            : 'the declaration MOVED THE RUN; it would not be usable as a boot block');
    check('⛓ …and NO sound plays, so NO draw is taken — the rejection loop needs a '
        + 'window that plays something',
        none.seam['rng.gameplay'] === i0.seam['rng.gameplay']
        && i0.seam['rng.gameplay'] === i1.seam['rng.gameplay'],
        `all three end at rng.gameplay=${none.seam['rng.gameplay']}. `
        + '`Music.playSound` is never called in this window, so its do-while never runs '
        + 'and the declaration cannot cost a draw here. That is not the declaration '
        + 'failing to land (the readback above says it landed) — it is the wrong window '
        + 'for the second question, which is what experiment 2 is for.');

    // ── EXPERIMENT 2: the DRAW COUNT, across a level arrival ──────────
    console.log('\n## 2. the draw count — a tape that CROSSES a level boundary\n');
    const crossBase = parseTape(loadTape('r7-ends-meet-1'));
    const crossing = (music) => parseTape({
        ...JSON.parse(JSON.stringify(crossBase)),
        seam: { ...(crossBase.seam ?? {}), music },
    });
    const room0 = await runArm('room-0 (COLLIDES)', crossing({ set: 'Room', index: 0 }));
    const room1 = await runArm('room-1 (no collision)', crossing({ set: 'Room', index: 1 }));

    // ⛔⛔ THE PREDICTION WAS WRONG, AND THE SOURCE SAYS WHY — SO THE CHECK
    // IS THE CORRECTED CLAIM, NOT THE ORIGINAL ONE.
    //
    // Predicted (from the toy chain's arrivals both latching "Room"/0):
    // declaring index 0 collides, forces a redraw, costs a draw, and lands
    // elsewhere. MEASURED: both arms end IDENTICAL — same `rng.gameplay`,
    // both at "Room"/0. Then `Teleporter.as:91`:
    //
    //     Music.playSound(sound, soundIndex);   // sound = "Room", index 0
    //
    // ⛓ AN EXPLICIT INDEX. `playSound`'s do-while is inside
    // `if (intInd == -1)` (`Music.as:726`); with an index passed it runs
    // `cplayIndex = clamp(intInd, ...)` and TAKES NO DRAW AT ALL. So a level
    // ARRIVAL can never exercise the no-repeat pair — not because the
    // declaration failed to land (experiment 1 proves it lands), but because
    // the caller does not use the mechanism.
    //
    // ⇒ THE PAIR GATES A DRAW ONLY FOR IMPLICIT-INDEX CALLS ON A SET OF
    // LENGTH > 1. That is a real and BOUNDED claim, and the bound is named
    // below rather than left as "somewhere in the game".
    check('⛓ A LEVEL ARRIVAL CANNOT EXERCISE THE PAIR — it passes an EXPLICIT index',
        room0.seam['rng.gameplay'] === room1.seam['rng.gameplay']
        && room0.seam['static.Music.currentIndex'] === 0
        && room1.seam['static.Music.currentIndex'] === 0,
        `room-0 (declared "Room"/0) and room-1 (declared "Room"/1) both end at `
        + `${pair(room0)} / ${pair(room1)} with rng.gameplay=`
        + `${room0.seam['rng.gameplay']} in both. `
        + '`Teleporter.as:91` is `Music.playSound(sound, soundIndex)` with '
        + '`soundIndex = 0` — an EXPLICIT index, and `playSound`\'s rejection do-while '
        + 'is inside `if (intInd == -1)` (`Music.as:726`). With an index passed it '
        + 'clamps and takes NO draw. The declaration landed (experiment 1); the caller '
        + 'simply does not use the mechanism.');
    console.log('BOUND: the no-repeat pair decides a DRAW COUNT only where `playSound` '
        + 'is called WITHOUT an index, on a set of length > 1. Source census of '
        + 'implicit-index call sites: "Rock" x5 (2 sounds), "Text" x5 (2), "Boss Die" '
        + 'x4 (5), "Enemy Attack" x3+3 (4), "Other" x3+2 (5), "Lava" x3 (3), "Push '
        + 'Rock" x3 (1 — cannot fire), "Sword" x2 (3), "Wind" x2 (2), "Drill" x2 (2), '
        + '"Lock" x4 (1 — cannot fire) and ~20 singletons. NONE of them is a level '
        + 'transition, so no seam in a clean walk can be priced by this field — which '
        + 'is why the pair is carried as STATE and not as a draw budget. A window that '
        + 'swings a sword or takes damage is where the draw-count arm belongs, and it '
        + 'is not this rung\'s cheapest experiment.');
} finally {
    await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
