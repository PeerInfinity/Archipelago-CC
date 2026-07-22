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

/** Drive a freshly-planned visualizer walk to completion (mirrors walkOnto). */
function driveVisualizer(panel) {
    const v = panel._visualizer;
    if (!v) return;
    v.play?.();
    v.instant?.();
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

    // Replay a recording carrying the departure exit id. Empty interior is
    // the degenerate-but-real recording shape; the fix's departure step is
    // what must cross. _crossRecordedDeparture runs synchronously here (no
    // interior to drain), then we drive the visualizer to completion.
    refillMana();
    const controller = panel.getPlaybackController();
    const started = controller.replayActions([], { departureExitId: exit.id });
    testController.assertEqual('replayActions accepted the recording', true, !!started);
    // The departure walk is now planned + marked loops-driven; run the clock.
    driveVisualizer(panel);

    const crossed = await eventually(testController,
        () => readCurrentRegion() === exit.targetRegion,
        `the replay physically crossed exit '${exit.id}' into '${exit.targetRegion}'`,
        15000);
    if (!crossed) {
        const v = panel._visualizer;
        const p = panel.state?.player_pos;
        testController.log(`DIAG: current region '${readCurrentRegion()}', player at `
            + `(${p?.x},${p?.y}), loopsDriven=${!!panel._loopsDrivenAction}, `
            + `visualizer target=${JSON.stringify(v?.getState?.()?.target ?? null)}, `
            + `stuck=${v?.getState?.()?.stuck}`);
    }
    testController.assertEqual(
        'replaying the recording physically crossed the recorded exit '
        + '(the M2 Playback departure-crossing fix)', true, !!crossed);
    if (!crossed) return testController.getOverallResult();

    // The crossing produced a fresh visit recording on the same panel
    // instance (stashed by _finalizeVisitOnExit at the exit-cross). It must
    // carry the departure exit id and exclude the exit-crossing move — the
    // interior-only shape Playback consumes, closing the round-trip.
    const rec = panel._takeLastRecording();
    testController.assertEqual('the crossing stashed a visit recording', true, !!rec);
    if (rec) {
        testController.assertEqual('recording carries the departure exit id',
            exit.id, rec.departureExitId);
        const hasCrossingMove = (rec.actions ?? []).some((a) => a.type === 'regionMove');
        testController.assertEqual('recording excludes the exit-crossing move',
            false, hasCrossingMove);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'maze-record-playback-crosses-exit',
    name: 'Maze: replaying a recording physically crosses its recorded exit',
    description: 'Replays a recording carrying a departure exit id in a maze region '
               + 'and asserts the player crosses the recorded exit so the region '
               + 'changes (the M2 Playback departure-crossing fix), and that the '
               + 'crossing yields an interior-only recording carrying that exit id.',
    testFunction: playbackCrossesRecordedExit,
    category: 'Maze block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});
