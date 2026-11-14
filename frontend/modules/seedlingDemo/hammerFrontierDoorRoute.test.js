/**
 * ⛓⛓⛓ seedling-hammer-small-walls: THE FRONTIER ASKS FIRST THE DOOR THAT STARTS THE FEWEST-DOORS ROUTE TO THE AIM
 * (`FRONTIER_DOOR_ROUTE`, OFF; `SEEDLING_FRONTIER_DOOR_ROUTE=1`).
 *
 * The witness is rules-7's L12 Chest re-staged at the r0c19 door (432,368) (the L33 arrival), no L12 flag, the seed-1
 * route's inventory at sphere 4.8, on the AP-delivered level set. OFF the nearest-to-aim frontier opens
 * `shieldlocknorm@288,704` (a dead end beside the chest's corridor) first; ON the fewest-doors flood asks the bosslock
 * the chest is behind first. The control is the same chest from the census arrival (32,864) with its door's own
 * flags: a corridor that plans, so the flood is never asked. The rows USE the legs; the switch reads no level id, no
 * coordinate and no Seedling constant. The measurement is in `CC/docs/cloud-reports/seedling-hammer-small-walls.md` §3.
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { createRunForStaging } from './tapeRunner.js';
import { l25Sets } from './fidelityL25ApItem.js';
import {
    FRONTIER_DOOR_ROUTE, FRONTIER_DOOR_ROUTE_DEFAULT, solveSegment, withFrontierDoorRoute,
} from './solverBot.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = l25Sets(ROOT).deliveredSource;
const CHEST = [{ kind: 'collect-placement', placement: { x: 320, y: 816 } }];
const SHIELD_LOCK_TAG = 10;   // the witness room's `shieldlocknorm@288,704` (its persistence tag), read by the row only

/** The seed-1 route's sphere-4.8 staging, booted at `boot` with `persistence` cleared (the sweep's capture, leg 183). */
function staging(boot, persistence) {
    return {
        boot: { level: 12, ...boot }, noclip: false, noDamage: false, noHazards: [], grants: [], persistence,
        despawn: [], equips: [], pins: ['sound', 'dead_frames'],
        save: { totem_parts: [], keys: [0, 1], seal_parts: [0, 1, 2, 3, 4, 5] },
        rng: { seed: 404717770, split: true, cosmetic: 0 },
        seam: {
            items: { hasSword: true, hasGhostSword: false, hasShield: true, hasFire: true, hasWand: false,
                hasFireWand: false, canSwim: false, hasSpear: false, hasDarkShield: false, hasDarkSuit: false,
                hasDarkSword: false, hasFeather: false, hasTorch: true },
            beam: false, rock_set: false, hits_max: 3, time: 5203, primary: 0, secondary: 0,
            cutscene: [false, false, false, false], menu_state: 0,
        },
        inventory_slots: [0, 1],
    };
}

/** The chest solved on a fresh run under `on`: outcome, ticks, hits, keys' md5, the flags earned, the counts. */
function solveChest(boot, persistence, on) {
    const run = createRunForStaging(staging(boot, persistence), SOURCE, { scratchPersistence: true });
    const keys = [];
    const advance = run.advance.bind(run);
    run.advance = (...a) => { keys.push([...a[0]].sort().join('+')); return advance(...a); };
    FRONTIER_DOOR_ROUTE.counts.asked = 0;
    FRONTIER_DOOR_ROUTE.counts.moved = 0;
    FRONTIER_DOOR_ROUTE.counts.fellBack = 0;
    let err = null;
    withFrontierDoorRoute(on, () => {
        try {
            solveSegment({ run, goals: CHEST, name: 'small-walls-l12', boot: { level: 12, ...boot } });
        } catch (e) { err = e; }
    });
    return {
        err, ticks: keys.length, hits: run.ledger('playerHits').length,
        md5: createHash('md5').update(keys.join(',')).digest('hex'),
        earned: (run.earnedClears ?? []).filter((c) => c.level === 12).map((c) => c.tag),
        end: { x: run.state.x, y: run.state.y }, counts: { ...FRONTIER_DOOR_ROUTE.counts },
    };
}

describe('SMALL-WALLS — `FRONTIER_DOOR_ROUTE` (OFF)', () => {
    it.skipIf(process.env.SEEDLING_FRONTIER_DOOR_ROUTE)('ships OFF; its env name is a known worker env name', () => {
        expect(FRONTIER_DOOR_ROUTE_DEFAULT).toBe(false);
        expect(FRONTIER_DOOR_ROUTE.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FRONTIER_DOOR_ROUTE');
    });

    it('L12 Chest from (432,368), no flag: OFF opens the dead-end shield lock first; ON skips it, hitless and shorter',
        () => {
            const off = solveChest({ x: 432, y: 368 }, [], false);
            const on = solveChest({ x: 432, y: 368 }, [], true);
            expect(off.err).toBeNull();
            expect(on.err).toBeNull();
            // both collect the chest hitless
            for (const r of [off, on]) {
                expect(r.hits).toBe(0);
                expect(Math.hypot(r.end.x - 328, r.end.y - 824)).toBeLessThan(4);
            }
            // OFF: the flood is never asked, and the walk opens the shield lock on its way
            expect(off.counts).toEqual({ asked: 0, moved: 0, fellBack: 0 });
            expect(off.earned).toContain(SHIELD_LOCK_TAG);
            // ON: the flood moves the frontier's first door, the shield lock stays shut, and the plan is shorter
            expect(on.counts.moved).toBeGreaterThan(0);
            expect(on.counts.fellBack).toBe(0);
            expect(on.earned).not.toContain(SHIELD_LOCK_TAG);
            expect(on.ticks).toBeLessThan(off.ticks - 400);
        }, 180_000);

    it('control: the same chest from the census arrival (32,864), its door flags staged, is byte-identical', () => {
        const flags = [{ level: 12, tag: 7 }, { level: 12, tag: 12 }];
        const off = solveChest({ x: 32, y: 864 }, flags, false);
        const on = solveChest({ x: 32, y: 864 }, flags, true);
        expect(off.err).toBeNull();
        expect(on.counts).toEqual({ asked: 0, moved: 0, fellBack: 0 });
        expect(on.md5).toBe(off.md5);
        expect(on.ticks).toBe(off.ticks);
    }, 120_000);
});
