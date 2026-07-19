/**
 * In-app tests for X1 maze consumable tiles (cross-game consumable-pool
 * arc) — the runtime half of the feature, driven through the real panel,
 * the real visualizer, the real resourceChannels bus and the real omsi
 * iframe + bridge.
 *
 *   1. maze-consumable-tile-grants-foreign-item — walking a maze tile
 *      carrying an omsi grant deposits into the omsi engine's own
 *      resources bag, WITHOUT any AP location being checked (D10) and
 *      without the maze declaring sharing.items (we grant outward, so
 *      only `from: 'maze'` is needed).
 *   2. maze-consumable-tile-one-shot-then-respawns — a collected tile
 *      does not re-grant when walked over again, and DOES become
 *      available again after a loop reset (X1-R1).
 *   3. maze-mana-tile-refills-pool — a mana-refill tile adds to the
 *      shared loop-mode pool through the mana channel's gain leg
 *      (X1-R4), which is unclamped by design.
 *
 * These reuse the omsi_substrate_test preset because it already carries
 * two maze regions alongside the omsi region — the co-presence the
 * foreign pool assumes. The consumable overlays are installed onto the
 * LIVE maze world at runtime rather than baked into a committed preset:
 * generation-side placement is already pinned by the unit suite and by
 * the byte-inert regen proof, so what these tests exist to exercise is
 * the PICKUP → GRANT path, and injecting the overlay keeps them from
 * depending on a fixture whose tile coordinates would silently drift.
 */

import { registerTest } from '../testRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import {
    OMSI_TEST_PRESET_PATH,
    OMSI_TEST_MAZE_REGION,
    moveToRegion,
    omsiEval,
    readPool,
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';

/**
 * Load the preset and stand in a maze region with a live panel.
 * Returns the maze panel instance, or null when it never mounted.
 */
async function enterMazeRegion(testController) {
    testController.log('Loading omsi_substrate_test preset (2 maze regions + omsi)…');
    await testController.loadRulesFromFile(OMSI_TEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    // The omsi panel must exist so its bridge is live to RECEIVE grants,
    // even though the player stands in the maze. Delivery is eager — the
    // resources bag is global engine state, not activity-gated.
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'omsiSubstrateWrapperPanel',
    });
    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });

    moveToRegion(OMSI_TEST_MAZE_REGION, null);

    // pollForValue (not pollForCondition) — we need the panel itself,
    // and pollForCondition resolves a bare boolean.
    const panel = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return p?.world ? p : null;
        },
        `maze panel mounted with a world in ${OMSI_TEST_MAZE_REGION}`,
        15000, 250);
    testController.reportCondition('maze panel active with a world', !!panel?.world);
    return panel?.world ? panel : null;
}

/** Wait until the omsi engine surface is reachable through its iframe. */
async function waitForOmsiBag(testController) {
    const ready = await eventually(testController, () => {
        try {
            return typeof omsiEval('resources.gold') === 'number';
        } catch { return false; }
    }, 'omsi engine booted and its resources bag readable');
    testController.reportCondition('omsi resources bag readable', !!ready);
    return !!ready;
}

/**
 * Install a consumable overlay onto the panel's live world at a tile the
 * player can actually walk to, and return that tile.
 *
 * Picks a reachable floor tile that is not the entrance, not an exit and
 * carries no item — the same exclusions generation-side placement uses,
 * so the injected tile is representative of a generated one.
 */
function installTileOnLiveWorld(panel, install) {
    const world = panel.world;
    const pos = panel.state?.player_pos ?? world.entrance;
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            const key = `${x},${y}`;
            if (world.tiles[y * world.width + x] !== 0) continue;
            if (x === world.entrance.x && y === world.entrance.y) continue;
            if (x === pos.x && y === pos.y) continue;
            if (world.items?.has(key)) continue;
            if (world.obstacles?.has(key)) continue;
            let onExit = false;
            for (const e of world.exits.values()) {
                if (e.x === x && e.y === y) { onExit = true; break; }
            }
            if (onExit) continue;
            install(world, key, x, y);
            return { x, y, key };
        }
    }
    return null;
}

/** Drive the panel's playback controller onto a tile and let it arrive. */
async function walkOnto(testController, panel, tile, label) {
    const controller = panel.getPlaybackController?.();
    if (!controller?.walkTo) return false;
    controller.walkTo({ kind: 'tile', x: tile.x, y: tile.y });
    controller.instant?.();
    return eventually(testController,
        () => panel.state?.player_pos?.x === tile.x && panel.state?.player_pos?.y === tile.y,
        label);
}

// ────────────────────────────────────────────────────────────────
// 1. A foreign tile grants into the receiving game
// ────────────────────────────────────────────────────────────────
async function grantsForeignItem(testController) {
    const panel = await enterMazeRegion(testController);
    if (!panel) return testController.getOverallResult();
    if (!await waitForOmsiBag(testController)) return testController.getOverallResult();

    const goldBefore = omsiEval('resources.gold');
    testController.log(`omsi resources.gold before: ${goldBefore}`);

    const tile = installTileOnLiveWorld(panel, (world, key) => {
        world.consumableTiles.set(key, { substrate: 'omsi', type: 'gold', count: 3 });
    });
    testController.assertEqual('a placeable tile was found in the maze region',
        true, !!tile);
    if (!tile) return testController.getOverallResult();
    testController.log(`installed omsi/gold x3 consumable tile at (${tile.x},${tile.y})`);

    const checkedBefore = (await testController.stateManager.getSnapshot())?.checkedLocations;
    const countBefore = Array.isArray(checkedBefore)
        ? checkedBefore.length : Object.keys(checkedBefore ?? {}).length;

    const arrived = await walkOnto(testController, panel, tile,
        `player reached the consumable tile at (${tile.x},${tile.y})`);
    testController.assertEqual('player walked onto the consumable tile', true, !!arrived);

    const landed = await eventually(testController,
        () => omsiEval('resources.gold') === goldBefore + 3,
        `omsi resources.gold reached ${goldBefore + 3}`);
    testController.assertEqual(
        'the foreign grant landed in the receiving game\'s own bag', true, !!landed);

    // D10: no AP location was involved. The maze publishes no
    // locationCheck for these tiles, so the checked set must be
    // unchanged by the pickup.
    await testController.stateManager.pingWorker('after-consumable-pickup', 3000);
    const checkedAfter = (await testController.stateManager.getSnapshot())?.checkedLocations;
    const countAfter = Array.isArray(checkedAfter)
        ? checkedAfter.length : Object.keys(checkedAfter ?? {}).length;
    testController.assertEqual('no AP location was checked by the pickup (D10)',
        countBefore, countAfter);

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────
// 2. One-shot within a loop, respawns across loops (X1-R1)
// ────────────────────────────────────────────────────────────────
async function oneShotThenRespawns(testController) {
    const panel = await enterMazeRegion(testController);
    if (!panel) return testController.getOverallResult();
    if (!await waitForOmsiBag(testController)) return testController.getOverallResult();

    const tile = installTileOnLiveWorld(panel, (world, key) => {
        world.consumableTiles.set(key, { substrate: 'omsi', type: 'gold', count: 1 });
    });
    if (!tile) {
        testController.assertEqual('a placeable tile was found', true, false);
        return testController.getOverallResult();
    }

    const before = omsiEval('resources.gold');
    await walkOnto(testController, panel, tile, 'first arrival on the consumable tile');
    const first = await eventually(testController,
        () => omsiEval('resources.gold') === before + 1, 'first pickup granted');
    testController.assertEqual('first pickup granted', true, !!first);

    // Step off and back on: the collected set must suppress a re-grant.
    const home = panel.world.entrance;
    await walkOnto(testController, panel, { x: home.x, y: home.y }, 'returned to the entrance');
    await walkOnto(testController, panel, tile, 'second arrival on the same tile');
    // Give any (incorrect) second grant time to land before asserting.
    await eventually(testController, () => true, 'settle');
    testController.assertEqual('walking the tile again does NOT re-grant',
        before + 1, omsiEval('resources.gold'));

    // X1-R1: a loop reset makes collected tiles available again.
    const gs = centralRegistry.getPublicFunction?.('gameState', 'triggerLoopReset');
    testController.assertEqual('gameState triggerLoopReset public fn present',
        true, typeof gs === 'function');
    if (typeof gs !== 'function') return testController.getOverallResult();
    gs();

    await walkOnto(testController, panel, { x: home.x, y: home.y }, 'returned to the entrance again');
    await walkOnto(testController, panel, tile, 'arrival after the loop reset');
    const respawned = await eventually(testController,
        () => omsiEval('resources.gold') === before + 2,
        'the tile granted again after the loop reset');
    testController.assertEqual('collected tiles respawn after a loop reset (X1-R1)',
        true, !!respawned);

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────
// 3. Mana-refill tiles (X1-R4)
// ────────────────────────────────────────────────────────────────
async function manaTileRefillsPool(testController) {
    const panel = await enterMazeRegion(testController);
    if (!panel) return testController.getOverallResult();

    // A REFILL LARGE ENOUGH TO DOMINATE THE WALK COST. This region is
    // manaEnabled, so every step charges the pool; a modest refill could
    // be swallowed by the cost of walking to the tile and the assertion
    // would prove nothing either way. 5000 is far beyond any plausible
    // per-tile charge over a single region, so a net INCREASE isolates
    // the refill.
    const REFILL = 5000;
    const tile = installTileOnLiveWorld(panel, (world, key) => {
        world.manaTiles.set(key, REFILL);
    });
    if (!tile) {
        testController.assertEqual('a placeable tile was found', true, false);
        return testController.getOverallResult();
    }

    // readPool() is a bare number (gameState getCurrentMana), not an
    // object — same convention the omsi suite uses.
    const poolBefore = readPool();
    testController.log(`pool before: ${poolBefore}`);

    const arrived = await walkOnto(testController, panel, tile,
        `player reached the mana tile at (${tile.x},${tile.y})`);
    testController.assertEqual('player walked onto the mana tile', true, !!arrived);

    const refilled = await eventually(testController,
        () => readPool() > poolBefore,
        `the mana pool rose above ${poolBefore} after the refill`);
    testController.assertEqual('a mana tile refills the shared pool (X1-R4)',
        true, !!refilled);
    testController.log(`pool after: ${readPool()}`);

    return testController.getOverallResult();
}

registerTest({
    id: 'maze-consumable-tile-grants-foreign-item',
    name: 'Maze: a consumable tile grants a foreign item into the receiving game',
    description: 'Walks a maze tile carrying an omsi grant and asserts the item '
               + 'lands in the omsi engine\'s own resources bag over the real '
               + 'resourceChannels bus, with NO AP location checked (D10).',
    testFunction: grantsForeignItem,
    category: 'Maze consumable tiles',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'maze-consumable-tile-one-shot-then-respawns',
    name: 'Maze: consumable tiles are one-shot per loop and respawn on reset',
    description: 'A collected tile does not re-grant when walked over again; a '
               + 'loop reset clears the collected set so it grants once more '
               + '(X1-R1).',
    testFunction: oneShotThenRespawns,
    category: 'Maze consumable tiles',
    enabled: false,
});

registerTest({
    id: 'maze-mana-tile-refills-pool',
    name: 'Maze: a mana-refill tile adds to the shared loop-mode pool',
    description: 'Walks a mana tile and asserts the shared pool rises through '
               + 'the mana channel\'s gain leg (X1-R4).',
    testFunction: manaTileRefillsPool,
    category: 'Maze consumable tiles',
    enabled: false,
});
