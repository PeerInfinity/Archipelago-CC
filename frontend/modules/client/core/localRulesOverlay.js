// client/core/localRulesOverlay.js
//
// A room whose world was GENERATED from a rules.json the player already has (a
// world_generator package, an APCalc puzzle built by the APCalc Generator panel)
// takes its static logic from that local file. The server supplies only what
// generation decided: the placements (LocationInfo scouts), slot_data and the
// starting inventory (ReceivedItems, location -2; see the starting-items plain
// rule in statePersistence.applyRuntimeState).
//
// Measured (2026-11-05, sdc-local-rules-placements): two seeds of one
// world_generator world differ only in `generation_seed`, `seed_name`, the
// placements and `world[p].options.randomize_items`. So the local file plus
// those is the room's rules.json.
//
// ⚖ Only OUR generated worlds (user, 2026-11-05): an upstream game at another
// seed can differ in options or entrance shuffle while its IDs still match.
// "Ours" is the marker below; a document without it is used as before.

import { foreignItemFromScout } from '../../proofShared/proofGraphRulesBuilder.js';
import { refuseRetiredTopLevelKeys } from '../../stateManager/core/initialization.js';
import { SPOILER_DATA_KEY, SPOILER_DATA_OMITTED_KEY } from './spoilerData.js';

/** The option every world_generator world has, and no upstream world. */
export const GENERATED_WORLD_OPTION = 'use_canonical_options';

// ---- The rules a world_generator world sends in slot_data -------------------
//
// A world_generator package ships its own rules document (no placements) and
// sends it in slot_data as `worldgen_rules`: `{format, player, doc}`
// (world_generator/_embedded_rules.py). A document over the slot's
// rules_in_slot_data_max_kb is not sent; `worldgen_rules_omitted` says so.

export const WORLDGEN_RULES_KEY = 'worldgen_rules';
export const WORLDGEN_RULES_OMITTED_KEY = 'worldgen_rules_omitted';

/**
 * The envelope format this client reads. It is world_generator's
 * WORLDGEN_RULES_FORMAT (world_generator/_embedded_rules.py; a test holds the
 * two equal). ⛔ Bump BOTH whenever stateManager's RETIRED_TOP_LEVEL_KEYS
 * grows, and record the new key set in RETIRED_KEYS_AT_FORMAT: a document
 * frozen into an older package then fails by name ("built by an older
 * generator") instead of with a generic refusal.
 */
export const WORLDGEN_RULES_FORMAT = 1;

/** RETIRED_TOP_LEVEL_KEYS when WORLDGEN_RULES_FORMAT was last bumped (a test holds it current). */
export const RETIRED_KEYS_AT_FORMAT = Object.freeze([
  'assume_bidirectional_exits', 'region_atlas', 'flash_panel', 'provenance', 'is_vanilla',
  'is_canonical', 'preset_label', 'entrance_randomization',
]);

/**
 * Reads the server's `worldgen_rules` envelope: `{doc, player}` when this
 * client can load it, else `{refusal}` (one sentence naming why).
 *
 * @param {*} envelope - slot_data.worldgen_rules
 * @returns {{doc: Object, player: string}|{refusal: string}}
 */
export function readWorldgenRules(envelope) {
  if (!isPlainObject(envelope) || !isPlainObject(envelope.doc) || envelope.player === undefined) {
    return { refusal: 'the server sent a malformed worldgen_rules' };
  }
  const format = Number(envelope.format);
  if (!(format === WORLDGEN_RULES_FORMAT)) {
    const older = Number.isFinite(format) && format < WORLDGEN_RULES_FORMAT;
    return {
      refusal:
        `this room's world was built by ${older ? 'an older' : 'a newer'} world generator ` +
        `(rules format ${envelope.format}; this client reads format ${WORLDGEN_RULES_FORMAT})`,
    };
  }
  const player = String(envelope.player);
  if (!isPlainObject(envelope.doc.world?.[player])) {
    return { refusal: `the server's worldgen_rules has no world for its player ${player}` };
  }
  try {
    refuseRetiredTopLevelKeys(envelope.doc);
  } catch (e) {
    return { refusal: `this room's world was built by an older world generator (${e.message})` };
  }
  return { doc: envelope.doc, player };
}

/**
 * slot_data without what the server carries for the client rather than for the
 * world: the rules document, the room's spoiler data (client/core/spoilerData.js),
 * and each one's note. They are not the world's slot_data.
 */
const TRANSPORT_KEYS = [WORLDGEN_RULES_KEY, WORLDGEN_RULES_OMITTED_KEY, SPOILER_DATA_KEY, SPOILER_DATA_OMITTED_KEY];
export function slotDataWithoutRules(slotData) {
  if (!isPlainObject(slotData)) return slotData;
  if (!TRANSPORT_KEYS.some((key) => key in slotData)) return slotData;
  const out = { ...slotData };
  for (const key of TRANSPORT_KEYS) delete out[key];
  return out;
}

const PLAYER_KEY = /^\d+$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Whether the document's world for `player` was generated from a rules.json:
 * its options include world_generator's `use_canonical_options`. Census over
 * the committed presets (2026-11-05): 24 of 24 world_generator slots carry it,
 * 0 of 212 others. The APCalc Generator panel writes it too (its puzzles are
 * built by world_generator).
 */
export function isGeneratedWorldDoc(doc, player) {
  const options = doc?.world?.[String(player)]?.options;
  return isPlainObject(options) && Object.prototype.hasOwnProperty.call(options, GENERATED_WORLD_OPTION);
}

/** The document's ID-bearing locations of `player`: name -> id. */
function idLocationsOf(doc, player) {
  const out = new Map();
  for (const region of Object.values(doc?.regions?.[String(player)] || {})) {
    for (const location of region?.locations || []) {
      if (location?.id !== null && location?.id !== undefined) out.set(location.name, Number(location.id));
    }
  }
  return out;
}

function listSome(names, max = 5) {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown}, … (${names.length} in all)` : shown;
}

/**
 * Is the local document this room's world? Checked against what the server
 * sends anyway: the slot's game, its location IDs (Connected missing ∪
 * checked) and the game's DataPackage name tables.
 *
 * @param {Object} doc - The local rules.json
 * @param {string|number} player - The document's player for this world
 * @param {Object} room
 * @param {string} room.slotGame - slot_info[slot].game
 * @param {Iterable<number>} room.locationIds - The slot's location IDs
 * @param {Object} room.itemNameToId - DataPackage item_name_to_id of the game
 * @param {Object} room.locationNameToId - DataPackage location_name_to_id of the game
 * @returns {{ok: boolean, problems: string[]}}
 */
export function checkLocalWorld(doc, player, { slotGame, locationIds, itemNameToId = {}, locationNameToId = {} }) {
  const p = String(player);
  const problems = [];
  const docGame = doc?.world?.[p]?.game ?? doc?.game_name ?? null;
  if (docGame !== slotGame) problems.push(`the file is for ${docGame}, the slot plays ${slotGame}`);

  const docLocations = idLocationsOf(doc, p);
  const wrongIds = [];
  for (const [name, id] of docLocations) {
    if (Number(locationNameToId[name]) !== id) wrongIds.push(name);
  }
  if (wrongIds.length) problems.push(`${wrongIds.length} location ID(s) differ from the server's: ${listSome(wrongIds)}`);
  const docIds = new Set(docLocations.values());
  const serverIds = new Set([...(locationIds || [])].map(Number));
  const notInFile = [...serverIds].filter((id) => !docIds.has(id));
  const notOnServer = [...docLocations].filter(([, id]) => !serverIds.has(id)).map(([name]) => name);
  if (notInFile.length) problems.push(`${notInFile.length} server location(s) are not in the file: ${listSome(notInFile)}`);
  if (notOnServer.length) problems.push(`${notOnServer.length} file location(s) are not on the server: ${listSome(notOnServer)}`);

  const wrongItems = [];
  for (const item of Object.values(doc?.items?.[p] || {})) {
    if (item?.id === null || item?.id === undefined) continue;
    if (Number(itemNameToId[item.name]) !== Number(item.id)) wrongItems.push(item.name);
  }
  if (wrongItems.length) problems.push(`${wrongItems.length} item ID(s) differ from the server's: ${listSome(wrongItems)}`);
  return { ok: problems.length === 0, problems };
}

/**
 * The document's per-player maps: top-level objects keyed only by player
 * numbers (`regions`, `items`, `world`, `procgen_metadata`, …). Derived from
 * the document's shape, so a new per-player block needs no edit here
 * (localRulesOverlay.test.js holds this equal to the schema's list).
 */
export function perPlayerKeysOf(doc) {
  return Object.keys(doc || {}).filter((key) => {
    const value = doc[key];
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((k) => PLAYER_KEY.test(k));
  });
}

/**
 * The room's one-player rules.json: the local document's world for `player`,
 * moved to the room slot, with the server's placements and slot_data.
 *
 * - every ID-bearing location's item comes from its scout; other games' items
 *   join `items` as the exporter names them;
 * - `world[slot].slot_data` is the server's when it sent any (minus the
 *   rules document it may carry), and each of its keys that is one of the
 *   document's options sets that option;
 * - each procgen pickup's sidecar `id` is the item placed at its location;
 * - `seed_name` is the room's, `player_names` the room's slots;
 * - `sphere_log` is dropped (it describes the file's placements, not these);
 * - starting items are left alone: ID-bearing ones arrive as ReceivedItems.
 *
 * @param {Object} doc
 * @param {string|number} player
 * @param {Object} ctx
 * @param {number} ctx.slot
 * @param {Object} ctx.names - slot (string) -> player name, every slot
 * @param {string|null} ctx.seedName
 * @param {Object} ctx.slotData - Connected.slot_data
 * @param {Array<Object>} ctx.scouts - The slot's scouted locations (_handleLocationInfo entries)
 * @returns {Object}
 */
export function overlayServerData(doc, player, { slot, names = {}, seedName = null, slotData = {}, scouts = [] }) {
  const p = String(player);
  const s = String(slot);
  const slotNumber = Number(slot);
  const perPlayer = new Set(perPlayerKeysOf(doc));
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === 'sphere_log') continue;
    if (perPlayer.has(key)) {
      if (Object.prototype.hasOwnProperty.call(value, p)) out[key] = { [s]: structuredClone(value[p]) };
      continue;
    }
    out[key] = structuredClone(value);
  }
  out.seed_name = seedName ?? '';
  // A per-player slice names its player, as the exporter's _P<N> files do.
  out.playerId = s;
  out.player_names = Object.keys(names).length > 0 ? { ...names } : { [s]: doc.player_names?.[p] ?? `Player${s}` };

  const scoutsById = new Map();
  for (const scout of scouts || []) scoutsById.set(Number(scout.locationId), scout);
  const missing = [];
  const docPlayerNumber = Number(p);
  for (const region of Object.values(out.regions?.[s] || {})) {
    for (const location of region?.locations || []) {
      if (location?.id === null || location?.id === undefined) {
        // An event (no address, never scouted) stays the file's, but it now
        // belongs to the room slot.
        if (location?.item && Number(location.item.player) === docPlayerNumber) location.item.player = slotNumber;
        continue;
      }
      const scout = scoutsById.get(Number(location.id));
      if (!scout?.itemName) {
        missing.push(location.name);
        continue;
      }
      location.item = {
        name: scout.itemName,
        player: scout.player,
        advancement: !!scout.progression,
        type: location.item?.type ?? 'None',
      };
    }
  }
  if (missing.length) throw new Error(`no scouted item for ${missing.length} location(s): ${listSome(missing)}`);

  const items = out.items?.[s];
  if (items) {
    for (const scout of scoutsById.values()) {
      if (scout.player === slotNumber || !scout.itemName || scout.itemName in items) continue;
      items[scout.itemName] = foreignItemFromScout(scout);
    }
    for (const scout of scoutsById.values()) {
      if (scout.player === slotNumber && scout.itemName && !(scout.itemName in items)) {
        throw new Error(`the server placed ${scout.itemName}, which the file has no item for`);
      }
    }
  }

  // A procgen pickup's sidecar entry names the item it shows (playable_payload.items[].id, beside its
  // locationName): the room's item there, not the document's. A maze draws and collects a pickup only
  // when its id is set (mazeRoomRender / detectStepEvents), and a server-sent document carries none.
  const placedItem = new Map();
  for (const region of Object.values(out.regions?.[s] || {})) {
    for (const location of region?.locations || []) {
      if (location?.name && location.item?.name) placedItem.set(location.name, location.item.name);
    }
  }
  for (const sidecar of Object.values(out.preset_sidecars?.[s] || {})) {
    for (const item of sidecar?.playable_payload?.items || []) {
      if (isPlainObject(item) && item.locationName && placedItem.has(item.locationName)) {
        item.id = placedItem.get(item.locationName);
      }
    }
    // The Seedling generated rooms name it on the payload's own location list instead.
    for (const location of sidecar?.playable_payload?.locations || []) {
      if (isPlainObject(location) && location.name && placedItem.has(location.name)) {
        location.item = placedItem.get(location.name);
      }
    }
  }

  slotData = slotDataWithoutRules(slotData);
  const world = out.world?.[s];
  if (world && isPlainObject(slotData) && Object.keys(slotData).length > 0) {
    world.slot_data = structuredClone(slotData);
    if (isPlainObject(world.options)) {
      for (const [key, value] of Object.entries(slotData)) {
        if (Object.prototype.hasOwnProperty.call(world.options, key)) world.options[key] = structuredClone(value);
      }
    }
  }
  return out;
}
