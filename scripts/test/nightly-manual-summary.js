#!/usr/bin/env node
/**
 * nightly-manual-summary.js — the morning read of the NIGHTLY manual-batch run
 * (.github/workflows/test-substrates-nightly.yml; ⚖ Robert 2026-11-11, option C:
 * "one nightly test-substrates-manual run with batch all at main … a SIGNAL only,
 * never landing evidence").
 *
 * Reads what the nightly's summary job downloaded and fetched:
 *   <artifacts>/test-results-<batch>/test-results/in-app-tests/*.json
 *       each batch job's uploaded results (the newest unbundled, non-solo file
 *       of that batch is the one graded — the same pick check-batch-headroom.js makes);
 *   <jobs.json>  (optional) `gh api …/actions/runs/<id>/jobs` — each batch job's
 *       conclusion, so a job that went red with every row green (an in-app
 *       handler error, a cancelled cap) or died before writing results still
 *       reads red.
 * and writes:
 *   - markdown for $GITHUB_STEP_SUMMARY: one row per batch — PASSED/total,
 *     failing rows, NEVER STARTED / CUT OFF, the headroom verdict, the job;
 *   - nightly-manual-summary.json, the machine-readable form a planner reads
 *     in the morning: { runId, sha, ref, red, batches: { <batch>: {...} } }.
 *
 * It also folds in the `seedling-checks` job (⚖ Robert 2026-11-17, "Train tier +
 * nightly": the wallflyer no-hit cross-check and the Seedling map extractor's
 * --check, run as their *.train.test.js files) off the same jobs.json: its
 * conclusion becomes `checks` in the JSON and one line under the table.
 *
 * Exit 1 when any batch is red, or the checks job concluded other than success, so the nightly run itself reads red in the
 * Actions list; exit 0 otherwise.
 *
 * Usage:
 *   node scripts/test/nightly-manual-summary.js --artifacts=<dir> --batches='["a","b"]' \
 *     [--jobs=<jobs.json>] [--run-id=<id>] [--sha=<sha>] [--ref=<ref>] \
 *     [--out=nightly-manual-summary.json] [--md=<file>]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessRun, defaultBudgetMs, unfinishedRows } from './check-batch-headroom.js';

const MODE = 'test-substrates';
/** The job name test-substrates-manual.yml gives a batch job (a caller prefixes "<job> / "). */
const JOB_NAME = /Substrate tests — (\S+) batch/;
/** The nightly's train-checks job (test-substrates-nightly.yml `seedling-checks`; rename both together). */
export const CHECKS_JOB_NAME = 'Seedling train checks';

/** The newest graded results file of one batch inside its artifact, or null. */
export function newestResults(artifactsDir, batch) {
    const dir = path.join(artifactsDir, `test-results-${batch}`, 'test-results', 'in-app-tests');
    if (!existsSync(dir)) return null;
    let pick = null;
    for (const f of readdirSync(dir).filter((n) => n.startsWith('test-results-') && n.endsWith('.json')).sort()) {
        const data = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
        if (data.mode !== MODE || (data.flavour || 'unbundled') !== 'unbundled' || data.testIds) continue;
        if (data.batch !== batch) continue;
        pick = { file: f, data };
    }
    return pick;
}

/** batch → the conclusion of its job, off a `gh api …/jobs` payload. */
export function jobConclusions(jobsPayload) {
    const out = {};
    for (const j of (jobsPayload && jobsPayload.jobs) || []) {
        const m = JOB_NAME.exec(j.name || '');
        if (m) out[m[1]] = j.conclusion || j.status || 'unknown';
    }
    return out;
}

/**
 * The train-checks job's entry off a `gh api …/jobs` payload. With no payload it is
 * ungraded (null conclusion, not red: the batches' rule for a missing jobs.json). A job
 * absent from a payload that HAS jobs is red: the nightly always runs it.
 */
export function checksEntry(jobsPayload) {
    if (!jobsPayload) return { job: CHECKS_JOB_NAME, conclusion: null, red: false, reason: 'not graded: the job list could not be read' };
    const j = ((jobsPayload && jobsPayload.jobs) || []).find((x) => (x.name || '') === CHECKS_JOB_NAME);
    if (!j) return { job: CHECKS_JOB_NAME, conclusion: 'missing', red: true, reason: `no '${CHECKS_JOB_NAME}' job in this run` };
    const conclusion = j.conclusion || j.status || 'unknown';
    return { job: CHECKS_JOB_NAME, conclusion, red: conclusion !== 'success', reason: null };
}

/** One batch's entry: the counts, the failing/unfinished rows, the headroom verdict, red or not. */
export function summarizeBatch(batch, picked, jobConclusion, budgetFallbackMs) {
    const entry = { batch, job: jobConclusion || null };
    if (!picked) {
        return { ...entry, result: 'no-results', red: true, passed: 0, total: 0, failing: [], neverStarted: [], cutOff: [], headroom: null, reasons: ['no results file — the job died before the in-app run wrote one'] };
    }
    const { data, file } = picked;
    const s = data.summary || {};
    const rows = data.testDetails || [];
    const { neverStarted, cutOff } = unfinishedRows(data);
    const failing = rows.filter((t) => t.status === 'failed').map((t) => t.id);
    const passed = s.passedCount ?? rows.filter((t) => t.status === 'passed').length;
    const total = s.enabledCount ?? (rows.length + neverStarted.length);
    const h = assessRun(data, budgetFallbackMs);
    const jobRed = jobConclusion != null && jobConclusion !== 'success';
    const red = failing.length > 0 || h.verdict === 'fail' || jobRed;
    return {
        ...entry, file, result: red ? 'red' : 'green', red, passed, total, failing, neverStarted, cutOff,
        headroom: { verdict: h.verdict, spanMs: h.spanMs, budgetMs: h.budgetMs }, reasons: h.reasons,
        frozen: data.frozen?.head || null,
    };
}

export function buildSummary({ batches, artifactsDir, jobs, runId, sha, ref, budgetFallbackMs }) {
    const conclusions = jobConclusions(jobs);
    const out = {};
    for (const b of batches) out[b] = summarizeBatch(b, newestResults(artifactsDir, b), conclusions[b], budgetFallbackMs);
    const checks = checksEntry(jobs);
    return {
        kind: 'nightly-manual-summary', signalOnly: true, runId: runId || null, sha: sha || null, ref: ref || null,
        red: Object.values(out).some((e) => e.red) || checks.red, redBatches: Object.values(out).filter((e) => e.red).map((e) => e.batch),
        checks,
        batches: out,
    };
}

const cap = (ids) => (ids.length > 6 ? `${ids.slice(0, 6).join(', ')} … (+${ids.length - 6})` : ids.join(', '));

export function formatMarkdown(summary) {
    const redNames = [...summary.redBatches, ...(summary.checks?.red ? ['train checks'] : [])];
    const c = summary.checks;
    const lines = [
        `## Nightly manual batches — ${summary.red ? `🔴 RED (${redNames.join(', ')})` : '🟢 green'}`,
        '',
        `Run ${summary.runId ?? '?'} at \`${(summary.sha || '?').slice(0, 10)}\` (${summary.ref ?? '?'}). `
            + '⚖ A SIGNAL only — never landing evidence for any SHA (README § the nightly).',
        '',
        '| Batch | Result | Passed / total | Failing | Never started / cut off | Headroom | Job |',
        '|---|---|---|---|---|---|---|',
    ];
    for (const e of Object.values(summary.batches)) {
        const h = e.headroom ? `${e.headroom.verdict.toUpperCase()} ${(e.headroom.spanMs / 1000).toFixed(0)} s / ${(e.headroom.budgetMs / 1000).toFixed(0)} s` : '—';
        const unfinished = [e.neverStarted.length ? `NEVER STARTED ${e.neverStarted.length}` : '', e.cutOff.length ? `CUT OFF ${cap(e.cutOff)}` : '']
            .filter(Boolean).join('; ') || '0';
        lines.push(`| ${e.batch} | ${e.red ? '🔴' : '🟢'} ${e.result} | ${e.passed}/${e.total} | ${cap(e.failing) || '—'} | ${unfinished} | ${h} | ${e.job ?? '?'} |`);
    }
    if (c) {
        lines.push('', `**${c.job}** (wallflyer no-hit cross-check + seedling-map extractor --check): `
            + `${c.red ? '🔴' : c.conclusion ? '🟢' : '⚪'} ${c.conclusion ?? 'not graded'}${c.reason ? ` — ${c.reason}` : ''}`
            + (c.red ? ' — the failing check and its disagreeing crossing / differing field are in that job\'s log.' : ''));
    }
    const notes = Object.values(summary.batches).filter((e) => e.reasons.length);
    if (notes.length) {
        lines.push('', '### Notes');
        for (const e of notes) for (const r of e.reasons) lines.push(`- **${e.batch}**: ${r}`);
    }
    return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
    const out = {};
    for (const a of argv) {
        const m = /^--([a-z-]+)=(.*)$/s.exec(a);
        if (!m) throw new Error(`nightly-manual-summary: unknown argument '${a}'`);
        out[m[1]] = m[2];
    }
    return out;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.artifacts || !args.batches) throw new Error('nightly-manual-summary: --artifacts and --batches are required');
    const jobs = args.jobs && existsSync(args.jobs) ? JSON.parse(readFileSync(args.jobs, 'utf8')) : null;
    const summary = buildSummary({
        batches: JSON.parse(args.batches), artifactsDir: args.artifacts, jobs,
        runId: args['run-id'], sha: args.sha, ref: args.ref, budgetFallbackMs: defaultBudgetMs(),
    });
    writeFileSync(args.out || 'nightly-manual-summary.json', `${JSON.stringify(summary, null, 2)}\n`);
    const md = formatMarkdown(summary);
    if (args.md) appendFileSync(args.md, md);
    process.stdout.write(md);
    process.exit(summary.red ? 1 : 0);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
