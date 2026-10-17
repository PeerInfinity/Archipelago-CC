#!/usr/bin/env node
/**
 * seedling-control-for — **IS THERE ALREADY A GREEN DIVERGENCE SWEEP AT THIS
 * SHA WITH THESE INPUTS?** (ci-skip-rules rule 3, ⚖ user 2026-10-17)
 *
 *   node scripts/procgen/seedling-control-for.mjs <sha> [--<input>=<value> …] [--json]
 *
 * Ask before dispatching a main-control sweep (or a branch sweep of a SHA that
 * may already have been swept). The inputs are the sweep's `workflow_dispatch`
 * inputs, spelt as in the workflow (`--contact_fidelity=all`,
 * `--capture_requests=true`); any input not given takes the workflow's
 * default, exactly as a dispatch would. `--shards=` is accepted and ignored
 * (a partition, not a measurement).
 *
 * It renders the workflow's own `run-name:` for those inputs (`sweepControl.js`)
 * and compares it with the title of every SUCCESSFUL sweep run at the SHA, from
 * any branch. ⛔ An exact match only: a title GitHub truncated cannot equal the
 * full rendering, so truncation can only make this miss, never quote the wrong
 * run. Runs dispatched before rule 3 carry the old fixed title and never match.
 *
 * Exit codes: 0 a run matches (its id and URL are printed: QUOTE IT, do not
 * dispatch) · 1 none does (dispatch) · 2 the question could not be put (an
 * unknown input, an unresolvable SHA, an API error).
 */

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { CI_REPO } from './ciSummary.js';
import {
    SWEEP_WORKFLOW, UNSTAMPED_INPUTS, readSweepWorkflow, renderRunName, resolveInputs,
    runNameTemplate,
} from './sweepControl.js';

argvHelp(import.meta.url);
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** ⛓ Inert on a bare import (`check-procgen-help`'s import door): all work is here. */
function main() {
    const args = process.argv.slice(2);
    const json = args.includes('--json');
    const fail = (msg) => { console.error(`REFUSED: ${msg}`); process.exit(2); };

    const shaArg = args.find((a) => !a.startsWith('--'));
    if (!shaArg) fail('name the SHA: seedling-control-for.mjs <sha> [--<input>=<value> …]');
    let sha;
    try {
        sha = execFileSync('git', ['rev-parse', '--verify', '--quiet', `${shaArg}^{commit}`],
            { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { /* below */ }
    if (!sha) fail(`${shaArg} is not a commit in this clone (fetch it first)`);

    const given = {};
    for (const a of args.filter((x) => x.startsWith('--') && x !== '--json')) {
        const m = /^--([\w-]+)=(.*)$/s.exec(a);
        if (!m) fail(`${a}: inputs are --<input>=<value>`);
        if (!UNSTAMPED_INPUTS.includes(m[1])) given[m[1]] = m[2];
    }

    const text = readSweepWorkflow(REPO);
    let want;
    try {
        const inputs = resolveInputs(text, given);
        for (const k of UNSTAMPED_INPUTS) delete inputs[k];
        want = renderRunName(runNameTemplate(text), inputs);
    } catch (e) { fail(e.message); }

    const workflow = SWEEP_WORKFLOW.split('/').pop();
    let runs;
    try {
        runs = JSON.parse(execFileSync('gh', ['api',
            `repos/${CI_REPO}/actions/workflows/${workflow}/runs?head_sha=${sha}&status=success&per_page=50`],
        { encoding: 'utf8', maxBuffer: 1 << 26 })).workflow_runs;
    } catch (e) { fail(`the run listing failed: ${e.message.split('\n')[0]}`); }

    const hit = runs.find((r) => r.display_title === want) ?? null;
    if (json) {
        console.log(JSON.stringify({ sha, want, run: hit && { id: hit.id, branch: hit.head_branch,
            url: hit.html_url, createdAt: hit.created_at }, greenAtSha: runs.length }, null, 2));
    } else if (hit) {
        console.log(`QUOTE run ${hit.id} (${hit.head_branch}, ${hit.created_at}) — a green sweep at `
            + `${sha.slice(0, 10)} with these inputs: ${hit.html_url}`);
    } else {
        console.log(`DISPATCH — none of the ${runs.length} green sweep run(s) at ${sha.slice(0, 10)} `
            + `is titled\n  ${want}`);
    }
    process.exit(hit ? 0 : 1);
}

if (isEntryPoint(import.meta.url)) main();
