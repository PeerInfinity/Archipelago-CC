/**
 * spinner — the billiard, and the three strata that pin it.
 *
 * R5 slice 13 step 0. The claims here are deliberately of different kinds,
 * because the tape differential already covers "the whole stream matches":
 *
 *   1. THE TRANSCRIPTION, hand-derived from the AS3 — the ctor's geometry,
 *      the friction override's FLOOR (the one line that makes this a
 *      billiard), and the substep loop's fractional step.
 *   2. THE DIFFERENCES FROM ITS NEIGHBOURS, asserted rather than described:
 *      a spinner's `solids` is not the player's and not a block's, and its
 *      `friction` is not `pushables.frictionStep`.
 *   3. THE MECHANISM, driven through the real world builder in L39 — the
 *      wedge itself, and the flag a terrain death banks.
 */

import { describe, it, expect } from 'vitest';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, ROLES, SOLIDS_BY_MOVER, blocksMover } from './levelWorld.js';
import { frictionStep } from './pushables.js';
import {
    MODELLED_ENEMY_CLASSES, SPINNER, SPINNER_CTOR_RNG, SPINNER_TERRAIN_WRITE, SpinnerError,
    createSpinnerState, hammerLine, hammerReach, newSpinner, spinnerFriction, spinnerRect,
    spinnerRects, spinnerTerrainWrites, stepSpinner, stepSpinners, unmodelledEnemies,
} from './spinner.js';

const source = atlasLevelSource();
const INVENTORY = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const world39 = () => buildLevelWorld(source(39), { roles: ROLES, inventory: INVENTORY, cleared: [8] });

/** A spinner in empty space, for the pure-motion cases. */
const free = (over = {}) => ({ ...newSpinner({ id: 's', x: 0, y: 0, persistTag: 3 }), ...over });
const NO_TERRAIN = { noTerrain: true };

describe('the constructor, transcribed', () => {
    it('puts the entity at the CELL CENTRE — `super(_x + Tile.w/2, _y + Tile.h/2)`', () => {
        const s = newSpinner({ id: 's', x: 224, y: 112 });
        expect([s.x, s.y]).toEqual([232, 120]);
    });

    it('heads north-EAST at exactly moveSpeed', () => {
        const s = free();
        expect(s.vx).toBeCloseTo(Math.SQRT1_2, 12);
        expect(s.vy).toBeCloseTo(-Math.SQRT1_2, 12);
        expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(1, 12);
    });

    it('`setHitbox(7, 7, 4, 4)` ⇒ the body is [x-4, x+3) x [y-4, y+3)', () => {
        const r = spinnerRect({ x: 100, y: 200 });
        expect(r).toEqual({ x: 96, y: 196, w: 7, h: 7, right: 103, bottom: 203 });
    });

    it('refuses a spinner with no position rather than producing NaN geometry', () => {
        expect(() => spinnerRect({ x: 1 })).toThrow(SpinnerError);
        expect(() => newSpinner({ id: 's', x: undefined, y: 0 })).toThrow(SpinnerError);
    });

    /**
     * ⛔ §26 said ONE `Math.random`. It is three draws on two generators, and
     * the correction is pinned rather than left in a docblock: `FP.rand` is a
     * Lehmer LFSR with its own `_seed`, not the platform RNG.
     */
    it('the ctor RNG table records TWO Math.random draws and one FP LFSR advance', () => {
        expect(SPINNER_CTOR_RNG.mathRandomDraws).toBe(2);
        expect(SPINNER_CTOR_RNG.fpLfsrDraws).toBe(1);
        expect(SPINNER_CTOR_RNG.observable).toBe(false);
    });
});

describe('friction — the OVERRIDE, whose floor is moveSpeed', () => {
    it('is INERT at speed 1: |v| goes in at moveSpeed and comes out at moveSpeed', () => {
        const { vx, vy } = spinnerFriction(Math.SQRT1_2, -Math.SQRT1_2);
        expect(Math.hypot(vx, vy)).toBeCloseTo(SPINNER.moveSpeed, 12);
    });

    /**
     * ⛓⛓ THE LINE THAT MAKES IT A BILLIARD. `Mobile.friction`'s floor is 0
     * and this one's is `moveSpeed`, so a shove DECAYS BACK TO 1 instead of
     * to rest — which is why DISPLACE is not a verb against this class.
     */
    it('decays a shove back to moveSpeed and STOPS there, where Mobile\'s goes to 0', () => {
        let v = { vx: 4, vy: 0 };
        const trace = [];
        for (let i = 0; i < 20; i += 1) {
            v = spinnerFriction(v.vx, v.vy);
            trace.push(Math.hypot(v.vx, v.vy));
        }
        expect(trace.slice(0, 4).map((n) => Number(n.toFixed(2)))).toEqual([3.75, 3.5, 3.25, 3]);
        expect(trace[trace.length - 1]).toBeCloseTo(SPINNER.moveSpeed, 12);
        // …and the base class, on the same input, reaches zero and stays.
        let m = { vx: 4, vy: 0 };
        for (let i = 0; i < 20; i += 1) m = frictionStep(m.vx, m.vy);
        expect(Math.hypot(m.vx, m.vy)).toBe(0);
    });

    it('zeroes a component under 0.05 AFTER the scale, not before', () => {
        // A direction 0.001 off the x axis: normalising to length 1 leaves
        // y at 0.001, which the dead band then snaps away.
        const { vx, vy } = spinnerFriction(1, 0.001);
        expect(vy).toBe(0);
        expect(vx).toBeCloseTo(1, 6);
    });

    it('leaves a zero vector alone rather than dividing by its length', () => {
        expect(spinnerFriction(0, 0)).toEqual({ vx: 0, vy: 0 });
    });
});

describe('the sweep — the LOOP, not the closed form', () => {
    it('takes ONE fractional substep at |v| = 0.7071, so x never lands on an integer', () => {
        const s = stepSpinner(free({ x: 100, y: 100 }), NO_TERRAIN);
        expect(s.x).toBeCloseTo(100 + Math.SQRT1_2, 12);
        expect(s.y).toBeCloseTo(100 - Math.SQRT1_2, 12);
        expect(Number.isInteger(s.x)).toBe(false);
    });

    it('REFLECTS the hit axis and leaves the other alone', () => {
        // A wall to the east only.
        // The body is [x-4, x+3), so at x=100 its right edge is 103 and a
        // 0.7071 step puts it at 103.71 — the wall has to start inside that.
        const wall = { x: 103, y: 0, right: 200, bottom: 400 };
        const hit = (r) => (r.right > wall.x && r.x < wall.right
            && r.bottom > wall.y && r.y < wall.bottom ? wall : null);
        const s = stepSpinner(free({ x: 100, y: 100 }), { ...NO_TERRAIN, collides: hit });
        expect(s.vx).toBeCloseTo(-Math.SQRT1_2, 12);   // flipped
        expect(s.vy).toBeCloseTo(-Math.SQRT1_2, 12);   // untouched
        expect(s.x).toBe(100);                          // and it did not move on x
        expect(s.y).toBeCloseTo(100 - Math.SQRT1_2, 12); // but it did on y
    });

    /**
     * ⚠ The reflect is INSIDE the substep loop and returns, so a shoved
     * spinner abandons the rest of its move. A model that multiplied
     * `sign * |v|` would agree at speed 1 and disagree here.
     */
    it('a blocked substep ABANDONS the remaining ones', () => {
        const wall = { x: 103, y: 0, right: 200, bottom: 400 };
        const hit = (r) => (r.right > wall.x && r.x < wall.right ? wall : null);
        // |v.x| = 3 ⇒ three substeps; the wall is two in.
        const s = stepSpinner(free({ x: 100, y: 100, vx: 3, vy: 0 }), {
            ...NO_TERRAIN, collides: hit,
        });
        expect(s.x).toBeLessThan(103);
        expect(s.vx).toBeLessThan(0);
    });

    it('does not move at all under Game.freezeObjects — but keeps its velocity', () => {
        const s = stepSpinner(free({ x: 100, y: 100 }), { ...NO_TERRAIN, frozen: true });
        expect([s.x, s.y]).toEqual([100, 100]);
        expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(1, 12);
    });
});

describe('solidity is per MOVER, and this class is why', () => {
    it('a spinner\'s own list is `Mobile`\'s, untouched — no Player, no Enemy', () => {
        expect([...SPINNER.solids]).toEqual([...SOLIDS_BY_MOVER.enemy]);
        expect(SPINNER.solids).not.toContain('Player');
        expect(SPINNER.solids).not.toContain('Enemy');
    });

    /** The asymmetry that IS the wedge, asserted from both sides. */
    it('a spinner does NOT block the player and DOES block a pushable block', () => {
        expect(blocksMover(SPINNER.type, 'player')).toBe(false);
        expect(blocksMover(SPINNER.type, 'pushable')).toBe(true);
        // …and the block is Solid, so the contact is mutual: the block stops
        // and the spinner bounces.
        expect(blocksMover('Solid', 'enemy')).toBe(true);
    });

    it('its friction is NOT the block\'s — two bodies in the AS3, two here', () => {
        expect(spinnerFriction(0.5, 0)).not.toEqual(frictionStep(0.5, 0));
        expect(Math.hypot(...Object.values(spinnerFriction(0.5, 0)))).toBeCloseTo(1, 12);
        expect(frictionStep(0.5, 0).vx).toBeCloseTo(0.25, 12);
    });
});

describe('the terrain arms — and the flag they bank', () => {
    it('refuses a ctx with no tileTypeAt rather than reading as "it survives"', () => {
        expect(() => stepSpinner(free(), {})).toThrow(SpinnerError);
        expect(() => stepSpinner(free(), {})).toThrow(/tileTypeAt/);
    });

    /**
     * ⛓⛓ ELEVEN, NOT TEN — and the eleven is the whole point. `alpha -= 0.1`
     * ten times leaves 1.39e-16, which is `> 0`, so the fade runs one more
     * frame than `1 / alphaFade` says. The pit fade at 0.05 lands on 20
     * exactly, so a divided model would be right there and wrong here.
     */
    it('water DESTROYS it, and `death()` fades it out over ELEVEN more ticks', () => {
        let s = free({ x: 100, y: 100 });
        const ctx = { tileTypeAt: () => 1, collides: () => null };
        s = stepSpinner(s, ctx);
        expect(s.destroy).toBe(true);
        expect(s.deathCause).toBe('water');
        expect([s.x, s.y]).toEqual([100, 100]);       // no move on the death tick
        expect(s.alpha).toBeCloseTo(0.9, 12);
        // The death tick already ran one `death()`, so this is ticks 2..11.
        for (let i = 0; i < SPINNER.deathTicks - 2; i += 1) {
            s = stepSpinner(s, ctx);
            expect(s.removePending).toBe(false);
        }
        expect(s.alpha).toBeGreaterThan(0);
        expect(s.alpha).toBeLessThan(1e-15);          // …by a rounding error
        s = stepSpinner(s, ctx);
        expect(s.removePending).toBe(true);
        s = stepSpinner(s, ctx);
        expect(s.removed).toBe(true);
    });

    it('lava too, and by the same arm', () => {
        const s = stepSpinner(free(), { tileTypeAt: () => 17, collides: () => null });
        expect(s.deathCause).toBe('lava');
    });

    /**
     * ⚠ The pit branch does NOT call `super.update()` — no friction, no move,
     * no `death()`. It drifts a tenth of the way to the cell centre per tick
     * and fades at 0.05, which is twenty ticks and then one more for the
     * removal.
     */
    it('a pit drifts it to the cell centre over twenty ticks and never moves it', () => {
        let s = free({ x: 100, y: 100 });
        const ctx = { tileTypeAt: () => 6, collides: () => null };
        const first = stepSpinner(s, ctx);
        expect(first.fallInPit).toBe(true);
        expect(first.x).toBeCloseTo(100 + (96 + 8 - 100) / 10, 12);
        s = first;
        for (let i = 0; i < SPINNER.pitFallTicks - 2; i += 1) {
            s = stepSpinner(s, ctx);
            expect(s.destroy).toBe(false);
        }
        s = stepSpinner(s, ctx);
        expect(s.destroy).toBe(true);
        expect(s.fell).toBe(true);
        expect(s.deathCause).toBe('pit');
    });

    it('the terrain arms are NOT frozen by a ceremony — only the motion is', () => {
        const s = stepSpinner(free(), { tileTypeAt: () => 1, collides: () => null, frozen: true });
        expect(s.destroy).toBe(true);
        expect(s.alpha).toBeCloseTo(0.9, 12);
    });

    /**
     * ⛔⛔ THE LEDGER ENTRY NO ROUTE CHOSE. `removed()` does not test the
     * cause, so a billiard that bounces into water banks exactly what a
     * sword kill banks.
     */
    it('a removed spinner reports its tag — and only when it HAS one', () => {
        const st = { byId: new Map(), level: 39 };
        st.byId.set('a', { ...free({ persistTag: 3 }), removed: true, deathCause: 'water' });
        st.byId.set('b', { ...free({ persistTag: -1 }), removed: true, deathCause: 'pit' });
        st.byId.set('c', { ...free({ persistTag: 4 }) });
        expect(spinnerTerrainWrites(st)).toEqual([{ id: 's', tag: 3, cause: 'water' }]);
        expect(SPINNER_TERRAIN_WRITE.causes).toContain('water');
        expect(SPINNER_TERRAIN_WRITE.causes).toContain('sword kill');
    });

    it('a dying spinner is STILL SOLID — the filter is `removed`, not `destroy`', () => {
        const st = { byId: new Map(), level: 39 };
        st.byId.set('a', { ...free(), destroy: true, alpha: 0.5 });
        expect(spinnerRects(st)).toHaveLength(1);
        st.byId.set('a', { ...free(), removed: true });
        expect(spinnerRects(st)).toHaveLength(0);
    });
});

describe('the hammer', () => {
    it('is a 13 px line whose angle is a pure function of Game.time', () => {
        const s = free({ x: 100, y: 100 });
        expect(hammerLine(s, 0).angle).toBe(0);
        expect(hammerLine(s, SPINNER.hammerPeriod).angle).toBe(0);
        const q = hammerLine(s, SPINNER.hammerPeriod / 4);
        expect(q.angle).toBeCloseTo(Math.PI / 2, 12);
        expect(Math.hypot(q.x1 - q.x0, q.y1 - q.y0)).toBeCloseTo(SPINNER.hammerLength, 12);
    });

    it('the all-phase reach is the body\'s centre grown by the hammer', () => {
        expect(hammerReach({ x: 10, y: 20 })).toEqual({ x: 10, y: 20, r: 13 });
    });
});

describe('L39, through the real world builder', () => {
    it('the roster is the three spinners, unconditional on the combat role', () => {
        const w = buildLevelWorld(source(39), { roles: ['blocking'], inventory: INVENTORY });
        expect(w.spinners.map((s) => s.persistTag).sort((a, b) => a - b)).toEqual([3, 4, 6]);
        // …and the combat census is opt-in, which is exactly why the roster
        // cannot be read off it.
        expect(w.combat).toBeNull();
    });

    it('`check()` despawns one whose flag the run already cleared', () => {
        const w = buildLevelWorld(source(39), { roles: ROLES, inventory: INVENTORY, cleared: [4] });
        expect(w.spinners.map((s) => s.persistTag).sort((a, b) => a - b)).toEqual([3, 6]);
    });

    /**
     * ⛓⛓ THE WHOLE POINT: simulated forward from tick 0 with NO PLAYER, the
     * trajectory is well defined — `runRange = 0` makes the chase arm dead
     * code, and `activeOffScreen` takes the camera out of it.
     */
    it('runs for 900 ticks with no route input, reflecting and never stopping', () => {
        const w = world39();
        const st = createSpinnerState(w);
        const ctx = {
            collides: (r) => w.collidesSolid(r, {}),
            tileTypeAt: (x, y) => w.nearestWalkableTile(x, y)?.t,
        };
        const start = [...st.byId.values()].map((s) => `${s.x},${s.y}`);
        for (let t = 0; t < 900; t += 1) stepSpinners(st, ctx);
        const now = [...st.byId.values()];
        expect(now.map((s) => `${s.x},${s.y}`)).not.toEqual(start);
        for (const s of now) {
            expect(s.removed).toBe(false);
            expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(SPINNER.moveSpeed, 9);
        }
    });

    /**
     * ⚠ AND THE PATHS STAY OFF THE HAZARDS, which is a claim about L39 and
     * not about the class. A spinner that reached water would bank a tenth
     * flag into a nine-write shaft ledger.
     */
    it('none of the three reaches water, lava or a pit — the ledger stays at nine', () => {
        const w = world39();
        const st = createSpinnerState(w);
        const ctx = {
            collides: (r) => w.collidesSolid(r, {}),
            tileTypeAt: (x, y) => w.nearestWalkableTile(x, y)?.t,
        };
        for (let t = 0; t < 3000; t += 1) stepSpinners(st, ctx);
        expect(spinnerTerrainWrites(st)).toEqual([]);
    });
});

describe('the refusal predicate `runFire` narrows to', () => {
    it('a room of spinners is MODELLED', () => {
        expect(unmodelledEnemies([{ as3: 'Spinner' }, { as3: 'Spinner' }])).toEqual([]);
    });

    it('anything else is not, and is named', () => {
        expect(unmodelledEnemies([{ as3: 'Spinner' }, { as3: 'Bob' }, { as3: 'Puncher' }]))
            .toEqual(['Bob', 'Puncher']);
    });

    it('a removed enemy is not a live one', () => {
        expect(unmodelledEnemies([{ as3: 'Bob', removed: true }])).toEqual([]);
    });

    /**
     * ⚠ THE LIST IS EARNED, NOT ASSERTED. A class is in it because something
     * steps it — the check is that every key names a module this package
     * actually exports a stepper from.
     */
    it('every modelled class names its module and its step site', () => {
        for (const [as3, row] of Object.entries(MODELLED_ENEMY_CLASSES)) {
            expect(row.module).toMatch(/\.js$/);
            expect(row.stepped).toBeTruthy();
            expect(as3).toBe('Spinner');
        }
    });
});
