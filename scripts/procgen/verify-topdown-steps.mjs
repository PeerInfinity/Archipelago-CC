// Verify the stepped TOP-DOWN runner (topDownSteps.js) reproduces the monolithic
// topDownFromRulesJson engine-phase output byte-for-byte, and that ④ compile
// yields a well-formed rules.json. The runner calls the same engine functions in
// the same order on a single rng created in ①, so layout+realise+finalize must
// match the monolith exactly. Run:
//   node scripts/procgen/verify-topdown-steps.mjs
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import {
    topDownFromRulesJson, getRegionExits, getRegionEntrance,
} from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import {
    newTopDownEnvelope, runTopDownToStep, runTopDownStep, TOPDOWN_STEPS,
    serializeTDEnvelope, deserializeTDEnvelope,
} from '../../frontend/modules/procgenPipeline/topDownSteps.js';

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

function mazeSource() {
    const reg = (name, exits, locs) => ({ name, exits, locations: locs });
    const has = (item) => ({ rule: 'Has', args: { item_name: item } });
    const T = { rule: 'True_' };
    return {
        start_regions: { '1': { default: ['Menu'] } },
        assume_bidirectional_exits: true,
        game_name: 'MazeStepCheck',
        regions: {
            '1': {
                Menu: reg('Menu', [{ name: 'GameStart', connected_region: 'Hub', access_rule: T }], []),
                Hub: reg('Hub', [
                    { name: 'toN', connected_region: 'North', access_rule: T },
                    { name: 'toE', connected_region: 'East', access_rule: T },
                    { name: 'toW', connected_region: 'West', access_rule: T },
                ], [{ name: 'Hub_Chest', item: { name: 'key_red' } }]),
                North: reg('North', [{ name: 'toDeep', connected_region: 'Deep', access_rule: has('key_red') }],
                    [{ name: 'North_A', item: { name: 'key_blue' } }, { name: 'North_B', item: { name: 'f1' } }]),
                East: reg('East', [], [{ name: 'East_A', item: { name: 'Victory' } }]),
                West: reg('West', [{ name: 'toDeep2', connected_region: 'Deep', access_rule: has('key_blue') }],
                    [{ name: 'West_A', item: { name: 'f3' } }]),
                Deep: reg('Deep', [], [{ name: 'Deep_A', item: { name: 'f4' } }]),
            },
        },
    };
}

function check(label, source, opts) {
    // Path A — monolith engine phases.
    const mono = topDownFromRulesJson(source, opts);

    // Path B — stepped runner over a fresh envelope (same opts).
    const env = newTopDownEnvelope({
        source,
        opts,
        regionSize: { width: opts.regionSizeBase.width, height: opts.regionSizeBase.height },
        compileIn: {
            seed: opts.seed,
            enableLoopMode: false,
            regionXpEffect: 'cost',
            assumeBidirectional: source.assume_bidirectional_exits !== false,
            startingItems: opts.freeItems ?? [],
            grantedItems: [],
            sourceItemDefs: source.items?.['1'] ?? {},
            sourceGameName: source.game_name ?? null,
            sphereLog: opts.sphereLog ?? null,
        },
    });
    // run synchronously to completion (await — realise is async)
    return runTopDownToStep(env, 'compile').then(() => {
        const gMono = JSON.stringify(dumpGrid(mono.grid));
        const gStep = JSON.stringify(dumpGrid(env.finalize.grid));
        const sameGrid = gMono === gStep;
        const sameStats = JSON.stringify(mono.stats) === JSON.stringify(env.finalize.stats);
        const rj = env.compile?.rulesJson;
        const wellFormed = !!rj && !!rj.regions && Object.keys(rj.regions['1'] ?? {}).length > 0;
        const ok = sameGrid && sameStats && wellFormed;
        console.log(`${ok ? '✅' : '❌'} ${label}: grid=${sameGrid} stats=${sameStats} rulesJson=${wellFormed}`
            + ` (driver=${rj?.procgen_metadata?.driver}, regions=${Object.keys(rj?.regions?.['1'] ?? {}).length})`);
        return ok;
    });
}

// Codec round-trip: stepping with a serialize→deserialize between EVERY step
// (the CLI's cross-process path) must reproduce a straight-through run exactly.
function envFor(source, opts) {
    return newTopDownEnvelope({
        source,
        opts,
        regionSize: { width: opts.regionSizeBase.width, height: opts.regionSizeBase.height },
        compileIn: {
            seed: opts.seed,
            enableLoopMode: false,
            regionXpEffect: 'cost',
            assumeBidirectional: source.assume_bidirectional_exits !== false,
            startingItems: opts.freeItems ?? [],
            grantedItems: [],
            sourceItemDefs: source.items?.['1'] ?? {},
            sourceGameName: source.game_name ?? null,
            sphereLog: opts.sphereLog ?? null,
        },
    });
}

async function checkCodec(label, source, opts) {
    // straight-through
    const straight = envFor(source, opts);
    await runTopDownToStep(straight, 'compile');
    // stepped with a serde round-trip between each step
    let env = envFor(source, opts);
    for (const step of TOPDOWN_STEPS) {
        await runTopDownStep(step, env);
        env = deserializeTDEnvelope(JSON.parse(JSON.stringify(serializeTDEnvelope(env))));
    }
    const same = JSON.stringify(straight.compile.rulesJson) === JSON.stringify(env.compile.rulesJson);
    console.log(`${same ? '✅' : '❌'} ${label}: cross-process (serde each step) == straight-through`);
    return same;
}

// Decoupling (the point of 1b): bumping ONE region's realisation sub-seed
// re-rolls that region and AT MOST its BFS descendants (a child's entrance is
// positioned to match its parent's exit tile — a structural dependency), never
// its siblings / ancestors / other-branch regions. Pre-1b a single change shifted
// the shared rng and perturbed EVERY later region; `expected` is the precise
// allowed change set.
async function checkDecoupling(label, source, opts, target, expected) {
    const a = envFor(source, opts);
    const b = envFor(source, opts);
    await runTopDownStep('layout', a);
    await runTopDownStep('layout', b);
    b.layout.subSeedByRegion[target] = (b.layout.subSeedByRegion[target] ^ 0x55555555) >>> 0;
    await runTopDownStep('realise', a);
    await runTopDownStep('realise', b);
    const ga = dumpGrid(a.realise.grid);
    const gb = dumpGrid(b.realise.grid);
    const changed = [];
    for (const name of new Set([...Object.keys(ga), ...Object.keys(gb)])) {
        if (JSON.stringify(ga[name]) !== JSON.stringify(gb[name])) changed.push(name);
    }
    const exp = [...expected].sort().join(',');
    const got = [...changed].sort().join(',');
    const ok = exp === got;
    console.log(`${ok ? '✅' : '❌'} ${label}: re-roll '${target}' changed [${got}] (expected [${exp}])`);
    return ok;
}

const results = [];
results.push(await check('maze s1', mazeSource(), { gridDims: { width: 4, height: 4 }, regionSizeBase: { width: 6, height: 6 }, seed: 1, substrateMix: { maze: 1 } }));
results.push(await check('maze s7', mazeSource(), { gridDims: { width: 4, height: 4 }, regionSizeBase: { width: 6, height: 6 }, seed: 7, substrateMix: { maze: 1 } }));
results.push(await checkCodec('maze s1 codec', mazeSource(), { gridDims: { width: 4, height: 4 }, regionSizeBase: { width: 6, height: 6 }, seed: 1, substrateMix: { maze: 1 } }));
results.push(await checkCodec('maze s3 codec', mazeSource(), { gridDims: { width: 4, height: 4 }, regionSizeBase: { width: 6, height: 6 }, seed: 3, substrateMix: { maze: 1 } }));
// East is a leaf → only East changes. North is Deep's BFS parent → North + Deep
// (Deep re-aligns its entrance to North's moved exit). Siblings/ancestors untouched.
results.push(await checkDecoupling('maze s1 leaf', mazeSource(), { gridDims: { width: 4, height: 4 }, regionSizeBase: { width: 6, height: 6 }, seed: 1, substrateMix: { maze: 1 } }, 'East', ['East']));
results.push(await checkDecoupling('maze s1 parent', mazeSource(), { gridDims: { width: 4, height: 4 }, regionSizeBase: { width: 6, height: 6 }, seed: 1, substrateMix: { maze: 1 } }, 'North', ['North', 'Deep']));

const allOk = results.every(Boolean);
console.log(allOk ? '\nALL PASS — stepped runner == monolith' : '\nFAILURES');
process.exit(allOk ? 0 : 1);
