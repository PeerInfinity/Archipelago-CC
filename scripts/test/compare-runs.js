#!/usr/bin/env node

/**
 * Compare two in-app test runs and print what changed.
 *
 * Answers the question that otherwise costs a stash-and-control rerun:
 * "is this red new, or was it red before my change too?" Reads the
 * per-run JSON that app.spec.js writes to test-results/in-app-tests/,
 * which survives across runs (Playwright's cleanup is scoped to
 * test-results/playwright/ — see known issue #9 in
 * CC/cloud-environment-issues.md).
 *
 * Usage:
 *   node scripts/test/compare-runs.js                 # newest two runs
 *   node scripts/test/compare-runs.js <prev> <curr>   # explicit files
 *   node scripts/test/compare-runs.js --list          # what is on disk
 *
 * Exit code is 1 when the current run has failures the previous run did
 * not, so it can gate a script; 0 otherwise.
 */

import * as fs from 'fs';
import * as path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'test-results', 'in-app-tests');
// A duration change is only worth printing if it is both a large factor
// and a large absolute move — otherwise every sub-second test is an
// "outlier" the moment the machine hiccups.
const OUTLIER_FACTOR = 2.0;
const OUTLIER_MIN_DELTA_MS = 5000;

function runFiles() {
    if (!fs.existsSync(RESULTS_DIR)) return [];
    return fs.readdirSync(RESULTS_DIR)
        .filter((f) => f.startsWith('test-results-') && f.endsWith('.json'))
        .sort()                       // ISO timestamps sort chronologically
        .map((f) => path.join(RESULTS_DIR, f));
}

function load(file) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const byId = new Map();
    for (const t of data.testDetails || []) byId.set(t.id, t);
    // `mode`/`batch`/`testIds` are absent from runs recorded before they were
    // stamped.
    return {
        file,
        mode: data.mode || null,
        batch: data.batch || null,
        testIds: data.testIds || null,
        summary: data.summary || {},
        byId,
    };
}

/**
 * Human label for a run's identity. Names the batch as well as the mode: two
 * runs of the same mode but different batches have deliberately different
 * rosters, and a warning that printed only the mode would read as though the
 * baseline matched.
 */
function identity(run) {
    return `${run.mode}${run.batch ? `/${run.batch}` : ''}`
        + `${run.testIds ? ` --test=${run.testIds}` : ''}`;
}

function label(run) {
    if (!run.mode) return 'unknown (recorded before mode stamping)';
    return `"${identity(run)}"`;
}

function describe(run) {
    const s = run.summary;
    const mode = run.mode ? `[${identity(run)}] ` : '';
    return `${mode}${path.basename(run.file)} — ${s.passedCount ?? '?'}/${s.totalRun ?? '?'} passed`;
}

/**
 * Pick the run to compare the newest one against: the most recent
 * EARLIER run of the same mode. Comparing across modes is the wrong
 * question — the rosters barely overlap, so the real signal drowns in
 * "added"/"removed" lines.
 */
function pickBaseline(files) {
    const current = load(files[files.length - 1]);
    const earlier = files.slice(0, -1).reverse().map(load);

    // Pass 1: the newest earlier run KNOWN to be the same mode AND batch AND
    // id selection. Batch must match too: a `fast` batch deliberately omits the
    // quarantined categories, so diffing it against a full run of the same mode
    // reports every quarantined test as REMOVED — the same false alarm the mode
    // stamp exists to prevent. `--test=` narrows harder still, to a roster of
    // one, and the eight solo runs of a flake triage must compare against each
    // other rather than against the full run that prompted them.
    const sameMode = earlier.find(
        (r) => r.mode && current.mode && r.mode === current.mode
            && r.batch === current.batch && r.testIds === current.testIds
    );
    if (sameMode) return { prev: sameMode, curr: current, warning: null };

    // Pass 2: nothing stamped matches. Runs recorded before mode
    // stamping carry no mode at all, so the newest earlier run is a
    // guess — usable, but say so: an unrelated mode's roster shows up as
    // wholesale added/removed lines and reads like a catastrophe.
    if (earlier.length > 0) {
        const guess = earlier[0];
        return {
            prev: guess,
            curr: current,
            warning: `baseline is ${label(guess)}, current is ${label(current)}`
                + ' — roster differences below may be spurious.',
        };
    }
    return null;
}

function main() {
    const args = process.argv.slice(2);

    if (args[0] === '--list') {
        const files = runFiles();
        if (files.length === 0) {
            console.log(`No run results in ${RESULTS_DIR}`);
            return 0;
        }
        for (const f of files) console.log(describe(load(f)));
        return 0;
    }

    let prev;
    let curr;
    if (args.length >= 2) {
        prev = load(args[0]);
        curr = load(args[1]);
    } else {
        const files = runFiles();
        if (files.length < 2) {
            console.error(
                `Need two runs to compare; found ${files.length} in ${RESULTS_DIR}.`
            );
            return 2;
        }
        const picked = pickBaseline(files);
        if (!picked) {
            const last = load(files[files.length - 1]);
            const mode = last.batch ? `${last.mode}/${last.batch}` : last.mode;
            console.error(
                `No earlier run of mode "${mode}" to compare against. `
                + 'Run that mode again, or pass two files explicitly.'
            );
            return 2;
        }
        ({ prev, curr } = picked);
        if (picked.warning) console.log(`WARNING: ${picked.warning}\n`);
    }

    console.log(`previous: ${describe(prev)}`);
    console.log(`current:  ${describe(curr)}`);
    console.log('');

    const newFailures = [];
    const fixed = [];
    const added = [];
    const removed = [];
    const slower = [];

    for (const [id, t] of curr.byId) {
        const before = prev.byId.get(id);
        if (!before) {
            added.push(`${id} (${t.status})`);
            continue;
        }
        if (t.status === 'failed' && before.status !== 'failed') {
            const conds = (t.conditions || [])
                .filter((c) => c.status === 'failed')
                .map((c) => c.description);
            newFailures.push(`${id}${conds.length ? ` — ${conds[0]}` : ''}`);
        } else if (before.status === 'failed' && t.status === 'passed') {
            fixed.push(id);
        }
        if (t.durationMs != null && before.durationMs != null) {
            const delta = t.durationMs - before.durationMs;
            if (delta > OUTLIER_MIN_DELTA_MS
                    && t.durationMs > before.durationMs * OUTLIER_FACTOR) {
                slower.push(
                    `${id}: ${(before.durationMs / 1000).toFixed(1)}s → ${(t.durationMs / 1000).toFixed(1)}s`
                );
            }
        }
    }
    for (const id of prev.byId.keys()) {
        if (!curr.byId.has(id)) removed.push(id);
    }

    const section = (title, items) => {
        if (items.length === 0) return;
        console.log(`${title} (${items.length}):`);
        for (const i of items) console.log(`  ${i}`);
        console.log('');
    };

    section('NEW FAILURES', newFailures);
    section('FIXED', fixed);
    section('ADDED (not in the previous run)', added);
    section('REMOVED (absent from this run)', removed);
    section('SLOWER', slower);

    if (newFailures.length === 0 && fixed.length === 0
            && added.length === 0 && removed.length === 0 && slower.length === 0) {
        console.log('No differences in status, roster, or duration.');
    }

    // A test that is red in BOTH runs is not a regression, but silence
    // about it would read as "all green" — say it explicitly.
    const stillFailing = [...curr.byId.values()]
        .filter((t) => t.status === 'failed' && prev.byId.get(t.id)?.status === 'failed')
        .map((t) => t.id);
    if (stillFailing.length > 0) {
        console.log(`Still failing in both runs (${stillFailing.length}): ${stillFailing.join(', ')}`);
    }

    return newFailures.length > 0 ? 1 : 0;
}

process.exit(main());
