/**
 * procgenSeedlingDoorCut — **A DOOR IS A CUT, AND A TEMPLATE MAY CARVE A DEAD
 * END**: the two laws PROCGEN ELEMENTS arc 3 slice 2 adds to `procgenSeedling`,
 * driven on LITERAL rooms (trap 250).
 *
 * ⛔ WHY THE FIXTURES ARE HUNTED RATHER THAN DRAWN, said out loud. A Seedling
 * model builds its room from a SKELETON KIND; there is no seam through which a
 * test can hand it a hand-drawn corridor, and inventing one (a test-only
 * backend in the shared registry) would put a kind on `SEEDLING_SKELETON_KINDS`
 * that the page would then offer. So every corridor fixture below is a REAL
 * (kind, seed) whose geometry is printed as ASCII in the test and ASSERTED
 * before it is used — which is trap 250's requirement met from the other side:
 * the room is literal in the file even though it was found rather than typed,
 * and a skeleton that moved reds on the ASCII assertion rather than three
 * claims later with a confusing message.
 *
 * ⛓ THE HUNT ITSELF IS REPRODUCIBLE: `winding` seeds 1..12 and `branchy` /
 * `bushy` the same, every interior anchor of `wall-gap-spinner-killlock(span=1)`
 * in both orientations, classified by which clause refuses it. `winding` seed 1
 * carries THREE of the four corridor classes on one 10x10 room, which is why it
 * is the file's main subject.
 */
import { describe, expect, it } from 'vitest';

import {
    POST_SWORD_PALETTE, PRE_SWORD_PALETTE, ProcgenPaletteError, assertPalette,
    defineTemplate, doorGeometry, enumerateValues,
} from './procgenPalette.js';
import { seedlingModel } from './procgenSeedling.js';
import { terrainAt } from './procgenLevel.js';
import { shortestPath } from '../procgenCore/gridFlood.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const kill = (ori, span) => POST_SWORD_PALETTE.templates
    .find((t) => t.name === 'wall-gap-spinner-killlock')
    .instantiate(null, { ori, span });

const carved = (kind, seed) => seedlingModel({
    seed, skeleton: parseSkeleton(kind, { simulator: false, substrate: 'this test' }),
});

/** The room as a reader sees it — `.` walkable ground, `#` wall. */
const ascii = (record) => {
    const rows = [];
    for (let ty = 0; ty < record.height; ty += 1) {
        let row = '';
        for (let tx = 0; tx < record.width; tx += 1) {
            row += terrainAt(record, tx, ty) === 'ground' ? '.' : '#';
        }
        rows.push(row);
    }
    return rows.join('\n');
};

/**
 * ⛓⛓⛓ THE FILE'S MAIN SUBJECT — `winding` seed 1, a 1-WIDE CORRIDOR ROOM.
 *
 * ⛔ ASSERTED BEFORE IT IS USED, in full. Every claim below names cells of THIS
 * room; if the skeleton ever moves, this row reds first and says so, instead of
 * four legality claims failing with sentences about the wrong geometry.
 */
const WINDING_1 = [
    '##########',
    '#.########',
    '#.########',
    '#.....####',
    '#####.####',
    '###...####',
    '###.######',
    '###...####',
    '##########',
    '##########',
].join('\n');

describe('⛓⛓⛓ THE ROOM THESE LAWS ARE DRIVEN ON — literal, and asserted first', () => {
    it('`winding` seed 1 is the corridor room the fixtures name', () => {
        const m = carved('winding', 1);
        expect(ascii(m.skeleton())).toBe(WINDING_1);
        expect(m.defaults.start).toEqual({ tx: 1, ty: 1 });
        expect(m.goalCell).toEqual({ tx: 5, ty: 7 });
    });
});

describe('⛓⛓⛓ THE DOOR LAW ON A CORRIDOR — where `doorClear` had nothing to say', () => {
    /**
     * ⛓ THE SPAN-1 DOOR, ON THE MAIN PATH, WITH ITS NUB CARVED. The lock stands
     * at (5,4) — a corridor cell every route to the goal must cross — the player
     * fights from (5,3) and the spinner stands in a nub carved at (6,3), which
     * the skeleton left as WALL. ⛔ Before this slice the kill family was
     * NO_ANCHOR on every carved kind at every seed; this is the first legal one.
     */
    it('a span-1 door on the MAIN PATH is LEGAL, and its nub is a real CARVE', () => {
        const m = carved('winding', 1);
        const rec = m.skeleton();
        const t = kill('h', 1);
        // the geometry the claim rests on, named rather than assumed
        expect(t.doorCells).toEqual([{ dx: 0, dy: 0 }]);
        expect(t.clearance).toEqual([{ dx: 0, dy: -1 }]);
        expect(t.terrain).toEqual([{ dx: 1, dy: -1, terrain: 'ground' }]);
        // (6,3) is WALL in the skeleton, so the nub write is a CARVE and not a no-op
        expect(terrainAt(rec, 6, 3)).toBe('wall');
        expect(m.refusalAt(rec, t, 5, 4)).toBeNull();
    });

    /**
     * ⛔⛔ CLAUSE 2, AND IT IS THE CLAUSE `doorClear` COULD NOT HAVE HAD. At
     * (4,5) the lock is a cut, the footprint is free and the nub lands on
     * EXISTING ground at (3,6) — but (3,6) is on the GOAL's side of the lock, so
     * the spinner whose death opens the door is a body nobody can reach until
     * the door is already open. On the OPEN room this cannot happen (the lane
     * sits one cell back on the start's side of a full-span wall), which is why
     * the old compass rule never needed the question.
     */
    it('⛔ the NUB ON THE GOAL SIDE is refused by clause 2, by name', () => {
        const m = carved('winding', 1);
        const rec = m.skeleton();
        const why = m.refusalAt(rec, kill('v', 1), 4, 5);
        expect(why).toMatch(/declares a door at \(4,5\)/);
        expect(why).toMatch(/its CLEARER cell \(3,6\) is on the GOAL side of it/);
        expect(why).toMatch(/unreachable from the START \(1,1\) once the door cell\(s\) are walled/);
        expect(why).toMatch(/a body nobody can reach until the door it guards is already open/);
    });

    /**
     * ⛓ A CORRIDOR CELL THAT IS NOT A BRIDGE. `winding` seed 2's (7,6) sits on a
     * stub the goal route does not need, so walling it leaves the goal reachable
     * and the lock gates nothing.
     */
    it('a span-1 door OFF the route is NOT A CUT — the same sentence as a short wall', () => {
        const m = carved('winding', 2);
        const why = m.refusalAt(m.skeleton(), kill('h', 1), 7, 6);
        expect(why).toMatch(/declares a door, and it is NOT A CUT/);
        expect(why).toMatch(/is STILL reachable from the START/);
        expect(why).toMatch(/DECORATION rather than a door/);
    });
});

describe('⛓⛓⛓ THE DOOR LAW ON THE OPEN ROOM — the span law, re-derived', () => {
    const open = () => seedlingModel({ seed: 6 });

    it('a FULL-SPAN wall with the goal BEYOND it is legal — and at exactly one anchor', () => {
        const m = open();
        const rec = m.skeleton();
        expect(m.goalCell).toEqual({ tx: 3, ty: 1 });
        const legal = m.interiorCells(rec)
            .filter((c) => m.legalAt(rec, kill('v', 8), c.tx, c.ty));
        expect(legal).toEqual([{ tx: 2, ty: 1 }]);
    });

    it('⛔ the goal on the START\'s side is DECORATION — `doorClear`\'s own case', () => {
        const m = open();
        const why = m.refusalAt(m.skeleton(), kill('h', 8), 1, 4);
        expect(why).toMatch(/it is NOT A CUT/);
        expect(why).toMatch(/with its door cell\(s\) \(5,4\) walled/);
        expect(why).toMatch(/the GOAL \(3,1\) is STILL reachable from the START \(1,1\)/);
        // ⛓ the kill family's own consequence, carried over from `doorClear`
        expect(why).toMatch(/RUN ABORT/);
    });

    /**
     * ⛓⛓⛓ **THE SPAN LAW, RE-DERIVED BY THE FLOOD.** GENERATE-UI ruling 3 said
     * *a shorter wall is decoration*; ⚖ design ruling 17 says *a non-cut is
     * decoration*. On the open room they are the same statement, and this row is
     * the half a reader can check by eye: a span-4 wall cuts NOTHING, anywhere.
     */
    it('⛔ a SHORT wall is refused at EVERY anchor of the open room — not one cut', () => {
        const m = open();
        const rec = m.skeleton();
        /**
         * ⛓ THE SUBJECT IS A BARE DOOR ROW RATHER THAN THE TEMPLATE, and that is
         * the measurement talking: span 4 is NOT in the kill family's shipped
         * domain (`{1, 8}`), so `instantiate` REFUSES it BY NAME — every value
         * in a domain is one a sweep measured. The claim here is about the LAW,
         * not about that template, so it is asked of the geometry directly.
         */
        const g = doorGeometry('v', 4, 0);
        const short = {
            name: 'short-wall', instance: 'short-wall(span=4)', family: 'probe',
            door: 'v', doorCells: [g.doorCell], clearer: [],
            footprint: g.cells, clearance: [], terrain: g.wall, entities: [],
        };
        const legal = m.interiorCells(rec)
            .filter((c) => m.legalAt(rec, short, c.tx, c.ty));
        expect(legal).toEqual([]);
        expect(m.refusalAt(rec, short, 2, 1)).toMatch(/it is NOT A CUT/);
        // ⛔ and the DOMAIN really does refuse the value, so the row above is
        // testing the law rather than routing round a template that would work.
        expect(() => kill('v', 4)).toThrow(/not in its declared domain \[1, 8\]/);
    });
});

/**
 * ⛓ A SINGLE-CELL GROUND WRITER, so the carve rule can be driven without the
 * kill family's lock, spinner and tag riding along. ⛔ It is NOT in any palette:
 * `refusalAt` and `place` take a row, and a probe that never reaches a roster
 * cannot move a level from any seed.
 */
const PROBE = Object.freeze({
    name: 'carve-probe',
    instance: 'carve-probe',
    family: 'probe',
    footprint: Object.freeze([{ dx: 0, dy: 0 }]),
    clearance: Object.freeze([]),
    terrain: Object.freeze([{ dx: 0, dy: 0, terrain: 'ground' }]),
    entities: Object.freeze([]),
});

describe('⛓⛓⛓ THE CARVE RULE — one blob, one mouth, no shortcut', () => {
    it('a one-cell pocket with ONE mouth is legal; the room offers 16 of them', () => {
        const m = carved('winding', 1);
        const rec = m.skeleton();
        const legal = m.interiorCells(rec)
            .filter((c) => terrainAt(rec, c.tx, c.ty) === 'wall'
                && m.legalAt(rec, PROBE, c.tx, c.ty))
            .map((c) => `${c.tx},${c.ty}`);
        expect(legal).toEqual(['2,1', '3,2', '4,2', '5,2', '6,3', '1,4', '2,4', '6,4',
            '2,5', '6,5', '2,6', '2,7', '6,7', '3,8', '4,8', '5,8']);
    });

    /**
     * ⛔⛔⛔ **THE TUNNEL, AND IT IS THE ROW THE NO-SHORTCUT CLAUSE CANNOT SEE.**
     *
     * The span-1 kill lock at (1,3) would carve (2,2), whose neighbours (2,3)
     * and (1,2) are BOTH walkable — a tunnel joining two arms of the corridor.
     * ⛓ AND THE START->GOAL PATH IS EXACTLY AS LONG AFTER AS BEFORE: 14 steps
     * either way, asserted below with the flood itself. So clause (b) is INERT
     * here and only the DEAD-END clause (a) refuses it — which is what makes
     * this fixture a pure subject for clause (a) rather than one that would pass
     * on a build with (a) deleted.
     */
    it('⛔ a carve that JOINS TWO CORRIDORS is refused as a 2-MOUTH pocket…', () => {
        const m = carved('winding', 1);
        const why = m.refusalAt(m.skeleton(), kill('h', 1), 1, 3);
        expect(why).toMatch(/its CARVE \(\(2,2\)\) has 2 MOUTH\(S\) — \(2,3\) \(1,2\)/);
        expect(why).toMatch(/a template may carve only a DEAD END/);
        expect(why).toMatch(/A pocket with two mouths is a TUNNEL/);
    });

    it('…and the NO-SHORTCUT clause is INERT against it — the path is 14 either way', () => {
        const m = carved('winding', 1);
        const rec = m.skeleton();
        const walk = (x, y) => terrainAt(rec, x, y) === 'ground';
        const opened = (x, y) => ((x === 2 && y === 2) ? true : walk(x, y));
        const from = { x: 1, y: 1 };
        const to = { x: m.goalCell.tx, y: m.goalCell.ty };
        const before = shortestPath(rec.width, rec.height, walk, from, to);
        const after = shortestPath(rec.width, rec.height, opened, from, to);
        expect(before.length - 1).toBe(14);
        expect(after.length - 1).toBe(14);
    });

    it('⛔ a pocket with NO mouth is floor nothing can walk to', () => {
        const m = carved('winding', 1);
        const why = m.refusalAt(m.skeleton(), PROBE, 3, 1);
        expect(why).toMatch(/its CARVE \(\(3,1\)\) has 0 MOUTH\(S\)/);
        expect(why).toMatch(/A pocket with no mouth is floor nothing can walk to/);
    });

    /**
     * ⛓⛓ UNTOUCHED **SKELETON** TERRAIN, and this is the case an "is it wall?"
     * test would let straight through: after the probe carves (2,1) the cell
     * holds `ground`, so a second carver asking "is it wall?" would see "no,
     * it is floor" and take it. The rule compares against `base` — the skeleton
     * — so it sees that an earlier template put the floor there.
     */
    it('⛔ a carve over ANOTHER TEMPLATE\'S carve is refused — against `base`, not the record', () => {
        const m = carved('winding', 1);
        const rec = m.skeleton();
        expect(terrainAt(rec, 2, 1)).toBe('wall');
        const placed = m.place(rec, PROBE, { tx: 2, ty: 1 });
        expect(terrainAt(placed, 2, 1)).toBe('ground');
        const why = m.refusalAt(placed, PROBE, 2, 1);
        expect(why).toMatch(/holds "ground" where the SKELETON left "wall"/);
        expect(why).toMatch(/a carve is legal only on UNTOUCHED SKELETON TERRAIN/);
        expect(why).toMatch(/Including another template's CARVE/);
    });

    /**
     * ⛓ THE RING, THROUGH THE NUB. The lock at (8,2) of the open room is a cell
     * a template may have; its NUB would be (9,1), which is the border. ⛔ The
     * carve's own interior sentence fires, not the plain one — a carve that
     * opened the ring would open the room.
     */
    it('⛔ a carve into the BORDER RING is refused with the carve\'s own sentence', () => {
        const m = seedlingModel({ seed: 6 });
        const why = m.refusalAt(m.skeleton(), kill('h', 1), 8, 2);
        expect(why).toMatch(/needs FOOTPRINT cell \(9,1\) is not in the room's INTERIOR/);
        expect(why).toMatch(/⛔ A CARVE may not open the ring/);
    });
});

describe('⛔ `refusalAt`\'s ORDER — a row that fails TWO rules gets the EARLIER sentence', () => {
    /**
     * ⛓⛓ THE SUBJECT IS A CELL THAT FAILS **BOTH** RULES, which is the only kind
     * of cell an ORDER claim can be made on — a cell only one rule refuses would
     * pass under either order. `winding` seed 2's (6,5) with `ori='v'`: the nub
     * it would carve has TWO mouths, AND walling the lock cell leaves the goal
     * reachable. ⛔ The CARVE is asked first, so the reader hears about the
     * pocket they drew rather than about the room's connectivity.
     *
     * ⛓ The second half is driven through a BARE door row at the same cell — the
     * same geometry with the nub removed — because that is the only way to ask
     * the door law about a cell whose carve refuses first. (Deleting the
     * template's `terrain` does NOT work and the attempt is worth recording: it
     * turns the nub into an ordinary footprint cell, which then wants untouched
     * *ground* and refuses for a third, unrelated reason.)
     */
    it('the CARVE rule is asked before the DOOR law', () => {
        const m = carved('winding', 2);
        const rec = m.skeleton();
        const why = m.refusalAt(rec, kill('v', 1), 6, 5);
        expect(why).toMatch(/2 MOUTH\(S\)/);
        expect(why).not.toMatch(/NOT A CUT/);
        // …and the door law really WOULD have refused the same cell, so the
        // ORDER is what decides the sentence rather than one rule ever applying.
        const g = doorGeometry('v', 1, 0);
        const bareDoor = {
            name: 'bare-door', instance: 'bare-door', family: 'probe',
            door: 'v', doorCells: [g.doorCell], clearer: [],
            footprint: g.cells, clearance: [], terrain: g.wall, entities: [],
        };
        expect(m.refusalAt(rec, bareDoor, 6, 5)).toMatch(/it is NOT A CUT/);
    });

    it('the FOOTPRINT walk is asked before the CARVE rule', () => {
        const m = seedlingModel({ seed: 6 });
        // (9,1) is off the interior AND the pocket it would make is unadjudicable
        expect(m.refusalAt(m.skeleton(), kill('h', 1), 8, 2))
            .toMatch(/is not in the room's INTERIOR/);
    });
});

describe('⛓⛓ `assertPalette` REFUSES EVERY SILENT MIS-DECLARATION OF A DOOR', () => {
    const paletteOf = (build) => ({
        name: 'probe',
        items: PRE_SWORD_PALETTE.items,
        templates: [defineTemplate({
            name: 'probe-door', family: 'shove', why: 'a probe', build,
        })],
        excluded: [],
    });

    it('⛔ a DOOR CELL THAT WRITES WALL — the law\'s open half could never hold', () => {
        expect(() => assertPalette(paletteOf(() => ({
            door: 'h',
            doorCells: [{ dx: 0, dy: 0 }],
            clearer: [],
            footprint: [{ dx: 0, dy: 0 }],
            terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
            entities: [],
        })))).toThrow(/names DOOR cell \(0,0\) and also WRITES it as blocking terrain/);
    });

    it('⛔ `door` with NO `doorCells` would refuse at every anchor', () => {
        expect(() => assertPalette(paletteOf(() => ({
            door: 'h',
            clearer: [],
            footprint: [{ dx: 0, dy: 0 }],
            terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
            entities: [],
        })))).toThrow(/declares door "h" and no `doorCells`/);
    });

    it('⛔ `doorCells` with NO `door` is a description nobody reads', () => {
        expect(() => assertPalette(paletteOf(() => ({
            doorCells: [{ dx: 0, dy: 0 }],
            footprint: [{ dx: 0, dy: 0 }],
            terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
            entities: [],
        })))).toThrow(/declares `doorCells` but no `door`/);
    });

    it('⛔ a CLEARER outside footprint ∪ clearance is a cell nobody reserved', () => {
        expect(() => assertPalette(paletteOf(() => ({
            door: 'h',
            doorCells: [{ dx: 0, dy: 0 }],
            clearer: [{ dx: 5, dy: 5 }],
            footprint: [{ dx: 0, dy: 0 }],
            terrain: [],
            entities: [],
        })))).toThrow(/names CLEARER cell \(5,5\), which is in neither its footprint nor its `clearance`/);
    });

    it('⛔ and a `clearer` that is not an ARRAY cannot be told from "nothing to reach"', () => {
        expect(() => assertPalette(paletteOf(() => ({
            door: 'h',
            doorCells: [{ dx: 0, dy: 0 }],
            footprint: [{ dx: 0, dy: 0 }],
            terrain: [],
            entities: [],
        })))).toThrow(ProcgenPaletteError);
    });
});

describe('⛓⛓ `doorGeometry` — the ONE door shape, and its degenerate case', () => {
    it('span 1 writes NO WALL AT ALL — on a corridor the lock cell IS the door', () => {
        const g = doorGeometry('h', 1, 0);
        expect(g.cells).toEqual([{ dx: 0, dy: 0 }]);
        expect(g.doorCell).toEqual({ dx: 0, dy: 0 });
        expect(g.wall).toEqual([]);
    });

    it('the gap is a cell OF the wall — anything else refuses BY NAME', () => {
        expect(() => doorGeometry('h', 3, 3)).toThrow(/the gap is a cell OF the wall, so it is 0..2/);
        expect(() => doorGeometry('h', 0, 0)).toThrow(/an integer span >= 1/);
    });

    it('⛓ the transpose is the SAME door — `v` is `h` with the axes swapped', () => {
        const h = doorGeometry('h', 4, 1);
        const v = doorGeometry('v', 4, 1);
        expect(v.cells).toEqual(h.cells.map((c) => ({ dx: c.dy, dy: c.dx })));
        expect(v.doorCell).toEqual({ dx: h.doorCell.dy, dy: h.doorCell.dx });
    });
});

describe('⛓⛓⛓ THE `span` DOMAIN — measured, and a ONE-VALUE domain is a CONSTANT', () => {
    /**
     * ⛔⛔ ⚖ D2's RULE, ASSERTED BY READING `params` RATHER THAN BY BELIEVING A
     * DOCBLOCK. A one-value `rng.pick` still SPENDS A DRAW, so a parameter whose
     * measured domain came back with one member would move every seed's level
     * for nothing. The two families whose measured domain is `{8}` therefore
     * keep `INTERIOR_SPAN` as a constant and declare NO `span` at all — and this
     * row is what stops a later slice from "tidying" that into a domain.
     */
    it('`wall-gap-block` and `wall-gap-lock-weigh` declare NO `span` — their domain is one value', () => {
        for (const name of ['wall-gap-block', 'wall-gap-lock-weigh']) {
            const base = PRE_SWORD_PALETTE.templates.find((t) => t.name === name);
            expect(base.params.map((p) => p.key)).not.toContain('span');
        }
    });

    it('`wall-gap-spinner-killlock` declares a MULTI-VALUE `span`, so it is a real parameter', () => {
        const base = POST_SWORD_PALETTE.templates
            .find((t) => t.name === 'wall-gap-spinner-killlock');
        const span = base.params.find((p) => p.key === 'span');
        expect(span).toBeTruthy();
        expect(span.domain.length).toBeGreaterThan(1);
        // ⛔ every declared value is one the sweep measured — the domain and the
        // `why` are read together so a value added without a measurement shows.
        expect(span.why).toMatch(/measured/i);
        expect(span.domain).toContain(1);
        expect(span.domain).toContain(8);
    });

    /**
     * ⛓⛓⛓ **THE BYTE-IDENTITY OF THE DEFAULT INSTANCE, AS A CAPTURED LITERAL.**
     * `span = 8` must be `c4ca4ed40`'s row exactly — the geometry, the offsets
     * and the entity attributes — or every post-sword level that keeps a kill
     * lock at the default has silently moved. ⛔ Written out rather than
     * compared against `INTERIOR_SPAN`/`GAP_OFFSET`/`SPINNER_OFFSET`: trap 305 —
     * a row phrased against the named constant cannot see that constant change.
     */
    it('⛔ span 8 IS the pre-slice row, byte for byte — a captured literal', () => {
        const t = kill('h', 8);
        expect(t.door).toBe('h');
        expect(t.footprint).toEqual([
            { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 },
            { dx: 4, dy: 0 }, { dx: 5, dy: 0 }, { dx: 6, dy: 0 }, { dx: 7, dy: 0 },
            { dx: 6, dy: -1 },
        ]);
        expect(t.terrain).toEqual([
            { dx: 0, dy: 0, terrain: 'wall' }, { dx: 1, dy: 0, terrain: 'wall' },
            { dx: 2, dy: 0, terrain: 'wall' }, { dx: 3, dy: 0, terrain: 'wall' },
            { dx: 5, dy: 0, terrain: 'wall' }, { dx: 6, dy: 0, terrain: 'wall' },
            { dx: 7, dy: 0, terrain: 'wall' },
        ]);
        expect(t.clearance).toEqual([]);
        expect(t.doorCells).toEqual([{ dx: 4, dy: 0 }]);
        expect(t.clearer).toEqual([{ dx: 6, dy: -1 }]);
        expect(t.entities.map((e) => [e.type, e.dx, e.dy, e.attrs.tset ?? null]))
            .toEqual([['lock', 4, 0, '-1'], ['spinner', 6, -1, null]]);
    });

    it('every declared (ori, span) instantiation is well-formed — the load-time check covers them', () => {
        const base = POST_SWORD_PALETTE.templates
            .find((t) => t.name === 'wall-gap-spinner-killlock');
        const rows = enumerateValues(base).map((v) => base.instantiate(null, v));
        expect(rows.length).toBe(base.params[0].domain.length * base.params[1].domain.length);
        for (const t of rows) {
            const fp = new Set(t.footprint.map((c) => `${c.dx},${c.dy}`));
            for (const c of t.doorCells) expect(fp.has(`${c.dx},${c.dy}`)).toBe(true);
            for (const e of t.entities) expect(fp.has(`${e.dx},${e.dy}`)).toBe(true);
        }
    });
});

describe('⛓⛓ THE DOOR CENSUS\'S OWN COUNTS, re-derived through the model', () => {
    /**
     * ⛔ `census-seedling-doors.mjs` is a SCRIPT (top-level await, writes to
     * stdout) and cannot be imported here, so this row re-derives two of its
     * cells through the same surface the census uses — `model.refusalAt` on a
     * BARE door row from `doorGeometry`. A census whose numbers drifted from the
     * model would show up as a disagreement here.
     */
    const bare = (ori, span, gap) => {
        const g = doorGeometry(ori, span, gap);
        return {
            name: 'census-door',
            instance: `census-door(ori=${ori},span=${span},gap=${gap})`,
            family: 'census',
            door: ori,
            doorCells: [g.doorCell],
            clearer: [],
            footprint: g.cells,
            clearance: [],
            terrain: g.wall,
            entities: [],
        };
    };
    const count = (model, row) => {
        const rec = model.skeleton();
        return model.interiorCells(rec)
            .filter((c) => model.refusalAt(rec, row, c.tx, c.ty) === null).length;
    };

    /**
     * ⚠ THE ORIENTATION IS PART OF THE SUBJECT, and getting it wrong is how this
     * row was first written: seed 6's goal sits at (3,**1**), the top row, so NO
     * horizontal wall can have the goal beyond it and `ori='h'` reads zero at
     * EVERY span — including 8, for a reason that has nothing to do with the
     * census's claim. `ori='v'` is the arm that discriminates here.
     */
    it('⛔ the OPEN room cuts at span 8 and at NO shorter span — the census\'s headline', () => {
        const m = seedlingModel({ seed: 6 });
        expect(count(m, bare('v', 8, 0))).toBe(1);
        for (let span = 1; span <= 7; span += 1) {
            expect({ span, cuts: count(m, bare('v', span, 0)) }).toEqual({ span, cuts: 0 });
        }
        // ⛓ and the h arm reads zero everywhere for its own reason — named so a
        // reader does not take it for a second confirmation of the same claim.
        expect(count(m, bare('h', 8, 4))).toBe(0);
        expect(m.goalCell.ty).toBe(1);
    });

    it('⛓ and the CORRIDOR is the other way round — span 1 cuts, span 8 does not', () => {
        const m = carved('winding', 1);
        expect(count(m, bare('h', 1, 0))).toBeGreaterThan(0);
        expect(count(m, bare('h', 8, 4))).toBe(0);
    });
});
