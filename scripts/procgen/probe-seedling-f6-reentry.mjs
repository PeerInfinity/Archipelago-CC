#!/usr/bin/env node
/**
 * Seedling fidelity F6: **THE THREE RE-ENTRY CLEARS, ASKED OF THE GAME.** Every
 * arm runs on a FRESH page of the headless game (default build p4e,
 * logic-only), one arm per page:
 *
 *   MOONROCK-BEFORE / MOONROCK-TAKE   (I02: what writes `{2,0}` in window 23→24)
 *            `r9-solve-0-v3` — window 23, the L0 visit whose first frame beams the
 *            moonrock — cut at 1 and 2 ticks, declared `hold`. The model writes
 *            `{2,0}` on t2 (`moonrock.events` `stairs-replaced`, after the 451
 *            dead frames of the beam and the fall): the game's
 *            `persistence_cleared` must hold it at 2 and not at 1.
 *   CONTROL-L17 / CONTROL-L2 / CONTROL-L20
 *            each `f6-*-reentry` witness with its row's clear REMOVED from the
 *            staging (`{17,29}`, `{2,0}`, `{20,4}`). The control says what the
 *            clear changes on the GAME, so the committed recording is not
 *            vacuous: L17 must walk byte-identically (the slot is inert), L2 must
 *            leave for L0 by the stairs the pile covers, and L20 must stay shut
 *            in front of `lock@32,80`. Each control's stream is compared with the
 *            model's own replay of the same control tape (0 px is the claim).
 *
 * `--record=<path>` writes the readings as JSON.
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9180 node scripts/procgen/probe-seedling-f6-reentry.mjs [--record=<path>]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** Each witness and the clear its control removes. */
export const F6_CONTROLS = Object.freeze([
    Object.freeze({ arm: 'CONTROL-L17', tape: 'f6-l17-reentry', drop: { level: 17, tag: 29 } }),
    Object.freeze({ arm: 'CONTROL-L2', tape: 'f6-l2-reentry', drop: { level: 2, tag: 0 } }),
    Object.freeze({ arm: 'CONTROL-L20', tape: 'f6-l20-reentry', drop: { level: 20, tag: 4 } }),
]);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-f6-reentry.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape, holdingWindowTape, parseTape } = await M('tapeFormat.js');
    const { loadTape, loadExpectation } = await M('fixtures/index.js');
    const { runTape } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4e';
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
    const holds = (st, slot) => (st.persistence_cleared ?? []).some((r) => `${r.level}:${r.tag}` === slot);
    /** The tape cut to its first `n` ticks. */
    const cut = (tape, n, name) => holdingWindowTape(parseTape({
        ...tape, name, tick_count: n,
        inputs: tape.inputs.filter((i) => i.from < n).map((i) => ({ ...i, to: Math.min(i.to, n) })),
    }));
    /** Worst |dx|,|dy| between two streams (Infinity on a level mismatch), and the rows compared. */
    const worstOf = (a, b) => {
        let worst = 0;
        const n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i += 1) {
            if (a[i].level !== b[i].level) return { worst: Infinity, n, at: i };
            worst = Math.max(worst, Math.abs(a[i].x - b[i].x), Math.abs(a[i].y - b[i].y));
        }
        return { worst, n, at: -1 };
    };

    const oracle = { source: 'probe-seedling-f6-reentry.mjs --record (seedling fidelity F6)', build: PAGE_NAME, arms: [] };
    try {
        // ── I02: what writes {2,0} in window 23 → 24 ─────────────────────────
        const w23 = parseTape(loadTape('r9-solve-0-v3'));
        check('window 23 (`r9-solve-0-v3`) does not declare {2,0}', !holds({ persistence_cleared: w23.persistence }, '2:0'));
        const before = await arm(cut(w23, 1, 'f6-moonrock-1'));
        const take = await arm(cut(w23, 2, 'f6-moonrock-2'));
        oracle.arms.push({ arm: 'MOONROCK-BEFORE', ticks: 1, cleared20: holds(before.status, '2:0'), error: before.status.error || '' });
        oracle.arms.push({ arm: 'MOONROCK-TAKE', ticks: 2, cleared20: holds(take.status, '2:0'), error: take.status.error || '' });
        check('MOONROCK-BEFORE — 1 tick of window 23 does NOT clear {2,0}', !holds(before.status, '2:0') && !before.status.error,
            JSON.stringify(oracle.arms.at(-2)));
        check('MOONROCK-TAKE — 2 ticks of window 23 clear {2,0} (the set rock\'s stairs write, on the model\'s t2)',
            holds(take.status, '2:0') && !take.status.error, JSON.stringify(oracle.arms.at(-1)));

        // ── the controls: each witness with its clear removed ───────────────
        for (const c of F6_CONTROLS) {
            const witness = parseTape(loadTape(c.tape));
            const control = parseTape({
                ...witness, name: `${c.tape}-control`,
                persistence: witness.persistence.filter((p) => !(p.level === c.drop.level && p.tag === c.drop.tag)),
            });
            const game = await arm(control);
            const model = runTape(control, { levelSource }).ticks;
            const recorded = loadExpectation(c.tape).stream?.ticks ?? loadExpectation(c.tape).ticks;
            const vsModel = worstOf(game.ticks, model);
            const vsWitness = worstOf(game.ticks, recorded);
            const last = game.ticks.at(-1);
            oracle.arms.push({
                arm: c.arm, tape: c.tape, dropped: c.drop, observations: game.ticks.length,
                last, vsModel, vsWitness, error: game.status.error || '',
            });
            check(`${c.arm}: the game's control stream is the model's (${game.ticks.length} observations)`,
                vsModel.worst === 0 && game.ticks.length === model.length && !game.status.error,
                `worst ${vsModel.worst}, ${vsModel.n} rows`);
            if (c.arm === 'CONTROL-L17') {
                check('CONTROL-L17: without {17,29} the game walks the witness byte-for-byte (the slot is inert)',
                    vsWitness.worst === 0 && game.ticks.length === recorded.length, `worst ${vsWitness.worst}`);
            } else if (c.arm === 'CONTROL-L2') {
                check('CONTROL-L2: without {2,0} the game leaves L2 for L0 by the stairs the pile covers',
                    last.level === 0 && vsWitness.worst === Infinity, `ends in L${last.level} at (${last.x}, ${last.y})`);
            } else {
                const stuck = game.ticks.slice(-40).every((o) => o.level === 20 && o.y === game.ticks.at(-1).y);
                check('CONTROL-L20: without {20,4} the game never opens lock@32,80 (the walk ends shut in the pocket)',
                    stuck && last.y < 80 && vsWitness.worst > 0, `ends at (${last.x}, ${last.y})`);
            }
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
