/**
 * bounceRegionEditor/buildEditedRegion — **THE EDITOR'S SAVE MERGE, AS ONE
 * IMPORTABLE PURE FUNCTION** (EDITOR INTEGRATION slice B-b).
 *
 * ── ⛔⛔ WHY IT MOVED OUT OF THE PANEL ─────────────────────────────────
 *
 * It was `BounceRegionEditorUI._buildEditedRegion`, and
 * `scripts/procgen/verify-region-step-editing.mjs:105` held a COPY of it under
 * the name `buildEdited` with a comment saying *"mirrors
 * bounceRegionEditorUI._buildEditedRegion"*. That verifier's Phases B/C/D/E/F
 * are BYTE-shaped pins on what a save produces — and every one of them was
 * pinning the copy. A drift in the panel's merge would have left the verifier
 * green while the app wrote a different region (plan §1's own note on that
 * row: *"pins a COPY of `_buildEditedRegion`, not the file"*).
 *
 * ⇒ ONE body, imported by both. The panel calls it with its staged
 * `settings`; the verifier calls it with none.
 *
 * ── ⛓ WHAT IT MERGES, AND WHY EACH HALF COMES FROM WHERE IT DOES ──────
 *
 * Re-emit the region's rules from the EDITED level (the same emission the
 * generator runs), then splice into a clone of the ORIGINAL region so the
 * grid-level wiring survives: exit ids, sides and targets, `exits_placed`, the
 * driver back-exit and `placed_items` are the pipeline's, not the editor's.
 *
 *  · the EXITS keep the contract — their gates are not editable here, so only
 *    `paths` and `access_rule` are replaced, and only for an exit whose side
 *    `exits_placed` names (the driver back-exit is not placed, and is left
 *    alone);
 *  · the LOCATIONS are replaced WHOLESALE from the edited level's pickups, so
 *    an item pick, an addition and a removal all take effect. An off-plan item
 *    is the oracle's to flag.
 *
 * ⚠ `settings` are the panel's staged generation settings and they are NOT
 * document edits — physics profile, mode and free arrow change how the rules
 * are DERIVED from a level, not what the level is. A session's undo does not
 * touch them, and a caller with none (the verifier) reproduces the contract's
 * own values exactly.
 */

import { assembleBounceRegionFromLevel } from '../bounceDemo/bounceDemoLibrary.js';

const clone = (o) => (typeof structuredClone === 'function'
    ? structuredClone(o)
    : JSON.parse(JSON.stringify(o)));

/**
 * @param {object} o
 * @param {object} o.region    the live region (the write-back base)
 * @param {object} o.contract  `{exitSpecs, locationSpecs, physicsProfile, mode, freeArrow}`
 * @param {object} o.level     the EDITED level
 * @param {object} [o.settings] the panel's staged generation settings, if any
 * @returns {object} a new region — the caller splices it into the grid
 */
export function buildEditedRegion({ region, contract = {}, level, settings = {} } = {}) {
    const s = settings ?? {};
    const locationSpecs = (level.pickups ?? []).map((pk) => ({
        id: pk.id, item: pk.item ?? null, requirement: [], counts: {},
    }));
    const built = assembleBounceRegionFromLevel(level, {
        region_id: region.region_id,
        exitSpecs: contract.exitSpecs ?? [],
        locationSpecs,
        physicsProfile: s.physicsProfile ?? contract.physicsProfile ?? 'experimental',
        mode: s.mode ?? contract.mode ?? 'column',
        freeArrow: s.freeArrow ?? contract.freeArrow ?? 'right',
    });
    const next = clone(region);
    next.playable_payload = built.payload;
    next.obstacle_defs = built.obstacleDefs;

    const sideByExitId = new Map((region.exits_placed ?? []).map((p) => [p.exit_id, p.side]));
    for (const ex of next.extracted_rules?.exits ?? []) {
        const side = sideByExitId.get(ex.id);
        if (side && built.exitPaths[side]) {
            ex.paths = built.exitPaths[side];
            ex.access_rule = built.exitRules[side];
        }
    }
    if (next.extracted_rules) next.extracted_rules.locations = built.locations;
    return next;
}

export default buildEditedRegion;
