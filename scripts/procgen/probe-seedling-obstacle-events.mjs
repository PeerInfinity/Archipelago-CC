#!/usr/bin/env node
/**
 * Seedling OBSTACLE EVENTS, LIVE — **break before first use** (⚖ the user, 2026-10-05) on both runtimes. The rules
 * carry one game-state event per saved obstacle flag (`event_kind: 'game_state'`); `L0 flag 1:
 * breakablerock@288,176 cleared` gates L12's door into level 0, whose landing (288,176) is inside the rock. This
 * probe breaks the rock in the game and reads the collector, then takes that landing with the flag set.
 * `seedling_playthrough` by `?rules=`, headless logic-only, under the box lock; every session on a FRESH page.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. the new game in the start region; the Sword granted by AP (it lands in the game). ⛔ NEVER ON REACH: with
 *        the event's region reachable and its rule held, the event is NOT collected (the game has not broken it);
 *     2. the Playback Bot walks the start room's logical link into the rock's far side, then that side's door to
 *        L12 (`walkToExit`, no route asked): the solver passes through the rock, the game BREAKS it, and the
 *        collector collects the event LIVE — the state manager holds it checked, the glue counted it, no
 *        `user:locationCheck` named it (an id-less event is never a server check);
 *     3. back through L12's door into level 0 — the landing (288,176) the rock gated: the game's readout carries
 *        the flag (wasm: the arrival read's `persistence_cleared`, which the arrival staging stages; JS: the boot's
 *        `persistence_cleared`), and the next leg from the landing is SOLVED and walked: no `arrival-inside-solid`;
 *     4. the LOAD read: a fresh collector reading the game's `botStatus` collects the event at load.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W SKIPs.
 *
 * Run: node scripts/procgen/probe-seedling-obstacle-events.mjs [--host=http://localhost:8000] [--only=W,J]
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
/** The event under test, by its stable id; the rest is read off the rules. */
export const EVENT_ID = 'flag:L0:1';
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name). */
const JS_PAGE = 'jsRuntime.html';

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-obstacle-events.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'W,J').split(',').filter(Boolean);
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const EVENT = Object.values(REGIONS).flatMap((r) => r.locations ?? []).find((l) => l.event_id === EVENT_ID);
    if (!EVENT || EVENT.event_kind !== 'game_state') {
        console.log(`FAIL: the playthrough has no game_state event ${EVENT_ID}`);
        process.exit(1);
    }
    const SIDE = EVENT.side;
    const FAR = EVENT.across[0];
    const LINK = REGIONS[SIDE].exits.find((x) => x.connected_region === FAR)?.name;
    // the far side's door out, and the gated door back in (the one whose rule names the event)
    const GATED = Object.entries(REGIONS).flatMap(([r, d]) => (d.exits ?? []).map((x) => ({ r, ...x })))
        .find((x) => x.connected_region === FAR && JSON.stringify(x.access_rule ?? null).includes(JSON.stringify(EVENT.name)));
    const VIA = GATED?.r;
    const OUT = REGIONS[FAR].exits.find((x) => x.connected_region === VIA)?.name;
    const FLAG = { level: EVENT.obstacle.level, tag: EVENT.obstacle.tag };
    const OBSTACLE = `${EVENT.obstacle.class}@${EVENT.obstacle.x},${EVENT.obstacle.y}`;
    if (!LINK || !GATED || !OUT) {
        console.log(`FAIL: ${EVENT_ID}: no link ${SIDE} -> ${FAR}, gated landing, or door out (${JSON.stringify({ LINK, GATED: GATED?.name, OUT })})`);
        process.exit(1);
    }
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
    console.log(`INFO: event "${EVENT.name}" (${EVENT_ID}) in ${SIDE}, far side ${FAR}; link "${LINK}"; door out "${OUT}"; `
        + `gated landing "${GATED.name}"`);
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
        const rp = createRoomPlay({ page, wasmPage: S === 'J' ? JS_PAGE : WASM_PAGE, logs, name: `oe-${S}` });
        const { check, waitFor } = rp;
        const out = (tag, o) => console.log(`ROW ${S} ${tag} ${JSON.stringify(o)}`);

        /** The game, the glue's collector, the state manager's view of the event, in one round trip. */
        const snap = () => page.evaluate(async (eventName) => {
            const mod = await import('./modules/flashPanel/index.js');
            const g = mod.getSeedlingRegionGlue();
            const game = g?.adapter?._getFlash?.() ?? null;
            let st = null;
            try { const raw = game?.botStatus?.(); st = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { st = null; }
            let rs = null;
            try { const raw = game?.readState?.(); rs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { rs = null; }
            const snapshot = window.stateManagerProxy?.getLatestStateSnapshot?.() ?? null;
            return {
                region: window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null,
                binding: g?.binding?.region ?? null,
                game: { level: st?.level ?? null, x: st?.x ?? null, y: st?.y ?? null, hasSword: rs?.hasSword ?? null,
                    cleared: st?.persistence_cleared ?? null },
                collector: g?.eventCollector ? { ...g.eventCollector.stats } : null,
                eventsCollected: g?.stats?.eventsCollected ?? null,
                eventChecked: (snapshot?.checkedLocations ?? []).includes(eventName),
                eventHeld: Number(snapshot?.inventory?.[eventName] ?? 0),
                checks: [...(window.__checks ?? [])],
            };
        }, EVENT.name);
        const settledAt = (pred, desc, ms = 30000) => waitFor(desc, async () => { const s = await snap(); return pred(s) ? s : null; }, ms);
        const botState = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null, log: bot?.getLog?.() ?? [],
                obstacle: c?.lastObstacle ?? null, lastRefusal: c?.lastRefusal ?? null };
        });
        const has = (cleared, f) => (cleared ?? []).some((c) => c.level === f.level && c.tag === f.tag);

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
                    if (d.__oe) continue;
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__oe = true;
                }
                return true;
            }), 20000);

            // 1. THE NEW GAME + THE SWORD; the event NOT collected on reach.
            await settledAt((s) => s.binding === START && s.game.level === 0 && s.game.x !== null, 'the new game stands in the start region', 60000);
            await page.evaluate(async () => { await window.stateManagerProxy.addItemToInventory('Progressive Sword'); });
            const armed = await settledAt((s) => s.game.hasSword === true, 'the Sword landed in the game', 30000).catch(() => null);
            await page.waitForTimeout(2000);
            const s1 = await snap();
            out('armed', s1);
            check(`${S}: the Sword landed in the game (hasSword)`, !!armed, JSON.stringify(s1.game));
            check(`${S}: the collector is wired, and its load read found the rock standing (not cleared)`,
                !!s1.collector && !has(s1.game.cleared, FLAG), JSON.stringify({ collector: s1.collector, cleared: s1.game.cleared }));
            const reach = await page.evaluate(async ({ name, side }) => {
                const snapshot = window.stateManagerProxy.getLatestStateSnapshot();
                return { sideReachable: ['reachable', 'checked', true].includes(snapshot?.regionReachability?.[side]),
                    accessible: snapshot?.locationReachability?.[name] ?? null };
            }, { name: EVENT.name, side: SIDE });
            out('reach', reach);
            check(`${S}: ⛔ NEVER ON REACH — "${EVENT.name}" sits in a reachable region with its rule held, and is NOT collected`,
                reach.sideReachable && !s1.eventChecked && s1.eventHeld === 0, JSON.stringify({ reach, checked: s1.eventChecked }));

            // 2. THE BOT WALKS THROUGH THE ROCK: the link into the far side, then its door to L12.
            const booted = await page.evaluate(async ({ start, link }) => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const b = getActivePanel()?.getBot?.();
                if (!b) return { ok: false };
                b.onRegionMove({ targetRegion: start });
                b.refresh();
                b.walkToExit(link);
                return { ok: true, status: b.getStatus() };
            }, { start: START, link: LINK });
            out('booted', booted);
            await settledAt((s) => s.binding === FAR, `the link credited (the binding in ${FAR})`, 20000).catch(() => null);
            await page.evaluate(async (exit) => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                getActivePanel()?.getBot?.()?.walkToExit(exit);
            }, OUT);
            const t0 = Date.now();
            const broke = await settledAt((s) => s.eventChecked && s.eventHeld > 0, 'the event collected LIVE (the game broke the rock)', 150000)
                .catch(() => null);
            const crossed = await settledAt((s) => s.region === VIA && s.game.level !== FLAG.level, `the walk crossed into ${VIA}`, 60000)
                .catch(() => null);
            const s2 = await snap();
            out('broke', { ms: Date.now() - t0, game: s2.game, collector: s2.collector, eventsCollected: s2.eventsCollected,
                checks: s2.checks, bot: (await botState()).status });
            check(`${S}: the game BROKE ${OBSTACLE} on the walk — its flag {${FLAG.level},${FLAG.tag}} is in persistence_cleared`,
                has(s2.game.cleared, FLAG), JSON.stringify(s2.game.cleared));
            check(`${S}: the collector collected "${EVENT.name}" LIVE (checked + its event item held in the state manager)`,
                !!broke && s2.collector?.live === 1 && s2.eventsCollected >= 1, JSON.stringify({ collector: s2.collector, eventsCollected: s2.eventsCollected }));
            check(`${S}: …as a LOCAL event check — no user:locationCheck named it`, !s2.checks.includes(EVENT.name), JSON.stringify(s2.checks));
            check(`${S}: the walk went on through the far side's door into ${VIA}`, !!crossed, JSON.stringify({ region: s2.region, level: s2.game.level }));

            // 3. BACK THROUGH THE GATED LANDING (inside the rock, had it stood).
            await page.waitForTimeout(1500);
            await page.evaluate(async (exit) => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                getActivePanel()?.getBot?.()?.walkToExit(exit);
            }, GATED.name);
            const landed = await settledAt((s) => s.region === FAR && s.game.level === FLAG.level, `back in ${FAR} through "${GATED.name}"`, 150000)
                .catch(() => null);
            await page.waitForTimeout(1500);
            const s3 = await snap();
            const reads = S === 'W' ? await page.evaluate(async () => {
                const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
                const e = substrateRegistry.get('flash_seedling')?.getPlaybackController?.()?._wasmEngine ?? null;
                return (e?.arrivalReads ?? []).map((r) => ({ level: r.status?.level, cleared: r.status?.persistence_cleared ?? null }));
            }) : null;
            out('landed', { game: s3.game, reads: reads?.slice(-2) ?? null });
            check(`${S}: the walk took "${GATED.name}" — the player in ${FAR}, level ${FLAG.level}`, !!landed, JSON.stringify({ region: s3.region, game: s3.game }));
            check(`${S}: the game's readout at the landing carries the flag (${S === 'W' ? 'the arrival read the staging stages' : 'the JS boot\'s clears'})`,
                has(s3.game.cleared, FLAG) && (S !== 'W' || reads.filter((r) => r.level === FLAG.level).some((r) => has(r.cleared, FLAG))),
                JSON.stringify({ cleared: s3.game.cleared, reads: reads?.slice(-3) }));
            // the next leg from the landing: SOLVED and walked (out through the far side's door again)
            await page.evaluate(async (exit) => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                getActivePanel()?.getBot?.()?.walkToExit(exit);
            }, OUT);
            const again = await settledAt((s) => s.region === VIA && s.game.level !== FLAG.level, `out again by "${OUT}" from the landing`, 150000)
                .catch(() => null);
            const b3 = await botState();
            out('from the landing', { region: (await snap()).region, obstacle: b3.obstacle, status: b3.status });
            check(`${S}: the leg FROM the landing is solved and walked — no arrival-inside-solid (the flag staged)`,
                !!again && b3.obstacle?.kind !== 'arrival-inside-solid' && !/arrival-inside-solid/.test(b3.status),
                JSON.stringify({ obstacle: b3.obstacle, status: b3.status }));

            // 4. THE LOAD READ: a fresh collector over the game's botStatus collects the event at load.
            const load = await page.evaluate(async () => {
                const g = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                g.eventCollector.onGameRestart();
                const effects = g.syncEventsFromGame();
                return { effects, stats: { ...g.eventCollector.stats } };
            });
            out('load read', load);
            check(`${S}: the LOAD read collects "${EVENT.name}" from the game's persistence_cleared`,
                (load.effects ?? []).some((e) => e.location === EVENT.name && e.at === 'load'), JSON.stringify(load));
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
