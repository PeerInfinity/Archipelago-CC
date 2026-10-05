#!/usr/bin/env node
/**
 * Seedling fidelity STEP-OFF (D1/D2/D3): **AN ARRIVAL ON A DOOR, ASKED OF THE
 * GAME.** Every arm runs on a FRESH page of the headless game (default build
 * p4f, logic-only), one arm per page. The arms are `fidelityStepOff.js`'s, so
 * the node rows replay the very tapes the game played:
 *
 *   <door>-STAND  boot ON the door and stand 60 ticks. The game must not cross:
 *                 `Teleporter.check()` latched the door on the first frame.
 *   <door>-SHORT  hold away `nMin - 1` ticks, then back 40: the box never
 *                 leaves the door's rect on the way out, so the way back does
 *                 not fire either (no crossing).
 *   <door>-MIN    hold away `nMin` ticks, then back 40: one update off the
 *                 rect clears `playerTouching`, and the way back FIRES — on the
 *                 tick the model names.
 *   SOLVER-<door> (D3) the solver's own `reach-exit` plan from the arrival:
 *                 its step-off, then the crossing.
 *
 * Every arm's game stream is compared with the model's (`runTape`) row for
 * row, positions exact; transitions are derived from the game's tick stream.
 *
 * `--record=<path>` writes the readings (and every game stream, compact) as JSON.
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9230 node scripts/procgen/probe-seedling-stepoff.mjs [--record=<path>]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-stepoff.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape, deriveTransitions } = await M('tapeFormat.js');
    const { runTape } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { stepOffArms, stepOffSolverArms, compactTicks } = await M('fidelityStepOff.js');

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const RECORD = process.argv.find((a) => a.startsWith('--record='))?.slice('--record='.length) ?? '';
    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const levelSource = atlasLevelSource();

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let proved = false;
    const call = (page, name, arg) => page.evaluate(([n, a]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return a === undefined ? g[n]() : g[n](a);
    }, [name, arg]);
    const json = async (page, name, arg) => JSON.parse(await call(page, name, arg));
    async function waitFor(page, what, fn, ms = 300000) {
        const t0 = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(200);
        }
    }
    /** One arm: a fresh page, one tape played to its latch; the drained stream and the status. */
    async function play(tape) {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart: ${started}`);
            const ticks = [];
            const status = await waitFor(page, 'the latch', async () => {
                ticks.push(...(await json(page, 'botDrain')).ticks);
                const st = await json(page, 'botStatus');
                return st.finished ? st : null;
            });
            ticks.push(...(await json(page, 'botDrain')).ticks);
            return { status, ticks };
        } finally {
            await page.close();
        }
    }
    /** Worst |dx|,|dy| between two streams (Infinity on a level mismatch), and the first differing row. */
    const worstOf = (a, b) => {
        let worst = 0;
        let first = -1;
        const n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i += 1) {
            if (a[i].level !== b[i].level) return { worst: Infinity, n, first: first < 0 ? i : first };
            const d = Math.max(Math.abs(a[i].x - b[i].x), Math.abs(a[i].y - b[i].y));
            if (d > 0 && first < 0) first = i;
            worst = Math.max(worst, d);
        }
        return { worst, n, first };
    };
    const hitsOf = (st) => st.hits ?? st.player?.hits ?? null;

    const oracle = { source: 'probe-seedling-stepoff.mjs --record (seedling fidelity STEP-OFF)', build: PAGE_NAME, arms: [] };
    try {
        for (const a of [...stepOffArms(), ...stepOffSolverArms()]) {
            const model = runTape(a.tape, { levelSource });
            const game = await play(a.tape);
            const gameTransitions = deriveTransitions(game.ticks);
            const vs = worstOf(game.ticks, model.ticks);
            oracle.arms.push({
                arm: a.arm, door: a.door.door, n: a.n ?? null, observations: game.ticks.length,
                transitions: gameTransitions, modelTransitions: model.transitions,
                vsModel: vs, hits: hitsOf(game.status), error: game.status.error || '',
                ticks: compactTicks(game.ticks),
            });
            const label = `${a.arm}: game ${JSON.stringify(gameTransitions.map((t) => [t.t, t.to_level]))}`;
            check(`${label} = model ${JSON.stringify(model.transitions.map((t) => [t.t, t.to_level]))}`,
                JSON.stringify(gameTransitions) === JSON.stringify(model.transitions) && !game.status.error);
            check(`${a.arm}: the game's stream is the model's (${game.ticks.length} observations)`,
                vs.worst === 0 && game.ticks.length === model.ticks.length, `worst ${vs.worst}, first ${vs.first}`);
            if (a.expect) {
                check(`${a.arm}: ${a.expect.why}`, a.expect.crosses === (gameTransitions.length > 0),
                    `${gameTransitions.length} transition(s)`);
            }
        }
    } finally {
        await browser.close();
    }
    if (RECORD) {
        writeFileSync(RECORD, `${JSON.stringify(oracle)}\n`);
        console.log(`RECORDED: ${RECORD}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}
