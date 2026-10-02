#!/usr/bin/env node
/**
 * Seedling JS solver-walk, slice W2 (plan `seedling-js-solver-walk-plan.md` §5.3) — the WASM
 * PlaybackController's witness: on `seedling_atlas_location` (default build p4e, headless
 * logic-only, under the box lock) the Playback Bot opens the Starting House chest and leaves by its
 * door ON THE WASM RUNTIME — each goal solved at an arrival in the S2 Worker and shipped to the game
 * as ONE host tape (`flashPanel/seedlingWasmPlayback.js`).
 *
 *   G   ⚖ W0-Q1's guard, on the FRESH room before the bot runs: a zero-tick tape that declares the
 *       chest's clear {86,0} (unearned) is (a) refused by the engine's declaration rule
 *       (`exactDeclarationRefusal`, against the live botStatus) and (b) when started anyway,
 *       through the binding's arming window (`ignoreHostStart`), makes NO AP check — the binding
 *       counts it in `armingWindow`. The room is then restored by an honest zero-tick tape
 *       (declaring the live, empty set) and released (`botReset`). W0 ii.6 is the control: the same
 *       tape WITHOUT the guard fired the check.
 *   B   the bot: `onRegionMove(start)` (the dispatcher's own handler, as a test calls it), `play()`,
 *       then until the bot reports `finished` (or an `error:`): the chest checked ONCE, key_blue
 *       received ONCE, the binding's checks = 1 with no arming-window catch beyond G's, ONE
 *       regionMove out of the house (the glue's redirect, `region_2_3`), the engine's two goals
 *       done (the door's trajectory ends OUT of level 86 — "left 86"), every host botStart bracketed.
 *       W3 adds (c): 0 divergences, 0 recoveries on the undisturbed walk.
 *   R   (W3 (a), its own fresh page) the same bot walk with ONE injected divergence: on the chest's
 *       first plan tape the injector (`installInjector`, on the game window's 0 ms timer) presses
 *       ArrowRight for ~200 ms — a key the tape never pressed — so the drained rows leave the plan
 *       (measured: +0.8 px in x at tick 5–9). The engine `botReset`s, re-enters the house at the
 *       arrival's spawn, re-solves and replays: recoveries 1, the chest checked ONCE, the door
 *       crossed, every botStart bracketed.
 *   P   (W3 (b), its own fresh page) the injector fires on EVERY chest plan: after 3 recoveries the
 *       4th divergence fails BY NAME (`playback:walkFailed` → the bot's `error:` status), no check
 *       fired, AP inventory/checked unchanged, nothing armed or held, and no STALE key (the engine
 *       releases the keys the diverged plan held — `keysHeldAtReset`; W3's own finding).
 *   K   (side mode, `--only=K`; not in the default run) the KILL-LOCK measurement S3 left to W2: a host
 *       jump into L5 (its lock opens on a kill), then the engine serves the teleporter exit with
 *       the lock clear left UNDECLARED (the solve runs scratch persistence, the model writes the
 *       clear as `Lock.turnOff` does) — does the game clear it itself, on the plan, and cross to L6?
 *
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED` (exit 1 on a fail).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build
 * (the `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * The default run is three sessions, each on a fresh page: G+B, R, P.
 *
 * Run: node scripts/procgen/probe-seedling-wasm-playback.mjs [--host=http://localhost:8000] [--only=G|B|GB|R|P|K]
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

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/** In the game frame: count the tape verbs (never blocks one). */
function installCounters() {
    const game = window.__swfBridge.game;
    if (window.__w2) return true;
    const calls = { botLoadTape: 0, botStart: 0, botReset: 0, botStatus: 0, botDrain: 0, botSeam: 0 };
    for (const name of Object.keys(calls)) {
        const orig = game[name].bind(game);
        game[name] = (...a) => { calls[name] += 1; return orig(...a); };
    }
    window.__w2 = { calls };
    return true;
}

/**
 * In the PAGE: the W3 divergence injector. On the game window's own 0 ms timer it watches the
 * controller's wasm engine; each time a NEW plan tape starts playing for a location goal it presses
 * ArrowRight into the game for ~200 ms (a synthetic keydown/keyup on the canvas, which bubbles to
 * every target the emscripten runtime listens on) — a key the tape never pressed, so the game's
 * drained rows leave the plan. `once` fires on the first such tape only; `always` on every one.
 */
async function installInjector({ mode, wasmPage }) {
    const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
    const frame = [...document.querySelectorAll('iframe')].find((f) => f.src.includes(wasmPage));
    const gw = frame?.contentWindow;
    if (!gw?.__swfBridge?.game) return 'no game window';
    const inj = { mode, injected: [], seenShips: 0, stop: false };
    window.__w3inj = inj;
    const press = (type) => {
        const ev = new gw.KeyboardEvent(type, { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'keyCode', { get: () => 39 });
        Object.defineProperty(ev, 'which', { get: () => 39 });
        (gw.document.getElementById('canvas') ?? gw.document.body).dispatchEvent(ev);
    };
    const loop = () => {
        if (inj.stop) return;
        const e = substrateRegistry.get('flash_seedling')?.getPlaybackController?.()?._wasmEngine;
        if (e) {
            const s = e.status();
            const ships = e.stats.ships;
            if (s.phase === 'playing' && ships > inj.seenShips && s.goal?.kind === 'location') {
                inj.seenShips = ships;
                if (mode === 'always' || inj.injected.length === 0) {
                    inj.injected.push({ ship: ships, drained: s.drained, recoveries: s.recoveries });
                    gw.setTimeout(() => press('keydown'), 150);
                    gw.setTimeout(() => press('keyup'), 350);
                }
            }
        }
        gw.setTimeout(loop, 0);
    };
    gw.setTimeout(loop, 0);
    return true;
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-playback.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ONLY = arg('only', '');
    const GAME = 'seedling_atlas_location';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const FLASH_DIR = join(REPO, 'frontend/modules/flashPanel');
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(FLASH_DIR, 'wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const SD = join(REPO, 'frontend/modules/seedlingDemo');
    const { parseTape, gameVisibleTape } = await import(join(SD, 'tapeFormat.js'));
    const { exactDeclarationRefusal } = await import(join(SD, 'wasmPlayback.js'));

    const REGIONS = PRESET.regions['1'];
    const SIDECARS = PRESET.preset_sidecars['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const ROOM = SIDECARS[START].playable_payload;
    const CHILD = ROOM.exits[0].targetRegion;
    const CHEST = REGIONS[START].locations.find((l) => l.item?.name === 'key_blue').name;
    const ITEM = 'key_blue';

    /** A zero-tick game-visible tape at the house spawn declaring `persistence`. */
    const zeroTick = ({ x, y, persistence }) => gameVisibleTape(parseTape({
        tape_version: 8, game: 'seedling', noclip: false, boot: { level: ROOM.level, x, y }, inputs: [],
        noDamage: false, noHazards: [], grants: [], equips: [], pins: [],
        persistence: persistence.map((p) => ({ level: p.level, tag: p.tag, note: 'w2-guard' })),
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 0, split: false, cosmetic: 0, fp: 0 } }));

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    // Each session on a FRESH page (fresh room, fresh AP state): G+B (the W2 witness, + W3's "0 recoveries"),
    // R (one injected divergence recovers), P (a persistent one fails by name after 3).
    const SESSIONS = ONLY ? [ONLY] : ['GB', 'R', 'P'];
    let failed = 0;
    for (const MODE of SESSIONS) {
        console.log(`INFO: ── session ${MODE} ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(MODE);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(MODE) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `w3-${MODE}` });
    const { check } = rp;
    const w = (fn, a) => rp.gameFrame().evaluate(fn, a);
    const ap = () => page.evaluate(async () => {
        const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
        const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
        return { inv: snap?.inventory ?? {}, checked: [...(snap?.checkedLocations ?? [])],
            checks: [...(window.__checks ?? [])], glue: glue?.stats ?? null,
            binding: glue?.checkBinding ? { ...glue.checkBinding.stats, checked: [...glue.checkBinding.checked] } : null };
    });
    const engineStats = () => page.evaluate(async () => {
        const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
        const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
        const s = c?._wasmEngine?.stats ?? null;
        return s ? JSON.parse(JSON.stringify({ ...s, lastRefusal: c.lastRefusal, status: c.status() })) : null;
    });
    try {
        await page.goto(`${HOST}/frontend/?game=${GAME}&seed=1`, { waitUntil: 'domcontentloaded' });
        await rp.waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
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
            if (!d.__w2) {
                const orig = d.publish.bind(d);
                d.publish = (n, p, o) => {
                    if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                    return orig(n, p, o);
                };
                d.__w2 = true;
            }
            return true;
        }), 20000);
        await page.waitForTimeout(1500);
        await w(installCounters);
        const status = async () => JSON.parse(await w(() => window.__swfBridge.game.botStatus()));
        const state0 = await rp.readGameState();
        const ap0 = await ap();
        check('the fresh room: the player in the house, nothing checked', state0.level === ROOM.level
            && ap0.checks.length === 0, `level ${state0.level}, checks ${JSON.stringify(ap0.checks)}`);

        if (MODE === 'K') {
            // ── K: the kill lock, undeclared ──────────────────────────────────
            const { returnSpawnTable, returnKey } = await import(join(FLASH_DIR, 'seedlingReturnSpawns.js'));
            const MAP = JSON.parse(readFileSync(join(FLASH_DIR, 'atlases/seedling-map.json'), 'utf8'));
            const PT = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
            const L5 = PT.preset_sidecars['1'].level_5__r1c5.playable_payload;
            const from = L5.exits.find((e) => e.exit_id === 'in_L4_64_16');
            const to = L5.exits.find((e) => e.exit_id === 'out_teleporter_48_112');
            const spawn = returnSpawnTable(MAP).get(returnKey(5, ...from.exit_tiles[0])) ?? from.entrance_spawn;
            await rp.jump(5, spawn.x, spawn.y);
            await rp.waitFor('the player in L5', async () => ((await rp.readGameState()).level === 5 ? 5 : null), 10000);
            await page.waitForTimeout(1500);
            const out = await page.evaluate(async ({ goal }) => {
                const panel = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                const s = panel.seedlingPlaybackSurface();
                const mod = await import(new URL('modules/flashPanel/seedlingWasmPlayback.js', document.baseURI).href);
                const notes = [];
                let failed = null;
                const engine = await mod.loadWasmPlaybackEngine({ mapPath: s.wasm.mapPath, baseUrl: document.baseURI,
                    getGame: s.wasm.getGame, getWin: s.wasm.getWin, teleport: s.wasm.teleport,
                    getCheckBinding: () => glue.checkBinding, onNote: (n) => notes.push(n), onFailed: (r) => { failed = r; } });
                window.__w2k = engine;
                const answer = engine.walkTo(goal);
                const t0 = performance.now();
                while (performance.now() - t0 < 90000) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 250); });
                    if (failed || engine.stats.done > 0) break;
                    const lv = JSON.parse(s.wasm.getGame().readState()).level;
                    if (lv === 6 && engine.status().phase === 'playing') { engine.stop(); break; }
                }
                const st = JSON.parse(s.wasm.getGame().botStatus());
                return { answer, failed, notes: notes.filter(Boolean).slice(-6), stats: JSON.parse(JSON.stringify(engine.stats)),
                    level: st.level, cleared: st.persistence_cleared };
            }, { goal: { kind: 'exit', level: 5, tiles: to.exit_tiles, name: to.exit_id } });
            console.log(`INFO: K ${JSON.stringify(out)}`);
            const leg = out.stats.history.at(-1) ?? {};
            check('K: the engine accepted the L5 teleporter goal and solved it with a kill', out.answer?.ok
                && (leg.verbs ?? []).includes('kill'), JSON.stringify({ answer: out.answer, verbs: leg.verbs, failed: out.failed }));
            check('K: the game cleared the kill lock ITSELF ({5,0} in its cleared set; the tape declared none)',
                out.cleared.some((c) => c.level === 5 && c.tag === 0)
                    && out.stats.hostStarts.length >= 2, JSON.stringify(out.cleared));
            check('K: every planned tick stepped ON PLAN (no divergence) and the game crossed to L6',
                !leg.divergence && leg.drained >= leg.ticks && out.level === 6, JSON.stringify({ leg, level: out.level }));
        }

        if (MODE === 'GB' || MODE === 'G') {
            // ── G: the guard ───────────────────────────────────────────────────
            const st0 = await status();
            const fake = zeroTick({ x: state0.playerPositionX, y: state0.playerPositionY, persistence: [{ level: ROOM.level, tag: 0 }] });
            const why = exactDeclarationRefusal(fake, st0);
            check('G: the engine\'s declaration rule REFUSES a tape declaring the unearned chest clear {86,0}',
                !!why && /FAKE check/.test(why), why);
            const window0 = await page.evaluate(async (tapeJson) => {
                const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                const { parsePendingCheck } = await import('./modules/flashPanel/seedlingCheckBinding.js');
                const game = document.querySelector('iframe')?.contentWindow?.__swfBridge?.game
                    ?? [...document.querySelectorAll('iframe')].map((f) => f.contentWindow?.__swfBridge?.game).find(Boolean);
                const seq = () => parsePendingCheck(JSON.parse(game.readState()).pendingCheck)?.seq ?? 0;
                const from = seq();
                const load = game.botLoadTape(tapeJson);
                const start = game.botStart();
                const to = seq();
                const armed = glue.checkBinding.ignoreHostStart({ from, to });
                return { from, to, load, start, armed };
            }, JSON.stringify(fake));
            await page.waitForTimeout(1500);
            const apG = await ap();
            console.log(`INFO: G window ${JSON.stringify(window0)}; binding ${JSON.stringify(apG.binding)}`);
            check('G: the fake tape was started (load/start ok) and its re-fire fell in the window (to > from)',
                window0.load === 'ok' && window0.start === 'ok' && window0.to > window0.from && window0.armed, JSON.stringify(window0));
            check('G: NO AP check from the unearned declaration (dispatcher, state manager, binding)',
                apG.checks.length === 0 && !apG.checked.includes(CHEST) && apG.binding.checks === 0,
                `checks ${JSON.stringify(apG.checks)}, binding checks ${apG.binding.checks}`);
            check('G: the binding CAUGHT it (armingWindow 1)', apG.binding.armingWindow === 1, `armingWindow ${apG.binding.armingWindow}`);
            check(`G: ${ITEM} NOT received`, (apG.inv[ITEM] ?? 0) === 0, `${ITEM} ${apG.inv[ITEM] ?? 0}`);
            // Restore: an honest zero-tick tape (the live set — empty), then release.
            const honest = zeroTick({ x: state0.playerPositionX, y: state0.playerPositionY, persistence: [] });
            const restored = await w((t) => {
                const g = window.__swfBridge.game;
                return { load: g.botLoadTape(t), start: g.botStart() };
            }, JSON.stringify(honest));
            await page.waitForTimeout(800);
            await w(() => window.__swfBridge.game.botReset());
            const stR = await status();
            check('G: restored — the honest tape re-declared the live (empty) set; the chest flag is back',
                restored.load === 'ok' && restored.start === 'ok' && stR.persistence_cleared.length === 0,
                `${JSON.stringify(restored)}; cleared ${JSON.stringify(stR.persistence_cleared)}`);
        }

        if (['GB', 'B', 'R', 'P'].includes(MODE)) {
            // ── B: the Playback Bot on the wasm runtime ───────────────────────
            // R/P: the W3 divergence INJECTOR rides the game window's own 0 ms timer (the engine's
            // sampler arrangement) and fires on the chest's plan tapes: R on the FIRST only, P on EVERY one.
            if (MODE === 'R' || MODE === 'P') {
                const inj = await page.evaluate(installInjector, { mode: MODE === 'P' ? 'always' : 'once', wasmPage: WASM_PAGE });
                check(`${MODE}: the divergence injector is armed on the game window`, inj === true, String(inj));
            }
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
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                const sphere = getSphereStateSingleton().getSphereData() ?? [];
                bot.onRegionMove({ targetRegion: start });
                bot.refresh();
                await bot.play();
                return { ok: true, sphere: sphere.flatMap((s) => s.locations ?? []), region: bot.getCurrentRegion() };
            }, START);
            check('B: the bot is mounted, in the start region, with the embedded sphere log', booted.ok
                && booted.region === START && booted.sphere[0] === CHEST, JSON.stringify(booted));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const t0 = Date.now();
            let last = '';
            let end = null;
            while (Date.now() - t0 < 180000) {
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
            const apB = await ap();
            const eng = await engineStats();
            const inj = (MODE === 'R' || MODE === 'P') ? await page.evaluate(() => {
                const i = window.__w3inj;
                if (i) i.stop = true;
                return i ? { injected: i.injected } : null;
            }) : null;
            if (inj) console.log(`INFO: ${MODE} injections ${JSON.stringify(inj)}`);
            const hist = eng?.history ?? [];
            const bracketed = (eng?.hostStarts?.length ?? 0) === 2 * hist.length && eng.hostStarts.every((h) => h.to >= h.from);
            const moves = await rp.glueMoves();
            const calls = await w(() => window.__w2.calls);
            console.log(`INFO: engine ${JSON.stringify(eng)}`);
            console.log(`INFO: glue moves ${JSON.stringify(moves.map((m) => m.targetRegion ?? m.destinationRegion ?? m))}`);
            console.log(`INFO: verb calls ${JSON.stringify(calls)}; binding ${JSON.stringify(apB.binding)}`);
            if (MODE === 'P') {
                // ── P: a PERSISTENT divergence — 3 recoveries, then FAILED by name ──
                const legs = hist.filter((h) => h.goal?.kind === 'location');
                check('P: the bot shows the engine\'s named failure (status error:, the count and the bound)',
                    /^error:/.test(end?.status ?? '') && /the game left the plan 4 times/.test(end.status)
                        && /gave up after 3 forced re-arrivals, the bound is 3/.test(end.status), `status "${end?.status}"`);
                check('P: the engine recorded 3 recoveries then the failure (4 plans played, 4 injections)',
                    eng?.recoveries === 3 && JSON.stringify(legs.map((h) => h.outcome)) === JSON.stringify(['diverged', 'diverged', 'diverged', 'failed'])
                        && eng.ships === 4 && inj?.injected.length === 4,
                    JSON.stringify({ recoveries: eng?.recoveries, outcomes: legs.map((h) => h.outcome), ships: eng?.ships, injected: inj?.injected.length }));
                check('P: every divergence is a real (level, x, y) miss in the house (no level change, x off the plan)',
                    legs.slice(0, 3).every((h) => h.divergence && h.divergence.got.level === ROOM.level
                        && h.divergence.got.x !== h.divergence.expected.x), JSON.stringify(legs.map((h) => h.divergence)));
                // ⛔ W3's own finding: botReset mid-span leaves the tape's keys HELD, so the next plan's press is
                // lost (measured before the fix: attempt 2's echo `held ["right","up"]`, `press_totals.up 0`; once a
                // stale `down` cancelled the next plan's `up` and it diverged at tick 1 with the player still).
                const stale = legs.filter((h) => h.input).map((h) => (h.input.held ?? []).filter((k) => !(h.input.press_totals?.[k] >= 1)));
                check('P: no STALE key — every key the game held at each divergence was pressed by THAT tape (the host releases the plan\'s held keys after each botReset with a keydown+keyup pair)',
                    stale.length === 3 && stale.every((x) => x.length === 0) && (eng.keyReleases?.length ?? 0) >= 3,
                    JSON.stringify({ stale, keyReleases: eng?.keyReleases, inputs: legs.map((h) => h.input && { held: h.input.held, press: h.input.press_totals }) }));
                const chestChecks = apB.checks.filter((n) => n === CHEST).length - before.checks.filter((n) => n === CHEST).length;
                check('P: NO check fired — dispatcher, state manager, binding (0 checks, nothing caught in a host window)',
                    chestChecks === 0 && !apB.checked.includes(CHEST) && apB.binding.checks === (before.binding.checks ?? 0)
                        && apB.binding.armingWindow === (before.binding.armingWindow ?? 0),
                    `checks +${chestChecks}, binding ${JSON.stringify(apB.binding)}`);
                check('P: AP state intact — inventory and checked locations exactly as before the bot',
                    JSON.stringify(apB.inv) === JSON.stringify(before.inv)
                        && JSON.stringify([...apB.checked].sort()) === JSON.stringify([...before.checked].sort()),
                    JSON.stringify({ before: before.inv, after: apB.inv }));
                check('P: no region move (the bot never left the house)', moves.filter((m) => m.targetRegion === CHILD).length === 0,
                    JSON.stringify(moves.map((m) => m.targetRegion)));
                const stP = await status();
                check('P: nothing of ours left armed or held; the engine idle; the room is the player\'s',
                    !stP.armed && !stP.held && eng?.status?.state === 'idle' && stP.level === ROOM.level,
                    JSON.stringify({ armed: stP.armed, held: stP.held, engine: eng?.status?.state, level: stP.level }));
                check('P: every host botStart bracketed by seq reads (freeze + plan per attempt)', bracketed, JSON.stringify(eng?.hostStarts));
            } else {
            const errs = (end?.log ?? []).filter((l) => typeof l === 'string' && l.startsWith('error:'));
            check('B: the bot reached the end of the chest + door legs (status finished, or past the house) with no error: status',
                errs.length === 0 && (end?.status.startsWith('finished') || moves.some((m) => m.targetRegion === CHILD)),
                `status "${end?.status}", errors ${JSON.stringify(errs)}`);
            const chestChecks = apB.checks.filter((n) => n === CHEST).length - before.checks.filter((n) => n === CHEST).length;
            check('B: the chest checked EXACTLY ONCE on the dispatcher', chestChecks === 1, `${chestChecks}`);
            check('B: the state manager holds the chest checked', apB.checked.includes(CHEST));
            check(`B: ${ITEM} received ONCE`, (apB.inv[ITEM] ?? 0) === 1, `${ITEM} ${apB.inv[ITEM] ?? 0}`);
            check('B: 0 fake checks — the binding made one check, and caught nothing new in a host botStart window',
                apB.binding.checks === 1 && apB.binding.armingWindow === (before.binding.armingWindow ?? 0),
                `checks ${apB.binding.checks}, armingWindow ${before.binding.armingWindow}→${apB.binding.armingWindow}`);
            const out = moves.filter((m) => m.targetRegion === CHILD);
            check(`B: the crossing out of the house reported ONCE (→ ${CHILD})`, out.length === 1, JSON.stringify(moves.map((m) => m.targetRegion)));
            const chestLeg = hist.filter((h) => h.goal?.kind === 'location').at(-1);
            const doorLeg = hist.find((h) => h.goal?.kind === 'exit');
            check('B: the engine served the chest at an arrival (solved, shipped, finished)', chestLeg?.outcome === 'done',
                JSON.stringify(chestLeg));
            // ⛓ The bot STOPS the flash_seedling controller on the substrate change its crossing causes
            // (`playbackBotUI.onRegionMove`), so the door leg normally ends `stopped`, after the crossing.
            // The post-crossing row latches only after the NEW world's fade, and the stop lands first:
            // the game's half of "left 86" is every planned tick stepped (on plan, below) + the crossing
            // the region binding reported (above).
            check('B: the engine served the door: every planned tick stepped, and the plan ends OUT of the house ("left 86")',
                (doorLeg?.outcome === 'done' || (doorLeg?.outcome === 'stopped' && doorLeg.phase === 'playing'))
                    && doorLeg.drained >= doorLeg.ticks && doorLeg.expectedEnd?.level !== ROOM.level && out.length === 1,
                JSON.stringify(doorLeg));
            check('B: neither leg left the plan inside the house (the W3 compare, recorded)',
                !chestLeg?.divergence && !doorLeg?.divergence, JSON.stringify([chestLeg?.divergence, doorLeg?.divergence]));
            check('B: every host botStart bracketed by seq reads (2 per attempt: freeze + plan)', bracketed,
                JSON.stringify(eng?.hostStarts));
            if (MODE === 'R') {
                // ── R: ONE injected divergence on the chest's first plan — recovered ──
                const legs = hist.filter((h) => h.goal?.kind === 'location');
                check('R: the chest\'s first plan DIVERGED in the house (x off the plan, the injected key) and was recovered ONCE',
                    eng?.recoveries === 1 && legs.length === 2 && legs[0].outcome === 'diverged' && legs[0].recovery === 1
                        && legs[0].divergence?.got.level === ROOM.level && legs[0].divergence.got.x !== legs[0].divergence.expected.x
                        && inj?.injected.length === 1,
                    JSON.stringify({ recoveries: eng?.recoveries, legs: legs.map((h) => [h.outcome, h.divergence]), injected: inj?.injected }));
                check('R: the recovered chest leg finished ON PLAN with recoveries 1 (re-entered, re-solved, played)',
                    chestLeg?.outcome === 'done' && chestLeg.recoveries === 1 && !chestLeg.divergence && eng.ships === 3,
                    JSON.stringify(chestLeg));
            } else {
                check('B/(c): 0 divergences, 0 recoveries on the undisturbed walk', eng?.divergences === 0 && eng?.recoveries === 0,
                    JSON.stringify({ divergences: eng?.divergences, recoveries: eng?.recoveries }));
            }
            console.log(`INFO: divergences recorded: ${JSON.stringify(hist.map((h) => h.divergence))}`);
            }
        }
        console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
        const wp = logs.filter((l) => /wasm playback|\[playback\]/.test(l));
        if (wp.length) console.log(`INFO: playback log lines:\n  ${wp.slice(-30).join('\n  ')}`);
    } catch (e) {
        check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
    }
    await page.close();
    return rp.failures();
    }
}
