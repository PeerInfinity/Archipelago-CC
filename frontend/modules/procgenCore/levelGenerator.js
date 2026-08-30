/**
 * procgenCore/levelGenerator — THE GENERATOR CORE: Cloudberry's loop,
 * inverted, with the solver as its oracle.
 *
 * Seedling PROCGEN PoC arc, slice 2 (kickoff §3.1 the loop, §3.2 the seam,
 * `NewDocs/plans/seedling-procgen-poc-kickoff.md`). One sentence: **start
 * from a room that solves, add one template at a time, re-solve, keep it if
 * the room still completes and throw the candidate away if it does not.**
 *
 * ── ⛓⛓⛓ IT LIVES OUTSIDE `seedlingDemo/` SINCE 2026-08-15 ────────────
 *
 * CONSTRUCTIVE-MODE arc, slice 2 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.2), and the move is the PoC arc's own §1.7 provision being
 * spent: *"when a second substrate exists and can argue about the interface,
 * the core moves and the bindings stay."* The second substrate is the maze
 * (`mazeRoom/procgenMaze.js`), so the loop now sits in a neutral directory
 * that neither substrate owns — ⚖ ruling 4: the outer repo for now, promoted
 * to `shared/` when it settles. The Seedling bindings did not move and the
 * levels this loop produces did not move: the move was gated on the battery,
 * the acceptance batch, the generated-set round trip, the browser row and the
 * full `seedlingDemo` suite all coming back byte-identical.
 *
 * ── ⛔ THIS FILE IMPORTS NOTHING ──────────────────────────────────────
 *
 * Not from `seedlingDemo/`, not from `mazeRoom/`, not from anywhere. ⚖ Kickoff
 * §3.2: the level model, the oracle and the palette are INJECTED, and the
 * bindings (`seedlingDemo/procgenSeedling.js`, `mazeRoom/procgenMaze.js`) are
 * where the imports live. ⚖ §1.7 is the reason and it was a bounded one: the
 * loop was written against a named seam with ONE implementation — no framework
 * on a sample of one — and the second implementation was not invented here to
 * prove the seam is real. It arrived when a substrate needed it. The proof that
 * the seam is real is now doubled: `levelGenerator.test.js` drives this loop
 * with a fake model, a fake oracle and a fake palette, and
 * `mazeRoom/procgenMaze.test.js` drives it with a REAL second substrate whose
 * world model, oracle and palette share nothing with Seedling's.
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
 * ── ⛓⛓⛓ THE PALETTE'S ROWS ARE **FUNCTIONS** (GENERATE-mode UI slice 2) ─
 *
 * ⚖ The user's ruling: *"a collection of functions that each generate a
 * coherent set of features for the map, instead of a collection of predefined
 * arrangements of tiles."* So a palette template is
 * `{name, family, params, instantiate(rng, overrides)}`, and this loop's ONE
 * change is that after `rng.pick(palette.templates)` it calls `instantiate`
 * and proceeds with the CONCRETE ROW — which is exactly the shape the model
 * and the oracle already consumed. Nothing downstream of that call learns the
 * migration happened.
 *
 * ⛔ `instantiate` IS REQUIRED, NOT PROBED FOR. A `typeof t.instantiate ===
 * 'function' ? … : t` here would be a graceful fallback that let an
 * un-migrated frozen row through the loop for ever, drawing no parameters and
 * appearing in no domain sweep — the family this repo files under "a graceful
 * fallback reports a vacuous success". The palette check below refuses by name
 * instead.
 *
 * ⚠ THE DRAW COUNT PER ATTEMPT IS THEREFORE TEMPLATE-DEPENDENT (two for a
 * two-parameter row, none for a zero-parameter one). That is harmless because
 * the template is drawn FIRST: the stream decides which row it is buying
 * before it spends anything on that row's parameters, so the sequence is a
 * function of the seed and of nothing else.
 *
 * ── ⛓⛓⛓ THE ANCHOR SEARCH (GENERATE-mode UI slice 3, track B) ────────
 *
 * ⚖ The user's ruling 7: *"look for a viable place to put the template, and
 * put it there if possible."* One candidate is now solved at up to
 * `anchorTriesPerCandidate` of the model's legal anchors and kept at the FIRST
 * that solves — where the loop used to test exactly one cell and give the
 * candidate up on it.
 *
 * ⛔ DEFAULT 1 IS TODAY'S BEHAVIOUR, and the byte-inertness is by
 * construction rather than by measurement-and-hope: the model spends ONE
 * shuffle per candidate whatever the limit is, so the bound only decides how
 * far down an order the stream already fixed the loop is allowed to walk.
 * (It is measured anyway — the as-built carries the comparison.)
 *
 * ⛔⛔ THE SEARCH DOES NOT WIDEN WHAT IS ACCEPTED, AND IT DOES NOT CATCH.
 * Every anchor is adjudicated by the same oracle, every one is a trace row,
 * and an engine THROW still aborts the whole run with its evidence: a walk
 * that swallowed one and moved to the next cell would be traps 171/173 with
 * more places to hide.
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
/**
 * ⛓⛓⛓ THE ORACLE'S THREE VERDICT CLASSES — **THE ONE CONTRACT CHANGE THE MAZE
 * FORCED** (CONSTRUCTIVE-MODE slice 2), and the line that forced it is `:464`
 * below: `out.verdict === 'SOLVED'`.
 *
 * Until there were two substrates this vocabulary was declared in
 * `seedlingDemo/procgenOracle.js` and spelled as a bare string HERE, and the
 * pair was harmless because only one oracle existed. `mazeRoom/procgenMaze.js`
 * is a second oracle that must return the same word, and it may not import
 * Seedling's file — so the choice was a third spelling in the maze or ONE
 * declaration in the file both oracles are written against. ⚖ Kickoff §3.2's
 * rule ("a change is made only when the maze bindings cannot be written
 * without it, and the as-built names which line forced it") is satisfied by
 * exactly this.
 *
 * ⛔ THE STRINGS DID NOT MOVE. `procgenOracle.js` imports and re-exports this
 * object under its own name, so every Seedling reader — the page, the CLI, the
 * batch, `procgenSeedling`'s own `export { VERDICT }` — sees the identical
 * frozen object with the identical three values, and the payloads are
 * byte-identical across the move.
 *
 * A REFUSAL is a claim about the LEVEL; a BUDGET EXHAUSTION is a claim about
 * the SEARCH and never a proof of unsolvability. `procgenOracle`'s docblock
 * carries the argument in full; it is not repeated here, because this is the
 * VOCABULARY and that file is the one that classifies.
 */
export const VERDICT = Object.freeze({
    SOLVED: 'SOLVED',
    REFUSED: 'REFUSED',
    BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
});

export const ATTEMPT = Object.freeze({
    KEPT: 'KEPT',
    REVERTED: 'REVERTED',
    ILLEGAL_PLACEMENT: 'ILLEGAL_PLACEMENT',
    NO_ANCHOR: 'NO_ANCHOR',
    /** The engine threw something the oracle does not classify — see `GenerationAborted`. */
    ABORTED: 'ABORTED',
});

/**
 * ⛓⛓⛓ WHAT AN ANCHOR WALK ACCEPTS — GENERATE-mode UI slice 5, and ⚖ THE
 * USER'S RULING: *verb 2 PREFERS DISCHARGE; the free loop keeps FIRST-SOLVED.*
 *
 * ⛔ **`FIRST_SOLVED` IS THE DEFAULT AND THAT IS A REQUIREMENT, NOT A TASTE.**
 * The free-running ladder's semantics are unchanged by this slice; the
 * preference is a property of the DIRECTED entry, where the user has asked
 * about THIS template and is paying for a wider, choosier walk. A default that
 * had to be passed in to get today's behaviour would put the old semantics one
 * forgotten argument away from vanishing.
 *
 * `PREFER_DISCHARGE` — walk the offered anchors and keep the FIRST whose solve
 * discharges the template's own verb; if none does, keep the first that merely
 * SOLVED. ⛔ It never accepts something `FIRST_SOLVED` would have rejected: the
 * two policies choose WHERE among solving anchors, and neither one widens what
 * counts as a yes.
 */
export const KEEP_POLICY = Object.freeze({
    FIRST_SOLVED: 'first-solved',
    PREFER_DISCHARGE: 'prefer-discharge',
});

/**
 * ⛓⛓ WHICH KIND OF KEEP IT WAS — three answers, and the third is why this is
 * an enum rather than a boolean.
 *
 * `DISCHARGED`  — the solve carries a `{strategy}` record naming this
 *                 template's own verb (⚖ §12.1's evidence standard).
 * `SOLVED_ONLY` — it has a verb and this solve did not discharge it. The walk
 *                 looked for the good outcome and settled.
 * `NO_VERB`     — ⛔ THE TEMPLATE HAS NO VERB TO DISCHARGE (a wall, a pool, a
 *                 pit, an arrow lane). First-SOLVED is its WHOLE criterion and
 *                 nothing was missed. Reporting this as `SOLVED_ONLY` would be
 *                 a readout claiming a shortfall that could not exist — the
 *                 shape trap 249 names, so the three cases are never blurred
 *                 into two.
 *
 * ⛔⛔ AND `null` IS A FOURTH ANSWER THAT IS NOT A MEMBER: under
 * `FIRST_SOLVED` **nothing asked**, so there is no kind to report. ⛓ SLICE 6
 * FIXED A REAL MISLABEL HERE: `directedAttempt` used to write
 * `walk.hit.kind ?? NO_VERB`, so `?directed=wall-gap-block(…)@12s` — a
 * spelling the URL has accepted since slice 5 — reported *"this family has NO
 * verb to discharge"* about a DOOR. A default is not an answer; the honest
 * value for "the policy did not ask" is the absence, and `describeKeptKind`
 * prints that case by name.
 */
export const KEPT_KIND = Object.freeze({
    DISCHARGED: 'discharged',
    SOLVED_ONLY: 'solved-only',
    NO_VERB: 'solved-no-verb',
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
 *
 * ⛓⛓⛓ `anchorTriesPerCandidate` — GENERATE-mode UI slice 3, TRACK B, and ⚖ the
 * user's ruling 7: *"look for a viable place to put the template, and put it
 * there if possible."* How many of the model's legal anchors one candidate may
 * be SOLVED at before the candidate is given up on.
 *
 * ⛔ **THE DEFAULT IS 1, WHICH IS EXACTLY TODAY'S BEHAVIOUR**, and that is a
 * requirement rather than a preference: the free-running ladder's cost profile
 * must not multiply the day the knob arrives. The cost model below carries the
 * factor so a caller raising it states the ceiling before pressing.
 *
 * ⛓ WHY THE BOUND EXISTS AT ALL, MEASURED (slice 2 §9.3, quoted in
 * `procgenPalette`'s `wall-gap-block` docblock): the plain door's `ori=v`
 * discharges its verb at 1–2 of 12 seeds when ONE anchor is tried, and at 18–21
 * when every legal anchor is. *The vertical door is not worse — the FIRST
 * anchor the shuffle hands it is.* A generator that reports a template
 * unviable on one unlucky cell is measuring the shuffle, not the palette.
 *
 * ⛔ IT DOES NOT WIDEN WHAT IS ACCEPTED. Every anchor is still adjudicated by
 * the oracle and every one is a TRACE ROW; the search chooses WHERE to ask, and
 * never what counts as a yes.
 */
export const DEFAULT_BOUNDS = Object.freeze({
    obstacleTarget: 6,
    triesPerStep: 8,
    saturationK: 3,
    anchorTriesPerCandidate: 1,
});

function assertBounds(bounds) {
    const b = { ...DEFAULT_BOUNDS, ...(bounds ?? {}) };
    for (const key of ['obstacleTarget', 'triesPerStep', 'saturationK',
        'anchorTriesPerCandidate']) {
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
    /**
     * ⛓ SLICE 3 TRACK B ADDED THE THIRD FACTOR. One candidate is now solved at
     * up to `anchorTriesPerCandidate` anchors, so the ceiling multiplies —
     * which is precisely why the bound defaults to 1 and why this number is
     * printed before the press rather than discovered after it.
     */
    const solves = 1 + b.obstacleTarget * b.triesPerStep * b.anchorTriesPerCandidate;
    return Object.freeze({
        solves,
        worstCaseSolveMs,
        worstCaseTotalMs: Number.isFinite(worstCaseSolveMs)
            ? solves * worstCaseSolveMs : null,
        why: `1 skeleton solve + obstacleTarget(${b.obstacleTarget}) x `
            + `triesPerStep(${b.triesPerStep}) x `
            + `anchorTriesPerCandidate(${b.anchorTriesPerCandidate}) candidate solves, every `
            + 'one of which is SYNCHRONOUS and uninterruptible — the per-solve budget bounds '
            + 'what the loop ACCEPTS, never what it SPENDS (procgenOracle\'s residue).',
    });
}

/**
 * ── ⛓⛓⛓ THE ANCHOR WALK — **ONE** OF THEM, TWO POLICIES (slice 5) ─────
 *
 * The free loop and the directed attempt ask the same question of the same
 * seam in the same order — place, solve, decide, next anchor — and differ in
 * exactly one thing: WHICH of the solving anchors they take. So there is one
 * walk with a `keepPolicy`, rather than two walks that would agree until
 * somebody fixed a refusal in one of them.
 *
 * ⛔⛔ **AT `FIRST_SOLVED` THIS FUNCTION IS THE PRE-SLICE LOOP, INSTRUCTION FOR
 * INSTRUCTION.** `take` is true at the first SOLVED anchor, so the loop breaks
 * there, `fallback` is never written and the fix-up below never runs. That is
 * what makes the free ladder byte-inert BY CONSTRUCTION and not by
 * measurement-and-hope — and it is measured anyway (the as-built carries the
 * comparison, the same method slice 3 used for the bound).
 *
 * ── ⚠ ONE COMBINATION THIS SLICE MAKES POSSIBLE, AND IT IS NOT A BLUR ──
 *
 * Under `PREFER_DISCHARGE` an anchor can be `outcome: REVERTED` with
 * `verdict: SOLVED` — the oracle solved that room and the walk passed it over
 * looking for one that discharges. ⛔ That reads correctly in the existing
 * vocabulary and needed no fifth outcome: `verdict` is the ORACLE's answer and
 * `outcome` is the LOOP's decision, and `procgenOracle` writes them separately
 * for exactly this reason. It cannot occur under `FIRST_SOLVED`, where the
 * first SOLVED anchor is always taken.
 *
 * ⛔ **NO NEW ROW KEY.** The rows this emits carry exactly the keys they
 * carried before this slice, because a `keptKind: null` stapled to every row
 * would move the free ladder's trace bytes — the thing slice 3 measured and
 * this slice must not spend. The walk's own story rides in what it RETURNS
 * (`kind`, `anchorsWalked`), which the directive record and the readout carry.
 *
 * @param {object} o
 * @param {Array}  o.anchors   the anchors to walk, in the model's order
 * @param {string} o.keepPolicy see `KEEP_POLICY`
 * @param {Function} [o.discharges] `(family, records) => boolean|null` —
 *   REQUIRED by `PREFER_DISCHARGE` and refused if missing (a policy that
 *   silently degraded to first-SOLVED because its predicate was absent is the
 *   graceful fallback that reports a vacuous success).
 * @param {Function} o.onAbort called with the engine error before it
 *   propagates; expected to throw. If it returns, the error is rethrown bare —
 *   ⛔ this walk never survives an engine throw (traps 171/173).
 * @returns {{rows: Array, hit: object|null, walked: number}}
 */
function walkAnchors({
    anchors, record, template, model, oracle, solveTemplates, rowBase,
    keepPolicy = KEEP_POLICY.FIRST_SOLVED, discharges = null, onAbort,
}) {
    if (keepPolicy !== KEEP_POLICY.FIRST_SOLVED
        && keepPolicy !== KEEP_POLICY.PREFER_DISCHARGE) {
        fail(`levelGenerator: keepPolicy must be one of [${Object.values(KEEP_POLICY)
            .join(', ')}], got ${JSON.stringify(keepPolicy)}. The policy decides which of `
            + 'the SOLVING anchors is kept, so there is no value meaning "whichever".');
    }
    if (keepPolicy === KEEP_POLICY.PREFER_DISCHARGE && typeof discharges !== 'function') {
        fail('levelGenerator: keepPolicy "prefer-discharge" needs a `discharges(family, '
            + 'records)` predicate, and none was given. ⛔ It REFUSES rather than falling '
            + 'back to first-SOLVED: a preference that silently stopped preferring would '
            + 'report exactly the outcome it was asked to improve on, and nothing on the '
            + 'page could tell the two runs apart.');
    }
    const rows = [];
    let hit = null;
    let fallback = null;
    let walked = 0;
    for (let ai = 0; ai < anchors.length; ai += 1) {
        const at = anchors[ai];
        const anchorRow = { ...rowBase, anchorTry: ai + 1, anchorsOffered: anchors.length };
        walked = ai + 1;
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
             *
             * ⚠ AND IT ADVANCES TO THE NEXT ANCHOR RATHER THAN THE NEXT
             * CANDIDATE: "this CELL was never a room" is a fact about
             * the cell. At the default bound there is no next anchor, so
             * this is byte-identical to the pre-search `continue`.
             */
            if (!model.placementError || !(e instanceof model.placementError)) throw e;
            rows.push(Object.freeze({
                ...anchorRow,
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
            out = oracle.solve(candidate, { templates: solveTemplates });
        } catch (e) {
            /**
             * ⛔⛔ THE ABORT IS UNCHANGED, AND NEITHER THE SEARCH NOR THE
             * POLICY MAY SOFTEN IT. An engine throw ends the RUN with its
             * evidence attached; catching it here and walking on to the next
             * anchor would be exactly the loop-survives-its-own-defects
             * shape traps 171/173 name — and it would be worse than
             * before, because a wider walk would hide MORE of them.
             */
            rows.push(Object.freeze({
                ...anchorRow,
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
            onAbort({ error: e, at, anchorTry: ai + 1, anchorsOffered: anchors.length, rows });
            throw e;
        }
        // ⛓ `VERDICT.SOLVED` since CONSTRUCTIVE-MODE slice 2 — the same string
        // this line always compared, now read from the ONE declaration both
        // oracles are written against (see `VERDICT` above).
        const solved = out.verdict === VERDICT.SOLVED;
        /**
         * ⛓ THE THREE KINDS, and the `null` from `discharges` is the third of
         * them rather than a falsy second. See `KEPT_KIND`.
         */
        let kind = null;
        if (solved) {
            if (keepPolicy === KEEP_POLICY.FIRST_SOLVED) kind = null;
            else {
                const d = discharges(rowBase.family, out.records);
                if (d === null || d === undefined) kind = KEPT_KIND.NO_VERB;
                else kind = d ? KEPT_KIND.DISCHARGED : KEPT_KIND.SOLVED_ONLY;
            }
        }
        // ⛔ A NO_VERB template is taken IMMEDIATELY: first-SOLVED is its whole
        // criterion, so walking past it would spend solves looking for an
        // outcome that does not exist for this family.
        const take = solved && (keepPolicy === KEEP_POLICY.FIRST_SOLVED
            || kind !== KEPT_KIND.SOLVED_ONLY);
        rows.push(Object.freeze({
            ...anchorRow,
            outcome: take ? ATTEMPT.KEPT : ATTEMPT.REVERTED,
            at,
            verdict: out.verdict,
            ticks: out.ticks ?? null,
            classifiedBy: out.classifiedBy ?? null,
            // ⛔ VERBATIM, always — the refusal's own text is the evidence
            // channel and this loop is not allowed to summarise it.
            reasonText: out.reasonText ?? null,
            budgetKind: out.budgetKind ?? null,
        }));
        if (take) {
            hit = { at, candidate, solve: out, kind, anchorTry: ai + 1, rowIndex: rows.length - 1 };
            break;
        }
        if (solved && !fallback) {
            fallback = { at, candidate, solve: out, kind, anchorTry: ai + 1,
                rowIndex: rows.length - 1 };
        }
    }
    /**
     * ⛓ THE SETTLE. No anchor discharged, so the walk takes the FIRST that
     * merely solved — ⚖ the ruling's own second clause — and the row it already
     * emitted is corrected from REVERTED to KEPT in place. ⛔ Unreachable under
     * `FIRST_SOLVED` (`fallback` is only written when a SOLVED anchor was NOT
     * taken, which that policy never does), which is why the free ladder cannot
     * reach this branch at all.
     */
    if (!hit && fallback) {
        hit = fallback;
        rows[fallback.rowIndex] = Object.freeze({
            ...rows[fallback.rowIndex], outcome: ATTEMPT.KEPT,
        });
    }
    return { rows, hit, walked };
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
 * @param {object} o.model    `{ skeleton(), anchorsFor(record, template, rng,
 *                            limit), place(record, template, at) }` — pure;
 *                            `anchorsFor` returns up to `limit` legal anchors
 *                            in one seeded order (`[]` when none fit) and
 *                            `place` returns a NEW record and throws BY NAME
 *                            on an illegal placement.
 * @param {object} o.oracle   `{ solve(record, {templates}) }` → a verdict
 *                            object carrying at least `{verdict}`; SOLVED is
 *                            the only keep.
 * @param {object} o.palette  `{ name, templates: [...] }`
 * @param {object} [o.bounds] see `DEFAULT_BOUNDS`
 * @returns {{record, trace, summary}}
 */
export function generateLevel({ rng, model, oracle, palette, bounds } = {}) {
    const b = assertBounds(bounds);
    assertHas(model, ['skeleton', 'anchorsFor', 'place'], 'model');
    assertHas(oracle, ['solve'], 'oracle');
    if (!palette || !Array.isArray(palette.templates) || palette.templates.length === 0) {
        fail('levelGenerator: the palette must be `{name, templates: [...]}` with at '
            + 'least one template. An empty palette is a finding ABOUT THE PALETTE '
            + '(what the oracle can adjudicate), not a run that quietly places nothing.');
    }
    /**
     * ⛔ THE SEAM'S OWN CONTRACT, ASKED ONCE AND BY NAME. A template that
     * cannot instantiate is not a template this loop can draw parameters from,
     * and the alternative — falling back to the row itself — is the graceful
     * fallback that would let an un-migrated frozen row run for ever without
     * ever appearing in a domain sweep.
     */
    for (const t of palette.templates) {
        if (typeof t?.instantiate !== 'function') {
            fail(`levelGenerator: palette template "${t?.name}" carries no `
                + '`instantiate(rng, overrides)`. A template is a FUNCTION from its '
                + 'declared parameters to a concrete row (⚖ the GENERATE-mode UI arc\'s '
                + 'ruling 2); a frozen row would draw nothing, appear in no sweep, and '
                + 'be indistinguishable from a migrated one in the trace.');
        }
    }
    if (!rng || typeof rng.pick !== 'function' || typeof rng.nextInt !== 'function') {
        fail('levelGenerator: the rng must carry `pick` and `nextInt` (procgenRng). '
            + 'A generator without a seeded stream cannot be reproduced, and ⚖ kickoff '
            + '§5 makes the seed part of the level\'s identity.');
    }

    const trace = [];
    const kept = [];
    /**
     * ⛓⛓⛓ THE KEPT CONCRETE ROWS — GENERATE-mode UI slice 3, TRACK A, and the
     * whole of the pin-union fix is this array and the two lines that use it.
     *
     * ⛔ THE DEFECT, MEASURED (slice 2 §9.5(a), seed 9 target 4, pre-sword):
     * this loop used to pass `{templates: [...kept, template]}` to the oracle,
     * and a `kept` element is a RECORD — `{template, instance, params, family,
     * at}` — which carries no `pins`. So `seedlingOracle.pinsFor` added nothing
     * for the templates already in the room and every solve after the first
     * took the pin union over the CANDIDATE ALONE:
     *
     *     solve 2: 2 template(s) -> ["dead_frames","sound"]   the water CANDIDATE
     *     solve 3: 3 template(s) -> ["dead_frames"]           the pool is KEPT; the pin is GONE
     *
     * while `summary.pins` — the level's own CERTIFICATION — carried `sound`.
     * The loop's later solves ran under FEWER pins than the level it certified:
     * the two-cost-models law, inside the seam.
     *
     * ⚖ THE FIX IS TO **RETAIN**, NOT TO RECONSTRUCT, and the reason is at the
     * top of this file: ⛔ THIS FILE IMPORTS NOTHING. A reconstruction would
     * mean `procgenPalette.instantiateKept` — which is correctly the ONE
     * reconstruction for the two pin unions OUTSIDE this loop — and reaching it
     * from here would need either an import (forbidden) or a new member on the
     * injected seam (a whole seam widening to rebuild an object this loop is
     * holding in its hand). Retaining is cheaper, it spends no reconstruction
     * per solve, and it has NO drift risk: the row the oracle sees IS the row
     * `place` wrote, not a rebuild that agrees with it.
     *
     * ⛔ IT IS A SEPARATE ARRAY AND NOT A FIELD ON `kept`. `summary.kept` is
     * SERIALIZED — into the payload, the download, the batch report — and it
     * carries `{template, params}` precisely so a reader can rebuild the
     * instance. Stapling the whole concrete row beside them would put the
     * geometry in the payload twice and give a later reader two spellings to
     * choose between.
     *
     * ⛓ THE INVARIANT THIS BUYS, and it is asserted rather than described: the
     * pin union of the LAST accepting solve now equals `pinsFor` over every
     * kept row — which is what `procgenSeedling` computes for `summary.pins`
     * through `instantiateKept`. Before this line the two disagreed by
     * construction; after it they agree by construction, and the test drives
     * both.
     */
    const keptRows = [];
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
    if (skeleton.verdict !== VERDICT.SOLVED) {
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
            /**
             * ⛓ THE ONE LOOP-CORE CHANGE OF SLICE 2, AND IT IS THIS PAIR OF
             * LINES. The base row is drawn, then its declared parameters are
             * drawn FROM THE SAME STREAM in schema order (`instantiate` owns
             * that order — see the palette's docblock), and everything after
             * this point handles a CONCRETE ROW of exactly the shape the
             * frozen table used to hold.
             *
             * ⛔ NO `overrides` HERE. The free-running loop always draws; the
             * argument exists for verb 2's directed attempt, which is a later
             * slice and a different call site.
             */
            const base = rng.pick(palette.templates);
            const template = base.instantiate(rng);
            const row = {
                step,
                try: attempt,
                template: base.name,
                /**
                 * ⚠ THE INSTANCE LABEL AND THE PARAMETERS RIDE BESIDE THE BASE
                 * NAME, NEVER INSTEAD OF IT. `byFamily` counts on `family` and
                 * the pin union looks up on `template`; a row that carried
                 * only `wall-segment(ori=v,len=4)` would split one roster entry
                 * into eight (trap 199) and break every lookup.
                 */
                instance: template.instance ?? base.name,
                params: template.params ?? null,
                family: base.family,
                rngStateBefore,
                drawsBefore,
            };
            /**
             * ⛓⛓⛓ THE ANCHOR **SEARCH** (slice 3 track B) — ⚖ ruling 7's *"look
             * for a viable place to put the template, and put it there if
             * possible"*.
             *
             * ⛓ AN ANCHOR IS THE MODEL'S ANSWER, AND "NONE" IS ONE OF ITS
             * ANSWERS. A template whose footprint no longer fits anywhere in
             * a room that has filled up is not an error and not a refusal —
             * it is the room being full of that shape, which is a fact the
             * saturation counter should hear about.
             *
             * ⛔ ONE CALL, ONE SHUFFLE, WHATEVER THE BOUND IS. `anchorsFor`
             * spends the same single draw at limit 1 and at limit 12 (its own
             * docblock has the argument), so raising the bound moves no earlier
             * draw and default 1 reproduces the pre-search ladder byte for
             * byte.
             */
            const anchors = model.anchorsFor(record, template, rng,
                b.anchorTriesPerCandidate);
            if (!anchors.length) {
                trace.push(Object.freeze({
                    ...row,
                    anchorTry: null,
                    anchorsOffered: 0,
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
            /**
             * ⚠ EVERY ANCHOR TESTED IS ITS OWN TRACE ROW, sharing this
             * candidate's `step`/`try` and numbered by `anchorTry`. A search
             * that reported one collapsed verdict per candidate would hide the
             * thing it exists to do, and `anchorsOffered` is beside it because
             * a walk that stopped at 3 of 3 and a walk that stopped at 3 of 12
             * are different facts — the first was bounded by LEGALITY, the
             * second by the BOUND.
             */
            /**
             * ⛓⛓ SLICE 5: THE WALK IS `walkAnchors`, AND THIS CALL SITE PASSES
             * NO POLICY — so it takes `KEEP_POLICY.FIRST_SOLVED`, which is the
             * pre-slice behaviour instruction for instruction. ⛔ ⚖ The user's
             * ruling: *the free loop keeps FIRST-SOLVED.* The directed entry
             * below is where the preference lives, and the default here is what
             * keeps that a property of the entry rather than of the loop.
             *
             * ⛔ `keptRows`, NOT `kept` — see that array's docblock. A `kept`
             * RECORD carries no `pins`, so this solve used to take the pin
             * union over the candidate alone.
             */
            const walk = walkAnchors({
                anchors,
                record,
                template,
                model,
                oracle,
                solveTemplates: [...keptRows, template],
                rowBase: row,
                onAbort: ({ error, at, anchorTry, anchorsOffered, rows }) => {
                    for (const r of rows) trace.push(r);
                    throw new GenerationAborted(
                        `levelGenerator: ABORTED at step ${step} try ${attempt} anchor `
                        + `${anchorTry}/${anchorsOffered} placing "${row.instance}" at `
                        + `(${at.tx},${at.ty}) — the oracle threw a ${error.name}, which is NOT `
                        + 'one of the three verdict classes and is therefore not a rejected '
                        + 'candidate. The trace up to here is attached; the engine said: '
                        + error.message,
                        { trace, record, summary: { kept: [...kept], bounds: b }, cause: error },
                    );
                },
            });
            for (const r of walk.rows) trace.push(r);
            if (walk.hit) {
                record = walk.hit.candidate;
                /**
                 * ⛓ `params` IS PART OF THE KEPT RECORD because it is the
                 * only thing that lets anybody rebuild WHICH instance was
                 * placed. `procgenPalette.instantiateKept` is the one
                 * reconstruction, and it refuses rather than defaulting when
                 * a parameter is missing from this object.
                 */
                kept.push({
                    template: base.name,
                    instance: template.instance ?? base.name,
                    params: template.params ?? null,
                    family: base.family,
                    at: walk.hit.at,
                });
                // ⛓ THE CONCRETE ROW, RETAINED IN THE SAME ORDER — the object
                // every LATER solve unions its pins over (track A).
                keptRows.push(template);
                lastSolve = walk.hit.solve;
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

/**
 * ── ⛓⛓⛓ VERB 2 — **THE DIRECTED ATTEMPT** (GENERATE-mode UI slice 5) ──
 *
 * ⚖ Ruling 1, verbatim: *"a button to make the generator attempt to generate
 * that specific thing."* So: ONE template, ALREADY INSTANTIATED by the caller
 * from the form's values, placed on the CURRENT record, with the anchor search
 * at a stated higher bound and ⚖ the user's own acceptance criterion.
 *
 * ⛔ **IT IS NOT A ONE-STEP `generateLevel`.** The loop DRAWS its template and
 * its parameters and owns the saturation counter; a directive draws nothing —
 * the user has already said what they want — and it has no notion of a step,
 * a target or saturation. Reusing the loop with a palette of one would have
 * meant a run whose trace claimed a step it did not take, whose bounds named
 * a target nobody set, and whose rng position moved for draws that were never
 * spent. The two share the thing they actually share: `walkAnchors`.
 *
 * ── THE FOUR OUTCOMES, AS A TOTAL FUNCTION ────────────────────────────
 *
 * `KEPT`               — some anchor was accepted; `record` is the NEW one.
 * `NO_ANCHOR`          — the model offered no legal cell at all.
 * `ILLEGAL_PLACEMENT`  — every anchor offered was refused BY THE MODEL, before
 *                        any solve. ⛔ Distinct from REVERTED because the two
 *                        answer different questions — *"this was never a
 *                        room"* against *"this room is unsolvable"*.
 * `REVERTED`           — at least one anchor reached the oracle and none was
 *                        kept. The record is UNCHANGED (revert is "keep the
 *                        old record", the file's own law).
 *
 * ⛔ `ABORTED` still ABORTS: the engine throw propagates with the rows
 * attached, exactly as it does in the loop, because a directed walk is a walk
 * with MORE places to hide an engine error in, not fewer (traps 171/173).
 *
 * ⚠ `keptKind` is `null` for every non-KEPT outcome and one of `KEPT_KIND`'s
 * three for a keep — never `false`, never blank. See `KEPT_KIND`.
 *
 * @param {object} o
 * @param {object} o.rng       the anchor stream — ⛔ ITS OWN, derived
 *   deterministically from the seed and the directive's INDEX by the caller.
 *   This walk spends exactly one shuffle from it (`anchorsFor`'s own law).
 * ── ⛓⛓⛓ SLICE 6: AN **EXPLICIT** ANCHOR IS NOT A SEARCH ───────────────
 *
 * ⚖ Ruling 6 — click-to-anchor. When `anchor` is given the walk does not ask
 * the model for a list: the list IS that one cell, `bound` must be 1, and the
 * rng is never touched (⛔ `anchorsFor`'s single shuffle is the only draw a
 * directive ever spends, so an explicit cell spends none — which is why a
 * clicked directive replays byte-identically without a stream of its own).
 *
 * ⛔ AND `model.refusalAt` ADJUDICATES **FIRST**, BEFORE ANY SOLVE. `anchorsFor`
 * only ever offered cells `legalAt` had accepted, so `ILLEGAL_PLACEMENT` was
 * unreachable from a searched directive (slice 5 §12.9 named that absence);
 * a clicked cell is the first anchor nothing vetted, and *"nothing happened"*
 * is the one answer a person cannot act on. The refusal rides VERBATIM, in the
 * model's own words, and the oracle is not called at all.
 *
 * @param {object} o.record    the record to place onto — the level ON SCREEN.
 * @param {object} o.template  a CONCRETE ROW (already instantiated).
 * @param {Array}  [o.keptRows] the concrete rows already in `record`, for the
 *   pin union — the same argument the loop's `keptRows` is (track A).
 * @param {object} [o.anchor]  `{tx, ty}` — the EXPLICIT cell (slice 6). Absent
 *   means SEARCH, which is every caller before slice 6.
 * @param {number} o.bound     how many legal anchors this attempt may be
 *   solved at. Named in the result, because ⚖ kickoff §5 says a bounded walk
 *   names its bound. ⛔ Must be 1 when `anchor` is given.
 * @param {string} [o.keepPolicy] `KEEP_POLICY.PREFER_DISCHARGE` for verb 2.
 * @param {Function} [o.discharges] required by that policy — see `walkAnchors`.
 * @param {object} [o.rowBase] extra fields every emitted row carries (the page
 *   passes `{directive: n, step}` so the pane can label them).
 */
export function directedAttempt({
    rng, model, oracle, record, template, keptRows = [], bound, anchor = null,
    keepPolicy = KEEP_POLICY.FIRST_SOLVED, discharges = null, rowBase = {},
} = {}) {
    assertHas(model, ['anchorsFor', 'place'], 'model');
    assertHas(oracle, ['solve'], 'oracle');
    if (anchor !== null) {
        assertHas(model, ['refusalAt'], 'model');
        if (!Number.isInteger(anchor?.tx) || !Number.isInteger(anchor?.ty)) {
            fail('levelGenerator: an EXPLICIT anchor is `{tx, ty}` with integer tiles, got '
                + `${JSON.stringify(anchor)}. It is a CELL, not a pixel — the caller owns the `
                + 'conversion, because the tile is what the directive RECORDS and what a '
                + 'reproduction replays.');
        }
        if (bound !== 1) {
            fail(`levelGenerator: a directed attempt at the EXPLICIT anchor `
                + `(${anchor.tx},${anchor.ty}) was given bound ${JSON.stringify(bound)}. ⛔ An `
                + 'explicit cell is a walk of ONE cell, so 1 is the only bound that describes '
                + 'it; any other number would name a search this attempt does not perform.');
        }
    }
    if (!Number.isInteger(bound) || bound <= 0) {
        fail(`levelGenerator: a directed attempt needs a positive integer bound, got `
            + `${JSON.stringify(bound)}. The bound is what the result NAMES (⚖ kickoff §5), `
            + 'so there is no value meaning "as many as it takes".');
    }
    if (!template || typeof template !== 'object' || !template.name) {
        fail('levelGenerator: a directed attempt takes a CONCRETE ROW (the output of a '
            + 'template\'s `instantiate`), not a base template and not a name. ⛔ It does '
            + 'not instantiate: the caller owns the parameter values, because those values '
            + 'are what the directive RECORDS and what a reproduction replays.');
    }
    if (!rng || typeof rng.shuffle !== 'function') {
        fail('levelGenerator: a directed attempt needs a seeded stream for the anchor '
            + 'order. ⛔ Its own, derived from the seed and the directive\'s index — a '
            + 'directive that reused the ladder\'s stream position would move the level '
            + 'the ladder produced.');
    }
    const base = {
        ...rowBase,
        template: template.name,
        instance: template.instance ?? template.name,
        params: template.params ?? null,
        family: template.family,
        rngStateBefore: rng.state,
        drawsBefore: rng.draws,
    };
    /**
     * ⛓⛓⛓ SLICE 6 — THE EXPLICIT CELL, ADJUDICATED BY THE MODEL BEFORE ANY
     * SOLVE, and the FIRST caller that can produce `ILLEGAL_PLACEMENT`.
     *
     * ⛔ The row it emits carries the model's VERBATIM sentence, the same shape
     * `walkAnchors` writes when `place` throws — one row contract, not two —
     * with `anchorTry: 1` of `anchorsOffered: 1` so the pane labels it exactly
     * as every other anchor row.
     */
    if (anchor && model.refusalAt(record, template, anchor.tx, anchor.ty) !== null) {
        const why = model.refusalAt(record, template, anchor.tx, anchor.ty);
        return Object.freeze({
            outcome: ATTEMPT.ILLEGAL_PLACEMENT,
            record,
            at: null,
            keptKind: null,
            bound,
            keepPolicy,
            anchorsOffered: 1,
            anchorsWalked: 1,
            solve: null,
            rows: Object.freeze([Object.freeze({
                ...base,
                anchorTry: 1,
                anchorsOffered: 1,
                outcome: ATTEMPT.ILLEGAL_PLACEMENT,
                at: { tx: anchor.tx, ty: anchor.ty },
                verdict: null,
                ticks: null,
                classifiedBy: 'the level model refused the placement before any solve',
                reasonText: why,
            })]),
        });
    }
    const anchors = anchor
        ? [{ tx: anchor.tx, ty: anchor.ty }]
        : model.anchorsFor(record, template, rng, bound);
    if (!anchors.length) {
        return Object.freeze({
            outcome: ATTEMPT.NO_ANCHOR,
            record,
            at: null,
            keptKind: null,
            bound,
            keepPolicy,
            anchorsOffered: 0,
            anchorsWalked: 0,
            solve: null,
            rows: Object.freeze([Object.freeze({
                ...base,
                anchorTry: null,
                anchorsOffered: 0,
                outcome: ATTEMPT.NO_ANCHOR,
                at: null,
                verdict: null,
                ticks: null,
                classifiedBy: 'the model found no legal anchor for this template in this room',
                reasonText: null,
            })]),
        });
    }
    const walk = walkAnchors({
        anchors,
        record,
        template,
        model,
        oracle,
        solveTemplates: [...keptRows, template],
        rowBase: base,
        keepPolicy,
        discharges,
        onAbort: ({ error, at, anchorTry, anchorsOffered, rows }) => {
            throw new GenerationAborted(
                `levelGenerator: the DIRECTED attempt ABORTED at anchor `
                + `${anchorTry}/${anchorsOffered} placing "${base.instance}" at `
                + `(${at.tx},${at.ty}) — the oracle threw a ${error.name}, which is NOT one of `
                + 'the three verdict classes and is therefore not a rejected candidate. The '
                + 'rows up to here are attached; the engine said: ' + error.message,
                { trace: rows, record, summary: { bound, keepPolicy }, cause: error },
            );
        },
    });
    /**
     * ⛔ THE REFUSAL CLASS IS READ OFF THE ROWS, not guessed. "Every anchor the
     * model refused" and "some anchor the oracle refused" are different
     * findings about a template, and a directed attempt that reported one as
     * the other would send a reader to the wrong half of the system.
     */
    const outcome = walk.hit
        ? ATTEMPT.KEPT
        : (walk.rows.every((r) => r.outcome === ATTEMPT.ILLEGAL_PLACEMENT)
            ? ATTEMPT.ILLEGAL_PLACEMENT : ATTEMPT.REVERTED);
    return Object.freeze({
        outcome,
        record: walk.hit ? walk.hit.candidate : record,
        at: walk.hit ? walk.hit.at : null,
        /**
         * ⛔ NO DEFAULT. Under `FIRST_SOLVED` the walk never asked whether the
         * solve discharges, so `walk.hit.kind` is `null` and that IS the
         * answer — see `KEPT_KIND`. The `?? NO_VERB` this used to carry made a
         * `@…s` directive claim a DOOR has no verb.
         */
        keptKind: walk.hit ? walk.hit.kind : null,
        bound,
        keepPolicy,
        anchorsOffered: anchors.length,
        /**
         * ⚠ WALKED, AND OFFERED, BECAUSE THEY ARE DIFFERENT FACTS — slice 3's
         * own lesson one level up. *Stopped at 3 of 3* was bounded by
         * LEGALITY; *stopped at 3 of 12* was bounded by the BOUND; and
         * *walked 12 of 12* is a walk that found nothing better than its
         * fallback. The readout prints both.
         */
        anchorsWalked: walk.walked,
        solve: walk.hit ? walk.hit.solve : null,
        rows: Object.freeze(walk.rows),
    });
}
