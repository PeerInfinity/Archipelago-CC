#!/usr/bin/env node
/**
 * Seedling fidelity F2, D2: **IS A KEY STILL HELD WHEN A WINDOW ENDS?** (residue
 * row 25: the LONE-KEYUP risk at window boundaries). MEASURE ONLY.
 *
 * Between two windows, the director's driver (`seedling-bot-replay-win.py`,
 * `--tapes` with `releaseKeyCodes`) and `watchWasm.releaseKeysInFrame` release
 * the keys with a LONE DOM `keyup`, which the runtime drops for a key it never
 * saw go down (the JS arc's W3, `seedlingWasmPlayback.js` `releaseKeys`). The
 * driver's own comment says a window whose last span runs to `tick_count`
 * leaves that key held; `Bot.update` dispatches the span's KEY_UP on the
 * finish tick (`spanTo == tick`, before the latch). Which holds is measured on
 * the subject the driver's comment names: `r4-walk-1-sword` (`up` 591..641,
 * `tick_count` 641) followed by `r4-walk-2-feather`.
 *
 *   A  THE TOOL. The real driver, headless, on the two windows
 *      (`director.windowsFrom(…, {strip: true})`, as `run-seedling-director`
 *      builds them): arm LONE with `releaseKeyCodes` (the tool as it ships),
 *      arm NONE without. Per arm: `moved_at_boundary`, window 0's drained end
 *      vs window 1's boot, and window 1's stream against its committed
 *      recording.
 *   B  THE GAME'S OWN READOUT, one page: window 0 alone, then at the latch the
 *      edge echo (`status.input`: `t`, `released`, `held`), the position
 *      sampled over two seconds of free-running world with NO release, then a
 *      POSITIVE CONTROL: a full DOM keydown of `up` on the canvas (a key the
 *      runtime DOES see go down) must drift the player, and the tools' lone
 *      `keyup` form and the full form are each tried on it.
 *
 * ⛓ MEASURED 2026-10-02 at `02f98f1` (p4e, headless, twice, identical but for wall
 * clock): VERDICT (i). The latch's edge echo is `t 641, released [up], held []`
 * (`up` presses 7 = releases 7); 2 s of free-running world with no release
 * stays at (264,264); both tool arms read `moved_at_boundary false` and window
 * 1 byte-identical to its recording. The control drifts (264 -> 259.9 in
 * 150 ms). So the lone keyup releases nothing because nothing is held: the
 * bot's finish-tick KEY_UP is an AS3 `dispatchEvent` on `FP.stage`, which
 * never passes the runtime's physical-key filter.
 *
 * Prints rows and a VERDICT line. Takes the box lock. `--json=<path>` writes
 * the readings. Prereqs: a dev server at the repo root (`SEEDLING_PORT`), the
 * wasm build, and the headless venv (`requirements-headless.txt`).
 *
 * Run: SEEDLING_PORT=9120 node scripts/procgen/probe-seedling-f2-boundary.mjs [--json=<path>]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The boundary the driver's own comment names (`seedling-bot-replay-win.py`, the `--tapes` note). */
export const F2_BOUNDARY = Object.freeze(['r4-walk-1-sword', 'r4-walk-2-feather']);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-f2-boundary.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const { driverChannel } = await import('./seedlingDriver.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { loadTape, loadExpectation } = await M('fixtures/index.js');
    const director = await M('director.js');
    const { parseTape, gameVisibleTape, KEY_CODES } = await M('tapeFormat.js');
    const { TAPE_KEY_RELEASES } = await M('wasmPlayback.js');

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4e';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const JSON_OUT = process.argv.find((a) => a.startsWith('--json='))?.slice('--json='.length) ?? '';
    const out = { build: PAGE_NAME, boundary: F2_BOUNDARY, tool: {}, game: {} };
    const segments = F2_BOUNDARY.map((n) => loadTape(n));
    const w0 = segments[0];
    out.subject = { tick_count: w0.tick_count, endSpans: w0.inputs.filter((s) => s.to >= w0.tick_count) };
    console.log(`SUBJECT: ${w0.name} tick_count ${w0.tick_count}; spans to the end: `
        + `${JSON.stringify(out.subject.endSpans)}`);

    // ── B: the game's own readout + the positive control ───────────────
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    try {
        const page = await browser.newPage();
        const call = (n, a) => page.evaluate(([nn, aa]) => {
            const g = window.__swfBridge?.game;
            return g && typeof g[nn] === 'function' ? (aa === undefined ? g[nn]() : g[nn](aa)) : null;
        }, [n, a]);
        const status = async () => JSON.parse(await call('botStatus'));
        const pos = async () => { const s = await status(); return { level: s.level, x: s.x, y: s.y }; };
        const waitFor = async (what, fn, ms = 300000) => {
            const t0 = Date.now();
            for (;;) {
                const v = await fn();
                if (v) return v;
                if (Date.now() - t0 > ms) throw new Error(`timeout: ${what}`);
                await page.waitForTimeout(200);
            }
        };
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        await waitFor('runtime', () => page.evaluate(() => !!window.__runtimeReady));
        await page.click('#btn-start');
        await waitFor('bot', () => page.evaluate(() => !!window.__swfBridge?.game?.botStatus));
        await assertLogicOnlyChannel(page);
        if (await call('botLoadTape', JSON.stringify(gameVisibleTape(w0))) !== 'ok') throw new Error('botLoadTape');
        if (await call('botStart') !== 'ok') throw new Error('botStart');
        const latch = await waitFor('latch', async () => { const s = await status(); return s.finished ? s : null; });
        const drift = [{ ms: 0, ...(await pos()) }];
        for (const ms of [300, 1000, 2000]) {
            await page.waitForTimeout(ms - drift.at(-1).ms);
            drift.push({ ms, ...(await pos()) });
        }
        out.game.latch = { tick: latch.tick, tick_count: latch.tick_count, input: latch.input,
            at: { level: latch.level, x: latch.x, y: latch.y }, persistence_cleared: latch.persistence_cleared };
        out.game.driftNoRelease = drift;
        console.log(`GAME latch: tick ${latch.tick}/${latch.tick_count} input ${JSON.stringify(latch.input)}`);
        console.log(`GAME drift with NO release over 2 s: ${JSON.stringify(drift)}`);

        const up = TAPE_KEY_RELEASES.find((k) => k.name === 'up');
        const dom = (type, full) => page.evaluate(([t, k, f]) => {
            const c = document.querySelector('canvas');
            const init = f ? { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true }
                : { keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true };
            // The tools' lone keyup goes to document, window and the canvas; the full form to the canvas.
            for (const target of f ? [c] : [document, window, c].filter(Boolean)) target.dispatchEvent(new KeyboardEvent(t, init));
        }, [type, up, full]);
        const settle = async (ms) => { const p0 = await pos(); await page.waitForTimeout(ms); return { from: p0, to: await pos() }; };
        // Short presses, so the player is still in open floor when each keyup lands
        // (a 600 ms hold walks it into the room's edge, which stops it either way).
        await dom('keydown', true);
        const held = await settle(150);
        await dom('keyup', false);
        await page.waitForTimeout(150);
        const afterLone = await settle(400);
        await dom('keyup', true);
        await page.waitForTimeout(150);
        const afterFull = await settle(400);
        out.game.positive = { heldByDomKeydown: held, afterToolsLoneKeyup: afterLone, afterFullKeyup: afterFull };
        const moved = (s) => s.from.x !== s.to.x || s.from.y !== s.to.y || s.from.level !== s.to.level;
        console.log(`CONTROL a DOM keydown of up drifts the player: ${moved(held)} ${JSON.stringify(held)}`);
        console.log(`CONTROL then the tools' lone keyup (keyCode only, 3 targets) stops it: ${!moved(afterLone)} ${JSON.stringify(afterLone)}`);
        console.log(`CONTROL then the full keyup (key/code/keyCode, canvas) stops it: ${!moved(afterFull)} ${JSON.stringify(afterFull)}`);
    } finally {
        await browser.close();
    }
    // ── A: the tool, both ways ─────────────────────────────────────────
    // ⛔ Today's driver refuses a window that does not declare the LIVE cleared set
    // (its R9 slice 6 boundary guard), so window 1 declares exactly what the game
    // reported at window 0's latch in B: the inheritance is the game's.
    const liveRows = (out.game.latch.persistence_cleared ?? [])
        .map((r) => ({ level: r.level, tag: r.tag, note: 'f2: the live set at window 0\'s latch' }));
    const [s0, s1] = director.windowsFrom(segments, { strip: true });
    const windows = [parseTape(s0), parseTape({ ...s1, persistence: liveRows })];
    const want1 = loadExpectation(F2_BOUNDARY[1]).stream;
    const channel = driverChannel({ win: false, driver: join(HERE, 'seedling-bot-replay-win.py'),
        chromiumArgs: HEADLESS_LOGIC_ONLY_ARGS });
    try {
        for (const [arm, release] of [['LONE', true], ['NONE', false]]) {
            const payload = release
                ? { tapes: windows, releaseKeyCodes: [...new Set(Object.values(KEY_CODES))] }
                : { tapes: windows };
            channel.write(`f2-${arm}.json`, JSON.stringify(payload));
            const said = channel.run(['--url', PAGE_URL, '--tapes', channel.path(`f2-${arm}.json`),
                '--out', channel.path(`f2-${arm}-out.json`), '--deadline-sec', '900'],
            { maxBuffer: 256 * 1024 * 1024 });
            const trace = JSON.parse(channel.read(`f2-${arm}-out.json`));
            const [a, b] = trace.windows;
            const end = a.stream.ticks.at(-1);
            const got1 = b.stream.ticks;
            let firstDiff = null;
            if (got1.length !== want1.ticks.length) firstDiff = `length ${got1.length} vs ${want1.ticks.length}`;
            for (let t = 0; !firstDiff && t < got1.length; t += 1) {
                for (const f of ['t', 'x', 'y', 'level']) {
                    if (got1[t][f] !== want1.ticks[t][f]) { firstDiff = `tick ${t}: ${f} ${got1[t][f]} vs ${want1.ticks[t][f]}`; break; }
                }
            }
            const row = {
                moved_at_boundary: b.moved_at_boundary,
                w0_end: { level: end.level, x: end.x, y: end.y },
                w0_latch_input: a.status.input,
                boundary_before: { level: b.boundary_before.level, x: b.boundary_before.x, y: b.boundary_before.y },
                boundary_after_start: { level: b.boundary_after_start.level, x: b.boundary_after_start.x, y: b.boundary_after_start.y },
                w1_vs_recording: firstDiff ?? 'byte-identical',
                driverSaid: said.split('\n').filter((l) => /^WINDOW|^REPLAY_/.test(l)),
            };
            out.tool[arm] = row;
            console.log(`TOOL ${arm}: moved_at_boundary=${row.moved_at_boundary} w0 end ${JSON.stringify(row.w0_end)} `
                + `before ${JSON.stringify(row.boundary_before)} after-start ${JSON.stringify(row.boundary_after_start)}; `
                + `window 1 vs its recording: ${row.w1_vs_recording}`);
            console.log(`TOOL ${arm}: window 0's latch edge echo ${JSON.stringify(row.w0_latch_input)}`);
        }
    } finally {
        channel.close();
    }

    const moved = (s) => s.from.x !== s.to.x || s.from.y !== s.to.y || s.from.level !== s.to.level;
    const { latch, driftNoRelease: drift, positive: { heldByDomKeydown: held } } = out.game;
    const latchReleased = (latch.input?.released ?? []).includes('up') && !(latch.input?.held ?? []).includes('up');
    const still = drift.every((d) => d.x === drift[0].x && d.y === drift[0].y && d.level === drift[0].level);
    const toolInert = ['LONE', 'NONE'].every((a) => out.tool[a].moved_at_boundary === false
        && out.tool[a].w1_vs_recording === 'byte-identical');
    out.verdict = latchReleased && still && moved(held) && toolInert ? '(i)' : 'not (i)';
    console.log(`VERDICT ${out.verdict}: the bot's own finish-tick KEY_UP releases the held key `
        + `(latch echo released=${latchReleased}), the world runs 2 s with no drift (${still}), a key the runtime `
        + `does see held DOES drift (${moved(held)}), and both tool arms leave the boundary unmoved with window 1 `
        + `byte-identical (${toolInert})`);
    if (JSON_OUT) writeFileSync(JSON_OUT, `${JSON.stringify(out, null, 2)}\n`);
    process.exit(0);
}
