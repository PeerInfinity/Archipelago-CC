/**
 * Shared simulator core — genre-agnostic machinery shared by playbots,
 * reachability analyzers, and procedural generators. See
 * NewDocs/plans/procedural-generation/shared-simulator-core.md for the
 * full design rationale.
 *
 * What lives here:
 *   - `reach(world, solver, startState, goalPred, options)` — the query
 *     wrapper. Delegates to a pluggable solver and returns its result.
 *   - `makeBfsSolver({ step, inputs, visitedKey })` — factory that
 *     builds a generic-search solver closed over a per-game step
 *     function, input set, and visited-key function.
 *
 * What does NOT live here:
 *   - World, State, Input, Edit shapes — game-specific.
 *   - step, apply, undo — game-specific implementations; the shape of
 *     the contract is what's shared, not the code.
 *   - Goal predicates — game-specific.
 *   - Configured-bot solvers — per-game, pluggable into reach() the
 *     same way the generic BFS solver is. Will live beside their
 *     respective game modules, not here.
 */

/**
 * Delegate to a pluggable solver. The solver contract is a function
 * `({ world, startState, goalPred, options }) -> ReachResult` where
 * ReachResult is at minimum `{ ok: boolean, ... }`. Solvers that find
 * a plan should return `{ ok: true, plan: Input[], steps: int, ... }`.
 */
export function reach(world, solver, startState, goalPred, options = {}) {
    return solver({ world, startState, goalPred, options });
}

/**
 * Build a random-walker solver closed over per-game primitives. Used
 * by procedural generators as a *difficulty* oracle — runs a batch of
 * randomized trials through `step`, reports what fraction reach the
 * goal within `stepBudget`. Distinct from bfsSolver which is a
 * *feasibility* oracle; the two are meant to be used together (see
 * maze-room-generator.md §"Why separating feasibility from difficulty
 * matters").
 *
 * Per-game primitives:
 *   - `step`, `inputs`, `visitedKey` — same contract as makeBfsSolver.
 *   - `pickMove({ world, state, legalMoves, visited, rng }) -> input | null`
 *     where `legalMoves` is `[{ input, nextState }, ...]`. Return the
 *     selected input, or `null` to abort the current trial as stuck.
 *     This is where per-game scoring (prefer-unvisited, distance bias,
 *     etc.) lives.
 *
 * Options (passed via `reach`):
 *   - `trials`       — number of independent trials (default 20).
 *   - `stepBudget`   — max steps per trial (default Infinity — caller
 *                      should almost always set something finite).
 *   - `rng`          — a `{ next(): number }`-shaped RNG. Required.
 *
 * Returns:
 *   {
 *     ok: boolean,                 // true iff any trial succeeded
 *     trials: number,
 *     successes: number,
 *     successFraction: number,     // successes / trials
 *     meanSuccessLength: number|null,
 *     totalSteps: number,
 *   }
 */
export function makeRandomWalkerSolver({ step, inputs, visitedKey, pickMove }) {
    if (typeof step !== 'function') throw new Error('makeRandomWalkerSolver: step must be a function');
    if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('makeRandomWalkerSolver: inputs must be a non-empty array');
    if (typeof visitedKey !== 'function') throw new Error('makeRandomWalkerSolver: visitedKey must be a function');
    if (typeof pickMove !== 'function') throw new Error('makeRandomWalkerSolver: pickMove must be a function');

    return function walkerSolver({ world, startState, goalPred, options }) {
        const trials = options.trials ?? 20;
        const stepBudget = options.stepBudget ?? Infinity;
        const rng = options.rng;
        if (!rng || typeof rng.next !== 'function') {
            throw new Error('walkerSolver: options.rng is required and must expose next()');
        }

        let successes = 0;
        let totalPathLength = 0;
        let totalSteps = 0;

        for (let t = 0; t < trials; t++) {
            let state = startState;
            let steps = 0;
            const visited = new Set([visitedKey(state)]);
            let ok = false;

            if (goalPred(state, world)) { ok = true; }

            while (!ok && steps < stepBudget) {
                const legalMoves = [];
                for (const input of inputs) {
                    const nextState = step(world, state, input);
                    if (nextState === null || nextState === undefined) continue;
                    legalMoves.push({ input, nextState });
                }
                if (legalMoves.length === 0) break;
                const chosen = pickMove({ world, state, legalMoves, visited, rng });
                if (chosen === null || chosen === undefined) break;
                const move = legalMoves.find((m) => m.input === chosen);
                if (!move) break; // pickMove returned an input not in legal set
                state = move.nextState;
                visited.add(visitedKey(state));
                steps += 1;
                if (goalPred(state, world)) { ok = true; }
            }

            totalSteps += steps;
            if (ok) {
                successes += 1;
                totalPathLength += steps;
            }
        }

        return {
            ok: successes > 0,
            trials,
            successes,
            successFraction: trials > 0 ? successes / trials : 0,
            meanSuccessLength: successes > 0 ? totalPathLength / successes : null,
            totalSteps,
        };
    };
}

/**
 * Build a BFS (generic-search) solver closed over per-game:
 *   - `step(world, state, input) -> state | null` — deterministic
 *     successor function. `null` means the input is illegal from this
 *     state.
 *   - `inputs: Input[]` — the input alphabet BFS will enumerate at
 *     each state.
 *   - `visitedKey(state) -> string` — hashes a state to a visited-set
 *     key. Must distinguish states that differ in anything
 *     reachability-relevant (position, inventory, any flags that gate
 *     step's behavior) but should not include irrelevant fields (turn
 *     counters, RNG state) or the search will never terminate.
 */
export function makeBfsSolver({ step, inputs, visitedKey }) {
    if (typeof step !== 'function') throw new Error('makeBfsSolver: step must be a function');
    if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('makeBfsSolver: inputs must be a non-empty array');
    if (typeof visitedKey !== 'function') throw new Error('makeBfsSolver: visitedKey must be a function');

    return function bfsSolver({ world, startState, goalPred, options }) {
        const budget = options.budget ?? Infinity;
        if (goalPred(startState, world)) {
            return { ok: true, plan: [], steps: 0, expanded: 0 };
        }
        const visited = new Set([visitedKey(startState)]);
        const frontier = [{ state: startState, plan: [] }];
        let expanded = 0;
        while (frontier.length > 0) {
            if (expanded >= budget) return { ok: false, reason: 'budget_exceeded', expanded };
            const { state, plan } = frontier.shift();
            expanded += 1;
            for (const input of inputs) {
                const nextState = step(world, state, input);
                if (nextState === null || nextState === undefined) continue;
                const key = visitedKey(nextState);
                if (visited.has(key)) continue;
                visited.add(key);
                const nextPlan = plan.concat(input);
                if (goalPred(nextState, world)) {
                    return { ok: true, plan: nextPlan, steps: nextPlan.length, expanded };
                }
                frontier.push({ state: nextState, plan: nextPlan });
            }
        }
        return { ok: false, reason: 'unreachable', expanded };
    };
}
