#!/usr/bin/env node
/**
 * Seedling RESTART ROUTE (⚖ the user, 2026-10-05: *"I want the logic to be aware that returning to the menu at any
 * point is always possible."*) — the Playback Bot's route planner takes the built-in RESTART move
 * (`procgenCore/restartRoute.js`) when the slot declares `exporter[p].return_to_menu` and the player's region has no
 * walk to the next sphere goal. `seedling_playthrough` loaded by `?rules=`, headless logic-only, under the box lock;
 * every session on a FRESH page.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. the new game at the start; the player is moved (an AP move) into a RESTART-ONLY pocket (`--pocket=`,
 *        default `level_17`: the soft-lock census's sphere-0 list and the route survey's sphere-0.4 Restart leg);
 *     2. the bot plays the derived sphere queue FROM the pocket: its planner answers a route that BEGINS with
 *        RESTART (no walk out), and the bot takes the Menu panel's Restart — no exit walkTo out of the pocket;
 *     3. the warp settles: gameState and the binding read the start region, the game stands at
 *        `seedlingStartSpawn` (the new game's constructor position), and no location check fired;
 *     4. the bot WALKS ON from the start: it leaves the start region (or checks a location) within `--budget-s`.
 *
 *   `--flag=off` serves the same rules WITHOUT `return_to_menu` (fail-closed): the bot stops at the pocket with
 *   today's named refusal (`error: no path from <pocket> to <goal>`), and no Restart is taken.
 *   `--expect=refusal` with the flag ON is the CONTROL on a tree without the planner: the same leg stops by name.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W SKIPs.
 *
 * Run: node scripts/procgen/probe-seedling-restart-route.mjs [--host=http://localhost:8000] [--only=W,J]
 *      [--pocket=level_17] [--flag=on|off] [--expect=restart|refusal] [--budget-s=300]
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

argvHelp(import.meta.url);

/** The preset, by its rules file (served path relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name). */
const JS_PAGE = 'jsRuntime.html';

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-restart-route.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'W,J').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '300')) * 1000;
    const POCKET = arg('pocket', 'level_17');
    const FLAG_ON = arg('flag', 'on') !== 'off';
    const EXPECT_RESTART = arg('expect', FLAG_ON ? 'restart' : 'refusal') === 'restart';
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const POCKET_LEVEL = PRESET.preset_sidecars['1'][POCKET]?.playable_payload?.level ?? null;
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
    if (POCKET_LEVEL === null) {
        console.log(`FAIL: --pocket=${POCKET} is not a Seedling region of the playthrough`);
        process.exit(1);
    }
    console.log(`INFO: pocket ${POCKET} (level ${POCKET_LEVEL}); start ${START}; return_to_menu served ${FLAG_ON ? 'ON' : 'OFF'}; `
        + `expecting ${EXPECT_RESTART ? 'a Restart' : 'the named refusal'}`);
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
        if (S === 'W' && !haveWasm) { console.log(`SKIP: W — seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`); continue; }
        console.log(`INFO: ── session ${S} (a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(S);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(S) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        if (!FLAG_ON) {
            // ⛔ fail-closed: the same document, the flag deleted (nothing else changes).
            // ⚠ by PATHNAME: the page's own URL carries the rules path in its query (`?rules=`).
            await page.route((url) => url.pathname.endsWith(RULES_PATH.slice(1)), async (route) => {
                const res = await route.fetch();
                const doc = await res.json();
                delete doc.exporter?.['1']?.return_to_menu;
                await route.fulfill({ response: res, json: doc });
            });
        }
        const framePage = S === 'J' ? JS_PAGE : WASM_PAGE;
        const rp = createRoomPlay({ page, wasmPage: framePage, logs, name: `rr-${S}` });
        const { check, waitFor } = rp;
        const out = (tag, o) => console.log(`ROW ${S} ${tag} ${JSON.stringify(o)}`);

        /** The game (either runtime), the binding, gameState and the watched checks, in one round trip. */
        const snap = () => page.evaluate(async () => {
            const mod = await import('./modules/flashPanel/index.js');
            const g = mod.getSeedlingRegionGlue();
            const game = g?.adapter?._getFlash?.() ?? null;
            let st = null;
            try { const raw = game?.botStatus?.(); st = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { st = null; }
            let rs = null;
            try { const raw = game?.readState?.(); rs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { rs = null; }
            const b = g?.binding;
            return {
                region: window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null,
                binding: b ? { region: b.region, active: b.active, restarts: b.restarts, startSpawn: b.startSpawn() } : null,
                game: { level: st?.level ?? null, x: st?.x ?? null, y: st?.y ?? null,
                    ctor: rs ? { level: rs.level, x: rs.playerPositionX, y: rs.playerPositionY } : null },
                lastRestart: g?.lastRestart ?? null,
                checks: [...(window.__checks ?? [])],
            };
        });
        const settledAt = (pred, desc, ms = 30000) => waitFor(desc, async () => { const s = await snap(); return pred(s) ? s : null; }, ms);
        const botState = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null,
                active: bot?.isActive?.() ?? null, pending: bot?.getRestartPending?.() ?? null,
                cursor: bot?.getCursor?.() ?? null, log: bot?.getLog?.() ?? [] };
        });
        const sameSpot = (a, b) => a && b && a.level === b.level && a.x === b.x && a.y === b.y;

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
                await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                    const b = document.getElementById('btn-start');
                    return !!b && !b.disabled;
                }));
                await rp.gameFrame().click('#btn-start');
                await assertLogicOnlyChannel(rp.gameFrame());
            }
            await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return !!p?._apLoadResult;
            }), 180000);
            await rp.waitFor('checks watched', () => page.evaluate(async () => {
                window.__checks = window.__checks ?? [];
                const { getActivePanelInstance, getDispatcher } = await import('./modules/flashPanel/index.js');
                const ds = [getActivePanelInstance()?.adapter?.dispatcher, getDispatcher()].filter(Boolean);
                if (ds.length === 0) return false;
                for (const d of ds) {
                    if (d.__rr) continue;
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__rr = true;
                }
                return true;
            }), 20000);

            // 1. THE NEW GAME, then INTO THE POCKET (an AP move: the binding's arrival teleports the game there).
            await settledAt((s) => s.binding?.region === START && s.game.level === 0 && s.game.x !== null,
                'the new game stands in the start region', 60000);
            await page.waitForTimeout(1500);
            const newGame = await snap();
            const spawn = newGame.binding.startSpawn;
            const flagSeen = await page.evaluate(async () => {
                const { getLastRawJsonData } = await import('./modules/stateManager/index.js');
                return getLastRawJsonData()?.rawJsonData?.exporter?.['1']?.return_to_menu ?? null;
            });
            out('new game', { spawn, game: newGame.game, flagSeen });
            check(`${S}: the page's rules carry return_to_menu ${FLAG_ON ? 'ON' : 'ABSENT'}`, FLAG_ON ? flagSeen === true : flagSeen === null,
                JSON.stringify(flagSeen));
            await page.evaluate(async ({ from, to }) => {
                const d = (await import('./modules/flashPanel/index.js')).getDispatcher();
                d.publish('user:regionMove', { sourceRegion: from, targetRegion: to, exitName: null, source: 'probe-restart-route' },
                    { initialTarget: 'bottom' });
            }, { from: START, to: POCKET });
            const inPocket = await settledAt((s) => s.region === POCKET && s.binding.region === POCKET && s.game.level === POCKET_LEVEL,
                `the player in ${POCKET}`, 30000).catch(() => null);
            await page.waitForTimeout(1000);
            out('pocket', await snap());
            check(`${S}: the player is in the pocket ${POCKET} (game level ${POCKET_LEVEL}; the binding and gameState agree)`, !!inPocket);

            // 2. THE BOT PLAYS THE SPHERE QUEUE FROM THE POCKET.
            const before = await snap();
            const booted = await page.evaluate(async ({ rulesPath, pocket }) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                await getSphereStateSingleton().loadSphereLog('probe-seedling-restart-route:derived', text);
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                bot.onRegionMove({ targetRegion: pocket });
                bot.refresh();
                bot._ensureQueueBuilt?.();
                // The planner's own answer at the pocket, before anything moves (what the bot is about to do).
                bot._seedCheckedFromSnapshot?.();
                bot._advanceCursor?.();
                const head = bot._queue?.[bot._cursor] ?? null;
                const { pingWorker } = window.stateManagerProxy ?? {};
                if (pingWorker) await window.stateManagerProxy.pingWorker('probe-restart-route');
                const plan = head && typeof bot._planRoute === "function" ? bot._planRoute(pocket, head.regionName) : null;
                const firstSteps = plan?.route?.steps?.slice(0, 3) ?? null;
                await bot.play();
                return { ok: true, head, plan: { kind: plan?.kind ?? null, why: plan?.why ?? null, firstSteps },
                    status: bot.getStatus?.() ?? '' };
            }, { rulesPath: RULES_PATH, pocket: POCKET });
            out('bot from the pocket', booted);
            check(`${S}: the Playback Bot is mounted and its head is outside the pocket`,
                booted.ok && !!booted.head && booted.head.regionName !== POCKET, JSON.stringify(booted.head));

            if (!EXPECT_RESTART) {
                // FLAG OFF / CONTROL: today's named refusal at the pocket, and no Restart.
                const t0 = Date.now();
                const stopped = await waitFor('the bot stops with a named refusal', async () => {
                    const b = await botState();
                    return /^error/.test(b.status) ? b : null;
                }, 30000).catch(() => null);
                const now = await snap();
                out('refusal', { stopped: stopped && { status: stopped.status, region: stopped.region }, ms: Date.now() - t0,
                    lastRestart: now.lastRestart, region: now.region });
                check(`${S}: ${FLAG_ON ? 'CONTROL —' : 'without return_to_menu'} the bot stops at ${POCKET} with today's refusal "error: no path from ${POCKET} to …"`,
                    !!stopped && stopped.status.startsWith(`error: no path from ${POCKET} to `) && stopped.active === false,
                    JSON.stringify(stopped ?? await botState()));
                check(`${S}: …and no Restart was taken (the player is still in the pocket)`,
                    now.region === POCKET && now.binding.region === POCKET && (now.binding.restarts ?? 0) === (before.binding.restarts ?? 0),
                    JSON.stringify({ region: now.region, restarts: now.binding.restarts }));
            } else {
                check(`${S}: the planner's route from ${POCKET} BEGINS with RESTART (no walk out of the pocket)`,
                    booted.plan.kind === 'restart' && booted.plan.firstSteps?.[1]?.restart === true
                        && booted.plan.firstSteps?.[1]?.region === 'Menu', JSON.stringify(booted.plan));

                // 3. THE WARP SETTLES AT THE START SPAWN.
                const landed = await settledAt((s) => s.region === START && s.binding.region === START && s.game.level === 0
                    && sameSpot(s.game.ctor, spawn), 'the Restart landed at the start spawn', 30000).catch(() => null);
                const atLanding = await snap();
                const b0 = await botState();
                out('landed', { game: atLanding.game, lastRestart: atLanding.lastRestart, bot: { status: b0.status, region: b0.region, pending: b0.pending } });
                check(`${S}: the bot TOOK the Restart — "restarting (no walk from ${POCKET})" is in its log`,
                    b0.log.some((l) => l.includes(`restarting (no walk from ${POCKET})`)), JSON.stringify(b0.log.slice(-6)));
                check(`${S}: ⛔ no exit walkTo out of the pocket — the bot never routed via an exit while in ${POCKET}`,
                    !b0.log.some((l) => /routing via/.test(l) && l.includes(`${POCKET} ->`)), JSON.stringify(b0.log.slice(-6)));
                check(`${S}: the warp settled — gameState and the binding read "${START}", the game at seedlingStartSpawn`,
                    !!landed && atLanding.lastRestart?.taken === true, JSON.stringify({ game: atLanding.game, spawn, lastRestart: atLanding.lastRestart }));
                check(`${S}: no location check fired by the Restart`, (landed?.checks.length ?? -1) === before.checks.length,
                    JSON.stringify(landed?.checks.slice(before.checks.length)));

                // 4. THE BOT WALKS ON FROM THE START.
                const t1 = Date.now();
                const walkedOn = await waitFor('the bot walks on from the start (leaves it, or checks a location)', async () => {
                    const b = await botState();
                    const s = await snap();
                    if (/^error/.test(b.status)) return { ...b, checks: s.checks.length, failed: true };
                    return (b.region && b.region !== START && b.region !== 'Menu') || s.checks.length > before.checks.length
                        ? { ...b, checks: s.checks.length } : null;
                }, BUDGET_MS).catch(() => null);
                out('walked on', { walkedOn: walkedOn && { status: walkedOn.status, region: walkedOn.region, checks: walkedOn.checks },
                    ms: Date.now() - t1 });
                check(`${S}: the bot WALKS ON from the start after the Restart (within ${BUDGET_MS / 1000} s)`,
                    !!walkedOn && !walkedOn.failed, JSON.stringify(walkedOn ?? await botState()));
            }
            await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                getActivePanel()?.getBot?.()?.stop?.();
            });
            const errors = logs.filter((l) => l.startsWith('[pageerror]'));
            console.log(`INFO: ${errors.length} page error(s)${errors.length ? `: ${errors.slice(0, 3).map((l) => l.slice(0, 200)).join(' | ')}` : ''}`);
        } catch (e) {
            check(`${S}: fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`PAGE LOGS (last 30):\n${logs.slice(-30).join('\n')}`);
        }
        await page.close();
        return rp.failures();
    }
}
