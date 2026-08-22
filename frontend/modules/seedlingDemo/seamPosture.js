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

import { seamRngPosture } from './r7Acceptance.js';
import { buildLevelWorld } from './levelWorld.js';

/**
 * ⛔ THESE TWO MOVED HERE FROM `r6Acceptance.js` AT R9 SLICE 8, and that file
 * re-exports them so no call site changed. The reason is an architecture
 * boundary: `r6Acceptance` imports `fixtures/index.js`, which is NODE-ONLY by
 * its own docblock (`node:fs`), and this posture has to run ON THE PAGE where
 * the admission does. Everything below is pure — a level record and a
 * tile-type list in, a verdict out — so it belongs on the browser-safe side.
 */
export const GAMEPLAY_DRAW_CONSUMERS = Object.freeze({
    finalboss: 'FinalBoss.as:142-144,158 — the rockfall spawn decision (1 draw/tick), '
        + 'its aim (2 draws/spawn) and the grenade decision (1 draw/tick while walking)',
    tentaclebeast: 'TentacleBeast.as:138-168 — spawn placement, up to 202 draws/frame '
        + 'in the whirlpool loop (DEFERRED by name this rung)',
    lightboss: 'LightBoss.as:67 — `if (!Math.floor(Math.random() * 90))` (DEFERRED)',
});

/**
 * A level's RNG posture: is a window in this room exactly reproducible?
 *
 * ⚠ THIS IS A CLAIM ABOUT THE ROOM, NOT ABOUT THE RUN. It says whether the
 * stream can be perturbed in a way anything reads; it does NOT say the
 * update stream is byte-exact, which is what a recorded window shows.
 *
 * ⚠ And it carries one standing precondition it cannot check from a level
 * record: `Game.shake` is a `public static` that survives world swaps and
 * decays inside `view()`, which runs BELOW the `blackCover` gate — so a
 * window that begins with `shake > 0` drains it across a fade whose length
 * varies run to run. Every tape gets a fresh page, so `shake` starts at its
 * static initialiser 0; with `noDamage` on and no shake writer in the room
 * it stays there. Three facts, each assertable, none of them checked here.
 *
 * @param {object} levelRecord the atlas record
 * @param {number[]} tileTypes every tile type present in the level
 */
export function rngPostureOf(levelRecord, tileTypes) {
    const types = new Set((levelRecord?.entities ?? []).map((e) => e.type));
    const renderCoupled = [];
    if (types.has('bosstotem')) renderCoupled.push('BossTotem.render draws 2 per render');
    if (types.has('lavaboss')) renderCoupled.push('LavaBoss.render draws 1 per render');
    if ((tileTypes ?? []).includes(25)) {
        renderCoupled.push('Tile.render\'s waterfall spray draws 2 per render (t=25)');
    }
    const consumers = Object.keys(GAMEPLAY_DRAW_CONSUMERS).filter((k) => types.has(k));
    return {
        renderCoupled,
        consumers,
        // ⛓ EXACT unless BOTH halves are present. L43 has a polluter and no
        // consumer; L112 has a consumer and no polluter; L115 has a polluter
        // (four waterfall tiles) and no consumer. None of the three is at
        // risk, and the reasons are different in each case.
        exact: !(renderCoupled.length > 0 && consumers.length > 0),
        why: renderCoupled.length && consumers.length
            ? `AT RISK: ${renderCoupled.join('; ')} against consumer(s) ${consumers.join(', ')}`
            : renderCoupled.length
                ? `polluter only, nothing reads it: ${renderCoupled.join('; ')}`
                : consumers.length
                    ? `consumer only, position is update-determined: ${consumers.join(', ')}`
                    : 'no draw site of either kind',
    };
}

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
