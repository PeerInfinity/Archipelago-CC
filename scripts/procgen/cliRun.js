/**
 * cliRun — the exit codes and the `--json-status` summary the six headless
 * pipeline drivers share (§5au item 3; ⚖ the user, 2026-10-18: five codes, a
 * status FILE, human lines on stderr).
 *
 * Usage (from a driver):
 *   import { runCli, UsageError, readInputJson } from './cliRun.js';
 *   runCli('sphere-step', import.meta.url, async (status) => { ... });
 *
 * Exit codes:
 *   0  ok
 *   1  usage     bad / unknown flag or value, missing or unknown subcommand, a
 *                step without -i — refused before any work runs
 *   2  oracle    the world was built and its outputs written, but the sphere
 *                oracle disagrees with the plan (was 1 before this module)
 *   3  input     an input file (-i, --source, --params, --atlas, …) is missing,
 *                is not JSON, or is an envelope of another kind / version
 *   4  internal  anything else thrown while the pipeline ran
 * A crash while a hoisted import is still loading exits 1: Node owns that exit
 * and a static import cannot be caught.
 *
 * `--json-status PATH` writes one JSON object (STATUS_VERSION) when the run
 * ends — on failure too, once the flag itself was read. `-` means stdout, and
 * is refused as usage when `-o -` already owns stdout.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXIT = Object.freeze({ ok: 0, usage: 1, oracle_mismatch: 2, input: 3, internal: 4 });
export const STATUS_VERSION = 1;

/** Bad argv: exit 1. */
export class UsageError extends Error {
    constructor(message) { super(message); this.name = 'UsageError'; }
}

/** A rejected input file: exit 3. */
export class InputError extends Error {
    constructor(message) { super(message); this.name = 'InputError'; }
}

/** Run `fn` (an argv parser); anything it throws is a usage error. */
export function parseOrUsage(fn) {
    try { return fn(); } catch (e) {
        throw e instanceof UsageError ? e : new UsageError(e.message);
    }
}

/** Read + parse a JSON input file, as an InputError naming `what` when it can't. */
export function readInputJson(path, what = 'input') {
    let text;
    try { text = readFileSync(resolve(path), 'utf8'); } catch (e) {
        throw new InputError(`${what} ${path}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`);
    }
    try { return JSON.parse(text); } catch (e) {
        throw new InputError(`${what} ${path}: not JSON (${e.message})`);
    }
}

/** The outcome a thrown error maps to. */
export function outcomeOf(err) {
    if (err instanceof UsageError) return 'usage';
    // ⛓ the envelope stamp's refusal (steppedPipeline.js EnvelopeStampError).
    if (err instanceof InputError || err?.code === 'ENVELOPE_STAMP') return 'input';
    return 'internal';
}

/** The value after `--json-status`, read off the raw argv so a parse failure still reports. */
function statusTarget(argv) {
    const i = argv.indexOf('--json-status');
    return i >= 0 ? (argv[i + 1] ?? null) : null;
}

function outIsStdout(argv) {
    return argv.some((a, i) => (a === '-o' || a === '--out') && argv[i + 1] === '-');
}

/**
 * Run a driver's `main(status)` and exit with its code. `main` fills the
 * status fields it knows (subcommand, completed, next, outputs, oracle,
 * summary); a non-empty `status.oracle.errors` ends the run with exit 2.
 * `stdoutIsOutput`: the tool always prints its output on stdout, so
 * `--json-status -` is refused as usage (as `-o -` makes it for the drivers).
 * Does nothing unless `metaUrl` is the file node was asked to run.
 */
export function runCli(tool, metaUrl, main, { argv = process.argv, stdoutIsOutput = false } = {}) {
    if (argv[1] !== fileURLToPath(metaUrl)) return;
    const args = argv.slice(2);
    const status = {
        status_version: STATUS_VERSION,
        tool,
        subcommand: null,
        ok: false,
        exit_code: null,
        outcome: null,
        error: null,
        completed: null,
        next: null,
        outputs: {},
        oracle: null,
        summary: {},
    };
    const target = statusTarget(args);
    const finish = (outcome, err) => {
        status.outcome = outcome;
        status.exit_code = EXIT[outcome];
        status.ok = outcome === 'ok';
        if (err) {
            status.error = { message: err.message };
            process.stderr.write(`[${tool}] ERROR (${outcome}): ${err.message}\n`);
            if (outcome === 'internal' && err.stack) process.stderr.write(`${err.stack}\n`);
        }
        if (target) {
            const json = JSON.stringify(status, null, 2);
            if (target === '-') process.stdout.write(`${json}\n`);
            else {
                const abs = resolve(target);
                mkdirSync(dirname(abs), { recursive: true });
                writeFileSync(abs, `${json}\n`);
            }
        }
        // ⛓ explicit: the frontend module graph leaves timer / worker handles alive.
        process.exit(status.exit_code);
    };
    (async () => {
        if (args.includes('--json-status') && !target) {
            throw new UsageError('--json-status needs a PATH (or - for stdout)');
        }
        if (target === '-' && (stdoutIsOutput || outIsStdout(args))) {
            throw new UsageError(stdoutIsOutput
                ? `--json-status -: ${tool} prints its output on stdout; give the status a file`
                : '--json-status - and -o - both want stdout; give one of them a file');
        }
        await main(status);
    })().then(
        () => finish(status.oracle?.errors?.length ? 'oracle_mismatch' : 'ok'),
        (err) => finish(outcomeOf(err), err),
    );
}
