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
import { generateLevelFromSpecs } from './generator.js';
import { deriveAccessRules, deriveBraidAccessRules, formatRule } from './deriveRules.js';
import { validateLevel } from './level.js';
import { PROFILES } from './physics.js';

const C = PROFILES.dj.constants;
const W = 240;

function gen(exitSpecs, pickupSpecs = [], seed = 1, jitter = 0) {
    return generateLevelFromSpecs({
        id: `R${seed}`, exitSpecs, pickupSpecs, seed, physics: 'dj',
        mode: 'braid', braidWidth: W, jitter,
    });
}

const ruleFor = (d, kind, id) => formatRule(d[kind][id].minimalSets);
const wantRule = (req) => (req.length ? `(${[...req].sort().join(' AND ')})` : 'ALWAYS');

// Assert: valid model, no defects, and braid-derived == full-derived == the
// requested requirement for every goal (so the emitter reproduces the gate).
function expectGated(level, exitSpecs, pickupSpecs = []) {
    expect(validateLevel(level), 'model errors').toEqual([]);
    const braid = deriveBraidAccessRules(level, { constants: C });
    const full = deriveAccessRules(level, { constants: C });
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

    it('a single right-gated exit derives exactly [right]', () => {
        const exits = [{ id: 'e1', requirement: ['right'], direction: 'up' }];
        expectGated(gen(exits), exits);
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

    it('a brown ceiling goal derives exactly [brown]', () => {
        const exits = [
            { id: 'free', requirement: [], direction: 'up' },
            { id: 'gb', requirement: ['brown'], direction: 'right' },
        ];
        const level = gen(exits);
        expectGated(level, exits);
        // The brown goal rides a brown host (the ceiling).
        const host = level.portals.find((pt) => pt.id === 'gb').on;
        expect(level.platforms.find((p) => p.id === host).type).toBe('brown');
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

    it('arrow-directional jitter still derives the same gate', () => {
        const exits = [
            { id: 'gl', requirement: ['left'], direction: 'up' },
            { id: 'gl2', requirement: ['left'], direction: 'right' },
        ];
        // jitter only kicks in once the arrow is held, shifting toward it.
        expectGated(gen(exits, [], 1, 30), exits);
    });

    it('the arrow-free spine stays straight (zero jitter until an arrow is held)', () => {
        const exits = [
            { id: 'f1', requirement: [], direction: 'up' },
            { id: 'f2', requirement: [], direction: 'down' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
        ];
        const level = gen(exits, [], 1, 40);
        // The arrow-free spine never jitters: the entrance platform and every
        // free (req []) goal host sit exactly on the spawn column. (The arrow
        // gate platform and everything above it may drift toward the arrow.)
        const entrance = level.platforms.reduce((a, b) => (b.y > a.y ? b : a));
        expect(entrance.x, 'entrance off column').toBe(W / 2);
        for (const id of ['f1', 'f2']) {
            const host = level.portals.find((pt) => pt.id === id).on;
            const p = level.platforms.find((q) => q.id === host);
            expect(p.x, `free goal ${id} host off column`).toBe(W / 2);
        }
    });
});

describe('braid Regime 2 — falls back to a column when out of braid vocabulary', () => {
    // The braid gates every item type now, but only as a single NESTED chain.
    // What it still can't express — two arrows, mutually-incomparable reqs, or a
    // non-ceiling brown — must NOT abort: braid mode falls back to the column
    // proposer for that region (the bot handles both layouts; the grower only
    // guarantees column-compatibility, so the column always builds). The
    // fallback level is a column (width !== braid's 240) whose rules still match.
    const expectColumnFallback = (exits, pickups = []) => {
        const level = gen(exits, pickups);
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

    it('an incomparable brown gate (brown vs left) → column', () => {
        // [brown] and [left] don't nest, so they can't share one braid chain;
        // the column hosts the brown ceiling + the arrow branch tip.
        expectColumnFallback([
            { id: 'gb', requirement: ['brown'], direction: 'up' },
            { id: 'gl', requirement: ['left'], direction: 'right' },
        ]);
    });
});
