/**
 * ⛓⛓ RULES rules-fire-breaks-rocks — the rock-breaker derivation (`seedlingRockBreakers.js`), its overlay ruling
 * (`seedlingPlaythroughOverlay.overlayEntitySemantics` on `breakablerock`) and the analyzer's absorption
 * (`regionAtlasAnalyzer.simplifyRule`), which together credit Fire on a rock only from a side holding a clean stance.
 *
 * MUTATIONS (each reds the named row):
 *   m1 `rockFireSides` drops the "nothing else" test (`others.length > 0`)  -> "L40's and L41's rocks have no clean stance"
 *   m2 the side flood ignores the stances (every direction a fire direction) -> "L0's three rocks", "a landing inside"
 *   m3 `isolatedLanding` drops its "no floor beside it" test                 -> "a landing counts only when isolated"
 *   m4 `rockFireRuling` ignores `swingDirs` (no `enter` gate)                -> "the overlay gates every side without a stance"
 *   m5 `absorbAnd` removed                                                    -> "absorption" rows
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildLevelWorld, ROLES } from '../seedlingDemo/levelWorld.js';
import { auditFire } from '../seedlingDemo/presses.js';
import { plannerObstacleAt } from '../seedlingDemo/botDriverV2.js';
import { buildRockFireSides, rockFireSides, FIRE_ROCK_TAG, ROCK_BREAK_ARMS } from './seedlingRockBreakers.js';
import { overlayEntitySemantics, ROCK_FIRE_CONDITION } from './seedlingPlaythroughOverlay.js';
import { ENTITY_SEMANTICS, anyOf, flag } from './seedlingSemantics.js';
import { simplifyRule } from '../procgenPipeline/regionAtlasAnalyzer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(readFileSync(join(HERE, 'atlases', 'seedling-map.json'), 'utf8'));
const MODEL = Object.freeze({ buildLevelWorld, ROLES, auditFire, plannerObstacleAt });
const levelOf = (n) => MAP.levels.find((l) => l.level === n);
const SIDES = buildRockFireSides(MAP.levels, MODEL);
const row = (level, x, y) => SIDES.get(`L${level}:breakablerock@${x},${y}`);
const sorted = (a) => [...a].sort();

describe('rules-fire-breaks-rocks — the breaker arms (Player.genericHit\'s three rock callers)', () => {
    it('the ordinary rock answers to the Sword, the Spear and Fire; the ghost rock is not this module\'s', () => {
        expect(ROCK_BREAK_ARMS.map((a) => a.flag)).toEqual(['hasSword', 'hasSpear', 'hasFire']);
        expect(FIRE_ROCK_TAG).toBe('breakablerock');
        expect([...SIDES.keys()].some((k) => k.includes('breakablerockghost'))).toBe(false);
        // the transcription's own rows are untouched: the swing for an ordinary rock, the Ghost Sword for a ghost rock
        expect(ENTITY_SEMANTICS.breakablerock.condition).toEqual(anyOf(flag('hasSword'), flag('hasSpear')));
        expect(ENTITY_SEMANTICS.breakablerockghost.condition).toEqual(flag('hasGhostSword'));
    });
});

describe('rules-fire-breaks-rocks — the clean stances (the flame reaches this rock and nothing else)', () => {
    it('every ordinary rock of the map is censused', () => {
        const placed = MAP.levels.flatMap((l) => (l.entities ?? []).filter((e) => e.type === 'breakablerock')
            .map((e) => `L${l.level}:breakablerock@${e.x},${e.y}`));
        expect(sorted(SIDES.keys())).toEqual(sorted(placed));
    });
    it('L40\'s and L41\'s rocks have no clean stance: every cell reaching one reaches another responder', () => {
        const crowdedRooms = [...SIDES.values()].filter((r) => r.level === 40 || r.level === 41);
        expect(crowdedRooms.length).toBeGreaterThan(0);
        for (const r of crowdedRooms) {
            expect(r.stances).toEqual([]);
            expect(r.crowded).toBeGreaterThan(0);
            expect(r.fireDirs).toEqual([]);
        }
    });
    it('every other ordinary rock has at least one clean stance (fidelity FIREBREAK\'s census)', () => {
        const rest = [...SIDES.values()].filter((r) => r.level !== 40 && r.level !== 41);
        expect(rest.filter((r) => r.stances.length === 0).map((r) => `L${r.level}:${r.id}`)).toEqual([]);
    });
    it('L0 `@288,176`: one stance, (280,184), the r7c6 side', () => {
        expect(row(0, 288, 176).stances.map(({ x, y }) => [x, y])).toEqual([[280, 184]]);
    });
});

describe('rules-fire-breaks-rocks — the sides', () => {
    it('L0\'s three rocks: Fire only from the side with a stance behind the entry', () => {
        // `@288,176` (tile 18,11): entered moving E from r7c6; the L12 landing (r11c19) is east of it
        expect(row(0, 288, 176)).toMatchObject({ fireDirs: ['E'], swingDirs: ['N', 'S', 'W'] });
        // `@80,112` (tile 5,7): entered moving N or W from r7c6; moving S from r6c5 (the L1 landing above) is the swing's
        expect(row(0, 80, 112)).toMatchObject({ fireDirs: ['N', 'W'], swingDirs: ['E', 'S'] });
        // `@192,32`: stances on both sides (r1c6 west, r2c13 east)
        expect(row(0, 192, 32)).toMatchObject({ fireDirs: ['E', 'W'] });
    });
    it('a landing counts only when its occupant can only have arrived: L3\'s L11 pocket', () => {
        const L3 = levelOf(3);
        const without = rockFireSides(L3, MODEL).get('breakablerock@96,112');
        expect(without.stances.some((s) => s.landing)).toBe(false);
        expect(without.fireDirs).not.toContain('N');
        const withLanding = rockFireSides(L3, MODEL, { arrivalTiles: [[6, 8]] }).get('breakablerock@96,112');
        expect(withLanding.stances.filter((s) => s.landing).map(({ x, y }) => [x, y])).toEqual([[104, 136]]);
        expect(withLanding.fireDirs).toContain('N');
        // a landing with floor beside it is not a stance: L0's L13 landing (3,12) sits in r7c6's open floor
        const L0 = levelOf(0);
        const l0 = rockFireSides(L0, MODEL, { arrivalTiles: [[3, 12]] });
        expect([...l0.values()].flatMap((r) => r.stances).some((s) => s.landing)).toBe(false);
    });
});

describe('rules-fire-breaks-rocks — the overlay ruling', () => {
    const base = ENTITY_SEMANTICS.breakablerock;
    const at = (level, x, y) => ({ type: 'breakablerock', x, y, attrs: {} });
    it('a rock with a stance is occupied on Sword|Spear|Fire and the overlay gates every side without a stance', () => {
        const ruled = overlayEntitySemantics(at(0, 288, 176), base, { level: 0, rockFire: SIDES });
        expect(ruled.condition).toEqual(ROCK_FIRE_CONDITION);
        expect(ruled.enter).toEqual({ N: base.condition, S: base.condition, W: base.condition });
        expect(ruled.fireStances).toEqual([[280, 184]]);
    });
    it('a rock with no stance (L40) and a ctx with no census keep the transcription\'s row', () => {
        expect(overlayEntitySemantics(at(40, 176, 128), base, { level: 40, rockFire: SIDES })).toBeNull();
        expect(overlayEntitySemantics(at(0, 288, 176), base, { level: 0 })).toBeNull();
        expect(overlayEntitySemantics(at(0, 288, 176), base, null)).toBeNull();
    });
});

describe('rules-fire-breaks-rocks — absorption in the analyzer (A ∧ (A ∨ B) = A)', () => {
    const has = (n, count) => ({ rule: 'Has', args: count ? { item_name: n, count } : { item_name: n } });
    const or = (...c) => ({ rule: 'Or', children: c });
    const and = (...c) => ({ rule: 'And', children: c });
    it('an Or a sibling implies is dropped, the survivor keeping the first one\'s place', () => {
        expect(simplifyRule(and(or(has('Sword'), has('Spear'), has('Fire')), has('Swim'), or(has('Sword'), has('Spear')))))
            .toEqual(and(or(has('Sword'), has('Spear')), has('Swim')));
        expect(simplifyRule(and(has('Spear'), or(has('Sword'), has('Spear'))))).toEqual(has('Spear'));
    });
    it('nothing is absorbed that is not implied', () => {
        const kept = and(or(has('Sword'), has('Spear')), or(has('Fire'), has('Swim')));
        expect(simplifyRule(kept)).toEqual(kept);
        // a count the sibling does not reach is not implied
        const counted = and(has('Swim'), or(has('Swim', 2), has('Fire')));
        expect(simplifyRule(counted)).toEqual(counted);
        // an Or is never absorbed inside an Or
        const inOr = or(has('Spear'), and(has('Sword'), has('Fire')));
        expect(simplifyRule(inOr)).toEqual(inOr);
    });
});
