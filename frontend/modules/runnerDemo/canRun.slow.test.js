/**
 * Solver ⊆ oracle corpus test (plan §4.3 gate; runs under
 * `npm run test:unit:slow`, see vitest.slow.config.js).
 *
 * The witnessSearch oracle is sound (every claim is a real
 * trajectory) and more complete than canRun's finite policy family,
 * so on every fixture × ability set:
 *   - everything the solver claims reachable, the oracle must
 *     confirm (a violation means the solver fabricated reach — the
 *     one direction that would poison derived rules);
 *   - the measured difference is the policy family's conservatism
 *     gap, logged for calibration (zero on this corpus today).
 * Plus goal-wake corroboration: every pickup/portal hosted on a
 * solver-reached platform must actually be TOUCHED by some oracle
 * trajectory — the end-to-end check of "goal-reachable ⇔
 * host-reachable" that phase 4's verifier will lean on.
 */

import { describe, it, expect } from 'vitest';
import {
    buildRunGraph, reachablePlatforms, reachableRunPlatforms,
} from './canRun.js';
import { witnessSearch } from './witnessSearch.js';
import { FIXTURES, gapJump, glideDrop } from './fixtures.js';
import { noAbilities, allAbilities } from './suppression.js';
import { DEFAULTS, step, spawnState } from './physics.js';

const SETS = [
    ['none', noAbilities()],
    ['dj', { doubleJump: true, blue: false }],
    ['blue', { doubleJump: false, blue: true }],
    ['all', allAbilities()],
];

describe('solver ⊆ oracle over the fixture corpus', () => {
    for (const fixture of FIXTURES) {
        for (const [name, abilities] of SETS) {
            it(`${fixture.id} × ${name}`, () => {
                // airBranchTicks 3: thin the Double-Jump second-press
                // branch points (every 3rd aerial tick + the apex
                // band). A completeness trade (witnessSearch header);
                // this corpus IS its gate — the oracle must keep
                // dominating the solver's own second-press timings,
                // or the solver ⊆ oracle assertion below fails.
                const oracle = witnessSearch(fixture, abilities, { airBranchTicks: 3 });
                // the oracle must have drained its frontier — a budget
                // cap would make the ⊆ assertion vacuously weak
                expect(oracle.exhausted).toBe(true);

                const solver = reachableRunPlatforms(fixture, abilities);
                const fullGraph = reachablePlatforms(buildRunGraph(fixture, abilities));
                expect([...fullGraph].sort()).toEqual([...solver].sort());

                for (const id of solver) {
                    expect(oracle.platforms.has(id),
                        `solver claims '${id}' but no real trajectory reaches it`).toBe(true);
                }
                const gap = [...oracle.platforms].filter((p) => !solver.has(p));
                if (gap.length > 0) {
                    // conservatism, not a bug — logged for calibration
                    console.log(`[gap] ${fixture.id} × ${name}: oracle also reaches {${gap}}`);
                }

                // goal-wake corroboration: wake goals on solver-reached
                // hosts really are touched by real trajectories
                for (const pk of fixture.pickups ?? []) {
                    if (solver.has(pk.on)) {
                        expect(oracle.pickups.has(pk.id),
                            `pickup '${pk.id}' on reached host '${pk.on}' never touched`).toBe(true);
                    }
                }
                for (const pt of fixture.portals ?? []) {
                    if (solver.has(pt.on)) {
                        expect(oracle.portals.has(pt.id),
                            `portal '${pt.id}' on reached host '${pt.on}' never touched`).toBe(true);
                    }
                }
            });
        }
    }
});

describe('glideDrop oracle gate window (plan §8.7 step 4)', () => {
    it('no non-glide superset crosses the chasm — oracle truth, not solver pessimism', () => {
        // the gate's dj-proof margin must hold against REAL trajectories,
        // not just the finite policy family: the strongest itemset
        // without Glide must fail to reach the pad or the far floor
        const noGlide = { doubleJump: true, blue: true, spring: true, glide: false };
        const oracle = witnessSearch(glideDrop, noGlide, { airBranchTicks: 3 });
        expect(oracle.exhausted).toBe(true);
        expect(oracle.platforms.has('pad1')).toBe(false);
        expect(oracle.platforms.has('floorB')).toBe(false);
    });

    it('glide-only: the oracle finds the pad and the crossing (solver ⊆ oracle)', () => {
        const oracle = witnessSearch(glideDrop, { glide: true }, { airBranchTicks: 3 });
        expect(oracle.exhausted).toBe(true);
        const solver = reachableRunPlatforms(glideDrop, { glide: true });
        expect(solver.has('floorB')).toBe(true);
        for (const id of solver) {
            expect(oracle.platforms.has(id),
                `solver claims '${id}' but no real trajectory reaches it`).toBe(true);
        }
    });
});

describe('oracle witness tapes', () => {
    it('reconstructs a real input tape that replays to the claimed support', () => {
        const oracle = witnessSearch(gapJump, noAbilities(), { witnesses: true });
        const tape = oracle.witnessFor('floorB');
        expect(tape).toBeTruthy();
        let s = spawnState(gapJump, DEFAULTS);
        for (const input of tape) s = step(s, input, gapJump, noAbilities(), DEFAULTS);
        expect(s.standingOn).toBe('floorB');
    });
});
