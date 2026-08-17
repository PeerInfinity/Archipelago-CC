/**
 * seedlingDemo/procgenSeedling — THE SEEDLING BINDINGS: the one place the
 * substrate-agnostic loop meets this game.
 *
 * Seedling PROCGEN PoC arc, slice 2. `levelGenerator.js` imports nothing;
 * this file imports everything it needs and hands the loop the three injected
 * pieces kickoff §3.2 names — LEVEL MODEL, ORACLE, PALETTE. ⚖ §1.7's
 * provision, in full: one seam, one implementation, no framework. When a
 * second substrate exists and can argue about the interface, the core moves
 * and this file stays.
 *
 * ── WHAT THE MODEL OWES THE LOOP ──────────────────────────────────────
 *
 *   `skeleton()`      the bordered room + the goal pickup — the control that
 *                     must solve before any template is drawn
 *   `anchorsFor(...)` up to `limit` LEGAL anchors for a template, in one
 *                     seeded shuffle's order, or `[]` when the room has no
 *                     room for that shape. ⛔ The legality test lives HERE and
 *                     not in the loop, because "legal" is a fact about
 *                     Seedling's floor. ⛓ It returns a LIST since slice 3 of
 *                     the GENERATE-mode UI arc — the loop walks it until one
 *                     anchor SOLVES, bounded by `anchorTriesPerCandidate`.
 *   `refusalAt(...)`  ⛓ slice 6 of the GENERATE-mode UI arc: WHY one named
 *                     cell is refused, in the model's own words, or `null`.
 *                     `legalAt` is DERIVED from it, so the loop's silent
 *                     boolean and the page's sentence are one adjudication.
 *   `place(...)`      tiles and entities written TOGETHER (⚖ §1.2's atomic
 *                     placement), returning a NEW frozen record
 *
 * ── ⛓ THE ANCHOR SCAN IS SHUFFLE-THEN-FIRST, NOT REJECTION SAMPLING ───
 *
 * A rejection sampler ("draw a cell, test it, draw again") spends an
 * unbounded number of draws on a full room and makes the number of draws
 * depend on how full the room is — so two runs of one seed would agree only
 * as long as they agreed about everything before. The anchor is instead ONE
 * shuffle of the room's own cell list and the first legal cells in it:
 * exactly ONE shuffle per attempt, whatever the room looks like and whatever
 * `anchorTriesPerCandidate` is, and an EMPTY list when the whole interior is
 * illegal. Determinism by construction rather than by luck — and the bound
 * only decides how far down an order the stream has already fixed the loop is
 * allowed to walk, which is why raising it moves no earlier draw.
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`) — this module is on the GENERATE
 * arm's path in the browser.
 */

import { TILE_SIZE, tagOf } from './levelWorld.js';
import {
    ProcgenLevelError, SINGLE_SCREEN_TILES, bootAtTile, emptyLevel, oelAtTile,
    terrainAt, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, VERDICT, assertBudget, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import {
    PLACEMENT_GROUP, PLACEMENT_TAG, PRE_SWORD_PALETTE, instantiateKept,
} from './procgenPalette.js';
import { TAGS_PER_LEVEL } from './breakableRocks.js';
import { connected, reachableFrom, shortestPath } from '../procgenCore/gridFlood.js';
import { generateLevel } from '../procgenCore/levelGenerator.js';
/**
 * ⛓ PROCGEN ELEMENTS arc 3, slice 1 — the SITE vocabulary, in `procgenCore/`
 * because it is stated in grid vocabulary and the maze will bind it next. ⛔ A
 * site is a fact about the SEARCH, never about legality; see that file's law.
 */
import { deriveSites, siteCells, siteSummaryOf } from '../procgenCore/sites.js';
/**
 * ⛓⛓ PROCGEN ELEMENTS arc 3, slice 3 — THE ELEMENT SPEC's ONE CODEC (shared
 * with the maze CLI, the sweep and slice 5's `?elements=`) and the Seedling
 * BINDING of the reverse-pull gadget. ⛔ The element itself is
 * `procgenCore/elements/reversePullBlock.js` — the SAME one the maze binds; the
 * binding maps its tiles and symbols onto Seedling's parts and nothing more.
 */
import {
    DEFAULT_ELEMENTS, ELEMENT_TABLE, NONE as ELEMENTS_NONE, namedParams,
    normalizeElementSpec, resolveElementSpec,
} from '../procgenCore/elementSpec.js';
import {
    SITE_MARGIN_STRAIGHT, compositeSeedlingElement, elementSummaryOf, liftedClaimFrom,
    reservedRect, seedlingElementEntities, seedlingElementSiteCandidates,
} from './procgenSeedlingElements.js';
import { guardIdsFor } from '../procgenCore/elements.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, assertKind, carveSkeleton, kindsOffered,
    normalizeSkeleton,
} from '../procgenCore/skeletonKinds.js';
import {
    TILE_FLOOR, TILE_WALL, getTile, setTile,
} from '../shared/procgen/mazeAlgorithms/gridTiles.js';
/**
 * ⚠ REGISTER-ON-IMPORT (⚖ kickoff §5), and the BINDING owns it. Backends
 * register themselves into the shared registry when their files are imported;
 * the maze gets its six through `mazeRoomEngine`, and this is where Seedling
 * gets the three PORTABLE ones. ⛔ They are NOT imported from
 * `skeletonKinds.js` itself, even though that is the file that dispatches to
 * them: doing so made them register before `mazeRoom/mazeAlgorithms/index.js`'s
 * own three and moved `listBackends()`' order, which
 * `dump-maze-byteidentity.mjs` prints as a canary and `mazeAlgorithms/index.js`
 * says must not change. Measured, then moved here.
 *
 * ⛔ The maze-only three (`random_walls`, `corridor_only`, `empty`) are NOT
 * imported: they need the maze simulator, this binding refuses those kinds BY
 * NAME (`assertKind`), and importing them would drag the maze engine onto the
 * Seedling page's graph for kinds it will never run.
 */
import '../shared/procgen/mazeAlgorithms/kruskals.js';
import '../shared/procgen/mazeAlgorithms/recursiveBacktracker.js';
import '../shared/procgen/mazeAlgorithms/recursiveDivision.js';
import { rngFor } from './procgenRng.js';

export class ProcgenSeedlingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenSeedlingError';
    }
}

const fail = (message) => { throw new ProcgenSeedlingError(message); };

/**
 * ⚖ SLICE 1's CHOICES, INHERITED RATHER THAN RE-DECIDED.
 *
 * `torchpickup` is the goal class (§8.2: it clears its own tag, its volume is
 * the full 8x8 on the OEL point, and `hasTorch` couples to nothing the
 * palette depends on). The level id and the start cell are the proof
 * script's. Written as one frozen object so the CLI, the tests and any later
 * page arm cannot each pick their own and call the difference a finding.
 */
export const SEEDLING_DEFAULTS = Object.freeze({
    level: 900,
    width: SINGLE_SCREEN_TILES.width,
    height: SINGLE_SCREEN_TILES.height,
    goalClass: 'torchpickup',
    goalTag: '0',
    start: Object.freeze({ tx: 1, ty: 1 }),
});

/**
 * ⛓⛓⛓ THE PLACEMENT'S OWN ACTIVATOR GROUP, DERIVED FROM ITS ANCHOR.
 *
 * ⚖ USER-REPORTED DEFECT, 2026-08-13 (`procgenPalette.PLACEMENT_GROUP` carries
 * the measurement): two placements of a switch/door template shared the group
 * literal in the table, so every button opened every lock. The group has to
 * become a per-PLACEMENT value, and WHICH per-placement value is a claim about
 * determinism rather than a detail — so it is declared here rather than left to
 * be read off a diff.
 *
 * ── ⛔ THE ALLOCATOR IS THE ANCHOR, NOT A COUNTER, AND THAT IS THE POINT
 *
 * Three shapes were on the table and two of them make the level a function of
 * something other than its own geometry:
 *
 *  · **a counter bumped in `place`** — ⛔ `levelGenerator` calls `place` on
 *    EVERY candidate, including the ones the oracle then rejects (:330, above
 *    the `keep` at :380). So the kept groups would come out sparse (3, 7, …)
 *    and the id would encode the REJECTION HISTORY: still deterministic, but a
 *    different function of the seed, and one that moves the moment a bound or
 *    an oracle verdict changes. It also makes `place` impure — two calls with
 *    the same arguments would stop returning the same record.
 *  · **a counter bumped at KEEP** — contiguous ids, but the value is not in the
 *    record `place` built, so the level would need a second pass. ⛔ That
 *    breaks ⚖ §1.2's ATOMIC placement, which exists so no record ever holds an
 *    obstacle without its clearer.
 *  · **the anchor** — what this is. `place` STAYS PURE, and the id is a
 *    function of the level's own geometry: the same template kept at the same
 *    cell is the same group whatever the loop tried and threw away first.
 *
 * ⇒ ⚖ DECLARED: **same seed, same level** is preserved, and the stronger
 * property is preserved with it — a placement's group depends on WHERE IT
 * LANDED and on nothing else.
 *
 * ── WHY THE ARITHMETIC IS SAFE, FIELD BY FIELD ────────────────────────
 *
 * ⛓ **INJECTIVE**: `tx * height + ty` is the standard column-major index and
 * `ty <= height - 2` inside the interior, so no two cells share an id. Two kept
 * placements cannot share an anchor anyway — `assertGroupSlot` requires a
 * group-bearing template to WRITE its own `(0,0)`, and `isFree` refuses a
 * painted or occupied cell — so the two guarantees are belt and braces on
 * purpose: the arithmetic holds even if the loop ever placed at a repeated
 * anchor, and the palette check holds even if the arithmetic changed.
 *
 * ⛔ **STRICTLY POSITIVE**, via the `+ 1`, and that is a HARD requirement
 * rather than tidiness. The engine's group vocabulary is signed and the
 * negatives are CLAIMED: `levelWorld.FORCED_TSET` holds −1 (`bosslock`) and −2
 * (`shieldlock`), and `levelWorld` reads `tSetOf(...) < 0` as *lock-despawn*
 * in two places. Group **0** is claimed too — it is what `intAttr` returns for
 * a MISSING `tset`, i.e. the group every unmarked activator in the room is
 * already in. Ids from 1 up are the only unclaimed range.
 *
 * ⚠ **NOT BOUNDED ABOVE**, and it does not need to be: the group is matched by
 * EQUALITY, never used as an index (`activators.js`'s transcription of the
 * setter — `if (v[i] != this && v[i].t == t)` — and `solverBot`'s
 * `pressers.filter((p) => p.t === row.t)`). The atlas's habit of small integers
 * is a fact about hand-built rooms, not a ceiling this has to respect.
 */
export function placementGroupId(at, height) {
    return at.tx * height + at.ty + 1;
}

/**
 * ⛓⛓⛓ THE PLACEMENT'S OWN PERSISTENCE TAG — the LOWEST FREE SLOT IN THE
 * RECORD, and the allocator is a different shape from the group's on purpose.
 *
 * See `procgenPalette.PLACEMENT_TAG` for the defect (every weigh lock was
 * writing the GOAL's flag) and for why `-1` is not the fix.
 *
 * ⛔ THE GROUP'S ANCHOR ARITHMETIC CANNOT SERVE THIS. `placementGroupId` is
 * `tx * height + ty + 1`, which reaches ~89 in a 10x10 room, and a tag is
 * bounded by `TAGS_PER_LEVEL` — `Game.tagsPerLevel = 30` (`Game.as:525`),
 * imported rather than retyped. ⚠ AND OVERFLOW DOES NOT ERROR: the game's
 * table is one flat array indexed `level * 30 + tag` with no bounds check, so
 * a tag of 30 writes the NEXT LEVEL'S first slot. A modulo would have been
 * worse than useless — it would collide two placements silently, which is the
 * exact defect being fixed.
 *
 * ── ⚖ WHAT THIS IS A FUNCTION OF, DECLARED
 *
 * **The RECORD, and nothing else.** The tag is the lowest non-negative integer
 * below `TAGS_PER_LEVEL` that no entity in the record already uses and that is
 * not reserved. That buys the same three properties the group has, by a
 * different route:
 *
 *  · **PURE** — `place` stays a function of `(record, template, at)`. Two calls
 *    with the same arguments return the same record.
 *  · **NO REJECTION HISTORY** — `levelGenerator` calls `place` on candidates it
 *    then throws away, but a rejected candidate never enters the record, so
 *    nothing it did can shift a later tag. A COUNTER would have failed exactly
 *    here.
 *  · **CONTIGUOUS AND SMALL** — tags come out 1, 2, 3… which is what a
 *    30-slot budget wants, and what an anchor-derived id could never give.
 *
 * ⛓ THE USED SET IS READ WITH THE ENGINE'S OWN `tagOf`, never by re-reading
 * `attrs.tag`: a missing attribute is -1 (untagged) and `FORCED_TAG` decides
 * the value for four classes outright. A second reading of that rule here
 * would be a second cost model.
 *
 * @param {object} record    the level so far — the goal pickup is already in it
 * @param {number[]} reserved tags no placement may take, whatever the record says
 */
export function placementTagId(record, reserved = []) {
    const used = new Set(reserved.filter((t) => Number.isInteger(t) && t >= 0));
    for (const e of record.entities ?? []) {
        const t = tagOf(e.type, e.attrs);
        if (t >= 0) used.add(t);
    }
    for (let t = 0; t < TAGS_PER_LEVEL; t += 1) if (!used.has(t)) return t;
    /**
     * ⛔ REFUSED BY NAME, never wrapped. ⚠ The vanilla game's own busiest room
     * (`Dungeon4/2.oel`) uses 23 distinct tags of the 30, so this ceiling is
     * real rather than theoretical — and the failure it prevents is silent
     * corruption of the NEXT level's row.
     */
    fail(`procgenSeedling: this level already uses all ${TAGS_PER_LEVEL} persistence `
        + `tags (${[...used].sort((a, b) => a - b).join(', ')}), so there is no private `
        + 'slot left for another one. `Game.tagsPerLevel` is 30 and the game indexes '
        + 'one flat array as `level * 30 + tag` with NO bounds check, so allocating a '
        + '31st would write the NEXT level\'s first slot. Refusing is the only honest '
        + 'answer; a level this dense needs fewer tagged templates.');
    return -1;
}

/**
 * ⛓ THE KINDS THIS BINDING OFFERS — every PORTABLE one. `classic` and
 * `corridor` need the maze simulator and are refused by name (`assertKind`).
 * Derived rather than listed so a kind added to the table arrives here without
 * a second edit.
 */
export const SEEDLING_SKELETON_KINDS = Object.freeze(kindsOffered({ simulator: false }));

/** The interior cells of a room — everything the wall ring does not hold. */
export function interiorCells(record) {
    const out = [];
    for (let ty = 1; ty < record.height - 1; ty += 1) {
        for (let tx = 1; tx < record.width - 1; tx += 1) out.push({ tx, ty });
    }
    return out;
}

/**
 * THE SEEDLING LEVEL MODEL — kickoff §3.2's first injection.
 *
 * @param {object} o
 * @param {number} o.seed        the level's identity; the goal cell is its
 *                               first consequence
 * @param {object} [o.defaults]  see `SEEDLING_DEFAULTS`
 * @param {object} [o.skeleton]  `{kind}` — ⛓ CONSTRUCTIVE-MODE slice 5. The
 *   default is the OPEN bordered room this binding has always built; any other
 *   kind CARVES the interior with the grid backend the kind names. ⛔ Seedling
 *   offers the PORTABLE kinds only — `classic` and `corridor` need the maze
 *   simulator and are refused by name. See `procgenCore/skeletonKinds.js`.
 * @param {object} [o.elements]  `{name[, params]}` — ⛓ PROCGEN ELEMENTS arc 3,
 *   slice 3, through the ONE codec (`procgenCore/elementSpec.js`). ⛔ The
 *   default is `'none'` and at `none` **the element stream is not consulted at
 *   all**: no site is drawn, nothing is constructed, no draw is spent, and every
 *   Seedling md5 is byte-identical by a code path that never executes (⚖ arc-2
 *   ruling 5, applied one substrate over). ⚠ `turns > 0` REFUSES BY NAME — that
 *   is the CHAIN (arc 4, ask-first; ⚖ arc-3 ruling 1).
 * @param {boolean} [o.dropElement]  ⛓ THE CERTIFICATION'S OWN ARM. Spends every
 *   element draw exactly as usual and then does NOT commit the composite, so a
 *   gadget the solver cannot certify leaves a room that is the plain carve plus
 *   the draws the element spent (arc-2 §10.3: *a refused element moves the
 *   stream by exactly the draws it spent*). ⛔ Used by `generateSeedlingLevel`
 *   and by nothing else; it is not a caller-facing knob.
 */
export function seedlingModel({
    seed, defaults = SEEDLING_DEFAULTS, skeleton: skeletonSpec = DEFAULT_SKELETON,
    elements: elementSpec = DEFAULT_ELEMENTS, dropElement = false,
} = {}) {
    const d = { ...SEEDLING_DEFAULTS, ...defaults };
    /**
     * ⛔ THE GOAL CELL IS DRAWN FROM ITS OWN STREAM, not from the loop's.
     *
     * The room is built before the loop starts and its goal must not depend
     * on how many templates were drawn afterwards — otherwise the same seed
     * would place the goal differently the moment a bound changed, and "same
     * seed, same level" would be true only for one set of bounds. So the
     * model owns a stream seeded from the level's seed and the LOOP owns
     * another (`generateSeedlingLevel` below), which is why the two never
     * interleave.
     */
    const roomRng = rngFor(seed);
    const blank = emptyLevel({ level: d.level, width: d.width, height: d.height });
    const goalCandidates = interiorCells(blank)
        .filter((c) => !(c.tx === d.start.tx && c.ty === d.start.ty));
    const goalCell = roomRng.pick(goalCandidates);
    const goalOel = oelAtTile(goalCell.tx, goalCell.ty);
    const reserved = new Set([
        `${d.start.tx},${d.start.ty}`,
        `${goalCell.tx},${goalCell.ty}`,
    ]);

    /**
     * ── ⛓⛓⛓ SLICE 5: THE CARVE. ONE PASS, AT MODEL CONSTRUCTION ────────
     *
     * ⛔ IT HAPPENS HERE AND NOT INSIDE `skeleton()` BECAUSE IT SPENDS DRAWS,
     * and `skeleton()` is called more than once (the loop calls it, and
     * `watchGenerate.generateStep(0)` calls it for the page). A carve per call
     * would hand out a different room each time from one seed.
     *
     * ⛓ THE DRAW ORDER **IS** THE IDENTITY (⚖ kickoff §3.4): `goalCell` is
     * `roomRng`'s FIRST draw, above; the backend's draws come next; the
     * post-processors' last. So the goal of seed s under kind K is the goal of
     * seed s under `empty`, and the constructive kinds do not expire the
     * empty-room seed→level pairs (`procgenSeedling.test.js` drives it).
     *
     * ⛔ AT THE DEFAULT KIND NOTHING BELOW RUNS. `empty` is not "the `empty`
     * backend" — it is the open bordered room this file has always built — so
     * the byte-identity gate is a code path that never executes rather than a
     * comparison that happens to pass.
     *
     * ── THE GRID, AND THE THREE FACTS ABOUT IT WORTH STATING ──────────
     *
     * The carvers speak the `gridTiles.js` contract: `{width, height, tiles:
     * Int8Array, entrance:{x,y}, exits: Map of {x,y}}`. Seedling anchors are
     * `{tx,ty}` and grid points are `{x,y}` — converted at this boundary and
     * nowhere else (§9.2's rule).
     *
     *  1. ⚠ **THE RING IS HANDED IN ALREADY WALLED, AND THAT IS LOAD-BEARING.**
     *     The two tree backends would wall it themselves (`fillBackgroundWalls`
     *     walls every non-fixed tile), but `recursive_division` starts from the
     *     ALL-FLOOR grid `createWorld` gives it and only ADDS walls — so on a
     *     bare grid it would return a room whose border is floor, and
     *     `emptyLevel`'s own docblock says why that is not a room (*"nothing
     *     stops a player from walking off a floor that ends"*). Pre-walling
     *     costs nothing for the tree kinds (they overwrite it) and is invisible
     *     to `braid` (a ring wall has no floor beyond it) and to
     *     `pruneDeadEnds` (which only fills). ⛓ And it is CHECKED below, not
     *     assumed.
     *  2. ⚠ **THE LATTICE IS 4x4 CELLS AND THE ROOM IS 10x10**, so the
     *     tree backends use columns/rows 1,3,5,7 and leave row 8 and column 8
     *     as a strip no cell occupies — 7x7 effective. A goal drawn into that
     *     strip is not stranded: `connectFixedTiles` L-carves every off-lattice
     *     fixed tile to its nearest cell. The start (1,1) is exactly ON a cell,
     *     so it is part of the spanning tree by construction.
     *  3. ⛔ **`repairConnectivity` IS NOT CALLED FROM HERE** for any kind: the
     *     tree backends are connected by construction, and `recursive_division`
     *     calls it inside its own `run`. The honest net for a skeleton that
     *     does not solve is the LOOP's — `generateLevel` refuses to start and
     *     says so with the oracle's own text.
     */
    const skeletonKind = assertKind(skeletonSpec?.kind ?? DEFAULT_SKELETON_KIND,
        { simulator: false, substrate: 'the Seedling binding' });
    /**
     * ⛓⛓ SLICE 7 — THE KIND'S DECLARED PARAMETERS, normalized ONCE here. A key
     * this kind does not declare, or a value outside its domain, refuses BY
     * NAME (`resolveSkeletonParams` inside `normalizeSkeleton`) — before any
     * grid exists, because a link that names a room nobody can build should not
     * reach the carver at all.
     */
    const skeletonSpecNorm = normalizeSkeleton({
        kind: skeletonKind, params: skeletonSpec?.params ?? {},
    });

    const carveRoom = () => {
        const gw = { width: d.width, height: d.height };
        const grid = {
            width: gw.width,
            height: gw.height,
            tiles: new Int8Array(gw.width * gw.height),
            entrance: { x: d.start.tx, y: d.start.ty },
            exits: new Map([['goal', { exit_id: 'goal', x: goalCell.tx, y: goalCell.ty }]]),
        };
        // (1) the ring, walled before the backend sees the grid.
        for (let y = 0; y < gw.height; y += 1) {
            for (let x = 0; x < gw.width; x += 1) {
                const ring = x === 0 || y === 0 || x === gw.width - 1 || y === gw.height - 1;
                if (ring) setTile(grid, x, y, TILE_WALL);
            }
        }
        /**
         * ⛓⛓ SLICE 7 — `margin: 1`, AND IT IS THE RING'S OWN NUMBER. The
         * Seedling room's border must stay wall (fact 1 above), so a carver
         * that STAMPS — `chambers` is the first — may never write into the
         * outermost cell. ⛔ Passed rather than defaulted: the maze has no ring
         * and passes 0, and a post-processor that guessed would be wrong in one
         * of the two substrates. The border check below is what proves it.
         */
        const carve = carveSkeleton(skeletonKind, grid, roomRng, {
            params: skeletonSpecNorm.params ?? {}, margin: 1,
        });
        const ground = [];
        for (let ty = 0; ty < gw.height; ty += 1) {
            for (let tx = 0; tx < gw.width; tx += 1) {
                if (getTile(grid, tx, ty) !== TILE_FLOOR) continue;
                if (tx === 0 || ty === 0 || tx === gw.width - 1 || ty === gw.height - 1) {
                    fail(`procgenSeedling: the ${JSON.stringify(skeletonKind)} carve left the `
                        + `BORDER cell (${tx},${ty}) as floor. The ring is what makes the room `
                        + 'a room — `loadlevel` drops out-of-rectangle tiles and nothing stops '
                        + 'a player walking off a floor that ends — so a carve that opens it '
                        + 'is refused rather than painted over.');
                }
                ground.push({ tx, ty, terrain: 'ground' });
            }
        }
        /**
         * ⛔ THE CARVE BASE IS `emptyLevel({floor:'wall'})` — a room that is
         * wall everywhere — and only the carved cells are painted back to
         * `ground`. The alternative (paint all 100 cells, floor AND wall)
         * writes the same record and hides the fact that the un-carved room IS
         * the wall; ⚖ ruling 1's *"a map filled with walls"* is a starting
         * state, not a paint order.
         */
        const walled = emptyLevel({
            level: d.level, width: d.width, height: d.height, floor: 'wall',
        });
        return { record: withTerrain(walled, ground), carve };
    };

    /**
     * ── ⛓⛓⛓ PROCGEN ELEMENTS ARC 3, SLICE 3: **THE ELEMENT, CONSTRUCTED
     *    BEFORE THE CARVE** (⚖ design ruling 2; the maze's arc-2 §10.3 order,
     *    one substrate over) ─────────────────────────────────────────────
     *
     * ⛓ **THE DRAW ORDER, DECLARED** (the order IS the identity):
     *   1 the goal cell     — `roomRng`'s FIRST draw, ⛔ UNCHANGED
     *   2 `instantiate`     — the element's own parameters in SCHEMA order. A
     *                         parameter the spec NAMED is an override and spends
     *                         no draw; one it omitted is drawn. ⚠ `turns` is
     *                         ALWAYS an override here (see below), so on
     *                         Seedling the only drawable element parameter is
     *                         `len`.
     *   3 the SITE          — ONE `pick` over the legal snug rectangles
     *   4 `construct(site)` — the gadget's geometry, from the SAME stream
     *   5 the carve         — the backend + its post-processors, ⛔ UNCHANGED
     *                         code at a stream position 2-4 have moved
     *   6 the composite     — spends NO draw (it writes tiles)
     *
     * ⛔ **`len` IS DRAWN BEFORE THE SITE**, because the site must be SNUG and
     * snug means `len + SITE_MARGIN_STRAIGHT`: the size is not known until the
     * parameter is. Same delta the maze recorded against its own §3.3.
     *
     * ⛔ **AT `none` NONE OF 2-4 OR 6 HAPPENS.** Not "runs and returns early" —
     * the branch is not entered, no element is instantiated, `construct` is
     * never called and the rng is not touched, so every Seedling pair, the
     * acceptance batch, the battery and the generated set are unchanged by a
     * code path that does not execute. `procgenSeedlingElements.test.js` drives
     * that with a COUNTING SPY rather than by comparing tiles (arc-1 §9's rule).
     *
     * ⛔ **`turns > 0` IS REFUSED BY NAME** (⚖ arc-3 ruling 1: the straight lane
     * only; a bent push is the CHAIN, arc 4, ask-first). A spec that NAMES a
     * non-zero `turns` refuses; a spec that omits it gets `turns: 0` as an
     * OVERRIDE rather than a draw — so the domain a Seedling sweep certifies is
     * `len` alone, and the element's own `turns` domain stays the maze's.
     */
    const elementSpecNorm = normalizeElementSpec(elementSpec ?? DEFAULT_ELEMENTS);
    const elementValues = resolveElementSpec(elementSpecNorm);
    let elementPlan = null;
    let elementRefusal = null;
    if (elementValues.name !== ELEMENTS_NONE) {
        const named = namedParams(elementSpecNorm, { elementOnly: true });
        if (named.turns !== undefined && named.turns !== 0) {
            elementRefusal = { reason: 'the-chain-is-arc-4',
                detail: `the spec names turns=${named.turns}. ⚖ Arc-3 ruling 1: Seedling gets `
                    + 'the STRAIGHT LANE only — `turns = 0`, which `weigh` certifies today. A '
                    + 'bent push path is the CHAIN, which is arc 4 and ASK-FIRST (design '
                    + 'ruling 17): it needs a solver that can plan a push around a corner, '
                    + 'and no template-side trick substitutes for one.' };
        } else {
            const entry = ELEMENT_TABLE[elementValues.name];
            const drawsBefore = roomRng.draws;
            const concrete = entry.element.instantiate(roomRng, { ...named, turns: 0 });
            const size = concrete.params.len + SITE_MARGIN_STRAIGHT;
            const sites = seedlingElementSiteCandidates({
                width: d.width, height: d.height, start: d.start, goal: goalCell, size,
            });
            if (sites.length === 0) {
                elementRefusal = { reason: 'no-site-fits-this-room',
                    detail: `a len=${concrete.params.len} straight gadget needs a ${size}x${size} `
                        + 'site with a one-cell ring around it, and no such rectangle fits '
                        + `inside the ${d.width}x${d.height} room's interior while leaving the `
                        + `START (${d.start.tx},${d.start.ty}) and the GOAL (${goalCell.tx},`
                        + `${goalCell.ty}) outside the ring. ⛔ ⚖ Arc-3 ruling 7: the room does `
                        + 'NOT grow — the honest answer is a shorter gadget or a different '
                        + 'goal, and D1(b)\'s census publishes how often each `len` fits.' };
            } else {
                const site = roomRng.pick(sites);
                /**
                 * ⛓ THE STREAM POSITION AT `construct` IS ITS OWN FIELD (arc-2
                 * §10.5.1, measured there rather than reasoned): the SITE PICK
                 * sits BETWEEN `instantiate` and `construct`, both of which draw
                 * from this stream, so a rebuild that replays the two back to
                 * back lands ONE DRAW EARLY and builds a different gadget. ⇒ a
                 * record is `{params, site, drawsAtConstruct}` plus the seed.
                 */
                const drawsAtConstruct = roomRng.draws;
                const placement = concrete.construct(site);
                if (placement.refused) {
                    elementRefusal = { reason: placement.refused.reason,
                        detail: `${placement.refused.detail} (site ${site.w}x${site.h} at `
                            + `(${site.x},${site.y}))` };
                } else {
                    elementPlan = { concrete, site, placement, drawsBefore, drawsAtConstruct,
                        params: concrete.params, ids: guardIdsFor(0) };
                }
            }
        }
    }

    const carved = skeletonKind === DEFAULT_SKELETON_KIND ? null : carveRoom();
    let base = carved ? carved.record : blank;

    /**
     * ⛓⛓⛓ **THE COMPOSITE** — the carve ran over the WHOLE grid exactly as it
     * does today and its answer inside the reserved rectangle is now DISCARDED;
     * the element's tiles are written over it, the ring is walled except the
     * entry mouth, the mouth is joined by the shortest tunnel and every check is
     * asked on the way out. ⛔ It spends NO draw, and on a refusal the room is
     * left exactly as the carve left it (arc 1's commit-on-success rule, one
     * layer out) — so a seed whose gadget cannot be joined produces a perfectly
     * ordinary Seedling level with `elements.refused` set.
     *
     * ⛓ THE ELEMENT'S ENTITIES ARE THE **SKELETON'S**, not a template's: the
     * gadget is part of the room the loop is handed, so `skeleton()` carries the
     * block, the two buttons and the two locks beside the goal pickup, and the
     * loop's own step-0 solve is the certification (D4).
     */
    let elementInfo = Object.freeze({
        spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
        refused: elementRefusal ? Object.freeze(elementRefusal) : null,
    });
    let elementEntities = Object.freeze([]);
    let elementCells = new Set();
    if (elementPlan) {
        const out = compositeSeedlingElement({
            width: d.width, height: d.height,
            groundAt: (x, y) => terrainAt(base, x, y) === 'ground',
            site: elementPlan.site, placement: elementPlan.placement,
            start: d.start, goal: goalCell,
        });
        if (out.refused) {
            elementInfo = Object.freeze({
                spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
                refused: Object.freeze(out.refused),
            });
        } else if (dropElement) {
            /**
             * ⛔ THE GEOMETRY SUCCEEDED AND IS DELIBERATELY NOT COMMITTED — see
             * the `dropElement` parameter. The draws are spent either way, which
             * is why this arm produces a level and not an error.
             */
            elementInfo = Object.freeze({
                spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
                refused: Object.freeze({
                    reason: 'the-skeleton-does-not-solve-with-the-element',
                    detail: 'the gadget FITS this room and the solver cannot certify it, so '
                        + 'the level was generated WITHOUT it. ⛓ The refusal is the arc\'s own '
                        + 'dependency, published: `procgenSeedlingElements.js`\'s docblock and '
                        + 'the arc-3 as-built §10 carry the three solver gaps and the S1 work '
                        + 'order. ⛔ Nothing here solves around it.',
                }),
            });
        } else {
            const p = out.placed;
            base = withTerrain(base, p.painted);
            const withGoal = withEntities(base, [{
                type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag },
            }]);
            const taken = [Number.parseInt(d.goalTag, 10)];
            const realised = seedlingElementEntities({
                placed: p,
                groupIdFor: (at) => placementGroupId(at, d.height),
                tagFor: (...more) => placementTagId(withGoal, [...taken, ...more]),
                ids: elementPlan.ids,
            });
            elementEntities = Object.freeze(realised.entities.map((e) => Object.freeze({
                type: e.type, ...oelAtTile(e.tx, e.ty),
                ...(e.attrs ? { attrs: Object.freeze({ ...e.attrs }) } : {}),
            })));
            /**
             * ⛔ EVERY CELL OF THE RESERVED RECTANGLE AND OF THE TUNNEL IS OFF
             * LIMITS TO PASS 2, and it is a REFUSAL BY NAME rather than a hope.
             * `freeRefusal` alone would let a template wall the push lane (it is
             * untouched `ground` with no entity on it) and `carveCellRefusal`
             * alone would let one CARVE through the ring (in `base` the ring is
             * wall, so the untouched-skeleton test passes) — either would break
             * a gadget the level was built around, and the loop would only find
             * out from a solve it then reverted.
             */
            const rr = reservedRect(p.site);
            for (let y = rr.y; y < rr.y + rr.h; y += 1) {
                for (let x = rr.x; x < rr.x + rr.w; x += 1) elementCells.add(`${x},${y}`);
            }
            for (const c of p.tunnel) elementCells.add(`${c.x},${c.y}`);
            elementInfo = Object.freeze({
                spec: elementSpecNorm,
                ran: true,
                placed: Object.freeze([Object.freeze({
                    element: elementPlan.concrete.name,
                    family: elementPlan.concrete.family,
                    instance: elementPlan.concrete.instance,
                    index: 0,
                    /** ⛓ A RECORD IS `{params, site, drawsAtConstruct}` + the
                     *  level's SEED (arc-2 §9.1/§10.5.1). `drawsBefore` is kept
                     *  beside it because it says where the element's whole draw
                     *  span began. */
                    params: Object.freeze({ ...elementPlan.params }),
                    drawsBefore: elementPlan.drawsBefore,
                    drawsAtConstruct: elementPlan.drawsAtConstruct,
                    groups: realised.groups,
                    tags: realised.tags,
                    ids: elementPlan.ids,
                    ...p,
                })]),
                refused: null,
            });
        }
    }

    const skeleton = () => withEntities(base, [{
        type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag },
    }, ...elementEntities]);

    /**
     * ⚠ "FREE" IS FOUR CLAIMS AND THEY ARE ASKED SEPARATELY: the cell is
     * inside the interior rectangle, it still holds untouched `ground`
     * (`terrainAt` reads the record, so a cell an earlier template painted is
     * no longer free), it holds no entity, and it is neither the start nor the
     * goal. The last one is not derivable from the others — a pickup does not
     * change the terrain under it, and a wall dropped on the goal builds a room
     * whose refusal would be about geometry rather than about the template.
     *
     * ⛓⛓⛓ **SLICE 6: IT NAMES THE CLAIM THAT FAILED, AND `isFree` IS DERIVED
     * FROM IT.** Until a cell could be CLICKED, "why not?" had no reader: every
     * anchor the loop ever saw came out of `anchorsFor`, which only ever offers
     * cells this already accepted. A clicked cell is the first one a person
     * chose, and *"nothing happened"* is the one answer they cannot act on.
     *
     * ⛔ ONE ADJUDICATION, TWO READERS — the boolean is `freeRefusal(…) ===
     * null` rather than a second conjunction beside it. Two spellings of one
     * legality rule is this repo's recorded failure mode, and it would be a
     * particularly bad one here: the pair would agree for as long as nobody
     * edited either, and the day they disagreed the loop would place a template
     * the page said was illegal (or refuse a click the loop would have taken).
     *
     * ⚠ THE STRING IS BUILT ONLY ON THE BRANCH THAT RETURNS IT, so the hot path
     * (`anchorsFor` walking the interior) allocates one string per REFUSED cell
     * and none per accepted one — and a large footprint fails on its first cell.
     * Measured on six ladders to step 6: 7.2 s before, 7.1 s after.
     */
    /**
     * ⛓⛓ **A CELL THE ELEMENT OWNS IS NOT PASS 2's** — PROCGEN ELEMENTS arc 3,
     * slice 3. The reserved rectangle (site + its ring) and the connector tunnel
     * are the geometry the gadget's own certification is about, and a template
     * that painted any of it would break a puzzle the level was BUILT AROUND
     * (⚖ design ruling 2: elements first, connectors and decorators after).
     *
     * ⛔ IT IS ASKED IN BOTH LEGALITY RULES, because neither alone covers it:
     * `freeRefusal`'s untouched-`ground` test would let a wall segment land in
     * the push lane, and `carveCellRefusal`'s untouched-SKELETON test would let a
     * pocket be CARVED out of the ring (in `base` the ring IS wall, so the
     * comparison passes). ⛓ AND AT `--elements=none` THE SET IS EMPTY, so this
     * is a code path that returns `null` on its first line rather than a
     * comparison that happens to pass — which is what keeps every committed pair
     * byte-identical.
     */
    const elementRefusalAt = (tx, ty) => {
        if (elementCells.size === 0 || !elementCells.has(`${tx},${ty}`)) return null;
        const p = elementInfo.placed[0];
        return `(${tx},${ty}) belongs to the ELEMENT ${p.instance} — its reserved rectangle `
            + `(${p.site.w + 2}x${p.site.h + 2} at (${p.site.x - 1},${p.site.y - 1})) or the `
            + `${p.tunnel.length}-cell tunnel that joins its entry mouth. ⛔ An element is `
            + 'placed FIRST and the level is built AROUND it (⚖ design ruling 2), so pass 2 '
            + 'may not paint, carve or occupy any of it: the gadget\'s door is a CUT of this '
            + 'room, and a template that opened the ring or walled the push lane would break '
            + 'the puzzle the level exists to pose.';
    };

    const freeRefusal = (record, tx, ty) => {
        if (!(tx > 0 && ty > 0 && tx < record.width - 1 && ty < record.height - 1)) {
            return `(${tx},${ty}) is not in the room's INTERIOR — the border ring is wall, so `
                + `the placeable cells are (1,1) to (${record.width - 2},${record.height - 2}).`;
        }
        const claimed = elementRefusalAt(tx, ty);
        if (claimed) return claimed;
        if (reserved.has(`${tx},${ty}`)) {
            const which = tx === d.start.tx && ty === d.start.ty ? 'START' : 'GOAL';
            return `(${tx},${ty}) is the ${which} cell. A pickup does not change the terrain `
                + 'under it, so this is not the terrain check saying no — a template dropped '
                + 'here would build a room whose refusal is about GEOMETRY rather than about '
                + 'the template.';
        }
        const terrain = terrainAt(record, tx, ty);
        if (terrain !== 'ground') {
            return `(${tx},${ty}) already holds ${JSON.stringify(terrain)} and not untouched `
                + '`ground` — an earlier template painted it.';
        }
        const held = record.entities.find((e) => Math.floor(e.x / TILE_SIZE) === tx
            && Math.floor(e.y / TILE_SIZE) === ty);
        if (held) {
            return `(${tx},${ty}) already holds the entity ${held.type} at (${held.x},${held.y}).`;
        }
        return null;
    };
    const isFree = (record, tx, ty) => freeRefusal(record, tx, ty) === null;

    /**
     * ⛓⛓⛓ **THE SITES — PROCGEN ELEMENTS arc 3, slice 1, DERIVED ONCE, BESIDE
     * THE CARVE.**
     *
     * ⛔ HERE AND NOT IN `skeleton()`, for the carve's own reason one line up:
     * `skeleton()` is called more than once and this is a property of the room
     * the carve built, not of each call. ⛓ AND IT SPENDS NO DRAW — every class
     * is read off the tiles — so adding it moves no level from any seed. The
     * gate for that claim is the `empty` pairs md5, not this sentence.
     *
     * ⛔ IT IS DERIVED FROM THE **SKELETON**, NOT FROM THE RECORD PASS 2 IS
     * BUILDING. A template placed at step 4 has painted walls the skeleton did
     * not have, and re-deriving per step would make the class a function of the
     * rejection history — the shape `placementGroupId`'s docblock rejects three
     * times over. Legality is what accounts for a cell an earlier template
     * took; the site says what kind of place the ROOM offers.
     *
     * ⛓ THE CONVERSION HAPPENS HERE AND NOWHERE ELSE (§9.2's rule, carried
     * whole): `procgenCore/` speaks `{x,y}` because a grid is the vocabulary
     * both substrates share, and Seedling anchors are `{tx,ty}`.
     *
     * ── ⛔⛔ DERIVED ON FIRST USE, MEMOIZED — **AND THAT IS A COST FIX, NOT A
     *    SEMANTIC ONE** ────────────────────────────────────────────────
     *
     * ⛓ MEASURED, and the first draft was wrong: deriving eagerly here made
     * `seedlingModel` construction **0.039 ms → 2.819 ms on `empty`, 72x**,
     * because `procgenLevel.terrainAt` is a linear scan of the tiles layer
     * (5.8 µs a call) and this model is constructed by nearly every test in the
     * suite. `deriveSites` now reads the predicate exactly once per cell, and
     * this closure defers the whole thing until somebody ASKS.
     *
     * ⛔ LAZINESS CANNOT CHANGE THE ANSWER, and that is why it is safe: the
     * closure captures `base` — the SKELETON, which is finished before this
     * line runs and is never mutated (`withTerrain`/`withEntities` are pure) —
     * so the derivation reads the same tiles whenever it happens, and it still
     * spends NO DRAW. ⚠ It is emphatically NOT derived from the record pass 2
     * is building; see `anchorsFor`.
     */
    const toTiles = (cells) => Object.freeze(cells.map((c) => Object.freeze({
        tx: c.x, ty: c.y,
    })));
    let sitesMemo = null;
    const sitesOf = () => {
        if (sitesMemo) return sitesMemo;
        const g = deriveSites(d.width, d.height,
            (x, y) => terrainAt(base, x, y) === 'ground',
            { from: { x: d.start.tx, y: d.start.ty }, to: { x: goalCell.tx, y: goalCell.ty } });
        sitesMemo = Object.freeze({
            main: toTiles(g.main),
            bend: toTiles(g.bend),
            branch: Object.freeze(g.branch.map((b) => Object.freeze({
                mouth: Object.freeze({ tx: b.mouth.x, ty: b.mouth.y }),
                dir: b.dir,
                length: b.length,
                cells: toTiles(b.cells),
            }))),
            tip: toTiles(g.tip),
            chamber: toTiles(g.chamber),
            chambers: Object.freeze(g.chambers.map((c) => Object.freeze({
                cells: toTiles(c.cells),
            }))),
            corridor: toTiles(g.corridor),
        });
        return sitesMemo;
    };

    /**
     * ⛓⛓⛓ **THE RECORD'S GROUND MASK, CACHED ON THE RECORD OBJECT** — PROCGEN
     * ELEMENTS arc 3, slice 2, and it is a COST fix with no semantic content.
     *
     * ⛔ `procgenLevel.terrainAt` is a LINEAR SCAN of the tiles layer (`tiles
     * .find` plus an `Object.values(TERRAIN).find`) and costs **5.8 µs a call** —
     * slice 1 measured it and paid 72× for asking it per cell (§8.6). This slice
     * adds THREE more floods to `refusalAt` (the cut, the start-side reach, the
     * two shortest paths a carve compares), and `anchorsFor` runs `refusalAt`
     * once per interior cell, so asking `terrainAt` inside each flood's
     * predicate would be ~64 × 100 scans per anchor walk.
     *
     * ⛓ THE CACHE KEY IS THE RECORD OBJECT ITSELF, which is sound because
     * `procgenLevel`'s writers are PURE — `withTerrain`/`withEntities` return a
     * NEW frozen record — so a record that is `===` the cached one has the same
     * tiles by construction. One 100-cell scan per `anchorsFor` call rather
     * than per candidate cell.
     *
     * ⛔ AND IT IS THE **ONE** READING OF "WHICH CELLS ARE GROUND": `sealRefusal`
     * and the door law below both take their predicate from here, so the
     * pre-check and the cut can never disagree about what a wall is.
     */
    let maskRecord = null;
    let maskBits = null;
    const groundMask = (record) => {
        if (maskRecord === record) return maskBits;
        const bits = new Uint8Array(record.width * record.height);
        for (let ty = 0; ty < record.height; ty += 1) {
            for (let tx = 0; tx < record.width; tx += 1) {
                if (terrainAt(record, tx, ty) === 'ground') bits[tx + ty * record.width] = 1;
            }
        }
        maskRecord = record;
        maskBits = bits;
        return bits;
    };

    /** The cells one candidate placement would PAINT, keyed `"x,y"`. */
    const paintedOf = (template, tx, ty) => new Map((template.terrain ?? [])
        .map((w) => [`${tx + w.dx},${ty + w.dy}`, w.terrain]));

    /**
     * The walkability the room would have with this candidate's TERRAIN painted,
     * and with `walled` (a key set) forced solid. ⛔ ONE builder for every flood
     * this file runs, so "what blocks" is stated once (`sealRefusal`'s own
     * docblock: `wall`, `water` and `pit` all block; `ground` is the whole
     * walkable vocabulary).
     */
    const walkableWith = (record, painted, walled = null) => {
        const bits = groundMask(record);
        const w = record.width;
        return (x, y) => {
            const key = `${x},${y}`;
            if (walled && walled.has(key)) return false;
            const p = painted.get(key);
            return p === undefined ? bits[x + y * w] === 1 : p === 'ground';
        };
    };

    /**
     * ⛓⛓⛓ **WHY THIS ANCHOR IS REFUSED — `null` when it is not** (slice 6).
     *
     * The rules in the order `legalAt` has always asked them, each answering in
     * the MODEL'S OWN WORDS. ⛔ THE ORDER IS PART OF THE ANSWER, and arc 3 slice
     * 2 states it in full: **footprint/clearance → CARVE legality → SEAL → the
     * DOOR LAW (cut, then start-side)**.
     *
     * ⚠ The footprint walk stays FIRST, and its reason SURVIVED the rule that
     * used to need it. `doorClear` refused BY THROWING for an anchor north-west
     * of the start, so the walk had to reject off-interior cells before it ran;
     * the door law reads the flood and has no such domain. The walk is still
     * first because a FLOOD handed writes outside the rectangle would read
     * `terrainAt` past the room (trap 255's own claim, restated on its real
     * cause), and `procgenSeedlingPrecheck.test.js` drives it on a border cell.
     *
     * ⛓ THE CARVE SITS SECOND — between the per-cell walk and the floods —
     * because it is the rule about the cells the walk just accepted, and a
     * reader who wrote a two-mouth pocket wants to hear about the pocket rather
     * than about the room's connectivity.
     *
     * ⚠ IT NAMES THE OFFENDING CELL AND WHICH PART OF THE TEMPLATE WANTED IT.
     * A footprint cell and a `clearance` cell are refused for the same reason
     * and mean different things: the first is the obstacle, the second is the
     * room its clearer needs (the S1 guard), and a reader who moved the anchor
     * one cell has to know which they were fighting.
     */
    /**
     * ⛓⛓⛓ **THE CONNECTIVITY PRE-CHECK** — CONSTRUCTIVE-MODE slice 6, §3.6
     * item 2, and the Seedling half of a rule both bindings run over ONE flood
     * (`procgenCore/gridFlood.js`; the maze's half is `procgenMaze.sealRefusal`).
     *
     * *A candidate whose TERRAIN writes disconnect the start from the goal is
     * refused BY NAME, before any solve.*
     *
     * ── ⛓⛓ THE MEASUREMENT THAT BOUGHT IT (the BEFORE yield table) ────
     *
     * ⚖ Kickoff §5: *measure before you build.* `sweep-yield-table.mjs` over
     * the seven kinds this binding offers, seeds 1..8 at count 3 / tries 4,
     * counted **64 REVERTED candidates on the CARVED kinds whose refusal was
     * one sentence** — `solverBot(procgen-l900): no corridor for goal
     * collect-placement…`, i.e. the walk could not reach the torch at all. The
     * pre-check turns exactly those into an instant, named refusal; the anchor
     * is never offered, so no solve is spent on it. Measured AFTER: **64 → 0**,
     * and the sweep's total solve count fell 297 → 235.
     *
     * ⚠⚠ AND IT DID **NOT** BUY THE HEADLINE COST BACK, WHICH IS THE FINDING
     * SLICE 6 CARRIED FORWARD. The worst single solve in that sweep — 77.8 s on
     * `bushy` seed 5 — was an **`arrow-lane`** refusal (*"the combat ladder is
     * E…"*), and an arrow lane writes NO TERRAIN AT ALL. Probe 2 (§2.4)
     * attributed the corridor's cost to sealing candidates; at those bounds the
     * dominant cost was an ENTITY template this rule cannot touch and must not.
     *
     * ⛓⛓ **DISCHARGED BY REMOVAL, NOT BY A FIX** (PROCGEN ELEMENTS arc 3, slice
     * 1; ⚖ design ruling 9). `arrow-lane` LEFT THE PALETTE — it was a
     * pre-sword-puzzle element and the generator has no use for one — and the
     * tail went with it: the same sweep in the same tree measured **MAX single
     * solve 70,784 ms before and 850 ms after — 83x** (and total generation
     * wall time 116.4 s → 32.8 s). ⛔ Nothing about this rule changed; the
     * cost was never connectivity's to buy, which is what slice 6 said and what
     * the removal confirms from the other side.
     *
     * ── ⛔ WHAT BLOCKS, AND WHY IT IS `ground` AND NOTHING ELSE ────────
     *
     * `wall`, `water` and `pit` ALL block. Wall is `world.solids`; water lands
     * in `world.lethalTerrainTiles` and pit in `world.pitTiles`
     * (`procgenLevel.TERRAIN`'s own docblock names both tables) — lethal
     * terrain the corridor planner prices as impassable, so a ROUTE cannot
     * cross either. ⛔ `ground` is therefore the whole walkable vocabulary, and
     * a flood that let a pit through would report a sealed room as open (the
     * mutant this rule is gated against).
     *
     * ── ⛔ WHAT IT IS SOUND FOR: **FULL-TILE TERRAIN ONLY** ────────────
     *
     * ⚠ ENTITIES ARE IGNORED — a block, a lock, a spinner, an arrow trap. Those
     * are the ORACLE's business: whether a pushable block can be moved out of a
     * corridor is a fact about the SEARCH, not about the grid. ⚠ And traps
     * 136/139 bound it from the other side: *a tile flood under-approximates a
     * player smaller than a tile* and *the grid rounds a sub-tile obstacle*.
     * Neither applies to a TERRAIN write, which fills its cell exactly — which
     * is precisely why the rule is scoped to terrain and refuses to grow.
     *
     * ⇒ NECESSARY, never sufficient: sealed ⇒ certainly unsolvable ⇒ refuse;
     * not sealed ⇒ nothing is claimed and the oracle still decides.
     *
     * ── ⚖ EVERY KIND, `empty` INCLUDED — THE SCOPE IS GONE (slice 6b) ─
     *
     * Slice 6 shipped this rule KIND-SCOPED (§6.2's named default: OFF at
     * `empty`, where every committed seed→level pair lives) and MEASURED what
     * widening would cost — **22 of the 80 `empty` seed→level pairs** (seeds
     * 1..40 × both palettes at count 3). ⚖ **THE USER RULED, 2026-08-15**, in
     * the PROCGEN ELEMENTS design session: widen it to EVERY kind. GENERATE-UI
     * ruling 5 licenses exactly that expiry (*"it's not a problem if the seed
     * level pairs expire"*). Slice 6b dropped the scope and re-recorded the 22
     * rows; ⛔ the soundness argument above is UNCHANGED and now global — it
     * never mentioned the skeleton, because a sealed room is unsolvable however
     * its walls got there.
     *
     * ⛔ WHY AN OPEN ROOM CAN SEAL AT ALL — the thing slice 6's own fixture got
     * wrong. **Never from a FRESH skeleton**: no single wave-1 row spans the
     * 8×8 interior of this 10×10 room, which is why *"the `empty` room never
     * seals"* stayed green against the very mutant that drops this scope (§13.6
     * B — `feedback_fixture_must_discriminate_two_builds` in one measurement).
     * The seal appears once pass 2 has **ACCUMULATED** terrain: a pool and a
     * segment later, one more segment closes the last route. That is the whole
     * reason 22 pairs move and 58 do not, and it is why the fixture for this
     * rule at `empty` is an ACCUMULATED record and not a skeleton.
     */
    const sealRefusal = (record, template, tx, ty) => {
        const painted = paintedOf(template, tx, ty);
        const blocking = [...painted.values()].filter((t) => t !== 'ground').length;
        // ⛔ A candidate that paints no blocking terrain cannot seal anything —
        // painting `ground` only ever ADDS walkable cells.
        if (blocking === 0) return null;
        const walkable = walkableWith(record, painted);
        if (connected(record.width, record.height, walkable,
            { x: d.start.tx, y: d.start.ty },
            { x: goalCell.tx, y: goalCell.ty })) return null;
        return `"${template.instance ?? template.name}" at (${tx},${ty}): its TERRAIN would `
            + `SEAL the room — no ground path from the START (${d.start.tx},${d.start.ty}) to `
            + `the GOAL (${goalCell.tx},${goalCell.ty}) once the ${blocking} `
            + 'wall/water/pit cell(s) it writes are painted. ⛔ The flood reads TERRAIN only; '
            + 'entities are the ORACLE\'s question, so a block or a lock is never a wall '
            + 'here. Refused before any solve, at EVERY skeleton kind — this room is '
            + `"${skeletonKind}", and ⚖ slice 6b dropped the carved-only scope slice 6 `
            + 'shipped (22 of the 80 committed `empty` pairs re-recorded).';
    };

    /**
     * ⛓⛓⛓ **A CELL A TEMPLATE WRITES AS `ground` — THE CARVE'S OWN FREEDOM
     * TEST** (PROCGEN ELEMENTS arc 3, slice 2; ⚖ design ruling 17, *"templates
     * may CARVE"*).
     *
     * `freeRefusal` demands untouched **`ground`**, which is exactly right for a
     * cell a template covers with a wall, a pool, a pit or an entity: the thing
     * it must not do is paint over another template's answer. A cell a template
     * writes as `ground` is the OTHER case — it is asking for room where the
     * skeleton left none — and the honest test is one word wider:
     *
     *   **UNTOUCHED SKELETON TERRAIN** — `terrainAt(record) === terrainAt(base)`.
     *
     * ⛔ `base` IS THE MODEL'S OWN SKELETON, the record the carve built, frozen
     * before this closure existed and never mutated. ⚖ THAT IS WHY THERE IS NO
     * `skeletonMask` (kickoff §3.3 proposed one): a second structure recording
     * "which cells the carve wrote" would be a second spelling of a fact the
     * skeleton record already IS, and the two would agree until the day one of
     * them was updated.
     *
     * The three claims the comparison makes, in one line each:
     *  · terrain the CARVE left, wall or ground — `===` holds;
     *  · a cell an earlier template painted (wall, water, pit) — `!==`, refused;
     *  · a cell an earlier template CARVED (base wall, record ground) — `!==`,
     *    refused, which is the case a "is it wall?" test would have let through.
     *
     * The ring, the start and the goal are refused ahead of it, by the same two
     * claims `freeRefusal` opens with — a carve into the border ring would open
     * the room, and neither endpoint is terrain a template may re-decide.
     */
    const carveCellRefusal = (record, tx, ty) => {
        if (!(tx > 0 && ty > 0 && tx < record.width - 1 && ty < record.height - 1)) {
            return `(${tx},${ty}) is not in the room's INTERIOR — the border ring is wall, so `
                + `the placeable cells are (1,1) to (${record.width - 2},${record.height - 2}). `
                + '⛔ A CARVE may not open the ring: the ring is what makes the room a room.';
        }
        const claimed = elementRefusalAt(tx, ty);
        if (claimed) return claimed;
        if (reserved.has(`${tx},${ty}`)) {
            const which = tx === d.start.tx && ty === d.start.ty ? 'START' : 'GOAL';
            return `(${tx},${ty}) is the ${which} cell, whose terrain is not a template's to `
                + 're-decide — a carve there would build a room whose refusal is about '
                + 'GEOMETRY rather than about the template.';
        }
        const here = terrainAt(record, tx, ty);
        const skel = terrainAt(base, tx, ty);
        if (here !== skel) {
            return `(${tx},${ty}) holds ${JSON.stringify(here)} where the SKELETON left `
                + `${JSON.stringify(skel)} — an earlier template already wrote it, and a `
                + 'carve is legal only on UNTOUCHED SKELETON TERRAIN (wall or ground, '
                + 'whichever the carve left). ⛔ Including another template\'s CARVE: a '
                + '"is it wall?" test would have let that one through.';
        }
        const held = record.entities.find((e) => Math.floor(e.x / TILE_SIZE) === tx
            && Math.floor(e.y / TILE_SIZE) === ty);
        if (held) {
            return `(${tx},${ty}) already holds the entity ${held.type} at (${held.x},${held.y}).`;
        }
        return null;
    };

    /**
     * ⛓⛓⛓ **THE CARVE RULE — ONE RULE, TWO CLAUSES** (D3).
     *
     * The cells a placement writes `ground` ONTO SKELETON WALL are its CARVE.
     * (A `ground` write onto skeleton ground is a no-op: the cell was already
     * floor, so the template is placing itself in a side corridor the carve made
     * and the ORACLE decides whether that room works.) A carve is legal iff:
     *
     *  (a) **DEAD END** — the carved cells form ONE 4-connected blob, and the
     *      blob has EXACTLY ONE 4-neighbour outside itself that is walkable once
     *      the placement's terrain is painted. One mouth, one edge: a leaf
     *      hanging off the room.
     *  (b) **NO SHORTCUT** — `shortestPath(start, goal)` is no shorter after the
     *      placement than before.
     *
     * ⛓ (b) IS IMPLIED BY (a) AND IS ASSERTED ANYWAY, because the two are
     * different claims and the design names both: a one-mouth blob is off every
     * path by construction (a route entering it must leave by the cell it came
     * in), so (b) can only fire if (a) ever stopped holding. ⚠ And (a) is the
     * clause that carries the weight: a tunnel joining two corridors does not
     * shorten start→goal at all when it joins a side corridor, so a build with
     * (a) dropped passes (b) and carves shortcuts nobody asked for. That
     * asymmetry is the mutant table's row (b).
     *
     * ⚠ WHEN THE PLACEMENT SEALS THE ROOM the "after" path is `null`, and this
     * rule says NOTHING: sealing is `sealRefusal`'s sentence and it is the next
     * rule asked. A rule that answered here would give the reader the wrong
     * fact about the wrong cell.
     */
    const carveRefusal = (record, template, tx, ty) => {
        const carved = [];
        for (const w of template.terrain ?? []) {
            if (w.terrain !== 'ground') continue;
            const x = tx + w.dx;
            const y = ty + w.dy;
            if (terrainAt(base, x, y) === 'wall') carved.push({ x, y, key: `${x},${y}` });
        }
        if (carved.length === 0) return null;
        const name = `"${template.instance ?? template.name}" at (${tx},${ty})`;
        const inBlob = new Set(carved.map((c) => c.key));
        // (a1) ONE blob — a flood over the carved set alone.
        const seen = new Set([carved[0].key]);
        const queue = [carved[0]];
        for (let head = 0; head < queue.length; head += 1) {
            const { x, y } = queue[head];
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const k = `${x + dx},${y + dy}`;
                if (inBlob.has(k) && !seen.has(k)) {
                    seen.add(k);
                    queue.push({ x: x + dx, y: y + dy });
                }
            }
        }
        if (seen.size !== carved.length) {
            return `${name}: its CARVE writes ${carved.length} cell(s) of skeleton wall as `
                + `ground (${carved.map((c) => `(${c.key})`).join(' ')}) in `
                + `${carved.length - seen.size + 1} separate blobs. A pocket is ONE `
                + '4-connected blob with ONE mouth; two disconnected pockets are two '
                + 'carves, and only one of them can be adjudicated by one rule.';
        }
        // (a2) EXACTLY ONE MOUTH.
        const painted = paintedOf(template, tx, ty);
        const walkable = walkableWith(record, painted);
        const mouths = new Set();
        for (const c of carved) {
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const nx = c.x + dx;
                const ny = c.y + dy;
                if (nx < 0 || ny < 0 || nx >= record.width || ny >= record.height) continue;
                const k = `${nx},${ny}`;
                if (inBlob.has(k)) continue;
                if (walkable(nx, ny)) mouths.add(k);
            }
        }
        if (mouths.size !== 1) {
            return `${name}: its CARVE (${carved.map((c) => `(${c.key})`).join(' ')}) has `
                + `${mouths.size} MOUTH(S)${mouths.size ? ` — ${[...mouths]
                    .map((k) => `(${k})`).join(' ')}` : ''}, and a template may carve only a `
                + 'DEAD END: exactly ONE 4-neighbour of the whole blob is walkable ground '
                + `once this placement is painted. ${mouths.size === 0
                    ? 'A pocket with no mouth is floor nothing can walk to.'
                    : 'A pocket with two mouths is a TUNNEL — it joins two parts of the room '
                        + 'that the skeleton kept apart, which is a change to the room\'s '
                        + 'connectivity rather than a place to stand.'}`;
        }
        // (b) NO SHORTCUT.
        const before = shortestPath(record.width, record.height,
            walkableWith(record, new Map()),
            { x: d.start.tx, y: d.start.ty }, { x: goalCell.tx, y: goalCell.ty });
        const after = shortestPath(record.width, record.height, walkable,
            { x: d.start.tx, y: d.start.ty }, { x: goalCell.tx, y: goalCell.ty });
        if (before && after && after.length < before.length) {
            return `${name}: its CARVE would SHORTEN the start→goal path from `
                + `${before.length - 1} steps to ${after.length - 1}. A pocket is somewhere `
                + 'to stand, never a route: a carve that shortens the way to the goal has '
                + 'rebuilt the skeleton pass 1 committed to.';
        }
        return null;
    };

    /**
     * ⛓⛓⛓ **THE DOOR LAW — A DOOR IS A CUT** (PROCGEN ELEMENTS arc 3, slice 2;
     * ⚖ design ruling 17, taken whole). ONE flood-based law, every kind, every
     * door family — it REPLACES `doorClear` and re-expresses `INTERIOR_SPAN`'s
     * *"must cross the whole interior to be a door"* as *"must be a CUT"*.
     *
     * A row that declares `door` names its DOOR CELLS (`doorCells` — the gap
     * cell(s) that hold the clearer, and which write no wall) and its CLEARER
     * CELLS (`clearer` — the spinner; the weigh lane's block/button/stance/slide;
     * EMPTY for `wall-gap-block`, whose block stands IN the door cell).
     *
     *  1. **CUT** — with this candidate's terrain painted AND the door cells
     *     treated as WALL, the GOAL is unreachable from the START; with them
     *     walkable, it is reachable. ⛓ THE SECOND HALF IS `sealRefusal`, WHICH
     *     IS ALREADY ASKED ONE RULE ABOVE — a candidate that reaches this line
     *     has passed it — so this function runs ONE flood and not two. ⚖ The
     *     one-of-everything law read the right way round: the second flood would
     *     not be a second SPELLING, it would be a second ASKING.
     *  2. **START-SIDE** — with the door cells walled, every clearer cell is
     *     reachable from the START.
     *
     * ── ⛓⛓ WHY CLAUSE 2 EXISTS, and why `doorClear` could not see it ──────
     *
     * Clause 2 is `doorClear`'s mechanism GENERALISED. On the open room the
     * clearer sits at across `-1` — north or west of a full-span wall, i.e. the
     * start's side by the room's fixed NW corner — so "the goal is strictly
     * beyond" IMPLIED it and the old rule needed one comparison. On a CORRIDOR
     * it implies nothing: a span-1 door's nub can be carved on the GOAL side,
     * where the spinner is a body nobody can reach until the lock it guards
     * opens. That room is not merely low-yield, it is unsolvable, and the flood
     * is what says so at anchor time.
     *
     * ⛔ AND THE OFF-DOMAIN **THROW** WENT WITH `doorClear`. That assertion
     * ("the start must be north-west of every anchor") existed because the old
     * rule read the COMPASS; this one reads the flood, so a start anywhere in
     * the room is a room this law simply answers. ⚠ Trap 255's ordering claim
     * survives it unchanged for a different reason: the footprint walk still
     * runs first, because a flood handed writes outside the rectangle would read
     * `terrainAt` past the room.
     */
    const doorRefusal = (record, template, tx, ty) => {
        if (!template.door) return null;
        const name = `"${template.instance ?? template.name}" at (${tx},${ty})`;
        const doorKeys = new Set((template.doorCells ?? [])
            .map((c) => `${tx + c.dx},${ty + c.dy}`));
        const painted = paintedOf(template, tx, ty);
        const walled = walkableWith(record, painted, doorKeys);
        const doorList = [...doorKeys].map((k) => `(${k})`).join(' ');
        if (connected(record.width, record.height, walled,
            { x: d.start.tx, y: d.start.ty }, { x: goalCell.tx, y: goalCell.ty })) {
            return `${name} declares a door, and it is NOT A CUT: with its door cell(s) `
                + `${doorList} walled, the GOAL (${goalCell.tx},${goalCell.ty}) is STILL `
                + `reachable from the START (${d.start.tx},${d.start.ty}) — so the wall is `
                + 'DECORATION rather than a door. ⛔ Nothing is gated by the clearer: the '
                + 'walk goes round, and for the kill-lock family that is a RUN ABORT (the '
                + 'walk collects the torch with the spinner still alive). ⚖ Ruling 17\'s own '
                + 'words — a non-cut is decoration. The law reads the FLOOD, not the compass.';
        }
        const reach = reachableFrom(record.width, record.height, walled,
            { x: d.start.tx, y: d.start.ty });
        for (const c of template.clearer ?? []) {
            const key = `${tx + c.dx},${ty + c.dy}`;
            if (!reach.has(key)) {
                return `${name} declares a door at ${doorList}, and its CLEARER cell (${key}) `
                    + `is on the GOAL side of it — unreachable from the START `
                    + `(${d.start.tx},${d.start.ty}) once the door cell(s) are walled. The `
                    + 'thing that OPENS the door would be a body nobody can reach until the '
                    + 'door it guards is already open, so the room has no answer. ⛓ On the '
                    + 'open room this could not happen (the lane sits one cell back on the '
                    + 'start\'s side of a full-span wall); on a corridor it is the ordinary '
                    + 'case, which is why the law asks rather than assumes.';
            }
        }
        return null;
    };

    const refusalAt = (record, template, tx, ty) => {
        /**
         * ⛓ ARC 3 SLICE 2 — a FOOTPRINT cell the template writes as `ground` is
         * adjudicated by the CARVE's freedom test rather than by `freeRefusal`.
         * ⛔ FOOTPRINT ONLY: `clearance` is the room a CLEARER needs (the S1
         * guard), which must already be walkable, so it keeps the untouched-
         * `ground` demand whatever the template writes.
         */
        const groundWrites = new Set((template.terrain ?? [])
            .filter((w) => w.terrain === 'ground').map((w) => `${w.dx},${w.dy}`));
        for (const [part, cells] of [['FOOTPRINT', template.footprint],
            ['CLEARANCE', template.clearance ?? []]]) {
            for (const c of cells) {
                const why = (part === 'FOOTPRINT' && groundWrites.has(`${c.dx},${c.dy}`))
                    ? carveCellRefusal(record, tx + c.dx, ty + c.dy)
                    : freeRefusal(record, tx + c.dx, ty + c.dy);
                if (why) {
                    return `"${template.instance ?? template.name}" anchored at (${tx},${ty}) `
                        + `needs ${part} cell ${why}`;
                }
            }
        }
        if (groundWrites.size > 0) {
            const carve = carveRefusal(record, template, tx, ty);
            if (carve) return carve;
        }
        /**
         * ⛓⛓ **THE PRE-CHECK SITS HERE**, and both neighbours decide the spot.
         *
         * AFTER the footprint/clearance walk — trap 255's law, restated: the
         * walk is what rejects an off-interior cell, and a flood handed writes
         * outside the room would read `terrainAt` past the rectangle. BEFORE
         * the DOOR LAW — that one is about a SPECIFIC template's mechanism (a
         * door that cuts nothing), and "the room no longer connects" is the
         * more general fact: a reader who moved the anchor wants to hear the
         * structural refusal first. ⛓ AND IT IS LOAD-BEARING for the door law
         * itself, which reads its own open half off this one rather than
         * flooding twice: *this candidate does not seal* IS *with the door
         * cells walkable, the goal is reachable*.
         *
         * ⛓ THERE USED TO BE A THIRD RULE HERE — `laneClear`, the arrow lane's
         * own — and it LEFT WITH ITS ONLY TEMPLATE (⚖ design ruling 9; the
         * measurement is on `procgenPalette.EXCLUDED_TEMPLATES`' `arrow-lane`
         * row). ⛔ A legality rule kept alive for no row is dead code wearing a
         * legality rule's name.
         */
        const sealed = sealRefusal(record, template, tx, ty);
        if (sealed) return sealed;
        return doorRefusal(record, template, tx, ty);
    };
    /**
     * ⛔ DERIVED, NOT RE-DERIVED — see `freeRefusal`. The conjunction and its
     * short-circuit order are `refusalAt`'s, so `anchorsFor` offers exactly the
     * cells it offered before slice 6 and the free ladder's levels cannot move.
     */
    const legalAt = (record, template, tx, ty) => refusalAt(record, template, tx, ty) === null;

    return {
        placementError: ProcgenLevelError,
        defaults: Object.freeze(d),
        /** ⛓ The kind that BUILT this room, and the block a payload carries. */
        skeletonKind,
        skeletonSpec: skeletonSpecNorm,
        /** What the carve actually ran — `null` at the open room. */
        carve: carved ? Object.freeze({ ...carved.carve }) : null,
        /**
         * ⛓⛓ THE ELEMENT BINDING'S WHOLE ANSWER (arc 3, slice 3) — the spec that
         * ran, whether a gadget is in this room, its record, and the graded
         * refusal BY NAME when one is not. ⛔ `certified` is NOT here: the model
         * cannot solve (the oracle takes the model), so certification lives on
         * `summary.elements[]` where `generateSeedlingLevel` puts it.
         */
        elements: elementInfo,
        elementSpec: elementSpecNorm,
        goalCell: Object.freeze({ ...goalCell }),
        goalOel: Object.freeze({ ...goalOel }),
        goals: Object.freeze([Object.freeze(collectGoal(goalOel.x, goalOel.y))]),
        boot: () => bootAtTile(blank, d.start.tx, d.start.ty),
        interiorCells,
        isFree,
        /**
         * ⛓⛓ THE SITE CLASSES THIS ROOM OFFERS (arc 3 slice 1) — CELL LISTS in
         * `{tx,ty}`, row-major, derived from the SKELETON once at construction.
         * `sites.branch` is a list of `{mouth, dir, length, cells}` stubs; every
         * other key is a flat cell list, and `sites.chambers` is the blob
         * decomposition `sites.chamber` flattens.
         */
        get sites() { return sitesOf(); },
        /**
         * ⛓ COUNTS ONLY — what a census, a report or (later) a payload may
         * carry. ⛔ Never the cell lists: a shipped cell list is a second copy
         * of the terrain that can go stale against it, and a reader who wants
         * the cells re-derives them from the level (arc 1's rule).
         *
         * ⛔ A GETTER for the same reason `sites` is: a model nobody asks pays
         * nothing.
         */
        get siteSummary() { return siteSummaryOf(sitesOf()); },
        /**
         * ⛓ EXPOSED SO THE DOMAIN SWEEP CAN ENUMERATE LEGAL ANCHORS WITHOUT
         * RETYPING THE RULE (GENERATE-UI slice 2). `isFree` was already on this
         * surface for the same reason; `legalAt` is the whole of `refusalAt` —
         * the footprint/carve walk, the carve rule, the seal pre-check and the
         * DOOR LAW — and a sweep that re-derived any of it would be the seventh
         * copy of a retype this arc has refused. ⛔ It is the SAME function
         * `anchorsFor` calls — not an agreeing one.
         *
         * ⛓ ARC 3 SLICE 2 RETIRED `doorClear` FROM THIS SURFACE with the rule
         * itself. It was exported so a sweep could ask the door question without
         * the rest; the door question is now two floods over the record, which
         * is not a thing a caller can usefully ask about a template ALONE, and
         * `refusalAt` answers it by name.
         */
        legalAt,
        /**
         * ⛓⛓⛓ SLICE 6's OWN MEMBER — the one a CLICKED cell is adjudicated by.
         * `legalAt` answers the loop's question (*may I put it here?*); this
         * answers the person's (*why not?*), and they are the same function
         * asked two ways. `directedAttempt` requires it whenever a directive
         * names an explicit anchor.
         */
        refusalAt,
        skeleton,
        /**
         * ⛓⛓⛓ ONE SHUFFLE, THEN THE FIRST `limit` LEGAL CELLS — the whole of
         * GENERATE-mode UI slice 3's TRACK B on this side of the seam.
         *
         * ⛔ THERE IS NO `anchorFor` ANY MORE, and its deletion is the point.
         * The loop used to take ONE anchor per candidate and revert on the
         * oracle's answer about it, so a template that would have solved three
         * cells further down the shuffle was reported unviable — measured, and
         * the measurement is in `wall-gap-block`'s own docblock (⚖ slice 2
         * §9.3: at one anchor the vertical door discharges 1–2 of 12; at every
         * legal anchor, 18–21. *The vertical door is not worse — the FIRST
         * anchor the shuffle hands it is.*) Keeping a one-anchor spelling
         * beside the bounded one would be two ways to ask the same question.
         *
         * ⛔⛔ THE DRAW COUNT DOES NOT DEPEND ON `limit`, AND THAT IS WHAT MAKES
         * DEFAULT 1 BYTE-INERT. The rng is touched exactly once — the single
         * `shuffle` of the room's interior, whose cost is the interior's size
         * and nothing else. `limit` only decides how far down THAT ALREADY-DRAWN
         * ORDER the caller is allowed to walk. So `anchorsFor(…, 1)[0]` is the
         * cell the old `anchorFor` returned, from the same stream position, and
         * the ladder's levels do not move when the bound is left at its default.
         * (The shuffle-then-first shape was chosen for this same reason in
         * slice 2 of the PoC arc — see the file docblock: a rejection sampler
         * would have made the draw count depend on how full the room is.)
         *
         * ── ⛓⛓⛓ ARC 3 SLICE 1: **THE SHUFFLED LIST IS THE TEMPLATE'S SITE
         *    CLASS**, and at the default `'any'` it is the SAME CALL ────────
         *
         * A row that declares `site: 'chamber'` is offered the chamber cells;
         * a row that declares nothing (or `'any'`) is offered
         * `interiorCells(record)` — literally the expression this line has
         * always held, so the default is byte-inert by a code path that does
         * not change rather than by a comparison that happens to pass.
         *
         * ⛔ THIS IS NOT A LEGALITY RULE (`procgenCore/sites.js`'s law): the
         * cells offered are still walked through `legalAt`, and a DIRECTED
         * placement outside the class stays legal because `refusalAt` never
         * learns a template has a site at all.
         *
         * ⚠ THE LIST'S **LENGTH AND ORDER** ARE BOTH PART OF THE LEVEL.
         * `rng.shuffle` is Fisher-Yates and spends `n - 1` draws, so a shorter
         * class shifts every draw after it and a same-length class in a
         * different order produces a different level. That is exactly why the
         * open room's ONE chamber is emitted in `interiorCells`' own row-major
         * order: it makes an area template's `chamber` declaration byte-inert
         * at `empty` and load-bearing everywhere else (⚖ arc-3 Q1).
         *
         * @returns {Array<{tx,ty}>} up to `limit` legal anchors IN SHUFFLE
         *   ORDER; `[]` when the class is empty or the whole of it refuses.
         */
        anchorsFor(record, template, rng, limit = 1) {
            if (!Number.isInteger(limit) || limit <= 0) {
                fail(`procgenSeedling: anchorsFor needs a positive integer limit, got `
                    + `${JSON.stringify(limit)}. The bound is what the trace names `
                    + '(`anchorTriesPerCandidate`), so there is no value meaning "all".');
            }
            const offered = (template.site === undefined || template.site === 'any')
                ? interiorCells(record)
                : siteCells(sitesOf(), template.site);
            const out = [];
            for (const c of rng.shuffle(offered)) {
                if (!legalAt(record, template, c.tx, c.ty)) continue;
                out.push({ tx: c.tx, ty: c.ty });
                if (out.length >= limit) break;
            }
            return out;
        },
        /**
         * ⚖ §1.2's ATOMIC PLACEMENT — tiles and entities in ONE step, so a
         * record never exists in which the obstacle is placed and its clearer
         * is not. Both halves are `procgenLevel`'s pure writers, so REVERT is
         * "keep the old record" and there is nothing to undo.
         */
        place(record, template, at) {
            let next = record;
            if ((template.terrain ?? []).length > 0) {
                next = withTerrain(next, template.terrain.map((w) => ({
                    tx: at.tx + w.dx, ty: at.ty + w.dy, terrain: w.terrain,
                })));
            }
            if ((template.entities ?? []).length > 0) {
                /**
                 * ⛓ THE GROUP SLOT, RESOLVED — see `placementGroupId` for why
                 * the anchor is the allocator, and `procgenPalette`'s
                 * `PLACEMENT_GROUP` for the defect that made the slot exist.
                 *
                 * ⛔ THE THROW IS THE WHOLE GUARD, because the failure it
                 * catches is SILENT: an unresolved sentinel reaches
                 * `levelWorld.tSetOf`, which is `intAttr(attrs, 'tset', 0)`,
                 * and `int("@placement-group")` is **0** — the shared group
                 * this slot exists to end, restored without a symptom. A
                 * template that declares no `groups` and carries the sentinel
                 * anyway is refused by `assertPalette` at module load; this is
                 * the same claim at the one place that writes the value.
                 */
                const group = template.groups ? placementGroupId(at, d.height) : null;
                /**
                 * ⛓ THE TAG IS ALLOCATED FROM THE RECORD AS IT STANDS — which
                 * already holds the goal pickup, so the goal's own tag is
                 * taken before any template can ask. `d.goalTag` is passed as
                 * `reserved` anyway: the record is the live answer and the
                 * reserved list is the DECLARED one, and a day when the goal
                 * is not in the record at this moment should not silently
                 * hand a lock the goal's flag.
                 */
                const tag = template.tags
                    ? placementTagId(next, [Number.parseInt(d.goalTag, 10)])
                    : null;
                const resolveAttrs = (attrs) => Object.fromEntries(
                    Object.entries(attrs).map(([k, v]) => {
                        if (v === PLACEMENT_GROUP) {
                            if (group === null) {
                                fail(`procgenSeedling: template "${template.name}" `
                                    + `carries the placement-group slot on "${k}" but `
                                    + 'declares no `groups`, so there is no id to '
                                    + 'resolve it to. An unresolved slot parses as '
                                    + 'group 0 — every unmarked activator in the room '
                                    + '— which is exactly the collision the slot '
                                    + 'exists to end.');
                            }
                            return [k, String(group)];
                        }
                        if (v === PLACEMENT_TAG) {
                            if (tag === null) {
                                fail(`procgenSeedling: template "${template.name}" `
                                    + `carries the placement-tag slot on "${k}" but `
                                    + 'declares no `tags`, so there is no slot to '
                                    + 'resolve it to. An unresolved tag parses as 0 — '
                                    + 'the GOAL\'s own flag — and a lock writes its tag '
                                    + 'on every open AND every close.');
                            }
                            return [k, String(tag)];
                        }
                        return [k, v];
                    }),
                );
                next = withEntities(next, template.entities.map((e) => ({
                    type: e.type,
                    ...oelAtTile(at.tx + e.dx, at.ty + e.dy),
                    ...(e.attrs ? { attrs: resolveAttrs(e.attrs) } : {}),
                })));
            }
            if (next === record) {
                fail(`procgenSeedling: template "${template.name}" wrote NOTHING — no `
                    + 'tiles and no entities. A template that changes no record is an '
                    + 'obstacle that obstructs nothing, and the loop would KEEP it '
                    + '(the room still solves) and report it as a placed obstacle.');
            }
            return next;
        },
    };
}

/**
 * THE SEEDLING ORACLE — kickoff §3.2's second injection, over `procgenOracle`.
 *
 * ⛓⛓ THE PINS ARE COMPUTED FROM THE KEPT TEMPLATES, WHICH IS WHY THE LOOP
 * PASSES THEM. `bootStaging` takes `pins` as an argument precisely so a water
 * template can add `'sound'` by ARGUMENT rather than by editing the boot
 * (slice 1 §8.7), and the union is taken over the templates a candidate
 * actually contains — including the one being tried, because the solve is of
 * the room WITH it.
 *
 * ⚠ THE STAGING IS REBUILT PER SOLVE and that is the point: ⚖ kickoff §3.1
 * step 3 says *"re-solve from scratch from the biome's boot"*. A staging
 * object reused across solves would carry whatever the last run left on it.
 */
export function seedlingOracle({ model, items = null, budget = DEFAULT_BUDGET } = {}) {
    const b = assertBudget(budget);
    const boot = model.boot();
    return {
        budget: b,
        pinsFor: (templates) => {
            const pins = new Set(['dead_frames']);
            for (const t of templates ?? []) for (const p of t.pins ?? []) pins.add(p);
            return [...pins];
        },
        solve(record, { templates = [] } = {}) {
            const pins = this.pinsFor(templates);
            const staging = bootStaging({ boot, items, pins });
            return solve(record, staging, model.goals, b,
                { name: `procgen-l${record.level}` });
        },
    };
}

/**
 * GENERATE ONE SEEDLING LEVEL — the whole seam, wired.
 *
 * ⛔ TWO STREAMS, TWO SEEDS FROM ONE. The model's room stream and the loop's
 * template stream are separate `ProcgenRng`s built from the SAME seed, so the
 * level's identity is one number and neither stream can shift the other by
 * spending a draw. (They therefore produce the same sequence — which is
 * harmless, because they are consumed for different things.)
 */
export function generateSeedlingLevel({
    seed, palette = PRE_SWORD_PALETTE, bounds, budget = DEFAULT_BUDGET, defaults,
    skeleton = DEFAULT_SKELETON, elements = DEFAULT_ELEMENTS,
} = {}) {
    let model = seedlingModel({ seed, defaults, skeleton, elements });
    let oracle = seedlingOracle({ model, items: palette.items ?? null, budget });
    /**
     * ⛓⛓⛓ **THE CERTIFICATION SOLVE — PROCGEN ELEMENTS arc 3, slice 3 (D4), AND
     * IT IS WHERE THE ARC'S DEPENDENCY IS PUBLISHED RATHER THAN HIDDEN.**
     *
     * The element is part of the SKELETON, so the solve that certifies it is the
     * one `generateLevel` runs at step 0 — *the control that must solve before
     * any template is drawn*. ⛔ It is run HERE FIRST, before `generateLevel`,
     * for one reason: the loop's step-0 failure is a THROW (*"THE SKELETON DID
     * NOT SOLVE"*), and a solver capability this arc does not have must arrive as
     * a GRADED REFUSAL with the solve's own words, not as an exception a caller
     * reads as a broken room builder.
     *
     * ⛔⛔ **TODAY IT ALWAYS REFUSES, AND THAT IS THE MEASUREMENT.** ⚖ Ruling
     * 22's chain — block on `button`(A) HOLDS `lock`(A) → the player reaches
     * `buttonroom`(B) → `lock`(B)s open → collect — needs the solver to raise a
     * SHOVE as a SUB-ORDER of reaching another obstacle's stance, and it cannot:
     * `procgenSeedlingElements.js`'s docblock and the arc-3 as-built §10 carry
     * the three gaps, the fixture arm that shows each, and the S1 work order.
     * `procgenSeedlingElementsCertify.test.js` asserts today's REFUSED verdict BY
     * NAME so S1 flips it green rather than discovering it.
     *
     * ⇒ on a refusal the level is regenerated with the element DROPPED — the
     * same draws spent, the composite not committed — so `--elements=guard`
     * yields a real level, the pass-2 ladder is comparable to the `none` arm, and
     * the GEOMETRY the census measured is carried on the certification so no
     * number is lost. ⛔ `certified` is never `true` and nothing here retries,
     * relaxes a bound or widens a catch.
     */
    let certification = null;
    if (model.elements.ran) {
        const cert = oracle.solve(model.skeleton(), { templates: [] });
        certification = Object.freeze({
            certified: cert.verdict === VERDICT.SOLVED,
            verdict: cert.verdict,
            classifiedBy: cert.classifiedBy ?? null,
            reasonText: cert.reasonText ?? null,
            ticks: cert.ticks ?? cert.ticksSpent ?? null,
            strategies: Object.freeze((cert.records ?? []).map((r) => r.strategy)),
            /** ⛓ THE LIFTED CLAIM (arc-2 §9.4, translated): a block was on
             *  `button`(A) at the tick the player FIRST entered `lock`(A)'s cell.
             *  `null` = the route never crossed the door, which is what an
             *  uncertified gadget looks like from the plan's side. */
            heldAtDoor: cert.verdict === VERDICT.SOLVED
                ? liftedClaimFrom(cert, model.elements.placed[0]) : null,
            /** ⛓ THE GEOMETRY, carried across the drop so the census survives it. */
            geometry: model.elements.placed,
            gap: cert.verdict === VERDICT.SOLVED ? null
                : 'the-solver-does-not-chain (S1: nested openers)',
        });
        if (!certification.certified) {
            model = seedlingModel({ seed, defaults, skeleton, elements, dropElement: true });
            oracle = seedlingOracle({ model, items: palette.items ?? null, budget });
        }
    }
    const out = generateLevel({ rng: rngFor(seed), model, oracle, palette, bounds });
    return {
        ...out,
        model,
        certification,
        summary: Object.freeze({
            ...out.summary,
            /**
             * ⛓ ⚖ DESIGN RULING 20's SOLVER-WORK RECORDS for the element, on the
             * key the design gives them. ⛔ Omitted entirely at `--elements=none`,
             * which is what keeps the payload byte-identical there.
             */
            ...(model.elementSpec.name === ELEMENTS_NONE ? {}
                : { elements: elementSummaryOf(model, { certification }) }),
            goalCell: model.goalCell,
            goalOel: model.goalOel,
            goalClass: model.defaults.goalClass,
            startCell: model.defaults.start,
            items: palette.items ?? null,
            /**
             * ⛓⛓ ONE OF THE TWO PIN-UNION LOOKUPS (the other is
             * `watchGenerate.keptTemplatesOf`), and since slice 2 both go
             * through `procgenPalette.instantiateKept`. A name lookup used to
             * be enough because a row WAS its geometry; under parameterization
             * the name resolves to a BASE with no `pins` at all, and two
             * private reconstructions of one instance is the second-cost-model
             * shape this arc keeps meeting.
             */
            pins: oracle.pinsFor(
                out.summary.kept.map((k) => instantiateKept(palette, k)),
            ),
        }),
    };
}

export { VERDICT };
