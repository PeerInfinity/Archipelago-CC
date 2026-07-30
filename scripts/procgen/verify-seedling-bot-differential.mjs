#!/usr/bin/env node
/**
 * verify-seedling-bot-differential — replay every committed tape through
 * the REAL recompiled Seedling and compare what the game did against the
 * committed observation streams.
 *
 * This is the oracle leg of the region-atlas Phase 8 v1 rung. Brief:
 * `CC/docs/plans/seedling-bot-v1-opus-kickoff.md`.
 *
 * ── The division of labour ────────────────────────────────────────────
 * The wasm artifact is machine-local forever (there is no CI build in
 * either repo), so the observation streams it produces are COMMITTED and
 * vitest checks JS-vs-recording on every CI run. That leaves this script
 * exactly one job in its default mode: the STALENESS GATE — "the
 * committed recordings still match what the live game does". Without the
 * artifact it SKIPs (exit 0), like every other seedling verifier.
 *
 *   default   replay + compare against the committed streams
 *   --record  write the streams as ORACLE recordings (expectations/<name>.json)
 *
 * `--record` is the only thing in the repo allowed to write a
 * non-provisional expectation. `fixtures/regenerate.mjs` writes only
 * `.provisional.json`, so the two can never be confused for each other.
 *
 * ── Prereqs ───────────────────────────────────────────────────────────
 *   - dev server on :8000 at the REPO ROOT (`python -m http.server 8000`)
 *   - the uncommitted wasm artifact at
 *     frontend/modules/flashPanel/wasm/seedling_bot_ap/
 *
 * Runs headless: WebGPU comes up on swiftshader with the same flags as
 * verify-seedling-wasm-bridge.mjs. The page needs a real user gesture to
 * start, which a Playwright click supplies.
 *
 * ⚠ TWO THINGS THIS IS SLOW AND FIDDLY ABOUT, both measured, not guessed:
 *
 * 1. **The recompiled game runs at roughly HALF A FRAME PER SECOND here**
 *    (measured 2026-07-30: 38 ticks in 80s, headless and headed alike, on
 *    software WebGPU). A 140-tick tape therefore takes ~5 minutes, and the
 *    ~18-20 `blackCover` fade frames after every world load cost ~40s on
 *    their own. Timeouts below are SCALED from the tape length for that
 *    reason; a fixed 60s deadline times out before the fade even clears
 *    and looks exactly like a dead bot. (`NO_GRAPHICS` exists in the
 *    runtime but `build_wasm_avm2.sh` does not expose it — building a
 *    graphics-less variant is the obvious speed-up if this becomes
 *    painful.)
 *
 * 2. **Each tape gets a FRESH PAGE.** The bot's `botReset` forgets the
 *    tape, but it cannot rewind the GAME — the player stays wherever the
 *    previous tape left them, so a second tape replayed on the same page
 *    starts from the wrong position and every observation after it is
 *    wrong. Reloading is the honest reset, and against a multi-minute
 *    replay the extra page load is noise.
 *
 * Run: node scripts/procgen/verify-seedling-bot-differential.mjs [--record]
 */

import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

const PAGE_NAME = 'seedling_bot_ap';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);

if (!existsSync(join(ARTIFACT, 'game.html'))
    || !existsSync(join(ARTIFACT, `${PAGE_NAME}.wasm`))) {
    console.log(`SKIP: seedling bot wasm artifact not staged at ${ARTIFACT}`
        + ' — build it with ~/CC/seedling_bot_build/build_bot.sh and the'
        + ' pipeline documented in that script, then copy the deployed page here');
    process.exit(0);
}

const {
    diffObservationStreams, serializeObservationStream,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const {
    EXPECTATIONS_DIR, fixtureNames, loadExpectation, loadTape,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/fixtures/index.js'));
const {
    DEFAULT_TOLERANCE, synthesizeTape,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));

const RECORD = process.argv.includes('--record');
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

let failures = 0;
function check(name, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
}

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});

/**
 * Measured frame budget. The game runs at ~0.5 ticks/s here, and every
 * world load burns ~20 `blackCover` fade frames before tick 0. Scale the
 * deadline from the tape length with generous slack rather than guessing
 * a constant — under-waiting is indistinguishable from a dead bot.
 */
const SECONDS_PER_FRAME = 2.5;
const FADE_FRAMES = 25;
const deadlineFor = (tickCount) =>
    Math.ceil((tickCount + FADE_FRAMES) * SECONDS_PER_FRAME * 1000) + 60000;

/** Boot a fresh page with the bot armed-ready. Each tape gets its own. */
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

async function waitFor(page, desc, fn, timeoutMs = 120000) {
    const start = Date.now();
    let polls = 0;
    for (;;) {
        const v = await fn();
        if (v) return v;
        polls++;
        if (Date.now() - start > timeoutMs) {
            console.log('PAGE LOGS (last 30):\n' + (page.__logs ?? []).slice(-30).join('\n'));
            throw new Error(`timeout waiting for: ${desc} (${polls} polls in `
                + `${((Date.now() - start) / 1000).toFixed(1)}s)`);
        }
        await page.waitForTimeout(500);
    }
}

const botOn = (page, name, arg) => page.evaluate(
    ([n, a]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return a === undefined ? g[n]() : g[n](a);
    },
    [name, arg],
);

const botJsonOn = async (page, name, arg) => {
    const raw = await botOn(page, name, arg);
    if (raw === null) throw new Error(`bot.${name} returned null `
        + '(the page shim maps "" to null — a callback must never return the empty string)');
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error(`bot.${name} returned non-JSON: ${raw}`);
    }
};

/** Replay one tape on its own fresh page and return the drained stream. */
async function replay(name, tapeObj) {
    const page = await freshPage();
    try {
        const loaded = await botOn(page, 'botLoadTape', JSON.stringify(tapeObj));
        if (loaded !== 'ok') throw new Error(`botLoadTape(${name}): ${loaded}`);
        const started = await botOn(page, 'botStart');
        if (started !== 'ok') throw new Error(`botStart(${name}): ${started}`);

        const status = await waitFor(page, `tape ${name} to finish`, async () => {
            const st = await botJsonOn(page, 'botStatus');
            return st.finished ? st : null;
        }, deadlineFor(tapeObj.tick_count));

        const drained = await botJsonOn(page, 'botDrain');
        return {
            stream: { ticks: drained.ticks, transitions: drained.transitions },
            status,
        };
    } finally {
        await page.close();
    }
}

try {
    // Boot once up front purely as a positive control: if the bot never
    // registers or never sees a player, everything below would "pass"
    // vacuously by never running.
    const probe = await freshPage();
    check('bot control surface registered', true,
        'botLoadTape/botStart/botStatus/botDrain/botReset');
    const boot = await botJsonOn(probe, 'botStatus');
    check('bot reports a live player before any tape', Number.isFinite(boot.x),
        `x=${boot.x} y=${boot.y} level=${boot.level}`);
    await probe.close();

    const names = fixtureNames();
    check('fixture roster is non-empty', names.length > 0, `${names.length} tapes`);

    for (const name of names) {
        const tape = loadTape(name);
        let result;
        const t0 = Date.now();
        try {
            result = await replay(name, tape);
        } catch (e) {
            check(`${name}: replays`, false, e.message);
            continue;
        }
        const { stream, status } = result;
        const secs = ((Date.now() - t0) / 1000).toFixed(0);

        if (status.saw_input_refused) {
            // Surfaced, not silently tolerated: receiveInput==false means the
            // game dropped input mid-tape and the stream is not comparable.
            check(`${name}: game accepted input throughout`, false,
                'receiveInput went false mid-tape (cutscene/pit/boss?)');
        }

        // Quantitative pin: a bot that recorded nothing, or teleported,
        // would satisfy a purely positional comparison.
        const expectedTicks = tape.tick_count + 1;
        check(`${name}: observation count`, stream.ticks.length === expectedTicks,
            `${stream.ticks.length} (expected tick_count+1 = ${expectedTicks}), `
            + `${status.dead_frames} fade frames skipped, ${secs}s`);

        if (RECORD) {
            writeFileSync(join(EXPECTATIONS_DIR, `${name}.json`),
                serializeObservationStream(stream));
            console.log(`RECORDED: ${name}.json (${stream.ticks.length} observations)`);
            continue;
        }

        const { stream: expected, provisional } = loadExpectation(name);
        const diff = diffObservationStreams(expected, stream);
        check(`${name}: live game matches the committed `
            + `${provisional ? 'PROVISIONAL' : 'oracle'} stream`,
            diff === null, diff ?? '');
    }

    if (!RECORD) {
        // The live bot-driver task: targets in, tape synthesized by the JS
        // driver, and the arrival asserted from the GAME's own drained
        // observations — the game's word, not the driver's.
        const targets = [{ x: 120, y: 100 }];
        const { tape, arrivals } = synthesizeTape(targets, { name: 'live-driver' });
        const { stream } = await replay('live-driver', tape);
        for (const a of arrivals) {
            const o = stream.ticks[a.tick];
            const ok = o
                && Math.abs(o.x - a.target.x) <= DEFAULT_TOLERANCE
                && Math.abs(o.y - a.target.y) <= DEFAULT_TOLERANCE;
            check(`live driver reaches target ${a.index} (${a.target.x},${a.target.y})`,
                !!ok, o ? `game reported (${o.x}, ${o.y}) at tick ${a.tick}` : 'no observation');
        }
    }
} catch (e) {
    console.log(`FAIL: harness error — ${e.message}`);
    failures++;
} finally {
    await browser.close();
}

console.log(failures === 0
    ? `\nALL CHECKS PASSED${RECORD ? ' (recording mode)' : ''}`
    : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
