/**
 * sweepControl — **ONE CONTROL SWEEP PER (SHA, INPUTS)** (ci-skip-rules rule 3,
 * ⚖ user 2026-10-17; `ci-skip-review` §3 R4).
 *
 * A fidelity harvest dispatches a main-control divergence sweep beside its
 * branch sweeps. The review counted ≈ 1,800 job-min in 7 days of controls
 * that repeated a sweep already run at the same SHA with the same inputs, from
 * any branch. Every sweep's title used to be *"Seedling divergence sweep
 * (manual)"*, so finding one meant scraping step logs.
 *
 * ⛓ The workflow's `run-name:` now stamps EVERY input except `shards` (a
 * partition, not a measurement). This module renders that template from the
 * workflow file ITSELF for a given set of inputs, so the finder
 * (`seedling-control-for.mjs`) compares a run's `display_title` with the exact
 * string GitHub would have rendered. ⛔ Nothing here lists the inputs: they and
 * their defaults are read off the `workflow_dispatch:` block, and a test reds
 * when an input is added without being stamped. An input left out of the stamp
 * would let a SUBSET run be quoted as a full control.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SWEEP_WORKFLOW = '.github/workflows/seedling-divergence-sweep.yml';
/** Inputs that do not change what a sweep measures. */
export const UNSTAMPED_INPUTS = Object.freeze(['shards']);

/**
 * `on.workflow_dispatch.inputs` → `{ name: { type, default } }`, read by
 * indentation (the repo carries no YAML parser; the shape is fixed).
 */
export function dispatchInputs(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^ {4}inputs:\s*$/.test(l));
    if (start < 0) throw new Error('no `workflow_dispatch.inputs:` block');
    const out = {};
    let cur = null;
    for (const l of lines.slice(start + 1)) {
        if (/^\S/.test(l) || /^ {0,4}\S/.test(l)) break;
        const name = /^ {6}([A-Za-z_][\w-]*):\s*$/.exec(l);
        if (name) { cur = out[name[1]] = { type: 'string', default: '' }; continue; }
        const kv = /^ {8}(type|default):\s*(.*)$/.exec(l);
        if (cur && kv) cur[kv[1]] = kv[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    }
    return out;
}

/** The `run-name: >-` template, folded the way YAML folds it. */
export function runNameTemplate(text) {
    const m = /^run-name: >-\n((?: {2}.*\n)+)/m.exec(text);
    if (!m) throw new Error('no folded `run-name: >-` block');
    return m[1].split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
}

/** The inputs a template stamps (`${{ inputs.<name> }}`). */
export const stampedInputs = (template) =>
    [...new Set([...template.matchAll(/\$\{\{\s*inputs\.([\w-]+)\s*\}\}/g)].map((m) => m[1]))];

/**
 * Render the template as GitHub would: a boolean as `true`/`false`, a number
 * as written, an empty string as nothing. Only plain `${{ inputs.x }}`
 * expressions are supported, and anything else is refused by name, so a
 * template edit cannot silently render differently here than on GitHub.
 */
export function renderRunName(template, inputs) {
    const rest = template.replace(/\$\{\{\s*inputs\.[\w-]+\s*\}\}/g, '');
    if (rest.includes('${{')) {
        throw new Error('run-name uses an expression other than `${{ inputs.<name> }}` — '
            + 'teach renderRunName it before trusting a match');
    }
    return template.replace(/\$\{\{\s*inputs\.([\w-]+)\s*\}\}/g, (_, k) => {
        if (!(k in inputs)) throw new Error(`run-name stamps input ${k}, which has no value`);
        return String(inputs[k]);
    });
}

/**
 * The full input set for a dispatch: the workflow's defaults overlaid with
 * `given`. An unknown input is refused by name (a typo would otherwise
 * render as a default and quote a run measured under different inputs).
 */
export function resolveInputs(text, given) {
    const declared = dispatchInputs(text);
    const unknown = Object.keys(given).filter((k) => !(k in declared));
    if (unknown.length) {
        throw new Error(`unknown input(s) ${unknown.join(', ')} — the sweep declares `
            + `${Object.keys(declared).join(', ')}`);
    }
    const out = {};
    for (const [k, d] of Object.entries(declared)) {
        let v = k in given ? given[k] : d.default;
        if (d.type === 'boolean') v = String(v) === 'true';
        out[k] = v;
    }
    return out;
}

export function readSweepWorkflow(repo) {
    return readFileSync(join(repo, SWEEP_WORKFLOW), 'utf8');
}
