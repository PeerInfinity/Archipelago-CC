/**
 * swimSoundClock — the JS half of the frame-clocked sound PIN.
 *
 * ⚠ These are HAND-DERIVED cases, not a mutation table over one derivation:
 * every expected number here is read off `Player.as:530`, `Sfx.as:38-96`
 * and `Main.as:27` rather than produced by the module under test. The
 * module's OTHER stratum is the live game — `botStatus.sound_pin` reports
 * the length the game measured and the swim probe's cross-rate pair is the
 * behavioural witness — so this file is deliberately arithmetic only.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { createLevelRun } from './levelRun.js';

import { buildLevelWorld, ROLES } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { step, PhysicsV2Error } from './playerPhysicsV2.js';

import { PIN_FRAME_RATE, PIN_NAMES, heldKeysAt } from './tapeFormat.js';
import {
    boostedFramesPerPlay,
    channelPlaying,
    channelPosition,
    createPinnedChannel,
    playChannel,
    stepChannel,
    stopChannel,
    swimBonusSeries,
    swimSpeedBonus,
    SWIM_BOOST_BELOW_SECONDS,
    SWIM_BOOST_SPEED,
    SWIM_LENGTH_FRAMES,
    LOAD_DEAD_FRAMES,
} from './swimSoundClock.js';

describe('the constants are the AS3 ones', () => {
    it('the frame rate is Main.FPS, not the SWF default', () => {
        // `-default-frame-rate=30` is the stage default `Engine`'s
        // constructor overwrites with `FP.assignedFrameRate = FPS` (60).
        // Taking 30 would halve every position and turn six boosted ticks
        // into three.
        expect(PIN_FRAME_RATE).toBe(60);
    });

    it('the threshold and the addend are Player.as:530', () => {
        expect(SWIM_BOOST_BELOW_SECONDS).toBe(0.1);
        expect(SWIM_BOOST_SPEED).toBe(0.25);
    });

    it('the pin names are the two the AS3 parser accepts', () => {
        expect([...PIN_NAMES]).toEqual(['sound', 'dead_frames']);
    });
});

describe('a pinned channel refuses to exist without a length', () => {
    it('throws rather than defaulting — the fallback is the failure', () => {
        // A zero-length pinned channel completes on its first step and
        // replays every frame: a boost on EVERY swimming tick, which is not
        // an execution the vanilla game can produce. The AS3 side faults and
        // disarms on the same condition; neither side guesses.
        expect(() => createPinnedChannel(0)).toThrow(/positive integer/);
        expect(() => createPinnedChannel(-1)).toThrow(/positive integer/);
        expect(() => createPinnedChannel(1.5)).toThrow(/positive integer/);
        expect(() => createPinnedChannel(undefined)).toThrow(/positive integer/);
    });
});

describe('the channel is Sfx, transcribed', () => {
    it('play opens at position 0', () => {
        const ch = playChannel(createPinnedChannel(10));
        expect(channelPlaying(ch)).toBe(true);
        expect(channelPosition(ch)).toBe(0);
    });

    it('a step advances an OPEN channel and does nothing to a closed one', () => {
        const ch = createPinnedChannel(10);
        stepChannel(ch, 5);
        expect(ch.frames).toBe(0);
        playChannel(ch);
        stepChannel(ch, 3);
        expect(ch.frames).toBe(3);
        expect(channelPosition(ch)).toBeCloseTo(3 / 60, 12);
    });

    it('completion closes AND zeroes — a finished sound reads 0, not its end', () => {
        // `Sfx.onComplete` nulls `_channel` and sets `_position = 0`, so
        // `position` (which falls back to `_position`) reports zero. A model
        // that left the position at the length would report `0.166 s` for a
        // 10-frame sound and never boost again.
        const ch = playChannel(createPinnedChannel(10));
        stepChannel(ch, 9);
        expect(channelPlaying(ch)).toBe(true);
        expect(ch.frames).toBe(9);
        stepChannel(ch);
        expect(channelPlaying(ch)).toBe(false);
        expect(ch.frames).toBe(0);
    });

    it('stop closes but KEEPS the position — Sfx.stop is not onComplete', () => {
        // `Sfx.stop` writes `_position = _channel.position`. The two paths
        // differ and conflating them would make a stopped sound boost.
        const ch = playChannel(createPinnedChannel(50));
        stepChannel(ch, 20);
        stopChannel(ch);
        expect(channelPlaying(ch)).toBe(false);
        expect(ch.frames).toBe(20);
        expect(swimSpeedBonus(ch)).toBe(0);
    });

    it('a step count must be a non-negative integer', () => {
        const ch = playChannel(createPinnedChannel(10));
        expect(() => stepChannel(ch, -1)).toThrow(/non-negative integer/);
        expect(() => stepChannel(ch, 1.5)).toThrow(/non-negative integer/);
        expect(() => stepChannel(ch, 0)).not.toThrow();
    });
});

describe('the boost window', () => {
    it('is SIX frames at 60 fps, and the sixth is the exclusive edge', () => {
        // 0/60 … 5/60 are under 0.1 s; 6/60 is EXACTLY 0.1, and the AS3
        // test is `< 0.1`. Getting the boundary inclusive would buy the
        // walk a seventh boosted tick per play that the game never gives.
        expect(boostedFramesPerPlay(SWIM_LENGTH_FRAMES, 60)).toBe(6);
        expect(5 / 60 < 0.1).toBe(true);
        expect(6 / 60 < 0.1).toBe(false);
    });

    it('a channel shorter than the window boosts for its whole length', () => {
        expect(boostedFramesPerPlay(3, 60)).toBe(3);
    });

    it('is NOT six at another frame rate, which is the whole point', () => {
        // The number the pin fixes. At 30 fps three frames fit under 100 ms;
        // at 120 fps twelve do. The unpinned game's answer was whichever of
        // these the browser happened to produce.
        expect(boostedFramesPerPlay(SWIM_LENGTH_FRAMES, 30)).toBe(3);
        expect(boostedFramesPerPlay(SWIM_LENGTH_FRAMES, 120)).toBe(12);
    });
});

describe('a swim run, in the order the game imposes', () => {
    // Per engine frame: `Bot.update` (top of `Main.update`) steps the pinned
    // mixer, THEN `World.update` reaches `Player.update`, which reads the
    // position and only then replays a finished sound. Any other order moves
    // the first boosted tick.
    it('boosts the first six ticks of a cold swim', () => {
        const series = swimBonusSeries(8);
        expect(series).toEqual([0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0, 0]);
    });

    it('repeats on the sound length, not on the boost window', () => {
        const series = swimBonusSeries(SWIM_LENGTH_FRAMES + 6);
        const boosted = series.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
        // Ticks 0..5, then the replay at tick 47 and 48..52.
        expect(boosted).toEqual([0, 1, 2, 3, 4, 5, 47, 48, 49, 50, 51, 52]);
    });

    it('⛔ a COMPLETED, un-replayed channel reads 0 — so the boost latches ON', () => {
        // Found by writing the opposite expectation and being wrong. It is
        // not an artefact of this model: `Sfx.position` is
        // `(_channel ? _channel.position : _position) / 1000`, and
        // `onComplete` sets `_position = 0`. So a Swim sound that has
        // finished and NOT been replayed reports position ZERO, which is
        // `< 0.1`, which is a boost — indefinitely.
        //
        // `Player.as:531` only replays while `v.length > 0`, so this is the
        // state a swimmer who stops moving ends up in, and the FIRST stroke
        // after any pause is boosted because the read happens before the
        // replay. The consequence for routing: the boost is not "six ticks
        // per 47" for a stop-start swim, and a leg planned as though it were
        // would under-run its target.
        const still = swimBonusSeries(SWIM_LENGTH_FRAMES + 3, { moving: (t) => t === 0 });
        expect(still.slice(0, 6)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25, 0.25]);
        // Ticks 6..46 are the rest of the sound: no boost.
        expect(still.slice(6, SWIM_LENGTH_FRAMES).every((v) => v === 0)).toBe(true);
        // Tick 47 completes it, and every tick from there reads 0.
        expect(still.slice(SWIM_LENGTH_FRAMES)).toEqual([0.25, 0.25, 0.25]);
    });

    it('and a stop-start swimmer is boosted on every restart stroke', () => {
        // The same fact from the routing side: pause past the sound's end,
        // then stroke, and that stroke is boosted — because the position is
        // read before the replay.
        const ch = playChannel(createPinnedChannel(SWIM_LENGTH_FRAMES));
        stepChannel(ch, SWIM_LENGTH_FRAMES);      // completes: closed, frames 0
        expect(channelPlaying(ch)).toBe(false);
        expect(swimSpeedBonus(ch)).toBe(SWIM_BOOST_SPEED);
    });

    it('a caller may hand in a channel that is mid-sound', () => {
        // The window-boundary shape: a swim that crosses a director cut
        // carries its channel across rather than restarting it.
        const ch = playChannel(createPinnedChannel(SWIM_LENGTH_FRAMES));
        stepChannel(ch, 40);
        const series = swimBonusSeries(10, { channel: ch });
        // Steps 41..46 are silent; the completion lands on the 7th tick of
        // this run and the replay boosts from there.
        expect(series).toEqual([0, 0, 0, 0, 0, 0, 0.25, 0.25, 0.25, 0.25]);
    });
});

// ── R5 slice 4: THE TERM, WIRED INTO THE PHYSICS ──────────────────────

describe('the swim burst as `playerPhysicsV2.step` consumes it', () => {
    /** A one-tile water world, hand-built so the test owns every input. */
    const waterWorld = () => {
        const level = buildLevelWorld(atlasLevelSource()(60), { roles: ROLES });
        return level;
    };

    it('⛔ REFUSES a wet tick on a tape that does not pin "sound"', () => {
        // The vacuity this closes: unpinned, the term reads the Web Audio
        // mixer's WALL CLOCK, and slice 2 measured one tape's streams
        // parting four ticks after the water edge between a 0.4 fps and a
        // 10.1 fps run. A model that used 0 there would agree with whichever
        // recording it was compared against and disagree with the next.
        const level = waterWorld();
        // L60 row 5 columns 2-7 are Water; (112,88) is column 7's east edge,
        // so step west into it with the hazard ARMED.
        const state = {
            x: 104, y: 88, vx: 0, vy: 0, terrain: 0,
            hazard: { onIce: false, onWaterfall: false, inWater: false, inLava: false },
        };
        expect(() => step(state, new Set(['left']), { level, noHazards: [], pins: [] }))
            .toThrow(PhysicsV2Error);
        expect(() => step(state, new Set(['left']), { level, noHazards: [], pins: [] }))
            .toThrow(/does not pin "sound"/);
    });

    it('and does NOT refuse when the hazard is coerced away', () => {
        // Every fixture below R5 slice 4 coerces water, so this branch is
        // dead for all of them — which is what makes the throw safe to add.
        const level = waterWorld();
        const state = {
            x: 104, y: 88, vx: 0, vy: 0, terrain: 0,
            hazard: { onIce: false, onWaterfall: false, inWater: false, inLava: false },
        };
        expect(() => step(state, new Set(['left']),
            { level, noHazards: ['water', 'waterfall'], pins: [] })).not.toThrow();
    });

    it('⛔ the boost LATCHES once the channel completes un-replayed', () => {
        // §14.3, as arithmetic rather than as prose: `onComplete` zeroes the
        // position, `soundPosition` divides by 1000, and 0 < 0.1. So a
        // swimmer who stops moving is boosted indefinitely — the swim boost
        // is NOT "six ticks in every 47" for a stop-start swim, and a leg
        // priced that way under-runs its target.
        const ch = createPinnedChannel(SWIM_LENGTH_FRAMES);
        playChannel(ch);
        for (let i = 0; i < SWIM_LENGTH_FRAMES; i += 1) stepChannel(ch);
        expect(channelPlaying(ch)).toBe(false);
        expect(channelPosition(ch)).toBe(0);
        expect(swimSpeedBonus(ch)).toBe(SWIM_BOOST_SPEED);
        // ...and it stays that way, because a closed channel does not step.
        stepChannel(ch, 500);
        expect(swimSpeedBonus(ch)).toBe(SWIM_BOOST_SPEED);
    });

    it('a moving swimmer gets the boost in bursts, a stopped one gets it always', () => {
        // The two regimes side by side. Six of every 47 while stroking;
        // every tick once the channel has run down and nothing replays it.
        const moving = swimBonusSeries(120, { moving: () => true });
        const boostedWhileMoving = moving.filter((b) => b > 0).length;
        // Derived tick by tick rather than from a closed form, because the
        // COMPLETION tick is also the first boosted tick of the next play:
        // `stepChannel` closes the channel and zeroes `frames`, the read
        // sees position 0, and only THEN does the replay run. So the cycles
        // start at t = 0, 47 and 94 — three of them inside 120 ticks — and
        // each contributes `boostedFramesPerPlay()`.
        const cycleStarts = [];
        for (let t = 0; t < 120; t += SWIM_LENGTH_FRAMES) cycleStarts.push(t);
        expect(cycleStarts).toEqual([0, 47, 94]);
        expect(boostedWhileMoving).toBe(boostedFramesPerPlay() * cycleStarts.length);
        expect(boostedWhileMoving).toBe(18);
        const stopped = swimBonusSeries(120, { moving: (t) => t < 1 });
        expect(stopped.filter((b) => b > 0).length).toBeGreaterThan(boostedWhileMoving * 2);
    });
});

describe('⛔⛔ the frames the MIXER steps on and the TAPE does not (R5 slice 5)', () => {
    it('a room load is TWENTY dead frames, by simulating the decay in doubles', () => {
        // `Game.blackCover` starts at 1, `blackCoverRate` is -0.05, and
        // `Game.update` skips `super.update()` while it is > 0. Simulated
        // rather than divided for `animCallbackTick`'s reason: 1 - 20*0.05
        // lands at -3.19e-16 in doubles, so the twentieth frame is the last
        // dead one and the twenty-first runs. A closed form that said
        // `1 / 0.05` would say twenty too — and would say it for the wrong
        // reason on any rate whose reciprocal is not exact.
        let cover = 1;
        let dead = 0;
        while (!(cover <= 0)) { dead += 1; cover = Math.min(cover - 0.05, 1); }
        expect(dead).toBe(LOAD_DEAD_FRAMES);
        expect(cover).toBeLessThanOrEqual(0);
    });

    it('⛓ and the swim channel CROSSES A DOOR, plus that door\'s dead frames', () => {
        // The finding the feather walk's first recording paid for. The
        // channel is a `Music` STATIC — `Bot.update` steps it above the
        // armed check and above the dead-frame gate, "because a mixer does
        // not stop because the room is fading" — while `arriveIn` builds a
        // whole new `Player`. A model that let the arrival drop it was
        // 0.25 px out eight ticks after the last door, which is
        // `SWIM_BOOST_SPEED` exactly.
        const tape = loadTape('r5-feather');
        const run = createLevelRun({
            levelSource: atlasLevelSource(), boot: tape.boot, noclip: tape.noclip,
            noHazards: tape.noHazards ?? [], noDamage: tape.noDamage ?? false,
            grants: tape.grants ?? [], persistence: tape.persistence ?? [],
            equips: tape.equips ?? [], pins: tape.pins ?? [],
        });
        let before = null;
        let after = null;
        for (let t = 0; t < tape.tick_count; t += 1) {
            const swimBefore = run.state.swim ? { ...run.state.swim } : null;
            const { transition } = run.advance(heldKeysAt(tape, t));
            // The LAST door — the only one this walk crosses with the
            // channel open, which is why it is the only one that could
            // measure anything. (The first two are crossed with the channel
            // long since closed, and a closed channel does not step in
            // either the game or the model.)
            if (transition && swimBefore && swimBefore.open) {
                before = swimBefore;
                after = { ...run.state.swim };
            }
        }
        expect(before, 'no door was crossed with an open channel').not.toBeNull();
        // One step for the transition tick's own frame, then the load's
        // twenty. The channel is 47 frames long and wraps, so the
        // comparison is modular.
        const expected = (before.frames + 1 + LOAD_DEAD_FRAMES) % SWIM_LENGTH_FRAMES;
        expect(after.frames).toBe(expected);
        expect(after.open).toBe(true);
    });
});
