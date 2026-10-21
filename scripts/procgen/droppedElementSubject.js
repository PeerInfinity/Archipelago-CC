/**
 * droppedElementSubject — **THE ONE SEARCH FOR "A LEVEL WHOSE ELEMENT THE
 * CERTIFICATION DROPPED"**, shared by `check-seedling-editor-phases.mjs`
 * (CLAIM 5) and `check-procgen-demos.mjs` (demo 9, `dropped-element`)
 * (Seedling fidelity, slice GATESUBJ — D1 and D2).
 *
 * ── ⛔⛔ THE TRAP, THIRD RECURRENCE ──────────────────────────────────
 *
 * Both gates once TYPED their subject. A solver change that teaches the
 * certification to walk the gadget revokes the subject's one property, and the
 * gate goes red about a level nobody chose:
 *
 *   1. R9 slice 11 (`facingToward`)        post-sword s1 certifies → re-picked 1 → 3 by hand
 *   2. R9 slice 13                         the phases gate's subject becomes a SEARCH over 1..20
 *   3. swim U6 / fidelity F1+F1b+F1c and hammer-phase A2 (`HAMMER_ESCAPE` on)
 *                                          → the 1..20 search runs DRY, demo 9's literal seed 3
 *                                          certifies; both gates red for 2–3 weeks unseen
 *
 * ── ⛓ THE GRID MOVED, AND WHY (MEASURED AT `f1b4f85446`) ─────────────
 *
 * `post-sword` + `killgate` through `generateStep` (the page's own entry
 * point): seeds **1..1000 hold NO certification drop at all**. The only
 * non-placed cells are 15 PLACEMENT refusals (`wall-does-not-seal`: 26, 28,
 * 118, 308, 347, 405, 409, 574, 634, 725, 804, 863, 906, 924, 953), which
 * never reach a certification, carry no geometry and are not this subject.
 * A ceiling high enough to find one does not exist in that range.
 *
 * `pre-sword` + `killgate`: every seed in 1..200 that places drops at the
 * certification WITH its geometry (`the-skeleton-does-not-solve-with-the-
 * element`), the three wall refusals (26, 28, 118) aside. The cause is the
 * BIOME — the boot holds no sword, so no kill rung can open the gate — not
 * a solver weakness. That is the property a solver change cannot revoke,
 * which is what a subject for *"a dropped element draws NOTHING"* needs.
 *
 * ⛔ IT IS STILL A SEARCH, NOT A LITERAL. The rule is the one the phases gate
 * always stated — **the smaller seed** — up to a declared CEILING, and a grid
 * with no qualifying cell under it is REFUSED BY NAME (with the ceiling in the
 * message) by the caller, never handed on as a `null`.
 *
 * ⛓ WHAT QUALIFIES: `elements.ran === false`, `certified === false`, a
 * `refused` reason, AND a certification geometry (`placed.length > 0` on the
 * summary — `elementSummaryOf` carries the certification's geometry there when
 * the shipped model has none). A drop without geometry would leave the
 * overlay row nothing to IGNORE (the `watchGenOverlay` row's lesson).
 */

/** The grid the subject is taken from — see the docblock for the measurement. */
export const DROPPED_GRID = Object.freeze({ biome: 'pre-sword', elements: 'killgate' });

/**
 * The search ceiling. ⛓ Measured: a pre-sword killgate step costs ~5 ms when
 * the certification refuses (200 seeds in 1.0 s on the box), so the DRY case
 * — the one that refuses by name — costs about a second; the found case stops
 * at the first qualifying seed (seed 1 today).
 */
export const DROPPED_CEILING = 200;

/** Does this `generateStep` result drop its element at the CERTIFICATION, with geometry? */
export function isCertificationDrop(step) {
    const e = step?.elements;
    return e?.ran === false && e?.certified === false && Boolean(e?.refused)
        && (e?.placed?.length ?? 0) > 0;
}

/**
 * ⛓ THE FIRST QUALIFYING CELL, BY THE SMALLER-SEED RULE.
 *
 * ⛔ It returns the STEP beside the subject, so a caller asserts on the very
 * object it goes on to read — a search whose answer were re-derived at the use
 * site could disagree with its own announcement.
 *
 * @param {Function} generateStep `watchGenerate.generateStep` (passed in, so
 *   this module imports nothing from the frontend and a caller's instrument is
 *   the one searched)
 * @returns {{subject: {seed, biome, elements}|null, step: object|null,
 *   searched: number, ceiling: number}}
 */
export function findDroppedSubject(generateStep, { grid = DROPPED_GRID,
    ceiling = DROPPED_CEILING } = {}) {
    for (let seed = 1; seed <= ceiling; seed += 1) {
        const step = generateStep({ seed, biome: grid.biome, step: 0,
            elements: { name: grid.elements } });
        if (isCertificationDrop(step)) {
            return { subject: { seed, ...grid }, step, searched: seed, ceiling };
        }
    }
    return { subject: null, step: null, searched: ceiling, ceiling };
}

/** The refusal-by-name sentence for a dry grid — one spelling for both gates. */
export const dryGridMessage = ({ grid = DROPPED_GRID, ceiling = DROPPED_CEILING } = {}) =>
    `NO seed in 1..${ceiling} of ${grid.biome}/${grid.elements} drops its element at the `
    + 'CERTIFICATION with geometry; this claim has no subject (raise DROPPED_CEILING in '
    + 'scripts/procgen/droppedElementSubject.js only after measuring where the first drop is)';
