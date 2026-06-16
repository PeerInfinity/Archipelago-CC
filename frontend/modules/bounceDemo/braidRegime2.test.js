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

describe('braid Regime 2 — declines (clear, immediate)', () => {
    const willThrow = (exits, pickups = []) => () => gen(exits, pickups);

    it('declines gating both arrows in one region', () => {
        expect(willThrow([
            { id: 'gl', requirement: ['left'], direction: 'up' },
            { id: 'gr', requirement: ['right'], direction: 'right' },
        ])).toThrow(/cannot gate both arrows/);
    });

    it('declines unsupported physics gates (springs/jetpacks/brown)', () => {
        expect(willThrow([{ id: 'gs', requirement: ['springs'], direction: 'up' }]))
            .toThrow(/unsupported physics gate 'springs'/);
        expect(willThrow([{ id: 'gj', requirement: ['jetpacks'], direction: 'up' }]))
            .toThrow(/unsupported physics gate 'jetpacks'/);
        expect(willThrow([{ id: 'gbr', requirement: ['brown'], direction: 'up' }]))
            .toThrow(/unsupported physics gate 'brown'/);
    });

    it('declines mutually-incomparable requirements', () => {
        expect(willThrow([
            { id: 'gl', requirement: ['left'], direction: 'up' },
            { id: 'gb', requirement: ['blue'], direction: 'right' },
        ])).toThrow(/not nested/);
    });
});
