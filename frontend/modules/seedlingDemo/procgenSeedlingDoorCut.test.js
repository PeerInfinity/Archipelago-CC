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
    PRE_SWORD_PALETTE, ProcgenPaletteError, assertPalette, defineTemplate, doorGeometry,
} from './procgenPalette.js';
import { seedlingModel } from './procgenSeedling.js';
import { terrainAt } from './procgenLevel.js';
import { shortestPath } from '../procgenCore/gridFlood.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

/**
 * ⛓⛓⛓ **THE KILL-LOCK SHAPE, AS A FIXTURE** — PROCGEN ELEMENTS arc 3, slice 4c.
 *
 * Every door-LAW row below used to take its subject from the ROSTER
 * (`wall-gap-spinner-killlock`), and ⚖ the user retired all three door TEMPLATES
 * into the room-aware ELEMENTS. ⛔ The LAW did not retire with them — it is
 * `procgenSeedling`'s, it is asked of every `on-connector` element placement by
 * the SAME binding (arc-3 §12's D1: *one law, both callers*), and it is what
 * these rows exist to drive.
 *
 * So the subject is rebuilt here, byte for byte as the template built it, from
 * `doorGeometry` — the function that stayed exported for exactly this and for
 * `census-seedling-doors.mjs`. The two forms are the two the law has always had
 * to handle, and they are the two the `killgate` ELEMENT now GROWS:
 *
 *   `span = 1`  the CORRIDOR form: no wall at all, the lock cell IS the door,
 *               and the spinner stands in a one-cell NUB the row CARVES. The
 *               element grows 0 wall cells on a corridor — the same geometry
 *               with the room asked instead of a parameter drawn.
 *   `span = 8`  the OPEN-ROOM form: a full-interior wall with the gap at 4 and
 *               the spinner at 6, one cell back on the start's side. The element
 *               grows 7 cells on the open 10x10 room, which is this wall.
 *
 * ⛔ NOT A HAND-DRAWN LITERAL: a fixture that painted its own wall would drive
 * the law on a door nothing in the pipeline can produce, which is the same
 * argument that keeps `doorGeometry` alive (see its docblock).
 */
const at = (ori, along, across) => (ori === 'h'
    ? { dx: along, dy: across } : { dx: across, dy: along });

const kill = (ori, span) => {
    if (span === 1) {
        const door = at(ori, 0, 0);
        const nub = at(ori, 1, -1);
        return {
            name: 'kill-shape',
            instance: `kill-shape(ori=${ori},span=1)`,
            family: 'probe',
            door: ori,
            doorCells: [door],
            clearer: [nub],
            footprint: [door, nub],
            clearance: [at(ori, 0, -1)],
            terrain: [{ ...nub, terrain: 'ground' }],
            entities: [],
        };
    }
    const g = doorGeometry(ori, span, Math.min(4, span - 1));
    const spin = at(ori, Math.min(6, span - 1), -1);
    return {
        name: 'kill-shape',
        instance: `kill-shape(ori=${ori},span=${span})`,
        family: 'probe',
        door: ori,
        doorCells: [g.doorCell],
        clearer: [spin],
        footprint: [...g.cells, spin],
        clearance: [],
        terrain: g.wall,
        entities: [],
    };
};

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
    '###....###',
    '##########',
    '##########',
].join('\n');

describe('⛓⛓⛓ THE ROOM THESE LAWS ARE DRIVEN ON — literal, and asserted first', () => {
    it('`winding` seed 1 is the corridor room the fixtures name', () => {
        const m = carved('winding', 1);
        expect(ascii(m.skeleton())).toBe(WINDING_1);
        expect(m.defaults.start).toEqual({ tx: 1, ty: 1 });
        // ⛓ SLICE 4c: (5,7) -> (6,7). The goal draw's `manhattan >= 3` rule
        // narrowed the candidate list and moved 34 of 40 seeds' goals; this
        // room's own corridor moved one cell with it (row 7, above).
        expect(m.goalCell).toEqual({ tx: 6, ty: 7 });
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
        /**
         * ⛓⛓ RE-PICKED AT SLICE 4c BY ITS OWN SCAN (trap 285). The subject was
         * `winding` seed 2's (7,6) — a stub the goal route did not need. The
         * GOAL DRAW moved seed 2's goal to (6,5) and that cell is now refused by
         * CLAUSE 2 instead (its nub lands on the goal's side), which is a
         * different sentence and would have made this row assert the wrong law.
         *
         * RE-SCANNED for a span-1 cell whose refusal is NOT-A-CUT, over
         * `winding`/`branchy`/`bushy` seeds 1..6, both orientations: **`winding`
         * offers NONE at any of its six seeds** — its corridors are thin enough
         * that nearly every ground cell is a bridge — and `branchy` seed 1
         * offers SEVEN at `ori=h` (7,2 · 7,3 · 1,4 · 7,4 · 7,5 · 7,6 · 7,7).
         * **(7,2) is taken**, the first of them.
         */
        const m = carved('branchy', 1);
        const why = m.refusalAt(m.skeleton(), kill('h', 1), 7, 2);
        expect(why).toMatch(/declares a door, and it is NOT A CUT/);
        expect(why).toMatch(/is STILL reachable from the START/);
        expect(why).toMatch(/DECORATION rather than a door/);
    });
});

describe('⛓⛓⛓ THE DOOR LAW ON THE OPEN ROOM — the span law, re-derived', () => {
    const open = () => seedlingModel({ seed: 6 });

    /**
     * ⛓⛓ RE-MEASURED AT SLICE 4c. Seed 6's goal moved from (3,1) to **(5,1)**
     * (the `manhattan >= 3` rule), so the columns with the goal BEYOND them are
     * now 2, 3 and 4 rather than 2 alone. ⛔ The claim is unchanged and the
     * count follows the measurement: the legal set is exactly the columns
     * strictly left of the goal whose footprint fits.
     */
    it('a FULL-SPAN wall with the goal BEYOND it is legal — and at exactly three anchors', () => {
        const m = open();
        const rec = m.skeleton();
        expect(m.goalCell).toEqual({ tx: 5, ty: 1 });
        const legal = m.interiorCells(rec)
            .filter((c) => m.legalAt(rec, kill('v', 8), c.tx, c.ty));
        expect(legal).toEqual([{ tx: 2, ty: 1 }, { tx: 3, ty: 1 }, { tx: 4, ty: 1 }]);
        // ⛔ and every one of them really is left of the goal — the property the
        // count is a consequence of, said so the number is not the whole claim.
        for (const c of legal) expect(c.tx).toBeLessThan(m.goalCell.tx);
    });

    it('⛔ the goal on the START\'s side is DECORATION — `doorClear`\'s own case', () => {
        const m = open();
        const why = m.refusalAt(m.skeleton(), kill('h', 8), 1, 4);
        expect(why).toMatch(/it is NOT A CUT/);
        expect(why).toMatch(/with its door cell\(s\) \(5,4\) walled/);
        expect(why).toMatch(/the GOAL \(5,1\) is STILL reachable from the START \(1,1\)/);
        // ⛓ the KILL GATE's own consequence, carried over from `doorClear` and
        // re-worded at slice 4c when the FAMILY it named left the palette.
        expect(why).toMatch(/for a KILL GATE that is a RUN ABORT/);
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
        /**
         * ⛓⛓ THE OLD THIRD ASSERTION WAS ABOUT A DOMAIN, AND THE DOMAIN
         * RETIRED WITH ITS TEMPLATE (slice 4c). It read
         * `expect(() => kill('v', 4)).toThrow(/not in its declared domain/)` —
         * the shipped `span` domain was `{1, 8}` and refused 4 by name, so the
         * row could say it was testing the LAW rather than routing round a
         * template that would have worked. ⛔ REPLACED BY THE SENTENCE THAT
         * SURVIVES (trap 312): the room-aware element does not DRAW a span at
         * all — it GROWS its wall to the room, 0 cells on a corridor and 7 on
         * this one — so a span-4 wall is not a run anything in the pipeline can
         * ask for, and this row's `short` fixture is the only way to state the
         * law about one. That is asserted where it can fail: the two spans the
         * ELEMENT produces both cut, and the middle one does not.
         */
        expect(m.interiorCells(rec).some((c) => m.legalAt(rec, kill('v', 8), c.tx, c.ty)))
            .toBe(true);
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
    it('a one-cell pocket with ONE mouth is legal; the room offers 18 of them', () => {
        const m = carved('winding', 1);
        const rec = m.skeleton();
        const legal = m.interiorCells(rec)
            .filter((c) => terrainAt(rec, c.tx, c.ty) === 'wall'
                && m.legalAt(rec, PROBE, c.tx, c.ty))
            .map((c) => `${c.tx},${c.ty}`);
        // ⛓ SLICE 4c: 16 -> 18. The goal draw moved this room's last corridor
        // row, so two more wall cells became one-mouth pockets. ⛔ The LIST is
        // asserted rather than the count, so a change that swapped one pocket
        // for another could not hide behind the total.
        expect(legal).toEqual(['2,1', '3,2', '4,2', '5,2', '6,3', '1,4', '2,4', '6,4',
            '2,5', '6,5', '2,6', '6,6', '2,7', '7,7', '3,8', '4,8', '5,8', '6,8']);
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

    it('…and the NO-SHORTCUT clause is INERT against it — the path is 15 either way', () => {
        const m = carved('winding', 1);
        const rec = m.skeleton();
        const walk = (x, y) => terrainAt(rec, x, y) === 'ground';
        const opened = (x, y) => ((x === 2 && y === 2) ? true : walk(x, y));
        const from = { x: 1, y: 1 };
        const to = { x: m.goalCell.tx, y: m.goalCell.ty };
        const before = shortestPath(rec.width, rec.height, walk, from, to);
        const after = shortestPath(rec.width, rec.height, opened, from, to);
        // ⛓ SLICE 4c: 14 -> 15 steps, because the goal moved one cell along the
        // corridor. ⛔ The CLAIM is that the two are EQUAL — the clause is inert
        // — and that is what makes the number a detail rather than the point.
        expect(before.length - 1).toBe(15);
        expect(after.length - 1).toBe(15);
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
        /**
         * ⛓⛓ RE-PICKED AT SLICE 4c BY ITS OWN RULE (trap 285). The subject was
         * `winding` seed 2's (6,5) with `ori='v'`; the GOAL DRAW put seed 2's
         * GOAL on that very cell, so it now refuses with the goal-cell sentence
         * and the row would have been asserting about the footprint walk.
         *
         * RE-SCANNED for a cell that fails BOTH rules — a 2-MOUTH carve AND a
         * door the flood says is not a cut — over `winding`/`branchy`/`bushy`
         * seeds 1..3, both orientations: **eleven qualify**, all on `branchy`
         * and `bushy` (`winding`'s 2-mouth cells are all real cuts). **`branchy`
         * seed 1's (4,1) at `ori='v'` is taken**, the first of them.
         */
        const m = carved('branchy', 1);
        const rec = m.skeleton();
        const why = m.refusalAt(rec, kill('v', 1), 4, 1);
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
        expect(m.refusalAt(rec, bareDoor, 4, 1)).toMatch(/it is NOT A CUT/);
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

/**
 * ⛓⛓⛓ **THE `span` DOMAIN BLOCK RETIRED WITH ITS TEMPLATES** — arc 3, slice 4c.
 * Four rows stood here and every one of them was a claim about a ROSTER ROW:
 *
 *  · *"`wall-gap-block` and `wall-gap-lock-weigh` declare NO `span` — their
 *    domain is one value"* (⚖ D2's rule: a one-value `rng.pick` still SPENDS a
 *    draw, so a measured domain of one member stays a CONSTANT);
 *  · *"`wall-gap-spinner-killlock` declares a MULTI-VALUE `span`, so it is a
 *    real parameter"*;
 *  · *"⛔ span 8 IS the pre-slice row, byte for byte — a captured literal"*;
 *  · *"every declared (ori, span) instantiation is well-formed"*.
 *
 * ⛔ THE RULE THEY ENFORCED IS NOT GONE — it is `templateContract`'s, it is
 * asserted at load by `assertParamSchema`, and `procgenPalette.test.js` drives
 * it on the rows that remain. What went is its SUBJECT.
 *
 * ⛓⛓ AND THE MEASUREMENT THAT SIZED THE DOMAIN IS WHAT RETIRED IT, which is
 * worth stating once here because it is the arc's own argument in miniature:
 * `span`'s domain was `{1, 8}` — TWO VALUES FOR TWO ROOMS — and the price was
 * published at the time (*"half this family's `empty` draws are now NO_ANCHOR
 * by construction"*, §9.11). A room-aware element asks the ROOM instead: 0 wall
 * cells on a corridor, 7 on the open room, a chamber's walls in a chamber, and
 * NO parameter at all. The domain was a proxy for a measurement the room can
 * make itself. Both numbers are preserved on the `wall-gap-spinner-killlock`
 * exclusion row and in the arc-3 kickoff §13.6.
 */


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
        // ⛓ SLICE 4c: THREE cutting anchors rather than one, and for a reason
        // that is not about the census — the GOAL DRAW moved seed 6's goal from
        // (3,1) to (5,1), so three columns have it beyond them instead of one.
        // ⛔ The HEADLINE is unchanged and is the shape of the row, not the
        // number: span 8 cuts and NO shorter span does.
        expect(count(m, bare('v', 8, 0))).toBe(3);
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
