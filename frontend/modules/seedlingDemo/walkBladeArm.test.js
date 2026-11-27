/**
 * ⛓ SEEDLING HAMMER-PHASE L65→L68 HIT (`seedling-hammer-l65-l68-hit`; ⚖ the user, 2026-11-27: *"L65→L68 hit slice
 * (Recommended)"*) — the default-tier rows of `WALK_BLADE_ARM`.
 *
 *   - the switch ships OFF, its env name is in the solver's table, `withWalkBladeArm` restores (also on a throw);
 *   - `walkBladeArmSlot` (pure): the blade's slot in the run's own slot array, or -1 — 37:8's arrival (slots
 *     `[0,1,3,2]`, the wand selected) selects slot 0; a blade press already selected, no blade, a blade not yet
 *     slotted, and the Ghost Sword (it replaces the sword) are the other cases.
 *
 * The leg itself (whole-game entry 37's chain, L65 → L68 `(184,64)`, the bob hit OFF and the hitless plan ON) is the
 * train tier: `walkBladeArm.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import {
    WALK_BLADE_ARM, WALK_BLADE_ARM_COUNTS, WALK_BLADE_ARM_DEFAULT, resetWalkBladeArmCounts, walkBladeArmSlot,
    withWalkBladeArm,
} from './walkBladeArm.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { INVENTORY_ITEM_IDS } from './tapeFormat.js';

const { sword, fire, wand, spear, ghostsword } = INVENTORY_ITEM_IDS;
const inv = (o) => ({ hasSword: false, hasGhostSword: false, hasFire: false, hasWand: false, hasSpear: false, ...o });

describe('WALK_BLADE_ARM — the switch', () => {
    it('ships OFF, and its env name is in the solver\'s table (sorted, unique)', () => {
        expect(WALK_BLADE_ARM_DEFAULT).toBe(false);
        expect(WALK_BLADE_ARM.enabled).toBe(process.env.SEEDLING_WALK_BLADE_ARM === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WALK_BLADE_ARM');
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
        expect(new Set(SOLVER_ENV_NAMES).size).toBe(SOLVER_ENV_NAMES.length);
    });

    it('withWalkBladeArm sets it for the call and restores it, also on a throw', () => {
        const before = WALK_BLADE_ARM.enabled;
        expect(withWalkBladeArm(true, () => WALK_BLADE_ARM.enabled)).toBe(true);
        expect(withWalkBladeArm(false, () => WALK_BLADE_ARM.enabled)).toBe(false);
        expect(WALK_BLADE_ARM.enabled).toBe(before);
        expect(() => withWalkBladeArm(true, () => { throw new Error('x'); })).toThrow('x');
        expect(WALK_BLADE_ARM.enabled).toBe(before);
    });

    it('the instrument resets', () => {
        WALK_BLADE_ARM_COUNTS.equips = 3;
        WALK_BLADE_ARM_COUNTS.rows.push({ t: 1 });
        resetWalkBladeArmCounts();
        expect(WALK_BLADE_ARM_COUNTS).toEqual({ equips: 0, rows: [] });
    });
});

describe('walkBladeArmSlot — the blade the walk selects', () => {
    it('37:8\'s arrival: sword held, slots [sword, fire, spear, wand], the wand selected → slot 0', () => {
        const held = inv({ hasSword: true, hasFire: true, hasWand: true, hasSpear: true });
        expect(walkBladeArmSlot(held, [sword, fire, spear, wand], 'wand')).toBe(0);
        // the same selection of any other non-blade item
        expect(walkBladeArmSlot(held, [sword, fire, spear, wand], 'fire')).toBe(0);
        expect(walkBladeArmSlot(held, [sword, fire, spear, wand], 'spear')).toBe(0);
        expect(walkBladeArmSlot(held, [sword, fire, spear, wand], null)).toBe(0);
    });

    it('reads the run\'s own slot order (the sword in another slot)', () => {
        expect(walkBladeArmSlot(inv({ hasSword: true, hasWand: true }), [wand, sword], 'wand')).toBe(1);
    });

    it('-1 when the press is already a blade, no blade is held, or the blade has no slot yet', () => {
        expect(walkBladeArmSlot(inv({ hasSword: true, hasWand: true }), [sword, wand], 'sword')).toBe(-1);
        expect(walkBladeArmSlot(inv({ hasWand: true, hasSpear: true }), [wand, spear], 'wand')).toBe(-1);
        expect(walkBladeArmSlot(inv({ hasSword: true, hasWand: true }), [wand], 'wand')).toBe(-1);
        expect(walkBladeArmSlot(null, [sword], 'wand')).toBe(-1);
        expect(walkBladeArmSlot(inv({ hasSword: true }), null, 'wand')).toBe(-1);
    });

    it('the Ghost Sword replaces the sword: its slot, and a plain-sword selection is not a blade press', () => {
        const held = inv({ hasSword: true, hasGhostSword: true, hasWand: true });
        expect(walkBladeArmSlot(held, [sword, wand, ghostsword], 'wand')).toBe(2);
        expect(walkBladeArmSlot(held, [sword, wand, ghostsword], 'sword')).toBe(2);
        expect(walkBladeArmSlot(held, [sword, wand, ghostsword], 'ghostsword')).toBe(-1);
        expect(walkBladeArmSlot(held, [sword, wand], 'wand')).toBe(-1);
    });
});
