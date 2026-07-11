#!/usr/bin/env node
/**
 * Phase 5e §4.2 measurement pass: Pass-B convergence over a batch of
 * GENERATED synthetic datasets × fill seeds.
 *
 * The jta-synthetic-data plan's §4.2 table stages the "what else needs
 * balancing" investigation as measurements first, levers only when a
 * failure mode demands one. The instrument is the Pass-B convergence
 * report the walk already emits; this driver runs it over a small batch
 * and aggregates the trigger signals the table names:
 *
 *   - xp_mult co-solve trigger — stalls / saturated solves on MILESTONES
 *     (estimator inversion out of cost_multiplier range because the skill
 *     cannot be trained in time);
 *   - economy scaling trigger — systematic saturation (every task at min
 *     cost) or starvation (max cost) per zone band.
 *
 * Per (datasetSeed, fillSeed) pair:
 *   1. verify-jta-locations-roundtrip.mjs   JTA_RT_DATASET=1
 *      JTA_RT_DATASET_SEED=<ds> JTA_RT_SEED=<fill>  -> exported rules.json
 *   2. verify-jta-balance-pass.mjs          JTA_BP_REPORT -> bp-ds<ds>-f<fill>.json
 *
 * This is deliberately steps 1-2 of sweep-ap-seeds.mjs only: the emergent
 * free-automation replay of the solved worlds is Phase 5f, not 5e.
 *
 * Needs the repo Python env (world_generator + Generate.py):
 *   source .venv/bin/activate
 *   node CC/scripts/jta-stats/sweep-dataset-passb.mjs \
 *     --pairs 1:1,1:2,2:1,2:2,3:3,4:4 \
 *     --out-dir CC/scripts/jta-stats/results/dataset-passb
 *
 * Roughly 1-2 min per pair, dominated by Generate.py.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const args = process.argv.slice(2);
const getArg = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
};
const pairs = (getArg('--pairs') ?? '1:1,1:2,2:1,2:2,3:3,4:4')
    .split(',')
    .map((p) => p.split(':').map(Number));
const quota = getArg('--quota') ?? '15';
const outDir = path.resolve(repoRoot, getArg('--out-dir') ?? 'CC/scripts/jta-stats/results/dataset-passb');

const PRESET_DIR = path.join(repoRoot, 'frontend/presets/jta_loctest_roundtrip_worldgen');
const WORLD_DIR = path.join(repoRoot, 'worlds/jta_loctest_roundtrip_worldgen');

const sh = (cmd, cmdArgs, env = {}) =>
    execFileSync(cmd, cmdArgs, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        env: { ...process.env, ...env },
        maxBuffer: 64 * 1024 * 1024,
    });

fs.mkdirSync(outDir, { recursive: true });

const rows = [];
for (const [ds, fill] of pairs) {
    const tag = `ds${ds}-f${fill}`;
    console.log(`\n=== ${tag}: generating post-fill dataset world (Generate.py) …`);
    sh('node', ['scripts/procgen/verify-jta-locations-roundtrip.mjs'], {
        JTA_RT_DATASET: '1',
        JTA_RT_DATASET_SEED: String(ds),
        JTA_RT_SEED: String(fill),
        JTA_RT_QUOTA: quota,
        JTA_RT_KEEP: '1',
    });
    const apDirs = fs.readdirSync(PRESET_DIR).filter((n) => n.startsWith('AP_'));
    if (apDirs.length !== 1) throw new Error(`${tag}: expected one AP_* export, got ${apDirs}`);
    const seedId = apDirs[0];
    const rules = path.join(PRESET_DIR, seedId, `${seedId}_rules.json`);

    console.log(`=== ${tag} (${seedId}): solving Pass-B costs …`);
    const bp = path.join(outDir, `bp-${tag}.json`);
    // Non-convergence is a DATA POINT here (the whole point of the
    // measurement pass), not an abort.
    let converged = true;
    let failure = null;
    try {
        sh('node', ['scripts/procgen/verify-jta-balance-pass.mjs', rules], { JTA_BP_REPORT: bp });
    } catch (err) {
        converged = false;
        failure = (String(err.stdout ?? '').match(/^FAILED: (.*)$/m) ?? [, 'unknown'])[1];
        console.log(`    [${tag}] did NOT converge: ${failure}`);
    }
    if (!fs.existsSync(bp)) throw new Error(`${tag}: balance pass wrote no report`);
    const { patches, report } = JSON.parse(fs.readFileSync(bp, 'utf8'));

    // --- §4.2 trigger signals -------------------------------------------
    const gaps = report.milestoneGaps ?? [];
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const cms = patches.map((p) => p.cost_multiplier).sort((a, b) => a - b);
    const pct = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))];
    // Per-zone-band clamp profile: a band where (nearly) every solve pinned
    // at the floor is the "systematic saturation" economy signal; a band of
    // saturated solves is starvation.
    const byBucket = new Map();
    for (const e of report.entries ?? []) {
        const b = byBucket.get(e.bucket) ?? { n: 0, floor: 0, saturated: 0, threshold: 0, stalled: 0 };
        b.n++;
        if (e.clamp === 'floor') b.floor++;
        if (e.clamp === 'saturated') b.saturated++;
        if (e.clamp === 'threshold') b.threshold++;
        if (e.stalled) b.stalled++;
        byBucket.set(e.bucket, b);
    }
    const bandProfile = [...byBucket.entries()].sort((a, b) => a[0] - b[0])
        .map(([bucket, b]) => ({ bucket, ...b }));
    const milestoneTrouble = (report.entries ?? [])
        .filter((e) => e.milestone && (e.stalled || e.clamp === 'saturated'))
        .map((e) => ({ taskId: e.taskId, bucket: e.bucket, stalled: e.stalled, clamp: e.clamp }));

    rows.push({
        datasetSeed: ds, fillSeed: fill, seedId, converged, failure,
        entries: report.entryCount,
        milestones: report.milestoneCount,
        stalled: report.stalledEntries,
        neverStarted: report.neverStarted,
        saturated: report.saturated,
        skillless: report.skillless,
        floorClamped: report.floorClamped,
        thresholdClamped: report.thresholdClamped,
        unengaged: report.unengaged,
        unengagedMilestones: report.unengagedMilestones,
        totalResets: report.totalResets,
        gapP50: sortedGaps.length ? pct(sortedGaps, 0.5) : null,
        gapMean: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
        gapMax: sortedGaps.length ? sortedGaps[sortedGaps.length - 1] : null,
        cmMin: cms[0] ?? null, cmP50: cms.length ? pct(cms, 0.5) : null, cmMax: cms[cms.length - 1] ?? null,
        milestoneTrouble,
        bandProfile,
    });

    fs.rmSync(PRESET_DIR, { recursive: true, force: true });
    fs.rmSync(WORLD_DIR, { recursive: true, force: true });
}

// --- Summary -----------------------------------------------------------
const L = ['# Pass-B convergence over generated datasets × fill seeds (Phase 5e §4.2)\n'];
L.push('Instrument: the Pass-B convergence report, run over roundtrip exports of');
L.push('GENERATED synthetic-dataset worlds (z15). Levers (xp_mult co-solve, economy');
L.push('scaling) are added only if the trigger signals below fire — plan §4.2 table.\n');
L.push('| dataset | fill | converged? | entries | milestones | stalled | never-started | saturated | unengaged (ms) | gap p50/mean/max | cm min/p50/max |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const conv = r.converged ? 'yes' : `**no** (${r.failure})`;
    L.push(`| ${r.datasetSeed} | ${r.fillSeed} | ${conv} | ${r.entries} | ${r.milestones} `
        + `| ${r.stalled} | ${r.neverStarted} | ${r.saturated} | ${r.unengaged} (${r.unengagedMilestones}) `
        + `| ${r.gapP50}/${r.gapMean?.toFixed(1)}/${r.gapMax} `
        + `| ${r.cmMin?.toPrecision(3)}/${r.cmP50?.toPrecision(3)}/${r.cmMax?.toPrecision(3)} |`);
}
L.push('\n## §4.2 trigger signals\n');
const anyMilestoneTrouble = rows.some((r) => r.milestoneTrouble.length);
L.push(`- **xp_mult co-solve trigger** (milestone stalls / saturated milestone solves): `
    + (anyMilestoneTrouble ? '**FIRED**' : 'not fired') + '.');
for (const r of rows) {
    for (const t of r.milestoneTrouble) {
        L.push(`  - ds${r.datasetSeed}-f${r.fillSeed}: task ${t.taskId} (bucket ${t.bucket}) `
            + `${t.stalled ? 'STALLED' : ''}${t.clamp === 'saturated' ? 'SATURATED' : ''}`);
    }
}
const saturatedBands = rows.flatMap((r) => r.bandProfile
    .filter((b) => b.n >= 3 && b.floor === b.n)
    .map((b) => `ds${r.datasetSeed}-f${r.fillSeed} bucket ${b.bucket} (${b.floor}/${b.n} at floor)`));
const starvedBands = rows.flatMap((r) => r.bandProfile
    .filter((b) => b.n >= 3 && b.saturated > 0)
    .map((b) => `ds${r.datasetSeed}-f${r.fillSeed} bucket ${b.bucket} (${b.saturated}/${b.n} saturated)`));
L.push(`- **economy scaling trigger** (a whole zone band pinned at min cost): `
    + (saturatedBands.length ? `**FIRED** — ${saturatedBands.join('; ')}` : 'not fired') + '.');
L.push(`- **economy starvation** (saturated solves in a band): `
    + (starvedBands.length ? `**FIRED** — ${starvedBands.join('; ')}` : 'not fired') + '.');
L.push('\nPer-pair per-bucket clamp profiles and full walk reports: `bp-ds*-f*.json` beside this file.\n');

const md = `${L.join('\n')}\n`;
fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), md);
fs.writeFileSync(path.join(outDir, 'sweep.json'), JSON.stringify(rows, null, 2));
console.log(`\n${md}`);
console.log(`wrote ${path.join(outDir, 'SUMMARY.md')}`);
