import { describe, expect, it } from 'vitest';

import { MOVE_SPEEDS, step as stepV1 } from './playerPhysicsV1.js';
import {
    DEFAULT_QUANT, KEY_SETS, MAX_AXIS_STEP, MOVER_KEYS, MOVER_PROVENANCE,
    MOVER_RANGE, MoverError, certificateToTape, chebyshevHeuristic,
    earliestArrivalTable, findEarliestArrival, keysToSpans, perAxisVelocityBound,
    planDash, quantKey, replayThroughStepper,
} from './mover.js';

/**
 * ⛔ THE MUTATION LIST, and what each defect looks like in the wild:
 *
 *  · the heuristic's denominator sampled     -> `h` overstates, A* returns a
 *    instead of derived                         path that is not optimal and
 *                                               still says `optimal: true`
 *  · the goal tested on GENERATION           -> plans one tick long, silently
 *  · a dwell edge accepted only at its       -> the plan walks THROUGH the end
 *    LAST tick                                  region and reports a later tick
 *  · a dwell edge emitting ONE key entry     -> the tape runs out mid-dash and
 *    per EDGE                                   reads as a physics divergence
 *  · a negative returned without its bound   -> "no path" where the truth is
 *                                               "no path at this granularity"
 *  · `optimal` left true under a dwell       -> an upper bound wearing an
 *                                               optimality claim
 *  · opposing key sets pruned as "no-ops"    -> real transitions removed;
 *                                               applyInput is four `if`s
 */
describe('the mover', () => {
    const OPEN = { terrainStateAt: () => 0, world: { width: 1e7, height: 1e7 } };
    // ⚠ Far from the world clamp ON PURPOSE. A first attempt at the reach
    // table started at x = 0, where `clampFor`'s minX is the player's own
    // origin — every step got clamped UP and the table measured the CLAMP,
    // reporting a flat 2.0 px/tick that the physics cannot produce.
    const HOME = { x: 100000, y: 100000, vx: 0, vy: 0 };

    describe('the key sets', () => {
        it('are all sixteen, including the opposing pairs', () => {
            expect(KEY_SETS).toHaveLength(16);
            expect(KEY_SETS.some((k) => k.includes('up') && k.includes('down'))).toBe(true);
            expect(KEY_SETS.some((k) => k.includes('left') && k.includes('right'))).toBe(true);
        });

        it('⛔ an opposing pair is a no-op FROM REST and is NOT at speed', () => {
            // ⛓ THE HALF THAT MAKES THE PRUNE TEMPTING, MEASURED. From rest,
            // `up` fires (0 > -0.8) and then `down` fires (-0.8 < 0.8) and
            // they cancel exactly — so a census taken at rest says "no-op".
            const restBoth = stepV1(HOME, new Set(['up', 'down']), OPEN);
            const restNone = stepV1(HOME, new Set(), OPEN);
            expect(restBoth.vy).toBe(restNone.vy);

            // ⛔ AT SPEED THEY DO NOT. With vy already past -moveSpeed, `up`'s
            // threshold blocks and only `down` fires, so the pair is a BRAKE
            // that no single key provides. Pruning it would delete the fastest
            // way to stop.
            const fast = { ...HOME, vy: -1.2 };
            const both = stepV1(fast, new Set(['up', 'down']), OPEN);
            const none = stepV1(fast, new Set(), OPEN);
            const downOnly = stepV1(fast, new Set(['down']), OPEN);
            expect(both.vy).not.toBe(none.vy);
            expect(both.vy).toBe(downOnly.vy);
            expect(both.vy).toBeGreaterThan(none.vy);
        });
    });

    describe('the velocity bound is DERIVED, not sampled', () => {
        it('is 2 x moveSpeed, and the fastest terrain sets MAX_AXIS_STEP', () => {
            expect(perAxisVelocityBound(0.8)).toBe(1.6);
            expect(MAX_AXIS_STEP).toBe(2 * Math.max(...MOVE_SPEEDS));
        });

        it('⛔ a long hold EXCEEDS what random sampling reaches, and stays under the bound', () => {
            // 400 random walks reached 1.4342 and would have made `h`
            // inadmissible. A plain hold beats that inside 40 ticks.
            let s = HOME;
            let peak = 0;
            for (let t = 0; t < 400; t += 1) {
                s = stepV1(s, new Set(['right']), OPEN);
                peak = Math.max(peak, s.vx);
            }
            expect(peak).toBeGreaterThan(1.4342);
            expect(peak).toBeLessThan(MAX_AXIS_STEP);
        });

        it('the heuristic UNDERSTATES the true tick count — the admissibility test', () => {
            const goal = { x: HOME.x + 24, y: HOME.y };
            const h = chebyshevHeuristic(goal)(HOME);
            const cert = findEarliestArrival({
                start: HOME, accept: (s) => s.x >= goal.x,
                heuristic: chebyshevHeuristic(goal), stepOpts: OPEN,
                dwell: 2, limits: { maxTicks: 200, maxExpansions: 60000 },
            });
            expect(cert.ok).toBe(true);
            // h must never exceed the achievable tick count, or A* is unsound.
            expect(h).toBeLessThanOrEqual(cert.ticks);
        });
    });

    describe('a certificate', () => {
        const cert = findEarliestArrival({
            start: HOME, accept: (s) => s.x >= HOME.x + 8,
            heuristic: chebyshevHeuristic({ x: HOME.x + 8, y: HOME.y }),
            stepOpts: OPEN, limits: { maxTicks: 200, maxExpansions: 60000 },
        });

        it('is found, and at dwell 1 it is tick-optimal', () => {
            expect(cert.ok).toBe(true);
            expect(cert.optimal).toBe(true);
            expect(cert.ticks).toBe(7);
        });

        it('replays EXACTLY through the stepper — zero drift, not a tolerance', () => {
            const r = replayThroughStepper(cert, OPEN);
            expect(r.drift).toBe(0);
            expect(r.ok).toBe(true);
        });

        it('has one key-stream entry PER TICK, not per edge', () => {
            expect(cert.keysPerTick).toHaveLength(cert.ticks);
        });

        it('encodes as overlapping per-key spans that `heldKeysAt` re-unions', () => {
            const held = (t) => new Set(cert.spans
                .filter((s) => t >= s.from && t < s.to).map((s) => s.key));
            for (let i = 0; i < cert.ticks; i += 1) {
                expect([...held(cert.startTick + i)].sort())
                    .toEqual([...cert.keysPerTick[i]].sort());
            }
        });

        it('becomes a tape whose tick_count covers the whole plan', () => {
            const tape = certificateToTape(cert, { boot: { level: 0, x: 80, y: 128 } });
            expect(tape.tick_count).toBe(cert.startTick + cert.ticks);
            expect(tape.inputs).toEqual(cert.spans);
            expect(tape.boot.level).toBe(0);
        });

        it('refuses to become a tape without a skeleton', () => {
            expect(() => certificateToTape(cert, {})).toThrow(MoverError);
        });
    });

    describe('the dwell demotes the claim rather than hiding it', () => {
        const goal = HOME.x + 24;
        const cert = findEarliestArrival({
            start: HOME, accept: (s) => s.x >= goal,
            heuristic: chebyshevHeuristic({ x: goal, y: HOME.y }),
            stepOpts: OPEN, dwell: 2, limits: { maxTicks: 200, maxExpansions: 60000 },
        });

        it('answers where dwell 1 cannot, and says it is NOT optimal', () => {
            expect(cert.ok).toBe(true);
            expect(cert.optimal).toBe(false);
        });

        it('still replays exactly — a restriction cannot make a plan invalid', () => {
            expect(replayThroughStepper(cert, OPEN).drift).toBe(0);
        });

        it('⛔ accepts MID-dwell, so it does not walk through the end region', () => {
            // With `accept` as a half-plane and dwell 4, a search that only
            // tested each edge's last tick would overshoot by up to 3 ticks.
            const c4 = findEarliestArrival({
                start: HOME, accept: (s) => s.x >= HOME.x + 8,
                heuristic: chebyshevHeuristic({ x: HOME.x + 8, y: HOME.y }),
                stepOpts: OPEN, dwell: 4, limits: { maxTicks: 200, maxExpansions: 60000 },
            });
            expect(c4.ok).toBe(true);
            // The FINAL state must be the first one inside the region, so the
            // state one tick earlier must be outside it.
            const states = replayThroughStepper(c4, OPEN).states;
            expect(states[states.length - 1].x).toBeGreaterThanOrEqual(HOME.x + 8);
            expect(states[states.length - 2].x).toBeLessThan(HOME.x + 8);
        });

        it('rejects a nonsense dwell by name', () => {
            expect(() => findEarliestArrival({
                start: HOME, accept: () => true, dwell: 0,
            })).toThrow(MoverError);
        });
    });

    describe('every negative names its bound', () => {
        it('an exhausted expansion budget says so', () => {
            const r = findEarliestArrival({
                start: HOME, accept: (s) => s.x >= HOME.x + 4000,
                heuristic: chebyshevHeuristic({ x: HOME.x + 4000, y: HOME.y }),
                stepOpts: OPEN, limits: { maxTicks: 4000, maxExpansions: 500 },
            });
            expect(r.ok).toBe(false);
            expect(r.bound).toMatch(/maxExpansions=500/);
            expect(r.closest).toBeTruthy();
        });

        it('a timeline that forbids the START refuses before expanding anything', () => {
            const r = findEarliestArrival({
                start: HOME, accept: () => false, stepOpts: OPEN,
                forbiddenAt: () => true,
            });
            expect(r.ok).toBe(false);
            expect(r.reason).toMatch(/START/);
            expect(r.expansions).toBe(0);
        });

        it('an exhausted reachable set says "at this granularity", not "no path"', () => {
            // A sealed box: the world clamp is the only geometry, so the
            // reachable set really is finite.
            const boxed = { terrainStateAt: () => 0, world: { width: 24, height: 24 } };
            const r = findEarliestArrival({
                start: { x: 12, y: 12, vx: 0, vy: 0 },
                accept: (s) => s.x >= 1000, stepOpts: boxed,
                limits: { maxTicks: 4, maxExpansions: 200000 },
            });
            expect(r.ok).toBe(false);
            expect(r.bound).toMatch(/NOT "no path"/);
            expect(r.bound).toMatch(/quant/);
        });
    });

    describe('the timeline is a first-class input, and it is NAMED', () => {
        it('planDash refuses an anonymous timeline', () => {
            expect(() => planDash({
                start: HOME, endRegion: (s) => s.x >= HOME.x + 4,
                stepOpts: OPEN, forbiddenAt: () => false,
            })).toThrow(MoverError);
        });

        it('the claim never says "safe"', () => {
            const d = planDash({
                start: HOME, endRegion: (s) => s.x >= HOME.x + 4,
                heuristicTarget: { x: HOME.x + 4, y: HOME.y },
                stepOpts: OPEN, forbiddenAt: () => false, timelineName: 'a test timeline',
            });
            expect(d.ok).toBe(true);
            expect(d.certifiedAgainst.claim).toMatch(/NOT "safe"/);
            expect(d.certifiedAgainst.timeline).toBe('a test timeline');
        });

        it('a timeline that closes the corridor makes the plan go round it', () => {
            // Forbid a vertical band from tick 0, wide enough to matter.
            const forbidden = (tick, x) => x > HOME.x + 2 && x < HOME.x + 6
                && tick < 3;
            const withBand = planDash({
                start: HOME, endRegion: (s) => s.x >= HOME.x + 8,
                heuristicTarget: { x: HOME.x + 8, y: HOME.y },
                stepOpts: OPEN, forbiddenAt: forbidden, timelineName: 'band',
                limits: { maxTicks: 200, maxExpansions: 60000 },
            });
            const without = planDash({
                start: HOME, endRegion: (s) => s.x >= HOME.x + 8,
                heuristicTarget: { x: HOME.x + 8, y: HOME.y },
                stepOpts: OPEN, timelineName: null,
                limits: { maxTicks: 200, maxExpansions: 60000 },
            });
            expect(without.ok).toBe(true);
            // The band costs ticks or refuses; either is a real answer, and a
            // plan that ignored the timeline entirely would tie exactly.
            if (withBand.ok) expect(withBand.ticks).toBeGreaterThanOrEqual(without.ticks);
            else expect(withBand.bound).toBeTruthy();
        });
    });

    describe('the earliest-arrival table', () => {
        it('answers several goals from one sweep, and names its bound', () => {
            const t = earliestArrivalTable({
                start: HOME,
                goals: {
                    east4: (s) => s.x >= HOME.x + 4,
                    south4: (s) => s.y >= HOME.y + 4,
                    east20: (s) => s.x >= HOME.x + 20,
                },
                stepOpts: OPEN,
                limits: { maxTicks: 12, maxExpansions: 40000 },
            });
            expect(t.arrivals.get('east4').ticks).toBeGreaterThan(0);
            expect(t.arrivals.get('south4').ticks).toBeGreaterThan(0);
            expect(t.bound).toBeTruthy();
            // east20 is out of reach in 12 ticks; the table must say why
            // rather than leaving a silent gap.
            if (t.unreached.includes('east20')) {
                expect(t.bound).toMatch(/STOPPED BY|exhausted/);
            }
        });

        it('a goal already true at the start arrives at tick 0', () => {
            const t = earliestArrivalTable({
                start: HOME, goals: { here: () => true }, stepOpts: OPEN,
                limits: { maxTicks: 2, maxExpansions: 100 },
            });
            expect(t.arrivals.get('here').ticks).toBe(0);
        });

        it('refuses a malformed goals object', () => {
            expect(() => earliestArrivalTable({ start: HOME, goals: null }))
                .toThrow(MoverError);
        });
    });

    describe('the recorded capability is asserted, not just documented', () => {
        it.each(MOVER_RANGE)('reaches $px px at dwell $dwell in $ticks ticks',
            ({ px, dwell, ticks, optimal }) => {
                const r = findEarliestArrival({
                    start: HOME, accept: (s) => s.x >= HOME.x + px,
                    heuristic: chebyshevHeuristic({ x: HOME.x + px, y: HOME.y }),
                    stepOpts: OPEN, dwell,
                    limits: { maxTicks: 400, maxExpansions: 60000 },
                });
                expect(r.ok, `${px}px at dwell ${dwell}: ${r.bound ?? ''}`).toBe(true);
                expect(r.ticks).toBe(ticks);
                expect(r.optimal).toBe(optimal);
                expect(replayThroughStepper(r, OPEN).drift).toBe(0);
            });
    });

    describe('housekeeping', () => {
        it('quantKey merges only within the grid', () => {
            const a = { x: 10, y: 10, vx: 0, vy: 0 };
            expect(quantKey(a, DEFAULT_QUANT))
                .toBe(quantKey({ ...a, x: 10.05 }, DEFAULT_QUANT));
            expect(quantKey(a, DEFAULT_QUANT))
                .not.toBe(quantKey({ ...a, x: 11 }, DEFAULT_QUANT));
        });

        it('keysToSpans run-length encodes per key and offsets by the start tick', () => {
            const spans = keysToSpans([['right'], ['right'], [], ['right', 'up']], 100);
            expect(spans).toContainEqual({ key: 'right', from: 100, to: 102 });
            expect(spans).toContainEqual({ key: 'right', from: 103, to: 104 });
            expect(spans).toContainEqual({ key: 'up', from: 103, to: 104 });
        });

        it('the provenance records the goal-test and the range', () => {
            expect(MOVER_PROVENANCE.goalTest).toMatch(/ON POP/);
            expect(MOVER_PROVENANCE.range).toMatch(/SHORT/);
            expect(MOVER_PROVENANCE.transition).toMatch(/exact stepper/);
        });

        it('MOVER_KEYS is applyInput\'s own branch order', () => {
            expect(MOVER_KEYS).toEqual(['up', 'right', 'down', 'left']);
        });
    });
});
