#!/usr/bin/env node
/**
 * gates — **RUN THE GATES, IN ONE LINE, KEYED ON EXIT CODES** (R9 slice 12e,
 * ⚖ ruling 38 item (6)).
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * There are twenty-six `check-*.mjs` gates and three different flags for
 * pointing them at a world. Every slice rebuilt that command line by hand,
 * and the cost was not typing:
 *
 *   · slice 12b″ had to REDISCOVER that `--root=` wants a Pages-SHAPED root
 *     (`<dev server>/frontend`) while `--host=` wants the repo root — two
 *     origins for one local server, and getting it wrong is a gate that
 *     passes against the wrong tree rather than one that fails;
 *   · `check-seedling-editor-phases.mjs` went UNRUN from slice 11 (which
 *     flipped the subject it had frozen) until slice 13 found it CRASHING —
 *     it was in the reach closure of three slices and nobody ran the list;
 *   · and that crash is the reason for this file's one hard rule below.
 *
 * ⛔⛔ **THE VERDICT IS THE EXIT CODE, NEVER A PRINTED TOTAL.** The phases
 * gate THREW mid-run: it printed neither `ALL CHECKS PASSED` nor `N CHECK(S)
 * FAILED`, so a runner grepping for a total reads it as *nothing* — not as a
 * failure. Here a gate fails when it exits non-zero, AND a gate that exits 0
 * without printing a total line is reported as a FAIL BY NAME, because a gate
 * with nothing to say did not check anything.
 *
 * ── Run ───────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/gates.mjs local                  every gate, local
 *   node scripts/procgen/gates.mjs live                   every gate a remote
 *                                                         origin can answer
 *   node scripts/procgen/gates.mjs local editor-overlays phases   by substring
 *   node scripts/procgen/gates.mjs reach <base>..HEAD [local|live]
 *   node scripts/procgen/gates.mjs --list                 the roster, derived
 *
 *   --host=<origin>    default http://localhost:8000 (a REPO-ROOT server)
 *   --pages=<origin>   default the published site
 *   --no-windows       skip the gates that drive the Windows Python driver
 *   --json             the same verdicts, machine-readable
 *
 * ⛓ `bash scripts/procgen/gates.sh …` is the same thing — the shim exists so
 * the one-liner reads like the other shell instrument in this directory.
 *
 * ⛓⛓ THE `reach` MODE is ⚖ ruling 32 A's other half. "Re-measure only what the
 * reach names" leaves a hole exactly when the list is LONG: the solver slices
 * 12b/12b′/12b″ named 23 gates in their closure and re-measured a few. This
 * runs every BROWSER gate `reach-seedling-change.mjs --range=` names for the
 * change, and publishes the count it ran.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { LOCAL_HOST, PAGES_ORIGIN, REPO, argvFor, gateRoster } from './gateRoster.js';

const run = promisify(execFile);
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name, fallback) => (argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(name.length + 3);

const HOST = arg('host', LOCAL_HOST);
const PAGES = arg('pages', PAGES_ORIGIN);
const JSON_OUT = flag('json');
const words = argv.filter((a) => !a.startsWith('--'));

if (flag('help') || (words.length === 0 && !flag('list'))) {
    console.log(`
gates — run the gates in one line, keyed on exit codes.

  node scripts/procgen/gates.mjs local [gate …]
  node scripts/procgen/gates.mjs live  [gate …]
  node scripts/procgen/gates.mjs reach <base>..HEAD [local|live]
  node scripts/procgen/gates.mjs --list

  --host=   repo-root server   (default ${LOCAL_HOST})
  --pages=  published site     (default ${PAGES_ORIGIN})
  --no-windows                 skip the Windows-driver gates
  --json                       machine-readable verdicts
`.trim());
    process.exit(0);
}

/* ── the roster, derived ─────────────────────────────────────────────── */

const ROSTER = gateRoster();

if (flag('list') || words[0] === 'list') {
    for (const g of ROSTER) {
        const kinds = [g.browser ? 'browser' : null, g.windows ? 'windows' : null]
            .filter(Boolean).join('+') || 'node';
        console.log(`${g.file.padEnd(40)} [${g.flags.join(',') || '-'}] ${kinds}`
            + `${g.browserVia ? ` (via ${g.browserVia})` : ''}`);
    }
    console.log(`\n${ROSTER.length} gate(s); `
        + `${ROSTER.filter((g) => g.browser).length} browser, `
        + `${ROSTER.filter((g) => g.windows).length} windows. `
        + `local ${ROSTER.filter((g) => argvFor(g, 'local', { host: HOST, pages: PAGES })).length}`
        + `, live ${ROSTER.filter((g) => argvFor(g, 'live', { host: HOST, pages: PAGES })).length}`);
    process.exit(0);
}

/* ── which gates this invocation runs ────────────────────────────────── */

const MODE = words[0];
let where = MODE === 'reach' ? (words[2] ?? 'local') : MODE;
let selection = ROSTER;
let reachNote = null;

if (MODE === 'reach') {
    const range = words[1];
    if (!range) { console.log('FAIL: reach needs a range — gates.mjs reach <base>..HEAD'); process.exit(1); }
    /**
     * ⛓ The reach instrument is the authority on what a change can move; this
     * file does not re-derive it. `--json` is its machine-readable form, and
     * `gates` is the partition we want.
     */
    const { stdout } = await run('node', ['scripts/procgen/reach-seedling-change.mjs',
        `--range=${range}`, '--json'], { cwd: REPO, maxBuffer: 1 << 26 });
    const report = JSON.parse(stdout);
    const named = new Set((report.gates ?? []).map((p) => p.split('/').pop()));
    selection = ROSTER.filter((g) => named.has(g.file) && g.browser);
    reachNote = `${range}: the reach names ${named.size} gate(s); `
        + `${selection.length} of them are browser gates and are run here`;
} else if (where !== 'local' && where !== 'live') {
    console.log(`FAIL: unknown world ${JSON.stringify(MODE)} — local, live or reach`);
    process.exit(1);
} else if (words.length > 1) {
    const picks = words.slice(1);
    selection = ROSTER.filter((g) => picks.some((p) => g.file.includes(p)));
    const missed = picks.filter((p) => !ROSTER.some((g) => g.file.includes(p)));
    if (missed.length) {
        console.log(`FAIL: no gate matches ${missed.join(', ')}`);
        process.exit(1);
    }
}

if (flag('no-windows')) selection = selection.filter((g) => !g.windows);

const PLAN = selection
    .map((g) => ({ gate: g, argv: argvFor(g, where, { host: HOST, pages: PAGES }) }))
    .filter((r) => r.argv !== null);
/** ⛓ …and the ones this world CANNOT answer are named, not dropped in silence. */
const UNRUNNABLE = selection.filter((g) => argvFor(g, where, { host: HOST, pages: PAGES }) === null);

/* ── the run ─────────────────────────────────────────────────────────── */

/**
 * ⛓ A gate's own summary line, in this directory's vocabulary: `ALL CHECKS
 * PASSED`, `N CHECK(S) FAILED`, `N FAILURE(S)`, or `OK`. Absence is the
 * finding, not a blank.
 */
const TOTAL_RE = /^(?:ALL CHECKS PASSED|OK|\d+ (?:CHECK\(S\) FAILED|FAILURE\(S\)))$/;
const totalOf = (out) => out.split('\n').map((l) => l.trim()).reverse()
    .find((l) => TOTAL_RE.test(l)) ?? null;
const tally = (out) => ({
    pass: (out.match(/^PASS:/gm) ?? []).length,
    fail: (out.match(/^FAIL:/gm) ?? []).length,
    skip: (out.match(/^SKIP:/gm) ?? []).length,
});

console.log(`# gates ${where}${MODE === 'reach' ? ' (reach)' : ''} — `
    + `${PLAN.length} gate(s), host ${HOST}${where === 'live' ? `, pages ${PAGES}` : ''}`);
if (reachNote) console.log(`  ⛓ ${reachNote}`);
if (UNRUNNABLE.length) {
    console.log(`  ⚠ ${UNRUNNABLE.length} gate(s) cannot address the ${where} world and are NOT `
        + `run: ${UNRUNNABLE.map((g) => g.file).join(', ')}`);
    if (where === 'live') {
        console.log('    (they build their URLs as `${HOST}/frontend/…` — a REPO-ROOT shape, '
            + 'which the published site does not have.)');
    }
}
console.log('');

const results = [];
for (const { gate, argv: gargv } of PLAN) {
    const t0 = process.hrtime.bigint();
    let out = '';
    let code = 0;
    try {
        const r = await run('node', [gate.path, ...gargv], { cwd: REPO, maxBuffer: 1 << 26 });
        out = `${r.stdout}${r.stderr}`;
    } catch (e) {
        code = typeof e.code === 'number' ? e.code : 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
        if (!out.trim()) out = String(e.message ?? e);
    }
    const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
    const total = totalOf(out);
    const counts = tally(out);
    /**
     * ⛔⛔ THE TWO WAYS A GATE FAILS, AND THE SECOND ONE IS WHY THIS EXISTS.
     * A non-zero exit is a failure. So is a ZERO exit with NO total line: the
     * gate threw before it could summarise, or it never checked anything, and
     * a runner that reads totals sees neither.
     */
    const red = code !== 0 || total === null;
    results.push({ file: gate.file, code, ms, total, ...counts, red });
    const verdict = red ? 'FAIL' : 'PASS';
    const why = code !== 0 ? `exit ${code}` : (total === null ? 'NO TOTAL LINE — it printed no verdict at all' : total);
    console.log(`${verdict}  ${gate.file.padEnd(40)} ${String(counts.pass)}/${counts.fail}`
        + `${counts.skip ? `/${counts.skip} skipped` : ''}  ${(ms / 1000).toFixed(1)}s  — ${why}`);
    if (red) {
        for (const line of out.split('\n').filter((l) => l.startsWith('FAIL:')).slice(0, 6)) {
            console.log(`        ${line}`);
        }
    }
}

const reds = results.filter((r) => r.red);
if (JSON_OUT) console.log(JSON.stringify({ where, host: HOST, results }, null, 2));
console.log(`\n${results.length - reds.length}/${results.length} gate(s) green`
    + `${reds.length ? ` — RED: ${reds.map((r) => r.file).join(', ')}` : ''}`);
process.exit(reds.length ? 1 : 0);
