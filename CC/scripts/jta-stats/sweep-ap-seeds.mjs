#!/usr/bin/env node
/**
 * Cross-seed emergent verification (Phase 4).
 *
 * One seed proves nothing about a randomizer. This regenerates a full post-fill
 * world per seed, solves its Pass-B costs, and plays it out under FREE
 * automation, so the headline claim — every AP location is reachable — is
 * checked against worlds the balance pass never saw.
 *
 * Per seed:
 *   1. verify-jta-locations-roundtrip.mjs  (JTA_RT_SEED)  -> exported rules.json
 *   2. verify-jta-balance-pass.mjs         (JTA_BP_REPORT) -> cost patches
 *   3. make-ap-config.mjs                                  -> harness config
 *   4. run-node.mjs                                        -> playthrough
 *
 * Two variants per seed:
 *   baseline    own-world perks re-grant when their holding task next completes
 *               (the 2026-07-09 intended semantics)
 *   no-regrant  each perk granted once, ever — bridge.js as it ships today
 *
 * Step 1 needs the repo Python env (world_generator + Generate.py):
 *   source .venv/bin/activate
 *   node CC/scripts/jta-stats/sweep-ap-seeds.mjs --seeds 1,2,3,4 --out-dir /tmp/apsweep
 *
 * Roughly 1-2 min per seed, dominated by Generate.py.
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
const seeds = (getArg('--seeds') ?? '1,2,3,4').split(',').map(Number);
const outDir = path.resolve(getArg('--out-dir') ?? '/tmp/jta-ap-sweep');
const maxRuns = getArg('--max-runs') ?? '2000';
const summaryPath = getArg('--summary');

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
const VARIANTS = [
    { tag: 'baseline', flags: [] },
    { tag: 'no-regrant', flags: ['--no-regrant'] },
];

const rows = [];
for (const seed of seeds) {
    console.log(`\n=== seed ${seed}: regenerating post-fill world (Generate.py) …`);
    sh('node', ['scripts/procgen/verify-jta-locations-roundtrip.mjs'], {
        JTA_RT_SEED: String(seed), JTA_RT_QUOTA: '15', JTA_RT_KEEP: '1',
    });
    const apDirs = fs.readdirSync(PRESET_DIR).filter((n) => n.startsWith('AP_'));
    if (apDirs.length !== 1) throw new Error(`seed ${seed}: expected one AP_* export, got ${apDirs}`);
    const seedId = apDirs[0];
    const rules = path.join(PRESET_DIR, seedId, `${seedId}_rules.json`);

    // Keep the exported world around: the config's `_source` points at it, and
    // re-deriving it costs a Generate.py run.
    const seedOut = path.join(outDir, `seed${seed}`);
    fs.mkdirSync(seedOut, { recursive: true });
    for (const f of fs.readdirSync(path.join(PRESET_DIR, seedId))) {
        fs.copyFileSync(path.join(PRESET_DIR, seedId, f), path.join(seedOut, f));
    }
    const localRules = path.join(seedOut, `${seedId}_rules.json`);

    console.log(`=== seed ${seed} (${seedId}): solving Pass-B costs …`);
    const bp = path.join(seedOut, 'bp.json');
    // The pass exits non-zero when it misses its own convergence bar (stalled
    // entries, saturated solves, an unengaged MILESTONE). That verdict is
    // IN-SAMPLE — reached under `setCostedTaskIds` confinement, where the walk
    // cannot wait out a task nothing else can unblock. Free automation may well
    // complete the very entries the walk gave up on, so a failing solve is a
    // data point here, not a reason to abandon the seed: the patches are still
    // written, and whether they yield a playable world is exactly the question.
    let balancePassConverged = true;
    let balancePassFailure = null;
    try {
        sh('node', ['scripts/procgen/verify-jta-balance-pass.mjs', rules], { JTA_BP_REPORT: bp });
    } catch (err) {
        balancePassConverged = false;
        const out = String(err.stdout ?? '');
        balancePassFailure = (out.match(/^FAILED: (.*)$/m) ?? [, 'unknown'])[1];
        console.log(`    [seed ${seed}] balance pass did NOT converge: ${balancePassFailure}`);
    }
    if (!fs.existsSync(bp)) throw new Error(`seed ${seed}: balance pass wrote no report`);

    for (const { tag, flags } of VARIANTS) {
        const cfg = path.join(seedOut, `config-${tag}.json`);
        const res = path.join(seedOut, `result-${tag}.json`);
        sh('node', ['CC/scripts/jta-stats/make-ap-config.mjs',
            '--rules', localRules, '--report', bp, '--name', `seed${seed}-${tag}`,
            '--max-runs', String(maxRuns), '--out', cfg, ...flags]);
        console.log(`=== seed ${seed}: playing ${tag} …`);
        sh('node', ['CC/scripts/jta-stats/run-node.mjs', '--config', cfg, '--out', res]);

        const d = JSON.parse(fs.readFileSync(res, 'utf8'));
        const bpDoc = JSON.parse(fs.readFileSync(bp, 'utf8'));
        const floored = (bpDoc.report?.entries ?? []).filter((e) => e.thresholdFloored).map((e) => e.taskId);
        const ap = d.apRuntime;
        const cb = ap.firstCompletionRuns ?? {};
        const acquired = ap.milestones.filter((m) => m.run != null).sort((a, b) => a.run - b.run);
        const gaps = acquired.slice(1).map((m, i) => m.run - acquired[i].run);
        rows.push({
            seed, seedId, tag, balancePassConverged, balancePassFailure,
            coverage: ap.coverage, total: ap.coverageTotal, full: ap.fullCoverage,
            runs: d.timing.runsExecuted, prestiges: ap.prestigeWipes, regrants: ap.regrants,
            flooredTotal: floored.length,
            flooredCovered: floored.filter((id) => String(id) in cb).length,
            uncovered: ap.uncovered.map((u) => ({ ...u, floored: floored.includes(u.id) })),
            gaps,
        });
    }

    fs.rmSync(PRESET_DIR, { recursive: true, force: true });
    fs.rmSync(WORLD_DIR, { recursive: true, force: true });
}

const stat = (g) => {
    if (!g.length) return { p50: NaN, mean: NaN, max: NaN };
    const s = [...g].sort((a, b) => a - b);
    return { p50: s[Math.floor(s.length / 2)], mean: g.reduce((a, b) => a + b, 0) / g.length, max: s[s.length - 1] };
};

const L = ['# Cross-seed emergent verification (Phase 4)\n'];
L.push('`baseline` = the 2026-07-09 grant semantics (own-world perks re-grant on');
L.push('re-completion). `no-regrant` = bridge.js as it ships today.\n');
L.push('| seed | variant | solve converged? | coverage | full? | runs | prestiges | re-grants | thresholdFloored covered | gap p50 | gap mean | gap max |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const s = stat(r.gaps);
    const conv = r.balancePassConverged ? 'yes' : `**no** (${r.balancePassFailure})`;
    L.push(`| ${r.seed} | ${r.tag} | ${conv} | ${r.coverage}/${r.total} | ${r.full ? 'yes' : '**NO**'} | ${r.runs} `
        + `| ${r.prestiges} | ${r.regrants} | ${r.flooredCovered}/${r.flooredTotal} `
        + `| ${s.p50} | ${s.mean.toFixed(2)} | ${s.max} |`);
}
const pooled = rows.filter((r) => r.tag === 'baseline').flatMap((r) => r.gaps);
const ps = stat(pooled);
L.push(`\nPooled baseline milestone gaps (n=${pooled.length}): p50 ${ps.p50}, mean ${ps.mean.toFixed(2)}, max ${ps.max} `
    + `— target \`resetsPerStep = 5\`.\n`);
for (const r of rows) {
    if (r.full) continue;
    L.push(`\n### seed ${r.seed} / ${r.tag}: ${r.uncovered.length} locations never checked\n`);
    for (const u of r.uncovered) {
        L.push(`- task ${u.id} (zone ${u.zone}) ${u.name}${u.floored ? ' — **thresholdFloored**' : ''}`);
    }
}
const md = `${L.join('\n')}\n`;
if (summaryPath) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, md);
    console.log(`\nwrote ${summaryPath}`);
}
fs.writeFileSync(path.join(outDir, 'sweep.json'), JSON.stringify(rows, null, 2));
console.log(`\n${md}`);
