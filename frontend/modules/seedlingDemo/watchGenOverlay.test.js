/**
 * watchGenOverlay — **THE THREE SIBLING OVERLAYS, AS DATA** (PROCGEN ELEMENTS
 * arc 3, slice 5a, D5).
 *
 * ⛔ THE DATA IS THE PICTURE'S ARGUMENT (arc-2 §11.2), so these rows are about
 * the canvas: `genOverlaysFor` is what `drawGenOverlay` consumes and what
 * `window.__editorGenerate.overlays` publishes. The op-count rows below are
 * the second half — a draw that skipped a group the legend names would leave
 * the two disagreeing, and this file drives both.
 */

import { describe, expect, it } from 'vitest';

import {
    GEN_LAYERS, GenOverlayError, drawGenOverlay, drawPaintables, genLayerRank, genOverlaysFor,
} from './watchGenOverlay.js';
import { paintable } from './procgenLedger.js';
import { seedlingModel, seedlingSeam, seedlingSkeletonSpec } from './procgenSeedling.js';

/** ⛓ A CANVAS CONTEXT THAT RECORDS ITS OPS — the same instrument the maze's
 *  render fixtures use, one substrate over. */
const spyCtx = () => {
    const ops = [];
    const rec = (name) => (...args) => ops.push(`${name}(${args.map((a) => (typeof a === 'number'
        ? a.toFixed(1) : JSON.stringify(a))).join(',')})`);
    return {
        ops,
        save: rec('save'),
        restore: rec('restore'),
        fillRect: rec('fillRect'),
        strokeRect: rec('strokeRect'),
        beginPath: rec('beginPath'),
        arc: rec('arc'),
        stroke: rec('stroke'),
        moveTo: rec('moveTo'),
        lineTo: rec('lineTo'),
        setLineDash: rec('setLineDash'),
        fillText: rec('fillText'),
        set fillStyle(v) { ops.push(`fillStyle=${v}`); },
        set strokeStyle(v) { ops.push(`strokeStyle=${v}`); },
        set lineWidth(v) { ops.push(`lineWidth=${v}`); },
        set globalAlpha(v) { ops.push(`globalAlpha=${v}`); },
    };
};

const VIEW = { tilePx: 16 };
const ids = (data) => data.groups.map((g) => g.id);

describe('watchGenOverlay — the layers', () => {
    it('⛓ the layers are cumulative and named once', () => {
        expect(GEN_LAYERS).toEqual(['off', 'sites', 'elements', 'areas', 'all']);
        expect(genLayerRank('off')).toBe(0);
        expect(genLayerRank('all')).toBe(GEN_LAYERS.length - 1);
    });

    it('⛔ `off`, a missing model and a bad layer', () => {
        const m = seedlingModel({ seed: 1 });
        expect(genOverlaysFor(m, { layer: 'off' }).groups).toEqual([]);
        expect(genOverlaysFor(null, { layer: 'all' }).groups).toEqual([]);
        expect(() => genOverlaysFor(m, { layer: 'sparkles' }))
            .toThrow(/is not one of \[off, sites, elements, areas, all\]/);
        expect(() => genOverlaysFor(m, { layer: 'x' })).toThrow(GenOverlayError);
    });

    /**
     * ⛓⛓ THE SITE CLASSES COME FROM `model.sites` AND `chambers` IS NOT ONE OF
     * THEM — it is `chamber`'s own decomposition (`sites.js`: *"the cells of
     * `chambers`, flattened. ONE derivation"*), so drawing both would paint one
     * cell twice and count it twice in the legend.
     */
    it('⛓⛓ `sites` draws one group per CLASS, and never `chambers`', () => {
        const m = seedlingModel({ seed: 1, skeleton: seedlingSkeletonSpec('winding') });
        const data = genOverlaysFor(m, { layer: 'sites' });
        expect(ids(data).every((id) => id.startsWith('site:'))).toBe(true);
        expect(ids(data)).not.toContain('site:chambers');
        for (const g of data.groups) {
            const cls = g.id.slice('site:'.length);
            const raw = m.sites[cls];
            const expected = cls === 'branch'
                ? raw.flatMap((b) => b.cells).length : raw.length;
            expect(g.count, cls).toBe(expected);
        }
        /** ⛔ A CLASS WITH NO CELLS DRAWS NOTHING rather than an empty group a
         *  legend would then name. */
        expect(data.groups.every((g) => g.count > 0)).toBe(true);
    });

    /**
     * ⛓⛓⛓ A `pre-carve` GUARD — the reserved rectangle, the site, the tunnel
     * FILLED AND DASHED (§10.11.6), the block, the button, the door, the flag
     * and the flag's lock.
     */
    it('⛓⛓ `elements` draws a placed GUARD\'s whole geometry', () => {
        const m = seedlingModel({ seed: 3, skeleton: seedlingSkeletonSpec('winding'),
            elements: { name: 'guard', params: { len: 2 } } });
        expect(m.elements.ran).toBe(true);
        const data = genOverlaysFor(m, { layer: 'elements' });
        const el = ids(data).filter((id) => id.startsWith('element:'));
        /**
         * ⚠ **NO `element:tunnel` ON THIS SEED, AND THAT IS THE RULE NOT A
         * GAP**: an empty group is never emitted, and `winding` seed 3's gadget
         * has a ZERO-cell tunnel because its entry mouth already touches the
         * carve. A group nobody can see must not be a legend row.
         */
        const p = m.elements.placed[0];
        expect(p.tunnel.length).toBe(0);
        expect(el).toEqual(['element:reserved', 'element:site',
            'element:block', 'element:button', 'element:door', 'element:flag',
            'element:flagLock']);
        const byId = new Map(data.groups.map((g) => [g.id, g]));
        /** ⛓ …and where there IS a tunnel it is drawn FILLED **and** dashed
         *  (§10.11.6 — the level under it is already dark floor, so one signal
         *  cannot be read as a tunnel). */
        const withTunnel = seedlingModel({ seed: 6, elements: { name: 'guard', params: { len: 2 } },
            skeleton: seedlingSkeletonSpec('rooms') });
        if (withTunnel.elements.ran && withTunnel.elements.placed[0].tunnel.length) {
            const t = genOverlaysFor(withTunnel, { layer: 'elements' })
                .groups.find((g) => g.id === 'element:tunnel');
            expect(t.count).toBe(withTunnel.elements.placed[0].tunnel.length);
            expect(t.style).toBe('fill+dash');
        }
        expect(byId.get('element:block').cells).toEqual([{ x: p.block.x, y: p.block.y }]);
        expect(byId.get('element:flag').cells).toEqual([{ x: p.flagCell.x, y: p.flagCell.y }]);
        expect(byId.get('element:reserved').count).toBe((p.site.w + 2) * (p.site.h + 2));
    });

    /** ⛓⛓ An `on-connector` KILL GATE — the door, the clearer, the wall it grew
     *  and 4d's DEMAND region, read from `model.elementDemand()`. */
    it('⛓⛓ `elements` draws a placed KILL GATE and its DEMAND', () => {
        const m = seedlingModel({ seed: 2, elements: { name: 'killgate' } });
        expect(m.elements.ran).toBe(true);
        const data = genOverlaysFor(m, { layer: 'elements' });
        const byId = new Map(data.groups.map((g) => [g.id, g]));
        expect(byId.get('element:door').cells)
            .toEqual(m.elements.placed[0].doorCells.map((c) => ({ x: c.x, y: c.y })));
        expect(byId.get('element:wall').count).toBe(m.elements.placed[0].wall.length);
        expect(byId.get('element:demand').count).toBe(m.elementDemand().length);
        expect(byId.get('element:demand').count).toBeGreaterThan(0);
        /** ⛔ AND NOTHING FROM THE PRE-CARVE VOCABULARY — a door has no site. */
        expect(ids(data)).not.toContain('element:reserved');
    });

    /**
     * ⛔⛔ **A DROPPED ELEMENT DRAWS NOTHING**, and its reason is a LEGEND row.
     * The geometry a refused certification measured survives on
     * `certification.geometry` so the CENSUS numbers do (arc-3 §10.8) — but the
     * level that SHIPPED does not contain it, and a picture that read that
     * field would draw a gadget nobody can walk into.
     */
    it('⛔⛔ a DROPPED element draws NOTHING and says so in the LEGEND', () => {
        const m = seedlingModel({ seed: 2, elements: { name: 'killgate' }, dropElement: true });
        expect(m.elements.ran).toBe(false);
        expect(m.elements.refused).toBeTruthy();
        const data = genOverlaysFor(m, { layer: 'elements' });
        expect(ids(data).filter((id) => id.startsWith('element:'))).toEqual([]);
        expect(data.counts.elements).toBe(0);
        expect(data.notes.join(' ')).toContain(m.elements.refused.reason);
        expect(data.legend.some((r) => r.style === 'note')).toBe(true);
        /**
         * ⛓ AND THE DRAW SPENDS ZERO OPS ON THE ELEMENT — asserted, not
         * assumed. ⚠ The `elements` LAYER is cumulative and still paints the
         * SITES beneath it, so the claim is about the element's own groups: the
         * data has none, and a draw of just those is empty.
         */
        const ctx = spyCtx();
        drawGenOverlay(ctx, { ...data,
            groups: data.groups.filter((g) => g.id.startsWith('element:')) }, VIEW);
        expect(ctx.ops).toEqual([]);
    });

    /**
     * ⛔⛔ **AND IT IGNORES A CERTIFICATION'S GEOMETRY EVEN WHEN ONE IS RIGHT
     * THERE.** ⚠ THE FIXTURE HAD TO BE STRENGTHENED TO SEE THIS: mutant (c) —
     * an overlay that read `certification.geometry` for a dropped element —
     * was caught by the BROWSER row and NOT by the row above, because a bare
     * `seedlingModel({dropElement:true})` carries no certification to read. The
     * page holds one beside the model (`state.elements.certification`), so the
     * fixture now hands the data function exactly that shape (trap: a fixture
     * only gates a change it can DISTINGUISH).
     *
     * ⛔⛔ **R9 SLICE 11 RE-POINTED THE SEED (1 -> 3), AND THE REASON IS A
     * MEASUREMENT WORTH KEEPING.** This row needs a DROPPED element that
     * nonetheless carries a certification geometry to be ignored. Repairing
     * `solverBot.facingToward` (trap 498) gave the kill arm vertical strike
     * cells, and seed 1's `killgate` — previously dropped because its
     * certification solve REFUSED — now CERTIFIES, so `elements.ran` is `true`
     * and there is no dropped element left to assert about. Swept over seeds
     * 1..20 against a pristine worktree: `ran === true` goes **2 -> 4**, and the
     * two that flipped are **seed 1 and seed 9**. Seed 3 is the lowest seed that
     * still drops (as do 4..8 and 10..19), so the subject is re-pointed, not
     * weakened — and the flip is the same one that moves `level post-sword s1`
     * in ruling 8's identity block.
     */
    it('⛔⛔ …even when the certification\'s GEOMETRY is attached to the model', () => {
        const seam = seedlingSeam({ seed: 3, items: { hasSword: true },
            elements: { name: 'killgate' } });
        expect(seam.model.elements.ran).toBe(false);
        expect(seam.certification.geometry.length).toBeGreaterThan(0);
        const withGeometry = { ...seam.model,
            elements: { ...seam.model.elements, certification: seam.certification },
            certification: seam.certification };
        const data = genOverlaysFor(withGeometry, { layer: 'elements' });
        expect(ids(data).filter((id) => id.startsWith('element:'))).toEqual([]);
        expect(data.counts.elements).toBe(0);
    });

    /**
     * ⛓⛓ THE AREA LADDER. ⚠ THE SUBJECT IS SCANNED, not picked: `--areas=1`
     * accepts on 0–4 of 12 seeds per kind (4b §14.3, and it is the ceiling that
     * slice published). SCANNED over 7 kinds × seeds 1..12 — **exactly two
     * cells accept, `rooms` seed 3 (4 locks, 1 flag) and `rooms` seed 10 (9
     * locks, 1 flag)**; seed 3 is taken, the smaller.
     */
    it('⛓⛓ `areas` draws the partition, its LOCKS and its FLAGS', () => {
        const m = seedlingModel({ seed: 3, skeleton: seedlingSkeletonSpec('rooms'),
            areas: { keys: 1 } });
        expect(m.areas.ran).toBe(true);
        const data = genOverlaysFor(m, { layer: 'areas' });
        const byId = new Map(data.groups.map((g) => [g.id, g]));
        expect(byId.get('area:locks').count).toBe(m.areas.locks.length);
        expect(byId.get('area:flags').count).toBe(m.areas.flags.length);
        for (const area of m.areaPartition().areas) {
            const g = byId.get(`area:${area.id}`);
            expect(g, area.id).toBeTruthy();
            expect(g.count).toBe(area.cells.length);
            /** ⛔ A SYNTHETIC AREA IS DASHED, NEVER FILLED — it is the grown
             *  1-cell entrance/goal area (or the goal's VESTIBULE) and must not
             *  read as a chamber. */
            expect(g.style).toBe(area.synthetic ? 'dash' : 'fill');
        }
    });

    it('⛓ a REFUSED graph still shows its partition, with the reason in the LEGEND', () => {
        const m = seedlingModel({ seed: 1, areas: { keys: 1 } });
        expect(m.areas.ran).toBe(false);
        const data = genOverlaysFor(m, { layer: 'areas' });
        expect(ids(data).some((id) => id.startsWith('area:') && id !== 'area:locks')).toBe(true);
        expect(ids(data)).not.toContain('area:locks');
        expect(data.notes.join(' ')).toContain(m.areas.refused.reason);
    });

    /** ⛓ `all` is the union, and the layers are CUMULATIVE. */
    it('⛓ the layers are cumulative — each contains the one before it', () => {
        const m = seedlingModel({ seed: 3, skeleton: seedlingSkeletonSpec('rooms'),
            areas: { keys: 1 }, elements: { name: 'killgate' } });
        const at = (layer) => new Set(ids(genOverlaysFor(m, { layer })));
        expect([...at('sites')].every((id) => at('elements').has(id))).toBe(true);
        expect([...at('elements')].every((id) => at('areas').has(id))).toBe(true);
        expect([...at('areas')].every((id) => at('all').has(id))).toBe(true);
    });

    /**
     * ⛓⛓⛓ THE PHASE CUT — a group is drawn only when the phase that PRODUCED it
     * has run, so stepping back before the carve does not paint sites the room
     * did not have. ⛔ Asked of the LEDGER, never of a constant list (trap 357).
     */
    it('⛓⛓ at phase k only the groups whose phase has RUN are drawn', () => {
        const m = seedlingModel({ seed: 2, elements: { name: 'killgate' }, areas: { keys: 1 } });
        const rows = m.ledger.map((r) => r.phase);
        const beforeCarve = rows.indexOf('carve') - 1;
        expect(ids(genOverlaysFor(m, { layer: 'all', phase: beforeCarve }))).toEqual([]);
        const atCarve = genOverlaysFor(m, { layer: 'all', phase: rows.indexOf('carve') });
        expect(ids(atCarve).some((id) => id.startsWith('site:'))).toBe(true);
        expect(ids(atCarve).some((id) => id.startsWith('element:'))).toBe(false);
        const atComposite = genOverlaysFor(m, { layer: 'all', phase: rows.indexOf('composite') });
        expect(ids(atComposite).some((id) => id.startsWith('element:'))).toBe(true);
        /** ⛓ AND `null` IS THE FINISHED MODEL — everything. */
        expect(ids(genOverlaysFor(m, { layer: 'all', phase: null })).length)
            .toBeGreaterThanOrEqual(ids(atComposite).length);
    });

    /**
     * ⛓⛓ THE LEGEND NAMES EVERY DRAWN GROUP EXACTLY ONCE, plus one row per
     * note. ⛔ It is DERIVED from the groups, so the page cannot name a symbol
     * the draw did not paint.
     */
    it('⛓⛓ the legend names every group ONCE, and nothing else', () => {
        const m = seedlingModel({ seed: 3, skeleton: seedlingSkeletonSpec('rooms'),
            areas: { keys: 1 } });
        const data = genOverlaysFor(m, { layer: 'all' });
        const rows = data.legend.filter((r) => r.style !== 'note');
        expect(rows.map((r) => r.id)).toEqual(ids(data));
        expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
        expect(data.legend.length).toBe(data.groups.length + data.notes.length);
    });
});

describe('watchGenOverlay — the draw', () => {
    it('⛔ the view is REFUSED rather than defaulted', () => {
        expect(() => drawGenOverlay(spyCtx(), null, {})).toThrow(/tilePx must be a positive/);
        expect(() => drawGenOverlay(spyCtx(), null, null)).toThrow(/needs a view object/);
    });

    it('⛔ ZERO ops at `off`, and ZERO `fillText` ever', () => {
        const m = seedlingModel({ seed: 3, skeleton: seedlingSkeletonSpec('rooms'),
            areas: { keys: 1 }, elements: { name: 'guard', params: { len: 2 } } });
        const off = spyCtx();
        drawGenOverlay(off, genOverlaysFor(m, { layer: 'off' }), VIEW);
        expect(off.ops).toEqual([]);
        const all = spyCtx();
        drawGenOverlay(all, genOverlaysFor(m, { layer: 'all' }), VIEW);
        expect(all.ops.length).toBeGreaterThan(0);
        /** ⛔ ARC-1's RULE: no text on the canvas — the LEGEND names the
         *  symbols and the picture carries only colour. */
        expect(all.ops.filter((o) => o.startsWith('fillText'))).toEqual([]);
    });

    /**
     * ⛔ EVERY GROUP THE LEGEND NAMES IS ALSO DRAWN — a `save` per group, so
     * a style the painter cannot draw refuses BY NAME rather than being
     * skipped (a skipped group is a picture missing a fact the legend claims).
     */
    it('⛓⛓ every group in the data reaches the canvas', () => {
        const m = seedlingModel({ seed: 3, skeleton: seedlingSkeletonSpec('rooms'),
            areas: { keys: 1 }, elements: { name: 'guard', params: { len: 2 } } });
        const data = genOverlaysFor(m, { layer: 'all' });
        const ctx = spyCtx();
        drawGenOverlay(ctx, data, VIEW);
        expect(ctx.ops.filter((o) => o === 'save()').length).toBe(data.groups.length);
        expect(() => drawGenOverlay(spyCtx(),
            { ...data, groups: [{ id: 'x', style: 'sparkles', cells: [{ x: 1, y: 1 }] }] }, VIEW))
            .toThrow(/which this file cannot draw/);
    });

    /**
     * ⛓⛓⛓ THE GENERIC PAINTER (⚖ the 2026-08-18 ruling) — one hue, the PICK
     * outlined in a second, and one `switch` for every paintable kind.
     */
    it('⛓⛓ drawPaintables paints cells, floods, paths and outlines from ONE function', () => {
        const cells = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
        for (const kind of ['cells', 'flood']) {
            const ctx = spyCtx();
            drawPaintables(ctx, [paintable({ id: 'a', label: 'l', kind, cells })], VIEW);
            expect(ctx.ops.filter((o) => o.startsWith('fillRect')).length).toBe(3);
        }
        const outline = spyCtx();
        drawPaintables(outline, [paintable({ id: 'a', label: 'l', kind: 'outline', cells })], VIEW);
        expect(outline.ops.filter((o) => o.startsWith('strokeRect')).length).toBe(3);
        const path = spyCtx();
        drawPaintables(path, [paintable({ id: 'a', label: 'l', kind: 'path', cells })], VIEW);
        expect(path.ops.filter((o) => o.startsWith('lineTo')).length).toBe(2);
        /** ⛔ THE PICK IS OUTLINED IN A SECOND COLOUR — a candidate set whose
         *  chosen member looked like every other member would hide the one
         *  fact the reader opened the row for. */
        const picked = spyCtx();
        drawPaintables(picked, [paintable({ id: 'a', label: 'l', kind: 'cells', cells,
            pick: { x: 2, y: 1 } })], VIEW);
        expect(picked.ops).toContain('strokeStyle=#ffffff');
        expect(picked.ops.filter((o) => o.startsWith('strokeRect')).length).toBe(1);
        /** ⛓ AND NOTHING SELECTED PAINTS NOTHING. */
        const none = spyCtx();
        drawPaintables(none, [], VIEW);
        expect(none.ops).toEqual([]);
    });
});
