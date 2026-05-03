/**
 * Custom-data prose templating for the text adventure substrate.
 *
 * The substrate consults a JSON document (the "custom data") to find
 * per-region / per-location / per-exit prose that overrides its
 * generic messages. The shape — preserved from the legacy
 * `textAdventure/` module so existing custom-data files keep working
 * — is:
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
 * Templates use `{var}` placeholders. Values are substituted by name.
 *
 * Special case: when the substituted variable is `item` and the
 * caller passes `wasUnchecked: true`, the value is wrapped in
 * `<span class="item-name">` to match the panel's discovery
 * highlighting. Other substitutions are inserted as plain text.
 *
 * All lookup helpers return null when the corresponding entry is
 * missing from the custom data. The caller falls back to the panel's
 * generic message in that case.
 */

/**
 * Substitute `{key}` placeholders in a template string. See file
 * docstring for the item-on-discovery special case.
 */
export function processMessageTemplate(template, variables = {}) {
    if (typeof template !== 'string') return '';
    let processed = template;
    for (const [key, value] of Object.entries(variables)) {
        if (value === undefined || value === null) continue;
        const placeholder = `{${key}}`;
        const replacement = (key === 'item' && variables.wasUnchecked)
            ? `<span class="item-name">${value}</span>`
            : String(value);
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
