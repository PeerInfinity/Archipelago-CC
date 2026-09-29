/**
 * seedlingDemo/seedlingGenRoom — **A GENERATED SEEDLING ROOM, AS A PIPELINE
 * REGION** (seedling generated levels G1; `NewDocs/plans/seedling-generated-plan.md`
 * §2.2 item 1, ⚖ Q1–Q7 ruled 2026-09-23).
 *
 * The pipeline SPECIFIES a room — its size, the exits it must have, the AP
 * locations it must hold — and this module answers with a room the Seedling
 * generator built for that spec (`generateSeedlingLevel`, the one producer
 * `export-seedling-level-set.mjs` uses), doors bound to the exits, locations on
 * cells the player can reach. The registry entry `flash_seedling_gen`
 * (`flashPanel/flashSeedlingGenLibrary.js`) calls these through its install
 * seam; this module imports no engine and no registry.
 *
 *   world = {
 *     region_id, seed, size: {width, height}, record, start: {tx, ty},
 *     goalCell: {tx, ty}, generation: {…the knobs that built it},
 *     exits: Map<exit_id, {exit_id, door_id, side, exitName, targetRegion,
 *                          isBackExit, isTeleporter, kind: 'teleporter',
 *                          exit_tiles, entrance_tile, entrance_spawn}>,
 *     locations: [{id, item?, cell, tag, name?, access_rule?}],
 *     summary,
 *   }
 *
 * ── ⛓ THE MAP KEY IS THE AP EXIT NAME; THE DOOR IS `door_id` ──────────────
 *
 * The engine keys a region's exit Map by the extracted exit id — the id
 * `exits_placed` names and `stitchGrid` / `wallOffUnusedExits` /
 * `insertBackExit` address — so that is the AP exit's name, and it is the
 * caller's `exit_id` when given, else the maze's default (`exit` for one exit,
 * `exit_<i>` for several: the text adventure's rule, so a region's exit names
 * do not move with its substrate). The DOOR the exit becomes is spelled
 * `out_teleporter_<px>_<py>` (`seedlingAtlasDerivation.outExitId`'s spelling, so
 * the binding's departure arm 1 matches it) and rides `door_id` on the world and
 * `exit_id` in the sidecar, beside `exitName` = the AP name — flash_seedling's
 * T1 shape.
 *
 * ── ⛓ THE k-TH EXIT TAKES THE k-TH DOOR (T1's relabel law) ────────────────
 *
 * A Seedling door has no side. The doors are minted by the LINKER's own rule
 * (`levelSetExits.pickDoorCells`: one flood from the start with every solid
 * live, farthest first, never adjacent to another door, never the start), and
 * the k-th exit asked for takes the k-th door. An exit the ENGINE adds after
 * the core ran — sphere growth's back exit to the parent, top-down's reverse
 * exits — has no door yet; `serializeGenRoom` mints one for it from the same
 * picker, clear of every door already bound and of the location cells.
 *
 * ── ⛓ AN ARRIVAL LANDS ON THE DOOR'S APPROACH CELL ────────────────────────
 *
 * `entrance_spawn` is the flood predecessor of the door cell, in pixels — never
 * the door tile: a door the player is booted onto does not fire until they
 * step off it (trap 973's latch), and the game does not draw the player on a
 * teleporter tile (T2b U2b). Free and adjacent by construction.
 *
 * ── ⛓ LOCATION 0 IS THE GOAL CELL ────────────────────────────────────────
 *
 * The generator certifies ONE reach: its goal pickup (`torchpickup`). The first
 * AP location stands on that cell, so the certification IS "the check is
 * reachable"; the rest stand on the flood's cells nearest the start, never on a
 * door, next to one, or on the start. Each takes a tag from
 * `procgenSeedling.placementTagId` (the one writer), read against the room
 * WITHOUT its goal pickup — the assembler replaces that pickup with location 0.
 * ⛔ The record in the sidecar stays the BARE generated room (no door entities,
 * no `apitem`s): G2's assembler emits both from the sidecar's own lists.
 *
 * ⛓ The PLAY-TIME half — the payload's shape, its refusal, `deserializeWorld`,
 * the knob defaults and the door spelling — is `seedlingGenRoomPayload.js`,
 * which imports no generator, so the light registry entry can reach it.
 *
 * Headless-safe: no `node:` imports and no DOM.
 */

import { generateSeedlingLevel, placementTagId, seedlingOracle } from './procgenSeedling.js';
import { VERDICT } from './procgenOracle.js';
import {
    POST_SHIELD_PALETTE, POST_SWIM_PALETTE, PRE_SWORD_PALETTE, POST_SWORD_PALETTE,
} from './procgenPalette.js';
import { pickDoorCells } from './levelSetExits.js';
import { TILE_SIZE, buildLevelWorld, tagOf } from './levelWorld.js';
import { ROOM_TILES_MAX, ROOM_TILES_MIN } from './procgenLevel.js';
import { coreLevelRecord } from './levelSetValidator.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import {
    REQUIRE_DIRECTIVE_REFUSALS, parseElementSpec, parseItemRequireList,
} from '../procgenCore/elementSpec.js';
import { parseAreaSpec } from '../procgenCore/areaSpec.js';
import { GEN_ROOM_LOCATION_CEILING, genRoomFloorCells } from './seedlingGenCapacity.js';
import {
    GEN_ROOM_BIOME_NAMES, GEN_ROOM_DEFAULTS, GEN_ROOM_REFUSALS, GEN_ROOM_TILE_SIZE, genDoorId,
} from './seedlingGenRoomPayload.js';

export {
    GEN_ROOM_BIOME_NAMES, GEN_ROOM_DEFAULTS, GEN_ROOM_REFUSALS, GEN_ROOM_TILE_SIZE, genDoorId,
    deserializeGenRoom, genRoomRefusal, genRoomApLocationNames,
} from './seedlingGenRoomPayload.js';

/** The rule every ungated exit / location compiles to. */
const TRUE_RULE = Object.freeze({ rule: 'True_' });
const isTrueRule = (rule) => rule?.rule === 'True_';
const cloneRule = (rule) => structuredClone(rule);

/** The biomes a room can be built in — the palettes `watchGenerate.GENERATE_BIOMES` offers
 *  (S1 added `post-shield`; `GEN_ROOM_BIOME_NAMES` is the same list by name). */
export const GEN_ROOM_BIOMES = Object.freeze({ 'pre-sword': PRE_SWORD_PALETTE, 'post-sword': POST_SWORD_PALETTE,
    'post-shield': POST_SHIELD_PALETTE, 'post-swim': POST_SWIM_PALETTE });
if (Object.keys(GEN_ROOM_BIOMES).join() !== GEN_ROOM_BIOME_NAMES.join()) {
    throw new Error('seedlingGenRoom: GEN_ROOM_BIOMES and GEN_ROOM_BIOME_NAMES disagree — one list, two spellings');
}

const cellKey = (c) => `${c.tx},${c.ty}`;
const around = (c) => [[0, -1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => ({ tx: c.tx + dx, ty: c.ty + dy }));

/** Read one knob of the bag, falling back to the default; strings are trimmed. */
function knobsOf(params) {
    const bag = { ...GEN_ROOM_DEFAULTS, ...(params?.seedlingGen ?? {}) };
    return {
        biome: String(bag.biome),
        obstacleTarget: Number(bag.obstacleTarget),
        triesPerStep: Number(bag.triesPerStep),
        saturationK: Number(bag.saturationK),
        skeleton: String(bag.skeleton ?? '').trim(),
        elements: String(bag.elements ?? '').trim(),
        areas: String(bag.areas ?? '').trim(),
        fill: String(bag.fill ?? 'dense'),
        /** ⛓ S1, D4 — ONLY WHEN GIVEN: an absent (or empty) `require` adds no key,
         *  so `generation` — which spreads these knobs — is byte-identical. */
        ...(String(bag.require ?? '').trim() !== '' ? { require: String(bag.require).trim() } : {}),
    };
}

/**
 * The generator's input for one knob set. A string spec is parsed by the ONE
 * parser of its grammar and passed only when given, so an absent knob reaches
 * the generator as `undefined` — its own default, the CLI's.
 */
function generatorInput(regionId, seed, size, knobs) {
    const palette = GEN_ROOM_BIOMES[knobs.biome];
    if (!palette) {
        throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, 'biome', knobs.biome,
            `the biomes are [${Object.keys(GEN_ROOM_BIOMES).join(', ')}]`));
    }
    for (const key of ['obstacleTarget', 'triesPerStep', 'saturationK']) {
        if (!Number.isInteger(knobs[key]) || knobs[key] < 0) {
            throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, key, knobs[key], 'it must be a non-negative integer'));
        }
    }
    const parsed = (key, parse) => {
        if (knobs[key] === '') return undefined;
        try { return parse(knobs[key]); } catch (e) {
            throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, key, knobs[key], e.message));
        }
    };
    return {
        seed,
        palette,
        bounds: { obstacleTarget: knobs.obstacleTarget, triesPerStep: knobs.triesPerStep, saturationK: knobs.saturationK },
        defaults: { width: size.width, height: size.height },
        skeleton: parsed('skeleton', (v) => parseSkeleton(v, { substrate: 'seedling' })),
        elements: parsed('elements', parseElementSpec),
        areas: parsed('areas', parseAreaSpec),
        ...(knobs.fill !== 'dense' ? { fill: knobs.fill } : {}),
        /** ⛓ S1, D4 — through the CLI's ONE parser, and only when given. */
        ...(knobs.require !== undefined
            ? { require: parsed('require', parseItemRequireList) } : {}),
    };
}

/**
 * The side a side-less exit takes (the text adventure's `sideAssigner`): the
 * still-FREE sides first, then cycling — a Seedling side is only a label, so a
 * room may hold two exits on one side, and a seven-exit room is legal.
 */
function sideAssigner(requested) {
    const free = SIDES.filter((s) => !requested.some((e) => e.side === s));
    let cycle = 0;
    return () => free.shift() ?? SIDES[cycle++ % SIDES.length];
}

/** The fields `doorFields` writes — what a re-roll replaces on an exit record in place. */
const DOOR_FIELDS = Object.freeze(['door_id', 'kind', 'exit_tiles', 'entrance_tile', 'entrance_spawn']);

/** The door fields one cell contributes to an exit record. */
function doorFields(cell) {
    return {
        door_id: genDoorId(cell),
        kind: 'teleporter',
        exit_tiles: [[cell.tx, cell.ty]],
        entrance_tile: [cell.tx, cell.ty],
        // ⛓ the APPROACH cell (the flood predecessor), never the door tile
        entrance_spawn: { x: cell.from.tx * TILE_SIZE, y: cell.from.ty * TILE_SIZE },
    };
}

/**
 * ⛓ HOW MANY TIMES a room is re-rolled before it refuses — ONE budget per room,
 * whichever case asks (G2: its doors cannot be seated without sealing an
 * approach or its hazards; G5: an ENGINE-added door cannot be, or its locations
 * find too few safe cells). Measured: the registry's 8×6 drive room needs 2,
 * top-down `seedling_atlas` at 10×10 at most 4, seeds 1–8.
 */
export const GEN_ROOM_DOOR_REROLLS = 8;

/**
 * ⛓ G5 — WHICH CASE CAUSED THE LAST RE-ROLL, as `generation.rerollCause`
 * (written only when `rerolls` > 0, so a first-draw room's `generation` is
 * unchanged): the core's own doors (G2), an engine-added door (the sphere's back
 * exit, grid growth's links — re-rolled at serialize time), or the locations.
 */
export const GEN_ROOM_REROLL_CAUSES = Object.freeze({
    doors: 'doors',
    /** ⛓ S1, D4 — the draw's `require` directive was not met (see `drawRoom`). */
    require: 'require',
    engineDoors: 'engine-added door',
    locations: 'locations',
});

/**
 * ⛓ G8 — **A ROOM THE BUDGET CANNOT SEAT GROWS.** After `GEN_ROOM_DOOR_REROLLS`
 * re-rolls at a size, the room grows by this many tiles on each side (each side
 * capped at `GEN_ROOM_MAX_SIDE`) and the budget runs again there. Measured (G8 W0):
 * 2 closes the census's core refusals in fewer grows than 1.
 */
export const GEN_ROOM_GROW_STEP = 2;

/**
 * ⛓ G8 — the largest side a room grows to: the room contract's own maximum
 * (`procgenLevel.ROOM_TILES_MAX`, measured over the shipped atlas). A room the
 * budget cannot seat at this size REFUSES, naming every size it tried.
 */
export const GEN_ROOM_MAX_SIDE = ROOM_TILES_MAX;

/**
 * ⛓ G8 — THE SIZE OF ATTEMPT `a`: the room's own (`origin`) for the first
 * `GEN_ROOM_DOOR_REROLLS + 1` attempts, then grown one step per spent budget,
 * each side capped. Attempts 0…K are the pre-G8 sequence, byte for byte.
 */
export function sizeOfAttempt(origin, a) {
    const grows = Math.floor(a / (GEN_ROOM_DOOR_REROLLS + 1));
    const side = (v) => (v >= GEN_ROOM_MAX_SIDE ? v : Math.min(GEN_ROOM_MAX_SIDE, v + GEN_ROOM_GROW_STEP * grows));
    return { width: side(origin.width), height: side(origin.height) };
}

/** ⛓ G8 — the LAST attempt of a room of size `origin`: the whole budget spent at the capped size. */
export function lastAttempt(origin) {
    const short = Math.max(0, GEN_ROOM_MAX_SIDE - Math.min(origin.width, origin.height));
    return (Math.ceil(short / GEN_ROOM_GROW_STEP) + 1) * (GEN_ROOM_DOOR_REROLLS + 1) - 1;
}

/**
 * ⛓ G8 — CAN A ROOM OF `size` HOLD `demand` CELLS AT ALL? Its interior (the
 * border is wall by construction) less the start. A size that cannot is SKIPPED
 * without a draw: no draw there could seat them, so the first attempt that
 * builds is unchanged, and a demand no size up to the cap holds refuses at once
 * instead of generating every size (measured G8 W0: a 30×30 room ≈ 15 s).
 */
export function roomCanHold(size, demand) {
    // ⛓ G9 — the count is the declaration's (`seedlingGenCapacity.genRoomFloorCells`), so the two cannot drift.
    return demand <= genRoomFloorCells(size);
}

/**
 * A size the room contract allows — only such a size is ever SKIPPED; one
 * outside it is drawn, so the generator refuses it in its own sentence (a bad
 * size is the caller's, and no growth rescues it).
 */
const inContract = (z) => [z.width, z.height].every((v) => Number.isInteger(v) && v >= ROOM_TILES_MIN && v <= ROOM_TILES_MAX);

/** The error of an attempt skipped by `roomCanHold`, in `pickDoorCells`' words. */
const cannotHold = (regionId, size, demand) => new Error(`levelSetExits: room '${regionId}' needs ${demand} cell(s) `
    + `for its doors and locations, more than a ${size.width}x${size.height} room's interior holds`);

/** ⛓ G8 — every size a room tried from attempt `from` to `to` (inclusive), in order, each once. */
export function sizesTried(origin, to, from = 0) {
    const seen = [];
    for (let a = from; a <= to; a += 1) {
        const { width, height } = sizeOfAttempt(origin, a);
        if (!seen.some((z) => z.width === width && z.height === height)) seen.push({ width, height });
    }
    return seen;
}

/** The sizes a refusal names, and the budget spent at each. */
const grownRefusal = (origin, to) => ({
    sizes: sizesTried(origin, to).map((z) => `${z.width}x${z.height}`),
    step: GEN_ROOM_GROW_STEP,
    max: GEN_ROOM_MAX_SIDE,
    budget: GEN_ROOM_DOOR_REROLLS,
});

/**
 * The room seed of attempt `k`: the drawn seed itself at 0, then a fixed integer
 * hash of (drawn, k) — never 0 (Seedling refuses seed 0), never the engine's rng.
 */
export function rerollSeed(drawn, k) {
    if (k === 0) return drawn;
    return (((Math.imul(drawn, 2654435761) + Math.imul(k, 40503)) >>> 1) % 0x7fffffff) || 1;
}

/**
 * ⛓ DOES THE GOAL STILL CERTIFY WITH THE DOORS AS WALLS? One solve of the
 * generator's own oracle over a COPY of the room whose door tiles are the room's
 * wall tile (its corner — the border is wall by construction, never a typed id).
 * `true`, or the solve's verdict as a string.
 */
export function goalHoldsWithDoorsAsWalls(out, doors, items) {
    const doorKeys = new Set(doors.map((d) => cellKey(d)));
    const layers = out.record.layers.map((layer) => {
        if (!Array.isArray(layer.tiles)) return layer;
        const wall = layer.tiles.find(([tx, ty]) => tx === 0 && ty === 0)?.[2];
        return { ...layer, tiles: layer.tiles.map((t) => (doorKeys.has(cellKey({ tx: t[0], ty: t[1] }))
            ? [t[0], t[1], wall, ...t.slice(3)] : t)) };
    });
    const cert = seedlingOracle({ model: out.model, items }).solve({ ...out.record, layers });
    return cert.verdict === VERDICT.SOLVED ? true : String(cert.verdict);
}

/**
 * ⛓ G2 — THE CELLS NO PLAYER SURVIVES STANDING ON: water and lava (lethal
 * without the conch / the dark suit — `lethalTerrainTiles`) and pits. They are
 * not SOLID, so the flood walks them; MEASURED on the box (seedling generated G2):
 * a walk through a pit cell respawned the player at the checkpoint, and G1's
 * `region_0_1` had door 1 AND its approach on water — an arrival there drowns and
 * respawns onto the same cell. So no door, approach or location stands on one,
 * and the seal flood treats them as walls.
 *
 * ⛓⛓ SWIM T1 — **BOOT-AWARE.** With `items` (the biome's boot inventory,
 * `GEN_ROOM_BIOMES[biome].items`) water is NOT a hazard when `items.canSwim` and
 * lava is not when `items.hasDarkSuit` — the planner's own arm
 * (`botDriverV2.js`, `lethalSafe`); pits always are. Without it a `post-swim`
 * room's `watergate` sealed its goal off on every draw (S1's residue: 83
 * re-rolls, grown 10×10 → 28×28; T1's W0 draw: 173, grown to 48×48). No other biome grants either, so every other
 * room reads the set it always read.
 *
 * ⛔ The boot-aware set is for the SEAL floods only (may the goal, a location, be
 * reached). A door, its approach and a location never STAND on a lethal cell:
 * those read the item-less set (`hazardCells(record)`), because an arrival lands
 * with whatever the player holds, not with the biome's boot.
 */
export function hazardCells(record, items = null) {
    const world = buildLevelWorld(record);
    const lethal = world.lethalTerrainTiles.filter((t) => !((t.t === WATER_TILE && items?.canSwim)
        || (t.t === LAVA_TILE && items?.hasDarkSuit)));
    return new Set([...lethal, ...world.pitTiles]
        .map((t) => cellKey({ tx: Math.floor(t.x / TILE_SIZE), ty: Math.floor(t.y / TILE_SIZE) })));
}

/** ⛓ SWIM T1 — the tile types `lethalTerrainTiles` carries (`levelWorld.js` WATER_STATE / LAVA_STATE). */
const WATER_TILE = 1;
const LAVA_TILE = 17;

/** The boot inventory of a room's biome (`generation.biome`), or null. */
const bootItems = (biome) => GEN_ROOM_BIOMES[biome]?.items ?? null;

/**
 * The cells reachable from the start with every door and every hazard (boot-aware,
 * SWIM T1) a wall — never a lethal cell itself (a location does not stand on one).
 */
function safeReach(world) {
    const { flood } = pickDoorCells(world.record, world.start, 0, { room: `'${world.region_id}'` });
    const lethal = hazardCells(world.record);
    const wall = hazardCells(world.record, bootItems(world.generation?.biome));
    for (const e of world.exits.values()) for (const [tx, ty] of e.exit_tiles ?? []) wall.add(cellKey({ tx, ty }));
    const seen = new Set([cellKey(world.start)]);
    const queue = [world.start];
    for (let i = 0; i < queue.length; i += 1) {
        for (const n of around(queue[i])) {
            if (seen.has(cellKey(n)) || wall.has(cellKey(n)) || !flood.has(cellKey(n))) continue;
            seen.add(cellKey(n));
            queue.push(n);
        }
    }
    for (const key of lethal) seen.delete(key);
    return seen;
}

/** The goal cell's neighbours: no door may stand there (the approach would be the check). */
function goalGuard(goalCell) {
    return new Set(around(goalCell).map(cellKey));
}

/**
 * ⛓ THE CORE'S DOORS for one draw (G2), `pickDoorCells`' doors or its
 * `LevelSetExitError`. ⛓ SWIM T1: the goal is kept reachable WITH the boot
 * `items` (a swimmer crosses the watergate); a door stays off every lethal cell
 * and its approach is reached from the start WITHOUT crossing one
 * (`hazardCells`' ⛔) — so an arrival lands on the start's side of the gate.
 */
export function pickGenRoomDoors(record, start, goalCell, doorCount, items, room = '?') {
    const lethal = hazardCells(record);
    const hazards = hazardCells(record, items);
    return pickDoorCells(record, start, doorCount, {
        room, exclude: new Set([...goalGuard(goalCell), ...lethal]),
        keepReachable: { walls: hazards, approachWalls: lethal, cells: [goalCell] },
    }).doors;
}

/**
 * ⛓ ONE DRAW of the room: the generator's record for attempt `k`'s seed, with
 * `doorCount` doors seated unsealed and the goal re-certified with them as walls.
 * `{seed, out, record, start, goalCell, doors}`, plus `err` when the draw cannot
 * seat them (then `doors` is absent). A generator refusal THROWS (no re-roll
 * rescues a bad knob).
 */
function drawRoom(regionId, drawn, k, size, knobs, doorCount) {
    const seed = rerollSeed(drawn, k);
    let out;
    try {
        out = generateSeedlingLevel(generatorInput(regionId, seed, size, knobs));
    } catch (e) {
        if (e.message.startsWith('generated Seedling room')) throw e;
        throw new Error(GEN_ROOM_REFUSALS.generator(regionId, seed, size, e.message));
    }
    const record = coreLevelRecord(out.record);
    /**
     * ⛓⛓ S1, D4 — A DIRECTIVE THIS DRAW DID NOT MEET IS A RE-ROLL, like a door
     * that would not seat: the room the preset asked for is one the differential
     * grades REQUIRED, and a draw that is not is not that room. ⛔ Marked
     * `requireUnmet` so the caller can bound it and name it (a directive that
     * can never be met must not spin through every size the room could grow to).
     */
    /** ⛔ A directive refused at RESOLUTION (an item no element needs, a biome
     *  that lacks it, …) is the KNOB's fault on every draw — refused at once,
     *  never re-rolled (`elementSpec.REQUIRE_DIRECTIVE_REFUSALS`). */
    if (out.require && REQUIRE_DIRECTIVE_REFUSALS.includes(out.require.refused?.reason)) {
        throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, 'require', knobs.require,
            `${out.require.refused.reason}: ${out.require.refused.detail}`));
    }
    if (out.require && out.require.met !== true) {
        const why = `${out.require.refused?.reason ?? 'not met'}`;
        const err = new Error(`seedlingGenRoom: room '${regionId}' seed ${seed}: require `
            + `[${knobs.require}] not met — ${why}`);
        err.requireUnmet = why;
        return { seed, out, record, err };
    }
    const start = { ...out.summary.startCell };
    const goalCell = { ...out.summary.goalCell };
    let doors;
    try {
        doors = pickGenRoomDoors(record, start, goalCell, doorCount, bootItems(knobs.biome), `'${regionId}'`);
    } catch (e) {
        if (e.name !== 'LevelSetExitError') throw e;
        return { seed, out, record, start, goalCell, err: e };
    }
    // ⛓ G2 (⚖ planner): the flood check ignores a goal past a solid the solver
    //   clears, so the GOAL is re-certified with the doors as WALLS — one solve.
    const unsealed = goalHoldsWithDoorsAsWalls(out, doors, bootItems(knobs.biome));
    if (unsealed !== true) {
        return { seed, out, record, start, goalCell, err: new Error(`levelSetExits: room '${regionId}' seats its `
            + `${doorCount} door(s), but with them as walls the generator's own solver no longer reaches the goal `
            + `(${unsealed})`) };
    }
    return { seed, out, record, start, goalCell, doors };
}

/**
 * `generation` after attempt `k` — `rerollCause` only when the room was re-rolled,
 * `grownFrom` (the size the pipeline asked for) only when it GREW (G8).
 */
const generationAfter = (knobs, k, cause, origin = null, size = null) => ({
    ...knobs, rerolls: k, ...(k > 0 ? { rerollCause: cause } : {}),
    ...(origin && size && (size.width !== origin.width || size.height !== origin.height)
        ? { grownFrom: { width: origin.width, height: origin.height } } : {}),
});

/** The size a room was ASKED for: its `grownFrom` when it grew, else its own. */
const originOf = (world) => world.generation?.grownFrom ?? world.size;

/**
 * `generateRegionCore` — the room: the generator's record for a seed drawn from
 * the engine's rng (Seedling refuses seed 0, so `|| 1`, as
 * `generateRegionZoneGen` derives one), one door per requested exit, no location
 * yet. `entrances`, the libraries and `biome` are accepted and IGNORED.
 */
export function generateGenRoom(input = {}) {
    const { region_id: regionId, exits = [], size = { width: 10, height: 10 }, rng, params } = input;
    if (!regionId) throw new Error(GEN_ROOM_REFUSALS.noRegionId());
    const drawn = ((rng.next() * 0x7fffffff) | 0) || 1;
    const knobs = knobsOf(params);
    let draw; let rerolls = 0;
    // ⛓ G2 (⚖ planner): a room that cannot seat its doors UNSEALED is re-rolled —
    //   `rerollSeed(drawn, k)`, no engine rng consumed, so a room that seats on the
    //   first draw is byte-unchanged and no other region moves.
    // ⛓ G8: after the budget at a size, the room GROWS (`sizeOfAttempt`) and the
    //   same sequence runs on — still inside this one core call, never short.
    const last = lastAttempt(size);
    let cause = GEN_ROOM_REROLL_CAUSES.doors;
    for (let k = 0; k <= last; k += 1) {
        const at = sizeOfAttempt(size, k);
        draw = roomCanHold(at, exits.length) || !inContract(at)
            ? drawRoom(regionId, drawn, k, at, knobs, exits.length)
            : { seed: rerollSeed(drawn, k), record: at, err: cannotHold(regionId, at, exits.length) };
        if (!draw.err) { rerolls = k; break; }
        /** ⛓ S1, D4 — a `require` gets the per-size budget and no growth (a bigger
         *  room is not a likelier sword gate), then it is refused BY NAME. */
        cause = draw.err.requireUnmet ? GEN_ROOM_REROLL_CAUSES.require : GEN_ROOM_REROLL_CAUSES.doors;
        if (draw.err.requireUnmet && k >= GEN_ROOM_DOOR_REROLLS) {
            throw new Error(GEN_ROOM_REFUSALS.requireNotMet(regionId, draw.seed, draw.record, knobs.require,
                GEN_ROOM_DOOR_REROLLS, draw.err.requireUnmet));
        }
    }
    if (draw.err) {
        throw new Error(GEN_ROOM_REFUSALS.tooManyDoors(regionId, draw.seed, draw.record, exits.length, draw.err.message,
            grownRefusal(size, last)));
    }
    const { seed, out, record, start, goalCell, doors } = draw;
    const nextSide = sideAssigner(exits);
    const defaultExitId = (i) => (exits.length === 1 ? 'exit' : `exit_${i}`);
    const roomExits = new Map();
    exits.forEach((e, k) => {
        const exitId = e.exit_id ?? defaultExitId(k);
        if (roomExits.has(exitId)) throw new Error(GEN_ROOM_REFUSALS.duplicateExit(regionId, exitId));
        roomExits.set(exitId, {
            exit_id: exitId,
            ...doorFields(doors[k]),
            side: e.side ?? nextSide(),
            exitName: e.exitName ?? exitId,
            targetRegion: e.targetRegion ?? null,
            isBackExit: false,
            isTeleporter: false,
        });
    });
    return {
        world: {
            region_id: regionId,
            seed,
            size: { width: record.width, height: record.height },
            record,
            start,
            goalCell,
            // ⛓ `rerolls`: how many re-rolls it took (0 = the first draw) — `seed` is the one used.
            generation: generationAfter(knobs, rerolls, cause, size, record),
            // ⛓ G5: the drawn seed, so a later re-roll (a location the room cannot
            //   seat, an engine-added door) continues THIS room's sequence. Never serialized.
            drawnSeed: drawn,
            exits: roomExits,
            locations: [],
            summary: { stop: out.summary.stop ?? null, keptCount: out.summary.keptCount ?? null },
        },
        exits_placed: [...roomExits.values()].map(({ exit_id: exitId, side }) => ({ exit_id: exitId, side })),
    };
}

/** The cells a location may take, nearest the start first (flood order). */
function locationCells(world) {
    const { flood, taken } = pickDoorCells(world.record, world.start, 0, { room: `'${world.region_id}'` });
    const blocked = new Set(taken);
    for (const e of world.exits.values()) {
        for (const [tx, ty] of e.exit_tiles ?? []) {
            blocked.add(cellKey({ tx, ty }));
            for (const n of around({ tx, ty })) blocked.add(cellKey(n));
        }
    }
    for (const l of world.locations) blocked.add(cellKey(l.cell));
    // ⛓ G2: only cells the player reaches SAFELY — no hazard, no door crossed on the way.
    const safe = safeReach(world);
    return [...flood.values()].filter((c) => !blocked.has(cellKey(c)) && safe.has(cellKey(c)))
        .map((c) => ({ tx: c.tx, ty: c.ty }));
}

/** The record the tags are allocated against: the room without its goal pickup. */
function recordWithoutGoal(world) {
    const gx = world.goalCell.tx * TILE_SIZE;
    const gy = world.goalCell.ty * TILE_SIZE;
    return { ...world.record, entities: (world.record.entities ?? []).filter((e) => !(e.x === gx && e.y === gy)) };
}

/**
 * ⛓ G9 — the persistence tags a location may still take in this room: the
 * level's `TAGS_PER_LEVEL`, less every tag the room WITHOUT its goal pickup
 * uses (its own elements'), less the locations already seated. Location 0 takes
 * the goal's own tag, which is why the goal is left out.
 */
function freeTags(world) {
    const used = new Set(world.locations.map((l) => l.tag));
    for (const e of recordWithoutGoal(world).entities ?? []) {
        const t = tagOf(e.type, e.attrs);
        if (t >= 0) used.add(t);
    }
    return GEN_ROOM_LOCATION_CEILING - used.size;
}

/**
 * The cells `rows` would take — `short` when the room has too few cells, OR
 * (G9) too few free persistence tags: a draw whose own elements spend the tags
 * the rows need is re-rolled exactly like one without the floor for them.
 */
function seatsFor(world, rows) {
    const free = world.locations.length === 0 ? [world.goalCell] : [];
    free.push(...locationCells(world));
    const tags = freeTags(world);
    if (rows.length > tags) return { short: true, free, tags };
    return rows.length > free.length ? { short: true, free } : { free };
}

/** The sentence of a room that cannot seat `rows` beside what it holds — short of TAGS (G9) or of cells. */
function locationsRefusal(world, rows, seats, grown = null) {
    const want = world.locations.length + rows.length;
    if (seats.tags !== undefined) {
        return GEN_ROOM_REFUSALS.tooFewTags(world.region_id, want, world.locations.length + seats.tags,
            GEN_ROOM_LOCATION_CEILING, grown);
    }
    return GEN_ROOM_REFUSALS.tooManyLocations(world.region_id, want,
        [...world.locations.map((l) => l.cell), ...seats.free].map((c) => `(${c.tx},${c.ty})`), grown);
}

/** A placed location as the row it was placed from: its cell and tag are the room's, re-derived on a re-roll. */
const rowOf = ({ cell: _cell, tag: _tag, ...row }) => row;

/**
 * ⛓⛓ G5 — **THE ROOM RE-ROLLED, THE AP LOGIC KEPT** (⚖ planner 2026-09-26: one
 * function for both cases, one counter, one budget, no engine rng). The next
 * draws of THIS room's sequence (`rerollSeed(drawnSeed, k)`, k after the last
 * one used — growing past each spent budget, G8 — up to `lastAttempt`) until one seats a door for EVERY exit
 * in `entries` (the k-th exit the k-th door, re-certified with them all as walls)
 * AND every location in `rows` (the first on the goal cell). What moves: `seed`,
 * `record`, `start`, `goalCell`, the doors' cells and every location's cell and
 * tag. What never does: the exit keys, ids, AP names and rules, the location ids,
 * items, names and rules — so the rules the engine extracted from the room (no
 * cell in them) stay true. G8: the room's `size` moves when it grows, and
 * `generation.grownFrom` keeps the size it was asked for. `{room, bound}` (a NEW
 * world and its exits bound to doors, the argument untouched), or `{err, grown}`
 * after the last attempt (`grown`: the sizes tried, for the refusal).
 */
export function rerollGenRoom(world, entries, rows, cause) {
    const knobs = knobsOf({ seedlingGen: world.generation });
    const origin = originOf(world);
    const last = lastAttempt(origin);
    let err = null;
    for (let k = (world.generation?.rerolls ?? 0) + 1; k <= last; k += 1) {
        const at = sizeOfAttempt(origin, k);
        if (inContract(at) && !roomCanHold(at, entries.length + rows.length)) {
            err = cannotHold(world.region_id, at, entries.length + rows.length);
            continue;
        }
        const draw = drawRoom(world.region_id, world.drawnSeed, k, at, knobs, entries.length);
        if (draw.err) { err = draw.err; continue; }
        const bound = entries.map(([key, e], i) => [key, { ...e, ...doorFields(draw.doors[i]) }]);
        const size = { width: draw.record.width, height: draw.record.height };
        const room = {
            ...world,
            seed: draw.seed,
            size,
            record: draw.record,
            start: draw.start,
            goalCell: draw.goalCell,
            generation: generationAfter(knobs, k, cause, origin, size),
            exits: new Map(bound),
            locations: [],
            summary: { stop: draw.out.summary.stop ?? null, keptCount: draw.out.summary.keptCount ?? null },
        };
        const seats = seatsFor(room, rows);
        if (seats.short) { err = new Error(locationsRefusal(room, rows, seats)); continue; }
        seatRows(room, rows, seats.free);
        return { room, bound };
    }
    return { grown: grownRefusal(origin, last), err: err ?? new Error(`levelSetExits: room '${world.region_id}' has `
        + `no re-roll left (${last} used)`) };
}

/**
 * Put `ids` (with their items and rules) into the room: the first on the goal
 * cell (if the room holds none yet), the rest on free flood cells nearest the
 * start. ⛓ G5: a room with too few cells is RE-ROLLED in place (`rerollGenRoom` —
 * the engine's world object keeps its identity and its exit records theirs),
 * and refused by name when no draw seats them at any size up to the cap (G8) —
 * never returned short, so the engine's own retry-then-grow loop is never entered.
 */
function addLocations(world, rows) {
    // ⛓ G9 — past the level's tag budget no draw at any size seats them: refused by
    //   name at once, never re-rolled or grown (the entry's declared ceiling).
    const want = world.locations.length + rows.length;
    if (want > GEN_ROOM_LOCATION_CEILING) {
        throw new Error(GEN_ROOM_REFUSALS.tagBudget(world.region_id ?? '?', want, GEN_ROOM_LOCATION_CEILING));
    }
    const seats = seatsFor(world, rows);
    if (!seats.short) { seatRows(world, rows, seats.free); return; }
    if (!Number.isInteger(world.drawnSeed)) throw new Error(locationsRefusal(world, rows, seats));
    const all = [...world.locations.map(rowOf), ...rows];
    const { room, bound, err, grown } = rerollGenRoom(world, [...world.exits.entries()], all,
        GEN_ROOM_REROLL_CAUSES.locations);
    if (err) throw new Error(locationsRefusal(world, rows, seats, grown));
    // ⛓ G8: `size` too — a room that grew is the engine's world at its new size.
    for (const key of ['seed', 'size', 'record', 'start', 'goalCell', 'generation', 'summary']) world[key] = room[key];
    for (const [key, e] of bound) {
        const record = world.exits.get(key);
        for (const field of DOOR_FIELDS) record[field] = e[field];
    }
    world.locations = room.locations;
}

/** Seat `rows` on `free` (in order), each with a fresh tag. */
function seatRows(world, rows, free) {
    const bare = recordWithoutGoal(world);
    const reserved = world.locations.map((l) => l.tag);
    rows.forEach((row, k) => {
        const tag = placementTagId(bare, reserved);
        reserved.push(tag);
        world.locations.push({ ...row, cell: { ...free[k] }, tag });
    });
}

/**
 * `placeFromItems` — the spiral / grid-growth placer: each item becomes a
 * location holding it, named the maze's way (`<item>_pickup`, then `_2`, `_3`…).
 * ⚠ A room places NO obstacle — a maze key/door pair has no geometry here — so
 * every `obstacles_to_place` entry is reported unplaced by omission (the text
 * adventure's law; the caller's pool keeps it).
 */
export function placeGenItems(world, input = {}) {
    const { items_to_place: items = [] } = input;
    const taken = new Set(world.locations.map((l) => l.id));
    const rows = [];
    const placed = [];
    for (const itemId of items) {
        let id = `${itemId}_pickup`;
        for (let n = 2; taken.has(id); n++) id = `${itemId}_pickup_${n}`;
        taken.add(id);
        rows.push({ id, item: itemId });
        placed.push({ item_id: itemId, location_id: id });
    }
    addLocations(world, rows);
    return { placed_items: placed, placed_obstacles: [] };
}

/**
 * `placeFromRules` — the sphere / top-down placer: every exit rule is RECORDED
 * on its exit (`True_` as absent), and every location — ruled first, then
 * item-only, the maze's order — is placed with its item and rule. No location
 * reports a tile position, so the engine matches them by id; a room that cannot
 * hold them all REFUSES (it never skips one, so the engine's retry loop never
 * re-rolls it).
 */
export function placeGenRules(world, input = {}) {
    const { exit_rules: exitRules = {}, location_rules: locationRules = {}, item_placements: placements = [] } = input;
    for (const [exitId, rule] of Object.entries(exitRules)) {
        const exit = world.exits.get(exitId);
        if (!exit) throw new Error(GEN_ROOM_REFUSALS.unknownExit(world.region_id ?? '?', exitId));
        if (isTrueRule(rule)) delete exit.access_rule;
        else exit.access_rule = cloneRule(rule);
    }
    const itemByLocation = Object.fromEntries(placements.map((p) => [p.location_id, p.item_id]));
    const order = [...new Set([...Object.keys(locationRules), ...placements.map((p) => p.location_id)])];
    const rows = order.map((id) => {
        const rule = locationRules[id];
        return {
            id,
            ...(itemByLocation[id] != null ? { item: itemByLocation[id] } : {}),
            ...(rule && !isTrueRule(rule) ? { access_rule: cloneRule(rule) } : {}),
        };
    });
    addLocations(world, rows);
    return {
        placed_logic_gates: [],
        placed_items: rows.filter((r) => r.item != null).map((r) => ({ item_id: r.item, location_id: r.id })),
        placed_locations: rows.map((r) => ({ location_id: r.id })),
    };
}

/**
 * `extractPathsAndObstacles` — the room's rules, straight off the room: each
 * exit (by its MAP KEY, the AP name) and location with its recorded rule,
 * `True_` where none. A location that carries its AP `name` hands it on as
 * `global_name`, so a rebuild compiles the document's own name.
 */
export function extractGenRules(world, opts = {}) {
    const entries = world.exits instanceof Map ? [...world.exits.entries()]
        : (world.exits ?? []).map((e) => [e.exitName ?? e.exit_id, e]);
    return {
        region_id: opts.regionId ?? world.region_id ?? 'seedling_gen_room',
        exits: entries.map(([key, e]) => ({
            id: key,
            target_region: e.targetRegion ?? null,
            access_rule: cloneRule(e.access_rule ?? TRUE_RULE),
        })),
        locations: world.locations.map((l) => ({
            id: l.id,
            item: l.item ?? null,
            access_rule: cloneRule(l.access_rule ?? TRUE_RULE),
            ...(l.name ? { global_name: l.name } : {}),
        })),
    };
}

/**
 * Bind a door to every exit that has none (an exit the engine added after the
 * core ran), in exit order, clear of the doors already bound and their
 * neighbours, of the goal's neighbours, and of every location cell and its
 * neighbours. Returns `{bound}` — `[key, record-with-door]` pairs — or
 * `{unseated, err}` when the room as built has no unsealing cell for them; the
 * world is untouched.
 */
function bindAllDoors(world, entries) {
    const unbound = entries.filter(([, e]) => !Array.isArray(e.exit_tiles));
    if (unbound.length === 0) return { bound: entries };
    const exclude = goalGuard(world.goalCell);
    const guard = (c) => { exclude.add(cellKey(c)); for (const n of around(c)) exclude.add(cellKey(n)); };
    for (const [, e] of entries) for (const [tx, ty] of e.exit_tiles ?? []) guard({ tx, ty });
    for (const l of world.locations) guard(l.cell);
    // ⛓ G2: the doors already bound are WALLS, and their approaches, the goal and
    //   every location stay reachable from the start (`keepReachable`).
    const bound = entries.filter(([, e]) => Array.isArray(e.exit_tiles));
    // ⛓ SWIM T1: as `drawRoom` — boot-aware seal walls, item-less cells to stand on.
    const lethal = hazardCells(world.record);
    const hazards = hazardCells(world.record, bootItems(world.generation?.biome));
    for (const h of lethal) exclude.add(h);
    const doorWalls = bound.flatMap(([, e]) => e.exit_tiles.map(([tx, ty]) => cellKey({ tx, ty })));
    const walls = new Set([...hazards, ...doorWalls]);
    const keepReachable = {
        walls,
        approachWalls: new Set([...lethal, ...doorWalls]),
        cells: [world.goalCell, ...world.locations.map((l) => l.cell),
            ...bound.map(([, e]) => ({ tx: e.entrance_spawn.x / TILE_SIZE, ty: e.entrance_spawn.y / TILE_SIZE }))],
    };
    const pick = (ex) => pickDoorCells(world.record, world.start, unbound.length, {
        room: `'${world.region_id ?? '?'}'`, exclude: ex, keepReachable,
    });
    /**
     * ⛓ G2: first in the room AS BUILT (its locations placed). When the neighbour
     * guards leave no unsealing cell, the second try keeps only the cells
     * themselves (goal, locations, doors): `keepReachable` already rejects a door
     * whose approach is a door or that seals one, which is what the guards were
     * for. Neither → `null` and the reason: the caller re-rolls the room (G5).
     */
    let doors;
    try {
        ({ doors } = pick(exclude));
    } catch (first) {
        if (first.name !== 'LevelSetExitError') throw first;
        try {
            ({ doors } = pick(new Set([cellKey(world.goalCell), ...world.locations.map((l) => cellKey(l.cell)), ...walls, ...lethal])));
        } catch (e) {
            if (e.name !== 'LevelSetExitError') throw e;
            return { unseated: unbound.length, err: e };
        }
    }
    const fresh = new Map(unbound.map(([key], k) => [key, doors[k]]));
    return { bound: entries.map(([key, e]) => (fresh.has(key) ? [key, { ...e, ...doorFields(fresh.get(key)) }] : [key, e])) };
}

/**
 * ⛓⛓ G5 case 1 — **AN ENGINE-ADDED DOOR THE ROOM CANNOT SEAT RE-ROLLS THE ROOM**
 * (⚖ planner 2026-09-26, design (i): measured at W0, grid growth adds 0–2 such
 * doors per room and walls off core exits, so no reserved count is right). The
 * room as built first (`bindAllDoors` — every world that seats there is
 * byte-unchanged); else `rerollGenRoom` over the FINAL exit list, every door
 * re-seated and every location re-placed. A world with no drawn seed (a
 * deserialized payload) cannot re-roll and refuses as before.
 */
function bindOrReroll(world, entries) {
    const first = bindAllDoors(world, entries);
    if (first.bound) return { room: world, bound: first.bound };
    const refuse = (grown, err) => new Error(GEN_ROOM_REFUSALS.engineDoors(world.region_id ?? '?', world.seed,
        world.size, entries.length, first.unseated, grown, err.message));
    if (!Number.isInteger(world.drawnSeed)) {
        throw new Error(GEN_ROOM_REFUSALS.tooManyDoors(world.region_id ?? '?', world.seed, world.size,
            entries.length, first.err.message));
    }
    const rows = world.locations.map(rowOf);
    const bare = entries.map(([key, e]) => [key, Object.fromEntries(Object.entries(e)
        .filter(([field]) => !DOOR_FIELDS.includes(field)))]);
    const again = rerollGenRoom(world, bare, rows, GEN_ROOM_REROLL_CAUSES.engineDoors);
    if (again.err) throw refuse(again.grown, again.err);
    return again;
}

/**
 * `serializeWorld` — the room → its sidecar payload. The engine's exits (core
 * and engine-added, Map order) joined onto their doors: the payload's `exit_id`
 * is the DOOR, `exitName` the AP name, `external: true` with `target_level` /
 * `target_spawn` null (the far side is the world's, resolved at assembly) and
 * `target_substrate` from the 5th argument. `level` is the region's ordinal
 * among this substrate's regions (`context.ordinalOfRegion`), else the world's
 * own (a deserialized room), else null. A clone: nothing of the world is shared.
 */
export function serializeGenRoom(world, extractedRules, _obstacleLib, _itemLib, context) {
    const extractedExits = new Map((extractedRules?.exits ?? []).map((e) => [e.id, e]));
    const extractedLocations = new Map((extractedRules?.locations ?? []).map((l) => [l.id, l]));
    const entries = world.exits instanceof Map ? [...world.exits.entries()]
        : (world.exits ?? []).map((e) => [e.exitName ?? e.exit_id, e]);
    const exits = [];
    const exitGates = {};
    // ⛓ G5: `room` is the world, or its re-roll when an engine-added door could not be seated.
    const { room, bound } = bindOrReroll(world, entries);
    for (const [key, e] of bound) {
        const ext = extractedExits.get(key);
        exits.push({
            exit_id: e.door_id ?? e.exit_id,
            kind: e.kind,
            side: e.side ?? null,
            exit_tiles: structuredClone(e.exit_tiles),
            entrance_tile: [...e.entrance_tile],
            entrance_spawn: { ...e.entrance_spawn },
            exitName: key,
            targetRegion: ext?.target_region ?? e.targetRegion ?? null,
            targetExitId: e.targetExitId ?? null,
            isTeleporter: !!e.isTeleporter,
            external: true,
            target_level: null,
            target_spawn: null,
            target_substrate: context?.substrateOfRegion?.(ext?.target_region ?? e.targetRegion)
                ?? e.target_substrate ?? null,
        });
        if (e.access_rule && !isTrueRule(e.access_rule)) exitGates[key] = cloneRule(e.access_rule);
    }
    const locations = room.locations.map((l) => {
        const ext = extractedLocations.get(l.id);
        const name = ext?.global_name ?? l.name
            ?? (extractedRules?.region_id ? makeLocationName(extractedRules.region_id, l.id, null) : l.id);
        return {
            name,
            ...(l.item != null ? { item: l.item } : {}),
            cell: { ...l.cell },
            tag: l.tag,
            ...(l.access_rule && !isTrueRule(l.access_rule) ? { access_rule: cloneRule(l.access_rule) } : {}),
        };
    });
    const ordinal = context?.ordinalOfRegion?.(world.region_id);
    return {
        gameId: 'seedling',
        generated: true,
        seed: room.seed,
        size: { ...room.size },
        record: structuredClone(room.record),
        start: { ...room.start },
        goal_cell: { ...room.goalCell },
        generation: { ...room.generation },
        locations,
        level: Number.isInteger(ordinal) ? ordinal : (Number.isInteger(world.level) ? world.level : null),
        tile_size: GEN_ROOM_TILE_SIZE,
        exits,
        exitGates,
    };
}
