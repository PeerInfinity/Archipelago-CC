#!/usr/bin/env node
// Region-atlas analyze CLI — the batch/regeneration gate for the mechanical
// sub-region split (CC/docs/plans/region-atlas-plan.md, Phase 5a, Deliverable 3).
//
// The marking tool's Analyze action is the AUTHORING surface (propose, review,
// accept, one region at a time). This is the other half: run the analyzer over
// a whole atlas, write the result, and — with `--check` — prove that doing so
// changes nothing, which is what keeps a committed atlas honest about the
// terrain it was computed from.
//
// The analyzer owns only the internal exits it wrote (`source: "analyzer"`).
// Hand-authored rows survive with their endpoints remapped, and anything that
// could not be remapped is REPORTED, never guessed at.
//
// Usage:
//   node scripts/procgen/region-atlas-analyze.mjs <atlas.json> [options]
//
//   --check              do not write; exit 1 if the analysis would change the
//                        file (the byte-identical regeneration gate)
//   --region <id>        analyze only this region (repeatable)
//   --dry-run            print the report, write nothing
//   --quiet              report only regions with something to say
//   --game-config <path> flashPanel per-game config; defaults to
//                        frontend/modules/flashPanel/games/<game>.json
//
// Exit codes: 0 fine, 1 the atlas would change (--check) or fails validation
// after the merge, 2 usage error.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compactJsonFile } from '../../frontend/modules/procgenPipeline/compactJson.js';
import {
    formatAnalysisReport,
    applyRegionAnalysis,
    describeRule,
} from '../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js';
import { validateRegionAtlas } from '../../frontend/modules/procgenPipeline/regionAtlasValidator.js';
import { analyzeSeedlingRegion } from '../../frontend/modules/flashPanel/seedlingAtlasAnalysis.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Which analyzer a game's atlas goes through. One entry today; the shape is
// what Phase 7 adds RWK to, and an unknown game is an error rather than a
// silent no-op that would report "nothing to do" for a whole map.
const ANALYZERS = { seedling: analyzeSeedlingRegion };

const USAGE = 'usage: node scripts/procgen/region-atlas-analyze.mjs <atlas.json> [--check] [--dry-run] [--quiet] [--region <id>]... [--game-config <path>]';

// Hand-rolled, because two of the flags take a value and a boolean flag may sit
// before the positional — `--check atlas.json` has to work.
const VALUE_FLAGS = new Set(['--region', '--game-config']);
const BOOL_FLAGS = new Set(['--check', '--dry-run', '--quiet']);
const opts = { region: [] };
let file;
for (let i = 0, argv = process.argv.slice(2); i < argv.length; i += 1) {
    const arg = argv[i];
    if (BOOL_FLAGS.has(arg)) { opts[arg.slice(2)] = true; continue; }
    if (VALUE_FLAGS.has(arg)) {
        const v = argv[i += 1];
        if (v === undefined) { console.error(`ERROR: ${arg} needs a value\n${USAGE}`); process.exit(2); }
        if (arg === '--region') opts.region.push(v); else opts[arg.slice(2)] = v;
        continue;
    }
    if (arg.startsWith('--')) { console.error(`ERROR: unknown option ${arg}\n${USAGE}`); process.exit(2); }
    if (file !== undefined) { console.error(`ERROR: more than one atlas given (${file}, ${arg})\n${USAGE}`); process.exit(2); }
    file = arg;
}
if (!file) { console.error(USAGE); process.exit(2); }

const check = opts.check === true;
const dryRun = opts['dry-run'] === true;
const quiet = opts.quiet === true;
const only = new Set(opts.region);
const value = (name) => opts[name.slice(2)];

const atlasPath = resolve(file);
const original = readFileSync(atlasPath, 'utf8');
const atlas = JSON.parse(original);

const analyze = ANALYZERS[atlas.game];
if (!analyze) {
    console.error(`ERROR: no analyzer is registered for game "${atlas.game}" — the tile semantics for it have not been transcribed yet`);
    process.exit(2);
}

// The map document lives beside the atlas (the same convention the validate CLI
// uses). Without it there is no terrain and nothing to analyze, so this is an
// error here where it is only a warning there.
const mapName = atlas.tile_space?.map_document;
if (typeof mapName !== 'string' || mapName.length === 0) {
    console.error('ERROR: the atlas names no tile_space.map_document — there is no tile map to analyze');
    process.exit(2);
}
const mapPath = resolve(dirname(atlasPath), mapName);
if (!existsSync(mapPath)) {
    console.error(`ERROR: tile_space.map_document "${mapName}" not found beside the atlas (${mapPath})`);
    process.exit(2);
}
const mapDoc = JSON.parse(readFileSync(mapPath, 'utf8'));

const configPath = value('--game-config')
    ?? resolve(REPO, 'frontend/modules/flashPanel/games', `${atlas.game}.json`);
if (!existsSync(configPath)) {
    console.error(`ERROR: per-game config not found at ${configPath} — it is where the flag -> AP item mapping comes from`);
    process.exit(2);
}
const gameConfig = JSON.parse(readFileSync(configPath, 'utf8'));

// --- run ---------------------------------------------------------------------

const deps = { mapDoc, gameConfig };
const targets = (atlas.regions ?? [])
    .map((r) => r.region_id)
    .filter((id) => only.size === 0 || only.has(id));
for (const id of only) {
    if (!targets.includes(id)) {
        console.error(`ERROR: --region "${id}" is not a region in this atlas`);
        process.exit(2);
    }
}

const totals = {
    regions: 0, skipped: 0, split: 0, analyzerRows: 0, unruledRows: 0, preservedRows: 0,
    needsAuthoring: 0, boundaryCandidates: 0, unclassified: 0, review: 0, problems: 0,
};
const conditionCensus = new Map();
const needsAuthoring = [];
const problems = [];
const unclassified = [];

for (const regionId of targets) {
    const analysis = analyze(atlas, regionId, deps);
    if (analysis.skipped) {
        totals.skipped += 1;
        if (!quiet) console.log(`region ${regionId}: SKIPPED — ${analysis.skipped}`);
        continue;
    }
    totals.regions += 1;
    if (analysis.split) totals.split += 1;
    for (const row of analysis.internal_exits) {
        if (row.source === 'analyzer') totals.analyzerRows += 1; else totals.unruledRows += 1;
        if (row.access_rule) {
            const k = describeRule(row.access_rule);
            conditionCensus.set(k, (conditionCensus.get(k) ?? 0) + 1);
        }
    }
    totals.needsAuthoring += analysis.needs_authoring.length;
    totals.boundaryCandidates += analysis.boundary_candidates.length;
    totals.unclassified += analysis.unclassified.length;
    totals.review += analysis.review.length;
    for (const n of analysis.needs_authoring) needsAuthoring.push({ regionId, ...n });
    for (const u of analysis.unclassified) unclassified.push({ regionId, ...u });

    const lines = formatAnalysisReport(analysis);
    if (!quiet || lines.length > 1) console.log(lines.join('\n'));

    const applied = applyRegionAnalysis(atlas, analysis);
    // What the analyzer emitted is `analysis.internal_exits`; anything beyond
    // that in the merged region is a hand-authored row that survived.
    totals.preservedRows += Math.max(0, applied.internal_exits.length - analysis.internal_exits.length);
    for (const p of applied.problems) {
        problems.push({ regionId, ...p });
        console.log(`  PROBLEM (${p.kind}): ${p.message}`);
    }
    totals.problems += applied.problems.length;
}

// --- report ------------------------------------------------------------------

console.log('');
console.log(
    `analyzed ${totals.regions} region(s) (${totals.skipped} skipped, no map_ref): `
    + `${totals.split} split, ${totals.analyzerRows} labelled internal exit(s), `
    + `${totals.unruledRows} awaiting a hand-written rule, `
    + `${totals.preservedRows} pre-existing hand-authored row(s) preserved`,
);
if (conditionCensus.size > 0) {
    console.log('crossings by condition:');
    for (const [rule, count] of [...conditionCensus].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        console.log(`  ${count} x ${rule}`);
    }
}
if (needsAuthoring.length > 0) {
    console.log(`NEEDS HAND AUTHORING — ${needsAuthoring.length} crossing(s) the analyzer cannot label:`);
    for (const n of needsAuthoring) {
        console.log(`  ${n.regionId}: ${n.from} ${n.bidirectional ? '<->' : '->'} ${n.to} — ${n.reasons.join('; ') || 'no derivable rule'}`);
    }
}
if (totals.boundaryCandidates > 0) {
    console.log(`${totals.boundaryCandidates} one-way drop(s) leave their region — boundary exit candidates (see the per-region report above)`);
}
if (unclassified.length > 0) {
    console.log(`UNCLASSIFIED — ${unclassified.length} thing(s) the semantics tables do not know:`);
    for (const u of unclassified) console.log(`  ${u.regionId} at [${u.tile}]: ${u.what}`);
}

const validation = validateRegionAtlas(atlas, { mapDoc });
for (const w of validation.warnings) console.log(`WARN: ${w}`);
for (const e of validation.errors) console.error(`ERROR: ${e}`);

// --- write -------------------------------------------------------------------

const next = compactJsonFile(atlas);
const changed = next !== original;

if (check) {
    if (changed) {
        console.error('\nFAIL: analyzing this atlas would change it — re-run without --check and commit the result');
        process.exit(1);
    }
    console.log('\nOK: --check — analyzing this atlas reproduces it byte for byte');
    process.exit(validation.ok ? 0 : 1);
}

if (dryRun) {
    console.log(`\nDRY RUN: ${changed ? 'the atlas WOULD change' : 'no change'}; nothing written`);
    process.exit(validation.ok ? 0 : 1);
}

if (!validation.ok) {
    console.error('\nREFUSING TO WRITE: the merged atlas does not validate');
    process.exit(1);
}
if (changed) {
    writeFileSync(atlasPath, next);
    console.log(`\nwrote ${file} (${atlas.atlas_id})`);
} else {
    console.log('\nno change');
}
process.exit(0);

