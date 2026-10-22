#!/usr/bin/env node
/**
 * Seedling solver-walk §5.17 — LOGICAL SUB-REGION LINKS on the wasm runtime.
 * `seedling_playthrough` loaded by `?rules=`, default build
 * p4f, headless logic-only, under the box lock; every session on a FRESH page.
 *
 *   H  A HUMAN WALK (no bot): keys pressed on the game canvas, the region glue reading the position. From a
 *      tile of `level_0__r8c0` the player walks west through the pond into `level_0__r14c0` and back (the
 *      tiles DERIVED from the committed partition: a row where the two sub-regions face each other across
 *      tiles of neither). First WITHOUT the link's item (`Progressive Swim`): no move, however far the
 *      player gets. Then WITH it: exactly ONE logical `user:regionMove` each way, `logical: true`, no
 *      teleport, and gameState's region follows.
 *   B  THE PLAYBACK BOT on the rules' DIRECTED graph (the rules DECLARE `exporter["1"].assume_bidirectional_exits:
 *      false` since `9a35ad8989`: the proxy's source reads `explicit`, no in-page override): the sphere queue's
 *      first goal (the Sword, level 10) in 9 hops through DOORS ONLY — since the rules' logical-links recompile
 *      (`ce1cba867a`) L0's stairs bind to r8c0 and the model-sealed `level_0__r8c0 -> level_0__r1c6` link is
 *      gone, so the route opens with `level_0__r8c0 -> level_2` and nothing is credited at r1c6. The Sword
 *      CHECKED, and the walk continues to the next named refusal (`ROW B reach`), within `--budget-s`. ⚠ On a base without fidelity F4 (the sandtraps' arrow death) the solver declines
 *      L8 → L9 by name before the Sword; the check accepts exactly that decline there.
 *      ⛓ ANYTIME (solver-walk anytime): every solver leg is named by the PASS that made its plan (`dashless` / `full`), and
 *      0 divergences. ⛓ DETERMINISTIC BUDGET: the budgets are WORK units, the same on every machine.
 *      `--solver-budget-work=<units>` sets the wasm solve budget through its setting
 *      (`flashPanel.seedlingWasmSolverBudgetWork`, session-only) and checks the engine runs under it: a short
 *      budget makes the sword legs whose full search is long PLAY their dashless plan (the live witness that
 *      a dashless plan plays on plan on the game). `--solver-upgrade-window-work=<units>` sets the upgrade
 *      window the same way (`flashPanel.seedlingSolverUpgradeWindowWork`, session-only; absent = the
 *      default, `SOLVER_UPGRADE_WINDOW_WORK`, checked too): once a plan is in hand the full pass's dash
 *      search stops at it, and the pass returns a plan (a partial dash schedule, or dashless). Every leg whose
 *      pass tripped is listed by the site that tripped first and the bound that tripped (`ROW B passes` →
 *      `deadlines`), and checked to play on plan (0 divergences); 0 backstops.
 *      A Restart B takes in its budget is checked as R's is (since rope events it takes none: R is the subject).
 *   R  THE FORCED RESTART (§5.125) — the restart-hold check's GUARANTEED subject: the new game, an AP move into a
 *      Restart-only pocket (`--pocket=`, default `level_17`, probe-seedling-restart-route.mjs's), the bot plays from
 *      there, its route BEGINS with RESTART, and it walks on from the start. The Restart is TAKEN (else a hard FAIL),
 *      and its start-hop arrival is HELD: ≥ 1 expected arrival, each ends `held`, 0 `no-held-arrival` fallbacks.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-logical-links.mjs [--host=http://localhost:8000] [--only=H,B,R]
 *      [--budget-s=900] [--pocket=level_17] [--restart-budget-s=300] [--solver-budget-work=<units>] [--solver-upgrade-window-work=<units>] [--wait-for-box=<sec>]
 *      [--trace=<file>]   (B: every shipped tape + botHold, the deliveries, the history — the arrival-jitter instrument)
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

/**
 * H's crossing, DERIVED from the partition: the first row of `level` where a tile of `from` and a tile of
 * `to` face each other with only no-sub-region tiles ('.') between them, every one of them `walkable`
 * (`(x, y) → bool`: the model's flood, so a pole between the two is not a way across).
 * `{row, fromTile, toTile, dir}` (tiles `[x, y]`; `dir` the arrow from `from` towards `to`) or null.
 */
export function facingTiles(partitionRegion, from, to, walkable = () => true) {
    const ch = (s) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[partitionRegion.sub_regions.indexOf(s)];
    const a = ch(from);
    const b = ch(to);
    for (const [y, row] of partitionRegion.rows.entries()) {
        for (const m of row.matchAll(new RegExp(`${b}\\.+${a}|${a}\\.+${b}`, 'g'))) {
            const left = m[0][0];
            const lx = m.index;
            const rx = m.index + m[0].length - 1;
            const [fx, tx] = left === a ? [lx, rx] : [rx, lx];
            const o = partitionRegion.origin;
            let clear = true;
            for (let x = lx; x <= rx; x += 1) clear = clear && walkable(x + o[0], y + o[1]);
            if (!clear) continue;
            return { row: y + o[1], fromTile: [fx + o[0], y + o[1]], toTile: [tx + o[0], y + o[1]],
                dir: tx < fx ? 'ArrowLeft' : 'ArrowRight' };
        }
    }
    return null;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-logical-links.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'H,B,R').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '900')) * 1000;
    const SOLVER_BUDGET_WORK = arg('solver-budget-work', null) === null ? null : Number(arg('solver-budget-work', null));
    const UPGRADE_WINDOW_WORK = arg('solver-upgrade-window-work', null) === null ? null : Number(arg('solver-upgrade-window-work', null));
    /** ⛓ ARRIVAL JITTER — `--trace=<file>`: every tape the engine ships (its staging + keys), every botHold, the deliveries and the history, as JSON. */
    const TRACE = arg('trace', null);
    /** R — the Restart-only pocket the forced Restart leaves from, and R's budget for the Restart and the walk on. */
    const POCKET = arg('pocket', 'level_17');
    const RESTART_BUDGET_MS = Number(arg('restart-budget-s', '300')) * 1000;
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const PARTITION = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-subregion-partition.json'), 'utf8'));
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
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
        // ⛓ ARRIVAL JITTER — `--trace`: every solve the page posts to a Worker (the request, room records once) and
        // every answer it gets back, so a run's solves can be replayed off the page.
        if (TRACE && S === 'B') {
            await page.addInitScript(() => {
                const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v)));
                const log = [];
                window.__solveLog = log;
                const W = window.Worker;
                let n = 0;
                window.Worker = class extends W {
                    constructor(url, opts) {
                        super(url, opts);
                        const w = (n += 1);
                        log.push({ t: 'new', w, at: Math.round(performance.now()) });
                        this.addEventListener('message', (e) => {
                            const m = e.data;
                            if (m?.type !== 'pass' && m?.type !== 'result') return;
                            log.push({ t: m.type, w, id: m.id, at: Math.round(performance.now()), msg: plain(m) });
                        });
                        this.__w = w;
                    }
                    postMessage(m, ...rest) {
                        if (m?.type === 'solve') log.push({ t: 'solve', w: this.__w, id: m.id, at: Math.round(performance.now()), request: plain(m.request) });
                        return super.postMessage(m, ...rest);
                    }
                    terminate() { log.push({ t: 'terminate', w: this.__w, at: Math.round(performance.now()) }); return super.terminate(); }
                };
            });
        }
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `ll-${S}` });
        const { check } = rp;
        const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
        const panelLogTail = () => page.evaluate(() => (document.querySelector('.flash-panel-log')?.textContent ?? '')
            .split('\n').slice(-12).join(' | '));
        const glue = () => page.evaluate(async () => {
            const g = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            const b = g.binding;
            return { region: b.region, physicalSub: b.physicalSub, subRegions: !!b.subRegions, logicalMoves: b.logicalMoves,
                stats: { ...g.stats } };
        });
        const tileOf = (p) => (p ? [Math.floor(p.x / 16), Math.floor(p.y / 16)] : null);

        /** H — a person's keys across a seam. */
        async function runHuman() {
            const entry = PARTITION.atlases[slotBlockOf(PRESET, 'region_atlas')?.atlas_id].regions.level_0;
            // The model's own flood from the start (every solid live; water is not solid) — the tiles a body fits.
            const MAP_DOC = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
            const { walkableCellsFrom } = await import('../../frontend/modules/seedlingDemo/levelSetExits.js');
            const L0 = MAP_DOC.levels.find((l) => l.level === 0);
            // Flooded from the first tile of r8c0 (the start's sub-region).
            const d = entry.sub_regions.indexOf('r8c0');
            const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[d];
            const fy = entry.rows.findIndex((r) => r.includes(ch));
            const flood = walkableCellsFrom(L0, { tx: entry.rows[fy].indexOf(ch) + entry.origin[0], ty: fy + entry.origin[1] });
            const cross = facingTiles(entry, 'r8c0', 'r14c0', (x, y) => flood.has(`${x},${y}`));
            out('H crossing', cross);
            check('H: the partition has a row where r8c0 and r14c0 face each other', !!cross, JSON.stringify(cross));
            if (!cross) return;
            const g0 = await rp.waitFor('the binding holds the start sub-region and the sub-region map', async () => {
                const g = await glue();
                return g.region === START && g.subRegions ? g : null;
            }, 60000);
            out('H start', g0);
            const back = cross.dir === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
            const centre = ([tx, ty]) => ({ x: tx * 16 + 8, y: ty * 16 + 8 });
            const trace = [];
            const reach = async (key, tile, ceilingMs) => rp.holdUntil(key, async () => {
                const p = await rp.livePlayer();
                const t = tileOf(p);
                if (p && JSON.stringify(trace.at(-1)?.t) !== JSON.stringify(t)) trace.push({ key, t, p });
                return t && t[0] === tile[0] && t[1] === tile[1] ? t : null;
            }, ceilingMs);
            /**
             * Put the player on `tile`: a `new Game(0, x, y)` spawn is not the entity's centre, so the first jump
             * MEASURES the offset (live − asked) and a second one corrects it. `{asked, live, offset}`.
             */
            const standOn = async (tile) => {
                const want = centre(tile);
                await rp.jump(0, want.x, want.y);
                await page.waitForTimeout(1500);
                const live = await rp.livePlayer();
                const off = { x: (live?.x ?? want.x) - want.x, y: (live?.y ?? want.y) - want.y };
                if (JSON.stringify(tileOf(live)) !== JSON.stringify(tile)) {
                    await rp.jump(0, want.x - off.x, want.y - off.y);
                    await page.waitForTimeout(1500);
                }
                const at = await rp.livePlayer();
                return { asked: want, firstLive: live, offset: off, at, tile: tileOf(at) };
            };
            const movesNow = async () => (await rp.glueMoves()).map((m) => ({ from: m.sourceRegion, to: m.targetRegion,
                exit: m.exitName, logical: m.logical === true }));

            // 0. The new game's ceremony (this base has no skip-intro: §5.15's cutscene, then Help(2)'s freeze
            //    until an arrow): waited out with the engine's own reading (`wasmPlayback.newGameCeremony`), the
            //    Help dismissed by ONE arrow pair, then two quiet reads. A no-op once the intro is skipped.
            const { newGameCeremony } = await import('../../frontend/modules/seedlingDemo/wasmPlayback.js');
            const ceremony = { seen: [], dismissed: 0, ms: 0 };
            const c0 = Date.now();
            await rp.focusGame();
            for (let quiet = 0; quiet < 2 && Date.now() - c0 < 180000;) {
                // eslint-disable-next-line no-await-in-loop
                const st = JSON.parse(await rp.gameFrame().evaluate(() => window.__swfBridge.game.botStatus()));
                // eslint-disable-next-line no-await-in-loop
                const what = newGameCeremony({ status: st, state: await rp.readGameState() });
                if (what && ceremony.seen.at(-1) !== what) ceremony.seen.push(what);
                quiet = what ? 0 : quiet + 1;
                if (what === 'tutorial' && ceremony.dismissed === 0) {
                    ceremony.dismissed += 1;
                    // eslint-disable-next-line no-await-in-loop
                    await page.keyboard.down('ArrowRight');
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(100);
                    // eslint-disable-next-line no-await-in-loop
                    await page.keyboard.up('ArrowRight');
                }
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            ceremony.ms = Date.now() - c0;
            out('H ceremony', ceremony);

            // 1. WITHOUT the item.
            const stood = await standOn(cross.fromTile);
            out('H stand', stood);
            check('H: the player stands on the crossing\'s r8c0 tile', JSON.stringify(stood.tile) === JSON.stringify(cross.fromTile),
                JSON.stringify(stood));
            await rp.focusGame();
            const before = await movesNow();
            const dry = await reach(cross.dir, cross.toTile, 4000);
            await page.waitForTimeout(1000);
            const dryMoves = (await movesNow()).slice(before.length);
            const gDry = await glue();
            out('H without the item', { reached: dry.value, at: tileOf(await rp.livePlayer()), moves: dryMoves, glue: gDry,
                trace: trace.splice(0).map((x) => x.t) });
            check('H: WITHOUT Progressive Swim no logical move is credited, wherever the player got',
                dryMoves.length === 0 && gDry.region === START, JSON.stringify({ dryMoves, region: gDry.region }));

            // 2. WITH the item.
            await page.evaluate(async () => {
                const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
                await proxy.addItemToInventory('Progressive Swim');
            });
            await rp.waitFor('the game can swim', async () => ((await rp.readGameState()).canSwim === true ? true : null), 20000);
            out('H stand again', await standOn(cross.fromTile));
            const g1 = await glue();
            check('H: back on r8c0 after the jump, the AP region unmoved', g1.region === START, JSON.stringify(g1));
            await rp.focusGame();
            const base = (await movesNow()).length;
            const teleports0 = g1.stats.teleports;
            const over = await reach(cross.dir, cross.toTile, 6000);
            await page.waitForTimeout(1000);
            const gOver = await glue();
            const region1 = await rp.currentRegion();
            const ret = await reach(back, cross.fromTile, 6000);
            await page.waitForTimeout(1000);
            const gBack = await glue();
            const region2 = await rp.currentRegion();
            const wet = (await movesNow()).slice(base);
            out('H with the item', { over: over.value, back: ret.value, moves: wet, gameState: [region1, region2],
                trace: trace.splice(0).map((x) => `${x.key[5]}${x.t}`),
                glue: gBack, teleports: gBack.stats.teleports - teleports0, positionReads: gBack.stats.positionReads });
            const OUT = 'level_0__r14c0';
            check('H: the walk reached the other sub-region and came back', !!over.value && !!ret.value,
                JSON.stringify({ over: over.value, back: ret.value }));
            check('H: exactly ONE logical move each way (no double moves, no flicker at the seam)',
                wet.length === 2 && wet[0].from === START && wet[0].to === OUT && wet[1].from === OUT && wet[1].to === START
                    && wet.every((m) => m.logical), JSON.stringify(wet));
            check('H: gameState\'s region followed both moves', region1 === OUT && region2 === START,
                JSON.stringify([region1, region2]));
            check('H: the glue teleported nobody (a logical region load is not an arrival)',
                gBack.stats.teleports === teleports0 && gOver.region === OUT, JSON.stringify({ t0: teleports0, t: gBack.stats.teleports }));
        }

        /**
         * Mount the Playback Bot in `start` (default START) with the DERIVED sphere log, and play. R (`start` ≠ START)
         * also reads the planner's own route out of `start` before anything moves (`plan`: its kind and first steps).
         */
        async function startBot(start = START) {
            await page.evaluate(async (rulesPath) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                return getSphereStateSingleton().loadSphereLog('probe-seedling-wasm-logical-links:derived', text);
            }, RULES_PATH);
            return page.evaluate(async ({ start, planOut }) => {
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
                const head = bot._queue?.[0] ?? null;
                const route = head ? bot._pathFinder?.findPath?.(start, head.regionName) ?? null : null;
                let plan;
                if (planOut) {
                    // probe-seedling-restart-route.mjs's read: the cursor's head, then the planner's route to it.
                    bot._seedCheckedFromSnapshot?.();
                    bot._advanceCursor?.();
                    const cur = bot._queue?.[bot._cursor] ?? null;
                    await window.stateManagerProxy?.pingWorker?.('probe-logical-links-R');
                    const p = cur && typeof bot._planRoute === 'function' ? bot._planRoute(start, cur.regionName) : null;
                    plan = { goal: cur?.regionName ?? null, kind: p?.kind ?? null, why: p?.why ?? null, firstSteps: p?.route?.steps?.slice(0, 3) ?? null };
                }
                await bot.play();
                return { ok: true, region: bot.getCurrentRegion(), head: head && { location: head.locationName, region: head.regionName },
                    route, ...(planOut ? { plan } : {}) };
            }, { start, planOut: start !== START });
        }
        const botStatus = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null,
                // ⛓ WALK IDENTITY — the Restarts that waited for their leg's end
                restartDeferrals: bot?.getRestartDeferrals?.() ?? null };
        });
        const engineStats = () => page.evaluate(async () => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            const e = c?._wasmEngine ?? null;
            if (!e) return { engine: false, lastRefusal: c?.lastRefusal ?? null };
            const st = e.stats;
            return JSON.parse(JSON.stringify({
                engine: true, adopted: st.adopted, forced: st.forced,
                // ⛓ WALK IDENTITY — each adoption put on the live clock, and every plan ship's clock gap
                adoptClock: st.adoptClock ?? null, shipGaps: (st.shipClock ?? []).map((r) => r.gap), forcedBy: st.forcedBy, adoptRefused: st.adoptRefused,
                // ⛓ RESTART HOLD — the expected arrivals (a Restart's start hop) and the watch's rows around each
                expectedArrivals: st.expectedArrivals ?? null, arrivalWatch: st.arrivalWatch ?? null,
                // ⛓ CROSS-LEVEL END — location legs ending in another level, the goals held behind them, the bot's self-checks
                crossLevelEnds: st.crossLevelEnds ?? null, staleGoals: st.staleGoals ?? null, selfChecks: st.selfChecks ?? null,
                held: st.held, continuations: st.continuations, divergences: st.divergences, recoveries: st.recoveries,
                failed: st.failed, done: st.done, hostStarts: (st.hostStarts ?? []).map((h) => h.label),
                // ⛓ ANYTIME — the budget the engine solves under, its expiries / provisional plays / held retries
                budgetWork: e.budgetWork, upgradeWindowWork: e.upgradeWindowWork ?? null, backstopMs: e.backstopMs, backstops: st.backstops,
                expiries: st.expiries, provisionalPlays: st.provisionalPlays, retries: st.retries, passes: st.passes,
                history: (st.history ?? []).map((h) => ({ goal: h.goal?.name, level: h.goal?.level, outcome: h.outcome,
                    reason: h.reason ?? null, producer: h.producer ?? null, pass: h.pass ?? null, expired: h.expired ?? null,
                    retries: h.retries ?? null, deadline: h.deadline?.first ?? null,
                    tripped: (h.passes ?? []).filter((r) => r.deadline).map((r) => `${r.pass}:${r.deadline}${r.limit ? `@${r.limit}` : ''}`),
                    work: (h.passes ?? []).map((r) => r.work ?? null), ticks: h.ticks ?? null, verbs: h.verbs ?? null, divergence: h.divergence ?? null })),
                lastRefusal: c.lastRefusal }));
        });

        /**
         * ⛓ ARRIVAL JITTER — wrap the bridge's tape verbs in the game's window: each `botLoadTape` keeps its tape
         * (the staging the engine shipped), each `botHold` its argument, with the page clock. Nothing is read from
         * the game (a `botStatus` per call would perturb the frame rate it measures).
         */
        async function installTrace() {
            const n = await rp.gameFrame().evaluate(() => {
                const g = window.__swfBridge.game;
                if (g.__trace) return -1;
                const log = [];
                g.__trace = log;
                for (const verb of ['botLoadTape', 'botStart', 'botHold', 'botReset']) {
                    const orig = g[verb].bind(g);
                    g[verb] = (...a) => {
                        const r = orig(...a);
                        log.push({ verb, at: Math.round(performance.now()), arg: verb === 'botLoadTape' ? JSON.parse(a[0]) : (a[0] ?? null), r });
                        return r;
                    };
                }
                return 0;
            });
            out('B trace', { installed: n === 0 });
        }
        async function writeTrace() {
            const verbs = await rp.gameFrame().evaluate(() => window.__swfBridge.game.__trace ?? null);
            // ⛓ DELIVERY DEFERRAL — the game's own readout when the walk ends (level, place, hold / tape state)
            const game = await rp.gameFrame().evaluate(() => {
                try { const r = window.__swfBridge.game.botStatus(); return typeof r === 'string' ? JSON.parse(r) : r; } catch (err) { return { error: String(err?.message ?? err) }; }
            }).catch((err) => ({ error: String(err?.message ?? err) }));
            const eng = await page.evaluate(async () => {
                const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
                const e = substrateRegistry.get('flash_seedling')?.getPlaybackController?.()?._wasmEngine ?? null;
                if (!e) return null;
                const st = e.stats;
                return JSON.parse(JSON.stringify({ swapPushes: st.swapPushes, shipClock: st.shipClock, deliveries: st.deliveries, deliveryDeferred: st.deliveryDeferred, holdBlocked: st.holdBlocked,
                    fallbacks: st.fallbacks, forcedBy: st.forcedBy, adoptClock: st.adoptClock ?? null,
                    // ⛓ DELIVERY TICK — each self-check the next goal waited on, and the deliveries the game already showed
                    selfChecks: st.selfChecks ?? null, deliveryInGame: st.deliveryInGame ?? null, arrivalWatch: st.arrivalWatch ?? null, heldChecks: st.heldChecks, adoptRefused: st.adoptRefused,
                    history: st.history.map((h) => ({ ...h, goal: { name: h.goal?.name ?? null, kind: h.goal?.kind ?? null, level: h.goal?.level ?? null } })),
                    arrivalReads: e.arrivalReads, timeline: st.timeline ?? null, crossLevelEnds: st.crossLevelEnds ?? null, staleGoals: st.staleGoals ?? null,
                    // ⛓ DELIVERY DEFERRAL — where the engine stands when the walk ends (its phase, held room, gate)
                    status: e.status?.() ?? null }));
            });
            const solves = await page.evaluate(() => window.__solveLog ?? null);
            // ⛓ WALK IDENTITY — the glue's Restart decisions and the start-hop pushes they made
            const restartGlue = await page.evaluate(async () => {
                const g = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                return JSON.parse(JSON.stringify({ lastRestart: g?.lastRestart ?? null, restartPushes: g?.stats?.restartPushes ?? null }));
            });
            const { writeFileSync, mkdirSync } = await import('node:fs');
            mkdirSync(dirname(TRACE), { recursive: true });
            const bot = await botStatus();
            writeFileSync(TRACE, JSON.stringify({ verbs, engine: eng, game, solves, restartDeferrals: bot.restartDeferrals, restartGlue }));
            out('B trace written', { file: TRACE, verbs: verbs?.length ?? null, tapes: (verbs ?? []).filter((v) => v.verb === 'botLoadTape').length,
                solves: (solves ?? []).filter((x) => x.t === 'solve').length, workers: (solves ?? []).filter((x) => x.t === 'new').length });
            out('B self-checks', (eng?.selfChecks ?? []).map((r) => ({ location: r.location, tick: r.tick, settled: r.settled, delivered: r.delivered, waitedMs: r.waitedMs })));
        }

        /**
         * ⛓ RESTART HOLD — every Restart's start-hop arrival is HELD: no `no-held-arrival` fallback, at least one
         * expected arrival, and each expected arrival ends in a `held` row (measured before the fix: 3/10 runs fell back
         * at the L19 Restart, whose route opens on a logical link, so its goal came in the landing's own turn and the
         * watch was re-based over the landing). ⛔ An empty set is a FAIL here (expectedArrivals ≥ 1, held ≥ 1).
         */
        function restartHeld(tag, eng) {
            const rows = eng.arrivalWatch ?? [];
            const expect = rows.filter((r) => r.at === 'expect').length;
            const held = rows.filter((r) => r.at === 'held').length;
            check(`${tag}: every Restart's start-hop arrival is HELD (0 \`no-held-arrival\` fallbacks; ≥ 1 expected arrival, each ends \`held\`)`,
                !(eng.forcedBy?.['no-held-arrival'] > 0) && (eng.expectedArrivals ?? 0) >= 1 && expect >= 1 && expect === held,
                JSON.stringify({ forcedBy: eng.forcedBy, expectedArrivals: eng.expectedArrivals, expect, held, rows: rows.map((r) => r.at) }));
        }

        /**
         * R — THE FORCED RESTART (§5.125): the restart-hold check's GUARANTEED subject. The new game at the start, an AP
         * move into a Restart-only pocket (`--pocket=`, default `level_17`: probe-seedling-restart-route.mjs's pocket, whose
         * planner route BEGINS with RESTART on a fresh game), then the bot plays the derived sphere queue from there: it
         * takes the Menu panel's Restart (nothing playing, so in that turn), the glue stops the engines and EXPECTS the
         * start hop's arrival, and the bot walks on from the start. Deterministic: a fresh page, a fixed pocket, a fresh
         * game's inventory; no wall-clock trigger. A Restart that is not taken is a hard FAIL, never a skip.
         */
        async function runRestart() {
            await rp.waitFor('the new game stands in the start region', async () => {
                const g = await glue();
                return g.region === START && (await rp.currentRegion()) === START ? g : null;
            }, 60000);
            await page.waitForTimeout(1500);
            await page.evaluate(async ({ from, to }) => {
                const d = (await import('./modules/flashPanel/index.js')).getDispatcher();
                d.publish('user:regionMove', { sourceRegion: from, targetRegion: to, exitName: null, source: 'probe-logical-links-R' },
                    { initialTarget: 'bottom' });
            }, { from: START, to: POCKET });
            const inPocket = await rp.waitFor(`the player in ${POCKET}`, async () => {
                const g = await glue();
                return g.region === POCKET && (await rp.currentRegion()) === POCKET ? g : null;
            }, 30000).catch(() => null);
            await page.waitForTimeout(1000);
            check(`R: the player is in the pocket ${POCKET} (the binding and gameState agree)`, !!inPocket, JSON.stringify(await glue()));
            const booted = await startBot(POCKET);
            out('R boot', booted);
            check(`R: the bot is mounted in ${POCKET} and its route out BEGINS with RESTART (no walk out of the pocket)`,
                booted.ok && booted.region === POCKET && booted.plan?.kind === 'restart' && booted.plan?.firstSteps?.[1]?.restart === true,
                JSON.stringify(booted));
            const t0 = Date.now();
            const walked = await rp.waitFor('the bot walks on from the start after the Restart', async () => {
                const b = await botStatus();
                if (b.status.startsWith('error')) return b;
                const restart = await page.evaluate(async () => (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue()?.lastRestart ?? null);
                return restart?.taken && b.region && ![POCKET, START, 'Menu'].includes(b.region) ? { ...b, restart } : null;
            }, RESTART_BUDGET_MS).catch(() => null);
            const end = await botStatus();
            const eng = await engineStats();
            const g = await page.evaluate(async () => {
                const gl = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                return JSON.parse(JSON.stringify({ lastRestart: gl?.lastRestart ?? null, restarts: gl?.stats?.restarts ?? null,
                    restartPushes: gl?.stats?.restartPushes ?? null }));
            });
            const moves = (await rp.glueMoves()).map((m) => `${m.logical ? '~' : ''}${m.exitName}`);
            out('R engine', { expectedArrivals: eng.expectedArrivals, arrivalWatch: eng.arrivalWatch, forcedBy: eng.forcedBy,
                held: eng.held, divergences: eng.divergences, history: eng.history, lastRefusal: eng.lastRefusal });
            out('R walk', { seconds: Math.round((Date.now() - t0) / 1000), status: end.status, region: end.region, restartDeferrals: end.restartDeferrals,
                glue: g, moves });
            // ⛔ The SUBJECT: a Restart not taken is a hard FAIL (the check below would otherwise read an empty set).
            check(`R: the bot TOOK the Restart out of ${POCKET} (the glue's Restart was taken and the start hop pushed)`,
                g.lastRestart?.taken === true && (g.restarts ?? 0) >= 1, JSON.stringify(g));
            check('R: the bot walks on from the start after the Restart (a region past the start, no error)',
                !!walked && !walked.status.startsWith('error'), JSON.stringify(walked ?? end));
            restartHeld('R', eng);
            check('R: 0 divergences (the leg solved from the held start hop stayed on plan)', eng.divergences === 0,
                JSON.stringify({ divergences: eng.divergences }));
        }

        /** B — the bot to the Sword on the rules' declared directed graph: doors only, no logical link. */
        async function runBot() {
            const routing = await page.evaluate(() => {
                const b = window.stateManagerProxy.getEffectiveBidirectionalSetting();
                return { assumeBidirectional: b.assumeBidirectional, source: b.source };
            });
            check('B: the proxy routes on the directed graph the RULES declare (exporter["1"], source `explicit`)',
                routing.assumeBidirectional === false && routing.source === 'explicit', JSON.stringify(routing));
            if (SOLVER_BUDGET_WORK !== null) {
                await page.evaluate(async (n) => {
                    const sm = (await import('./app/core/settingsManager.js')).default;
                    await sm.updateSetting('moduleSettings.flashPanel.seedlingWasmSolverBudgetWork', n, { persist: false });
                }, SOLVER_BUDGET_WORK);
            }
            if (UPGRADE_WINDOW_WORK !== null) {
                await page.evaluate(async (n) => {
                    const sm = (await import('./app/core/settingsManager.js')).default;
                    await sm.updateSetting('moduleSettings.flashPanel.seedlingSolverUpgradeWindowWork', n, { persist: false });
                }, UPGRADE_WINDOW_WORK);
            }
            // ⛓ DETERMINISTIC BUDGET — the defaults the knobs fall back to (the schema's, pinned to the solver's constants).
            const defaults = await page.evaluate(async () => {
                const m = await import('./modules/seedlingDemo/jsRuntimeSolver.js');
                return { budgetWork: m.SOLVER_BUDGET_WORK, upgradeWindowWork: m.SOLVER_UPGRADE_WINDOW_WORK };
            });
            const booted = await startBot();
            out('B boot', booted);
            check(`B: the bot is mounted in ${START}, its first goal in level 10`, booted.ok && booted.region === START
                && /^level_10(__|$)/.test(booted.head?.region ?? ''), JSON.stringify(booted));
            check('B: the Sword\'s route is 9 hops, opening with r8c0\'s OWN stairs (`level_0__r8c0 -> level_2`), never through r1c6',
                booted.route?.length === 9 && booted.route?.nextExit === `${START} -> level_2`
                    && !(booted.route?.steps ?? []).some((r) => r.startsWith('level_0__r1c6')), JSON.stringify(booted.route));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            if (TRACE) await installTrace();
            const sword = booted.head?.location;
            const t0 = Date.now();
            const statuses = [];
            let end = null;
            let swordAt = null;
            while (Date.now() - t0 < BUDGET_MS) {
                // eslint-disable-next-line no-await-in-loop
                end = await botStatus();
                if (end.status !== statuses.at(-1)?.status) {
                    statuses.push({ s: Math.round((Date.now() - t0) / 1000), status: end.status, region: end.region });
                    console.log(`INFO: B +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`);
                }
                // eslint-disable-next-line no-await-in-loop
                const checks = await page.evaluate(() => window.__checks ?? []);
                if (swordAt === null && checks.includes(sword)) swordAt = Math.round((Date.now() - t0) / 1000);
                if (end.status.startsWith('error') || end.status.startsWith('finished')) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            const eng = await engineStats();
            if (TRACE) await writeTrace();
            const checks = await page.evaluate(() => window.__checks ?? []);
            const moves = (await rp.glueMoves()).map((m) => `${m.logical ? '~' : ''}${m.exitName}`);
            const g = await glue();
            out('B engine', eng);
            out('B reach', { seconds: Math.round((Date.now() - t0) / 1000), sword, swordAt, checks, moves,
                logicalMoves: g.stats.logicalMoves, finalStatus: end?.status, region: end?.region, statuses: statuses.slice(-15) });
            out('B next refusal', { status: (end?.status ?? '').startsWith('error') ? end.status : null, engineRefusal: eng.lastRefusal ?? null });
            check(`B: the first move is the stairs walked straight from ${START} (\`${START} -> level_2\`, not logical)`,
                moves[0] === `${START} -> level_2`, JSON.stringify(moves.slice(0, 6)));
            check('B: nothing is credited at r1c6 (the sealed link is gone from the rules)',
                !moves.some((m) => m.includes('level_0__r1c6')), JSON.stringify(moves.filter((m) => m.includes('r1c6'))));
            // ⛓ The Sword (L10) lies past L8, whose sandtraps the solver declines on a base without fidelity F4
            // ("the model computes a SandTrap's arrow death"): there the walk must end on THAT named decline.
            const sandtrapDecline = /declined level_8 -> level_9 .*sandtrap/.test(end?.status ?? '');
            out('B sword', { swordAt, sandtrapDecline });
            check(`B: the bot CHECKED the Sword ("${sword}") — or, on a base without F4, ends on L8's named sandtrap decline`,
                (swordAt !== null && checks.filter((c) => c === sword).length === 1) || (swordAt === null && sandtrapDecline),
                JSON.stringify({ swordAt, checks, sandtrapDecline }));
            check('B: every location checked once', new Set(checks).size === checks.length, JSON.stringify(checks));
            // ⛓ ANYTIME (§5.20) — every solver plan named by its pass; nothing left the plan.
            const solved = (eng.history ?? []).filter((h) => h.outcome === 'done' && h.producer === 'solver');
            out('B passes', { budgetWork: eng.budgetWork, backstopMs: eng.backstopMs, backstops: eng.backstops, expiries: eng.expiries,
                provisionalPlays: eng.provisionalPlays, retries: eng.retries,
                passes: eng.passes, legs: solved.map((h) => `L${h.level} ${h.pass}${h.expired ? '*' : ''}${h.retries ? `+r${h.retries}` : ''} ${h.ticks}t w${h.work.join('/')}`),
                // ⛓ SHOULD-STOP — every leg one of whose passes stopped at its deadline, by the site that tripped first and the bound
                upgradeWindowWork: eng.upgradeWindowWork, deadlines: solved.filter((h) => h.tripped.length).map((h) => `L${h.level} ${h.tripped.join(',')}`) });
            check('B: every solver leg is named by the PASS that made its plan (dashless / full)',
                solved.length > 0 && solved.every((h) => h.pass === 'dashless' || h.pass === 'full'),
                JSON.stringify(solved.map((h) => [h.level, h.pass])));
            check('B: 0 divergences (every played plan, dashless or full, stayed on plan)', eng.divergences === 0
                && solved.every((h) => !h.divergence), JSON.stringify({ divergences: eng.divergences }));
            const wantBudget = SOLVER_BUDGET_WORK ?? defaults.budgetWork;
            check(`B: the engine solves under the work budget (${wantBudget} units, ${SOLVER_BUDGET_WORK === null ? 'the default' : '--solver-budget-work, the setting'})`,
                eng.budgetWork === wantBudget, JSON.stringify({ budgetWork: eng.budgetWork, defaults }));
            const wantWindow = UPGRADE_WINDOW_WORK === null ? defaults.upgradeWindowWork : (UPGRADE_WINDOW_WORK > 0 ? UPGRADE_WINDOW_WORK : null);
            check(`B: the engine solves under the upgrade window (${wantWindow ?? 'the whole budget'} units, ${UPGRADE_WINDOW_WORK === null ? 'the default' : '--solver-upgrade-window-work, the setting'})`,
                eng.upgradeWindowWork === wantWindow, JSON.stringify({ upgradeWindowWork: eng.upgradeWindowWork, defaults }));
            // ⛓ WALK IDENTITY (a) — the cold start's adoption is staged on the LIVE clock: its plan ships at the gap every
            // held arrival ships at (the model's boot), not begin-staged + the wall-clock idle frames.
            const gaps = (eng.shipGaps ?? []).filter(Number.isFinite);
            const modal = [...gaps.reduce((m, g) => m.set(g, (m.get(g) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
            out('B adopt clock', { adoptClock: eng.adoptClock, firstGap: gaps[0] ?? null, modalGap: modal, gaps: [...new Set(gaps)] });
            check('B: every adoption is put on the LIVE clock (no refusal), and the adopted plan ships at the held arrivals\' gap',
                (eng.adoptClock ?? []).length >= 1 && eng.adoptClock.every((r) => r.refusal === null && r.shift >= 0) && gaps[0] === modal,
                JSON.stringify({ adoptClock: eng.adoptClock, firstGap: gaps[0], modal }));
            // ⛓ WALK IDENTITY (b) — every Restart the bot took waited for the playing leg's end (none cut at a wall-clock tick).
            const deferrals = end?.restartDeferrals ?? [];
            out('B restart deferrals', { deferrals });
            check('B: every Restart that met a playing leg waited for its end (none cut)', deferrals.every((d) => d.ended),
                JSON.stringify(deferrals));
            // ⛓ RESTART HOLD — every Restart's start-hop arrival is HELD: no `no-held-arrival` fallback, and each expected
            // arrival ends in a `held` row (measured before the fix: 3/10 runs fell back at the L19 Restart, whose route opens
            // on a logical link, so its goal came in the landing's own turn and the watch was re-based over the landing).
            const watchRows = eng.arrivalWatch ?? [];
            // ⛓ RESTART SUBJECT (§5.125) — B's own walk no longer Restarts in its budget since rope events (L16's rope
            // opens L17 → L16, so L19 → L36 needs no Restart). When it does, its Restart is checked here; the GUARANTEED
            // subject is session R (a forced Restart out of a pocket), never an empty set read as green.
            if ((eng.expectedArrivals ?? 0) === 0 && watchRows.length === 0 && deferrals.length === 0
                && !(eng.forcedBy?.['no-held-arrival'] > 0)) {
                console.log(`INFO: B took no Restart in its budget — the restart-hold check's subject is session R${SESSIONS.includes('R') ? '' : ' (NOT selected: --only lacks R, so the check does not run)'}`);
            } else restartHeld('B', eng);
            // ⛓ CROSS-LEVEL END — a location leg whose plan ends in another level (L32 Bob Boss → L30) is HELD at its
            // landing (no `held-end` / `unheld-end` fallback, no `cross-level-end` re-arrival), and its own check SETTLES.
            const cross = eng.crossLevelEnds ?? [];
            out('B cross-level ends', { cross, staleGoals: eng.staleGoals ?? [] });
            check('B: every location leg that ends in another level is HELD at its landing, and its own check settles',
                cross.every((r) => r.outcome === 'held-arrival') && !(eng.forcedBy?.['cross-level-end'] > 0)
                    && cross.every((r) => (eng.selfChecks ?? []).some((c) => c.location === r.goal && c.settled === true)),
                JSON.stringify({ cross, forcedBy: eng.forcedBy, selfChecks: (eng.selfChecks ?? []).filter((c) => cross.some((r) => r.goal === c.location)) }));
            check('B: 0 backstops (the wall clock never ended a solve)', eng.backstops === 0, JSON.stringify({ backstops: eng.backstops, backstopMs: eng.backstopMs }));
            check('B: the walk ends FINISHED, with a NAMED refusal, or on the budget — never a silent stall',
                (end?.status ?? '').startsWith('finished') || (end?.status ?? '').startsWith('error') || Date.now() - t0 >= BUDGET_MS,
                end?.status ?? '');
            // ⛓ ROPE GOAL — a goal-first BREAK step is answered: the walk never ENDS on "breaking X first (<event id>)" once the
            // game has collected that event (a local check, no user:locationCheck — measured before the fix: L16's rope cut
            // and collected at +222 s, the status frozen on its break step to the 900 s budget). Read off the bot's final
            // status and the rules' own event row, not the fix's state.
            const brk = await page.evaluate(async (status) => {
                const id = /breaking \S+ first \((flag:L\d+:\d+)\)/.exec(status)?.[1] ?? null;
                if (!id) return { eventId: null };
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                const bot = getActivePanel()?.getBot?.();
                const rules = bot?._getRulesJson?.() ?? null;
                const pid = String(bot?._getPlayerId?.() ?? '1');
                const names = Object.values(rules?.regions?.[pid] ?? {}).flatMap((r) => r.locations ?? [])
                    .filter((l) => l.event_id === id).map((l) => l.name);
                const checked = window.stateManagerProxy?.getLatestStateSnapshot?.()?.checkedLocations ?? [];
                return { eventId: id, names, collected: names.some((n) => checked.includes(n)) };
            }, end?.status ?? '');
            out('B break steps', { ...brk, replans: (await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                return (getActivePanel()?.getBot?.()?.getLog?.() ?? []).filter((l) => /collected by the game — re-planning/.test(l));
            })) });
            check('B: no walk ends on a BREAK step whose event the game already collected (the bot re-plans after the break)',
                !(brk.eventId && brk.collected), JSON.stringify(brk));
        }

        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
            // ⛓ READY before the click; a known boot fault re-boots once (seedlingProbeBoot.js).
            await startWasmGame(() => rp.gameFrame(), { logs });
            await assertLogicOnlyChannel(rp.gameFrame());
            await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
                document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
            await rp.waitForApLoad(120000);
            await rp.waitFor('dispatcher wrapped', () => page.evaluate(async () => {
                window.__checks = window.__checks ?? [];
                const { getActivePanelInstance } = await import('./modules/flashPanel/index.js');
                const d = getActivePanelInstance()?.adapter?.dispatcher ?? null;
                if (!d) return false;
                if (!d.__ll) {
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__ll = true;
                }
                return true;
            }), 20000);
            if (S === 'H') await runHuman();
            if (S === 'B') await runBot();
            if (S === 'R') await runRestart();
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
            console.log(`INFO: panel log: ${await panelLogTail().catch(() => '?')}`);
        } catch (e) {
            if (isBootFault(e)) { await page.close(); throw e; }
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`INFO: panel log: ${await panelLogTail().catch(() => '?')}`);
        }
        await page.close();
        return rp.failures();
    }
}
