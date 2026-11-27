// AN-TIME-4 screenshots: load The Same Monday preset in the app, shoot at load and mid-day (one visit performed).
// usage: node shots.mjs <worktree> <port> <outdir>
import { createRequire } from 'node:module';
const [wt, port, out] = process.argv.slice(2);
const require = createRequire(`${wt}/package.json`);
const { chromium } = require('@playwright/test');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() === 404) errors.push('404 ' + r.url()); });
const t0 = Date.now();
await page.goto(`http://localhost:${port}/frontend/?game=action_nodes_same_monday&seed=1`, { waitUntil: 'load', timeout: 180000 });
const mod = (p) => `/frontend/modules/${p}`;

async function until(label, fn, arg, ms = 300000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        try { if (await page.evaluate(fn, arg)) return; } catch { /* page still booting */ }
        await page.waitForTimeout(1000);
    }
    throw new Error(`timed out: ${label}`);
}
await until('runtime', async (paths) => {
    const { getActionNodesRuntime } = await import(paths.rt);
    return getActionNodesRuntime().isLoaded() && getActionNodesRuntime().model?.block?.graph_id === 'same-monday';
}, { rt: mod('actionNodes/actionNodesRuntime.js') });
await until('gameState', async (p) => { (await import(p)).getGameStateSingleton(); return true; }, mod('gameState/singleton.js'));
console.log('gameState up after', Date.now() - t0, 'ms');
await page.waitForTimeout(3000);
const state = async () => page.evaluate(async (paths) => {
    const { getActionNodesRuntime } = await import(paths.rt);
    const { getGameStateSingleton } = await import(paths.gs);
    const rt = getActionNodesRuntime();
    const gs = getGameStateSingleton();
    return { clock: rt.clock, clockLine: rt.clockLine?.(gs.getCurrentMana()), mana: gs.getCurrentMana(), max: gs.getMaxMana(),
        loopMode: gs.isLoopModeActive, text: document.body.innerText.match(/(Time|Mana)[^\n]{0,60}/g)?.slice(0, 6) };
}, { rt: mod('actionNodes/actionNodesRuntime.js'), gs: mod('gameState/singleton.js') });
await page.locator('.lm_tab', { hasText: 'Region Graph' }).first().click();
await page.locator('.lm_tab', { hasText: /^Loops$/ }).first().click().catch(() => {});
await page.getByText('Resources', { exact: true }).first().click().catch((e) => console.log('resources', String(e)));
await page.waitForTimeout(4000);
console.log('at load', JSON.stringify(await state()));
await page.screenshot({ path: `${out}/1-same-monday-at-load.png` });
// Mid-day: queue the move to the harbour office and one act, run the queue.
await page.evaluate(async (paths) => {
    const { getGameStateSingleton } = await import(paths.gs);
    const ls = (await import(paths.ls)).default;
    const gs = getGameStateSingleton();
    gs.updatePath('office', 'monday -> office', 'monday');
    gs.addCustomAction('act', { nodeId: 'office', label: 'Look over the harbour office', regionName: 'office' });
    ls.setAutoRestartQueue?.(false);
    ls.startProcessing();
}, { gs: mod('gameState/singleton.js'), ls: mod('loops/loopStateSingleton.js') });
await until('clock >= 1', async (rt) => (await import(rt)).getActionNodesRuntime().clock >= 1, mod('actionNodes/actionNodesRuntime.js'));
const lsInfo = async () => page.evaluate(async (p) => { const ls = (await import(p)).default; const gs = (await import('/frontend/modules/gameState/singleton.js')).getGameStateSingleton();
    return { processing: ls.isProcessing, idx: ls.currentQueueIndex ?? ls.queueIndex, queue: (gs.getPath?.() ?? []).map((e) => e.actionName ?? e.type + ':' + (e.destinationRegion ?? e.region ?? '')), mana: gs.getCurrentMana(), cur: ls.currentAction?.actionName ?? ls.currentAction?.type ?? null }; }, mod('loops/loopStateSingleton.js'));
console.log('just after', JSON.stringify(await lsInfo()));
await page.waitForTimeout(1500);
console.log('1.5s later', JSON.stringify(await lsInfo()));
// Pause so the screenshot holds mid-day.
await page.evaluate(async (p) => { (await import(p)).default.stopProcessing?.(); }, mod('loops/loopStateSingleton.js'));
console.log('mid-day', JSON.stringify(await state()));
await page.screenshot({ path: `${out}/2-same-monday-mid-day.png` });
console.log('page errors', errors.length, JSON.stringify(errors.slice(0, 5)));
await browser.close();
