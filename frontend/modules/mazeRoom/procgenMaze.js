/**
 * mazeRoom/procgenMaze — THE MAZE BINDINGS: the second substrate on the
 * procgen loop.
 *
 * CONSTRUCTIVE-MODE arc, slice 2 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.2). ⚖ Ruling 3: *"maze first, as the SECOND SUBSTRATE ON THE
 * ONE LOOP"* — ⛔ not a maze-local re-implementation of it. This file is the
 * mirror of `seedlingDemo/procgenSeedling.js`: `procgenCore/levelGenerator.js`
 * imports nothing, and this file imports everything the maze needs and hands
 * the loop the three injected pieces — LEVEL MODEL, ORACLE, PALETTE.
 *
 * ⛓ THE PoC ARC'S §1.7 PROVISION IS WHAT THIS SPENDS: *"when a second
 * substrate exists and can argue about the interface, the core moves and the
 * bindings stay."* What the argument produced is in the as-built; the one
 * contract change it forced was `VERDICT` (declared in `levelGenerator.js`
 * since this slice, because two oracles must return the same word and the maze
 * may not import Seedling's file). Everything else in the seam was written
 * against without a change, including the anchor's `{tx, ty}` spelling — see
 * `anchorsFor` below.
 *
 * ── ⛔⛔ THE MAZE WORLD IS **MUTABLE**, AND THE LOOP'S REVERT IS "KEEP THE
 *    OLD RECORD" ────────────────────────────────────────────────────────
 *
 * ⚖ Kickoff §5's live trap, and it is the whole reason `place` is written the
 * way it is. `levelGenerator` has no undo: a rejected candidate is discarded by
 * dropping the reference, and the accepted record is only ever reassigned. A
 * Seedling record is FROZEN, so that is free. A maze world is an `Int8Array`
 * and four `Map`s, so a `place` that wrote in place would leave every REVERTED
 * candidate standing in the world the loop believes it reverted — a defect that
 * shows as *"the generator kept things it says it did not"* three levels
 * downstream. ⇒ **`place` CLONES FIRST AND RETURNS A NEW WORLD**, and the test
 * drives it (`place` twice from one record ⇒ the record is unchanged and the
 * two results are equal).
 *
 * ── WHAT THE MODEL OWES THE LOOP ──────────────────────────────────────
 *
 *   `skeleton()`      the open room + its goal exit — the control that must
 *                     solve before any template is drawn
 *   `anchorsFor(...)` up to `limit` LEGAL anchors, in one seeded shuffle's
 *                     order, or `[]` when the room has no room for that shape
 *   `refusalAt(...)`  WHY one named cell is refused, in the model's own words,
 *                     or `null`. `legalAt` is DERIVED from it, so the loop's
 *                     silent boolean and a page's sentence are one adjudication
 *   `place(...)`      tiles, obstacles and items written TOGETHER (⚖ §1.2's
 *                     atomic placement), returning a NEW world
 *
 * ── ⚠ REGISTER-ON-IMPORT (⚖ kickoff §5) ──────────────────────────────
 *
 * Importing `mazeRoomEngine.js` pulls in `./mazeAlgorithms/index.js` for its
 * side effect (the six wall backends register themselves). Harmless — ES
 * modules load once — but named here because a page that ALSO imports a
 * backend directly gets that registration, and two copies of one backend file
 * would be a duplicate-id throw rather than a silent second entry.
 *
 * ⛔ NO NODE IMPORTS: this module is on the maze's browser path (and, from
 * slice 3, on the lab page's).
 */

import { generateLevel, VERDICT } from '../procgenCore/levelGenerator.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, assertKind, carveSkeleton, kindsOffered,
} from '../procgenCore/skeletonKinds.js';
import { defineTemplate, enumerateValues } from '../procgenCore/templateContract.js';
import { reach } from '../shared/simulatorCore.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import {
    TILE_FLOOR, TILE_WALL, bfsSolver, createState, createWorld, detectStepEvents,
    getItem, getObstacle, getTile, setItem, setObstacle, setTile, step,
} from './mazeRoomEngine.js';
import { rngFor } from './procgenRng.js';

export class ProcgenMazeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenMazeError';
    }
}

/**
 * ⛔ A SEPARATE CLASS FOR "THIS CELL WAS NEVER A ROOM", because that is the one
 * the loop is allowed to turn into an outcome. `model.placementError` declares
 * it, and `levelGenerator` rethrows anything else: a `TypeError` from this file
 * is a defect in the generator, and a loop that reverted it would hide its own
 * bugs behind *"that candidate didn't work out"* (traps 171/173).
 */
export class MazePlacementError extends ProcgenMazeError {
    constructor(message) {
        super(message);
        this.name = 'MazePlacementError';
    }
}

const fail = (message) => { throw new ProcgenMazeError(message); };
const refuse = (message) => { throw new MazePlacementError(message); };

/**
 * ⚖ THE ROOM, DECLARED IN ONE PLACE so the CLI, the tests and any later lab
 * page cannot each pick their own and call the difference a finding.
 *
 * ⛓ **THE SKELETON IS THE PLAIN OPEN ROOM — ALL FLOOR, NO WALL RING**, and
 * that is read off `createWorld` rather than chosen: it allocates
 * `new Int8Array(width*height)` and `TILE_FLOOR` is 0, so a fresh world IS an
 * open room and the maze's own `generateMaze` starts from exactly this. ⛔ A
 * border ring would be a SEEDLING fact imported into the maze (Seedling's
 * rooms have one because the game draws one, and `interiorCells` exists to
 * respect it); here the entrance sits at a corner of a room with no ring, and
 * every tile in the grid is a candidate.
 *
 * ⚠ 11x11 is odd on purpose. It is not load-bearing for THIS slice — nothing
 * here lays a lattice — but slice 5 drops the maze backends in as `skeleton()`
 * kinds, and `cellGrid.js` puts its cells at odd coordinates, so an odd size
 * is the one that does not leave a dead strip. Recorded now so the default
 * does not have to move later and expire this slice's seed→level pairs.
 */
export const MAZE_DEFAULTS = Object.freeze({
    width: 11,
    height: 11,
    entrance: Object.freeze({ x: 0, y: 0 }),
    goalExitId: 'goal',
});

/** Every cell of a grid, row-major, in the loop's own anchor spelling. */
export function allCells(world) {
    const out = [];
    for (let ty = 0; ty < world.height; ty += 1) {
        for (let tx = 0; tx < world.width; tx += 1) out.push({ tx, ty });
    }
    return out;
}

/**
 * ⛔⛔ A NEW WORLD, SHARING NOTHING MUTABLE WITH THE OLD ONE — see the file
 * docblock. Every container is rebuilt: the tile array, the four overlays, the
 * exits map and its entries, the entrance point.
 *
 * ⚠ `_exitsByPos` IS DELETED RATHER THAN COPIED. It is `getExitAt`'s lazy
 * cache, invalidated only when `world.exits.size` changes — so a clone that
 * carried the old cache and then gained an exit of the SAME count would answer
 * from the parent's positions. Dropping it costs one rebuild and cannot be
 * wrong.
 */
export function cloneWorld(world) {
    const next = {
        ...world,
        tiles: world.tiles.slice(),
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits: new Map([...world.exits].map(([id, e]) => [id, { ...e }])),
        obstacles: new Map(world.obstacles),
        items: new Map(world.items),
        consumableTiles: new Map(world.consumableTiles ?? []),
        manaTiles: new Map(world.manaTiles ?? []),
    };
    delete next._exitsByPos;
    return next;
}

/**
 * A maze world as plain JSON — what the CLI prints and what a later lab page
 * downloads.
 *
 * ⛔ THIS IS **NOT** `procgenPipeline.serializeMazeWorld`, and the difference is
 * deliberate rather than an oversight: that one bakes AP-canonical location and
 * exit names into the sidecar and needs an `extractedRules` argument to do it,
 * because its consumer is the Archipelago pipeline. This one has no AP
 * vocabulary at all — it is the LOOP's determinism channel, the maze's
 * counterpart of the Seedling atlas record that `generate-seedling-level.mjs`
 * prints. Keys are emitted in a fixed order and the overlays are sorted, so two
 * runs of one seed produce identical bytes.
 */
export function serializeMazeLevel(world) {
    const sortedEntries = (map) => [...map.entries()]
        .map(([key, value]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, id: value };
        })
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return {
        width: world.width,
        height: world.height,
        tiles: Array.from(world.tiles),
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits: [...world.exits.values()].map((e) => ({ exit_id: e.exit_id, x: e.x, y: e.y })),
        obstacles: sortedEntries(world.obstacles),
        items: sortedEntries(world.items),
    };
}

/**
 * ⛓⛓⛓ THE INVERSE OF `serializeMazeLevel` — CONSTRUCTIVE-MODE slice 3.
 *
 * ⚖ Kickoff §3.8 / ruling 9: an EDITED level's identity is the PAYLOAD, not the
 * URL. That makes a reader mandatory rather than a convenience — a page that
 * could only WRITE payloads would be telling people to keep an artifact it
 * cannot itself take back.
 *
 * ⛔ IT REFUSES A MALFORMED PAYLOAD BY NAME AND DOES NOT REPAIR ONE. A missing
 * tile, a tile value outside the grid vocabulary, a wrong-length array, an exit
 * off the grid: each is a different mistake and a reader who hand-edited a
 * payload has no other channel to learn which. ⚠ Especially the LENGTH check —
 * `new Int8Array(shortArray)` pads with zeros, and `TILE_FLOOR` is 0, so a
 * truncated payload would load as a room with a silently carved corridor.
 *
 * ⛓ ROUND-TRIP AND INDEPENDENT VALUE ARE BOTH DRIVEN
 * (`mazeLab.test.js`): `deserialize(serialize(w))` reproduces the world, AND a
 * HAND-WRITTEN payload loads to the world a reader would predict from it. The
 * first alone is a fixed point and tests self-consistency only (⚖ kickoff §5).
 */
export function deserializeMazeLevel(payload) {
    const need = (cond, what) => {
        if (!cond) fail(`procgenMaze: this is not a maze level payload — ${what}.`);
    };
    need(payload && typeof payload === 'object' && !Array.isArray(payload),
        `expected an object, got ${JSON.stringify(payload)}`);
    for (const k of ['width', 'height']) {
        need(Number.isInteger(payload[k]) && payload[k] >= 2,
            `"${k}" must be an integer >= 2, got ${JSON.stringify(payload[k])}`);
    }
    const { width, height } = payload;
    need(Array.isArray(payload.tiles), `"tiles" must be an array, got `
        + `${JSON.stringify(payload.tiles)}`);
    need(payload.tiles.length === width * height,
        `"tiles" has ${payload.tiles.length} entries and a ${width}x${height} room needs `
        + `${width * height}. ⚠ A short array would be PADDED WITH ZEROS by Int8Array, and `
        + 'TILE_FLOOR is 0 — the room would load with a corridor nobody carved');
    for (const [i, t] of payload.tiles.entries()) {
        need(t === TILE_FLOOR || t === TILE_WALL,
            `"tiles[${i}]" is ${JSON.stringify(t)} and the grid vocabulary is TILE_FLOOR `
            + `(${TILE_FLOOR}) / TILE_WALL (${TILE_WALL})`);
    }
    const onGrid = (p, what) => {
        need(p && Number.isInteger(p.x) && Number.isInteger(p.y)
            && p.x >= 0 && p.y >= 0 && p.x < width && p.y < height,
        `${what} is at ${JSON.stringify(p)}, which is not a cell of the ${width}x${height} `
            + 'grid');
    };
    onGrid(payload.entrance, '"entrance"');
    need(Array.isArray(payload.exits) && payload.exits.length >= 1,
        '"exits" must be a non-empty array — a room with no exit has no goal to reach');
    for (const e of payload.exits) {
        need(typeof e?.exit_id === 'string' && e.exit_id,
            `an exit has no "exit_id" (${JSON.stringify(e)})`);
        onGrid(e, `exit "${e?.exit_id}"`);
    }
    const world = createWorld(width, height, {
        entrance: { x: payload.entrance.x, y: payload.entrance.y },
        exits: payload.exits.map((e) => ({ exit_id: e.exit_id, x: e.x, y: e.y })),
    });
    payload.tiles.forEach((t, i) => setTile(world, i % width, Math.floor(i / width), t));
    for (const [what, list, set] of [
        ['obstacle', payload.obstacles ?? [], setObstacle],
        ['item', payload.items ?? [], setItem],
    ]) {
        need(Array.isArray(list), `"${what}s" must be an array`);
        for (const o of list) {
            onGrid(o, `${what} "${o?.id}"`);
            need(typeof o.id === 'string' && o.id,
                `an ${what} at (${o?.x},${o?.y}) has no "id"`);
            set(world, o.x, o.y, o.id);
        }
    }
    return world;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE LEVEL MODEL — kickoff §3.2's first injection
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE MAZE OFFERS **EVERY** KIND, and it is the only binding that can: the
 * two simulator-bound backends (`random_walls`, `corridor_only`) are its own.
 * Stated as a derivation rather than a list so a kind added to the table
 * arrives here without a second edit.
 */
export const MAZE_SKELETON_KINDS = Object.freeze(kindsOffered({ simulator: true }));

/**
 * @param {object} o
 * @param {number} o.seed        the level's identity; the goal cell is its
 *                               first consequence
 * @param {number} [o.width]     overrides `MAZE_DEFAULTS.width`
 * @param {number} [o.height]    overrides `MAZE_DEFAULTS.height`
 * @param {object} [o.defaults]  see `MAZE_DEFAULTS`
 * @param {object} [o.skeleton]  `{kind}` — ⛓ CONSTRUCTIVE-MODE slice 5. The
 *   default is the OPEN ROOM this binding has always built; any other kind
 *   carves with the maze backend the kind names. See `skeletonKinds.js`.
 */
export function mazeModel({
    seed, width, height, defaults = MAZE_DEFAULTS, skeleton: skeletonSpec = DEFAULT_SKELETON,
} = {}) {
    const d = Object.freeze({
        ...MAZE_DEFAULTS,
        ...defaults,
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
    });
    if (!Number.isInteger(d.width) || !Number.isInteger(d.height)
        || d.width < 2 || d.height < 2) {
        fail(`procgenMaze: the room must be at least 2x2 integer tiles, got `
            + `${d.width}x${d.height}.`);
    }
    /**
     * ⛔ THE GOAL CELL IS DRAWN FROM ITS OWN STREAM, not from the loop's — the
     * same law `procgenSeedling` states: the room is built before the loop
     * starts, so its goal must not depend on how many templates were drawn
     * afterwards, or "same seed, same level" would be true only for one set of
     * bounds.
     *
     * ⛓⛓ **AND IT IS THE ROOM STREAM'S FIRST DRAW, WHICH IS SLICE 5's WHOLE
     * REASON FOR THE ORDER** (⚖ kickoff §3.4). When a carver arrives as a
     * `skeleton()` kind it draws AFTER this, so the goal of seed s under kind K
     * is the goal of seed s under the open room — the constructive kinds do not
     * expire this slice's seed→level pairs. Mirrors Seedling exactly, where the
     * goal is `roomRng`'s first `pick` for the same reason.
     */
    const roomRng = rngFor(seed);
    const grid = { width: d.width, height: d.height };
    const goalCandidates = allCells(grid)
        .filter((c) => !(c.tx === d.entrance.x && c.ty === d.entrance.y));
    const goalCell = Object.freeze(roomRng.pick(goalCandidates));

    /**
     * ── ⛓⛓⛓ SLICE 5: THE CARVE, AND WHY IT HAPPENS **HERE** RATHER THAN IN
     *    `skeleton()` ────────────────────────────────────────────────────
     *
     * ⛔ THE CARVE SPENDS DRAWS, AND `skeleton()` IS CALLED MORE THAN ONCE.
     * `generateLevel` calls it once, but `mazeLab.generateStep(0)` calls it for
     * the page and `loadPayload` builds a second model — so a `skeleton()` that
     * carved on each call would hand out a DIFFERENT room every time from the
     * same seed, because `roomRng` would have advanced. Carving once, at model
     * construction, makes `skeleton()` a pure accessor: it clones the template
     * and spends nothing.
     *
     * ⛓ THE DRAW ORDER **IS** THE IDENTITY (⚖ kickoff §3.4): the goal cell is
     * drawn ABOVE, from the room stream's first draw, and the backend's draws
     * come after it. So the goal of seed s under kind K is the goal of seed s
     * under `empty`, and the constructive kinds do not expire slice 2's
     * seed→level pairs. `procgenMaze.test.js` drives exactly that.
     *
     * ⛔ AT THE DEFAULT KIND NOTHING RUNS. `empty` is not "the `empty` backend"
     * — it is the open room `createWorld` already returns — so the byte-identity
     * gate is not a comparison, it is a code path that never executes.
     *
     * ⚠ THE ENTRANCE (0,0) AND THE GOAL ARE **OFF-LATTICE** on an odd room:
     * `cellGrid` puts its cells at odd coordinates, and (0,0) is neither. Every
     * tree backend ends its `run` with `connectFixedTiles`, which L-carves each
     * fixed tile to its nearest cell (x first, then y) — so the entrance and
     * the goal are attached to the spanning tree rather than stranded, and no
     * code here does that work a second time. ⛔ `repairConnectivity` is NOT
     * called from here for any kind: the two tree backends are connected by
     * construction and `recursive_division` calls it inside its own `run`.
     */
    const skeletonKind = assertKind(skeletonSpec?.kind ?? DEFAULT_SKELETON_KIND,
        { simulator: true, substrate: 'the maze binding' });
    const template = createWorld(d.width, d.height, {
        entrance: { x: d.entrance.x, y: d.entrance.y },
        exits: [{ exit_id: d.goalExitId, x: goalCell.tx, y: goalCell.ty }],
    });
    const carve = skeletonKind === DEFAULT_SKELETON_KIND
        ? null : carveSkeleton(skeletonKind, template, roomRng);

    /**
     * ⛔ A **CLONE** PER CALL, because a maze world is mutable and the loop
     * hands the record straight to `place`. Two callers holding one Int8Array
     * would be the frozen-vs-mutable trap in the one object the whole run is
     * about.
     */
    const skeleton = () => cloneWorld(template);

    /**
     * ⚠ "FREE" IS FOUR CLAIMS AND THEY ARE ASKED SEPARATELY, in the order a
     * reader can act on: the cell is on the grid at all, it is neither the
     * entrance nor the goal, its tile is untouched FLOOR, and it carries no
     * obstacle and no item.
     *
     * ⛔ THE LAST TWO ARE NOT ONE CLAIM. A `door-key` template writes an
     * obstacle onto a cell whose TILE it never touches, so a later candidate
     * anchoring there would find `TILE_FLOOR` and be perfectly happy to paint a
     * wall over somebody's door. The tile check cannot see that; the overlay
     * check is what does.
     *
     * ⛔ AND THE ENTRANCE/GOAL CLAIM IS NOT DERIVABLE FROM THE OTHERS — both are
     * plain floor tiles carrying nothing. A wall dropped on the goal builds a
     * room whose refusal would be about geometry rather than about the template
     * (`procgenSeedling.freeRefusal`'s own argument, and it survives the change
     * of substrate unchanged).
     */
    const freeRefusal = (world, tx, ty) => {
        if (!(tx >= 0 && ty >= 0 && tx < world.width && ty < world.height)) {
            return `(${tx},${ty}) is not on the ${world.width}x${world.height} grid — the `
                + `cells are (0,0) to (${world.width - 1},${world.height - 1}).`;
        }
        if (tx === world.entrance.x && ty === world.entrance.y) {
            return `(${tx},${ty}) is the ENTRANCE cell. The player starts standing on it, so a `
                + 'template here would build a room whose refusal is about GEOMETRY rather '
                + 'than about the template.';
        }
        if (tx === goalCell.tx && ty === goalCell.ty) {
            return `(${tx},${ty}) is the GOAL cell. Reaching it IS the goal predicate, so a `
                + 'template here would build a room whose refusal is about GEOMETRY rather '
                + 'than about the template.';
        }
        if (getTile(world, tx, ty) !== TILE_FLOOR) {
            return `(${tx},${ty}) is not untouched FLOOR — an earlier template walled it.`;
        }
        const obstacle = getObstacle(world, tx, ty);
        if (obstacle !== undefined) {
            return `(${tx},${ty}) already carries the obstacle "${obstacle}".`;
        }
        const item = getItem(world, tx, ty);
        if (item !== undefined) {
            return `(${tx},${ty}) already carries the item "${item}".`;
        }
        return null;
    };
    const isFree = (world, tx, ty) => freeRefusal(world, tx, ty) === null;

    /**
     * ⛓⛓⛓ **WHY THIS ANCHOR IS REFUSED — `null` when it is not.**
     *
     * ⛔ ONE ADJUDICATION, TWO READERS. `legalAt` is `refusalAt(...) === null`
     * and not a second conjunction beside it: two spellings of one legality
     * rule is this repo's recorded failure mode, and the day they disagreed the
     * loop would place a template a page said was illegal (or refuse a click the
     * loop would have taken).
     *
     * ⚠ IT NAMES WHICH PART OF THE TEMPLATE WANTED THE CELL. A footprint cell
     * and a `clearance` cell are refused for the same reason and mean different
     * things — the first is the obstacle, the second is the room something
     * needs beside it — and a reader who moved the anchor one cell has to know
     * which they were fighting. (The v1 palette declares no `clearance`; the
     * branch is here because the ROW CONTRACT has the field and a rule that
     * silently ignored it would be a gate that does not gate.)
     */
    const refusalAt = (world, template, tx, ty) => {
        for (const [part, cells] of [['FOOTPRINT', template.footprint ?? []],
            ['CLEARANCE', template.clearance ?? []]]) {
            for (const c of cells) {
                const why = freeRefusal(world, tx + c.dx, ty + c.dy);
                if (why) {
                    return `"${template.instance ?? template.name}" anchored at (${tx},${ty}) `
                        + `needs ${part} cell ${why}`;
                }
            }
        }
        return null;
    };
    const legalAt = (world, template, tx, ty) => refusalAt(world, template, tx, ty) === null;

    return {
        placementError: MazePlacementError,
        defaults: d,
        /** ⛓ The kind that BUILT this room, and the block a payload carries. */
        skeletonKind,
        skeletonSpec: Object.freeze({ kind: skeletonKind }),
        /** What the carve actually ran — `null` at the open room. */
        carve: carve && Object.freeze({ ...carve }),
        goalCell,
        /** The goal in the WORLD's own spelling, for `mazeOracle`'s predicate. */
        goalPos: Object.freeze({ x: goalCell.tx, y: goalCell.ty }),
        entranceCell: Object.freeze({ tx: d.entrance.x, ty: d.entrance.y }),
        allCells,
        isFree,
        legalAt,
        refusalAt,
        skeleton,
        /**
         * ⛓⛓⛓ ONE SHUFFLE, THEN THE FIRST `limit` LEGAL CELLS — the shape
         * `procgenSeedling.anchorsFor` established, adopted here rather than
         * re-derived, because the argument for it is about the LOOP and not
         * about Seedling: a rejection sampler ("draw a cell, test it, draw
         * again") spends an unbounded number of draws on a full room and makes
         * the draw count depend on how full the room is, so two runs of one
         * seed would agree only as long as they agreed about everything before.
         *
         * ⛔⛔ THE SHUFFLE IS OVER **EVERY** CELL OF THE GRID, NOT OVER THE FLOOR
         * CELLS, and that is the maze's own version of the byte-inertness
         * argument. A shuffle of the floor cells would shrink as the room filled
         * with walls, so the DRAW COUNT of attempt n would depend on what
         * attempts 1..n-1 kept — deterministic, but a different function of the
         * seed, and one that moves the moment a bound or a verdict changes. The
         * grid is a constant, so the cost of one shuffle is `width*height - 1`
         * draws whatever the room looks like, and `limit` only decides how far
         * down an order the stream has already fixed the walk is allowed to go.
         *
         * ⚠ THE ANCHOR'S SPELLING IS `{tx, ty}` AND THAT IS THE LOOP'S, NOT THE
         * MAZE'S. `levelGenerator` treats an anchor as opaque everywhere except
         * two abort messages and `directedAttempt`'s explicit-anchor check,
         * which read `at.tx`/`at.ty` — so `{tx, ty}` is part of the seam
         * contract even though nothing declared it as one. The maze adopts it
         * and converts at its own boundary (`place`, `goalPos`); the
         * alternative was widening the loop for a rename, which ⚖ §3.2 forbids.
         *
         * @returns {Array<{tx,ty}>} up to `limit` legal anchors IN SHUFFLE
         *   ORDER; `[]` when the whole grid refuses.
         */
        anchorsFor(world, template, rng, limit = 1) {
            if (!Number.isInteger(limit) || limit <= 0) {
                fail(`procgenMaze: anchorsFor needs a positive integer limit, got `
                    + `${JSON.stringify(limit)}. The bound is what the trace names `
                    + '(`anchorTriesPerCandidate`), so there is no value meaning "all".');
            }
            const out = [];
            for (const c of rng.shuffle(allCells(world))) {
                if (!legalAt(world, template, c.tx, c.ty)) continue;
                out.push({ tx: c.tx, ty: c.ty });
                if (out.length >= limit) break;
            }
            return out;
        },
        /**
         * ⚖ §1.2's ATOMIC PLACEMENT — tiles, obstacles and items in ONE step,
         * so a world never exists in which a door is placed and its key is not.
         * That is what removes the DFS: a candidate never needs a second
         * cooperating placement to become solvable.
         *
         * ⛔ IT CLONES FIRST (see the file docblock). The loop's REVERT is
         * "keep the old record", so a `place` that wrote into `world` would
         * leave every rejected candidate standing.
         */
        place(world, template, at) {
            const next = cloneWorld(world);
            const written = new Set();
            const claim = (dx, dy, what) => {
                const tx = at.tx + dx;
                const ty = at.ty + dy;
                if (!(tx >= 0 && ty >= 0 && tx < next.width && ty < next.height)) {
                    refuse(`procgenMaze: "${template.instance ?? template.name}" anchored at `
                        + `(${at.tx},${at.ty}) writes ${what} at (${tx},${ty}), which is off `
                        + `the ${next.width}x${next.height} grid.`);
                }
                const key = `${tx},${ty},${what}`;
                if (written.has(key)) {
                    refuse(`procgenMaze: "${template.instance ?? template.name}" writes `
                        + `${what} at (${tx},${ty}) TWICE. A doubled write is a template `
                        + 'whose two halves disagree about one cell, and the second one '
                        + 'would silently win.');
                }
                written.add(key);
                return { tx, ty };
            };
            for (const w of template.tiles ?? []) {
                const p = claim(w.dx, w.dy, 'a tile');
                setTile(next, p.tx, p.ty, w.tile);
            }
            for (const o of template.obstacles ?? []) {
                const p = claim(o.dx, o.dy, 'an obstacle');
                setObstacle(next, p.tx, p.ty, o.id);
            }
            for (const i of template.items ?? []) {
                const p = claim(i.dx, i.dy, 'an item');
                setItem(next, p.tx, p.ty, i.id);
            }
            if (written.size === 0) {
                fail(`procgenMaze: template "${template.name}" wrote NOTHING — no tiles, no `
                    + 'obstacles and no items. A template that changes no world is an '
                    + 'obstacle that obstructs nothing, and the loop would KEEP it (the room '
                    + 'still solves) and report it as a placed obstacle.');
            }
            return next;
        },
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE ORACLE — kickoff §3.2's second injection
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ THE BUDGET, AND IT IS A REAL ONE BECAUSE `makeBfsSolver` HAS A REAL NODE
 * CAP — `options.budget`, returning `{ok: false, reason: 'budget_exceeded',
 * expanded}` (`shared/simulatorCore.js:147,155`). ⛔ It was READ off that file
 * rather than invented: the kickoff's instruction was to classify
 * `BUDGET_EXHAUSTED` *only if* such a cap exists, and it does.
 *
 * ⚠ 20,000 DOES NOT BIND ON A v1 LEVEL AND SAYS SO. The BFS state space is
 * `cells x 2^(distinct items reachable)` — for the default 11x11 room with the
 * one-key palette that is at most `121 x 2 = 242` states, so the cap is ~80x the
 * ENTIRE space and no v1 refusal is ever budget-shaped. It is a guard against a
 * later palette with many items (the exponent is the thing that grows), not a
 * bound that shapes today's answers, and `procgenMaze.test.js` drives the class
 * with a deliberately tiny cap so it is not a verdict nobody can reach.
 */
export const DEFAULT_MAZE_BUDGET = Object.freeze({ maxExpansions: 20000 });

export function assertMazeBudget(budget = DEFAULT_MAZE_BUDGET) {
    const b = { ...DEFAULT_MAZE_BUDGET, ...(budget ?? {}) };
    if (!Number.isInteger(b.maxExpansions) || b.maxExpansions <= 0) {
        fail(`procgenMaze: budget.maxExpansions must be a positive integer, got `
            + `${JSON.stringify(b.maxExpansions)}. The trace carries the budget THAT RAN, so `
            + 'there is no value meaning "unbounded".');
    }
    return Object.freeze(b);
}

/**
 * THE MAZE ORACLE — exact, complete over a tiny state space, milliseconds.
 *
 * ── ⛔⛔ THE CERTIFICATION IS THE **REPLAY**, NOT THE SOLVER'S OWN `ok` ──
 *
 * ⚖ Kickoff §3.2: *"the plan's end state satisfies the goal — checked, not
 * assumed."* An oracle that reported SOLVED because `reach` said so would be an
 * oracle that cannot fail, and a generator whose oracle cannot fail certifies
 * nothing. So every SOLVED verdict is produced by stepping the returned plan
 * through the ENGINE's own `step` from the same start state and asserting the
 * player ends on the goal tile.
 *
 * ⛔ A MISMATCH IS A LOUD SEAM-DEFECT THROW, not a REFUSED. `procgenOracle`'s
 * law, carried whole: a plan that does not replay is a defect in the solver,
 * the step function or this file, and a loop that filed it as "that candidate
 * didn't work out" would hide its own bugs (traps 171/173). `levelGenerator`
 * rethrows anything that is not one of the three verdicts and attaches the
 * trace, which is exactly the material a reader needs.
 *
 * ⚠ THE REPLAY IS ALSO THE EVIDENCE CHANNEL. `detectStepEvents` — the engine's
 * own pure helper, not a second reading of it — turns the walk into the
 * `records` the loop hands a `discharges(family, records)` predicate, so a
 * later directed entry can ask *"did this solve actually pick the key up and
 * cross the door?"* rather than counting keeps.
 *
 * @param {object} o.model  a `mazeModel`
 * @param {Iterable<string>} [o.items] item ids the player STARTS with (the
 *   maze's counterpart of Seedling's biome inventory). `null` is an empty
 *   inventory, which is what the v1 palette is designed against.
 */
export function mazeOracle({ model, items = null, budget = DEFAULT_MAZE_BUDGET } = {}) {
    const b = assertMazeBudget(budget);
    const goal = model.goalPos;
    const goalPred = (s) => s.player_pos.x === goal.x && s.player_pos.y === goal.y;
    /**
     * ⛔ ONE START CONSTRUCTION, CALLED TWICE. The BFS and the replay must begin
     * from the same state or the certification would be certifying a different
     * walk; a second literal here would be the two-cost-models shape at its
     * smallest.
     */
    const makeStart = (world) => {
        const s = createState(world);
        for (const id of items ?? []) s.inventory.add(id);
        return s;
    };
    const inventory = (world) => {
        const tiles = { walls: 0 };
        for (const t of world.tiles) if (t === TILE_WALL) tiles.walls += 1;
        const say = (map) => [...map.entries()].map(([k, v]) => `${v}@(${k})`).join(', ');
        return `the world holds ${tiles.walls} wall tile(s), `
            + `${world.obstacles.size} obstacle(s) [${say(world.obstacles)}] and `
            + `${world.items.size} item(s) [${say(world.items)}]`;
    };
    return {
        budget: b,
        goalPred,
        solve(world) {
            const start = makeStart(world);
            const res = reach(world, bfsSolver, start, goalPred, { budget: b.maxExpansions });
            if (!res.ok) {
                const budgetShaped = res.reason === 'budget_exceeded';
                return Object.freeze({
                    verdict: budgetShaped ? VERDICT.BUDGET_EXHAUSTED : VERDICT.REFUSED,
                    ticks: null,
                    classifiedBy: budgetShaped
                        ? 'the BFS hit its EXPANSION cap — a claim about the SEARCH, never a '
                            + 'proof that the level is unsolvable'
                        : 'the BFS exhausted the reachable state space without touching the '
                            + 'goal — a claim about the LEVEL, and a complete one over this '
                            + 'state space',
                    reasonText: budgetShaped
                        ? `the search spent its whole budget of ${b.maxExpansions} expansion(s) `
                            + `looking for a route from the entrance (${world.entrance.x},`
                            + `${world.entrance.y}) to the goal (${goal.x},${goal.y}); `
                            + `${inventory(world)}`
                        : `no route from the entrance (${world.entrance.x},${world.entrance.y}) `
                            + `to the goal (${goal.x},${goal.y}): the search exhausted every `
                            + `reachable state after ${res.expanded} expansion(s); `
                            + `${inventory(world)}`,
                    budgetKind: budgetShaped ? 'maxExpansions' : null,
                    plan: null,
                    records: [],
                    certification: null,
                });
            }
            /**
             * ⛓ THE REPLAY — the certification, and the `records`. Both come out
             * of the same walk because they are the same walk.
             */
            const records = [];
            let s = makeStart(world);
            for (const input of res.plan) {
                const before = { x: s.player_pos.x, y: s.player_pos.y };
                const next = step(world, s, input);
                if (!next) {
                    fail(`procgenMaze: SEAM DEFECT — the BFS returned a ${res.plan.length}-step `
                        + `plan and step ${records.length + 1} ("${input}") is ILLEGAL from `
                        + `(${before.x},${before.y}). The solver and the step function `
                        + 'disagree about this world, which is a defect in one of them and '
                        + 'NOT a claim about the level. (The oracle certifies by REPLAY '
                        + 'precisely so this cannot pass as a solve.)');
                }
                for (const e of detectStepEvents(world, before, next.player_pos, next.inventory)) {
                    records.push({ ...e, turn: next.turn });
                }
                s = next;
            }
            if (!goalPred(s)) {
                fail(`procgenMaze: SEAM DEFECT — the BFS plan replayed to `
                    + `(${s.player_pos.x},${s.player_pos.y}) and the goal is `
                    + `(${goal.x},${goal.y}). \`reach\` said ok; the engine disagrees. An `
                    + 'oracle that reported this as SOLVED would be an oracle that cannot '
                    + 'fail.');
            }
            return Object.freeze({
                verdict: VERDICT.SOLVED,
                ticks: res.plan.length,
                classifiedBy: 'the maze BFS found a plan and the plan was REPLAYED through '
                    + '`step` to the goal tile — the certification is the replay, not the '
                    + 'solver\'s own `ok`',
                reasonText: null,
                budgetKind: null,
                plan: Object.freeze([...res.plan]),
                records: Object.freeze(records),
                certification: Object.freeze({
                    steps: res.plan.length,
                    expanded: res.expanded,
                    endedAt: Object.freeze({ x: s.player_pos.x, y: s.player_pos.y }),
                    collected: Object.freeze([...s.inventory].sort()),
                }),
            });
        },
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE PALETTE v1 — kickoff §3.2's third injection
 * ══════════════════════════════════════════════════════════════════════ */

const DIRS = Object.freeze({
    N: Object.freeze({ dx: 0, dy: -1 }),
    S: Object.freeze({ dx: 0, dy: 1 }),
    E: Object.freeze({ dx: 1, dy: 0 }),
    W: Object.freeze({ dx: -1, dy: 0 }),
});

export const MAZE_TEMPLATES = Object.freeze([
    defineTemplate({
        name: 'wall-segment',
        family: 'wall',
        why: 'The plainest thing that can make a room harder: a run of wall tiles. It has no '
            + 'clearer and nothing to discharge — its whole contribution is geometry, and '
            + 'the oracle keeps it exactly when the goal is still reachable around it.',
        params: [
            { key: 'ori', domain: ['h', 'v'], default: 'h',
                why: 'Horizontal and vertical segments constrain different routes on a grid '
                    + 'whose entrance is a corner; one parameter replaces a hand-unrolled '
                    + '`-h`/`-v` pair so the two cannot drift apart.' },
            { key: 'len', domain: [1, 2, 3], default: 2,
                why: 'Up to 3 on the 11x11 default: long enough to matter (a 3-run plus the '
                    + 'grid edge already forces a detour), short enough that a segment is '
                    + 'rarely refused for running off the grid — which would report a '
                    + 'geometry bound as a palette hole.' },
        ],
        build: ({ ori, len }) => {
            const cells = Array.from({ length: len }, (_, i) => Object.freeze(
                ori === 'h' ? { dx: i, dy: 0 } : { dx: 0, dy: i },
            ));
            return {
                footprint: cells,
                tiles: Object.freeze(cells.map((c) => Object.freeze({ ...c, tile: TILE_WALL }))),
            };
        },
    }),
    defineTemplate({
        name: 'door-key',
        family: 'door',
        why: '⚖ §1.2 ATOMICALLY: the obstacle and its clearer in ONE placement, so no world '
            + 'ever holds a door whose key was never placed. ⛔ It does NOT check that the '
            + 'door is a CUT VERTEX — `mazeRoomEngine.placeGateAndKey` does that and it is '
            + 'slice 10\'s directive, not this slice\'s. Here a door the walk can walk around '
            + 'is a KEPT candidate that happens to be decoration, and the yield table (slice '
            + '6) is what will say so. Reproducing the cut-vertex check now would be a '
            + 'second spelling of it AND a pass-2 lever nobody has measured the need for.',
        params: [
            { key: 'dir', domain: ['N', 'S', 'E', 'W'], default: 'E',
                why: 'Which way the KEY lies from the door. All four, because the entrance is '
                    + 'a corner and a key on the far side of its own door is a REFUSED '
                    + 'candidate the oracle must be able to produce — an unreachable-clearer '
                    + 'case that never arose would be a palette that cannot test its own '
                    + 'atomicity.' },
            { key: 'dist', domain: [1, 2, 3], default: 1,
                why: 'How far the key sits from the door, in cells. 1 is adjacent (the key is '
                    + 'almost always on the near side); 3 is far enough to land across a '
                    + 'wall the loop placed earlier, which is where the oracle earns its '
                    + 'keep.' },
        ],
        build: ({ dir, dist }) => {
            const d = DIRS[dir];
            const door = Object.freeze({ dx: 0, dy: 0 });
            const key = Object.freeze({ dx: d.dx * dist, dy: d.dy * dist });
            return {
                footprint: Object.freeze([door, key]),
                obstacles: Object.freeze([Object.freeze({ ...door, id: 'door_red' })]),
                items: Object.freeze([Object.freeze({ ...key, id: 'key_red' })]),
            };
        },
    }),
]);

export const MAZE_PALETTE = Object.freeze({
    name: 'maze-v1',
    templates: MAZE_TEMPLATES,
    /** ⛔ The player starts empty-handed. Named rather than omitted: the oracle
     *  takes a starting inventory and `null` is a CHOICE about this palette
     *  (every door it places must be opened by a key it also placed). */
    items: null,
});

/**
 * ⛓ THE PALETTE'S STRUCTURAL CHECK, IN THE MAZE'S OWN WORDS.
 *
 * ⛔ It does NOT re-ask the questions `defineTemplate` already refuses at
 * DEFINITION time (a missing `build`, a schema that is not an array, a default
 * outside its domain, a duplicated key) or the one `levelGenerator` refuses at
 * RUN time (a row with no `instantiate`). Repeating them here would be the
 * second copy of the contract that `templateContract.js` exists to prevent.
 * What it asks are the questions only the MAZE can ask: are the tiles tiles,
 * are the ids ids, and does every write land inside the footprint the legality
 * check reserved?
 *
 * ⚠ IT WALKS EVERY ENUMERATED INSTANTIATION, not the base rows — a parameter
 * whose domain grew grows this check with it (⚖ ruling 4: a domain nobody can
 * enumerate is a domain nobody swept).
 */
export function assertMazePalette(palette = MAZE_PALETTE) {
    if (!palette?.templates?.length) {
        fail('procgenMaze: a palette with no templates is not a palette.');
    }
    const names = new Set();
    for (const base of palette.templates) {
        if (typeof base.name !== 'string' || names.has(base.name)) {
            fail(`procgenMaze: template names must be unique and non-empty — "${base.name}" `
                + 'is not. The trace keys on the name and two rows with one name would count '
                + 'as one family member twice (trap 199).');
        }
        names.add(base.name);
        for (const values of enumerateValues(base)) {
            const t = base.instantiate(null, values);
            const where = `template "${t.instance}"`;
            if (!Array.isArray(t.footprint) || t.footprint.length === 0) {
                fail(`procgenMaze: ${where} has an empty footprint — a template that occupies `
                    + 'no cell cannot be placed legally or illegally.');
            }
            const seen = new Set();
            for (const c of t.footprint) {
                const key = `${c.dx},${c.dy}`;
                if (seen.has(key)) {
                    fail(`procgenMaze: ${where} names cell (${key}) twice in its footprint. `
                        + 'The footprint is what the legality check RESERVES, so a doubled '
                        + 'cell would reserve one cell and claim two.');
                }
                seen.add(key);
            }
            const inFootprint = (w, what) => {
                if (!seen.has(`${w.dx},${w.dy}`)) {
                    fail(`procgenMaze: ${where} writes ${what} at (${w.dx},${w.dy}), which is `
                        + 'not in its own footprint. The footprint is what the legality check '
                        + 'reserves, so a write outside it would touch a cell nobody checked '
                        + 'was free.');
                }
            };
            for (const w of t.tiles ?? []) {
                inFootprint(w, 'a tile');
                if (w.tile !== TILE_FLOOR && w.tile !== TILE_WALL) {
                    fail(`procgenMaze: ${where} writes tile ${JSON.stringify(w.tile)}, and the `
                        + `grid vocabulary is TILE_FLOOR (${TILE_FLOOR}) / TILE_WALL `
                        + `(${TILE_WALL}). Anything else is an Int8Array value nothing reads.`);
                }
            }
            for (const o of t.obstacles ?? []) {
                inFootprint(o, 'an obstacle');
                if (!DEFAULT_OBSTACLES[o.id]) {
                    fail(`procgenMaze: ${where} places obstacle "${o.id}", which the obstacle `
                        + `library does not hold [${Object.keys(DEFAULT_OBSTACLES).join(', ')}]. `
                        + '⚠ `isObstacleCleared` treats an UNKNOWN id as "no gate" and returns '
                        + 'true, so a typo here would place a door that opens for everybody — '
                        + 'a gate that does not gate, and every solve would keep it.');
                }
            }
            for (const i of t.items ?? []) {
                inFootprint(i, 'an item');
                if (!DEFAULT_ITEMS[i.id]) {
                    fail(`procgenMaze: ${where} places item "${i.id}", which the item library `
                        + `does not hold [${Object.keys(DEFAULT_ITEMS).join(', ')}].`);
                }
            }
        }
    }
    return true;
}

assertMazePalette();

/* ══════════════════════════════════════════════════════════════════════
 * THE WHOLE SEAM, WIRED
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * GENERATE ONE MAZE LEVEL.
 *
 * ⛔ TWO STREAMS, TWO SEEDS FROM ONE — `procgenSeedling.generateSeedlingLevel`'s
 * law, and it is about the LOOP rather than about either substrate: the model's
 * room stream and the loop's template stream are separate `ProcgenRng`s built
 * from the SAME seed, so the level's identity is one number and neither stream
 * can shift the other by spending a draw. (They therefore produce the same
 * sequence, which is harmless because they are consumed for different things.)
 */
export function generateMazeLevel({
    seed, palette = MAZE_PALETTE, bounds, budget = DEFAULT_MAZE_BUDGET, defaults,
    width, height, skeleton = DEFAULT_SKELETON,
} = {}) {
    const model = mazeModel({ seed, width, height, defaults, skeleton });
    const oracle = mazeOracle({ model, items: palette.items ?? null, budget });
    const out = generateLevel({ rng: rngFor(seed), model, oracle, palette, bounds });
    return {
        ...out,
        model,
        summary: Object.freeze({
            ...out.summary,
            width: model.defaults.width,
            height: model.defaults.height,
            entranceCell: model.entranceCell,
            goalCell: model.goalCell,
            /**
             * ⛔ THE SKELETON KIND IS **NOT** IN THE SUMMARY, and leaving it
             * out is a decision. Every state and every payload already carries
             * a `skeleton` block beside the summary (⚖ ruling 9(b) reserved it
             * there), and `agreementWithPayload` compares THAT one. A second
             * copy inside the summary would be two spellings of one fact — and
             * it would move the CLI payload's bytes at the DEFAULT kind, which
             * is the one thing this slice promised not to do.
             */
            items: palette.items ?? null,
        }),
    };
}

export { DEFAULT_SKELETON, VERDICT };
