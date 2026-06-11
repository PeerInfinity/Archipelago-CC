/**
 * In-app smoke test for RULE-GATED PORTALS (sphere-driven growth
 * priority #2): a bounce world where a non-ability item (key_red)
 * gates a portal as an AUTHORED LOCK — no geometry; the host bridge
 * evaluates the payload's gate_rules against live inventory and
 * pushes booleans into the game (__swfBridge.setGateStates).
 *
 * World shape (seed scanned in Node so the key-gated wave-2 region
 * attaches to the START region — that makes the lock observable
 * before the key exists):
 *
 *   start (wave 0, hosts the arrow)
 *     ├─ wave-1 region behind [arrow]  — hosts key_red
 *     └─ wave-2 region behind [key_red] — AUTHORED lock, hosts Victory
 *
 * Asserted flow, all on REAL physics auto-play + the bridge contract:
 *   1. Start column auto-collects the arrow; the key-gate portal
 *      reports LOCKED via __bounceDebug().gateStates, and the
 *      auto-player keeps bouncing without exiting through it.
 *   2. Drive to the wave-1 region (sendExit); auto-play collects
 *      key_red; stateManager:snapshotUpdated re-evaluates the rules.
 *   3. Drive back to start; the portal is now OPEN — the no-input
 *      player climbs the column and exits through it BY ITSELF;
 *      Victory auto-collects in the wave-2 region.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-rule-gated-portals.mjs
 */
import { chromium } from 'playwright';

// ── Node-side: find a seed with the right topology ──────────────
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import { BOUNCE_LIBRARY_ITEMS } from '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import { growSpheres } from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { planSpheres } from '../../frontend/modules/procgenPipeline/spherePlanner.js';
import { DEFAULT_ITEMS } from '../../frontend/modules/shared/procgen/library.js';
import { createRng } from '../../frontend/modules/shared/rng.js';

const ITEM_POOL = { 'Right arrow': 1, key_red: 1, victory: 1 };
const ITEM_LIB = { ...DEFAULT_ITEMS, ...BOUNCE_LIBRARY_ITEMS };

function buildWorld(seed) {
    // Mirror the panel's _runSphereGrowth (bounce-only quotas → bounce
    // start → one seeded arrow exclusive to sphere 1).
    const arrows = ['Left arrow', 'Right arrow'].filter((a) => (ITEM_POOL[a] ?? 0) > 0);
    const startArrow = arrows[Math.floor(createRng((seed * 31 + 17) | 0).next() * arrows.length)];
    const plan = planSpheres({
        itemPool: ITEM_POOL, sphereCount: 3,
        exclusiveSpheres: { 1: [startArrow] },
        victoryItem: 'victory', seed,
    });
    const { tree } = growSpheres({
        regionSize: { width: 8, height: 6 },
        itemLib: ITEM_LIB,
        seed,
        growthParams: {
            spherePlan: plan,
            maxItemsPerRegion: 2,
            fillerCount: 0,
            revisitRatio: 0.25,
            substrateQuotas: { bounce: 99 },
        },
    });
    return { plan, tree };
}

let SEED = null;
let world = null;
for (let seed = 1; seed <= 30; seed++) {
    let w;
    try {
        w = buildWorld(seed);
    } catch {
        continue; // structural dead-end; next seed
    }
    const start = w.tree.nodes[0];
    const keyGated = w.tree.nodes.find((n) => n.gate.includes('key_red'));
    const keyHost = w.tree.nodes.find((n) =>
        n.items.some((i) => i.item === 'key_red'));
    // Need: the key-gated region hangs off the START (lock observable
    // before the key is collected) and key_red lives elsewhere.
    if (keyGated && keyHost && keyGated.parent === start.index
            && keyHost.index !== start.index && keyHost.index !== keyGated.index) {
        SEED = seed;
        world = w;
        break;
    }
}
if (SEED == null) throw new Error('no seed in 1..30 attaches the key gate to the start region');

const { tree } = world;
const startNode = tree.nodes[0];
const keyGated = tree.nodes.find((n) => n.gate.includes('key_red'));
const keyHost = tree.nodes.find((n) => n.items.some((i) => i.item === 'key_red'));
const lockedPortalId = `side_exit_${keyGated.side}`;
console.log(`SEED ${SEED}: start ${startNode.region_id}`,
    `| key_red in ${keyHost.region_id} (side ${keyHost.side}, gate [${keyHost.gate}])`,
    `| key-gated ${keyGated.region_id} on start side ${keyGated.side}`);

const PANEL_PARAMS = {
    seed: SEED, regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2,
    sphereCount: 3, fillerCount: 0, revisitPercent: 25,
};

// ── Browser side ────────────────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.addInitScript(({ params, items }) => {
    localStorage.setItem('procgenPipeline_params', JSON.stringify({
        mode: 'sphereGrowth',
        params,
        scenario: { items, obstacles: {} },
        substrateQuotas: { bounce: 99 },
        substrateMix: {},
        substrateMode: 'quotas',
    }));
}, { params: PANEL_PARAMS, items: ITEM_POOL });

await page.goto('http://localhost:8000/frontend/');
await page.waitForTimeout(8000);

const activated = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.lm_tab')]
        .find((t) => t.title === 'Procgen Pipeline');
    if (!tab) return false;
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tab.click();
    return true;
});
if (!activated) throw new Error('Procgen Pipeline tab not found');
await page.waitForTimeout(1500);

const panel = page.locator('.procgen-pipeline-panel');
await panel.locator('button:has-text("Generate")').first().click();
await page.waitForTimeout(3000);
const message = await panel.locator('.procgen-pipeline-message').textContent();
console.log('PANEL MESSAGE:', message);
if (!message.includes('Sphere plan realised')) {
    throw new Error(`expected oracle success message, got: ${message}`);
}
await panel.locator('button:has-text("Load into frontend")').click();
await page.waitForTimeout(4000);

function bounceFrame() {
    const f = page.frames().find((fr) => fr.url().includes('bounceDemo/game/index.html'));
    if (!f) throw new Error('bounce iframe not found');
    return f;
}
async function status() {
    return bounceFrame().evaluate(() => document.getElementById('status')?.textContent ?? '');
}
async function currentRegion() {
    return (await status()).match(/region: (\S+)/)?.[1] ?? null;
}
async function gameDebug() {
    return bounceFrame().evaluate(() => window.__bounceDebug?.() ?? null);
}
async function snapshot() {
    return page.evaluate(async () => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const s = proxy.uiCache ?? {};
        return { inventory: s.inventory ?? null, checked: s.checkedLocations ?? null };
    });
}
async function waitFor(desc, fn, timeoutMs = 60000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) {
            console.log('LOGS (last 30):', logs.slice(-30).join('\n'));
            throw new Error(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(500);
    }
}

// 1. The arrow auto-collects in the start column, and the key-gate
//    portal reports LOCKED the whole time (key_red doesn't exist yet).
await waitFor('start arrow in inventory', async () => {
    const s = await snapshot();
    return s.inventory?.['Right arrow'] > 0 || s.inventory?.['Left arrow'] > 0 ? s : null;
}, 90000);
const dbg1 = await gameDebug();
console.log('GATE STATES (pre-key):', JSON.stringify(dbg1?.gateStates));
if (dbg1?.gateStates?.portals?.[lockedPortalId] !== false) {
    throw new Error(`expected portal '${lockedPortalId}' LOCKED before key_red, got `
        + JSON.stringify(dbg1?.gateStates));
}
// The auto-player bounces on the locked on-column portal without
// exiting: we must still be in the start region after the climb.
await page.waitForTimeout(5000);
const regionWhileLocked = await currentRegion();
if (regionWhileLocked !== startNode.region_id) {
    throw new Error(`locked portal leaked: region moved to ${regionWhileLocked}`);
}
console.log('LOCKED PORTAL HOLDS: still in', regionWhileLocked, 'after the column climb');

// 2. Drive to the key_red region; auto-play collects the key.
await bounceFrame().evaluate(
    (side) => window.__swfBridge.sendExit('verify_to_key', side), keyHost.side);
await waitFor('key_red in inventory', async () => {
    const s = await snapshot();
    return s.inventory?.key_red > 0 ? s : null;
}, 90000);
console.log('KEY COLLECTED: key_red in inventory');

// 3. Drive back to start. The bridge re-evaluated gate_rules on the
//    snapshot update, so the portal is OPEN — the no-input player
//    climbs the column and exits through it by itself; Victory
//    auto-collects in the key-gated region.
const backSide = (await gameDebug())?.backExitSide;
if (!backSide) throw new Error('expected a back exit side in the key region');
await bounceFrame().evaluate(
    (side) => window.__swfBridge.sendExit('verify_back', side), backSide);
await waitFor(`auto-exit through the unlocked portal into ${keyGated.region_id}`, async () => {
    return (await currentRegion()) === keyGated.region_id ? true : null;
}, 90000);
const dbg2 = await gameDebug();
console.log('UNLOCKED PORTAL FIRED: now in', keyGated.region_id,
    '| gate states:', JSON.stringify(dbg2?.gateStates));
await waitFor('victory in inventory', async () => {
    const s = await snapshot();
    return s.inventory?.victory > 0 ? s : null;
}, 90000);
console.log('VICTORY COLLECTED (behind the authored key gate)');

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:', errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY RULE-GATED PORTALS: ALL OK');
await browser.close();
process.exit(0);
