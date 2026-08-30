/**
 * seedlingDemo/procgenLedgerCarried — **THE FOUR INTERMEDIATE RESULTS SLICE 5a
 * PRICED AND DID NOT CARRY, NOW CARRIED** (PROCGEN ELEMENTS arc 3, slice 5b).
 *
 * §16.5 listed five *"paint the flood"* items with the price of each. Four are
 * here: the door law's two floods, the level-n floods and the goal's vestibule,
 * the ON-CONNECTOR candidate set, and the certification's ROUTE. The fifth
 * (pass-2 per-anchor refusals) stays `out.trace` and is not duplicated.
 *
 * ⛔⛔ **THE CLAIM THESE ROWS EXIST FOR IS "CARRIED, NOT RE-DERIVED".** A
 * paintable that agreed with a second computation of the same thing would prove
 * nothing about where its numbers came from; each row below ties a paintable to
 * a number the phase ALREADY published for its own purposes (`cost.candidates`,
 * `elements.placed[0]`, the trace's own rows).
 */

import { describe, expect, it } from 'vitest';

import { certificationRouteCells, corridorTilesOf } from './procgenSeedlingElements.js';
import { seedlingModel } from './procgenSeedling.js';

/**
 * ⚠ THE SUBJECT IS MEASURED, NOT PICKED: seeds 1, 2 and 3 all PLACE a kill gate
 * through `seedlingModel` (a BARE room — the item gate and the certification are
 * the SEAM's, trap 383), with funnels 10/9/8, 8/7/6 and 7/6/5. Seed 2 is taken
 * because it is the phases row's own subject and a shared subject is one fewer
 * thing to keep in step.
 */
const SUBJECT_SEED = 2;

const rowNamed = (model, name) => model.ledger.filter((r) => r.phase === name).at(-1);
const factNamed = (row, id) => (row?.data.facts ?? []).find((f) => f.id === id) ?? null;
const key = (c) => `${c.x},${c.y}`;

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ D3 — THE ON-CONNECTOR CANDIDATE FUNNEL
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ the ON-CONNECTOR row carries the candidate funnel', () => {
    const model = seedlingModel({ seed: SUBJECT_SEED, elements: { name: 'killgate' } });
    const row = rowNamed(model, 'on-connector');

    it('the element PLACED, so there is a funnel to describe', () => {
        expect(row).toBeTruthy();
        expect(row.refusal).toBeNull();
    });

    it('⛓⛓⛓ the LEGAL set is exactly the set the element\'s ONE draw picked from', () => {
        const legal = factNamed(row, 'door-candidates-legal');
        expect(legal).toBeTruthy();
        expect(legal.cells.length).toBe(row.data.candidates);
    });

    it('⛔ …and the PICK is one of them — the draw is a choice among equals', () => {
        const legal = factNamed(row, 'door-candidates-legal');
        expect(legal.cells.map(key)).toContain(key(legal.pick));
        expect(legal.pick).toEqual(row.data.doorCell);
    });

    /** ⛓ THE FUNNEL NARROWS, WHICH IS THE WHOLE POINT OF THREE LINES RATHER THAN
     *  ONE: what the room OFFERED ⊇ what reached the LAW ⊇ what PASSED it. */
    it('⛓⛓ offered ⊇ tried ⊇ legal, all three carried from the construct', () => {
        const offered = new Set(factNamed(row, 'door-candidates-offered').cells.map(key));
        const tried = new Set(factNamed(row, 'door-candidates-tried').cells.map(key));
        const legal = new Set(factNamed(row, 'door-candidates-legal').cells.map(key));
        expect([...tried].every((k) => offered.has(k))).toBe(true);
        expect([...legal].every((k) => tried.has(k))).toBe(true);
        expect(offered.size).toBeGreaterThanOrEqual(tried.size);
        expect(tried.size).toBeGreaterThanOrEqual(legal.size);
    });

    /** ⛔ THE OFFERED SET IS THE MAIN PATH'S INTERIOR — the same rule
     *  `roomDoor.doorCandidates` states, not a second spelling of it. */
    it('⛓ the OFFERED set is the main path minus its two endpoints', () => {
        const main = factNamed(row, 'main-path');
        const offered = factNamed(row, 'door-candidates-offered');
        expect(offered.cells.map(key)).toEqual(main.cells.slice(1, -1).map(key));
    });

    it('⛔ recording OFF records no row at all — the sink is the ledger\'s, not the law\'s',
        () => {
            const off = seedlingModel({ seed: SUBJECT_SEED,
                elements: { name: 'killgate' }, ledger: false });
            expect(off.ledger).toEqual([]);
        });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ D1 — THE DOOR LAW'S TWO FLOODS, ON THE COMMITTED PLACEMENT
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the ON-CONNECTOR composite row carries the door law\'s own two floods', () => {
    const model = seedlingModel({ seed: SUBJECT_SEED, elements: { name: 'killgate' } });
    const row = model.ledger.filter((r) => r.phase === 'composite').at(-1);

    it('both sides are there, and they are DISJOINT', () => {
        const s = factNamed(row, 'door-flood-start');
        const g = factNamed(row, 'door-flood-goal');
        expect(s.cells.length).toBeGreaterThan(0);
        expect(g.cells.length).toBeGreaterThan(0);
        const sk = new Set(s.cells.map(key));
        expect(g.cells.map(key).filter((k) => sk.has(k))).toEqual([]);
    });

    /** ⛓⛓⛓ CLAUSE 2 OF THE DOOR LAW, AS A PICTURE: the CLEARER is on the start
     *  side. The law asserts it in prose; this row asserts it in cells. */
    it('⛓⛓⛓ the element\'s CLEARER is in the START side — clause 2, in cells', () => {
        const s = new Set(factNamed(row, 'door-flood-start').cells.map(key));
        for (const c of model.elements.placed[0].clearer) expect(s.has(key(c))).toBe(true);
    });

    it('⛔ and the DOOR cell is in NEITHER side — it is the thing that was walled', () => {
        const s = new Set(factNamed(row, 'door-flood-start').cells.map(key));
        const g = new Set(factNamed(row, 'door-flood-goal').cells.map(key));
        const door = model.elements.placed[0].doorCell;
        expect(s.has(key(door)) || g.has(key(door))).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ D4 — THE CERTIFICATION'S ROUTE
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ SYNTHETIC ROWS, DELIBERATELY: §11.6's own lesson is that a reader written
 * for a route that does not exist yet is untested precisely where it will be
 * used, so these rows drive the two shapes the real trace has — a LEADING LEG
 * from `saw` to `path[0]`, and a JUMP where the merge ate a stance walk.
 */
describe('⛓⛓⛓ certificationRouteCells — the trace\'s corridors, in order, gaps NAMED', () => {
    it('one row\'s corridor starts where the player STOOD, not at waypoint 0', () => {
        expect(corridorTilesOf({ saw: { x: 8, y: 8 }, path: [{ x: 56, y: 8 }] }).map(key))
            .toEqual(['0,0', '1,0', '2,0', '3,0']);
    });

    it('a row with neither `saw` nor `path` contributes nothing', () => {
        expect(corridorTilesOf({})).toEqual([]);
    });

    it('⛓⛓ the route is the rows CONCATENATED, in trace order', () => {
        const trace = { rows: [
            { saw: { x: 8, y: 8 }, path: [{ x: 40, y: 8 }] },
            { saw: { x: 40, y: 8 }, path: [{ x: 40, y: 40 }] },
        ] };
        const out = certificationRouteCells(trace);
        expect(out.cells.map(key)).toEqual(['0,0', '1,0', '2,0', '2,1', '2,2']);
        expect(out.gaps).toBe(0);
        expect(out.rows).toBe(2);
    });

    /** ⛓⛓⛓ THE GAP — the trace MERGE lets a substantive decision outrank a
     *  `walk`, so the walk to a stance is not a `path` row at all (§11.6's third
     *  finding). ⛔ The hole is COUNTED, never bridged. */
    it('⛓⛓⛓ a JUMP between two rows is COUNTED as a gap and not bridged', () => {
        const trace = { rows: [
            { saw: { x: 8, y: 8 }, path: [{ x: 24, y: 8 }] },
            { saw: { x: 120, y: 120 }, path: [{ x: 136, y: 120 }] },
        ] };
        const out = certificationRouteCells(trace);
        expect(out.gaps).toBe(1);
        expect(out.cells.map(key)).toEqual(['0,0', '1,0', '7,7', '8,7']);
    });

    it('⛔ consecutive duplicate cells are dropped — the answer is a PATH, not samples', () => {
        const out = certificationRouteCells({ rows: [{ saw: { x: 8, y: 8 },
            path: [{ x: 9, y: 9 }, { x: 10, y: 10 }] }] });
        expect(out.cells.map(key)).toEqual(['0,0']);
    });
});
