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
 * Items declare Archipelago classification. Obstacles declare a
 * `clear_set`: an OR of AND-combinations of items that clear the
 * obstacle. `[[key_red]]` means "clears iff inventory contains
 * key_red"; `[[jump], [fly], [rocket]]` means "clears with any one of
 * jump / fly / rocket"; `[[red_key, keycard]]` means "requires both."
 */

export const DEFAULT_ITEMS = Object.freeze({
    key_red: {
        name: 'Red Key',
        id: 'key_red',
        classification: 'progression',
        color: '#e6a817',
        symbol: 'key',
    },
});

export const DEFAULT_OBSTACLES = Object.freeze({
    door_red: {
        name: 'Red Door',
        id: 'door_red',
        clear_set: [['key_red']],
        color: '#b84040',
    },
});

/**
 * True iff any one AND-combination in the obstacle's clear_set is
 * fully present in `inventory`.
 */
export function isObstacleCleared(obstacleId, inventory, obstacleLib = DEFAULT_OBSTACLES) {
    const obstacle = obstacleLib[obstacleId];
    if (!obstacle) return true; // Unknown obstacle id ≡ no gate; permissive for robustness.
    for (const combination of obstacle.clear_set) {
        let all = true;
        for (const itemId of combination) {
            if (!inventory.has(itemId)) { all = false; break; }
        }
        if (all) return true;
    }
    return false;
}
