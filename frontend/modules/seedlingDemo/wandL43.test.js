/**
 * `wandL43.test.js` — L43's NORTH EXIT, PRICED END TO END.
 *
 * R6 slice 2's fourth deliverable (§4 slice 2: *"the L43 north exit priced
 * end-to-end"*). Not a recording and not a window — an OFFLINE drive of the
 * shipped `levelRun` through the whole chain, so the three new modules are
 * exercised together against the shipped geometry rather than against each
 * other's fixtures.
 *
 * ```
 *   boot L43 (wand GRANTED, boss asleep)
 *     -> face north
 *     -> one plain-wand press
 *     -> 7 ticks of animation      (wandVerb.WAND_WINDOW.fireTick)
 *     -> the shot exists           (+1, the deferred FP.world.add)
 *     -> 3 updates of flight       (48 px of budget, 8 px of distance)
 *     -> MagicalLock.hit(0)        -> Game.setPersistence(4, false)
 *     -> 15 updates of "destroy"   (magicalLock.MAGICAL_LOCK_OPEN_TICK_OFFSET)
 *     -> the cell is passable
 *     -> walk north -> teleporter@144,64 -> L37 at (296,184)
 * ```
 *
 * ── ⛓⛓ THE STANCE IS AN ARGUMENT, NOT A SEARCH ───────────────────────
 *
 * The corridor is one tile wide. At `ty = 7` the room is wall from `x 96`
 * to `x 144` and from `x 160` to `x 208`, so a 3-wide shot box `[x-2, x+1)`
 * fits only for `x` in `[146, 159]` — and the shot's `x` is `int(player.x)`
 * for an UP shot. That is the whole of the x constraint, and it is
 * ARITHMETIC rather than a swept answer.
 *
 * ── ⛔ THE BOSS MUST NOT WAKE, AND THE GRANT IS WHY ───────────────────
 *
 * `BossTotem` activates on `FP.world.classCount(Wand) <= 0` — i.e. when the
 * `Wand` PICKUP has left the world. R0's grants ruling makes an item a
 * property write and never removes the entity, so a granted wand leaves
 * `wand@144,224` standing, `classCount` at 1, and the boss asleep — an
 * 80x32 `"Solid"` across `[112,192) x [180,212)`, which is also the wall
 * that keeps this whole chain in the north chamber. The fight is slice 4's
 * and this asserts it did not start.
 *
 * ── ⛓ AND L43 HOLDS A WATCHER NOBODY HAD NAMED (§8.16) ───────────────
 *
 * `watcher@200,280 {tag 6, text "", text1 ""}`. `Watcher.hit()` guards on
 * `text != ""` so it can never be hit, `check()` is overridden EMPTY so it
 * never despawns, and `type = "Watcher"` is in no `solids` list — including
 * the wand shot's. Asserted inert here rather than left as a note.
 */

import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, rect } from './levelWorld.js';
import {
    MAGICAL_LOCK_OPEN_TICK_OFFSET, magicalLockOpens,
} from './magicalLock.js';
import { WAND_SHOT_SOLID_TYPES } from './wandShot.js';
import { WAND_WINDOW } from './wandVerb.js';

const levelSource = atlasLevelSource();
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard'];
const l43 = () => buildLevelWorld(levelSource(43), { roles: ROLES });

/** ⚠ The BOOT BLOCK is `new Game(level,x,y)`'s ARGUMENTS: `spawnFromBoot` */
/** adds (Tile.w/2, Tile.h/2), so (144,152) is the entity point (152,160). */
const BOOT = Object.freeze({ level: 43, x: 144, y: 152 });

const PRESS_TICK = 20;
const SPANS = Object.freeze([
    // Face north. `direction` is written by `sprites()` from `v`, and once
    // the player stops it is NOT rewritten — so three ticks of `up` set the
    // facing for the rest of the run.
    { key: 'up', from: 0, to: 2 },
    { key: 'primary', from: PRESS_TICK, to: PRESS_TICK },
    // …and the walk out, from the tick the cell can open at the earliest.
    { key: 'up', from: 45, to: 240 },
]);

function drive(spans, { limit = 260 } = {}) {
    const run = createLevelRun({
        levelSource,
        boot: BOOT,
        grants: [{ level: 43, items: ['wand'] }],
        equips: [{ t: 0, slot: 0 }],
        noDamage: true,
    });
    const held = (t) => new Set(
        spans.filter((s) => t >= s.from && t <= s.to).map((s) => s.key),
    );
    let arrived = null;
    for (let t = 0; t < limit; t += 1) {
        const r = run.advance(held(t));
        if (r.transition && arrived === null) { arrived = { t: t + 1, ...r.transition }; break; }
    }
    return { run, arrived };
}

describe('the room, before anything is driven', () => {
    it('holds the lock, the teleporter, the sleeping boss and the inert Watcher', () => {
        const w = l43();
        expect(w.magicalLocks).toHaveLength(1);
        expect(w.magicalLocks[0]).toMatchObject({
            id: 'magicallock@144,112', tag: 4, lockType: 0, ex: 152, ey: 120,
        });
        const north = w.teleporters.find((t) => !t.isStairs);
        expect(north).toMatchObject({ x: 144, y: 64, to: 37 });
        expect(north.arrival).toEqual({ x: 296, y: 184 });
        expect(w.bossTotems).toHaveLength(1);
        expect(w.bossTotems[0].preWakeRect).toMatchObject({
            x: 112, y: 180, right: 192, bottom: 212,
        });
    });

    it('a plain wand opens THIS lock — lockType 0 against shotType 0', () => {
        expect(magicalLockOpens(l43().magicalLocks[0].lockType, 0)).toBe(true);
    });

    it('the corridor at ty 7 admits a 3-wide shot box only for x in [146, 159]', () => {
        const w = l43();
        const open = { openMagicalLocks: new Set(['magicallock@144,112']) };
        const fits = [];
        for (let x = 100; x < 200; x += 1) {
            // The shot's box, at the lock's own row, with the lock gone: if
            // it clears, the column is one a shot can travel.
            if (!w.collidesSolid(rect(x - 2, 112, 3, 3), open)) fits.push(x);
        }
        expect([fits[0], fits[fits.length - 1]]).toEqual([146, 159]);
    });

    it('the Watcher is in NO solids list, including the shot\'s own (§8.16)', () => {
        const w = l43();
        // The room really does hold one, and it contributes no geometry.
        expect(levelSource(43).entities.some((e) => e.type === 'watcher')).toBe(true);
        expect(w.solids.some((s) => s.tag === 'watcher')).toBe(false);
        // ⚠ NOT "nothing is solid at its cell" — that was the first cut and
        // it failed: `watcher@200,280` stands beside a `Blue Wall` TILE at
        // (192,288). A probe over the cell measures the neighbour, which is
        // a different claim and a true one. The claim is about the ENTITY.
        expect(WAND_SHOT_SOLID_TYPES).not.toContain('Watcher');
    });
});

describe('the chain, driven', () => {
    const { run, arrived } = drive(SPANS);

    it('fires exactly one shot, seven ticks after the press', () => {
        expect(run.wandShots).toHaveLength(1);
        expect(run.wandShots[0]).toMatchObject({
            t: PRESS_TICK + WAND_WINDOW.fireTick,
            pressTick: PRESS_TICK,
            direction: 1,
            level: 43,
        });
        expect(run.wandShots[0].t).toBe(27);
    });

    it('spawns it 16 px north of the player, truncated', () => {
        // The player is at y 154.85 after the facing nudge; `int(154.85 - 16)`
        // is 138 — the `_x:int` ctor, not a round.
        expect(run.wandShots[0]).toMatchObject({ x: 152, y: 138 });
    });

    it('the shot reaches the lock three updates later and opens it', () => {
        expect(run.wandShotHits).toHaveLength(1);
        expect(run.wandShotHits[0]).toMatchObject({
            arm: 'magicallock',
            id: 'magicallock@144,112',
            lockType: 0,
            shotType: 0,
            opened: true,
            spentWithoutDamage: false,
        });
        // Fired at 27, first own update at 28 (the deferred add), contact on
        // its third — 138 -> 135 -> 132 -> the sweep stops at 130.
        expect(run.wandShotHits[0].t).toBe(30);
        expect(run.wandShotHits[0].t - run.wandShots[0].t)
            .toBe(WAND_WINDOW.firstShotUpdateTick - WAND_WINDOW.fireTick + 2);
    });

    it('the cell opens FIFTEEN ticks after the hit, not on it', () => {
        expect(run.magicalLocksOpened).toHaveLength(1);
        const l = run.magicalLocksOpened[0];
        expect(l).toMatchObject({ tag: 4, hitTick: 30, openTick: 45 });
        expect(l.openTick - l.hitTick).toBe(MAGICAL_LOCK_OPEN_TICK_OFFSET);
    });

    it('and the walk out lands in L37 at the teleporter\'s declared arrival', () => {
        expect(arrived).toMatchObject({ from_level: 43, to_level: 37 });
        expect(run.level).toBe(37);
        expect({ x: run.state.x, y: run.state.y }).toEqual({ x: 296, y: 184 });
    });

    it('the whole exit costs 109 ticks from the boot', () => {
        expect(arrived.t).toBe(109);
    });

    it('…and the boss never woke — the grant left the Wand entity standing', () => {
        expect(run.bossesWoken).toEqual([]);
        expect(run.bossClamps).toEqual([]);
    });
});

describe('the shut-before control — one primitive fewer', () => {
    /**
     * ⛓ THE R5 HOLD-PAIR SHAPE. The same spans with the `primary` press
     * DELETED: everything else is byte-identical, the lock is never hit, and
     * the player walks into a wall the treatment opened.
     *
     * ⚠ A DELETION IS THE RIGHT CONTROL *HERE* and it is not in general —
     * [[feedback_control_that_removes_treatment_changes_the_world]] is about
     * a room whose live shooter burns a press. L43 with a sleeping boss has
     * no such consumer: the press's only effect is the shot.
     */
    const noPress = SPANS.filter((s) => s.key !== 'primary');
    const { run, arrived } = drive(noPress);

    it('fires nothing and opens nothing', () => {
        expect(run.wandShots).toEqual([]);
        expect(run.magicalLocksOpened).toEqual([]);
    });

    it('never reaches L37 — the lock is the whole exit', () => {
        expect(arrived).toBeNull();
        expect(run.level).toBe(43);
        expect(run.transitions).toEqual([]);
    });

    it('and parks against the lock\'s own bottom edge', () => {
        // The lock's box is y[112,128) and the player's is 5 tall at
        // origin 2, so the box top is `y - 2` and can never cross 128.
        expect(run.state.y - 2).toBeGreaterThanOrEqual(128);
        expect(run.state.y).toBeLessThan(131);
    });

    it('⛓ …by CREEPING, not by stopping — the rest position is not a point', () => {
        // Measured, and it corrected the first cut of this test, which
        // pinned 130.55 (the value at tick 91) and found 130.10 at 260.
        // `moveY`'s last sub-step is `min(1, |rel| - i)`, so a blocked walk
        // keeps closing fractions of a pixel long after it looks parked.
        // [[feedback_rest_position_may_be_a_cycle]], the same shape.
        const at = (limit) => drive(noPress, { limit }).run.state.y;
        const early = at(91);
        const late = at(260);
        expect(late).toBeLessThan(early);
        expect(early - late).toBeCloseTo(0.45, 5);
    });
});

describe('the refusals this room can reach', () => {
    it('a second press inside the window is refused, not swallowed', () => {
        expect(() => drive([
            { key: 'up', from: 0, to: 2 },
            { key: 'primary', from: 20, to: 20 },
            // `endTick` is 27; a press ON it reads `_wanding` still true.
            { key: 'primary', from: 27, to: 27 },
        ], { limit: 40 })).toThrow(/lands inside the window the press at tick 20 opened/);
    });

    it('…and one tick later is the first that fires', () => {
        const { run } = drive([
            { key: 'up', from: 0, to: 2 },
            { key: 'primary', from: 20, to: 20 },
            { key: 'primary', from: 28, to: 28 },
        ], { limit: 60 });
        expect(run.wandShots.map((s) => s.pressTick)).toEqual([20, 28]);
    });

    it('⛓⛓ a shot that reaches the SLEEPING boss is REFUSED BY THE BOSS', () => {
        // The boot facing is `direction = 3` (down), so a press with no
        // northward nudge shoots into the sleeping totem's 80x32 body.
        //
        // ⛓ R6 SLICE 4: slice 2's `throw` retired here, and what replaced
        // it is not "the hit lands". `BossTotem.hit` wraps `super.hit` in
        // `fullyActivated && activationRestTime <= 0`, so a shot at a
        // SLEEPING boss is a shot spent for nothing — which is the same
        // verdict the refusal was standing in for, now computed from the
        // source instead of declared.
        const { run } = drive([{ key: 'primary', from: 5, to: 5 }], { limit: 40 });
        expect(run.wandShotHits).toHaveLength(1);
        expect(run.wandShotHits[0]).toMatchObject({
            arm: 'enemy',
            id: 'bosstotem@152,168',
            landed: false,
            spentWithoutDamage: true,
            refusedAt: 'fullyActivated',
        });
        expect(run.bossHits).toHaveLength(1);
        expect(run.bossHits[0]).toMatchObject({ hits: 0, killed: false });
    });
});
