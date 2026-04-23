/**
 * Scenario pool — tracks remaining items and obstacles for the
 * current scenario. Hands out placement plans to each region as it's
 * built, and accepts back the region's actual placement to decrement
 * counts.
 *
 * Shared across procgen pipelines: grid-growth asks the pool what to
 * place region-by-region during BFS growth; top-down (scenario-pool
 * mode) asks the pool what items exist and decides all placements +
 * access rules up front before any geometry is realised. Top-down in
 * rules.json mode bypasses the pool entirely.
 *
 * v1 planning heuristic: pick up to `maxItems` items uniformly at
 * random from the unplaced pool. For each picked item, pair it with
 * one matching obstacle from the pool if available (where "matching"
 * means the obstacle has a single-item clear_set containing exactly
 * that item). Unpaired obstacles are not offered. `arrivalInventory`
 * is accepted by the plan call but not consulted in v1 — richer
 * planners that use it are growth.
 *
 * See NewDocs/plans/procedural-generation/substrate-pipeline-
 * architecture.md §"Scenario pool is shared".
 */

export class ScenarioPool {
    constructor({ items = {}, obstacles = {}, itemLib = {}, obstacleLib = {} } = {}) {
        this.items = { ...items };
        this.obstacles = { ...obstacles };
        this.itemLib = itemLib;
        this.obstacleLib = obstacleLib;
    }

    itemsRemaining() {
        return Object.values(this.items).reduce((a, b) => a + b, 0);
    }

    obstaclesRemaining() {
        return Object.values(this.obstacles).reduce((a, b) => a + b, 0);
    }

    totalRemaining() {
        return this.itemsRemaining() + this.obstaclesRemaining();
    }

    snapshot() {
        return {
            items: { ...this.items },
            obstacles: { ...this.obstacles },
        };
    }

    // Return which obstacle ids would be cleared by a lone `itemId`.
    // v1 matches only single-item clear_set combinations; multi-item
    // combos (e.g. needs key AND keycard) are deferred. Logic-gate
    // obstacles (`clear_set_type: 'rule'`) have no combo_list, so
    // they're not offered by the pool's item-to-obstacle pairing
    // here — placeFromRules handles them out-of-band.
    _obstaclesClearedByItem(itemId) {
        const out = [];
        for (const [obsId, obs] of Object.entries(this.obstacleLib)) {
            for (const combo of obs.clear_set || []) {
                if (combo.length === 1 && combo[0] === itemId) {
                    out.push(obsId);
                    break;
                }
            }
        }
        return out;
    }

    planPlacement({ arrivalInventory: _arrivalInventory, rng, maxItems = 2 } = {}) {
        if (!rng || typeof rng.next !== 'function') {
            throw new Error('planPlacement: rng required');
        }

        // Flatten unplaced items into a multiset we can sample from.
        const pool = [];
        for (const [id, count] of Object.entries(this.items)) {
            for (let i = 0; i < count; i++) pool.push(id);
        }

        const picked_items = [];
        for (let i = 0; i < maxItems && pool.length > 0; i++) {
            const idx = Math.floor(rng.next() * pool.length);
            picked_items.push(pool.splice(idx, 1)[0]);
        }

        // Pair items with one matching obstacle each, where available.
        const obstacle_budget = { ...this.obstacles };
        const picked_obstacles = [];
        for (const item_id of picked_items) {
            for (const obstacle_id of this._obstaclesClearedByItem(item_id)) {
                if ((obstacle_budget[obstacle_id] || 0) > 0) {
                    picked_obstacles.push(obstacle_id);
                    obstacle_budget[obstacle_id] -= 1;
                    break;
                }
            }
        }

        return {
            items_to_place: picked_items,
            obstacles_to_place: picked_obstacles,
        };
    }

    markPlaced({ placed_items = [], placed_obstacles = [] } = {}) {
        for (const p of placed_items) {
            const id = p.item_id;
            if ((this.items[id] || 0) > 0) this.items[id] -= 1;
        }
        for (const p of placed_obstacles) {
            const id = p.obstacle_id;
            if ((this.obstacles[id] || 0) > 0) this.obstacles[id] -= 1;
        }
    }
}
