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
 * And SEQUENCE — ⛓ seedling-js-replay-continuation: `?tapes=toy-west-pair` (two windows), its admitted walk shipped to
 * the JS frame through the SAME window loop the wasm transport uses, on ONE run:
 *
 *   S1. the stages are the SEQUENCE list (`tape k/2 … boundary 1/2 … verdict`), in order, and the note says it is a
 *       sequence REPLAY against the JS model;
 *   S2. window 1 HELD at its latch (`heldAtFinish`), the boundary admitted window 2 on the frame's own latch
 *       (`botJsLatch`: window 2's boot is the live room's construction spot), and the frame CONTINUED the run there
 *       (its `tape … continued` boot note, not a rebuild);
 *   S3. every window's per-tick verdict and the whole sequence's AGREE (JS frame vs JS model), the frame finished
 *       window 2 at its `tick_count`, and the drains held `61 + 48 + 1` observations;
 *   then 4 and 5: after the last window the frame goes on LIVE.
 *
 * And TOUCH — ⛓ seedling-lab-touch-fix (⚖ the user 2026-11-11: *"the touch controls on the Seedling lab page stopped
 * working. Also, there are two copies of the touch controls on the lab page, and one of those copies never did
 * anything."*). A PHONE context (isMobile + hasTouch, so a coarse pointer and the option's `auto` shows them, no
 * `?touch=`), and REAL touch input: `page.tap` for the buttons, CDP `Input.dispatchTouchEvent` for a held d-pad.
 * ⛔ The rows above drive the strip with the mouse at a fine pointer, where MANUAL + ▶ load in JS mounts NO strip at
 * all, so the state the user saw (two strips at once) was never on their screen. Per arm:
 *
 *   T1. MANUAL: NO strip before START (⚖ 2026-11-11: "those controls should only appear after pressing Start");
 *       START shows ONE, under the lab canvas, and a held d-pad MOVES the lab's run (the HUD's position); STOP
 *       takes it away.
 *   T2. MANUAL (running) + ▶ load in JS: ONE strip, under the FRAME (MANUAL's stands down while a ship holds the
 *       frame), at full strength, and a held d-pad MOVES the frame's player.
 *   T3. REPLAY + ▶ load in JS: ONE strip, under the frame, DIMMED and LABELLED while the tape drives (the ship's
 *       own stage state), where a held d-pad changes nothing (the per-tick verdict still agrees); at `finished` it
 *       is at full strength and a held d-pad MOVES the player.
 *   T4. SOLVE before any ship: NO strip.
 *   T5. MANUAL (running) + ▶ load in wasm: ONE strip, under the wasm frame, with Esc, and a held d-pad MOVES the
 *       real game's player. (Headless WebGPU, `headlessWebgpuArgs` — the launch every headless wasm gate uses.)
 *
 *   node scripts/procgen/check-seedling-lab-load-in-js.mjs [--host=http://localhost:8000] [--shots=<dir>]
 *        [--only=touch]   (the TOUCH section alone)
 *
 * Exits 0 when every check passes (or SKIPs with no dev server), 1 otherwise. Takes the box lock (kind `browser`).
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { headlessWebgpuArgs } from './headlessChromium.js';

argvHelp(import.meta.url);

/** The JS ship's stages, as `watchWasm.JS_STAGES` spells them (typed here on purpose: a row that imported them would
 *  read its own subject). ⛓ PHASE B: and a REPLAY's, `watchWasm.JS_REPLAY_STAGES` (no set, so no `levels`). */
const JS_STAGES = ['probe', 'runtime', 'start', 'levels', 'spot', 'play'];
const JS_REPLAY_STAGES = ['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain', 'verdict'];
/** ⛓ seedling-js-replay-continuation: a two-window SEQUENCE's, as `watchWasm.stagesOf({windows: 2})` spells it. */
const JS_SEQUENCE_STAGES = ['probe', 'runtime', 'start', 'tape 1/2', 'running 1/2', 'finished 1/2', 'drain 1/2',
    'boundary 1/2', 'tape 2/2', 'running 2/2', 'finished 2/2', 'drain 2/2', 'verdict'];
const SEQUENCE = ['r7-ends-meet-1', 'r7-ends-meet-2'];
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
        {
            name: 'sequence',
            q: 'tapes=toy-west-pair',
            ready: "window.__editorSequence?.admitted === true && !document.getElementById('loadJs').disabled",
            set: false,
            seq: true,
        },
    ];

    const ONLY = arg('only', '');
    const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
    try {
        for (const c of ONLY === 'touch' ? [] : CASES) {
            const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
            const errors = [];
            page.on('pageerror', (e) => errors.push(e.message));
            try {
                await page.goto(`${PAGE}?${c.q}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(c.ready, null, { timeout: 240000 });
                // What will be shipped: the arm's own builder (REPLAY has none — its spot is the tape file's boot).
                const shipped = c.seq ? null : c.live
                    ? { boot: (await (await fetch(`${HOST}/${TAPE}`)).json()).boot, set: null }
                    : await page.evaluate(async () => {
                        const p = await window.__editorShipProbe?.();
                        return p ? { boot: p.tape?.boot ?? null, set: p.levelSet?.set_id ?? null } : null;
                    });
                const note = await page.textContent('#loadJsNote');
                if (c.seq) {
                    check(/REPLAY of the sequence/.test(note) && /JS model/.test(note),
                        `${c.name}: the button's note says it is a SEQUENCE replay, judged against the JS model`, note);
                }
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
                    // `running` can be reached before the first tape tick (CI measured tick 0→0 over a fixed 300 ms):
                    // wait for the tape to STEP, then hold the input until it has stepped again — by tick, not time.
                    const tickPast = (n) => frame.waitForFunction((k) => {
                        const st = JSON.parse(window.__swfBridge.game.botStatus());
                        return st.tick > k || st.finished;
                    }, n, { timeout: 60000 }).catch(() => null);
                    await tickPast(0);
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
                    await tickPast(pre.tick + 4);
                    if (pad) await page.mouse.up();
                    for (const key of ['ArrowLeft', 'KeyX', 'KeyV']) await page.keyboard.up(key);
                    const post = await armedAt();
                    check(pre.armed && post.armed && Boolean(pad) && post.tick > pre.tick,
                        `${c.name}: a key (left, X, V) and a #jsTouch tap went in MID-REPLAY (the tape armed throughout)`,
                        `armed ${pre.armed}→${post.armed} tick ${pre.tick}→${post.tick}/${pre.tick_count} pad=${Boolean(pad)}`);
                }
                const last = c.live || c.seq ? 'verdict' : 'play';
                await page.waitForFunction((stage) => window.__editorJs?.stage === stage
                    || window.__editorJs?.refusal, last, { timeout: 120000 });
                const js = await page.evaluate(() => window.__editorJs);
                check(js.stage === last && !js.refusal, `${c.name}: the ship reached ${last}`,
                    js.refusal ? JSON.stringify(js.refusal) : js.reached.join(' → '));
                const want = c.seq ? JS_SEQUENCE_STAGES : c.live ? JS_REPLAY_STAGES
                    : JS_STAGES.filter((s) => s !== 'levels' || c.set);
                check(JSON.stringify(js.stages) === JSON.stringify(want)
                    && JSON.stringify(js.reached) === JSON.stringify(want),
                    `${c.name}: the stages are the JS ${c.seq ? 'SEQUENCE ' : c.live ? 'REPLAY ' : ''}list, in order`,
                    js.reached.join(' '));
                if (c.seq) {
                    const tapes = await Promise.all(SEQUENCE.map(async (n) => (await fetch(
                        `${HOST}/frontend/modules/seedlingDemo/fixtures/tapes/${n}.json`)).json()));
                    const w = js.windows ?? [];
                    const boots = await frame.evaluate(() => window.__seedlingJsRuntime?.events
                        ?.filter((e) => e.type === 'boot' || (e.type === 'tape' && e.continued))
                        .map((e) => (e.continued ? 'continued' : e.why)) ?? null);
                    check(w.length === 2 && w[0].heldAtFinish === true && w[1].admission !== null
                        && w[1].live?.level === tapes[1].boot.level && w[1].live?.ctor?.x === tapes[1].boot.x
                        && w[1].live?.ctor?.y === tapes[1].boot.y,
                        `${c.name}: window 1 HELD at its latch, and window 2 was admitted on the frame's own latch`,
                        `held=${w[0]?.heldAtFinish} live=${JSON.stringify(w[1]?.live && { level: w[1].live.level, ctor: w[1].live.ctor })}`);
                    check(Array.isArray(boots) && boots.at(-1) === 'continued' && boots.filter((b) => b === 'continued').length === 1,
                        `${c.name}: the frame CONTINUED the run at window 2 (no rebuild)`, JSON.stringify(boots));
                    const fin = await frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
                    const total = tapes[0].tick_count + tapes[1].tick_count + 1;
                    check(w.every((x) => /agrees/.test(x.verdict?.perTick?.text ?? '') && x.verdict?.perTick?.agrees)
                        && js.verdict?.perTick?.kind === 'agrees' && fin.finished === true
                        && fin.tick === tapes[1].tick_count && js.drain?.observations === total,
                        `${c.name}: every window and the whole sequence AGREE per tick (JS frame vs JS model)`,
                        `${w.map((x) => x.verdict?.perTick?.text).join(' | ')} | whole: ${js.verdict?.perTick?.text} `
                        + `| drained ${js.drain?.observations}/${total}`);
                }
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
                if (!c.live && !c.seq) check(Boolean(b) && st.level === b.level && st.x === b.x + HALF_TILE && st.y === b.y + HALF_TILE,
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
        await touchSection({ PAGE, TAPE, check, SHOTS });
    } finally {
        await browser.close();
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}

/**
 * ⛓ TOUCH (seedling-lab-touch-fix) — T1–T5 in the header. Every mount is counted on the page (`.flash-touch-controls`
 * anywhere), and every "moves" is the GAME's position, read from the run itself, never the strip's own held mark.
 * Its own browser: the wasm row (T5) needs the repo's headless WebGPU launch (`headlessWebgpuArgs`), the switches
 * every headless wasm gate uses.
 */
async function touchSection({ PAGE, TAPE, check, SHOTS }) {
    const BOOT = 'frontend/modules/seedlingDemo/fixtures/tapes/r8-hammer-control.json';
    const browser = await chromium.launch({
        args: headlessWebgpuArgs({ extra: ['--autoplay-policy=user-gesture-required'] }),
    });
    const strips = (page) => page.evaluate(() => [...document.querySelectorAll('.flash-touch-controls')].map((el) => ({
        under: el.previousElementSibling?.id ?? null,
        opacity: Number(getComputedStyle(el).opacity),
        tape: el.dataset.labTape ?? null,
        note: el.nextElementSibling?.classList.contains('labTapeNote') ? el.nextElementSibling.textContent : null,
        esc: (() => {
            const e = el.querySelector('.flash-touch-button-menu');
            return Boolean(e) && getComputedStyle(e).display !== 'none';
        })(),
    })));
    /** A held finger on the d-pad of the strip under `#<under>`, at `side` (1 = right rim, -1 = left), for `ms`. */
    const hold = async (page, cdp, under, side, ms) => {
        // ⚠ The page above the strip re-lays out while a run paints its HUD, so the finger is aimed, checked with
        // elementFromPoint, and re-aimed (up to 3 times) — a touch that lands beside the pad is the harness's miss,
        // not the page's.
        let at = null;
        for (let i = 0; i < 3 && at?.hit !== 'flash-touch-dpad'; i++) {
            await page.locator(`#${under} + .flash-touch-controls`).scrollIntoViewIfNeeded();
            at = await page.evaluate(({ u, sd }) => {
                const r = document.querySelector(`#${u} + .flash-touch-controls .flash-touch-dpad`)
                    .getBoundingClientRect();
                const x = r.left + r.width / 2 + sd * r.width * 0.35;
                const y = r.top + r.height / 2;
                return { x, y, hit: document.elementFromPoint(x, y)?.className ?? null };
            }, { u: under, sd: side });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
        await page.waitForTimeout(ms);
        const held = await page.evaluate((u) => document.querySelector(`#${u} + .flash-touch-controls`)?.dataset.held
            ?? null, under);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(200);
        return { ...at, held };
    };
    const phone = async (q) => {
        const ctx = await browser.newContext({
            viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
        });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const cdp = await ctx.newCDPSession(page);
        await page.goto(`${PAGE}?${q}`, { waitUntil: 'domcontentloaded' });
        return { ctx, page, cdp, errors };
    };
    const frameOf = async (page, re) => {
        for (let i = 0; i < 300; i++) {
            const f = page.frames().find((fr) => re.test(fr.url()));
            if (f) return f;
            await page.waitForTimeout(200);
        }
        return null;
    };
    const status = (frame) => frame.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
    const hudX = (page) => page.evaluate(() => {
        const m = document.getElementById('hud').textContent.replace(/\s+/g, ' ').match(/position\s*(-?[\d.]+)/);
        return m ? Number(m[1]) : null;
    });
    let step = '';
    /**
     * ⚠ A VIEWPORT shot, the strip scrolled in. Measured: a `fullPage: true` screenshot of an `isMobile` context
     * DROPS its touch emulation for the rest of the page's life (`(pointer: coarse)` false, `maxTouchPoints` 0), so
     * the option's `auto` rightly shows nothing at the next START — the harness's own artifact, red only with
     * `--shots`.
     */
    const shot = async (page, name) => {
        await page.locator('.flash-touch-controls').first().scrollIntoViewIfNeeded().catch(() => {});
        await page.screenshot({ path: join(SHOTS, name) });
    };
    const startManual = async (page) => {
        await page.tap('#manualStart');
        step = 'waitForFunction () => document.getElementById(manualStart).disabled, null,';
        await page.waitForFunction(() => document.getElementById('manualStart').disabled, null, { timeout: 30000 });
    };

    // T1 + T2 — MANUAL, then ▶ load in JS on the SAME page, MANUAL's run still going.
    {
        const { ctx, page, cdp, errors } = await phone(`source=manual&boot=${BOOT}&speed=1`);
        try {
            step = 'waitForSelector #manualStart:not([disabled]), { timeout: 120000 });';
            await page.waitForSelector('#manualStart:not([disabled])', { timeout: 120000 });
            step = 'waitForFunction () => !document.getElementById(manualTouch).disabled, null';
            await page.waitForFunction(() => !document.getElementById('manualTouch').disabled, null,
                { timeout: 30000 });
            const pre = await strips(page);
            check(pre.length === 0, 'touch T1: MANUAL on a phone shows NO strip before START (⚖ 2026-11-11)',
                JSON.stringify(pre));
            await startManual(page);
            step = 'waitForSelector #canvas + .flash-touch-controls, { timeout: 30000 });';
            await page.waitForSelector('#canvas + .flash-touch-controls', { timeout: 60000 });
            const s0 = await strips(page);
            check(s0.length === 1 && s0[0].under === 'canvas' && s0[0].opacity === 1,
                'touch T1: START shows ONE strip, under the lab canvas, at full strength', JSON.stringify(s0));
            const x0 = await hudX(page);
            const h = await hold(page, cdp, 'canvas', 1, 800);
            const x1 = await hudX(page);
            check(h.held === 'ArrowRight' && x0 !== null && x1 > x0,
                'touch T1: a REAL held touch on the d-pad (right) moves MANUAL’s run',
                `held=${h.held} hit=${h.hit} x ${x0} → ${x1}`);
            if (SHOTS) await shot(page, 'touch-manual-running.png');
            await page.tap('#manualStop');
            step = 'waitForFunction () => window.__editorManual?.roundTrip !== undefined, null, ';
            await page.waitForFunction(() => window.__editorManual?.roundTrip !== undefined, null, { timeout: 60000 });
            const s1 = await strips(page);
            check(s1.length === 0, 'touch T1: STOP takes the strip away with the run', JSON.stringify(s1));

            // MANUAL running again, THEN ▶ load in JS: MANUAL's strip must stand down for the frame's.
            await startManual(page);
            step = 'waitForSelector #canvas + .flash-touch-controls, { timeout: 30000 });';
            await page.waitForSelector('#canvas + .flash-touch-controls', { timeout: 60000 });
            step = 'waitForFunction () => !document.getElementById(loadJs).disabled, null, { t';
            await page.waitForFunction(() => !document.getElementById('loadJs').disabled, null, { timeout: 120000 });
            await page.tap('#loadJs');
            const frame = await frameOf(page, /\/jsRuntime\.html/);
            step = 'waitForSelector #frame + .flash-touch-controls, { timeout: 30000 });';
            await page.waitForSelector('#frame + .flash-touch-controls', { timeout: 60000 });
            await frame.tap('#btn-start');
            step = 'waitForFunction () => window.__editorJs?.stage === play || window.__editor';
            await page.waitForFunction(() => window.__editorJs?.stage === 'play' || window.__editorJs?.refusal, null,
                { timeout: 120000 });
            const s2 = await strips(page);
            check(s2.length === 1 && s2[0].under === 'frame',
                'touch T2: MANUAL (running) + ▶ load in JS shows ONE strip, under the frame (MANUAL’s stands down)',
                JSON.stringify(s2));
            check(s2.length > 0 && s2.every((s) => s.opacity === 1 && s.tape === null && !s.esc),
                'touch T2: …at full strength, no tape note (a live ship), no Esc (the JS run has no pause menu)',
                JSON.stringify(s2));
            const before = await status(frame);
            const h2 = await hold(page, cdp, 'frame', 1, 800);
            const after = await status(frame);
            check(h2.held === 'ArrowRight' && after.x > before.x,
                'touch T2: a REAL held touch on that d-pad (right) moves the player in the JS frame',
                `held=${h2.held} hit=${h2.hit} (${before.x}, ${before.y}) → (${after.x}, ${after.y})`);
            if (SHOTS) await shot(page, 'touch-manual-plus-js.png');
            check(errors.length === 0, 'touch T1/T2: no page errors', errors.join(' | '));
        } catch (e) {
            check(false, 'touch T1/T2: the case ran to its end', `at [${step}] ${e.message.split('\n')[0]}`);
        } finally {
            await ctx.close();
        }
    }

    // T3 — REPLAY + ▶ load in JS: dimmed and labelled while the tape drives (and a held d-pad changes nothing),
    // full strength and live once it has finished. The state is the ship's own (`__editorJs.reached`).
    {
        const { ctx, page, cdp, errors } = await phone(`tape=${TAPE}`);
        try {
            step = 'waitForFunction () => !document.getElementById(loadJs).disabled, null, { t';
            await page.waitForFunction(() => !document.getElementById('loadJs').disabled, null, { timeout: 240000 });
            const s0 = await strips(page);
            check(s0.length === 0, 'touch T3: REPLAY mounts no strip before a ship', JSON.stringify(s0));
            await page.tap('#loadJs');
            const frame = await frameOf(page, /\/jsRuntime\.html/);
            step = 'waitForSelector #frame + .flash-touch-controls, { timeout: 30000 });';
            await page.waitForSelector('#frame + .flash-touch-controls', { timeout: 60000 });
            await frame.tap('#btn-start');
            step = 'waitForFunction () => window.__editorJs?.reached?.includes(running)';
            await page.waitForFunction(() => window.__editorJs?.reached?.includes('running')
                || window.__editorJs?.refusal, null, { timeout: 120000 });
            const mid = await strips(page);
            const midStage = await page.evaluate(() => window.__editorJs?.reached?.at(-1));
            check(midStage === 'running' && mid.length === 1 && mid[0].under === 'frame' && mid[0].tape === 'replaying'
                && mid[0].opacity < 1 && mid[0].note === 'Replaying — the controls take over when the tape ends',
                'touch T3: while the tape drives, ONE strip under the frame, DIMMED and LABELLED',
                `${midStage} ${JSON.stringify(mid)}`);
            const h0 = await hold(page, cdp, 'frame', -1, 800);
            step = 'waitForFunction () => window.__editorJs?.stage === verdict || window.__edi';
            await page.waitForFunction(() => window.__editorJs?.stage === 'verdict' || window.__editorJs?.refusal, null,
                { timeout: 180000 });
            const js = await page.evaluate(() => window.__editorJs);
            check(h0.held === 'ArrowLeft' && js.verdict?.perTick?.kind === 'agrees',
                'touch T3: …and a held d-pad mid-replay changes nothing (JS frame vs JS model agrees at every tick)',
                `held=${h0.held} hit=${h0.hit} at (${h0.x}, ${h0.y}) perTick=${js.verdict?.perTick?.kind}`);
            const s1 = await strips(page);
            check(s1.length === 1 && s1[0].under === 'frame' && s1[0].opacity === 1 && s1[0].tape === null
                && s1[0].note === null,
                'touch T3: once the tape has finished, the strip is at full strength and the note is gone',
                JSON.stringify(s1));
            const before = await status(frame);
            const h = await hold(page, cdp, 'frame', -1, 800);
            const after = await status(frame);
            check(before.finished && h.held === 'ArrowLeft' && after.x < before.x,
                'touch T3: …and a REAL held touch (left) moves the player in the frame',
                `finished=${before.finished} held=${h.held} (${before.x}, ${before.y}) → (${after.x}, ${after.y})`);
            check(errors.length === 0, 'touch T3: no page errors', errors.join(' | '));
        } catch (e) {
            check(false, 'touch T3: the case ran to its end', `at [${step}] ${e.message.split('\n')[0]}`);
        } finally {
            await ctx.close();
        }
    }

    // T4 — SOLVE before a ship: no strip.
    {
        const { ctx, page, errors } = await phone(`source=solve&boot=${BOOT}`);
        try {
            step = 'waitForSelector #solveGo:not([disabled]), { timeout: 120000 });';
            await page.waitForSelector('#solveGo:not([disabled])', { timeout: 120000 });
            await page.waitForTimeout(1000);
            const s0 = await strips(page);
            check(s0.length === 0, 'touch T4: SOLVE on a phone mounts no strip before a ship', JSON.stringify(s0));
            check(errors.length === 0, 'touch T4: no page errors', errors.join(' | '));
        } catch (e) {
            check(false, 'touch T4: the case ran to its end', `at [${step}] ${e.message.split('\n')[0]}`);
        } finally {
            await ctx.close();
        }
    }

    // T5 — MANUAL (running) + ▶ load in wasm: the wasm frame gets the strip (⚖ the user 2026-11-11: "No new
    // controls appear when clicking load in wasm"), MANUAL's stands down, and a held d-pad moves the REAL game.
    {
        const { ctx, page, cdp, errors } = await phone(`source=manual&boot=${BOOT}`);
        try {
            step = 'waitForSelector #manualStart:not([disabled]), { timeout: 120000 });';
            await page.waitForSelector('#manualStart:not([disabled])', { timeout: 120000 });
            step = 'waitForFunction () => !document.getElementById(manualTouch).disabled, null';
            await page.waitForFunction(() => !document.getElementById('manualTouch').disabled, null,
                { timeout: 30000 });
            await startManual(page);
            step = 'waitForSelector #canvas + .flash-touch-controls, { timeout: 30000 });';
            await page.waitForSelector('#canvas + .flash-touch-controls', { timeout: 60000 });
            step = 'waitForFunction () => !document.getElementById(loadWasm).disabled, null, {';
            await page.waitForFunction(() => !document.getElementById('loadWasm').disabled, null, { timeout: 120000 });
            await page.tap('#loadWasm');
            const frame = await frameOf(page, /\/wasm\/[^/]+\/game\.html/);
            step = 'waitForSelector #btn-start, { timeout: 120000 });';
            await frame.waitForSelector('#btn-start', { timeout: 120000 });
            step = 'waitForSelector #frame + .flash-touch-controls, { timeout: 60000 });';
            await page.waitForSelector('#frame + .flash-touch-controls', { timeout: 60000 });
            step = 'waitForFunction () => window.__watch?.wasm?.reached?.includes(runtime)';
            await page.waitForFunction(() => window.__watch?.wasm?.reached?.includes('runtime')
                || window.__watch?.wasm?.refusal, null, { timeout: 180000 });
            await frame.tap('#btn-start');
            step = 'waitForFunction () => window.__watch?.wasm?.stage === verdict';
            await page.waitForFunction(() => window.__watch?.wasm?.stage === 'verdict'
                || window.__watch?.wasm?.refusal, null, { timeout: 240000 });
            const w = await page.evaluate(() => ({ stage: window.__watch?.wasm?.stage,
                refusal: window.__watch?.wasm?.refusal ?? null }));
            const s1 = await strips(page);
            check(w.stage === 'verdict' && s1.length === 1 && s1[0].under === 'frame' && s1[0].opacity === 1
                && s1[0].tape === null && s1[0].esc,
                'touch T5: MANUAL (running) + ▶ load in wasm shows ONE strip, under the wasm frame, with Esc '
                + '(MANUAL’s stands down)', `${JSON.stringify(w)} ${JSON.stringify(s1)}`);
            const before = await status(frame);
            const h = await hold(page, cdp, 'frame', 1, 1200);
            const after = await status(frame);
            check(h.held === 'ArrowRight' && after.x > before.x,
                'touch T5: a REAL held touch on that d-pad (right) moves the player in the REAL (wasm) game',
                `held=${h.held} hit=${h.hit} (${before.x}, ${before.y}) → (${after.x}, ${after.y})`);
            if (SHOTS) await shot(page, 'touch-manual-plus-wasm.png');
            check(errors.length === 0, 'touch T5: no page errors', errors.join(' | '));
        } catch (e) {
            check(false, 'touch T5: the case ran to its end', `at [${step}] ${e.message.split('\n')[0]}`);
        } finally {
            await ctx.close();
        }
    }
    await browser.close();
}

if (isEntryPoint(import.meta.url)) main();
