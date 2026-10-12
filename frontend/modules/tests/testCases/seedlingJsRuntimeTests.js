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
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { getActivePanel as getBotPanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { returnKey, returnSpawnTable } from '../../flashPanel/seedlingReturnSpawns.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { resolveQueueBlocks } from '../../loops/blockIdentity.js';
import { restoresSavedQueues } from '../savedQueueIsolation.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';

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
    category: 'Seedling JS runtime',
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
        tc.assertEqual('victory is held', true, facts.held('victory') > 0);
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

const SOLVE_PROGRESS_KEY = 'moduleSettings.flashPanel.seedlingSolveProgressView';

export async function seedlingJsRuntimeSolveProgressView(tc) {
    let previousRuntime = 'auto';
    let previousSolver = true;
    let previousView = false;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    try { previousView = await settingsManager.getSetting(SOLVE_PROGRESS_KEY, false); } catch { /* keep the default (off) */ }
    let svc = null;
    try {
        // ⚖ This row SETS its own state: solver mode on, the view open (session-only overrides, restored below).
        await settingsManager.updateSetting(SOLVER_WALK_KEY, true, { persist: false });
        await settingsManager.updateSetting(SOLVE_PROGRESS_KEY, true, { persist: false });
        const staleAdapter = getActivePanelInstance()?.adapter ?? null;
        const ready = await botOnSeedlingPreset(tc, 'js', { presetPath: ATLAS_PATH, sphereLog: false });
        if (!ready) return tc.getOverallResult();
        const up = await atlasPanelOnJs(tc, staleAdapter);
        if (!up) return tc.getOverallResult();
        const { rt, panel } = up;
        const view = panel._solveProgressView;
        tc.assertEqual('the progress view is open (the setting is on)', true, !!view?.isOpen);
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
        tc.assertEqual('the progress messages came at most ~1/s: updates ≤ the solve\'s wait in seconds + 2', true,
            st.received <= Math.ceil((s.lastSolve?.waitMs ?? 0) / 1000) + 2);
        const rows = view.tree.querySelectorAll('div').length;
        tc.assertEqual('the tree is drawn (≥ 1 row)', true, rows >= 1);
        tc.assertEqual('the meter reads the attempt against the budget', true,
            /^work \d+ \/ \d+ units/.test(view.meterText.textContent));
        if (st.snapshot?.tiles) {
            tc.assertEqual('the tile map is ONE canvas sized to the room', `${st.snapshot.tiles.cols}x${st.snapshot.tiles.rows}`,
                `${Math.round(view.canvas.width / view._px)}x${Math.round(view.canvas.height / view._px)}`);
        }
        // the "last update N s ago" indicator ticks on its own (never implies liveness from the throttle)
        const aged = await tc.pollForCondition(() => /last update [1-9]\d* s ago/.test(view.header.textContent),
            'the header\'s "last update N s ago" advanced', 5000, 100);
        tc.reportCondition('the age indicator advances while nothing arrives', !!aged);
    } finally {
        try { await settingsManager.updateSetting(SOLVE_PROGRESS_KEY, previousView, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    // ⛔ closing the view UNSUBSCRIBES: the next solve installs no hook
    if (svc && previousView !== true) {
        const off = await tc.pollForCondition(() => svc.progressSubscribed === false,
            'the closed view left no listener on the service', 3000, 100);
        tc.reportCondition('closing the view unsubscribed it', !!off);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solve-progress-view',
    name: 'Seedling JS runtime: the panel\'s SOLVE PROGRESS view on a real solve (L6, past the bobs)',
    description: 'With flashPanel.runtime = js, the solver mode on and flashPanel.seedlingSolveProgressView ON, on '
        + 'seedling_atlas: the view subscribes to the page\'s worker service before the solve, the L6 enemy-room solve '
        + 'streams its progress, and the view holds the FINAL snapshot (solved), draws its tree, its tile canvas and '
        + 'its work meter, and its "last update N s ago" advances; closing the view unsubscribes.',
    testFunction: seedlingJsRuntimeSolveProgressView,
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
 * Queue `steps` (`{check, region}` | `{exit, from, to}`), set every flash_seedling block to BOT, fill the pool and
 * run the queue to its end. Returns the measured facts, or null (named).
 */
async function seedlingLoopBotQueue(tc, label, steps, { maxMs = 120000 } = {}) {
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
        tc.assertEqual(`[${label}] ${r} is a walkTo-solver region (flash_seedling declares executeVia solver)`,
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
    const controller = substrateRegistry.get('flash_seedling')?.getPlaybackController?.() ?? null;
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
        const ended = await completed;
        clearInterval(sampler);
        // A link credit, its regionMove and the queue's end can all land inside one sample interval.
        sample();
        const out = {
            queueCompleted: !!ended, reason: ended?.reason ?? loopStateSingleton._queueCompletedReason ?? null,
            processing: loopStateSingleton.isProcessing, parkedAfter: loopStateSingleton.botSolverRegion?.() ?? null,
            pausedUntilReset: loopStateSingleton._queuePausedUntilReset === true,
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
    }
}

/** The queue's end, asserted the same way on every row: on its own (`queueEnd`), the park released, no hard pause. */
function assertLoopEndedOnItsOwn(tc, label, r) {
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

/**
 * ⛓ The Flash (Ruffle) runtime has no feet: a Bot block's walkTo there is refused BY NAME, and loops turns the
 * refusal into its named stop (`loopState:botWalkFailed`, the controller's `lastRefusal` as its reason) instead of
 * a silent park. The Seedling SWF is not committed (`flashPanel/swf/README.md`), so the preset is loaded with its
 * `flash_panel.swf` naming the one that README describes: the panel takes the REAL Flash path (Ruffle fetched from
 * its CDN, the bridge adapter built) and never gets a game — which is all the refusal needs. Before the panel's
 * Flash path said `transport: 'flash'`, the surface read 'wasm' and the goal was HELD (no map, no engine) for 60 s.
 */
export async function seedlingFlashRuntimeLoopBotBlockNamesItsStop(tc) {
    return withRuntimeRestored(tc, async () => {
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
    });
}

registerTest({
    id: 'seedling-flash-runtime-loop-bot-block-names-its-stop',
    name: 'Seedling (Flash runtime): a Loops Bot block\'s walk is refused by name — a named stop, not a silent park',
    description: 'With flashPanel.runtime = flash (the Ruffle path; the SWF is not committed, so no game boots): loop '
        + 'mode on, the house block Bot. The flash_seedling controller refuses the walk synchronously, naming the Flash '
        + 'runtime, and loops publishes loopState:botWalkFailed carrying that lastRefusal; the park is dropped.',
    testFunction: restoresSavedQueues(seedlingFlashRuntimeLoopBotBlockNamesItsStop),
    category: 'Seedling JS runtime',
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
        category: 'Seedling JS runtime',
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
        category: 'Seedling JS runtime',
        enabled: false, // off by default — runs only in the test-substrates mode
    });
}
