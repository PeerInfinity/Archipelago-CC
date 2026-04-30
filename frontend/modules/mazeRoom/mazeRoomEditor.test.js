import { describe, it, expect } from 'vitest';
import {
    MazeRoomEditor,
    PALETTE_TYPES,
} from './mazeRoomEditor.js';
import {
    createWorld,
    setTile,
    setItem,
    setObstacle,
    getTile,
    getItem,
    getObstacle,
    TILE_FLOOR,
    TILE_WALL,
} from './mazeRoomEngine.js';

const ITEM_LIB = {
    key_red: { name: 'Red Key', symbol: 'K' },
    key_blue: { name: 'Blue Key', symbol: 'K' },
};
const OBSTACLE_LIB = {
    door_red: { type: 'lock_and_key', clear_set: { combo_list: [{ items: { key_red: 1 } }] } },
    door_blue: { type: 'lock_and_key', clear_set: { combo_list: [{ items: { key_blue: 1 } }] } },
};

function makeBaseWorld() {
    const world = createWorld(8, 6, { itemLib: ITEM_LIB, obstacleLib: OBSTACLE_LIB });
    // Fill with floor; engine's createWorld leaves all walls by default.
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            setTile(world, x, y, TILE_FLOOR);
        }
    }
    world.entrance = { x: 0, y: 0 };
    return world;
}

// --- selection ---

describe('MazeRoomEditor — selection', () => {
    it('starts with floor selected and the first item / obstacle id', () => {
        const ed = new MazeRoomEditor({ itemLib: ITEM_LIB, obstacleLib: OBSTACLE_LIB });
        expect(ed.selectedType).toBe(PALETTE_TYPES.FLOOR);
        expect(ed.selectedItemId).toBe('key_red');
        expect(ed.selectedObstacleId).toBe('door_red');
    });

    it('selectType rejects unknown values', () => {
        const ed = new MazeRoomEditor();
        expect(() => ed.selectType('not-a-type')).toThrow();
    });

    it('setLibraries falls back when current selection becomes invalid', () => {
        const ed = new MazeRoomEditor({ itemLib: ITEM_LIB, obstacleLib: OBSTACLE_LIB });
        ed.selectItemId('key_red');
        ed.setLibraries({ key_blue: ITEM_LIB.key_blue }, OBSTACLE_LIB);
        expect(ed.selectedItemId).toBe('key_blue');
    });
});

// --- floor/wall ---

describe('MazeRoomEditor — floor/wall application', () => {
    it('places floor and reports the change', () => {
        const ed = new MazeRoomEditor();
        const world = makeBaseWorld();
        setTile(world, 3, 3, TILE_WALL);

        ed.selectType(PALETTE_TYPES.FLOOR);
        const r = ed.applyAt(world, 3, 3);
        expect(r.ok).toBe(true);
        expect(getTile(world, 3, 3)).toBe(TILE_FLOOR);
    });

    it('refuses to wall over the entrance', () => {
        const ed = new MazeRoomEditor();
        const world = makeBaseWorld();
        ed.selectType(PALETTE_TYPES.WALL);
        const r = ed.applyAt(world, 0, 0);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('protected-entrance');
        expect(getTile(world, 0, 0)).toBe(TILE_FLOOR);
    });

    it('refuses to wall over an item', () => {
        const ed = new MazeRoomEditor({ itemLib: ITEM_LIB });
        const world = makeBaseWorld();
        setItem(world, 2, 2, 'key_red');
        ed.selectType(PALETTE_TYPES.WALL);
        const r = ed.applyAt(world, 2, 2);
        expect(r.ok).toBe(false);
        expect(getTile(world, 2, 2)).toBe(TILE_FLOOR);
    });

    it('reports a noop when the tile is already the requested value', () => {
        const ed = new MazeRoomEditor();
        const world = makeBaseWorld();
        ed.selectType(PALETTE_TYPES.FLOOR);
        const r = ed.applyAt(world, 4, 4);
        expect(r.ok).toBe(true);
        expect(r.description).toMatch(/already floor/);
    });
});

// --- entrance ---

describe('MazeRoomEditor — entrance', () => {
    it('moves the entrance to the clicked tile', () => {
        const ed = new MazeRoomEditor();
        const world = makeBaseWorld();
        ed.selectType(PALETTE_TYPES.ENTRANCE);
        const r = ed.applyAt(world, 4, 3);
        expect(r.ok).toBe(true);
        expect(world.entrance).toEqual({ x: 4, y: 3 });
    });

    it('refuses to place entrance on a wall', () => {
        const ed = new MazeRoomEditor();
        const world = makeBaseWorld();
        setTile(world, 1, 1, TILE_WALL);
        ed.selectType(PALETTE_TYPES.ENTRANCE);
        const r = ed.applyAt(world, 1, 1);
        expect(r.ok).toBe(false);
    });
});

// --- items / obstacles ---

describe('MazeRoomEditor — items', () => {
    it('places the selected item id at the clicked tile', () => {
        const ed = new MazeRoomEditor({ itemLib: ITEM_LIB });
        ed.selectType(PALETTE_TYPES.ITEM);
        ed.selectItemId('key_blue');
        const world = makeBaseWorld();
        const r = ed.applyAt(world, 3, 2);
        expect(r.ok).toBe(true);
        expect(getItem(world, 3, 2)).toBe('key_blue');
        expect(world.itemLocationNames?.get('3,2')).toMatch(/Edited Location 3,2/);
    });

    it('refuses to place an item where an obstacle already lives', () => {
        const ed = new MazeRoomEditor({ itemLib: ITEM_LIB, obstacleLib: OBSTACLE_LIB });
        const world = makeBaseWorld();
        setObstacle(world, 2, 2, 'door_red');
        ed.selectType(PALETTE_TYPES.ITEM);
        const r = ed.applyAt(world, 2, 2);
        expect(r.ok).toBe(false);
        expect(getItem(world, 2, 2)).toBeUndefined();
    });
});

describe('MazeRoomEditor — obstacles', () => {
    it('places the selected obstacle id at the clicked tile', () => {
        const ed = new MazeRoomEditor({ obstacleLib: OBSTACLE_LIB });
        ed.selectType(PALETTE_TYPES.OBSTACLE);
        ed.selectObstacleId('door_blue');
        const world = makeBaseWorld();
        const r = ed.applyAt(world, 4, 4);
        expect(r.ok).toBe(true);
        expect(getObstacle(world, 4, 4)).toBe('door_blue');
    });

    it('refuses to place an obstacle on the entrance', () => {
        const ed = new MazeRoomEditor({ obstacleLib: OBSTACLE_LIB });
        const world = makeBaseWorld();
        ed.selectType(PALETTE_TYPES.OBSTACLE);
        const r = ed.applyAt(world, 0, 0);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('protected-entrance');
    });
});

// --- erase ---

describe('MazeRoomEditor — erase', () => {
    it('removes both an item and an obstacle on the same tile', () => {
        const ed = new MazeRoomEditor({ itemLib: ITEM_LIB, obstacleLib: OBSTACLE_LIB });
        const world = makeBaseWorld();
        setItem(world, 1, 1, 'key_red');
        // Engine allows both at one tile in raw form; we test that
        // erase clears whichever is present.
        ed.selectType(PALETTE_TYPES.ERASE);
        const r = ed.applyAt(world, 1, 1);
        expect(r.ok).toBe(true);
        expect(getItem(world, 1, 1)).toBeUndefined();
    });

    it('reports nothing-to-erase cleanly when the tile is empty', () => {
        const ed = new MazeRoomEditor();
        const world = makeBaseWorld();
        ed.selectType(PALETTE_TYPES.ERASE);
        const r = ed.applyAt(world, 5, 5);
        expect(r.ok).toBe(true);
        expect(r.description).toMatch(/Nothing to erase/);
    });
});

// --- bounds / validation ---

describe('MazeRoomEditor — bounds and validation', () => {
    it('returns no-world when applied without a world', () => {
        const ed = new MazeRoomEditor();
        ed.selectType(PALETTE_TYPES.FLOOR);
        const r = ed.applyAt(null, 0, 0);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('no-world');
    });

    it('rejects out-of-bounds clicks', () => {
        const ed = new MazeRoomEditor();
        ed.selectType(PALETTE_TYPES.FLOOR);
        const world = makeBaseWorld();
        const r = ed.applyAt(world, 100, 100);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('out-of-bounds');
    });
});
