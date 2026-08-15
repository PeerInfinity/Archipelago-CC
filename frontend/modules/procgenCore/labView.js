/**
 * procgenCore/labView — **WHAT A LAB PAGE SHOWS ABOUT A RUN**, in words neither
 * substrate owns: the generation pane's rows, the keep-kind sentence, the cost
 * a press authorises, and the pixel→tile conversion a click needs.
 *
 * CONSTRUCTIVE-MODE arc, slice 3 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). Every function here was `seedlingDemo/watchGenerate.js`'s
 * and every one of them reads only what `procgenCore/levelGenerator.js`
 * produces — a TRACE ROW, a `KEPT_KIND`, a `DEFAULT_BOUNDS` — or nothing at all
 * (`tileAtPoint` is arithmetic over a canvas rectangle). ⛔ The maze lab page
 * renders the same panes, and a second `generationRows` would be a second
 * answer to *"what did the generator do"*: the trace is the evidence channel,
 * and a paraphrase of it in one page only is how two pages start disagreeing
 * about one run.
 *
 * ⚠ WHAT DID **NOT** COME: `describeState` stayed in `watchGenerate.js` and the
 * maze page writes its own. It names the biome, the ladder step, the roster and
 * a TICK budget — and the maze has no biome, a room SIZE the Seedling page has
 * no concept of, an EXPANSION budget, and (from this slice) a manual-edit count
 * with the uncertified flag beside it. The identity LINE is a claim about what
 * a level IS, so a shared one would have to be a union of two vocabularies,
 * which is the shape that makes a readout unreadable.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: both pages load this in a browser.
 */

import { DEFAULT_BOUNDS, KEPT_KIND } from './levelGenerator.js';

export class LabViewError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LabViewError';
    }
}

const fail = (message) => { throw new LabViewError(message); };

/**
 * THE COST OF A LADDER, BEFORE IT RUNS.
 *
 * `levelGenerator.costModel` states one run's ceiling; this states the
 * ladder's, which is the sum over the steps a RUN-ALL takes plus one display
 * solve per step. ⚠ An UPPER BOUND, and it says so — the loop keeps its first
 * candidate most of the time and stops early on saturation.
 *
 * ⚠ STEP is "obstacleTarget = k, re-run", so a RUN-ALL to target N spends O(N²)
 * solves where one generate call spends O(N). This computes it so a caller
 * states the ceiling BEFORE pressing rather than discovering it after — the
 * same discipline `costModel` applies to one run, and for the same reason (a
 * solve is synchronous and uninterruptible, so a per-solve budget bounds what
 * is ACCEPTED and never what is SPENT).
 */
export function ladderCost(bounds, worstCaseSolveMs) {
    const b = { ...DEFAULT_BOUNDS, ...(bounds ?? {}) };
    let solves = 0;
    for (let k = 1; k <= b.obstacleTarget; k += 1) {
        solves += 1 + k * b.triesPerStep * b.anchorTriesPerCandidate;
    }
    const display = b.obstacleTarget + 1;
    return Object.freeze({
        steps: b.obstacleTarget,
        loopSolves: solves,
        displaySolves: display,
        solves: solves + display,
        worstCaseSolveMs,
        worstCaseTotalMs: Number.isFinite(worstCaseSolveMs)
            ? (solves + display) * worstCaseSolveMs : null,
        why: `STEP is "obstacleTarget = k, re-run", so a RUN-ALL to `
            + `${b.obstacleTarget} spends sum(1 + k x triesPerStep(${b.triesPerStep}) x `
            + `anchorTriesPerCandidate(${b.anchorTriesPerCandidate})) `
            + `= ${solves} loop solves plus ${display} display solves. A single `
            + 'generate call would spend the last row alone; the ladder buys '
            + 'the per-step display ⚖ §1.3 asks for, and every step is the CLI\'s own '
            + `--count=k output byte for byte.`,
    });
}

/**
 * THE COST OF **ONE DIRECTED ATTEMPT**, before it runs — `ladderCost`'s
 * sibling, and the same arithmetic discipline for the same reason.
 *
 * ⚠ IT IS A CEILING AND IT SAYS SO, twice over: the walk stops at the first
 * acceptable anchor, AND the model usually offers far fewer legal anchors than
 * the bound. The number printed is what the press AUTHORISES, which is the one
 * a reader who expected a pause should see.
 */
export function directedCost(bound, worstCaseSolveMs) {
    if (!Number.isInteger(bound) || bound <= 0) {
        fail(`labView: directedCost needs a positive integer bound, got `
            + `${JSON.stringify(bound)}.`);
    }
    const solves = bound + 1;
    return Object.freeze({
        bound,
        loopSolves: bound,
        displaySolves: 1,
        solves,
        worstCaseSolveMs,
        worstCaseTotalMs: Number.isFinite(worstCaseSolveMs) ? solves * worstCaseSolveMs : null,
        why: `one DIRECTED attempt solves at up to anchorTries(${bound}) legal anchors, plus `
            + '1 display solve. ⚠ A CEILING: the walk stops at the first anchor it accepts, '
            + 'and the model offers only as many legal anchors as the room has room for. '
            + 'Every solve is SYNCHRONOUS and uninterruptible.',
    });
}

/**
 * The generation trace as PANE ROWS — one per attempt, in the loop's order.
 *
 * ⚖ *"the verdict + kept/reverted template + refusal text as trace-pane rows"*
 * and *"every placement, every veto with its verdict class and verbatim reason,
 * every bound named"*. ⛔ So the reason text rides VERBATIM: the refusal is the
 * evidence channel (trap 202 — the danger channel is empty on every success BY
 * CONSTRUCTION) and a paraphrase would be a lossy copy of the only content this
 * pane carries.
 *
 * ⚠ `classifiedBy` is a SEPARATE field and is never merged into the reason —
 * "how the oracle decided" and "what the solver said" are different claims, and
 * both oracles write them separately for that reason.
 */
export function generationRows(trace) {
    return (trace ?? []).map((r) => ({
        step: r.step,
        try: r.try,
        /**
         * ⛓⛓ THE LABEL CARRIES THE ANCHOR ORDINAL, because rows of one candidate
         * SHARE `step.try`. `1.2` three times over would be a pane that shows a
         * search as one attempt repeated; `1.2a1 / 1.2a2 / 1.2a3` is the search.
         * ⛔ The suffix is written whenever the row has an ordinal — including at
         * the default bound, where every row is `a1` — rather than only when the
         * walk was long: a label whose FORMAT depends on the outcome is two
         * spellings, and a reader could not tell "no search ran" from "the
         * search stopped at one".
         *
         * ⛓⛓ A DIRECTIVE'S ROWS ARE LABELLED `d<n>a<k>`, because they are not a
         * step of any ladder — the row's `step` says which rung the directive
         * was applied ON TOP OF, and a label reading `3.null` would be a pane
         * inventing a try nobody made.
         */
        label: r.directive ? `d${r.directive}${r.anchorTry ? `a${r.anchorTry}` : ''}`
            : (r.step === 0 ? '(skeleton)'
                : `${r.step}.${r.try}${r.anchorTry ? `a${r.anchorTry}` : ''}`),
        /** Which directive this row belongs to, or `null` for a ladder row. */
        directive: r.directive ?? null,
        /** Which anchor of the walk this row is, and how many were offered. */
        anchorTry: r.anchorTry ?? null,
        anchorsOffered: r.anchorsOffered ?? null,
        template: r.template ?? '(skeleton)',
        /**
         * ⛓ THE PANE PRINTS THE INSTANCE, the pane's own consumers still get the
         * base `template`. `wall-segment(ori=v,len=4)` and
         * `wall-segment(ori=h,len=2)` are two different obstacles and a pane
         * that called both "wall-segment" would be showing a roster key where a
         * reader needs a geometry.
         */
        instance: r.instance ?? r.template ?? '(skeleton)',
        params: r.params ?? null,
        family: r.family,
        at: r.at ? `(${r.at.tx},${r.at.ty})` : null,
        outcome: r.outcome,
        verdict: r.verdict ?? null,
        ticks: r.ticks ?? null,
        classifiedBy: r.classifiedBy ?? null,
        reasonText: r.reasonText ?? null,
        budgetKind: r.budgetKind ?? null,
    }));
}

/**
 * ⛓⛓⛓ **WHICH KIND OF KEEP IT WAS** — ⚖ the user's ruling: *"the readout says
 * WHICH KIND OF KEEP it was … two facts, never blurred."*
 *
 * ⛔ **THE THIRD CASE IS PRINTED BY NAME.** A wall, a pool, a pit and an arrow
 * lane have no verb to discharge, so first-SOLVED is their WHOLE criterion and
 * nothing was missed. Printing `solved-only` for them would be a readout
 * claiming a shortfall that cannot exist — trap 249's shape, in the one place a
 * reader looks to find out what the generator did. ⛓ ONE spelling: both pages'
 * directive lists and both CLIs' tables call this, so they cannot describe one
 * outcome two ways.
 */
export function describeKeptKind(directive) {
    if (directive?.outcome !== 'KEPT') return '';
    /**
     * ⛓⛓ AN EXPLICIT ANCHOR IS A WALK OF ONE CELL, SO THE PREFERENCE HAD
     * NOTHING TO PREFER BETWEEN — and `solved-only`'s searched wording (*"no
     * anchor within the bound"*) would read as if a walk had happened and come
     * up short. It is the same KIND; it is a different sentence, and it is said
     * HERE because this is the ONE spelling the pages and the CLIs share.
     */
    const clicked = Boolean(directive.anchor);
    switch (directive.keptKind) {
        case KEPT_KIND.DISCHARGED:
            return `kept:discharged — the solve carries a {strategy} record naming this `
                + 'template\'s own verb';
        case KEPT_KIND.SOLVED_ONLY:
            return clicked
                ? 'kept:solved-only — the room completes, and the solve at THIS cell does not '
                    + 'USE the template\'s verb. ⚠ The discharge preference is MOOT here: an '
                    + 'explicit anchor is a walk of ONE cell, so nothing was passed over'
                : 'kept:solved-only — the room completes, but no anchor within the bound '
                    + 'made the walk USE this template\'s verb';
        case KEPT_KIND.NO_VERB:
            return 'kept — this family has NO verb to discharge, so first-SOLVED is its '
                + 'whole criterion and nothing was missed';
        default:
            /**
             * ⛔ `keptKind` IS `null` UNDER `FIRST_SOLVED` AND THAT IS THE
             * ANSWER — the walk never asked. Saying `solved-no-verb` here
             * claimed a DOOR has no verb; saying `solved-only` would claim a
             * shortfall nobody looked for. Both are statements about a question
             * that was never put.
             */
            return 'kept — the keep policy was first-SOLVED, so nothing asked whether this '
                + 'solve DISCHARGES the template\'s verb';
    }
}

/**
 * ── ⛓⛓⛓ WHICH **TILE** A CLICK LANDED ON ──────────────────────────────
 *
 * ⛔ **IT IS DERIVED FROM THE ROOM'S OWN DIMENSIONS, NOT FROM THE RENDERER'S
 * `scale`.** The canvas is `room dimensions x ONE uniform integer scale` and the
 * browser may then present it at any CSS size; asking the ROOM how many columns
 * it has and the ELEMENT how wide it is on screen is correct under both, and it
 * does not reach into a closure the renderer owns.
 *
 * ⛔ **THE INTEGER NUMERATOR IS DELIBERATE.** `Math.floor(x * cols / width)` and
 * not `Math.floor((x / width) * cols)`: the second divides first and can land a
 * pixel that is EXACTLY on a tile boundary at 1.9999999, which is the previous
 * tile. The boundaries are what the tests drive — the last pixel of tile k is
 * tile k and the first pixel of tile k+1 is tile k+1 — because an off-by-one
 * here is invisible to every check that clicks a tile's middle.
 *
 * ⚠ AN OUT-OF-RANGE POINT REFUSES rather than clamping. A clamp would silently
 * turn a click past the room's edge into a click on its last cell, and the whole
 * point is that the cell a person named is the cell that is adjudicated.
 *
 * @param {object} o
 * @param {number} o.x,y          the point RELATIVE to the canvas's top-left,
 *   in CSS pixels (`clientX - rect.left`).
 * @param {number} o.width,height the canvas's own on-screen size (`rect.*`).
 * @param {number} o.cols,rows    the ROOM's dimensions in tiles.
 * @returns {{tx: number, ty: number}}
 */
export function tileAtPoint({ x, y, width, height, cols, rows } = {}) {
    for (const [what, v] of [['width', width], ['height', height]]) {
        if (!Number.isFinite(v) || v <= 0) {
            fail(`labView: tileAtPoint needs a positive canvas ${what}, got `
                + `${JSON.stringify(v)}. A zero-sized canvas is a canvas nobody can click, `
                + 'and dividing by it would name every cell at once.');
        }
    }
    for (const [what, v] of [['cols', cols], ['rows', rows]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`labView: tileAtPoint needs a positive integer ${what}, got `
                + `${JSON.stringify(v)} — the room's own dimension in TILES.`);
        }
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`labView: tileAtPoint needs a finite point, got (${x},${y}).`);
    }
    const tx = Math.floor((x * cols) / width);
    const ty = Math.floor((y * rows) / height);
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) {
        fail(`labView: the point (${x},${y}) on a ${width}x${height} canvas is tile `
            + `(${tx},${ty}), which is outside a ${cols}x${rows} room. ⛔ It REFUSES rather `
            + 'than clamping: a clamp would turn a click past the edge into a click on the '
            + 'last cell, and the cell somebody named is the cell that gets adjudicated.');
    }
    return { tx, ty };
}
