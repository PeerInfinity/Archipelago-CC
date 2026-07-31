/**
 * playerPhysicsV2 — unit cases, the INDEPENDENT stratum of slice 2.
 *
 * Every expected value here is derived by hand from the AS3 over a
 * SYNTHETIC level built in this file — a 4x4 grid with one row made solid,
 * or with rows deliberately missing — not from the atlas and not from
 * running this port and writing down what it said. That is what makes them
 * able to detect being wrong rather than merely being changed.
 *
 * Synthetic rather than real levels on purpose: level 0's geometry can only
 * ever say "the two agree here", and the fixture differential in
 * `tapeRunner.test.js` already says that against the REAL GAME for the
 * routes the fixtures walk. What a hand-built grid can say instead is what
 * the code does at the edges no fixture reaches — the strict intersect
 * gate, the sticky fallback, the first-tick type flip — where the oracle
 * has nothing to offer because no recording goes there.
 *
 * The counterpart pins live next door:
 *   `playerPhysicsV1.test.js`  the sweep loop and the `collides` seam
 *   `levelWorld.test.js`       the geometry the resolver reads
 *   `tapeRunner.test.js`       the whole tick against the real game
 */

import { describe, expect, it } from 'vitest';

import { LevelWorldError, buildLevelWorld } from './levelWorld.js';
import { CHECK_OFFSET_Y, HITBOX, MOVE_SPEEDS, WALK_SPEED } from './playerPhysicsV1.js';
import {
    INITIAL_TERRAIN_STATE,
    PhysicsV2Error,
    TransitionNotModelledError,
    playerBoxAt,
    resolveTerrainState,
    resolveTerrainState as getState,
    step,
    terrainProbeRect,
} from './playerPhysicsV2.js';

const held = (...keys) => new Set(keys);

/**
 * Tileset COLUMNS, via `TILE_COLUMN_TO_TYPE`. The extract stores `tx` as a
 * pixel offset into the tileset strip, so a column is `tx / 16`.
 */
const COLUMN = Object.freeze({
    ground: 0,      // -> t 0  Ground        walkable, 0.8
    water: 2,       // -> t 1  Water         walkable, UNMODELLED at v2
    dungeon: 6,     // -> t 5  Dungeon Tile  walkable, 0.8
    cliff: 11,      // -> t 9  Cliff         SOLID
    stairs: 12,     // -> t 10 Cliff Stairs  walkable, 0.4
});

/**
 * A 4x4 (64x64 px) synthetic level. `rows` names the column used for each
 * tile row; a `null` row places NO tiles at all, which is how the intersect
 * gate is made to fail (a full grid covers every position, so the gate
 * never fails inside one).
 */
function world({ rows = ['ground', 'ground', 'ground', 'ground'], entities = [] } = {}) {
    const tiles = [];
    rows.forEach((column, ty) => {
        if (column === null) return;
        for (let tx = 0; tx < 4; tx++) tiles.push([tx, ty, COLUMN[column] * 16, 0]);
    });
    return buildLevelWorld({
        level: 900,
        width: 4,
        height: 4,
        layers: [{ name: 'tiles', set: 'synthetic', tiles }],
        entities,
    });
}

/** Cell centres, so the hand-derivations below read as coordinates. */
const centre = (tx, ty) => ({ x: tx * 16 + 8, y: ty * 16 + 8 });

describe('the player rects', () => {
    it('places the collision box from setHitbox(4, 5, 2, 2)', () => {
        expect(HITBOX).toEqual({ width: 4, height: 5, originX: 2, originY: 2 });
        expect(playerBoxAt(88, 136))
            .toEqual({ x: 86, y: 134, right: 90, bottom: 139 });
    });

    it('offsets the TERRAIN probe rect by checkOffsetY, and nothing else', () => {
        // Player.as:660 — Rectangle(x-originX, y-originY+checkOffsetY, w, h),
        // with checkOffsetY = -originY + height - 2 = 1.
        expect(CHECK_OFFSET_Y).toBe(1);
        expect(terrainProbeRect(88, 136))
            .toEqual({ x: 86, y: 135, right: 90, bottom: 140 });
    });
});

describe('getState(): nearest walkable tile, gated, sticky', () => {
    it('starts at Ground — Player.as:297 `private var _state:int = 0`', () => {
        expect(INITIAL_TERRAIN_STATE).toBe(0);
    });

    it('reads the tile under the player, by CENTRE distance', () => {
        // Row 1 is stairs. Standing at the centre of (2,1) the nearest tile
        // CENTRE is that cell's own, 1px away from the probe point (40, 25).
        const w = world({ rows: ['ground', 'stairs', 'ground', 'ground'] });
        const { x, y } = centre(2, 1);
        expect(resolveTerrainState(w, x, y, 0)).toBe(10);
    });

    it('can never resolve to a SOLID tile type', () => {
        // A solid tile flipped its entity type to "Solid" on its own first
        // update and left the "Tile" list, so it is not a candidate at all.
        // Standing dead centre on a cliff cell, the state stays whatever it
        // was — the nearest WALKABLE tile is a neighbour, and that
        // neighbour's rect does not reach the probe rect.
        const w = world({ rows: ['ground', 'cliff', 'ground', 'ground'] });
        const { x, y } = centre(2, 1);
        expect(resolveTerrainState(w, x, y, 0)).toBe(0);
        expect(resolveTerrainState(w, x, y, 5)).toBe(5);
    });

    it('is STICKY: the previous state persists when the gate fails', () => {
        // Only row 0 has tiles. At the centre of the (missing) row 2 the
        // nearest candidate is row 0, sixteen pixels above the probe rect —
        // no overlap, no assignment. A PURE resolver would have to answer
        // "the nearest tile" here, which is a different and wrong answer.
        const w = world({ rows: ['stairs', null, null, null] });
        const { x, y } = centre(2, 2);
        expect(resolveTerrainState(w, x, y, 0)).toBe(0);
        expect(resolveTerrainState(w, x, y, 10)).toBe(10);
        // ...and the same probe DOES assign while it is still over row 0.
        expect(resolveTerrainState(w, x, 8, 0)).toBe(10);
    });

    it('uses a STRICT intersect — touching edges are not an overlap', () => {
        // Row 0 spans y in [0, 16). The probe rect is
        // [x-2, x+2) x [y-1, y+4), so at y = 17 its top edge is exactly 16:
        // zero overlap area, and `Rectangle.intersects` says false
        // (SWFModernRuntime/src/avm2/avm2_text.c:8029, positive-area only).
        // Half a pixel higher there is real overlap and the state assigns.
        const w = world({ rows: ['stairs', null, null, null] });
        expect(resolveTerrainState(w, 40, 17, 0)).toBe(0);      // touching
        expect(resolveTerrainState(w, 40, 16.5, 0)).toBe(10);   // overlapping
    });

    it('is NOT getStatePos — no gate, and no -1 fallback', () => {
        // Player.as:670-678 is a different function: it returns the nearest
        // tile's type with no intersect test, and -1 when there is none.
        // Conflating them silently deletes the stickiness.
        const w = world({ rows: ['stairs', null, null, null] });
        expect(getState(w, 40, 40, 7)).toBe(7);
        expect(getState(w, 40, 40, 7)).not.toBe(-1);
        expect(getState(w, 40, 40, 7)).not.toBe(10);
    });

    it('keeps the previous state when the level has no walkable tile at all', () => {
        const w = world({ rows: ['cliff', 'cliff', 'cliff', 'cliff'] });
        expect(resolveTerrainState(w, 40, 40, 3)).toBe(3);
    });
});

describe('step(): the terrain state drives the speed, and persists', () => {
    it('picks the stairs speed off a stairs tile', () => {
        const w = world({ rows: ['ground', 'stairs', 'ground', 'ground'] });
        const { x, y } = centre(2, 1);
        const s = step({ x, y, vx: 0, vy: 0, terrain: 0 }, held('right'), { level: w });
        expect(s.terrain).toBe(10);
        expect(s.vx).toBeCloseTo(0.4, 12);
    });

    it('carries the sticky state forward across ticks', () => {
        // Walk right off the end of the tiled row: the gate stops passing,
        // and the LAST tile's state — not Ground, and not the nearest
        // tile's — is what keeps selecting the speed.
        const w = world({ rows: ['stairs', null, null, null] });
        let s = { x: 8, y: 8, vx: 0, vy: 0, terrain: INITIAL_TERRAIN_STATE };
        s = step(s, held('down'), { level: w });
        expect(s.terrain).toBe(10);
        for (let i = 0; i < 20; i++) s = step(s, held('down'), { level: w });
        // Clear of row 0: the probe rect's top edge (y - 1) is past 16.
        expect(s.y).toBeGreaterThan(17);
        // ...and the gate really has stopped passing there, so a resolver
        // without the carried state would answer with the fallback instead.
        expect(resolveTerrainState(w, s.x, s.y, 0)).toBe(0);
        expect(s.terrain).toBe(10);
    });

    it('THROWS by name on terrain v2 does not model', () => {
        const w = world({ rows: ['water', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(LevelWorldError);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(/Water/);
    });

    it('refuses to run without a level rather than quietly being the v1 engine', () => {
        expect(() => step({ x: 8, y: 8, vx: 0, vy: 0 }, held('right'), {}))
            .toThrow(PhysicsV2Error);
    });
});

/**
 * The wall cases, hand-derived end to end. Row 0 of the synthetic level is
 * solid cliff, so the wall's bottom edge is y = 16 and the player's box
 * (origin 2, height 5) is blocked whenever the candidate y satisfies
 * y - 2 < 16, i.e. y < 18.
 */
describe('pressing into a wall', () => {
    const walled = () => world({ rows: ['cliff', 'ground', 'ground', 'ground'] });

    it('pins MID-PIXEL at the last free step, hand-derived tick by tick', () => {
        // From rest at the centre of (2,1), holding UP, with f = 0.25 and
        // moveSpeed = accel = 0.8. Velocity after friction-then-input, and
        // the sweep's per-step d = min(1, |rel| - i) * sign:
        //   t1  v -0.80   24.00 -> 23.20
        //   t2  v -1.35   23.20 -> 22.20 -> 21.85
        //   t3  v -1.10   (-1.10 is not > -0.80, so input adds nothing)
        //                 21.85 -> 20.85 -> 20.75
        //   t4  v -0.85   20.75 -> 19.90
        //   t5  v -1.40   19.90 -> 18.90 -> 18.50
        //   t6  v -1.15   candidate 17.50 is < 18 -> BLOCKED, y stays 18.50
        const w = walled();
        const seen = [];
        let s = { ...centre(2, 1), vx: 0, vy: 0, terrain: 0 };
        for (let i = 0; i < 6; i++) {
            s = step(s, held('up'), { level: w });
            seen.push(s.y);
        }
        [23.2, 21.85, 20.75, 19.9, 18.5, 18.5].forEach((y, i) => {
            expect(seen[i], `tick ${i + 1}`).toBeCloseTo(y, 10);
        });
        // The rest position is mid-pixel: not the wall edge (18), not an
        // integer, but wherever the fractional approach left it.
        expect(seen[5]).toBeCloseTo(18.5, 10);
        expect(s.hitY).not.toBeNull();
    });

    it('does NOT zero velocity — the proof is a DELAYED creep after release', () => {
        // Continuing the derivation above with UP released at t7, velocity
        // decays 0.25 per tick through friction() alone:
        //   t7  v -0.90  candidate 17.60 blocked
        //   t8  v -0.65  candidate 17.85 blocked
        //   t9  v -0.40  candidate 18.10 FITS -> y = 18.10
        // An engine that zeroed v on contact holds 18.50 forever. This is
        // the same signature the real game showed in collide-up-rock
        // (pinned at 130.5 through t43, creeping to 130.05 at t44).
        const w = walled();
        let s = { ...centre(2, 1), vx: 0, vy: 0, terrain: 0 };
        for (let i = 0; i < 6; i++) s = step(s, held('up'), { level: w });
        expect(s.y).toBeCloseTo(18.5, 10);
        expect(Math.abs(s.vy)).toBeGreaterThan(0.5);   // velocity SURVIVED
        s = step(s, held(), { level: w });
        expect(s.y).toBeCloseTo(18.5, 10);
        s = step(s, held(), { level: w });
        expect(s.y).toBeCloseTo(18.5, 10);
        s = step(s, held(), { level: w });
        expect(s.y).toBeCloseTo(18.1, 10);
    });

    it('slides: X keeps moving while Y is pinned', () => {
        // Diagonal into the wall. X is resolved first and is unobstructed,
        // so the run continues sideways with the vertical axis stopped —
        // the two axes are independent because the AS3 sweeps them in
        // sequence, not as a vector.
        const w = walled();
        let s = { ...centre(2, 1), vx: 0, vy: 0, terrain: 0 };
        for (let i = 0; i < 10; i++) s = step(s, held('up', 'right'), { level: w });
        expect(s.y).toBeLessThan(19);
        expect(s.y).toBeGreaterThanOrEqual(18);
        expect(s.x).toBeGreaterThan(centre(2, 1).x + 5);
    });

    it('walks straight through with noclip — the tape flag picks the arm', () => {
        const w = walled();
        let s = { ...centre(2, 1), vx: 0, vy: 0, terrain: 0 };
        for (let i = 0; i < 10; i++) s = step(s, held('up'), { level: w, noclip: true });
        // Past the wall entirely, stopped only by the level clamp at y = 2.
        expect(s.y).toBeLessThan(16);
    });
});

/**
 * The first live tick of a world, when the Tiles have not run their own
 * first `update()` yet and are all still typed "Tile". `World.addUpdate`
 * prepends and `loadlevel` adds the tiles before the Player, so the Player
 * updates FIRST and reads the pre-flip lists. Transcribed, not tidied.
 */
describe('the first-tick type flip', () => {
    it('lets the player through a solid TILE on the world\'s first tick', () => {
        const w = world({ rows: ['cliff', 'ground', 'ground', 'ground'] });
        const at = { x: 40, y: 18, vx: 0, vy: 0, terrain: 0 };
        // Ordinarily blocked: one 0.8px step puts the box top at 15.2 < 16.
        expect(step(at, held('up'), { level: w }).y).toBe(18);
        // On the first tick no tile is typed "Solid", so nothing blocks.
        expect(step(at, held('up'), { level: w, beforeTypeFlip: true }).y)
            .toBeCloseTo(17.2, 12);
    });

    it('still collides with OBJECT solids on the first tick', () => {
        // Only Tiles are late. Every object class assigns its type in its
        // constructor, which is why `collide-up-rock` — whose blocker is a
        // BreakableRock — is unaffected by any of this.
        const w = world({ entities: [{ type: 'rock', x: 32, y: 0 }] });
        const at = { x: 40, y: 18, vx: 0, vy: 0, terrain: 0 };
        expect(step(at, held('up'), { level: w, beforeTypeFlip: true }).y).toBe(18);
    });

    it('can read a SOLID tile\'s terrain type on the first tick', () => {
        // The same fact from the terrain side: on tick 1 the "Tile" list
        // still holds every tile, so the nearest candidate over a cliff cell
        // is that cliff. It is unobservable in practice — every solid type
        // carries the plain 0.8 walk speed — which is exactly why it has to
        // be asserted here rather than left to a fixture.
        const w = world({ rows: ['cliff', 'ground', 'ground', 'ground'] });
        expect(resolveTerrainState(w, 40, 10, 0)).toBe(0);
        expect(resolveTerrainState(w, 40, 10, 0, { beforeTypeFlip: true })).toBe(9);
        expect(MOVE_SPEEDS[9]).toBe(WALK_SPEED);
    });
});

describe('the seams that must stay loud', () => {
    it('THROWS on a pixelmask collider rather than approximating it', () => {
        // Positive control for the seam: rect-approximating a Building is
        // the thing ruling 3 forbids, and Phase 5a proved the sprite rect
        // swallows the building's own doorway.
        const w = world({ entities: [{ type: 'building', x: 0, y: 0 }] });
        expect(() => step({ x: 40, y: 40, vx: 0, vy: -3, terrain: 0 }, held('up'),
            { level: w })).toThrow(/unmodeled pixelmask/);
    });

    it('THROWS by name when the player stands on a live teleporter', () => {
        // Slice 3's seat. Room transitions land whole — the world swap, the
        // arrival offset, the anti-ping-pong latch and the `transitions`
        // records — or not at all.
        const w = world({
            entities: [{
                type: 'teleporter',
                x: 32,
                y: 16,
                attrs: { to: 94, playerx: 288, playery: 160, tag: -1 },
            }],
        });
        const { x, y } = centre(2, 1);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(TransitionNotModelledError);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(/slice 3/);
    });

    it('does not fire the transition seam for a teleporter the player is clear of', () => {
        // The negative control: without it, "throws on a teleporter" would
        // be satisfied by throwing on every level that has one.
        const w = world({
            entities: [{
                type: 'teleporter',
                x: 0,
                y: 0,
                attrs: { to: 94, playerx: 288, playery: 160, tag: -1 },
            }],
        });
        const { x, y } = centre(3, 3);
        expect(step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }).terrain)
            .toBe(0);
    });
});
