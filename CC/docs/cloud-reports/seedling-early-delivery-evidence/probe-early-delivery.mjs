#!/usr/bin/env node
/**
 * seedling-early-delivery — AN ITEM THE SERVER SENDS BEFORE THE PAGE HAS FINISHED LOADING, ON BOTH RUNTIMES.
 *
 * ⚖ Robert 2026-11-18T15:36:30Z: *"Measure both wasm and js. I don't want either to drop items that arrive from the
 * server early."* This probe is that sentence made measurable, on the REAL page: `seedling_playthrough` loaded by
 * `?rules=` into the full frontend, the flash panel mounting the wasm or the JS runtime page, the AP load delivering
 * its level set. The "server" is the AP inventory itself (`stateManagerProxy.addItemToInventory`): the sink the
 * client's `ReceivedItems` handler writes, and the only input the panel adapter reads (`_buildItemWritesFromInventory`).
 * No live AP server exists in the harness.
 *
 * Each WINDOW is a fresh page; the same five items are granted at that point of the load:
 *   Progressive Sword (a SLOT item: `hasSword`), Red Key (a method item: `hasKeySet(0)`), Seal ×1 (a fill-log item:
 *   seal slot 0), Totem Shard ×1 (a fill-set item), Health (an `add` item: `hitsMax` = base + 1 — the TWICE detector).
 *
 *   pre-panel   the rules are loaded, the flash panel has not been opened (no adapter, no game page)
 *   pre-start   the game page is mounted; the wasm game sits on its ▶ Start (J: the page is booting)
 *   in-load     the adapter is attached and the game ready, the AP load (level-set mount) not finished yet
 *   post-load   CONTROL: the new game stands in the start region
 *   teleport    after the load, granted in the same turn as a host `new Game(19, 48, 48)` (a boot in flight)
 *   reload      J only: a first visit writes the room's RE2 save; the page is RELOADED and the items granted
 *               before the panel opens (the save is restored over them at the end of the AP load: `_bindJsSave`)
 *
 * After the load the probe waits (≤ SETTLE_MS) for the game's LIVE state to hold every item, then reads it again:
 *   J: the live run (`__seedlingJsRuntime.run`: `inventory`, `keys`, `saveState`) — what the player has, not a ledger;
 *   W: the game's own readouts (`readState`) and `botStatus.save`.
 * Verdict per item: APPLIED (once) / DROPPED (not held after SETTLE_MS) / TWICE (Health above base+1, more than one
 * seal slot or totem part filled). Also printed: the ms from the load's end to the first moment it was held, and the
 * order of the core's own notes (J: `delivery` vs `mount`) — so "it survived" is told apart from "it came back".
 *
 * Usage: node probe-early-delivery.mjs [--host=http://localhost:8000] [--only=J,W] [--windows=a,b,...]
 * Prints `ROW <S> <window> {json}` and a final table. Exit 0 always (it is a measurement; the verdicts are the output).
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const P = (rel) => join(REPO, 'scripts/procgen', rel);
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(P('headlessChromium.js'));
const { takeBoxLockOrExit } = await import(P('boxLock.js'));
const { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf } = await import(P('seedlingRoomPlay.js'));
const { startWasmGame } = await import(P('seedlingProbeBoot.js'));

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
const SESSIONS = arg('only', 'J,W').split(',').filter(Boolean);
const ALL_WINDOWS = ['pre-panel', 'pre-start', 'in-load', 'post-load', 'teleport', 'reload'];
const WINDOWS = arg('windows', ALL_WINDOWS.join(',')).split(',').filter(Boolean);
const SETTLE_MS = Number(arg('settle-ms', '20000'));
const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
const JS_PAGE = 'jsRuntime.html';

const CFG = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
const START = PRESET.regions['1'].Menu.exits[0].connected_region;
const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
const HEALTH = CFG.items.find((d) => d.flash_name === 'health');
const HITS_BASE = HEALTH.base ?? 0;
const HITS_WANT = HITS_BASE + (HEALTH.value ?? 1);
const GRANTS = ['Progressive Sword', 'Red Key', 'Seal', 'Totem Shard', 'Health'];

takeBoxLockOrExit({ name: 'probe-early-delivery.mjs', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const table = [];

for (const S of SESSIONS) {
    if (S === 'W' && !haveWasm) { console.log(`SKIP: W — wasm build not staged (${WASM_PAGE})`); continue; }
    for (const W of WINDOWS) {
        if (W === 'reload' && S !== 'J') { console.log(`SKIP: ${S} ${W} — the RE2 save is the JS page's (the wasm game keeps no host save)`); continue; }
        let out;
        try {
            // eslint-disable-next-line no-await-in-loop
            out = await runWindow(S, W);
        } catch (e) {
            out = { error: String(e?.message ?? e).slice(0, 300) };
        }
        console.log(`ROW ${S} ${W} ${JSON.stringify(out)}`);
        table.push({ S, W, ...out });
    }
}
await browser.close();

console.log('\nTABLE (runtime | window | sword | key | seal | totem | health)');
for (const r of table) {
    if (r.error) { console.log(`${r.S} | ${r.W} | ERROR ${r.error}`); continue; }
    const v = r.verdict;
    console.log(`${r.S} | ${r.W} | ${v.sword} | ${v.key} | ${v.seal} | ${v.totem} | ${v.health}`);
}
process.exit(0);

async function runWindow(S, W) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const rp = createRoomPlay({ page, wasmPage: S === 'J' ? JS_PAGE : WASM_PAGE, logs, name: `early-${S}-${W}` });
    try {
        if (W === 'reload') {
            // The first visit: load, stand in the start region, let the RE2 save be written; then reload.
            await openApp(S, page, rp);
            await bootGame(S, page, rp);
            await rp.waitForApLoad(180000);
            await waitStart(page, rp);
            await page.waitForTimeout(3000);
            const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => /seedling/i.test(k)));
            await page.reload({ waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded (reload)', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            await grantAll(page, rp);
            await hookTrace(S, page, rp);
            await bootGame(S, page, rp, () => hookTrace(S, page, rp));
            await rp.waitForApLoad(180000);
            const loadEnd = Date.now();
            await waitStart(page, rp);
            return { savedKeys: saved, ...(await settle(S, page, loadEnd)) };
        }
        await openApp(S, page, rp);
        if (W === 'pre-panel') await grantAll(page, rp);
        await bootGame(S, page, rp, async () => {
            await hookTrace(S, page, rp);
            if (W === 'pre-start') await grantAll(page, rp);
        });
        if (W === 'in-load') {
            await rp.waitFor('adapter attached + game ready, load not finished', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return !!(p?.adapter?.attached && p.adapter.gameReady && !p._apLoadResult && !p._apLoadRefusal);
            }), 120000);
            await grantAll(page, rp, { wait: false });
        }
        await rp.waitForApLoad(180000);
        const loadEnd = Date.now();
        await waitStart(page, rp);
        if (W === 'post-load') await grantAll(page, rp, { wait: false });
        if (W === 'teleport') {
            await page.evaluate(async (names) => {
                const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                p.adapter.teleport({ level: 19, x: 48, y: 48 });
                for (const n of names) proxy.addItemToInventory(n);
            }, GRANTS);
        }
        return await settle(S, page, loadEnd, W === 'teleport' ? 19 : null);
    } finally {
        await context.close();
    }
}

async function openApp(S, page, rp) {
    await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
    await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
    await rp.installWatchers();
    if (S === 'J') {
        await page.evaluate(async () => {
            const sm = (await import('./app/core/settingsManager.js')).default;
            await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
        });
    }
}

async function bootGame(S, page, rp, onFrame = async () => {}) {
    if (S === 'J') {
        await page.evaluate(async () => {
            const sm = (await import('./app/core/settingsManager.js')).default;
            await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
        });
    }
    await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
    const file = S === 'J' ? JS_PAGE : WASM_PAGE;
    await rp.waitFor('game iframe mounted', async () => page.frames().some((fr) => fr.url().includes(file)), 60000);
    await onFrame();
    if (S === 'W') await startWasmGame(() => rp.gameFrame(), { logs: [] });
}

async function waitStart(page, rp) {
    return rp.waitFor('the new game stands in the start region', () => page.evaluate(async (start) => {
        const mod = await import('./modules/flashPanel/index.js');
        const g = mod.getSeedlingRegionGlue();
        return g?.binding?.region === start ? 'start' : null;
    }, START), 90000);
}

/** Grant the five items through the AP inventory; `wait` = until the inventory holds them (the worker's round trip). */
async function grantAll(page, rp, { wait = true } = {}) {
    await page.evaluate(async (names) => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        window.__earlyGrantAt = Date.now();
        for (const n of names) await proxy.addItemToInventory(n);
    }, GRANTS);
    if (wait) {
        await rp.waitFor('the AP inventory holds the grants', () => page.evaluate(async (names) => {
            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
            const inv = proxy.getLatestStateSnapshot?.()?.inventory ?? {};
            return names.every((n) => (inv[n] ?? 0) > 0);
        }, GRANTS), 30000);
    }
}

/**
 * A trace of what the adapter pushes and when the level set is handed over (`glue.setDelivery`), installed as soon
 * as the panel has an adapter. Best effort: a window opened before the adapter exists traces from its creation.
 */
async function hookTrace(S, page, rp) {
    await rp.waitFor('the panel adapter exists', () => page.evaluate(async () => {
        const mod = await import('./modules/flashPanel/index.js');
        const p = mod.getActivePanelInstance();
        const a = p?.adapter;
        if (!a) return false;
        window.__earlyTrace ??= [];
        if (!a.__earlyHooked) {
            a.__earlyHooked = true;
            const build = a._buildQueue.bind(a);
            a._buildQueue = () => {
                const items = build();
                const shown = items.filter((i) => i.method || /^has(Sword|Shield)$|^hitsMax$/.test(i.property ?? ''))
                    .filter((i) => i.method || i.value !== false)
                    .map((i) => (i.method ? `${i.method}(${(i.args ?? []).join(',')})` : `${i.property}=${i.value}`));
                if (shown.length) window.__earlyTrace.push({ at: Date.now(), push: shown });
                return items;
            };
        }
        const g = mod.getSeedlingRegionGlue();
        if (g && !g.__earlyHooked) {
            g.__earlyHooked = true;
            const sd = g.setDelivery.bind(g);
            g.setDelivery = (d) => { window.__earlyTrace.push({ at: Date.now(), event: 'setDelivery (the set is handed over)' }); return sd(d); };
        }
        return true;
    }), 60000);
}

async function readLive(S, page) {
    return page.evaluate(async (s) => {
        const mod = await import('./modules/flashPanel/index.js');
        const p = mod.getActivePanelInstance();
        const a = p?.adapter;
        const game = a?._getFlash?.() ?? null;
        const parse = (f) => { try { const r = f(); return typeof r === 'string' ? JSON.parse(r) : r; } catch { return null; } };
        const rs = parse(() => game?.readState?.()) ?? {};
        if (s === 'J') {
            const core = a?._getWin?.()?.__seedlingJsRuntime ?? null;
            const run = core?.run ?? null;
            const save = run?.saveState ?? null;
            const notes = (core?.events ?? []).filter((e) => e.type === 'delivery' || e.type === 'mount' || e.type === 'boot')
                .map((e) => (e.type === 'delivery' ? `delivery ${e.kind}${e.key ?? e.index ?? e.property ?? (e.slot != null ? `[${e.slot}]` : '')}${e.changed ? '' : ' (unchanged)'} @L${e.level}`
                    : e.type === 'mount' ? 'MOUNT' : `boot L${e.level ?? '?'}`));
            return {
                level: run?.level ?? null,
                sword: run?.inventory?.hasSword === true,
                key0: !!run?.keys?.has?.(0),
                // the LIVE seal slots (`levelRun.sealParts`, what `deliver` writes and a Chest reads), not the boot's copy
                sealSlots: run?.finalDoorGate?.sealSlotsFilled ?? 0,
                totems: (save?.totem_parts ?? []).filter((v) => v === true).length,
                hitsMax: run?.inventory?.hitsMax ?? null,
                readout: { hasSword: rs.hasSword, keyMask: rs.keyMask, totemCount: rs.totemCount, hitsMax: rs.hitsMax },
                notes,
            };
        }
        const st = parse(() => game?.botStatus?.()) ?? {};
        const save = st.save ?? {};
        return {
            level: st.level ?? rs.level ?? null,
            sword: rs.hasSword === true,
            key0: ((Number(rs.keyMask) >> 0) & 1) === 1 || save.keys?.[0] === true,
            sealSlots: (save.seal_parts ?? []).filter((v) => Number.isInteger(v) && v !== -1).length,
            totems: (save.totem_parts ?? []).filter((v) => v === true).length,
            hitsMax: rs.hitsMax ?? null,
            readout: { hasSword: rs.hasSword, keyMask: rs.keyMask, totemCount: rs.totemCount, hitsMax: rs.hitsMax, saveKeys: save.keys },
        };
    }, S);
}

async function settle(S, page, loadEnd, wantLevel = null) {
    const heldAt = {};
    const t0 = Date.now();
    let live = null;
    for (;;) {
        // eslint-disable-next-line no-await-in-loop
        live = await readLive(S, page);
        const ms = Date.now() - loadEnd;
        if (live.sword && heldAt.sword == null) heldAt.sword = ms;
        if (live.key0 && heldAt.key == null) heldAt.key = ms;
        if (live.sealSlots > 0 && heldAt.seal == null) heldAt.seal = ms;
        if (live.totems > 0 && heldAt.totem == null) heldAt.totem = ms;
        if (live.hitsMax >= HITS_WANT && heldAt.health == null) heldAt.health = ms;
        const all = Object.keys(heldAt).length === 5 && (wantLevel == null || live.level === wantLevel);
        if (all || Date.now() - t0 > SETTLE_MS) break;
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(250);
    }
    await page.waitForTimeout(3000);
    live = await readLive(S, page);
    const v = (held, twice) => (twice ? 'TWICE' : held ? 'APPLIED' : 'DROPPED');
    const verdict = {
        sword: v(live.sword, false),
        key: v(live.key0, false),
        seal: v(live.sealSlots >= 1, live.sealSlots > 1),
        totem: v(live.totems >= 1, live.totems > 1),
        health: v(live.hitsMax >= HITS_WANT, live.hitsMax > HITS_WANT),
    };
    const trace = await page.evaluate(() => (window.__earlyTrace ?? []).concat(window.__earlyGrantAt ? [{ at: window.__earlyGrantAt, event: 'GRANT' }] : []));
    trace.sort((a, b) => a.at - b.at);
    const tz = trace[0]?.at ?? 0;
    return {
        verdict,
        heldMsAfterLoad: heldAt,
        final: live,
        hitsBase: HITS_BASE,
        trace: trace.slice(0, 14).map((e) => `${e.at - tz}ms ${e.event ?? `push ${e.push.join(' ')}`}`),
    };
}
