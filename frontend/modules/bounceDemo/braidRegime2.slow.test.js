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
    const SEEDS = 6;
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

// platformRows / decor / jitter safety matrix. The headline claim — padding,
// decorations and spine jitter never change a gate's REQUIREMENT — is proven
// cheaply with the suppressed braid derive across values × seeds × shapes. The
// ferry-aware full-graph cross-check (slow on blue) is reserved for the unique
// thing it adds — flood==full-graph on NON-blue fork/jitter braids — plus a few
// 1-seed blue canaries; suppression soundness on blue itself is the corpus block
// and the deriveBraidRules fuzz. (Seeds trimmed: blue suppression is geometry-
// independent of green padding/forks, so a handful of representative cells suffice.)
describe('braid Regime 2 — platformRows preserves gating (full-solver matrix)', () => {
    const ruleFor = (d, kind, id) => formatRule(d[kind][id].minimalSets);
    const opts = { constants: C, freeArrow: 'right', freeAbilities: ['right'], terminalPortals: true };
    // A blue shape's full-graph derive is ferry-aware (it enumerates sweep phases
    // → slow). Suppression soundness on blue is covered by the corpus block and
    // the jittered-blue oracle tests below, so across this matrix we cross-check
    // braid==full only on NON-blue shapes (cheap, and the unique check that
    // padding/jitter don't break the row-aware flood vs the full graph). On blue
    // shapes we assert just the cheap suppressed requirement, plus a 1-seed
    // ferry-aware canary per block.
    const usesBlue = (exits) => exits.some((e) => e.requirement.includes('blue'));
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
            it(`${shape.name} @ platformRows=${rows} keeps every gate (seeds 1-2)`, () => {
                for (let seed = 1; seed <= 2; seed++) {
                    const level = generateLevelFromSpecs({
                        id: `RR${seed}`, exitSpecs: shape.exits, seed, physics: 'dj',
                        mode: 'braid', braidWidth: W, freeArrow: 'right', platformRows: rows,
                    });
                    expect(validateLevel(level), 'model').toEqual([]);
                    const braid = deriveBraidAccessRules(level, opts);
                    expect(braid.defects).toEqual([]);
                    const full = usesBlue(shape.exits) ? null : deriveAccessRules(level, opts);
                    if (full) expect(full.defects).toEqual([]);
                    for (const s of shape.exits) {
                        expect(ruleFor(braid, 'exits', s.id), `${s.id} braid`).toBe(wantRule(s.requirement));
                        if (full) {
                            expect(braid.exits[s.id].minimalSets, `${s.id} full==braid`)
                                .toEqual(full.exits[s.id].minimalSets);
                        }
                    }
                }
            });
        }
    }

    it('padded blue→blue+left matches the ferry-aware full (canary, 1 seed @ rows 12)', () => {
        const exits = shapes[0].exits;
        const level = generateLevelFromSpecs({
            id: 'RRC', exitSpecs: exits, seed: 1, physics: 'dj',
            mode: 'braid', braidWidth: W, freeArrow: 'right', platformRows: 12,
        });
        const braid = deriveBraidAccessRules(level, opts);
        const full = deriveAccessRules(level, opts);
        expect(braid.defects).toEqual([]);
        expect(full.defects).toEqual([]);
        for (const s of exits) {
            expect(ruleFor(braid, 'exits', s.id)).toBe(wantRule(s.requirement));
            expect(braid.exits[s.id].minimalSets).toEqual(full.exits[s.id].minimalSets);
        }
    });

    // Decorations (fork/merge/brown + jitter) must leave every gate untouched.
    const decorConfigs = [
        { fork: 0.8 }, { fork: 0.8, brown: 0.7 }, { fork: 0.8, jitter: 40 },
        { blue: 1, fork: 0.8, brown: 0.7, jitter: 40 },
    ];
    const genDecor = (exits, seed, decor) => {
        const { jitter = 0, ...decorChance } = decor;
        return generateLevelFromSpecs({
            id: `RD${seed}`, exitSpecs: exits, seed, physics: 'dj', mode: 'braid',
            braidWidth: W, freeArrow: 'right', platformRows: 6, decorChance, jitter,
        });
    };

    // (1) CHEAP requirement claim: decor never changes a gate's requirement —
    //     the suppressed braid derive across every config (the blue→blue+left
    //     shape, since the blue:1 flavor needs a blue-held block).
    for (const decor of decorConfigs) {
        it(`decor ${JSON.stringify(decor)} preserves the blue→blue+left requirement (seeds 1-2)`, () => {
            const exits = shapes[0].exits; // blue → blue+left
            for (let seed = 1; seed <= 2; seed++) {
                const level = genDecor(exits, seed, decor);
                expect(validateLevel(level), 'model').toEqual([]);
                const braid = deriveBraidAccessRules(level, opts);
                expect(braid.defects, `seed ${seed}`).toEqual([]);
                for (const s of exits) {
                    expect(ruleFor(braid, 'exits', s.id), `${s.id} braid`).toBe(wantRule(s.requirement));
                }
            }
        });
    }

    // (2) Forks/brown/jitter don't break the row-aware flood vs the full graph —
    //     checked on a NON-blue shape (left → left+springs) so the full derive
    //     stays phase-free and cheap. The deriveBraidRules fuzz is fork-FREE, so
    //     this is the unique fork-on-the-flood cross-check.
    for (const decor of [{ fork: 0.8 }, { fork: 0.8, brown: 0.7, jitter: 40 }]) {
        it(`decor ${JSON.stringify(decor)} keeps flood==full on a non-blue fork braid (seeds 1-2)`, () => {
            const exits = [
                { id: 'free', requirement: [], direction: 'up' },
                { id: 'gl', requirement: ['left'], direction: 'right' },
                { id: 'gls', requirement: ['left', 'springs'], direction: 'left' },
            ];
            for (let seed = 1; seed <= 2; seed++) {
                const level = genDecor(exits, seed, decor);
                expect(validateLevel(level), 'model').toEqual([]);
                const braid = deriveBraidAccessRules(level, opts);
                const full = deriveAccessRules(level, opts);
                expect(braid.defects, `seed ${seed} braid`).toEqual([]);
                expect(full.defects, `seed ${seed} full`).toEqual([]);
                for (const s of exits) {
                    expect(ruleFor(braid, 'exits', s.id), `${s.id} braid`).toBe(wantRule(s.requirement));
                    expect(braid.exits[s.id].minimalSets, `${s.id} full==braid`)
                        .toEqual(full.exits[s.id].minimalSets);
                }
            }
        });
    }

    // NB: no ferry-aware cross-check of the blue:1 DECORATION config here. The
    // requirement-only test above already exercises it (decor never changes the
    // gate), and suppression soundness with extra blue stones is covered by the
    // corpus (vs exhaustive), the two jittered-blue oracle tests below, the
    // deriveBraidRules fuzz, and the padded-blue canary above — extra decorative
    // stones are per-blue-independent of those, and forks are green companions.

    // SPINE jitter (the coherent toward-free wander) is enabled for EVERY gate
    // type now — including MOVING BLUE, springs and jetpacks, which used to be
    // disabled/fragile. The wander walks each portal bypass into the tip window
    // (advanceToTipWindow) so it never re-gates at the wrap seam. Cross-check the
    // full solver: every gate must survive the wander at a large magnitude.
    for (const shape of [
        { name: 'left', exits: [{ id: 'g', requirement: ['left'], direction: 'up' }] },
        { name: 'left → left+springs', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
            { id: 'gls', requirement: ['left', 'springs'], direction: 'left' },
        ] },
        // Moving blue under jitter — the case this whole fix is about.
        { name: 'free → blue', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
        ] },
        { name: 'free → blue → blue+left', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
        ] },
        // A bare springs portal — used to THROW (no valid proposal) at small
        // jitter; now wanders cleanly at any magnitude.
        { name: 'free → springs', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gs', requirement: ['springs'], direction: 'right' },
        ] },
        // freeArrow='left' — the spine drifts toward the LEFT edge, gated arrow is
        // 'right'. This is the configuration the browser failed on (side_exit_N
        // [springs] derived [right, springs]); covers the integer-snap fix in the
        // mirrored direction. Blue exercises the slow moving-blue path too.
        { name: 'free → springs (freeArrow=left)', freeArrow: 'left', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gs', requirement: ['springs'], direction: 'right' },
        ] },
        { name: 'free → blue (freeArrow=left)', freeArrow: 'left', exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
        ] },
    ]) {
        const freeArrow = shape.freeArrow ?? 'right';
        it(`spine jitter preserves ${shape.name} gates (seeds 1-2, jitter 60)`, () => {
            for (let seed = 1; seed <= 2; seed++) {
                const level = generateLevelFromSpecs({
                    id: `RJ${seed}`, exitSpecs: shape.exits, seed, physics: 'dj', mode: 'braid',
                    braidWidth: W, freeArrow, platformRows: 8, jitter: 60,
                });
                expect(validateLevel(level), 'model').toEqual([]);
                const jOpts = { constants: C, freeArrow, freeAbilities: [freeArrow], terminalPortals: true };
                const braid = deriveBraidAccessRules(level, jOpts);
                expect(braid.defects, `seed ${seed}`).toEqual([]);
                // Ferry-aware full only on NON-blue shapes (cheap); jittered-blue
                // soundness is the two oracle tests below this loop.
                const full = usesBlue(shape.exits) ? null : deriveAccessRules(level, jOpts);
                if (full) expect(full.defects, `seed ${seed}`).toEqual([]);
                for (const s of shape.exits) {
                    expect(ruleFor(braid, 'exits', s.id)).toBe(wantRule(s.requirement));
                    if (full) expect(braid.exits[s.id].minimalSets).toEqual(full.exits[s.id].minimalSets);
                }
            }
        });
    }

    // Full-graph oracle for the exact padded/jittered configs that braidRegime2's
    // fast suite verifies braid-ONLY (those run a full-graph deriveAccessRules too
    // slowly for the fast 10s budget — see expectGated's crossFull:false there).
    // Keeping the full cross-check here loses no oracle coverage.
    const fullCross = (level, exits, freeArrow, label) => {
        expect(validateLevel(level), `${label} model`).toEqual([]);
        const opts = { constants: C, freeArrow, freeAbilities: [freeArrow], terminalPortals: true };
        const braid = deriveBraidAccessRules(level, opts);
        const full = deriveAccessRules(level, opts);
        expect(braid.defects, `${label} braid`).toEqual([]);
        expect(full.defects, `${label} full`).toEqual([]);
        for (const s of exits) {
            expect(ruleFor(braid, 'exits', s.id), `${label} ${s.id}`).toBe(wantRule(s.requirement));
            expect(braid.exits[s.id].minimalSets, `${label} ${s.id} full==braid`)
                .toEqual(full.exits[s.id].minimalSets);
        }
    };

    it('moving-blue spine wander (seed 2, jitter 40): full == braid', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
        ];
        const level = generateLevelFromSpecs({
            id: 'RF2', exitSpecs: exits, seed: 2, physics: 'dj', mode: 'braid',
            braidWidth: W, freeArrow: 'right', platformRows: 6, jitter: 40,
        });
        fullCross(level, exits, 'right', 'blue wander');
    });

    it('springs freeArrow=left, small jitter (integer-snap regression): full == braid', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gs', requirement: ['springs'], direction: 'right' },
        ];
        for (const seed of [1, 10, 13]) {
            for (const jitter of [10, 20, 40]) {
                const level = generateLevelFromSpecs({
                    id: `RL${seed}`, exitSpecs: exits, seed, physics: 'dj', mode: 'braid',
                    braidWidth: W, freeArrow: 'left', platformRows: 8, jitter,
                });
                fullCross(level, exits, 'left', `springs seed ${seed} jitter ${jitter}`);
            }
        }
    });
});

// CORPUS EQUIVALENCE GATE for the moving-blue phase fast path. The fast phase
// machinery in canJump (tolerance-theorem aligned-stride today; a column
// stepping-stone short-circuit next) must be VERDICT-IDENTICAL to the exhaustive
// ∀-phase path. `exhaustivePhases:true` threads through reachableBraidPlatforms →
// canJump, so deriving a level both ways and comparing EVERY platform + goal
// minimal set (includePlatforms) is the strongest cheap gate: it forbids the
// fast path from ever inventing or dropping a verdict on real generated geometry.
// Braid-focused (column mode may be deprecated); blue is the only thing that
// makes the two paths diverge in cost, so every shape here carries a blue gate.
describe('braid Regime 2 — moving-blue fast-phase path ≡ exhaustive (derive corpus)', () => {
    const normSets = (d) => {
        const pick = (m) => Object.fromEntries(
            Object.entries(m).map(([k, v]) => [k, v.minimalSets]));
        return { exits: pick(d.exits), pickups: pick(d.pickups), platforms: pick(d.platforms) };
    };
    const blueShapes = (arrow) => [
        { name: 'blue', maxSeed: 2, exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
        ], pickups: [{ id: 'pk', requirement: ['blue'] }] },
        { name: 'blue+arrow', maxSeed: 2, exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gba', requirement: ['blue', arrow], direction: 'left' },
        ], pickups: [] },
        // The 3-ability case (fast is now ~19ms suppressed; the exhaustive oracle
        // is the slow side) — fewest seeds.
        { name: 'blue+arrow+springs', maxSeed: 1, exits: [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gba', requirement: ['blue', arrow], direction: 'left' },
            { id: 'gbas', requirement: ['blue', arrow, 'springs'], direction: 'right' },
        ], pickups: [] },
    ];
    for (let seed = 1; seed <= 2; seed++) {
        const arrow = seed % 2 ? 'left' : 'right';
        const freeArrow = arrow === 'left' ? 'right' : 'left';
        for (const sh of blueShapes(arrow)) {
            if (seed > sh.maxSeed) continue;
            it(`seed ${seed} ${sh.name} (gate ${arrow}, free ${freeArrow})`, () => {
                const level = gen(sh.exits, sh.pickups, seed, freeArrow);
                expect(validateLevel(level)).toEqual([]);
                const base = {
                    constants: C, freeArrow, freeAbilities: [freeArrow],
                    terminalPortals: true, includePlatforms: true,
                };
                const fast = deriveBraidAccessRules(level, base);
                const exhaustive = deriveBraidAccessRules(level, { ...base, exhaustivePhases: true });
                expect(fast.defects).toEqual(exhaustive.defects);
                expect(normSets(fast)).toEqual(normSets(exhaustive));

                // Braid-vs-FULL cross-check on blue, against the full N² graph
                // under exhaustivePhases — the ∀-phase, FERRY-AWARE ground truth
                // (no blue suppression). This is the INDEPENDENT oracle the
                // suppressing default braid derive must reproduce: it confirms
                // suppression never over- nor under-claims a requirement on real
                // generated geometry. Bounded: the ferry-aware full solver
                // enumerates the blue's sweep phases and is slow, so only the
                // cheapest shapes and first seed cross-check it.
                const fullSeedCap = sh.name === 'blue+arrow+springs' ? 1 : 2;
                if (seed <= fullSeedCap) {
                    const { includePlatforms, ...fullBase } = base;
                    const full = deriveAccessRules(level, { ...fullBase, exhaustivePhases: true });
                    expect(full.defects, 'full defects').toEqual([]);
                    for (const g of [...sh.exits, ...sh.pickups]) {
                        const b = (fast.exits[g.id] ?? fast.pickups[g.id]).minimalSets;
                        const f = (full.exits[g.id] ?? full.pickups[g.id]).minimalSets;
                        expect(f, `${g.id} braid==full`).toEqual(b);
                    }
                }
            });
        }
    }
});
