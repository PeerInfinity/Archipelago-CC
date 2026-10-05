/**
 * In-app test for the Noiz2sa substrate (`frontend/modules/noiz2saSubstrate/`): one region of the committed
 * `noiz2sa_substrate_test` preset played by INJECTED input, in loop mode, through the real chain.
 *
 * The preset carries loop_costs, so loop mode auto-enables and the strict action gate is live: the region's
 * clear only checks its location while the queue is parked on it. So the row parks a RECORD block on the
 * start region (a summary substrate, like runner) and then:
 *
 *   1. a hit — idle fire on 1:1 seed 1 is hit at frame 240 (measured against the engine) — restarts the region
 *      from its start: attempt 2, nothing checked;
 *   2. a clearing tape (the game repo's Ace bot on 1:1 seed 1, 1002 frames, via `segment-run.js` runSegment;
 *      `NOIZ2SA_CLEAR_TAPE` below) clears the region → its one location is checked;
 *   3. the page leaves by the queued exit → the Record block saves a SUMMARY (duration, the check, the
 *      departure), and live play drained the time cost (the `_timeDrainTick` path);
 *   4. back to the start, Playback applies the summary INSTANTLY: it spends the repriced envelope and crosses
 *      the departure (loops does it; the game page is not involved).
 *
 * Injected input = `window.__noiz2saTest.play(tape, {speed})` on the game page, 8 game frames per 16 ms.
 * Cleans up: saved queues restored (`restoresSavedQueues`), the depletion-reset flag restored, loop mode off,
 * the queue stopped, the page back on the keyboard.
 *
 * Runs only in the test-substrates mode (registered enabled:false; the full module config is needed for the
 * substrate's module to exist).
 */

import { registerTest } from '../testRegistry.js';
import { restoresSavedQueues } from '../savedQueueIsolation.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { resolveQueueBlocks } from '../../loops/blockIdentity.js';

const PRESET_RULES_PATH =
    './presets/noiz2sa_substrate_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';

/** idle fire (input byte 16) on 1:1 seed 1: hit at frame 240 */
const IDLE_FIRE_TAPE = '16x300';
/** the Ace bot's clearing attempt on 1:1 seed 1 (1002 frames; `encodeInputs` run-length form) */
const NOIZ2SA_CLEAR_TAPE = '51x2,19x6,50x8,17x24,49x24,17x8,50x8,16x56,48x8,16x40,17x8,16x16,49x4,22x4,52x8,56x8,'
    + '49x8,53x8,50x4,22x4,50x8,24x4,22x2,21x2,16x4,22x4,50x8,53x4,22x3,21,53x8,16x40,21x8,17x8,21x6,22,21,54x8,'
    + '21x8,48x4,22x4,23x8,22x16,18x8,19x16,24x8,48x8,49x16,20x2,22,20x4,21,50x8,23x8,55x16,23x8,24x8,21x8,53x8,'
    + '21x8,19x24,51x8,23x24,22x8,16x8,19x24,49x24,17x8,48x8,56x4,20x2,22,20,52x8,23x32,21x8,48x16,20x8,19x4,20x4,'
    + '19x4,20x4,19x4,20x4,24x8,23x8,56x24,16x16,49x8,56x8,49x16,52x8,22x2,21x14,54x4,20,21x3,19x20,20x22,21x14,'
    + '50x8,23x8,24x16,56x2';
const SPEED = 8;

const currentRegion = () => getGameStateSingleton()?.getCurrentRegion?.() ?? null;
const currentMana = () => getGameStateSingleton()?.getCurrentMana?.() ?? 0;

function snapshotHasLocation(snapshot, name) {
    const checked = snapshot?.checkedLocations;
    if (checked instanceof Set) return checked.has(name);
    if (Array.isArray(checked)) return checked.includes(name);
    if (checked && typeof checked === 'object') return !!checked[name];
    return false;
}

const gameWindow = () => document.querySelector('iframe[src*="noiz2saSubstrate/game/index.html"]')?.contentWindow ?? null;
const debugState = () => gameWindow()?.__noiz2saDebug?.() ?? null;

function resolveBlockFor(region) {
    const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue?.() ?? []);
    return [...visits].reverse().find((v) => v.name === region) ?? null;
}

async function noiz2saRegionLoopVisit(testController) {
    testController.log('Loading the noiz2sa_substrate_test preset…');
    await testController.loadRulesFromFile(PRESET_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    const loopOn = await testController.pollForCondition(
        () => getGameStateSingleton()?.isLoopModeActive === true,
        'loop mode active (auto-enabled by the preset\'s loop_costs)', 8000, 100);
    testController.reportCondition('loop mode active (auto-enabled by the preset\'s loop_costs)', !!loopOn);
    if (!loopOn) return testController.getOverallResult();

    await testController.pollForCondition(
        () => loopStateSingleton.getRegionCaptureShape?.(currentRegion()) === 'summary',
        'the player landed in a Noiz2sa region', 10000, 200);
    const region = currentRegion();
    testController.assertEqual('the start region is a SUMMARY substrate region (noiz2sa)',
        'summary', loopStateSingleton.getRegionCaptureShape?.(region));

    const regionData = testController.stateManager.getStaticData?.()?.regions?.get(region);
    const location = regionData?.locations?.[0]?.name ?? null;
    const exit = (regionData?.exits ?? []).find((e) => e.connected_region) ?? null;
    testController.assertEqual(`${region} has its clear location and an exit`, true, !!(location && exit));
    if (!location || !exit) return testController.getOverallResult();
    const exitId = exit.name, target = exit.connected_region;
    testController.log(`region ${region}: location ${location}; exit ${exitId} → ${target}`);

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    try {
        gs.noManaDepletionReset = true; // this row is about the economy, not depletion

        // ── 1. park a Record block on the start region ──
        gs.updatePath(target, exitId, region);
        const block = resolveBlockFor(region);
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!block);
        if (!block) return testController.getOverallResult();
        loopStateSingleton.setBlockMode(region, block.instance, 'record');
        gs.refillMana();
        loopStateSingleton.startProcessing();
        const parked = await testController.pollForCondition(
            () => loopStateSingleton._manualActionEntered === true && loopStateSingleton._manualRegionName === region,
            'the Record block parked for live play', 15000, 100);
        testController.reportCondition('the Record block parked for live play', !!parked);
        if (!parked) return testController.getOverallResult();
        const manaAtPark = currentMana();

        // ── 2. the game page, configured with the region by procgenPlayer (noiz2sa:loadRegion) ──
        testController.eventBus.publish('ui:activatePanel', { panelId: 'noiz2saSubstratePanel' });
        const configured = await testController.pollForCondition(
            () => { const d = debugState(); return !!(d?.regionId === region && d.state === 'ready'); },
            `the game page is configured with ${region} and waiting`, 30000, 200);
        testController.reportCondition(`the game page is configured with ${region} and waiting`, !!configured);
        if (!configured) {
            testController.log(`DIAG: page state ${JSON.stringify(debugState())}`, 'error');
            return testController.getOverallResult();
        }
        const d0 = debugState();
        testController.assertEqual('the region is 1:1 on seed 1 (the tapes below are for it)',
            JSON.stringify({ start: { stage: 0, scene: 0 }, end: { stage: 0, scene: 0 }, seed: 1 }), JSON.stringify(d0.span));
        testController.assertEqual('the exits are closed before the clear', false, d0.exitsOpen);

        // ── 3. a hit restarts the region ──
        gameWindow().__noiz2saTest.play(IDLE_FIRE_TAPE, { speed: SPEED });
        const hit = await testController.pollForCondition(
            () => { const d = debugState(); return d?.hits === 1 && d.state === 'ready'; },
            'idle fire is hit and the region restarts', 15000, 100);
        const d1 = debugState();
        testController.assertEqual('a hit restarted the region: attempt 2, back at its start, 0 frames into it',
            true, !!hit && d1.attempt === 2 && d1.attemptFrames === 0 && d1.pos?.stage === 0 && d1.pos?.scene === 0);
        testController.assertEqual('the hit came at frame 240 (as the engine measures headless)', 240, d1.frames);
        await testController.stateManager.pingWorker('after-hit', 3000);
        testController.assertEqual('a hit checks nothing', false,
            snapshotHasLocation(testController.stateManager.getSnapshot(), location));

        // ── 4. the clearing tape clears it → the location ──
        gameWindow().__noiz2saTest.play(NOIZ2SA_CLEAR_TAPE, { speed: SPEED });
        const cleared = await testController.pollForCondition(
            () => debugState()?.cleared === true, 'the injected tape cleared the region', 20000, 100);
        testController.assertEqual('the tape cleared the region in 1002 frames, deathless', true,
            !!cleared && debugState().attemptFrames === 1002 && debugState().hits === 1);
        const checked = await testController.pollForCondition(
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), location),
            `${location} checked through the bridge`, 10000, 200);
        testController.assertEqual(`the clear checked ${location}`, true, !!checked);
        testController.assertEqual('the exits open after the clear', true, debugState().exitsOpen);

        // ── 5. leave → the Record block saves a summary ──
        gameWindow().__noiz2saTest.leave(exitId);
        const crossed = await testController.pollForCondition(
            () => currentRegion() === target, `the page left by ${exitId} into ${target}`, 15000, 100);
        testController.assertEqual(`the page left by ${exitId} into ${target}`, true, !!crossed);
        if (!crossed) return testController.getOverallResult();
        await testController.stateManager.pingWorker('after-record', 3000);

        const saved = loopStateSingleton._lookupBoundSummary(region, block.instance);
        testController.assertEqual('a summary recording is bound to the block', true, !!saved);
        if (!saved) return testController.getOverallResult();
        testController.log(`summary: ${JSON.stringify(saved.summary)} departure=${saved.departureExitId}`);
        testController.assertEqual('the visit lasted at least one drain tick', true, saved.summary.durationSeconds >= 1);
        testController.assertEqual('the clear is the summary\'s check', JSON.stringify([location]),
            JSON.stringify(saved.summary.checks ?? []));
        testController.assertEqual('the crossed exit is the recorded departure', exitId, saved.departureExitId);
        testController.assertEqual('a summary carries no replayable actions', 0, (saved.actions ?? []).length);
        const rate = loopStateSingleton.costDataManager?.getTimeDrainPerSecond?.(region) ?? 1;
        const drained = manaAtPark - currentMana();
        testController.log(`drained ${drained} over ${saved.summary.durationSeconds}s at ${rate}/s`);
        testController.assertEqual('live play drained the time cost of the visit, hit included (± one tick)', true,
            Math.abs(drained - saved.summary.durationSeconds * rate) <= rate + 0.001);
        testController.assertEqual('the block auto-switched to Playback', 'playback',
            loopStateSingleton.getBlockMode(region, block.instance));

        // ── 6. back to the start; Playback applies the summary instantly ──
        loopStateSingleton.dispatcher.publish('user:regionMove', {
            sourceRegion: target, targetRegion: region, fromReset: true, updatePath: false,
        }, { initialTarget: 'bottom' });
        const back = await testController.pollForCondition(
            () => currentRegion() === region, `teleported back to ${region}`, 10000, 200);
        testController.reportCondition(`teleported back to ${region}`, !!back);
        if (!back) return testController.getOverallResult();
        loopStateSingleton._resetLoop();
        const expected = loopStateSingleton._priceSummaryReplay(region, saved.summary);
        let manaAtApply = null;
        const onParked = (d) => { if (d?.summary && manaAtApply === null) manaAtApply = currentMana(); };
        testController.eventBus.subscribe('loopState:manualEntered', onParked);
        loopStateSingleton.startProcessing();
        const recrossed = await testController.pollForCondition(
            () => currentRegion() === target, `Playback crossed into ${target} again`, 15000, 100);
        testController.eventBus.unsubscribe?.('loopState:manualEntered', onParked);
        testController.assertEqual('instant Playback crossed the recorded departure', true, !!recrossed);
        testController.assertEqual('Playback spent exactly the repriced summary', true,
            manaAtApply !== null && Math.abs((manaAtApply - currentMana()) - expected) < 0.001);
    } finally {
        gameWindow()?.__noiz2saTest?.release?.();
        gs.noManaDepletionReset = savedNoReset;
        gs.setLoopModeActive(false);
        loopStateSingleton.stopProcessing?.();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'noiz2sa-region-loop-visit',
    name: 'Noiz2sa: a region played by injected input — a hit restarts it, the clear checks it, Record → Playback',
    description: 'Loads noiz2sa_substrate_test (loop mode), parks a Record block on its 1:1 region and drives the '
        + 'game page by injected input: idle fire is hit at frame 240 and the region restarts with nothing '
        + 'checked; a clearing tape clears it and checks its location; leaving saves a summary (duration, check, '
        + 'departure) priced by the live time drain; then instant Playback spends the repriced summary and '
        + 'crosses the departure.',
    testFunction: restoresSavedQueues(noiz2saRegionLoopVisit),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
