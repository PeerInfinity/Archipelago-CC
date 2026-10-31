// frontend/modules/proofShared/metamathRulesBuilder.js
//
// Builds a MetaMath rules.json (schema v3, one player) from what the AP
// server sends: the slot's slot_data plus the scouted contents of its
// locations. The client uses it when it connects to a MetaMath slot that no
// committed preset matches (see client/core/serverDataRules.js).
//
// Every logic field derives from slot_data.proof_structure,
// starting_statements and entrance_rule_mode. This mirrors the Python world:
//   worlds/metamath/__init__.py  _build_name_maps, generate_early,
//                                create_regions, set_rules, generate_basic
//   worlds/metamath/Rules.py     set_metamath_rules
//   worlds/metamath/Items.py / Locations.py  display-name helpers
// metamathRulesBuilder.test.js holds the output equal to the exporter's
// rules.json for every committed MetaMath preset and all four entrance rule
// modes, so a change on either side shows up there.

import { makeExit, makeRegion, makeTrueRule } from '../shared/rulesJsonBuilder.js';
import WORLD_INFO from './metamathWorldInfo.json' with { type: 'json' };

export const METAMATH_GAME = 'Metamath';

// The world's default (worlds/metamath/Options.py EntranceRuleMode), used when
// slot_data comes from a server whose apworld predates sending the mode.
const DEFAULT_ENTRANCE_RULE_MODE = WORLD_INFO.option_definitions.entrance_rule_mode.default;

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('metamathRulesBuilder', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[metamathRulesBuilder] ${message}`, ...data);
  }
}

const itemName = (i) => `Statement ${i}`;
const locationName = (i) => `Prove Statement ${i}`;
const eventName = (i) => `Proved Statement ${i}`;

// Python's `s[:n]` counts code points, not UTF-16 units.
function truncate(text, maxLength) {
  const chars = Array.from(text);
  return chars.length > maxLength ? chars.slice(0, maxLength - 3).join('') + '...' : text;
}

// Items.statement_item_name
function statementItemName(label, expression) {
  return label ? `${label}: ${truncate(expression, 60)}` : expression;
}

// Locations.statement_location_name and Items.proved_item_name (same shape, length 50)
function prefixedName(prefix, label, expression) {
  return label ? `${prefix} ${label}: ${truncate(expression, 50)}` : `${prefix} ${expression}`;
}

/**
 * The entrance rule mode from slot_data, or the world default (with a
 * warning) when the server's apworld did not send it.
 */
export function entranceRuleModeOf(slotData) {
  const mode = slotData?.entrance_rule_mode;
  if (Number.isInteger(mode) && mode >= 0 && mode <= 3) return mode;
  log(
    'warn',
    `slot_data has no valid entrance_rule_mode (${JSON.stringify(mode)}); ` +
      `using the world default ${DEFAULT_ENTRANCE_RULE_MODE}. The server's MetaMath apworld predates sending it.`
  );
  return DEFAULT_ENTRANCE_RULE_MODE;
}

/** "0.6.8" from RoomInfo.version ({ major, minor, build }), or null. */
export function versionString(version) {
  if (!version || typeof version !== 'object') return typeof version === 'string' ? version : null;
  const { major, minor, build } = version;
  return [major, minor, build].every(Number.isInteger) ? `${major}.${minor}.${build}` : null;
}

/**
 * @param {Object} slotData - Connected.slot_data for the MetaMath slot
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
export function buildMetamathRules(slotData, scoutedLocations, playerContext) {
  const structure = slotData?.proof_structure;
  if (!structure || typeof structure !== 'object') {
    throw new Error('MetaMath slot_data has no proof_structure');
  }
  const {
    slot,
    names = {},
    seedName = null,
    game = METAMATH_GAME,
    itemNameToId = {},
    locationNameToId = {},
    archipelagoVersion = null,
  } = playerContext || {};
  if (!Number.isInteger(slot)) throw new Error('playerContext.slot must be the slot number');
  const p = String(slot);

  const mode = entranceRuleModeOf(slotData);
  const relaxItems = (mode & 1) !== 0;
  const relaxEvents = (mode & 2) !== 0;
  const randomizeItems = !!slotData.randomize_items;
  const vanilla = !!slotData.vanilla_placement;

  // ── The proof graph (Rules.ProofStructure) ──
  const statements = Object.entries(structure)
    .map(([key, stmt]) => ({ index: Number(key), ...stmt }))
    .filter((stmt) => Number.isInteger(stmt.index))
    .sort((a, b) => a.index - b.index);
  const N = statements.length;
  const dependencyGraph = new Map(); // index -> sorted unique dependency indices
  const reverseDependencies = new Map(); // index -> Set of dependents
  for (const stmt of statements) {
    const deps = [...new Set(stmt.dependencies || [])].sort((a, b) => a - b);
    dependencyGraph.set(stmt.index, deps);
    for (const d of deps) {
      if (!reverseDependencies.has(d)) reverseDependencies.set(d, new Set());
      reverseDependencies.get(d).add(stmt.index);
    }
  }
  const startingList = (slotData.starting_statements || []).map(Number);
  const starting = new Set(startingList);

  // _build_name_maps: entrance labels, a repeated label gets " (<index>)"
  const entranceLabels = new Map();
  const labelCounts = new Map();
  for (const stmt of statements) {
    const base = stmt.label ? stmt.label : `Statement ${stmt.index}`;
    const count = (labelCounts.get(base) || 0) + 1;
    labelCounts.set(base, count);
    entranceLabels.set(stmt.index, count === 1 ? base : `${base} (${stmt.index})`);
  }
  const entranceLabel = (i) => entranceLabels.get(i) ?? `Statement ${i}`;

  // ── Placements, by location ID ──
  const scoutsById = new Map();
  for (const entry of scoutedLocations || []) scoutsById.set(Number(entry.locationId), entry);

  // ── Regions (create_regions + set_metamath_rules) ──
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
  for (const stmt of statements) {
    if (dependencyGraph.get(stmt.index).length === 0) {
      regions.Menu.exits.push(makeExit(`To ${entranceLabel(stmt.index)}`, locationName(stmt.index), makeTrueRule()));
    }
  }
  const missingScouts = [];
  for (const { index: i } of statements) {
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
        // pre_fill locks the final statement; without randomization, every one
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
    regions[region.name] = region;
  }
  if (missingScouts.length > 0) {
    log('warn', `No scouted item for ${missingScouts.length} location(s): ${missingScouts.join(', ')}`);
  }

  // ── Items: the DataPackage's statements, then the events ──
  const items = {};
  const statementEntries = Object.entries(itemNameToId).sort((a, b) => a[1] - b[1]);
  const statementIndexOf = (name) => Number(/^Statement (\d+)$/.exec(name)?.[1]);
  for (const [name, id] of statementEntries) {
    const index = statementIndexOf(name);
    items[name] = {
      name,
      id: Number(id),
      // Every MetaMath item is a statement (Items.item_groups "Statements").
      groups: ['Everything', 'Statements'],
      // Statements in this proof are progression; the table's others are unused.
      classification: index >= 1 && index <= N ? 'progression' : 'filler',
      type: null,
      max_count: 1,
    };
  }
  for (const { index: i } of statements) {
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
  // generate_basic precollects each starting statement's Proved event
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
  for (const name of statements.flatMap(({ index }) => [itemName(index), eventName(index)]).sort()) {
    itempoolCounts[name] = 1;
  }

  const canonicalPlacements = {};
  for (const { index: i } of statements) {
    if (!starting.has(i) && i !== N) canonicalPlacements[locationName(i)] = itemName(i);
  }

  // ── World metadata (generate_early, set_rules) ──
  const labelToIndex = {};
  for (const stmt of statements) if (stmt.label) labelToIndex[stmt.label] = stmt.index;

  const nameSubstitutions = { items: {}, locations: {}, regions: {} };
  for (const stmt of statements) {
    const i = stmt.index;
    const label = stmt.label;
    const expression = stmt.expression ?? '';
    let locPrefix;
    let provedPrefix;
    if (dependencyGraph.get(i).length > 0) [locPrefix, provedPrefix] = ['Prove', 'Proved'];
    else if (label?.startsWith('ax-')) [locPrefix, provedPrefix] = ['Axiom', 'Axiom'];
    else if (label?.startsWith('df-')) [locPrefix, provedPrefix] = ['Definition', 'Definition'];
    else [locPrefix, provedPrefix] = ['Given', 'Given'];
    const meaningfulItem = statementItemName(label, expression);
    const meaningfulLoc = prefixedName(locPrefix, label, expression);
    const meaningfulProved = prefixedName(provedPrefix, label, expression);
    if (itemName(i) !== meaningfulItem) nameSubstitutions.items[itemName(i)] = meaningfulItem;
    if (eventName(i) !== meaningfulProved) nameSubstitutions.items[eventName(i)] = meaningfulProved;
    if (locationName(i) !== meaningfulLoc) {
      nameSubstitutions.locations[locationName(i)] = meaningfulLoc;
      nameSubstitutions.regions[locationName(i)] = meaningfulLoc;
    }
  }

  // The exporter's per-name dependency maps, walked in region order as set_rules does.
  const locationDependencies = {};
  const entranceDependencies = {};
  const exitDependencies = {};
  for (const region of Object.values(regions)) {
    const i = region.name === 'Menu' ? null : statementIndexOf(region.name.replace(/^Prove /, ''));
    const deps = i === null ? [] : dependencyGraph.get(i);
    if (deps.length > 0) {
      for (const location of region.locations) locationDependencies[location.name] = depNames(deps);
    }
    for (const exit of region.exits) {
      const target = statementIndexOf(exit.connected_region.replace(/^Prove /, ''));
      const targetDeps = dependencyGraph.get(target) || [];
      if (targetDeps.length > 0) {
        entranceDependencies[exit.name] = depNames(targetDeps);
        exitDependencies[exit.name] = depNames(targetDeps);
      }
    }
  }

  const options = { ...WORLD_INFO.default_options, entrance_rule_mode: mode };
  if ('randomize_items' in slotData) options.randomize_items = randomizeItems;
  if ('vanilla_placement' in slotData) options.vanilla_placement = vanilla;
  if (!randomizeItems) options.accessibility = 2; // generate_early: minimal
  if (vanilla) options.starting_statements = 0;
  const theoremLookup = WORLD_INFO.option_definitions.theorem.name_lookup;
  const theoremValue = Object.keys(theoremLookup).find((k) => theoremLookup[k] === slotData.theorem);
  options.theorem = theoremValue !== undefined ? Number(theoremValue) : slotData.theorem;

  const world = {
    game,
    world_class_name: WORLD_INFO.world_class_name,
    options,
    option_definitions: WORLD_INFO.option_definitions,
    proof_structure: { label_to_index: labelToIndex },
    num_statements: N,
    name_substitutions: nameSubstitutions,
    canonical_placements: canonicalPlacements,
    location_dependencies: locationDependencies,
    entrance_dependencies: entranceDependencies,
    exit_dependencies: exitDependencies,
    world_description: WORLD_INFO.world_description,
    slot_data: slotData,
    web: WORLD_INFO.web,
    world_directory: WORLD_INFO.world_directory,
  };
  if (vanilla) world.is_vanilla = true;

  const playerNames = {};
  for (const [key, name] of Object.entries(names)) playerNames[String(key)] = name;
  if (!(p in playerNames)) playerNames[p] = `Player${p}`;

  const rules = {
    schema_version: 3,
    game_name: game,
    game_directory: WORLD_INFO.game_directory,
    playerId: p,
    archipelago_version: archipelagoVersion || 'unknown',
    // The server does not send the generation seed.
    generation_seed: 0,
    player_names: playerNames,
    regions: { [p]: regions },
    start_regions: { [p]: { default: ['Menu'], available: [] } },
    items: { [p]: items },
    item_groups: { [p]: ['Everything', 'Statements'] },
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
