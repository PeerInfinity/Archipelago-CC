/**
 * Region Map maze-hooks screenshots (region-map-maze-hooks). Drives the running app with Playwright on
 * `procgen_topdown/AP_1` (nine maze levels with Seedling names):
 *
 *   node scripts/dev/shot-region-map-maze-hooks.mjs --port=8143 --out=<dir> --tag=before|after
 *
 *   <tag>-region-map-fit.png             the Region Map at Fit all, cells sized by level
 *   <tag>-region-map-<Level>.png         zoomed on one level's art (BlackCastle, Overworld): the location squares
 *   <tag>-region-graph-direction.png     the Region Graph, merged + map look, the Direction-aware layout (default settings)
 *   <tag>-phone-390-region-map.png       a 390 × 844 phone (the app's real mobile layout), the Region Map tab at Fit all
 *   <tag>-measure.json                   per view: the maze cells' extents and squares, the Direction-aware report, page errors
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt = null) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out', null);
const TAG = arg('tag', 'shot');
const RULES = './presets/procgen_topdown/AP_1/AP_1_rules.json';
const LEVELS = ['BlackCastle', 'Overworld'];
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map-maze-hooks.mjs', kind: 'browser' });
const HOST = `http://localhost:${PORT}`;
const URL = `${HOST}/frontend/?rules=${encodeURIComponent(RULES)}`;

const out = { rules: RULES, errors: [] };
const waitRules = (page) => page.waitForFunction(async () => {
    const sm = await import('/frontend/modules/stateManager/index.js');
    return (sm.stateManagerProxySingleton.getStaticData()?.regions?.size ?? 0) > 0;
}, null, { timeout: 90000, polling: 250 });
/** The Region Map panel's maze cells as it holds them: extent, framed size, squares. */
const mapStats = (page) => page.evaluate(() => {
    const p = window.__rm;
    const d = p.getDebugState();
    return {
        cellSize: d.settings.cellSize,
        cells: [...p.model.cells.values()].map((c) => ({
            key: c.key, extent: c.extent, frame: d.frames[c.key] ? [d.frames[c.key].w, d.frames[c.key].h] : null,
            tileSource: c.tileSource, squares: c.tiles.map((t) => `${t.location}@${t.x},${t.y}`),
        })),
        unplaced: d.unplaced.length,
        painted: { cells: d.lastPaint?.cells, squares: d.lastPaint?.squares, art: d.lastPaint?.art },
    };
});

const browser = await chromium.launch();
try {
    // ── desktop: the Region Map ──
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e)));
    await page.goto(`${URL}&layout=desktop`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    await waitRules(page);
    await page.evaluate(async () => {
        const sm = (await import('/frontend/app/core/settingsManager.js')).default;
        await sm.updateSetting('moduleSettings.regionMap.cellSize', 'level');
        const pm = (await import('/frontend/app/core/panelManager.js')).default;
        const rm = await import('/frontend/modules/regionMap/index.js');
        if (!rm.getPanelInstances().length) await pm.createPanelForComponent('regionMapPanel', 'Region Map', 2);
        const p = rm.getPanelInstances()[0];
        const host = document.createElement('div');
        host.id = '__rmHost';
        Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#000' });
        document.body.appendChild(host);
        host.appendChild(p.root);
        window.__rm = p;
    });
    await page.waitForFunction(() => window.__rm?.getDebugState()?.lastPaint?.cells > 0, null, { timeout: 30000, polling: 100 });
    await page.evaluate(() => window.__rm.fitAll());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, `${TAG}-region-map-fit.png`) });
    out.regionMap = await mapStats(page);
    for (const level of LEVELS) {
        await page.evaluate((key) => {
            const p = window.__rm;
            const f = p.frames.get(key);
            p.setCamera({ x: f.x + f.w / 2, y: f.y + f.h / 2, zoom: Math.min(p.vp.w / f.w, p.vp.h / f.h) * 0.8 });
        }, level);
        await page.waitForTimeout(1000);
        await page.screenshot({ path: join(OUT, `${TAG}-region-map-${level}.png`) });
    }
    await page.evaluate(() => document.getElementById('__rmHost')?.remove());

    // ── desktop: the Region Graph, merged + map look, Direction-aware ──
    await page.evaluate(async () => {
        const sm = (await import('/frontend/app/core/settingsManager.js')).default;
        await sm.updateSetting('moduleSettings.regionGraph.subRegionView', 'merged');
        const pm = (await import('/frontend/app/core/panelManager.js')).default;
        await pm.createPanelForComponent('regionGraphPanel', 'Region Graph', 2);
    });
    await page.waitForFunction(() => document.querySelectorAll('.region-graph-panel-container').length > 0, null, { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate(async () => {
        const sm = (await import('/frontend/app/core/settingsManager.js')).default;
        await sm.updateSetting('moduleSettings.regionGraph.nodeLook', 'map');
        const el = [...document.querySelectorAll('.region-graph-panel-container')].pop();
        Object.assign(el.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#111' });
        window.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() => [...document.querySelectorAll('.region-graph-panel-container .rg-map-look-canvas')].some((c) => Number(c.dataset.cells ?? 0) > 0),
        null, { timeout: 30000, polling: 100 });
    out.direction = await page.evaluate(async () => {
        const layer = [...document.querySelectorAll('.region-graph-panel-container .rg-map-look-canvas')].map((c) => c.mapLook).find(Boolean);
        const ui = layer.ui;
        ui.cy.resize();
        const D = await import('/frontend/modules/regionGraph/directionLayout.js');
        ui.directionSettings = D.normaliseDirectionSettings();
        const report = ui.layoutControlsManager.runDirectionLayout({ animate: false });
        const { nodes, edges, prefs } = ui.layoutControlsManager.directionLayoutInputs();
        const pos = new Map(nodes.map((n) => [n.id, ui.cy.getElementById(n.id).position()]));
        const a = D.angleErrors(edges, prefs, pos);
        ui.cy.fit(40);
        return { counts: report.counts, preferred: prefs.size, mean: a.mean, max: a.max, n: a.n, overlaps: D.overlapCount(nodes, pos),
            nodeSizes: nodes.map((n) => `${n.id}:${n.w}x${n.h}`) };
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, `${TAG}-region-graph-direction.png`) });
    await context.close();

    // ── phone: 390 × 844, the app's real mobile layout ──
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const pp = await phone.newPage();
    pp.on('pageerror', (e) => out.errors.push(`phone: ${String(e)}`));
    await pp.goto(URL, { waitUntil: 'domcontentloaded' });
    await pp.waitForSelector('.mobile-tab', { timeout: 90000 });
    await waitRules(pp);
    const tabSel = '.mobile-tab[data-component-type="regionMapPanel"]';
    for (let k = 0; k < 6 && !(await pp.$(tabSel)); k += 1) await pp.tap('.mobile-nav-left');
    await pp.tap(tabSel);
    await pp.waitForFunction(async () => {
        const rm = await import('/frontend/modules/regionMap/index.js');
        const p = rm.getPanelInstances()[0];
        window.__rm = p;
        return p && p.root.offsetParent !== null && (p.getDebugState().lastPaint?.cells ?? 0) > 0;
    }, null, { timeout: 30000, polling: 200 });
    await pp.evaluate(() => window.__rm.fitAll());
    await pp.waitForTimeout(1500);
    out.phone = await mapStats(pp);
    await pp.screenshot({ path: join(OUT, `${TAG}-phone-390-region-map.png`) });
    await phone.close();
} finally {
    await browser.close();
}
writeFileSync(join(OUT, `${TAG}-measure.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ errors: out.errors, direction: out.direction && { ...out.direction, nodeSizes: undefined }, unplaced: out.regionMap?.unplaced }));
