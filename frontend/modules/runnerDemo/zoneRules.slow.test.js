import { describe, it, expect } from 'vitest';
import { generateLevel } from './generator.js';
import { makeExtractZoneRules } from './zoneRules.js';
import { RUNNER_OBSTACLE_ID_BY_ABILITY } from './apRules.js';

// The branch-exit REGENERATION path (plan §4.6) — each describe generates a
// verified level at setup scope, so these run in the slow battery, not the
// default suite (test-strategy rebalance §1). The single-exit / verbatim-level
// cases stay pure in zoneRules.test.js.

const HAS_DJ = { rule: 'Has', args: { item_name: 'Double Jump' } };

describe('extractZoneRules — spec\'d zone (branch-exit regeneration)', () => {
    // Hazard-free ungated strip: the fastest thing generateLevel can
    // verify, and branch tips still exercise the surplus-exit path.
    const spec = { requirement: [], pickupCount: 1, seed: 5, hazardChance: 0 };
    const zones = [{
        level: generateLevel({ id: 'gen_z0', ...spec }),
        items: { loc_0: 'Victory' },
        spec,
    }];
    const extract = makeExtractZoneRules(zones);

    it('regenerates with one branch tip per surplus side, same gate everywhere', () => {
        const out = extract(0, { region_id: 'runner_z0', exitSides: ['E', 'N'] });
        const level = out.payload.params.runnerLevel;
        expect(level).not.toBe(zones[0].level); // regenerated variant
        expect(level.portals.map((p) => p.id).sort()).toEqual(['exit_br0', 'exit_main']);
        expect(out.payload.params.sidePortals).toEqual({ E: 'exit_main', N: 'exit_br0' });
        // requirement [] -> every goal and side is ungated.
        expect(out.exitRules).toEqual({ E: { rule: 'True_' }, N: { rule: 'True_' } });
        expect(out.locations).toEqual([{
            id: 'loc_0',
            item: 'Victory',
            access_rule: { rule: 'True_' },
            paths: [{ path_id: 'p1', obstacles: [] }],
            position: null,
        }]);
    });

    it('is deterministic per (zone, exitSides)', () => {
        const a = extract(0, { region_id: 'r', exitSides: ['E', 'N'] });
        const b = extract(0, { region_id: 'r', exitSides: ['E', 'N'] });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});

describe('extractZoneRules — shelved zone (reward shelf survives the branch regen)', () => {
    // A forced reward shelf (plan §8.7 step 2): the spec round-trips
    // through the branch-exit regeneration and the shelf pickup emits
    // the same gate rule as the exit — the shelf adds no logic.
    const spec = {
        requirement: ['doubleJump'], pickupCount: 1, seed: 1,
        hazardChance: 0, shelfChance: 1,
    };
    const zones = [{
        level: generateLevel({ id: 'gen_z0', ...spec }),
        items: { loc_0: 'Double Jump' },
        spec,
    }];
    const extract = makeExtractZoneRules(zones);

    it('the stored level carries the shelf and its wake pickup', () => {
        const shelves = zones[0].level.platforms.filter((p) => p.type === 'oneway');
        expect(shelves).toHaveLength(1);
        expect(zones[0].level.pickups[0].on).toBe(shelves[0].id);
    });

    it('branch regen reproduces the shelf; rules gate on the shelf ability', () => {
        const out = extract(0, { region_id: 'runner_z0', exitSides: ['E', 'N'] });
        const level = out.payload.params.runnerLevel;
        expect(level.platforms.filter((p) => p.type === 'oneway')).toHaveLength(1);
        expect(out.locations[0]).toMatchObject({
            id: 'loc_0',
            access_rule: HAS_DJ,
            paths: [{ path_id: 'p1', obstacles: [RUNNER_OBSTACLE_ID_BY_ABILITY.doubleJump] }],
        });
        expect(out.exitRules).toEqual({ E: HAS_DJ, N: HAS_DJ });
    });
});
