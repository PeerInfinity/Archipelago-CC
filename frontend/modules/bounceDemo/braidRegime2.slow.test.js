/**
 * Step 5 of braid Regime 2 — slow property suite for the GATED braid proposer.
 *
 * Fuzz the proposer across many seeds and gate shapes (single arrow, blue, and
 * nested arrow+blue graded chains). For every generated region we assert the
 * row-aware deriveBraidAccessRules agrees with the full-graph deriveAccessRules
 * AND that each goal's minimal sets equal its requirement — the property the
 * column path proves with deriveAccessRules. The generator already verifies
 * with the row-aware flood, so this guards the FULL-solver equivalence (the
 * thing the row-aware shortcut could silently diverge on).
 *
 * Kept lean: blue gates make the full solver enumerate phases, so we cross-check
 * full only on the arrow-only shapes every seed and the blue shapes on a few.
 */
import { describe, it, expect } from 'vitest';
import { generateLevelFromSpecs } from './generator.js';
import { deriveAccessRules, deriveBraidAccessRules, formatRule } from './deriveRules.js';
import { validateLevel } from './level.js';
import { PROFILES } from './physics.js';

const C = PROFILES.dj.constants;
const W = 240;

function gen(exitSpecs, pickupSpecs, seed, freeArrow) {
    return generateLevelFromSpecs({
        id: `R${seed}`, exitSpecs, pickupSpecs, seed, physics: 'dj',
        mode: 'braid', braidWidth: W, freeArrow,
    });
}
const wantRule = (req) => (req.length ? `(${[...req].sort().join(' AND ')})` : 'ALWAYS');

// Region shapes (one gating arrow per region; nested reqs). `arrow` flips
// left/right per seed so both directions are exercised.
function shapes(arrow) {
    return [
        { name: 'arrow only', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'g', requirement: [arrow], direction: 'right' },
        ], pickups: [], crossFull: true },
        { name: 'arrow + arrow pickup', exits: [
            { id: 'g', requirement: [arrow], direction: 'up' },
        ], pickups: [{ id: 'pk', requirement: [arrow] }], crossFull: true },
        { name: 'blue then blue+arrow', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gba', requirement: ['blue', arrow], direction: 'left' },
        ], pickups: [], crossFull: false },
    ];
}

function assertRegion(level, exits, pickups, crossFull, freeArrow) {
    expect(validateLevel(level)).toEqual([]);
    const opts = { constants: C, freeArrow, freeAbilities: [freeArrow], terminalPortals: true };
    const braid = deriveBraidAccessRules(level, opts);
    expect(braid.defects).toEqual([]);
    const full = crossFull ? deriveAccessRules(level, opts) : null;
    for (const s of [...exits, ...pickups]) {
        const got = (braid.exits[s.id] ?? braid.pickups[s.id]).minimalSets;
        expect(formatRule(got), `${s.id} rule`).toBe(wantRule(s.requirement));
        if (full) {
            const fgot = (full.exits[s.id] ?? full.pickups[s.id]).minimalSets;
            expect(got, `${s.id} braid==full`).toEqual(fgot);
        }
    }
    if (full) expect(full.defects).toEqual([]);
}

describe('braid Regime 2 — proposer fuzz (gated chains verify against the full solver)', () => {
    const SEEDS = 10;
    for (let seed = 1; seed <= SEEDS; seed++) {
        const arrow = seed % 2 ? 'left' : 'right';
        // The gated arrow is NOT the free one; the player holds the complement.
        const freeArrow = arrow === 'left' ? 'right' : 'left';
        for (const sh of shapes(arrow)) {
            it(`seed ${seed} (gate ${arrow}, free ${freeArrow}): ${sh.name}`, () => {
                const level = gen(sh.exits, sh.pickups, seed, freeArrow);
                assertRegion(level, sh.exits, sh.pickups, sh.crossFull, freeArrow);
            });
        }
    }
});
