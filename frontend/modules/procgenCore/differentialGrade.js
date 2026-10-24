/**
 * procgenCore/differentialGrade — **THE ONE-WORD GRADE OF A WITH/WITHOUT
 * DIFFERENTIAL, FOR BOTH SUBSTRATES**, and the fifth word's definition.
 *
 * PROCGEN ELEMENTS arc 5, slice 5 (D1/D2/D3). Design §4.5's differential is
 * substrate-shaped at both ends — Seedling measures TICKS through
 * `procgenRequirements`, the maze measures BFS PLAN LENGTH through
 * `mazeCostRecords` — and identical at the only place that matters: *what does
 * the pair of arms MEAN*. Arc 3 named five grades and computed four
 * (`procgenRequirements.gradeOf`, §15.3); the maze named one (`requireOutcome`,
 * `grade: 'STRONG'` by construction). ⛔ **SHORTENS ARRIVING ON BOTH VENUES AT
 * ONCE IS EXACTLY THE MOMENT A SECOND SPELLING WOULD GET IN**, so the words and
 * the arithmetic live here and both bindings ASK.
 *
 * ── ⚖⚖ THE FIFTH GRADE, VERBATIM (design §4.5) ───────────────────────
 *
 * *"gains a fifth honest grade, **SHORTENS** — solves both ways, fewer ticks
 * WITH the item — which is what a gated shortcut (§4.7) looks like to the
 * differential (today identical ticks = INERT; the shortcut is the case where
 * they differ without a refusal)."*
 *
 * ── ⛔⛔ WHAT ARC 3 LEFT HERE, AND WHY IT COULD NOT BE COMPUTED THEN ───
 *
 * §18.2 C3 and trap 355: *a grade nothing can reach is not a grade.* In arc 3
 * no element granted a shortcut, so every both-arms-solve row the corpus could
 * reach was INERT or a tick difference no mechanism explained, and shipping the
 * word would have shipped a grade that could never fire and could never be
 * gated. ⇒ it was NAMED with the row it would be carved out of
 * (`NOT-ESTABLISHED` with fewer ticks WITH the item) and left uncomputed.
 * **This module is that discharge**, and it lands in the same slice as the two
 * elements that can produce one — which is the only order in which the claim
 * "reached" is a measurement rather than a promise.
 *
 * ── ⛓⛓⛓ THE DIRECTION IS THE WHOLE DEFINITION, AND IT IS EASY TO WRITE
 *     BACKWARDS ─────────────────────────────────────────────────────
 *
 * SHORTENS is **`withCost < withoutCost`** — the walk is CHEAPER when the
 * player HAS the item. The other direction (cheaper WITHOUT) is not a shortcut
 * at all; it is a level where carrying the item makes the route worse, which is
 * a real thing a solver can produce and is NOT this word. ⛔ There is exactly
 * one comparison in this file and `differentialGrade.test.js` drives it from
 * both sides, because a sign error here would grade every shortcut level and
 * every non-shortcut level with the same confidence.
 *
 * ⚠ **AND "COST" IS THE CALLER'S UNIT.** Seedling hands TICKS, the maze hands
 * BFS PLAN LENGTH (`reach(...).plan.length` — its own tick analogue). Both are
 * *how much walking the level costs*, both are integers, and neither is
 * comparable to the other. The caller names its unit in its own docblock; this
 * function only ever compares two numbers that came from the same arm pair.
 *
 * ⛔ NO DOM, NO NODE, NO SUBSTRATE: `procgenCore` imports nothing binding-side.
 */

/**
 * ⛓⛓⛓ **THE SIX WORDS.** Frozen, exported, and the ONE place they are spelled
 * — `procgenDocs`' glossary, `find-seedling-seeds.mjs --where=grade=`, the
 * demo catalogue's `require.grade` claims and both bindings read them from
 * here rather than from a literal of their own.
 */
export const GRADES = Object.freeze({
    /** the without-arm was REFUSED within budget — ⚖ §1.10a's own datum */
    STRONG: 'STRONG',
    /** the without-arm exhausted the BUDGET; the verdict stands, the bound is visible */
    BOUND_DEPENDENT: 'BOUND-DEPENDENT',
    /** the without-arm THREW; the ENGINE spoke, which is not a claim about the level */
    WEAK: 'WEAK',
    /** both arms solved at the SAME cost — the item changed nothing at all */
    INERT: 'INERT',
    /** ⛓ arc 5, slice 5: both arms solved and the WITH arm is STRICTLY CHEAPER */
    SHORTENS: 'SHORTENS',
    /** both arms solved, the costs differ, and no mechanism claims the difference */
    NOT_ESTABLISHED: 'NOT-ESTABLISHED',
});

/** ⛓ The words in one array, sorted, for the readouts that enumerate them. */
export const GRADE_WORDS = Object.freeze([...Object.values(GRADES)].sort());

/**
 * ⛓⛓⛓ **THE GRADE OF ONE DIFFERENTIAL**, from STRUCTURED FIELDS ONLY.
 *
 * ⛔ **IT READS NUMBERS AND A VERDICT WORD, NEVER PROSE** (traps 337/354). A
 * grade derived from an `evidence` sentence would drift from the sentence the
 * day either was reworded, and both bindings ship the sentence in a payload.
 *
 * @param {object} o
 * @param {boolean} o.required   did the differential conclude the item is
 *   REQUIRED — i.e. the with-arm reached the goal and the without-arm did not.
 * @param {string|null} o.withoutVerdict the without-arm's verdict WORD, only
 *   consulted when `required`: `'REFUSED'` ⇒ STRONG, `'BUDGET_EXHAUSTED'` ⇒
 *   BOUND-DEPENDENT, anything else (a `THREW:*`) ⇒ WEAK.
 * @param {number|null} o.withCost    the WITH arm's cost, in the caller's unit.
 * @param {number|null} o.withoutCost the WITHOUT arm's cost, same unit.
 * @returns {string} one of `GRADES`.
 */
export function gradeDifferential({
    required, withoutVerdict = null, withCost = null, withoutCost = null,
} = {}) {
    if (required) {
        if (withoutVerdict === 'REFUSED') return GRADES.STRONG;
        if (withoutVerdict === 'BUDGET_EXHAUSTED') return GRADES.BOUND_DEPENDENT;
        return GRADES.WEAK;
    }
    /**
     * ⛔ BOTH COSTS MUST BE NUMBERS BEFORE ANY OF THE THREE BOTH-SOLVED WORDS
     * IS REACHABLE. A without-arm that did not solve has no cost, and a `null`
     * compared with `<` is `0` in JavaScript — which would grade a REFUSED
     * without-arm SHORTENS on every level whose with-arm cost anything at all.
     * That is the single most expensive mistake this file could make and it is
     * one `typeof` away, so it is written as a guard rather than assumed from
     * the caller's contract.
     */
    if (typeof withCost !== 'number' || typeof withoutCost !== 'number') {
        return GRADES.NOT_ESTABLISHED;
    }
    if (withCost === withoutCost) return GRADES.INERT;
    /**
     * ⛓⛓⛓ **THE FIFTH GRADE.** Strictly cheaper WITH the item ⇒ the item bought
     * a shorter way. ⚖ Design §4.7's gated shortcut is exactly this row, and
     * arc 5 slice 5's two realisations (Seedling's sword-gated shortcut, the
     * maze's item-locked cycle edge) are what make it reachable.
     */
    if (withCost < withoutCost) return GRADES.SHORTENS;
    /**
     * ⛓ AND THE OTHER DIRECTION IS **NOT** A FIFTH GRADE. The level solved more
     * cheaply WITHOUT the item: real, occasionally produced by a planner that
     * takes a different route when its inventory changes, and no mechanism in
     * this design claims it. It stays NOT-ESTABLISHED, which is what that word
     * has always meant — *both arms solved, the costs differ, and nothing here
     * explains the difference.*
     */
    return GRADES.NOT_ESTABLISHED;
}

/**
 * ⛓ The grades a `require:[X]` directive accepts as MET — ⚖ arc-3 slice 4d's
 * D1: STRONG or BOUND-DEPENDENT.
 *
 * ⛔⛔ **SHORTENS IS NOT ONE OF THEM, AND THAT IS THE POINT OF THE WORD.** A
 * shortcut is the case where the level solves WITHOUT the item; *"requires X"*
 * is the case where it does not. A directive met by a SHORTENS row would be a
 * report claiming a requirement on a level that has none — which is the exact
 * failure `the-required-symbol-is-not-a-cut` refuses on the maze side.
 */
export const REQUIRING_GRADES = Object.freeze([GRADES.STRONG, GRADES.BOUND_DEPENDENT]);
