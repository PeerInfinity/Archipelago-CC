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
 * (trap 205: the TIME rung's 40,000-expansion cap is a free parameter no
 * measurement has set), so a template family that keeps drowning the search
 * must surface as a finding about the budget rather than as a silent palette
 * hole. Folding it into REFUSED would do exactly that folding.
 *
 * ⚠⚠ **THE WALL-CLOCK BUDGET IS MEASURED AFTER THE FACT, NOT ENFORCED
 * DURING.** `solveSegment` is synchronous and owns its own loop; nothing
 * outside it can interrupt a search mid-flight without an engine edit, and
 * this arc's target is zero engine edits. So a runaway solve still costs its
 * full wall clock before the verdict is known — the budget bounds what the
 * loop ACCEPTS, not what it SPENDS. Named here because a reader who assumed
 * otherwise would size the budget as a timeout and get a generator that runs
 * for hours. (Residue for a later slice: an in-search bound needs a hook in
 * `solverBot`, which is a byte-inert engine edit somebody must argue for.)
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
 * ⛔ Only `SolverRefusal` and `BotDriverV2Error` become verdicts. A
 * `LevelWorldError` (a record the engine will not build), a `SolverBotError`
 * (this file calling the solver wrongly), a `TypeError` — those are defects
 * in the GENERATOR, and a loop that quietly reverted them would hide its own
 * bugs behind "that candidate didn't work out" (traps 171/173: a conservative
 * ingredient manufactures problems and hides bound defects). They propagate.
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`).
 */

import { levelSourceFromAtlas } from './atlasSource.js';
import { BotDriverV2Error } from './botDriverV2.js';
import { DEFAULT_MAX_TICKS_PER_TARGET } from './botDriverV1.js';
import { SolverRefusal } from './solverBot.js';
import { atlasOf } from './procgenLevel.js';
import { solveForPage } from './watchSolve.js';

export class ProcgenOracleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenOracleError';
    }
}

const fail = (message) => { throw new ProcgenOracleError(message); };

/** The three classes, and there are exactly three (⚖ kickoff §3.1). */
export const VERDICT = Object.freeze({
    SOLVED: 'SOLVED',
    REFUSED: 'REFUSED',
    BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
});

/**
 * THE NAMED BUDGET VALUES, and where each number comes from.
 *
 * ⚠ `wallClockMs: 5000` — a CHOSEN ceiling, not a measured limit, and the
 * measurement it is chosen against is slice 1's own: an empty bordered 10x10
 * room with one goal pickup solves in **47-139 ms** (six pickup classes, this
 * machine, node 18). Five seconds is ~40x the empty-room cost, which leaves
 * room for a room full of hazards to be EXPENSIVE without letting one be
 * unbounded. ⚖ Kickoff §6: tuning this is a finding, not a gate.
 *
 * ⚠ `maxTicksPerTarget: 400` — `botDriverV1.DEFAULT_MAX_TICKS_PER_TARGET`,
 * imported rather than typed, and equal to the engine default ON PURPOSE:
 * slice 1 must change no solver behaviour, so the number the loop names is
 * the number the solver was already using. The knob exists so a later slice
 * can lower it deliberately, with a measurement.
 *
 * ⛔ THERE IS NO EXPANSION BUDGET HERE. `planDash`'s 40,000-expansion cap is
 * internal to `solverBot` and takes no argument; naming a number this file
 * cannot pass would be a bound nobody enforces (trap: a comment naming an arm
 * nobody built). The wall clock is the only bound this side owns.
 */
export const DEFAULT_BUDGET = Object.freeze({
    wallClockMs: 5000,
    maxTicksPerTarget: DEFAULT_MAX_TICKS_PER_TARGET,
});

/** A budget, checked and completed from the defaults. */
export function assertBudget(budget = DEFAULT_BUDGET) {
    const b = { ...DEFAULT_BUDGET, ...(budget ?? {}) };
    if (!Number.isFinite(b.wallClockMs) || b.wallClockMs <= 0) {
        fail(`procgenOracle: budget.wallClockMs must be a positive number of `
            + `milliseconds, got ${JSON.stringify(b.wallClockMs)}.`);
    }
    if (!Number.isInteger(b.maxTicksPerTarget) || b.maxTicksPerTarget <= 0) {
        fail(`procgenOracle: budget.maxTicksPerTarget must be a positive integer of `
            + `ticks, got ${JSON.stringify(b.maxTicksPerTarget)}.`);
    }
    return Object.freeze(b);
}

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
 * @param {object} o
 * @param {{level:number,x:number,y:number}} o.boot   `procgenLevel.bootAtTile`
 * @param {object} [o.items]   seam item flags, e.g. `{hasSword: true}`
 * @param {string[]} [o.pins]
 */
export function bootStaging({ boot, items = null, pins = ['dead_frames'] }) {
    if (!boot || !Number.isInteger(boot.level)
        || !Number.isFinite(boot.x) || !Number.isFinite(boot.y)) {
        fail(`procgenOracle: bootStaging needs boot {level, x, y} — `
            + `got ${JSON.stringify(boot)}. \`procgenLevel.bootAtTile\` builds one.`);
    }
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
        seam: items ? { items: { ...items } } : null,
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
 * @returns {object} `{verdict, ms, budget, …evidence}`
 */
export function solve(levelRecord, staging, goals, budget = DEFAULT_BUDGET, {
    now = () => Date.now(),
    name = `procgen-l${levelRecord?.level}`,
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
        });
    } catch (e) {
        if (!(e instanceof SolverRefusal) && !(e instanceof BotDriverV2Error)) throw e;
        thrown = e;
    }
    const ms = now() - t0;

    if (thrown) {
        const budgetKind = namesTickBudget(thrown.message, b.maxTicksPerTarget)
            ? 'per-target-ticks'
            : (ms > b.wallClockMs ? 'wall-clock' : null);
        if (budgetKind) {
            return {
                ...base,
                verdict: VERDICT.BUDGET_EXHAUSTED,
                ms,
                budgetKind,
                // ⛔ VERBATIM. The refusal's own text is the evidence channel.
                reasonText: thrown.message,
                errorName: thrown.name,
                classifiedBy: budgetKind === 'per-target-ticks'
                    ? `the refusal names the ${b.maxTicksPerTarget}-tick per-target budget `
                      + 'this call passed in'
                    : `the solve threw after ${ms} ms, over the ${b.wallClockMs} ms `
                      + 'wall-clock budget',
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
            classifiedBy: 'the solver refused within budget',
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
    if (ms > b.wallClockMs) {
        return {
            ...base,
            verdict: VERDICT.BUDGET_EXHAUSTED,
            ms,
            budgetKind: 'wall-clock',
            classifiedBy: `the solve SUCCEEDED in ${ms} ms, over the ${b.wallClockMs} ms `
                + 'wall-clock budget — the level is solvable and too expensive, which is '
                + 'a fact about the budget as much as about the level',
            ticks: result.out.perTick.length,
            certification: cert,
        };
    }
    return {
        ...base,
        verdict: VERDICT.SOLVED,
        ms,
        classifiedBy: 'the solver reached every goal within budget',
        ticks: result.out.perTick.length,
        certification: cert,
        tape: result.tape,
        trace: result.out.trace,
        records: result.out.records,
        dangerQueries: result.out.dangerQueries,
        replans: result.out.replans,
        waypointsPlanned: result.out.waypointsPlanned,
        despawns: result.despawns,
    };
}
