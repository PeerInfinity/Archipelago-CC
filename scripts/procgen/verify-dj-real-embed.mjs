/**
 * In-app verify for the REAL-DJ renderer embed: with
 * moduleSettings.bounceDemo.renderer = 'dj', bounce region loads route
 * to the bounceDjRealPanel iframe (modules/bounceDemo/djReal/), whose
 * page patches the user-supplied original Doodle Jump SWF in-browser
 * (loader bytecode splice + 600px header RECT) and runs it under
 * Ruffle. The injected loader then plays the committed
 * bounce_dj_worldgen start region (region_3_3) under DJ's own physics:
 * the zero-input climb lands on p2 and fires sendLocation('loc_0'),
 * which must arrive in the HOST's checkedLocations as
 * region_3_3__loc_0 — real game physics driving AP state in-app.
 *
 * Prereqs:
 *   - dev server on :8000 (python -m http.server 8000)
 *   - the original Doodle Jump SWF at
 *     frontend/modules/bounceDemo/djReal/Doodle_Jump.swf (gitignored;
 *     the page's fetch-path acquisition — the same file users drop in)
 *   - network access (Ruffle CDN)
 *
 * Run: node scripts/procgen/verify-dj-real-embed.mjs
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SWF = join(HERE, '..', '..', 'frontend', 'modules', 'bounceDemo', 'djReal', 'Doodle_Jump.swf');
if (!existsSync(SWF)) {
    console.log(`SKIP: original DJ SWF not present at ${SWF}`);
    process.exit(0);
}

const URL = 'http://localhost:8000/frontend/?game=bounce_dj_worldgen&seed=1';
const browser = await chromium.launch();
// Explicit locale: without it, headless Chromium reports locale info
// Ruffle rejects ("Incorrect locale information provided") and the
// <ruffle-player> element never upgrades (load() missing).
const ctx = await browser.newContext({ locale: 'en-US' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

async function waitFor(desc, fn, ms = 90000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > ms) {
            console.log('PAGE LOGS (last 40):\n' + logs.slice(-40).join('\n'));
            throw new Error(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(500);
    }
}
const sawLog = (needle) => () => logs.some((l) => l.includes(needle)) || null;

console.log('━━ boot 1: persist renderer=dj');
await page.goto(URL);
await page.waitForTimeout(8000);
await page.evaluate(async () => {
    const { default: settingsManager } = await import('./app/core/settingsManager.js');
    await settingsManager.updateSetting('moduleSettings.bounceDemo.renderer', 'dj');
    settingsManager.flushPendingSave();
});

console.log('━━ boot 2: dj renderer routes the start region');
logs.length = 0; // boot-1 lines (JS-renderer routing) must not bleed in
await page.reload();

// The dj page's game-side shim logs the configure; the JS renderer's
// iframe must NOT be configured for this region. region_3_3 is the
// committed preset's start region (zero-input climb collects loc_0,
// the locked Left-arrow start pickup, on p2).
await waitFor('dj page configured with region_3_3',
    sawLog('[dj-bridge] configure(region_3_3)'));

// In-browser patch + Ruffle boot (CDN).
await waitFor('SWF patched + Ruffle running', sawLog('[djReal] running (Ruffle)'));

// The injected loader takes over and the zero-input climb begins —
// landing on p4 fires sendLocation(loc_0) through the EI bridge.
await waitFor('loader landing fires sendLocation(loc_0)',
    sawLog('[dj-bridge] sendLocation(loc_0)'), 120000);

// And the host's world state actually checked the AP location.
const checked = await waitFor('region_3_3__loc_0 in host checkedLocations',
    async () => page.evaluate(async () => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const c = proxy.uiCache?.checkedLocations ?? [];
        return c.includes('region_3_3__loc_0') ? c : null;
    }), 30000);
console.log('  checkedLocations:', JSON.stringify(checked));

// The JS renderer's page must have stayed idle on boot 2. Both iframes
// run the same bridge code (same log tag), so compare counts: every
// bridge-level loadRegion must correspond to a dj-page configure — a
// surplus means the JS renderer's iframe was also routed.
const flashLoaded = logs.filter((l) => l.includes('[flash-bridge] loaded region'));
const djConfigures = logs.filter((l) => l.includes('[dj-bridge] configure('));
console.log('  flash-bridge loads:', flashLoaded.length, '| dj-bridge configures:', djConfigures.length);
if (flashLoaded.length > djConfigures.length) {
    console.log(flashLoaded.join('\n'));
    throw new Error('more bridge loadRegions than dj-page configures — '
        + 'the JS renderer iframe was ALSO routed (double agency)');
}

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length) {
    console.log('PAGE ERRORS:\n' + errors.join('\n'));
    throw new Error('page errors during the run');
}

console.log('\nVERIFY DJ REAL EMBED: OK');
await browser.close();
process.exit(0);
