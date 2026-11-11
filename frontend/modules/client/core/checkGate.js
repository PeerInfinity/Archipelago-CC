/**
 * The connected path's logic gate for location checks (sdc-ool-guard, ⚖ Robert 2026-11-11, options B + D of
 * `check-out-of-logic-guard.md`).
 *
 * Offline, the state manager is the last stop for `user:locationCheck` and refuses a location its logic says is
 * unreachable (`stateManager/core/locationChecking.js`, `not_accessible`). Connected, the client is the last stop: it
 * sends `LocationChecks` and never passes the event on, so that guard never ran and a click on a red card was a
 * permanent, server-side sequence break. This module gives the connected path the same refusal.
 *
 * WHICH checks are gated — FAIL-CLOSED: every `user:locationCheck` is gated UNLESS its payload says the GAME
 * reported it (`reportedByGame: true`). A pickup the game itself reported is physical play: if the game let the
 * player reach it (a teleport, a logic-only lock) the check really happened, so it is sent as before. Every other
 * `user:` source — the Locations card, the region-graph node, a future click surface, a queued Loops action, a bot —
 * is held to the logic, exactly as offline. `system:locationCheck` (a substrate's own playback pickups, syncs) is
 * never gated. Server echoes and releases arrive as `RoomUpdate`, not through this handler.
 * ⛔ `originalDOMEvent` cannot tell a click from a game report (game modules set it true; RegionGraphBulkCheck sets
 * it too), so it is not read here.
 *
 * WHO decides: the state manager. The answer is its own snapshot's `locationReachability`, the same
 * `isLocationAccessible` evaluation its offline guard runs — read after a worker round trip so the snapshot is not
 * stale. No logic is evaluated here.
 */

/** The payload field a game/substrate sets on a pickup it reported. */
export const GAME_REPORTED_FIELD = 'reportedByGame';

/** Reasons a gated check is refused. */
export const REFUSAL = Object.freeze({
  NOT_ACCESSIBLE: 'not_accessible',
  REACHABILITY_UNKNOWN: 'reachability_unknown',
});

/**
 * @param {string} eventName - 'user:locationCheck' or 'system:locationCheck'
 * @param {object} eventData - the dispatcher payload
 * @returns {boolean} whether this check must pass the logic gate before it is sent
 */
export function needsLogicGate(eventName, eventData) {
  if (eventName !== 'user:locationCheck') return false;
  return eventData?.[GAME_REPORTED_FIELD] !== true;
}

/**
 * Ask the state manager whether a location may be checked now.
 *
 * @param {string} locationName
 * @param {object} proxy - the state manager proxy (`pingWorker`, `getLatestStateSnapshot`)
 * @returns {Promise<string|null>} null when the check may be sent; otherwise a `REFUSAL` reason
 */
export async function logicRefusal(locationName, proxy) {
  try {
    // Flush queued snapshot updates (an item that just arrived) before reading the cache.
    await proxy?.pingWorker?.('client:checkGate');
  } catch {
    // A ping timeout leaves the last snapshot; it is still the state manager's own answer.
  }
  const status = proxy?.getLatestStateSnapshot?.()?.locationReachability?.[locationName];
  if (status === 'reachable' || status === 'checked') return null;
  // No answer (no snapshot, no rules, a name the rules do not have) is a refusal: fail closed.
  return status === 'unreachable' ? REFUSAL.NOT_ACCESSIBLE : REFUSAL.REACHABILITY_UNKNOWN;
}

/** The short message the player sees when a check is refused. */
export function refusalMessage(locationName, reason) {
  if (reason === REFUSAL.NOT_ACCESSIBLE) {
    return `Out of logic: "${locationName}" was not checked. Logic says it is not reachable yet.`;
  }
  return `Not checked: "${locationName}". Logic has no answer for it yet (rules still loading?).`;
}
