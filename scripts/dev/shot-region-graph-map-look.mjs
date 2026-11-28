/**
 * Region Graph map node look screenshots and measurements (region-graph-map-look) — `nodeLook` = map.
 *
 * Desktop (1600 × 1000, `layout=desktop`), seedling_playthrough, subRegionView = merged (116 nodes):
 *   seedling-merged-graph-fcose.png  nodeLook = graph, Force-Directed, fit
 *   seedling-merged-map-fcose.png    the SAME view (no re-layout: the switch moves no node), nodeLook = map
 *   seedling-map-zoom.png            map, zoomed in on the merged node with the most location squares
 *   seedling-map-separate.png        nodeLook = map stored, subRegionView = separate: nodes draw as graph; the
 *                                    Controls open on the greyed-out Node look box and its hint
 * alttp (no painter, no sub-regions; merged = separate): alttp-map.png
 * Phone (390 × 844, isMobile, hasTouch, DPR 3): phone-390-map.png (merged + map)
 *
 * Measurements (seedling_playthrough, merged, map), each printed as JSON:
 *   · switch: the setting write → the first paint with cells (wall), and the layer's own firstPaintMs / applyMs / modelMs;
 *   · the steady paint (20 pans), the re-colour per snapshot (20 view recomputes: the view's
 *     recompute + the repaint, `lastRecolourMs`; driven by the view's `refresh()`, what its snapshot trigger calls) and
 *     the re-colour after the square click's own real snapshot;
 *   · the time until the Seedling painter's bakes have all landed (the shots wait for it: before that, a level still
 *     queued draws the painter's placeholder, on the Region Map as here);
 *   · the JS heap after a forced GC, once the bakes have landed (`--js-flags=--expose-gc`, `--enable-precise-memory-info`) in graph and in map;
 *   · a REAL mouse click on a location square (Playwright's mouse at the square's screen spot) → the published click.
 *
 * Usage: node scripts/dev/shot-region-graph-map-look.mjs --port=8144 --out=CC/docs/region-graph/map-look-shots
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
const OUT = arg('out', 'CC/docs/region-graph/map-look-shots');
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-map-look.mjs', kind: 'browser' });

const VIEW_KEY = 'moduleSettings.regionGraph.subRegionView';
const LOOK_KEY = 'moduleSettings.regionGraph.nodeLook';
const CY = () => document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy ?? null;

/** Poll an ASYNC page predicate (a `waitForFunction` with an async one resolves at once: a Promise is truthy). */
const until = async (page, fn, arg0 = null, { timeout = 90000, every = 200 } = {}) => {
    const t0 = Date.now();
    for (;;) {
        if (await page.evaluate(fn, arg0)) return true;
        if (Date.now() - t0 > timeout) throw new Error(`timed out: ${fn.toString().slice(0, 120)}`);
        await page.waitForTimeout(every);
    }
};
const rulesLoaded = async () => {
    const { stateManagerProxySingleton: sm } = await import('/frontend/modules/stateManager/index.js');
    return (sm.getStaticData?.()?.regions?.size ?? 0) > 0 && !!sm.getLatestStateSnapshot?.();
};
const evalCy = (page, fn, a = null) => page.evaluate(([cyFn, fnSrc, x]) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    // eslint-disable-next-line no-new-func
    return new Function('cy', 'a', `return (${fnSrc})(cy, a)`)(cy, x);
}, [CY.toString(), fn.toString(), a]);
const cyHas = (page, fn, a = null) => until(page, ([cyFn, fnSrc, x]) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    // eslint-disable-next-line no-new-func
    return !!cy && new Function('cy', 'a', `return (${fnSrc})(cy, a)`)(cy, x);
}, [CY.toString(), fn.toString(), a]);
const setSetting = (page, k, v) => page.evaluate(async ([key, value]) => {
    const { default: sm } = await import('/frontend/app/core/settingsManager.js');
    await sm.updateSetting(key, value);
}, [k, v]);
const layerState = (page) => page.evaluate(() => {
    const l = document.querySelector('.region-graph-panel-container .rg-map-look-canvas')?.mapLook;
    return l ? l.getDebugState() : null;
});
const settle = async (page) => {
    let last = null; let same = 0;
    for (let k = 0; k < 120 && same < 3; k += 1) {
        await page.waitForTimeout(500);
        const now = await evalCy(page, (cy) => JSON.stringify(cy?.nodes().map((n) => n.position()) ?? null));
        same = now === last ? same + 1 : 0;
        last = now;
    }
    await page.waitForTimeout(800);
};
const fcose = (page) => page.evaluate(async (cyFn) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    const { RegionGraphLayoutEditor } = await import('/frontend/modules/regionGraph/regionGraphLayoutEditor.js');
    const opts = { ...new RegionGraphLayoutEditor(cy, document.createElement('div')).layoutPresets['fcose-default'],
        animate: false, randomize: true };
    await new Promise((resolve) => { const l = cy.layout(opts); l.one('layoutstop', resolve); l.run(); });
    cy.fit(30);
}, CY.toString());
const graphClip = (page) => page.evaluate(() => {
    const r = document.querySelector('.region-graph-panel-container').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
});
const heap = (page) => page.evaluate(async () => {
    for (let i = 0; i < 3; i += 1) { globalThis.gc?.(); await new Promise((r) => setTimeout(r, 200)); }
    return performance.memory?.usedJSHeapSize ?? null;
});
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const openDesktop = async (browser, game) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'warning' && /regionGraph: /.test(m.text())) errors.push(`warn: ${m.text().slice(0, 200)}`); });
    await page.goto(`${HOST}/frontend/?game=${game}&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
    await until(page, rulesLoaded);
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    const tab = page.locator('.lm_tab', { hasText: 'Region Graph' }).first();
    await tab.click();
    await tab.evaluate((t) => t.closest('.lm_stack')?.querySelector('.lm_maximise')?.click());
    await cyHas(page, (cy) => cy.nodes('.region').length > 0);
    await settle(page);
    return { context, page, errors };
};
const toMap = async (page) => {
    const t0 = Date.now();
    await setSetting(page, LOOK_KEY, 'map');
    await until(page, () => Number(document.querySelector('.rg-map-look-canvas')?.dataset.cells ?? 0) > 0, null, { every: 10 });
    return Date.now() - t0;
};
/**
 * Until the Seedling painter's bakes have all landed (it draws a placeholder for a level still queued, 2 bakes at a
 * time, and repaints the layer as each lands) → ms waited. 0 on a world with no Seedling art.
 */
const bakesLanded = async (page) => {
    const t0 = Date.now();
    await until(page, async () => {
        const m = await import('/frontend/modules/flashPanel/seedlingCompositeMap.js');
        return (m.seedlingCompositeMapStats?.().pending ?? 0) === 0;
    }, null, { timeout: 180000, every: 100 });
    await page.waitForTimeout(300);
    return Date.now() - t0;
};

const out = { errors: {} };
const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
try {
    {
        const { context, page, errors } = await openDesktop(browser, 'seedling_playthrough');
        await setSetting(page, VIEW_KEY, 'merged');
        await cyHas(page, (cy) => cy.nodes('.region-group-merged').length > 0);
        await settle(page);
        await fcose(page);
        await page.waitForTimeout(1500);
        out.merged = await evalCy(page, (cy) => ({ nodes: cy.nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node')).length,
            mergedNodes: cy.nodes('.region-group-merged').length, edges: cy.edges().length, zoom: cy.zoom() }));
        const positions = await evalCy(page, (cy) => JSON.stringify(cy.nodes().map((n) => [n.id(), n.position()])));
        await page.screenshot({ path: join(OUT, 'seedling-merged-graph-fcose.png'), clip: await graphClip(page) });
        const heapGraph = await heap(page);

        const switchWallMs = await toMap(page);
        const bakesMs = await bakesLanded(page);
        const afterSwitch = await layerState(page);
        const samePositions = positions === await evalCy(page, (cy) => JSON.stringify(cy.nodes().map((n) => [n.id(), n.position()])));
        await page.screenshot({ path: join(OUT, 'seedling-merged-map-fcose.png'), clip: await graphClip(page) });
        const heapMap = await heap(page);

        // The steady paint: 20 one-frame pans.
        const pan = await page.evaluate(async (cyFn) => {
            // eslint-disable-next-line no-new-func
            const cy = new Function(`return (${cyFn})()`)();
            const l = document.querySelector('.rg-map-look-canvas').mapLook;
            const ms = [];
            for (let i = 0; i < 20; i += 1) {
                cy.panBy({ x: i % 2 ? -4 : 4, y: 0 });
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                ms.push(l.stats.lastPaintMs);
            }
            return ms;
        }, CY.toString());
        // The re-colour: 20 view refreshes, one per 100 ms — `refresh()` is exactly what the view's snapshot trigger
        // calls (a probe cannot publish `stateManager:snapshotUpdated`: the bus drops an unregistered publisher). Each
        // sample is the view's recompute + the repaint; a sample whose recompute did not run is refused.
        const recolour = await page.evaluate(async () => {
            const l = document.querySelector('.rg-map-look-canvas').mapLook;
            const ms = [];
            for (let i = 0; i < 20; i += 1) {
                const n = l.stats.recolours;
                l.view.refresh();
                for (let k = 0; k < 100 && l.stats.recolours === n; k += 1) await new Promise((r) => setTimeout(r, 10));
                if (l.stats.recolours !== n + 1) throw new Error(`recolour sample ${i}: ${l.stats.recolours - n} recomputes`);
                ms.push(l.stats.lastRecolourMs);
                await new Promise((r) => setTimeout(r, 100));
            }
            return ms;
        });
        out.perf = {
            nodes: out.merged.nodes, mapNodes: afterSwitch.nodes, switchWallMs, bakesLandedAfterSwitchMs: bakesMs, firstPaintMs: afterSwitch.stats.firstPaintMs,
            applyMs: afterSwitch.stats.applyMs, modelMs: afterSwitch.stats.modelMs, firstPaintsMaxMs: afterSwitch.stats.maxPaintMs,
            panPaintMedianMs: median(pan), panPaintMaxMs: Math.max(...pan),
            recolourMedianMs: median(recolour), recolourMaxMs: Math.max(...recolour), recolourSamples: recolour.length, recolour,
            heapGraphMB: heapGraph / 1e6, heapMapMB: heapMap / 1e6, heapDeltaMB: (heapMap - heapGraph) / 1e6,
            samePositions, squares: afterSwitch.stats.squares, art: afterSwitch.stats.art, generic: afterSwitch.stats.generic,
        };

        // Zoom onto the merged node with the most squares, then click one square with the real mouse.
        out.zoom = await page.evaluate(async (cyFn) => {
            // eslint-disable-next-line no-new-func
            const cy = new Function(`return (${cyFn})()`)();
            const l = document.querySelector('.rg-map-look-canvas').mapLook;
            const count = new Map();
            for (const [, key] of l.getDebugState().nodeKeys) count.set(key, l.model.cells.get(key)?.tiles.length ?? 0);
            const [key, tiles] = [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
            const node = cy.nodes().filter((n) => n.scratch('_rgMapKey') === key)[0];
            cy.zoom(9);
            cy.center(node);
            await new Promise((r) => setTimeout(r, 300));
            return { key, tiles, node: node.id(), zoom: cy.zoom() };
        }, CY.toString());
        await bakesLanded(page);
        const zoomed = await layerState(page);
        out.zoom.squaresDrawn = zoomed.squares.filter((q) => q.key === out.zoom.key).length;
        await page.screenshot({ path: join(OUT, 'seedling-map-zoom.png'), clip: await graphClip(page) });
        const sq = zoomed.squares.find((q) => q.key === out.zoom.key);
        if (sq) {
            await page.evaluate(async () => {
                const { default: bus } = await import('/frontend/app/core/eventBus.js');
                window.__clicks = [];
                for (const ev of ['regionView:locationClicked', 'regionView:regionClicked']) {
                    bus.subscribe(ev, (d) => window.__clicks.push([ev, d?.locationName ?? d?.regionName]), 'probe');
                }
            });
            const r = await page.evaluate(() => document.querySelector('.rg-map-look-canvas').getBoundingClientRect().toJSON());
            const before = await layerState(page);
            await page.mouse.click(r.x + sq.sx, r.y + sq.sy);
            await page.waitForTimeout(1500);
            const after = await layerState(page);
            // The click's own state change (a real snapshot from the worker) re-colours the square, with no rebuild.
            out.squareClick = { square: sq.location, published: await page.evaluate(() => window.__clicks),
                colourBefore: before.squares.find((q) => q.location === sq.location)?.color,
                colourAfter: after.squares.find((q) => q.location === sq.location)?.color,
                recomputes: after.stats.recolours - before.stats.recolours, lastRecolourMs: after.stats.lastRecolourMs,
                modelMs: after.stats.modelMs === before.stats.modelMs };
        }

        // map stored + separate: the graph look, the control greyed out with its hint.
        await setSetting(page, VIEW_KEY, 'separate');
        await cyHas(page, (cy) => cy.nodes('.region-group-merged').length === 0 && cy.nodes('.region').length > 300);
        await settle(page);
        await page.evaluate(() => {
            const panel = document.querySelector('.region-graph-panel-container');
            if (panel.querySelector('#controlsContent')?.style.display === 'none') panel.querySelector('#controlsHeader')?.click();
            panel.querySelector('#nodeLook')?.scrollIntoView({ block: 'center' });
        });
        await page.waitForTimeout(600);
        out.separate = {
            mapCanvas: await page.evaluate(() => !!document.querySelector('.rg-map-look-canvas')),
            mapNodes: await evalCy(page, (cy) => cy.nodes().filter((n) => n.scratch('_rgMapKey') != null).length),
            control: await page.evaluate(() => { const s = document.querySelector('#nodeLook'); return s ? { value: s.value, disabled: s.disabled,
                hint: document.querySelector('#nodeLookHint')?.style.display !== 'none' ? document.querySelector('#nodeLookHint').textContent : null } : null; }),
        };
        await page.screenshot({ path: join(OUT, 'seedling-map-separate.png'), clip: await graphClip(page) });
        await setSetting(page, LOOK_KEY, 'graph');
        out.errors.seedling = errors;
        await context.close();
    }
    {
        const { context, page, errors } = await openDesktop(browser, 'alttp');
        await setSetting(page, VIEW_KEY, 'merged');
        await page.waitForTimeout(1500);
        await settle(page);
        const ms = await toMap(page);
        await page.waitForTimeout(1500);
        const s = await layerState(page);
        out.alttp = { switchWallMs: ms, nodes: await evalCy(page, (cy) => cy.nodes('.region').length), mapNodes: s.nodes,
            art: s.stats.art, generic: s.stats.generic, cells: s.stats.cells, squares: s.stats.squares, firstPaintMs: s.stats.firstPaintMs };
        await page.screenshot({ path: join(OUT, 'alttp-map.png'), clip: await graphClip(page) });
        await setSetting(page, LOOK_KEY, 'graph');
        await setSetting(page, VIEW_KEY, 'separate');
        out.errors.alttp = errors;
        await context.close();
    }
    {
        const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
        const context = await browser.newContext(PHONE);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${HOST}/frontend/?game=seedling_playthrough&seed=1`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.mobile-tab', { timeout: 90000 });
        await until(page, rulesLoaded);
        const tabSel = '.mobile-tab[data-component-type="regionGraphPanel"]';
        for (let k = 0; k < 4 && !(await page.$(tabSel)); k += 1) await page.tap('.mobile-nav-left');
        await page.tap(tabSel);
        await cyHas(page, (cy) => cy.nodes('.region').length > 0);
        await setSetting(page, VIEW_KEY, 'merged');
        await cyHas(page, (cy) => cy.nodes('.region-group-merged').length > 0);
        await settle(page);
        await toMap(page);
        await evalCy(page, (cy) => { const n = cy.nodes('.region-group-merged').sort((a, b) => (a.data('groupKey') < b.data('groupKey') ? -1 : 1))[0]; cy.zoom(2); cy.center(n); });
        await bakesLanded(page);
        const s = await layerState(page);
        out.phone = { mapNodes: s.nodes, cells: s.stats.cells, squares: s.stats.squares,
            horizontalScroll: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) };
        await page.screenshot({ path: join(OUT, 'phone-390-map.png') });
        await setSetting(page, LOOK_KEY, 'graph');
        await setSetting(page, VIEW_KEY, 'separate');
        out.errors.phone = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(JSON.stringify(out, null, 2));
