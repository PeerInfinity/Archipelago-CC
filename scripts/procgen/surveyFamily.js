/**
 * surveyFamily — **THE MECHANISM FAMILY A REFUSAL BELONGS TO**, extracted from
 * `survey-seedling-route.mjs` so it can be unit-rowed. R9 slice 12b″.
 *
 * ⛔ WHY IT IS A MODULE NOW. The survey derives the whole route, checks every
 * boot source on disk and solves twenty-nine rooms AT MODULE SCOPE — importing
 * it to test one pure function would run the survey. `rerecordCampaign.js` is
 * the same shape beside `rerecord-seedling-campaign.mjs`, and the extraction
 * is byte-for-byte: the rules and their reasons are moved, not rewritten.
 */

import { KILL_ARM_POLICY }
    from '../../frontend/modules/seedlingDemo/enemyDamage.js';

/**
 * ⚠⚠ **EVERY ROW OF THIS TABLE WAS WRITTEN AFTER READING THE REFUSAL IT
 * CLASSIFIES**, and the first draft — written before the survey ran, from
 * the vocabulary the R8 doc uses — got THREE of the five wrong. It filed
 * L15's `shove` under a generic "PLAN" because the message contains "no
 * corridor", and L16's chaser-roster refusal under "CENSUS" because it
 * contains the word "census". A classifier keyed on words that appear in
 * every refusal classifies nothing.
 *
 * ⛔ So the rules key on the SENTENCE THAT DECIDES, most specific first,
 * and each names its row in R8's own handoff table. A refusal matching
 * nothing lands as `unclassified` WITH ITS FULL TEXT — a survey whose
 * classifier silently swallows the unknown reports a smaller problem than
 * it found (⚖ the bounded-sweep law: name what you bounded).
 */
export const FAMILY_RULES = [
    /**
     * ⛔⛔ R9 SLICE 12b — THIS ROW USED TO PUBLISH A CLAIM THE CODE HAD
     * ALREADY FALSIFIED, and the survey printed it on every run for a whole
     * slice without anybody reading it.
     *
     * It ended with a hardcoded *"R8 handoff: `KILL_ARM_POLICY.Bob` still
     * `refused` — 'nothing drove a PRESS against a chaser'"*. R9 slice 12
     * lifted `KILL_ARM_POLICY.Bob` to `modelled` and drove the press against
     * a real bob on the real game (kickoff §22.4/§22.5) — so from that commit
     * on, the survey's own step-18 row asserted the opposite of the module it
     * was reporting about.
     *
     * ⇒ THE VERDICT IS READ FROM `enemyDamage.KILL_ARM_POLICY`, NOT TYPED
     * (⚖ ruling 17). A classifier that quotes a policy has to quote the
     * policy, or it is a second copy of it that only agrees until one of them
     * is edited — and the one nobody tests is the one that drifts. The
     * SENTENCE the row makes is still the survey's own (the roster is refused,
     * so the body has no live position); only the policy digit comes from the
     * source of truth.
     */
    [/chaser roster is REFUSED|no live position for it|priced "stepped"/,
        () => 'BRIDGE+KILL_ARM — the room\'s CHASER ROSTER is refused, so the body has no '
        + 'live position: `bait` has no line to move it along and `kill` has no removal to '
        + `watch. \`KILL_ARM_POLICY.Bob\` is \`${KILL_ARM_POLICY.Bob.policy}\`${
            KILL_ARM_POLICY.Bob.policy === 'modelled'
                ? ' (R9 slice 12), so the press arm is NOT what is missing here — the '
                + 'ROSTER refusal is'
                : ' — "nothing drove a PRESS against a chaser"'}`],
    [/`Game\.shake`|is on screen at tick/,
        'CAMERA BAND — `levelRun` REFUSES an on-screen verdict for a body at the screen '
        + 'edge inside `Game.shake`\'s jiggle (camera.js, "THE SHAKE, AND WHY IT IS A '
        + 'BAND"). Not a missing mechanism: a missing STANCE RULE. The refusal names its '
        + 'own cure — "move the stance away from the screen edge, or wait the shake out"'],
    [/Strategy '([a-z]+)' failed to apply/,
        (m) => `VERB-APPLY — the '${m[1]}' strategy IS registered and did not apply here`],
    /**
     * ⛓ R9 SLICE 4 — R8 LESSON 2's OWN SHAPE HAD NO RULE, and a mutant is what
     * found it. `solverBot` deliberately distinguishes *"no strategy row
     * exists"* from *"a strategy is SELECTED and not registered"* — the second
     * is the COMPUTED work order the whole seam exists to produce — and this
     * classifier had a rule for the first and not the second, so the sentence
     * that names the next slice's job landed as `unclassified`.
     *
     * ⚠ AND IT REACHES NOTHING ON TODAY'S ROUTE (trap 475: a declared axis that
     * reaches nothing prints a complete-looking table). Its witness is slice
     * 4's mutant (b) — the `break` row registered with `STRATEGY_EXECUTORS
     * .break` removed — which produced exactly this text on step 12 and landed
     * as `unclassified`. It is added with that witness named, not on the
     * strength of a shape nobody has seen.
     */
    [/Strategy '([a-z]+)' is SELECTED but not registered/,
        (m) => `VERB-SELECTED-NOT-REGISTERED — the table names '${m[1]}' for this obstacle `
            + 'and no executor is registered for it. R8 lesson 2: this is a COMPUTED work '
            + 'order, not a missing mechanism — the room says which verb it wants'],
    [/No strategy row exists for this obstacle/,
        'VERB-MISSING — the selected obstacle has NO strategy row at all'],
    [/needs a GAME-sourced tick/,
        'ORACLE — a declaration the model refuses to compute; only the `--win` game '
        + 'channel can answer it, which is a RECORDING channel (R9\'s)'],
    [/combat ladder is EXHAUSTED/,
        'LADDER — every rung of ⚖ §11.8a\'s order refused; see the per-rung reasons'],
    /**
     * ⛔ R9 slice 7b — A MISSING FIXTURE IS A CAUSE, NOT AN "unclassified".
     *
     * Slice 7's mutant (e) left a retired name in the staged boot and the full
     * run came back 13/29 with TEN steps reading `CRASHED — unclassified — see
     * the refusal text`. The children were all dying on the SAME `ENOENT`, and
     * the table said nothing about it: ten rows of regression with no cause
     * named. `assertBootSourcesOnDisk` now refuses before any child starts, so
     * this rule is the SECOND line of defence — it catches an `ENOENT` on a
     * file the boot-source sweep does not reach (an expectation, a trace, an
     * atlas) and NAMES THE PATH instead of shrugging.
     */
    [/ENOENT: no such file or directory, open '([^']+)'/,
        (m) => `MISSING-FIXTURE — the child died opening \`${m[1].split('/').pop()}\`, which `
            + `is not on disk (${m[1]}). This is not a solver refusal: nothing was solved, `
            + 'so the row is a BROKEN INPUT and its verdict says nothing about the room'],
];

/**
 * ⛓⛓⛓ R9 SLICE 12b″ — **THE HITS ARE ASKED FIRST, AND THE TEXT SECOND.**
 *
 * A refusal describes the OBSTACLE the planner could not get past. It says
 * nothing about what the room had already done to the player on the way to
 * it — and those are different findings that a text-only classifier files
 * under one name. R9 slice 12's own L14 row is the witness: the walk took a
 * hit at tick 44 and THEN threw a camera-band message, and the table read
 * `CAMERA BAND` — a true sentence about the wrong subject. A row whose run
 * took damage is a HIT row first, whatever it went on to say.
 *
 * ⛔⛔ AND IT REACHES NOTHING ON TODAY'S ROUTE, WHICH IS SAID HERE RATHER THAN
 * DISCOVERED LATER (trap 475: a declared axis that reaches nothing prints a
 * complete-looking table). The survey builds its `replay` block only when a
 * step SOLVES, and a SOLVED step has no refusal to classify — so on the
 * committed twenty-nine every call passes `run` as null and every family text
 * is exactly what it was. Its only witness today is the synthetic row in
 * `surveyFamily.test.js`. ⚠ WHAT WOULD GIVE IT REACH is capturing the run the
 * REFUSING solve built (`twoPassSolve`'s `makeRun` handing its last run back),
 * which would let a refused row carry its own hits — named as residue rather
 * than done here, because it would move committed family texts and this slice
 * is a RECORD.
 *
 * ⛔ THE ORDER IS THE CLAIM. Asked after the text loop, the arm is dead: every
 * refusal this survey has ever seen matches one of the rules above, so the
 * loop returns first and a hit-bearing run is classified by its message. That
 * is mutant (e), and it reds the synthetic row.
 */
export function familyOf(refusal, run = null) {
    if (!refusal) return null;
    const hits = run?.playerHits;
    if (Array.isArray(hits) && hits.length) {
        const first = hits[0];
        const at = Number.isFinite(first?.t) ? first.t : null;
        return `HIT — the run took ${hits.length} hit(s)${at === null ? '' : `, the first at `
            + `tick ${at}`} BEFORE it refused. The refusal below names the obstacle the `
            + 'planner could not pass; it does not name the damage the walk had already '
            + 'taken, and those are two findings. The room is a COMBAT problem first '
            + '(R9 slice 12\u2019s L14: one hit at tick 44, then a camera-band throw, filed '
            + 'as CAMERA BAND).';
    }
    for (const [re, family] of FAMILY_RULES) {
        const m = re.exec(refusal);
        if (m) return typeof family === 'function' ? family(m) : family;
    }
    return 'unclassified — see the refusal text';
}
