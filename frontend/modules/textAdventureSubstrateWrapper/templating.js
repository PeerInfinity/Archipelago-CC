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
 */

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
