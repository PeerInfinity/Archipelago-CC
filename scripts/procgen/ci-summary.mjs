#!/usr/bin/env node
/**
 * ci-summary — **A PUSHED HEAD'S CI ANSWER, BY SHA — THE SUITE OR ONE GATE**
 * (R9 slice P3b (g), ⚖ ruling 54 (6); ⚖ 52 generalised).
 *
 *   node scripts/procgen/ci-summary.mjs [<sha>] [--wait] [--json]
 *   node scripts/procgen/ci-summary.mjs [<sha>] --gate='<standing key>' [--json]
 *   node scripts/procgen/ci-summary.mjs [<sha>] --gates [--json]
 *   node scripts/procgen/ci-summary.mjs --run=<run id> --gates
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
 * ── ⛓⛓⛓ `--gates`: **THE WHOLE VERDICT SET, AGAINST THE BANK** ───────
 *
 * ⚖ 72 (b) sets the bar a row must clear before the bank may quote CI for it:
 * **three consecutive CI runs whose verdict sets equal the banked values.**
 * Comparing two dozen keys by eye once per run is how a bar gets recorded as
 * "looked fine". This form prints one row per `## CI-GATE |` line at a SHA,
 * beside the bank's value for the SAME key, and exits non-zero if any COMPARED
 * pair disagrees.
 *
 * ⛔ A LINE WITH NO BANK ROW IS `not-banked`, NEVER A MATCH. A `@ci-face` key
 * (`gate-help-ci: …`, `structure: …`) is a DIFFERENT, bounded claim and the
 * bank holds no row under it — counting it as agreement would be the quiet
 * zero this file's whole refusal ladder exists to prevent.
 * ⛔ AND A BANKED ARM WITH NO LINE IS `MISSING`, which is the direction that
 * matters: a shard that never ran must read as an absent answer, not as a
 * smaller verdict set that happens to agree with itself.
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

import { ciGateArms, ciRunnable } from './ciGatePlan.js';
import { REPO, gateRoster } from './gateRoster.js';
import { findRun, gateLogs, jobLog, parseGateLines, parseSummaries, runById } from './ciSummary.js';
import { readStandingValues } from './standingValues.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const arg = (n) => (args.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || null;

const wait = flag('wait');
const json = flag('json');
const GATE = arg('gate');
const ALL_GATES = flag('gates');
let sha = args.find((a) => !a.startsWith('--'))
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

/** ⛓ `--run=<id>` names ONE run; without it the SHA's newest is taken. */
const RUN_ID = arg('run');
let run = RUN_ID ? runById(RUN_ID) : findRun(sha);
/** ⛔ …and the REPORTED sha becomes that run's head, never the local HEAD a
 *  reader happened to be sitting on when they asked about a run id. */
if (run && RUN_ID) sha = run.headSha;
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
const gathered = (GATE || ALL_GATES) ? gateLogs(run) : null;
const log = gathered ? gathered.log : jobLog(run);

/* ── --gates: the whole verdict set, beside the bank's ───────────────── */

if (ALL_GATES) {
    const lines = parseGateLines(log);
    const bank = readStandingValues({ repo: REPO })?.rows ?? {};
    /** ⛓ CI key -> the STANDING key its value belongs under. They differ for a
     *  declared `@ci-face`, which is exactly the pair that must not compare. */
    const arms = ciGateArms({ repo: REPO, set: 'all' });
    const bankKeyOf = new Map(arms.map((a) => [a.key, a.gate.ciFace ? null : a.bankKey]));
    const rows = [...lines.values()].map((row) => {
        const bankKey = bankKeyOf.has(row.key) ? bankKeyOf.get(row.key) : row.key;
        const banked = bankKey ? bank[bankKey]?.value ?? null : null;
        return { ...row, bankKey, banked,
            verdict: banked === null ? 'not-banked' : (banked === row.value ? 'same' : 'MOVED') };
    });
    /** ⛔ …and the arms CI was supposed to answer and did not. */
    const missing = arms.filter((a) => !lines.has(a.key)).map((a) => a.key);
    const moved = rows.filter((r) => r.verdict === 'MOVED');
    if (json) {
        console.log(JSON.stringify({ sha, run: run.databaseId, conclusion: run.conclusion,
            jobs: gathered.jobs, unreadable: gathered.unreadable, rows, missing }, null, 2));
    } else {
        console.log(`CI gates @ ${sha.slice(0, 9)} — run ${run.databaseId} ${run.conclusion}, `
            + `${gathered.jobs} job(s), ${rows.length} line(s)`);
        for (const r of rows.sort((a, b) => a.key.localeCompare(b.key))) {
            console.log(`  ${r.verdict.padEnd(10)} ${r.key.padEnd(44)} ci=${r.value}`
                + `${r.verdict === 'MOVED' ? `  bank=${r.banked}` : ''}  exit=${r.exit}`);
        }
        for (const k of missing) console.log(`  MISSING    ${k}`);
        if (gathered.unreadable.length) {
            console.log(`  ⚠ ${gathered.unreadable.length} job log(s) unreadable: `
                + gathered.unreadable.join('; '));
        }
        console.log(`\n${rows.filter((r) => r.verdict === 'same').length} same, `
            + `${moved.length} MOVED, `
            + `${rows.filter((r) => r.verdict === 'not-banked').length} not-banked, `
            + `${missing.length} MISSING.`);
        /**
         * ⛔⛔ ⚖ 72 (b) IS A PER-ROW BAR, AND READING IT PER-RUN WOULD BLOCK
         * EVERY ROW ON THE WORST ONE. The ruling reads *"three consecutive CI
         * runs whose verdict sets equal the banked values before A ROW flips"*.
         * Measured at S3: two headless rows are MOVED in CI at EVERY head and
         * always will be — `seedling-full-tier-owed` refuses by name in a
         * depth-1 clone, and `slice-records` reads the shallow clone's own HEAD
         * as the convention's start. A run-level reading would hold the other
         * 25 rows hostage to those two forever. So this exit code is the
         * RUN-level answer (useful as "did anything move at all"), and the
         * per-row column above is the one S4 consumes.
         */
        console.log('⚖ 72 (b): the bar is PER ROW — three consecutive runs in which THAT row '
            + 'reads `same`. This exit code is the run-level answer, not the bar.');
    }
    process.exit(moved.length || missing.length ? 1 : 0);
}

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
