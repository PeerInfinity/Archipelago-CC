/**
 * levelRun — the shared cross-level engine loop.
 *
 * This module exists because a SECOND caller appeared: `botDriverV2` has to
 * advance the same physics through the same world swaps while choosing each
 * tick's keys instead of reading them off a tape. So the tests worth having
 * are the ones that would go red if the two ever stopped being the same
 * thing — not a re-derivation of the transition semantics, which
 * `playerPhysicsV2.test.js` already owns and `transition-west-return` pins
 * against the real game.
 *
 * The failure mode this guards is specifically nasty and is why the
 * factoring was worth the churn: the driver's copy of a world swap is what
 * SYNTHESIZES the tape that the differential then runs through the runner's
 * copy. Two copies would be wrong together, and the tape would still
 * reconcile against the game — a verifier sharing the generator's
 * assumptions, one level up.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt } from './tapeFormat.js';
import { runTapeToStream } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const boot = { level: 0, x: 80, y: 128 };

/** Drive a run by hand off a tape, the way `botDriverV2` drives it by plan. */
function driveByHand(tape) {
    const run = createLevelRun({ levelSource, boot: tape.boot, noclip: tape.noclip });
    const ticks = [{ t: 0, x: run.state.x, y: run.state.y, level: run.level }];
    for (let t = 0; t < tape.tick_count; t++) {
        run.advance(heldKeysAt(tape, t));
        ticks.push({ t: t + 1, x: run.state.x, y: run.state.y, level: run.level });
    }
    return { ticks, transitions: run.transitions, run };
}

describe('one loop, two callers', () => {
    it('hand-driving it reproduces runTape exactly, across a transition', () => {
        // `tapeRunner` reads held keys from the tape; `botDriverV2` chooses
        // them. If those two paths ever diverge, this is where it shows —
        // and `transition-west-return` is the tape that makes it a real
        // claim, because it crosses twice.
        const tape = loadTape('transition-west-return');
        const byHand = driveByHand(tape);
        const byRunner = runTapeToStream(tape, { levelSource });
        expect(byHand.ticks).toEqual(byRunner.ticks);
        expect(byHand.transitions).toEqual(byRunner.transitions);
        expect(byHand.transitions).toHaveLength(2);
    });

    it('reproduces a driver-synthesized tape too', () => {
        const tape = loadTape('cross-level-leg');
        expect(driveByHand(tape).ticks).toEqual(runTapeToStream(tape, { levelSource }).ticks);
    });
});

describe('what the run owns', () => {
    it('counts COMPLETED movement ticks, which is what a transition t means', () => {
        // §1 ruling 2: an entry's `t` is "the first observation tick whose
        // level is the new level". After the swap tick, `ticksCompleted` IS
        // that index — which is why the record can be built here rather than
        // by a caller tracking its own loop variable.
        const tape = loadTape('transition-west-return');
        const { run, transitions } = driveByHand(tape);
        expect(run.ticksCompleted).toBe(tape.tick_count);
        expect(transitions.map((t) => t.t)).toEqual([61, 109]);
    });

    it('swaps the world, not just the level number', () => {
        const tape = loadTape('transition-west-return');
        const run = createLevelRun({ levelSource, boot, noclip: tape.noclip });
        expect(run.level).toBe(0);
        expect(run.world.level).toBe(0);
        for (let t = 0; t < 61; t++) run.advance(heldKeysAt(tape, t));
        expect(run.level).toBe(94);
        expect(run.world.level).toBe(94);
        // A world with level 94's geometry, not level 0's under a new name.
        expect(run.world.pixelmasks.length).toBe(10);
        // The arrival, with the half-tile ctor offset and a fresh player.
        expect(run.state).toMatchObject({ x: 296, y: 168, vx: 0, vy: 0, terrain: 0 });
    });

    it('surfaces the sweep hits the AS3 caller discards', () => {
        // The driver needs them to tell a completed move from one the
        // geometry cut short — the difference between a plan that worked and
        // a planner bug. `collide-up-rock` presses into a BreakableRock.
        const tape = loadTape('collide-up-rock');
        const run = createLevelRun({ levelSource, boot, noclip: false });
        const hits = [];
        for (let t = 0; t < tape.tick_count; t++) {
            const { hitX, hitY } = run.advance(heldKeysAt(tape, t));
            if (hitX || hitY) hits.push({ t, tag: (hitX || hitY).tag });
        }
        expect(hits.length).toBeGreaterThan(0);
        expect(new Set(hits.map((h) => h.tag))).toEqual(new Set(['breakablerock']));
    });

    it('builds a level lazily, so a level nobody enters never throws', () => {
        // `buildLevelWorld` throws by name on geometry v2 does not model.
        // Level 0 exits to 1, 2, 12, 13, 86, 89 and 94, and only 94 builds —
        // so eager construction would make level 0 itself unloadable.
        const run = createLevelRun({ levelSource, boot, noclip: false });
        expect(run.level).toBe(0);
        expect(() => run.worldFor(12)).toThrow(/lightalpha/);
        // ...and it memoises, so a revisited level is not rebuilt.
        expect(run.worldFor(0)).toBe(run.world);
    });

    it('needs a levelSource — there is no default geometry', () => {
        expect(() => createLevelRun({ boot, noclip: false }))
            .toThrow(/needs a levelSource/);
    });
});
