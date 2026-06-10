/**
 * Fixture ground truth — build-order step 3. Each fixture's known
 * requirements are pinned as assertions so any physics or solver
 * change that silently shifts reachability fails here instead of
 * producing a subtly wrong rules.json. Step 4's verifier re-derives
 * these as minimal ability sets.
 */
import { describe, it, expect } from 'vitest';
import { validateLevel } from './level.js';
import { noAbilities } from './suppression.js';
import {
    jumpQuery,
    buildPlatformGraph,
    findJumpPath,
    reachablePlatforms,
} from './canJump.js';
import { bounceStack } from './fixtures/bounceStack.js';
import { springGap } from './fixtures/springGap.js';
import { fork } from './fixtures/fork.js';

const abilities = (...names) => {
    const a = noAbilities();
    for (const n of names) a[n] = true;
    return a;
};

const reachableUnder = (level, abilitySet) =>
    reachablePlatforms(buildPlatformGraph(level, abilitySet));

describe('fixtures validate', () => {
    it.each([
        ['bounce_stack', bounceStack],
        ['spring_gap', springGap],
        ['fork', fork],
    ])('%s has no model errors', (name, level) => {
        expect(validateLevel(level)).toEqual([]);
    });

    it('validateLevel catches authoring mistakes', () => {
        expect(validateLevel({
            id: 'bad',
            size: { width: 400, height: 1200 },
            platforms: [
                { id: 'p0', x: 200, y: 1100, type: 'beige' },
                { id: 'p0', x: 9999, y: 100, type: 'green' },
            ],
            springs: [{ id: 's0', x: 200, y: 100 }],
            jetpacks: [{ id: 'j0', x: 200, y: 100, on: 'nope' }],
            portals: [],
        })).toEqual(expect.arrayContaining([
            expect.stringContaining("unknown type 'beige'"),
            expect.stringContaining("duplicate id 'p0'"),
            expect.stringContaining('outside level bounds'),
            expect.stringContaining("missing 'on'"),
            expect.stringContaining("references no platform"),
            expect.stringContaining('no portals'),
        ]));
    });
});

describe('spring_gap ground truth', () => {
    it('without springs: stuck below the gap', () => {
        expect(reachableUnder(springGap, noAbilities())).toEqual(new Set(['p0', 'p1']));
    });

    it('with springs: everything reachable, routed over the spring', () => {
        const graph = buildPlatformGraph(springGap, abilities('springs'));
        expect(reachablePlatforms(graph)).toEqual(new Set(['p0', 'p1', 'p2', 'p3', 'p4']));
        expect(findJumpPath(graph, 'p3').plan).toEqual(['p0', 'p1', 'p2', 'p3']);
    });

    it('pickup collected on p3; portal entered by landing on p4', () => {
        const r = jumpQuery(springGap, 'p3', abilities('springs'));
        expect(r.pickupsTouched).toContain('loc_spring');
        expect(r.landedOn).toBe('p4');
        expect(r.portalsTouched).toContain('exit_up');
    });
});

describe('fork ground truth', () => {
    it('per-ability-set reachability table', () => {
        expect(reachableUnder(fork, noAbilities())).toEqual(new Set(['p0']));
        expect(reachableUnder(fork, abilities('right')))
            .toEqual(new Set(['p0', 'p1r', 'p2r', 'p3r']));
        expect(reachableUnder(fork, abilities('left'))).toEqual(new Set(['p0']));
        expect(reachableUnder(fork, abilities('blue'))).toEqual(new Set(['p0']));
        expect(reachableUnder(fork, abilities('left', 'blue')))
            .toEqual(new Set(['p0', 'b1l']));
    });

    it('right branch: pickup touched from its host platform, portal from the top', () => {
        // pickups sit just above their host platform: launching from the
        // host touches them (the semantics step 4's verifier will use)
        const fromP1r = jumpQuery(fork, 'p1r', abilities('right'));
        expect(fromP1r.landedOn).toBe('p2r');
        expect(fromP1r.pickupsTouched).toContain('loc_right');

        const fromTop = jumpQuery(fork, 'p2r', abilities('right'));
        expect(fromTop.portalsTouched).toContain('exit_up');
    });

    it('left pickup requires reaching the blue platform', () => {
        const r = jumpQuery(fork, 'b1l', abilities('left', 'blue'));
        expect(r.pickupsTouched).toContain('loc_left');
        // and it cannot be brushed from p0 without the branch abilities
        const fromP0 = jumpQuery(fork, 'p0', noAbilities());
        expect(fromP0.pickupsTouched).not.toContain('loc_left');
    });

    it('the jetpack is helpful but gates nothing: portal reachable without it', () => {
        const graph = buildPlatformGraph(fork, abilities('right'));
        expect(findJumpPath(graph, 'p2r').ok).toBe(true);
    });
});
