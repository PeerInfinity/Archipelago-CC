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
import {
    assembleBounceRegionFromLevel, generateZoneForSpecs,
} from '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
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

// Editor save merge (mirrors bounceRegionEditorUI._buildEditedRegion): exits
// keep the contract; locations come from the edited level's pickups (item picks
// + add/remove flow through).
function buildEdited(region, contract, level) {
    const locationSpecs = (level.pickups ?? []).map((pk) => ({
        id: pk.id, item: pk.item ?? null, requirement: [], counts: {},
    }));
    const built = assembleBounceRegionFromLevel(level, {
        region_id: region.region_id,
        exitSpecs: contract.exitSpecs ?? [],
        locationSpecs,
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
    if (next.extracted_rules) next.extracted_rules.locations = built.locations;
    return next;
}

// Backfill pickup.item from the contract (the level model doesn't store it).
function withPickupItems(level, contract) {
    const itemById = new Map((contract.locationSpecs ?? []).map((l) => [l.id, l.item]));
    for (const pk of level.pickups ?? []) {
        if (pk.item == null && itemById.has(pk.id)) pk.item = itemById.get(pk.id);
    }
    return level;
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

// ── B/C/D/E. Editor save: unchanged / nudge / contract-break / item pick ─
{
    const { grid, tree, startCell, stats, plan, prep, regionParams, startingItems } = buildWorld();
    const node = tree.nodes.find((n) => n.parent != null && n.substrate === 'bounce'
        && (n.items?.length || 0) > 0) ?? fail('no non-root bounce region with items');
    const contract = buildBounceRegionContract(node, tree, grid, regionSize, regionParams);
    const cloneLevel = () => withPickupItems(
        structuredClone(grid.getRegion(node.cell).playable_payload.params.bounceLevel), contract);

    // B. unchanged
    {
        const region = grid.getRegion(node.cell);
        grid.replaceRegion(node.cell, buildEdited(region, contract, cloneLevel()));
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (errs.length) fail(`unchanged-save oracle: ${errs[0]}`);
        console.log('B. unchanged editor save keeps oracle — OK');
    }
    // C. nudge a platform
    {
        const region = grid.getRegion(node.cell);
        const level = cloneLevel();
        if (level.platforms[0]) {
            level.platforms[0].x = Math.min(level.size.width - 1, level.platforms[0].x + 1);
        }
        grid.replaceRegion(node.cell, buildEdited(region, contract, level));
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (errs.length) fail(`nudge-edit oracle: ${errs[0]}`);
        console.log('C. contract-preserving nudge keeps oracle — OK');
    }
    // E. change a pickup's item (world-pool pick) → the saved location's item
    // reflects it (oracle flags an off-plan pick — warn-but-allow; here we just
    // prove the pick flows through the save).
    {
        const region = grid.getRegion(node.cell);
        const level = cloneLevel();
        const pk = (level.pickups ?? [])[0] ?? fail('E: region has no pickup');
        const newItem = pk.item === 'Victory' ? 'Springs' : 'Victory';
        pk.item = newItem;
        const edited = buildEdited(region, contract, level);
        const loc = edited.extracted_rules.locations.find((l) => l.id === pk.id);
        if (loc?.item !== newItem) fail(`E: pickup item did not flow through (got ${loc?.item})`);
        console.log(`E. pickup item pick flows through save (${pk.id} → ${newItem}) — OK`);
    }
    // D. delete a forward portal (contract break) → oracle must FAIL
    {
        const region = grid.getRegion(node.cell);
        const level = cloneLevel();
        const fwdSide = contract.exitSpecs[0]?.side;
        level.portals = (level.portals ?? []).filter((p) => p.id !== `side_exit_${fwdSide}`);
        grid.replaceRegion(node.cell, buildEdited(region, contract, level));
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (!errs.length) fail('contract-break did NOT surface as an oracle mismatch');
        console.log(`D. contract-break surfaces (oracle: ${errs[0]}) — OK`);
    }
}

// ── F. Editor Regenerate (keep mode): rebuild geometry from settings on a new
// seed, preserving the exit/location contract → oracle holds; geometry varies.
{
    const { grid, tree, startCell, stats, plan, prep, regionParams, startingItems } = buildWorld();
    const node = tree.nodes.find((n) => n.parent != null && n.substrate === 'bounce'
        && (n.items?.length || 0) > 0) ?? fail('F: no non-root bounce region with items');
    const contract = buildBounceRegionContract(node, tree, grid, regionSize, regionParams);
    const region = grid.getRegion(node.cell);
    const sig0 = platSig(region);
    // Mirror _regenerate (keep): generateZoneForSpecs with the contract specs +
    // settings (bump seed + add platformRows so geometry must change), then the
    // same save merge.
    const built = generateZoneForSpecs({
        region_id: region.region_id,
        exitSpecs: contract.exitSpecs,
        locationSpecs: (contract.locationSpecs ?? []).map((l) => ({ ...l })),
        seed: 13579, mode: contract.mode, braidWidth: regionParams.braidWidth,
        jitter: regionParams.bounceJitter, decorChance: regionParams.bounceDecorChance,
        freeArrow: contract.freeArrow, platformRows: 2,
        physicsProfile: contract.physicsProfile,
    });
    const regen = built.payload.params.bounceLevel;
    const itemById = new Map((contract.locationSpecs ?? []).map((l) => [l.id, l.item]));
    for (const pk of regen.pickups ?? []) if (itemById.has(pk.id)) pk.item = itemById.get(pk.id);
    grid.replaceRegion(node.cell, buildEdited(region, contract, regen));
    const after = grid.getRegion(node.cell);
    if (platSig(after) === sig0) fail('F: regenerate did not change geometry');
    const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
    if (errs.length) fail(`F: oracle after regenerate: ${errs[0]}`);
    console.log('F. Regenerate (keep) varied geometry + kept oracle — OK');
}

console.log('VERIFY REGION-STEP EDITING: ALL OK');
