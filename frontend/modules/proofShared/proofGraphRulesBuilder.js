// frontend/modules/proofShared/proofGraphRulesBuilder.js
//
// The shared core of the proof-graph rules builders (MetaMath, DepGraph).
// Both worlds have the same shape: one region per node, a location plus a
// locked event per node that is not a starting node, entrances from each
// dependency, and an entrance rule set by the 2-bit entrance_rule_mode. They
// differ only in names, slot_data keys and world metadata, which each game's
// spec supplies (metamathRulesBuilder.js, depgraphRulesBuilder.js).
//
// A spec holds:
//   game, logName, worldInfo   - the AP game name, the logger category, and the
//                                apworld metadata the server does not send
//   structureKey, startingKey  - the slot_data keys of the graph and the
//                                starting node list
//   itemName/locationName/eventName(i)  - the generic DataPackage names
//   itemIndexOf(name), locationIndexOf(name)  - their inverses (NaN if none)
//   itemGroup                  - the world's one item group
//   entranceLabels(nodes)      - Map index -> label used in entrance names
//   meaningfulNames(node, deps) - { item, location, event } display names
//   worldFields(nodes, slotData) - the world's own extra fields
//   applyOptions(options, slotData) - fills the options slot_data carries

import { makeExit, makeRegion, makeTrueRule } from '../shared/rulesJsonBuilder.js';

function makeLog(category) {
  return (level, message, ...data) => {
    if (typeof window !== 'undefined' && window.logger) {
      window.logger[level](category, message, ...data);
    } else {
      const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
      consoleMethod(`[${category}] ${message}`, ...data);
    }
  };
}

// Python's `s[:n]` counts code points, not UTF-16 units.
export function truncate(text, maxLength) {
  const chars = Array.from(text);
  return chars.length > maxLength ? chars.slice(0, maxLength - 3).join('') + '...' : text;
}

/** "0.6.8" from RoomInfo.version ({ major, minor, build }), or null. */
export function versionString(version) {
  if (!version || typeof version !== 'object') return typeof version === 'string' ? version : null;
  const { major, minor, build } = version;
  return [major, minor, build].every(Number.isInteger) ? `${major}.${minor}.${build}` : null;
}

/**
 * The entrance rule mode from slot_data, or the world default (with a
 * warning) when the server's apworld did not send it.
 */
export function entranceRuleModeOf(spec, slotData) {
  const mode = slotData?.entrance_rule_mode;
  if (Number.isInteger(mode) && mode >= 0 && mode <= 3) return mode;
  const fallback = spec.worldInfo.option_definitions.entrance_rule_mode.default;
  makeLog(spec.logName)(
    'warn',
    `slot_data has no valid entrance_rule_mode (${JSON.stringify(mode)}); ` +
      `using the world default ${fallback}. The server's ${spec.game} apworld predates sending it.`
  );
  return fallback;
}

/** The numeric value of a choice option whose key slot_data names (the key itself when unknown). */
export function choiceValueOf(worldInfo, option, key) {
  const lookup = worldInfo.option_definitions[option].name_lookup;
  const value = Object.keys(lookup).find((k) => lookup[k] === key);
  return value !== undefined ? Number(value) : key;
}

/**
 * @param {Object} spec - The game's spec (see the file header)
 * @param {Object} slotData - Connected.slot_data for the slot
 * @param {Array<Object>} scoutedLocations - The slot's scouted locations
 *   (messageHandler._handleLocationInfo entries: locationId, itemName,
 *   player, progression, …). Item names are the RECEIVING game's.
 * @param {Object} playerContext
 * @param {number} playerContext.slot - Our slot number
 * @param {Object<string,string>} playerContext.names - slot number -> player name (every slot)
 * @param {string|null} playerContext.seedName - RoomInfo.seed_name
 * @param {string} [playerContext.game] - The slot's game (slot_info)
 * @param {Object<string,number>} playerContext.itemNameToId - The game's DataPackage items
 * @param {Object<string,number>} playerContext.locationNameToId - The game's DataPackage locations
 * @param {string|null} [playerContext.archipelagoVersion] - The server's version, e.g. "0.6.8"
 * @returns {Object} A schema-v3 rules.json for that one player
 */
export function buildProofGraphRules(spec, slotData, scoutedLocations, playerContext) {
  const log = makeLog(spec.logName);
  const { itemName, locationName, eventName, worldInfo } = spec;
  const structure = slotData?.[spec.structureKey];
  if (!structure || typeof structure !== 'object') {
    throw new Error(`${spec.game} slot_data has no ${spec.structureKey}`);
  }
  const {
    slot,
    names = {},
    seedName = null,
    game = spec.game,
    itemNameToId = {},
    locationNameToId = {},
    archipelagoVersion = null,
  } = playerContext || {};
  if (!Number.isInteger(slot)) throw new Error('playerContext.slot must be the slot number');
  const p = String(slot);

  const mode = entranceRuleModeOf(spec, slotData);
  const relaxItems = (mode & 1) !== 0;
  const relaxEvents = (mode & 2) !== 0;
  const randomizeItems = !!slotData.randomize_items;
  const vanilla = !!slotData.vanilla_placement;

  // ── The graph ──
  const nodes = Object.entries(structure)
    .map(([key, node]) => ({ index: Number(key), ...node }))
    .filter((node) => Number.isInteger(node.index))
    .sort((a, b) => a.index - b.index);
  const N = nodes.length;
  const dependencyGraph = new Map(); // index -> sorted unique dependency indices
  const reverseDependencies = new Map(); // index -> Set of dependents
  for (const node of nodes) {
    const deps = [...new Set(node.dependencies || [])].sort((a, b) => a - b);
    dependencyGraph.set(node.index, deps);
    for (const d of deps) {
      if (!reverseDependencies.has(d)) reverseDependencies.set(d, new Set());
      reverseDependencies.get(d).add(node.index);
    }
  }
  const startingList = (slotData[spec.startingKey] || []).map(Number);
  const starting = new Set(startingList);

  const entranceLabels = spec.entranceLabels(nodes);
  const entranceLabel = (i) => entranceLabels.get(i) ?? itemName(i);

  // ── Placements, by location ID ──
  const scoutsById = new Map();
  for (const entry of scoutedLocations || []) scoutsById.set(Number(entry.locationId), entry);

  // ── Regions (create_regions + the world's set_*_rules) ──
  const depNames = (deps) => deps.flatMap((d) => [itemName(d), eventName(d)]);
  const entranceRule = (source, target) => {
    const deps = dependencyGraph.get(target);
    const required = new Set();
    if (!relaxItems && !relaxEvents) {
      depNames(deps).forEach((n) => required.add(n));
    } else {
      const validSource = deps.includes(source);
      if (relaxEvents && validSource) required.add(eventName(source));
      else deps.forEach((d) => required.add(eventName(d)));
      if (relaxItems && validSource) required.add(itemName(source));
      else deps.forEach((d) => required.add(itemName(d)));
    }
    return { rule: 'HasAll', args: { item_names: [...required].sort() } };
  };

  const regions = { Menu: makeRegion('Menu') };
  for (const node of nodes) {
    if (dependencyGraph.get(node.index).length === 0) {
      regions.Menu.exits.push(makeExit(`To ${entranceLabel(node.index)}`, locationName(node.index), makeTrueRule()));
    }
  }
  const missingScouts = [];
  for (const { index: i } of nodes) {
    const region = makeRegion(locationName(i));
    if (!starting.has(i)) {
      const name = locationName(i);
      if (Object.prototype.hasOwnProperty.call(locationNameToId, name)) {
        const id = Number(locationNameToId[name]);
        const location = { name, id, access_rule: makeTrueRule() };
        const scout = scoutsById.get(id);
        if (scout) {
          location.item = {
            name: scout.itemName,
            player: scout.player,
            advancement: !!scout.progression,
            type: 'None',
          };
        } else {
          missingScouts.push(name);
        }
        // pre_fill locks the final node; without randomization, every one
        location.locked = i === N || !randomizeItems;
        region.locations.push(location);
      }
      region.locations.push({
        name: eventName(i),
        id: null,
        access_rule: makeTrueRule(),
        item: { name: eventName(i), player: slot, advancement: true, type: 'None' },
        locked: true,
        event: true,
      });
    }
    for (const d of [...(reverseDependencies.get(i) || [])].sort((a, b) => a - b)) {
      region.exits.push(
        makeExit(`From ${entranceLabel(i)} to ${entranceLabel(d)}`, locationName(d), entranceRule(i, d))
      );
    }
    // The exporter marks a region with no locations and no exits (a starting
    // node nothing depends on) as dynamically_added.
    if (region.locations.length === 0 && region.exits.length === 0) region.dynamically_added = true;
    regions[region.name] = region;
  }
  if (missingScouts.length > 0) {
    log('warn', `No scouted item for ${missingScouts.length} location(s): ${missingScouts.join(', ')}`);
  }

  // ── Items: the DataPackage's nodes, then the events ──
  const items = {};
  for (const [name, id] of Object.entries(itemNameToId).sort((a, b) => a[1] - b[1])) {
    const index = spec.itemIndexOf(name);
    items[name] = {
      name,
      id: Number(id),
      // Every item is a node (the world's one item group).
      groups: ['Everything', spec.itemGroup],
      // Nodes in this graph are progression; the table's others are unused.
      classification: index >= 1 && index <= N ? 'progression' : 'filler',
      type: null,
      max_count: 1,
    };
  }
  for (const { index: i } of nodes) {
    if (starting.has(i)) continue;
    items[eventName(i)] = {
      name: eventName(i),
      id: null,
      groups: ['Event'],
      classification: 'progression',
      event: true,
      type: 'Event',
      max_count: 1,
    };
  }
  // Other games' items placed in our locations, named and classified as the
  // exporter does (its classification keeps the highest flag only).
  for (const scout of scoutsById.values()) {
    if (scout.player === slot || !scout.itemName || scout.itemName in items) continue;
    items[scout.itemName] = {
      name: scout.itemName,
      id: scout.itemId ?? null,
      groups: [],
      classification: scout.progression ? 'progression' : scout.useful ? 'useful' : scout.trap ? 'trap' : 'filler',
      type: null,
      max_count: 1,
    };
  }
  // generate_basic precollects each starting node's event
  for (const i of startingList) {
    items[eventName(i)] = {
      name: eventName(i),
      id: null,
      groups: [],
      classification: 'progression',
      event: true,
      type: null,
      max_count: 1,
    };
  }

  const itempoolCounts = {};
  for (const name of nodes.flatMap(({ index }) => [itemName(index), eventName(index)]).sort()) {
    itempoolCounts[name] = 1;
  }

  const canonicalPlacements = {};
  for (const { index: i } of nodes) {
    if (!starting.has(i) && i !== N) canonicalPlacements[locationName(i)] = itemName(i);
  }

  // ── World metadata (generate_early, set_rules) ──
  const nameSubstitutions = { items: {}, locations: {}, regions: {} };
  for (const node of nodes) {
    const i = node.index;
    const meaningful = spec.meaningfulNames(node, dependencyGraph.get(i));
    if (itemName(i) !== meaningful.item) nameSubstitutions.items[itemName(i)] = meaningful.item;
    if (eventName(i) !== meaningful.event) nameSubstitutions.items[eventName(i)] = meaningful.event;
    if (locationName(i) !== meaningful.location) {
      nameSubstitutions.locations[locationName(i)] = meaningful.location;
      nameSubstitutions.regions[locationName(i)] = meaningful.location;
    }
  }

  // The exporter's per-name dependency maps, walked in region order as set_rules does.
  const locationDependencies = {};
  const entranceDependencies = {};
  const exitDependencies = {};
  for (const region of Object.values(regions)) {
    const i = region.name === 'Menu' ? null : spec.locationIndexOf(region.name);
    const deps = i === null ? [] : dependencyGraph.get(i) || [];
    if (deps.length > 0) {
      for (const location of region.locations) locationDependencies[location.name] = depNames(deps);
    }
    for (const exit of region.exits) {
      const targetDeps = dependencyGraph.get(spec.locationIndexOf(exit.connected_region)) || [];
      if (targetDeps.length > 0) {
        entranceDependencies[exit.name] = depNames(targetDeps);
        exitDependencies[exit.name] = depNames(targetDeps);
      }
    }
  }

  const options = { ...worldInfo.default_options, entrance_rule_mode: mode };
  if ('randomize_items' in slotData) options.randomize_items = randomizeItems;
  if ('vanilla_placement' in slotData) options.vanilla_placement = vanilla;
  if (!randomizeItems) options.accessibility = 2; // generate_early: minimal
  spec.applyOptions(options, slotData, { vanilla });

  const world = {
    game,
    world_class_name: worldInfo.world_class_name,
    options,
    option_definitions: worldInfo.option_definitions,
    ...spec.worldFields(nodes, slotData),
    name_substitutions: nameSubstitutions,
    canonical_placements: canonicalPlacements,
    location_dependencies: locationDependencies,
    entrance_dependencies: entranceDependencies,
    exit_dependencies: exitDependencies,
    world_description: worldInfo.world_description,
    slot_data: slotData,
    web: worldInfo.web,
    world_directory: worldInfo.world_directory,
  };
  if (vanilla) world.is_vanilla = true;

  const playerNames = {};
  for (const [key, name] of Object.entries(names)) playerNames[String(key)] = name;
  if (!(p in playerNames)) playerNames[p] = `Player${p}`;

  const rules = {
    schema_version: 3,
    game_name: game,
    game_directory: worldInfo.game_directory,
    playerId: p,
    archipelago_version: archipelagoVersion || 'unknown',
    // The server does not send the generation seed.
    generation_seed: 0,
    player_names: playerNames,
    regions: { [p]: regions },
    start_regions: { [p]: { default: ['Menu'], available: [] } },
    items: { [p]: items },
    item_groups: { [p]: ['Everything', spec.itemGroup] },
    itempool_counts: { [p]: itempoolCounts },
    canonical_placements: { [p]: canonicalPlacements },
    progression_mapping: { [p]: {} },
    starting_items: { [p]: startingList.flatMap((i) => [itemName(i), eventName(i)]) },
    preset_sidecars: {},
    world: { [p]: world },
    exporter: {},
    game_info: { [p]: { completion_condition: { type: 'item_check', item: eventName(N) } } },
    helpers: {},
  };
  if (seedName) rules.seed_name = String(seedName);
  if (vanilla) rules.is_vanilla = { [p]: true };
  return rules;
}
