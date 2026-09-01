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

/**
 * ⛓⛓ ONE RUN, BY ID — because a SHA can carry MORE THAN ONE RUN and
 * `findRun` can only hand back the newest. Measured at S3: a `workflow_
 * dispatch` re-run of the same head sits beside the push's run, and ⚖ 72 (b)
 * asks for THREE CONSECUTIVE RUNS — a bar whose readings cannot address a
 * particular run is a bar taken by eye.
 */
export function runById(id) {
    const r = JSON.parse(ghApi(`repos/${CI_REPO}/actions/runs/${id}`));
    return { databaseId: r.id, headSha: r.head_sha, status: r.status,
        conclusion: r.conclusion, createdAt: r.created_at };
}

export function findRun(sha) {
    const rows = JSON.parse(gh('run', 'list', `--workflow=${WORKFLOW}`, '--limit', '50',
        '--json', 'databaseId,headSha,status,conclusion,createdAt'));
    return rows.find((r) => r.headSha.startsWith(sha)) || null;
}

/** ⛓ Every job of one run — `per_page` because a matrix run has more than the
 *  endpoint's default page would return once the shards grow. */
export function runJobs(run) {
    return JSON.parse(ghApi(
        `repos/${CI_REPO}/actions/runs/${run.databaseId}/jobs?per_page=100`)).jobs;
}

export function jobLog(run) {
    // `gh run view --log` returns an EMPTY body for some concluded runs (measured
    // 2026-08-25 on run 32856555673); the jobs-log endpoint does not.
    const jobs = runJobs(run);
    const job = jobs.find((j) => /JavaScript Unit Tests/.test(j.name)) || jobs[0];
    return ghApi(`repos/${CI_REPO}/actions/jobs/${job.id}/logs`);
}

/**
 * ⛓⛓⛓ S3 (⚖ 72) — **THE GATE LINES ARE SPREAD ACROSS THE RUN'S JOBS NOW.**
 *
 * ⛔ Until S3 there was one job and `jobLog` was the whole log. The browser
 * gates run in a MATRIX of shard jobs partitioned by banked `ms`, so a reader
 * that kept asking one job for a key would refuse by name — *"carries no `##
 * CI-GATE | … |` line"* — for every browser row, which is the quietest way to
 * make a working production side look broken.
 *
 * ⛔ A JOB WHOSE LOG THE API WILL NOT SERVE IS NAMED, NOT SWALLOWED. A queued,
 * skipped or expired job 404s on the logs endpoint; dropping that silently
 * would turn "this shard never ran" into "this gate has no answer", which are
 * different facts and only one of them is the reader's business to hide.
 *
 * @returns {{log: string, jobs: number, unreadable: string[]}}
 */
export function gateLogs(run) {
    const jobs = runJobs(run);
    const parts = [];
    const unreadable = [];
    for (const job of jobs) {
        try { parts.push(ghApi(`repos/${CI_REPO}/actions/jobs/${job.id}/logs`)); } catch {
            unreadable.push(`${job.name} (${job.status}/${job.conclusion ?? '—'})`);
        }
    }
    return { log: parts.join('\n'), jobs: jobs.length, unreadable };
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

/**
 * ⛓⛓⛓ **THE VERDICT OF EVERY GATE LINE AGAINST THE BANK** — ⚖ 72 (b)'s
 * instrument, as a PURE FUNCTION (S4).
 *
 * ⛔ WHY IT IS HERE AND NOT INLINE IN THE SCRIPT. It was inline until S4, and
 * S4 gave it a third verdict — which is exactly when a rule stops being
 * readable from its output alone. Every input is a run's log, a bank and a
 * roster, and a rule that can only be interrogated by a network call to a
 * finished CI run is a rule whose edges nobody checks. `ciGatePlan.js` made
 * the same move for the partition, for the same reason.
 *
 * The four verdicts, and the direction each one is safe in:
 *
 *   `same`        the CI line equals the bank's value for the SAME key.
 *   `MOVED`       it does not — the only one that reddens the run-level exit.
 *   `shallow`     the gate declares `@ci-shallow`: CI's depth-1 checkout
 *                 cannot ask its question, so its line is NEVER compared —
 *                 not as a disagreement and not as an agreement either (trap
 *                 1058, S4). ⛔ Checked BEFORE the compare, so a shallow row
 *                 that happens to match cannot bank a streak it did not earn.
 *   `not-banked`  no bank row under that key — a `@ci-face` key is a
 *                 DIFFERENT, bounded claim and the bank holds none. ⛔ Never
 *                 a match: a quiet zero is what this whole file refuses.
 *
 * ⛔ AND A BANKED ARM WITH NO LINE IS `missing`, which is the direction that
 * matters: a shard that never ran must read as an ABSENT ANSWER, not as a
 * smaller verdict set that happens to agree with itself.
 *
 * @param {{lines: Map, bank: object, arms: object[]}} o  `arms` is
 *        `ciGateArms({set:'all'})` — both keys and the declaring gate.
 */
export function gateVerdicts({ lines, bank, arms }) {
    /** ⛓ CI key -> the STANDING key its value belongs under. They differ for a
     *  declared `@ci-face`, which is exactly the pair that must not compare. */
    const bankKeyOf = new Map(arms.map((a) => [a.key, a.gate.ciFace ? null : a.bankKey]));
    /** ⛓ …and the arms whose gate declares `@ci-shallow`, off the SAME roster
     *  row the bank key comes from (never a name typed here). */
    const shallowOf = new Map(arms.map((a) => [a.key, a.gate.ciShallow?.reason ?? null]));
    const rows = [...lines.values()].map((row) => {
        const bankKey = bankKeyOf.has(row.key) ? bankKeyOf.get(row.key) : row.key;
        const banked = bankKey ? bank[bankKey]?.value ?? null : null;
        const shallow = shallowOf.get(row.key) ?? null;
        const verdict = banked === null ? 'not-banked'
            : (shallow ? 'shallow' : (banked === row.value ? 'same' : 'MOVED'));
        return { ...row, bankKey, banked, shallow, verdict };
    });
    return { rows, missing: arms.filter((a) => !lines.has(a.key)).map((a) => a.key) };
}
