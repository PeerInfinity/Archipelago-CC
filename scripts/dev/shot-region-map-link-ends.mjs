/**
 * Region Map link-ends screenshots + the MOBILE-layout measurement (region-map-link-ends) — drives the running app with
 * Playwright and writes PNGs plus `measure-<half>.json`:
 *
 *   node scripts/dev/shot-region-map-link-ends.mjs --port=8143 --out=<dir> [--only=desktop|phone]
 *
 * Desktop (1600 × 1000, the panel lifted full-viewport as `shot-region-map-zoom-links.mjs` does):
 *   seedling_playthrough-fit.png      Fit all: gap marks between neighbours, arrows to the squares' edges
 *   seedling_playthrough-group.png    zoomed on the start level's group
 *   seedling_playthrough-apart.png    one edge transition between two cells that are NOT side by side
 *   alttp-fit.png                     a classic world (generic layout)
 * Phone (390 × 844, isMobile, hasTouch, DPR 3, the app's REAL mobile layout — no `?layout=`, it auto-detects):
 *   phone-390-mobile-tab.png          the Region Map tab open, after a real two-finger pinch
 *   · the tab is present, right after the Region Graph's, and a real tap opens the panel;
 *   · a two-finger pinch on the canvas (CDP `Input.dispatchTouchEvent`, the browser's own recogniser) zooms the map, and
 *     `visualViewport.scale` stays 1; a one-finger drag pans it and scrolls nothing;
 *   · a CONTROL pinch off the canvas, to show the instrument sees a page zoom;
 *   · SAVED layouts (js-22 edit 2): a saved mode blob (`archipelagoToolSuite_modeData_default`, as the JSON panel
 *     saves it) whose `layoutConfig` is a desktop `saveLayout()` dump, without and with the Region Map in it: the tab
 *     count, its neighbours, and the page errors.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt = null) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out', null);
const ONLY = arg('only', null);
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map-link-ends.mjs', kind: 'browser' });
const HOST = `http://localhost:${PORT}`;

const waitRules = (page) => page.waitForFunction(async () => {
    const sm = await import('/frontend/modules/stateManager/index.js');
    return !!sm.getLastRawJsonData()?.rawJsonData && (sm.stateManagerProxySingleton.getStaticData()?.regions?.size ?? 0) > 0;
}, null, { timeout: 90000, polling: 250 });

const settle = async (page) => {
    await page.waitForTimeout(200);
    await page.waitForFunction(async () => {
        const s = (await import('/frontend/modules/flashPanel/seedlingCompositeMap.js')).seedlingCompositeMapStats;
        return s().pending === 0;
    }, null, { timeout: 120000, polling: 250 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(300);
};

const paintStats = (page) => page.evaluate(() => {
    const d = window.__rm.getDebugState();
    const lp = d.lastPaint;
    return { model: { cross: d.links, neighbour: d.neighbourLinks }, drawn: { cross: lp.links, neighbour: lp.neighbourLinks,
        gapMarks: lp.gapMarks, edgeLines: lp.edgeLines, arrowheads: lp.arrowheads }, zoom: d.camera.zoom };
});

async function bootDesktop(context, game) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${HOST}/frontend/?game=${game}&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    await waitRules(page);
    await page.evaluate(async () => {
        const pm = (await import('/frontend/app/core/panelManager.js')).default;
        const rm = await import('/frontend/modules/regionMap/index.js');
        if (!rm.getPanelInstances().length) await pm.createPanelForComponent('regionMapPanel', 'Region Map', 2);
        const p = rm.getPanelInstances()[0];
        const host = document.createElement('div');
        Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#000' });
        document.body.appendChild(host);
        host.appendChild(p.root);
        window.__rm = p;
    });
    await page.waitForFunction(() => window.__rm?.getDebugState()?.lastPaint?.cells > 0, null, { timeout: 30000, polling: 100 });
    return { page, errors };
}

const out = {};
const browser = await chromium.launch();
try {
    if (ONLY !== 'phone') {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const { page, errors } = await bootDesktop(context, 'seedling_playthrough');
        await page.evaluate(() => window.__rm.fitAll());
        await settle(page);
        await page.screenshot({ path: join(OUT, 'seedling_playthrough-fit.png') });
        out.seedling_fit = await paintStats(page);
        await page.evaluate(() => {
            const p = window.__rm;
            const f = p.frames.get(p.model.layout.start);
            p.setCamera({ x: f.cell.x + f.cell.w / 2, y: f.cell.y + f.cell.h / 2, zoom: Math.min(p.vp.w / f.cell.w, p.vp.h / f.cell.h) * 0.3 });
        });
        await settle(page);
        await page.screenshot({ path: join(OUT, 'seedling_playthrough-group.png') });
        out.seedling_group = await paintStats(page);
        // one edge transition between two cells that are not side by side: level_12 ↔ level_95 when present
        out.apart = await page.evaluate(async () => {
            const { linkShape } = await import('/frontend/modules/regionMap/regionMapLinkGeometry.js');
            const p = window.__rm;
            const apart = p.model.neighbourLinks.filter((l) => l.kind === 'join' && linkShape(l, p.frames)?.form === 'line');
            const l = apart.find((x) => [x.from, x.to].sort().join() === 'level_12,level_95') ?? apart[0];
            const a = p.frames.get(l.from).cell;
            const b = p.frames.get(l.to).cell;
            const x0 = Math.min(a.x, b.x); const y0 = Math.min(a.y, b.y);
            const x1 = Math.max(a.x + a.w, b.x + b.w); const y1 = Math.max(a.y + a.h, b.y + b.h);
            p.setCamera({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom: Math.min(p.vp.w / (x1 - x0), p.vp.h / (y1 - y0)) * 0.8 });
            return { from: l.from, to: l.to, apartJoins: apart.length, seg: linkShape(l, p.frames).seg, fromCell: a, toCell: b };
        });
        await settle(page);
        await page.screenshot({ path: join(OUT, 'seedling_playthrough-apart.png') });
        if (errors.length) out.desktopErrors = errors;
        await context.close();
        const c2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const b2 = await bootDesktop(c2, 'alttp');
        await b2.page.evaluate(() => window.__rm.fitAll());
        await settle(b2.page);
        await b2.page.screenshot({ path: join(OUT, 'alttp-fit.png') });
        out.alttp_fit = await paintStats(b2.page);
        if (b2.errors.length) out.alttpErrors = b2.errors;
        await c2.close();
    }
    if (ONLY !== 'desktop') {
        const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
        // The saved layouts: a desktop saveLayout() dump, without and with the Region Map in it.
        const saved = {};
        for (const withMap of [false, true]) {
            const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
            const page = await ctx.newPage();
            await page.goto(`${HOST}/frontend/?game=seedling_playthrough&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('.lm_tab', { timeout: 90000 });
            await waitRules(page);
            saved[withMap ? 'with' : 'without'] = await page.evaluate(async (w) => {
                if (w) {
                    const pm = (await import('/frontend/app/core/panelManager.js')).default;
                    await pm.createPanelForComponent('regionMapPanel', 'Region Map', 2);
                    await new Promise((r) => setTimeout(r, 500));
                }
                const cfg = window.goldenLayoutInstance.saveLayout();
                return { ...cfg, __linkEndsMarker: w ? 'with' : 'without' };
            }, withMap);
            await ctx.close();
        }
        const phoneBoot = async (savedLayout) => {
            const context = await browser.newContext(PHONE);
            if (savedLayout) {
                await context.addInitScript((blob) => {
                    if (!sessionStorage.getItem('__linkEndsSeeded')) {
                        localStorage.setItem('archipelagoToolSuite_modeData_default', blob);
                        sessionStorage.setItem('__linkEndsSeeded', '1');
                    }
                }, JSON.stringify({ modeName: 'default', savedTimestamp: new Date().toISOString(), layoutConfig: savedLayout }));
            }
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (e) => errors.push(String(e)));
            await page.goto(`${HOST}/frontend/?game=seedling_playthrough&seed=1`, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('.mobile-tab', { timeout: 90000 });
            await waitRules(page);
            const state = await page.evaluate(async () => {
                const m = (await import('/frontend/app/core/mobileLayoutManager.js')).default;
                const col = m.columnPanels.find((c) => c.includes('regionMapPanel')) ?? [];
                const i = col.indexOf('regionMapPanel');
                return {
                    mobileLayout: document.body.classList.contains('mobile-layout-active'),
                    marker: m.layoutPresets?.default?.__linkEndsMarker ?? null,
                    regionMapEntries: m.columnPanels.flat().filter((t) => t === 'regionMapPanel').length,
                    column: m.columnPanels.indexOf(col), before: col[i - 1] ?? null, after: col[i + 1] ?? null, index: i, columnSize: col.length,
                    mountedRegionMaps: document.querySelectorAll('.mobile-panel-instance .region-map-canvas').length,
                };
            });
            return { context, page, errors, state };
        };
        // ── fresh: the tab, a real tap, pinch, drag ──
        const { context, page, errors, state } = await phoneBoot(null);
        const tabSel = '.mobile-tab[data-component-type="regionMapPanel"]';
        for (let k = 0; k < 4 && !(await page.$(tabSel)); k += 1) await page.tap('.mobile-nav-left');
        const tabsShown = await page.evaluate(() => [...document.querySelectorAll('.mobile-tab')].map((t) => t.dataset.componentType));
        await page.tap(tabSel);
        await page.waitForFunction(async () => {
            const rm = await import('/frontend/modules/regionMap/index.js');
            const p = rm.getPanelInstances()[0];
            window.__rm = p;
            return p && p.root.offsetParent !== null && (p.getDebugState().lastPaint?.cells ?? 0) > 0;
        }, null, { timeout: 30000, polling: 200 });
        await page.evaluate(() => window.__rm.fitAll());
        await settle(page);
        const cdp = await context.newCDPSession(page);
        const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
            type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })),
        });
        const read = () => page.evaluate(async () => {
            const m = (await import('/frontend/app/core/mobileLayoutManager.js')).default;
            const p = window.__rm;
            const d = p.getDebugState();
            const scrollers = [...document.querySelectorAll('.mobile-panel-content, .mobile-panel-instance, .mobile-layout-container')]
                .map((e) => e.scrollTop + e.scrollLeft);
            return {
                scale: window.visualViewport?.scale ?? null, pageX: window.scrollX, pageY: window.scrollY,
                docScroll: document.scrollingElement?.scrollTop ?? 0, panelScroll: p.root.scrollTop, scrollers,
                zoom: d.camera.zoom, camX: d.camera.x, camY: d.camera.y, clicks: d.clickCount, active: m.activePanel,
            };
        });
        const box = await page.evaluate(() => {
            const r = window.__rm.canvas.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const pinchAt = async (x, y, from, to, steps = 8) => {
            await touch('touchStart', [[x - from / 2, y], [x + from / 2, y]]);
            for (let k = 1; k <= steps; k += 1) {
                const d = from + ((to - from) * k) / steps;
                await touch('touchMove', [[x - d / 2, y], [x + d / 2, y]]);
                await page.waitForTimeout(16);
            }
            await touch('touchEnd', []);
            await page.waitForTimeout(300);
        };
        const before = await read();
        await pinchAt(cx, cy, 60, 180);
        const afterPinch = await read();
        await settle(page);
        await page.screenshot({ path: join(OUT, 'phone-390-mobile-tab.png') });
        const phonePaint = await paintStats(page);
        await touch('touchStart', [[cx, cy]]);
        for (let k = 1; k <= 8; k += 1) {
            await touch('touchMove', [[cx - 10 * k, cy - 12 * k]]);
            await page.waitForTimeout(16);
        }
        await touch('touchEnd', []);
        await page.waitForTimeout(300);
        const afterDrag = await read();
        const tb = await page.evaluate(() => {
            const r = window.__rm.root.querySelector('.region-map-toolbar').getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        await pinchAt(tb.x, tb.y, 60, 180);
        const afterControl = await read();
        out.phone = {
            state, tabsShown, canvas: box, before, afterPinch, afterDrag, afterControl, paint: phonePaint, errors,
            verdicts: {
                mobileLayout: state.mobileLayout,
                tabOnceNextToRegionGraph: state.regionMapEntries === 1 && state.before === 'regionGraphPanel',
                tapOpensPanel: before.active === 'regionMapPanel',
                pageScaleStays1AfterCanvasPinch: afterPinch.scale === 1,
                pinchZoomRatio: afterPinch.zoom / before.zoom,
                noClickFromPinch: afterPinch.clicks === before.clicks,
                noScrollFromPinch: afterPinch.pageY === before.pageY && JSON.stringify(afterPinch.scrollers) === JSON.stringify(before.scrollers),
                dragPannedMap: afterDrag.camX !== afterPinch.camX || afterDrag.camY !== afterPinch.camY,
                dragZoomUnchanged: afterDrag.zoom === afterPinch.zoom,
                dragDidNotScroll: afterDrag.pageY === afterPinch.pageY && afterDrag.docScroll === afterPinch.docScroll
                    && JSON.stringify(afterDrag.scrollers) === JSON.stringify(afterPinch.scrollers),
                noClickFromDrag: afterDrag.clicks === afterPinch.clicks,
                controlPinchOffCanvasMovesPageScale: afterControl.scale !== afterDrag.scale,
            },
        };
        await context.close();
        for (const k of ['without', 'with']) {
            const b = await phoneBoot(saved[k]);
            out[`saved_${k}`] = { state: b.state, errors: b.errors };
            await b.context.close();
        }
    }
} finally {
    await browser.close();
}
writeFileSync(join(OUT, ONLY ? `measure-${ONLY}.json` : 'measure.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
