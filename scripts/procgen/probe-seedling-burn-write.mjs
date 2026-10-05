#!/usr/bin/env node
/**
 * Seedling fidelity BURN, D1: **WHEN THE BURN'S PERSISTENCE WRITE LANDS, ON THE
 * GAME.** `BurnableTree.hit()` removes nothing; `burnEnd -> die()` removes the
 * tree twenty animation frames later, and `removed()` calls
 * `Game.setPersistence(tag, false)` (`Scenery/BurnableTree.as:39-54`). The model
 * banks the clear at the press and stamps the burn with `goneAt` (the update
 * `die()` runs in, `burnableTree.HIT_TO_GONE_TICKS` after the press).
 *
 * Each witness the solver authored (`plan-seedling-burn-witness.mjs`) is cut
 * and played on the headless game (default build p4f, logic-only), one arm per
 * fresh page, declared `hold` so exactly that many world updates run:
 *
 *   BEFORE   the tape cut at the model's `goneAt` ticks: the game's
 *            `persistence_cleared` must NOT hold the tree's `{level, tag}`;
 *   WRITE    the tape cut at `goneAt + 1` ticks: it must.
 *
 * The two arms are the bracket that puts the write on the predicted update —
 * the same bracket F2 took for the apitem (`takenAt + 1`).
 *
 * `--record=<path>` writes the readings (`fixtures/burn-write-oracle.json`,
 * which `fidelityBurn.test.js` holds the model to).
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9220 node scripts/procgen/probe-seedling-burn-write.mjs [--record=<path>]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The witnesses whose burn this probe brackets. */
export const BURN_WRITE_TAPES = Object.freeze(['burn-l24-reach-exit', 'burn-l44-reach-exit']);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-burn-write.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
    const M = (p) => import(join(MODULE, p));
    const { parseTape, holdingWindowTape, gameVisibleTape } = await M('tapeFormat.js');
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

    /** The witness cut to its first `n` ticks: inputs clipped, later equips dropped. */
    const cut = (raw, n) => gameVisibleTape(holdingWindowTape(parseTape({
        ...raw,
        name: `${raw.name}-cut-${n}`,
        tick_count: n,
        inputs: raw.inputs.filter((i) => i.from < n).map((i) => ({ ...i, to: Math.min(i.to, n) })),
        equips: raw.equips.filter((e) => e.t < n),
    })));

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let proved = false;
    const call = (page, name, arg) => page.evaluate(([n, a]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return a === undefined ? g[n]() : g[n](a);
    }, [name, arg]);
    const json = async (page, name, arg) => JSON.parse(await call(page, name, arg));
    async function waitFor(page, what, fn, ms = 180000) {
        const t0 = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(200);
        }
    }
    /** One arm: a fresh page, one tape played to its latch. */
    async function arm(tape) {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const loaded = await call(page, 'botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart: ${started}`);
            return await waitFor(page, 'the latch', async () => {
                const st = await json(page, 'botStatus');
                return st.finished ? st : null;
            });
        } finally {
            await page.close();
        }
    }

    const oracle = { source: 'probe-seedling-burn-write.mjs --record (seedling fidelity BURN)', build: PAGE_NAME, tapes: [] };
    try {
        for (const name of BURN_WRITE_TAPES) {
            const raw = JSON.parse(readFileSync(join(MODULE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
            const model = runTape(parseTape(raw), { levelSource: atlasLevelSource() });
            const [burn] = model.treeBurns ?? [];
            if (!burn) throw new Error(`${name}: the model's replay carries no \`treeBurns\` row`);
            const { level, tag } = burn.flag;
            const slot = `${level}:${tag}`;
            const cleared = (st) => (st.persistence_cleared ?? []).some((r) => `${r.level}:${r.tag}` === slot);
            const before = await arm(cut(raw, burn.goneAt));
            const write = await arm(cut(raw, burn.goneAt + 1));
            const row = {
                tape: name, tree: burn.id, level, tag, burnedAt: burn.t, goneAt: burn.goneAt,
                before: { ticks: burn.goneAt, cleared: cleared(before), error: before.error || '' },
                write: { ticks: burn.goneAt + 1, cleared: cleared(write), error: write.error || '' },
            };
            oracle.tapes.push(row);
            check(`${name}: BEFORE — ${row.before.ticks} ticks do NOT clear {${slot}} (${burn.id}, first hit t${burn.t})`,
                !row.before.cleared && !row.before.error, JSON.stringify(row.before));
            check(`${name}: WRITE — ${row.write.ticks} ticks clear {${slot}} (the model's goneAt ${burn.goneAt} + 1)`,
                row.write.cleared && !row.write.error, JSON.stringify(row.write));
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
