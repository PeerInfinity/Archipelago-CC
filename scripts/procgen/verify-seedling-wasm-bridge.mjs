/**
 * In-app verify for the flashPanel WASM transport (Seedling Stage 1):
 * the SWFRecomp-recompiled Seedling page (same-origin iframe,
 * __swfBridge contract) driven by WasmBridgeAdapter, against the
 * seed-1 seedling preset (which wires flash_panel.wasm).
 *
 * Covers the Stage-1 acceptance bar 2–5:
 *   2. bridge handshake — page boots, Start click (user gesture),
 *      callbacks register, configure lands, panel reaches 'ready'
 *   3. location checks — startup suppression (baseline reads check
 *      nothing), then an in-game pickup (property write applied by the
 *      game and re-reported) dispatches user:locationCheck
 *   4. received items apply in-game via queueItems — the granted item
 *      write lands in the game (readState), incl. progressive-chain
 *      expansion (2x Progressive Sword -> sword + darksword) and
 *      fusion (Wand + Fire + Fire Wand Fusion -> firewand)
 *   5. teleport — location dropdown Go queues the new_instance
 *      invocation and BridgeGeneric applies it in-game
 *
 * Prereqs:
 *   - dev server on :8000 (python -m http.server 8000 at repo root)
 *   - the UNCOMMITTED wasm artifact staged at
 *     frontend/modules/flashPanel/wasm/seedling_teleport_ap/
 *     (copy command in frontend/modules/flashPanel/README.md);
 *     the script SKIPs (exit 0) when it is absent — CI has no wasm.
 *
 * Runs headless: WebGPU comes up on swiftshader with
 * --enable-unsafe-webgpu --enable-unsafe-swiftshader --use-angle=swiftshader
 * (verified locally; the game loop runs fine on the software adapter).
 *
 * Run: node scripts/procgen/verify-seedling-wasm-bridge.mjs
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACT = join(HERE, '..', '..', 'frontend', 'modules', 'flashPanel',
    'wasm', 'seedling_teleport_ap');
if (!existsSync(join(ARTIFACT, 'game.html'))
    || !existsSync(join(ARTIFACT, 'seedling_teleport_ap.wasm'))) {
    console.log(`SKIP: seedling wasm artifact not staged at ${ARTIFACT}`
        + ' — see frontend/modules/flashPanel/README.md for the copy command');
    process.exit(0);
}

// mode=flash: the flashPanel module is enabled in modules-flash.json
// (disabled in the default module config) and the default layout
// already carries a "Flash Game" tab. No ?game param on purpose: the
// app boots on its fallback preset and the script switches to the
// seedling preset afterwards, covering the panel's reinit-on-preset-
// switch path (the flow a user takes when picking the preset in the
// UI rather than the URL).
const URL = 'http://localhost:8000/frontend/?mode=flash';
const SEEDLING_RULES = './presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json';

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

let failures = 0;
function check(name, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
}

async function waitFor(desc, fn, timeoutMs = 30000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) {
            console.log('PAGE LOGS (last 40):\n' + logs.slice(-40).join('\n'));
            throw new Error(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(300);
    }
}

function gameFrame() {
    const f = page.frames().find((fr) => fr.url().includes('seedling_teleport_ap/game.html'));
    if (!f) throw new Error('seedling wasm iframe not found');
    return f;
}

async function panelStatus() {
    return page.evaluate(() =>
        document.querySelector('.flash-panel-status')?.textContent ?? '');
}

// readState straight off the game's callback surface — an independent
// observation of in-game state, not routed through the adapter.
async function readGameState() {
    const raw = await gameFrame().evaluate(() => window.__swfBridge.game.readState());
    try { return JSON.parse(raw); } catch { return { __raw: raw }; }
}

async function snapshot() {
    return page.evaluate(async () => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const s = proxy.uiCache ?? {};
        return { inventory: s.inventory ?? null, checked: s.checkedLocations ?? null };
    });
}

// Grant an AP item into the host inventory (the same worker command
// the Inventory panel's click path uses) — simulates a received item;
// the adapter's inventory-driven writes must carry it into the game.
async function grantItem(itemName) {
    await page.evaluate(async (name) => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.addItemToInventory(name);
    }, itemName);
}

// In-game pickup simulation. A real pickup sets the property in game
// code mid-frame, and BridgeGeneric's monitor (which runs BEFORE the
// queue drain each frame) reports it before the adapter's clearing
// write can revert it. The only write channel a test has is the item
// queue, which is applied AFTER the monitor — and headless NO_GRAPHICS
// frames are slow enough that the same drain also carries a 100ms-
// cadence clearing write, so the true->false blip would never be seen.
// Pausing the adapter's push loop for the duration restores the real
// pickup's observable ordering: monitor reports true, adapter
// dispatches the check + queues the undo, then the resumed loop
// delivers undo/clearing/granted-item writes.
async function pausePushLoop() {
    await page.evaluate(async () => {
        const mod = await import('./modules/flashPanel/index.js');
        const a = mod.getActivePanelInstance().adapter;
        clearInterval(a._pushTimer);
        a._pushTimer = null;
    });
}
async function resumePushLoop() {
    await page.evaluate(async () => {
        const mod = await import('./modules/flashPanel/index.js');
        mod.getActivePanelInstance().adapter.attach();
    });
}
async function inGamePickup(property, expectLocation) {
    await pausePushLoop();
    await gameFrame().evaluate((p) => {
        window.__swfBridge.queueItems({ class: 'main', property: p, value: true });
    }, property);
    await waitFor(`"${expectLocation}" checked from in-game pickup`, async () => {
        const s = await snapshot();
        return s.checked?.includes?.(expectLocation) ? s : null;
    }, 60000);
    await resumePushLoop();
}

// ── boot the app on the seed-1 seedling preset ──────────────────────
await page.goto(URL);
await page.waitForTimeout(8000);

// Bring the Flash Game tab forward (the panel constructs with the
// layout; activation makes its DOM clickable).
await waitFor('Flash Game tab activated', () => page.evaluate(() => {
    const tab = [...document.querySelectorAll('.lm_tab')]
        .find((t) => t.title === 'Flash Game');
    if (!tab) return false;
    tab.click();
    return true;
}));

// ── reinit-on-preset-switch: fallback preset first, then seedling ──
check('panel idle on the fallback preset',
    (await panelStatus()) === 'no game configured',
    `status="${await panelStatus()}"`);
await page.evaluate(async (src) => {
    const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
    const rules = await fetch(src).then((r) => r.json());
    await proxy.loadRules(rules, { playerId: 1 }, src);
}, SEEDLING_RULES);

// ── acceptance 2: handshake ─────────────────────────────────────────
await waitFor('wasm iframe mounted', async () =>
    page.frames().some((fr) => fr.url().includes('seedling_teleport_ap/game.html')));
await waitFor('start button enabled', () =>
    gameFrame().evaluate(() => {
        const b = document.getElementById('btn-start');
        return !!b && !b.disabled;
    }));
check('panel prompts for Start', (await panelStatus()).includes('Start'),
    `status="${await panelStatus()}"`);
await gameFrame().click('#btn-start');

const status = await waitFor("panel status 'ready'", async () =>
    ((await panelStatus()) === 'ready' ? 'ready' : null), 60000);
check('bridge handshake reaches ready', status === 'ready');

const st0 = await readGameState();
check('readState returns monitored properties',
    typeof st0.hasSword !== 'undefined' && typeof st0.hitsMax !== 'undefined',
    JSON.stringify(st0).slice(0, 100));

// ── acceptance 3a: startup suppression ──────────────────────────────
// Baseline reads flowed during configure; give the monitor a beat and
// assert nothing got checked from them.
await page.waitForTimeout(3000);
const s0 = await snapshot();
check('startup suppression: no locations checked from baseline reads',
    (s0.checked ?? []).length === 0, JSON.stringify(s0.checked));

// ── acceptance 3b + 4: in-game pickup -> check -> granted item lands ──
// Seed 1: location "Sword" holds Ghost Spear (flash item 'spear').
await inGamePickup('hasSword', 'Sword');
check('in-game pickup dispatches location check', true);
const stSpear = await waitFor('Ghost Spear write lands in-game', async () => {
    const st = await readGameState();
    return st.hasSpear === true ? st : null;
});
check('granted item applied in-game via queueItems', stSpear.hasSpear === true);
// The undo write must also have landed: the game-given sword is taken
// back (no Progressive Sword owned yet), so hasSword is false again.
check('pickup undo write landed (hasSword cleared)', stSpear.hasSword === false,
    `hasSword=${stSpear.hasSword}`);

// ── acceptance 4: progressive chain ─────────────────────────────────
// 2x Progressive Sword expands the !sword chain -> sword + darksword.
await grantItem('Progressive Sword');
await grantItem('Progressive Sword');
const stProg = await waitFor('progressive swords land in-game', async () => {
    const st = await readGameState();
    return (st.hasSword === true && st.hasDarkSword === true) ? st : null;
});
check('progressive expansion applied in-game',
    stProg.hasSword === true && stProg.hasDarkSword === true);

// ── acceptance 4: fusion ────────────────────────────────────────────
// Wand + Fire + the Fire Wand Fusion flag fuse into flash item
// 'firewand' (hasFireWand), alongside the two base items.
await grantItem('Wand');
await grantItem('Fire');
await grantItem('Fire Wand Fusion');
const stFuse = await waitFor('fusion result lands in-game', async () => {
    const st = await readGameState();
    return st.hasFireWand === true ? st : null;
});
check('fusion applied in-game',
    stFuse.hasFireWand === true && stFuse.hasWand === true && stFuse.hasFire === true,
    `wand=${stFuse.hasWand} fire=${stFuse.hasFire} firewand=${stFuse.hasFireWand}`);

// ── acceptance 5: teleport ──────────────────────────────────────────
// Location dropdown -> Go queues the new_instance invocation;
// BridgeGeneric logs "[BridgeGeneric] Invoked: new Game(...)" on
// success (captured from the iframe's console).
logs.length = 0;
await page.evaluate(() => {
    const sel = document.querySelector('.flash-panel-tp-location');
    sel.value = 'Sword';
    document.querySelector('.flash-panel-tp-location-go').click();
});
await waitFor('teleport invocation applied in-game', () =>
    logs.some((l) => l.includes('[BridgeGeneric] Invoked: new Game(10,48,64)')) || null);
check('teleport new_instance applied by BridgeGeneric', true);
// Game must still be alive and reporting after the world swap.
const stAfterTp = await readGameState();
check('game still reporting after teleport', typeof stAfterTp.hasSword !== 'undefined');

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
