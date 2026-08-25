#!/usr/bin/env node
/**
 * ci-vitest-summary.mjs — read a pushed head's UNFILTERED vitest result from
 * CI instead of re-running it locally (⚖ R9 ruling 52).
 *
 *   node scripts/procgen/ci-vitest-summary.mjs [<sha>] [--wait] [--json]
 *
 * <sha> defaults to `git rev-parse HEAD`. Finds the `JavaScript Unit Tests`
 * workflow run for that commit on the fork (`gh --repo PeerInfinity/…`,
 * [[reference_fork_ci]]), reads the job log, and prints the two vitest
 * summaries — the default config and the slow battery — as
 * `files/tests` in the SAME spelling `standing-values.json` quotes
 * (`353/11031`), plus passed/skipped/failed and the slow row.
 *
 * Exit codes: 0 both suites green · 1 a suite red · 2 no run for this SHA
 * (path filter did not trigger it, or not pushed) · 3 run not concluded
 * (use --wait to poll every 30 s, up to 40 min) · 4 the log has no summary
 * (the job was cancelled or the format changed — say so, never guess).
 *
 * Nothing here is typed: the counts are parsed from vitest's own summary
 * lines (`Test Files  N passed (M)`, `Tests  N passed | K skipped (M)`).
 */
import { execFileSync } from 'node:child_process';

const REPO = 'PeerInfinity/Archipelago-CC';
const WORKFLOW = 'unittests_frontend.yml';
const args = process.argv.slice(2);
const wait = args.includes('--wait');
const json = args.includes('--json');
const sha = args.find((a) => !a.startsWith('--')) || git('rev-parse', 'HEAD');

function git(...a) { return execFileSync('git', a, { encoding: 'utf8' }).trim(); }
function gh(...a) { return execFileSync('gh', ['--repo', REPO, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }); }
// `gh api` takes the repo in the endpoint, not as `--repo` (it rejects the flag).
function ghApi(endpoint) { return execFileSync('gh', ['api', endpoint], { encoding: 'utf8', maxBuffer: 1 << 28 }); }

function findRun() {
    const rows = JSON.parse(gh('run', 'list', `--workflow=${WORKFLOW}`, '--limit', '50',
        '--json', 'databaseId,headSha,status,conclusion,createdAt'));
    return rows.find((r) => r.headSha.startsWith(sha)) || null;
}

function strip(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

function parseSummaries(log) {
    const lines = strip(log).split('\n');
    const re = (label) => new RegExp(`${label}\\s+(?:(\\d+) failed\\s*\\|\\s*)?(\\d+) passed(?:\\s*\\|\\s*(\\d+) skipped)?\\s*\\((\\d+)\\)`);
    const files = [], tests = [];
    for (const l of lines) {
        const f = l.match(re('Test Files')); if (f) files.push(f);
        const t = l.match(re('Tests')); if (t) tests.push(t);
    }
    const n = Math.min(files.length, tests.length);
    const row = (m) => ({ failed: +(m[1] || 0), passed: +m[2], skipped: +(m[3] || 0), total: +m[4] });
    return Array.from({ length: n }, (_, i) => ({ files: row(files[i]), tests: row(tests[i]) }));
}

let run = findRun();
if (!run) { console.error(`no JavaScript Unit Tests run for ${sha} (not pushed, or the path filter did not trigger it)`); process.exit(2); }
const deadline = Date.now() + 40 * 60 * 1000;
while (run.status !== 'completed') {
    if (!wait) { console.error(`run ${run.databaseId} for ${sha} is ${run.status} — pass --wait`); process.exit(3); }
    if (Date.now() > deadline) { console.error(`run ${run.databaseId} still ${run.status} after 40 min`); process.exit(3); }
    await new Promise((r) => setTimeout(r, 30_000));
    run = findRun();
}

// `gh run view --log` returns an EMPTY body for some concluded runs (measured
// 2026-08-25 on run 32856555673); the jobs-log endpoint does not.
const jobs = JSON.parse(ghApi(`repos/${REPO}/actions/runs/${run.databaseId}/jobs`)).jobs;
const job = jobs.find((j) => /JavaScript Unit Tests/.test(j.name)) || jobs[0];
const log = ghApi(`repos/${REPO}/actions/jobs/${job.id}/logs`);
// The job log carries no step column: the summaries appear in step order —
// the default config first, the slow battery second.
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
