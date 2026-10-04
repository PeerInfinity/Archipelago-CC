#!/usr/bin/env node
/**
 * Seedling solver-walk, slice VANILLA MAP (plan `NewDocs/plans/seedling-js-solver-walk-plan.md` §5.16) — the
 * Playback Bot walks `seedling_playthrough`, the VANILLA randomizer arm's world, through the name → cell map
 * `seedlingPlaybackController.realRoomPlaybackMap` derives (the arm's own placement table read off the set it
 * DELIVERED; the sidecars' exit_tiles). Default build p4e, headless logic-only, under the box lock; every
 * session on a FRESH page (the wasm game runs out of memory after ~150–170 swaps).
 *
 *   V  WASM — the playthrough loaded by `?rules=` (the `?game=` form resolves another seed with no
 *      flash_panel). The map is BOUND (arm `vanilla`, one entry per table entry, entity = the delivered
 *      room's), the controller's engine STAGES THE DELIVERED SET (not the map document), and the Playback
 *      Bot walks from the new-game start — W8c's ceremony waited out, the cold start ADOPTED — through the
 *      first rooms and checks: **0 forced re-arrivals**. The sphere log is DERIVED from the rules
 *      (`forwardSimulator.generateSphereLog`; `AP_1` ships none). How far it gets and the FIRST refusal by
 *      name are recorded (`ROW V reach`), not asserted beyond the first check: the solver's coverage of the
 *      whole playthrough is S4's census.
 *   J  JS — the same preset on the JS runtime: the AP load REFUSES the vanilla arm by name (⚖ planner,
 *      option (a)), the panel binds no map, and the Playback Bot's first walkTo fails AT ONCE with that
 *      reason (not a 60 s hold).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-vanilla-map.mjs [--host=http://localhost:8000] [--only=V,J]
 *      [--budget-s=600] [--wait-for-box=<sec>]
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

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/** In the GAME frame: count host `new Game` pushes (the forced re-arrivals' world swaps). */
function installSwapCounter() {
    const br = window.__swfBridge;
    if (window.__vmSwaps) return true;
    const c = { hostNewGame: 0 };
    const q = br.queueItems.bind(br);
    br.queueItems = (items) => {
        for (const i of (Array.isArray(items) ? items : [items])) if (i?.invocation === 'new_instance' && i.className === 'Game') c.hostNewGame += 1;
        return q(items);
    };
    window.__vmSwaps = c;
    return true;
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-vanilla-map.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'V,J').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '600')) * 1000;
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
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
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `vm-${S}` });
        const { check } = rp;
        const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
        const panelLogTail = () => page.evaluate(() => (document.querySelector('.flash-panel-log')?.textContent ?? '')
            .split('\n').slice(-12).join(' | '));

        /** Mount the Playback Bot in START with the DERIVED sphere log, and play. */
        async function startBot() {
            await page.evaluate(async (rulesPath) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                return getSphereStateSingleton().loadSphereLog('probe-seedling-wasm-vanilla-map:derived', text);
            }, RULES_PATH);
            return page.evaluate(async (start) => {
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
                await bot.play();
                return { ok: true, region: bot.getCurrentRegion() };
            }, START);
        }
        const botStatus = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null };
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
                const surf = await rp.waitFor('the JS panel holds the AP load\'s refusal', () => page.evaluate(async () => {
                    const s = (await import('./modules/flashPanel/index.js')).getActivePanelInstance()?.seedlingPlaybackSurface?.();
                    return s?.transport === 'js' && s.apRefusal ? { transport: s.transport, atlas: s.atlas, apRefusal: s.apRefusal } : null;
                }), 120000);
                out('J surface', surf);
                check('J: on the JS runtime the AP load REFUSES the vanilla arm by name, and no map is bound',
                    surf?.atlas === null && /the JS runtime does not take/.test(surf?.apRefusal ?? ''), JSON.stringify(surf));
                const booted = await startBot();
                check(`J: the bot is mounted in ${START}`, booted.ok && booted.region === START, JSON.stringify(booted));
                const t0 = Date.now();
                let end = await botStatus();
                while (Date.now() - t0 < 20000 && !end.status.startsWith('error')) {
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(250);
                    // eslint-disable-next-line no-await-in-loop
                    end = await botStatus();
                }
                out('J bot', { ...end, ms: Date.now() - t0 });
                check('J: the bot\'s first walkTo fails AT ONCE (≪ the 60 s hold) with the load\'s own reason',
                    end.status.startsWith('error') && end.status.includes('the AP placement load bound none')
                        && end.status.includes('the JS runtime does not take') && Date.now() - t0 < 20000, end.status);
            }

            if (S === 'V') {
                await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
                await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
                await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                    const b = document.getElementById('btn-start');
                    return !!b && !b.disabled;
                }));
                await rp.gameFrame().click('#btn-start');
                await assertLogicOnlyChannel(rp.gameFrame());
                await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
                    document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
                await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
                    const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                    return !!p?._apLoadResult;
                }), 120000);
                await rp.waitFor('dispatcher wrapped', () => page.evaluate(async () => {
                    window.__checks = window.__checks ?? [];
                    const { getActivePanelInstance } = await import('./modules/flashPanel/index.js');
                    const d = getActivePanelInstance()?.adapter?.dispatcher ?? null;
                    if (!d) return false;
                    if (!d.__vm) {
                        const orig = d.publish.bind(d);
                        d.publish = (n, p, o) => {
                            if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                            return orig(n, p, o);
                        };
                        d.__vm = true;
                    }
                    return true;
                }), 20000);
                await rp.gameFrame().evaluate(installSwapCounter);
                const map = await page.evaluate(async () => {
                    const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                    const s = p.seedlingPlaybackSurface();
                    const a = s.atlas;
                    return { arm: a?.arm ?? null, entries: a?.entries?.length ?? null, refused: (a?.refused ?? []).map((r) => r.location),
                        types: [...new Set((a?.entries ?? []).map((e) => e.entityType))], links: a?.links?.length ?? null,
                        delivered: !!s.wasm?.deliveredSet, deliveredRooms: s.wasm?.deliveredSet?.rooms?.length ?? null,
                        apRefusal: s.apRefusal };
                });
                out('V map', map);
                const locCount = Object.values(REGIONS).reduce((n, r) => n + (r.locations ?? []).length, 0);
                check('V: the vanilla arm\'s map is BOUND — every location a goal or a named refusal, goals at the delivered entity',
                    map.arm === 'vanilla' && map.entries + map.refused.length === locCount && map.entries > 0 && map.types.length === 1
                        && map.delivered && map.apRefusal === null, JSON.stringify(map));

                const booted = await startBot();
                check(`V: the bot is mounted in ${START}`, booted.ok && booted.region === START, JSON.stringify(booted));
                await clickPanelTab(page, FLASH_PANEL).catch(() => null);
                const t0 = Date.now();
                const statuses = [];
                let end = null;
                while (Date.now() - t0 < BUDGET_MS) {
                    // eslint-disable-next-line no-await-in-loop
                    end = await botStatus();
                    if (end.status !== statuses.at(-1)?.status) {
                        statuses.push({ s: Math.round((Date.now() - t0) / 1000), status: end.status, region: end.region });
                        console.log(`INFO: +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`);
                    }
                    if (end.status.startsWith('finished') || end.status.startsWith('error')) break;
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(500);
                }
                const eng = await page.evaluate(async () => {
                    const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
                    const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
                    const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                    const e = c?._wasmEngine ?? null;
                    if (!e) return null;
                    const st = e.stats;
                    return JSON.parse(JSON.stringify({
                        stagesDelivered: c._wasmDelivered !== null && c._wasmDelivered === p.seedlingPlaybackSurface().wasm?.deliveredSet,
                        adopted: st.adopted, forced: st.forced, forcedBy: st.forcedBy, adoptRefused: st.adoptRefused, ceremonies: st.ceremonies,
                        held: st.held, continuations: st.continuations, divergences: st.divergences, recoveries: st.recoveries, failed: st.failed,
                        done: st.done, hostStarts: (st.hostStarts ?? []).map((h) => h.label),
                        history: (st.history ?? []).map((h) => ({ goal: h.goal?.name, level: h.goal?.level, outcome: h.outcome, producer: h.producer,
                            continuation: h.continuation ?? false, divergence: h.divergence ?? null, reason: h.reason ?? null })),
                        lastRefusal: c.lastRefusal }));
                });
                const swaps = await rp.gameFrame().evaluate(() => window.__vmSwaps).catch(() => null);
                const checks = await page.evaluate(() => window.__checks ?? []);
                out('V engine', eng);
                out('V reach', { seconds: Math.round((Date.now() - t0) / 1000), checks, finalStatus: end?.status, region: end?.region,
                    swaps, statuses: statuses.slice(-12) });
                check('V: the controller\'s engine STAGES THE DELIVERED SET (the rooms the game plays)', eng?.stagesDelivered === true, JSON.stringify(eng?.stagesDelivered));
                check('V: the cold start ADOPTED through W8c\'s ceremony — 0 forced re-arrivals in total',
                    eng?.adopted >= 1 && eng.forced === 0 && Object.keys(eng.forcedBy ?? {}).length === 0,
                    JSON.stringify({ adopted: eng?.adopted, forced: eng?.forced, forcedBy: eng?.forcedBy, refused: eng?.adoptRefused }));
                check('V: the bot CHECKED at least one location of the playthrough (each check once)',
                    checks.length >= 1 && new Set(checks).size === checks.length, JSON.stringify(checks));
                const firstRefusal = (end?.status ?? '').startsWith('error') ? end.status : null;
                out('V first refusal', { status: firstRefusal, engineRefusal: eng?.lastRefusal ?? null });
            }
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
        } catch (e) {
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`INFO: panel log: ${await panelLogTail().catch(() => '?')}`);
        }
        await page.close();
        return rp.failures();
    }
}
