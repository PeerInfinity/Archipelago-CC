/**
 * Sphere-0 crediting for the spoiler test (worker and main-thread paths).
 *
 * A sphere log's sphere 0 inventory is the state BEFORE any location is checked: the
 * starting items, plus whatever the world COMPUTED from them into prog_items (e.g.
 * jakanddaxter's "Reachable Orbs", set by its collect() to the orbs in reachable regions).
 * The spoiler test adds the starting items itself at init, and game logic hooks may
 * derive some computed items from them (Stardew's "Received Progression Item"). What the
 * live state still lacks after that has to be credited from the log, or every later
 * sphere's delta is applied on top of a short base.
 *
 * @param {Object<string, number|boolean>} logInventory - sphere 0's base_items or resolved_items
 * @param {function(string): number} countItem - the live state's count for an item
 * @param {Set<string>} [skipItems] - names never credited from the log (accumulator targets)
 * @returns {Object<string, number>} item name -> count the live state is short by
 */
export function findUncreditedSphereZeroItems(logInventory, countItem, skipItems = new Set()) {
  const uncredited = {};
  for (const [itemName, logCount] of Object.entries(logInventory || {})) {
    if (skipItems.has(itemName)) continue;
    // Number(): a computed flag such as "Reachable Orbs Fresh" is logged as a boolean
    const missing = Number(logCount) - (Number(countItem(itemName)) || 0);
    if (missing > 0) uncredited[itemName] = missing;
  }
  return uncredited;
}
