#!/usr/bin/env node
/**
 * ci-summary — **A PUSHED HEAD'S CI ANSWER, BY SHA — THE SUITE OR ONE GATE**
 * (R9 slice P3b (g), ⚖ ruling 54 (6); ⚖ 52 generalised).
 *
 *   node scripts/procgen/ci-summary.mjs [<sha>] [--wait] [--json]
 *   node scripts/procgen/ci-summary.mjs [<sha>] --gate='<standing key>' [--json]
 *
 * Without `--gate=` this is exactly what `ci-vitest-summary.mjs` has always
 * been — and that file is now a SHIM onto this one, so the `suite:` standing
 * row's committed `command` string and its stdout are unmoved (⚖ 8 publishes
 * command strings as identity; generalising an instrument must not quietly
 * move a standing row's subject).
 *
 * With `--gate=` it reads ONE line printed by `ci-gates.mjs`, gathered across
 * EVERY job of that SHA's run — since S3 the browser gates run in a matrix of
 * shard jobs, so one job's log is no longer the whole answer.
 *
 * Exit codes: 0 green · 1 red · 2 no run for this SHA · 3 not concluded
 * (`--wait` polls) · 4 the log carries no such answer · 5 REFUSED BY NAME —
 * CI cannot answer this key at all.
 *
 * ── ⛔⛔ THE REFUSAL IS THE POINT OF THE `--gate=` FORM ────────────────
 *
 * Asking this file for a key CI does not produce must be a NAMED REFUSAL and
 * never `0/0`: a quiet zero is how a row that gates nothing gets quoted as a
 * measurement. Two things are refused, and the population is DERIVED — the
 * roster answers both, so neither can outlive what it refused:
 *
 *   · a gate `ciGatePlan.ciRunnable` rejects — today the four Windows rows,
 *     which hold `/mnt/c/Windows/py.exe` and could not resolve their driver
 *     on a runner at all (⚖ 72 (a): they stay box-measured);
 *   · a gate that declares an `@ci-face`, asked for its `gate:` key — its CI
 *     answer is a DIFFERENT, bounded claim under its own prefix.
 *
 * ⛓⛓ S3 (⚖ 72) RETIRED THE BROWSER HALF OF THIS REFUSAL. Until then the
 * sentence here read *"twenty-seven of thirty-one gates need a browser or a
 * Windows GPU and CI runs none of them"*; `unittests_frontend.yml` now runs
 * every browser arm in a matrix of shard jobs, so those keys HAVE answers and
 * refusing them would be a refusal about a world that no longer exists.
 * ⛔ What did NOT change is `ciSourced` — no standing row's `command` reads
 * this path yet; widening that is S4, after ⚖ 72 (b)'s stability bar.
 */

import { execFileSync } from 'node:child_process';

import { ciRunnable } from './ciGatePlan.js';
import { REPO, gateRoster } from './gateRoster.js';
import { findRun, gateLogs, jobLog, parseGateLines, parseSummaries } from './ciSummary.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const arg = (n) => (args.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || null;

const wait = flag('wait');
const json = flag('json');
const GATE = arg('gate');
const sha = args.find((a) => !a.startsWith('--'))
    || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

/* ── ⛔ the refusal, DERIVED from the roster, before any network call ── */

if (GATE) {
    const roster = gateRoster({ repo: REPO });
    const nameOf = (g) => g.file.replace(/^check-/, '').replace(/\.mjs$/, '');
    const asked = GATE.replace(/^[a-z-]+:\s*/, '');
    const gate = roster.find((g) => nameOf(g) === asked);
    if (!gate) {
        console.error(`REFUSED: no gate named ${JSON.stringify(asked)} is on the roster — `
            + `${roster.length} gate(s) derived from scripts/procgen/check-*.mjs`);
        process.exit(5);
    }
    if (!ciRunnable(gate)) {
        console.error(`REFUSED: ${gate.file} drives the Windows Python driver`
            + ' (`/mnt/c/Windows/py.exe`), which a runner does not have — so no answer for it'
            + ' exists at any SHA. Its standing row is measured on the box (⚖ 72 (a)).'
            + ' ⛔ This is a refusal, not a 0/0.');
        process.exit(5);
    }
    if (gate.ciFace && GATE.startsWith('gate:')) {
        console.error(`REFUSED: ${gate.file} declares \`@ci-face ${gate.ciFace.prefix}\`, so CI `
            + `publishes \`${gate.ciFace.prefix}: ${asked}\` and NOT \`gate: ${asked}\`. Its `
            + 'VALUE cannot survive a fresh checkout — asking for it here would return a '
            + 'number about a different claim. ⛔ This is a refusal, not a 0/0.');
        process.exit(5);
    }
}

/* ── the run ─────────────────────────────────────────────────────────── */

let run = findRun(sha);
if (!run) {
    console.error(`no ${GATE ? 'procgen-gate' : 'JavaScript Unit Tests'} run for ${sha} `
        + '(not pushed, or the path filter did not trigger it)');
    process.exit(2);
}
const deadline = Date.now() + 40 * 60 * 1000;
while (run.status !== 'completed') {
    if (!wait) { console.error(`run ${run.databaseId} for ${sha} is ${run.status} — pass --wait`); process.exit(3); }
    if (Date.now() > deadline) { console.error(`run ${run.databaseId} still ${run.status} after 40 min`); process.exit(3); }
    await new Promise((r) => setTimeout(r, 30_000));
    run = findRun(sha);
}
/**
 * ⛓ THE SUITE LIVES IN ONE JOB; THE GATE LINES ARE SPREAD ACROSS ALL OF THEM
 * (S3's shard matrix). Asking for every job's log when only the suite is
 * wanted would pay four extra API round trips for nothing.
 */
const gathered = GATE ? gateLogs(run) : null;
const log = gathered ? gathered.log : jobLog(run);

/* ── --gate=: one line, read out of the job log ──────────────────────── */

if (GATE) {
    const rows = parseGateLines(log);
    const row = rows.get(GATE);
    if (!row) {
        console.error(`run ${run.databaseId} (${run.conclusion}) carries no `
            + `\`## CI-GATE | ${GATE} |\` line across its ${gathered.jobs} job(s). `
            + `${rows.size} gate line(s) present: `
            + `${[...rows.keys()].join(', ') || '(none — the step did not run)'}`
            + (gathered.unreadable.length
                ? `\n⚠ ${gathered.unreadable.length} job log(s) could not be read, so this `
                  + `may be a job that never ran rather than a missing line: `
                  + `${gathered.unreadable.join('; ')}`
                : ''));
        process.exit(4);
    }
    if (json) console.log(JSON.stringify({ sha, run: run.databaseId, ...row }, null, 2));
    else {
        console.log(`CI gate @ ${sha.slice(0, 9)} — run ${run.databaseId} ${run.conclusion}`);
        console.log(`  ${row.key}  ${row.value}   exit=${row.exit}   ${row.total ?? ''}`);
    }
    /** ⛔ THE LINE'S OWN EXIT, never the job conclusion — 12g′'s lesson. */
    process.exit(row.exit === 0 ? 0 : 1);
}

/* ── the suite, unchanged ────────────────────────────────────────────── */

const [unit, slow] = parseSummaries(log);
if (!unit) { console.error(`run ${run.databaseId} (${run.conclusion}) has no vitest summary in its log — read it yourself`); process.exit(4); }

const out = {
    sha, run: run.databaseId, conclusion: run.conclusion, createdAt: run.createdAt,
    standingRow: `${unit.files.total}/${unit.tests.total}`,
    unit, slow,
};
if (json) console.log(JSON.stringify(out, null, 2));
else {
    console.log(`CI vitest @ ${sha.slice(0, 9)} — run ${run.databaseId} ${run.conclusion} (${run.createdAt})`);
    console.log(`  suite: vitest (unfiltered)  ${out.standingRow}   (${unit.tests.passed} passed | ${unit.tests.skipped} skipped | ${unit.tests.failed} failed)`);
    console.log(slow ? `  slow battery                ${slow.files.total}/${slow.tests.total}   (${slow.tests.passed} passed | ${slow.tests.failed} failed)` : '  slow battery                (no summary — step cancelled?)');
}
const red = unit.tests.failed > 0 || (slow && slow.tests.failed > 0) || run.conclusion !== 'success';
process.exit(red ? 1 : 0);
