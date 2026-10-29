/**
 * mazeRoom/mazeSeedlingSkin — **A SEEDLING MAZE WORLD DRAWN IN THE ORIGINAL GRAPHICS** (slice maze-seedling-art-1,
 * S1: the static room). The maze cells of a Seedling-atlas world ARE the level's 16 px tiles (one cell = one tile of
 * the WHOLE level, origin (0,0) — every payload of the playthrough preset measured so), so the picture under the
 * maze's markers is the level's own room, painted once by the JS runtime's renderer.
 *
 * ⚖ (user, 2026-10-28) *"the library"* is the content-pack art library, stack `graphics.seedling` (the JS page's
 * `?graphics=seedling`). It switches on FROM THE DATA — the rules' `region_atlas["<p>"].game === 'seedling'` and the
 * world's atlas `level` — never by preset name; the panel's "Seedling art" checkbox turns it off. Every other maze
 * world draws exactly as before (`view.seedlingSkin = null`).
 *
 * ⛔ A READ-ONLY CONSUMER of `seedlingDemo/seedlingSkinRenderer.js`: `roomOps` is pure over a `buildLevelWorld`
 * world, and its tile-op cache keys on that world OBJECT — so `levelWorldFor` memoises one per (map, level).
 *
 * ⛔ S1 IS THE STATIC ROOM AT TICK 0 (open question A: the art library runs animation on the game tick, and the maze
 * has none). An object the maze itself models — an obstacle, block, button, trap or item on that cell — is NOT in the
 * baked room: the maze's marker is its only picture, so a rock the player broke leaves no ghost behind.
 *
 * Split like the renderer: `seedlingSkinFor` / `staticOps` are pure and pinned in node (`mazeSeedlingSkin.test.js`);
 * `loadSeedlingArt` and `bakeSeedlingLayer` are the browser half.
 */
import { loadPackStack, packsBaseUrl, parseRegistry } from '../contentPacks/contentPacks.js';
import { browserDecoder, createArtLibrary, loadSheetImages } from '../artLibrary/artLibrary.js';
import { buildLevelWorld } from '../seedlingDemo/levelWorld.js';
import { patchedMapDocument } from '../seedlingDemo/seedlingSetPatches.js';
import { TILE, paintOps, roomOps, teleporterArtFilter } from '../seedlingDemo/seedlingSkinRenderer.js';
import { TILE_WALL, posKey } from './mazeRoomEngine.js';
import { COLORS } from './mazeRoomRender.js';

/** The `packs.json` graphics stack (⚖ ruling 1). */
export const SEEDLING_GRAPHICS_STACK = 'graphics.seedling';
/** ⚖ ruling 3: a cell is 32 px when the art is on (2× the 16 px tile, smoothing off). */
export const SEEDLING_CELL_PX = 32;
/** What the baked room is cleared to before the tiles (the JS page's own background). */
export const SEEDLING_BACKGROUND = '#101014';

/**
 * ⚖ RULING 1, PURE: `{ level }` when `world` is a Seedling-atlas maze world, else null. `regionAtlas` is the loaded
 * slot's `region_atlas` block (`mapDocumentPath.regionAtlasOf`); `world.atlas` is the payload's provenance
 * (`deserializeMazeWorld`). A tile size other than the level's 16 px is no skin: the cells would not be tiles.
 */
export function seedlingSkinFor(world, regionAtlas) {
    if (regionAtlas?.game !== 'seedling') return null;
    const a = world?.atlas;
    if (!a || !Number.isInteger(a.level) || a.tileSize !== TILE) return null;
    if ((a.origin?.x ?? 0) !== 0 || (a.origin?.y ?? 0) !== 0) return null;
    return { level: a.level };
}

/**
 * The level's room as the renderer reads it, ONE object per (map document, level): the patched (delivered) rooms
 * — the ones the preset's grid was analysed on. Throws by name when the map has no such level, or when its size is
 * not the maze world's (a world whose cells are not the level's tiles must not be painted as if they were).
 */
const levelWorlds = new WeakMap();
export function levelWorldFor(mapDoc, level, mazeWorld = null) {
    if (!levelWorlds.has(mapDoc)) {
        const patched = patchedMapDocument(mapDoc);
        levelWorlds.set(mapDoc, { byLevel: new Map((patched.levels ?? []).map((r) => [r.level, r])), worlds: new Map() });
    }
    const slot = levelWorlds.get(mapDoc);
    const record = slot.byLevel.get(level);
    if (!record) throw new Error(`mazeSeedlingSkin: the map has no level ${level} (it has ${slot.byLevel.size})`);
    if (mazeWorld && (record.width !== mazeWorld.width || record.height !== mazeWorld.height)) {
        throw new Error(`mazeSeedlingSkin: level ${level} is ${record.width}×${record.height} tiles but the maze world `
            + `is ${mazeWorld.width}×${mazeWorld.height} cells — its cells are not the level's tiles`);
    }
    if (!slot.worlds.has(level)) slot.worlds.set(level, buildLevelWorld(record));
    return { record, world: slot.worlds.get(level) };
}

/** The cells the maze draws a marker of its own on (an object there is the maze's to show, not the room's). */
export function mazeModelledCells(mazeWorld) {
    const cells = new Set();
    for (const m of [mazeWorld.obstacles, mazeWorld.blocks, mazeWorld.buttons, mazeWorld.items]) {
        for (const key of m?.keys?.() ?? []) cells.add(key);
    }
    for (const t of mazeWorld.traps ?? []) cells.add(posKey(t.x, t.y));
    return cells;
}

/**
 * The cells whose maze tile an EDIT changed: every cell where `mazeWorld.tiles` differs from `baseTiles` (the world's
 * tiles before its first edit; null = never edited). The level's art cannot show a wall the editor added or removed,
 * so the bake paints these cells in the maze's own wall/floor fill. `[{x, y, wall}]`, row-major.
 */
export function editedTiles(mazeWorld, baseTiles) {
    if (!baseTiles) return [];
    const out = [];
    const { width, tiles } = mazeWorld;
    for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] !== baseTiles[i]) out.push({ x: i % width, y: Math.floor(i / width), wall: tiles[i] === TILE_WALL });
    }
    return out;
}

/**
 * ⛓ WHAT THE BAKED LAYER DEPENDS ON, as one string: the level, the cells the maze models (left out of the bake) and
 * the edited tiles (painted over it). The panel keeps a layer only while this key is unchanged — an IN-PLACE edit of
 * the same world object (`mazeRoomUI._applyEditAt`; an entry that hands back the same object, changed) changes the
 * key and rebakes, where S1's cache keyed on the object alone kept the stale room. Play never changes it: a push or a
 * break is `state`, not `world`.
 */
export function seedlingLayerKey(mazeWorld, level, baseTiles = null) {
    const cells = [...mazeModelledCells(mazeWorld)].sort().join(' ');
    const edits = editedTiles(mazeWorld, baseTiles).map((t) => `${t.x},${t.y}${t.wall ? 'W' : 'F'}`).join(' ');
    return `${level}|${mazeWorld.width}x${mazeWorld.height}|${cells}|${edits}`;
}

/** The cell under a renderer rect's centre. */
const cellOf = (r) => posKey(Math.floor((r.x + (r.right ?? r.x + r.w)) / 2 / TILE),
    Math.floor((r.y + (r.bottom ?? r.y + r.h)) / 2 / TILE));

/**
 * THE BAKED ROOM'S DRAW LIST, PURE: tiles, cliffsides and scenery at tick 0. Every placed pickup is hidden (the
 * maze's items are the locations); a teleporter keeps a stand-in only where the game SHOWS one
 * (`teleporterArtFilter`, the JS page's rule); an object on a cell the maze models is left to the maze's marker.
 */
export function staticOps(levelWorld, art, { level, record, mazeWorld }) {
    const modelled = mazeModelledCells(mazeWorld);
    return roomOps(levelWorld, art, {
        level,
        tick: 0,
        drawnPickups: () => true,
        drawnTeleporters: teleporterArtFilter(record),
        drawnObjects: (o) => modelled.has(cellOf(o.rect)),
    });
}

/**
 * ⛓ The art, loaded ONCE per page (a module-level promise; a failure is kept and re-thrown by name, never retried
 * in a loop). Recomposed from `contentPacks` + `artLibrary` — ⛔ not `jsRuntimePage.loadGraphicsStack`, which would
 * pull the whole JS page in. Resolves `{ art, images, failed }`.
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
 * Paint the static room once onto a canvas `newCanvas(w, h)` makes, `cellPx` per maze cell. Returns
 * `{ canvas, counts, ops }` — the caller keeps it and blits `canvas` on every render (`view.seedlingSkin.layer`).
 */
export function bakeSeedlingLayer({
    newCanvas, mapDoc, level, mazeWorld, art, images, cellPx = SEEDLING_CELL_PX, baseTiles = null,
}) {
    const { record, world } = levelWorldFor(mapDoc, level, mazeWorld);
    const ops = staticOps(world, art, { level, record, mazeWorld });
    const canvas = newCanvas(mazeWorld.width * cellPx, mazeWorld.height * cellPx);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = SEEDLING_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const view = { x: 0, y: 0, w: world.world.width, h: world.world.height };
    const counts = paintOps(ctx, ops, images, view, canvas);
    const edits = editedTiles(mazeWorld, baseTiles);
    for (const t of edits) {
        ctx.fillStyle = t.wall ? COLORS.wall : COLORS.floor;
        ctx.fillRect(t.x * cellPx, t.y * cellPx, cellPx, cellPx);
    }
    return { canvas, counts, ops: ops.length, edits: edits.length };
}
