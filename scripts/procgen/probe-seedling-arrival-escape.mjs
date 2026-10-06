#!/usr/bin/env node
/**
 * Seedling ARRIVAL INSIDE A SOLID → its WAY OUT (fidelity wave 6 ARRIVAL; ⚖ the user: no swing from inside) — the
 * player enters level 0 through L12's `teleporter@0,80`, whose landing (288,176) is INSIDE `breakablerock@288,176`
 * while its saved flag holds (the out-of-order arrival; the sweep's #2, `arrival-solid-edges.json`). The solver
 * refuses `arrival-inside-solid` with a `wayOut`; the runtime surfaces it by NAME, and the Playback Bot takes the
 * EXISTING Restart step (`procgenCore/restartRoute.js`, §5.29's) when the slot declares `return_to_menu`, then
 * routes on AROUND that entrance (the refusal's other arrivals). `seedling_playthrough` by `?rules=`, headless
 * logic-only, under the box lock; every session on a FRESH page.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. the new game; an AP move into `level_12__r0c19`, then the crossing `level_12__r0c19 -> level_0__r11c19`
 *        (the binding's arrival puts the game at the landing, (288,176), inside the rock);
 *     2. the bot plays the derived sphere queue from there: its first leg is refused `arrival-inside-solid` (the
 *        controller's `lastObstacle`, with a Restart in its `wayOut`);
 *     3. the bot ESCAPES: "escaping arrival-inside-solid (breakablerock@288,176 …) — Restart" in its log, the
 *        entrance avoided; the warp lands at `seedlingStartSpawn`; no check fired;
 *     4. the bot WALKS ON from the start within `--budget-s`.
 *
 *   `--flag=off` serves the same rules WITHOUT `return_to_menu`: the bot stops BY NAME (`arrival-inside-solid … this
 *   slot does not declare return_to_menu`), and no Restart is taken.
 *   `--expect=refusal` with the flag ON is the CONTROL on a tree without the consumer: the leg stops with the
 *   refusal (`arrival-inside-solid` in the bot's error), and no Restart.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W SKIPs.
 *
 * Run: node scripts/procgen/probe-seedling-arrival-escape.mjs [--host=http://localhost:8000] [--only=W,J]
 *      [--flag=on|off] [--expect=escape|refusal] [--budget-s=300] [--wait-for-box=<sec>]
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
/** The edge under test: L12's `teleporter@0,80` into level 0, landing at (288,176) inside the rock. */
export const VIA = 'level_12__r0c19';
export const INTO = 'level_0__r11c19';
export const ENTRANCE = `${VIA} -> ${INTO}`;
export const LANDING = Object.freeze({ level: 0, x: 288, y: 176 });
export const SOLID = 'breakablerock@288,176';
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name). */
const JS_PAGE = 'jsRuntime.html';

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-arrival-escape.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'W,J').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '300')) * 1000;
    const FLAG_ON = arg('flag', 'on') !== 'off';
    const EXPECT_ESCAPE = arg('expect', FLAG_ON ? 'escape' : 'refusal') === 'escape';
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
    if (!PRESET.regions['1'][VIA]?.exits?.some((x) => x.name === ENTRANCE)) {
        console.log(`FAIL: the playthrough has no exit "${ENTRANCE}"`);
        process.exit(1);
    }
    console.log(`INFO: entrance ${ENTRANCE} → L${LANDING.level} (${LANDING.x},${LANDING.y}) inside ${SOLID}; start ${START}; `
        + `return_to_menu served ${FLAG_ON ? 'ON' : 'OFF'}; expecting ${EXPECT_ESCAPE ? 'the escape' : 'the named refusal'}`);
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
        const rp = createRoomPlay({ page, wasmPage: S === 'J' ? JS_PAGE : WASM_PAGE, logs, name: `ae-${S}` });
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
                binding: b ? { region: b.region, restarts: b.restarts, startSpawn: b.startSpawn() } : null,
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
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null,
                active: bot?.isActive?.() ?? null, pending: bot?.getRestartPending?.() ?? null,
                escapes: bot?.getEscapes?.() ?? null, log: bot?.getLog?.() ?? [],
                obstacle: c?.lastObstacle ?? null };
        });
        const sameSpot = (a, b) => a && b && a.level === b.level && a.x === b.x && a.y === b.y;
        const regionMove = (from, to, exitName) => page.evaluate(async ({ f, t, x }) => {
            const d = (await import('./modules/flashPanel/index.js')).getDispatcher();
            d.publish('user:regionMove', { sourceRegion: f, targetRegion: t, exitName: x, source: 'probe-arrival-escape' },
                { initialTarget: 'bottom' });
        }, { f: from, t: to, x: exitName });

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
                    if (d.__ae) continue;
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__ae = true;
                }
                return true;
            }), 20000);

            // 1. THE NEW GAME, then IN THROUGH L12's DOOR (two AP moves; the binding's arrivals teleport the game).
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
            await regionMove(START, VIA, null);
            await settledAt((s) => s.region === VIA && s.game.level === 12, `the player in ${VIA}`, 30000);
            await page.waitForTimeout(1000);
            await regionMove(VIA, INTO, ENTRANCE);
            const inside = await settledAt((s) => s.region === INTO && s.binding.region === INTO && s.game.level === LANDING.level
                && s.game.ctor && s.game.ctor.x === LANDING.x && s.game.ctor.y === LANDING.y,
                `the player at ${INTO}'s landing (${LANDING.x},${LANDING.y})`, 30000).catch(() => null);
            await page.waitForTimeout(1000);
            const at = await snap();
            out('inside', at);
            check(`${S}: the player entered ${INTO} by "${ENTRANCE}" — the game at the landing (${LANDING.x},${LANDING.y}), inside ${SOLID}`,
                !!inside, JSON.stringify(at.game));

            // 2. THE BOT PLAYS THE SPHERE QUEUE FROM THE LANDING.
            const before = await snap();
            const booted = await page.evaluate(async ({ rulesPath, into, entrance }) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                await getSphereStateSingleton().loadSphereLog('probe-seedling-arrival-escape:derived', text);
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                // the crossing the bot would have seen (its exit is the entrance a later route must avoid)
                bot.onRegionMove({ targetRegion: into, exitName: entrance });
                bot.refresh();
                bot._ensureQueueBuilt?.();
                await bot.play();
                return { ok: true, status: bot.getStatus?.() ?? '' };
            }, { rulesPath: RULES_PATH, into: INTO, entrance: ENTRANCE });
            out('bot from the landing', booted);
            check(`${S}: the Playback Bot is mounted and walking from ${INTO}`, booted.ok, JSON.stringify(booted));

            // the first leg is refused BY NAME (`arrival-inside-solid`, a Restart in its wayOut)
            const t0 = Date.now();
            const refused = await waitFor('the first leg refused `arrival-inside-solid`', async () => {
                const b = await botState();
                if (b.obstacle?.kind === 'arrival-inside-solid') return b;
                return /arrival-inside-solid/.test(b.status) || b.log.some((l) => /arrival-inside-solid/.test(l)) ? b : null;
            }, 120000).catch(() => null);
            out('refused', { ms: Date.now() - t0, obstacle: refused?.obstacle ?? null, status: refused?.status ?? null,
                log: refused?.log?.slice(-4) ?? null });

            if (!EXPECT_ESCAPE) {
                // FLAG OFF / CONTROL: the named stop, and no Restart.
                const stopped = await waitFor('the bot stops with the refusal by name', async () => {
                    const b = await botState();
                    return /^error/.test(b.status) ? b : null;
                }, 120000).catch(() => null);
                const now = await snap();
                out('stop', { status: stopped?.status ?? null, region: now.region, restarts: now.binding.restarts, ms: Date.now() - t0 });
                check(`${S}: ${FLAG_ON ? 'CONTROL —' : 'without return_to_menu'} the bot stops by name with the refusal (arrival-inside-solid)`,
                    !!stopped && /arrival-inside-solid/.test(stopped.status), JSON.stringify(stopped?.status ?? (await botState()).status));
                if (!FLAG_ON) {
                    check(`${S}: …the stop names the way out it could not take (return_to_menu not declared)`,
                        !!stopped && /this slot does not declare return_to_menu/.test(stopped.status), JSON.stringify(stopped?.status));
                }
                check(`${S}: …and no Restart was taken (the player is still at the landing)`,
                    now.region === INTO && (now.binding.restarts ?? 0) === (before.binding.restarts ?? 0)
                        && sameSpot(now.game.ctor, LANDING), JSON.stringify({ region: now.region, restarts: now.binding.restarts, game: now.game }));
            } else {
                check(`${S}: the leg was refused BY NAME — the controller's obstacle is arrival-inside-solid on ${SOLID}, a Restart in its wayOut`,
                    refused?.obstacle?.kind === 'arrival-inside-solid' && refused.obstacle.id === SOLID
                        && (refused.obstacle.wayOut ?? []).some((w) => w.kind === 'restart'), JSON.stringify(refused?.obstacle ?? refused?.status));

                // 3. THE ESCAPE: the Restart, the entrance avoided, the warp at the start spawn.
                const landed = await settledAt((s) => s.region === START && s.binding.region === START && s.game.level === 0
                    && sameSpot(s.game.ctor, spawn), 'the escape landed at the start spawn', 60000).catch(() => null);
                const atLanding = await snap();
                const b0 = await botState();
                out('escaped', { game: atLanding.game, lastRestart: atLanding.lastRestart, escapes: b0.escapes,
                    log: b0.log.filter((l) => /escaping|restarted/.test(l)).slice(-3) });
                check(`${S}: the bot ESCAPED by its wayOut — "escaping arrival-inside-solid (${SOLID} …) — Restart" in its log`,
                    b0.log.some((l) => l.includes(`escaping arrival-inside-solid (${SOLID}`) && l.includes('— Restart')),
                    JSON.stringify(b0.log.slice(-6)));
                check(`${S}: …and remembers the entrance that landed inside ("${ENTRANCE}" avoided)`,
                    (b0.escapes?.avoided ?? []).includes(ENTRANCE), JSON.stringify(b0.escapes));
                check(`${S}: the warp settled — gameState and the binding read "${START}", the game at seedlingStartSpawn`,
                    !!landed && atLanding.lastRestart?.taken === true, JSON.stringify({ game: atLanding.game, spawn }));
                check(`${S}: no location check fired by the escape`, (landed?.checks.length ?? -1) === before.checks.length,
                    JSON.stringify(landed?.checks.slice(before.checks.length)));

                // 4. THE BOT WALKS ON FROM THE START (never back through the entrance).
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
                check(`${S}: the bot WALKS ON from the start after the escape (within ${BUDGET_MS / 1000} s)`,
                    !!walkedOn && !walkedOn.failed, JSON.stringify(walkedOn ? { status: walkedOn.status, region: walkedOn.region } : (await botState()).status));
                const b1 = await botState();
                check(`${S}: ⛔ the route never crossed "${ENTRANCE}" again`,
                    !b1.log.slice(b1.log.findIndex((l) => l.includes('escaping'))).some((l) => l.includes(`routing via "${ENTRANCE}"`)),
                    JSON.stringify(b1.log.slice(-6)));
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
