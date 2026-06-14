import { describe, it, expect } from 'vitest';
import { verifyObstacleGating } from './verifyObstacles.js';
import {
    BOUNCE_OBSTACLE_ID_BY_ABILITY, emitObstaclePaths, minimalSetsToRule,
    composeAuthoredRule,
} from './apRules.js';
import { BOUNCE_LIBRARY_OBSTACLES } from './bounceDemoLibrary.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';

// Phase 3 per-obstacle gating verifier: the emitted obstacle paths must
// recompile to the proven rule, and each physics obstacle must gate a
// necessary ability.

// Build a faithful goal the way generateZoneForSpecsGen does.
function goal(kind, id, minimalSets, authored = []) {
    const { paths, authoredDefs } = emitObstaclePaths(minimalSets, authored);
    const rule = composeAuthoredRule(minimalSetsToRule(minimalSets), authored);
    const lib = { ...DEFAULT_OBSTACLES, ...BOUNCE_LIBRARY_OBSTACLES, ...authoredDefs };
    return { goal: { kind, id, minimalSets, paths, rule }, lib };
}

describe('verifyObstacleGating', () => {
    it('passes faithful emissions across all gating shapes', () => {
        const cases = [
            goal('exit', 'e_true', [[]]),
            goal('exit', 'e_spring', [['springs']]),
            goal('pickup', 'p_multi', [['blue', 'springs']]),
            goal('exit', 'e_or', [['left'], ['right']]),
            goal('exit', 'e_key', [[]], [{ item: 'key_red', count: 1 }]),
            goal('pickup', 'p_phys_key', [['springs']], [{ item: 'Coin', count: 2 }]),
            // Multi-ability physics AND authored: the legacy rule NESTS
            // (And(And(R,S), key)) while the flat paths compile to
            // And(R,S,key). Faithfulness is logical, so this must pass.
            goal('exit', 'e_mix', [['right', 'springs']], [{ item: 'key_blue', count: 1 }]),
        ];
        for (const { goal: g, lib } of cases) {
            expect(() => verifyObstacleGating([g], lib)).not.toThrow();
        }
    });

    it('accepts the nested-vs-flat And shape divergence (logical equivalence)', () => {
        const { goal: g, lib } = goal('exit', 'e_mix',
            [['right', 'springs']], [{ item: 'key_blue', count: 1 }]);
        // The proven (legacy) rule is genuinely nested; the recompiled
        // paths are flat — same predicate, accepted.
        expect(g.rule).toEqual({
            rule: 'And',
            children: [
                { rule: 'And', children: [
                    { rule: 'Has', args: { item_name: 'Right arrow' } },
                    { rule: 'Has', args: { item_name: 'Springs' } },
                ] },
                { rule: 'Has', args: { item_name: 'key_blue' } },
            ],
        });
        expect(() => verifyObstacleGating([g], lib)).not.toThrow();
    });

    it('still rejects a Has count mismatch (Has(x,1) vs Has(x,2) are not equivalent)', () => {
        const { goal: g, lib } = goal('pickup', 'p_count', [[]], [{ item: 'Coin', count: 2 }]);
        g.rule = { rule: 'Has', args: { item_name: 'Coin', count: 1 } };
        expect(() => verifyObstacleGating([g], lib)).toThrow(/unfaithful/);
    });

    it('throws when the paths do not recompile to the proven rule (faithfulness)', () => {
        const { goal: g, lib } = goal('exit', 'e_spring', [['springs']]);
        // Corrupt the proven rule so the recompiled paths no longer match.
        g.rule = { rule: 'Has', args: { item_name: 'Jetpacks' } };
        expect(() => verifyObstacleGating([g], lib)).toThrow(/unfaithful/);
    });

    it('throws when a physics obstacle does not match the minimal set (necessity)', () => {
        const { goal: g, lib } = goal('exit', 'e_spring', [['springs']]);
        // Swap the obstacle for a different ability gate: the path now
        // claims to gate 'blue' while the minimal set says 'springs'.
        g.paths = [{ path_id: 'p1', obstacles: [BOUNCE_OBSTACLE_ID_BY_ABILITY.blue] }];
        expect(() => verifyObstacleGating([g], lib)).toThrow(/gate a necessary ability|unfaithful/);
    });

    it('throws on an unknown obstacle id', () => {
        const { goal: g, lib } = goal('exit', 'e_spring', [['springs']]);
        g.paths = [{ path_id: 'p1', obstacles: ['bounce_gate_nonsense'] }];
        expect(() => verifyObstacleGating([g], lib)).toThrow(/unknown obstacle|unfaithful/);
    });

    it('throws when path count disagrees with the minimal sets', () => {
        const { goal: g, lib } = goal('exit', 'e_or', [['left'], ['right']]);
        g.paths = [g.paths[0]]; // drop a path
        expect(() => verifyObstacleGating([g], lib)).toThrow(/paths|unfaithful/);
    });
});
