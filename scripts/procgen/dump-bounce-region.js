#!/usr/bin/env node
/**
 * Headless bounce-region report — generates (or loads) ONE bounce region and
 * writes the formatRegionReport text dump. The fast iterate-and-inspect backend
 * behind the eventual visual editor; surfaces the per-row item requirements plus
 * everything else the generator tracks.
 *
 * Two input modes:
 *
 *   FRESH (full fidelity) — generate from a spec file that is literally a
 *   generateZoneForSpecsGen() options object:
 *     node scripts/procgen/dump-bounce-region.js --spec spec.json [-o out.txt]
 *
 *     spec.json, e.g.:
 *       {
 *         "region_id": "R_demo", "seed": 1, "physicsProfile": "dj",
 *         "mode": "braid", "braidWidth": 240, "freeArrow": "right",
 *         "exitSpecs":     [{ "side": "N", "requirement": [] },
 *                           { "side": "E", "requirement": ["blue"] }],
 *         "locationSpecs": [{ "id": "pk", "requirement": ["blue"] }]
 *       }
 *
 *   EXISTING (best-effort) — read a region's serialized level out of a world's
 *   rules.json preset_sidecars. The payload doesn't store the derive context
 *   (freeArrow / mode), so requirements are re-derived under braid assumptions;
 *   pass --free-arrow to match the world's pick.
 *     node scripts/procgen/dump-bounce-region.js \
 *         --preset frontend/presets/<world>/AP_.../...rules.json \
 *         --region region_3_3 [--free-arrow right] [-o out.txt]
 *     (omit --region to LIST the bounce regions in the file)
 *
 * Flags:
 *   --spec PATH            generate fresh from a generateZoneForSpecsGen spec
 *   --preset PATH          rules.json to read an existing region from
 *   --region ID            region id within the preset (omit to list)
 *   --free-arrow l|r|left|right   existing-region derive context (default right)
 *   --physics PROFILE      override physics profile for the existing region
 *   -o, --out PATH         output .txt path (default ./bounce-region-report.txt)
 *   -h, --help
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateZoneForSpecsGen } from '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import { deriveAccessRules, deriveBraidAccessRules, abilityUniverse } from
    '../../frontend/modules/bounceDemo/deriveRules.js';
import { resolvePhysicsStamp } from '../../frontend/modules/bounceDemo/physics.js';
import { formatRegionReport } from '../../frontend/modules/bounceDemo/regionReport.js';

function parseArgs(argv) {
    const out = { spec: null, preset: null, region: null, freeArrow: 'right', physics: null, out: './bounce-region-report.txt' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        switch (a) {
            case '--spec': out.spec = next(); break;
            case '--preset': out.preset = next(); break;
            case '--region': out.region = next(); break;
            case '--free-arrow': {
                const v = next();
                out.freeArrow = (v === 'l' || v === 'left') ? 'left' : 'right';
                break;
            }
            case '--physics': out.physics = next(); break;
            case '-o':
            case '--out': out.out = next(); break;
            case '-h':
            case '--help':
                console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8')
                    .split('\n').filter((l) => l.startsWith(' *')).map((l) => l.slice(2).trimEnd()).join('\n'));
                process.exit(0);
                break;
            default: throw new Error(`unknown flag: ${a}`);
        }
    }
    if (!out.spec === !out.preset) throw new Error('pass exactly one of --spec or --preset');
    return out;
}

// FRESH: drain the zone generator, then re-derive WITH includePlatforms using
// the same opts the generator used (so per-row data matches the emitted rules).
function fromSpec(specPath) {
    const spec = JSON.parse(readFileSync(resolve(process.cwd(), specPath), 'utf8'));
    const gen = generateZoneForSpecsGen(spec);
    let r = gen.next();
    while (!r.done) r = gen.next();
    const zone = r.value;
    const level = zone.payload?.params?.bounceLevel;
    if (!level) throw new Error('spec produced no bounceLevel');

    const C = resolvePhysicsStamp(spec.physicsProfile ?? 'experimental');
    const mode = spec.mode ?? 'column';
    const freeArrow = spec.freeArrow ?? 'right';
    // Pick the derive that MATCHES how the generator built this region — the
    // authoredReqs map is the gated-braid (Regime 2) signal (proposeBraidLevel
    // returns null for the all-free fork braid). Splitting the spec's requirement
    // into physics-vs-authored happens inside generateZoneForSpecsGen, so the
    // raw spec requirement can't be trusted to tell the regime; authoredReqs can.
    let derived;
    if (zone.authoredReqs) {
        // Regime 2: row-aware flood, free arrow held, portal hosts terminal.
        derived = deriveBraidAccessRules(level, {
            constants: C, freeArrow, freeAbilities: [freeArrow],
            terminalPortals: true, includePlatforms: true,
        });
    } else if (mode === 'braid') {
        // Regime 1 fork braid: every ability is free, so every reachable
        // platform derives []. Full-graph solver with the whole universe free.
        derived = deriveAccessRules(level, {
            constants: C, freeAbilities: abilityUniverse(level), includePlatforms: true,
        });
    } else {
        // Column sphere growth: gates everything; no free abilities.
        derived = deriveAccessRules(level, { constants: C, includePlatforms: true });
    }

    return {
        meta: { regionId: spec.region_id, seed: spec.seed, physics: spec.physicsProfile ?? 'experimental', mode, freeArrow },
        level, derived,
        authoredReqs: zone.authoredReqs, // gated-braid build intent (verified-vs-authored view)
        zone: {
            exitRules: zone.exitRules, exitPaths: zone.exitPaths,
            obstacleDefs: zone.obstacleDefs, gateRules: zone.payload?.gate_rules,
            locations: zone.locations,
        },
    };
}

// EXISTING: pull the level out of preset_sidecars[player][region].playable_payload.
function collectBounceRegions(rules) {
    const found = [];
    for (const [player, regions] of Object.entries(rules.preset_sidecars ?? {})) {
        for (const [rid, r] of Object.entries(regions ?? {})) {
            if (r?.playable_payload?.params?.bounceLevel) found.push({ player, rid, payload: r.playable_payload });
        }
    }
    return found;
}

function fromPreset(opts) {
    const rules = JSON.parse(readFileSync(resolve(process.cwd(), opts.preset), 'utf8'));
    const found = collectBounceRegions(rules);
    if (!found.length) throw new Error('no bounce regions found in preset (no playable_payload.params.bounceLevel)');
    if (!opts.region) {
        console.log(`Bounce regions in ${opts.preset}:`);
        for (const f of found) console.log(`  ${f.rid}  (player ${f.player}, ${f.payload.params.bounceLevel.platforms.length} platforms)`);
        console.log('\nRe-run with --region <id> to report on one.');
        process.exit(0);
    }
    const hit = found.find((f) => f.rid === opts.region);
    if (!hit) throw new Error(`region '${opts.region}' not found; available: ${found.map((f) => f.rid).join(', ')}`);

    const level = hit.payload.params.bounceLevel;
    const stamp = opts.physics ?? hit.payload.params.physics ?? 'experimental';
    const C = resolvePhysicsStamp(stamp);
    const profileName = typeof stamp === 'string' ? stamp : (stamp.profile ?? 'experimental');
    // The serialized payload doesn't store the derive context (mode / freeArrow),
    // so use the UNIVERSAL full-graph solver: correct for column regions, and for
    // braids it can only OVER-state an offset-tip gate (the safe direction). The
    // free arrow is supplied via --free-arrow and treated as always-held.
    const derived = deriveAccessRules(level, {
        constants: C, freeAbilities: [opts.freeArrow], includePlatforms: true,
    });
    console.warn(`NOTE: existing-region requirements use the full-graph solver with freeArrow=${opts.freeArrow} `
        + 'treated as free (the payload omits mode/freeArrow). For a braid this may OVER-state an offset-tip '
        + 'gate; pass --free-arrow to match the world\'s pick.');
    return {
        meta: { regionId: opts.region, physics: profileName, mode: 'serialized (solver: full-graph)', freeArrow: opts.freeArrow },
        level, derived,
        zone: { gateRules: hit.payload.gate_rules },
    };
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const input = opts.spec ? fromSpec(opts.spec) : fromPreset(opts);
    const report = formatRegionReport(input);

    const outPath = resolve(process.cwd(), opts.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, report);
    const rows = report.match(/rows=(\d+)/)?.[1];
    console.log(`Wrote ${outPath}  (region ${input.meta.regionId}, ${rows} rows)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try { main(); process.exit(0); }
    catch (e) { console.error(`ERROR: ${e.message}`); process.exit(1); }
}
