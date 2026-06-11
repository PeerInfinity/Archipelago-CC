/**
 * In-app verify for the PLAYBACK BOT driving bounce regions (sphere-
 * driven growth priority #4): the bot replays the committed preset's
 * Python sphere log end-to-end through REAL physics — the host-side
 * PlaybackProxy publishes controller commands, the in-iframe flash
 * bridge translates AP names to game goals, and the game's botDriver
 * synthesizes per-frame inputs (greedy re-plan over the canJump
 * graph). No sendExit/sendLocation shortcuts: every check and region
 * move in scenario A is the game playing itself.
 *
 * Scenario A — bounce-only full playthrough:
 *   ?game=bounce_sphere_worldgen&seed=1 (committed preset, 3 spheres,
 *   7 locations across 5 bounce regions, key-gated portals included).
 *   Press the bot's Play; wait for "finished — 7 locations visited";
 *   assert all locations checked + victory in inventory.
 *
 * Scenario B — mixed maze+bounce world: seamless cross-substrate
 *   handoff (bot stops the maze controller when entering a bounce
 *   region and vice versa). Uses the committed mixed preset.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-bot-playthrough.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();

async function runScenario(name, { url, expectedLocations, victoryItem, timeoutMs = 240000 }) {
    console.log(`\n━━ SCENARIO ${name}: ${url}`);
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

    async function snapshot() {
        return page.evaluate(async () => {
            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
            await proxy.pingWorker('sync');
            const s = proxy.uiCache ?? {};
            return { inventory: s.inventory ?? null, checked: s.checkedLocations ?? null };
        });
    }
    async function botStatus() {
        return page.evaluate(() =>
            document.querySelector('.playback-bot-status')?.textContent ?? '');
    }
    async function botLog(n = 12) {
        return page.evaluate((count) =>
            [...document.querySelectorAll('.playback-bot-log-entry')]
                .slice(-count).map((e) => e.textContent), n);
    }
    async function bounceDebug() {
        const f = page.frames().find((fr) => fr.url().includes('bounceDemo/game/index.html'));
        if (!f) return null;
        return f.evaluate(() => window.__bounceDebug?.() ?? null).catch(() => null);
    }
    async function waitFor(desc, fn, ms = timeoutMs) {
        const start = Date.now();
        let lastNote = 0;
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - start > ms) {
                console.log('BOT STATUS:', await botStatus());
                console.log('BOT LOG:', (await botLog(20)).join('\n  '));
                console.log('BOUNCE DEBUG:', JSON.stringify(await bounceDebug()));
                console.log('PAGE LOGS (last 25):', logs.slice(-25).join('\n'));
                throw new Error(`[${name}] timeout waiting for: ${desc}`);
            }
            if (Date.now() - lastNote > 15000) {
                lastNote = Date.now();
                const s = await snapshot();
                console.log(`  …${desc} | bot: ${await botStatus()} | checked: ${s.checked?.length ?? 0}`);
            }
            await page.waitForTimeout(500);
        }
    }

    await page.goto(`http://localhost:8000/frontend/${url}`);
    await page.waitForTimeout(8000);

    // Activate the Playback Bot tab and wait for its sphere queue.
    const activated = await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab')]
            .find((t) => t.title === 'Playback Bot');
        if (!tab) return false;
        tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        tab.click();
        return true;
    });
    if (!activated) throw new Error(`[${name}] Playback Bot tab not found`);
    await waitFor('sphere log loaded into the bot panel', async () =>
        (await botStatus()).includes('Sphere log loaded') ? true : null, 30000);

    // Press Play.
    await page.click('.playback-bot .playback-control-bar-button-play');
    console.log('  bot started; initial status:', await botStatus());

    // The whole playthrough runs on real physics — wait for the bot to
    // drain its queue, then check the world state.
    await waitFor('bot finished its queue', async () =>
        (await botStatus()).includes('finished') ? true : null);
    const finalStatus = await botStatus();
    const s = await snapshot();
    console.log('  FINAL BOT STATUS:', finalStatus);
    console.log('  FINAL checked:', JSON.stringify(s.checked));
    console.log('  FINAL inventory:', JSON.stringify(s.inventory));

    if ((s.checked?.length ?? 0) < expectedLocations) {
        throw new Error(`[${name}] expected ${expectedLocations} checked locations, got ${s.checked?.length}`);
    }
    if (!(s.inventory?.[victoryItem] > 0)) {
        throw new Error(`[${name}] expected '${victoryItem}' in inventory, got ${JSON.stringify(s.inventory)}`);
    }

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) {
        console.log('PAGE ERRORS:', errors.join('\n'));
        throw new Error(`[${name}] page errors`);
    }
    console.log(`  SCENARIO ${name}: OK (bot log tail: ${(await botLog(4)).join(' | ')})`);
    await page.close();
}

await runScenario('A — bounce-only full sphere playthrough', {
    url: '?game=bounce_sphere_worldgen&seed=1',
    expectedLocations: 7,
    victoryItem: 'Victory',
});

// Mixed maze+bounce: the sphere order alternates substrates
// (maze region_2_2 → bounce region_2_1 → maze region_2_0 → bounce
// region_1_0/victory), so the bot hands off maze→bounce and
// bounce→maze twice each — the seamless-switch requirement.
await runScenario('B — mixed maze+bounce cross-substrate handoff', {
    url: '?game=bounce_mixed_worldgen&seed=1',
    expectedLocations: 6,
    victoryItem: 'victory',
});

// dj profile: real measured Doodle Jump physics at native 20Hz —
// latched no-snap landings, edge wrap, flat ±10 control, full-width
// swept blue movers (∃-phase waits) and breaking browns (reset on
// respawn). The bot replans from live state on every landing, so
// mover phases and broken platforms are handled by simulation, not
// special cases. 20Hz also means everything takes 3x the wall-clock
// of classic — hence the longer timeout.
await runScenario('C — dj-profile playthrough (movers + breaking browns)', {
    url: '?game=bounce_dj_worldgen&seed=1',
    expectedLocations: 7,
    victoryItem: 'Victory',
    timeoutMs: 480000,
});

console.log('\nVERIFY BOT PLAYTHROUGH: ALL OK');
await browser.close();
process.exit(0);
