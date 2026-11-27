/**
 * Region Map painter-throws screenshots (region-map-painter-throws). Drives the running app with Playwright on the
 * preset the throwing TT rows load (`procgen_topdown/AP_1`, whose regions are all maze levels):
 *
 *   node scripts/dev/shot-region-map-painter-throws.mjs --port=8145 --out=<dir> --tag=before|after
 *
 *   <tag>-region-map-fit.png           the Region Map at Fit all
 *   <tag>-region-map-<Level>.png       zoomed on one level (BlackCastle, CreditsRoom)
 *   <tag>-region-graph-map-look.png    the Region Graph, nodeLook = map, subRegionView = merged
 *   <tag>-measure.json                 the `a painter threw` warnings counted per view, and the page errors
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
const LEVELS = ['BlackCastle', 'CreditsRoom'];
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map-painter-throws.mjs', kind: 'browser' });
const HOST = `http://localhost:${PORT}`;

const out = { rules: RULES, warnings: {}, errors: [] };
let warnings = 0;
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e)));
    page.on('console', (m) => { if (m.text().includes('a painter threw')) warnings += 1; });
    const take = (view) => { out.warnings[view] = warnings; warnings = 0; };
    await page.goto(`${HOST}/frontend/?rules=${encodeURIComponent(RULES)}&layout=desktop`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    await page.waitForFunction(async () => {
        const sm = await import('/frontend/modules/stateManager/index.js');
        return (sm.stateManagerProxySingleton.getStaticData()?.regions?.size ?? 0) > 0;
    }, null, { timeout: 90000, polling: 250 });
    take('boot');

    // The Region Map, lifted full-viewport.
    await page.evaluate(async () => {
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
    take('region-map-fit');
    for (const level of LEVELS) {
        await page.evaluate((key) => {
            const p = window.__rm;
            const f = p.frames.get(key); // on the level's ART (`f.x / y / w / h`), not its (larger) cell
            p.setCamera({ x: f.x + f.w / 2, y: f.y + f.h / 2, zoom: Math.min(p.vp.w / f.w, p.vp.h / f.h) * 0.8 });
        }, level);
        await page.waitForTimeout(1000);
        await page.screenshot({ path: join(OUT, `${TAG}-region-map-${level}.png`) });
        take(`region-map-${level}`);
    }
    await page.evaluate(() => document.getElementById('__rmHost')?.remove());

    // The Region Graph's map look (merged), lifted full-viewport.
    await page.evaluate(async () => {
        const sm = (await import('/frontend/app/core/settingsManager.js')).default;
        await sm.updateSetting('moduleSettings.regionGraph.subRegionView', 'merged');
        const pm = (await import('/frontend/app/core/panelManager.js')).default;
        await pm.createPanelForComponent('regionGraphPanel', 'Region Graph', 2);
    });
    // A layout may already hold a (hidden) Region Graph panel: the one just created is the LAST container.
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
    await page.evaluate(() => {
        const el = [...document.querySelectorAll('.region-graph-panel-container')].pop();
        const cy = el.querySelector('div[id^="cy-"]')?._cyreg?.cy;
        cy?.resize();
        cy?.fit(40);
    });
    await page.waitForTimeout(2500);
    out.mapLookCells = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.region-graph-panel-container .rg-map-look-canvas')].map((c) => Number(c.dataset.cells ?? 0))));
    await page.screenshot({ path: join(OUT, `${TAG}-region-graph-map-look.png`) });
    take('region-graph-map-look');
    await context.close();
} finally {
    await browser.close();
}
writeFileSync(join(OUT, `${TAG}-measure.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out));
