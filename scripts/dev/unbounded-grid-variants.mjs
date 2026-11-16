#!/usr/bin/env node
/**
 * unbounded-grid-variants — regenerate the committed generated presets twice, OUTSIDE the tree:
 * once as committed (the control; must be byte-equal to the committed file) and once with the
 * box made "effectively unbounded" through the generators' EXISTING inputs only (no product
 * edit): a square box of side 2N+1 (N = the source's region count, or the world's region count),
 * so the start (the box centre) is N cells from every edge and BFS adjacency can never leave it.
 *
 * Survey `unbounded-grid-survey` (2026-11-15), report `CC/docs/region-map/unbounded-grid-survey.md`.
 *
 *   node scripts/dev/unbounded-grid-variants.mjs <outDir> [--only=td,maze]
 *
 * Drivers covered and the input used for "huge":
 *   - top-down (procgen_topdown AP_1..12): the recipe lines of scripts/utils/generated_commands.sh
 *     (`generate-topdown-preset.js`), plus `--min-grid-dim 2N+1`.
 *   - grid growth (procgen_maze AP_1..3): its recipe lines (`generate-procgen-rules.js`), with
 *     `--grid-width/--grid-height` replaced by 2R+1, R = the committed world's region count
 *     (growth stops on pool-empty, so R bounds the BFS depth).
 *   - sphere growth: not measurable without a product edit (see the `sphere` note at the bottom).
 * Writes <outDir>/<id>_ctl.json, <id>_huge.json and summary.json.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = process.argv[2];
if (!out || out.startsWith('--')) { console.error('usage: unbounded-grid-variants.mjs <outDir> [--only=td,maze]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const only = new Set((process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'td,maze,sphere').split(','));
const recipe = readFileSync(join(REPO, 'scripts/utils/generated_commands.sh'), 'utf8').split('\n');
const summary = [];

function block(heading) {
    const i = recipe.findIndex((l) => l.trim() === heading);
    const rows = [];
    for (const l of recipe.slice(i + 1)) { if (l.startsWith('# =====')) break; if (l.startsWith('node ')) rows.push(l.trim().split(/\s+/).slice(1)); }
    return rows;
}
function run(args, tag) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' });
    const ms = Date.now() - t0;
    writeFileSync(join(out, `${tag}.log`), r.stdout + r.stderr);
    return { status: r.status, ms, log: r.stdout + r.stderr };
}
function setOut(args, path) { const a = [...args]; a[a.indexOf('--out') + 1] = path; return a; }
function cmpCommitted(path, committed) {
    return existsSync(committed) && readFileSync(path).equals(readFileSync(join(REPO, committed)));
}

if (only.has('td')) {
    for (const args of block('# ===== Generating procgen_topdown presets =====')) {
        const n = /AP_(\d+)_rules\.json$/.exec(args[args.indexOf('--out') + 1])[1];
        const src = JSON.parse(readFileSync(join(REPO, args[args.indexOf('--source-rules') + 1]), 'utf8'));
        const N = Object.keys(src.regions['1']).length;
        const id = `td${n}`;
        const c = run(setOut(args, join(out, `${id}_ctl.json`)), `${id}_ctl`);
        const h = run([...setOut(args, join(out, `${id}_huge.json`)), '--min-grid-dim', String(2 * N + 1)], `${id}_huge`);
        const committed = `frontend/presets/procgen_topdown/AP_${n}/AP_${n}_rules.json`;
        const row = { id, committed, sourceRegions: N, huge: 2 * N + 1, ctlStatus: c.status, hugeStatus: h.status,
            ctlMs: c.ms, hugeMs: h.ms, ctlByteEqual: c.status === 0 && cmpCommitted(join(out, `${id}_ctl.json`), committed),
            hugeAttempt: (h.log.match(/attempt \d+:.*$/gm) ?? []).pop() ?? null };
        summary.push(row); console.log(JSON.stringify(row));
    }
}

if (only.has('maze')) {
    for (const args of block('# ===== Generating procgen_maze presets =====')) {
        const n = /AP_(\d+)_rules\.json$/.exec(args[args.indexOf('--out') + 1])[1];
        const committed = `frontend/presets/procgen_maze/AP_${n}/AP_${n}_rules.json`;
        const R = JSON.parse(readFileSync(join(REPO, committed), 'utf8')).procgen_metadata['1'].region_count;
        const id = `maze${n}`;
        const c = run(setOut(args, join(out, `${id}_ctl.json`)), `${id}_ctl`);
        const huge = setOut(args, join(out, `${id}_huge.json`));
        huge[huge.indexOf('--grid-width') + 1] = String(2 * R + 1);
        huge[huge.indexOf('--grid-height') + 1] = String(2 * R + 1);
        const h = run(huge, `${id}_huge`);
        const row = { id, committed, regions: R, huge: 2 * R + 1, ctlStatus: c.status, hugeStatus: h.status,
            ctlMs: c.ms, hugeMs: h.ms, ctlByteEqual: c.status === 0 && cmpCommitted(join(out, `${id}_ctl.json`), committed) };
        summary.push(row); console.log(JSON.stringify(row));
    }
}

// Sphere growth: NOT measurable without a product edit. Both sphere paths size their own box and
// read no input for it: the step runner the panel and every preset use
// (`sphereSteps.js` `gridSizeFor`, re-derived at ③ grow from the allocation, so even a
// hand-set `env.dims` is overwritten) and the all-in-one `growSpheresGen` (its `growthParams.gridDims`
// IS honoured, but no preset path reaches that function). The smallest edit that would allow it is in
// the report (§2). Measured instead: the committed sphere presets carry 0 box-forced teleporters.
if (only.has('sphere')) console.log('sphere: skipped — no input reaches sphereSteps.gridSizeFor (see the report §2)');

writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
