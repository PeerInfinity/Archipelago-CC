/**
 * ⛓ hammer-phase SPEAR-ARM — `SPEAR_ARM` (`SEEDLING_SPEAR_ARM`, OFF): a bladeless run holding a spear gets the walk's
 * strike policy with the THRUST's geometry (`spearArm.spearStrikeGeometry`), and the segment's walk selects the spear
 * slot first. OFF, `strikePolicyFor` returns null for it, as before.
 *
 * The room rows use L22 entered by L25's door, aiming at the L29 exit (CONNECTED-L22's case). OFF it is the death loop's
 * stall; ON the policy exists and the combat ladder runs to its honest refusal on the wallflyer band. That is the wall
 * this slice stops at (the walk's strike surface carries no wallflyer: see the slice report §9). The sword control is
 * identical ON and OFF.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { canCross } from './seedlingCanCross.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    SPEAR_ARM, SPEAR_ARM_COUNTS, SPEAR_ARM_DEFAULT, resetSpearArmCounts, spearArmSlot, spearStrikeGeometry, withSpearArm,
} from './spearArm.js';
import { createStrikePolicy, strikeCandidates } from './strikePolicy.js';

const ENV = globalThis.process?.env ?? {};
const WAS = SPEAR_ARM.enabled;
const ASK = { level: 22, exit: 29, arrival: { from: 25 }, dashMode: 'none', witness: false };
const SPEAR_ID = 3; // `Inventory`'s item id for the spear (`tapeFormat.INVENTORY_ITEM_IDS.spear`)

afterEach(() => {
    SPEAR_ARM.enabled = WAS;
    resetSpearArmCounts();
});

describe('hammer-phase SPEAR-ARM — the switch', () => {
    it('ships OFF, `SEEDLING_SPEAR_ARM=1` turns it on, and the channel carries the name', () => {
        expect(SPEAR_ARM_DEFAULT).toBe(false);
        expect(SPEAR_ARM.enabled).toBe(ENV.SEEDLING_SPEAR_ARM === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SPEAR_ARM');
        const seen = withSpearArm(true, () => SPEAR_ARM.enabled);
        expect(seen).toBe(true);
        expect(SPEAR_ARM.enabled).toBe(WAS);
    });

    it('the slot: OFF none; ON the spear\'s slot for a bladeless spear holder, none with a blade or no spear', () => {
        const spearOnly = { hasSpear: true, hasFire: true };
        SPEAR_ARM.enabled = false;
        expect(spearArmSlot(spearOnly, [1, SPEAR_ID])).toBe(-1);
        SPEAR_ARM.enabled = true;
        expect(spearArmSlot(spearOnly, [1, SPEAR_ID])).toBe(1);
        expect(spearArmSlot({ ...spearOnly, hasSword: true }, [0, 1, SPEAR_ID])).toBe(-1);
        expect(spearArmSlot({ ...spearOnly, hasGhostSword: true }, [4, 1, SPEAR_ID])).toBe(-1);
        expect(spearArmSlot({ hasFire: true }, [1])).toBe(-1);
    });
});

describe('hammer-phase SPEAR-ARM — the scan asks with the thrust, not the swing', () => {
    // A body 18 px ahead on the right: past the plain swing's 16 px gate, inside the thrust's rect.
    const player = { x: 100, y: 100 };
    const body = { id: 'b', as3: 'Enemy', enemyClass: 'IceTurret', hitsTimer: 0, rect: { x: 118, y: 96, w: 8, h: 8, right: 126, bottom: 104 } };
    const ask = (geometry) => strikeCandidates(player, [body], {
        facingToward: () => 0, owed: new Map(), tick: 10, iframeLapse: false, ...(geometry ? { geometry } : {}),
    });

    it('the sword\'s scan rejects it on reach; the spear\'s geometry offers it', () => {
        expect(ask(null).chosen).toEqual([]);
        expect(ask(null).rejected[0].why).toMatch(/distanceRectPoint .* > 16/);
        const spear = ask(spearStrikeGeometry());
        expect(spear.chosen.map((c) => c.id)).toEqual(['b']);
        expect(spear.chosen[0].direction).toBe(0);
    });

    it('a thrust has no dash: a geometry policy refuses a dash grant by name', () => {
        expect(() => createStrikePolicy({ facingToward: () => 0, facingKeys: ['right', 'up', 'left', 'down'],
            allowDash: true, geometry: spearStrikeGeometry() })).toThrow(/no dash arm/);
    });
});

describe('hammer-phase SPEAR-ARM — L22 from L25\'s door to the L29 exit', () => {
    it('OFF: a spear-only run walks strike-free into the death loop\'s stall', () => {
        SPEAR_ARM.enabled = false;
        const r = canCross({ ...ASK, inventory: ['spear'] });
        expect(r.verdict).toBe('cannot');
        expect(r.why).toMatch(/the re-planned corridor failed too — .* waypoint 0 \(88,88\): not reached within 400 ticks/);
        expect(SPEAR_ARM_COUNTS).toEqual({ policies: 0, equips: 0, swallowed: 0 });
    });

    it('ON: the policy is built and the ladder refuses on the wallflyer band (the next wall)', () => {
        SPEAR_ARM.enabled = true;
        const r = canCross({ ...ASK, inventory: ['spear'] });
        expect(r.verdict).toBe('cannot');
        expect(r.why).toMatch(/the combat ladder is EXHAUSTED\. The corridor passes through danger at .* enemy:wallflyer@/);
        expect(SPEAR_ARM_COUNTS.policies).toBeGreaterThan(0);
        expect(SPEAR_ARM_COUNTS.equips).toBe(0); // the spear is the only item, so slot 0 is already it
    });

    it('ON with Fire selected first: the walk selects the spear\'s slot once', () => {
        SPEAR_ARM.enabled = true;
        const r = canCross({ ...ASK, inventory: ['fire', 'spear'] });
        expect(r.verdict).toBe('cannot');
        expect(SPEAR_ARM_COUNTS.equips).toBe(1);
        expect(SPEAR_ARM_COUNTS.policies).toBeGreaterThan(0);
    });

    it('a sword holder is untouched: the same answer ON and OFF', () => {
        SPEAR_ARM.enabled = false;
        const off = canCross({ ...ASK, inventory: ['spear', 'sword'] });
        SPEAR_ARM.enabled = true;
        const on = canCross({ ...ASK, inventory: ['spear', 'sword'] });
        const sansClock = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === 'ms' ? undefined : v)));
        expect(sansClock(on)).toEqual(sansClock(off));
        expect(SPEAR_ARM_COUNTS).toEqual({ policies: 0, equips: 0, swallowed: 0 });
    });
});
