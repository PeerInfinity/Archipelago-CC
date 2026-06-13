// schemaControlHelpers.js — pure (DOM-free) logic for the Options panel's
// auto-generated "All Settings" view. Kept separate from optionsPanelUI.js so
// the control-selection / label / coercion logic is unit-testable without a
// DOM environment (the repo's vitest runs in 'node'; UI rendering is verified
// headlessly via Playwright).

/**
 * Turn a camelCase / snake_case / kebab-case key into a human label.
 * Splits camelCase and letter→digit boundaries, normalizes separators, and
 * title-cases word starts. Examples:
 *   showLabel1   -> 'Show Label 1'
 *   defaultSpeed -> 'Default Speed'
 *   commonUI     -> 'Common UI'   (acronyms kept; only word-starts upcased)
 *   max_iframes  -> 'Max Iframes'
 */
export function humanizeKey(str) {
  return String(str ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // camelCase boundary
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')    // letter→digit boundary
    .replace(/[_-]+/g, ' ')                      // separators → space
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Choose which control to render for a schema property spec.
 * @returns {'boolean'|'enum'|'number'|'string'|'json'}
 */
export function chooseControlType(spec) {
  if (!spec || typeof spec !== 'object') return 'json';
  if (Array.isArray(spec.enum) && spec.enum.length) return 'enum';
  switch (spec.type) {
    case 'boolean': return 'boolean';
    case 'number':
    case 'integer': return 'number';
    case 'string': return 'string';
    case 'array':
    case 'object': return 'json';
    default: return 'json';
  }
}

/**
 * Display label for a schema entry: explicit `label`, else humanized prop.
 * @param {{prop:string, spec?:object}} entry
 */
export function resolveLabel(entry) {
  const spec = entry && entry.spec ? entry.spec : {};
  return spec.label || humanizeKey(entry ? entry.prop : '');
}

/**
 * Coerce a raw input string to a number per the spec's type.
 * Rejects empty / NaN. Truncates for `integer`.
 * @returns {{ok:true, value:number} | {ok:false}}
 */
export function coerceNumber(spec, raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: false };
  const n = Number(s);
  if (Number.isNaN(n)) return { ok: false };
  if (spec && spec.type === 'integer') return { ok: true, value: Math.trunc(n) };
  return { ok: true, value: n };
}

/**
 * Map a raw (string) select value back to the original-typed enum member, so
 * a numeric/boolean enum round-trips with its real type.
 * @returns {{ok:true, value:*} | {ok:false}}
 */
export function coerceEnum(spec, raw) {
  if (!spec || !Array.isArray(spec.enum)) return { ok: false };
  const match = spec.enum.find((v) => String(v) === String(raw));
  return match === undefined ? { ok: false } : { ok: true, value: match };
}

/**
 * Lower-cased haystack for the filter box: module, prop, label, key, desc.
 */
export function buildSearchText(entry, label) {
  const spec = entry && entry.spec ? entry.spec : {};
  return [entry.moduleId, entry.prop, label, entry.key, spec.description || '']
    .join(' ')
    .toLowerCase();
}
