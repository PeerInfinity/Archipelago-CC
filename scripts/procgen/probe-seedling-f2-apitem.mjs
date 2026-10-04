#!/usr/bin/env node
/**
 * Seedling fidelity F2, D1b/D1c: **THE APITEM ON THE GAME.** Every generated
 * preset room whose apitem the solver reaches (`collect-placement` resolving
 * an APItem, strategy `apitem`) is mounted on the headless game (default build
 * p4e, logic-only), and the solver's own tape is played on it. Four arms per
 * room, each on a FRESH page (one arm, one page: after an abort the wasm is
 * not to be trusted):
 *
 *   TAKE     the tape cut at `takenAt + 1` ticks, declared `hold` (the world
 *            freezes at the latch, so exactly that many world updates run):
 *            the game's `persistence_cleared` must hold `{level, tag}`.
 *   BEFORE   the same tape cut at `takenAt` ticks: it must NOT. The two arms
 *            are the bracket that puts the take on the predicted tick.
 *   ROOM     a zero-tick `hold` tape booting the room with NO clear: the
 *            roster (`botMobiles`) holds one `Pickups::APItem`, at the
 *            placement + the half tile (the control for the arm below).
 *   CLEARED  the same boot with the apitem's tag CLEARED in the staging
 *            (`PERSISTENCE_RESPONSE.apitem = 'despawn'`): the roster holds
 *            NO APItem. The model builds the same room (`world.apItems` []).
 *
 * The TAKE arm's drained positions are compared with the model's own replay
 * of the same keys (0 px is the claim).
 *
 * `--record=<path>` writes the readings (`fixtures/f2-apitem-oracle.json`,
 * which `fidelityF2.test.js` holds the solver to).
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9120 node scripts/procgen/probe-seedling-f2-apitem.mjs [--record=<path>]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The generated presets the probe walks (the swim room's apitem is refused by the solver, by name). */
export const F2_PRESETS = Object.freeze(['seedling_generated_room', 'seedling_generated_leaf', 'seedling_generated_host']);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-f2-apitem.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { f2ApItemCase } = await M('fidelityF2.js');
    const { shippedTape } = await M('wasmPlayback.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');

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
    /** One arm: a fresh page, the set mounted, one tape played to its latch. */
    async function arm(set, tape, { mobiles = false } = {}) {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const chunks = planLevelSetChunks(set).chunks;
            const answers = [];
            for (const c of chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const loaded = await call(page, 'botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart: ${started}`);
            const status = await waitFor(page, 'the latch', async () => {
                const st = await json(page, 'botStatus');
                return st.finished ? st : null;
            });
            const drained = await json(page, 'botDrain');
            const roster = mobiles ? await json(page, 'botMobiles') : null;
            return { status, drained, roster };
        } finally {
            await page.close();
        }
    }

    const oracle = { source: 'probe-seedling-f2-apitem.mjs --record (seedling fidelity F2)', build: PAGE_NAME, rooms: [] };
    try {
        for (const preset of F2_PRESETS) {
            const c = f2ApItemCase(REPO, preset);
            const { level, tag } = c.apItem;
            const slot = `${level}:${tag}`;
            const cleared = (st) => (st.persistence_cleared ?? []).some((r) => `${r.level}:${r.tag}` === slot);
            const cut = (n) => shippedTape({ staging: c.staging, keys: c.perTick.slice(0, n), hold: true, name: `f2-${preset}-${n}` });
            const take = await arm(c.set, cut(c.takenAt + 1));
            const before = await arm(c.set, cut(c.takenAt));
            const room = await arm(c.set, shippedTape({ staging: c.staging, keys: [], hold: true, name: `f2-${preset}-room` }), { mobiles: true });
            const clearedStaging = { ...c.staging, persistence: [{ level, tag }] };
            const gone = await arm(c.set, shippedTape({ staging: clearedStaging, keys: [], hold: true, name: `f2-${preset}-cleared` }), { mobiles: true });
            const apRows = (r) => (Array.isArray(r) ? r : r?.mobiles ?? []).filter((m) => /APItem/.test(m.cls))
                .map((m) => ({ cls: m.cls, x: m.x, y: m.y }));
            const ticks = take.drained.ticks ?? [];
            const worst = ticks.reduce((w, o, i) => {
                const e = c.expected[i];
                return e ? Math.max(w, Math.abs(o.x - e.x), Math.abs(o.y - e.y), o.level === e.level ? 0 : Infinity) : w;
            }, 0);
            const row = {
                preset, level, tag, apItem: c.apItem.id, takenAt: c.takenAt, solveTicks: c.perTick.length,
                take: { ticks: c.takenAt + 1, cleared: cleared(take.status), error: take.status.error || '' },
                before: { ticks: c.takenAt, cleared: cleared(before.status), error: before.status.error || '' },
                positions: { compared: Math.min(ticks.length, c.expected.length), worst },
                room: { apItems: apRows(room.roster) },
                clearedRoom: { apItems: apRows(gone.roster), persistence_cleared: gone.status.persistence_cleared ?? [] },
            };
            oracle.rooms.push(row);
            check(`${preset}: TAKE — ${c.takenAt + 1} ticks clear {${slot}}`, row.take.cleared && !row.take.error, JSON.stringify(row.take));
            check(`${preset}: BEFORE — ${c.takenAt} ticks do NOT`, !row.before.cleared && !row.before.error, JSON.stringify(row.before));
            check(`${preset}: the TAKE arm's positions are the model's`, worst === 0, `${row.positions.compared} rows, worst ${worst}`);
            check(`${preset}: ROOM — one APItem at the placement + half tile`, row.room.apItems.length === 1
                && row.room.apItems[0].x === c.apItem.x + 8 && row.room.apItems[0].y === c.apItem.y + 8, JSON.stringify(row.room.apItems));
            check(`${preset}: CLEARED — no APItem (despawn)`, row.clearedRoom.apItems.length === 0, JSON.stringify(row.clearedRoom));
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
