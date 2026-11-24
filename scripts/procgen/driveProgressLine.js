/**
 * driveProgressLine — the one line a browser-driving producer prints after it
 * drives a tape: what it drove and, on the RECORD path only, the page-timing
 * readouts.
 *
 * ⛓ SEEDLING HAMMER ENDS-MEET-DIGEST — **A `--check` OUTPUT IS A DIGEST, so it
 * prints only what the tree determines.** `plan-seedling-r7-ends-meet --check`
 * is md5'd whole (`… 2>&1 | b | m`), and that digest flipped between
 * `4b4cacff` and `f1675cfc` on an unchanged tree (train 98's js-land run; 9:1
 * over 10 sequential runs at `fe98f37f22`). The ONLY differing byte was this
 * line's dead-frame count, 37 vs 38. Measured on p4g at the same base: the
 * game's own `botStatus.dead_frames` and its latched `latch.dead_frames` agree
 * with each other and read 37 or 38 depending on where `botStart` lands
 * against the page's boot (0/8 runs at a 100 ms readiness poll read 37; 4/8 at
 * the producer's 500 ms poll), while `latch.tick` is 61 every time and every
 * tape is byte-identical. So the count is a readout of PAGE PHASE, not of the
 * tape, and a check's digest that carries it measures the wall clock.
 *
 * It is the second field of this line to leave the `--check` path for that
 * reason: the drive's duration went first (R9 slice 9b, 227 s vs 292 s vs
 * 223 s). Both still print on the record path, where they are progress
 * rather than a claim. The observation count stays: it is the tape's own
 * tick count plus one and does not move with the page.
 *
 * @param {object} o
 * @param {string} o.label         the tape that was driven
 * @param {number} o.observations  `botDrain().ticks.length`
 * @param {number} o.deadFrames    `botStatus().dead_frames` (page-phase dependent)
 * @param {number} o.ms            wall-clock duration of the drive
 * @param {boolean} o.check        true on the `--check` path
 * @returns {string}
 */
export function driveProgressLine({ label, observations, deadFrames, ms, check }) {
    const head = `    drove ${label}: ${observations} observations`;
    if (check) return head;
    return `${head}, ${deadFrames} dead, ${(ms / 1000).toFixed(0)}s`;
}
