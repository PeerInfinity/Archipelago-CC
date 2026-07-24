/**
 * In-app verify for BOUNCE under LOOP MODE — the loops-mode rework's
 * Phase 4 (bot-backed queue execution). Distinct from
 * verify-bot-playthrough.mjs, which drives the standalone Playback Bot
 * panel: here the LOOPS QUEUE itself drives the bot. The loops engine
 * parks on each bounce-region action, dispatches walkTo through the
 * PlaybackProxy, and completes the action on the resulting
 * locationCheck / regionChanged event, charging the loop_costs value.
 *
 * Fixture: bounce_loop_worldgen (frontend-only preset emitted by
 * `dump-sphere-growth.js --enable-loop-mode`). A linear bounce-only
 * sphere chain:
 *   region_2_2 (start, holds Right arrow)
 *     --Right arrow--> region_2_1 (holds Left arrow)
 *       --Left arrow--> region_1_1 (holds Victory)
 * loop_costs is embedded, so the loops module auto-enters loop mode on
 * load.
 *
 * What it asserts:
 *   1. loop_costs loaded → cost data manager reports loaded (the same
 *      signal that auto-enables loop mode).
 *   2. A loops queue built over the chain, driven by Start, drains the
 *      bot through every region on real physics: all 3 locations end
 *      up checked and Victory lands in the inventory. Because the
 *      total cost exceeds max mana, this spans several loop iterations
 *      (auto-restart on) — exercising durable checks across loops +
 *      OOM reset + refill + arrow-gated progression.
 *   3. Mana is actually consumed by the bot completions (it dips below
 *      max during the run).
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-bounce-loop-mode.mjs
 *
 * ⚠ DEFERRED TO M6 — RED, and red for two independent reasons (verified
 * 2026-07-23 at parent commit 12c4ce900, BEFORE the loops M5 arc, so
 * neither is a regression from it):
 *
 *   1. The `bounce_loop_worldgen` fixture preset is not in the repo. The
 *      app falls back to the adventure preset and the run dies at the
 *      first assertion ("cost data manager not loaded"), so nothing
 *      below it — including the walkTo assertion — is even reached.
 *      Regenerating it needs `dump-sphere-growth.js --enable-loop-mode`.
 *   2. What it asserts is no longer the contract. It expects the loops
 *      queue to drive bounce through the playback bot's `walkTo`. Since
 *      M4 flipped `defaultBlockMode` to Record its blocks park instead,
 *      and since M5 bounce is a SUMMARY substrate whose Playback applies
 *      a recorded envelope — the walkTo/bot path is deliberately
 *      unreachable from Playback until M6's Bot radio re-homes it.
 *
 * Restructuring it means regenerating the fixture AND rewriting it to the
 * summary contract (Record park → live play → summary persisted → instant
 * Playback re-crosses), at which point it largely duplicates the in-app
 * `runner-summary-record-playback` leg. M6 should either rebuild it around
 * the Bot radio — the contract it was actually written for — or delete it.
 * Not in CI.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:8000/frontend/?game=bounce_loop_worldgen&seed=1';
const TIMEOUT_MS = 300000;

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

class VerifyFailure extends Error {}
function fail(msg) {
    throw new VerifyFailure(msg);
}

async function snapshot() {
    return page.evaluate(async () => {
        const { default: proxy } =
            await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const s = proxy.uiCache ?? {};
        const checked = s.checkedLocations instanceof Set
            ? [...s.checkedLocations]
            : (s.checkedLocations ?? []);
        return { inventory: s.inventory ?? {}, checked };
    });
}

async function manaState() {
    return page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        const gs = centralRegistry.getPublicFunction('gameState', 'getState')?.();
        return gs ? { current: gs.currentMana, max: gs.maxMana } : null;
    });
}

async function waitFor(desc, fn, ms = TIMEOUT_MS) {
    const start = Date.now();
    let lastNote = 0;
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > ms) {
            const s = await snapshot();
            console.log('  checked:', JSON.stringify(s.checked));
            console.log('  inventory:', JSON.stringify(s.inventory));
            console.log('  mana:', JSON.stringify(await manaState()));
            console.log('  PAGE LOGS (last 30):\n    ' + logs.slice(-30).join('\n    '));
            throw new Error(`timeout waiting for: ${desc}`);
        }
        if (Date.now() - lastNote > 15000) {
            lastNote = Date.now();
            const s = await snapshot();
            console.log(`  …${desc} | checked ${s.checked.length}/3 | mana ${JSON.stringify(await manaState())}`);
        }
        await page.waitForTimeout(1000);
    }
}

async function main() {
    console.log('━━ bounce loop-mode verify:', URL);
    await page.goto(URL);
    await page.waitForTimeout(9000);

    // (1) loop_costs loaded → cost data manager reports loaded. This is
    // the exact signal that auto-enables loop mode on rules load.
    const costLoaded = await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        const cdm = centralRegistry.getPublicFunction('loops', 'getCostDataManager')?.();
        return !!cdm?.isLoaded?.();
    });
    if (!costLoaded) return fail('cost data manager not loaded — loop_costs missing or not parsed');
    console.log('  ✓ loop_costs loaded (loop mode auto-enabled)');

    // Instrument the bounce PlaybackController's walkTo so we can prove
    // the LOOPS QUEUE drives the bot. Bounce auto-play is a no-input
    // climb — it never calls walkTo — so any recorded walkTo is
    // queue-driven (Phase 4's _handleBotExecutedAction), which is the
    // behavior unique to this rework.
    await page.evaluate(async () => {
        const { substrateRegistry } =
            await import('./modules/shared/procgen/substrateRegistry.js');
        const entry = substrateRegistry.get('bounce');
        const ctrl = entry?.getPlaybackController?.();
        window.__walkToCalls = [];
        if (ctrl && typeof ctrl.walkTo === 'function' && !ctrl.__wrapped) {
            const orig = ctrl.walkTo.bind(ctrl);
            ctrl.walkTo = (target) => { window.__walkToCalls.push(target); return orig(target); };
            ctrl.__wrapped = true;
        }
    });

    // (2) Build a loops queue over the linear sphere chain and start it.
    // We construct the path via the public gameState API (the same
    // calls the loops panel's path-rebuild uses): a leading Menu->start
    // hop (so addLocationCheck has a regionMove to anchor to), then for
    // each region: check its loc_0, then move to the next region.
    const plan = await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        const { default: proxy } =
            await import('./modules/stateManager/stateManagerProxySingleton.js');
        const getPub = (m, f) => centralRegistry.getPublicFunction(m, f);
        const staticData = proxy.getStaticData?.() ?? {};
        const regionsMap = staticData.regions;
        const getRegion = (name) =>
            (regionsMap?.get ? regionsMap.get(name) : regionsMap?.[name]) ?? null;

        const startRegion = getPub('gameState', 'getCurrentRegion')?.();
        // Find Menu's exit into the start region.
        const menu = getRegion('Menu');
        const menuExit = (menu?.exits ?? []).find((e) => e.connected_region === startRegion);

        // Walk forward exits (skipping back/Menu) to order the chain.
        const chain = [startRegion];
        const seen = new Set([startRegion, 'Menu']);
        let cur = startRegion;
        for (let guard = 0; guard < 16; guard++) {
            const rd = getRegion(cur);
            const fwd = (rd?.exits ?? []).find(
                (e) => e.connected_region && !seen.has(e.connected_region));
            if (!fwd) break;
            chain.push(fwd.connected_region);
            seen.add(fwd.connected_region);
            cur = fwd.connected_region;
        }

        // Build the path.
        const updatePath = getPub('gameState', 'updatePath');
        const addLocationCheck = getPub('gameState', 'addLocationCheck');
        const clearPath = getPub('gameState', 'clearPath');
        clearPath?.();
        if (menuExit) updatePath(startRegion, menuExit.name, 'Menu');
        const built = [];
        for (let i = 0; i < chain.length; i++) {
            const region = chain[i];
            const rd = getRegion(region);
            const loc = (rd?.locations ?? [])[0]?.name;
            if (loc) { addLocationCheck(loc, region); built.push(`check ${loc}`); }
            const nextRegion = chain[i + 1];
            if (nextRegion) {
                const exit = (rd?.exits ?? []).find((e) => e.connected_region === nextRegion);
                if (exit) { updatePath(nextRegion, exit.name, region); built.push(`move ${region}->${nextRegion}`); }
            }
        }

        // Auto-restart so the queue loops past OOM resets until the
        // chain is fully checked (checks persist between loops).
        const loopState = getPub('loops', 'getLoopState')?.();
        loopState?.setAutoRestartQueue?.(true);

        return { startRegion, chain, menuExit: menuExit?.name ?? null, built,
            queueLen: getPub('gameState', 'getPath')?.().length ?? 0 };
    });
    console.log('  start region:', plan.startRegion);
    console.log('  chain:', plan.chain.join(' -> '));
    console.log('  queue:', plan.built.join(' | '), `(${plan.queueLen} entries)`);
    if (plan.chain.length < 3) return fail(`expected a 3-region chain, got ${plan.chain.length}`);

    const manaBefore = await manaState();
    console.log('  mana before start:', JSON.stringify(manaBefore));

    // Press Start (drive the loops queue).
    await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        const loopState = centralRegistry.getPublicFunction('loops', 'getLoopState')?.();
        loopState.startProcessing();
    });
    console.log('  loops queue started');

    // (3) Mana dips below max during the run (bot completions charge it).
    let manaDipped = false;
    const manaWatch = setInterval(async () => {
        const m = await manaState().catch(() => null);
        if (m && m.current < m.max) manaDipped = true;
    }, 1000);

    // Wait for the full chain to be checked + Victory collected.
    await waitFor('all 3 locations checked + Victory collected', async () => {
        const s = await snapshot();
        const hasVictory = Object.entries(s.inventory)
            .some(([k, v]) => /victory/i.test(k) && v > 0);
        return (s.checked.length >= 3 && hasVictory) ? true : null;
    });
    clearInterval(manaWatch);

    const finalSnap = await snapshot();
    console.log('  ✓ FINAL checked:', JSON.stringify(finalSnap.checked));
    console.log('  ✓ FINAL inventory:', JSON.stringify(finalSnap.inventory));

    // The loops queue must have driven the bot at least once (walkTo).
    const walkToCalls = await page.evaluate(() => window.__walkToCalls ?? []);
    console.log('  walkTo calls from the loops queue:', JSON.stringify(walkToCalls));
    if (walkToCalls.length === 0) {
        return fail('the loops queue never dispatched walkTo — bot-backed execution (Phase 4) did not run');
    }
    console.log(`  ✓ loops queue drove the bot via walkTo (${walkToCalls.length} dispatches)`);

    if (!manaDipped) return fail('mana never dipped below max — bot completions did not charge loop_costs');
    console.log('  ✓ mana was consumed by bot completions (loop_costs charged)');

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) return fail('page errors:\n  ' + errors.join('\n  '));

    console.log('\nVERIFY BOUNCE LOOP MODE: OK');
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
