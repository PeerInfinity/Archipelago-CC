/**
 * standingValues — **THE ROWS EVERY HANDSHAKE, SEAL AND AS-BUILT RE-TYPES,
 * AND THE COMMANDS THAT MEASURE THEM** (R9 slice 12e, ⚖ ruling 38 item (5)).
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * ⚖ Ruling 32 A says a slice whose head EQUALS the commit a standing value was
 * taken at should QUOTE it rather than re-measure. That is right, and it made
 * every handshake a transcription of ~20 numbers — the producers' `--check`
 * md5s, each gate's `N/M`, vitest's files and tests, the roster — copied from
 * one prompt to the next by hand. They drift: slice 11b's own record carries
 * vitest as 10216 in one place and 10217 in another, and nothing on disk could
 * say which was the measurement.
 *
 * ⇒ the values live in `standing-values.json`, WRITTEN BY THE INSTRUMENTS THAT
 * MEASURE THEM. A slice's BEFORE is that file at its head; its AFTER is a
 * regeneration and a `git diff` of it.
 *
 * ── ⛔ EVERY ROW IS DERIVED. NONE IS TYPED ────────────────────────────
 *
 *   the identity rows   `reachClosure.identityRows()`, which reads
 *                       `identity-block.sh` — label, script AND the whole
 *                       `$( … )` body, because three rows run the SAME script
 *                       with different flags and the digest is the PIPE form.
 *   the producers       every `solve-`/`plan-`/`rerecord-*.mjs` that READS
 *                       `--check` (thirteen), each run with the command
 *                       template the identity block's own loop uses.
 *   the gates           `gateRoster.js` — the twenty-six `check-*.mjs`, with
 *                       the flags each one parses for itself.
 *   the suite           the unfiltered `npx vitest run`.
 *
 * ⛔⛔ `cheap` IS MEASURED, NOT DECLARED. `--write` times every row; `--check`
 * re-runs exactly the rows that came in under `CHEAP_MS` and QUOTES the rest
 * with the head they were taken at. A hand-kept "this one is fast" list is the
 * same defect as a hand-kept value: right until somebody makes a gate slower.
 */

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { LOCAL_HOST, PAGES_ORIGIN, REPO, argvFor, gateRoster } from './gateRoster.js';
import { identityProducerTemplate, identityRows, identityShellHelpers } from './reachClosure.js';

const run = promisify(execFile);

export const FILE = 'scripts/procgen/standing-values.json';
/** ⛓ Under a minute is what a slice can afford to re-run on every check. */
export const CHEAP_MS = 60000;

/** The head a measurement belongs to — a value without one cannot be reproduced. */
export function head({ repo = REPO } = {}) {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    } catch { return null; }
}

/**
 * ⛓ A producer is one that can DRIFT — the same rule `reachClosure.partition`
 * uses (`solve-`/`plan-`/`rerecord-` WITH a `--check`), applied to the whole
 * directory rather than to a reached set. A producer without a `--check` has
 * no committed artifact to disagree with and so has no standing value.
 */
export function producerScripts({ repo = REPO } = {}) {
    const dir = join(repo, 'scripts/procgen');
    return readdirSync(dir)
        .filter((f) => /^(?:solve|plan|rerecord)-[a-z0-9-]+\.mjs$/.test(f)).sort()
        .filter((f) => {
            const src = readFileSync(join(dir, f), 'utf8');
            return src.includes("'--check'") || src.includes('--check=')
                || src.includes('"--check"');
        });
}

/* ══════════════════════════════════════════════════════════════════════
 * THE ROWS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Every standing row, with the command that measures it. ⛔ The KEY is stable
 * and human-quotable, because it is what a seal will name.
 */
export function standingRows({ repo = REPO, host = LOCAL_HOST, pages = PAGES_ORIGIN } = {}) {
    const rows = [];
    const seen = new Set();
    const push = (row) => {
        if (seen.has(row.command)) return;
        seen.add(row.command);
        rows.push(row);
    };

    for (const r of identityRows({ repo })) {
        if (!r.command) continue;
        push({ key: `identity: ${r.label}`, kind: 'identity', command: r.command, shell: true });
    }

    const template = identityProducerTemplate({ repo });
    if (template) {
        for (const f of producerScripts({ repo })) {
            const name = f.replace(/\.mjs$/, '');
            push({
                key: `producer: ${name} --check`,
                kind: 'identity',
                command: template.split('$p').join(name),
                shell: true,
            });
        }
    }

    for (const g of gateRoster({ repo })) {
        const argv = argvFor(g, 'local', { host, pages });
        if (argv === null) continue;
        push({
            key: `gate: ${g.file.replace(/^check-/, '').replace(/\.mjs$/, '')}`,
            kind: 'gate',
            command: `node ${g.path}${argv.length ? ` ${argv.join(' ')}` : ''}`,
            browser: g.browser,
            windows: g.windows,
        });
    }

    push({ key: 'suite: vitest (unfiltered)', kind: 'suite', command: 'npx vitest run' });
    return rows;
}

/* ══════════════════════════════════════════════════════════════════════
 * RUNNING A ROW, AND READING ITS HEADLINE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ THE FIVE VERDICT FORMS THE GATES ACTUALLY PRINT — read out of their own
 * `console.log`s, not guessed (`gates.mjs` carries the same list and the same
 * reason: a guessed vocabulary turns a green gate red).
 */
const TOTAL_RE = /^(?:ALL CHECKS PASSED|ALL PASS\b.*|OK|\d+ (?:CHECK\(S\) FAILED|FAILURE\(S\)))$/;

/** vitest paints its summary; the digits are behind SGR escapes. */
const plain = (s) => s.replace(/\[[0-9;]*m/g, '');

/**
 * The HEADLINE of a row's output — one short string a human can compare.
 *
 * ⛔ PER KIND, because the kinds print different things and one regex over all
 * of them would be a fourth reader nobody could check:
 *   identity  the last non-empty line — an md5, or a gate's own status line.
 *   gate      `PASS/FAIL` counted off the gate's own `PASS:`/`FAIL:` prefixes,
 *             which is the form every standing value is already quoted in
 *             ("ship 254/0", "demos 204/0", "export 27/2").
 *   suite     `files/tests` off vitest's own summary block.
 */
export function headlineOf(kind, out) {
    const lines = plain(out).split('\n').map((l) => l.replace(/\r$/, ''));
    if (kind === 'gate') {
        const body = lines.join('\n');
        const pass = (body.match(/^PASS:/gm) ?? []).length;
        const fail = (body.match(/^FAIL:/gm) ?? []).length;
        const skip = (body.match(/^SKIP:/gm) ?? []).length;
        const total = lines.map((l) => l.trim()).reverse().find((l) => TOTAL_RE.test(l)) ?? null;
        return { value: `${pass}/${fail}${skip ? `/${skip}` : ''}`, total };
    }
    if (kind === 'suite') {
        const body = lines.join('\n');
        const files = (/Test Files\s+.*?\((\d+)\)/.exec(body) ?? [])[1];
        const tests = (/\bTests\s+.*?\((\d+)\)/.exec(body) ?? [])[1];
        return { value: files && tests ? `${files}/${tests}` : null, total: null };
    }
    const last = [...lines].reverse().find((l) => l.trim());
    return { value: last ? last.trim() : null, total: null };
}

/**
 * Run one row and read its value.
 *
 * ⛓ A `shell: true` row is one of `identity-block.sh`'s, and it is run WITH
 * that file's own helper definitions prepended — `m () { md5sum | cut -d' '
 * -f1; }` is the definition of what an identity value MEANS, and a copy of it
 * in JS would be a second spelling of it.
 *
 * ⛓ `${PIPESTATUS[0]}`, never `$?`: every identity row is a PIPELINE, so `$?`
 * is `md5sum`'s exit and would report success for a producer that threw.
 */
export async function runRow(row, { repo = REPO } = {}) {
    const t0 = process.hrtime.bigint();
    let out = '';
    let code = 0;
    const script = row.shell
        ? `${identityShellHelpers({ repo })}\n${row.command}\nexit "\${PIPESTATUS[0]}"`
        : row.command;
    try {
        const r = await run('bash', ['-c', script], { cwd: repo, maxBuffer: 1 << 27 });
        out = `${r.stdout}${r.stderr}`;
    } catch (e) {
        code = typeof e.code === 'number' ? e.code : 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message ?? e);
    }
    const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
    const { value, total } = headlineOf(row.kind, out);
    return { value, total, exit: code, ms };
}

/** The script a command names, so `--check` can refuse a RETIRED instrument. */
export const scriptIn = (command) => (/scripts\/procgen\/[A-Za-z0-9._-]+/.exec(command) ?? [])[0]
    ?? null;

/**
 * ⛔ A row whose command names an instrument that is NO LONGER ON DISK. Slice
 * 13 retired `plan-seedling-r7-act2.mjs`; a standing value whose command
 * cannot be run any more is not "unchanged", it is unmeasurable, and
 * `--check` says so BY NAME rather than carrying the last value forward.
 */
export function missingScript(command, { repo = REPO } = {}) {
    const s = scriptIn(command);
    return s && !existsSync(join(repo, s)) ? s : null;
}

export function readStandingValues({ repo = REPO } = {}) {
    const p = join(repo, FILE);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}
