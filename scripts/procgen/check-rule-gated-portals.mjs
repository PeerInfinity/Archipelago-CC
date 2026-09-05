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
 *   3. Drive back to start; the SAME portal now reports OPEN — the
 *      bridge re-evaluated gate_rules against the new inventory and
 *      pushed the boolean back into the game.
 *
 * ⛔ WHAT THIS DOES **NOT** ASSERT — PER-PORTAL PHYSICAL REACHABILITY.
 * There used to be a fourth leg: "the no-input player climbs the column
 * and exits through the unlocked portal BY ITSELF, and Victory
 * auto-collects behind it". It was CUT (⚖ user, 2026-09-05, procgen
 * verify tier V3a). It is not a claim this instrument can make: the seed
 * scan below reasons over the SPHERE TREE (which region hangs off which,
 * behind which gate) and has no model of the level's geometry, so it can
 * pick a topology whose gated portal is correctly unlocked and simply not
 * climbable by an unaided bounce. Measured at V2: `CLIMB REACHED:
 * entrance → b0 → b1 → b2`, then ~85 s bouncing on b2 with BOTH arrows
 * held and `botStatus.active` false throughout — the unlock was right and
 * the climb was the thing that failed. Closing that leg honestly means
 * deriving per-portal reachability (canJump.js / deriveRules.js) into the
 * scan; driving the last hop with sendExit the way step 2 does would gut
 * the claim. The AUTHORED LOCK contract — locked before the key, open
 * after it, re-evaluated on the snapshot update — is what is witnessed
 * here, and steps 1 and 2 are still real physics auto-play.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/check-rule-gated-portals.mjs
 * @ci-box V3b adopted this script's NAME, not its RUN: it drives a repo-root dev server at a hardcoded `localhost:8000` and it takes no `--host=` at all, so the roster cannot point it elsewhere.
 *   ⇒ deleting this one line is how a later slice adopts it into CI.
 */
import { chromium } from 'playwright';

// ── Node-side: find a seed with the right topology ──────────────
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import { BOUNCE_LIBRARY_ITEMS } from '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import { growSpheres } from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { planSpheres } from '../../frontend/modules/procgenPipeline/spherePlanner.js';
import { DEFAULT_ITEMS } from '../../frontend/modules/shared/procgen/library.js';
import { collectSphereGrowthPrep } from '../../frontend/modules/procgenPipeline/sphereConfigHooks.js';
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
takeBoxLockOrExit({ name: 'check-rule-gated-portals.mjs', kind: 'browser' });

/**
 * ⛓⛓ TWO ARROWS, AND THAT IS THE PANEL'S ARITHMETIC, NOT A TASTE. Bounce's
 * `prepareSphereGrowth` hook GRANTS one arrow free and REMOVES it from the pool
 * (`itemPoolDelta: {[pick]: -1}`), so a 3-item pool leaves 2 instances for 3
 * spheres and `planSpheres` refuses. The second arrow is what the pool spends
 * on sphere 1 — and it is also what gates the wave-1 region that hosts key_red,
 * which is the shape this instrument asserts.
 */
const ITEM_POOL = { 'Left arrow': 1, 'Right arrow': 1, key_red: 1, victory: 1 };
const ITEM_LIB = { ...DEFAULT_ITEMS, ...BOUNCE_LIBRARY_ITEMS };

/**
 * ⛓⛓⛓ THE MIRROR IS THE PANEL'S OWN HOOK, NOT A COPY OF IT. This used to
 * re-implement `_runSphereGrowth`'s pre-plan step by hand — pick an arrow with
 * `createRng((seed * 31 + 17) | 0)` and pin it `exclusiveSpheres: {1: [arrow]}`
 * — which was true of the panel until `06eafea4e` (2026-06-19) moved that
 * contribution into the bounce substrate's `prepareSphereGrowth` adapter hook,
 * where the arrow became a FREE STARTING ITEM and left the pool entirely. A
 * hand copy cannot notice a change like that; `collectSphereGrowthPrep` is the
 * same function `procgenPipelineUI.js:4263` calls, so it cannot drift again.
 */
function buildWorld(seed) {
    const itemPool = { ...ITEM_POOL };
    // ⛔ MUTATES itemPool (the hook's `itemPoolDelta`) — post-prep is what the
    //    panel plans over, so read it AFTER this call, never before.
    const prep = collectSphereGrowthPrep({
        activeIds: ['bounce'], itemPool, quotas: { bounce: 99 },
        startSubstrate: 'bounce', seed, params: {},
    });
    const plan = planSpheres({
        itemPool, sphereCount: 3,
        exclusiveSpheres: prep.exclusiveSpheres,
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
            startingItems: prep.startingItems,
            regionParams: prep.regionParams,
        },
    });
    return { plan, tree, prep };
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
    // Need: the key-gated region hangs off the START (lock observable before
    // the key is collected); key_red lives in another region that ALSO hangs
    // off the start (step 2 drives there with one sendExit); and the start
    // hosts the pool's arrow, so step 1's climb has something to collect —
    // the free arrow is in the inventory from tick 0 and cannot witness that.
    const poolArrow = w.plan.spheres[0].items.find((i) => i.endsWith('arrow'));
    if (keyGated && keyHost && keyGated.parent === start.index
            && keyHost.parent === start.index
            && keyHost.index !== start.index && keyHost.index !== keyGated.index
            && poolArrow && start.items.some((i) => i.item === poolArrow)
            // ⛔ NOT A SOUTH PORTAL — AND THE REASON CHANGED WITH V3a.
            //    `sideExits.js` places S "low and right-of-center (never in the
            //    spawn column — a platform there would intercept the spawn fall
            //    and instantly exit)", so the NO-INPUT player, who only ever
            //    climbs, cannot reach it. That used to matter because the cut
            //    fourth leg waited for the player to fly THROUGH the portal.
            //    It still matters for step 1, which is the surviving physics
            //    claim: "the locked portal HOLDS — still in the start region
            //    after the column climb" is only a claim about a lock if the
            //    climb actually passes the portal. On an unreachable S exit the
            //    player could not have left through it locked or open, and the
            //    step would pass vacuously. N reuses the level's own
            //    top-of-climb portal and E/W sit at the side edges "reachable by
            //    drifting from the bottom of the climb" — all three are on the
            //    auto-player's path. (Dropping this line re-picks the seed:
            //    measured, seeds 12/14/15 match, and 12 is the S one.)
            && keyGated.side !== 'S') {
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
/** The arrow the POOL spends on sphere 1 — NOT the one the hook grants free. */
const POOL_ARROW = world.plan.spheres[0].items.find((i) => i.endsWith('arrow'));
const FREE_ARROW = world.prep.startingItems[0];
console.log(`SEED ${SEED}: start ${startNode.region_id}`,
    `| free '${FREE_ARROW}' (bounce prepareSphereGrowth) | pool '${POOL_ARROW}' in the start region`,
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
// ⛓ SPHERE MODE'S PRIMARY BUTTON IS "Run all", NOT "Generate" — this page is
//   pinned to `mode: 'sphereGrowth'` by the addInitScript above, and in that
//   mode `procgenPipelineUI.js` labels the primary button "Run all" / "Run all
//   (finish)". `85c1c3ba1` (the stepped sphere pipeline) introduced that label
//   and re-pointed `check-sphere-growth-ui.mjs` in the same commit, but not
//   this file — its sibling that drives the same mode. Left behind, the
//   locator matched nothing and every run died on a 30 s click timeout.
await panel.locator('button:has-text("Run all")').first().click();
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
// ⛔ THE *POOL* ARROW, BY NAME. `FREE_ARROW` is in the inventory from tick 0
//    (the substrate hook grants it), so "either arrow" would be satisfied
//    before the climb had happened and this step would witness nothing.
await waitFor(`the start column collects the pool arrow '${POOL_ARROW}'`, async () => {
    const s = await snapshot();
    return s.inventory?.[POOL_ARROW] > 0 ? s : null;
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
//    snapshot update, so the SAME portal that reported LOCKED in step 1
//    now reports OPEN — with nothing changed but the inventory.
const backSide = (await gameDebug())?.backExitSide;
if (!backSide) throw new Error('expected a back exit side in the key region');
await bounceFrame().evaluate(
    (side) => window.__swfBridge.sendExit('verify_back', side), backSide);
// ⛓⛓ THE UNLOCK AND THE FLY-THROUGH ARE TWO CLAIMS, AND ONLY THE FIRST IS
//    THIS INSTRUMENT'S. Polling the REGION instead would collapse "the bridge
//    never re-evaluated the rule" (a SUBJECT defect) into "the auto-player did
//    not reach the portal in 90 s" (physics / the portal's side) — one
//    timeout, two utterly different findings, and no way to tell which from
//    the text. That split is why V2 could see the unlock was correct and the
//    climb was not; V3a then cut the climb claim entirely (header).
await waitFor(`portal '${lockedPortalId}' reports OPEN back in the start region`,
    async () => (await gameDebug())?.gateStates?.portals?.[lockedPortalId] === true, 30000);
const dbg2 = await gameDebug();
console.log('PORTAL UNLOCKED: gate_rules re-evaluated on the snapshot update',
    '| gate states:', JSON.stringify(dbg2?.gateStates));
// ⛔ THE FLY-THROUGH LEG STOPS HERE — see the header. Whether the no-input
//    climb can physically REACH this correctly-unlocked portal is a property
//    of the level's geometry, and the seed scan above reasons over the sphere
//    tree, which cannot see geometry. Asserting it here made a reachability
//    miss read as a gate-rule defect for ~85 s of silence.

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:', errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY RULE-GATED PORTALS: ALL OK');
await browser.close();
process.exit(0);
