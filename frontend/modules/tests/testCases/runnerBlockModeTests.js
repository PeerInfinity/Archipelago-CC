/**
 * In-app test for the loops block-mode system on the RUNNER substrate —
 * the M5 summary capture category (runner + bounce), whose contract is
 * neither coarse-only nor fine-grained:
 *
 *   Record   — the visit's NET RESULT is captured (how long it took, which
 *              checks it performed, which exit it left by), not a
 *              replayable action stream.
 *   Playback — that envelope is applied INSTANTLY: the repriced mana is
 *              deducted, the recorded checks are refired and the recorded
 *              departure is crossed. The game replays NOTHING; the player
 *              character stays where it is. That is the design.
 *
 * Runner over bounce because the auto-runner PLAYS ITSELF: it permanently
 * holds right, so a flat level's pickup and its right-hand exit portal both
 * fire from real physics with zero synthesized input (the pattern
 * `runner-location-check-real-physics` proves in-app). Loop mode comes from
 * a synthetic shuffled-spiral world with loop_costs embedded (the
 * taswBlockModeTests recipe).
 *
 * The level is configured AFTER the Record block parks, deliberately: the
 * queue's arrival move makes procgenPlayer publish runner:loadRegion for
 * the region, which would overwrite a level configured earlier.
 *
 * Runs only in the test-substrates mode (registered enabled:false; needs
 * the full module config for the runner runtime to exist at all).
 */

import { registerTest } from '../testRegistry.js';
import { generateLoopCosts } from '../../shared/procgen/loopCostGenerator.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { resolveQueueBlocks } from '../../loops/blockIdentity.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';

const RUNNER_PRESET_RULES_PATH =
    './presets/runner_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const RUNNER_PRESET_SPHERE_LOG_PATH =
    './presets/runner_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl';

// Flat strip: the auto-runner touches the pickup at x=12 and reaches the
// right-hand portal at x=29.4 within a few seconds, no input needed.
const TEST_LEVEL = {
    id: 'runner_m5_summary_level',
    size: { width: 30.01, height: 16 },
    platforms: [{ id: 'floor', x: 0, y: 0, w: 30, h: 1, type: 'ground' }],
    hazards: [],
    pickups: [{ id: 'obj_alpha', on: 'floor', x: 12, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floor', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

const currentRegion = () => getGameStateSingleton()?.getCurrentRegion?.() ?? null;
const currentMana = () => getGameStateSingleton()?.getCurrentMana?.() ?? 0;

/** True if the snapshot lists `name` among its checked locations. */
function snapshotHasLocation(snapshot, name) {
    const checked = snapshot?.checkedLocations;
    if (Array.isArray(checked)) return checked.includes(name);
    if (checked && typeof checked === 'object') return !!checked[name];
    return false;
}

function runnerIframe() {
    return document.querySelector('iframe[src*="runnerDemo/game/index.html"]');
}

/** Resolve the queue block (visit) for `region`, newest instance first. */
function resolveBlockFor(region) {
    const queue = loopStateSingleton.getActionQueue?.() ?? [];
    const { visits } = resolveQueueBlocks(queue);
    return [...visits].reverse().find(v => v.name === region) ?? null;
}

/**
 * Load the committed runner preset with a loop_costs sidecar generated
 * from its sphere log, and wait for loop mode to auto-enable.
 *
 * Deliberately NOT a freshly procgen'd world: generating runner levels
 * in-page blocks the main thread long enough to time out every iframe
 * heartbeat (measured — a 6-region runner spiral took ~2 minutes and
 * disconnected the bridges this test depends on). The committed preset
 * already carries generated levels and preset sidecars; the only missing
 * piece is loop_costs, and its generator is a pure function.
 *
 * Generating (rather than hand-writing) the sidecar also makes this an
 * end-to-end check that the generator TIME-PRICES summary regions.
 */
async function loadRunnerLoopWorld(testController) {
    testController.log('Loading the runner preset with a generated loop_costs sidecar…');
    let rulesJson;
    try {
        const rulesRes = await fetch(RUNNER_PRESET_RULES_PATH);
        rulesJson = await rulesRes.json();
        const logRes = await fetch(RUNNER_PRESET_SPHERE_LOG_PATH);
        const sphereLog = (await logRes.text())
            .split('\n').filter(l => l.trim().length > 0).map(l => JSON.parse(l));
        rulesJson = {
            ...rulesJson,
            loop_costs: generateLoopCosts({
                rulesJson,
                sphereLog,
                sourceFileName: 'runnerBlockModeTests',
            }),
        };
    } catch (e) {
        testController.log(`preset + loop_costs preparation failed: ${e.message}`, 'error');
        testController.reportCondition('prepared the runner preset with loop_costs', false);
        return false;
    }
    testController.reportCondition('prepared the runner preset with loop_costs', true);

    const rulesLoadedPromise = testController.waitForEvent('stateManager:rulesLoaded', 8000);
    testController.eventBus.publish('files:jsonLoaded', {
        jsonData: rulesJson,
        selectedPlayerId: '1',
        sourceName: 'runnerBlockModeTests',
    });
    await rulesLoadedPromise;
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    // Poll the flag, not the event — a previous test may have left loop
    // mode on, in which case auto-enable is a no-op and no event fires.
    const loopOn = await testController.pollForCondition(
        () => getGameStateSingleton()?.isLoopModeActive === true,
        'loop mode active (auto-enabled by loop_costs)',
        5000, 100,
    );
    testController.reportCondition('loop mode active (auto-enabled by loop_costs)', !!loopOn);
    return !!loopOn;
}

/** Activate the runner panel and wait for its iframe bridge to wire up. */
async function mountRunner(testController, regionName) {
    testController.eventBus.publish('ui:activatePanel', { panelId: 'runnerDemoPanel' });
    testController.eventBus.publish('procgen:activeSubstrateChanged', {
        substrate: 'runner',
        componentType: 'runnerDemoPanel',
        label: 'Runner Demo',
        regionId: regionName,
    });
    const ready = await testController.pollForCondition(
        () => {
            const b = runnerIframe()?.contentWindow?.__swfBridge;
            return !!(b && typeof b.sendLocation === 'function' && typeof b.configure === 'function');
        },
        'runner iframe mounted + __swfBridge wired',
        15000, 300,
    );
    testController.reportCondition('runner iframe mounted + __swfBridge wired', !!ready);
    // Let the iframe finish registering with the iframeAdapter before
    // driving publishes through it (mirrors the flash / tasw / runner tests).
    if (ready) await new Promise(r => setTimeout(r, 1000));
    return !!ready;
}

/** First location and first connected exit of `region`, from staticData. */
function pickTargets(testController, region) {
    const staticData = testController.stateManager.getStaticData?.();
    const regionData = staticData?.regions?.get(region);
    const location = regionData?.locations?.[0]?.name ?? null;
    const exit = (regionData?.exits ?? []).find(e => e.connected_region) ?? null;
    return exit && location
        ? { location, exitId: exit.name, target: exit.connected_region }
        : null;
}

// ─── The record → playback leg ────────────────────────────────────

async function summaryRecordThenInstantPlayback(testController) {
    if (!await loadRunnerLoopWorld(testController)) {
        return testController.getOverallResult();
    }

    // procgenPlayer hops off the synthetic Menu into the first warehoused
    // region on load; wait for that before reading where we are.
    await testController.pollForCondition(
        () => loopStateSingleton.getRegionCaptureShape?.(currentRegion()) === 'summary',
        'the player landed in a runner region',
        10000, 200,
    );
    const region = currentRegion();
    testController.log(`start region: ${region}`);
    const shape = loopStateSingleton.getRegionCaptureShape?.(region);
    testController.assertEqual(
        'the start region is a SUMMARY substrate region', 'summary', shape);
    if (shape !== 'summary') return testController.getOverallResult();

    const picked = pickTargets(testController, region);
    testController.assertEqual('a location and an exit were resolvable', true, !!picked);
    if (!picked) return testController.getOverallResult();
    const { location, exitId, target } = picked;
    testController.log(`mapping pickup 'obj_alpha' → '${location}'; portal → '${exitId}' → '${target}'`);

    if (!await mountRunner(testController, region)) return testController.getOverallResult();

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    let restoreWatchers = () => {};
    try {
        // A depletion reset mid-run would refill the pool and discard the
        // capture — this test is about the economy, not about depletion.
        gs.noManaDepletionReset = true;

        // ── 1. Author the block and park it in Record ──────────────
        gs.updatePath(target, exitId, region);
        const block = resolveBlockFor(region);
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!block);
        if (!block) return testController.getOverallResult();
        loopStateSingleton.setBlockMode(region, block.instance, 'record');

        gs.refillMana();
        loopStateSingleton.startProcessing();
        const parked = await testController.pollForCondition(
            () => loopStateSingleton._manualActionEntered === true
                && loopStateSingleton._manualRegionName === region,
            'the Record block parked for live play',
            15000, 100,
        );
        testController.reportCondition('the Record block parked for live play', !!parked);
        if (!parked) return testController.getOverallResult();
        const manaAtPark = currentMana();

        // ── 2. Configure the flat level and let the runner play it ──
        // AFTER the park: the queue's arrival move made procgenPlayer
        // publish runner:loadRegion, which would have overwritten this.
        testController.eventBus.publish('runner:loadRegion', {
            region_id: region,
            world: {
                gameId: 'runnerDemo',
                params: { runnerLevel: TEST_LEVEL, sidePortals: { E: 'exit_main' } },
                ap_locations: { obj_alpha: location },
                // The bridge picks the exit by SIDE and dispatches
                // user:regionMove with this exitName / targetRegion.
                exits: [{ side: 'E', exitName: exitId, targetRegion: target }],
            },
        });
        const configured = await testController.pollForCondition(
            () => runnerIframe()?.contentWindow?.__runnerDebug?.()?.levelId === TEST_LEVEL.id,
            'the flat test level configured into the runner iframe',
            10000, 300,
        );
        if (!configured) {
            testController.log('DIAG: iframe level is '
                + `'${runnerIframe()?.contentWindow?.__runnerDebug?.()?.levelId ?? '(none)'}'`, 'error');
        }
        testController.reportCondition('the flat test level configured into the runner iframe', !!configured);
        if (!configured) return testController.getOverallResult();

        const crossed = await testController.pollForCondition(
            () => currentRegion() === target,
            `the auto-runner crossed '${exitId}' into '${target}'`,
            25000, 200,
        );
        testController.assertEqual(
            'the auto-runner played the block and crossed its exit on real physics',
            true, !!crossed);
        if (!crossed) return testController.getOverallResult();
        await testController.stateManager.pingWorker('after-record', 3000);

        // ── 3. What the Record captured ────────────────────────────
        const saved = loopStateSingleton._lookupBoundSummary(region, block.instance);
        testController.assertEqual('a summary recording is bound to the block', true, !!saved);
        if (!saved) return testController.getOverallResult();
        testController.log(`summary: ${JSON.stringify(saved.summary)} departure=${saved.departureExitId}`);

        testController.assertEqual(
            'the recorded visit lasted at least one drain tick',
            true, saved.summary.durationSeconds >= 1);
        testController.assertEqual(
            'the performed check is listed in the summary',
            true, (saved.summary.checks ?? []).includes(location));
        testController.assertEqual(
            'the crossed exit is the recorded departure', exitId, saved.departureExitId);
        // A summary is NOT a replayable script.
        testController.assertEqual(
            'the summary entry carries no replayable actions', 0, (saved.actions ?? []).length);
        // End-to-end check on the generated sidecar: a summary region is
        // TIME-priced, so nothing the visit did carried an explicit cost.
        testController.assertEqual(
            'the generated loop_costs left the summary region time-priced (no costed actions)',
            0, (saved.summary.costedActions ?? []).length);

        // The drain charged: mana dipped by the duration × the region rate
        // (1/s by default), within one tick of sampling slack.
        const drained = manaAtPark - currentMana();
        const rate = loopStateSingleton.costDataManager?.getTimeDrainPerSecond?.(region) ?? 1;
        testController.log(`drained ${drained} mana over ${saved.summary.durationSeconds}s at ${rate}/s`);
        testController.assertEqual(
            'live play drained the time cost of the visit (± one tick)',
            true,
            Math.abs(drained - saved.summary.durationSeconds * rate) <= rate + 0.001,
        );

        // The interior was rewritten to what the player actually did, and
        // the block auto-switched to Playback.
        const interior = (loopStateSingleton.getActionQueue() ?? [])
            .filter(a => a.type === 'locationCheck' && a.sourceRegion === region)
            .map(a => a.locationName);
        testController.assertEqual(
            'the block interior was rewritten to the performed check',
            JSON.stringify([location]), JSON.stringify(interior));
        testController.assertEqual(
            'the block auto-switched to Playback',
            'playback', loopStateSingleton.getBlockMode(region, block.instance));
        // The ● recorded indicator's seam.
        testController.assertEqual(
            'the block reports playable content (the ● recorded indicator)',
            true, loopStateSingleton.hasBoundSummary(region, block.instance));

        // ── 4. Reset and put the player back where the block starts ─
        // Teleport the way a loop reset does (fromReset is exempt from the
        // gate and ignored by the wake), then reset the loop. Published
        // through the loops dispatcher — the same object the queue itself
        // publishes moves on.
        const dispatcherForTeleport = loopStateSingleton.dispatcher;
        testController.assertEqual(
            'the loops dispatcher is available for the reset teleport',
            true, typeof dispatcherForTeleport?.publish === 'function');
        if (typeof dispatcherForTeleport?.publish !== 'function') {
            return testController.getOverallResult();
        }
        dispatcherForTeleport.publish('user:regionMove', {
            sourceRegion: target, targetRegion: region, fromReset: true, updatePath: false,
        }, { initialTarget: 'bottom' });
        const back = await testController.pollForCondition(
            () => currentRegion() === region, `teleported back to '${region}'`, 10000, 200);
        testController.reportCondition(`teleported back to '${region}'`, !!back);
        if (!back) return testController.getOverallResult();

        loopStateSingleton._resetLoop();

        // ── 5. Watchers for the Playback leg ───────────────────────
        // Non-vacuity: both watchers must be provably LIVE before their
        // counts mean anything, so a missing seam fails loudly instead of
        // reading as "nothing happened".
        const controller = substrateRegistry.get('runner')?.getPlaybackController?.();
        const canWatchWalkTo = !!controller && typeof controller.walkTo === 'function';
        testController.assertEqual(
            'the runner playback controller exposes walkTo (the watcher is live)',
            true, canWatchWalkTo);
        if (!canWatchWalkTo) return testController.getOverallResult();
        const walkToCalls = [];
        const origWalkTo = controller.walkTo;
        controller.walkTo = (...args) => { walkToCalls.push(args); return origWalkTo.apply(controller, args); };

        const disp = loopStateSingleton.dispatcher;
        const canWatchDispatch = !!disp && typeof disp.publish === 'function'
            && typeof disp.publishToNextModule === 'function';
        testController.assertEqual(
            'the loops dispatcher is wrappable (the watcher is live)',
            true, canWatchDispatch);
        if (!canWatchDispatch) { controller.walkTo = origWalkTo; return testController.getOverallResult(); }
        const dispatched = [];
        const origPublish = disp.publish;
        const origToNext = disp.publishToNextModule;
        disp.publish = (name, data, opts) => {
            dispatched.push({ name, data }); return origPublish.call(disp, name, data, opts);
        };
        disp.publishToNextModule = (mod, name, data, opts) => {
            dispatched.push({ name, data }); return origToNext.call(disp, mod, name, data, opts);
        };
        restoreWatchers = () => {
            controller.walkTo = origWalkTo;
            disp.publish = origPublish;
            disp.publishToNextModule = origToNext;
        };

        // ── 6. Replay the SAME block ───────────────────────────────
        // Price the stored envelope at the CURRENT XP level — this is what
        // the apply must spend, and it is nowhere near the per-action
        // defaults (50 a move / 100 a check) the summary economy replaces.
        const expected = loopStateSingleton._priceSummaryReplay(region, saved.summary);
        testController.log(`expected replay price: ${expected}`);
        testController.assertEqual('the stored envelope has a nonzero replay price', true, expected > 0);

        let manaAtApplyPark = null;
        const onParked = (d) => {
            if (d?.summary && manaAtApplyPark === null) manaAtApplyPark = currentMana();
        };
        testController.eventBus.subscribe('loopState:manualEntered', onParked);

        loopStateSingleton.startProcessing();
        const recrossed = await testController.pollForCondition(
            () => currentRegion() === target,
            `Playback crossed into '${target}' again`,
            15000, 100,
        );
        testController.eventBus.unsubscribe?.('loopState:manualEntered', onParked);
        testController.assertEqual(
            'instant Playback crossed the recorded departure through the real chain',
            true, !!recrossed);
        await testController.stateManager.pingWorker('after-playback', 3000);

        // ── 7. Assert the EFFECT, not merely the completion ────────
        testController.assertEqual(
            'the summary apply parked the block (its mana sample was taken)',
            true, manaAtApplyPark !== null);
        if (manaAtApplyPark !== null) {
            const spent = manaAtApplyPark - currentMana();
            testController.log(`playback spent ${spent} (expected ${expected})`);
            testController.assertEqual(
                'Playback spent exactly the repriced envelope — the summary was used, '
                + 'not per-action defaults',
                true, Math.abs(spent - expected) < 0.001);
        }

        const refired = dispatched.filter(e => e.name === 'user:locationCheck'
            && e.data?.locationName === location);
        testController.assertEqual(
            'the recorded check was refired', true, refired.length >= 1);
        testController.assertEqual(
            'the refired check carries fromLoop', true, refired.every(e => e.data?.fromLoop === true));
        const moves = dispatched.filter(e => e.name === 'user:regionMove'
            && e.data?.sourceRegion === region && e.data?.targetRegion === target);
        testController.assertEqual(
            'the departure was dispatched', true, moves.length >= 1);
        testController.assertEqual(
            'the departure carries fromLoop and the recorded exit', true,
            moves.every(e => e.data?.fromLoop === true && e.data?.exitName === exitId));

        // ...and the game replayed NOTHING. The positive counts above are
        // what keeps this zero from being vacuous.
        testController.assertEqual(
            'the game replayed nothing — no walkTo was driven', 0, walkToCalls.length);
    } finally {
        restoreWatchers();
        gs.noManaDepletionReset = savedNoReset;
        // Leave loop mode OFF: nothing auto-disables it on preset switch,
        // and a leaked active flag turns the strict gate loose on later
        // tests' (non-loop) worlds.
        gs.setLoopModeActive(false);
        loopStateSingleton.stopProcessing?.();
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'runner-summary-record-playback',
    name: 'Runner: summary Record captures a visit and Playback applies it instantly',
    description: 'Parks a Record block on a runner region of a synthetic loop world, '
               + 'lets the auto-runner play it on real physics (check + exit, zero '
               + 'synthesized input), and asserts the captured summary (duration, '
               + 'checks, departure) plus the live drain. Then resets and replays the '
               + 'same block: the apply must spend exactly the REPRICED envelope, '
               + 'refire the check and cross the departure with fromLoop — while the '
               + 'game replays nothing (walkTo never called).',
    testFunction: summaryRecordThenInstantPlayback,
    category: 'Runner block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── The Bot leg (M6) ─────────────────────────────────────────────
//
// Replaces scripts/procgen/verify-bounce-loop-mode.mjs, which was deleted in
// M6 slice 5: its premise (auto walkTo from the queue with no mode system)
// is obsolete, and it rotted red for months because nothing gate-ran it.
// This is its contract, moved into the gate-run substrate suite.
//
// A BOT block on a runner region hands the queued regionMove to the walkTo
// solver; the auto-runner plays the level on real physics and crosses the
// exit. The point of the test is the ECONOMY: a summary Bot is priced by
// TIME (M6 ruling 3), so the pool falls by the per-second drain for as long
// as the bot plays, and NOT by the per-action defaults (50 a move / 100 a
// check) — with region XP rising 1:1 with the drain.

async function summaryBotBlockDrainsWhileDriving(testController) {
    if (!await loadRunnerLoopWorld(testController)) {
        return testController.getOverallResult();
    }

    await testController.pollForCondition(
        () => loopStateSingleton.getRegionCaptureShape?.(currentRegion()) === 'summary',
        'the player landed in a runner region',
        10000, 200,
    );
    const region = currentRegion();
    testController.log(`start region: ${region}`);
    const shape = loopStateSingleton.getRegionCaptureShape?.(region);
    testController.assertEqual(
        'the start region is a SUMMARY substrate region', 'summary', shape);
    if (shape !== 'summary') return testController.getOverallResult();

    // A summary substrate plays real-time physics — no instant variant — so
    // the Bot Instant checkbox is deliberately withheld. Assert that here:
    // it is the other half of ruling 4 (jta YES, summary NO), and the
    // runner in-app context is where "NO" is real.
    testController.assertEqual(
        'a summary Bot does NOT offer Instant (ruling 4)',
        false, loopStateSingleton.regionBotHonorsInstant?.(region) ?? false);

    const picked = pickTargets(testController, region);
    testController.assertEqual('a location and an exit were resolvable', true, !!picked);
    if (!picked) return testController.getOverallResult();
    const { location, exitId, target } = picked;
    testController.log(`mapping pickup 'obj_alpha' → '${location}'; portal → '${exitId}' → '${target}'`);

    if (!await mountRunner(testController, region)) return testController.getOverallResult();

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    let restoreWalkTo = () => {};
    let unsubMana = () => {};
    try {
        // Keep a depletion reset from cutting the walk short: this leg is
        // about the per-second economy, and a flat strip drains only a few
        // mana anyway (so the walk does NOT span a pool — the queue-restart
        // retry stays slice-3's unit-pinned path; see the closing report).
        gs.noManaDepletionReset = true;

        // Liveness-proven walkTo watcher, wrapped BEFORE the block engages so
        // it cannot miss the dispatch. THROW-equivalent: assert the seam is
        // real first, so a zero count below means "the bot did not drive",
        // never "the API vanished".
        const controller = substrateRegistry.get('runner')?.getPlaybackController?.();
        const canWatchWalkTo = !!controller && typeof controller.walkTo === 'function';
        testController.assertEqual(
            'the runner playback controller exposes walkTo (the watcher is live)',
            true, canWatchWalkTo);
        if (!canWatchWalkTo) return testController.getOverallResult();
        const walkToCalls = [];
        const origWalkTo = controller.walkTo;
        controller.walkTo = (...args) => { walkToCalls.push(args); return origWalkTo.apply(controller, args); };
        restoreWalkTo = () => { controller.walkTo = origWalkTo; };

        // Sample the pool from EVENTS, never a poller: a summary Bot's drain
        // is deducted a tick at a time, and (finding from the jta leg) under
        // any reset a poller can miss values a synchronous refill restores.
        // Each per-action default (50/100) would show here as one large
        // delta; the drain shows as a stream of small ones.
        const manaDeltas = [];
        let lastMana = null;
        const onMana = () => {
            const now = currentMana();
            if (lastMana !== null) manaDeltas.push(lastMana - now); // positive = spent
            lastMana = now;
        };

        // ── Author the block and engage the BOT solver ─────────────
        gs.updatePath(target, exitId, region);
        const block = resolveBlockFor(region);
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!block);
        if (!block) return testController.getOverallResult();
        loopStateSingleton.setBlockMode(region, block.instance, 'bot');

        gs.refillMana();
        lastMana = currentMana();
        testController.eventBus.subscribe('gameState:manaChanged', onMana);
        unsubMana = () => testController.eventBus.unsubscribe?.('gameState:manaChanged', onMana);

        loopStateSingleton.startProcessing();
        const engaged = await testController.pollForCondition(
            () => loopStateSingleton._botExecutedAction !== null,
            'the Bot block engaged the walkTo solver',
            15000, 100,
        );
        testController.reportCondition('the Bot block engaged the walkTo solver', !!engaged);
        if (!engaged) return testController.getOverallResult();
        const manaAtEngage = currentMana();

        // The Bot branch dispatched the walk toward the queued exit...
        testController.assertEqual('loops dispatched walkTo', true, walkToCalls.length >= 1);
        testController.assertEqual('walkTo targeted the queued exit', 'exit',
            walkToCalls[0]?.[0]?.kind);
        // ...and a bot is NOT live play (its events pass the gate on the
        // queueExecution exemption). Paired with the positive drain below so
        // this null is not vacuous.
        testController.assertEqual(
            'livePlayRegion is null while the solver drives (a bot is not live play)',
            null, loopStateSingleton.livePlayRegion());

        // ── Configure the flat level and let the runner play it ────
        // AFTER engage: the region load on entry would have overwritten a
        // level set earlier (the record leg's lesson).
        testController.eventBus.publish('runner:loadRegion', {
            region_id: region,
            world: {
                gameId: 'runnerDemo',
                params: { runnerLevel: TEST_LEVEL, sidePortals: { E: 'exit_main' } },
                ap_locations: { obj_alpha: location },
                exits: [{ side: 'E', exitName: exitId, targetRegion: target }],
            },
        });
        const configured = await testController.pollForCondition(
            () => runnerIframe()?.contentWindow?.__runnerDebug?.()?.levelId === TEST_LEVEL.id,
            'the flat test level configured into the runner iframe',
            10000, 300,
        );
        testController.reportCondition('the flat test level configured into the runner iframe', !!configured);
        if (!configured) return testController.getOverallResult();

        // The auto-runner plays the block and crosses its exit — real
        // physics, driven by the bot, through the real dispatcher.
        const crossed = await testController.pollForCondition(
            () => currentRegion() === target,
            `the bot crossed '${exitId}' into '${target}'`,
            25000, 200,
        );
        testController.assertEqual(
            'the bot played the block and crossed its exit on real physics',
            true, !!crossed);
        if (!crossed) return testController.getOverallResult();
        await testController.stateManager.pingWorker('after-bot', 3000);
        unsubMana();

        // ── The EFFECT: the check landed ───────────────────────────
        const snapshot = testController.stateManager.getLatestStateSnapshot?.();
        testController.assertEqual(
            'the bot-driven pickup landed the AP location check',
            true, snapshotHasLocation(snapshot, location));

        // ── The ECONOMY: TIME-priced, not per-action ───────────────
        const drained = manaAtEngage - currentMana();
        const rate = loopStateSingleton.costDataManager?.getTimeDrainPerSecond?.(region) ?? 1;
        const drainTicks = manaDeltas.filter(d => d > 0);
        testController.log(`drained ${drained} over ${drainTicks.length} tick(s) at base rate ${rate}/s; `
            + `deltas=[${manaDeltas.map(d => d.toFixed(2)).join(', ')}]`);

        // The drain ran — the pool fell while the bot drove. (Pairs with the
        // livePlayRegion-null assertion above: a bot drains without being
        // live play.)
        testController.assertEqual(
            'the pool drained while the bot drove', true, drained > 0);
        // TIME, not per-action: every deduction is a drain tick of at most
        // the base rate (XP discounts it, never inflates it). A per-action
        // default (50 a move / 100 a check) would be an order of magnitude
        // larger — its absence is the summary-economy pin.
        const biggest = drainTicks.length ? Math.max(...drainTicks) : 0;
        testController.assertEqual(
            `no per-action charge reached the bot (largest deduction ${biggest.toFixed(2)} ≤ rate ${rate})`,
            true, biggest <= rate + 0.001);
        // The completion charge for a summary Bot is explicit-only, and a
        // time-priced region names none — so the total is the drain, nothing
        // on top. drained == Σ ticks, within floating-point slack.
        const summed = drainTicks.reduce((a, b) => a + b, 0);
        testController.assertEqual(
            'the total spend is exactly the drain (no flat completion charge on top)',
            true, Math.abs(drained - summed) < 0.001);
        // Region XP rose 1:1 with the drain — every loops spend awards it.
        const xpNow = loopStateSingleton.getRegionXP(region).xp;
        testController.log(`region XP after the walk: ${xpNow} (drained ${drained})`);
        testController.assertEqual(
            'region XP rose by the drained mana (1:1, the loops spend signature)',
            true, Math.abs(xpNow - drained) < 0.001);

        // Retry disposition (reported, per the slice plan): a flat strip
        // drains only a few mana against a full pool, so this walk does NOT
        // span a loop reset — runner's queue-restart retry (the bridge holds
        // no pending walk, unlike jta) is not exercised here. It stays
        // covered by slice 3's unit pins (the depletion-mid-bot reset +
        // re-engage). Forcing a depletion would mean a level reload across
        // the reset, which buys fragility for a path already pinned.
        testController.log('RETRY DISPOSITION: walk did not span a pool (flat strip, ~few mana); '
            + 'runner queue-restart retry stays unit-pinned (slice 3), not exercised in-app.');
    } finally {
        unsubMana();
        restoreWalkTo();
        gs.noManaDepletionReset = savedNoReset;
        gs.setLoopModeActive(false);
        loopStateSingleton.stopProcessing?.();
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'runner-bot-block-summary-economy',
    name: 'Runner: a Bot block drives the level and is priced by TIME, not per-action',
    description: 'Parks a BOT block on a runner region of a synthetic loop world and hands '
               + 'the queued regionMove to the walkTo solver; the auto-runner plays the flat '
               + 'level on real physics and crosses the exit. Asserts loops dispatched walkTo '
               + '(liveness-proven), livePlayRegion is null while the bot drives, the pickup '
               + 'landed its AP check, and the ECONOMY is the per-second drain (XP-scaled, '
               + 'rising 1:1 with region XP) with NO per-action default charge on top. '
               + 'Replaces the deleted verify-bounce-loop-mode.mjs.',
    testFunction: summaryBotBlockDrainsWhileDriving,
    category: 'Runner block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});
