#!/usr/bin/env node
/**
 * Seedling fidelity CLEARTAG (D1/D2): **A SAVED OBSTACLE BROKEN FROM ITS OPEN
 * SIDE, ASKED OF THE GAME.** Every arm runs on a FRESH page of the headless
 * game (default build p4f, logic-only), one arm per page. The arms are
 * `fidelityClearTag.js`'s — the solver's own `clear-tag` plan as a tape, booted
 * at a GAME landing on the obstacle's open side with the event's item — so the
 * node rows replay the very tapes the game played:
 *
 *   <witness>-solve       the whole solve: the game's stream is the model's,
 *                         0 px, and its `persistence_cleared` holds the flag
 *   <witness>-cut-<T>     ended before the model's write tick T (`modelWriteTick`):
 *                         the game's array does NOT hold it
 *   <witness>-cut-<T+1>   the write's update ran: the game's array holds it
 *
 * Every arm is played DECLARED `hold` (`holdingWindowTape`, `probe-seedling-burn-write.mjs`'s
 * bracket): exactly `tick_count` world updates run before the status is read.
 *
 * Prints `PASS:`/`FAIL:` rows, then `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * `--record=<path>` writes the readings (and every game stream, compact) as JSON.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9470 node scripts/procgen/probe-seedling-cleartag.mjs [--record=<path>] [--only=<substring>]
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
    takeBoxLockOrExit({ name: 'probe-seedling-cleartag.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape, deriveTransitions, holdingWindowTape } = await M('tapeFormat.js');
    const { runTape } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { clearTagArms, modelWrote } = await M('fidelityClearTag.js');
    const { compactTicks } = await M('fidelityStepOff.js');

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const RECORD = process.argv.find((a) => a.startsWith('--record='))?.slice('--record='.length) ?? '';
    const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length) ?? '';
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
            // ⛔ Declared `hold` (BURN's write bracket): exactly `tick_count` world updates run before the reading.
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(holdingWindowTape(tape))));
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

    /**
     * `--scan=<witness>:<lo>-<hi>` — the game's own write tick, by bisection over
     * held cuts of that witness's tape (idle-padded past the solve): the fewest
     * ticks whose `persistence_cleared` holds the flag. `lo` must not hold it and
     * `hi` must (both are played and checked).
     */
    const SCAN = process.argv.find((a) => a.startsWith('--scan='))?.slice('--scan='.length) ?? '';
    if (SCAN) {
        const { CLEARTAG_WITNESSES, clearTagSolve } = await M('fidelityClearTag.js');
        const [key, range] = SCAN.split(':');
        let [lo, hi] = range.split('-').map(Number);
        const w = CLEARTAG_WITNESSES.find((x) => x.key === key);
        const s = clearTagSolve(w, levelSource);
        const { level, tag } = w.goal.tag;
        const holds = async (n) => (await play(s.tapeOf(n, `-scan-${n}`))).status.persistence_cleared
            .some((c) => c.level === level && c.tag === tag);
        try {
            check(`scan ${key}: ${lo} ticks do NOT hold {${level},${tag}}`, !(await holds(lo)));
            check(`scan ${key}: ${hi} ticks hold {${level},${tag}}`, await holds(hi));
            while (hi - lo > 1) {
                const mid = Math.floor((lo + hi) / 2);
                if (await holds(mid)) hi = mid; else lo = mid;
                console.log(`  scan ${key}: [${lo}, ${hi}]`);
            }
        } finally {
            await browser.close();
        }
        console.log(`SCAN ${key}: the game's persistence_cleared first holds {${level},${tag}} after ${hi} ticks (solve ${s.out.perTick.length} t, the ledger row's t${s.record.ledgerAt}, confirmed by the executor at ${s.record.confirmedAt})`);
        console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
        process.exit(failed ? 1 : 0);
    }

    const oracle = { source: 'probe-seedling-cleartag.mjs --record (seedling fidelity CLEARTAG)', build: PAGE_NAME, arms: [] };
    try {
        for (const a of clearTagArms(levelSource).filter((x) => !ONLY || x.arm.includes(ONLY))) {
            const { level, tag } = a.w.goal.tag;
            const model = runTape(a.tape, { levelSource });
            const game = await play(a.tape);
            const gameTransitions = deriveTransitions(game.ticks);
            const vs = worstOf(game.ticks, model.ticks);
            const gameFlag = (game.status.persistence_cleared ?? []).some((c) => c.level === level && c.tag === tag);
            const modelFlag = modelWrote(a.tape, { level, tag }, levelSource);
            oracle.arms.push({
                arm: a.arm, witness: a.w.key, verb: a.w.verb, tick_count: a.tape.tick_count, n: a.n,
                flag: { level, tag }, gameFlag, modelFlag, observations: game.ticks.length,
                transitions: gameTransitions, vsModel: vs, error: game.status.error || '',
                persistenceCleared: game.status.persistence_cleared ?? null,
                ticks: compactTicks(game.ticks),
            });
            console.log(`${a.arm}: ${a.tape.tick_count} t, game flag {${level},${tag}} ${gameFlag ? 'SET-CLEARED' : 'held'}, `
                + `model ${modelFlag ? 'cleared' : 'held'}, worst ${vs.worst} px${game.status.error ? `, error ${game.status.error}` : ''}`);
            check(`${a.arm}: the game's stream is the model's (${game.ticks.length} observations)`,
                vs.worst === 0 && game.ticks.length === model.ticks.length && !game.status.error,
                `worst ${vs.worst}, first ${vs.first}`);
            check(`${a.arm}: game transitions = model transitions`,
                JSON.stringify(gameTransitions) === JSON.stringify(model.transitions));
            check(`${a.arm}: the game's persistence_cleared ${a.flagExpected ? 'holds' : 'does NOT yet hold'} {${level},${tag}}`,
                gameFlag === a.flagExpected);
            check(`${a.arm}: the model agrees (its write tick ${a.flagExpected ? 'completed' : 'not yet run'})`,
                modelFlag === a.flagExpected);
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
