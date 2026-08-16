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

import { buildAreaGraph } from '../procgenCore/areaGraph.js';
import {
    DEFAULT_AREAS, formatAreaSpec, formatRequireList, normalizeAreaSpec, parseAreaSpec,
    parseRequireList, resolveAreaSpec, symbolIndex, symbolsForKeys,
} from '../procgenCore/areaSpec.js';
import { connected, reachableFrom } from '../procgenCore/gridFlood.js';
import { generateLevel, VERDICT } from '../procgenCore/levelGenerator.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, assertKind, carveSkeleton, kindsOffered,
    normalizeSkeleton,
} from '../procgenCore/skeletonKinds.js';
import { defineTemplate, enumerateValues } from '../procgenCore/templateContract.js';
import { reach } from '../shared/simulatorCore.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import {
    TILE_FLOOR, TILE_WALL, bfsSolver, clearItem, clearObstacle, createState, createWorld,
    detectStepEvents, getItem, getObstacle, getTile, setItem, setObstacle, setTile, step,
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
    const out = {
        width: world.width,
        height: world.height,
        tiles: Array.from(world.tiles),
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits: [...world.exits.values()].map((e) => ({ exit_id: e.exit_id, x: e.x, y: e.y })),
        obstacles: sortedEntries(world.obstacles),
        items: sortedEntries(world.items),
    };
    /**
     * ⛓⛓ PROCGEN ELEMENTS arc 1 slice 2 — **THE PER-INSTANCE LIBRARY ENTRIES,
     * AND ONLY WHEN THERE ARE ANY.**
     *
     * ⛔ MANDATORY, NOT DECORATIVE: `isObstacleCleared` returns TRUE for an id
     * the lib does not hold, so a payload that carried a `door_K0` and not its
     * entry would RELOAD as a level whose doors open for everybody — a gate that
     * does not gate, and every replay would "solve". `deserializeMazeWorld`
     * already merges a sidecar's per-instance entries onto the base library for
     * exactly this reason (`logic_gate_<N>`); this is the same field.
     *
     * ⛔ AND IT IS OMITTED WHEN EMPTY, which is what keeps the maze's per-kind
     * CLI md5s byte-identical at `areas: 0` — a `"obstacleLib": {}` written
     * unconditionally would have moved every payload in the arc for a fact no
     * level has (⚖ arc ruling 3).
     */
    const extra = (lib, base) => {
        const o = {};
        for (const [id, entry] of Object.entries(lib ?? {})) if (!base[id]) o[id] = entry;
        return Object.keys(o).length ? o : null;
    };
    const obstacleLib = extra(world.obstacleLib, DEFAULT_OBSTACLES);
    const itemLib = extra(world.itemLib, DEFAULT_ITEMS);
    if (obstacleLib) out.obstacleLib = obstacleLib;
    if (itemLib) out.itemLib = itemLib;
    return out;
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
    /**
     * ⛓ THE PER-INSTANCE LIBRARIES MERGE ONTO THE BASE (arc 1 slice 2) — the
     * shape `deserializeMazeWorld` already uses. An absent field is an old
     * payload with no area doors, which loads exactly as it did before.
     */
    for (const [what, lib] of [['obstacleLib', payload.obstacleLib],
        ['itemLib', payload.itemLib]]) {
        need(lib === undefined || (lib && typeof lib === 'object' && !Array.isArray(lib)),
            `"${what}" must be an object of per-instance entries when present, got `
            + `${JSON.stringify(lib)}`);
    }
    const world = createWorld(width, height, {
        entrance: { x: payload.entrance.x, y: payload.entrance.y },
        exits: payload.exits.map((e) => ({ exit_id: e.exit_id, x: e.x, y: e.y })),
        obstacleLib: { ...DEFAULT_OBSTACLES, ...(payload.obstacleLib ?? {}) },
        itemLib: { ...DEFAULT_ITEMS, ...(payload.itemLib ?? {}) },
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
 * THE AREA PARTITION — PROCGEN ELEMENTS arc 1, slice 2 (§3.2)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **WHAT AN AREA IS, DEFINED RATHER THAN GESTURED AT** — ⚖ arc-1 kickoff
 * §3.2 / design ⚖ open question 2, whose default ("chambers") this function
 * spells out and whose census (§9.1 of the arc kickoff) measured.
 *
 *   **A cell is WIDE iff it belongs to at least one all-floor 2x2 square.**
 *   **An AREA is a maximal 4-connected blob of WIDE cells.**
 *   **Every other floor cell is a CORRIDOR cell — it is an EDGE, never an area.**
 *
 * ⛔ THE BRIEF'S FIRST WORDING WAS TRIED AND REJECTED BY ARITHMETIC. "a floor
 * cell with >= 2 floor neighbours in BOTH axes" keeps only the CENTRE of a 3x3
 * chamber (its top-middle cell has two floor neighbours in x and one in y), so
 * `chambers`' own 3x3 stamp would have reduced to a ONE-cell area and its other
 * eight cells to corridor. The 2x2 rule keeps the whole stamp, keeps every
 * `recursive_division` room (they are at least `minRoom` on a side), and refuses
 * every 1-wide corridor cell, every corner and every T-junction — which is
 * exactly the "prefer the definition under which `rooms`' division rooms and
 * `chambers`' stamps are areas and 1-wide corridors are edges" the brief asked
 * for. ⛓ `minArea` is therefore not a separate bound: the smallest possible
 * blob IS a 2x2, so `minArea = 4` is implied by the rule rather than chosen
 * beside it.
 *
 * ── ⛓ THE ENTRANCE AND THE GOAL GET A 1-CELL AREA WHEN THEY NEED ONE ──
 *
 * §3.2: *"the entrance's cell and the goal's cell must each lie IN an area (else
 * the model grows a 1-cell area around them — stated)."* On the maze they
 * usually do NOT: the entrance is the corner (0,0), the goal is drawn from the
 * whole grid, and both are attached to a carved skeleton by
 * `connectFixedTiles`' L-carve — a 1-wide stub. So a SYNTHETIC one-cell area is
 * grown on each, and it is marked `synthetic: true` in the output so no reader
 * mistakes it for a chamber. ⛔ It is grown BEFORE the corridor components are
 * found, because it removes its cell from the corridor set and would otherwise
 * split one component into two.
 *
 * ── ADJACENCY ─────────────────────────────────────────────────────────
 *
 * Two areas are adjacent iff some CORRIDOR COMPONENT touches both (⇒ a walk
 * from one to the other crosses no third area), or iff two of their cells are
 * 4-adjacent (a zero-corridor edge, reachable only through a synthetic area,
 * since two touching WIDE cells are by construction one blob). A corridor
 * component touching three areas makes all three pairs adjacent: it is a
 * junction, and from any of them the other two are reachable without entering
 * the third.
 *
 * ⛔ ONE FLOOD (⚖ arc ruling 5): every blob and every component here is
 * `procgenCore/gridFlood.reachableFrom`, the same function the level-n
 * verification runs.
 *
 * ⚠ ARC 3 WILL WANT THIS FOR SEEDLING and will have to LIFT it into
 * `procgenCore/`. It is written here because slice 2 binds ONE substrate and a
 * module in `procgenCore/` with a single maze caller would be a shared home
 * nobody shares; the rule above is stated in grid vocabulary (`isFloor` + a
 * width and a height) precisely so the lift is a move rather than a rewrite.
 *
 * @param {object} world a maze world (only `width`, `height` and its tiles are
 *   read — obstacles and items are the ORACLE's, exactly as in `gridFlood`).
 * @param {{x,y}} entrance
 * @param {{x,y}} goal
 * @returns {{areas, adjacency, labelAt, corridorComponents, cellCount}}
 */
export function partitionMazeAreas(world, { entrance, goal } = {}) {
    const { width, height } = world;
    const start = entrance ?? { x: world.entrance.x, y: world.entrance.y };
    const end = goal ?? null;
    if (!end) fail('procgenMaze: partitionMazeAreas needs the GOAL cell — it is what decides '
        + 'whether a synthetic area has to be grown, and guessing it from the exits map would '
        + 'be a second reading of a fact the model already owns.');
    const key = (x, y) => `${x},${y}`;
    const onGrid = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    /**
     * ⛓⛓⛓ **ONLY THE FLOOR THE ENTRANCE CAN REACH IS PARTITIONED — AND A
     * MEASUREMENT IS WHAT PUT THIS LINE HERE.**
     *
     * ⛔ A carved room can hold floor cells NOTHING CAN WALK TO.
     * `recursive_division` calls `repairConnectivity`, whose own comment says it
     * repairs *"the rare disconnect after the fact"* — and what it repairs is
     * `allTargetsReachable`, i.e. the EXITS and the ITEMS, not every floor cell.
     * Measured on `rooms` seed 6 at 11x11: rows 7-10 are an eight-cell-wide
     * pocket behind a solid wall row, four floor blobs' worth, and the level is
     * perfectly solvable because the goal is not in them.
     *
     * ⛓ The first draft of this function partitioned them anyway, and
     * `buildAreaGraph` THREW: *"2 area(s) are not reachable from the entrance"*
     * — its `assertSpace` refuses a stranded area by name, because a tree grown
     * outward from the entrance would drop it silently. That throw is the
     * module doing its job; the DEFECT was here, and it is the kind that a
     * binding which only ever ran `rooms` seeds 1-5 would have shipped.
     *
     * ⇒ dead floor is not wall and it is not an area: it is NOT PART OF THE
     * LEVEL, and `deadFloorCells` says how much of it there was.
     */
    const live = reachableFrom(width, height,
        (x, y) => getTile(world, x, y) === TILE_FLOOR, start);
    const floor = (x, y) => onGrid(x, y) && live.has(key(x, y));
    /** ⛓ THE WIDE RULE, in one line: some all-floor 2x2 square contains (x,y). */
    const wide = (x, y) => {
        if (!floor(x, y)) return false;
        for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
            if (floor(x + ox, y + oy) && floor(x + ox + 1, y + oy)
                && floor(x + ox, y + oy + 1) && floor(x + ox + 1, y + oy + 1)) return true;
        }
        return false;
    };

    const label = new Map();          // "x,y" -> area id
    const areas = [];
    /**
     * ⛔ CELLS ARE SORTED **ROW-MAJOR**, not left in the flood's BFS order. The
     * flood's order is deterministic but it is an artefact of where the blob
     * was entered; row-major is the order a reader checking a fixture by eye
     * expects, and it is the order the payload and every drift fixture then
     * carry. (The test that asserted the literal cell list is what asked.)
     */
    const claim = (id, cells, synthetic) => {
        for (const k of cells) label.set(k, id);
        areas.push({
            id,
            cells: [...cells]
                .map((k) => {
                    const [x, y] = k.split(',').map(Number);
                    return Object.freeze({ x, y });
                })
                .sort((a, bb) => (a.y - bb.y) || (a.x - bb.x)),
            synthetic,
        });
    };
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!wide(x, y) || label.has(key(x, y))) continue;
            claim(`A${areas.length}`, reachableFrom(width, height, wide, { x, y }), false);
        }
    }
    /** ⛓ The synthetic ones, in a FIXED order (entrance then goal) so two runs agree. */
    for (const p of [start, end]) {
        if (!floor(p.x, p.y) || label.has(key(p.x, p.y))) continue;
        claim(`A${areas.length}`, new Set([key(p.x, p.y)]), true);
    }

    const corridor = (x, y) => floor(x, y) && !label.has(key(x, y));
    const corridorComponents = [];
    const seenCorridor = new Set();
    const NEIGHBOURS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!corridor(x, y) || seenCorridor.has(key(x, y))) continue;
            const cells = reachableFrom(width, height, corridor, { x, y });
            for (const k of cells) seenCorridor.add(k);
            const touches = new Set();
            for (const k of cells) {
                const [cx, cy] = k.split(',').map(Number);
                for (const [dx, dy] of NEIGHBOURS) {
                    const id = label.get(key(cx + dx, cy + dy));
                    if (id !== undefined) touches.add(id);
                }
            }
            corridorComponents.push(Object.freeze({
                cells: Object.freeze([...cells]),
                size: cells.size,
                touches: Object.freeze([...touches].sort()),
            }));
        }
    }

    const pairs = new Map();
    const addPair = (a, b, via) => {
        if (a === b) return;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        const prev = pairs.get(k);
        if (prev) { prev.via.push(via); return; }
        pairs.set(k, { a: a < b ? a : b, b: a < b ? b : a, via: [via] });
    };
    for (const [i, comp] of corridorComponents.entries()) {
        for (let a = 0; a < comp.touches.length; a += 1) {
            for (let b = a + 1; b < comp.touches.length; b += 1) {
                addPair(comp.touches[a], comp.touches[b], { kind: 'corridor', component: i,
                    corridorCells: comp.size });
            }
        }
    }
    /** ⛓ ZERO-CORRIDOR adjacency — only a synthetic area can produce one. */
    for (const area of areas) {
        for (const c of area.cells) {
            for (const [dx, dy] of NEIGHBOURS) {
                const other = label.get(key(c.x + dx, c.y + dy));
                if (other !== undefined && other !== area.id) {
                    addPair(area.id, other, { kind: 'touch', corridorCells: 0 });
                }
            }
        }
    }

    /**
     * ⛓⛓⛓ EVERY AREA'S **BOUNDARY** CELLS — its own cells that touch a floor
     * cell NOT its own. ⛔ NOT "cells that touch a CORRIDOR cell", and the
     * difference is load-bearing: a SYNTHETIC area can sit directly against a
     * chamber (a zero-corridor adjacency), and a boundary defined by corridors
     * alone would miss that side and leave the realisation's door with an
     * unguarded way in. Measured in the census as the `0` bucket of the
     * corridor-cell histogram.
     *
     * ⛓ THE BOUNDARY IS WHERE THE DOOR GOES, and it is an AREA-side cell rather
     * than a corridor-side one, which is what makes the door cell UNAMBIGUOUS: a
     * corridor mouth cell can be adjacent to TWO areas at once (a
     * `recursive_division` gap cell is exactly that — it touches both rooms),
     * and one cell can hold one obstacle. An area cell belongs to exactly one
     * area by construction.
     */
    for (const area of areas) {
        const boundary = [];
        for (const c of area.cells) {
            for (const [dx, dy] of NEIGHBOURS) {
                const other = label.get(key(c.x + dx, c.y + dy));
                if (floor(c.x + dx, c.y + dy) && other !== area.id) { boundary.push(c); break; }
            }
        }
        area.boundary = Object.freeze(boundary);
        area.size = area.cells.length;
        Object.freeze(area.cells);
        Object.freeze(area);
    }

    return Object.freeze({
        areas: Object.freeze(areas),
        adjacency: Object.freeze([...pairs.values()].map((p) => Object.freeze({
            a: p.a, b: p.b, via: Object.freeze(p.via),
        }))),
        corridorComponents: Object.freeze(corridorComponents),
        labelAt: (x, y) => label.get(key(x, y)) ?? null,
        entranceArea: label.get(key(start.x, start.y)) ?? null,
        goalArea: label.get(key(end.x, end.y)) ?? null,
        cellCount: label.size,
        liveFloorCells: live.size,
        /** ⛓ Floor the entrance cannot reach — see `live` above. */
        deadFloorCells: (() => {
            let n = 0;
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    if (getTile(world, x, y) === TILE_FLOOR && !live.has(key(x, y))) n += 1;
                }
            }
            return n;
        })(),
    });
}

/* ══════════════════════════════════════════════════════════════════════
 * THE REALISATION — a key level becomes doors and keys on the grid (§3.2)
 * ══════════════════════════════════════════════════════════════════════ */

/** `door_K0` ← 'K0'. The per-instance ids ⚖ §3.5 calls "the symbols". */
export const doorIdFor = (symbol) => `door_${symbol}`;
export const keyIdFor = (symbol) => `key_${symbol}`;

/**
 * ⛓ THE KEY LEVEL A DOOR GUARDS. An area at key level `L` is entered with
 * `K_{L-1}` in hand, so its doors are `door_K{L-1}` and the LEVEL of that door
 * is `L` — one past the index in its own name. Written once, because the
 * verification's "> n" and the realisation's "L-1" are the same arithmetic seen
 * from two sides and a second spelling is how an off-by-one gets in.
 */
export const doorLevelOf = (obstacleId) => {
    const m = /^door_K(\d+)$/.exec(obstacleId ?? '');
    return m === null ? null : Number(m[1]) + 1;
};

/**
 * ⛓⛓⛓ **THE PER-INSTANCE LIBRARY ENTRIES** — ⚖ arc-1 kickoff §3.3 / recon.
 *
 * ⛔ RECONNED BEFORE IT WAS WRITTEN, as the kickoff asked. `DEFAULT_OBSTACLES`
 * is keyed by COLOUR (`door_red` … `door_orange`, six of them) plus a
 * `logic_gate` TEMPLATE row whose docblock says per-instance gates are *"created
 * by cloning this entry into the region's obstacleLib with a unique id"* — so
 * per-instance entries are the library's own idiom and not a new one. ⚠ AND THE
 * ENTRY IS MANDATORY RATHER THAN COSMETIC: `isObstacleCleared` returns TRUE for
 * an id the lib does not hold ("unknown obstacle id ≡ no gate; permissive for
 * robustness"), so a `door_K0` with no entry would be a gate that does not gate
 * and EVERY solve would walk through it.
 *
 * ⛓ ADDITIVE, PER WORLD: the base library is untouched and the merged object is
 * put on the world (`createWorld` already takes `obstacleLib`/`itemLib` opts and
 * `deserializeMazeWorld` already merges a sidecar's per-instance entries the
 * same way). The colour ids keep working beside them — `door-key` (palette v1)
 * still places `door_red`.
 */
export function areaLibraries(symbols) {
    const obstacleLib = { ...DEFAULT_OBSTACLES };
    const itemLib = { ...DEFAULT_ITEMS };
    const addedObstacles = {};
    const addedItems = {};
    for (const symbol of symbols) {
        const doorId = doorIdFor(symbol);
        const keyId = keyIdFor(symbol);
        addedItems[keyId] = {
            name: `Area Key ${symbol}`,
            id: keyId,
            classification: 'progression',
            color: '#7fb8e0',
            symbol: 'key',
            feature: 'area_graph',
        };
        addedObstacles[doorId] = {
            name: `Area Door ${symbol}`,
            id: doorId,
            clear_set_type: 'combo_list',
            clear_set: [[keyId]],
            color: '#3f6f9f',
            feature: 'area_graph',
        };
    }
    Object.assign(obstacleLib, addedObstacles);
    Object.assign(itemLib, addedItems);
    return { obstacleLib, itemLib, addedObstacles, addedItems };
}

/**
 * ⛓⛓⛓ **THE VERIFICATION, ONCE, BY THE ONE FLOOD** — ⚖ arc-1 kickoff §3.2,
 * trap 272's shape: *the partition claim is CHECKED, not believed.*
 *
 * For each key level `n`, with every door of level > `n` treated as WALL, the
 * set of floor cells the entrance reaches must be EXACTLY
 *
 *   { every cell of every area whose keyLevel <= n }
 *   ∪ { every cell of every corridor component that touches such an area }
 *
 * ⛓ §3.2 said *"the union of areas of level <= n plus their internal
 * corridors"*; this is that sentence made checkable. A corridor component is
 * freely walkable (no door ever sits on one — the doors are on AREA-side
 * boundary cells), so the ones the player reaches are exactly the ones adjacent
 * to an area they can enter, and a component touching only high-level areas is
 * unreachable until those open. ⚠ It is a claim about TERRAIN AND DOORS with an
 * assumed inventory, NOT about whether the keys can actually be collected in
 * order — that is the ORACLE's question and the skeleton solve is what asks it.
 *
 * @returns {null | {level, missing, extra, detail}} a REFUSAL naming the first
 *   offending cell, or `null`. ⛔ Never a throw: a mismatch is something the
 *   CLI and the lab page must be able to PRINT.
 */
export function verifyAreaLevels(world, { partition, graph }) {
    const { width, height } = world;
    const levelOf = new Map();
    let maxLevel = 0;
    for (const area of partition.areas) {
        const l = graph.areas[area.id]?.keyLevel ?? 0;
        levelOf.set(area.id, l);
        if (l > maxLevel) maxLevel = l;
    }
    const from = { x: world.entrance.x, y: world.entrance.y };
    for (let n = 0; n <= maxLevel; n += 1) {
        const expected = new Set();
        for (const area of partition.areas) {
            if (levelOf.get(area.id) > n) continue;
            for (const c of area.cells) expected.add(`${c.x},${c.y}`);
        }
        for (const comp of partition.corridorComponents) {
            if (!comp.touches.some((id) => levelOf.get(id) <= n)) continue;
            for (const k of comp.cells) expected.add(k);
        }
        const walkable = (x, y) => {
            if (getTile(world, x, y) !== TILE_FLOOR) return false;
            const level = doorLevelOf(getObstacle(world, x, y));
            /**
             * ⛔ `> n`, AND THE COMPARISON IS THE WHOLE CLAIM. A door of level
             * exactly `n` is one the player at level `n` has the key for
             * (`door_K{n-1}`); walling it too would be an off-by-one that reads
             * as "the lock is one level too strong" — the mutant the slice ran.
             */
            return level === null || level <= n;
        };
        const actual = reachableFrom(width, height, walkable, from);
        const missing = [...expected].filter((k) => !actual.has(k)).sort();
        const extra = [...actual].filter((k) => !expected.has(k)).sort();
        if (missing.length || extra.length) {
            return {
                level: n,
                missing: Object.freeze(missing),
                extra: Object.freeze(extra),
                detail: `at key level ${n} the entrance reaches ${actual.size} floor cell(s) `
                    + `and the partition says it should reach ${expected.size}. `
                    + (missing.length
                        ? `UNREACHABLE but claimed: (${missing[0]})${missing.length > 1
                            ? ` and ${missing.length - 1} more` : ''}. ` : '')
                    + (extra.length
                        ? `REACHED but not claimed: (${extra[0]})${extra.length > 1
                            ? ` and ${extra.length - 1} more` : ''}. ` : '')
                    + '⛓ A locked edge is a CUT by construction of the tree; this is the check '
                    + 'that the GRID agrees, which is the one thing construction cannot '
                    + 'promise (trap 272).',
            };
        }
    }
    return null;
}

/**
 * ⛓⛓⛓ **THE REALISATION RULE, AND IT IS A PROPERTY OF THE AREA RATHER THAN OF
 * THE EDGE** — the one real deviation from §3.2, forced by two grid facts the
 * AREA CENSUS measured:
 *
 *  1. **a corridor component can touch THREE or more areas** (measured: up to 15
 *     such junctions per 12 seeds on `rooms` at 15x15, 9 on `open;chambers=2` at
 *     11x11). "Put the door on the corridor cell adjacent to the child" does not
 *     say WHICH of a junction's three ways in is the child's, and doors on all
 *     of them would lock the other two areas out as well.
 *  2. **the adjacency graph has CYCLES the tree did not take.** A grid corridor
 *     is a physical passage whether or not `graphify` declared an edge on it, so
 *     a door realised per TREE EDGE would be bypassed by any undeclared
 *     adjacency and the flood would report the bypass — correctly, as a refusal
 *     on nearly every seed.
 *
 * ⇒ **for every area X at key level L >= 1, `door_K{L-1}` goes on EVERY BOUNDARY
 * CELL of X.** On a tree edge this IS §3.2's rule (the child's own mouth carries
 * the edge's lock: `child.keyLevel - 1` is exactly the tree edge's symbol); it
 * simply also covers every OTHER way into the same area. The cut is then true
 * by construction for ANY adjacency, and the verification above is what checks
 * the partition told the truth about where the ways in are.
 *
 * ⚖ **THIS ANSWERS OPEN QUESTION 2** ("a second carve vs pre-carving and walling
 * the undeclared corridors"): NEITHER. Nothing is carved and nothing is walled —
 * ⛓ so trap 272's "a second carve must be checked on the way out" is discharged
 * by there being no second carve at all, and the check that replaces it is the
 * level-n flood. A `graphify` edge is therefore RECORDED rather than
 * CONSTRUCTED: the corridor it names already exists, and it is already
 * `K`-locked at the higher area's boundary, which is exactly ⚖ design ruling
 * 16's *"a more direct path … the player can freely travel in either
 * direction"* — bidirectional because an obstacle blocks ENTRY and the key is
 * permanent.
 *
 * ── THE KEYS ──────────────────────────────────────────────────────────
 *
 * `key_K{n}` goes at a DRAWN cell of the area the module gave the symbol to —
 * never the entrance, never the goal, never a boundary cell (a key under its own
 * door would be a key you need the key to reach). One `pick` per symbol, in
 * symbol order.
 *
 * @returns {{doors, keys, refused}} `refused` is a graded failure, never a throw.
 */
function realiseAreaGraph(world, { partition, graph, rng, entrance, goal }) {
    const isEnd = (c) => (c.x === entrance.x && c.y === entrance.y)
        || (c.x === goal.x && c.y === goal.y);
    const doors = [];
    for (const area of partition.areas) {
        const level = graph.areas[area.id]?.keyLevel ?? 0;
        if (level < 1) continue;
        const symbol = `K${level - 1}`;
        for (const c of area.boundary) {
            setObstacle(world, c.x, c.y, doorIdFor(symbol));
            doors.push(Object.freeze({ symbol, area: area.id, x: c.x, y: c.y, level }));
        }
    }
    const keys = [];
    for (const symbol of graph.symbols) {
        const areaId = Object.keys(graph.areas).find((id) => graph.areas[id].item === symbol);
        if (areaId === undefined) {
            return { doors, keys, refused: { reason: 'no-area-holds-this-symbol',
                detail: `the graph declares ${symbol} but no area carries it as its item.` } };
        }
        const area = partition.areas.find((a) => a.id === areaId);
        const boundary = new Set(area.boundary.map((c) => `${c.x},${c.y}`));
        const free = area.cells.filter((c) => !boundary.has(`${c.x},${c.y}`) && !isEnd(c));
        if (free.length === 0) {
            return { doors, keys, refused: { reason: 'the-key-area-has-no-cell-that-can-hold-it',
                detail: `${symbol} belongs in area ${areaId}, whose ${area.cells.length} cell(s) `
                    + `are all boundary cells (where its own doors go), the entrance or the `
                    + 'goal. A key under its own door is a key nobody can reach.' } };
        }
        const at = rng.pick(free);
        setItem(world, at.x, at.y, keyIdFor(symbol));
        keys.push(Object.freeze({ symbol, area: areaId, x: at.x, y: at.y }));
    }
    return { doors, keys, refused: null };
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
 * @param {object} [o.areas]  `{keys[, params]}` — ⛓ PROCGEN ELEMENTS arc 1
 *   slice 2. ⛔ The default is `{keys: 0}` and at `keys: 0` NOTHING below runs:
 *   no partition, no `buildAreaGraph` call, no draw. See `areaSpec.js`.
 */
export function mazeModel({
    seed, width, height, defaults = MAZE_DEFAULTS, skeleton: skeletonSpec = DEFAULT_SKELETON,
    areas: areaSpec = DEFAULT_AREAS,
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
    /**
     * ⛓⛓ SLICE 7 — the kind's declared parameters, normalized ONCE. Refuses an
     * undeclared key or an out-of-domain value BY NAME before any grid exists.
     */
    const skeletonSpecNorm = normalizeSkeleton({
        kind: skeletonKind, params: skeletonSpec?.params ?? {},
    });
    let template = createWorld(d.width, d.height, {
        entrance: { x: d.entrance.x, y: d.entrance.y },
        exits: [{ exit_id: d.goalExitId, x: goalCell.tx, y: goalCell.ty }],
    });
    /**
     * ⛓ SLICE 7 — `margin: 0`. The maze room has NO wall ring (its entrance is
     * the corner tile (0,0)), so every cell including the border is carvable,
     * and a stamping post-processor may write there. Seedling passes 1 for the
     * opposite reason; neither number is a default.
     */
    const carve = skeletonKind === DEFAULT_SKELETON_KIND
        ? null : carveSkeleton(skeletonKind, template, roomRng, {
            params: skeletonSpecNorm.params ?? {}, margin: 0,
        });

    /**
     * ── ⛓⛓⛓ PROCGEN ELEMENTS ARC 1, SLICE 2: **THE AREA BINDING**, HERE AND
     *    IN THIS ORDER ─────────────────────────────────────────────────
     *
     * ⛓ **THE DRAW ORDER, DECLARED** (design §4.8; the order IS the identity):
     *   1 the goal cell        — the room stream's FIRST draw, UNCHANGED
     *   2 the carve            — the backend + its post-processors, UNCHANGED
     *   3 the partition        — spends NO draw (it reads tiles)
     *   4 `buildAreaGraph`     — its own declared five phases (slice 1 §8.2)
     *   5 the realisation      — one `pick` per SYMBOL, in symbol order, for
     *                            the key cell. The doors draw NOTHING (every
     *                            boundary cell of a locked area takes one) and
     *                            there is no second carve, so `graphify` spends
     *                            no realisation draw either.
     *
     * ⛔ AND AT `keys: 0` NONE OF 3-5 HAPPENS. Not "runs and returns early" —
     * the branch is not entered, the partition is not computed, the module is
     * not called and the rng is not touched, so the per-kind CLI md5s and
     * `dump-maze-byteidentity` are unchanged by a code path that does not
     * execute (⚖ arc ruling 3, widened by slice 1 to "at <= 1 area the binding
     * does not call the module"). `procgenMazeAreas.test.js` drives that with a
     * COUNTING SPY rather than by comparing tiles.
     *
     * ⛔ EVERY FAILURE HERE IS A **GRADED REFUSAL**, never a throw: the room
     * keeps its carved skeleton, `areas.refused` names the reason, and the CLI
     * and the lab page can print it. A throw would turn "this seed's partition
     * cannot host two keys" into a crash in the room builder.
     */
    const areaSpecNorm = normalizeAreaSpec(areaSpec ?? DEFAULT_AREAS);
    const areaValues = resolveAreaSpec(areaSpecNorm);
    let areaInfo = Object.freeze({
        spec: areaSpecNorm,
        ran: false,
        calledModule: false,
        partition: null,
        graph: null,
        doors: Object.freeze([]),
        keys: Object.freeze([]),
        refused: null,
    });
    if (areaValues.keys > 0) {
        const entrancePos = { x: d.entrance.x, y: d.entrance.y };
        const goalPos = { x: goalCell.tx, y: goalCell.ty };
        const partition = partitionMazeAreas(template, {
            entrance: entrancePos, goal: goalPos,
        });
        const summary = Object.freeze({
            areaCount: partition.areas.length,
            syntheticCount: partition.areas.filter((a) => a.synthetic).length,
            adjacencyCount: partition.adjacency.length,
            corridorComponents: partition.corridorComponents.length,
            entranceArea: partition.entranceArea,
            goalArea: partition.goalArea,
        });
        const refuse2 = (reason, detail) => Object.freeze({
            spec: areaSpecNorm, ran: false, calledModule: false, partitionSummary: summary,
            partition, graph: null, doors: Object.freeze([]), keys: Object.freeze([]),
            refused: Object.freeze({ reason, detail }),
        });
        if (partition.areas.length <= 1) {
            /**
             * ⛓ SLICE 1's §8.8 RESIDUE 1, EXECUTED: the degenerate one-area
             * level is first-class AT THE BINDING. The module refuses
             * `entrance === goal`, and with one area they cannot differ — so a
             * partition this thin must not reach it at all.
             */
            areaInfo = refuse2('the-partition-yields-one-area-or-fewer',
                `the ${skeletonKind} room partitions into ${partition.areas.length} area(s), and `
                + 'a lock-and-key graph needs at least two. ⛓ The AREA CENSUS measured this: '
                + '`empty` is ONE area at every seed (the whole open room is a single wide '
                + 'blob), so the degenerate one-area level is what this branch protects and '
                + 'the module is NOT called.');
        } else if (partition.entranceArea === partition.goalArea) {
            areaInfo = refuse2('the-entrance-and-the-goal-share-one-area',
                `both the entrance (${entrancePos.x},${entrancePos.y}) and the goal `
                + `(${goalPos.x},${goalPos.y}) fall in area ${partition.entranceArea}. `
                + '⛔ `buildAreaGraph` refuses `entrance === goal` by name, so the binding does '
                + 'not call it — the goal is GIVEN (⚖ arc ruling 2) and moving it to a second '
                + 'area is exactly what ruling 2 forbids.');
        } else {
            const graph = buildAreaGraph({
                rng: roomRng,
                areas: partition.areas.map((a) => ({
                    id: a.id,
                    capacity: {
                        /**
                         * ⛓ A CAPACITY THE GRID CAN HONOUR. An area whose every
                         * cell is a boundary cell (where its own doors go), the
                         * entrance or the goal cannot hold a key, and telling
                         * the module BEFORE it places one is cheaper than
                         * refusing after — and it is computable now, because
                         * the boundary is a fact about the PARTITION and not
                         * about the graph.
                         */
                        item: a.cells.some((c) => !a.boundary.includes(c)
                            && !(c.x === entrancePos.x && c.y === entrancePos.y)
                            && !(c.x === goalPos.x && c.y === goalPos.y)),
                        switch: false,
                    },
                })),
                adjacency: partition.adjacency.map((e) => [e.a, e.b]),
                entrance: partition.entranceArea,
                goal: partition.goalArea,
                bounds: {
                    maxKeys: areaValues.keys,
                    graphifyProbability: areaValues.graphify,
                    allowGoalShortcut: areaValues.goalShortcut === 1,
                    maxSwitches: 0,
                },
            });
            if (graph.refused) {
                areaInfo = Object.freeze({
                    spec: areaSpecNorm, ran: false, calledModule: true, partitionSummary: summary,
                    partition, graph, doors: Object.freeze([]), keys: Object.freeze([]),
                    refused: Object.freeze({
                        reason: graph.refused.reason,
                        detail: `${graph.refused.detail} (${graph.refused.attempts} attempt(s) `
                            + `over ${partition.areas.length} area(s) at maxKeys `
                            + `${areaValues.keys}) — ⛓ \`maxKeys\` is a TARGET, not a ceiling: a `
                            + 'space that grows fewer key levels REFUSES rather than settling '
                            + 'for fewer keys (slice 1 deviation 10).',
                    }),
                });
            } else {
                /**
                 * ⛔ REALISED ONTO A **CLONE**, AND COMMITTED ONLY ON SUCCESS.
                 * A refusal at this point (a key with nowhere to go, a flood
                 * that disagrees) must leave the CARVED room exactly as it was
                 * — a half-realised room with doors and no keys would be an
                 * unsolvable skeleton, i.e. `levelGenerator`'s step-0 THROW,
                 * and the reason a reader would read is "the room builder is
                 * broken" rather than "this seed cannot host two keys". Same
                 * argument as `place`'s clone, one layer up.
                 */
                const candidate = cloneWorld(template);
                const realised = realiseAreaGraph(candidate, {
                    partition, graph, rng: roomRng, entrance: entrancePos, goal: goalPos,
                });
                const libs = areaLibraries(graph.symbols);
                candidate.obstacleLib = libs.obstacleLib;
                candidate.itemLib = libs.itemLib;
                const mismatch = realised.refused
                    ? null : verifyAreaLevels(candidate, { partition, graph });
                if (!realised.refused && mismatch === null) template = candidate;
                areaInfo = Object.freeze({
                    spec: areaSpecNorm,
                    ran: !realised.refused && mismatch === null,
                    calledModule: true,
                    partitionSummary: summary,
                    partition,
                    graph,
                    doors: Object.freeze(realised.doors),
                    keys: Object.freeze(realised.keys),
                    addedObstacles: Object.freeze(Object.keys(libs.addedObstacles)),
                    addedItems: Object.freeze(Object.keys(libs.addedItems)),
                    refused: realised.refused
                        ? Object.freeze(realised.refused)
                        : (mismatch && Object.freeze({
                            reason: 'the-level-flood-disagrees-with-the-partition',
                            detail: mismatch.detail,
                            level: mismatch.level,
                            missing: mismatch.missing,
                            extra: mismatch.extra,
                        })),
                });
            }
        }
    }

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
    /**
     * ⛓⛓⛓ **THE CONNECTIVITY PRE-CHECK** — CONSTRUCTIVE-MODE slice 6, §3.6
     * item 2, and the maze half of a rule both bindings run over ONE flood
     * (`procgenCore/gridFlood.js`).
     *
     * *A candidate whose TILE writes disconnect the entrance from the goal is
     * refused BY NAME, before any solve.*
     *
     * ── ⛔ WHY IT IS A **LEGALITY** RULE AND NOT AN ORACLE VERDICT ─────
     *
     * The oracle already answers it — a sealed room comes back REFUSED with
     * *"no route from the entrance…"*, which is a complete answer over this
     * state space. What it does not do is answer CHEAPLY: the BEFORE yield
     * table measured 67 of Seedling's reverts as exactly this shape, one of
     * them costing a **74-second single solve**, because the corridor planner
     * runs to its dash cap before it gives up. The maze's own BFS is
     * milliseconds, so on this substrate the win is not the clock — it is that
     * `anchorsFor` stops OFFERING sealing cells at all, which is what makes the
     * two bindings run one rule rather than two policies.
     *
     * ── ⛔ WHAT IT IS SOUND FOR: **FULL-TILE TERRAIN ONLY** ────────────
     *
     * Tiles are what it reads. ⚠ OBSTACLES AND ITEMS ARE IGNORED — a `door-key`
     * writes an obstacle onto a cell whose TILE it never touches, and a flood
     * that treated a door as a wall would refuse every door the maze happily
     * keeps (§12.10: on a corridor every `door-key` is KEPT and every
     * `wall-segment` REVERTED). Whether a door is passable is the ORACLE's
     * question, because the answer depends on the key, and the key is a fact
     * about the SEARCH rather than about the grid.
     *
     * ⇒ the rule is a NECESSARY condition only: sealed ⇒ certainly unsolvable ⇒
     * refuse; not sealed ⇒ nothing claimed, and the oracle still decides.
     *
     * ── ⚖ EVERY KIND, `empty` INCLUDED — THE SCOPE IS GONE (slice 6b) ─
     *
     * Slice 6 shipped this rule KIND-SCOPED (§6.2's named default: OFF at
     * `empty`) and measured the price of widening it. ⚖ **THE USER RULED,
     * 2026-08-15** (the PROCGEN ELEMENTS design session): widen it to EVERY
     * kind; GENERATE-UI ruling 5 licenses the pair expiry. Slice 6b dropped the
     * scope on BOTH bindings. ⛔ The soundness argument above is unchanged and
     * now global — it never mentioned the skeleton, because a sealed room is
     * unsolvable however its walls got there.
     *
     * ⛓ **THE MAZE PAID NOTHING FOR IT, AND THAT WAS PREDICTED.** Slice 6
     * scanned every open room 2x2 → 11x11 over seeds 1..40 for a SINGLE palette
     * row that seals it: `2x2 0 · **3x3 29** · 4x4 0 · 5x5 0 · 6x6 0 · 7x7 0 ·
     * 11x11 0`. The default room is 11x11, so no `empty` CLI pair moves — the
     * nine per-kind roll-ups were byte-identical across this slice, `empty`
     * included (§15). 3x3 is the ONLY width where the rule can be seen at
     * `empty` at all, which is why the fixture uses one.
     */
    const sealRefusal = (world, template, tx, ty) => {
        const written = new Map((template.tiles ?? [])
            .map((w) => [`${tx + w.dx},${ty + w.dy}`, w.tile]));
        const blocking = [...written.values()].filter((t) => t !== TILE_FLOOR).length;
        // ⛔ A candidate that paints no blocking tile cannot seal anything:
        // painting FLOOR can only ADD walkable cells, so connectivity is
        // monotone in that direction and the flood would be arithmetic nobody
        // reads.
        if (blocking === 0) return null;
        const walkable = (x, y) => (written.get(`${x},${y}`) ?? getTile(world, x, y))
            === TILE_FLOOR;
        if (connected(world.width, world.height, walkable,
            { x: world.entrance.x, y: world.entrance.y },
            { x: goalCell.tx, y: goalCell.ty })) return null;
        return `"${template.instance ?? template.name}" at (${tx},${ty}): its TERRAIN would `
            + `SEAL the room — no floor path from the ENTRANCE (${world.entrance.x},`
            + `${world.entrance.y}) to the GOAL (${goalCell.tx},${goalCell.ty}) once the `
            + `${blocking} wall tile(s) it writes are painted. ⛔ The flood reads TILES only; `
            + 'obstacles and items are the ORACLE\'s question, so a door is never a wall '
            + 'here. Refused before any solve, at EVERY skeleton kind — this room is '
            + `"${skeletonKind}", and ⚖ slice 6b dropped the carved-only scope slice 6 `
            + 'shipped.';
    };

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
        /**
         * ⛔ **AFTER THE FOOTPRINT WALK**, and the order is part of the answer:
         * the walk is what refuses an off-grid cell, and a flood handed writes
         * outside the room would read `getTile` past the array (Seedling's
         * trap-255 shape, which the maze inherits by writing the rule in the
         * same place). ⛓ It is also the CHEAP check first — one bounds test per
         * footprint cell before a whole-room flood.
         */
        return sealRefusal(world, template, tx, ty);
    };
    const legalAt = (world, template, tx, ty) => refusalAt(world, template, tx, ty) === null;

    return {
        placementError: MazePlacementError,
        defaults: d,
        /** ⛓ The kind that BUILT this room, and the block a payload carries. */
        skeletonKind,
        skeletonSpec: skeletonSpecNorm,
        /** What the carve actually ran — `null` at the open room. */
        carve: carve && Object.freeze({ ...carve }),
        /**
         * ⛓ THE AREA BINDING'S WHOLE ANSWER — the spec that ran, whether the
         * module was called at all, the partition, the graph, the realised
         * doors and keys, and the REFUSAL when there is one. Slice 3's lab page
         * draws from exactly this object.
         */
        areas: areaInfo,
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
 * ⛓ THE AREA BLOCK A PAYLOAD CARRIES — the SPEC and the GRAPH, exactly what the
 * kickoff's §3.6/§6 asks slice 3's page to draw from. ⛔ The partition's cell
 * lists are NOT in it: they are derivable from the level's own tiles by the one
 * partition function, and a payload that carried them would be a second copy of
 * a fact the room already states (and a big one).
 */
export function areaSummaryOf(model) {
    const info = model.areas;
    return Object.freeze({
        spec: info.spec,
        ran: info.ran,
        calledModule: info.calledModule,
        partition: info.partitionSummary ?? null,
        refused: info.refused,
        doors: info.doors,
        keys: info.keys,
        graph: info.graph && Object.freeze({
            areas: info.graph.areas,
            edges: info.graph.edges,
            symbols: info.graph.symbols,
            solutionPath: info.graph.solutionPath,
            bounds: info.graph.bounds,
            draws: info.graph.draws,
            drawsByPhase: info.graph.drawsByPhase,
            attempts: info.graph.attempts,
            refused: info.graph.refused,
        }),
    });
}

/**
 * ⛓⛓⛓ **THE SOLVER-WORK RECORDS** — ⚖ design ruling 20 / arc-1 kickoff §3.4.
 *
 * *"Per placed lock/key and per kept template: BFS plan length to the goal
 * BEFORE and AFTER, nodes expanded, and (for a lock) the plan length from the
 * key to the door."*
 *
 * ⛔ **RECORD ONLY.** Nothing in this arc DECIDES on these numbers; they exist
 * so a table can exist before a dial does (§4.6: *"dials that DECIDE come after
 * a table exists"*). ⛔ AND NO WALL CLOCK — every number here is a BFS PLAN
 * LENGTH or a NODE COUNT, which are properties of the candidate and reproduce on
 * a loaded box (`feedback_wallclock_budget_breaks_determinism`).
 *
 * ── ⛓ TWO DIFFERENT "BEFORE"s, BECAUSE THEY ARE TWO DIFFERENT QUESTIONS ─
 *
 *  · an ELEMENT (a lock and its key) is measured by **ABLATION** on the FINISHED
 *    level: the same room with that symbol's doors and key removed. That is the
 *    §3.5 differential in the same breath — a `plan: null` in the WITHOUT arm is
 *    the proof that the lock is a cut, not a decoration.
 *  · a KEPT TEMPLATE is measured by **INCREMENTAL REPLAY** from the skeleton, so
 *    its BEFORE is the room the loop actually saw when it proposed the
 *    candidate. Ablating it from the finished level instead would price it
 *    against a room that did not exist when it was chosen.
 *
 * ⛔ IT SPENDS NO DRAW (`instantiate(null, params)` replays the recorded values)
 * and it runs ONLY when the area binding ran — see `generateMazeLevel`.
 */
export function mazeCostRecords({ model, budget = DEFAULT_MAZE_BUDGET, record, kept = [] }) {
    const b = assertMazeBudget(budget);
    const goal = model.goalPos;
    const solveTo = (world, pred, items = null) => {
        const start = createState(world);
        for (const id of items ?? []) start.inventory.add(id);
        const res = reach(world, bfsSolver, start, pred, { budget: b.maxExpansions });
        return Object.freeze({
            plan: res.ok ? res.plan.length : null,
            expanded: res.expanded ?? null,
            reason: res.ok ? null : (res.reason ?? 'exhausted'),
        });
    };
    const atGoal = (s) => s.player_pos.x === goal.x && s.player_pos.y === goal.y;

    const elements = [];
    const info = model.areas;
    if (info?.ran) {
        const after = solveTo(record, atGoal);
        for (const symbol of info.graph.symbols) {
            const doors = info.doors.filter((dd) => dd.symbol === symbol);
            const key = info.keys.find((k) => k.symbol === symbol) ?? null;
            const without = cloneWorld(record);
            for (const dd of doors) clearObstacle(without, dd.x, dd.y);
            if (key) clearItem(without, key.x, key.y);
            const before = solveTo(without, atGoal);
            /**
             * ⛓⛓⛓ **THE DIFFERENTIAL — ⚖ §3.5's PROOF, AND MY FIRST DRAFT HAD
             * IT BACKWARDS.** The draft asserted that `planWithout === null`
             * *"is the cut"*. It is not, and the first run said so: removing a
             * DOOR can only ever make a level EASIER, so that arm solves at
             * every seed and would have been a claim nothing can falsify.
             *
             * ⇒ the arm that proves the lock is a cut removes **the KEY and
             * keeps the DOORS**: `planWithoutKey === null` means no route to the
             * goal survives without `key_K`, which is exactly §3.5's *"remove
             * key K from the world → the goal is unreachable"* and is a STRONG
             * grade by the PoC's own scale (§16.6). ⚠ It is `null` for every
             * symbol on the SOLUTION PATH; a symbol whose areas all sit in a
             * side branch is legitimately non-null, and the fixture says which.
             */
            const withoutKey = cloneWorld(record);
            if (key) clearItem(withoutKey, key.x, key.y);
            const cut = key ? solveTo(withoutKey, atGoal) : null;
            const doorSet = new Set(doors.map((dd) => `${dd.x},${dd.y}`));
            const keyToDoor = key && doors.length
                ? solveTo(record, (s) => doorSet.has(`${s.player_pos.x},${s.player_pos.y}`),
                    [keyIdFor(symbol)])
                : null;
            elements.push(Object.freeze({
                symbol,
                doorCount: doors.length,
                doors: Object.freeze(doors.map((dd) => Object.freeze({ x: dd.x, y: dd.y }))),
                key: key && Object.freeze({ x: key.x, y: key.y, area: key.area }),
                /** BEFORE = the same room with this symbol's doors AND key gone. */
                planWithout: before.plan,
                expandedWithout: before.expanded,
                /** AFTER = the finished level. */
                planWith: after.plan,
                expandedWith: after.expanded,
                /** ⛓ THE CUT PROOF — see above. `null` = the goal needs this key. */
                planWithoutKey: cut ? cut.plan : null,
                expandedWithoutKey: cut ? cut.expanded : null,
                isCut: cut !== null && cut.plan === null,
                planKeyToDoor: keyToDoor ? keyToDoor.plan : null,
                expandedKeyToDoor: keyToDoor ? keyToDoor.expanded : null,
            }));
        }
    }

    const byName = new Map(MAZE_TEMPLATES.map((t) => [t.name, t]));
    let world = model.skeleton();
    let prev = solveTo(world, atGoal);
    const keptCost = [];
    for (const row of kept) {
        const base = byName.get(row.template);
        if (!base) {
            fail(`procgenMaze: the kept record names template "${row.template}", which the v1 `
                + 'palette does not hold. A cost record replays the loop\'s own choices, so a '
                + 'name it cannot rebuild is a defect rather than a missing number.');
        }
        world = model.place(world, base.instantiate(null, row.params ?? {}), row.at);
        const next = solveTo(world, atGoal);
        keptCost.push(Object.freeze({
            ...row,
            cost: Object.freeze({
                planBefore: prev.plan,
                expandedBefore: prev.expanded,
                planAfter: next.plan,
                expandedAfter: next.expanded,
            }),
        }));
        prev = next;
    }
    return { elements: Object.freeze(elements), kept: Object.freeze(keptCost) };
}

/**
 * ⛓⛓⛓ **RULE-DIRECTED ON THE MAZE — `require: [K…]`** (⚖ arc kickoff §3.5,
 * design §4.5, constructive §3.10's absorbed 10-maze).
 *
 * *"The run must place every named symbol as a key level whose lock lies on the
 * solution path"* — and on the maze that is not a search: it is a QUESTION
 * asked of the level the binding already built, answered by the BFS
 * differential `mazeCostRecords` already computes.
 *
 * ── ⛓ THE PROOF, AND WHY ITS GRADE IS TRIVIALLY **STRONG** ────────────
 *
 * The confirmation is the ABLATION arm of the cost record: remove `key_K` from
 * the finished world, keep every door, re-solve. `planWithoutKey === null`
 * (i.e. `isCut`) means no route to the goal survives without that key, which is
 * §3.5's own words and a STRONG grade on the PoC's scale (§16.6).
 *
 * ⛓⛓ **AND IT IS STRONG BY CONSTRUCTION, WHICH IS SAID RATHER THAN HIDDEN.**
 * `checkAcceptable` puts the goal at the HIGHEST key level; a door
 * `door_K{L-1}` sits on EVERY boundary cell of every area at level `L`; so
 * removing `key_K{n}` seals every area of level > n, and the goal is one of
 * them. ⇒ every placed symbol is a cut, and the graded half of the differential
 * is exercised in its trivial case on this substrate. **MEASURED, not assumed**:
 * over `rooms`/`rooms;minRoom=2` at 11x11 and 15x15, keys 1 and 2, seeds 1..24,
 * **148 placed symbols, 148 cuts, 0 non-cuts** — so the
 * `the-required-symbol-is-not-a-cut` arm below did not fire once on the
 * measured corpus and is driven by a unit row instead of by luck. It is kept
 * because the property it checks is the one the directive is ABOUT, and a
 * refusal nobody can trigger today is still the honest answer if a later arc's
 * graphify (or a `goalShortcut` a future partition makes reachable at full
 * inventory) ever breaks it.
 *
 * ⛔ **NO BOUND IS WIDENED TO MEET A DIRECTIVE, AND THERE IS NO RETRY LOOP.**
 * `?require=K1` with `?areas=1` is a REFUSED run naming the key count it was
 * given; a graph that refused is a refused run carrying the graph's own reason
 * VERBATIM.
 *
 * @param {object} o
 * @param {string[]|null} o.require   the asked symbols, in the caller's order
 * @param {object} o.areas            `model.areas`
 * @param {object[]} o.elements       `mazeCostRecords(...).elements` (empty when
 *   the area binding did not run — the refusal then names that, not the cut)
 * @returns {null | {asked, met, refused}} `null` when nothing was asked, so a
 *   run without a directive carries no field and its bytes do not move.
 */
export function requireOutcome({ require = null, areas, elements = [] } = {}) {
    const asked = Object.freeze([...(require ?? [])]);
    if (asked.length === 0) return null;
    const spec = areas?.spec ?? DEFAULT_AREAS;
    const keys = spec.keys ?? 0;
    const refuse = (reason, detail) => Object.freeze({
        asked, met: Object.freeze([]), refused: Object.freeze({ reason, detail }),
    });
    if (keys === 0) {
        return refuse('the-directive-needs-the-area-graph',
            `require=${formatRequireList(asked)} asks for area-graph symbol(s), and this run is `
            + 'at `areas=0`, where the binding does not partition the room, does not call '
            + '`buildAreaGraph` and spends no draw (⚖ arc ruling 3). ⛔ The key count is NOT '
            + 'raised to meet the directive — say `areas=<n>` and the two parameters will '
            + 'agree.');
    }
    const declared = symbolsForKeys(keys);
    const beyond = asked.filter((s) => symbolIndex(s) >= keys);
    if (beyond.length) {
        return refuse('no-key-level-admits-this-symbol-within-maxkeys',
            `require=${formatRequireList(asked)} names ${beyond.join(', ')}, and the area spec `
            + `\`${formatAreaSpec(spec)}\` declares maxKeys=${keys}, whose symbols are `
            + `[${declared.join(', ')}]. ⛔ No bound is widened to meet a directive — and `
            + '⛓ `maxKeys` is a TARGET rather than a ceiling anyway, so raising it makes the '
            + 'run REFUSE at every seed the space cannot grow that far (slice 1 deviation 10).');
    }
    if (!areas?.ran) {
        const r = areas?.refused;
        return refuse('the-area-graph-refused',
            `require=${formatRequireList(asked)} cannot be met because the area binding did not `
            + `run: ${r ? `${r.reason} — ${r.detail}` : 'no graph was built and no reason was '
                + 'recorded, which is itself a defect'} ⛓ The directive is REPORTED as refused `
            + 'rather than retried: a run that cannot host the graph is not a run that needs '
            + 'another seed drawn for it behind the caller\'s back.');
    }
    const byName = new Map(elements.map((e) => [e.symbol, e]));
    const met = [];
    for (const symbol of asked) {
        const e = byName.get(symbol);
        if (!e) {
            return refuse('the-required-symbol-was-not-placed',
                `the graph ran and declares [${areas.graph.symbols.join(', ')}], but no element `
                + `record carries ${symbol}, so nothing can be proved about it. ⛔ A directive `
                + 'met by a symbol nobody measured would be the vacuous half of every claim '
                + 'this arc makes.');
        }
        if (!e.isCut) {
            return refuse('the-required-symbol-is-not-a-cut',
                `${symbol} was placed (${e.doorCount} door(s), key at `
                + `(${e.key?.x},${e.key?.y})), but removing its KEY from the finished level `
                + `still leaves the goal reachable in ${e.planWithoutKey} step(s). ⛓ THE `
                + 'DIFFERENTIAL IS THE PROOF and it came back negative: the lock is a '
                + 'decoration on this level, not a requirement, so the directive is REFUSED '
                + 'rather than reported met on a weaker fact.');
        }
        met.push(Object.freeze({
            symbol,
            /**
             * ⛓ THE GRADE. STRONG whenever `isCut` — the PoC's own scale, and on
             * this substrate the BFS differential is a proof rather than an
             * estimate, so no other grade is reachable here. ⛔ Said in the
             * as-built rather than dressed up as a general result.
             */
            grade: 'STRONG',
            planWith: e.planWith,
            planWithoutKey: e.planWithoutKey,
            expandedWithoutKey: e.expandedWithoutKey,
            doorCount: e.doorCount,
            key: e.key,
        }));
    }
    return Object.freeze({ asked, met: Object.freeze(met), refused: null });
}

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
    width, height, skeleton = DEFAULT_SKELETON, areas = DEFAULT_AREAS, require = null,
} = {}) {
    const model = mazeModel({ seed, width, height, defaults, skeleton, areas });
    const oracle = mazeOracle({ model, items: palette.items ?? null, budget });
    const out = generateLevel({ rng: rngFor(seed), model, oracle, palette, bounds });
    /**
     * ⛓⛓ THE COST PASS RUNS **ONLY WHEN THE AREA BINDING RAN**, and that is a
     * forced choice rather than a preference: `summary.kept` gaining a `cost`
     * field at `areas: 0` would move the maze's per-kind CLI md5s, which ⚖ arc
     * ruling 3 requires to be byte-identical. ⇒ a delta against §3.4, which
     * asks for the per-kept-template numbers unconditionally; they arrive with
     * the elements, which is the arc that asked for them.
     */
    const cost = model.areas?.ran
        ? mazeCostRecords({ model, budget, record: out.record, kept: out.summary.kept })
        : null;
    /**
     * ⛓ THE DIRECTIVE IS ASKED OF THE FINISHED LEVEL, and it spends NO extra
     * solve: its proof is the ablation arm the cost pass above already ran.
     * ⛔ `null` when nothing was required, so a run without a directive carries
     * no `require` field and the per-kind CLI md5s do not move.
     */
    const required = requireOutcome({
        require, areas: model.areas, elements: cost?.elements ?? [],
    });
    return {
        ...out,
        model,
        summary: Object.freeze({
            ...out.summary,
            ...(cost ? { kept: cost.kept, elements: cost.elements } : {}),
            /**
             * ⛓ THE AREA BLOCK, beside `skeleton`'s — the spec that ran, what
             * the partition found, the graph's own bounds and draws, and the
             * REFUSAL when there is one. ⛔ OMITTED ENTIRELY at `areas: 0`, so
             * the summary's bytes are unchanged there.
             */
            ...(model.areas.spec.keys === 0 ? {} : { areas: areaSummaryOf(model) }),
            /** ⛓ SLICE 3's block — OMITTED when nothing was required. */
            ...(required ? { require: required } : {}),
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

export {
    DEFAULT_AREAS, DEFAULT_SKELETON, VERDICT,
    formatAreaSpec, formatRequireList, normalizeAreaSpec, parseAreaSpec, parseRequireList,
};
