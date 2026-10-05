/**
 * seedlingDemo/fidelityDescent — **ONE DERIVATION OF THE DESCENT WITNESSES**
 * (seedling fidelity DESCENT), shared by the game probe
 * (`scripts/procgen/probe-seedling-descent.mjs`) and the node rows
 * (`fidelityDescent.test.js`), so the tape the game played and the tape the
 * rows replay are one tape.
 *
 * ⚖ The user (2026-10-05): the moonrock event stays disabled, L110's fall is NOT
 * repointed, and the MODEL is fixed: a fall's descent fires a live teleporter it
 * lands on, as the game does.
 *
 * THE GAME'S RULE (AS3, read-only; every clause measured by this module's arms):
 *   - `checkFallingInPit` builds `new Game(fallthroughLevel, x, y)` with
 *     `setFallFromCeiling`; the new `Player` is born at the ctor tile's centre.
 *   - `Game.update`'s first frame runs `check()` on every entity. The doors were
 *     added AFTER the player and `World.addUpdate` PREPENDS, so the doors'
 *     `Teleporter.check()` runs FIRST and sees the player at the CTOR position:
 *     a door the LANDING tile overlaps is LATCHED (`playerTouching = true`).
 *     `Player.check()` then lifts the player to the camera top (83 px up).
 *   - The descent (`Player.update`'s `fallFromCeiling` arm) is ballistic y only;
 *     `Player.input()` returns while `fallFromCeiling`, so the player cannot act.
 *   - `Teleporter.update` has no `fallFromCeiling` guard. Each update it reads the
 *     position the previous tick left: no overlap releases the latch, an overlap
 *     on an unlatched, live door FIRES (`FP.world = new Game(to, playerx,
 *     playery)`, no `setFallFromCeiling`): the run arrives on the ground at the
 *     door's own target and the fall is over.
 *   - So a door the descent column crosses fires on the first update that
 *     overlaps it unlatched — including the landing door itself, which the
 *     first descent update (83 px up) has already released. A deactivated door
 *     (`tag >= 0`, persistence against it) returns before either arm.
 *
 * THE WORLDS. The fall tapes are `fidelityMoonrock`'s L110 fall (route step 23's
 * staging); the worlds are the built-in map (L110's vanilla control → L0
 * `stairsdown@256,272`, the only pit in the atlas that lands on a door — the
 * census below) and delivered-set VARIANTS whose L110 control is repointed only
 * to put a door where the rule has a question to answer. None of the variants is
 * a delivery: they are probe worlds.
 */

import { MOONROCK_TAPES, builtInLevelSource, builtInMap, tapeOf } from './fidelityMoonrock.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { levelSourceFromAtlas } from './atlasSource.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import { PATCH_L110_FALL_TO_L2, SEEDLING_SET_PATCHES } from './seedlingSetPatches.js';

const EMBED_PATH = 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json';

/** L110's control, repointed so its only pit's fall arrives at L2 (`x`, `y`) (the `seedlingSetPatches` arithmetic). */
const l110ProbeRepoint = (id, x, y) => Object.freeze({
    id,
    level: 110,
    op: 'set-attrs',
    match: Object.freeze({ type: 'control', x: 64, y: 64,
        attrs: Object.freeze({ fallthrough: '0', xOff: '-256', yOff: '-272' }) }),
    attrs: Object.freeze({ fallthrough: '2', xOff: String(-x), yOff: String(-y) }),
    why: `probe world only (seedling fidelity DESCENT): L110's pit lands at L2 (${x},${y})`,
});

/**
 * ⛓ THE LATCH DISCRIMINATOR. L2 holds two doors on one column:
 * `stairsup@48,16` (→ L0) and a hidden `teleporter@48,96` (→ L3). Landing at L2 (48,96)
 * puts the CTOR box on the lower door and the ceiling-drop box (83 px up, y
 * 19–24) on the upper one.
 *   - doors latched at the CTOR (the transcription): the upper door is unlatched
 *     and fires on the very first update → L0, one tick after the arrival;
 *   - doors latched at the DROPPED position: the upper door would be latched and
 *     released as the player falls away, and the lower one would fire on the way
 *     down → L3.
 */
export const PATCH_L110_FALL_LATCH_PROBE = l110ProbeRepoint('l110-fall-latch-probe', 48, 96);

/**
 * The delivered set's probe VARIANTS (patch lists): `table` is the delivery
 * (`SEEDLING_SET_PATCHES`); `approved` is the moonrock slice's approved repoint
 * (L2 (48,32): the descent crosses `stairsup@48,16` from above, unlatched);
 * `latch-probe` is the discriminator above.
 */
export const DESCENT_VARIANTS = Object.freeze({
    table: SEEDLING_SET_PATCHES,
    approved: Object.freeze([...SEEDLING_SET_PATCHES, PATCH_L110_FALL_TO_L2]),
    'latch-probe': Object.freeze([...SEEDLING_SET_PATCHES, PATCH_L110_FALL_LATCH_PROBE]),
});

/** A probe variant's set (`vanillaRecordSet`), its mounted records, and their level source. */
export function descentSet(repoRoot, variant) {
    const patches = DESCENT_VARIANTS[variant];
    if (!patches) throw new Error(`fidelityDescent: no variant ${JSON.stringify(variant)}`);
    const embed = JSON.parse(readFileSync(join(repoRoot, EMBED_PATH), 'utf8'));
    const { set } = vanillaRecordSet(embed, builtInMap(repoRoot), { patches });
    const records = mountedRecordsOf(set);
    return { set, records, levelSource: levelSourceFromAtlas(records) };
}

export { builtInLevelSource };

/** The worlds an arm names: `builtin`, or `delivered` / `delivered:<variant>`. */
export function descentWorld(repoRoot, world) {
    if (world === 'builtin') return { set: null, levelSource: builtInLevelSource(repoRoot) };
    const v = world === 'delivered' ? 'table' : world.slice('delivered:'.length);
    const d = descentSet(repoRoot, v);
    return { set: d.set, levelSource: d.levelSource };
}

/**
 * THE WITNESS TAPES.
 *   `fall`     `fidelityMoonrock`'s L110 fall, verbatim: booted on the tile above
 *              the pit, `down` t0–t11, then still.
 *   `fallAct`  the same, with `left` held from t12 to the end: through the
 *              fall-out (input dead from the tick after the edge), the whole
 *              descent (`Player.input()` returns while `fallFromCeiling`) and on
 *              into the arrival, where it is live again. A live input during the
 *              descent would move x off 264.
 */
export const DESCENT_TAPES = Object.freeze({
    fall: MOONROCK_TAPES.fall,
    fallAct: () => tapeOf({
        name: 'descent-fall-act',
        boot: { level: 110, x: 64, y: 48 },
        flags: { beam: false, rockSet: false },
        ticks: 150,
        spans: [['down', 0, 12], ['left', 12, 150]],
        description: 'seedling fidelity DESCENT — the L110 fall tape with `left` held from t12: '
            + 'the fall-out and the descent ignore it, the arrival after the stairs does not. '
            + 'Authored by fidelityDescent.js.',
    }),
});

/** The arms the probe plays and the rows hold the model to: `[tape, world]`. */
export const DESCENT_ARMS = Object.freeze([
    ['fall', 'builtin'],
    ['fall', 'delivered'],
    ['fallAct', 'builtin'],
    ['fall', 'delivered:approved'],
    ['fall', 'delivered:latch-probe'],
]);
