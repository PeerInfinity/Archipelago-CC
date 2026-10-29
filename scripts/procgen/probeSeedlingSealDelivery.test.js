/**
 * ⛓ THE SEAL-DELIVERY PROBE'S INVENTORY WAIT (slice `seedling-js-seal-delivery-arms`): arms W and J grant every
 * `ap_items` row and wait for the AP inventory to hold it. The state manager clamps an add at the item's
 * `max_count`, and the committed preset's `Nothing` has `max_count: 0` (since the R4b regen), so a wait for the raw
 * copy count never ends: both arms died on "timeout waiting for: every grant in the AP inventory". The wait's
 * target is the copies the preset lets the inventory HOLD.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RULES_PATH, censusPlan, inventoryShortfall } from './probe-seedling-seal-delivery.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CFG = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
const ITEMS = PRESET.items['1'];

/** The inventory the state manager builds from the probe's grants (`inventoryManager._addItemToInventory`'s clamp). */
function grantedInventory(plan, itemDefs) {
    const inv = {};
    for (const r of plan) inv[r.item] = Math.min(r.copies, itemDefs[r.item]?.max_count ?? Infinity);
    return inv;
}

describe('probe-seedling-seal-delivery — the inventory wait', () => {
    const PLAN = censusPlan(CFG);

    it('the committed preset\'s clamped inventory satisfies the wait (W/J reach the census)', () => {
        expect(inventoryShortfall(PLAN, grantedInventory(PLAN, ITEMS), ITEMS)).toEqual([]);
    });

    it('a capped item is waited for at its cap, not its copies — Nothing (max_count 0) is the live case', () => {
        expect(PLAN.some((r) => (ITEMS[r.item]?.max_count ?? Infinity) < r.copies)).toBe(true);
        const plan = [{ item: 'X', copies: 2 }];
        expect(inventoryShortfall(plan, { X: 0 }, { X: { max_count: 0 } })).toEqual([]);
        expect(inventoryShortfall(plan, { X: 1 }, { X: { max_count: 1 } })).toEqual([]);
    });

    it('an item short of what the inventory can hold is named', () => {
        const plan = [{ item: 'Seal', copies: 16 }, { item: 'X', copies: 1 }];
        expect(inventoryShortfall(plan, { Seal: 15 }, { Seal: { max_count: 23 } }))
            .toEqual([{ item: 'Seal', want: 16, have: 15 }, { item: 'X', want: 1, have: 0 }]);
    });

    it('the census still asks for every Seal: no cap below sixteen hides a short grant', () => {
        const seal = PLAN.find((r) => r.flash === '!seal');
        expect(seal.copies).toBe(16);
        expect(ITEMS.Seal.max_count).toBeGreaterThanOrEqual(16);
    });
});
