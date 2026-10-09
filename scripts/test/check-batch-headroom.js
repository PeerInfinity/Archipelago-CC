#!/usr/bin/env node

/**
 * Budget headroom for the in-app test batches.
 *
 * The in-app runner races a whole batch against one wall-clock budget
 * (AUTO_START_TIMEOUT_MS, frontend/modules/tests/testLogic.js). A batch that
 * creeps up on that budget fails as a tail of NEVER STARTED rows — which is how
 * `fast` went red on main (2026-10-09) without any single row being slow. This
 * check reads the newest results file of a batch and grades its measured span:
 *
 *   - FAIL (exit 1) when the run reports NEVER STARTED or CUT OFF rows, timed
 *     out, or its measured span exceeds the budget;
 *   - WARN (exit 0, a `::warning::` annotation on CI) when the span passes
 *     HEADROOM_WARN_FRACTION of the budget — time to split the batch, before
 *     it starts dropping its tail;
 *   - OK otherwise.
 *
 * Usage:
 *   node scripts/test/check-batch-headroom.js --mode=test-substrates --batch=fast
 *   node scripts/test/check-batch-headroom.js --mode=test-substrates   # newest run of EVERY batch
 *   node scripts/test/check-batch-headroom.js --file=<results.json>
 *
 * Exit 2 when no matching results file exists (a check that found nothing to
 * grade must not read as green).
 *
 * Reads the same files as compare-runs.js: test-results/in-app-tests/ under
 * the cwd, stamped with mode, batch, testIds, flavour and (when overridden)
 * budgetMs by test_json/e2e/app.spec.js.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/** Warn once a batch's measured span passes this fraction of its budget. */
export const HEADROOM_WARN_FRACTION = 0.7;

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEST_LOGIC = path.join(REPO, 'frontend', 'modules', 'tests', 'testLogic.js');

/**
 * testLogic.js's AUTO_START_TIMEOUT_MS, read off its source: that module
 * imports the browser state manager, so node cannot import it here.
 * check-batch-headroom.test.js pins this against the imported constant.
 */
export function defaultBudgetMs(source = fs.readFileSync(TEST_LOGIC, 'utf8')) {
    const m = /export const AUTO_START_TIMEOUT_MS = (\d+);/.exec(source);
    if (!m) throw new Error(`check-batch-headroom: AUTO_START_TIMEOUT_MS not found in ${TEST_LOGIC}`);
    return Number(m[1]);
}

const TERMINAL = new Set(['passed', 'failed']);

/**
 * Grade one results payload. Returns
 * { verdict: 'ok'|'warn'|'fail', spanMs, budgetMs, reasons: string[] }.
 *
 * The span is first row start → last row end: what the in-app budget times
 * (the gaps between rows count against it too, so a sum of durations would
 * understate it).
 */
export function assessRun(data, budgetFallbackMs) {
    const summary = data.summary || {};
    const rows = data.testDetails || [];
    const budgetMs = data.budgetMs || summary.timeoutMs || budgetFallbackMs;
    const reasons = [];

    const notRun = summary.notRunIds || [];
    const cutOff = rows.filter((t) => t.status && !TERMINAL.has(t.status) && t.startTime)
        .map((t) => t.id);
    const neverStarted = notRun.filter((id) => !cutOff.includes(id));
    if (cutOff.length) reasons.push(`CUT OFF mid-test: ${cutOff.join(', ')}`);
    if (neverStarted.length) reasons.push(`NEVER STARTED (${neverStarted.length}): ${neverStarted.join(', ')}`);
    if (summary.timedOut) reasons.push(`timed out: ${summary.error || `budget ${budgetMs} ms`}`);

    const starts = rows.map((t) => Date.parse(t.startTime)).filter(Number.isFinite);
    const ends = rows.map((t) => Date.parse(t.endTime)).filter(Number.isFinite);
    const spanMs = starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : 0;
    const pct = Math.round((spanMs / budgetMs) * 100);
    if (spanMs > budgetMs) reasons.push(`span ${fmt(spanMs)} exceeds the budget ${fmt(budgetMs)} (${pct}%)`);

    let verdict = reasons.length ? 'fail' : 'ok';
    if (verdict === 'ok' && spanMs > HEADROOM_WARN_FRACTION * budgetMs) {
        verdict = 'warn';
        reasons.push(`span ${fmt(spanMs)} is ${pct}% of the budget ${fmt(budgetMs)} `
            + `(warn above ${Math.round(HEADROOM_WARN_FRACTION * 100)}%) — split the batch before it drops its tail`);
    }
    return { verdict, spanMs, budgetMs, reasons };
}

function fmt(ms) {
    return `${(ms / 1000).toFixed(1)} s`;
}

function parseArgs(argv) {
    const out = {};
    for (const a of argv) {
        const m = /^--([a-z]+)=(.*)$/.exec(a);
        if (!m) throw new Error(`check-batch-headroom: unknown argument '${a}'`);
        out[m[1]] = m[2];
    }
    return out;
}

/**
 * The newest results file per batch (mode + flavour matching), skipping
 * `--test=` solo runs: their roster is not the batch's.
 */
function newestPerBatch(dir, { mode, batch, flavour }) {
    if (!fs.existsSync(dir)) return new Map();
    const newest = new Map();
    const files = fs.readdirSync(dir)
        .filter((f) => f.startsWith('test-results-') && f.endsWith('.json'))
        .sort();
    for (const f of files) {
        const file = path.join(dir, f);
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (mode && data.mode !== mode) continue;
        if ((data.flavour || 'unbundled') !== flavour) continue;
        if (data.testIds) continue;
        const b = data.batch || null;
        if (batch && b !== batch) continue;
        newest.set(b, { file, data });
    }
    return newest;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const fallback = defaultBudgetMs();
    let runs;
    if (args.file) {
        runs = new Map([['(file)', { file: args.file, data: JSON.parse(fs.readFileSync(args.file, 'utf8')) }]]);
    } else {
        runs = newestPerBatch(path.join(process.cwd(), 'test-results', 'in-app-tests'), {
            mode: args.mode, batch: args.batch, flavour: args.flavour || 'unbundled',
        });
    }
    if (runs.size === 0) {
        console.error('check-batch-headroom: no matching results file — nothing graded '
            + `(mode=${args.mode || 'any'} batch=${args.batch || 'any'})`);
        process.exit(2);
    }
    const onCi = Boolean(process.env.GITHUB_ACTIONS);
    let failed = false;
    for (const [batch, { file, data }] of runs) {
        const r = assessRun(data, fallback);
        const label = `${data.mode || '?'}/${batch ?? '(whole roster)'}`;
        const head = `HEADROOM ${r.verdict.toUpperCase()} ${label}: ${fmt(r.spanMs)} of ${fmt(r.budgetMs)} `
            + `(${Math.round((r.spanMs / r.budgetMs) * 100)}%) — ${path.basename(file)}`;
        console.log(head);
        for (const reason of r.reasons) console.log(`  - ${reason}`);
        if (onCi && r.verdict !== 'ok') {
            console.log(`::${r.verdict === 'fail' ? 'error' : 'warning'}::${head}: ${r.reasons.join('; ')}`);
        }
        if (r.verdict === 'fail') failed = true;
    }
    process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
