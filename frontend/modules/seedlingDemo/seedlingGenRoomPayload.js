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
    /**
     * ⛓ S1, D4 — the `require` directive (`--require=`'s grammar,
     * `elementSpec.parseItemRequireList`): `hasSword` asks for a room the
     * differential grades sword-REQUIRED. ⛔ `''` reaches the room as ABSENT —
     * no `require` in the knobs, none in `generation` — so every committed room
     * is byte-identical.
     */
    require: '',
    /**
     * ⛓ seedling-gen-biomes-1 (C1) — the room's LOOK (`procgenLook.GEN_LOOKS`: a
     * biome's name, or `overworld`), painted over the finished room at serialize
     * time. ⛔ `''` reaches the room as ABSENT, as `require` does: no `look` in the
     * knobs or in `generation`, and the record is today's (Ground / Stone), so every
     * committed room is byte-identical.
     */
    look: '',
});

/**
 * ⛓ The biomes a generated room may be built in, by NAME — the keys of
 * `seedlingGenRoom.GEN_ROOM_BIOMES` (asserted equal there), spelled here so the
 * panel's select can offer them without importing the generator.
 */
export const GEN_ROOM_BIOME_NAMES = Object.freeze(['pre-sword', 'post-sword', 'post-shield',
    'post-swim', 'post-feather', 'post-fire', 'post-spear', 'post-dark-suit', 'endgame',
    // ⛓ seedling-gen-new-biomes (C4)
    'caldera', 'frozen-forge', 'flooded-ruins']);

/** The tile size every Seedling payload is written in (the game's 16 px grid). */
export const GEN_ROOM_TILE_SIZE = 16;

/** ⛓ The door spelling — `seedlingAtlasDerivation.outExitId` for a teleporter at that pixel. */
export const genDoorId = (cell) => `out_teleporter_${cell.tx * GEN_ROOM_TILE_SIZE}_${cell.ty * GEN_ROOM_TILE_SIZE}`;

/** The advice of a room that did not grow (a deserialized one, which cannot re-roll). */
const RAISE_THE_SIZE = 'Raise the region size (regionWidth / regionHeight), or place this region with a '
    + 'substrate that takes more exits in less room.';
/** ⛓ G8 — the advice after growth: the size is spent, so only the room's demand can move. */
const FEWER_EXITS = 'Place this region with a substrate that takes more exits in less room, or give it fewer exits.';

/**
 * ⛓ G8 — the clause a refusal after GROWTH carries: every size the room tried,
 * the step and the cap (`seedlingGenRoom.GEN_ROOM_GROW_STEP` / `_MAX_SIDE`,
 * handed in by the build half so this module stays light).
 */
const grownClause = (grown) => (grown.sizes.length > 1
    ? ` at each of ${grown.sizes.join(', ')} (it grows ${grown.step} a side after each budget, up to ${grown.max} `
        + 'tiles, the room contract\'s maximum — no size up to it seats them)'
    : ` at ${grown.sizes[0]} (already at the room contract's maximum, ${grown.max} tiles, so it cannot grow)`);

/** ⛓ Every refusal of this module, as a printed SENTENCE. */
/**
 * ⛓ strategy elements r2 — the NAME of the key-gate colour refusal (⚖ the user 2026-11-03, *"B: Distinct colour
 * per room"*). A room is drawn knowing nothing of the other rooms, so a multi-room world cannot yet give each
 * key-gate room its own colour. ⚖ The user redirected that part (2026-11-03) to a general pipeline feature, *"items
 * the player is expected to already have on first reaching the region being generated"*; until it exists, a world
 * whose key gate is not its FIRST generated room is refused by this name at serialize, and a set holding two
 * key-gate rooms at assembly.
 */
export const KEYGATE_COLOUR_REFUSAL = 'keygate-colour-not-allocated';
/**
 * ⛓ strategy elements r2 — the NAME of the key-gate RULE refusal. The room ANDs `Has(<key item>)` onto its goal
 * cell's location (`seedlingGenRoom.extractGenRules`), and a driver that REPLACES a room's location rules with its
 * own spec's (MEASURED: sphere growth, the engine's procedural branch) drops it — a rules.json whose logic says the
 * goal needs no key while the lock says it does. Refused at serialize, where the FINAL rules are read.
 */
export const KEYGATE_RULE_REFUSAL = 'keygate-rule-not-carried';
/**
 * ⛓ keygate colours (slice 2) — the names of a REQUESTED key gate's refusals. Under sphere growth the PLANNER asks
 * a room for its key (`procgenPipeline/sphereIntroductions.js`, through the entry's `itemIntroduction`): each room
 * is handed a colour no other room holds (⚖ "B: Distinct colour per room"). With all five in the world a sixth
 * room is refused (`keygate-colours-exhausted`). A room that cannot draw the requested gate inside its re-roll
 * budget is refused too (`keygate-request-not-met`).
 */
export const KEYGATE_EXHAUSTED_REFUSAL = 'keygate-colours-exhausted';
/** The Seedling world's key items by `keyType`, spelled ONCE in this light module (`seedlingGenRoom.BOSS_KEY_ITEMS`
 *  is this list; `seedlingAtlasDerivation.ITEM_FOR_KEY` is pinned equal). */
export const BOSS_KEY_ITEM_NAMES = Object.freeze(['Red Key', 'Green Key', 'Purple Key', 'Blue Key', 'Yellow Key']);
export const KEYGATE_REQUEST_REFUSAL = 'keygate-request-not-met';
/** ⛓ The set assembler's backstop: two rooms holding ONE key colour. */
export const KEYGATE_SHARED_REFUSAL = 'keygate-colour-shared';

export const GEN_ROOM_REFUSALS = Object.freeze({
    noRegionId: () => 'generated Seedling room: a region_id is required',
    keygateRule: (regionId, location, item) => `${KEYGATE_RULE_REFUSAL}: generated Seedling room '${regionId}' `
        + `holds a KEY GATE, and its location '${location}' stands behind the lock, but the world's final rule for it `
        + `does not require '${item}' — the pipeline driver replaced the room's own rule with its spec's. The logic `
        + 'would say the goal needs no key while the lock says it does, so the room is refused. ⛓ Build key-gate '
        + 'worlds with a driver that keeps a room\'s location rules (measured: shuffled spiral), until the pipeline carries them.',
    keygateColour: (regionId, ordinal) => `${KEYGATE_COLOUR_REFUSAL}: multi-room keygate colours are allocated by `
        + 'the sphere planner\'s requests, and this room\'s key gate was not requested. Generated Seedling room '
        + `'${regionId}' (generated room #${ordinal}) holds a KEY GATE, and only generated room #0 may: each key-gate `
        + 'room must have its own colour (⚖ "B: Distinct colour per room"), and a room is drawn knowing nothing of '
        + 'the others. ⚠ KNOWN LIMIT: this also refuses a world whose room #0 placed no key gate. Ask for the key '
        + 'gates in a sphere-growth world (the planner gives each room its own colour), or for one key gate in a '
        + 'one-generated-room world.',
    keygateExhausted: (regionId, items) => `${KEYGATE_EXHAUSTED_REFUSAL}: generated Seedling room '${regionId}' `
        + `would take a KEY GATE, and all ${items.length} key colours (${items.join(', ')}) are already in the world. `
        + 'Each key-gate room has its own colour (⚖ "B: Distinct colour per room"), so a room past the last colour is '
        + 'refused rather than given a key another room\'s lock also takes.',
    keygateRequest: (regionId, item, why) => `${KEYGATE_REQUEST_REFUSAL}: generated Seedling room '${regionId}' `
        + `was asked by the pipeline for a KEY GATE opened by '${item}', and no draw within its re-roll budget placed `
        + `one that the solver grades required (${why}). The planner's logic already counts the key, so the room `
        + 'is refused rather than built without it.',
    keygateTwoKeys: (regionId, items) => `generated Seedling room '${regionId}': the pipeline asks it to introduce `
        + `${items.join(', ')}, and a room holds ONE key gate`,
    duplicateExit: (regionId, exitId) => `generated Seedling room '${regionId}': exit '${exitId}' is `
        + 'requested twice',
    unknownExit: (regionId, exitId) => `generated Seedling room '${regionId}': a rule names exit `
        + `'${exitId}', which the room does not have`,
    badKnob: (regionId, key, value, why) => `generated Seedling room '${regionId}': the generation knob `
        + `\`${key}\` = ${JSON.stringify(value)} is not usable — ${why}`,
    generator: (regionId, seed, size, message) => `generated Seedling room '${regionId}' (seed ${seed}, `
        + `${size.width}x${size.height}): the Seedling generator refused this room — ${message}`,
    tooManyLocations: (regionId, want, cells, grown = null) => `generated Seedling room '${regionId}' must hold ${want} `
        + `AP location(s), and only ${cells.length} cell(s) are free for them [${cells.join(' ')}] (the `
        + 'goal cell takes the first; the rest need a reachable cell off the start, off every door and '
        + 'not next to one)'
        + (grown == null ? '' : `, in every draw up to re-roll ${grown.budget} (the budget)${grownClause(grown)}`)
        + '. Lower maxItemsPerRegion, lower the flash_seedling_gen quota (fewer items '
        + (grown == null ? 'per room), or raise the region size.' : 'per room).'),
    /** ⛓ G9 — past the level's persistence-tag budget: no draw at any size seats them. */
    tagBudget: (regionId, want, max) => `generated Seedling room '${regionId}' must hold ${want} AP location(s), `
        + `and a Seedling level holds at most ${max}: each location's pickup takes one of the game's ${max} `
        + 'persistence tags (`Game.tagsPerLevel`), and no room size adds any. Lower maxItemsPerRegion or the '
        + 'flash_seedling_gen quota (fewer items per room), or place this region with another substrate.',
    /** ⛓ G9 — every draw's own elements left too few of the tags (re-rolled like too few cells). */
    tooFewTags: (regionId, want, left, max, grown = null) => `generated Seedling room '${regionId}' must hold `
        + `${want} AP location(s), and its own elements leave only ${left} of the level's ${max} persistence tags `
        + 'for them (each location\'s pickup takes one)'
        + (grown == null ? '' : `, in every draw up to re-roll ${grown.budget} (the budget)${grownClause(grown)}`)
        + '. Lower maxItemsPerRegion or the flash_seedling_gen quota (fewer items per room), or choose elements '
        + 'that spend fewer tags.',
    tooManyDoors: (regionId, seed, size, want, message, grown = null) => `generated Seedling room '${regionId}' `
        + `(seed ${seed}, ${size.width}x${size.height}) must hold ${want} door(s), one per exit, and its walkable `
        + `area cannot seat them apart without sealing an approach (${message.replace(/^levelSetExits: /, '')})`
        + (grown == null ? '' : ` — the room was re-rolled up to ${grown.budget} time(s)${grownClause(grown)}`)
        + `. ${grown == null ? RAISE_THE_SIZE : FEWER_EXITS}`,
    /** ⛓ S1, D4 — the room's `require` directive was not met in any draw of its budget. */
    requireNotMet: (regionId, seed, size, require, budget, why) => `generated Seedling room '${regionId}' `
        + `(seed ${seed}, ${size.width}x${size.height}) was asked to REQUIRE [${require}] and no draw met the `
        + `directive in ${budget} re-roll(s) — the last one: ${why}. A \`require\` is MET only when the `
        + 'differential grades the item REQUIRED on the finished room (STRONG or BOUND-DEPENDENT). Choose '
        + 'a biome that grants the item and an element that needs it, or drop the directive.',
    /** ⛓ G5 — case 1 exhausted: an exit the ENGINE added after the room was built finds no unsealing door. */
    engineDoors: (regionId, seed, size, want, engineAdded, grown, message) => `generated Seedling room `
        + `'${regionId}' (seed ${seed}, ${size.width}x${size.height}) must hold ${want} door(s), one per exit, `
        + `${engineAdded} of them an engine-added door (an exit the driver inserted after the room was built — `
        + 'a back exit to the parent or a grid link), and no draw seats them all without sealing an approach '
        + `— the room was re-rolled up to ${grown.budget} time(s), the budget${grownClause(grown)} (`
        + `${message.replace(/^levelSetExits: /, '')}). ${FEWER_EXITS}`,
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
