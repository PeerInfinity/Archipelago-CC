import { describe, it, expect } from 'vitest';
import {
    abilityUniverse,
    deriveAccessRules,
    formatRule,
} from './deriveRules.js';
import { bounceStack } from './fixtures/bounceStack.js';
import { springGap } from './fixtures/springGap.js';
import { fork } from './fixtures/fork.js';

describe('abilityUniverse', () => {
    it('arrows always; features only when the geometry exists', () => {
        expect(abilityUniverse(bounceStack)).toEqual(['left', 'right']);
        expect(abilityUniverse(springGap)).toEqual(['left', 'right', 'springs']);
        expect(abilityUniverse(fork)).toEqual(['left', 'right', 'jetpacks', 'blue']);
    });
});

describe('derived rules match fixture ground truth', () => {
    it('bounce_stack: everything ALWAYS reachable', () => {
        const r = deriveAccessRules(bounceStack);
        expect(r.pickups.loc_arrow.minimalSets).toEqual([[]]);
        expect(r.exits.exit_up.minimalSets).toEqual([[]]);
        expect(formatRule(r.pickups.loc_arrow.minimalSets)).toBe('ALWAYS');
        expect(r.defects).toEqual([]);
    });

    it('spring_gap: pickup and exit require exactly {springs}', () => {
        const r = deriveAccessRules(springGap);
        expect(r.pickups.loc_spring.minimalSets).toEqual([['springs']]);
        expect(r.exits.exit_up.minimalSets).toEqual([['springs']]);
        expect(formatRule(r.exits.exit_up.minimalSets)).toBe('(springs)');
        expect(r.defects).toEqual([]);
    });

    it('fork: branch requirements derived; jetpack provably not required', () => {
        const r = deriveAccessRules(fork);
        expect(r.pickups.loc_right.minimalSets).toEqual([['right']]);
        expect(r.pickups.loc_left.minimalSets).toEqual([['blue', 'left']]);
        expect(r.exits.exit_up.minimalSets).toEqual([['right']]);
        expect(formatRule(r.pickups.loc_left.minimalSets)).toBe('(blue AND left)');
        // helpful-but-not-required, machine-verified:
        for (const s of Object.values(r.pickups).flatMap((g) => g.minimalSets)) {
            expect(s).not.toContain('jetpacks');
        }
        expect(r.defects).toEqual([]);
    });
});

describe('verifier defect detection', () => {
    it('unreachable decorative platforms are NOT defects (skipping is normal)', () => {
        const level = {
            id: 'decor',
            size: { width: 400, height: 1200 },
            platforms: [
                { id: 'p0', x: 200, y: 1100, type: 'green' },
                { id: 'p1', x: 200, y: 980, type: 'green' },
                // decorative: far up-left corner, unreachable, no goal on it
                { id: 'decor', x: 60, y: 100, type: 'green' },
            ],
            springs: [],
            jetpacks: [],
            pickups: [{ id: 'loc', x: 200, y: 960, on: 'p1' }],
            portals: [{ id: 'exit_up', x: 200, y: 880, target_region: null, direction: 'up' }],
        };
        const r = deriveAccessRules(level);
        expect(r.defects).toEqual([]);
        expect(r.pickups.loc.minimalSets).toEqual([[]]);
    });

    it('a pickup whose host is unreachable under every set IS a defect', () => {
        const level = {
            id: 'stranded',
            size: { width: 400, height: 1200 },
            platforms: [
                { id: 'p0', x: 200, y: 1100, type: 'green' },
                { id: 'island', x: 200, y: 400, type: 'green' }, // 700 up, no boosters
            ],
            springs: [],
            jetpacks: [],
            pickups: [{ id: 'loc_island', x: 200, y: 380, on: 'island' }],
            portals: [{ id: 'exit_up', x: 200, y: 1000, target_region: null, direction: 'up' }],
        };
        const r = deriveAccessRules(level);
        expect(r.pickups.loc_island.minimalSets).toEqual([]);
        expect(formatRule(r.pickups.loc_island.minimalSets)).toBe('IMPOSSIBLE');
        expect(r.defects).toEqual(
            expect.arrayContaining([expect.stringContaining("pickup 'loc_island'")]));
    });

    it('detects non-monotone gating: an unlocked blue platform intercepts a spring route', () => {
        // A's spring (apex 484) reaches B at 400px up. Unlocking blue
        // activates C *between* apex and B in the same column — the
        // descent now lands on C first, and C's plain bounce cannot
        // reach B back. Gaining the blue item LOSES access to B's
        // pickup: exactly what AP rules must never encode.
        const level = {
            id: 'interceptor',
            size: { width: 400, height: 1200 },
            platforms: [
                { id: 'a', x: 200, y: 1100, type: 'green' },
                { id: 'b', x: 200, y: 700, type: 'green' },
                { id: 'c', x: 200, y: 650, type: 'blue' },
            ],
            springs: [{ id: 's', x: 200, y: 1095, on: 'a' }],
            jetpacks: [],
            pickups: [{ id: 'loc_b', x: 200, y: 680, on: 'b' }],
            portals: [{ id: 'exit_up', x: 200, y: 1000, target_region: null, direction: 'up' }],
        };
        const r = deriveAccessRules(level);
        expect(r.pickups.loc_b.violations).toEqual(
            expect.arrayContaining([
                { subset: 'springs', superset: 'blue+springs' },
            ]));
        expect(r.defects).toEqual(
            expect.arrayContaining([expect.stringContaining('NON-MONOTONE')]));
    });
});
