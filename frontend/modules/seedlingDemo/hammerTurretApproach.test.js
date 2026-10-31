/**
 * seedlingDemo/hammerTurretApproach.test — ⛓⛓ SEEDLING HAMMER-PHASE APPROACH (`TURRET_APPROACH`, `FIFTH_ORDER`, both
 * OFF): the reordered corpse weigh's approach and kill as one fork certificate (`approachKillForCorpse`), the kill
 * box on the turret's snap (`iceTurretKillBox`), and the strategy bound's fifth distinct order (`fifthOrderAdmits`).
 * The fast rows: both switches ship OFF; the fifth-order rule on L40C's measured order list; the ctor-box row (a kill
 * stance derived before the turret's first on-screen update, off the run's rect and off the snap); the weigh's
 * fallback with no turret in range is OFF's byte for byte.
 * The latch chain's rows (each solve ~2–4 min) and ICEST's pocket boot (~1 min) are `hammerTurretApproach.slow.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot } from './fidelityL40Latch.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { PRE_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';
import {
    FIFTH_ORDER, FIFTH_ORDER_DEFAULT, TURRET_APPROACH, TURRET_APPROACH_COUNTS, TURRET_APPROACH_DEFAULT,
    fifthOrderAdmits, iceTurretKillBox, resetTurretApproachCounts, strategyBoundReached, withFifthOrder,
    withLatchWeighFirst, withTurretApproach,
} from './solverBot.js';

const TURRET = 'iceturret@472,400';

/** `hammerLatchWeigh.test.js`'s `C2-no-block` gadget: a lock, its button, no block; `turret` adds a live ice turret. */
function solveNoBlockGadget(turret = null) {
    const START = SEEDLING_DEFAULTS.start;
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const walls = [];
    for (let tx = 1; tx <= 8; tx += 1) if (tx !== 4) walls.push({ tx, ty: 5, terrain: 'wall' });
    record = withTerrain(record, walls);
    record = withEntities(record, [
        { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(7, 8), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: 'lock', ...oelAtTile(4, 5), attrs: { tset: '0', tag: '0' } },
        { type: 'button', ...oelAtTile(6, 3), attrs: { tset: '0' } },
        ...(turret ? [{ type: 'iceturret', ...oelAtTile(turret.tx, turret.ty) }] : []),
    ]);
    const staging = bootStaging({ boot: bootAtTile(record, START.tx, START.ty), items: PRE_SWORD_ITEMS,
        pins: ['dead_frames'] });
    return solve(record, staging, [collectGoal(7 * 16, 8 * 16)], DEFAULT_BUDGET, { name: 'C2-no-block' });
}

/** A solve's answer, comparable (timings and functions dropped). */
const strip = (o) => JSON.stringify(o, (k, v) => (k === 'ms' || typeof v === 'function' ? undefined : v));

/** The run of the latch boot (re-booted at `at`) at tick 0, before any update. */
async function latchRunAt(at = null) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    let boot = await l40LatchBoot();
    if (at) boot = { ...boot, boot: { ...boot.boot, x: at.x, y: at.y } };
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(boot))));
    return createRunForStaging(staging, atlasLevelSource());
}

describe('hammer-phase APPROACH: TURRET_APPROACH and FIFTH_ORDER', () => {
    it('both ship OFF, and the env alone turns each on', () => {
        expect(TURRET_APPROACH_DEFAULT).toBe(false);
        expect(FIFTH_ORDER_DEFAULT).toBe(false);
        expect(TURRET_APPROACH.enabled).toBe(globalThis.process?.env?.SEEDLING_TURRET_APPROACH === '1');
        expect(FIFTH_ORDER.enabled).toBe(globalThis.process?.env?.SEEDLING_FIFTH_ORDER === '1');
        withTurretApproach(true, () => expect(TURRET_APPROACH.enabled).toBe(true));
        withTurretApproach(false, () => expect(TURRET_APPROACH.enabled).toBe(false));
        withFifthOrder(true, () => expect(FIFTH_ORDER.enabled).toBe(true));
        withFifthOrder(false, () => expect(FIFTH_ORDER.enabled).toBe(false));
    });

    it('the fifth order: admitted only as a fifth DISTINCT application after four distinct ones (L40C\'s list)', () => {
        // L40C's scratch arm (LWEIGH's guard off): the four orders before the bound at t3416, then the shove it needs
        const four = ['shove(pushableblockfire@576,576)', 'weigh(wandlock@448,432)', 'hold(wandlock@480,560)',
            'weigh(wandlock@800,400)'];
        const next = 'shove(pushableblock@576,560)';
        expect(fifthOrderAdmits(four, next)).toBe(true);
        // a repeat of a succeeded order is not a fifth
        for (const again of four) expect(fifthOrderAdmits(four, again)).toBe(false);
        // only at exactly four, all distinct, and with a next to ask about
        expect(fifthOrderAdmits(four.slice(0, 3), next)).toBe(false);
        expect(fifthOrderAdmits([...four, next], 'kill(x)')).toBe(false);
        expect(fifthOrderAdmits([four[0], four[1], four[1], four[3]], next)).toBe(false);
        expect(fifthOrderAdmits(four, null)).toBe(false);
        // the bound: OFF reached at four (byte-identical with or without `next`); ON lifted for the fifth only
        withFifthOrder(false, () => {
            expect(strategyBoundReached(four)).toBe(true);
            expect(strategyBoundReached(four, next)).toBe(true);
        });
        withFifthOrder(true, () => {
            expect(strategyBoundReached(four, next)).toBe(false);
            expect(strategyBoundReached(four, four[2])).toBe(true);
            expect(strategyBoundReached(four)).toBe(true);
            expect(strategyBoundReached([...four, next], 'kill(x)')).toBe(true);
            expect(strategyBoundReached(four.slice(0, 3), next)).toBe(false);
        });
    });

    it('the ctor box: a kill stance derived before the turret\'s first on-screen update — off the run\'s rect it stands inside the live body, off the snap it does not', async () => {
        // ICEST's pocket boot (480,456): the turret is on screen from tick 1, and at tick 0 it has not yet updated
        const run = await latchRunAt({ x: 480, y: 456 });
        const t0 = run.entities('turrets').get(TURRET);
        expect({ x: t0.x, y: t0.y }).toEqual({ x: 488, y: 416 });
        const sideOf = (r) => ({ x: (r.x + r.right) / 2, y: r.bottom + 5 });
        const offStance = withTurretApproach(false, () => sideOf(iceTurretKillBox(t0)));
        const onStance = withTurretApproach(true, () => sideOf(iceTurretKillBox(t0)));
        expect(withTurretApproach(false, () => iceTurretKillBox(t0))).toEqual(t0.rect);
        // the first update snaps the body (its y by 8 px, its x onto the 0.5 px rest cycle)
        run.advance(new Set());
        const t1 = run.entities('turrets').get(TURRET);
        expect(t1.y).toBe(424);
        const live = t1.rect;
        const inside = (p) => p.x > live.x && p.x < live.right && p.y > live.y && p.y < live.bottom;
        expect(offStance).toEqual({ x: 488, y: 437 });
        expect(inside(offStance)).toBe(true);
        expect(onStance).toEqual({ x: 488, y: 445 });
        expect(inside(onStance)).toBe(false);
        // once updated the two boxes agree (the rest cycle is 0.5 px), so no updated caller moves
        expect(withTurretApproach(true, () => iceTurretKillBox(t1))).toEqual(withTurretApproach(false, () => iceTurretKillBox(t1)));
    }, 60000);

    it('no turret in range: the weigh\'s hold fallback is OFF\'s byte for byte, nothing approached', () => {
        for (const turret of [null, { tx: 17, ty: 12 }]) {
            const off = withLatchWeighFirst(true, () => withTurretApproach(false, () => solveNoBlockGadget(turret)));
            resetTurretApproachCounts();
            const on = withLatchWeighFirst(true, () => withTurretApproach(true, () => solveNoBlockGadget(turret)));
            expect(strip(on)).toBe(strip(off));
            expect(TURRET_APPROACH_COUNTS.approaches).toEqual([]);
        }
    }, 240000);

    it('a turret in range with no corpse route (no Fire): the reorder is not taken, so ON = OFF and nothing approached', () => {
        const turret = { tx: 6, ty: 1 };
        const off = withLatchWeighFirst(true, () => withTurretApproach(false, () => solveNoBlockGadget(turret)));
        resetTurretApproachCounts();
        const on = withLatchWeighFirst(true, () => withTurretApproach(true, () => solveNoBlockGadget(turret)));
        expect(strip(on)).toBe(strip(off));
        expect(TURRET_APPROACH_COUNTS.approaches).toEqual([]);
    }, 240000);
});
