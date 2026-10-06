#!/usr/bin/env node
/**
 * Seedling LOOP-MODE RESTART (⚖ the user, 2026-10-06: *"Loop mode has its own restart mechanic, which returns to the
 * start region and also resets mana."* / *"The start region should always be menu, not a Seedling region."*) — the
 * loops' Restart moves nobody (`loopState.restartFromStart` → `_resetLoop`: mana, progress, index 0, no region
 * move); the REPLAY's first move does. With the loop's start = `Menu`, that move is the declared start → the
 * resolved start, the same hop a new game takes, so procgenPlayer marks its load `startHop` and the binding teleports
 * the game to `seedlingStartSpawn`. This probe measures that, on the GAME (wasm, default build) and on the JS runtime.
 * `seedling_playthrough` loaded by `?rules=`, headless logic-only, under the box lock; every session on a FRESH page.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. loop mode ON (the Loops panel's Accept Defaults: the preset carries no `loop_costs`); the queue = `Menu` → GameStart → the start region, then the start region's WEST door
 *        (a Seedling action: a live crossing), built with `gameState.updatePath` (the panel's own queue writer);
 *     2. Start: the first move lands the player in the start region at seedlingStartSpawn; the start block PARKS for
 *        live play (the default block mode), and the probe walks west — the game leaves L0 (gameState follows);
 *     3. the Loops panel's RESTART button: the reset moves nobody (gameState, the binding and the game stay where the
 *        player was); after the replay's FIRST move: gameState, the binding and the game read the start region at
 *        seedlingStartSpawn, the arrival was a start hop, no location check fired;
 *     4. the player walks away again, then the Menu panel's RESTART (loop mode: lands PAUSED), then the Loops panel's
 *        Start: the same rows after the first move.
 *     Each restart also records the fallback's decision (`glue.lastLoopReset`): with the start = `Menu` it must
 *     DECLINE (no double teleport) — exactly one teleport per restart, the replay's.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W SKIPs.
 *
 * Run: node scripts/procgen/probe-seedling-loop-restart.mjs [--host=http://localhost:8000] [--only=W,J]
 *      [--wait-for-box=<sec>]
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
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name) and its canvas. */
const JS_PAGE = 'jsRuntime.html';
const CANVAS = { W: '#canvas', J: '#game' };
const LOOPS_PANEL = 'loopsPanel';

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-loop-restart.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'W,J').split(',').filter(Boolean);
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const MENU_EXIT = PRESET.regions['1'].Menu.exits[0];
    const START = MENU_EXIT.connected_region;
    const startPayload = PRESET.preset_sidecars['1'][START].playable_payload;
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
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
        const framePage = S === 'J' ? JS_PAGE : WASM_PAGE;
        const rp = createRoomPlay({ page, wasmPage: framePage, logs, name: `lr-${S}` });
        const { check, waitFor } = rp;
        const out = (tag, o) => console.log(`ROW ${S} ${tag} ${JSON.stringify(o)}`);

        /** Everything a row reads, in one page round trip: the game, the binding, gameState, the loop. */
        const snap = () => page.evaluate(async () => {
            const mod = await import('./modules/flashPanel/index.js');
            const g = mod.getSeedlingRegionGlue();
            const game = g?.adapter?._getFlash?.() ?? null;
            let st = null;
            try { const raw = game?.botStatus?.(); st = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { st = null; }
            let rs = null;
            try { const raw = game?.readState?.(); rs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { rs = null; }
            const b = g?.binding;
            const { centralRegistry } = await import('./app/core/centralRegistry.js');
            const ls = centralRegistry.getPublicFunction('loops', 'getLoopState')?.();
            const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
            let gsx = null;
            try { gsx = getGameStateSingleton(); } catch { gsx = null; }
            return {
                region: window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null,
                loopMode: !!gsx?.isLoopModeActive,
                mana: gsx ? { current: gsx.getCurrentMana?.(), max: gsx.getMaxMana?.() } : null,
                loop: ls ? { index: ls.currentActionIndex, processing: !!ls.isProcessing, paused: !!ls.isPaused,
                    state: ls.getProcessingState?.() ?? null, length: ls.getActionQueue?.()?.length ?? null } : null,
                binding: b ? { region: b.region, active: b.active, startRegion: b.startRegion, restarts: b.restarts,
                    arrivedByStartHop: b.arrivedByStartHop, lastLevel: b.lastLevel, startSpawn: b.startSpawn() } : null,
                game: { level: st?.level ?? null, x: st?.x ?? null, y: st?.y ?? null,
                    ctor: rs ? { level: rs.level, x: rs.playerPositionX, y: rs.playerPositionY } : null },
                stats: g ? { ...g.stats } : null,
                lastRestart: g?.lastRestart ?? null,
                lastLoopReset: g?.lastLoopReset ?? null,
                checks: [...(window.__checks ?? [])],
                loads: [...(window.__loads ?? [])],
            };
        });
        const settledAt = (pred, desc, ms = 30000) => waitFor(desc, async () => { const s = await snap(); return pred(s) ? s : null; }, ms);
        const sameSpot = (a, b) => a && b && a.level === b.level && a.x === b.x && a.y === b.y;

        async function bootWasm() {
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
            await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                const b = document.getElementById('btn-start');
                return !!b && !b.disabled;
            }));
            await rp.gameFrame().click('#btn-start');
            await assertLogicOnlyChannel(rp.gameFrame());
        }
        async function bootJs() {
            await page.evaluate(async () => {
                const sm = (await import('./app/core/settingsManager.js')).default;
                await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
            });
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('JS runtime iframe mounted', async () => page.frames().some((fr) => fr.url().includes(JS_PAGE)), 60000);
        }

        /** A button in a panel, pressed as a person would (the panel brought to the front first). */
        async function pressButton(panelId, selector, desc) {
            await page.evaluate(async (id) => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: id }, 'tests');
            }, panelId);
            await rp.waitFor(`${desc} is visible and enabled`, () => page.evaluate((sel) => {
                const b = document.querySelector(sel);
                if (!b) return false;
                // ⛓ the Loops panel keeps most buttons in its collapsed "Controls" section: open it, as a person would
                const content = b.closest('.controls-content');
                if (content && content.style.display === 'none') {
                    content.parentElement?.querySelector('.controls-header')?.click();
                }
                return b.offsetParent !== null && !b.disabled;
            }, selector), 20000);
            await page.click(selector);
        }

        /** Hold `key` on the game's canvas until `until(snap)` answers or `ms`; the keys are always released. */
        async function holdKey(key, until, ms = 8000) {
            await clickPanelTab(page, FLASH_PANEL);
            await page.waitForTimeout(300);
            await rp.gameFrame().click(CANVAS[S]);
            await page.keyboard.down(key);
            try {
                const t0 = Date.now();
                for (;;) {
                    // eslint-disable-next-line no-await-in-loop
                    const s = await snap();
                    if (until(s)) return s;
                    if (Date.now() - t0 > ms) return null;
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(100);
                }
            } finally {
                await page.keyboard.up(key);
            }
        }

        /** West out of the start (L0's teleporter at x 0, the spawn's row): the game leaves L0, gameState follows. */
        const westTarget = startPayload.exits.find((e) => e.entrance_tile?.[0] === 0)?.targetRegion ?? null;
        async function walkAway(tag) {
            const walked = await holdKey('ArrowLeft', (s) => s.game.level !== 0 && s.game.level !== null, 10000);
            const away = walked ? await settledAt((s) => s.region !== START && s.region !== 'Menu' && s.game.level !== 0,
                `${tag}: the crossing out of the start published`, 15000).catch(() => null) : null;
            await page.waitForTimeout(1000);
            const s = await snap();
            out(`${tag} away`, { westTarget, region: s.region, binding: s.binding?.region, game: s.game, loop: s.loop });
            check(`${S}: ${tag} — the player walked out of the start (the game left L0; gameState reads "${westTarget}")`,
                !!away && s.region === westTarget && s.game.level !== 0, JSON.stringify({ region: s.region, game: s.game }));
            return s;
        }

        /** The rows after a restart: the reset alone moves nobody; the replay's first move lands at the spawn. */
        async function afterRestart(tag, before, spawn, { start }) {
            // The reset itself (before any replay frame can move anyone — read straight after the press).
            const atReset = await snap();
            out(`${tag} at reset`, { region: atReset.region, binding: atReset.binding?.region, game: atReset.game,
                loop: atReset.loop, mana: atReset.mana, lastLoopReset: atReset.lastLoopReset });
            if (start) await start();
            const landed = await settledAt((s) => s.region === START && s.binding?.region === START && s.game.level === 0
                && sameSpot(s.game.ctor, spawn), `${tag}: the replay's first move landed at the start`, 30000).catch(() => null);
            await page.waitForTimeout(1500);
            const s = await snap();
            const newLoads = s.loads.slice(before.loads.length);
            out(`${tag} first move`, { region: s.region, binding: s.binding, game: s.game, loop: s.loop, mana: s.mana,
                teleports: s.stats.teleports - before.stats.teleports, loads: newLoads, lastLoopReset: s.lastLoopReset,
                lastRestart: s.lastRestart });
            check(`${S}: ${tag} — after the replay's first move gameState and the binding read the start region "${START}"`,
                s.region === START && s.binding?.region === START && s.binding?.active === true,
                JSON.stringify({ region: s.region, binding: s.binding }));
            check(`${S}: ${tag} — the game stands at seedlingStartSpawn (level, constructor position)`,
                !!landed && sameSpot(s.game.ctor, spawn), JSON.stringify({ game: s.game, spawn }));
            check(`${S}: ${tag} — the first move's load was the start hop (Menu → "${START}")`,
                newLoads.some((l) => l.region === START && l.startHop === true), JSON.stringify(newLoads));
            check(`${S}: ${tag} — exactly ONE teleport (the replay's arrival), no fallback warp on the reset`,
                s.stats.teleports - before.stats.teleports === 1 && (s.lastLoopReset == null || s.lastLoopReset.taken === false),
                JSON.stringify({ teleports: s.stats.teleports - before.stats.teleports, lastLoopReset: s.lastLoopReset }));
            check(`${S}: ${tag} — no location check fired`, s.checks.length === before.checks.length,
                JSON.stringify(s.checks.slice(before.checks.length)));
            return s;
        }

        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            if (S === 'J') await bootJs(); else await bootWasm();
            await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return !!p?._apLoadResult;
            }), 180000);
            await rp.waitFor('checks + loads watched', () => page.evaluate(async () => {
                window.__checks = window.__checks ?? [];
                window.__loads = window.__loads ?? [];
                const { getActivePanelInstance, getDispatcher } = await import('./modules/flashPanel/index.js');
                const ds = [getActivePanelInstance()?.adapter?.dispatcher, getDispatcher()].filter(Boolean);
                if (ds.length === 0) return false;
                for (const d of ds) {
                    if (d.__lr) continue;
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__lr = true;
                }
                if (!window.__lrLoads) {
                    const bus = (await import('./app/core/eventBus.js')).default;
                    bus.subscribe('flashSeedling:loadRegion', (p) => {
                        window.__loads.push({ region: p?.region_id ?? null, startHop: p?.startHop === true,
                            restart: p?.restart === true, from: p?.arrivedFrom?.source_region ?? null });
                    }, 'probe-seedling-loop-restart');
                    window.__lrLoads = true;
                }
                return true;
            }), 20000);

            await settledAt((s) => s.binding?.region === START && s.game.level === 0 && s.game.x !== null,
                'the new game stands in the start region', 60000);
            await page.waitForTimeout(1500);
            const newGame = await snap();
            const spawn = newGame.binding.startSpawn;
            out('new game', newGame);
            check(`${S}: the new game stands at seedlingStartSpawn in "${START}"`, sameSpot(spawn, newGame.game.ctor),
                JSON.stringify({ spawn, game: newGame.game }));

            // 1. LOOP MODE + the queue. The playthrough carries no `loop_costs`, so the Loops panel offers "No cost data
            // loaded" first; its Accept Defaults (regions 50, locations 100) is the person's way in, and enters loop mode.
            await pressButton(LOOPS_PANEL, '#loop-ui-accept-defaults', 'the Loops panel\'s Accept Defaults');
            await rp.waitFor('loop mode entered', async () => (await snap()).loopMode, 20000);
            const queue = await page.evaluate(async ({ start, menuExit, west }) => {
                const { centralRegistry } = await import('./app/core/centralRegistry.js');
                const getPub = (m, f) => centralRegistry.getPublicFunction(m, f);
                const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
                const regions = proxy.getStaticData?.()?.regions;
                const rd = regions?.get ? regions.get(start) : regions?.[start];
                const exit = (rd?.exits ?? []).find((e) => e.connected_region === west);
                getPub('gameState', 'clearPath')?.();
                getPub('gameState', 'updatePath')(start, menuExit, 'Menu');
                if (exit) getPub('gameState', 'updatePath')(west, exit.name, start);
                const ls = getPub('loops', 'getLoopState')?.();
                return { exit: exit?.name ?? null, queue: (ls?.getActionQueue?.() ?? []).map((a) => `${a.type} ${a.sourceRegion}`
                    + (a.destinationRegion ? ` -> ${a.destinationRegion}` : '')) };
            }, { start: START, menuExit: MENU_EXIT.name, west: westTarget });
            const q0 = await snap();
            out('queue', { ...queue, loopMode: q0.loopMode, loop: q0.loop });
            check(`${S}: loop mode is on and the queue is Menu → "${START}" → "${westTarget}"`,
                q0.loopMode && !!queue.exit && queue.queue.length === 2, JSON.stringify(queue));

            // 2. Start: the first move into the start region, then live play out of it.
            let before = await snap();
            await pressButton(LOOPS_PANEL, '#loop-ui-toggle-pause', 'the Loops panel\'s Start');
            await settledAt((s) => s.region === START && (s.loop?.index ?? 0) >= 1, 'the first move ran', 30000).catch(() => null);
            await page.waitForTimeout(1000);
            const first = await snap();
            out('first run', { region: first.region, binding: first.binding?.region, game: first.game, loop: first.loop,
                loads: first.loads.slice(before.loads.length) });
            await walkAway('run 1');

            // 3. THE LOOPS PANEL'S RESTART (autoStart: the replay runs at once).
            before = await snap();
            await pressButton(LOOPS_PANEL, '#loop-ui-toggle-restart', 'the Loops panel\'s Restart');
            await afterRestart('loops Restart', before, spawn, {});

            // 4. AWAY AGAIN, then THE MENU PANEL'S RESTART (lands paused) + the Loops panel's Start.
            await walkAway('run 2');
            before = await snap();
            await pressButton('menuPanel', '.menu-panel-restart-button', 'the Menu panel\'s Restart');
            const paused = await snap();
            check(`${S}: the Menu panel's Restart (loop mode) moved nobody and landed PAUSED at index 0`,
                paused.region === before.region && paused.game.level === before.game.level
                    && paused.loop?.index === 0 && paused.loop?.processing === false,
                JSON.stringify({ region: paused.region, game: paused.game, loop: paused.loop, lastRestart: paused.lastRestart }));
            await afterRestart('menu Restart', before, spawn, {
                start: () => pressButton(LOOPS_PANEL, '#loop-ui-toggle-pause', 'the Loops panel\'s Start'),
            });
            const pageErrors = logs.filter((l) => l.startsWith('[pageerror]'));
            console.log(`INFO: ${pageErrors.length} page error(s)${pageErrors.length ? `:\n  ${pageErrors.slice(0, 5).join('\n  ')}` : ''}`);
        } catch (e) {
            check(`${S}: fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`PAGE LOGS (last 30):\n${logs.slice(-30).join('\n')}`);
        }
        await page.close();
        return rp.failures();
    }
}
