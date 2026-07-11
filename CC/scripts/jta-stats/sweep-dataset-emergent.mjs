#!/usr/bin/env node
/**
 * Phase 5f: emergent verification of GENERATED synthetic-dataset worlds
 * (jta-synthetic-data-plan §6 5f — the Phase-4 replay at Phase-5 scope).
 *
 * Per world: regenerate the post-fill export, solve its Pass-B costs, and
 * PLAY it out under free automation (driver.mjs, options.dataset — the same
 * model sweep-ap-seeds verified against the bridge in Phase 4). Checks:
 *
 *   - HARD GATE: full AP location coverage every run.
 *   - ADVISORY: per-world mean milestone gap inside [0.4x, 3x] of
 *     resetsPerStep = 5 (the settled Phase-4 band).
 *   - C4 EMERGENT: skill levels actually reached vs zone demands — at each
 *     zone's completion (last first-completion among its tasks), the MIN
 *     level across the skills the zone's tasks demand, compared against the
 *     vanilla anchor at the same zone (datasets are balance-isomorphic
 *     mirrors, so the anchor is apples-to-apples; flag if < 0.4x vanilla or
 *     if a demanded skill is still level 0).
 *
 * The vanilla anchor (fill seed 1, no dataset) runs first; its zone-demand
 * map comes from datasets/vanilla.json (real vanilla task ids + skills),
 * with the four SBtV ids excluded like everywhere else in the arc.
 *
 * Play results (with per-run skill traces) land in --out-dir (default
 * /tmp/jta-dataset-emergent, NOT committed — Phase-4 convention); the
 * committed record is the --summary markdown.
 *
 *   source .venv/bin/activate
 *   node CC/scripts/jta-stats/sweep-dataset-emergent.mjs \
 *     --pairs 1:1,1:2,2:1,2:2,3:3,4:4 \
 *     --summary CC/scripts/jta-stats/results/comparison-dataset-emergent.md
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
const maxRuns = getArg('--max-runs') ?? '2000';
const outDir = path.resolve(getArg('--out-dir') ?? '/tmp/jta-dataset-emergent');
const summaryPath = path.resolve(repoRoot,
    getArg('--summary') ?? 'CC/scripts/jta-stats/results/comparison-dataset-emergent.md');

const PRESET_DIR = path.join(repoRoot, 'frontend/presets/jta_loctest_roundtrip_worldgen');
const WORLD_DIR = path.join(repoRoot, 'worlds/jta_loctest_roundtrip_worldgen');
const RESETS_PER_STEP = 5;
const BAND = [0.4 * RESETS_PER_STEP, 3 * RESETS_PER_STEP];
const SBTV_TASK_IDS = new Set([17, 28, 88, 158]);
const C4_RATIO_FLOOR = 0.4;

const sh = (cmd, cmdArgs, env = {}) =>
    execFileSync(cmd, cmdArgs, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        env: { ...process.env, ...env },
        maxBuffer: 64 * 1024 * 1024,
    });

fs.mkdirSync(outDir, { recursive: true });

/** taskId -> zone and zone -> demanded skill set, from a dataset-shaped doc. */
function demandMap(doc, { excludeIds = new Set() } = {}) {
    const zoneOfTask = new Map();
    const demanded = new Map(); // zone -> Set<skillIdx>
    doc.zones.forEach((z, zi) => {
        const set = new Set();
        for (const t of z.tasks) {
            if (excludeIds.has(t.id)) continue;
            zoneOfTask.set(t.id, zi);
            for (const s of t.skills ?? []) set.add(s);
        }
        demanded.set(zi, set);
    });
    return { zoneOfTask, demanded };
}

/** Play one exported world and analyze it. `doc` supplies the demand map. */
function playAndAnalyze({ tag, rules, doc, excludeIds }) {
    const bp = path.join(outDir, `bp-${tag}.json`);
    let solveConverged = true;
    let solveFailure = null;
    try {
        sh('node', ['scripts/procgen/verify-jta-balance-pass.mjs', rules], { JTA_BP_REPORT: bp });
    } catch (err) {
        solveConverged = false;
        solveFailure = (String(err.stdout ?? '').match(/^FAILED: (.*)$/m) ?? [, 'unknown'])[1];
        console.log(`    [${tag}] solve did NOT converge: ${solveFailure} (patches still used)`);
    }
    const cfg = path.join(outDir, `config-${tag}.json`);
    sh('node', ['CC/scripts/jta-stats/make-ap-config.mjs',
        '--rules', rules, '--report', bp, '--name', tag,
        '--max-runs', String(maxRuns), '--out', cfg]);
    // Opt-in per-run skill trace for the C4-emergent comparison.
    const cfgDoc = JSON.parse(fs.readFileSync(cfg, 'utf8'));
    cfgDoc.options.recordSkillLevels = true;
    fs.writeFileSync(cfg, JSON.stringify(cfgDoc, null, 2));

    const res = path.join(outDir, `result-${tag}.json`);
    console.log(`=== ${tag}: playing under free automation …`);
    sh('node', ['CC/scripts/jta-stats/run-node.mjs', '--config', cfg, '--out', res]);
    const d = JSON.parse(fs.readFileSync(res, 'utf8'));
    const ap = d.apRuntime;

    // Milestone gaps (emergent acquisition order).
    const acquired = ap.milestones.filter((m) => m.run != null).sort((a, b) => a.run - b.run);
    const gaps = acquired.slice(1).map((m, i) => m.run - acquired[i].run);
    const sorted = [...gaps].sort((a, b) => a - b);
    const gapMean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

    // C4 emergent: per zone, MIN level across demanded skills at the run the
    // zone's LAST task first-completed (skill trace sampled at run ends).
    const { zoneOfTask, demanded } = demandMap(doc, { excludeIds });
    const trace = d.skillLevelsByRun ?? [];
    const levelsAt = (run) => {
        for (const e of trace) if (e.run >= run) return e.levels;
        return trace.length ? trace[trace.length - 1].levels : [];
    };
    const zoneCompletionRun = new Map();
    for (const [idStr, run] of Object.entries(ap.firstCompletionRuns ?? {})) {
        const zone = zoneOfTask.get(Number(idStr));
        if (zone === undefined) continue;
        zoneCompletionRun.set(zone, Math.max(zoneCompletionRun.get(zone) ?? 0, run));
    }
    const c4 = [];
    for (const [zone, skills] of [...demanded.entries()].sort((a, b) => a[0] - b[0])) {
        const run = zoneCompletionRun.get(zone);
        if (run === undefined || skills.size === 0) continue;
        const levels = levelsAt(run);
        const perSkill = [...skills].map((s) => levels[s] ?? 0);
        c4.push({
            zone,
            completionRun: run,
            minDemandedLevel: Math.min(...perSkill),
            zeroLevelDemanded: perSkill.filter((l) => l === 0).length,
        });
    }

    return {
        tag,
        solveConverged,
        solveFailure,
        coverage: ap.coverage,
        total: ap.coverageTotal,
        full: ap.fullCoverage,
        uncovered: ap.uncovered,
        runs: d.timing.runsExecuted,
        prestiges: ap.prestigeWipes,
        regrants: ap.regrants,
        perksMissing: ap.perksMissing,
        gapP50: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
        gapMean,
        gapMax: sorted.length ? sorted[sorted.length - 1] : null,
        bandOk: gapMean != null && gapMean >= BAND[0] && gapMean <= BAND[1],
        c4,
    };
}

function exportWorld(env) {
    sh('node', ['scripts/procgen/verify-jta-locations-roundtrip.mjs'], {
        JTA_RT_QUOTA: quota, JTA_RT_KEEP: '1', ...env,
    });
    const apDirs = fs.readdirSync(PRESET_DIR).filter((n) => n.startsWith('AP_'));
    if (apDirs.length !== 1) throw new Error(`expected one AP_* export, got ${apDirs}`);
    const seedId = apDirs[0];
    return path.join(PRESET_DIR, seedId, `${seedId}_rules.json`);
}

const cleanupExport = () => {
    fs.rmSync(PRESET_DIR, { recursive: true, force: true });
    fs.rmSync(WORLD_DIR, { recursive: true, force: true });
};

// --- Vanilla anchor ----------------------------------------------------
console.log('\n=== vanilla anchor (fill seed 1): regenerating export …');
const vanillaFixture = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json'), 'utf8'));
let rulesPath = exportWorld({ JTA_RT_SEED: '1' });
const anchor = playAndAnalyze({
    tag: 'vanilla-f1', rules: rulesPath, doc: vanillaFixture, excludeIds: SBTV_TASK_IDS,
});
cleanupExport();
const anchorC4 = new Map(anchor.c4.map((z) => [z.zone, z.minDemandedLevel]));

// --- Dataset worlds ----------------------------------------------------
const rows = [];
for (const [ds, fill] of pairs) {
    const tag = `ds${ds}-f${fill}`;
    console.log(`\n=== ${tag}: regenerating dataset export …`);
    rulesPath = exportWorld({
        JTA_RT_DATASET: '1', JTA_RT_DATASET_SEED: String(ds), JTA_RT_SEED: String(fill),
    });
    const rulesDoc = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const playerId = Object.keys(rulesDoc.preset_sidecars)[0];
    const doc = Object.values(rulesDoc.preset_sidecars[playerId])
        .map((sc) => (sc.playable_payload ?? sc).jta_dataset).find(Boolean);
    if (!doc) throw new Error(`${tag}: export carries no jta_dataset`);
    const row = playAndAnalyze({ tag, rules: rulesPath, doc, excludeIds: new Set() });
    // C4 ratio vs the vanilla anchor, worst zone.
    let worst = null;
    for (const z of row.c4) {
        const van = anchorC4.get(z.zone);
        if (!van) continue;
        const ratio = z.minDemandedLevel / van;
        if (worst === null || ratio < worst.ratio) worst = { zone: z.zone, ratio };
    }
    row.c4Worst = worst;
    row.c4ZeroLevels = row.c4.reduce((a, z) => a + z.zeroLevelDemanded, 0);
    rows.push(row);
    cleanupExport();
}

// --- Summary -----------------------------------------------------------
const L = ['# Emergent verification of generated dataset worlds (Phase 5f)\n'];
L.push('Free-automation playthroughs of Pass-B-solved GENERATED worlds (z' + quota
    + '), the Phase-4 sweep re-aimed at synthetic datasets. Hard gate = full');
L.push('coverage; advisory = per-world mean milestone gap in '
    + `[${BAND[0]}, ${BAND[1]}] (resetsPerStep=${RESETS_PER_STEP}); C4 emergent = min demanded-skill`);
L.push('level at each zone completion vs the vanilla anchor (flag < '
    + `${C4_RATIO_FLOOR}x or any level-0 demanded skill). Play artifacts: \`${outDir}\`.\n`);
L.push('| world | solve | coverage | full? | runs | prestiges | re-grants | gap p50/mean/max | band ok? | C4 worst-zone ratio | C4 zero-levels |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|');
const worldRow = (r) => {
    const solve = r.solveConverged ? 'ok' : `**no** (${r.solveFailure})`;
    const worst = r.c4Worst ? `${r.c4Worst.ratio.toFixed(2)}x (z${r.c4Worst.zone})` : '—';
    L.push(`| ${r.tag} | ${solve} | ${r.coverage}/${r.total} | ${r.full ? 'yes' : '**NO**'} `
        + `| ${r.runs} | ${r.prestiges} | ${r.regrants} `
        + `| ${r.gapP50}/${r.gapMean?.toFixed(1)}/${r.gapMax} | ${r.bandOk ? 'yes' : '**NO**'} `
        + `| ${worst} | ${r.c4ZeroLevels ?? 0} |`);
};
worldRow({ ...anchor, c4Worst: { zone: '-', ratio: 1 }, c4ZeroLevels: anchor.c4.reduce((a, z) => a + z.zeroLevelDemanded, 0) });
for (const r of rows) worldRow(r);

const hardFail = rows.filter((r) => !r.full);
const bandFail = rows.filter((r) => !r.bandOk);
const c4Fail = rows.filter((r) => (r.c4Worst && r.c4Worst.ratio < C4_RATIO_FLOOR) || r.c4ZeroLevels > 0);
L.push('');
L.push(`- **Hard gate (full coverage):** ${hardFail.length === 0 ? 'PASS on every world.'
    : `**FAILED** — ${hardFail.map((r) => `${r.tag} (${r.coverage}/${r.total}: ${r.uncovered.map((u) => `task ${u.id} z${u.zone}`).join(', ')})`).join('; ')}`}`);
L.push(`- **Pacing advisory:** ${bandFail.length === 0 ? 'every world inside the band.'
    : `outside the band — ${bandFail.map((r) => `${r.tag} (mean ${r.gapMean?.toFixed(1)})`).join('; ')}`}`);
L.push(`- **C4 emergent:** ${c4Fail.length === 0 ? 'no world below the vanilla-anchor ratio floor; no level-0 demanded skills.'
    : `flagged — ${c4Fail.map((r) => `${r.tag} (worst ${r.c4Worst?.ratio.toFixed(2)}x z${r.c4Worst?.zone}, zero-levels ${r.c4ZeroLevels})`).join('; ')}`}`);
L.push('');
L.push('Per-zone C4 detail (min demanded-skill level at zone completion):\n');
L.push(`| zone | ${['vanilla-f1', ...rows.map((r) => r.tag)].join(' | ')} |`);
L.push(`|---|${['---', ...rows.map(() => '---')].join('|')}|`);
const zoneSet = [...new Set([anchor, ...rows].flatMap((r) => r.c4.map((z) => z.zone)))].sort((a, b) => a - b);
for (const zone of zoneSet) {
    const cells = [anchor, ...rows].map((r) => {
        const z = r.c4.find((x) => x.zone === zone);
        return z ? String(z.minDemandedLevel) : '—';
    });
    L.push(`| ${zone} | ${cells.join(' | ')} |`);
}
const md = `${L.join('\n')}\n`;
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, md);
fs.writeFileSync(path.join(outDir, 'sweep.json'), JSON.stringify({ anchor, rows }, null, 2));
console.log(`\n${md}`);
console.log(`wrote ${summaryPath}`);
