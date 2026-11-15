/**
 * seedlingDemo/seedlingLevelBake — **ONE SEEDLING LEVEL, BAKED AS A STILL PICTURE** (region-map step 1, D1).
 *
 * A level RECORD (`{width, height, layers, entities}` — a `seedling-map.json` level, or a generated room's embedded
 * `record`) in, a canvas of its room at tick 0 out: tiles, cliffsides, scenery, the teleporters the game SHOWS and the
 * stairs sprites. Two readers:
 *   · the maze's Seedling skin (`mazeRoom/mazeSeedlingSkin.js`) — `bakeSeedlingLayer` / `staticOps` are thin
 *     wrappers over this file, passing the census of what the MAZE draws itself as `excluded`;
 *   · the composite map's Seedling cell (`flashPanel/seedlingCompositeMap.js`) — the whole level, nothing excluded.
 *
 * ⛔ **NO `mazeRoom/` IMPORTS** (⚖ seedling-js-planning-19, 2026-11-14). Everything here sits beside its real inputs:
 * `seedlingSkinRenderer` (`roomOps`/`paintOps`/`TILE`/`shownTeleporters`/`teleporterArtFilter`), `levelWorld`,
 * `seedlingPuzzleSkin.puzzleOps` and `seedlingSetPatches.patchedMapDocument`. The width and height come from the
 * RECORD, never from a maze world, and the canvas from an injected `newCanvas(w, h)` (so `OffscreenCanvas` works).
 *
 * Split like the renderer: `levelRecordFor` / `levelWorldFor` / `levelStaticOps` are pure and pinned in node
 * (`seedlingLevelBake.test.js`, `fixtures/level-bake-goldens/`); `loadSeedlingArt` and `bakeLevel` are the browser
 * half (pixels need a browser).
 */
import { loadPackStack, packsBaseUrl, parseRegistry } from '../contentPacks/contentPacks.js';
import { browserDecoder, createArtLibrary, loadSheetImages } from '../artLibrary/artLibrary.js';
import { buildLevelWorld } from './levelWorld.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { TILE, paintOps, roomOps, shownTeleporters, teleporterArtFilter } from './seedlingSkinRenderer.js';
import { puzzleOps } from './seedlingPuzzleSkin.js';

/** The `packs.json` graphics stack the JS page's `?graphics=seedling` loads (maze-seedling-art ⚖ ruling 1). */
export const SEEDLING_GRAPHICS_STACK = 'graphics.seedling';
/** What a baked room is cleared to before the tiles (the JS page's own background). */
export const SEEDLING_BACKGROUND = '#101014';
/** No object excluded: the whole room. */
const NOTHING = Object.freeze(new Set());

/**
 * ⛓ ONE record and ONE built world per (map document, level): the PATCHED (delivered) rooms. The renderer's tile-op
 * cache keys on the world OBJECT, so every reader of a level must get the same one — the maze skin and the composite
 * map share this cache. `levelRecordFor` answers null for a level the map lacks (the caller names the refusal).
 */
const mapSlots = new WeakMap();
function slotOf(mapDoc) {
    if (!mapSlots.has(mapDoc)) {
        const patched = patchedMapDocument(mapDoc);
        mapSlots.set(mapDoc, { byLevel: new Map((patched.levels ?? []).map((r) => [r.level, r])), worlds: new Map() });
    }
    return mapSlots.get(mapDoc);
}

/** The patched record of `level` in `mapDoc`, or null. `size` is how many levels the map has (for a refusal). */
export function levelRecordFor(mapDoc, level) {
    const slot = slotOf(mapDoc);
    return { record: slot.byLevel.get(level) ?? null, size: slot.byLevel.size };
}

/** `{record, world}` for (map, level) — one world object per pair. Throws by name for a level the map lacks. */
export function levelWorldFor(mapDoc, level) {
    const slot = slotOf(mapDoc);
    const record = slot.byLevel.get(level);
    if (!record) throw new Error(`seedlingLevelBake: the map has no level ${level} (it has ${slot.byLevel.size})`);
    if (!slot.worlds.has(level)) slot.worlds.set(level, buildLevelWorld(record));
    return { record, world: slot.worlds.get(level) };
}

/** A built world for a free-standing record (a generated room's), one per record OBJECT. */
const recordWorlds = new WeakMap();
export function recordWorldOf(record) {
    if (!recordWorlds.has(record)) recordWorlds.set(record, buildLevelWorld(record));
    return recordWorlds.get(record);
}

/** `seedlingPuzzleSkin`'s `STAIRS` and its view's stairs rows (`puzzleSkinView`), from the record alone. */
const STAIRS = Object.freeze({ stairsup: true, stairsdown: false });
export function stairsOps(record, art) {
    if (!art) return null;
    const stairs = (record?.entities ?? []).filter((e) => e.type in STAIRS).map((e) => ({
        x: Number(e.x), y: Number(e.y), up: STAIRS[e.type], flip: Boolean(Number(e.attrs?.flip ?? 0)),
    }));
    return puzzleOps({ stairs, blocks: [], traps: [], gameTime: 0 }, art, { skin: { bodies: new Map() } });
}

/**
 * THE BAKED ROOM'S DRAW LIST, PURE: tiles, cliffsides and scenery at tick 0. Every placed pickup is hidden (a
 * location is the host's to mark); a teleporter keeps a stand-in only where the game SHOWS one
 * (`teleporterArtFilter`), a SHOWN one is the portal at frame 0, and the stairs are `puzzleOps`' own sprites.
 * `excluded` = the `${tag}@${x},${y}` ids of objects some other layer draws (the maze's census); empty = all of them.
 */
export function levelStaticOps(levelWorld, art, { level, record, excluded = NOTHING }) {
    return roomOps(levelWorld, art, {
        level,
        tick: 0,
        drawnPickups: () => true,
        drawnTeleporters: teleporterArtFilter(record),
        shownTeleporter: shownTeleporters(record),
        drawnObjects: (o) => excluded.has(`${o.tag}@${o.x},${o.y}`),
        entitySprites: stairsOps(record, art),
    });
}

/**
 * ⛓ The art, loaded ONCE per page (a module-level promise; a failure is kept and re-thrown by name, never retried
 * in a loop). Recomposed from `contentPacks` + `artLibrary` — ⛔ not `jsRuntimePage.loadGraphicsStack`, which would
 * pull the whole JS page in. Resolves `{ art, images, failed, credit }`. `mazeSeedlingSkin` re-exports it, so the
 * maze and the composite map share one load.
 */
let artPromise = null;
export function loadSeedlingArt({ win = globalThis, base = packsBaseUrl() } = {}) {
    if (artPromise) return artPromise;
    const readJson = async (url) => {
        const r = await win.fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };
    artPromise = (async () => {
        const registry = parseRegistry(await readJson(new URL('packs.json', base).href));
        const name = SEEDLING_GRAPHICS_STACK.slice('graphics.'.length);
        const ids = registry.stacks[name];
        if (!ids) throw new Error(`no graphics stack "${name}" in packs.json`);
        const stack = await loadPackStack(ids, { base, readJson, only: ['art'] });
        const art = createArtLibrary(stack);
        const { images, failed } = await loadSheetImages(art, browserDecoder(win));
        const credit = stack.map((l) => l.pack?.credit).filter(Boolean).join(' · ');
        return { art, images, failed, credit };
    })();
    return artPromise;
}

/** Test-only: forget the loaded art. */
export function _resetSeedlingArtForTests() { artPromise = null; }

/**
 * Paint the level's static room once onto `newCanvas(record.width * cellPx, record.height * cellPx)`, cleared to
 * `SEEDLING_BACKGROUND`. `world` is the record's built world (`levelWorldFor` / `recordWorldOf`). Returns
 * `{ canvas, ctx, counts, ops }` (`ops` = the draw list's length).
 */
export function bakeLevel({
    newCanvas, record, world, level, art, images, cellPx = TILE, excluded = NOTHING,
}) {
    const ops = levelStaticOps(world, art, { level, record, excluded });
    const canvas = newCanvas(record.width * cellPx, record.height * cellPx);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = SEEDLING_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const view = { x: 0, y: 0, w: world.world.width, h: world.world.height };
    const counts = paintOps(ctx, ops, images, view, canvas);
    return { canvas, ctx, counts, ops: ops.length };
}
