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
 * v2 slice 0 added two more recordings — `collide-up-rock` and
 * `transition-west-return` — drained from the same build with collision
 * ON. They are the RECONCILIATION TARGETS the v2 engine is written toward,
 * so they arrived before the physics that has to reproduce them.
 * `collide-up-rock` was reconciled at slice 2 and now carries the ordinary
 * exact-match assertion; `transition-west-return` waits for slice 3 and is
 * pinned by name in the pending list below. What both of them PIN about the
 * real game is asserted directly against the recordings at the bottom of
 * this file, which stays worth having: it says what each fixture was for in
 * values, so a later refactor that moves the whole stream in step cannot
 * quietly take the meaning with it.
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
import { atlasLevelSource } from './levelSource.js';
import { MOVE_SPEEDS, spawnFromBoot } from './playerPhysicsV1.js';
import { TransitionNotModelledError } from './playerPhysicsV2.js';
import { diffObservationStreams } from './tapeFormat.js';
import { runTape, runTapeToStream } from './tapeRunner.js';

/** Entity spawn for the fixtures' shared boot block (Player.as:357: +8,+8). */
const SPAWN = spawnFromBoot({ x: 80, y: 128 });

/** The injected geometry seam — see `playerPhysicsV2`'s docblock. */
const levelSource = atlasLevelSource();

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
    it('refuses a collision tape when no geometry was injected', () => {
        // Without a levelSource there is no collision model, so the run
        // would produce a stream that disagrees with the game for a reason
        // the differential would misattribute to physics. Loud, not
        // fallback: a graceful degrade here is how a whole slice's worth of
        // assertions becomes vacuous.
        expect(() => runTape(tape([{ key: 'right', from: 0, to: 3 }], { noclip: false })))
            .toThrow(/no opts.levelSource/);
    });

    it('runs the same collision tape once geometry IS injected', () => {
        const t = tape([{ key: 'up', from: 0, to: 3 }], { noclip: false });
        expect(runTape(t, { levelSource }).ticks).toHaveLength(4);
    });

    it('re-validates the tape it is handed', () => {
        expect(() => runTape(tape([{ key: 'jump', from: 0, to: 3 }])))
            .toThrow(/not a known key name/);
    });
});

describe('fixture differential', () => {
    const names = fixtureNames();
    /**
     * The roster is SPLIT by what the engine can run, not by what has been
     * recorded. v2's slice 0 recorded collision and cross-level tapes from
     * the real game FIRST and transcribed toward them, so the oracle
     * recordings landed before the physics that has to reproduce them.
     *
     * Slice 2 re-armed the sweeps, which moved `collide-up-rock` across.
     * What is left pending is exactly what needs a modelled ROOM
     * TRANSITION, which is slice 3 — the world swap, the arrival offset,
     * the anti-ping-pong latch and the `transitions` records land together
     * or not at all, so until then the engine throws by name rather than
     * walking through a teleporter as if it were floor.
     */
    const PENDING = ['transition-west-return'];
    const modelled = names.filter((n) => !PENDING.includes(n));
    /** The v1 five: `noclip: true`, and the regression net for the refactor. */
    const noclipTapes = names.filter((n) => loadTape(n).noclip);

    it('has fixtures on disk', () => {
        // Positive control: every "each fixture matches" assertion below is
        // vacuous if the roster is empty.
        expect(names.length).toBeGreaterThanOrEqual(6);
        expect(modelled.length).toBeGreaterThanOrEqual(6);
        expect(noclipTapes.length).toBeGreaterThanOrEqual(5);
    });

    it.each(modelled)("%s: JS stream matches the real game recording, exactly", (name) => {
        // Everything runs with the real level geometry here, the v1 tapes
        // included — which for them is a second claim on top of the first:
        // the stateful `getState` has to agree with the game over 220 ticks
        // of real routes, not merely over the collision tape. Noclip does
        // NOT bypass terrain typing in the game either, so if any of those
        // routes crossed terrain the resolver got wrong, the recorded
        // speeds would say so.
        const { stream: expected } = loadExpectation(name);
        const actual = runTapeToStream(loadTape(name), { levelSource });
        expect(diffObservationStreams(expected, actual)).toBeNull();
    });

    it.each(noclipTapes)('%s: byte-identical on the v1 engine too', (name) => {
        // THE REGRESSION PIN for slice 2. The v1 engine is the same
        // `step()` with the collision arm of the ternary unselected and the
        // terrain stubbed to ground, so these five must still produce the
        // streams they produced before the sweeps were re-armed — measured
        // against the recordings, not against a snapshot of ourselves.
        const { stream: expected } = loadExpectation(name);
        expect(diffObservationStreams(expected, runTapeToStream(loadTape(name))))
            .toBeNull();
    });

    // Retires itself at slice 3: the list empties and the guard below goes
    // red rather than the block silently passing by running nothing.
    it.each(PENDING)('%s: recorded from the game, awaiting slice 3', (name) => {
        expect(loadExpectation(name).provisional).toBe(false);
        expect(() => runTapeToStream(loadTape(name), { levelSource }))
            .toThrow(TransitionNotModelledError);
    });

    it('the pending split is real, not an artefact of an empty roster', () => {
        // Without this, deleting every collision tape would make the block
        // above pass by running nothing at all.
        expect(PENDING.every((n) => names.includes(n))).toBe(true);
        expect(PENDING).toEqual(['transition-west-return']);
        expect(modelled).toContain('collide-up-rock');
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

    it('collide-up-rock: the engine holds VELOCITY into the wall it is pinned against', () => {
        // The one thing the observation stream cannot carry: the game does
        // not expose `v`, so "the position pinned" and "the velocity was
        // zeroed" look identical in the recording for 38 ticks and only
        // diverge at the delayed creep. Asserting it on `final`'s internal
        // state says outright what the recording only implies — and it is
        // asserted at a tick where the player has been motionless for a
        // while, so nothing else could be holding it there.
        let pinned = null;
        const { ticks, final } = runTape(loadTape('collide-up-rock'), {
            levelSource,
            onTick: (t, s) => { if (t === 30) pinned = s; },
        });
        expect(ticks[25].y).toBe(130.5);
        expect(ticks[30].y).toBe(130.5);       // motionless for 25 ticks...
        expect(pinned.vy).toBeLessThan(-0.5);  // ...and still driving into it
        // The terrain under it is BRICK (t = 3), not Ground: level 0's
        // spawn column is tileset column 4. Worth pinning precisely because
        // it is not what the v1 stub said and the stream cannot tell —
        // brick and ground both walk at 0.8, so the recording is satisfied
        // either way and only the resolver's own answer distinguishes them.
        expect(final.terrain).toBe(3);
        expect(MOVE_SPEEDS[3]).toBe(MOVE_SPEEDS[0]);
    });
});

/**
 * What the v2 slice-0 recordings PROVE about the real game.
 *
 * These read the oracle recordings directly rather than running an engine.
 * That was a necessity at slice 0 — the engine that reproduces them did not
 * exist yet, which is the whole point of recording first — and it is worth
 * keeping now that `collide-up-rock` reconciles: the exact-match test says
 * "the two streams are equal" and nothing about WHAT is equal, so if a
 * later slice moved both the engine and its recording together, only these
 * would notice. Each assertion is either a target a slice had to hit or a
 * fact the v2 brief could only predict from reading the AS3.
 */
describe('v2 slice 0: what the collision + transition recordings pin', () => {
    const recording = (name) => loadExpectation(name).stream;

    it('collide-up-rock: the sweep stops the player DEAD at a solid entity', () => {
        const { ticks } = recording('collide-up-rock');
        // Noclip would have walked straight through the BreakableRock at
        // oel (80,112) and off the top of the level. Collision is real.
        expect(Math.min(...ticks.map((o) => o.y))).toBe(130.05);
        expect(ticks.every((o) => o.level === 0)).toBe(true);
    });

    it('collide-up-rock: the stop lands MID-PIXEL, on the sub-pixel sweep step', () => {
        // 130.5, not 130. The mover walks `d = min(1,|rel|)*sign` steps and
        // stops at the last free one, so the resting position is wherever
        // the fractional approach left it — a model that resolved collision
        // to a tile edge or an integer would be wrong here by half a pixel.
        const { ticks } = recording('collide-up-rock');
        expect(ticks[5].y).toBe(130.5);
        expect(ticks[6].y).toBe(130.5);
    });

    it('collide-up-rock: X never moves, so any x drift in a stream is a defect', () => {
        expect(recording('collide-up-rock').ticks.every((o) => o.x === 88)).toBe(true);
    });

    it('collide-up-rock: collision does NOT zero velocity — the proof is a delayed creep', () => {
        // Mobile.as:39-40 discards the collided entity and returns; it never
        // touches `v`. So the into-wall velocity survives, decaying only
        // through friction(), and the player sits pinned at 130.5 while
        // |v.y| > 0.5 — then slips the last 0.45 px the moment friction
        // brings the step small enough to fit. UP is released at tick 40
        // (span [0,40)) and the creep lands at tick 44: four ticks at
        // DEFAULT_FRICTION 0.25 take |v.y| from the limit cycle's ~1.45
        // down to 0.45. An engine that zeroed velocity on contact would
        // hold 130.5 to the end of the tape.
        const { ticks } = recording('collide-up-rock');
        expect(ticks[43].y).toBe(130.5);
        expect(ticks[44].y).toBe(130.05);
        expect(ticks[45].y).toBe(130.05);
    });

    it('transition-west-return: the tape crosses levels and comes back', () => {
        const { ticks } = recording('transition-west-return');
        const changes = ticks
            .map((o, i) => (i > 0 && o.level !== ticks[i - 1].level
                ? { t: i, from_level: ticks[i - 1].level, to_level: o.level } : null))
            .filter(Boolean);
        expect(changes).toEqual([
            { t: 61, from_level: 0, to_level: 94 },
            { t: 109, from_level: 94, to_level: 0 },
        ]);
    });

    it('transition-west-return: arrival is exactly (playerx+8, playery+8)', () => {
        // Game.as:2040 constructs `new Player(playerx, playery)` and the
        // Player ctor re-centres onto the tile (Player.as:357). Both
        // teleporters' oel attrs predict these outright: level 0's (0,128)
        // carries {playerx:288, playery:160}, level 94's (304,160) carries
        // {playerx:16, playery:128}.
        const { ticks } = recording('transition-west-return');
        expect(ticks[61]).toEqual({ t: 61, x: 296, y: 168, level: 94 });
        expect(ticks[109]).toEqual({ t: 109, x: 24, y: 136, level: 0 });
    });

    it('transition-west-return: the arriving Player is FRESH — velocity is reset', () => {
        // First post-arrival tick moves exactly one accel quantum (0.8),
        // i.e. the limit cycle restarts from v=0. The old player carried
        // roughly -1.4 into the swap; had that survived, the first step
        // would be far larger. Asserted as absolute positions, not as a
        // delta: subtracting two ~300 doubles reintroduces float noise the
        // recorded values do not have.
        const { ticks } = recording('transition-west-return');
        expect(ticks[62].x).toBe(295.2);   // 296 - 0.8, one accel from rest
        expect(ticks[110].x).toBe(24.8);   // 24 + 0.8, likewise
    });

    it('transition-west-return: HELD KEYS survive the world swap', () => {
        // LEFT spans [0,72) and the crossing is at 61, so the hold has to
        // carry into level 94 and keep driving the fresh player left.
        // FlashPunk's Input is static, its listeners live on FP.stage, and
        // no teleport path calls Input.clear() — this is that, observed.
        const { ticks } = recording('transition-west-return');
        expect(ticks[65].x).toBeLessThan(ticks[61].x);
    });

    it('transition-west-return: no intermediate observation on the crossing tick', () => {
        // The trigger fires from the PREVIOUS tick's position (teleporters
        // update before the player, World.addUpdate prepends), the player
        // still completes that tick's movement in the old level, and the
        // swap lands at end-of-tick — but the ~19 blackCover frames that
        // follow are dead frames, so the next LIVE observation is already
        // the arrival. The old player's final position is never observed
        // and never feeds the new one, so the v2 engine may model that last
        // doomed step or skip it: the stream cannot tell.
        const { ticks } = recording('transition-west-return');
        expect(ticks[60]).toEqual({ t: 60, x: 17.70000000000001, y: 136, level: 0 });
        expect(ticks[61].level).toBe(94);
    });

    it('transition-west-return: the anti-ping-pong latch never engages', () => {
        // Each arrival is clear of the return teleporter's hitbox (level 94
        // arrives at x=296, its return pair spans [304,320)), so neither
        // crossing re-fires. Two changes, not four.
        const { ticks } = recording('transition-west-return');
        const changes = ticks.filter((o, i) => i > 0 && o.level !== ticks[i - 1].level);
        expect(changes).toHaveLength(2);
    });

    it('both recordings carry an EMPTY transitions array — Bot.as hardcodes it', () => {
        // Load-bearing for slice 3. `botDrain` returns `transitions: []`
        // unconditionally, so the game does not hand the field over and
        // re-recording will not populate it. The v2 ruling defines an entry
        // as "the first observation tick whose level is the new level",
        // which is a pure function of the tick stream — so the harness
        // derives the game's side from the ticks it already has, and the
        // zero-AS3-edit expectation survives. Keep the JS engine deriving
        // ITS side from its own world swap, or the comparison degenerates
        // into diffing the tick stream against itself.
        expect(recording('collide-up-rock').transitions).toEqual([]);
        expect(recording('transition-west-return').transitions).toEqual([]);
    });
});
