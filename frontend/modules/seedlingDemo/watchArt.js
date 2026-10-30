/**
 * seedlingDemo/watchArt — **THE LAB PAGE DRAWN IN THE ORIGINAL GRAPHICS, STATIC** (slice seedling-lab-static-art,
 * lab arc L2).
 *
 * ⚖ (user, 2026-10-28) *"update the Seedling lab page and Editor to have the Seedling graphics … from the library,
 * like in the frontend panel"* — the art is drawn in the lab's OWN viewer (`watchViewer.makeRenderer`, the one
 * renderer every arm draws through: replay, scrub, solve, manual, generate, the editor and the set editor's room
 * stills), and *"we can leave animations out of the art in the lab page and Editor for now"*.
 *
 * ⛔ STATIC MEANS NOTHING IS STEPPED. Every picture is the one it shows at tick `LAB_ART_TICK` (0): the room's
 * tiles and scenery are `roomOps` at tick 0, the player is a FRESH skin state for its pose (`stepPlayerSkin(null,
 * …, 0)`), every enemy body is a fresh Spritemap (frame 0, never `stepEnemySkin`'d). A body's POSITION is the
 * sample's, per tick; its FRAME is not a function of the tick at all, so scrubbing backwards needs no re-step and
 * no snapshot. `watchArt.test.js` pins that with a mutant that steps the skin.
 *
 * ⛔ A READ-ONLY CONSUMER of the js arc's renderer (`seedlingSkinRenderer`, the player / enemy / pickup skins,
 * `artLibrary`, `contentPacks`): imported as is. The art is loaded the way `mazeRoom/mazeSeedlingSkin.js` loads it
 * (`contentPacks` + `artLibrary`, stack `graphics.seedling`) and NOT through `jsRuntimePage.loadGraphicsStack`,
 * which would pull the whole JS page in.
 *
 * ⛓ THE CACHE AND ITS INVALIDATION RULE are the renderer's own (`createTileLayer`): one static tile layer per
 * painted canvas, keyed on `[world, art, level]` plus the images, the view and the canvas size. The page builds
 * every world through `makeWorldFor`, and an edit (editor, set editor, generate) is a NEW world object, so an edit
 * rebuilds the layer and a scrub on the same room re-blits it. The objects, the shown portals, the pickups and
 * the bodies are drawn per paint, Y-sorted with each other (`roomOps`' own layer sort), so a tree still covers a
 * player standing behind it.
 *
 * ⛓ THE SCALE RULE: the art inherits the viewer's integer `fit()` scale — the canvas is the room × one integer
 * scale, so `paintOps`' `min(canvas / view)` IS that scale and a 16 px tile is `16 × scale` device pixels, with
 * `imageSmoothingEnabled = false`. No second scale, no fractional one.
 *
 * Split like the renderer: the op builders are pure and pinned in node; `loadLabArt` / the toggle are the browser
 * half.
 */
import { loadPackStack, packsBaseUrl, parseRegistry } from '../contentPacks/contentPacks.js';
import { browserDecoder, createArtLibrary, loadSheetImages } from '../artLibrary/artLibrary.js';
import { createTileLayer, paintOps, roomOps, shownTeleporters, teleporterArtFilter } from './seedlingSkinRenderer.js';
import { playerOps, stepPlayerSkin } from './seedlingPlayerSkin.js';
import { enemyOps, freshSprite } from './seedlingEnemySkin.js';
import { PICKUP_TAGS, pickupOps, pickupSkinView } from './seedlingPickupSkin.js';
import { playerBoxAt } from './playerPhysicsV2.js';
// ⛓ LAB L2b: the room's other objects, through the js arc's skins (imported as is) and the page's own run pair.
import { createRunForStaging, solveStaging } from './tapeRunner.js';
import { ROOM_BODY_OBJECT_TAGS, roomBodyOps, roomBodySkinView, stepRoomBodySkin } from './seedlingRoomBodySkin.js';
import { HAZARD_OBJECT_TAGS, hazardOps, hazardSkinView, stepHazardSkin } from './seedlingHazardSkin.js';
import { PUZZLE_OBJECT_TAGS, puzzleOps, puzzleSkinView, stepPuzzleSkin } from './seedlingPuzzleSkin.js';
import { SOLIDS_OBJECT_TAGS, solidsOps, solidsSkinView, stepSolidsSkin } from './seedlingSolidsSkin.js';
import { NPC_TAGS, npcOps, npcSkinView, stepNpcSkin } from './seedlingNpcSkin.js';
import { stepTrapSkin, trapOps, trapSkinView } from './seedlingTrapSkin.js';
import { lampOps, lampSkinView } from './seedlingLampSkin.js';
import { MACHINE_OBJECT_TAGS, machineOps, machineSkinView, stepMachineSkin } from './seedlingMachineSkin.js';
import { BOSS_OBJECT_TAGS, bossOps, bossSkinView, stepBossSkin } from './seedlingBossSkin.js';

/** The `packs.json` graphics stack (the JS page's `?graphics=seedling`, the maze's ruling 1). */
export const LAB_ART_STACK = 'graphics.seedling';
/** ⚖ static: the one tick every picture is read at. */
export const LAB_ART_TICK = 0;
/** The viewer's own background (`makeRenderer.draw`'s first fill). */
export const LAB_ART_BACKGROUND = '#101014';

// ── the room records (for the shown portals) ─────────────────────────────

/**
 * The map record a world was built from. `buildLevelWorld` keeps no record, and the portal rule
 * (`shownTeleporters`) reads the record's `show` attributes — so `makeWorldFor`, the page's one world builder,
 * registers each world's record here. A world with none draws every live teleporter as the stand-in.
 */
const roomRecords = new WeakMap();
/**
 * ⛓ LAB L2b: and, optionally, the room's CONTEXT `{levelSource, staging, scratchPersistence}` — what
 * `placementRunOf` builds the room's tick-0 run from (the same `createRunForStaging(solveStaging(…))` pair the
 * page runs with, booted in this room). A world registered without one draws the world-derived half only.
 */
const roomContexts = new WeakMap();
export function rememberRoomRecord(world, record, context = null) {
    if (world && record) roomRecords.set(world, record);
    if (world && context?.levelSource && context?.staging) roomContexts.set(world, context);
    return world;
}
export const roomRecordOf = (world) => roomRecords.get(world) ?? null;

// ── the static pictures (pure) ───────────────────────────────────────────

/**
 * The player's picture adapter at a run state, with NOTHING moving: `vx = vy = 0` (a stand pose), facing the
 * state's `direction` (`directionFace = direction`, which is how `mirror` turns a left-facing stand), the
 * terrain for the swim prefix, the blue suit and plain sword, no swing, no fall, no tint. ONE epoch object for
 * every call: the skin is fresh each paint anyway.
 */
const STATIC_EPOCH = Object.freeze({ static: true });
export function staticPlayerView(state, level = 0) {
    if (!state) return null;
    const direction = Number.isInteger(state.direction) ? state.direction : 3;
    return {
        epoch: STATIC_EPOCH, level, x: state.x, y: state.y, vx: 0, vy: 0,
        direction, directionFace: direction, terrain: state.terrain ?? 0,
        hitsTimer: 0, frozenTimer: 0, suit: 'blue', sword: 'plain', slash: null, fall: null, bossFade: null,
    };
}

/** The player's ops: a FRESH skin for the pose, read at `LAB_ART_TICK`. `[]` without art (the caller's rect). */
export function staticPlayerOps(state, art, { level = 0 } = {}) {
    const view = staticPlayerView(state, level);
    if (!view || !art) return [];
    const skin = stepPlayerSkin(null, view, LAB_ART_TICK);
    return playerOps(view, art, { tick: LAB_ART_TICK, skin });
}

/**
 * The bodies a sample carries (`watchOverlays.sampleMovers`' `bodies`: chasers `{id, tag, x, y}`, spinners
 * `{kind: 'spinner', id, x, y}`), each as frame 0 of its family's sheet — a fresh Spritemap, never stepped. A
 * body with no family or no art is `enemyOps`' own fallback rectangle.
 */
export function staticBodyOps(bodies, art, { level = 0 } = {}) {
    if (!art || !bodies?.length) return [];
    const chasers = [];
    const spinners = [];
    const skinBodies = new Map();
    for (const b of bodies) {
        if (!b) continue;
        if (b.kind === 'spinner') {
            spinners.push({ id: b.id, x: b.x, y: b.y, hits: 0, hitsTimer: 0, destroy: false, alpha: 1 });
            skinBodies.set(`s:${b.id}`, { tint: null, prevHits: 0, deathScale: 1, hammer: 0 });
        } else if (b.tag) {
            chasers.push({ id: b.id, tag: b.tag, x: b.x, y: b.y, vx: 0, vy: 0, hits: 0, hitsTimer: 0,
                dying: false, destroy: false, alpha: 1 });
            skinBodies.set(`c:${b.id}`, { sprite: freshSprite(), tint: null, mirrored: false, prevHits: 0 });
        }
    }
    const view = { epoch: STATIC_EPOCH, level, gameTime: null, player: null, chasers, spinners, arrows: [] };
    return enemyOps(view, art, { skin: { epoch: STATIC_EPOCH, bodies: skinBodies } });
}

/**
 * The room's placed pickups at tick 0 (`pickupSkinView` over a run-shaped stub: the world, its level, no clock,
 * nothing taken). The viewer's world is the level's BUILD and is never advanced, so a pickup the run took is
 * still drawn — the same base picture the rectangle view shows.
 */
export function staticPickupOps(world, art) {
    if (!art || !world?.pickups?.length) return [];
    const view = pickupSkinView({ state: { x: 0, y: 0 }, world, level: world.level });
    return pickupOps(view, art);
}

// ── LAB L2b: the room's other objects (blocks, hazards, NPCs, machines, static enemies, bosses) ──

/**
 * ⛓ THE PLACEMENT RUN — the room's run at tick 0, NEVER ADVANCED, built the way the page builds every run
 * (`createRunForStaging(solveStaging(staging))`, the boot moved into this room). It is the source of the rows a
 * skin reads off a run rather than off the world: a crusher's centre, a shield boss's `sit`, a watcher, a
 * shooter, a pulser, a lava boss, the tentacle beast's `under`… — the game's own first frame of each, so the
 * lab writes no second copy of their shapes. Memoised per world (an edit is a new world). A room whose run
 * refuses to build (or a world registered without a context) is `null`: its skins draw the world-derived half
 * (stairs, blocks, rocks, locks, buttons, traps, lamps, axes, chains, talkers…) and nothing run-only.
 *
 * ⚠ `solveStaging` = `noDamage: false`: the wallflyer stepper's own gate (`roomBodySkinView`'s `stepped`).
 */
const placementRuns = new WeakMap();
export const PLACEMENT_BOOT = Object.freeze({ x: 0, y: 0 });
export function placementRunOf(world) {
    if (!world || typeof world !== 'object') return null;
    if (placementRuns.has(world)) return placementRuns.get(world);
    const ctx = roomContexts.get(world) ?? null;
    let run = null;
    if (ctx) {
        try {
            const staging = { ...ctx.staging, boot: { ...ctx.staging.boot, level: world.level, ...PLACEMENT_BOOT } };
            run = createRunForStaging(solveStaging(staging), ctx.levelSource, { scratchPersistence: !!ctx.scratchPersistence });
        } catch (e) {
            run = null;
        }
    }
    placementRuns.set(world, run);
    return run;
}

/** The run rows the skins read (`read(run, name)`), copied ONCE off the placement run. */
const RUN_ROWS = Object.freeze([
    'crushers', 'bossesWoken', 'bossShots', 'bombPushers', 'bombs', 'placedGrenades', 'pushables', 'staticBodies',
    'talkCircles', 'talkingNow', 'watchers', 'inventory', 'rockFalls', 'darkTraps', 'wallFlyers', 'drills', 'turrets',
    'turretDamage', 'bobBoss', 'blastsInFlight', 'shooters', 'shieldBosses', 'finalBosses', 'lavaBossFight',
    'tentacleBeastFight', 'lightsFight', 'owlProjectilesNow', 'machinesNow', 'activatorsNow', 'owlPods', 'moonrock',
    'pulls', 'finalDoors', 'lightPolesNow', 'gameTime', 'transitions', 'playerDeaths', 'noDamage',
]);
const placementRows = new WeakMap();
function placementRowsOf(world) {
    if (placementRows.has(world)) return placementRows.get(world);
    const run = placementRunOf(world);
    const rows = {};
    if (run) {
        for (const k of RUN_ROWS) {
            try { if (k in run) rows[k] = run[k]; } catch (e) { /* a getter that refuses at tick 0: absent */ }
        }
    }
    placementRows.set(world, rows);
    return rows;
}

/** The families of a sample's `changes` (`watchOverlays.sampleMovers`) that are a run SET the skins read. */
const CHANGE_SETS = Object.freeze(['openActivators', 'openChests', 'brokenRocks', 'burnedTrees']);

/**
 * ⛓ THE STATIC RUN — a run-shaped object for the skins' views: the placement rows, the lab's own world and
 * the player's state, OVERLAID with what the sample at the cursor says the run has changed (a pushed block at
 * its sampled position, a sunk one gone; a broken rock, an opened chest or lock, a burned tree; a dead ice
 * turret). A sample that does not carry a channel (`changeCounts: null`, the v1 engine) leaves the build look.
 * ⚠ Not carried by the sample, so drawn as built: a pressed button, a taken pickup, a woken boss.
 */
export function staticRunOf(world, state, sample = null) {
    const rows = placementRowsOf(world);
    const run = { ...rows, world, level: world.level, state: state ?? { x: 0, y: 0 }, ticksCompleted: LAB_ART_TICK };
    const s = sample && sample.level === world.level ? sample : null;
    if (s?.changeCounts) {
        for (const set of CHANGE_SETS) run[set] = new Set();
        for (const c of s.changes ?? []) if (CHANGE_SETS.includes(c.family)) run[c.family].add(c.id);
    }
    if (s && Array.isArray(s.pushables) && s.changeCounts) {
        const pushables = new Map();
        for (const b of s.pushables) pushables.set(b.id, { rect: { x: b.x, y: b.y, w: b.w, h: b.h }, removed: false, destroy: false });
        for (const c of s.changes ?? []) if (c.family === 'pushables' && c.effect === 'gone') pushables.set(c.id, { rect: c.base, removed: true });
        run.pushables = pushables;
    }
    if (s?.changeCounts && rows.turrets instanceof Map) {
        const dead = new Set((s.changes ?? []).filter((c) => c.family === 'turrets' && c.effect === 'swapped').map((c) => c.id));
        if (dead.size) run.turrets = new Map([...rows.turrets].map(([id, t]) => [id, dead.has(id) ? { ...t, dead: true, solid: true } : t]));
    }
    return run;
}

/**
 * The skin families, each `[name, view(run, record), step | null, ops]`, in the JS page's paint order
 * (`jsRuntimePage.paintSkinned`). Every one is read at ONE fresh step (`step(null, view, LAB_ART_TICK)`): the
 * frame a fresh game shows, never stepped again.
 */
export const LAB_SKIN_FAMILIES = Object.freeze([
    ['roomBody', (r) => roomBodySkinView(r), stepRoomBodySkin, roomBodyOps],
    ['hazard', (r) => hazardSkinView(r), stepHazardSkin, hazardOps],
    ['puzzle', (r, record) => puzzleSkinView(r, { record }), stepPuzzleSkin, puzzleOps],
    ['solids', (r, record) => solidsSkinView(r, { record }), stepSolidsSkin, solidsOps],
    ['npc', (r) => npcSkinView(r), stepNpcSkin, npcOps],
    ['trap', (r) => trapSkinView(r), stepTrapSkin, trapOps],
    ['lamp', (r, record) => lampSkinView(r, { record }), null, lampOps],
    ['machine', (r, record) => machineSkinView(r, { record }), stepMachineSkin, machineOps],
    ['boss', (r) => bossSkinView(r), stepBossSkin, bossOps],
].map(Object.freeze));

/**
 * The `roomOps` objects each family's skin draws instead of the rectangle stand-in (the JS page's own
 * `drawnObjects`, split by family so a family whose skin refused keeps ITS stand-ins only).
 */
export const FAMILY_OBJECT_TAGS = Object.freeze({
    hazard: HAZARD_OBJECT_TAGS, puzzle: PUZZLE_OBJECT_TAGS, solids: SOLIDS_OBJECT_TAGS, npc: NPC_TAGS,
    machine: MACHINE_OBJECT_TAGS, boss: BOSS_OBJECT_TAGS,
    // the ice turret's object solid is its CORPSE wall (`sampleMovers`: "ALIVE — an ice turret is an Enemy, not a
    // wall"), so with the room-body skin drawing the turret the stand-in goes — but only when that skin drew something
    // (no placement run: the stand-in stays). The JS page's rule too (`seedlingRoomBodySkin.roomBodyDrawnObjects`).
    roomBody: ROOM_BODY_OBJECT_TAGS,
});
export function labDrawnObjects(byFamily) {
    const sets = Object.entries(FAMILY_OBJECT_TAGS)
        .filter(([name]) => byFamily[name] !== null && (name !== 'roomBody' || byFamily[name]?.length > 0)).map(([, tags]) => tags);
    return (o) => sets.some((tags) => tags.has(o.tag));
}

/**
 * The room's objects as ONE static frame each, per family: `{name: ops}`. `stepSkin` is the test seam for the
 * tick-independence mutant (the default is the one fresh step).
 */
export function staticEntityOpsByFamily(world, art, { record = null, state = null, sample = null,
    stepSkin = (step, view) => step(null, view, LAB_ART_TICK) } = {}) {
    const out = {};
    if (!art || !world) return out;
    const run = staticRunOf(world, state, sample);
    for (const [name, view, step, ops] of LAB_SKIN_FAMILIES) {
        try {
            const v = view(run, record);
            out[name] = v ? ops(v, art, { skin: step ? stepSkin(step, v) : undefined }) : [];
        } catch (e) {
            // ⚠ a skin that refuses this room draws nothing; the stand-in stays (below)
            out[name] = null;
        }
    }
    return out;
}

/**
 * The bodies to draw when the sample has none for this room (the editor, a still, a scrub off the tape's
 * rooms): the placement run's chasers and spinners, in the sample's body shape.
 */
export function placementBodies(world) {
    const run = placementRunOf(world);
    if (!run) return [];
    const bodies = [];
    try {
        for (const c of run.chasers ?? []) if (c.tag) bodies.push({ id: c.id, kind: 'chaser', tag: c.tag, x: c.x, y: c.y });
        for (const s of run.spinnerBodies ?? []) bodies.push({ id: s.id, kind: 'spinner', tag: 'spinner', x: s.x, y: s.y });
    } catch (e) { return []; }
    return bodies;
}

/**
 * THE DRAW LIST for one viewer paint: the room at tick 0 (tiles, cliffsides, scenery, shown portals), the
 * pickups, the room's objects (L2b), the bodies and the player, Y-sorted by `roomOps`. `record` (the room's map
 * record) decides which teleporters are SHOWN, as on the JS page; without it every live teleporter is its
 * stand-in. A family whose skin refused keeps its objects' rectangle stand-ins.
 */
export function labArtOps(world, art, { record = null, state = null, bodies = [], sample = null } = {}) {
    const level = world.level;
    const playerSprites = state ? staticPlayerOps(state, art, { level }) : null;
    const byFamily = staticEntityOpsByFamily(world, art, { record, state, sample });
    const entitySprites = [...staticPickupOps(world, art), ...Object.values(byFamily).flatMap((o) => o ?? []),
        ...staticBodyOps(bodies, art, { level })];
    const ops = roomOps(world, art, {
        // `player`: the white box `roomOps` draws when there are no player sprites (a stack without the suit).
        level, tick: LAB_ART_TICK, playerSprites, entitySprites, player: state ? playerBoxAt(state.x, state.y) : null,
        drawnPickups: art ? (p) => PICKUP_TAGS.has(p.tag) : null,
        drawnObjects: art ? labDrawnObjects(byFamily) : null,
        ...(art && record ? { drawnTeleporters: teleporterArtFilter(record), shownTeleporter: shownTeleporters(record) } : {}),
    });
    // ⛓ the readout's per-family SPRITE counts (null = that family's skin refused), carried on the list unenumerated
    Object.defineProperty(ops, 'families', { value: Object.fromEntries(Object.entries(byFamily)
        .map(([name, o]) => [name, o === null ? null : o.filter((x) => x?.sheetRef).length])) });
    return ops;
}

// ── the set editor's still key ───────────────────────────────────────────

/**
 * The set editor's stills cache compares keys by IDENTITY (`setEditorView`: `still.key !== key`), and keys on the
 * room's `source` object (copy-on-write: an edited room is a new source). A still drawn with the art is not the
 * still drawn as rectangles, so the key is one STABLE object per (source, mode): a toggle misses, a repaint in
 * the same mode hits. `null` stays `null` (no still).
 */
const stillKeys = new WeakMap();
export function labStillKey(source, active = labArtActive()) {
    if (source === null || typeof source !== 'object') return source ?? null;
    if (!stillKeys.has(source)) stillKeys.set(source, { art: { source, mode: 'art' }, rect: { source, mode: 'rect' } });
    return stillKeys.get(source)[active ? 'art' : 'rect'];
}

// ── the cached layer (one per painted canvas) ────────────────────────────

/**
 * A painter: `paint(ctx, canvas, world, ops, images, art)` draws `ops` over the whole room through `paintOps`,
 * with the static tile layer cached per CANVAS (`previewLevel` makes a new renderer per still, on the same
 * canvas, so the cache cannot live on the renderer). `layerOf(canvas)` reads the layer's `builds` / `hits`.
 */
export function createLabArtPainter(newCanvas) {
    const layers = new WeakMap();
    const layerOf = (canvas) => {
        if (!layers.has(canvas)) layers.set(canvas, createTileLayer(newCanvas));
        return layers.get(canvas);
    };
    return {
        layerOf,
        paint(ctx, canvas, world, ops, images, art) {
            const view = { x: 0, y: 0, w: world.world.width, h: world.world.height };
            return paintOps(ctx, ops, images, view, canvas, {
                tileLayer: { layer: layerOf(canvas), key: [world, art, world.level], background: LAB_ART_BACKGROUND },
            });
        },
    };
}

// ── the page state: load once, a toggle, one redraw slot ─────────────────

/**
 * The page's art, loaded ONCE (a failure is kept, never retried in a loop). `on` is the toggle — default on
 * unless `?art=off` (or `0`); it only takes effect once `status === 'ready'`.
 */
export const labArt = { status: 'idle', art: null, images: null, failed: [], credit: '', why: null, on: true };

export function artParamOn(search) {
    const v = new URLSearchParams(search ?? '').get('art');
    return !(v === 'off' || v === '0' || v === 'false');
}

/** Is the art drawn on this paint? */
export const labArtActive = () => labArt.on && labArt.status === 'ready';

/**
 * ⛓ THE ONE REDRAW SLOT. Only one arm is live at a time, and it registers how to repaint what it is showing
 * (`setLabArtRedraw(fn, lifetime)`); the load finishing and the toggle both call it. A retired arm clears its
 * own registration only.
 */
let redrawSlot = null;
export function setLabArtRedraw(fn, lifetime = null) {
    redrawSlot = fn;
    lifetime?.onRetire?.(() => { if (redrawSlot === fn) redrawSlot = null; });
}
/** Test-only: the registered redraw. */
export const _labArtRedrawForTests = () => redrawSlot;
function fireRedraw() {
    try { redrawSlot?.(); } catch (e) { console.warn('watchArt: the redraw after an art change threw', e); }
}

let loadPromise = null;
export function loadLabArt({ win = globalThis, base = packsBaseUrl() } = {}) {
    if (loadPromise) return loadPromise;
    const readJson = async (url) => {
        const r = await win.fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };
    labArt.status = 'loading';
    loadPromise = (async () => {
        try {
            const registry = parseRegistry(await readJson(new URL('packs.json', base).href));
            const name = LAB_ART_STACK.slice('graphics.'.length);
            const ids = registry.stacks[name];
            if (!ids) throw new Error(`no graphics stack "${name}" in packs.json`);
            const stack = await loadPackStack(ids, { base, readJson, only: ['art'] });
            const art = createArtLibrary(stack);
            const { images, failed } = await loadSheetImages(art, browserDecoder(win));
            const credit = stack.map((l) => l.pack?.credit).filter(Boolean).join(' · ');
            Object.assign(labArt, { status: 'ready', art, images, failed, credit, why: null });
        } catch (e) {
            Object.assign(labArt, { status: 'failed', art: null, images: null, why: e?.message ?? String(e) });
        }
        renderToggle();
        fireRedraw();
        return labArt;
    })();
    return loadPromise;
}

/** Test-only: forget the loaded art and the slot. */
export function _resetLabArtForTests() {
    loadPromise = null;
    redrawSlot = null;
    Object.assign(labArt, { status: 'idle', art: null, images: null, failed: [], credit: '', why: null, on: true });
}

/**
 * ⛓ THE READOUT, `window.__labArt`: the art's state and what the MAIN canvas's last draw painted with it
 * (`paintOps`' counts, or null for rectangles) — written by the draw itself (`makeRenderer.draw`, main canvas
 * only: a set-editor still must not overwrite it), so a browser row reads the driven system, not the widget.
 */
let lastDrawn = null;
export function publishLabArtDraw(drawn = lastDrawn, win = globalThis) {
    lastDrawn = drawn;
    win.__labArt = {
        status: labArt.status, on: labArt.on, active: labArtActive(), why: labArt.why,
        failedSheets: labArt.failed.length, drawn: drawn ? { ...drawn } : null,
    };
}

// ── the toggle (its own container, `#labArtBox` — NOT `#layers`, which is enumerated) ──

let toggleBox = null;
function renderToggle() {
    if (!toggleBox) return;
    const input = toggleBox.querySelector('input');
    const note = toggleBox.querySelector('.labArtNote');
    input.checked = labArt.on;
    input.disabled = labArt.status === 'failed';
    note.textContent = {
        idle: '', loading: ' (loading…)',
        ready: labArt.failed.length ? ` (${labArt.failed.length} sheet(s) failed to decode: rectangles there)` : '',
        failed: ` (the art did not load — rectangles: ${labArt.why})`,
    }[labArt.status];
    toggleBox.dataset.artStatus = labArt.status;
    publishLabArtDraw();
}

/**
 * Mount the "Seedling art" checkbox once into `box` (idempotent), start the load, and read `?art=`.
 * `.onchange`, the page's idiom.
 */
export function mountLabArtToggle(box, { search = globalThis.location?.search } = {}) {
    if (!box) return;
    if (toggleBox !== box) {
        toggleBox = box;
        labArt.on = artParamOn(search);
        box.innerHTML = '';
        const label = document.createElement('label');
        label.title = 'Draw the room, the player and the bodies in the original Seedling graphics (static: '
            + 'one frame each, no animation). Off: the debug rectangles. The overlays draw on top either way.';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'lab-art';
        input.onchange = () => { labArt.on = input.checked; renderToggle(); fireRedraw(); };
        const note = document.createElement('span');
        note.className = 'labArtNote note';
        label.appendChild(input);
        label.appendChild(document.createTextNode(' Seedling art'));
        label.appendChild(note);
        box.appendChild(label);
    }
    renderToggle();
    loadLabArt();
}
