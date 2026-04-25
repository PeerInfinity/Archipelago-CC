/**
 * Items / obstacles library for the maze substrate.
 *
 * Shape loosely follows the pipeline overview's items/obstacles library
 * design (NewDocs/plans/procedural-generation/pipeline-overview.md
 * §"Items / obstacles library"). In the eventual pipeline, these
 * libraries live in the scenario's preset directory as JSON; for now
 * they live with the substrate's frontend module and are imported
 * directly.
 *
 * Items declare Archipelago classification. Obstacles declare one of
 * two clear-condition representations, distinguished by
 * `clear_set_type`:
 *
 *   'combo_list' (default) — `clear_set` is an OR of AND-combinations
 *       of items. `[[key_red]]` means "clears iff inventory contains
 *       key_red"; `[[jump], [fly], [rocket]]` means "clears with any
 *       one"; `[[red_key, keycard]]` means "requires both."
 *   'rule' — `clear_rule` is a Rule Builder JSON expression evaluated
 *       against the player's inventory. Used by the logic_gate
 *       obstacle (and anything else that needs to express an arbitrary
 *       AP access rule as an in-world gate).
 *
 * Permanent-key semantics: AP's `has()` is permanent, so picking up a
 * key keeps doors of its color open for the rest of the game. The
 * scenario pool is expected to supply one key per color and any
 * number of doors of that color.
 */

export const DEFAULT_ITEMS = Object.freeze({
    key_red: {
        name: 'Red Key',
        id: 'key_red',
        classification: 'progression',
        color: '#d04040',
        symbol: 'key',
    },
    key_green: {
        name: 'Green Key',
        id: 'key_green',
        classification: 'progression',
        color: '#40c060',
        symbol: 'key',
    },
    key_blue: {
        name: 'Blue Key',
        id: 'key_blue',
        classification: 'progression',
        color: '#4080d0',
        symbol: 'key',
    },
});

export const DEFAULT_OBSTACLES = Object.freeze({
    door_red: {
        name: 'Red Door',
        id: 'door_red',
        clear_set_type: 'combo_list',
        clear_set: [['key_red']],
        color: '#b84040',
    },
    door_green: {
        name: 'Green Door',
        id: 'door_green',
        clear_set_type: 'combo_list',
        clear_set: [['key_green']],
        color: '#408040',
    },
    door_blue: {
        name: 'Blue Door',
        id: 'door_blue',
        clear_set_type: 'combo_list',
        clear_set: [['key_blue']],
        color: '#404080',
    },
    // Template for logic-gate obstacles. Per-instance gates are
    // created by cloning this entry into the region's obstacleLib
    // with a unique id and an instance-specific `clear_rule` (a Rule
    // Builder JSON expression). Visual: a see-through gate so the
    // player can see what they're trying to reach before they know
    // which rule they need to satisfy.
    logic_gate: {
        name: 'Logic Gate',
        id: 'logic_gate',
        clear_set_type: 'rule',
        clear_rule: null,
        color: '#b06eb8',
        display: { mode: 'tree' },
    },
});

/**
 * Evaluate a Rule Builder rule against a Set<item_id> inventory.
 *
 * Supports the subset of rules the v1 maze pipeline produces: Has,
 * And, Or, True_, False_. The substrate-agnostic runtime ruleEngine
 * (`frontend/modules/shared/ruleEngine.js`) handles the full schema
 * but wants a StateManager/snapshot context; this headless variant
 * takes a plain Set.
 *
 * `count > 1` on Has is treated as present-iff-in-inventory (Set
 * membership has no count). v1 keys are singletons so this is
 * accurate; count-sensitive rules are a growth path.
 */
export function evaluateRuleAgainstInventory(rule, inventory) {
    if (!rule || typeof rule !== 'object') return false;
    switch (rule.rule) {
        case 'True_': return true;
        case 'False_': return false;
        case 'Has': {
            const itemName = rule.args?.item_name;
            return itemName != null && inventory.has(itemName);
        }
        case 'And': {
            for (const child of rule.children ?? []) {
                if (!evaluateRuleAgainstInventory(child, inventory)) return false;
            }
            return true;
        }
        case 'Or': {
            for (const child of rule.children ?? []) {
                if (evaluateRuleAgainstInventory(child, inventory)) return true;
            }
            return false;
        }
        default:
            throw new Error(`evaluateRuleAgainstInventory: unsupported rule '${rule.rule}'`);
    }
}

/**
 * Render hints for an item id. Looks the item up in `itemLib`; when
 * absent (a "foreign" item from a top-down driver consuming another
 * game's rules.json), derives a hash-based HSL color and uses the
 * first character of the id as a label, so different unknown items
 * remain visually distinguishable.
 *
 *   { color, label, name }
 *
 * Both maze-substrate panels (mazeRoomUI, procgenPipelineUI) call
 * this when drawing an item tile. label is null when the library
 * entry has no symbol — known items keep their plain colored-circle
 * rendering; unknown items get the letter overlay.
 */
export function getItemRenderHints(itemId, itemLib = DEFAULT_ITEMS) {
    const item = itemLib?.[itemId];
    if (item) {
        return {
            color: item.color ?? '#e6a817',
            label: item.symbol ?? null,
            name: item.name ?? itemId,
        };
    }
    // Foreign item: hash the id for color, take the first character
    // (uppercased) as a label, and fall back to the id itself for
    // the display name.
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
        hash = ((hash << 5) - hash) + itemId.charCodeAt(i);
        hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return {
        color: `hsl(${hue}, 65%, 55%)`,
        label: (itemId[0] ?? '?').toUpperCase(),
        name: itemId,
    };
}

/**
 * True iff the player's inventory clears the obstacle. Dispatches on
 * `clear_set_type`:
 *   - 'combo_list' (default): any one AND-combination fully present
 *     in inventory.
 *   - 'rule': the obstacle's `clear_rule` evaluates to true under
 *     inventory.
 */
export function isObstacleCleared(obstacleId, inventory, obstacleLib = DEFAULT_OBSTACLES) {
    const obstacle = obstacleLib[obstacleId];
    if (!obstacle) return true; // Unknown obstacle id ≡ no gate; permissive for robustness.
    const type = obstacle.clear_set_type ?? 'combo_list';
    if (type === 'rule') {
        if (!obstacle.clear_rule) return false; // No rule attached ≡ never clearable.
        return evaluateRuleAgainstInventory(obstacle.clear_rule, inventory);
    }
    // combo_list
    for (const combination of obstacle.clear_set ?? []) {
        let all = true;
        for (const itemId of combination) {
            if (!inventory.has(itemId)) { all = false; break; }
        }
        if (all) return true;
    }
    return false;
}
