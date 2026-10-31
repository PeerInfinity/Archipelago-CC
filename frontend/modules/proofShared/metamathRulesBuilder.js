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
// The shared region/item/rule construction is proofGraphRulesBuilder.js;
// this file is MetaMath's names and metadata. metamathRulesBuilder.test.js
// holds the output equal to the exporter's rules.json for every committed
// MetaMath preset and all four entrance rule modes, so a change on either side
// shows up there.

import {
  buildProofGraphRules,
  choiceValueOf,
  entranceRuleModeOf as entranceRuleModeFor,
  truncate,
} from './proofGraphRulesBuilder.js';
import WORLD_INFO from './metamathWorldInfo.json' with { type: 'json' };

export { versionString } from './proofGraphRulesBuilder.js';

export const METAMATH_GAME = 'Metamath';

const itemName = (i) => `Statement ${i}`;
const locationName = (i) => `Prove Statement ${i}`;
const eventName = (i) => `Proved Statement ${i}`;
const statementIndexOf = (name) => Number(/^Statement (\d+)$/.exec(name)?.[1]);

// Items.statement_item_name
function statementItemName(label, expression) {
  return label ? `${label}: ${truncate(expression, 60)}` : expression;
}

// Locations.statement_location_name and Items.proved_item_name (same shape, length 50)
function prefixedName(prefix, label, expression) {
  return label ? `${prefix} ${label}: ${truncate(expression, 50)}` : `${prefix} ${expression}`;
}

const SPEC = {
  game: METAMATH_GAME,
  logName: 'metamathRulesBuilder',
  worldInfo: WORLD_INFO,
  structureKey: 'proof_structure',
  startingKey: 'starting_statements',
  itemName,
  locationName,
  eventName,
  itemIndexOf: statementIndexOf,
  locationIndexOf: (name) => statementIndexOf(name.replace(/^Prove /, '')),
  itemGroup: 'Statements',

  // _build_name_maps: entrance labels, a repeated label gets " (<index>)"
  entranceLabels(statements) {
    const labels = new Map();
    const labelCounts = new Map();
    for (const stmt of statements) {
      const base = stmt.label ? stmt.label : `Statement ${stmt.index}`;
      const count = (labelCounts.get(base) || 0) + 1;
      labelCounts.set(base, count);
      labels.set(stmt.index, count === 1 ? base : `${base} (${stmt.index})`);
    }
    return labels;
  },

  // generate_early's name_substitutions
  meaningfulNames(stmt, deps) {
    const { label } = stmt;
    const expression = stmt.expression ?? '';
    let locPrefix;
    let provedPrefix;
    if (deps.length > 0) [locPrefix, provedPrefix] = ['Prove', 'Proved'];
    else if (label?.startsWith('ax-')) [locPrefix, provedPrefix] = ['Axiom', 'Axiom'];
    else if (label?.startsWith('df-')) [locPrefix, provedPrefix] = ['Definition', 'Definition'];
    else [locPrefix, provedPrefix] = ['Given', 'Given'];
    return {
      item: statementItemName(label, expression),
      location: prefixedName(locPrefix, label, expression),
      event: prefixedName(provedPrefix, label, expression),
    };
  },

  worldFields(statements) {
    const labelToIndex = {};
    for (const stmt of statements) if (stmt.label) labelToIndex[stmt.label] = stmt.index;
    return { proof_structure: { label_to_index: labelToIndex }, num_statements: statements.length };
  },

  applyOptions(options, slotData, { vanilla }) {
    if (vanilla) options.starting_statements = 0;
    options.theorem = choiceValueOf(WORLD_INFO, 'theorem', slotData.theorem);
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
 * @param {Object} slotData - Connected.slot_data for the MetaMath slot
 * @param {Array<Object>} scoutedLocations - The slot's scouted locations
 * @param {Object} playerContext - See buildProofGraphRules
 * @returns {Object} A schema-v3 rules.json for that one player
 */
export function buildMetamathRules(slotData, scoutedLocations, playerContext) {
  return buildProofGraphRules(SPEC, slotData, scoutedLocations, playerContext);
}

/** The console's description of rules this builder made, e.g. "for 2p2e4 (10 statements, entrance mode 1)". */
export function summarizeMetamathRules(slotData, rules) {
  const subject = slotData?.theorem;
  const count = Object.keys(slotData?.proof_structure || {}).length;
  const mode = rules.world[rules.playerId].options.entrance_rule_mode;
  return `${subject ? `for ${subject} ` : ''}(${count} statements, entrance mode ${mode})`;
}
