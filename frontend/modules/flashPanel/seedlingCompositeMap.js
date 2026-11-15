/**
 * flashPanel/seedlingCompositeMap — **A SEEDLING REGION'S OWN CELL ON THE COMPOSITE MAP** (region-map step 1, D2–D3).
 *
 * ⚖ (user, 2026-09-04) *"each substrate declares whether it supports map rendering, and has a way to call the
 * renderer. I don't want to hardcode support for map rendering for specific substrates."* — so this is DECLARED as
 * `compositeMap.drawRegion` by both Seedling entries (`flashSeedlingLibrary.js`, `flashSeedlingGenLibrary.js`), the
 * way `mazeRoom/mazeCompositeMap.js` is declared by `mazeRoomLibrary.js`. The shared renderer names no substrate.
 * ⚖ (user, 2026-11-14) the visible side effect — Seedling art replacing the generic boxes on the APWorld Editor's Map
 * tab and the Procgen Pipeline's map — was agreed, with the old view kept behind a "Substrate art" switch
 * (`compositeMap.artwork: true` below; the renderer's `substrateArt` option).
 *
 * ── WHAT A CELL SHOWS ────────────────────────────────────────────────
 * The region's LEVEL, baked by the JS Seedling renderer (`seedlingDemo/seedlingLevelBake.js`: tiles, scenery, the
 * shown teleporters and the stairs at tick 0), scaled to fit the cell (`regionSize × tilePx`) with its aspect ratio
 * kept and centred, then the exit squares on top (the renderer draws the exit LINES). The level comes from ONE
 * resolver over the sidecar payload, with two sources and no preset or region name read anywhere:
 *   1. an ATLAS region — `playable_payload.level` indexes the slot's map document (`region_atlas[p].map_document`,
 *      `mapDocumentPath`; the atlases default when none is named), patched (`patchedMapDocument`);
 *   2. a GENERATED region (`flash_seedling_gen`) — `playable_payload.record` is the level, embedded.
 * ⛓ A SUB-REGION cell (`atlas_sub_region`) draws its WHOLE level with every tile OUTSIDE the sub-region dimmed
 * (`seedling-subregion-partition.json`): the cell is recognisably its level, and seven cells of one level do not
 * read as seven copies of the same room. One bake per level serves all of its sub-regions.
 *
 * ── ⚠ `drawRegion` IS SYNCHRONOUS; THE ART IS NOT ────────────────────
 * The painter draws a CACHED bake. On a miss it draws the generic box (`drawGenericRegion`, exactly the old cell),
 * queues the bake, and — when the bake lands — calls the host's `geom.requestRedraw` (the renderer passes its
 * `onCellArtReady` option through). Bakes run LAZILY (only cells that were drawn), at most `concurrency` at once,
 * each in its own macrotask; the redraw calls are COALESCED to one per host callback per animation frame. With no
 * callback nothing breaks: the cell stays generic until the host redraws for its own reasons. A bake that fails is
 * kept as failed (generic box, the reason in `stats()`), never retried in a loop.
 *
 * ⛔ **NODE-IMPORTABLE**: nothing here touches a DOM at module load (the capability-matrix generator imports both
 * declaring libraries headless); canvases come from `newCanvas`, made at bake time only.
 */
import {
    COLORS, TILE_PX, drawGenericRegion, resolveExitTilePositions,
} from '../procgenCore/compositeMapRenderer.js';
import { mapDocumentPath } from './mapDocumentPath.js';
import {
    SEEDLING_BACKGROUND, bakeLevel, levelRecordFor, levelWorldFor, loadSeedlingArt, recordWorldOf,
} from '../seedlingDemo/seedlingLevelBake.js';
import { TILE } from '../seedlingDemo/seedlingSkinRenderer.js';
import { dirOfExit } from '../seedlingDemo/seedlingDoorDirection.js';
import SUBREGION_PARTITION from './atlases/seedling-subregion-partition.json' with { type: 'json' };

/** The dim laid over a sub-region cell's tiles that belong to the rest of its level. */
export const OUTSIDE_SUB_REGION_DIM = 'rgba(0, 0, 0, 0.62)';
/** Baked pixels per level tile: enough for the cell, never more than the art's own 16. */
export const MAX_BAKE_PX = TILE;

/* ══════════════════════════════════════════════════════════════════════
 * D2 — THE LEVEL A REGION SHOWS (pure)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **THE ONE RESOLVER, PURE.** Which level a Seedling region's payload shows, before anything is loaded:
 *   · `{kind: 'record', record, levelIndex}` — a generated room's embedded record;
 *   · `{kind: 'atlas', levelIndex, mapPath, atlasRef, atlasRegion, subRegion}` — an atlas level, `mapPath` the
 *     slot's map document (`source = {rules, playerId}`; no source → the atlases default);
 *   · null — a payload naming neither (the cell stays generic).
 * ⛔ Reads the PAYLOAD only: never a preset name, never a region name.
 */
export function seedlingLevelSourceOf(payload, source = null) {
    if (!payload || typeof payload !== 'object') return null;
    const rec = payload.record;
    if (rec && typeof rec === 'object' && Number.isInteger(rec.width) && Number.isInteger(rec.height)) {
        return { kind: 'record', record: rec, levelIndex: Number.isInteger(payload.level) ? payload.level : 0 };
    }
    if (!Number.isInteger(payload.level)) return null;
    const { path } = source?.rules ? mapDocumentPath(source.rules, source.playerId ?? null) : mapDocumentPath(null);
    return {
        kind: 'atlas',
        levelIndex: payload.level,
        mapPath: path,
        atlasRef: typeof payload.atlas_ref === 'string' ? payload.atlas_ref : null,
        atlasRegion: typeof payload.atlas_region === 'string' ? payload.atlas_region : null,
        subRegion: typeof payload.atlas_sub_region === 'string' ? payload.atlas_sub_region : null,
    };
}

/**
 * `{record, levelIndex, mapDoc?}` for a source, once its map document is in hand (an atlas source needs `mapDoc`;
 * a record source does not). Throws by name for an atlas level the map lacks.
 */
export function resolveSeedlingLevel(levelSource, mapDoc = null) {
    if (!levelSource) return null;
    if (levelSource.kind === 'record') return { record: levelSource.record, levelIndex: levelSource.levelIndex };
    if (!mapDoc) throw new Error('seedlingCompositeMap: an atlas level needs its map document');
    const { record, size } = levelRecordFor(mapDoc, levelSource.levelIndex);
    if (!record) {
        throw new Error(`seedlingCompositeMap: the map document has no level ${levelSource.levelIndex} (it has ${size})`);
    }
    return { record, levelIndex: levelSource.levelIndex, mapDoc };
}

/**
 * ⛓ The tiles of a sub-region, as a predicate `(x, y) → boolean` in LEVEL tiles, or null when the partition has no
 * row for it (the cell then draws its whole level undimmed). Keyed by the payload's atlas id, atlas region and
 * sub-region — data, not names of presets.
 */
export function subRegionTiles(levelSource, partition = SUBREGION_PARTITION) {
    if (levelSource?.kind !== 'atlas' || !levelSource.subRegion) return null;
    const region = partition?.atlases?.[levelSource.atlasRef]?.regions?.[levelSource.atlasRegion];
    const idx = region?.sub_regions?.indexOf(levelSource.subRegion) ?? -1;
    if (idx < 0 || !Array.isArray(region.rows)) return null;
    const ch = partition.alphabet[idx];
    const [ox, oy] = region.origin ?? [0, 0];
    return (x, y) => region.rows[y - oy]?.[x - ox] === ch;
}

/* ══════════════════════════════════════════════════════════════════════
 * HOOKS FOR STEPS 2–3 (pure)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ `compositeMap.displayRegionOf(regionName, sidecar)` — the LEVEL a region belongs to, the key a whole-level view
 * groups by: an atlas payload's `atlas_region` (`level_7__r0c3` → `level_7`, read off the payload, not the name), a
 * generated room's own region name. `sidecar` is the region's sidecar entry or its payload.
 * ⚠ The key is a DISPLAY key: a level split into sub-regions has no `level_N` region in the rules.
 */
export function seedlingDisplayRegionOf(regionName, sidecar) {
    const payload = sidecar?.playable_payload ?? sidecar;
    if (typeof payload?.atlas_region === 'string' && payload.atlas_region !== '') return payload.atlas_region;
    return regionName;
}

/**
 * ⛓ `compositeMap.locationTiles(region, ctx)` → `[{location, x, y, kind}]` in LEVEL tiles. `region` =
 * `{region_id, playable_payload}`; `ctx = {rules, playerId, atlases}` (`atlases`: the atlas documents the declaring
 * library knows, by `atlas_id`). Three sources, in order, for each location the rules list in that region:
 *   · an EVENT carrying `obstacle: {x, y}` (pixels) in THIS region's level → `kind: 'event'` (an obstacle whose
 *     `level` is another level is a remote effect and has no tile here);
 *   · an ITEM whose name the payload's atlas lists with `tile: [x, y]` → `kind: 'item'`;
 *   · a GENERATED room's own `locations[].cell` (`{tx, ty}`) → `kind: 'item'` (no rules needed).
 * A rules location none of them places is left out; `unplacedSeedlingLocations` names them.
 */
export function seedlingLocationTiles(region, { rules = null, playerId = null, atlases = null } = {}) {
    const payload = region?.playable_payload ?? null;
    const out = [];
    const seen = new Set();
    const push = (location, x, y, kind) => {
        if (seen.has(location) || !Number.isFinite(x) || !Number.isFinite(y)) return;
        seen.add(location);
        out.push({ location, x, y, kind });
    };
    for (const l of payload?.locations ?? []) {
        const c = l?.cell;
        if (typeof l?.name === 'string' && c) push(l.name, c.tx, c.ty, 'item');
    }
    const atlasTiles = atlasLocationTiles(atlases?.[payload?.atlas_ref]);
    for (const l of rulesLocationsOf(rules, playerId, region?.region_id)) {
        if (l?.obstacle && Number.isFinite(l.obstacle.x) && Number.isFinite(l.obstacle.y)) {
            // ⛔ an obstacle in ANOTHER level (a remote effect — the event is listed on the side that triggers it) has
            //   no tile in this region's level: left out, and named by `unplacedSeedlingLocations`.
            const sameLevel = !Number.isInteger(l.obstacle.level) || l.obstacle.level === payload?.level;
            if (sameLevel) push(l.name, Math.floor(l.obstacle.x / TILE), Math.floor(l.obstacle.y / TILE), 'event');
            continue;
        }
        const t = atlasTiles.get(l?.name);
        if (t) push(l.name, t[0], t[1], 'item');
    }
    return out;
}

/** The rules locations of `regionName` that `seedlingLocationTiles` could not place (its residue, by name). */
export function unplacedSeedlingLocations(region, ctx = {}) {
    const placed = new Set(seedlingLocationTiles(region, ctx).map((t) => t.location));
    return rulesLocationsOf(ctx.rules, ctx.playerId, region?.region_id)
        .map((l) => l?.name).filter((n) => typeof n === 'string' && !placed.has(n));
}

/**
 * ⛓ The layout KIND of a Seedling exit, off its `exit_id` prefix — the only stairs/pit signal a compiled sidecar
 * carries (every exit's `kind` is `teleporter`). `out_stairsdown_*` and `out_pit_*` go DOWN, `out_stairsup_*` UP,
 * every other exit (`out_teleporter_*`, the boss doors) is a `join`.
 */
export function seedlingExitLayoutKind(exitId) {
    const id = String(exitId ?? '');
    if (id.startsWith('out_stairsdown') || id.startsWith('out_pit')) return 'down';
    if (id.startsWith('out_stairsup')) return 'up';
    return 'join';
}

/**
 * A display region's level size in PIXELS, `{w, h}`, or null: a generated room's embedded record (`width`/`height`
 * in tiles), else the payload's atlas region `bounds` (tiles) from `atlases[atlas_ref]`. An atlas the caller does
 * not hold (a CUSTOM set's derived atlas, unless handed in) gives null, and its links then carry no direction.
 */
function seedlingLevelPixelSize(payload, atlases) {
    const ts = Number.isFinite(payload?.tile_size) ? payload.tile_size : TILE;
    const rec = payload?.record;
    if (rec && Number.isInteger(rec.width) && Number.isInteger(rec.height)) return { w: rec.width * ts, h: rec.height * ts };
    const atlas = atlases?.[payload?.atlas_ref];
    const region = atlas?.regions?.find?.((r) => r.region_id === payload?.atlas_region);
    const b = region?.bounds;
    return b && b.w > 0 && b.h > 0 ? { w: b.w * ts, h: b.h * ts } : null;
}

/**
 * ⛓⛓ `compositeMap.layoutGraph(ctx)` — region-map step 3a's SEEDLING ADAPTER (`procgenCore/regionLayoutResolve.js`
 * finds it through the registry). `ctx = {sidecars, displayRegionOf, atlases?}` → `{nodes, links}`:
 *   · nodes = the DISPLAY regions (`level_N__rRcC` folds onto `level_N` by its payload), in sidecar order;
 *   · links = every sidecar exit with a `targetRegion` in the sidecars, display-folded (a link inside one level is
 *     dropped), `kind` by `seedlingExitLayoutKind`, and — for a `join` — `dir` by `dirOfExit` (`seedlingDemo/seedlingDoorDirection.js`, re-exported by `seedlingSetMap`) (the E3
 *     door rule: the door's side of its level, else the arrival's side of the target, reversed). The door is the
 *     exit's first `exit_tiles` cell (level tiles → pixels), the arrival its `target_spawn` (pixels). Stairs and pits
 *     carry no `dir` (they are vertical), and an interior door gets `null` from `dirOfExit` itself.
 * ⛔ Pure, and reads the PAYLOADS only — never a preset or region name.
 */
export function seedlingLayoutGraph({ sidecars = {}, displayRegionOf = seedlingDisplayRegionOf, atlases = null } = {}) {
    const displayOf = (name) => displayRegionOf(name, sidecars[name]);
    const nodes = [];
    const seen = new Set();
    const size = new Map();
    for (const [name, sc] of Object.entries(sidecars)) {
        const d = displayOf(name);
        if (!seen.has(d)) {
            seen.add(d);
            nodes.push(d);
        }
        if (!size.has(d)) size.set(d, seedlingLevelPixelSize(sc?.playable_payload, atlases));
    }
    const links = [];
    for (const [name, sc] of Object.entries(sidecars)) {
        const payload = sc?.playable_payload;
        const ts = Number.isFinite(payload?.tile_size) ? payload.tile_size : TILE;
        for (const e of payload?.exits ?? []) {
            const to = e?.targetRegion;
            if (typeof to !== 'string' || !sidecars[to]) continue;
            const from = displayOf(name);
            const target = displayOf(to);
            if (from === target) continue;
            const kind = seedlingExitLayoutKind(e.exit_id);
            let dir = null;
            const tile = Array.isArray(e.exit_tiles) ? e.exit_tiles[0] : null;
            if (kind === 'join' && Array.isArray(tile)) {
                const door = {
                    x: tile[0] * ts, y: tile[1] * ts,
                    playerx: e.target_spawn?.x, playery: e.target_spawn?.y,
                };
                dir = dirOfExit(door, size.get(from), size.get(target), ts).dir;
            }
            links.push({ from, to: target, kind, dir });
        }
    }
    return { nodes, links };
}

function rulesLocationsOf(rules, playerId, regionName) {
    if (!rules || regionName == null) return [];
    const regions = rules.regions?.[String(playerId)] ?? null;
    return regions?.[regionName]?.locations ?? [];
}

const atlasTileCache = new WeakMap();
function atlasLocationTiles(atlas) {
    if (!atlas) return new Map();
    if (!atlasTileCache.has(atlas)) {
        const m = new Map();
        for (const r of atlas.regions ?? []) {
            for (const l of r.locations ?? []) if (Array.isArray(l.tile)) m.set(l.name, l.tile);
        }
        atlasTileCache.set(atlas, m);
    }
    return atlasTileCache.get(atlas);
}

/* ══════════════════════════════════════════════════════════════════════
 * D3 — THE PAINTER (sync draw over an async bake cache)
 * ══════════════════════════════════════════════════════════════════════ */

const defaultNewCanvas = (w, h) => (typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(w, h)
    : globalThis.document.createElement('canvas'));
const sizedCanvas = (newCanvas) => (w, h) => {
    const c = newCanvas(w, h);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    return c;
};
const defaultFetchJson = async (path) => {
    const r = await globalThis.fetch(path, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
    return r.json();
};
const defaultSchedule = (fn) => setTimeout(fn, 0);
const defaultFrame = (fn) => (typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(fn)
    : setTimeout(fn, 16));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** A stable key for an embedded record: its content (two loads of one document deserialize two objects). */
const recordKeys = new WeakMap();
function recordKeyOf(record) {
    if (!recordKeys.has(record)) recordKeys.set(record, `record:${JSON.stringify(record)}`);
    return recordKeys.get(record);
}
const sourceKeyOf = (src) => (src.kind === 'record' ? recordKeyOf(src.record) : `atlas:${src.mapPath}#${src.levelIndex}`);

/**
 * Make a painter with its own cache. The registry declares the DEFAULT instance (`drawSeedlingCompositeRegion`);
 * a test makes its own with node seams (`loadArt`, `loadMapDocument`, `newCanvas`, `schedule`, `frame`).
 */
export function createSeedlingCompositePainter({
    loadArt = () => loadSeedlingArt(),
    loadMapDocument = defaultFetchJson,
    newCanvas = defaultNewCanvas,
    schedule = defaultSchedule,
    frame = defaultFrame,
    concurrency = 2,
} = {}) {
    const make = sizedCanvas(newCanvas);
    /** jobKey → {status: 'queued'|'baking'|'ready'|'failed', canvas?, error?, waiters:Set, src, cellW, cellH} */
    const bakes = new Map();
    /** `${jobKey}|${sub}` → the dimmed copy of a level bake */
    const masked = new Map();
    const mapDocs = new Map();
    const queue = [];
    let active = 0;
    const redraws = new Set();
    let frameArmed = false;
    const counters = { requested: 0, baked: 0, failed: 0, redraws: 0, firstRequestAt: null, lastBakeAt: null, lastRedrawAt: null };

    const mapDocFor = (path) => {
        if (!mapDocs.has(path)) mapDocs.set(path, Promise.resolve().then(() => loadMapDocument(path)));
        return mapDocs.get(path);
    };

    function flushRedraws() {
        frameArmed = false;
        const calls = [...redraws];
        redraws.clear();
        for (const fn of calls) {
            counters.redraws += 1;
            counters.lastRedrawAt = now();
            try { fn(); } catch (e) { console.warn('seedlingCompositeMap: a host redraw threw', e); }
        }
    }
    function askRedraw(waiters) {
        for (const fn of waiters) redraws.add(fn);
        waiters.clear();
        if (redraws.size && !frameArmed) { frameArmed = true; frame(flushRedraws); }
    }

    function pump() {
        while (active < concurrency && queue.length) {
            const job = queue.shift();
            active += 1;
            schedule(() => runJob(job).finally(() => { active -= 1; pump(); }));
        }
    }

    async function runJob(job) {
        job.status = 'baking';
        try {
            const [{ art, images }, mapDoc] = await Promise.all([
                loadArt(), job.src.kind === 'atlas' ? mapDocFor(job.src.mapPath) : null,
            ]);
            const { record, levelIndex } = resolveSeedlingLevel(job.src, mapDoc);
            const world = job.src.kind === 'atlas' ? levelWorldFor(mapDoc, levelIndex).world : recordWorldOf(record);
            const fit = Math.min(job.cellW / record.width, job.cellH / record.height);
            const cellPx = Math.max(1, Math.min(MAX_BAKE_PX, Math.ceil(fit)));
            const { canvas } = bakeLevel({ newCanvas: make, record, world, level: levelIndex, art, images, cellPx });
            Object.assign(job, { status: 'ready', canvas, record, cellPx });
            counters.baked += 1;
        } catch (error) {
            Object.assign(job, { status: 'failed', error: String(error?.message ?? error) });
            counters.failed += 1;
        }
        counters.lastBakeAt = now();
        askRedraw(job.waiters);
    }

    function maskedCanvas(jobKey, job, levelSource) {
        const inside = subRegionTiles(levelSource);
        if (!inside) return job.canvas;
        const key = `${jobKey}|${levelSource.subRegion}`;
        if (!masked.has(key)) {
            const { canvas: base, record, cellPx } = job;
            const c = make(base.width, base.height);
            const g = c.getContext('2d');
            g.drawImage(base, 0, 0);
            g.fillStyle = OUTSIDE_SUB_REGION_DIM;
            for (let y = 0; y < record.height; y++) {
                for (let x = 0; x < record.width; x++) if (!inside(x, y)) g.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
            }
            masked.set(key, c);
        }
        return masked.get(key);
    }

    /** `compositeMap.drawRegion(ctx, region, geom)`. */
    function drawRegion(ctx, region, geom) {
        const { offX, offY, regionSize, tilePx = TILE_PX, colors = COLORS, source = null, requestRedraw = null } = geom;
        const cellW = regionSize.width * tilePx;
        const cellH = regionSize.height * tilePx;
        let src = null;
        try { src = seedlingLevelSourceOf(region?.playable_payload, source); } catch { src = null; }
        if (!src) { drawGenericRegion(ctx, region, geom); return; }
        const jobKey = `${sourceKeyOf(src)}@${cellW}x${cellH}`;
        let job = bakes.get(jobKey);
        if (!job) {
            job = { status: 'queued', waiters: new Set(), src, cellW, cellH };
            bakes.set(jobKey, job);
            counters.requested += 1;
            if (counters.firstRequestAt == null) counters.firstRequestAt = now();
            queue.push(job);
            pump();
        }
        if (job.status !== 'ready') {
            if (job.status !== 'failed' && typeof requestRedraw === 'function') job.waiters.add(requestRedraw);
            drawGenericRegion(ctx, region, geom);
            return;
        }
        const pic = maskedCanvas(jobKey, job, src);
        const scale = Math.min(cellW / pic.width, cellH / pic.height);
        const dw = Math.round(pic.width * scale);
        const dh = Math.round(pic.height * scale);
        ctx.save();
        ctx.fillStyle = SEEDLING_BACKGROUND;
        ctx.fillRect(offX, offY, cellW, cellH);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pic, offX + Math.floor((cellW - dw) / 2), offY + Math.floor((cellH - dh) / 2), dw, dh);
        ctx.restore();
        ctx.fillStyle = colors.exit;
        for (const { x, y } of resolveExitTilePositions(region?.exits ?? region?.playable_payload?.exits ?? [], regionSize)) {
            ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
        }
    }

    /** What the cache did: counts, the failures by reason, and the first-request → last-bake/redraw times (ms). */
    function stats() {
        const failures = [...bakes.entries()].filter(([, j]) => j.status === 'failed').map(([k, j]) => ({ key: k, error: j.error }));
        const pending = [...bakes.values()].filter((j) => j.status === 'queued' || j.status === 'baking').length;
        return { ...counters, pending, failures };
    }

    return { drawRegion, stats };
}

/** The registry's instance — one cache per page, shared by every map that draws a Seedling cell. */
const defaultPainter = createSeedlingCompositePainter();
export const drawSeedlingCompositeRegion = (ctx, region, geom) => defaultPainter.drawRegion(ctx, region, geom);
/** The default painter's cache counters (the screenshot probe reads them for the map-open → last-redraw time). */
export const seedlingCompositeMapStats = () => defaultPainter.stats();
