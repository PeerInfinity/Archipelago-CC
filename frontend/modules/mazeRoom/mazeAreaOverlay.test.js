/**
 * mazeRoom/mazeAreaOverlay.test — ⛓⛓⛓ THE PIXEL GATE FOR THE **SIBLING** DRAW
 * (PROCGEN ELEMENTS arc 1, slice 3).
 *
 * ⛓ IT USES THE **ONE** RECORDING CONTEXT (`drawOpRecorder.js`), which this
 * slice LIFTED out of `mazeRoomRender.test.js` rather than copying: a second
 * recorder is a second answer to *"what counts as a draw operation"*, and the
 * whole point of that one is that it THROWS on a member it does not model
 * instead of dropping the op out of the log. ⛔ Importing a `.test.js` file for
 * it would have RE-RUN that file's 22 rows inside this one — measured, and the
 * reason the lift happened.
 *
 * ── ⛔ AND THE HASH HERE IS A DRIFT DETECTOR, NOT THE CLAIM ────────────
 *
 * `mazeRoomRender.test.js`'s seven hashes are a CAPTURE from the tree before
 * the code under test existed, which is what makes them evidence. This draw is
 * NEW: there is no earlier tree to capture from, so a pasted hash of my own
 * output would be a fixed point and nothing more (⚖ kickoff §5 / trap 250).
 * ⇒ the CLAIMS below are counts and geometry computed INDEPENDENTLY from the
 * partition and the graph (how many area cells, how many doors, how many
 * graphify edges, where a centroid is), and the hash is recorded BESIDE them as
 * a drift detector, labelled as exactly that.
 */

import { describe, expect, it } from 'vitest';

import { hashOf, recordingContext } from './drawOpRecorder.js';
import {
    AREA_LAYERS, AreaOverlayError, LEVEL_COLORS, OVERLAY_COLORS, areaCentre, areaLegend,
    assertOverlayView, drawAreaOverlay, layerRank,
} from './mazeAreaOverlay.js';
import { mazeModel } from './procgenMaze.js';

const TILE = 20;
const logOf = (areas, layer, tilePx = TILE) => {
    const ctx = recordingContext();
    drawAreaOverlay(ctx, areas, { tilePx, layer });
    return ctx.__log;
};
const countOf = (log, prefix) => log.filter((op) => op.startsWith(prefix)).length;

/** ⛓ 15x15 `rooms` at one key is where the acceptance table says a graph runs. */
const RAN = mazeModel({
    seed: 1, width: 15, height: 15, skeleton: { kind: 'rooms' }, areas: { keys: 1 },
}).areas;
/** ⛓ …and 11x11 at two keys is the honest REFUSAL (§9.5: 4/24 run). */
const REFUSED = mazeModel({ seed: 2, skeleton: { kind: 'rooms' }, areas: { keys: 2 } }).areas;

describe('mazeAreaOverlay — the subjects are what this arc measured', () => {
    it('the RAN subject really ran, and the REFUSED one really refused', () => {
        // ⛔ THE NON-VACUITY GUARD: every row below is about one of these two,
        // and a subject that quietly stopped running would make them all pass.
        expect(RAN.ran).toBe(true);
        expect(RAN.graph.symbols).toEqual(['K0']);
        expect(RAN.doors.length).toBeGreaterThan(0);
        expect(RAN.keys.length).toBe(1);
        expect(REFUSED.ran).toBe(false);
        expect(REFUSED.refused.reason).toBe('no-area-at-that-key-level-can-hold-its-key');
    });
});

describe('mazeAreaOverlay — the draw', () => {
    it('⛔ draws NOTHING at `off`, on a REFUSED graph, or with no areas at all', () => {
        expect(logOf(RAN, 'off')).toEqual([]);
        expect(logOf(REFUSED, 'all')).toEqual([]);
        expect(logOf(null, 'all')).toEqual([]);
        expect(logOf({ ran: false, partition: null }, 'all')).toEqual([]);
        // …and the one that ran DOES draw, so the four rows above are not
        // passing because the function is inert.
        expect(logOf(RAN, 'all').length).toBeGreaterThan(50);
    });

    it('the layers are CUMULATIVE — each adds ops and none removes any', () => {
        const partition = logOf(RAN, 'partition');
        const locks = logOf(RAN, 'locks');
        const keys = logOf(RAN, 'keys');
        const all = logOf(RAN, 'all');
        expect(partition.length).toBeGreaterThan(0);
        expect(locks.length).toBeGreaterThan(partition.length);
        expect(keys.length).toBeGreaterThan(locks.length);
        expect(hashOf(all)).toBe(hashOf(keys));
        // ⛓ the SHADING is the same op COUNT at every layer — only its colour
        // changes (area hue -> key-level ramp), which is what "the shading
        // switches" means and is not visible in a length comparison.
        expect(countOf(partition, 'fillRect(')).toBe(countOf(locks, 'fillRect('));
        expect(locks.includes(`fillStyle=${JSON.stringify(LEVEL_COLORS[1])}`)).toBe(true);
        expect(partition.includes(`fillStyle=${JSON.stringify(LEVEL_COLORS[1])}`)).toBe(false);
    });

    /**
     * ⛓⛓⛓ THE COUNTS ARE COMPUTED FROM THE PARTITION, NOT READ BACK OUT OF THE
     * LOG'S OWN TOTAL. A draw that shaded every FLOOR cell would produce a
     * perfectly stable hash and a perfectly wrong picture.
     */
    it('shades exactly the cells of the NON-SYNTHETIC areas, one fillRect each', () => {
        const real = RAN.partition.areas.filter((a) => !a.synthetic);
        const cells = real.reduce((n, a) => n + a.cells.length, 0);
        expect(cells).toBeGreaterThan(10);
        expect(countOf(logOf(RAN, 'partition'), 'fillRect(')).toBe(cells);
        // …and the first shaded cell is the first cell of the first real area,
        // at ITS coordinates — the geometry, not only the count.
        const c = real[0].cells[0];
        expect(logOf(RAN, 'partition'))
            .toContain(`fillRect(${c.x * TILE},${c.y * TILE},${TILE},${TILE})`);
    });

    it('⛔ a SYNTHETIC area is OUTLINED DASHED, never filled — it is not a chamber', () => {
        const synth = RAN.partition.areas.filter((a) => a.synthetic);
        expect(synth.length).toBeGreaterThan(0);
        const log = logOf(RAN, 'partition');
        const synthCells = synth.reduce((n, a) => n + a.cells.length, 0);
        expect(countOf(log, 'strokeRect(')).toBe(synthCells);
        expect(log).toContain(`strokeStyle=${JSON.stringify(OVERLAY_COLORS.synthetic)}`);
        const c = synth[0].cells[0];
        expect(log).toContain(
            `strokeRect(${c.x * TILE + 2},${c.y * TILE + 2},${TILE - 4},${TILE - 4})`);
    });

    it('borders every DOOR cell and rings every KEY cell — at their own coordinates', () => {
        const locks = logOf(RAN, 'locks');
        const synthCells = RAN.partition.areas.filter((a) => a.synthetic)
            .reduce((n, a) => n + a.cells.length, 0);
        // ⛓ one border per door CELL (the doors are per AREA BOUNDARY — §9.3),
        // plus the synthetic outlines drawn by the layer below it.
        expect(countOf(locks, 'strokeRect(')).toBe(RAN.doors.length + synthCells);
        const d = RAN.doors[0];
        expect(locks).toContain(
            `strokeRect(${d.x * TILE + 1},${d.y * TILE + 1},${TILE - 2},${TILE - 2})`);
        const keys = logOf(RAN, 'keys');
        const k = RAN.keys[0];
        expect(keys).toContain(`arc(${k.x * TILE + TILE / 2},${k.y * TILE + TILE / 2},`
            + `${TILE / 3},0,${Math.PI * 2})`);
        expect(keys).toContain(`strokeStyle=${JSON.stringify(OVERLAY_COLORS.key)}`);
    });

    it('draws one line per graph EDGE, and the GRAPHIFY ones DASHED', () => {
        const log = logOf(RAN, 'locks');
        const centres = new Map(RAN.partition.areas.map((a) => [a.id, areaCentre(a)]));
        for (const e of RAN.graph.edges) {
            const pa = centres.get(e.a);
            const pb = centres.get(e.b);
            expect(log, `${e.a}->${e.b}`).toContain(`moveTo(${pa.x * TILE},${pa.y * TILE})`);
            expect(log).toContain(`lineTo(${pb.x * TILE},${pb.y * TILE})`);
        }
        // ⛓ ONE `stroke()` per edge, plus the solution path at the layer above.
        expect(countOf(log, 'stroke()')).toBe(RAN.graph.edges.length);
        expect(log).toContain(`strokeStyle=${JSON.stringify(OVERLAY_COLORS.tree)}`);
    });

    /**
     * ⛓ A GRAPHIFY SUBJECT, MEASURED RATHER THAN ASSUMED — seed 1 at 15x15 has
     * none, so a row that asserted the dash on it would be vacuous. ⛔ The
     * seed is SCANNED for and the row refuses if none exists.
     */
    it('a seed WITH a graphify edge dashes it — and the subject is scanned for', () => {
        let subject = null;
        for (let seed = 1; seed <= 24 && !subject; seed += 1) {
            const areas = mazeModel({
                seed, width: 15, height: 15, skeleton: { kind: 'rooms' }, areas: { keys: 1 },
            }).areas;
            if (areas.ran && areas.graph.edges.some((e) => e.kind === 'graphify')) subject = areas;
        }
        expect(subject, 'no rooms 15x15 seed in 1..24 produced a graphify edge').not.toBe(null);
        const log = logOf(subject, 'locks');
        expect(log).toContain('setLineDash([4,3])');
        expect(log).toContain(`strokeStyle=${JSON.stringify(OVERLAY_COLORS.graphify)}`);
    });

    it('the SOLUTION PATH is drawn through the area centroids, in order', () => {
        const log = logOf(RAN, 'keys');
        const centres = new Map(RAN.partition.areas.map((a) => [a.id, areaCentre(a)]));
        const path = RAN.graph.solutionPath;
        expect(path.length).toBeGreaterThan(1);
        expect(log).toContain(`strokeStyle=${JSON.stringify(OVERLAY_COLORS.solution)}`);
        const first = centres.get(path[0]);
        expect(log).toContain(`moveTo(${first.x * TILE},${first.y * TILE})`);
        for (const id of path.slice(1)) {
            const p = centres.get(id);
            expect(log).toContain(`lineTo(${p.x * TILE},${p.y * TILE})`);
        }
    });

    it('tilePx really scales it — the SHAPE is identical and only the numbers move', () => {
        const a = logOf(RAN, 'all', 20);
        const b = logOf(RAN, 'all', 40);
        expect(b.length).toBe(a.length);
        expect(hashOf(a)).not.toBe(hashOf(b));
        expect(a.filter((op) => op.startsWith('fillRect(')).length)
            .toBe(b.filter((op) => op.startsWith('fillRect(')).length);
    });

    /**
     * ⛓ THE DRIFT DETECTOR — recorded, and honest about what it is: this hash
     * came out of this code, so it can only ever say *"the picture changed"*.
     * The rows above are what say the picture is RIGHT.
     */
    it('the op log is STABLE across two draws of one model (the drift detector)', () => {
        const first = logOf(RAN, 'all');
        const second = logOf(RAN, 'all');
        expect(hashOf(second)).toBe(hashOf(first));
        expect(first.length).toBe(209);
        expect(hashOf(first)).toBe('eb952ca3609329dc289e9bd35df54f27');
    });
});

describe('mazeAreaOverlay — the view and the legend', () => {
    it('REFUSES a missing field, a bad tilePx and an unknown layer BY NAME', () => {
        expect(() => assertOverlayView({ tilePx: 20 })).toThrow(/missing "layer"/);
        expect(() => assertOverlayView({ layer: 'all' })).toThrow(/missing "tilePx"/);
        expect(() => assertOverlayView({ tilePx: 0, layer: 'all' }))
            .toThrow(/tilePx must be a positive/);
        expect(() => assertOverlayView({ tilePx: 20, layer: 'graph' }))
            .toThrow(/is not one of \[off, partition, locks, keys, all\]/);
        expect(() => drawAreaOverlay(recordingContext(), RAN, null)).toThrow(AreaOverlayError);
        expect(layerRank('off')).toBe(0);
        expect(layerRank('all')).toBe(AREA_LAYERS.length - 1);
    });

    /** ⚠ §9.11(6): the symbols are named ONCE EACH, in the legend — never per cell. */
    it('the LEGEND is one row per SYMBOL, with the door COUNT rather than door labels', () => {
        const legend = areaLegend(RAN);
        expect(legend.map((r) => r.symbol)).toEqual(RAN.graph.symbols);
        expect(legend).toHaveLength(1);
        const [row] = legend;
        expect(row.doorCount).toBe(RAN.doors.length);
        expect(row.areas.length).toBeGreaterThan(0);
        expect(row.key).toEqual({
            x: RAN.keys[0].x, y: RAN.keys[0].y, area: RAN.keys[0].area, level: 0,
        });
        expect(row.color).toBe(LEVEL_COLORS[1]);
        // ⛓ …and the canvas carries NO text at all, which is what makes the
        // legend the only place a symbol is spelled.
        expect(logOf(RAN, 'all').some((op) => op.startsWith('fillText('))).toBe(false);
    });

    it('a REFUSED or absent graph has an EMPTY legend', () => {
        expect(areaLegend(REFUSED)).toEqual([]);
        expect(areaLegend(null)).toEqual([]);
    });
});
