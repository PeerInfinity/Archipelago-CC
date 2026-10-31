// client/core/serverDataRules.js
//
// Games whose rules.json the client can build from what the server sends
// (slot_data + scouts), for a room that no committed preset matches. Keyed by
// the AP game name, as the Connect packet and slot_info name it.

import { buildMetamathRules, METAMATH_GAME } from '../../proofShared/metamathRulesBuilder.js';

export { versionString } from '../../proofShared/metamathRulesBuilder.js';

const BUILDERS = {
  [METAMATH_GAME]: buildMetamathRules,
};

/** @returns {boolean} Whether `game`'s rules can be built from server data. */
export function hasServerDataBuilder(game) {
  return typeof game === 'string' && Object.prototype.hasOwnProperty.call(BUILDERS, game);
}

/**
 * @param {string} game
 * @param {Object} slotData - Connected.slot_data
 * @param {Array<Object>} scoutedLocations - LocationInfo entries for the slot
 * @param {Object} playerContext - See buildMetamathRules
 * @returns {Object} A one-player rules.json
 */
export function buildRulesFromServerData(game, slotData, scoutedLocations, playerContext) {
  if (!hasServerDataBuilder(game)) throw new Error(`No server-data builder for ${game}`);
  return BUILDERS[game](slotData, scoutedLocations, { ...playerContext, game });
}
