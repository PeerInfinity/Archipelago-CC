#!/usr/bin/env node
/**
 * THE SINCE-BEGIN RECORD, MEASURED ON THE GAME (seedling-wasm-leak L4 item 4c,
 * ⚖ D3 capability `sincebegin`) — the acceptance witness for
 * `botSeam().sinceBegin = {stepped, dead, input_frames, pressed, held_at_begin,
 * rng_first}`, which p4f added so a host can adopt a room it did not start.
 *
 * What it proves, each against an INDEPENDENT reading rather than against itself:
 *
 *   1. FRAMES SINCE BEGIN. `Game.time` advances exactly once per `Game.update`
 *      (live, frozen, ceremony and fade alike), and `beginEntry["save.time"]`
 *      is latched by the same `latchBeginEntry` that resets the record — so
 *      `stepped + dead` must equal `game_time − save.time` (+ a fixed offset
 *      this probe MEASURES and pins), read in ONE JS turn so no frame lands
 *      between the two readouts.
 *   2. THE DEAD FRAMES ARE THE LOAD FADE. Under `pins: ["dead_frames"]` a room
 *      load costs exactly `gameClock.LOAD_FADE_FRAMES` (20); `sinceBegin.dead`
 *      must equal it and `botStatus.dead_frames` both.
 *   3. INPUT. A scripted tape (the bot's own `dispatchKey` counts by intent):
 *      `pressed` must equal the tape's press count per key, and `input_frames`
 *      the frames on which any key was held, pressed or released.
 *   4. `held_at_begin`. A REAL key held down (Playwright, on the canvas) across a
 *      `botStart` into a new world must appear in the next world's record.
 *   5. `rng_first`. Under `rng.split` with a declared seed, the first counted
 *      frame reads the post-build gameplay stream: the seed advanced by the
 *      room's gameplay build draws (R4 D1's census: L3 = 0, L1 = 0).
 *   6. THE RESET IS AT THE PENDING WORLD'S LATCH. A second tape that boots a
 *      different room starts a NEW record (its `beginEntry.level`, its own fade),
 *      not a continuation of the first world's.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and a
 * build declaring `sincebegin` (`SEEDLING_PAGE`, default the pinned default).
 * Run: SEEDLING_PORT=8150 node scripts/procgen/probe-seedling-since-begin.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The scripted presses of arm 3: `[key, from, to)` spans, one press each. */
export const SCRIPTED_INPUTS = Object.freeze([
    Object.freeze({ key: 'right', from: 5, to: 8 }),
    Object.freeze({ key: 'left', from: 15, to: 17 }),
    Object.freeze({ key: 'right', from: 25, to: 26 }),
]);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-since-begin.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const { step } = await import(join(REPO, 'frontend/modules/seedlingDemo/rng.js'));
    const { LOAD_FADE_FRAMES } = await import(join(REPO, 'frontend/modules/seedlingDemo/gameClock.js'));

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const advance = (seed, n) => { let u = seed >>> 0; for (let i = 0; i < n; i += 1) u = step(u); return u; };

    const SEED = 123456789;
    const tape = (name, boot, inputs, tickCount) => ({
        tape_version: 7, game: 'seedling', name, description: 'probe-seedling-since-begin arm',
        boot, noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [], equips: [],
        pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: SEED, split: true, cosmetic: 0, fp: 0 }, tick_count: tickCount, inputs,
    });
    // L3 = Dungeon1_1 and L1 = the start house: both build with NO gameplay draw
    // under the split (R4 D1's census, S = 0), so `rng_first` must be the seed itself.
    const L3 = { level: 3, x: 112, y: 48 };
    const L1 = { level: 1, x: 64, y: 96 };

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const page = await browser.newPage();
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 600 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) {
            await page.waitForTimeout(200);
        }
        await page.click('#btn-start');
        for (let i = 0; i < 600 && !(await page.evaluate(() => !!window.__swfBridge?.game?.botSeam)); i += 1) {
            await page.waitForTimeout(200);
        }
        await assertLogicOnlyChannel(page);
        await page.waitForTimeout(2000);

        /** Load + start + play to the finish; then status AND seam in ONE turn. */
        async function play(t) {
            const r = await page.evaluate((tt) => {
                const g = window.__swfBridge.game;
                const l = g.botLoadTape(JSON.stringify(tt));
                return l === 'ok' ? g.botStart() : `load ${l}`;
            }, t);
            if (r !== 'ok') throw new Error(`${t.name}: ${r}`);
            for (let i = 0; i < 1200; i += 1) {
                const done = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()).finished);
                if (done) break;
                await page.waitForTimeout(50);
            }
            return page.evaluate(() => {
                const g = window.__swfBridge.game;
                return { st: JSON.parse(g.botStatus()), seam: JSON.parse(g.botSeam()) };
            });
        }
        const sinceOf = ({ st, seam }) => {
            const sb = seam.sinceBegin;
            const be = seam.beginEntry ?? {};
            return {
                sb, be, sum: sb.stepped + sb.dead,
                clock: st.game_time - be['save.time'],
            };
        };

        // ── arm 1–3, 5: one scripted tape in L3 ──────────────────────────────
        const a = await play(tape('since-begin-scripted', L3, SCRIPTED_INPUTS.map((s) => ({ ...s })), 40));
        const A = sinceOf(a);
        console.log(`ROW arm1 ${JSON.stringify({ sinceBegin: A.sb, begin: A.be, game_time: a.st.game_time,
            tick: a.st.tick, dead_frames: a.st.dead_frames })}`);
        check('sinceBegin is present (the build declares `sincebegin`)', !!A.sb, PAGE_NAME);
        const offset = A.clock - A.sum;
        check('stepped + dead = the frames since begin, by Game.time (a FIXED offset, measured)',
            offset === 0 || offset === 1,
            `stepped ${A.sb.stepped} + dead ${A.sb.dead} = ${A.sum}; game_time − save.time = ${A.clock}; offset ${offset}`);
        check('the dead frames are exactly ONE load fade', A.sb.dead === LOAD_FADE_FRAMES && a.st.dead_frames === LOAD_FADE_FRAMES,
            `sinceBegin.dead ${A.sb.dead}, botStatus.dead_frames ${a.st.dead_frames}, LOAD_FADE_FRAMES ${LOAD_FADE_FRAMES}`);
        const wantPressed = {};
        for (const s of SCRIPTED_INPUTS) wantPressed[s.key] = (wantPressed[s.key] ?? 0) + 1;
        const gotPressed = A.sb.pressed ?? {};
        check('pressed = the tape\'s press count per key (the bot\'s own dispatchKey counts)',
            Object.keys({ ...wantPressed, ...gotPressed }).every((k) => (gotPressed[k] ?? 0) === (wantPressed[k] ?? 0)),
            `game ${JSON.stringify(gotPressed)}, tape ${JSON.stringify(wantPressed)}`);
        const heldFrames = SCRIPTED_INPUTS.reduce((n, s) => n + (s.to - s.from), 0);
        check('input_frames covers every held frame plus one release edge per span',
            A.sb.input_frames === heldFrames + SCRIPTED_INPUTS.length,
            `game ${A.sb.input_frames}; held ${heldFrames} + releases ${SCRIPTED_INPUTS.length}`);
        check('rng_first is the post-build stream (L3 builds with no gameplay draw: the seed itself)',
            A.sb.rng_first === advance(SEED, 0), `rng_first ${A.sb.rng_first}, seed ${SEED}`);
        check('held_at_begin is empty when nothing was held at the latch', (A.sb.held_at_begin ?? []).length === 0,
            JSON.stringify(A.sb.held_at_begin));

        // ── arm 4 + 6: a REAL key held across a botStart into a NEW world ────
        await page.evaluate(() => window.__swfBridge.game.botReset());
        await page.click('#canvas');
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(500);
        const b = await play(tape('since-begin-held', L1, [], 25));
        await page.keyboard.up('ArrowLeft');
        const B = sinceOf(b);
        console.log(`ROW arm4 ${JSON.stringify({ sinceBegin: B.sb, begin: B.be, game_time: b.st.game_time,
            tick: b.st.tick, dead_frames: b.st.dead_frames })}`);
        check('the record RESET at the new world\'s latch (beginEntry is L1, and one fade, not two)',
            B.be['begin.level'] === 1 && B.sb.dead === LOAD_FADE_FRAMES,
            `begin.level ${B.be['begin.level']}, dead ${B.sb.dead}`);
        check('the frames before the new world\'s latch are counted in NEITHER stepped NOR dead',
            B.clock - B.sum === offset, `offset ${B.clock - B.sum} (arm 1: ${offset})`);
        check('held_at_begin names a key held down across the botStart', (B.sb.held_at_begin ?? []).includes('left'),
            JSON.stringify(B.sb.held_at_begin));
        check('rng_first is the post-build stream in L1 too (no gameplay build draw)', B.sb.rng_first === SEED,
            `rng_first ${B.sb.rng_first}, seed ${SEED}`);
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
