/**
 * ciPathFilter — **WHEN A PATH-FILTERED CI ARM IS OWED A RUN** (ci-manual-moves,
 * ⚖ user 2026-10-21; js-7's conditions for `gate: seedling-wasm-ship`).
 *
 * A gate that declares `@ci-paths <glob> …` (`gateRoster.ciPathsIn`) gets its
 * own shard in `ciGatePlanFor`, and the plan job puts that shard in the matrix
 * only when a pushed path hits its filter — or always, on a dispatch. The
 * filter is the UNION of two halves:
 *
 *   declared  the gate's `@ci-paths` globs: the trees its subject lives in
 *             (submodules, the shipped page's module dirs, the workflow).
 *   derived   the input-key populations (`rowInputKey.inputPopulations`:
 *             code, data, spawn, build) of the gate AND of every repo script
 *             the CI job that runs it invokes — read off the job's own `run:`
 *             lines in the workflow, never typed. ⛔ The same populations that
 *             decide whether the box re-measures the row (⚖ 71 (a)), so CI and
 *             the box agree on what "this gate's inputs moved" means.
 *
 * ⛔ FAIL-OPEN, like every skip rule in the workflow: an unreadable change
 * list, a truncated one, or a crash here runs the arm.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO } from './gateRoster.js';
import { inputPopulations, keyContext, keyInputsIn } from './rowInputKey.js';

export const JSUT_WORKFLOW = '.github/workflows/unittests_frontend.yml';
/** The job a browser-set path shard runs in — the browser-gates matrix. */
export const PATH_SHARD_JOB = 'browser-gates';

/**
 * The repo paths a workflow job's steps name (`node scripts/x.mjs`, `-r
 * scripts/y.txt`), read off the job's block of the workflow file. ⛔ A job
 * that is not found is an ERROR, never an empty list: an empty list would
 * shrink the filter silently.
 */
export function jobScripts({ repo = REPO, workflow = JSUT_WORKFLOW, job = PATH_SHARD_JOB } = {}) {
    const lines = readFileSync(join(repo, workflow), 'utf8').split('\n');
    const start = lines.findIndex((l) => l === `  ${job}:`);
    if (start < 0) throw new Error(`ciPathFilter: no job ${JSON.stringify(job)} in ${workflow}`);
    let end = lines.findIndex((l, i) => i > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l));
    if (end < 0) end = lines.length;
    const out = new Set();
    for (const l of lines.slice(start, end)) {
        if (/^\s*#/.test(l)) continue;
        for (const m of l.matchAll(/(?:^|[\s'"=])(scripts\/[A-Za-z0-9_./-]+\.(?:mjs|js|txt|py|sh))\b/g)) {
            out.add(m[1]);
        }
    }
    return [...out].sort();
}

/**
 * A filter from declared globs plus the derived input populations (code,
 * data, spawn, build) of `entries`. ⛔ Each entry is itself in the filter.
 */
export function closureFilter({ declared, entries, repo = REPO, ctx = null }) {
    const c = ctx ?? keyContext({ repo });
    const derived = new Set(entries);
    for (const entry of entries.filter((e) => /\.m?js$/.test(e))) {
        const decl = keyInputsIn(readFileSync(join(repo, entry), 'utf8'), { file: entry });
        const pops = inputPopulations({ entry, declared: decl, ctx: c });
        for (const k of ['code', 'data', 'spawn', 'build']) for (const p of pops[k]) derived.add(p);
    }
    return { declared: [...declared], derived: [...derived].sort(), entries: [...entries] };
}

/**
 * The filter for one gate: its `@ci-paths` globs, and the closure of the gate
 * plus the workflow and every script the job that runs it invokes.
 */
export function ciPathFilterFor({ gate, repo = REPO, ctx = null, workflow = JSUT_WORKFLOW,
    job = PATH_SHARD_JOB } = {}) {
    if (!gate?.ciPaths) throw new Error(`ciPathFilter: ${gate?.file ?? '(no gate)'} declares no @ci-paths`);
    const entries = [...new Set([gate.path, workflow, ...jobScripts({ repo, workflow, job })])];
    return closureFilter({ declared: gate.ciPaths.globs, entries, repo, ctx });
}

/** A `@ci-paths` glob as a RegExp: `**` any depth, `*` one segment, and a
 *  glob with no wildcard is the path itself or anything under it. */
export function globRe(glob) {
    if (!/[*?]/.test(glob)) {
        const lit = glob.replace(/\/+$/, '').replace(/[.+^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${lit}(?:/.*)?$`);
    }
    let re = '';
    for (let i = 0; i < glob.length; i += 1) {
        const ch = glob[i];
        if (ch === '*' && glob[i + 1] === '*') {
            /** `dir/**` also matches `dir` itself — a gitlink is a path, not a tree. */
            if (re.endsWith('/') && i + 2 === glob.length) { re = `${re.slice(0, -1)}(?:/.*)?`; i += 1; continue; }
            re += '.*'; i += 1;
        } else if (ch === '*') re += '[^/]*';
        else if (ch === '?') re += '[^/]';
        else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
}

/**
 * Which changed paths hit the filter. ⛔ A derived member that is a DIRECTORY
 * (a submodule in `build`) matches anything under it, like a literal glob.
 */
export function pathFilterHits({ filter, changed }) {
    const res = [...filter.declared, ...filter.derived].map(globRe);
    return changed.map((p) => p.trim()).filter(Boolean).filter((p) => res.some((re) => re.test(p)));
}
