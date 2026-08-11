/**
 * seedlingDemo/twoPassSolve — THE TWO-PASS AUTHORING LOOP. R8 slice 4,
 * kickoff `NewDocs/plans/seedling-bot-r8-opus-kickoff.md` §12.10.3 (the
 * machinery slice 3b named and refused to half-build) and §12.10.2 (the same
 * shape one oracle over).
 *
 * ── THE CIRCLE, AND WHY IT IS A CIRCLE ────────────────────────────────
 *
 * `createLevelRun` takes `persistence` **AT CONSTRUCTION**. A segment whose
 * goal sits behind a gate the run's OWN WALK opens therefore needs, as an
 * INPUT, a tick that only a solve can produce. Two rooms on the act2 battery
 * are exactly this:
 *
 *   L5  `lock@48,112` is `tset == -1`; three arrow kills take
 *       `Game.totalEnemies()` to zero, `checkEnemies()` arms the lock, and
 *       101 alpha steps later `turnOff()` writes `{5,0}`. The model COMPUTES
 *       the removal (`chaserKillLockOpens`) and `activators.opensOnTick`
 *       computes the fade — but it deliberately does not WRITE the flag
 *       (§11.5: one writer per persistence slot).
 *   L8  two `SandTrap` bodies die to `arrowtrap@96,16`'s column. §11.4
 *       REFUSES to compute that death at all, so the model may not invent the
 *       tick — the GAME's own `persistence_cleared` is the only oracle.
 *
 * ── THE LOOP ──────────────────────────────────────────────────────────
 *
 *   1. SOLVE with the consequence undeclared (or declared PENDING, below).
 *      The solver runs the whole mechanism — arms the ceiling, baits, waits
 *      out the responder's fade — and then raises a `PendingDeclaration`
 *      carrying the ticks it spent and WHICH oracle may answer.
 *   2. READ the tick: `source: 'model'` takes the run's own ledger plus the
 *      responder's arithmetic, already computed on the refusal;
 *      `source: 'game'` hands pass 1's PREFIX to the injected `gameTick`
 *      oracle, which truncates it against the running game.
 *   3. DECLARE it as a v9 `at` row — the channel the format has carried
 *      since R7 slice 6d. ⛔ NO NEW TAPE FIELD; this module is
 *      planner/harness-side and `GAME_VISIBLE_DROPS` gains nothing.
 *   4. RE-SOLVE against the declared boot, and assert the declaration was
 *      HONEST: the two walks must press identical keys on every tick below
 *      the declared one (`assertTwoPassPrefixAgrees`), because a clear at `T`
 *      cannot reach the world before `T`.
 *
 * ── ⛔ WHY THE SENTINEL EXISTS, AND WHY IT NEVER REACHES A TAPE ────────
 *
 * `assertChaserRemovalIsDeclared` throws BY NAME when a removal opens a lock
 * the tape declares no clear for (§11.5) — which is the state pass 1 is in ON
 * PURPOSE. So a discovered kill-lock is re-declared with
 * `solverBot.PENDING_AT`, which says *"this clear exists and its tick is what
 * I am about to measure"*. It is unreachable by construction, so
 * `applyTimedClears` never fires it, and `assertNoPendingRows` refuses to let
 * one out into an emitted tape.
 *
 * ── ⚠ "TWO-PASS" IS THE MINIMUM, NOT THE COUNT ────────────────────────
 *
 * The loop is a FIXPOINT with a named bound: each pass discharges at most one
 * declaration, and a room with two gates needs one pass per gate plus the
 * verifying one. L5 measured THREE (discover the lock, measure its tick,
 * verify) and L8 measured FOUR (two sandtraps). Recorded rather than smoothed
 * over: `passes` is returned and the caller states it.
 */

import { PENDING_AT, PendingDeclaration, solveSegment } from './solverBot.js';
import { assertTwoPassPrefixAgrees } from './r8Acceptance.js';

export class TwoPassError extends Error {
    constructor(message) { super(message); this.name = 'TwoPassError'; }
}

const fail = (m) => { throw new TwoPassError(m); };

/**
 * ⛔ THE BOUND ON PASSES, and it is named rather than generous. Every pass
 * but the last must DISCHARGE a declaration — that is what a pass is for — so
 * a loop that has taken six is not converging, it is oscillating. Five is one
 * more than the most any room on this arc needs (L8's four).
 */
export const MAX_PASSES = 5;

/** A persistence row's identity — one clear per (level, tag), always. */
const rowKey = (r) => `${r.level},${r.tag}`;

/**
 * ⛔ NO EMITTED TAPE MAY CARRY THE SENTINEL. The pending `at` is a harness
 * fiction with a precise meaning ("not measured yet"), and a tape carrying it
 * would be a declaration that reads as a measurement. Asserted at the exit,
 * not trusted to the caller.
 */
export function assertNoPendingRows(persistence, what = 'the emitted tape') {
    const pending = (persistence ?? []).filter((r) => r.at === PENDING_AT);
    if (pending.length > 0) {
        fail(`${what}: ${pending.length} persistence row(s) still carry the PENDING `
            + `sentinel [${pending.map(rowKey).join(', ')}]. That value means "this clear `
            + 'exists and its tick has not been measured yet" — a tape carrying it would '
            + 'be a declaration wearing a measurement\'s clothes.');
    }
    return persistence;
}

/**
 * ⛓ Fold a measured declaration into the row set, replacing a pending row of
 * the same identity rather than adding beside it — two rows for one flag
 * would make `applyTimedClears` fire the earlier one and leave the later one
 * silently unused.
 */
function declare(rows, row) {
    const key = rowKey(row);
    const out = rows.filter((r) => rowKey(r) !== key);
    out.push(row);
    return out.sort((a, b) => a.level - b.level || a.tag - b.tag);
}

/**
 * THE LOOP.
 *
 * @param {object}   o
 * @param {Function} o.makeRun    `(persistence) => run` — a FRESH run each
 *   pass, built exactly the way the replay builds it (trap 158: the world the
 *   solver senses and the world the replay runs must be one world).
 * @param {Array}    o.goals      the ordered goal list
 * @param {string}   o.name       the tape name
 * @param {object}   o.boot       `{level, x, y}`
 * @param {Array}    [o.persistence] the tape's own declared clears, verbatim
 * @param {Function} [o.gameTick] `async ({perTick, pending, persistence}) =>
 *   {at, evidence}` — the GAME oracle for a declaration the model refuses to
 *   compute. Injected rather than imported: this module must be testable
 *   offline, and the `--win` truncation harness lives in a script.
 * @param {Function} [o.log]
 * @returns {Promise<{out, persistence, passes, declarations, prefixChecks}>}
 */
export async function twoPassSolve({
    makeRun, goals, name, boot, persistence = [], gameTick = null, log = () => {},
}) {
    if (typeof makeRun !== 'function') {
        fail('twoPassSolve needs `makeRun(persistence)` — a FRESH run per pass. Re-using '
            + 'one run would replay a walk against a world the previous pass already '
            + 'edited, and `createLevelRun` takes its clears at construction, which is '
            + 'the whole reason this loop exists.');
    }
    let rows = [...persistence];
    const passes = [];
    const declarations = [];
    const prefixChecks = [];
    /**
     * ⛓⛓⛓ THE MEASURING PASS, HELD FOR THE ONE AFTER IT. A declaration read
     * off pass N is only a measurement OF pass N+1 if the two walks agree
     * below it — the clear cannot reach the world before its own tick — so
     * the keys are carried forward and compared the moment the next pass
     * produces any, whether it SOLVES or raises the next declaration.
     */
    let measured = null;
    /** Which (level, tag) has already been measured — the convergence guard. */
    const raisedTwice = new Map();
    const checkPrefix = (perTick, how) => {
        if (!measured) return;
        const got = assertTwoPassPrefixAgrees(
            measured.perTick, perTick, measured.at,
            `${name}: the two-pass loop around {${measured.level},${measured.tag}}`,
        );
        prefixChecks.push({ ...got, declaredAt: measured.at, level: measured.level,
            tag: measured.tag, source: measured.source, verifiedBy: how });
        log(`  prefix agrees for the first ${got.comparedTicks} tick(s) below the `
            + `declared ${measured.at} — {${measured.level},${measured.tag}}`);
    };
    for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
        let out = null;
        let raised = null;
        try {
            out = solveSegment({ run: makeRun(rows), goals, name, boot });
        } catch (e) {
            /**
             * ⛓⛓⛓ THE DISCOVERY ARM. `levelRun` throws BY NAME when a chaser
             * removal opens a kill-lock nothing declares (§11.5) — the state
             * pass 1 is in on purpose — and the throw carries the lock's own
             * identity so the loop can re-declare it PENDING and run again
             * rather than parse a message. ⛔ A structured error is what makes
             * "discover what I owe by running" a mechanism instead of a
             * string match (trap 143's shape, avoided).
             */
            if (e.undeclaredKillLock) {
                const d = e.undeclaredKillLock;
                for (const tag of d.flags) {
                    rows = declare(rows, {
                        level: d.level,
                        tag,
                        at: PENDING_AT,
                        note: `PENDING — discovered at tick ${d.t} (${d.id}, ${d.cause}); `
                            + 'the tick is what the next pass measures',
                    });
                }
                passes.push({ pass, kind: 'discover', level: d.level, flags: [...d.flags] });
                log(`  pass ${pass}: DISCOVERED kill-lock clear(s) `
                    + `[${d.flags.map((t) => `{${d.level},${t}}`).join(', ')}] at tick ${d.t}`);
                continue;
            }
            if (!(e instanceof PendingDeclaration)) throw e;
            raised = e;
        }
        if (out) {
            checkPrefix(out.perTick, 'the solving pass');
            passes.push({ pass, kind: 'solve', ticks: out.perTick.length });
            log(`  pass ${pass}: SOLVED in ${out.perTick.length} ticks`);
            return {
                out,
                persistence: assertNoPendingRows(rows, `${name}'s emitted tape`),
                passes,
                declarations,
                prefixChecks,
            };
        }
        checkPrefix(raised.perTick, `pass ${pass}'s own refusal`);
        const pending = raised.pending;
        if (!pending) {
            fail(`${name}: pass ${pass} raised a PendingDeclaration with no \`pending\` `
                + `block, so nothing says what to measure — ${raised.message}`);
        }
        if (pending.tag === null || pending.tag === undefined) {
            fail(`${name}: pass ${pass} raised a pending declaration for level `
                + `${pending.level} with NO persistence tag. A clear with no tag is not a `
                + `clear — the body/lock was ${pending.body ?? pending.lock ?? '?'}, whose `
                + 'own `.oel` tag is what a v9 row is keyed on.');
        }
        let at;
        let evidence;
        if (pending.source === 'model') {
            at = pending.at;
            evidence = pending.why;
            log(`  pass ${pass}: MODEL-sourced {${pending.level},${pending.tag}} at ${at} `
                + `— ${evidence}`);
        } else if (pending.source === 'game') {
            if (typeof gameTick !== 'function') {
                fail(`${name}: pass ${pass} needs a GAME-sourced tick for `
                    + `{${pending.level},${pending.tag}} (${pending.why}) and no \`gameTick\` `
                    + 'oracle was supplied. ⛔ The model may NOT substitute here: §11.4 '
                    + 'refuses to compute this death precisely so that ONE writer owns the '
                    + 'slot, and a model that guessed would be the second writer.');
            }
            const answer = await gameTick({
                perTick: raised.perTick, pending, persistence: rows, boot, name,
            });
            if (!answer || !Number.isInteger(answer.at)) {
                fail(`${name}: the game oracle returned ${JSON.stringify(answer)} for `
                    + `{${pending.level},${pending.tag}} — it must return {at, evidence} `
                    + 'with an integer tick read off the game\'s own `persistence_cleared`.');
            }
            at = answer.at;
            evidence = answer.evidence ?? 'the game\'s own persistence_cleared';
            log(`  pass ${pass}: GAME-sourced {${pending.level},${pending.tag}} at ${at} `
                + `— ${evidence}`);
        } else {
            fail(`${name}: pending declaration for {${pending.level},${pending.tag}} names `
                + `source ${JSON.stringify(pending.source)}; the two allowed oracles are `
                + '`model` (the run computes the consequence) and `game` (§11.4 refuses to, '
                + 'so only the running game may answer).');
        }
        /**
         * ⛔ A TICK MEASURED PAST THE END OF THE WALK THAT MEASURED IT IS NOT
         * A MEASUREMENT — and it is also what would make the prefix check
         * vacuous on the next pass, so it is refused here rather than there.
         */
        if (at > raised.perTick.length) {
            fail(`${name}: the declared tick ${at} for {${pending.level},${pending.tag}} is `
                + `BEYOND the ${raised.perTick.length} tick(s) the measuring pass spent.`);
        }
        rows = declare(rows, {
            level: pending.level,
            tag: pending.tag,
            at,
            note: `${pending.source}-sourced by twoPassSolve: ${evidence}`,
        });
        declarations.push({ level: pending.level, tag: pending.tag, at,
            source: pending.source, evidence, pass });
        passes.push({ pass, kind: 'measure', level: pending.level, tag: pending.tag,
            source: pending.source, at, ticks: raised.perTick.length });
        /**
         * ⛔⛔ A DECLARATION THAT CHANGES NOTHING IS NOT A PASS — it is the
         * loop spinning, and it must say so at the SECOND occurrence rather
         * than at the bound. Re-raising the same `(level, tag)` means the
         * measured tick did not unblock the walk that measured it: the tick
         * is wrong, or the gate was never what was in the way.
         */
        const key = rowKey(pending);
        if (raisedTwice.has(key)) {
            fail(`${name}: {${key}} was raised as a pending declaration TWICE — the first `
                + `measurement (${raisedTwice.get(key)}) was declared and the very next pass `
                + `raised it again at ${at}. A declaration that does not unblock the walk `
                + 'that measured it is not a measurement: either the tick is wrong, or the '
                + 'gate was never what was in the way.');
        }
        raisedTwice.set(key, at);
        measured = { at, perTick: raised.perTick, level: pending.level,
            tag: pending.tag, source: pending.source };
    }
    return fail(`${name}: the two-pass loop ran its bound of ${MAX_PASSES} passes without `
        + `converging. Passes so far: ${JSON.stringify(passes)}. Every pass but the last `
        + 'must DISCHARGE a declaration; a loop that keeps raising new ones is not '
        + 'converging.');
}

