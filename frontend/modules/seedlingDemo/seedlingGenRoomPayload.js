/**
 * seedlingDemo/seedlingGenRoomPayload — **THE PLAY-TIME HALF OF A GENERATED
 * SEEDLING ROOM** (seedling generated levels G1): the payload's shape and its
 * refusal, `deserializeWorld`, the knob defaults and the door spelling.
 *
 * ⛔ It imports NOTHING heavy, and that is its reason to exist: the registry
 * entry `flash_seedling_gen` (`flashPanel/flashSeedlingGenLibrary.js`) is in
 * `flashPanel/index.js`'s static closure, and the generator
 * (`procgenSeedling.js`, +94 files / +4.96 MB) must not be. The build half —
 * generate, place, extract, serialize — is `seedlingGenRoom.js`, installed into
 * the entry through its seam.
 */

const cloneRule = (rule) => structuredClone(rule);

/**
 * ⛓ THE REGISTRY ID OF A GENERATED ROOM, spelled here and nowhere else:
 * `flashSeedlingGenLibrary` re-exports it as `FLASH_SEEDLING_GEN_SUBSTRATE_ID`,
 * and the play-time half — the census below, the set assembler
 * (`seedlingGeneratedSet.js`) — reads it without importing the registry entry
 * (which would register a second copy of it behind a computed specifier).
 */
export const GEN_ROOM_SUBSTRATE_ID = 'flash_seedling_gen';

/**
 * ⛓ THE KNOBS A ROOM IS BUILT WITH — `export-seedling-level-set.mjs`'s own
 * defaults (`--biome=pre-sword --count=6 --tries=8 --saturation=3`, no skeleton,
 * element, area or fill flag), so a room at the default knobs IS the CLI's room
 * for that seed. The string specs (`skeleton`, `elements`, `areas`) are the lab
 * page's grammar; `''` means "the generator's default", never a value.
 */
export const GEN_ROOM_DEFAULTS = Object.freeze({
    biome: 'pre-sword',
    obstacleTarget: 6,
    triesPerStep: 8,
    saturationK: 3,
    skeleton: '',
    elements: '',
    areas: '',
    fill: 'dense',
});

/** The tile size every Seedling payload is written in (the game's 16 px grid). */
export const GEN_ROOM_TILE_SIZE = 16;

/** ⛓ The door spelling — `seedlingAtlasDerivation.outExitId` for a teleporter at that pixel. */
export const genDoorId = (cell) => `out_teleporter_${cell.tx * GEN_ROOM_TILE_SIZE}_${cell.ty * GEN_ROOM_TILE_SIZE}`;

/** ⛓ Every refusal of this module, as a printed SENTENCE. */
export const GEN_ROOM_REFUSALS = Object.freeze({
    noRegionId: () => 'generated Seedling room: a region_id is required',
    duplicateExit: (regionId, exitId) => `generated Seedling room '${regionId}': exit '${exitId}' is `
        + 'requested twice',
    unknownExit: (regionId, exitId) => `generated Seedling room '${regionId}': a rule names exit `
        + `'${exitId}', which the room does not have`,
    badKnob: (regionId, key, value, why) => `generated Seedling room '${regionId}': the generation knob `
        + `\`${key}\` = ${JSON.stringify(value)} is not usable — ${why}`,
    generator: (regionId, seed, size, message) => `generated Seedling room '${regionId}' (seed ${seed}, `
        + `${size.width}x${size.height}): the Seedling generator refused this room — ${message}`,
    tooManyLocations: (regionId, want, cells) => `generated Seedling room '${regionId}' must hold ${want} `
        + `AP location(s), and only ${cells.length} cell(s) are free for them [${cells.join(' ')}] (the `
        + 'goal cell takes the first; the rest need a reachable cell off the start, off every door and '
        + 'not next to one). Lower maxItemsPerRegion, lower the flash_seedling_gen quota (fewer items '
        + 'per room), or raise the region size.',
    tooManyDoors: (regionId, seed, size, want, message) => `generated Seedling room '${regionId}' (seed ${seed}, `
        + `${size.width}x${size.height}) must hold ${want} door(s), one per exit, and its walkable area cannot `
        + `seat them apart (${message.replace(/^levelSetExits: /, '')}). Raise the region size (regionWidth / `
        + 'regionHeight), or place this region with a substrate that takes more exits in less room.',
    notARoom: (why) => `this payload is not a generated Seedling room — ${why}. Regenerate the region `
        + 'through flash_seedling_gen.',
});

/** The payload keys a room carries (the serializer's own output), and the ones it may carry beside them. */
const ROOM_KEYS = Object.freeze(['gameId', 'generated', 'seed', 'size', 'record', 'start', 'goal_cell',
    'generation', 'locations', 'level', 'tile_size', 'exits', 'exitGates']);
const ENGINE_KEYS = Object.freeze(['fogEnabled', 'manaEnabled']);

/** The refusal sentence for a payload that is not a generated room, or `null`. */
export function genRoomRefusal(payload) {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        return GEN_ROOM_REFUSALS.notARoom('playable_payload is not an object');
    }
    const absent = ROOM_KEYS.filter((k) => !(k in payload));
    const extra = Object.keys(payload).filter((k) => !ROOM_KEYS.includes(k) && !ENGINE_KEYS.includes(k));
    const parts = [];
    if (payload.generated !== true && !absent.includes('generated')) parts.push('`generated` is not true');
    if (absent.length) parts.push(`it lacks ${absent.map((k) => `\`${k}\``).join(', ')}`);
    if (extra.length) parts.push(`it carries ${extra.map((k) => `\`${k}\``).join(', ')}, which a room does not have`);
    return parts.length ? GEN_ROOM_REFUSALS.notARoom(parts.join('; ')) : null;
}

/**
 * `deserializeWorld` — the payload → a room (a CLONE). The exits become a Map
 * keyed by the AP name (`exitName` — the flash family's key, which the binding
 * reads), each record the payload's own (its `exit_id` is the DOOR, which the
 * binding's departure arm matches); each exit takes its gate back from
 * `exitGates`; each location's AP `name` is also its id. `manaEnabled: true`
 * rides onto the world (the G2a-fix law); `level` and `tile_size` stay on it
 * for the binding. ⛔ A payload that is not a room is REFUSED by name.
 */
export function deserializeGenRoom(payload) {
    const refusal = genRoomRefusal(payload);
    if (refusal) throw new Error(refusal);
    const p = structuredClone(payload);
    const exits = new Map();
    for (const e of p.exits) {
        const record = { ...e };
        if (p.exitGates[e.exitName]) record.access_rule = cloneRule(p.exitGates[e.exitName]);
        exits.set(e.exitName, record);
    }
    const world = {
        gameId: p.gameId,
        generated: true,
        seed: p.seed,
        size: p.size,
        record: p.record,
        start: p.start,
        goalCell: p.goal_cell,
        generation: p.generation,
        level: p.level,
        tile_size: p.tile_size,
        exits,
        locations: p.locations.map((l) => ({ id: l.name, ...l })),
    };
    if (p.manaEnabled === true) world.manaEnabled = true;
    return world;
}

/** ⛓ The registry's `apLocationNamesOf` slot: every `locations[].name`, or null with no carrier. */
export function genRoomApLocationNames(payload) {
    if (!Array.isArray(payload?.locations)) return null;
    return payload.locations.map((l) => l?.name).filter((n) => typeof n === 'string' && n !== '');
}

/**
 * ⛓ WHICH SIDECARS OF A rules.json ARE GENERATED ROOMS, and which are REAL rooms
 * of the same game — read from DATA, so it needs no second registry id: a
 * sidecar of another substrate whose payload names the same `gameId` as a
 * generated room is a real room of that game (today: `flash_seedling`). The
 * eligibility check `generated` and the assembler both read this one census.
 *
 * @param {object|null} rules  the rules.json (not the event wrapper)
 * @returns {{rooms: string[], mixed: string[], gameIds: string[]}}  region ids, in sidecar order
 */
export function generatedRoomCensus(rules) {
    const sidecars = Object.entries(rules?.preset_sidecars?.['1'] ?? {});
    const rooms = sidecars.filter(([, s]) => s?.substrate === GEN_ROOM_SUBSTRATE_ID).map(([r]) => r);
    const gameIds = [...new Set(rooms.map((r) => rules.preset_sidecars['1'][r]?.playable_payload?.gameId)
        .filter((g) => typeof g === 'string'))];
    const mixed = sidecars.filter(([, s]) => s?.substrate !== GEN_ROOM_SUBSTRATE_ID
        && gameIds.includes(s?.playable_payload?.gameId)).map(([r]) => r);
    return { rooms, mixed, gameIds };
}
