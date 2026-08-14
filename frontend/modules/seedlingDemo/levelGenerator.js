/**
 * seedlingDemo/levelGenerator — THE GENERATOR CORE: Cloudberry's loop,
 * inverted, with the solver as its oracle.
 *
 * Seedling PROCGEN PoC arc, slice 2 (kickoff §3.1 the loop, §3.2 the seam,
 * `NewDocs/plans/seedling-procgen-poc-kickoff.md`). One sentence: **start
 * from a room that solves, add one template at a time, re-solve, keep it if
 * the room still completes and throw the candidate away if it does not.**
 *
 * ── ⛔ THIS FILE IMPORTS NOTHING ──────────────────────────────────────
 *
 * Not from `seedlingDemo/`, not from anywhere. ⚖ Kickoff §3.2: the level
 * model, the oracle and the palette are INJECTED, and the Seedling bindings
 * (`procgenSeedling.js`) are where the imports live. ⚖ §1.7 is the reason and
 * it is a bounded one: the user's forward plan is a generator for a different
 * tile-based platformer, so this loop is written against a named seam with
 * ONE implementation — no framework on a sample of one, and no second
 * implementation invented here to prove the seam is real. The proof that the
 * seam is real is that `levelGenerator.test.js` drives this loop with a fake
 * model, a fake oracle and a fake palette that know nothing about Seedling.
 *
 * ── WHY IT IS DEPTH-1 KEEP-OR-REVERT AND NOT A SEARCH ─────────────────
 *
 * ⚖ Kickoff §1.6: an obstacle that needs something specific to clear it is
 * placed ATOMICALLY WITH ITS CLEARER, so a candidate never needs a second
 * cooperating placement to become solvable. That is what removes the DFS
 * Cloudberry's own design AI needs — there, blocks ARE the level and a
 * half-built path is unsolvable by construction; here the empty bordered room
 * is trivially solvable and every template CONSTRAINS an existing floor.
 *
 * ── ⛔ REVERT IS "KEEP THE OLD RECORD", WHICH IS WHY THE MODEL IS PURE ─
 *
 * There is no undo in this file and there must not be one. `place` returns a
 * NEW record and a rejected candidate is discarded by dropping the reference;
 * the accepted record is only ever reassigned. An undo would be a second
 * description of every template's effect, and the two would agree until
 * somebody added a template that wrote two things.
 *
 * ── ⚠⚠ NOTHING BOUNDS THIS LOOP'S ELAPSED TIME, AND IT MUST SAY SO ────
 *
 * `procgenOracle`'s residue, inherited whole: a solve is synchronous and
 * uninterruptible, so the per-solve budget bounds what the loop ACCEPTS and
 * never what it SPENDS. ⛓ Since 2026-08-14 that budget is not denominated in
 * time at all — a wall clock stood here and was removed, because measuring
 * elapsed time after the fact and RECLASSIFYING a finished solve on it let the
 * machine decide which levels existed (`procgenOracle`'s DEFAULT_BUDGET
 * docblock has the measurements). ⇒ the honest statement of this loop's cost is
 * ARITHMETIC — `steps x triesPerStep x worst-case solve` — and `costModel()`
 * computes it from the bounds so a caller can state it BEFORE running rather
 * than discover it after. The measured total goes in the summary; ⛔ it never
 * goes in the trace, because the trace is a determinism artifact and a
 * millisecond is the one thing two runs of one seed may honestly differ on.
 *
 * ── WHAT A TRACE ROW OWES ─────────────────────────────────────────────
 *
 * ⚖ Kickoff §7.4 demands *"every placement, every veto with its verdict class
 * and verbatim reason, every bound named"*. So every attempt — kept or not —
 * is a row carrying the template, the anchor, the verdict class, the refusal
 * text VERBATIM, `classifiedBy` (the oracle's own account of HOW it decided),
 * and the rng state before the draw. Trap 202's law applies to the whole
 * design: the danger channel is empty on every success BY CONSTRUCTION, so
 * the REFUSAL REASONS are the evidence channel and a paraphrase would be a
 * lossy copy of the only content.
 */

export class LevelGeneratorError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LevelGeneratorError';
    }
}

/**
 * ⛔⛔⛔ AN ENGINE ERROR ESCAPING THE ORACLE ABORTS THE RUN — IT IS NEVER A
 * REVERT.
 *
 * `procgenOracle` turns exactly two throws into verdicts (`SolverRefusal`,
 * `BotDriverV2Error`) and lets everything else propagate, for the reason
 * traps 171/173 name: a loop that quietly reverted an engine error would hide
 * its own defects behind *"that candidate didn't work out"*, and the palette
 * would look narrow when the generator was broken. So this loop does not
 * widen that catch by one class.
 *
 * ⚠ WHAT IT DOES INSTEAD IS KEEP THE EVIDENCE. The trace up to the abort —
 * every kept template, every rejection with its verbatim reason, the anchor
 * that was being tried when the engine threw — is exactly the material a
 * reader needs, and rethrowing bare would throw it away. So the abort carries
 * `trace`, `record` (the last SOLVED one) and `cause`, and the CLI prints
 * them. ⛓ SLICE 2 MEASURED ONE: a generated room whose pit patch sits beside
 * the corridor makes the walk fall in, and `playerPhysicsV2` throws BY NAME
 * ("the player fell into a pit in level 900, which has NO control block …
 * the route must not step on it"). That is a claim about the SOLVER's route,
 * not about this loop, and it is a finding rather than a rejected candidate.
 */
export class GenerationAborted extends Error {
    constructor(message, { trace, record, summary, cause } = {}) {
        super(message);
        this.name = 'GenerationAborted';
        this.trace = trace;
        this.record = record;
        this.summary = summary;
        this.cause = cause;
    }
}

const fail = (message) => { throw new LevelGeneratorError(message); };

/**
 * THE FOUR OUTCOMES OF ONE ATTEMPT, and the fourth is not an oracle verdict.
 *
 * ⚠ `ILLEGAL_PLACEMENT` is decided by the MODEL, before any solve: a
 * template whose footprint leaves the room, overlaps another template or
 * covers the start or the goal never becomes a level at all. It is a separate
 * class rather than a REFUSED because the two answer different questions —
 * "this room is unsolvable" and "this was never a room" — and a generator
 * that filed them together would report a palette hole where it had a
 * geometry bug. The oracle's own three classes ride through verbatim in
 * `verdict`; this one is the loop's.
 */
export const ATTEMPT = Object.freeze({
    KEPT: 'KEPT',
    REVERTED: 'REVERTED',
    ILLEGAL_PLACEMENT: 'ILLEGAL_PLACEMENT',
    NO_ANCHOR: 'NO_ANCHOR',
    /** The engine threw something the oracle does not classify — see `GenerationAborted`. */
    ABORTED: 'ABORTED',
});

/** Why the loop stopped — always one of these, never an empty exit. */
export const STOP = Object.freeze({
    TARGET_REACHED: 'TARGET_REACHED',
    SATURATED: 'SATURATED',
});

/**
 * ⛔ THE BOUNDS, DEFAULTED IN ONE PLACE AND NAMED IN THE TRACE.
 *
 * ⚖ Kickoff §5: *"bounded sweeps name their bounds"* — and the reason this is
 * a frozen object rather than three parameters with defaults at the call site
 * is that the trace has to carry the bounds THAT RAN, not the bounds a reader
 * assumes. `summary.bounds` is this object, after merging.
 *
 * ⛓⛓ `obstacleTarget`'s DEFAULT IS A MEASUREMENT, NOT A TASTE. Slice 2 ran
 * seeds 1..20 of the pre-sword palette in a 10x10 room at six targets and
 * counted how often the ORACLE ITSELF fell over (see `GenerationAborted`):
 *
 *     target  4 → 20/20 clean      target 10 → 19/20 (1 pit death)
 *     target  6 → 20/20 clean      target 12 → 16/20 (4)
 *     target  8 → 20/20 clean      target 14 → 15/20 (5, 1 saturated)
 *
 * ⇒ **eight obstacles is the measured ceiling for a 10x10 room** and six is
 * the default, inside it. Past that the room's corridors get tight enough
 * that the solver's own approach drive clips lethal terrain the corridor
 * planner routed around — a finding about the ORACLE in dense rooms, which
 * is exactly the kind of thing a generator is for. The number is a bound
 * somebody measured, and a caller may raise it: what they may not do is
 * raise it and be surprised.
 *
 * `obstacleTarget` — how many templates the loop wants to KEEP.
 * `triesPerStep`   — how many candidates one step may draw before the step
 *                    counts as a reject. Bounded because a step that keeps
 *                    drawing from a palette whose every template refuses is
 *                    not searching, it is spinning.
 * `saturationK`    — consecutive reject STEPS that end the run. ⚖ §3.1's
 *                    "saturation — reported as such, never silent".
 */
export const DEFAULT_BOUNDS = Object.freeze({
    obstacleTarget: 6,
    triesPerStep: 8,
    saturationK: 3,
});

function assertBounds(bounds) {
    const b = { ...DEFAULT_BOUNDS, ...(bounds ?? {}) };
    for (const key of ['obstacleTarget', 'triesPerStep', 'saturationK']) {
        if (!Number.isInteger(b[key]) || b[key] <= 0) {
            fail(`levelGenerator: bounds.${key} must be a positive integer, got `
                + `${JSON.stringify(b[key])}. Every bound this loop runs under is named `
                + 'in its own trace (⚖ kickoff §5), so there is no default that means '
                + '"unbounded".');
        }
    }
    return Object.freeze(b);
}

/**
 * THE COST OF A RUN, BEFORE IT RUNS — the only honest mitigation for a loop
 * whose budget bounds what it ACCEPTS and never what it SPENDS.
 *
 * ⚠ It is an UPPER BOUND and it says so: the loop stops early on saturation
 * and a step usually keeps its first or second candidate. The number worth
 * stating out loud is the ceiling, because that is the one a reader who
 * expected a timeout would be surprised by.
 */
export function costModel(bounds, worstCaseSolveMs) {
    const b = assertBounds(bounds);
    const solves = 1 + b.obstacleTarget * b.triesPerStep;
    return Object.freeze({
        solves,
        worstCaseSolveMs,
        worstCaseTotalMs: Number.isFinite(worstCaseSolveMs)
            ? solves * worstCaseSolveMs : null,
        why: `1 skeleton solve + obstacleTarget(${b.obstacleTarget}) x `
            + `triesPerStep(${b.triesPerStep}) candidate solves, every one of which is `
            + 'SYNCHRONOUS and uninterruptible — the per-solve budget bounds what the '
            + 'loop ACCEPTS, never what it SPENDS (procgenOracle\'s residue).',
    });
}

const assertHas = (obj, names, what) => {
    for (const n of names) {
        if (typeof obj?.[n] !== 'function') {
            fail(`levelGenerator: the injected ${what} needs a \`${n}\` function `
                + `(kickoff §3.2's seam). Got ${obj === undefined ? 'nothing'
                    : `${typeof obj?.[n]} for ${n}`}.`);
        }
    }
};

/**
 * GENERATE ONE LEVEL — the whole of kickoff §3.1, in one function.
 *
 * @param {object} o
 * @param {object} o.rng      the seeded stream (`pick`, `nextInt`, `state`,
 *                            `draws`, `seed`). ⛔ No `Math.random`, no
 *                            `Date.now`, no ambient anything: the seed is the
 *                            level's identity (⚖ kickoff §5).
 * @param {object} o.model    `{ skeleton(), anchorFor(record, template, rng),
 *                            place(record, template, at) }` — pure; `place`
 *                            returns a NEW record and throws BY NAME on an
 *                            illegal placement.
 * @param {object} o.oracle   `{ solve(record, {templates}) }` → a verdict
 *                            object carrying at least `{verdict}`; SOLVED is
 *                            the only keep.
 * @param {object} o.palette  `{ name, templates: [...] }`
 * @param {object} [o.bounds] see `DEFAULT_BOUNDS`
 * @returns {{record, trace, summary}}
 */
export function generateLevel({ rng, model, oracle, palette, bounds } = {}) {
    const b = assertBounds(bounds);
    assertHas(model, ['skeleton', 'anchorFor', 'place'], 'model');
    assertHas(oracle, ['solve'], 'oracle');
    if (!palette || !Array.isArray(palette.templates) || palette.templates.length === 0) {
        fail('levelGenerator: the palette must be `{name, templates: [...]}` with at '
            + 'least one template. An empty palette is a finding ABOUT THE PALETTE '
            + '(what the oracle can adjudicate), not a run that quietly places nothing.');
    }
    if (!rng || typeof rng.pick !== 'function' || typeof rng.nextInt !== 'function') {
        fail('levelGenerator: the rng must carry `pick` and `nextInt` (procgenRng). '
            + 'A generator without a seeded stream cannot be reproduced, and ⚖ kickoff '
            + '§5 makes the seed part of the level\'s identity.');
    }

    const trace = [];
    const kept = [];
    let record = model.skeleton();

    /**
     * ⛔⛔ THE SKELETON MUST SOLVE, AND ITS FAILURE IS A THROW RATHER THAN A
     * VERDICT. ⚖ Kickoff §3.1 step 1: the empty bordered room is trivially
     * solvable, so the first solve is a check on the ROOM BUILDER — and every
     * later refusal is attributable to a placed template precisely because
     * this one passed. A loop that recorded a failed skeleton as "step 0
     * reverted" would go on to blame the palette for a broken room.
     */
    const skeleton = oracle.solve(record, { templates: [] });
    if (skeleton.verdict !== 'SOLVED') {
        fail(`levelGenerator: THE SKELETON DID NOT SOLVE — ${skeleton.verdict}. The `
            + 'empty bordered room with its goal is the loop\'s control: it is solvable '
            + 'by construction, so this is a defect in the room builder, the boot or '
            + 'the goal, and NOT a rejected candidate. The oracle said: '
            + `${JSON.stringify(skeleton.reasonText ?? skeleton.classifiedBy ?? null)}`);
    }
    trace.push(Object.freeze({
        step: 0,
        try: 0,
        outcome: ATTEMPT.KEPT,
        template: null,
        family: 'skeleton',
        at: null,
        verdict: skeleton.verdict,
        ticks: skeleton.ticks ?? null,
        classifiedBy: skeleton.classifiedBy ?? null,
        reasonText: null,
        rngStateBefore: rng.state,
        drawsBefore: rng.draws,
    }));

    let consecutiveRejectSteps = 0;
    let stop = STOP.TARGET_REACHED;
    let lastSolve = skeleton;

    for (let step = 1; kept.length < b.obstacleTarget; step += 1) {
        if (consecutiveRejectSteps >= b.saturationK) {
            stop = STOP.SATURATED;
            break;
        }
        let keptThisStep = false;
        for (let attempt = 1; attempt <= b.triesPerStep; attempt += 1) {
            const rngStateBefore = rng.state;
            const drawsBefore = rng.draws;
            const template = rng.pick(palette.templates);
            const row = {
                step,
                try: attempt,
                template: template.name,
                family: template.family,
                rngStateBefore,
                drawsBefore,
            };
            /**
             * ⛓ AN ANCHOR IS THE MODEL'S ANSWER, AND "NONE" IS ONE OF ITS
             * ANSWERS. A template whose footprint no longer fits anywhere in
             * a room that has filled up is not an error and not a refusal —
             * it is the room being full of that shape, which is a fact the
             * saturation counter should hear about.
             */
            const at = model.anchorFor(record, template, rng);
            if (!at) {
                trace.push(Object.freeze({
                    ...row,
                    outcome: ATTEMPT.NO_ANCHOR,
                    at: null,
                    verdict: null,
                    ticks: null,
                    classifiedBy: 'the model found no legal anchor for this template in '
                        + 'this room',
                    reasonText: null,
                }));
                continue;
            }
            let candidate = null;
            try {
                candidate = model.place(record, template, at);
            } catch (e) {
                /**
                 * ⛔ ONLY THE MODEL'S OWN REFUSAL IS AN OUTCOME. `withTerrain`
                 * refuses an out-of-rectangle cell and a cell named twice BY
                 * NAME, and those are legitimate answers about a candidate.
                 * Anything else — a TypeError, an engine error — is a defect
                 * in the generator, and a loop that reverted it would hide
                 * its own bugs behind "that candidate didn't work out"
                 * (traps 171/173, the same reasoning `procgenOracle` applies
                 * to what it catches). The caller decides which name is
                 * theirs; `model.placementError` is that declaration.
                 */
                if (!model.placementError || !(e instanceof model.placementError)) throw e;
                trace.push(Object.freeze({
                    ...row,
                    outcome: ATTEMPT.ILLEGAL_PLACEMENT,
                    at,
                    verdict: null,
                    ticks: null,
                    classifiedBy: 'the level model refused the placement before any solve',
                    reasonText: e.message,
                }));
                continue;
            }
            let out;
            try {
                out = oracle.solve(candidate, { templates: [...kept, template] });
            } catch (e) {
                trace.push(Object.freeze({
                    ...row,
                    outcome: ATTEMPT.ABORTED,
                    at,
                    verdict: null,
                    ticks: null,
                    classifiedBy: `the oracle let a ${e.name} escape — it classifies only `
                        + 'the two throws that are claims about a LEVEL, and anything '
                        + 'else is a defect somewhere in the engine, the model or this '
                        + 'loop (traps 171/173)',
                    reasonText: e.message,
                }));
                throw new GenerationAborted(
                    `levelGenerator: ABORTED at step ${step} try ${attempt} placing `
                    + `"${template.name}" at (${at.tx},${at.ty}) — the oracle threw a `
                    + `${e.name}, which is NOT one of the three verdict classes and is `
                    + 'therefore not a rejected candidate. The trace up to here is '
                    + 'attached; the engine said: ' + e.message,
                    { trace, record, summary: { kept: [...kept], bounds: b }, cause: e },
                );
            }
            const keep = out.verdict === 'SOLVED';
            trace.push(Object.freeze({
                ...row,
                outcome: keep ? ATTEMPT.KEPT : ATTEMPT.REVERTED,
                at,
                verdict: out.verdict,
                ticks: out.ticks ?? null,
                classifiedBy: out.classifiedBy ?? null,
                // ⛔ VERBATIM, always — the refusal's own text is the evidence
                // channel and this loop is not allowed to summarise it.
                reasonText: out.reasonText ?? null,
                budgetKind: out.budgetKind ?? null,
            }));
            if (keep) {
                record = candidate;
                kept.push({ template: template.name, family: template.family, at });
                lastSolve = out;
                keptThisStep = true;
                break;
            }
        }
        consecutiveRejectSteps = keptThisStep ? 0 : consecutiveRejectSteps + 1;
        if (!keptThisStep && consecutiveRejectSteps >= b.saturationK) {
            stop = STOP.SATURATED;
            break;
        }
    }

    const byFamily = {};
    for (const r of trace) {
        if (r.family === 'skeleton') continue;
        const f = (byFamily[r.family] ??= { kept: 0, reverted: 0, illegal: 0, noAnchor: 0 });
        if (r.outcome === ATTEMPT.KEPT) f.kept += 1;
        else if (r.outcome === ATTEMPT.REVERTED) f.reverted += 1;
        else if (r.outcome === ATTEMPT.ILLEGAL_PLACEMENT) f.illegal += 1;
        else f.noAnchor += 1;
    }

    return {
        record,
        trace,
        summary: Object.freeze({
            seed: rng.seed ?? null,
            palette: palette.name,
            bounds: b,
            /**
             * ⛔ THE BUDGET THE ORACLE RAN UNDER, carried here rather than
             * described: a trace that named a budget the solve did not use
             * would be trap "a comment naming an arm nobody built" in its
             * purest form. The bindings put the oracle's own frozen budget on
             * `oracle.budget`.
             */
            budget: oracle.budget ?? null,
            stop,
            keptCount: kept.length,
            kept,
            attempts: trace.length - 1,
            byFamily,
            skeletonTicks: skeleton.ticks ?? null,
            finalTicks: lastSolve.ticks ?? null,
            finalCertification: lastSolve.certification ?? null,
            drawsSpent: rng.draws,
            rngState: rng.state,
        }),
    };
}
