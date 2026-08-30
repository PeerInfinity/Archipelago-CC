// mapSource — adapts a map-source document (the Seedling extract) into the
// three objects TileMapCanvasRenderer already takes: a `tilemap`
// ({ map_width, map_height, tiles[y][x] }), a `categoryGrid[y][x]` of category
// names, and a `config` whose `categories` carry the colours.
//
// The renderer is reused whole (region-atlas plan, Phase 2) rather than
// reimplemented — it already does pan, zoom, click-to-select and a marker
// overlay. All it needs is data in its shape.
//
// Categories here are TILESET IDENTITY, not semantics. A tile's category is
// `<layer>:<tx>,<ty>` and its colour is a deterministic function of that pair.
// Deciding which tiles are walkable is Phase 5's job; inventing it here would
// put a guess in front of the author of every region.

const EMPTY = 'empty';
const EMPTY_COLOR = '#101014';

/**
 * A stable colour per tileset coordinate. Golden-ratio hue stepping keeps
 * adjacent tile ids visually distinct (neighbouring tx values are usually
 * neighbouring terrain), and the cliffsides layer is lightened so it reads as
 * an overlay rather than as more terrain.
 */
export function tileColor(layerName, tx, ty) {
    const index = (tx / 16) + ty * 64;
    const hue = Math.round(((index * 137.508) % 360 + 360) % 360);
    const overlay = layerName === 'cliffsides';
    return `hsl(${hue}, ${overlay ? 70 : 45}%, ${overlay ? 68 : 42}%)`;
}

/** Index a map-source document by level id. */
export function indexLevels(mapDoc) {
    const byId = new Map();
    for (const lvl of mapDoc?.levels ?? []) byId.set(lvl.level, lvl);
    return byId;
}

/** A short label for the level picker: "12 — OverWorld1_1 (20x20)". */
export function levelLabel(level) {
    return `${level.level} — ${level.class} (${level.width}×${level.height})`;
}

/**
 * Build the renderer inputs for one level. Layers composite in document order,
 * so `cliffsides` (which Seedling draws on top of `tiles`) wins where both
 * place a tile.
 */
export function buildLevelView(level) {
    const { width, height } = level;
    const tiles = Array.from({ length: height }, () => new Array(width).fill(null));
    const categoryGrid = Array.from({ length: height }, () => new Array(width).fill(EMPTY));
    const categories = { [EMPTY]: { color: EMPTY_COLOR } };

    for (const layer of level.layers ?? []) {
        for (const [x, y, tx, ty] of layer.tiles) {
            const name = `${layer.name}:${tx},${ty}`;
            if (!categories[name]) categories[name] = { color: tileColor(layer.name, tx, ty) };
            categoryGrid[y][x] = name;
            tiles[y][x] = { layer: layer.name, tx, ty };
        }
    }

    return {
        tilemap: { map_width: width, map_height: height, tiles },
        categoryGrid,
        config: { categories },
    };
}

/**
 * Entity markers for the renderer's `setMarkers` overlay. Entities carry raw
 * PIXEL positions (Seedling places some off the grid), so they are floored to
 * the tile they sit in. These are reference markers: they are what makes
 * "put the location on the actual chest" possible instead of eyeballing it.
 */
export function entityMarkers(level, tileSize, { types = null, color = '#ffcc00' } = {}) {
    return (level.entities ?? [])
        .filter((e) => !types || types.has(e.type))
        .map((e) => ({
            x: Math.floor(e.x / tileSize),
            y: Math.floor(e.y / tileSize),
            color,
            label: e.type,
            entity: e,
        }));
}

export { EMPTY as EMPTY_CATEGORY };
