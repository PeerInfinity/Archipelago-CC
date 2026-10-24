/**
 * Generator FAST gates (plan §4.5) — the pure, generation-free unit tests:
 * geometry derivation/validation, physics resolution, the spec-driven
 * structural plan (planStripSpecs), and the gap/ceiling margin transforms.
 *
 * Every test that actually invokes generateLevel/generateZoneSet (the
 * per-feature realise-and-derive gates + the dump CLI) lives in
 * generatorFeatures.slow.test.js so the default `vitest run` stays
 * generation-free (runner test-strategy rebalance §1: "Re-split by COST
 * CLASS"). The seed-range sweep, zone tables, and reach-pins are in
 * generator.slow.test.js.
 */

import { describe, it, expect } from 'vitest';
import {
    CELESTE_GEOMETRY, deriveGeometry, validateGeometry, resolveGenPhysics,
    planStripSpecs, applyGapMargin, applyCeilingMargin,
} from './generator.js';
import { DEFAULTS } from './physics.js';

describe('geometry', () => {
    it('pinned celeste geometry satisfies its structural constraints', () => {
        expect(validateGeometry(CELESTE_GEOMETRY, DEFAULTS)).toEqual([]);
    });

    it('deriveGeometry from the pinned reaches yields valid windows (no sweep)', () => {
        const G = deriveGeometry(DEFAULTS, {
            reaches: CELESTE_GEOMETRY.REACH, rises: CELESTE_GEOMETRY.RISE,
            ceils: { min: CELESTE_GEOMETRY.CEIL_MIN_CLEAR },
            glides: {
                dj: CELESTE_GEOMETRY.GLIDE_DJ_MAX,
                lo: CELESTE_GEOMETRY.GLIDE_REACH.min,
                hi: CELESTE_GEOMETRY.GLIDE_REACH.max,
            },
        });
        expect(validateGeometry(G, DEFAULTS)).toEqual([]);
        // ceiling band sits between the swept clearance and the
        // full-hold player top (validateGeometry re-checks with margin)
        expect(G.CEIL_RISE.min).toBeGreaterThan(CELESTE_GEOMETRY.CEIL_MIN_CLEAR);
        expect(G.CEIL_RISE.min + G.CEIL_RISE.span)
            .toBeLessThan(1.05 * DEFAULTS.jumpHeight + DEFAULTS.PLAYER_H);
        // gate boundaries sit strictly between the swept reaches
        expect(G.DJ_GAP.min).toBeGreaterThan(CELESTE_GEOMETRY.REACH.single);
        expect(G.DJ_GAP.min + G.DJ_GAP.span).toBeLessThan(CELESTE_GEOMETRY.REACH.dj);
        expect(2 * G.STONE_HALF.min + G.STONE_W).toBeGreaterThan(CELESTE_GEOMETRY.REACH.dj);
        expect(G.SPRING_TOTAL.min).toBeGreaterThan(CELESTE_GEOMETRY.REACH.dj);
        expect(G.SPRING_TOTAL.min + G.SPRING_TOTAL.span)
            .toBeLessThan(CELESTE_GEOMETRY.REACH.spring);
        // shelf windows sit strictly between the swept rises
        expect(G.DJ_SHELF_RISE.min).toBeGreaterThan(CELESTE_GEOMETRY.RISE.single);
        expect(G.DJ_SHELF_RISE.min + G.DJ_SHELF_RISE.span)
            .toBeLessThan(CELESTE_GEOMETRY.RISE.dj);
        expect(G.SPRING_SHELF_RISE.min).toBeGreaterThan(CELESTE_GEOMETRY.RISE.dj);
        // glide chasm sits strictly between the swept dj bound and the
        // glide reach, and the landing pad contains the longest glide
        expect(G.GLIDE_GAP.min).toBeGreaterThan(CELESTE_GEOMETRY.GLIDE_DJ_MAX);
        expect(G.GLIDE_GAP.min + G.GLIDE_GAP.span)
            .toBeLessThan(CELESTE_GEOMETRY.GLIDE_REACH.min);
        expect(G.GLIDE_LAND_PAD)
            .toBeGreaterThanOrEqual(CELESTE_GEOMETRY.GLIDE_REACH.max - G.GLIDE_GAP.min + 1.2);
    });

    it('resolveGenPhysics: celeste is pinned; unknown profiles throw; explicit passthrough', () => {
        const r = resolveGenPhysics('celeste');
        expect(r.G).toBe(CELESTE_GEOMETRY);
        expect(r.C).toBe(DEFAULTS);
        expect(resolveGenPhysics().G).toBe(CELESTE_GEOMETRY); // default profile
        expect(() => resolveGenPhysics('zelda')).toThrow(/unknown physics profile/);
        const explicit = resolveGenPhysics({ constants: DEFAULTS, geometry: CELESTE_GEOMETRY });
        expect(explicit.G).toBe(CELESTE_GEOMETRY);
    });
});

describe('applyCeilingMargin', () => {
    it('applyCeilingMargin: margin 0 is identity; margin 1 anchors on the grounded-tap arc', () => {
        const G = CELESTE_GEOMETRY;
        expect(applyCeilingMargin(G, 0)).toBe(G);
        const easy = applyCeilingMargin(G, 1);
        // gap window inside grounded-tap range with slack
        expect(easy.CEIL_GAP.min + easy.CEIL_GAP.span).toBeCloseTo(G.TAP.range - 0.3, 2);
        // slab bottom clears the grounded-tap apex with margin
        expect(easy.CEIL_RISE.min).toBeCloseTo(G.TAP.top + 0.45, 2);
        // the band MAX never moves: mid/full holds stay punished
        expect(easy.CEIL_RISE.min + easy.CEIL_RISE.span)
            .toBeCloseTo(G.CEIL_RISE.min + G.CEIL_RISE.span, 2);
        // transformed windows still satisfy the structural constraints
        expect(validateGeometry(easy, DEFAULTS)).toEqual([]);
        expect(validateGeometry(applyCeilingMargin(G, 0.5), DEFAULTS)).toEqual([]);
        // null passthrough (refusing profiles stay refusing)
        const refused = Object.freeze({ ...G, CEIL_RISE: null });
        expect(applyCeilingMargin(refused, 1)).toBe(refused);
    });
});

describe('planStripSpecs (spec-driven structural plan)', () => {
    it('nested-chain specs plan: max-req exit is main, others tips in level order', () => {
        const plan = planStripSpecs(
            [
                { key: 'E', requirement: ['doubleJump'] },
                { key: 'S', requirement: ['doubleJump', 'blue'] },
                { key: 'W', requirement: [] }, // the ungated entrance back portal
            ],
            [{ id: 'it_a', requirement: [] }, { id: 'it_b', requirement: ['doubleJump'] }]);
        expect(plan.mainKey).toBe('S');
        expect(plan.portalByKey).toEqual({ S: 'exit_main', W: 'exit_br0', E: 'exit_br1' });
        // levels: ∅ (back tip + it_a), {dj} (E tip + it_b), {dj,blue} (main)
        expect(plan.levels.map((l) => l.added)).toEqual([[], ['doubleJump'], ['blue']]);
        expect(plan.levels[0].tips.map((t) => t.portalId)).toEqual(['exit_br0']);
        expect(plan.levels[0].pickups).toEqual(['it_a']);
        expect(plan.levels[1].tips.map((t) => t.portalId)).toEqual(['exit_br1']);
        expect(plan.levels[1].pickups).toEqual(['it_b']);
        expect(plan.levels[2].tips).toEqual([]);
    });

    it('rejects non-nested requirements (a strip realises gates sequentially)', () => {
        expect(() => planStripSpecs([
            { key: 'E', requirement: ['doubleJump'] },
            { key: 'S', requirement: ['blue'] },
        ])).toThrow(/nested chain/);
    });

    it('rejects a maximal requirement carried only by a pickup', () => {
        expect(() => planStripSpecs(
            [{ key: 'E', requirement: [] }],
            [{ id: 'p', requirement: ['doubleJump'] }],
        )).toThrow(/belongs to no exit/);
    });

    it('rejects empty exits, duplicates, and unknown abilities', () => {
        expect(() => planStripSpecs([])).toThrow(/at least one exit/);
        expect(() => planStripSpecs([
            { key: 'E', requirement: [] }, { key: 'E', requirement: [] },
        ])).toThrow(/duplicate goal/);
        expect(() => planStripSpecs([{ key: 'E', requirement: ['highJump'] }]))
            .toThrow(/no gate template/);
    });
});

describe('applyGapMargin', () => {
    it('margin 0 returns the SAME geometry object (byte-identity)', () => {
        expect(applyGapMargin(CELESTE_GEOMETRY, 0)).toBe(CELESTE_GEOMETRY);
        expect(applyGapMargin(CELESTE_GEOMETRY)).toBe(CELESTE_GEOMETRY);
    });

    it('margin 1 widens RUN_GAP max to the 0.75×single structural cap, nothing else', () => {
        const G = applyGapMargin(CELESTE_GEOMETRY, 1);
        expect(G.RUN_GAP.min).toBe(CELESTE_GEOMETRY.RUN_GAP.min);
        expect(G.RUN_GAP.min + G.RUN_GAP.span)
            .toBeCloseTo(0.75 * CELESTE_GEOMETRY.REACH.single, 1);
        expect(validateGeometry(G, DEFAULTS)).toEqual([]);
        expect(G.DJ_GAP).toBe(CELESTE_GEOMETRY.DJ_GAP);
        expect(G.STONE_HALF).toBe(CELESTE_GEOMETRY.STONE_HALF);
    });

    it('margin clamps to [0, 1]', () => {
        expect(JSON.stringify(applyGapMargin(CELESTE_GEOMETRY, 5)))
            .toBe(JSON.stringify(applyGapMargin(CELESTE_GEOMETRY, 1)));
        expect(applyGapMargin(CELESTE_GEOMETRY, -1)).toBe(CELESTE_GEOMETRY);
    });
});
