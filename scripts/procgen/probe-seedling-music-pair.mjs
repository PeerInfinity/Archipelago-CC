#!/usr/bin/env node
/**
 * probe-seedling-music-pair — the Music no-repeat pair, WITNESSED at last.
 * R7 slice 2, discharging §9.4's named bound.
 *
 * ── THE BOUND SLICE 1 PRINTED, AND WHY IT COULD NOT BE A CHECK ────────
 *
 * `Music.currentSet`/`currentIndex` are two of the twenty-six fields the v8
 * `seam` block carries. Slice 1's probe declared them, and could not
 * witness them: the boot write lands at `botStart`, and then the level load
 * plays a sound of its own and `Music.playSound` OVERWRITES both fields, so
 * what the latch reports at tick 30 is the RUN's music in both arms. §9.4
 * printed that as a bound rather than asserting a check that could only
 * pass by accident.
 *
 * ⛔ THE BOUND IS REAL AND THE WITNESS WAS IN THE WRONG PLACE. The pair is
 * not in the signature because anybody wants to read it back — it is there
 * because it GATES A DRAW COUNT:
 *
 *     do { cplayIndex = Math.floor(Rng.cos() * sounds[strInd].length) }
 *     while (cplayIndex == currentIndex && sounds[strInd].length > 1
 *            && currentSet == strInd)                    // Music.as:726-733
 *
 * So the observable effect of declaring the pair is not the pair. It is
 * ONE EXTRA `Rng.cos()` DRAW — and with `Rng.split` false (the default)
 * `Rng.cos()` IS the gameplay stream, so the effect lands in `rng.gameplay`,
 * a field the latch already carries and the seam already compares.
 * [[feedback_graceful_fallback_vacuous_replay]]: assert the EFFECT in the
 * driven system, not the readout.
 *
 * ── THE PAIR, AND WHY IT NEEDS NO PRIOR KNOWLEDGE ─────────────────────
 *
 * L0's load plays from the "Rock" set, which has exactly two sounds
 * (`soundRock = [sndRock1, sndRock2]`, `Music.as:99`) — the minimum for the
 * rejection loop to be able to fire at all. Whatever index the run would
 * naturally draw first, it is 0 or 1. So:
 *
 *   arm `index-0`   declares `music: {set: "Rock", index: 0}`
 *   arm `index-1`   declares `music: {set: "Rock", index: 1}`
 *   arm `none`      declares no music at all — the natural run
 *
 * EXACTLY ONE of the two declarations collides with the natural first draw
 * and forces a redraw. So:
 *
 *   · if the boot write LANDS, `index-0` and `index-1` MUST differ in
 *     `rng.gameplay`, and exactly one of them must equal `none`;
 *   · if the boot write is accepted and IGNORED — the one failure an
 *     inert-arm probe cannot see — all three are identical.
 *
 * That is a two-sided witness that needs to know nothing in advance about
 * which sound L0 happens to play, which is the half of this that a
 * hand-picked index would have got wrong.
 *
 * ⚠ `friction-stop` is the window: 30 ticks of pure deceleration in L0 with
 * nothing to collide with, and NO `beam` — the 280-draw moonrock flare is
 * exactly the render-side polluter that would drown a one-draw difference
 * (slice 1 measured it at 18 -> 469 dead frames).
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
const PAGE_NAME = 'seedling_bot_ap';
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
    console.log('# the Music no-repeat pair — witnessed by the DRAW COUNT\n');
    const none = await runArm('none', v8(null));
    const i0 = await runArm('index-0', v8({ music: { set: 'Rock', index: 0 } }));
    const i1 = await runArm('index-1', v8({ music: { set: 'Rock', index: 1 } }));

    const g = (r) => r.seam['rng.gameplay'];
    // ── ⛓ THE WITNESS ─────────────────────────────────────────────────
    check('⛓ THE MUSIC PAIR IS WITNESSED — declaring it MOVES the gameplay stream',
        g(i0) !== g(i1),
        g(i0) !== g(i1)
            ? `index-0 ends at ${g(i0)} and index-1 at ${g(i1)}. The two declarations `
                + 'differ in nothing but the no-repeat index, and exactly one of them '
                + 'collides with the draw `Music.playSound` would otherwise take — so '
                + 'one arm pays an extra `Rng.cos()` and the other does not. §9.4\'s '
                + 'bound is discharged: the pair is not readable at the latch (the run '
                + 'overwrites it) and it is MEASURABLE in the stream, which is where '
                + 'the signature carries it for.'
            : '⛔ IDENTICAL — the boot write was accepted and IGNORED, which is the one '
                + 'failure an inert arm cannot distinguish from success');
    // ── the anchor: exactly one arm is the natural run ─────────────────
    const matchesNone = [['index-0', g(i0)], ['index-1', g(i1)]]
        .filter(([, v]) => v === g(none)).map(([n]) => n);
    check('exactly ONE declaration is the run\'s own first draw', matchesNone.length === 1,
        `undeclared ends at ${g(none)}; ${matchesNone.length === 1
            ? `${matchesNone[0]} matches it, so the OTHER arm is the one that forced a `
                + 'redraw — which names which sound L0 plays without anyone having had '
                + 'to know it in advance'
            : `${matchesNone.length} arm(s) match it (${matchesNone.join(', ') || 'none'})`}`);

    // ── and the stream is UNMOVED, which is what makes it a seam field ─
    // ⚠ A pair that also shifted the player would be a boot field a segment
    // could not carry. One extra gameplay draw is a state difference with no
    // consumer in this 30-tick window; that it stays that way is the check.
    const s = (r) => JSON.stringify(r.ticks);
    check('…and the observation stream is UNMOVED in all three arms',
        s(none) === s(i0) && s(i0) === s(i1),
        s(none) === s(i0) && s(i0) === s(i1)
            ? `${none.ticks.length} observations, identical — the draw moved and nothing `
                + 'in this window consumed it'
            : 'the declaration MOVED THE RUN; it would not be usable as a boot block');

    console.log(`\nMUSIC LATCHES: none ${JSON.stringify(none.seam['static.Music.currentSet'])}/`
        + `${none.seam['static.Music.currentIndex']}, index-0 `
        + `${JSON.stringify(i0.seam['static.Music.currentSet'])}/`
        + `${i0.seam['static.Music.currentIndex']}, index-1 `
        + `${JSON.stringify(i1.seam['static.Music.currentSet'])}/`
        + `${i1.seam['static.Music.currentIndex']} — the READBACK is still the run's own `
        + 'music in every arm, exactly as §9.4 said. That bound stands; what is '
        + 'discharged is the claim that the field could not be witnessed at all.');
} finally {
    await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
