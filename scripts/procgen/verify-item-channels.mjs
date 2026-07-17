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
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-item-channels.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const JTA_URL = 'http://localhost:8000/frontend/?game=jta_substrate_test&seed=1';
const JTA_REGION = 'The Village';
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

try {
    await verifyJtaLeg();
    await browser.close();
    console.log('\nVERIFY ITEM CHANNELS: OK');
    process.exit(0);
} catch (e) {
    console.log('\n‼ FAILURE:', e.message);
    await browser.close();
    process.exit(1);
}
