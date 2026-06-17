import { describe, it, expect } from 'vitest';
import {
    ABILITY_ITEM_NAMES, BOUNCE_OBSTACLE_ID_BY_ABILITY,
    emitObstaclePaths, minimalSetsToRule, composeAuthoredRule,
} from './apRules.js';
import { BOUNCE_LIBRARY_OBSTACLES } from './bounceDemoLibrary.js';
import { OBSTACLE_PRIMITIVES } from './generator.js';
import { compileAccessRule } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { createRng } from '../shared/rng.js';
import { EXPERIMENTAL_GEOMETRY } from './generator.js';

// Phase 3 of the obstacles-along-paths refactor
// (NewDocs/plans/procedural-generation/topdown-bounce-obstacle-refactor.md):
// bounce reasons in obstacles end-to-end. emitObstaclePaths turns a goal's
// derived minimal ability sets + authored terms into the shared
// paths-and-obstacles vocabulary; the FAITHFULNESS invariant is that those
// paths, compiled by the shared (tile-agnostic) compiler, reproduce the
// legacy composeAuthoredRule(minimalSetsToRule(...)) output that bounce
// shipped before — so switching the canonical representation to obstacles
// leaves emitted rules byte-identical.

// The compile lib the engine assembles for a bounce region: base obstacles
// + the physics defs + whatever authored logic_gate defs the emit produced.
function libWith(authoredDefs) {
    return { ...DEFAULT_OBSTACLES, ...BOUNCE_LIBRARY_OBSTACLES, ...authoredDefs };
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
                { path_id: 'p1', obstacles: [BOUNCE_OBSTACLE_ID_BY_ABILITY[ability]] },
            ]);
        }
    });

    it('a multi-ability set -> one path of physics obstacles in set order', () => {
        const { paths } = expectFaithful([['blue', 'springs']]);
        expect(paths).toEqual([{
            path_id: 'p1',
            obstacles: [
                BOUNCE_OBSTACLE_ID_BY_ABILITY.blue,
                BOUNCE_OBSTACLE_ID_BY_ABILITY.springs,
            ],
        }]);
    });

    it('alternative ability sets -> OR of paths', () => {
        const { paths } = expectFaithful([['left'], ['right']]);
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
    });

    it('pure-authored gate (True_ physics + a foreign key) -> a logic_gate obstacle', () => {
        const { paths, authoredDefs } = expectFaithful([[]], [{ item: 'key_blue', count: 1 }]);
        expect(paths).toHaveLength(1);
        const [id] = paths[0].obstacles;
        expect(id).toBe('bounce_logic_key_blue');
        expect(authoredDefs[id]).toMatchObject({
            clear_set_type: 'rule',
            clear_rule: { rule: 'Has', args: { item_name: 'key_blue' } },
        });
        // Compiles to exactly Has(key_blue), like the shipped mixed preset.
        expect(compileAccessRule(paths, libWith(authoredDefs)))
            .toEqual({ rule: 'Has', args: { item_name: 'key_blue' } });
    });

    it('a physics ability AND a foreign key -> physics obstacle then logic gate', () => {
        const { paths, authoredDefs } = expectFaithful([['springs']], [{ item: 'key_red', count: 1 }]);
        expect(paths[0].obstacles).toEqual([
            BOUNCE_OBSTACLE_ID_BY_ABILITY.springs, 'bounce_logic_key_red',
        ]);
        expect(compileAccessRule(paths, libWith(authoredDefs))).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'Springs' } },
                { rule: 'Has', args: { item_name: 'key_red' } },
            ],
        });
    });

    it('count > 1 authored term rides the obstacle id and clear_rule', () => {
        const { paths, authoredDefs } = emitObstaclePaths([[]], [{ item: 'Coin', count: 3 }]);
        const [id] = paths[0].obstacles;
        expect(id).toBe('bounce_logic_Coin__x3');
        expect(authoredDefs[id].clear_rule).toEqual({
            rule: 'Has', args: { item_name: 'Coin', count: 3 },
        });
    });

    it('two goals gating on the same authored term share one obstacle def', () => {
        const a = emitObstaclePaths([[]], [{ item: 'key_blue' }]);
        const b = emitObstaclePaths([['blue']], [{ item: 'key_blue' }]);
        expect(Object.keys(a.authoredDefs)).toEqual(['bounce_logic_key_blue']);
        expect(b.authoredDefs.bounce_logic_key_blue)
            .toEqual(a.authoredDefs.bounce_logic_key_blue);
    });
});

describe('obstacle primitives — geometry templates keyed by the obstacle id', () => {
    it('has one primitive per ability, each carrying its obstacle id', () => {
        expect(Object.keys(OBSTACLE_PRIMITIVES).sort())
            .toEqual(Object.keys(ABILITY_ITEM_NAMES).sort());
        for (const ability of Object.keys(ABILITY_ITEM_NAMES)) {
            expect(OBSTACLE_PRIMITIVES[ability].obstacleId)
                .toBe(BOUNCE_OBSTACLE_ID_BY_ABILITY[ability]);
        }
    });

    it('buildSteps reproduces the legacy gate geometry (no drift)', () => {
        // Deterministic rng: the primitive must draw the same gap height
        // the old gateSteps switch did. Spot-check the rng-using gates.
        const G = EXPERIMENTAL_GEOMETRY;
        const springRng = createRng(42);
        const expectGap = G.SPRING_GAP.min + createRng(42).next() * G.SPRING_GAP.span;
        const steps = OBSTACLE_PRIMITIVES.springs.buildSteps(springRng, G);
        expect(steps).toEqual([{ dy: expectGap, spring: true }]);
        // Non-rng gates are pure geometry.
        expect(OBSTACLE_PRIMITIVES.left.buildSteps(createRng(1), G))
            .toEqual([{ dy: G.PLAIN_DY, dx: -G.BRANCH_DX }]);
        expect(OBSTACLE_PRIMITIVES.blue.buildSteps(createRng(1), G))
            .toEqual([{ dy: G.PLAIN_DY, type: 'blue' }, { dy: G.PLAIN_DY }]);
    });
});
