// completeModuleInfo.js - the defaults the mobile layout fills into a panel's moduleInfo

/**
 * Completes a panel's moduleInfo for mobile registration: `title` and `name`
 * fall back to the componentType, a falsy `icon` becomes undefined (the tab
 * bar then shows the title's first letter), every other field is kept as is.
 *
 * Per-module data lives in the module's own `moduleInfo`; there is no side
 * table to fall back to.
 *
 * @param {string} componentType - The component type
 * @param {Object} [raw] - The module info found for the component (may be empty)
 * @returns {Object} The completed module info
 */
export function completeModuleInfo(componentType, raw = {}) {
  return {
    ...raw,
    title: raw.title || componentType,
    icon: raw.icon || undefined,
    name: raw.name || componentType,
  };
}
