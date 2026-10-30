#!/usr/bin/env node
/**
 * probe-seedling-js-vs-wasm-tape.mjs — ⛓ PHASE B (`seedling-js-tape-bridge`): ONE TAPE, RUN THE SAME WAY ON BOTH
 * RUNTIMES, and the two drains diffed.
 *
 * Each side is a fresh page pressed ▶ Start by a real click (`#btn-start`), then driven through the SAME Bot.as
 * verbs the lab drives: `botLoadTape(gameVisibleTape(tape))` → `botStart` → poll `botStatus` until `finished` →
 * `botDrain` once. The JS side is `jsRuntime.html?start=click` (the JS core's Phase B verbs); the wasm side is the
 * default build's `game.html`. Both drains are wrapped by `gameStreamFromDrain` and compared by
 * `diffObservationStreams` — the comparator the lab's per-tick verdict and the node differential both feed.
 *
 * ⚠ A PROBE, NOT A GATE: a mismatch is information for the fidelity arc (the JS model vs the real game), never a
 * failure of the bridge — the bridge is pinned by `jsRuntimeTape.test.js` (JS frame vs JS model). It prints the
 * first differing tick and exits 0 either way; it exits 1 only when a side cannot be driven at all.
 *
 *   node scripts/procgen/probe-seedling-js-vs-wasm-tape.mjs [--tape=collide-up-rock] [--host=http://localhost:8000]
 *        [--build=seedling_bot_ap_p4g]
 *
 * Takes the box lock (kind `browser`). SKIPs (exit 0) with no dev server.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { HEADLESS_WEBGPU_ARGS } from './headlessChromium.js';
import {
    diffObservationStreams, gameStreamFromDrain, gameVisibleTape, parseTape,
} from '../../frontend/modules/seedlingDemo/tapeFormat.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** Drive one page: Start by a real click, load, start, poll to `finished`, drain once. */
async function driveSide(browser, url, tapeJson, { timeoutMs = 180000 } = {}) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__runtimeReady === true, null, { timeout: timeoutMs });
        await page.click('#btn-start');
        await page.waitForFunction(() => typeof window.__swfBridge?.game?.botStatus === 'function'
            && window.__swfBridge.game.botStatus(), null, { timeout: timeoutMs });
        const loaded = await page.evaluate((j) => window.__swfBridge.game.botLoadTape(j), tapeJson);
        if (loaded !== 'ok') return { refused: `botLoadTape: ${loaded}`, errors };
        const started = await page.evaluate(() => window.__swfBridge.game.botStart());
        if (started !== 'ok') return { refused: `botStart: ${started}`, errors };
        await page.waitForFunction(() => JSON.parse(window.__swfBridge.game.botStatus()).finished === true, null,
            { timeout: timeoutMs, polling: 250 });
        const status = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
        const drained = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botDrain()));
        return { status, drained, errors };
    } finally {
        await page.close();
    }
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-js-vs-wasm-tape.mjs', kind: 'browser' });
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const HOST = arg('host', 'http://localhost:8000');
    const TAPE = arg('tape', 'collide-up-rock');
    const BUILD = arg('build', 'seedling_bot_ap_p4g');
    const alive = await fetch(`${HOST}/frontend/modules/seedlingDemo/jsRuntime.html`)
        .then(async (r) => { await r.arrayBuffer(); return r.ok; }).catch(() => false);
    if (!alive) {
        console.log(`SKIP: no dev server serving ${HOST}/frontend/modules/seedlingDemo/ (or pass --host=)`);
        process.exit(0);
    }
    const raw = JSON.parse(readFileSync(join(REPO, `frontend/modules/seedlingDemo/fixtures/tapes/${TAPE}.json`), 'utf8'));
    const tapeJson = JSON.stringify(gameVisibleTape(parseTape(raw)));
    const browser = await chromium.launch({ args: [...HEADLESS_WEBGPU_ARGS] });
    let sides;
    try {
        sides = {
            js: await driveSide(browser, `${HOST}/frontend/modules/seedlingDemo/jsRuntime.html?start=click`, tapeJson),
            wasm: await driveSide(browser, `${HOST}/frontend/modules/flashPanel/wasm/${BUILD}/game.html`, tapeJson),
        };
    } finally {
        await browser.close();
    }
    let undriven = 0;
    for (const [name, s] of Object.entries(sides)) {
        if (s.refused) { undriven += 1; console.log(`${name}: REFUSED — ${s.refused}`); continue; }
        console.log(`${name}: finished at tick ${s.status.tick}/${s.status.tick_count}, ${s.drained.ticks.length} `
            + `observation(s), error ${JSON.stringify(s.status.error)}, final L${s.status.level} `
            + `(${s.status.x}, ${s.status.y})${s.errors.length ? `, page errors: ${s.errors.join(' | ')}` : ''}`);
    }
    if (undriven) process.exit(1);
    const diff = diffObservationStreams(gameStreamFromDrain(sides.wasm.drained).stream,
        gameStreamFromDrain(sides.js.drained).stream);
    console.log(`${TAPE} on ${BUILD}: wasm (expected) vs JS (actual) — ${diff === null ? 'AGREE at every tick' : diff}`);
    process.exit(0);
}

if (isEntryPoint(import.meta.url)) main();
