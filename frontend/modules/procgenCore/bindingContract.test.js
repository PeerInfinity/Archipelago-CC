/**
 * procgenCore/bindingContract.test — THE SEAM'S OWN CLAIMS, ASKED OF **BOTH**
 * BINDINGS.
 *
 * CONSTRUCTIVE-MODE arc, slice 2 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.2 and §4 slice 2: *"the loop's existing test suite runs
 * against BOTH bindings where the contract is shared (one describe, two
 * fixtures)"*).
 *
 * ── WHY THIS IS A DIFFERENT FILE FROM `levelGenerator.test.js` ────────
 *
 * That file drives the loop with a FAKE model, a FAKE oracle and a FAKE palette
 * — it proves the loop does what it says when everything around it is a stub,
 * and it can reach branches no real substrate produces on demand (an engine
 * throw at anchor 1, a palette of one row that always refuses). This file is
 * the other half: it takes the two REAL bindings and asks whether the things
 * the loop DOCUMENTS about its seam are true of both. A claim that held for
 * Seedling and not for the maze would be a Seedling fact wearing a contract's
 * clothes, and until this slice there was no way to tell the two apart.
 *
 * ⛔ ONLY ROWS THAT ARE ABOUT **THE LOOP** ARE HERE. Anything about Seedling's
 * terrain, its door rule, its placement groups or its tags stays in
 * `procgenPalette.test.js` / `procgenSeedling`'s own suites; anything about the
 * maze's tiles, obstacles and BFS stays in `procgenMaze.test.js`. The test of
 * whether a row belongs here is whether both fixtures can be asked it in the
 * SAME WORDS.
 *
 * ⚠ THE SEEDLING ARM IS DELIBERATELY TINY (`obstacleTarget: 1`). Its oracle is
 * a synchronous solver run of ~150 ms; the maze's is a BFS of ~2 ms. The rows
 * below are about the seam and not about yield, so one kept template is enough
 * to exercise every one of them — and a suite that spent two minutes proving a
 * contract would be a suite nobody runs.
 */

import { describe, expect, it } from 'vitest';

import { ATTEMPT, DEFAULT_BOUNDS, VERDICT, directedAttempt, generateLevel } from './levelGenerator.js';
import { seedlingModel, seedlingOracle } from '../seedlingDemo/procgenSeedling.js';
import { PRE_SWORD_PALETTE } from '../seedlingDemo/procgenPalette.js';
import { rngFor as seedlingRngFor } from '../seedlingDemo/procgenRng.js';
import {
    MAZE_PALETTE, mazeModel, mazeOracle, serializeMazeLevel,
} from '../mazeRoom/procgenMaze.js';
import { rngFor as mazeRngFor } from '../mazeRoom/procgenRng.js';

/**
 * A FIXTURE is the four things a binding is: a model, an oracle over it, a
 * palette, and the two conversions a test needs (a record to comparable bytes,
 * and one concrete row to place). ⛔ Nothing else — a fixture that carried a
 * helper for one substrate's questions would let a substrate-specific row creep
 * into a shared describe.
 */
const FIXTURES = [
    {
        name: 'seedling',
        bounds: { obstacleTarget: 1, triesPerStep: 3, saturationK: 2 },
        palette: PRE_SWORD_PALETTE,
        rngFor: seedlingRngFor,
        build: (seed) => {
            const model = seedlingModel({ seed });
            return { model, oracle: seedlingOracle({ model, items: PRE_SWORD_PALETTE.items }) };
        },
        serialize: (record) => JSON.stringify(record),
        // A row with a small, always-placeable footprint, so "the model refused
        // this CELL" is never confused with "this shape does not fit anywhere".
        row: () => PRE_SWORD_PALETTE.templates
            .find((t) => t.name === 'wall-segment').instantiate(null, { ori: 'h', len: 2 }),
        // ⛔ Off the grid on BOTH substrates, so the refusal under test is the
        // model's bounds sentence and not a collision with something placed.
        offGrid: { tx: -3, ty: -3 },
    },
    {
        name: 'maze',
        bounds: { obstacleTarget: 4, triesPerStep: 4, saturationK: 2 },
        palette: MAZE_PALETTE,
        rngFor: mazeRngFor,
        build: (seed) => {
            const model = mazeModel({ seed });
            return { model, oracle: mazeOracle({ model, items: MAZE_PALETTE.items }) };
        },
        serialize: (record) => JSON.stringify(serializeMazeLevel(record)),
        row: () => MAZE_PALETTE.templates
            .find((t) => t.name === 'wall-segment').instantiate(null, { ori: 'h', len: 1 }),
        offGrid: { tx: -3, ty: -3 },
    },
];

const run = (f, seed) => {
    const { model, oracle } = f.build(seed);
    return {
        model,
        oracle,
        ...generateLevel({ rng: f.rngFor(seed), model, oracle, palette: f.palette,
            bounds: f.bounds }),
    };
};

describe.each(FIXTURES)('the loop\'s seam, over the $name bindings', (f) => {
    const SEED = 3;

    it('the SKELETON is trace row 0, it SOLVED, and it is the loop\'s control', () => {
        const { record: _r, trace, oracle, model } = run(f, SEED);
        expect(trace[0]).toMatchObject({
            step: 0,
            try: 0,
            outcome: ATTEMPT.KEPT,
            template: null,
            family: 'skeleton',
            at: null,
            verdict: VERDICT.SOLVED,
            reasonText: null,
        });
        expect(typeof trace[0].rngStateBefore).toBe('number');
        expect(trace[0].drawsBefore).toBe(0);
        // …and the control is a control: the bare skeleton solves on its own.
        expect(oracle.solve(model.skeleton(), { templates: [] }).verdict).toBe(VERDICT.SOLVED);
    });

    it('every attempt row carries the whole row contract, whatever its outcome', () => {
        const { trace } = run(f, SEED);
        const rows = trace.slice(1);
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            for (const key of ['step', 'try', 'template', 'instance', 'params', 'family',
                'rngStateBefore', 'drawsBefore', 'anchorTry', 'anchorsOffered', 'outcome',
                'at', 'verdict', 'ticks', 'classifiedBy', 'reasonText']) {
                expect(r, `row is missing "${key}"`).toHaveProperty(key);
            }
            expect(Object.values(ATTEMPT)).toContain(r.outcome);
            // ⛔ The instance label rides BESIDE the base name, never instead of
            // it — `byFamily` counts on `family` and the pin union looks up on
            // `template` (trap 199).
            expect(typeof r.template).toBe('string');
            expect(typeof r.instance).toBe('string');
            // ⚠ A refusal's TEXT is the evidence channel, so a REVERTED row
            // that carried none would be a veto nobody can act on.
            if (r.outcome === ATTEMPT.REVERTED) expect(r.reasonText).toBeTruthy();
            if (r.outcome === ATTEMPT.ILLEGAL_PLACEMENT) expect(r.reasonText).toBeTruthy();
        }
    });

    it('the summary names the bounds THAT RAN, and its counts partition the trace', () => {
        const { trace, summary } = run(f, SEED);
        expect(summary.bounds).toEqual({ ...DEFAULT_BOUNDS, ...f.bounds });
        expect(summary.attempts).toBe(trace.length - 1);
        expect(summary.keptCount).toBe(summary.kept.length);
        const tally = { kept: 0, reverted: 0, illegal: 0, noAnchor: 0 };
        for (const c of Object.values(summary.byFamily)) {
            for (const k of Object.keys(tally)) tally[k] += c[k];
        }
        expect(tally.kept + tally.reverted + tally.illegal + tally.noAnchor)
            .toBe(trace.length - 1);
        expect(tally.kept).toBe(summary.keptCount);
        for (const k of summary.kept) {
            expect(Object.keys(k).sort())
                .toEqual(['at', 'family', 'instance', 'params', 'template']);
        }
    });

    it('same seed, same level — record AND trace, in two independent runs', () => {
        const a = run(f, 5);
        const b = run(f, 5);
        expect(f.serialize(a.record)).toBe(f.serialize(b.record));
        expect(JSON.stringify(a.trace)).toBe(JSON.stringify(b.trace));
        expect(JSON.stringify(a.summary)).toBe(JSON.stringify(b.summary));
    });

    /**
     * ⛓⛓ THE ANCHOR BOUND'S BYTE-INERTNESS, BY CONSTRUCTION AND NOT BY HOPE.
     * `anchorsFor` spends exactly ONE shuffle whatever `limit` is, so raising
     * the bound moves no earlier draw and `anchorsFor(…, 1)[0]` is the cell a
     * one-anchor walk always got. Both bindings owe this: it is what makes
     * `anchorTriesPerCandidate: 1` reproduce the pre-search ladder.
     */
    it('⛔ `anchorsFor` spends the SAME draws at limit 1 and at limit 5, and agrees on '
        + 'the first cell', () => {
        const { model } = f.build(7);
        const record = model.skeleton();
        const row = f.row();
        const one = f.rngFor(7);
        const many = f.rngFor(7);
        const a = model.anchorsFor(record, row, one, 1);
        const b = model.anchorsFor(record, row, many, 5);
        expect(one.draws).toBe(many.draws);
        expect(one.state).toBe(many.state);
        expect(a).toHaveLength(1);
        expect(b.length).toBeGreaterThanOrEqual(1);
        expect(a[0]).toEqual(b[0]);
    });

    it('⛔ `legalAt` is DERIVED from `refusalAt` — one adjudication, two readers', () => {
        const { model } = f.build(7);
        const record = model.skeleton();
        const row = f.row();
        let refused = 0;
        for (let ty = -1; ty <= record.height; ty += 1) {
            for (let tx = -1; tx <= record.width; tx += 1) {
                const why = model.refusalAt(record, row, tx, ty);
                expect(model.legalAt(record, row, tx, ty)).toBe(why === null);
                if (why !== null) {
                    refused += 1;
                    expect(typeof why).toBe('string');
                    expect(why).toContain(`(${tx},${ty})`);
                }
            }
        }
        // ⚠ The sweep must actually REFUSE something, or it would agree
        // vacuously — the border ring it walks is outside both grids.
        expect(refused).toBeGreaterThan(0);
    });

    /**
     * ⛔⛔ `place` IS PURE, AND THIS IS THE ROW THE MAZE ADDED. The loop's REVERT
     * is "keep the old record" and there is no undo; a `place` that wrote into
     * its input would leave every rejected candidate standing in the record the
     * loop believes it reverted. Seedling gets this free (its records are
     * frozen); the maze had to clone for it, so the claim is asked of both.
     */
    it('⛔ `place` returns a NEW record and leaves its input untouched — twice over', () => {
        const { model } = f.build(7);
        const record = model.skeleton();
        const row = f.row();
        const before = f.serialize(record);
        const at = model.anchorsFor(record, row, f.rngFor(7), 1)[0];
        const one = model.place(record, row, at);
        const two = model.place(record, row, at);
        expect(f.serialize(record)).toBe(before);
        expect(one).not.toBe(record);
        expect(f.serialize(one)).not.toBe(before);
        expect(f.serialize(two)).toBe(f.serialize(one));
    });

    it('⛔ `place` refuses an off-grid anchor with its OWN error class, not a bare Error',
        () => {
            const { model } = f.build(7);
            expect(typeof model.placementError).toBe('function');
            let thrown = null;
            try {
                model.place(model.skeleton(), f.row(), f.offGrid);
            } catch (e) { thrown = e; }
            expect(thrown).toBeInstanceOf(model.placementError);
        });

    /**
     * ⛓ THE EXPLICIT ANCHOR (GENERATE-mode UI slice 6) — the first caller that
     * can produce `ILLEGAL_PLACEMENT`, and the row it emits must carry the
     * MODEL's own sentence. ⛔ The oracle is never called, so the record cannot
     * move.
     */
    it('a DIRECTED attempt at an illegal cell refuses BY NAME and never touches the record',
        () => {
            const { model, oracle } = f.build(7);
            const record = model.skeleton();
            const row = f.row();
            const out = directedAttempt({
                rng: f.rngFor(7), model, oracle, record, template: row,
                anchor: f.offGrid, bound: 1,
            });
            expect(out.outcome).toBe(ATTEMPT.ILLEGAL_PLACEMENT);
            expect(out.record).toBe(record);
            expect(out.solve).toBeNull();
            expect(out.rows[0].reasonText)
                .toBe(model.refusalAt(record, row, f.offGrid.tx, f.offGrid.ty));
        });
});

/**
 * ⛔ AND THE TWO BINDINGS ARE GENUINELY DIFFERENT, which is what makes the
 * describe above worth anything. A parameterised suite over two fixtures that
 * turned out to be the same object would report a contract where it had a
 * tautology.
 */
describe('the two bindings share the contract and nothing else', () => {
    it('different models, different oracles, different palettes, different rng sources', () => {
        const s = FIXTURES[0].build(1);
        const m = FIXTURES[1].build(1);
        expect(s.model.placementError).not.toBe(m.model.placementError);
        expect(FIXTURES[0].palette.name).not.toBe(FIXTURES[1].palette.name);
        expect(seedlingRngFor(1).source).not.toBe(mazeRngFor(1).source);
        // …and neither record is the other's shape.
        expect(s.model.skeleton().entities).toBeInstanceOf(Array);
        expect(m.model.skeleton().tiles).toBeInstanceOf(Int8Array);
    });
});
