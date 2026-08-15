/**
 * seedlingDemo/levelGenerator.test — THE CORE, DRIVEN WITHOUT SEEDLING.
 *
 * PROCGEN PoC arc, slice 2. ⚖ Kickoff §3.2 says the loop imports nothing and
 * takes its level model, oracle and palette as injections. That claim is only
 * worth anything if something drives it with injections that are not
 * Seedling's — so every case here builds a FAKE model (records are numbers in
 * an array), a FAKE oracle (a table of verdicts) and a FAKE palette. If the
 * core ever reaches for a tile, a solver or an atlas, these tests stop
 * compiling rather than quietly passing.
 *
 * ⚠ AND THE FAKE ORACLE IS SCRIPTED, NOT RANDOM. The point of each case is a
 * specific sequence of verdicts and the trace it must produce; an oracle that
 * decided for itself would make the assertions about luck.
 */

import { describe, expect, it } from 'vitest';

import {
    ATTEMPT, DEFAULT_BOUNDS, GenerationAborted, KEEP_POLICY, KEPT_KIND, LevelGeneratorError,
    STOP, costModel, directedAttempt, generateLevel,
} from './levelGenerator.js';

/** A stream with `procgenRng`'s surface and a scripted sequence of picks. */
const fakeRng = (picks) => {
    let i = 0;
    return {
        seed: 7,
        draws: 0,
        state: 123,
        nextInt: (n) => { i += 1; return (i - 1) % n; },
        pick(items) {
            this.draws += 1;
            const chosen = picks ? picks[Math.min(i, picks.length - 1)] : 0;
            i += 1;
            return items[chosen % items.length];
        },
        shuffle: (items) => [...items],
    };
};

/**
 * A FAKE BASE TEMPLATE — ⛓ slice 2's seam, in the substrate-agnostic tests.
 *
 * ⛔ It carries a REAL `instantiate` rather than a stub, because the loop's
 * contract is that a template is a function: `params` in schema order, one
 * `rng.pick` per parameter, a concrete row out. `T('a')` is the zero-parameter
 * case (what every frozen row was); `T('a', 'fam', [{key,domain,…}])` is the
 * parameterized one, and the cases below use it to assert the DRAW and the
 * STAMP without going anywhere near Seedling.
 */
const T = (name, family = 'fake', params = []) => ({
    name,
    family,
    params,
    instantiate(rng, overrides = {}) {
        const values = {};
        for (const p of params) {
            values[p.key] = Object.prototype.hasOwnProperty.call(overrides, p.key)
                ? overrides[p.key] : rng.pick(p.domain);
        }
        const label = Object.keys(values).length
            ? `${name}(${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')})`
            : name;
        return {
            name,
            family,
            params: values,
            instance: label,
            footprint: [{ dx: 0, dy: 0 }],
            size: values.size ?? 1,
        };
    },
});

/**
 * A record is `{ placed: [...] }` and `place` appends — pure, so REVERT is
 * "keep the old object" exactly as it is for a level record.
 */
const fakeModel = (over = {}) => ({
    skeleton: () => ({ placed: [] }),
    /**
     * ⛓ SLICE 3: THE SEAM'S ANCHOR MEMBER RETURNS A LIST. The fake honours the
     * `limit` argument the way the real model does — one shuffle's worth of
     * legal cells, truncated — so a case that raises the bound really gets more
     * anchors here rather than being told a story about them.
     */
    anchorsFor: (record, template, rng, limit = 1) => Array
        .from({ length: limit }, (_, i) => ({ tx: 1 + i, ty: 1 })),
    place: (record, template) => ({ placed: [...record.placed, template.name] }),
    ...over,
});

/** Verdicts in order; anything past the end repeats the last one. */
const fakeOracle = (verdicts, extra = {}) => {
    let i = 0;
    return {
        budget: { maxTicksPerTarget: 2 },
        calls: [],
        solve(record, ctx) {
            this.calls.push({ record, ctx });
            const v = verdicts[Math.min(i, verdicts.length - 1)];
            i += 1;
            return typeof v === 'string'
                ? { verdict: v, ticks: 100 + i, classifiedBy: `scripted ${v}`, ...extra }
                : v;
        },
    };
};

const palette = (templates = [T('a'), T('b')]) => ({ name: 'fake-palette', templates });

describe('the loop keeps on SOLVED and reverts on anything else', () => {
    it('keeps a candidate that solves, and the kept record is the candidate', () => {
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED']),
            palette: palette(),
            bounds: { obstacleTarget: 3, triesPerStep: 2, saturationK: 2 },
        });
        expect(out.record.placed).toHaveLength(3);
        expect(out.summary.stop).toBe(STOP.TARGET_REACHED);
        expect(out.summary.keptCount).toBe(3);
    });

    it('REVERTS by keeping the old record — the rejected candidate never lands', () => {
        // skeleton SOLVED, then REFUSED, then SOLVED for the rest.
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED', 'REFUSED', 'SOLVED']),
            palette: palette(),
            bounds: { obstacleTarget: 2, triesPerStep: 3, saturationK: 3 },
        });
        expect(out.summary.keptCount).toBe(2);
        // three template solves happened; one of them was thrown away.
        expect(out.trace.filter((r) => r.outcome === ATTEMPT.REVERTED)).toHaveLength(1);
        expect(out.record.placed).toHaveLength(2);
    });

    it('carries the refusal text and `classifiedBy` VERBATIM into the trace', () => {
        const refusal = {
            verdict: 'REFUSED',
            reasonText: 'solverBot: no REACHABLE stance within 3 lattice rings of x@1,2',
            classifiedBy: 'the solver refused within budget',
        };
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED', refusal, 'SOLVED']),
            palette: palette(),
            bounds: { obstacleTarget: 1, triesPerStep: 3, saturationK: 3 },
        });
        const row = out.trace.find((r) => r.outcome === ATTEMPT.REVERTED);
        expect(row.reasonText).toBe(refusal.reasonText);
        expect(row.classifiedBy).toBe(refusal.classifiedBy);
        expect(row.verdict).toBe('REFUSED');
    });

    it('records BUDGET_EXHAUSTED as its own class with its budgetKind', () => {
        const exhausted = {
            verdict: 'BUDGET_EXHAUSTED',
            budgetKind: 'per-target-ticks',
            reasonText: 'not reached within 400 ticks',
            classifiedBy: 'the refusal names the 400-tick per-target budget',
        };
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED', exhausted, 'SOLVED']),
            palette: palette(),
            bounds: { obstacleTarget: 1, triesPerStep: 3, saturationK: 3 },
        });
        const row = out.trace.find((r) => r.verdict === 'BUDGET_EXHAUSTED');
        expect(row.outcome).toBe(ATTEMPT.REVERTED);
        expect(row.budgetKind).toBe('per-target-ticks');
    });
});

/**
 * ⛓⛓⛓ GENERATE-mode UI slice 3, TRACK A — WHAT THE ORACLE IS HANDED.
 *
 * ⛔ THE DEFECT THIS DESCRIBE BLOCK EXISTS FOR, measured at slice 2 and fixed
 * here: the loop passed `[...kept, template]`, and a `kept` element is a
 * RECORD (`{template, instance, params, family, at}`) rather than the concrete
 * row. Everything the oracle derives from a template — in Seedling, the PIN
 * UNION — therefore saw the candidate ALONE from the second placement onward,
 * so the loop's later solves ran under fewer pins than the level's own
 * certification.
 *
 * ⚠ IT IS ASSERTED HERE, WITHOUT SEEDLING, because the defect is the LOOP's:
 * the fake oracle records what it was handed and the case reads it back. The
 * Seedling half (`procgenPalette.test.js`, seed 9) measures the consequence
 * that made it worth fixing.
 */
describe('⛓ the oracle is handed the KEPT CONCRETE ROWS, not the kept records', () => {
    /** A concrete row is the thing `instantiate` returns — and it has `pins`. */
    const P = (name) => ({
        name,
        family: 'fake',
        params: [],
        instantiate: () => ({
            name,
            family: 'fake',
            params: {},
            instance: name,
            footprint: [{ dx: 0, dy: 0 }],
            pins: [`pin-${name}`],
        }),
    });

    it('every solve sees a row carrying `pins` for each template already kept', () => {
        const oracle = fakeOracle(['SOLVED']);
        generateLevel({
            rng: fakeRng([0, 1, 0]),
            model: fakeModel(),
            oracle,
            palette: palette([P('a'), P('b')]),
            bounds: { obstacleTarget: 3, triesPerStep: 2, saturationK: 2 },
        });
        // call 0 is the skeleton (no templates); calls 1..3 are the candidates.
        const handed = oracle.calls.map((c) => c.ctx?.templates ?? []);
        expect(handed[0]).toEqual([]);
        expect(handed.slice(1).map((t) => t.length)).toEqual([1, 2, 3]);
        for (const templates of handed.slice(1)) {
            for (const t of templates) {
                /**
                 * ⛔ THE WHOLE CLAIM. A kept RECORD has `template`/`at` and no
                 * `pins`; a concrete ROW has `pins` and a `footprint`. A
                 * threading that passed names or records would give the second
                 * shape here and this loop would fail on the FIRST kept row of
                 * the second solve.
                 */
                expect(t.pins, JSON.stringify(t)).toEqual([`pin-${t.name}`]);
                expect(t.footprint).toBeDefined();
                expect(t.at).toBeUndefined();
            }
        }
    });

    it('a REVERTED candidate leaves nothing behind in what later solves are handed', () => {
        const oracle = fakeOracle(['SOLVED', 'SOLVED', 'REFUSED', 'SOLVED']);
        generateLevel({
            rng: fakeRng([0, 1, 0]),
            model: fakeModel(),
            oracle,
            palette: palette([P('a'), P('b')]),
            bounds: { obstacleTarget: 2, triesPerStep: 3, saturationK: 3 },
        });
        // skeleton, kept, reverted, kept — the last solve holds TWO rows, not
        // three: the rejected candidate is discarded by dropping the reference,
        // and the retained-rows array must behave the same way the record does.
        expect(oracle.calls.map((c) => (c.ctx?.templates ?? []).length))
            .toEqual([0, 1, 2, 2]);
    });
});

describe('the bounds are real and every one of them is in the trace', () => {
    it('a step gives up after `triesPerStep` candidates', () => {
        const oracle = fakeOracle(['SOLVED', 'REFUSED']);
        generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle,
            palette: palette(),
            bounds: { obstacleTarget: 5, triesPerStep: 2, saturationK: 1 },
        });
        // 1 skeleton + (2 tries) x (1 step, then saturation ends it)
        expect(oracle.calls).toHaveLength(3);
    });

    it('SATURATES after K consecutive reject steps, and says so by name', () => {
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED', 'REFUSED']),
            palette: palette(),
            bounds: { obstacleTarget: 9, triesPerStep: 1, saturationK: 3 },
        });
        expect(out.summary.stop).toBe(STOP.SATURATED);
        expect(out.summary.keptCount).toBe(0);
        expect(out.trace.filter((r) => r.outcome === ATTEMPT.REVERTED)).toHaveLength(3);
    });

    it('the summary carries the bounds THAT RAN, not the defaults', () => {
        // ⛓ EVERY bound, spelled out — including slice 3's, and NONE of them at
        // its default, so a bound the merge dropped lands on a DIFFERENT number
        // rather than coinciding with the right one (trap 235).
        const bounds = {
            obstacleTarget: 2, triesPerStep: 4, saturationK: 5, anchorTriesPerCandidate: 2,
        };
        const out = generateLevel({
            rng: fakeRng(), model: fakeModel(), oracle: fakeOracle(['SOLVED']),
            palette: palette(), bounds,
        });
        expect(out.summary.bounds).toEqual(bounds);
        // and the roster of bounds is read FROM the defaults, so a bound added
        // without a line here is a MISSING assertion rather than an unnoticed one
        expect(Object.keys(out.summary.bounds).sort()).toEqual(Object.keys(DEFAULT_BOUNDS).sort());
        expect(out.summary.budget).toEqual({ maxTicksPerTarget: 2 });
    });

    it('refuses a non-positive bound BY NAME — there is no "unbounded" default', () => {
        expect(() => generateLevel({
            rng: fakeRng(), model: fakeModel(), oracle: fakeOracle(['SOLVED']),
            palette: palette(), bounds: { saturationK: 0 },
        })).toThrow(LevelGeneratorError);
    });

    it('`costModel` states the ceiling BEFORE the run — the post-hoc budget\'s answer', () => {
        const cost = costModel({ obstacleTarget: 6, triesPerStep: 8 }, 139);
        expect(cost.solves).toBe(1 + 6 * 8);
        expect(cost.worstCaseTotalMs).toBe(49 * 139);
        expect(cost.why).toMatch(/ACCEPTS, never what it SPENDS/);
    });

    it('the default target is inside slice 2\'s own measured ceiling of eight', () => {
        expect(DEFAULT_BOUNDS.obstacleTarget).toBeLessThanOrEqual(8);
    });
});

/**
 * ⛓⛓⛓ GENERATE-mode UI slice 3, TRACK B — THE ANCHOR SEARCH, without Seedling.
 *
 * ⚖ Ruling 7: *"look for a viable place to put the template, and put it there
 * if possible."* These cases are about the LOOP's half of it — how far it
 * walks, what it records, and what it refuses to swallow. The model's half
 * (one shuffle whatever the limit is) is `procgenSeedling`'s and is asserted
 * there; the byte-inertness of the whole thing is measured in the as-built.
 */
describe('⛓ the anchor search walks until one anchor SOLVES', () => {
    it('at the DEFAULT bound it tests exactly one anchor per candidate', () => {
        const oracle = fakeOracle(['SOLVED', 'REFUSED', 'SOLVED']);
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle,
            palette: palette(),
            bounds: { obstacleTarget: 1, triesPerStep: 3, saturationK: 3 },
        });
        // one REVERTED row then one KEPT row — a SECOND anchor for the first
        // candidate would have put a third row between them.
        expect(out.trace.slice(1).map((r) => [r.try, r.anchorTry, r.outcome]))
            .toEqual([[1, 1, ATTEMPT.REVERTED], [2, 1, ATTEMPT.KEPT]]);
        for (const r of out.trace.slice(1)) expect(r.anchorsOffered).toBe(1);
    });

    /**
     * ⛔ THE CLAIM THE BOUND EXISTS FOR. The same scripted oracle — refuse,
     * refuse, solve — now keeps the candidate at its THIRD anchor instead of
     * spending three separate TRIES on three separate draws. The three rows
     * share `step`/`try` and differ in `anchorTry` and in `at`.
     */
    it('at a bound of 3 it advances to the next ANCHOR and keeps the first that solves', () => {
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED', 'REFUSED', 'REFUSED', 'SOLVED']),
            palette: palette(),
            bounds: {
                obstacleTarget: 1, triesPerStep: 3, saturationK: 3, anchorTriesPerCandidate: 3,
            },
        });
        const rows = out.trace.slice(1);
        expect(rows.map((r) => [r.step, r.try, r.anchorTry, r.outcome])).toEqual([
            [1, 1, 1, ATTEMPT.REVERTED],
            [1, 1, 2, ATTEMPT.REVERTED],
            [1, 1, 3, ATTEMPT.KEPT],
        ]);
        // ⛔ THE ANCHORS REALLY ADVANCE — a walk that re-tested the FIRST cell
        // would produce the same three rows and the same verdicts.
        expect(rows.map((r) => `${r.at.tx},${r.at.ty}`)).toEqual(['1,1', '2,1', '3,1']);
        for (const r of rows) expect(r.anchorsOffered).toBe(3);
        // and the candidate cost ONE draw of the palette, not three
        expect(out.summary.kept).toHaveLength(1);
        expect(out.summary.attempts).toBe(3);
    });

    it('a candidate whose anchors all refuse costs the step ONE try, not `anchorTries`', () => {
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED', 'REFUSED']),
            palette: palette(),
            bounds: {
                obstacleTarget: 1, triesPerStep: 2, saturationK: 1, anchorTriesPerCandidate: 2,
            },
        });
        // 2 tries x 2 anchors = 4 rejected rows, then the step gives up
        expect(out.trace.slice(1).map((r) => [r.try, r.anchorTry]))
            .toEqual([[1, 1], [1, 2], [2, 1], [2, 2]]);
        expect(out.summary.stop).toBe(STOP.SATURATED);
    });

    it('NO_ANCHOR carries a null ordinal and ZERO offered — the room refused every cell', () => {
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel({ anchorsFor: () => [] }),
            oracle: fakeOracle(['SOLVED']),
            palette: palette(),
            bounds: {
                obstacleTarget: 4, triesPerStep: 2, saturationK: 1, anchorTriesPerCandidate: 5,
            },
        });
        for (const r of out.trace.filter((x) => x.outcome === ATTEMPT.NO_ANCHOR)) {
            expect(r.anchorTry).toBeNull();
            expect(r.anchorsOffered).toBe(0);
        }
    });

    /**
     * ⛔⛔ TRAPS 171/173, ASKED OUT LOUD. A search is a loop with more places to
     * hide an engine error in, so the case that matters most is the one where
     * it must NOT keep going: the abort fires on the FIRST anchor and the
     * second is never solved.
     */
    it('⛔ an engine throw at anchor 1 ABORTS — the walk does not try anchor 2', () => {
        class EngineError extends Error { constructor(m) { super(m); this.name = 'PhysicsV2Error'; } }
        const oracle = {
            budget: null,
            calls: 0,
            solve() {
                this.calls += 1;
                if (this.calls === 1) return { verdict: 'SOLVED', ticks: 10 };
                throw new EngineError('the player fell into a pit in level 900');
            },
        };
        let thrown = null;
        try {
            generateLevel({
                rng: fakeRng(),
                model: fakeModel(),
                oracle,
                palette: palette(),
                bounds: {
                    obstacleTarget: 3, triesPerStep: 3, saturationK: 3,
                    anchorTriesPerCandidate: 4,
                },
            });
        } catch (e) { thrown = e; }
        expect(thrown).toBeInstanceOf(GenerationAborted);
        // ⛓ the count is the claim: skeleton + ONE candidate solve. A catch
        // that moved to the next anchor would read 5.
        expect(oracle.calls).toBe(2);
        expect(thrown.message).toMatch(/anchor 1\/4/);
        expect(thrown.trace.at(-1).anchorTry).toBe(1);
    });

    it('refuses a non-positive anchor bound BY NAME, like every other bound', () => {
        expect(() => generateLevel({
            rng: fakeRng(), model: fakeModel(), oracle: fakeOracle(['SOLVED']),
            palette: palette(), bounds: { anchorTriesPerCandidate: 0 },
        })).toThrow(/bounds.anchorTriesPerCandidate must be a positive integer/);
    });

    it('the cost model multiplies by it, and says so in its own `why`', () => {
        const one = costModel({ obstacleTarget: 6, triesPerStep: 8 }, 139);
        const four = costModel(
            { obstacleTarget: 6, triesPerStep: 8, anchorTriesPerCandidate: 4 }, 139,
        );
        expect(one.solves).toBe(1 + 6 * 8);
        expect(four.solves).toBe(1 + 6 * 8 * 4);
        expect(four.why).toMatch(/anchorTriesPerCandidate\(4\)/);
    });
});

describe('the skeleton is a control, not a candidate', () => {
    it('THROWS when the empty room does not solve — never records it as step 0 reverted', () => {
        expect(() => generateLevel({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle([{ verdict: 'REFUSED', reasonText: 'the room is broken' }]),
            palette: palette(),
        })).toThrow(/THE SKELETON DID NOT SOLVE/);
    });

    it('the skeleton row is in the trace, so "the control passed" is visible', () => {
        const out = generateLevel({
            rng: fakeRng(), model: fakeModel(), oracle: fakeOracle(['SOLVED']),
            palette: palette(), bounds: { obstacleTarget: 1 },
        });
        expect(out.trace[0]).toMatchObject({ step: 0, family: 'skeleton', verdict: 'SOLVED' });
    });
});

describe('the outcomes that are NOT oracle verdicts', () => {
    it('an illegal placement is its own class, and only the model\'s own error counts', () => {
        class ModelError extends Error {}
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel({
                placementError: ModelError,
                place: () => { throw new ModelError('cell (3,3) is named twice'); },
            }),
            oracle: fakeOracle(['SOLVED']),
            palette: palette(),
            bounds: { obstacleTarget: 4, triesPerStep: 1, saturationK: 1 },
        });
        const row = out.trace.find((r) => r.outcome === ATTEMPT.ILLEGAL_PLACEMENT);
        expect(row.reasonText).toBe('cell (3,3) is named twice');
        expect(row.verdict).toBeNull();
        expect(out.summary.stop).toBe(STOP.SATURATED);
    });

    it('any OTHER placement error propagates — a loop that reverted it would hide a bug', () => {
        class ModelError extends Error {}
        expect(() => generateLevel({
            rng: fakeRng(),
            model: fakeModel({
                placementError: ModelError,
                place: () => { throw new TypeError('undefined is not a function'); },
            }),
            oracle: fakeOracle(['SOLVED']),
            palette: palette(),
        })).toThrow(TypeError);
    });

    it('NO_ANCHOR is recorded when the model has nowhere to put the template', () => {
        const out = generateLevel({
            rng: fakeRng(),
            model: fakeModel({ anchorsFor: () => [] }),
            oracle: fakeOracle(['SOLVED']),
            palette: palette(),
            bounds: { obstacleTarget: 4, triesPerStep: 2, saturationK: 1 },
        });
        expect(out.trace.filter((r) => r.outcome === ATTEMPT.NO_ANCHOR)).toHaveLength(2);
        expect(out.summary.stop).toBe(STOP.SATURATED);
    });

    it('an engine throw ABORTS with the trace attached — never a quiet revert', () => {
        class EngineError extends Error { constructor(m) { super(m); this.name = 'PhysicsV2Error'; } }
        let thrown = null;
        try {
            generateLevel({
                rng: fakeRng(),
                model: fakeModel(),
                oracle: {
                    budget: null,
                    calls: 0,
                    solve() {
                        this.calls += 1;
                        if (this.calls === 1) return { verdict: 'SOLVED', ticks: 10 };
                        if (this.calls === 2) return { verdict: 'SOLVED', ticks: 11 };
                        throw new EngineError('the player fell into a pit in level 900');
                    },
                },
                palette: palette(),
                bounds: { obstacleTarget: 5, triesPerStep: 3, saturationK: 3 },
            });
        } catch (e) { thrown = e; }
        expect(thrown).toBeInstanceOf(GenerationAborted);
        expect(thrown.cause.name).toBe('PhysicsV2Error');
        // the kept template survives in the attached trace and record
        expect(thrown.record.placed).toHaveLength(1);
        expect(thrown.trace.at(-1).outcome).toBe(ATTEMPT.ABORTED);
        expect(thrown.trace.at(-1).reasonText).toMatch(/fell into a pit/);
    });
});

describe('the loop is substrate-agnostic by construction', () => {
    it('refuses an injection that does not carry the seam\'s functions', () => {
        expect(() => generateLevel({
            rng: fakeRng(), model: { skeleton: () => ({}) },
            oracle: fakeOracle(['SOLVED']), palette: palette(),
        })).toThrow(/needs a `anchorsFor` function/);
        expect(() => generateLevel({
            rng: fakeRng(), model: fakeModel(), oracle: {}, palette: palette(),
        })).toThrow(/needs a `solve` function/);
    });

    it('refuses an empty palette — that is a finding about the palette', () => {
        expect(() => generateLevel({
            rng: fakeRng(), model: fakeModel(), oracle: fakeOracle(['SOLVED']),
            palette: { name: 'empty', templates: [] },
        })).toThrow(/finding ABOUT THE PALETTE/);
    });

    it('refuses a stream without the seeded surface', () => {
        expect(() => generateLevel({
            rng: { pick: () => null }, model: fakeModel(),
            oracle: fakeOracle(['SOLVED']), palette: palette(),
        })).toThrow(/must carry `pick` and `nextInt`/);
    });

    it('hands the oracle the templates a candidate contains, kept ones first', () => {
        const oracle = fakeOracle(['SOLVED']);
        generateLevel({
            rng: fakeRng([0, 1, 0]), model: fakeModel(), oracle, palette: palette(),
            bounds: { obstacleTarget: 2, triesPerStep: 1, saturationK: 1 },
        });
        expect(oracle.calls[0].ctx.templates).toEqual([]);
        expect(oracle.calls[1].ctx.templates).toHaveLength(1);
        expect(oracle.calls[2].ctx.templates).toHaveLength(2);
    });

    /**
     * ⛓⛓⛓ THE PARAMETERIZED-TEMPLATE SEAM (GENERATE-mode UI arc, slice 2).
     *
     * ⚖ Ruling 2 makes a template a FUNCTION, and this loop's whole share of
     * that is: draw the base, call `instantiate(rng)`, proceed with the
     * concrete row. The three cases below are the three halves of it that can
     * break independently — the refusal, the stamp, and the draw.
     */
    describe('a template is a FUNCTION, and the loop draws its parameters', () => {
        it('⛔ refuses a palette row with no `instantiate` — never falls back to the row', () => {
            expect(() => generateLevel({
                rng: fakeRng(), model: fakeModel(), oracle: fakeOracle(['SOLVED']),
                palette: { name: 'frozen', templates: [{ name: 'a', family: 'fake' }] },
            })).toThrow(/carries no `instantiate/);
        });

        /**
         * ⛔ THE STAMP IS WHAT MAKES A RUN RECONSTRUCTABLE. `template` stays
         * the BASE name (the roster key the pin union looks up and `byFamily`
         * counts on); `instance` and `params` ride BESIDE it. A row that
         * carried only the label would split one roster entry into one per
         * value combination (trap 199).
         */
        it('stamps every trace row and every kept entry with `params` and the instance label',
            () => {
                const out = generateLevel({
                    rng: fakeRng(),
                    model: fakeModel(),
                    oracle: fakeOracle(['SOLVED']),
                    palette: palette([T('a', 'fam', [
                        { key: 'size', domain: [7], default: 7, why: 'one value, so the '
                            + 'draw is observable without the pick sequence deciding it' },
                    ])]),
                    bounds: { obstacleTarget: 1, triesPerStep: 1, saturationK: 1 },
                });
                const row = out.trace.find((r) => r.step === 1);
                expect(row.template).toBe('a');
                expect(row.family).toBe('fam');
                expect(row.instance).toBe('a(size=7)');
                expect(row.params).toEqual({ size: 7 });
                expect(out.summary.kept[0]).toMatchObject({
                    template: 'a', instance: 'a(size=7)', params: { size: 7 },
                });
                // ⛓ AND THE CONCRETE ROW IS WHAT REACHED THE MODEL — the level
                // holds the instance, not the base. Anything less would let an
                // `instantiate` that ignored its own draw pass this case.
                expect(out.record.placed).toEqual(['a']);
                expect(out.summary.byFamily.fam.kept).toBe(1);
            });

        /**
         * ⛓ THE DRAW ORDER IS PART OF DETERMINISM, so it is asserted rather
         * than argued: parameters come out of the SAME stream, in SCHEMA
         * ORDER, one draw each — which is why a domain that grew would move
         * every seed's level and why the palette declares the order out loud.
         */
        it('draws each declared parameter from the SAME stream, in schema order', () => {
            const seen = [];
            const rng = {
                seed: 1,
                draws: 0,
                state: 5,
                nextInt: () => 0,
                pick(items) { this.draws += 1; seen.push(items); return items[0]; },
                shuffle: (items) => [...items],
            };
            const out = generateLevel({
                rng,
                model: fakeModel(),
                oracle: fakeOracle(['SOLVED']),
                palette: palette([T('a', 'fam', [
                    { key: 'first', domain: ['x', 'y'], default: 'x', why: 'order' },
                    { key: 'second', domain: [1, 2, 3], default: 1, why: 'order' },
                ])]),
                bounds: { obstacleTarget: 1, triesPerStep: 1, saturationK: 1 },
            });
            // the roster, then `first`'s domain, then `second`'s — three picks
            // off ONE stream, and the template is bought before its parameters.
            expect(seen).toHaveLength(3);
            expect(seen[0].map((t) => t.name)).toEqual(['a']);
            expect(seen[1]).toEqual(['x', 'y']);
            expect(seen[2]).toEqual([1, 2, 3]);
            expect(out.trace.find((r) => r.step === 1).instance).toBe('a(first=x,second=1)');
        });
    });

    it('counts by FAMILY from the roster, never from a total', () => {
        const out = generateLevel({
            rng: fakeRng([0, 1, 0, 1]),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED']),
            palette: palette([T('a', 'walls'), T('b', 'water')]),
            bounds: { obstacleTarget: 4, triesPerStep: 1, saturationK: 2 },
        });
        const total = Object.values(out.summary.byFamily).reduce((n, f) => n + f.kept, 0);
        expect(total).toBe(out.summary.keptCount);
        expect(Object.keys(out.summary.byFamily).sort()).toEqual(['walls', 'water']);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ VERB 2 — THE DIRECTED ATTEMPT (GENERATE-mode UI slice 5)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ The user's ruling: *verb 2 PREFERS DISCHARGE; the free loop keeps
 * FIRST-SOLVED.* These cases drive both halves of that sentence against the
 * same fake seam the loop's own cases use — so the claims are about the walk
 * and its policy, not about Seedling.
 */
describe('⛓⛓ the DIRECTED attempt — one template, one record, a choosier walk', () => {
    /** A concrete row, which is what a directive places (never a base). */
    const row = (name, family = 'fake') => ({
        name, family, params: {}, instance: name, footprint: [{ dx: 0, dy: 0 }],
    });
    /**
     * The discharge predicate the page injects, faked: `verbFamilies` have a
     * verb, everything else answers `null`. ⛔ `null`, NOT `false` — the whole
     * reason `KEPT_KIND` has three members.
     */
    const discharger = (verbFamilies, dischargingRecords) => (family, records) => {
        if (!verbFamilies.includes(family)) return null;
        return (records ?? []).some((r) => dischargingRecords.includes(r.strategy));
    };

    it('KEEPS the first anchor that solves when the policy is FIRST_SOLVED', () => {
        const out = directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED']),
            record: { placed: [] },
            template: row('a'),
            bound: 4,
        });
        expect(out.outcome).toBe(ATTEMPT.KEPT);
        expect(out.at).toEqual({ tx: 1, ty: 1 });
        expect(out.anchorsWalked).toBe(1);
        expect(out.anchorsOffered).toBe(4);
        expect(out.record.placed).toEqual(['a']);
    });

    it('⛓⛓ PREFERS a DISCHARGING anchor over an earlier one that merely SOLVED', () => {
        /**
         * ⚠ THE SUBJECT'S OWN PROPERTY IS ASSERTED BY CONSTRUCTION (trap 235):
         * anchor 1 solves WITHOUT the verb and anchor 3 solves WITH it. A
         * scripted oracle whose first anchor already discharged could not tell
         * the two policies apart at all.
         */
        const verdicts = [
            { verdict: 'SOLVED', ticks: 10, records: [{ strategy: 'walk' }] },
            { verdict: 'REFUSED', ticks: 11, reasonText: 'nope' },
            { verdict: 'SOLVED', ticks: 12, records: [{ strategy: 'shove' }] },
            { verdict: 'SOLVED', ticks: 13, records: [{ strategy: 'shove' }] },
        ];
        const out = directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(verdicts),
            record: { placed: [] },
            template: row('a', 'shove'),
            bound: 4,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
            discharges: discharger(['shove'], ['shove']),
        });
        expect(out.outcome).toBe(ATTEMPT.KEPT);
        expect(out.keptKind).toBe(KEPT_KIND.DISCHARGED);
        expect(out.at).toEqual({ tx: 3, ty: 1 });
        expect(out.anchorsWalked).toBe(3);
        // ⛔ THE SAME SUBJECT UNDER THE FREE LOOP'S POLICY KEEPS ANCHOR 1 — which
        // is what makes this a claim about the POLICY and not about the fake.
        const first = directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(verdicts),
            record: { placed: [] },
            template: row('a', 'shove'),
            bound: 4,
        });
        expect(first.at).toEqual({ tx: 1, ty: 1 });
        expect(first.anchorsWalked).toBe(1);
    });

    it('SETTLES for the first merely-SOLVED anchor when nothing discharges', () => {
        const out = directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle([
                { verdict: 'SOLVED', ticks: 10, records: [{ strategy: 'walk' }] },
                { verdict: 'SOLVED', ticks: 11, records: [{ strategy: 'walk' }] },
                { verdict: 'SOLVED', ticks: 12, records: [{ strategy: 'walk' }] },
            ]),
            record: { placed: [] },
            template: row('a', 'shove'),
            bound: 3,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
            discharges: discharger(['shove'], ['shove']),
        });
        expect(out.outcome).toBe(ATTEMPT.KEPT);
        expect(out.keptKind).toBe(KEPT_KIND.SOLVED_ONLY);
        // ⛓ THE FALLBACK IS THE **FIRST** SOLVED ANCHOR, not the last walked.
        expect(out.at).toEqual({ tx: 1, ty: 1 });
        // …and the walk really did spend the whole bound looking for better.
        expect(out.anchorsWalked).toBe(3);
        // ⛓ THE ROW IS CORRECTED IN PLACE: exactly ONE row says KEPT, and it is
        // the one whose anchor was taken. A walk that left the passed-over rows
        // saying KEPT would be a trace naming three placements for one keep.
        const keptRows = out.rows.filter((r) => r.outcome === ATTEMPT.KEPT);
        expect(keptRows).toHaveLength(1);
        expect(keptRows[0].anchorTry).toBe(1);
    });

    it('⛔ a template with NO VERB says so by name — it is not "solved-only"', () => {
        const out = directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle([{ verdict: 'SOLVED', ticks: 10, records: [] }]),
            record: { placed: [] },
            template: row('w', 'wall'),
            bound: 8,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
            discharges: discharger(['shove'], ['shove']),
        });
        expect(out.keptKind).toBe(KEPT_KIND.NO_VERB);
        // ⛔ AND IT STOPS AT THE FIRST SOLVE. First-SOLVED is this family's whole
        // criterion, so walking on would spend solves hunting an outcome that
        // does not exist for it.
        expect(out.anchorsWalked).toBe(1);
    });

    it('⛔ PREFER_DISCHARGE without a predicate REFUSES rather than degrading', () => {
        expect(() => directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED']),
            record: { placed: [] },
            template: row('a', 'shove'),
            bound: 2,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
        })).toThrow(/needs a `discharges\(family, records\)` predicate/);
    });

    describe('the four outcomes, each reachable and each distinct', () => {
        it('NO_ANCHOR when the model offers no legal cell', () => {
            const out = directedAttempt({
                rng: fakeRng(),
                model: fakeModel({ anchorsFor: () => [] }),
                oracle: fakeOracle(['SOLVED']),
                record: { placed: [] },
                template: row('a'),
                bound: 12,
            });
            expect(out.outcome).toBe(ATTEMPT.NO_ANCHOR);
            expect(out.anchorsOffered).toBe(0);
            expect(out.rows).toHaveLength(1);
            expect(out.rows[0].classifiedBy).toMatch(/no legal anchor/);
        });

        it('ILLEGAL_PLACEMENT when EVERY offered anchor is refused by the model', () => {
            class ModelError extends Error {}
            const out = directedAttempt({
                rng: fakeRng(),
                model: fakeModel({
                    placementError: ModelError,
                    place: () => { throw new ModelError('the footprint leaves the room'); },
                }),
                oracle: fakeOracle(['SOLVED']),
                record: { placed: [] },
                template: row('a'),
                bound: 3,
            });
            expect(out.outcome).toBe(ATTEMPT.ILLEGAL_PLACEMENT);
            // ⛔ VERBATIM, and one row per anchor the model refused.
            expect(out.rows).toHaveLength(3);
            expect(out.rows[0].reasonText).toBe('the footprint leaves the room');
            // ⛔ NOT ONE SOLVE WAS SPENT — the model answered before the oracle.
            expect(out.solve).toBeNull();
        });

        it('REVERTED when an anchor reached the oracle and none was kept', () => {
            const out = directedAttempt({
                rng: fakeRng(),
                model: fakeModel(),
                oracle: fakeOracle([{ verdict: 'REFUSED', ticks: 4, reasonText: 'unreachable' }]),
                record: { placed: [] },
                template: row('a'),
                bound: 2,
            });
            expect(out.outcome).toBe(ATTEMPT.REVERTED);
            expect(out.keptKind).toBeNull();
            // ⛔ REVERT IS "KEEP THE OLD RECORD" — the same law the loop obeys.
            expect(out.record.placed).toEqual([]);
            expect(out.rows.map((r) => r.reasonText)).toEqual(['unreachable', 'unreachable']);
        });

        it('⛔ a mixture of ILLEGAL and REFUSED reports REVERTED, not ILLEGAL', () => {
            class ModelError extends Error {}
            let n = 0;
            const out = directedAttempt({
                rng: fakeRng(),
                model: fakeModel({
                    placementError: ModelError,
                    place: (record, template) => {
                        n += 1;
                        if (n === 1) throw new ModelError('cell taken');
                        return { placed: [...record.placed, template.name] };
                    },
                }),
                oracle: fakeOracle([{ verdict: 'REFUSED', ticks: 4, reasonText: 'no' }]),
                record: { placed: [] },
                template: row('a'),
                bound: 2,
            });
            // "this was never a room" is only the answer when it is the WHOLE
            // answer; one anchor did reach the oracle, so the oracle's is.
            expect(out.outcome).toBe(ATTEMPT.REVERTED);
        });
    });

    it('⛔⛔ an engine throw still ABORTS, with its rows attached', () => {
        const boom = new Error('the player fell into a pit');
        boom.name = 'PhysicsV2Error';
        let calls = 0;
        expect(() => directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: {
                budget: null,
                solve() { calls += 1; throw boom; },
            },
            record: { placed: [] },
            template: row('a'),
            bound: 6,
        })).toThrow(GenerationAborted);
        // ⛔ THE NEGATIVE HALF IS THE ONE THAT MATTERS: the oracle is called
        // ONCE, where a walk that caught and moved on would call it six times.
        expect(calls).toBe(1);
    });

    it('names its BOUND and its POLICY in the result (⚖ kickoff §5)', () => {
        const out = directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED']),
            record: { placed: [] },
            template: row('a'),
            bound: 9,
        });
        expect(out.bound).toBe(9);
        expect(out.keepPolicy).toBe(KEEP_POLICY.FIRST_SOLVED);
    });

    it('⛔ takes a CONCRETE ROW and refuses a base template by name', () => {
        expect(() => directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED']),
            record: { placed: [] },
            template: null,
            bound: 2,
        })).toThrow(/takes a CONCRETE ROW/);
    });

    it('refuses a bound that is not a positive integer', () => {
        expect(() => directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['SOLVED']),
            record: { placed: [] },
            template: row('a'),
            bound: 0,
        })).toThrow(/positive integer bound/);
    });

    it('⛓ hands the oracle the KEPT CONCRETE ROWS plus this one, for the pin union', () => {
        const oracle = fakeOracle(['SOLVED']);
        const kept = [row('already', 'water')];
        directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle,
            record: { placed: ['already'] },
            template: row('a'),
            keptRows: kept,
            bound: 1,
        });
        expect(oracle.calls[0].ctx.templates.map((t) => t.name)).toEqual(['already', 'a']);
    });

    it('carries the caller\'s row fields onto every emitted row', () => {
        const out = directedAttempt({
            rng: fakeRng(),
            model: fakeModel(),
            oracle: fakeOracle(['REFUSED']),
            record: { placed: [] },
            template: row('a'),
            bound: 2,
            rowBase: { directive: 3, step: 4 },
        });
        expect(out.rows.every((r) => r.directive === 3 && r.step === 4)).toBe(true);
    });
});

describe('⛔ the KEEP POLICY defaults to FIRST_SOLVED, and the free loop never passes one',
    () => {
        it('the exported default is first-solved', () => {
            expect(KEEP_POLICY.FIRST_SOLVED).toBe('first-solved');
        });

        it('⛓ the loop keeps anchor 1 even when a later anchor would discharge', () => {
            /**
             * ⛔ THE INERTNESS CLAIM, AS A UNIT TEST. The oracle scripts a
             * non-discharging solve at anchor 1 and a discharging one at anchor
             * 2; the free loop must take anchor 1, because ⚖ the ruling leaves
             * its semantics alone. This is the case a mutant that threaded the
             * preference into `generateLevel` would redden.
             */
            const out = generateLevel({
                rng: fakeRng(),
                model: fakeModel(),
                oracle: fakeOracle([
                    { verdict: 'SOLVED', ticks: 1, classifiedBy: 'skeleton' },
                    { verdict: 'SOLVED', ticks: 2, records: [{ strategy: 'walk' }] },
                    { verdict: 'SOLVED', ticks: 3, records: [{ strategy: 'shove' }] },
                ]),
                palette: palette([T('a', 'shove')]),
                bounds: { obstacleTarget: 1, triesPerStep: 1, saturationK: 2,
                    anchorTriesPerCandidate: 4 },
            });
            const kept = out.trace.filter((r) => r.outcome === ATTEMPT.KEPT && r.step === 1);
            expect(kept).toHaveLength(1);
            expect(kept[0].anchorTry).toBe(1);
        });

        it('⛔ and its trace rows carry NO `keptKind` key at all', () => {
            /**
             * ⛓ The bytes are the claim. Slice 3 measured the free ladder's
             * trace rows field by field; a `keptKind: null` stapled to every row
             * by this slice would have moved every one of them, and the
             * measurement that proved the anchor search inert would have to be
             * re-taken for a field the free loop cannot even use.
             */
            const out = generateLevel({
                rng: fakeRng(),
                model: fakeModel(),
                oracle: fakeOracle(['SOLVED']),
                palette: palette(),
                bounds: { obstacleTarget: 2, triesPerStep: 1, saturationK: 2 },
            });
            for (const r of out.trace) {
                expect(Object.prototype.hasOwnProperty.call(r, 'keptKind')).toBe(false);
                expect(Object.prototype.hasOwnProperty.call(r, 'directive')).toBe(false);
            }
        });
    });
