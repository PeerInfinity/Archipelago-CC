// moduleLayoutSync.js - keep module enabled-states in agreement with the layout
// after the layout is swapped wholesale (a JSON / editor layout import).
//
// Why this exists (quick-launch Q1b, trap 1424): Golden Layout's loadLayout()
// destroys every item before building the new ones. The panel manager used to
// publish ui:panelManuallyClosed for each, the initializer disabled every module,
// and the rebuilt tabs were left belonging to modules that read enabled:false —
// the next enableModule() then added a DUPLICATE tab. The panel manager now
// suppresses that event during a swap (withLayoutSwap), and after the swap the
// initializer reconciles with the pure function below.

/**
 * The componentTypes of every component currently in a Golden Layout.
 * A multi-instance module's type appears once per tab.
 *
 * @param {object} goldenLayout - a GoldenLayout instance (or null).
 * @returns {string[]}
 */
export function openComponentTypes(goldenLayout) {
  const items = goldenLayout?.getAllContentItems?.() ?? [];
  return items.filter((item) => item.isComponent && item.componentType).map((item) => item.componentType);
}

/**
 * Decide which modules a layout swap left in disagreement with the layout.
 *
 * - disabled with a tab → enable (the new layout built its panel).
 * - enabled without a tab → disable, but ONLY when the swap removed that tab
 *   (its type is in `previousTabTypes`). A module enabled without a tab is also
 *   a legitimate BOOT state (measured at :8130: `settings` is enabled and has
 *   no tab before any import), so a module whose tab was never there is left
 *   alone. With `previousTabTypes` null nothing is disabled.
 * - a module without a registered componentType is never touched.
 * - a multi-instance module counts any number of tabs as "has a tab".
 *
 * @param {Object<string, boolean>} enabledById - moduleId → enabled.
 * @param {(moduleId: string) => (string|null|undefined)} componentTypeOf
 * @param {Iterable<string>} tabTypes - componentTypes present after the swap.
 * @param {Iterable<string>|null} [previousTabTypes] - componentTypes present before it.
 * @returns {{toDisable: string[], toEnable: string[]}}
 */
export function reconcileModuleStates(enabledById, componentTypeOf, tabTypes, previousTabTypes = null) {
  const now = new Set(tabTypes);
  const before = previousTabTypes ? new Set(previousTabTypes) : null;
  const toDisable = [];
  const toEnable = [];
  for (const [moduleId, enabled] of Object.entries(enabledById)) {
    const componentType = componentTypeOf(moduleId);
    if (!componentType) continue;
    const hasTab = now.has(componentType);
    if (!enabled && hasTab) toEnable.push(moduleId);
    else if (enabled && !hasTab && before?.has(componentType)) toDisable.push(moduleId);
  }
  return { toDisable, toEnable };
}
