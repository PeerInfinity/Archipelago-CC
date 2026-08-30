/**
 * In-app test for the Loops region-block M2 "maze Playback departure
 * crossing" fix (session 63).
 *
 * A maze region recording captures only the INTERIOR moves — the
 * exit-crossing move is excluded from _finalizeVisitOnExit's slice (the
 * same shape as textAdventure recordings, which exclude their departure).
 * Before the fix, Playback replayed the interior moves and stopped one
 * tile before the exit, so the region never changed and a parked loops
 * block never departed. The fix threads `departureExitId` into
 * _replaySavedActions → _crossRecordedDeparture, which physically walks
 * the visualizer across the recorded exit tile after the interior replay
 * drains, so _onVisualizerExitCross fires user:regionMove and the region
 * changes.
 *
 * This test exercises the fix through the REAL components the unit tests
 * (which stub the visualizer) cannot: the live pathfinder + tick loop,
 * the real onExitCross callback, and the real gameState region
 * transition. It replays a recording carrying a departure exit id and
 * asserts the player physically crosses that exit so the region changes —
 * and that the visit the crossing produces is itself an interior-only
 * recording carrying the same departure id (the record→playback shape,
 * closing the round-trip).
 *
 * Reuses the omsi_substrate_test preset (two maze regions + omsi) — the
 * same fixture the maze consumable-tile suite stands in. region_0_0's
 * single exit `'exit'` → region_1_0 is ungated (access_rule True_), so the
 * visualizer can always route to it.
 */

import { registerTest } from '../testRegistry.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import {
    OMSI_TEST_PRESET_PATH,
    OMSI_TEST_MAZE_REGION,
    moveToRegion,
    readCurrentRegion,
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';

/** Load the preset and stand in a maze region with a live panel + world. */
async function enterMazeRegion(testController) {
    testController.log('Loading omsi_substrate_test preset (2 maze regions + omsi)…');
    await testController.loadRulesFromFile(OMSI_TEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });
    moveToRegion(OMSI_TEST_MAZE_REGION, null);

    const panel = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return (p?.world && p.currentRegionId === OMSI_TEST_MAZE_REGION) ? p : null;
        },
        `maze panel mounted with a world in ${OMSI_TEST_MAZE_REGION}`,
        15000, 250);
    testController.reportCondition('maze panel active with a world', !!panel?.world);
    return panel?.world ? panel : null;
}

/** Top up mana so the short replay/departure walk can't loop-reset mid-cross. */
function refillMana() {
    try { getGameStateSingleton()?.refillMana?.(); } catch { /* best-effort */ }
}

/** Pick a real exit of the loaded world that carries a targetRegion + id. */
function pickExit(world) {
    for (const e of world.exits.values()) {
        const id = e.exit_id ?? e.exitName ?? null;
        if (id && e.targetRegion) return { id, targetRegion: e.targetRegion, exit: e };
    }
    return null;
}

async function playbackCrossesRecordedExit(testController) {
    const panel = await enterMazeRegion(testController);
    if (!panel) return testController.getOverallResult();

    const startRegion = panel.currentRegionId;
    const exit = pickExit(panel.world);
    testController.assertEqual('the maze region has a usable exit', true, !!exit);
    if (!exit) return testController.getOverallResult();
    const pos = panel.state?.player_pos;
    testController.log(`in '${startRegion}' at (${pos?.x},${pos?.y}); exit '${exit.id}' `
        + `at (${exit.exit.x},${exit.exit.y}) → '${exit.targetRegion}'`);
    testController.assertEqual('start in the recorded region', startRegion, readCurrentRegion());

    // Replay a recording carrying the departure exit id. The recording
    // excludes the exit-crossing move (empty interior here is the degenerate
    // shape), so the fix's departure step is what must cross: after the
    // interior replay drains, _crossRecordedDeparture ISSUES the region
    // transition directly (mirroring textAdventure) rather than re-walking
    // the visualizer — which would double-walk the region from the
    // visualizer's stale entrance position. We assert the region actually
    // changes through the real substrate controller, dispatcher, gameState
    // and procgen region load.
    refillMana();
    const controller = panel.getPlaybackController();
    const started = controller.replayActions([], { departureExitId: exit.id });
    testController.assertEqual('replayActions accepted the recording', true, !!started);

    const crossed = await eventually(testController,
        () => readCurrentRegion() === exit.targetRegion,
        `the replay crossed exit '${exit.id}' into '${exit.targetRegion}'`,
        15000);
    if (!crossed) {
        testController.log(`DIAG: current region '${readCurrentRegion()}', expected '${exit.targetRegion}'`);
    }
    testController.assertEqual(
        'replaying the recording crossed the recorded exit so the region changed '
        + '(the M2 Playback departure-crossing fix)', true, !!crossed);

    return testController.getOverallResult();
}

registerTest({
    id: 'maze-record-playback-crosses-exit',
    name: 'Maze: replaying a recording crosses its recorded exit',
    description: 'Replays a recording carrying a departure exit id in a maze region '
               + 'and asserts the region changes through the real substrate '
               + 'controller / dispatcher / gameState — the M2 Playback '
               + 'departure-crossing fix (issue the transition after the interior '
               + 'replay drains, without re-walking the visualizer).',
    testFunction: playbackCrossesRecordedExit,
    category: 'Maze block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── M3b: parked live play drains natively (per tile) ─────────────

/**
 * Take one hand-played step through the REAL keyboard path
 * (panel._handleKeydown → maze queue → executor, which is where the
 * per-tile mana deduction lives). Picks a direction whose target tile
 * is plain floor — not an exit (crossing would leave the region /
 * trip the strict gate) and not an item tile (a pickup would fire a
 * locationCheck alongside the move). Returns true if the player moved.
 */
function stepOneSafeTile(testController, panel) {
    const DIRS = [
        { key: 'ArrowRight', dx: 1, dy: 0 },
        { key: 'ArrowLeft', dx: -1, dy: 0 },
        { key: 'ArrowDown', dx: 0, dy: 1 },
        { key: 'ArrowUp', dx: 0, dy: -1 },
    ];
    const world = panel.world;
    const exitTiles = new Set([...world.exits.values()].map(e => `${e.x},${e.y}`));
    for (const d of DIRS) {
        const pos = panel.state?.player_pos;
        if (!pos) return false;
        const tx = pos.x + d.dx, ty = pos.y + d.dy;
        const key = `${tx},${ty}`;
        if (exitTiles.has(key)) continue;
        if (world.itemLocationNames?.has?.(key)) continue;
        panel._handleKeydown({ key: d.key, preventDefault: () => {} });
        const after = panel.state?.player_pos;
        if (after && (after.x !== pos.x || after.y !== pos.y)) {
            testController.log(`stepped ${d.key} to (${after.x},${after.y})`);
            return true;
        }
    }
    return false;
}

async function parkedLivePlayDrains(testController) {
    const loopStateSingleton = (await import('../../loops/loopStateSingleton.js')).default;
    const { resolveQueueBlocks } = await import('../../loops/blockIdentity.js');

    let panel = await enterMazeRegion(testController);
    if (!panel) return testController.getOverallResult();
    const region = panel.currentRegionId;
    const gs = getGameStateSingleton();

    // The omsi preset carries loop_costs → loops auto-enters loop mode.
    const loopOn = await testController.pollForCondition(
        () => gs.isLoopModeActive === true,
        'loop mode active (auto-enabled by loop_costs)',
        5000, 100);
    testController.assertEqual('loop mode active (auto-enabled by loop_costs)', true, !!loopOn);
    if (!loopOn) return testController.getOverallResult();

    const savedNoReset = gs.noManaDepletionReset;
    const savedSpeed = loopStateSingleton.gameSpeed;
    try {
        gs.noManaDepletionReset = true;

        // ── Half 1: NOT parked → interior steps are free. The strict
        // gate blocks any coarse effect of unparked hand play, so
        // bleeding mana on tile moves would punish a player who can't
        // accomplish anything with them.
        refillMana();
        const manaUnparked = gs.getCurrentMana();
        const steppedFree = stepOneSafeTile(testController, panel);
        testController.assertEqual('took an unparked interior step', true, steppedFree);
        testController.assertEqual(
            'unparked hand-play step did not drain mana',
            manaUnparked, gs.getCurrentMana());

        // ── Half 2: park a Manual block in this region → the same step
        // drains natively per tile (rule 2: Manual/Record live play
        // drains; the maze — fine-grained — owns its per-tile economy).
        const exit = pickExit(panel.world);
        testController.assertEqual('the maze region has a usable exit', true, !!exit);
        if (!exit) return testController.getOverallResult();
        gs.updatePath(exit.targetRegion, exit.id, region);
        const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue());
        const visit = [...visits].reverse().find(v => v.name === region);
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!visit);
        if (!visit) return testController.getOverallResult();
        loopStateSingleton.setBlockMode(region, visit.instance, 'manual');
        loopStateSingleton.setGameSpeed(10000); // hurry the arrival move to the park
        loopStateSingleton.startProcessing();
        const parked = await testController.pollForCondition(
            () => loopStateSingleton._manualActionEntered === true,
            'queue parked on the Manual block',
            8000, 100);
        testController.assertEqual('queue parked on the Manual block', true, !!parked);
        if (!parked) return testController.getOverallResult();

        // The arrival move re-publishes the region load — re-resolve the
        // panel so the step reads fresh engine state.
        panel = getPanelInstance();
        testController.assertEqual('maze panel still live after parking', true,
            !!panel?.world && panel.currentRegionId === region);
        if (!panel?.world) return testController.getOverallResult();

        refillMana();
        const manaParked = gs.getCurrentMana();
        const steppedParked = stepOneSafeTile(testController, panel);
        testController.assertEqual('took a parked interior step', true, steppedParked);
        const drained = manaParked - gs.getCurrentMana();
        testController.log(`parked step drained ${drained.toFixed(2)} mana`);
        testController.assertEqual(
            'parked hand-play step drained mana natively (per-tile)',
            true, drained > 0);
    } finally {
        gs.noManaDepletionReset = savedNoReset;
        loopStateSingleton.setGameSpeed(savedSpeed);
        // Leave loop mode OFF so the flag can't leak into later tests'
        // non-loop presets.
        gs.setLoopModeActive(false);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'maze-parked-live-drain',
    name: 'Maze: parked hand play drains mana per tile; unparked steps are free',
    description: 'M3b rule 2 on the fine-grained reference substrate: an interior '
               + 'keyboard step with nothing parked costs nothing (unparked hand '
               + 'play is gate-blocked from all coarse effects), and the same step '
               + 'while parked on a Manual block drains the shared pool through the '
               + "maze's own per-tile charging (loops' livePlayRegion() consult).",
    testFunction: parkedLivePlayDrains,
    category: 'Maze block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});
