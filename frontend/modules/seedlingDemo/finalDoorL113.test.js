/**
 * finalDoorL113.test — W-DOOR's INTEGRATION STRATUM: the ending's wall, and
 * the three fenceposts that decide when it stops being one.
 *
 * Region-atlas Phase 8, rung R6, slice 6c. `endingChain.test.js` checks
 * `stepFinalDoor`'s state machine in isolation; this file checks what only
 * the wiring can say:
 *
 *   1. **the ceremony's frames are DEAD, and they are the window's second
 *      witness.** 181 of them, in `frozenFramesOwed`, against a load fade's
 *      ~19 — a much sharper reading than any position;
 *   2. **the body collides for the WHOLE open animation.** The sprite
 *      changes on tick 37 and the wall goes on tick 93, and a `liveRectOf`
 *      arm keyed on "opening" would walk the player into the doorway 56
 *      ticks early — and, in this room, onto a teleporter;
 *   3. **the door reads a flag from ANOTHER LEVEL.** `!Game.
 *      checkPersistence(0, 114)` is the only cross-level persistence read in
 *      the game, and it is the pair's whole discriminator.
 *
 * ⛔⛔ AND ONE FENCEPOST THIS FILE EXISTS TO PIN. `animEnd` fires on graphic
 * update 57, which is 56 ticks after `play("open")` — because `World.update`
 * runs `e.update()` and `e._graphic.update()` in the same pass over the same
 * entity, so the play frame IS update 1. `stepFinalDoor` counted from 0
 * until this slice drove it.
 */

import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES, LIVE_GEOMETRY_KEYS, buildLevelWorld } from './levelWorld.js';
import { FINAL_DOOR, WATCHER_FLAG, finalDoorOpenUpdates } from './endingChain.js';
import { sealControllerTicks } from './sealCeremony.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const source = atlasLevelSource();

/** Tile (7,5)'s corner, so the spawn is (120,88) — column 7 is the only
 *  one that reaches the door from the south. */
const BOOT = { level: 113, x: 112, y: 80 };
const SEAL_PARTS = Array.from({ length: 16 }, (_, i) => i);
const TALKED = [{ level: WATCHER_FLAG.level, tag: WATCHER_FLAG.tag, note: 'the Watcher' }];

const newRun = (over = {}) => createLevelRun({
    levelSource: source,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [],
    persistence: TALKED,
    equips: [],
    pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: SEAL_PARTS },
    roles: ROLES,
    ...over,
});

/** Hold `up` for `n` ticks and keep the y stream. */
function walk(run, n) {
    const held = new Set(['up']);
    const ys = [];
    for (let t = 0; t < n; t += 1) { ys.push(run.state.y); run.advance(held); }
    return ys;
}

describe('the roster and the geometry', () => {
    it('L113 holds exactly one final door, at entity (128,16) with a WHOLE-tile ctor', () => {
        const w = buildLevelWorld(source(113), { roles: ROLES });
        expect(w.finalDoors).toHaveLength(1);
        expect(w.finalDoors[0]).toMatchObject({
            id: 'finaldoor@112,0', ex: 128, ey: 16, persistTag: 0,
        });
        // `super(_x + Tile.w, _y + Tile.h)` — a WHOLE tile, not the half
        // every other class uses — then `setHitbox(32, 32, 16, 16)`.
        expect(w.finalDoors[0].standingRect).toMatchObject({
            x: 112, y: 0, right: 144, bottom: 32,
        });
    });

    it('and it covers BOTH of L113\'s teleporters to L115', () => {
        const w = buildLevelWorld(source(113), { roles: ROLES });
        const box = w.finalDoors[0].standingRect;
        const to115 = w.teleporters.filter((t) => t.to === 115);
        expect(to115).toHaveLength(2);
        for (const t of to115) {
            expect(t.rect.x).toBeGreaterThanOrEqual(box.x);
            expect(t.rect.right).toBeLessThanOrEqual(box.right);
            expect(t.rect.bottom).toBeLessThanOrEqual(box.bottom);
        }
        // ...and the two to L114 are NOT behind it, which is the only
        // reason W-talk-then-W-door is a legal order at all.
        for (const t of w.teleporters.filter((x) => x.to === 114)) {
            expect(t.rect.right).toBeLessThanOrEqual(box.x);
        }
    });

    it('`finalDoors` is a LIVE GEOMETRY KEY, so the hand-written bags must carry it', () => {
        // trap 86's cure, working: the physics bag asserts itself against
        // this list, so a fourteenth family that reached `liveRectOf` and
        // not the sweep is a throw rather than a walked-through wall.
        expect(LIVE_GEOMETRY_KEYS).toContain('finalDoors');
    });
});

describe('the approach: one ceremony, 181 DEAD frames, and one approach only', () => {
    it('fires the SealController on the tick the 32 px CIRCLE is crossed', () => {
        const run = newRun();
        walk(run, 40);
        expect(run.doorCeremonies).toHaveLength(1);
        const c = run.doorCeremonies[0];
        expect(c).toMatchObject({ level: 113, id: 'finaldoor@112,0', dismissable: false });
        // The trigger is a CIRCLE about the entity point, not a box test.
        const at = run.finalDoors[0];
        expect(at.distance).toBeLessThanOrEqual(FINAL_DOOR.seeDistance);
    });

    it('its frames are DEAD and they are the whole dead-frame bill', () => {
        const run = newRun();
        walk(run, 40);
        expect(run.doorCeremonies[0].frames).toBe(sealControllerTicks());
        expect(run.frozenFramesOwed).toBe(sealControllerTicks());
        // 60 fade + 60 wait + 60 more: the third phase is the one nobody
        // expects, because `alpha` is back at its peak for all of it.
        expect(sealControllerTicks()).toBe(181);
    });

    it('⛔ ONE APPROACH — the open is the very next tick, not a later visit', () => {
        const run = newRun();
        walk(run, 60);
        const ceremony = run.doorCeremonies[0];
        const open = run.doorEvents.find((e) => e.what === 'open');
        expect(open.t).toBe(ceremony.t + 1);
    });
});

describe('the open: the body collides for all of it', () => {
    it('⛔⛔ `animEnd` is 56 ticks after the play tick, not 57', () => {
        const run = newRun();
        walk(run, 100);
        const open = run.doorEvents.find((e) => e.what === 'open');
        const removed = run.doorEvents.find((e) => e.what === 'removed');
        expect(removed.t - open.t).toBe(finalDoorOpenUpdates() - 1);
        expect(removed.t - open.t).toBe(56);
    });

    it('and the wall is a wall for every one of those ticks', () => {
        const run = newRun();
        const ys = walk(run, 100);
        const open = run.doorEvents.find((e) => e.what === 'open');
        const removed = run.doorEvents.find((e) => e.what === 'removed');
        // ⛓ The player is still WALKING when the animation starts — the
        // ceremony fires at 32 px and the wall is at 34.5 — so the claim is
        // not "nothing moves"; it is that nothing ever gets PAST the body.
        for (let t = open.t; t <= removed.t; t += 1) {
            expect(playerBoxAt(120, ys[t]).y).toBeGreaterThanOrEqual(32);
        }
        // ...and by the removal they are pinned against it.
        expect(ys[removed.t]).toBe(ys[removed.t - 1]);
        // ⛔⛔⛔ AND THE WALL SURVIVES `animEnd` BY ONE MORE TICK.
        // `FP.world.remove(this)` only QUEUES the entity: `Engine.update` is
        // `FP._world.update(); FP._world.updateLists();`, and the Player
        // sweeps inside the first. So the door is still in the type list for
        // the rest of that frame, and the first free step is TWO ticks after
        // the animation ends. The game refuted the model on exactly this
        // observation, and the step sequence either side was identical —
        // one extra step, and nothing else wrong.
        expect(ys[removed.t + 1]).toBe(ys[removed.t]);
        expect(ys[removed.t + 2]).toBeLessThan(ys[removed.t + 1]);
        expect(run.doorEvents.find((e) => e.what === 'removed').wallOpensAt)
            .toBe(removed.t + 1);
        expect(playerBoxAt(120, ys[removed.t + 6]).y).toBeLessThan(32);
    });

    it('the removal writes `{113,0}` — a CLEAR — into `earnedClears`', () => {
        const run = newRun();
        walk(run, 100);
        expect(run.finalDoorFlags).toEqual([
            { level: 113, tag: 0, value: false, id: 'finaldoor@112,0' },
        ]);
        expect(run.earnedClears).toEqual([
            { level: 113, tag: 0, by: 'finaldoor@112,0' },
        ]);
    });
});

describe('⛔⛔⛔ the cross-level read: the door\'s other condition', () => {
    /**
     * `FinalDoor.update`'s first line is
     * `var talkedToWatcher:Boolean = !Game.checkPersistence(0, 114)` — the
     * only cross-level persistence read in the game, and the door's own
     * comment names the pair. It is the pair's whole discriminator, and the
     * chain between this window and W-talk.
     */
    it('without `{114,0}` the ceremony still fires and the door never opens', () => {
        const run = newRun({ persistence: [] });
        walk(run, 105);
        // Unconditional: same tick, same dead frames.
        expect(run.doorCeremonies).toHaveLength(1);
        expect(run.doorCeremonies[0].frames).toBe(sealControllerTicks());
        // ...and then nothing.
        expect(run.doorEvents).toEqual([]);
        expect(run.earnedClears).toEqual([]);
        expect(run.finalDoors[0]).toMatchObject({ removed: false, seenSeal: true });
    });

    it('without the SIXTEENTH seal the door never opens either — it is the LAST SLOT', () => {
        // `hasAllSealParts()` is `Main.hasSealPart(SEALS - 1) != -1`. Fifteen
        // identities fill slots 0..14 and leave slot 15 at -1, so the count
        // is fifteen and the answer is still "no".
        const run = newRun({
            save: { totem_parts: [], keys: [], seal_parts: SEAL_PARTS.slice(0, 15) },
        });
        walk(run, 105);
        expect(run.doorCeremonies).toHaveLength(1);
        expect(run.doorEvents).toEqual([]);
        expect(run.earnedClears).toEqual([]);
    });

    it('...and a run that TALKED the Watcher out in play opens it with no declaration', () => {
        // The chain W-talk and W-door are two halves of, checked without
        // either tape: a run that boots into L114, exhausts the dialogue and
        // walks to the door needs no `persistence` block at all. Driven here
        // as a MODEL claim (the walk is adaptive, so this is not a tape —
        // §12.9), because the shipped W-door declares the flag instead and
        // that declaration is the one thing a recording cannot check.
        const run = createLevelRun({
            levelSource: source,
            boot: { level: 114, x: 72, y: 88 },
            noclip: false,
            noHazards: [],
            noDamage: false,
            grants: [],
            persistence: [],
            equips: [],
            pins: ['sound', 'dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: SEAL_PARTS },
            roles: ROLES,
        });
        // 40 releases at the plan's cadence exhausts the twenty pages.
        for (let t = 0; t < 260; t += 1) {
            const held = new Set();
            const k = (t - 1) / 5;
            if (Number.isInteger(k) && k >= 0 && k < 40) held.add('primary');
            run.advance(held);
        }
        expect(run.watcherTalks).toHaveLength(1);
        // ⚠ WEST FIRST. L114's two teleporters are adjacent cells and the
        // player's 4 px box straddles both at x 80 — which `stepV2` refuses
        // by name rather than guessing FlashPunk's update order.
        for (let t = 0; t < 60 && run.state.x > 73; t += 1) run.advance(new Set(['left']));
        for (let t = 0; t < 200 && run.level === 114; t += 1) run.advance(new Set(['down']));
        expect(run.level).toBe(113);
        // L113's own routing: rows 0-1 are wall but for the two L114
        // teleporters, so the way to column 7 is south to row 4 and east.
        for (let t = 0; t < 120 && run.state.y < 72; t += 1) run.advance(new Set(['down']));
        for (let t = 0; t < 200 && run.state.x < 120; t += 1) run.advance(new Set(['right']));
        for (let t = 0; t < 400 && !run.finalDoors[0].removed; t += 1) {
            run.advance(new Set(['up']));
        }
        expect(run.finalDoors[0].removed).toBe(true);
        // ⛓⛓⛓ BOTH ROWS OF THE ENDING'S LEDGER, EARNED IN ONE RUN AND
        // DECLARED IN NEITHER: the door's `!checkPersistence(0, 114)` read
        // the flag the dialogue wrote 300 ticks and one world swap earlier.
        expect(run.earnedClears).toEqual([
            { level: 114, tag: 0, by: 'watcher@72,72' },
            { level: 113, tag: 0, by: 'finaldoor@112,0' },
        ]);
    });
});
