/**
 * procgen/walkReport — **WHAT A PRODUCER'S OWN `--check` MEASURED ABOUT ITS
 * OWN WALKS, MACHINE-READABLE.**
 *
 * R9 slice 12c′, ⚖ ruling 43 (user, 2026-08-23: *"I want the pipeline to be
 * able to handle changes to existing tapes, not just adding new tapes"*).
 *
 * ── ⛔⛔ WHY A BYTE VERDICT IS NOT A WALK VERDICT ──────────────────────
 *
 * `rerecord-seedling-campaign.mjs` S0 has to answer one question before it is
 * allowed to write anything: **which committed walks does today's solver
 * re-solve differently?** A producer's `--check` already re-solves every
 * segment it owns from that segment's own committed boot and compares the
 * whole tape text — so the measurement exists and ⚖ ruling 17 says to read it
 * out of the producer rather than re-implement it.
 *
 * ⛔ BUT ITS VERDICT IS A **BYTE** VERDICT, AND A BYTE VERDICT CONFLATES TWO
 * THINGS THE LICENCE MUST TELL APART. ⚖ Ruling 39's `why` sweep edits a
 * segment's declaration sentence, which the producer writes into the tape's
 * `description` — so the tape's bytes move and **not one input key changes**.
 * A mode that read "the bytes moved" as "the walk moved" would demand the
 * user's walk licence for a prose edit, and — worse — would report a real
 * walk move and a prose edit with the same word.
 *
 * ⇒ the verdict here is read off the FIELDS, and `inputs` is the one that
 * decides. **The five verdicts are the subjects' own** (trap 578: a verdict
 * reader's vocabulary must be read out of what it is reading):
 *
 * | verdict | what it means |
 * |---|---|
 * | `absent` | there is no committed tape — a GROWTH is in flight |
 * | `none` | the derived text and the committed text are byte-identical |
 * | **`walk-moves`** | `inputs` differ — **the only verdict a licence covers** |
 * | `description` | ONLY `description` differs (⚖ ruling 39's sweep) |
 * | `other` | something else moved — named field by field, never absorbed |
 *
 * ⛔⛔ **`inputs` WINS EVERY TIE.** A tape whose inputs AND description both
 * moved is `walk-moves`, never `description`: the licence question outranks
 * the prose question, and a precedence that went the other way would let a
 * walk move ride into the tree under a prose edit's name. A row asserts it.
 *
 * ── HOW A PRODUCER OPTS IN, AND WHY OPTING IN IS THE DERIVATION ───────
 *
 * A producer participates by ACCEPTING `--walk-report=<path>`; S0 derives the
 * participating set by scanning each candidate producer's own source for that
 * flag — the same law ⚖ ruling 38(6) gave `gates.sh` ("roster and flags
 * derived from the gates' own argv parsing"). ⛔ The flag is OFF by default
 * and writes nothing when absent, so every producer's `--check` STDOUT — and
 * therefore its standing `--check` md5 — is byte-identical with this module in
 * the tree.
 *
 * ⛔ **AND THE REPORT NAMES THE SEGMENTS THE PRODUCER ACTUALLY EMITTED**,
 * which is what makes ownership a MEASUREMENT rather than a guess. Deriving
 * ownership from a tape's `description` looked like a derivation and is not
 * one: `r7-ends-meet-1`'s description names no producer at all, yet
 * `plan-seedling-r7-ends-meet.mjs:274` emits it (trap 576 — ask what the
 * derivation is a derivation OF). A description says what a tape SAYS ABOUT
 * ITSELF; this says who WROTE it.
 *
 * ⚠ **THE COMMITTED SIDE IS READ AT `note` TIME, NOT AT WRITE TIME.** In
 * `--check` the producer never writes, so either would do; without `--check`
 * the producer overwrites the tape, and a report that read the committed file
 * at exit would compare the new bytes against themselves and call every walk
 * `none`. Reading at `note` — before `emit`'s own `writeFileSync` — makes the
 * report correct in BOTH modes.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

export class WalkReportError extends Error {
    constructor(message) { super(message); this.name = 'WalkReportError'; }
}
const fail = (m) => { throw new WalkReportError(m); };

/** The flag a producer accepts, and the literal S0's participation scan hunts. */
export const WALK_REPORT_FLAG = '--walk-report';

/** The verdicts, in the order they are decided. `inputs` wins every tie. */
export const WALK_VERDICTS = Object.freeze(
    ['absent', 'none', 'walk-moves', 'description', 'other']);

/**
 * The path a FOUND flag token names, `null` when nothing was found.
 *
 * ⛔ A BARE `--walk-report` IS A REFUSAL, not a default path: a report written
 * somewhere the caller did not name is a file nobody reads, and S0 passes an
 * explicit path every time.
 *
 * ⛓ IT TAKES THE TOKEN RATHER THAN THE ARGV so the producers can do the
 * FINDING in their own text — the instruments index publishes the flags an
 * instrument reads out of `argv` by scanning that instrument's own source, and
 * a flag parsed one module away is one its table would omit.
 */
export function walkReportPath(token) {
    if (token === undefined || token === null) return null;
    const value = token === WALK_REPORT_FLAG ? '' : token.slice(WALK_REPORT_FLAG.length + 1);
    if (value === '') {
        fail(`${WALK_REPORT_FLAG} needs a path — \`${WALK_REPORT_FLAG}=<file>\`. A report `
            + 'written to a path nobody named is a file nobody reads.');
    }
    return value;
}

/** The same answer from a whole argv — the convenience form. */
export function walkReportTarget(argv = process.argv) {
    return walkReportPath(argv.find((a) => a === WALK_REPORT_FLAG
        || a.startsWith(`${WALK_REPORT_FLAG}=`)));
}

/**
 * ⛓⛓ **THE VERDICT, FIELD BY FIELD.** Both arguments are the WHOLE tape text
 * — the producer's own derived bytes and the committed file's — because that
 * is what a producer already has at `emit` and a re-parse of either side would
 * be a second reading of the same thing.
 *
 * @param {?string} derivedText  what the producer derives today
 * @param {?string} committedText  the committed tape, or `null` if absent
 * @returns {{verdict: string, moved: string[], inputsIdentical: boolean,
 *   solvedTicks: ?number, committedTicks: ?number}}
 */
export function verdictFor(derivedText, committedText) {
    if (typeof derivedText !== 'string') {
        fail('verdictFor: the derived side must be the tape TEXT the producer emits');
    }
    const derived = JSON.parse(derivedText);
    const solvedTicks = derived.tick_count ?? null;
    if (committedText === null || committedText === undefined) {
        return {
            verdict: 'absent',
            moved: [],
            inputsIdentical: false,
            solvedTicks,
            committedTicks: null,
        };
    }
    const committed = JSON.parse(committedText);
    const committedTicks = committed.tick_count ?? null;
    const inputsIdentical = JSON.stringify(derived.inputs ?? null)
        === JSON.stringify(committed.inputs ?? null);
    if (derivedText === committedText) {
        return { verdict: 'none', moved: [], inputsIdentical, solvedTicks, committedTicks };
    }
    const keys = [...new Set([...Object.keys(derived), ...Object.keys(committed)])].sort();
    const moved = keys.filter((k) => JSON.stringify(derived[k]) !== JSON.stringify(committed[k]));
    /**
     * ⛔ `inputs` FIRST, ALWAYS. A tape whose inputs AND description both moved
     * is a WALK MOVE that happens to carry new prose, and the licence question
     * is the one that has to be answered.
     */
    if (!inputsIdentical) {
        return { verdict: 'walk-moves', moved, inputsIdentical, solvedTicks, committedTicks };
    }
    if (moved.length === 1 && moved[0] === 'description') {
        return { verdict: 'description', moved, inputsIdentical, solvedTicks, committedTicks };
    }
    return { verdict: 'other', moved, inputsIdentical, solvedTicks, committedTicks };
}

/**
 * ONE producer's report. Constructed once at the top of a producer; `note` is
 * called from inside its own `emit`, which is the single place a tape's
 * derived text and its path meet.
 *
 * @param {object} opts
 * @param {string} opts.producer  the producer's own file name, for the report
 * @param {string} opts.tapesDir  the fixtures tape directory — a path outside
 *   it (a TRACE sidecar) is not a tape and is ignored rather than refused.
 * @param {?string} [opts.arg] the flag TOKEN the producer found in its own
 *   text (see `walkReportPath`); `undefined` falls back to scanning `argv`.
 * @param {string[]} [opts.argv]
 * @param {boolean} [opts.onExit] register the write on `process.exit`
 */
export function createWalkReport({
    producer, tapesDir, arg, argv = process.argv, onExit = true,
} = {}) {
    if (!producer) fail('createWalkReport: `producer` is required — the report names its author');
    if (!tapesDir) fail('createWalkReport: `tapesDir` is required');
    const target = arg === undefined ? walkReportTarget(argv) : walkReportPath(arg);
    const dir = resolve(tapesDir);
    const segments = [];
    const seen = new Set();

    const write = () => {
        if (!target) return null;
        const body = {
            producer,
            argv: argv.slice(2).join(' '),
            segments: segments.slice(),
        };
        writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`);
        return body;
    };

    if (target && onExit) process.on('exit', () => { write(); });

    return {
        /** ⛓ Whether the producer was ASKED for a report — nothing else changes. */
        get enabled() { return target !== null; },
        get target() { return target; },
        get segments() { return segments.map((s) => ({ ...s })); },
        /**
         * One emitted artifact. A path outside `tapesDir` is a trace sidecar
         * and is skipped; a tape emitted twice by one producer is a refusal,
         * because the report is what S0's "exactly one owner" calibration
         * rests on.
         */
        note(path, derivedText) {
            if (!target) return;
            if (resolve(dirname(path)) !== dir) return;
            const segment = basename(path).replace(/\.json$/, '');
            if (seen.has(segment)) {
                fail(`walkReport: ${producer} emitted ${segment} twice — a report is what `
                    + 'S0\'s "exactly one owner per segment" calibration rests on, so a '
                    + 'double emission is a defect rather than a second row');
            }
            seen.add(segment);
            const committedText = existsSync(path) ? readFileSync(path, 'utf8') : null;
            segments.push({ segment, ...verdictFor(derivedText, committedText) });
        },
        write,
    };
}
