/**
 * @ci-box V3b adopted this script's NAME, not its RUN: it has never been priced on a runner, and `planCiShards` gives an unpriced arm a whole 600 s shard — adopting it is a costed decision, not a rename's side effect.
 *   ⇒ deleting this one line is how a later slice adopts it into CI.
 */
// Byte-identity guard for the stepped SHUFFLED-SPIRAL pipeline (spiralSteps.js).
// Asserts the four stepped steps (arrange → content → regions → compile)
// reproduce the monolithic arrangeShuffledSpiral + buildRulesJson output
// byte-for-byte, both in-process AND with a serialize→deserialize round-trip
// between EVERY step (the cross-process CLI path). Covers a JtA-only (zone,
// rng-free ③) walk, a maze-only (procedural, rng-consuming ③) walk, and — the
// case that actually exercises the ①→③ rng-threading discipline — a MIXED
// maze+jta walk where a procedural substrate draws rng inside the spiral loop.
// Not a passive dump: it self-checks and exits non-zero on any mismatch. Run:
//   node scripts/procgen/check-spiral-byteidentity.mjs [/tmp/spiral-dump.json]
import { writeFileSync } from 'node:fs';

// Substrate libraries register on import (same set as dump-shuffled-spiral.js).
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import '../../frontend/modules/noiz2saSubstrate/noiz2saSubstrateLibrary.js';
import {
    arrangeShuffledSpiral, buildRulesJson, getRegionExits, getRegionEntrance,
} from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';
import {
    SPIRAL_STEPS, newSpiralEnvelope, runSpiralStep, runSpiralToStep,
    serializeSpiralEnvelope, deserializeSpiralEnvelope,
} from '../../frontend/modules/procgenPipeline/spiralSteps.js';

// Serialize a grid's regions deterministically (same shape as the sphere /
// top-down harnesses): region object minus the runtime Map (exits), as an array.

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
function dumpGrid(grid) {
    const out = {};
    for (const region of grid.allRegions()) {
        const pp = region.playable_payload ?? {};
        const exitMap = getRegionExits(region);
        const exits = exitMap instanceof Map ? [...exitMap.values()] : (exitMap ?? []);
        out[region.region_id] = {
            substrate: region.substrate,
            extracted_rules: region.extracted_rules,
            exits_placed: region.exits_placed,
            placed_items: region.placed_items,
            payload: { ...pp, exits, entrance: getRegionEntrance(region) ?? null },
        };
    }
    return out;
}

// Build the { config, compileIn } pair a preset feeds to BOTH paths, so the only
// variable under test is monolithic-vs-stepped, not the inputs.
function preset({
    seed = 1, region = { width: 8, height: 6 }, quotas, start = null,
    items = {}, obstacles = {}, substrateConfig = null,
}) {
    const config = {
        regionSize: region,
        itemPool: { ...items },
        obstaclePool: { ...obstacles },
        seed,
        regionParams: {},
        growthParams: {
            substrateQuotas: quotas,
            ...(start ? { startSubstrate: start } : {}),
            ...(substrateConfig ? { substrateConfig } : {}),
        },
        hazardOpts: null,
    };
    // The completion item is the goal ③ realises (both paths read it off the
    // realisation), so compileIn names none.
    const compileIn = {
        seed,
        enableLoopMode: false,
        regionXpEffect: 'cost',
    };
    return { config, compileIn };
}

// Path A — the monolith: arrangeShuffledSpiral + buildRulesJson with the exact
// compile opts the ④ step uses.
function monolith({ config, compileIn }) {
    // ① installs each quota substrate's config before arranging; the monolith
    // takes the same config.
    for (const [id, n] of Object.entries(config.growthParams.substrateQuotas)) {
        if (n > 0) substrateRegistry.get(id)?.applyPipelineConfig?.(config.growthParams.substrateConfig?.[id]);
    }
    const {
        grid, stats, startCell, goalItem,
    } = arrangeShuffledSpiral(config);
    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: compileIn.seed,
        enableLoopMode: !!compileIn.enableLoopMode,
        regionXpEffect: compileIn.regionXpEffect ?? 'cost',
        completionConditionItem: goalItem,
        procgenMetadata: { driver: 'shuffled-spiral', stop_reason: stats.stopReason },
    });
    return { grid: dumpGrid(grid), rulesJson };
}

// Path B — stepped, in-process.
async function stepped({ config, compileIn }) {
    const env = await runSpiralToStep(newSpiralEnvelope({ config, compileIn }));
    return { grid: dumpGrid(env.regions.grid), rulesJson: env.compile.rulesJson, env };
}

// Path C — stepped with a serialize→deserialize round-trip between EVERY step.
async function steppedSerde({ config, compileIn }) {
    let env = newSpiralEnvelope({ config, compileIn });
    for (const step of SPIRAL_STEPS) {
        // eslint-disable-next-line no-await-in-loop
        await runSpiralStep(step, env);
        env = deserializeSpiralEnvelope(JSON.parse(JSON.stringify(serializeSpiralEnvelope(env))));
    }
    return { grid: dumpGrid(env.regions.grid), rulesJson: env.compile.rulesJson };
}

const PRESETS = {
    // Zone locations on: a jta zone then holds the world's goal (with them off
    // the world has nowhere to put it, and ④ refuses it).
    jtaOnly: preset({
        quotas: { jta: 5 }, start: 'jta', substrateConfig: { jta: { emitZoneLocations: true, goalVictory: false } },
    }),
    mazeOnly: preset({ quotas: { maze: 6 }, start: 'maze' }),
    mazeOnlyS7: preset({ seed: 7, quotas: { maze: 6 }, start: 'maze' }),
    // Mixed: a procedural substrate (maze) draws rng inside the spiral loop, so
    // the ①→③ rng snapshot must be exact. This is the case JtA-only can't prove.
    mixed: preset({
        quotas: { maze: 4, jta: 4 }, start: 'maze',
        items: { key_red: 2, key_blue: 2 },
    }),
    mixedS3: preset({
        seed: 3, quotas: { maze: 5, jta: 3 }, start: 'maze',
        items: { key_red: 2, key_blue: 2, key_green: 1 },
    }),
    // The item layer across every kind of cell: procedural (maze), zone
    // substrates that hold pool items (jta with locations, noiz2sa) and one
    // that holds none (bounce), with the scenario's victory as the goal.
    goalMix: preset({
        seed: 5, quotas: { maze: 2, jta: 2, noiz2sa: 2, bounce: 1 }, start: 'maze',
        items: { key_red: 1, key_blue: 1, key_green: 1, victory: 1 },
        substrateConfig: { jta: { emitZoneLocations: true, goalVictory: false } },
    }),
};

const results = {};
let allOk = true;
for (const [name, p] of Object.entries(PRESETS)) {
    // eslint-disable-next-line no-await-in-loop
    const mono = monolith(p);
    // eslint-disable-next-line no-await-in-loop
    const step = await stepped(p);
    // eslint-disable-next-line no-await-in-loop
    const serde = await steppedSerde(p);
    const gridB = JSON.stringify(mono.grid) === JSON.stringify(step.grid);
    const rulesB = JSON.stringify(mono.rulesJson) === JSON.stringify(step.rulesJson);
    const gridC = JSON.stringify(mono.grid) === JSON.stringify(serde.grid);
    const rulesC = JSON.stringify(mono.rulesJson) === JSON.stringify(serde.rulesJson);
    const ok = gridB && rulesB && gridC && rulesC;
    allOk = allOk && ok;
    const regions = Object.keys(mono.rulesJson.regions?.['1'] ?? {}).length;
    console.log(`${ok ? '✅' : '❌'} ${name}: in-process[grid=${gridB} rules=${rulesB}]`
        + ` serde[grid=${gridC} rules=${rulesC}] (regions=${regions})`);
    results[name] = { rulesJson: mono.rulesJson, grid: mono.grid };
}

const outPath = process.argv[2];
if (outPath) {
    writeFileSync(outPath, JSON.stringify(results, null, 1));
    process.stderr.write(`wrote ${outPath}\n`);
}
console.log(allOk ? '\nALL PASS — stepped spiral == monolith' : '\nFAILURES');
process.exit(allOk ? 0 : 1);
