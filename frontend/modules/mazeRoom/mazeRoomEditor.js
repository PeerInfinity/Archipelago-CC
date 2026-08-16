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
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 2, slice 4 — **BLOCK / BUTTON / FLAG**, the three
 * brushes that let a person build the reverse-pull gadget by hand (arc-2
 * §10.11.2). Each is the engine's own accessor (`setBlock` / `setButton` /
 * `setItem`) plus the LIBRARY ENTRY without which the mechanism is inert:
 *
 *   - a BUTTON with no `buttonLib` entry HOLDS NOTHING (`heldTokens` reads
 *     `holds` off the entry), so the door it is supposed to open never opens;
 *   - a FLAG with no `itemLib` entry is a plain item — `kind:'flag'` is the
 *     DECLARATION layer 1 and the renderer read (slice 1 §8.6);
 *   - a BUTTON also registers its matching `door_A{n}` obstacle entry, because
 *     `isObstacleCleared` returns TRUE for an id the library does not hold, so a
 *     door placed without one would be a gate that does not gate.
 *
 * ⛔ **THE IDS COME FROM THE BINDING'S OWN ALLOCATOR** (`procgenCore/elements.
 * guardIdsFor` / `flagIdFor`), never from a private scheme here. A page that
 * invented `button_1` would build gadgets the generator cannot read back, and
 * the two spellings would drift with nobody to notice. What IS local is picking
 * the next FREE index, because only a caller holding a world knows which are
 * taken.
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
    setBlock,
    clearBlock,
    setButton,
    clearButton,
    getItem,
    getObstacle,
    getBlock,
    getButton,
    isExit,
} from './mazeRoomEngine.js';
/**
 * ⛔ `procgenCore/elements.js` AND NOT `procgenMaze.js`: this file is the
 * PANEL's editor as well as the lab page's, and importing the generator for
 * three template strings would put the loop, the area graph and every element
 * module into `mazeRoomUI`'s graph. The definitions moved to `procgenCore/`
 * (which imports nothing substrate-side) and `procgenMaze` re-exports them.
 */
import { flagIdFor, guardIdsFor } from '../procgenCore/elements.js';

export const PALETTE_TYPES = Object.freeze({
    FLOOR:    'floor',
    WALL:     'wall',
    ENTRANCE: 'entrance',
    ITEM:     'item',
    OBSTACLE: 'obstacle',
    BLOCK:    'block',
    BUTTON:   'button',
    FLAG:     'flag',
    ERASE:    'erase',
});

export const PALETTE_ENTRIES = Object.freeze([
    { type: PALETTE_TYPES.FLOOR,    label: 'Floor',    glyph: '·' },
    { type: PALETTE_TYPES.WALL,     label: 'Wall',     glyph: '█' },
    { type: PALETTE_TYPES.ENTRANCE, label: 'Entrance', glyph: '◆' },
    { type: PALETTE_TYPES.ITEM,     label: 'Item',     glyph: '○' },
    { type: PALETTE_TYPES.OBSTACLE, label: 'Obstacle', glyph: '✕' },
    /** ⛓ arc 2 slice 4 — the gadget's three parts, each with its lib entry. */
    { type: PALETTE_TYPES.BLOCK,    label: 'Block',    glyph: '▣' },
    { type: PALETTE_TYPES.BUTTON,   label: 'Button',   glyph: '◉' },
    { type: PALETTE_TYPES.FLAG,     label: 'Flag',     glyph: '⚑' },
    { type: PALETTE_TYPES.ERASE,    label: 'Erase entity', glyph: '⌫' },
]);

/**
 * ⛓ THE NEXT FREE INDEX for a per-instance id family, scanned off the WORLD
 * rather than counted on the editor. ⛔ Asked of the world for trap 263's
 * reason ("ask the world, not the tool that changed it"): an editor that kept
 * its own counter would collide with the ids the BINDING wrote the moment a
 * generated level was edited, which is the only interesting case.
 */
function nextFreeIndex(taken) {
    let n = 0;
    while (taken(n)) n += 1;
    return n;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE OPS — PROCGEN ELEMENTS ARC 2, SLICE 4 (constructive §18.2's residue)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ **AN EDIT IS AN OP, NOT A DESCRIPTION**, and that sentence is the whole
 * change. Constructive slice 12 recorded a maze edit as
 * `{n, type, at, palette, description}` — the editor's SELECTED TYPE and the
 * cell — while `_setItem`/`_setObstacle` read `selectedItemId`/
 * `selectedObstacleId`, which no payload carried. Folding that list would place
 * A DIFFERENT BODY AT THE RIGHT CELL, so `agreementWithPayload` REFUSED an
 * edited payload by name and `?gen=` could not reproduce one (§17.2, §18.2).
 *
 * An op is CLOSED: it carries its whole argument, so applying it needs no
 * editor and no selection state.
 *
 *     {op:'setTile',     x, y, tile:'floor'|'wall'}
 *     {op:'setEntrance', x, y}
 *     {op:'setItem',     x, y, id}
 *     {op:'setObstacle', x, y, id}
 *     {op:'setBlock',    x, y}
 *     {op:'setButton',   x, y, index}     → guardIdsFor(index)
 *     {op:'setFlag',     x, y, index}     → flagIdFor(`K${index}`)
 *     {op:'clearEntity', x, y}
 *
 * ⛓⛓ **THE OP THAT IS RECORDED IS THE ONE THAT WAS PERFORMED, WITH ITS INDEX
 * RESOLVED** — the same law `applyDirective` already follows for a directive's
 * drawn parameters (*"a RECORDED directive's params are the RESOLVED values, so
 * the replay spends no draw"*). A button op that said "take the next free
 * index" would allocate a DIFFERENT id on a world that had grown one, and the
 * replay would build a gadget nobody edited.
 *
 * ⛔ AND THERE IS EXACTLY ONE APPLICATION PATH: `applyAt` builds an op from the
 * palette selection and hands it to `applyEditOp`, which is what a REPLAY calls
 * too. Two paths would be two answers to *"what does this edit do"*, and the
 * replay's would be the one nobody looks at.
 */
export const EDIT_OPS = Object.freeze([
    'setTile', 'setEntrance', 'setItem', 'setObstacle', 'setBlock', 'setButton', 'setFlag',
    'clearEntity',
]);

export const TILE_NAMES = Object.freeze({ floor: TILE_FLOOR, wall: TILE_WALL });

/** ⛓ `button_A3` → 3. Derived from the ONE allocator by search rather than by a
 *  regexp, so a change to the id shape cannot leave a second spelling behind. */
function indexOfGuardId(buttonId) {
    for (let n = 0; n < 64; n += 1) if (guardIdsFor(n).button === buttonId) return n;
    return null;
}

const DEFAULT_LOCATION_NAME_FORMAT = (x, y) => `Edited Location ${x},${y}`;

/**
 * ⛓⛓⛓ **APPLY ONE OP — THE ONE APPLICATION PATH**, used by the palette (through
 * `applyAt`) and by a payload REPLAY alike.
 *
 * ⛔ It needs no palette selection, which is exactly the property the old
 * DESCRIPTION record lacked: every argument is in the op. The editor it builds
 * is a throwaway holding only the location-name format, because that is the one
 * page-level convention an op does not carry (and a replay wants the same one).
 *
 * @returns the same descriptor `applyAt` returns, including the RESOLVED op.
 */
export function applyEditOp(world, op, { locationNameFormat = DEFAULT_LOCATION_NAME_FORMAT } = {}) {
    if (!world) return notOk('no-world', 'No world loaded.');
    if (!op || !EDIT_OPS.includes(op.op)) {
        return notOk('unknown-op', `Unknown edit op ${JSON.stringify(op?.op)} — the declared `
            + `ops are [${EDIT_OPS.join(', ')}]. ⛓ An edit recorded before this shape existed `
            + 'is a DESCRIPTION and cannot be replayed; load its level instead.');
    }
    const { x, y } = op;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        return notOk('bad-cell', `Edit op ${op.op} names cell ${JSON.stringify([x, y])}, which `
            + 'is not a pair of integers.');
    }
    if (!withinBounds(world, x, y)) {
        return notOk('out-of-bounds', `Tile (${x},${y}) is out of bounds.`);
    }
    const ed = new MazeRoomEditor({ locationNameFormat });
    switch (op.op) {
        case 'setTile': {
            if (op.tile === 'wall') return ed._setWall(world, x, y);
            if (op.tile !== 'floor') {
                return notOk('bad-tile', `setTile names tile ${JSON.stringify(op.tile)}; the `
                    + `declared names are [${Object.keys(TILE_NAMES).join(', ')}].`);
            }
            return ed._setTile(world, x, y, TILE_FLOOR, 'floor');
        }
        case 'setEntrance': return ed._setEntrance(world, x, y);
        case 'setItem': return ed._setItem(world, x, y, op.id);
        case 'setObstacle': return ed._setObstacle(world, x, y, op.id);
        case 'setBlock': return ed._setBlock(world, x, y);
        case 'setButton': return ed._setButton(world, x, y, op.index ?? null);
        case 'setFlag': return ed._setFlag(world, x, y, op.index ?? null);
        default: return ed._eraseEntity(world, x, y);
    }
}

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
    /**
     * ⛓⛓ THE PALETTE SELECTION + A CELL → A **CLOSED OP**. ⛔ This is where the
     * editor's private state (`selectedItemId`, `selectedObstacleId`) is spent,
     * and it is the ONLY place: from here on the op carries its own argument
     * and a replay needs no editor. `index: null` on the two allocating ops
     * means *"ask the world for the next free one"* — `applyEditOp` resolves it
     * and the DESCRIPTOR carries the number that was actually used.
     */
    opFor(x, y) {
        switch (this.selectedType) {
            case PALETTE_TYPES.FLOOR: return { op: 'setTile', x, y, tile: 'floor' };
            case PALETTE_TYPES.WALL: return { op: 'setTile', x, y, tile: 'wall' };
            case PALETTE_TYPES.ENTRANCE: return { op: 'setEntrance', x, y };
            case PALETTE_TYPES.ITEM: return { op: 'setItem', x, y, id: this.selectedItemId };
            case PALETTE_TYPES.OBSTACLE:
                return { op: 'setObstacle', x, y, id: this.selectedObstacleId };
            case PALETTE_TYPES.BLOCK: return { op: 'setBlock', x, y };
            case PALETTE_TYPES.BUTTON: return { op: 'setButton', x, y, index: null };
            case PALETTE_TYPES.FLAG: return { op: 'setFlag', x, y, index: null };
            case PALETTE_TYPES.ERASE: return { op: 'clearEntity', x, y };
            default: return null;
        }
    }

    applyAt(world, x, y) {
        if (!world) return notOk('no-world', 'No world loaded.');
        if (!withinBounds(world, x, y)) return notOk('out-of-bounds', `Tile (${x},${y}) is out of bounds.`);
        const op = this.opFor(x, y);
        if (!op) return notOk('unknown-type', `Unknown palette type ${this.selectedType}.`);
        /**
         * ⛔ ONE APPLICATION PATH — a press and a REPLAY go through the same
         * function, so a defect in one is a defect in both and the replay's
         * cannot be the one nobody looks at. ⚠ The two id-bearing ops keep this
         * editor's own libraries by carrying the SELECTED id in the op.
         */
        return applyEditOp(world, op, { locationNameFormat: this.locationNameFormat });
    }

    // --- per-type apply ---

    _setTile(world, x, y, tileValue, label) {
        const op = { op: 'setTile', x, y, tile: label };
        const before = getTile(world, x, y);
        if (before === tileValue) return ok('tile', `Tile (${x},${y}) already ${label}.`, op);
        setTile(world, x, y, tileValue);
        return ok('tile', `Set tile (${x},${y}) to ${label}.`, op);
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
        /**
         * ⛓ SLICE 4 — A BLOCK AND A BUTTON COUNT AS OCCUPANTS TOO. A wall
         * written over a block would leave a pushable entity inside solid rock:
         * `step` never lets the player reach it, `createState` still puts it in
         * the visited key, and the level would carry a piece nothing can move.
         */
        if (getItem(world, x, y) || getObstacle(world, x, y)
            || getBlock(world, x, y) || getButton(world, x, y)) {
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
        const op = { op: 'setEntrance', x, y };
        const before = { ...world.entrance };
        if (before.x === x && before.y === y) {
            return ok('entrance', `Entrance already at (${x},${y}).`, op);
        }
        setEntrance(world, x, y);
        return ok('entrance', `Moved entrance to (${x},${y}) (was (${before.x},${before.y})).`,
            op);
    }

    _setItem(world, x, y, itemId = this.selectedItemId) {
        if (!itemId) return notOk('no-item', 'No item id selected.');
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'Item must be on a floor tile.');
        }
        if (getObstacle(world, x, y)) {
            return notOk('occupied', 'Tile already has an obstacle.');
        }
        if (isExit(world, x, y)) {
            return notOk('exit-tile', 'Cannot place an item on an exit tile.');
        }
        setItem(world, x, y, itemId);
        ensureItemLocationNameMap(world);
        const locationName = this.locationNameFormat(x, y);
        world.itemLocationNames.set(`${x},${y}`, locationName);
        return ok('item', `Placed item ${itemId} at (${x},${y}).`,
            { op: 'setItem', x, y, id: itemId });
    }

    _setObstacle(world, x, y, obstacleId = this.selectedObstacleId) {
        if (!obstacleId) return notOk('no-obstacle', 'No obstacle id selected.');
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'Obstacle must be on a floor tile.');
        }
        if (getItem(world, x, y)) {
            return notOk('occupied', 'Tile already has an item.');
        }
        if (world.entrance.x === x && world.entrance.y === y) {
            return notOk('protected-entrance', 'Cannot place an obstacle on the entrance.');
        }
        setObstacle(world, x, y, obstacleId);
        return ok('obstacle', `Placed obstacle ${obstacleId} at (${x},${y}).`,
            { op: 'setObstacle', x, y, id: obstacleId });
    }

    /**
     * ⛓ A PUSHABLE BLOCK — the gadget's moving part. ⛔ `world.blocks` is the
     * level's INITIAL layout; `state.blocks` is where they are mid-solve, and
     * this brush edits the level (`mazeRoomEngine.js`'s own note at `setBlock`).
     *
     * ⚠ A block ON the exit, or in line with it with wall beyond, is a way to
     * build an UNSOLVABLE level (slice 1 §8.4) — and it is not refused here.
     * ⚖ §3.8's law is that editing never bypasses the ORACLE, not that the
     * editor second-guesses it: the certification drops on every edit and SOLVE
     * is what says whether the room still works. Refusing here would be this
     * file inventing a solvability rule beside the one that exists.
     */
    _setBlock(world, x, y) {
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'A block must stand on a floor tile.');
        }
        const op = { op: 'setBlock', x, y };
        if (getBlock(world, x, y)) {
            return ok('block', `A block is already at (${x},${y}).`, op);
        }
        setBlock(world, x, y);
        return ok('block', `Placed a pushable block at (${x},${y}).`, op);
    }

    /**
     * ⛓⛓ A BUTTON, ITS HELD TOKEN AND THE DOOR THAT TOKEN OPENS — three
     * writes, because any one of them alone is inert:
     *
     *  1. `world.buttons` — the cell;
     *  2. `world.buttonLib[button_A{n}] = {kind:'button', holds:'sw_A{n}'}` —
     *     without it `heldTokens` derives nothing and the button is scenery;
     *  3. `world.obstacleLib[door_A{n}] = combo_list [['sw_A{n}']]` — REGISTERED
     *     but NOT PLACED, so the OBSTACLE brush can put that door where the
     *     builder wants it. ⛔ `isObstacleCleared` is permissive for an id the
     *     library does not hold, so a door placed without its entry would open
     *     for everybody — registering here is what stops that.
     *
     * ⚠ THE DOOR MUST END UP AT LEAST **TWO** CELLS FROM ITS BUTTON or the
     * gadget is decorative: the player standing on the button presses it
     * themselves and steps straight through (slice 1 §8.5, the gate-of-arrival
     * exception). Said in the description, not enforced — where the door goes is
     * the next click's business and the ORACLE is what grades the result.
     */
    _setButton(world, x, y, index = null) {
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'A button must be on a floor tile.');
        }
        const existing = getButton(world, x, y);
        if (existing) {
            return ok('button', `Button ${existing} is already at (${x},${y}).`,
                { op: 'setButton', x, y, index: indexOfGuardId(existing) });
        }
        /**
         * ⛓ THE INDEX IS RESOLVED HERE AND RECORDED IN THE OP. A replay passes
         * the one that was ALLOCATED; only a fresh press leaves it `null` and
         * asks the world for the next free one.
         */
        const n = index ?? nextFreeIndex((k) => guardIdsFor(k).button in (world.buttonLib ?? {})
            || guardIdsFor(k).door in (world.obstacleLib ?? {}));
        const ids = guardIdsFor(n);
        setButton(world, x, y, ids.button);
        world.buttonLib = {
            ...(world.buttonLib ?? {}),
            [ids.button]: { id: ids.button, kind: 'button', holds: ids.hold },
        };
        world.obstacleLib = {
            ...(world.obstacleLib ?? {}),
            [ids.door]: {
                name: `Guard Door ${ids.door}`,
                id: ids.door,
                clear_set_type: 'combo_list',
                clear_set: [[ids.hold]],
                color: '#b07f3f',
                feature: 'element_guard',
            },
        };
        return ok('button', `Placed ${ids.button} at (${x},${y}); it HOLDS ${ids.hold} while a `
            + `block (or the player) stands on it, and ${ids.door} is now in the obstacle `
            + 'library — place it at least TWO cells away, or the player presses the button '
            + 'and walks straight through.', { op: 'setButton', x, y, index: n });
    }

    /**
     * ⛓ A FLAG — a step-on LATCH (⚖ design rulings 21-22). In the engine it is
     * an ITEM and `kind: 'flag'` is INERT there, because every pickup is already
     * permanent (slice 1 §8.6); the `kind` is the DECLARATION the renderer and
     * layer 1 read, which is why the library entry is written and not just the
     * cell.
     */
    _setFlag(world, x, y, index = null) {
        if (getTile(world, x, y) === TILE_WALL) {
            return notOk('wall-tile', 'A flag must be on a floor tile.');
        }
        if (getObstacle(world, x, y)) {
            return notOk('occupied', 'Tile already has an obstacle.');
        }
        if (isExit(world, x, y)) {
            return notOk('exit-tile', 'Cannot place a flag on an exit tile.');
        }
        const n = index ?? nextFreeIndex((k) => flagIdFor(`K${k}`) in (world.itemLib ?? {}));
        const id = flagIdFor(`K${n}`);
        world.itemLib = {
            ...(world.itemLib ?? {}),
            [id]: {
                name: `Area Flag ${id}`,
                id,
                classification: 'progression',
                kind: 'flag',
                color: '#e0c07f',
                symbol: 'flag',
                feature: 'area_graph',
            },
        };
        setItem(world, x, y, id);
        ensureItemLocationNameMap(world);
        world.itemLocationNames.set(`${x},${y}`, this.locationNameFormat(x, y));
        return ok('flag', `Placed ${id} at (${x},${y}) — a step-on LATCH: picking it up is `
            + 'permanent, which is what makes it a flag rather than a held button.',
        { op: 'setFlag', x, y, index: n });
    }

    /**
     * ⛓ SLICE 4 — ERASE takes the BLOCK and the BUTTON too. ⛔ The button's
     * LIBRARY ENTRY is deliberately LEFT: `door_A{n}` may still be on the grid
     * and `isObstacleCleared` would then open it for everybody. An id whose
     * cell is gone costs nothing (`serializeMazeEntities` emits `buttonLib` from
     * the object, and a door with no presser is a door nobody opens — which is
     * a level the ORACLE refuses, by name, rather than one that silently
     * solves).
     */
    _eraseEntity(world, x, y) {
        const removedItem = getItem(world, x, y);
        const removedObstacle = getObstacle(world, x, y);
        const removedBlock = getBlock(world, x, y);
        const removedButton = getButton(world, x, y);
        const op = { op: 'clearEntity', x, y };
        if (!removedItem && !removedObstacle && !removedBlock && !removedButton) {
            return ok('erase', `Nothing to erase at (${x},${y}).`, op);
        }
        if (removedItem) {
            clearItem(world, x, y);
            world.itemLocationNames?.delete(`${x},${y}`);
        }
        if (removedObstacle) clearObstacle(world, x, y);
        if (removedBlock) clearBlock(world, x, y);
        if (removedButton) clearButton(world, x, y);
        const parts = [];
        if (removedItem) parts.push(`item ${removedItem}`);
        if (removedObstacle) parts.push(`obstacle ${removedObstacle}`);
        if (removedBlock) parts.push('block');
        if (removedButton) parts.push(`button ${removedButton}`);
        return ok('erase', `Erased ${parts.join(' + ')} at (${x},${y}).`, op);
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

/**
 * ⛓ EVERY SUCCESSFUL DESCRIPTOR CARRIES THE **OP THAT WAS PERFORMED**, with
 * every index resolved — that is what makes an edit replayable. A REFUSAL
 * carries none: there is nothing to replay.
 */
function ok(type, description, op = null) {
    return { ok: true, type, description, op: op && Object.freeze({ ...op }) };
}

function notOk(reason, description) {
    return { ok: false, type: 'noop', reason, description, op: null };
}
