/**
 * procgenLedger + `seedlingModel.ledger` — **THE GENERATION LEDGER** (PROCGEN
 * ELEMENTS arc 3, slice 5a, D3).
 *
 * ⛔ THE THREE THINGS THESE ROWS ARE FOR:
 *  1. the ledger is written BY the phase, in the order the phases RUN (trap
 *     357: a constant list of names is a second spelling of the pipeline's
 *     order, and the two drift);
 *  2. the deltas FOLD back to the room the model actually built;
 *  3. recording is BYTE-INERT — the spy arm (`ledger:false`) is the control.
 */

import { describe, expect, it } from 'vitest';

import {
    LedgerError, foldLedger, makeLedger, paintable, phaseRow, terrainSnapshot,
} from './procgenLedger.js';
import { emptyLevel, terrainAt, withTerrain } from './procgenLevel.js';
import { seedlingModel, seedlingSeam, seedlingSkeletonSpec } from './procgenSeedling.js';

describe('procgenLedger — the paintable', () => {
    it('normalizes {tx,ty} and {x,y} to one shape, and counts', () => {
        const p = paintable({ id: 'a', label: 'two cells', kind: 'cells',
            cells: [{ x: 1, y: 2 }, { tx: 3, ty: 4 }], pick: { tx: 3, ty: 4 } });
        expect(p.cells).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
        expect(p.pick).toEqual({ x: 3, y: 4 });
        expect(p.count).toBe(2);
    });

    /**
     * ⛔ THE REFUSAL IS HERE AND NOT IN THE PAINTER. A fact the page cannot
     * paint must fail where it is RECORDED — in a test run — rather than on
     * somebody's screen when they tick its line.
     */
    it('REFUSES a kind it cannot paint, a missing label and a malformed cell', () => {
        expect(() => paintable({ id: 'a', label: 'x', kind: 'sparkles', cells: [] }))
            .toThrow(/not one of \[cells, outline, path, flood\]/);
        expect(() => paintable({ id: 'a', label: '', kind: 'cells', cells: [] }))
            .toThrow(/needs a label — it IS the line the reader selects/);
        expect(() => paintable({ id: 'a', label: 'x', kind: 'cells', cells: [{ x: 1 }] }))
            .toThrow(/neither \{x,y\} nor \{tx,ty\}/);
        expect(() => paintable({ id: '', label: 'x', kind: 'cells', cells: [] }))
            .toThrow(LedgerError);
    });
});

describe('procgenLedger — the appender', () => {
    const blank = () => emptyLevel({ level: 900, width: 10, height: 10 });

    it('⛓ terrainSnapshot reads the tiles layer ONCE and agrees with terrainAt', () => {
        const rec = withTerrain(blank(), [{ tx: 4, ty: 4, terrain: 'water' }]);
        const snap = terrainSnapshot(rec);
        for (let ty = 0; ty < rec.height; ty += 1) {
            for (let tx = 0; tx < rec.width; tx += 1) {
                expect(snap[tx + ty * rec.width]).toBe(terrainAt(rec, tx, ty));
            }
        }
    });

    it('⛓ the delta is against the PREVIOUS row, and the first row is the whole room', () => {
        const L = makeLedger({ width: 10, height: 10 });
        const a = blank();
        L.phase('one', { sentence: 'the room', draws: 1, record: a, entities: [] });
        L.phase('two', { sentence: 'one wall', draws: 4,
            record: withTerrain(a, [{ tx: 4, ty: 4, terrain: 'wall' }]), entities: [] });
        const rows = L.rows();
        expect(rows[0].tiles.changed.length).toBe(100);
        expect(rows[1].tiles.changed).toEqual([{ x: 4, y: 4, from: 'ground', to: 'wall' }]);
        /** ⛓ AND THE DRAW SPANS CHAIN — each row starts where the last ended. */
        expect(rows[0].draws).toEqual({ before: 0, after: 1 });
        expect(rows[1].draws).toEqual({ before: 1, after: 4 });
    });

    it('⛓ entities are added and removed by identity — type, cell AND attributes', () => {
        const L = makeLedger({ width: 10, height: 10 });
        const lock = (tag) => ({ type: 'lock', x: 16, y: 16, attrs: { tag } });
        L.phase('a', { sentence: 'a lock', draws: 0, entities: [lock('3')] });
        L.phase('b', { sentence: 'a different lock', draws: 0, entities: [lock('4')] });
        const rows = L.rows();
        expect(rows[1].entities.added).toEqual([lock('4')]);
        expect(rows[1].entities.removed).toEqual([lock('3')]);
    });

    it('⛔ a row with no SENTENCE refuses — the page can only show what the phase said', () => {
        const L = makeLedger({ width: 10, height: 10 });
        expect(() => L.phase('x', { draws: 0 })).toThrow(/recorded no SENTENCE/);
    });

    it('⛔ recording OFF appends nothing at all', () => {
        const L = makeLedger({ width: 10, height: 10, enabled: false });
        L.phase('one', { sentence: 'the room', draws: 1, record: blank(), entities: [] });
        expect(L.rows()).toEqual([]);
    });

    it('⛓ phaseRow builds the SAME shape with both deltas empty', () => {
        const r = phaseRow({ index: 7, phase: 'certification', sentence: 'it held', draws: 9 });
        expect(r.tiles.changed).toEqual([]);
        expect(r.entities.added).toEqual([]);
        expect(r.draws).toEqual({ before: 9, after: 9 });
        expect(r.data.facts).toEqual([]);
    });

    it('⛓ foldLedger rebuilds the room as of phase k', () => {
        const L = makeLedger({ width: 10, height: 10 });
        const a = blank();
        L.phase('one', { sentence: 'the room', draws: 0, record: a, entities: [] });
        L.phase('two', { sentence: 'a wall', draws: 0,
            record: withTerrain(a, [{ tx: 4, ty: 4, terrain: 'wall' }]),
            entities: [{ type: 'torchpickup', x: 80, y: 80 }] });
        const rows = L.rows();
        const at0 = foldLedger(rows, 0, { width: 10, height: 10 });
        const at1 = foldLedger(rows, 1, { width: 10, height: 10 });
        expect(at0.terrain.find((t) => t.tx === 4 && t.ty === 4).terrain).toBe('ground');
        expect(at1.terrain.find((t) => t.tx === 4 && t.ty === 4).terrain).toBe('wall');
        expect(at0.entities).toEqual([]);
        expect(at1.entities).toEqual([{ type: 'torchpickup', x: 80, y: 80 }]);
        /** ⛓ A k past the end is the LAST row, not a throw — the page's slider
         *  can sit on the end of a ledger that shrank. */
        expect(foldLedger(rows, 99, { width: 10, height: 10 }).terrain)
            .toEqual(at1.terrain);
        expect(() => foldLedger(rows, -1, { width: 10, height: 10 }))
            .toThrow(/not a non-negative integer/);
    });
});

describe('seedlingModel.ledger — the rows the phases actually wrote', () => {
    /**
     * ⛔ THE ORDER IS THE PIPELINE'S, AND THE ROWS ARE A **SUBSEQUENCE** OF IT.
     * The literal below is this file's own anchor (a test may state one; the
     * production code may not — trap 357). A phase that is not REACHED writes
     * NO row, which is what makes the omission visible rather than silent.
     */
    const PIPELINE = ['goal', 'element-head', 'pre-carve', 'carve', 'on-connector',
        'composite', 'partition', 'graph', 'realisation'];
    const isSubsequence = (rows) => {
        let i = 0;
        for (const name of rows) {
            const at = PIPELINE.indexOf(name, i);
            if (at < 0) return false;
            i = at;
        }
        return true;
    };

    it('⛓⛓⛓ every configuration writes a SUBSEQUENCE of the pipeline, in order', () => {
        const cases = [
            {},
            { elements: { name: 'none' } },
            { elements: { name: 'guard', params: { len: 2 } } },
            { elements: { name: 'killgate' } },
            { elements: { name: 'blockpocket' } },
            { skeleton: seedlingSkeletonSpec('winding'), elements: { name: 'guard' } },
            { areas: { keys: 1 } },
            { skeleton: seedlingSkeletonSpec('rooms'), areas: { keys: 1 },
                elements: { name: 'killgate' } },
        ];
        for (const c of cases) {
            for (const seed of [1, 2, 3, 4]) {
                const names = seedlingModel({ seed, ...c }).ledger.map((r) => r.phase);
                expect(isSubsequence(names), `${seed} ${JSON.stringify(c)} ⇒ ${names}`)
                    .toBe(true);
                /** ⛔ THE GOAL AND THE CARVE ALWAYS RUN. */
                expect(names[0]).toBe('goal');
                expect(names).toContain('carve');
            }
        }
    });

    /**
     * ⛔ THE ROWS' DRAW SPANS CHAIN AND NEVER GO BACKWARDS. This is the order
     * claim in the one form a re-ordered assembly cannot fake: a row appended
     * out of turn would carry a `before` its predecessor's `after` does not
     * equal, because the appender reads the LIVE counter.
     */
    it('⛓⛓ the draw spans chain, row to row, and are monotone', () => {
        for (const seed of [1, 2, 3, 5, 8]) {
            const rows = seedlingModel({ seed, elements: { name: 'killgate' },
                areas: { keys: 1 } }).ledger;
            for (let i = 1; i < rows.length; i += 1) {
                expect(rows[i].draws.before).toBe(rows[i - 1].draws.after);
                expect(rows[i].draws.after).toBeGreaterThanOrEqual(rows[i].draws.before);
            }
        }
    });

    /**
     * ⛓⛓⛓ **THE CARVE ROW'S TERRAIN IS THE CARVE'S** — folded to that row, the
     * room is the one the carve left, before any composite wrote a tile.
     *
     * ⛔⛔ **AND THE ANCHOR IS `dropElement:true`, NOT A MODEL WITH NO
     * ELEMENT** — a distinction this row's first draft got wrong and the run
     * caught. A `pre-carve` element draws its `len`, its SITE and its geometry
     * BEFORE the carve, so `--elements=none` at the same seed reaches the
     * carver at a different stream position and builds a different room
     * (arc-2 §10.3's rule: *a refused element moves the stream by exactly the
     * draws it spent*). `dropElement` spends every one of those draws and then
     * does not commit the composite, which is exactly *the room as the carve
     * left it*.
     */
    it('⛓⛓⛓ folding to the CARVE row gives the room the CARVE left', () => {
        for (const kind of ['empty', 'winding', 'rooms']) {
            for (const seed of [1, 2, 3]) {
                const skeleton = seedlingSkeletonSpec(kind);
                const elements = { name: 'guard', params: { len: 2 } };
                const m = seedlingModel({ seed, skeleton, elements });
                const carveAt = m.ledger.findIndex((r) => r.phase === 'carve');
                const folded = foldLedger(m.ledger, carveAt, { width: 10, height: 10 });
                const dropped = seedlingModel({ seed, skeleton, elements,
                    dropElement: true }).skeleton();
                for (const cell of folded.terrain) {
                    expect(cell.terrain, `${kind} seed ${seed} (${cell.tx},${cell.ty})`)
                        .toBe(terrainAt(dropped, cell.tx, cell.ty));
                }
            }
        }
    });

    /** ⛓ AND THE LAST ROW FOLDS BACK TO `skeleton()` — terrain and entities. */
    it('⛓⛓ folding to the LAST row rebuilds the shipped room', () => {
        for (const c of [{ elements: { name: 'killgate' } },
            { elements: { name: 'guard', params: { len: 2 } } },
            { areas: { keys: 1 }, elements: { name: 'killgate' } }]) {
            for (const seed of [2, 3, 6]) {
                const m = seedlingModel({ seed, ...c });
                const folded = foldLedger(m.ledger, m.ledger.length - 1,
                    { width: 10, height: 10 });
                const rec = m.skeleton();
                for (const cell of folded.terrain) {
                    expect(cell.terrain).toBe(terrainAt(rec, cell.tx, cell.ty));
                }
                expect(folded.entities.length).toBe(rec.entities.length);
            }
        }
    });

    /**
     * ⛔ A REFUSED PHASE CARRIES ITS OWN REFUSAL — the element's text verbatim,
     * never re-narrated. ⚠ The subject is SCANNED: `guard` refuses on most
     * seeds of the open room (`no-cut-for-the-flag-lock` — slice 2's door
     * census says why: on `empty` a span-1 door cuts NOTHING).
     */
    it('⛓⛓ a REFUSED element writes a row that carries the refusal BY NAME', () => {
        /**
         * ⚠ **WHICH PHASE REFUSES IS THE FINDING, and this row's first draft
         * guessed wrong.** `guard;len=2` on the open room at seed 1 CONSTRUCTS
         * fine and is refused by the COMPOSITE (`no-cut-for-the-flag-lock`), so
         * the `pre-carve` row carries no refusal at all. ⇒ the claim is asked
         * of the ledger — *the row that refused is the one the model's own
         * `elements.refused` names* — rather than of a phase this file picked.
         */
        const m = seedlingModel({ seed: 1, elements: { name: 'guard', params: { len: 2 } } });
        expect(m.elements.refused).toBeTruthy();
        const refusing = m.ledger.filter((r) => r.refusal !== null);
        expect(refusing.length).toBe(1);
        expect(refusing[0].refusal.reason).toBe(m.elements.refused.reason);
        expect(refusing[0].sentence).toContain(m.elements.refused.reason);
        expect(refusing[0].phase).toBe('composite');
        /**
         * ⛔ AND A SITE-LESS REFUSAL LANDS IN `pre-carve` INSTEAD — the same
         * claim, one phase earlier.
         *
         * ⛓⛓ **RE-PINNED IN ARC 5, SLICE 2, AND THE OLD SUBJECT IS THE
         * SLICE'S OWN RESULT.** This used to be `len = 4` on the DEFAULT
         * 10x10 room: a len-4 gadget wanted a 6x6 site with a ring and the
         * 8x8 interior offered none that cleared both the start and the goal.
         * The ORIENTED site pick offers 6x4 and 4x6 instead, `no-site-fits-
         * this-room` went **130 of 360 census cells to 0**, and the subject
         * stopped existing at that size.
         *
         * ⇒ the refusal is not dead, it moved: it now fires on a room too
         * SMALL to hold the lane at all. A 6x6 room has a 4x4 interior and a
         * len-4 gadget needs 6 cells on one axis whichever way round it is
         * offered — so the refusal is decided by the ROOM and not by where
         * the goal happened to fall, which makes it a steadier subject than
         * the one it replaces.
         */
        const nofit = seedlingModel({ seed: 1, defaults: { width: 6, height: 6 },
            elements: { name: 'guard', params: { len: 4 } } });
        const early = nofit.ledger.filter((r) => r.refusal !== null);
        expect(early[0].phase).toBe('pre-carve');
        expect(early[0].refusal.reason).toBe(nofit.elements.refused.reason);
        expect(nofit.ledger.map((r) => r.phase)).not.toContain('composite');
    });

    /**
     * ⛓⛓⛓ THE DEMAND (arc 3, slice 4d) IS IN THE `on-connector` ROW, as a
     * PAINTABLE — which is what makes the page able to draw it without the
     * demand ever reaching a payload (§15.13's false mover).
     */
    it('⛓⛓ the kill gate\'s DEMAND region rides the on-connector row', () => {
        const m = seedlingModel({ seed: 2, elements: { name: 'killgate' } });
        const row = m.ledger.find((r) => r.phase === 'on-connector');
        const demand = row.data.facts.find((f) => f.id === 'demand-region');
        expect(demand).toBeTruthy();
        expect(demand.kind).toBe('flood');
        expect(demand.count).toBe(m.elementDemand().length);
        expect(demand.count).toBeGreaterThan(0);
        /** ⛔ AND `model.elementDemand()` IS THE ONE READING — the same cells. */
        const key = (c) => `${c.x},${c.y}`;
        expect(new Set(demand.cells.map(key)))
            .toEqual(new Set(m.elementDemand().map(key)));
    });

    /** ⛓ THE SEAM APPENDS THE CERTIFICATION ROW, and it is the LAST pass-1 row. */
    it('⛓ the seam\'s ledger ends with the certification', () => {
        const seam = seedlingSeam({ seed: 2, items: { hasSword: true },
            elements: { name: 'killgate' } });
        expect(seam.ledger.length).toBe(seam.model.ledger.length + 1);
        expect(seam.ledger[seam.ledger.length - 1].phase).toBe('certification');
        expect(seam.ledger[seam.ledger.length - 1].data.certified)
            .toBe(seam.certification.certified);
    });

    /**
     * ⛓⛓⛓ **THE SPY** — a model with recording OFF is indistinguishable: same
     * draws, same room, empty ledger. ⛔ Counted on the STREAM, not compared as
     * tiles (arc-1 §9's rule), and asserted over the yield table's kinds.
     */
    it('⛔⛔ recording OFF is BYTE-INERT — same draws, same room, no rows', () => {
        for (const kind of ['empty', 'winding', 'rooms', 'branchy', 'bushy', 'loopy', 'open']) {
            const skeleton = seedlingSkeletonSpec(kind);
            for (const elements of [{ name: 'none' }, { name: 'guard', params: { len: 2 } },
                { name: 'killgate' }]) {
                for (const seed of [1, 2, 3, 4]) {
                    const on = seedlingModel({ seed, skeleton, elements, areas: { keys: 1 } });
                    const off = seedlingModel({ seed, skeleton, elements, areas: { keys: 1 },
                        ledger: false });
                    expect(off.ledger).toEqual([]);
                    expect(off.roomDraws).toBe(on.roomDraws);
                    expect(off.skeleton()).toEqual(on.skeleton());
                }
            }
        }
    });

    /** ⛔ THE LEDGER IS NOT ON THE SUMMARY — and therefore not on any payload. */
    it('⛔⛔ the ledger reaches the model and the seam, and NOTHING that is serialised', () => {
        const seam = seedlingSeam({ seed: 2, items: { hasSword: true },
            elements: { name: 'killgate' } });
        expect(seam.model.ledger.length).toBeGreaterThan(0);
        expect(JSON.stringify(seam.model.elements)).not.toContain('ledger');
        expect(JSON.stringify(seam.certification)).not.toContain('ledger');
    });
});
