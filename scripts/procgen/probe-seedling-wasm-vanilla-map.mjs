#!/usr/bin/env node
/**
 * Seedling solver-walk, slice VANILLA MAP — the
 * Playback Bot walks `seedling_playthrough`, the VANILLA randomizer arm's world, through the name → cell map
 * `seedlingPlaybackController.realRoomPlaybackMap` derives (the arm's own placement table read off the set it
 * DELIVERED; the sidecars' exit_tiles). Default build p4e, headless logic-only, under the box lock; every
 * session on a FRESH page (the wasm game runs out of memory after ~150–170 swaps).
 *
 *   V  WASM — the playthrough loaded by `?rules=` (the `?game=` form resolves another seed with no
 *      flash_panel). The map is BOUND (arm `vanilla`, one entry per table entry, entity = the delivered
 *      room's), the controller's engine STAGES THE DELIVERED SET (not the map document), and the Playback
 *      Bot walks from the explicit start (skip-intro: no ceremony), the cold start ADOPTED — through the
 *      first rooms and checks: **0 forced re-arrivals**. The sphere log is DERIVED from the rules
 *      (`forwardSimulator.generateSphereLog`; `AP_1` ships none). How far it gets and the FIRST refusal by
 *      name are recorded (`ROW V reach`), not asserted beyond the first check: the solver's coverage of the
 *      whole playthrough is S4's census.
 *   D  WASM, ROUTED ON THE RULES' DIRECTED GRAPH. V's first refusal is the AP layer's: the playthrough rules
 *      declare no `assume_bidirectional_exits`, the proxy AUTO-DETECTS "bidirectional", and the PathFinder
 *      routes backwards through a one-way door under its forward name (§5.16). D pins the proxy's setting to
 *      `false` IN THE PAGE (a probe-side override, labelled `source: 'probe'`; no data or code changes), then:
 *      (1) the sphere queue's first goal: its route opens with a LOGICAL sub-region link, which the region
 *      binding CREDITS since §5.17 (the bot is stopped there and the reverse link credited back); (2) GREEDY
 *      door-only walks: the bot's manual `walkToLocation` to the queue location
 *      NEAREST through doors only (derived here from the rules: BFS over the `True_` sidecar-door exits), then
 *      the next from where it stands, up to `--max-checks` (default 3) — the fade waited out (§5.19), the cold
 *      start ADOPTED, each location checked once, **0 forced re-arrivals**; the first refusal by name ends it.
 *   J  ⛓ §5.18 — JS: the same preset on the JS runtime. The AP load TAKES the vanilla arm (⚖ the user,
 *      2026-10-03, "WITH THE SOLVER"): the page mounts the delivered set as REAL rooms
 *      (`jsRuntimeCore.mountedKindOf`, `botLevelSet().kind`), the reset's explicit start (skip-intro) boots
 *      level 0, and the panel binds the same vanilla map as on wasm. The browser's mount cost of the 116 rooms
 *      is measured on a FRESH runtime instance (`ROW J mount`). Then, routed on the directed graph (D's labelled
 *      probe-side override — the AP layer's bidirectional routing is the first refusal, §5.16 V), the
 *      Playback Bot walks D's greedy door-only targets: the starting house's chest (an APITEM) is checked
 *      once, the page's solver DRIVING (`solverStats`: every leg solved, the location by verb `apitem`), and
 *      the first refusal by name ends it (recorded, `ROW J reach`). ⛓ §5.19: the load holds the region glue's
 *      position watch across the mount + reset (no read inside it), and a logical move at the start is the
 *      bot's ROUTE crediting its first goal's link (`ROW J start state`); the mounted region is read before
 *      `play()`.
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
                // ⛓ §5.19 — the region the bot is MOUNTED in is read before `play()`: play starts the sphere queue,
                // whose first route may credit a logical link at once (the JS controller does, in a microtask before
                // play resolves; the wasm engine's load is async, so D read START by timing alone — measured).
                const region = bot.getCurrentRegion();
                await bot.play();
                return { ok: true, region, afterPlay: bot.getCurrentRegion() };
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
            // ⛓ §5.17 — the Sword's route opens with the LOGICAL link `level_0__r8c0 -> level_0__r1c6`, which the
            // region binding now CREDITS (it used to be refused here). Seen, the bot is stopped at once and the
            // reverse link (True_) credited back, so the door-only walks below start in START as before.
            const LINK = `${START} -> level_0__r1c6`;
            const q = await watchBot('D queue', async () => (await rp.glueMoves()).some((m) => m.exitName === LINK && m.logical),
                30000);
            const order = await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                const bot = getActivePanel()?.getBot?.();
                bot.stop?.();
                return (bot._queue ?? []).map((h) => h.locationName);
            });
            const credited = (await rp.glueMoves()).filter((m) => m.logical).map((m) => m.exitName);
            out('D queue first step', { status: q.end?.status, credited });
            check('D: the sphere queue\'s first goal opens with a logical sub-region link, and the binding CREDITS it (§5.17)',
                credited[0] === LINK && !(q.end?.status ?? '').startsWith('error'), JSON.stringify({ credited, status: q.end?.status }));
            const back = await page.evaluate(async (name) => {
                const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                for (let i = 0; i < 100 && glue.binding.region !== name.split(' -> ')[0]; i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const r = glue.creditLogicalLink(name);
                await new Promise((res) => { setTimeout(res, 500); });
                return { ...r, region: glue.binding.region };
            }, `level_0__r1c6 -> ${START}`);
            check(`D: the reverse link is credited back to ${START} before the door-only walks`, back.ok && back.region === START,
                JSON.stringify(back));
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
            // ⛓ §5.19 — no ceremony since skip-intro: the first goal can come inside the explicit start's fade, which the
            // adoption WAITS out (a transient clause); the probe's stop hands the room back, so the next goal adopts AGAIN
            // (the begin record the engine's own tape load cleared is read back) — every cold start adopted, none forced.
            check('D: every cold start ADOPTED (the fade waited out, §5.19) — 0 forced re-arrivals in total, nothing refused',
                eng.adopted >= 1 && eng.forced === 0 && Object.keys(eng.forcedBy ?? {}).length === 0 && (eng.adoptRefused ?? []).length === 0
                    && eng.hostStarts?.[0] === 'adopt',
                JSON.stringify({ adopted: eng.adopted, forced: eng.forced, forcedBy: eng.forcedBy, refused: eng.adoptRefused, hostStarts: eng.hostStarts }));
            check('D: 0 divergences, 0 recoveries (a solver DECLINE is recorded as the first refusal, not a divergence)',
                eng.divergences === 0 && eng.recoveries === 0, JSON.stringify({ d: eng.divergences, r: eng.recoveries, f: eng.failed, history: eng.history }));
        }

        /** Count `user:locationCheck` as it leaves the adapter's dispatcher (`flashBridgeAdapter.js`), into `window.__checks`. */
        const wrapDispatcher = () => page.evaluate(async () => {
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
        });

        /** J — the JS runtime takes the vanilla delivery; the solver drives its real rooms (§5.18). */
        async function runJs() {
            await page.evaluate(async () => {
                const sm = (await import('./app/core/settingsManager.js')).default;
                await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
            });
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            // ⛓ §5.19 — the region glue's logical moves (with WHY: the bot's route, or a position read) and its position
            // reads, stamped against the randomized load's position HOLD (mount + reset), installed before the load runs.
            await page.evaluate(async () => {
                const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                const w = { moves: [], reads: [], holds: [] };
                window.__startState = w;
                const move = glue._regionMove.bind(glue);
                glue._regionMove = (e) => { if (e.logical) w.moves.push({ exit: e.exitName, why: e.why ?? null }); return move(e); };
                const pos = glue.binding.onPlayerPosition.bind(glue.binding);
                glue.binding.onPlayerPosition = (p, o) => { w.reads.push({ held: !!glue._positionHold, p: [p.level, p.x, p.y] }); return pos(p, o); };
                const hold = glue.holdPositionWatch.bind(glue);
                glue.holdPositionWatch = (why) => { w.holds.push({ why, reads: w.reads.length }); return hold(why); };
                const release = glue.releasePositionWatch.bind(glue);
                glue.releasePositionWatch = () => { const h = w.holds.at(-1); if (h) h.readsAtRelease = w.reads.length; return release(); };
            });
            const surface = () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const s = p?.seedlingPlaybackSurface?.();
                const rt = s?.jsRuntime ?? null;
                return s ? JSON.parse(JSON.stringify({ transport: s.transport, arm: s.atlas?.arm ?? null, entries: s.atlas?.entries?.length ?? null,
                    apRefusal: s.apRefusal, loaded: !!p._apLoadResult, reset: p._apLoadResult?.reset ?? null,
                    levelSet: rt ? JSON.parse(rt.game.botLevelSet()) : null, level: rt?.run?.level ?? null, solverWalk: s.solverWalk })) : null;
            });
            const surf = await rp.waitFor('the JS page mounted the delivered set and the reset landed', async () => {
                const x = await surface();
                return x?.transport === 'js' && (x.apRefusal || (x.loaded && x.levelSet?.kind)) ? x : null;
            }, 120000);
            out('J surface', surf);
            check('J: on the JS runtime the AP load TAKES the vanilla arm — the map bound, no refusal',
                surf?.arm === 'vanilla' && surf.entries > 0 && surf.apRefusal === null, JSON.stringify(surf));
            check('J: the page mounted the delivered set as REAL rooms (all of them), and the explicit start booted level 0',
                surf?.levelSet?.kind === 'real' && surf.levelSet.rooms > 0 && surf.levelSet.rooms === surf.levelSet.table_levels
                    && surf.reset?.mode === 'explicit-start' && surf.reset?.landed === true && surf.level === 0,
                JSON.stringify({ levelSet: surf?.levelSet, reset: surf?.reset, level: surf?.level }));
            // ⛔ The reset of a start with no position takes the GAME's boot position (`Main.as:51`). First run of this
            // session: the page's mount reported (0, 0) and the player was sent into `tree@0,0` (§5.18, fixed in jsRuntimeCore).
            // The wiring's rule: the position the game itself booted at = the region binding's last declared spawn (here the
            // arrival into the bot's start region, before the load ran — the same rule the adopt probe's N pins on wasm).
            const boot = await page.evaluate(async () => (await import('./modules/flashPanel/index.js')).getActivePanelInstance()
                ._apLoadResult?.steps?.find((x) => x.name === 'reset-begin')?.detail?.bootPosition ?? null);
            check('J: the reset sent the GAME\'s boot position (the binding\'s declared spawn), never (0, 0); the player stands there',
                boot && surf?.reset?.x === boot.x && surf?.reset?.y === boot.y && !(boot.x === 0 && boot.y === 0)
                    && surf?.reset?.observed?.player?.x === boot.x + 8 && surf?.reset?.observed?.player?.y === boot.y + 8,
                JSON.stringify({ boot, args: [surf?.reset?.x, surf?.reset?.y], player: surf?.reset?.observed?.player }));
            // The browser's cost of the mount: the SAME chunks on a FRESH runtime instance (the live one is untouched).
            const mount = await page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const set = p._seedlingRealSet;
                const { planLevelSetChunks } = await import('./modules/seedlingDemo/levelSetValidator.js');
                const { createJsRuntime } = await import('./modules/seedlingDemo/jsRuntimeCore.js');
                const runs = [];
                for (let i = 0; i < 3; i += 1) {
                    const t0 = performance.now();
                    const { chunks } = planLevelSetChunks(set);
                    const t1 = performance.now();
                    const rt = createJsRuntime();
                    const per = chunks.map((c) => { const a = performance.now(); const ans = rt.game.botLoadLevels(JSON.stringify(c)); return [Math.round(performance.now() - a), ans]; });
                    runs.push({ planMs: Math.round(t1 - t0), mountMs: Math.round(performance.now() - t1), chunks: chunks.length,
                        lastChunkMs: per.at(-1)[0], answer: per.at(-1)[1], kind: rt.mounted?.kind ?? null, rooms: rt.mounted?.records.size ?? null });
                }
                return runs;
            });
            out('J mount', mount);
            check('J: a fresh runtime mounts the same delivered set (ok, real, every room)',
                mount.every((m) => m.answer === 'ok' && m.kind === 'real' && m.rooms === surf?.levelSet?.rooms), JSON.stringify(mount));

            const pinned = await page.evaluate(() => {
                const proxy = window.stateManagerProxy;
                proxy.getEffectiveBidirectionalSetting();
                proxy._bidirectionalDetectionCache = { assumeBidirectional: false, source: 'probe', detection: null };
                return proxy.getEffectiveBidirectionalSetting();
            });
            check('J: the proxy routes on the directed graph (the probe\'s labelled override, as D)', pinned.assumeBidirectional === false && pinned.source === 'probe',
                JSON.stringify(pinned));
            await rp.waitFor('dispatcher wrapped', wrapDispatcher, 20000);
            const booted = await startBot();
            check(`J: the bot is mounted in ${START}`, booted.ok && booted.region === START, JSON.stringify(booted));
            // ⛓ §5.19 — measured: the r1c6 this row once read was the ROUTE crediting the queue's first link (the player at the
            // explicit start), not a position read; no read may land inside the load's hold.
            const ss = await page.evaluate(() => window.__startState);
            out('J start state', { ...ss, reads: ss.reads.slice(0, 12), afterPlay: booted.afterPlay });
            check('J: the load HELD the glue\'s position watch (mount + reset) and no position was read inside it; every logical move at the start is the bot\'s ROUTE (§5.19)',
                ss.holds.length === 1 && ss.holds[0].readsAtRelease === ss.holds[0].reads && ss.reads.every((r) => !r.held)
                    && ss.moves.every((m) => m.why === 'the Playback Bot\'s route'),
                JSON.stringify({ holds: ss.holds, heldReads: ss.reads.filter((r) => r.held).length, moves: ss.moves }));
            await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                getActivePanel()?.getBot?.().stop?.();
            });
            const order = await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                return (getActivePanel()?.getBot?.()._queue ?? []).map((h) => h.locationName);
            });
            const pageStats = () => page.evaluate(async () => {
                const s = (await import('./modules/flashPanel/index.js')).getActivePanelInstance().seedlingPlaybackSurface();
                const rt = s.jsRuntime;
                const { getSeedlingRegionGlue } = await import('./modules/flashPanel/index.js');
                return JSON.parse(JSON.stringify({ solver: rt.playback.solverStats, level: rt.run?.level ?? null, deaths: rt.deaths.length,
                    collected: [...rt.collected], binding: getSeedlingRegionGlue()?.checkBinding?.stats ?? null,
                    halted: rt.halted?.message ?? null, solved: rt.events.filter((e) => e.type === 'solver' && e.solver === 'solved').map((e) => e.message) }));
            });
            const legs = [];
            let where = START;
            let refusal = null;
            const t0 = Date.now();
            while (legs.length < MAX_CHECKS && Date.now() - t0 < BUDGET_MS) {
                // eslint-disable-next-line no-await-in-loop
                const done = await page.evaluate(() => window.__checks ?? []);
                const target = nearestDoorOnlyTarget(PRESET, where, order.filter((n) => !done.includes(n)));
                out('J target', { from: where, ...target });
                if (!target) break;
                // eslint-disable-next-line no-await-in-loop
                const s0 = await pageStats();
                // eslint-disable-next-line no-await-in-loop
                await page.evaluate(async (name) => {
                    const { getActivePanel } = await import('./modules/playbackBot/index.js');
                    getActivePanel()?.getBot?.().walkToLocation(name);
                }, target.location);
                const before = done.length;
                // eslint-disable-next-line no-await-in-loop
                const w = await watchBot(`J → ${target.location}`, async () => (await page.evaluate(() => window.__checks ?? [])).length > before,
                    BUDGET_MS - (Date.now() - t0));
                // eslint-disable-next-line no-await-in-loop
                const s1 = await pageStats();
                // eslint-disable-next-line no-await-in-loop
                const after = await page.evaluate(() => window.__checks ?? []);
                legs.push({ target: target.location, doors: target.route.length, checked: after.length > before ? after.at(-1) : null,
                    seconds: w.seconds, status: w.end?.status ?? null, solves: s1.solver.solves - s0.solver.solves,
                    declines: s1.solver.declines - s0.solver.declines, lastVerbs: s1.solver.lastSolve?.verbs ?? null,
                    lastGoal: s1.solver.lastSolve?.goal?.kind ?? null, lastDecline: s1.solver.lastDecline });
                if (after.length <= before) { refusal = w.end?.status ?? s1.solver.lastDecline ?? null; break; }
                where = target.region;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(1000);
            }
            const st = await pageStats();
            const checks = await page.evaluate(() => window.__checks ?? []);
            out('J reach', { seconds: Math.round((Date.now() - t0) / 1000), legs, checks, page: st, firstRefusal: refusal });
            check('J: the bot CHECKED the starting house\'s chest (its first door-only target), each location once',
                legs[0]?.checked === legs[0]?.target && /Chest/.test(legs[0]?.target ?? '') && new Set(checks).size === checks.length,
                JSON.stringify({ legs, checks }));
            check('J: the page\'s SOLVER drove that leg — the doors solved, the apitem by verb `apitem`, nothing declined',
                legs[0]?.solves >= 2 && legs[0]?.declines === 0 && legs[0]?.lastGoal === 'collect-placement'
                    && JSON.stringify(legs[0]?.lastVerbs) === '["apitem"]', JSON.stringify(legs[0]));
            check('J: the walk never HALTED the page (a decline is the first refusal, recorded)', st.halted === null, JSON.stringify(st.halted));
        }

        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();

            if (S === 'J') await runJs();

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
                await rp.waitFor('dispatcher wrapped', wrapDispatcher, 20000);
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
