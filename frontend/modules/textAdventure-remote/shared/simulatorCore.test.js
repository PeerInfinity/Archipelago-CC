import { describe, it, expect } from 'vitest';

import { reach, makeBfsSolver, makeRandomWalkerSolver } from './simulatorCore.js';
import { createRng } from './rng.js';

// A tiny non-maze test world so the tests exercise the shared core in
// isolation — the maze-specific tests live in mazeRoomEngine.test.js.
//
// World: a 1D corridor of `length` cells. State is a position 0..length-1.
// Inputs '+' and '-' step right / left. Out-of-range steps are illegal.

function makeCorridor(length) {
    return { length };
}
function corridorStep(world, state, input) {
    if (input === '+') {
        const next = state.pos + 1;
        return next < world.length ? { pos: next } : null;
    }
    if (input === '-') {
        const next = state.pos - 1;
        return next >= 0 ? { pos: next } : null;
    }
    return null;
}
const corridorSolver = makeBfsSolver({
    step: corridorStep,
    inputs: ['+', '-'],
    visitedKey: (s) => `${s.pos}`,
});

function atCell(target) {
    return (state) => state.pos === target;
}

function runPlan(world, startState, plan) {
    let s = startState;
    for (const input of plan) {
        const next = corridorStep(world, s, input);
        if (next === null) return null;
        s = next;
    }
    return s;
}

describe('makeBfsSolver — argument validation', () => {
    it('rejects missing step', () => {
        expect(() => makeBfsSolver({ inputs: ['a'], visitedKey: () => '' })).toThrow();
    });
    it('rejects empty inputs', () => {
        expect(() => makeBfsSolver({ step: () => null, inputs: [], visitedKey: () => '' })).toThrow();
    });
    it('rejects missing visitedKey', () => {
        expect(() => makeBfsSolver({ step: () => null, inputs: ['a'] })).toThrow();
    });
});

describe('reach + bfsSolver on corridor world', () => {
    it('returns ok with empty plan when already at the goal', () => {
        const w = makeCorridor(5);
        const r = reach(w, corridorSolver, { pos: 2 }, atCell(2));
        expect(r.ok).toBe(true);
        expect(r.plan).toEqual([]);
        expect(r.steps).toBe(0);
    });

    it('finds the shortest path forward', () => {
        const w = makeCorridor(10);
        const r = reach(w, corridorSolver, { pos: 0 }, atCell(5));
        expect(r.ok).toBe(true);
        expect(r.steps).toBe(5);
        expect(r.plan).toEqual(['+', '+', '+', '+', '+']);
        const final = runPlan(w, { pos: 0 }, r.plan);
        expect(final.pos).toBe(5);
    });

    it('finds the shortest path backward', () => {
        const w = makeCorridor(10);
        const r = reach(w, corridorSolver, { pos: 7 }, atCell(2));
        expect(r.ok).toBe(true);
        expect(r.steps).toBe(5);
        const final = runPlan(w, { pos: 7 }, r.plan);
        expect(final.pos).toBe(2);
    });

    it('returns unreachable when the goal is never true', () => {
        const w = makeCorridor(5);
        const r = reach(w, corridorSolver, { pos: 0 }, () => false);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('unreachable');
    });

    it('returns budget_exceeded when budget is too small', () => {
        const w = makeCorridor(100);
        const r = reach(w, corridorSolver, { pos: 0 }, atCell(99), { budget: 3 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('budget_exceeded');
    });

    it('does not revisit states (visited-set correctness)', () => {
        const w = makeCorridor(6);
        const r = reach(w, corridorSolver, { pos: 0 }, atCell(5));
        // `expanded` is the number of dequeued frontier nodes. With a
        // proper visited set on a 6-cell corridor, BFS expands at most
        // one node per cell.
        expect(r.expanded).toBeLessThanOrEqual(6);
    });
});

describe('makeRandomWalkerSolver', () => {
    // A deterministic pickMove that always walks toward the goal — lets
    // us assert the walker plumbing works without depending on randomness.
    function pickTowardGoal(target) {
        return ({ legalMoves }) => {
            const forward = legalMoves.find((m) => m.input === '+' && m.nextState.pos <= target);
            if (forward) return forward.input;
            return legalMoves[0]?.input ?? null;
        };
    }
    // A random-ish picker: uniformly samples from legal moves.
    function pickUniform({ legalMoves, rng }) {
        return legalMoves[Math.floor(rng.next() * legalMoves.length)].input;
    }

    it('validates construction args', () => {
        expect(() => makeRandomWalkerSolver({ inputs: ['a'], visitedKey: () => '', pickMove: () => null })).toThrow();
        expect(() => makeRandomWalkerSolver({ step: () => null, inputs: [], visitedKey: () => '', pickMove: () => null })).toThrow();
        expect(() => makeRandomWalkerSolver({ step: () => null, inputs: ['a'], pickMove: () => null })).toThrow();
        expect(() => makeRandomWalkerSolver({ step: () => null, inputs: ['a'], visitedKey: () => '' })).toThrow();
    });

    it('requires an rng in options', () => {
        const solver = makeRandomWalkerSolver({
            step: corridorStep, inputs: ['+', '-'],
            visitedKey: (s) => `${s.pos}`, pickMove: pickUniform,
        });
        const w = makeCorridor(5);
        expect(() => reach(w, solver, { pos: 0 }, atCell(4), { trials: 1, stepBudget: 10 })).toThrow();
    });

    it('deterministic picker reaches the goal every trial', () => {
        const w = makeCorridor(10);
        const solver = makeRandomWalkerSolver({
            step: corridorStep, inputs: ['+', '-'],
            visitedKey: (s) => `${s.pos}`, pickMove: pickTowardGoal(5),
        });
        const rng = createRng(1);
        const r = reach(w, solver, { pos: 0 }, atCell(5), { trials: 10, stepBudget: 20, rng });
        expect(r.ok).toBe(true);
        expect(r.successes).toBe(10);
        expect(r.successFraction).toBe(1);
        expect(r.meanSuccessLength).toBe(5);
    });

    it('reports zero successes when stepBudget cuts trials short', () => {
        const w = makeCorridor(20);
        const solver = makeRandomWalkerSolver({
            step: corridorStep, inputs: ['+', '-'],
            visitedKey: (s) => `${s.pos}`, pickMove: pickTowardGoal(19),
        });
        const rng = createRng(1);
        const r = reach(w, solver, { pos: 0 }, atCell(19), { trials: 5, stepBudget: 3, rng });
        expect(r.ok).toBe(false);
        expect(r.successes).toBe(0);
        expect(r.successFraction).toBe(0);
        expect(r.meanSuccessLength).toBeNull();
    });

    it('is deterministic given a fixed rng seed', () => {
        const w = makeCorridor(15);
        const solver = makeRandomWalkerSolver({
            step: corridorStep, inputs: ['+', '-'],
            visitedKey: (s) => `${s.pos}`, pickMove: pickUniform,
        });
        const a = reach(w, solver, { pos: 7 }, atCell(14), { trials: 30, stepBudget: 80, rng: createRng(42) });
        const b = reach(w, solver, { pos: 7 }, atCell(14), { trials: 30, stepBudget: 80, rng: createRng(42) });
        expect(a).toEqual(b);
    });

    it('treats startState-already-at-goal as immediate success', () => {
        const w = makeCorridor(5);
        const solver = makeRandomWalkerSolver({
            step: corridorStep, inputs: ['+', '-'],
            visitedKey: (s) => `${s.pos}`, pickMove: pickUniform,
        });
        const r = reach(w, solver, { pos: 3 }, atCell(3), { trials: 4, stepBudget: 10, rng: createRng(1) });
        expect(r.successes).toBe(4);
        expect(r.meanSuccessLength).toBe(0);
    });

    it('aborts a trial when pickMove returns null', () => {
        const w = makeCorridor(10);
        const solver = makeRandomWalkerSolver({
            step: corridorStep, inputs: ['+', '-'],
            visitedKey: (s) => `${s.pos}`, pickMove: () => null,
        });
        const r = reach(w, solver, { pos: 0 }, atCell(5), { trials: 3, stepBudget: 20, rng: createRng(1) });
        expect(r.successes).toBe(0);
        expect(r.totalSteps).toBe(0);
    });
});

describe('solver pluggability', () => {
    it('reach simply delegates to whichever solver is passed', () => {
        const customSolver = ({ world, startState, goalPred }) => ({
            ok: goalPred(startState, world),
            plan: [],
            steps: 0,
            tag: 'custom',
        });
        const r = reach({}, customSolver, { x: 1 }, (s) => s.x === 1);
        expect(r.ok).toBe(true);
        expect(r.tag).toBe('custom');
    });
});
