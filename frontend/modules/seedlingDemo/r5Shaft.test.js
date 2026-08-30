/**
 * r5Shaft — L39's choreography, and the three model gaps pricing it found.
 *
 * R5 slice 7. The claims here are in three strata and they are deliberately
 * different in kind:
 *
 *   1. THE PLAN, as arithmetic over `SHAFT_PLAN` — continuity, and that it
 *      ends with a block on each of the three lock-buttons.
 *   2. THE REFUTATION, driven through the same two models the route uses —
 *      §19.8's presses 17 and 18 really do move a second block, and the
 *      corrected plan's last press really does move three.
 *   3. THE MODEL, driven through a real `levelRun` in L39 — a fire press
 *      pushes a block, a rope pull shrinks a wall, a WandLock's fade writes
 *      a flag, and a `room = -1` ButtonRoom latches its group.
 */

import { describe, it, expect } from 'vitest';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, ROLES } from './levelWorld.js';
import { createLevelRun } from './levelRun.js';
import { fireHits, FIRE_WINDOW, FIRE_PRESS_CADENCE } from './fireVerb.js';
import { hitPushableFromPoint, newPushable } from './pushables.js';
import {
    createActivatorState, crossRoomWrites, localPublish, stepActivators, openActivatorIds,
} from './activators.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import {
    LEVEL, SHAFT_PLAN, SHAFT_REFUTED, SHAFT_LEDGER, SHAFT_LEDGER_NET, ROPE_PULL, SHAFT_PAIR,
    TOTEM_PART_2, SWAP_MARGINS, assertPlanContinuity, pressPrice, centre, ShaftError,
} from './r5Shaft.js';

const source = atlasLevelSource();
const TILE = 16;
const INVENTORY = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const world39 = () => buildLevelWorld(source(LEVEL), { roles: ROLES, inventory: INVENTORY });

/** One press, over a declared block layout, through the two real models. */
function pressFrom(stance, blocks) {
    const player = centre(stance.tx, stance.ty);
    const targets = Object.entries(blocks).map(([id, [tx, ty]]) => ({
        id, type: 'Solid', x: tx * TILE, y: ty * TILE,
        originX: 0, originY: 0, w: TILE, h: TILE,
    }));
    const out = [];
    for (const h of fireHits(player, targets)) {
        const [tx, ty] = blocks[h.id];
        const b = newPushable({
            id: h.id, as3: 'PushableBlockFire', tag: 'pushableblockfire',
            x: tx * TILE, y: ty * TILE,
        });
        const r = hitPushableFromPoint(b, player);
        if (!r.moved) continue;
        out.push({ id: h.id, axes: r.axes, distance: h.distance });
    }
    return out;
}

describe('SHAFT_PLAN', () => {
    it('chains — every step starts a block from where the last one left it', () => {
        expect(assertPlanContinuity()).toEqual(['9,7', '11,9', '7,9']);
    });

    it('is eighteen presses, and exactly ONE of them moves more than one block', () => {
        expect(SHAFT_PLAN.length).toBe(18);
        const multi = SHAFT_PLAN.filter((s) => s.moves.length > 1);
        expect(multi.length).toBe(1);
        expect(multi[0]).toBe(SHAFT_PLAN[SHAFT_PLAN.length - 1]);
        expect(multi[0].moves.length).toBe(3);
    });

    it('goes red on a plan whose steps do not chain', () => {
        const broken = [
            { stance: { tx: 9, ty: 12 }, moves: [{ from: [9, 11], to: [9, 10] }] },
            // (9,9) is not where the previous step left it.
            { stance: { tx: 9, ty: 11 }, moves: [{ from: [9, 9], to: [9, 8] }] },
        ];
        expect(() => assertPlanContinuity(broken)).toThrow(ShaftError);
    });

    it('goes red on a plan that does not fill all three lock-buttons', () => {
        expect(() => assertPlanContinuity(SHAFT_PLAN.slice(0, 17))).toThrow(ShaftError);
    });
});

describe('⛓⛓ the last press — one press, three blocks, three pure axes', () => {
    const last = SHAFT_PLAN[SHAFT_PLAN.length - 1];
    const before = { b1: [9, 8], b2: [10, 9], b3: [8, 9] };

    it('reaches all three from (9,9), and pushes each one on a SINGLE axis', () => {
        const moved = pressFrom(last.stance, before);
        expect(moved.length).toBe(3);
        const byId = Object.fromEntries(moved.map((m) => [m.id, m.axes]));
        expect(byId.b1).toEqual(['N']);
        expect(byId.b2).toEqual(['E']);
        expect(byId.b3).toEqual(['W']);
        // ⛓ No `bothRange` anywhere: a two-axis push is the diagonal band,
        // and the corrected plan does not need one. §19.8's did.
        for (const m of moved) expect(m.axes.length).toBe(1);
    });

    it('and every one of them is inside the 16 px cut with room to spare', () => {
        for (const m of pressFrom(last.stance, before)) {
            expect(m.distance).toBeLessThanOrEqual(8);
        }
    });

    it('matches what the plan declares, as an exact set', () => {
        const moved = pressFrom(last.stance, before);
        const step = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
        const got = moved.map((m) => {
            const [tx, ty] = before[m.id];
            const [dx, dy] = step[m.axes[0]];
            return `${tx + dx},${ty + dy}`;
        }).sort();
        expect(got).toEqual(last.moves.map((m) => m.to.join(',')).sort());
    });
});

describe('⛔ the refutation — §19.8 moved a block it did not know about', () => {
    it('press 17 (stance 9,9) also shoves block 1 off `button t1`', () => {
        // §19.8's layout at its press 17: block 1 parked on (9,8), block 2
        // on (10,9), block 3 already on `cover t2` at (7,9).
        const moved = pressFrom({ tx: 9, ty: 9 }, { b1: [9, 8], b2: [10, 9], b3: [7, 9] });
        expect(moved.map((m) => m.id).sort()).toEqual(['b1', 'b2']);
    });

    it('press 18 (stance 8,9) also shoves block 3 WEST off `cover t2`', () => {
        const moved = pressFrom({ tx: 8, ty: 9 }, { b1: [9, 8], b2: [11, 9], b3: [7, 9] });
        expect(moved.map((m) => m.id).sort()).toEqual(['b1', 'b3']);
        expect(moved.find((m) => m.id === 'b3').axes).toEqual(['W']);
        // ⛔ And block 1's push is the DIAGONAL — both axes set, which is
        // the `bothRange` band §19.8's certificate hung on.
        expect(moved.find((m) => m.id === 'b1').axes.sort()).toEqual(['E', 'N']);
    });

    it('and the record names both, with the block each press did not name', () => {
        expect(SHAFT_REFUTED.collateral.map((c) => c.press)).toEqual([17, 18]);
        expect(SHAFT_REFUTED.endsWith).toBe(2);
        expect(SHAFT_REFUTED.of).toBe(3);
    });
});

describe('⛓ the fire press, driven through a real levelRun in L39', () => {
    /**
     * Boot on a stance and fire once. The fire slot is `1`, and the equip
     * is part of the verb: a press with the SWORD selected is a slash, and
     * a slash on a `PushableBlockFire` is a `moveTypes` miss — silence, in
     * the game and here.
     */
    const runAt = (tx, ty, opts = {}) => createLevelRun({
        levelSource: source,
        boot: { level: LEVEL, x: tx * TILE + TILE / 2 - 8, y: ty * TILE + TILE / 2 - 8 },
        noclip: false,
        noDamage: true,
        grants: [{ level: LEVEL, items: ['sword', 'fire'] }],
        equips: [{ t: 0, slot: 1 }],
        roles: ROLES,
        ...opts,
    });

    it('pushes the block one tile NORTH, and the ledger stays empty', () => {
        // `pushableblockfire@144,176` is on (9,11); the stance below it is
        // (9,12), which is the plan's first step.
        const run = runAt(9, 12);
        run.advance(new Set(['primary']));
        for (let t = 0; t < 40; t += 1) run.advance(new Set());
        const block = run.pushables.get('pushableblockfire@144,176');
        expect(Math.floor(block.rect.x / TILE)).toBe(9);
        expect(Math.floor(block.rect.y / TILE)).toBe(10);
        // A push writes no persistence at all — the flags come from the
        // LOCKS the blocks eventually hold down, not from the pushing.
        expect(run.earnedClears).toEqual([]);
    });

    it('⛔ and the SAME press with the sword selected moves NOTHING', () => {
        // The negative control, one field apart: slot 0 rather than slot 1.
        // `PushableBlockFire.moveTypes` is `["Fire","Pulse"]`, and "Sword"
        // is in neither — which is why `PRESS_ARM_POLICY` has called this
        // arm `inert` since R2 and was right to, for a sword.
        const run = runAt(9, 12, { equips: [{ t: 0, slot: 0 }] });
        run.advance(new Set(['primary']));
        for (let t = 0; t < 40; t += 1) run.advance(new Set());
        const block = run.pushables.get('pushableblockfire@144,176');
        expect(Math.floor(block.rect.y / TILE)).toBe(11);
    });

    it('lands on the window\'s hit ticks, not on the tick after the press', () => {
        const run = runAt(9, 12);
        run.advance(new Set(['primary']));
        // The press is tick 0; `FIRE_WINDOW.firstHitTick` is 4, so nothing
        // has moved three ticks later. A slash would have fired on tick 1.
        for (let t = 0; t < FIRE_WINDOW.firstHitTick - 1; t += 1) run.advance(new Set());
        expect(run.presses.length).toBe(0);
        run.advance(new Set());
        expect(run.presses.length).toBe(1);
        expect(run.presses[0].weapon).toBe('fire');
    });

    it('refuses a second press inside the first one\'s window, naming the cadence', () => {
        const run = runAt(9, 12);
        run.advance(new Set(['primary']));
        expect(() => {
            for (let t = 1; t <= FIRE_WINDOW.endTick; t += 1) {
                run.advance(t === FIRE_WINDOW.endTick ? new Set(['primary']) : new Set());
            }
        }).toThrow(/swallows it silently|firing/);
        expect(FIRE_PRESS_CADENCE).toBe(FIRE_WINDOW.endTick + 1);
    });
});

describe('⛓ the rope arm — the seventh press arm, built', () => {
    it('is 112 px of wall before the pull and 16 px after, and it clears {39,9}', () => {
        const w = world39();
        const rope = w.solids.find((s) => s.tag === 'rope');
        // ⛔ THE PRESS CENSUS COULD NOT SEE IT until slice 7: `entityRect`
        // reads `cls.w`, which a node-terminated class has not got, so the
        // rect came out with a null `right` — and a rect with a null
        // `right` never overlaps anything.
        const responder = w.pressResponders.find((r) => r.as3 === 'RopeStart');
        expect(responder.rect.right).toBe(rope.rect.right);
        expect(rope.rect.right - rope.rect.x).toBe(112);
        expect(rope.shrunkRect.right - rope.shrunkRect.x).toBe(16);
    });

    it('a fire press from the stance pulls it, and the wall SHRINKS', () => {
        const { tx, ty } = ROPE_PULL.stance;
        const run = createLevelRun({
            levelSource: source,
            boot: { level: LEVEL, x: tx * TILE + TILE / 2 - 8, y: ty * TILE + TILE / 2 - 8 },
            noclip: false,
            noDamage: true,
            grants: [{ level: LEVEL, items: ['sword', 'fire'] }],
            equips: [{ t: 0, slot: 1 }],
            roles: ROLES,
            // ⛓ AND THE ROPE'S SHAFT IS WATER. The stance below the pulley
            // is a water tile, so the pull is made SWIMMING — which is why
            // `canSwim` (slice 4's boolean) is on the critical path to the
            // totem cluster and not merely to Dungeon 5, and why the tape
            // needs the sound pin (`Player.as:530`'s swim term reads the
            // mixer's wall clock unpinned).
            pins: ['sound'],
        });
        for (let t = 0; t <= FIRE_WINDOW.lastHitTick + 1; t += 1) {
            run.advance(t === 0 ? new Set(['primary']) : new Set());
        }
        expect(run.ropePulls.length).toBe(1);
        expect(run.ropePulls[0].flag).toMatchObject({ level: LEVEL, tag: 9 });
        expect(run.pulledRopes.has('rope@96,384')).toBe(true);
        // ⛓ THE SHRINK, not a removal: the span's far end opens and the
        // START stays solid. A model that removed the entity would open a
        // tile the game keeps.
        const far = playerBoxAt(180, 392);
        const near = playerBoxAt(104, 392);
        expect(run.world.collidesSolid(far, { pulledRopes: run.pulledRopes })).toBeNull();
        expect(run.world.collidesSolid(near, { pulledRopes: run.pulledRopes })).not.toBeNull();
    });

    it('names the measurement the arm is for', () => {
        expect(ROPE_PULL.cells).toEqual({ before: 56, after: 688 });
        expect(ROPE_PULL.weapon).toBe('fire');
    });
});

describe('⛔⛔ a Lock writes persistence, both ways', () => {
    /** Hold `button t1` at (9,8) and step the machinery `n` ticks. */
    const holdT1 = (n) => {
        const w = world39();
        const st = createActivatorState(w);
        const box = playerBoxAt(9 * TILE + 8, 8 * TILE + 8);
        const events = [];
        for (let t = 0; t < n; t += 1) {
            events.push(...stepActivators(st, w, box, { inventory: INVENTORY, keys: new Set() }));
        }
        return { w, st, events };
    };

    it('emits `lockopen` with the tag on the 101st tick of holding', () => {
        const { events } = holdT1(101);
        const opens = events.filter((e) => e.kind === 'lockopen');
        expect(opens.length).toBe(1);
        expect(opens[0].id).toBe('wandlock@48,160');
        expect(opens[0].persistTag).toBe(7);
    });

    it('...and NOT on the 100th — the fade is a subtraction, not a division', () => {
        expect(holdT1(100).events.filter((e) => e.kind === 'lockopen').length).toBe(0);
    });

    it('emits `lockclose` when the group goes quiet and nothing occupies it', () => {
        const { w, st } = holdT1(101);
        // Step off the button: `returnToNormal()` writes the tag back TRUE.
        const away = playerBoxAt(9 * TILE + 8, 12 * TILE + 8);
        const after = stepActivators(st, w, away, { inventory: INVENTORY, keys: new Set() });
        const closes = after.filter((e) => e.kind === 'lockclose');
        expect(closes.length).toBe(1);
        expect(closes[0].persistTag).toBe(7);
        expect(openActivatorIds(st).has('wandlock@48,160')).toBe(false);
    });

    it('a COVER writes nothing — it has no tag at all', () => {
        // `Cover`'s constructor takes no `_tag`, so neither `turnOff` nor
        // `returnToNormal` exists for it. The events must never name one.
        const w = world39();
        const st = createActivatorState(w);
        const box = playerBoxAt(8 * TILE + 8, 9 * TILE + 8);   // button t0
        const events = [];
        for (let t = 0; t < 20; t += 1) {
            events.push(...stepActivators(st, w, box, { inventory: INVENTORY, keys: new Set() }));
        }
        expect(openActivatorIds(st).has('cover@144,112')).toBe(true);
        expect(events.filter((e) => e.kind === 'lockopen')).toEqual([]);
    });

    /**
     * ⛔⛔ TEN WRITES AND NINE NET CLEARS — R5 slice 11, and the extra one
     * is the flag that refuted the plan.
     *
     * This said NINE and EIGHT for four slices, which was right about the
     * two writers slice 7 knew (`Lock.turnOff`/`returnToNormal` and
     * `RopeStart.hit`) and wrong from the moment slice 10 found the third:
     * the rope's group-6 publication drops `fallrock@144,624`, and
     * `FallRock.fall()`'s FIRST line writes {39,10}.
     *
     * ⚠⚠ AND THE MODEL PREDICTED IT AND NOTHING ASSERTED IT.
     * `runTape.rockFalls` has carried the write since slice 10;
     * `plan-seedling-r5-shaft` summed `lockWrites` + `ropePulls` only, so
     * the ledger claim went on passing while omitting the very flag the
     * game's refutation turned on. **A forward prediction nobody asserts is
     * a note.**
     */
    it('the ledger declares TEN writes and NINE net clears', () => {
        expect(SHAFT_LEDGER.length).toBe(10);
        expect(SHAFT_LEDGER_NET.length).toBe(9);
        // ⛔ {39,7} is the one that is written and TAKEN BACK.
        const taken = SHAFT_LEDGER.find((f) => !f.net);
        expect(taken).toMatchObject({ level: 39, tag: 7 });
        expect(SHAFT_LEDGER_NET.some((f) => f.tag === 7 && f.level === 39)).toBe(false);
        // ⛓ …and {39,10} is in the NET set, written by the rope press.
        const rock = SHAFT_LEDGER.find((f) => f.level === 39 && f.tag === 10);
        expect(rock.net).toBe(true);
        expect(rock.from).toMatch(/fallrock@144,624/);
        // The pair's press-arm ledger is derived from the net set, so the
        // correction reaches the recording's expectation too.
        expect(SHAFT_PAIR.pressLedger).toContain('39:10');
    });
});

describe('⛔ a `room = -1` ButtonRoom writes its own tag AND latches its group', () => {
    it('crossRoomWrites no longer returns nothing for a local button', () => {
        // L38's `buttonroom@144,128 {t 2, tag 0, room -1}`. The own-tag
        // write is `ButtonRoom.as:95`, OUTSIDE the `room` branch.
        const writes = crossRoomWrites({
            tag: 'buttonroom', x: 144, y: 128, t: 2, persistTag: 0, room: -1, flip: false,
        });
        expect(writes).toEqual([{ level: null, tag: 0, value: false, which: 'own' }]);
    });

    it('and it publishes to its group, which is what opens L40', () => {
        // L40's `buttonroom@272,208 {t 0, tag 7, room -1}` — the one whose
        // group holds three WandLocks and a BossLock.
        expect(localPublish({ tag: 'buttonroom', t: 0, room: -1, flip: false }))
            .toEqual({ group: 0, value: true });
        // A cross-room button has no local arm at all.
        expect(localPublish({ tag: 'buttonroom', t: 8, room: 39, flip: true })).toBeNull();
    });

    it('the publish LATCHES — walking off does not close it', () => {
        const w = buildLevelWorld(source(40), { roles: ROLES, inventory: INVENTORY });
        const st = createActivatorState(w);
        const presser = w.pressers.find((p) => p.tag === 'buttonroom' && p.x === 272);
        expect(presser.room).toBe(-1);
        const on = playerBoxAt(presser.rect.x + 2, presser.rect.y + 2);
        const off = playerBoxAt(presser.rect.x + 200, presser.rect.y);
        stepActivators(st, w, on, { inventory: INVENTORY, keys: new Set() });
        // Walk away IMMEDIATELY, then let the fade run to completion. A
        // Button's republication would have closed the group on tick 2.
        for (let t = 0; t < 200; t += 1) {
            stepActivators(st, w, off, { inventory: INVENTORY, keys: new Set() });
        }
        const open = openActivatorIds(st);
        expect(open.has('wandlock@208,128')).toBe(true);
        expect(open.has('wandlock@208,144')).toBe(true);
        expect(open.has('wandlock@208,160')).toBe(true);
    });
});

describe('the price', () => {
    it('is derived from the animation and the glide, never written down', () => {
        const p = pressPrice();
        expect(p.cadence).toBe(FIRE_PRESS_CADENCE);
        expect(p.glide).toBe(SWAP_MARGINS.glideTicks);
        expect(p.coverFade).toBe(11);
        expect(p.lockFade).toBe(101);
        expect(p.pressTicks).toBe(18 * (FIRE_WINDOW.lastHitTick + 32));
    });

    it('and the swap has margin on both sides — nothing is simultaneous by luck', () => {
        expect(SWAP_MARGINS.entersDestinationOnTick).toBeLessThan(
            SWAP_MARGINS.leavesButtonAfterTicks,
        );
    });
});

describe('the totem part', () => {
    it('writes NO persistence, and the game\'s readout cannot see it either', () => {
        expect(TOTEM_PART_2.writesPersistence).toBe(false);
        expect(TOTEM_PART_2.readoutBlindSpot).toMatch(/hasTotemPart/);
        const w = world39();
        const p = w.pickups.find((q) => q.tag === 'totempart');
        expect(p.x).toBe(TOTEM_PART_2.pickup.x);
        expect(p.y).toBe(TOTEM_PART_2.pickup.y);
    });
});
