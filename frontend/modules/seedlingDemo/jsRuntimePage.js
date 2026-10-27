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
 *     ⛓ GAME SPEED — at 30 × the speed (0.25 … 16) ticks a second (`?speed=`), one slot per
 *     event-loop turn (`jsRuntimeClock.js`: the speed is presentation only);
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
 * ⛓ GRAPHICS G2 — with a stack on, the player is drawn from the pack too
 * (`seedlingPlayerSkin.js`): `skinView(run)` is read after EVERY game tick and
 * folded into the renderer's own FlashPunk state (`stepPlayerSkin`: the
 * playing animation, the mirror, the hit/freeze tint, the swing), and each
 * paint draws `playerOps`. `__seedlingJsGraphics.player` reads back the keys
 * and frame it drew. With no stack nothing here runs.
 *
 * ⛓ GRAPHICS G3 — and so are the enemies, spinners and arrows
 * (`seedlingEnemySkin.js`): `enemySkinView(run)` after every game tick, folded
 * into each body's own FlashPunk state (`stepEnemySkin`: its Spritemap and
 * end-of-anim callback, mirror, hit tint), and `enemyOps` at each paint; the
 * AP items are drawn as their looks (`apItemOps`). `__seedlingJsGraphics.enemies`
 * reads back what was drawn, body by body. With no stack nothing here runs.
 *
 * ⛓ GRAPHICS G3b — and so are the room bodies that are not chasers: the
 * wallflyers, drills, ice turrets and their blasts, turrets and their spits,
 * and the Bob Boss (`seedlingRoomBodySkin.js`: `roomBodySkinView` /
 * `stepRoomBodySkin` after every tick, `roomBodyOps` at each paint, Y-sorted
 * with the enemies). `__seedlingJsGraphics.roomBodies` reads them back.
 * ⛓ G3c — the spinning axes, crushers, lava chains, the Boss Totem and its
 * shots, the bomb pusher and its bombs, and the placed grenades
 * (`seedlingHazardSkin.js`: `hazardSkinView` / `stepHazardSkin` after every
 * tick, `hazardOps` at each paint, Y-sorted with the rest; their static solids
 * are not painted again, `roomOps`' `drawnObjects`).
 * `__seedlingJsGraphics.hazards` reads them back.
 * ⛓ G4 — the explosions, slash hits and rain (Y-sorted with the rest), and the
 * screen-anchored overlays on top: the talk bars and typed text (a placeholder
 * font — ⚖ the font is open), the totem's white-out, the hearts and the load
 * fade (`seedlingEffectSkin.js`). ⚖ The overlays sit on the MODEL's camera rect
 * in room mode too (⚖ CLAMPED to the canvas for a room narrower than the
 * screen, G4b F1; the talking NPC's box with its portrait and ALIGN from the
 * run's `talkingNow`, G4b-dialogue), and follow mode jiggles inside a shake band on the
 * renderer's own draw (user, 2026-10-21). ⛓ THE FADE HOLD: a room build's
 * dead frames are SPENT by the run, never ticked, so with a stack on the page
 * holds its clock for them — each owed frame is one tick slot that steps the
 * fade (`holdEffectSkin`) instead of the run. The run's inputs and ticks are
 * unchanged; only the wall clock waits. With no stack nothing here runs.
 * `__seedlingJsGraphics.effects` reads them back.
 *
 * ⛓ G1.5 — THE STATIC TILE LAYER: with a stack on, ROOM mode draws the room's
 * still tiles once onto an offscreen canvas and blits it each paint
 * (`seedlingSkinRenderer.paintOps`' `tileLayer`, rebuilt on a new world, art,
 * level, view or canvas size). The same pixels as drawing every tile, by
 * construction; follow mode (a moving view) does not use it. `?tileLayer=off`
 * turns it off (the A/B arm). `__seedlingJsGraphics.tileLayer` reads back its
 * builds/hits and how many ops it holds; `checkTileLayer()` paints the last
 * frame both ways onto two offscreen canvases and compares their pixels.
 *
 * ⛓ G5 — THE NIGHT LAYER: with a stack on and the lights ON (`?lights=on|off`,
 * the flash panel's `seedlingJsLights`; ON by default under a stack, nothing
 * without one), the room is darkened as `Game.bufferTransforms()` darkens it —
 * the night canvas (the lights, the glows, every `nightBmp` copy) MULTIPLIED
 * over the room, after the bodies and before the overlays
 * (`seedlingNightSkin.js`, `seedlingSkinRenderer.paintNight`). OFF is the
 * pre-G5 paint, op for op. `set({ lights })` switches it live;
 * `__seedlingJsGraphics.lights` reads it back.
 *
 * ⛓ G6 — THE EFFECTS SWITCH (`?effects=on|off`, the flash panel's
 * `seedlingJsEffects`; ON by default under a stack, nothing without one)
 * covers the two AMBIENT families that draw every frame whatever the player
 * does: G4's RAIN (the drops, and so their night copies) and G5's LAVA GLOW
 * (the lava tiles' night copies and their `solidBmp` edges, the costliest
 * night draws). OFF is the paint of a stack without those two families, op
 * for op. ⚖ The talk text is NOT in it: it is the game's dialogue, and it
 * costs only while someone talks (§5.135's catch-up A/B). `set({ effects })`
 * switches it live; `__seedlingJsGraphics.effectsSwitch` reads it back.
 *
 * ⛓ G7 — the stairs, the pushable blocks (at the run's own position, with
 * their sink fade) and the sand traps (`seedlingPuzzleSkin.js`: `puzzleSkinView`
 * / `stepPuzzleSkin` after every tick, `puzzleOps` at each paint, Y-sorted with
 * the rest; the blocks' build-time rectangles and the stairs' teleporter
 * rectangles are not painted). `__seedlingJsGraphics.puzzles` reads them back.
 * ⚖ And ONE fade per `new Game`: a reboot in place (an item delivery,
 * `jsRuntimeCore.IN_PLACE_REBOOT_WHY`) is a new run object but no new world in
 * the game, so it owes no fade (`seedlingEffectSkin.fadeSlot`); before G7 it
 * faded in from black a second time. ⚖ And ONE fade per CROSSING: each held
 * dead frame polls the host's queue as the game does (`runtime.drainItems`),
 * so the host's arrival teleport answering a door lands inside that door's
 * fade, which plays on; before, it waited out the hold and faded in again.
 *
 * ⛓ G8 — the changeable solids and the buttons (`seedlingSolidsSkin.js`: the
 * chests, breakable rocks, burnable trees and magical locks at the run's live
 * state; the locks, covers, boss locks, rock locks and buttons in their default
 * state, `SOLIDS_PENDING`). Their build-time rectangles are not painted.
 * `__seedlingJsGraphics.solids` reads them back. And the placed NPCs
 * (`seedlingNpcSkin.js`: each class's stand / talk frames, the facing, the talk
 * prompt, the Oracle's wake, the Watcher), `__seedlingJsGraphics.npcs`; and the
 * traps and falling rocks (`seedlingTrapSkin.js`), `__seedlingJsGraphics.traps`;
 * and the torches', orbs' and light poles' bodies (`seedlingLampSkin.js`; G5
 * draws their lights), `__seedlingJsGraphics.lamps`.
 *
 * ⛓ G9a — the placed vanilla pickups (`seedlingPickupSkin.js`: each class's frame, the wand's fade gate and bob,
 * the ceremony's risen item, the night copies and glows); their stand-in rectangles are not painted. An AP slot
 * stays G3's `apItemOps` look. `__seedlingJsGraphics.pickups`. ⛓ G9b — the machines (`seedlingMachineSkin.js`: the beam
 * towers and pulsers from `machinesNow`, the wires, whirlpools, pods, little stones, moonrock(s), the pile and the final
 * door; the Pull's circle onto nightBmp only), `__seedlingJsGraphics.machines`.
 *
 * ⛓ KILLLOCK HOOK —`?killLockBodies=<keys>|none` (the `SEEDLING_KILLLOCK_BODIES`
 * grammar) sets this page's `killLockBodies` switches before its first run;
 * absent = the defaults. The panel adds it only when its settings are
 * off-default, and re-mounts the page when they change. The worker gets the
 * set with each solve request (`killLockBodiesStamp`).
 */

import { createJsRuntime, IN_PLACE_REBOOT_WHY } from './jsRuntimeCore.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { applyKillLockBodies, parseKillLockBodies } from './killLockBodies.js';
import { applyContactFidelity, parseContactFidelity } from './contactFidelity.js';
import { applyAxeDodgeAsk, parseAxeDodgeAsk } from './axeDodgeAskHook.js';
import { applyDashOnlyWindow, parseDashOnlyWindow } from './dashOnlyWindowHook.js';
import { applyDashShape, parseDashShape } from './dashShapeHook.js';
import { heldFromCodes, KEYBOARD_BINDINGS } from './watchManual.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createLifetime } from './watchLifetime.js';
import {
    FLOOR_COLOUR, SOLID_COLOUR, TILE_COLOURS, objectSolidColour,
} from './rectPalette.js';
import { CAMERA_MODES, cameraView, createNightLayer, createTileLayer, paintNight, paintOps, roomOps } from './seedlingSkinRenderer.js';
import { playerOps, skinView, stepPlayerSkin } from './seedlingPlayerSkin.js';
import { apItemOps, enemyOps, enemySkinView, stepEnemySkin } from './seedlingEnemySkin.js';
import { roomBodyOps, roomBodySkinView, stepRoomBodySkin } from './seedlingRoomBodySkin.js';
import { HAZARD_OBJECT_TAGS, hazardOps, hazardSkinView, stepHazardSkin } from './seedlingHazardSkin.js';
import {
    adoptRunEffectSkin, carryThroughReboot, effectOps, effectSkinView, fadeSlot, jiggleCam, screenOps, stepEffectSkin,
} from './seedlingEffectSkin.js';
import { PUZZLE_OBJECT_TAGS, puzzleOps, puzzleSkinView, stepPuzzleSkin } from './seedlingPuzzleSkin.js';
import { SOLIDS_OBJECT_TAGS, solidsOps, solidsSkinView, stepSolidsSkin } from './seedlingSolidsSkin.js';
import { NPC_TAGS, npcOps, npcSkinView, stepNpcSkin } from './seedlingNpcSkin.js';
import { stepTrapSkin, trapOps, trapSkinView } from './seedlingTrapSkin.js';
import { lampOps, lampSkinView } from './seedlingLampSkin.js';
import { PICKUP_TAGS, pickupOps, pickupSkinView, stepPickupSkin } from './seedlingPickupSkin.js';
import { MACHINE_OBJECT_TAGS, machineNightOps, machineOps, machineSkinView, stepMachineSkin } from './seedlingMachineSkin.js';
import { EFFECT_RULES } from './seedlingEffectSkin.js';
import { NIGHT, nightMainOps, nightOps, nightSkinView, stepNightSkin } from './seedlingNightSkin.js';
import { BASE_TICKS_PER_SECOND, createRateMeter, createSlotClock, createSlotPump, messageChannelPostTask, parseGameSpeed } from './jsRuntimeClock.js';
import { loadPackStack, packsBaseUrl, parseRegistry } from '../contentPacks/contentPacks.js';
import { browserDecoder, createArtLibrary, loadSheetImages } from '../artLibrary/artLibrary.js';
import { createPageSound } from './jsRuntimeSound.js';

/** At 1× (`jsRuntimeClock.BASE_TICKS_PER_SECOND`; ⛓ GAME SPEED: × the speed). */
export const TICKS_PER_SECOND = BASE_TICKS_PER_SECOND;
/** The colour every paint clears the canvas to (and the static tile layer is filled with). */
const BACKGROUND = '#101014';
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
    const art = createArtLibrary(await loadPackStack(ids, { base, readJson, only: ['art'] }));
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
    // ⛓ DASH-SHAPE STAMP — and solverBot's three dash switches (`dashShapeHook.js`): `<key>:on|off,…` or `all`.
    const dashShapeParam = params.get('dashShape');
    if (dashShapeParam !== null) applyDashShape(parseDashShape(dashShapeParam, '?dashShape='));
    // ⛓ GRAPHICS G1 — the renderer's own state; nothing here reaches the runtime.
    const graphics = {
        stack: null, camera: 'room', status: 'off', error: null, failedSheets: [],
        art: null, images: null, counts: null, frames: 0,
        paintMs: { last: 0, avg: 0, max: 0 },
        // ⛓ G2 — the player picture's own state (one step per game tick) and the last paint's player ops.
        skin: null, player: null,
        // ⛓ G3 — the bodies' pictures (one step per game tick) and the last paint's body ops.
        enemySkin: null, enemies: null,
        // ⛓ G3b — the room bodies' pictures and the last paint's ops.
        roomBodySkin: null, roomBodies: null,
        // ⛓ G3c — the puzzlements' and the last bodies' pictures and the last paint's ops.
        hazardSkin: null, hazards: null,
        // ⛓ G7 — the stairs', pushable blocks' and sand traps' pictures and the last paint's ops.
        puzzleSkin: null, puzzles: null,
        // ⛓ G8 — the changeable solids' and buttons' pictures and the last paint's ops.
        solidsSkin: null, solids: null,
        // ⛓ G8 — the placed NPCs' pictures and the last paint's ops.
        npcSkin: null, npcs: null,
        // ⛓ G8 — the traps' and falling rocks' pictures and the last paint's ops.
        trapSkin: null, traps: null,
        // ⛓ G8 — the last paint's lamp-body ops (stateless: no per-tick step).
        lamps: null,
        // ⛓ G9a — the placed pickups' visit count and the last paint's ops.
        pickupSkin: null, pickups: null,
        // ⛓ G9b — the machines' per-visit state (lit wires, pull radii) and the last paint's ops.
        machineSkin: null, machines: null,
        // ⛓ G4 — the effects' and overlays' state (one step per game tick, one hold per owed dead frame), the last paint's.
        effectSkin: null, effects: null, held: 0,
        // ⛓ G1.5 — the static tile layer (room mode; `?tileLayer=off` = none) and the last paint's inputs.
        tileLayer: params.get('tileLayer') === 'off' ? null : createTileLayer(newCanvas), lastPaint: null,
        // ⛓ G5 — the lights switch (`?lights=off`; ON by default), the night layer's state and canvases, the last paint's.
        lights: params.get('lights') === 'off' ? 'off' : 'on', nightSkin: null, nightLayer: createNightLayer(newCanvas), night: null,
        // ⛓ G6 — the effects switch (`?effects=off`; ON by default): the rain and the lava glow. ⚠ NOT `effects`:
        // that is G4's last-paint readout.
        effectsSetting: params.get('effects') === 'off' ? 'off' : 'on',
    };
    /** ⛓ G6 — the families the effects switch draws, as the skins' options. */
    const effectsOn = () => graphics.effectsSetting === 'on';
    let graphicsLoad = 0;
    function setGraphics({ graphics: stack, camera, lights, effects } = {}) {
        if (effects !== undefined) {
            if (effects !== 'on' && effects !== 'off') throw new Error(`?effects=${effects}: one of on | off`);
            graphics.effectsSetting = effects;
        }
        if (lights !== undefined) {
            if (lights !== 'on' && lights !== 'off') throw new Error(`?lights=${lights}: one of on | off`);
            if (lights !== graphics.lights) Object.assign(graphics, { lights, nightSkin: null, night: null });
        }
        if (camera !== undefined) {
            if (!CAMERA_MODES.includes(camera)) throw new Error(`?camera=${camera}: one of ${CAMERA_MODES.join(' | ')}`);
            graphics.camera = camera;
        }
        if (stack === undefined || stack === graphics.stack) return Promise.resolve(graphics.status);
        const ticket = ++graphicsLoad;
        Object.assign(graphics, { stack: stack || null, art: null, images: null, error: null, failedSheets: [], counts: null, skin: null, player: null, enemySkin: null, enemies: null, roomBodySkin: null, roomBodies: null, hazardSkin: null, hazards: null, puzzleSkin: null, puzzles: null, solidsSkin: null, solids: null, npcSkin: null, npcs: null, trapSkin: null, traps: null, lamps: null, pickupSkin: null, pickups: null, machineSkin: null, machines: null, effectSkin: null, effects: null });
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
    // ⛓ SOUND EFFECTS — the page's sound (`jsRuntimeSound.js`): it reads the run after each tick and never feeds it.
    const sound = createPageSound({ win, params, listen: (target, type, handler) => life.on(target, type, handler) });
    // ⛓ ▶ START — `?start=click` (the panel's, for a person: `seedlingSoundSettings.startMode`): the page waits for its
    // ▶ Start (`#btn-start`, the wasm page's id) before it boots, as the wasm page does — the bridge's callbacks (what
    // the host waits for) appear only once it is pressed, and the tap unlocks the audio. Without it (an automated
    // run, or the page opened on its own, as the standalone in-app rows do) it boots at once, and the audio unlocks
    // on the first tap or key in the page.
    const startMode = params.get('start') === 'click' ? 'click' : 'auto';
    let started = false;
    // What waits for ▶ Start: the vanilla map's mount, which boots the game's own first frame (`Main.as:51`) — the
    // wasm game runs nothing before its Start either.
    const afterStart = [];
    const whenStarted = (fn) => (started ? fn() : afterStart.push(fn));
    /** Boot: expose the bridge's callbacks. Returns false if it already ran (the wasm page's `__swfBridgeStart`). */
    function start() {
        if (started) return false;
        started = true;
        sound.unlock();
        const b = doc.getElementById('btn-start');
        if (b) b.style.display = 'none';
        Object.assign(bridge.game, runtime.game);
        for (const fn of afterStart.splice(0)) fn();
        return true;
    }
    win.__swfBridgeStart = start;
    const startButton = doc.getElementById('btn-start');
    if (startMode === 'auto') {
        // REMOVED, not hidden: a tutorial's optional ▶ Start click (`startSeedlingGame`) skips an absent button but
        // waits on a present one
        startButton?.remove();
        Object.assign(bridge.game, runtime.game);
        started = true;
        for (const type of ['pointerdown', 'keydown']) life.on(doc, type, () => sound.unlock());
    } else if (startButton) {
        startButton.style.display = '';
        startButton.disabled = false;
        life.on(startButton, 'click', () => start());
    } else {
        start();
    }
    win.__seedlingJsSound = {
        get startMode() { return startMode; },
        get started() { return started; },
        get readout() { return sound.readout(); },
        set: (opts) => sound.set(opts),
        unlock: () => sound.unlock(),
    };
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
        get player() { return graphics.player ? { ...graphics.player } : null; },
        get enemies() { return graphics.enemies ? { ...graphics.enemies, ops: graphics.enemies.ops.map((o) => ({ ...o })) } : null; },
        get roomBodies() { return graphics.roomBodies ? { ...graphics.roomBodies, ops: graphics.roomBodies.ops.map((o) => ({ ...o })) } : null; },
        get hazards() { return graphics.hazards ? { ...graphics.hazards, ops: graphics.hazards.ops.map((o) => ({ ...o })) } : null; },
        /** ⛓ G7 — the last paint's stairs, pushable blocks and sand traps. */
        get puzzles() { return graphics.puzzles ? { ...graphics.puzzles, ops: graphics.puzzles.ops.map((o) => ({ ...o })) } : null; },
        /** ⛓ G8 — the last paint's chests, rocks, trees, locks and buttons. */
        get solids() { return graphics.solids ? { ...graphics.solids, ops: graphics.solids.ops.map((o) => ({ ...o })) } : null; },
        /** ⛓ G8 — the last paint's NPCs and talk prompts. */
        get npcs() { return graphics.npcs ? { ...graphics.npcs, ops: graphics.npcs.ops.map((o) => ({ ...o })) } : null; },
        /** ⛓ G8 — the last paint's traps and falling rocks. */
        get traps() { return graphics.traps ? { ...graphics.traps, ops: graphics.traps.ops.map((o) => ({ ...o })) } : null; },
        /** ⛓ G8 — the last paint's torches, orbs and light poles. */
        get lamps() { return graphics.lamps ? { ...graphics.lamps, ops: graphics.lamps.ops.map((o) => ({ ...o })) } : null; },
        /** ⛓ G9a — the last paint's placed pickups. */
        get pickups() { return graphics.pickups ? { ...graphics.pickups, ops: graphics.pickups.ops.map((o) => ({ ...o })) } : null; },
        /** ⛓ G9b — the last paint's machines. */
        get machines() { return graphics.machines ? { ...graphics.machines, ops: graphics.machines.ops.map((o) => ({ ...o })) } : null; },
        get effects() { return graphics.effects ? { ...graphics.effects, ops: graphics.effects.ops.map((o) => ({ ...o })), screen: graphics.effects.screen.map((o) => ({ ...o })) } : null; },
        /** ⛓ G4 — how many dead frames the fade hold has shown (the wall clock waited; the run did not tick). */
        get held() { return graphics.held; },
        /** ⛓ G6 — the effects switch: the setting, whether it draws (a stack on), and the families it covers. */
        get effectsSwitch() {
            return { setting: graphics.effectsSetting, on: !!graphics.stack && effectsOn(), families: ['rain', 'lavaGlow'] };
        },
        /** ⛓ G5 — the lights switch and the last paint's night layer (`alpha` 0 = this room is not darkened). */
        get lights() {
            const n = graphics.night;
            return { setting: graphics.lights, on: !!graphics.stack && graphics.lights === 'on',
                alpha: n ? n.alpha : 0, ops: n ? n.ops.length : 0, solid: n ? n.solid.length : 0,
                circles: n ? n.ops.filter((o) => o.circle).length : 0, counts: n?.counts ? { ...n.counts } : null,
                playerLight: graphics.nightSkin?.playerLight ? { ...graphics.nightSkin.playerLight } : null,
                paints: graphics.nightLayer.paints, redraws: graphics.nightLayer.redraws, reused: graphics.nightLayer.reused,
                solidRedraws: graphics.nightLayer.solidRedraws };
        },
        get tileLayer() {
            const l = graphics.tileLayer;
            return l ? { on: true, builds: l.builds, hits: l.hits, frameBuilds: l.frameBuilds, bakedOps: l.bakedOps, liveOps: l.liveOps } : { on: false };
        },
        checkTileLayer,
        checkNight,
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
        .then((doc) => whenStarted(() => runtime.setVanilla(doc)))
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
    // ⛓ GAME SPEED — 30 × the speed slots a second (`?speed=`, 0.25 … 16 — ⛓ CUSTOM SPEED; the panel's
    // `seedlingJsSpeed`; live through `__seedlingJsClock.set`), one slot per event-loop turn
    // (`jsRuntimeClock.createSlotPump` says why).
    let initialSpeed = 1;
    try { initialSpeed = parseGameSpeed(params.get('speed')); } catch (err) {
        win.console?.warn?.(`[js runtime] ${err.message} — playing at 1×`);
    }
    const clock = createSlotClock({ speed: initialSpeed });
    const rateMeter = createRateMeter();
    let lastFrameAt = 0;
    let soundTicks = null;
    /** One slot of the game's clock: an owed dead frame of a load fade (the run waits), else one run tick. */
    function slot() {
        sound.slotRan();
        // ⛓ G4 — the fade hold: an owed dead frame takes this tick slot, and the run waits.
        if (graphics.stack && runtime.run) {
            // a fresh run starts with its boot build's fade owed; a stack switched on mid-run owes nothing;
            // ⛓ G7 — and a reboot in place (an item delivery) owes no new fade: the game builds no world for it
            const slot = fadeSlot(graphics.effectSkin, effectView(), {
                run: runtime.run, fresh: runtime.run.ticksCompleted === 0, inPlace: lastBootInPlace, rain: effectsOn(),
            });
            graphics.effectSkin = slot.skin;
            if (slot.held) {
                graphics.held += 1;
                // ⛓ the game polls the host's queue on a dead frame too (`drainItems`): the arrival teleport that
                // answers a door lands inside that door's fade, which then plays on (`adoptRunEffectSkin`)
                runtime.drainItems();
                return;
            }
        }
        runtime.tick(heldFromCodes(down));
        // ⛓ SOUND EFFECTS — after the tick, reading it: a run that did not advance plays nothing new.
        const run = runtime.run;
        if (run && run.ticksCompleted !== soundTicks) {
            soundTicks = run.ticksCompleted;
            sound.step(run, { record: (runtime.mounted ?? runtime.vanilla)?.records?.get(run.level) ?? null,
                tick: runtime.ticks, tickSeconds: 1 / (BASE_TICKS_PER_SECOND * clock.speed) });
        }
        if (graphics.stack) {
            graphics.skin = stepPlayerSkin(graphics.skin, skinView(runtime.run), runtime.ticks);
            graphics.enemySkin = stepEnemySkin(graphics.enemySkin, enemySkinView(runtime.run), runtime.ticks);
            graphics.roomBodySkin = stepRoomBodySkin(graphics.roomBodySkin, roomBodySkinView(runtime.run), runtime.ticks);
            graphics.hazardSkin = stepHazardSkin(graphics.hazardSkin, hazardSkinView(runtime.run), runtime.ticks);
            graphics.puzzleSkin = stepPuzzleSkin(graphics.puzzleSkin, puzzleView(), runtime.ticks);
            graphics.solidsSkin = stepSolidsSkin(graphics.solidsSkin, solidsView(), runtime.ticks);
            graphics.npcSkin = stepNpcSkin(graphics.npcSkin, npcSkinView(runtime.run), runtime.ticks);
            graphics.trapSkin = stepTrapSkin(graphics.trapSkin, trapSkinView(runtime.run), runtime.ticks);
            graphics.pickupSkin = stepPickupSkin(graphics.pickupSkin, pickupSkinView(runtime.run), runtime.ticks);
            graphics.machineSkin = stepMachineSkin(graphics.machineSkin, machineView(), runtime.ticks);
            const fv = effectView();
            graphics.effectSkin = stepEffectSkin(carryThroughReboot(graphics.effectSkin, fv, { run: runtime.run, inPlace: lastBootInPlace }),
                fv, runtime.ticks, { rain: effectsOn() });
            if (graphics.lights === 'on') graphics.nightSkin = stepNightSkin(graphics.nightSkin, nightView(), runtime.ticks);
        }
    }
    const pump = createSlotPump({ clock, runSlot: slot, postTask: messageChannelPostTask(win) });
    function advance(now) {
        pump.frame(now);
        rateMeter.sample(now, pump.slots, runtime.ticks);
    }
    // ⛓ GAME SPEED — the clock's handle: the speed (a readout and the live switch) and the rate it achieves.
    win.__seedlingJsClock = {
        get speed() { return clock.speed; },
        get ticksPerSecond() { return clock.speed * BASE_TICKS_PER_SECOND; },
        get maxSlotsPerFrame() { return clock.maxSlots; },
        /** Slots and run ticks per second over the last second (a hold is a slot, not a tick). */
        get rate() { return rateMeter.rate; },
        get slots() { return pump.slots; },
        /** ⛓ CUSTOM SPEED — the speed the clock ACHIEVED over the last second (slots / s ÷ 30), 0 before a second ran. */
        get achievedSpeed() { return rateMeter.rate.slots / BASE_TICKS_PER_SECOND; },
        set: (speed) => clock.setSpeed(speed),
    };
    /** ⛓ G4 — the effects' view: the run, and the room's level record (the rain row the world does not keep). */
    function effectView() {
        const run = runtime.run;
        return effectSkinView(run, { record: run ? ((runtime.mounted ?? runtime.vanilla)?.records?.get(run.level) ?? null) : null });
    }
    /** ⛓ G7 — was the live run's boot a reboot in place (`jsRuntimeCore.IN_PLACE_REBOOT_WHY`)? Asked once per new run. */
    function lastBootInPlace() {
        const events = runtime.events;
        for (let i = events.length - 1; i >= 0; i -= 1) if (events[i].type === 'boot') return events[i].why === IN_PLACE_REBOOT_WHY;
        return false;
    }
    /** ⛓ G7 — the stairs', blocks' and sand traps' view: the run, and the room's level record (the stairs' direction and flip). */
    function puzzleView() {
        const run = runtime.run;
        return puzzleSkinView(run, { record: run ? ((runtime.mounted ?? runtime.vanilla)?.records?.get(run.level) ?? null) : null });
    }
    /** ⛓ G8 — the changeable solids' and buttons' view: the run, and the room's level record (the wires under a ButtonRoom). */
    function solidsView() {
        const run = runtime.run;
        return solidsSkinView(run, { record: run ? ((runtime.mounted ?? runtime.vanilla)?.records?.get(run.level) ?? null) : null });
    }
    /** ⛓ G9b — the machines' view: the run, and the room's level record (the wires, whirlpools, pods, stones). */
    function machineView() {
        const run = runtime.run;
        return machineSkinView(run, { record: run ? ((runtime.mounted ?? runtime.vanilla)?.records?.get(run.level) ?? null) : null });
    }
    /** ⛓ G5 — the night layer's view: the run, and the room's level record (its lights, shadows and rays). */
    function nightView() {
        const run = runtime.run;
        return nightSkinView(run, { record: run ? ((runtime.mounted ?? runtime.vanilla)?.records?.get(run.level) ?? null) : null });
    }
    function frame(now) {
        lastFrameAt = now;
        advance(now);
        sound.frame();
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
        ctx.fillStyle = BACKGROUND;
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
        const pv = art ? skinView(runtime.run) : null;
        const playerSprites = pv ? playerOps(pv, art, { tick: runtime.ticks, skin: graphics.skin }) : [];
        graphics.player = playerSprites.length
            ? { anim: graphics.skin?.anim ?? null, ops: playerSprites.map((o) => ({ key: o.key, frame: o.frame, flipX: o.flipX, tint: o.tint ?? null, pack: art.packOf(o.key) })) }
            : null;
        const ev = art ? enemySkinView(runtime.run) : null;
        const rv = art ? roomBodySkinView(runtime.run) : null;
        const bodySprites = rv ? roomBodyOps(rv, art, { skin: graphics.roomBodySkin }) : [];
        graphics.roomBodies = rv
            ? { bodies: graphics.roomBodySkin?.bodies.size ?? 0,
                ops: bodySprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, tint: o.tint ?? null, pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const hv = art ? hazardSkinView(runtime.run) : null;
        const hazardSprites = hv ? hazardOps(hv, art, { skin: graphics.hazardSkin }) : [];
        graphics.hazards = hv
            ? { bodies: graphics.hazardSkin?.bodies.size ?? 0,
                ops: hazardSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, rot: o.rot ?? 0, tint: o.tint ?? null, pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const pz = art ? puzzleView() : null;
        const puzzleSprites = pz ? puzzleOps(pz, art, { skin: graphics.puzzleSkin }) : [];
        graphics.puzzles = pz
            ? { stairs: pz.stairs.length, blocks: pz.blocks.length, traps: pz.traps.length,
                ops: puzzleSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, alpha: o.alpha ?? 1, tint: o.tint ?? null, flipX: !!o.flipX,
                    pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const sv = art ? solidsView() : null;
        const solidSprites = sv ? solidsOps(sv, art, { skin: graphics.solidsSkin }) : [];
        graphics.solids = sv
            ? { chests: sv.chests.length, rocks: sv.rocks.length, trees: sv.trees.length, magicalLocks: sv.magicalLocks.length,
                responders: sv.responders.length, rockLocks: sv.rockLocks.length, buttons: sv.buttons.length,
                ops: solidSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, alpha: o.alpha ?? 1, pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const nv = art ? npcSkinView(runtime.run) : null;
        const npcSprites = nv ? npcOps(nv, art, { skin: graphics.npcSkin }) : [];
        graphics.npcs = nv
            ? { talkers: nv.talkers.length, watchers: nv.watchers.length,
                ops: npcSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, flipX: !!o.flipX, pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const tv = art ? trapSkinView(runtime.run) : null;
        const trapSprites = tv ? trapOps(tv, art, { skin: graphics.trapSkin }) : [];
        graphics.traps = tv
            ? { arrowTraps: tv.arrowTraps.length, iceTraps: tv.iceTraps.length, darkTraps: tv.darkTraps.length, lavaTraps: tv.lavaTraps.length,
                fallRocks: tv.fallRocks.length,
                ops: trapSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const lv = art && runtime.run ? lampSkinView(runtime.run, { record: (runtime.mounted ?? runtime.vanilla)?.records?.get(runtime.run.level) ?? null }) : null;
        const lampSprites = lv ? lampOps(lv, art) : [];
        graphics.lamps = lv
            ? { torches: lv.torches.length, orbs: lv.orbs.length, poles: lv.poles.length,
                ops: lampSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const kv = art ? pickupSkinView(runtime.run) : null;
        const pickupSprites = kv ? pickupOps(kv, art, { skin: graphics.pickupSkin }) : [];
        graphics.pickups = kv
            ? { pickups: kv.pickups.length, taken: kv.taken, held: kv.pickups.find((p) => p.held)?.tag ?? null,
                ops: pickupSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, night: !!o.nightCopy, glow: o.nightExtra?.length ?? 0,
                    pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const mv = art ? machineView() : null;
        const machineSprites = mv ? machineOps(mv, art, { skin: graphics.machineSkin }) : [];
        graphics.machines = mv
            ? { beamTowers: mv.beamTowers.length, pulsers: mv.pulsers.length, wires: mv.wires.length,
                lit: graphics.machineSkin?.lit?.size ?? 0, pulls: mv.pulls.length, pods: mv.pods.length, rocks: mv.rocks.length, doors: mv.doors.length,
                ops: machineSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, line: !!o.line, ring: !!o.circle,
                    night: !!o.nightCopy, pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const enemySprites = ev ? enemyOps(ev, art, { skin: graphics.enemySkin }) : [];
        // ⛓ G7 — a run the effects have not met (booted between two clock slots: the game's own first frame) is adopted
        // before its first paint, so that paint shows the cover its fade starts from; before G7 it showed the bare room
        // for a frame. The next slot's `fadeSlot` then meets the same run (the same adoption, so the same fade).
        if (art && runtime.run && graphics.effectSkin?.epoch.run !== runtime.run) {
            graphics.effectSkin = adoptRunEffectSkin(graphics.effectSkin, effectView(),
                { fresh: runtime.run.ticksCompleted === 0, inPlace: lastBootInPlace() });
        }
        const fv = art && graphics.effectSkin ? effectView() : null;
        const effectSprites = fv ? effectOps(fv, art, { skin: graphics.effectSkin, rain: effectsOn() }) : [];
        // ⛓ G5 — the lights' MAIN-buffer ops (a ray's rects, an unlit pole's darkLight), Y-sorted with the bodies
        const lit = art && graphics.lights === 'on' ? nightView() : null;
        const modelCam = lit ? cameraView('follow', world, state, runtime.run) : null;
        const litMain = lit ? nightMainOps(lit, { cam: modelCam }) : [];
        const entitySprites = [...enemySprites, ...bodySprites, ...hazardSprites, ...puzzleSprites, ...solidSprites, ...npcSprites, ...trapSprites, ...lampSprites, ...pickupSprites, ...machineSprites, ...effectSprites, ...litMain];
        const apItemSprites = art ? apItemOps(apItems, art, AP_ITEM_COLOUR) : null;
        graphics.enemies = ev
            ? { bodies: ev.chasers.length + ev.spinners.length + ev.arrows.length, apItems: apItemSprites.length,
                ops: [...enemySprites, ...apItemSprites].map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, tint: o.tint ?? null,
                    pack: o.key ? art.packOf(o.key) : null })) }
            : null;
        const ops = roomOps(world, art, {
            level, tick: runtime.ticks, player: playerBoxAt(state.x, state.y), playerSprites, apItems,
            ...(art ? { apItemSprites, entitySprites, drawnObjects: (o) => HAZARD_OBJECT_TAGS.has(o.tag) || PUZZLE_OBJECT_TAGS.has(o.tag) || SOLIDS_OBJECT_TAGS.has(o.tag) || NPC_TAGS.has(o.tag)
                || MACHINE_OBJECT_TAGS.has(o.tag),
                drawnTeleporters: (tp) => tp.isStairs === true, drawnPickups: (p) => PICKUP_TAGS.has(p.tag) } : {}),
        });
        // ⚖ follow mode jiggles inside a shake band on the renderer's own draw; the band's edges are the model's
        const view = cameraView(graphics.camera, world, state, runtime.run,
            { jiggle: (now) => jiggleCam(now, level, runtime.ticks) });
        // ⚖ the overlays: on the displayed screen in follow mode, on the model's camera rect (its middle) in room mode,
        // ⚖ CLAMPED to the canvas there when the room is narrower than the screen (G4b F1, `overlayRect`)
        const roomMode = graphics.camera !== 'follow';
        const cam = roomMode ? cameraView('follow', world, state, runtime.run) : view;
        const overlays = fv ? screenOps(fv, art, { skin: graphics.effectSkin, cam, fitTo: roomMode ? world.world : null }) : [];
        graphics.effects = fv
            ? { explosions: graphics.effectSkin.explosions.length, slashes: graphics.effectSkin.slashes.length, droplets: graphics.effectSkin.droplets.length,
                hearts: { ...graphics.effectSkin.hearts }, cover: graphics.effectSkin.cover, owed: graphics.effectSkin.fadeQueue.length,
                talk: fv.dialogue ? { speaker: fv.dialogue.speaker ?? null, align: fv.dialogue.align ?? 'CENTER', portrait: fv.dialogue.portrait ?? null } : null,
                talkState: fv.talkState,
                ops: effectSprites.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, pack: o.key ? art.packOf(o.key) : null })),
                screen: overlays.map((o) => ({ key: o.key ?? null, frame: o.frame ?? null, colour: o.colour ?? null, alpha: o.alpha ?? 1, glyph: o.glyph ?? null })) }
            : null;
        const images = art ? graphics.images : null;
        // ⛓ G1.5 — a still view only: room mode. The key's world is the run's binding, a new object on every tile write.
        const tileLayer = graphics.tileLayer && roomMode ? { layer: graphics.tileLayer, key: [world, art, level], background: BACKGROUND } : null;
        const all = [...ops, ...overlays];
        graphics.lastPaint = { ops: all, images, view, key: [world, art, level] };
        // ⛓ G5 — the night layer goes between the room and the overlays (`Game.render()`: `bufferTransforms()` then `talk()`)
        const night = lit ? nightOps(lit, art, { skin: graphics.nightSkin, ops, hazard: hv ? { view: hv, skin: graphics.hazardSkin } : null,
            whiteOut: fv?.whiteOut ?? null, whiteOutAlpha: EFFECT_RULES.whiteOutAlpha, cam: modelCam, lavaGlow: effectsOn(),
            extra: mv ? machineNightOps(mv, { skin: graphics.machineSkin }) : [] }) : null;
        if (night) {
            const room = paintOps(ctx, ops, images, view, canvas, { tinted, tileLayer });
            night.counts = paintNight(ctx, night, images, view, canvas, { tinted, cache: graphics.nightLayer, fill: NIGHT.fill });
            const top = paintOps(ctx, overlays, images, view, canvas, { tinted });
            graphics.counts = { ops: all.length, ...Object.fromEntries(Object.keys(room).map((k) => [k, room[k] + (top[k] ?? 0)])) };
        } else {
            graphics.counts = { ops: all.length, ...paintOps(ctx, all, images, view, canvas, { tinted, tileLayer }) };
        }
        graphics.night = night;
        const ms = win.performance.now() - t0;
        graphics.frames += 1;
        const pm = graphics.paintMs;
        pm.last = ms;
        pm.max = Math.max(pm.max, ms);
        pm.avg = pm.avg + (ms - pm.avg) / Math.min(graphics.frames, 60);
        const label = graphics.stack ? ` · graphics ${graphics.stack}${graphics.status === 'ready' ? '' : ` (${graphics.status})`}` : '';
        writeStatus(level, label);
    }

    function newCanvas(w, h) {
        const c = doc.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }

    /**
     * ⛓ G1.5 — the layer's PIXEL check: the last paint's ops drawn onto two fresh offscreen canvases, every op
     * (no layer) and through a fresh layer, and their bytes compared. `{ same, pixels, differ, bakedOps }`.
     */
    function checkTileLayer() {
        const lp = graphics.lastPaint;
        if (!lp) return null;
        const paintOnce = (layer) => {
            const c = newCanvas(canvas.width, canvas.height);
            const cx = c.getContext('2d');
            cx.fillStyle = BACKGROUND;
            cx.fillRect(0, 0, c.width, c.height);
            paintOps(cx, lp.ops, lp.images, lp.view, c, { tinted, tileLayer: layer ? { layer, key: lp.key, background: BACKGROUND } : null });
            return cx.getImageData(0, 0, c.width, c.height).data;
        };
        const layer = createTileLayer(newCanvas);
        const a = paintOnce(null);
        const b = paintOnce(layer);
        let differ = 0;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differ += 1;
        return { same: differ === 0, pixels: a.length / 4, differ, bakedOps: layer.bakedOps, liveOps: layer.liveOps };
    }

    /**
     * ⛓ G5 — the night layer's PIXEL check: the canvas as the last paint left it vs the last paint's ops drawn onto a
     * fresh canvas WITHOUT the night layer (every op, no tile layer). Lights OFF: the same bytes (the pre-G5 paint);
     * lights ON in a dark room: they differ. `{ lights, alpha, pixels, differ, darker }` (`darker` = the canvas's
     * channel sum below the fresh paint's).
     */
    function checkNight() {
        const lp = graphics.lastPaint;
        if (!lp) return null;
        const c = newCanvas(canvas.width, canvas.height);
        const cx = c.getContext('2d');
        cx.fillStyle = BACKGROUND;
        cx.fillRect(0, 0, c.width, c.height);
        paintOps(cx, lp.ops, lp.images, lp.view, c, { tinted });
        const a = cx.getImageData(0, 0, c.width, c.height).data;
        const b = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let differ = 0;
        let sumA = 0;
        let sumB = 0;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) differ += 1;
            if ((i & 3) !== 3) { sumA += a[i]; sumB += b[i]; }
        }
        return { lights: graphics.lights, alpha: graphics.night?.alpha ?? 0, pixels: a.length / 4, differ, darker: sumB < sumA };
    }

    /**
     * ⛓ G2 — FlashPunk's `Image.color` MULTIPLIES the sprite (`Image.as` colour transform): the sheet
     * times the tint, keeping its own alpha. One cached copy per (sheet, tint).
     */
    const tintCache = new WeakMap();
    function tinted(img, tint) {
        let byTint = tintCache.get(img);
        if (!byTint) tintCache.set(img, byTint = new Map());
        if (!byTint.has(tint)) {
            const c = doc.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const t = c.getContext('2d');
            t.drawImage(img, 0, 0);
            // ⛓ G9c — `=colour` is a SILHOUETTE (the picture's alpha, filled): a Lock's INVERT is a white one under `difference`
            const silhouette = tint.startsWith('=');
            t.globalCompositeOperation = silhouette ? 'source-in' : 'multiply';
            t.fillStyle = silhouette ? tint.slice(1) : tint;
            t.fillRect(0, 0, c.width, c.height);
            t.globalCompositeOperation = 'destination-in';
            t.drawImage(img, 0, 0);
            byTint.set(tint, c);
        }
        return byTint.get(tint);
    }

    life.on(canvas, 'mousedown', () => canvas.focus());
    return runtime;
}
