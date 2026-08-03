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
 * `collide-up-rock` was reconciled at slice 2 and `transition-west-return`
 * at slice 3, so the pending list is gone and every fixture now carries the
 * ordinary exact-match assertion. What both of them PIN about the real game
 * is asserted directly against the recordings at the bottom of this file,
 * which stays worth having: it says what each fixture was for in values, so
 * a later refactor that moves the whole stream in step cannot quietly take
 * the meaning with it.
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
import { MODEL_EXEMPT_NAMES } from './r5Chain.js';
import { atlasLevelSource } from './levelSource.js';
import { MOVE_SPEEDS, spawnFromBoot } from './playerPhysicsV1.js';
import { deriveTransitions, diffObservationStreams } from './tapeFormat.js';
import { createTapeStepper, runTape, runTapeToStream } from './tapeRunner.js';

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

    it('carries the level on every observation', () => {
        const { ticks } = runTape(tape([{ key: 'right', from: 0, to: 3 }]));
        expect(ticks.every((o) => o.level === 0)).toBe(true);
    });

    it('REFUSES a boot the baked-in build cannot take', () => {
        // This test used to boot into level 7 to prove the level field
        // propagates. It cannot any more, and that is the point: the spawn
        // is baked in at Main.as:51 and Bot.as reads neither boot.x nor
        // boot.y, so a tape declaring anything else is honoured here and
        // ignored by the game — the exact asymmetry the format exists to
        // prevent (v2 slice 0's finding, checked from slice 4). Level
        // propagation is covered far better by `transition-west-return`,
        // which crosses for real.
        expect(() => runTape(tape([{ key: 'right', from: 0, to: 3 }],
            { boot: { level: 7, x: 80, y: 128 } })))
            .toThrow(/tape_version 1 tape must declare/);
        expect(() => runTape(tape([{ key: 'right', from: 0, to: 3 }],
            { boot: { level: 0, x: 96, y: 128 } })))
            .toThrow(/tape_version 1 tape must declare/);
    });

    it('emits no transitions for a run that crosses no level', () => {
        expect(runTapeToStream(tape([{ key: 'right', from: 0, to: 3 }])).transitions)
            .toEqual([]);
        expect(runTapeToStream(tape([{ key: 'right', from: 0, to: 3 }]), { levelSource })
            .transitions).toEqual([]);
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
     * THE V1 FIVE, pinned BY NAME because they are a frozen historical set.
     *
     * ⚠ This used to be `names.filter((n) => loadTape(n).noclip)`, which was
     * the same set only while "noclip" and "the v1 rung" meant the same
     * thing. R0's relaxed tapes are noclip too, and the predicate silently
     * swept them into the v1-ENGINE block below — where `grant-sword-room`
     * went red (the v1 engine has no transitions) and the two hazard tapes
     * would have gone GREEN for a reason that proves nothing: the v1 engine
     * stubs terrain to ground, which is exactly what the coerce produces, so
     * it cannot tell a working coerce from a missing one.
     */
    const V1_FIVE = ['diagonal-run', 'direction-flip', 'friction-stop',
        'shuffle-stop', 'straight-run'];

    it('has fixtures on disk, and NONE of them is pending any more', () => {
        // Positive control: every "each fixture matches" assertion below is
        // vacuous if the roster is empty. v2's slice 0 recorded collision and
        // cross-level tapes from the real game before the engine that had to
        // reproduce them existed, and each waited in a PENDING list until its
        // slice landed — slice 2 took `collide-up-rock` off it and slice 3
        // took `transition-west-return`. R1's slice 1 re-opened it for the
        // pit pair, and R1's slice 2 took BOTH of those off it on the run
        // that first reconciled them — 302 observations and 3 transitions,
        // exact on the first try. Every fixture on disk runs the exact-match
        // assertion again.
        expect(names.length).toBeGreaterThanOrEqual(7);
        expect(names).toContain('pit-fall-83');
        expect(names).toContain('pit-fall-chain-85');
        expect(names).toContain('collide-up-rock');
        expect(names).toContain('transition-west-return');
        // The v1 five are all still on disk, and are still the tapes the v1
        // ENGINE can run: single-level, and predating every relaxation.
        for (const n of V1_FIVE) {
            expect(names, `${n} is missing`).toContain(n);
            const t = loadTape(n);
            expect(t.tape_version, `${n} is no longer a v1 tape`).toBe(1);
            expect(t.noclip).toBe(true);
        }
    });

    /**
     * ⛔ THE ONE FIXTURE WHOSE MODEL AND RECORDING MUST DIFFER.
     *
     * `r5-contact-control-on` is R5's POSITIVE CONTROL: the same walk as
     * `r5-contact-control-off` with `noDamage` flipped and nothing else, driven
     * into `sandtrap@96,128`. The JS engine models NO damage at all — that is
     * the whole point — so the game's stream must diverge from it, and the
     * blanket "matches the recording exactly" sweep would be red for the one
     * reason that is evidence rather than a defect.
     *
     * ⚠ PINNED BY NAME, and the exclusion is itself checked: the test below
     * requires each excluded fixture to ACTUALLY diverge, so this list cannot
     * be used to quiet a genuine drift. See
     * `feedback_coincidental_predicate_rots` — a predicate like
     * `!loadTape(n).noDamage` would sweep in every future R5 fixture, all of
     * which are supposed to match.
     */
    /**
     * ⚠ AND THE SECOND ONE, for a DIFFERENT reason worth stating.
     *
     * `r5-l60-kill` is R5's first live kill. Its control arm
     * (`r5-l60-kill-control`) matches the model exactly — the JS engine
     * knows L60's `lock@128,80` is a `Solid` from the blocking role, so the
     * model pins at the lock face just as the game does, and that arm stays
     * in the blanket sweep as an ordinary fixture. The KILL arm cannot: the
     * engine has no combat, so it does not know the lock opens, and it pins
     * where the game walks through. The divergence IS the claim.
     *
     * Two entries, two unrelated causes (a damage the model omits; a lock
     * the model cannot open), which is why this is a list of NAMES rather
     * than a predicate. A predicate over "has enemies" or "has presses"
     * would sweep in every kill fixture after this one, including the ones
     * that are supposed to match.
     */
    /**
     * ⚠ AND THE THIRD REASON, which is a whole CLASS rather than a case.
     *
     * The three `r5-bobboss-*` fixtures are an ENCOUNTER SCRIPT — 230 lines
     * of scripted state the engine does not model and is not going to:
     * `FallRockLarge` freezes the game for 174 frames and writes the
     * player's respawn point, three forms carry their own hit counts, two
     * 120-frame transitions TELEPORT the player, and the reward is spawned
     * at runtime so it is in no level's pickup list. The model walks freely
     * through all of it, so all three streams diverge — including the
     * CONTROL arm, whose sword is withheld but whose rock still falls.
     *
     * Each one's exemption is declared in `r5Chain.MODEL_EXEMPT` with the
     * items it earns and whether it is taken over, and the differential
     * harness asserts the game against `mirror + earned` rather than
     * excusing it. This list is only about the STREAM.
     */
    const EXPECTED_TO_DIVERGE = ['r5-contact-control-on', 'r5-l60-kill',
        ...MODEL_EXEMPT_NAMES];

    it.each(names.filter((n) => !EXPECTED_TO_DIVERGE.includes(n)))(
        "%s: JS stream matches the real game recording, exactly", (name) => {
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

    it.each(EXPECTED_TO_DIVERGE)('%s: DIVERGES from the model, which is the claim', (name) => {
        // The exclusion above is only honest if the excluded fixture really
        // does diverge — otherwise it is a way to hide a drift. And the
        // divergence has to be the RIGHT one, so its shape is asserted in
        // `contactControl.test.js` against its own paired control arm.
        const { stream: expected } = loadExpectation(name);
        const actual = runTapeToStream(loadTape(name), { levelSource });
        expect(diffObservationStreams(expected, actual)).not.toBeNull();
    });

    it.each(V1_FIVE)('%s: byte-identical on the v1 engine too', (name) => {
        // THE REGRESSION PIN for slice 2. The v1 engine is the same
        // `step()` with the collision arm of the ternary unselected and the
        // terrain stubbed to ground, so these five must still produce the
        // streams they produced before the sweeps were re-armed — measured
        // against the recordings, not against a snapshot of ourselves.
        const { stream: expected } = loadExpectation(name);
        expect(diffObservationStreams(expected, runTapeToStream(loadTape(name))))
            .toBeNull();
    });

    it('transition-west-return: the engine derives BOTH crossings itself', () => {
        // The exact-match test above compares transitions element-wise, but
        // it would be satisfied by an engine that emitted the array from the
        // recording's own level field. These are the values, stated once,
        // against a run: the entries come from `tapeRunner`'s world swap and
        // the recorded ones from the game's level changes, and they are the
        // same two crossings.
        const { transitions } = runTapeToStream(loadTape('transition-west-return'),
            { levelSource });
        expect(transitions).toEqual([
            { t: 61, from_level: 0, to_level: 94 },
            { t: 109, from_level: 94, to_level: 0 },
        ]);
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

    it('the recorded transitions are the DERIVED ones, written at record time', () => {
        // `Bot.as`'s `botDrain` returns `transitions: []` unconditionally —
        // the game does not hand the field over and re-recording will never
        // populate it. The v2 ruling defines an entry as "the first
        // observation tick whose level is the new level", which is a pure
        // function of the tick stream, so the harness derives the game's
        // side with `deriveTransitions` and writes it into the expectation
        // at RECORD time (rather than conjuring it on both sides of every
        // comparison), which is what makes the file below readable and
        // diffable. This asserts the committed file really is that
        // derivation and not something hand-edited into place.
        const s = recording('transition-west-return');
        expect(s.transitions).toEqual([
            { t: 61, from_level: 0, to_level: 94 },
            { t: 109, from_level: 94, to_level: 0 },
        ]);
        expect(s.transitions).toEqual(deriveTransitions(s.ticks));
        // A tape that crosses nothing still records the empty array.
        expect(recording('collide-up-rock').transitions).toEqual([]);
    });
});

/**
 * R0: what `runTape` owes a version 2 tape.
 *
 * The engine reads the three relaxation fields off the PARSED tape, which
 * `parseTape` normalises for either version — so there is no version branch
 * in the runner and no place for a v1 tape to acquire v2 behaviour.
 */
describe('version 2 tapes', () => {
    const v2 = (inputs, extra = {}) => tape(inputs, {
        tape_version: 2, noDamage: true, noHazards: [], grants: [], ...extra,
    });

    it('carries the relaxations through to the engine', () => {
        const out = runTape(v2([{ key: 'right', from: 0, to: 3 }]), { levelSource });
        expect(out.inventory).toBeTruthy();
        expect(out.inventory.hitsMax).toBe(3);
        expect(out.grants).toEqual([]);
    });

    it('applies a boot-level grant and reports it at tick 0', () => {
        const out = runTape(
            v2([{ key: 'right', from: 0, to: 3 }], { grants: [{ level: 0, items: ['sword'] }] }),
            { levelSource },
        );
        expect(out.grants).toEqual([{ t: 0, level: 0, items: ['sword'] }]);
        expect(out.inventory.hasSword).toBe(true);
    });

    it('FAILS by name on a grant for a level the run never entered', () => {
        // A grant that never fires is a route claim that silently stopped
        // being true. It moves no pixel, so the stream still matches its
        // oracle and every downstream assertion passes — which is exactly
        // how a routing regression would hide behind a green tape.
        expect(() => runTape(
            v2([{ key: 'right', from: 0, to: 3 }], { grants: [{ level: 42, items: ['wand'] }] }),
            { levelSource },
        )).toThrow(/grants items in level\(s\) 42, which the run never entered/);
    });

    it('refuses grants on the v1 engine rather than dropping them', () => {
        // Without a levelSource there is no level tracking at all, so the
        // runner could not tell when a granted level was entered. Silently
        // ignoring them would make a v2 tape mean two different things.
        expect(() => runTape(
            v2([{ key: 'right', from: 0, to: 3 }], { grants: [{ level: 0, items: ['sword'] }] }),
        )).toThrow(/declares grants but no opts.levelSource/);
    });

    it('walks water when the tape disables it, and dies loudly when it does not', () => {
        // Level 0's row 8 going right hits Water at column 9 (a v2-slice-0
        // fixture-authoring note). Same tape, same geometry, two tapes:
        // this is the whole of `noHazards` seen from the runner.
        const walkIntoWater = (extra) => runTapeToStream(
            v2([{ key: 'right', from: 0, to: 60 }], extra), { levelSource },
        );
        expect(() => walkIntoWater({ noHazards: [] })).toThrow(/Water/);
        expect(() => walkIntoWater({ noHazards: ['lava', 'ice'] })).toThrow(/Water/);
        const out = walkIntoWater({ noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'] });
        expect(out.ticks).toHaveLength(61);
    });
});


describe('the incremental stepping face (watch page)', () => {
    // ⚠ THE PIN THE WATCH PAGE EXISTS BEHIND. The viewer needs to advance a
    // tape one tick at a time, and the temptation is a second little loop in
    // the viewer. That is the verifier-shared-assumption trap in tooling
    // clothes: two copies agree until one is edited, and the one nobody
    // tests is the one that drifts. So `runTape` DRIVES the stepper rather
    // than duplicating it, and these cases prove the two faces are one.
    const names = fixtureNames();

    it.each(names)('%s: stepping to completion == runTape, byte for byte', (name) => {
        const tape = loadTape(name);
        const whole = runTape(tape, { levelSource });
        const stepper = createTapeStepper(tape, { levelSource });
        const seen = [];
        let r = stepper.next();
        while (!r.done) { seen.push(r.value.observation); r = stepper.next(); }
        // The observations the viewer would have drawn, one per next().
        expect(seen).toEqual(whole.ticks);
        // And the generator's RETURN value is runTape's whole result — which
        // is the mechanism, not a coincidence.
        expect(r.value.ticks).toEqual(whole.ticks);
        expect(r.value.transitions).toEqual(whole.transitions);
        expect(r.value.transports).toEqual(whole.transports);
        expect(r.value.lockSnaps).toEqual(whole.lockSnaps);
        expect(r.value.collected).toEqual(whole.collected);
        expect(r.value.grants).toEqual(whole.grants);
        expect(r.value.inventory).toEqual(whole.inventory);
        expect(r.value.final).toEqual(whole.final);
    });

    it('yields tick_count + 1 times, ending on the disarm tick', () => {
        const stepper = createTapeStepper(loadTape('straight-run'), { levelSource });
        let n = 0;
        let last = null;
        for (let r = stepper.next(); !r.done; r = stepper.next()) { n += 1; last = r.value; }
        expect(n).toBe(loadTape('straight-run').tick_count + 1);
        expect(last.last).toBe(true);
    });

    it('hands the viewer the state and geometry the STREAM cannot carry', () => {
        // The reason the viewer steps at all rather than replaying a
        // recording: velocity, the sticky terrain state, the latch and the
        // pit-transport phase are model state the observation stream does
        // not carry, and they are exactly what makes a route debuggable.
        const stepper = createTapeStepper(loadTape('pit-fall-chain-85'), { levelSource });
        let sawFall = false;
        let sawWorld = false;
        for (let r = stepper.next(); !r.done; r = stepper.next()) {
            if (r.value.state.fall) sawFall = true;
            if (r.value.world && r.value.world.level === 85) sawWorld = true;
            expect(typeof r.value.state.vx).toBe('number');
        }
        expect(sawFall, 'the transport phase is visible mid-fall').toBe(true);
        expect(sawWorld, 'the world follows the run across a swap').toBe(true);
    });

    it('validates EAGERLY, when the stepper is made rather than advanced', () => {
        // A caller holding a stepper should already know the tape can run.
        expect(() => createTapeStepper(tape([{ key: 'right', from: 0, to: 3 }],
            { noclip: false }))).toThrow(/no opts.levelSource/);
        expect(() => createTapeStepper(tape([{ key: 'jump', from: 0, to: 3 }])))
            .toThrow(/not a known key name/);
    });
});
