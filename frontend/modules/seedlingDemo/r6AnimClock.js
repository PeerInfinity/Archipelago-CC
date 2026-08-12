/**
 * seedlingDemo/r6AnimClock — the BROWSER-SAFE half of `r6Acceptance`.
 *
 * ⚠ THIS FILE EXISTS FOR THE REASON `atlasSource.js` EXISTS, one module
 * family along: "the function has no node dependency" and "the module can
 * be imported in a browser" are different claims, and only the first was
 * ever true of these three symbols. `r6Acceptance` imports
 * `fixtures/index.js` (which imports `node:fs`) for two roster defaults,
 * and an ES module runs its imports before any export is reachable — so
 * `endingChain` importing one pure animation transcription from there
 * dragged `node:fs` into every browser that loaded the level run.
 * `watch.html` could not load at all, and only a browser could say so
 * (editor arc slice 1).
 *
 * Nothing here changed: the three definitions moved WHOLE, `r6Acceptance`
 * re-exports all three, and every existing importer — including the test
 * that asserts `toThrow(R6AcceptanceError)` on the class IDENTITY — is
 * untouched. One definition each, no copies.
 */

export class R6AcceptanceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'R6AcceptanceError';
    }
}

/**
 * ⛓ Every R6 window derives its tick counts by simulating
 * `Spritemap.update` at the CLAMPED `FP.elapsed`, never by 60 fps frame
 * math. `Engine.as:270` — `MAX_ELAPSED` is the decimal literal 0.0333, not
 * `1/30`, and the difference is not academic: §2.5 of the brief said the
 * tree grow was "≈ 274 ticks", which is the 60 fps reading doubled. It is
 * 138.
 *
 * ⛓⛓ AND `World.update` CALLS `e._graphic.update()` AFTER `e.update()` IN
 * THE SAME PASS AND OUTSIDE THE `e.active` TEST — so an anim advances once
 * per world update whatever the entity's own `update()` decided. That is
 * why `ShieldBoss`'s die animation still runs while its `update()` skips
 * `super.update()`.
 */
export const FP_ELAPSED_CLAMPED = 0.0333;

/**
 * `Spritemap.update`, transcribed. Returns the update index on which the
 * animation's callback fires — its WRAP for a looping anim, its completion
 * for a one-shot.
 *
 * ⚠ SIMULATED, never `frameCount / (frameRate * elapsed)`. Repeated
 * addition of 0.4995 is not the same number as a division, and dividing
 * would assert an arithmetic the game does not do —
 * [[feedback_accumulate_dont_divide_the_fade]], the same law
 * `wandFadeFreezeTicks` and `fallRockFreezeTicks` follow.
 */
export function animCallbackUpdate(frameRate, frameCount) {
    if (!(frameCount > 0)) {
        throw new R6AcceptanceError(`animCallbackUpdate: frameCount must be > 0, got ${frameCount}`);
    }
    const step = frameRate * FP_ELAPSED_CLAMPED;
    // ⛓ frameRate 0 is a REAL CASE, not a guard: `ShieldBoss`'s "sit" is
    // `add("sit", [0])` with the default frameRate 0, so its `_timer` never
    // moves and `endAnim` can never fire from it. Infinity is the honest
    // answer, and a caller that treats it as a tick count will say so.
    if (step === 0) return Infinity;
    let timer = 0;
    let index = 0;
    for (let update = 1; update <= 100000; update++) {
        timer += step;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index === frameCount) return update;
        }
    }
    throw new R6AcceptanceError(
        `animCallbackUpdate: ${frameCount} frames at ${frameRate}/s did not wrap`);
}
