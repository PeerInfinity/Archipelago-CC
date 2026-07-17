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
 *   2. A queued Wander run drains the pool in MANY SMALL decrements
 *      (the 5-tick step batches, ≈1 mana/tick) that track the game's
 *      own budget — the substrate:resourceDelta mirroring.
 *   3. Budget exhaustion (the game's natural restart) collapses with
 *      pool depletion into EXACTLY ONE loop reset: count +1 and stable,
 *      pool refilled, player teleported to the resolved start region,
 *      bridge clock stopped after leaving.
 *   4. Re-entering the omsi region resumes the clock and re-pins the
 *      (reset) budget to the pool.
 *   5. Victory (v0, §6 ruling): completing Start Journey — simulated
 *      via the game's own unlockTown(1), the exact call its finish
 *      handler makes — checks `region_1_1__start_journey` and the
 *      'Victory' item lands in the AP inventory (the preset's
 *      completion condition is item_check on it).
 *
 * The omsi-loops iframe serves the CHECKED-OUT submodule tree, which
 * may be on a different branch than the outer gitlink — the script
 * logs the live branch/commit up front so results are attributable.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-omsi-mana-leg.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const URL = 'http://localhost:8000/frontend/?game=omsi_substrate_test&seed=1';
const OMSI_REGION = 'region_1_1';
const NATIVE_BUDGET = 250;
const TIMEOUT_MS = 120000;

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

async function moveTo(target, source) {
    await page.evaluate(([t, s]) => {
        window.eventDispatcher?.publish('verify', 'user:regionMove', {
            sourceRegion: s, targetRegion: t, exitName: null,
        }, { initialTarget: 'bottom' });
    }, [target, source]);
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
        }, 'verify-omsi-mana');
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

    const resetsBefore = pinned.loopResetCount;
    const poolAtRunStart = pinned.currentMana;

    // (2) A real queued run under the host-driven clock.
    await omsiEval('actions.addAction("Wander", 9999)');
    console.log('  Wander x9999 queued; expecting small-step drains…');

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
    console.log(`  ✓ pool drains in small mirrored steps (${midRun.smallDrops.length} decrements; pool tracks budget)`);

    // (3) Exhaustion: exactly one loop reset, refill, teleport, clock off.
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
    console.log('  ✓ exactly one loop reset at exhaustion (race guard held)');
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

    // (4) Re-entry: clock resumes, budget re-pinned to the pool.
    await moveTo(OMSI_REGION, resetTarget);
    await waitFor('clock resumed on re-entry', async () =>
        (await state())?.clockRunning === true, 15000);
    await waitFor('budget re-pinned after re-entry', async () => {
        const s = await state();
        // The Wander queue survives the reset — the game keeps playing
        // and draining after re-entry, so allow a few batches of slack.
        return s?.manaLeft != null && Math.abs(s.manaLeft - s.currentMana) < 15;
    }, 15000);
    console.log('  ✓ re-entry: clock resumed, budget re-pinned');

    // (5) Victory: unlockTown(1) ⇔ Start Journey completed at least
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
    console.log('  ✓ victory: Start Journey checked the location; Victory item in inventory');

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) fail('page errors:\n  ' + errors.join('\n  '));

    console.log('\nVERIFY OMSI MANA LEG: OK');
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
