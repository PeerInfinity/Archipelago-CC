/**
 * Region Graph Direction-aware layout: screenshots and measurements (region-graph-direction-layout).
 *
 * Desktop (1600 × 1000, `layout=desktop`):
 *   seedling_playthrough, merged + map look:
 *     seedling-merged-map-fcose.png            Force-Directed (fcose), today's
 *     seedling-merged-map-direction-0.7.png    Direction-aware, default settings (strength 0.7, spacing 40, border doors)
 *     seedling-merged-map-direction-1.png      Direction-aware, strength 1
 *     seedling-merged-map-direction-0.3.png    Direction-aware, strength 0.3 (for experimenting)
 *     seedling-merged-map-direction-spacing-120.png  strength 0.7, spacing 120
 *     seedling-two-on-one-side-zoom.png        zoomed on one level with two border doors on one side, and its neighbours
 *     seedling-direction-controls.png          the Controls' "Direction-aware layout" section, open
 *   alttp-default.png                          alttp, the default layout (no exit directions: unchanged)
 *   phone-390-direction.png                    390 × 844 phone, merged + map, Direction-aware
 *
 * Measurements, printed as JSON: for seedling_playthrough (merged, separate) and seedling_playthrough_maze (merged,
 * separate), at strengths 0 / 0.3 / 0.7 / 1 — the computation time (`report.totalMs`: inputs + layout, ONE main-thread
 * block), the longest main-thread task seen during the call (PerformanceObserver `longtask`), the mean and 90th-percentile
 * angle error, the overlaps; and fcose (3 runs, randomize: true, as the Force-Directed preset runs) measured the same way.
 *
 * Usage: node scripts/dev/shot-region-graph-direction-layout.mjs --port=8144 --out=CC/docs/region-graph/direction-layout-shots
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
const OUT = arg('out', 'CC/docs/region-graph/direction-layout-shots');
const ONLY = arg('only', null);
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-direction-layout.mjs', kind: 'browser' });

const VIEW_KEY = 'moduleSettings.regionGraph.subRegionView';
const LOOK_KEY = 'moduleSettings.regionGraph.nodeLook';
const STRENGTH_KEY = 'moduleSettings.regionGraph.directionStrength';
const SPACING_KEY = 'moduleSettings.regionGraph.directionSpacing';
const CY = () => document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy ?? null;

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
const graphClip = (page) => page.evaluate(() => {
    const r = document.querySelector('.region-graph-panel-container').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
});
const bakesLanded = async (page) => {
    await until(page, async () => {
        const m = await import('/frontend/modules/flashPanel/seedlingCompositeMap.js');
        return (m.seedlingCompositeMapStats?.().pending ?? 0) === 0;
    }, null, { timeout: 180000, every: 100 });
    await page.waitForTimeout(300);
};
/** The panel's RegionGraphUI (through the map layer when it is on, else the panel registry). */
const UI_SRC = `(() => {
    const layer = document.querySelector('.region-graph-panel-container .rg-map-look-canvas')?.mapLook;
    if (layer) return layer.ui;
    return window.__rgUi ?? null;
})()`;
/** Keep the panel's ui (the map layer holds it; the same RegionGraphUI lives on across rebuilds and view switches). */
const captureUi = (page) => page.evaluate(() => {
    const layer = document.querySelector('.region-graph-panel-container .rg-map-look-canvas')?.mapLook;
    if (layer) window.__rgUi = layer.ui;
    return !!window.__rgUi;
});
/** Run fcose (the Force-Directed preset, animate off) and measure it against the same preferences. */
const runFcose = (page) => page.evaluate(async ([uiSrc, cyFn]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    const D = await import('/frontend/modules/regionGraph/directionLayout.js');
    const { RegionGraphLayoutEditor } = await import('/frontend/modules/regionGraph/regionGraphLayoutEditor.js');
    const opts = { ...new RegionGraphLayoutEditor(cy, document.createElement('div')).layoutPresets['fcose-default'], animate: false, randomize: true };
    const t0 = performance.now();
    await new Promise((resolve) => { const l = cy.layout(opts); l.one('layoutstop', resolve); l.run(); });
    const ms = performance.now() - t0;
    const { nodes, edges, prefs } = ui.layoutControlsManager.directionLayoutInputs();
    const pos = new Map(nodes.map((n) => [n.id, cy.getElementById(n.id).position()]));
    const a = D.angleErrors(edges, prefs, pos);
    cy.fit(30);
    return { ms, mean: a.mean, p90: a.p90, overlaps: D.overlapCount(nodes, pos), n: a.n };
}, [UI_SRC, CY.toString()]);
/** Run the Direction-aware layout through the panel (animate off) with `settings` → its report + the longest task. */
const runDirection = (page, settings) => page.evaluate(async ([uiSrc, s]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    const D = await import('/frontend/modules/regionGraph/directionLayout.js');
    ui.directionSettings = D.normaliseDirectionSettings({ ...ui.directionSettings, ...s });
    const tasks = [];
    const obs = typeof PerformanceObserver !== 'undefined' ? new PerformanceObserver((l) => { for (const e of l.getEntries()) tasks.push(e.duration); }) : null;
    try { obs?.observe({ type: 'longtask', buffered: false }); } catch { /* not supported */ }
    await new Promise((r) => setTimeout(r, 50));
    const t0 = performance.now();
    const report = ui.layoutControlsManager.runDirectionLayout({ animate: false });
    const wall = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 300));
    obs?.disconnect();
    ui.cy.fit(30);
    return { ...report, wallMs: wall, longestTaskMs: tasks.length ? Math.max(...tasks) : null };
}, [UI_SRC, settings]);

const openDesktop = async (browser, game) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
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
/**
 * The map look on. The first time (in merged, where it takes effect), keep the panel's ui from its layer; `keepMap`
 * false turns it off again.
 */
const grabUi = async (page, keepMap) => {
    const view = await page.evaluate(async () => (await import('/frontend/app/core/settingsManager.js')).default.getSetting('moduleSettings.regionGraph.subRegionView'));
    if (!(await page.evaluate(() => !!window.__rgUi))) {
        await setSetting(page, VIEW_KEY, 'merged');
        await setSetting(page, LOOK_KEY, 'map');
        await until(page, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 });
        await captureUi(page);
        if (view !== 'merged') {
            await setSetting(page, VIEW_KEY, view);
            await page.waitForTimeout(800);
            await settle(page);
        }
    }
    await setSetting(page, LOOK_KEY, keepMap ? 'map' : 'graph');
    if (keepMap) await until(page, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 }).catch(() => {});
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const row = (rep) => ({ totalMs: r1(rep.totalMs), layoutMs: r1(rep.layoutMs), inputsMs: r1(rep.inputsMs), longestTaskMs: r1(rep.longestTaskMs),
    mean: r1(rep.meanAngleError), p90: r1(rep.p90AngleError), overlaps: rep.overlaps, nodes: rep.nodes, edges: rep.edges, preferred: rep.preferredEdges });

const out = { errors: {}, measure: {} };
const browser = await chromium.launch();
try {
    // ── Measurements ──
    for (const game of ONLY ? [] : ['seedling_playthrough', 'seedling_playthrough_maze']) {
        const { context, page, errors } = await openDesktop(browser, game);
        out.measure[game] = {};
        for (const view of ['separate', 'merged']) {
            await setSetting(page, VIEW_KEY, view);
            await page.waitForTimeout(800);
            await settle(page);
            // merged gets the map look (its drawn rectangles); separate is the ellipse (the map look takes no effect).
            await grabUi(page, view === 'merged');
            const m = { fcose: [] };
            for (let k = 0; k < 3; k += 1) { const f = await runFcose(page); m.fcose.push({ ms: r1(f.ms), mean: r1(f.mean), p90: r1(f.p90), overlaps: f.overlaps }); }
            for (const strength of [0, 0.3, 0.7, 1]) m[`s${strength}`] = row(await runDirection(page, { strength, spacing: 40, exits: 'border' }));
            const again = row(await runDirection(page, { strength: 0.7, spacing: 40, exits: 'border' }));
            m.counts = (await page.evaluate((src) => new Function(`return ${src}`)().lastDirectionLayout.counts, UI_SRC));
            m.defaultRepeat = again;
            out.measure[game][view] = m;
            await setSetting(page, LOOK_KEY, 'graph');
        }
        await setSetting(page, VIEW_KEY, 'separate');
        out.errors[game] = errors;
        await context.close();
    }

    // ── Shots ──
    {
        const { context, page, errors } = await openDesktop(browser, 'seedling_playthrough');
        await setSetting(page, VIEW_KEY, 'merged');
        await cyHas(page, (cy) => cy.nodes('.region-group-merged').length > 0);
        await settle(page);
        await grabUi(page, true);
        await bakesLanded(page);
        await runFcose(page);
        await page.waitForTimeout(800);
        await bakesLanded(page);
        await page.screenshot({ path: join(OUT, 'seedling-merged-map-fcose.png'), clip: await graphClip(page) });
        out.shots = {};
        for (const [name, s] of [['direction-0.7', { strength: 0.7, spacing: 40 }], ['direction-1', { strength: 1, spacing: 40 }],
            ['direction-0.3', { strength: 0.3, spacing: 40 }], ['direction-spacing-120', { strength: 0.7, spacing: 120 }]]) {
            out.shots[name] = row(await runDirection(page, { ...s, exits: 'border' }));
            await page.waitForTimeout(500);
            await bakesLanded(page);
            await page.screenshot({ path: join(OUT, `seedling-merged-map-${name}.png`), clip: await graphClip(page) });
        }
        // Back to the default, then zoom on a two-on-one-side level (the first by name with an EAST pair, else any).
        await runDirection(page, { strength: 0.7, spacing: 40, exits: 'border' });
        out.zoom = await page.evaluate(async (src) => {
            // eslint-disable-next-line no-new-func
            const ui = new Function(`return ${src}`)();
            const D = await import('/frontend/modules/regionGraph/directionLayout.js');
            const { exitTileOf } = await import('/frontend/modules/regionMap/regionMapModel.js');
            const got = ui.mapLook.regionMapModel();
            const { counts } = D.exitDirections({ sidecars: got.rules.preset_sidecars[got.playerId], model: got.model, tileOf: exitTileOf });
            const pick = counts.twoOnOneSideLevels.find((c) => c.side === 'E') ?? counts.twoOnOneSideLevels[0];
            const idOf = (key) => (got.model.cells.get(key).members.length > 1 ? `region-group:${key}` : got.model.cells.get(key).members[0]);
            const ids = [pick.level, ...pick.targets].map(idOf);
            const eles = ui.cy.collection(ids.map((id) => ui.cy.getElementById(id)));
            ui.cy.fit(eles.union(eles.neighborhood('node')), 60);
            const at = Object.fromEntries(ids.map((id) => [id, ui.cy.getElementById(id).position()]));
            return { level: pick.level, side: pick.side, targets: pick.targets, positions: at, all: counts.twoOnOneSideLevels.length };
        }, UI_SRC);
        await page.waitForTimeout(500);
        await bakesLanded(page);
        await page.screenshot({ path: join(OUT, 'seedling-two-on-one-side-zoom.png'), clip: await graphClip(page) });
        // The controls section, open.
        await evalCy(page, (cy) => cy.fit(30));
        await page.evaluate(() => {
            const panel = document.querySelector('.region-graph-panel-container');
            if (panel.querySelector('#controlsContent')?.style.display === 'none') panel.querySelector('#controlsHeader')?.click();
            const d = panel.querySelector('details.rg-direction-layout');
            if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); }
        });
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(OUT, 'seedling-direction-controls.png'), clip: await graphClip(page) });
        await setSetting(page, LOOK_KEY, 'graph');
        await setSetting(page, VIEW_KEY, 'separate');
        out.errors.shots = errors;
        await context.close();
    }
    {
        const { context, page, errors } = await openDesktop(browser, 'alttp');
        out.alttp = await evalCy(page, (cy) => ({ nodes: cy.nodes('.region').length, preset: document.querySelector('#layoutPreset')?.value }));
        await page.screenshot({ path: join(OUT, 'alttp-default.png'), clip: await graphClip(page) });
        await grabUi(page, false);
        out.alttp.direction = row(await runDirection(page, {}));
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
        await grabUi(page, true);
        out.phone = row(await runDirection(page, {}));
        await bakesLanded(page);
        out.phone.horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        await page.screenshot({ path: join(OUT, 'phone-390-direction.png') });
        await setSetting(page, LOOK_KEY, 'graph');
        await setSetting(page, VIEW_KEY, 'separate');
        out.errors.phone = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(JSON.stringify(out, null, 2));
