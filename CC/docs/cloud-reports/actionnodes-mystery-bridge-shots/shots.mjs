// AN-MYST-1 screenshot: The Same Monday loaded, the Mystery Game panel framing the real page, two visits performed,
// the page holding the papers they found (`mystery:state.papers`) on day `loop`.
// ⚠ The ActionNodes world cannot be hosted on a server (it has no Python world), and the page starts only on a
// CONNECTED state. So for this picture ONLY the client's getConnectionInfo is answered "connected" in the page; the
// papers, the loop and the version are the host's real answers. No test relies on this.
// usage: node shots.mjs <worktree> <port> <outdir>
import { createRequire } from 'node:module';
const [wt, port, out] = process.argv.slice(2);
const require = createRequire(`${wt}/package.json`);
const { chromium } = require('@playwright/test');
const { takeBoxLock } = await import(`${wt}/scripts/procgen/boxLock.js`);
takeBoxLock({ name: 'actionnodes-mystery-bridge shots.mjs', kind: 'browser', repo: wt, waitSec: 3600 });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${port}/frontend/?game=action_nodes_same_monday&seed=1`, { waitUntil: 'load', timeout: 180000 });
const mod = (p) => `/frontend/modules/${p}`;
async function until(label, fn, arg, ms = 300000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        try { if (await page.evaluate(fn, arg)) return; } catch { /* booting */ }
        await page.waitForTimeout(1000);
    }
    throw new Error(`timed out: ${label}`);
}
await until('runtime', async (rt) => (await import(rt)).getActionNodesRuntime().isLoaded(), mod('actionNodes/actionNodesRuntime.js'));
await page.waitForTimeout(3000);
// The picture's one stand-in: the connection (see the header).
const seen = await page.evaluate(async (paths) => {
    const { centralRegistry } = await import(paths.cr);
    const orig = centralRegistry.getPublicFunction.bind(centralRegistry);
    centralRegistry.getPublicFunction = (m, f) => (m === 'client' && f === 'getConnectionInfo'
        ? () => ({ isConnected: true, isHandshakeComplete: true, slot: 1, team: 0 }) : orig(m, f));
    window.__shotStates = [];
    (await import(paths.bus)).default.subscribe('mystery:state', (s) => window.__shotStates.push(s), 'shots');
    await window.moduleManagerApi.enableModule('mysteryArchipelago');
    return true;
}, { cr: '/frontend/app/core/centralRegistry.js', bus: '/frontend/app/core/eventBus.js' });
await until('page asked', () => window.__shotStates.length > 0);
// Two visits from the start: the harbour office, then the Ship inn.
await page.evaluate(async (paths) => {
    const { getGameStateSingleton } = await import(paths.gs);
    const ls = (await import(paths.ls)).default;
    const gs = getGameStateSingleton();
    ls.setAutoRestartQueue?.(false);
    gs.updatePath('office', 'monday -> office', 'monday');
    gs.addCustomAction('act', { nodeId: 'office', label: 'Look over the harbour office', regionName: 'office' });
    gs.updatePath('monday', 'office -> monday', 'office');
    gs.updatePath('inn', 'monday -> inn', 'monday');
    gs.addCustomAction('act', { nodeId: 'inn', label: 'Ask at the Ship inn', regionName: 'inn' });
    ls.startProcessing();
}, { gs: mod('gameState/singleton.js'), ls: mod('loops/loopStateSingleton.js') });
await until('two papers', () => (window.__shotStates.at(-1)?.papers ?? []).length >= 2, undefined, 60000);
await page.locator('.lm_tab', { hasText: 'Mystery Game' }).first().click().catch((e) => console.log('tab', String(e)));
await page.waitForTimeout(5000);
const last = await page.evaluate(() => window.__shotStates.at(-1));
console.log('last mystery:state', JSON.stringify(last));
await page.screenshot({ path: `${out}/1-same-monday-page-holds-papers.png` });
console.log('page errors', errors.length, JSON.stringify(errors.slice(0, 5)));
await browser.close();
