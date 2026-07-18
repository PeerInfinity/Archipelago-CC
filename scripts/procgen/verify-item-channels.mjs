/**
 * In-app verify for the cross-substrate item channels (cross-game P1).
 * The unit suite pins the sharing.items declarations; the in-app
 * substrate tests drive the legs through the test controller; this
 * script is the independent stratum: real app boot, real preset load,
 * real iframes + injected bridges, real resourceChannels bus — a grant
 * published host-side must come out the other end as inventory inside
 * the game engine, and the OWNING game's native reset must wipe it
 * (the D4 semantics).
 *
 * JtA leg (jta_substrate_test preset):
 *   1. The registry's getTypes matches the live fork catalog
 *      (getAllItems) minus the behavior-slotted artifacts.
 *   2. grantItem({to:'jta', from:'host'|'omsi', ...}) lands in the fork
 *      inventory via the Fork 1.12 window.grantItem hook.
 *   3. Artifact / unknown-type grants are rejected at the bus.
 *   4. The game's own doEnergyReset wipes the granted items (fresh
 *      save, no keep-modifying perks ⇒ keep formula wipes to 0).
 *
 * Omsi leg (omsi_substrate_test preset):
 *   1. The static declared type list matches the engine's numeric
 *      resourcesTemplate entries.
 *   2. grantItem({to:'omsi', from:'host'|'jta', ...}) lands in the
 *      engine's resources bag via its own addResource — WITHOUT the
 *      player entering the omsi region (eager delivery; the bag is
 *      global engine state).
 *   3. Boolean-flag / unknown-type grants are rejected at the bus.
 *   4. The game's own loop restart (restartLoop → resetResources)
 *      wipes the granted resources — the D4 native clearing.
 *
 * JtA outbound leg (jta_schedule_test preset; cross-game P2, Fork 1.13):
 *   the preset's dataset schedules zone 0's first item-awarding task with
 *   rep 1 = FOREIGN omsi/gold x2. Driving reps 0-1 with the fork's own
 *   performTask under real region ticking, rep 0 deposits the original
 *   item locally (nothing crosses) and rep 1 deposits nothing locally
 *   while gold x2 lands in the omsi resources bag over the full path
 *   (foreign-award callback → substrate:itemGrant → router grantItem →
 *   crossSubstrate:itemGranted → omsi bridge addResource).
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-item-channels.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const JTA_URL = 'http://localhost:8000/frontend/?game=jta_substrate_test&seed=1';
const JTA_REGION = 'The Village';
const OMSI_URL = 'http://localhost:8000/frontend/?game=omsi_substrate_test&seed=1';
const SCHED_URL = 'http://localhost:8000/frontend/?game=jta_schedule_test&seed=1';
const SCHED_RULES = 'frontend/presets/jta_schedule_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const TIMEOUT_MS = 60000;

for (const sub of ['journey-to-ascension', 'omsi-loops']) {
    try {
        const branch = execSync(`git -C frontend/modules/${sub} rev-parse --abbrev-ref HEAD`).toString().trim();
        const head = execSync(`git -C frontend/modules/${sub} rev-parse --short HEAD`).toString().trim();
        console.log(`${sub} submodule checked out: ${branch} @ ${head} (iframe serves this tree)`);
    } catch {
        console.log(`${sub} submodule state: (unavailable)`);
    }
}

const browser = await chromium.launch({
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
    ],
});

function fail(msg) {
    throw new Error(msg);
}

async function makePage(url) {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
    await page.goto(url);
    return { page, logs };
}

async function waitFor(page, logs, desc, fn, ms = TIMEOUT_MS) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > ms) {
            console.log('  PAGE LOGS (last 25):\n    ' + logs.slice(-25).join('\n    '));
            fail(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(400);
    }
}

function moveTo(page, target, source) {
    return page.evaluate(([t, s]) => {
        window.eventDispatcher?.publish('verify', 'user:regionMove', {
            sourceRegion: s, targetRegion: t, exitName: null,
        }, { initialTarget: 'bottom' });
    }, [target, source]);
}

/** Publish a grant through the resourceChannels debug public function. */
function grant(page, args) {
    return page.evaluate(async (a) => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        const fn = centralRegistry.getPublicFunction?.('resourceChannels', 'grantItem');
        if (typeof fn !== 'function') return null;
        return fn(a);
    }, args);
}

// ────────────────────────────────────────────────────────────────
// JtA leg
// ────────────────────────────────────────────────────────────────
async function verifyJtaLeg() {
    console.log('━━ jta item leg:', JTA_URL);
    const { page, logs } = await makePage(JTA_URL);

    const jtaWin = () => page.evaluate(() =>
        typeof document.querySelector('iframe.jtasw-iframe')?.contentWindow?.grantItem === 'function');
    await waitFor(page, logs, 'jta iframe booted with the grantItem hook', jtaWin, 45000);
    console.log('  ✓ fork booted; window.grantItem present (Fork 1.12)');

    const startRegion = await page.evaluate(async () => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        return getGameStateSingleton()?.getCurrentRegion?.() ?? 'Menu';
    });
    await moveTo(page, JTA_REGION, startRegion);
    await waitFor(page, logs, 'jta region active (game clock running)', () => page.evaluate(() =>
        document.querySelector('iframe.jtasw-iframe')?.contentWindow?.isGameLoopPaused?.() === false), 30000);
    console.log(`  ✓ entered ${JTA_REGION}`);

    // (1) declaration ↔ live catalog.
    const { declared, liveShareable, artifactName } = await page.evaluate(async () => {
        const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
        const win = document.querySelector('iframe.jtasw-iframe').contentWindow;
        const catalog = win.getAllItems();
        return {
            declared: substrateRegistry.get('jta')?.sharing?.items?.getTypes?.() ?? [],
            liveShareable: catalog.filter((it) => !it.isArtifact).map((it) => it.name),
            artifactName: catalog.find((it) => it.isArtifact)?.name ?? null,
        };
    });
    if (JSON.stringify([...declared].sort()) !== JSON.stringify([...liveShareable].sort())) {
        fail(`declared types drift from live catalog:\n  declared=${JSON.stringify(declared)}\n  live=${JSON.stringify(liveShareable)}`);
    }
    console.log(`  ✓ declaration matches the live catalog minus artifacts (${declared.length} types)`);

    const itemName = declared.includes('Food') ? 'Food' : declared[0];
    const countOf = () => page.evaluate((name) => {
        const win = document.querySelector('iframe.jtasw-iframe').contentWindow;
        const type = win.getAllItems().find((it) => it.name === name)?.type;
        return win.getFullState().items.find((it) => it.type === type)?.count ?? 0;
    }, itemName);
    const before = await countOf();

    // (2) grants from host and from a fellow substrate.
    if (await grant(page, { to: 'jta', from: 'host', itemType: itemName, count: 2 }) !== true) {
        fail('host grant not accepted by the bus');
    }
    await waitFor(page, logs, `'${itemName}' count ${before + 2} after host grant`, async () =>
        await countOf() === before + 2, 10000);
    if (await grant(page, { to: 'jta', from: 'omsi', itemType: itemName, count: 1 }) !== true) {
        fail('omsi-sourced grant not accepted by the bus');
    }
    await waitFor(page, logs, `'${itemName}' count ${before + 3} after omsi grant`, async () =>
        await countOf() === before + 3, 10000);
    console.log(`  ✓ grants landed: '${itemName}' ${before} → ${before + 3} (from host + from omsi)`);

    // (3) rejections.
    if (await grant(page, { to: 'jta', from: 'host', itemType: artifactName, count: 1 }) !== false) {
        fail(`artifact grant '${artifactName}' was not rejected`);
    }
    if (await grant(page, { to: 'jta', from: 'host', itemType: 'No Such Item', count: 1 }) !== false) {
        fail('unknown-type grant was not rejected');
    }
    if (await countOf() !== before + 3) fail('rejected grants changed the inventory');
    console.log('  ✓ artifact + unknown-type grants rejected at the bus');

    // (4) D4: the game's own energy reset wipes granted items (fresh
    // browser context ⇒ fresh save ⇒ no keep-modifying perks).
    await page.evaluate(() =>
        document.querySelector('iframe.jtasw-iframe').contentWindow.doEnergyReset());
    await waitFor(page, logs, 'granted items wiped by the native energy reset', async () =>
        await countOf() === 0, 15000);
    console.log('  ✓ native energy reset wiped the granted items (keep formula, D4)');

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) fail('page errors:\n  ' + errors.join('\n  '));
    await page.close();
    console.log('  JTA LEG: OK');
}

// ────────────────────────────────────────────────────────────────
// Omsi leg
// ────────────────────────────────────────────────────────────────
async function verifyOmsiLeg() {
    console.log('━━ omsi item leg:', OMSI_URL);
    const { page, logs } = await makePage(OMSI_URL);

    const omsiEval = (code) => page.evaluate((c) => {
        const win = document.querySelector('iframe.omsisw-iframe')?.contentWindow;
        if (!win) throw new Error('omsi iframe not mounted');
        return win.eval(c);
    }, code);

    // __omsiBridge is set at the END of the bridge's main(), after all
    // subscriptions — its presence means the crossSubstrate handler is
    // live. Deliberately NO region entry: the resources bag is global
    // engine state and the handler is not activity-gated (eager
    // delivery over a pending queue).
    await waitFor(page, logs, 'omsi engine booted + bridge connected', () => page.evaluate(() => {
        const win = document.querySelector('iframe.omsisw-iframe')?.contentWindow;
        if (!win?.__omsiBridge) return false;
        try {
            return win.eval('typeof addResource === "function" && typeof resources === "object"');
        } catch { return false; }
    }), 45000);
    console.log('  ✓ engine booted; bridge connected (no region entry — eager delivery)');

    // (1) declaration ↔ engine numerics.
    const declared = await page.evaluate(async () => {
        const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
        return [...(substrateRegistry.get('omsi')?.sharing?.items?.types ?? [])];
    });
    const liveNumerics = await omsiEval(
        'Object.keys(resourcesTemplate).filter((k) => typeof resourcesTemplate[k] === "number")');
    if (JSON.stringify([...declared].sort()) !== JSON.stringify([...liveNumerics].sort())) {
        fail(`declared types drift from the engine's numeric bag:\n  declared=${JSON.stringify(declared)}\n  live=${JSON.stringify(liveNumerics)}`);
    }
    console.log(`  ✓ declaration matches the engine's numeric resources bag (${declared.length} types)`);

    // (2) grants from host and from a fellow substrate.
    const goldBefore = await omsiEval('resources.gold');
    if (await grant(page, { to: 'omsi', from: 'host', itemType: 'gold', count: 5 }) !== true) {
        fail('host grant not accepted by the bus');
    }
    await waitFor(page, logs, `resources.gold ${goldBefore + 5} after host grant`, async () =>
        await omsiEval('resources.gold') === goldBefore + 5, 10000);
    if (await grant(page, { to: 'omsi', from: 'jta', itemType: 'gold', count: 2 }) !== true) {
        fail('jta-sourced grant not accepted by the bus');
    }
    await waitFor(page, logs, `resources.gold ${goldBefore + 7} after jta grant`, async () =>
        await omsiEval('resources.gold') === goldBefore + 7, 10000);
    console.log(`  ✓ grants landed: gold ${goldBefore} → ${goldBefore + 7} (from host + from jta)`);

    // (3) rejections.
    if (await grant(page, { to: 'omsi', from: 'host', itemType: 'glasses', count: 1 }) !== false) {
        fail('boolean-flag grant was not rejected');
    }
    if (await grant(page, { to: 'omsi', from: 'host', itemType: 'noSuchResource', count: 1 }) !== false) {
        fail('unknown-type grant was not rejected');
    }
    if (await omsiEval('resources.gold') !== goldBefore + 7) fail('rejected grants changed the bag');
    if (await omsiEval('resources.glasses') !== false) fail('boolean flag was touched');
    console.log('  ✓ boolean-flag + unknown-type grants rejected at the bus');

    // (4) D4: the game's own loop restart wipes the per-loop bag.
    await omsiEval('IdleLoopsManaged.restartLoop()');
    await waitFor(page, logs, 'granted gold wiped by the native loop reset', async () =>
        await omsiEval('resources.gold') === 0, 15000);
    console.log('  ✓ native loop reset wiped the granted resources (resetResources, D4)');

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) fail('page errors:\n  ' + errors.join('\n  '));
    await page.close();
    console.log('  OMSI LEG: OK');
}

// ────────────────────────────────────────────────────────────────
// JtA outbound (foreign-award) leg — P2 slice 4, Fork 1.13
// ────────────────────────────────────────────────────────────────
async function verifyJtaOutboundLeg() {
    console.log('━━ jta outbound foreign-award leg:', SCHED_URL);
    // Schedule facts come from the committed preset on disk (deterministic).
    const rules = JSON.parse(readFileSync(SCHED_RULES, 'utf8'));
    const playerId = Object.keys(rules.preset_sidecars)[0];
    const payloads = Object.entries(rules.preset_sidecars[playerId])
        .map(([r, sc]) => [r, sc.playable_payload ?? sc]);
    const dataset = payloads.map(([, p]) => p.jta_dataset).find(Boolean);
    const task = dataset?.zones[0].tasks.find((t) => t.item_schedule);
    if (!task) fail('preset dataset carries no scheduled zone-0 task');
    const f = task.item_schedule[1];
    if (!(f && f.substrate === 'omsi' && f.type === 'gold' && f.count === 2)) {
        fail(`unexpected foreign entry at rep 1: ${JSON.stringify(f)}`);
    }
    const region0 = payloads.find(([, p]) => p.jtaZone === 0)[0];
    const originalName = dataset.items[task.item].name;
    console.log(`  scheduled task ${task.id} "${task.name}": rep 0 '${originalName}', rep 1 omsi/gold x2`);

    const { page, logs } = await makePage(SCHED_URL);
    await waitFor(page, logs, 'jta iframe booted with Fork 1.13 hooks', () => page.evaluate(() => {
        const win = document.querySelector('iframe.jtasw-iframe')?.contentWindow;
        return typeof win?.setForeignAwardCallback === 'function'
            && typeof win?.performTask === 'function';
    }), 45000);
    console.log('  ✓ fork booted; setForeignAwardCallback present (Fork 1.13)');

    // Fresh game: clear the dataset-keyed substrate save slots BEFORE the
    // region entry re-initializes against them (idempotent reruns — a stale
    // save would resume the task at reps >= 2).
    await page.evaluate(() => {
        const win = document.querySelector('iframe.jtasw-iframe').contentWindow;
        for (const k of Object.keys(win.localStorage)) {
            if (k.startsWith('incrementalGameSave_substrate')) win.localStorage.removeItem(k);
        }
    });
    const startRegion = await page.evaluate(async () => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        return getGameStateSingleton()?.getCurrentRegion?.() ?? 'Menu';
    });
    await moveTo(page, region0, startRegion);
    await waitFor(page, logs, 'jta region active (game clock running)', () => page.evaluate(() =>
        document.querySelector('iframe.jtasw-iframe')?.contentWindow?.isGameLoopPaused?.() === false), 30000);
    console.log(`  ✓ entered ${region0} (zone 0) with a fresh save`);

    const jtaEval = (fn, arg) => page.evaluate(([body, a]) => {
        const win = document.querySelector('iframe.jtasw-iframe').contentWindow;
        // eslint-disable-next-line no-new-func
        return new win.Function('win', 'arg', body)(win, a);
    }, [fn, arg]);
    const itemEnum = await jtaEval(
        'return (win.getAllItems() ?? []).find((it) => it.name === arg)?.type ?? null;', originalName);
    if (itemEnum == null) fail(`'${originalName}' missing from the live catalog`);
    const localCount = () => jtaEval(
        'return (win.getFullState().items ?? []).find((it) => it.type === arg)?.count ?? 0;', itemEnum);
    const omsiGold = () => page.evaluate(() => {
        const win = document.querySelector('iframe.omsisw-iframe')?.contentWindow;
        return win ? win.eval('resources.gold') : null;
    });
    await waitFor(page, logs, 'omsi iframe live (S1 eager boot)', async () => (await omsiGold()) !== null, 45000);
    const goldBefore = await omsiGold();
    const localBefore = await localCount();
    console.log(`  before: local '${originalName}' x${localBefore}, omsi gold ${goldBefore}`);

    // Rep 0: original lands locally; nothing crosses.
    const s0 = await jtaEval('return win.performTask(arg);', task.id);
    if (s0?.success !== true) fail(`rep 0 did not start: ${JSON.stringify(s0)}`);
    await waitFor(page, logs, 'rep 0 deposited the original item locally',
        async () => (await localCount()) === localBefore + 1, 30000);
    if ((await omsiGold()) !== goldBefore) fail('rep 0 leaked a cross-substrate grant');
    console.log('  ✓ rep 0: original item deposited locally, nothing crossed');

    // Rep 1: foreign — nothing locally, omsi/gold x2 over the full bus.
    const s1 = await jtaEval('return win.performTask(arg);', task.id);
    if (s1?.success !== true) fail(`rep 1 did not start: ${JSON.stringify(s1)}`);
    await waitFor(page, logs, 'omsi bag gained gold x2 from the foreign award',
        async () => (await omsiGold()) === goldBefore + 2, 30000);
    if ((await localCount()) !== localBefore + 1) fail('foreign rep also deposited locally');
    console.log('  ✓ rep 1: nothing local, omsi bag +2 gold (bridge → router → omsi arrival)');

    await page.close();
    console.log('  JTA OUTBOUND LEG: OK');
}

try {
    await verifyJtaLeg();
    await verifyOmsiLeg();
    await verifyJtaOutboundLeg();
    await browser.close();
    console.log('\nVERIFY ITEM CHANNELS: OK');
    process.exit(0);
} catch (e) {
    console.log('\n‼ FAILURE:', e.message);
    await browser.close();
    process.exit(1);
}
