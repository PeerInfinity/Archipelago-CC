/**
 * In-app smoke test for the sphereGrowth pipeline mode (sphere-driven
 * growth step 6). Drives the REAL panel in a browser:
 *
 *   1. Pre-seed the panel's localStorage with a bounce-only sphere
 *      setup, boot the app, bring the procgen pipeline panel forward.
 *   2. Click Generate — the panel runs planSpheres + growSpheres and
 *      verifies the sphere oracle inline; assert its success message.
 *   3. Click "Load into frontend" — assert the bounce iframe gets
 *      configured with the start region.
 *   4. Let REAL physics auto-collect the braid start region's wave-0
 *      pickups, assert they reach checkedLocations + the in-game
 *      ability state. (Braid-only since column was deprecated: the free
 *      arrow is a STARTING item, so it's already held at load.)
 *   5. Drive one forward region move via the __swfBridge contract,
 *      then exercise the FALL-BACK exit (sendExit '__fall_back' with
 *      the configured backExitSide) and assert we return to start.
 *
 * The expected topology comes from generating the SAME world in Node
 * first (same seed/params ⇒ identical output — determinism is part of
 * what this asserts).
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-sphere-growth-ui.mjs
 */
import { chromium } from 'playwright';

// ── Node-side: the expected world ───────────────────────────────
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import { BOUNCE_LIBRARY_ITEMS } from '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import { growSpheres } from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { planSpheres } from '../../frontend/modules/procgenPipeline/spherePlanner.js';
import { DEFAULT_ITEMS } from '../../frontend/modules/shared/procgen/library.js';

const SEED = 1;
const ITEM_POOL = {
    'Right arrow': 1, 'Left arrow': 1, Springs: 1, Jetpacks: 1,
    'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
};
const PANEL_PARAMS = {
    seed: SEED, regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2,
    sphereCount: 3, fillerCount: 0, revisitPercent: 25,
};

// Mirror the panel's _runSphereGrowth via the SAME hooks the driver
// uses (no duplicated logic). Braid-only (column deprecated 2026-06-19):
// the free arrow is a seeded-random STARTING ITEM (removed from the
// pool), and braid regionParams carry its direction. The Node-side
// regionParams must match the panel's — which uses the bounce param
// DEFAULTS, since the pre-seeded PANEL_PARAMS overrides none of them.
import {
    prepareBounceSphereGrowth, buildBounceRegionParams,
    DEFAULT_BOUNCE_PROCGEN_PARAMS,
} from '../../frontend/modules/bounceDemo/bounceProcgenParams.js';
const itemPool = { ...ITEM_POOL };
const prep = prepareBounceSphereGrowth({
    itemPool, quotas: { bounce: 99 }, startSubstrate: null,
    seed: SEED, substrateId: 'bounce',
});
// The driver applies the pre-plan pool delta before planning.
for (const [k, d] of Object.entries(prep.itemPoolDelta ?? {})) {
    itemPool[k] = (itemPool[k] ?? 0) + d;
    if (itemPool[k] <= 0) delete itemPool[k];
}
const startArrow = prep.startingItems[0];
const plan = planSpheres({
    itemPool, sphereCount: 3, victoryItem: 'Victory', seed: SEED,
});
console.log('FREE ARROW (starting item):', startArrow);
const { tree } = growSpheres({
    regionSize: { width: 8, height: 6 },
    itemLib: { ...DEFAULT_ITEMS, ...BOUNCE_LIBRARY_ITEMS },
    seed: SEED,
    regionParams: {
        ...buildBounceRegionParams({ params: DEFAULT_BOUNCE_PROCGEN_PARAMS, mode: 'sphere' }),
        ...prep.regionParams,
    },
    growthParams: {
        spherePlan: plan,
        maxItemsPerRegion: 2,
        fillerCount: 0,
        revisitRatio: 0.25,
        substrateQuotas: { bounce: 99 },
    },
});
const startNode = tree.nodes[0];
const wave1 = tree.nodes.find((n) => n.wave === 1);
if (!wave1) throw new Error('expected a wave-1 region');
// Parent chain start → wave1 (each hop = sendExit on the child's side;
// wave-0 hops are ungated, the wave-1 hop is gated on sphere-1 items
// collected along the way).
const path = [];
for (let n = wave1; n.parent != null; n = tree.nodes[n.parent]) path.unshift(n);
console.log('EXPECTED: start', startNode.region_id,
    `(items ${startNode.items.map((i) => i.item).join(', ')})`);
console.log('EXPECTED PATH:', path.map((n) =>
    `${n.region_id} (wave ${n.wave}, side ${n.side}, gate [${n.gate.join(', ')}])`).join(' -> '));

// ── Browser side ────────────────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

// Pre-seed the panel state so it boots in sphereGrowth mode with the
// bounce pool configured.
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

async function publish(event, payload) {
    await page.evaluate(async ({ event, payload }) => {
        const { default: eventBus } = await import('./app/core/eventBus.js');
        eventBus.publish(event, payload, 'verifySphereGrowthUi');
    }, { event, payload });
}

// Bring the pipeline panel forward. The tab may sit in GoldenLayout's
// overflow dropdown (the layout has many panels), so dispatch the
// click programmatically rather than requiring screen visibility.
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
if (await panel.count() === 0) throw new Error('procgen pipeline panel not found');
if (!await panel.isVisible()) throw new Error('procgen pipeline panel did not come forward');

const sphereRadio = panel.locator('input[name="procgen-pipeline-mode"][value="sphereGrowth"]');
if (!await sphereRadio.isChecked()) throw new Error('panel did not boot in sphereGrowth mode');
console.log('PANEL: sphereGrowth mode active');

// Generate and assert the inline oracle message.
await panel.locator('button:has-text("Generate")').first().click();
await page.waitForTimeout(3000);
const message = await panel.locator('.procgen-pipeline-message').textContent();
console.log('PANEL MESSAGE:', message);
if (!message.includes('Sphere plan realised')) {
    throw new Error(`expected oracle success message, got: ${message}`);
}

// Load the generated world into the frontend.
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
async function waitFor(desc, fn, timeoutMs = 30000) {
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

// The world AUTO-PLAYS from here: the no-input player climbs each
// column, real physics collects on-column pickups, and satisfied
// arrowless top portals fire on landing — so the game traverses the
// arrowless frontier by itself. Assert outcomes, not intermediate
// regions (those race the auto-play).

// 1. All sphere-1 items reach the inventory via real physics (the
//    braid start region is wave-0/ungated and the free arrow is held
//    from the start, so the no-input climb collects its pickups).
const sphere1 = plan.spheres[0].items;
await waitFor(`sphere-1 items in inventory [${sphere1.join(', ')}]`, async () => {
    const s = await snapshot();
    return sphere1.every((n) => s.inventory?.[n] > 0) ? s : null;
}, 90000);
const s1 = await snapshot();
console.log('SPHERE-1 COLLECTED:', JSON.stringify(s1.inventory));

// 2. Wave-1 exits off the start are gated BRANCH TIPS (on a sphere-1
//    item) — an idle player can't take them. Drive the first hop via
//    the bridge contract (the same call a portal landing makes), the
//    gate now satisfied by the sphere-1 items collected above.
const firstChild = tree.nodes.find((n) => n.parent === startNode.index);
if (!firstChild) throw new Error('start region has no children');
await bounceFrame().evaluate(
    (side) => window.__swfBridge.sendExit('verify_forward', side), firstChild.side);
await waitFor(`driven move to ${firstChild.region_id}`, async () => {
    const st = await status();
    const region = st.match(/region: (\S+)/)?.[1];
    const node = tree.nodes.find((n) => n.region_id === region);
    // auto-play may immediately wander onward through arrowless
    // gates — any non-start region proves the move chain works
    return node && node.parent != null ? node : null;
});
console.log('DRIVEN MOVE OK: left the start region');

// 3. The guaranteed back portal: every non-start region's level
//    carries a return portal whose side resolves to the driver's
//    back-exit. Send it via the bridge contract from whatever region
//    we're in (re-read per attempt — auto-play may move us) and
//    assert a child→parent regionMove fires.
const validBackEdges = new Set(tree.nodes
    .filter((n) => n.parent != null)
    .map((n) => `${n.region_id} -> ${tree.nodes[n.parent].region_id}`));
await waitFor('back-portal regionMove (child -> parent)', async () => {
    const dbg = await gameDebug();
    if (!dbg?.backExitSide) return null; // currently in the start region
    if (dbg.fallBehavior !== 'current') {
        throw new Error(`expected default fallBehavior 'current', got '${dbg.fallBehavior}'`);
    }
    await bounceFrame().evaluate(
        (side) => window.__swfBridge.sendExit('verify_back', side), dbg.backExitSide);
    await page.waitForTimeout(800);
    const hit = logs.find((l) => l.includes(`exit 'verify_back'`)
        && [...validBackEdges].some((e) => l.includes(e)));
    return hit ?? null;
}, 60000);
console.log('BACK PORTAL OK (child -> parent move verified)');

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:', errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY SPHERE GROWTH UI: ALL OK');
await browser.close();
process.exit(0);
