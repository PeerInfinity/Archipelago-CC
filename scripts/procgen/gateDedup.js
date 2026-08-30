/**
 * gateDedup — **WHEN A CATALOGUE'S `cli` FIELD IS A GATE THE BATTERY ALREADY
 * RUNS** (SEEDLING BOT R9, slice SG1; ⚖ ruling 71 (a)).
 *
 * ⛔⛔ WHY IT IS A MODULE AND NOT SIX LINES IN THE GATE. The gate that uses it
 * — `check-procgen-demos.mjs` — TAKES THE BOX AT IMPORT TIME, so a unit test
 * cannot import it to ask what its licence rule answers; a rule only a
 * 300-second browser run can interrogate is a rule nobody tests the edges of.
 * Splitting the decision out is the same move `boxLock.js`, `argvHelp.js` and
 * `dashMode.js` already made in this directory: the DECISION is pure and
 * importable, the box and the browser stay in the gate.
 *
 * ── THE RULE, IN ONE SENTENCE ─────────────────────────────────────────
 *
 * A command is a SIBLING-GATE command when it is ONE `node
 * scripts/procgen/<file>` invocation, `<file>` is a member of `gates.mjs`'s
 * roster, and every remaining token is a `--host=` — and it is `null`
 * otherwise, which is what makes the rule FAIL CLOSED.
 *
 * ⛔ FAIL-CLOSED IS THE LOAD-BEARING HALF. Roster membership is the LICENCE to
 * skip, because roster membership is precisely the evidence that something
 * ELSE will drive that file in this run. A target that is not in the roster
 * still runs: a gate deleted from the roster tomorrow must not silently lose
 * its only driver, and a command that mixes a roster gate with anything else
 * is not fully paid for by the battery.
 *
 * ⛔⛔ AND THE ARGV IS PART OF THE LICENCE (⚖ 71 (a), the orchestrator's
 * tightening, 2026-08-30). Roster membership says the battery runs that FILE;
 * it does not say the battery runs it asking THIS question. A catalogue row
 * that invoked a roster gate with `--doors=`, `--only=` or a mutant flag would
 * be a different measured question wearing the same file name, and target
 * membership alone would over-license it. So any argv beyond `--host=` makes
 * the row unlicensed and it RUNS. ⛓ Today all three licensed rows are bare, so
 * this changes no number — it is the direction the rule fails in that matters.
 *
 * ⛓ WHY `--host=` IS THE ONE EXCEPTION AND NOT A LOOPHOLE: it is the flag
 * `argvFor` itself puts on a `local` arm, so a command carrying one is asking
 * the battery's own question. ⛔ It is not an equality test — the battery may
 * run the `--host=` arm where the catalogue spells the gate bare (its
 * own-server face). What the dedup preserves is that the battery runs that
 * GATE; where an own-server face is load-bearing the roster declares it as an
 * ARM (`check-seedling-editor-generate.mjs` has one, `-sequence` does not), so
 * the roster's arm coverage IS the standard being preserved.
 */

/**
 * ⛓⛓ A `scripts/procgen/*.mjs` A COMMAND ACTUALLY INVOKES — the same law
 * `gateRoster.js`'s `SIBLING_RE` states about its own population: **the
 * detector is the reference, not the mention.** A `cli` field is a command
 * line, so the spelling that RUNS something is the repo-relative path; the
 * leading boundary keeps a longer path that merely ENDS in one from matching.
 *
 * ⛔ AND THE TRAILING GUARD IS A LOOKAHEAD, NOT `\b` — MEASURED. `\b` matched
 * `scripts/procgen/check-a.mjs.bak` and handed back `check-a.mjs`, because the
 * `.` that continues the name is itself a word boundary. A backup, a `.orig`
 * from a merge or a `.mjs.disabled` mutant would each have been read as an
 * invocation of the gate they are NOT.
 */
import { SCRIPT_DIR } from './gateRoster.js';

export const CLI_TARGET_RE =
    /(?:^|[\s'"`(=])scripts\/procgen\/([a-z][a-zA-Z0-9-]*\.mjs)(?![.\w-])/g;

/** Every `scripts/procgen/*.mjs` a command line invokes, de-duplicated, in
 *  first-appearance order. `[]` when it invokes none. */
export function cliTargetsIn(command) {
    return [...new Set([...String(command).matchAll(CLI_TARGET_RE)].map((m) => m[1]))];
}

/** ⛓ The one flag a licensed command may carry — see the docblock. */
const LICENSED_FLAG = '--host=';

/**
 * The sibling gate a command drives, by file name — or `null` when the command
 * is anything else at all, which is every failure direction there is.
 *
 * @param {string} command   the catalogue's `cli.command`, verbatim
 * @param {Set<string>} roster  `gates.mjs`'s roster, by FILE name
 */
export function siblingGatesIn(command, roster) {
    const targets = cliTargetsIn(command);
    /** ⛔ Two targets is a pipeline or a `&&` chain: the battery pays for at
     *  most one half of it, so the row runs. */
    if (targets.length !== 1) return null;
    const [file] = targets;
    if (!roster.has(file)) return null;
    /**
     * ⛔ AND THE COMMAND MUST BE THAT INVOCATION AND NOTHING MORE. Splitting on
     * whitespace is deliberately crude and that is safe in this direction: a
     * pipe, a redirect, a `&&`, a `| head -3` or a quoted parameter all leave a
     * token that is not `--host=`, so anything the shape does not recognise
     * falls out of the licence and RUNS.
     */
    const tokens = command.trim().split(/\s+/);
    if (tokens[0] !== 'node' || tokens[1] !== `${SCRIPT_DIR}/${file}`) return null;
    if (!tokens.slice(2).every((t) => t.startsWith(LICENSED_FLAG))) return null;
    return file;
}
