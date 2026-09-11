/**
 * apworldEditor/regionLayout — **A REGION MOVED OR SWAPPED ON THE MAP: WHAT THE
 * DOCUMENT HAS TO SAY AFTERWARDS** (PRESET SIDECARS M2;
 * `NewDocs/plans/preset-sidecars-plan.md` §7.2, §9.2 ⚖ option A, §18).
 *
 * The ops are `move-region` / `swap-regions` in `rulesDocOps.js` — the op is the
 * authority, and every refusal SENTENCE lives there. This module is the part of
 * them that needs the pipeline ENGINE (its `Grid`, its mutators, its side law)
 * and the substrate REGISTRY (each payload's own serializer), which the op file
 * does not import directly.
 *
 * ── ⛓⛓⛓ WHAT A MOVE REWRITES, AND WHAT IT NEVER TOUCHES ─────────────────
 *
 * A region's LINKS are logical: `regions[p][r].exits[].connected_region`, and
 * inside the payload each exit's `targetRegion` / `targetExitId`. A move changes
 * none of them — the region is the same region, connected to the same
 * neighbours, on the same sides. What a move changes is WHERE it sits:
 *
 *   · `preset_sidecars[p][r].grid_cell` of every region that changed cell;
 *   · `playable_payload.exits[].isTeleporter` of every exit whose link stopped
 *     (or started) being adjacent on its side — in the payload of the region
 *     that owns the exit, forward AND back exits alike.
 *
 * Nothing else. ⛔ `regions[p]` is not read for writing at all.
 *
 * ── ⛓⛓ WHY NOT `relayoutSphereGrid` (measured, §18.1) ──────────────────
 *
 * The brief asked for reconstruct → engine mutator → relayout → re-serialize.
 * Measured over the 38 committed slots with `grid_cell`s:
 *   · on the reconstruction as the Map builds it the relayout writes NOTHING to
 *     a payload exit — `stitchGrid` walks `exits_placed` / `extracted_rules`,
 *     which a document does not carry — so a move would change no flag;
 *   · given those fields, a NO-OP relayout RE-TARGETS 520 maze exits on 154
 *     regions (`Grid.teleporters` is keyed `cell:side`, one target per side) and
 *     never updates a back-exit.
 * ⇒ the engine's `moveSphereRegion` / `swapSphereRegions` do the PLACEMENT (on a
 * grid of name-only stubs, where their relayout has no exit to touch), and each
 * exit's flag follows `linkIsAdjacentOnSide` — the engine's own side law, the one
 * `relayoutSphereGrid` decides with, which reproduces every stored flag in the
 * corpus but two hand-authored diagonals.
 *
 * ── ⛓⛓ ONLY A VERDICT THE MOVE CHANGED IS WRITTEN ───────────────────────
 *
 * An exit is re-judged only when its own region or its target moved, and its
 * flag is written only when the side law's verdict BEFORE the move differs from
 * the verdict AFTER. A stored flag the law would dispute (those two diagonals)
 * is left exactly as the document holds it unless the move changes its answer:
 * a move is not a licence to re-flag links it did not move.
 *
 * ── ⛓⛓ THE WRITE-BACK IS THE SERIALIZER'S FORM ──────────────────────────
 *
 * A payload whose exits changed is deserialized by its substrate, the flags set
 * on the WORLD's exit objects, and serialized again by the same substrate; only
 * the serialized `exits` list is written back (a whole-payload re-serialize
 * moves bytes on every maze and text-adventure region — their `locationName`s
 * come from `extracted_rules`, which a document does not carry). The corpus
 * control (`regionLayout.test.js`) runs this path with NO flags over every
 * committed entry and must move 0 bytes — the proof the round trip of `exits`
 * is byte-stable, per substrate.
 */

import {
    Grid, linkIsAdjacentOnSide, moveSphereRegion, swapSphereRegions,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { mapBoundsFor } from '../procgenPipeline/compositeMapDocument.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/** ⛓ The sides a payload exit can carry, as the words a description uses. The
 *  keys are the engine's `SIDE_DELTAS`' (measured: every committed exit's side
 *  is one of these four). */
export const SIDE_WORDS = Object.freeze({ N: 'north', S: 'south', E: 'east', W: 'west' });

/**
 * ⛓⛓ **THE NAMED RULE FOR A PAYLOAD WITH NO `exits` KEY.** The pass-through
 * serializers emit `exits: []` for a payload that carries none (measured: the
 * one such committed entry, `jta_mixed_test`'s `JtaZone1`). A payload with no
 * exit records has no link to flag, so the write-back leaves the key absent
 * rather than adding an empty list nobody asked for.
 */
export const NO_EXITS_KEY_KEPT_ABSENT =
    'a payload that carries no `exits` key has no link to flag, so it keeps carrying none';

/** ⛓ A usable `grid_cell`: two whole, non-negative numbers. */
export const isGridCell = (c) => !!c && Number.isInteger(c.gx) && Number.isInteger(c.gy)
    && c.gx >= 0 && c.gy >= 0;

/**
 * ⛓⛓ **ONE SLOT'S LAYOUT, READ OFF THE DOCUMENT.** Every entry with a usable
 * `grid_cell`, on a `Grid` sized by `mapBoundsFor` — the ONE bounds rule, the
 * one the Map's reconstruction draws with (⚖ planner, M2: the larger of the
 * cells' extents and `procgen_metadata.grid_dims`) — holding a name-only stub
 * per cell.
 *
 * ⚠ The DOCUMENT's cells, not the reconstruction's placements: the Map skips a
 * region whose substrate is not registered, but its cell is still occupied in
 * the document, and a move onto it must be refused as one.
 *
 * @returns {{cells: Map<string,{gx,gy}>, grid: Grid|null,
 *            clash: {a: string, b: string, cell: {gx,gy}}|null}}
 */
export function slotLayout(doc, player) {
    const cells = new Map();
    const entries = Object.entries(doc?.preset_sidecars?.[player] ?? {});
    for (const [name, entry] of entries) {
        const c = entry?.grid_cell;
        if (isGridCell(c)) cells.set(name, { gx: c.gx, gy: c.gy });
    }
    if (cells.size === 0) return { cells, grid: null, clash: null };
    const { width, height } = mapBoundsFor(doc, entries);
    const grid = new Grid({ width, height });
    for (const [name, cell] of cells) {
        if (grid.hasRegion(cell)) {
            return { cells, grid, clash: { a: grid.getRegion(cell).region_id, b: name, cell } };
        }
        grid.placeRegion(cell, { region_id: name });
    }
    return { cells, grid, clash: null };
}

/** ⛓ The region at `cell` in a layout, or null. */
export function occupantAt(layout, cell) {
    return layout.grid?.getRegion(cell)?.region_id ?? null;
}

const sameCell = (a, b) => !!a && !!b && a.gx === b.gx && a.gy === b.gy;

/**
 * ⛓⛓⛓ **THE MOVE, AND EVERY EXIT FLAG IT CHANGES.** `change` is
 * `{kind: 'move', region, to}` or `{kind: 'swap', a, b}`; the caller (the op)
 * has already refused every input it can refuse, so the engine's mutators do
 * not throw here — they place.
 *
 * @returns {{after: Map<string,{gx,gy}>, moved: string[],
 *            flips: Array<{region, exitId, side, target, targetExitId, teleporter}>}}
 *   `moved` in the document's entry order; `flips` in entry order, then exit
 *   order — `teleporter` is the flag AFTER the move.
 */
export function layoutChange(doc, player, layout, change) {
    const { grid, cells: before } = layout;
    if (change.kind === 'move') moveSphereRegion(grid, before.get(change.region), change.to);
    else swapSphereRegions(grid, before.get(change.a), before.get(change.b));
    const after = new Map(grid.allRegions().map((r) => [r.region_id, r.cell]));

    const sidecars = doc.preset_sidecars[player];
    const moved = [...before.keys()].filter((n) => !sameCell(before.get(n), after.get(n)));
    const movedSet = new Set(moved);
    const flips = [];
    for (const [name, entry] of Object.entries(sidecars)) {
        if (!before.has(name)) continue;
        const exits = entry?.playable_payload?.exits;
        if (!Array.isArray(exits)) continue;
        for (const x of exits) {
            if (!x || !Object.hasOwn(SIDE_WORDS, x.side) || typeof x.targetRegion !== 'string') continue;
            if (!before.has(x.targetRegion)) continue;
            if (!movedSet.has(name) && !movedSet.has(x.targetRegion)) continue;
            const was = linkIsAdjacentOnSide(grid, before.get(name), x.side, before.get(x.targetRegion));
            const now = linkIsAdjacentOnSide(grid, after.get(name), x.side, after.get(x.targetRegion));
            if (was === now) continue;
            flips.push({
                region: name, exitId: x.exit_id, side: x.side, target: x.targetRegion,
                targetExitId: x.targetExitId ?? null, teleporter: !now,
            });
        }
    }
    return { after, moved, flips };
}

/**
 * ⛓⛓⛓ **ONE PAYLOAD'S `exits`, REWRITTEN BY ITS OWN SUBSTRATE.** `flags` maps
 * an exit id to the `isTeleporter` it must carry; an empty map is the corpus
 * control's no-op.
 *
 * ⛔ The payload is CLONED before it is deserialized: the pass-through
 * deserializers keep the payload's own exit objects in their Map, so setting a
 * flag on the world would write THROUGH the document being edited.
 *
 * @returns {{exits: object[]} | {absent: true} | {unwritable: string}}
 *   `unwritable` names what is missing (no registered substrate, no
 *   serializer) — the op words the refusal.
 */
export function rewriteExitFlags(entry, flags) {
    const payload = entry?.playable_payload;
    if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'exits')) {
        return { absent: true };
    }
    const reg = substrateRegistry.get(entry.substrate);
    if (!reg) return { unwritable: 'no module registers it here' };
    if (typeof reg.deserializeWorld !== 'function' || typeof reg.serializeWorld !== 'function') {
        return { unwritable: 'its registry entry declares no `deserializeWorld` / `serializeWorld` pair' };
    }
    const world = reg.deserializeWorld(JSON.parse(JSON.stringify(payload)));
    const list = world?.exits instanceof Map ? [...world.exits.values()] : (world?.exits ?? []);
    for (const e of list) {
        if (flags.has(e?.exit_id)) e.isTeleporter = flags.get(e.exit_id);
    }
    return { exits: reg.serializeWorld(world).exits };
}

/**
 * ⛓ The flips, PAIRED into links: an exit and its reciprocal (the flipped exit
 * of its target that leads back — `targetExitId` first, else the first one that
 * leads back) are ONE link. An exit with no flipped reciprocal is a one-way link.
 *
 * @returns {Array<{from: {region, side}, to: {region, side}, teleporter}>} a one-way
 *   link's `to.side` is null (its target has no flipped exit leading back).
 */
export function pairLinkFlips(flips) {
    const used = new Set();
    const links = [];
    flips.forEach((f, i) => {
        if (used.has(i)) return;
        used.add(i);
        const back = (g, j) => !used.has(j) && g.region === f.target && g.target === f.region
            && g.teleporter === f.teleporter;
        let j = flips.findIndex((g, k) => back(g, k)
            && (f.targetExitId === g.exitId || g.targetExitId === f.exitId));
        if (j < 0) j = flips.findIndex(back);
        if (j >= 0) used.add(j);
        links.push({
            from: { region: f.region, side: f.side },
            to: j >= 0 ? { region: flips[j].region, side: flips[j].side } : { region: f.target, side: null },
            teleporter: f.teleporter,
        });
    });
    return links;
}
