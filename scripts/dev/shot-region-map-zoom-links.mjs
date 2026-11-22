/**
 * Region Map zoom-links screenshots + the phone measurement (region-map zoom-links) — drives the running app with
 * Playwright, lifts the Region Map panel's root into a full-viewport overlay (as `shot-region-map.mjs` does), and
 * writes PNGs plus `measure.json`:
 *
 *   node scripts/dev/shot-region-map-zoom-links.mjs --port=8143 --out=<dir> [--only=desktop|phone] [--wait-for-box=<sec>]
 *
 * Shots:
 *   seedling_playthrough-neighbours.png   a few groups around the start level: the yellow neighbour lines
 *   seedling_playthrough-fit.png          Fit all, every link on
 *   toolbar.png                           the toolbar with + / − beside Fit all
 *   alttp-fit.png                         a classic world (generic layout): every link is in a group (the crowding)
 *   phone-390-after-pinch.png             a 390 px touch viewport (isMobile, hasTouch) after a real two-finger pinch
 *
 * ⛓ THE PHONE MEASUREMENT (js-22 edit 3): the touches are REAL input (CDP `Input.dispatchTouchEvent`, through the
 * browser's own gesture recogniser), so a page pinch-zoom would happen if the canvas let it. It reads:
 *   · after a two-finger pinch ON THE CANVAS: `visualViewport.scale` (must stay 1), the map zoom (must change), the
 *     panel's clickCount (must not move), the page's and the panel's scroll offsets (must not move);
 *   · after a one-finger drag on the canvas: the camera moved, the page did not scroll;
 *   · the CONTROL: the same pinch on the page OUTSIDE the canvas — if `visualViewport.scale` moves there, the
 *     instrument can see a page zoom, so the canvas's 1 is a measurement, not a blind spot.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt = null) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out', null);
/** `--only=desktop` or `--only=phone`: one half (the other's files are left as they are). */
const ONLY = arg('only', null);
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map-zoom-links.mjs', kind: 'browser' });

const HOST = `http://localhost:${PORT}`;

async function boot(context, game, { overlay = true, query = '' } = {}) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${HOST}/frontend/?game=${game}&seed=1${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lm_tab, .mobile-tab', { timeout: 90000 });
    await page.waitForFunction(async () => {
        const sm = await import('/frontend/modules/stateManager/index.js');
        return !!sm.getLastRawJsonData()?.rawJsonData && (sm.stateManagerProxySingleton.getStaticData()?.regions?.size ?? 0) > 0;
    }, null, { timeout: 90000, polling: 250 });
    await page.evaluate(async (lift) => {
        const pm = (await import('/frontend/app/core/panelManager.js')).default;
        const rm = await import('/frontend/modules/regionMap/index.js');
        if (!rm.getPanelInstances().length) await pm.createPanelForComponent('regionMapPanel', 'Region Map', 2);
        const bus = (await import('/frontend/app/core/eventBus.js')).default;
        bus.publish('ui:activatePanel', { panelId: 'regionMapPanel' }, 'shot');
        const p = rm.getPanelInstances()[0];
        if (lift) {
            const host = document.createElement('div');
            Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#000' });
            host.className = 'zl-host';
            document.body.appendChild(host);
            host.appendChild(p.root);
        }
        window.__rm = p;
        window.__rmStats = (await import('/frontend/modules/flashPanel/seedlingCompositeMap.js')).seedlingCompositeMapStats;
    }, overlay);
    await page.waitForFunction(() => window.__rm?.getDebugState()?.lastPaint?.cells > 0, null, { timeout: 30000, polling: 100 });
    return { page, errors };
}

const settle = async (page) => {
    await page.waitForTimeout(200);
    await page.waitForFunction(() => window.__rmStats().pending === 0, null, { timeout: 120000, polling: 250 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

async function shot(page, name, opts = {}) {
    await settle(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, name), ...opts });
    console.log('wrote', name);
}

const linkStats = (page) => page.evaluate(() => {
    const d = window.__rm.getDebugState();
    return { cross: d.links, neighbour: d.neighbourLinks, drawnCross: d.lastPaint.links, drawnNeighbour: d.lastPaint.neighbourLinks };
});

const out = {};
const browser = await chromium.launch();
try {
    // ── seedling_playthrough, desktop ──
    if (ONLY !== 'phone') {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const { page, errors } = await boot(context, 'seedling_playthrough');
        await page.evaluate(() => window.__rm.fitAll());
        await shot(page, 'seedling_playthrough-fit.png');
        out.seedling_fit = await linkStats(page);
        // the start level's group and its neighbours, at a zoom where a level is ~ 1/5 of the view
        await page.evaluate(() => {
            const p = window.__rm;
            const f = p.frames.get(p.model.layout.start);
            p.setCamera({ x: f.cell.x + f.cell.w / 2, y: f.cell.y + f.cell.h / 2, zoom: Math.min(p.vp.w / f.cell.w, p.vp.h / f.cell.h) * 0.22 });
        });
        await shot(page, 'seedling_playthrough-neighbours.png');
        out.seedling_neighbours_view = await linkStats(page);
        const box = await page.evaluate(() => {
            const r = window.__rm.root.querySelector('.region-map-toolbar').getBoundingClientRect();
            const b = window.__rm.root.querySelector('button.region-map-zoom-in').getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, plus: { w: b.width, h: b.height } };
        });
        out.toolbar = box;
        await page.screenshot({ path: join(OUT, 'toolbar.png'), clip: { x: box.x, y: box.y, width: Math.min(box.width, 1100), height: box.height } });
        console.log('wrote toolbar.png');
        if (errors.length) console.log('page errors:', errors);
        await context.close();
    }
    // ── alttp: the generic-layout crowding ──
    if (ONLY !== 'phone') {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const { page, errors } = await boot(context, 'alttp');
        await page.evaluate(() => window.__rm.fitAll());
        await shot(page, 'alttp-fit.png');
        out.alttp_fit = await linkStats(page);
        if (errors.length) console.log('alttp page errors:', errors);
        await context.close();
    }
    // ── the phone: 390 px, touch ──
    if (ONLY !== 'desktop') {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
        });
        // ⛓ `?layout=desktop`: the app's MOBILE layout has no Region Map tab (no layout preset lists the panel), so
        // the panel is opened in the desktop layout and lifted full-viewport, as the desktop shots are. The touches
        // are still real page input, so `visualViewport.scale` and the scroll offsets are the page's own.
        const { page, errors } = await boot(context, 'seedling_playthrough', { query: '&layout=desktop' });
        const cdp = await context.newCDPSession(page);
        const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
            type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })),
        });
        const read = () => page.evaluate(() => {
            const p = window.__rm;
            const d = p.getDebugState();
            const wrap = p.root.parentElement;
            return {
                scale: window.visualViewport?.scale ?? null, pageX: window.scrollX, pageY: window.scrollY,
                docScroll: document.scrollingElement?.scrollTop ?? 0, panelScroll: p.root.scrollTop, hostScroll: wrap?.scrollTop ?? 0,
                zoom: d.camera.zoom, camX: d.camera.x, camY: d.camera.y, clicks: d.clickCount, pinch: d.pinch,
            };
        });
        await page.evaluate(() => window.__rm.fitAll());
        await settle(page);
        const canvasBox = await page.evaluate(() => {
            const r = window.__rm.canvas.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        const cx = canvasBox.x + canvasBox.w / 2;
        const cy = canvasBox.y + canvasBox.h / 2;
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
        await shot(page, 'phone-390-after-pinch.png');
        // one finger drag on the canvas
        await touch('touchStart', [[cx, cy]]);
        for (let k = 1; k <= 8; k += 1) {
            await touch('touchMove', [[cx - 10 * k, cy - 12 * k]]);
            await page.waitForTimeout(16);
        }
        await touch('touchEnd', []);
        await page.waitForTimeout(300);
        const afterDrag = await read();
        // CONTROL: the same pinch on the page outside the canvas (on the panel's toolbar)
        const tb = await page.evaluate(() => {
            const r = window.__rm.root.querySelector('.region-map-toolbar').getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        await pinchAt(tb.x, tb.y, 60, 180);
        const afterControl = await read();
        out.phone = {
            canvas: canvasBox, before, afterPinch, afterDrag, afterControl,
            verdicts: {
                pageScaleStays1AfterCanvasPinch: afterPinch.scale === 1,
                mapZoomChangedByPinch: afterPinch.zoom !== before.zoom,
                pinchZoomRatio: afterPinch.zoom / before.zoom,
                noClickFromPinch: afterPinch.clicks === before.clicks,
                noScrollFromPinch: afterPinch.pageY === before.pageY && afterPinch.panelScroll === before.panelScroll && afterPinch.hostScroll === before.hostScroll,
                dragPannedMap: afterDrag.camX !== afterPinch.camX || afterDrag.camY !== afterPinch.camY,
                dragDidNotScrollPage: afterDrag.pageY === afterPinch.pageY && afterDrag.docScroll === afterPinch.docScroll && afterDrag.panelScroll === afterPinch.panelScroll,
                noClickFromDrag: afterDrag.clicks === afterPinch.clicks,
                controlPinchOffCanvasMovesPageScale: afterControl.scale !== afterDrag.scale,
            },
        };
        if (errors.length) console.log('phone page errors:', errors);
        await context.close();
    }
} finally {
    await browser.close();
}
writeFileSync(join(OUT, ONLY ? `measure-${ONLY}.json` : 'measure.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
