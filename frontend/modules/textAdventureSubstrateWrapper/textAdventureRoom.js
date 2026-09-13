/**
 * textAdventureSubstrateWrapper/textAdventureRoom — **THE TEXT ADVENTURE'S OWN
 * ROOM WORLD** (⛓ PRESET SIDECARS G2a, Route P; ⚖ user 2026-09-13).
 *
 * Until G2a the text adventure registered the MAZE's four procedural hooks and
 * its serializer: every text-adventure region grew a real maze (tiles, walls,
 * an entrance, a logic-gate obstacle per rule) that nothing at play ever read —
 * the wrapper builds its rooms from `staticData.regions` and the compiled
 * `access_rule` side-table, and reads ONE payload field (`manaEnabled`). This
 * module is what a text adventure region actually is:
 *
 *   world = {
 *     region_id,
 *     exits:     Map<exit_id, {exit_id, side, exitName, targetRegion,
 *                              isBackExit, isTeleporter, access_rule?}>,
 *     locations: [{id, item?, access_rule?, name?}],
 *   }
 *
 * — no tiles, no entrance, no obstacles, and ⛔ **NO RNG DRAW anywhere**: a room
 * has nothing to roll. The exits stand on their SIDES (the entry declares
 * `regionGeometry: SIDES`), and every rule is AUTHORED: `placeFromRules` records
 * the document's own rule tree on its exit / location, and the extractor emits
 * it verbatim, so the compiler's `access_rule`-wins branch emits it unchanged.
 * `True_` is recorded as ABSENT on the room and EMITTED explicitly by the
 * extractor — ⚠ `compileAccessRule` turns an absent rule with no paths into
 * `False_`, not `True_`.
 *
 * The payload (`serializeTextAdventureRoom` ⇄ `deserializeTextAdventureRoom`)
 * carries the room's exits (the envelope's sided records), its gates, and its
 * locations by AP name — so a rebuild re-emits the rules FROM the payload.
 *
 * ⛔ Node-importable: no DOM, no engine import (the engine calls these through
 * the registry entry in `textAdventureSubstrateWrapperLibrary.js`).
 */

import { SIDES } from '../shared/procgen/spatialPrimitives.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';
import {
    REQUIRED_ENVELOPE_FIELD, SIDECAR_FIELD_ERRORS, sidecarFieldsOf, sidecarPayloadErrors,
} from '../procgenCore/sidecarFields.js';

/** The rule every ungated exit / location compiles to. */
const TRUE_RULE = Object.freeze({ rule: 'True_' });
const isTrueRule = (rule) => rule?.rule === 'True_';
const cloneRule = (rule) => structuredClone(rule);

/** ⛓ Every refusal of this module, as a printed SENTENCE. */
export const TEXT_ADVENTURE_ROOM_REFUSALS = Object.freeze({
    noRegionId: () => 'text adventure room: a region_id is required',
    unknownExit: (regionId, exitId) => `text adventure room '${regionId}': a rule names exit '${exitId}', `
        + 'which the room does not have',
    duplicateExit: (regionId, exitId) => `text adventure room '${regionId}': exit '${exitId}' is requested twice`,
});

/**
 * The side a side-less exit takes. The layout driver leaves an exit without a
 * side when its target is not a grid neighbour (a teleporter); a room draws no
 * rng, so it takes the still-FREE sides clockwise first (the zone generator's
 * law, `generateRegionZoneGen`), then cycles `SIDES` — a text adventure may
 * hold two exits on one side.
 */
function sideAssigner(requested) {
    const free = SIDES.filter((s) => !requested.some((e) => e.side === s));
    let cycle = 0;
    return () => free.shift() ?? SIDES[cycle++ % SIDES.length];
}

/**
 * `generateRegionCore` — the room: one exit record per requested exit, on its
 * requested side, no location yet. `entrances`, `size`, the libraries, `rng`,
 * `params` and `biome` are accepted and IGNORED (nothing to lay out).
 *
 * The default exit id is the maze's (`exit` for a single exit, else `exit_<i>`)
 * so a region's exit names do not move with its substrate.
 */
export function generateTextAdventureRoom(input = {}) {
    const { region_id, exits = [] } = input;
    if (!region_id) throw new Error(TEXT_ADVENTURE_ROOM_REFUSALS.noRegionId());
    const nextSide = sideAssigner(exits);
    const defaultExitId = (i) => (exits.length === 1 ? 'exit' : `exit_${i}`);
    const roomExits = new Map();
    exits.forEach((e, i) => {
        const exit_id = e.exit_id ?? defaultExitId(i);
        if (roomExits.has(exit_id)) throw new Error(TEXT_ADVENTURE_ROOM_REFUSALS.duplicateExit(region_id, exit_id));
        roomExits.set(exit_id, {
            exit_id,
            side: e.side ?? nextSide(),
            exitName: e.exitName ?? exit_id,
            targetRegion: e.targetRegion ?? null,
            isBackExit: false,
            isTeleporter: false,
        });
    });
    return {
        world: { region_id, exits: roomExits, locations: [] },
        exits_placed: [...roomExits.values()].map(({ exit_id, side }) => ({ exit_id, side })),
    };
}

/**
 * `placeFromItems` — the spiral / grid-growth placer: each item becomes a
 * location holding it, named the maze's way (`<item>_pickup`; a second copy of
 * one item in one room gets `_2`, `_3`…, where the maze would have emitted the
 * same id twice). ⚠ A room places NO obstacle: a key/door pair has no geometry
 * to stand between here, so every `obstacles_to_place` entry is reported
 * unplaced (by omission — the caller's pool keeps it).
 */
export function placeTextAdventureItems(world, input = {}) {
    const { items_to_place = [] } = input;
    const taken = new Set(world.locations.map((l) => l.id));
    const placed_items = [];
    for (const item_id of items_to_place) {
        let id = `${item_id}_pickup`;
        for (let n = 2; taken.has(id); n++) id = `${item_id}_pickup_${n}`;
        taken.add(id);
        world.locations.push({ id, item: item_id });
        placed_items.push({ item_id, location_id: id });
    }
    return { placed_items, placed_obstacles: [] };
}

/**
 * `placeFromRules` — the top-down placer: every exit rule is recorded on its
 * exit and every location (ruled first, then item-only — the maze's order) is
 * added with its item and rule. A `True_` rule is recorded as absent. No
 * location stands on a tile, so `placed_locations` carry no `position` — the
 * engine matches them by id.
 */
export function placeTextAdventureRules(world, input = {}) {
    const { exit_rules = {}, location_rules = {}, item_placements = [] } = input;
    for (const [exit_id, rule] of Object.entries(exit_rules)) {
        const exit = world.exits.get(exit_id);
        if (!exit) throw new Error(TEXT_ADVENTURE_ROOM_REFUSALS.unknownExit(world.region_id ?? '?', exit_id));
        if (isTrueRule(rule)) delete exit.access_rule;
        else exit.access_rule = cloneRule(rule);
    }
    const itemByLocation = Object.fromEntries(item_placements.map((p) => [p.location_id, p.item_id]));
    const order = [...Object.keys(location_rules),
        ...item_placements.map((p) => p.location_id).filter((id) => !(id in location_rules))];
    const placed_items = [];
    const placed_locations = [];
    for (const location_id of [...new Set(order)]) {
        const item_id = itemByLocation[location_id];
        const rule = location_rules[location_id];
        world.locations.push({
            id: location_id,
            ...(item_id != null ? { item: item_id } : {}),
            ...(rule && !isTrueRule(rule) ? { access_rule: cloneRule(rule) } : {}),
        });
        if (item_id != null) placed_items.push({ item_id, location_id });
        placed_locations.push({ location_id });
    }
    return { placed_logic_gates: [], placed_items, placed_locations };
}

/**
 * `extractPathsAndObstacles` — the room's rules, straight off the room: each
 * exit and location with its AUTHORED rule, `True_` where none. No paths (the
 * compiler's `access_rule`-wins branch never walks them). A location that
 * carries its AP `name` (a deserialized payload's) hands it on as `global_name`,
 * so a rebuild compiles the document's own name.
 */
export function extractTextAdventureRules(world, opts = {}) {
    const regionId = opts.regionId ?? 'text_adventure_room';
    return {
        region_id: regionId,
        exits: [...world.exits.values()].map((e) => ({
            id: e.exit_id,
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
 * `serializeWorld` — the room → its payload. The envelope's `exits` (sided
 * records, fixed order; `exitName`/`targetRegion` from the extracted rules
 * where given, as the maze's serializer does), `exitGates` (`{exit_id: rule}`,
 * the gated exits only — a gate cannot ride inside the envelope's exit record,
 * which a substrate may not redeclare), and `locations` (`{name, item?,
 * access_rule?}`, the AP name baked from the extracted rules). A clone: no
 * object of the world is shared with the payload.
 */
export function serializeTextAdventureRoom(world, extractedRules) {
    const extractedExits = new Map((extractedRules?.exits ?? []).map((e) => [e.id, e]));
    const extractedLocations = new Map((extractedRules?.locations ?? []).map((l) => [l.id, l]));
    const exitValues = world.exits instanceof Map ? [...world.exits.values()] : [...(world.exits ?? [])];
    const exits = [];
    const exitGates = {};
    for (const e of exitValues) {
        const ext = extractedExits.get(e.exit_id);
        exits.push({
            exit_id: e.exit_id,
            side: e.side ?? null,
            exitName: ext?.id ?? e.exitName ?? null,
            targetRegion: ext?.target_region ?? e.targetRegion ?? null,
            targetExitId: e.targetExitId ?? null,
            isBackExit: e.isBackExit ?? false,
            isTeleporter: e.isTeleporter ?? false,
        });
        if (e.access_rule && !isTrueRule(e.access_rule)) exitGates[e.exit_id] = cloneRule(e.access_rule);
    }
    const locations = (world.locations ?? []).map((l) => {
        const ext = extractedLocations.get(l.id);
        const name = ext?.global_name
            ?? l.name
            ?? (extractedRules?.region_id ? makeLocationName(extractedRules.region_id, l.id, null) : l.id);
        return {
            name,
            ...(l.item != null ? { item: l.item } : {}),
            ...(l.access_rule && !isTrueRule(l.access_rule) ? { access_rule: cloneRule(l.access_rule) } : {}),
        };
    });
    return { exits, exitGates, locations };
}

/**
 * `deserializeWorld` — the payload → a room (a CLONE: the payload is never
 * aliased, M2's mutant H). The exits array becomes a Map keyed by `exit_id` —
 * the key the engine's own descriptor uses (`insertBackExit`, the bidirectional
 * post-pass's `get(exit.name)`); every committed text-adventure exit has
 * `exitName === exit_id`. Each exit takes its gate back from `exitGates`; each
 * location's AP `name` is also its id.
 *
 * ⛔ **ONE FORMAT, NO LEGACY READ** (⚖ the user, 2026-09-13: *"I don't want to
 * maintain support for the old format. I want to fully replace it with the new
 * format."*). A payload that does not have the room's shape — a key the room's
 * own declaration does not know (the tile grid's `tiles`, `items`, …), or a
 * required key absent (`exitGates`, `locations`) — is REFUSED with a sentence
 * naming those keys (`textAdventureRoomRefusal`), never read as "its exits and
 * no locations". The shape is read off `TEXT_ADVENTURE_SIDECAR_FIELDS` (merged
 * with the envelope), so the refusal and the corpus gate cannot disagree.
 */
export function deserializeTextAdventureRoom(payload) {
    const refusal = textAdventureRoomRefusal(payload);
    if (refusal) throw new Error(refusal);
    const gates = payload.exitGates;
    const exits = new Map();
    for (const e of payload.exits) {
        const record = structuredClone(e);
        if (gates[e.exit_id]) record.access_rule = cloneRule(gates[e.exit_id]);
        exits.set(e.exit_id, record);
    }
    const locations = payload.locations.map((l) => ({
        id: l.name,
        name: l.name,
        ...(l.item != null ? { item: l.item } : {}),
        ...(l.access_rule ? { access_rule: cloneRule(l.access_rule) } : {}),
    }));
    return { exits, locations };
}

/** One Rule Builder rule tree, as far as a payload check can say: an object naming its `rule`. */
const RULE_TREE = Object.freeze({
    type: 'object',
    required: Object.freeze(['rule']),
    properties: Object.freeze({ rule: Object.freeze({ type: 'string', minLength: 1 }) }),
});

/**
 * ⛓⛓ PRESET SIDECARS G2a — **THE TEXT ADVENTURE'S OWN PAYLOAD, DECLARED BESIDE
 * ITS SERIALIZER** (the registry's `sidecarFields` slot; vocabulary in
 * `procgenCore/sidecarFields.js`). Until G2a the entry carried the maze's
 * `TILE_GRID_SIDECAR_FIELDS` object (one payload shape for two substrates);
 * ⛔ none of the tile keys (`tiles`, `width`, `height`, `entrance`, `obstacles`,
 * `items`, the two libraries, `longestShortestPath`) is declared, so a payload
 * that still carries one is refused by name (`UNDECLARED_FIELD`).
 *
 * Envelope claims: `exits` and `fogEnabled` (`buildPresetSidecars` writes both on
 * every region). ⚠ `manaEnabled` is NOT claimed: the engine stamps it only when
 * the run opted into loop mode, and the committed top-down worlds carry none —
 * it stays the envelope's optional field.
 */
export const TEXT_ADVENTURE_SIDECAR_FIELDS = Object.freeze({
    exits: REQUIRED_ENVELOPE_FIELD,
    fogEnabled: REQUIRED_ENVELOPE_FIELD,
    exitGates: Object.freeze({
        type: 'object', required: true,
        description: 'The room\'s AUTHORED exit gates, `{exit_id: rule}` — the document\'s own rule tree for '
            + 'every gated exit (an ungated exit is absent; a back exit takes its forward exit\'s rule at '
            + 'compile). A sibling of the envelope\'s `exits`, because a substrate may not add a field to '
            + 'that record. Written by `serializeTextAdventureRoom`; a rebuild re-emits the exit rules from it.',
        schema: Object.freeze({ additionalProperties: RULE_TREE }),
    }),
    locations: Object.freeze({
        type: 'array', required: true,
        description: 'The room\'s locations `{name, item?, access_rule?}`: `name` is the AP location name '
            + '(baked from the extracted rules by `serializeTextAdventureRoom`), `item` the placed item, '
            + '`access_rule` the AUTHORED gate (absent = `True_`).',
        schema: Object.freeze({
            items: Object.freeze({
                type: 'object',
                required: Object.freeze(['name']),
                additionalProperties: false,
                properties: Object.freeze({
                    name: Object.freeze({ type: 'string', minLength: 1 }),
                    item: Object.freeze({ type: 'string' }),
                    access_rule: RULE_TREE,
                }),
            }),
        }),
    }),
});

/** The declaration merged with the envelope — the shape a room payload has. */
let mergedRoomFields = null;

/**
 * ⛔ The refusal sentence for a payload that is not a text-adventure room, or
 * `null` when it is one. Shape only (`UNDECLARED_FIELD` / `MISSING_REQUIRED`, and
 * a non-object): value errors are the corpus gate's to report, and so is an absent
 * ENVELOPE field (`fogEnabled` is the engine's to stamp after `serializeWorld`, so
 * the serializer's own output — which `deserializeWorld` must read back — has none).
 *
 * @param {unknown} payload
 * @returns {string|null}
 */
export function textAdventureRoomRefusal(payload) {
    mergedRoomFields ??= sidecarFieldsOf({ id: 'text_adventure', sidecarFields: TEXT_ADVENTURE_SIDECAR_FIELDS });
    const errors = sidecarPayloadErrors(mergedRoomFields, payload);
    if (errors.some((e) => e.field === null)) {
        return 'this is not a text-adventure room payload — playable_payload is not an object';
    }
    const E = SIDECAR_FIELD_ERRORS;
    const carried = errors.filter((e) => e.code === E.UNDECLARED_FIELD).map((e) => `\`${e.field}\``);
    const absent = errors.filter((e) => e.code === E.MISSING_REQUIRED
        && mergedRoomFields[e.field].owner === 'substrate').map((e) => `\`${e.field}\``);
    if (!carried.length && !absent.length) return null;
    const parts = [];
    if (carried.length) parts.push(`it carries ${carried.join(', ')}, which a room does not have`);
    if (absent.length) parts.push(`it lacks ${absent.join(', ')}, which every room payload carries`);
    return `this payload is not a text-adventure room — ${parts.join('; ')}. `
        + 'Only the room format is read (a tile-grid payload written before G2a is not): '
        + 'regenerate the region through the text adventure\'s own producer.';
}

/**
 * ⛓ The registry's `apLocationNamesOf` slot: every `locations[].name`, or `null`
 * when the payload carries no `locations` array — the slot's contract for "no
 * location carrier" (such a payload is not a room: the declaration and
 * `textAdventureRoomRefusal` refuse it).
 *
 * @param {object} payload
 * @returns {string[]|null}
 */
export function textAdventureApLocationNames(payload) {
    if (!Array.isArray(payload?.locations)) return null;
    return payload.locations.map((l) => l?.name).filter((n) => typeof n === 'string' && n !== '');
}

/**
 * ⛓ The registry's `exitSides` slot (`procgenCore/exitSides.js`): a text
 * adventure's side is WHERE ITS EXIT IS LISTED (the 3×3 compass) and nothing
 * else in its payload is keyed by a side — `exitGates` is keyed by `exit_id`. So
 * `keys` is EMPTY and the relabel is the identity (a clone: the op writes the
 * exits through this substrate's own serializer).
 */
export const TEXT_ADVENTURE_EXIT_SIDES = Object.freeze({
    keys: Object.freeze([]),
    relabel: (payload) => structuredClone(payload),
});
