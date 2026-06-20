/**
 * Headless engine-level proofs for ③ region-step editing (re-roll + bounce
 * editor save). Complements the in-app UI smoke (verify-sphere-steps-ui.mjs).
 *
 * Builds a bounce sphere world, then asserts:
 *   A. Re-roll changes at least one region's geometry, never its exits, and the
 *      sphere oracle still holds after re-rolling every bounce region.
 *   B. An UNCHANGED editor save (assembleBounceRegionFromLevel → merge) keeps
 *      the oracle (the re-derive reproduces the generator's rules).
 *   C. A contract-PRESERVING geometry edit (nudge a platform) keeps the oracle.
 *   D. A contract-BREAKING edit (delete a forward portal) surfaces as an oracle
 *      mismatch (warn-but-allow — the oracle is the backstop).
 *
 * Run: node scripts/procgen/verify-region-step-editing.mjs
 */
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import { assembleBounceRegionFromLevel } from '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import {
    prepareBounceSphereGrowth, buildBounceRegionParams, DEFAULT_BOUNCE_PROCGEN_PARAMS,
} from '../../frontend/modules/bounceDemo/bounceProcgenParams.js';
import {
    growSpheres, reRollSphereRegion, buildRulesJson, buildBounceRegionContract,
    getRegionExits,
} from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import {
    planSpheres, computeItemSpheres, compareSpheresToPlan,
} from '../../frontend/modules/procgenPipeline/spherePlanner.js';

function fail(msg) { console.error('FAIL:', msg); process.exit(1); }

const itemPool = {
    'Right arrow': 1, 'Left arrow': 1, Springs: 1, Jetpacks: 1,
    'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
};
const seed = 1;
const regionSize = { width: 8, height: 6 };

function buildWorld() {
    const prep = prepareBounceSphereGrowth({ itemPool, seed, params: DEFAULT_BOUNCE_PROCGEN_PARAMS });
    const startingItems = prep.startingItems ?? [];
    const plan = planSpheres({
        itemPool: prep.itemPool ?? itemPool, sphereCount: 3, seed,
        exclusiveSpheres: prep.exclusiveSpheres, startingItems, victoryItem: 'Victory',
    });
    const regionParams = {
        ...buildBounceRegionParams({ params: DEFAULT_BOUNCE_PROCGEN_PARAMS, mode: 'sphere' }),
        ...(prep.regionParams ?? {}),
    };
    const config = {
        regionSize, itemLib: prep.itemLib, seed, regionParams,
        growthParams: {
            spherePlan: plan, maxItemsPerRegion: 2, fillerCount: 0, revisitRatio: 0.25,
            substrateQuotas: { bounce: 99 }, startSubstrate: 'bounce',
        },
    };
    const grown = growSpheres(config);
    return { ...grown, plan, prep, regionParams, startingItems };
}

function oracle(grid, startCell, stats, plan, prep, startingItems) {
    const rj = buildRulesJson(grid, {
        startCell, seed, itemLib: prep.itemLib, startingItems,
        ...(startingItems.length > 0 ? {
            sourceItems: Object.fromEntries(startingItems.map((n, i) => [n, {
                name: n, id: 999 - i, classification: 'progression', groups: ['Everything'],
            }])),
        } : {}),
        completionConditionItem: 'Victory',
        procgenMetadata: { driver: 'sphere-growth', stop_reason: stats.stopReason, sphere_plan: plan },
    });
    return compareSpheresToPlan(computeItemSpheres(rj), plan);
}

const platSig = (r) => JSON.stringify(
    (r.playable_payload.params.bounceLevel.platforms ?? []).map((p) => [p.x, p.y, p.type]));
const exitKeys = (r) => [...getRegionExits(r).keys()].sort().join(',');

// Editor save merge (mirrors bounceRegionEditorUI._buildEditedRegion).
function buildEdited(region, contract, level) {
    const built = assembleBounceRegionFromLevel(level, {
        region_id: region.region_id,
        exitSpecs: contract.exitSpecs ?? [],
        locationSpecs: contract.locationSpecs ?? [],
        physicsProfile: contract.physicsProfile ?? 'experimental',
        mode: contract.mode ?? 'column',
        freeArrow: contract.freeArrow ?? 'right',
    });
    const next = structuredClone(region);
    next.playable_payload = built.payload;
    next.obstacle_defs = built.obstacleDefs;
    const sideByExitId = new Map((region.exits_placed ?? []).map((p) => [p.exit_id, p.side]));
    for (const ex of next.extracted_rules?.exits ?? []) {
        const side = sideByExitId.get(ex.id);
        if (side && built.exitPaths[side]) {
            ex.paths = built.exitPaths[side];
            ex.access_rule = built.exitRules[side];
        }
    }
    const byId = new Map(built.locations.map((l) => [l.id, l]));
    for (const loc of next.extracted_rules?.locations ?? []) {
        const b = byId.get(loc.id);
        if (b) { loc.paths = b.paths; loc.access_rule = b.access_rule; }
    }
    return next;
}

// ── A. Re-roll: geometry varies, exits fixed, oracle holds ─────────────
{
    const { grid, tree, startCell, stats, plan, prep, regionParams, startingItems } = buildWorld();
    if (oracle(grid, startCell, stats, plan, prep, startingItems).length) fail('baseline oracle');
    let anyGeometryChanged = false;
    for (const node of tree.nodes) {
        if (node.parent == null || node.substrate !== 'bounce') continue;
        const before = grid.getRegion(node.cell);
        const sig0 = platSig(before);
        const ex0 = exitKeys(before);
        reRollSphereRegion(grid, node, tree, { seed: 4242 + node.index, regionSize, regionParams });
        const after = grid.getRegion(node.cell);
        if (exitKeys(after) !== ex0) fail(`re-roll changed exits of ${node.region_id}`);
        if (platSig(after) !== sig0) anyGeometryChanged = true;
    }
    const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
    if (errs.length) fail(`oracle after re-rolling all: ${errs[0]}`);
    if (!anyGeometryChanged) fail('re-roll never changed geometry for any region');
    console.log('A. re-roll: geometry varied, exits fixed, oracle holds — OK');
}

// ── B/C/D. Editor save: unchanged / nudge / contract-break ─────────────
{
    const { grid, tree, startCell, stats, plan, prep, regionParams, startingItems } = buildWorld();
    const node = tree.nodes.find((n) => n.parent != null && n.substrate === 'bounce')
        ?? fail('no non-root bounce region');
    const contract = buildBounceRegionContract(node, tree, grid, regionSize, regionParams);

    // B. unchanged
    {
        const region = grid.getRegion(node.cell);
        const level = structuredClone(region.playable_payload.params.bounceLevel);
        grid.replaceRegion(node.cell, buildEdited(region, contract, level));
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (errs.length) fail(`unchanged-save oracle: ${errs[0]}`);
        console.log('B. unchanged editor save keeps oracle — OK');
    }
    // C. nudge a platform
    {
        const region = grid.getRegion(node.cell);
        const level = structuredClone(region.playable_payload.params.bounceLevel);
        if (level.platforms[0]) {
            level.platforms[0].x = Math.min(level.size.width - 1, level.platforms[0].x + 1);
        }
        grid.replaceRegion(node.cell, buildEdited(region, contract, level));
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (errs.length) fail(`nudge-edit oracle: ${errs[0]}`);
        console.log('C. contract-preserving nudge keeps oracle — OK');
    }
    // D. delete a forward portal (contract break) → oracle must FAIL
    {
        const region = grid.getRegion(node.cell);
        const level = structuredClone(region.playable_payload.params.bounceLevel);
        const fwdSide = contract.exitSpecs[0]?.side;
        level.portals = (level.portals ?? []).filter((p) => p.id !== `side_exit_${fwdSide}`);
        grid.replaceRegion(node.cell, buildEdited(region, contract, level));
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (!errs.length) fail('contract-break did NOT surface as an oracle mismatch');
        console.log(`D. contract-break surfaces (oracle: ${errs[0]}) — OK`);
    }
}

console.log('VERIFY REGION-STEP EDITING: ALL OK');
