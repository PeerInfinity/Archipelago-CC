/**
 * Wrapper-side custom-data prose templating. Mirrors the original
 * textAdventureSubstrate's templating module so existing custom-data
 * JSON files keep working without modification.
 *
 * Custom-data shape (preserved from the legacy textAdventure module):
 *
 *   {
 *     "regions": {
 *       "<regionName>": { "enterMessage": "..." }
 *     },
 *     "locations": {
 *       "<locationName>": {
 *         "checkMessage":          "... {item} ...",
 *         "alreadyCheckedMessage": "...",
 *         "inaccessibleMessage":   "..."
 *       }
 *     },
 *     "exits": {
 *       "<exitName>": {
 *         "moveMessage":         "... {destinationRegion} ...",
 *         "inaccessibleMessage": "..."
 *       }
 *     }
 *   }
 *
 * Templates use {var} placeholders. The {item} placeholder is wrapped
 * in <span class="tae-item-name"> when the caller passes
 * wasUnchecked: true, matching the engine's discovery highlight
 * styling so templated and generic discoveries look consistent.
 *
 * All lookup helpers return null when the corresponding entry is
 * missing — the caller falls back to a generic message.
 *
 * ⛓ CONCEPT LIBRARY T2 — **THE RESOLUTION ORDER.** A procgen region may carry
 * its OWN prose in its sidecar payload (`prose`, `textAdventureRoom.js`), the
 * same message kinds for that one region. `composeProse` lays it OVER the
 * per-game file, message by message, so each helper below resolves
 *
 *     the region's payload prose → the per-game file → null (the generic line)
 *
 * with no change to the six helpers: the bridge hands them the composed
 * document instead of the file.
 */

/**
 * ⛓⛓ **THE ONE RESOLVER** — the per-game `customData` with one region's
 * payload `prose` laid over it, per message: a message the region says wins, a
 * message it does not say falls through to the file's. `prose` exits are keyed
 * by `exit_id`; `exitNameOf` maps one to the name the engine's exit carries
 * (the identity for every serialized room, whose `exitName` is its `exit_id`).
 * No prose ⇒ `customData` itself, unchanged. Neither input is mutated.
 *
 * @param {object|null} customData the per-game file (or null)
 * @param {string} regionName
 * @param {object|null|undefined} prose the region's payload `prose`
 * @param {(exitId: string) => string} [exitNameOf]
 * @returns {object|null}
 */
export function composeProse(customData, regionName, prose, exitNameOf = (id) => id) {
    if (!prose || typeof prose !== 'object') return customData;
    const base = customData ?? {};
    const over = (table, entries) => {
        const out = { ...(base[table] ?? {}) };
        for (const [key, rec] of entries) out[key] = { ...(out[key] ?? {}), ...rec };
        return out;
    };
    return {
        ...base,
        regions: over('regions', typeof prose.enterMessage === 'string'
            ? [[regionName, { enterMessage: prose.enterMessage }]] : []),
        exits: over('exits', Object.entries(prose.exits ?? {}).map(([id, rec]) => [exitNameOf(id), rec])),
        locations: over('locations', Object.entries(prose.locations ?? {})),
    };
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

export function processMessageTemplate(template, variables = {}) {
    if (typeof template !== 'string') return '';
    let processed = template;
    for (const [key, value] of Object.entries(variables)) {
        if (value === undefined || value === null) continue;
        if (key === 'wasUnchecked') continue;
        const placeholder = `{${key}}`;
        const escaped = escapeHtml(value);
        const replacement = (key === 'item' && variables.wasUnchecked)
            ? `<span class="tae-item-name">${escaped}</span>`
            : escaped;
        processed = processed.split(placeholder).join(replacement);
    }
    return processed;
}

export function customRegionEnterMessage(customData, regionName, vars = {}) {
    const t = customData?.regions?.[regionName]?.enterMessage;
    if (!t) return null;
    return processMessageTemplate(t, { regionName, ...vars });
}

export function customLocationCheckMessage(customData, locationName, vars = {}) {
    const t = customData?.locations?.[locationName]?.checkMessage;
    if (!t) return null;
    return processMessageTemplate(t, { locationName, ...vars });
}

export function customLocationInaccessibleMessage(customData, locationName, vars = {}) {
    const t = customData?.locations?.[locationName]?.inaccessibleMessage;
    if (!t) return null;
    return processMessageTemplate(t, { locationName, ...vars });
}

export function customLocationAlreadyCheckedMessage(customData, locationName, vars = {}) {
    const t = customData?.locations?.[locationName]?.alreadyCheckedMessage;
    if (!t) return null;
    return processMessageTemplate(t, { locationName, ...vars });
}

export function customExitMoveMessage(customData, exitName, vars = {}) {
    const t = customData?.exits?.[exitName]?.moveMessage;
    if (!t) return null;
    return processMessageTemplate(t, { exitName, ...vars });
}

export function customExitInaccessibleMessage(customData, exitName, vars = {}) {
    const t = customData?.exits?.[exitName]?.inaccessibleMessage;
    if (!t) return null;
    return processMessageTemplate(t, { exitName, ...vars });
}
