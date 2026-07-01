/**
 * Maze tile editor — palette state and edit-application logic.
 *
 * Headless: no DOM. Click-to-tile-coord conversion and palette
 * rendering live in mazeRoomUI; this module is the pure-logic core
 * the panel calls after resolving a click into a tile coordinate.
 *
 * v1 palette (docs/json/developer/procgen/maze.md §"Panel and runtime"):
 *   - floor / wall (tile values)
 *   - entrance (single instance, click moves)
 *   - item (with item-id picker + AP-canonical location name)
 *   - obstacle (with obstacle-id picker)
 *
 * v1.1 deferred:
 *   - exit placement (needs side picker, exit_id management)
 *   - logic gate (RuleTreeEditor integration)
 */

import {
    TILE_FLOOR,
    TILE_WALL,
    setTile,
    getTile,
    setEntrance,
    setItem,
    clearItem,
    setObstacle,
    clearObstacle,
    getItem,
    getObstacle,
    isExit,
} from './mazeRoomEngine.js';

export const PALETTE_TYPES = Object.freeze({
    FLOOR:    'floor',
    WALL:     'wall',
    ENTRANCE: 'entrance',
    ITEM:     'item',
    OBSTACLE: 'obstacle',
    ERASE:    'erase',
});

export const PALETTE_ENTRIES = Object.freeze([
    { type: PALETTE_TYPES.FLOOR,    label: 'Floor',    glyph: '·' },
    { type: PALETTE_TYPES.WALL,     label: 'Wall',     glyph: '█' },
    { type: PALETTE_TYPES.ENTRANCE, label: 'Entrance', glyph: '◆' },
    { type: PALETTE_TYPES.ITEM,     label: 'Item',     glyph: '○' },
    { type: PALETTE_TYPES.OBSTACLE, label: 'Obstacle', glyph: '✕' },
    { type: PALETTE_TYPES.ERASE,    label: 'Erase entity', glyph: '⌫' },
]);

const DEFAULT_LOCATION_NAME_FORMAT = (x, y) => `Edited Location ${x},${y}`;

export class MazeRoomEditor {
    constructor({
        itemLib = {},
        obstacleLib = {},
        defaultItemId = null,
        defaultObstacleId = null,
        locationNameFormat = DEFAULT_LOCATION_NAME_FORMAT,
    } = {}) {
        this.itemLib = itemLib;
        this.obstacleLib = obstacleLib;
        this.selectedType = PALETTE_TYPES.FLOOR;
        this.selectedItemId = defaultItemId ?? firstKey(itemLib);
        this.selectedObstacleId = defaultObstacleId ?? firstKey(obstacleLib);
        this.locationNameFormat = locationNameFormat;
    }

    setLibraries(itemLib, obstacleLib) {
        this.itemLib = itemLib ?? {};
        this.obstacleLib = obstacleLib ?? {};
        if (!this.selectedItemId || !(this.selectedItemId in this.itemLib)) {
            this.selectedItemId = firstKey(this.itemLib);
        }
        if (!this.selectedObstacleId || !(this.selectedObstacleId in this.obstacleLib)) {
            this.selectedObstacleId = firstKey(this.obstacleLib);
        }
    }

    selectType(type) {
        if (!Object.values(PALETTE_TYPES).includes(type)) {
            throw new Error(`MazeRoomEditor.selectType: unknown type ${type}`);
        }
        this.selectedType = type;
    }

    selectItemId(id) { this.selectedItemId = id; }
    selectObstacleId(id) { this.selectedObstacleId = id; }

    /**
     * Apply the currently-selected palette entry to the given tile.
     *
     * Returns a small descriptor of what changed:
     *   {
     *     type: 'noop' | 'tile' | 'entrance' | 'item' | 'obstacle' | 'erase',
     *     ok: boolean,
     *     reason?: string,           // when ok === false
     *     description: string,       // human-readable summary
     *   }
     *
     * Caller is responsible for re-running the verifier and re-rendering.
     */
    applyAt(world, x, y) {
        if (!world) return notOk('no-world', 'No world loaded.');
        if (!withinBounds(world, x, y)) return notOk('out-of-bounds', `Tile (${x},${y}) is out of bounds.`);

        switch (this.selectedType) {
            case PALETTE_TYPES.FLOOR:
                return this._setTile(world, x, y, TILE_FLOOR, 'floor');
            case PALETTE_TYPES.WALL:
                return this._setWall(world, x, y);
            case PALETTE_TYPES.ENTRANCE:
                return this._setEntrance(world, x, y);
            case PALETTE_TYPES.ITEM:
                return this._setItem(world, x, y);
            case PALETTE_TYPES.OBSTACLE:
                return this._setObstacle(world, x, y);
            case PALETTE_TYPES.ERASE:
                return this._eraseEntity(world, x, y);
            default:
                return notOk('unknown-type', `Unknown palette type ${this.selectedType}.`);
        }
    }

    // --- per-type apply ---

    _setTile(world, x, y, tileValue, label) {
        const before = getTile(world, x, y);
        if (before === tileValue) return ok('tile', `Tile (${x},${y}) already ${label}.`);
        setTile(world, x, y, tileValue);
        return ok('tile', `Set tile (${x},${y}) to ${label}.`);
    }

    _setWall(world, x, y) {
        // Placing a wall over the entrance, an exit, an item, or an
        // obstacle would silently break invariants the engine relies
        // on (entrance must be floor; exits must be reachable). Refuse
        // and report a clear reason rather than corrupt the world.
        if (world.entrance.x === x && world.entrance.y === y) {
            return notOk('protected-entrance', 'Cannot place wall on the entrance.');
        }
        if (isExit(world, x, y)) {
            return notOk('protected-exit', 'Cannot place wall on an exit tile.');
        }
        if (getItem(world, x, y) || getObstacle(world, x, y)) {
            return notOk('occupied', 'Tile is occupied; erase the entity first.');
        }
        return this._setTile(world, x, y, TILE_WALL, 'wall');
    }

    _setEntrance(world, x, y) {
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'Entrance must be on a floor tile.');
        }
        if (isExit(world, x, y)) {
            return notOk('exit-tile', 'Cannot place entrance on an exit.');
        }
        const before = { ...world.entrance };
        if (before.x === x && before.y === y) {
            return ok('entrance', `Entrance already at (${x},${y}).`);
        }
        setEntrance(world, x, y);
        return ok('entrance', `Moved entrance to (${x},${y}) (was (${before.x},${before.y})).`);
    }

    _setItem(world, x, y) {
        if (!this.selectedItemId) return notOk('no-item', 'No item id selected.');
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'Item must be on a floor tile.');
        }
        if (getObstacle(world, x, y)) {
            return notOk('occupied', 'Tile already has an obstacle.');
        }
        if (isExit(world, x, y)) {
            return notOk('exit-tile', 'Cannot place an item on an exit tile.');
        }
        setItem(world, x, y, this.selectedItemId);
        ensureItemLocationNameMap(world);
        const locationName = this.locationNameFormat(x, y);
        world.itemLocationNames.set(`${x},${y}`, locationName);
        return ok('item', `Placed item ${this.selectedItemId} at (${x},${y}).`);
    }

    _setObstacle(world, x, y) {
        if (!this.selectedObstacleId) return notOk('no-obstacle', 'No obstacle id selected.');
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'Obstacle must be on a floor tile.');
        }
        if (getItem(world, x, y)) {
            return notOk('occupied', 'Tile already has an item.');
        }
        if (world.entrance.x === x && world.entrance.y === y) {
            return notOk('protected-entrance', 'Cannot place an obstacle on the entrance.');
        }
        setObstacle(world, x, y, this.selectedObstacleId);
        return ok('obstacle', `Placed obstacle ${this.selectedObstacleId} at (${x},${y}).`);
    }

    _eraseEntity(world, x, y) {
        const removedItem = getItem(world, x, y);
        const removedObstacle = getObstacle(world, x, y);
        if (!removedItem && !removedObstacle) {
            return ok('erase', `Nothing to erase at (${x},${y}).`);
        }
        if (removedItem) {
            clearItem(world, x, y);
            world.itemLocationNames?.delete(`${x},${y}`);
        }
        if (removedObstacle) clearObstacle(world, x, y);
        const parts = [];
        if (removedItem) parts.push(`item ${removedItem}`);
        if (removedObstacle) parts.push(`obstacle ${removedObstacle}`);
        return ok('erase', `Erased ${parts.join(' + ')} at (${x},${y}).`);
    }
}

function withinBounds(world, x, y) {
    return x >= 0 && x < world.width && y >= 0 && y < world.height;
}

function ensureItemLocationNameMap(world) {
    if (!world.itemLocationNames) world.itemLocationNames = new Map();
}

function firstKey(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const keys = Object.keys(obj);
    return keys.length > 0 ? keys[0] : null;
}

function ok(type, description) {
    return { ok: true, type, description };
}

function notOk(reason, description) {
    return { ok: false, type: 'noop', reason, description };
}
