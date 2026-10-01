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
async function botOnSeedlingPreset(tc, runtime) {
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
    tc.log(`runtime = ${runtime} (session override); loading seedling_generated_room…`);
    const rulesJson = await (await fetch(PRESET_PATH)).json();
    const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: PRESET_PATH });
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
    } finally {
        try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    }
    return tc.getOverallResult();
}

export async function seedlingWasmRuntimeBotNamesItsRefusal(tc) {
    let previous = 'auto';
    try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
    try {
        const ready = await botOnSeedlingPreset(tc, 'wasm');
        if (!ready) return tc.getOverallResult();
        const { bot } = ready;
        await bot.play();
        const named = await tc.pollForValue(() => errorStatuses(bot).find((l) => l.includes('only on the Seedling JS runtime')) ?? null,
            'the bot\'s status NAMES the cannot-walk error under the wasm runtime', 15000, 200);
        tc.log(`bot status: "${bot.getStatus()}"`);
        tc.assertEqual('under wasm the bot says, by name, that it cannot walk the generated room', true, !!named);
        tc.assertEqual('the named error names the runtime it is on', true, /running the wasm runtime/.test(named ?? ''));
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
    name: 'Seedling (wasm runtime): the Playback Bot names why it cannot walk a generated room',
    description: 'With flashPanel.runtime = wasm, the bot\'s walkTo into a flash_seedling_gen region is refused '
        + 'by the controller and the bot\'s status names the cannot-walk error (only the JS runtime has feet) '
        + '— never a silent wait. The wasm page is never started.',
    testFunction: seedlingWasmRuntimeBotNamesItsRefusal,
    category: 'Seedling JS runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
});
