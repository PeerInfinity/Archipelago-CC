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
    getBlock,
    getButton,
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ BLOCK / BUTTON / FLAG — PROCGEN ELEMENTS ARC 2, SLICE 4
 * ══════════════════════════════════════════════════════════════════════
 *
 * The three brushes that let a person build the reverse-pull gadget by hand.
 * ⛔ Each is asserted on TWO things — the CELL and the LIBRARY ENTRY — because
 * either alone is inert: a button with no `buttonLib` entry holds nothing, and
 * a door with no `obstacleLib` entry opens for everybody (`isObstacleCleared`
 * is permissive for an id the library does not hold).
 */

describe('MazeRoomEditor — the gadget brushes (elements arc 2, slice 4)', () => {
    const armed = (type) => {
        const ed = new MazeRoomEditor({ itemLib: ITEM_LIB, obstacleLib: OBSTACLE_LIB });
        ed.selectType(type);
        return ed;
    };

    it('BLOCK places a pushable block on a floor tile and refuses a wall', () => {
        const world = makeBaseWorld();
        const ed = armed(PALETTE_TYPES.BLOCK);
        const r = ed.applyAt(world, 3, 3);
        expect(r.ok).toBe(true);
        expect(r.type).toBe('block');
        expect(getBlock(world, 3, 3)).toBe(true);
        // ⛓ a second click on the same cell changes NOTHING and says so — the
        // page's `applyEdit` compares serialised worlds, so a no-op here must
        // not read as a modification.
        expect(ed.applyAt(world, 3, 3).description).toMatch(/already at \(3,3\)/);
        setTile(world, 4, 4, TILE_WALL);
        const bad = ed.applyAt(world, 4, 4);
        expect(bad.ok).toBe(false);
        expect(bad.reason).toBe('wall-tile');
        expect(getBlock(world, 4, 4)).toBe(false);
    });

    /**
     * ⛓⛓⛓ THE IDS ARE THE **BINDING'S OWN ALLOCATOR'S** (`guardIdsFor`), and
     * this row is the one that stops the page inventing a second spelling: it
     * asserts the literal strings the generator writes, so a private scheme
     * here would redden even though the world would still "work".
     */
    it('BUTTON places button_A0 with its buttonLib entry AND registers door_A0', () => {
        const world = makeBaseWorld();
        const ed = armed(PALETTE_TYPES.BUTTON);
        const r = ed.applyAt(world, 2, 2);
        expect(r.ok).toBe(true);
        expect(getButton(world, 2, 2)).toBe('button_A0');
        expect(world.buttonLib.button_A0).toEqual({
            id: 'button_A0', kind: 'button', holds: 'sw_A0',
        });
        // ⛔ the DOOR entry, registered but NOT placed — the OBSTACLE brush
        // puts it where the builder wants it.
        expect(world.obstacleLib.door_A0.clear_set_type).toBe('combo_list');
        expect(world.obstacleLib.door_A0.clear_set).toEqual([['sw_A0']]);
        expect(getObstacle(world, 2, 2)).toBeFalsy();
        // ⛓ …and the description names the ≥2-cell law (slice 1 §8.5): a door
        // beside its own button is opened by the player standing on it.
        expect(r.description).toMatch(/TWO cells away/);
    });

    it('…and a SECOND button takes the next FREE index, scanned off the WORLD', () => {
        const world = makeBaseWorld();
        const ed = armed(PALETTE_TYPES.BUTTON);
        ed.applyAt(world, 2, 2);
        ed.applyAt(world, 5, 2);
        expect(getButton(world, 5, 2)).toBe('button_A1');
        expect(world.buttonLib.button_A1.holds).toBe('sw_A1');
        expect(world.obstacleLib.door_A1).toBeTruthy();
        // ⛔ AND IT SCANS THE WORLD, NOT A COUNTER ON THE EDITOR: a FRESH editor
        // on the same world must not collide with what is already there.
        const other = armed(PALETTE_TYPES.BUTTON);
        other.applyAt(world, 6, 3);
        expect(getButton(world, 6, 3)).toBe('button_A2');
    });

    it('FLAG places flag_K0 as an ITEM with kind:"flag" in the itemLib', () => {
        const world = makeBaseWorld();
        const ed = armed(PALETTE_TYPES.FLAG);
        const r = ed.applyAt(world, 4, 1);
        expect(r.ok).toBe(true);
        expect(getItem(world, 4, 1)).toBe('flag_K0');
        expect(world.itemLib.flag_K0.kind).toBe('flag');
        expect(world.itemLocationNames.get('4,1')).toBe('Edited Location 4,1');
        ed.applyAt(world, 5, 1);
        expect(getItem(world, 5, 1)).toBe('flag_K1');
        // ⚠ `kind:'flag'` is INERT in the engine — every pickup is already
        // permanent (slice 1 §8.6). It is a DECLARATION for layer 1 and the
        // renderer, and this row says so rather than implying a behaviour.
        expect(world.itemLib.flag_K0.classification).toBe('progression');
    });

    it('a WALL over a block or a button REFUSES — a pushable entity inside rock '
        + 'is a piece nothing can ever move', () => {
        const world = makeBaseWorld();
        armed(PALETTE_TYPES.BLOCK).applyAt(world, 3, 3);
        armed(PALETTE_TYPES.BUTTON).applyAt(world, 3, 4);
        const wall = armed(PALETTE_TYPES.WALL);
        expect(wall.applyAt(world, 3, 3).reason).toBe('occupied');
        expect(wall.applyAt(world, 3, 4).reason).toBe('occupied');
        expect(getTile(world, 3, 3)).toBe(TILE_FLOOR);
    });

    it('ERASE takes the block and the button too, and LEAVES the library entry', () => {
        const world = makeBaseWorld();
        armed(PALETTE_TYPES.BLOCK).applyAt(world, 3, 3);
        armed(PALETTE_TYPES.BUTTON).applyAt(world, 3, 3);
        const r = armed(PALETTE_TYPES.ERASE).applyAt(world, 3, 3);
        expect(r.ok).toBe(true);
        expect(r.description).toMatch(/block/);
        expect(r.description).toMatch(/button button_A0/);
        expect(getBlock(world, 3, 3)).toBe(false);
        expect(getButton(world, 3, 3)).toBeUndefined();
        /**
         * ⛔ THE ENTRY STAYS ON PURPOSE. `door_A0` may still be on the grid, and
         * `isObstacleCleared` returns TRUE for an id the library does not hold —
         * so dropping the entry would turn that door into one that opens for
         * everybody. A door with no presser is a level the ORACLE refuses BY
         * NAME, which is the honest outcome.
         */
        expect(world.buttonLib.button_A0).toBeTruthy();
        expect(world.obstacleLib.door_A0).toBeTruthy();
    });

    it('ERASE on an empty cell still says NOTHING TO ERASE', () => {
        const world = makeBaseWorld();
        expect(armed(PALETTE_TYPES.ERASE).applyAt(world, 7, 5).description)
            .toMatch(/Nothing to erase/);
    });
});
