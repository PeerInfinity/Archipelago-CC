#!/usr/bin/env node
/**
 * Seedling fidelity ARRIVAL (D1/D2): **A LANDING INSIDE A SOLID, ASKED OF THE
 * GAME.** Every arm runs on a FRESH page of the headless game (default build
 * p4f, logic-only), one arm per page. The arms are `fidelityArrival.js`'s, so
 * the node rows replay the very tapes the game played. Each boots at a GAME
 * landing (a door's `playerx/playery`) whose box overlaps a solid a saved flag
 * removes, with that flag HELD (the obstacle never broken: the out-of-order
 * arrival) or CLEARED (the save says it is broken / burned / opened):
 *
 *   <landing>-<HELD|CLEARED>-stand        stand 30 ticks
 *   <landing>-<HELD|CLEARED>-<dir>        hold one cardinal 30 ticks
 *   <landing>-HELD-press-sword            the Sword, one primary press at tick 0
 *
 * Every arm's game stream is compared with the model's (`runTape`) row for
 * row, positions exact. Prints whether the game moved the player at all (the
 * game's verdict: stuck / can act) and `PASS:`/`FAIL:` rows, then
 * `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. `--record=<path>` writes the
 * readings (and every game stream, compact) as JSON.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9360 node scripts/procgen/probe-seedling-arrival-solid.mjs [--record=<path>] [--only=<substring>]
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
    takeBoxLockOrExit({ name: 'probe-seedling-arrival-solid.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape, deriveTransitions } = await M('tapeFormat.js');
    const { runTape } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { arrivalArms } = await M('fidelityArrival.js');
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
    /** How far the game moved the player from its first observation (0 = it never moved). */
    const travelOf = (ticks) => ticks.reduce((m, o) => Math.max(m, Math.abs(o.x - ticks[0].x),
        Math.abs(o.y - ticks[0].y)), 0);

    const oracle = { source: 'probe-seedling-arrival-solid.mjs --record (seedling fidelity ARRIVAL)', build: PAGE_NAME, arms: [] };
    try {
        for (const a of arrivalArms().filter((x) => !ONLY || x.arm.includes(ONLY))) {
            const model = runTape(a.tape, { levelSource });
            const game = await play(a.tape);
            const gameTransitions = deriveTransitions(game.ticks);
            const vs = worstOf(game.ticks, model.ticks);
            const travel = game.ticks.length ? travelOf(game.ticks) : null;
            oracle.arms.push({
                arm: a.arm, landing: a.landing.key, hold: a.hold, cleared: a.cleared, observations: game.ticks.length,
                travel, first: game.ticks[0] ? [game.ticks[0].x, game.ticks[0].y] : null,
                transitions: gameTransitions, modelTransitions: model.transitions,
                vsModel: vs, error: game.status.error || '', persistenceCleared: game.status.persistence_cleared ?? null,
                ticks: compactTicks(game.ticks),
            });
            console.log(`${a.arm}: game travel ${travel} px from (${game.ticks[0]?.x},${game.ticks[0]?.y}), `
                + `${gameTransitions.length} transition(s)${game.status.error ? `, error ${game.status.error}` : ''}`);
            if (a.hold === 'press') {
                // ⚠ The press from INSIDE is a game measurement, not a model claim: the
                // model frees the box two ticks before the game does (residue, the
                // ARRIVAL report). The ruling builds no strategy on it.
                const cleared = (game.status.persistence_cleared ?? [])
                    .some((c) => c.level === a.landing.boot.level && c.tag === a.landing.tag);
                check(`${a.arm}: the game's press from inside breaks the solid (persistence {${a.landing.boot.level},${a.landing.tag}} cleared)`, cleared);
                check(`${a.arm}: and the player then moves (${a.landing.pressThen})`, travel > 0, `travel ${travel}`);
                console.log(`NOTE: ${a.arm}: model vs game worst ${vs.worst} px, first differing observation ${vs.first}`);
            } else {
                check(`${a.arm}: the game's stream is the model's (${game.ticks.length} observations)`,
                    vs.worst === 0 && game.ticks.length === model.ticks.length && !game.status.error,
                    `worst ${vs.worst}, first ${vs.first}`);
                check(`${a.arm}: the game ${a.cleared ? 'MOVES the player (flag cleared: no solid)' : (a.hold === 'stand' ? 'stands' : 'does NOT move the player (flag held: inside the solid)')}`,
                    a.cleared ? (a.hold === 'stand' ? travel === 0 : travel > 0) : travel === 0, `travel ${travel}`);
            }
            check(`${a.arm}: game transitions = model transitions`,
                JSON.stringify(gameTransitions) === JSON.stringify(model.transitions));
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
