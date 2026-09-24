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
import { PRE_SWORD_PALETTE, POST_SWORD_PALETTE } from './procgenPalette.js';
import { pickDoorCells } from './levelSetExits.js';
import { TILE_SIZE } from './levelWorld.js';
import { coreLevelRecord } from './levelSetValidator.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseAreaSpec } from '../procgenCore/areaSpec.js';
import {
    GEN_ROOM_DEFAULTS, GEN_ROOM_REFUSALS, GEN_ROOM_TILE_SIZE, genDoorId,
} from './seedlingGenRoomPayload.js';

export {
    GEN_ROOM_DEFAULTS, GEN_ROOM_REFUSALS, GEN_ROOM_TILE_SIZE, genDoorId,
    deserializeGenRoom, genRoomRefusal, genRoomApLocationNames,
} from './seedlingGenRoomPayload.js';

/** The rule every ungated exit / location compiles to. */
const TRUE_RULE = Object.freeze({ rule: 'True_' });
const isTrueRule = (rule) => rule?.rule === 'True_';
const cloneRule = (rule) => structuredClone(rule);

/** The two biomes a room can be built in — the palettes `watchGenerate.GENERATE_BIOMES` offers. */
export const GEN_ROOM_BIOMES = Object.freeze({ 'pre-sword': PRE_SWORD_PALETTE, 'post-sword': POST_SWORD_PALETTE });

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
 * ⛓ HOW MANY TIMES a room that cannot seat its doors without sealing an approach
 * is re-rolled before the `tooManyDoors` refusal (G2; measured: the registry's
 * 8×6 drive room needs 1, top-down `seedling_atlas` at 10×10 at most 2).
 */
export const GEN_ROOM_DOOR_REROLLS = 8;

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

/** The goal cell's neighbours: no door may stand there (the approach would be the check). */
function goalGuard(goalCell) {
    return new Set(around(goalCell).map(cellKey));
}

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
    let seed; let out; let record; let start; let goalCell; let doors; let lastErr = null; let rerolls = 0;
    // ⛓ G2 (⚖ planner): a room that cannot seat its doors UNSEALED is re-rolled —
    //   `rerollSeed(drawn, k)`, no engine rng consumed, so a room that seats on the
    //   first draw is byte-unchanged and no other region moves.
    for (let k = 0; k <= GEN_ROOM_DOOR_REROLLS; k += 1) {
        seed = rerollSeed(drawn, k);
        try {
            out = generateSeedlingLevel(generatorInput(regionId, seed, size, knobs));
        } catch (e) {
            if (e.message.startsWith('generated Seedling room')) throw e;
            throw new Error(GEN_ROOM_REFUSALS.generator(regionId, seed, size, e.message));
        }
        record = coreLevelRecord(out.record);
        start = { ...out.summary.startCell };
        goalCell = { ...out.summary.goalCell };
        try {
            ({ doors } = pickDoorCells(record, start, exits.length, {
                room: `'${regionId}'`, exclude: goalGuard(goalCell), keepReachable: { cells: [goalCell] },
            }));
        } catch (e) {
            if (e.name !== 'LevelSetExitError') throw e;
            lastErr = e;
            continue;
        }
        // ⛓ G2 (⚖ planner): the flood check ignores a goal past a solid the solver
        //   clears, so the GOAL is re-certified with the doors as WALLS — one solve.
        const unsealed = goalHoldsWithDoorsAsWalls(out, doors, GEN_ROOM_BIOMES[knobs.biome].items ?? null);
        if (unsealed === true) { lastErr = null; rerolls = k; break; }
        lastErr = new Error(`levelSetExits: room '${regionId}' seats its ${exits.length} door(s), but with them as `
            + `walls the generator's own solver no longer reaches the goal (${unsealed})`);
    }
    if (lastErr) throw new Error(GEN_ROOM_REFUSALS.tooManyDoors(regionId, seed, record, exits.length, lastErr.message));
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
            generation: { ...knobs, rerolls },
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
    return [...flood.values()].filter((c) => !blocked.has(cellKey(c))).map((c) => ({ tx: c.tx, ty: c.ty }));
}

/** The record the tags are allocated against: the room without its goal pickup. */
function recordWithoutGoal(world) {
    const gx = world.goalCell.tx * TILE_SIZE;
    const gy = world.goalCell.ty * TILE_SIZE;
    return { ...world.record, entities: (world.record.entities ?? []).filter((e) => !(e.x === gx && e.y === gy)) };
}

/**
 * Put `ids` (with their items and rules) into the room: the first on the goal
 * cell (if the room holds none yet), the rest on free flood cells nearest the
 * start. Refused by name when the room has too few cells.
 */
function addLocations(world, rows) {
    const free = world.locations.length === 0 ? [world.goalCell] : [];
    free.push(...locationCells(world));
    if (rows.length > free.length) {
        throw new Error(GEN_ROOM_REFUSALS.tooManyLocations(world.region_id, world.locations.length + rows.length,
            [...world.locations.map((l) => l.cell), ...free].map((c) => `(${c.tx},${c.ty})`)));
    }
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
 * neighbours. Returns `[key, record-with-door]` pairs; the world is untouched.
 */
function bindAllDoors(world, entries) {
    const unbound = entries.filter(([, e]) => !Array.isArray(e.exit_tiles));
    if (unbound.length === 0) return entries;
    const exclude = goalGuard(world.goalCell);
    const guard = (c) => { exclude.add(cellKey(c)); for (const n of around(c)) exclude.add(cellKey(n)); };
    for (const [, e] of entries) for (const [tx, ty] of e.exit_tiles ?? []) guard({ tx, ty });
    for (const l of world.locations) guard(l.cell);
    // ⛓ G2: the doors already bound are WALLS, and their approaches, the goal and
    //   every location stay reachable from the start (`keepReachable`).
    const bound = entries.filter(([, e]) => Array.isArray(e.exit_tiles));
    const walls = new Set(bound.flatMap(([, e]) => e.exit_tiles.map(([tx, ty]) => cellKey({ tx, ty }))));
    const keepReachable = {
        walls,
        cells: [world.goalCell, ...world.locations.map((l) => l.cell),
            ...bound.map(([, e]) => ({ tx: e.entrance_spawn.x / TILE_SIZE, ty: e.entrance_spawn.y / TILE_SIZE }))],
    };
    const pick = (ex) => pickDoorCells(world.record, world.start, unbound.length, {
        room: `'${world.region_id ?? '?'}'`, exclude: ex, keepReachable,
    });
    /**
     * ⛓ G2: the room is FIXED here (its locations are placed), so it cannot be
     * re-rolled. When the neighbour guards leave no unsealing cell, the second try
     * keeps only the cells themselves (goal, locations, doors): `keepReachable`
     * already rejects a door whose approach is a door or that seals one, which is
     * what the guards were for. Neither → the room's refusal, as a sentence.
     */
    let doors;
    try {
        ({ doors } = pick(exclude));
    } catch (first) {
        if (first.name !== 'LevelSetExitError') throw first;
        try {
            ({ doors } = pick(new Set([cellKey(world.goalCell), ...world.locations.map((l) => cellKey(l.cell)), ...walls])));
        } catch (e) {
            if (e.name !== 'LevelSetExitError') throw e;
            throw new Error(GEN_ROOM_REFUSALS.tooManyDoors(world.region_id ?? '?', world.seed, world.size,
                entries.length, e.message));
        }
    }
    const fresh = new Map(unbound.map(([key], k) => [key, doors[k]]));
    return entries.map(([key, e]) => (fresh.has(key) ? [key, { ...e, ...doorFields(fresh.get(key)) }] : [key, e]));
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
    for (const [key, e] of bindAllDoors(world, entries)) {
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
    const locations = world.locations.map((l) => {
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
        seed: world.seed,
        size: { ...world.size },
        record: structuredClone(world.record),
        start: { ...world.start },
        goal_cell: { ...world.goalCell },
        generation: { ...world.generation },
        locations,
        level: Number.isInteger(ordinal) ? ordinal : (Number.isInteger(world.level) ? world.level : null),
        tile_size: GEN_ROOM_TILE_SIZE,
        exits,
        exitGates,
    };
}
