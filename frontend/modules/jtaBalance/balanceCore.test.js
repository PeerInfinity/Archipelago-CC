import { describe, it, expect } from 'vitest';

import {
    invertCalibration,
    targetGapForMilestone,
    extractLocationEntries,
    buildPlan,
} from './balanceCore.js';

// The shape derive-calibration.mjs emits for the standalone zone<=14 anchor.
const CURVE = [
    { estimate: 0, actualP50: 6 },
    { estimate: 1, actualP50: 6 },
    { estimate: 2, actualP50: 8 },
    { estimate: 4, actualP50: 10 },
    { estimate: 8, actualP50: 14.697 },
    { estimate: 15.5, actualP50: 14.697 },
];

describe('invertCalibration', () => {
    it('clamps targets below the floor and flags them', () => {
        expect(invertCalibration(CURVE, 0)).toEqual({ estimate: 0, clamped: 'floor' });
        expect(invertCalibration(CURVE, 5)).toEqual({ estimate: 0, clamped: 'floor' });
        expect(invertCalibration(CURVE, 6)).toEqual({ estimate: 0, clamped: 'floor' });
    });

    it('clamps targets above the plateau to the CHEAPEST estimate that reaches it', () => {
        // Estimates 8 and 15.5 both predict 14.697 resets. Aiming at 15.5 would
        // buy a much larger cost_multiplier for exactly no extra pacing.
        expect(invertCalibration(CURVE, 20)).toEqual({ estimate: 8, clamped: 'plateau' });
        expect(invertCalibration(CURVE, 14.697)).toEqual({ estimate: 8, clamped: 'plateau' });
    });

    it('interpolates inside the reachable window', () => {
        const mid = invertCalibration(CURVE, 9);
        expect(mid.clamped).toBeNull();
        // 9 is halfway between actualP50 8 (est 2) and 10 (est 4).
        expect(mid.estimate).toBeCloseTo(3, 5);
    });

    it('is monotone non-decreasing in the target', () => {
        let prev = -Infinity;
        for (let t = 0; t <= 20; t += 0.5) {
            const { estimate } = invertCalibration(CURVE, t);
            expect(estimate).toBeGreaterThanOrEqual(prev);
            prev = estimate;
        }
    });

    it('takes the cheapest estimate that reaches a target inside a flat segment', () => {
        // A pooled (flat) isotonic segment carries no information about where
        // inside it the target lies.
        const flat = [
            { estimate: 0, actualP50: 5 },
            { estimate: 3, actualP50: 10 },
            { estimate: 9, actualP50: 10 },
        ];
        expect(invertCalibration(flat, 10)).toEqual({ estimate: 3, clamped: 'plateau' });
        expect(invertCalibration(flat, 7.5).estimate).toBeCloseTo(1.5, 5);
    });
});

describe('targetGapForMilestone', () => {
    const anchor = [0, 4, 8, 12, 16];

    it('replays the curve by position, not by index', () => {
        // 5 milestones onto a 5-point curve is the identity.
        for (let i = 0; i < 5; i++) {
            expect(targetGapForMilestone(anchor, i, 5)).toBeCloseTo(anchor[i], 5);
        }
    });

    it('stretches a shorter milestone list across the whole curve', () => {
        // 3 milestones sample positions 0, 2, 4 — start, middle, end.
        expect(targetGapForMilestone(anchor, 0, 3)).toBeCloseTo(0, 5);
        expect(targetGapForMilestone(anchor, 1, 3)).toBeCloseTo(8, 5);
        expect(targetGapForMilestone(anchor, 2, 3)).toBeCloseTo(16, 5);
    });

    it('interpolates between anchor points for a longer milestone list', () => {
        // 9 milestones: milestone 1 sits at position 0.5, between 0 and 4.
        expect(targetGapForMilestone(anchor, 1, 9)).toBeCloseTo(2, 5);
    });

    it('applies seeded jitter without going negative', () => {
        const rng = () => 0;   // -1 * jitter => the most negative excursion
        expect(targetGapForMilestone(anchor, 0, 5, { rng, jitter: 0.5 })).toBe(0);
        expect(targetGapForMilestone(anchor, 4, 5, { rng, jitter: 0.5 })).toBeCloseTo(8, 5);
        const hi = () => 1;
        expect(targetGapForMilestone(anchor, 4, 5, { rng: hi, jitter: 0.5 })).toBeCloseTo(24, 5);
    });
});

const sphereLog = [
    { type: 'metadata', seed: 1 },
    {
        type: 'state_update',
        sphere_index: '0',
        player_data: { 1: { sphere_locations: [], new_inventory_details: { base_items: {} } } },
    },
    {
        type: 'state_update',
        sphere_index: '0.1',
        player_data: { 1: { sphere_locations: ['r0__10'], new_inventory_details: { base_items: { 'JtA Filler': 1 } } } },
    },
    {
        type: 'state_update',
        sphere_index: '0.2',
        player_data: { 1: { sphere_locations: ['r0__13'], new_inventory_details: { base_items: { 'How to Read': 1 } } } },
    },
    {
        type: 'state_update',
        sphere_index: '1.1',
        player_data: { 1: { sphere_locations: ['r1__27'], new_inventory_details: { base_items: { 'How to Write': 1 } } } },
    },
    {
        type: 'state_update',
        sphere_index: '1.2',
        player_data: { 1: { sphere_locations: ['r1__29'], new_inventory_details: { base_items: { 'JtA Filler': 1 } } } },
    },
];

describe('extractLocationEntries', () => {
    it('flattens to an ordered walk, skipping spheres that check nothing', () => {
        const entries = extractLocationEntries(sphereLog, 1);
        expect(entries.map((e) => e.location)).toEqual(['r0__10', 'r0__13', 'r1__27', 'r1__29']);
        expect(entries[1].items).toEqual(['How to Read']);
    });

    it('accepts a string player id (rules.json keys are strings)', () => {
        expect(extractLocationEntries(sphereLog, '1')).toHaveLength(4);
    });

    it('returns nothing for a player with no data in the log', () => {
        expect(extractLocationEntries(sphereLog, 2)).toEqual([]);
    });
});

describe('buildPlan', () => {
    const apLocations = { r0__10: 10, r0__13: 13, r1__27: 27, r1__29: 29 };
    const perkItemNames = ['How to Read', 'How to Write'];

    it('ends a step at each perk milestone, and trails the remainder', () => {
        const steps = buildPlan(extractLocationEntries(sphereLog, 1), { apLocations, perkItemNames });
        expect(steps).toHaveLength(3);
        expect(steps[0]).toMatchObject({ tasks: [10, 13], milestone: 13, milestonePerk: 'How to Read' });
        expect(steps[1]).toMatchObject({ tasks: [27], milestone: 27, milestonePerk: 'How to Write' });
        // Trailing step has no milestone — its tasks get default/tail costs.
        expect(steps[2]).toMatchObject({ tasks: [29], milestone: null });
    });

    it('skips locations with no jta task mapping (other players, other substrates)', () => {
        const entries = extractLocationEntries(sphereLog, 1);
        const steps = buildPlan(entries, { apLocations: { r0__13: 13 }, perkItemNames });
        expect(steps).toHaveLength(1);
        expect(steps[0].tasks).toEqual([13]);
    });

    it('records every item the walk grants, not just perks', () => {
        const steps = buildPlan(extractLocationEntries(sphereLog, 1), { apLocations, perkItemNames });
        expect(steps[0].grants).toEqual(['JtA Filler', 'How to Read']);
    });
});
