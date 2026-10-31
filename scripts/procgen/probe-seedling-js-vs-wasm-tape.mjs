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
 *        [--build=seedling_bot_ap_p4g] [--chain=<PAGE_CHAINS id>]
 *
 * ⛓ seedling-js-replay-continuation — `--chain=` plays a SEQUENCE instead (`director.PAGE_CHAINS`, e.g. `r8-d2`):
 * ONE page per side, every window `botLoadTape` → `botStart` on the same game, as the lab's window loop ships it per
 * transport — the JS side `jsRuntimeSequence.jsWindowTape` (held, no tick-0 write), the wasm side `gameVisibleTape`
 * for window 1 and `watchWasm.continuationTape` after it, held when the build declares `hold` (`holdCapabilityOf`).
 * At each boundary the keys a span left down are released on the wasm page (`releaseKeysInFrame`'s dispatch), and
 * each window's drain is diffed on its own; the JS side also says whether it CONTINUED (its boot note).
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
    diffObservationStreams, gameStreamFromDrain, gameVisibleTape, holdingWindowTape, KEY_CODES, parseTape,
} from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { PAGE_CHAINS } from '../../frontend/modules/seedlingDemo/director.js';
import { jsWindowTape } from '../../frontend/modules/seedlingDemo/jsRuntimeSequence.js';
import { continuationTape, holdCapabilityOf } from '../../frontend/modules/seedlingDemo/watchWasm.js';

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

/**
 * ⛓ seedling-js-replay-continuation — drive one page through a SEQUENCE: per window load → start → `finished` →
 * drain; between windows release the keys the previous window's spans left down. `tapeJsonFor(k)` is the transport's
 * projection. JS-only: whether `botStart` continued (the core's `tape … continued` note).
 */
async function driveSequence(browser, url, tapes, tapeJsonFor, { timeoutMs = 600000 } = {}) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__runtimeReady === true, null, { timeout: timeoutMs });
        await page.click('#btn-start');
        await page.waitForFunction(() => typeof window.__swfBridge?.game?.botStatus === 'function'
            && window.__swfBridge.game.botStatus(), null, { timeout: timeoutMs });
        const windows = [];
        for (let k = 0; k < tapes.length; k += 1) {
            if (k > 0) {
                const codes = [...new Set((tapes[k - 1].inputs ?? []).filter((sp) => sp.to >= tapes[k - 1].tick_count)
                    .map((sp) => KEY_CODES[sp.key]).filter((c) => Number.isFinite(c)))];
                await page.evaluate((cs) => {
                    const targets = [document, window, document.querySelector('canvas')].filter(Boolean);
                    for (const c of cs) for (const t of targets) {
                        t.dispatchEvent(new KeyboardEvent('keyup', { keyCode: c, which: c, bubbles: true, cancelable: true }));
                    }
                }, codes);
                if (codes.length) await page.waitForTimeout(400);
            }
            const loaded = await page.evaluate((j) => window.__swfBridge.game.botLoadTape(j), tapeJsonFor(k));
            if (loaded !== 'ok') return { refused: `window ${k + 1}: botLoadTape: ${loaded}`, windows, errors };
            const started = await page.evaluate(() => window.__swfBridge.game.botStart());
            if (started !== 'ok') return { refused: `window ${k + 1}: botStart: ${started}`, windows, errors };
            await page.waitForFunction(() => JSON.parse(window.__swfBridge.game.botStatus()).finished === true, null,
                { timeout: timeoutMs, polling: 250 });
            const status = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
            const drained = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botDrain()));
            const continued = await page.evaluate(() => {
                const ev = window.__seedlingJsRuntime?.events;
                return ev ? ev.filter((e) => e.type === 'tape' && e.continued).length : null;
            });
            windows.push({ status, drained, continued });
        }
        return { windows, errors };
    } finally {
        await page.close();
    }
}

async function mainChain({ HOST, BUILD, CHAIN }) {
    const names = PAGE_CHAINS[CHAIN];
    if (!names) { console.log(`no chain ${JSON.stringify(CHAIN)} in director.PAGE_CHAINS`); process.exit(1); }
    const tapes = names.map((n) => parseTape(JSON.parse(readFileSync(
        join(REPO, `frontend/modules/seedlingDemo/fixtures/tapes/${n}.json`), 'utf8'))));
    const manifest = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
    const hold = holdCapabilityOf(manifest, `../flashPanel/wasm/${BUILD}/game.html`);
    const wasmTape = (k) => {
        const w = hold.capable && k < tapes.length - 1 ? holdingWindowTape(tapes[k]) : tapes[k];
        return JSON.stringify(k > 0 ? continuationTape(w).tape : gameVisibleTape(w));
    };
    const browser = await chromium.launch({ args: [...HEADLESS_WEBGPU_ARGS] });
    let sides;
    try {
        sides = {
            js: await driveSequence(browser, `${HOST}/frontend/modules/seedlingDemo/jsRuntime.html?start=click`, tapes,
                (k) => JSON.stringify(jsWindowTape(tapes[k], k, tapes.length))),
            wasm: await driveSequence(browser, `${HOST}/frontend/modules/flashPanel/wasm/${BUILD}/game.html`, tapes,
                wasmTape),
        };
    } finally {
        await browser.close();
    }
    console.log(`${CHAIN} (${names.length} windows) on ${BUILD} — hold: ${hold.why}`);
    for (const [name, s] of Object.entries(sides)) {
        if (s.refused) console.log(`${name}: REFUSED — ${s.refused}`);
        if (s.errors.length) console.log(`${name}: page errors: ${s.errors.join(' | ')}`);
    }
    let agree = 0;
    for (let k = 0; k < names.length; k += 1) {
        const j = sides.js.windows[k];
        const w = sides.wasm.windows[k];
        if (!j || !w) { console.log(`  window ${k + 1} ${names[k]}: not driven on ${!j ? 'js' : 'wasm'}`); continue; }
        const diff = diffObservationStreams(gameStreamFromDrain(w.drained).stream, gameStreamFromDrain(j.drained).stream);
        if (diff === null) agree += 1;
        console.log(`  window ${k + 1} ${names[k]}: wasm ${w.drained.ticks.length} obs L${w.status.level} `
            + `(${w.status.x}, ${w.status.y}) held=${w.status.held} · JS ${j.drained.ticks.length} obs `
            + `L${j.status.level} (${j.status.x}, ${j.status.y}) held=${j.status.held} continuations=${j.continued} — `
            + `${diff === null ? 'AGREE at every tick' : diff}`);
    }
    console.log(`${CHAIN}: wasm (expected) vs JS (actual) — ${agree}/${names.length} window(s) agree at every tick`);
    process.exit(sides.js.refused || sides.wasm.refused ? 1 : 0);
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
    const CHAIN = arg('chain', '');
    if (CHAIN) return mainChain({ HOST, BUILD, CHAIN });
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
