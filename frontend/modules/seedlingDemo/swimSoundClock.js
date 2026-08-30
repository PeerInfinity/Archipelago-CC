/**
 * swimSoundClock — the JS half of the R5 FRAME-CLOCKED SOUND PIN.
 *
 * ── The term this exists for ──────────────────────────────────────────
 * `Player.as:530`, inside the `inWater || inLava` arm:
 *
 *     moveSpeed = moveSpeeds[state] + 0.25 * int(Music.soundPosition("Swim") < 0.1);
 *     if (v.length > 0 && !Music.soundIsPlaying("Swim")) Music.playSound("Swim");
 *
 * `soundPosition` bottoms out at `Sfx.position` → `SoundChannel.position`,
 * the live Web Audio mixer clock, in REAL MILLISECONDS. So vanilla decides
 * how many TICKS get the +0.25 swim boost by comparing a wall-clock reading
 * against a frame count, and the answer depends on the frame rate the
 * browser happened to achieve. R5 slice 2 measured it: the identical tape at
 * 0.4 fps (SwiftShader) and 10.1 fps (real-GPU Windows) DIVERGED at tick 52,
 * four ticks after the water edge, with the SLOW run ahead — because at 2.5 s
 * per tick the 100 ms window closes inside the first swimming tick, while at
 * 100 ms per tick it spans several.
 *
 * The ruling (kickoff §13.1) took the PIN: under a v5 tape's `pins:
 * ["sound"]` the game reads a FRAME CLOCK instead — one step per engine
 * update from `playSound` — which is the execution a steady 60 fps browser
 * gives it. This module is the same arithmetic on this side, so the two
 * consumers cannot drift.
 *
 * ── The channel model, and why it is the whole channel ────────────────
 * ⚠ Pinning only the POSITION would not have been enough. Once the sound
 * COMPLETES the game replays it and the boost recurs, and vanilla completion
 * is `SOUND_COMPLETE` off the same mixer clock — so a position-only pin
 * leaves the RECURRENCE frame-rate-dependent and the swim inexact past
 * `swim.mp3`'s own length. The pin therefore models the whole `Sfx` life,
 * and so does this:
 *
 *     play    frames = 0, open
 *     step    if open: frames++;  if frames >= lengthFrames: close, frames = 0
 *             (`Sfx.onComplete` nulls the channel AND zeroes `_position`,
 *              so a completed sound reads 0 — not its end)
 *     stop    close, frames KEPT
 *             (`Sfx.stop` writes `_position = _channel.position`)
 *
 * ── ⚠ STEP IS ENGINE FRAMES, NOT TAPE TICKS ───────────────────────────
 * `Music.pinStep` is called from `Bot.update`, which runs at the top of
 * `Main.update` on EVERY engine frame — including the ~20 dead frames of a
 * room fade and any frozen ones, because a mixer does not stop for either.
 * The tape's tick counter skips exactly those frames. So a caller that
 * crosses a room load while a swim sound is open must `step` by the DEAD
 * FRAMES too, and `step(n)` takes a count for that reason. Within a single
 * room — every swim R5 plans — live ticks and engine frames are the same
 * thing and `step()` once per tick is right.
 *
 * ── ⚠ `SWIM_LENGTH_FRAMES` IS A PREDICTION UNTIL THE GAME ANSWERS ─────
 * The AS3 side measures the length at runtime from `Sfx.length`
 * (`Sound.length / 1000`) and reports it as `botStatus.sound_pin`. The
 * constant here is derived independently, by parsing `assets/sound/swim.mp3`
 * itself: 30 MPEG-1 Layer-III frames of 1152 samples at 44.1 kHz = 0.78367 s,
 * ×60 fps = 47.02 → 47. Those are two derivations of one number and the
 * GAME'S is the oracle: the gate asserts the readout against this constant,
 * and a disagreement corrects this file rather than the game (Flash's
 * embedded-MP3 length can carry encoder delay the container does not).
 */

import { PIN_FRAME_RATE } from './tapeFormat.js';

/** `swim.mp3` at `Main.FPS`. A PREDICTION — see the header. */
export const SWIM_LENGTH_FRAMES = 47;

/** `Player.as:530`'s threshold, in SECONDS (`Sfx.position` divides by 1000). */
export const SWIM_BOOST_BELOW_SECONDS = 0.1;

/** `Player.as:530`'s addend. */
export const SWIM_BOOST_SPEED = 0.25;

/**
 * ⛔⛔ THE FRAMES THE MIXER STEPS ON AND THE TAPE DOES NOT — R5 slice 5.
 *
 * `Bot.as:1289-1297` calls `Music.pinStep()` from the TOP of `Bot.update()`,
 * **above the armed check and above the dead-frame gate**, with its own
 * comment saying why: *"the thing being pinned is a mixer, and a mixer does
 * not stop because the tape is between windows or because the room is
 * fading."* So the pinned channel advances on every engine frame, and a
 * model that steps it once per TAPE TICK is behind by every frame the tape
 * did not count.
 *
 * Until slice 5 no fixture could see it: the three swim fixtures all live
 * inside one room and the D5 walk only reaches water on its last tick. The
 * feather walk swims in L87, crosses three doors and swims again in L89 —
 * and the first recording came back 0.25 px apart eight ticks after the
 * last door, which is `SWIM_BOOST_SPEED` exactly.
 *
 *   `LOAD_DEAD_FRAMES`      `Game.blackCover` starts at 1 and
 *                           `blackCoverRate` is -0.05, and `Game.update`
 *                           skips `super.update()` while it is > 0 — so a
 *                           room load is exactly TWENTY frames on which
 *                           nothing moves and the mixer runs. (The BOOT
 *                           fade measures 21; the extra frame is before
 *                           `Bot` arms and cannot matter, because the
 *                           channel does not exist until something swims.)
 *   `CEREMONY_FREEZE_FRAMES` `Pickup.specialTimer` counts down from 150
 *                           under `Game.freezeObjects` — phase A, which the
 *                           model represents as no ticks at all.
 *
 * ⚠ AND PHASE B COUNTS TOO. A dialogue's frames ARE tape ticks, but the
 * model does not run `stepV2` on them ("not stepping is the whole model"),
 * so the channel has to be advanced by hand there as well. Every frame the
 * game renders is a frame the mixer stepped; the model's job is to name the
 * ones its own loop skips.
 */
export const LOAD_DEAD_FRAMES = 20;

/** `Pickup.as:22` — `specialTimerMax`, phase A's whole length. */
export const CEREMONY_FREEZE_FRAMES = 150;

/**
 * A pinned `Sfx` channel.
 *
 * `lengthFrames` is required and must be positive. There is no default and
 * no fallback: a zero-length pinned channel completes on its first step and
 * replays every frame, which is not an execution the vanilla game can
 * produce — the pin would be breaking its own doctrine silently. The AS3
 * side faults and disarms the tape on the same condition (`Music.pinPlayed`
 * → `Bot.pinFault`), so both consumers refuse it rather than one guessing.
 */
export function createPinnedChannel(lengthFrames) {
    if (!Number.isInteger(lengthFrames) || lengthFrames <= 0) {
        throw new Error('createPinnedChannel: lengthFrames must be a positive '
            + `integer, got ${JSON.stringify(lengthFrames)}. A pinned channel with `
            + 'no length completes on its first step and replays every frame, which '
            + 'the vanilla game never does.');
    }
    return { frames: 0, open: false, lengthFrames };
}

/** One engine frame of the pinned mixer. Mutates and returns the channel. */
export function stepChannel(channel, frames = 1) {
    if (!Number.isInteger(frames) || frames < 0) {
        throw new Error(`stepChannel: frames must be a non-negative integer, got ${frames}`);
    }
    for (let i = 0; i < frames; i += 1) {
        if (!channel.open) break;
        channel.frames += 1;
        if (channel.frames >= channel.lengthFrames) {
            channel.open = false;
            channel.frames = 0;
        }
    }
    return channel;
}

/** `Sfx.play` — the channel opens at position 0. */
export function playChannel(channel) {
    channel.frames = 0;
    channel.open = true;
    return channel;
}

/** `Sfx.stop` — the channel closes with its position KEPT. */
export function stopChannel(channel) {
    channel.open = false;
    return channel;
}

/** `Sfx.position`, in SECONDS — the unit `Music.soundPosition` returns. */
export function channelPosition(channel, frameRate = PIN_FRAME_RATE) {
    return channel.frames / frameRate;
}

/** `Sfx.playing`. */
export function channelPlaying(channel) {
    return channel.open;
}

/**
 * `Player.as:530`'s addend for ONE tick, given the channel as the tick's
 * read sees it — i.e. AFTER the frame's `stepChannel` and BEFORE this tick's
 * possible `playChannel`, which is the order `Bot.update` (top of
 * `Main.update`) and `Player.update` (inside `World.update`) impose.
 */
export function swimSpeedBonus(channel, frameRate = PIN_FRAME_RATE) {
    return channelPosition(channel, frameRate) < SWIM_BOOST_BELOW_SECONDS
        ? SWIM_BOOST_SPEED : 0;
}

/**
 * How many consecutive ticks get the boost per play, at a given frame rate.
 *
 * Derived rather than asserted, because it is the number the routing
 * decision actually turns on and "six" is only true for 60 fps: positions
 * 0/60 … 5/60 are under 0.1 s and 6/60 is exactly 0.1, which is not `< 0.1`.
 * A channel shorter than the boost window boosts for its whole length.
 */
export function boostedFramesPerPlay(lengthFrames = SWIM_LENGTH_FRAMES,
    frameRate = PIN_FRAME_RATE) {
    let n = 0;
    for (let f = 0; f < lengthFrames; f += 1) {
        if (f / frameRate < SWIM_BOOST_BELOW_SECONDS) n += 1;
        else break;
    }
    return n;
}

/**
 * The swim boost over a run of `ticks` consecutive SWIMMING ticks, from a
 * cold channel — the shape the R5 swim leg is priced from.
 *
 * The per-tick order is exactly the game's: step the mixer, read the
 * position, then play if nothing is open. Returns the per-tick addends so a
 * caller can fold them into a physics run rather than trusting a total.
 *
 * `moving` says whether the player had velocity that tick, because
 * `Player.as:531`'s replay is gated on `v.length > 0`: a swimmer who stops
 * does not restart the sound, so the channel runs down and the NEXT stroke
 * gets a fresh boost.
 */
export function swimBonusSeries(ticks, {
    lengthFrames = SWIM_LENGTH_FRAMES,
    frameRate = PIN_FRAME_RATE,
    moving = () => true,
    channel = null,
} = {}) {
    const ch = channel ?? createPinnedChannel(lengthFrames);
    const out = [];
    for (let t = 0; t < ticks; t += 1) {
        stepChannel(ch);
        out.push(swimSpeedBonus(ch, frameRate));
        if (moving(t) && !channelPlaying(ch)) playChannel(ch);
    }
    return out;
}
