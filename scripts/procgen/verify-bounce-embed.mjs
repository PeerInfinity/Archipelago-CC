import { chromium } from 'playwright';

// 8b in-app playthrough — seed 1 canonical placement.
// Spiral chain: region_1_0 (bounceStack) -E-> region_2_0 (easyTower)
//   -S-> region_2_1 (fillerClimb) -W-> region_1_1 (springGap)
//   -W-> region_0_1 (fork).
// Phase A: real physics — zone 0 auto-collects loc_arrow (no input).
// Phase B: remaining checks/moves driven via the __swfBridge contract
//   (the exact calls the game makes on pickup/portal landings).

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:8000/frontend/?game=bounce_worldgen&seed=1');
await page.waitForTimeout(8000);

function bounceFrame() {
    const f = page.frames().find((fr) => fr.url().includes('bounceDemo/game/index.html'));
    if (!f) throw new Error('bounce iframe not found');
    return f;
}

async function status() {
    return bounceFrame().evaluate(() => document.getElementById('status')?.textContent ?? '');
}

async function snapshot() {
    return page.evaluate(async () => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const s = proxy.uiCache ?? {};
        return {
            inventory: s.inventory ?? null,
            checked: s.checkedLocations ?? null,
        };
    });
}

async function waitFor(desc, fn, timeoutMs = 30000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
        await page.waitForTimeout(500);
    }
}

// ── initial load: start region configured into the iframe ──
const st0 = await waitFor('initial bounce region load', async () =>
    (await status()).includes('region:') ? await status() : null);
console.log('START STATUS:', st0);

// ── Phase A: real-physics auto-collect of zone 0's pickup ──
await waitFor('loc_arrow auto-checked by physics', async () => {
    const s = await snapshot();
    return s.checked?.includes?.('region_1_0__loc_arrow') ? s : null;
}, 60000);
let s = await snapshot();
console.log('AFTER PHASE A: checked =', JSON.stringify(s.checked),
    'Right arrow =', JSON.stringify(s.inventory?.['Right arrow']));

// ── Phase B: drive the rest via the bridge contract ──
async function sendExit(portalId, side, expectRegion) {
    await bounceFrame().evaluate(([p, sd]) => window.__swfBridge.sendExit(p, sd), [portalId, side]);
    const st = await waitFor(`region ${expectRegion} loaded`, async () => {
        const t = await status();
        return t.includes(expectRegion) ? t : null;
    });
    console.log(`MOVE ${side} ->`, st);
}

async function sendLocation(pickupId, expectLocation, expectItem) {
    await bounceFrame().evaluate((p) => window.__swfBridge.sendLocation(p), pickupId);
    const snap = await waitFor(`${expectLocation} checked`, async () => {
        const x = await snapshot();
        return x.checked?.includes?.(expectLocation) ? x : null;
    });
    console.log(`CHECK ${pickupId} -> ${expectLocation}; ${expectItem} =`,
        JSON.stringify(snap.inventory?.[expectItem]));
}

await sendExit('side_exit_E', 'E', 'region_2_0');
await sendLocation('loc_easy', 'region_2_0__loc_easy', 'Left arrow');
await sendLocation('loc_easy2', 'region_2_0__loc_easy2', 'Springs');
await sendExit('side_exit_S', 'S', 'region_2_1');
await sendExit('side_exit_W', 'W', 'region_1_1');
await sendLocation('loc_spring', 'region_1_1__loc_spring', 'Jetpacks');
await sendExit('side_exit_W', 'W', 'region_0_1');
await sendLocation('loc_right', 'region_0_1__loc_right', 'Blue platforms');
await sendLocation('loc_left', 'region_0_1__loc_left', 'Victory');

s = await snapshot();
console.log('FINAL inventory:', JSON.stringify(s.inventory));
console.log('FINAL checked:', JSON.stringify(s.checked));

const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
    .filter((l) => !l.includes("Couldn't find skill") && !l.includes('isLoopModeActive'));
console.log('ERRORS (' + errors.length + '):');
for (const e of errors.slice(0, 15)) console.log(' ', e.slice(0, 300));

await browser.close();
