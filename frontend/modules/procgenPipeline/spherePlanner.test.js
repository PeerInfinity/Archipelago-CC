import { describe, it, expect } from 'vitest';

import { planSpheres, validateSpherePlan } from './spherePlanner.js';

// Bounce-flavored pool: six abilities + Victory (counts 1), plus a
// couple of maze-flavored multi-count items for mixed-run shapes.
const ABILITIES = ['Right arrow', 'Left arrow', 'Springs', 'Jetpacks',
    'Blue platforms', 'Brown platforms'];
const BOUNCE_POOL = Object.fromEntries(
    [...ABILITIES, 'Victory'].map((name) => [name, 1]));
const MIXED_POOL = { ...BOUNCE_POOL, key_red: 3, key_blue: 2, map: 1 };

function flatItems(plan) {
    return plan.spheres.flatMap((s) => s.items);
}

describe('planSpheres — sizing', () => {
    it('uses an explicit sphereCount', () => {
        const plan = planSpheres({ itemPool: BOUNCE_POOL, sphereCount: 3, seed: 1 });
        expect(plan.spheres.length).toBe(3);
        expect(plan.spheres.map((s) => s.sphere)).toEqual([1, 2, 3]);
    });

    it('derives sphere count from itemsPerSphere', () => {
        // 13 items / 4 per sphere → ceil = 4 spheres
        const plan = planSpheres({ itemPool: MIXED_POOL, itemsPerSphere: 4, seed: 1 });
        expect(plan.spheres.length).toBe(4);
    });

    it('requires exactly one of sphereCount / itemsPerSphere', () => {
        expect(() => planSpheres({ itemPool: BOUNCE_POOL }))
            .toThrow(/exactly one of/);
        expect(() => planSpheres({ itemPool: BOUNCE_POOL, sphereCount: 2, itemsPerSphere: 2 }))
            .toThrow(/exactly one of/);
    });

    it('rejects more spheres than items', () => {
        expect(() => planSpheres({ itemPool: { a: 2 }, sphereCount: 3 }))
            .toThrow(/at least 3 items/);
    });

    it('supports the degenerate single-sphere plan', () => {
        const plan = planSpheres({ itemPool: BOUNCE_POOL, sphereCount: 1, seed: 1 });
        expect(plan.spheres.length).toBe(1);
        expect(plan.spheres[0].items.length).toBe(7);
    });
});

describe('planSpheres — distribution', () => {
    it('assigns every pool instance exactly once (multiset preserved)', () => {
        const plan = planSpheres({ itemPool: MIXED_POOL, sphereCount: 4, seed: 5 });
        expect(validateSpherePlan(plan, { itemPool: MIXED_POOL })).toEqual([]);
        expect(flatItems(plan).length).toBe(13);
    });

    it('balances sphere sizes within one item when unconstrained', () => {
        const plan = planSpheres({ itemPool: MIXED_POOL, sphereCount: 4, seed: 2 });
        const sizes = plan.spheres.map((s) => s.items.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    });

    it('is deterministic for a given seed', () => {
        const a = planSpheres({ itemPool: MIXED_POOL, sphereCount: 4, seed: 7 });
        const b = planSpheres({ itemPool: MIXED_POOL, sphereCount: 4, seed: 7 });
        expect(a).toEqual(b);
    });

    it('varies with the seed', () => {
        const a = planSpheres({ itemPool: MIXED_POOL, sphereCount: 4, seed: 1 });
        const b = planSpheres({ itemPool: MIXED_POOL, sphereCount: 4, seed: 2 });
        expect(a).not.toEqual(b);
    });

    it('spreads multi-count items as individual instances', () => {
        const pool = { key_red: 5, filler: 5 };
        const plan = planSpheres({ itemPool: pool, sphereCount: 5, seed: 3 });
        expect(validateSpherePlan(plan, { itemPool: pool })).toEqual([]);
        // 10 instances over 5 spheres → 2 each
        expect(plan.spheres.every((s) => s.items.length === 2)).toBe(true);
    });
});

describe('planSpheres — pins and victory', () => {
    it('pins all instances of an item to its sphere', () => {
        const plan = planSpheres({
            itemPool: MIXED_POOL,
            sphereCount: 4,
            pins: { key_red: 2 },
            seed: 1,
        });
        const sphere2 = plan.spheres[1].items.filter((n) => n === 'key_red');
        expect(sphere2.length).toBe(3);
        expect(flatItems(plan).filter((n) => n === 'key_red').length).toBe(3);
    });

    it('pins victoryItem to the final sphere', () => {
        const plan = planSpheres({
            itemPool: BOUNCE_POOL,
            sphereCount: 3,
            victoryItem: 'Victory',
            seed: 1,
        });
        expect(plan.spheres[2].items).toContain('Victory');
        expect(plan.spheres[0].items).not.toContain('Victory');
        expect(plan.spheres[1].items).not.toContain('Victory');
    });

    it('the arrows-bootstrap pattern: arrows pinned to sphere 1', () => {
        const plan = planSpheres({
            itemPool: BOUNCE_POOL,
            sphereCount: 4,
            pins: { 'Right arrow': 1, 'Left arrow': 1 },
            victoryItem: 'Victory',
            seed: 9,
        });
        expect(plan.spheres[0].items).toContain('Right arrow');
        expect(plan.spheres[0].items).toContain('Left arrow');
        expect(plan.spheres[3].items).toContain('Victory');
        expect(validateSpherePlan(plan, { itemPool: BOUNCE_POOL })).toEqual([]);
    });

    it('rejects a victoryItem pin conflict', () => {
        expect(() => planSpheres({
            itemPool: BOUNCE_POOL,
            sphereCount: 3,
            pins: { Victory: 1 },
            victoryItem: 'Victory',
        })).toThrow(/conflicts/);
    });

    it('rejects pins outside 1..N and pins of absent items', () => {
        expect(() => planSpheres({
            itemPool: BOUNCE_POOL, sphereCount: 3, pins: { Springs: 4 },
        })).toThrow(/valid: 1\.\.3/);
        expect(() => planSpheres({
            itemPool: BOUNCE_POOL, sphereCount: 3, pins: { nosuch: 1 },
        })).toThrow(/not in the pool/);
        expect(() => planSpheres({
            itemPool: BOUNCE_POOL, sphereCount: 3, victoryItem: 'nosuch',
        })).toThrow(/not in the pool/);
    });

    it('fails loudly when pins leave a sphere empty', () => {
        // 3 items all pinned to sphere 1 of 3 → spheres 2,3 empty.
        expect(() => planSpheres({
            itemPool: { a: 1, b: 1, c: 1 },
            sphereCount: 3,
            pins: { a: 1, b: 1, c: 1 },
        })).toThrow(/ended up empty/);
    });
});

describe('planSpheres — exclusive spheres', () => {
    it('an exclusive sphere contains exactly its items and is closed', () => {
        const plan = planSpheres({
            itemPool: BOUNCE_POOL,
            sphereCount: 4,
            exclusiveSpheres: { 1: ['Right arrow'] },
            victoryItem: 'Victory',
            seed: 3,
        });
        expect(plan.spheres[0].items).toEqual(['Right arrow']);
        expect(validateSpherePlan(plan, { itemPool: BOUNCE_POOL })).toEqual([]);
        // remaining items balance across the OPEN spheres only
        const sizes = plan.spheres.slice(1).map((s) => s.items.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    });

    it('rejects conflicts: foreign pin into an exclusive sphere, victory excluded', () => {
        expect(() => planSpheres({
            itemPool: BOUNCE_POOL,
            sphereCount: 3,
            exclusiveSpheres: { 1: ['Right arrow'] },
            pins: { Springs: 1 },
        })).toThrow(/targets exclusive sphere 1/);
        expect(() => planSpheres({
            itemPool: BOUNCE_POOL,
            sphereCount: 3,
            exclusiveSpheres: { 3: ['Springs'] },
            victoryItem: 'Victory',
        })).toThrow(/final sphere is exclusive/);
        expect(() => planSpheres({
            itemPool: BOUNCE_POOL,
            sphereCount: 3,
            exclusiveSpheres: { 5: ['Springs'] },
        })).toThrow(/out of range/);
    });

    it('gateability accepts a gateable exclusive sphere and rejects a bare one', () => {
        const pool = { ability_a: 1, junk: 3, oddity: 1 };
        const plan = planSpheres({
            itemPool: pool,
            sphereCount: 2,
            exclusiveSpheres: { 1: ['ability_a'] },
            gateableItems: ['ability_a'],
            seed: 1,
        });
        expect(plan.spheres[0].items).toEqual(['ability_a']);
        expect(() => planSpheres({
            itemPool: pool,
            sphereCount: 3,
            exclusiveSpheres: { 1: ['junk'] },
            gateableItems: ['ability_a'],
            seed: 1,
        })).toThrow(/exclusive sphere 1 has no gateable item/);
    });
});

describe('planSpheres — gateability', () => {
    it('guarantees a gateable item in every sphere but the last', () => {
        // 2 gateables among 8 items, 3 spheres → spheres 1 and 2 must
        // each get one, regardless of where the shuffle would put them.
        const pool = { ability_a: 1, ability_b: 1, junk: 6 };
        for (let seed = 1; seed <= 10; seed++) {
            const plan = planSpheres({
                itemPool: pool,
                sphereCount: 3,
                gateableItems: ['ability_a', 'ability_b'],
                seed,
            });
            expect(validateSpherePlan(plan, {
                itemPool: pool,
                gateableItems: ['ability_a', 'ability_b'],
            })).toEqual([]);
        }
    });

    it('counts pinned gateables toward the requirement', () => {
        const pool = { ability_a: 1, junk: 3 };
        const plan = planSpheres({
            itemPool: pool,
            sphereCount: 2,
            pins: { ability_a: 1 },
            gateableItems: ['ability_a'],
            seed: 1,
        });
        expect(plan.spheres[0].items).toContain('ability_a');
    });

    it('throws when the pool cannot satisfy the constraint', () => {
        // 1 gateable, 4 spheres → spheres 1..3 need gateables, only 1 exists.
        expect(() => planSpheres({
            itemPool: { ability_a: 1, junk: 6 },
            sphereCount: 4,
            gateableItems: ['ability_a'],
        })).toThrow(/cannot support 4 spheres/);
    });

    it('final sphere needs no gateable item', () => {
        // Exactly N-1 gateables is satisfiable.
        const pool = { ability_a: 2, junk: 4 };
        const plan = planSpheres({
            itemPool: pool,
            sphereCount: 3,
            gateableItems: ['ability_a'],
            seed: 4,
        });
        expect(validateSpherePlan(plan, {
            itemPool: pool, gateableItems: ['ability_a'],
        })).toEqual([]);
    });
});

describe('validateSpherePlan', () => {
    it('accepts planner output', () => {
        const plan = planSpheres({ itemPool: MIXED_POOL, sphereCount: 4, seed: 1 });
        expect(validateSpherePlan(plan, { itemPool: MIXED_POOL })).toEqual([]);
    });

    it('flags bad numbering, empty spheres, and multiset drift', () => {
        const errors = validateSpherePlan({
            seed: 1,
            spheres: [
                { sphere: 1, items: ['a'] },
                { sphere: 3, items: [] },
            ],
        }, { itemPool: { a: 1, b: 1 } });
        expect(errors.some((e) => e.includes('expected 2'))).toBe(true);
        expect(errors.some((e) => e.includes('no items'))).toBe(true);
        expect(errors.some((e) => e.includes("'b'"))).toBe(true);
    });

    it('flags surplus items not in the pool', () => {
        const errors = validateSpherePlan({
            seed: 1,
            spheres: [{ sphere: 1, items: ['a', 'ghost'] }],
        }, { itemPool: { a: 1 } });
        expect(errors.some((e) => e.includes("'ghost'"))).toBe(true);
    });

    it('flags a sphere without a gateable item', () => {
        const errors = validateSpherePlan({
            seed: 1,
            spheres: [
                { sphere: 1, items: ['junk'] },
                { sphere: 2, items: ['ability_a'] },
            ],
        }, { gateableItems: ['ability_a'] });
        expect(errors).toEqual(['sphere 1 has no gateable item']);
    });

    it('rejects a structurally empty plan', () => {
        expect(validateSpherePlan(null)).toEqual(['plan.spheres must be a non-empty array']);
        expect(validateSpherePlan({ spheres: [] }))
            .toEqual(['plan.spheres must be a non-empty array']);
    });
});
