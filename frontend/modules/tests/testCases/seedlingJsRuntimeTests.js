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
import { getActivePanelInstance } from '../../flashPanel/index.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { getActivePanel as getBotPanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { returnKey, returnSpawnTable } from '../../flashPanel/seedlingReturnSpawns.js';

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
 * the in-app runner's Chromium (`playwright.config.js`: `--disable-gpu`, no
 * WebGPU switches) has no WebGPU adapter — measured, `requestAdapter()` → null —
 * so the recompiled game never starts in any in-app row. It is the headless
 * probe `scripts/procgen/probe-seedling-wasm-generated-playback.mjs`.
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

export async function seedlingJsRuntimeSolverBudgetFallsBack(tc) {
    let previousRuntime = 'auto';
    let previousSolver = false;
    try { previousRuntime = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try { previousSolver = await settingsManager.getSetting(SOLVER_WALK_KEY, true); } catch { /* keep the default (on) */ }
    let rt = null;
    try {
        const up = await slowRoomOnPage(tc);
        if (!up) return tc.getOverallResult();
        ({ rt } = up);
        // ⛓ DETERMINISTIC BUDGET — the solve's budget is WORK (the same answer on every machine), so the only
        // wall-clock cut left is the BACKSTOP, shortened here (the test knob; the page also reads
        // ?solverBackstopMs=) — the door solve needs ~5 s. Past it the goal FAILS by name: nothing is played,
        // nothing is walked instead (a slow machine never changes the outcome into a different one).
        const backstop = rt.playback.solverBackstopMs;
        rt.playback.setSolverBackstopMs(300);
        const solves0 = rt.playback.solveService.stats.terminated;
        const run0 = rt.run;
        const at0 = { level: run0.level, x: run0.state.x, y: run0.state.y, transitions: run0.transitions.length };
        // ⚠ NOT the run's total tick count: once the goal has FAILED the walker hands back no keys, so the page's
        // clock steps the room IDLE (as it does with no goal at all) — from the very tick that failed (measured on
        // CI: 3 → 4, every run). The hold is sampled WHILE the solve is in flight instead.
        const hold = { first: null, last: null, samples: 0 };
        rt.playback.walkTo({ kind: 'exit', level: SLOW_ROOM.level, tiles: [up.exitTile] });
        rt.playback.play();
        const failed = await tc.pollForCondition(() => {
            if (rt.playback.solving) {
                const t = rt.run.ticksCompleted;
                hold.first ??= t;
                hold.last = t;
                hold.samples += 1;
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
        tc.log(`held ${hold.samples} sample(s) at run tick ${hold.first}..${hold.last}; walker ${JSON.stringify(rt.playback.stats)}`);
        tc.assertEqual('the room was HELD while the solve was in flight (sampled; the run never stepped under it)', true,
            hold.samples > 0 && hold.first === hold.last);
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
        + 'teleported to level 12\'s door (the slowest measured solve, ~5 s) and its wall-clock backstop shortened to 300 ms '
        + '(playback.setSolverBackstopMs, the test knob; the solve\'s own budget is work units, the same on every machine). '
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
            + `over ${clock.frames} frame(s)`);
        tc.assertEqual('the walk is DONE (level 12 → 36)', 'done', rt.playback.state);
        tc.assertEqual('solved once in the worker, no decline, no refutation', '1/0/0/worker',
            `${s.solves}/${s.declines}/${s.refutations}/${s.lastSolve?.where}`);
        tc.assertEqual('a real solve was in flight (≥ 500 ms)', true, clock.solvingMs >= 500);
        tc.assertEqual(`the room was HELD while it was (the run did not step over ${clock.held} sample(s))`, 0, clock.ticksWhileSolving);
        tc.assertEqual('⛔ the page\'s frame clock did not stall: every heartbeat gap < 250 ms while solving', true,
            clock.maxBeatGap > 0 && clock.maxBeatGap < 250);
        tc.assertEqual(`the page is in level ${SLOW_ROOM.to}`, SLOW_ROOM.to, rt.run?.level ?? null);
        tc.assertEqual('0 HALT', null, rt.halted ? rt.halted.message : null);
    } finally {
        try { rt?.playback.reset(); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(SOLVER_WALK_KEY, previousSolver, { persist: false }); } catch { /* best effort */ }
        try { await settingsManager.updateSetting(RUNTIME_KEY, previousRuntime, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'seedling-js-runtime-solver-keeps-the-frame-clock',
    name: 'Seedling JS runtime: the solver thinks in a worker — the page\'s frame clock never stalls',
    description: 'With flashPanel.runtime = js and flashPanel.seedlingSolverWalk ON, on seedling_atlas: level 12, 120 '
        + 'walker ticks in (a ~2 s solve, S1 froze the page for it). The solve runs in the worker; the page\'s 20 ms '
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
