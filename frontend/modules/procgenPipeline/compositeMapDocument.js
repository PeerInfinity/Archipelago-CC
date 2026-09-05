/**
 * procgenPipeline/compositeMapDocument — **A COMPOSITE MAP OUT OF A rules.json**
 * (APWORLD EDITOR HUB slice H3).
 *
 * One pure function: turn a document's `preset_sidecars` back into the
 * `{grid, regionSize, stats}` shape the pipeline's own drivers produce, so the
 * shared renderer (`procgenCore/compositeMapRenderer.js`) can paint a LOADED
 * preset with no pipeline run behind it. It was `procgenPipelineUI.js`'s
 * `reconstructResultFromSidecars`; the hub's Map tab is its second reader, and
 * a 6,000-line panel module is not something a second panel should import to
 * reach one pure function.
 *
 * ── ⛔ WHY IT IS *NOT* IN `procgenCore/` BESIDE THE RENDERER ──────────
 *
 * The brief asked for exactly that. It cannot be: this function CONSTRUCTS a
 * `Grid`, and `Grid` lives in `procgenPipelineEngine.js`, which imports
 * `mazeRoom/mazeGeometry.js`. A `procgenCore/` module importing the engine
 * would pull a BINDING in behind it — `bindingContract.test.js` scans literal
 * import specifiers, so the row would stay green while the rule it exists for
 * was broken by one hop. ⇒ the SHARED RENDERER (which needs no Grid, only
 * `width`/`height`/`getRegion`/`allRegions`) is in `procgenCore/`, and the
 * DOCUMENT reader stays on the pipeline side that owns the Grid. Recorded in
 * plan §13 as H3's overturn of its own brief.
 *
 * ── ⛓ THE PLAYER SLOT ────────────────────────────────────────────────
 *
 * H1 gave the hub `panel.playerId`; this function takes it. With no
 * `playerId` — the pipeline panel's call — it picks the FIRST slot, which is
 * exactly what it always did, so the pipeline path is byte-inert.
 */

import { Grid } from './procgenPipelineEngine.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/**
 * Reconstruct a Grid + composite-view payload from a rules.json that
 * carries `preset_sidecars`. Returns the same shape `growMaze` /
 * `topDownFromRulesJson` produce as their `result` (subset of
 * fields — poolRemaining is unknown post-hoc), so the existing
 * _renderGrid / _renderStats paths can paint it without further
 * branching. Returns null if the input has no procgen data, if the named
 * player slot has none, or if no registered substrate can deserialize any of
 * the regions.
 *
 * Pure function — exported for testing.
 *
 * @param {object} rulesJson the whole document
 * @param {{playerId?: string|number|null}} [opts] which player slot's sidecars
 *   to read. Absent / unknown ⇒ the first slot in the document (v1 behaviour).
 */
export function reconstructResultFromSidecars(rulesJson, { playerId = null } = {}) {
    const sidecarsByPlayer = rulesJson?.preset_sidecars;
    if (!sidecarsByPlayer || typeof sidecarsByPlayer !== 'object') return null;
    const playerKeys = Object.keys(sidecarsByPlayer);
    if (playerKeys.length === 0) return null;
    /**
     * ⛓ The NAMED slot when the document has it, else the first — never a
     * silent slot-1 default. ⚠ A hub whose selector says slot 3 and whose map
     * drew slot 1 would be a readout about a world nobody chose.
     */
    const wanted = playerId == null ? null : String(playerId);
    const playerKey = (wanted != null && playerKeys.includes(wanted)) ? wanted : playerKeys[0];
    const playerSidecars = sidecarsByPlayer[playerKey];
    const regionEntries = Object.entries(playerSidecars ?? {});
    if (regionEntries.length === 0) return null;

    let maxGx = 0;
    let maxGy = 0;
    let maxW = 0;
    let maxH = 0;
    for (const [, sc] of regionEntries) {
        const cell = sc?.grid_cell;
        if (cell) {
            if (cell.gx > maxGx) maxGx = cell.gx;
            if (cell.gy > maxGy) maxGy = cell.gy;
        }
        const payload = sc?.playable_payload || {};
        if (payload.width > maxW) maxW = payload.width;
        if (payload.height > maxH) maxH = payload.height;
    }
    if (maxW === 0 || maxH === 0) return null;

    const grid = new Grid({ width: maxGx + 1, height: maxGy + 1 });
    let placed = 0;
    let teleporters = 0;
    for (const [region_id, sc] of regionEntries) {
        if (!sc?.grid_cell) continue;
        const substrateId = sc.substrate ?? 'maze';
        const adapter = substrateRegistry.get(substrateId);
        if (!adapter || typeof adapter.deserializeWorld !== 'function') continue;
        const world = adapter.deserializeWorld(sc.playable_payload);
        if (world?.exits) {
            for (const e of world.exits.values()) {
                if (e.isTeleporter) teleporters += 1;
            }
        }
        grid.placeRegion(sc.grid_cell, {
            region_id,
            substrate: substrateId,
            render_hint: sc.render_hint ?? substrateId,
            playable_payload: world,
            grow_telemetry: sc.grow_telemetry ?? null,
        });
        placed += 1;
    }
    if (placed === 0) return null;

    const meta = rulesJson.procgen_metadata ?? {};
    return {
        grid,
        regionSize: { width: maxW, height: maxH },
        stats: {
            regionsBuilt: placed,
            regionsSkipped: 0,
            stopReason: meta.stop_reason ?? null,
            teleportersPlaced: teleporters,
        },
        poolRemaining: null,
        // Marker for the renderers that this view came from a loaded
        // rules.json rather than a fresh pipeline run, so labels can
        // signal that and we don't claim a fresh-generation pool stat.
        fromLoadedPreset: true,
        // ⛓ Which slot the grid above actually came from — the hub prints it,
        // and a caller that asked for a slot the document does not have can
        // see that it got a different one.
        playerId: playerKey,
    };
}
