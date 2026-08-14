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
    ATTEMPT, DEFAULT_BOUNDS, GenerationAborted, LevelGeneratorError, STOP, costModel,
    generateLevel,
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

const T = (name, family = 'fake') => ({ name, family, footprint: [{ dx: 0, dy: 0 }] });

/**
 * A record is `{ placed: [...] }` and `place` appends — pure, so REVERT is
 * "keep the old object" exactly as it is for a level record.
 */
const fakeModel = (over = {}) => ({
    skeleton: () => ({ placed: [] }),
    anchorFor: () => ({ tx: 1, ty: 1 }),
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
        const bounds = { obstacleTarget: 2, triesPerStep: 4, saturationK: 5 };
        const out = generateLevel({
            rng: fakeRng(), model: fakeModel(), oracle: fakeOracle(['SOLVED']),
            palette: palette(), bounds,
        });
        expect(out.summary.bounds).toEqual(bounds);
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
            model: fakeModel({ anchorFor: () => null }),
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
        })).toThrow(/needs a `anchorFor` function/);
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
