/**
 * deriveRules verifier gates (plan §4.4): per-fixture minimal ability
 * sets (including the touch-reach item-before-the-gate case),
 * formatRule, includePlatforms, freeAbilities, signature dedup,
 * full-vs-layered reach agreement, unreachable-goal defects, and the
 * planted non-monotone fixture the monotonicity tripwire must catch.
 */

import { describe, it, expect } from 'vitest';
import {
    abilityUniverse,
    reachabilityTable,
    deriveAccessRules,
    formatRule,
} from './deriveRules.js';
import { reachableRunPlatforms } from './canRun.js';
import {
    flatRun, gapJump, oneWay, spikeRun, doubleGap, stepStone, springGap,
    springShelf, djShelf, laneSplit, FIXTURES,
} from './fixtures.js';

describe('abilityUniverse', () => {
    it('doubleJump always; platform gates only when the geometry exists', () => {
        expect(abilityUniverse(flatRun)).toEqual(['doubleJump']);
        expect(abilityUniverse(gapJump)).toEqual(['doubleJump']);
        expect(abilityUniverse(spikeRun)).toEqual(['doubleJump']);
        expect(abilityUniverse(doubleGap)).toEqual(['doubleJump']);
        expect(abilityUniverse(oneWay)).toEqual(['doubleJump', 'blue']);
        expect(abilityUniverse(stepStone)).toEqual(['doubleJump', 'blue']);
        expect(abilityUniverse(springGap)).toEqual(['doubleJump', 'spring']);
    });
});

describe('reachabilityTable', () => {
    it('dedups subsets with identical active geometry AND effective params', () => {
        // gapJump has no blue geometry, so forcing 'blue' into the
        // universe changes neither the active platforms nor the params
        // overlay — {} and {blue} must share one evaluation.
        const { table } = reachabilityTable(gapJump, {
            universe: ['doubleJump', 'blue'],
        });
        expect(table.get('blue').platforms).toBe(table.get('(none)').platforms);
        // doubleJump changes the effective params (maxAirJumps), so it
        // must NOT dedup against the empty set.
        expect(table.get('doubleJump').platforms)
            .not.toBe(table.get('(none)').platforms);
    });
});

describe('derived rules match fixture ground truth', () => {
    it('flatRun / gapJump / spikeRun: everything ALWAYS reachable', () => {
        for (const f of [flatRun, gapJump, spikeRun]) {
            const r = deriveAccessRules(f);
            for (const goal of [...Object.values(r.pickups), ...Object.values(r.exits)]) {
                expect(goal.minimalSets, f.id).toEqual([[]]);
                expect(goal.reachableUnderFull, f.id).toBe(true);
            }
            expect(r.defects, f.id).toEqual([]);
        }
        expect(formatRule(deriveAccessRules(flatRun).pickups.pk_flat.minimalSets))
            .toBe('ALWAYS');
    });

    it('doubleGap: the pre-gate pickup derives [] via TOUCH-reach; the exit needs doubleJump', () => {
        // Without Double Jump every arrival on floorA is doomed (auto-
        // run always ends in the pit) — but the entry leg still TOUCH-
        // reaches floorA, and pk_edge sits in its wake. The item-
        // before-the-gate case: [] and NOT a circular [doubleJump].
        const r = deriveAccessRules(doubleGap);
        expect(r.pickups.pk_edge.minimalSets).toEqual([[]]);
        expect(r.exits.exit_main.minimalSets).toEqual([['doubleJump']]);
        expect(formatRule(r.exits.exit_main.minimalSets)).toBe('(doubleJump)');
        expect(r.defects).toEqual([]);
    });

    it('stepStone: stone pickup and exit require exactly {blue}; doubleJump provably not required', () => {
        const r = deriveAccessRules(stepStone);
        expect(r.pickups.pk_stone.minimalSets).toEqual([['blue']]);
        expect(r.exits.exit_main.minimalSets).toEqual([['blue']]);
        expect(formatRule(r.exits.exit_main.minimalSets)).toBe('(blue)');
        // the gap beats even double-jump reach — machine-verified:
        for (const s of Object.values(r.exits).flatMap((g) => g.minimalSets)) {
            expect(s).not.toContain('doubleJump');
        }
        expect(r.defects).toEqual([]);
    });

    it('oneWay: shelf pickup requires {blue}; the floor exit stays ALWAYS', () => {
        const r = deriveAccessRules(oneWay);
        expect(r.pickups.pk_shelf.minimalSets).toEqual([['blue']]);
        expect(r.exits.exit_main.minimalSets).toEqual([[]]);
        expect(r.defects).toEqual([]);
    });

    it('springGap: the exit requires exactly {spring}; doubleJump provably not required', () => {
        const r = deriveAccessRules(springGap);
        expect(r.pickups.pk_edge.minimalSets).toEqual([[]]);
        expect(r.exits.exit_main.minimalSets).toEqual([['spring']]);
        expect(r.defects).toEqual([]);
    });

    it('springShelf: shelf pickup AND exit require exactly {spring} (shelf rides the gate)', () => {
        const r = deriveAccessRules(springShelf);
        expect(r.pickups.pk_shelfTop.minimalSets).toEqual([['spring']]);
        expect(r.exits.exit_main.minimalSets).toEqual([['spring']]);
        expect(r.defects).toEqual([]);
    });

    it('djShelf: shelf pickup and exit require exactly {doubleJump}', () => {
        const r = deriveAccessRules(djShelf);
        expect(r.pickups.pk_shelfTop.minimalSets).toEqual([['doubleJump']]);
        expect(r.exits.exit_main.minimalSets).toEqual([['doubleJump']]);
        expect(r.defects).toEqual([]);
    });

    it('laneSplit: both lanes and their goals derive ALWAYS (route texture, no logic)', () => {
        const r = deriveAccessRules(laneSplit);
        expect(r.pickups.pk_top.minimalSets).toEqual([[]]);
        expect(r.exits.exit_main.minimalSets).toEqual([[]]);
        expect(r.defects).toEqual([]);
    });
});

describe('freeAbilities: always-held items never appear in a requirement', () => {
    it('stepStone with blue held free derives [] for the stone goals', () => {
        const r = deriveAccessRules(stepStone, { freeAbilities: ['blue'] });
        expect(r.universe).toEqual(['doubleJump']);
        expect(r.pickups.pk_stone.minimalSets).toEqual([[]]);
        expect(r.exits.exit_main.minimalSets).toEqual([[]]);
        expect(r.defects).toEqual([]);
    });
});

describe('injectable reach: layered strip flood agrees with the full graph', () => {
    // reachableRunPlatforms claims VERDICT-IDENTITY with the full
    // N² flood on AUTO_RUN levels (canRun.js) — so the whole derive
    // must agree on every fixture, not merely over-state.
    for (const f of FIXTURES) {
        it(`${f.id}: identical minimal sets and defects`, () => {
            const full = deriveAccessRules(f);
            const layered = deriveAccessRules(f, { reach: reachableRunPlatforms });
            expect(layered.pickups).toEqual(full.pickups);
            expect(layered.exits).toEqual(full.exits);
            expect(layered.defects).toEqual(full.defects);
        });
    }
});

describe('includePlatforms: per-platform minimal sets (per-segment requirements)', () => {
    it('off by default — no platforms field', () => {
        expect(deriveAccessRules(stepStone).platforms).toBeUndefined();
    });

    it('covers every platform and exposes minimal sets + reachableUnderFull', () => {
        const r = deriveAccessRules(stepStone, { includePlatforms: true });
        expect(Object.keys(r.platforms).sort())
            .toEqual(stepStone.platforms.map((p) => p.id).sort());
        expect(formatRule(r.platforms.floorA.minimalSets)).toBe('ALWAYS');
        expect(r.platforms.stone.minimalSets).toEqual([['blue']]);
        expect(r.platforms.floorB.minimalSets).toEqual([['blue']]);
        for (const a of Object.values(r.platforms)) {
            expect(typeof a.reachableUnderFull).toBe('boolean');
        }
    });
});

describe('verifier defect detection', () => {
    /** A high island only a goal could care about (rise 12 beats even
     *  double jump), plus a plain floor carrying the exit. */
    const stranded = {
        id: 'stranded',
        size: { width: 30, height: 20 },
        platforms: [
            { id: 'floor', x: 0, y: 0, w: 30, h: 1, type: 'ground' },
            { id: 'island', x: 10, y: 12, w: 6, h: 1, type: 'ground' },
        ],
        hazards: [],
        pickups: [{ id: 'pk_island', on: 'island', x: 15.8, y: 13.6 }],
        portals: [{ id: 'exit_main', on: 'floor', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
        spawn: { x: 1, y: 1 },
    };

    it('unreachable decorative platforms are NOT defects (skipping is normal)', () => {
        const r = deriveAccessRules({ ...stranded, pickups: [] });
        expect(r.defects).toEqual([]);
        expect(r.exits.exit_main.minimalSets).toEqual([[]]);
    });

    it('a pickup whose host is unreachable under every set IS a defect', () => {
        const r = deriveAccessRules(stranded);
        expect(r.pickups.pk_island.minimalSets).toEqual([]);
        expect(formatRule(r.pickups.pk_island.minimalSets)).toBe('IMPOSSIBLE');
        expect(r.defects).toEqual(
            expect.arrayContaining([expect.stringContaining("pickup 'pk_island'")]));
    });

    it('detects non-monotone gating: a SOLID gated platform blocking the corridor', () => {
        // Production gated types are one-way BY DESIGN (plan §3), so
        // generated levels cannot produce this — the fixture uses the
        // per-platform `gate` override (suppression.js) to gate a
        // solid ground wall on blue. Without blue the corridor is a
        // flush walk; WITH blue the wall exists, is far too tall for
        // any jump, and severs floorB. Gaining the blue item LOSES
        // the exit: exactly what AP rules must never encode, and what
        // the tripwire exists to catch.
        const wallCorridor = {
            id: 'wallCorridor',
            size: { width: 30, height: 16 },
            platforms: [
                { id: 'floorA', x: 0, y: 0, w: 14, h: 1, type: 'ground' },
                { id: 'floorB', x: 14, y: 0, w: 16, h: 1, type: 'ground' },
                { id: 'wall', x: 13.5, y: 1, w: 1.5, h: 10, type: 'ground', gate: 'blue' },
            ],
            hazards: [],
            pickups: [],
            portals: [{ id: 'exit_main', on: 'floorB', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
            spawn: { x: 1, y: 1 },
        };
        const r = deriveAccessRules(wallCorridor);
        expect(r.exits.exit_main.violations).toEqual(
            expect.arrayContaining([
                { subset: '(none)', superset: 'blue' },
            ]));
        expect(r.defects).toEqual(
            expect.arrayContaining([expect.stringContaining('NON-MONOTONE')]));
    });
});
