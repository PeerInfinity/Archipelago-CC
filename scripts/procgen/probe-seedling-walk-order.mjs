#!/usr/bin/env node
/**
 * Seedling WALK ORDER (slice `bot-route-chooser`, ⚖ the user 2026-10-20: *"the playback bot restarts the second
 * dungeon twice because the sphere order says to collect some seals elsewhere first"*) — the Playback Bot plays
 * `seedling_playthrough` from the new game under a walk order (`playbackBot/walkOrder.js`) on the real page, and this
 * records what it did through Dungeon2: the locations it checked, in order, and the Restarts it took. Headless
 * logic-only, under the box lock; every session on a FRESH page. Report-and-check, not a survey: the game's own
 * solver walks every leg, so a leg the game cannot walk shows up as a stall or a named stop.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. the new game at the start; the derived sphere log loaded, the bot's walk order set (`--order=`);
 *     2. the bot plays until `--until=` is checked (default: L20's Shield, the end of Dungeon2), or it stops, or
 *        `--budget-s` runs out;
 *     3. the rows: the check order and the bot's route stats (`getRouteStats`); with `--expect=` (a comma list of
 *        location names), the check order must begin with it, and `--max-restarts=` bounds the Restarts.
 *
 * The offline answer it checks (`measure-bot-route-orders.mjs`, `reachable-cheapest` and `sphere-cheapest`): L86's
 * chest, L17's chest, a Restart to L10's Sword, L11, L36, L19's Boss Key 0 and Shieldspire, L20's Shield — ONE Restart
 * (in order: two).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W SKIPs.
 *
 * Run: node scripts/procgen/probe-seedling-walk-order.mjs [--host=http://localhost:8000] [--only=J,W]
 *      [--order=reachable-cheapest|sphere-cheapest|sphere-in-order] [--until=<location>] [--budget-s=1800]
 *      [--expect=<loc>,<loc>,…] [--max-restarts=<n>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf } from './seedlingRoomPlay.js';
import { bootRetriesLine, isBootFault, startWasmGame, withBootRetry } from './seedlingProbeBoot.js';

argvHelp(import.meta.url);

/** The preset, by its rules file (served path relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name). */
const JS_PAGE = 'jsRuntime.html';

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-walk-order.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'J,W').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '1800')) * 1000;
    const ORDER = arg('order', 'reachable-cheapest');
    const UNTIL = arg('until', 'Level 020 - Shield');
    const EXPECT = arg('expect', '') ? arg('expect', '').split(',') : null;
    const MAX_RESTARTS = arg('max-restarts', null) === null ? null : Number(arg('max-restarts', null));
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
    console.log(`INFO: walk order ${ORDER}; until "${UNTIL}"; start ${START}; budget ${BUDGET_MS / 1000} s`);
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
        if (S === 'W' && !haveWasm) { console.log(`SKIP: W — seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`); continue; }
        console.log(`INFO: ── session ${S} (a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await withBootRetry(S, () => runSession(S));
    }
    await browser.close();
    console.log(bootRetriesLine());
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(S) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const framePage = S === 'J' ? JS_PAGE : WASM_PAGE;
        const rp = createRoomPlay({ page, wasmPage: framePage, logs, name: `wo-${S}` });
        const { check, waitFor } = rp;
        const out = (tag, o) => console.log(`ROW ${S} ${tag} ${JSON.stringify(o)}`);
        const botState = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            const checked = window.stateManagerProxy?.getLatestStateSnapshot?.()?.checkedLocations ?? [];
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null,
                active: bot?.isActive?.() ?? null, stats: bot?.getRouteStats?.() ?? null, order: bot?.getWalkOrder?.() ?? null,
                checks: [...(window.__checks ?? [])], checked: [...checked], log: (bot?.getLog?.() ?? []).slice(-8) };
        });

        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            if (S === 'J') {
                await page.evaluate(async () => {
                    const sm = (await import('./app/core/settingsManager.js')).default;
                    await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
                });
                await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
                await rp.waitFor('JS runtime iframe mounted', async () => page.frames().some((fr) => fr.url().includes(JS_PAGE)), 60000);
            } else {
                await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
                await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
                await startWasmGame(() => rp.gameFrame(), { logs });
                await assertLogicOnlyChannel(rp.gameFrame());
            }
            await rp.waitForApLoad(180000);
            await rp.waitFor('checks watched', () => page.evaluate(async () => {
                window.__checks = window.__checks ?? [];
                const { getActivePanelInstance, getDispatcher } = await import('./modules/flashPanel/index.js');
                const ds = [getActivePanelInstance()?.adapter?.dispatcher, getDispatcher()].filter(Boolean);
                if (ds.length === 0) return false;
                for (const d of ds) {
                    if (d.__wo) continue;
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck' && !window.__checks.includes(p?.locationName)) window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__wo = true;
                }
                return true;
            }), 20000);
            await page.waitForTimeout(1500);

            // 1. THE BOT, the derived sphere log, the walk order; play from the new game.
            const booted = await page.evaluate(async ({ rulesPath, start, order }) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                await getSphereStateSingleton().loadSphereLog('probe-seedling-walk-order:derived', text);
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                bot.setTargetSource('sphere');
                bot.setWalkOrder(order);
                bot.onRegionMove({ targetRegion: start });
                bot.refresh();
                await bot.play();
                return { ok: true, order: bot.getWalkOrder(), head: bot.getCurrentHead?.() ?? null, status: bot.getStatus?.() ?? '' };
            }, { rulesPath: RULES_PATH, start: START, order: ORDER });
            out('boot', booted);
            check(`${S}: the Playback Bot plays under walk order ${ORDER}`, booted.ok && booted.order === ORDER, JSON.stringify(booted));

            // 2. PLAY until the bound is checked, the bot stops, or the budget runs out.
            const t0 = Date.now();
            let last = null;
            const done = await waitFor(`"${UNTIL}" checked`, async () => {
                const b = await botState();
                if (!last || b.checks.length !== last.checks.length) out('progress', { ms: Date.now() - t0, checks: b.checks, stats: b.stats });
                last = b;
                if (b.checked.includes(UNTIL)) return b;
                if (!b.active && /^(error|blocked|finished)/.test(b.status)) return { ...b, stopped: true };
                return null;
            }, BUDGET_MS).catch(() => null);
            const end = done ?? await botState();
            out('result', { ms: Date.now() - t0, reached: end.checked.includes(UNTIL), status: end.status, region: end.region,
                stats: end.stats, checks: end.checks, log: end.log });
            check(`${S}: "${UNTIL}" checked within ${BUDGET_MS / 1000} s`, end.checked.includes(UNTIL), JSON.stringify({ status: end.status, log: end.log }));
            if (EXPECT) {
                const head = end.checks.slice(0, EXPECT.length);
                check(`${S}: the check order begins ${EXPECT.join(' → ')}`, JSON.stringify(head) === JSON.stringify(EXPECT), JSON.stringify(head));
            }
            if (MAX_RESTARTS !== null) {
                check(`${S}: at most ${MAX_RESTARTS} Restart(s) through "${UNTIL}"`, (end.stats?.restarts ?? Infinity) <= MAX_RESTARTS,
                    JSON.stringify(end.stats));
            }
            await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                getActivePanel()?.getBot?.()?.stop?.();
            });
            const errors = logs.filter((l) => l.startsWith('[pageerror]'));
            console.log(`INFO: ${errors.length} page error(s)${errors.length ? `: ${errors.slice(0, 3).map((l) => l.slice(0, 200)).join(' | ')}` : ''}`);
        } catch (e) {
            if (isBootFault(e)) { await page.close(); throw e; }
            check(`${S}: fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`PAGE LOGS (last 30):\n${logs.slice(-30).join('\n')}`);
        }
        await page.close();
        return rp.failures();
    }
}
