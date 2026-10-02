#!/usr/bin/env node
/**
 * Measure-only slice `seedling-wasm-oom-probe` (plan `NewDocs/plans/seedling-wasm-solver-plan.md` §1.2, ⚖ RULED
 * item 5) — DOES THE WASM SEEDLING GAME RUN OUT OF MEMORY ON ORDINARY WORLD SWAPS, or only on host-issued ones?
 * It prints `ROW` lines and changes nothing tracked; report `NewDocs/plans/seedling-wasm-oom-report.md`.
 *
 * THE HEAP READOUT. SWFModernRuntime's AVM2 heap is ONE o1heap arena (512 MiB on browser AVM2,
 * `src/memory/heap.c` DEFAULT_FULL_HEAP_SIZE), memalign'ed and zero-filled at Start — so
 * `HEAPU8.buffer.byteLength` is FLAT BY CONSTRUCTION and says nothing about a leak. The build exports no
 * `heap_stats`, so the probe reads o1heap's own `O1HeapDiagnostics` straight out of linear memory (pure JS reads
 * of `HEAPU32`, no call into the game): wasm32 layout `bins[32]` (128 B) + `nonempty_bin_mask` (4 B) + 4 B pad
 * (the struct holds a u64, so it is 8-aligned), then `{ capacity, allocated, peak_allocated, peak_request_size,
 * oom_count:u64 }` at instance+136 (MEASURED: a dump around the capacity word, 2026-10-02); the instance
 * sits at the arena base, so `capacity` = 512 MiB − 176 (INSTANCE_SIZE_PADDED) rounded down to 32 = 512 MiB − 192. `allocated` sawtooths with the
 * AVM2 GC (it collects only between ticks, adaptively), so the leak is read off the FLOOR: the minimum
 * `allocated` sampled every 10 ms across each leg.
 *
 * Modes (`--mode=`), each a two-room ping-pong (`PAIRS` below; default `west` = OverWorld1 (level 0, 20×20 screens'
 * worth of tiles) ↔ level 94 through the west teleporter pair, reachable from the spawn by keyboard alone):
 *   V   VANILLA, standalone `game.html` (no panel, no BridgeGeneric configure, no host write, NO call into the
 *       game at all): Playwright holds the room's arrow key on the canvas until the console's `Level:` trace
 *       (`Main.printItems`, run by every `new Game`) names the other room. Runs on a build with no bot API too.
 *   I   IDLE control, standalone: no input, `botStatus` polled at `--poll-ms` for `--seconds` — the per-call
 *       and per-second drift with NO swap. `--panel`: on the live panel page instead (the panel's own traffic).
 *   B   botStart, standalone: each swap is a host tape (v3, no inputs, one tick) whose boot is the OTHER room —
 *       `botLoadTape` + `botStart`, then `botReset` once it finishes.
 *   T   HOST `new Game`, the LIVE PANEL page (`seedling_atlas_location`, as the sweep): `surface.wasm.teleport`
 *       alternating the two rooms — BridgeGeneric's `new_instance` invocation (the `[BridgeGeneric] Invoked:
 *       new Game(…)` line of the sweep's death).
 *   P   VANILLA keys on the LIVE PANEL page — V's loop (console-read) with the panel attached (BridgeGeneric configured,
 *       state reports, the region glue): separates "the host wrote a swap" from "a host is listening".
 *
 * Flags: `--build=<dir>` (default the preset's `flash_panel.wasm`), `--swaps=N` (default 400), `--host=`
 * (default http://localhost:8000), `--pair=west|dungeon`, `--env=K=V,…` (standalone: emscripten ENV, e.g.
 * AVM2_GC_VERBOSE=1 → each swap row carries the last collection's live object/string counts), `--poll-ms=` (200), `--seconds=` (I), `--wait-for-box=<sec>`.
 * A game that EXITS stops the loop with its console tail and the swap count (`ROW death`).
 *
 * ⚠ NOT ON MAIN: a measure-only probe on branch `seedling-wasm-oom-probe` (the `4497fd653d` precedent) — the
 * check-procgen-help import door is honoured below; boxLock's guarded list carries it.
 *
 * Run: node scripts/procgen/probe-seedling-wasm-oom.mjs --mode=V|I|B|T|P [--build=…] [--swaps=N] [--host=…]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/**
 * The ping-pong PAIRS: per room, the key that walks into its exit trigger from where the other room lands you, and
 * the arrival a host swap (B/T) uses. `west` is the committed tape `transition-west-return`'s pair (its description
 * MEASURES the geometry: L0's trigger (0,128) {to:94, 288,160}; L94's return pair (304,160)/(304,176) → L0 (16,128);
 * neither arrival overlaps a trigger, so the anti-ping-pong latch never engages). From the spawn (80,128) the
 * first Left walks onto the same line. `dungeon` is Dungeon1_1 ↔ Dungeon1_2 (small ↔ small; host-reached only).
 * ⚠ The start house (L0 (80,96) → L1) is NOT a vanilla pair: from the spawn Up stops at y 130.5 (MEASURED) —
 * the house door is solid.
 */
export const PAIRS = {
    west: { 0: { arrive: { level: 0, x: 16, y: 128 }, key: 'ArrowLeft' }, 94: { arrive: { level: 94, x: 288, y: 160 }, key: 'ArrowRight' } },
    dungeon: { 3: { arrive: { level: 3, x: 112, y: 48 }, key: 'ArrowRight' }, 4: { arrive: { level: 4, x: 16, y: 16 }, key: 'ArrowLeft' } },
};

/**
 * IN-PAGE (game frame), self-contained: o1heap's diagnostics read out of linear memory. Finds the instance once
 * (the `capacity` word: 512 MiB − 192, at instance+136 with the instance 16-aligned, plausible allocated/peak after it, every bin null or inside the arena).
 */
export function readHeapInPage() {
    const u = window.HEAPU32;
    if (!u) return null;
    let c = window.__oomCapIdx;
    if (c === undefined) {
        c = -1;
        // `capacity` = arena − 176 rounded DOWN to FRAGMENT_SIZE_MIN (32): 512 MiB − 192 here (SWF_HEAP_MB may move
        // the arena off 512, so any whole-MiB arena is accepted); the bins before
        // it are null or point INTO the arena that starts right after the instance.
        for (let i = 33; i < u.length - 6; i++) {
            const cap = u[i];
            if (cap < 32 * 1024 * 1024 || cap > u.length * 4 || cap % 32 !== 0 || (1024 * 1024 - (cap % (1024 * 1024))) > 256 || ((i * 4 - 136) % 16) !== 0) continue;
            if (!(u[i + 1] <= cap && u[i + 2] >= u[i + 1] && u[i + 2] <= cap && u[i + 5] === 0)) continue;
            const base = i * 4 - 136;
            let ok = true;
            for (let b = 0; b < 32 && ok; b++) {
                const ptr = u[base / 4 + b];
                ok = ptr === 0 || (ptr >= base + 176 && ptr < base + 176 + cap);
            }
            if (ok) { c = i; break; }
        }
        window.__oomCapIdx = c;
    }
    if (c < 0) return { bytes: u.buffer.byteLength, found: false };
    return { bytes: u.buffer.byteLength, found: true, base: c * 4 - 136, capacity: u[c], allocated: u[c + 1],
        peak: u[c + 2], peakRequest: u[c + 3], oom: u[c + 4] };
}

/** IN-PAGE: start a 10 ms sampler of `allocated`; `takeWindow()` returns {min,max,last,n} since the last take. */
export function installSamplerInPage(readSrc) {
    // eslint-disable-next-line no-new-func
    const read = new Function(`return (${readSrc})();`);
    const w = { min: Infinity, max: 0, last: 0, n: 0 };
    window.__oomWin = w;
    window.__oomRead = read;
    setInterval(() => {
        const h = read();
        if (!h?.found) return;
        const a = h.allocated;
        if (a < w.min) w.min = a;
        if (a > w.max) w.max = a;
        w.last = a;
        w.n++;
    }, 10);
    window.__oomTake = () => {
        const out = { min: w.min, max: w.max, last: w.last, n: w.n, ...read() };
        w.min = Infinity; w.max = 0; w.n = 0;
        return out;
    };
    return read();
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-oom.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const MODE = arg('mode', 'V');
    const GAME = 'seedling_atlas_location';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const DEFAULT_PAGE = PRESET.flash_panel?.wasm ?? '';
    const BUILD = arg('build', DEFAULT_PAGE.split('/')[0]);
    const SWAPS = Number(arg('swaps', '400'));
    const POLL_MS = Number(arg('poll-ms', '200'));
    const SECONDS = Number(arg('seconds', '120'));
    // `--env=AVM2_GC_VERBOSE=1,…` (standalone modes): emscripten's ENV is a page global, read once at startup, so a
    // `Module.preRun` on the probe's OWN routed copy of game.html sets it (no file changes; SWF_HEAP_MB works too).
    const ENVS = arg('env', '').split(',').filter(Boolean).map((kv) => kv.split('='));
    const PAIR = arg('pair', 'west');
    const ROOMS = PAIRS[PAIR];
    const [RA, RB] = Object.keys(ROOMS).map(Number);
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', BUILD, 'game.html'))) {
        console.log(`SKIP: seedling wasm build not staged (${BUILD})`);
        process.exit(0);
    }
    const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
    out('setup', { mode: MODE, build: BUILD, swaps: SWAPS, pair: PAIR, rooms: [RA, RB], host: HOST });

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    let dead = null;
    // ⛓ THE ZERO-CALL SWAP DETECTOR: every `new Game` runs `Main.printItems()`, which traces `Level:    N` — so a
    // swap is visible on the console with NO call into the game (and on a build with no bot API at all).
    let logLevel = null;
    let lastGc = null;
    let levelLines = 0;
    page.on('console', (msg) => {
        const t = msg.text();
        const lv = /^Level:\s+(-?\d+)/.exec(t);
        if (lv) { logLevel = Number(lv[1]); levelLines++; }
        // AVM2_GC_VERBOSE's per-collection line (`avm2_gc.c`): live = enrolled − swept objects.
        const gc = /^\[avm2-gc\] #(\d+) live=(\d+) swept=(\d+) strings live=(\d+) swept=(\d+)/.exec(t);
        if (gc) { lastGc = { n: +gc[1], live: +gc[2], swept: +gc[3], strLive: +gc[4], strSwept: +gc[5] }; return; }
        logs.push(`[${msg.type()}] ${t}`);
        if (logs.length > 4000) logs.splice(0, 2000);
        if (!dead && /out of memory|ExitStatus|Aborted\(/.test(t)) dead = t;
    });
    page.on('pageerror', (e) => { logs.push(`[pageerror] ${e.message}`); if (!dead && /ExitStatus|memory/.test(e.message)) dead = e.message; });

    const waitFor = async (what, fn, ms = 60000) => {
        const t0 = Date.now();
        for (;;) {
            // eslint-disable-next-line no-await-in-loop
            const v = await fn().catch(() => null);
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => { setTimeout(r, 200); });
        }
    };

    let frame; // the game's frame (the page itself when standalone)
    let surface = false;
    // `--panel` runs I on the live panel page: the panel's own bridge traffic with no swap and no probe call.
    const PANEL = process.argv.includes('--panel');
    if (MODE === 'T' || MODE === 'P' || (MODE === 'I' && PANEL)) {
        await page.goto(`${HOST}/frontend/?game=${GAME}&seed=1${BUILD !== DEFAULT_PAGE.split('/')[0] ? '' : ''}`, { waitUntil: 'domcontentloaded' });
        if (BUILD !== DEFAULT_PAGE.split('/')[0]) {
            console.log('FAIL: T/P run the preset\'s build only (the panel picks it); use V/I/B for --build');
            await browser.close();
            process.exit(1);
        }
        const { FLASH_PANEL, clickPanelTab } = await import('./seedlingRoomPlay.js');
        await waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await waitFor('flashPanel tab', () => clickPanelTab(page, FLASH_PANEL));
        await waitFor('wasm iframe', async () => page.frames().find((fr) => fr.url().includes(`${BUILD}/game.html`)));
        frame = page.frames().find((fr) => fr.url().includes(`${BUILD}/game.html`));
        await waitFor('start enabled', () => frame.evaluate(() => { const b = document.getElementById('btn-start'); return !!b && !b.disabled; }));
        await frame.click('#btn-start');
        await waitFor("panel 'ready'", async () => ((await page.evaluate(() => document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready'), 120000);
        await waitFor('AP load', () => page.evaluate(async () => !!(await import('./modules/flashPanel/index.js')).getActivePanelInstance()?._apLoadResult), 120000);
        await page.evaluate(async () => {
            const fp = await import('./modules/flashPanel/index.js');
            window.__surface = fp.getActivePanelInstance().seedlingPlaybackSurface();
        });
        surface = true;
    } else {
        if (ENVS.length) {
            await page.route(`**/wasm/${BUILD}/game.html`, async (route) => {
                const r = await route.fetch();
                const html = (await r.text()).replace(`<script src="${BUILD}.js">`,
                    `<script>window.Module.preRun = [function () { ${ENVS.map(([k, v]) => `ENV[${JSON.stringify(k)}] = ${JSON.stringify(v)};`).join(' ')} }];</script>\n<script src="${BUILD}.js">`);
                await route.fulfill({ response: r, body: html });
            });
        }
        await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${BUILD}/game.html`, { waitUntil: 'domcontentloaded' });
        frame = page.mainFrame();
        await waitFor('runtime ready', () => frame.evaluate(() => window.__runtimeReady === true));
        await frame.click('#btn-start');
    }
    await waitFor('the game in a level (a `Level:` trace)', async () => logLevel !== null, 120000);
    await page.waitForTimeout(3000);
    const hasBot = await frame.evaluate(() => typeof window.__swfBridge?.game?.botStatus === 'function');
    out('boot', { level: logLevel, hasBot });
    if (!hasBot && MODE !== 'V') { console.log(`FAIL: --mode=${MODE} needs the bot API; ${BUILD} has none`); await browser.close(); process.exit(1); }
    const h0 = await frame.evaluate(installSamplerInPage, readHeapInPage.toString());
    out('heap0', h0);
    if (!h0?.found) { console.log('FAIL: the o1heap instance was not found in linear memory'); await browser.close(); process.exit(1); }

    const status = () => frame.evaluate(() => { try { return JSON.parse(window.__swfBridge.game.botStatus()); } catch (e) { return { error: String(e) }; } });
    const take = () => frame.evaluate(() => window.__oomTake());
    const t0 = Date.now();

    if (MODE === 'I') {
        // Who calls into the game: every `__swfBridge.game` callback and `queueItems`, wrapped with a counter (the
        // host looks the callbacks up on the object each time, so a wrapper sees the panel's own traffic too).
        await frame.evaluate(() => {
            const counts = {};
            window.__oomCalls = counts;
            const wrap = (obj, k) => {
                const f = obj[k];
                if (typeof f !== 'function' || f.__oom) return;
                const w = function (...a) { counts[k] = (counts[k] ?? 0) + 1; return f.apply(this, a); };
                w.__oom = true;
                obj[k] = w;
            };
            const g = window.__swfBridge.game;
            for (const k of Object.keys(g)) wrap(g, k);
            wrap(window.__swfBridge, 'queueItems');
        });
        let calls = 0;
        // The size of what one poll carries back (is the per-call leak ≈ the returned string?).
        out('reply', await frame.evaluate(() => ({ botStatusChars: window.__swfBridge.game.botStatus().length })));
        calls++;
        const legs = Math.round(SECONDS / 5);
        for (let i = 0; i < legs && !dead; i++) {
            const tEnd = Date.now() + 5000;
            while (Date.now() < tEnd) {
                // eslint-disable-next-line no-await-in-loop
                await status(); calls++;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(POLL_MS);
            }
            // eslint-disable-next-line no-await-in-loop
            // eslint-disable-next-line no-await-in-loop
            const bridgeCalls = await frame.evaluate(() => ({ ...window.__oomCalls }));
            out('idle', { i, s: Math.round((Date.now() - t0) / 1000), calls, bridgeCalls, ...(await take()), ...(lastGc ? { gc: lastGc } : {}) });
        }
    } else {
        // A real click on the canvas first (the gates' `focusGame`): `focus()` alone does not route the keys.
        await frame.click('#canvas');
        for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) await page.keyboard.up(k);
        // `seedling_original` keeps the vanilla title (`Game.menu` true): ANY key's release leaves it with
        // `new Game(level, …)` (Game.as `menuAndRestart`). ⚠ Its `Level:` trace is `Main.level`, the SAVE's level
        // (−1 until the first save), not the room — so the exit from the title is read as ONE MORE `Level:` line,
        // and from there −1 is the spawn room (OverWorld1, level 0; the bot builds skip straight to it).
        if (logLevel < 0) {
            const before = levelLines;
            const tEnd = Date.now() + 60000;
            while (levelLines === before && Date.now() < tEnd) {
                // eslint-disable-next-line no-await-in-loop
                await page.keyboard.press('x', { delay: 80 });
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(1500);
            }
            out('title', { left: levelLines > before, level: logLevel, levelLines });
            await page.waitForTimeout(3000);
            if (logLevel < 0) logLevel = 0;
        }
        // The panel's atlas world arrives the player in its own start room (level 86, MEASURED): ONE host jump puts
        // T and P on the pair (for P that is the only host swap; the rest of P is keys).
        if (surface && logLevel !== RA && logLevel !== RB) {
            await page.evaluate((a) => window.__surface.wasm.teleport(a), ROOMS[RA].arrive);
            await waitFor(`the jump onto level ${RA}`, async () => logLevel === RA, 30000);
            out('onto-pair', { level: logLevel, levelLines });
            await page.waitForTimeout(2000);
            await frame.click('#canvas');
        }
        // B on a pair the spawn is not in (`dungeon`): one botStart onto it first, the same verb the loop uses.
        if (!surface && MODE === 'B' && logLevel !== RA && logLevel !== RB) {
            const r = await frame.evaluate((t) => {
                const g = window.__swfBridge.game;
                const l = g.botLoadTape(JSON.stringify(t));
                return l === 'ok' ? g.botStart() : `load ${l}`;
            }, { tape_version: 3, game: 'seedling', name: 'oom-B-onto', description: 'oom probe: onto the pair',
                boot: { ...ROOMS[RA].arrive }, noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [],
                tick_count: 1, inputs: [] });
            await waitFor(`the botStart onto level ${RA} (${r})`, async () => logLevel === RA, 30000);
            await page.waitForTimeout(1500);
            await frame.evaluate(() => window.__swfBridge.game.botReset()).catch(() => null);
            out('onto-pair', { level: logLevel, levelLines, r });
        }
        // V/P read the level off the console only (no call into the game); B/T read botStatus.
        const viaLog = MODE === 'V' || MODE === 'P';
        // On a build with NO bot API the `Level:` trace may be the save's (above), so the room is inferred from the
        // PARITY of `new Game` traces since the spawn (each one is a swap of the ping-pong); `level` rows say so.
        let lines0 = levelLines;
        const parityLevel = () => ((levelLines - lines0) % 2 === 0 ? RA : RB);
        const readLevel = async () => (viaLog ? { level: hasBot ? logLevel : parityLevel() } : status());
        let st = await readLevel();
        let swaps = 0;
        let calls = viaLog ? 0 : 1;
        let stuck = 0;
        // Get onto the ping-pong: from the spawn (level 0) the first leg is RA's key.
        while (swaps < SWAPS && !dead) {
            const from = st.level;
            const room = ROOMS[from];
            if (!room || (from !== RA && from !== RB)) { out('off-route', { swaps, level: from, x: st.x, y: st.y }); break; }
            const other = from === RA ? RB : RA;
            const tLeg = Date.now();
            if (MODE === 'V' || MODE === 'P') {
                await page.keyboard.down(room.key);
                const tEnd = Date.now() + 6000;
                while (Date.now() < tEnd && !dead) {
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(POLL_MS);
                    st = await readLevel();
                    if (st.level !== from) break;
                }
                await page.keyboard.up(room.key);
            } else if (MODE === 'B') {
                const tape = { tape_version: 3, game: 'seedling', name: `oom-B-${swaps}`, description: 'oom probe: a botStart swap',
                    boot: { ...ROOMS[other].arrive }, noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [],
                    tick_count: 1, inputs: [] };
                const r = await frame.evaluate((t) => {
                    const g = window.__swfBridge.game;
                    const l = g.botLoadTape(JSON.stringify(t));
                    return l === 'ok' ? g.botStart() : `load ${l}`;
                }, tape);
                calls += 2;
                if (r !== 'ok') { out('refused', { swaps, r }); break; }
                const tEnd = Date.now() + 6000;
                while (Date.now() < tEnd && !dead) {
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(POLL_MS);
                    // eslint-disable-next-line no-await-in-loop
                    st = await status(); calls++;
                    if (st.level !== from && st.finished) break;
                }
                await frame.evaluate(() => window.__swfBridge.game.botReset()).catch(() => null);
                calls++;
            } else if (MODE === 'T') {
                await page.evaluate((a) => window.__surface.wasm.teleport(a), ROOMS[other].arrive);
                const tEnd = Date.now() + 6000;
                while (Date.now() < tEnd && !dead) {
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(POLL_MS);
                    // eslint-disable-next-line no-await-in-loop
                    st = await status(); calls++;
                    if (st.level !== from) break;
                }
            }
            if (dead) break;
            if (st.error) { dead = st.error; break; }
            if (st.level === from) {
                stuck++;
                const d = hasBot ? await status() : {};
                out('stuck', { swaps, level: from, x: d.x, y: d.y, menu: d.menu, receive_input: d.receive_input });
                if (!hasBot && swaps === 0 && stuck < 8) {
                    // ⚠ MEASURED: the original's Splash → title menu is itself a `new Game` (one `Level:` line), so the
                    // title step above can stop ON the menu. Leave it with one more key, re-base the parity, retry.
                    await page.keyboard.press('x', { delay: 80 });
                    await page.waitForTimeout(3000);
                    lines0 = levelLines;
                    st = { level: RA };
                    continue;
                }
                if (stuck >= 3) break;
                continue;
            }
            stuck = 0;
            swaps++;
            // eslint-disable-next-line no-await-in-loop
            await page.waitForTimeout(300);
            const h = await take();
            out('swap', { n: swaps, level: st.level, levelLines, ms: Date.now() - tLeg, s: Math.round((Date.now() - t0) / 1000), calls,
                min: h.min, max: h.max, last: h.last, peak: h.peak, oom: h.oom, bytes: h.bytes, ...(lastGc ? { gc: lastGc } : {}) });
        }
        out('end', { swaps, dead: !!dead, s: Math.round((Date.now() - t0) / 1000) });
    }
    if (dead) {
        out('death', { what: dead });
        console.log(logs.slice(-30).join('\n'));
    }
    for (const l of logs.filter((x) => x.startsWith('[pageerror]')).slice(0, 5)) console.log(`INFO: ${l}`);
    const newGame = logs.filter((l) => l.includes('Invoked: new Game')).length;
    out('summary', { mode: MODE, build: BUILD, newGameLines: newGame, pageErrors: logs.filter((l) => l.startsWith('[pageerror]')).length,
        surface });
    await browser.close();
    process.exit(0);
}
