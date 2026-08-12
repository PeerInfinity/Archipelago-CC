/**
 * seedlingDemo/procgenPalette.test — EVERY TEMPLATE AGAINST A BUILT WORLD,
 * and the bindings that place them.
 *
 * PROCGEN PoC arc, slice 2. `procgenLevel.test.js`'s law, one layer up: a
 * template's claim about what it builds is only worth what the ENGINE says.
 * So each template is placed into a real room, the room is built with
 * `buildLevelWorld`, and the template is found by the ROSTER it is for — a
 * wall in `solids`, water in `lethalTerrainTiles`, a pit in `pitTiles`, an
 * arrow trap in `arrowTraps` with the `shootDefault` its attrs claim.
 *
 * ⚠ TRAP 199's LESSON IS THE STRUCTURE HERE: the roster assertions are built
 * FROM `PRE_SWORD_TEMPLATES`, so a template added to the palette without a
 * verification arrives as a FAILING test rather than as an uncounted row.
 */

import { describe, expect, it } from 'vitest';

import { ROLES, TILE_SIZE, buildLevelWorld } from './levelWorld.js';
import { arrowLaneForPlacement, arrowLaneRect, arrowTrapEntityPoint } from './arrowTrap.js';
import { ProcgenLevelError, terrainAt } from './procgenLevel.js';
import {
    EXCLUDED_TEMPLATES, PRE_SWORD_PALETTE, PRE_SWORD_TEMPLATES, ProcgenPaletteError,
    assertPalette,
} from './procgenPalette.js';
import { seedlingModel, seedlingOracle } from './procgenSeedling.js';
import { rngFor } from './procgenRng.js';

const model = () => seedlingModel({ seed: 1 });
const worldFor = (record) => buildLevelWorld(record, { roles: ROLES });
const byName = (name) => PRE_SWORD_TEMPLATES.find((t) => t.name === name);

/** Place a template at a chosen anchor, ignoring the draw. */
const placedAt = (m, name, at) => m.place(m.skeleton(), byName(name), at);

describe('the palette itself is well formed', () => {
    it('passes its own structural assertion at load and on demand', () => {
        expect(assertPalette()).toBe(true);
    });

    it('refuses a template that writes outside its own footprint', () => {
        expect(() => assertPalette({
            name: 'bad',
            templates: [{
                name: 'x', family: 'x', footprint: [{ dx: 0, dy: 0 }],
                terrain: [{ dx: 5, dy: 5, terrain: 'wall' }],
            }],
        })).toThrow(ProcgenPaletteError);
    });

    it('refuses a duplicate name — the trace keys on it (trap 199)', () => {
        expect(() => assertPalette({
            name: 'dup', templates: [
                { name: 'x', family: 'a', footprint: [{ dx: 0, dy: 0 }] },
                { name: 'x', family: 'b', footprint: [{ dx: 0, dy: 0 }] },
            ],
        })).toThrow(/must be unique/);
    });

    it('every family in the roster is represented, and the count comes FROM the roster', () => {
        const families = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        expect([...families].sort()).toEqual(['arrow-lane', 'pit', 'wall', 'water']);
        expect(PRE_SWORD_PALETTE.templates).toBe(PRE_SWORD_TEMPLATES);
        expect(PRE_SWORD_PALETTE.items).toEqual({ hasSword: false, hasShield: false });
    });
});

describe('every template builds what it claims — asked of the BUILT WORLD', () => {
    it('wall-segment-h3 joins `solids` with the Stone tag, three cells of it', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'wall-segment-h3', { tx: 3, ty: 3 }));
        // ⚠ a solid's `x`/`y` are its CENTRE; `rect` is the cell.
        const placed = world.solids.filter((s) => s.tag === 'tile:Stone'
            && s.rect.y === 3 * TILE_SIZE
            && s.rect.x >= 3 * TILE_SIZE && s.rect.x <= 5 * TILE_SIZE);
        expect(placed).toHaveLength(3);
    });

    it('wall-segment-v3 is the same segment on end', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'wall-segment-v3', { tx: 3, ty: 3 }));
        const placed = world.solids.filter((s) => s.tag === 'tile:Stone'
            && s.rect.x === 3 * TILE_SIZE
            && s.rect.y >= 3 * TILE_SIZE && s.rect.y <= 5 * TILE_SIZE);
        expect(placed).toHaveLength(3);
    });

    it('water-pool-2x2 lands four cells in `lethalTerrainTiles` as tile type 1', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'water-pool-2x2', { tx: 3, ty: 3 }));
        const pool = world.lethalTerrainTiles.filter((t) => t.tx >= 3 && t.tx <= 4
            && t.ty >= 3 && t.ty <= 4);
        expect(pool).toHaveLength(4);
        expect(pool.every((t) => t.t === 1)).toBe(true);
    });

    it('pit-patch-2x1 lands two cells in `pitTiles` as tile type 6', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'pit-patch-2x1', { tx: 3, ty: 3 }));
        const pit = world.pitTiles.filter((t) => t.ty === 3 && t.tx >= 3 && t.tx <= 4);
        expect(pit).toHaveLength(2);
        expect(pit.every((t) => t.t === 6)).toBe(true);
    });

    it('arrow-lane joins `arrowTraps` with shootDefault TRUE — it fires from tick 0', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'arrow-lane', { tx: 3, ty: 3 }));
        expect(world.arrowTraps).toHaveLength(1);
        const trap = world.arrowTraps[0];
        expect(trap.shootDefault).toBe(true);
        expect(trap.t).toBe(0);
        // ⛓ the ENTITY POINT is the ctor's own (+8,+2) — never retyped here
        expect({ x: trap.ex, y: trap.ey })
            .toEqual(arrowTrapEntityPoint(3 * TILE_SIZE, 3 * TILE_SIZE));
    });

    it('the arrow lane has NO presser in this palette, so nothing can turn it off', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'arrow-lane', { tx: 3, ty: 3 }));
        expect(world.pressers).toEqual([]);
        expect(world.activators).toEqual([]);
    });

    it('EVERY template in the roster is verified above — by name, not by count', () => {
        // The list this test compares against is the one the cases assert on.
        const verified = ['wall-segment-h3', 'wall-segment-v3', 'water-pool-2x2',
            'pit-patch-2x1', 'arrow-lane'];
        expect(PRE_SWORD_TEMPLATES.map((t) => t.name).sort()).toEqual([...verified].sort());
    });
});

describe('the arrow lane\'s clearance rule is the ENGINE\'s geometry', () => {
    it('the lane rect comes from `arrowLaneForPlacement` + `arrowLaneRect`', () => {
        const m = model();
        const record = m.skeleton();
        const { lane, laneRect } = m.laneClear(record, 4, 2);
        const point = arrowTrapEntityPoint(4 * TILE_SIZE, 2 * TILE_SIZE);
        const expected = arrowLaneForPlacement({ id: lane.id, t: 0, ex: point.x, ey: point.y });
        expect(lane).toEqual(expected);
        expect(laneRect).toEqual(arrowLaneRect(expected, record.height * TILE_SIZE));
    });

    it('refuses an anchor whose lane covers the goal cell, and says which', () => {
        const m = model();
        // the model's goal cell for seed 1 — the lane straight above it
        const { tx, ty } = m.goalCell;
        const verdict = m.laneClear(m.skeleton(), tx, ty - 1);
        expect(verdict.ok).toBe(false);
        expect(verdict.over).toBe('the goal cell');
    });

    it('a lane that reaches neither the start nor the goal is legal', () => {
        const m = model();
        const far = m.goalCell.tx === 8 ? 2 : 8;
        expect(m.laneClear(m.skeleton(), far, 1).ok).toBe(true);
    });

    it('the anchor scan honours the rule — every drawn anchor is lane-clear', () => {
        const m = model();
        const rng = rngFor(3);
        for (let i = 0; i < 20; i += 1) {
            const at = m.anchorFor(m.skeleton(), byName('arrow-lane'), rng);
            expect(at).not.toBeNull();
            expect(m.laneClear(m.skeleton(), at.tx, at.ty).ok).toBe(true);
        }
    });
});

describe('the bindings place atomically and refuse illegally', () => {
    it('the skeleton is a bordered room with exactly the goal pickup in it', () => {
        const m = model();
        const record = m.skeleton();
        expect(record.entities).toHaveLength(1);
        expect(record.entities[0].type).toBe('torchpickup');
        expect(terrainAt(record, 0, 0)).toBe('wall');
        expect(terrainAt(record, 1, 1)).toBe('ground');
    });

    it('never anchors on the start or the goal cell', () => {
        const m = model();
        expect(m.isFree(m.skeleton(), m.defaults.start.tx, m.defaults.start.ty)).toBe(false);
        expect(m.isFree(m.skeleton(), m.goalCell.tx, m.goalCell.ty)).toBe(false);
    });

    it('never anchors on a cell an earlier template already painted', () => {
        const m = model();
        const once = placedAt(m, 'wall-segment-h3', { tx: 3, ty: 3 });
        expect(m.isFree(once, 3, 3)).toBe(false);
        expect(m.isFree(once, 4, 3)).toBe(false);
        expect(m.isFree(once, 6, 3)).toBe(true);
    });

    it('never anchors on a cell an earlier ENTITY template occupies', () => {
        const m = model();
        const once = placedAt(m, 'arrow-lane', { tx: 3, ty: 1 });
        expect(m.isFree(once, 3, 1)).toBe(false);
    });

    it('PLACEMENT IS PURE — the old record is untouched, which is what revert is', () => {
        const m = model();
        const before = m.skeleton();
        const json = JSON.stringify(before);
        const after = m.place(before, byName('water-pool-2x2'), { tx: 3, ty: 3 });
        expect(JSON.stringify(before)).toBe(json);
        expect(after).not.toBe(before);
        expect(Object.isFrozen(after)).toBe(true);
    });

    it('an out-of-rectangle footprint is refused by the LEVEL MODEL, by name', () => {
        const m = model();
        expect(() => m.place(m.skeleton(), byName('wall-segment-h3'), { tx: 9, ty: 5 }))
            .toThrow(ProcgenLevelError);
        // and the loop is told which error class is the model's own
        expect(m.placementError).toBe(ProcgenLevelError);
    });

    it('`anchorFor` returns null rather than looping when nothing fits', () => {
        const m = model();
        // a template whose footprint is the whole interior cannot be placed
        const huge = {
            name: 'huge', family: 'x',
            footprint: Array.from({ length: 64 }, (_, i) => ({ dx: i % 8, dy: Math.floor(i / 8) })),
            terrain: [], entities: [],
        };
        expect(m.anchorFor(m.skeleton(), huge, rngFor(5))).toBeNull();
    });
});

describe('the water template obliges the `sound` pin, by argument', () => {
    it('the oracle takes the pin union over the templates a candidate holds', () => {
        const m = model();
        const oracle = seedlingOracle({ model: m });
        expect(oracle.pinsFor([])).toEqual(['dead_frames']);
        expect(oracle.pinsFor([byName('wall-segment-h3')])).toEqual(['dead_frames']);
        expect(oracle.pinsFor([byName('water-pool-2x2')]).sort())
            .toEqual(['dead_frames', 'sound']);
        expect(oracle.pinsFor([byName('water-pool-2x2'), byName('water-pool-2x2')]))
            .toHaveLength(2);
    });

    it('only the water template declares it — the others carry no pins', () => {
        for (const t of PRE_SWORD_TEMPLATES) {
            expect(t.pins).toEqual(t.family === 'water' ? ['sound'] : []);
        }
    });
});

describe('the exclusions are a list with measurements in it', () => {
    it('names the three clearer families the kickoff asked for, each with a cause', () => {
        const names = EXCLUDED_TEMPLATES.map((x) => x.name);
        expect(names).toContain('pushable-block');
        expect(names).toContain('button-lock-pair');
        expect(names).toContain('water-bob-killlock');
        for (const x of EXCLUDED_TEMPLATES) {
            expect(typeof x.cause).toBe('string');
            expect(x.cause.length).toBeGreaterThan(0);
            expect(typeof x.measured).toBe('string');
            expect(typeof x.wouldNeed).toBe('string');
        }
    });

    it('the three MEASURED ones carry the refusal text verbatim', () => {
        const measured = EXCLUDED_TEMPLATES.filter((x) => x.refusalText !== null);
        expect(measured).toHaveLength(3);
        expect(measured.find((x) => x.name === 'pushable-block').refusalText)
            .toMatch(/came to rest on \(6,5\), not \(7,5\)/);
        expect(measured.find((x) => x.name === 'button-lock-pair').refusalText)
            .toMatch(/the sweep was blocked by lock/);
        expect(measured.find((x) => x.name === 'water-bob-killlock').refusalText)
            .toMatch(/no REACHABLE stance within 3 lattice rings/);
    });

    it('NOTHING excluded is also in the palette', () => {
        const paletteFamilies = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        for (const x of EXCLUDED_TEMPLATES) {
            expect(PRE_SWORD_TEMPLATES.some((t) => t.name === x.name)).toBe(false);
        }
        // and the excluded CLEARER families are absent from the roster entirely
        for (const family of ['shove', 'hold', 'kill', 'break', 'chaser']) {
            expect(paletteFamilies.has(family)).toBe(false);
        }
    });
});
