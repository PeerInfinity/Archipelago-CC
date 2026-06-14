import { describe, it, expect } from 'vitest';
import {
    BOUNCE_LIBRARY_OBSTACLES,
    BOUNCE_OBSTACLE_ID_BY_ABILITY,
} from './bounceDemoLibrary.js';
import { ABILITY_ITEM_NAMES, minimalSetsToRule } from './apRules.js';
import { compileAccessRule } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { makeHasRule } from '../shared/rulesJsonBuilder.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';

// Phase 1 of the obstacles-along-paths refactor
// (NewDocs/plans/procedural-generation/topdown-bounce-obstacle-refactor.md):
// the bounce physics obstacle vocabulary must compile, through the
// shared (tile-agnostic) compiler, to the same has(item) rules bounce
// already derives from geometry via minimalSetsToRule.

// Mimics the engine's mergedLib = { ...obstacleLib, ...localLib }.
const MERGED_LIB = { ...DEFAULT_OBSTACLES, ...BOUNCE_LIBRARY_OBSTACLES };

const pathThrough = (...obstacleIds) => [{ path_id: 'p1', obstacles: obstacleIds }];

describe('bounce obstacle vocabulary (Phase 1)', () => {
    it('declares exactly one obstacle per ability', () => {
        const abilities = Object.keys(ABILITY_ITEM_NAMES);
        expect(Object.keys(BOUNCE_OBSTACLE_ID_BY_ABILITY).sort()).toEqual([...abilities].sort());
        expect(Object.keys(BOUNCE_LIBRARY_OBSTACLES)).toHaveLength(abilities.length);
        for (const ability of abilities) {
            const id = BOUNCE_OBSTACLE_ID_BY_ABILITY[ability];
            expect(BOUNCE_LIBRARY_OBSTACLES[id]).toBeDefined();
            expect(BOUNCE_LIBRARY_OBSTACLES[id].bounce_ability).toBe(ability);
        }
    });

    it('each obstacle is a single-item combo_list clearing its ability item', () => {
        for (const [ability, itemName] of Object.entries(ABILITY_ITEM_NAMES)) {
            const obstacle = BOUNCE_LIBRARY_OBSTACLES[BOUNCE_OBSTACLE_ID_BY_ABILITY[ability]];
            expect(obstacle.clear_set_type).toBe('combo_list');
            expect(obstacle.clear_set).toEqual([[itemName]]);
            expect(obstacle.feature).toBe('bounce_abilities');
        }
    });

    it('compiles a single-obstacle path to has(<ability item>)', () => {
        for (const [ability, itemName] of Object.entries(ABILITY_ITEM_NAMES)) {
            const id = BOUNCE_OBSTACLE_ID_BY_ABILITY[ability];
            const rule = compileAccessRule(pathThrough(id), MERGED_LIB);
            expect(rule).toEqual(makeHasRule(itemName));
        }
    });

    it('matches the geometry-derived rule (minimalSetsToRule) for the same ability', () => {
        for (const ability of Object.keys(ABILITY_ITEM_NAMES)) {
            const id = BOUNCE_OBSTACLE_ID_BY_ABILITY[ability];
            const viaObstacles = compileAccessRule(pathThrough(id), MERGED_LIB);
            const viaDerivation = minimalSetsToRule([[ability]]);
            expect(viaObstacles).toEqual(viaDerivation);
        }
    });

    it('compiles a multi-obstacle path to an AND of the ability items', () => {
        const blue = BOUNCE_OBSTACLE_ID_BY_ABILITY.blue;
        const springs = BOUNCE_OBSTACLE_ID_BY_ABILITY.springs;
        const rule = compileAccessRule(pathThrough(blue, springs), MERGED_LIB);
        expect(rule).toEqual({
            rule: 'And',
            children: [makeHasRule('Blue platforms'), makeHasRule('Springs')],
        });
        // Same as deriving a single minimal set requiring both abilities.
        expect(rule).toEqual(minimalSetsToRule([['blue', 'springs']]));
    });

    it('compiles OR-of-paths (alternative routes) to an Or of has rules', () => {
        const left = BOUNCE_OBSTACLE_ID_BY_ABILITY.left;
        const right = BOUNCE_OBSTACLE_ID_BY_ABILITY.right;
        const paths = [
            { path_id: 'p1', obstacles: [left] },
            { path_id: 'p2', obstacles: [right] },
        ];
        const rule = compileAccessRule(paths, MERGED_LIB);
        expect(rule).toEqual({
            rule: 'Or',
            children: [makeHasRule('Left arrow'), makeHasRule('Right arrow')],
        });
        expect(rule).toEqual(minimalSetsToRule([['left'], ['right']]));
    });

    it('uses stable ids that do not collide with the shared obstacle library', () => {
        for (const id of Object.keys(BOUNCE_LIBRARY_OBSTACLES)) {
            expect(id.startsWith('bounce_gate_')).toBe(true);
            expect(DEFAULT_OBSTACLES[id]).toBeUndefined();
        }
    });
});
