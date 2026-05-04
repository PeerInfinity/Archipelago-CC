/**
 * Standalone-mode helpers for the text adventure substrate.
 *
 * In standalone mode the substrate consumes raw AP region data
 * (`staticData.regions.get(name)`) instead of the procgen-emitted
 * tile-grid sidecars. This module synthesises a `world` object with
 * the same field shape the panel consumes in procgen mode, so the
 * panel's renderers, click handlers, and parser context can stay
 * mode-agnostic.
 *
 * Per-AP-region shape (input):
 *   {
 *     name: string,
 *     exits: [{ name, connected_region, access_rule }, ...],
 *     locations: [{ name, item, access_rule }, ...]
 *   }
 *
 * Synthetic world (output) — same field names the procgen path uses:
 *   {
 *     region_id, exits: Map, items: Map, itemLocationNames: Map,
 *     obstacles: Map(empty), obstacleLib: {},
 *     // Standalone-only:
 *     mode: 'standalone',
 *     locationAccessRules: Map<locationName, rule>,
 *   }
 *
 * Notes on mapping:
 *   - exits[].side is set to null in standalone (no compass). The
 *     panel's _renderExits branches on world.mode and renders a flat
 *     list instead of the 3×3 compass grid.
 *   - exits[].x / .y are absent. Accessibility checks branch on
 *     `exit.access_rule`: when present, the panel evaluates it
 *     directly via the rule engine instead of doing the procgen
 *     tile-coord obstacle lookup.
 *   - items keys use `loc:<i>` synthetic posKeys. itemLocationNames
 *     maps the same keys to the AP location name. Tile coords are
 *     never read in standalone.
 */

export function synthesizeStandaloneWorld(regionData) {
    if (!regionData) return null;

    const exits = new Map();
    for (const exit of regionData.exits ?? []) {
        if (!exit?.name) continue;
        exits.set(exit.name, {
            exit_id: exit.name,
            exitName: exit.name,
            targetRegion: exit.connected_region ?? null,
            access_rule: exit.access_rule ?? null,
            side: null,
        });
    }

    const items = new Map();
    const itemLocationNames = new Map();
    const locationAccessRules = new Map();
    let i = 0;
    for (const loc of regionData.locations ?? []) {
        if (!loc?.name) continue;
        const posKey = `loc:${i++}`;
        const itemName = loc.item?.name ?? null;
        items.set(posKey, itemName);
        itemLocationNames.set(posKey, loc.name);
        locationAccessRules.set(loc.name, loc.access_rule ?? null);
    }

    return {
        region_id: regionData.name,
        mode: 'standalone',
        exits,
        items,
        itemLocationNames,
        obstacles: new Map(),
        obstacleLib: {},
        locationAccessRules,
    };
}

/**
 * Resolve the autoLoadCustomData setting value into a fetch URL.
 * Mirrors the legacy textAdventure module's `'adventure'` shorthand:
 * a bare name (no slash, no protocol) maps to
 * ./modules/shared/customData/<name>_textadventure.json. Anything
 * else is treated as a literal URL.
 *
 * Empty / falsy returns null (caller skips the fetch).
 */
export function resolveCustomDataUrl(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('/') || /^[a-z]+:/i.test(trimmed)) {
        return trimmed;
    }
    return customDataUrlForGame(trimmed);
}

/**
 * Build the conventional custom-data URL for a game. Lowercases the
 * name and slots it into the legacy
 * ./modules/shared/customData/<game>_textadventure.json path. Used by
 * the auto-detect-on-rules-load path so a file dropped into that
 * directory with the right name is picked up without configuration.
 *
 * Returns null for empty / non-string input.
 */
export function customDataUrlForGame(gameName) {
    if (!gameName || typeof gameName !== 'string') return null;
    const slug = gameName.trim().toLowerCase();
    if (!slug) return null;
    return `./modules/shared/customData/${slug}_textadventure.json`;
}

/**
 * Pick the URL to auto-load for a freshly-loaded rules.json. Explicit
 * setting wins; otherwise we try the game-name convention. Returns
 * null when neither yields a URL.
 */
export function pickAutoLoadCustomDataUrl(rulesJson, playerId, settingValue) {
    const explicit = resolveCustomDataUrl(settingValue);
    if (explicit) return explicit;
    const gameName = rulesJson?.world?.[playerId]?.game;
    return customDataUrlForGame(gameName);
}
