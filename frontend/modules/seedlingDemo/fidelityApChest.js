/**
 * seedlingDemo/fidelityApChest — **ONE DERIVATION OF THE AP-CHEST WITNESS** (slice seedling-fidelity-apchest), shared
 * by the game probe (`scripts/procgen/probe-seedling-apchest.mjs`) and the node rows (`fidelityApChest.test.js`), so
 * the tapes and rooms the p4h page plays are the ones the rows replay.
 *
 *   · the ROOMS: the playthrough's DELIVERED set (`fidelityL25ApItem.l25Sets`, the randomizer's own pipeline), whose
 *     ledger chests are `<apitem kind="chest">` (`apPlacementRewriter.apItemAttrs`, rules-ap-chest-solid). A p4h page
 *     builds each as `Pickups/APChest`; the model does so on `capabilities` declaring `apchest`.
 *   · the TAPES: one per plan below, `{boot, one held key, ticks}`, on the L25 survey tape's own header (its pins,
 *     save, rng and seam), so nothing but the walk differs from a tape the probe has already played.
 *   · the REPLAY: the model's row before each tape tick (`{level, x, y}`, the game's drained shape) and the AP take
 *     (the `earnedClears` row by `apitem@x,y`), with the build's capabilities passed explicitly.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { L25_TAPE } from './fidelityL25ApItem.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

/**
 * The walks. `predicted` is the model's answer on p4h (`openTick`: the tape tick count after which the chest is open
 * and its slot cleared; `passageTick`: the first tick whose box top is inside the chest's cell; `fadeEndTick`: the
 * 60th update counted from the open frame, `APChest.as:96-107`). `modelOnly` rooms are not on the delivered set.
 */
export const AP_CHEST_PLANS = Object.freeze([
    { name: 'l25-side', boot: { level: 25, x: 112, y: 96 }, key: 'left', ticks: 20,
        what: 'east of chest@96,96, walking WEST into its side', predicted: { openTick: null } },
    { name: 'l25-above', boot: { level: 25, x: 96, y: 80 }, key: 'down', ticks: 20,
        what: 'north of chest@96,96, walking SOUTH onto its top', predicted: { openTick: null } },
    { name: 'l25-below', boot: { level: 25, x: 96, y: 112 }, key: 'up', ticks: 40,
        what: 'south of chest@96,96, walking NORTH through its bottom line',
        predicted: { openTick: 6, passageTick: 6, fadeEndTick: 65 } },
    { name: 'l11-below', boot: { level: 11, x: 32, y: 64 }, key: 'up', ticks: 20,
        what: 'south of chest@32,48, walking NORTH through its bottom line',
        predicted: { openTick: 6, passageTick: 6, fadeEndTick: 65 } },
    { name: 'l38-covered', boot: { level: 38, x: 144, y: 128 }, key: 'up', ticks: 30,
        what: 'under chest@144,112 with cover@144,112 SHUT (nothing presses group 0)', predicted: { openTick: null } },
    { name: 'l38-cover-button', boot: { level: 38, x: 144, y: 128 }, key: 'up', ticks: 30, modelOnly: true,
        what: 'MODEL ONLY: L38 with buttonroom@144,128 swapped for a `button tset 0`; the stand presses the cover open',
        predicted: { openTick: 12, coverOpenTick: 11 } },
]);

/** L38 with its `buttonroom@144,128` swapped for a `button tset 0` (the `modelOnly` plan's room). */
export function coverButtonRecord(rec) {
    if (rec?.level !== 38) return rec;
    return {
        ...rec,
        entities: rec.entities.map((e) => (e.type === 'buttonroom' && e.x === 144 && e.y === 128
            ? { type: 'button', x: 144, y: 128, attrs: { tset: '0' } } : e)),
    };
}

/** The plan's tape, on the L25 survey tape's header. */
export function apChestPlanTape(root, plan) {
    const base = JSON.parse(readFileSync(join(root, L25_TAPE), 'utf8'));
    return parseTape({
        ...base, name: `apchest-${plan.name}`, boot: { ...plan.boot },
        inputs: [{ key: plan.key, from: 0, to: plan.ticks }], tick_count: plan.ticks,
    });
}

/**
 * The model's replay: `rows[i]` = the row before tape tick `i` (`tick_count + 1` rows), `openTick` (the tick count
 * after which `openChests` is non-empty), `takes` (the AP take rows), and the run.
 */
export function apChestReplay(tape, levelSource, { capabilities = null } = {}) {
    const run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true, capabilities });
    const rows = [{ level: run.level, x: run.state.x, y: run.state.y }];
    let openTick = null;
    for (let t = 0; t < tape.tick_count; t++) {
        run.advance(heldKeysAt(tape, t));
        rows.push({ level: run.level, x: run.state.x, y: run.state.y });
        if (openTick === null && (run.openChests?.size ?? 0) > 0) openTick = t + 1;
    }
    const takes = run.earnedClears.filter((c) => String(c.by).startsWith('apitem@'));
    return { run, rows, openTick, takes };
}
