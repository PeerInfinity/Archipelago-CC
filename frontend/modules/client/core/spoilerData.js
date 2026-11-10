// client/core/spoilerData.js
//
// The room's spoiler data: slot_data.spoiler_data, written at generation by the
// optional Spoiler Export Hook apworld (worlds/spoiler_export_hook/) for a slot
// whose world asked for it (option spoiler_data_in_slot_data). It is expanded
// here, with the server's DataPackage, into the incremental sphere-log lines
// sphereState.loadSphereLog already parses, and handed to sphereState, which
// uses it only when no file's log is loaded (a file always beats the room).
//
// The record (format 1):
//   { format, seed_name, player, start: [item…], unreachable,
//     steps: [[walk label, own location | null, item received | null, ([sender player, sender location])?]…],
//     regions?: { start: [region…], steps: [[row index, [region…]]…] } }
// Each item or location is the AP id when the game's DataPackage gives back
// that exact name, otherwise the name (events have no id; ALttP's Progressive
// Bow carries an id the package resolves to "Progressive Bow (Alt)"). The 4th
// element is there only with own_slot_with_senders, and only on a row whose
// item comes from another player's location; that location follows the same
// id rule against the SENDER's game. `regions` is there only with the world's
// spoiler_data_include_regions option: the regions first reachable at the
// start and after each listed row (names; regions have no ids).
//
// The lines are those of the exporter's per-player sphere log
// (json_tools.sphere_log_per_player) for the same seed: the own player's
// entry, and on a step whose item another world sends, that world's entry
// limited to that location, with empty deltas. A test holds the two equal.

export const SPOILER_DATA_KEY = 'spoiler_data';
export const SPOILER_DATA_OMITTED_KEY = 'spoiler_data_omitted';
/** The record formats this client reads (the helper's FORMAT). */
export const SPOILER_DATA_FORMATS = new Set([1]);

const NO_DATA = 'This room has no spoiler data';
const OMITTED_REASONS = {
  hook_absent: 'the generator did not have the Spoiler Export Hook',
  hook_broken: "the generator's Spoiler Export Hook failed to import",
  hook_failed: 'the Spoiler Export Hook failed while the seed was generated',
  api_mismatch: "this world and the generator's Spoiler Export Hook are incompatible versions",
  race: 'it is never sent in a race seed',
  not_prepared: 'the world asked for it, but the Spoiler Export Hook did not run for it',
};

/** The console line for slot_data.spoiler_data_omitted. */
export function describeOmitted(omitted) {
  const reason = omitted?.reason;
  if (reason === 'over_cap') {
    return `${NO_DATA}: it was ${omitted.size_bytes} bytes, over the Spoiler Export Hook's ${omitted.cap_bytes}-byte limit.`;
  }
  return `${NO_DATA}: ${OMITTED_REASONS[reason] ?? `the generator gave the reason "${reason ?? 'none'}"`}.`;
}

/** { id: name } from a DataPackage game's name_to_id table. */
function invert(nameToId) {
  const out = new Map();
  for (const [name, id] of Object.entries(nameToId || {})) out.set(Number(id), name);
  return out;
}

/**
 * Lookup tables for one record from the server's DataPackage and slot_info:
 * the slot's own game, and each sender's game (by player number).
 */
export function tablesFromDataPackage(dataPackage, slotInfo, player) {
  const games = dataPackage?.games || {};
  const gameOf = (p) => slotInfo?.[String(p)]?.game;
  const cache = new Map();
  const tablesOf = (game) => {
    if (!cache.has(game)) {
      cache.set(game, {
        items: invert(games[game]?.item_name_to_id),
        locations: invert(games[game]?.location_name_to_id),
      });
    }
    return cache.get(game);
  };
  const own = tablesOf(gameOf(player));
  return {
    itemIdToName: own.items,
    locationIdToName: own.locations,
    senderLocationIdToName: (sender) => tablesOf(gameOf(sender)).locations,
  };
}

const nameFrom = (table, value, kind) =>
  typeof value === 'number' ? (table.get(value) ?? `${kind} ${value}`) : value;

/**
 * slot_data.spoiler_data → sphere-log lines ({type:'metadata'}, then one
 * incremental state_update per step), or null for a format this client does
 * not read. A row with a sender also gives its state_update the sender's entry,
 * `player_data[sender] = { empty deltas, sphere_locations: [sender location] }`,
 * as the per-player file has it. Regions, when sent, fill
 * `new_accessible_regions` (the start list on sphere 0).
 */
export function expandSpoilerData(record, tables) {
  if (!SPOILER_DATA_FORMATS.has(record?.format)) return null;
  const p = String(record.player);
  const item = (v) => nameFrom(tables.itemIdToName, v, 'Item');
  const location = (v) => nameFrom(tables.locationIdToName, v, 'Location');
  const steps = record.steps || [];
  const startItems = {};
  for (const v of record.start || []) startItems[item(v)] = (startItems[item(v)] ?? 0) + 1;
  // The rows sent by name: events, plus any coded name that does not round-trip (as the prototype measured).
  const eventLocations = [...new Set(steps.filter(([, l]) => typeof l === 'string').map(([, l]) => l))].sort();
  const eventItems = [...new Set(steps.filter(([, , i]) => typeof i === 'string').map(([, , i]) => i))].sort();
  const regionsAt = new Map(record.regions?.steps || []);
  const update = (baseItems, sphereLocations, regions = []) => ({
    new_inventory_details: { base_items: baseItems, resolved_items: {} },
    new_accessible_locations: [],
    new_accessible_regions: regions,
    sphere_locations: sphereLocations,
  });
  const lines = [
    {
      type: 'metadata',
      seed_name: record.seed_name,
      source: 'room spoiler_data',
      // As the per-player file's metadata: the senders' entries on later lines do not make it their log.
      filtered_to_player: p,
      event_locations: { [p]: eventLocations },
      event_items: { [p]: eventItems },
    },
    {
      type: 'state_update',
      sphere_index: '0',
      player_data: { [p]: update(startItems, [], record.regions?.start || []) },
    },
  ];
  steps.forEach(([label, own, received, sender], index) => {
    const playerData = {
      [p]: update(received === null ? {} : { [item(received)]: 1 }, own === null ? [] : [location(own)],
        regionsAt.get(index) || []),
    };
    if (Array.isArray(sender)) {
      const [senderPlayer, senderLocation] = sender;
      playerData[String(senderPlayer)] =
        update({}, [nameFrom(tables.senderLocationIdToName(senderPlayer), senderLocation, 'Location')]);
    }
    lines.push({ type: 'state_update', sphere_index: label, player_data: playerData });
  });
  return lines;
}

/**
 * What the room's slot_data says about spoiler data for our slot:
 *   { log: { source, text, entries } } - a record to load;
 *   { message, type }                  - one console line (omitted, or a record this client can't use);
 *   null                               - neither key: say nothing.
 */
export function readRoomSpoilerData(slotData, { dataPackage, slotInfo, slot, seedName = null }) {
  const record = slotData?.[SPOILER_DATA_KEY];
  if (record === undefined || record === null) {
    const omitted = slotData?.[SPOILER_DATA_OMITTED_KEY];
    return omitted ? { message: describeOmitted(omitted), type: 'info' } : null;
  }
  if (!SPOILER_DATA_FORMATS.has(record?.format)) {
    return {
      message: `Not using this room's spoiler data: it is format ${JSON.stringify(record?.format)}, and this ` +
        `client reads format ${[...SPOILER_DATA_FORMATS].join(', ')}. Update the client, or the Spoiler Export Hook.`,
      type: 'warning',
    };
  }
  if (String(record.player) !== String(slot)) {
    return { message: `Not using this room's spoiler data: it is for slot ${record.player}, not ${slot}.`, type: 'warning' };
  }
  if (seedName && record.seed_name && String(record.seed_name) !== String(seedName)) {
    return {
      message: `Not using this room's spoiler data: it is for seed ${record.seed_name}, not the room's ${seedName}.`,
      type: 'warning',
    };
  }
  const game = slotInfo?.[String(slot)]?.game;
  if (!dataPackage?.games?.[game]) {
    return {
      message: `Not using this room's spoiler data: the server's DataPackage has no ${game ?? `game for slot ${slot}`}, ` +
        'so its ids cannot be read.',
      type: 'warning',
    };
  }
  const lines = expandSpoilerData(record, tablesFromDataPackage(dataPackage, slotInfo, slot));
  return {
    log: {
      source: `room:${record.seed_name ?? 'seedless'}:P${slot}`,
      text: lines.map((line) => JSON.stringify(line)).join('\n'),
      entries: lines.length - 1,
    },
  };
}
