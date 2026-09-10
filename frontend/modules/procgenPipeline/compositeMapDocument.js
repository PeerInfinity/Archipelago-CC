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

import { Grid, DEFAULT_REGION_SIZE } from './procgenPipelineEngine.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/**
 * ⛓⛓⛓ **THE CELL SIZE, AND WHERE IT COMES FROM** (PRESET SIDECARS M0).
 *
 * Until M0 there was one rule and no fallback: the cell was the max
 * `playable_payload.width`/`height` in TILES over the slot's entries, and a slot
 * where that max stayed 0 returned null *before placing a single region*. That
 * is a rule about TILE-GRID substrates, applied to every substrate — so a
 * bounce / runner / jta / omsi slot whose every region carried a `grid_cell`
 * drew nothing, and the hub said "no map for this world" about a document that
 * plainly has a layout.
 *
 * MEASURED at `0fa53f7d06` over the 42 populated slots of the committed corpus
 * (`git ls-files frontend/presets | grep _rules.json$`, one call per slot):
 * 26 grids, **16 nulls**, of which only **4** carry no `grid_cell` on any entry.
 * The renderer was never the limit — `compositeMapRenderer.drawRegionCell`
 * already paints a substrate that declares no `compositeMap.drawRegion` through
 * `drawGenericRegion` (a labelled zone box with its exit squares), which is what
 * the pipeline panel shows for the same regions, sized by the DRIVER's
 * `config.regionSize`. A LOADED document has no driver, so it needs the
 * precedence below.
 *
 * The three steps, in order, each returned as `regionSizeSource` so a reader can
 * say which one fired instead of computing it a second time:
 *
 * 1. `'payload'` — the max `width`/`height` over the slot's payloads. Today's
 *    rule, unchanged where it fires: all 26 slots that drew before still draw
 *    the same cell (22×20 for the big `procgen_topdown` documents, 8×6 / 20×20
 *    for the rest).
 * 2. `'declared'` — a `compositeMap.cellSize` on the registry entry of a
 *    substrate PLACED in this slot, per axis max where more than one declares.
 *    ⛔ **No substrate declares one** as of M0, deliberately: nothing measured
 *    needs a size other than the default, and a declaration nobody needs is a
 *    hand list of substrate names wearing a registry hat. This is the seam for
 *    the first substrate that does.
 * 3. `'default'` — `DEFAULT_REGION_SIZE`, the engine's own, read from the module
 *    that owns it so this file and `rebuildEnvelopeFromRulesJson` cannot drift.
 *
 * ⛔ The null rule moved with it: a slot returns null when **no region could be
 * placed** — no `grid_cell` on any entry, or no registered substrate able to
 * deserialize one — which is the check that was already there at the end of the
 * placement loop. The `maxW === 0` gate in front of it is gone.
 *
 * ⚠ **`procgen_metadata.grid_dims` is NOT consulted**, and the measurement is
 * why: the brief asked for it where it exceeds the `grid_cell` extents, so a
 * sparse layout would keep its empty cells. Over the same 42 slots, **25 carry
 * `grid_dims` and 0 of them exceed the extents** — no committed document can
 * tell the two rules apart, so the extents rule stands and the branch nothing
 * would exercise was not written.
 */
function cellSizeFor(entries) {
    let maxW = 0;
    let maxH = 0;
    let declW = 0;
    let declH = 0;
    for (const [, sc] of entries) {
        const payload = sc?.playable_payload || {};
        if (payload.width > maxW) maxW = payload.width;
        if (payload.height > maxH) maxH = payload.height;
        if (!sc?.grid_cell) continue;
        const declared = substrateRegistry.get(sc.substrate)?.compositeMap?.cellSize;
        if (Number.isFinite(declared?.width) && declared.width > declW) declW = declared.width;
        if (Number.isFinite(declared?.height) && declared.height > declH) declH = declared.height;
    }
    if (maxW > 0 && maxH > 0) {
        return { regionSize: { width: maxW, height: maxH }, regionSizeSource: 'payload' };
    }
    if (declW > 0 && declH > 0) {
        return { regionSize: { width: declW, height: declH }, regionSizeSource: 'declared' };
    }
    return { regionSize: { ...DEFAULT_REGION_SIZE }, regionSizeSource: 'default' };
}

/**
 * Reconstruct a Grid + composite-view payload from a rules.json that
 * carries `preset_sidecars`. Returns the same shape `growMaze` /
 * `topDownFromRulesJson` produce as their `result` (subset of
 * fields — poolRemaining is unknown post-hoc), so the existing
 * _renderGrid / _renderStats paths can paint it without further
 * branching. Returns null if the input has no procgen data, if the named
 * player slot has none, or if no region could be PLACED — no `grid_cell` on any
 * entry, or no registered substrate able to deserialize one. It no longer
 * returns null for a slot whose payloads carry no tile geometry; see
 * `cellSizeFor` for the size such a slot's cells get.
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
    for (const [, sc] of regionEntries) {
        const cell = sc?.grid_cell;
        if (cell) {
            if (cell.gx > maxGx) maxGx = cell.gx;
            if (cell.gy > maxGy) maxGy = cell.gy;
        }
    }
    // ⛓ M0 — the cell's size, and which of the three rules gave it. See the
    //   docblock on `cellSizeFor`; the `maxW === 0 ⇒ null` gate that used to
    //   stand here is gone, and `placed === 0` below is the only null rule left.
    const { regionSize, regionSizeSource } = cellSizeFor(regionEntries);

    const grid = new Grid({ width: maxGx + 1, height: maxGy + 1 });
    let placed = 0;
    let teleporters = 0;
    for (const [region_id, sc] of regionEntries) {
        if (!sc?.grid_cell) continue;
        // ⛓ H3b: the `?? 'maze'` that used to end this line is GONE.
        // MEASURED 2026-09-05 over all 205 committed rules.json: 1,360 of 1,360
        // sidecar entries carry `substrate`, so the fallback never fired — and
        // where it COULD fire (a hand-written document), guessing 'maze' paints
        // some other substrate's payload as a maze grid instead of skipping the
        // region, which is what the next line already does for a substrate with
        // no registered deserializer. The renderer's twin fallback went in H3
        // (§13) for the same reason; this was the last one on the map path.
        const substrateId = sc.substrate;
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
            // ⛓ H4a: the region's exits at the TOP LEVEL, which is where the
            // renderer's connection pass and its exit-selection highlight look
            // (`exitsOf(region)` = `region?.exits`, mirroring the engine's own
            // `getRegionExits`). The engine's placements have always set this
            // (`procgenPipelineEngine.js:3970`); this reader did not, so a
            // LOADED document drew cells and their in-cell exit squares but NO
            // inter-region connection lines. Found by H3 (plan §13.1 #6) and
            // left for a slice that was allowed to move the picture.
            // MEASURED on `procgen_maze` seed 1: 0 → 2 connection lines (3 regions).
            exits: world.exits,
            grow_telemetry: sc.grow_telemetry ?? null,
        });
        placed += 1;
    }
    if (placed === 0) return null;

    const meta = rulesJson.procgen_metadata ?? {};
    return {
        grid,
        regionSize,
        // ⛓ M0 — WHICH of the three rules sized that cell ('payload' |
        //   'declared' | 'default'). A reader that wants to say "the engine's
        //   default, because this world stores no tile geometry" must not
        //   re-derive it: a second spelling of the precedence is a second thing
        //   to keep in step.
        regionSizeSource,
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
