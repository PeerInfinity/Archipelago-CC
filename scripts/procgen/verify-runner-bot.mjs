/**
 * Runner phase-8 gate (plan §4.8, phase table row 8) — the playback
 * bot drives a runner_worldgen region in the REAL frontend, end to end
 * through the phase-8 chain: the registry entry's
 * getPlaybackController (the PlaybackProxy runnerDemo/index.js
 * injects) publishes walkTo on runner:playbackControl → the in-iframe
 * flash bridge translates the AP names to game-local goals → the game
 * page's botDriver synthesizes per-frame inputs through the real
 * engine. No sendLocation/sendExit shortcuts — every check and region
 * move is the game playing itself.
 *
 *   1. ?game=runner_worldgen&seed=1 boots to the start region
 *      (region_1_0 = gen_z0), exactly as verify-runner-smoke proves.
 *   2. walkTo the region's location: the bot jumps the strip's gaps
 *      to seg2 and collects loc_0 — a REAL user:locationCheck.
 *   3. walkTo the E exit: the only route to exit_main's host crosses
 *      branch tip tip0, whose OPEN portal exit_br0 (side S →
 *      region_1_1) sits in the tip's wake — the bot must land shallow
 *      and jump off BEFORE the portal box (blocked-host avoidance,
 *      the gen_z0 mandatory-tip case). A REAL user:regionMove into
 *      region_2_0 — and never into region_1_1 — proves it.
 *
 * Requires the dev server on :8000.
 * Run: node scripts/procgen/verify-runner-bot.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const PRESET = 'frontend/presets/runner_worldgen/AP_14089154938208861744/'
    + 'AP_14089154938208861744_rules.json';
const START_REGION = 'region_1_0';
const CHECK_NAME = `${START_REGION}__loc_0`;
const EXIT_NAME = 'exit_E';          // side E -> exit_main -> region_2_0
const EXPECT_REGION = 'region_2_0';
const AVOID_REGION = 'region_1_1';   // exit_br0's target — must never load

const rules = JSON.parse(readFileSync(PRESET, 'utf8'));
const grantedItem = rules.canonical_placements?.['1']?.[CHECK_NAME];

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

let failures = 0;
const ok = (cond, label) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`);
    if (!cond) failures++;
};

await page.goto('http://localhost:8000/frontend/?game=runner_worldgen&seed=1');

function runnerFrame() {
    const f = page.frames().find((fr) => fr.url().includes('runnerDemo/game/index.html'));
    if (!f) throw new Error('runner iframe not found');
    return f;
}
const status = () => runnerFrame().evaluate(
    () => document.getElementById('status')?.textContent ?? '');
const botDebug = () => runnerFrame().evaluate(
    () => window.__runnerDebug?.()?.botStatus ?? null).catch(() => null);

async function waitFor(desc, fn, timeoutMs = 60000, everyMs = 300) {
    const start = Date.now();
    for (;;) {
        let v = null;
        try { v = await fn(); } catch { /* frame not ready yet */ }
        if (v) return v;
        if (Date.now() - start > timeoutMs) {
            console.log('BOT STATUS:', JSON.stringify(await botDebug()));
            console.log('PAGE LOGS (last 15):', logs.slice(-15).join('\n'));
            throw new Error(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(everyMs);
    }
}

async function snapshot() {
    return page.evaluate(async () => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const s = proxy.uiCache ?? {};
        return { inventory: s.inventory ?? null, checked: s.checkedLocations ?? null };
    });
}

/** walkTo through the injected host-side PlaybackProxy — the exact
 *  surface loops' executeVia: 'playbackBot' drives. */
async function walkTo(target) {
    return page.evaluate(async (t) => {
        const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
        const controller = substrateRegistry.get('runner')?.getPlaybackController?.();
        if (!controller) return false;
        controller.walkTo(t);
        return true;
    }, target);
}

// 1. Boot to the start region (warehouse -> runner:loadRegion ->
//    appReady handshake -> configure), as in the phase-7 smoke.
await waitFor('start region configured into the runner iframe', async () =>
    (await status()).includes(`region: ${START_REGION}`) ? true : null, 90000);
ok(true, `start region ${START_REGION} configured from preset_sidecars`);

// Host-side capture of every runner:loadRegion from here on — the
// region move must land in EXPECT_REGION and never in AVOID_REGION.
await page.evaluate(async () => {
    const { default: eventBus } = await import('./app/core/eventBus.js');
    window.__runnerLoads = [];
    eventBus.subscribe('runner:loadRegion', (d) => window.__runnerLoads.push(d?.region_id),
        'verify-runner-bot');
});

// 2. The phase-8 injection itself: the registry entry must expose the
//    host-side PlaybackProxy (this is what lights up loops executeVia).
ok(await walkTo({ kind: 'location', name: CHECK_NAME }),
    'getPlaybackController() returns the injected PlaybackProxy (walkTo dispatched)');

// 3. The bot plays the strip to loc_0 — a REAL user:locationCheck.
const snapA = await waitFor(`${CHECK_NAME} checked by the bot`, async () => {
    const s = await snapshot();
    return s.checked?.includes?.(CHECK_NAME) ? s : null;
});
ok(true, `bot drove a real user:locationCheck (${CHECK_NAME})`);
ok(!grantedItem || Number(snapA.inventory?.[grantedItem]) > 0,
    `granted item reached the host inventory (${grantedItem})`);

// 4. walkTo the E exit: mandatory tip0 crossing with exit_br0 OPEN —
//    the bot must jump off the tip before its portal box.
ok(await walkTo({ kind: 'exit', name: EXIT_NAME }), `walkTo exit ${EXIT_NAME} dispatched`);
await waitFor(`region ${EXPECT_REGION} loaded`, async () =>
    (await status()).includes(`region: ${EXPECT_REGION}`) ? true : null, 90000);
ok(true, `bot drove a real user:regionMove -> ${EXPECT_REGION} (exit_main)`);

const loads = await page.evaluate(() => window.__runnerLoads);
ok(loads.includes(EXPECT_REGION),
    `runner:loadRegion published for ${EXPECT_REGION} (host eventBus)`);
ok(!loads.includes(AVOID_REGION),
    `open branch portal exit_br0 never fired (no load of ${AVOID_REGION})`);

const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
    .filter((l) => !l.includes("Couldn't find skill") && !l.includes('isLoopModeActive'))
    // benign handled probe: <game>_textadventure.json 404s on every
    // non-text game load (textAdventureSubstrateWrapper)
    .filter((l) => !l.includes('404'));
ok(errors.length === 0, `no page errors${errors[0] ? ` — first: ${errors[0].slice(0, 200)}` : ''}`);

await browser.close();
if (failures) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('\nAll runner bot checks passed.');
