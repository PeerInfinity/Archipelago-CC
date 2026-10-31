// client/core/serverDataRules.js
//
// Games whose rules.json the client can build from what the server sends
// (slot_data + scouts), for a room that no committed preset matches. Keyed by
// the AP game name, as the Connect packet and slot_info name it.

import {
  buildMetamathRules,
  METAMATH_GAME,
  summarizeMetamathRules,
} from '../../proofShared/metamathRulesBuilder.js';
import {
  buildDepgraphRules,
  DEPGRAPH_GAME,
  summarizeDepgraphRules,
} from '../../proofShared/depgraphRulesBuilder.js';

export { versionString } from '../../proofShared/proofGraphRulesBuilder.js';

// build(slotData, scoutedLocations, playerContext) -> rules.json;
// summarize(slotData, rules) -> the console's description of what was built.
const BUILDERS = {
  [METAMATH_GAME]: { build: buildMetamathRules, summarize: summarizeMetamathRules },
  [DEPGRAPH_GAME]: { build: buildDepgraphRules, summarize: summarizeDepgraphRules },
};

/** @returns {boolean} Whether `game`'s rules can be built from server data. */
export function hasServerDataBuilder(game) {
  return typeof game === 'string' && Object.prototype.hasOwnProperty.call(BUILDERS, game);
}

/**
 * @param {string} game
 * @param {Object} slotData - Connected.slot_data
 * @param {Array<Object>} scoutedLocations - LocationInfo entries for the slot
 * @param {Object} playerContext - See proofShared/proofGraphRulesBuilder.js
 * @returns {Object} A one-player rules.json
 */
export function buildRulesFromServerData(game, slotData, scoutedLocations, playerContext) {
  if (!hasServerDataBuilder(game)) throw new Error(`No server-data builder for ${game}`);
  return BUILDERS[game].build(slotData, scoutedLocations, { ...playerContext, game });
}

/** e.g. "for 2p2e4 (10 statements, entrance mode 3)" */
export function describeServerDataRules(game, slotData, rules) {
  return BUILDERS[game]?.summarize(slotData, rules) ?? '';
}
