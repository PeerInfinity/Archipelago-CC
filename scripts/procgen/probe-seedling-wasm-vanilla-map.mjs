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
 *   D  WASM, ROUTED ON THE RULES' DIRECTED GRAPH. V's first refusal is the AP layer's: the playthrough rules
 *      declare no `assume_bidirectional_exits`, the proxy AUTO-DETECTS "bidirectional", and the PathFinder
 *      routes backwards through a one-way door under its forward name (§5.16). D pins the proxy's setting to
 *      `false` IN THE PAGE (a probe-side override, labelled `source: 'probe'`; no data or code changes), then:
 *      (1) the sphere queue's first goal and its refusal by name (the Sword's route opens with a LOGICAL
 *      sub-region link); (2) GREEDY door-only walks: the bot's manual `walkToLocation` to the queue location
 *      NEAREST through doors only (derived here from the rules: BFS over the `True_` sidecar-door exits), then
 *      the next from where it stands, up to `--max-checks` (default 3) — the ceremony waited out, the cold
 *      start ADOPTED, each location checked once, **0 forced re-arrivals**; the first refusal by name ends it.
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
 * Run: node scripts/procgen/probe-seedling-wasm-vanilla-map.mjs [--host=http://localhost:8000] [--only=V,D,J]
 *      [--budget-s=600] [--max-checks=3] [--wait-for-box=<sec>]
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

/**
 * D's next target, DERIVED: of `candidates` (the sphere queue's locations, in its order), the one whose
 * shortest directed route from `from` over the `True_` exits (sphere 0: no items) is SHORTEST while crossing
 * only DOORS (an exit a `flash_seedling` sidecar names, so it has tiles) — no logical sub-region link; ties
 * keep the queue's order. A location in `from` itself is a route of length 0. `{location, region, route}`
 * or null.
 */
export function nearestDoorOnlyTarget(rules, from, candidates) {
    const regions = rules.regions['1'];
    const sidecars = rules.preset_sidecars?.['1'] ?? {};
    const doors = new Set(Object.values(sidecars).flatMap((s) => (s.playable_payload?.exits ?? []).map((x) => x.exitName)).filter(Boolean));
    const regionOf = new Map(Object.entries(regions).flatMap(([r, d]) => (d.locations ?? []).map((l) => [l.name, r])));
    const routes = new Map([[from, []]]);
    const queue = [from];
    while (queue.length) {
        const at = queue.shift();
        for (const e of regions[at]?.exits ?? []) {
            if (routes.has(e.connected_region) || e.access_rule?.rule !== 'True_' || !doors.has(e.name)) continue;
            routes.set(e.connected_region, [...routes.get(at), e.name]);
            queue.push(e.connected_region);
        }
    }
    let best = null;
    for (const location of candidates) {
        const route = routes.get(regionOf.get(location));
        if (route && (!best || route.length < best.route.length)) best = { location, region: regionOf.get(location), route };
    }
    return best;
}

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
    const SESSIONS = arg('only', 'V,D,J').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '600')) * 1000;
    const MAX_CHECKS = Number(arg('max-checks', '3'));
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

        const engineStats = () => page.evaluate(async () => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            const e = c?._wasmEngine ?? null;
            if (!e) return { engine: false, lastRefusal: c?.lastRefusal ?? null };
            const st = e.stats;
            return JSON.parse(JSON.stringify({
                engine: true,
                stagesDelivered: c._wasmDelivered !== null && c._wasmDelivered === p.seedlingPlaybackSurface().wasm?.deliveredSet,
                adopted: st.adopted, forced: st.forced, forcedBy: st.forcedBy, adoptRefused: st.adoptRefused, ceremonies: st.ceremonies,
                held: st.held, continuations: st.continuations, divergences: st.divergences, recoveries: st.recoveries, failed: st.failed,
                done: st.done, hostStarts: (st.hostStarts ?? []).map((h) => h.label),
                history: (st.history ?? []).map((h) => ({ goal: h.goal?.name, level: h.goal?.level, outcome: h.outcome, producer: h.producer,
                    continuation: h.continuation ?? false, divergence: h.divergence ?? null, reason: h.reason ?? null })),
                lastRefusal: c.lastRefusal }));
        });
        /** Poll the bot's status until `until(status)` or the budget; every change is logged. */
        async function watchBot(tag, until, budgetMs) {
            const t0 = Date.now();
            const statuses = [];
            let end = null;
            while (Date.now() - t0 < budgetMs) {
                // eslint-disable-next-line no-await-in-loop
                end = await botStatus();
                if (end.status !== statuses.at(-1)?.status) {
                    statuses.push({ s: Math.round((Date.now() - t0) / 1000), status: end.status, region: end.region });
                    console.log(`INFO: ${tag} +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`);
                }
                // eslint-disable-next-line no-await-in-loop
                if (end.status.startsWith('error') || await until(end)) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            return { end, statuses, seconds: Math.round((Date.now() - t0) / 1000) };
        }

        /** V — the bot as it ships: the sphere queue, the proxy's own (auto-detected) routing. */
        async function runDefault() {
            const booted = await startBot();
            check(`V: the bot is mounted in ${START}`, booted.ok && booted.region === START, JSON.stringify(booted));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const routing = await page.evaluate(() => {
                const b = window.stateManagerProxy.getEffectiveBidirectionalSetting();
                return { assumeBidirectional: b.assumeBidirectional, source: b.source, mode: b.detection?.mode ?? null };
            });
            out('V routing', routing);
            const w = await watchBot('V', (e) => e.status.startsWith('finished'), BUDGET_MS);
            const eng = await engineStats();
            const checks = await page.evaluate(() => window.__checks ?? []);
            out('V engine', eng);
            out('V reach', { seconds: w.seconds, checks, finalStatus: w.end?.status, region: w.end?.region, statuses: w.statuses.slice(-12) });
            out('V first refusal', { status: (w.end?.status ?? '').startsWith('error') ? w.end.status : null, engineRefusal: eng?.lastRefusal ?? null });
            check('V: the walk ends FINISHED or with a NAMED refusal (never a silent stall)',
                (w.end?.status ?? '').startsWith('finished') || (w.end?.status ?? '').startsWith('error'), w.end?.status ?? '');
            if (eng.engine) check('V: the controller\'s engine STAGES THE DELIVERED SET (the rooms the game plays)', eng.stagesDelivered === true, JSON.stringify(eng.stagesDelivered));
        }

        /** D — routing pinned to the rules' directed graph (probe-side), then the sphere queue's refusal and a door-only walk. */
        async function runDirected() {
            const pinned = await page.evaluate(() => {
                const proxy = window.stateManagerProxy;
                proxy.getEffectiveBidirectionalSetting();
                proxy._bidirectionalDetectionCache = { assumeBidirectional: false, source: 'probe', detection: null };
                return proxy.getEffectiveBidirectionalSetting();
            });
            check('D: the proxy routes on the directed graph (the probe\'s labelled override)', pinned.assumeBidirectional === false && pinned.source === 'probe',
                JSON.stringify(pinned));
            const booted = await startBot();
            check(`D: the bot is mounted in ${START}`, booted.ok && booted.region === START, JSON.stringify(booted));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const q = await watchBot('D queue', () => false, 30000);
            out('D queue first refusal', { status: q.end?.status });
            check('D: the sphere queue\'s first goal is refused BY NAME — its route opens with a logical sub-region link',
                /links two sub-regions of level \d+ .* a LOGICAL link/.test(q.end?.status ?? ''), q.end?.status ?? '');
            const order = await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                const bot = getActivePanel()?.getBot?.();
                bot.stop?.();
                return (bot._queue ?? []).map((h) => h.locationName);
            });
            const legs = [];
            let where = START;
            let refusal = null;
            const t0 = Date.now();
            while (legs.length < MAX_CHECKS && Date.now() - t0 < BUDGET_MS) {
                // eslint-disable-next-line no-await-in-loop
                const done = await page.evaluate(() => window.__checks ?? []);
                const target = nearestDoorOnlyTarget(PRESET, where, order.filter((n) => !done.includes(n)));
                out('D target', { from: where, ...target });
                if (!target) break;
                // eslint-disable-next-line no-await-in-loop
                await page.evaluate(async (name) => {
                    const { getActivePanel } = await import('./modules/playbackBot/index.js');
                    getActivePanel()?.getBot?.().walkToLocation(name);
                }, target.location);
                const before = done.length;
                // eslint-disable-next-line no-await-in-loop
                const w = await watchBot(`D → ${target.location}`, async () => (await page.evaluate(() => window.__checks ?? [])).length > before,
                    BUDGET_MS - (Date.now() - t0));
                // eslint-disable-next-line no-await-in-loop
                const after = await page.evaluate(() => window.__checks ?? []);
                legs.push({ target: target.location, doors: target.route.length, checked: after.length > before ? after.at(-1) : null,
                    seconds: w.seconds, status: w.end?.status ?? null });
                if (after.length <= before) { refusal = w.end?.status ?? null; break; }
                where = target.region;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(1000);
            }
            await page.waitForTimeout(1500);
            const eng = await engineStats();
            const checks = await page.evaluate(() => window.__checks ?? []);
            const swaps = await rp.gameFrame().evaluate(() => window.__vmSwaps).catch(() => null);
            const moves = await rp.glueMoves().catch(() => null);
            out('D engine', eng);
            out('D reach', { seconds: Math.round((Date.now() - t0) / 1000), legs, checks, swaps, doors: moves?.length ?? null, firstRefusal: refusal });
            check('D: the controller\'s engine STAGES THE DELIVERED SET', eng.stagesDelivered === true, JSON.stringify(eng.stagesDelivered));
            check('D: the bot CHECKED its first door-only target, each location once',
                legs[0]?.checked === legs[0]?.target && new Set(checks).size === checks.length, JSON.stringify({ legs, checks }));
            check('D: the cold start ADOPTED through W8c\'s ceremony — 0 forced re-arrivals in total, nothing refused',
                eng.adopted === 1 && eng.forced === 0 && Object.keys(eng.forcedBy ?? {}).length === 0 && (eng.adoptRefused ?? []).length === 0
                    && eng.hostStarts?.[0] === 'adopt',
                JSON.stringify({ adopted: eng.adopted, forced: eng.forced, forcedBy: eng.forcedBy, refused: eng.adoptRefused, hostStarts: eng.hostStarts }));
            check('D: 0 divergences, 0 recoveries (a solver DECLINE is recorded as the first refusal, not a divergence)',
                eng.divergences === 0 && eng.recoveries === 0, JSON.stringify({ d: eng.divergences, r: eng.recoveries, f: eng.failed, history: eng.history }));
        }

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

            if (S === 'V' || S === 'D') {
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
                check(`${S}: the vanilla arm's map is BOUND — every location a goal or a named refusal, goals at the delivered entity`,
                    map.arm === 'vanilla' && map.entries + map.refused.length === locCount && map.entries > 0 && map.types.length === 1
                        && map.delivered && map.apRefusal === null, JSON.stringify(map));

                if (S === 'D') await runDirected();
                else await runDefault();
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
