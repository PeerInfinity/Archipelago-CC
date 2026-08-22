/**
 * seamPosture — CAN THE STREAM POSITION BE ASSERTED IN THIS ROOM?
 * R9 slice 8, ⚖ ruling 20.
 *
 * ── WHY A BOUNDARY MAY NOT BE ABLE TO ANSWER ─────────────────────────
 *
 * `rng.gameplay` is a `level-qualified-equality` row in `SEAM_SIGNATURE`, and
 * the qualification is the whole point: the stream position is an equality
 * field only where the level's own RENDER path takes no draws. Three sites
 * take them — `BossTotem.render` (2 per render), `LavaBoss.render` (1), and
 * `Tile.render`'s waterfall spray on tile type 25 (2) — and a render COUNT is
 * the ±2-banded quantity a `pins: ["dead_frames"]` tape exists to tolerate.
 * In such a room two runs that walked identically can sit at different stream
 * positions, and asserting equality would red for a frame budget rather than
 * for a defect (`r7Acceptance.seamRngPosture`).
 *
 * ⛔ THIS IS A BOUND, NOT AN EXCUSE. The posture says which boundaries CAN
 * carry the claim; a boundary it cannot is REPORTED by name with its render
 * sites, never dropped. And the gate is FAIL-CLOSED at the other end:
 * `director.continuationAdmission` asserts unless it is handed a posture that
 * says otherwise.
 *
 * ⛓ MEASURED OVER THE CHAINS THIS RUNG PLAYS (slice 8's W0 census, before
 * any GPU): of the seventeen boundaries in `PLAYTHROUGH_CHAINS`' three
 * multi-segment chains, FIFTEEN are render-CLEAN. The two that are not are
 * `r7-ends-meet-2` (boots L94) and `r9-solve-0` (boots L0) — both the
 * waterfall spray. ⚠ AND THE BAND DID NOT ACTUALLY APPEAR: L0's tick-0
 * reading was driven twice with `--no-cache` and came back byte-identical.
 * Two samples is a bound, not a proof, so the row stays informational rather
 * than being promoted to an assertion on the strength of it.
 */

import { rngPostureOf } from './r6Acceptance.js';
import { seamRngPosture } from './r7Acceptance.js';
import { buildLevelWorld } from './levelWorld.js';

/**
 * The seam rng posture of a boot room.
 *
 * @param {number} level the tape's `boot.level`
 * @param {function} levelSource an atlas source — `atlasLevelSource()` or the
 *   page's `levelSourceFromAtlas`; NOT defaulted, because a module that
 *   reached for its own atlas would answer for a different one than its
 *   caller renders
 * @returns {object} `seamRngPosture`'s row: `{renderSites, consumers,
 *   comparable, verdict}`
 */
export function rngPostureForBootLevel(level, levelSource) {
    const record = levelSource(level);
    const tileTypes = [...new Set(
        buildLevelWorld(record, { roles: ['blocking'] }).tiles.map((t) => t.t))];
    const p = rngPostureOf(record, tileTypes);
    return seamRngPosture(p.renderCoupled, p.consumers);
}
