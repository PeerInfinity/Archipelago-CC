#!/usr/bin/env node
/**
 * Seedling fidelity SLOTS, D1: **THE SLOT ARRAY IS SESSION STATE, ON THE GAME.**
 * `Inventory.items` is static (`Inventory.as:51`); `addItemsFromSave`
 * (`:291-332`) only appends what the item flags imply and the array lacks, and
 * its two fusions splice; only `Main.clearSave` / `freshSaveForLevelSet`
 * (`Inventory.clearItems`) empty it, and `Bot.botStart` calls neither. So the
 * order is the order the items ARRIVED, for the whole page.
 *
 * Every arm plays the BURN witness's L24 staging (`burn-l24-reach-exit`, with
 * its own keys and equips dropped) for a few idle ticks and reads
 * `botStatus.inventory_slots` / `primary` at the latch; the MODEL's reading is
 * the same staging through `createRunForStaging`, the multi-window arms staged
 * with the slot array the model held after the window before
 * (`inventory_slots`, the staged field):
 *
 *   FIRE-FIRST   a fresh page, the seam holding Fire only and a grant of the
 *                sword at L24: the dead frames append Fire, the tick-0 grant
 *                appends the sword after it — `[1, 0]`
 *   CANONICAL    a fresh page, the seam holding both: one sync — `[0, 1]`
 *   NO-REBUILD   one page: FIRE-FIRST, then the CANONICAL tape as a second
 *                window — the array stays `[1, 0]` (`botStart` clears nothing)
 *   FUSION       one page: FIRE-FIRST, then the wand (`[1, 0, 2]`, primary 2),
 *                then the fire wand: `removeItem` x2 + `addItem(5, 1)` —
 *                `[0, 5]`, and `Main.primary` taken modulo to 0
 *   PRESS        the SLOTS witness tape (`slots-l24-fire-first`, when present):
 *                its one X press with slot 0 selected burns the tree on the
 *                game (`persistence_cleared` holds `{24, 0}`) and the model
 *
 * `--record=<path>` writes the readings (`fixtures/slot-order-oracle.json`,
 * which `fidelitySlots.test.js` holds the model to).
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9330 node scripts/procgen/probe-seedling-slot-order.mjs [--record=<path>]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The staging every arm plays (its keys and equips dropped). */
export const SLOT_ORDER_BASE_TAPE = 'burn-l24-reach-exit';
/** Idle ticks per window: the dead frames and tick 0's grant have run by then. */
export const SLOT_ORDER_IDLE_TICKS = 4;

/**
 * The arms, as data: each is a list of WINDOWS played on ONE page, each window
 * a seam-items override (+ grants, + primary) over the base staging.
 */
export const SLOT_ORDER_ARMS = Object.freeze([
    { name: 'FIRE-FIRST', windows: [{ items: { hasSword: false, hasFire: true }, grants: [{ level: 24, items: ['sword'] }] }] },
    { name: 'CANONICAL', windows: [{ items: { hasSword: true, hasFire: true }, grants: [] }] },
    { name: 'NO-REBUILD', windows: [
        { items: { hasSword: false, hasFire: true }, grants: [{ level: 24, items: ['sword'] }] },
        { items: { hasSword: true, hasFire: true }, grants: [] },
    ] },
    { name: 'FUSION', windows: [
        { items: { hasSword: false, hasFire: true }, grants: [{ level: 24, items: ['sword'] }] },
        { items: { hasSword: true, hasFire: true, hasWand: true }, grants: [], primary: 2 },
        { items: { hasSword: true, hasFire: true, hasWand: true, hasFireWand: true }, grants: [], primary: 2 },
    ] },
]);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-slot-order.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
    const M = (p) => import(join(MODULE, p));
    const { parseTape, holdingWindowTape, gameVisibleTape } = await M('tapeFormat.js');
    const { createRunForStaging, runTape, stagingFromTape } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const SRC = atlasLevelSource();

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

    const base = JSON.parse(readFileSync(join(MODULE, 'fixtures', 'tapes', `${SLOT_ORDER_BASE_TAPE}.json`), 'utf8'));
    /** One window's tape: the base staging, the window's items/grants/primary, idle. */
    const windowTape = (w, i) => parseTape({
        ...base,
        name: `slot-order-window-${i}`,
        description: 'probe-seedling-slot-order.mjs window',
        seam: { ...base.seam, items: { ...base.seam.items, ...w.items }, primary: w.primary ?? 0 },
        grants: w.grants,
        equips: [],
        inputs: [],
        tick_count: SLOT_ORDER_IDLE_TICKS,
    });

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
    /** Tapes played as windows on ONE fresh page; the status at each latch. */
    async function onePage(tapes) {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const out = [];
            for (const tape of tapes) {
                const loaded = await call(page, 'botLoadTape', JSON.stringify(tape));
                if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
                const started = await call(page, 'botStart');
                if (started !== 'ok') throw new Error(`botStart: ${started}`);
                out.push(await waitFor(page, 'the latch', async () => {
                    const st = await json(page, 'botStatus');
                    return st.finished ? st : null;
                }));
            }
            return out;
        } finally {
            await page.close();
        }
    }

    const oracle = { source: 'probe-seedling-slot-order.mjs --record (seedling fidelity SLOTS)', build: PAGE_NAME,
        base: SLOT_ORDER_BASE_TAPE, idleTicks: SLOT_ORDER_IDLE_TICKS, arms: [] };
    try {
        for (const arm of SLOT_ORDER_ARMS) {
            const tapes = arm.windows.map(windowTape);
            const played = tapes.map((t, i) => gameVisibleTape(i < tapes.length - 1 ? holdingWindowTape(t) : t));
            const game = await onePage(played);
            // The model: each window staged with the slot array the window before ENDED on.
            let staged = null;
            const model = [];
            for (const t of tapes) {
                const staging = { ...stagingFromTape(t), ...(staged ? { inventory_slots: staged } : {}) };
                const run = createRunForStaging(staging, SRC);
                for (let k = 0; k < t.tick_count; k += 1) run.advance(new Set());
                staged = run.inventorySlots;
                model.push({ slots: run.inventorySlots, primary: run.primary });
            }
            const rows = game.map((st, i) => ({
                window: i,
                game: { slots: st.inventory_slots ?? null, primary: st.primary ?? null, error: st.error || '' },
                model: model[i],
            }));
            oracle.arms.push({ name: arm.name, windows: arm.windows, rows });
            for (const r of rows) {
                check(`${arm.name} window ${r.window}: the game's slots ${JSON.stringify(r.game.slots)} primary ${r.game.primary} `
                    + `= the model's ${JSON.stringify(r.model.slots)} primary ${r.model.primary}`,
                JSON.stringify(r.game.slots) === JSON.stringify(r.model.slots) && r.game.primary === r.model.primary && !r.game.error,
                r.game.error);
            }
        }
        // PRESS: the committed witness, when it exists, played whole on a fresh page.
        const witnessPath = join(MODULE, 'fixtures', 'tapes', 'slots-l24-fire-first.json');
        if (existsSync(witnessPath)) {
            const raw = JSON.parse(readFileSync(witnessPath, 'utf8'));
            const t = parseTape(raw);
            const [st] = await onePage([gameVisibleTape(t)]);
            const model = runTape(t, { levelSource: SRC });
            const burned = (st.persistence_cleared ?? []).some((r) => r.level === 24 && r.tag === 0);
            const row = { tape: raw.name, game: { slots: st.inventory_slots, primary: st.primary, level: st.level,
                burned, error: st.error || '' }, model: { level: model.ticks.at(-1)?.level ?? null, burns: (model.treeBurns ?? []).length } };
            oracle.press = row;
            check(`PRESS ${raw.name}: the game burns {24,0} with slot 0 selected (Fire, the array ${JSON.stringify(st.inventory_slots)}) `
                + 'and crosses to L12, and so does the model', burned && st.level === 12 && row.model.burns === 1
                && row.model.level === 12 && !row.game.error, JSON.stringify(row));
        } else {
            console.log('NOTE: no slots-l24-fire-first tape yet — the PRESS arm is skipped');
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
