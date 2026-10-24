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
/** ⛓ ci-jsut-split — what a battery planned, and that it finished (see `batteryCompleteness`). */
export const CI_PLANNED_MARK = '## CI-PLANNED |';
export const CI_DONE_MARK = '## CI-DONE |';
/** ⛓ …and the fraction of a step deadline past which a battery WARNS. */
export const HEADROOM_WARN_FRACTION = 0.75;

/**
 * ⛓ `gh`'s stderr is PIPED, never inherited: a caught 404 must not leak a
 * `gh: HTTP 404` line into the reader's own output (a `--json` consumer that
 * merged the streams KEPT every CI-sourced row on it, 2026-10-17). A failure
 * still throws, and its message carries what gh said.
 */
const GH_OPTS = { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] };
const gh = (...a) => execFileSync('gh', ['--repo', CI_REPO, ...a], GH_OPTS);
/** `gh api` takes the repo in the endpoint, not as `--repo` (it rejects the flag). */
const ghApi = (endpoint) => execFileSync('gh', ['api', endpoint], GH_OPTS);

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

/**
 * ⛓ The most recent runs of the workflow, newest first — `--write-costs`'
 * population. ⛔ SUCCESSFUL ONES ONLY: a cancelled or failed run's shard job
 * may have died part-way, and its arms' `here=` lines would then be a sample
 * of a truncated battery banked as an arm's cost.
 */
export function recentRuns({ limit = 3 } = {}) {
    const rows = JSON.parse(gh('run', 'list', `--workflow=${WORKFLOW}`, '--limit', '30',
        '--json', 'databaseId,headSha,status,conclusion,createdAt'));
    return pickGateRuns(rows.filter((r) => r.status === 'completed' && r.conclusion === 'success'),
        runJobs, limit);
}

/**
 * ⛓⛓ ci-skip-rules RULE 1 — **A SUCCESSFUL RUN IS NOT NECESSARILY ONE THAT RAN
 * THE GATES.** A main push of an already-green SHA concludes `success` with its
 * gate jobs SKIPPED, so it carries no `##   ms |` line at all. Priced from it,
 * `--write-costs` would bank an EMPTY cost table and `planCiShards` would price
 * every arm at the whole budget (trap 1068's collapse, from the other side).
 */
export const GATE_JOB = /^(?:Headless procgen gates|Browser gate shard — )/;
export const ranGates = (jobs) =>
    (jobs ?? []).some((j) => GATE_JOB.test(j.name ?? '') && j.conclusion !== 'skipped');

/** ⛓ Pure: the first `limit` runs, newest first, whose gate jobs RAN. */
export function pickGateRuns(runs, jobsOf, limit) {
    const out = [];
    for (const r of runs) {
        if (out.length >= limit) break;
        if (ranGates(jobsOf(r))) out.push(r);
    }
    return out;
}

/**
 * ⛓⛓⛓ **ci-skip-rules RULE 1 (⚖ user, 2026-10-17) — A MAIN PUSH OF A SHA ITS
 * BRANCH ALREADY PASSED RUNS NO SUITE.** `unittests_frontend.yml`'s first job
 * (`Same SHA already green?`) finds a successful run at the pushed SHA and the
 * Vitest job is then SKIPPED. ⛔ That skipped main run is the NEWEST run for the
 * SHA, and until this rule `findRun` returned the newest — so the planners'
 * *"read JSUT at the merged SHA before the ff"* would have read a skip.
 *
 * ⇒ the newest run whose suite job did NOT skip. And a main push whose guard
 * has not decided yet is passed over when an older run at the same SHA already
 * succeeded, because that run is exactly what the guard will find — so a
 * reader asking in the guard's first twenty seconds gets the same answer as
 * one asking a minute later, instead of an `in_progress` it has to wait out.
 *
 * ⛓ F7 (`ci-skip-review` §3 R1): the runs come from `?head_sha=`, not from the
 * workflow's newest 50 (≈ one day of pushes). A SHA older than a day used to
 * read `no run` while its run sat on page two.
 */
export const GUARD_JOB = /^Same SHA already green\?/;

/** The guard runs on a main PUSH only — the workflow's own `if:`. */
const guardedPush = (r) => r.event === 'push' && r.headBranch === 'main';

/**
 * ⛓ Pure, so the pick can be asked without the network.
 * @param {object[]} runs  newest first, as `findRun` maps them
 * @param {(run: object) => object[]} jobsOf
 * @returns {{run: object|null, passedOver: {run: object, why: string}[]}}
 */
export function pickSuiteRun(runs, jobsOf) {
    const passedOver = [];
    for (const [i, run] of runs.entries()) {
        const jobs = jobsOf(run);
        /** ⛓ ci-jsut-split — the suite is a FAMILY of jobs now (shards + slow). */
        const suite = suiteJobs(jobs);
        if (suite.skipped) {
            passedOver.push({ run, why: 'its suite job was SKIPPED (the SHA was already green)' });
            continue;
        }
        const guard = jobs.find((j) => GUARD_JOB.test(j.name ?? ''));
        const undecided = guardedPush(run) && (suite.layout === 'none' || suite.pending.length > 0)
            && guard?.status !== 'completed';
        if (undecided && runs.slice(i + 1).some((r) => r.conclusion === 'success')) {
            passedOver.push({ run, why: 'its guard has not decided, and an older run at this '
                + 'SHA already succeeded — which is what the guard will find' });
            continue;
        }
        return { run, passedOver };
    }
    return { run: null, passedOver };
}

const FULL_SHA = /^[0-9a-f]{40}$/;
/** A short SHA → the full one (`?head_sha=` matches only a full SHA). */
function fullSha(sha) {
    if (FULL_SHA.test(sha)) return sha;
    try {
        return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    } catch { return null; }
}

/** Every run of the workflow at one SHA, newest first. */
export function runsAtSha(sha) {
    const full = fullSha(sha);
    if (full) {
        return JSON.parse(ghApi(`repos/${CI_REPO}/actions/workflows/${WORKFLOW}/runs`
            + `?head_sha=${full}&per_page=50`)).workflow_runs
            .map((r) => ({ databaseId: r.id, headSha: r.head_sha, status: r.status,
                conclusion: r.conclusion, createdAt: r.created_at, event: r.event,
                headBranch: r.head_branch }));
    }
    // ⛓ A short SHA this clone cannot resolve — the old listing, wider.
    return JSON.parse(gh('run', 'list', `--workflow=${WORKFLOW}`, '--limit', '200',
        '--json', 'databaseId,headSha,status,conclusion,createdAt,event,headBranch'))
        .filter((r) => r.headSha.startsWith(sha));
}

/**
 * The run whose suite answers for `sha` — see `pickSuiteRun`. Each run passed
 * over is named on stderr, so a reader sees WHICH run answered and why the
 * newest did not.
 */
export function findRun(sha) {
    const { run, passedOver } = pickSuiteRun(runsAtSha(sha), runJobs);
    for (const p of passedOver) {
        console.error(`⛓ rule 1: passed over run ${p.run.databaseId} (${p.run.event} on `
            + `${p.run.headBranch}) — ${p.why}`);
    }
    return run;
}

/** ⛓ Every job of one run — `per_page` because a matrix run has more than the
 *  endpoint's default page would return once the shards grow. */
export function runJobs(run) {
    return JSON.parse(ghApi(
        `repos/${CI_REPO}/actions/runs/${run.databaseId}/jobs?per_page=100`)).jobs;
}

/**
 * ⛓ ONE spelling of the job the SUITE's numbers come out of. The workflow calls
 * it `JavaScript Unit Tests (Vitest)`; the match is on the stable prefix so a
 * renamed suffix does not silently fall through to `jobs[0]`.
 */
export const VITEST_JOB = /JavaScript Unit Tests/;

/** ⛓ Pure, so the pick can be asked without the network. `null` when no job
 *  matches — the FALLBACK belongs to the caller, not here. */
export function pickVitestJob(jobs) {
    return (jobs ?? []).find((j) => VITEST_JOB.test(j.name ?? '')) ?? null;
}

/**
 * ⛓⛓⛓ ci-jsut-split (⚖ user, 2026-10-17) — **THE SUITE IS SPLIT ACROSS JOBS NOW.**
 * `unittests_frontend.yml` runs the default tier as a matrix of
 * `JavaScript Unit Tests (Vitest shard k/N)` jobs (`vitest --shard=k/N`) and the
 * slow tier as `JavaScript Unit Tests (slow Vitest)`. Until then ONE job ran
 * both, and its log carried both summaries.
 *
 * ⛔⛔ A PARTIAL SUITE MUST NEVER READ AS A SMALLER GREEN ONE. The shard count is
 * read off the shard jobs' OWN names (`k/N`), so a shard that is absent from the
 * listing is named in `missing`, and the slow job is owed whenever any shard is.
 * A SKIPPED member of a suite that otherwise ran is missing too: it carries no
 * summary, and a sum without it is a different number.
 *
 * ⛓ A run of the OLD layout (one job, both summaries) is `single`, so a SHA from
 * before the split still reads.
 *
 * @returns {{layout: 'none'|'single'|'split', skipped: boolean, family: object[],
 *   shards: {k:number, n:number, job:object}[], slow: object|null, single: object|null,
 *   missing: string[], pending: object[]}}
 */
export const SUITE_SHARD_JOB = /^JavaScript Unit Tests \(Vitest shard (\d+)\/(\d+)\)$/;
export const SUITE_SLOW_JOB = /^JavaScript Unit Tests \(slow Vitest\)$/;
export function suiteJobs(jobs) {
    const family = (jobs ?? []).filter((j) => VITEST_JOB.test(j.name ?? ''));
    const out = { layout: 'none', skipped: false, family, shards: [], slow: null, single: null,
        missing: [], pending: family.filter((j) => j.status !== 'completed') };
    if (!family.length) return out;
    /** ⛓ Rule 1 skips the whole family together — and a skipped MATRIX job is
     *  listed once, under its UNEXPANDED name, so the skip is read off the family. */
    if (family.every((j) => j.conclusion === 'skipped')) {
        out.skipped = true;
        out.layout = family.some((j) => /shard|slow/.test(j.name)) ? 'split' : 'single';
        return out;
    }
    for (const job of family) {
        const m = SUITE_SHARD_JOB.exec(job.name);
        if (m) out.shards.push({ k: Number(m[1]), n: Number(m[2]), job });
        else if (SUITE_SLOW_JOB.test(job.name)) out.slow = job;
    }
    if (!out.shards.length && !out.slow) {
        out.layout = 'single';
        out.single = family[0];
        return out;
    }
    out.layout = 'split';
    out.shards.sort((a, b) => a.k - b.k);
    const n = Math.max(0, ...out.shards.map((s) => s.n));
    if (!n) out.missing.push('JavaScript Unit Tests (Vitest shard ?/?) — no shard job at all');
    for (let k = 1; k <= n; k++) {
        const s = out.shards.find((x) => x.k === k && x.n === n);
        if (!s) out.missing.push(`JavaScript Unit Tests (Vitest shard ${k}/${n})`);
        else if (s.job.conclusion === 'skipped') out.missing.push(`${s.job.name} (skipped)`);
    }
    for (const s of out.shards.filter((x) => x.n !== n)) {
        out.missing.push(`${s.job.name} — disagrees with the other shards' count ${n}`);
    }
    if (!out.slow) out.missing.push('JavaScript Unit Tests (slow Vitest)');
    else if (out.slow.conclusion === 'skipped') out.missing.push(`${out.slow.name} (skipped)`);
    return out;
}

/**
 * ⛓ ci-jsut-split — the summed suite out of a split run's per-job summaries.
 * Pure. Each input is `parseSummaries(log)[0]` of one shard (or `undefined`
 * when the log carried none — then the sum is refused by the caller).
 */
export function sumSummaries(rows) {
    const add = (a, b) => ({ failed: a.failed + b.failed, passed: a.passed + b.passed,
        skipped: a.skipped + b.skipped, total: a.total + b.total });
    const zero = { failed: 0, passed: 0, skipped: 0, total: 0 };
    return rows.reduce((acc, r) => ({ files: add(acc.files, r.files), tests: add(acc.tests, r.tests) }),
        { files: zero, tests: zero });
}

/**
 * ⛓⛓⛓ **R1 — THE SUITE'S JOB, AS ITS OWN STATUS.** `ci-summary` refused an
 * in-progress RUN — *"pass --wait"* — even when the Vitest job had finished and
 * its log was final, because `unittests_frontend.yml` keeps the run open while
 * the browser gate shards finish (S3's matrix). A run status is an answer about
 * the slowest job in it; the suite's numbers are an answer about ONE.
 *
 * @returns {{id:number, name:string, status:string, conclusion:string|null}|null}
 */
export function vitestJob(run) {
    const jobs = runJobs(run);
    const job = pickVitestJob(jobs) ?? jobs[0] ?? null;
    return job
        ? { id: job.id, name: job.name, status: job.status, conclusion: job.conclusion }
        : null;
}

/** ⛓ One job's log, by id — so a caller that already listed the run's jobs does
 *  not pay for the listing twice. */
export function jobLogById(id) {
    // `gh run view --log` returns an EMPTY body for some concluded runs (measured
    // 2026-08-25 on run 32856555673); the jobs-log endpoint does not.
    return ghApi(`repos/${CI_REPO}/actions/jobs/${id}/logs`);
}

export function jobLog(run) {
    const job = vitestJob(run);
    return jobLogById(job.id);
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
    const { parts, jobs, unreadable } = gateLogParts(run);
    return { log: parts.map((p) => p.log).join('\n'), jobs, unreadable,
        battery: batteryCompleteness(parts) };
}

/**
 * ⛓⛓⛓ ci-jsut-split (fidelity-9's asks (b), (c)) — **DID EACH BATTERY FINISH?**
 *
 * ⛔ Measured: from 2026-10-10 the one headless job ran past its 20-minute step
 * deadline on most runs, printed 54–68 of its 80–95 arms, and stayed green under
 * `continue-on-error` — so a missing line read as "no such line", never as "the
 * job was cut". A job that printed `## CI-PLANNED |` and no `## CI-DONE |` is
 * TRUNCATED, by name; one that finished past `HEADROOM_WARN_FRACTION` of its
 * step deadline is TIGHT. Pure: `parts` is `gateLogParts`' `{job, log}[]`.
 * A log from before the markers existed carries neither and is not judged.
 */
export function batteryCompleteness(parts) {
    const jobs = [];
    for (const { job, log } of parts) {
        const lines = strip(log).split('\n');
        const at = (mark) => lines.find((l) => l.includes(mark));
        const planned = at(CI_PLANNED_MARK);
        if (!planned) continue;
        const done = at(CI_DONE_MARK);
        const n = Number((/(\d+) arm\(s\)/.exec(planned) ?? [])[1]);
        const printed = lines.filter((l) => l.includes(CI_GATE_MARK)).length;
        const m = done ? /\| ([0-9.]+)s(?: of a (\d+)s step deadline)?/.exec(done) : null;
        const elapsedS = m ? Number(m[1]) : null;
        const deadlineS = m?.[2] ? Number(m[2]) : null;
        jobs.push({ job, planned: n, printed, done: Boolean(done), elapsedS, deadlineS,
            truncated: !done || printed < n,
            tight: Boolean(deadlineS) && elapsedS > HEADROOM_WARN_FRACTION * deadlineS });
    }
    return { jobs, truncated: jobs.filter((j) => j.truncated), tight: jobs.filter((j) => j.tight) };
}

/**
 * ⛓⛓⛓ S5b — **THE SAME LOGS, STILL SEPARATED BY JOB.** `gateLogs` joins them
 * because a reader looking for ONE key does not care which shard answered.
 *
 * ⛔ THE AUDIT DOES CARE, and that is the whole of why this exists: the
 * question *"did the partition put more work in one job than a job may hold?"*
 * is a question ABOUT the grouping, and a joined log has thrown the grouping
 * away. A caller that reconstructed shards by re-reading the plan would be
 * asking the priced field again — which is the field under test.
 *
 * @returns {{parts: {job: string, log: string}[], jobs: number, unreadable: string[]}}
 */
export function gateLogParts(run) {
    const jobs = runJobs(run);
    const parts = [];
    const unreadable = [];
    /**
     * ⛓ ci-jsut-split — the suite family prints no gate line once the gates have
     * jobs of their own (C2), and since the split it is FOUR logs, not one: read
     * them only for a run from before C2, whose gates ran inside the Vitest job.
     */
    const gatesHaveJobs = jobs.some((j) => GATE_JOB.test(j.name ?? ''));
    for (const job of jobs) {
        if (gatesHaveJobs && VITEST_JOB.test(job.name ?? '')) continue;
        /**
         * ⛓ A SKIPPED job has no log (the endpoint 404s), so it is named
         * without asking. Rule 1's guard is skipped on every branch push.
         */
        if (job.conclusion === 'skipped') {
            unreadable.push(`${job.name} (${job.status}/skipped)`);
            continue;
        }
        try {
            parts.push({ job: job.name,
                log: ghApi(`repos/${CI_REPO}/actions/jobs/${job.id}/logs`) });
        } catch {
            unreadable.push(`${job.name} (${job.status}/${job.conclusion ?? '—'})`);
        }
    }
    return { parts, jobs: jobs.length, unreadable };
}

/** ⛓ ONE spelling of the cost line `ci-gates.mjs` prints beside every arm. */
export const CI_MS_MARK = '##   ms |';
/** ⛓ …and of the note a SHARDED invocation prints about itself. */
const SHARD_NOTE_RE = /^## shard (\d+) of (\d+)\b(.*)$/;

/**
 * ⛓⛓⛓ S5b — **WHAT EACH ARM COST THE RUNNER, out of one job's log.**
 *
 * ⛔ THIS IS A DIFFERENT NUMBER FROM `parseGateLines`' AND THE DISTINCTION IS
 * THE WHOLE SLICE (trap 1068). `## CI-GATE |` carries the arm's VERDICT; this
 * carries what the arm COST on the machine that will run it again next push.
 * S4's write conflated the second with *"what it cost to ANSWER the standing
 * row"* — a network call — and the partition priced twenty-four arms at 47 s
 * of `gh` traffic. The runner's own line is the number the partition wants and
 * it has been printed on every run since S3.
 *
 * @returns {Map<string, number>} CI key -> milliseconds
 */
export function parseGateMsLines(log) {
    const out = new Map();
    for (const raw of strip(log).split('\n')) {
        const i = raw.indexOf(CI_MS_MARK);
        if (i < 0) continue;
        const [key, here] = raw.slice(i + CI_MS_MARK.length).split('|').map((p) => p.trim());
        const m = /^here=([0-9.]+)s$/.exec(here ?? '');
        if (!key || !m) continue;
        out.set(key, Math.round(Number(m[1]) * 1000));
    }
    return out;
}

/**
 * ⛓ Was this job one SLICE of a partition, and which? `ci-gates.mjs` prints
 * `## shard i of n — …` only when it was given a `--shard=`; the headless job
 * runs its whole set and prints none, so it is reported and never judged
 * against a per-shard budget it was never partitioned under.
 */
export function shardNoteIn(log) {
    for (const raw of strip(log).split('\n')) {
        const i = raw.indexOf('## shard ');
        if (i < 0) continue;
        const m = SHARD_NOTE_RE.exec(raw.slice(i));
        /** ⛓ ci-jsut-split — `; fixed count` marks a headless shard: the audit
         *  holds it to its kill deadline, never to the bin budget. */
        if (m) return { id: Number(m[1]), of: Number(m[2]), fixed: /; fixed count\b/.test(m[3]) };
    }
    return null;
}

/**
 * ⛓ One finished run, reduced to what the audit needs: per JOB, the arms it
 * actually ran and what each cost, and whether it was a shard of a partition.
 */
export function runShardCosts(run) {
    const { parts, unreadable } = gateLogParts(run);
    const jobs = parts
        .map((p) => ({ name: p.job, shard: shardNoteIn(p.log),
            arms: [...parseGateMsLines(p.log)].map(([key, ms]) => ({ key, ms })) }))
        .filter((j) => j.arms.length);
    return { jobs, unreadable };
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
    const bankKeyOf = new Map(arms.map((a) => [a.key, a.gate?.ciFace ? null : a.bankKey]));
    /** ⛓ …and the arms whose gate declares `@ci-shallow`, off the SAME roster
     *  row the bank key comes from (never a name typed here).
     *  ⛓⛓ S4c — `a.gate?`, because an identity arm HAS no gate. Neither
     *  declaration has an identity analogue: `@ci-face` says *"CI's number is
     *  a different claim"* and an identity arm runs the box's own command, and
     *  `@ci-shallow` is about the CHECKOUT while these rows' subject is
     *  generated levels. An arm with no gate therefore declares neither, which
     *  is the answer rather than a gap. */
    const shallowOf = new Map(arms.map((a) => [a.key, a.gate?.ciShallow?.reason ?? null]));
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
