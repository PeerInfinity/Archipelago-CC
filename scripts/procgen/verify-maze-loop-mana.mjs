/**
 * In-app verify for the MAZE mana leg under LOOP MODE after its
 * migration onto the shared resourceChannels helpers (cross-game R1
 * slice 3). Two migrated seams are on trial:
 *   - loops' _shouldDelegateCurrentAction now reads the registry's
 *     sharing.mana.loopActionDelegation capability (was a hard-coded
 *     substrate === 'maze' branch);
 *   - the maze walker's per-tile charging + OOM reset now run through
 *     chargeMana / fireLoopResetTeleport.
 *
 * Fixture: maze_loop_worldgen (frontend-only preset, NOT committed —
 * regenerate with:
 *   node scripts/procgen/dump-sphere-growth.js --seed 1 --region 8x6 \
 *     --items key_red=1 --items key_blue=1 --items victory=1 \
 *     --spheres 3 --victory victory --start maze --quota maze=99 \
 *     --enable-loop-mode \
 *     --rules-out frontend/presets/maze_loop_worldgen/AP_1/AP_1_rules.json \
 *     -o /tmp/maze-loop-dump.json
 * ). A linear
 * 3-maze-region chain (region_2_2 -> region_2_3 -> region_3_3), one
 * location each, loop_costs embedded (region costs 50/55/60).
 *
 * What it asserts:
 *   1. loop_costs loaded → loop mode auto-enabled.
 *   2. A loops queue over the chain, once started, DELEGATES maze
 *      actions to the substrate walker: mana drains in MANY SMALL
 *      per-tile decrements (the generic queue path charges once per
 *      action — coarse), and region XP accrues 1:1 alongside.
 *   3. Total chain cost exceeds max mana → the walker's OOM reset
 *      fires mid-run: loopResetCount increments, mana refills to max,
 *      the player teleports to the resolved start region, and loops
 *      receives completed:false (queue processing stops).
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-maze-loop-mana.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:8000/frontend/?rules=presets/maze_loop_worldgen/AP_1/AP_1_rules.json';
const TIMEOUT_MS = 180000;

const browser = await chromium.launch();
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
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        let gs = null;
        try { gs = getGameStateSingleton(); } catch { return null; }
        if (!gs) return null;
        const loopState = centralRegistry.getPublicFunction('loops', 'getLoopState')?.();
        const xp = {};
        for (const [k, v] of gs.regionXP.entries()) xp[k] = { level: v.level, xp: v.xp };
        return {
            currentRegion: gs.getCurrentRegion(),
            currentMana: gs.getCurrentMana(),
            maxMana: gs.getMaxMana(),
            loopResetCount: gs.getLoopResetCount(),
            loopModeActive: !!gs.isLoopModeActive,
            xp,
            isProcessing: loopState?.isProcessing ?? null,
            manaEvents: window.__manaEvents ?? [],
            substrateCompleted: window.__substrateCompleted ?? [],
        };
    });
}

async function waitFor(desc, fn, ms = TIMEOUT_MS) {
    const start = Date.now();
    let lastNote = 0;
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
            console.log(`  …${desc} | region ${s?.currentRegion} | mana ${s?.currentMana?.toFixed?.(1)}/${s?.maxMana} | resets ${s?.loopResetCount}`);
        }
        await page.waitForTimeout(500);
    }
}

async function main() {
    console.log('━━ maze loop-mode mana verify:', URL);
    await page.goto(URL);
    await page.waitForTimeout(9000);

    // (1) loop_costs loaded → the auto-enable signal; wait for the flag.
    await waitFor('loop mode auto-enabled', async () => (await state())?.loopModeActive, 30000);
    console.log('  ✓ loop mode auto-enabled (loop_costs loaded)');

    // Instrument: record every manaChanged value + substrate completion
    // signals, so per-tile charging and the reset's completed:false are
    // observable.
    await page.evaluate(async () => {
        const { default: eventBus } = await import('./app/core/eventBus.js');
        window.__manaEvents = [];
        window.__substrateCompleted = [];
        eventBus.subscribe('gameState:manaChanged', (d) => {
            window.__manaEvents.push(d?.current);
        }, 'verify-maze-loop');
        eventBus.subscribe('loops:substrateActionCompleted', (d) => {
            window.__substrateCompleted.push(!!d?.completed);
        }, 'verify-maze-loop');
    });

    // (2) Build the loops queue over the chain (same construction the
    // bounce loop verify uses: leading Menu hop, then per region check
    // its location and move on).
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
        const menu = getRegion('Menu');
        const menuExit = (menu?.exits ?? []).find((e) => e.connected_region === startRegion);

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
        return { startRegion, chain, built };
    });
    console.log('  start region:', plan.startRegion);
    console.log('  chain:', plan.chain.join(' -> '));
    if (plan.chain.length < 3) fail(`expected a 3-region chain, got ${plan.chain.length}`);

    const before = await state();
    console.log(`  mana before start: ${before.currentMana}/${before.maxMana}`);

    await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        centralRegistry.getPublicFunction('loops', 'getLoopState')?.().startProcessing();
    });
    console.log('  loops queue started');

    // (3) Delegated per-tile charging: mana decreases across MANY small
    // decrements and region XP accrues on the maze start region.
    const midRun = await waitFor('per-tile charging (≥3 small decrements + XP accrual)', async () => {
        const s = await state();
        if (!s) return null;
        const drops = [];
        for (let i = 1; i < s.manaEvents.length; i++) {
            const d = s.manaEvents[i - 1] - s.manaEvents[i];
            if (d > 0) drops.push(d);
        }
        const perTileCap = 30; // region costs are 50/55/60; per-tile is cost/path << 30
        const smallDrops = drops.filter((d) => d <= perTileCap);
        const xpTotal = Object.values(s.xp).reduce((a, v) => a + v.xp + v.level * 100, 0);
        return (smallDrops.length >= 3 && xpTotal > 0) ? { s, smallDrops } : null;
    });
    console.log(`  ✓ delegated walker charging per tile (${midRun.smallDrops.length} small decrements observed)`);
    console.log('  ✓ region XP accruing:', JSON.stringify(midRun.s.xp));

    // (4) The chain's total cost far exceeds max mana → the walker's
    // OOM reset fires: count +1, refill, teleport to the resolved
    // start, completed:false delivered to loops (processing stops).
    const after = await waitFor('OOM loop reset', async () => {
        const s = await state();
        return s && s.loopResetCount >= 1 ? s : null;
    });
    if (after.currentMana !== after.maxMana) {
        // The refill can race one last tile charge; allow one per-tile bite.
        const gap = after.maxMana - after.currentMana;
        if (gap > 30) fail(`reset did not refill mana: ${after.currentMana}/${after.maxMana}`);
    }
    await waitFor('teleport back to start region', async () => {
        const s = await state();
        return s.currentRegion === plan.startRegion;
    }, 30000);
    if (!after.substrateCompleted.includes(false)) {
        fail('loops never received completed:false from the interrupted walk');
    }
    await waitFor('queue processing stopped after reset', async () => {
        const s = await state();
        return s.isProcessing === false;
    }, 30000);
    console.log(`  ✓ OOM reset: count ${after.loopResetCount}, refilled, teleported to ${plan.startRegion}, completed:false delivered, queue stopped`);

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) fail('page errors:\n  ' + errors.join('\n  '));

    console.log('\nVERIFY MAZE LOOP MANA: OK');
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
