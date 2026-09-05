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
 *   2. Every maze block in the queue is set to BOT, and reads back as
 *      Bot — see the ⛓⛓ note at the setter. Without this the run
 *      witnesses nothing at all.
 *   3. A loops queue over the chain, once started, DELEGATES maze
 *      actions to the substrate walker: mana drains in MANY SMALL
 *      per-tile decrements (the generic queue path charges once per
 *      action — coarse), and region XP accrues 1:1 alongside.
 *   4. Total chain cost exceeds max mana → the walker's OOM reset
 *      fires mid-run: loopResetCount increments, mana refills to max,
 *      the player teleports to the resolved start region, and loops
 *      receives completed:false (queue processing stops).
 *   5. The queue walked the WHOLE chain: every region including the
 *      last was entered at some point in the run. The parked (default)
 *      run freezes in the first maze region and never reaches it, so
 *      this is the claim that most directly separates the two.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-maze-loop-mana.mjs
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
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
takeBoxLockOrExit({ name: 'verify-maze-loop-mana.mjs', kind: 'browser' });

const RULES = 'frontend/presets/maze_loop_worldgen/AP_1/AP_1_rules.json';
/**
 * ⛓⛓ THE FIXTURE IS NOT COMMITTED, SO ITS ABSENCE IS A PREREQUISITE FAILURE —
 * AND IT MUST NOT LOOK LIKE A DEFECT. Without this check the page loads no
 * world at all and the run dies 30 s later on `timeout waiting for: loop mode
 * auto-enabled`, which reads exactly like the app failing to auto-enable loop
 * mode. That is how it was recorded in the 2026-09-05 verify-tier survey. The
 * header already carries the regeneration command; this prints it.
 */
if (!existsSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', RULES))) {
    console.log(`‼ PREREQUISITE MISSING: ${RULES}\n`
        + '  This fixture is deliberately NOT committed. Regenerate it with:\n\n'
        + '    node scripts/procgen/dump-sphere-growth.js --seed 1 --region 8x6 \\\n'
        + '      --items key_red=1 --items key_blue=1 --items victory=1 \\\n'
        + '      --spheres 3 --victory victory --start maze --quota maze=99 \\\n'
        + '      --enable-loop-mode \\\n'
        + `      --rules-out ${RULES} \\\n`
        + '      -o /tmp/maze-loop-dump.json\n');
    process.exit(1);
}
/** ⛔ This shadows the global `URL` for the whole module — see the path
 *  resolution above, which must NOT use `new URL()`. */
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
            regionsEntered: window.__regionsEntered ?? [],
            regionLog: window.__regionLog ?? [],
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
        /**
         * ⛓⛓ REGION ENTRIES ARE READ FROM THE EVENT STREAM, NEVER SAMPLED —
         * TWO OF THIS SCRIPT'S CLAIMS ARE ABOUT TRANSIENTS. Measured on the
         * Bot-mode run this instrument now drives, the OOM reset's teleport
         * and the queue's next move land in the SAME millisecond:
         *     +1917ms region_2_3->region_2_2 … resets 1 [fromReset]
         *     +1917ms region_2_2->region_3_3 … resets 1
         * A 500 ms poll on `getCurrentRegion()` therefore never observes the
         * player standing in the reset target, and the old
         * `teleport back to start region` wait timed out on a teleport that
         * had happened perfectly. The same applies to "did the chain get
         * walked": where the player HAPPENS to be at the end says nothing
         * about how far the queue got.
         */
        window.__regionsEntered = [];
        window.__regionLog = [];
        const t0 = Date.now();
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        eventBus.subscribe('gameState:regionChanged', (d) => {
            if (!d?.newRegion) return;
            window.__regionsEntered.push(d.newRegion);
            const g = getGameStateSingleton();
            window.__regionLog.push({
                t: Date.now() - t0,
                from: d.oldRegion ?? null,
                to: d.newRegion,
                mana: g.getCurrentMana(),
                maxMana: g.getMaxMana(),
                resets: g.getLoopResetCount(),
                fromReset: d.fromReset === true,
            });
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

    /**
     * ⛓⛓ EVERY MAZE BLOCK IS SET TO **BOT** — WITHOUT IT THIS RUN WITNESSES
     * NOTHING, AND THAT IS THE APP'S DESIGN, NOT A BUG (⚖ user, 2026-09-05).
     * A queue block with no explicit mode falls through to
     * `loopState.defaultBlockMode`, which is **`record`** since `47c3a7f346`
     * (2026-07-23, loops M4), and `_processFrame` (`loopState.js:1220`) PARKS a
     * manual/record block for live play — `_handleManualRegionEntry` calls
     * `stopProcessing()`. `05979752fb` (2026-07-23, loops M6) then deleted the
     * unconditional delegation dispatch, leaving its tombstone at
     * `loopState.js:1314`: substrate delegation — the exact seam this
     * instrument exists to observe — is reachable ONLY from a `bot` block.
     * This script was written `48458da2bc` (2026-07-17), six days before both.
     *
     * Diagnosed at procgen verify tier V2b; V3a is the repair. Measured on the
     * same fixture and queue, default vs forced Bot: 1 vs **11** manaChanged
     * events; no per-tile drops vs **16.67, 13.75, 13.75, 13.75**; all-zero XP
     * vs `region_2_2` 16.67 / `region_2_3` 41.25 / `region_3_3` 60;
     * `substrateActionCompleted` `[]` vs `[true,true,true,false,true]`;
     * `loopResetCount` 0 vs **1**; frozen in `region_2_2` at index 1 vs the
     * whole chain walked to `region_3_3`.
     *
     * `mazeBlockModeTests.js:212` is the in-app precedent — the green maze
     * block-mode rows are green BECAUSE they set a mode. The read-back below
     * is the row that reds if this is ever left at the default again: it fails
     * HERE, by name, instead of 180 s later as a mana timeout that reads like
     * the walker never charging.
     */
    const modes = await page.evaluate(async ([chain]) => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        const loopState = centralRegistry.getPublicFunction('loops', 'getLoopState')?.();
        if (!loopState) return null;
        // The public "set all" control: it walks the queue's resolved blocks
        // and skips any region whose substrate can't offer the mode, so it
        // cannot silently claim a block it did not set.
        const changed = loopState.setAllBlockModes('bot');
        const readBack = {};
        for (const region of chain) readBack[region] = loopState.getBlockMode(region, 1);
        return { changed, readBack };
    }, [plan.chain]);
    if (!modes) fail('loops getLoopState() unavailable — cannot set block modes');
    const notBot = Object.entries(modes.readBack).filter(([, m]) => m !== 'bot');
    if (notBot.length > 0) {
        fail('maze blocks did not read back as Bot after setAllBlockModes(\'bot\'): '
            + JSON.stringify(modes.readBack)
            + ' — a non-Bot maze block PARKS for live play (loopState.js:1220) and'
            + ' delegation never dispatches (M6 tombstone, loopState.js:1314).');
    }
    if (modes.changed < plan.chain.length) {
        fail(`setAllBlockModes('bot') changed ${modes.changed} block(s), expected at least `
            + `${plan.chain.length} (one per chain region)`);
    }
    console.log(`  ✓ every maze block set to Bot (${modes.changed} changed; read back `
        + `${JSON.stringify(modes.readBack)})`);

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
    const resetTarget = await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        return centralRegistry.getPublicFunction?.('procgenPlayer', 'getResolvedStartRegion')?.() ?? null;
    });
    console.log(`  reset target (procgenPlayer.getResolvedStartRegion): ${resetTarget}`);
    // The teleport is asserted on the EVENT, with its `fromReset` flag — see
    // the ⛓⛓ note at the subscription. Bounded, because the reset's own
    // regionChanged can land a poll after `loopResetCount` does.
    const teleport = await waitFor(`the reset teleported to ${resetTarget} (regionChanged fromReset)`,
        async () => {
            const s = await state();
            return (s?.regionLog ?? []).find((e) => e.fromReset && e.to === resetTarget) ?? null;
        }, 30000);
    const fmt = (e) => `+${e.t}ms ${e.from ?? 'null'}->${e.to} mana ${e.mana.toFixed(2)}/${e.maxMana}`
        + ` resets ${e.resets}${e.fromReset ? ' [fromReset]' : ''}`;
    console.log('  region log:\n    '
        + ((await state()).regionLog ?? []).map(fmt).join('\n    '));
    console.log(`  ✓ reset teleport: ${fmt(teleport)}`);
    // Bounded rather than read off `after`: `loopResetCount` and the
    // interrupted walk's `substrateActionCompleted` are two publishes, and
    // the snapshot that first saw the reset need not carry the second yet.
    const completed = await waitFor('loops received completed:false from the interrupted walk',
        async () => {
            const s = await state();
            return s?.substrateCompleted?.includes(false) ? s.substrateCompleted : null;
        }, 30000);
    console.log(`  ✓ substrateActionCompleted: [${completed.join(', ')}]`);
    await waitFor('queue processing stopped after reset', async () => {
        const s = await state();
        return s.isProcessing === false;
    }, 30000);
    console.log(`  ✓ OOM reset: count ${after.loopResetCount}, refilled, teleported to ${resetTarget}, completed:false delivered, queue stopped`);

    // (5) The whole chain was walked. Read from the CUMULATIVE region-entry
    // log, so this is order-independent: the reset teleports mid-chain and
    // the queue carries on from there (measured: `region_2_3->region_2_2
    // [fromReset]` then `region_2_2->region_3_3`, same millisecond), so where
    // the player HAPPENS to stand at the end says nothing about how far the
    // queue got. The parked (default-mode) run enters exactly one maze region
    // and stops (V2b), so the last chain region is the sharpest single
    // discriminator between the two arms there is.
    const walked = await waitFor(`the queue walked the whole chain (last region ${plan.chain[plan.chain.length - 1]} entered)`,
        async () => {
            const s = await state();
            return s?.regionsEntered?.includes(plan.chain[plan.chain.length - 1]) ? s : null;
        }, 60000);
    const missed = plan.chain.filter((r) => !walked.regionsEntered.includes(r));
    if (missed.length > 0) fail(`chain regions never entered: ${missed.join(', ')}`);
    console.log(`  ✓ chain walked: ${plan.chain.join(' -> ')} (entries: ${walked.regionsEntered.join(', ')})`);

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
