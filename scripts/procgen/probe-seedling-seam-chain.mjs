#!/usr/bin/env node
/**
 * probe-seedling-seam-chain — ⚖ §6.2's MEASUREMENT. Is a segment boundary
 * RNG-contiguous, and if not, by exactly how much, in which field?
 *
 * Region-atlas Phase 8, rung R7, slice 2. Brief:
 * `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.2 (the seam probe),
 * §6.2 (the open ruling), §9.6 items 1 and 4 (what slice 2 inherits).
 *
 * ── THE EXPERIMENT ────────────────────────────────────────────────────
 *
 * One walk, driven two ways:
 *
 *   CONTIGUOUS   `transition-west-return`'s 150 ticks in one run: L0 -> L94
 *                (t=61) -> L0 (t=109). One page, one RNG stream, no seam.
 *   SEGMENTED    the SAME inputs cut at t=61 — the L94 ARRIVAL, which is
 *                the constructor half-tile (296,168) with a fresh Player at
 *                zero velocity, i.e. R1's ENDS-MEET boundary exactly.
 *                Segment 1 runs 0..61 and LATCHES. Segment 2 is AUTHORED
 *                FROM THAT LATCH (`segmentBootFromLatch`, no hand-typed
 *                state anywhere) and runs the remaining 89 ticks in a fresh
 *                page.
 *
 * Then three comparisons, and the third is the ruling:
 *
 *   (a) THE DECLARATION  `seamFindings(latch(seg1) vs bootFields(seg2))` —
 *       does the authored tape actually declare what the latch measured?
 *       Offline, and it is the one part vitest can also see.
 *   (b) THE STREAM       segment 2's observation k against the contiguous
 *       run's observation 61+k, tick for tick. This is what a segmented
 *       playthrough CLAIMS.
 *   (c) THE ARRIVAL      segment 2's terminal latch against the contiguous
 *       run's, field by field over the whole SEAM_SIGNATURE. Exact ⇒ §6.2
 *       closes as RNG-contiguous. Any delta ⇒ it is NAMED, with numbers,
 *       and the ruling goes back to the user.
 *
 * ── ⚠ TWO-SIDED, BECAUSE THE QUALIFICATION CHANGES AT THE SHIELD ──────
 *
 * Slice 0 §8.2 item 5 and slice 1 §9.3 item 2: L0 holds the game's only
 * `moonrock`, whose `drawFlares` is 280 draws per RENDER frame, gated on
 * `Main.beam` — which `Shield.removed()` sets. So the overworld is
 * render-clean until D2's shield and render-coupled forever after, and a
 * probe run only in the clean case measures the easy half twice.
 *
 *   arm `clean`   no `beam`. The render-clean case.
 *   arm `beam`    the same walk with `beam: true` declared at the boot.
 *
 * ⛔ AND BOTH ARMS RUN PINNED (`pins: ["dead_frames"]`), DECLARED HERE
 * RATHER THAN DISCOVERED IN THE NUMBERS. Two reasons, and the first is
 * about correctness, not cost:
 *
 *  1. `save.time` is a `pinned-equality` signature row — `Game.as:832`'s
 *     `time += timeRate` sits below the `blackCover` gate but OUTSIDE it,
 *     so it counts DEAD frames, which are per-RENDER in vanilla. Unpinned,
 *     the beam arm would report a `save.time` delta that is a render-count
 *     artefact and not a seam fact, and §6.2 must not be ruled on a
 *     confounded measurement.
 *  2. Slice 1 measured `beam` at 112s -> 1107s and 18 -> 469 dead frames
 *     for ONE load (§9.3 item 2). Six unpinned runs of that shape is over
 *     three hours of wall clock to answer a question the pin removes.
 *
 * A third arm (`clean-unpinned`) isolates the pin itself, so "the pin
 * changed the answer" is a measurement here and not an assumption.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-seam-chain.mjs
 *   node scripts/procgen/probe-seedling-seam-chain.mjs --arms=clean,beam
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

const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const {
    SEAM_SIGNATURE, seamBootFields, seamFindings, seamLatchFindings, segmentBootFromLatch,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * ⛓ THE WALK IS `transition-west-return`'s, and the CUT is its own
 * transition record.
 *
 * L0 -> L94 at t=61, L94 -> L0 at t=109, 150 ticks. The cut is 61 because
 * that is the ARRIVAL: the committed expectation puts the player at exactly
 * (296,168) = (288 + 8, 160 + 8) there, which is `Game`'s constructor
 * half-tile over the teleporter's `{playerx: 288, playery: 160}`. A segment
 * boundary anywhere else in this tape could not be booted into at all —
 * `Game`'s ctor takes ints and adds 8, and every other tick's x is a float.
 */
const WALK = Object.freeze({
    boot: { level: 0, x: 80, y: 128 },
    inputs: [{ key: 'left', from: 0, to: 72 }, { key: 'right', from: 88, to: 140 }],
    tickCount: 150,
    cut: 61,
    /** What the committed expectation says the cut tick is, for a positive control. */
    cutObservation: { t: 61, x: 296, y: 168, level: 94 },
    segment2Boot: { level: 94, x: 288, y: 160 },
});

/** Clip an input span list to `[0, end)` and shift it by `-offset`. */
function spansIn(inputs, start, end) {
    return inputs
        .map((s) => ({ key: s.key, from: Math.max(s.from, start), to: Math.min(s.to, end) }))
        .filter((s) => s.to > s.from)
        .map((s) => ({ key: s.key, from: s.from - start, to: s.to - start }));
}

const baseTape = (over) => ({
    tape_version: 8,
    game: 'seedling',
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: [],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 0, split: false, cosmetic: 0, fp: 0 },
    seam: null,
    ...over,
});

/**
 * The three arms. `beam` is the one field that differs between arm 1 and
 * arm 2 — the pair discipline the arc runs on, with the pin held constant
 * across them and varied only in the third.
 */
const ARMS = Object.freeze({
    clean: { pins: ['dead_frames'], beam: false },
    beam: { pins: ['dead_frames'], beam: true },
    'clean-unpinned': { pins: [], beam: false },
});

const ARM_ARG = process.argv.filter((a) => a.startsWith('--arms='))
    .flatMap((a) => a.slice('--arms='.length).split(',')).filter(Boolean);
const SELECTED = ARM_ARG.length ? ARM_ARG : ['clean', 'beam', 'clean-unpinned'];
for (const a of SELECTED) {
    if (!ARMS[a]) {
        console.error(`unknown arm "${a}"; legal arms are ${Object.keys(ARMS).join(', ')}`);
        process.exit(2);
    }
}

// ⚠ THE SAME LAUNCH ARGS AS THE DIFFERENTIAL, and they are not optional:
// without a WebGPU/swiftshader adapter the recompiled page never reaches
// `Bot.init()`, so `botStatus` never registers and the probe times out
// waiting for a callback that was never going to arrive.
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

async function waitFor(page, desc, fn, timeoutMs = 120000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
        await page.waitForTimeout(500);
    }
}

async function runTape(label, tape) {
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
        }, 3600000);
        const drained = JSON.parse(await call(page, 'botDrain'));
        const seam = JSON.parse(await call(page, 'botSeam'));
        const secs = (Date.now() - t0) / 1000;
        console.log(`    ${label}: ${drained.ticks.length} observations, `
            + `${status.dead_frames} dead, ${secs.toFixed(0)}s`);
        return { status, ticks: drained.ticks, seam, secs };
    } finally {
        await page.close();
    }
}

/**
 * Field-by-field over the whole signature. Returns the DELTAS, by name.
 *
 * ⛔ `excluded` and `declared-not-compared` are skipped, and the second one
 * is a fact about the PAGE rather than about the seam: FlashPunk's LCG is
 * seeded once per page from one `Math.random()` (`Engine.as:50`) and every
 * run here is its own page, so `fp.seed` is two different random walks in
 * any pair of runs — a delta there would be noise reported as evidence.
 * Every FP consumer in this game is render-only (slice 0 §8.2 item 3), so
 * nothing behavioural rides on it. It is printed beside the verdict rather
 * than folded into it.
 */
function latchDelta(a, b) {
    const out = [];
    for (const row of SEAM_SIGNATURE) {
        if (row.comparable === 'excluded') continue;
        if (row.comparable === 'declared-not-compared') continue;
        const av = a?.[row.field];
        const bv = b?.[row.field];
        const sa = JSON.stringify(av);
        const sb = JSON.stringify(bv);
        if (sa === sb) continue;
        const numeric = typeof av === 'number' && typeof bv === 'number';
        out.push({
            field: row.field,
            comparable: row.comparable,
            contiguous: sa,
            segmented: sb,
            delta: numeric ? bv - av : null,
        });
    }
    return out;
}

async function runArm(armName) {
    const arm = ARMS[armName];
    const seamOf = (extra) => (arm.beam ? { beam: true, ...extra } : (extra ?? null));
    console.log(`\n## arm "${armName}" — pins ${JSON.stringify(arm.pins)}, `
        + `beam ${arm.beam}\n`);

    const contiguousTape = parseTape(baseTape({
        pins: arm.pins,
        seam: seamOf(null),
        boot: { ...WALK.boot },
        tick_count: WALK.tickCount,
        inputs: spansIn(WALK.inputs, 0, WALK.tickCount),
    }));
    const seg1Tape = parseTape(baseTape({
        pins: arm.pins,
        seam: seamOf(null),
        boot: { ...WALK.boot },
        tick_count: WALK.cut,
        inputs: spansIn(WALK.inputs, 0, WALK.cut),
    }));

    const contiguous = await runTape(`${armName}/contiguous`, contiguousTape);
    const seg1 = await runTape(`${armName}/segment-1`, seg1Tape);

    // ── the cut is where the committed expectation says it is ──────────
    const cutObs = contiguous.ticks.find((t) => t.t === WALK.cut);
    check(`${armName}: the contiguous run arrives in L94 at tick ${WALK.cut}, on the `
        + 'constructor half-tile',
        Boolean(cutObs) && cutObs.level === WALK.cutObservation.level
        && cutObs.x === WALK.cutObservation.x && cutObs.y === WALK.cutObservation.y,
        `${JSON.stringify(cutObs)} vs the committed expectation `
        + `${JSON.stringify(WALK.cutObservation)}`);
    const seg1Last = seg1.ticks[seg1.ticks.length - 1];
    check(`${armName}: segment 1 ends on the same arrival`,
        Boolean(seg1Last) && seg1Last.t === WALK.cut && seg1Last.level === cutObs?.level
        && seg1Last.x === cutObs?.x && seg1Last.y === cutObs?.y,
        `${JSON.stringify(seg1Last)}`);

    // ⛔ THE CALM-ARRIVAL INVARIANTS, REQUIRED — this is the first tape in
    // the arc that claims an arrival, so it is the first that may be asked.
    // The roster runs `requireCalm: false` because no fixture ends at one.
    const calm = seamLatchFindings(seg1.seam, { requireCalm: true });
    const notCalm = calm.filter((r) => !r.ok);
    check(`${armName}: segment 1's latch is a CALM ARRIVAL (requireCalm: true)`,
        notCalm.length === 0,
        notCalm.length === 0 ? `${calm.length - 1} signature rows, six invariants held`
            : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));

    // ── (a) the DECLARATION: the authored tape says what the latch said ─
    let seg2Tape = null;
    let authorError = null;
    try {
        const blocks = segmentBootFromLatch(seg1.seam);
        seg2Tape = parseTape(baseTape({
            ...blocks,
            tick_count: WALK.tickCount - WALK.cut,
            inputs: spansIn(WALK.inputs, WALK.cut, WALK.tickCount),
        }));
    } catch (e) {
        authorError = e.message;
    }
    check(`${armName}: segment 2 is AUTHORED FROM THE LATCH, with nothing typed`,
        seg2Tape !== null, authorError ?? 'segmentBootFromLatch -> parseTape, clean');
    if (!seg2Tape) return { armName, aborted: true };

    check(`${armName}: segment 2 boots where segment 1 ended`,
        seg2Tape.boot.level === WALK.segment2Boot.level
        && seg2Tape.boot.x === WALK.segment2Boot.x
        && seg2Tape.boot.y === WALK.segment2Boot.y,
        `${JSON.stringify(seg2Tape.boot)} vs ${JSON.stringify(WALK.segment2Boot)}`);

    const declaration = seamFindings([{
        name: `${armName} seg1->seg2`,
        exit: seg1.seam.seam,
        boot: seamBootFields(seg2Tape),
    }]);
    const unclaimed = declaration.filter((r) => !r.ok);
    check(`${armName}: the seam DECLARATION is whole — every signature row claimed`,
        unclaimed.length === 0,
        unclaimed.length === 0 ? `${declaration.length - 1} rows, all green`
            : unclaimed.map((r) => `${r.name} [${r.detail}]`).join('; '));

    const seg2 = await runTape(`${armName}/segment-2`, seg2Tape);

    // ── (b) THE STREAM, tick for tick ──────────────────────────────────
    const tail = contiguous.ticks.filter((t) => t.t >= WALK.cut);
    const shifted = seg2.ticks.map((t) => ({ ...t, t: t.t + WALK.cut }));
    const streamDiffs = [];
    for (let i = 0; i < Math.max(tail.length, shifted.length); i += 1) {
        const a = tail[i];
        const b = shifted[i];
        if (!a || !b || a.t !== b.t || a.x !== b.x || a.y !== b.y || a.level !== b.level) {
            streamDiffs.push({ i, contiguous: a, segmented: b });
        }
    }
    check(`${armName}: ⛓ THE STREAM — segment 2 reproduces the contiguous tail `
        + 'tick for tick',
        streamDiffs.length === 0,
        streamDiffs.length === 0
            ? `${tail.length} observations from tick ${WALK.cut} to `
                + `${WALK.tickCount}, identical`
            : `${streamDiffs.length} differing observation(s); first at index `
                + `${streamDiffs[0].i}: contiguous `
                + `${JSON.stringify(streamDiffs[0].contiguous)} vs segmented `
                + `${JSON.stringify(streamDiffs[0].segmented)}`);

    // ── (c) ⚖ THE ARRIVAL LATCH — §6.2's ruling, with its numbers ──────
    const deltas = latchDelta(contiguous.seam.seam, seg2.seam.seam);
    check(`${armName}: ⚖ THE ARRIVAL LATCH — every signature field EXACT across `
        + 'the seam',
        deltas.length === 0,
        deltas.length === 0
            ? `${SEAM_SIGNATURE.length} rows compared, zero deltas — the seam is `
                + 'RNG-contiguous in this arm'
            : `${deltas.length} field(s) DIFFER: `
                + deltas.map((d) => `${d.field} (${d.comparable}) contiguous `
                    + `${d.contiguous} vs segmented ${d.segmented}`
                    + `${d.delta === null ? '' : `, delta ${d.delta > 0 ? '+' : ''}${d.delta}`}`)
                    .join('; '));

    // ⛓ The one row the verdict deliberately does not carry, printed so the
    // exclusion is visible rather than silent.
    console.log(`  FP (declared-not-compared) ${armName}: contiguous `
        + `${contiguous.seam.seam['fp.seed']}, seg1 ${seg1.seam.seam['fp.seed']}, `
        + `seg2 ${seg2.seam.seam['fp.seed']} — three PAGES, three `
        + '`Math.random()` seeds (`Engine.as:50`); no gameplay consumer.');

    console.log(`  COST ${armName}: contiguous ${contiguous.secs.toFixed(0)}s/`
        + `${contiguous.status.dead_frames} dead, seg1 ${seg1.secs.toFixed(0)}s/`
        + `${seg1.status.dead_frames} dead, seg2 ${seg2.secs.toFixed(0)}s/`
        + `${seg2.status.dead_frames} dead`);

    // ⛓ THE MUSIC PAIR — slice 1 §9.4 printed it as a bound because a
    // 30-tick L0 window could not tell a boot write from the run's own. A
    // CHAIN can: segment 2 declares what segment 1 LATCHED, so if the pair
    // survives to segment 2's own arrival latch with the contiguous run's
    // value, the field is witnessed by the only test that matters — the
    // chain it exists for.
    const musicRows = ['static.Music.currentSet', 'static.Music.currentIndex'];
    const musicDelta = deltas.filter((d) => musicRows.includes(d.field));
    console.log(`  MUSIC ${armName}: seg1 latched `
        + `${JSON.stringify(seg1.seam.seam['static.Music.currentSet'])}/`
        + `${seg1.seam.seam['static.Music.currentIndex']}; seg2 declared it and ended at `
        + `${JSON.stringify(seg2.seam.seam['static.Music.currentSet'])}/`
        + `${seg2.seam.seam['static.Music.currentIndex']}; the contiguous run ended at `
        + `${JSON.stringify(contiguous.seam.seam['static.Music.currentSet'])}/`
        + `${contiguous.seam.seam['static.Music.currentIndex']} — `
        + `${musicDelta.length === 0 ? 'AGREE (the pair is carried across the seam)'
            : 'DIFFER (still a bound, and now a measured one)'}`);

    return {
        armName,
        deltas,
        streamDiffs: streamDiffs.length,
        cost: {
            contiguous: contiguous.secs,
            seg1: seg1.secs,
            seg2: seg2.secs,
            deadContiguous: contiguous.status.dead_frames,
            deadSeg1: seg1.status.dead_frames,
            deadSeg2: seg2.status.dead_frames,
        },
        latches: {
            contiguous: contiguous.seam.seam,
            seg1: seg1.seam.seam,
            seg2: seg2.seam.seam,
        },
        seg2Tape,
    };
}

const results = [];
try {
    console.log('# ⚖ §6.2 — the seam probe, two-sided\n');
    console.log(`walk: L0 -> L94 (t=${WALK.cut}) -> L0, ${WALK.tickCount} ticks; `
        + `cut at the L94 ARRIVAL (t=${WALK.cut})`);
    for (const armName of SELECTED) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await runArm(armName));
    }
} finally {
    await browser.close();
}

// ── THE VERDICT, as data ──────────────────────────────────────────────
console.log('\n## ⚖ THE VERDICT\n');
for (const r of results) {
    if (r.aborted) {
        console.log(`  ${r.armName}: ABORTED before the comparison`);
        continue;
    }
    console.log(`  ${r.armName}: stream ${r.streamDiffs === 0 ? 'IDENTICAL'
        : `${r.streamDiffs} DIFF`}, latch ${r.deltas.length === 0 ? 'EXACT'
        : `${r.deltas.length} field(s) DIFFER (${r.deltas.map((d) => d.field).join(', ')})`}`);
}
const allExact = results.every((r) => !r.aborted && r.deltas.length === 0);
console.log(`\n⇒ ${allExact
    ? '§6.2 CLOSES: RNG-contiguous everywhere, measured in every arm.'
    : '⛔ §6.2 DOES NOT CLOSE HERE — the per-field numbers above are the '
        + 'evidence the ruling needs. STOP and surface them.'}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
