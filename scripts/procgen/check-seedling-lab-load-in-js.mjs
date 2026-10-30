#!/usr/bin/env node
/**
 * check-seedling-lab-load-in-js.mjs — LAB L3: **▶ load in JS** on the Seedling lab page (`watch.html`), driven in a
 * real browser.
 *
 * Each case ships what an arm holds to the JS runtime page (`jsRuntime.html?graphics=seedling&start=click`) through
 * the lab's ONE ship mechanism (`watchWasm.shipToJs`), presses the FRAME's ▶ Start as a real Playwright click (the
 * page itself never does: the click is the frame's user activation, which is what turns its sound on), and checks:
 *
 *   1. the ship reached `play`, through the JS stage list (`probe runtime start [levels] spot play`);
 *   2. with a level set: the frame's own `botLevelSet()` reports the set that was sent (set id, room count);
 *   3. the player is AT THE SPOT: the frame's `botStatus()` level is the shipped tape's boot level and its position
 *      is the boot's constructor args + the half tile (8, 8);
 *   4. the frame's sound readout (`__seedlingJsSound.readout`) shows the audio context `running`;
 *   5. a key press moves the player (a real keyboard press on the frame's canvas).
 *
 * Cases: a GENERATED room (GENERATE, one-room set, so `levels` runs), a VANILLA level (MANUAL's boot block, no set)
 * and REPLAY — ⛓ PHASE B (`seedling-js-tape-bridge`): the tape REPLAYED in the JS frame through the wasm tail
 * (`probe runtime start tape running finished drain verdict`), and instead of 1 and 3 above:
 *
 *   R1. the stages are the JS REPLAY list, in order, and the note says it is a REPLAY against the JS model;
 *   R2. the frame's `botStatus` is `finished` at the tape's `tick_count`, and the drain held `tick_count + 1`
 *       observations (the ship's own count);
 *   R3. the per-tick verdict — JS FRAME vs JS MODEL — AGREES at every tick, and the painted verdict names the JS
 *       frame (never `wasm verdict`);
 *   R4. LIVE INPUT MID-REPLAY does not reach the run: while the tape is ARMED (read before and after), a real key
 *       press on the frame (an arrow, X and V) and a tap on the `#jsTouch` d-pad go in — and R3's verdict still
 *       agrees per tick. (`#jsTouch` stays mounted on a replay ship: its taps are KeyboardEvents on the frame's
 *       canvas, the same held set the keyboard fills, which a tape tick never steps — pinned in Node by
 *       `jsRuntimeTape.test.js`'s live-keys row.)
 *   then 4 and 5 as before: after `finished` the frame goes on LIVE.
 *
 *   node scripts/procgen/check-seedling-lab-load-in-js.mjs [--host=http://localhost:8000] [--shots=<dir>]
 *
 * Exits 0 when every check passes (or SKIPs with no dev server), 1 otherwise. Takes the box lock (kind `browser`).
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The JS ship's stages, as `watchWasm.JS_STAGES` spells them (typed here on purpose: a row that imported them would
 *  read its own subject). ⛓ PHASE B: and a REPLAY's, `watchWasm.JS_REPLAY_STAGES` (no set, so no `levels`). */
const JS_STAGES = ['probe', 'runtime', 'start', 'levels', 'spot', 'play'];
const JS_REPLAY_STAGES = ['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain', 'verdict'];
const HALF_TILE = 8;

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-lab-load-in-js.mjs', kind: 'browser' });

    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const HOST = arg('host', 'http://localhost:8000');
    const SHOTS = arg('shots', '');
    const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`;
    const TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-1.json';

    let failed = 0;
    const check = (ok, what, detail) => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed++;
    };

    const alive = await fetch(`${HOST}/frontend/modules/seedlingDemo/jsRuntime.html`)
        .then(async (r) => { await r.arrayBuffer(); return r.ok; }).catch(() => false);
    if (!alive) {
        console.log(`SKIP: no dev server serving ${HOST}/frontend/modules/seedlingDemo/ — start one at the REPO ROOT `
            + '(or pass --host=)');
        process.exit(0);
    }
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });

    const CASES = [
        {
            name: 'generated',
            q: 'source=generate&seed=1&count=1&run=1',
            ready: "window.__editorGenerate?.status === 'ok' && !document.getElementById('loadJs').disabled",
            set: true,
        },
        {
            name: 'vanilla',
            // a vanilla level with a sword and hits_max in its seam: the spot carries inventory too
            q: 'source=manual&boot=frontend/modules/seedlingDemo/fixtures/tapes/r8-hammer-control.json',
            ready: "!document.getElementById('loadJs').disabled",
            set: false,
        },
        {
            name: 'replay',
            // `?touch=1`: the on-screen controls mount under the frame and drive it
            q: `tape=${TAPE}&touch=1`,
            ready: "!document.getElementById('loadJs').disabled",
            set: false,
            live: true,
            touch: true,
        },
    ];

    const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
    try {
        for (const c of CASES) {
            const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
            const errors = [];
            page.on('pageerror', (e) => errors.push(e.message));
            try {
                await page.goto(`${PAGE}?${c.q}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(c.ready, null, { timeout: 240000 });
                // What will be shipped: the arm's own builder (REPLAY has none — its spot is the tape file's boot).
                const shipped = c.live
                    ? { boot: (await (await fetch(`${HOST}/${TAPE}`)).json()).boot, set: null }
                    : await page.evaluate(async () => {
                        const p = await window.__editorShipProbe?.();
                        return p ? { boot: p.tape?.boot ?? null, set: p.levelSet?.set_id ?? null } : null;
                    });
                const note = await page.textContent('#loadJsNote');
                if (c.live) {
                    check(/REPLAY of the tape/.test(note) && /JS model/.test(note),
                        `${c.name}: the button's note says it is a REPLAY, judged against the JS model`, note);
                }
                await page.click('#loadJs');
                await page.waitForFunction(() => window.__editorJs?.reached?.includes('runtime'), null,
                    { timeout: 60000 });
                const frame = page.frames().find((f) => f.url().includes('/jsRuntime.html'));
                check(Boolean(frame) && /graphics=seedling/.test(frame.url()) && /start=click/.test(frame.url()),
                    `${c.name}: the frame is the JS runtime page with art and its own ▶ Start`, frame?.url());
                // ⛔ THE ONE CLICK THE PAGE MAY NEVER MAKE — a real click, inside the frame.
                await frame.click('#btn-start');
                if (c.live) {
                    // R4 — a key and a tap MID-REPLAY (the tape armed before the first and after the last).
                    await page.waitForFunction(() => window.__editorJs?.reached?.includes('running')
                        || window.__editorJs?.refusal, null, { timeout: 120000 });
                    const armedAt = async () => frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                    const pre = await armedAt();
                    for (const key of ['ArrowLeft', 'KeyX', 'KeyV']) await page.keyboard.down(key);
                    const pad = await page.evaluate(() => {
                        const r = document.getElementById('frame').nextElementSibling
                            ?.querySelector('.flash-touch-left')?.firstElementChild?.getBoundingClientRect();
                        return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
                    });
                    if (pad) {
                        await page.mouse.move(pad.x + pad.w * 0.88, pad.y + pad.h / 2);
                        await page.mouse.down();
                    }
                    await page.waitForTimeout(300);
                    if (pad) await page.mouse.up();
                    for (const key of ['ArrowLeft', 'KeyX', 'KeyV']) await page.keyboard.up(key);
                    const post = await armedAt();
                    check(pre.armed && post.armed && Boolean(pad) && post.tick > pre.tick,
                        `${c.name}: a key (left, X, V) and a #jsTouch tap went in MID-REPLAY (the tape armed throughout)`,
                        `armed ${pre.armed}→${post.armed} tick ${pre.tick}→${post.tick}/${pre.tick_count} pad=${Boolean(pad)}`);
                }
                const last = c.live ? 'verdict' : 'play';
                await page.waitForFunction((stage) => window.__editorJs?.stage === stage
                    || window.__editorJs?.refusal, last, { timeout: 120000 });
                const js = await page.evaluate(() => window.__editorJs);
                check(js.stage === last && !js.refusal, `${c.name}: the ship reached ${last}`,
                    js.refusal ? JSON.stringify(js.refusal) : js.reached.join(' → '));
                const want = c.live ? JS_REPLAY_STAGES : JS_STAGES.filter((s) => s !== 'levels' || c.set);
                check(JSON.stringify(js.stages) === JSON.stringify(want)
                    && JSON.stringify(js.reached) === JSON.stringify(want),
                    `${c.name}: the stages are the JS ${c.live ? 'REPLAY ' : ''}list, in order`, js.reached.join(' '));
                if (c.live) {
                    const tape = await (await fetch(`${HOST}/${TAPE}`)).json();
                    const fin = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                    check(fin.finished === true && fin.tick === tape.tick_count && fin.tick_count === tape.tick_count
                        && !fin.error && js.drain?.observations === tape.tick_count + 1,
                        `${c.name}: the frame finished at tick_count and drained tick_count + 1 observations`,
                        `finished=${fin.finished} tick=${fin.tick}/${tape.tick_count} error=${JSON.stringify(fin.error)} `
                        + `drained=${js.drain?.observations}`);
                    const verdictText = await page.textContent('#wasmVerdict');
                    check(js.verdict?.perTick?.kind === 'agrees' && /^js frame verdict:/.test(verdictText)
                        && !/wasm verdict/.test(verdictText),
                        `${c.name}: JS frame vs JS model AGREES at every tick (live input fed mid-replay), and the `
                        + 'verdict names the JS frame',
                        `${js.verdict?.perTick?.text} | ${verdictText.split('\n')[0].slice(0, 120)}`);
                }
                if (c.set) {
                    const ls = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botLevelSet()));
                    check(ls.active === js.set?.set_id && ls.active === shipped?.set
                        && ls.table_levels === js.set?.rooms,
                        `${c.name}: botLevelSet read back the set that was sent`,
                        `sent ${shipped?.set} (${js.set?.rooms} room(s)), frame ${ls.active} (${ls.table_levels})`);
                }
                const st = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                const b = shipped?.boot;
                if (!c.live) check(Boolean(b) && st.level === b.level && st.x === b.x + HALF_TILE && st.y === b.y + HALF_TILE,
                    `${c.name}: the player is at the spot`,
                    `boot L${b?.level} (${b?.x}, ${b?.y}); botStatus L${st.level} (${st.x}, ${st.y})`);
                // The sound: the context RUNNING (the Start click unlocked it) and both libraries loaded.
                await frame.waitForFunction(() => {
                    const r = window.__seedlingJsSound?.readout;
                    return r && r.loaded !== 'loading' && r.music?.loaded !== 'loading';
                }, null, { timeout: 60000 }).catch(() => null);
                const sound = await frame.evaluate(() => window.__seedlingJsSound?.readout ?? null);
                check(sound?.state === 'running' && sound?.on && sound?.loaded === 'ready'
                    && sound?.music?.on && sound?.music?.loaded === 'ready',
                    `${c.name}: the frame's sound effects and music are on, loaded and running`,
                    `state=${sound?.state} on=${sound?.on} loaded=${sound?.loaded} clips=${sound?.clips} `
                    + `music on=${sound?.music?.on} loaded=${sound?.music?.loaded} `
                    + `target=${JSON.stringify(sound?.music?.target)}`);
                // A key press moves the player: try each direction until one does (walls are room-specific).
                let moved = null;
                await frame.click('canvas#game');
                for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
                    const before = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                    await page.keyboard.down(key);
                    await page.waitForTimeout(600);
                    await page.keyboard.up(key);
                    await page.waitForTimeout(200);
                    const after = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                    if (after.x !== before.x || after.y !== before.y) {
                        moved = `${key}: (${before.x}, ${before.y}) → (${after.x}, ${after.y})`;
                        break;
                    }
                }
                check(Boolean(moved), `${c.name}: a key press moves the player`, moved ?? 'no direction moved it');
                if (c.touch) {
                    // The strip is the panel's (`touchControls`), under the frame, sending into the frame's canvas.
                    const strip = await page.evaluate(() => {
                        const el = document.getElementById('frame').nextElementSibling;
                        el?.scrollIntoView({ block: 'center' });
                        const pad = el?.classList.contains('flash-touch-controls')
                            ? el.querySelector('.flash-touch-left')?.firstElementChild : null;
                        const r = pad?.getBoundingClientRect();
                        return {
                            mounted: Boolean(pad), checked: document.getElementById('jsTouch').checked,
                            buttons: el ? el.querySelectorAll('.flash-touch-right > *').length : 0,
                            pad: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
                        };
                    });
                    check(strip.mounted && strip.checked, `${c.name}: ?touch=1 mounts the on-screen controls under `
                        + 'the frame', JSON.stringify(strip));
                    if (strip.pad) {
                        const before = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                        // the pad's LEFT rim (the key test above walked right, toward a wall maybe)
                        await page.mouse.move(strip.pad.x + strip.pad.w * 0.12, strip.pad.y + strip.pad.h / 2);
                        await page.mouse.down();
                        await page.waitForTimeout(600);
                        await page.mouse.up();
                        await page.waitForTimeout(200);
                        const after = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                        check(after.x < before.x, `${c.name}: the on-screen d-pad (left) moves the player in the frame`,
                            `(${before.x}, ${before.y}) → (${after.x}, ${after.y})`);
                    }
                }
                const hud = await page.textContent('#wasmHud');
                check(/position/.test(hud) && /sound/.test(hud), `${c.name}: the ship's HUD shows the live game`,
                    hud.replace(/\s+/g, ' ').slice(0, 160));
                if (SHOTS) {
                    await page.screenshot({ path: join(SHOTS, `lab-load-in-js-${c.name}.png`), fullPage: false });
                    await page.locator('#frame').screenshot({ path: join(SHOTS, `lab-load-in-js-${c.name}-frame.png`) });
                }
                check(errors.length === 0, `${c.name}: no page errors`, errors.join(' | '));
            } catch (e) {
                check(false, `${c.name}: the case ran to its end`, e.message.split('\n')[0]);
            } finally {
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) main();
