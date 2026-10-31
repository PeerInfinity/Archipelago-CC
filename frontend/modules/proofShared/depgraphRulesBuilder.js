// frontend/modules/proofShared/depgraphRulesBuilder.js
//
// Builds a DepGraph rules.json (schema v3, one player) from what the AP
// server sends: the slot's slot_data plus the scouted contents of its
// locations. The client uses it when it connects to a DepGraph slot that no
// committed preset matches (see client/core/serverDataRules.js).
//
// Every logic field derives from slot_data.graph_structure, starting_nodes
// and entrance_rule_mode. This mirrors the Python world:
//   worlds/depgraph/__init__.py  _build_name_maps, generate_early,
//                                create_regions, set_rules, generate_basic
//   worlds/depgraph/Rules.py     set_depgraph_rules
//   worlds/depgraph/Items.py / Locations.py  display-name helpers
// The shared region/item/rule construction is proofGraphRulesBuilder.js;
// this file is DepGraph's names and metadata. depgraphRulesBuilder.test.js
// holds the output equal to the exporter's rules.json for every committed
// DepGraph preset and all four entrance rule modes, so a change on either
// side shows up there.

import {
  buildProofGraphRules,
  choiceValueOf,
  entranceRuleModeOf as entranceRuleModeFor,
  truncate,
} from './proofGraphRulesBuilder.js';
import WORLD_INFO from './depgraphWorldInfo.json' with { type: 'json' };

export const DEPGRAPH_GAME = 'DepGraph';

const itemName = (i) => `Node ${i}`;
const locationName = (i) => `Complete Node ${i}`;
const eventName = (i) => `Completed Node ${i}`;
const nodeIndexOf = (name) => Number(/^Node (\d+)$/.exec(name)?.[1]);

const SPEC = {
  game: DEPGRAPH_GAME,
  logName: 'depgraphRulesBuilder',
  worldInfo: WORLD_INFO,
  structureKey: 'graph_structure',
  startingKey: 'starting_nodes',
  itemName,
  locationName,
  eventName,
  itemIndexOf: nodeIndexOf,
  locationIndexOf: (name) => nodeIndexOf(name.replace(/^Complete /, '')),
  itemGroup: 'Nodes',

  // _build_name_maps: the node's id, else "Node <index>"
  entranceLabels(nodes) {
    return new Map(nodes.map((node) => [node.index, node.label ? node.label : itemName(node.index)]));
  },

  // generate_early's name_substitutions (Items.node_item_name,
  // Locations.node_location_name, Items.event_item_name)
  meaningfulNames(node) {
    const expression = node.expression ?? '';
    return {
      item: truncate(expression, 60),
      location: truncate(expression, 50),
      event: `Event: ${truncate(expression, 50)}`,
    };
  },

  worldFields(nodes, slotData) {
    const labelToIndex = {};
    for (const node of nodes) if (node.label) labelToIndex[node.label] = node.index;
    return { graph_structure: { label_to_index: labelToIndex, title: slotData.title }, num_nodes: nodes.length };
  },

  applyOptions(options, slotData, { vanilla }) {
    if (vanilla) options.starting_nodes = 0;
    if ('graph_file' in slotData) options.graph_file = choiceValueOf(WORLD_INFO, 'graph_file', slotData.graph_file);
  },
};

/**
 * The entrance rule mode from slot_data, or the world default (with a
 * warning) when the server's apworld did not send it.
 */
export function entranceRuleModeOf(slotData) {
  return entranceRuleModeFor(SPEC, slotData);
}

/**
 * @param {Object} slotData - Connected.slot_data for the DepGraph slot
 * @param {Array<Object>} scoutedLocations - The slot's scouted locations
 * @param {Object} playerContext - See buildProofGraphRules
 * @returns {Object} A schema-v3 rules.json for that one player
 */
export function buildDepgraphRules(slotData, scoutedLocations, playerContext) {
  return buildProofGraphRules(SPEC, slotData, scoutedLocations, playerContext);
}

/** The console's description of rules this builder made, e.g. "for tech_tree (10 nodes, entrance mode 1)". */
export function summarizeDepgraphRules(slotData, rules) {
  const subject = slotData?.graph_file ?? slotData?.title;
  const count = Object.keys(slotData?.graph_structure || {}).length;
  const mode = rules.world[rules.playerId].options.entrance_rule_mode;
  return `${subject ? `for ${subject} ` : ''}(${count} nodes, entrance mode ${mode})`;
}
