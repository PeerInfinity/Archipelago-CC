import { describe, it, expect } from 'vitest';

import { compileAccessRule, compileRegion } from './pathsAndObstaclesCompiler.js';

// Small hand-authored obstacle library exercising all three clear_set
// shapes called out in the plan.
const OBSTACLE_LIB = {
    door_red: {
        id: 'door_red',
        clear_set: [['key_red']],
    },
    spike_pit: {
        // Any one of jump / fly / rocket clears it.
        id: 'spike_pit',
        clear_set: [['jump'], ['fly'], ['rocket']],
    },
    two_lock: {
        // Requires both items.
        id: 'two_lock',
        clear_set: [['red_key', 'keycard']],
    },
    never: {
        id: 'never',
        clear_set: [],
    },
};

describe('compileAccessRule — edge cases', () => {
    it('empty paths compiles to False_', () => {
        expect(compileAccessRule([], OBSTACLE_LIB)).toEqual({ rule: 'False_' });
        expect(compileAccessRule(undefined, OBSTACLE_LIB)).toEqual({ rule: 'False_' });
    });

    it('a single obstacle-free path compiles to True_', () => {
        const r = compileAccessRule([{ path_id: 'p1', obstacles: [] }], OBSTACLE_LIB);
        expect(r).toEqual({ rule: 'True_' });
    });

    it('unknown obstacle id throws', () => {
        expect(() => compileAccessRule(
            [{ path_id: 'p1', obstacles: ['ghost'] }],
            OBSTACLE_LIB,
        )).toThrow(/unknown obstacle/);
    });

    it('obstacle with empty clear_set compiles to False_', () => {
        const r = compileAccessRule(
            [{ path_id: 'p1', obstacles: ['never'] }],
            OBSTACLE_LIB,
        );
        expect(r).toEqual({ rule: 'False_' });
    });

    it('obstacle with clear_set_type "rule" inlines its clear_rule', () => {
        const gateRule = {
            rule: 'And', children: [
                { rule: 'Has', args: { item_name: 'key_red' } },
                { rule: 'Has', args: { item_name: 'key_green' } },
            ],
        };
        const lib = {
            logic_gate_1: {
                id: 'logic_gate_1',
                clear_set_type: 'rule',
                clear_rule: gateRule,
            },
        };
        const r = compileAccessRule(
            [{ path_id: 'p1', obstacles: ['logic_gate_1'] }],
            lib,
        );
        // Single-obstacle path: path's AND degenerates to the obstacle
        // rule, and the OR-over-paths also degenerates. The inlined
        // rule should surface unchanged.
        expect(r).toEqual(gateRule);
    });

    it('clear_set_type "rule" with null clear_rule compiles to False_', () => {
        const lib = {
            orphan_gate: {
                id: 'orphan_gate',
                clear_set_type: 'rule',
                clear_rule: null,
            },
        };
        const r = compileAccessRule(
            [{ path_id: 'p1', obstacles: ['orphan_gate'] }],
            lib,
        );
        expect(r).toEqual({ rule: 'False_' });
    });
});

describe('compileAccessRule — clear_set shapes', () => {
    it('single-item combination compiles to Has', () => {
        const r = compileAccessRule(
            [{ path_id: 'p1', obstacles: ['door_red'] }],
            OBSTACLE_LIB,
        );
        expect(r).toEqual({ rule: 'Has', args: { item_name: 'key_red' } });
    });

    it('OR-of-single-item combinations compiles to Or of Has', () => {
        const r = compileAccessRule(
            [{ path_id: 'p1', obstacles: ['spike_pit'] }],
            OBSTACLE_LIB,
        );
        expect(r).toEqual({
            rule: 'Or',
            children: [
                { rule: 'Has', args: { item_name: 'jump' } },
                { rule: 'Has', args: { item_name: 'fly' } },
                { rule: 'Has', args: { item_name: 'rocket' } },
            ],
        });
    });

    it('multi-item AND combination compiles to And of Has', () => {
        const r = compileAccessRule(
            [{ path_id: 'p1', obstacles: ['two_lock'] }],
            OBSTACLE_LIB,
        );
        expect(r).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'red_key' } },
                { rule: 'Has', args: { item_name: 'keycard' } },
            ],
        });
    });
});

describe('compileAccessRule — nested structure', () => {
    it('two obstacles on one path compile to And', () => {
        const r = compileAccessRule(
            [{ path_id: 'p1', obstacles: ['door_red', 'two_lock'] }],
            OBSTACLE_LIB,
        );
        expect(r).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'key_red' } },
                {
                    rule: 'And',
                    children: [
                        { rule: 'Has', args: { item_name: 'red_key' } },
                        { rule: 'Has', args: { item_name: 'keycard' } },
                    ],
                },
            ],
        });
    });

    it('two paths compile to Or-of-And', () => {
        const r = compileAccessRule([
            { path_id: 'p1', obstacles: ['door_red'] },
            { path_id: 'p2', obstacles: ['spike_pit'] },
        ], OBSTACLE_LIB);
        expect(r).toEqual({
            rule: 'Or',
            children: [
                { rule: 'Has', args: { item_name: 'key_red' } },
                {
                    rule: 'Or',
                    children: [
                        { rule: 'Has', args: { item_name: 'jump' } },
                        { rule: 'Has', args: { item_name: 'fly' } },
                        { rule: 'Has', args: { item_name: 'rocket' } },
                    ],
                },
            ],
        });
    });
});

describe('compileRegion', () => {
    it('requires obstacleLib', () => {
        expect(() => compileRegion({ region_id: 'r', exits: [], locations: [] })).toThrow(/obstacleLib/);
    });

    it('compiles exits and locations, preserving ids, target_region, and item', () => {
        const extracted = {
            region_id: 'maze_room',
            entrance: { x: 0, y: 0 },
            exits: [
                {
                    id: 'exit',
                    position: { x: 9, y: 7 },
                    target_region: null,
                    paths: [{ path_id: 'p1', obstacles: ['door_red'] }],
                },
            ],
            locations: [
                {
                    id: 'key_red_pickup',
                    position: { x: 7, y: 3 },
                    item: 'key_red',
                    paths: [{ path_id: 'p1', obstacles: [] }],
                },
            ],
        };
        const compiled = compileRegion(extracted, { obstacleLib: OBSTACLE_LIB });
        expect(compiled.region_name).toBe('maze_room');
        expect(compiled.exits).toEqual([
            {
                id: 'exit',
                target_region: null,
                rule: { rule: 'Has', args: { item_name: 'key_red' } },
            },
        ]);
        expect(compiled.locations).toEqual([
            {
                id: 'key_red_pickup',
                item: 'key_red',
                position: { x: 7, y: 3 },
                rule: { rule: 'True_' },
            },
        ]);
    });

    it('empty exits/locations arrays are handled', () => {
        const compiled = compileRegion(
            { region_id: 'r' },
            { obstacleLib: OBSTACLE_LIB },
        );
        expect(compiled.exits).toEqual([]);
        expect(compiled.locations).toEqual([]);
    });
});
