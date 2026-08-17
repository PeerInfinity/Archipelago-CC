/**
 * seedlingDemo/procgenOracle — THE ORACLE HALF of the PoC's generator seam.
 *
 * Seedling PROCGEN PoC arc, slice 1 (kickoff §3.2: `solve(levelRecord, boot,
 * goals, budget) -> {verdict, …}`). ⚖ Ruling §1.1: a generated level has no
 * wasm counterpart, so **the JS engine + solver bot IS its oracle** — for the
 * feature set the survey has proven. This file is the one place the loop asks
 * it, and it exists to turn a THROW into a VERDICT CLASS with its evidence.
 *
 * ── ONE RUN CONSTRUCTION, AND IT IS NOT THIS FILE'S ───────────────────
 *
 * ⛔ The run comes from `solveForPage` — the same construction the editor page
 * and `check-seedling-editor-solve.mjs` already share, which is itself
 * `createRunForStaging` + `solveSegment` + `buildStagedTape`. This module
 * adds no fourth opinion about how a segment is staged, solved or folded; it
 * adds a CLASSIFIER over the outcome. A generator that built its own run
 * would be the two-cost-models trap with geometry (`watchSolve`'s own note),
 * and the generated room would look perfectly fine on screen.
 *
 * ── THREE VERDICTS, AND WHY THE THIRD IS NOT A KIND OF REFUSAL ────────
 *
 * A REFUSAL is a claim about the LEVEL: no corridor, a ladder exhausted, a
 * verb with no executor. Its evidence is the solver's own text, carried
 * VERBATIM (⚖ kickoff §3.1: across 39 route-step solves not one danger query
 * answered dangerous — the refusal reason IS the evidence channel, and a
 * paraphrase here would be a second spelling of the only content).
 *
 * A BUDGET EXHAUSTION is a claim about the SEARCH: this level cost more than
 * the loop is willing to pay. It is a BOUND, never a proof of unsolvability
 * (trap 205: the TIME rung's 40,000-expansion cap is a free parameter — and
 * 2026-08-14 finally measured it: it binds in 1 solve in 326, and that one hit
 * cost 12,267 ms), so a template family that keeps drowning the search must
 * surface as a finding about the budget rather than as a silent palette hole.
 * Folding it into REFUSED would do exactly that folding.
 *
 * ⚠⚠ **NO BUDGET HERE IS ENFORCED MID-FLIGHT, AND SINCE 2026-08-14 NONE IS
 * DENOMINATED IN TIME.** `solveSegment` is synchronous and owns its own loop;
 * nothing outside it can interrupt a search mid-flight without an engine edit,
 * and this arc's target is zero engine edits. So a runaway solve still costs
 * its full run before the verdict is known — the budget bounds what the loop
 * ACCEPTS, not what it SPENDS. Named here because a reader who assumed
 * otherwise would size the budget as a timeout and get a generator that runs
 * for hours.
 *
 * ⛔ A WALL CLOCK USED TO SIT IN THAT SENTENCE AND IT WAS NOT A TIMEOUT
 * EITHER — it was measured after the fact and used to RECLASSIFY a finished
 * solve, which is how the box came to decide which levels existed. It is gone;
 * `DEFAULT_BUDGET`'s docblock carries the measurements. (Residue, unchanged: an
 * in-search bound needs a hook in `solverBot`, a byte-inert engine edit
 * somebody must argue for. That is what would make a budget a real timeout.)
 *
 * ── THE ONE CLASSIFIER THAT READS TEXT, AND ITS BOUND ─────────────────
 *
 * The per-target TICK budget is real and in-solver (`maxTicksPerTarget`), but
 * the driver spends it by THROWING — the same class, `SolverRefusal` /
 * `BotDriverV2Error`, that a genuine no-corridor refusal throws. The eight
 * exhaustion sites in `botDriverV2` all spell the budget into the message
 * ("not reached within 400 ticks", "walked at … for 400 ticks", "ceremony has
 * not finished after 400 ticks", …), so the classifier keys on THE NUMBER
 * THIS CALL PASSED IN followed by "tick".
 *
 * ⚠ NAMED BOUND: that is a text test, and it is the weakest link in this
 * file. It cannot false-negative into silence (an unrecognised budget failure
 * lands in REFUSED, where it is visible and wrong rather than invisible), and
 * `classifiedBy` says on every verdict how it was decided, so a future reader
 * can audit the call rather than trust it.
 *
 * ── WHAT IS *NOT* CAUGHT ──────────────────────────────────────────────
 *
 * ⛔ `SolverRefusal` and `BotDriverV2Error` become verdicts, plus **exactly
 * two NAMED `SolverBotError` codes** and nothing else. A `LevelWorldError` (a
 * record the engine will not build), an UNCODED `SolverBotError` (this file
 * calling the solver wrongly, or an undiagnosed family like `bosslock`), a
 * `TypeError` — those are defects in the GENERATOR, and a loop that quietly
 * reverted them would hide its own bugs behind "that candidate didn't work
 * out" (traps 171/173: a conservative ingredient manufactures problems and
 * hides bound defects). They propagate.
 *
 * ⛓ THE TWO CODES, each bought by its own measurement and each reaching a
 * DIFFERENT verdict (see `isHammerSafetyRefusal` and
 * `isStrikeBoundExhaustion` for the arguments):
 *
 *   `HAMMER_SAFETY`  (slice 4e, re-keyed 2c)  ⇒ `REFUSED`
 *   `STRIKE_BOUND_EXHAUSTED` (slice 2d)       ⇒ `BUDGET_EXHAUSTED`
 *
 * ⛔ `e.code` is `null` on every other throw in `solverBot`, so the catch is
 * narrow BY CONSTRUCTION rather than by vocabulary — it cannot drift wider
 * because a sentence was reworded.
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`).
 */

import { VERDICT } from '../procgenCore/levelGenerator.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { BotDriverV2Error } from './botDriverV2.js';
import { DEFAULT_MAX_TICKS_PER_TARGET } from './botDriverV1.js';
import {
    HAMMER_SAFETY, STRIKE_BOUND_EXHAUSTED, SolverBotError, SolverRefusal,
} from './solverBot.js';
import { atlasOf } from './procgenLevel.js';
import { solveForPage } from './watchSolve.js';

export class ProcgenOracleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenOracleError';
    }
}

const fail = (message) => { throw new ProcgenOracleError(message); };

/**
 * The three classes, and there are exactly three (⚖ kickoff §3.1).
 *
 * ⛓ DECLARED IN `procgenCore/levelGenerator.js` SINCE 2026-08-15 and
 * re-exported here under the name every Seedling reader already uses
 * (CONSTRUCTIVE-MODE slice 2). The loop compares against it and a second
 * oracle — the maze's — has to return the same word without importing this
 * file; one declaration is the only shape in which those two facts hold at
 * once. ⛔ The strings did not change, so nothing downstream moved.
 */
export { VERDICT };

/**
 * THE NAMED BUDGET VALUES, and where each number comes from.
 *
 * ⚠ `maxTicksPerTarget: 400` — `botDriverV1.DEFAULT_MAX_TICKS_PER_TARGET`,
 * imported rather than typed, and equal to the engine default ON PURPOSE:
 * slice 1 must change no solver behaviour, so the number the loop names is
 * the number the solver was already using. The knob exists so a later slice
 * can lower it deliberately, with a measurement.
 *
 * ── ⛔ THERE IS NO WALL CLOCK HERE ANY MORE, AND THAT IS THE POINT ────────
 *
 * `wallClockMs: 5000` used to sit beside it and it is GONE (2026-08-14, ⚖ user
 * priority: *"make procgen deterministic, by making it tick based, not wall
 * clock based"*). It was the only bound in this file that was not a property
 * of the candidate: a solve that SUCCEEDED was reclassified `BUDGET_EXHAUSTED`
 * for taking too long, so a keep on a quiet box became a revert on a busy one
 * and the run reached different candidates from there on.
 *
 * ⛔ THE FAILURE WAS WORSE THAN "DIFFERENT CANDIDATES", MEASURED. At load ~100
 * on 8 cores, `--seeds=9` crashed 5 runs out of 5: the SKELETON solve — the
 * empty bordered room, solvable by construction, the loop's own CONTROL arm —
 * succeeded in 5,810-8,334 ms, was reclassified, and `levelGenerator`'s
 * skeleton guard then accused the room builder of a defect it did not have.
 * The same seed on a quiet box is a clean 1,756-byte set, exit 0.
 *
 * ── WHY NO NUMBER REPLACES IT, WHICH IS ALSO A MEASUREMENT ───────────────
 *
 * The question this file had to answer was *"what is the tick or expansion
 * equivalent of 5,000 ms?"*, and the honest answer measured out to **none
 * needed** — nothing became unbounded when the clock went. Quiet box, 8 cores,
 * node 18, 326 solves over 40 seeds (pre-sword, obstacleTarget 6, tries 8):
 *
 *   - EVERY remaining bound is already deterministic. Ticks are bounded per
 *     target by `maxTicksPerTarget` and expansions per dash by `planDash`'s
 *     cap; observed max TOTAL ticks over all 326 solves was **800** (= 2x400).
 *   - The tick analogue of the old provenance would be ~5,360 (40x the empty
 *     room's **134 ticks**, the same 40x reasoning `wallClockMs` used against
 *     the same room's 47-139 ms). That is **6.7x above anything ever
 *     observed** — a bound that never binds is decoration, so it is not here.
 *   - `maxTicksPerTarget` already binds where the clock used to: it classified
 *     4 of the 5 `BUDGET_EXHAUSTED` verdicts in the sweep.
 *
 * ⛔ AND STILL NO EXPANSION BUDGET, FOR A NEW REASON. `planDash`'s
 * 40,000-expansion cap remains internal to `solverBot`. Threading it here was
 * the obvious next move and the measurement refused it twice: the search ran
 * at all in **2 of 326 solves** and hit the cap in **1**, so as a bound it is
 * decorative; and when it does fire it surfaces as ONE RUNG's sub-reason
 * inside a ladder refusal whose other rungs refused about the LEVEL ("no
 * admissible corridor", "no live body's removal admits a corridor"), so
 * classifying on it would turn a true REFUSED into a false BUDGET_EXHAUSTED.
 *
 * ⚠ RESIDUE, measured and NOT fixed here: that one cap hit cost **12,267 ms**
 * in a single dash. 40,000 is far too loose to be a useful cost bound. Lowering
 * it is a separate slice with its own measurement — it is a SLOWNESS finding,
 * not a determinism one, and the two must not be traded for each other.
 */
export const DEFAULT_BUDGET = Object.freeze({
    maxTicksPerTarget: DEFAULT_MAX_TICKS_PER_TARGET,
});

/** A budget, checked and completed from the defaults. */
export function assertBudget(budget = DEFAULT_BUDGET) {
    const b = { ...DEFAULT_BUDGET, ...(budget ?? {}) };
    /**
     * ⛔ A `wallClockMs` IS REFUSED BY NAME RATHER THAN IGNORED. Every caller
     * in the tree was updated, but a budget object is the kind of thing that
     * gets copied out of an old doc or an old branch, and silently dropping
     * the field would hand that caller a budget it thinks bounds time and
     * does not. The refusal names the replacement so the reader is not left
     * guessing which knob they wanted.
     */
    if ('wallClockMs' in b) {
        fail('procgenOracle: budget.wallClockMs is GONE — elapsed time is not a '
            + 'property of the candidate, and classifying on it made a keep on a quiet '
            + 'box a revert on a busy one. Use `maxTicksPerTarget`, which is '
            + 'deterministic and already binds. See DEFAULT_BUDGET\'s docblock.');
    }
    if (!Number.isInteger(b.maxTicksPerTarget) || b.maxTicksPerTarget <= 0) {
        fail(`procgenOracle: budget.maxTicksPerTarget must be a positive integer of `
            + `ticks, got ${JSON.stringify(b.maxTicksPerTarget)}.`);
    }
    return Object.freeze(b);
}

/**
 * ⛓⛓⛓ THE GENERATED BOOT'S `Game.time` — SLICE 4e, AND IT IS `dayLength / 2`
 * RATHER THAN THE ZERO THE BRIEF ASKED FOR.
 *
 * ⚖ THE SEMANTIC BASIS, ruled 2026-08-12 and kept verbatim: **for a synthetic
 * level the generator OWNS the boot, so a declared `save.time` is
 * definitionally faithful** — the survey's staged-boot semantics, *"this room
 * is solvable FROM THIS DECLARED STATE"*. Nothing outside this file has a
 * competing claim about what o'clock a generated room starts at.
 *
 * ⛔ **BUT ZERO IS UNREPRESENTABLE, AND THE FORMAT SAYS SO IN ITS OWN WORDS.**
 * `SEAM_BOOT_SPEC`'s `time` row is `{min: 0, exclusiveMin: true,
 * zeroMeansUndeclared: true}` because `Main.as:158` is
 * `get time() { if (!SAVE_FILE.data.time) return Game.dayLength / 2; … }` — a
 * stored 0 is APPLIED as `dayLength / 2`, which is the one failure a seam
 * field must not have. Measured through `parseTape`, not assumed:
 *
 *   seam.time 0 -> REFUSED: *"seam.time is 0, which must be > 0 — day/night
 *   phase, AND `Spinner`'s hammer angle; 0 is `Main.time`'s falsy arm
 *   (Game.dayLength / 2)"*
 *
 * ⇒ the honest declaration is the value zero MEANS, spelled out: `dayLength /
 * 2`, derived from `Game.as:460`'s `dayLength = 160 * Main.FPS` and
 * `Main.as:27`'s `FPS = 60` rather than typed as 4800. ⛓ It has a COMMITTED
 * WITNESS — `fixtures/tapes/r8-hammer-arm.json` declares `seam.time` 4800, so
 * this is a clock the roster already boots under and not a number invented
 * here.
 *
 * ⚠ WHY THE CONSTANT LIVES IN THIS FILE and not in `gameClock`, said out loud:
 * `gameClock` owns the COUNTING and this is a DECLARATION — the PoC's own
 * choice of boot state, in the same file as the rest of the boot block. Moving
 * it into the engine would be an engine edit this slice is not entitled to.
 *
 * ⛓ THE LINEAGE — [[feedback_declared_bound_excludes_generated_ids]], the
 * SECOND arrival in this arc. Slice 4b (§13.4) found `tapeFormat` bounding
 * `persistence[].level` to 0..115 while leaving `boot.level` unbounded, so a
 * generated level can be BOOTED by a tape and never DECLARED ABOUT by one.
 * This is the same shape one field over: a bound written for the real game's
 * value space excluding the value a generator would naturally pick. There the
 * bound blocked the arm; here it only renames it.
 */
export const GENERATED_BOOT_TIME = (160 * 60) / 2;

/**
 * THE PoC's STAGING BLOCK — a biome boot, in the tape vocabulary.
 *
 * ⚠ EVERY FIELD IS DECLARED, none defaulted by the engine: `parseTape` refuses
 * a partial block by name and `watchSolve.stagingFromJson`'s docblock says why
 * (`noclip` selects which physics runs, `noDamage` selects whether
 * `Player.hit()` runs — filling either in silently would be choosing an
 * experiment on the caller's behalf).
 *
 * ⚠ `pins: ['dead_frames']` is the true-start tape's own pin (`r7-act2-1`).
 * ⛓ A biome that places WATER must add `'sound'`: `stepV2` REFUSES a wet tick
 * on a block that does not pin it (R5 §13 — the swim burst reads the mixer's
 * wall clock otherwise). Slice 2/3's water templates own that addition, and
 * the parameter is here so it is an argument rather than an edit.
 *
 * ⛓⛓⛓ SLICE 4e — AND `time` IS DECLARED, WHICH IS WHAT MAKES THE HAMMER EXACT.
 *
 * `Spinner.update`'s hammer is a `collideLine` at `(Game.time % 45) / 45 · 2π`
 * (`Spinner.as:70-72`). `dangerMap.spinnerDanger` prices that exact line iff
 * `run.gameTimeAt(horizon)` answers a number, and `createLevelRun` gives it one
 * iff the BOOT declares `save.time` (`levelRun.js:462`, `gameClock`). Until
 * this slice this block declared none, so **every generated solve since slice 1
 * priced a spinner by the 13 px union over all 45 phases** — the fallback whose
 * own text says *"because `Game.time` is not countable on this tape"*, which
 * was true and was this block's own doing.
 *
 * ⛔ THAT IS [[feedback_conservative_ingredient_makes_the_problem]] — traps
 * 171/173 — arriving in this arc for the THIRD time (after §10.4's density
 * ceiling that was D3, and §11.4's `weigh` gate that was right about the
 * mechanism and wrong as a selection rule). R8 slice 8 had already measured
 * what the disc costs on the same mechanism: over L18's 60 walkable cells, the
 * disc left **1** cell clear for the horizon and the exact line left **16**,
 * with 3 separated presses against 0 (`dangerMap`'s own docblock). The kill-lock
 * sweep's 26-of-32 `THREW:transit` rows (§13.6) are that measurement's shadow
 * in a generated room.
 *
 * @param {object} o
 * @param {{level:number,x:number,y:number}} o.boot   `procgenLevel.bootAtTile`
 * @param {object} [o.items]   seam item flags, e.g. `{hasSword: true}`
 * @param {string[]} [o.pins]
 * @param {number|null} [o.time]  the boot's `Game.time`, `GENERATED_BOOT_TIME`
 *        by default. ⛔ `null` DECLARES NOTHING and is the PARENT's behaviour —
 *        the clock refuses, the hammer falls back to the disc. It exists so the
 *        flip can be driven in BOTH directions from one code path rather than
 *        measured against a reverted checkout; it is not an option any biome
 *        takes.
 */
export function bootStaging({
    boot, items = null, pins = ['dead_frames'], time = GENERATED_BOOT_TIME,
}) {
    if (!boot || !Number.isInteger(boot.level)
        || !Number.isFinite(boot.x) || !Number.isFinite(boot.y)) {
        fail(`procgenOracle: bootStaging needs boot {level, x, y} — `
            + `got ${JSON.stringify(boot)}. \`procgenLevel.bootAtTile\` builds one.`);
    }
    if (time !== null && !(Number.isFinite(time) && time > 0)) {
        // The format's own bound, restated where the value is chosen rather
        // than left for `parseSeam` to discover on a block that may never be
        // parsed: this staging reaches `createLevelRun` directly.
        fail(`procgenOracle: bootStaging's \`time\` must be a positive number or null, `
            + `got ${JSON.stringify(time)}. \`SEAM_BOOT_SPEC\`'s \`time\` row is `
            + '`exclusiveMin` at 0 because `Main.time`\'s getter applies a stored 0 as '
            + '`Game.dayLength / 2` — a field whose declared and applied values '
            + 'disagree. `null` declares nothing at all.');
    }
    const seam = {
        ...(items ? { items: { ...items } } : {}),
        ...(time === null ? {} : { time }),
    };
    return {
        boot: { ...boot },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...pins],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        // ⚠ `seed: 0` here means what it means to a TAPE — "inherit the
        // build's own boot state" — and is the true-start tape's own value.
        // It is not a generation seed; see `procgenRng`'s docblock for why
        // the two must never be confused.
        rng: { seed: 0, split: false, cosmetic: 0, fp: 987286273 },
        // ⛔ `null` ONLY WHEN THE BLOCK IS GENUINELY EMPTY. `parseSeam` reads
        // `null`/absent as "declares no boot state", so an empty object and a
        // null are the same claim — but a block holding `time` alone must not
        // be flattened to null by a test that only asks about `items`.
        seam: Object.keys(seam).length > 0 ? seam : null,
    };
}

/**
 * A collect goal on a placement, in the SOLVER's own vocabulary.
 *
 * ⚖ Kickoff §1.4: v1's only goal kind. The spelling is `assertGoal`'s, never
 * a third one (`watchSolve.formatGoal` is the URL spelling of the same thing).
 */
export const collectGoal = (x, y) => ({ kind: 'collect-placement', placement: { x, y } });

/**
 * Did the walk actually take what the goals named?
 *
 * ⛓⛓ ⚖ KICKOFF §3.4: THE CLEAR IS BANKED AT SOLVE TIME AND CASHED AT THE
 * NEXT BUILD, so certification reads THE SOLVE'S OWN COLLECT RECORDS —
 * `out.records`, each carrying `{goal, strategy, pickup:{tag,x,y}, item, …}`
 * — and never a persistence ledger it expects to be non-empty.
 *
 * ⛓ MEASURED, and it refines the kickoff's wording: `run.earnedClears` is in
 * fact NON-empty at the end of a solve that collects a tag-clearing pickup
 * (`[{level, tag, by: 'torchpickup@128,128', t}]`, slice 1's own probe). The
 * ledger is not the certification anyway — it answers "which flags did this
 * walk turn off", not "did this walk reach the goal" — but a later slice that
 * reads the kickoff's note as "earnedClears is always empty" would be reading
 * something this arc has now measured otherwise.
 */
export function certifyCollects(goals, records) {
    const missing = [];
    for (const goal of goals) {
        if (goal.kind !== 'collect-placement') continue;
        const found = (records ?? []).find((r) => r.goal === 'collect-placement'
            && r.pickup && r.pickup.x === goal.placement.x
            && r.pickup.y === goal.placement.y);
        if (!found) missing.push(`place:${goal.placement.x},${goal.placement.y}`);
    }
    return {
        certified: missing.length === 0,
        missing,
        collected: (records ?? [])
            .filter((r) => r.goal === 'collect-placement' && r.pickup)
            .map((r) => ({
                tag: r.pickup.tag,
                x: r.pickup.x,
                y: r.pickup.y,
                item: r.item ?? null,
                strategy: r.strategy,
            })),
    };
}

/** Does a refusal message name the tick budget this call passed in? */
const namesTickBudget = (message, maxTicksPerTarget) => new RegExp(
    `\\b${maxTicksPerTarget} ticks?\\b`).test(message ?? '');

/**
 * ⛓⛓⛓ SLICE 4e — THE ONE CLASS THE CATCH WIDENS BY, AND ITS BOUND IS NAMED.
 *
 * ⛔ THE DECISION WAS MADE ON A RE-MEASUREMENT, not on a hunch (⚖ kickoff
 * §4.4e step 3). With the clock counting, the kill-lock sweep's transit class
 * collapsed from **26 of 32 cells to 7** and its wins went 2 -> 21 — but the
 * class did not reach zero, and two of the spinner+kill-lock template's own
 * legal anchors still land in it. A family whose failure mode ABORTS the run
 * cannot be offered to the loop (§13.7.iv), so this is the difference between
 * a family the palette can carry and one it cannot.
 *
 * ── WHY THESE SITES ARE A REFUSAL AND NOT A DEFECT ────────────────────
 *
 * They are `solverBot`'s hammer-SAFETY refusals, and every one is a claim
 * about the LEVEL — "there is nowhere in this room to stand, step or strike
 * from" — which is exactly what `VERDICT.REFUSED` means. They throw
 * `SolverBotError` rather than `SolverRefusal` because of WHERE they are
 * raised (inside the kill schedule, below the goal loop), not because of what
 * they claim. The three that throw, each stamped `code: HAMMER_SAFETY`:
 *
 *   `safeStep`      the derived PRESS tick's own landing cell is unsafe
 *   `safeStep`      every key set — the plan's and its alternatives — lands on
 *                   a body or a hammer on the next tick
 *   `deriveRefuge`  no reachable cell is body- and hammer-clear for the
 *                   window, and no strike is derivable ("nowhere to be")
 *
 * ⚠ AND A FOURTH THAT IS NOT ONE (slice 2c, from reading the source to re-key
 * this): `derivePressKill`'s *"no (cell, tick) … puts the whole five-dispatch
 * train inside 16 px of a body"* is a `rejected.push`, folded into a
 * `SolverRefusal` at PLANNING time. It never reaches this predicate — which is
 * also why probe 2b's 23 corridor reverts read "no arrow trap" about rooms
 * where a ceiling was never the candidate (its R9 item (ii)).
 *
 * ⛔⛔ **AND NOTHING ELSE WIDENS.** A `LevelWorldError`, a `TypeError`, the
 * dialogue-ceremony guard's bare `Error`, an unkeyed `bosslock`'s
 * `SolverBotError` — all still PROPAGATE and still kill the run, because those
 * are defects in the generator or families it must not be offering, and a loop
 * that quietly reverted them would hide its own bugs behind "that candidate
 * didn't work out" (traps 171/173, which forbid widening CASUALLY and not
 * widening at all).
 *
 * ⛓⛓⛓ ARC 3 SLICE 2c — THE RESIDUE ABOVE IS DISCHARGED, AND ITS OWN CONDITION
 * IS WHAT DISCHARGED IT.
 *
 * This predicate used to read `/hammer disc/.test(e.message)`, and the note
 * here said so: *"the structured fix is a field on the throw … the day
 * `solverBot` is open for another reason, stamp the four sites and this
 * predicate becomes a field read."* Slice 2c opened `solverBot` to REWORD
 * exactly those sentences — three of them named the 45-phase disc while
 * `clearOfHammersAt` was deciding on the exact `collideLine` — so a prose key
 * would have turned every hammer-safety refusal into a run abort on the same
 * commit that fixed the prose.
 *
 * ⛔ THE CATCH IS STILL EXACTLY AS NARROW, and now by CONSTRUCTION rather than
 * by vocabulary: `SolverBotError.code` is `null` on every throw but the three
 * `fail()` sites that stamp `HAMMER_SAFETY`, so an unkeyed `bosslock`'s
 * `SolverBotError`, a `LevelWorldError` and a `TypeError` all still propagate.
 *
 * ⚠ THE FOURTH SITE IS NOT ONE, and reading the source to re-key said so:
 * `derivePressKill`'s *"no (cell, tick) … stays clear of every body's 7x7 rect"*
 * is a `rejected.push`, folded into a **`SolverRefusal`** at planning time — it
 * never reaches this predicate at all. The docblock above called it a fourth
 * throw; it is a fourth REFUSAL of a different class.
 */
const isHammerSafetyRefusal = (e) => e instanceof SolverBotError
    && e.code === HAMMER_SAFETY;

/**
 * ⛓⛓⛓ ARC 3 SLICE 2d — THE **SECOND** NAMED CLASS, AND IT IS A BUDGET.
 *
 * ⛔ THE MEASUREMENT THAT BOUGHT IT, NOT A HUNCH. Probe 2b (§9b.5) ran the
 * carved-pairs attribution and found ONE item at **1,307,169 ms — 21 m 47 s —
 * that ended in `THREW SolverBotError` and killed its whole generation run**:
 * `execKillByPress`'s bound-exhaustion `fail()`, *"ran the strike schedule
 * against spinner@64,80 for the whole 2010-tick bound (10 strike(s) planned,
 * 3 landing(s)) and the body is still in the world"*. It carried no code, so
 * this file propagated it and `levelGenerator` turned it into
 * `GenerationAborted`. That is 4b §13.7.iv's own condition — *a family the
 * loop cannot REJECT is not one the palette can OFFER* — met by a SECOND
 * class, where §9.5c and §9.8 had only ever seen the `swing … collideLine`
 * one. ⚖ Escalated by the probe and ruled on: widen, by name.
 *
 * ── WHY THIS ONE IS `BUDGET_EXHAUSTED` AND THE HAMMER ONES ARE `REFUSED` ──
 *
 * The two coded classes make DIFFERENT claims and get different verdicts, and
 * conflating them would have been the easy version of this change:
 *
 *   `HAMMER_SAFETY`          a claim about the LEVEL — "there is nowhere in
 *                            this room to stand, step or strike from" ⇒ REFUSED
 *   `STRIKE_BOUND_EXHAUSTED` a claim about a BOUND THIS PROCESS SET — the
 *                            schedule ran `SPINNER.hitsMax * (strikeHorizon +
 *                            HOLD_SLACK)` driven ticks and the body outlived
 *                            it ⇒ BUDGET_EXHAUSTED, the same class as the
 *                            400-tick per-target budget below
 *
 * Both REVERT the candidate, so the split changes no keep/revert decision —
 * but `budgetKind` reaches `levelGenerator`'s TRACE, whose sha is part of the
 * determinism payload, and a trace that called a tick budget a level claim
 * would be evidence pointing at the room.
 *
 * ⛔⛔ AND NOTHING ELSE WIDENS, still. `e.code` is `null` on every other
 * `SolverBotError` in the tree, so an unkeyed `bosslock`'s throw, a
 * `LevelWorldError` and a `TypeError` all propagate exactly as before — the
 * catch is narrow BY CONSTRUCTION and not by vocabulary (traps 171/173).
 */
const isStrikeBoundExhaustion = (e) => e instanceof SolverBotError
    && e.code === STRIKE_BOUND_EXHAUSTED;

/**
 * The budget a THROWN solve exhausted, or `null` if it exhausted none.
 *
 * ⛓ EXPORTED FOR ITS OWN UNIT ROW. The end-to-end subject for the strike
 * bound is a **21-minute** solve (§9b.5), which is not a gate anything can
 * run; so the classification is a pure function of (throw, budget) and is
 * graded as one. ⛔ The ORDER is load-bearing: the strike bound is asked
 * FIRST because its own message contains no "N ticks" phrase that
 * `namesTickBudget` could match, and asking the text test first would make
 * the answer depend on a sentence rather than on a field.
 */
export function budgetKindFor(thrown, maxTicksPerTarget) {
    if (isStrikeBoundExhaustion(thrown)) {
        return `strike-schedule bound (${thrown.boundTicks} driven ticks)`;
    }
    return namesTickBudget(thrown?.message, maxTicksPerTarget) ? 'per-target-ticks' : null;
}

/**
 * SOLVE ONE LEVEL — the §3.2 seam's oracle half.
 *
 * @param {object} levelRecord   an atlas level record (`procgenLevel`)
 * @param {object} staging       the biome's staging block (`bootStaging`).
 *        ⚠ §3.2 calls this argument `boot`; what the engine needs is the
 *        whole STAGING block, of which `boot` is one field.
 * @param {object[]} goals       the solver's ordered goal list
 * @param {object} [budget]      see `DEFAULT_BUDGET`
 * @param {object} [o]
 * @param {function} [o.now]     injected clock, for tests
 * @param {string} [o.name]      the tape name the solve records under
 * @param {boolean} [o.scratchPersistence]  ⛓⛓⛓ SLICE 4b, DEFAULT **TRUE**,
 *        and this is the ONE place it is turned on in the whole codebase.
 *
 *        ⚖ Kickoff §1.13. A kill-lock clear is DECLARED by a recorded tape's
 *        v9 `at` row, and a generated level has no tape at solve time — the
 *        solve is what would produce one. So `levelRun` refuses to compute a
 *        clear the tape does not carry ("two writers of one persistence
 *        slot"), and that refusal is correct everywhere a tape exists and
 *        vacuous exactly here. The flag lets the model be the ONE writer for
 *        slots no declaration owns; `run.scratchClears` says what it wrote.
 *
 *        ⛔ THE DEFAULT IS TRUE BECAUSE THIS MODULE IS THE GENERATED-LEVEL
 *        ORACLE AND HAS NO OTHER CALLERS. Every path that solves a level with
 *        a tape behind it (`watchViewer`'s SOLVE arm, `watchManual`, the
 *        battery, every replay stepper) goes through `solveForPage` or
 *        `createRunForStaging` directly, where the default is FALSE. The
 *        parameter is here so a probe can turn it OFF and measure the
 *        parent's behaviour — which is what the flip gate does.
 * @returns {object} `{verdict, ms, budget, …evidence}`
 */
export function solve(levelRecord, staging, goals, budget = DEFAULT_BUDGET, {
    now = () => Date.now(),
    name = `procgen-l${levelRecord?.level}`,
    scratchPersistence = true,
} = {}) {
    const b = assertBudget(budget);
    if (!Array.isArray(goals) || goals.length === 0) {
        fail('procgenOracle: solve needs a non-empty ordered goal list — an empty list '
            + 'is a segment with no claim (`solveSegment` says the same).');
    }
    const levelSource = levelSourceFromAtlas(atlasOf(levelRecord));
    const base = {
        level: levelRecord.level,
        name,
        goals: goals.map((g) => ({ ...g })),
        budget: b,
    };
    const t0 = now();
    let result = null;
    let thrown = null;
    try {
        result = solveForPage({
            levelSource, staging, goals, name, now,
            // ⛓ Slice 1's one addition to the shared arm: the budget the loop
            // names is the budget the solver runs under. Absent, it would be
            // a bound nobody applies (measured: a 7-tick budget still solved
            // in 134 ticks before the pass-through existed).
            maxTicksPerTarget: b.maxTicksPerTarget,
            // ⛓⛓ Slice 4b: THIS is the one caller that turns the scratch
            // persistence layer on. See the docblock above `DEFAULT_BUDGET`'s
            // neighbour below and `levelRun`'s own.
            scratchPersistence,
        });
    } catch (e) {
        if (!(e instanceof SolverRefusal) && !(e instanceof BotDriverV2Error)
            && !isHammerSafetyRefusal(e) && !isStrikeBoundExhaustion(e)) throw e;
        thrown = e;
    }
    const ms = now() - t0;

    if (thrown) {
        /**
         * ⛔ THE ELAPSED-TIME ARM IS GONE FROM HERE TOO, AND IT WAS NOT THE
         * OBVIOUS DEFECT. This site classifies a solve that THREW, where the
         * old `ms > wallClockMs` arm could not change keep-vs-revert — REFUSED
         * and BUDGET_EXHAUSTED both revert. What it changed was `budgetKind`,
         * which `levelGenerator` writes into the TRACE, and the trace's sha is
         * part of the determinism payload the CLIs compare with `cmp`. Left
         * standing it would have made the LEVEL deterministic and its own
         * evidence not, which is the harder bug to see.
         *
         * ⇒ a refusal is a budget verdict only when it NAMES a budget this
         * call passed in. Everything else is a claim about the level.
         */
        const budgetKind = budgetKindFor(thrown, b.maxTicksPerTarget);
        if (budgetKind) {
            return {
                ...base,
                verdict: VERDICT.BUDGET_EXHAUSTED,
                ms,
                budgetKind,
                // ⛔ VERBATIM. The refusal's own text is the evidence channel.
                reasonText: thrown.message,
                errorName: thrown.name,
                /**
                 * ⛓ SLICE 2d — THE SENTENCE NAMES WHICH BOUND, because there
                 * are now two and they are set in different places: one is a
                 * number THIS CALL passed in, the other is `solverBot`'s own
                 * `SPINNER.hitsMax * (strikeHorizon + HOLD_SLACK)` arithmetic
                 * and no caller can move it. A reader who cannot tell them
                 * apart cannot tell "lower the budget" from "the kill arm ran
                 * out of schedule" (trap 335 — a verdict's own words must name
                 * the arm that reached it).
                 */
                classifiedBy: isStrikeBoundExhaustion(thrown)
                    ? `the kill schedule ran its whole ${thrown.boundTicks}-tick STRIKE `
                      + 'bound (`SPINNER.hitsMax * (strikeHorizon + HOLD_SLACK)`, '
                      + '`solverBot`\'s own arithmetic — not a number this call passed '
                      + 'in) and the body outlived it: a tick budget exhausted, which '
                      + 'is a claim about the BOUND and not about the room'
                    : `the refusal names the ${b.maxTicksPerTarget}-tick `
                      + 'per-target budget this call passed in',
                rows: thrown.rows ?? [],
                ticksSpent: (thrown.perTick ?? []).length,
            };
        }
        return {
            ...base,
            verdict: VERDICT.REFUSED,
            ms,
            reasonText: thrown.message,
            errorName: thrown.name,
            classifiedBy: isHammerSafetyRefusal(thrown)
                ? 'the kill schedule refused on HAMMER SAFETY — a `SolverBotError` whose '
                  + 'claim is about the level ("nowhere to stand, step or strike from"), '
                  + 'carried as a refusal by the ONE named widening slice 4e made'
                : 'the solver refused within budget',
            refusalGoal: thrown.goal ?? null,
            obstacle: thrown.obstacle ?? null,
            considered: thrown.considered ?? [],
            pending: thrown.pending ?? null,
            rows: thrown.rows ?? [],
            ticksSpent: (thrown.perTick ?? []).length,
        };
    }

    const cert = certifyCollects(goals, result.out.records);
    if (!cert.certified) {
        // A solve that RETURNED without taking a goal it was given is not a
        // level verdict — it is a disagreement between this file and
        // `solveSegment` about what a goal means, and it must be loud.
        fail(`procgenOracle: the solve returned but the goal list is not certified — `
            + `no collect record for ${cert.missing.join(', ')}. \`solveSegment\` is `
            + 'supposed to refuse rather than return short, so this is a seam defect, '
            + 'not a rejected candidate.');
    }
    /**
     * ⛓⛓⛓ NOTHING STANDS BETWEEN A CERTIFIED SOLVE AND `SOLVED` — THE FIX.
     *
     * A `ms > b.wallClockMs` branch used to live exactly here and turn a solve
     * that reached every goal into `BUDGET_EXHAUSTED`. That was THE defect
     * (⚖ user priority 2026-08-14): the level was solved, the certification
     * held, and the verdict was decided by how busy the machine happened to
     * be. `levelGenerator` keeps only `SOLVED`, so the box decided the level.
     *
     * ⚠ `ms` SURVIVES IN THE RETURN AND IS EVIDENCE ONLY. It is the one field
     * here that may honestly differ between two runs, so nothing may decide on
     * it — and nothing does: `levelGenerator` reads `verdict`, `ticks`,
     * `classifiedBy`, `reasonText` and `budgetKind` into the trace, never `ms`.
     * ⛔ THIS LINE USED TO SAY *"if a future caller wants to bound cost, bound
     * `ticks`, which is the same quantity measured in a currency the candidate
     * actually owns"*, AND PROBE 2b MEASURED IT FALSE (kickoff §9b.1, trap
     * 331). `ticksSpent` is `(thrown.perTick ?? []).length`, and a
     * `SolverBotError` carries no `perTick` at all — so a 24,231 ms revert
     * prints `ticks: 0`. Where the column IS honest it does not track ms
     * either: over 34 solves the median is 1.9 ms per driven tick and the max
     * 125.2, with the 1282-tick solves among the CHEAPEST. ⇒ `ticks` is a
     * currency two of its own outcome classes cannot pay in, which is not a
     * bound. The bounds that DO exist are named where they are enforced
     * (`maxTicksPerTarget` here, the strike schedule's own in
     * `execKillByPress`), and both surface through `budgetKind`.
     */
    return {
        ...base,
        verdict: VERDICT.SOLVED,
        ms,
        classifiedBy: 'the solver reached every goal within budget',
        ticks: result.out.perTick.length,
        certification: cert,
        /**
         * ⛓⛓⛓ SLICE 4b — the scratch ledger, carried out beside the records.
         *
         * ⛔ IT IS EVIDENCE, NOT CERTIFICATION. `certifyCollects` above is
         * unchanged and still reads the solve's OWN collect records (⚖ §3.4).
         * What this buys is the discharge-existence standard (§12.1) for a
         * kill-lock family: the final solve must carry a `{strategy:'kill'}`
         * RECORD naming the template's own body AND a row here naming the
         * template's own lock flag — an obstacle nobody had to clear can
         * produce neither. `scratchPersistence` rides beside it because an
         * empty ledger under the flag and an empty ledger without it are
         * different facts that print the same thing.
         */
        scratchPersistence: result.run.scratchPersistence,
        scratchClears: result.run.scratchClears,
        tape: result.tape,
        trace: result.out.trace,
        records: result.out.records,
        dangerQueries: result.out.dangerQueries,
        replans: result.out.replans,
        waypointsPlanned: result.out.waypointsPlanned,
        despawns: result.despawns,
    };
}
