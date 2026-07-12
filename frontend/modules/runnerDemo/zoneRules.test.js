import { describe, it, expect } from 'vitest';
import { doubleGap, oneWay } from './fixtures.js';
import { assignSidePortals, makeExtractZoneRules } from './zoneRules.js';
import { RUNNER_OBSTACLE_ID_BY_ABILITY } from './apRules.js';
import { loadRulesSchema, ruleSchemaErrors } from './ruleSchemaCheck.js';

// Phase 6 (plan §4.6): the zone-locations channel hook the phase-7
// registry entry hands the pipeline. Fixture zones cover the single-exit
// path (level used verbatim). The generation-backed branch-exit
// regeneration path (spec'd + shelved zones) lives in zoneRules.slow.test.js
// (test-strategy rebalance §1 — default suite stays generation-free).

const HAS_DJ = { rule: 'Has', args: { item_name: 'Double Jump' } };
const HAS_BLUE = { rule: 'Has', args: { item_name: 'Blue Platforms' } };

describe('assignSidePortals', () => {
    it('maps E (the strip direction) to exit_main when present', () => {
        expect(assignSidePortals(['N', 'E', 'S'])).toEqual({
            E: 'exit_main', N: 'exit_br0', S: 'exit_br1',
        });
    });
    it('falls back to the first requested side', () => {
        expect(assignSidePortals(['S'])).toEqual({ S: 'exit_main' });
        expect(assignSidePortals(['W', 'N'])).toEqual({ W: 'exit_main', N: 'exit_br0' });
    });
    it('empty sides -> no portals', () => {
        expect(assignSidePortals([])).toEqual({});
    });
});

describe('extractZoneRules — fixture zones (single exit, level verbatim)', () => {
    const zones = [
        { level: doubleGap, items: { pk_edge: 'Double Jump' } },
        { level: oneWay, items: { pk_shelf: 'Blue Platforms' } },
    ];
    const extract = makeExtractZoneRules(zones);

    it('emits the verified rules in both legacy and obstacle form', () => {
        const out = extract(0, { region_id: 'runner_z0', exitSides: ['E'] });
        // pk_edge is the item-before-the-gate touch-reach case: [].
        expect(out.locations).toEqual([{
            id: 'pk_edge',
            item: 'Double Jump',
            access_rule: { rule: 'True_' },
            paths: [{ path_id: 'p1', obstacles: [] }],
            position: null,
        }]);
        // exit_main sits past the double gap: [doubleJump].
        expect(out.exitRules).toEqual({ E: HAS_DJ });
        expect(out.exitPaths).toEqual({
            E: [{ path_id: 'p1', obstacles: [RUNNER_OBSTACLE_ID_BY_ABILITY.doubleJump] }],
        });
        expect(Object.keys(out.obstacleDefs)).toEqual([
            RUNNER_OBSTACLE_ID_BY_ABILITY.doubleJump,
        ]);
    });

    it('collects obstacle defs referenced by pickups too', () => {
        const out = extract(1, { region_id: 'runner_z1', exitSides: ['S'] });
        expect(out.locations[0]).toMatchObject({
            id: 'pk_shelf',
            access_rule: HAS_BLUE,
            paths: [{ path_id: 'p1', obstacles: [RUNNER_OBSTACLE_ID_BY_ABILITY.blue] }],
        });
        expect(out.exitRules).toEqual({ S: { rule: 'True_' } });
        expect(Object.keys(out.obstacleDefs)).toEqual([RUNNER_OBSTACLE_ID_BY_ABILITY.blue]);
    });

    it('builds the game payload for the level it emitted rules for', () => {
        const out = extract(0, { region_id: 'runner_z0', exitSides: ['E'] });
        expect(out.payload.gameId).toBe('runnerDemo');
        expect(out.payload.params.runnerLevel).toBe(doubleGap); // verbatim, no regen
        expect(out.payload.params.sidePortals).toEqual({ E: 'exit_main' });
        expect(out.payload.params.physics.profile).toBe('celeste');
        expect(out.payload.params.physics.constants.TICK_HZ).toBeGreaterThan(0);
        expect(out.payload.ap_locations).toEqual({ pk_edge: 'runner_z0__pk_edge' });
        expect(out.payload.flashCapabilities).toEqual({
            locations: 'cooperative', items: 'pull', start: 'auto',
        });
    });

    it('throws loudly on bad zone indices, missing items, and spec-less branches', () => {
        expect(() => extract(7, { region_id: 'r', exitSides: ['E'] }))
            .toThrow(/zone index 7 out of range/);
        const noItems = makeExtractZoneRules([{ level: doubleGap, items: {} }]);
        expect(() => noItems(0, { region_id: 'r', exitSides: ['E'] }))
            .toThrow(/pickup 'pk_edge' has no canonical item assignment/);
        expect(() => extract(0, { region_id: 'r', exitSides: ['E', 'N'] }))
            .toThrow(/no generation spec/);
    });

    it('every emitted rule is schema-valid (rules.schema.json #/$defs/rule)', () => {
        const schema = loadRulesSchema();
        const out = extract(1, { region_id: 'runner_z1', exitSides: ['S'] });
        for (const rule of [
            ...out.locations.map((l) => l.access_rule),
            ...Object.values(out.exitRules),
        ]) {
            expect(ruleSchemaErrors(rule, schema)).toEqual([]);
        }
    });
});
