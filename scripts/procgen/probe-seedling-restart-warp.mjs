#!/usr/bin/env node
/**
 * Seedling RESTART (⚖ the user, 2026-10-05: *"We already have a menu panel with a button to return to the start
 * region. We might just need to listen for this and use the existing teleport tool"*) — the Menu panel's Restart
 * warps the Seedling player back to the start, on the GAME (wasm, default build) and on the JS runtime.
 * `seedling_playthrough` loaded by `?rules=`, headless logic-only, under the box lock; every session on a FRESH page.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. the new game: the binding holds the start region, and `seedlingStartSpawn` (the binding's `startSpawn()`)
 *        is where the randomized load's reset put the player (its target) — the game's own position recorded;
 *     2. the player is moved to a non-start region (`level_13`, an AP move: the binding's arrival teleports);
 *     3. the Menu panel's Restart BUTTON is clicked: gameState reads the start region, the binding reads it, the
 *        game stands where the new game stood (level, constructor position, live position), NO location check
 *        fires, and the glue says the hop was re-taken;
 *     4. walking out of the start works: ArrowLeft from the start fires L0's west teleporter, and the binding
 *        publishes the crossing out of the start region (gameState follows);
 *     5. a Playback Bot walk interrupted by Restart: the bot walks the derived sphere queue out of the start, the
 *        Restart lands while a walk is in flight, the walk is STOPPED (the glue's `stoppedWalks`), the player is
 *        back at the start, and the bot RE-PLANS from there: it leaves the start region again (or names its
 *        refusal) within `--budget-s`. Never a silent stall.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W SKIPs.
 *
 * Run: node scripts/procgen/probe-seedling-restart-warp.mjs [--host=http://localhost:8000] [--only=W,J]
 *      [--budget-s=300] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/** The preset, by its rules file (served path relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name) and its canvas. */
const JS_PAGE = 'jsRuntime.html';
const CANVAS = { W: '#canvas', J: '#game' };

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-restart-warp.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'W,J').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '300')) * 1000;
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const SIDECARS = PRESET.preset_sidecars['1'];
    const AWAY = Object.keys(SIDECARS).find((r) => SIDECARS[r].playable_payload?.level === 13);
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
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
        const rp = createRoomPlay({ page, wasmPage: framePage, logs, name: `rw-${S}` });
        const { check, waitFor } = rp;
        const out = (tag, o) => console.log(`ROW ${S} ${tag} ${JSON.stringify(o)}`);

        /** Everything a row reads, in one page round trip: the game (either runtime), the binding, gameState. */
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
                binding: b ? { region: b.region, active: b.active, startRegion: b.startRegion, restarts: b.restarts,
                    lastLevel: b.lastLevel, startSpawn: b.startSpawn() } : null,
                game: { level: st?.level ?? null, x: st?.x ?? null, y: st?.y ?? null,
                    ctor: rs ? { level: rs.level, x: rs.playerPositionX, y: rs.playerPositionY } : null },
                stats: g ? { ...g.stats } : null,
                lastRestart: g?.lastRestart ?? null,
                checks: [...(window.__checks ?? [])],
            };
        });
        const settledAt = (pred, desc, ms = 30000) => waitFor(desc, async () => { const s = await snap(); return pred(s) ? s : null; }, ms);

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

        /** Click the Menu panel's own Restart button (the person's press). */
        async function pressRestart() {
            await page.evaluate(async () => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'menuPanel' }, 'tests');
            });
            await rp.waitFor('the Restart button is visible', () => page.evaluate(() => {
                const b = document.querySelector('.menu-panel-restart-button');
                return !!b && b.offsetParent !== null;
            }), 20000);
            await page.click('.menu-panel-restart-button');
            const t0 = Date.now();
            return t0;
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

        const sameSpot = (a, b) => a && b && a.level === b.level && a.x === b.x && a.y === b.y;

        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            if (S === 'J') await bootJs(); else await bootWasm();
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
                    if (d.__rw) continue;
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__rw = true;
                }
                return true;
            }), 20000);

            // 1. THE NEW GAME.
            const reset = await page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const r = p._apLoadResult?.reset ?? null;
                const boot = p._apLoadResult?.steps?.find((x) => x.name === 'reset-begin')?.detail?.bootPosition ?? null;
                return r ? { level: r.level, x: r.x, y: r.y, landed: r.landed, mode: r.mode, boot } : null;
            });
            const born = await settledAt((s) => s.binding?.region === START && s.game.level === 0 && s.game.x !== null,
                'the new game stands in the start region', 60000);
            await page.waitForTimeout(1500);
            const newGame = await snap();
            out('new game', { reset, ...newGame });
            const spawn = newGame.binding.startSpawn;
            check(`${S}: the binding holds the start region "${START}" and remembers it`,
                newGame.binding.region === START && newGame.binding.startRegion === START, JSON.stringify(newGame.binding));
            check(`${S}: seedlingStartSpawn IS where the randomized load's reset put the new game`,
                !!spawn && !!reset?.landed && sameSpot(spawn, reset), JSON.stringify({ spawn, reset }));
            check(`${S}: the game's constructor position is seedlingStartSpawn`, sameSpot(spawn, newGame.game.ctor),
                JSON.stringify(newGame.game));
            void born;

            // 2. AWAY: an AP move into level 13 (the binding's arrival teleports the game there).
            await page.evaluate(async ({ from, to }) => {
                const d = (await import('./modules/flashPanel/index.js')).getDispatcher();
                d.publish('user:regionMove', { sourceRegion: from, targetRegion: to, exitName: null, source: 'probe-restart-warp' },
                    { initialTarget: 'bottom' });
            }, { from: START, to: AWAY });
            const away = await settledAt((s) => s.region === AWAY && s.game.level === 13 && s.binding.region === AWAY,
                `the player in ${AWAY}`, 30000);
            await page.waitForTimeout(1000);
            out('away', await snap());
            check(`${S}: the player is in ${AWAY} (game level 13, the binding and gameState agree)`, !!away);

            // 3. RESTART.
            const before = await snap();
            await pressRestart();
            const back = await settledAt((s) => s.region === START && s.binding.region === START && s.game.level === 0
                && sameSpot(s.game.ctor, spawn), 'the Restart landed at the start', 30000).catch(() => null);
            await page.waitForTimeout(1500);
            const after = await snap();
            out('restart', { lastRestart: after.lastRestart, after, teleports: after.stats.teleports - before.stats.teleports,
                moves: (await rp.glueMoves()).slice(-3) });
            check(`${S}: Restart — gameState and the binding read the start region "${START}"`,
                after.region === START && after.binding.region === START && after.binding.active, JSON.stringify({ region: after.region, binding: after.binding }));
            check(`${S}: Restart — the game stands where the new game stood (level, constructor, live position)`,
                !!back && sameSpot(after.game.ctor, newGame.game.ctor) && after.game.x === newGame.game.x && after.game.y === newGame.game.y,
                JSON.stringify({ now: after.game, newGame: newGame.game }));
            check(`${S}: Restart — no location check fired`, after.checks.length === before.checks.length,
                JSON.stringify(after.checks.slice(before.checks.length)));
            check(`${S}: Restart — the glue re-took the start hop (one restart counted)`,
                after.lastRestart?.taken === true && after.binding.restarts === 1 && after.stats.restarts === 1,
                JSON.stringify(after.lastRestart));

            // 4. WALK OUT: west from the start fires L0's teleporter at (0, 128).
            const westTarget = PRESET.preset_sidecars['1'][START].playable_payload.exits
                .find((e) => e.entrance_tile?.[0] === 0 && e.entrance_tile?.[1] === Math.floor(spawn.y / 16))?.targetRegion ?? null;
            const walked = await holdKey('ArrowLeft', (s) => s.game.level !== 0 && s.game.level !== null, 8000);
            const outOf = walked ? await settledAt((s) => s.region !== START, 'the crossing out of the start published', 15000).catch(() => null) : null;
            out('walk out', { westTarget, walked: walked?.game ?? null, region: outOf?.region ?? null, moves: (await rp.glueMoves()).slice(-2) });
            check(`${S}: walking out of the start works — the west door crosses into "${westTarget}" and gameState follows`,
                !!outOf && outOf.region === westTarget, JSON.stringify({ region: outOf?.region, game: walked?.game }));

            // 5. A PLAYBACK BOT WALK INTERRUPTED BY RESTART (a fresh restart first, so the bot starts at the start).
            await pressRestart();
            await settledAt((s) => s.region === START && s.binding.region === START && sameSpot(s.game.ctor, spawn),
                'back at the start before the bot', 30000);
            const booted = await page.evaluate(async ({ rulesPath, start }) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                await getSphereStateSingleton().loadSphereLog('probe-seedling-restart-warp:derived', text);
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                bot.onRegionMove({ targetRegion: start });
                bot.refresh();
                bot._ensureQueueBuilt?.();
                await bot.play();
                return { ok: true, region: bot.getCurrentRegion(), status: bot.getStatus?.() ?? '' };
            }, { rulesPath: RULES_PATH, start: START });
            out('bot boot', booted);
            check(`${S}: the Playback Bot is mounted at the start`, booted.ok && booted.region === START, JSON.stringify(booted));
            const botState = () => page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                const bot = getActivePanel()?.getBot?.();
                const { getSeedlingRegionGlue } = await import('./modules/flashPanel/index.js');
                const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
                const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
                return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null,
                    busy: c?.busy?.() ?? null, glueRegion: getSeedlingRegionGlue()?.binding?.region ?? null };
            });
            const t0 = Date.now();
            // the walk leaves the start and is IN FLIGHT in another room
            const gone = await waitFor('the bot walked out of the start and is walking on', async () => {
                const b = await botState();
                if (/^error|^finished/.test(b.status)) return b;
                return b.region && b.region !== START && b.busy ? b : null;
            }, BUDGET_MS).catch(() => null);
            out('bot away', { gone, ms: Date.now() - t0 });
            check(`${S}: the bot walked out of the start and a walk is in flight`, !!gone && gone.busy === true && gone.region !== START,
                JSON.stringify(gone));
            if (gone?.busy) {
                const pre = await snap();
                await pressRestart();
                const landed = await settledAt((s) => s.region === START && s.binding.region === START && s.game.level === 0
                    && sameSpot(s.game.ctor, spawn), 'the interrupted bot\'s player back at the start', 30000).catch(() => null);
                const r = (await snap()).lastRestart;
                out('bot restart', { lastRestart: r, landed: landed?.game ?? null, bot: await botState() });
                check(`${S}: Restart mid-walk — the walk was STOPPED and the player landed at the start spawn`,
                    !!landed && r?.taken === true && r?.stoppedWalks >= 1, JSON.stringify({ r, game: landed?.game }));
                check(`${S}: Restart mid-walk — no location check fired by the warp`,
                    (landed?.checks.length ?? -1) === pre.checks.length, JSON.stringify(landed?.checks.slice(pre.checks.length)));
                const t1 = Date.now();
                const replanned = await waitFor('the bot re-plans from the start (leaves it again, or names a refusal)', async () => {
                    const b = await botState();
                    if (/^error/.test(b.status)) return b;
                    return b.region && b.region !== START ? b : null;
                }, BUDGET_MS).catch(() => null);
                out('bot replan', { replanned, ms: Date.now() - t1 });
                check(`${S}: the bot RE-PLANS from the start — it walks out of it again (or names its refusal), never a silent stall`,
                    !!replanned, JSON.stringify(replanned ?? await botState()));
                await page.evaluate(async () => {
                    const { getActivePanel } = await import('./modules/playbackBot/index.js');
                    getActivePanel()?.getBot?.()?.stop?.();
                });
            }
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s)`);
        } catch (e) {
            check(`${S}: fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`PAGE LOGS (last 30):\n${logs.slice(-30).join('\n')}`);
        }
        await page.close();
        return rp.failures();
    }
}
