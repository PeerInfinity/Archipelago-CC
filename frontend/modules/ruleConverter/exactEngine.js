/**
 * ruleConverter/exactEngine — the Rule Converter's Exact (Pyodide) engine's
 * pure helpers, kept out of the UI file so they test without a page.
 */

/**
 * The loaded game's rules document and slot, for the Exact engine's option
 * definitions (without them an option reads back as a world attribute).
 * `payload` is `getLastRawJsonData()`'s value. Null when nothing is loaded.
 */
export function loadedRulesForOptions(payload) {
  const doc = payload?.rawJsonData;
  if (!doc || typeof doc !== 'object') return null;
  return { rules: doc, playerId: String(payload?.selectedPlayerInfo?.playerId ?? '1') };
}

/**
 * Parse the JSON pane for the Exact engine: it must be a helpers dict
 * (`{ "name": rule, ... }`), not a single rule. Returns `{ helpers }` or
 * `{ error }`.
 */
export function parseHelpersJson(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { error: `Invalid JSON: ${e.message}` };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Exact mode converts a helpers dict: { "helper_name": rule, ... }' };
  }
  if (typeof value.type === 'string' || typeof value.rule === 'string') {
    return { error: 'This is a single rule. Exact mode converts a helpers dict: { "helper_name": rule, ... }' };
  }
  return { helpers: value };
}
