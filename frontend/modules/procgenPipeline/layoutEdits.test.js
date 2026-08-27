// Unit rows for the recorded layout-edit vocabulary (layoutEdits.js). The
// INTEGRATION rows — replay at the right step, undo determinism, the codec and
// CLI round-trips — live in sphereSteps.test.js / topDownSteps.test.js and the
// verify-*.mjs scripts; these pin the vocabulary itself against a stub binding,
// which is the whole reason the module takes one.
import { describe, it, expect } from 'vitest';
import { Grid } from './procgenPipelineEngine.js';
import {
    LAYOUT_EDIT_OPS,
    LAYOUT_EDIT_SPECS,
    normalizeLayoutEdit,
    describeLayoutEdit,
    layoutEditStage,
    applyLayoutEdit,
    replayLayoutEdits,
    pushLayoutEdit,
    popLayoutEdit,
    reRollCountFor,
    deriveSphereRerollSeed,
    bumpTopDownSubSeed,
} from './layoutEdits.js';

// A minimal 4x4 grid of exit-less regions: enough for move/swap (which only
// relabel placement and re-stitch), not for the exit-side ops.
function makeGridEnv() {
    const grid = new Grid({ width: 4, height: 4 });
    grid.placeRegion({ gx: 1, gy: 1 }, { region_id: 'A' });
    grid.placeRegion({ gx: 2, gy: 1 }, { region_id: 'B' });
    return { grid, startCell: { gx: 1, gy: 1 }, calls: [] };
}

// The stub binding: every hook records that it ran, so a row can assert the
// module called the mode's code rather than reaching into an envelope itself.
function stubBinding(overrides = {}) {
    return {
        mode: 'stub',
        stages: {
            'move-region': 'regions',
            'swap-regions': 'regions',
            'move-exit-side': 'regions',
            'swap-exit-sides': 'regions',
            're-roll': 'regions',
            'set-substrate': 'items',
        },
        grid: (env) => env.grid,
        regionSize: () => ({ width: 8, height: 6 }),
        afterLayout: (env) => { env.calls.push('afterLayout'); },
        reRoll: (env, edit) => { env.calls.push(`reRoll:${edit.region_id}:${edit.n}`); return null; },
        setSubstrate: (env, edit) => {
            env.calls.push(`setSubstrate:${edit.region_id}:${edit.substrate}`);
            return `custom description for ${edit.region_id}`;
        },
        ...overrides,
    };
}

const cellOf = (grid, id) => grid.allRegions().find((r) => r.region_id === id)?.cell ?? null;

describe('layoutEdits — the vocabulary', () => {
    it('exposes exactly the six recorded ops, derived from the spec table', () => {
        expect([...LAYOUT_EDIT_OPS]).toEqual([
            'move-region', 'swap-regions', 'move-exit-side', 'swap-exit-sides',
            're-roll', 'set-substrate',
        ]);
        expect(LAYOUT_EDIT_OPS).toEqual(Object.keys(LAYOUT_EDIT_SPECS));
    });

    it('every spec declares a kind, params and a describe', () => {
        for (const [op, spec] of Object.entries(LAYOUT_EDIT_SPECS)) {
            expect(['layout', 'scalar'], op).toContain(spec.kind);
            expect(Object.keys(spec.params).length, op).toBeGreaterThan(0);
            expect(typeof spec.describe, op).toBe('function');
            // Only layout ops carry an engine mutator.
            expect(typeof spec.apply === 'function', op).toBe(spec.kind === 'layout');
        }
    });

    it('normalize keeps only the declared params (a stray field cannot ride along)', () => {
        const norm = normalizeLayoutEdit({
            op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 3, gy: 3 }, sneaky: 'x',
        });
        expect(norm).toEqual({ op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 3, gy: 3 } });
        expect('sneaky' in norm).toBe(false);
    });

    it('normalize rejects an unknown op and a malformed param', () => {
        expect(() => normalizeLayoutEdit({ op: 'nope' })).toThrow(/unknown op 'nope'/);
        expect(() => normalizeLayoutEdit({ op: 'move-region', from: { gx: 1 }, to: { gx: 0, gy: 0 } }))
            .toThrow(/move-region\.from must be a \{gx,gy\} cell/);
        expect(() => normalizeLayoutEdit({ op: 're-roll', region_id: 'A', n: 0 }))
            .toThrow(/re-roll\.n must be a positive integer/);
        expect(() => normalizeLayoutEdit({
            op: 'move-exit-side', cell: { gx: 0, gy: 0 }, exitId: 'e1', side: 'UP',
        })).toThrow(/must be one of N\/S\/E\/W/);
    });

    it('describes every op', () => {
        expect(describeLayoutEdit({ op: 'move-region', from: { gx: 1, gy: 2 }, to: { gx: 3, gy: 0 } }))
            .toBe('Move region (1,2) → (3,0)');
        expect(describeLayoutEdit({ op: 'swap-regions', a: { gx: 0, gy: 0 }, b: { gx: 1, gy: 1 } }))
            .toBe('Swap regions (0,0) ↔ (1,1)');
        expect(describeLayoutEdit({ op: 're-roll', region_id: 'A', n: 2 })).toBe('Re-roll "A" (#2)');
        expect(describeLayoutEdit({ op: 'set-substrate', region_id: 'A', substrate: 'maze' }))
            .toBe('Substrate of "A" → maze');
        expect(describeLayoutEdit({ op: 'bogus' })).toMatch(/Unknown edit/);
    });

    it('layoutEditStage reads the mode binding and names the mode when it has none', () => {
        const b = stubBinding();
        expect(layoutEditStage({ op: 'move-region' }, b)).toBe('regions');
        expect(layoutEditStage({ op: 'set-substrate' }, b)).toBe('items');
        const partial = stubBinding({ stages: { 'move-region': 'regions' }, mode: 'topDown' });
        expect(() => layoutEditStage({ op: 're-roll' }, partial))
            .toThrow(/mode 'topDown' declares no stage for op 're-roll'/);
    });
});

describe('layoutEdits — apply', () => {
    it('moves a region and calls the mode s afterLayout hook', () => {
        const env = makeGridEnv();
        const r = applyLayoutEdit(env, {
            op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 3, gy: 3 },
        }, stubBinding());
        expect(r.ok).toBe(true);
        expect(r.description).toBe('Move region (1,1) → (3,3)');
        expect(cellOf(env.grid, 'A')).toEqual({ gx: 3, gy: 3 });
        expect(env.calls).toEqual(['afterLayout']);
    });

    it('swaps two regions', () => {
        const env = makeGridEnv();
        const r = applyLayoutEdit(env, {
            op: 'swap-regions', a: { gx: 1, gy: 1 }, b: { gx: 2, gy: 1 },
        }, stubBinding());
        expect(r.ok).toBe(true);
        expect(cellOf(env.grid, 'A')).toEqual({ gx: 2, gy: 1 });
        expect(cellOf(env.grid, 'B')).toEqual({ gx: 1, gy: 1 });
    });

    // The refusal contract: the engine mutators validate BEFORE they write, so a
    // refused edit must leave the grid exactly as it was.
    it('refuses an occupied target WITHOUT mutating, and never calls afterLayout', () => {
        const env = makeGridEnv();
        const before = env.grid.allRegions().map((r) => `${r.region_id}@${r.cell.gx},${r.cell.gy}`);
        const r = applyLayoutEdit(env, {
            op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 2, gy: 1 },
        }, stubBinding());
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/is occupied/);
        expect(env.grid.allRegions().map((x) => `${x.region_id}@${x.cell.gx},${x.cell.gy}`))
            .toEqual(before);
        expect(env.calls).toEqual([]);
    });

    it('refuses an out-of-bounds target and an empty source without mutating', () => {
        const env = makeGridEnv();
        expect(applyLayoutEdit(env, {
            op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 9, gy: 9 },
        }, stubBinding()).error).toMatch(/out of bounds/);
        expect(applyLayoutEdit(env, {
            op: 'move-region', from: { gx: 0, gy: 3 }, to: { gx: 3, gy: 3 },
        }, stubBinding()).error).toMatch(/no region at/);
        expect(env.calls).toEqual([]);
    });

    it('a malformed edit is a refusal, not a throw', () => {
        const env = makeGridEnv();
        const r = applyLayoutEdit(env, { op: 'move-region', from: 'nope' }, stubBinding());
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/must be a \{gx,gy\} cell/);
    });

    it('routes the two scalar ops to the mode binding, preferring its description', () => {
        const env = makeGridEnv();
        const b = stubBinding();
        expect(applyLayoutEdit(env, { op: 're-roll', region_id: 'A', n: 1 }, b))
            .toEqual({ ok: true, description: 'Re-roll "A" (#1)' }); // binding returned null
        expect(applyLayoutEdit(env, { op: 'set-substrate', region_id: 'A', substrate: 'maze' }, b))
            .toEqual({ ok: true, description: 'custom description for A' });
        expect(env.calls).toEqual(['reRoll:A:1', 'setSubstrate:A:maze']);
    });

    it('refuses a scalar op the mode has no handler for', () => {
        const env = makeGridEnv();
        const b = stubBinding({ reRoll: null, mode: 'handlerless' });
        const r = applyLayoutEdit(env, { op: 're-roll', region_id: 'A', n: 1 }, b);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/mode 'handlerless' has no handler for 're-roll'/);
    });

    it('refuses a layout op before the grid exists', () => {
        const env = { grid: null, calls: [] };
        const r = applyLayoutEdit(env, {
            op: 'move-region', from: { gx: 0, gy: 0 }, to: { gx: 1, gy: 1 },
        }, stubBinding());
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/no grid yet/);
    });
});

describe('layoutEdits — record, replay, undo', () => {
    it('push applies AND records; a refused push records nothing', () => {
        const env = makeGridEnv();
        const b = stubBinding();
        const ok = pushLayoutEdit(env, {
            op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 3, gy: 3 },
        }, b);
        expect(ok.ok).toBe(true);
        expect(ok.edit).toEqual({ op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 3, gy: 3 } });
        expect(env.edits).toHaveLength(1);

        const bad = pushLayoutEdit(env, {
            op: 'move-region', from: { gx: 3, gy: 3 }, to: { gx: 2, gy: 1 },
        }, b);
        expect(bad.ok).toBe(false);
        expect(env.edits).toHaveLength(1);
    });

    it('replay applies ONLY the edits staged for the named step, in list order', () => {
        const env = makeGridEnv();
        env.edits = [
            { op: 'set-substrate', region_id: 'A', substrate: 'maze' },
            { op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 3, gy: 3 } },
            { op: 're-roll', region_id: 'A', n: 1 },
        ];
        const b = stubBinding();
        const items = replayLayoutEdits(env, 'items', b);
        expect(items.applied).toBe(1);
        expect(env.calls).toEqual(['setSubstrate:A:maze']);
        expect(cellOf(env.grid, 'A')).toEqual({ gx: 1, gy: 1 }); // the move did NOT run yet

        const regions = replayLayoutEdits(env, 'regions', b);
        expect(regions.applied).toBe(2);
        expect(regions.descriptions)
            .toEqual(['Move region (1,1) → (3,3)', 'Re-roll "A" (#1)']);
        expect(cellOf(env.grid, 'A')).toEqual({ gx: 3, gy: 3 });
    });

    // The byte-identity contract, at this module's altitude.
    it('replay is a no-op — and touches nothing — with no edits recorded', () => {
        const env = makeGridEnv();
        expect(replayLayoutEdits(env, 'regions', stubBinding())).toEqual({
            applied: 0, descriptions: [],
        });
        env.edits = [];
        expect(replayLayoutEdits(env, 'regions', stubBinding()).applied).toBe(0);
        expect(env.calls).toEqual([]);
    });

    it('replay THROWS on a refusal, naming the index and the step', () => {
        const env = makeGridEnv();
        env.edits = [{ op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 2, gy: 1 } }];
        expect(() => replayLayoutEdits(env, 'regions', stubBinding()))
            .toThrow(/edit #0 \(move-region\) refused after step 'regions': .*occupied/);
    });

    it('pop returns the edit and its stage; nothing to pop is null', () => {
        const env = makeGridEnv();
        const b = stubBinding();
        expect(popLayoutEdit(env, b)).toBeNull();
        pushLayoutEdit(env, { op: 'set-substrate', region_id: 'A', substrate: 'maze' }, b);
        pushLayoutEdit(env, { op: 'move-region', from: { gx: 1, gy: 1 }, to: { gx: 3, gy: 3 } }, b);
        const popped = popLayoutEdit(env, b);
        expect(popped.edit.op).toBe('move-region');
        expect(popped.index).toBe(1);
        expect(popped.stage).toBe('regions');
        expect(env.edits).toHaveLength(1);
    });
});

describe('layoutEdits — the re-roll seed derivation', () => {
    it('counts prior re-rolls of THAT region from the list', () => {
        const edits = [
            { op: 're-roll', region_id: 'A', n: 1 },
            { op: 'move-region', from: { gx: 0, gy: 0 }, to: { gx: 1, gy: 1 } },
            { op: 're-roll', region_id: 'B', n: 1 },
            { op: 're-roll', region_id: 'A', n: 2 },
        ];
        expect(reRollCountFor(edits, 'A')).toBe(2);
        expect(reRollCountFor(edits, 'B')).toBe(1);
        expect(reRollCountFor(edits, 'C')).toBe(0);
        expect(reRollCountFor(undefined, 'A')).toBe(0);
    });

    // Pinned against the panel's pre-B-d expression, evaluated by hand: the
    // formula moved MODULE, not value, so no committed fixture can shift.
    it('deriveSphereRerollSeed reproduces the panel formula exactly', () => {
        const hand = (seed, id, n) => {
            let h = 0;
            for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
            return ((seed * 7919) ^ h) + n * 104729 | 0;
        };
        for (const [seed, id, n] of [[1, 'region_2_2', 1], [7, 'region_10_3', 4], [1, 'A', 2]]) {
            expect(deriveSphereRerollSeed(seed, id, n)).toBe(hand(seed, id, n));
        }
        // n is what separates two re-rolls of one region.
        expect(deriveSphereRerollSeed(1, 'A', 1)).not.toBe(deriveSphereRerollSeed(1, 'A', 2));
        // …and the derivation is a pure function, so a replay reproduces it.
        expect(deriveSphereRerollSeed(1, 'A', 3)).toBe(deriveSphereRerollSeed(1, 'A', 3));
    });

    it('bumpTopDownSubSeed reproduces the panel formula and stays uint32', () => {
        const hand = (s, n) => (s ^ (0x9e3779b9 + n * 0x55555555)) >>> 0;
        for (const [s, n] of [[12345, 1], [0xffffffff, 2], [0, 3]]) {
            expect(bumpTopDownSubSeed(s, n)).toBe(hand(s, n));
            expect(bumpTopDownSubSeed(s, n)).toBeGreaterThanOrEqual(0);
            expect(bumpTopDownSubSeed(s, n)).toBeLessThanOrEqual(0xffffffff);
        }
    });
});
