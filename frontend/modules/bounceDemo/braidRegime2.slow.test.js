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

// Column-FALLBACK cases. The braid gates every item type, but only as a single
// NESTED chain; what it still can't express — two arrows, or mutually-
// incomparable non-brown reqs — must NOT abort: braid mode falls back to the
// column proposer for that region (the bot handles both layouts; the grower
// guarantees column-compatibility, so the column always builds). The fallback
// is a column (width !== braid's 240) whose rules still match the requirement.
// SLOW (lives here, not the fast file): the column proposer + the full
// deriveAccessRules oracle run ~6s each and flake on the fast suite's
// non-interruptible 10s timeout under parallel contention (vitest.config.js).
describe('braid Regime 2 — falls back to a column when out of braid vocabulary', () => {
    const ruleFor = (d, kind, id) => formatRule(d[kind][id].minimalSets);
    const expectColumnFallback = (exits, pickups = []) => {
        const level = gen(exits, pickups, 1, 'right');
        expect(validateLevel(level), 'model errors').toEqual([]);
        expect(level.size.width, 'should be a column, not a 240 braid').not.toBe(W);
        const d = deriveAccessRules(level, { constants: C });
        expect(d.defects, 'column defects').toEqual([]);
        for (const s of exits) {
            expect(ruleFor(d, 'exits', s.id), `exit ${s.id}`).toBe(wantRule(s.requirement));
        }
        for (const s of pickups) {
            expect(ruleFor(d, 'pickups', s.id), `pickup ${s.id}`).toBe(wantRule(s.requirement));
        }
    };

    it('both arrows in one region → column', () => {
        expectColumnFallback([
            { id: 'gl', requirement: ['left'], direction: 'up' },
            { id: 'gr', requirement: ['right'], direction: 'right' },
        ]);
    });

    it('mutually-incomparable requirements (left vs blue) → column', () => {
        // Neither [left] nor [blue] is a subset of the other, so they can't both
        // live in one nested braid chain. The column hosts it (blue column-top +
        // left branch tip) — and unlike two arrowless gates, the grower's veto
        // permits this (≤1 arrowless), so it's a real fallback, not an abort.
        expectColumnFallback([
            { id: 'gl', requirement: ['left'], direction: 'right' },
            { id: 'gb', requirement: ['blue'], direction: 'up' },
        ]);
    });
});

// platformRows safety, the FULL-solver cross-check matrix (slow: the full-graph
// derive on the taller padded levels is the expensive part). The headline claim
// — extra plain rows never change gating — proven across values × seeds × shapes.
describe('braid Regime 2 — platformRows preserves gating (full-solver matrix)', () => {
    const ruleFor = (d, kind, id) => formatRule(d[kind][id].minimalSets);
    const shapes = [
        { name: 'blue → blue+left', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
        ] },
        { name: 'single arrow', exits: [
            { id: 'g', requirement: ['left'], direction: 'up' },
        ] },
    ];
    for (const shape of shapes) {
        for (const rows of [3, 7, 12]) {
            it(`${shape.name} @ platformRows=${rows} keeps every gate (seeds 1-3)`, () => {
                for (let seed = 1; seed <= 3; seed++) {
                    const level = generateLevelFromSpecs({
                        id: `RR${seed}`, exitSpecs: shape.exits, seed, physics: 'dj',
                        mode: 'braid', braidWidth: W, freeArrow: 'right', platformRows: rows,
                    });
                    expect(validateLevel(level), 'model').toEqual([]);
                    const opts = { constants: C, freeArrow: 'right', freeAbilities: ['right'], terminalPortals: true };
                    const braid = deriveBraidAccessRules(level, opts);
                    const full = deriveAccessRules(level, opts);
                    expect(braid.defects).toEqual([]);
                    expect(full.defects).toEqual([]);
                    for (const s of shape.exits) {
                        expect(ruleFor(braid, 'exits', s.id), `${s.id} braid`).toBe(wantRule(s.requirement));
                        expect(braid.exits[s.id].minimalSets, `${s.id} full==braid`)
                            .toEqual(full.exits[s.id].minimalSets);
                    }
                }
            });
        }
    }

    // Decorative fork/merge/brown (+ companion jitter) must leave every gate
    // untouched — the expensive case (forks widen the level; brown triggers
    // broken-state search; jitter varies the fork width). `jitter` rides the
    // config but is passed as the generator's jitter arg, not in decorChance.
    for (const decor of [
        { fork: 0.8 }, { fork: 0.8, brown: 0.7 }, { fork: 0.8, jitter: 40 },
        { blue: 1, fork: 0.8, brown: 0.7, jitter: 40 },
    ]) {
        it(`decor ${JSON.stringify(decor)} preserves the blue→blue+left gates (seeds 1-4)`, () => {
            const { jitter = 0, ...decorChance } = decor;
            const exits = shapes[0].exits; // blue → blue+left
            for (let seed = 1; seed <= 4; seed++) {
                const level = generateLevelFromSpecs({
                    id: `RD${seed}`, exitSpecs: exits, seed, physics: 'dj', mode: 'braid',
                    braidWidth: W, freeArrow: 'right', platformRows: 6, decorChance, jitter,
                });
                expect(validateLevel(level), 'model').toEqual([]);
                const opts = { constants: C, freeArrow: 'right', freeAbilities: ['right'], terminalPortals: true };
                const braid = deriveBraidAccessRules(level, opts);
                const full = deriveAccessRules(level, opts);
                expect(braid.defects, `seed ${seed} braid defects`).toEqual([]);
                expect(full.defects, `seed ${seed} full defects`).toEqual([]);
                for (const s of exits) {
                    expect(ruleFor(braid, 'exits', s.id), `${s.id} braid`).toBe(wantRule(s.requirement));
                    expect(braid.exits[s.id].minimalSets, `${s.id} full==braid`)
                        .toEqual(full.exits[s.id].minimalSets);
                }
            }
        });
    }
});
