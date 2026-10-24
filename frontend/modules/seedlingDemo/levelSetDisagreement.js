/**
 * ⛓ THE READBACK COMPARISON — the proof a level set MOUNTED rather than merely
 * arrived (`check-seedling-generated-set.mjs`'s own law).
 *
 * ── ⛔ WHY THIS IS ITS OWN FILE (EDITOR INTEGRATION M1; plan §17.2.5) ─────
 *
 * It lived in `watchWasm.js`, which is a 1.0 MB / 15-file import for anything
 * in `flashPanel/` that wants it — so `seedlingLevelSetDelivery.js` RESTATED
 * it and a node row pinned the two equal, the way `levelSetValidator.TILE_PX`
 * is pinned to `levelWorld.TILE_SIZE`. H7/H8's own note called the hoist the
 * right long-term fix and owed it to M1. This is it.
 *
 * ⛔ THIS FILE IMPORTS NOTHING, AND THAT IS ITS WHOLE SPECIFICATION. A single
 * import here would land in the shipped browser bundle behind
 * `seedlingLevelSetDelivery.js`, which is the cost the restatement existed to
 * avoid; measured at the hoist, the closure of this module is ONE file.
 *
 * ⚠ AND THE PIN ROW THE HOIST REPLACES WAS NOT DELETED, IT WAS RE-AIMED. Two
 * consumers of ONE function agree by construction, so asking whether they
 * agree over a battery of disagreeing pairs is a FIXED POINT — it cannot fail.
 * `seedlingLevelSetDelivery.test.js` now asserts the IDENTITY (the delivery's
 * export IS this function) and keeps the behavioural battery against the one
 * implementation, which is the claim that still has content.
 */

/**
 * ⛓ The three fields `botLevelSet` answers that say WHICH set mounted.
 * `set_id` ends in the content hash (`stampLevelSetIdentity`), so comparing it
 * compares the bytes.
 */
export const READBACK_FIELDS = Object.freeze(['active', 'table_levels', 'start_level']);

/**
 * The first disagreement between what was sent and what the artifact says it
 * mounted, or null.
 *
 * ⛔ IT NAMES THE FIELD. "the readback disagrees" is a sentence nobody can act
 * on; `active watch-oneroom-e5c2cdf3 ≠ watch-oneroom-4ac90eaa` says the set
 * that mounted is a different set, and `table_levels 0 ≠ 1` says the delivery
 * never landed.
 *
 * @returns {string|null} the first disagreement, or null
 */
export function levelSetDisagreement(sent, back) {
    if (!back) return 'botLevelSet answered nothing — the VM is dead or this build has no accessor';
    if (back.error) return `the artifact recorded a level-set error: ${JSON.stringify(back.error)}`;
    if (back.active !== sent.set_id) return `active ${back.active} ≠ ${sent.set_id}`;
    if (back.table_levels !== sent.rooms.length) {
        return `table_levels ${back.table_levels} ≠ ${sent.rooms.length}`;
    }
    if (back.start_level !== sent.start.level) {
        return `start_level ${back.start_level} ≠ ${sent.start.level}`;
    }
    return null;
}
