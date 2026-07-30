/**
 * tapeRunner — replay indexing, and the fixture differential.
 *
 * ✅ The committed expectations are now ORACLE RECORDINGS: observation
 * streams drained from the REAL recompiled Seedling wasm build (slice 3,
 * recorded 2026-07-30 on real-GPU Windows Chrome). So this suite is a
 * genuine independent stratum — the expected values came from the game,
 * not from the module under test — and every fixture below asserts that
 * this JS transcription reproduces the real game's doubles EXACTLY.
 *
 * That exactness is not aspirational: all five fixtures (220 ticks)
 * matched bit for bit on the first recording, float noise included.
 *
 * Provisional (`*.provisional.json`, written by `fixtures/regenerate.mjs`
 * from our OWN engine) remains the bootstrap path for a NEW fixture that
 * has not been recorded yet. `loadExpectation` prefers an oracle file and
 * reports which regime it used, and the test below pins that none of the
 * current fixtures are riding the bootstrap — a verifier sharing the
 * generator's assumptions verifies nothing.
 *
 * `playerPhysicsV1.test.js` remains a SECOND independent stratum: values
 * hand-derived from the AS3 rather than recorded from anything.
 */

import { describe, expect, it } from 'vitest';

import { fixtureNames, loadExpectation, loadTape } from './fixtures/index.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import { diffObservationStreams } from './tapeFormat.js';
import { runTape, runTapeToStream } from './tapeRunner.js';

/** Entity spawn for the fixtures' shared boot block (Player.as:357: +8,+8). */
const SPAWN = spawnFromBoot({ x: 80, y: 128 });

const tape = (inputs, extra = {}) => ({
    tape_version: 1,
    game: 'seedling',
    boot: { level: 0, x: 80, y: 128 },
    noclip: true,
    inputs,
    ...extra,
});

describe('record-then-act indexing', () => {
    it('emits tick_count + 1 observations', () => {
        // The AS3 hook records at the top of Main.update (before this
        // tick's movement), so observation t is the state after t
        // completed ticks and the last one needs its own disarm record.
        const { ticks } = runTape(tape([{ key: 'right', from: 0, to: 5 }]));
        expect(ticks).toHaveLength(6);
        expect(ticks[0]).toEqual({ t: 0, x: SPAWN.x, y: SPAWN.y, level: 0 });
    });

    it('observation 0 is the spawn, half a tile in from the boot args', () => {
        // Player.as:357 re-centres onto the tile, so new Game(0,80,128)
        // puts the entity at (88,136) — verified against the real game.
        const { ticks } = runTape(tape([{ key: 'right', from: 0, to: 3 }]));
        expect(ticks[0].x).toBe(88);
        expect(ticks[0].y).toBe(136);
        expect(ticks[1].x).toBeCloseTo(88.8, 12);   // after ONE tick of input
    });

    it('carries the boot level on every observation', () => {
        const { ticks } = runTape(tape([{ key: 'right', from: 0, to: 3 }],
            { boot: { level: 7, x: 80, y: 128 } }));
        expect(ticks.every((o) => o.level === 7)).toBe(true);
    });

    it('emits an empty transitions array at the v1 rung', () => {
        expect(runTapeToStream(tape([{ key: 'right', from: 0, to: 3 }])).transitions)
            .toEqual([]);
    });

    it('handles a tape with no inputs at all', () => {
        const { ticks } = runTape(tape([], { tick_count: 3 }));
        expect(ticks).toHaveLength(4);
        expect(ticks.every((o) => o.x === SPAWN.x && o.y === SPAWN.y)).toBe(true);
    });
});

describe('guards', () => {
    it('refuses a collision tape rather than silently running noclip physics', () => {
        // v1 has no collision model, so running it would produce a stream
        // that disagrees with the game for a reason the differential would
        // misattribute to physics.
        expect(() => runTape(tape([{ key: 'right', from: 0, to: 3 }], { noclip: false })))
            .toThrow(/v2 rung/);
    });

    it('re-validates the tape it is handed', () => {
        expect(() => runTape(tape([{ key: 'jump', from: 0, to: 3 }])))
            .toThrow(/not a known key name/);
    });
});

describe('fixture differential', () => {
    const names = fixtureNames();

    it('has fixtures on disk', () => {
        // Positive control: every "each fixture matches" assertion below is
        // vacuous if the roster is empty.
        expect(names.length).toBeGreaterThanOrEqual(5);
    });

    it.each(names)("%s: JS stream matches the real game recording, exactly", (name) => {
        const { stream: expected } = loadExpectation(name);
        const actual = runTapeToStream(loadTape(name));
        expect(diffObservationStreams(expected, actual)).toBeNull();
    });

    it('every fixture is backed by an ORACLE recording, not a bootstrap', () => {
        // This is what makes the assertions above mean "the port matches the
        // real game" rather than "the port matches itself". A new fixture
        // that has not been recorded yet would show up here rather than
        // quietly weakening the whole suite's claim.
        const provisional = names.filter((n) => loadExpectation(n).provisional);
        expect(provisional).toEqual([]);
    });
});

describe('fixture behaviour each tape was written to exercise', () => {
    it('straight-run: velocity overshoots the 0.8 cap', () => {
        const { ticks } = runTape(loadTape('straight-run'));
        const perTickDx = ticks.slice(1).map((o, i) => o.x - ticks[i].x);
        expect(Math.max(...perTickDx)).toBeGreaterThan(0.8);
    });

    it('diagonal-run: covers ~sqrt(2)x the ground of the axis-aligned run', () => {
        // The claim is about TOTAL speed, not per-axis displacement: vector
        // friction removes one quantum from the combined length while both
        // axes accelerate independently, so the diagonal's path is ~sqrt(2)
        // longer. Per axis it is very slightly SHORTER (the same budget
        // split two ways) — asserting per-axis would be asserting the wrong
        // thing and would pass for a per-axis-damping port.
        const diag = runTape(loadTape('diagonal-run')).final;
        const straight = runTape(loadTape('straight-run')).final;
        const diagPath = Math.hypot(diag.x - SPAWN.x, diag.y - SPAWN.y);
        const straightPath = Math.abs(straight.x - SPAWN.x);
        expect(diagPath / straightPath).toBeCloseTo(Math.SQRT2, 1);
        expect(diagPath).toBeGreaterThan(straightPath * 1.3);
    });

    it('friction-stop: comes to an exact, complete stop', () => {
        const { final } = runTape(loadTape('friction-stop'));
        expect(final.vx).toBe(0);
        expect(final.vy).toBe(0);
    });

    it('direction-flip: ends left of the spawn', () => {
        expect(runTape(loadTape('direction-flip')).final.x).toBeLessThan(SPAWN.x);
    });

    it('shuffle-stop: two full accelerate/decelerate cycles, ending near home', () => {
        // Replaces the original clamp fixture. The real game loads an
        // adjacent level before the player can ever walk to the x=2 clamp
        // (the recorded oracle showed level=94 at tick 61), so no valid v1
        // tape reaches it — the clamp stays covered by the hand-derived
        // unit case in playerPhysicsV1.test.js instead.
        const { ticks, final } = runTape(loadTape('shuffle-stop'));
        expect(final.vx).toBe(0);
        expect(final.vy).toBe(0);
        // Went right, came back left, and stayed in one level throughout.
        const xs = ticks.map((o) => o.x);
        expect(Math.max(...xs)).toBeGreaterThan(SPAWN.x + 8);
        expect(final.x).toBeLessThan(Math.max(...xs));
        expect(ticks.every((o) => o.level === 0)).toBe(true);
        // Came to a complete halt mid-tape too, not only at the end.
        const restTicks = xs.filter((x, i) => i > 0 && x === xs[i - 1]).length;
        expect(restTicks).toBeGreaterThan(10);
    });
});
