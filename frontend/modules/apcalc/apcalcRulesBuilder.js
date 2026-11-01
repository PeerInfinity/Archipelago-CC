// frontend/modules/apcalc/apcalcRulesBuilder.js
//
// Builds an APCalc rules.json (schema v3, one player) from what the AP server
// sends: the slot's slot_data plus the scouted contents of its locations. The
// client uses it when it connects to an APCalc slot that no committed preset
// matches (see client/core/serverDataRules.js).
//
// Every logic field derives from slot_data: nodes, edges (with each edge's
// path_costs and sphere), starting_buttons and the generation options. This
// mirrors the Python world (worlds/apcalc/__init__.py: generate_early,
// create_regions, create_items, set_rules, generate_basic, pre_fill) and the
// exporter's item table (exporter/exporter.py process_items over the base
// handler's get_item_data). apcalcRulesBuilder.test.js holds the output equal
// to the exporter's rules.json for every committed APCalc preset and the
// fixtures beside it, so a change on either side shows up there.
//
// It does not share proofShared/proofGraphRulesBuilder.js: that core is one
// region per node whose entrances need HasAll of the node's dependencies, from
// a Menu region. APCalc's entrances need COUNTS of buttons along a full path
// from Start, its items stack (max_count > 1), and it starts in "C" with a
// Victory event. Only versionString is common.
//
// ⚠ path_costs cannot be derived from operation + operand_digits: the
// generator adds the edge's own buttons to ONE of the source node's paths,
// chosen by its RNG. An apworld that predates sending them cannot be rebuilt,
// so the builder throws rather than guess.

import { makeExit, makeRegion, makeTrueRule } from '../shared/rulesJsonBuilder.js';
import { versionString } from '../proofShared/proofGraphRulesBuilder.js';
import WORLD_INFO from './apcalcWorldInfo.json' with { type: 'json' };

export { versionString };

export const APCALC_GAME = 'APCalc';

const START_REGION = 'C';
const TRASH_ITEM = 'Junk';
const VICTORY = 'Victory';
// The generation options fill_slot_data sends, as world.options names them.
const SENT_OPTIONS = ['num_spheres', 'ops_per_sphere', 'nums_per_sphere', 'trash_per_sphere', 'max_branches'];

const regionName = (i) => `Region ${i}`;
const locationName = (i) => `Check ${i}`;
const eventName = (i) => `Checked ${i}`;
const regionIndexOf = (name) => Number(/^Region (\d+)$/.exec(name)?.[1]);
const buttonItem = (label) => (label === TRASH_ITEM ? TRASH_ITEM : `Button: ${label}`);

// Python's default str ordering (code points); the exporter sorts with it.
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('apcalcRulesBuilder', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[apcalcRulesBuilder] ${message}`, ...data);
  }
}

// ── Rules: set_rules' _path_costs_to_rule, as rule_builder resolves it ──

function itemsRule(items) {
  const names = Object.keys(items);
  if (names.length === 1) {
    const rule = { rule: 'Has', args: { item_name: names[0] } };
    if (items[names[0]] > 1) rule.args.count = items[names[0]];
    return rule;
  }
  if (names.every((n) => items[n] === 1)) return { rule: 'HasAll', args: { item_names: names } };
  return { rule: 'HasAllCounts', args: { item_counts: items } };
}

/** One path cost ({button: presses}) → And(Has(...)) resolved (And.from_resolved). */
function pathCostRule(pathCost) {
  const items = {};
  for (const button of Object.keys(pathCost).sort(byCodePoint)) {
    if (pathCost[button] > 0) items[`Button: ${button}`] = pathCost[button];
  }
  return Object.keys(items).length === 0 ? makeTrueRule() : itemsRule(items);
}

const costKey = (pathCost) =>
  JSON.stringify(Object.entries(pathCost).sort((a, b) => byCodePoint(a[0], b[0])));

/** Alternative path costs → Or(...) resolved (Or.from_resolved). */
export function pathCostsRule(pathCosts) {
  if (!pathCosts || pathCosts.length === 0) return makeTrueRule();
  const seen = new Set();
  const unique = [];
  for (const pc of pathCosts) {
    const key = costKey(pc);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(pc);
    }
  }
  if (unique.length === 1) return pathCostRule(unique[0]);
  // Or.from_resolved: a True child wins; single-item Has children fold into
  // one HasAny / HasAnyCount (lowest count) appended after the other clauses.
  const clauses = [];
  const singles = {};
  for (const child of unique.map(pathCostRule)) {
    if (child.rule === 'True_') return child;
    if (child.rule === 'Has') {
      const { item_name: name, count = 1 } = child.args;
      if (!(name in singles) || count < singles[name]) singles[name] = count;
    } else {
      clauses.push(child);
    }
  }
  const singleNames = Object.keys(singles);
  if (singleNames.length === 1) {
    clauses.push(itemsRule(singles));
  } else if (singleNames.length > 1) {
    clauses.push(
      singleNames.every((n) => singles[n] === 1)
        ? { rule: 'HasAny', args: { item_names: singleNames } }
        : { rule: 'HasAnyCount', args: { item_counts: singles } }
    );
  }
  return clauses.length === 1 ? clauses[0] : { rule: 'Or', children: clauses };
}

// BaseClasses.Item.hint_text, which the exporter records when it differs.
const itemHintText = (name) => name.replace(/_/g, ' ').replace(/-/g, ' ');

/**
 * @param {Object} slotData - Connected.slot_data for the APCalc slot
 * @param {Array<Object>} scoutedLocations - The slot's scouted locations
 *   (messageHandler._handleLocationInfo entries: locationId, itemName,
 *   itemId, player, progression, useful, trap). Item names are the
 *   RECEIVING game's.
 * @param {Object} playerContext - slot, names, seedName, game, itemNameToId,
 *   locationNameToId, archipelagoVersion (see proofGraphRulesBuilder.js)
 * @returns {Object} A schema-v3 rules.json for that one player
 */
export function buildApcalcRules(slotData, scoutedLocations, playerContext) {
  const nodesByRegion = slotData?.nodes;
  const sentEdges = slotData?.edges;
  if (!nodesByRegion || typeof nodesByRegion !== 'object' || !Array.isArray(sentEdges)) {
    throw new Error('APCalc slot_data has no nodes/edges');
  }
  const stale = sentEdges.filter((e) => !Array.isArray(e.path_costs));
  if (stale.length > 0) {
    throw new Error(
      `APCalc slot_data edges carry no path_costs (${stale.length} of ${sentEdges.length}); ` +
        "the server's APCalc apworld predates sending them, and they cannot be derived."
    );
  }
  const {
    slot,
    names = {},
    seedName = null,
    game = APCALC_GAME,
    itemNameToId = {},
    locationNameToId = {},
    archipelagoVersion = null,
  } = playerContext || {};
  if (!Number.isInteger(slot)) throw new Error('playerContext.slot must be the slot number');
  const p = String(slot);
  const randomizeItems = 'randomize_items' in slotData ? !!slotData.randomize_items : true;
  if (!('randomize_items' in slotData)) {
    log('warn', "slot_data has no randomize_items; assuming true. The server's APCalc apworld predates sending it.");
  }

  // ── The graph (generic index gi = 1-based node order) ──
  const nodes = Object.entries(nodesByRegion)
    .map(([name, node]) => ({ gi: regionIndexOf(name), ...node }))
    .filter((node) => Number.isInteger(node.gi))
    .sort((a, b) => a.gi - b.gi);
  const N = nodes.length;
  const sourceIndexOf = (name) => (name === START_REGION ? null : regionIndexOf(name));
  const edges = sentEdges.map((edge, index) => ({
    ...edge,
    index,
    // generic indices; slot_data names them by region
    source: sourceIndexOf(edge.source),
    target: regionIndexOf(edge.target),
  }));
  const startingButtons = slotData.starting_buttons || {};

  // ── Placements, by location ID ──
  const scoutsById = new Map();
  for (const entry of scoutedLocations || []) scoutsById.set(Number(entry.locationId), entry);

  // ── Regions (create_regions + set_rules) ──
  const regions = { [START_REGION]: makeRegion(START_REGION) };
  for (const node of nodes) regions[regionName(node.gi)] = makeRegion(regionName(node.gi));

  for (const edge of edges) {
    if (edge.source === null) {
      const target = regionName(edge.target);
      regions[START_REGION].exits.push(makeExit(`C to ${target}`, target, pathCostsRule(edge.path_costs)));
    }
  }
  // Parallel node→node edges merge into one entrance, in first-seen order.
  const groups = new Map();
  for (const edge of edges) {
    if (edge.source === null) continue;
    const key = `${edge.source}>${edge.target}`;
    if (!groups.has(key)) groups.set(key, { source: edge.source, target: edge.target, costs: [] });
    groups.get(key).costs.push(...edge.path_costs);
  }
  for (const { source, target, costs } of groups.values()) {
    const from = regionName(source);
    const to = regionName(target);
    regions[from].exits.push(makeExit(`${from} to ${to}`, to, pathCostsRule(costs)));
  }

  const missingScouts = [];
  for (const node of nodes) {
    const name = locationName(node.gi);
    const id = Object.prototype.hasOwnProperty.call(locationNameToId, name)
      ? Number(locationNameToId[name])
      : null;
    const location = { name, id, access_rule: makeTrueRule() };
    const scout = id === null ? undefined : scoutsById.get(id);
    if (scout) {
      location.item = { name: scout.itemName, player: scout.player, advancement: !!scout.progression, type: 'None' };
    } else {
      missingScouts.push(name);
    }
    // pre_fill locks every location when items are not randomized
    location.locked = !randomizeItems;
    regions[regionName(node.gi)].locations.push(location, {
      name: eventName(node.gi),
      id: null,
      access_rule: makeTrueRule(),
      item: { name: eventName(node.gi), player: slot, advancement: true, type: 'None' },
      locked: true,
      event: true,
    });
  }
  regions[START_REGION].locations.push({
    name: VICTORY,
    id: null,
    access_rule: {
      rule: 'HasAll',
      args: { item_names: nodes.map((node) => eventName(node.gi)).sort(byCodePoint) },
    },
    item: { name: VICTORY, player: slot, advancement: true, type: 'None' },
    locked: true,
    event: true,
  });
  if (missingScouts.length > 0) {
    log('warn', `No scouted item for ${missingScouts.length} location(s): ${missingScouts.join(', ')}`);
  }

  // ── The pool: one item per node (create_items / pre_fill), plus the starts ──
  const counts = {}; // our items, placed anywhere or precollected
  for (const node of nodes) counts[buttonItem(node.item)] = (counts[buttonItem(node.item)] || 0) + 1;
  for (const [label, n] of Object.entries(startingButtons)) counts[buttonItem(label)] = (counts[buttonItem(label)] || 0) + n;
  // generate_basic pushes them in starting_buttons' order. A JS object lists
  // integer-like keys ("5", "9") in numeric order, so that order is lost in
  // JSON.parse; the generator's starting inventory is the Start edges' digits
  // in edge order, so take the order from there.
  const startOrder = edges.filter((e) => e.source === null).map((e) => String(e.operand));
  const startLabels = [
    ...startOrder.filter((label, i) => label in startingButtons && startOrder.indexOf(label) === i),
    ...Object.keys(startingButtons).filter((label) => !startOrder.includes(label)),
  ];
  const startingItems = startLabels.flatMap((label) => Array(startingButtons[label]).fill(buttonItem(label)));

  // ── Items (process_items over the base handler's get_item_data) ──
  const items = {};
  for (const [name, id] of Object.entries(itemNameToId).sort((a, b) => a[1] - b[1])) {
    const placed = counts[name] || 0;
    items[name] = {
      name,
      id: Number(id),
      groups: ['Everything'],
      // the item table's classification reaches the export only through a
      // placement or a precollect; an item that has neither stays filler
      classification: placed > 0 && name !== TRASH_ITEM ? 'progression' : 'filler',
      type: null,
      max_count: Math.max(1, placed),
    };
  }
  const event = (name) => ({
    name,
    id: null,
    groups: ['Event'],
    classification: 'progression',
    event: true,
    type: 'Event',
    max_count: 1,
  });
  for (const node of nodes) items[eventName(node.gi)] = event(eventName(node.gi));
  items[VICTORY] = event(VICTORY);

  // Placed in our locations (our items or other games'), then precollected:
  // the exporter records hint_text and adds other games' items.
  const hinted = [];
  for (const node of nodes) {
    const scout = scoutsById.get(Number(locationNameToId[locationName(node.gi)]));
    if (!scout?.itemName) continue;
    if (scout.player !== slot && !(scout.itemName in items)) {
      items[scout.itemName] = {
        name: scout.itemName,
        id: scout.itemId ?? null,
        groups: [],
        classification: scout.progression ? 'progression' : scout.useful ? 'useful' : scout.trap ? 'trap' : 'filler',
        type: null,
        max_count: 1,
      };
    }
    hinted.push(scout.itemName);
  }
  hinted.push(...startingItems);
  for (const name of hinted) {
    const hint = itemHintText(name);
    if (hint !== name && items[name] && !('hint_text' in items[name])) items[name].hint_text = hint;
  }

  const itempoolCounts = {};
  const poolNames = [...Object.keys(counts), ...nodes.map((node) => eventName(node.gi)), VICTORY];
  for (const name of poolNames.sort(byCodePoint)) itempoolCounts[name] = counts[name] || 1;

  const canonicalPlacements = {};
  for (const node of nodes) canonicalPlacements[locationName(node.gi)] = buttonItem(node.item);

  // ── World fields (generate_early's attributes, as the exporter dumps them) ──
  const nameSubstitutions = { items: {}, locations: {}, regions: {} };
  for (const node of nodes) {
    const suffix = node.layer === 0 ? '' : ` L${node.layer}`;
    const realLocation = `Reach ${node.value}${suffix}`;
    const realRegion = `Node ${node.value}${suffix}`;
    if (locationName(node.gi) !== realLocation) nameSubstitutions.locations[locationName(node.gi)] = realLocation;
    if (regionName(node.gi) !== realRegion) nameSubstitutions.regions[regionName(node.gi)] = realRegion;
  }
  // The exporter's dump of the attribute leaves empty maps out (items is always empty).
  for (const key of Object.keys(nameSubstitutions)) {
    if (Object.keys(nameSubstitutions[key]).length === 0) delete nameSubstitutions[key];
  }
  // A node's path costs are its incoming edges' costs, in edge order.
  const nodePathCosts = new Map(nodes.map((node) => [node.gi, []]));
  for (const edge of edges) nodePathCosts.get(edge.target)?.push(...edge.path_costs);
  const generatedNodes = nodes.map((node) => ({
    index: node.gi - 1,
    value: node.value,
    layer: node.layer,
    sphere: node.sphere,
    item: node.item,
    path_costs: nodePathCosts.get(node.gi),
  }));
  const generatedEdges = edges.map((edge) => {
    // The exporter drops None fields (the Start edges' source and operation).
    const out = { index: edge.index };
    if (edge.source !== null) out.source_index = edge.source - 1;
    out.target_index = edge.target - 1;
    if (edge.operation !== null && edge.operation !== undefined) out.operation = edge.operation;
    out.operand = edge.operand;
    out.operand_digits = edge.operand_digits;
    out.sphere = edge.sphere;
    out.path_costs = edge.path_costs;
    return out;
  });

  const options = { ...WORLD_INFO.default_options };
  for (const key of SENT_OPTIONS) if (Number.isInteger(slotData[key])) options[key] = slotData[key];
  options.randomize_items = randomizeItems;

  const world = {
    game,
    world_class_name: WORLD_INFO.world_class_name,
    options,
    option_definitions: WORLD_INFO.option_definitions,
    generated_nodes: generatedNodes,
    generated_edges: generatedEdges,
    starting_buttons: startingButtons,
    node_count: N,
    name_substitutions: nameSubstitutions,
    canonical_placements: canonicalPlacements,
    world_description: WORLD_INFO.world_description,
    slot_data: slotData,
    web: WORLD_INFO.web,
    world_directory: WORLD_INFO.world_directory,
  };

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
    start_regions: { [p]: { default: [START_REGION], available: [] } },
    items: { [p]: items },
    item_groups: { [p]: ['Everything'] },
    itempool_counts: { [p]: itempoolCounts },
    canonical_placements: { [p]: canonicalPlacements },
    progression_mapping: { [p]: {} },
    starting_items: { [p]: startingItems },
    preset_sidecars: {},
    world: { [p]: world },
    exporter: {},
    game_info: { [p]: { completion_condition: { type: 'item_check', item: VICTORY } } },
    helpers: {},
  };
  if (seedName) rules.seed_name = String(seedName);
  return rules;
}

/** The console's description of rules this builder made, e.g. "(80 nodes, 8 spheres)". */
export function summarizeApcalcRules(slotData) {
  const count = Object.keys(slotData?.nodes || {}).length;
  const spheres = slotData?.num_spheres;
  return `(${count} nodes${Number.isInteger(spheres) ? `, ${spheres} spheres` : ''})`;
}
