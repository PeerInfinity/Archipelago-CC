/**
 * pushables — the hand-derived stratum for the block a press moves.
 *
 * Every number here comes from `Puzzlements/PushableBlockFire.as`,
 * `Mobile.as` and `Player.as:1100-1103`, not from running this port. The
 * three facts the R4 route rests on are the direction of the push (which
 * the game confirmed at reach 1 and reach 2 before this file existed), the
 * THIRTY-TWO TICKS the block spends being neither in one cell nor the
 * other, and the fact that it is solid for every one of them.
 */

import { describe, expect, it } from 'vitest';

import {
    ALPHA_FADE,
    BOTH_RANGE,
    DESTROYING_TILE_TYPES,
    PUSHABLE_FRICTION,
    PUSHABLE_SPEED,
    PUSH_STEP,
    PushableError,
    TICKS_PER_TILE,
    TILE,
    createPushableState,
    frictionStep,
    getPos,
    gridPos,
    hitPushable,
    hitPushableFromPoint,
    movedPushables,
    newPushable,
    pushVector,
    pushableRect,
    pushableRects,
    pushableTile,
    pushablesSettled,
    stepPushable,
    stepPushables,
    stepWalkPushable,
    walkPushContact,
} from './pushables.js';

const RIGHT = 0;
const UP = 1;
const LEFT = 2;
const DOWN = 3;

/** A ctx whose world is empty: nothing blocks, nothing sinks. */
const OPEN = { collides: () => null, tileTypeAt: () => 0 };

const block = (x = 176, y = 128) => newPushable({
    id: 'pushableblockspear@176,128', as3: 'PushableBlockSpear', tag: 'pushableblockspear', x, y,
});

/** Run `n` ticks and hand back the block. */
function run(b, n, ctx = OPEN) {
    let cur = b;
    for (let i = 0; i < n; i++) cur = stepPushable(cur, ctx);
    return cur;
}

describe('the push direction (Player.as:1103 -> PushableBlockFire.hit)', () => {
    it('PUSH_STEP is exactly -p, recomputed from the AS3 expression', () => {
        // The table is the useful form and the expression is the citation;
        // asserting one against the other is what stops the table drifting
        // into "the direction we remember it being".
        for (const d of [RIGHT, UP, LEFT, DOWN]) {
            const p = pushVector(d);
            // `+ 0` normalises the negative zero `-p` produces on the axis
            // the facing does not move; `Object.is(-0, 0)` is false.
            expect(PUSH_STEP[d].dx).toBe(-p.x + 0);
            expect(PUSH_STEP[d].dy).toBe(-p.y + 0);
        }
        expect(pushVector(RIGHT)).toEqual({ x: -1, y: 0 });
        expect(pushVector(UP)).toEqual({ x: 0, y: 1 });
        expect(pushVector(LEFT)).toEqual({ x: 1, y: 0 });
        expect(pushVector(DOWN)).toEqual({ x: 0, y: -1 });
    });

    it('the block moves the way the player FACES, i.e. away from them', () => {
        expect(PUSH_STEP[RIGHT].name).toBe('E');
        expect(PUSH_STEP[UP].name).toBe('N');
        expect(PUSH_STEP[LEFT].name).toBe('W');
        expect(PUSH_STEP[DOWN].name).toBe('S');
    });

    it('a hit moves the TARGET one tile and leaves the block where it is', () => {
        const b = block();
        expect(b.target).toEqual({ x: 184, y: 136 });
        const { block: hit, moved } = hitPushable(b, LEFT);
        expect(moved).toBe(true);
        // The block itself has not moved a pixel yet — `hit` writes `tile`.
        expect(hit.x).toBe(176);
        expect(hit.y).toBe(128);
        expect(hit.target).toEqual({ x: 168, y: 136 });
    });

    it('⚠ a hit while the block is MOVING is refused (`if (v.length > 0) return`)', () => {
        // This is what makes one press one tile even though `spear()` can
        // re-fire every other tick while `spearing` holds.
        let b = hitPushable(block(), LEFT).block;
        b = stepPushable(b, OPEN);
        expect(b.vx).toBe(-PUSHABLE_SPEED);
        const second = hitPushable(b, DOWN);
        expect(second.moved).toBe(false);
        expect(second.block.target).toEqual({ x: 168, y: 136 });
    });

    it('refuses a facing that is not 0..3', () => {
        expect(() => hitPushable(block(), 4)).toThrow(PushableError);
        expect(() => hitPushable(block(), -1)).toThrow(PushableError);
    });
});

describe('the glide (PushableBlockFire.update)', () => {
    it('crosses one tile in exactly 32 ticks at half a pixel each', () => {
        expect(PUSHABLE_SPEED).toBe(0.5);
        expect(TICKS_PER_TILE).toBe(32);
        let b = hitPushable(block(), LEFT).block;
        for (let n = 1; n <= 32; n++) {
            b = stepPushable(b, OPEN);
            expect(b.x).toBeCloseTo(176 - n * 0.5, 10);
            // Still one tile's worth of travel to go on tick 32 itself —
            // the LAST move is the one that lands it.
            expect(b.vx).toBe(n === 32 ? -0.5 : -0.5);
        }
        expect(b.x).toBe(160);
        // ...and the tick after arrival, `FP.sign(0)` stops it dead.
        b = stepPushable(b, OPEN);
        expect(b.x).toBe(160);
        expect(b.vx).toBe(0);
        expect(b.vy).toBe(0);
        expect(pushableTile(b)).toEqual({ tx: 10, ty: 8 });
    });

    it('is SOLID at a straddling rect for every tick in between', () => {
        let b = hitPushable(block(), LEFT).block;
        b = run(b, 10);
        expect(b.x).toBe(171);
        // 171..187 — inside neither cell 10 (160..176) nor cell 11
        // (176..192). A model that snapped the block would have opened
        // cell 11 ten ticks ago and closed cell 10 twenty-two ticks early.
        expect(pushableRect(b)).toEqual({ x: 171, y: 128, w: 16, h: 16, right: 187, bottom: 144 });
    });

    it('does not move at all until something hits it', () => {
        // The constructor targets the block's OWN centre, so `FP.sign` is
        // zero on both axes forever. This is why adding the live-rect
        // plumbing moves no frozen fixture.
        const b = run(block(), 200);
        expect(b.x).toBe(176);
        expect(b.y).toBe(128);
        expect(b.destroy).toBe(false);
    });

    it('moves on the OTHER axis the same way (a north push)', () => {
        let b = hitPushable(block(), UP).block;
        expect(b.target).toEqual({ x: 184, y: 120 });
        b = run(b, 32);
        expect(b.y).toBe(112);
        expect(b.x).toBe(176);
    });
});

describe('what stops a push', () => {
    it('a push into an occupied cell fails on its FIRST tick, going nowhere', () => {
        // The block cannot advance half a pixel into a solid, so a wall in
        // the destination is not a shortened push — it is no push at all,
        // and `tile.x = getPos(x, y).x` puts the target back on the block's
        // own centre so it does not keep trying.
        const walled = {
            collides: (rect) => (rect.x < 176 ? { tag: 'wall' } : null),
            tileTypeAt: () => 0,
        };
        let b = hitPushable(block(), LEFT).block;
        b = stepPushable(b, walled);
        expect(b.x).toBe(176);
        expect(b.target.x).toBe(184);
        b = run(b, 20, walled);
        expect(b.x).toBe(176);
        expect(b.vx).toBe(0);
    });

    it('⚠ an EAST push blocked mid-glide RETREATS, and a WEST one WEDGES', () => {
        // The asymmetry is `gridPos`'s floor, which reads the block's
        // TOP-LEFT corner. Half a pixel east and the corner is still in the
        // origin cell, so `getPos` names it and the block walks back; half a
        // pixel west and the corner is already in the DESTINATION cell, so
        // `getPos` names the cell it was heading for and the block simply
        // keeps pushing against whatever stopped it — straddling two cells,
        // for as long as the obstruction lasts.
        //
        // Only a MOVING solid can produce this at all (a static one blocks
        // the push at tick 1, above), which at R4 means the player walking
        // into the destination. It is transcribed because a wedge leaves the
        // block occupying two cells at once, and a route that assumed a
        // block is always in exactly one is a route that walks into it.
        const arrives = (edge) => ({
            collides: (rect) => (rect.right > edge ? { tag: 'player' } : null),
            tileTypeAt: () => 0,
        });
        let east = hitPushable(block(), RIGHT).block;
        east = run(east, 10);
        expect(east.x).toBe(181);
        // Two more half-pixels fit under the obstruction; the third sweep is
        // the one that finds it and rewrites the target.
        east = run(east, 3, arrives(198));
        expect(east.x).toBe(182);
        expect(east.target.x).toBe(184);
        east = run(east, 20, arrives(198));
        expect(east.x).toBe(176);
        expect(east.vx).toBe(0);

        const wall = { collides: (rect) => (rect.x < 170.5 ? { tag: 'player' } : null), tileTypeAt: () => 0 };
        let west = hitPushable(block(), LEFT).block;
        west = run(west, 11);
        expect(west.x).toBe(170.5);
        west = run(west, 30, wall);
        expect(west.x).toBe(170.5);
        expect(west.target.x).toBe(168);
        expect(west.vx).toBe(-0.5);
    });

    it('the grid SNAP is transcribed, and it never has anything to do', () => {
        // `if (!collideTypes(solids, gridPos(x,y).x, gridPos(x,y).y)) { if
        // (|v.x| <= 0.01) x = int(gridPos(x,y).x) }`. Every reachable state
        // where `v` is zero is a state where the block is ALREADY on its
        // cell corner (targets are cell centres and steps are half pixels),
        // so the assignment is its own no-op. Pinned with a CONSTRUCTED
        // state the game cannot produce, which makes this a transcription
        // check rather than a claim about a behaviour.
        const constructed = { ...block(178.5, 128), target: { x: 186.5, y: 136 } };
        expect(stepPushable(constructed, OPEN).x).toBe(176);
        // ...and the gate: an occupied own-cell leaves it where it is.
        const occupied = { collides: () => ({ tag: 'player' }), tileTypeAt: () => 0 };
        expect(stepPushable(constructed, occupied).x).toBe(178.5);
    });
});

describe('sinking (PushableBlockFire.input + Mobile.death)', () => {
    it('the three destroying types are water, lava and pit', () => {
        expect(DESTROYING_TILE_TYPES).toEqual({ 1: 'water', 17: 'lava', 6: 'pit' });
    });

    it('⚠ does NOT sink mid-glide — the check needs exact grid alignment', () => {
        // Every intermediate x is a multiple of 0.5 and never of 16, so a
        // block crossing a pit is not destroyed on the way over. It sinks
        // on the tick AFTER it lands.
        // The pit is the DESTINATION cell only (centre x 168); the block's
        // own cell (centre 184) is dry, or it would sink before it moved.
        const pit = { collides: () => null, tileTypeAt: (x) => (x < 176 ? 6 : 0) };
        let b = hitPushable(block(), LEFT).block;
        b = run(b, 31, pit);
        expect(b.x).toBe(160.5);
        expect(b.destroy).toBe(false);
        b = stepPushable(b, pit);
        expect(b.x).toBe(160);
        // The landing tick's own `input()` ran BEFORE the move, when the
        // block was still at 160.5 — so even the landing tick does not sink.
        expect(b.destroy).toBe(false);
        b = stepPushable(b, pit);
        expect(b.destroy).toBe(true);
    });

    it('fades over ELEVEN frames and is removed on the twelfth', () => {
        expect(ALPHA_FADE).toBe(0.1);
        const pit = { collides: () => null, tileTypeAt: () => 6 };
        let b = { ...block(160, 128), destroy: true };
        // `alpha -= 0.1` in IEEE754 undershoots: the tenth subtraction
        // leaves ~2.8e-17, which is still > 0, so it takes eleven.
        for (let n = 1; n <= 10; n++) {
            b = stepPushable(b, pit);
            expect(b.removePending).toBe(false);
            expect(b.removed).toBe(false);
        }
        b = stepPushable(b, pit);
        expect(b.alpha).toBeLessThanOrEqual(0);
        expect(b.removePending).toBe(true);
        // ⚠ STILL SOLID. `type` is never touched; only `FP.world.remove`
        // takes it out of the collision lists, and `World.updateLists`
        // processes that at the top of the NEXT frame.
        expect(b.removed).toBe(false);
        b = stepPushable(b, pit);
        expect(b.removed).toBe(true);
    });

    it('a ctx with no tileTypeAt REFUSES rather than answering "it does not sink"', () => {
        expect(() => stepPushable(block(), { collides: () => null }))
            .toThrow(PushableError);
        // ...unless the caller says so, which is a claim it has to make.
        expect(stepPushable(block(), { collides: () => null, noSink: true }).destroy)
            .toBe(false);
    });
});

describe('the pieces the game computes and throws away', () => {
    it('friction is transcribed and INERT — input() reassigns both axes', () => {
        expect(PUSHABLE_FRICTION).toBe(0.25);
        expect(frictionStep(0.5, 0)).toEqual({ vx: 0.25, vy: 0 });
        // The 0.05 deadzone, which never gets to matter either.
        expect(frictionStep(0.2, 0)).toEqual({ vx: 0, vy: 0 });
        expect(frictionStep(0, 0)).toEqual({ vx: 0, vy: 0 });
        // The inertness itself: a block mid-glide has v = ±0.5 EXACTLY on
        // every tick, never the 0.25 friction would have left.
        let b = hitPushable(block(), LEFT).block;
        for (let i = 0; i < 20; i++) {
            b = stepPushable(b, OPEN);
            expect(b.vx).toBe(-0.5);
        }
    });

    it('gridPos and getPos transcribe the int coercion', () => {
        expect(gridPos(178.5, 128)).toEqual({ x: 176, y: 128 });
        expect(getPos(178.5, 128)).toEqual({ x: 184, y: 136 });
        expect(getPos(160, 128)).toEqual({ x: 168, y: 136 });
    });
});

describe('the per-visit run state', () => {
    const world = {
        level: 65,
        pushables: [
            { id: 'pushableblockspear@176,128', tag: 'pushableblockspear', as3: 'PushableBlockSpear', family: 'fire', x: 176, y: 128 },
            { id: 'pushableblock@32,32', tag: 'pushableblock', as3: 'PushableBlock', family: 'walk', x: 32, y: 32 },
        ],
    };

    it('carries both families, each with the `input()` it runs', () => {
        const state = createPushableState(world);
        expect([...state.byId.keys()])
            .toEqual(['pushableblockspear@176,128', 'pushableblock@32,32']);
        expect(state.byId.get('pushableblockspear@176,128').family).toBe('fire');
        // ⚠ The walk family's target is in TILE INDICES, the fire family's
        // in pixel centres — same field name, two units.
        expect(state.byId.get('pushableblock@32,32').target).toEqual({ x: 2, y: 2 });
        expect(state.walkPushed).toEqual(['pushableblock@32,32']);
    });

    it('reports live rects for the collision query, and what has moved', () => {
        const state = createPushableState(world);
        expect(movedPushables(state)).toEqual([]);
        expect(pushablesSettled(state)).toBe(true);
        const id = 'pushableblockspear@176,128';
        state.byId.set(id, hitPushable(state.byId.get(id), LEFT).block);
        stepPushables(state, OPEN);
        expect(pushablesSettled(state)).toBe(false);
        expect(pushableRects(state).get(id).rect.x).toBe(175.5);
        for (let i = 0; i < 40; i++) stepPushables(state, OPEN);
        expect(movedPushables(state)).toEqual([
            { id, x: 160, y: 128, tx: 10, ty: 8, removed: false },
        ]);
        expect(pushablesSettled(state)).toBe(true);
    });

    it('a world with no pushables makes an empty state rather than failing', () => {
        const state = createPushableState({ level: 3 });
        expect(state.byId.size).toBe(0);
        expect(pushableRects(state).size).toBe(0);
    });
});

describe('the OTHER pushable: PushableBlock, which a WALK moves', () => {
    const walkBlock = (x = 96, y = 64) => newPushable({
        id: 'pushableblock@96,64', tag: 'pushableblock', as3: 'PushableBlock',
        family: 'walk', x, y,
    });
    const started = () => {
        const b = walkBlock();
        b.target = { x: 6, y: 4 };
        return b;
    };
    const ctx = (playerBox, vx = 0, vy = 0) => ({
        collides: () => null, tileTypeAt: () => 8, playerBox, playerVx: vx, playerVy: vy,
    });
    const box = (x, y) => ({ x, y, right: x + 4, bottom: y + 5 });

    it('⚠ ONE contact tick sends it a full tile WEST — the r3-walk-full graze', () => {
        // The committed R3 walk really does this: at tick 3489 the player is
        // at (114.96, 77.62) with v.x = -0.126, which overlaps the `x + 1`
        // probe by 0.04 px. The block leaves and no recording can see it.
        let b = started();
        b = stepWalkPushable(b, ctx(box(112.96, 75.62), -0.126, 1.332));
        expect(b.target.x).toBe(5);
        expect(b.vx).toBe(-0.5);
        // ...and it finishes the tile with nobody touching it any more.
        for (let i = 0; i < 40; i++) b = stepWalkPushable(b, ctx(null));
        expect(b.x).toBe(80);
        expect(b.vx).toBe(0);
    });

    it('⚠ ...but an EAST push SNAPS BACK unless the player keeps leaning', () => {
        // `cTile` is a CEIL. Half a pixel east and the block already reports
        // the next cell index, so `tile - cTile` is zero, `v.x == 0`, and the
        // snap arm puts it back on its own corner. Only a player still
        // leaning re-targets it, one tick at a time.
        let b = started();
        b = stepWalkPushable(b, ctx(box(92, 66), 0.8, 0));
        expect(b.target.x).toBe(7);
        expect(b.x).toBe(96.5);
        // Let go now and it snaps straight back to 96 — a whole tile's
        // worth of intent undone by half a pixel of travel.
        expect(stepWalkPushable(b, ctx(null)).x).toBe(96);
        // A player who FOLLOWS it re-targets on every tick, so the block
        // travels as far as the walk does rather than one tile.
        for (let i = 0; i < 40; i++) {
            b = stepWalkPushable(b, ctx(box(b.x - 4, 66), 0.8, 0));
        }
        expect(b.x).toBe(116.5);
    });

    it('sinks on water/lava/pit like the other family', () => {
        let b = walkBlock();
        b.target = { x: 6, y: 4 };
        b = stepWalkPushable(b, {
            collides: () => null, tileTypeAt: () => 6, playerBox: null,
        });
        expect(b.destroy).toBe(true);
    });
});

describe('the walk-push contact test (PushableBlock.input)', () => {
    const walk = [{ id: 'pushableblock@32,32', tag: 'pushableblock', x: 32, y: 32 }];
    // The player hitbox is 8x8 at R2's transcription; the guard only needs
    // a box, so these are boxes.
    const box = (x, y) => ({ x, y, right: x + 8, bottom: y + 8 });

    it('flags a lean against an edge with the velocity pointing INTO it', () => {
        // Against the west face, moving east: `collide("Player", x-1, y)`
        // with `c.v.x > 0`.
        expect(walkPushContact(walk, box(25, 34), 0.8, 0)).toHaveLength(1);
        expect(walkPushContact(walk, box(25, 34), 0.8, 0)[0].dir).toBe('E');
        // Against the north face, moving south.
        expect(walkPushContact(walk, box(34, 25), 0, 0.8)[0].dir).toBe('S');
    });

    it('does not flag touching it while moving AWAY, or standing clear', () => {
        expect(walkPushContact(walk, box(25, 34), -0.8, 0)).toEqual([]);
        expect(walkPushContact(walk, box(25, 34), 0, 0)).toEqual([]);
        expect(walkPushContact(walk, box(0, 0), 0.8, 0)).toEqual([]);
    });
});

/**
 * ── R5 SLICE 6: THE ABSOLUTE ARM ──────────────────────────────────────
 *
 * The arm a FIRE attack takes, and the one `moveTypes` actually guards.
 * Every number below is read out of `PushableBlockFire.as:76-125`; the
 * angles are recomputed from `Math.atan2` rather than tabulated, because a
 * table of eight compass points would agree with a model that had the sign
 * inverted on both axes at once.
 */
describe('R5 slice 6 — hitPushableFromPoint (the absolute/`moveTypes` arm)', () => {
    const fireBlock = (x = 144, y = 176) => newPushable({
        id: `pushableblockfire@${x},${y}`, as3: 'PushableBlockFire',
        tag: 'pushableblockfire', x, y,
    });
    const spearBlock = () => newPushable({
        id: 'pushableblockspear@176,128', as3: 'PushableBlockSpear',
        tag: 'pushableblockspear', x: 176, y: 128,
    });

    it('the sword FAILS moveTypes on a plain PushableBlockFire — the L39 seal', () => {
        const b = fireBlock();
        const r = hitPushableFromPoint(b, { x: 160, y: 184 }, 'Sword');
        expect(r.moved).toBe(false);
        expect(r.why).toContain('moveTypes');
        expect(r.block.target).toEqual(b.target);
    });

    it('"Fire" and "Pulse" both pass, and nothing else the player carries does', () => {
        const b = fireBlock();
        for (const t of ['Fire', 'Pulse']) {
            expect(hitPushableFromPoint(b, { x: 160, y: 184 }, t).moved).toBe(true);
        }
        // `Player.as:921` / `:926` — the two strings a slash can dispatch.
        for (const t of ['Sword', 'Spear', 'Shield', 'Suit', '']) {
            expect(hitPushableFromPoint(b, { x: 160, y: 184 }, t).moved).toBe(false);
        }
    });

    it('⚠ the family/class split: a SPEAR block is family "fire" and moveTypes ["Spear"]', () => {
        const b = spearBlock();
        // The state's own family — `levelWorld.PUSHABLE_FAMILIES` — says
        // "fire", because that is the `input()` it inherits.
        expect(b.family).toBe('fire');
        // And the absolute arm still refuses "Fire", because the lookup is
        // on the CLASS. This is the assertion that a family-keyed lookup
        // would fail, and it would fail in the direction that unseals L39.
        expect(hitPushableFromPoint(b, { x: 192, y: 136 }, 'Fire').moved).toBe(false);
        expect(hitPushableFromPoint(b, { x: 192, y: 136 }, 'Spear').moved).toBe(true);
    });

    it('a walk-pushed PushableBlock has no `hit()` at all, and that is a THROW', () => {
        const b = newPushable({
            id: 'pushableblock@0,0', as3: 'PushableBlock', tag: 'pushableblock',
            x: 0, y: 0, family: 'walk',
        });
        expect(() => hitPushableFromPoint(b, { x: 8, y: 8 })).toThrow(PushableError);
    });

    it('the push is AWAY from the player, on all four cardinals', () => {
        const b = fireBlock(144, 176);      // centre (152, 184)
        const cases = [
            { p: { x: 200, y: 184 }, dx: -1, dy: 0, axes: ['W'] },  // player EAST
            { p: { x: 100, y: 184 }, dx: 1, dy: 0, axes: ['E'] },   // player WEST
            { p: { x: 152, y: 240 }, dx: 0, dy: -1, axes: ['N'] },  // player SOUTH
            { p: { x: 152, y: 120 }, dx: 0, dy: 1, axes: ['S'] },   // player NORTH
        ];
        for (const c of cases) {
            const r = hitPushableFromPoint(b, c.p);
            expect(r.moved).toBe(true);
            expect(r.axes).toEqual(c.axes);
            expect(r.both).toBe(false);
            expect(r.block.target).toEqual({
                x: 152 + c.dx * TILE, y: 184 + c.dy * TILE,
            });
        }
    });

    it('⚠ the bothRange band moves BOTH axes — a near-diagonal is a diagonal', () => {
        const b = fireBlock(144, 176);      // centre (152, 184)
        // Exactly 45 degrees: |sin| == |cos|, so both guards hold.
        const r = hitPushableFromPoint(b, { x: 192, y: 224 });
        expect(r.both).toBe(true);
        expect(r.axes.sort()).toEqual(['N', 'W']);
        expect(r.block.target).toEqual({ x: 152 - TILE, y: 184 - TILE });
    });

    it('the band has a WIDTH, and it is BOTH_RANGE — the edges are found, not assumed', () => {
        const b = fireBlock(144, 176);
        // Sweep the angle and record where `both` is true. The band's edges
        // are `abs(|sin| - |cos|) < BOTH_RANGE`, which in angle terms is not
        // symmetric in degrees — so the check is on the TRIG, not on a
        // degree window a reader would have to trust.
        let bandCount = 0;
        for (let deg = 0; deg < 360; deg += 0.05) {
            const a = (deg * Math.PI) / 180;
            const p = { x: 152 + 40 * Math.cos(a), y: 184 + 40 * Math.sin(a) };
            const r = hitPushableFromPoint(b, p);
            const s = Math.abs(Math.sin(a));
            const c = Math.abs(Math.cos(a));
            expect(r.both).toBe(s - BOTH_RANGE < c && s > c - BOTH_RANGE);
            if (r.both) bandCount += 1;
        }
        // Four bands, one per diagonal, and they are a real fraction of the
        // circle rather than a knife edge — which is why a stance chosen by
        // eye is a trap.
        expect(bandCount).toBeGreaterThan(0);
    });

    it('a moving block IGNORES the hit — one impulse per rest', () => {
        let b = fireBlock(144, 176);
        b = hitPushableFromPoint(b, { x: 200, y: 184 }).block;
        b = stepPushable(b, OPEN);                    // now v.x = -0.5
        expect(b.vx).not.toBe(0);
        const again = hitPushableFromPoint(b, { x: 100, y: 184 });
        expect(again.moved).toBe(false);
        expect(again.why).toContain('v.length > 0');
        expect(again.block.target).toEqual(b.target);
    });

    it('a removed block refuses, and a malformed point THROWS rather than atan2(NaN)', () => {
        const b = { ...fireBlock(), removed: true };
        expect(hitPushableFromPoint(b, { x: 0, y: 0 }).moved).toBe(false);
        expect(() => hitPushableFromPoint(fireBlock(), null)).toThrow(PushableError);
        expect(() => hitPushableFromPoint(fireBlock(), { x: 1 })).toThrow(PushableError);
    });

    it('the pushed block glides the SAME 32 ticks the relative arm does', () => {
        // The two arms differ only in where they put the target; the glide
        // below them is one `input()`. Asserted so a later change to the
        // absolute arm cannot quietly acquire its own stepper.
        let b = fireBlock(144, 176);
        b = hitPushableFromPoint(b, { x: 200, y: 184 }).block;
        const arrived = run(b, TICKS_PER_TILE, OPEN);
        expect(arrived.x).toBe(144 - TILE);
        // ⚠ AND IT IS STILL CARRYING VELOCITY ON THE ARRIVAL TICK. `input()`
        // assigns `v` from `sign(target - centre)` BEFORE `moveX` runs, so
        // the tick that lands the block still holds the -0.5 that got it
        // there; `v` only reaches 0 on the NEXT tick's `input()`. That one
        // tick is exactly the window in which a second fire hit is still
        // refused by `v.length > 0`.
        expect(arrived.vx).toBe(-PUSHABLE_SPEED);
        expect(hitPushableFromPoint(arrived, { x: 100, y: 184 }).moved).toBe(false);
        const settled = run(arrived, 1, OPEN);
        expect(settled.vx).toBe(0);
        expect(hitPushableFromPoint(settled, { x: 100, y: 184 }).moved).toBe(true);
    });
});
