#!/usr/bin/env node
/**
 * Seedling solver-walk, slice W7 (plan `NewDocs/plans/seedling-wasm-solver-plan.md` §1.3/§2.4/§3 W7) — the
 * live witness that the wasm Playback Bot KEEPS THE ROOM STILL between goals and solves the next goal as a
 * CONTINUATION (S0's prefix from the held room), with no forced re-arrival on the main path. ⚖ The user
 * (2026-10-03): the solver must not need to exit and re-enter a room, or clear the save, to solve it.
 * Default build p4e, headless logic-only, under the box lock; every session on a FRESH page (the wasm game
 * runs out of memory after ~150–170 world swaps).
 *
 *   C   §1.3's C rows as a committed session (`wasmContinuationLab.js`, imported by URL): a host jump into the
 *       room, the arrival solved, K ticks played HELD, the held game read against the SHADOW
 *       (`replayTape(arrival, K keys)` — `wasmPlayback.shadowMismatch`, exact), then the continuation: `resolve`
 *       = the engine's own request (`wasmArrival.continuationSolveRequest`), `rest` = the plan's remaining keys,
 *       `composite` = prefix ++ re-solve as ONE tape from the arrival (no seam). L6 and L86 re-solves and the L4
 *       rests play ON PLAN; L4's re-solve DIVERGES and its composite diverges at the SAME tick (K + t), which
 *       names it as model residue on the re-solved shove approach, not the seam.
 *   W   the MAIN PATH on `seedling_atlas_location`: the Playback Bot opens the Starting House chest and leaves by
 *       its door. The chest is the COLD START (the house ran before the bot drove); ⛓ W8 ADOPTS it (no forced
 *       re-arrival at all — `probe-seedling-wasm-adopt.mjs` is its own witness). The chest plan ends HELD, and the door is a continuation from
 *       the held end: 0 other forced re-arrivals, the held game == the shadow, 0 divergences, the crossing once,
 *       the room handed back when the bot finishes. World swaps are COUNTED (host `new Game` pushes + the game's
 *       own door swaps). `--base` = report-only (point `--host` at a server running the base tree; the counts
 *       are printed, no W7 check applies).
 *   A   the ARRIVAL HOLD on `seedling_atlas` (hub → house door → chest; the preset's sphere log, or the one its
 *       rules imply): the house arrival's FIRST begin record (the game's own door) is NOT held — the glue's
 *       redirect is queued behind it (`arrivalHoldBlocker`) — and the redirect's landing IS held; the chest is
 *       solved from that held arrival, no forced re-arrival but the cold start.
 *   R   RELEASE: the chest served through the controller, its plan ends HELD (the room ignores the keyboard —
 *       ⚖ Q4), then the BOT's pause (`playbackBotUI.stop` → the controller's stop) hands the room back: nothing
 *       held, and a real ArrowLeft moves the player.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW C {json}` per C row, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-continuation.mjs [--host=http://localhost:8000] [--only=C|W|A|R]
 *      [--c=L6:60:resolve,L4:40:composite] [--base] [--wait-for-box=<sec>]
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

/** §1.3's legs (host-jump arrivals on `seedling_atlas_location`; none of these rooms is bound there). */
export const C_LEGS = [
    { name: 'L6 bait', level: 6, x: 32, y: 16, goal: { kind: 'exit', level: 6, tiles: [[14, 2]], name: 'out_stairsup_224_32' } },
    { name: 'L4 shove', level: 4, x: 16, y: 16, goal: { kind: 'exit', level: 4, tiles: [[4, 1]], name: 'out_stairsdown_64_16' } },
    { name: 'L86 chest', level: 86, x: 48, y: 48, goal: { kind: 'location', level: 86, tag: 0, entityType: 'chest', name: 'chest' } },
];
/** The default C rows: `[leg, K, mode, expect]` — `expect` 'on-plan' or 'residue' (L4's re-solve, §1.3). */
export const C_ROWS = [
    ['L6', 60, 'resolve', 'on-plan'], ['L6', 150, 'resolve', 'on-plan'], ['L6', 200, 'resolve', 'on-plan'],
    ['L4', 40, 'rest', 'on-plan'], ['L4', 80, 'rest', 'on-plan'], ['L4', 120, 'rest', 'on-plan'],
    ['L4', 40, 'resolve', 'residue'], ['L4', 40, 'composite', 'residue'],
    ['L86', 10, 'resolve', 'on-plan'],
];

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/**
 * In the GAME frame: count world swaps — every host `new Game` the bridge is handed (`queueItems`
 * invocations) and every door the game fires (`pendingExit` reports to the host hook).
 */
function installSwapCounter() {
    const br = window.__swfBridge;
    if (window.__w7swaps) return true;
    const c = { hostNewGame: 0, gameDoors: 0, lastExit: '' };
    const q = br.queueItems.bind(br);
    br.queueItems = (items) => {
        for (const i of (Array.isArray(items) ? items : [items])) if (i?.invocation === 'new_instance' && i.className === 'Game') c.hostNewGame += 1;
        return q(items);
    };
    window.__w7swaps = c;
    return true;
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-continuation.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ONLY = arg('only', '');
    const BASE = process.argv.includes('--base');
    const preset = (game) => JSON.parse(readFileSync(join(REPO, `frontend/presets/${game}/AP_1/AP_1_rules.json`), 'utf8'));
    const LOC = preset('seedling_atlas_location');
    const WASM_PAGE = LOC.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const SESSIONS = ONLY ? [ONLY] : (BASE ? ['W'] : ['C', 'W', 'A', 'R']);
    for (const S of SESSIONS) {
        console.log(`INFO: ── session ${S}${BASE ? ' (BASE: report only)' : ''} (a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(S);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(S) {
        const GAME = S === 'A' ? 'seedling_atlas' : 'seedling_atlas_location';
        const PRESET = preset(GAME);
        const REGIONS = PRESET.regions['1'];
        const START = REGIONS.Menu.exits[0].connected_region;
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `w7-${S}` });
        const { check } = rp;
        const w = (fn, a) => rp.gameFrame().evaluate(fn, a);
        const status = async () => JSON.parse(await w(() => window.__swfBridge.game.botStatus()));
        const ap = () => page.evaluate(async () => {
            const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
            const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            return { inv: snap?.inventory ?? {}, checked: [...(snap?.checkedLocations ?? [])], checks: [...(window.__checks ?? [])],
                binding: glue?.checkBinding ? { ...glue.checkBinding.stats } : null, glue: glue?.stats ?? null };
        });
        const engine = () => page.evaluate(async () => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            const e = c?._wasmEngine ?? null;
            return e ? JSON.parse(JSON.stringify({ stats: e.stats, status: e.status(), lastRefusal: c.lastRefusal })) : null;
        });
        /** Start the bot from START and wait for `finished`/`error:` (status lines echoed). */
        async function botWalk(budgetMs = 240000) {
            if (!PRESET.sphere_log) {
                // The starter atlas embeds no sphere log (W5): load the one its rules imply — one location, every
                // rule on its path `True_` (refused otherwise).
                const locs = Object.values(REGIONS).flatMap((r) => r.locations ?? []);
                const HOUSE = Object.keys(REGIONS).find((k) => (REGIONS[k].locations ?? []).length > 0);
                const path = [REGIONS.Menu.exits[0], REGIONS[START].exits.find((e) => e.connected_region === HOUSE), ...REGIONS[HOUSE].locations];
                check(`${S}: no embedded sphere log — the implied one (one location, the path all True_)`,
                    locs.length === 1 && path.every((x) => x && (x.access_rule?.rule ?? 'True_') === 'True_'));
                const items = Object.fromEntries(locs.map((l) => [l.item.name, 1]));
                const LOG = [
                    { type: 'metadata', seed: 1, seed_name: '', event_locations: {}, event_items: {} },
                    { type: 'state_update', sphere_index: '0', player_data: { 1: { new_inventory_details: { base_items: {}, resolved_items: {} },
                        new_accessible_locations: locs.map((l) => l.name), new_accessible_regions: ['Menu', START, HOUSE], sphere_locations: [] } } },
                    { type: 'state_update', sphere_index: '0.1', player_data: { 1: { new_inventory_details: { base_items: items, resolved_items: items },
                        new_accessible_locations: [], new_accessible_regions: [], sphere_locations: locs.map((l) => l.name) } } },
                ].map((e) => JSON.stringify(e)).join('\n');
                await page.evaluate(async (text) => {
                    const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                    return getSphereStateSingleton().loadSphereLog('probe-seedling-wasm-continuation:implied', text);
                }, LOG);
            }
            const booted = await page.evaluate(async (start) => {
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
            check(`${S}: the bot is mounted in ${START}`, booted.ok && booted.region === START, JSON.stringify(booted));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const t0 = Date.now();
            let last = '';
            let end = null;
            while (Date.now() - t0 < budgetMs) {
                // eslint-disable-next-line no-await-in-loop
                end = await page.evaluate(async () => {
                    const { getActivePanel } = await import('./modules/playbackBot/index.js');
                    const bot = getActivePanel()?.getBot?.();
                    return { status: bot?.getStatus?.() ?? '', log: (bot?.getLog?.() ?? []).slice(-20) };
                });
                if (end.status !== last) { console.log(`INFO: +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`); last = end.status; }
                if (end.status.startsWith('finished') || end.status.startsWith('error')) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            return end;
        }
        const legsOf = (hist) => hist.map((h) => ({ goal: h.goal?.name ?? h.goal?.kind, outcome: h.outcome, kind: h.kind ?? null,
            continuation: h.continuation ?? false, prefix: h.prefix ?? 0, ticks: h.ticks, drained: h.drained, divergence: h.divergence ?? null,
            heldEnd: h.heldEnd ?? null, heldArrival: h.heldArrival ?? null }));

        try {
            await page.goto(`${HOST}/frontend/?game=${GAME}&seed=1`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
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
                if (!d.__w7) {
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__w7 = true;
                }
                return true;
            }), 20000);
            await page.waitForTimeout(1500);
            await w(installSwapCounter);

            if (S === 'C') {
                await page.evaluate(async () => {
                    const { createLab } = await import('/scripts/procgen/wasmContinuationLab.js');
                    window.__lab = await createLab();
                });
                const pick = arg('c', '');
                const rows = pick ? pick.split(',').map((t) => { const [n, K, mode] = t.split(':'); return [n, Number(K), mode, mode === 'resolve' && n === 'L4' ? 'residue' : (mode === 'composite' ? 'residue' : 'on-plan')]; }) : C_ROWS;
                const results = [];
                for (const [n, K, mode, expect] of rows) {
                    const leg = C_LEGS.find((l) => l.name.startsWith(`${n} `));
                    let r;
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        r = await page.evaluate((a) => window.__lab.continuation(a), { ...leg, K, mode });
                    } catch (err) {
                        r = { error: `evaluate: ${err.message.split('\n')[0]}` };
                        // eslint-disable-next-line no-await-in-loop
                        await page.evaluate(() => window.__lab.resetClean());
                    }
                    // eslint-disable-next-line no-await-in-loop
                    const releases = await page.evaluate(() => window.__lab.releases.splice(0));
                    console.log(`ROW C ${JSON.stringify({ leg: leg.name, K, mode, expect, releases, ...r })}`);
                    results.push({ leg, K, mode, expect, r });
                    const tag = `C ${leg.name} K=${K} ${mode}`;
                    if (mode === 'composite') {
                        check(`${tag}: the seam-free composite (prefix ++ re-solve, ONE tape) runs`, !r.error && r.composite, r.error ?? '');
                        continue;
                    }
                    check(`${tag}: the K-tick part played ON PLAN and ended HELD`, !r.error && !r.partDiv && r.partOutcome === 'held',
                        JSON.stringify({ error: r.error, partDiv: r.partDiv, partOutcome: r.partOutcome }));
                    check(`${tag}: the HELD game == the shadow (level, x, y exact)`, !!r.held && r.held.mismatch === null && r.held.game.held === true,
                        JSON.stringify(r.held));
                    if (expect === 'on-plan') {
                        check(`${tag}: the continuation played ON PLAN to its goal`, !r.error && !r.cont?.div
                            && (leg.goal.kind === 'exit' ? r.cont?.endLevel !== leg.level : ['finished', 'held'].includes(r.cont?.outcome)),
                            JSON.stringify(r.cont ?? r.error));
                    } else {
                        check(`${tag}: the re-solve DIVERGES, detected and named (firstDivergence)`, !r.error && !!r.cont?.div,
                            JSON.stringify(r.cont ?? r.error));
                    }
                }
                // L4: the re-solve's divergence = the composite's, shifted by K ⇒ model residue, not the seam (§1.3).
                const l4r = results.find((x) => x.leg.name.startsWith('L4') && x.mode === 'resolve' && x.r.cont?.div);
                const l4c = results.find((x) => x.leg.name.startsWith('L4') && x.mode === 'composite' && x.K === l4r?.K);
                if (l4r && l4c) {
                    const d1 = l4r.r.cont.div;
                    const d2 = l4c.r.composite?.div;
                    check(`C L4 K=${l4r.K}: the composite diverges at the SAME tick and row (K + ${d1.t} = ${l4r.K + d1.t}) ⇒ MODEL RESIDUE on the re-solved shove approach, not the seam`,
                        !!d2 && d2.t === l4r.K + d1.t && d2.got.x === d1.got.x && d2.got.y === d1.got.y && d2.expected.x === d1.expected.x,
                        JSON.stringify({ resolve: d1, composite: d2 }));
                }
            }

            if (S === 'W' || S === 'A') {
                const before = await ap();
                const end = await botWalk();
                const eng = await engine();
                const apW = await ap();
                const swaps = await w(() => window.__w7swaps);
                const moves = await rp.glueMoves();
                const hist = eng?.stats?.history ?? [];
                const st = eng?.stats ?? {};
                const doors = (moves ?? []).length;
                console.log(`INFO: ${S} legs ${JSON.stringify(legsOf(hist))}`);
                console.log(`INFO: ${S} engine forced ${st.forced} ${JSON.stringify(st.forcedBy ?? null)}; held ${st.held}; continuations ${st.continuations}; `
                    + `fallbacks ${JSON.stringify(st.fallbacks ?? null)}; holdBlocked ${JSON.stringify(st.holdBlocked ?? null)}; releasedForSwap ${st.releasedForSwap}`);
                console.log(`INFO: ${S} heldChecks ${JSON.stringify(st.heldChecks ?? null)}`);
                console.log(`INFO: ${S} SWAPS host new Game ${swaps.hostNewGame} + game doors ${doors} (glue region moves) = ${swaps.hostNewGame + doors}; `
                    + `glue teleports ${apW.glue?.teleports}; hostStarts ${JSON.stringify((st.hostStarts ?? []).map((h) => h.label))}`);
                if (BASE) {
                    console.log(`INFO: BASE ${S}: status "${end?.status}", forced ${st.forced}, divergences ${st.divergences}, swaps ${swaps.hostNewGame + doors}`);
                } else {
                    const CHEST = Object.values(REGIONS).flatMap((r) => r.locations ?? []).map((l) => l.name).find((n) => /Chest/.test(n));
                    check(`${S}: the bot FINISHED (status finished, no error:)`, (end?.status ?? '').startsWith('finished'), `status "${end?.status}"`);
                    const chestChecks = apW.checks.filter((n) => n === CHEST).length - before.checks.filter((n) => n === CHEST).length;
                    check(`${S}: the chest checked EXACTLY ONCE`, chestChecks === 1 && apW.binding?.checks === 1, `${chestChecks}; binding ${JSON.stringify(apW.binding)}`);
                    const other = Object.entries(st.forcedBy ?? {}).filter(([k]) => k !== 'cold-start');
                    if (S === 'W') {
                        // ⛓ W8 — the house cold start is ADOPTED (no Mobile, nothing to use, untouched): 0 forced re-arrivals in total.
                        check('W: 0 forced re-arrivals IN TOTAL — ⛓ W8 adopted the cold start (W7 spent one there)',
                            st.forced === 0 && st.adopted === 1 && Object.keys(st.forcedBy ?? {}).length === 0 && (st.fallbacks ?? []).length === 0,
                            JSON.stringify({ forced: st.forced, adopted: st.adopted, forcedBy: st.forcedBy, refused: st.adoptRefused, fallbacks: st.fallbacks }));
                    } else {
                        // Level 0 holds Mobiles (introchar, statue2): its cold start is not adopted (named), and re-arrives.
                        check(`${S}: 0 forced re-arrivals on the main path — the ONE forced re-arrival is the cold start (level 0 is refused adoption by its Mobiles)`,
                            st.forced === 1 && (st.forcedBy?.['cold-start'] ?? 0) === 1 && other.length === 0 && (st.fallbacks ?? []).length === 0
                                && st.adoptRefused?.[0]?.clause === 'mobiles',
                            JSON.stringify({ forced: st.forced, forcedBy: st.forcedBy, refused: st.adoptRefused, fallbacks: st.fallbacks }));
                    }
                    check(`${S}: 0 divergences, 0 recoveries`, st.divergences === 0 && st.recoveries === 0,
                        JSON.stringify({ divergences: st.divergences, recoveries: st.recoveries }));
                    check(`${S}: the held game == the shadow at EVERY held point the engine solved from`,
                        (st.heldChecks ?? []).every((h) => h.equal && h.held === true), JSON.stringify(st.heldChecks));
                    const fin = await status();
                    check(`${S}: the finished bot handed the room back (nothing armed or held)`, !fin.armed && !fin.held,
                        JSON.stringify({ armed: fin.armed, held: fin.held, level: fin.level }));
                    if (S === 'W') {
                        const door = hist.find((h) => h.goal?.kind === 'exit');
                        const chest = hist.find((h) => h.goal?.kind === 'location' && h.outcome === 'done');
                        check('W: the chest plan ended HELD (the room stays the bot\'s between goals)', chest?.heldEnd === true, JSON.stringify(chest && legsOf([chest])));
                        // ⛓ W8 — the chest is itself a continuation from the adopted "arrival + 1 idle tick", so the door's prefix is 1 + the chest's keys.
                        check('W: the door was a CONTINUATION from the held end (prefix = the idle tick + the chest plan\'s keys), solved after an exact held check',
                            st.continuations === 2 && (st.heldChecks ?? []).length === 2 && st.heldChecks[0].shipped === 1
                                && st.heldChecks[1].shipped === 1 + chest?.ticks && !!door && (door.drained ?? 0) >= 1,
                            JSON.stringify({ continuations: st.continuations, heldChecks: st.heldChecks, door: door && legsOf([door]) }));
                        check('W: the crossing out of the house reported ONCE', doors === 1, JSON.stringify(moves.map((m) => m.targetRegion)));
                        check('W: world swaps = 1 (the door) — ⛓ W8 adopted the cold start; W7 walked 2, W2 3',
                            swaps.hostNewGame + doors === 1, `host ${swaps.hostNewGame} + doors ${doors}`);
                    } else {
                        const blocked = (st.holdBlocked ?? []).filter((b) => b.level === 86);
                        check('A: the house\'s FIRST begin record (the game\'s own door) was NOT held — the glue query saw its redirect in flight',
                            blocked.length >= 1 && blocked.every((b) => /teleport|swap/.test(b.why)), JSON.stringify(st.holdBlocked));
                        const hub = hist.find((h) => h.goal?.kind === 'exit');
                        check('A: the hub leg (house door) ended at a HELD arrival in the house (the redirect\'s landing)',
                            hub?.outcome === 'done' && hub.heldArrival === 86, JSON.stringify(hub && legsOf([hub])));
                        check('A: the chest was solved from that held arrival: 2 held arrivals (the cold start + the house), 0 continuations needed',
                            st.held === 2 && st.solves === 2, JSON.stringify({ held: st.held, solves: st.solves }));
                    }
                }
            }

            if (S === 'R') {
                const out = await page.evaluate(async (start) => {
                    const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
                    const bus = (await import('./app/core/eventBus.js')).default;
                    bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                    const { getActivePanel } = await import('./modules/playbackBot/index.js');
                    for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                        // eslint-disable-next-line no-await-in-loop
                        await new Promise((r) => { setTimeout(r, 100); });
                    }
                    const bot = getActivePanel()?.getBot?.();
                    bot.onRegionMove({ targetRegion: start });
                    const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
                    const chest = window.stateManagerProxy.getStaticData().regions.get(start)?.locations?.[0]?.name;
                    // The controller loads the engine on its first wasm goal and holds the goal on its retry timer meanwhile.
                    const answer = c.walkTo({ kind: 'location', name: chest });
                    const t0 = performance.now();
                    while (performance.now() - t0 < 90000) {
                        // eslint-disable-next-line no-await-in-loop
                        await new Promise((r) => { setTimeout(r, 250); });
                        const s = c._wasmEngine?.status();
                        if (s?.phase === 'held' && s.room?.shipped > 0) break;
                    }
                    return { chest, answer: String(answer), status: c._wasmEngine?.status() ?? null };
                }, START);
                console.log(`INFO: R engine ${JSON.stringify(out.status)}`);
                const heldSt = await status();
                check('R: the chest plan ended HELD (engine phase held, the room\'s recipe = the plan; the game reports held)',
                    out.status?.phase === 'held' && out.status.room?.shipped > 0 && heldSt.held === true, JSON.stringify({ engine: out.status, held: heldSt.held }));
                await rp.focusGame();
                const ignored = await rp.keyMovesPlayer('ArrowLeft', 2, 800);
                check('R: while HELD the room ignores the keyboard (⚖ Q4: the bot owns the room between goals)', !ignored.moved, JSON.stringify(ignored));
                // The BOT's pause — the path a person's ⏸ takes (playbackBotUI.stop → dispatch('stop') → controller.stop).
                await page.evaluate(async () => { const { getActivePanel } = await import('./modules/playbackBot/index.js'); getActivePanel().getBot().stop(); });
                await page.waitForTimeout(300);
                const rel = await status();
                const eng = await engine();
                check('R: the bot\'s pause RELEASED the hold (nothing armed or held; the engine idle, its room dropped)',
                    !rel.held && !rel.armed && eng?.status?.phase === 'idle' && eng.status.room === null, JSON.stringify({ held: rel.held, armed: rel.armed, engine: eng?.status }));
                await rp.focusGame();
                const moved = await rp.keyMovesPlayer('ArrowLeft', 2, 1500);
                check('R: the released room ANSWERS THE KEYBOARD (a real ArrowLeft moves the player)', moved.moved, JSON.stringify(moved));
            }
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
            const wp = logs.filter((l) => /wasm playback/.test(l));
            if (wp.length) console.log(`INFO: playback log lines:\n  ${wp.slice(-20).join('\n  ')}`);
        } catch (e) {
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
        }
        await page.close();
        return rp.failures();
    }
}
