// helperDefinition.js — the rule display's lookup of a helper's rules.json definition.
//
// rules.json `helpers` is keyed by player (`helpers["2"]["can_fly"]`). The display used to try
// '1' and '0' only, so on a slot ≥2 document a helper showed without its definition (no expand).
// It now reads the loaded player's key first. '0' stays as a fallback; '1' is tried only when the
// interface names no player, because on a slot ≥2 document `helpers["1"]` belongs to ANOTHER
// slot (possibly another game) and must not be shown as this slot's helper.

/** The loaded player's id as a string, or null when the interface names none. */
function loadedPlayerOf(snapshotInterface) {
  let id = null;
  try {
    id = typeof snapshotInterface?.getPlayerId === 'function'
      ? snapshotInterface.getPlayerId()
      : snapshotInterface?.playerId;
  } catch {
    id = null;
  }
  return id === undefined || id === null || id === '' ? null : String(id);
}

/**
 * The definition of helper `name` for the player the rule belongs to.
 * @param {object} snapshotInterface  the rule display's snapshot interface (`getStaticData()`, `getPlayerId()`)
 * @param {string} name               the helper's name
 * @returns {object|null}
 */
export function helperDefinitionFor(snapshotInterface, name) {
  if (!name || typeof snapshotInterface?.getStaticData !== 'function') return null;
  const helpers = snapshotInterface.getStaticData()?.helpers;
  if (!helpers || typeof helpers !== 'object') return null;
  const player = loadedPlayerOf(snapshotInterface);
  const keys = player ? [player, '0'] : ['1', '0'];
  for (const key of keys) {
    const def = helpers[key]?.[name];
    if (def) return def;
  }
  return null;
}
