// client/core/goalCheck.js
//
// Decides when this client should tell the server the slot has reached its
// goal. Design and measurements: the server-data arc's goal-report design.
//
// ⛔ A goal cannot be undone: under `auto` the server runs collect and release
// at once. So the rule is evaluated against the items the SERVER has delivered
// on this connection, never against the frontend's own state. That state holds
// auto-collected events (logic says reachable, not that the player did it) and
// can hold offline progress or another game's document while connecting.

import { isGeneratedWorldDoc } from './localRulesOverlay.js';
import { evaluateRuleWithInventory } from '../../shared/procgen/library.js';

/**
 * Updates a connection's server-delivered item counts from one ReceivedItems
 * packet. Index 0 is a full resync (Connect, /sync), so it replaces the counts.
 *
 * @param {Map<string, number>} serverItems - item name -> count; updated in place
 * @param {number} index - the packet's index
 * @param {string[]} itemNames - the packet's items, by name
 */
export function applyReceivedItems(serverItems, index, itemNames) {
  if (index === 0) serverItems.clear();
  for (const name of itemNames) serverItems.set(name, (serverItems.get(name) ?? 0) + 1);
}

/**
 * Whether the server-delivered items satisfy the slot's completion condition.
 * False for anything but a clear yes:
 * - not one of our generated worlds (other games' own clients report their goal);
 * - the loaded document is for another game, or has no such slot;
 * - the rule holds with no items (`constant true`, no rule), or an inventory
 *   cannot answer it (a helper or setting: `undefined`).
 *
 * @param {object|null|undefined} doc - the loaded rules document
 * @param {number|string} slot - the connected slot
 * @param {string|null|undefined} game - the connected slot's game
 * @param {Map<string, number>} serverItems - item name -> count delivered by the server
 * @returns {boolean}
 */
export function goalMet(doc, slot, game, serverItems) {
  const player = String(slot);
  if (!game || doc?.world?.[player]?.game !== game) return false;
  if (!isGeneratedWorldDoc(doc, player)) return false;
  const rule = doc.game_info?.[player]?.completion_condition;
  const progression = doc.progression_mapping?.[player] ?? null;
  const evaluate = (items) => evaluateRuleWithInventory(rule, items, player, null, progression);
  return evaluate(new Map()) === false && evaluate(serverItems) === true;
}
