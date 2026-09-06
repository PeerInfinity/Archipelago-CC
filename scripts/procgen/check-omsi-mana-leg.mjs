/**
 * In-app verify for the OMSI (Idle Loops) mana leg — cross-game R2
 * slice 2. The unit suite pins the registry entry / zone channel; the
 * in-app substrate tests drive the bridge through the test controller;
 * this script is the independent stratum: it drives the leg through
 * the REAL app boot path — real preset load, real dispatcher moves,
 * real iframe + injected bridge, real resourceChannels router — and
 * observes the whole mana-channel contract end to end.
 *
 * Fixture: omsi_substrate_test (committed; regenerate with
 *   node scripts/test/generate-omsi-substrate-test-preset.mjs
 * ). 2 maze regions + 1 omsi region (region_1_1 = Beginnersville,
 * manaEnabled), loop_costs embedded (auto-enables loop mode).
 *
 * What it asserts:
 *   1. Loop mode auto-enabled; entering the omsi region starts the
 *      bridge's host-driven clock and pins the game's remaining budget
 *      (timeNeeded − timer) to the shared pool; the native 250 budget
 *      bonus lands in the per-substrate accumulator (maxMana grows).
 *   1b. A loops queue is PARKED on a Manual block in the omsi region,
 *      and the bridge's step gate answers OPEN with
 *      livePlay=<the omsi region> — asserted on the bridge's own log
 *      line, not only on its debug state. See the ⛓⛓ note at the park.
 *      ⚠ An OPEN gate is no longer enough to make the game run: under the
 *      ⚖ 2026-09-06 rule live play also needs the game itself started, and
 *      the fork boots stopped. Leg 3a is what presses Play.
 *   2. Victory (v0, §6 ruling): completing Start Journey — simulated
 *      via the game's own unlockTown(1), the exact call its finish
 *      handler makes — checks `region_1_1__start_journey` and the
 *      'Victory' item lands in the AP inventory (the preset's
 *      completion condition is item_check on it). ⚠ Asserted HERE, while
 *      the park is alive — leg 4 destroys it; see the ⛓⛓ note.
 *   3. A queued Wander run drains the pool in MANY SMALL decrements
 *      (the 5-tick step batches, ≈1 mana/tick) that track the game's
 *      own budget — the substrate:resourceDelta mirroring.
 *   3a. (inside 3, after the plan is written) The PLAY BUTTON is pressed,
 *      which is the cold start: it clears the game's own stopped flag AND
 *      restarts past the boundary the fork boots holding, so that plan
 *      compiles. See the ⛓⛓ note there.
 *   3b. (after the drain is visible) PAUSE stops the host clock and PLAY
 *      resumes it — the ⚖ 2026-09-06 rule, driven through the game's own
 *      button handler.
 *   4. Budget exhaustion (the game's natural restart) collapses with
 *      pool depletion into EXACTLY ONE loop reset: count +1 and stable,
 *      pool refilled, player teleported to the resolved start region,
 *      bridge clock stopped after leaving.
 *   5. Re-entering the omsi region resumes the clock and re-pins the
 *      (reset) budget to the pool. ⛔ It does NOT re-open the step gate:
 *      the reset's teleport hard-pauses the queue. Logged, not asserted.
 *
 * ⚠ REAL-TIME, BUT SHORT — MEASURED, NOT ASSUMED. Parked live play steps
 * the fork at ~50 ticks/s and each tick spends 1 mana, so leg 3 waits out
 * the whole pinned budget in wall-clock time. That budget is the shared
 * pool at entry (100 on this fixture), so the drain is ~2 s and the whole
 * run is **17 s** (three consecutive runs: 17.0 / 17.2 / 16.9 s wall,
 * ~11.6 s of which is the fixed page boot). It is real-time in KIND — a
 * bigger pool is proportionally longer — so every wait below is bounded
 * and the script stamps each leg with its own elapsed time.
 *
 * The omsi-loops iframe serves the CHECKED-OUT submodule tree, which
 * may be on a different branch than the outer gitlink — the script
 * logs the live branch/commit up front so results are attributable.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/check-omsi-mana-leg.mjs
 * @ci-box V3b adopted this script's NAME, not its RUN: it drives a repo-root dev server at a hardcoded `localhost:8000` and it takes no `--host=` at all, so the roster cannot point it elsewhere.
 *   ⇒ deleting this one line is how a later slice adopts it into CI.
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { takeBoxLockOrExit } from './boxLock.js';

/**
 * ⛓ R9 P3b, ⚖ 54 (7); ⚖ 62 at 12j — **THE BOX LOCK.** This instrument drives
 * the machine (browser), so it takes the box before it starts and refuses BY
 * NAME if another instrument holds it — replacing a hand-relayed "BOX BUSY".
 * A run UNDER a holder (`gates.mjs`, `standing-values`,
 * `rerecord-seedling-campaign`) recognises the holder's token and passes
 * through. `--wait-for-box=<sec>` queues instead of refusing.
 */

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'check-omsi-mana-leg.mjs', kind: 'browser' });

const URL = 'http://localhost:8000/frontend/?game=omsi_substrate_test&seed=1';
const OMSI_REGION = 'region_1_1';
/**
 * The omsi region's one graph exit and where it leads — the hop the parked
 * block departs on. Kept in step with `omsiSubstrateWrapper/test-helpers.js`
 * (`OMSI_TEST_EXIT` / `OMSI_TEST_EXIT_TARGET`), which the green in-app rows
 * park with; this script cannot import that module (it is browser-side), so
 * the values are re-declared and the park FAILS BY NAME if they drift.
 */
const OMSI_EXIT = 'exit_N';
const OMSI_EXIT_TARGET = 'region_1_0';
const NATIVE_BUDGET = 250;
const TIMEOUT_MS = 120000;
const T_START = Date.now();
const elapsed = () => `${((Date.now() - T_START) / 1000).toFixed(1)}s`;

try {
    const branch = execSync('git -C frontend/modules/omsi-loops rev-parse --abbrev-ref HEAD').toString().trim();
    const head = execSync('git -C frontend/modules/omsi-loops rev-parse --short HEAD').toString().trim();
    console.log(`omsi-loops submodule checked out: ${branch} @ ${head} (iframe serves this tree)`);
} catch {
    console.log('omsi-loops submodule state: (unavailable)');
}

// Headless Chromium deep-freezes idle renderers (page timers AND
// workers) between CDP calls, which would starve the bridge's clock —
// in real use the renderer is active and unaffected. Standard flags.
const browser = await chromium.launch({
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
    ],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

function fail(msg) {
    throw new Error(msg);
}

async function state() {
    return page.evaluate(async () => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        let gs = null;
        try { gs = getGameStateSingleton(); } catch { return null; }
        if (!gs) return null;
        const iframe = document.querySelector('iframe.omsisw-iframe');
        const bridge = iframe?.contentWindow?.__omsiBridge ?? null;
        let engine = null;
        try {
            engine = iframe?.contentWindow?.eval?.(
                '({ timer, timeNeeded, loops: totals.loops, nextLen: actions.next.length })');
        } catch { /* engine not booted yet */ }
        return {
            engine,
            currentRegion: gs.getCurrentRegion(),
            currentMana: gs.getCurrentMana(),
            maxMana: gs.getMaxMana(),
            loopResetCount: gs.getLoopResetCount(),
            loopModeActive: !!gs.isLoopModeActive,
            omsiBonus: gs._substrateBonuses?.get?.('omsi') ?? null,
            clockRunning: bridge?.isClockRunning?.() ?? null,
            manaLeft: bridge?.getDebugState?.()?.manaLeft ?? null,
            clockStats: bridge?.getDebugState?.()?.clockStats ?? null,
            mayStep: bridge?.getDebugState?.()?.mayStep ?? null,
            stepGate: bridge?.getDebugState?.()?.stepGate ?? null,
            // ⛓ THE PARK'S OWN INTERNALS, FIELD BY FIELD. `livePlayRegion()`
            // has six ways to answer null (loopState.js:2283) and the step
            // gate only ever sees the answer — so a park that "happened" but
            // did not open the gate was, once, an unattributable 30 s
            // timeout. Every guard it consults is dumped here.
            loops: (() => {
                const ls = window.__loopStateForVerify;
                if (!ls) return null;
                let livePlay = null;
                try { livePlay = ls.livePlayRegion?.() ?? null; } catch { livePlay = 'THREW'; }
                let block = null;
                try {
                    const b = ls._blockForCurrentAction?.();
                    block = b ? { region: b.region, instance: b.instance,
                        mode: ls.getBlockMode(b.region, b.instance) } : null;
                } catch { block = 'THREW'; }
                return {
                    manualEntered: ls._manualActionEntered ?? null,
                    manualRegion: ls._manualRegionName ?? null,
                    pausedUntilReset: ls._queuePausedUntilReset ?? null,
                    isPaused: ls.isPaused ?? null,
                    delegated: !!ls._delegatedAction,
                    botExecuted: !!ls._botExecutedAction,
                    isProcessing: ls.isProcessing ?? null,
                    currentActionIndex: ls.currentActionIndex ?? null,
                    block,
                    livePlay,
                };
            })(),
            manualEntered: window.__loopStateForVerify?._manualActionEntered ?? null,
            timeline: window.__timeline ?? [],
            manaEvents: window.__manaEvents ?? [],
        };
    });
}

async function waitFor(desc, fn, ms = TIMEOUT_MS) {
    const start = Date.now();
    let lastNote = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > ms) {
            const s = await state();
            console.log('  loops timeline:\n    ' + (s?.timeline ?? []).join('\n    '));
            console.log('  state at timeout:', JSON.stringify(s));
            console.log('  PAGE LOGS (last 25):\n    ' + logs.slice(-25).join('\n    '));
            fail(`timeout waiting for: ${desc}`);
        }
        if (Date.now() - lastNote > 15000) {
            lastNote = Date.now();
            const s = await state();
            console.log(`  …${desc} | region ${s?.currentRegion} | mana ${s?.currentMana?.toFixed?.(1)}/${s?.maxMana} | resets ${s?.loopResetCount} | clock ${s?.clockRunning} | engine ${JSON.stringify(s?.engine)} | clockStats ${JSON.stringify(s?.clockStats)}`);
        }
        await page.waitForTimeout(500);
    }
}

/**
 * Wait for the step gate to open, and REFUSE EARLY on the one state it can
 * never open from. `_queuePausedUntilReset` is loops' hard pause: nothing this
 * script does can clear it (see the settle note above), so polling out the
 * full 30 s only turns a named condition into a bare timeout.
 */
async function waitForGate(desc, ms = 30000) {
    return waitFor(desc, async () => {
        const s = await state();
        if (s?.loops?.pausedUntilReset === true) {
            console.log('  loops timeline:\n    ' + (s.timeline ?? []).join('\n    '));
            fail(`${desc}: loops HARD-PAUSED the park (_queuePausedUntilReset) — `
                + `${JSON.stringify(s.loops)}. Nothing here can clear that flag; the park `
                + 'raced a region event. See settleRegionEvents().');
        }
        return (s?.mayStep === true && s?.stepGate?.livePlayRegion === OMSI_REGION) ? s : null;
    }, ms);
}

async function moveTo(target, source) {
    await page.evaluate(([t, s]) => {
        window.eventDispatcher?.publish('verify', 'user:regionMove', {
            sourceRegion: s, targetRegion: t, exitName: null,
        }, { initialTarget: 'bottom' });
    }, [target, source]);
}

/**
 * ⛓⛓ THE PARK IS THE WHOLE POINT OF THIS FUNCTION, AND IT IS THE APP'S
 * DESIGN, NOT A WORKAROUND (⚖ user, 2026-09-05). The bridge steps the fork
 * only when `_mayStepClock()` (`omsiSubstrateWrapper/bridge.js:531`) says so,
 * and outside a replay or a bot park that means
 * `_stepGateLiveRegion === _currentRegionId` — which the host pushes from
 * loops' `livePlayRegion()` (`loopState.js:2283`), non-null only while the
 * queue is PARKED on a manual/record/bot block. `f2e392df1` (2026-07-24,
 * "omsi arc D slice 2: park-gated stepping") froze unparked live play BY
 * DESIGN, one week after this script was written (`7f8862ec2`, 2026-07-17).
 *
 * Without the park the run does not fail loudly — it fails SILENTLY and
 * slowly: measured at V2, `clockStats: {messages: 304, callbacks: 304,
 * ticksStepped: 0, skippedGated: 304}`, i.e. every tick refused, and the leg
 * died 30 s later on "per-batch draining", which reads like the mana mirror
 * being broken.
 *
 * This mirrors `omsiSubstrateWrapper/test-helpers.js`'s `parkManualBlocks` —
 * what the green in-app rows `omsi-out-of-mana-loop-reset` and
 * `omsi-loop-exhaustion-single-reset` use — step for step: clear the path
 * (loops' own clearQueue would teleport the player out), queue the region's
 * one graph exit as the block's departure, set the block Manual, hurry the
 * arrival move, start processing. It cannot import that module (browser-side
 * only), so it re-declares the exit constants above and fails by name.
 *
 * ⛔ It does NOT unpark. Legs 3–5 (reset, re-entry, victory) all need the
 * gate open; `unparkManualBlocks` also switches loop mode off, which would
 * take the leg's whole subject with it.
 */
/**
 * ⛓⛓ WAIT FOR THE REGION-CHANGE STREAM TO GO QUIET BEFORE PARKING — THE PARK
 * RACES THE ENTRY THAT PRECEDES IT.
 *
 * A `user:regionMove` published on the dispatcher chain lands as MORE THAN ONE
 * `gameState:regionChanged`, and the last of them can arrive after the block
 * has parked. Loops then reads that self-move (target `region_1_1`) against
 * the parked block's expected next region (`region_1_0`), calls it
 * `manualWrongRegion`, discards the recording and sets
 * `_queuePausedUntilReset` (`loopState.js:3022`) — after which
 * `livePlayRegion()` answers null forever, because `startProcessing()` does
 * NOT clear that flag (only `_releaseParkForReset` / `_resetLoop` /
 * `resetForNewRules` do). Measured, three consecutive runs, identical:
 *     +69ms  regionChanged region_0_0 -> region_1_1
 *     +80ms  regionChanged null       -> region_1_1
 *     +380ms manualEntered {regionName: region_1_1, expectedNextRegion: region_1_0}
 *     +527ms queuePausedUntilReset {actual: region_1_1, expected: region_1_0,
 *                                   reason: 'manualWrongRegion'}
 * With a settle in front of the park the same probe parks clean every time.
 *
 * ⛔ NOT a fixed sleep. The quiet period is what is actually being waited for,
 * and a sleep that happens to be long enough today is a flake tomorrow.
 */
async function settleRegionEvents(quietMs = 1500, maxMs = 15000) {
    const start = Date.now();
    let last = -1;
    let lastChange = Date.now();
    for (;;) {
        const n = (await state())?.timeline?.length ?? 0;
        if (n !== last) { last = n; lastChange = Date.now(); }
        if (Date.now() - lastChange >= quietMs) return n;
        if (Date.now() - start > maxMs) {
            console.log(`  ⚠ region events never went quiet in ${maxMs} ms (${n} so far)`);
            return n;
        }
        await page.waitForTimeout(250);
    }
}

async function parkOmsiBlock() {
    return page.evaluate(async ([region, exitName, exitTarget]) => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        const gs = getGameStateSingleton();
        if (gs?.isLoopModeActive !== true) return { ok: false, why: 'loop mode is not active' };
        const loopState = (await import('./modules/loops/loopStateSingleton.js')).default;
        const { resolveQueueBlocks } = await import('./modules/loops/blockIdentity.js');
        window.__loopStateForVerify = loopState;   // so state() can read the park flag
        gs.clearPath?.();
        gs.updatePath(exitTarget, exitName, region);
        const { visits } = resolveQueueBlocks(loopState.getActionQueue());
        const visit = visits.find((v) => v.name === region);
        if (!visit) {
            return { ok: false, why: `no queue block resolved for ${region} — queued `
                + `${region} -[${exitName}]-> ${exitTarget}; visits: `
                + JSON.stringify(visits.map((v) => v.name)) };
        }
        loopState.setBlockMode(region, visit.instance, 'manual');
        loopState.setBlockInstant(region, visit.instance, false);
        loopState.setGameSpeed(10000);   // hurry any arrival move to the park
        loopState.startProcessing();
        return { ok: true, instance: visit.instance,
            mode: loopState.getBlockMode(region, visit.instance) };
    }, [OMSI_REGION, OMSI_EXIT, OMSI_EXIT_TARGET]);
}

/**
 * ⛓⛓ PRESS PLAY — THE PLAYER'S OWN COLD START (⚖ user, 2026-09-06).
 *
 * WHAT CHANGED AND WHY (L5). This function used to call
 * `IdleLoopsManaged.restartLoop()` — a HOST restart, which released the
 * boundary the fork boots holding but left the game's own `gameIsStopped`
 * set. That worked because the host clock ignored the flag. It no longer
 * does: live play is now gated on it (`clockGate.js`'s header, the STOPPED
 * gate), and with `restartLoop()` this leg reads
 * `ticksStepped: 0, skippedGated: 0, skippedStopped: 137` — measured, this
 * script, right after the rule landed. The instrument was driving a game
 * nobody had started.
 *
 * The ruling: *"I want the restart to be triggered by the player pressing the
 * in-game start button, not the addition of the first action of the queue."*
 * So this presses PLAY, and Play alone does both jobs: `pauseGame()`
 * (`driver.js:272`) clears the flag, and because it unpauses AT a loop end it
 * calls `restart()` in the same call.
 *
 * ⚠ `pauseGame()` IS A TOGGLE — never call it without reading the flag first,
 * or a leg that runs twice presses Pause the second time.
 *
 * Measured on this fixture at boot, before anything is driven:
 *     {shouldRestart: true, timer: 250, timeNeeded: 350, gameIsStopped: true}
 * The fork boots STOPPED and PARKED PAST A LOOP END with an empty compiled
 * list. Both halves have to clear for a step to happen, and the one press
 * clears both.
 *
 * ⛑ THE BOUNDARY HALF IS STILL WHY THIS RUNS AFTER THE PLAN IS WRITTEN — a
 * recompile before the plan exists compiles nothing. `_forceLoopRecompile()`
 * (`bridge.js`) does the same job on the replay install, the bot exit install,
 * the bot cold start and the host's reset catch-up; those windows are EXEMPT
 * from the stopped rule and keep the bridge's timing. Live play has no such
 * path by design: the player is the path.
 *
 * It costs no loop reset: `_handleGameRestart`'s no-progress guard drops a
 * restart whose loop consumed under `NO_PROGRESS_LOOP_S` of effective time,
 * and at boot `totals.effectiveTime` is 0 — measured, `loopResetCount` stayed
 * 0 across the press, then advanced to 1 only at the genuine exhaustion. The
 * bridge logs that drop at DEBUG, so it is attributable.
 *
 * The BOUNDARY half stays CONDITIONAL (with no boundary held there is nothing
 * to release, and the run says so), but the PLAY press is UNCONDITIONAL: a
 * game left stopped is the state this leg exists to leave.
 */
async function coldStartIfBoundaryHeld() {
    const READ = '({ shouldRestart: (typeof shouldRestart !== "undefined" ? shouldRestart : null),'
        + ' timer, timeNeeded, currentLen: (actions.current || []).length,'
        + ' nextLen: actions.next.length, effTime: totals.effectiveTime,'
        + ' stopped: gameIsStopped })';
    const before = await omsiEval(READ);
    // Mirrors clockGate.js `isBoundaryHeld` — both halves, same order.
    const held = before?.shouldRestart === true
        || (Number.isFinite(before?.timer) && Number.isFinite(before?.timeNeeded)
            && before.timer >= before.timeNeeded);
    // The player's press, flag-read first (pauseGame is a TOGGLE).
    await omsiEval('if (gameIsStopped) pauseGame()');
    const after = await omsiEval(READ);
    if (after?.stopped !== false) {
        fail(`Play did not start the game: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    }
    return { held, before, after };
}

function omsiEval(code) {
    return page.evaluate((c) => {
        const win = document.querySelector('iframe.omsisw-iframe')?.contentWindow;
        if (!win) throw new Error('omsi iframe not mounted');
        return win.eval(c);
    }, code);
}

async function main() {
    console.log('━━ omsi mana-leg verify:', URL);
    await page.goto(URL);
    await page.waitForTimeout(9000);

    // (1) loop_costs loaded → loop mode auto-enables (lands seconds
    // after boot); the omsi iframe boots managed + bridge connects.
    await waitFor('loop mode auto-enabled', async () => (await state())?.loopModeActive, 30000);
    console.log('  ✓ loop mode auto-enabled (loop_costs loaded)');

    await page.evaluate(async () => {
        const { default: eventBus } = await import('./app/core/eventBus.js');
        window.__manaEvents = [];
        eventBus.subscribe('gameState:manaChanged', (d) => {
            window.__manaEvents.push(d?.current);
        }, 'check-omsi-mana');
        /**
         * ⛓ THE PARK'S FAILURE MODE, NAMED AT THE MOMENT IT HAPPENS. A park
         * that loops hard-pauses (`_queuePausedUntilReset`, reason
         * `manualWrongRegion`) is indistinguishable, 30 s later, from a park
         * that never took: both read `livePlay: null`. `startProcessing()`
         * does NOT clear that flag (only `_releaseParkForReset`,
         * `_resetLoop`, `resetForNewRules` do — `loopState.js:3728/3789/3743`),
         * so a re-park cannot rescue it either. The event carries the region
         * pair that tripped it, which is the only thing that says WHY.
         */
        window.__timeline = [];
        const t0 = Date.now();
        const mark = (what, d) => window.__timeline.push(
            `+${Date.now() - t0}ms ${what} ${JSON.stringify(d ?? null)}`);
        eventBus.subscribe('gameState:regionChanged', (d) =>
            mark('regionChanged', { from: d?.oldRegion, to: d?.newRegion, fromReset: !!d?.fromReset }),
        'check-omsi-mana');
        eventBus.subscribe('loopState:queuePausedUntilReset', (d) =>
            mark('queuePausedUntilReset', d), 'check-omsi-mana');
        eventBus.subscribe('loopState:manualEntered', (d) =>
            mark('manualEntered', d), 'check-omsi-mana');
        eventBus.subscribe('loopState:manualResumed', (d) =>
            mark('manualResumed', d), 'check-omsi-mana');
    });

    const before = await state();
    const maxBefore = before.maxMana;
    console.log(`  pool before entry: ${before.currentMana}/${maxBefore}, region ${before.currentRegion}`);

    await moveTo(OMSI_REGION, before.currentRegion);
    await waitFor('bridge clock running after omsi region entry', async () =>
        (await state())?.clockRunning === true, 30000);
    console.log('  ✓ omsi region entered; bridge clock running');

    // Native budget bonus reported → per-substrate accumulator + maxMana.
    await waitFor(`omsi budget bonus ${NATIVE_BUDGET} lands in the accumulator`, async () => {
        const s = await state();
        return s?.omsiBonus === NATIVE_BUDGET && s?.maxMana >= maxBefore + NATIVE_BUDGET;
    }, 15000);
    console.log(`  ✓ native budget bonus ${NATIVE_BUDGET} raised maxMana (${maxBefore} → ${(await state()).maxMana})`);

    // Budget pinned to pool.
    const pinned = await waitFor('budget pinned to pool', async () => {
        const s = await state();
        return (s?.manaLeft != null && Math.abs(s.manaLeft - s.currentMana) < 0.5) ? s : null;
    }, 15000);
    console.log(`  ✓ game budget pinned to pool (${pinned.manaLeft} ≈ ${pinned.currentMana})`);

    // (1b) PARK a loops queue on a Manual block in the omsi region.
    await settleRegionEvents();
    const park = await parkOmsiBlock();
    if (!park?.ok) fail(`could not park a Manual block in ${OMSI_REGION}: ${park?.why}`);
    await waitFor(`the loops queue parks on the Manual block in ${OMSI_REGION}`,
        async () => (await state())?.manualEntered === true, 30000);
    const gated = await waitForGate(`the bridge's step gate OPENS with livePlay=${OMSI_REGION}`);
    console.log(`  park state: ${JSON.stringify(gated.loops)}`);
    /**
     * ⛓ ASSERTED ON THE BRIDGE'S OWN LOG LINE, not only on its debug state.
     * `_setStepGate` (`omsiSubstrateWrapper/bridge.js:1944`) logs the gate on
     * every CHANGE, and that line is the one V2 read the failure off:
     *   `step gate: CLOSED (enforced=true, livePlay=none, bot=none, here=none)`
     * Reading it back OPEN with this region named is what proves the park
     * reached the bridge, rather than that a getter agreed with itself.
     */
    const gateLine = logs.slice().reverse().find((l) =>
        l.includes('step gate: OPEN') && l.includes(`livePlay=${OMSI_REGION}`));
    if (!gateLine) {
        const closed = logs.filter((l) => l.includes('step gate:')).slice(-4);
        fail(`the bridge never logged an OPEN step gate for livePlay=${OMSI_REGION}`
            + (closed.length ? `; last step-gate lines:\n    ${closed.join('\n    ')}` : ''));
    }
    console.log(`  ✓ parked Manual block (instance ${park.instance}, mode ${park.mode});`
        + ` step gate OPEN — ${gateLine.replace(/^\[\w+\]\s*/, '')} [${elapsed()}]`);
    const stepsBefore = gated.clockStats?.ticksStepped ?? 0;

    /**
     * ⛓⛓ VICTORY RUNS **BEFORE** THE EXHAUSTION LEG, AND THAT ORDER IS LOAD-BEARING
     * (V3a). The bridge's victory watch is ungated — `_checkVictoryProgress()`
     * is called from `_clockTick` OUTSIDE the step gate (`bridge.js:718`) — but
     * the `user:locationCheck` it publishes carries no `fromLoop` during live
     * play, so loops' M3b strict action gate refuses it unless a parked block
     * exempts it. The exhaustion leg below DESTROYS that park and it cannot be
     * rebuilt: `fireLoopResetTeleport` moves the player out of the omsi region
     * while the queue is parked on a Manual block there, loops reads that as
     * `manualWrongRegion` (`loopState.js:3022`), and the resulting
     * `_queuePausedUntilReset` is cleared only by `_releaseParkForReset` /
     * `_resetLoop` / `resetForNewRules` — never by `startProcessing()`. Measured
     * three runs out of three: re-parking after the reset leaves
     * `{manualEntered: true, pausedUntilReset: true, livePlay: null}` and the
     * step gate shut. So the claim that needs the park is made while the park
     * is alive.
     */
    // (2) Victory: unlockTown(1) ⇔ Start Journey completed at least
    // once (townsUnlocked is persistent). The bridge reports the
    // victory location; the placed 'Victory' item arrives.
    const victoryState = await page.evaluate(async () => {
        const { default: proxy } =
            await import('./modules/stateManager/stateManagerProxySingleton.js');
        return {
            checked: proxy.getSnapshot?.()?.checkedLocations ?? [],
            victory: proxy.getSnapshot?.()?.inventory?.Victory ?? 0,
        };
    });
    if (victoryState.checked.includes(`${OMSI_REGION}__start_journey`)) {
        fail('victory location checked before Start Journey completed');
    }
    await omsiEval('unlockTown(1)');
    console.log('  unlockTown(1) called (Start Journey completion)…');
    await waitFor('victory location checked + Victory item received', async () => {
        return page.evaluate(async ([region]) => {
            const { default: proxy } =
                await import('./modules/stateManager/stateManagerProxySingleton.js');
            const snap = proxy.getSnapshot?.() ?? {};
            const checked = snap.checkedLocations ?? [];
            const has = Array.isArray(checked)
                ? checked.includes(`${region}__start_journey`)
                : !!checked[`${region}__start_journey`];
            return has && Number(snap.inventory?.Victory ?? 0) > 0;
        }, [OMSI_REGION]);
    }, 15000);
    console.log(`  ✓ victory: Start Journey checked the location; Victory item in inventory [${elapsed()}]`);


    // (3) A real queued run under the host-driven clock.
    await omsiEval('actions.addAction("Wander", 9999)');
    console.log('  Wander x9999 queued; expecting small-step drains…');

    // (3a) …but first the fork's loop has to be past the boundary it boots
    // holding. AFTER the plan is written, exactly as `_forceLoopRecompile`
    // is — a recompile before the plan exists compiles nothing.
    const cold = await coldStartIfBoundaryHeld();
    if (!cold.held) {
        console.log(`  · no boundary held at start (${JSON.stringify(cold.before)}) — `
            + 'Play pressed anyway (the game boots stopped)');
    } else {
        if (cold.after?.shouldRestart !== false || !(cold.after?.currentLen > 0)) {
            fail('Play did not clear the held boundary: '
                + `${JSON.stringify(cold.before)} -> ${JSON.stringify(cold.after)}`);
        }
        console.log(`  ✓ Play pressed: game started and boundary released `
            + `${JSON.stringify(cold.before)} -> ${JSON.stringify(cold.after)} [${elapsed()}]`);
    }

    // Read AFTER the cold start, not before it: the guard above says the
    // restart is not reported, and this is what makes leg 3's "exactly one"
    // count an actual measurement rather than a bet on that guard.
    const atRunStart = await state();
    const resetsBefore = atRunStart.loopResetCount;
    const poolAtRunStart = atRunStart.currentMana;
    console.log(`  run starts: pool ${poolAtRunStart}/${atRunStart.maxMana}, resets ${resetsBefore}`);

    const midRun = await waitFor('per-batch draining (≥5 small decrements tracking the budget)', async () => {
        const s = await state();
        if (!s) return null;
        const drops = [];
        for (let i = 1; i < s.manaEvents.length; i++) {
            const d = s.manaEvents[i - 1] - s.manaEvents[i];
            if (d > 0) drops.push(d);
        }
        // Elapsed-time batches ⇒ decrements of ~5 mana at full cadence,
        // up to a few dozen under browser timer throttling; anything
        // ≤ 25 counts as a "small" mirrored step (vs one bulk charge).
        const smallDrops = drops.filter((d) => d <= 25);
        if (smallDrops.length < 5) return null;
        if (s.manaLeft == null || Math.abs(s.manaLeft - s.currentMana) > 30) return null;
        return { s, smallDrops };
    }, 30000);
    // The step counters are the direct witness that the park is what changed:
    // V2 measured `ticksStepped: 0, skippedGated: 304` on the unparked run,
    // and every drain below is a tick the gate let through.
    const cs = midRun.s.clockStats ?? {};
    console.log(`  ✓ pool drains in small mirrored steps (${midRun.smallDrops.length} decrements; `
        + `pool tracks budget) — ticksStepped ${stepsBefore} → ${cs.ticksStepped}, `
        + `skippedGated ${cs.skippedGated} [${elapsed()}]`);
    if (!(cs.ticksStepped > stepsBefore)) {
        fail(`the gate opened but the bridge stepped nothing: ${JSON.stringify(cs)}`);
    }

    /**
     * (3b) ⚖ 2026-09-06 — PAUSE STOPS THE HOST CLOCK, PLAY RESUMES IT.
     *
     * The rule's own subject, driven through the game's own button handler
     * (`pauseGame()`, what `onclick='pauseGame()'` on `#pausePlay` calls) —
     * never by writing `gameIsStopped`, which would test nothing the player
     * can do.
     *
     * ⚠ TWO clock callbacks, not one: the callback that observes the flag may
     * already have been scheduled when the press landed, and `CLOCK_INTERVAL_MS`
     * is 100 ms. The wait below spans ≥ 2 of them and then requires the
     * counters FLAT across a further window, so a single in-flight callback
     * cannot read as "the pause worked".
     *
     * The witness is `skippedStopped`, not merely a flat tick count: a flat
     * count is equally consistent with a stalled clock, an empty plan or a
     * closed gate, and this leg would then pass for three wrong reasons.
     */
    const pausedFrom = await state();
    await omsiEval('if (!gameIsStopped) pauseGame()');
    if ((await omsiEval('gameIsStopped')) !== true) fail('Pause did not stop the game');
    await page.waitForTimeout(400);            // ≥ 2 clock callbacks at 100 ms
    const pausedAt = await state();
    await page.waitForTimeout(800);            // …and the counters must stay put
    const pausedTo = await state();
    const csPaused = pausedTo.clockStats ?? {};
    if (csPaused.ticksStepped !== (pausedAt.clockStats?.ticksStepped ?? -1)) {
        fail(`the clock kept stepping while paused: ${pausedAt.clockStats?.ticksStepped} `
            + `-> ${csPaused.ticksStepped}`);
    }
    if (Math.abs(pausedTo.currentMana - pausedAt.currentMana) > 0.5) {
        fail(`the pool kept draining while paused: ${pausedAt.currentMana} -> ${pausedTo.currentMana}`);
    }
    if (!(csPaused.skippedStopped > (pausedFrom.clockStats?.skippedStopped ?? 0))) {
        fail('the clock was flat while paused but skippedStopped never rose — '
            + `the freeze is not attributable to the pause: ${JSON.stringify(csPaused)}`);
    }
    if (pausedTo.loopResetCount !== pausedFrom.loopResetCount) {
        fail(`pausing cost a loop reset: ${pausedFrom.loopResetCount} -> ${pausedTo.loopResetCount}`);
    }
    console.log(`  ✓ Pause froze the host clock: ticksStepped ${pausedAt.clockStats?.ticksStepped}`
        + ` flat over 0.8 s, pool ${pausedAt.currentMana.toFixed(1)} flat, skippedStopped `
        + `${pausedFrom.clockStats?.skippedStopped ?? 0} -> ${csPaused.skippedStopped} [${elapsed()}]`);

    await omsiEval('if (gameIsStopped) pauseGame()');
    if ((await omsiEval('gameIsStopped')) !== false) fail('Play did not restart the game');
    const resumed = await waitFor('the clock steps again after Play', async () => {
        const s2 = await state();
        return (s2?.clockStats?.ticksStepped ?? 0) > csPaused.ticksStepped ? s2 : null;
    }, 15000);
    console.log(`  ✓ Play resumed the host clock: ticksStepped ${csPaused.ticksStepped} -> `
        + `${resumed.clockStats.ticksStepped}, pool ${resumed.currentMana.toFixed(1)} [${elapsed()}]`);

    // (4) Exhaustion: exactly one loop reset, refill, teleport, clock off.
    const exhaustTimeout = (poolAtRunStart / 50) * 1000 + 30000;
    const after = await waitFor('loop reset at exhaustion', async () => {
        const s = await state();
        return s && s.loopResetCount >= resetsBefore + 1 ? s : null;
    }, exhaustTimeout);
    await page.waitForTimeout(2500);
    const settled = await state();
    if (settled.loopResetCount !== resetsBefore + 1) {
        fail(`expected exactly one loop reset, got ${settled.loopResetCount - resetsBefore}`);
    }
    console.log(`  ✓ exactly one loop reset at exhaustion (race guard held) [${elapsed()}]`);
    if (settled.currentMana <= 0) fail(`pool not refilled: ${settled.currentMana}`);

    const resetTarget = await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        return centralRegistry.getPublicFunction?.('procgenPlayer', 'getResolvedStartRegion')?.() ?? null;
    });
    await waitFor(`teleport to reset target ${resetTarget}`, async () =>
        (await state())?.currentRegion === resetTarget, 15000);
    if (resetTarget !== OMSI_REGION) {
        await waitFor('bridge clock stopped after leaving', async () =>
            (await state())?.clockRunning === false, 10000);
        console.log(`  ✓ teleported to ${resetTarget}; bridge clock stopped`);
    } else {
        console.log(`  ✓ reset landed in the omsi region itself; clock stays running`);
    }

    // (5) Re-entry: clock resumes, budget re-pinned to the pool.
    await moveTo(OMSI_REGION, resetTarget);
    await waitFor('clock resumed on re-entry', async () =>
        (await state())?.clockRunning === true, 15000);
    await waitFor('budget re-pinned after re-entry', async () => {
        const s = await state();
        // The Wander queue survives the reset — the game keeps playing
        // and draining after re-entry, so allow a few batches of slack.
        return s?.manaLeft != null && Math.abs(s.manaLeft - s.currentMana) < 15;
    }, 15000);
    const reentered = await state();
    console.log(`  ✓ re-entry: clock resumed, budget re-pinned [${elapsed()}]`);
    /**
     * ⛔ RE-ENTRY DOES **NOT** RE-OPEN THE STEP GATE, AND THIS INSTRUMENT NO
     * LONGER PRETENDS OTHERWISE. `isClockRunning()` is the bridge's INTERVAL,
     * not the gate: the reset's teleport hard-paused the queue (see the ⛓⛓
     * note at the victory leg), so the bridge resumes ticking and refuses every
     * step. Logged, not asserted — it is loops' designed `manualWrongRegion`
     * behaviour, not a property this leg is here to pin.
     */
    console.log(`  · park after the reset: ${JSON.stringify(reentered.loops)}`
        + ` | stepGate ${JSON.stringify(reentered.stepGate)} mayStep=${reentered.mayStep}`);

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) fail('page errors:\n  ' + errors.join('\n  '));

    console.log(`\nVERIFY OMSI MANA LEG: OK (${elapsed()} wall)`);
}

try {
    await main();
    await browser.close();
    process.exit(0);
} catch (e) {
    console.log('\n‼ FAILURE:', e.message);
    console.log('PAGE LOGS (last 40):\n  ' + logs.slice(-40).join('\n  '));
    await browser.close();
    process.exit(1);
}
