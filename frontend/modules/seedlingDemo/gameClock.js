/**
 * seedlingDemo/gameClock — `Game.time`, AND THE FRAMES THE TAPE NEVER SEES.
 *
 * R8 slice 8, and it exists because of a USER CORRECTION: *"the hammer spins
 * in a predictable pattern; opportunistic means waiting until the hammer isn't
 * in the way, or standing where it won't be."* Kickoff §16.8 measured both
 * halves of that and this file is the first one.
 *
 * ── ⛓⛓⛓ WHY THIS QUANTITY IS MODELLABLE, AND WHY IT WAS NOT ──────────
 *
 * `Spinner.update`'s hammer is `collideLine("Player", x, y, x + 13·cos a,
 * y + 13·sin a)` with `hammerAngle = (Game.time % 45) / 45 · 2π`
 * (`Spinner.as:70-72`), so the whole of "where is the hammer" is one integer.
 * Until this slice the model refused to answer it, on a reading recorded in
 * `levelRun.assertPlayerClearOfHammers` and in `dangerMap.spinnerDanger`:
 *
 *   *"`Game.time` counts DEAD FRAMES, a per-load variable this run does not
 *   carry, so the ANGLE is not predictable from the run's own clock."*
 *
 * ⛔ **THAT WAS TRUE OF THE MODEL AND FALSE OF THE MECHANISM**, and the
 * distinction is the whole correction. Source-verified in the fork @ `7514b96`:
 *
 * ```
 *   Game.as:846      time += timeRate;         ← in `Game.update()`, BELOW the
 *                                                `if (blackCover <= 0)
 *                                                super.update()` gate but
 *                                                OUTSIDE it ⇒ it advances on
 *                                                DEAD frames too
 *   Game.as:498      public var timeRate:Number = 1
 *   Game.as:918/959  `timeRate` is written in EXACTLY ONE place — inside
 *                    `cutscene[0]`, the opening wind/text scene — and set
 *                    back to 1 when that scene ends
 *   Game.as:490-497  `Game.time` IS `Main.time`, i.e. `SAVE_FILE.data.time`
 *   Game.as:1801-1808 + :836-843   the fade, and the PIN that makes it a
 *                    fixed COUNT rather than a render-rate observation
 * ```
 *
 * ⇒ outside that one cutscene `Game.time` advances by exactly **one per
 * `Game.update()`**, and a run that knows its boot value and counts its own
 * frames — live, frozen, and faded — knows it exactly. The v8 seam has
 * carried the boot value since R7 slice 2b (`SEAM_BOOT_SPEC`'s `time` row);
 * what was missing was the counting.
 *
 * ── ⛔ THE PER-LOAD FADE IS A CONSTANT ONLY UNDER THE PIN ─────────────
 *
 * Vanilla decays `blackCover` from `cover()`, i.e. per RENDER, while the gate
 * that reads it samples per UPDATE — so a room load costs "however many
 * renders fit inside twenty units of decay", which is the ±2 band R5 slice 0
 * measured and `deadFrameBand.FADE_STATS` banks (18..21 across 557 loads).
 * `Bot.pinDeadFrames` moves the decay into `Game.update()` immediately after
 * the gate, and the count collapses to exact. Every tape this clock can serve
 * declares that pin; one that does not gets `null` and the hammer keeps
 * refusing, which is the honest answer rather than a guessed phase.
 *
 * ── ⚠ AND THE COUNT IS SIMULATED, NOT DIVIDED ────────────────────────
 *
 * `1 / 0.05` is 20 and so is the accumulation, and that agreement is a
 * coincidence of this particular rate: `spinner.SPINNER`'s own two fades
 * disagree about exactly this (`1 -= 0.1` ten times is 1.39e-16, still > 0),
 * and a model that divided would be one frame early on one of them and right
 * on the other — the worst kind of wrong, because the case that would catch
 * it passes. So `LOAD_FADE_FRAMES` is run, like `SPINNER.deathTicks` and
 * `burnableTree`'s 41.
 *
 * ⚠ **AND IT HAS A TWIN THAT CANNOT IMPORT IT**, said out loud rather than
 * discovered. `swimSoundClock.LOAD_DEAD_FRAMES` is the same twenty frames,
 * written as a literal since R5 slice 5 for the mixer's benefit — and the
 * obvious repair (make that one read this one) would close a CYCLE:
 * `gameClock -> sealCeremony -> swimSoundClock` and
 * `gameClock -> r7Acceptance -> tapeFormat -> swimSoundClock`. So the two
 * names stay and `gameClock.test.js` asserts them EQUAL by name, which is
 * this file's answer to [[feedback_two_cost_models_must_agree]] when the
 * module graph refuses the single definition: a red on divergence, never a
 * comment saying they agree.
 */

import { BOOT_PRESWAP_FRAMES } from './r7Acceptance.js';

export class GameClockError extends Error {
    constructor(message) { super(message); this.name = 'GameClockError'; }
}
const fail = (m) => { throw new GameClockError(m); };

/**
 * `Game.blackCover` / `blackCoverRate` / `stepBlackCover`, transcribed.
 *
 * ⛓ `blackCoverRate` is written NOWHERE in the game — grepped, not assumed:
 * the only two assignments to either field in the whole source are inside
 * `stepBlackCover` itself. So there is no fade-OUT anywhere on the ladder and
 * a room load is one fade-in from the field's own initialiser.
 */
export const BLACK_COVER = Object.freeze({
    start: 1,
    rate: -0.05,
    /** `if (blackCover <= 0) super.update();` — the gate, read BEFORE the step. */
    gate: 'blackCover <= 0',
    clamp: 'Math.max(blackCover + blackCoverRate, 0)',
    src: 'Game.as:518-519,836-843,1801-1808',
});

/**
 * ⛓⛓ THE DEAD FRAMES ONE ROOM LOAD COSTS UNDER `Bot.pinDeadFrames`, RUN.
 *
 * The loop is `Game.update()`'s own order: the gate reads `blackCover`, and
 * only then does `stepBlackCover()` decay it. So the frame on which the value
 * REACHES zero is still a dead one, and the first live frame is the one after.
 */
export const LOAD_FADE_FRAMES = (() => {
    let cover = BLACK_COVER.start;
    let dead = 0;
    for (let i = 0; i < 1000; i += 1) {
        // `if (blackCover <= 0) super.update();`
        if (cover <= 0) return dead;
        dead += 1;
        // `else if (blackCoverRate < 0 && blackCover > 0)`
        cover = Math.max(cover + BLACK_COVER.rate, 0);
    }
    return fail('LOAD_FADE_FRAMES: `stepBlackCover` did not reach the gate in 1000 frames');
})();

/**
 * ⛔⛔ THE ONE PICKUP THAT COSTS A DEAD FRAME ITS PHASE A DOES NOT.
 *
 * `Sword.removed()` is three lines and the third is
 * `FP.world.add(new Help(3))` (`Pickups/Sword.as:42-49`) — the only pickup on
 * the ladder that spawns one. `Help.update` writes `Game.freezeObjects = true`
 * unconditionally, so the frame AFTER the add is dead; `Bot.autoAdvance()`
 * presses on that frame, `remove` latches, and the same update runs
 * `if (sprHelp.frame != 1) Game.freezeObjects = false` — so the freeze is
 * already down when the next frame's gate samples it.
 *
 * ⇒ **exactly one dead frame**, and the roster measured it twice before this
 * file existed: `r3-collect-sword` is 171 dead against 170 for every other
 * `r3-collect-*` with the same 150-frame phase A
 * (`fixtures/dead-frame-observations.json`), and the `r7-act2-10 -> -11` seam
 * is 151 past its predecessor's clock where every other act2 seam is exact.
 *
 * ⚠ THE OTHER TWO `new Help(...)` SITES ARE OUT OF REACH AND SAID SO:
 * `Inventory.as:174` fires on opening the inventory (no tape does) and
 * `Game.as:961` ends the opening wind cutscene (which no tape boots into —
 * see `TIME_RATE`).
 */
export const PICKUP_HELP_DEAD_FRAMES = Object.freeze({
    /**
     * ⚠ THE COUNTS ARE THEIR OWN MAP, and the prose is beside it rather than
     * in it. A consumer indexes this by a PICKUP TAG; a table that mixed tags
     * with `why`/`src` would answer a string for a pickup called "src", which
     * is a silent wrong answer waiting for a level record to name one.
     */
    frames: Object.freeze({ sword: 1 }),
    why: '`Sword.removed()` adds `Help(3)`; `Help.update` raises the freeze for the one '
        + 'frame it takes `Bot.autoAdvance()` to press through it, and clears it in the '
        + 'same update it latches `remove`',
    src: 'Pickups/Sword.as:48 + NPCs/Help.as:100-121 + Bot.as autoAdvance()',
    /** `Inventory.as:174` and `Game.as:961`, named rather than omitted. */
    unreachable: Object.freeze(['Inventory(0) — no tape opens the inventory',
        'Game(2) — the opening wind cutscene, which no tape boots into']),
});


/**
 * ⛔ `Game.timeRate`, AND ITS ONE EXCEPTION — transcribed, not ignored.
 *
 * The field is 1 at construction and is assigned in exactly one block:
 * `Game.update`'s `if (cutscene[0])` arm walks it down by 0.0025 a frame
 * (`Game.as:918`) and sets it back to 1 when the scene ends (`Game.as:959`).
 * That scene runs only on the `level < 0` boot — the fresh-save wind/text
 * opening — which sets `time = dayLength / 2` on the way in (`Game.as:792`).
 *
 * ⇒ a clock booted with `cutscene[0]` true would have to model a DECAYING
 * rate, and this one does not: it refuses by name. `SEAM_BOOT_SPEC`'s
 * `cutscene` row is `modelled: true`, so the boot always knows the answer.
 */
export const TIME_RATE = Object.freeze({
    value: 1,
    exception: 'cutscene[0] — the opening wind/text scene, where `timeRate` decays by '
        + '0.0025 a frame and is reset to 1 when the scene ends',
    src: 'Game.as:498 (the initialiser), :918 (the decay), :959 (the reset)',
});

/**
 * The `Game.time` a segment's first world sees at `Game.begin()` ENTRY, from
 * the value its tape DECLARES.
 *
 * ⛓ ONE OUTGOING-WORLD FRAME APART, and it is measured rather than assumed —
 * `BOOT_PRESWAP_FRAMES` is R7 slice 2b's, with a negative control. Imported
 * rather than restated: two constants that must agree are one constant
 * ([[feedback_two_cost_models_must_agree]]).
 */
export function beginEntryTimeFromDeclared(declared) {
    if (!Number.isFinite(declared)) {
        fail(`beginEntryTimeFromDeclared: ${declared} is not a declared \`save.time\``);
    }
    return declared + BOOT_PRESWAP_FRAMES;
}

/**
 * ⛓⛓⛓ THE FREE ORACLE — the `save.time` a segment's SUCCESSOR must declare,
 * from this segment's own counting.
 *
 * A chain hands `boot(N+1) == latch(N)` over the whole `SEAM_SIGNATURE`, and
 * `save.time` is a `prebuild` row: the latch it is compared against is taken
 * at `Game.begin()` ENTRY of the segment's LAST world. So the successor's
 * declaration is this segment's declaration plus every `Game.update()` between
 * the two entries — which is every tick the tape drove plus every dead frame
 * the clock spent, MINUS the last world's own fade, because that fade is spent
 * after the instant the latch reads. The two `BOOT_PRESWAP_FRAMES` corrections
 * (one on each side) cancel exactly.
 *
 * ⛔ THIS IS AN ORACLE AND NOT A DERIVATION: the numbers on the right came out
 * of the GAME, one per committed seam, long before this file existed. Nothing
 * here can make them agree.
 *
 * ⚠ It assumes the segment ENDS AT AN ARRIVAL — the last transition's tick is
 * the tape's last — which is what a seam is: a segment cut anywhere else has
 * no `Game.begin()` for its successor to boot from.
 */
export function declaredSeamTimeAfter({ declaredTime, deadFramesOwed, tickCount }) {
    if (!Number.isFinite(declaredTime) || !Number.isFinite(deadFramesOwed)
        || !Number.isFinite(tickCount)) {
        fail('declaredSeamTimeAfter needs {declaredTime, deadFramesOwed, tickCount}, got '
            + `${JSON.stringify({ declaredTime, deadFramesOwed, tickCount })}`);
    }
    return declaredTime + deadFramesOwed - LOAD_FADE_FRAMES + tickCount;
}

/**
 * The clock itself — `Game.time` at the TOP of the frame the run is about to
 * step, which is the instant `Spinner.update` reads it.
 *
 * ⛔ THE TOP OF THE FRAME, NOT THE BOTTOM. `Game.update` is
 * `… if (blackCover <= 0) super.update(); … time += timeRate;`, so every
 * entity that reads the clock during a frame reads the value the PREVIOUS
 * frame left. `now()` is therefore what the spinner sees this tick, and
 * `tick()` is the increment at the end of it.
 *
 * @param {object} p `{bootTime}` — the `Game.begin()`-ENTRY value, or `null`
 *   for a run whose boot does not declare one. A null clock answers `null`
 *   for ever and every consumer refuses by name rather than guessing a phase.
 */
export function createGameClock({ bootTime = null } = {}) {
    let t = bootTime === null ? null : bootTime;
    if (t !== null && (!Number.isFinite(t) || t < 0)) {
        fail(`createGameClock: ${bootTime} is not a \`Game.time\``);
    }
    /** Every span of frames spent, in order — the ledger both views read. */
    const spans = [];
    const spend = (frames, kind, why, at) => {
        if (!Number.isInteger(frames) || frames < 0) {
            fail(`gameClock.spend: ${frames} is not a frame count (${kind}: ${why})`);
        }
        if (frames === 0) return;
        spans.push({ frames, kind, why: why ?? null, t: at ?? null });
        if (t !== null) t += frames;
    };
    return {
        get declared() { return bootTime !== null; },
        now: () => t,
        /** One `Game.update()` the tape DID advance through. */
        tick: () => { if (t !== null) t += TIME_RATE.value; },
        /** A world build's fade — `LOAD_FADE_FRAMES` dead frames, per build. */
        build: (level) => spend(LOAD_FADE_FRAMES, 'load', `level ${level} build`, null),
        spend,
        get spans() { return spans.map((s) => ({ ...s })); },
        /** The subset `levelRun.frozenFramesOwed` has always reported. */
        get frozenFrames() {
            return spans.reduce((n, s) => (s.kind === 'freeze' ? n + s.frames : n), 0);
        },
        get deadFrames() { return spans.reduce((n, s) => n + s.frames, 0); },
    };
}
