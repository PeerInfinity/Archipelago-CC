/**
 * seedlingDemo/procgenRequirements — **THE REQUIREMENTS DIFFERENTIAL**, the ONE
 * implementation, lifted out of `scripts/procgen/batch-seedling-acceptance.mjs`
 * (PROCGEN ELEMENTS arc 3, slice 4d, D2).
 *
 * ⛓⛓⛓ **IT IS A MOVE, AND THE PROOF IS THE BATCH'S OWN md5.** This function was
 * written for the PoC arc's acceptance batch (⚖ ruling §1.10a) and lived inside
 * that script. Slice 4d gave it a SECOND caller — the `require:[X]` directive on
 * the Seedling seam, which grades the item it was asked to require — and two
 * copies of a differential is exactly the failure mode this repo keeps
 * recording. So the body moved VERBATIM, the batch became a caller, and the
 * batch's stdout md5 `ab540ac463dbab0584d552fe6a51f731` is what says the move
 * changed nothing.
 *
 * ── ⚖⚖ THE LAW IT IMPLEMENTS, VERBATIM (PoC ruling §1.10a) ────────────
 *
 * *"for each certified level, re-solve with items removed; 'solves with X /
 * refuses without X at the SAME per-solve budget' ⇒ X recorded as required.
 * ⛔⛔ THE CLAIM IS SOLVER-RELATIVE AND BOUNDED BY CONSTRUCTION (user's own
 * warning, from the bounce/runner substrates: impossibility-proving via
 * exhaustive search was the failure mode there — NEVER escalate budgets to
 * chase certainty; a refusal at standard budget is the datum, 'rule not
 * established' is a named verdict, and no exhaustive search exists anywhere in
 * this design)."*
 *
 * ⛔ **ONE BUDGET OBJECT, BOTH ARMS.** The caller hands the budget in and it is
 * passed to the without-arm unchanged. There is no code path here that raises
 * it, retries, or widens anything on a refusal.
 *
 * ── THE FOUR GRADES, AND THE FIFTH THAT IS NOT COMPUTED HERE ──────────
 *
 * A REQUIRED row carries an `evidence` grade — STRONG (a solver refusal within
 * budget), BOUND-DEPENDENT (the budget is what ended it), WEAK (an ENGINE
 * throw, which is not a claim about the level at all) — and a row where both
 * arms solve at the SAME tick count says INERT.
 *
 * ⛔⛔ **`SHORTENS` IS ARC 5'S FIFTH GRADE AND IS DELIBERATELY NOT COMPUTED
 * HERE** (design §4.5): *both arms solve, fewer ticks WITH the item* — what an
 * ITEM-GATED SHORTCUT (design §4.7: water/swim, a waterfall on a `graphify`
 * edge) looks like to this differential. ⛓ Nothing in the pipeline can produce
 * one today: no element grants a shortcut, so every both-arms-solve row this
 * corpus can reach is INERT or a tick difference no mechanism explains. Trap
 * 355 — *a bound nothing can reach is not a bound; say so* — so it is NAMED as
 * arc 5's and left uncomputed rather than shipped as a grade that would never
 * fire and could never be gated.
 *
 * ── ⚠⚠ THE WITHOUT-ARM'S FAILURE IS BUDGET-SHAPED, AND THAT IS EXPECTED ─
 *
 * Without the sword there is no refusal that says "no sword": `weaponForPress`
 * returns `null` when the inventory slot is absent, so a swordless press is a
 * **SILENT NO-OP** — the solver schedules its strikes, spends its ticks against
 * a body that cannot die, and fails on the budget or on the corridor. ⇒ **the
 * DIFFERENTIAL'S VERDICT is what speaks, never the refusal text.**
 */

import { DEFAULT_BUDGET, bootStaging, solve } from './procgenOracle.js';

/**
 * The AP item name behind each boot flag — the vocabulary the REPORT speaks,
 * because "requires `hasSword`" is a sentence about a seam field and "requires
 * Progressive Sword" is a sentence about the game.
 * ⛓ Taken from `worlds/seedling/Items.py`'s own table, not invented here.
 */
export const ITEM_LABELS = Object.freeze({
    hasSword: 'Progressive Sword',
    hasShield: 'Progressive Shield',
});

/**
 * ⚖ The PoC's §1.14 ruling, one instrument over: **a measurement harness may
 * CATCH AND CLASSIFY throws.** The oracle's own catch stays narrow (traps
 * 171/173) and is untouched; what this does is let the without-arm report an
 * ENGINE throw as the WEAKEST of the three evidences rather than ending the run.
 */
function attempt(fn) {
    try {
        return { ok: true, value: fn() };
    } catch (e) {
        return { ok: false, error: { name: e.name, message: e.message, cause: e.cause?.name ?? null } };
    }
}


/**
 * The with/without differential for ONE level, at the SAME budget.
 *
 * ⛔ THE CANDIDATE SET IS THE BOOT'S OWN TRUE FLAGS. "Removing" an item the
 * boot never declared is not a differential, it is the same run twice — so a
 * biome whose flags are all false yields an EMPTY candidate set, and the
 * report answers "none established" WITH THE REASON rather than printing
 * nothing (an empty layer owes a `why`).
 */
export function requirementsFor(state, withOut, { budget = DEFAULT_BUDGET } = {}) {
    const items = state.palette.items ?? {};
    const candidates = Object.keys(items).filter((k) => items[k] === true);
    const boot = state.model.boot();
    const pins = state.summary.pins;
    const rows = [];
    for (const flag of candidates) {
        const without = attempt(() => solve(state.record,
            bootStaging({ boot, items: { ...items, [flag]: false }, pins }),
            state.model.goals, budget, { name: `req-s${state.seed}-no-${flag}` }));
        const withoutVerdict = without.ok
            ? without.value.verdict
            // ⚠ A THROW IS NOT A REFUSAL and the row says which it was. It
            // still counts as "did not solve" for the differential, because
            // the differential's question is whether the goal was reached.
            : `THREW:${without.error.name}`;
        const withoutSolved = without.ok && without.value.verdict === 'SOLVED'
            && without.value.certification?.certified === true;
        const required = withOut.verdict === 'SOLVED' && !withoutSolved;
        /**
         * ⛔⛔ THE THREE WAYS A WITHOUT-ARM CAN FAIL ARE NOT EQUALLY STRONG
         * EVIDENCE, and the batch MEASURED all three on its three carriers —
         * one REFUSED, one BUDGET_EXHAUSTED, one THREW. Printing "REQUIRED"
         * three times over three different facts would be the report agreeing
         * with itself.
         *
         *  · **REFUSED** — the solver, within budget, said there is no way.
         *    This is the datum ⚖ §1.10a describes, and it is the strong one.
         *  · **BUDGET_EXHAUSTED** — the solver ran out. The verdict stands
         *    (⚖ §1.10a: "a refusal at standard budget IS the datum", and NO
         *    escalation exists here to find out otherwise), but the BOUND is
         *    visibly load-bearing on this row in a way it is not on the one
         *    above. Named so a reader can see which rows rest on it.
         *  · **THREW** — the ENGINE said the route stepped where it must not
         *    (`PhysicsV2Error` = §15.9's approach-drive question, measured at
         *    three separate moments in this arc). ⛔ That is not a statement
         *    about the LEVEL at all. The differential's verdict is still what
         *    it is — with the item the goal is reached and without it the goal
         *    is not — but this row's evidence is the WEAKEST of the three and
         *    it says so rather than borrowing the strong one's authority.
         */
        const evidence = !required ? 'n/a'
            : (without.ok
                ? (without.value.verdict === 'REFUSED' ? 'STRONG (solver refusal)'
                    : 'BOUND-DEPENDENT (the budget is what ended it)')
                : 'WEAK (an ENGINE throw, not a claim about the level)');
        rows.push({
            flag,
            item: ITEM_LABELS[flag] ?? flag,
            withVerdict: withOut.verdict,
            withTicks: withOut.ticks,
            withoutVerdict,
            withoutTicks: without.ok ? (without.value.ticks ?? null) : null,
            withoutReason: without.ok
                ? (without.value.reasonText ?? null) : without.error.message,
            verdict: required ? 'REQUIRED' : 'rule not established',
            evidence,
            /**
             * ⛓ AND THE CONTROL'S OWN STRONGER STATEMENT. When both arms
             * solve, "no rule established" is the verdict — but EQUAL TICK
             * COUNTS say more: the item did not merely fail to be necessary,
             * it changed nothing about the walk at all. That is the inertness
             * §12.2 measured for the whole biome, arriving per level.
             */
            inert: !required && without.ok && without.value.ticks === withOut.ticks,
            /**
             * ⛔⛔ THE SOLVER-RELATIVE LABEL, IN THE ROW. ⚖ §1.10a makes it
             * mandatory and the reason is the user's own: on the bounce and
             * runner substrates, impossibility-proving by exhaustive search
             * was the failure mode. This claim is not that the level is
             * unsolvable without the item; it is that THIS SOLVER, at THIS
             * budget, did not solve it. No budget was escalated to find out.
             */
            label: required
                ? `SOLVER-RELATIVE, BOUNDED: this solver, at maxTicksPerTarget=`
                    + `${budget.maxTicksPerTarget}, solves this level WITH `
                    + `${ITEM_LABELS[flag] ?? flag} and does not solve it WITHOUT. It is `
                    + 'NOT a proof that the level is unsolvable without it — no exhaustive '
                    + 'search exists anywhere in this design, and no budget was escalated.'
                : `SOLVER-RELATIVE, BOUNDED: the level solved BOTH with and without `
                    + `${ITEM_LABELS[flag] ?? flag} at this budget, so no rule is `
                    + 'established. That is an answer, not an absence.',
            /**
             * ⚠ §15.8's warning, carried in the row that needs it: without the
             * sword the press is a SILENT NO-OP, so the without-arm's text is
             * budget- or corridor-shaped. The VERDICT is what speaks.
             */
            howToReadTheText: flag === 'hasSword'
                ? 'without the sword `weaponForPress` returns null and the press is a '
                    + 'SILENT NO-OP, so this refusal is budget/corridor-shaped by '
                    + 'construction. Do not read it as a different KIND of failure — the '
                    + 'differential\'s VERDICT is the datum.'
                : null,
        });
    }
    return {
        candidates,
        rows,
        /** ⛓ An empty layer owes a `why`, and this is it. */
        why: candidates.length === 0
            ? `the ${state.biome} biome declares NO item flag true `
                + `(${JSON.stringify(items)}), so there is nothing to remove and the `
                + 'with/without differential has no subject on this level. "none '
                + 'established" here is a fact about the BIOME, not a failed measurement.'
            : null,
        verdict: rows.some((r) => r.verdict === 'REQUIRED')
            ? rows.filter((r) => r.verdict === 'REQUIRED').map((r) => `requires ${r.item}`).join('; ')
            : 'none established',
    };
}
