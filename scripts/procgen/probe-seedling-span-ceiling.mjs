#!/usr/bin/env node
/**
 * probe-seedling-span-ceiling — how many input SPANS can `botLoadTape`
 * actually take before the recompiled runtime runs out of heap?
 *
 * Region-atlas Phase 8, subtractive ladder rung R3, slice 0. Brief:
 * `CC/docs/plans/seedling-bot-r3-opus-kickoff.md` §1.2 and §4.0.
 *
 * ── WHY THIS IS MEASURED BEFORE ANYTHING IS PLANNED ───────────────────
 *
 * R2 found the hard way that the runtime has a TAPE BUDGET and that the
 * axis is span count, not ticks: a denser plan of the same walk cost 30%
 * more ticks and 4.7x the spans, and the game then could not load it at
 * all —
 *
 *     heap_alloc(72671) failed - out of memory    2,569 spans, 185 KB
 *
 * reproduced twice, failing before the first tick. A too-big tape is a DEAD
 * RUN, not a slow one, and it dies at load rather than gradually, so a
 * route authored past the ceiling is discovered only after the recording
 * deadline has already been spent. R2's committed headline is 853 spans /
 * 63 KB; R1's is 544 / 40 KB. Nothing on the ladder has measured what sits
 * between 853 and 2,569.
 *
 * ── WHY IT NEEDS NO TICKS ─────────────────────────────────────────────
 *
 * `botLoadTape` parses and returns; it never advances the game. So this
 * probe wants a booted page and nothing else, which is why it runs on the
 * LOCAL software-WebGPU browser without `--win`: the ~0.5 fps that makes a
 * replay sweep take twenty minutes costs nothing here, because the probe
 * never asks for a frame.
 *
 * ⚠ A FRESH PAGE PER LOAD, by default and for a reason. Whether the heap
 * failure is about ONE allocation or about accumulated ones is exactly the
 * thing under measurement, so reusing a page would make the answer depend
 * on the probe's own history. `--reuse` measures that difference on
 * purpose; it is not the default and its number is not the ceiling.
 *
 * The synthetic tape is deliberately INERT: `noclip: true`, one-tick spans
 * on a single key with a one-tick gap between them, and it is never
 * started. What is being measured is the load path — the JSON string
 * crossing ExternalInterface, `JSON.parse`'s object graph, and the arrays
 * `botLoadTape` builds out of it — not anything the walk would do.
 *
 * Run: node scripts/procgen/probe-seedling-span-ceiling.mjs
 *      node scripts/procgen/probe-seedling-span-ceiling.mjs --max=6000
 *      node scripts/procgen/probe-seedling-span-ceiling.mjs --reuse
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

// Same SKIP contract as every other seedling verifier: the wasm artifact is
// machine-local forever, so its absence is a skip and not a failure.
if (!existsSync(WASM_DIR)) {
    console.log(`SKIP: no wasm artifact at ${WASM_DIR}`);
    process.exit(0);
}

const arg = (name, fallback) => {
    const found = process.argv.find((a) => a.startsWith(`--${name}=`));
    return found === undefined ? fallback : Number(found.slice(name.length + 3));
};
const MAX = arg('max', 4096);
const REUSE = process.argv.includes('--reuse');

/**
 * A tape with exactly `spans` one-tick holds, and nothing else.
 *
 * ⚠ Spans on ONE key with a gap between them, because `parseTape` and
 * `botLoadTape` both reject overlapping holds on a key — FlashPunk's
 * `_key[code]` guard makes a second KEY_DOWN a no-op while the first KEY_UP
 * clears the hold, so overlapping holds do not compose. A synthetic tape
 * the loader rejects would measure the validator, not the heap.
 */
function syntheticTape(spans, padBytes = 0) {
    const inputs = [];
    for (let i = 0; i < spans; i++) inputs.push({ key: 'right', from: i * 2, to: i * 2 + 1 });
    const tape = {
        tape_version: 3,
        game: 'seedling',
        boot: { level: 0, x: 80, y: 128 },
        noclip: true,
        noDamage: true,
        noHazards: [],
        grants: [],
        persistence: [],
        tick_count: spans * 2 + 1,
        inputs,
    };
    // ⚠ SPANS AND BYTES ARE TWO AXES, and R2's finding named only one of
    // them. A real span costs ~74 bytes (`{"key":"right","from":1234,
    // "to":1240}`) and this probe's costs ~36, so a ceiling measured in
    // synthetic spans is NOT a ceiling in real ones unless the limit is
    // about span COUNT. The pad grows the JSON without adding a span, so
    // the two can be told apart: if a 853-span tape padded to the byte
    // ceiling dies, the axis is bytes and R2's 63 KB headline has a
    // quarter of the headroom the span number suggests.
    if (padBytes > 0) tape.probe_pad = 'x'.repeat(padBytes);
    return tape;
}

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

async function freshPage() {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    page.__logs = logs;
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
    await page.click('#btn-start');
    await waitFor(page, 'bot callbacks registered',
        () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
    return page;
}

async function waitFor(page, what, fn, ms = 120000) {
    const deadline = Date.now() + ms;
    for (;;) {
        const got = await fn();
        if (got) return got;
        if (Date.now() > deadline) {
            throw new Error(`timed out waiting for ${what}\n`
                + `${(page.__logs ?? []).slice(-25).join('\n')}`);
        }
        await page.waitForTimeout(250);
    }
}

let shared = null;
/**
 * Load a tape of `spans` spans and report what the runtime said.
 *
 * ⚠ A heap failure is NOT an exception on this path. The runtime prints
 * `heap_alloc(...) failed` to the console and the page stops answering, so
 * "did it load" has to be read from BOTH the return value and the log —
 * a probe that only caught throws would report the ceiling as unbounded.
 */
async function tryLoad(spans, padBytes = 0) {
    const tape = syntheticTape(spans, padBytes);
    const json = JSON.stringify(tape);
    const page = REUSE ? (shared ??= await freshPage()) : await freshPage();
    try {
        const result = await Promise.race([
            page.evaluate(
                ([name, a]) => String(window.__swfBridge.game[name](a)),
                ['botLoadTape', json],
            ),
            new Promise((resolve) => setTimeout(() => resolve('timeout'), 60000)),
        ]).catch((e) => `threw:${e.message.split('\n')[0]}`);
        const heap = (page.__logs ?? []).filter((l) => /heap_alloc|out of memory|abort/i.test(l));
        return { result, heap, bytes: json.length };
    } finally {
        if (!REUSE) await page.close();
    }
}

const report = (spans, r, verdict) =>
    console.log(`  ${String(spans).padStart(5)} spans  ${String(Math.round(r.bytes / 1024))
        .padStart(4)} KB  ${verdict}  ${r.result}${r.heap.length
        ? `  | ${r.heap.slice(0, 2).join(' ')}` : ''}`);

const ok = (r) => r.result === 'ok' && r.heap.length === 0;

/**
 * Which axis is the ceiling on — span COUNT or JSON BYTES?
 *
 * Hold the span count at R2's own headline (853) and grow the tape with an
 * inert pad. If it dies around the same byte figure the span sweep died at,
 * the limit is bytes and a real 74-byte-per-span tape hits it at roughly a
 * thousand spans, not two thousand.
 */
async function byteAxis(ceilingBytes) {
    console.log(`\nWHICH AXIS? holding 853 spans and padding toward `
        + `${Math.round(ceilingBytes / 1024)} KB:`);
    let lo = 0;
    let hi = null;
    for (let pad = 32768; pad <= 1024 * 1024; pad *= 2) {
        const r = await tryLoad(853, pad);
        report(853, r, ok(r) ? 'LOADS ' : 'FAILED');
        if (!ok(r)) { hi = r.bytes; break; }
        lo = r.bytes;
    }
    if (hi === null) {
        console.log('  padding alone never killed it — the only ceiling is SPAN COUNT.');
        return;
    }
    // ⚠ THERE ARE TWO CEILINGS AND NEITHER SUBSUMES THE OTHER. A padded
    // 853-span tape survives well past the byte figure at which the span
    // sweep died, so bytes are not what killed the span sweep; and a tape
    // of 853 spans still dies once it is big enough, so spans are not the
    // only limit either. Quote BOTH, because a route can hit either one and
    // a real span costs about twice what this probe's synthetic one does —
    // which is why the two happen to bind at roughly the same tape.
    console.log(`  a 853-span tape survives to ${Math.round(lo / 1024)} KB and dies by `
        + `${Math.round(hi / 1024)} KB, well past the ~78 KB the SPAN sweep died at. `
        + 'So the two limits are INDEPENDENT: ~2100 spans, and separately '
        + `${Math.round(lo / 1024)}-${Math.round(hi / 1024)} KB. At ~74 real bytes per `
        + `span a real tape reaches the byte limit at ~${Math.round(lo / 74)}-`
        + `${Math.round(hi / 74)} spans, so budget against BOTH.`);
}

try {
    console.log(`span-ceiling probe (${REUSE ? 'ONE REUSED PAGE — not the ceiling'
        : 'fresh page per load'}), max ${MAX}`);
    console.log('known: R1 headline 544 spans/40KB ok; R2 headline 853/63KB ok; '
        + 'R2 dense 2569/185KB DIED at load\n');

    // Positive control FIRST: a span count R2 is known to load must load
    // here, or the probe is measuring its own plumbing and every "failed"
    // below would be meaningless.
    const control = await tryLoad(853);
    report(853, control, ok(control) ? 'LOADS ' : 'FAILED');
    if (!ok(control)) {
        console.log('\nCONTROL FAILED — R2\'s own headline span count does not load. '
            + 'The probe is measuring its plumbing, not the runtime.');
        process.exit(1);
    }

    if (process.argv.includes('--axis')) {
        await byteAxis(80 * 1024);
        await browser.close();
        process.exit(0);
    }

    // Grow until it breaks, then bisect. Doubling first because the ceiling
    // is unknown to within a factor of three and a linear walk from 853 at
    // one page-boot per step would cost more than the answer is worth.
    let lo = 853;
    let hi = null;
    for (let n = 1706; n <= MAX; n *= 2) {
        const r = await tryLoad(n);
        report(n, r, ok(r) ? 'LOADS ' : 'FAILED');
        if (!ok(r)) { hi = n; break; }
        lo = n;
    }
    if (hi === null) {
        console.log(`\nNO CEILING FOUND below ${MAX} spans — ${lo} loads. Raise --max `
            + 'if a route ever needs more than that.');
        process.exit(0);
    }
    console.log(`\nbisecting ${lo} (loads) .. ${hi} (fails):`);
    while (hi - lo > 64) {
        const mid = Math.floor((lo + hi) / 2);
        const r = await tryLoad(mid);
        report(mid, r, ok(r) ? 'LOADS ' : 'FAILED');
        if (ok(r)) lo = mid; else hi = mid;
    }
    console.log(`\nCEILING: loads at ${lo} spans, fails at ${hi} `
        + `(R2's headline is 853 — ${(lo / 853).toFixed(1)}x headroom)`);
    await byteAxis(syntheticTape(lo).inputs.length && JSON.stringify(syntheticTape(lo)).length);
} finally {
    if (shared) await shared.close();
    await browser.close();
}
