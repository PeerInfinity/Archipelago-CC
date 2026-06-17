/**
 * Step 5 of braid Regime 2 (NewDocs/plans/procedural-generation/braid-regime2.md):
 * the GATED braid proposer. generateLevelFromSpecs(mode:'braid') now honours each
 * spec's `requirement` by building a fork-free single-platform-per-row chain with
 * ARROW GATE ROWS (gated platform + same-row teleport-to-start host for the
 * missing-arrow population) and BLUE gates, then verifying — exactly as the
 * column path does — that every goal's derived minimal sets EQUAL its requirement.
 *
 * These are fast because the chains are short (a handful of rungs); the verifier
 * is the row-aware deriveBraidAccessRules. We cross-check against the full-graph
 * deriveAccessRules so the emitted rules can't drift from real geometry.
 */
import { describe, it, expect } from 'vitest';
import { generateLevelFromSpecs, generateLevelFromSpecsGen } from './generator.js';
import { deriveAccessRules, deriveBraidAccessRules, formatRule } from './deriveRules.js';
import { validateLevel } from './level.js';
import { PROFILES } from './physics.js';

const C = PROFILES.dj.constants;
const W = 240;

// The free arrow the player always holds (gated-braid portals ride tips toward
// it). 'right' matches the generator's default; tests pass the same to verify.
const FREE_ARROW = 'right';

function gen(exitSpecs, pickupSpecs = [], seed = 1, freeArrow = FREE_ARROW) {
    return generateLevelFromSpecs({
        id: `R${seed}`, exitSpecs, pickupSpecs, seed, physics: 'dj',
        mode: 'braid', braidWidth: W, freeArrow,
    });
}

const ruleFor = (d, kind, id) => formatRule(d[kind][id].minimalSets);
const wantRule = (req) => (req.length ? `(${[...req].sort().join(' AND ')})` : 'ALWAYS');

// Assert: valid model, no defects, and braid-derived == full-derived == the
// requested requirement for every goal (so the emitter reproduces the gate).
// Both derives treat the free arrow as held and portal hosts as terminal — so
// the offset portal tips derive their gate set (not [freeArrow]) and can't leak
// a skip route; the full-graph derive is the apples-to-apples oracle.
function expectGated(level, exitSpecs, pickupSpecs = [], freeArrow = FREE_ARROW) {
    expect(validateLevel(level), 'model errors').toEqual([]);
    const opts = { constants: C, freeArrow, freeAbilities: [freeArrow], terminalPortals: true };
    const braid = deriveBraidAccessRules(level, opts);
    const full = deriveAccessRules(level, opts);
    expect(braid.defects, 'braid defects').toEqual([]);
    expect(full.defects, 'full defects').toEqual([]);
    for (const s of exitSpecs) {
        expect(ruleFor(braid, 'exits', s.id)).toBe(wantRule(s.requirement));
        expect(braid.exits[s.id].minimalSets).toEqual(full.exits[s.id].minimalSets);
    }
    for (const s of pickupSpecs) {
        expect(ruleFor(braid, 'pickups', s.id)).toBe(wantRule(s.requirement));
        expect(braid.pickups[s.id].minimalSets).toEqual(full.pickups[s.id].minimalSets);
    }
}

describe('braid Regime 2 — gated chains honour requirement (dj, width 240)', () => {
    it('a single arrow-gated exit derives exactly [left]', () => {
        const exits = [{ id: 'e1', requirement: ['left'], direction: 'up' }];
        const level = gen(exits);
        expectGated(level, exits);
        // The arrow gate row carries a teleport-to-start host (wrong-arrow
        // population's escape) plus the top teleport.
        expect((level.teleports ?? []).length).toBeGreaterThanOrEqual(1);
    });

    it('a single right-gated exit derives exactly [right] (free arrow = left)', () => {
        // The gated arrow is the one the player does NOT start with, so to gate
        // [right] the free arrow must be left.
        const exits = [{ id: 'e1', requirement: ['right'], direction: 'up' }];
        expectGated(gen(exits, [], 1, 'left'), exits, [], 'left');
    });

    it('free + left-gated exits coexist (free is arrow-free, gated needs left)', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
        ];
        expectGated(gen(exits), exits);
    });

    it('a blue-gated exit derives exactly [blue]', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
        ];
        expectGated(gen(exits), exits);
    });

    it('a nested graded chain (blue, then blue+left) with a gated pickup', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
        ];
        const pickups = [{ id: 'pk', requirement: ['blue'] }];
        expectGated(gen(exits, pickups), exits, pickups);
    });

    it('a springs gate derives exactly [springs]', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gs', requirement: ['springs'], direction: 'right' },
        ];
        expectGated(gen(exits), exits);
    });

    it('a jetpacks gate derives exactly [jetpacks]', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gj', requirement: ['jetpacks'], direction: 'right' },
        ];
        expectGated(gen(exits), exits);
    });

    it('a brown-gated goal rides a brown tip beside the green spine', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['brown'], direction: 'right' },
        ];
        const level = gen(exits);
        expectGated(level, exits);
        // The brown goal rides a brown TIP host (suppression gates it on brown)...
        const host = level.platforms.find((p) => p.id === level.portals.find((pt) => pt.id === 'gb').on);
        expect(host.type).toBe('brown');
        // ...and a green bypass shares its row, so the no-input climb survives
        // (the two-platform rule — brown is terminal, the spine carries on past).
        const bypass = level.platforms.filter(
            (p) => p.y === host.y && p.id !== host.id && p.type !== 'brown');
        expect(bypass.length, 'brown tip has no green bypass on its row').toBeGreaterThan(0);
    });

    it('two brown-gated exits each derive exactly [brown]', () => {
        // Brown is a per-goal tip colour now, not a unique ceiling — so two
        // arrowless brown goals are a braid, not a crash (the browser bug:
        // side_exit_N + side_exit_E both [brown] aborted via column fallback).
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb1', requirement: ['brown'], direction: 'right' },
            { id: 'gb2', requirement: ['brown'], direction: 'down' },
        ];
        const level = gen(exits);
        expectGated(level, exits);
        expect(level.size.width, 'should be a 240 braid, not a column fallback').toBe(W);
    });

    it('a graded chain mixing blue, springs and an arrow (all nested)', () => {
        const exits = [
            { id: 'f', requirement: [], direction: 'up' },
            { id: 'b', requirement: ['blue'], direction: 'right' },
            { id: 'bs', requirement: ['blue', 'springs'], direction: 'left' },
            { id: 'bsl', requirement: ['blue', 'springs', 'left'], direction: 'down' },
        ];
        expectGated(gen(exits), exits);
    });

    it('two exits at the same gate level each derive that gate', () => {
        const exits = [
            { id: 'gl', requirement: ['left'], direction: 'up' },
            { id: 'gl2', requirement: ['left'], direction: 'right' },
        ];
        expectGated(gen(exits), exits);
    });

    it('every portal rides an OFFSET tip; the spine bypass stays portal-free', () => {
        const exits = [
            { id: 'f1', requirement: [], direction: 'up' },
            { id: 'f2', requirement: [], direction: 'down' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
        ];
        const level = gen(exits);
        expectGated(level, exits);
        // No portal sits on a spine platform — i.e. for every portal host there
        // is ANOTHER (bypass) platform at the same row (the two-platform rule).
        const portalHostIds = new Set(level.portals.map((pt) => pt.on));
        for (const pt of level.portals) {
            const host = level.platforms.find((p) => p.id === pt.on);
            const sameRow = level.platforms.filter(
                (p) => p.y === host.y && p.id !== host.id && !portalHostIds.has(p.id));
            expect(sameRow.length, `portal ${pt.id} has no bypass on its row`).toBeGreaterThan(0);
        }
    });
});

// NOTE: the column-FALLBACK cases (two arrows, incomparable non-brown reqs)
// live in braidRegime2.slow.test.js — they run the column proposer + the full
// deriveAccessRules oracle (~6s each) and flake on the fast suite's
// non-interruptible 10s timeout under parallel CPU contention (see
// vitest.config.js). The fast cases below all build a 240 braid (cheap).

describe('braid Regime 2 — brown coexists with a spine gate (brown rides a tip)', () => {
    it('a brown gate + a left gate share one braid ([brown] tip below, [left] above)', () => {
        // The spine keys on the requirement MINUS brown, so [brown]→[] and
        // [left]→[left] DO nest: the brown goal rides a brown tip at the bottom
        // spine level, the left goal an arrow gate + tip above. One braid, no
        // column fallback (this used to fall back as "incomparable").
        const exits = [
            { id: 'gb', requirement: ['brown'], direction: 'up' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
        ];
        const level = gen(exits);
        expectGated(level, exits);
        expect(level.size.width, 'should be a 240 braid, not a column fallback').toBe(W);
    });

    it('a left+brown gate nests above a left gate (brown is not a spine rung)', () => {
        const exits = [
            { id: 'gl', requirement: ['left'], direction: 'up' },
            { id: 'glb', requirement: ['left', 'brown'], direction: 'right' },
        ];
        const level = gen(exits);
        expectGated(level, exits);
        expect(level.size.width).toBe(W);
    });
});

// Authored per-platform requirement (build intent) — captured separately from
// the geometry (never on platform objects) for the region report. It must AGREE
// with the verified per-platform derive on every platform: the builder's intent
// and the solver's truth are the same, or there's a generator bug.
function genWithAuthored(exitSpecs, pickupSpecs = [], seed = 1, freeArrow = FREE_ARROW) {
    const g = generateLevelFromSpecsGen({
        id: `RA${seed}`, exitSpecs, pickupSpecs, seed, physics: 'dj',
        mode: 'braid', braidWidth: W, freeArrow,
    });
    let r = g.next();
    while (!r.done) r = g.next();
    return r.value; // { level, derived, authoredReqs }
}
const unavoidable = (sets) => (!sets || !sets.length ? []
    : sets.reduce((acc, s) => acc.filter((a) => s.includes(a)), [...sets[0]]).sort());

describe('braid Regime 2 — authored per-platform requirement matches verified', () => {
    const cases = [
        ['arrow gate', [{ id: 'e1', requirement: ['left'], direction: 'up' }], []],
        ['blue then blue+left + pickup', [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
            { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
        ], [{ id: 'pk', requirement: ['blue'] }]],
        ['springs gate', [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gs', requirement: ['springs'], direction: 'right' },
        ], []],
        ['brown tip + left gate', [
            { id: 'gb', requirement: ['brown'], direction: 'up' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
        ], []],
    ];

    for (const [name, exits, pickups] of cases) {
        it(`authored == verified for every platform (${name})`, () => {
            const { level, authoredReqs } = genWithAuthored(exits, pickups);
            expect(authoredReqs, 'gated braid should produce authoredReqs').toBeTruthy();
            const d = deriveBraidAccessRules(level, {
                constants: C, freeArrow: FREE_ARROW, freeAbilities: [FREE_ARROW],
                terminalPortals: true, includePlatforms: true,
            });
            for (const p of level.platforms) {
                // authoredReqs covers only the gating SKELETON; decorative
                // fork companions carry no authored intent (absent from the map).
                if (!(p.id in authoredReqs)) continue;
                // The free arrow is held, so it never appears in a requirement;
                // drop it from the authored set before comparing to verified.
                const authored = authoredReqs[p.id].filter((a) => a !== FREE_ARROW).sort();
                const verified = unavoidable(d.platforms[p.id].minimalSets);
                expect(verified, `platform ${p.id} (${formatRule(d.platforms[p.id].minimalSets)})`)
                    .toEqual(authored);
            }
        });
    }

    it('the all-free fork braid (Regime 1) produces no authoredReqs', () => {
        const { authoredReqs } = genWithAuthored(
            [{ id: 'e1', requirement: [], direction: 'up' }], []);
        expect(authoredReqs).toBeNull();
    });
});

// platformRows: extra PLAIN climb rungs distributed across the chain segments
// (taller levels, hardest exit at the summit). They sit inside constant-
// requirement blocks so gating is unchanged — the load-bearing claim.
describe('braid Regime 2 — platformRows adds distributed plain rows safely', () => {
    const exits = [
        { id: 'free', requirement: [], direction: 'up' },
        { id: 'gb', requirement: ['blue'], direction: 'right' },
        { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
    ];
    function genRows(rows, seed = 1) {
        const g = generateLevelFromSpecsGen({
            id: `RR${seed}`, exitSpecs: exits, seed, physics: 'dj',
            mode: 'braid', braidWidth: W, freeArrow: FREE_ARROW, platformRows: rows,
        });
        let r = g.next();
        while (!r.done) r = g.next();
        return r.value.level;
    }
    const rowCount = (lvl) => new Set(lvl.platforms.map((p) => p.y)).size;
    const hostY = (lvl, id) => lvl.platforms.find(
        (p) => p.id === lvl.portals.find((pt) => pt.id === id).on).y;

    it('adds exactly the requested number of rows', () => {
        const base = rowCount(genRows(0));
        for (const n of [3, 6, 10]) {
            expect(rowCount(genRows(n)), `+${n} rows`).toBe(base + n);
        }
    });

    it('preserves gating with padding (full-solver cross-check; matrix in slow)', () => {
        expectGated(genRows(6), exits);
    });

    it('keeps the hardest exit at the summit with more climb beneath it', () => {
        const padded = genRows(8);
        const plain = genRows(0);
        // gbl (blue AND left) is the highest-requirement exit → topmost (min y).
        const ys = padded.portals.map((pt) => hostY(padded, pt.id));
        expect(hostY(padded, 'gbl')).toBe(Math.min(...ys));
        // Padding lands BELOW the summit exit (it stays pinned under the top
        // teleport after normalization), so the climb beneath it grows.
        const below = (lvl) => lvl.platforms.filter((p) => p.y > hostY(lvl, 'gbl')).length;
        expect(below(padded)).toBeGreaterThan(below(plain));
    });

    it('default 0 is byte-identical to omitting the param', () => {
        const withZero = JSON.stringify(genRows(0));
        const g = generateLevelFromSpecsGen({
            id: 'RR1', exitSpecs: exits, seed: 1, physics: 'dj',
            mode: 'braid', braidWidth: W, freeArrow: FREE_ARROW,
        });
        let r = g.next(); while (!r.done) r = g.next();
        expect(withZero).toBe(JSON.stringify(r.value.level));
    });
});

// Flavor springs/jetpacks: extra platformRows in a block that ALREADY holds the
// ability may become a grown-gap boost row (the panel's existing spring/jetpack
// chance). Neutral because the block already requires the ability.
describe('braid Regime 2 — spring/jetpack flavor on extra rows (held block only)', () => {
    const springExits = [
        { id: 'free', requirement: [], direction: 'up' },
        { id: 'gs', requirement: ['springs'], direction: 'right' },
    ];
    const blueExits = [
        { id: 'free', requirement: [], direction: 'up' },
        { id: 'gb', requirement: ['blue'], direction: 'right' },
    ];
    const gen = (exits, decorChance) => generateLevelFromSpecs({
        id: 'R', exitSpecs: exits, seed: 1, physics: 'dj', mode: 'braid',
        braidWidth: W, freeArrow: FREE_ARROW, platformRows: 6, decorChance,
    });

    it('spends extra rows on flavor springs in a springs-held block, gating intact', () => {
        const plain = gen(springExits, {});
        const sprung = gen(springExits, { spring: 1 });
        // gate spring only vs gate + flavor springs in the held top block
        expect((sprung.springs ?? []).length).toBeGreaterThan((plain.springs ?? []).length);
        expectGated(sprung, springExits); // gs still derives exactly [springs]
    });

    it('adds no flavor springs where springs is never held', () => {
        const lvl = gen(blueExits, { spring: 1 });
        expect((lvl.springs ?? []).length).toBe(0);
    });

    it('brown is never added on the gated spine, but blue IS honored in a blue-held block', () => {
        const lvl = gen(blueExits, { blue: 1, brown: 1 });
        // brown is terminal (no climb-onward) → never used as a flavor row.
        expect(lvl.platforms.filter((p) => p.type === 'brown').length).toBe(0);
        // blue rides the gating stepping-stone construction: the gate stone PLUS
        // flavor stones in the blue-held block (capped). Gating intact.
        expect(lvl.platforms.filter((p) => p.type === 'blue').length).toBeGreaterThan(1);
        expectGated(lvl, blueExits);
    });

    it('adds flavor blue stepping-stones in a blue-held block, gating intact', () => {
        const plain = gen(blueExits, {});
        const blued = gen(blueExits, { blue: 1 });
        expect((blued.platforms.filter((p) => p.type === 'blue')).length)
            .toBeGreaterThan(plain.platforms.filter((p) => p.type === 'blue').length);
        expectGated(blued, blueExits); // gb still derives exactly [blue]
    });

    it('adds no flavor blue where blue is never held', () => {
        const lvl = gen(springExits, { blue: 1 }); // springs region, no blue gate
        expect(lvl.platforms.filter((p) => p.type === 'blue').length).toBe(0);
    });

    it('decorChance without padding (platformRows 0) adds nothing', () => {
        const noRows = generateLevelFromSpecs({
            id: 'R', exitSpecs: springExits, seed: 1, physics: 'dj', mode: 'braid',
            braidWidth: W, freeArrow: FREE_ARROW, platformRows: 0, decorChance: { spring: 1 },
        });
        const baseline = generateLevelFromSpecs({
            id: 'R', exitSpecs: springExits, seed: 1, physics: 'dj', mode: 'braid',
            braidWidth: W, freeArrow: FREE_ARROW, platformRows: 0,
        });
        expect(JSON.stringify(noRows)).toBe(JSON.stringify(baseline));
    });
});

// Decorative fork/merge/brown: a 2-wide companion lane beside the spine (any
// block), terminating into a merge; the terminal companion may break (brown).
// (The gating cross-check matrix lives in the slow suite — the full-graph derive
// on wide+brown levels is the expensive part.) Forks are detected by the extra
// platforms they add, NOT by row width — the gated SKELETON is already 2-wide on
// gate rows (gate + teleport host) and tip rows (spine + offset tip).
describe('braid Regime 2 — decorative fork/merge/brown geometry', () => {
    const exits = [
        { id: 'free', requirement: [], direction: 'up' },
        { id: 'gb', requirement: ['blue'], direction: 'right' },
        { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
    ];
    const gen = (decorChance, seed = 1, platformRows = 6, jitter = 0) => generateLevelFromSpecs({
        id: `RF${seed}`, exitSpecs: exits, seed, physics: 'dj', mode: 'braid',
        braidWidth: W, freeArrow: FREE_ARROW, platformRows, decorChance, jitter,
    });
    const count = (lvl) => lvl.platforms.length;
    const rows = (lvl) => new Set(lvl.platforms.map((p) => p.y)).size;
    // Companion fork widths: the gap on a 2-platform row that's a companion lane
    // (between catchSpan/2≈53 and tipOffset 110 — excludes tip rows at 110 and
    // arrow-gate rows at 120).
    const forkWidths = (lvl) => {
        const byY = new Map();
        for (const p of lvl.platforms) byY.set(p.y, [...(byY.get(p.y) ?? []), p.x]);
        const gaps = new Set();
        for (const xs of byY.values()) {
            if (xs.length === 2) {
                const g = Math.round(Math.abs(xs[0] - xs[1]));
                if (g > 55 && g < 105) gaps.add(g);
            }
        }
        return gaps;
    };

    it('forks add companion platforms AND overshoot the row budget', () => {
        const plain = gen({});
        const forked = gen({ fork: 1 });
        expect(count(forked)).toBeGreaterThan(count(plain)); // companions added
        expect(rows(forked)).toBeGreaterThan(rows(plain));   // fork bundles overshoot
    });

    it('brown rides the terminal companion only when forking', () => {
        expect(gen({ fork: 1, brown: 1 }).platforms.filter((p) => p.type === 'brown').length)
            .toBeGreaterThan(0);
        // brown chance with no fork chance → no fork branch → no brown
        expect(gen({ brown: 1 }).platforms.filter((p) => p.type === 'brown').length).toBe(0);
    });

    it('no forks/brown without a platformRows budget', () => {
        const baseline = gen({}, 1, 0);
        const withChance = gen({ fork: 1, brown: 1 }, 1, 0);
        expect(JSON.stringify(withChance)).toBe(JSON.stringify(baseline)); // byte-identical
    });

    it('jitter (Max jitter) varies the fork width; 0 keeps it fixed at forkHalf', () => {
        const straight = gen({ fork: 1 }, 3, 6, 0);
        const jittered = gen({ fork: 1 }, 3, 6, 40);
        // Without jitter every companion sits at forkHalf → a single width.
        expect(forkWidths(straight).size).toBeLessThanOrEqual(1);
        // Jitter spreads companions outward toward the free arrow → more widths.
        expect(forkWidths(jittered).size).toBeGreaterThan(forkWidths(straight).size);
    });

    it('spine jitter is AUTO-DISABLED for a moving-blue level (identical without forks)', () => {
        // These exits have a blue gate → moving blue → the blue stone row is
        // pass-through, which conflicts with spine jitter, so it's gated off.
        // With no forks the level is then byte-identical regardless of jitter.
        const a = gen({}, 2, 6, 0);
        const b = gen({}, 2, 6, 40);
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    });

    it('spine WANDERS for an arrow-gated level (no moving blue), gates intact', () => {
        const arrowExits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
        ];
        const g = (jit) => generateLevelFromSpecs({
            id: 'RJA', exitSpecs: arrowExits, seed: 1, physics: 'dj', mode: 'braid',
            braidWidth: W, freeArrow: FREE_ARROW, platformRows: 8, jitter: jit,
        });
        const cols = (l) => new Set(l.platforms.map((p) => Math.round(p.x))).size;
        // The coherent toward-free shift spreads the spine across more columns.
        expect(cols(g(40))).toBeGreaterThan(cols(g(0)));
        expectGated(g(40), arrowExits); // [left] still derived exactly
    });
});
