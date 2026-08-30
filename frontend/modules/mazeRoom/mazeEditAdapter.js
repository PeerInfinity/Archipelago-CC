/**
 * mazeRoom/mazeEditAdapter — **THE MAZE, AS AN `editCore` ADAPTER.**
 *
 * EDITOR v3 arc, slice A1 (`NewDocs/plans/seedling-editor-v3.md` §7.2, §8.1).
 * ⛔ A THIN WRAPPER AND NOTHING MORE: every rule about what a maze edit MEANS
 * already lives in `mazeRoomEditor.applyEditOp` (the ONE application path a
 * press and a replay both take), every rule about what a maze world IS lives in
 * `procgenMaze`, and this file's whole job is to say those two things in the
 * six words `editCore` asks for.
 *
 * ⚠ §8.1's measured correction is why the adapter is thin: the maze's edits
 * have been closed OPS since procgen elements arc 2 slice 4 (`EDIT_OPS`, eight
 * of them). What it does NOT have is a base+ops IDENTITY — `mazeLab.undoEdit`
 * is a WORLD STACK pop — a `group`, rect copy/paste or a flood. Those are the
 * core's, and this file is what lets the maze have them.
 *
 * ── ⛔⛔ THE THREE THINGS THIS FILE IS NOT ALLOWED TO INVENT ───────────
 *
 * **The op vocabulary.** `EDIT_OPS` is read, never retyped: `applyEditOp`
 * refuses an op outside it BY NAME (`unknown-op`, quoting the list), and this
 * file forwards that refusal rather than adding a second gate that could go
 * stale the day a ninth op arrives. ⚠ `group` never reaches here — `editCore`
 * intercepts it — so the adapter's `apply` really does see only atomic ops.
 *
 * **The comparison.** `equal` is `procgenMaze.worldsEqual`, which is
 * `mazeLab.applyEdit`'s own test extracted (slice A1) rather than re-spelled:
 * *did the WORLD change, not what the editor called it* (trap 263).
 *
 * **The ids.** `readCell` inverts a button/flag id to its INDEX through
 * `indexOfGuardId` / `indexOfFlagId`, which search the ONE allocator. A regexp
 * here would be a second spelling of `button_A{n}`.
 *
 * ── ⚠ THE BOUNDS THIS ADAPTER SHIPS WITH (each pinned by a test) ──────
 *
 *  1. **`applyEditOp` MUTATES its world**, so `apply` clones first and returns
 *     the clone. The core's contract ("the input is never mutated") is kept
 *     HERE, at the seam, and not asked of the maze.
 *  2. **The ENTRANCE is a SINGLETON.** It is a fact about a cell (`readCell`
 *     reports it, so a flood stops at it instead of trying to wall it), but
 *     there is no op that REMOVES one — `setEntrance` MOVES the world's only
 *     entrance. ⇒ a rect paste of a clip that contains the entrance MOVES it,
 *     and the cell it came from silently stops being the entrance.
 *  3. **`setButton index` is RESOLVED, and `applyEditOp` does not refuse a
 *     DUPLICATE.** Pasting a button clip elsewhere in the same world places a
 *     SECOND cell holding `button_A{n}`. Measured, not assumed — see
 *     `mazeEditAdapter.test.js`'s row of that name. It is a bound and not a
 *     defect of this file: the op shape carries the resolved index on purpose
 *     (a replay must not allocate a different one), and refusing a duplicate is
 *     `applyEditOp`'s call to make, not the adapter's.
 *  4. **`clearEntity` does not clear the entrance** (by design — the entrance
 *     has nowhere to go), so `writeOps` for a descriptor with no entrance
 *     leaves an entrance standing on the destination cell.
 */

import {
    EDIT_OPS,
    TILE_NAMES,
    applyEditOp,
    indexOfFlagId,
    indexOfGuardId,
} from './mazeRoomEditor.js';
import {
    getBlock, getButton, getItem, getObstacle, getTile, isEntrance,
} from './mazeRoomEngine.js';
import { cloneWorld, worldsEqual } from './procgenMaze.js';

/**
 * ⛓ `TILE_FLOOR` → `'floor'` — the inverse of `TILE_NAMES`, DERIVED from it so
 * the two cannot drift. `setTile` takes the NAME, `getTile` returns the value,
 * and this is the one place the maze's adapter crosses between them.
 */
const NAME_OF_TILE = Object.freeze(Object.fromEntries(
    Object.entries(TILE_NAMES).map(([name, value]) => [value, name]),
));

/**
 * ⛓⛓ **A CELL, AS A CLOSED COMPARABLE VALUE** — `{tile, entity}`.
 *
 * `entity` is `null` or an object holding every part the cell carries. ⛔ It is
 * a BAG rather than a single kind because the engine lets a cell hold more than
 * one: `_setBlock` refuses only a wall, `_setButton` refuses only a wall, and
 * `clearEntity` takes all four at once. A descriptor that named just "the"
 * entity would lose the second one on every copy.
 *
 * ⛓ A FLAG IS AN ITEM to the engine and a different OP to the editor (only the
 * flag writes the `itemLib` entry the renderer and layer 1 read), so it is
 * reported as `flag` and not as `item` — `indexOfFlagId` is what tells them
 * apart, by searching the allocator.
 */
export function readMazeCell(world, x, y) {
    const parts = {};
    if (isEntrance(world, x, y)) parts.entrance = true;
    const item = getItem(world, x, y);
    if (item) {
        const flag = indexOfFlagId(item);
        if (flag === null) parts.item = item; else parts.flag = flag;
    }
    const obstacle = getObstacle(world, x, y);
    if (obstacle) parts.obstacle = obstacle;
    if (getBlock(world, x, y)) parts.block = true;
    const button = getButton(world, x, y);
    if (button) parts.button = indexOfGuardId(button);
    return {
        tile: NAME_OF_TILE[getTile(world, x, y)] ?? null,
        entity: Object.keys(parts).length === 0 ? null : parts,
    };
}

/**
 * ⛓⛓ **THE INVERSE — THE OPS THAT MAKE (x,y) LOOK LIKE `desc`.**
 *
 * ⛔ THE ORDER IS THE CONTRACT, and each step is forced by a refusal in
 * `mazeRoomEditor`:
 *
 *   1. `clearEntity` — `_setWall` refuses an OCCUPIED cell, so the entities go
 *      before the tile or a floor→wall paste dies on its own leftovers;
 *   2. `setTile` — every entity op refuses a WALL tile, so the tile goes before
 *      the entities or an entity→floor paste dies the other way;
 *   3. the entity ops;
 *   4. `setEntrance` LAST — it refuses a wall tile too, and it is the one op
 *      that touches the world outside this cell (bound 2 in the file docblock).
 *
 * ⚠ IT EMITS OPS ONLY FOR THE FIELDS THE DESCRIPTOR PRESENTS — that is the
 * core's `tilesOnly` / `entitiesOnly` contract, and it is why the two filters
 * are a projection of this shape rather than a second op set.
 */
export function mazeWriteOps(desc, x, y) {
    const out = [];
    const hasTile = Object.prototype.hasOwnProperty.call(desc ?? {}, 'tile');
    const hasEntity = Object.prototype.hasOwnProperty.call(desc ?? {}, 'entity');
    if (hasEntity) out.push({ op: 'clearEntity', x, y });
    if (hasTile) out.push({ op: 'setTile', x, y, tile: desc.tile });
    if (hasEntity && desc.entity) {
        const e = desc.entity;
        if (e.item !== undefined) out.push({ op: 'setItem', x, y, id: e.item });
        if (e.flag !== undefined) out.push({ op: 'setFlag', x, y, index: e.flag });
        if (e.obstacle !== undefined) out.push({ op: 'setObstacle', x, y, id: e.obstacle });
        if (e.block) out.push({ op: 'setBlock', x, y });
        if (e.button !== undefined) out.push({ op: 'setButton', x, y, index: e.button });
        if (e.entrance) out.push({ op: 'setEntrance', x, y });
    }
    return out;
}

/**
 * ⛓ THE ADAPTER. `locationNameFormat` is the ONE page-level convention an op
 * does not carry (`applyEditOp`'s own note), so it is a construction parameter
 * here rather than a default this file invents.
 */
export function createMazeEditAdapter({ locationNameFormat = undefined } = {}) {
    const opts = locationNameFormat ? { locationNameFormat } : {};
    return Object.freeze({
        name: 'maze',
        /**
         * ⛓⛓ ONE ATOMIC OP, ON A CLONE. ⛔ `applyEditOp` writes THROUGH the
         * world it is handed (`setTile` and friends are the engine's mutators),
         * so the clone is what makes the core's "the input is never mutated"
         * true. A refusal discards the clone — a half-written world is never
         * handed back, which is the same promise the group's all-or-nothing
         * arm makes one level up.
         *
         * ⚠ THE OP RETURNED IS `applyEditOp`'s RESOLVED one, verbatim: a
         * `setButton index: null` comes back carrying the index that was
         * actually allocated, exactly as a recorded directive carries its
         * drawn parameters. A session that stored the op it was HANDED would
         * replay a different gadget on a world that had grown one.
         */
        apply(record, op) {
            const next = cloneWorld(record);
            const res = applyEditOp(next, op, opts);
            if (!res.ok) {
                return { ok: false, description: `maze: ${res.description}`, reason: res.reason };
            }
            return { ok: true, op: res.op, description: res.description, record: next };
        },
        equal: worldsEqual,
        bounds: (record) => ({ w: record.width, h: record.height }),
        readCell: readMazeCell,
        writeOps: mazeWriteOps,
    });
}

/** ⛓ The default adapter — every caller that has no page convention to carry. */
export const mazeEditAdapter = createMazeEditAdapter();

/** ⛓ Re-exported so a caller can read the vocabulary off the adapter's own
 *  module rather than reaching past it into the editor. ⛔ The SAME frozen
 *  array, not a copy. */
export { EDIT_OPS };
