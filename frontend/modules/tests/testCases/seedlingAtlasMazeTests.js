/**
 * In-app tests for the region atlas's MAZE projection
 * (CC/docs/plans/region-atlas-plan.md, Phase 5b).
 *
 * Phase 4 bound an atlas region to the real recompiled Seedling game, and that
 * leg can only ever be a standalone verifier that SKIPs: it needs a 31 MB
 * gitignored wasm artifact, so an enumerated in-app test would be red on every
 * machine missing it. The maze projection is the answer to that — the same
 * geometry and the same item gating, playable from the committed repo — so these
 * two legs CAN live in the suite, and they are the payoff of the phase.
 *
 *   1. seedling-atlas-maze-boundary-crossing — walking onto a boundary exit tile
 *      of the start sub-region crosses into the neighbouring ATLAS region
 *      through the real dispatcher, procgenPlayer and gameState, and the player
 *      arrives standing on the paired exit tile (the crossing they came through,
 *      not the region's entrance — which is what the exit_id-is-exitName
 *      invariant buys).
 *   2. seedling-atlas-maze-gated-crossing — a sub-region crossing whose rule the
 *      Phase-5a analyzer COMPUTED from the tile map blocks without the items and
 *      passes with them. Both halves are asserted, and the negative is bracketed
 *      by positives: the walk to the tile beside the gate has to succeed first,
 *      and the crossing has to happen afterwards, so "nothing moved" cannot pass
 *      because the machinery was dead.
 *
 * Everything is read off the LIVE world rather than hard-coded: which exit is
 * ungated, which is gated, what item its rule wants, and which tile to stand on.
 * A projection change that moves a tile therefore retargets these tests instead
 * of breaking them — and a projection that stops gating anything fails them.
 */

import { registerTest } from '../testRegistry.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';

const PRESET_PATH = './presets/seedling_atlas_maze/AP_1/AP_1_rules.json';
const START_REGION = 'overworld_start__r8c0';

const KEY_FOR = Object.freeze({
    N: 'ArrowUp', S: 'ArrowDown', E: 'ArrowRight', W: 'ArrowLeft',
});
const DELTA_FOR = Object.freeze({
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowRight: { dx: 1, dy: 0 },
    ArrowLeft: { dx: -1, dy: 0 },
});

/** gameState's current region — the AP-side truth, not the panel's. */
function readCurrentRegion() {
    try {
        const gs = getGameStateSingleton();
        return gs?.getCurrentRegion?.() ?? gs?.currentRegion ?? null;
    } catch { return null; }
}

/** Load the maze-flavoured atlas preset and stand in the start sub-region. */
async function enterStartRegion(testController) {
    testController.log('Loading seedling_atlas_maze preset (the real Seedling map as maze worlds)…');
    await testController.loadRulesFromFile(PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 5000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });

    const panel = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return (p?.world && p.state && p.currentRegionId === START_REGION) ? p : null;
        },
        `maze panel mounted in ${START_REGION}`,
        20000, 250);
    testController.assertEqual(
        'the preset put the player in the atlas start sub-region', true, !!panel);
    if (!panel) return null;
    // The AP side agrees — otherwise the panel is showing a world gameState does
    // not think we are in, and every later "the region changed" is meaningless.
    testController.assertEqual('gameState agrees which region we are in',
        START_REGION, readCurrentRegion());
    return panel;
}

/** The obstacle sitting on an exit tile, or undefined when the exit is ungated. */
function gateOn(world, exit) {
    const id = world.obstacles.get(`${exit.x},${exit.y}`);
    return id ? { id, def: world.obstacleLib?.[id] } : undefined;
}

/**
 * A minimal set of {name, count} that satisfies a Rule Builder tree: an Or takes
 * its first branch, an And takes all of them. Derived from the rule the
 * PROJECTION emitted, so the test never names a Seedling item itself.
 */
function itemsSatisfying(rule) {
    if (!rule || typeof rule !== 'object') return [];
    if (rule.rule === 'Has') return [{ name: rule.args?.item_name, count: rule.args?.count ?? 1 }];
    if (rule.rule === 'Or') return itemsSatisfying(rule.children?.[0]);
    if (rule.rule === 'And') return (rule.children ?? []).flatMap(itemsSatisfying);
    return [];
}

/**
 * A tile beside `target` that is plain floor: not an exit, not an obstacle.
 *
 * `towardKey` is the key that walks FROM that tile ONTO `target` — i.e. the
 * direction back, (-dx, -dy). Getting this backwards makes the whole test
 * vacuous: the player walks AWAY from the gate, nothing moves onto it, and
 * "blocked" passes for the wrong reason.
 */
function stagingTileBeside(world, target) {
    const dirs = [
        { dx: 0, dy: -1, toward: 'S' }, // the tile is NORTH of target: press South
        { dx: 1, dy: 0, toward: 'W' },
        { dx: 0, dy: 1, toward: 'N' },
        { dx: -1, dy: 0, toward: 'E' },
    ];
    for (const d of dirs) {
        const x = target.x + d.dx;
        const y = target.y + d.dy;
        if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
        if (world.tiles[y * world.width + x] !== 0) continue;
        if (world.obstacles.has(`${x},${y}`)) continue;
        let onExit = false;
        for (const e of world.exits.values()) if (e.x === x && e.y === y) { onExit = true; break; }
        if (onExit) continue;
        return { x, y, towardKey: KEY_FOR[d.toward] };
    }
    return null;
}

/** Walk the panel's real playback controller onto a tile and wait for arrival. */
async function walkTo(testController, panel, tile, label) {
    const controller = panel.getPlaybackController?.();
    if (!controller?.walkTo) {
        testController.assertEqual('the maze panel exposes a playback controller', true, false);
        return false;
    }
    controller.walkTo({ kind: 'tile', x: tile.x, y: tile.y });
    controller.instant?.();
    const arrived = await testController.pollForCondition(
        () => {
            const p = getPanelInstance();
            return p?.state?.player_pos?.x === tile.x && p.state.player_pos.y === tile.y;
        },
        label, 20000, 200);
    testController.assertEqual(label, true, !!arrived);
    return !!arrived;
}

/** One step through the REAL keyboard path (queue -> executor -> engine.step). */
function press(panel, key) {
    panel._handleKeydown({ key, preventDefault: () => {} });
}

/**
 * The key really does aim at the tile under test. Without this, a mis-signed
 * direction walks the player AWAY and "the step did not move it" passes for
 * entirely the wrong reason — which is exactly what happened on the first run.
 */
function assertAimedAt(testController, staging, target) {
    const d = DELTA_FOR[staging.towardKey];
    const aim = { x: staging.x + d.dx, y: staging.y + d.dy };
    testController.assertEqual(
        `pressing ${staging.towardKey} from (${staging.x},${staging.y}) aims at the tile under test`,
        `${target.x},${target.y}`, `${aim.x},${aim.y}`);
    return aim.x === target.x && aim.y === target.y;
}

// ────────────────────────────────────────────────────────────────
// 1. A boundary crossing changes the AP region
// ────────────────────────────────────────────────────────────────
async function boundaryCrossing(testController) {
    const panel = await enterStartRegion(testController);
    if (!panel) return testController.getOverallResult();

    const world = panel.world;
    // An UNGATED boundary exit of this sub-region: one of the atlas's own level
    // links (the house door / the owl's nest stairs), which the projection put on
    // the marked entrance tile.
    const exit = [...world.exits.values()].find((e) => e.targetRegion && !gateOn(world, e));
    testController.assertEqual('the start sub-region has an ungated exit to walk out of',
        true, !!exit);
    if (!exit) return testController.getOverallResult();
    testController.log(`exit '${exit.exit_id}' at (${exit.x},${exit.y}) -> '${exit.targetRegion}' `
        + `(arrive at '${exit.targetExitId}')`);

    // Walk to the tile beside it, then step ON — the step is what crosses.
    const staging = stagingTileBeside(world, exit);
    testController.assertEqual('there is a floor tile beside the exit to step from',
        true, !!staging);
    if (!staging) return testController.getOverallResult();
    if (!await walkTo(testController, panel, staging,
        `walked to (${staging.x},${staging.y}), beside the exit`)) {
        return testController.getOverallResult();
    }
    if (!assertAimedAt(testController, staging, exit)) return testController.getOverallResult();

    press(panel, staging.towardKey);
    const crossed = await testController.pollForCondition(
        () => readCurrentRegion() === exit.targetRegion,
        `stepping onto the exit tile moved the AP region to '${exit.targetRegion}'`,
        15000, 200);
    if (!crossed) {
        testController.log(`DIAG: gameState region '${readCurrentRegion()}', panel `
            + `'${getPanelInstance()?.currentRegionId}', pos `
            + JSON.stringify(getPanelInstance()?.state?.player_pos));
    }
    testController.assertEqual(
        'walking a marked boundary tile crossed into the neighbouring atlas region '
        + '(through the real dispatcher, procgenPlayer and gameState)', true, !!crossed);
    if (!crossed) return testController.getOverallResult();

    // The substrate followed, and it is showing the destination's own world.
    const arrived = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return (p?.world && p.currentRegionId === exit.targetRegion) ? p : null;
        },
        `the maze panel adopted '${exit.targetRegion}'`, 15000, 200);
    testController.assertEqual('the maze panel adopted the destination region',
        true, !!arrived);
    if (!arrived) return testController.getOverallResult();

    // Arrival lands on the crossing we came through, not on the region's spawn.
    // This is what the exit_id-is-exitName invariant buys: procgenPlayer resolves
    // the source exit's targetExitId in the destination's exits Map.
    const back = arrived.world.exits.get(exit.targetExitId);
    testController.assertEqual('the destination carries the paired exit back here',
        true, !!back && back.targetRegion === START_REGION);
    if (back) {
        testController.assertEqual(
            'the player arrived ON the crossing tile, not at the region entrance',
            `${back.x},${back.y}`,
            `${arrived.state.player_pos.x},${arrived.state.player_pos.y}`);
    }

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────
// 2. A computed gate blocks without the item and passes with it
// ────────────────────────────────────────────────────────────────
async function gatedCrossing(testController) {
    const panel = await enterStartRegion(testController);
    if (!panel) return testController.getOverallResult();

    const world = panel.world;
    let gated = null;
    for (const e of world.exits.values()) {
        const gate = gateOn(world, e);
        if (!gate?.def?.clear_rule || !e.targetRegion) continue;
        const wants = itemsSatisfying(gate.def.clear_rule);
        if (wants.length > 0 && wants.every((w) => typeof w.name === 'string')) {
            gated = { exit: e, gate, wants };
            break;
        }
    }
    testController.assertEqual(
        'the start sub-region has a rule-gated crossing (the analyzer computed one)',
        true, !!gated);
    if (!gated) return testController.getOverallResult();
    const { exit, gate, wants } = gated;
    testController.log(`gated crossing '${exit.exit_id}' at (${exit.x},${exit.y}) -> `
        + `'${exit.targetRegion}'; rule ${JSON.stringify(gate.def.clear_rule)}`);

    // ── positive control: get to the tile beside the gate ──────────
    const staging = stagingTileBeside(world, exit);
    testController.assertEqual('there is a floor tile beside the gate to step from',
        true, !!staging);
    if (!staging) return testController.getOverallResult();
    if (!await walkTo(testController, panel, staging,
        `walked to (${staging.x},${staging.y}), beside the gated crossing`)) {
        return testController.getOverallResult();
    }
    if (!assertAimedAt(testController, staging, exit)) return testController.getOverallResult();

    // ── the negative: the same step, without the items ────────────
    //
    // The keyboard path is synchronous (handleInput appends AND executes), so the
    // step has already resolved when press() returns; the extra beat is only so
    // an asynchronous region-move chain would have had time to fire if the step
    // HAD gone through.
    press(panel, staging.towardKey);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const posAfterBlock = { ...getPanelInstance().state.player_pos };
    testController.assertEqual(
        'without the items, stepping onto the gated crossing does not move the player',
        `${staging.x},${staging.y}`, `${posAfterBlock.x},${posAfterBlock.y}`);
    testController.assertEqual('and the AP region did not change',
        START_REGION, readCurrentRegion());

    // ── grant through the normal item path ────────────────────────
    for (const w of wants) {
        testController.log(`granting ${w.name} x${w.count}`);
        await testController.stateManager.addItemToInventory(w.name, w.count);
    }
    await testController.stateManager.pingWorker('after-item-grant', 5000);

    // ── the positive: the same step now crosses ───────────────────
    press(panel, staging.towardKey);
    const crossed = await testController.pollForCondition(
        () => readCurrentRegion() === exit.targetRegion,
        `with the items, the same step crossed into '${exit.targetRegion}'`,
        15000, 200);
    if (!crossed) {
        testController.log(`DIAG: gameState region '${readCurrentRegion()}', pos `
            + JSON.stringify(getPanelInstance()?.state?.player_pos)
            + `, inventory-visible rule ${JSON.stringify(gate.def.clear_rule)}`);
    }
    testController.assertEqual(
        'the computed gate opened once the items were held, and the crossing fired '
        + 'a real region move', true, !!crossed);

    return testController.getOverallResult();
}

registerTest({
    id: 'seedling-atlas-maze-boundary-crossing',
    name: 'Seedling atlas (maze): walking a marked boundary crosses the AP region',
    description: 'Loads the maze-flavoured Seedling atlas preset, walks onto one of the '
               + "atlas's own marked boundary tiles in the start sub-region, and asserts "
               + 'the AP region changes through the real dispatcher / procgenPlayer / '
               + 'gameState — and that the player arrives standing on the paired crossing '
               + 'tile rather than the destination\'s entrance.',
    testFunction: boundaryCrossing,
    category: 'Seedling atlas maze',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'seedling-atlas-maze-gated-crossing',
    name: 'Seedling atlas (maze): a computed gate blocks without its item and passes with it',
    description: 'A sub-region crossing whose rule the Phase-5a analyzer computed from the '
               + 'real tile map: the step onto it is a no-op with an empty inventory and '
               + 'crosses once the rule\'s item is granted through the normal stateManager '
               + 'path. Both halves are asserted, the negative bracketed by the walk that '
               + 'must succeed before it and the crossing that must succeed after.',
    testFunction: gatedCrossing,
    category: 'Seedling atlas maze',
    enabled: false, // off by default — runs only in the test-substrates mode
});
