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

import { LevelWorldError, RELAXED_ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

/** Real level records, for the R1 transport block at the bottom. */
const levelRecord = atlasLevelSource();
import { CHECK_OFFSET_Y, HITBOX, MOVE_SPEEDS, WALK_SPEED } from './playerPhysicsV1.js';
import {
    BOUNCE_VELOCITY,
    DESCENT_DROP,
    DESCENT_GRAVITY,
    DESCENT_MAX_FALL,
    FALL_ALPHA_SPEED,
    FALL_ALPHA_START,
    DROWN_TIMER_MAX,
    INITIAL_HAZARD_FLAGS,
    INITIAL_TERRAIN_STATE,
    NO_BOUNCE_STATES,
    PhysicsV2Error,
    SLIDING_FRICTION,
    SLIDING_SPEED,
    WATERFALL_ACCELERATION,
    checkDrowning,
    drownStep,
    hazardFlagsFor,
    speedFrictionFor,
    arriveFromFall,
    arriveIn,
    fallDestination,
    getStatePos,
    initialLatch,
    playerBoxAt,
    resolveTerrainState,
    resolveTerrainState as getState,
    step,
    terrainProbeRect,
    updateTeleporters,
    DIRECTION_DOWN,
    DIRECTION_LEFT,
    DIRECTION_RIGHT,
    DIRECTION_UP,
    INITIAL_DIRECTION,
    directionAfterFall,
    nextDirection,
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
    // ⚠ R4's three, and the trap the kickoff names: a tileset COLUMN is
    // NOT a tile type. Column 19 is LAVA (t 17), column 24 is ICE (t 22)
    // and columns 27-32 are all WATERFALL (t 25) — a sweep that used
    // `tx / 16` as the type would report lava as ice and miss every
    // waterfall. These go through `TILE_COLUMN_TO_TYPE` like the rest,
    // and the first draft of this very table wrote 20 for lava and got
    // t 18 — the trap biting inside the file that documents it.
    lava: 19,       // -> t 17 Lava          walkable, 0.45 + water friction
    ice: 24,        // -> t 22 Ice           walkable, speed AND friction replaced
    waterfall: 27,  // -> t 25 Waterfall     walkable, 0.225 + the push
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

    it('⛓ R5 slice 4: WATER no longer throws for being unmodelled — it throws '
        + 'for being UNPINNED', () => {
        // The old claim was `LevelWorldError` out of `assertModelledTerrain`.
        // Water joined `MODELLED_TILE_TYPES` when the swim sound term became
        // reproducible under `pins: ["sound"]`, so that guard no longer
        // fires — and the guard that replaced it is sharper, because it
        // names the actual problem. `Player.as:530` adds
        // `0.25 * int(Music.soundPosition("Swim") < 0.1)` off the Web Audio
        // mixer's WALL CLOCK; slice 2 ran one tape at 0.4 fps and 10.1 fps
        // and the streams parted four ticks after the water edge. Modelling
        // the term as ZERO would agree with whichever recording it happened
        // to be compared against and disagree with the next.
        const w = world({ rows: ['water', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        const at = { x, y, vx: 0, vy: 0, terrain: 0 };
        expect(() => step(at, held(), { level: w })).toThrow(PhysicsV2Error);
        expect(() => step(at, held(), { level: w })).toThrow(/does not pin "sound"/);
        // ...and WITH the pin it is ordinary, modelled terrain.
        expect(() => step(at, held(), { level: w, pins: ['sound'] })).not.toThrow();
    });

    it('refuses to run without a level rather than quietly being the v1 engine', () => {
        expect(() => step({ x: 8, y: 8, vx: 0, vy: 0 }, held('right'), {}))
            .toThrow(PhysicsV2Error);
    });
});

/**
 * R0's `noHazards`: the terrain resolver keeps the RAW state, the physics
 * consumes the coerced one.
 *
 * Every value here is hand-derived from `Player.as` rather than from
 * running this module. The AS3 shape being mirrored: `_state = _s` stores
 * the raw tile type and the `_s != _state` change gate is untouched, while
 * the effect sites — the pit branch at `:693`, `onIce`/`onWaterfall`/
 * `inWater`/`inLava` at `:700-703`, `moveSpeed` at `:715` AND the second
 * assignment at `:523`, and `checkDrowning`'s tests at `:1420`/`:1424` —
 * read through the coerced value. `:523` is the one a "guard the setter"
 * patch misses, which is why the speed assertions below are the real check.
 */
describe('noHazards coerces what the physics CONSUMES, not what the resolver STORES', () => {
    const ALL = ['water', 'pit', 'lava', 'ice', 'waterfall'];

    it('lets a run stand on water instead of throwing', () => {
        const w = world({ rows: ['water', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        const s = step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(),
            { level: w, noHazards: ALL });
        expect(s.x).toBe(x);
    });

    it('STORES the raw hazard state — the brick-not-ground lesson', () => {
        // The observation stream cannot tell (both walk at 0.8 once
        // coerced), so this is asserted on the resolver's own answer. A
        // model that coerced at STORAGE would report 0 here and would then
        // be unable to re-arm one hazard at a time at R4, because the raw
        // value it needs to test against would already be gone.
        const w = world({ rows: ['water', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        const s = step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(),
            { level: w, noHazards: ALL });
        expect(s.terrain).toBe(1);
        expect(resolveTerrainState(w, x, y, 0)).toBe(1);
    });

    it('applies the coerced speed, not the hazard speed (Player.as:523)', () => {
        // Water's MOVE_SPEEDS entry is not 0.8; Ground's is. One tick from
        // rest holding RIGHT moves exactly one accel quantum, and accel IS
        // moveSpeed (`Player.as:1489`), so the x delta names the speed the
        // physics actually selected.
        expect(MOVE_SPEEDS[1]).not.toBe(WALK_SPEED);
        const w = world({ rows: ['water', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        const s = step({ x, y, vx: 0, vy: 0, terrain: 0 }, held('right'),
            { level: w, noHazards: ALL });
        // ⚠ Absolute position, never a delta: subtracting two doubles
        // reintroduces float noise the values themselves do not have
        // (40.8 - 40 is 0.7999999999999972). The arc has been bitten by
        // this before; `vx` carries the quantum exactly.
        expect(s.vx).toBe(WALK_SPEED);
        expect(s.x).toBe(40.8);
    });

    it('coerces ONLY the named hazards — this is what makes R4 possible', () => {
        // R4 re-arms hazards one at a time. A tape that disables pits but
        // not water must still die loudly on water, or the rung is not a
        // rung. Same level, same position, different tape.
        const w = world({ rows: ['water', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(),
            { level: w, noHazards: ['pit', 'lava', 'ice', 'waterfall'] }))
            .toThrow(/Water/);
    });

    it('leaves NON-hazard terrain alone, stairs included', () => {
        // Stairs (10) are slower but harmless. Flattening them would erase
        // real physics rather than a hazard, and the stream WOULD see it.
        const w = world({ rows: ['stairs', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        const s = step({ x, y, vx: 0, vy: 0, terrain: 0 }, held('right'),
            { level: w, noHazards: ALL });
        expect(s.terrain).toBe(10);
        expect(s.vx).toBe(MOVE_SPEEDS[10]);
        expect(s.x).toBe(40.4);
    });

    it('defaults to coercing NOTHING, so a v1 tape is bit-identical', () => {
        // The eleven committed fixtures are v1 tapes and must stay
        // byte-identical. `parseTape` normalises them to `noHazards: []`,
        // and [] must mean exactly what v2 meant before this field existed.
        const w = world({ rows: ['water', 'ground', 'ground', 'ground'] });
        const { x, y } = centre(2, 0);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(/Water/);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(),
            { level: w, noHazards: [] })).toThrow(/Water/);
    });

    it('coerces the STICKY fallback too, not just a freshly resolved state', () => {
        // Row 1 is missing, so mid-row-1 the intersect gate fails and the
        // PREVIOUS state persists. If the coerce ran only on the resolver's
        // fresh answer, a carried-in hazard state would reach the physics
        // uncoerced — a hole in exactly the place stickiness lives.
        const w = world({ rows: ['ground', null, 'ground', 'ground'] });
        const { x, y } = centre(2, 1);
        const s = step({ x, y, vx: 0, vy: 0, terrain: 1 }, held('right'),
            { level: w, noHazards: ALL });
        expect(s.terrain).toBe(1);        // still sticky, still raw
        expect(s.vx).toBe(WALK_SPEED);    // but consumed as Ground
        expect(s.x).toBe(40.8);
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
    it('STOPS on a pixelmask collider — per pixel, not per bounding rect', () => {
        // v2 threw here, because a rect approximation is what Phase 5a
        // forbids and no mask was modelled. R2 models them, so the sweep
        // stops on the bitmap: the building's mask is solid at (40,40), and
        // moving up into it pins the player exactly as a rect solid would.
        // ⚠ With its POSITIVE CONTROL beside it: the same step in a world
        // with no building must move. A "did not move" assertion on its own
        // is satisfied by a physics that never moves at all, which is the
        // vacuity this arc keeps re-meeting.
        const start = { x: 40, y: 40, vx: 0, vy: -3, terrain: 0 };
        const blocked = step(start, held('up'),
            { level: world({ entities: [{ type: 'building', x: 0, y: 0 }] }) });
        const clear = step(start, held('up'), { level: world({ entities: [] }) });
        expect(blocked.y).toBe(40);
        expect(clear.y).toBeLessThan(40);
    });

    it('THROWS when two teleporters fire on the same tick', () => {
        // `FP.world =` only records a `_goto`, so the LAST teleporter to
        // update wins — and that order is FlashPunk's prepend order, which
        // this module deliberately does not transcribe. The player's box at
        // the centre of (2,1) is [38,42)x[22,27), which reaches into both of
        // these 16x16 volumes.
        const w = world({
            entities: [
                { type: 'teleporter', x: 32, y: 16, attrs: { to: 94, playerx: 0, playery: 0 } },
                { type: 'teleporter', x: 32, y: 8, attrs: { to: 12, playerx: 0, playery: 0 } },
            ],
        });
        const { x, y } = centre(2, 1);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(PhysicsV2Error);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(/2 teleporters fired on the same tick/);
    });

    it('THROWS on a teleporter that targets its OWN level', () => {
        // Not squeamishness: the GAME's transitions are derived from the
        // level field, so a same-level teleport is invisible on that side.
        // Modelling it would put an entry in the JS stream that the oracle
        // could never report — a divergence created by the model itself.
        const w = world({
            entities: [{
                type: 'teleporter', x: 32, y: 16, attrs: { to: 900, playerx: 0, playery: 0 },
            }],
        });
        const { x, y } = centre(2, 1);
        expect(() => step({ x, y, vx: 0, vy: 0, terrain: 0 }, held(), { level: w }))
            .toThrow(/targets its OWN level/);
    });
});

/**
 * Room transitions — the slice-3 model, hand-derived from `Teleporter.as`
 * and `Game.as` over the synthetic grid.
 *
 * The fixture differential proves the WHOLE thing end to end against the
 * real game (`transition-west-return` crosses twice), but it can only
 * exercise the paths that one route takes: level 0 and 94's teleporters are
 * all `tag = -1`, no arrival lands on a trigger, and no tick overlaps two.
 * The latch's arming, its clearing, and the deactivated arm therefore have
 * no oracle at all, which is what these are for.
 */
describe('room transitions', () => {
    /** A teleporter at oel (32,16), i.e. the trigger volume over cell (2,1). */
    const gate = (attrs) => ({
        type: 'teleporter', x: 32, y: 16, attrs: { playerx: 288, playery: 160, ...attrs },
    });
    const onGate = centre(2, 1);
    const clearOfGate = centre(0, 3);

    it('fires when the player overlaps a live, unlatched trigger', () => {
        const w = world({ entities: [gate({ to: 94 })] });
        const r = step({ ...onGate, vx: 0, vy: 0, terrain: 0 }, held(), { level: w });
        expect(r.transition).toMatchObject({ from_level: 900, to_level: 94 });
        expect(r.transition.teleporter.arrival).toEqual({ x: 296, y: 168 });
    });

    it('does not fire for a trigger the player is clear of', () => {
        // The negative control. Without it, "fires on a teleporter" would be
        // satisfied by firing on every level that contains one.
        const w = world({ entities: [gate({ to: 94 })] });
        const r = step({ ...clearOfGate, vx: 0, vy: 0, terrain: 0 }, held(), { level: w });
        expect(r.transition).toBeNull();
    });

    it('runs the tick\'s FULL movement in the OLD level before the swap', () => {
        // `FP.world = new Game(...)` sets `_goto`; the swap is deferred to
        // `Engine.checkWorld` at end-of-tick, so the doomed player really
        // does complete this tick. One accel quantum from rest = 0.8.
        const w = world({ entities: [gate({ to: 94 })] });
        const r = step({ ...onGate, vx: 0, vy: 0, terrain: 0 }, held('right'), { level: w });
        expect(r.transition).not.toBeNull();
        expect(r.x).toBeCloseTo(onGate.x + 0.8, 12);
        expect(r.vx).toBe(0.8);
    });

    it('pre-arms the latch for a trigger the player is standing on', () => {
        // `Teleporter.check()` is the ONLY place `playerTouching` is set,
        // and `Game.update` runs check() on every entity on the world's
        // first frame — above the blackCover gate, so it happens whether or
        // not that frame is a live tick.
        const w = world({ entities: [gate({ to: 94 })] });
        expect([...initialLatch(w, onGate.x, onGate.y)]).toEqual([0]);
        expect([...initialLatch(w, clearOfGate.x, clearOfGate.y)]).toEqual([]);
    });

    it('a pre-armed trigger does not fire until the player steps OFF it', () => {
        // The anti-ping-pong rule, and the reason a round trip is two
        // crossings rather than an endless bounce.
        const w = world({ entities: [gate({ to: 94 })] });
        const latched = initialLatch(w, onGate.x, onGate.y);
        const held0 = updateTeleporters(w, onGate.x, onGate.y, latched);
        expect(held0.fired).toEqual([]);
        expect([...held0.latched]).toEqual([0]);

        // Step off: the else-branch clears it.
        const off = updateTeleporters(w, clearOfGate.x, clearOfGate.y, held0.latched);
        expect(off.fired).toEqual([]);
        expect([...off.latched]).toEqual([]);

        // Step back on: now it fires.
        const back = updateTeleporters(w, onGate.x, onGate.y, off.latched);
        expect(back.fired).toHaveLength(1);
        expect(back.fired[0].teleporter.to).toBe(94);
    });

    it('firing does not latch — only check() ever sets playerTouching', () => {
        // Transcribed rather than tidied. It is harmless in the game (the
        // world the entity belongs to is discarded moments later), but a
        // model that latched on fire would be describing a rule the source
        // does not have.
        const w = world({ entities: [gate({ to: 94 })] });
        const r = updateTeleporters(w, onGate.x, onGate.y, new Set());
        expect(r.fired).toHaveLength(1);
        expect([...r.latched]).toEqual([]);
    });

    it('a DEACTIVATED trigger neither fires nor clears its own latch', () => {
        // `update()` returns before both arms. A tagged, non-inverted
        // teleporter is deactivated on a fresh boot — see levelWorld — which
        // is the second reason fixtures stay off tagged teleporters.
        const w = world({ entities: [gate({ to: 94, tag: 4 })] });
        expect(w.teleporters[0].deactivated).toBe(true);
        expect(updateTeleporters(w, onGate.x, onGate.y, new Set()).fired).toEqual([]);
        // Pre-armed by check() (which does NOT consult `deactivated`), then
        // left armed even though the player has walked away.
        const latched = initialLatch(w, onGate.x, onGate.y);
        expect([...latched]).toEqual([0]);
        expect([...updateTeleporters(w, clearOfGate.x, clearOfGate.y, latched).latched])
            .toEqual([0]);
    });

    it('arriveIn lands at (playerx + 8, playery + 8) with a WHOLE new Player', () => {
        // `Game.as:2040` builds `new Player(playerx, playery)` and the ctor
        // re-centres onto the tile (`Player.as:357`). Velocity and the
        // sticky terrain state go with the old entity; held keys do not
        // appear here at all, because FlashPunk's Input is static.
        const w = world({ entities: [gate({ to: 94 })] });
        const tp = w.teleporters[0];
        expect(tp.playerx).toBe(288);
        expect(arriveIn(w, tp)).toEqual({
            x: 296,
            y: 168,
            vx: 0,
            vy: 0,
            terrain: INITIAL_TERRAIN_STATE,
            // R4: the four sticky hazard flags and the drown timer go with
            // the old entity too, for exactly the reason `terrain` does —
            // the arrival is a whole new `Player` and its initialisers run
            // again. Asserted EXACTLY (toEqual, not toMatchObject) so a
            // future field that forgets to reset is a red rather than an
            // omission nobody notices.
            hazard: { onIce: false, onWaterfall: false, inWater: false, inLava: false },
            drown: { timer: 0, drowning: false },
            // …and so does the FACING (R4). A walk that carried it across a
            // door would aim the first press in the new level at whatever
            // the last corridor of the old one pointed at. This assertion
            // is the reason that field could not be added quietly.
            direction: 3,
            latched: new Set(),
            hitX: null,
            hitY: null,
        });
    });

    it('arriveIn pre-arms the latch when the arrival lands ON a trigger', () => {
        // The case the recorded round trip specifically does NOT exercise —
        // both of its arrivals are clear of the return trigger — so it has
        // no oracle and needs this. Arriving at (296,168) inside a trigger
        // whose oel position is (288,160): without the pre-arm the very next
        // tick would fire it straight back.
        const w = world({
            entities: [
                gate({ to: 94 }),
                { type: 'teleporter', x: 288, y: 160, attrs: { to: 12, playerx: 0, playery: 0 } },
            ],
        });
        const arrived = arriveIn(w, w.teleporters[0]);
        expect([...arrived.latched]).toEqual([1]);
        expect(updateTeleporters(w, arrived.x, arrived.y, arrived.latched).fired).toEqual([]);
    });

    it('carries the latch through an ordinary tick', () => {
        // `step` has to thread it: a model that recomputed the latch from
        // scratch each tick would re-fire every trigger the player stood
        // still on.
        const w = world({ entities: [gate({ to: 94 })] });
        const at = { ...onGate, vx: 0, vy: 0, terrain: 0, latched: new Set([0]) };
        const r = step(at, held(), { level: w });
        expect(r.transition).toBeNull();
        expect([...r.latched]).toEqual([0]);
    });
});

describe('R1: the pit transport, hand-derived from Player.as', () => {
    const L83 = buildLevelWorld(levelRecord(83), { roles: RELAXED_ROLES });
    const L84 = buildLevelWorld(levelRecord(84), { roles: RELAXED_ROLES });
    const R1 = ['water', 'lava', 'ice', 'waterfall'];

    it('the fall-out is EXACTLY 20 ticks, by repeated subtraction', () => {
        // fallAlphaSpeed = 0.05 from an Image alpha of 1, swapping at
        // `alpha <= 0`. Twenty subtractions land on -3.19e-16 — BELOW zero,
        // so tick 20 swaps. Computing the count as 1/0.05 gives exactly 20
        // too, but accumulating the other way can land a hair ABOVE zero and
        // give 21. The value is asserted, not just the count, because the
        // count is what the recording pins and the sign is what makes it 20.
        let alpha = FALL_ALPHA_START;
        let n = 0;
        while (alpha > 0) { alpha -= FALL_ALPHA_SPEED; n += 1; }
        expect(n).toBe(20);
        expect(alpha).toBe(-3.191891195797325e-16);
    });

    it('the descent is EXACTLY 41 ticks from a drop that is always 83 px', () => {
        // Player.check() puts the arrival at `FP.camera.y - (height -
        // originY)`, and loadlevel had just set that camera to `player.y -
        // FP.screen.height/2` UNCLAMPED — view() clamps it, but view() runs
        // after check() in the same update. 160/2 + (5 - 2) = 83, and
        // FP.screen never changes size, so this is a constant of the BUILD
        // rather than of the level.
        expect(DESCENT_DROP).toBe(80 + (HITBOX.height - HITBOX.originY));
        let y = -DESCENT_DROP;
        let vy = 0;
        let n = 0;
        while (y < 0) {
            vy = Math.min(vy + DESCENT_GRAVITY, DESCENT_MAX_FALL);
            y += vy;
            n += 1;
        }
        expect(n).toBe(41);
        expect(y).toBeCloseTo(3.1, 10);      // the landing OVERSHOOTS yStart
        expect(vy).toBeCloseTo(4.1, 10);
    });

    it('the bounce is EXACTLY 39 ticks and returns to yStart', () => {
        let y = 0;
        let vy = BOUNCE_VELOCITY;
        let n = 0;
        do {
            vy = Math.min(vy + DESCENT_GRAVITY, DESCENT_MAX_FALL);
            y += vy;
            n += 1;
        } while (y < 0);
        expect(n).toBe(39);
        expect(y).toBeCloseTo(0, 10);
    });

    it('⚠ pit/water/lava LAND; an ordinary floor BOUNCES', () => {
        // The polarity most likely to be transcribed backwards. You cannot
        // bounce on a hole or a liquid, so the ordinary floor is the case
        // that bounces — once.
        expect(NO_BOUNCE_STATES).toEqual([6, 1, 17]);
        // Level 84's arrival tile is a PIT, which is what chains the fall.
        expect(getStatePos(L84, 40, 40)).toBe(6);
        // Level 83's boot tile is Dirt, which would bounce.
        expect(getStatePos(L83, 24, 24)).toBe(4);
    });

    it('getStatePos TRUNCATES its args and is NOT coerced', () => {
        // `getStatePos(_x:int, _y:int)` — AS3 coerces on the way in. And R0's
        // four coerce sites do not include it, so the landing check reads the
        // RAW tile type while the physics reads the coerced one. That is not
        // a curiosity: the 48 -> 49 fall on the R1 route lands on ICE, which
        // noHazards flattens for the physics and which this sees as 22 and
        // bounces off.
        expect(getStatePos(L84, 40.9, 40.9)).toBe(getStatePos(L84, 40, 40));
        expect(getStatePos(L84, 40, 40)).toBe(6);   // never 0, however coerced
    });

    it('the ctor args snap to the tile grid, with the max(...,0) clamp', () => {
        // x = floor(max(fallInPitPos.x - offset.x, 0)/16)*16. Level 83's pit
        // (2,1) has its centre at (40,24) and its control block offsets by
        // (0,-16) — the control ENTITY'S OWN POSITION plus its xOff/yOff
        // attrs, not the attrs alone.
        expect(L83.fallthrough).toEqual({
            level: 84, offsetX: 0, offsetY: -16, sign: -1,
        });
        expect(fallDestination(L83, { x: 40, y: 24 }))
            .toEqual({ to_level: 84, ctor: { x: 32, y: 32 } });
        // ⚠ The clamp is on the SUBTRACTION and needs a POSITIVE offset to
        // engage at all — level 83's is (0,-16), so nothing there can ever
        // exercise it. Level 71's is (32,-64): a pit at x = 8 gives 8 - 32 =
        // -24, which `Math.floor(-24/16)*16` sends to -32 (a ctor arg
        // outside the level) while `max(..., 0)` sends it to 0. Written
        // against 71 on purpose — a first cut used 83 and the mutation that
        // deletes the clamp stayed green.
        // roles: ['trigger'] — level 71 holds a shieldlock and a button,
        // both still `hazard: 'unpriced'`, so consulting proximity-hazard
        // there THROWS. The census working, not a workaround: this test
        // needs the control block, which is read for every role set.
        const L71 = buildLevelWorld(levelRecord(71), { roles: ['trigger'] });
        expect(L71.fallthrough).toMatchObject({ level: 82, offsetX: 32, offsetY: -64 });
        expect(fallDestination(L71, { x: 8, y: 216 }).ctor.x).toBe(0);
        expect(fallDestination(L83, { x: 8, y: 8 }).ctor.x).toBe(0);
    });

    it('a pit in a level with NO control block is a NAMED death, not a fall', () => {
        // 27 of the 116 levels hold pit tiles and no control block, and
        // `checkFallingInPit`'s else branch is die(). Level 65 (Dungeon 6)
        // is one of them.
        const L65 = buildLevelWorld(levelRecord(65), { roles: RELAXED_ROLES });
        expect(L65.fallthrough).toBeNull();
        expect(L65.pitTiles.length).toBeGreaterThan(0);
        expect(() => fallDestination(L65, { x: 40, y: 24 }))
            .toThrow(/NO control block/);
    });

    it('arriveFromFall drops the player 83 px above yStart, velocity zero', () => {
        const s = arriveFromFall(L84, { x: 32, y: 32 });
        expect(s.x).toBe(40);
        expect(s.fall).toEqual({ phase: 'descent', yStart: 40, bounced: false });
        expect(s.y).toBe(40 - DESCENT_DROP);
        expect([s.vx, s.vy]).toEqual([0, 0]);
        expect(s.terrain).toBe(INITIAL_TERRAIN_STATE);
    });

    it('the EDGE tick still runs input(); the ticks after it do not', () => {
        // `receiveInput = false` is set inside checkFallingInPit, which runs
        // AFTER super.update(). A transcription that kills input on the edge
        // tick diverges on the first tick of every fall. Driven through the
        // real level: hold RIGHT from the tile west of level 83's pit.
        const held = new Set(['right']);
        let s = {
            x: 24, y: 24, vx: 0, vy: 0, terrain: INITIAL_TERRAIN_STATE,
            latched: new Set(), fall: null,
        };
        const opts = { level: L83, noclip: true, noHazards: R1 };
        const xs = [s.x];
        for (let i = 0; i < 12; i += 1) { s = step(s, held, opts); xs.push(s.x); }
        // The edge fires when the resolver first answers 6...
        const edge = xs.findIndex((_, i) => i > 0 && xs[i] - xs[i - 1] < xs[i - 1] - xs[i - 2]);
        expect(s.fall).not.toBeNull();
        // ...and the tick it fires on still accelerated: the limit cycle is
        // unbroken through it (0.80, 1.35, 1.10, 0.85, 1.40, 1.15, 0.90, 1.45).
        expect(xs[8] - xs[7]).toBeCloseTo(1.45, 10);
        expect(edge).toBeGreaterThan(0);
    });

    it('REFUSES a teleporter firing while a transport is in flight', () => {
        // Live, not defensive: level 100's exit to 101 stands ON a pit tile.
        const s = {
            x: 40, y: 24, vx: 0, vy: 0, terrain: 4, latched: new Set(),
            fall: { phase: 'out', target: { x: 40, y: 24 }, alpha: 0.5 },
        };
        // Level 83's own teleporter is at (32,64); park the player in it.
        expect(() => step({ ...s, x: 40, y: 72 }, new Set(),
            { level: L83, noclip: true, noHazards: R1 }))
            .toThrow(/while a pit transport was in flight/);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// R4: THE HAZARDS COME BACK
//
// Every number below is read off `Player.as` / `Mobile.as` rather than off
// this port. The hard part of these four flags is that they are STATE: the
// setter assigns them on a RAW change and they persist until the next one,
// so "which tile is under the player" and "which physics the player is
// running" are two different questions — and the observation stream can
// only ever see the second.
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⛓ R5 SLICE 4 ADDED `pins: ['sound']` TO THE HAZARD TESTS BELOW, and the
 * reason is a finding rather than a chore.
 *
 * `Player.as:530`'s swim term lives in the `inWater || inLava` arm, and
 * `inWater` is `eff == 1 || eff == 25` — so a WATERFALL tick reads it too.
 * R4 armed waterfall and lava with `swimBurst` hard-coded to zero, which
 * was silently wrong and got away with it for one reason only: no committed
 * route ever stood on either. The bound was real and nobody had written it
 * down. `step` refuses an unpinned wet tick now, so these tests declare the
 * pin — which is what a tape standing on any of this terrain has to do.
 */
const PINNED = { pins: ['sound'] };

describe('R4: the sticky hazard flags', () => {
    it('sets each flag from the COERCED state (Player.as:713-717)', () => {
        expect(hazardFlagsFor(22)).toEqual({
            onIce: true, onWaterfall: false, inWater: false, inLava: false,
        });
        expect(hazardFlagsFor(17)).toEqual({
            onIce: false, onWaterfall: false, inWater: false, inLava: true,
        });
        expect(hazardFlagsFor(1)).toEqual({
            onIce: false, onWaterfall: false, inWater: true, inLava: false,
        });
        expect(hazardFlagsFor(0)).toEqual(INITIAL_HAZARD_FLAGS);
    });

    it('⚠ counts a WATERFALL as inWater — `eff == 1 || eff == 25`', () => {
        // The line the R4 kickoff got backwards in one direction and right
        // in the other: a waterfall IS water for friction and speed, and is
        // NOT water for drowning (`checkDrowning` tests `eff == 1` alone).
        expect(hazardFlagsFor(25)).toEqual({
            onIce: false, onWaterfall: true, inWater: true, inLava: false,
        });
    });

    it('only re-assigns on a RAW state change, which is what makes it sticky', () => {
        // Row 0 is lava, the rest is missing — so at the centre of row 2 the
        // gate fails, the terrain stays lava, and the FLAGS stay lava too.
        // A model that recomputed them from the tile under the player every
        // tick would clear them here, and the player would silently walk
        // out of lava physics without leaving lava.
        const w = world({ rows: ['lava', null, null, null] });
        const s0 = {
            x: 40, y: 8, vx: 0, vy: 0, terrain: INITIAL_TERRAIN_STATE,
            hazard: INITIAL_HAZARD_FLAGS, drown: { timer: 0, drowning: false },
            latched: new Set(),
        };
        const onLava = step(s0, held(), { level: w, noclip: true, inventory: { hasDarkSuit: true }, ...PINNED });
        expect(onLava.terrain).toBe(17);
        expect(onLava.hazard.inLava).toBe(true);
        // Now step from a position the gate cannot reach: same flags.
        const away = step({ ...onLava, x: 40, y: 40 }, held(),
            { level: w, noclip: true, inventory: { hasDarkSuit: true }, ...PINNED });
        expect(away.terrain).toBe(17);
        expect(away.hazard.inLava).toBe(true);
    });
});

describe('R4: the friction/speed selection (Player.as:516-537)', () => {
    const dry = { onIce: false, onWaterfall: false, inWater: false, inLava: false };

    it('ICE REPLACES BOTH — it is not water with a different number', () => {
        // `f = slidingFriction (0.025)` AND `moveSpeed = slidingSpeed (1)`.
        // So the player accelerates FASTER than the 0.8 walk and decays ten
        // times slower: the ~40 px coast that makes ShieldLock.turnOff's
        // `if (p)` a live question rather than a dead arm.
        expect(SLIDING_FRICTION).toBe(0.025);
        expect(SLIDING_SPEED).toBe(1);
        expect(speedFrictionFor({ ...dry, onIce: true }, 22, 22, MOVE_SPEEDS, 0))
            .toEqual({ friction: 0.025, moveSpeed: 1 });
    });

    it('water and lava share WATER_FRICTION and the 0.45 speed', () => {
        expect(speedFrictionFor({ ...dry, inWater: true }, 1, 1, MOVE_SPEEDS, 0))
            .toEqual({ friction: 0.5, moveSpeed: 0.45 });
        expect(speedFrictionFor({ ...dry, inLava: true }, 17, 17, MOVE_SPEEDS, 0))
            .toEqual({ friction: 0.5, moveSpeed: 0.45 });
    });

    it('a waterfall is HALF the water speed', () => {
        // moveSpeeds[25] = dMSwater / 2.
        expect(speedFrictionFor({ ...dry, onWaterfall: true, inWater: true },
            25, 25, MOVE_SPEEDS, 0)).toEqual({ friction: 0.5, moveSpeed: 0.225 });
    });

    it('dry land is the 0.25 default, unchanged from v1', () => {
        expect(speedFrictionFor(dry, 0, 0, MOVE_SPEEDS, 0))
            .toEqual({ friction: 0.25, moveSpeed: 0.8 });
        expect(speedFrictionFor(dry, 10, 10, MOVE_SPEEDS, 0).moveSpeed).toBe(0.4);
    });

    it('ICE WINS over inWater — the branches are exclusive, ice first', () => {
        // Unreachable from `hazardFlagsFor` (one eff sets one flag), so this
        // pins the ORDER rather than a state: an `if (inWater) ... else if
        // (onIce)` port would pick the wrong arm the day something else
        // sets two flags.
        expect(speedFrictionFor({ ...dry, onIce: true, inWater: true },
            22, 22, MOVE_SPEEDS, 0)).toEqual({ friction: 0.025, moveSpeed: 1 });
    });
});

describe('R4: the waterfall push (Player.as:1537-1540)', () => {
    it('adds 0.8 to v.y, inside input(), gated by the feather', () => {
        expect(WATERFALL_ACCELERATION).toBe(0.8);
        const w = world({ rows: ['waterfall', 'waterfall', 'waterfall', 'waterfall'] });
        const s0 = {
            x: 40, y: 8, vx: 0, vy: 0, terrain: INITIAL_TERRAIN_STATE,
            hazard: INITIAL_HAZARD_FLAGS, drown: { timer: 0, drowning: false },
            latched: new Set(),
        };
        // Tick 1 RESOLVES the waterfall but the flags are assigned inside
        // the same tick's setter, so the push is already live: v.y = 0.8
        // with no key held and no friction to remove first (friction on a
        // zero vector is a no-op).
        const t1 = step(s0, held(), { level: w, noclip: true, inventory: {}, ...PINNED });
        expect(t1.hazard).toEqual({
            onIce: false, onWaterfall: true, inWater: true, inLava: false,
        });
        expect(t1.vy).toBe(0.8);
    });

    it('⚠ the feather exempts UPWARD motion ONLY — `!hasFeather || v.y >= 0`', () => {
        const w = world({ rows: ['waterfall', 'waterfall', 'waterfall', 'waterfall'] });
        const base = {
            x: 40, y: 24, vx: 0, vy: 0, terrain: 25,
            hazard: { onIce: false, onWaterfall: true, inWater: true, inLava: false },
            drown: { timer: 0, drowning: false }, latched: new Set(),
        };
        // Moving DOWN or standing still: pushed even with the feather.
        expect(step({ ...base, vy: 0 }, held(), {
            level: w, noclip: true, inventory: { hasFeather: true }, ...PINNED,
        }).vy).toBeCloseTo(0.8, 10);
        // Moving UP with the feather: exempt. Friction still runs, so the
        // check is that 0.8 was NOT added rather than that vy is unchanged.
        const up = step({ ...base, vy: -1 }, held(), {
            level: w, noclip: true, inventory: { hasFeather: true }, ...PINNED,
        });
        const upNoFeather = step({ ...base, vy: -1 }, held(), {
            level: w, noclip: true, inventory: {}, ...PINNED,
        });
        expect(upNoFeather.vy - up.vy).toBeCloseTo(0.8, 10);
        expect(up.vy).toBeLessThan(0);
    });
});

describe('R4: checkDrowning, and the timer that never resets', () => {
    const none = { canSwim: false, hasDarkSuit: false };
    const fresh = { timer: 0, drowning: false };

    it('arms on the first contact tick and counts DOWN from 10', () => {
        expect(DROWN_TIMER_MAX).toBe(10);
        expect(checkDrowning(fresh, 1, none)).toEqual({ timer: 10, drowning: false });
        expect(checkDrowning({ timer: 10, drowning: false }, 1, none))
            .toEqual({ timer: 9, drowning: false });
    });

    it('latches `drowning` on the ELEVENTH contact tick', () => {
        let d = fresh;
        for (let i = 0; i < 11; i++) d = checkDrowning(d, 1, none);
        expect(d).toEqual({ timer: 0, drowning: true });
        // ...and ten is not enough, which is the half of this that a
        // fencepost error would silently pass.
        let e = fresh;
        for (let i = 0; i < 10; i++) e = checkDrowning(e, 1, none);
        expect(e.drowning).toBe(false);
    });

    it('⛔ FREEZES rather than resetting when the player steps off', () => {
        // The single most load-bearing fact in R4's floor policy: the only
        // three writes are the arm, the decrement and `drown()`'s spin, so
        // the budget for un-protected hazard contact is ELEVEN TICKS FOR
        // THE WHOLE VISIT rather than eleven in a row. A model that reset
        // it off-hazard would make lava look survivable in short hops.
        let d = fresh;
        for (let i = 0; i < 6; i++) d = checkDrowning(d, 1, none);
        expect(d.timer).toBe(5);
        for (let i = 0; i < 50; i++) d = checkDrowning(d, 0, none);   // dry land
        expect(d.timer).toBe(5);
        for (let i = 0; i < 5; i++) d = checkDrowning(d, 1, none);
        expect(d.drowning).toBe(true);
    });

    it('the ITEMS are what make it survivable, per hazard', () => {
        // conch -> canSwim for water; the dark suit for lava. Each covers
        // its own hazard and NOT the other, which is why R4 can arm lava
        // and not water.
        expect(checkDrowning(fresh, 1, { canSwim: true })).toEqual(fresh);
        expect(checkDrowning(fresh, 17, { hasDarkSuit: true })).toEqual(fresh);
        expect(checkDrowning(fresh, 1, { hasDarkSuit: true }).timer).toBe(10);
        expect(checkDrowning(fresh, 17, { canSwim: true }).timer).toBe(10);
    });

    it('a WATERFALL never drowns — checkDrowning tests eff == 1 alone', () => {
        // `inWater` includes 25; `checkDrowning` does not. This is the whole
        // reason waterfall is MODELLED floor at R4 while water is forbidden
        // floor, and treating them alike collapses the walk to one item.
        expect(checkDrowning(fresh, 25, none)).toEqual(fresh);
    });

    it('drown() spins v on a cos/sin thrash and ends at zero', () => {
        // `drownTimer = (t - 0.5 + 10) % 10`, then v.x = cos(t/10*2PI),
        // v.y = sin(...) * 2. From a latched timer of 0 the first step wraps
        // to 9.5.
        const first = drownStep({ timer: 0, drowning: true });
        expect(first.drown.timer).toBe(9.5);
        expect(first.v.x).toBeCloseTo(Math.cos((9.5 / 10) * 2 * Math.PI), 12);
        expect(first.v.y).toBeCloseTo(Math.sin((9.5 / 10) * 2 * Math.PI) * 2, 12);
        expect(first.dead).toBe(false);
        // ...and reaching zero is the die() tick.
        expect(drownStep({ timer: 0.5, drowning: true }).dead).toBe(true);
    });

    it('THROWS rather than modelling the death', () => {
        // A death is a ROUTE failure, not a physics outcome to reproduce:
        // an armed hazard is planner-forbidden floor. Naming it at the tick
        // it happens is what turns "the recording diverged 2000 ticks later"
        // into "leg 31 stood on lava".
        const w = world({ rows: ['lava', 'lava', 'lava', 'lava'] });
        let s = {
            x: 40, y: 8, vx: 0, vy: 0, terrain: INITIAL_TERRAIN_STATE,
            hazard: INITIAL_HAZARD_FLAGS, drown: { timer: 0, drowning: false },
            latched: new Set(),
        };
        expect(() => {
            for (let i = 0; i < 40; i++) {
                s = step(s, held(), { level: w, noclip: true, inventory: {}, ...PINNED });
            }
        }).toThrow(/DROWNED/);
        // With the dark suit the same forty ticks are an ordinary slow walk.
        let safe = {
            x: 40, y: 8, vx: 0, vy: 0, terrain: INITIAL_TERRAIN_STATE,
            hazard: INITIAL_HAZARD_FLAGS, drown: { timer: 0, drowning: false },
            latched: new Set(),
        };
        for (let i = 0; i < 40; i++) {
            safe = step(safe, held(), { level: w, noclip: true, inventory: { hasDarkSuit: true }, ...PINNED });
        }
        expect(safe.drown).toEqual({ timer: 0, drowning: false });
    });
});

describe('Player.direction (R4: the facing every press rect reads)', () => {
    it('derives from VELOCITY with x before y, and STICKS at rest', () => {
        // `Player.sprites()` (Player.as:1596-1626). The fall-through is
        // "unchanged", not any default — which is what makes a player
        // pinned against a wall keep facing into it.
        expect(nextDirection(DIRECTION_DOWN, -1, 0)).toBe(DIRECTION_LEFT);
        expect(nextDirection(DIRECTION_DOWN, 1, 0)).toBe(DIRECTION_RIGHT);
        expect(nextDirection(DIRECTION_DOWN, 0, -1)).toBe(DIRECTION_UP);
        expect(nextDirection(DIRECTION_UP, 0, 1)).toBe(DIRECTION_DOWN);
        // A diagonal faces HORIZONTALLY: the x arms are tested first.
        expect(nextDirection(DIRECTION_DOWN, -1, -1)).toBe(DIRECTION_LEFT);
        expect(nextDirection(DIRECTION_DOWN, 1, 1)).toBe(DIRECTION_RIGHT);
        // Zero velocity changes nothing, whatever it was.
        expect(nextDirection(DIRECTION_LEFT, 0, 0)).toBe(DIRECTION_LEFT);
        expect(nextDirection(DIRECTION_UP, 0, 0)).toBe(DIRECTION_UP);
    });

    it('lets directionFace override it entirely', () => {
        expect(nextDirection(DIRECTION_LEFT, -5, 0, DIRECTION_UP)).toBe(DIRECTION_UP);
        // …and -1 means "act normally", which is the R4 walk's whole life.
        expect(nextDirection(DIRECTION_LEFT, 0, 5, -1)).toBe(DIRECTION_DOWN);
    });

    it('starts DOWN, and every arrival puts it back there', () => {
        // `Player.as:61` is `direction:int = 3`, and an arrival is a whole
        // new Player. The fall path agrees for a second reason — its
        // landing writes `direction = 3` explicitly — which is why the two
        // are one constant rather than a branch.
        expect(INITIAL_DIRECTION).toBe(DIRECTION_DOWN);
        expect(directionAfterFall()).toBe(DIRECTION_DOWN);
    });

    it('⚠ a wall-pinned player keeps the facing its LAST motion gave it', () => {
        // The case every R4 press stance is in, and the reason a
        // keys-based model would have been wrong: the sweep zeroes nothing
        // but the position stops, so `v` decays to 0 through friction and
        // the derivation falls through to "unchanged".
        let dir = DIRECTION_DOWN;
        dir = nextDirection(dir, -1.4, 0);            // walking WEST
        expect(dir).toBe(DIRECTION_LEFT);
        for (const v of [-0.9, -0.4, 0]) dir = nextDirection(dir, v, 0);
        expect(dir).toBe(DIRECTION_LEFT);             // still facing the wall
    });
});

/**
 * ── ⛔⛔⛔ R5 SLICE 14: THE OPTIONS `step()` WAS HANDED AND SILENTLY DROPPED
 *
 * `levelRun` has passed `burnedTrees` into `step()` since slice 12 and
 * `fallenRocks` since slice 10; `levelWorld.collidesSolid` has accepted
 * both for as long; `plannerBlockerAt` takes both. `step()` destructured
 * NEITHER — and an unlisted key in a destructured options object is not an
 * error, it is a silence. So the one mover whose collisions decide where a
 * route actually goes could not see a burned tree or a dropped rock while
 * every other query in the codebase could.
 *
 * ⛓⛓ THESE ARE REAL LEVELS ON PURPOSE, against this file's synthetic-grid
 * habit: the whole defect is a wiring gap between three modules, and a
 * hand-built grid has no `treeId` or `fallenRocks` to wire. What is
 * hand-derived here is the GEOMETRY — `burnabletree@128,192` is a 32x32
 * `centerOO()` solid whose box is [128,160) x [192,224), read off
 * `Scenery/BurnableTree.as:20-30` via `Tree.as` — and the assertion is
 * two-sided: the same step is BLOCKED without the option and PASSES with
 * it, so neither arm can go green by the sweep having stopped caring.
 *
 * ⚠ [[feedback_two_member_list_one_member_read]]: `fallenRocks` came along
 * only because the question was asked of every member of the family rather
 * than of the one this slice needed.
 */
describe('⛔⛔ step(): the per-visit sets the sweep MUST be told about', () => {
    const l37 = () => buildLevelWorld(levelRecord(37), {
        roles: RELAXED_ROLES,
        inventory: { hasSword: true, hasFire: true, canSwim: true, hasFeather: true },
    });
    const TREE = 'burnabletree@128,192';

    it('⛓⛓ a BURNED tree stops blocking the player — and blocks without the set', () => {
        const w = l37();
        // West of the tree's box [128,160) x [192,224), on its own row, with
        // `right` held: the sweep walks east into column 128.
        const start = { x: 120, y: 208, vx: 0, vy: 0, terrain: 0 };
        const walkEast = (opts) => {
            let s = start;
            for (let i = 0; i < 60; i += 1) s = step(s, held('right'), { level: w, ...opts });
            return s;
        };
        const blocked = walkEast({});
        const through = walkEast({ burnedTrees: new Set([TREE]) });
        // The player box is 8 wide with originX 4, so a sweep stopped by the
        // tree's west face pins x at 124.
        expect(blocked.x).toBeLessThan(128);
        expect(through.x).toBeGreaterThan(140);
    });

    it('⛓ a FALLEN rock starts blocking the player — the same gap, the other sign', () => {
        const w = l37();
        // A synthetic rock box dropped into the corridor the burn opens.
        // `fallenRocks` is a map of `{rect}`, exactly as `levelRun` builds it.
        const rock = new Map([['probe', {
            rect: { x: 176, y: 192, right: 208, bottom: 224 },
        }]]);
        const start = { x: 168, y: 208, vx: 0, vy: 0, terrain: 0 };
        const walkEast = (opts) => {
            let s = start;
            for (let i = 0; i < 60; i += 1) s = step(s, held('right'), { level: w, ...opts });
            return s;
        };
        const free = walkEast({ burnedTrees: new Set([TREE]) });
        const stopped = walkEast({ burnedTrees: new Set([TREE]), fallenRocks: rock });
        expect(free.x).toBeGreaterThan(180);
        expect(stopped.x).toBeLessThan(176);
    });
});
