/**
 * Region Graph, two-step Floor grouping STACKED BY FLOOR (region-graph-floor-stacking): screenshots and measurements.
 *
 * Desktop (1600 × 1000, `layout=desktop`), seedling_playthrough, merged + map look (the Region Map cells), Floor
 * grouping = Two-step + boxes, Direction-aware defaults (strength 0.7, spacing 40, border doors, floor gap 160):
 *   seedling-merged-map-before.png   the blocks where the stairs' directions put them (`floorStacking: false`:
 *                                    region-graph-floors' placement, today's labels)
 *   seedling-merged-map-after.png    stacked by floor (higher floor above)
 *   seedling-floors-m2-0-before.png / -after.png   zoomed on the blocks of Floors −2 … 0
 *   phone-390-after.png              390 × 844 phone, merged + map, twoStepBoxes, stacked
 * Measurements (JSON): each shot's report row (floor order pairs / violations, the bands, overlaps, block overlaps,
 * intruders, angle errors inside / between, the solve and layout times); merged and separate, before / after.
 *
 * Usage: node scripts/dev/shot-region-graph-floor-stacking.mjs --port=8146 [--out=CC/docs/region-graph/floor-stacking-shots]
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
const OUT = arg('out', 'CC/docs/region-graph/floor-stacking-shots');
const ONLY = arg('only', null);
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-floor-stacking.mjs', kind: 'browser' });

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
/** Wait for the panel's layout run to SETTLE (`rg-layoutsettled`, layoutRun.js) — no timer, no poll-for-steady. */
const settle = (page) => page.evaluate(async (cyFn) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    const { layoutRunOf } = await import('/frontend/modules/regionGraph/layoutRun.js');
    await layoutRunOf(cy)?.whenSettled?.();
}, CY.toString());
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
/**
 * Run the Direction-aware layout through the panel (animate off) → its report + the longest task. `before`: the
 * two-step layout with the floor links off and the boxes labelled by their root (region-graph-dungeon-groups' own).
 */
const runDirection = (page, settings, grouping = {}, { before = false } = {}) => page.evaluate(async ([uiSrc, s, g, b]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    const D = await import('/frontend/modules/regionGraph/directionLayout.js');
    const G = await import('/frontend/modules/regionGraph/floorGroups.js');
    const F = await import('/frontend/modules/regionGraph/floors.js');
    ui.directionSettings = D.normaliseDirectionSettings({ ...ui.directionSettings, ...s });
    const merged = { ...ui.groupingSettings, ...g };
    ui.groupingSettings = { ...G.normaliseGroupingSettings(merged), floorGap: F.normaliseFloorGap(merged.floorGap) };
    const lcm = ui.layoutControlsManager;
    const orig = lcm.buildDirectionLayout;
    if (b) lcm.buildDirectionLayout = (x, y) => orig.call(lcm, x, y, { floorStacking: false });
    const tasks = [];
    const obs = typeof PerformanceObserver !== 'undefined' ? new PerformanceObserver((l) => { for (const e of l.getEntries()) tasks.push(e.duration); }) : null;
    try { obs?.observe({ type: 'longtask', buffered: false }); } catch { /* not supported */ }
    await new Promise((r) => setTimeout(r, 50));
    const t0 = performance.now();
    let report;
    try { report = lcm.runDirectionLayout({ animate: false }); } finally { lcm.buildDirectionLayout = orig; }
    const wall = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 300));
    obs?.disconnect();
    ui.cy.fit(30);
    ui.floorBoxes?.sync?.();
    const shownEls = [...document.querySelectorAll('.region-graph-panel-container .rg-floor-box')].filter((x) => x.style.display === 'block');
    return { ...report, wallMs: wall, longestTaskMs: tasks.length ? Math.max(...tasks) : null, boxesShown: shownEls.length,
        labels: shownEls.map((x) => [x.textContent, x.dataset.root]) };
}, [UI_SRC, settings, grouping, before]);

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
/** Switch the view and wait for its graph (a merged view draws group nodes; separate none) and its layout to settle. */
const switchView = async (page, view, { hasGroups = true } = {}) => {
    await setSetting(page, VIEW_KEY, view);
    // A world with no sub-regions (alttp) draws the same graph in every view: nothing to wait for but the settle.
    if (hasGroups) {
        await cyHas(page, (cy, v) => (v === 'separate' ? cy.nodes('.region-group-merged').length === 0 && cy.nodes('.region-group').length === 0
            : cy.nodes('.region-group-merged').length > 0), view);
    }
    await settle(page);
};
/** The map look on (merged) and the panel's ui kept from its layer; `keepMap` false turns it off again. */
const grabUi = async (page, keepMap, { hasGroups = true } = {}) => {
    if (!(await page.evaluate(() => !!window.__rgUi))) {
        const view = await page.evaluate(async () => (await import('/frontend/app/core/settingsManager.js')).default.getSetting('moduleSettings.regionGraph.subRegionView'));
        if (view !== 'merged') await switchView(page, 'merged', { hasGroups });
        await setSetting(page, LOOK_KEY, 'map');
        await until(page, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 });
        await captureUi(page);
        if (view !== 'merged') await switchView(page, view, { hasGroups });
    }
    await setSetting(page, LOOK_KEY, keepMap ? 'map' : 'graph');
    if (keepMap) await until(page, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 });
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const row = (rep) => {
    const f = rep.floors ?? {};
    return {
        grouping: rep.grouping?.grouping, floorGap: rep.grouping?.floorGap, floorLinks: f.floorLinks ?? null,
        flatMean: r1(f.flatError?.mean), flatP90: r1(f.flatError?.p90), flatN: f.flatError?.n,
        insideMean: r1(f.flatInsideError?.mean), betweenMean: r1(f.flatBetweenError?.mean), betweenN: f.flatBetweenError?.n,
        vertMean: r1(f.verticalError?.mean), vertP90: r1(f.verticalError?.p90), vertN: f.verticalError?.n,
        flatLen: r1(f.meanFlatLength), vertLen: r1(f.meanVerticalLength),
        overlaps: rep.overlaps, blockOverlaps: rep.blockOverlaps, intruders: rep.intruders, boxes: rep.boxes, boxesShown: rep.boxesShown,
        totalMs: r1(rep.totalMs), longestTaskMs: r1(rep.longestTaskMs), nodes: rep.nodes,
        counts: f.counts ?? null, numbered: f.numbered, unreached: f.unreached, conflicts: f.conflicts, conflictGroups: f.conflictGroups,
        floorRange: f.floorRange ?? null, inert: rep.stats?.grouping?.inert ?? null, labels: rep.labels,
        floorOrder: rep.floorOrder ?? null, bands: (rep.stats?.grouping?.bands ?? null)?.map((x) => `${x.band}:${x.blocks}`) ?? null, solveMs: r1(f.solveMs),
    };
};
const DIGEST_SRC = `(ui) => { const ids = ui.cy.nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node')).map((n) => n.id() + ':' + n.position('x') + ',' + n.position('y')).sort(); return ids.join('|'); }`;
const posKey = (page) => page.evaluate(([uiSrc, d]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    // eslint-disable-next-line no-new-func
    return new Function(`return (${d})`)()(ui);
}, [UI_SRC, DIGEST_SRC]);
const DEF = { strength: 0.7, spacing: 40, exits: 'border' };

/** Zoom on the boxes whose floor is in `floors` (label "Floor 0A", "Floor −1B" …). */
const zoomFloors = (page, floors) => page.evaluate(([src, want]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${src}`)();
    const boxes = ui.floorBoxes.report().filter((b) => b.box && want.some((f) => new RegExp(`^Floor ${f}[A-Z]+$`).test(b.label)));
    const ids = boxes.flatMap((b) => b.members);
    ui.cy.fit(ui.cy.collection(ids.map((id) => ui.cy.getElementById(id))), 40);
    ui.floorBoxes.sync();
    return boxes.map((b) => b.label).sort();
}, [UI_SRC, floors]);
const FLOORS_M2_0 = ['0', '\u22121', '\u22122'];

const out = { errors: {}, measure: {}, shots: {} };
const browser = await chromium.launch();
try {
    {
        const { context, page, errors } = await openDesktop(browser, 'seedling_playthrough');
        for (const view of ['separate', 'merged']) {
            await switchView(page, view);
            await grabUi(page, view === 'merged');
            out.measure[view] = {
                before: row(await runDirection(page, DEF, { grouping: 'twoStep' }, { before: true })),
                after: row(await runDirection(page, DEF, { grouping: 'twoStep' })),
            };
            const k1 = await posKey(page);
            await runDirection(page, DEF, { grouping: 'twoStep' });
            out.measure[view].repeatSame = k1 === (await posKey(page));
        }
        await bakesLanded(page);
        for (const [tag, before] of [['before', true], ['after', false]]) {
            out.shots[`merged-map-${tag}`] = row(await runDirection(page, DEF, { grouping: 'twoStepBoxes' }, { before }));
            await bakesLanded(page);
            await page.screenshot({ path: join(OUT, `seedling-merged-map-${tag}.png`), clip: await graphClip(page) });
            out.shots[`zoom-${tag}`] = await zoomFloors(page, FLOORS_M2_0);
            await bakesLanded(page);
            await page.screenshot({ path: join(OUT, `seedling-floors-m2-0-${tag}.png`), clip: await graphClip(page) });
        }
        await runDirection(page, DEF, { grouping: 'none' });
        await setSetting(page, LOOK_KEY, 'graph');
        await switchView(page, 'separate');
        out.errors.desktop = errors;
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
        await switchView(page, 'merged');
        await grabUi(page, true);
        out.phone = row(await runDirection(page, DEF, { grouping: 'twoStepBoxes' }));
        await bakesLanded(page);
        out.phone.horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        await page.screenshot({ path: join(OUT, 'phone-390-after.png') });
        await runDirection(page, DEF, { grouping: 'none' });
        await setSetting(page, LOOK_KEY, 'graph');
        await switchView(page, 'separate');
        out.errors.phone = errors;
        await context.close();
    }
} catch (e) {
    out.failed = String(e?.stack ?? e);
    process.exitCode = 1;
} finally {
    await browser.close();
    console.log(JSON.stringify(out, null, 2));
}
