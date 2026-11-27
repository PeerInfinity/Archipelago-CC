/**
 * Region Graph badge-resize shot and offsets (region-graph-badge-resize).
 *
 * seedling_atlas (the in-app row's preset), desktop 1600 × 1000, subRegionView = collapsible, zoomed onto a closed
 * group node. The probe then gives that node the map look's size bypass for a square cell (`MAP_NODE_LONG_PX` ×
 * `MAP_NODE_LONG_PX`, what `mapNodeSize` gives at aspect 1; `mapLookLayer.js` `_applyNodes` sets the same keys) — a resize that fires no
 * `position` and no `viewport` event — waits two frames and measures the badge's centre against the node's rendered
 * top-right corner. Then it removes the bypass (the map look turning off) and measures again.
 *
 *   <out>/<tag>-resized-zoom.png    the badge on the resized node, zoomed in
 *
 * Run it once on the layer before the fix (`--tag=before`) and once after (`--tag=after`); it prints JSON:
 * { tag, group, zoom, node, settled, resize, resized: {dx, dy}, restored: {dx, dy}, errors }.
 *
 * Usage: node scripts/dev/shot-region-graph-badge-resize.mjs --port=8143 --out=CC/docs/region-graph/badge-resize-shots --tag=after
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
};
const PORT = arg('port', process.env.TEST_PORT || '8000');
const OUT = arg('out', 'CC/docs/region-graph/badge-resize-shots');
const TAG = arg('tag', 'after');
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-badge-resize.mjs', kind: 'browser' });

const KEY = 'moduleSettings.regionGraph.subRegionView';

const frames = (page, n = 2) => page.evaluate((k) => new Promise((r) => {
    let left = k;
    const step = () => { left -= 1; if (left <= 0) r(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
}), n);

/** The badge of the probed group vs its node's rendered top-right corner (panel px). */
const offset = (page) => page.evaluate(() => {
    const cy = document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy;
    const id = window.__probeNodeId;
    const node = cy.getElementById(id);
    const btn = [...document.querySelectorAll('.rg-group-badge')].find((b) => b.dataset.groupKey === node.data('groupKey'));
    const r = btn.getBoundingClientRect();
    const rbb = node.renderedBoundingBox({ includeLabels: false });
    const at = { x: parseFloat(btn.style.left) + r.width / 2, y: parseFloat(btn.style.top) + r.height / 2 };
    return { dx: +(at.x - rbb.x2).toFixed(2), dy: +(at.y - rbb.y1).toFixed(2), rendered: { w: +rbb.w.toFixed(1), h: +rbb.h.toFixed(1) } };
});

const out = { tag: TAG, errors: [] };
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e)));
    await page.goto(`${HOST}/frontend/?game=seedling_atlas&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(async () => {
        const { stateManagerProxySingleton: sm } = await import('/frontend/modules/stateManager/index.js');
        return (sm.getStaticData?.()?.regions?.size ?? 0) > 0 && !!sm.getLatestStateSnapshot?.();
    }, null, { timeout: 90000, polling: 500 });
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    const tab = page.locator('.lm_tab', { hasText: 'Region Graph' }).first();
    await tab.click();
    await tab.evaluate((t) => t.closest('.lm_stack')?.querySelector('.lm_maximise')?.click());
    await page.waitForFunction(() => !!document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy?.nodes('.region').length,
        null, { timeout: 90000, polling: 200 });
    await page.evaluate(async (k) => {
        const { default: sm } = await import('/frontend/app/core/settingsManager.js');
        await sm.updateSetting(k, 'collapsible');
    }, KEY);
    await page.waitForFunction(() => document.querySelectorAll('.rg-group-badge').length > 0, null, { timeout: 90000, polling: 200 });
    // Let the switch's layout (if any) finish: positions unchanged for 3 × 500 ms.
    let last = null; let same = 0;
    for (let i = 0; i < 60 && same < 3; i += 1) {
        await page.waitForTimeout(500);
        const now = await page.evaluate(() => JSON.stringify(document.querySelector('.region-graph-panel-container div[id^="cy-"]')._cyreg.cy.nodes().map((n) => n.position())));
        same = now === last ? same + 1 : 0;
        last = now;
    }
    Object.assign(out, await page.evaluate(() => {
        const cy = document.querySelector('.region-graph-panel-container div[id^="cy-"]')._cyreg.cy;
        const node = cy.nodes('.region-group-merged').sort((a, b) => (a.data('groupKey') < b.data('groupKey') ? -1 : 1))[0];
        window.__probeNodeId = node.id();
        cy.zoom(3);
        cy.center(node);
        return { group: node.data('groupKey'), zoom: cy.zoom(), node: { before: { w: node.width(), h: node.height() } } };
    }));
    await frames(page);
    out.settled = await offset(page);
    out.resize = await page.evaluate(async () => {
        const { MAP_NODE_LONG_PX } = await import('/frontend/modules/regionGraph/mapLookLayer.js');
        const cy = document.querySelector('.region-graph-panel-container div[id^="cy-"]')._cyreg.cy;
        const node = cy.getElementById(window.__probeNodeId);
        let moved = 0;
        const count = () => { moved += 1; };
        cy.on('position viewport', count);
        // A square Region Map cell (aspect 1): `mapNodeSize` gives MAP_NODE_LONG_PX × MAP_NODE_LONG_PX.
        const size = { width: MAP_NODE_LONG_PX, height: MAP_NODE_LONG_PX };
        node.style(size);
        cy.off('position viewport', count);
        return { size, positionOrViewportEvents: moved };
    });
    await frames(page);
    out.resized = await offset(page);
    await page.screenshot({ path: join(OUT, `${TAG}-resized-zoom.png`), clip: await page.evaluate(() => {
        const cy = document.querySelector('.region-graph-panel-container div[id^="cy-"]')._cyreg.cy;
        const rbb = cy.getElementById(window.__probeNodeId).renderedBoundingBox({ includeLabels: false });
        const c = cy.container().getBoundingClientRect();
        return { x: c.left + rbb.x1 - 60, y: c.top + rbb.y1 - 60, width: rbb.w + 120, height: rbb.h + 120 };
    }) });
    await page.evaluate(() => {
        const cy = document.querySelector('.region-graph-panel-container div[id^="cy-"]')._cyreg.cy;
        cy.getElementById(window.__probeNodeId).removeStyle('width height');
    });
    await frames(page);
    out.restored = await offset(page);
    await context.close();
} finally {
    await browser.close();
}
console.log(JSON.stringify(out, null, 1));
