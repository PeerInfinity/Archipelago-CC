/**
 * Seedling JS runtime (slice J1) — a GENERATED Seedling room played in the
 * flash panel by the JavaScript model instead of the wasm build.
 *
 * With `moduleSettings.flashPanel.runtime: 'js'` the panel mounts
 * `seedlingDemo/jsRuntime.html`, which speaks the wasm page's `__swfBridge`
 * contract; the host glue is unchanged. The row loads `seedling_generated_room`,
 * waits for the panel's own AP load (the generated arm: delivery, reset, bind),
 * then walks the start room BY KEYS — synthetic `keydown`/`keyup` on the game
 * canvas, exactly what a person's keyboard sends — to the AP item and then onto
 * the door to the other generated room, and asserts what the APP saw: the
 * location checked in the state manager, and the AP region moved in gameState.
 *
 * ⛔ The route is planned off the rooms the PAGE mounted (its test handle
 * `__seedlingJsRuntime`), never typed; the keys are steered closed-loop off the
 * live position. That is a test's fingers (`jsRuntimeTestWalk.js`), not the
 * playback bot — the bot is slice J2.
 *
 * Needs no wasm artifact, which is why it can be an in-app row at all (the
 * wasm flavour of the same walk is the box gate
 * `check-seedling-generated-room-play.mjs`). It sets the runtime setting as a
 * SESSION override and restores the previous value however it ends.
 */

import { registerTest } from '../testRegistry.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { getActivePanelInstance, getSeedlingPlayClock, getSeedlingRegionGlue } from '../../flashPanel/index.js';
import { PLAY_CLOCK_EVENT } from '../../flashPanel/seedlingPlayClock.js';
import { RUFFLE_VERSION } from '../../flashPanel/ruffleCdn.js';
import { cachesText, churnText } from '../../flashPanel/seedlingSolveProgress.js';
import { DANGER_COLOUR } from '../../flashPanel/seedlingSolveProgressView.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { getActivePanel as getBotPanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { returnKey, returnSpawnTable } from '../../flashPanel/seedlingReturnSpawns.js';
import { GOAL_ITEM } from '../../procgenCore/goalItem.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { resolveQueueBlocks } from '../../loops/blockIdentity.js';
import { restoresSavedQueues } from '../savedQueueIsolation.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { CAMERA_SETTING_KEY, GRAPHICS_SETTING_KEY } from '../../flashPanel/seedlingGraphicsSettings.js';

/**
 * ⛔ The walk helper imports `levelWorld.js`; a static import here would put
 * the JS model in `dist/bundle.js` (this file is a static import of
 * `init-bundled.js`). Reached through a computed, document-relative specifier
 * instead — `flashPanelUI._startSeedlingRandomizer`'s pattern.
 */
const loadWalk = () => import(/* @vite-ignore */ new URL(
    'modules/seedlingDemo/jsRuntimeTestWalk.js', document.baseURI).href);

const PRESET_PATH = './presets/seedling_generated_room/AP_1/AP_1_rules.json';
const RUNTIME_KEY = 'moduleSettings.flashPanel.runtime';
const CODE_FOR = Object.freeze({ left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' });
const STEP_MS = 40;

/**
 * The row's CATEGORY, which picks its CI batch (testBatches.js): the JS-runtime rows are `seedling-js`; the wasm
 * and Flash rows (a wasm row boots the recompiled game, which needs the WebGPU launch) are `seedling-wasm`. Split on
 * 2026-10-28, when the one batch reached 94 % of its budget. Batch membership only: no row's logic depends on it.
 */
const seedlingRuntimeCategory = (id) => (id.startsWith('seedling-js-') ? 'Seedling JS runtime' : 'Seedling wasm runtime');

function readCurrentRegion() {
    try {
        const gs = getGameStateSingleton();
        return gs?.getCurrentRegion?.() ?? gs?.currentRegion ?? null;
    } catch { return null; }
}

function frameOf(panel) {
    const el = panel ? document.getElementById(panel.flashObjectId) : null;
    try { return el?.contentWindow ?? null; } catch { return null; }
}

/** Hold exactly `held` (tape key names) on the frame's canvas, releasing the rest. */
function makeKeys(win) {
    const canvas = win.document.querySelector('canvas');
    const down = new Set();
    const send = (type, code) => canvas.dispatchEvent(new win.KeyboardEvent(type, {
        code, key: code, bubbles: true, cancelable: true,
    }));
    return {
        hold(held) {
            const want = new Set([...held].map((k) => CODE_FOR[k]).filter(Boolean));
            for (const c of [...down]) if (!want.has(c)) { send('keyup', c); down.delete(c); }
            for (const c of want) if (!down.has(c)) { send('keydown', c); down.add(c); }
        },
        releaseAll() { this.hold(new Set()); },
    };
}

/** Walk the live run to `to` in its current room; resolves when `until()` or the route ends. */
async function walkTo(tc, rt, keys, to, { allow = [], until = () => false, maxMs = 30000 } = {}) {
    const { cellOf, routeWalker, tileRoute } = await loadWalk();
    const run = rt.run;
    const route = tileRoute(rt.mounted.records.get(run.level), cellOf(run.state.x, run.state.y), to, { allow });
    tc.reportCondition(`a route from the player's cell to (${to.tx},${to.ty}) in level ${run.level}`, !!route);
    if (!route) return false;
    const walker = routeWalker(route);
    const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
        if (until()) break;
        const live = rt.run;
        if (!live) break;
        keys.hold(walker.next(live.state.x, live.state.y));
        if (walker.done && !until()) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, STEP_MS));
    }
    keys.releaseAll();
    return until() || walker.done;
}

export async function seedlingJsRuntimePlaysGeneratedRoom(tc) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    let keys = null;
    try {
        await settingsManager.updateSetting(RUNTIME_KEY, 'js', { persist: false });
        tc.log('runtime = js (session override); loading seedling_generated_room…');
        // ⛔ THE PRODUCTION LOAD PATH, NOT `loadRulesFromFile`. The panel reads
        // the rules through stateManager's catch-up `getLastRawJsonData()`, which
        // only the production paths update; the controller's helper publishes
        // `rawJsonDataLoaded` itself and leaves the catch-up on the PREVIOUS
        // preset (measured: the generated census came back empty).
        const res = await fetch(PRESET_PATH);
        const rulesJson = await res.json();
        const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
        tc.eventBus.publish('files:jsonLoaded', {
            jsonData: rulesJson, selectedPlayerId: '1', sourceName: PRESET_PATH,
        });
        await loaded;
        await tc.stateManager.pingWorker('after-rules-load', 5000);
        tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });

        const panelLogTail = () => (document.querySelector('.flash-panel-log')?.textContent ?? '(no panel log)')
            .split('\n').slice(-25).join(' | ');
        const onJs = await tc.pollForValue(() => {
            const p = getActivePanelInstance();
            return p?.transport === 'js' && p.adapter ? p : null;
        }, 'the flash panel mounted the JS runtime page', 30000, 250);
        tc.assertEqual('the panel is on the JS transport', 'js', onJs?.transport ?? null);
        if (!onJs) {
            tc.log(`panel: ${JSON.stringify({ has: !!getActivePanelInstance(), transport: getActivePanelInstance()?.transport })}; log: ${panelLogTail()}`, 'error');
            return tc.getOverallResult();
        }
        const panel = await tc.pollForValue(() => (onJs._apLoadResult ? onJs : null),
            'the panel finished its AP load (the generated arm)', 30000, 250);
        if (!panel) {
            tc.log(`panel log: ${panelLogTail()}`, 'error');
            tc.reportCondition('the AP load finished', false);
            return tc.getOverallResult();
        }
        const load = panel._apLoadResult;
        tc.assertEqual('the generated arm delivered, reset and bound',
            'ok', load.ok && ['deliver-end', 'reset-end', 'bind'].every((n) => load.steps.some((s) => s.name === n))
                ? 'ok' : JSON.stringify({ ok: load.ok, why: load.why, steps: load.steps.map((s) => s.name) }));

        const win = frameOf(panel);
        const rt = win?.__seedlingJsRuntime ?? null;
        tc.assertEqual('the JS runtime page is the frame\'s game', true, !!rt?.run);
        if (!rt?.run) return tc.getOverallResult();
        const start = rt.mounted.set.start;
        tc.assertEqual('the run boots at the set\'s start level', start.level, rt.run.level);
        const startRegion = readCurrentRegion();
        tc.log(`AP region at start: ${startRegion}`);
        keys = makeKeys(win);

        // ── the AP item ───────────────────────────────────────────────────
        const apItem = rt.mounted.apItems.get(start.level)?.[0] ?? null;
        tc.assertEqual('the start room holds an AP item', true, !!apItem);
        if (!apItem) return tc.getOverallResult();
        const apCell = { tx: apItem.x / 16, ty: apItem.y / 16 };
        const apKey = `${start.level}:${apItem.tag}`;
        await walkTo(tc, rt, keys, apCell, { until: () => rt.collected.has(apKey) });
        tc.assertEqual('the apitem was collected by keys (the page reported pendingCheck)', true, rt.collected.has(apKey));
        // The location the room's apitem stands for: the start region's own.
        const expected = (() => {
            const p = tc.stateManager.getStaticData?.()?.locations;
            const names = p instanceof Map ? [...p.keys()] : Object.keys(p ?? {});
            return names.find((n) => n.startsWith(`${startRegion}__`)) ?? null;
        })();
        const checked = await tc.pollForValue(() => {
            const snap = tc.stateManager.getSnapshot?.();
            const list = snap?.checkedLocations ?? [];
            return expected && (Array.isArray(list) ? list : [...list]).includes(expected) ? expected : null;
        }, `the state manager checked ${expected}`, 10000, 200);
        tc.assertEqual('the AP location was checked through the real dispatcher', expected, checked);

        // ── the door to the other generated room ──────────────────────────
        const doors = (rt.run.world.teleporters ?? []).filter((tp) => !tp.deactivated);
        const door = doors.find((tp) => tp.to !== start.level && rt.mounted.set.rooms[tp.to]?.name !== 'parking');
        tc.assertEqual('the start room has a door to another generated room', true, !!door);
        if (!door) return tc.getOverallResult();
        const doorCell = { tx: door.x / 16, ty: door.y / 16 };
        const targetRegion = rt.mounted.set.rooms[door.to].name;
        await walkTo(tc, rt, keys, doorCell, { allow: [doorCell], until: () => rt.run?.level === door.to });
        tc.assertEqual('the door took the run into its room', door.to, rt.run?.level ?? null);
        const moved = await tc.pollForValue(() => (readCurrentRegion() === targetRegion ? targetRegion : null),
            `gameState moved to ${targetRegion}`, 10000, 200);
        tc.assertEqual('the crossing moved the AP region (user:regionMove)', targetRegion, moved);
        tc.assertEqual('no death and no halt on the way', '0/null',
            `${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        keys?.releaseAll();
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-generated-room',
    name: 'Seedling JS runtime: a generated room plays by keys (check + crossing)',
    description: 'With flashPanel.runtime = js, loads seedling_generated_room: the panel mounts the JS '
        + 'runtime page, the generated arm delivers and resets, synthetic keys walk the player to the '
        + 'AP item (a real user:locationCheck) and through the door to the other generated room (a real '
        + 'user:regionMove). No wasm artifact needed.',
    testFunction: seedlingJsRuntimePlaysGeneratedRoom,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── Seedling JS J2: the Playback Bot ────────────────────────────────────────

/**
 * Mount the bot panel, set the runtime, load the preset by the PRODUCTION path
 * (J1's trap: `loadRulesFromFile` leaves the catch-up on the previous preset),
 * and wait for the flash panel on `transport`. Returns `{bot, panel}` or null.
 */
async function botOnSeedlingPreset(tc, runtime, { presetPath = PRESET_PATH, sphereLog = true } = {}) {
    // The bot panel must be mounted BEFORE the rules load: procgenPlayer's
    // synthetic initial user:regionMove is how it learns its start region.
    tc.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
    const botPanel = await tc.pollForValue(() => getBotPanel(), 'playback bot panel instance', 5000, 100);
    const bot = botPanel?.getBot?.() ?? null;
    tc.reportCondition('the playback bot is mounted', !!bot);
    if (!bot) return null;
    bot.reset?.();

    // ⛔ THE PANEL MAY ALREADY BE ON THIS PRESET AND RUNTIME (the J1 row runs
    // just before this one in the fast batch): its adapter, AP load and page
    // are then the PREVIOUS row's, and every poll below would answer at once
    // off a panel that is about to re-initialize for the new rules load.
    // Measured: "the JS runtime page is up" failed 1.3 s in. So wait for an
    // adapter that is not the one in place before the load.
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    await settingsManager.updateSetting(RUNTIME_KEY, runtime, { persist: false });
    tc.log(`runtime = ${runtime} (session override); loading ${presetPath}…`);
    const rulesJson = await (await fetch(presetPath)).json();
    const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: presetPath });
    await loaded;
    await tc.stateManager.pingWorker('after-rules-load', 5000);
    tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });

    const transport = runtime === 'js' ? 'js' : 'wasm';
    const panel = await tc.pollForValue(() => {
        const p = getActivePanelInstance();
        return p?.transport === transport && p.adapter && p.adapter !== staleAdapter && p._initRuntime === runtime ? p : null;
    }, `the flash panel mounted the ${transport} transport (a fresh adapter)`, 30000, 250);
    tc.assertEqual(`the panel is on the ${transport} transport`, transport, panel?.transport ?? null);
    if (!panel) return null;
    if (!sphereLog) return { bot, panel };

    const sphereState = getSphereStateSingleton();
    const sphereLoaded = await tc.pollForCondition(() => (sphereState.getSphereData()?.length ?? 0) > 0,
        'the preset\'s EMBEDDED sphere log was loaded', 10000, 200);
    tc.reportCondition('embedded sphere log loaded', !!sphereLoaded);
    if (!sphereLoaded) return null;
    bot.refresh();
    return { bot, panel };
}

/** `error:` statuses, read off the bot's LOG (every distinct status, so a transient one is not missed). */
const errorStatuses = (bot) => (bot.getLog?.() ?? []).filter((l) => typeof l === 'string' && l.startsWith('error:'));

/** Every region gameState's PATH records a landed regionMove into — the cross-region witness. */
function walkedRegions() {
    const gs = getGameStateSingleton();
    return (gs?.getPath?.() ?? []).filter((e) => e.type === 'regionMove').map((e) => e.destinationRegion).filter(Boolean);
}

export async function seedlingJsRuntimeBotCompletesGeneratedRoom(tc) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        const ready = await botOnSeedlingPreset(tc, 'js');
        if (!ready) return tc.getOverallResult();
        const { bot, panel } = ready;
        const ap = await tc.pollForValue(() => (panel._apLoadResult && panel.seedlingPlaybackSurface()?.report ? panel : null),
            'the panel finished its AP load (the generated arm) and holds the assembly report', 30000, 250);
        tc.reportCondition('the generated arm loaded (the bot\'s name → cell map)', !!ap);
        if (!ap) return tc.getOverallResult();
        const rt = await tc.pollForValue(() => {
            const r = frameOf(panel)?.__seedlingJsRuntime ?? null;
            return r?.run ? r : null;
        }, 'the JS runtime page is up and running the set', 15000, 200);
        tc.reportCondition('the JS runtime page is up', !!rt?.run);
        if (!rt?.run) return tc.getOverallResult();

        // ── the sphere log, end to end ────────────────────────────────────
        const expected = (getSphereStateSingleton().getSphereData() ?? [])
            .flatMap((s) => s.locations ?? []);
        tc.log(`sphere log locations: ${JSON.stringify(expected)}; bot start region '${bot.getCurrentRegion?.() ?? '?'}'`);
        await bot.play();
        const finished = await tc.pollForCondition(() => (bot.getStatus() || '').startsWith('finished'),
            'the bot drained its whole sphere queue on the JS runtime', 60000, 250);
        if (!finished) {
            tc.log(`bot status "${bot.getStatus()}"; walk: ${rt.playback.describe()}; log tail `
                + JSON.stringify(bot.getLog?.().slice(-8) ?? []), 'error');
        }
        tc.assertEqual('the Playback Bot completed seedling_generated_room from its sphere log', true, !!finished);
        await tc.stateManager.pingWorker('after-bot-run', 5000);
        const snap = tc.stateManager.getSnapshot?.();
        const checked = new Set(Array.isArray(snap?.checkedLocations) ? snap.checkedLocations : [...(snap?.checkedLocations ?? [])]);
        tc.assertEqual('every sphere-log location is checked in the state manager',
            '[]', JSON.stringify(expected.filter((n) => !checked.has(n))));
        // ⛓ §5.36 — the generated room's apitem was the SOLVER's (F2 `apitem`), not the J2 walker's.
        const apitemSolve = rt.playback.solverStats?.lastSolve?.goal ?? null;
        tc.assertEqual('§5.36: the page\'s SOLVER took the apitem (collect-placement), nothing declined', 'collect-placement/0',
            `${apitemSolve?.kind ?? null}/${rt.playback.solverStats?.declines ?? null}`);

        // ── crossings ─────────────────────────────────────────────────────
        // The queue's one location sits in the start room, so the queue alone
        // crosses nothing. The bot is sent on — one exit per region, re-entering
        // on every arrival — and the witness is gameState's own path. Measured
        // route (PathFinder's): region_0_0 →(a generated door)→ region_0_1
        // →(a door into the parking room)→ the maze region_1_1.
        const before = walkedRegions().length;
        const MAZE_TARGET = { region: 'region_1_1', x: 5, y: 5 };
        const r = bot.walkToTile(MAZE_TARGET.region, MAZE_TARGET.x, MAZE_TARGET.y);
        tc.assertEqual('the bot took a cross-region tile target', true, !!r?.ok);
        const arrived = await tc.pollForCondition(() => walkedRegions().slice(before).includes(MAZE_TARGET.region),
            `gameState's path records the bot's arrival in ${MAZE_TARGET.region} (a maze region)`, 60000, 250);
        const legs = walkedRegions().slice(before);
        tc.log(`regions walked after the queue: ${JSON.stringify(legs)}; bot "${bot.getStatus()}"`);
        tc.assertEqual('the bot crossed out of the generated room into a maze region (gameState path)', true, !!arrived);
        tc.assertEqual('the route crossed Seedling doors the page walked (a generated door AND a parking door)',
            '1+1', `${rt.events.filter((e) => e.type === 'transition' && e.teleporter && e.from === 0 && e.to === 1).length > 0 ? 1 : 0}`
            + `+${rt.events.filter((e) => e.type === 'transition' && e.teleporter && e.to === rt.mounted.set.rooms.find((room) => room.name === 'parking')?.id).length > 0 ? 1 : 0}`);

        // And back: from the maze into the start room (the host's arrival
        // teleport lands the JS run in its generated room again).
        const back = walkedRegions().length;
        bot.walkToLocation(expected[0]);
        const home = await tc.pollForCondition(() => walkedRegions().slice(back).includes('region_0_0'),
            'the bot routed back into the start room', 60000, 250);
        tc.log(`regions walked on the way back: ${JSON.stringify(walkedRegions().slice(back))}`);
        tc.assertEqual('the bot routed from the maze back into the generated start room (gameState path)', true, !!home);

        // The silent-stall guard, with its positive control first.
        const log = bot.getLog?.() ?? [];
        tc.assertEqual('the bot wrote a status log to read errors out of', true,
            log.length > 1 && log.some((l) => String(l).startsWith('finished')));
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
        tc.assertEqual('no death and no halt on the JS runtime', '0/null',
            `${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
        // ⛓ §5.36 — every Seedling leg of the walk (the apitem, the generated door, the parking door, back) SOLVED, none declined.
        const solved = rt.events.filter((e) => e.type === 'solver' && e.solver === 'solved').length;
        tc.log(`solver: ${JSON.stringify(rt.playback.solverStats)}; solved events ${solved}`);
        // A refutation is the page's designed answer to a host re-boot mid-plan (the arrival teleport back into the
        // start room): it re-solves from the live state (measured on CI: 1, then solved). A DECLINE would be the walker.
        tc.assertEqual('§5.36: the solver drove the generated rooms — ≥ 3 solves (apitem + two doors), 0 declines', '3+/0',
            `${solved >= 3 && rt.playback.solverStats.solves >= 3 ? '3+' : rt.playback.solverStats.solves}/${rt.playback.solverStats.declines}`);
    } finally {
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

/**
 * ⛓ WG — under wasm the generated rooms ARE walked now (the wasm engine stages
 * the mounted set; ⛓ §5.36 the SOLVER produces the tapes), so the refusal this
 * row names is the one that REMAINS: a `tile` target in a generated room — the
 * solver has no tile goal kind. Refused before the game is needed, so the
 * wasm page is loaded but never started (as before).
 *
 * ⛔ The WITNESS that the bot walks generated rooms on wasm is NOT an in-app row:
 * it is the headless probe `scripts/procgen/probe-seedling-wasm-generated-playback.mjs`.
 * (When this row was written the in-app Chromium had no WebGPU adapter —
 * `--disable-gpu`, `requestAdapter()` → null. ⛓ SEEDLING LOOP MODE: the
 * `seedling-js` batch now launches with WebGPU (`testBatches.js`), and the
 * `seedling-wasm-runtime-loop-*` rows below start the game; this row still does not.)
 */
export async function seedlingWasmRuntimeBotNamesItsRefusal(tc) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        const ready = await botOnSeedlingPreset(tc, 'wasm', { sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        const start = await tc.pollForValue(() => bot.getCurrentRegion?.() ?? null, 'the bot knows its start region', 10000, 200);
        const r = bot.walkToTile(start, 3, 3);
        tc.assertEqual('the bot took the tile target (and handed it to the generated rooms\' controller)', true, !!r?.ok);
        const named = await tc.pollForValue(() => errorStatuses(bot).find((l) => l.includes('target is not walked in the generated rooms on the wasm runtime')) ?? null,
            'the bot\'s status NAMES why a tile target in a generated room is not walked on wasm', 15000, 200);
        tc.log(`bot status: "${bot.getStatus()}"`);
        tc.assertEqual('under wasm the bot says, by name, that a tile target in a generated room has no tape producer', true, !!named);
        tc.assertEqual('the named error names what IS served (a location or an exit)', true, /serves a location or an exit/.test(named ?? ''));
    } finally {
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-bot-completes-generated-room',
    name: 'Seedling JS runtime: the Playback Bot completes seedling_generated_room',
    description: 'With flashPanel.runtime = js, the Playback Bot drains the preset\'s sphere log (the apitem '
        + 'check through the real dispatcher), then routes through a generated door and a parking door into a '
        + 'maze region and back into the start room — every crossing witnessed by gameState\'s path, '
        + 'no error: status ever.',
    testFunction: seedlingJsRuntimeBotCompletesGeneratedRoom,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'seedling-wasm-runtime-bot-names-refusal',
    name: 'Seedling (wasm runtime): the Playback Bot names why it cannot walk a tile target in a generated room',
    description: 'With flashPanel.runtime = wasm, a tile target in a flash_seedling_gen region is refused by the '
        + 'controller (⛓ §5.36: the solver serves a location or an exit) and the bot\'s status names it '
        + '— never a silent wait. The wasm page is never started.',
    testFunction: seedlingWasmRuntimeBotNamesItsRefusal,
    category: 'Seedling wasm runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── Seedling JS J3: REAL atlas rooms (`flash_seedling`) on the JS runtime ────

const ATLAS_LOCATION_PATH = './presets/seedling_atlas_location/AP_1/AP_1_rules.json';
const ATLAS_PATH = './presets/seedling_atlas/AP_1/AP_1_rules.json';
const CHEST_LOCATION = 'Starting House - Chest';

/** The state manager's snapshot facts the rows read. */
function snapshotFacts(tc) {
    const snap = tc.stateManager.getSnapshot?.() ?? null;
    const list = snap?.checkedLocations ?? [];
    const inv = snap?.inventory ?? {};
    return {
        checked: new Set(Array.isArray(list) ? list : [...list]),
        held: (item) => Number((inv instanceof Map ? inv.get(item) : inv[item]) ?? 0),
    };
}

/** The `pendingExit` values the page reported (its bridge's own log), parsed field by field. */
function reportedExits(win) {
    return (win?.__swfBridge?.stateLog ?? []).filter((r) => r.name === 'pendingExit' && r.value)
        .map((r) => { const [, fromLevel, type, x, y, to] = String(r.value).split('|'); return { fromLevel: +fromLevel, type, x: +x, y: +y, to: +to }; });
}

/** Hold `code` on the frame's canvas until `until()` holds (or `maxMs`). */
async function holdKeyUntil(win, code, until, maxMs = 10000) {
    const canvas = win.document.querySelector('canvas');
    const send = (type) => canvas.dispatchEvent(new win.KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
    send('keydown');
    const t0 = performance.now();
    try {
        while (!until() && performance.now() - t0 < maxMs) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, STEP_MS));
        }
    } finally { send('keyup'); }
    return until();
}

/** Wait for a FRESH js panel that bound the atlas arm, and its page running a real room. */
async function atlasPanelOnJs(tc, staleAdapter) {
    const panel = await tc.pollForValue(() => {
        const p = getActivePanelInstance();
        return p?.transport === 'js' && p.adapter && p.adapter !== staleAdapter && p._initRuntime === 'js' ? p : null;
    }, 'the flash panel mounted the JS runtime page (a fresh adapter)', 30000, 250);
    tc.assertEqual('the panel is on the JS transport', 'js', panel?.transport ?? null);
    if (!panel) return null;
    const bound = await tc.pollForValue(() => (panel._apLoadResult && panel.seedlingPlaybackSurface()?.atlas ? panel : null),
        'the panel bound the ATLAS arm (its AP load) and holds the atlas name → cell map', 30000, 250);
    const panelLogTail = () => (document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').slice(-20).join(' | ');
    if (!bound) tc.log(`panel log: ${panelLogTail()}`, 'error');
    tc.reportCondition('the atlas arm loaded on the JS runtime', !!bound);
    if (!bound) return null;
    const load = panel._apLoadResult;
    tc.assertEqual('the atlas arm only BINDS (no delivery, no reset)', 'bind',
        load.ok ? load.steps.map((s) => s.name).filter((n) => /deliver|reset|bind/.test(n)).join(',') : JSON.stringify(load));
    // ⛔ CLEAN SLATE — this page was delivered nothing, so the region glue holds no delivery and no start set.
    // A leftover one is the PREVIOUS preset's (a generated room's `start` placed this preset's start-hop arrival
    // on level 0 instead of the house: these rows red in the fast batch, green alone). Named here, before the
    // arrival poll, so the leak class fails as itself rather than as a wrong level.
    const glue = getSeedlingRegionGlue();
    tc.assertEqual('clean slate: the glue holds no delivery and no start set from an earlier preset', 'null/null',
        `${JSON.stringify(glue?.delivery ? 'a delivery' : null)}/${JSON.stringify(glue?.binding?.startSet?.start ?? null)}`);
    const rt = await tc.pollForValue(() => {
        const r = frameOf(panel)?.__seedlingJsRuntime ?? null;
        return r?.run && r.vanilla ? r : null;
    }, 'the JS runtime page is running a room of the vanilla map', 15000, 200);
    tc.reportCondition('the JS page runs the vanilla map', !!rt);
    return rt ? { panel, rt, win: frameOf(panel) } : null;
}

export async function seedlingJsRuntimePlaysAtlasRoom(tc) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        await settingsManager.updateSetting(RUNTIME_KEY, 'js', { persist: false });
        tc.log('runtime = js (session override); loading seedling_atlas_location…');
        const rulesJson = await (await fetch(ATLAS_LOCATION_PATH)).json();
        const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
        tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: ATLAS_LOCATION_PATH });
        await loaded;
        await tc.stateManager.pingWorker('after-rules-load', 5000);
        tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, win } = up;

        // The arrival: the binding's teleport (released by the page's level-0
        // first frame) lands the run in the REAL starting house, level 86.
        const house = await tc.pollForValue(() => (rt.run?.level === 86 ? rt : null),
            'the arrival teleport landed the JS run in the real starting house (level 86)', 15000, 200);
        tc.assertEqual('the run is in level 86 (the starting house)', 86, house ? rt.run.level : rt.run?.level ?? null);
        tc.assertEqual('gameState is in the atlas region', 'region_2_2', readCurrentRegion());
        if (!house) return tc.getOverallResult();

        // ── the chest, by keys: it is two tiles above the return spawn ────
        const opened = await holdKeyUntil(win, 'ArrowUp', () => rt.events.some((e) => e.type === 'check' && e.level === 86));
        tc.assertEqual('the chest opened by keys (the page reported pendingCheck "<seq>|86|0|0")', true, opened);
        const checked = await tc.pollForValue(() => (snapshotFacts(tc).checked.has(CHEST_LOCATION) ? CHEST_LOCATION : null),
            `the state manager checked "${CHEST_LOCATION}"`, 10000, 200);
        tc.assertEqual('the atlas location was checked through the real dispatcher', CHEST_LOCATION, checked);
        const key = await tc.pollForValue(() => (snapshotFacts(tc).held('key_blue') > 0 ? 'key_blue' : null),
            'the chest\'s placed item (key_blue) arrived in the state manager', 10000, 200);
        tc.assertEqual('key_blue is held (it opens the house door)', 'key_blue', key);

        // ── the door, by keys: three tiles below; it leads into the maze child ──
        const out = await holdKeyUntil(win, 'ArrowDown', () => readCurrentRegion() === 'region_2_3', 15000);
        tc.assertEqual('the house door moved the AP region into the maze child (user:regionMove)', true, out);
        const exits = reportedExits(win);
        tc.assertEqual('the door was reported field for field: "<seq>|86|teleporter|48|64|0" (Teleporter.as:107)',
            JSON.stringify({ fromLevel: 86, type: 'teleporter', x: 48, y: 64, to: 0 }), JSON.stringify(exits[exits.length - 1] ?? null));
        tc.assertEqual('no death and no halt on the way', '0/null', `${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-atlas-room',
    name: 'Seedling JS runtime: a REAL atlas room plays by keys (check + crossing)',
    description: 'With flashPanel.runtime = js, loads seedling_atlas_location: the JS page runs the vanilla map, '
        + 'the atlas arm binds, the arrival lands in the real starting house (level 86), keys open its chest (a real '
        + 'user:locationCheck for "Starting House - Chest", key_blue arrives) and take its door into the maze child '
        + '(a real user:regionMove; pendingExit field for field with the wasm game). No wasm artifact needed.',
    testFunction: seedlingJsRuntimePlaysAtlasRoom,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G1 — the smoke row: the JS page boots with the `seedling` pack stack and the follow camera (both
 * flash panel settings, session overrides, so the panel puts `?graphics=seedling&camera=follow` on the page's URL),
 * decodes every sheet, draws sprites, and logs no console error; switching the camera back to `room` is applied
 * LIVE (the same runtime object — no re-mount). Sets its own state and restores all three settings however it ends.
 */
export async function seedlingJsRuntimeGraphicsPackBoots(tc) {
    const saved = {};
    for (const [key, fallback] of [[RUNTIME_KEY, 'auto'], [GRAPHICS_SETTING_KEY, 'rects'], [CAMERA_SETTING_KEY, 'room']]) {
        try { saved[key] = await settingsManager.getSetting(key, fallback); } catch { saved[key] = fallback; }
    }
    const errors = [];
    try {
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        await settingsManager.updateSetting(GRAPHICS_SETTING_KEY, 'seedling', { persist: false });
        await settingsManager.updateSetting(CAMERA_SETTING_KEY, 'follow', { persist: false });
        await settingsManager.updateSetting(RUNTIME_KEY, 'js', { persist: false });
        tc.log('runtime = js, graphics = seedling, camera = follow (session overrides); loading seedling_atlas_location…');
        const rulesJson = await (await fetch(ATLAS_LOCATION_PATH)).json();
        const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
        tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: ATLAS_LOCATION_PATH });
        await loaded;
        await tc.stateManager.pingWorker('after-rules-load', 5000);
        tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, win } = up;
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        tc.assertEqual('the panel put the off-default switches on the page URL', true,
            /[?&]graphics=seedling\b/.test(win.location.search) && /[?&]camera=follow\b/.test(win.location.search));
        const g = win.__seedlingJsGraphics;
        const ready = await tc.pollForValue(() => (g.status === 'ready' && (g.counts?.sprites ?? 0) > 0 ? g.counts : null),
            'the page loaded the seedling pack stack and painted sprites', 20000, 200);
        tc.log(`graphics: status ${g.status}, error ${g.error}, counts ${JSON.stringify(g.counts)}, paint ${JSON.stringify(g.paintMs)}`);
        tc.assertEqual('the pack stack is ready (no load error)', 'ready/null', `${g.status}/${g.error}`);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('the page drew sprites under the follow camera', true, !!ready && ready.sprites > 0);
        tc.assertEqual('the camera is the 160×160 follow view', 'follow', g.camera);
        const packs = g.packsOfKeys ?? {};
        tc.assertEqual('the stack resolved keys from BOTH packs (a ground tile from seedling, the AP item from archipelago)',
            'seedling/archipelago', `${packs['seedling:tile/ground']}/${packs['archipelago:pickup/item']}`);
        // ── ⛓ G2: the player is a sprite from the pack, and its walk cycle and mirror follow the keys ──
        const player = await tc.pollForValue(() => g.player, 'the page drew the player from the pack', 10000, 100);
        const bodyOf = (p) => p?.ops?.at(-1) ?? null;   // the body: the last suit op (a dash's trailing copies come first)
        tc.assertEqual('the player\'s body resolved to seedling:player/shrum from the seedling pack', 'seedling:player/shrum/seedling',
            `${bodyOf(player)?.key}/${bodyOf(player)?.pack}`);
        const SIDE_WALK = [3, 4, 5];   // Player.as:655 side-walk [3,4,5,4]
        const walksRight = await holdKeyUntil(win, 'ArrowRight', () => g.player?.anim === 'side-walk', 5000);
        const right = bodyOf(g.player);
        tc.assertEqual('ArrowRight plays side-walk, unmirrored, on a side-walk frame', 'side-walk/false/true',
            `${walksRight ? 'side-walk' : g.player?.anim}/${right?.flipX}/${SIDE_WALK.includes(right?.frame)}`);
        const walksLeft = await holdKeyUntil(win, 'ArrowLeft', () => g.player?.anim === 'side-walk' && bodyOf(g.player)?.flipX === true, 5000);
        tc.assertEqual('ArrowLeft mirrors it (render(): v.x < 0 → scaleX < 0)', true, walksLeft);
        // ── live switch: camera back to room — applied to THIS page, no re-mount ──
        const framesBefore = g.frames;
        await settingsManager.updateSetting(CAMERA_SETTING_KEY, 'room', { persist: false });
        const live = await tc.pollForValue(() => (g.camera === 'room' && g.frames > framesBefore + 2 ? g.camera : null),
            'the camera switch reached the mounted page live', 10000, 100);
        tc.assertEqual('camera = room, applied live', 'room', live);
        tc.assertEqual('the same runtime is still mounted (a cosmetic switch never re-mounts)', true,
            frameOf(getActivePanelInstance())?.__seedlingJsRuntime === rt);
        // ── ⛓ G1.5: room mode paints through the static tile layer, and it composites to the same pixels ──
        const layer = await tc.pollForValue(() => (g.tileLayer?.builds > 0 && g.tileLayer.hits > 2 ? g.tileLayer : null),
            'room mode built the static tile layer and reused it', 10000, 100);
        tc.log(`tile layer: ${JSON.stringify(g.tileLayer)}`);
        tc.assertEqual('the static tile layer is on, holds tiles and is reused across paints', true,
            !!layer && layer.on && layer.bakedOps > 0);
        const check = g.checkTileLayer();
        tc.log(`tile layer pixel check: ${JSON.stringify(check)}`);
        tc.assertEqual('the last paint through the layer = every op drawn, byte for byte (0 differing channels)', '0',
            `${check?.differ}`);
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('no death and no halt', '0/null', `${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        for (const key of [GRAPHICS_SETTING_KEY, CAMERA_SETTING_KEY, RUNTIME_KEY]) {
            try { await settingsManager.updateSetting(key, saved[key], { persist: false }); } catch { /* best effort */ }
        }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-pack-boots',
    name: 'Seedling JS runtime: the original graphics (?graphics=seedling) boot and draw',
    description: 'With flashPanel.runtime = js, seedlingJsGraphics = seedling and seedlingJsCamera = follow, loads '
        + 'seedling_atlas_location: the page boots with the seedling + archipelago pack stack, decodes every sheet, '
        + 'draws sprites in the 160×160 follow view with no console error; the player is drawn from the pack '
        + '(seedling:player/shrum) and walks/mirrors with the keys (G2); switching the camera to room is applied live '
        + '(no re-mount), and room mode paints through the static tile layer with the same pixels as every op drawn (G1.5).',
    testFunction: seedlingJsRuntimeGraphicsPackBoots,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G3 — the enemies' sibling row. The JS page is mounted STANDALONE in this row's own iframe
 * (`jsRuntime.html?graphics=seedling&camera=follow`) and driven through its own `__swfBridge`, exactly as the node
 * tapes drive the core: configure, then `Game(14, 16, 112)` — the room with six Bobs — with the sword staged. No
 * panel, no preset and no AP state is touched; the iframe is removed however the row ends.
 *
 * It asserts what node cannot: in a browser the pack's enemy sheets DECODE and the page's tick loop folds every
 * body into the skin, so `__seedlingJsGraphics.enemies` reports each Bob drawn as `seedling:enemy/bob` from the
 * seedling pack, and its frame CHANGES while the Bobs chase (the per-tick reducer is live, not a frozen frame 0).
 */
export async function seedlingJsRuntimeGraphicsEnemies(tc) {
    const frame = document.createElement('iframe');
    // Visible (a display:none frame gets no animation frames, and the page paints only in rAF), but out of the way.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling&camera=follow';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false }, { class: 'Main', property: 'hasSword', value: true },
            { invocation: 'new_instance', className: 'Game', args: [14, 16, 112] }]);
        const g = win.__seedlingJsGraphics;
        const bobsOf = (e) => (e?.ops ?? []).filter((o) => o.key === 'seedling:enemy/bob');
        const first = await tc.pollForValue(() => (bobsOf(g.enemies).length >= 6 ? g.enemies : null),
            'the page drew the six Bobs of level 14 from the pack', 15000, 100);
        tc.log(`enemies: ${JSON.stringify(g.enemies)}`);
        tc.assertEqual('level 14\'s six Bobs resolved to seedling:enemy/bob from the seedling pack', '6/seedling',
            `${bobsOf(first).length}/${[...new Set(bobsOf(first).map((o) => o.pack))].join(',')}`);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        const frames0 = bobsOf(first).map((o) => o.frame).join(',');
        const moved = await tc.pollForValue(() => {
            const now = bobsOf(g.enemies).map((o) => o.frame).join(',');
            return now !== frames0 ? now : null;
        }, 'a Bob\'s frame advanced (the reducer runs in the tick loop)', 10000, 50);
        tc.assertEqual('the Bobs animate (their frames moved off the first paint\'s)', true, !!moved);
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        const rt = win.__seedlingJsRuntime;
        tc.assertEqual('the run is in level 14 and did not halt', '14/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-enemies',
    name: 'Seedling JS runtime: enemies in the original graphics (G3)',
    description: 'Mounts jsRuntime.html?graphics=seedling&camera=follow standalone in its own iframe, drives it to level 14 '
        + '(six Bobs) through its own __swfBridge, and asserts the page draws each Bob as seedling:enemy/bob from the '
        + 'seedling pack, every sheet decodes, the Bobs\' frames advance, and no console error. Touches no panel, preset '
        + 'or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsEnemies,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G3b — the room bodies' sibling row, G3's shape one family over: the JS page mounted STANDALONE in this
 * row's own iframe and driven through its own `__swfBridge` to `Game(22, 80, 112)` — `r2-wallflyer-contact`'s boot,
 * the player on the row two of L22's four wallflyers look down. No panel, preset or AP state is touched; the iframe
 * is removed however the row ends.
 *
 * It asserts what node cannot: the wallflyer sheet DECODES in a browser and the page's tick loop folds the room
 * bodies into their skin, so `__seedlingJsGraphics.roomBodies` reports the four wallflyers drawn as
 * `seedling:enemy/wallflyer` from the seedling pack, and a frame CHANGES (the launch's "jump", or the resting
 * world-clock pair) — the reducer is live.
 */
export async function seedlingJsRuntimeGraphicsRoomBodies(tc) {
    const frame = document.createElement('iframe');
    // Visible (a display:none frame gets no animation frames, and the page paints only in rAF), but out of the way.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling&camera=follow';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [22, 80, 112] }]);
        const g = win.__seedlingJsGraphics;
        const flyersOf = (e) => (e?.ops ?? []).filter((o) => o.key === 'seedling:enemy/wallflyer');
        const first = await tc.pollForValue(() => (flyersOf(g.roomBodies).length >= 4 ? g.roomBodies : null),
            'the page drew the four wallflyers of level 22 from the pack', 15000, 100);
        tc.log(`roomBodies: ${JSON.stringify(g.roomBodies)}`);
        tc.assertEqual('level 22\'s four wallflyers resolved to seedling:enemy/wallflyer from the seedling pack', '4/seedling',
            `${flyersOf(first).length}/${[...new Set(flyersOf(first).map((o) => o.pack))].join(',')}`);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        const frames0 = flyersOf(first).map((o) => o.frame).join(',');
        const moved = await tc.pollForValue(() => {
            const now = flyersOf(g.roomBodies).map((o) => o.frame).join(',');
            return now !== frames0 ? now : null;
        }, 'a wallflyer\'s frame changed (the reducer runs in the tick loop)', 10000, 50);
        tc.assertEqual('the wallflyers animate (their frames moved off the first paint\'s)', true, !!moved);
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        const rt = win.__seedlingJsRuntime;
        tc.assertEqual('the run is in level 22 and did not halt', '22/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-room-bodies',
    name: 'Seedling JS runtime: the room bodies in the original graphics (G3b)',
    description: 'Mounts jsRuntime.html?graphics=seedling&camera=follow standalone in its own iframe, drives it to level 22 '
        + '(four wallflyers) through its own __swfBridge, and asserts the page draws each as seedling:enemy/wallflyer from '
        + 'the seedling pack, every sheet decodes, a frame changes, and no console error. Touches no panel, preset or AP '
        + 'state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsRoomBodies,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G3c — the puzzlements' sibling row, G3b's shape one module over: the JS page mounted STANDALONE in this
 * row's own iframe and driven through its own `__swfBridge` to `Game(61, 104, 144)` — level 61's two red spinning
 * axes, the player standing where neither blade reaches (measured: no hit, no death in 600 ticks). No panel, preset
 * or AP state is touched; the iframe is removed however the row ends.
 *
 * It asserts what node cannot: the axe sheet DECODES in a browser and the page's tick loop counts the axes' updates,
 * so `__seedlingJsGraphics.hazards` reports both drawn as `seedling:puzzlement/spinningaxeRed` from the seedling pack,
 * and their angle CHANGES — the renderer's own update clock is live.
 */
export async function seedlingJsRuntimeGraphicsHazards(tc) {
    const frame = document.createElement('iframe');
    // Visible (a display:none frame gets no animation frames, and the page paints only in rAF), but out of the way.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling&camera=follow';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [61, 104, 144] }]);
        const g = win.__seedlingJsGraphics;
        const axesOf = (e) => (e?.ops ?? []).filter((o) => o.key === 'seedling:puzzlement/spinningaxeRed');
        const first = await tc.pollForValue(() => (axesOf(g.hazards).length >= 2 ? g.hazards : null),
            'the page drew the two red axes of level 61 from the pack', 15000, 100);
        tc.log(`hazards: ${JSON.stringify(g.hazards)}`);
        tc.assertEqual('level 61\'s two axes resolved to seedling:puzzlement/spinningaxeRed from the seedling pack', '2/seedling',
            `${axesOf(first).length}/${[...new Set(axesOf(first).map((o) => o.pack))].join(',')}`);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        const rot0 = axesOf(first).map((o) => o.rot).join(',');
        const turned = await tc.pollForValue(() => {
            const now = axesOf(g.hazards).map((o) => o.rot).join(',');
            return now !== rot0 ? now : null;
        }, 'an axe\'s angle changed (the update clock runs in the tick loop)', 10000, 50);
        tc.assertEqual('the axes turn (their angles moved off the first paint\'s)', true, !!turned);
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        const rt = win.__seedlingJsRuntime;
        tc.assertEqual('the run is in level 61 and did not halt', '61/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-hazards',
    name: 'Seedling JS runtime: the puzzlements in the original graphics (G3c)',
    description: 'Mounts jsRuntime.html?graphics=seedling&camera=follow standalone in its own iframe, drives it to level 61 '
        + '(two red spinning axes) through its own __swfBridge, and asserts the page draws each as '
        + 'seedling:puzzlement/spinningaxeRed from the seedling pack, every sheet decodes, an angle changes, and no console '
        + 'error. Touches no panel, preset or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsHazards,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G4 — the effects and the overlays in a real browser: `jsRuntime.html?graphics=seedling` (room mode, the
 * default under a stack) mounted STANDALONE in the row's own iframe and driven through its own `__swfBridge` to
 * `Game(61, 104, 144)` — Dungeon 6's rain (heaviness 100), the stance G3c's row measured out of both axes' reach. No
 * panel, preset or AP state is touched; the iframe is removed however the row ends.
 *
 * It asserts what node cannot: the page HOLDS its clock for the boot build's 20 dead frames (the fade is drawn while the
 * run waits), the droplet and heart sheets DECODE, the rain is drawn as `seedling:fx/droplet` and three hearts as
 * `seedling:hud/heart` from the seedling pack, the black cover is gone once the hold ends, and nothing errs.
 */
export async function seedlingJsRuntimeGraphicsEffects(tc) {
    const frame = document.createElement('iframe');
    // Visible (a display:none frame gets no animation frames, and the page paints only in rAF), but out of the way.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [61, 104, 144] }]);
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const drops = (e) => (e?.ops ?? []).filter((o) => o.key === 'seedling:fx/droplet');
        const hearts = (e) => (e?.screen ?? []).filter((o) => o.key === 'seedling:hud/heart');
        const raining = await tc.pollForValue(() => (g.held >= 20 && drops(g.effects).length >= 3 ? g.effects : null),
            'the page held the boot fade and then drew the rain of level 61 from the pack', 15000, 100);
        tc.log(`effects: held ${g.held}, ${JSON.stringify(raining ? { ...raining, screen: raining.screen.length } : null)}`);
        tc.assertEqual('the boot build\'s 20 dead frames were held (the run waited, the fade was drawn)', true, g.held >= 20);
        tc.assertEqual('the rain resolved to seedling:fx/droplet from the seedling pack', 'seedling',
            [...new Set(drops(raining).map((o) => o.pack))].join(','));
        tc.assertEqual('three hearts, all full, drawn as seedling:hud/heart', '0,0,0', hearts(raining).map((o) => o.frame).join(','));
        tc.assertEqual('the black cover is gone after the hold', '0/0', `${raining?.cover}/${raining?.owed}`);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 61 and did not halt', '61/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-effects',
    name: 'Seedling JS runtime: the effects, hearts and fade in the original graphics (G4)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 61 (Dungeon 6 rain) '
        + 'through its own __swfBridge, and asserts the page holds the boot fade (20 dead frames), draws the rain as '
        + 'seedling:fx/droplet and three hearts as seedling:hud/heart from the seedling pack, the cover is gone after the hold, '
        + 'every sheet decodes, and no console error. Touches no panel, preset or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsEffects,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G5 — the night layer in a real browser: `jsRuntime.html?graphics=seedling` (room mode; the lights are ON
 * by default under a stack) mounted STANDALONE in the row's own iframe and driven through its own `__swfBridge` to
 * `Game(40, 928, 96)` — Dungeon 4/2 (`lightalpha` 0.1: the composite at 0.72, fourteen torches, four orbs). No panel,
 * preset or AP state is touched; the iframe is removed however the row ends.
 *
 * It asserts what node cannot: the night canvas is drawn and MULTIPLIED over the room (the canvas is darker than the
 * same ops painted without it), the switch turns it off LIVE, and with the lights OFF the canvas is byte-identical to
 * the pre-G5 paint of the same ops (`checkNight`, 0 differing channels); then ON again; and nothing errs.
 */
export async function seedlingJsRuntimeGraphicsLights(tc) {
    const frame = document.createElement('iframe');
    // Visible (a display:none frame gets no animation frames, and the page paints only in rAF), but out of the way.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [40, 928, 96] }]);
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const lit = await tc.pollForValue(() => (rt.run?.level === 40 && g.lights.circles > 0 && g.lights.paints > 2 ? g.lights : null),
            'the page drew level 40\'s night layer (its lights) and composited it', 15000, 100);
        tc.log(`lights: ${JSON.stringify(lit)}`);
        tc.assertEqual('the lights are ON by default under a stack', 'on/true', `${lit?.setting}/${lit?.on}`);
        tc.assertEqual('level 40 composites at 1 − 0.9·0.2 − 0.1 = 0.72', '0.72', lit ? lit.alpha.toFixed(2) : null);
        const on = g.checkNight();
        tc.log(`checkNight ON: ${JSON.stringify(on)}`);
        tc.assertEqual('lights ON: the canvas differs from the paint without the night layer, and is darker', 'true/true',
            `${(on?.differ ?? 0) > 0}/${on?.darker}`);
        await g.set({ lights: 'off' });
        const offPaints = await tc.pollForValue(() => (!g.lights.on && g.lights.alpha === 0 && g.frames > 0 ? g.frames : null),
            'the switch turned the lights off live', 5000, 50);
        tc.reportCondition('the lights switch applied live (no re-mount)', !!offPaints);
        await tc.pollForCondition(() => g.frames >= (offPaints ?? 0) + 2, 'two paints with the lights off', 5000, 50);
        const off = g.checkNight();
        tc.log(`checkNight OFF: ${JSON.stringify(off)}`);
        tc.assertEqual('lights OFF: the canvas is byte-identical to the pre-G5 paint of the same ops', '0', String(off?.differ));
        await g.set({ lights: 'on' });
        const back = await tc.pollForValue(() => (g.lights.on && g.lights.alpha > 0 ? g.lights : null), 'the lights came back on live', 5000, 50);
        tc.reportCondition('the lights switched back on live', !!back);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 40 and did not halt', '40/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-lights',
    name: 'Seedling JS runtime: the night layer (lights) in the original graphics (G5)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 40 (Dungeon 4/2, '
        + 'lightalpha 0.1) through its own __swfBridge, and asserts the night layer is drawn and composited at 0.72 (the '
        + 'canvas darker than the same ops painted without it), the lights switch off LIVE and the canvas is then '
        + 'byte-identical to the pre-G5 paint, the lights switch back on, every sheet decodes, and no console error. '
        + 'Touches no panel, preset or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsLights,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

export async function seedlingJsRuntimeBotCompletesAtlasLocation(tc) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_LOCATION_PATH });
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt } = up;
        const expected = (getSphereStateSingleton().getSphereData() ?? []).flatMap((s) => s.locations ?? []);
        tc.log(`sphere log locations: ${JSON.stringify(expected)}; bot start region '${bot.getCurrentRegion?.() ?? '?'}'`);
        tc.assertEqual('the sphere log starts in the atlas room (its chest)', CHEST_LOCATION, expected[0] ?? null);
        await bot.play();
        const finished = await tc.pollForCondition(() => (bot.getStatus() || '').startsWith('finished')
            || errorStatuses(bot).length > 0, 'the bot drained its sphere queue (or named an error)', 90000, 250);
        if (!finished || errorStatuses(bot).length > 0) {
            tc.log(`bot status "${bot.getStatus()}"; walk: ${rt.playback.describe()}; log tail `
                + JSON.stringify(bot.getLog?.().slice(-8) ?? []), 'error');
        }
        tc.assertEqual('the Playback Bot completed seedling_atlas_location (an atlas room, then two maze rooms)', true,
            (bot.getStatus() || '').startsWith('finished'));
        await tc.stateManager.pingWorker('after-bot-run', 5000);
        const facts = snapshotFacts(tc);
        tc.assertEqual('every sphere-log location is checked', '[]', JSON.stringify(expected.filter((n) => !facts.checked.has(n))));
        tc.assertEqual(`the goal (${GOAL_ITEM}) is held`, true, facts.held(GOAL_ITEM) > 0);
        const path = walkedRegions();
        tc.log(`gameState path (regionMove destinations): ${JSON.stringify(path)}`);
        tc.assertEqual('the bot crossed OUT of the atlas room through its door (gameState path: region_2_3, region_3_3)',
            true, path.includes('region_2_3') && path.includes('region_3_3'));
        tc.assertEqual('the page took the house door (a pendingExit from level 86)', true,
            reportedExits(up.win).some((e) => e.fromLevel === 86 && e.type === 'teleporter'));
        const log = bot.getLog?.() ?? [];
        tc.assertEqual('the bot wrote a status log to read errors out of', true, log.length > 1);
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
        tc.assertEqual('no death and no halt on the JS runtime', '0/null', `${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-bot-completes-atlas-location',
    name: 'Seedling JS runtime: the Playback Bot completes seedling_atlas_location (a real room)',
    description: 'With flashPanel.runtime = js, the Playback Bot drains seedling_atlas_location\'s sphere log: the '
        + 'flash_seedling controller walks the real starting house\'s chest (an atlas check) and its door into the '
        + 'maze, the maze controller the rest — all locations checked, victory held, no error: status, crossings '
        + 'witnessed by gameState\'s path.',
    testFunction: seedlingJsRuntimeBotCompletesAtlasLocation,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

export async function seedlingJsRuntimeBotWalksAtlasRooms(tc) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        // seedling_atlas's sphere log (tool-built, `--embed-sphere-log`) holds only
        // the chest; this walk goes past it, so the bot is driven by its manual
        // targets, which route region by region, and the log is not awaited.
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, win } = up;
        const start = await tc.pollForValue(() => (bot.getCurrentRegion?.() === 'overworld_start__r8c0' && rt.run?.level === 0 ? rt : null),
            'the bot and the page are in the start region (overworld_start__r8c0, level 0)', 15000, 200);
        tc.reportCondition('the bot starts in overworld_start__r8c0 on level 0', !!start);
        if (!start) return tc.getOverallResult();

        // ── leg 1: the chest, through the house door (an atlas → atlas crossing) ──
        const before = walkedRegions().length;
        bot.walkToLocation(CHEST_LOCATION);
        const chest = await tc.pollForCondition(() => snapshotFacts(tc).checked.has(CHEST_LOCATION) || errorStatuses(bot).length > 0,
            `the bot walked into the starting house and checked "${CHEST_LOCATION}"`, 60000, 250);
        tc.assertEqual('the chest was checked', true, !!chest && snapshotFacts(tc).checked.has(CHEST_LOCATION));
        tc.assertEqual('gameState\'s path records the crossing into starting_house', true,
            walkedRegions().slice(before).includes('starting_house'));

        // ── leg 2: out again, down the owl's-nest STAIRS and the descent into the dungeon ──
        const mid = walkedRegions().length;
        const r = bot.walkToTile('dungeon1_room1__r0c4', 4, 3);
        tc.assertEqual('the bot took a cross-region tile target in the dungeon', true, !!r?.ok);
        const deep = await tc.pollForCondition(() => walkedRegions().slice(mid).includes('dungeon1_room1__r0c4')
            || errorStatuses(bot).length > 0, 'the bot routed into dungeon1_room1__r0c4', 60000, 250);
        const legs = walkedRegions().slice(mid);
        tc.log(`regions walked on leg 2: ${JSON.stringify(legs)}; bot "${bot.getStatus()}"; walk: ${rt.playback.describe()}`);
        tc.assertEqual('gameState\'s path: starting_house → overworld_start__r8c0 → owls_nest_entrance → dungeon1_room1__r0c4',
            JSON.stringify(['overworld_start__r8c0', 'owls_nest_entrance', 'dungeon1_room1__r0c4']), JSON.stringify(legs));
        tc.reportCondition('the dungeon was reached', !!deep);
        const types = reportedExits(win).map((e) => `${e.fromLevel}:${e.type}`);
        tc.assertEqual('the page reported each link with its OWN exitType (a stairsdown among them)',
            JSON.stringify(['0:teleporter', '86:teleporter', '0:stairsdown', '2:teleporter']), JSON.stringify(types));
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
        tc.assertEqual('no death and no halt on the JS runtime', '0/null', `${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-bot-walks-atlas-rooms',
    name: 'Seedling JS runtime: the Playback Bot walks between REAL atlas rooms',
    description: 'With flashPanel.runtime = js on seedling_atlas (ten real-room regions), the bot walks to the '
        + 'starting house\'s chest through the house door, then out and down the owl\'s-nest stairs and the descent '
        + 'into the dungeon — four atlas → atlas crossings (level changes, one a stairsdown), each witnessed by '
        + 'gameState\'s path; no error: status, no death, no halt.',
    testFunction: seedlingJsRuntimeBotWalksAtlasRooms,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── Seedling solver-walk S1: the Playback Bot's SOLVER mode on the live page ──

const SOLVER_WALK_KEY = 'moduleSettings.flashPanel.seedlingSolverWalk';
const VANILLA_MAP_URL = 'modules/flashPanel/atlases/seedling-map.json';
/** The enemy witness (⚖ Q2): level 6, entered from level 5, out by its stairs up at (224, 32) — past the bobs. */
const ENEMY_ROOM = Object.freeze({ level: 6, from: 5, stairs: { x: 224, y: 32 }, to: 7 });

export async function seedlingJsRuntimeSolverWalksEnemyRoom(tc) {
    let previousRuntime = 'auto';
    let previousSolver = false;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    try {
        await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, win, panel } = up;
        tc.assertEqual('the panel\'s surface carries the setting (seedlingSolverWalk = true)', true,
            panel.seedlingPlaybackSurface()?.solverWalk ?? null);
        const pushed = await tc.pollForCondition(() => rt.playback.solverWalk === true,
            'the setting reached the JS page (playback.solverWalk)', 5000, 100);
        tc.reportCondition('the page is in solver mode', !!pushed);

        // ── the room, derived from the map (no coordinates typed but the witness's own) ──
        const map = await (await fetch(new URL(VANILLA_MAP_URL, document.baseURI).href)).json();
        const room = map.levels.find((l) => l.level === ENEMY_ROOM.level);
        const tile = (e) => [Math.floor(e.x / map.tile_size), Math.floor(e.y / map.tile_size)];
        const door = room.entities.find((e) => Number(e.attrs?.to) === ENEMY_ROOM.from);
        const stairs = room.entities.find((e) => e.x === ENEMY_ROOM.stairs.x && e.y === ENEMY_ROOM.stairs.y);
        const spawn = returnSpawnTable(map).get(returnKey(ENEMY_ROOM.level, ...tile(door)));
        tc.reportCondition(`level ${ENEMY_ROOM.level} has its door from ${ENEMY_ROOM.from}, its stairs and a return spawn`,
            !!(door && stairs && spawn));
        if (!door || !stairs || !spawn) return tc.getOverallResult();
        const bobs = room.entities.filter((e) => /bob/i.test(e.type)).length;
        tc.log(`level ${ENEMY_ROOM.level}: ${bobs} bob(s); spawn (${spawn.x}, ${spawn.y}); stairs tile ${JSON.stringify(tile(stairs))}`);
        tc.assertEqual('the witness room has enemies (bobs)', true, bobs > 0);

        // ── the page handle teleports the real page into the room (⚖ Q2: no new preset) ──
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [ENEMY_ROOM.level, spawn.x, spawn.y] }]);
        const there = await tc.pollForCondition(() => rt.run?.level === ENEMY_ROOM.level,
            `the page is in level ${ENEMY_ROOM.level}`, 10000, 100);
        tc.reportCondition('teleported into the enemy room', !!there);
        if (!there) return tc.getOverallResult();
        const exitsBefore = reportedExits(win).length;
        const answer = rt.playback.walkTo({ kind: 'exit', level: ENEMY_ROOM.level, tiles: [tile(stairs)] });
        tc.assertEqual('the page accepted the stairs goal', true, !!answer?.ok);
        rt.playback.play();
        const crossed = await tc.pollForCondition(() => ['done', 'failed'].includes(rt.playback.state) || !!rt.halted,
            'the solver-driven walk settled (done / failed / halted)', 60000, 200);
        const s = rt.playback.solverStats;
        tc.log(`walk: ${rt.playback.describe()}; solver ${JSON.stringify({ ...s, lastSolve: s.lastSolve
            ? { ...s.lastSolve, goal: undefined } : null })}`);
        tc.reportCondition('the walk settled', !!crossed);
        tc.assertEqual('the walk is DONE (the stairs were taken)', 'done', rt.playback.state);
        tc.assertEqual('the SOLVER drove it: solved once, no decline', '1/0', `${s.solves}/${s.declines}`);
        // ⛓ S2 — off the page thread.
        tc.assertEqual('the solve ran in the page\'s WORKER', 'worker', s.lastSolve?.where ?? null);
        tc.assertEqual('the plan used the solver\'s enemy verb (bait) — the J2 walker cannot', true,
            (s.lastSolve?.verbs ?? []).includes('bait'));
        tc.assertEqual('every planned key was played on the page clock (no refutation)', `${s.lastSolve?.keys}/0`,
            `${s.played}/${s.refutations}`);
        const exits = reportedExits(win).slice(exitsBefore);
        tc.assertEqual(`the crossing was reported: a pendingExit from level ${ENEMY_ROOM.level} at the stairs to ${ENEMY_ROOM.to}`,
            JSON.stringify({ fromLevel: ENEMY_ROOM.level, type: 'stairsup', ...ENEMY_ROOM.stairs, to: ENEMY_ROOM.to }),
            JSON.stringify(exits[0] ?? null));
        tc.assertEqual(`the page is in level ${ENEMY_ROOM.to}`, ENEMY_ROOM.to, rt.run?.level ?? null);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
    } finally {
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-walks-enemy-room',
    name: 'Seedling JS runtime: the solver mode walks a real ENEMY room (L6, past the bobs)',
    description: 'With flashPanel.runtime = js and flashPanel.seedlingSolverWalk ON, on seedling_atlas: the page '
        + 'handle teleports the real page into level 6 (new_instance Game, ⚖ no new preset) and its Playback Bot '
        + 'feet walk to the stairs (224, 32): the real solver (solveSegment with the session as prefix) plans a bait '
        + 'past the bobs, the page plays it one key set per tick, and the stairs crossing is reported — 0 HALT, no '
        + 'refutation, no error: status.',
    testFunction: seedlingJsRuntimeSolverWalksEnemyRoom,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── ⛓ SOLVE PROGRESS (JS half): the panel's progress view on a real solve ──

/** ⛓ SOLVE PROGRESS S1 — the progress refresh rate (ms); this row pins it to the default it was written against. */
const SOLVE_PROGRESS_INTERVAL_KEY = 'moduleSettings.flashPanel.seedlingSolveProgressIntervalMs';
const SOLVE_PROGRESS_ROW_INTERVAL_MS = 100;

export async function seedlingJsRuntimeSolveProgressView(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    let previousSections = null;
    let panelUsed = null;
    let previousInterval = SOLVE_PROGRESS_ROW_INTERVAL_MS;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    try { previousInterval = await settingsManager.getSetting(SOLVE_PROGRESS_INTERVAL_KEY, SOLVE_PROGRESS_ROW_INTERVAL_MS); } catch { /* keep the default */ }
    let svc = null;
    try {
        // ⚖ This row SETS its own state: solver mode on (a session-only override) and, once the panel is up, the
        // Solver section OPEN (⛓ PANEL LAYOUT: the section is the view's switch) — both restored below.
        await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
        await settingsManager.updateSetting(SOLVE_PROGRESS_INTERVAL_KEY, SOLVE_PROGRESS_ROW_INTERVAL_MS, { persist: false });
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, panel } = up;
        panelUsed = panel;
        previousSections = panel.sectionState();
        panel.setSectionOpen('solver', true);
        const view = panel._solveProgressView;
        tc.assertEqual('the progress view is open (the Solver section is open)', true, !!view?.isOpen);
        svc = rt.playback.solveService;
        tc.assertEqual('the JS page solves in its WORKER service', true, typeof svc?.subscribeProgress === 'function');
        // the feed re-resolves the page's service each second: wait until it listens, BEFORE the solve starts
        const listening = await tc.pollForCondition(() => svc.progressSubscribed === true,
            'the view subscribed to the page\'s solve service', 5000, 100);
        tc.reportCondition('the view listens to the page\'s solve service before the solve', !!listening);
        if (!listening) return tc.getOverallResult();

        const map = await (await fetch(new URL(VANILLA_MAP_URL, document.baseURI).href)).json();
        const room = map.levels.find((l) => l.level === ENEMY_ROOM.level);
        const tile = (e) => [Math.floor(e.x / map.tile_size), Math.floor(e.y / map.tile_size)];
        const door = room.entities.find((e) => Number(e.attrs?.to) === ENEMY_ROOM.from);
        const stairs = room.entities.find((e) => e.x === ENEMY_ROOM.stairs.x && e.y === ENEMY_ROOM.stairs.y);
        const spawn = returnSpawnTable(map).get(returnKey(ENEMY_ROOM.level, ...tile(door)));
        tc.reportCondition(`level ${ENEMY_ROOM.level} has its door, its stairs and a return spawn`, !!(door && stairs && spawn));
        if (!door || !stairs || !spawn) return tc.getOverallResult();
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [ENEMY_ROOM.level, spawn.x, spawn.y] }]);
        const there = await tc.pollForCondition(() => rt.run?.level === ENEMY_ROOM.level,
            `the page is in level ${ENEMY_ROOM.level}`, 10000, 100);
        tc.reportCondition('teleported into the enemy room', !!there);
        if (!there) return tc.getOverallResult();
        const answer = rt.playback.walkTo({ kind: 'exit', level: ENEMY_ROOM.level, tiles: [tile(stairs)] });
        tc.assertEqual('the page accepted the stairs goal', true, !!answer?.ok);
        rt.playback.play();
        const settled = await tc.pollForCondition(() => ['done', 'failed'].includes(rt.playback.state) || !!rt.halted,
            'the solver-driven walk settled', 60000, 200);
        tc.reportCondition('the walk settled', !!settled);
        tc.assertEqual('the walk is DONE', 'done', rt.playback.state);
        const s = rt.playback.solverStats;
        tc.assertEqual('the SOLVER drove it, in the worker', '1/worker', `${s.solves}/${s.lastSolve?.where ?? null}`);

        // ── the view: the stream arrived, finished, and was drawn ──
        const st = view.state;
        tc.log(`view: ${st.received} update(s), seq ${st.seq}, final ${st.final}; service ${JSON.stringify(svc.stats)}`);
        tc.assertEqual('the view received the FINAL snapshot of the solve', true, st.final === true);
        tc.assertEqual('the final snapshot\'s segment finished solved', 'solved', st.snapshot?.segment?.outcome ?? null);
        // ⛓ S1 — the ceiling is the rate setting's, which the view carried onto the solve's envelope
        tc.assertEqual('the view asks for the row\'s rate', SOLVE_PROGRESS_ROW_INTERVAL_MS, view.intervalMs);
        tc.assertEqual(`the progress messages came at most one per ${SOLVE_PROGRESS_ROW_INTERVAL_MS} ms: updates ≤ the `
            + 'solve\'s wait / the interval + 2', true,
            st.received <= Math.ceil((s.lastSolve?.waitMs ?? 0) / SOLVE_PROGRESS_ROW_INTERVAL_MS) + 2);
        const rows = view.tree.querySelectorAll('div').length;
        tc.assertEqual('the tree is drawn (≥ 1 row)', true, rows >= 1);
        tc.assertEqual('the meter reads the attempt against the budget', true,
            /^work \d+ \/ \d+ units/.test(view.meterText.textContent));
        // ⛓ S2 — TIER A: the final snapshot's asks by site and work counters are drawn, and nothing is active
        view.flush();
        tc.assertEqual('the asks by site are drawn (Tier A)', true,
            /^asks by site \(this segment\): /.test(view.asksText.textContent));
        tc.assertEqual('the work counters are drawn (Tier A)', true, /^work: ticks \d+ · /.test(view.workText.textContent));
        tc.assertEqual('the active path reads finished (Tier A)', 'active: — (finished)', view.pathText.textContent);
        // ⛓ RK VIEW — the v2 snapshot's refusals by kind and last why are drawn, and each listed row's chips are its
        // `rejectionKinds` (the in-app solve may refuse nothing: then the line reads `none yet` and no row has chips)
        const final = st.snapshot ?? {};
        tc.log(`RK view: v ${final.v}; ${view.kindsText.textContent} | ${view.whyText.textContent.slice(0, 160)}`);
        tc.assertEqual('the snapshot is v: 2 (hammer-phase RK)', true, final.v >= 2);
        tc.assertEqual('the refusals by kind are drawn (RK view)', true,
            /^refusals by kind \(this segment, each once\): /.test(view.kindsText.textContent));
        const why = final.lastWhy ?? null;
        tc.assertEqual('the last why is drawn iff the segment has one (RK view)', true, why === null
            ? view.whyText.textContent === '' : view.whyText.textContent.startsWith(`last why: ${why.kind} at ${why.key}: `));
        // the finished tree is one collapsed root row: its chips are the root's kinds (their ORDER is the unit rows')
        const rootChips = (view._lines[0]?._chips?.children ?? []).map((c) => c.textContent).sort();
        const rootKinds = Object.entries(final.tree?.rejectionKinds ?? {}).filter(([, n]) => n > 0)
            .map(([k, n]) => `${k} ${n}`).sort();
        tc.assertEqual('the root row\'s chips are its rejectionKinds (RK view)', JSON.stringify(rootKinds),
            JSON.stringify(rootChips));
        // ⛓ STAMPS VIEW — S3's Tier B stamps on the real solve: the request (kept from the solve's FIRST post — the
        // final snapshot does not carry it), the plan in hand, and where the time went (Σ = the attempt's wall)
        tc.log(`stamps view: ${view.requestText.textContent} | ${view.bestText.textContent} | ${view.etaText.textContent}`
            + ` | ${view.wallText.textContent}`);
        tc.assertEqual('the request identity is drawn, kept from the first post (stamps view)', true,
            final.request === undefined && /^request: .* · boot L\d+ · /.test(view.requestText.textContent));
        tc.assertEqual('the plan in hand is drawn (stamps view)', true, /^best: (ok · \d+ ticks|refused|none yet)/.test(view.bestText.textContent));
        tc.assertEqual('the wall by site is drawn (stamps view)', true,
            /^wall by site \(this attempt\): .* · Σ [\d.]+ (ms|s)$/.test(view.wallText.textContent));
        // ⛓ FRAME VIEW — hammer-phase TC2's `frame` on the real solve. Whether a POSTED snapshot carries one is
        // timing, not a property: L6's frames (the climbs on `sandtrap@64,16`) are a short stretch of its 41 snapshots
        // between the tap's 100 ms posts — measured: 2–3 of 6–8 posts locally, 0 of 8 on CI at aedde83273. So the
        // count is logged, not asserted; the marks themselves are pinned in seedlingSolveProgressView.test.js. What
        // holds on every run: the final frame is null, so no mark is left on the map and the frame line is empty.
        tc.log(`frame view: ${view.stats.framesReceived} note(s) carried a frame, ${view.stats.framesMarked} render(s) `
            + `marked one, ${view.stats.marksDrawn} marks redraw(s)`);
        tc.assertEqual('the final frame is null: no marks, an empty frame line (frame view)', true,
            final.frame === null && view.marks === null && (view.frameLine?.textContent ?? '') === '');
        // ⛓ CACHES VIEW — hammer-phase PR's `caches` and `churn` on the real solve, drawn at the end of the meter: each
        // line is the model's text of the final snapshot (the counts are pinned per level in solveProgress.test.js),
        // and a closed segment closed every frame it opened (`open 0`)
        tc.log(`caches view: ${view.cachesText?.textContent ?? '(no line)'} | ${view.churnText?.textContent ?? '(no line)'}`);
        tc.assertEqual('the final snapshot carries `caches` and `churn` (hammer-phase PR)', true,
            !!final.caches && !!final.churn);
        tc.assertEqual('the caches line is drawn, last in the meter (caches view)', true,
            view.meter.lastElementChild === view.cachesBox && view.cachesText.textContent === cachesText(final));
        tc.assertEqual('the churn line is drawn, the solved segment with no frame left open (caches view)', true,
            view.churnText.textContent === churnText(final) && / · open 0 · climb moves \d+$/.test(view.churnText.textContent));
        // a soft-lock refusal in the solve is in the danger colour wherever it is drawn (L6 may have none: logged)
        const softChips = [...view.tree.querySelectorAll('span')].filter((c) => /^soft-lock \d+$/.test(c.textContent));
        tc.log(`caches view: ${softChips.length} soft-lock chip(s) on the listed rows`);
        // the browser normalises a colour it is given, so compare against the danger colour as it normalised it
        const probe = document.createElement('span');
        probe.style.color = DANGER_COLOUR;
        tc.assertEqual('every soft-lock chip is in the danger colour (caches view)', true,
            softChips.every((c) => c.style.color === probe.style.color));
        if (st.snapshot?.tiles) {
            tc.assertEqual('the tile map is ONE canvas sized to the room', `${st.snapshot.tiles.cols}x${st.snapshot.tiles.rows}`,
                `${Math.round(view.canvas.width / view._px)}x${Math.round(view.canvas.height / view._px)}`);
        }
        // the "last update N s ago" indicator ticks on its own (never implies liveness from the throttle)
        const aged = await tc.pollForCondition(() => /last update [1-9]\d* s ago/.test(view.header.textContent),
            'the header\'s "last update N s ago" advanced', 5000, 100);
        tc.reportCondition('the age indicator advances while nothing arrives', !!aged);
        tc.assertEqual('the open Solver section never hid the view after the final note', true, view.isOpen);
        // ⛓ PANEL LAYOUT — the progress line under the game read the same final state
        const line = panel._solveProgressLine;
        await tc.pollForCondition(() => /^solver: solved \(solve #\d+\) · work \d+ \/ \d+ · best: /.test(line.text.textContent),
            'the progress line drew the final state', 3000, 100);
        tc.assertEqual('the progress line reads the final state (solved, work against the budget, best)', true,
            /^solver: solved \(solve #\d+\) · work \d+ \/ \d+ · best: /.test(line.text.textContent));
        tc.assertEqual('the progress line mirrors the final note', 'true/solved', `${line.element.dataset.final}/${line.element.dataset.outcome}`);

        // ⛓ PANEL LAYOUT — closing the Solver section HIDES the view but keeps it LISTENING (the progress line needs
        // the next solve); only the panel's teardown unsubscribes (pinned in seedlingSolveProgress.test.js)
        panel.setSectionOpen('solver', false);
        tc.assertEqual('a closed Solver section hides the view and keeps its listener', 'false/true',
            `${view.isOpen}/${svc.progressSubscribed === true}`);
    } finally {
        if (panelUsed && previousSections) {
            for (const [id, open] of Object.entries(previousSections)) panelUsed.setSectionOpen(id, open);
        }
        try { await settingsManager.updateSetting(SOLVE_PROGRESS_INTERVAL_KEY, previousInterval, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solve-progress-view',
    name: 'Seedling JS runtime: the panel\'s SOLVE PROGRESS view on a real solve (L6, past the bobs)',
    description: 'With flashPanel.runtime = js, the solver mode on and the panel\'s Solver section open, on '
        + 'seedling_atlas: the view subscribes to the page\'s worker service before the solve, the L6 enemy-room solve '
        + 'streams its progress, and the view holds the FINAL snapshot (solved), draws its tree, its tile canvas and '
        + 'its work meter and its caches/churn lines, and its "last update N s ago" advances; the open section never '
        + 'hides it; the progress line under the game reads the final state; closing the section hides the view and '
        + 'keeps it listening.',
    testFunction: seedlingJsRuntimeSolveProgressView,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── ⛓ PANEL LAYOUT (slice `seedling-panel-layout`, ⚖ the user 2026-10-24): the Seedling panel's sections ──

const SECTIONS_STORAGE_KEY = 'flashPanel_sections';
const PROGRESS_INTERVAL_KEY = 'moduleSettings.flashPanel.seedlingSolveProgressIntervalMs';

/**
 * The panel on the JS runtime, seedling_atlas (the rows below need a Seedling game, so every section applies), with
 * its sections and their saved state captured for the restore. ⚖ Each row SETS its own state and puts it back.
 */
async function layoutPanel(tc) {
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
    if (!ready) return null;
    const up = await atlasPanelOnJs(tc, staleAdapter);
    if (!up) return null;
    let saved = null;
    try { saved = localStorage.getItem(SECTIONS_STORAGE_KEY); } catch { saved = null; }
    return { ...up, sections: up.panel.sectionState(), saved };
}

function restoreLayout(ctx) {
    if (!ctx) return;
    for (const [id, open] of Object.entries(ctx.sections)) ctx.panel.setSectionOpen(id, open);
    try {
        if (ctx.saved === null) localStorage.removeItem(SECTIONS_STORAGE_KEY); else localStorage.setItem(SECTIONS_STORAGE_KEY, ctx.saved);
    } catch { /* storage unavailable */ }
}

const savedSections = () => { try { return JSON.parse(localStorage.getItem(SECTIONS_STORAGE_KEY) ?? 'null'); } catch { return null; } };

export async function seedlingPanelLayoutSections(tc) {
    let ctx = null;
    let previousRuntime = 'auto';
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        ctx = await layoutPanel(tc);
        if (!ctx) return tc.getOverallResult();
        const { panel } = ctx;
        const root = panel.rootElement;
        // the order, top to bottom: the title + status, the game, the progress line, Solver, Settings, Tools
        const order = [root.querySelector('.flash-panel-header'), root.querySelector('.flash-panel-stage'),
            root.querySelector('.flash-panel-solve-progress-line'), ...['solver', 'settings', 'tools'].map((id) => panel.sections[id])];
        tc.assertEqual('every part is there', true, order.every(Boolean));
        tc.assertEqual('they are the root\'s children in the order asked for', true,
            order.every((el, i) => el.parentNode === root && (i === 0 || (order[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))));
        tc.assertEqual('the header holds only the title (the game\'s name) and the status', 'Seedling|2',
            `${panel.titleElement.textContent}|${root.querySelector('.flash-panel-header').children.length}`);
        tc.assertEqual('the game (the iframe) is inside the stage', true, panel.stageElement.contains(document.getElementById(panel.flashObjectId)));
        tc.assertEqual('the solve-progress view is in the Solver section; the log, the controls and the teleport rows in Tools', true,
            panel.sections.solver.contains(panel._solveProgressView.element) && panel.sections.tools.contains(panel.logElement)
            && panel.sections.tools.contains(root.querySelector('.flash-panel-wirecheck')) && panel.sections.tools.contains(panel.teleportRow)
            && panel.sections.tools.contains(panel.apFoundElement));
        tc.assertEqual('the "Solve Progress" off/auto/always button is gone', null, root.querySelector('.flash-panel-solve-progress-toggle'));
        tc.assertEqual('a Seedling game shows the progress line and the Solver section', 'flex/',
            `${panel._solveProgressLine.element.style.display}/${panel.sections.solver.style.display}`);

        // collapse: the section's state is the view's mode, and it is SAVED per viewer
        panel.setSectionOpen('solver', true);
        panel.setSectionOpen('settings', false);
        panel.setSectionOpen('tools', true);
        tc.assertEqual('saved: {solver open, settings closed, tools open}', JSON.stringify({ solver: true, settings: false, tools: true }),
            JSON.stringify(savedSections()));
        tc.assertEqual('an open Solver section shows the view (mode always)', 'true/always',
            `${panel._solveProgressView.isOpen}/${panel._solveProgressView.mode}`);
        // a click on a section's title toggles it, and the toggle is saved
        panel.sections.settings.querySelector('summary').click();
        const clicked = await tc.pollForCondition(() => savedSections()?.settings === true,
            'a click on "Settings" opened it and the state was saved', 3000, 50);
        tc.reportCondition('a click on a section title opens it and saves the state', !!clicked);
        panel.setSectionOpen('solver', false);
        tc.assertEqual('a closed Solver section hides the view and keeps it listening (mode listen)', 'false/listen/true',
            `${panel._solveProgressView.isOpen}/${panel._solveProgressView.mode}/${panel._solveProgressView.isListening}`);
        // the saved state is what a panel (re)built for this viewer opens with
        localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify({ solver: true, settings: false, tools: false }));
        panel._restoreSections();
        tc.assertEqual('a restore reads the saved state', JSON.stringify({ solver: true, settings: false, tools: false }),
            JSON.stringify(panel.sectionState()));
        tc.assertEqual('the restored Solver section is the view\'s state', true, panel._solveProgressView.isOpen);
    } finally {
        restoreLayout(ctx);
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-panel-layout-sections',
    name: 'Seedling panel layout: the sections, in order, collapsible, saved per viewer',
    description: 'On the JS runtime, seedling_atlas: the panel is the title + status, the game, the solver\'s progress line, '
        + 'then the Solver, Settings and Tools sections, in that order; the view is in Solver, the log, buttons, teleport rows '
        + 'and AP readout in Tools; the old Solve Progress button is gone; opening/closing a section (by call or a click on '
        + 'its title) is saved in localStorage and read back; the Solver section\'s state is the view\'s (always / listen).',
    testFunction: seedlingPanelLayoutSections,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

export async function seedlingPanelLayoutSettings(tc) {
    let ctx = null;
    let previousRuntime = 'auto';
    let previousCamera = 'room';
    let previousInterval = null;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousCamera = await settingsManager.getSetting(CAMERA_SETTING_KEY, 'room'); } catch { /* keep room */ }
    try { previousInterval = await settingsManager.getSetting(PROGRESS_INTERVAL_KEY); } catch { /* keep the default */ }
    try {
        ctx = await layoutPanel(tc);
        if (!ctx) return tc.getOverallResult();
        const { panel } = ctx;
        panel.setSectionOpen('settings', true);
        const control = (prop) => panel.rootElement.querySelector(`.flash-panel-setting[data-setting="${prop}"] .flash-panel-setting-input`);
        const row = (prop) => panel.rootElement.querySelector(`.flash-panel-setting[data-setting="${prop}"]`);
        const shown = ['runtime', 'seedlingJsGraphics', 'seedlingJsCamera', 'seedlingJsLights', 'seedlingSolverWalk',
            'seedlingSolveProgressIntervalMs'].map((p) => `${p}:${row(p)?.style.display}`);
        tc.assertEqual('on the JS runtime every control is shown', true, shown.every((x) => x.endsWith(':flex')));
        tc.assertEqual('the solver budgets and the fidelity switches are NOT in the section', 0,
            panel.rootElement.querySelectorAll('.flash-panel-setting[data-setting*="Budget"], .flash-panel-setting[data-setting*="UpgradeWindow"], '
                + '.flash-panel-setting[data-setting*="KillLock"], .flash-panel-setting[data-setting*="Contact"]').length);
        const runtime = control('runtime');
        const offered = [...runtime.options].filter((o) => !o.hidden).map((o) => o.textContent);
        tc.log(`runtime choices: ${offered.join(' | ')}`);
        tc.assertEqual('the runtime offers auto (naming what it picks) and the runtimes Seedling\'s wiring plays', true,
            offered[0] === 'auto (→ wasm)' && ['wasm', 'js'].every((r) => offered.includes(r)));
        tc.assertEqual('the runtime control shows the setting', 'js', runtime.value);

        // control → setting: the refresh rate (applies from the next solve), the same key the Settings panel writes
        const interval = control('seedlingSolveProgressIntervalMs');
        const target = [...interval.options].map((o) => o.value).find((v) => v !== interval.value);
        interval.value = target;
        interval.dispatchEvent(new Event('change'));
        const wrote = await tc.pollForCondition(async () => Number(await settingsManager.getSetting(PROGRESS_INTERVAL_KEY)) === Number(target),
            `the control wrote ${PROGRESS_INTERVAL_KEY} = ${target}`, 3000, 50);
        tc.reportCondition('the Settings section\'s control writes the setting', !!wrote);
        const applied = await tc.pollForCondition(() => panel._solveProgressView.intervalMs === Number(target),
            'the panel applied the written rate to its view', 3000, 50);
        tc.reportCondition('the written setting is applied (the view\'s rate)', !!applied);

        // setting → control: the camera, written the way the Settings panel writes it
        const camera = control('seedlingJsCamera');
        const next = previousCamera === 'follow' ? 'room' : 'follow';
        await settingsManager.updateSetting(CAMERA_SETTING_KEY, next, { persist: false });
        const followed = await tc.pollForCondition(() => camera.value === next,
            `the camera control follows the setting (${next})`, 3000, 50);
        tc.reportCondition('the control follows a setting written elsewhere', !!followed);
    } finally {
        try { await settingsManager.updateSetting(CAMERA_SETTING_KEY, previousCamera, { persist: false }); } catch { /* best effort */ }
        try {
            if (previousInterval !== null && previousInterval !== undefined) await settingsManager.updateSetting(PROGRESS_INTERVAL_KEY, previousInterval);
        } catch { /* best effort */ }
        restoreLayout(ctx);
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-panel-layout-settings',
    name: 'Seedling panel layout: the Settings section writes and follows the settings',
    description: 'On the JS runtime, seedling_atlas: the Settings section shows the runtime (auto named, the runtimes Seedling '
        + 'plays), graphics, camera, lights, the solver walk and the progress refresh, and no solver budget or fidelity '
        + 'switch; changing the refresh control writes moduleSettings.flashPanel.seedlingSolveProgressIntervalMs (and the '
        + 'view applies it); writing the camera setting elsewhere moves the camera control.',
    testFunction: seedlingPanelLayoutSettings,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

export async function seedlingPanelLayoutNarrow(tc) {
    let ctx = null;
    let previousRuntime = 'auto';
    let rootCss = null;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        ctx = await layoutPanel(tc);
        if (!ctx) return tc.getOverallResult();
        const { panel } = ctx;
        const root = panel.rootElement;
        rootCss = root.style.cssText;
        // a phone: the panel alone, 360 px wide, every section open (the widest the panel gets)
        for (const id of ['solver', 'settings', 'tools']) panel.setSectionOpen(id, true);
        root.style.position = 'fixed';
        root.style.left = '0';
        root.style.top = '0';
        root.style.width = '360px';
        root.style.height = '100vh';
        root.style.zIndex = '100000';
        const [w, h] = panel._stageSize ?? [0, 0];
        tc.assertEqual('the game\'s native size is the config\'s stage_size', JSON.stringify(panel.gameConfig?.stage_size ?? [480, 480]),
            JSON.stringify([w, h]));
        const fitted = await tc.pollForCondition(() => Number(panel.stageElement.dataset.scale) < 1,
            'the stage re-fitted to the narrow panel', 3000, 50);
        tc.reportCondition('the game scaled down to the panel\'s width', !!fitted);
        const frame = document.getElementById(panel.flashObjectId).getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        const stage = panel.stageElement.getBoundingClientRect();
        const k = Number(panel.stageElement.dataset.scale);
        tc.log(`360 px: scale ${k}; frame ${Math.round(frame.left)},${Math.round(frame.top)} ${frame.width.toFixed(1)}×${frame.height.toFixed(1)}; `
            + `root ${rr.width}; overflow ${root.scrollWidth - root.clientWidth}`);
        tc.assertEqual('no horizontal overflow at 360 px, every section open', true, root.scrollWidth <= root.clientWidth);
        tc.assertEqual('the game is fully inside the panel (left and right)', true, frame.left >= rr.left - 0.5 && frame.right <= rr.right + 0.5);
        tc.assertEqual('the game keeps its aspect ratio', true, Math.abs(frame.width / frame.height - w / h) < 0.01);
        tc.assertEqual('the game fills the stage\'s width', true, Math.abs(frame.width - stage.width) < 1);
        tc.assertEqual('the stage is exactly as tall as the scaled game (nothing under it is covered)', true, Math.abs(frame.height - stage.height) < 1);
        // the AP loading overlay sits over the scaled game exactly (it is inside the scaled box)
        const overlay = panel._seedlingOverlay();
        overlay.show();
        const or = overlay.element.getBoundingClientRect();
        overlay.remove();
        tc.assertEqual('the loading overlay covers the scaled game exactly', true,
            ['left', 'top', 'width', 'height'].every((p) => Math.abs(or[p] - frame[p]) < 1));
        // back to a wide panel: never scaled UP past the native size
        root.style.width = `${w + 200}px`;
        const wide = await tc.pollForCondition(() => panel.stageElement.dataset.scale === '1', 'the stage re-fitted to a wide panel', 3000, 50);
        tc.reportCondition('a wide panel shows the game at its native size, not larger', !!wide
            && Math.abs(document.getElementById(panel.flashObjectId).getBoundingClientRect().width - w) < 1);
    } finally {
        if (ctx && rootCss !== null) ctx.panel.rootElement.style.cssText = rootCss;
        restoreLayout(ctx);
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-panel-layout-narrow',
    name: 'Seedling panel layout: at 360 px the whole panel fits and the game is fully visible',
    description: 'On the JS runtime, seedling_atlas, the panel alone at 360 px with every section open: no horizontal '
        + 'overflow; the game is scaled down to the panel\'s width, aspect ratio kept, fully inside the panel, the stage '
        + 'exactly as tall as it; the AP loading overlay covers the scaled game exactly; at a wide width the game is '
        + 'its native size (never scaled up).',
    testFunction: seedlingPanelLayoutNarrow,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── Seedling solver-walk S3: a KILL LOCK on the live page (scratch persistence, ⚖ Q4) ──

/**
 * The S3 witness (plan §3 S3): level 5, entered from level 4's stairs, out by
 * the teleporter at (48, 112) to level 6 — behind `lock@48,112`, a kill lock
 * that opens when the room's three bobs are dead. J3's page HALTED by name at
 * the first kill ("OPENS 1 kill lock … DECLARES no clear"); since S3 every
 * room boots on scratch persistence and the run writes the clear itself.
 */
const KILL_ROOM = Object.freeze({ level: 5, from: 4, exit: { x: 48, y: 112 }, to: 6, lockTag: 0 });

/** The `pendingCheck` values the page reported, parsed. */
function reportedChecks(win) {
    return (win?.__swfBridge?.stateLog ?? []).filter((r) => r.name === 'pendingCheck' && r.value)
        .map((r) => { const [, level, tag, written] = String(r.value).split('|').map(Number); return { level, tag, written }; });
}

export async function seedlingJsRuntimeSolverOpensKillLock(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    try {
        await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, win } = up;
        const pushed = await tc.pollForCondition(() => rt.playback.solverWalk === true,
            'the setting reached the JS page (playback.solverWalk)', 5000, 100);
        tc.reportCondition('the page is in solver mode', !!pushed);

        // ── the room, derived from the map ──
        const map = await (await fetch(new URL(VANILLA_MAP_URL, document.baseURI).href)).json();
        const room = map.levels.find((l) => l.level === KILL_ROOM.level);
        const tile = (e) => [Math.floor(e.x / map.tile_size), Math.floor(e.y / map.tile_size)];
        const door = room.entities.find((e) => Number(e.attrs?.to) === KILL_ROOM.from);
        const exit = room.entities.find((e) => e.x === KILL_ROOM.exit.x && e.y === KILL_ROOM.exit.y && Number(e.attrs?.to) === KILL_ROOM.to);
        const lock = room.entities.find((e) => e.type === 'lock' && Number(e.attrs?.tag) === KILL_ROOM.lockTag);
        const spawn = door ? returnSpawnTable(map).get(returnKey(KILL_ROOM.level, ...tile(door))) : null;
        tc.reportCondition(`level ${KILL_ROOM.level} has its door from ${KILL_ROOM.from}, the exit to ${KILL_ROOM.to}, `
            + `its kill lock (tag ${KILL_ROOM.lockTag}) and a return spawn`, !!(door && exit && lock && spawn));
        if (!door || !exit || !lock || !spawn) return tc.getOverallResult();

        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [KILL_ROOM.level, spawn.x, spawn.y] }]);
        const there = await tc.pollForCondition(() => rt.run?.level === KILL_ROOM.level,
            `the page is in level ${KILL_ROOM.level}`, 10000, 100);
        tc.reportCondition('teleported into the kill-lock room', !!there);
        if (!there) return tc.getOverallResult();
        tc.assertEqual('the page\'s run is on SCRATCH persistence (⚖ Q4)', true, rt.run.scratchPersistence);
        const exitsBefore = reportedExits(win).length;
        const checksBefore = reportedChecks(win).length;
        const checkedBefore = snapshotFacts(tc).checked.size;
        const answer = rt.playback.walkTo({ kind: 'exit', level: KILL_ROOM.level, tiles: [tile(exit)] });
        tc.assertEqual('the page accepted the exit goal (behind the lock)', true, !!answer?.ok);
        rt.playback.play();
        const settled = await tc.pollForCondition(() => ['done', 'failed'].includes(rt.playback.state) || !!rt.halted,
            'the solver-driven walk settled (done / failed / halted)', 90000, 200);
        const s = rt.playback.solverStats;
        tc.log(`walk: ${rt.playback.describe()}; solver ${JSON.stringify({ ...s, lastSolve: s.lastSolve
            ? { ...s.lastSolve, goal: undefined } : null })}`);
        tc.reportCondition('the walk settled', !!settled);
        tc.assertEqual('0 HALT (J3 halted at the kill)', null, rt.halted ? rt.halted.message : null);
        tc.assertEqual('the walk is DONE (crossed past the kill lock)', 'done', rt.playback.state);
        // Fidelity F1/F1b/F1c (game-exact bodies): the first attempt may decline ONCE — measured on CI 8/8 (the
        // node row `jsRuntimeDeclarations.test.js` pins the dwell's timeout for bob@48,80 exactly); the S2 retry
        // solves and crosses. More than one decline, or a decline that names something else, is a defect.
        tc.assertEqual('the SOLVER drove it: solved once, at most one decline before it', true,
            s.solves === 1 && s.declines <= 1);
        if (s.declines === 1) {
            tc.log(`the one decline: ${s.lastDecline}`);
            tc.reportCondition(`the one decline is the kill-lock dwell or the solve budget: ${s.lastDecline}`,
                /dwell|never became true|exceeded .* s on/.test(String(s.lastDecline ?? '')));
        }
        tc.assertEqual('the plan KILLED (the solver\'s kill verb)', true, (s.lastSolve?.verbs ?? []).includes('kill'));
        tc.assertEqual('every planned key was played on the page clock (no refutation)', `${s.lastSolve?.keys}/0`,
            `${s.played}/${s.refutations}`);
        const exits = reportedExits(win).slice(exitsBefore);
        tc.assertEqual(`the crossing was reported: a pendingExit from level ${KILL_ROOM.level} at (48, 112) to ${KILL_ROOM.to}`,
            JSON.stringify({ fromLevel: KILL_ROOM.level, type: 'teleporter', ...KILL_ROOM.exit, to: KILL_ROOM.to }),
            JSON.stringify(exits[0] ?? null));
        // The clear is reported as the game reports `Lock.turnOff()` (`Lock.as:96`)…
        const checks = reportedChecks(win).slice(checksBefore);
        tc.assertEqual(`the lock's clear was reported once: pendingCheck <seq>|${KILL_ROOM.level}|${KILL_ROOM.lockTag}|0`,
            JSON.stringify([{ level: KILL_ROOM.level, tag: KILL_ROOM.lockTag, written: 0 }]), JSON.stringify(checks));
        // …and the host's check binding makes NO location check of it (a kill lock is no location).
        await new Promise((r) => setTimeout(r, 500));
        tc.assertEqual('no AP location was checked by the walk (no false check)', checkedBefore, snapshotFacts(tc).checked.size);
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
    } finally {
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-opens-kill-lock',
    name: 'Seedling JS runtime: the solver mode KILLS past a kill lock (L5, scratch persistence)',
    description: 'With flashPanel.runtime = js and the solver mode ON, on seedling_atlas: the page handle teleports '
        + 'the real page into level 5 and its Playback Bot feet walk to the teleporter at (48, 112) behind the kill '
        + 'lock. The page boots on scratch persistence (⚖ Q4), so the solver\'s kill solves, the run writes the '
        + 'lock\'s clear itself, and the crossing to level 6 is reported — the clear reported once as pendingCheck '
        + '<seq>|5|0|0 (as the game\'s Lock.turnOff reports it), no AP location checked, 0 HALT.',
    testFunction: seedlingJsRuntimeSolverOpensKillLock,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── Seedling solver-walk S5: an ARRIVAL ON THE DOOR (step off and back on) ──

/**
 * The S5 witness (plan §3 S5, §1.3 L3 r8c6): level 11's only door lands the
 * player at (96, 128) in level 3 — INSIDE L3's door back to 11, so it is
 * latched and fires only on an entry. The pocket is closed until
 * `breakablerock@96,112` is broken, so the row walks the vanilla round trip:
 * from level 4's arrival (112, 48), with the sword granted through the AP item
 * path ("Progressive Sword", removed again at the end), the solver breaks the rock
 * and takes the door to 11, the bot takes 11's door back (landing latched),
 * then steps off onto the rock's cell and back on — the crossing to 11.
 * ⛓ STEP-OFF RETIRE — the step-off is the SOLVER's (one `step-off, walk` plan
 * from the arrival, fidelity STEP-OFF); the walker never steps off here.
 */
const DOOR_ROOM = Object.freeze({ level: 3, enter: { x: 112, y: 48 }, door: { x: 96, y: 128 }, to: 11 });

export async function seedlingJsRuntimeSolverStepsOffTheDoor(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    let granted = false;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    try {
        await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, win } = up;
        const pushed = await tc.pollForCondition(() => rt.playback.solverWalk === true,
            'the setting reached the JS page (playback.solverWalk)', 5000, 100);
        tc.reportCondition('the page is in solver mode', !!pushed);

        // ── the doors, derived from the map ──
        const map = await (await fetch(new URL(VANILLA_MAP_URL, document.baseURI).href)).json();
        const tile = (e) => [Math.floor(e.x / map.tile_size), Math.floor(e.y / map.tile_size)];
        const door = map.levels.find((l) => l.level === DOOR_ROOM.level).entities
            .find((e) => e.x === DOOR_ROOM.door.x && e.y === DOOR_ROOM.door.y && Number(e.attrs?.to) === DOOR_ROOM.to);
        const back = map.levels.find((l) => l.level === DOOR_ROOM.to).entities
            .find((e) => e.type === 'teleporter' && Number(e.attrs?.to) === DOOR_ROOM.level);
        tc.reportCondition(`level ${DOOR_ROOM.to}'s door back lands ON level ${DOOR_ROOM.level}'s door to it`,
            !!(door && back && Number(back.attrs.playerx) === door.x && Number(back.attrs.playery) === door.y));
        if (!door || !back) return tc.getOverallResult();

        const walk = async (goal, what) => {
            const answer = rt.playback.walkTo(goal);
            tc.assertEqual(`the page accepted the goal: ${what}`, true, !!answer?.ok);
            rt.playback.play();
            const settled = await tc.pollForCondition(() => ['done', 'failed'].includes(rt.playback.state) || !!rt.halted,
                `${what}: the walk settled`, 60000, 100);
            tc.log(`${what}: ${rt.playback.describe()}; stepOffs ${rt.playback.stats.stepOffs}`);
            return !!settled && rt.playback.state === 'done';
        };

        // The sword through the normal item path: the host owns the page's item flags.
        await tc.stateManager.addItemToInventory('Progressive Sword', 1);
        granted = true;
        await tc.stateManager.pingWorker('after-item-grant', 5000);
        const armed = await tc.pollForCondition(() => rt.flags?.hasSword === true,
            'the host delivered the sword to the page (Main.hasSword)', 10000, 100);
        tc.reportCondition('the page holds the sword', !!armed);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [DOOR_ROOM.level, DOOR_ROOM.enter.x, DOOR_ROOM.enter.y] }]);
        const there = await tc.pollForCondition(() => rt.run?.level === DOOR_ROOM.level && rt.flags?.hasSword === true,
            `the page is in level ${DOOR_ROOM.level} with the sword`, 10000, 100);
        tc.reportCondition('teleported into level 3 with the sword', !!there);
        if (!there) return tc.getOverallResult();
        const doorGoal = { kind: 'exit', level: DOOR_ROOM.level, tiles: [tile(door)] };
        if (!await walk(doorGoal, 'break the rock, take the door to 11')) return tc.getOverallResult();
        tc.assertEqual('the solver broke the rock on the way', true,
            (rt.playback.solverStats.lastSolve?.verbs ?? []).includes('break'));
        if (!await walk({ kind: 'exit', level: DOOR_ROOM.to, tiles: [tile(back)] }, 'take 11\'s door back')) {
            return tc.getOverallResult();
        }
        tc.assertEqual(`the arrival stands ON the door: level ${DOOR_ROOM.level}, latched`, `${DOOR_ROOM.level}/1`,
            `${rt.run?.level}/${rt.run?.state?.latched?.size ?? 0}`);

        const exitsBefore = reportedExits(win).length;
        const before = rt.playback.solverStats;   // cumulative over the page's goals: the rows read deltas
        const crossed = await walk(doorGoal, 'step off the door and back on');
        const s = rt.playback.solverStats;
        tc.log(`solver ${JSON.stringify({ ...s, lastSolve: s.lastSolve ? { ...s.lastSolve, goal: undefined } : null })}`);
        tc.reportCondition('the walk from the arrival is DONE', crossed);
        // ⛓ STEP-OFF RETIRE — the solver steps off the latched door itself (fidelity STEP-OFF): no walker hand-off.
        tc.assertEqual('the WALKER never stepped off (the latched phase is the solver\'s now)', 0, rt.playback.stats.stepOffs);
        tc.assertEqual('the SOLVER stepped off and walked it back: one more solve, no decline', '1/0',
            `${s.solves - before.solves}/${s.declines - before.declines}`);
        tc.assertEqual('…a STEP-OFF then a WALK, every planned key played, no refutation', `step-off,walk/${s.lastSolve?.keys}/0`,
            `${(s.lastSolve?.verbs ?? []).join(',')}/${s.played - before.played}/${s.refutations - before.refutations}`);
        const exits = reportedExits(win).slice(exitsBefore);
        tc.assertEqual(`the crossing was reported: a pendingExit from level ${DOOR_ROOM.level} at the door to ${DOOR_ROOM.to}`,
            JSON.stringify({ fromLevel: DOOR_ROOM.level, type: 'teleporter', ...DOOR_ROOM.door, to: DOOR_ROOM.to }),
            JSON.stringify(exits[0] ?? null));
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
    } finally {
        // The row's own grant comes back out (in-app rows clean up their state).
        if (granted) { try { await tc.stateManager.removeItemFromInventory('Progressive Sword', 1); } catch { /* best effort */ } }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-steps-off-the-door',
    name: 'Seedling JS runtime: an arrival ON the door steps off and back on (L3 ↔ L11)',
    description: 'With flashPanel.runtime = js and the solver mode ON, on seedling_atlas: with the sword the solver '
        + 'breaks L3\'s rock and takes the door to 11; 11\'s only door lands the player back INSIDE that door '
        + '(latched — it fires only on an entry). The SOLVER steps off onto the rock\'s cell and walks back on (one plan), '
        + 'and the crossing to 11 is reported — 0 HALT, no decline, no error: status.',
    testFunction: seedlingJsRuntimeSolverStepsOffTheDoor,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── Seedling solver-walk S2: the solve runs in a WORKER, under a wall-clock budget ──

/**
 * The S2 witness room: level 12 entered through its teleporter at (304, 0),
 * out by the teleporter at (168, 368) to level 36 — a walk the J2 walker
 * cannot do and the solver can (§1.3), and the slowest measured solve: 5.2 s
 * from the door, ~2 s after 120 walker ticks (§1.6).
 */
const SLOW_ROOM = Object.freeze({ level: 12, door: { x: 304, y: 0 }, exit: { x: 168, y: 368 }, to: 36 });

/**
 * Runtime js + the solver mode ON on seedling_atlas, the real page teleported
 * into `SLOW_ROOM` at its door's return spawn. Returns `{rt, win, exitTile}`
 * or null (a reported failure). The caller restores the settings.
 */
async function slowRoomOnPage(tc) {
    await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
    if (!ready) return null;
    const up = await atlasPanelOnJs(tc, staleAdapter);
    if (!up) return null;
    const { rt, win } = up;
    const pushed = await tc.pollForCondition(() => rt.playback.solverWalk === true,
        'the setting reached the JS page (playback.solverWalk)', 5000, 100);
    tc.reportCondition('the page is in solver mode', !!pushed);
    tc.assertEqual('the page solves in a WORKER (its solve service)', 'worker', rt.playback.solveService?.kind ?? null);
    const map = await (await fetch(new URL(VANILLA_MAP_URL, document.baseURI).href)).json();
    const room = map.levels.find((l) => l.level === SLOW_ROOM.level);
    const tile = (p) => [Math.floor(p.x / map.tile_size), Math.floor(p.y / map.tile_size)];
    const at = (p) => room.entities.find((e) => e.x === p.x && e.y === p.y);
    const spawn = returnSpawnTable(map).get(returnKey(SLOW_ROOM.level, ...tile(SLOW_ROOM.door)));
    tc.reportCondition(`level ${SLOW_ROOM.level} has its door, its exit and a return spawn`,
        !!(at(SLOW_ROOM.door) && at(SLOW_ROOM.exit) && spawn));
    if (!at(SLOW_ROOM.door) || !at(SLOW_ROOM.exit) || !spawn) return null;
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [SLOW_ROOM.level, spawn.x, spawn.y] }]);
    const there = await tc.pollForCondition(() => rt.run?.level === SLOW_ROOM.level,
        `the page is in level ${SLOW_ROOM.level}`, 10000, 100);
    tc.reportCondition('teleported into the slow room', !!there);
    return there ? { rt, win, exitTile: tile(SLOW_ROOM.exit) } : null;
}

/**
 * ⛓ IN-APP TIMING CONTROLS — the rows below need a solve IN FLIGHT past a bound (the 300 ms backstop; ≥ 500 ms of a
 * held room). A real solve's length is not a control: wave 12's SOLVECOST made L12 5.8–12.7× faster and both rows
 * went red. So the ROW owns the hold, through the seam the page already has — its service builds each worker with
 * `new win.Worker(…)` when it needs one (`jsRuntimePage.js`): while installed, the page's next worker is a REAL solve
 * worker wrapped here. `started` passes straight through (the backstop counts from it); then —
 *   `{ answer: false }`        nothing more reaches the page (no pass, no progress, no result): it never answers;
 *   `{ answer: true, holdMs }` the real result is delivered no sooner than `holdMs` after `started` (passes and
 *                              progress pass through; a terminated worker's held result is dropped).
 * The solve itself is untouched (the worker runs the request it was sent), and nothing in production changes.
 * `restore()` puts the page's Worker back and drops a wrapped worker that is still live (`dispose`), so the next
 * solve on this page builds a real one.
 */
function holdSolveWorker(win, svc, { answer, holdMs = 0 }) {
    const RealWorker = win.Worker;
    const record = { wrapped: 0, started: 0, swallowed: 0, held: 0, delivered: 0, solveMs: null, disposedFirst: false };
    // A worker built before the hold would bypass it: drop it, so the next solve builds a wrapped one.
    if (svc.stats.live) { svc.dispose(); record.disposedFirst = true; }
    class HeldWorker {
        constructor(url, opts) {
            const real = new RealWorker(url, opts);
            record.wrapped += 1;
            let startedAt = null;
            let dead = false;
            this.onmessage = null;
            this.onerror = null;
            const pass = (event) => { if (!dead) this.onmessage?.(event); };
            real.onmessage = (event) => {
                const type = event.data?.type;
                if (type === 'started') { startedAt = win.performance.now(); record.started += 1; pass(event); return; }
                if (!answer) { record.swallowed += 1; return; }
                if (type !== 'result') { pass(event); return; }
                record.solveMs = Math.round(win.performance.now() - startedAt);
                const wait = holdMs - (win.performance.now() - startedAt);
                if (wait <= 0) { record.delivered += 1; pass(event); return; }
                record.held += 1;
                win.setTimeout(() => { if (!dead) { record.delivered += 1; pass(event); } }, wait);
            };
            real.onerror = (event) => { if (!dead) this.onerror?.(event); };
            this.postMessage = (msg) => real.postMessage(msg);
            this.terminate = () => { dead = true; real.terminate(); };
        }
    }
    win.Worker = HeldWorker;
    return {
        record,
        restore() {
            if (win.Worker === HeldWorker) win.Worker = RealWorker;
            if (svc.stats.live) svc.dispose();
        },
    };
}

export async function seedlingJsRuntimeSolverBudgetFallsBack(tc) {
    let previousRuntime = 'auto';
    let previousSolver = false;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    let rt = null;
    let hold = null;
    try {
        const up = await slowRoomOnPage(tc);
        if (!up) return tc.getOverallResult();
        ({ rt } = up);
        // ⛓ DETERMINISTIC BUDGET — the solve's budget is WORK (the same answer on every machine), so the only
        // wall-clock cut left is the BACKSTOP, shortened here (the test knob; the page also reads
        // ?solverBackstopMs=). Past it the goal FAILS by name: nothing is played, nothing is walked instead (a slow
        // machine never changes the outcome into a different one).
        // ⛓ IN-APP TIMING CONTROLS — the solve is kept in flight past the backstop by the ROW (its worker starts and
        // never answers, `holdSolveWorker`), not by the solve being slow: the door solve took ~5 s, and since wave
        // 12's SOLVECOST it finishes inside 300 ms, so this row went red.
        hold = holdSolveWorker(up.win, rt.playback.solveService, { answer: false });
        const backstop = rt.playback.solverBackstopMs;
        rt.playback.setSolverBackstopMs(300);
        const solves0 = rt.playback.solveService.stats.terminated;
        const run0 = rt.run;
        const at0 = { level: run0.level, x: run0.state.x, y: run0.state.y, transitions: run0.transitions.length };
        // ⚠ NOT the run's total tick count: once the goal has FAILED the walker hands back no keys, so the page's
        // clock steps the room IDLE (as it does with no goal at all) — from the very tick that failed (measured on
        // CI: 3 → 4, every run). The hold is sampled WHILE the solve is in flight instead.
        const held = { first: null, last: null, samples: 0 };
        rt.playback.walkTo({ kind: 'exit', level: SLOW_ROOM.level, tiles: [up.exitTile] });
        rt.playback.play();
        const failed = await tc.pollForCondition(() => {
            if (rt.playback.solving) {
                const t = rt.run.ticksCompleted;
                held.first ??= t;
                held.last = t;
                held.samples += 1;
            }
            return rt.playback.state === 'failed';
        }, 'the solve was cut off at the backstop and the goal FAILED', 15000, 50);
        const s = rt.playback.solverStats;
        tc.log(`failed after ${s.lastWaitMs} ms: ${rt.playback.reason}; status: ${rt.playback.describe()}`);
        tc.reportCondition('failed within the backstop\'s reach', !!failed);
        tc.assertEqual('the failure NAMES the backstop', true,
            /^the solve exceeded the backstop on this machine \(0\.3 s\) on reach-exit in level 12 \(terminated; the solve's own budget is \d+ work units\)/
                .test(rt.playback.reason ?? ''));
        tc.assertEqual('one backstop, no solve, no decline, nothing played', '1/0/0/0', `${s.backstops}/${s.solves}/${s.declines}/${s.played}`);
        tc.assertEqual('the worker was TERMINATED', solves0 + 1, rt.playback.solveService.stats.terminated);
        tc.assertEqual('cut off at the backstop, not before it', true, s.lastWaitMs >= 300 && s.lastWaitMs < 3000);
        tc.log(`held ${held.samples} sample(s) at run tick ${held.first}..${held.last}; walker ${JSON.stringify(rt.playback.stats)}; `
            + `row's worker ${JSON.stringify(hold.record)}`);
        tc.assertEqual('the solve ran in the row\'s held worker (one real worker wrapped, it STARTED, it never answered)',
            '1/1/0', `${hold.record.wrapped}/${hold.record.started}/${hold.record.delivered}`);
        tc.assertEqual('the room was HELD while the solve was in flight (sampled; the run never stepped under it)', true,
            held.samples > 0 && held.first === held.last);
        const { driven, plans } = rt.playback.stats;
        tc.assertEqual('the page did not walk the goal instead (the walker drove 0 ticks, planned 0 routes)', '0/0',
            `${driven}/${plans}`);
        const run1 = rt.run;
        tc.assertEqual('the player never moved and never left the room (the same run, spot and level; no crossing)',
            JSON.stringify(at0),
            JSON.stringify({ level: run1.level, x: run1.state.x, y: run1.state.y, transitions: run1.transitions.length }));
        tc.assertEqual('the same run (no re-boot under the failure)', true, run1 === run0);
        tc.assertEqual('the room is no longer held', false, rt.playback.solving);
        rt.playback.setSolverBackstopMs(backstop);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
    } finally {
        try { rt?.playback.reset(); } catch { /* best effort */ }
        try { hold?.restore(); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-budget-falls-back',
    // ⛓ DETERMINISTIC BUDGET — the id is kept (a rename would re-enrol the row); its subject is now the BACKSTOP.
    name: 'Seedling JS runtime: a solve past the wall-clock backstop is terminated and the goal FAILS by name (never walked, never played)',
    description: 'With flashPanel.runtime = js and flashPanel.seedlingSolverWalk ON, on seedling_atlas: the page is '
        + 'teleported to level 12\'s door and its wall-clock backstop shortened to 300 ms (playback.setSolverBackstopMs, the '
        + 'test knob; the solve\'s own budget is work units, the same on every machine). The ROW keeps the solve in flight: '
        + 'the page\'s next worker is a real one wrapped so it starts and never answers (never the solve\'s speed). '
        + 'The worker is terminated at the backstop and the goal FAILS with "the solve exceeded the backstop on this machine '
        + '(0.3 s) …"; nothing of the solve is played and the walker does not take the goal instead.',
    testFunction: seedlingJsRuntimeSolverBudgetFallsBack,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

export async function seedlingJsRuntimeSolverKeepsTheFrameClock(tc) {
    let previousRuntime = 'auto';
    let previousSolver = false;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    let rt = null;
    let hold = null;
    try {
        const up = await slowRoomOnPage(tc);
        if (!up) return tc.getOverallResult();
        ({ rt } = up);
        const { win } = up;
        const goal = { kind: 'exit', level: SLOW_ROOM.level, tiles: [up.exitTile] };
        // 120 walker ticks in (§1.6: a ~2 s solve from there — inside the 5 s budget, long enough to see a freeze).
        rt.playback.setSolverWalk(false);
        rt.playback.walkTo(goal);
        rt.playback.play();
        const t0 = rt.run.ticksCompleted;
        await tc.pollForCondition(() => rt.run.ticksCompleted >= t0 + 120, 'the J2 walker walked 120 ticks', 15000, 20);
        rt.playback.stop();
        // ── the frame clock: the page's own heartbeat (a 20 ms interval) and its animation frames ──
        const clock = { lastBeat: win.performance.now(), maxBeatGap: 0, lastFrame: null, maxFrameGap: 0, frames: 0,
            solvingMs: 0, held: 0, ticksWhileSolving: null };
        const beat = win.setInterval(() => {
            const now = win.performance.now();
            if (rt.playback.solving) clock.maxBeatGap = Math.max(clock.maxBeatGap, now - clock.lastBeat);
            clock.lastBeat = now;
        }, 20);
        let raf = true;
        const frame = (now) => {
            if (!raf) return;
            if (rt.playback.solving && clock.lastFrame !== null) { clock.maxFrameGap = Math.max(clock.maxFrameGap, now - clock.lastFrame); clock.frames += 1; }
            clock.lastFrame = now;
            win.requestAnimationFrame(frame);
        };
        win.requestAnimationFrame(frame);
        let solveStart = null;
        let runTicksAtStart = null;
        // ⛓ IN-APP TIMING CONTROLS — the solve is kept in flight ≥ HOLD_MS by the ROW (the real worker's real answer is
        // delivered no sooner, `holdSolveWorker`), not by the solve being slow: it took ~2 s, and since wave 12's
        // SOLVECOST it can finish inside the 500 ms this row needs to watch the clock, so the row went red.
        const HOLD_MS = 800;
        hold = holdSolveWorker(win, rt.playback.solveService, { answer: true, holdMs: HOLD_MS });
        // ⛓ DETERMINISTIC BUDGET — no budget override: the work budget gives this solve the same answer under any load.
        try {
            rt.playback.setSolverWalk(true);
            rt.playback.walkTo(goal);
            rt.playback.play();
            const settled = await tc.pollForCondition(() => {
                // Sampled only WHILE solving: the first and last solving samples bound the hold.
                if (rt.playback.solving) {
                    if (solveStart === null) { solveStart = performance.now(); runTicksAtStart = rt.run.ticksCompleted; }
                    clock.solvingMs = performance.now() - solveStart;
                    clock.ticksWhileSolving = rt.run.ticksCompleted - runTicksAtStart;
                    clock.held += 1;
                }
                return ['done', 'failed'].includes(rt.playback.state) || !!rt.halted;
            }, 'the solver-driven walk settled', 60000, 10);
            tc.reportCondition('the walk settled', !!settled);
        } finally {
            raf = false;
            win.clearInterval(beat);
        }
        const s = rt.playback.solverStats;
        tc.log(`solve ${s.lastSolve?.solveMs} ms in the worker (waited ${s.lastSolve?.waitMs} ms, observed ${Math.round(clock.solvingMs)} ms); `
            + `max heartbeat gap while solving ${Math.round(clock.maxBeatGap)} ms; max animation-frame gap ${Math.round(clock.maxFrameGap)} ms `
            + `over ${clock.frames} frame(s); row's worker ${JSON.stringify(hold.record)}`);
        tc.assertEqual('the walk is DONE (level 12 → 36)', 'done', rt.playback.state);
        tc.assertEqual('solved once in the worker, no decline, no refutation', '1/0/0/worker',
            `${s.solves}/${s.declines}/${s.refutations}/${s.lastSolve?.where}`);
        tc.assertEqual('the solve ran in the row\'s held worker (one real worker wrapped, it STARTED, its one answer delivered)',
            '1/1/1', `${hold.record.wrapped}/${hold.record.started}/${hold.record.delivered}`);
        tc.assertEqual(`a solve was in flight ≥ 500 ms (its real answer held to ${HOLD_MS} ms; the worker answered in ${hold.record.solveMs} ms)`,
            true, clock.solvingMs >= 500);
        tc.assertEqual(`the room was HELD while it was (the run did not step over ${clock.held} sample(s))`, 0, clock.ticksWhileSolving);
        tc.assertEqual('⛔ the page\'s frame clock did not stall: every heartbeat gap < 250 ms while solving', true,
            clock.maxBeatGap > 0 && clock.maxBeatGap < 250);
        tc.assertEqual(`the page is in level ${SLOW_ROOM.to}`, SLOW_ROOM.to, rt.run?.level ?? null);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
    } finally {
        try { rt?.playback.reset(); } catch { /* best effort */ }
        try { hold?.restore(); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-keeps-the-frame-clock',
    name: 'Seedling JS runtime: the solver thinks in a worker — the page\'s frame clock never stalls',
    description: 'With flashPanel.runtime = js and flashPanel.seedlingSolverWalk ON, on seedling_atlas: level 12, 120 '
        + 'walker ticks in (S1 froze the page for its solve). The solve runs in the worker — the ROW holds its real answer to '
        + '800 ms, so the page waits that long whatever the solve\'s speed; the page\'s 20 ms '
        + 'heartbeat never gaps past 250 ms while it does, the room is held (the run does not step), and the plan then '
        + 'plays to level 36 — solved once, no decline, no refutation.',
    testFunction: seedlingJsRuntimeSolverKeepsTheFrameClock,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── Seedling solver-walk S4: the solver's remaining verbs — a PIT exit, a CHEST beyond the house ──

/**
 * The S4 witnesses, read from the committed `seedling_playthrough` preset's
 * own region payloads (the exit's cell, the arrival spawn): level 30's
 * `out_pit_3_34` — a PIT tile, no teleporter, with a breakable rock standing
 * on it — which the solver plays as `reach-pit`: it BREAKS the rock (the
 * sword, granted through the AP item path as the S5 row does, removed after:
 * a page-side `hasSword` is set back by the host's item sync) and falls to
 * level 31; and level 17's chest (tag 0), a `collect-placement` of a room the
 * house row does not reach.
 * Neither level is a region of `seedling_atlas`: the page handle teleports
 * there, as the S1–S3 rows do (⚖ Q2).
 */
const PLAYTHROUGH_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
const PIT_ROOM = Object.freeze({ region: 'level_30__r2c10', exitId: 'out_pit_3_34', to: 31 });
const CHEST_ROOM = Object.freeze({ region: 'level_17', level: 17, tag: 0 });

/** Runtime js + the solver mode ON on seedling_atlas, the page teleported to `region`'s first arrival spawn. */
async function playthroughRoomOnPage(tc, region, { sword = false } = {}) {
    await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
    if (!ready) return null;
    const up = await atlasPanelOnJs(tc, staleAdapter);
    if (!up) return null;
    const { rt, win } = up;
    const pushed = await tc.pollForCondition(() => rt.playback.solverWalk === true,
        'the setting reached the JS page (playback.solverWalk)', 5000, 100);
    tc.reportCondition('the page is in solver mode', !!pushed);
    const rules = await (await fetch(new URL(PLAYTHROUGH_PATH, document.baseURI).href)).json();
    const pl = rules.preset_sidecars?.['1']?.[region]?.playable_payload ?? null;
    const spawn = pl?.exits?.find((e) => e.entrance_spawn)?.entrance_spawn ?? null;
    tc.reportCondition(`seedling_playthrough has region ${region} with an arrival spawn`, !!spawn);
    if (!spawn) return null;
    if (sword) {
        // The host owns the page's item flags: the sword goes through the AP item path (the caller removes it).
        await tc.stateManager.addItemToInventory('Progressive Sword', 1);
        await tc.stateManager.pingWorker('after-item-grant', 5000);
        const armed = await tc.pollForCondition(() => rt.flags?.hasSword === true,
            'the host delivered the sword to the page (Main.hasSword)', 10000, 100);
        tc.reportCondition('the page holds the sword', !!armed);
        if (!armed) return { rt, granted: true };
    }
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
    const there = await tc.pollForCondition(() => rt.run?.level === pl.level && (!sword || rt.flags?.hasSword === true),
        `the page is in level ${pl.level}${sword ? ' with the sword' : ''}`, 10000, 100);
    tc.reportCondition(`teleported into level ${pl.level}`, !!there);
    if (!there) return { rt, granted: sword };
    return { rt, win, pl, bot: ready.bot, granted: sword, ok: true };
}

/** The settled walk's solver stats, logged. */
async function settledSolverWalk(tc, rt, ms = 60000) {
    const settled = await tc.pollForCondition(() => ['done', 'failed'].includes(rt.playback.state) || !!rt.halted,
        'the solver-driven walk settled (done / failed / halted)', ms, 200);
    const s = rt.playback.solverStats;
    tc.log(`walk: ${rt.playback.describe()}; solver ${JSON.stringify({ ...s, lastSolve: s.lastSolve
        ? { ...s.lastSolve, goal: s.lastSolve.goal?.kind } : null })}`);
    tc.reportCondition('the walk settled', !!settled);
    return s;
}

export async function seedlingJsRuntimeSolverFallsThroughPit(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    let rt = null;
    let granted = false;
    try {
        const up = await playthroughRoomOnPage(tc, PIT_ROOM.region, { sword: true });
        granted = !!up?.granted;
        rt = up?.rt ?? null;
        if (!up?.ok) return tc.getOverallResult();
        const { win, pl, bot } = up;
        const exit = pl.exits.find((e) => e.exit_id === PIT_ROOM.exitId);
        const [tx, ty] = exit.exit_tiles[0];
        tc.assertEqual(`level ${pl.level}'s exit cell (${tx}, ${ty}) is a PIT of the live room (no teleporter on it)`, true,
            (rt.run.world.pitTiles ?? []).some((p) => p.tx === tx && p.ty === ty));
        const exitsBefore = reportedExits(win).length;
        const answer = rt.playback.walkTo({ kind: 'exit', level: pl.level, tiles: exit.exit_tiles });
        tc.assertEqual('the page accepted the PIT exit goal (S4 — it used to refuse it)', true, !!answer?.ok);
        rt.playback.play();
        const s = await settledSolverWalk(tc, rt);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
        tc.assertEqual('the walk is DONE (fell through the pit)', 'done', rt.playback.state);
        tc.assertEqual('the SOLVER drove it: solved once, no decline, no refutation', '1/0/0',
            `${s.solves}/${s.declines}/${s.refutations}`);
        tc.assertEqual('the solver goal was reach-pit', 'reach-pit', s.lastSolve?.goal?.kind ?? null);
        tc.assertEqual('the plan BROKE the rock on the pit (the J2 walker alone stalls there)', true,
            (s.lastSolve?.verbs ?? []).includes('break'));
        tc.assertEqual('the solve ran in the page\'s WORKER', 'worker', s.lastSolve?.where ?? null);
        const landed = await tc.pollForCondition(() => rt.run?.level === PIT_ROOM.to && !rt.run.state.fall,
            `the fall's transport landed in level ${PIT_ROOM.to}`, 10000, 100);
        tc.reportCondition('landed', !!landed);
        // A fall writes no pendingExit in the game (`Teleporter.as:107` is the only writer); the level move is the report.
        tc.assertEqual('no pendingExit for a fall', '[]', JSON.stringify(reportedExits(win).slice(exitsBefore)));
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
    } finally {
        if (granted) { try { await tc.stateManager.removeItemFromInventory('Progressive Sword', 1); } catch { /* best effort */ } }
        try { rt?.playback.reset(); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-falls-through-pit',
    name: 'Seedling JS runtime: the solver mode takes a PIT exit (L30 → L31, breaking the rock on the pit)',
    description: 'With flashPanel.runtime = js and the solver mode ON, on seedling_atlas: the sword is granted through '
        + 'the AP item path (removed after), the page handle teleports the real page to seedling_playthrough\'s '
        + 'level_30__r2c10 arrival, and the bot walks to the out_pit_3_34 exit — a PIT tile, no teleporter (S4: the '
        + 'page used to refuse it). The solver plays reach-pit: it BREAKS the rock standing on the pit and falls to '
        + 'level 31; the walk completes on the fall, and no pendingExit is reported (the game writes none for a '
        + 'fall). 0 HALT, no refutation.',
    testFunction: seedlingJsRuntimeSolverFallsThroughPit,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

export async function seedlingJsRuntimeSolverOpensChest(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    let rt = null;
    try {
        const up = await playthroughRoomOnPage(tc, CHEST_ROOM.region);
        rt = up?.rt ?? null;
        if (!up?.ok) return tc.getOverallResult();
        const { win, bot } = up;
        const checksBefore = reportedChecks(win).length;
        const answer = rt.playback.walkTo({ kind: 'location', level: CHEST_ROOM.level, tag: CHEST_ROOM.tag, entityType: 'chest' });
        tc.assertEqual('the page accepted the chest goal', true, !!answer?.ok);
        rt.playback.play();
        const s = await settledSolverWalk(tc, rt);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
        tc.assertEqual('the walk is DONE (the chest opened)', 'done', rt.playback.state);
        tc.assertEqual('the SOLVER drove it: solved once, no decline, no refutation', '1/0/0',
            `${s.solves}/${s.declines}/${s.refutations}`);
        tc.assertEqual('collect-placement, by the chest verb', 'collect-placement/true',
            `${s.lastSolve?.goal?.kind}/${(s.lastSolve?.verbs ?? []).includes('chest')}`);
        tc.assertEqual(`the chest's clear was reported once: pendingCheck <seq>|${CHEST_ROOM.level}|${CHEST_ROOM.tag}|0`,
            JSON.stringify([{ level: CHEST_ROOM.level, tag: CHEST_ROOM.tag, written: 0 }]),
            JSON.stringify(reportedChecks(win).slice(checksBefore)));
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
    } finally {
        try { rt?.playback.reset(); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-opens-chest',
    name: 'Seedling JS runtime: the solver mode opens a CHEST beyond the house (L17, collect-placement)',
    description: 'With flashPanel.runtime = js and the solver mode ON, on seedling_atlas: the page handle teleports '
        + 'the real page to seedling_playthrough\'s level 17 arrival and the bot walks to the chest (tag 0) — the '
        + 'solver\'s collect-placement plans the chest verb (stance, press, ceremony), the page plays it, and the '
        + 'chest\'s clear is reported once as pendingCheck <seq>|17|0|0. 0 HALT, no refutation.',
    testFunction: seedlingJsRuntimeSolverOpensChest,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── ⛓ SEEDLING LOOP MODE: Loops BOT blocks play real atlas rooms ──────────
//
// Loop mode on, a queue of Seedling actions, every Seedling block set to BOT: loops hands each action to the
// `flash_seedling` controller (`executeVia: 'solver'` → `walkTo`) and parks; a location completes on the game's
// OWN check (collected by the runtime), an exit on the crossing's `user:regionMove` — a door the page walks, or a
// LOGICAL link the region binding credits (its regionMove lands on the next turn). The queue then ends on its own.
// ⛓ MANA: each action is charged once, at its completion, at its own loop price (`_completeBotExecutedAction`).
// ⛓ PLAY CLOCK (⚖ "Drain play time too"): a Seedling region is COARSE, and flash_seedling declares
// `loopSupport.playClock`, so the park is ALSO drained per GAME second the game reports (`seedlingPlayClock.js` →
// `substrate:playClock`; `loopState._regionDrainsTime`). Measured here off `loops:manaSpent` and the reports, in bus
// order.

const HOUSE_REGION = 'region_2_2';
const HOUSE_EXIT = 'exit_S';
const MAZE_CHILD = 'region_2_3';

/** The queue block of `region` (its last visit), or null. */
function loopBlockFor(region) {
    const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue?.() ?? []);
    return [...visits].reverse().find((v) => v.name === region) ?? null;
}

const queueLine = (a) => `${a.type}:${a.sourceRegion}>${a.destinationRegion ?? a.locationName ?? ''}`;

/**
 * Queue `steps` (`{check, region}` | `{exit, from, to}`), set every Seedling block to BOT, fill the pool and
 * run the queue to its end. Returns the measured facts, or null (named). `substrateId` = the entry whose controller
 * walks the queue (`flash_seedling` for the atlas rooms, `flash_seedling_gen` for the generated ones).
 */
async function seedlingLoopBotQueue(tc, label, steps, { maxMs = 120000, substrateId = 'flash_seedling' } = {}) {
    const gs = getGameStateSingleton();
    gs.setLoopModeActive(true);
    const on = await tc.pollForCondition(() => gs.isLoopModeActive === true, `[${label}] loop mode on`, 5000, 100);
    tc.reportCondition(`[${label}] loop mode on`, !!on);
    if (!on) return null;
    for (const st of steps) {
        if (st.check) gs.addLocationCheck(st.check, st.region);
        else gs.updatePath(st.to, st.exit, st.from);
    }
    const queue = loopStateSingleton.getActionQueue?.() ?? [];
    const seedlingRegions = [...new Set(steps.map((st) => st.region ?? st.from))];
    for (const r of seedlingRegions) {
        tc.assertEqual(`[${label}] ${r} is a walkTo-solver region (${substrateId} declares executeVia solver)`,
            'walkTo', loopStateSingleton.regionSolver(r));
    }
    const { visits } = resolveQueueBlocks(queue);
    const botBlocks = visits.filter((v) => seedlingRegions.includes(v.name));
    for (const v of botBlocks) loopStateSingleton.setBlockMode(v.name, v.instance, 'bot');
    tc.log(`[${label}] queue: ${JSON.stringify(queue.map(queueLine))}; Bot blocks: ${JSON.stringify(botBlocks.map((v) => `${v.name}#${v.instance}`))}`);
    const queued = steps.map((st) => (st.check ? `locationCheck:${st.region}>${st.check}` : `regionMove:${st.from}>${st.to}`));
    tc.assertEqual(`[${label}] the queue holds the steps, in order, after the start hop`, JSON.stringify(queued),
        JSON.stringify(queue.map(queueLine).filter((q) => seedlingRegions.some((r) => q.includes(`:${r}>`)))));

    const spends = [];
    const regions = [];
    // ⛓ PLAY CLOCK — the spends and the clock's reports in ONE sequence (bus order), each stamped with its time.
    const log = [];
    // Each entry also carries the game seconds Loops has CHARGED as time (`loopState._gameClockCharged`), read once
    // the publish has finished (a stop report settles synchronously, in the same dispatch): a queued action's price
    // never moves it, only the time drain does.
    const note = (entry) => {
        log.push(entry);
        queueMicrotask(() => {
            const c = loopStateSingleton._gameClockCharged;
            entry.charged = c ? { region: c.region, seconds: c.seconds } : null;
        });
    };
    const onSpend = (e) => {
        spends.push({ region: e?.region ?? null, mana: e?.mana ?? null });
        note({ kind: 'spend', at: performance.now(), region: e?.region ?? null, mana: e?.mana ?? null });
    };
    const onClock = (e) => note({ kind: 'clock', at: performance.now(), region: e?.region ?? null,
        running: e?.running ?? null, gameSeconds: e?.stats?.gameSeconds ?? null });
    const onRegion = (e) => regions.push(e?.newRegion ?? null);
    // Loops' NAMED STOP (a Bot walk that failed): it ends the wait at once, its reason in the row's facts.
    let walkFailed = null;
    let onWalkFailed = null;
    const failedStop = new Promise((resolve) => {
        onWalkFailed = (e) => { walkFailed = e?.reason ?? 'no reason given'; resolve(null); };
    });
    tc.eventBus.subscribe('loopState:botWalkFailed', onWalkFailed);
    const manaTrace = [];
    const onMana = () => manaTrace.push(Math.round(gs.getCurrentMana() * 100) / 100);
    const prices = new Map(queue.map((a) => [queueLine(a), loopStateSingleton._calculateActionCost(a)]));
    tc.eventBus.subscribe('loops:manaSpent', onSpend);
    tc.eventBus.subscribe(PLAY_CLOCK_EVENT, onClock);
    tc.eventBus.subscribe('gameState:regionChanged', onRegion);
    tc.eventBus.subscribe('gameState:manaChanged', onMana);
    // The time-drain price of each Seedling region now (XP discounts it as the region is played, so read again after).
    const drainPrice = () => Object.fromEntries(seedlingRegions.map((r) =>
        [r, loopStateSingleton._calculateActionCost({ type: 'timeDrain', sourceRegion: r })]));
    const drainBefore = drainPrice();
    const controller = substrateRegistry.get(substrateId)?.getPlaybackController?.() ?? null;
    const goals = [];
    // ⛔ The controller is ONE instance for the session: the goal it holds now is an earlier row's (measured on CI —
    // the previous row's last goal led the list). Only goals taken after this point are this queue's.
    const staleGoal = controller?.lastGoal ?? null;
    const t0 = performance.now();
    try {
        gs.refillMana();
        const manaBefore = gs.getCurrentMana();
        const completed = tc.waitForEvent('loopState:queueCompleted', maxMs).catch(() => null);
        loopStateSingleton.startProcessing();
        const parked = await tc.pollForCondition(() => seedlingRegions.includes(loopStateSingleton.botSolverRegion?.()),
            `[${label}] a Bot block parked on a Seedling region (walkTo handed over)`, 15000, 20);
        tc.reportCondition(`[${label}] a Bot block parked on a Seedling region and handed its action to the controller`, !!parked);
        // Every goal the controller took (a link credit is a goal too), sampled as the queue runs.
        const sample = () => {
            const g = controller?.lastGoal ?? null;
            const key = g && g !== staleGoal ? `${g.kind}:${g.name ?? g.tag}` : null;
            if (key && goals[goals.length - 1] !== key) goals.push(key);
        };
        const sampler = setInterval(sample, 20);
        const ended = await Promise.race([completed, failedStop]);
        clearInterval(sampler);
        // A link credit, its regionMove and the queue's end can all land inside one sample interval.
        sample();
        const out = {
            queueCompleted: !!ended, reason: ended?.reason ?? loopStateSingleton._queueCompletedReason ?? null,
            processing: loopStateSingleton.isProcessing, parkedAfter: loopStateSingleton.botSolverRegion?.() ?? null,
            pausedUntilReset: loopStateSingleton._queuePausedUntilReset === true, walkFailed,
            spent: manaBefore - gs.getCurrentMana(), manaBefore, manaTrace, spends, regions, goals,
            wallSeconds: (performance.now() - t0) / 1000, log, drainBefore, drainAfter: drainPrice(),
            // What each queued Seedling action costs at its loop price (the expected charges, in queue order).
            priced: queued.map((q) => ({ region: q.split(':')[1].split('>')[0], mana: prices.get(q) ?? null })),
        };
        if (!ended) {
            tc.log(`[${label}] DIAG controller: ${JSON.stringify({ status: controller?.status?.() ?? null,
                lastRefusal: controller?.lastRefusal ?? null, lastGoal: controller?.lastGoal ?? null })}; cursor `
                + `${JSON.stringify(loopStateSingleton.currentAction ? queueLine(loopStateSingleton.currentAction) : null)}`, 'error');
        }
        tc.log(`[${label}] ${JSON.stringify(out)}`);
        return out;
    } finally {
        tc.eventBus.unsubscribe?.('loops:manaSpent', onSpend);
        tc.eventBus.unsubscribe?.(PLAY_CLOCK_EVENT, onClock);
        tc.eventBus.unsubscribe?.('gameState:regionChanged', onRegion);
        tc.eventBus.unsubscribe?.('gameState:manaChanged', onMana);
        tc.eventBus.unsubscribe?.('loopState:botWalkFailed', onWalkFailed);
    }
}

/** The queue's end, asserted the same way on every row: on its own (`queueEnd`), the park released, no hard pause. */
function assertLoopEndedOnItsOwn(tc, label, r) {
    tc.assertEqual(`[${label}] no Bot walk failed (loopState:botWalkFailed)`, null, r.walkFailed);
    tc.assertEqual(`[${label}] the last regionMove resumed the park and the queue ended on its own (queueEnd)`,
        'true/queueEnd/false/null/false', `${r.queueCompleted}/${r.reason}/${r.processing}/${r.parkedAfter}/${r.pausedUntilReset}`);
}

/** Whether `sub` is an in-order subsequence of `seq` (by JSON). */
function isSubsequence(sub, seq) {
    let i = 0;
    for (const x of seq) if (i < sub.length && JSON.stringify(x) === JSON.stringify(sub[i])) i += 1;
    return i === sub.length;
}

/**
 * ⛓ MANA — every queued Seedling action is charged once at its own price, in order; ⛓ PLAY CLOCK — the rest of the
 * region's spend is the time drain, which the game's own reported seconds bound: at most the drain price of the
 * whole seconds of each visit, at least that less two (a report and a drain tick each land once a second, so up to
 * two of a visit's last seconds are unsettled when its region changes). Returns `{region: {drain, seconds}}`.
 */
function assertSeedlingCharged(tc, label, r, seedlingRegions) {
    const seedlingSpends = r.spends.filter((sp) => seedlingRegions.includes(sp.region));
    tc.assertEqual(`[${label}] mana: one charge per queued Seedling action at its own price, in order (the drain between)`,
        true, isSubsequence(r.priced, seedlingSpends));
    if (!isSubsequence(r.priced, seedlingSpends)) tc.log(`[${label}] priced ${JSON.stringify(r.priced)} vs spends ${JSON.stringify(seedlingSpends)}`, 'error');
    tc.assertEqual(`[${label}] the queue cost mana`, true, r.spent > 0);
    const out = {};
    for (const region of seedlingRegions) {
        const spent = seedlingSpends.filter((sp) => sp.region === region).reduce((a, sp) => a + sp.mana, 0);
        const priced = r.priced.filter((p) => p.region === region).reduce((a, p) => a + p.mana, 0);
        const drain = Math.round((spent - priced) * 1000) / 1000;
        // The visit's seconds: the last gameSeconds the game reported for the region (one visit per region here).
        const reports = r.log.filter((e) => e.kind === 'clock' && e.region === region);
        const seconds = reports.length ? reports[reports.length - 1].gameSeconds : 0;
        const whole = Math.floor(seconds);
        const hi = r.drainBefore[region] * whole;
        const lo = r.drainAfter[region] * Math.max(0, whole - 2);
        tc.assertEqual(`[${label}] ${region}: the drain (${drain}) is the game's ${seconds.toFixed(2)} s × its drain price `
            + `(${r.drainBefore[region]}→${r.drainAfter[region]}/s): within [${lo}, ${hi}] — never the ${r.wallSeconds.toFixed(1)} wall seconds`,
            true, drain >= lo - 1e-6 && drain <= hi + 1e-6);
        out[region] = { drain, seconds };
    }
    return out;
}

async function seedlingLoopBotCleanup() {
    try { loopStateSingleton.stopProcessing?.(); } catch { /* best effort */ }
    try { loopStateSingleton.clearQueue?.(); } catch { /* best effort */ }
    try { getGameStateSingleton().setLoopModeActive(false); } catch { /* best effort */ }
}

/**
 * Load `presetPath` on `runtime` ('js' | 'wasm') by the production path and wait for the panel on the atlas arm,
 * with the game running and gameState at `startRegion`. Returns `{panel, win, rt?}` (rt = the JS page's core), or null.
 * ⛔ The wasm game needs a WebGPU adapter: the `seedling-js` batch launches Chromium with one (`testBatches.js`).
 */
async function atlasPresetOn(tc, runtime, presetPath, startRegion) {
    if (runtime === 'js') {
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        await settingsManager.updateSetting(RUNTIME_KEY, 'js', { persist: false });
        const rulesJson = await (await fetch(presetPath)).json();
        const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
        tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: presetPath });
        await loaded;
        await tc.stateManager.pingWorker('after-rules-load', 5000);
        tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return null;
        const at = await tc.pollForCondition(() => readCurrentRegion() === startRegion && !!up.rt.run,
            `[js] the run is up and gameState is in ${startRegion}`, 15000, 200);
        tc.reportCondition(`[js] the game runs and gameState is in ${startRegion}`, !!at);
        return at ? up : null;
    }
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    // ⛓ §5.91 — the panel log's lines from here on are this row's: an earlier row's init flow writes none of them.
    const logLinesBefore = getActivePanelInstance()?.logElement?.childElementCount ?? 0;
    await settingsManager.updateSetting(RUNTIME_KEY, 'wasm', { persist: false });
    const rulesJson = await (await fetch(presetPath)).json();
    const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: presetPath });
    await loaded;
    await tc.stateManager.pingWorker('after-rules-load', 5000);
    tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
    const panel = await tc.pollForValue(() => {
        const p = getActivePanelInstance();
        return p?.transport === 'wasm' && p.adapter && p.adapter !== staleAdapter && p._initRuntime === 'wasm' ? p : null;
    }, '[wasm] the flash panel mounted the wasm runtime (a fresh adapter)', 30000, 250);
    tc.assertEqual('[wasm] the panel is on the wasm transport', 'wasm', panel?.transport ?? null);
    if (!panel) return null;
    // The wasm page waits for its ▶ Start (a person's click — the tutorials' `startSeedlingGame`).
    const startButton = await tc.pollForValue(() => {
        if (panel.statusElement?.textContent !== 'click ▶ Start in the game') return null;
        try { return frameOf(panel)?.document?.querySelector('#btn-start') ?? null; } catch { return null; }
    }, '[wasm] the panel asks for ▶ Start (the game runtime is fetched)', 120000, 250);
    if (!startButton) {
        const frames = [...document.querySelectorAll(`[id="${panel.flashObjectId}"]`)];
        const win = frameOf(panel);
        let page = '?';
        try { page = `${win?.location?.href ?? null} bridge ${!!win?.__swfBridge} ready ${win?.__runtimeReady ?? null}`; } catch { /* cross-origin */ }
        tc.log(`[wasm] DIAG status "${panel.statusElement?.textContent ?? '?'}"; ${frames.length} element(s) #${panel.flashObjectId}; `
            + `active panel ${getActivePanelInstance() === panel ? 'same' : 'CHANGED'}; init ${panel._initRuntime}/${panel.transport}; `
            + `adapter cancelled ${panel.adapter?._cancelled ?? null}; page ${page}; log: `
            + `${(panel.rootElement?.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').slice(-25).join(' | ')}`, 'error');
    }
    tc.reportCondition('[wasm] the game page is up (▶ Start)', !!startButton);
    if (!startButton) return null;
    startButton.click();
    const bound = await tc.pollForCondition(() => !!(panel._apLoadResult && panel.seedlingPlaybackSurface()?.atlas),
        '[wasm] the panel bound the ATLAS arm and holds the atlas name → cell map', 60000, 250);
    if (!bound) {
        const statusEl = document.querySelector('.flash-panel-status') ?? null;
        tc.log(`[wasm] DIAG status "${statusEl?.textContent ?? '?'}"; apLoad ${JSON.stringify(panel._apLoadResult ?? null)?.slice(0, 300)}; `
            + `refusal ${JSON.stringify(panel._apLoadRefusal ?? null)}; game ${!!panel.seedlingPlaybackSurface()?.wasm?.getGame?.()}; log: `
            + `${(document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').slice(-25).join(' | ')}`, 'error');
    }
    tc.reportCondition('[wasm] the atlas arm loaded on the wasm runtime', !!bound);
    if (!bound) return null;
    const running = await tc.pollForCondition(() => !!panel.seedlingPlaybackSurface()?.wasm?.getGame?.()
        && readCurrentRegion() === startRegion, `[wasm] the game is running and gameState is in ${startRegion}`, 60000, 250);
    if (!running) {
        tc.log(`[wasm] panel log: ${(document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').slice(-15).join(' | ')}`, 'error');
    }
    tc.reportCondition(`[wasm] the game runs and gameState is in ${startRegion}`, !!running);
    // ⛔ A TORN-DOWN FLOW STAYS QUIET: the Flash-runtime row's 15 s bridge wait outlived its cleanup and its timeout
    // wrote `bridge timeout` over this page's ▶ Start prompt (CI 4/8 at 429ba55d1e). A timeout line in this row's
    // log names the leak even on a run whose timing let the prompt survive.
    const strays = [...(panel.logElement?.children ?? [])].slice(logLinesBefore)
        .map((el) => el.textContent.trim()).filter((line) => /^bridge not ready/.test(line));
    tc.assertEqual('[wasm] no earlier init flow wrote into this row\'s panel (no "bridge not ready" line)', '[]', JSON.stringify(strays));
    return running ? { panel, win: frameOf(panel), rt: null } : null;
}

/** The JS page's own death / halt record (the wasm game has none to read). */
function assertNoDeathNoHalt(tc, runtime, rt) {
    if (!rt) return;
    tc.assertEqual(`[${runtime}] no death and no halt on the JS runtime`, '0/null', `${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
}

async function withRuntimeRestored(tc, body) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        await seedlingLoopBotCleanup();
        await body();
    } finally {
        await seedlingLoopBotCleanup();
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

/** A Bot block walks the starting house: the queued chest check, then its door into the maze child. */
const loopBotWalksAtlasRoom = (runtime) => async (tc) => withRuntimeRestored(tc, async () => {
    const up = await atlasPresetOn(tc, runtime, ATLAS_LOCATION_PATH, HOUSE_REGION);
    if (!up) return;
    const r = await seedlingLoopBotQueue(tc, runtime, [
        { check: CHEST_LOCATION, region: HOUSE_REGION },
        { exit: HOUSE_EXIT, from: HOUSE_REGION, to: MAZE_CHILD },
    ]);
    if (!r) return;
    await tc.stateManager.pingWorker('after-loop', 5000);
    tc.assertEqual(`[${runtime}] the Bot block walked to the chest: the game's own check reached the state manager`, true,
        snapshotFacts(tc).checked.has(CHEST_LOCATION));
    tc.assertEqual(`[${runtime}] the controller took the chest, then the house door`,
        JSON.stringify([`location:${CHEST_LOCATION}`, `exit:${HOUSE_EXIT}`]), JSON.stringify(r.goals));
    tc.assertEqual(`[${runtime}] the game took the house door itself (a pendingExit from level 86)`, true,
        reportedExits(up.win).some((e) => e.fromLevel === 86 && e.type === 'teleporter'));
    tc.assertEqual(`[${runtime}] gameState moved into the maze child`, MAZE_CHILD, readCurrentRegion());
    assertLoopEndedOnItsOwn(tc, runtime, r);
    assertSeedlingCharged(tc, runtime, r, [HOUSE_REGION]);
    assertNoDeathNoHalt(tc, runtime, up.rt);
});

export const seedlingJsRuntimeLoopBotBlockWalksAtlasRoom = loopBotWalksAtlasRoom('js');
export const seedlingWasmRuntimeLoopBotBlockWalksAtlasRoom = loopBotWalksAtlasRoom('wasm');

const OVERWORLD = 'overworld_start__r8c0';
const OWLS_NEST = 'owls_nest_entrance';
const DUNGEON = 'dungeon1_room1__r0c4';
const DUNGEON_FAR = 'dungeon1_room1__r8c6';
const LINK_EXIT = `${DUNGEON} -> ${DUNGEON_FAR}`;

/** Bot blocks route the owl's-nest stairs, the descent, then the sword-gated LOGICAL link (credited, next turn). */
const loopBotCrossesAtlasRooms = (runtime) => async (tc) => {
    let granted = false;
    try {
        return await withRuntimeRestored(tc, async () => {
            const up = await atlasPresetOn(tc, runtime, ATLAS_PATH, OVERWORLD);
            if (!up) return;
            // The link is sword-gated (`Or(Progressive Sword, Ghost Spear)`): the sword goes through the AP ITEM path
            // (AP → game, as the S5 rows grant it), removed after. ⛔ No game flag is set from the AP side.
            await tc.stateManager.addItemToInventory('Progressive Sword', 1);
            granted = true;
            await tc.stateManager.pingWorker('after-item-grant', 5000);
            const held = await tc.pollForCondition(() => snapshotFacts(tc).held('Progressive Sword') > 0,
                `[${runtime}] the sword is held (the link's gate is open)`, 10000, 100);
            tc.reportCondition(`[${runtime}] the sword is held (the link's gate is open)`, !!held);
            if (!held) return;
            const r = await seedlingLoopBotQueue(tc, runtime, [
                { exit: `${OVERWORLD} -> ${OWLS_NEST}`, from: OVERWORLD, to: OWLS_NEST },
                { exit: `${OWLS_NEST} -> ${DUNGEON}`, from: OWLS_NEST, to: DUNGEON },
                { exit: LINK_EXIT, from: DUNGEON, to: DUNGEON_FAR },
            ]);
            if (!r) return;
            tc.assertEqual(`[${runtime}] gameState walked the stairs, the descent, then across the logical link`,
                JSON.stringify([OWLS_NEST, DUNGEON, DUNGEON_FAR]), JSON.stringify(r.regions.filter(Boolean)));
            tc.assertEqual(`[${runtime}] the controller walked two doors, then CREDITED the link (no walk)`,
                JSON.stringify([`exit:${OVERWORLD} -> ${OWLS_NEST}`, `exit:${OWLS_NEST} -> ${DUNGEON}`, `link:${LINK_EXIT}`]),
                JSON.stringify(r.goals));
            tc.assertEqual(`[${runtime}] the game took the stairs and the descent, and no door for the link`,
                JSON.stringify(['0:stairsdown', '2:teleporter']), JSON.stringify(reportedExits(up.win).map((e) => `${e.fromLevel}:${e.type}`)));
            assertLoopEndedOnItsOwn(tc, runtime, r);
            assertSeedlingCharged(tc, runtime, r, [OVERWORLD, OWLS_NEST, DUNGEON]);
            assertNoDeathNoHalt(tc, runtime, up.rt);
        });
    } finally {
        if (granted) { try { await tc.stateManager.removeItemFromInventory('Progressive Sword', 1); } catch { /* best effort */ } }
    }
};

export const seedlingJsRuntimeLoopBotBlocksCrossAtlasRooms = loopBotCrossesAtlasRooms('js');
export const seedlingWasmRuntimeLoopBotBlocksCrossAtlasRooms = loopBotCrossesAtlasRooms('wasm');

// ── ⛓ GENERATED ROOMS IN LOOP MODE: a Bot block plays a `flash_seedling_gen` room ───────────────────────────────
//
// flash_seedling_gen declares flash_seedling's loopSupport (executeVia solver, locationCheck, playClock). On
// seedling_generated_room the start room `region_0_0` holds the one apitem and two generated teleporter doors; the
// queue is that apitem's check, then the door into the other generated room `region_0_1`. Under a Bot block the
// generated rooms' controller walks both (JS: the page's solver; wasm: the WG engine, its tapes the solver's), the
// game's own check completes the first, the crossing's user:regionMove the second, and Loops charges the start room
// per GAME second played (`loopState._gameClockCharged` — the time drain alone, never a queued action's price).

const GEN_START = 'region_0_0';
const GEN_NEXT = 'region_0_1';
const GEN_APITEM = 'region_0_0__key_blue_pickup';
const GEN_EXIT = 'exit_0';

/**
 * Load seedling_generated_room on `runtime` by the production path and wait for the generated arm's AP load, the
 * game running and gameState in its start room. Returns `{panel, win, rt?}` (rt = the JS page's core), or null.
 */
async function generatedPresetOn(tc, runtime) {
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    await settingsManager.updateSetting(RUNTIME_KEY, runtime, { persist: false });
    const rulesJson = await (await fetch(PRESET_PATH)).json();
    const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: PRESET_PATH });
    await loaded;
    await tc.stateManager.pingWorker('after-rules-load', 5000);
    tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
    const panel = await tc.pollForValue(() => {
        const p = getActivePanelInstance();
        return p?.transport === runtime && p.adapter && p.adapter !== staleAdapter && p._initRuntime === runtime ? p : null;
    }, `[${runtime}] the flash panel mounted the ${runtime} runtime (a fresh adapter)`, 30000, 250);
    tc.assertEqual(`[${runtime}] the panel is on the ${runtime} transport`, runtime, panel?.transport ?? null);
    if (!panel) return null;
    if (runtime === 'wasm') {
        const startButton = await tc.pollForValue(() => {
            if (panel.statusElement?.textContent !== 'click ▶ Start in the game') return null;
            try { return frameOf(panel)?.document?.querySelector('#btn-start') ?? null; } catch { return null; }
        }, '[wasm] the panel asks for ▶ Start (the game runtime is fetched)', 120000, 250);
        tc.reportCondition('[wasm] the game page is up (▶ Start)', !!startButton);
        if (!startButton) return null;
        startButton.click();
    }
    const bound = await tc.pollForCondition(() => !!(panel._apLoadResult && panel.seedlingPlaybackSurface()?.report),
        `[${runtime}] the panel bound the GENERATED arm and holds the assembly report`, 60000, 250);
    if (!bound) {
        tc.log(`[${runtime}] DIAG apLoad ${JSON.stringify(panel._apLoadResult ?? null)?.slice(0, 300)}; refusal `
            + `${JSON.stringify(panel._apLoadRefusal ?? null)}; log: `
            + `${(document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').slice(-20).join(' | ')}`, 'error');
    }
    tc.reportCondition(`[${runtime}] the generated arm loaded`, !!bound);
    if (!bound) return null;
    const win = frameOf(panel);
    const running = await tc.pollForCondition(() => readCurrentRegion() === GEN_START && (runtime === 'js'
        ? !!frameOf(panel)?.__seedlingJsRuntime?.run : !!panel.seedlingPlaybackSurface()?.wasm?.getGame?.()),
    `[${runtime}] the game runs and gameState is in ${GEN_START}`, 60000, 250);
    tc.reportCondition(`[${runtime}] the game runs and gameState is in ${GEN_START}`, !!running);
    if (!running) return null;
    return { panel, win, rt: runtime === 'js' ? win.__seedlingJsRuntime : null };
}

/** A Bot block walks the generated start room: the queued apitem check, then its door into the next generated room. */
const loopBotWalksGeneratedRoom = (runtime) => async (tc) => withRuntimeRestored(tc, async () => {
    const up = await generatedPresetOn(tc, runtime);
    if (!up) return;
    tc.assertEqual(`[${runtime}] ${GEN_START} is a flash_seedling_gen region`, true,
        loopStateSingleton._lookupSubstrateId?.(GEN_START) === 'flash_seedling_gen');
    tc.assertEqual(`[${runtime}] the play clock reporter is up (flashPanel)`, true, !!getSeedlingPlayClock());
    const r = await seedlingLoopBotQueue(tc, runtime, [
        { check: GEN_APITEM, region: GEN_START },
        { exit: GEN_EXIT, from: GEN_START, to: GEN_NEXT },
    ], { substrateId: 'flash_seedling_gen' });
    if (!r) return;
    await tc.stateManager.pingWorker('after-loop', 5000);
    tc.assertEqual(`[${runtime}] the Bot block walked to the apitem: the game's own check reached the state manager`, true,
        snapshotFacts(tc).checked.has(GEN_APITEM));
    tc.assertEqual(`[${runtime}] the generated rooms' controller took the apitem, then the door`,
        JSON.stringify([`location:${GEN_APITEM}`, `exit:${GEN_EXIT}`]), JSON.stringify(r.goals));
    const crossed = runtime === 'js'
        ? up.rt.events.some((e) => e.type === 'transition' && e.teleporter)
        : reportedExits(up.win).some((e) => e.type === 'teleporter');
    tc.assertEqual(`[${runtime}] the game took a generated teleporter door itself`, true, crossed);
    tc.assertEqual(`[${runtime}] gameState moved into the next generated room`, GEN_NEXT, readCurrentRegion());
    assertLoopEndedOnItsOwn(tc, runtime, r);
    const charged = assertSeedlingCharged(tc, runtime, r, [GEN_START]);
    // ⛓ PLAY CLOCK — the TIME Loops charged the start room (`_gameClockCharged`, the drain alone), read off the log.
    const timeCharged = Math.max(0, ...r.log.filter((e) => e.charged?.region === GEN_START).map((e) => e.charged.seconds));
    tc.log(`[${runtime}] ${GEN_START}: ${JSON.stringify(charged[GEN_START])}; game seconds charged as time ${timeCharged}`);
    tc.assertEqual(`[${runtime}] Loops charged the start room's GAME seconds as time (${timeCharged} of `
        + `${charged[GEN_START].seconds.toFixed(2)}), and mana fell by that drain (${charged[GEN_START].drain})`, true,
    timeCharged >= 1 && timeCharged <= Math.floor(charged[GEN_START].seconds)
        && charged[GEN_START].drain > 0);
    assertNoDeathNoHalt(tc, runtime, up.rt);
});

export const seedlingJsRuntimeLoopBotBlockWalksGeneratedRoom = loopBotWalksGeneratedRoom('js');
export const seedlingWasmRuntimeLoopBotBlockWalksGeneratedRoom = loopBotWalksGeneratedRoom('wasm');

const LOOP_GEN_DESCRIPTION = (runtime) => `With flashPanel.runtime = ${runtime} on seedling_generated_room, loop mode on `
    + 'and the start room\'s block set to Bot: loops hands the queued apitem check and the generated teleporter door to '
    + 'the flash_seedling_gen controller (executeVia solver); the game\'s own check completes the first, the crossing\'s '
    + 'user:regionMove the second, and the queue ends on its own. Mana: one charge per action at its own price, plus '
    + 'the play clock\'s drain per GAME second (loopState._gameClockCharged).';

for (const [id, name, fn] of [
    ['seedling-js-runtime-loop-bot-block-walks-generated-room',
        'Seedling JS runtime: a Loops Bot block walks a generated room (its apitem, then its door; play time drains)',
        seedlingJsRuntimeLoopBotBlockWalksGeneratedRoom],
    ['seedling-wasm-runtime-loop-bot-block-walks-generated-room',
        'Seedling (wasm runtime): a Loops Bot block walks a generated room (its apitem, then its door; play time drains)',
        seedlingWasmRuntimeLoopBotBlockWalksGeneratedRoom],
]) {
    registerTest({
        id, name, description: LOOP_GEN_DESCRIPTION(id.startsWith('seedling-js') ? 'js' : 'wasm'),
        testFunction: restoresSavedQueues(fn),
        category: seedlingRuntimeCategory(id),
        enabled: false, // off by default — runs only in the test-substrates mode
    });
}

/**
 * ⛓ The Flash (Ruffle) runtime has no feet: a Bot block's walkTo there is refused BY NAME, and loops turns the
 * refusal into its named stop (`loopState:botWalkFailed`, the controller's `lastRefusal` as its reason) instead of
 * a silent park. The Seedling SWF is not committed (`flashPanel/swf/README.md`), so the preset is loaded with its
 * `flash_panel.swf` naming the one that README describes: the panel takes the REAL Flash path (Ruffle fetched from
 * its CDN, the bridge adapter built) and never gets a game — which is all the refusal needs. Before the panel's
 * Flash path said `transport: 'flash'`, the surface read 'wasm' and the goal was HELD (no map, no engine) for 60 s.
 */
/**
 * ⛓ RUFFLE ON CANVAS, SETTLED IN ITS OWN ROW. In a seedling-js batch, the GPU context Ruffle's default `wgpu-webgl`
 * renderer creates (on top of the batch's WebGPU pages) left the top page with NO animation frames for 15–18 s, so
 * the NEXT row's rAF-driven Loops queue never parked (FRAME-STARVED; batch 7/10 at efed9765a9, 20/20 with this row
 * left out). Settling Ruffle inside this row alone did not help (10/20); the canvas renderer did (20/20). The row
 * needs the Flash PATH, not a renderer — no SWF ever plays. It also waits for Ruffle's SWF fetch (a 404) before its
 * restore tears the player down, so Ruffle's lifecycle and any stall it causes land HERE, asserted below.
 */
function watchResourceFetch(url) {
    let seen = false;
    let observer = null;
    try {
        observer = new PerformanceObserver((list) => {
            if (list.getEntries().some((e) => e.name === url)) seen = true;
        });
        observer.observe({ type: 'resource', buffered: true });
    } catch { /* no PerformanceObserver: the wait below just runs out */ }
    return { seen: () => seen, stop: () => observer?.disconnect() };
}

/** Resolves true once `count` animation frames have arrived, false after `timeoutMs` without them. */
function animationFramesFlow(count, timeoutMs) {
    return new Promise((resolve) => {
        let n = 0;
        let id = null;
        const timer = setTimeout(() => { if (id !== null) cancelAnimationFrame(id); resolve(false); }, timeoutMs);
        const frame = () => {
            if (++n >= count) { clearTimeout(timer); resolve(true); return; }
            id = requestAnimationFrame(frame);
        };
        id = requestAnimationFrame(frame);
    });
}

export async function seedlingFlashRuntimeLoopBotBlockNamesItsStop(tc) {
    const swfUrl = new URL(`./modules/flashPanel/swf/seedling_injected.swf`, location.href).href;
    const swfFetch = watchResourceFetch(swfUrl);
    const ruffle = (window.RufflePlayer ??= {});
    const hadConfig = Object.hasOwn(ruffle, 'config');
    const previousConfig = ruffle.config;
    ruffle.config = { ...(previousConfig ?? {}), preferredRenderer: 'canvas' };
    try {
        await withRuntimeRestored(tc, () => seedlingFlashRuntimeRowBody(tc, swfFetch));
    } finally {
        swfFetch.stop();
        if (hadConfig) ruffle.config = previousConfig;
        else delete ruffle.config;
    }
    tc.reportCondition('[flash] the page gets animation frames again after the Ruffle teardown',
        await animationFramesFlow(5, 30000));
    return tc.getOverallResult();
}

async function seedlingFlashRuntimeRowBody(tc, swfFetch) {
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    await settingsManager.updateSetting(RUNTIME_KEY, 'flash', { persist: false });
    const rulesJson = await (await fetch(ATLAS_LOCATION_PATH)).json();
    rulesJson.flash_panel['1'] = { ...rulesJson.flash_panel['1'], swf: 'seedling_injected.swf' };
    const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: `${ATLAS_LOCATION_PATH} (+swf)` });
    await loaded;
    await tc.stateManager.pingWorker('after-rules-load', 5000);
    tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
    const panel = await tc.pollForValue(() => {
        const p = getActivePanelInstance();
        return p?.adapter && p.adapter !== staleAdapter && p._initRuntime === 'flash' ? p : null;
    }, '[flash] the flash panel took the Flash path (a fresh bridge adapter)', 30000, 250);
    tc.assertEqual('[flash] the playback surface names the Flash runtime', 'flash', panel?.seedlingPlaybackSurface?.()?.transport ?? null);
    if (!panel) return;
    const at = await tc.pollForCondition(() => readCurrentRegion() === HOUSE_REGION, `[flash] gameState is in ${HOUSE_REGION}`, 15000, 200);
    tc.reportCondition(`[flash] gameState is in ${HOUSE_REGION} (the start hop)`, !!at);
    if (!at) return;

    const gs = getGameStateSingleton();
    gs.setLoopModeActive(true);
    gs.updatePath(MAZE_CHILD, HOUSE_EXIT, HOUSE_REGION);
    const block = loopBlockFor(HOUSE_REGION);
    tc.assertEqual('[flash] resolved the house\'s queue block', true, !!block);
    if (!block) return;
    loopStateSingleton.setBlockMode(HOUSE_REGION, block.instance, 'bot');
    gs.refillMana();
    const clockReads = getSeedlingPlayClock()?.stats.reads ?? null;
    const stopped = tc.waitForEvent('loopState:botWalkFailed', 15000).catch(() => null);
    const t0 = performance.now();
    loopStateSingleton.startProcessing();
    const stop = await stopped;
    const ms = performance.now() - t0;
    const controller = substrateRegistry.get('flash_seedling')?.getPlaybackController?.() ?? null;
    tc.log(`[flash] stop after ${ms.toFixed(0)} ms: ${JSON.stringify({ region: stop?.region ?? null, reason: stop?.reason ?? null })}`);
    tc.assertEqual('[flash] loops named its stop (loopState:botWalkFailed) for the house', HOUSE_REGION, stop?.region ?? null);
    tc.assertEqual('[flash] the stop carries the controller\'s lastRefusal', controller?.lastRefusal ?? '(none)', stop?.reason ?? null);
    tc.assertEqual('[flash] …which names the Flash runtime and the two runtimes that walk', true,
        /^flash_seedling regions are walked only on the Seedling JS or wasm runtime — the Flash Panel is running the flash runtime/
            .test(stop?.reason ?? ''));
    tc.assertEqual('[flash] the refusal was synchronous (no held goal, no 60 s give-up)', true, ms < 5000);
    tc.assertEqual('[flash] the park was dropped and the queue paused (not parked on the house)', 'null/false',
        `${loopStateSingleton.botSolverRegion?.() ?? null}/${loopStateSingleton.isProcessing}`);
    // ⛓ PLAY CLOCK — the Flash (Ruffle) runtime's game is never read for a clock (its SWF calls no setPlayClock).
    tc.assertEqual('[flash] the play clock read nothing on the Flash runtime (loop mode on)', clockReads,
        getSeedlingPlayClock()?.stats.reads ?? null);
    // ⛓ RUFFLE ON CANVAS, SETTLED IN ITS OWN ROW (above): its SWF fetch resolves before the restore.
    const settled = await tc.pollForCondition(() => swfFetch.seen(),
        '[flash] Ruffle\'s SWF fetch resolved before the runtime restore', 30000, 100);
    if (!settled) tc.log('[flash] Ruffle never fetched the SWF (its CDN script did not load?) — restoring anyway');
    // ⛓ RUFFLE PINNED (ruffleCdn.js): the loaded Ruffle is the measured version. Its `version` is
    // `<semver>+<build date>`. A Ruffle that never loaded stays a log above, not a red here.
    const ruffleVersion = window.RufflePlayer?.newest?.()?.version ?? null;
    tc.log(`[flash] Ruffle version: ${ruffleVersion}`);
    if (ruffleVersion !== null) {
        tc.assertEqual('[flash] the loaded Ruffle is the pinned version', RUFFLE_VERSION, ruffleVersion.split('+')[0]);
    }
}

registerTest({
    id: 'seedling-flash-runtime-loop-bot-block-names-its-stop',
    name: 'Seedling (Flash runtime): a Loops Bot block\'s walk is refused by name — a named stop, not a silent park',
    description: 'With flashPanel.runtime = flash (the Ruffle path; the SWF is not committed, so no game boots): loop '
        + 'mode on, the house block Bot. The flash_seedling controller refuses the walk synchronously, naming the Flash '
        + 'runtime, and loops publishes loopState:botWalkFailed carrying that lastRefusal; the park is dropped.',
    testFunction: restoresSavedQueues(seedlingFlashRuntimeLoopBotBlockNamesItsStop),
    category: 'Seedling wasm runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── ⛓ PLAY CLOCK: the game's own seconds drain mana (⚖ "Drain play time too") ─────────────────────────────────
//
// flash_seedling declares `loopSupport.playClock`; `seedlingPlayClock.js` reports `Game.time` (wasm) / the model's
// steps (JS) as `substrate:playClock`, and Loops charges the parked region per GAME second. Two rows per runtime, each
// on its own load:
//   DRAIN + STOP (a Bot block) — every solve is HELD `PLAY_CLOCK_HOLD_MS` (`holdSolveWorker`, the row's own seam): the
//      JS page holds the room while a solve is in flight, the wasm engine freezes it (`botHold`). While the clock is
//      stopped nothing is charged; while it runs, the house is charged its drain price per game second reported.
//   MANA OUT (a MANUAL block, nobody at the keys) — the pool is cut to half a second's drain once the park is up; the
//      idle game's clock runs, its first whole second runs the pool out, and the loop ends (`loopState:loopReset`;
//      auto-restart off: the queue stops). ⚠ Not a Bot block: measured, the JS bot reaches the chest (price 10) in
//      under one game second, so a Bot walk's own price, not the drain, would empty a pool that small.

const PLAY_CLOCK_HOLD_MS = 3000;

/** Hold every solve of this row's runtime `holdMs` (a real worker, its answer delayed). Returns `{record, restore}`. */
function holdSolvesOn(runtime, up, holdMs) {
    if (runtime === 'js') return holdSolveWorker(up.win, up.rt.playback.solveService, { answer: true, holdMs });
    // The wasm engine's service builds its worker off the HOST's `Worker` (lazily); one built earlier is dropped.
    const engineService = () => substrateRegistry.get('flash_seedling')?.getPlaybackController?.()?.wasmSolveService?.() ?? null;
    const hold = holdSolveWorker(window, engineService() ?? { stats: { live: false }, dispose() {} }, { answer: true, holdMs });
    return {
        record: hold.record,
        restore() {
            hold.restore();
            // A service built DURING the hold holds a wrapped worker: drop it, so later rows solve unheld.
            const svc = engineService();
            if (svc?.stats?.live) svc.dispose();
        },
    };
}

/**
 * The clock's STOPPED windows for `region`: a `running: false` report up to the next clock report (or the end of the
 * log). `timeCharged` = the game seconds Loops charged AS TIME inside the window (`loopState._gameClockCharged`, read
 * after each event's dispatch — the stop's own settle is already in the stop entry's reading). A queued action that
 * completes in the window (the game resumed and crossed before the next read) moves mana, never that counter, so
 * `spent` is reported for the record and only `timeCharged` is the check.
 */
function stoppedWindows(log, region) {
    const out = [];
    log.forEach((e, i) => {
        if (e.kind !== 'clock' || e.region !== region || e.running !== false) return;
        const j = log.findIndex((f, k) => k > i && f.kind === 'clock');
        const end = j < 0 ? null : log[j];
        const inside = log.slice(i + 1, j < 0 ? log.length : j);
        const base = e.charged?.region === region ? e.charged.seconds : 0;
        const charged = inside.filter((f) => f.charged?.region === region).map((f) => f.charged.seconds - base);
        out.push({ ms: end ? Math.round(end.at - e.at) : null, seconds: e.gameSeconds, resumed: end?.region === region && end.running === true,
            timeCharged: Math.max(0, ...charged),
            spent: inside.filter((f) => f.kind === 'spend' && f.region === region).reduce((a, f) => a + f.mana, 0) });
    });
    return out;
}

const loopPlayClockDrains = (runtime) => async (tc) => withRuntimeRestored(tc, async () => {
    const up = await atlasPresetOn(tc, runtime, ATLAS_LOCATION_PATH, HOUSE_REGION);
    if (!up) return;
    tc.assertEqual(`[${runtime}] the play clock reporter is up (flashPanel)`, true, !!getSeedlingPlayClock());
    const hold = holdSolvesOn(runtime, up, PLAY_CLOCK_HOLD_MS);
    let r = null;
    try {
        r = await seedlingLoopBotQueue(tc, runtime, [
            { check: CHEST_LOCATION, region: HOUSE_REGION },
            { exit: HOUSE_EXIT, from: HOUSE_REGION, to: MAZE_CHILD },
        ]);
    } finally {
        hold.restore();
    }
    if (!r) return;
    tc.log(`[${runtime}] hold ${JSON.stringify(hold.record)}`);
    tc.assertEqual(`[${runtime}] the row's hold took the solves (a real worker, answers delayed ${PLAY_CLOCK_HOLD_MS} ms)`,
        true, hold.record.wrapped > 0 && hold.record.started > 0 && hold.record.delivered > 0);
    assertLoopEndedOnItsOwn(tc, runtime, r);
    const charged = assertSeedlingCharged(tc, runtime, r, [HOUSE_REGION]);
    tc.assertEqual(`[${runtime}] mana FELL with the game's seconds: ${charged[HOUSE_REGION].drain} for `
        + `${charged[HOUSE_REGION].seconds.toFixed(2)} game seconds`, true, charged[HOUSE_REGION].drain > 0 && charged[HOUSE_REGION].seconds >= 1);
    const house = r.log.filter((e) => e.kind === 'clock' && e.region === HOUSE_REGION).map((e) => e.gameSeconds);
    tc.assertEqual(`[${runtime}] the house's gameSeconds never went back`, true, house.every((g, i) => i === 0 || g >= house[i - 1]));
    const windows = stoppedWindows(r.log, HOUSE_REGION);
    tc.log(`[${runtime}] stopped windows: ${JSON.stringify(windows)}`);
    const held = windows.filter((w) => w.ms !== null && w.ms >= PLAY_CLOCK_HOLD_MS / 2);
    tc.assertEqual(`[${runtime}] the clock was reported STOPPED for a held solve (a window ≥ ${PLAY_CLOCK_HOLD_MS / 2} ms)`, true, held.length > 0);
    tc.assertEqual(`[${runtime}] …and resumed after it`, true, held.some((w) => w.resumed));
    tc.assertEqual(`[${runtime}] no TIME was charged while the clock was stopped (Loops' charged game seconds never moved in a window)`,
        '0', String(windows.reduce((a, w) => a + w.timeCharged, 0)));
    assertNoDeathNoHalt(tc, runtime, up.rt);
});

const loopPlayClockManaOut = (runtime) => async (tc) => {
    const restart = loopStateSingleton.autoRestartQueue;
    const log = [];
    const onSpend = (e) => log.push({ kind: 'spend', at: performance.now(), region: e?.region ?? null, mana: e?.mana ?? null });
    const onClock = (e) => log.push({ kind: 'clock', at: performance.now(), region: e?.region ?? null,
        running: e?.running ?? null, gameSeconds: e?.stats?.gameSeconds ?? null });
    try {
        return await withRuntimeRestored(tc, async () => {
            const up = await atlasPresetOn(tc, runtime, ATLAS_LOCATION_PATH, HOUSE_REGION);
            if (!up) return;
            const gs = getGameStateSingleton();
            loopStateSingleton.autoRestartQueue = false;
            gs.setLoopModeActive(true);
            const on = await tc.pollForCondition(() => gs.isLoopModeActive === true, `[${runtime}] loop mode on`, 5000, 100);
            tc.reportCondition(`[${runtime}] loop mode on`, !!on);
            if (!on) return;
            gs.addLocationCheck(CHEST_LOCATION, HOUSE_REGION);
            const block = loopBlockFor(HOUSE_REGION);
            tc.assertEqual(`[${runtime}] resolved the house's queue block`, true, !!block);
            if (!block) return;
            loopStateSingleton.setBlockMode(HOUSE_REGION, block.instance, 'manual');
            tc.eventBus.subscribe('loops:manaSpent', onSpend);
            tc.eventBus.subscribe(PLAY_CLOCK_EVENT, onClock);
            gs.refillMana();
            loopStateSingleton.startProcessing();
            const parked = await tc.pollForCondition(() => loopStateSingleton.livePlayRegion?.() === HOUSE_REGION,
                `[${runtime}] the house's MANUAL block parked (live play)`, 15000, 20);
            tc.reportCondition(`[${runtime}] the house's manual block parked (live play, nobody at the keys)`, !!parked);
            if (!parked) return;
            const price = loopStateSingleton._calculateActionCost({ type: 'timeDrain', sourceRegion: HOUSE_REGION });
            const cut = { price, to: price / 2, at: performance.now() };
            const reset = tc.waitForEvent('loopState:loopReset', 30000).catch(() => null);
            gs.deductMana(gs.getCurrentMana() - cut.to);
            const ended = await reset;
            await tc.stateManager.pingWorker('after-mana-out', 5000);
            const after = log.filter((e) => e.at >= cut.at);
            const spends = after.filter((e) => e.kind === 'spend');
            const ran = after.filter((e) => e.kind === 'clock' && e.region === HOUSE_REGION && e.running === true);
            tc.log(`[${runtime}] cut ${JSON.stringify(cut)}; after it: ${JSON.stringify(after)}`);
            tc.assertEqual(`[${runtime}] the drain price is positive (${price})`, true, price > 0);
            tc.assertEqual(`[${runtime}] running mana out ENDED the loop (loopState:loopReset)`, true, !!ended);
            tc.assertEqual(`[${runtime}] …the pool was run out by the house's DRAIN alone (whole drain-priced seconds, nothing queued completed)`,
                true, spends.length > 0 && spends.every((e) => e.region === HOUSE_REGION
                    && Math.abs(e.mana / price - Math.round(e.mana / price)) < 1e-6)
                    && spends.reduce((a, e) => a + e.mana, 0) >= cut.to - 1e-6);
            tc.assertEqual(`[${runtime}] …while the game's clock RAN (a running report for the house)`, true, ran.length > 0);
            tc.assertEqual(`[${runtime}] the chest was not checked (nobody walked to it)`, false, snapshotFacts(tc).checked.has(CHEST_LOCATION));
            tc.assertEqual(`[${runtime}] the reset refilled the pool and stopped the queue (no auto-restart)`,
                `${gs.maxMana}/false`, `${gs.getCurrentMana()}/${loopStateSingleton.isProcessing}`);
            assertNoDeathNoHalt(tc, runtime, up.rt);
        });
    } finally {
        tc.eventBus.unsubscribe?.('loops:manaSpent', onSpend);
        tc.eventBus.unsubscribe?.(PLAY_CLOCK_EVENT, onClock);
        loopStateSingleton.autoRestartQueue = restart;
    }
};

export const seedlingJsRuntimeLoopPlayClockDrains = loopPlayClockDrains('js');
export const seedlingWasmRuntimeLoopPlayClockDrains = loopPlayClockDrains('wasm');
export const seedlingJsRuntimeLoopPlayClockManaOut = loopPlayClockManaOut('js');
export const seedlingWasmRuntimeLoopPlayClockManaOut = loopPlayClockManaOut('wasm');

const PLAY_CLOCK_DESCRIPTION = (runtime) => `With flashPanel.runtime = ${runtime} on seedling_atlas_location, loop mode on and `
    + 'the house\'s block Bot (⚖ "Drain play time too"), every solve held 3 s by the row: the reported clock stops for '
    + 'the hold and nothing is charged; the house is charged its drain price per GAME second reported (substrate:playClock), '
    + 'each queued action its own price; the queue ends on its own.';
const MANA_OUT_DESCRIPTION = (runtime) => `With flashPanel.runtime = ${runtime} on seedling_atlas_location, loop mode on and `
    + 'the house\'s block MANUAL with nobody at the keys: the pool cut to half a second\'s drain once parked — the idle '
    + 'game\'s clock runs, its first whole second runs the pool out by the drain alone, and the loop ends '
    + '(loopState:loopReset, auto-restart off).';

for (const [id, name, fn, description] of [
    ['seedling-js-runtime-loop-play-clock-drains-mana',
        'Seedling JS runtime: a Loops Bot block is charged per GAME second (a stopped clock is free)',
        seedlingJsRuntimeLoopPlayClockDrains, PLAY_CLOCK_DESCRIPTION('js')],
    ['seedling-wasm-runtime-loop-play-clock-drains-mana',
        'Seedling (wasm runtime): a Loops Bot block is charged per GAME second (a stopped clock is free)',
        seedlingWasmRuntimeLoopPlayClockDrains, PLAY_CLOCK_DESCRIPTION('wasm')],
    ['seedling-js-runtime-loop-play-clock-mana-out',
        'Seedling JS runtime: the game\'s clock runs the mana out and the loop ends',
        seedlingJsRuntimeLoopPlayClockManaOut, MANA_OUT_DESCRIPTION('js')],
    ['seedling-wasm-runtime-loop-play-clock-mana-out',
        'Seedling (wasm runtime): the game\'s clock runs the mana out and the loop ends',
        seedlingWasmRuntimeLoopPlayClockManaOut, MANA_OUT_DESCRIPTION('wasm')],
]) {
    registerTest({
        id, name, description,
        testFunction: restoresSavedQueues(fn),
        category: seedlingRuntimeCategory(id),
        enabled: false, // off by default — runs only in the test-substrates mode
    });
}

const LOOP_ROOM_DESCRIPTION = (runtime) => `With flashPanel.runtime = ${runtime} on seedling_atlas_location, loop mode on `
    + 'and the house\'s block set to Bot: loops hands the queued chest check and the departure to the flash_seedling '
    + 'controller (executeVia solver); the game\'s own check completes the first, the door crossing\'s user:regionMove '
    + 'the second, and the queue ends on its own. Mana: one charge per action at its own price, plus the play clock\'s drain per GAME second.';
const LOOP_CROSS_DESCRIPTION = (runtime) => `With flashPanel.runtime = ${runtime} on seedling_atlas, loop mode on and every `
    + 'Seedling block set to Bot (the sword granted through the AP item path, removed after): the owl\'s-nest stairs, the '
    + 'descent into the dungeon, then the sword-gated LOGICAL link to its far sub-region (credited by the region binding, '
    + 'its user:regionMove on the next turn) — each resuming its park; the queue ends on its own; one charge per action, plus the play clock\'s drain.';

for (const [id, name, fn, description] of [
    ['seedling-js-runtime-loop-bot-block-walks-atlas-room',
        'Seedling JS runtime: a Loops Bot block walks a real atlas room (its check, then its door)',
        seedlingJsRuntimeLoopBotBlockWalksAtlasRoom, LOOP_ROOM_DESCRIPTION('js')],
    ['seedling-wasm-runtime-loop-bot-block-walks-atlas-room',
        'Seedling (wasm runtime): a Loops Bot block walks a real atlas room (its check, then its door)',
        seedlingWasmRuntimeLoopBotBlockWalksAtlasRoom, LOOP_ROOM_DESCRIPTION('wasm')],
    ['seedling-js-runtime-loop-bot-blocks-cross-atlas-rooms',
        'Seedling JS runtime: Loops Bot blocks cross real atlas rooms and a logical link',
        seedlingJsRuntimeLoopBotBlocksCrossAtlasRooms, LOOP_CROSS_DESCRIPTION('js')],
    ['seedling-wasm-runtime-loop-bot-blocks-cross-atlas-rooms',
        'Seedling (wasm runtime): Loops Bot blocks cross real atlas rooms and a logical link',
        seedlingWasmRuntimeLoopBotBlocksCrossAtlasRooms, LOOP_CROSS_DESCRIPTION('wasm')],
]) {
    registerTest({
        id, name, description,
        testFunction: restoresSavedQueues(fn),
        category: seedlingRuntimeCategory(id),
        enabled: false, // off by default — runs only in the test-substrates mode
    });
}

/**
 * ⛓ GRAPHICS G6 — the effects switch in a real browser: `jsRuntime.html?graphics=seedling` (room mode; lights and
 * effects ON by default under a stack) mounted STANDALONE in the row's own iframe and driven through its own
 * `__swfBridge`: to `Game(61, 104, 144)` (Dungeon 6's rain), where `set({ effects: 'off' })` LIVE leaves no drop
 * alive and no drop op drawn; then to `Game(76, 152, 92)` (the lava room), where the lava glow's `solidBmp` edges are
 * drawn with the effects ON and gone with them OFF (fewer night ops, the room still darkened); and back ON. No panel,
 * preset or AP state is touched; the iframe is removed however the row ends.
 */
export async function seedlingJsRuntimeGraphicsEffectsSwitch(tc) {
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const enter = (args) => win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args }]);
        tc.assertEqual('the effects are ON by default under a stack (rain + lava glow)', 'on/true/rain,lavaGlow',
            `${g.effectsSwitch.setting}/${g.effectsSwitch.on}/${g.effectsSwitch.families.join(',')}`);
        const drops = (e) => (e?.ops ?? []).filter((o) => o.key === 'seedling:fx/droplet').length;
        enter([61, 104, 144]);
        const rain = await tc.pollForValue(() => (rt.run?.level === 61 && drops(g.effects) > 0 ? g.effects : null),
            'the page drew level 61\'s rain', 15000, 100);
        tc.log(`rain ON: ${rain?.droplets} drop(s) alive, ${drops(rain)} drawn`);
        tc.reportCondition('effects ON: the rain is drawn', !!rain);
        await g.set({ effects: 'off' });
        const dry = await tc.pollForValue(() => (g.effects && g.effects.droplets === 0 && drops(g.effects) === 0 ? g.frames : null),
            'the switch stopped the rain live', 5000, 50);
        tc.reportCondition('effects OFF (live): no drop alive, none drawn', !!dry);
        await tc.pollForCondition(() => g.frames >= (dry ?? 0) + 30, 'thirty more paints with the effects off', 5000, 50);
        tc.assertEqual('effects OFF: still no drop after thirty paints', '0/0', `${g.effects?.droplets}/${drops(g.effects)}`);
        await g.set({ effects: 'on' });
        enter([76, 152, 92]);
        const glow = await tc.pollForValue(() => (rt.run?.level === 76 && g.lights.solid > 0 && g.lights.paints > 2 ? g.lights : null),
            'the page drew level 76\'s lava glow (its solidBmp edges)', 15000, 100);
        tc.log(`lava ON: ${JSON.stringify(glow)}`);
        tc.reportCondition('effects ON: the lava glow is drawn', !!glow);
        await g.set({ effects: 'off' });
        const dark = await tc.pollForValue(() => (g.lights.solid === 0 && g.lights.alpha > 0 ? g.lights : null),
            'the switch removed the lava glow live', 5000, 50);
        tc.log(`lava OFF: ${JSON.stringify(dark)}`);
        tc.assertEqual('effects OFF: no lava edge, fewer night ops, the room still darkened', 'true/true',
            `${!!dark && dark.ops < glow.ops}/${(dark?.alpha ?? 0) > 0}`);
        await g.set({ effects: 'on' });
        const back = await tc.pollForValue(() => (g.lights.solid > 0 ? g.lights : null), 'the lava glow came back on live', 5000, 50);
        tc.reportCondition('the effects switched back on live', !!back);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 76 and did not halt', '76/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-effects-switch',
    name: 'Seedling JS runtime: the effects switch (rain, lava glow) in the original graphics (G6)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe and drives it through its own '
        + '__swfBridge: at level 61 the rain is drawn with the effects ON and stops LIVE with them OFF; at level 76 the lava '
        + 'glow\'s edges are drawn ON and gone OFF (the room still darkened); back ON; every sheet decodes, no console error. '
        + 'Touches no panel, preset or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsEffectsSwitch,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── ⛓ EVENT GOALS (slice `seedling-js-event-goals`): the JS runtime walks a saved-obstacle EVENT to its flag ──

/**
 * L16's rope (`flag:L16:0`, `rope@32,16` — the break leg the walk-order probe's J stalled on, `level_36 →
 * level_16__r1c1`): on `seedling_playthrough` (the preset whose rules carry the event), runtime js + the solver mode
 * ON, the sword granted through the AP item path (removed after), the page teleported to the event's side region's
 * own arrival spawn. The Playback Bot asks for the event location BY NAME (`_publishWalkTo`, its break step's own
 * call), the controller maps it (`atlasEventGoal`), the page walks the solver's `clear-tag`, and the leg completes
 * on the GAME's flag: `{16,0}` in `persistence_cleared`, reported once as `pendingCheck <seq>|16|0|0`, collected by
 * the event collector as a LOCAL check of the event location. The row sets its own state: the preset load is a
 * fresh game (the flag is asserted unset first).
 */
const ROPE_EVENT = Object.freeze({ eventId: 'flag:L16:0', side: 'level_16__r1c1', flag: { level: 16, tag: 0 } });

/**
 * `botOnSeedlingPreset`'s steps (the bot mounted first, the PRODUCTION load path, a fresh adapter on the js transport)
 * for a preset whose rules load outlives that helper's 8 s wait: `seedling_playthrough` (measured: no
 * `stateManager:rulesLoaded` inside 8 s on the box). Appended, not a parameter of the shared helper.
 */
async function botOnLargeSeedlingPreset(tc, presetPath, { rulesLoadMs = 60000 } = {}) {
    tc.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
    const botPanel = await tc.pollForValue(() => getBotPanel(), 'playback bot panel instance', 5000, 100);
    const bot = botPanel?.getBot?.() ?? null;
    tc.reportCondition('the playback bot is mounted', !!bot);
    if (!bot) return null;
    bot.reset?.();
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    await settingsManager.updateSetting(RUNTIME_KEY, 'js', { persist: false });
    tc.log(`runtime = js (session override); loading ${presetPath}…`);
    const rulesJson = await (await fetch(presetPath)).json();
    const loaded = tc.waitForEvent('stateManager:rulesLoaded', rulesLoadMs);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: presetPath });
    await loaded;
    await tc.stateManager.pingWorker('after-rules-load', 10000);
    tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
    const panel = await tc.pollForValue(() => {
        const p = getActivePanelInstance();
        return p?.transport === 'js' && p.adapter && p.adapter !== staleAdapter && p._initRuntime === 'js' ? p : null;
    }, 'the flash panel mounted the js transport (a fresh adapter)', 30000, 250);
    tc.assertEqual('the panel is on the js transport', 'js', panel?.transport ?? null);
    return panel ? { bot, panel } : null;
}

export async function seedlingJsRuntimeSolverCutsRopeEvent(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    let rt = null;
    let granted = false;
    try {
        await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
        const ready = await botOnLargeSeedlingPreset(tc, PLAYTHROUGH_PATH);
        if (!ready) return tc.getOverallResult();
        const { bot, panel } = ready;
        const rules = await (await fetch(new URL(PLAYTHROUGH_PATH, document.baseURI).href)).json();
        const pl = rules.preset_sidecars?.['1']?.[ROPE_EVENT.side]?.playable_payload ?? null;
        const spawn = pl?.exits?.find((e) => e.entrance_spawn)?.entrance_spawn ?? null;
        tc.reportCondition(`seedling_playthrough has region ${ROPE_EVENT.side} with an arrival spawn`, !!spawn);
        if (!spawn) return tc.getOverallResult();
        const bound = await tc.pollForValue(() => (panel._apLoadResult && panel.seedlingPlaybackSurface()?.atlas ? panel : null),
            'the panel finished its AP load and holds the name → goal map', 30000, 250);
        tc.reportCondition('the panel\'s AP load finished', !!bound);
        const event = (panel.seedlingPlaybackSurface()?.atlas?.events ?? []).find((e) => e.eventId === ROPE_EVENT.eventId) ?? null;
        tc.reportCondition(`the map carries the event ${ROPE_EVENT.eventId}`, !!event);
        if (!bound || !event) return tc.getOverallResult();
        rt = await tc.pollForValue(() => {
            const r = frameOf(panel)?.__seedlingJsRuntime ?? null;
            return r?.run && r.vanilla ? r : null;
        }, 'the JS runtime page is running a room of the vanilla map', 15000, 200);
        tc.reportCondition('the JS page runs the vanilla map', !!rt);
        if (!rt) return tc.getOverallResult();
        const win = frameOf(panel);
        const flagSet = () => (JSON.parse(rt.game.botStatus()).persistence_cleared ?? [])
            .some((c) => c.level === ROPE_EVENT.flag.level && c.tag === ROPE_EVENT.flag.tag);
        tc.assertEqual('fresh game: the flag {16,0} is unset and the event location unchecked', 'false/false',
            `${flagSet()}/${snapshotFacts(tc).checked.has(event.location)}`);
        const pushed = await tc.pollForCondition(() => rt.playback.solverWalk === true,
            'the setting reached the JS page (playback.solverWalk)', 5000, 100);
        tc.reportCondition('the page is in solver mode', !!pushed);

        await tc.stateManager.addItemToInventory('Progressive Sword', 1);
        granted = true;
        await tc.stateManager.pingWorker('after-item-grant', 5000);
        const armed = await tc.pollForCondition(() => rt.flags?.hasSword === true,
            'the host delivered the sword to the page (Main.hasSword)', 10000, 100);
        tc.reportCondition('the page holds the sword', !!armed);
        if (!armed) return tc.getOverallResult();
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
        const there = await tc.pollForCondition(() => rt.run?.level === pl.level && rt.flags?.hasSword === true,
            `the page is in level ${pl.level} with the sword`, 10000, 100);
        // (A host teleport is no crossing: the region binding does not follow it, and an event resolves BY NAME.)
        tc.log(`the bot's region: ${bot.getCurrentRegion?.() ?? '?'}`);
        tc.reportCondition(`teleported into level ${pl.level}`, !!there);
        if (!there) return tc.getOverallResult();

        const checksBefore = reportedChecks(win).length;
        const collectedBefore = getSeedlingRegionGlue()?.stats?.eventsCollected ?? 0;
        bot._publishWalkTo({ kind: 'location', name: event.location });
        const accepted = await tc.pollForCondition(() => rt.playback.goal?.event?.tag?.level === ROPE_EVENT.flag.level,
            'the page took the event goal (it used to refuse it: "walked on the wasm runtime")', 10000, 100);
        tc.assertEqual('the page accepted the EVENT goal', true, !!accepted);
        if (!accepted) {
            tc.log(`controller refusal: ${JSON.stringify(bot._resolveController?.()?.lastRefusal ?? null)}`, 'error');
            return tc.getOverallResult();
        }
        const s = await settledSolverWalk(tc, rt, 90000);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
        tc.assertEqual('the walk is DONE', 'done', rt.playback.state);
        tc.assertEqual('… on the game\'s own flag {16,0} (persistence_cleared)', true, flagSet());
        tc.assertEqual('the SOLVER drove it: solved once, no decline, no refutation', '1/0/0',
            `${s.solves}/${s.declines}/${s.refutations}`);
        tc.assertEqual('the solver goal was clear-tag {16,0} rope@32,16', 'clear-tag|16|0|rope@32,16',
            `${s.lastSolve?.goal?.kind}|${s.lastSolve?.goal?.tag?.level}|${s.lastSolve?.goal?.tag?.tag}|${s.lastSolve?.goal?.obstacle}`);
        tc.assertEqual('the flag\'s clear was reported once as pendingCheck <seq>|16|0|0', 1,
            reportedChecks(win).slice(checksBefore).filter((c) => c.level === 16 && c.tag === 0).length);
        const collected = await tc.pollForCondition(() => snapshotFacts(tc).checked.has(event.location),
            `the event collector collected "${event.location}" (a LOCAL check)`, 10000, 100);
        tc.assertEqual('the event location is checked in the state manager', true, !!collected);
        tc.assertEqual('… by the glue\'s event collector, once', 1,
            (getSeedlingRegionGlue()?.stats?.eventsCollected ?? 0) - collectedBefore);
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
    } finally {
        if (granted) { try { await tc.stateManager.removeItemFromInventory('Progressive Sword', 1); } catch { /* best effort */ } }
        try { rt?.playback.reset(); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-cuts-rope-event',
    name: 'Seedling JS runtime: the solver mode walks a saved-obstacle EVENT to its flag (L16\'s rope, clear-tag)',
    description: 'With flashPanel.runtime = js and the solver mode ON, on seedling_playthrough: the sword is granted '
        + 'through the AP item path (removed after), the page teleported to level_16__r1c1\'s arrival, and the Playback '
        + 'Bot asks for "L16 flag 0: rope@32,16 cleared" by name. The page walks the solver\'s clear-tag (it used to '
        + 'refuse every event: "walked on the wasm runtime"), and the leg completes on the game\'s own flag {16,0}: '
        + 'persistence_cleared, one pendingCheck <seq>|16|0|0, and the event collector\'s LOCAL check of the location. '
        + '0 HALT, no refutation.',
    testFunction: seedlingJsRuntimeSolverCutsRopeEvent,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G7 — the stairs, the pushable blocks and the sand traps in a real browser, and ONE fade per `new Game`:
 * `jsRuntime.html?graphics=seedling` mounted STANDALONE in the row's own iframe and driven through its own
 * `__swfBridge` to `Game(8, 144, 48)` (level 8: a stairs up, two pushable blocks, two sand traps). Then the host's
 * verb the user's flicker came from: an item flag (`Main.hasShield = true`), which the JS runtime turns into a
 * reboot in place. Before G7 the page faded in from black a second time; the game builds no new world for it.
 * No panel, preset or AP state is touched; the iframe is removed however the row ends.
 */
export async function seedlingJsRuntimeGraphicsPuzzles(tc) {
    const frame = document.createElement('iframe');
    // Visible (a display:none frame gets no animation frames, and the page paints only in rAF), but out of the way.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [8, 144, 48] }]);
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const keysOf = (p) => [...new Set((p?.ops ?? []).map((o) => o.key))].sort().join(',');
        const drawn = await tc.pollForValue(() => (rt.run?.level === 8 && g.effects?.owed === 0 && g.effects?.cover === 0
            && g.puzzles?.ops.length >= 5 ? g.puzzles : null), 'level 8 is up, its arrival fade is over, and its puzzles are drawn', 15000, 100);
        tc.log(`puzzles: ${JSON.stringify(drawn ? { ...drawn, ops: drawn.ops.length } : null)}; held ${g.held}`);
        tc.assertEqual('one stairs, two blocks, two sand traps', '1/2/2', `${drawn?.stairs}/${drawn?.blocks}/${drawn?.traps}`);
        tc.assertEqual('drawn as the stairs, the pushable block and the sand trap', 'seedling:enemy/sandtrap,seedling:puzzlement/pushableblock,seedling:puzzlement/stairs', keysOf(drawn));
        tc.assertEqual('every op from the seedling pack', 'seedling', [...new Set((drawn?.ops ?? []).map((o) => o.pack))].join(','));
        const heldBefore = g.held;
        const bootsBefore = rt.events.filter((e) => e.type === 'boot').length;
        win.__swfBridge.queueItems([{ class: 'Main', property: 'hasShield', value: true }]);
        const rebooted = await tc.pollForValue(() => {
            const boots = rt.events.filter((e) => e.type === 'boot');
            return boots.length > bootsBefore ? boots.at(-1) : null;
        }, 'the item flag rebooted the run in place', 5000, 50);
        tc.assertEqual('the runtime rebooted in place for the item', 'an item flag changed', rebooted?.why ?? null);
        const framesAt = g.frames;
        await tc.pollForCondition(() => g.frames >= framesAt + 30, 'thirty paints after the reboot', 10000, 50);
        tc.assertEqual('⚖ ONE fade per new Game: the reboot held no dead frame, and no cover is owed or shown', `${heldBefore}/0/0`,
            `${g.held}/${g.effects?.owed}/${g.effects?.cover}`);
        tc.assertEqual('the puzzles are still drawn after the reboot', true, (g.puzzles?.ops.length ?? 0) >= 5);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 8 and did not halt', '8/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-puzzles',
    name: 'Seedling JS runtime: the stairs, pushable blocks and sand traps, and one fade per new Game (G7)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 8 through its own '
        + '__swfBridge, and asserts the stairs, both pushable blocks and both sand traps are drawn from the seedling pack; '
        + 'then delivers an item flag (a reboot in place on the JS runtime) and asserts it holds no dead frame and owes '
        + 'or shows no cover (before G7 it faded in from black again), every sheet decodes, and no console error. '
        + 'Touches no panel, preset or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsPuzzles,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G8 — the changeable solids and the buttons in a real browser: `jsRuntime.html?graphics=seedling`
 * mounted STANDALONE in the row's own iframe and driven through its own `__swfBridge` to `Game(38, 144, 288)`
 * (level 38: a chest under a cover, two covers, a Button and four ButtonRooms, one over a wire). The arrival cell is
 * a ButtonRoom, so the player stands on it: its PRESSED frame is the run's own `activatorsNow` read reaching the
 * page. No panel, preset or AP state is touched; the iframe is removed however the row ends.
 */
export async function seedlingJsRuntimeGraphicsSolids(tc) {
    const frame = document.createElement('iframe');
    // Visible (a display:none frame gets no animation frames, and the page paints only in rAF), but out of the way.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [38, 144, 288] }]);
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const keysOf = (p) => [...new Set((p?.ops ?? []).map((o) => o.key))].sort().join(',');
        const drawn = await tc.pollForValue(() => (rt.run?.level === 38 && g.effects?.owed === 0 && g.solids?.ops.length >= 8
            && g.solids.ops.some((o) => o.key === 'seedling:puzzlement/buttonroom' && o.frame % 2 === 1) ? g.solids : null),
        'level 38 is up, its arrival fade is over, its solids are drawn and the ButtonRoom underfoot is down', 15000, 100);
        tc.log(`solids: ${JSON.stringify(drawn ? { ...drawn, ops: drawn.ops.map((o) => `${o.key.split('/')[1]}#${o.frame}`) } : null)}`);
        tc.assertEqual('one chest, two covers, five buttons', '1/2/5', `${drawn?.chests}/${drawn?.responders}/${drawn?.buttons}`);
        tc.assertEqual('drawn as the chest, the covers and the buttons',
            'seedling:puzzlement/button,seedling:puzzlement/buttonroom,seedling:puzzlement/chest,seedling:puzzlement/cover', keysOf(drawn));
        tc.assertEqual('every op from the seedling pack', 'seedling', [...new Set((drawn?.ops ?? []).map((o) => o.pack))].join(','));
        tc.assertEqual('the ButtonRoom over the wire draws its wired frames (2 or 3)', true,
            (drawn?.ops ?? []).filter((o) => o.key === 'seedling:puzzlement/buttonroom').some((o) => o.frame >= 2));
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 38 and did not halt', '38/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-solids',
    name: 'Seedling JS runtime: the chests, covers and buttons drawn at their live state (G8)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 38 through its own '
        + '__swfBridge, and asserts the chest, both covers and all five buttons are drawn from the seedling pack, the '
        + 'ButtonRoom the player arrives on is drawn PRESSED (the run\'s activatorsNow read), the wired ButtonRoom draws its '
        + 'wired frames, every sheet decodes, and no console error. Touches no panel, preset or AP state; the iframe is '
        + 'removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsSolids,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G8 — the placed NPCs in a real browser: the standalone page driven to `Game(1, 64, 56)`, which puts the
 * player 24 px below the Oracle — inside its 48 px wake and its talk range. The Oracle wakes (`Oracle.as` "waken" →
 * "awake", frame 3) and the talk prompt shows over it. No panel, preset or AP state is touched.
 */
export async function seedlingJsRuntimeGraphicsNpcs(tc) {
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [1, 64, 56] }]);
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const awake = await tc.pollForValue(() => (rt.run?.level === 1 && g.effects?.owed === 0
            && g.npcs?.ops.some((o) => o.key === 'seedling:npc/oracle' && o.frame === 3) ? g.npcs : null),
        'level 1 is up and the Oracle is awake (frame 3)', 15000, 100);
        tc.log(`npcs: ${JSON.stringify(awake ? { ...awake, ops: awake.ops.map((o) => `${o.key.split('/')[1]}#${o.frame}`) } : null)}`);
        tc.assertEqual('the Oracle and its talk prompt are drawn', 'seedling:npc/oracle,seedling:npc/talk',
            [...new Set((awake?.ops ?? []).map((o) => o.key))].sort().join(','));
        tc.assertEqual('every op from the seedling pack', 'seedling', [...new Set((awake?.ops ?? []).map((o) => o.pack))].join(','));
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 1 and did not halt', '1/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-npcs',
    name: 'Seedling JS runtime: the placed NPCs — the Oracle wakes and its talk prompt shows (G8)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 1 beside the Oracle '
        + 'through its own __swfBridge, and asserts the Oracle wakes (frame 3) and the talk prompt is drawn, both from the '
        + 'seedling pack, every sheet decodes, and no console error. Touches no panel, preset or AP state; the iframe is '
        + 'removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsNpcs,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/** ⛓ G9 — mount the standalone graphics page in the row's own iframe and boot `Game(level, x, y)` through its bridge. */
async function bootGraphicsPage(tc, frame, errors, [level, x, y]) {
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling';
    document.body.appendChild(frame);
    const win = await tc.pollForValue(() => {
        const w = frame.contentWindow;
        return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
    }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
    tc.reportCondition('the standalone page is up with its pack', !!win);
    if (!win) return null;
    const origError = win.console.error.bind(win.console);
    win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
    win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
    const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
    win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
    win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
        { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return win;
}

/**
 * ⛓ GRAPHICS G9a — the placed vanilla pickups in a real browser: the standalone page driven to `Game(10, 48, 80)`
 * (level 10: the Sword on its cell). The Sword is drawn from the seedling pack as its class (`seedlingPickupSkin`), not
 * the stand-in rectangle. No panel, preset or AP state is touched; the iframe is removed however the row ends.
 */
export async function seedlingJsRuntimeGraphicsPickups(tc) {
    const frame = document.createElement('iframe');
    const errors = [];
    try {
        const win = await bootGraphicsPage(tc, frame, errors, [10, 48, 80]);
        if (!win) return tc.getOverallResult();
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const drawn = await tc.pollForValue(() => (rt.run?.level === 10 && g.effects?.owed === 0 && g.pickups?.ops.length >= 1 ? g.pickups : null),
            'level 10 is up, its arrival fade is over and its pickup is drawn', 15000, 100);
        tc.log(`pickups: ${JSON.stringify(drawn)}`);
        tc.assertEqual('one placed pickup, none taken', '1/0', `${drawn?.pickups}/${drawn?.taken}`);
        tc.assertEqual('drawn as the Sword', 'seedling:pickup/sword', (drawn?.ops ?? []).map((o) => o.key).join(','));
        tc.assertEqual('from the seedling pack', 'seedling', [...new Set((drawn?.ops ?? []).map((o) => o.pack))].join(','));
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 10 and did not halt', '10/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-pickups',
    name: 'Seedling JS runtime: the placed vanilla pickups drawn as their classes (G9a)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 10 through its own '
        + '__swfBridge, and asserts the Sword is drawn from the seedling pack as its class, every sheet decodes, and no console '
        + 'error. Touches no panel, preset or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsPickups,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G9b/G9c — the machines and a responder's fade in a real browser: the standalone page driven to
 * `Game(38, 208, 224)` — on the covered ButtonRoom wired to the pulser (tset 1). The pressed ButtonRoom lights its
 * twelve wires and arms the pulser, whose ring (`levelRun.machinesNow`) is drawn; the pulse knocks the player onto the
 * Button, and the cover over the chest it publishes fades (`seedlingSolidsSkin.stepResponder`). No panel, preset or AP
 * state is touched.
 */
export async function seedlingJsRuntimeGraphicsMachines(tc) {
    const frame = document.createElement('iframe');
    const errors = [];
    try {
        const win = await bootGraphicsPage(tc, frame, errors, [38, 208, 224]);
        if (!win) return tc.getOverallResult();
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        let fadedCover = false;
        const lit = await tc.pollForValue(() => {
            if ((g.solids?.ops ?? []).some((o) => o.key === 'seedling:puzzlement/cover' && o.alpha < 1)) fadedCover = true;
            return rt.run?.level === 38 && g.effects?.owed === 0 && g.machines?.lit > 0
                && g.machines.ops.some((o) => o.ring) && fadedCover ? g.machines : null;
        }, 'level 38: wires lit, a pulser ring drawn, a cover mid-fade', 20000, 50);
        tc.log(`machines: ${JSON.stringify(lit ? { ...lit, ops: lit.ops.map((o) => o.key ?? (o.ring ? 'ring' : 'line')) } : null)}`);
        tc.assertEqual('the pulser and its wires are drawn from the seedling pack', 'seedling:machine/pulser,seedling:machine/wire',
            [...new Set((lit?.ops ?? []).filter((o) => o.key).map((o) => o.key))].sort().join(','));
        tc.assertEqual('a ButtonRoom lit its wires', true, (lit?.lit ?? 0) > 0);
        tc.assertEqual('the pulser\'s ring is drawn (machinesNow reached the page)', true, (lit?.ops ?? []).some((o) => o.ring));
        tc.assertEqual('a cover was drawn mid-fade', true, fadedCover);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 38 and did not halt', '38/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-machines',
    name: 'Seedling JS runtime: the machines and a responder fade — lit wires, a pulser ring, a fading cover (G9b/G9c)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 38 onto the pulser\'s '
        + 'ButtonRoom through its own __swfBridge, and asserts the pressed ButtonRoom lights its wires, the pulser ring is drawn from '
        + 'levelRun.machinesNow, a cover is drawn mid-fade, every sheet decodes, and no console error. Touches no panel, preset '
        + 'or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsMachines,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GAME SPEED (slice `seedling-js-game-speed`) — the speed setting in the real panel. With `flashPanel.runtime = js`
 * (a session override) and seedling_generated_room loaded, the panel's Settings section shows the "Game speed" row
 * (a js-only row); a speed saved before the mount (`2x`) is on the page's URL and its clock; `flashPanel.seedlingJsSpeed = 4x` (a session override) reaches the mounted page LIVE: its
 * clock reads 4, the adapter's item push is re-timed to 100/4 ms, and the page achieves ≈ 120 ticks a second. Back
 * to `1x`: ≈ 30. The run never halts. Both settings are restored however it ends.
 * ⛓ CUSTOM SPEED (slice `seedling-js-custom-speed`): the row is a NUMBER field + 1× / 2× / 4× buttons + an
 * ACHIEVED readout. The `2x` saved before the mount is the OLD spelling: it is migrated (written back as 2, still a
 * session override). 1.5× live ≈ 45 slots a second; a typed 20 is REFUSED with its reason (nothing written); 16× live
 * shows its achieved speed; a quick button writes its speed.
 */
export async function seedlingJsRuntimeGameSpeed(tc) {
    const { SPEED_SETTING_KEY } = await import('../../flashPanel/seedlingGameSpeedSettings.js');
    const { PUSH_INTERVAL_MS } = await import('../../flashPanel/wasmBridgeAdapter.js');
    let previousRuntime = 'auto';
    let previousSpeed = 1;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSpeed = await settingsManager.getSetting(SPEED_SETTING_KEY, 1); } catch { /* keep 1 */ }
    try {
        // the speed is set BEFORE the mount: the mount reads it onto the page's URL
        await settingsManager.updateSetting(SPEED_SETTING_KEY, '2x', { persist: false });
        await settingsManager.updateSetting(RUNTIME_KEY, 'js', { persist: false });
        const rulesJson = await (await fetch(PRESET_PATH)).json();
        const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
        tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: PRESET_PATH });
        await loaded;
        await tc.stateManager.pingWorker('after-rules-load', 5000);
        tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
        const panel = await tc.pollForValue(() => {
            const p = getActivePanelInstance();
            return p?.transport === 'js' && p.adapter && p._apLoadResult && frameOf(p)?.__seedlingJsClock && frameOf(p)?.__seedlingJsRuntime?.run ? p : null;
        }, 'the flash panel mounted the JS runtime page and finished its AP load', 30000, 250);
        tc.reportCondition('the panel is on the JS runtime with a live run', !!panel);
        if (!panel) return tc.getOverallResult();
        const win = frameOf(panel);
        const clock = win.__seedlingJsClock;
        const rt = win.__seedlingJsRuntime;
        const row = panel._settingsControls?.find((c) => c.prop === 'seedlingJsSpeed') ?? null;
        tc.log(`mounted: wasmPath ${panel.wasmPath}; frame ${win.location.href}; _jsSpeed ${panel._jsSpeed}`);
        tc.assertEqual('the Settings section has a visible "Game speed" row on the js runtime: a number field 0.25–16 + 1× / 2× / 4×',
            'flex/number/0.25/16/0.05/1,2,4',
            `${row?.row?.style?.display}/${row?.input?.type}/${row?.input?.min}/${row?.input?.max}/${row?.input?.step}/`
            + `${(row?.quick ?? []).map((b) => b.dataset.speed).join(',')}`);
        tc.assertEqual('mounted at the saved 2×: the page clock, its URL, the push and the control', `2/2/${PUSH_INTERVAL_MS / 2}/2`,
            `${clock.speed}/${new URLSearchParams(win.location.search).get('speed')}/${panel.adapter._pushIntervalMs}/${row?.input?.value}`);
        // ⛓ CUSTOM SPEED — the old spelling migrates: written back as the number, in the same (session) layer
        const migrated = await tc.pollForValue(async () => {
            const v = await settingsManager.getSetting(SPEED_SETTING_KEY);
            return v === 2 ? v : null;
        }, 'the stored 2x migrated to 2', 5000, 50);
        tc.assertEqual('the old `2x` migrated to the number 2, still a session override', '2/number/true',
            `${migrated}/${typeof migrated}/${settingsManager.hasOverride(SPEED_SETTING_KEY)}`);
        const rateOver = async (ms) => {
            const s0 = clock.slots;
            const t0 = performance.now();
            await new Promise((r) => setTimeout(r, ms));
            return ((clock.slots - s0) * 1000) / (performance.now() - t0);
        };
        await settingsManager.updateSetting(SPEED_SETTING_KEY, '4x', { persist: false });
        const at4 = await tc.pollForValue(() => (clock.speed === 4 ? clock : null), 'the page clock took 4× live', 5000, 50);
        tc.assertEqual('4× live: the page clock, the control and the push (no re-mount)', `4/4/${PUSH_INTERVAL_MS / 4}/true`,
            `${at4?.speed}/${row?.input?.value}/${panel.adapter._pushIntervalMs}/${frameOf(panel) === win}`);
        const r4 = await rateOver(2000);
        tc.log(`4×: ${r4.toFixed(1)} slots a second (target 120); clock.rate ${JSON.stringify(clock.rate)}`);
        tc.reportCondition(`4× achieves ≥ 100 slots a second (measured ${r4.toFixed(1)})`, r4 >= 100);
        // ⛓ CUSTOM SPEED — a fractional speed live, a refusal, 16× with its achieved readout, a quick button
        await settingsManager.updateSetting(SPEED_SETTING_KEY, 1.5, { persist: false });
        await tc.pollForCondition(() => clock.speed === 1.5, 'the page clock took 1.5× live', 5000, 50);
        const r15 = await rateOver(2000);
        tc.log(`1.5×: ${r15.toFixed(1)} slots a second (target 45); push ${panel.adapter._pushIntervalMs}`);
        tc.reportCondition(`1.5× is 45 slots a second (measured ${r15.toFixed(1)})`, r15 > 40 && r15 < 50);
        tc.assertEqual('1.5×: the control and the push', `1.5/${PUSH_INTERVAL_MS / 1.5}`, `${row?.input?.value}/${panel.adapter._pushIntervalMs}`);
        const typed = panel._enterSpeed('20');
        await new Promise((r) => setTimeout(r, 100));
        tc.assertEqual('a typed 20× is REFUSED with its reason, nothing written (the clock stays at 1.5×)',
            'false/true/1.5/1.5', `${typed}/${/20× is above the maximum 16×/.test(row?.reason?.textContent ?? '')}/`
            + `${await settingsManager.getSetting(SPEED_SETTING_KEY)}/${clock.speed}`);
        tc.log(`refusal shown: ${row?.reason?.textContent}`);
        await settingsManager.updateSetting(SPEED_SETTING_KEY, 16, { persist: false });
        await tc.pollForCondition(() => clock.speed === 16, 'the page clock took 16× live', 5000, 50);
        const r16 = await rateOver(2000);
        panel._renderSpeedReadout();
        tc.log(`16×: ${r16.toFixed(1)} slots a second (target 480); achieved ${clock.achievedSpeed.toFixed(2)}×; readout "${row?.achieved?.textContent}"`);
        tc.reportCondition('16×: the achieved readout is shown', /^achieved \d/.test(row?.achieved?.textContent ?? ''));
        tc.reportCondition('the refusal line cleared once a speed was entered', (row?.reason?.style?.display ?? '') === 'none');
        row?.quick?.find((b) => b.dataset.speed === '1')?.click();
        await tc.pollForCondition(() => clock.speed === 1, 'the 1× quick button put the page clock back at 1×', 5000, 50);
        const r1 = await rateOver(2000);
        tc.log(`1×: ${r1.toFixed(1)} slots a second (target 30)`);
        tc.reportCondition(`1× is 30 slots a second again (measured ${r1.toFixed(1)})`, r1 > 25 && r1 < 35);
        tc.assertEqual('the run did not halt', 'null', `${rt.halted ? rt.halted.message : null}`);
    } finally {
        try { await settingsManager.updateSetting(SPEED_SETTING_KEY, previousSpeed, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-game-speed',
    name: 'Seedling JS runtime: the game-speed setting — a js-only Settings row, applied live (1× → 4× → 1×)',
    description: 'With flashPanel.runtime = js (session override) and seedling_generated_room loaded: the panel\'s Settings '
        + 'section shows the "Game speed" row; a speed set before the mount (2x) mounts the page at ?speed=2; seedlingJsSpeed = 4x (session override) reaches the mounted page live (its '
        + 'clock reads 4, the item push is re-timed to 25 ms, no re-mount) and it achieves ≥ 100 slots a second; back to '
        + '1x it is ≈ 30. Both settings are restored.',
    testFunction: seedlingJsRuntimeGameSpeed,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ SOUND EFFECTS (slice `seedling-js-sound-effects`) — a FAKE AudioContext installed in a page's window before its
 * ▶ Start: it records every clip started (its decoded bytes and its `when`), so a row can see what is played, on a
 * machine with or without audio. `decodeAudioData` answers `{ bytes }`, the clip's size.
 */
function installFakeAudio(win) {
    const starts = [];
    win.AudioContext = class FakeAudioContext {
        constructor() { this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
        get currentTime() { return win.performance.now() / 1000; }
        createGain() { return { gain: { value: 1 }, connect() {} }; }
        createStereoPanner() { return { pan: { value: 0 }, connect() {} }; }
        createBuffer() { return { silent: true }; }
        createBufferSource() {
            const s = { connect() {}, stop() {}, start: (when) => { if (!s.buffer?.silent) starts.push({ bytes: s.buffer?.bytes, when, at: this.currentTime }); } };
            return s;
        }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        decodeAudioData(ab) { return Promise.resolve({ bytes: ab.byteLength }); }
    };
    return starts;
}

/**
 * ⛓ SOUND EFFECTS — the JS page's ▶ Start and its sound, standalone. `jsRuntime.html?start=click` shows `#btn-start`
 * (the wasm page's id) and does NOT boot: the bridge has no callbacks. A fake AudioContext is installed, ▶ Start is
 * pressed: the page boots, the output unlocks, the seedling `sfx` stack's 68 clips decode. Driven to level 38 onto the
 * pulser's ButtonRoom (the G9 machines row's spot) through its own `__swfBridge`, the pulser's "Energy Pulse" cues
 * arrive every 51 ticks (its pulse period, the same as the node golden `prox-l38-chest`), each one PLAYED as the
 * energyPulse clip. No panel, preset or AP state is touched; the iframe is removed however the row ends.
 */
export async function seedlingJsRuntimeSoundStart(tc) {
    const frame = document.createElement('iframe');
    const errors = [];
    try {
        Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '480px', height: '480px',
            opacity: '0.01', pointerEvents: 'none', border: '0' });
        frame.src = './modules/seedlingDemo/jsRuntime.html?start=click';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime && w.__seedlingJsSound ? w : null;
        }, 'the standalone JS page is up (?start=click)', 20000, 200);
        tc.reportCondition('the standalone page is up', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        const button = win.document.getElementById('btn-start');
        const sound = win.__seedlingJsSound;
        await new Promise((r) => setTimeout(r, 1500)); // time for the vanilla map's fetch: it must NOT boot a run yet
        tc.assertEqual('▶ Start is shown and pressable; the page has NOT booted (no bridge callbacks, no run); the audio is locked',
            'true/false/click/false/0/false/locked',
            `${!!button && button.style.display !== 'none'}/${button?.disabled}/${sound.startMode}/${sound.started}/`
            + `${Object.keys(win.__swfBridge.game).length}/${!!win.__seedlingJsRuntime.run}/${sound.readout.state}`);
        const starts = installFakeAudio(win);
        button.click();
        tc.assertEqual('▶ Start boots the page: the button hides, the callbacks appear, the audio runs', 'none/true/true/running',
            `${button.style.display}/${sound.started}/${typeof win.__swfBridge.game.configure === 'function'}/${sound.readout.state}`);
        const loaded = await tc.pollForValue(() => (sound.readout.loaded === 'ready' ? sound.readout : null), 'the sfx stack decoded', 15000, 100);
        tc.assertEqual('the seedling sfx stack: 68 clips decoded, none failed', '68/[]', `${loaded?.clips}/${JSON.stringify(loaded?.failedClips)}`);
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [38, 208, 224] }]);
        const pulses = await tc.pollForValue(() => {
            const p = sound.readout.recent.filter((c) => c.site === 'Puzzlements/Pulser.as:65');
            return p.length >= 3 ? p : null;
        }, 'three "Energy Pulse" cues from the L38 pulser', 30000, 100);
        const r = sound.readout;
        tc.log(`sound: ${JSON.stringify({ ...r, recent: r.recent.slice(-8) })}; starts ${starts.length}`);
        const gaps = (pulses ?? []).slice(1).map((c, i) => c.tick - pulses[i].tick);
        tc.assertEqual('the pulses are its period apart (51 ticks, as in the node golden prox-l38-chest)', '51,51', gaps.slice(0, 2).join(','));
        // ⛓ MUSIC: the room's song plays through the same context, so the music player's starts are counted too
        tc.assertEqual('every cue the page played reached the context (a start per play, + the music\'s)',
            r.player.played + (r.music?.player?.starts ?? 0), starts.length);
        tc.assertEqual('the pulse played the energyPulse clip (5463 bytes)', true, starts.some((s) => s.bytes === 5463));
        // `at` is the context clock when `start()` ran, a moment AFTER the tick read it (a `when` in the past means now)
        tc.assertEqual('no start was scheduled more than 20 ms in the past or more than MAX_LEAD (0.1 s) ahead', true,
            starts.every((s) => s.when >= s.at - 0.02 && s.when - s.at <= 0.1 + 1e-6));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 38 and did not halt', '38/null',
            `${win.__seedlingJsRuntime.run?.level}/${win.__seedlingJsRuntime.halted ? win.__seedlingJsRuntime.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-sound-start',
    name: 'Seedling JS runtime: ▶ Start boots the page and unlocks its sound; the L38 pulser\'s cues are played (fake AudioContext)',
    description: 'Mounts jsRuntime.html?start=click standalone: ▶ Start (#btn-start) is shown and the page has not booted. With a '
        + 'fake AudioContext installed, ▶ Start boots it and unlocks the sound; the 68 sfx clips decode. Driven to level 38, '
        + 'the pulser\'s "Energy Pulse" cues come 51 ticks apart and each is played. Touches no panel, preset or AP state.',
    testFunction: seedlingJsRuntimeSoundStart,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ SOUND EFFECTS — the panel. (1) THE BYPASS: in this automated run (`?mode=test-…`) the default start mode
 * `tests-auto` mounts the page WITHOUT `start=click`, so it boots with no ▶ Start. (2) With `seedlingJsStart = click`
 * (a session override) set before the mount, the panel says *click ▶ Start in the game*, the page waits, and pressing
 * its ▶ Start boots it through to the AP load. (3) The "Sound" and "Volume" rows are js-only Settings rows, applied
 * LIVE (no re-mount). Every setting is restored however it ends.
 */
export async function seedlingJsRuntimeSoundPanel(tc) {
    const S = await import('../../flashPanel/seedlingSoundSettings.js');
    const saved = {};
    for (const [key, fallback] of [[RUNTIME_KEY, 'auto'], [S.START_SETTING_KEY, 'tests-auto'], [S.SOUND_SETTING_KEY, 'on'], [S.VOLUME_SETTING_KEY, 100]]) {
        try { saved[key] = await settingsManager.getSetting(key, fallback); } catch { saved[key] = fallback; }
    }
    const mount = async (what, ready) => {
        const rulesJson = await (await fetch(PRESET_PATH)).json();
        const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
        tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: PRESET_PATH });
        await loaded;
        await tc.stateManager.pingWorker('after-rules-load', 5000);
        tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
        return tc.pollForValue(() => {
            const p = getActivePanelInstance();
            return p?.transport === 'js' && p.adapter && frameOf(p)?.__seedlingJsSound && ready(p) ? p : null;
        }, what, 30000, 250);
    };
    try {
        // (1) the bypass — the default start mode in an automated run
        await settingsManager.updateSetting(S.START_SETTING_KEY, 'tests-auto', { persist: false });
        await settingsManager.updateSetting(RUNTIME_KEY, 'js', { persist: false });
        const auto = await mount('the panel mounted the JS page and it booted with no ▶ Start', (p) => p._apLoadResult && frameOf(p).__seedlingJsRuntime?.run);
        tc.reportCondition('(1) the bypass: the page booted with no ▶ Start', !!auto);
        if (!auto) return tc.getOverallResult();
        const aw = frameOf(auto);
        tc.assertEqual('(1) no start=click on the URL; the page says auto; the button is gone (a tutorial\'s optional click skips it)', 'false/auto/null',
            `${/start=click/.test(auto.wasmPath)}/${aw.__seedlingJsSound.startMode}/${aw.document.getElementById('btn-start')}`);
        // (3) the rows, live
        const soundRow = auto._settingsControls?.find((c) => c.prop === 'seedlingJsSound');
        const volumeRow = auto._settingsControls?.find((c) => c.prop === 'seedlingJsVolume');
        tc.assertEqual('(3) "Sound" and "Volume" rows are visible on the js runtime', 'flex/flex',
            `${soundRow?.row?.style?.display}/${volumeRow?.row?.style?.display}`);
        await settingsManager.updateSetting(S.VOLUME_SETTING_KEY, 40, { persist: false });
        await settingsManager.updateSetting(S.SOUND_SETTING_KEY, 'off', { persist: false });
        const live = await tc.pollForValue(() => {
            const r = aw.__seedlingJsSound.readout;
            return r.volume === 0.4 && r.on === false ? r : null;
        }, 'the volume and the switch reached the mounted page live', 5000, 50);
        tc.assertEqual('(3) applied live: volume 0.4, sound off, the same page (no re-mount)', '0.4/false/true',
            `${live?.volume}/${live?.on}/${frameOf(auto) === aw}`);
        await settingsManager.updateSetting(S.SOUND_SETTING_KEY, 'on', { persist: false });
        await settingsManager.updateSetting(S.VOLUME_SETTING_KEY, 100, { persist: false });
        // (2) ▶ Start through the panel: the start mode is read at the mount, so re-mount with `click` (the panel's own
        // re-mount, as its dash-shape switches do)
        await settingsManager.updateSetting(S.START_SETTING_KEY, 'click', { persist: false });
        auto._teardownForReinit();
        auto._initializeAdapter();
        const waiting = await tc.pollForValue(() => {
            const p = getActivePanelInstance();
            return p?.transport === 'js' && p.statusElement?.textContent === 'click ▶ Start in the game'
                && frameOf(p) && frameOf(p) !== aw && frameOf(p).__seedlingJsSound ? p : null;
        }, 'the panel re-mounted the JS page and asks for ▶ Start', 30000, 250);
        tc.reportCondition('(2) the panel says "click ▶ Start in the game"', !!waiting);
        if (!waiting) return tc.getOverallResult();
        const ww = frameOf(waiting);
        const button = ww.document.getElementById('btn-start');
        tc.assertEqual('(2) start=click on the URL; ▶ Start shown; not booted (no callbacks, no run)', 'true/true/0/false',
            `${/start=click/.test(waiting.wasmPath)}/${!!button && button.style.display !== 'none'}/`
            + `${Object.keys(ww.__swfBridge.game).length}/${!!ww.__seedlingJsRuntime.run}`);
        installFakeAudio(ww);
        button.click();
        const booted = await tc.pollForValue(() => (waiting._apLoadResult && ww.__seedlingJsRuntime.run ? waiting : null),
            'after ▶ Start the panel finished its AP load into a live run', 30000, 250);
        tc.assertEqual('(2) ▶ Start booted it: a live run, the sound running', 'true/running',
            `${!!booted}/${ww.__seedlingJsSound.readout.state}`);
    } finally {
        for (const [key, value] of Object.entries(saved)) {
            try { await settingsManager.updateSetting(key, value, { persist: false }); } catch { /* best effort */ }
        }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-sound-panel',
    name: 'Seedling JS runtime: the sound settings and ▶ Start in the panel — bypassed in a test run, waited for on `click`, applied live',
    description: 'With flashPanel.runtime = js (session override) and seedling_generated_room loaded: the default start mode boots the '
        + 'page with no ▶ Start in this automated run; the js-only Sound and Volume rows reach the mounted page live; with '
        + 'seedlingJsStart = click the panel asks for ▶ Start and the page waits until it is pressed, then boots to a live run. '
        + 'All settings are restored.',
    testFunction: seedlingJsRuntimeSoundPanel,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ TOUCH CONTROLS (slice `seedling-js-touch-controls`) — the on-screen controls in the real panel, driven by synthetic
 * TOUCH pointer events on the controls (what a finger sends; CSS / layout are the app's own). With
 * `flashPanel.touchControls = on` (a session override) on seedling_generated_room: the controls are mounted with the
 * runtime's buttons (Esc on wasm only) and the Settings row shows; a held d-pad press MOVES the player (its position,
 * as the keyboard moves it) and its release STOPS it (no stuck key); a pointercancel releases too; a second finger on
 * X while the first holds the d-pad reaches the game as a press (js: the run's `slashPresses` ledger, with the sword
 * granted through the AP path; wasm: the keydown/keyup the frame heard). `off` unmounts them; `auto` on this browser
 * shows them exactly when its pointer is coarse. Settings restored however it ends.
 */
const touchControlsRow = (runtime) => async (tc) => {
    const { TOUCH_SETTING_KEY } = await import('../../flashPanel/touchControls.js');
    let previousTouch = 'auto';
    let granted = false;
    try { previousTouch = await settingsManager.getSetting(TOUCH_SETTING_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        return await withRuntimeRestored(tc, async () => {
            await settingsManager.updateSetting(TOUCH_SETTING_KEY, 'on', { persist: false });
            const up = await generatedPresetOn(tc, runtime);
            if (!up) return;
            const { panel, win } = up;
            const touch = await tc.pollForValue(() => panel._touch ?? null, `[${runtime}] the touch controls are mounted`, 10000, 100);
            tc.reportCondition(`[${runtime}] touchControls = on mounts the controls`, !!touch);
            if (!touch) return;
            const root = touch.element;
            const rect = root.getBoundingClientRect();
            const stage = panel.stageElement.getBoundingClientRect();
            tc.log(`[${runtime}] placement ${root.dataset.placement}; controls ${Math.round(rect.width)}×${Math.round(rect.height)} at `
                + `(${Math.round(rect.left)},${Math.round(rect.top)}); stage ${Math.round(stage.width)}×${Math.round(stage.height)} at (${Math.round(stage.left)},${Math.round(stage.top)})`);
            tc.reportCondition(`[${runtime}] the controls are in the document and drawn`, root.isConnected && rect.width > 0 && rect.height > 0);
            const shown = [...root.querySelectorAll('.flash-touch-button')].filter((b) => b.style.display !== 'none').map((b) => b.dataset.button);
            tc.assertEqual(`[${runtime}] the runtime's buttons (Escape on wasm only)`,
                runtime === 'wasm' ? 'primary,secondary,inventory,menu' : 'primary,secondary,inventory', shown.join(','));
            const row = panel._settingsControls?.find((c) => c.prop === 'touchControls') ?? null;
            tc.assertEqual(`[${runtime}] the Settings section shows the "Touch controls" row, set to on`, 'flex/on',
                `${row?.row?.style?.display}/${row?.input?.value}`);

            // ⛓ the player's position, as each runtime reports it
            const lastReport = (name) => {
                const log = win.__swfBridge?.stateLog ?? [];
                for (let i = log.length - 1; i >= 0; i -= 1) if (log[i].name === name) return Number(log[i].value);
                return NaN;
            };
            // ⛔ wasm: the bridge's playerPosition reports LAG the game (measured: unchanged through a 4 s hold); one
            // `botStatus()` per poll reads the player itself (its top-level x / y, `Bot.as` botStatus)
            const game = runtime === 'wasm' ? panel.seedlingPlaybackSurface?.()?.wasm?.getGame?.() ?? null : null;
            const status = () => { try { return JSON.parse(game.botStatus()); } catch { return null; } };
            const pos = () => {
                if (runtime === 'js') return { x: up.rt.run?.state?.x, y: up.rt.run?.state?.y };
                const st = status();
                return st ? { x: Number(st.x), y: Number(st.y) } : { x: lastReport('playerPositionX'), y: lastReport('playerPositionY') };
            };
            const POLL_MS = runtime === 'js' ? 50 : 200;
            if (game) {
                const st = status();
                tc.log(`[wasm] botStatus keys ${Object.keys(st ?? {}).join(',')}; level ${st?.level} x ${st?.x} y ${st?.y}`);
            }
            const keysHeard = [];
            const hear = (e) => { if (e.code) keysHeard.push(`${e.type}:${e.code}`); };
            win.addEventListener('keydown', hear, true);
            win.addEventListener('keyup', hear, true);
            const pad = root.querySelector('.flash-touch-dpad');
            const point = (el, fx = 0.5, fy = 0.5) => {
                const r = el.getBoundingClientRect();
                return { clientX: r.left + r.width * fx, clientY: r.top + r.height * fy };
            };
            const DIR_AT = { right: [0.85, 0.5], left: [0.15, 0.5], down: [0.5, 0.85], up: [0.5, 0.15] };
            const finger = (type, el, id, at) => el.dispatchEvent(new PointerEvent(type, {
                pointerId: id, pointerType: 'touch', isPrimary: id === 1, bubbles: true, cancelable: true, ...point(el, ...at),
            }));
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            try {
                // a press and hold on the d-pad moves the player; its release stops it
                let moved = null;
                for (const dir of ['right', 'left', 'down', 'up']) {
                    const p0 = pos();
                    finger('pointerdown', pad, 1, DIR_AT[dir]);
                    // eslint-disable-next-line no-await-in-loop
                    const p1 = await tc.pollForValue(() => {
                        const p = pos();
                        return Math.abs(p.x - p0.x) + Math.abs(p.y - p0.y) >= 8 ? p : null;
                    }, `[${runtime}] the player moves ${dir} while the d-pad is held`, runtime === 'js' ? 4000 : 8000, POLL_MS);
                    finger('pointerup', pad, 1, DIR_AT[dir]);
                    tc.log(`[${runtime}] d-pad ${dir}: ${JSON.stringify(p0)} → ${JSON.stringify(p1 ?? pos())}; heard ${keysHeard.slice(-2).join(' ')}`);
                    if (p1) { moved = dir; break; }
                }
                tc.reportCondition(`[${runtime}] a held d-pad press moved the player (${moved})`, !!moved);
                tc.assertEqual(`[${runtime}] the d-pad sent the keyboard's own keydown/keyup pair`, true,
                    keysHeard.some((k) => k.startsWith('keydown:Arrow')) && keysHeard.some((k) => k.startsWith('keyup:Arrow')));
                await wait(1500); // friction's decay ends inside this (the wasm page ticks slowly headless)
                const s0 = pos();
                await wait(600);
                const s1 = pos();
                // ⛓ NO STUCK KEY = nothing the controls hold AND nothing the game heard go down without its up (the host's
                // F3 tracker, `gameInput.createHeldKeyRelease`). The stand-still is asserted on js (measured 0.00 px); on
                // the slow headless wasm page friction's tail still moved the player 0.95 px 1.5 s after a release, so
                // there it is logged, not graded.
                const drift = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
                tc.log(`[${runtime}] after the release: ${JSON.stringify(s0)} → ${JSON.stringify(s1)} (drift ${drift(s0, s1).toFixed(2)} px)`);
                tc.assertEqual(`[${runtime}] released: no key held by the controls or by the game`, '/',
                    `${root.dataset.held}/${panel._heldKeys.held().join(',')}`);
                if (runtime === 'js') tc.assertEqual('[js] released: the player stands still', true, drift(s0, s1) === 0);

                // ⛔ a pointercancel releases (the browser took the gesture)
                if (moved) {
                    finger('pointerdown', pad, 3, DIR_AT[moved]);
                    await wait(150);
                    const held = root.dataset.held;
                    finger('pointercancel', pad, 3, DIR_AT[moved]);
                    tc.assertEqual(`[${runtime}] pointercancel releases the held arrow`, `true/`, `${held.startsWith('Arrow')}/${root.dataset.held}`);
                    await wait(1500);
                    const c0 = pos();
                    await wait(500);
                    const c1 = pos();
                    tc.log(`[${runtime}] after the cancel: ${JSON.stringify(c0)} → ${JSON.stringify(c1)}`);
                    tc.assertEqual(`[${runtime}] after the cancel: no key held by the game`, '', panel._heldKeys.held().join(','));
                    if (runtime === 'js') tc.assertEqual('[js] after the cancel the player stands still', true, drift(c0, c1) === 0);
                }

                // two fingers: the d-pad held, X tapped
                if (runtime === 'js') {
                    await tc.stateManager.addItemToInventory('Progressive Sword', 1);
                    granted = true;
                    await tc.stateManager.pingWorker('after-item-grant', 5000);
                    const armed = await tc.pollForCondition(() => up.rt.run?.inventory?.hasSword === true || up.rt.run?.state?.inventory?.hasSword === true,
                        '[js] the sword reached the run (the AP path)', 10000, 100);
                    if (!armed) tc.log(`[js] run inventory: ${JSON.stringify(up.rt.run?.inventory ?? null)?.slice(0, 300)}`, 'warn');
                }
                const swings0 = runtime === 'js' ? up.rt.run?.slashPresses?.length ?? 0 : 0;
                const heard0 = keysHeard.length;
                const xBtn = root.querySelector('.flash-touch-button-primary');
                finger('pointerdown', pad, 1, DIR_AT[moved ?? 'down']);
                await wait(120);
                finger('pointerdown', xBtn, 2, [0.5, 0.5]);
                await wait(120);
                const both = root.dataset.held;
                finger('pointerup', xBtn, 2, [0.5, 0.5]);
                await wait(120);
                finger('pointerup', pad, 1, DIR_AT[moved ?? 'down']);
                tc.assertEqual(`[${runtime}] two fingers hold an arrow and X at once`, true, /Arrow/.test(both) && /KeyX/.test(both));
                tc.assertEqual(`[${runtime}] X came down and up once, inside the arrow's hold`, 'keydown:KeyX,keyup:KeyX',
                    keysHeard.slice(heard0).filter((k) => k.endsWith('KeyX')).join(','));
                if (runtime === 'js') {
                    const swung = await tc.pollForValue(() => {
                        const n = up.rt.run?.slashPresses?.length ?? 0;
                        return n > swings0 ? up.rt.run.slashPresses.at(-1) : null;
                    }, '[js] the X tap reached the run as a sword press', 3000, 50);
                    tc.reportCondition(`[js] the X button swings (slashPresses ${swings0} → +1, outcome ${swung?.outcome ?? 'none'})`, !!swung);
                }
                tc.assertEqual(`[${runtime}] all fingers up: nothing held`, '', root.dataset.held);
            } finally {
                touch.releaseAll();
                win.removeEventListener('keydown', hear, true);
                win.removeEventListener('keyup', hear, true);
            }

            // off unmounts; auto follows this browser's pointer
            await settingsManager.updateSetting(TOUCH_SETTING_KEY, 'off', { persist: false });
            const gone = await tc.pollForCondition(() => !panel._touch && !root.isConnected, `[${runtime}] off unmounts the controls`, 5000, 50);
            tc.reportCondition(`[${runtime}] touchControls = off: no controls in the document`, !!gone);
            await settingsManager.updateSetting(TOUCH_SETTING_KEY, 'auto', { persist: false });
            await wait(200);
            const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
            const urlTouch = new URLSearchParams(location.search).get('touch');
            tc.log(`[${runtime}] auto: pointer coarse ${coarse}; ?touch=${urlTouch}`);
            if (urlTouch === null) {
                tc.assertEqual(`[${runtime}] auto shows the controls exactly when the pointer is coarse (${coarse ? 'coarse' : 'fine'})`,
                    coarse, !!panel._touch);
            }
            assertNoDeathNoHalt(tc, runtime, up.rt);
        });
    } finally {
        if (granted) { try { await tc.stateManager.removeItemFromInventory('Progressive Sword', 1); } catch { /* best effort */ } }
        try { await settingsManager.updateSetting(TOUCH_SETTING_KEY, previousTouch, { persist: false }); } catch { /* best effort */ }
    }
};

export const seedlingJsRuntimeTouchControls = touchControlsRow('js');
export const seedlingWasmRuntimeTouchControls = touchControlsRow('wasm');

const TOUCH_DESCRIPTION = (runtime) => `With flashPanel.runtime = ${runtime} and touchControls = on (session overrides) on `
    + 'seedling_generated_room: the on-screen controls mount with the runtime\'s buttons; a held d-pad touch moves the '
    + 'player and its release (and a pointercancel) stops it; a second finger on X while the d-pad is held reaches the '
    + 'game as one keydown/keyup (js: a sword press in the run\'s ledger); off unmounts them; auto follows the pointer.';

for (const [id, name, fn] of [
    ['seedling-js-runtime-touch-controls',
        'Seedling JS runtime: the touch controls — a held d-pad moves, release stops, X swings, off / auto hide them',
        seedlingJsRuntimeTouchControls],
    ['seedling-wasm-runtime-touch-controls',
        'Seedling (wasm runtime): the touch controls — a held d-pad moves, release stops, X reaches the game',
        seedlingWasmRuntimeTouchControls],
]) {
    registerTest({
        id, name, description: TOUCH_DESCRIPTION(id.startsWith('seedling-js') ? 'js' : 'wasm'),
        testFunction: fn,
        category: seedlingRuntimeCategory(id),
        enabled: false, // off by default — runs only in the test-substrates mode
    });
}

/**
 * ⛓ ONE FADE PER CROSSING — the user (2026-10-26): "in js mode, it does a double fade on every room transition. It
 * doesn't do that in wasm mode." With flashPanel.runtime = js and the seedling graphics stack, the Playback Bot walks
 * seedling_atlas's real rooms (into the starting house, out, down the owl's-nest stairs and into the dungeon). The
 * region binding answers each door with an arrival teleport on the frame it reads the door; before the fix that
 * teleport waited out the door's held fade and faded in from black again. A sampler inside the page records, every
 * animation frame, the black cover the paint drew (`__seedlingJsGraphics.effects.screen`), the dead frames held and
 * the crossings so far. The pin: each crossing's stretch has exactly ONE rise of the cover, never rises again, holds
 * exactly the game's 20 dead frames, and the host's teleport did land inside it. The fresh start is LOGGED (the
 * arrival's boot tick: 0 = it landed inside L0's own fade), not asserted: when the host's load lands is its own.
 */
export async function seedlingJsRuntimeGraphicsOneFadePerCrossing(tc) {
    let previous = 'auto';
    let previousGraphics = 'rects';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousGraphics = await settingsManager.getSetting(GRAPHICS_SETTING_KEY, 'rects'); } catch { /* keep rects */ }
    let stopSampling = () => {};
    try {
        await settingsManager.updateSetting(GRAPHICS_SETTING_KEY, 'seedling', { persist: false });
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, win } = up;
        const g = await tc.pollForValue(() => (win.__seedlingJsGraphics?.status === 'ready' ? win.__seedlingJsGraphics : null),
            'the JS page loaded the seedling graphics stack', 20000, 200);
        tc.reportCondition('the graphics stack is up', !!g);
        if (!g) return tc.getOverallResult();
        const trace = [];
        let lastFrame = -1;
        let on = true;
        stopSampling = () => { on = false; };
        const sample = () => {
            if (!on) return;
            if (g.frames !== lastFrame) {
                lastFrame = g.frames;
                const black = (g.effects?.screen ?? []).find((o) => o.colour === '#000000');
                trace.push({ cover: black ? +black.alpha.toFixed(4) : 0, held: g.held,
                    crossings: rt.events.filter((e) => e.type === 'transition').length,
                    boots: rt.events.filter((e) => e.type === 'boot').length });
            }
            win.requestAnimationFrame(sample);
        };
        win.requestAnimationFrame(sample);
        const start = await tc.pollForValue(() => (bot.getCurrentRegion?.() === 'overworld_start__r8c0' && rt.run?.level === 0 ? rt : null),
            'the bot and the page are in the start region (overworld_start__r8c0, level 0)', 15000, 200);
        tc.reportCondition('the bot starts in overworld_start__r8c0 on level 0', !!start);
        if (!start) return tc.getOverallResult();
        const bootTicks = rt.events.filter((e) => e.type === 'boot').map((e) => `${e.t ?? '?'}:${e.why}`);
        tc.log(`the fresh start: boots ${JSON.stringify(bootTicks)} (an arrival at tick 0 landed inside L0's own fade); held ${g.held}`);

        bot.walkToLocation(CHEST_LOCATION);
        const chest = await tc.pollForCondition(() => snapshotFacts(tc).checked.has(CHEST_LOCATION) || errorStatuses(bot).length > 0,
            `the bot walked into the starting house and checked "${CHEST_LOCATION}"`, 60000, 250);
        tc.reportCondition('the chest was checked', !!chest && snapshotFacts(tc).checked.has(CHEST_LOCATION));
        bot.walkToTile('dungeon1_room1__r0c4', 4, 3);
        const deep = await tc.pollForCondition(() => walkedRegions().includes('dungeon1_room1__r0c4') || errorStatuses(bot).length > 0,
            'the bot routed into dungeon1_room1__r0c4', 60000, 250);
        tc.reportCondition('the dungeon was reached', !!deep);
        // the last crossing's fade has played out
        await tc.pollForCondition(() => !g.effects?.owed && !g.effects?.cover, 'the last fade has played out', 10000, 100);
        stopSampling();

        const FADE = Array.from({ length: 20 }, (_, k) => +Math.max(1 - 0.05 * (k + 1), 0).toFixed(4));
        const parts = [];
        for (let i = 1; i < trace.length; i += 1) {
            if (trace[i].crossings > trace[i - 1].crossings) parts.push([]);
            if (parts.length) parts.at(-1).push(trace[i]);
        }
        tc.assertEqual('the sampler saw the four crossings (house in, out, the stairs down, the dungeon)', 4, parts.length);
        for (const [k, part] of parts.entries()) {
            let rises = 0;
            let prev = 0;
            for (const r of part) { if (r.cover > prev) rises += 1; prev = r.cover; }
            const held = part.at(-1).held - part[0].held;
            tc.log(`crossing ${k + 1}: rises ${rises}, held ${held}, boots +${part.at(-1).boots - part[0].boots}, covers ${JSON.stringify([...new Set(part.map((r) => r.cover))])}`);
            tc.assertEqual(`crossing ${k + 1}: the host's arrival teleport landed inside it (not vacuous)`, true, part.at(-1).boots > part[0].boots);
            tc.assertEqual(`crossing ${k + 1}: ONE fade (the cover rose once)`, 1, rises);
            tc.assertEqual(`crossing ${k + 1}: the cover never rose again (one monotone ramp)`, true,
                part.every((r, i) => i === 0 || r.cover <= part[i - 1].cover));
            tc.assertEqual(`crossing ${k + 1}: the game's 20 dead frames were held, once`, 20, held);
            tc.assertEqual(`crossing ${k + 1}: every cover drawn is one of the game's 1 − 0.05k`, true,
                part.every((r) => r.cover === 1 || r.cover === 0 || FADE.includes(r.cover)));
        }
        tc.assertEqual('no error: status, no death, no halt', '[]/0/null',
            `${JSON.stringify(errorStatuses(bot))}/${rt.deaths.length}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        stopSampling();
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(GRAPHICS_SETTING_KEY, previousGraphics, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-one-fade-per-crossing',
    name: 'Seedling JS runtime: ONE fade per room crossing (the host\'s arrival teleport lands inside the door\'s fade)',
    description: 'flashPanel.runtime = js with the seedling graphics stack on seedling_atlas: the Playback Bot walks four real '
        + 'crossings while a sampler records the black cover each animation frame drew. Each crossing shows exactly one '
        + 'monotone ramp of the game\'s 1 − 0.05k covers over 20 held dead frames, and the host\'s arrival teleport lands '
        + 'inside it (before the fix every crossing faded in twice). No error: status, death or halt.',
    testFunction: seedlingJsRuntimeGraphicsOneFadePerCrossing,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ GRAPHICS G10 — the bosses in a real browser (the user's sighting: L19's ShieldBoss, beside the red key): the standalone
 * page driven to `Game(19, 104, 96)` — inside the ShieldBoss's stand-under band, so after 120 updates it moves its shield
 * and stabs. The boss is drawn from the seedling pack as its class (`seedlingBossSkin`), sitting and then stabbing, and its
 * build-time rectangle is gone. No panel, preset or AP state is touched; the iframe is removed however the row ends.
 */
export async function seedlingJsRuntimeGraphicsBosses(tc) {
    const frame = document.createElement('iframe');
    const errors = [];
    try {
        const win = await bootGraphicsPage(tc, frame, errors, [19, 104, 96]);
        if (!win) return tc.getOverallResult();
        const g = win.__seedlingJsGraphics;
        const rt = win.__seedlingJsRuntime;
        const frames = new Set();
        const stabbed = await tc.pollForValue(() => {
            for (const o of g.bosses?.ops ?? []) if (o.key === 'seedling:boss/shieldboss') frames.add(o.frame);
            return rt.run?.level === 19 && [3, 4, 5, 6, 7, 8].some((f) => frames.has(f)) ? g.bosses : null;
        }, 'level 19: the ShieldBoss drawn sitting, then stabbing', 20000, 50);
        tc.log(`bosses: ${JSON.stringify(stabbed)} frames seen ${JSON.stringify([...frames].sort((a, b) => a - b))}`);
        tc.assertEqual('one ShieldBoss in the room', 1, stabbed?.shieldBosses ?? 0);
        tc.assertEqual('drawn sitting (frame 0) before the stab', true, frames.has(0));
        tc.assertEqual('drawn stabbing (a frame of [3..8])', true, [3, 4, 5, 6, 7, 8].some((f) => frames.has(f)));
        tc.assertEqual('from the seedling pack', 'seedling', [...new Set((stabbed?.ops ?? []).map((o) => o.pack))].join(','));
        tc.assertEqual('its build-time rectangle is no longer painted', 0, stabbed?.standIns ?? -1);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run is in level 19 and did not halt', '19/null', `${rt.run?.level}/${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-graphics-bosses',
    name: 'Seedling JS runtime: the ShieldBoss drawn as its class, sitting then stabbing (G10)',
    description: 'Mounts jsRuntime.html?graphics=seedling standalone in its own iframe, drives it to level 19 inside the '
        + 'ShieldBoss\'s stand-under band through its own __swfBridge, and asserts the boss is drawn from the seedling pack '
        + 'sitting and then stabbing, its build-time rectangle is gone, every sheet decodes, and no console error. Touches no '
        + 'panel, preset or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeGraphicsBosses,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ MUSIC (slice `seedling-js-music`, ⚖ the user 2026-10-26 / GO 2026-10-27) — the JS page's music, standalone.
 * `jsRuntime.html?start=click` with a fake AudioContext (the sound rows' `installFakeAudio`): ▶ Start boots it and
 * unlocks the music too. Put into level 46 (the vanilla twin's song 9, Cold Blooded), the music's target is that song
 * and the mixer fades it in as the background; the track is decoded and STARTED (its bytes reach the context). A
 * room change to level 38 (song 8, Mysterious Magic) switches the target and the mixer (old out, new in). Music off
 * (`__seedlingJsSound.set({ music: false })`, what the panel's row calls) silences it LIVE: nothing sounds, the
 * mixer keeps its place; on again, the same song sounds again. The iframe is removed however the row ends.
 */
export async function seedlingJsRuntimeMusic(tc) {
    const frame = document.createElement('iframe');
    const errors = [];
    try {
        Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '480px', height: '480px',
            opacity: '0.01', pointerEvents: 'none', border: '0' });
        frame.src = './modules/seedlingDemo/jsRuntime.html?start=click';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime && w.__seedlingJsSound ? w : null;
        }, 'the standalone JS page is up (?start=click)', 20000, 200);
        tc.reportCondition('the standalone page is up', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        const sound = win.__seedlingJsSound;
        const music = () => sound.readout.music;
        const ready = await tc.pollForValue(() => (music().loaded === 'ready' && music().rooms > 0 ? music() : null),
            'the music manifest and the vanilla room table loaded (no audio needed)', 15000, 100);
        tc.assertEqual('before ▶ Start: the music manifest and the 116 vanilla rooms are read; the audio is locked', '116/locked',
            `${ready?.rooms}/${sound.readout.state}`);
        const starts = installFakeAudio(win);
        win.document.getElementById('btn-start').click();
        tc.assertEqual('▶ Start unlocks the one output (the music shares it)', 'running', sound.readout.state);
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        const goTo = (level, x, y) => win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
        const COLD = 'seedling:music/cold-blooded';
        const MAGIC = 'seedling:music/mysterious-magic';
        goTo(46, 240, 448);
        const playing = await tc.pollForValue(() => {
            const m = music();
            return win.__seedlingJsRuntime.run?.level === 46 && m.mixer?.bkgd === COLD && m.player?.sounding.includes(COLD) ? m : null;
        }, 'level 46 plays Cold Blooded: the target, the background, a sounding source', 20000, 100);
        tc.log(`music @L46: ${JSON.stringify({ target: playing?.target, mixer: playing?.mixer, player: playing?.player })}`);
        tc.assertEqual('level 46: the target is its song (Game.as:1233) and it is the background', `song ${COLD}/${COLD}`,
            `${playing?.target?.op} ${playing?.target?.key}/${playing?.mixer?.bkgd}`);
        tc.assertEqual('the track reached the context (Cold Blooded.mp3, 419796 bytes)', true, starts.some((s) => s.bytes === 419796));
        goTo(38, 208, 224);
        const switched = await tc.pollForValue(() => {
            const m = music();
            return win.__seedlingJsRuntime.run?.level === 38 && m.mixer?.bkgd === MAGIC && m.player?.sounding.includes(MAGIC)
                && !m.player.sounding.includes(COLD) ? m : null;
        }, 'the room change to level 38 switches to Mysterious Magic (Cold Blooded faded out)', 20000, 100);
        tc.assertEqual('level 38: the target, the background and the one sounding source are Mysterious Magic', `${MAGIC}/${MAGIC}/${MAGIC}`,
            `${switched?.target?.key}/${switched?.mixer?.bkgd}/${switched?.player?.sounding.join(',')}`);
        tc.assertEqual('the new track reached the context (Mysterious Magic.mp3, 574808 bytes)', true, starts.some((s) => s.bytes === 574808));
        sound.set({ music: false });
        const silent = music();
        tc.assertEqual('Music off, LIVE: nothing sounds; the mixer keeps its song (the logic runs on)', `false/0/${MAGIC}`,
            `${silent.on}/${silent.player.sounding.length}/${silent.mixer.bkgd}`);
        // (the sound effects play on — the L38 pulser — so count the MUSIC player's starts, not the context's)
        const n = music().player.starts;
        await new Promise((r) => setTimeout(r, 500));
        tc.assertEqual('while off, no track is started', n, music().player.starts);
        sound.set({ music: true });
        const back = await tc.pollForValue(() => (music().player.sounding.includes(MAGIC) ? music() : null), 'Music on again: the song sounds again', 5000, 50);
        tc.assertEqual('Music on again: the same song sounds again, from the mixer\'s place', true, !!back && back.player.starts > n);
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-music',
    name: 'Seedling JS runtime: the music — the room\'s song plays, a room change switches it, Music off silences it live (fake AudioContext)',
    description: 'Mounts jsRuntime.html?start=click standalone with a fake AudioContext. ▶ Start unlocks the output; in level 46 '
        + 'the target and the background are Cold Blooded and its track is started; a change to level 38 switches to Mysterious '
        + 'Magic; Music off silences it live with the mixer keeping its place; on again it sounds again. Touches no panel, '
        + 'preset or AP state.',
    testFunction: seedlingJsRuntimeMusic,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ ENCOUNTER LEGS (slice `seedling-js-encounter-legs`) — the Playback Bot, on the vanilla arm in js mode with the
 * solver ON, asks for "Level 032 - Bob Boss" BY NAME; the JS page walks the solver's `encounter` executor (the fight,
 * the dialogue, the Fire drop collected) and the leg completes on the encounter's own report clear {32,4}
 * (`Pickups/Fire.as:49-55`), checked in the state manager by the load's check binding. The sword and the shield come
 * through the AP item path (removed after); the page is teleported to L32 @ (72,120), `apb-l32-fresh-no-fire`'s boot.
 */
const BOB_ENCOUNTER = Object.freeze({ location: 'Level 032 - Bob Boss', boot: [32, 72, 120], drop: { level: 32, tag: 4 },
    kill: { level: 32, tag: 3 },
    // ⛔ The state manager checks only an ACCESSIBLE location (measured: without the keys, "checkLocation failed for
    // \"Level 032 - Bob Boss\": … not_accessible" — the teleport skips the route). The fewest items the playthrough
    // rules need for level_32 (a BFS over its exits, greedily reduced): the sword, the Green and the Red key; the
    // shield is the fight's (`apb-l32-fresh-no-fire`'s staging holds it).
    grants: Object.freeze(['Progressive Sword', 'Green Key', 'Red Key', 'Progressive Shield']) });

export async function seedlingJsRuntimeSolverFightsBobEncounter(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    let rt = null;
    const granted = [];
    try {
        await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
        const ready = await botOnLargeSeedlingPreset(tc, PLAYTHROUGH_PATH);
        if (!ready) return tc.getOverallResult();
        const { bot, panel } = ready;
        const bound = await tc.pollForValue(() => (panel._apLoadResult && panel.seedlingPlaybackSurface()?.atlas ? panel : null),
            'the panel finished its AP load and holds the name → goal map', 30000, 250);
        tc.reportCondition('the panel\'s AP load finished', !!bound);
        const entry = (panel.seedlingPlaybackSurface()?.atlas?.entries ?? []).find((e) => e.location === BOB_ENCOUNTER.location) ?? null;
        tc.assertEqual('the map binds the Bob Boss ENCOUNTER (drop Fire)', 'encounter|Fire', `${entry?.kind}|${entry?.drop?.item}`);
        if (!bound || !entry) return tc.getOverallResult();
        rt = await tc.pollForValue(() => {
            const r = frameOf(panel)?.__seedlingJsRuntime ?? null;
            return r?.run && r.vanilla ? r : null;
        }, 'the JS runtime page is running a room of the vanilla map', 15000, 200);
        tc.reportCondition('the JS page runs the vanilla map', !!rt);
        if (!rt) return tc.getOverallResult();
        const win = frameOf(panel);
        const isCleared = ({ level, tag }) => (JSON.parse(rt.game.botStatus()).persistence_cleared ?? [])
            .some((c) => c.level === level && c.tag === tag);
        tc.assertEqual('fresh game: {32,4} unset and the location unchecked', 'false/false',
            `${isCleared(BOB_ENCOUNTER.drop)}/${snapshotFacts(tc).checked.has(BOB_ENCOUNTER.location)}`);
        const pushed = await tc.pollForCondition(() => rt.playback.solverWalk === true,
            'the setting reached the JS page (playback.solverWalk)', 5000, 100);
        tc.reportCondition('the page is in solver mode', !!pushed);

        for (const item of BOB_ENCOUNTER.grants) {
            await tc.stateManager.addItemToInventory(item, 1);
            granted.push(item);
        }
        await tc.stateManager.pingWorker('after-item-grant', 5000);
        const armed = await tc.pollForCondition(() => rt.flags?.hasSword === true && rt.flags?.hasShield === true,
            'the host delivered the sword and the shield to the page', 10000, 100);
        tc.reportCondition('the page holds the sword and the shield', !!armed);
        if (!armed) return tc.getOverallResult();
        // ⛔ A grant's in-place reboot can be DEFERRED (`jsRuntimeCore`'s `deferredReboot`, past a ceremony / dead
        // frames) and land after the teleport — measured: "boot level 32 at (72, 109.85) — an item flag changed"
        // refuted the first plan (2/0/1). So the row waits for the page's boots to go quiet, before and after.
        const quiet = (what) => {
            let seen = -1;
            let since = 0;
            return tc.pollForCondition(() => {
                const n = rt.events.filter((e) => e.type === 'boot').length;
                if (n !== seen) { seen = n; since = Date.now(); return false; }
                return Date.now() - since >= 2000;
            }, what, 20000, 100);
        };
        tc.reportCondition('the grants\' reboots settled', !!(await quiet('no page boot for 2 s after the grants')));
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [...BOB_ENCOUNTER.boot] }]);
        const there = await tc.pollForCondition(() => rt.run?.level === 32 && rt.flags?.hasSword === true,
            'the page is in level 32 with the sword', 10000, 100);
        tc.reportCondition('teleported into level 32', !!there);
        if (!there) return tc.getOverallResult();
        tc.reportCondition('the teleport settled', !!(await quiet('no page boot for 2 s after the teleport')));
        tc.assertEqual('… still in level 32', 32, rt.run?.level ?? null);

        const checksBefore = reportedChecks(win).length;
        bot._publishWalkTo({ kind: 'location', name: BOB_ENCOUNTER.location });
        const accepted = await tc.pollForCondition(() => rt.playback.goal?.encounter?.drop?.item === 'Fire',
            'the page took the ENCOUNTER goal (it used to refuse it: "walked on the wasm runtime")', 10000, 100);
        tc.assertEqual('the page accepted the ENCOUNTER goal', true, !!accepted);
        if (!accepted) {
            tc.log(`controller refusal: ${JSON.stringify(bot._resolveController?.()?.lastRefusal ?? null)}`, 'error');
            return tc.getOverallResult();
        }
        const s = await settledSolverWalk(tc, rt, 240000);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
        tc.assertEqual('the walk is DONE', 'done', rt.playback.state);
        tc.assertEqual('… on the drop\'s report clear {32,4}, after the kill {32,3}', 'true/true',
            `${isCleared(BOB_ENCOUNTER.drop)}/${isCleared(BOB_ENCOUNTER.kill)}`);
        tc.assertEqual('the SOLVER drove it: solved once, no decline, no refutation', '1/0/0',
            `${s.solves}/${s.declines}/${s.refutations}`);
        tc.assertEqual('the solver goal was the Fire encounter', 'encounter|Fire', `${s.lastSolve?.goal?.kind}|${s.lastSolve?.goal?.drop?.item}`);
        tc.assertEqual('the drop\'s clear was reported once as pendingCheck <seq>|32|4|0', 1,
            reportedChecks(win).slice(checksBefore).filter((c) => c.level === 32 && c.tag === 4).length);
        const checked = await tc.pollForCondition(() => snapshotFacts(tc).checked.has(BOB_ENCOUNTER.location),
            `"${BOB_ENCOUNTER.location}" is checked in the state manager`, 10000, 100);
        tc.assertEqual('the Bob Boss location is checked', true, !!checked);
        if (!checked) {
            const cb = getSeedlingRegionGlue()?.checkBinding ?? null;
            tc.log(`check binding: ${JSON.stringify({ stats: cb?.stats ?? null, entry: cb?.table?.get?.('32:4') ?? cb?.table?.get?.('32|4') ?? null,
                keys: cb ? [...(cb.table?.keys?.() ?? [])].filter((k) => String(k).startsWith('32')) : null,
                checked: cb ? [...(cb.checked ?? [])] : null, unearned: cb ? [...(cb.unearned ?? [])] : null })}`, 'error');
            tc.log(`reported: ${JSON.stringify(reportedChecks(win).slice(checksBefore))}`, 'error');
        }
        tc.assertEqual('no error: status at any point', '[]', JSON.stringify(errorStatuses(bot)));
    } finally {
        for (const item of granted) { try { await tc.stateManager.removeItemFromInventory(item, 1); } catch { /* best effort */ } }
        try { rt?.playback.reset(); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-fights-bob-encounter',
    name: 'Seedling JS runtime: the solver mode walks the L32 Bob Boss ENCOUNTER to its drop\'s report {32,4}',
    description: 'With flashPanel.runtime = js and the solver mode ON, on seedling_playthrough (the vanilla arm): the '
        + 'sword, shield and the Green/Red keys (level_32\'s logical access) granted through the AP item path (removed '
        + 'after), the page teleported to L32 @ (72,120), and '
        + 'the Playback Bot asks for "Level 032 - Bob Boss" by name. The page walks the solver\'s encounter executor (it '
        + 'used to refuse every encounter: "walked on the wasm runtime"); the leg completes on the Fire drop\'s report '
        + 'clear {32,4} (one pendingCheck <seq>|32|4|0) and the location is checked. 0 HALT, solved 1/0/0.',
    testFunction: seedlingJsRuntimeSolverFightsBobEncounter,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓ seedling-js-inventory-menu — THE V MENU ON THE PAGE, G3's shape: the JS page mounted STANDALONE in this row's
 * own iframe, driven through its own `__swfBridge` to `Game(86, 56, 56)` holding Fire and the sword (slots [1, 0],
 * so `firstUse`), then by REAL keyboard events (the page's own `keydown`/`keyup` handlers): V opens, Down, X equips,
 * V closes. No panel, preset or AP state is touched; the iframe is removed however the row ends.
 *
 * It asserts what node cannot: the keys reach the core through the page, the menu's panel is DRAWN from the
 * seedling pack (`seedling:ui/inventory` in the screen ops, every sheet decoded), the tape never advances while it
 * is up, and the X write lands (`run.primary` 1, one `inventoryHolds` row).
 */
export async function seedlingJsRuntimeInventoryMenu(tc) {
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '160px', height: '160px',
        opacity: '0.01', pointerEvents: 'none', border: '0' });
    const errors = [];
    try {
        frame.src = './modules/seedlingDemo/jsRuntime.html?graphics=seedling&camera=follow';
        document.body.appendChild(frame);
        const win = await tc.pollForValue(() => {
            const w = frame.contentWindow;
            return w?.__runtimeReady && w.__seedlingJsRuntime?.vanilla && w.__seedlingJsGraphics?.status === 'ready' ? w : null;
        }, 'the standalone JS page loaded the vanilla map and the seedling pack stack', 20000, 200);
        tc.reportCondition('the standalone page is up with its pack', !!win);
        if (!win) return tc.getOverallResult();
        const origError = win.console.error.bind(win.console);
        win.console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
        win.addEventListener('error', (e) => errors.push(`uncaught: ${e.message}`));
        const game = await (await fetch('./modules/flashPanel/games/seedling.json')).json();
        win.__swfBridge.game.configure(JSON.stringify({ classes: game.classes, state_properties: game.state_properties }));
        win.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [86, 56, 56] }]);
        const rt = win.__seedlingJsRuntime;
        await tc.pollForValue(() => (rt.run?.level === 86 ? true : null), 'the run booted level 86', 10000, 50);
        win.__swfBridge.queueItems([{ class: 'Main', property: 'hasFire', value: true }]);
        await tc.pollForValue(() => (rt.run?.inventorySlots?.length === 1 ? true : null), 'Fire is in the slots', 5000, 50);
        win.__swfBridge.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
        const armed = await tc.pollForValue(() => (rt.run?.inventorySlots?.length === 2 && rt.run.inventoryOpenable ? true : null),
            'Fire then the sword: two slots, the menu openable', 5000, 50);
        tc.reportCondition(`the menu can open in level 86 (${rt.run?.inventoryRefusal ?? 'openable'})`, !!armed);
        if (!armed) return tc.getOverallResult();
        const doc = frame.contentDocument;
        // Each phase is held until the page has run TWO more frames (a live tick, or a held frame while the menu is
        // up), so a down/up pair can never fall between two frames however the iframe is scheduled.
        const frameCount = () => rt.ticks + (rt.inventoryMenu?.heldFrames ?? 0) * 1e6;
        const twoFrames = async (what) => {
            const seen = new Set([frameCount()]);
            await tc.pollForValue(() => { seen.add(frameCount()); return seen.size >= 3 ? true : null; }, what, 5000, 10);
        };
        const press = async (code) => {
            doc.dispatchEvent(new win.KeyboardEvent('keydown', { code, bubbles: true }));
            await twoFrames(`${code} held for two frames`);
            doc.dispatchEvent(new win.KeyboardEvent('keyup', { code, bubbles: true }));
            await twoFrames(`${code} released for two frames`);
        };
        await press('KeyV');
        const open = await tc.pollForValue(() => (rt.inventoryMenu.open ? true : null), 'V opened the menu', 3000, 20);
        tc.reportCondition('V opened the inventory menu', !!open);
        const t0 = rt.run.ticksCompleted;
        const g = win.__seedlingJsGraphics;
        const drawn = await tc.pollForValue(() => ((g.effects?.screen ?? []).some((o) => o.key === 'seedling:ui/inventory') ? true : null),
            'the panel is drawn from the pack', 3000, 20);
        tc.reportCondition('the menu panel is drawn as seedling:ui/inventory', !!drawn);
        await press('ArrowDown');
        await press('KeyX');
        await press('KeyV');
        const closed = await tc.pollForValue(() => (!rt.inventoryMenu.open ? true : null), 'V closed the menu', 3000, 20);
        tc.reportCondition('V closed the inventory menu', !!closed);
        const holds = rt.run.inventoryHolds;
        tc.assertEqual('the tape did not advance while the menu was up (one hold, at the opening tick)', `1/${t0}`,
            `${holds.length}/${holds[0]?.t}`);
        tc.assertEqual('X equipped the selected slot (the sword, slot 1)', '1/0', `${rt.run.primary}/${rt.run.inventorySlots[rt.run.primary]}`);
        tc.assertEqual('every sheet decoded (none fell back to rectangles)', '[]', JSON.stringify(g.failedSheets));
        tc.assertEqual('no console error on the page', '[]', JSON.stringify(errors));
        tc.assertEqual('the run did not halt', 'null', `${rt.halted ? rt.halted.message : null}`);
    } finally {
        frame.remove();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-inventory-menu',
    name: 'Seedling JS runtime: the V inventory menu (open, select, equip, close)',
    description: 'Mounts jsRuntime.html?graphics=seedling&camera=follow standalone in its own iframe, drives it to level 86 '
        + 'holding Fire and the sword, then presses V, Down, X, V as keyboard events: the menu opens and is drawn from the '
        + 'seedling pack, the tape holds while it is up, X equips slot 1, and no console error. Touches no panel, preset '
        + 'or AP state; the iframe is removed however it ends.',
    testFunction: seedlingJsRuntimeInventoryMenu,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ── ⛓ THE SEEDLING PANEL'S TOOLS: RESTART, AND THE TELEPORT TOOL THROUGH THE ARRIVAL PATH ──────────────────────────
//
// ⚖ the user, 2026-10-28: copy the Menu panel's reset button into the Seedling panel's Tools, and check the teleport
// tool against a walked exit. On seedling_atlas (start hop Menu → overworld_start__r8c0, level 0):
//   RESTART — the Menu's Restart from the owl's nest is the reference spot; Tools ▸ Restart from the same place lands
//     on it, with gameState, the binding and the glue's verdict agreeing (the Tools button calls the Menu's own
//     `restart`, so the warp is the same handler's).
//   TELEPORT — a WALKED exit (the owl's nest's stairs up, by keys) against Tools ▸ Go to the very spot the walk landed
//     on, from the same room: the same AP region in gameState and the binding, the same spot, no warning, no check.
//     The two differences are the point: the teleport names no door (the binding's `arrivedFrom` is null, the move's
//     exit is null — main's read the stairs: a door nobody took) and adds no path entry (the Restart's warp shape).
//     Then "TP on UI click" from a region-graph click into the dungeon, which the start has NO door to: gameState,
//     the binding and the game all reach it (main: the vanilla `region_coords` has no atlas ids, nothing moved).

const TOOLS_START = 'overworld_start__r8c0';
const TOOLS_OWLS = 'owls_nest_entrance';
const TOOLS_DUNGEON = 'dungeon1_room1__r0c4';

/** What a walked exit or a teleport updates, read in one place: gameState, the binding, the glue, the game. */
function toolsFacts() {
    const glue = getSeedlingRegionGlue();
    const game = glue?.adapter?._getFlash?.() ?? null;
    let st = null;
    try { const raw = game?.botStatus?.(); st = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { st = null; }
    // the constructor position (`new Game(level, x, y)`: what the binding teleports to, and what Go takes)
    let rs = null;
    try { const raw = game?.readState?.(); rs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { rs = null; }
    const path = window.centralRegistry?.getPublicFunction?.('gameState', 'getPath')?.() ?? [];
    return {
        region: readCurrentRegion(),
        binding: glue?.binding?.region ?? null,
        arrivedFrom: glue?.binding?.arrivedFrom?.exit_id ?? null,
        level: st?.level ?? null, x: st?.x ?? null, y: st?.y ?? null,
        ctor: rs ? { x: rs.playerPositionX ?? null, y: rs.playerPositionY ?? null } : null,
        pathLength: Array.isArray(path) ? path.length : null,
        warnings: glue?.stats?.warnings ?? null,
        locationChecks: glue?.stats?.locationChecks ?? null,
    };
}

/** An AP move, the way a substrate publishes one (the binding's arrival teleports the game). */
function toolsMove(from, to, exitName = null) {
    getSeedlingRegionGlue()?.getDispatcher?.()?.publish?.('user:regionMove',
        { sourceRegion: from, targetRegion: to, exitName, source: 'tests-tools-teleport' }, { initialTarget: 'bottom' });
}

/** The game, gameState and the binding all in `region` on `level`, and the spot still for 600 ms. */
async function toolsSettledIn(tc, label, region, level, ms = 30000) {
    let last = null;
    let still = 0;
    return tc.pollForValue(() => {
        const f = toolsFacts();
        const ok = f.region === region && f.binding === region && f.level === level;
        still = ok && last && last.x === f.x && last.y === f.y ? still + 1 : 0;
        last = f;
        return ok && still >= 3 ? f : null;
    }, label, ms, 200);
}

/**
 * Hold the arrow key toward tile (tx, ty) until the game leaves its level (the door fires). Sent the way the panel's
 * touch controls send it (`_sendTouchKey` → `dispatchGameKey`, with the keyCode the wasm game reads).
 */
async function toolsWalkInto(tc, panel, tx, ty, maxMs = 10000) {
    const f = toolsFacts();
    // ⛔ wasm: `readState`'s position can LAG the game (the touch-controls row's note); `botStatus` reads the player
    // itself, its centre (+8), so the direction comes from it when it reports
    const at = f.x !== null && f.y !== null ? { x: f.x - 8, y: f.y - 8 } : f.ctor;
    const dx = tx * 16 - at.x;
    const dy = ty * 16 - at.y;
    const code = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : (dy < 0 ? 'ArrowUp' : 'ArrowDown');
    const k = { key: code, code, keyCode: { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[code] };
    const from = f.level;
    panel._sendTouchKey('keydown', k);
    const t0 = performance.now();
    try {
        while (performance.now() - t0 < maxMs && (toolsFacts().level === from || toolsFacts().level === null)) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, STEP_MS));
        }
    } finally { panel._sendTouchKey('keyup', k); }
    const end = toolsFacts();
    tc.log(`walk ${code} to tile (${tx},${ty}): from ${JSON.stringify({ level: f.level, x: f.x, y: f.y, ctor: f.ctor })} `
        + `→ ${JSON.stringify({ level: end.level, x: end.x, y: end.y, ctor: end.ctor })} in ${Math.round(performance.now() - t0)} ms`);
    if (end.level === from) {
        // a walk that did not cross: what gates the game's input, and where the key went
        let st = null;
        try { st = JSON.parse(getSeedlingRegionGlue()?.adapter?._getFlash?.()?.botStatus?.() ?? 'null'); } catch { st = null; }
        const pick = (o, ks) => Object.fromEntries(ks.filter((n) => o && n in o).map((n) => [n, o[n]]));
        const sameId = document.querySelectorAll(`[id="${panel.flashObjectId}"]`).length;
        tc.log(`walk did not cross: status ${JSON.stringify(pick(st, ['receive_input', 'saw_input_refused', 'input', 'held',
            'armed', 'arm', 'loaded', 'menu', 'menu_state', 'cutscene', 'frozen', 'finished', 'dead_frames', 'tick_count', 'buffered']))}; `
            + `elements with the frame's id ${sameId}; `
            + `its canvases ${document.getElementById(panel.flashObjectId)?.contentDocument?.querySelectorAll?.('canvas')?.length ?? 'none'}; `
            + `focus ${document.activeElement?.tagName}#${document.activeElement?.id ?? ''}; held ${JSON.stringify(panel._heldKeys?.held?.() ?? null)}`);
    }
    return end.level !== from;
}

/** Record every `user:regionMove` published through the flash panel's dispatcher; `stop()` restores it. */
function toolsMoveRecorder() {
    const d = getSeedlingRegionGlue()?.getDispatcher?.();
    const moves = [];
    if (!d?.publish) return { moves, stop: () => {} };
    const orig = d.publish;
    d.publish = function publish(name, data, opts) {
        if (name === 'user:regionMove') moves.push({ ...data });
        return orig.call(this, name, data, opts);
    };
    return { moves, stop: () => { d.publish = orig; } };
}

const toolsRestartAndTeleport = (runtime) => async (tc) => withRuntimeRestored(tc, async () => {
    const up = await atlasPresetOn(tc, runtime, ATLAS_PATH, TOOLS_START);
    if (!up) return;
    const { panel } = up;
    const glue = getSeedlingRegionGlue();
    const sameSpot = (a, b) => !!a && !!b && a.level === b.level && a.x === b.x && a.y === b.y;
    const born = await toolsSettledIn(tc, `[${runtime}] the new game stands in ${TOOLS_START}`, TOOLS_START, 0, 60000);
    tc.reportCondition(`[${runtime}] the new game stands in ${TOOLS_START} (level 0)`, !!born);
    if (!born) return;
    // ⛓ THIS ROW'S OWN STATE: the Playback Bot stopped (an earlier row may leave it running; this row walks by hand)
    const botPanel = getBotPanel();
    const bot = botPanel?.getBot?.() ?? botPanel ?? null;
    tc.log(`[${runtime}] the Playback Bot before this row: ${bot ? `active ${!!bot.isActive?.()}` : 'not mounted'}; stopped`);
    bot?.stop?.();
    const recorder = toolsMoveRecorder();
    const tpCheckbox = panel.teleportOnClickCheckbox;
    const tpWas = tpCheckbox?.checked ?? false;
    try {
        // ── A WALKED EXIT: the owl's nest's stairs up, by keys ──
        toolsMove(TOOLS_START, TOOLS_OWLS, `${TOOLS_START} -> ${TOOLS_OWLS}`);
        const nest = await toolsSettledIn(tc, `[${runtime}] in the owl's nest for the walk`, TOOLS_OWLS, 2);
        if (!nest) { tc.reportCondition(`[${runtime}] in the owl's nest for the walk`, false); return; }
        const movesBefore = recorder.moves.length;
        const walkedOut = await toolsWalkInto(tc, panel, 3, 1, runtime === 'wasm' ? 20000 : 10000);
        const walked = walkedOut ? await toolsSettledIn(tc, `[${runtime}] the walked stairs landed in the start`, TOOLS_START, 0) : null;
        tc.reportCondition(`[${runtime}] WALKED: the stairs up crossed into ${TOOLS_START} (gameState, binding, game)`, !!walked);
        if (!walked) return;
        const walkedMove = recorder.moves.slice(movesBefore).find((m) => m.targetRegion === TOOLS_START) ?? null;

        // ── THE TOOL TELEPORT to the spot the walk landed on, from the same room ──
        toolsMove(TOOLS_START, TOOLS_OWLS, `${TOOLS_START} -> ${TOOLS_OWLS}`);
        const nest2 = await toolsSettledIn(tc, `[${runtime}] in the owl's nest for the teleport`, TOOLS_OWLS, 2);
        if (!nest2) { tc.reportCondition(`[${runtime}] in the owl's nest for the teleport`, false); return; }
        const pre = toolsFacts();
        const tpBefore = recorder.moves.length;
        panel.teleportLevelInput.value = String(walked.level);
        panel.teleportXInput.value = String(walked.ctor?.x);
        panel.teleportYInput.value = String(walked.ctor?.y);
        panel.rootElement.querySelector('.flash-panel-tp-go').click();
        const tp = await toolsSettledIn(tc, `[${runtime}] the Tools teleport landed in the start`, TOOLS_START, 0);
        const tpMoves = recorder.moves.slice(tpBefore);
        tc.log(`[${runtime}] WALKED ${JSON.stringify({ ...walked, move: walkedMove })}`);
        tc.log(`[${runtime}] TELEPORTED ${JSON.stringify({ ...(tp ?? toolsFacts()), moves: tpMoves, verdict: glue.lastTeleport })}`);
        tc.assertEqual(`[${runtime}] the teleport moved the AP region as the walk did (gameState and the binding in ${TOOLS_START})`,
            `${TOOLS_START}/${TOOLS_START}`, `${tp?.region ?? toolsFacts().region}/${tp?.binding ?? toolsFacts().binding}`);
        // the TILE: a walk's read can catch the player still sliding (measured y 262.3 on the JS page)
        const tileOf = (f) => (f ? `${f.level}:${Math.floor(f.x / 16)},${Math.floor(f.y / 16)}` : null);
        tc.assertEqual(`[${runtime}] the teleport landed on the walk's tile`, tileOf(walked), tileOf(tp));
        tc.assertEqual(`[${runtime}] ⚖ a teleport has no door: the move names none, and the binding's arrivedFrom is null (the walk's: the stairs)`,
            'null/null', `${JSON.stringify(tpMoves.map((m) => m.exitName).filter(Boolean)[0] ?? null)}/${JSON.stringify(tp ? tp.arrivedFrom : 'unsettled')}`);
        tc.assertEqual(`[${runtime}] the teleport adds no path entry (the Restart's warp shape)`, pre.pathLength, tp?.pathLength ?? null);
        tc.assertEqual(`[${runtime}] no warning and no location check from the teleport`, `${pre.warnings}/${pre.locationChecks}`,
            `${tp?.warnings ?? null}/${tp?.locationChecks ?? null}`);

        // ── "TP on UI click": a region-graph click into the dungeon, which the start has no door to ──
        if (tpCheckbox) tpCheckbox.checked = true;
        // the region graph's own click (`graphInteractionManager`): published as its module, the registered publisher
        tc.eventBus.publishAs('regionGraph:nodeSelected', { nodeId: TOOLS_DUNGEON, data: {} }, 'regionGraph');
        const dungeon = await toolsSettledIn(tc, `[${runtime}] the region-graph teleport reached the dungeon`, TOOLS_DUNGEON, 3);
        tc.log(`[${runtime}] REGION CLICK ${JSON.stringify({ ...(dungeon ?? toolsFacts()), verdict: glue.lastTeleport })}`);
        tc.reportCondition(`[${runtime}] TP on UI click into ${TOOLS_DUNGEON} (no door from the start): gameState, the binding and the game reach it`, !!dungeon);
        tc.assertEqual(`[${runtime}] no warning from the region-graph teleport`, pre.warnings, toolsFacts().warnings);

        // ── ⛓ THE ORDERING WITNESS (rules-4's review): the binding's no-door arrival teleport goes first, the spot
        // second; the game must END at the spot, never at the region's first exit's spawn. A CROSS-level Go (from the
        // dungeon, level 3) and a SAME-level Go (inside the start region, level 0), each read off `botStatus` (the
        // player's centre = the spot + 8) once still. ──
        const goTo = async (label, spot) => {
            panel.teleportLevelInput.value = String(spot.level);
            panel.teleportXInput.value = String(spot.x);
            panel.teleportYInput.value = String(spot.y);
            panel.rootElement.querySelector('.flash-panel-tp-go').click();
            const at = await toolsSettledIn(tc, `[${runtime}] ${label} settled in ${TOOLS_START}`, TOOLS_START, spot.level);
            const noDoor = glue.binding?._arrivalSpawn?.() ?? null;
            tc.log(`[${runtime}] ORDER ${label}: asked ctor (${spot.x}, ${spot.y}); settled ${JSON.stringify(at ?? toolsFacts())}; `
                + `the no-door spawn ${JSON.stringify(noDoor && { level: noDoor.level, x: noDoor.x, y: noDoor.y, exit: noDoor.exitId })}; `
                + `verdict ${JSON.stringify(glue.lastTeleport)}`);
            tc.assertEqual(`[${runtime}] ORDER ${label}: the spot asked for is not the region's no-door spawn (the witness can tell them apart)`,
                true, !!noDoor && (noDoor.x !== spot.x || noDoor.y !== spot.y));
            tc.assertEqual(`[${runtime}] ORDER ${label}: the game settled at the spot (botStatus centre = spot + 8), not the no-door spawn`,
                `${spot.level}:${spot.x + 8},${spot.y + 8}`, at ? `${at.level}:${at.x},${at.y}` : 'unsettled');
        };
        await goTo('cross-level Go (level 3 -> 0)', { level: 0, x: 80, y: 128 });
        await goTo('same-level Go (level 0 -> 0)', { level: 0, x: 256, y: 256 });

        // ── RESTART: the Menu's, then the Tools button's, each from the owl's nest ──
        // ⛔ LAST, after the walk: the Restart's `expectBotArrivals` arms a wasm engine's arrival watch whenever one
        // exists (an earlier row's), and the watch HOLDS the landing until a bot goal that never comes here, so a
        // walk after it moves nothing (CI, seedling-js batch: `held: true`, 0 ticks). Main's handler; named, not fixed.
        toolsMove(readCurrentRegion(), TOOLS_OWLS, null);
        tc.reportCondition(`[${runtime}] the AP move reached the owl's nest`, !!await toolsSettledIn(tc, `[${runtime}] in the owl's nest`, TOOLS_OWLS, 2));
        window.centralRegistry.getPublicFunction('menuPanel', 'restart')();
        const menu = await toolsSettledIn(tc, `[${runtime}] the Menu's Restart landed at the start`, TOOLS_START, 0);
        tc.reportCondition(`[${runtime}] the Menu's Restart landed in ${TOOLS_START}`, !!menu);
        const menuVerdict = glue.lastRestart;
        toolsMove(TOOLS_START, TOOLS_OWLS, `${TOOLS_START} -> ${TOOLS_OWLS}`);
        await toolsSettledIn(tc, `[${runtime}] back in the owl's nest`, TOOLS_OWLS, 2);
        const button = panel.rootElement?.querySelector('.flash-panel-restart') ?? null;
        tc.assertEqual(`[${runtime}] Tools shows a Restart button on a Seedling preset`, true, !!button && button.style.display !== 'none');
        if (!button) return;
        const restartsBefore = glue.stats.restarts;
        button.click();
        const tools = await toolsSettledIn(tc, `[${runtime}] Tools ▸ Restart landed at the start`, TOOLS_START, 0);
        tc.log(`[${runtime}] Restart: Menu ${JSON.stringify(menu)} / Tools ${JSON.stringify(tools)}`);
        tc.assertEqual(`[${runtime}] Tools ▸ Restart lands where the Menu's Restart lands (level/x/y)`, true, sameSpot(menu, tools));
        tc.assertEqual(`[${runtime}] the glue's own Restart handler took it (a new verdict, the hop re-taken, one more restart)`,
            'true/true/1', `${glue.lastRestart !== menuVerdict}/${glue.lastRestart?.taken}/${glue.stats.restarts - restartsBefore}`);
        let held = null;
        try { held = JSON.parse(glue.adapter?._getFlash?.()?.botStatus?.() ?? 'null')?.held ?? null; } catch { held = null; }
        tc.log(`[${runtime}] after Tools ▸ Restart: the engines watching ${glue.lastRestart?.watching}; the game held ${held}`);
        assertNoDeathNoHalt(tc, runtime, up.rt);
    } finally {
        recorder.stop();
        if (tpCheckbox) tpCheckbox.checked = tpWas;
    }
});

export const seedlingJsRuntimeToolsRestartTeleport = toolsRestartAndTeleport('js');
export const seedlingWasmRuntimeToolsRestartTeleport = toolsRestartAndTeleport('wasm');

for (const [runtime, fn] of [['js', seedlingJsRuntimeToolsRestartTeleport], ['wasm', seedlingWasmRuntimeToolsRestartTeleport]]) {
    registerTest({
        id: `seedling-${runtime}-runtime-tools-restart-teleport`,
        name: `Seedling ${runtime === 'js' ? 'JS' : 'wasm'} runtime: Tools ▸ Restart lands as the Menu's; a Tools teleport updates what a walked exit does`,
        description: `On seedling_atlas with flashPanel.runtime = ${runtime}: the Menu's Restart from the owl's nest sets the reference spot `
            + 'and Tools ▸ Restart lands on it (the glue\'s own handler re-took the hop). Then a WALKED exit (the owl\'s nest stairs, '
            + 'by keys) against Tools ▸ Go to the spot it landed on: the same AP region in gameState and the binding, the same spot, '
            + 'no door named, no path entry, no warning. Then TP on UI click into the dungeon (no door from the start) reaches it.',
        testFunction: fn,
        category: 'Seedling JS runtime',
        enabled: false, // off by default — runs only in the test-substrates mode
    });
}
