#!/usr/bin/env node
/**
 * Seedling solver-walk, slice W5 (plan `NewDocs/plans/seedling-wasm-solver-plan.md` §2.2/§3 W5) — the
 * live witness of LEVEL 0 (the overworld hub) on the wasm solver, on `seedling_atlas` (default build
 * p4e, headless logic-only, under the box lock). W1–W4 refused every level-0 goal by name: its moonrock
 * reads the save statics `beam`/`rockSet`, which no read-only verb carried. `games/seedling.json` now
 * declares them, so the bridge's `readState` carries them and the wasm engine
 * (`flashPanel/seedlingWasmPlayback.js`, built the way the controller builds it) stages level 0 DECLARING
 * them, while the tape it ships keeps `seam: null` (the game's own values are never overwritten).
 * Measure only: nothing tracked changes.
 *
 *   Z   the hub, from the game's OWN start — no host jump (`Main.as:51` boots level 0; on `seedling_atlas`
 *       the binding's baseline then places the player at the region's arrival spawn, (160,288)): the house
 *       door's REAL entry (hub → house), the house door back out (house → hub), the owls-nest stairs from
 *       the hub (→ L2). Each crossed ON PLAN, 0 divergences; every level-0 arrival read `beam`/`rockSet`
 *       off readState and the staging declared them (restaged here in node from the engine's own read).
 *   S   AFTER THE SHIELD (`beam: true`): a host jump to L20 (192,64), the engine collects the shield for
 *       real (`Shield.removed()` writes `Moonrock.beam = true` = `Main.beam`), readState reports `beam: true`;
 *       then a jump to the hub (re-jumped inside the level, W4's recipe) and the engine serves
 *       `out_teleporter_0_128` (→ L94), a plan long enough that the moonrock's beam runs out and the rock
 *       lands MID-PLAN. Staged `beam: true`, crossed ON PLAN; afterwards the GAME itself reports
 *       `beam: false, rockSet: true` (its own writes — the tape declared no seam).
 *   B   the Playback Bot walks the starter `seedling_atlas` on wasm FROM THE HUB (its start region
 *       `overworld_start__r8c0`): hub → house door → the chest; status `finished`, the chest checked ONCE,
 *       0 divergences, the first leg staged in level 0. ⛔ The starter preset embeds NO sphere log, so the
 *       probe loads the one its rules imply (one location whose path Menu → hub → house → chest is all
 *       `True_` → one sphere; derived from the preset, refused otherwise) through sphereState's own
 *       `loadSphereLog`.
 *
 * Each session is a FRESH page (the wasm game runs out of memory after ~100–140 world swaps).
 * Prints `PASS:`/`FAIL:` rows, one `LEG {json}` per engine leg, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1 on a fail).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build
 * (the `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-level0.mjs [--host=http://localhost:8000] [--only=Z|S|B]
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

const exit = (level, tiles, name) => ({ kind: 'exit', level, tiles, name });
/** The hub legs (session Z), in play order from the game's own boot. */
export const HUB_LEGS = [
    { name: 'hub → house door (the REAL entry)', goal: exit(0, [[10, 17]], 'house_door'), to: 86 },
    { name: 'house → hub (the house door out)', goal: exit(86, [[3, 4]], 'door'), to: 0 },
    { name: 'hub → owls-nest stairs', goal: exit(0, [[16, 17]], 'owls_nest_stairs'), to: 2 },
];
/** Session S: the shield (L20, tag 2) from the stairs' arrival, then a long hub leg with `beam: true`. */
export const SHIELD = { at: [20, 192, 64], goal: { kind: 'location', level: 20, tag: 2, entityType: 'shield', name: 'shield' } };
export const BEAM_LEG = { at: [0, 160, 288], goal: exit(0, [[0, 8]], 'out_teleporter_0_128'), to: 94 };
/** The moonrock's beam: `beamTimeMax` = 5 s × 30 FPS, then the rock falls 20 px/frame from y −1000 to 256. */
export const BEAM_LANDS_BY = 150 + Math.ceil((256 + 1000) / 20) + 2;

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/** In the PAGE: serve one goal with a fresh-per-page engine; resolve when it ends. */
async function serveLeg({ goal, budgetMs }) {
    const { getActivePanelInstance, getSeedlingRegionGlue } = await import('./modules/flashPanel/index.js');
    const panel = getActivePanelInstance();
    const glue = getSeedlingRegionGlue();
    const s = panel.seedlingPlaybackSurface();
    if (!window.__w5) {
        const mod = await import(new URL('modules/flashPanel/seedlingWasmPlayback.js', document.baseURI).href);
        const w5 = { notes: [], failed: null };
        w5.engine = await mod.loadWasmPlaybackEngine({ mapPath: s.wasm.mapPath, baseUrl: document.baseURI,
            getGame: s.wasm.getGame, getWin: s.wasm.getWin, teleport: s.wasm.teleport,
            getCheckBinding: () => glue?.checkBinding ?? null,
            onNote: (n) => { if (n) w5.notes.push(n); }, onFailed: (r) => { w5.failed = r; } });
        window.__w5 = w5;
    }
    const w5 = window.__w5;
    w5.failed = null;
    w5.notes = [];
    const engine = w5.engine;
    const h0 = engine.stats.history.length;
    const r0 = engine.arrivalReads.length;
    const done0 = engine.stats.done;
    const answer = engine.walkTo(goal);
    const t0 = performance.now();
    let leftAt = null;
    let end = 'timeout';
    while (performance.now() - t0 < budgetMs) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => { setTimeout(r, 200); });
        if (!answer.ok) { end = 'refused'; break; }
        if (w5.failed) { end = 'failed'; break; }
        if (engine.stats.done > done0) { end = 'done'; break; }
        const lv = JSON.parse(s.wasm.getGame().readState()).level;
        const st = engine.status();
        if (goal.kind === 'exit' && lv !== goal.level && st.phase === 'playing') {
            leftAt ??= performance.now();
            if ((st.drained ?? 0) >= (st.ticks ?? Infinity) || performance.now() - leftAt > 5000) {
                engine.stop();
                end = 'crossed';
                break;
            }
        }
    }
    if (end === 'timeout') engine.stop();
    const stats = JSON.parse(JSON.stringify(engine.stats));
    const st = JSON.parse(s.wasm.getGame().botStatus());
    const live = JSON.parse(s.wasm.getGame().readState());
    return { answer, end, failed: w5.failed, notes: w5.notes.slice(-6), legs: stats.history.slice(h0),
        reads: JSON.parse(JSON.stringify(engine.arrivalReads.slice(r0))),
        forced: stats.forced, ships: stats.ships, level: st.level, armed: st.armed, held: st.held,
        beam: live.beam, rockSet: live.rockSet, hasShield: live.hasShield, ms: Math.round(performance.now() - t0) };
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-level0.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ONLY = arg('only', '');
    const GAME = 'seedling_atlas';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const SD = join(REPO, 'frontend/modules/seedlingDemo');
    const W = await import(join(SD, 'wasmArrival.js'));
    const { indexLevels } = await import(join(SD, 'atlasSource.js'));
    const RECORDS = indexLevels(JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8')));
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const CHEST = Object.values(REGIONS).flatMap((r) => r.locations ?? []).map((l) => l.name)[0];

    /** The engine's own arrival read, restaged here: what the staging DECLARED for the moonrock. */
    const restage = (read) => {
        try {
            const { staging, undeclared } = W.stagingFromWasmArrival({ ...read, record: RECORDS.get(read.status.level) ?? null });
            return { level: staging.boot.level, beam: staging.seam?.beam, rockSet: staging.seam?.rock_set, undeclared };
        } catch (e) {
            return { error: e.message };
        }
    };

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const SESSION of ONLY ? [ONLY] : ['Z', 'S', 'B']) {
        console.log(`INFO: ── session ${SESSION} (a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(SESSION);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(SESSION) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `w5-${SESSION}` });
        const { check } = rp;
        const ap = () => page.evaluate(async () => {
            const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
            const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            return { checked: [...(snap?.checkedLocations ?? [])], checks: [...(window.__checks ?? [])],
                binding: glue?.checkBinding ? { ...glue.checkBinding.stats } : null };
        });

        /** Serve one goal; log the leg; the shared checks. */
        async function leg(SESS, name, goal, { budgetMs = 90000 } = {}) {
            const r = await page.evaluate(serveLeg, { goal, budgetMs });
            const plays = r.legs.filter((h) => h.outcome !== 'failed');
            const staged = r.reads.map((rd) => ({ level: rd.status?.level, x: rd.state?.playerPositionX, y: rd.state?.playerPositionY,
                readBeam: rd.state?.beam, readRockSet: rd.state?.rockSet, ...restage(rd) }));
            console.log(`LEG ${JSON.stringify({ session: SESS, name, end: r.end, failed: r.failed, answer: r.answer, level: r.level,
                ms: r.ms, staged, beam: r.beam, rockSet: r.rockSet, legs: r.legs.map((h) => ({ outcome: h.outcome, producer: h.producer,
                    stepOff: h.stepOff ?? null, ticks: h.ticks, drained: h.drained, verbs: h.verbs, divergence: h.divergence,
                    recovery: h.recovery, solvedMs: h.solvedMs })) })}`);
            check(`${SESS} ${name}: nothing of ours left armed or held`, !r.armed && !r.held, JSON.stringify({ armed: r.armed, held: r.held }));
            return { r, plays, staged };
        }

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
                if (!d.__w5) {
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__w5 = true;
                }
                return true;
            }), 20000);
            await page.waitForTimeout(1500);
            const g0 = await rp.readGameState();
            check(`${SESSION}: the fresh game boots in the HUB (level 0) and readState carries beam/rockSet (both false)`,
                g0.level === 0 && g0.beam === false && g0.rockSet === false,
                JSON.stringify({ level: g0.level, x: g0.playerPositionX, y: g0.playerPositionY, beam: g0.beam, rockSet: g0.rockSet }));

            if (SESSION === 'Z') {
                for (const L of HUB_LEGS) {
                    // eslint-disable-next-line no-await-in-loop
                    const { r, plays, staged } = await leg('Z', L.name, L.goal);
                    const dv = r.legs.map((h) => h.divergence).filter(Boolean);
                    check(`Z ${L.name}: crossed ON PLAN out of L${L.goal.level} into L${L.to} (1 plan, 0 divergences)`,
                        r.answer.ok && ['crossed', 'done'].includes(r.end) && r.level === L.to && dv.length === 0 && plays.length === 1
                            && (plays[0].drained ?? 0) > 0,
                        JSON.stringify({ end: r.end, level: r.level, failed: r.failed, legs: plays.map((h) => [h.outcome, h.producer, h.ticks, h.drained]) }));
                    if (L.goal.level === 0) {
                        const s0 = staged.at(-1) ?? {};
                        check(`Z ${L.name}: the engine STAGED a level-0 arrival, beam/rock_set DECLARED from readState (false, false)`,
                            s0.level === 0 && s0.readBeam === false && s0.readRockSet === false && s0.beam === false && s0.rockSet === false
                                && !(s0.undeclared ?? []).includes('beam'), JSON.stringify(s0));
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(1500);
                }
            }

            if (SESSION === 'S') {
                // ── the shield, for real ──
                const [lv, x, y] = SHIELD.at;
                await rp.jump(lv, x, y);
                await rp.waitFor(`the player in L${lv}`, async () => ((await rp.readGameState()).level === lv ? `L${lv}` : null), 15000);
                await page.waitForTimeout(1200);
                let gs = await rp.readGameState();
                if (gs.playerPositionX !== x || gs.playerPositionY !== y) {
                    await rp.jump(lv, x, y);
                    await page.waitForTimeout(1200);
                    gs = await rp.readGameState();
                }
                check(`S: landed in L20 at (${x}, ${y})`, gs.level === lv && gs.playerPositionX === x && gs.playerPositionY === y,
                    JSON.stringify({ level: gs.level, x: gs.playerPositionX, y: gs.playerPositionY }));
                const sh = await leg('S', 'the shield (L20)', SHIELD.goal);
                check('S the shield: collected ON PLAN (done, 0 divergences)', sh.r.answer.ok && sh.r.end === 'done'
                    && sh.r.legs.every((h) => !h.divergence), JSON.stringify({ end: sh.r.end, failed: sh.r.failed, legs: sh.plays.map((h) => [h.outcome, h.ticks, h.drained, h.verbs]) }));
                await page.waitForTimeout(1500);
                const after = await rp.readGameState();
                check('S: the GAME wrote beam = true (Shield.removed() → Moonrock.beam → Main.beam), read off readState',
                    after.beam === true && after.rockSet === false, JSON.stringify({ beam: after.beam, rockSet: after.rockSet, hasShield: after.hasShield }));
                const apS = await ap();
                console.log(`INFO: S checks ${JSON.stringify(apS.checks)}; binding ${JSON.stringify(apS.binding)}`);
                // ── the hub with beam: true ──
                const [bl, bx, by] = BEAM_LEG.at;
                await rp.jump(bl, bx, by);
                // ⛔ `waitFor` treats a FALSY answer as "not yet" — and the hub is level 0. Answer a string.
                await rp.waitFor(`the player in L${bl}`, async () => ((await rp.readGameState()).level === bl ? `L${bl}` : null), 15000);
                await page.waitForTimeout(800);
                let gb = await rp.readGameState();
                let jumps = 1;
                if (gb.playerPositionX !== bx || gb.playerPositionY !== by) {
                    // ⛓ W4's recipe: a cross-level jump into a bound room is re-placed by the binding; re-jump inside.
                    jumps += 1;
                    await rp.jump(bl, bx, by);
                    await page.waitForTimeout(800);
                    gb = await rp.readGameState();
                }
                check(`S: in the hub at (${bx}, ${by}) with beam still true (${jumps} jump(s); each new Game rebuilds the rock, so the beam restarts)`,
                    gb.level === bl && gb.playerPositionX === bx && gb.playerPositionY === by && gb.beam === true && gb.rockSet === false,
                    JSON.stringify({ level: gb.level, x: gb.playerPositionX, y: gb.playerPositionY, beam: gb.beam, rockSet: gb.rockSet, jumps }));
                const b = await leg('S', 'hub → out_teleporter_0_128 with beam: true', BEAM_LEG.goal, { budgetMs: 120000 });
                const s0 = b.staged.at(-1) ?? {};
                check('S beam leg: the engine staged the hub arrival with beam: true DECLARED (read off readState, not guessed)',
                    s0.level === 0 && s0.x === bx && s0.y === by && s0.readBeam === true && s0.beam === true && s0.rockSet === false,
                    JSON.stringify(s0));
                const dv = b.r.legs.map((h) => h.divergence).filter(Boolean);
                const p0 = b.plays[0] ?? {};
                check(`S beam leg: crossed ON PLAN into L${BEAM_LEG.to} (1 plan, 0 divergences)`,
                    b.r.answer.ok && ['crossed', 'done'].includes(b.r.end) && b.r.level === BEAM_LEG.to && dv.length === 0 && b.plays.length === 1,
                    JSON.stringify({ end: b.r.end, level: b.r.level, failed: b.r.failed, legs: b.plays.map((h) => [h.outcome, h.ticks, h.drained, h.divergence]) }));
                check(`S beam leg: the plan outlasts the beam (≥ ${BEAM_LANDS_BY} ticks: 150 frozen + the fall), so the rock lands MID-PLAN`,
                    (p0.ticks ?? 0) >= BEAM_LANDS_BY, `ticks ${p0.ticks}`);
                check('S beam leg: afterwards the GAME reports beam false, rockSet true — its own writes (the tape declared no seam)',
                    b.r.beam === false && b.r.rockSet === true, JSON.stringify({ beam: b.r.beam, rockSet: b.r.rockSet }));
            }

            if (SESSION === 'B') {
                // ⛔ The starter `seedling_atlas` preset embeds NO sphere log (only `seedling_atlas_location`
                // does), so the bot would have no queue ("no sphere log"). Its rules are all `True_`, so the
                // log they imply is one sphere: every location accessible at 0, collected at 0.1. Derived here
                // from the preset itself, refused if any rule is not `True_`, and loaded through sphereState's
                // own `loadSphereLog` — the bot reads it exactly as it reads an embedded one.
                // What the one-sphere log needs: the chest's own PATH is free (Menu → the hub → the house →
                // the chest, every rule `True_`). Other overworld exits carry `Has`/`Or` rules; the starter
                // atlas has no other location, so they decide nothing about this queue.
                const locs = Object.values(REGIONS).flatMap((r) => r.locations ?? []);
                const HOUSE_REGION = Object.keys(REGIONS).find((k) => (REGIONS[k].locations ?? []).length > 0);
                const path = [REGIONS.Menu.exits[0], REGIONS[START].exits.find((e) => e.connected_region === HOUSE_REGION),
                    ...REGIONS[HOUSE_REGION].locations];
                check(`B: one location, and its path (Menu → ${START} → ${HOUSE_REGION} → the chest) is all True_ — the implied log is ONE sphere`,
                    locs.length === 1 && path.every((x) => x && (x.access_rule?.rule ?? 'True_') === 'True_'),
                    JSON.stringify(path.map((x) => [x?.name, x?.access_rule?.rule])));
                const accessible = ['Menu', START, HOUSE_REGION];
                const items = Object.fromEntries(locs.map((l) => [l.item.name, 1]));
                const LOG = [
                    { type: 'metadata', seed: 1, seed_name: '', event_locations: {}, event_items: {} },
                    { type: 'state_update', sphere_index: '0', player_data: { 1: { new_inventory_details: { base_items: {}, resolved_items: {} },
                        new_accessible_locations: locs.map((l) => l.name), new_accessible_regions: accessible, sphere_locations: [] } } },
                    { type: 'state_update', sphere_index: '0.1', player_data: { 1: { new_inventory_details: { base_items: items, resolved_items: items },
                        new_accessible_locations: [], new_accessible_regions: [], sphere_locations: locs.map((l) => l.name) } } },
                ].map((e) => JSON.stringify(e)).join('\n');
                const loaded = await page.evaluate(async (text) => {
                    const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                    const ok = await getSphereStateSingleton().loadSphereLog('probe-seedling-wasm-level0:seedling_atlas-implied', text);
                    return { ok, spheres: (getSphereStateSingleton().getSphereData() ?? []).length };
                }, LOG);
                check(`B: the implied sphere log loaded (${locs.length} location(s): ${locs.map((l) => l.name).join(', ')})`, loaded.ok, JSON.stringify(loaded));
                const before = await ap();
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
                check(`B: the bot is mounted, in the start region ${START} (the hub)`, booted.ok && booted.region === START, JSON.stringify(booted));
                await clickPanelTab(page, FLASH_PANEL).catch(() => null);
                const t0 = Date.now();
                let last = '';
                let end = null;
                while (Date.now() - t0 < 240000) {
                    // eslint-disable-next-line no-await-in-loop
                    end = await page.evaluate(async () => {
                        const { getActivePanel } = await import('./modules/playbackBot/index.js');
                        const bot = getActivePanel()?.getBot?.();
                        return { status: bot?.getStatus?.() ?? '', log: (bot?.getLog?.() ?? []).slice(-40) };
                    });
                    if (end.status !== last) { console.log(`INFO: +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`); last = end.status; }
                    if (end.status.startsWith('finished') || end.status.startsWith('error')) break;
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(500);
                }
                const eng = await page.evaluate(async () => {
                    const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
                    const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
                    const e = c?._wasmEngine ?? null;
                    return e ? JSON.parse(JSON.stringify({ stats: e.stats, reads: e.arrivalReads, lastRefusal: c.lastRefusal })) : null;
                });
                const apB = await ap();
                const hist = eng?.stats?.history ?? [];
                console.log(`INFO: B engine history ${JSON.stringify(hist.map((h) => ({ goal: h.goal && { kind: h.goal.kind, level: h.goal.level, name: h.goal.name },
                    outcome: h.outcome, producer: h.producer, ticks: h.ticks, drained: h.drained, divergence: h.divergence })))}`);
                console.log(`INFO: B checks ${JSON.stringify(apB.checks)}; binding ${JSON.stringify(apB.binding)}; last log ${JSON.stringify((end?.log ?? []).slice(-6))}`);
                check('B: the bot FINISHED the starter atlas on wasm (status finished, no error:)', (end?.status ?? '').startsWith('finished'),
                    `status "${end?.status}"`);
                const first = hist[0] ?? {};
                const r0 = (eng?.reads ?? []).find((rd) => rd.status?.level === 0);
                const st0 = r0 ? restage(r0) : null;
                check('B: the FIRST leg is the hub → house door, served at a level-0 arrival (W1–W4 refused it: the moonrock)',
                    first.goal?.level === 0 && first.goal?.kind === 'exit' && ['done', 'stopped'].includes(first.outcome) && !first.divergence
                        && st0?.level === 0 && st0.beam === false && st0.rockSet === false,
                    JSON.stringify({ first: { goal: first.goal, outcome: first.outcome, ticks: first.ticks, drained: first.drained }, staged: st0 }));
                const chestChecks = apB.checks.filter((n) => n === CHEST).length - before.checks.filter((n) => n === CHEST).length;
                check(`B: "${CHEST}" checked ONCE`, chestChecks === 1, JSON.stringify(apB.checks));
                check('B: 0 divergences, 0 recoveries over the whole walk', hist.every((h) => !h.divergence) && (eng?.stats?.recoveries ?? 0) === 0,
                    JSON.stringify(hist.map((h) => h.outcome)));
            }
            const exits = logs.filter((l) => /heap_alloc|ExitStatus|out of memory/.test(l));
            if (exits.length) console.log(`INFO: the game's memory: ${exits.slice(-3).join(' | ')}`);
        } catch (e) {
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
        }
        await page.close();
        return rp.failures();
    }
}
