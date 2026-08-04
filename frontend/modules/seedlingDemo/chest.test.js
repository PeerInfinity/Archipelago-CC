/**
 * seedlingDemo/chest.test — the verb with no button.
 *
 * R5 slice 9. The claims that matter are the DERIVED ones: the probe
 * line's asymmetric inset, the two-pixel stance band and the fact that the
 * band does not move when the cover opens (because the cover gates the
 * CHEST, not the approach). Everything else is the once-only latch and the
 * exact effect set.
 */

import { describe, expect, it } from 'vitest';

import {
    CHEST, ChestError, SEAL_DRAW, chestProbeLine, chestRect, chestStanceBand,
    createChestState, stepChests,
} from './chest.js';
import { HITBOX } from './playerPhysicsV1.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

const source = atlasLevelSource();

/** L38 from the census, never from literals. */
const l38 = () => buildLevelWorld(source(38), {
    roles: ROLES, inventory: { hasSword: true, hasFire: true },
});

/** `chest@144,112` — the join cell, found rather than assumed. */
function joinChest() {
    const world = l38();
    const found = world.solids.filter((s) => s.tag === 'chest');
    expect(found).toHaveLength(1);
    return found[0];
}

describe('the chest is in the census where §21.4 said it was', () => {
    it('L38 holds exactly one chest and it is at (144,112)', () => {
        const c = joinChest();
        expect({ x: c.x, y: c.y }).toEqual({ x: 144, y: 112 });
    });

    it('it is Solid, and it shares its cell with the cover', () => {
        const world = l38();
        const c = joinChest();
        const cover = world.activators.find((a) => a.tag === 'cover' && a.x === 144 && a.y === 112);
        expect(cover).toBeDefined();
        expect(c.rect).toEqual(cover.rect);
        expect(c.cls.type).toBe('Solid');
    });
});

describe('the probe line, and its ASYMMETRIC inset', () => {
    it('is one pixel below the box, inset 2 on the left and FOUR on the right', () => {
        expect(chestProbeLine(144, 112)).toEqual({ x0: 146, x1: 156, y: 129 });
    });

    it('the right inset is `2 * m`, which is what makes it asymmetric', () => {
        const line = chestProbeLine(0, 0);
        expect(line.x0 - 0).toBe(CHEST.m);
        expect(CHEST.box.w - line.x1).toBe(2 * CHEST.m);
        // The failure this guards: a symmetric reading would put x1 at 14.
        expect(line.x1).not.toBe(CHEST.box.w - CHEST.m);
    });

    it('refuses a non-integer placement rather than deriving a fractional line', () => {
        expect(() => chestProbeLine(144.5, 112)).toThrow(ChestError);
    });
});

describe('⛔⛔ the stance band is TWO PIXELS, and the chest is its floor', () => {
    it('is exactly {130, 131} for the join chest', () => {
        expect([...chestStanceBand(144, 112, HITBOX)]).toEqual([130, 131]);
    });

    it('the line arithmetic ALONE would admit five rows — four are inside the chest', () => {
        const line = chestProbeLine(144, 112);
        const arithmetic = [];
        for (let y = 120; y <= 140; y += 1) {
            const box = playerBoxAt(152, y);
            if (box.y <= line.y && line.y < box.bottom) arithmetic.push(y);
        }
        expect(arithmetic).toEqual([127, 128, 129, 130, 131]);
        const band = chestStanceBand(144, 112, HITBOX);
        expect(band).toHaveLength(2);
        // The four the chest's own solidity removes.
        expect(arithmetic.filter((y) => !band.includes(y))).toEqual([127, 128, 129]);
    });

    it('every row of the band puts the player box CLEAR of the chest', () => {
        const solid = chestRect(144, 112);
        for (const y of chestStanceBand(144, 112, HITBOX)) {
            const box = playerBoxAt(152, y);
            expect(box.y).toBeGreaterThanOrEqual(solid.bottom);
        }
    });

    it('⚠ the band does NOT move when the cover opens — the cover gates the CHEST', () => {
        // There is no cover argument, and that absence is the claim: the
        // gate `!collide("Solid", x, y)` is the chest colliding with the
        // cover, so links 1-4 buy the chest's permission, not the walk's.
        expect([...chestStanceBand(144, 112, HITBOX)]).toEqual([130, 131]);
    });

    it('refuses a hitbox in the WRONG SHAPE rather than reading zeros', () => {
        expect(() => chestStanceBand(144, 112, { w: 4, h: 5, originX: 2, originY: 2 }))
            .toThrow(ChestError);
    });

    it('names a chest with no reachable stance as a FINDING, not a route', () => {
        // A chest whose box is 16 px tall and whose probe row is one below
        // it always has a band; the failure arm is reachable only by
        // shrinking the search. That is the point — the throw exists so a
        // future placement cannot come back as an empty array.
        expect(() => chestStanceBand(144, 112, HITBOX, [100, 101])).toThrow(ChestError);
    });
});

describe('the live update: the gate, the latch and the fade', () => {
    const chests = [{ id: 'chest@144,112', x: 144, y: 112, persistTag: 1 }];
    const shut = () => ({ solidOver: () => true, hasAllSealParts: false });
    const open = () => ({ solidOver: () => false, hasAllSealParts: false });

    it('⛔ a COVERED chest does not open, however good the stance is', () => {
        const state = createChestState(chests);
        for (let i = 0; i < 50; i += 1) {
            const ev = stepChests(state, { ...shut(), playerBox: playerBoxAt(152, 130) });
            expect(ev).toEqual([]);
        }
        expect(state.get('chest@144,112').solid).toBe(true);
    });

    it('an UNCOVERED chest opens from the band and not from outside it', () => {
        const state = createChestState(chests);
        expect(stepChests(state, { ...open(), playerBox: playerBoxAt(152, 136) })).toEqual([]);
        const ev = stepChests(state, { ...open(), playerBox: playerBoxAt(152, 130) });
        expect(ev).toEqual([{
            kind: 'chestopen', id: 'chest@144,112', persistTag: 1, x: 144, y: 112,
        }]);
    });

    it('⛓ THE EFFECT SET: the type flip, the fade timer and the frame latch', () => {
        const state = createChestState(chests);
        stepChests(state, { ...open(), playerBox: playerBoxAt(152, 130) });
        const c = state.get('chest@144,112');
        // `type = ""` — the passage.
        expect(c.solid).toBe(false);
        // `sprChest.frame = 1` — the once-only latch.
        expect(c.frame).toBe(1);
        // `openTimer = 60`, then `timerStep()` in the SAME tick.
        expect(c.openTimer).toBe(CHEST.openTimerMax - 1);
    });

    it('the latch is once-only: a second tick in the band emits nothing', () => {
        const state = createChestState(chests);
        stepChests(state, { ...open(), playerBox: playerBoxAt(152, 130) });
        const ev = stepChests(state, { ...open(), playerBox: playerBoxAt(152, 130) });
        expect(ev.filter((e) => e.kind === 'chestopen')).toEqual([]);
    });

    it('the entity outlives its solidity by exactly openTimerMax ticks', () => {
        const state = createChestState(chests);
        let goneAt = null;
        for (let t = 1; t <= 100; t += 1) {
            const ev = stepChests(state, { ...open(), playerBox: playerBoxAt(152, 130) });
            if (ev.some((e) => e.kind === 'chestgone')) goneAt = t;
        }
        // Opened on tick 1, which is also its first `timerStep`.
        expect(goneAt).toBe(CHEST.openTimerMax);
    });

    it('⚠ `checkBySeal` is a BOUNDED VACUITY on this rung, and it is armed', () => {
        const state = createChestState(chests);
        const ev = stepChests(state, {
            solidOver: () => true, hasAllSealParts: true, playerBox: playerBoxAt(152, 200),
        });
        expect(ev).toEqual([{
            kind: 'chestgone', id: 'chest@144,112', persistTag: 1, why: 'checkBySeal',
        }]);
        // R5 banks ONE part, so nothing on this rung can make it true.
        expect(SEAL_DRAW.seals).toBe(16);
    });

    it('refuses a caller that did not say whether the seal is complete', () => {
        const state = createChestState(chests);
        expect(() => stepChests(state, { solidOver: () => true, playerBox: playerBoxAt(152, 130) }))
            .toThrow(ChestError);
    });

    it('refuses a caller with no geometry for the gate', () => {
        const state = createChestState(chests);
        expect(() => stepChests(state, { hasAllSealParts: false, playerBox: playerBoxAt(152, 130) }))
            .toThrow(ChestError);
    });
});

describe('⚠ the seal draw: the bounded update to §2.1', () => {
    it('one banked part per chest, whatever the draw', () => {
        expect(SEAL_DRAW.drawsPerIteration).toBe(1);
        expect(SEAL_DRAW.expectedDraws(0)).toBe(1);
    });

    it('the expectation grows as the save fills — 16/(16-k)', () => {
        expect(SEAL_DRAW.expectedDraws(8)).toBe(2);
        expect(SEAL_DRAW.expectedDraws(15)).toBe(16);
    });

    it('k = 16 is not a value: `hasAllSealParts` short-circuits before any draw', () => {
        expect(() => SEAL_DRAW.expectedDraws(16)).toThrow(ChestError);
    });

    it('nothing that reads the identity is a gameplay gate', () => {
        // The whole content of "the draws are inert": two readers, both
        // presentation or save state.
        expect(SEAL_DRAW.readsIdentity).toHaveLength(2);
        expect(SEAL_DRAW.readsIdentity.join(' ')).not.toMatch(/persistence|geometry|item/i);
    });

    it('⚠ a chest costs one draw at CONSTRUCTION too, opened or not', () => {
        expect(CHEST.ctorDraws).toBe(1);
    });
});
