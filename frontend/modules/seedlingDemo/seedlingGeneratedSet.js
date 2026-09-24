/**
 * seedlingDemo/seedlingGeneratedSet — **THE LEVEL SET OF A GENERATED WORLD,
 * ASSEMBLED AT PLAY FROM ITS rules.json** (seedling generated levels G2; plan
 * `seedling-generated-plan.md` §2.2 item 2, ⚖ Q2/Q3/Q5/Q6).
 *
 * A `flash_seedling_gen` sidecar CARRIES ITS ROOM (G1): the generator's core
 * record — BARE, no door and no `apitem` — plus its doors and its AP locations.
 * This module turns the world's generated sidecars into ONE level set the game
 * mounts through `SeedlingLevelSetDelivery`, and the placement table the check
 * binding reads. It is a PURE function of the rules.json (⚖ Q2): no DOM, no
 * engine, no generator, no fetch — the same rules assemble the same bytes.
 *
 * ── THE RULES, IN ORDER ─────────────────────────────────────────────────
 *
 *   rooms     the generated sidecars of `preset_sidecars['1']`, in OBJECT order;
 *             room i is level i, and each sidecar's own `level` must SAY so (G1
 *             writes the ordinal at build; a mismatch is refused, never renumbered)
 *   doors     one per payload exit, on its `exit_tiles[0]`, spelled as its
 *             `exit_id` (the binding's departure arm matches that spelling);
 *             · target a GENERATED room → `to` its level, arriving on the PAIRED
 *               door's approach cell (⚖ Q5) — the target's first door, in payload
 *               order, whose `targetRegion` is this room; none is REFUSED
 *             · target any other substrate → `to` the PARKING room (⚖ Q3)
 *             · `sign` 0 everywhere: no region names are declared (reported)
 *   apitems   one per location, on its `cell`, `{tag, look: AP_LOOK}`; an entity
 *             already ON that cell (the goal pickup under location 0, ⚖ Q6) is
 *             REPLACED; a location with no joined item still gets one (AP fills it)
 *   parking   level N (appended): a walled 3×3 with one floor cell, no exits;
 *             the game sits there while the host plays another substrate
 *   start     level 0 on its first door's approach cell (the Menu hop's own
 *             landing — `resolveArrivalSpawn` with no `arrivedFrom`), or its
 *             start cell when it has no door
 *
 * ⛔ REFUSED BY NAME (`GENERATED_SET_REFUSALS`), never half-assembled: no
 * generated room; a real room of the same game beside them (a MIXED world); a
 * payload that is not a room; a `level` that is not its ordinal; a door whose
 * `exit_id` is not its tile's spelling; a one-way generated pairing; a
 * validator error.
 */

import { buildLevelSet, apMappingInvalidation } from './levelSetExporter.js';
import { validateLevelSet } from './levelSetValidator.js';
import { emitDoorEntities } from './levelSetExits.js';
import { AP_ITEM_TYPE, AP_LOOK, placementKey } from './apPlacementRewriter.js';
import {
    GEN_ROOM_TILE_SIZE, genDoorId, genRoomRefusal, generatedRoomCensus,
} from './seedlingGenRoomPayload.js';

/** The set id's base; the world's seed follows it, then the stamp's content hash. */
export const GENERATED_SET_ID_BASE = 'seedling-gen';

/** What `provenance.generator` says of every set this module assembles. */
export const GENERATED_SET_GENERATOR = 'seedlingDemo/seedlingGeneratedSet.js';

/** The parking room's name in the set (rooms are otherwise named by region id). */
export const PARKING_ROOM_NAME = 'parking';

/** ⛓ The parking room's floor cell — its centre; the arrival of every external door. */
export const PARKING_CELL = Object.freeze({ tx: 1, ty: 1 });

/** Tile ids of the parking room: the generator's own wall and floor (`levelWorld`'s solid 48, open 0). */
const WALL_TILE = 48;
const FLOOR_TILE = 0;

export class GeneratedSetError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GeneratedSetError';
    }
}

/** ⛓ Every refusal of this module, as a printed SENTENCE. */
export const GENERATED_SET_REFUSALS = Object.freeze({
    noRooms: () => 'generated Seedling set: these rules carry no flash_seedling_gen sidecar, so there '
        + 'is no generated room to assemble',
    mixed: (rooms, mixed) => `generated Seedling set: these rules carry generated rooms (${rooms.join(', ')}) `
        + `AND real rooms of the same game (${mixed.join(', ')}). A mixed world is not assembled yet — the `
        + 'real rooms live in the vanilla set and the generated ones in their own, and the game mounts one '
        + 'set at a time. Rebuild the world with one Seedling substrate.',
    notARoom: (region, why) => `generated Seedling set: region '${region}' — ${why}`,
    wrongLevel: (region, level, ordinal) => `generated Seedling set: region '${region}' says it is level `
        + `${JSON.stringify(level)}, but it is generated room #${ordinal} in sidecar order — the build `
        + 'wrote a different ordinal than the play reads, so every door into it would open the wrong '
        + 'room. Regenerate the world.',
    badDoor: (region, exitId, want) => `generated Seedling set: region '${region}' door '${exitId}' does `
        + `not match its own tile (that tile's door is '${want}') — the game reports a door by its tile, `
        + 'so the host could never recognise this one',
    oneWay: (region, exitName, target) => `generated Seedling set: region '${region}' exit '${exitName}' `
        + `leads to generated room '${target}', which has no door back to '${region}' — the arrival cell `
        + 'is the paired door\'s approach, and there is no paired door',
    invalid: (errors) => `generated Seedling set: the assembled set does not validate — ${errors.join('; ')}`,
});

const refuse = (message) => { throw new GeneratedSetError(message); };

/** The parking room's core record: walls round one floor cell. */
export function parkingRoomRecord() {
    const tiles = [];
    for (let ty = 0; ty < 3; ty += 1) {
        for (let tx = 0; tx < 3; tx += 1) {
            const floor = tx === PARKING_CELL.tx && ty === PARKING_CELL.ty;
            tiles.push([tx, ty, floor ? FLOOR_TILE : WALL_TILE, 0]);
        }
    }
    return { width: 3, height: 3, layers: [{ name: 'tiles', set: 'tileset', tiles }], entities: [] };
}

const cellPx = (cell) => ({ x: cell.tx * GEN_ROOM_TILE_SIZE, y: cell.ty * GEN_ROOM_TILE_SIZE });

/**
 * One room's `apitem`s, on the record: REPLACING an entity on the location's
 * cell, appended otherwise. Returns `{record, placed}`.
 */
function placeApItems(record, locations) {
    const entities = [...(record.entities ?? [])];
    const placed = [];
    for (const loc of locations) {
        const { x, y } = cellPx(loc.cell);
        const item = { type: AP_ITEM_TYPE, x, y, attrs: { tag: String(loc.tag), look: AP_LOOK } };
        const at = entities.findIndex((e) => e.x === x && e.y === y);
        placed.push({ location: loc.name, cell: loc.cell, tag: loc.tag,
            replaced: at < 0 ? null : entities[at].type });
        if (at < 0) entities.push(item);
        else entities[at] = item;
    }
    return { record: { ...record, entities }, placed };
}

/**
 * Assemble the world's level set.
 *
 * @param {object} rules  the rules.json (not the event wrapper)
 * @param {object} [options]
 * @param {(name: string) => ({name: string, player: number}|null)} [options.locationItemOf]
 *        the caller's item join (the vanilla arm's `locationItemOf`); null for no join
 * @param {number|null} [options.selfPlayer]  this slot, stored on the table rows' readout
 * @returns {{set: object, invalidation: object, table: Map<string, object>,
 *           levelOf: Map<string, number>, report: object}}
 */
export function assembleGeneratedSeedlingSet(rules, { locationItemOf = () => null, selfPlayer = null } = {}) {
    const census = generatedRoomCensus(rules);
    if (census.rooms.length === 0) refuse(GENERATED_SET_REFUSALS.noRooms());
    if (census.mixed.length > 0) refuse(GENERATED_SET_REFUSALS.mixed(census.rooms, census.mixed));

    const sidecars = rules.preset_sidecars['1'];
    const levelOf = new Map(census.rooms.map((r, i) => [r, i]));
    const parkingLevel = census.rooms.length;
    const payloads = census.rooms.map((region, ordinal) => {
        const p = sidecars[region].playable_payload;
        const why = genRoomRefusal(p);
        if (why) refuse(GENERATED_SET_REFUSALS.notARoom(region, why));
        if (p.level !== ordinal) refuse(GENERATED_SET_REFUSALS.wrongLevel(region, p.level, ordinal));
        return p;
    });

    const doors = [];
    const apitems = [];
    const entries = census.rooms.map((region, level) => {
        const p = payloads[level];
        const roomDoors = p.exits.map((e) => {
            const [tx, ty] = e.exit_tiles[0];
            const cell = { tx, ty };
            if (e.exit_id !== genDoorId(cell)) refuse(GENERATED_SET_REFUSALS.badDoor(region, e.exit_id, genDoorId(cell)));
            let to;
            let arrival;
            if (levelOf.has(e.targetRegion)) {
                to = levelOf.get(e.targetRegion);
                const paired = payloads[to].exits.find((b) => b.targetRegion === region);
                if (!paired) refuse(GENERATED_SET_REFUSALS.oneWay(region, e.exitName, e.targetRegion));
                arrival = { x: paired.entrance_spawn.x, y: paired.entrance_spawn.y };
            } else {
                to = parkingLevel;
                arrival = cellPx(PARKING_CELL);
            }
            doors.push({ room: level, region, exit_id: e.exit_id, exitName: e.exitName, cell,
                targetRegion: e.targetRegion, to, arrival, parked: to === parkingLevel });
            return { cell, to, arrival, sign: 0 };
        });
        const { record: withItems, placed } = placeApItems(p.record, p.locations);
        for (const a of placed) apitems.push({ room: level, region, ...a });
        return { record: emitDoorEntities(withItems, roomDoors), name: region };
    });
    entries.push({ record: parkingRoomRecord(), name: PARKING_ROOM_NAME });

    const first = payloads[0];
    const startPx = first.exits.length > 0 ? first.exits[0].entrance_spawn : cellPx(first.start);
    const seed = rules.seed_name || String(rules.generation_seed ?? '');
    const { set, report: built } = buildLevelSet(entries, {
        link: false,
        setId: `${GENERATED_SET_ID_BASE}-${seed}`,
        start: { level: 0, x: startPx.x, y: startPx.y },
        menuRooms: [0],
        generator: GENERATED_SET_GENERATOR,
        provenance: { world: { seed_name: rules.seed_name ?? null, regions: [...census.rooms] } },
    });
    const validation = validateLevelSet(set);
    if (!validation.ok) refuse(GENERATED_SET_REFUSALS.invalid(validation.errors));
    const invalidation = apMappingInvalidation(set);

    const table = new Map();
    const unjoined = [];
    for (const a of apitems) {
        const joined = locationItemOf(a.location);
        if (!joined) unjoined.push(a.location);
        table.set(placementKey(a.room, a.tag), {
            ledgerId: a.location,
            level: a.room,
            tag: a.tag,
            location: a.location,
            item: joined?.name ?? null,
            player: joined?.player ?? null,
            look: AP_LOOK,
        });
    }

    return {
        set,
        invalidation,
        table,
        levelOf,
        report: {
            rooms: census.rooms.length,
            parkingLevel,
            doors,
            apitems,
            unjoined,
            unsigned: doors.length,
            warnings: validation.warnings,
            reachability: built.reachability,
            invented: built.invented,
            notes: [...built.notes,
                `${doors.length} door(s) announce nothing (sign 0): no region names are declared for generated rooms`],
        },
    };
}
