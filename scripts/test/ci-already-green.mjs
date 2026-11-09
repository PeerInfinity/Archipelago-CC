#!/usr/bin/env node
/**
 * ci-already-green.mjs — the `Same SHA already green?` job of unittests_frontend.yml.
 *
 *   SHA=<sha> RUN_ID=<id> node scripts/test/ci-already-green.mjs
 *   node scripts/test/ci-already-green.mjs --sha=<sha> [--run-id=<id>]
 *
 * Prints `green=` and `train_green=`, and appends them to $GITHUB_OUTPUT when that is
 * set. The rule is `ciSummary.decideAlreadyGreen`. FAIL-OPEN: any error answers
 * false, so the suite runs. Needs `gh` and no npm dependency (the job runs no npm ci).
 */
import { appendFileSync } from 'node:fs';

import { decideAlreadyGreen, runJobs, runsAtSha } from '../procgen/ciSummary.js';

const flag = (name) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const sha = flag('sha') ?? process.env.SHA;
const runId = flag('run-id') ?? process.env.RUN_ID;

function answer(green, trainGreen) {
    const text = `green=${green}\ntrain_green=${trainGreen}\n`;
    process.stdout.write(text);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
}

try {
    const cache = new Map();
    const jobsOf = (run) => {
        if (!cache.has(run.databaseId)) cache.set(run.databaseId, runJobs(run));
        return cache.get(run.databaseId);
    };
    const d = decideAlreadyGreen(runsAtSha(sha), jobsOf, { runId });
    const label = (r) => `run ${r.databaseId} (${r.event} on ${r.headBranch})`;
    for (const p of d.passedOver) console.log(`MEASURED: passed over ${label(p.run)}: ${p.why}`);
    if (d.green) {
        console.log(`MEASURED: ${label(d.suiteRun)} passed the suite at ${sha}: the suite and gates are SKIPPED here`);
        console.log(d.trainGreen
            ? `MEASURED: ${label(d.trainRun)} passed every train shard at ${sha}: the train tier is SKIPPED here`
            : `MEASURED: no earlier run passed every train shard at ${sha}: the train tier RUNS here`);
    } else {
        console.log(`MEASURED: no earlier run at ${sha} ran and passed its suite: the suite runs`);
    }
    answer(d.green, d.trainGreen);
} catch (e) {
    console.log(`::warning title=already-green guard::could not read the runs at ${sha}, so the suite runs (fail-open): ${e.message}`);
    answer(false, false);
}
