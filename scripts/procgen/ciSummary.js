/**
 * ciSummary — **READ A PUSHED HEAD'S CI ANSWER, BY SHA** (R9 slice P3b (g),
 * ⚖ ruling 54 (6); ⚖ ruling 52's pattern generalised).
 *
 * ⛔ WHY A MODULE AND TWO THIN SCRIPTS. `ci-vitest-summary.mjs` is named
 * verbatim in `standing-values.json`'s `suite:` row `command`, and ⚖ 8
 * publishes command strings as identity. Moving the implementation here and
 * leaving that file as a shim keeps the committed command — and its stdout —
 * byte-identical, which is the difference between generalising an instrument
 * and quietly moving a standing row's subject.
 */

import { execFileSync } from 'node:child_process';

export const CI_REPO = 'PeerInfinity/Archipelago-CC';
export const WORKFLOW = 'unittests_frontend.yml';
/** ⛓ ONE spelling of the marker `ci-gates.mjs` prints and this file reads. */
export const CI_GATE_MARK = '## CI-GATE |';

const gh = (...a) => execFileSync('gh', ['--repo', CI_REPO, ...a],
    { encoding: 'utf8', maxBuffer: 1 << 28 });
/** `gh api` takes the repo in the endpoint, not as `--repo` (it rejects the flag). */
const ghApi = (endpoint) => execFileSync('gh', ['api', endpoint],
    { encoding: 'utf8', maxBuffer: 1 << 28 });

export const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

export function findRun(sha) {
    const rows = JSON.parse(gh('run', 'list', `--workflow=${WORKFLOW}`, '--limit', '50',
        '--json', 'databaseId,headSha,status,conclusion,createdAt'));
    return rows.find((r) => r.headSha.startsWith(sha)) || null;
}

export function jobLog(run) {
    // `gh run view --log` returns an EMPTY body for some concluded runs (measured
    // 2026-08-25 on run 32856555673); the jobs-log endpoint does not.
    const jobs = JSON.parse(ghApi(`repos/${CI_REPO}/actions/runs/${run.databaseId}/jobs`)).jobs;
    const job = jobs.find((j) => /JavaScript Unit Tests/.test(j.name)) || jobs[0];
    return ghApi(`repos/${CI_REPO}/actions/jobs/${job.id}/logs`);
}

export function parseSummaries(log) {
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

/**
 * ⛓⛓⛓ ONE GATE'S LINE, OUT OF THE JOB LOG.
 *
 * ⛔ THE LINE, NOT THE JOB CONCLUSION. The gate step runs under
 * `continue-on-error: true` — it must, because `check-seedling-full-tier-owed`
 * is red whenever a measurement is owed and that must not block every push —
 * and 12g′'s lesson is that `continue-on-error` hides a red at the JOB level.
 * So the verdict comes from the printed row.
 */
export function parseGateLines(log) {
    const out = new Map();
    for (const raw of strip(log).split('\n')) {
        const i = raw.indexOf(CI_GATE_MARK);
        if (i < 0) continue;
        const parts = raw.slice(i + CI_GATE_MARK.length).split('|').map((p) => p.trim());
        if (parts.length < 3) continue;
        const [key, value, exitPart, ...rest] = parts;
        out.set(key, {
            key,
            value,
            exit: Number((/^exit=(\d+)$/.exec(exitPart) ?? [])[1] ?? NaN),
            total: rest.join(' | ') || null,
        });
    }
    return out;
}
