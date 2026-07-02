import { describe, it, expect } from 'vitest';
import {
    ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME, RUNNER_OBSTACLE_ID_BY_ABILITY,
    RUNNER_LIBRARY_ITEMS, RUNNER_LIBRARY_OBSTACLES,
    emitObstaclePaths, minimalSetsToRule, composeAuthoredRule, authoredTermsToRule,
} from './apRules.js';
import { compileAccessRule } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { loadRulesSchema, ruleSchemaErrors } from './ruleSchemaCheck.js';

// Phase 6 (plan §4.6): runner emits rules in the shared
// paths-and-obstacles vocabulary, mirroring bounce's emitter. The
// FAITHFULNESS invariant is bounce's contract: the emitted paths,
// compiled by the shared (tile-agnostic) compiler, reproduce the
// composeAuthoredRule(minimalSetsToRule(...)) rule byte-for-byte for
// every shape the runner generator produces.

// The compile lib the engine assembles for a runner region: base
// obstacles + the physics defs + whatever authored logic_gate defs the
// emit produced.
function libWith(authoredDefs) {
    return { ...DEFAULT_OBSTACLES, ...RUNNER_LIBRARY_OBSTACLES, ...authoredDefs };
}

// The faithfulness oracle: paths recompile to exactly the legacy rule.
function expectFaithful(minimalSets, authoredTerms = []) {
    const { paths, authoredDefs } = emitObstaclePaths(minimalSets, authoredTerms);
    const viaObstacles = compileAccessRule(paths, libWith(authoredDefs));
    const viaLegacy = composeAuthoredRule(minimalSetsToRule(minimalSets), authoredTerms);
    expect(viaObstacles).toEqual(viaLegacy);
    return { paths, authoredDefs };
}

describe('emitObstaclePaths — paths/obstacles faithful to the legacy rule', () => {
    it('single physics ability -> one path of one physics obstacle', () => {
        for (const ability of Object.keys(ABILITY_ITEM_NAMES)) {
            const { paths } = expectFaithful([[ability]]);
            expect(paths).toEqual([
                { path_id: 'p1', obstacles: [RUNNER_OBSTACLE_ID_BY_ABILITY[ability]] },
            ]);
        }
    });

    it('a multi-ability set -> one path of physics obstacles in set order', () => {
        const { paths } = expectFaithful([['blue', 'doubleJump']]);
        expect(paths).toEqual([{
            path_id: 'p1',
            obstacles: [
                RUNNER_OBSTACLE_ID_BY_ABILITY.blue,
                RUNNER_OBSTACLE_ID_BY_ABILITY.doubleJump,
            ],
        }]);
    });

    it('alternative ability sets -> OR of paths', () => {
        const { paths } = expectFaithful([['doubleJump'], ['blue']]);
        expect(paths).toHaveLength(2);
        expect(paths.map((p) => p.path_id)).toEqual(['p1', 'p2']);
    });

    it('the always-reachable set [[]] -> one empty-obstacle path -> True_', () => {
        const { paths } = expectFaithful([[]]);
        expect(paths).toEqual([{ path_id: 'p1', obstacles: [] }]);
        expect(compileAccessRule(paths, libWith({}))).toEqual({ rule: 'True_' });
    });

    it('an unreachable goal [] -> no paths -> compiler False_', () => {
        const { paths } = emitObstaclePaths([], []);
        expect(paths).toEqual([]);
        expect(compileAccessRule(paths, libWith({}))).toEqual({ rule: 'False_' });
        expect(minimalSetsToRule([])).toEqual({ rule: 'False_' });
    });

    it('pure-authored gate (True_ physics + a foreign key) -> a logic_gate obstacle', () => {
        const { paths, authoredDefs } = expectFaithful([[]], [{ item: 'key_blue', count: 1 }]);
        expect(paths).toHaveLength(1);
        const [id] = paths[0].obstacles;
        expect(id).toBe('runner_logic_key_blue');
        expect(authoredDefs[id]).toMatchObject({
            clear_set_type: 'rule',
            clear_rule: { rule: 'Has', args: { item_name: 'key_blue' } },
        });
        expect(compileAccessRule(paths, libWith(authoredDefs)))
            .toEqual({ rule: 'Has', args: { item_name: 'key_blue' } });
    });

    it('a physics ability AND a foreign key -> physics obstacle then logic gate', () => {
        const { paths, authoredDefs } = expectFaithful(
            [['doubleJump']], [{ item: 'key_red', count: 1 }]);
        expect(paths[0].obstacles).toEqual([
            RUNNER_OBSTACLE_ID_BY_ABILITY.doubleJump, 'runner_logic_key_red',
        ]);
        expect(compileAccessRule(paths, libWith(authoredDefs))).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'Double Jump' } },
                { rule: 'Has', args: { item_name: 'key_red' } },
            ],
        });
    });

    it('count > 1 authored term rides the obstacle id and clear_rule', () => {
        const { paths, authoredDefs } = emitObstaclePaths([[]], [{ item: 'Coin', count: 3 }]);
        const [id] = paths[0].obstacles;
        expect(id).toBe('runner_logic_Coin__x3');
        expect(authoredDefs[id].clear_rule).toEqual({
            rule: 'Has', args: { item_name: 'Coin', count: 3 },
        });
    });

    it('two goals gating on the same authored term share one obstacle def', () => {
        const a = emitObstaclePaths([[]], [{ item: 'key_blue' }]);
        const b = emitObstaclePaths([['blue']], [{ item: 'key_blue' }]);
        expect(Object.keys(a.authoredDefs)).toEqual(['runner_logic_key_blue']);
        expect(b.authoredDefs.runner_logic_key_blue)
            .toEqual(a.authoredDefs.runner_logic_key_blue);
    });

    it('unknown abilities throw instead of emitting a dangling obstacle', () => {
        expect(() => emitObstaclePaths([['warp']])).toThrow(/unknown ability 'warp'/);
        expect(() => minimalSetsToRule([['warp']])).toThrow(/unknown ability 'warp'/);
    });

    it('authoredTermsToRule is the AND of the terms alone', () => {
        expect(authoredTermsToRule([])).toEqual({ rule: 'True_' });
        expect(authoredTermsToRule([{ item: 'key' }, { item: 'Coin', count: 2 }])).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'key' } },
                { rule: 'Has', args: { item_name: 'Coin', count: 2 } },
            ],
        });
    });
});

describe('library defs — the phase-7 registry entry vocabulary', () => {
    it('has one physics obstacle per ability, carrying its through-line id', () => {
        expect(Object.keys(RUNNER_LIBRARY_OBSTACLES).sort()).toEqual(
            Object.keys(ABILITY_ITEM_NAMES).map(
                (a) => RUNNER_OBSTACLE_ID_BY_ABILITY[a]).sort());
        for (const [ability, itemName] of Object.entries(ABILITY_ITEM_NAMES)) {
            const def = RUNNER_LIBRARY_OBSTACLES[RUNNER_OBSTACLE_ID_BY_ABILITY[ability]];
            expect(def.id).toBe(`runner_gate_${ability}`);
            expect(def.clear_set_type).toBe('combo_list');
            expect(def.clear_set).toEqual([[itemName]]);
            expect(def.runner_ability).toBe(ability);
        }
    });

    it('declares every ability item plus Victory, ids === AP item names', () => {
        const names = [...Object.values(ABILITY_ITEM_NAMES), VICTORY_ITEM_NAME];
        expect(Object.keys(RUNNER_LIBRARY_ITEMS).sort()).toEqual([...names].sort());
        for (const name of names) {
            expect(RUNNER_LIBRARY_ITEMS[name].id).toBe(name);
            expect(RUNNER_LIBRARY_ITEMS[name].classification).toBe('progression');
        }
        expect(RUNNER_LIBRARY_ITEMS[VICTORY_ITEM_NAME].is_victory).toBe(true);
    });
});

describe('schema-valid compile (frontend/schema/rules.schema.json)', () => {
    const schema = loadRulesSchema();
    const expectSchemaValid = (rule) => expect(ruleSchemaErrors(rule, schema)).toEqual([]);

    it('accepts every rule shape the emitter produces', () => {
        const shapes = [
            [[], []],                                          // False_
            [[[]], []],                                        // True_
            [[['doubleJump']], []],                            // Has
            [[['doubleJump', 'blue']], []],                    // And of Has
            [[['doubleJump'], ['blue']], []],                  // Or of Has
            [[[]], [{ item: 'key_blue' }]],                    // pure authored
            [[['doubleJump']], [{ item: 'Coin', count: 3 }]],  // physics AND authored
            [[['doubleJump'], ['blue']], [{ item: 'key_red' }]],
        ];
        for (const [sets, authored] of shapes) {
            expectSchemaValid(composeAuthoredRule(minimalSetsToRule(sets), authored));
            const { paths, authoredDefs } = emitObstaclePaths(sets, authored);
            expectSchemaValid(compileAccessRule(paths, libWith(authoredDefs)));
            for (const def of Object.values(authoredDefs)) {
                expectSchemaValid(def.clear_rule);
            }
        }
    });

    it('the checker itself rejects malformed rules (not vacuously green)', () => {
        expect(ruleSchemaErrors({ args: {} }, schema)).not.toEqual([]);      // no rule/type
        expect(ruleSchemaErrors({ rule: 42 }, schema)).not.toEqual([]);      // non-string
        expect(ruleSchemaErrors(
            { rule: 'And', children: [{ bogus: true }] }, schema)).not.toEqual([]);
    });
});
