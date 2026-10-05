/**
 * ⛓ RETURN TO MENU — the two position-aware readers of `exporter[p].return_to_menu`: the soft-lock census
 * (`softLockCensus.js`) and the survey's leg derivation (`surveyRoute.deriveLegs`). One toy world:
 *
 *   Menu -GameStart-> A ; A -> B free ; B -> A needs the Key ; the Key is in B, the Gem in A.
 *
 * Holding nothing, B is reachable and has no way back. With the flag that is RESTART-ONLY (a diagnostic) and a walk
 * may Restart out of it; without it, it is a SOFT-LOCK and a walk is stuck.
 */
import { describe, it, expect } from 'vitest';

import { softLockCensus, sphereInventories } from './softLockCensus.js';
import { deriveLegs, makeRuleHolds } from './surveyRoute.js';
import { declareReturnToMenu } from '../../frontend/modules/procgenCore/restartWarp.js';

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
function toyWorld({ flag }) {
    const rules = {
        schema_version: 3,
        game_name: 'Toy',
        regions: { 1: {
            Menu: { name: 'Menu', exits: [{ name: 'GameStart', connected_region: 'A', access_rule: { rule: 'True_' } }], locations: [] },
            A: { name: 'A', exits: [{ name: 'A -> B', connected_region: 'B', access_rule: { rule: 'True_' } }],
                locations: [{ name: 'Gem spot', id: 2, access_rule: { rule: 'True_' }, item: { name: 'Gem', player: 1 } }] },
            B: { name: 'B', exits: [{ name: 'B -> A', connected_region: 'A', access_rule: has('Key') }],
                locations: [{ name: 'Key spot', id: 1, access_rule: { rule: 'True_' }, item: { name: 'Key', player: 1 } }] },
        } },
        items: { 1: { Key: { name: 'Key', id: 1, groups: [], advancement: true }, Gem: { name: 'Gem', id: 2, groups: [], advancement: true } } },
        start_regions: { 1: { default: ['Menu'] } },
        exporter: {},
    };
    return flag ? declareReturnToMenu(rules) : rules;
}
const LOG = [
    { type: 'state_update', sphere_index: '0', player_data: { 1: { new_inventory_details: { base_items: {} } } } },
    { type: 'state_update', sphere_index: '1', player_data: { 1: { new_inventory_details: { base_items: { Key: 1 } } } } },
];

describe('the soft-lock census reads the flag', () => {
    it('without return_to_menu, B is a SOFT-LOCK until the Key is held', () => {
        const c = softLockCensus(toyWorld({ flag: false }), sphereInventories(LOG));
        expect(c).toMatchObject({ returnToMenu: false, start: 'A', kind: 'soft-lock' });
        expect(c.rows.map((r) => [r.sphere, r.stuck])).toEqual([['0', ['B']], ['1', []]]);
    });

    it('with it, the same B is listed RESTART-ONLY — a diagnostic, the same list', () => {
        const c = softLockCensus(toyWorld({ flag: true }), sphereInventories(LOG));
        expect(c).toMatchObject({ returnToMenu: true, kind: 'restart-only' });
        expect(c.rows[0].stuck).toEqual(['B']);
    });
});

describe('the survey derivation may Restart only where the flag says so', () => {
    // Key first (B), then the Gem back in A: from B with nothing held there is no walk to A.
    const PICKUPS = [{ sphere: '0.1', location: 'Gem spot', item: 'Gem' }];
    const derive = (flag) => {
        const rules = toyWorld({ flag });
        return deriveLegs({ regions: rules.regions['1'], ruleHolds: makeRuleHolds(rules), start: 'B', pickups: PICKUPS, restart: flag });
    };

    it('without the flag the leg is refused by name', () => {
        expect(() => derive(false)).toThrow(/NO path from B to A/);
    });

    it('with it the leg Restarts: B -> Menu -> (GameStart) A, marked `restart`', () => {
        const { legs, hops } = derive(true);
        expect(legs[0]).toMatchObject({ regions: ['B', 'Menu', 'A'], restart: true });
        expect(hops[0]).toEqual(['Restart', 'GameStart']);
    });
});
