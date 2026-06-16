/**
 * Step 1 of braid Regime 2 (NewDocs/plans/procedural-generation/braid-regime2.md):
 * deriveBraidAccessRules — the per-subset minimal-set table over the cheap
 * row-aware flood — must AGREE with the full-graph deriveAccessRules on
 * FORK-FREE gated chains (Regime-2 geometry), under every ability subset.
 *
 * Fork-free is the precondition: one climbable platform per row, so down /
 * within-row-wrap edges are redundant and adjacent-row flooding is
 * verdict-identical to the full solver for ALL ability subsets (not just full).
 */
import { describe, it, expect } from 'vitest';
import { deriveAccessRules, deriveBraidAccessRules, formatRule } from './deriveRules.js';
import { PROFILES } from './physics.js';

const C = PROFILES.dj.constants;
const W = 240;
const PLAIN_DY = 90;

// Build a fork-free single-platform chain the way proposeBraidLevel lays one
// out (row 0 at the bottom, rows stacked upward, then a uniform y-shift), so
// the entrance reaches the bottom platform exactly as in a real braid. Each
// rung is { dx, type? }: dx is the x-offset from the previous rung (0 = a
// straight, arrow-free step; ±40 lands in one arrow's reach zone). The goal
// (a portal) sits on the top rung.
function chain(rungs) {
    const platforms = [];
    let x = W / 2;
    let y = 0;
    platforms.push({ id: 'b0', x, y, type: 'green' }); // row 0 = entrance landing
    rungs.forEach((r, i) => {
        y -= PLAIN_DY;
        x = (((x + (r.dx ?? 0)) % W) + W) % W;
        platforms.push({ id: `b${i + 1}`, x, y, type: r.type ?? 'green' });
    });
    let minY = 0;
    for (const p of platforms) minY = Math.min(minY, p.y);
    const shiftY = 60 - minY;
    for (const p of platforms) p.y += shiftY;
    const top = platforms[platforms.length - 1];
    const level = {
        id: 'chain', size: { width: W, height: shiftY + 100 },
        platforms, springs: [], jetpacks: [], pickups: [],
        portals: [{ id: 'goal', x: top.x, y: top.y - 20, on: top.id, target_region: null, direction: 'up' }],
    };
    // moving-blue sweeps run the full width (dj), assigned post-shift
    for (const p of platforms) {
        if (p.type === 'blue') p.sweep = { min: 10, max: W - 10 };
    }
    return level;
}

const ruleOf = (d) => formatRule(d.exits.goal.minimalSets);

describe('deriveBraidAccessRules — agrees with full solver on fork-free chains', () => {
    const cases = [
        { name: 'free straight chain', rungs: [{ dx: 0 }, { dx: 0 }, { dx: 0 }], expect: 'ALWAYS' },
        { name: 'left-gated', rungs: [{ dx: -40 }, { dx: 0 }], expect: '(left)' },
        { name: 'right-gated', rungs: [{ dx: 40 }, { dx: 0 }], expect: '(right)' },
        { name: 'left then straight', rungs: [{ dx: -40 }, { dx: 0 }, { dx: 0 }], expect: '(left)' },
        { name: 'blue-gated straight', rungs: [{ dx: 0, type: 'blue' }, { dx: 0 }], expect: '(blue)' },
    ];

    for (const tc of cases) {
        it(`${tc.name}: braid derive == full derive, rule = ${tc.expect}`, () => {
            const level = chain(tc.rungs);
            const full = deriveAccessRules(level, { constants: C });
            const braid = deriveBraidAccessRules(level, { constants: C });
            // No defects either way (every rung reachable with the right items).
            expect(full.defects, 'full defects').toEqual([]);
            expect(braid.defects, 'braid defects').toEqual([]);
            // Identical minimal sets for the goal, and the expected rule.
            expect(braid.exits.goal.minimalSets).toEqual(full.exits.goal.minimalSets);
            expect(ruleOf(braid)).toBe(tc.expect);
        });
    }
});
