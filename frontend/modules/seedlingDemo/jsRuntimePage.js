/**
 * seedlingDemo/jsRuntimePage — **THE SEEDLING JS RUNTIME'S PAGE** (Seedling JS
 * runtime J1): the DOM half of `jsRuntimeCore.js`, mounted by the flash panel
 * as its game iframe when `moduleSettings.flashPanel.runtime` is `'js'`.
 *
 * It does four things and owns no game logic:
 *
 *  1. installs `window.__swfBridge` in the SHAPE of the wasm build's
 *     `swf_bridge_avm2.js` — `game` (the callback table), `queueItems`,
 *     `onStateChanged` (re-read on every report, because the host REPLACES it:
 *     `WasmBridgeAdapter.installStateHook`), `stateLog` — and sets
 *     `window.__runtimeReady`. Both of `wasmGamePage`'s questions answer at
 *     once: there is no ▶ Start, because there is no GPU or audio context to
 *     unlock (⚖ no graphics, no sound);
 *  2. reads the keyboard on its canvas (`watchManual.KEYBOARD_BINDINGS` — the
 *     watch page's MANUAL arm's bindings, one table);
 *  3. paces the model at 30 ticks a second with a requestAnimationFrame
 *     ACCUMULATOR (watchManual's "THE LOOP QUESTION": the page's clock decides
 *     WHEN a tick runs, the model decides WHAT it does). ⚠ A hidden or
 *     `display:none` frame gets no animation frames, so a timer PUMP keeps the
 *     clock going when rAF has been silent for `PUMP_AFTER_MS` — the panel's
 *     host glue (deliveries, crossings) must not stall behind a tab switch;
 *  4. paints the room in rectangles with the watch page's palette
 *     (`rectPalette.js`): tiles, object solids, teleporters, the AP items and
 *     the player's hitbox.
 *
 * ⛓ J3 — it also fetches the VANILLA map document
 * (`flashPanel/atlases/seedling-map.json`, the one map every committed preset
 * names, `mapDocumentPath.DEFAULT_MAP_DOCUMENT`) and hands it to the core
 * (`setVanilla`): the atlas arm delivers nothing, so the real rooms are the
 * vanilla ones, exactly as the wasm game runs its own tables.
 *
 * `window.__seedlingJsRuntime` is the core itself. J1 used it as a TEST handle
 * (the in-app row reads the mounted rooms off it); ⛓ since J2 its `playback`
 * member is also the HOST's: `flashPanel/seedlingPlaybackController.js` (the
 * `flash_seedling_gen` PlaybackController) hands the Playback Bot's goals to it
 * synchronously, and the walk then runs inside this page's own tick — while a
 * goal is being walked the keyboard is not read.
 *
 * ⛓ solver-walk S2 — the page hands the core a module-Worker solve service
 * (`jsRuntimeSolveService.createWorkerSolveService`): the solver mode's
 * solves run off this thread, so the clock below keeps running (and painting
 * "solving…") while one is in flight. ⛓ DETERMINISTIC BUDGET: the budget is
 * WORK, counted in the worker — `?solverBudgetWork=<units>` on this page's URL
 * sets it (a test knob; the default is `SOLVER_BUDGET_WORK`) and
 * `?solverUpgradeWindowWork=<units>` the upgrade window
 * (`jsRuntimeSolver.upgradeWindowWork`); `?solverBackstopMs=<ms>` the wall-clock
 * backstop, which only ever FAILS a goal by name. A browser without module
 * workers solves in place, as S1 did — said once on the console.
 *
 * ⛓ GRAPHICS G1 — `?graphics=<stack>` paints the room in a content-pack stack's
 * art (`frontend/packs/packs.json` names the stacks; `seedling` = the original
 * Seedling sheets + the Archipelago pickup) through `seedlingSkinRenderer`;
 * absent = today's rectangles, byte for byte. `?camera=follow` shows the
 * original 160×160 view following the player instead of the whole room
 * (`room`, the default). Both are off-default URL params the flash panel adds
 * from its settings, and both can be changed LIVE through
 * `window.__seedlingJsGraphics.set({ graphics, camera })` (the panel does, so a
 * cosmetic switch never re-mounts the game). The packs load asynchronously
 * (`createImageBitmap`); until a sheet decodes — or if it never does — its
 * sprites are drawn as their rectangles. The renderer only READS the run.
 *
 * ⛓ KILLLOCK HOOK — `?killLockBodies=<keys>|none` (the `SEEDLING_KILLLOCK_BODIES`
 * grammar) sets this page's `killLockBodies` switches before its first run;
 * absent = the defaults. The panel adds it only when its settings are
 * off-default, and re-mounts the page when they change. The worker gets the
 * set with each solve request (`killLockBodiesStamp`).
 */

import { createJsRuntime } from './jsRuntimeCore.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { applyKillLockBodies, parseKillLockBodies } from './killLockBodies.js';
import { applyContactFidelity, parseContactFidelity } from './contactFidelity.js';
import { applyAxeDodgeAsk, parseAxeDodgeAsk } from './axeDodgeAskHook.js';
import { applyDashOnlyWindow, parseDashOnlyWindow } from './dashOnlyWindowHook.js';
import { heldFromCodes, KEYBOARD_BINDINGS } from './watchManual.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createLifetime } from './watchLifetime.js';
import {
    FLOOR_COLOUR, SOLID_COLOUR, TILE_COLOURS, objectSolidColour,
} from './rectPalette.js';
import { CAMERA_MODES, cameraView, paintOps, roomOps } from './seedlingSkinRenderer.js';
import { loadPackStack, packsBaseUrl, parseRegistry } from '../contentPacks/contentPacks.js';
import { browserDecoder, createArtLibrary, loadSheetImages } from '../artLibrary/artLibrary.js';

export const TICKS_PER_SECOND = 30;
const TICK_MS = 1000 / TICKS_PER_SECOND;
/** At most this many ticks per frame — a long stall is skipped, not replayed. */
const MAX_TICKS_PER_FRAME = 5;
const PUMP_AFTER_MS = 250;

const AP_ITEM_COLOUR = '#e8c040';
const TELEPORTER_COLOUR = '#3fd8ce';
const PLAYER_COLOUR = '#ffffff';
/** ⛓ J3 — the vanilla map, page-relative (this page lives in `seedlingDemo/`). */
export const VANILLA_MAP_PATH = '../flashPanel/atlases/seedling-map.json';

/**
 * ⛓ GRAPHICS G1 — load the pack STACK `name` (a key of `packs.json`'s
 * `graphics`) and decode its sheets. Resolves `{ art, images, failed }`;
 * a malformed pack or an unknown stack REJECTS by name (the page shows it and
 * keeps painting rectangles).
 */
export async function loadGraphicsStack(name, { win = window, base = packsBaseUrl() } = {}) {
    const readJson = async (url) => {
        const r = await win.fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };
    const registry = parseRegistry(await readJson(new URL('packs.json', base).href));
    const ids = registry.stacks[name];
    if (!ids) throw new Error(`no graphics stack "${name}" in packs.json (have: ${Object.keys(registry.stacks).join(', ') || 'none'})`);
    const art = createArtLibrary(await loadPackStack(ids, { base, readJson }));
    const { images, failed } = await loadSheetImages(art, browserDecoder(win));
    return { art, images, failed };
}

export function mountJsRuntimePage(win = window) {
    const doc = win.document;
    const canvas = doc.getElementById('game');
    const status = doc.getElementById('status');
    const ctx = canvas.getContext('2d');
    // ⛓ Every listener goes through a lifetime (`watchLifetime.test.js`'s rule
    // for every page module here); this page has one, for the document.
    const life = createLifetime('seedling-js-runtime-page');

    const bridge = {
        game: {},
        stateLog: [],
        queueItems: (items) => runtime.queueItems(items),
        onStateChanged: (name, value) => {
            win.console?.log?.('[swfBridge] stateChanged (unhandled):', name, value);
        },
    };
    // ⛓ S2 — the solver mode's solves run in a module Worker.
    let solveService = null;
    if (typeof win.Worker === 'function') {
        solveService = createWorkerSolveService({
            createWorker: () => new win.Worker(new URL('./jsRuntimeSolveWorker.js', import.meta.url), { type: 'module', name: 'seedling-js-solver' }),
            clock: () => win.performance.now(),
        });
    } else {
        win.console?.warn?.('[js runtime] no Worker in this browser — the solver mode solves on the page thread (S1)');
    }
    const params = new URL(win.location.href).searchParams;
    const budgetParam = Number(params.get('solverBudgetWork'));
    const windowParam = Number(params.get('solverUpgradeWindowWork'));
    const backstopParam = Number(params.get('solverBackstopMs'));
    // ⛓ KILLLOCK HOOK — before the runtime exists, so every run of this page steps under the same switches.
    const killLockParam = params.get('killLockBodies');
    if (killLockParam !== null) applyKillLockBodies(parseKillLockBodies(killLockParam, '?killLockBodies='));
    // ⛓ CONTACT HOOK — the same, for the model's contact switches (`contactFidelity.js`).
    const contactParam = params.get('contactFidelity');
    if (contactParam !== null) applyContactFidelity(parseContactFidelity(contactParam, '?contactFidelity='));
    // ⛓ AXE_DODGE HOOK — and fidelity's `AXE_DODGE_ASK_PER_PREVIEW` (`axeDodgeAskHook.js`): `on` / `off`.
    const axeParam = params.get('axeDodgeAskPerPreview');
    if (axeParam !== null) applyAxeDodgeAsk(parseAxeDodgeAsk(axeParam, '?axeDodgeAskPerPreview='));
    // ⛓ DASH-ONLY WINDOW — and the solver's `DASH_ONLY_WINDOW` (`dashOnlyWindowHook.js`): `on` / `off`.
    const dashOnlyParam = params.get('dashOnlyWindow');
    if (dashOnlyParam !== null) applyDashOnlyWindow(parseDashOnlyWindow(dashOnlyParam, '?dashOnlyWindow='));
    // ⛓ GRAPHICS G1 — the renderer's own state; nothing here reaches the runtime.
    const graphics = {
        stack: null, camera: 'room', status: 'off', error: null, failedSheets: [],
        art: null, images: null, counts: null, frames: 0,
        paintMs: { last: 0, avg: 0, max: 0 },
    };
    let graphicsLoad = 0;
    function setGraphics({ graphics: stack, camera } = {}) {
        if (camera !== undefined) {
            if (!CAMERA_MODES.includes(camera)) throw new Error(`?camera=${camera}: one of ${CAMERA_MODES.join(' | ')}`);
            graphics.camera = camera;
        }
        if (stack === undefined || stack === graphics.stack) return Promise.resolve(graphics.status);
        const ticket = ++graphicsLoad;
        Object.assign(graphics, { stack: stack || null, art: null, images: null, error: null, failedSheets: [], counts: null });
        if (!stack) { graphics.status = 'off'; return Promise.resolve('off'); }
        graphics.status = 'loading';
        return loadGraphicsStack(stack, { win }).then(({ art, images, failed }) => {
            if (ticket !== graphicsLoad) return graphics.status;
            Object.assign(graphics, { art, images, failedSheets: failed, status: 'ready' });
            if (failed.length) win.console?.warn?.(`[js runtime] graphics "${stack}": ${failed.length} sheet(s) failed — drawn as rectangles: ${failed.join('; ')}`);
            return 'ready';
        }, (err) => {
            if (ticket !== graphicsLoad) return graphics.status;
            Object.assign(graphics, { status: 'failed', error: err.message });
            win.console?.warn?.(`[js runtime] graphics "${stack}" could not be loaded — drawing rectangles: ${err.message}`);
            return 'failed';
        });
    }
    setGraphics({ graphics: params.get('graphics') || null, camera: params.get('camera') ?? undefined });
    const runtime = createJsRuntime({
        onStateChanged: (name, value) => {
            bridge.stateLog.push({ name, value });
            bridge.onStateChanged(name, value);
        },
        log: (msg) => win.console?.log?.(msg),
        solveService,
        ...(Number.isFinite(budgetParam) && budgetParam > 0 ? { solverBudgetWork: budgetParam } : {}),
        ...(Number.isFinite(windowParam) && windowParam > 0 ? { solverUpgradeWindowWork: windowParam } : {}),
        ...(Number.isFinite(backstopParam) && backstopParam > 0 ? { solverBackstopMs: backstopParam } : {}),
    });
    Object.assign(bridge.game, runtime.game);
    win.__swfBridge = bridge;
    win.__seedlingJsRuntime = runtime;
    win.__runtimeReady = true;
    // ⛓ GRAPHICS G1 — the renderer's handle: a READOUT and the live switch, never the run.
    win.__seedlingJsGraphics = {
        get stack() { return graphics.stack; },
        get camera() { return graphics.camera; },
        get status() { return graphics.status; },
        get error() { return graphics.error; },
        get failedSheets() { return graphics.failedSheets.slice(); },
        get counts() { return graphics.counts ? { ...graphics.counts } : null; },
        get frames() { return graphics.frames; },
        get paintMs() { return { ...graphics.paintMs }; },
        get packsOfKeys() { return graphics.art ? Object.fromEntries(graphics.art.keys().map((k) => [k, graphics.art.packOf(k)])) : null; },
        set: setGraphics,
    };

    // ⛓ J3 — the vanilla rooms. A teleport that beats this fetch is held by
    // the core and replayed; a failure is shown, never swallowed.
    let vanillaError = null;
    // `no-store`: a committed artifact is never read from a cache
    // (`watchLifetime.test.js`'s one-busted-fetch rule, in spirit).
    win.fetch(new URL(VANILLA_MAP_PATH, win.location.href).href, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((doc) => runtime.setVanilla(doc))
        .catch((err) => {
            vanillaError = err.message;
            win.console?.error?.(`[js runtime] the vanilla map could not be loaded — ${err.message}`);
        });

    // ── keys ──────────────────────────────────────────────────────────────
    const down = new Set();
    const onKey = (e, pressed) => {
        if (!(e.code in KEYBOARD_BINDINGS)) return;
        e.preventDefault();
        if (pressed) down.add(e.code);
        else down.delete(e.code);
    };
    life.on(doc, 'keydown', (e) => onKey(e, true));
    life.on(doc, 'keyup', (e) => onKey(e, false));
    life.on(win, 'blur', () => down.clear());

    // ── clock ─────────────────────────────────────────────────────────────
    let last = null;
    let acc = 0;
    let lastFrameAt = 0;
    function advance(now) {
        if (last === null) last = now;
        acc += Math.min(now - last, TICK_MS * MAX_TICKS_PER_FRAME);
        last = now;
        let n = 0;
        while (acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
            runtime.tick(heldFromCodes(down));
            acc -= TICK_MS;
            n += 1;
        }
    }
    function frame(now) {
        lastFrameAt = now;
        advance(now);
        paint();
        win.requestAnimationFrame(frame);
    }
    win.requestAnimationFrame(frame);
    win.setInterval(() => {
        const now = win.performance.now();
        if (now - lastFrameAt > PUMP_AFTER_MS) advance(now);
    }, PUMP_AFTER_MS / 2);

    // ── paint ─────────────────────────────────────────────────────────────
    function paint() {
        const view = runtime.view();
        ctx.fillStyle = '#101014';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!view) {
            status.textContent = runtime.halted
                ? `HALTED — ${runtime.halted.message.split('\n')[0]}`
                : (runtime.mounted
                    ? 'level set mounted — waiting for the host to start the game'
                    : (vanillaError ? `the vanilla map could not be loaded — ${vanillaError}`
                        : 'Seedling JS runtime — loading the vanilla map…'));
            return;
        }
        const { world, state, apItems, level } = view;
        if (graphics.stack || graphics.camera !== 'room') {
            paintSkinned(view);
            return;
        }
        // The room's size in PIXELS (`world.world`); `world.width` / `world.height` count TILES, and dividing by
        // them drew the room 16× too large: only its top-left corner, as a few big grey blocks.
        const scale = Math.min(canvas.width / world.world.width, canvas.height / world.world.height);
        const r = (rect, colour, alpha = 1) => {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = colour;
            ctx.fillRect(rect.x * scale, rect.y * scale, (rect.right - rect.x) * scale, (rect.bottom - rect.y) * scale);
            ctx.globalAlpha = 1;
        };
        const solid = new Set(world.solids.map((s) => `${s.rect.x},${s.rect.y}`));
        for (const t of world.tiles) {
            r(t.rect, solid.has(`${t.rect.x},${t.rect.y}`) ? SOLID_COLOUR : (TILE_COLOURS[t.t] ?? FLOOR_COLOUR));
        }
        for (const s of world.objectSolids) r(s.rect, objectSolidColour(s), 0.85);
        for (const tp of world.teleporters) if (!tp.deactivated) r(tp.rect, TELEPORTER_COLOUR, 0.45);
        for (const p of world.pickups ?? []) r(p.rect, AP_ITEM_COLOUR, 0.5);
        for (const a of apItems) r(a.rect, AP_ITEM_COLOUR, 1);
        r(playerBoxAt(state.x, state.y), PLAYER_COLOUR, 0.95);
        writeStatus(level);
    }

    function writeStatus(level, extra = '') {
        const deaths = runtime.deaths.length;
        status.textContent = `level ${level} · tick ${runtime.ticks}`
            + `${deaths ? ` · deaths ${deaths}` : ''}${runtime.run?.inCeremony ? ' · (text — auto-advancing)' : ''}`
            + `${runtime.playback.goal ? ` · ${runtime.playback.describe()}` : ''}${extra}`;
    }

    /**
     * ⛓ GRAPHICS G1 — the pack painter (or the rectangles through the same
     * ops, while the pack loads or when only the camera is off-default). Reads
     * the view and the run's camera; writes only the canvas and `graphics`.
     */
    function paintSkinned({ world, state, apItems, level }) {
        const t0 = win.performance.now();
        const art = graphics.status === 'ready' ? graphics.art : null;
        const ops = roomOps(world, art, {
            level, tick: runtime.ticks, player: playerBoxAt(state.x, state.y), apItems,
        });
        const view = cameraView(graphics.camera, world, state, runtime.run);
        graphics.counts = { ops: ops.length, ...paintOps(ctx, ops, art ? graphics.images : null, view, canvas) };
        const ms = win.performance.now() - t0;
        graphics.frames += 1;
        const pm = graphics.paintMs;
        pm.last = ms;
        pm.max = Math.max(pm.max, ms);
        pm.avg = pm.avg + (ms - pm.avg) / Math.min(graphics.frames, 60);
        const label = graphics.stack ? ` · graphics ${graphics.stack}${graphics.status === 'ready' ? '' : ` (${graphics.status})`}` : '';
        writeStatus(level, label);
    }

    life.on(canvas, 'mousedown', () => canvas.focus());
    return runtime;
}
