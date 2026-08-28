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
 *   K. The RECORDED path (editor-integration B-d): the four layout ops plus a
 *      re-roll pushed onto a stepped envelope reproduce, from `config + seed +
 *      edits` alone on a FRESH envelope, the same grid AND a clean oracle.
 *   L. Undo ×N over that recording returns the never-edited grid, byte for
 *      byte, with the oracle still clean and `completed` back at the end.
 *   N. The bounce EDIT SESSION (editor-integration B-b): N ops through
 *      `createEditSession(bounceEditAdapter, level)` → undo ×N → the record is
 *      the base byte for byte, and `buildEditedRegion` over the undone record
 *      reproduces the UNEDITED save's region exactly.
 *
 * ⚠ NO BROWSER. This verifier is pure Node (unlike its two `*-steps-ui.mjs`
 * siblings), so it has no dev-server host to shift and runs under a busy box.
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
    newEnvelope as newSphereEnvelope, runToStep as runSphereToStep,
    resumeEnvelope as resumeSphereEnvelope, SPHERE_STEPS,
    SPHERE_EDIT_BINDING, sphereNodeKey, sphereUndoStep, invalidateSphereFrom,
} from '../../frontend/modules/procgenPipeline/sphereSteps.js';
import {
    pushLayoutEdit, popLayoutEdit, describeLayoutEdit,
} from '../../frontend/modules/procgenPipeline/layoutEdits.js';
import {
    growSpheres, reRollSphereRegion, buildRulesJson, buildRegionContract,
    getRegionExits, moveSphereRegion, swapSphereRegions,
    moveSphereExitSide, swapSphereExitSides,
} from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import {
    planSpheres, computeItemSpheres, compareSpheresToPlan,
} from '../../frontend/modules/procgenPipeline/spherePlanner.js';
import { createEditSession, group } from '../../frontend/modules/procgenCore/editCore.js';
import { bounceEditAdapter } from '../../frontend/modules/bounceRegionEditor/bounceEditAdapter.js';
import { deletePlatformOps } from '../../frontend/modules/bounceRegionEditor/bounceLevelOps.js';
import { buildEditedRegion } from '../../frontend/modules/bounceRegionEditor/buildEditedRegion.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
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

// ⛓⛓⛓ THE EDITOR SAVE MERGE, **IMPORTED** (editor-integration B-b).
//
// ⛔ This was a COPY of `bounceRegionEditorUI._buildEditedRegion`, under a
// comment saying it mirrored it — so Phases B/C/D/E/F, which are byte-shaped
// pins on what a save produces, were pinning the COPY. A drift in the panel's
// merge would have left this verifier green while the app wrote a different
// region. The body now lives in `bounceRegionEditor/buildEditedRegion.js` and
// both callers import it; `bounceEditAdapter.test.js` pins the export against
// a transcription of the old panel body, byte for byte, over four settings
// shapes.
//
// ⚠ The three-argument spelling stays so the five call sites below are
// unmoved: this verifier passes no `settings`, which is exactly the arm that
// reproduces the contract's own values.
const buildEdited = (region, contract, level) => buildEditedRegion({ region, contract, level });

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
    const contract = buildRegionContract(node.substrate, node, tree, grid, regionSize, regionParams);
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
    const contract = buildRegionContract(node.substrate, node, tree, grid, regionSize, regionParams);
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

// ── G/H. Composite-map layout edits: move a region to an empty cell, and swap
// two regions (incl. the start region) — connections rewired, oracle holds.
// Mirrors the panel's _applyGridEdit: keep startCell pointing at the start
// region after the edit (a move/swap may relocate it).
{
    const { grid, startCell, stats, plan, prep, startingItems } = buildWorld();
    const startId = grid.getRegion(startCell).region_id;
    const cellOf = (id) => grid.allRegions().find((r) => r.region_id === id)?.cell;

    // G. move a non-start region to an empty cell.
    let empty = null;
    for (let gx = 0; gx < grid.width && !empty; gx++) {
        for (let gy = 0; gy < grid.height && !empty; gy++) {
            if (!grid.hasRegion({ gx, gy })) empty = { gx, gy };
        }
    }
    const mover = grid.allRegions().find((r) => r.region_id !== startId)
        ?? fail('G: no non-start region');
    moveSphereRegion(grid, mover.cell, empty);
    {
        const errs = oracle(grid, cellOf(startId), stats, plan, prep, startingItems);
        if (errs.length) fail(`G: oracle after move: ${errs[0]}`);
        console.log('G. move region → empty cell keeps oracle — OK');
    }

    // H. swap two regions, one of which is the START (exercises the startCell
    // recompute — without it the oracle reads the wrong start and fails).
    const startCellNow = cellOf(startId);
    const other = grid.allRegions().find((r) => r.region_id !== startId);
    swapSphereRegions(grid, startCellNow, other.cell);
    {
        const errs = oracle(grid, cellOf(startId), stats, plan, prep, startingItems);
        if (errs.length) fail(`H: oracle after swap (incl. start): ${errs[0]}`);
        console.log('H. swap regions (incl. start) keeps oracle — OK');
    }
}

// ── I/J. Move Exits: relabel one exit to an empty side, and swap two exits'
// sides within a region — connections + sidePortals rewired, oracle holds.
{
    const { grid, startCell, stats, plan, prep, startingItems } = buildWorld();
    const node = grid.allRegions().find((r) => {
        const l = [...getRegionExits(r).values()];
        return l.some((e) => e.isBackExit) && l.some((e) => !e.isBackExit);
    }) ?? fail('I: no region with both a forward exit and a back-exit');
    const exitList = () => [...getRegionExits(grid.getRegion(node.cell)).values()];

    // I. move the forward exit to an empty side.
    {
        const fwd = exitList().find((e) => !e.isBackExit);
        const used = new Set(exitList().map((e) => e.side));
        const empty = ['N', 'S', 'E', 'W'].find((s) => !used.has(s)) ?? fail('I: no empty side');
        moveSphereExitSide(grid, node.cell, fwd.exit_id, empty, regionSize);
        const moved = exitList().find((e) => e.exit_id === fwd.exit_id);
        if (moved.side !== empty) fail(`I: exit did not move to ${empty}`);
        const params = grid.getRegion(node.cell).playable_payload.params;
        if (params.sidePortals[empty] === undefined) fail('I: sidePortals not re-keyed to the new side');
        // The level portal arrow direction must follow the new side.
        const DIR = { N: 'up', S: 'down', E: 'right', W: 'left' };
        const portal = params.bounceLevel.portals.find((p) => p.id === params.sidePortals[empty]);
        if (portal && portal.direction !== DIR[empty]) {
            fail(`I: portal direction ${portal.direction} != ${DIR[empty]} for side ${empty}`);
        }
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (errs.length) fail(`I: oracle after move-exit-side: ${errs[0]}`);
        console.log('I. move exit → empty side keeps oracle (sidePortals + arrow re-keyed) — OK');
    }
    // J. swap the two exits' sides.
    {
        const [a, b] = exitList();
        const [sa, sb] = [a.side, b.side];
        swapSphereExitSides(grid, node.cell, a.exit_id, b.exit_id, regionSize);
        const a2 = exitList().find((e) => e.exit_id === a.exit_id);
        const b2 = exitList().find((e) => e.exit_id === b.exit_id);
        if (a2.side !== sb || b2.side !== sa) fail('J: exit sides did not swap');
        const errs = oracle(grid, startCell, stats, plan, prep, startingItems);
        if (errs.length) fail(`J: oracle after swap-exit-sides: ${errs[0]}`);
        console.log('J. swap exit sides keeps oracle — OK');
    }
}

// ── K/L. The RECORDED path (editor-integration B-d). Everything above drives
// the engine mutators DIRECTLY; these two drive them through the recorded edit
// list on a stepped envelope, which is what the panel and the CLI now do. The
// value here over the vitest rows is the sphere ORACLE: a replayed world must
// not just match a hash, it must still be solvable to plan.

// The same bounce world buildWorld() grows, as a stepped ENVELOPE.
function buildEnvConfig() {
    const prep = prepareBounceSphereGrowth({ itemPool, seed, params: DEFAULT_BOUNCE_PROCGEN_PARAMS });
    return {
        seed,
        regionSize,
        itemLib: prep.itemLib,
        regionParams: {
            ...buildBounceRegionParams({ params: DEFAULT_BOUNCE_PROCGEN_PARAMS, mode: 'sphere' }),
            ...(prep.regionParams ?? {}),
        },
        maxItemsPerRegion: 2,
        fillerCount: 0,
        revisitRatio: 0.25,
        substrateQuotas: { bounce: 99 },
        startSubstrate: 'bounce',
        sphereCount: 3,
        victoryItem: 'Victory',
        exclusiveSpheres: prep.exclusiveSpheres ?? {},
        startingItems: prep.startingItems ?? [],
        lockedCanonicalItems: [],
        enableLoopMode: false,
        regionXpEffect: 'cost',
        itemPool: prep.itemPool ?? itemPool,
    };
}

const gridSig = (grid) => JSON.stringify(grid.allRegions()
    .map((r) => [r.region_id, r.cell.gx, r.cell.gy, platSig(r), exitKeys(r)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1)));

function emptyCellOf(grid) {
    for (let gy = 0; gy < grid.height; gy += 1) {
        for (let gx = 0; gx < grid.width; gx += 1) {
            if (!grid.hasRegion({ gx, gy })) return { gx, gy };
        }
    }
    return null;
}

{
    const config = buildEnvConfig();

    // The never-edited reference.
    const clean = newSphereEnvelope({ ...config });
    await runSphereToStep(clean, 'compile');
    if (clean.compile.oracleErrors.length) fail(`K: baseline oracle: ${clean.compile.oracleErrors[0]}`);
    const cleanSig = gridSig(clean.grow.grid);

    // Push the four layout ops plus a re-roll, each resolved against the LIVE
    // grid the way a second click would be.
    const env = newSphereEnvelope({ ...config });
    await runSphereToStep(env, 'regions');
    const live = (id) => ({ ...env.grow.grid.allRegions().find((r) => r.region_id === id).cell });
    const ids = env.grow.grid.allRegions().map((r) => r.region_id);
    const startId = env.grow.grid.getRegion(env.grow.startCell).region_id;
    const moverId = ids.find((i) => i !== startId) ?? fail('K: need a non-start region');
    const swapId = ids.find((i) => i !== startId && i !== moverId) ?? startId;

    const push = (edit, label) => {
        const r = pushLayoutEdit(env, edit, SPHERE_EDIT_BINDING);
        if (!r.ok) fail(`K: ${label} refused: ${r.error}`);
        return r;
    };
    push({ op: 'move-region', from: live(moverId), to: emptyCellOf(env.grow.grid) }, 'move-region');
    push({ op: 'swap-regions', a: live(swapId), b: live(moverId) }, 'swap-regions');

    // A region with a forward exit AND a back-exit carries sidePortals, so the
    // exit-side ops apply there.
    const exitHost = env.grow.grid.allRegions().find((r) => {
        const l = [...getRegionExits(r).values()];
        return l.some((e) => e.isBackExit) && l.some((e) => !e.isBackExit);
    }) ?? fail('K: no region with both a forward exit and a back-exit');
    const hostExits = () => [...getRegionExits(env.grow.grid.getRegion(live(exitHost.region_id))).values()];
    const fwd = hostExits().find((e) => !e.isBackExit);
    const used = new Set(hostExits().map((e) => e.side));
    const freeSide = ['N', 'S', 'E', 'W'].find((x) => !used.has(x)) ?? fail('K: no empty side');
    push({
        op: 'move-exit-side', cell: live(exitHost.region_id), exitId: fwd.exit_id, side: freeSide,
    }, 'move-exit-side');
    const rerollNode = env.nodes.find((n) => n.region_id === moverId);
    push({ op: 're-roll', region_id: sphereNodeKey(rerollNode), n: 1 }, 're-roll');

    // M. swap-exit-sides + a LATER re-roll on the same branch: the swap can put
    // the grid into a state the TREE cannot represent, because a region's
    // entrance side is DERIVED (OPPOSITE_SIDE[node.side]) rather than stored, so
    // moving a BACK-exit has no home in the tree. The contract's promise is that
    // this REFUSES loudly and leaves the grid untouched — which is what this
    // asserts. (Making it representable needs a stored entrance side on the
    // node: an engine change, outside B-d.)
    {
        const before = gridSig(env.grow.grid);
        const editCount = env.edits.length;
        const h = env.grow.grid.allRegions().find((r) => {
            const l = [...getRegionExits(r).values()];
            return l.some((e) => e.isBackExit) && l.some((e) => !e.isBackExit);
        });
        if (h) {
            const [ea, eb] = [...getRegionExits(h).values()];
            const sw = pushLayoutEdit(env, {
                op: 'swap-exit-sides', cell: { ...h.cell }, exitA: ea.exit_id, exitB: eb.exit_id,
            }, SPHERE_EDIT_BINDING);
            if (!sw.ok) fail(`M: swap-exit-sides itself refused: ${sw.error}`);
            const again = pushLayoutEdit(env, {
                op: 're-roll', region_id: sphereNodeKey(rerollNode), n: 2,
            }, SPHERE_EDIT_BINDING);
            if (again.ok) {
                console.log('M. swap-exit-sides then re-roll: ACCEPTED (representable here) — OK');
            } else {
                console.log(`M. swap-exit-sides then re-roll REFUSES loudly (${again.error}) `
                    + 'and records nothing — OK');
                if (env.edits.length !== editCount + 1) {
                    fail(`M: refusal recorded an edit (${env.edits.length} vs ${editCount + 1})`);
                }
            }
            // Either way, roll the probe back so K/L measure the 4-edit list.
            while (env.edits.length > editCount) popLayoutEdit(env, SPHERE_EDIT_BINDING);
            invalidateSphereFrom(env, 'regions');
            await resumeSphereEnvelope(env, 'regions');
            if (gridSig(env.grow.grid) !== before) {
                fail('M: rolling the probe back did not restore the 4-edit grid');
            }
        }
    }

    await runSphereToStep(env, 'compile');
    if (env.compile.oracleErrors.length) fail(`K: oracle after 4 edits: ${env.compile.oracleErrors[0]}`);
    if (gridSig(env.grow.grid) === cleanSig) fail('K: 4 edits changed nothing (the row would be vacuous)');

    // …and the recording alone reproduces it on a FRESH envelope.
    const replayed = newSphereEnvelope({ ...config });
    replayed.edits = env.edits.map((e) => ({ ...e }));
    await runSphereToStep(replayed, 'compile');
    if (gridSig(replayed.grow.grid) !== gridSig(env.grow.grid)) {
        fail('K: replay from config + seed + edits did not reproduce the edited grid');
    }
    if (replayed.compile.oracleErrors.length) {
        fail(`K: replayed oracle: ${replayed.compile.oracleErrors[0]}`);
    }
    console.log(`K. ${env.edits.length} recorded edits replay from config + seed + edits `
        + `(oracle clean) — ${env.edits.map(describeLayoutEdit).join(' · ')} — OK`);

    // L. Undo them all.
    let undone = 0;
    while (env.edits.length) {
        const popped = popLayoutEdit(env, SPHERE_EDIT_BINDING);
        invalidateSphereFrom(env, sphereUndoStep(popped.edit));
        // eslint-disable-next-line no-await-in-loop
        await resumeSphereEnvelope(env, 'compile');
        undone += 1;
    }
    if (gridSig(env.grow.grid) !== cleanSig) fail('L: undo ×N did not restore the never-edited grid');
    if (env.compile.oracleErrors.length) fail(`L: oracle after undo: ${env.compile.oracleErrors[0]}`);
    if (env.completed !== SPHERE_STEPS.length - 1) {
        fail(`L: completed is ${env.completed}, expected ${SPHERE_STEPS.length - 1}`);
    }
    console.log(`L. undo ×${undone} → the never-edited grid, oracle clean, completed=${env.completed} — OK`);
}

// ── N. The bounce EDIT SESSION (editor-integration B-b) ────────────────
//
// ⛓⛓⛓ The panel's eight mutators are now ops on an `editCore` session, and
// UNDO is the fold over a shorter list. This phase asks the two things the
// panel's own gate cannot ask headlessly: that N ops undo to the BASE byte for
// byte, and that a save built from the undone record is the save the unedited
// region would have produced. ⛔ The second half is what makes undo a fact
// about the REGION rather than about the level object: `buildEditedRegion` is
// the only thing between the two.
{
    const { grid, tree, regionParams } = buildWorld();
    const node = tree.nodes.find((n) => n.parent != null && n.substrate === 'bounce');
    const region = grid.getRegion(node.cell);
    const contract = buildRegionContract(
        node.substrate, node, tree, grid, regionSize, regionParams);
    const startLevel = withPickupItems(
        structuredClone(region.playable_payload.params.bounceLevel), contract);
    const startSig = JSON.stringify(startLevel);
    const unedited = JSON.stringify(buildEditedRegion({
        region, contract, level: structuredClone(startLevel),
    }));

    const sess = createEditSession(bounceEditAdapter, structuredClone(startLevel), {
        base: { kind: 'bounce-level', region_id: region.region_id },
    });
    const push = (op) => {
        const res = sess.apply(op);
        if (!res.ok) fail(`N: op ${JSON.stringify(op.op ?? op.label)} was REFUSED — ${res.description}`);
        if (!res.applied) fail(`N: op ${JSON.stringify(op.op ?? op.label)} moved nothing`);
        return res;
    };
    push({ op: 'resize', dim: 'width', value: sess.record().size.width + 40 });
    const added = push({ op: 'add-platform' });
    push({ op: 'set-platform', id: sess.record().platforms[0].id, patch: { type: 'brown' } });
    push({ op: 'add-entity', kind: 'pickups', on: added.value.id, item: 'Victory' });
    // ⛓ THE CASCADE, built from the CURRENT record — `deletePlatformOps`
    //   enumerates the orphans, so it must read the level the delete will run
    //   against, not the one the session opened on.
    const hosted = ['springs', 'jetpacks', 'pickups', 'portals', 'teleports'];
    const target = sess.record().platforms.find(
        (p) => hosted.some((k) => (sess.record()[k] ?? []).some((e) => e.on === p.id)));
    if (!target) fail('N: no hosted platform to delete — the cascade arm would be vacuous');
    const cascade = deletePlatformOps(sess.record(), target.id);
    if (cascade.length < 2) fail(`N: the cascade for '${target.id}' has no remove-entity member`);
    push(group(`delete platform ${target.id}`, cascade));
    const applied = 5;
    if (sess.ops().length !== applied) {
        fail(`N: ${sess.ops().length} ops recorded, applied ${applied}`);
    }
    if (JSON.stringify(sess.record()) === startSig) fail('N: the ops moved nothing at all');

    let undone = 0;
    while (sess.undo()) undone += 1;
    if (undone !== applied) fail(`N: undo ran ${undone} times for ${applied} ops`);
    if (JSON.stringify(sess.record()) !== startSig) {
        fail('N: undo ×N did not return the base level byte for byte');
    }
    const after = JSON.stringify(buildEditedRegion({
        region, contract, level: sess.record(),
    }));
    if (after !== unedited) fail('N: a save from the undone record differs from the unedited save');
    console.log(`N. ${applied} session ops → undo ×${undone} → the base level byte for byte, `
        + 'and the save it builds equals the unedited save — OK');
}

console.log('VERIFY REGION-STEP EDITING: ALL OK');
