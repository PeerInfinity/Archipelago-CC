/**
 * seedlingDemo/fidelityChestCover — **ONE DERIVATION OF THE CHEST/COVER WITNESS** (slice seedling-fidelity-chestcover,
 * wave 61), shared by the game witness (`CC/docs/cloud-reports/seedling-fidelity-chestcover-evidence/tools/
 * chestcover-witness.mjs`) and the node rows (`fidelityChestCover.test.js`), so the room and tape the page plays are the
 * ones the rows replay.
 *
 *   · the ROOM: the vanilla L38 with `buttonroom@144,128` swapped for a plain `button tset 0` (the stand under
 *     `chest@144,112` presses `cover@144,112` open), and `button@80,192` moved from group 0 to the unused group 5.
 *     ⚠ The move is NOT optional: two `Button`s in one group recurse without end in the game (`Button.as:42-60`: the
 *     setter's `activateAll` sets the other, whose setter sets this one, …) — wave 60's first staging hung the page at
 *     tick 1 with `Maximum call stack size exceeded`. Level DATA, loaded through `botLoadLevels`; no game edit.
 *     The family is wider than two Buttons (wave 61's census, `-evidence/tools/census.mjs`): `RopeStart.set activate`
 *     (`RopeStart.as:79-90`) re-publishes unconditionally too, and a `ButtonRoom {room -1, flip 0}`
 *     (`ButtonRoom.as:67-98`) re-publishes `true`, so any two of those in one group recurse once the group is true.
 *     The model presses each independently and has no such failure (named, not modelled).
 *   · the TAPES: `{boot, one held key, ticks}` on the L25 survey tape's header (its pins, save, rng and seam), the shape
 *     wave 58/60 played (`l38-cover-button`: up for 30 ticks from 144,128).
 *   · the REPLAY: the model's row before each tape tick (`{level, x, y}`, the game's drained shape), the tick the
 *     chest opens (`openTick`: the tape tick count after which `chestOpens` holds it), and the run.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { L25_TAPE } from './fidelityL25ApItem.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

/** The chest and the cover over it (vanilla L38; the one covered chest on the atlas, wave 60's census). */
export const L38_CHEST = Object.freeze({ id: 'chest@144,112', cover: 'cover@144,112', persistTag: 1 });

/**
 * The walks. `stand`: under the chest, on the swapped button, walking north into its bottom line (the cover turns while
 * the player stands in the band). `late`: below the button, so the cover is open long before the player reaches the band.
 */
export const CHEST_COVER_PLANS = Object.freeze([
    { name: 'l38-cover-button', boot: { level: 38, x: 144, y: 128 }, inputs: [{ key: 'up', from: 0, to: 30 }], ticks: 30,
        what: 'under chest@144,112, on the swapped button: the cover turns while the player stands in the band' },
    { name: 'l38-cover-late', boot: { level: 38, x: 144, y: 128 }, inputs: [{ key: 'up', from: 20, to: 50 }], ticks: 50,
        what: 'on the swapped button, still for 20 ticks (the cover opens on 11), then north: the chest opens long after' },
]);

/** L38 with `buttonroom@144,128` swapped for a `button tset 0` and `button@80,192` moved to group 5 (ONE Button in 0). */
export function coverButtonRecord(rec) {
    if (rec?.level !== 38) return rec;
    return {
        ...rec,
        entities: rec.entities.map((e) => {
            if (e.type === 'buttonroom' && e.x === 144 && e.y === 128) return { type: 'button', x: 144, y: 128, attrs: { tset: '0' } };
            if (e.type === 'button' && e.x === 80 && e.y === 192) return { ...e, attrs: { ...e.attrs, tset: '5' } };
            return e;
        }),
    };
}

/** The plan's tape, on the L25 survey tape's header. */
export function chestCoverPlanTape(root, plan) {
    const base = JSON.parse(readFileSync(join(root, L25_TAPE), 'utf8'));
    return parseTape({
        ...base, name: `chestcover-${plan.name}`, boot: { ...plan.boot },
        inputs: plan.inputs.map((i) => ({ ...i })), tick_count: plan.ticks,
    });
}

/**
 * The model's replay: `rows[i]` = the row before tape tick `i` (`tick_count + 1` rows), `openTick` (the tick count after
 * which `chestOpens` names the chest), `coverOpenTick` (the tick count after which the cover's `open` is set), the run.
 */
export function chestCoverReplay(tape, levelSource, { capabilities = null } = {}) {
    const run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true, capabilities });
    const rows = [{ level: run.level, x: run.state.x, y: run.state.y }];
    let openTick = null;
    for (let t = 0; t < tape.tick_count; t++) {
        run.advance(heldKeysAt(tape, t));
        rows.push({ level: run.level, x: run.state.x, y: run.state.y });
        if (openTick === null && run.chestOpens.some((c) => c.id === L38_CHEST.id)) openTick = t + 1;
    }
    return { run, rows, openTick };
}
