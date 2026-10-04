#!/usr/bin/env node
/**
 * Seedling fidelity F7 (D-A): **L16 RE-ENTERED WITH ITS ROPE PULLED, ASKED OF
 * THE GAME — AND WITHOUT IT.** Every arm runs on a FRESH page of the headless
 * game (default build p4f, logic-only), one arm per page:
 *
 *   WITNESS-REENTRY / WITNESS-WALKIN
 *            `f7-l16-reentry` and `f7-l16-walkin` as committed (the chain-end
 *            staging, `{16,0}` cleared). The game's stream must equal the
 *            committed recording, and no hit may land: `RopeStart.check()`
 *            re-pulls the rope on the first frame and the three `shoot = 1`
 *            traps stay silent. The walk-in is the ORDER arm: its arrival frame
 *            is L16's first update, so a group published one update late would
 *            fire one volley onto the arrival tile.
 *   CONTROL-REENTRY / CONTROL-WALKIN
 *            the same tapes with `{16,0}` REMOVED. The traps fire, so the control
 *            says what the clear changes on the GAME and the recording is not
 *            vacuous: the stream must leave the witness's. ⚠ The model does not
 *            replay a control: an arrow hit shakes the camera, and the model
 *            refuses a bob whose on-screen test lands inside the shake band
 *            (`camera.js`, "THE SHAKE, AND WHY IT IS A BAND"), so a control is
 *            compared with the witness and with the model's refusal, not with a
 *            model stream.
 *
 * `--record=<path>` writes the readings as JSON.
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9190 node scripts/procgen/probe-seedling-f7-reentry.mjs [--record=<path>]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** Each witness, and the clear its control removes. */
export const F7_ARMS = Object.freeze([
    Object.freeze({ arm: 'REENTRY', tape: 'f7-l16-reentry', drop: { level: 16, tag: 0 } }),
    Object.freeze({ arm: 'WALKIN', tape: 'f7-l16-walkin', drop: { level: 16, tag: 0 } }),
]);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-f7-reentry.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape, parseTape } = await M('tapeFormat.js');
    const { loadTape, loadExpectation } = await M('fixtures/index.js');
    const { runTape } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');

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
    async function arm(tape) {
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

    const oracle = { source: 'probe-seedling-f7-reentry.mjs --record (seedling fidelity F7)', build: PAGE_NAME, arms: [] };
    try {
        for (const c of F7_ARMS) {
            const witness = parseTape(loadTape(c.tape));
            check(`${c.tape} declares {${c.drop.level},${c.drop.tag}}`,
                witness.persistence.some((p) => p.level === c.drop.level && p.tag === c.drop.tag));
            const recorded = loadExpectation(c.tape).stream?.ticks ?? loadExpectation(c.tape).ticks;
            const model = runTape(witness, { levelSource }).ticks;

            const game = await arm(witness);
            const vsRecorded = worstOf(game.ticks, recorded);
            const vsModel = worstOf(game.ticks, model);
            oracle.arms.push({
                arm: `WITNESS-${c.arm}`, tape: c.tape, observations: game.ticks.length,
                last: game.ticks.at(-1), vsRecorded, vsModel, hits: hitsOf(game.status), error: game.status.error || '',
            });
            check(`WITNESS-${c.arm}: the game walks the committed recording (${game.ticks.length} observations)`,
                vsRecorded.worst === 0 && game.ticks.length === recorded.length && !game.status.error,
                `worst ${vsRecorded.worst}, ${vsRecorded.n} rows`);
            check(`WITNESS-${c.arm}: the game's stream is the model's`,
                vsModel.worst === 0 && game.ticks.length === model.length, `worst ${vsModel.worst}`);

            const control = parseTape({
                ...witness, name: `${c.tape}-control`,
                persistence: witness.persistence.filter((p) => !(p.level === c.drop.level && p.tag === c.drop.tag)),
            });
            const cg = await arm(control);
            const vsWitness = worstOf(cg.ticks, game.ticks);
            let modelControl = '';
            try { runTape(control, { levelSource }); modelControl = 'replays'; } catch (e) { modelControl = e.message.slice(0, 160); }
            oracle.arms.push({
                arm: `CONTROL-${c.arm}`, tape: c.tape, dropped: c.drop, observations: cg.ticks.length,
                last: cg.ticks.at(-1), vsWitness, hits: hitsOf(cg.status), modelControl, error: cg.status.error || '',
            });
            check(`CONTROL-${c.arm}: without {16,0} the traps fire and the game's stream LEAVES the witness's`,
                vsWitness.worst > 0 && !cg.status.error,
                `worst ${vsWitness.worst}, first differing row ${vsWitness.first}`);
        }
    } finally {
        await browser.close();
    }
    if (RECORD) {
        writeFileSync(RECORD, `${JSON.stringify(oracle, null, 2)}\n`);
        console.log(`RECORDED: ${RECORD}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}
