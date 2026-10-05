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
 *      — the play clock (N3b): waiting for the first key, and P pressed partway through the tape, report the clock
 *        stopped and drain nothing (no mana, no recorded second, no game frame); P again resumes the same tape;
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
/** how long the row sits on a stopped play clock (unstarted, then paused) — over two drain ticks */
const PAUSE_MS = 2500;

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
/** a real key press on the game page (its own KeyboardEvent, so the page's listeners see an ordinary key) */
function pressKey(code) {
    const w = gameWindow();
    if (!w) return;
    w.dispatchEvent(new w.KeyboardEvent('keydown', { code, bubbles: true }));
    w.dispatchEvent(new w.KeyboardEvent('keyup', { code, bubbles: true }));
}

/** the host module (dynamic: it registers the substrate on import, which only the substrates mode wants) */
const trainerModule = () => import('../../noiz2saSubstrate/index.js');

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

        // ── 2b. the play clock: a region waiting for its first key costs nothing (N3b) ──
        const clockStopped = await testController.pollForCondition(
            () => loopStateSingleton._playClock?.region === region && loopStateSingleton._playClock.running === false,
            'the page reported its clock stopped (waiting for a key)', 5000, 100);
        testController.reportCondition('the page reported its clock stopped (waiting for a key)', !!clockStopped);
        const idleMana = currentMana(), idleSeconds = loopStateSingleton._summaryDrainSeconds;
        await new Promise((r) => setTimeout(r, PAUSE_MS));
        testController.assertEqual(`${PAUSE_MS} ms waiting for the first key drained nothing and recorded nothing`, true,
            currentMana() === idleMana && loopStateSingleton._summaryDrainSeconds === idleSeconds);

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

        // ── 4. the clearing tape clears it → the location; P pauses it partway, and paused time is free ──
        gameWindow().__noiz2saTest.play(NOIZ2SA_CLEAR_TAPE, { speed: SPEED });
        const midway = await testController.pollForCondition(
            () => { const d = debugState(); return d?.state === 'playing' && d.attemptFrames >= 200; },
            'the clearing tape is under way', 10000, 20);
        testController.reportCondition('the clearing tape is under way', !!midway);
        pressKey('KeyP');
        const paused = await testController.pollForCondition(
            () => debugState()?.state === 'paused'
                && loopStateSingleton._playClock?.region === region && loopStateSingleton._playClock.running === false,
            'P paused the game and the page reported its clock stopped', 5000, 50);
        testController.reportCondition('P paused the game and the page reported its clock stopped', !!paused);
        const pausedMana = currentMana(), pausedSeconds = loopStateSingleton._summaryDrainSeconds;
        const pausedFrames = debugState()?.attemptFrames;
        await new Promise((r) => setTimeout(r, PAUSE_MS));
        testController.assertEqual(`${PAUSE_MS} ms paused drained nothing, recorded nothing, stepped nothing`, true,
            currentMana() === pausedMana && loopStateSingleton._summaryDrainSeconds === pausedSeconds
            && debugState()?.attemptFrames === pausedFrames);
        pressKey('KeyP');
        const resumed = await testController.pollForCondition(
            () => debugState()?.cleared === true
                || (debugState()?.state === 'playing' && loopStateSingleton._playClock?.running === true),
            'P resumed the game and its clock', 5000, 20);
        testController.reportCondition('P resumed the game and its clock', !!resumed);
        // N4b: the clear performs the queued move at once, so the page may already hold the next region — the clear
        // is read from the departure, and its 1002 deathless frames from the summary's 240 + 1002 below
        const cleared = await testController.pollForCondition(
            () => debugState()?.cleared === true || currentRegion() !== region, 'the injected tape cleared the region', 20000, 100);
        testController.reportCondition('the injected tape cleared the region', !!cleared);
        const checked = await testController.pollForCondition(
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), location),
            `${location} checked through the bridge`, 10000, 200);
        testController.assertEqual(`the clear checked ${location}`, true, !!checked);

        // ── 5. N4b: the clear PERFORMS the queued move → the Record block saves a summary ──
        const crossed = await testController.pollForCondition(
            () => currentRegion() === target, `the clear performed the queued move: left by ${exitId} into ${target}`, 15000, 100);
        testController.assertEqual(`the clear performed the queued move: left by ${exitId} into ${target}`, true, !!crossed);
        if (!crossed) return testController.getOverallResult();
        await testController.stateManager.pingWorker('after-record', 3000);

        const trainer = (await trainerModule()).getTrainerService();
        const saved = loopStateSingleton._lookupBoundSummary(region, block.instance);
        testController.assertEqual('a summary recording is bound to the block', true, !!saved);
        if (!saved) return testController.getOverallResult();
        testController.log(`summary: ${JSON.stringify(saved.summary)} departure=${saved.departureExitId}`);
        testController.assertEqual('the visit lasted at least one drain tick', true, saved.summary.durationSeconds >= 1);
        testController.assertEqual('the clear is the summary\'s check', JSON.stringify([location]),
            JSON.stringify(saved.summary.checks ?? []));
        testController.assertEqual('the crossed exit is the recorded departure', exitId, saved.departureExitId);
        testController.assertEqual('a summary carries no replayable actions', 0, (saved.actions ?? []).length);
        // N4: the visit's play-clock stats ride the summary — every attempt's game seconds (240 + 1002 frames) and
        // score — so its Playback can earn training points
        const ps = saved.summary.playStats ?? null;
        testController.assertEqual('the summary carries the visit\'s playStats: 1242 frames of game time and a score',
            true, !!ps && Math.abs(ps.gameSeconds - 1242 / 62.5) < 1e-9 && ps.score > 0);
        testController.assertEqual('the recorded duration is the whole GAME seconds played (N4: charged per game second)',
            Math.floor(1242 / 62.5), saved.summary.durationSeconds);
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
        const earnedBefore = trainer.trainer.earned;
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
        // ── 7. N4: instant Playback earns the recorded visit's training points (⚖ "Instant playback should still
        // accumulate resources") ──
        const { pointsFor } = await import('../../bulletml-dodge/src/game/tracks.js');
        const want = pointsFor(trainer.trainer.settings, { seconds: ps?.gameSeconds ?? 0, score: ps?.score ?? 0 });
        const got = trainer.trainer.earned - earnedBefore;
        testController.log(`Playback earned ${got.toFixed(3)} training points (the summary's playStats: ${want.toFixed(3)})`);
        testController.assertEqual('instant Playback earned exactly the summary\'s points (its game seconds and score)',
            true, want > 0 && Math.abs(got - want) < 1e-9);
    } finally {
        gameWindow()?.__noiz2saTest?.release?.();
        gs.noManaDepletionReset = savedNoReset;
        gs.setLoopModeActive(false);
        loopStateSingleton.stopProcessing?.();
    }
    return testController.getOverallResult();
}

/**
 * N3b fix 2 — a clear the host REFUSED can be sent again on the same visit; one it ACCEPTED never twice.
 * The bridge (flashSubstrate/bridge.js + locationReportLedger.js) used to mark a location reported before
 * dispatching it, so a clear the loop-mode action gate swallowed (queue not parked on the region) could not be
 * sent again until the next loadRegion. Here, on ONE visit (no loadRegion in between): a Record block parks; with
 * the queue paused the clear is refused by the gate (loops:clickIgnored); unpaused, R plays the region again and
 * the clear is accepted; R and a third clear → no second dispatch (loops observes exactly one parked check).
 */
async function noiz2saRefusedClearResent(testController) {
    await testController.loadRulesFromFile(PRESET_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    const loopOn = await testController.pollForCondition(
        () => getGameStateSingleton()?.isLoopModeActive === true, 'loop mode active', 8000, 100);
    testController.reportCondition('loop mode active', !!loopOn);
    if (!loopOn) return testController.getOverallResult();
    await testController.pollForCondition(
        () => loopStateSingleton.getRegionCaptureShape?.(currentRegion()) === 'summary',
        'the player landed in a Noiz2sa region', 10000, 200);
    const region = currentRegion();
    const regionData = testController.stateManager.getStaticData?.()?.regions?.get(region);
    const location = regionData?.locations?.[0]?.name ?? null;
    const exit = (regionData?.exits ?? []).find((e) => e.connected_region) ?? null;
    testController.assertEqual(`${region} has its clear location and an exit`, true, !!(location && exit));
    if (!location || !exit) return testController.getOverallResult();

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    const refusals = [];
    const onIgnored = (d) => { if (d?.kind === 'location' && d?.payload?.locationName === location) refusals.push(d.reason); };
    const realObserve = loopStateSingleton.observeParkedLiveAction;
    let parkedChecks = 0;
    loopStateSingleton.observeParkedLiveAction = function (action) {
        if (action?.type === 'locationCheck' && action?.locationName === location) parkedChecks++;
        return realObserve.call(this, action);
    };
    const clearOnce = async (label) => {
        gameWindow().__noiz2saTest.play(NOIZ2SA_CLEAR_TAPE, { speed: SPEED });
        // cleared — or, N4b, the accepted clear already performed the queued move (the page has the next region)
        const ok = await testController.pollForCondition(
            () => debugState()?.cleared === true || currentRegion() !== region, label, 20000, 100);
        testController.reportCondition(label, !!ok);
        return !!ok;
    };
    try {
        gs.noManaDepletionReset = true;
        testController.eventBus.subscribe('loops:clickIgnored', onIgnored);

        // ── 1. park a Record block on the region; the page is configured by the park's region move ──
        gs.updatePath(exit.connected_region, exit.name, region);
        const block = resolveBlockFor(region);
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!block);
        if (!block) return testController.getOverallResult();
        loopStateSingleton.setBlockMode(region, block.instance, 'record');
        gs.refillMana();
        loopStateSingleton.startProcessing();
        const parked = await testController.pollForCondition(
            () => loopStateSingleton.livePlayRegion() === region, 'the Record block parked for live play', 15000, 100);
        testController.reportCondition('the Record block parked for live play', !!parked);
        if (!parked) return testController.getOverallResult();
        testController.eventBus.publish('ui:activatePanel', { panelId: 'noiz2saSubstratePanel' });
        const configured = await testController.pollForCondition(
            () => { const d = debugState(); return !!(d?.regionId === region && d.state === 'ready'); },
            `the game page is configured with ${region} and waiting`, 30000, 200);
        testController.reportCondition(`the game page is configured with ${region} and waiting`, !!configured);
        if (!configured) return testController.getOverallResult();

        // ── 2. the queue paused on the park: the gate refuses the clear ──
        // (the flag itself, not setPaused: unpausing through setPaused restarts the queue from its first move,
        // which re-enters the region — a new visit, which re-arms everything anyway)
        loopStateSingleton.isPaused = true;
        testController.assertEqual('paused: the region is not open for live play', null, loopStateSingleton.livePlayRegion());
        if (!(await clearOnce('first clear (queue paused)'))) return testController.getOverallResult();
        const refused = await testController.pollForCondition(() => refusals.length === 1,
            'the action gate refused the first clear (loops:clickIgnored)', 5000, 50);
        testController.reportCondition(`the action gate refused the first clear (${refusals[0] ?? 'none'})`, !!refused);
        await testController.stateManager.pingWorker('after-refused', 3000);
        testController.assertEqual('the refused clear checked nothing', false,
            snapshotHasLocation(testController.stateManager.getSnapshot(), location));

        // ── 3. unpaused, the same visit: play again, and the clear is sent again ──
        loopStateSingleton.isPaused = false;
        testController.assertEqual('the region is open for live play again', region, loopStateSingleton.livePlayRegion());
        testController.assertEqual('the page is still on the same visit (no new loadRegion)', true,
            debugState()?.regionId === region && debugState()?.clearedThisVisit === true);
        gameWindow().__noiz2saTest.again();
        if (!(await clearOnce('second clear (parked, same visit)'))) return testController.getOverallResult();
        const checked = await testController.pollForCondition(
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), location),
            `${location} checked by the resent clear`, 10000, 100);
        testController.assertEqual(`the resent clear checked ${location}`, true, !!checked);
        testController.assertEqual('loops observed exactly one parked check, after one refusal', true,
            parkedChecks === 1 && refusals.length === 1);
        // N4b: the accepted clear performs the queued move (the refused one could not: the queue was paused). The
        // N3b third clear on the same visit is gone with it; "an accepted clear is never sent twice" stays pinned by
        // locationReportLedger.test.js.
        const crossed = await testController.pollForCondition(() => currentRegion() === exit.connected_region,
            `the accepted clear performed the queued move into ${exit.connected_region}`, 15000, 100);
        testController.reportCondition(`the accepted clear performed the queued move into ${exit.connected_region}`, !!crossed);
    } finally {
        loopStateSingleton.observeParkedLiveAction = realObserve;
        loopStateSingleton.isPaused = false;
        testController.eventBus.unsubscribe?.('loops:clickIgnored', onIgnored);
        gameWindow()?.__noiz2saTest?.release?.();
        gs.noManaDepletionReset = savedNoReset;
        gs.setLoopModeActive(false);
        loopStateSingleton.stopProcessing?.();
    }
    return testController.getOverallResult();
}

/**
 * N4 — the Bot block plays a region at the CURRENT tracks, and the bot trains.
 *
 * Twice, each time on a fresh load of the preset (the region's location unchecked) and a FRESH trainer (every track
 * 0, strategy Even): a Bot block on the 1:1 region hands its regionMove to the walkTo solver, the page's humanlike bot
 * (the worker) plays at tracks 0/0/0/0/0 and clears the region, the clear is checked and the page leaves by the
 * queued exit. Measured headless (the game repo's runSegment, tracks 0 = the beginner, bot seed 1): deathless, 1002
 * frames, score 17330. The first run plays at 1×, the second at 2× (the bot-speed setting); both play the same
 * frames (the budget is counted, not wall-clock), and both cost the same mana — floor(16.032) game seconds × the
 * region's rate (the drain is charged per GAME second). After each, the tracks rose (the points of 16.032 s and
 * 17330 score, spent Even).
 */
async function noiz2saBotBlockTrains(testController) {
    const { getTrainerService, pinBotSeed } = await trainerModule();
    // N4b: every visit draws its own bot seed; this row's numbers were measured at bot seed 1
    pinBotSeed(1);
    const { pointsFor } = await import('../../bulletml-dodge/src/game/tracks.js');
    const service = getTrainerService();
    const KEY = 'noiz2sa:trainer:v1';
    let savedTrainer = null;
    try { savedTrainer = localStorage.getItem(KEY); } catch { /* none */ }
    const savedSettings = { botSpeed: service.settings.botSpeed, botRetryCap: service.settings.botRetryCap };
    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;

    /** one Bot-block visit; `tracks` = a hand-set trainer (strategy By hand), else a fresh one (Even) */
    async function botVisit(speed, { tracks = null, retryCap = 0 } = {}) {
        const label = `${speed}×${tracks ? ` tracks ${tracks.seeing}` : ''}${retryCap ? ` cap ${retryCap}` : ''}`;
        testController.log(`── a Bot block at ${label} on a fresh load ──`);
        const configuresBefore = debugState()?.configures ?? 0;
        await testController.loadRulesFromFile(PRESET_RULES_PATH);
        await testController.stateManager.pingWorker('after-rules-load', 3000);
        const loopOn = await testController.pollForCondition(
            () => getGameStateSingleton()?.isLoopModeActive === true, 'loop mode active', 8000, 100);
        testController.reportCondition(`[${label}] loop mode active`, !!loopOn);
        if (!loopOn) return null;
        await testController.pollForCondition(
            () => loopStateSingleton.getRegionCaptureShape?.(currentRegion()) === 'summary',
            'the player landed in a Noiz2sa region', 10000, 200);
        const region = currentRegion();
        const regionData = testController.stateManager.getStaticData?.()?.regions?.get(region);
        const location = regionData?.locations?.[0]?.name ?? null;
        const exit = (regionData?.exits ?? []).find((e) => e.connected_region) ?? null;
        testController.assertEqual(`[${label}] ${region} has its clear location and an exit`, true, !!(location && exit));
        if (!location || !exit) return null;
        const target = exit.connected_region;

        service.reset(tracks ? 'manual' : 'even');
        if (tracks) { Object.assign(service.trainer.tracks, tracks); service.setStrategy('manual'); }
        service.applySettings({ botSpeed: speed, botRetryCap: retryCap });
        gs.noManaDepletionReset = true;
        gs.updatePath(target, exit.name, region);
        const block = resolveBlockFor(region);
        testController.assertEqual(`[${label}] resolved a queue block for ${region}`, true, !!block);
        if (!block) return null;
        loopStateSingleton.setBlockMode(region, block.instance, 'bot');
        gs.refillMana();
        const xpLevel = loopStateSingleton.getRegionXP(region).level;
        testController.eventBus.publish('ui:activatePanel', { panelId: 'noiz2saSubstratePanel' });
        const configured = await testController.pollForCondition(
            () => { const d = debugState(); return d?.configures > configuresBefore && d.regionId === region && d.state === 'ready'; },
            `[${label}] the game page is configured with ${region}`, 30000, 200);
        testController.reportCondition(`[${label}] the game page is configured with ${region}`, !!configured);
        if (!configured) return null;
        const manaBefore = currentMana();
        const t0 = performance.now();
        loopStateSingleton.startProcessing();
        const driving = await testController.pollForCondition(
            () => loopStateSingleton.botSolverRegion?.() === region && debugState()?.bot !== null,
            `[${label}] the Bot block handed the walk to the page's bot`, 15000, 100);
        testController.reportCondition(`[${label}] the Bot block handed the walk to the page's bot`, !!driving);
        if (!driving) {
            testController.log(`DIAG: page ${JSON.stringify(debugState())}`, 'error');
            return null;
        }
        const crossed = retryCap
            ? await testController.pollForCondition(() => debugState()?.lastBot?.gaveUp === true,
                `[${label}] the bot gave up ${region} at the retry cap`, 90000, 100)
            : await testController.pollForCondition(() => currentRegion() === target,
                `[${label}] the bot cleared ${region} and left into ${target}`, 90000, 100);
        const wallSeconds = (performance.now() - t0) / 1000;
        testController.reportCondition(retryCap ? `[${label}] the bot gave up ${region} at the retry cap`
            : `[${label}] the bot cleared ${region} and left into ${target}`, !!crossed);
        const d = debugState();
        if (!crossed) {
            testController.log(`DIAG: page ${JSON.stringify(d)}`, 'error');
            return null;
        }
        await testController.stateManager.pingWorker('after-bot', 3000);
        const out = {
            region, xpLevel, wallSeconds,
            tracksPlayed: d?.lastBot?.tracks ?? null, speedPlayed: d?.lastBot?.speed ?? null,
            cleared: d?.lastBot?.cleared === true, failed: d?.lastBot?.failed ?? null, attempts: d?.lastBot?.attempts ?? null,
            // read at the clear (the page has since been configured with the next region); at a give-up, the page's
            frames: retryCap ? d?.frames : d?.lastBot?.frames ?? null,
            visitSeconds: retryCap ? d?.visitSeconds : d?.lastBot?.visitSeconds ?? null,
            score: retryCap ? d?.visitScore : d?.lastBot?.score ?? null,
            pageState: d?.state ?? null, parked: loopStateSingleton.botSolverRegion?.() === region,
            checked: snapshotHasLocation(testController.stateManager.getSnapshot(), location),
            spent: manaBefore - currentMana(),
            rate: loopStateSingleton.costDataManager?.getTimeDrainPerSecond?.(region) ?? 1,
            tracksAfter: { ...service.trainer.tracks }, earned: service.trainer.earned,
        };
        testController.log(`[${label}] ${JSON.stringify(out)}`);
        loopStateSingleton.stopProcessing?.();
        return out;
    }

    try {
        const runs = [];
        for (const speed of [1, 2]) {
            const r = await botVisit(speed);
            if (!r) return testController.getOverallResult();
            runs.push(r);
            const zero = { seeing: 0, thinking: 0, hands: 0, focus: 0, panic: 0 };
            testController.assertEqual(`[${speed}×] the bot played at the CURRENT tracks (a fresh trainer: 0/0/0/0/0)`,
                JSON.stringify(zero), JSON.stringify(r.tracksPlayed));
            testController.assertEqual(`[${speed}×] at the bot-speed setting`, speed, r.speedPlayed);
            testController.assertEqual(`[${speed}×] cleared deathless in 1002 frames with score 17330 (the headless runSegment)`,
                true, r.cleared && r.failed === 0 && r.frames === 1002 && r.score === 17330);
            testController.assertEqual(`[${speed}×] the clear checked the region's location`, true, r.checked);
            testController.assertEqual(`[${speed}×] the region's XP level was 0 (the drain was not discounted)`, 0, r.xpLevel);
            testController.assertEqual(`[${speed}×] the visit cost floor(its game seconds) × the rate`,
                Math.floor(1002 / 62.5) * r.rate, r.spent);
            const want = pointsFor(service.trainer.settings, { seconds: 1002 / 62.5, score: 17330 });
            testController.assertEqual(`[${speed}×] the bot earned the visit's training points (16.032 s, 17330 score)`,
                true, Math.abs(r.earned - want) < 1e-9);
            testController.assertEqual(`[${speed}×] the tracks rose afterwards (Even)`,
                JSON.stringify({ seeing: 2, thinking: 2, hands: 2, focus: 1, panic: 1 }), JSON.stringify(r.tracksAfter));
        }
        testController.assertEqual('2× cost the same mana as 1× for the same clear', runs[0].spent, runs[1].spent);
        testController.log(`wall clock: ${runs[0].wallSeconds.toFixed(1)} s at 1×, ${runs[1].wallSeconds.toFixed(1)} s at 2×`);
        testController.assertEqual('2× took less wall clock than 1×', true, runs[1].wallSeconds < runs[0].wallSeconds);

        // ── retries: at tracks 20 (headless runSegment: hit at 939, 259 and 742 frames, cleared in 1002; the attempts'
        // scores 14730, 3210, 11700, 15000) — each attempt with its own bot seed, at 4× ──
        const t20 = { seeing: 20, thinking: 20, hands: 20, focus: 20, panic: 20 };
        const r3 = await botVisit(4, { tracks: t20 });
        if (!r3) return testController.getOverallResult();
        testController.assertEqual('[4× tracks 20] the bot played at the hand-set tracks', JSON.stringify(t20), JSON.stringify(r3.tracksPlayed));
        testController.assertEqual('[4× tracks 20] three hits, each restarting the region, then the clear on attempt 4 (as headless)',
            true, r3.cleared && r3.failed === 3 && r3.attempts === 4 && r3.frames === 2942);
        testController.assertEqual('[4× tracks 20] the visit\'s score counts every attempt from the region\'s start',
            14730 + 3210 + 11700 + 15000, r3.score);
        testController.assertEqual('[4× tracks 20] the visit cost floor(2942 frames of game time) × the rate, hits included',
            Math.floor(2942 / 62.5) * r3.rate, r3.spent);
        testController.assertEqual('[4× tracks 20] By hand: the points wait unspent, the tracks stay', JSON.stringify(t20),
            JSON.stringify(r3.tracksAfter));
        // the retry cap (a setting; default none): after 2 failed attempts the bot gives up and the region waits
        const r4 = await botVisit(4, { tracks: t20, retryCap: 2 });
        if (!r4) return testController.getOverallResult();
        testController.assertEqual('[4× tracks 20 cap 2] the bot gave up after 2 failed attempts (939 + 259 frames)',
            true, !r4.cleared && r4.failed === 2 && r4.frames === 939 + 259);
        testController.assertEqual('[4× tracks 20 cap 2] the region waits (its clock stopped); the Bot block stays parked',
            true, r4.pageState === 'ready' && r4.parked && loopStateSingleton._playClock?.running === false);
        testController.assertEqual('[4× tracks 20 cap 2] the attempts played were charged', Math.floor(1198 / 62.5) * r4.rate, r4.spent);
    } finally {
        loopStateSingleton.stopProcessing?.();
        gs.noManaDepletionReset = savedNoReset;
        gs.setLoopModeActive(false);
        try {
            if (savedTrainer === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, savedTrainer);
        } catch { /* none */ }
        service.applySettings(savedSettings);
        service.reload();
        pinBotSeed(null);
    }
    return testController.getOverallResult();
}

// ─────────────────────────────── N4b ───────────────────────────────

/** a fresh load of the preset, in loop mode → {region, location, exit, target} of the start (1:1) region, or null */
async function loadStartRegion(testController, label) {
    await testController.loadRulesFromFile(PRESET_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    const loopOn = await testController.pollForCondition(
        () => getGameStateSingleton()?.isLoopModeActive === true, 'loop mode active', 8000, 100);
    testController.reportCondition(`[${label}] loop mode active`, !!loopOn);
    if (!loopOn) return null;
    await testController.pollForCondition(
        () => loopStateSingleton.getRegionCaptureShape?.(currentRegion()) === 'summary',
        'the player landed in a Noiz2sa region', 10000, 200);
    const region = currentRegion();
    const regionData = testController.stateManager.getStaticData?.()?.regions?.get(region);
    const location = regionData?.locations?.[0]?.name ?? null;
    const exit = (regionData?.exits ?? []).find((e) => e.connected_region) ?? null;
    testController.assertEqual(`[${label}] ${region} has its clear location and an exit`, true, !!(location && exit));
    if (!location || !exit) return null;
    return { region, regionData, location, exit, target: exit.connected_region };
}

/** queue the move out of the region, set its block's mode → the block, or null */
function queueBlock(testController, r, mode, label) {
    getGameStateSingleton().updatePath(r.target, r.exit.name, r.region);
    const block = resolveBlockFor(r.region);
    testController.assertEqual(`[${label}] resolved a queue block for ${r.region}`, true, !!block);
    if (!block) return null;
    loopStateSingleton.setBlockMode(r.region, block.instance, mode);
    return block;
}

/** the page configured with `region` (a configure after `before`), its host state in (loop mode, this visit's seed) */
async function pageConfigured(testController, region, before, label, visitSeed) {
    testController.eventBus.publish('ui:activatePanel', { panelId: 'noiz2saSubstratePanel' });
    const ok = await testController.pollForCondition(() => {
        const d = debugState();
        return !!d && d.configures > before && d.regionId === region && d.state === 'ready'
            && d.loopMode === true && d.visitBotSeed === visitSeed();
    }, `[${label}] the game page is configured with ${region} and has its host state`, 30000, 100);
    testController.reportCondition(`[${label}] the game page is configured with ${region} and has its host state`, !!ok);
    if (!ok) testController.log(`DIAG: page ${JSON.stringify(debugState())}`, 'error');
    return !!ok;
}

/** the time-drain price of one game second in `region` now (its rate at its XP level) */
const unitDrainCost = (region) => loopStateSingleton._calculateActionCost({ type: 'timeDrain', sourceRegion: region });

/** the trainer at tracks 0, By hand (its tracks stay put between visits), the bot at `speed` */
function handTrainer(service, speed) {
    service.reset('manual');
    service.setStrategy('manual');
    service.applySettings({ botSpeed: speed, botRetryCap: 0 });
}

/** save + restore the trainer, its settings, the depletion flag and loop mode around a row */
async function withTrainer(testController, body) {
    const mod = await trainerModule();
    const service = mod.getTrainerService();
    const KEY = 'noiz2sa:trainer:v1';
    let savedTrainer = null;
    try { savedTrainer = localStorage.getItem(KEY); } catch { /* none */ }
    const savedSettings = { botSpeed: service.settings.botSpeed, botRetryCap: service.settings.botRetryCap };
    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    try {
        gs.noManaDepletionReset = true;
        await body(mod, service, gs);
    } finally {
        gameWindow()?.__noiz2saTest?.release?.();
        loopStateSingleton.stopProcessing?.();
        gs.noManaDepletionReset = savedNoReset;
        gs.setLoopModeActive(false);
        try {
            if (savedTrainer === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, savedTrainer);
        } catch { /* none */ }
        service.applySettings(savedSettings);
        service.reload();
        mod.pinBotSeed(null);
    }
    return testController.getOverallResult();
}

/**
 * N4b (a) — ⚖ "In loop mode, clearing the level should be counted as part of the "move" action." A Bot block on a
 * region its first visit already CLEARED plays it again: the page keeps the exits closed (loop mode), the bot plays to
 * a clear before it leaves, the visit costs its game seconds and the bot earns them. Bot seed 1, tracks 0 By hand (so
 * both visits play the measured 1002 frames, score 17330), 4×.
 */
async function noiz2saBotReplaysClearedRegion(testController) {
    return withTrainer(testController, async (mod, service, gs) => {
        const label = 'cleared region';
        const r = await loadStartRegion(testController, label);
        if (!r) return;
        handTrainer(service, 4);
        mod.pinBotSeed(1);
        const before0 = debugState()?.configures ?? 0;
        const block = queueBlock(testController, r, 'bot', label);
        if (!block) return;

        // ── visit 1: the first clear ──
        gs.refillMana();
        loopStateSingleton.startProcessing();
        const first = await testController.pollForCondition(() => currentRegion() === r.target,
            `[${label}] visit 1: the bot cleared ${r.region} and left into ${r.target}`, 90000, 100);
        testController.reportCondition(`[${label}] visit 1: the bot cleared ${r.region} and left`, !!first);
        if (!first) return;
        await testController.stateManager.pingWorker('after-visit-1', 3000);
        const checked = await testController.pollForCondition(
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), r.location), 'checked', 10000, 100);
        testController.assertEqual(`[${label}] visit 1 checked ${r.location}`, true, !!checked);
        testController.log(`[${label}] configures since load: ${(debugState()?.configures ?? 0) - before0}`);

        // ── visit 2: back to the region (cleared before); the same Bot block ──
        const before = debugState()?.configures ?? 0;
        loopStateSingleton.dispatcher.publish('user:regionMove', {
            sourceRegion: r.target, targetRegion: r.region, fromReset: true, updatePath: false,
        }, { initialTarget: 'bottom' });
        const back = await testController.pollForCondition(() => currentRegion() === r.region,
            `[${label}] teleported back to ${r.region}`, 10000, 100);
        testController.reportCondition(`[${label}] teleported back to ${r.region}`, !!back);
        if (!back) return;
        loopStateSingleton._resetLoop();
        if (!(await pageConfigured(testController, r.region, before, `${label} visit 2`, mod.getVisitBotSeed))) return;
        const d0 = debugState();
        testController.assertEqual(`[${label}] visit 2: the page knows the region was cleared before`, true, d0.alreadyChecked);
        testController.assertEqual(`[${label}] visit 2: in loop mode its exits stay CLOSED until a clear on this visit`,
            false, d0.exitsOpen);
        gs.refillMana();
        const manaBefore = currentMana(), earnedBefore = service.trainer.earned, unit = unitDrainCost(r.region);
        loopStateSingleton.startProcessing();
        const driving = await testController.pollForCondition(
            () => loopStateSingleton.botSolverRegion?.() === r.region && debugState()?.bot !== null,
            `[${label}] visit 2: the Bot block handed the move to the page's bot`, 15000, 50);
        testController.reportCondition(`[${label}] visit 2: the Bot block handed the move to the page's bot`, !!driving);
        const left = await testController.pollForCondition(() => currentRegion() === r.target,
            `[${label}] visit 2: the bot played ${r.region} to a clear and left`, 90000, 100);
        testController.reportCondition(`[${label}] visit 2: the bot played ${r.region} to a clear and left`, !!left);
        if (!left) return;
        const lb = debugState()?.lastBot;
        testController.log(`[${label}] visit 2: ${JSON.stringify(lb)}`);
        testController.assertEqual(`[${label}] visit 2: the bot PLAYED the region again (deathless, 1002 frames, score 17330)`,
            true, lb?.cleared === true && lb.frames === 1002 && lb.score === 17330 && lb.botSeed === 1);
        const spent = manaBefore - currentMana();
        testController.assertEqual(`[${label}] visit 2 cost floor(16.032) game seconds of drain`,
            true, Math.abs(spent - Math.floor(1002 / 62.5) * unit) < 0.001);
        const { pointsFor } = await import('../../bulletml-dodge/src/game/tracks.js');
        const want = pointsFor(service.trainer.settings, { seconds: 1002 / 62.5, score: 17330 });
        testController.assertEqual(`[${label}] visit 2 trained the bot (the visit's points)`, true,
            Math.abs((service.trainer.earned - earnedBefore) - want) < 1e-9);
    });
}

/**
 * N4b (b) — ⚖ "The Noiz2sa regions should count as fully explored when they are first entered, not when they are first
 * cleared." The row fogs the second region (its location and exits undiscovered), then moves the player into it (a
 * reset teleport, so no queue is involved): on that first entry the region reads FULLY EXPLORED — every location and
 * exit discovered (loops' `_isRegionFullyExplored`), the exits through `discovery:exitDiscovered`, as explores do.
 */
async function noiz2saFirstEntryExplores(testController) {
    return withTrainer(testController, async (mod) => {
        const label = 'first entry';
        const r = await loadStartRegion(testController, label);
        if (!r) return;
        const { default: discovery } = await import('../../discovery/singleton.js');
        const staticData = testController.stateManager.getStaticData();
        const next = r.target, nextData = staticData?.regions?.get(next);
        testController.assertEqual(`[${label}] ${next} is a Noiz2sa region with a location and exits`, true,
            loopStateSingleton.getRegionCaptureShape?.(next) === 'summary' && (nextData?.locations?.length ?? 0) > 0
            && (nextData?.exits?.length ?? 0) > 0);
        for (const l of nextData?.locations ?? []) discovery.undiscoverLocation(l.name);
        for (const e of nextData?.exits ?? []) discovery.undiscoverExit(next, e.name);
        testController.assertEqual(`[${label}] fogged: ${next} is not fully explored`, false,
            loopStateSingleton._isRegionFullyExplored(next, staticData));
        testController.assertEqual(`[${label}] ${next} not entered yet`, false, mod.getFirstEntryState().entered.includes(next));
        const exitsSeen = [];
        const onExit = (d) => { if (d?.regionName === next) exitsSeen.push(d.exitName); };
        testController.eventBus.subscribe('discovery:exitDiscovered', onExit);
        try {
            loopStateSingleton.dispatcher.publish('user:regionMove', {
                sourceRegion: r.region, targetRegion: next, fromReset: true, updatePath: false,
            }, { initialTarget: 'bottom' });
            const entered = await testController.pollForCondition(() => currentRegion() === next,
                `[${label}] the player entered ${next}`, 10000, 100);
            testController.reportCondition(`[${label}] the player entered ${next}`, !!entered);
            if (!entered) return;
            const explored = await testController.pollForCondition(
                () => loopStateSingleton._isRegionFullyExplored(next, staticData),
                `[${label}] the first entry made ${next} FULLY EXPLORED`, 10000, 50);
            testController.reportCondition(`[${label}] the first entry made ${next} FULLY EXPLORED`, !!explored);
            if (!explored) testController.log(`DIAG: ${JSON.stringify(mod.getFirstEntryState())}`, 'error');
        } finally {
            testController.eventBus.unsubscribe?.('discovery:exitDiscovered', onExit);
        }
        testController.assertEqual(`[${label}] every exit of ${next} discovered through discovery:exitDiscovered`, true,
            (nextData.exits ?? []).every((e) => discovery.isExitDiscovered(next, e.name) && exitsSeen.includes(e.name)));
        testController.assertEqual(`[${label}] its location discovered, nothing checked`, true,
            (nextData.locations ?? []).every((l) => discovery.isLocationDiscovered(l.name)
                && !snapshotHasLocation(testController.stateManager.getSnapshot(), l.name)));
    });
}

/** a Record visit on a fresh load whose bot (the B key) plays the region to a clear; → the visit's summary, or null */
async function assistedRecordVisit(testController, mod, gs, label) {
    const r = await loadStartRegion(testController, label);
    if (!r) return null;
    const before = debugState()?.configures ?? 0;
    const block = queueBlock(testController, r, 'record', label);
    if (!block) return null;
    gs.refillMana();
    loopStateSingleton.startProcessing();
    const parked = await testController.pollForCondition(() => loopStateSingleton.livePlayRegion() === r.region,
        `[${label}] the Record block parked`, 15000, 100);
    testController.reportCondition(`[${label}] the Record block parked`, !!parked);
    if (!parked || !(await pageConfigured(testController, r.region, before, label, mod.getVisitBotSeed))) return null;
    const seed = debugState().visitBotSeed;
    pressKey('KeyB');
    // the clear performs the queued move (N4b)
    const crossed = await testController.pollForCondition(() => currentRegion() === r.target,
        `[${label}] B: the bot played the region to a clear, which performed the move into ${r.target}`, 120000, 100);
    testController.reportCondition(`[${label}] B: the bot played the region to a clear, which performed the move`, !!crossed);
    if (!crossed) return null;
    const saved = loopStateSingleton._lookupBoundSummary(r.region, block.instance);
    testController.log(`[${label}] seed ${seed}; summary ${JSON.stringify(saved?.summary)}`);
    loopStateSingleton.stopProcessing?.();
    return saved ? { seed, summary: saved.summary } : null;
}

/**
 * N4b (c) — ⚖ a new bot seed per visit, recorded. Two Record visits on fresh loads, each played to a clear by the bot
 * (the B key, tracks 0 By hand, 4×): each visit drew its own seed, and each Record summary carries it
 * (`playStats.botSeed`). A third visit pinned to the FIRST visit's recorded seed plays it exactly again: the same game
 * seconds and the same score.
 */
async function noiz2saBotSeedPerVisit(testController) {
    return withTrainer(testController, async (mod, service, gs) => {
        handTrainer(service, 4);
        mod.pinBotSeed(null);
        const v1 = await assistedRecordVisit(testController, mod, gs, 'visit 1');
        if (!v1) return;
        const v2 = await assistedRecordVisit(testController, mod, gs, 'visit 2');
        if (!v2) return;
        testController.assertEqual('each Record summary carries its visit\'s bot seed', true,
            v1.summary.playStats?.botSeed === v1.seed && v2.summary.playStats?.botSeed === v2.seed);
        testController.assertEqual('the two visits drew different bot seeds', true, v1.seed !== v2.seed);
        mod.pinBotSeed(v1.seed);
        const v3 = await assistedRecordVisit(testController, mod, gs, 'visit 3 (visit 1\'s seed)');
        if (!v3) return;
        testController.assertEqual('the recorded seed replays: visit 3 played visit 1 exactly (game seconds, score, bot frames)',
            JSON.stringify([v1.seed, v1.summary.playStats.gameSeconds, v1.summary.playStats.score, v1.summary.playStats.botFrames]),
            JSON.stringify([v3.summary.playStats?.botSeed, v3.summary.playStats?.gameSeconds, v3.summary.playStats?.score,
                v3.summary.playStats?.botFrames]));
    });
}

/**
 * N4b (d) — the bot-assist key. A Record block on 1:1 (bot seed 1, tracks 0 By hand, 1×): B hands the controls to the
 * bot (the clock runs, the drain charges), B again hands them back (the game pauses, the clock stops, nothing drains),
 * a game key resumes the player's play, B gives it to the bot again, which plays to the clear, and the clear performs
 * the queued move. The summary holds the bot's play (botFrames), the block's interior no check, the visit cost its game
 * seconds, and the bot trained.
 */
async function noiz2saAssistKey(testController) {
    return withTrainer(testController, async (mod, service, gs) => {
        const label = 'assist';
        handTrainer(service, 1);
        mod.pinBotSeed(1);
        const r = await loadStartRegion(testController, label);
        if (!r) return;
        const before = debugState()?.configures ?? 0;
        const block = queueBlock(testController, r, 'record', label);
        if (!block) return;
        gs.refillMana();
        loopStateSingleton.startProcessing();
        const parked = await testController.pollForCondition(() => loopStateSingleton.livePlayRegion() === r.region,
            `[${label}] the Record block parked`, 15000, 100);
        testController.reportCondition(`[${label}] the Record block parked`, !!parked);
        if (!parked || !(await pageConfigured(testController, r.region, before, label, mod.getVisitBotSeed))) return;
        const manaAtPark = currentMana(), earnedBefore = service.trainer.earned, unit = unitDrainCost(r.region);

        pressKey('KeyB');
        const botOn = await testController.pollForCondition(() => {
            const d = debugState();
            return d?.bot?.goal?.kind === 'assist' && d.state === 'playing' && d.attemptFrames >= 150
                && loopStateSingleton._playClock?.running === true;
        }, `[${label}] B: the bot plays for the player, the clock runs`, 15000, 20);
        testController.reportCondition(`[${label}] B: the bot plays for the player, the clock runs`, !!botOn);
        pressKey('KeyB');
        const handedBack = await testController.pollForCondition(() => {
            const d = debugState();
            return d?.bot === null && d.state === 'paused' && loopStateSingleton._playClock?.running === false;
        }, `[${label}] B again: the controls are the player's (paused, the clock stopped)`, 5000, 20);
        testController.reportCondition(`[${label}] B again: the controls are the player's (paused, the clock stopped)`, !!handedBack);
        const frames = debugState()?.frames, manaPaused = currentMana();
        await new Promise((res) => setTimeout(res, 1500));
        testController.assertEqual(`[${label}] handed back and untouched: nothing stepped, nothing drained`, true,
            debugState()?.frames === frames && currentMana() === manaPaused);
        pressKey('KeyZ');
        const playerPlays = await testController.pollForCondition(() => {
            const d = debugState(); return d?.state === 'playing' && d.bot === null && d.frames > frames;
        }, `[${label}] a game key: the player plays`, 5000, 10);
        testController.reportCondition(`[${label}] a game key: the player plays`, !!playerPlays);
        pressKey('KeyB');
        const crossed = await testController.pollForCondition(() => currentRegion() === r.target,
            `[${label}] the clear performed the queued move into ${r.target}`, 120000, 100);
        testController.reportCondition(`[${label}] the clear performed the queued move into ${r.target}`, !!crossed);
        if (!crossed) return;
        const interior = loopStateSingleton.getActionQueue().filter((a) => a.sourceRegion === r.region && a.type !== 'regionMove');
        testController.assertEqual(`[${label}] the block's interior holds no check and no explore (the move is the clear)`,
            '[]', JSON.stringify(interior.map((a) => a.type)));
        const saved = loopStateSingleton._lookupBoundSummary(r.region, block.instance);
        const ps = saved?.summary?.playStats ?? null;
        testController.log(`[${label}] summary ${JSON.stringify(saved?.summary)}`);
        const totalFrames = Math.round((ps?.gameSeconds ?? 0) * 62.5);
        testController.assertEqual(`[${label}] the summary holds the bot's play: all but the player's few frames`, true,
            !!ps && ps.botSeed === 1 && ps.botFrames > 0 && ps.botFrames < totalFrames && totalFrames - ps.botFrames < 120);
        testController.assertEqual(`[${label}] the visit cost floor(its game seconds) of drain (± one second)`, true,
            Math.abs((manaAtPark - currentMana()) - Math.floor(ps?.gameSeconds ?? 0) * unit) <= unit + 0.001);
        const { pointsFor } = await import('../../bulletml-dodge/src/game/tracks.js');
        const want = pointsFor(service.trainer.settings, { seconds: ps?.gameSeconds ?? 0, score: ps?.score ?? 0 });
        testController.assertEqual(`[${label}] the visit trained the bot (its points)`, true,
            want > 0 && Math.abs((service.trainer.earned - earnedBefore) - want) < 1e-6);
    });
}

/**
 * N4b (e) — ⚖ "if there isn't already a move queued, then the Noiz2sa panel should display a list of available exits,
 * and when the player chooses one of the exits, that's when the game starts. When the level is cleared, the move to
 * the exit that the player chose is performed." An empty queue in loop mode: the page waits in `choosing` (its clock
 * stopped, game keys do nothing); choosing the exit queues the move (the Loops queue holds it, the queue starts and
 * parks a Record block) and starts the game; B lets the bot clear it, and the clear performs the chosen move.
 */
async function noiz2saChooseExit(testController) {
    return withTrainer(testController, async (mod, service, gs) => {
        const label = 'choose';
        handTrainer(service, 4);
        mod.pinBotSeed(1);
        const r = await loadStartRegion(testController, label);
        if (!r) return;
        loopStateSingleton.stopProcessing?.();
        gs.clearPath?.();
        testController.eventBus.publish('ui:activatePanel', { panelId: 'noiz2saSubstratePanel' });
        const choosing = await testController.pollForCondition(() => {
            const d = debugState(); return d?.regionId === r.region && d.state === 'choosing' && d.loopMode && d.move === null;
        }, `[${label}] no move queued: the page shows the exits and waits for a choice`, 30000, 100);
        testController.reportCondition(`[${label}] no move queued: the page shows the exits and waits for a choice`, !!choosing);
        if (!choosing) { testController.log(`DIAG: ${JSON.stringify(debugState())}`, 'error'); return; }
        pressKey('KeyZ');
        await new Promise((res) => setTimeout(res, 500));
        testController.assertEqual(`[${label}] a game key does not start it; nothing steps`, true,
            debugState()?.state === 'choosing' && debugState()?.frames === 0);
        gs.refillMana();
        gameWindow().__noiz2saTest.choose(r.exit.name);
        const started = await testController.pollForCondition(() => {
            const d = debugState();
            return d?.state === 'playing' && d.queuedExit === r.exit.name && loopStateSingleton.livePlayRegion() === r.region;
        }, `[${label}] choosing ${r.exit.name} queued the move, the queue parked, the game started`, 15000, 20);
        testController.reportCondition(`[${label}] choosing ${r.exit.name} queued the move, the queue parked, the game started`, !!started);
        if (!started) { testController.log(`DIAG: ${JSON.stringify(debugState())} queue ${JSON.stringify(loopStateSingleton.getActionQueue().map((a) => [a.type, a.sourceRegion, a.exitUsed]))} state ${loopStateSingleton.getProcessingState()}`, 'error'); return; }
        const q = loopStateSingleton.getActionQueue().filter((a) => a.type === 'regionMove' && a.sourceRegion === r.region);
        testController.assertEqual(`[${label}] the Loops queue holds the chosen move`, JSON.stringify([[r.exit.name, r.target]]),
            JSON.stringify(q.map((a) => [a.exitUsed, a.destinationRegion])));
        pressKey('KeyB');
        const crossed = await testController.pollForCondition(() => currentRegion() === r.target,
            `[${label}] the clear performed the chosen move into ${r.target}`, 120000, 100);
        testController.reportCondition(`[${label}] the clear performed the chosen move into ${r.target}`, !!crossed);
        if (!crossed) return;
        await testController.stateManager.pingWorker('after-choose', 3000);
        testController.assertEqual(`[${label}] the clear checked ${r.location}`, true,
            snapshotHasLocation(testController.stateManager.getSnapshot(), r.location));
        const block = resolveBlockFor(r.region);
        const saved = block ? loopStateSingleton._lookupBoundSummary(r.region, block.instance) : null;
        testController.assertEqual(`[${label}] the Record block saved the visit, departing by the chosen exit`, true,
            !!saved && saved.departureExitId === r.exit.name && (saved.summary?.checks ?? []).includes(r.location));
    });
}

registerTest({
    id: 'noiz2sa-choose-exit',
    name: 'Noiz2sa N4b: with no move queued the page lists the exits; choosing one queues it and starts the game; the clear performs it',
    description: 'Loop mode, an empty queue on 1:1: the page waits in choosing (a game key does nothing). Choosing the '
        + 'exit queues the move in the Loops queue, the queue parks a Record block and the game starts; B lets the bot '
        + 'clear it (seed 1, tracks 0 By hand, 4×), and the clear performs the chosen move: the location is checked and '
        + 'the Record summary departs by that exit.',
    testFunction: restoresSavedQueues(noiz2saChooseExit),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'noiz2sa-bot-replays-cleared-region',
    name: 'Noiz2sa N4b: in loop mode a Bot block on an already-cleared region plays it again, costs mana and trains',
    description: 'Loads noiz2sa_substrate_test; a Bot block clears 1:1 (bot seed 1, tracks 0 By hand, 4×) and leaves. '
        + 'Back on the region (cleared before), the page keeps its exits closed, and the same Bot block plays it to a '
        + 'clear again (1002 frames, score 17330) before leaving: the visit costs floor(16.032) game seconds of drain '
        + 'and earns its training points.',
    testFunction: restoresSavedQueues(noiz2saBotReplaysClearedRegion),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'noiz2sa-first-entry-explores',
    name: 'Noiz2sa N4b: a region\'s first entry explores it fully',
    description: 'Loads noiz2sa_substrate_test, fogs its second region (location and exits undiscovered) and moves the '
        + 'player into it: on that first entry the region reads fully explored, every exit discovered through '
        + 'discovery:exitDiscovered, nothing checked.',
    testFunction: restoresSavedQueues(noiz2saFirstEntryExplores),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'noiz2sa-bot-seed-per-visit',
    name: 'Noiz2sa N4b: each visit draws its own bot seed, a Record summary carries it, and the recorded seed replays',
    description: 'Three Record visits on fresh loads, each played to a clear by the bot (B, tracks 0 By hand, 4×). '
        + 'Visits 1 and 2 drew different seeds, each in its summary\'s playStats.botSeed; visit 3, pinned to visit 1\'s '
        + 'recorded seed, plays visit 1 exactly (game seconds, score, bot frames).',
    testFunction: restoresSavedQueues(noiz2saBotSeedPerVisit),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'noiz2sa-assist-key',
    name: 'Noiz2sa N4b: B hands the controls to the bot and back; the Record summary holds the bot\'s play',
    description: 'A Record block on 1:1 (bot seed 1, tracks 0 By hand): B — the bot plays and the clock runs; B — the '
        + 'player\'s controls, paused, nothing steps or drains; a game key — the player plays; B — the bot plays on to '
        + 'the clear, which performs the queued move. The summary\'s playStats count the bot\'s frames, the block '
        + 'interior holds no check, the visit cost its game seconds and trained the bot.',
    testFunction: restoresSavedQueues(noiz2saAssistKey),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'noiz2sa-bot-block-trains',
    name: 'Noiz2sa: a Bot block clears a region at the current tracks, the tracks rise, and 2× costs what 1× costs',
    description: 'Twice on a fresh load of noiz2sa_substrate_test and a fresh trainer (tracks 0, Even): a Bot block on '
        + '1:1 hands its exit to the page\'s humanlike bot (worker), which clears the region deathless in 1002 frames '
        + '(score 17330, as headless runSegment at tracks 0) and leaves; the clear is checked, the visit costs '
        + 'floor(16.032) game seconds × the rate, the bot earns the visit\'s points and the tracks rise. Once at 1×, '
        + 'once at 2× (the bot-speed setting): the same frames and the same mana. Then at tracks 20 and 4×: three '
        + 'hits and a clear on attempt 4 (as headless), and with a retry cap of 2 the bot gives up and the region waits.',
    testFunction: restoresSavedQueues(noiz2saBotBlockTrains),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'noiz2sa-refused-clear-resent',
    name: 'Noiz2sa: a clear the gate refused is sent again on the same visit; an accepted one never twice',
    description: 'Loads noiz2sa_substrate_test (loop mode) and parks a Record block on 1:1. With the queue paused the '
        + 'clearing tape clears it and the action gate refuses the check (loops:clickIgnored); unpaused, on the same '
        + 'visit, R plays the region again and the second clear checks the location; a third clear dispatches nothing.',
    testFunction: restoresSavedQueues(noiz2saRefusedClearResent),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'noiz2sa-region-loop-visit',
    name: 'Noiz2sa: a region played by injected input — a hit restarts it, the clear checks it, Record → Playback',
    description: 'Loads noiz2sa_substrate_test (loop mode), parks a Record block on its 1:1 region and drives the '
        + 'game page by injected input: idle fire is hit at frame 240 and the region restarts with nothing '
        + 'checked; a clearing tape clears it and checks its location; leaving saves a summary (duration in whole '
        + 'game seconds, check, departure, playStats) priced by the live time drain; then instant Playback spends '
        + 'the repriced summary, crosses the departure and earns the summary\'s training points.',
    testFunction: restoresSavedQueues(noiz2saRegionLoopVisit),
    category: 'noiz2saSubstrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
