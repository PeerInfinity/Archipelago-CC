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
