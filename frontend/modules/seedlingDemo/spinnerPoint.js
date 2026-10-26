/**
 * ⛓ fidelity L39SHAFT D2c (wave 31, `CONTACT_FIDELITY.spinnerPointExact`, OFF) — `Spinner.friction()`'s `Point`
 * arithmetic in the RUNTIME's spelling.
 *
 *     Spinner.as:124-135   v.normalize(Math.max(v.length - f, moveSpeed)); then the per-axis `< 0.05` zeroing
 *
 * `Point.length` is `sqrt(x*x + y*y)` and `Point.normalize(t)` MULTIPLIES by `t / length` (`playerPhysicsV1`'s
 * `pointLength` / `pointNormalize`, the runtime's `point_normalize`). `spinner.spinnerFriction` spells it `Math.hypot`
 * and `(v / len) * t` — the refuted spelling `chasers.js` retired at the wave-8 harvest — and the two agree on a
 * spinner at its floor speed but not on a decaying knockback. MEASURED (D2's game witness, the survey's step 66
 * solved with `l39ShaftPress` ON, played on p4g on the delivered set): after a strike at t~630, `spinner@224,208`'s y
 * at t637 is the game's `205.7960238641827` and the model's `…267`, one ulp, the only disagreement over 3,290 ticks.
 *
 * Its own module so that `spinner.js` stays outside `oneSpelling`'s subject (`spinner.js` keeps its OFF arm's spelling
 * byte for byte; this file, which imports the transcription, has no second spelling).
 */
import { pointLength, pointNormalize } from './playerPhysicsV1.js';

/** `Spinner.friction()` on `(vx, vy)` with the class's `f`, `moveSpeed` floor and `zeroBand`: `{vx, vy}`. */
export function spinnerFrictionExact(vx, vy, { f, moveSpeed, zeroBand }) {
    const n = pointNormalize(vx, vy, Math.max(pointLength(vx, vy) - f, moveSpeed));
    return { vx: Math.abs(n.x) < zeroBand ? 0 : n.x, vy: Math.abs(n.y) < zeroBand ? 0 : n.y };
}
