/**
 * Region Graph Direction-aware layout, Floor grouping: screenshots and measurements (region-graph-dungeon-groups).
 *
 * Desktop (1600 × 1000, `layout=desktop`), Direction-aware at its defaults (strength 0.7, spacing 40, border doors):
 *   seedling-merged-map-none.png / -soft.png / -twoStep.png / -twoStepBoxes.png   seedling_playthrough, merged + map
 *                                              look, in each Floor grouping value (soft at its default pull, 0.5)
 *   seedling-twoStepBoxes-zoom.png            zoomed on two neighbouring (linked) floor groups, twoStepBoxes
 *   seedling-separate-twoStep.png             seedling_playthrough, separate (307 nodes), twoStep
 *   seedling-grouping-controls.png            the Controls' Direction-aware section, open (the new two controls)
 *   alttp-default.png                         alttp, the default layout (unchanged); alttp's Direction-aware in every
 *                                              value is measured INERT (the same positions as none)
 *   phone-390-twoStepBoxes.png                390 × 844 phone, merged + map, twoStepBoxes
 *
 * Measurements, printed as JSON: seedling_playthrough merged + map and separate, seedling_atlas merged + map, per value
 * (and soft at pull 0.25 / 0.5 / 1): mixing (a node in a floor group of 2+ whose nearest node is another floor group's), the
 * mean / p90 direction-angle error, overlaps, block overlaps, nodes in another floor group's block, boxes drawn, the
 * computation (`report.totalMs`, ONE main-thread block) and the longest task seen (PerformanceObserver `longtask`).
 * Every wait on a layout is the panel's own settled signal (`rg-layoutsettled`, layoutRun.js).
 *
 * Usage: node scripts/dev/shot-region-graph-dungeon-groups.mjs --port=8144 --out=CC/docs/region-graph/dungeon-groups-shots
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
const OUT = arg('out', 'CC/docs/region-graph/dungeon-groups-shots');
const ONLY = arg('only', null);
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-dungeon-groups.mjs', kind: 'browser' });

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
/** Run the Direction-aware layout through the panel (animate off) with `settings` → its report + the longest task. */
const runDirection = (page, settings, grouping = {}) => page.evaluate(async ([uiSrc, s, g]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    const D = await import('/frontend/modules/regionGraph/directionLayout.js');
    const G = await import('/frontend/modules/regionGraph/floorGroups.js');
    ui.directionSettings = D.normaliseDirectionSettings({ ...ui.directionSettings, ...s });
    ui.groupingSettings = G.normaliseGroupingSettings({ ...ui.groupingSettings, ...g });
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
    ui.floorBoxes?.sync?.();
    const shown = [...document.querySelectorAll('.region-graph-panel-container .rg-floor-box')].filter((b) => b.style.display === 'block').length;
    return { ...report, wallMs: wall, longestTaskMs: tasks.length ? Math.max(...tasks) : null, boxesShown: shown };
}, [UI_SRC, settings, grouping]);

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
const row = (rep) => ({ grouping: rep.grouping?.grouping, pull: rep.grouping?.groupStrength, mixed: rep.mixing?.mixed, eligible: rep.mixing?.eligible,
    mean: r1(rep.meanAngleError), p90: r1(rep.p90AngleError), overlaps: rep.overlaps, blockOverlaps: rep.blockOverlaps, intruders: rep.intruders,
    boxes: rep.boxes, boxesShown: rep.boxesShown, totalMs: r1(rep.totalMs), longestTaskMs: r1(rep.longestTaskMs), nodes: rep.nodes,
    floorGroups: rep.floorGroups, ungrouped: rep.ungrouped, sizes: rep.floorGroupSizes, inert: rep.stats?.grouping?.inert ?? null,
    digest: rep.digest });
const DIGEST_SRC = `(ui) => { const ids = ui.cy.nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node')).map((n) => n.id() + ':' + n.position('x') + ',' + n.position('y')).sort(); return ids.join('|'); }`;
const posKey = (page) => page.evaluate(([uiSrc, d]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    // eslint-disable-next-line no-new-func
    return new Function(`return (${d})`)()(ui);
}, [UI_SRC, DIGEST_SRC]);
const VALUES = [['none', {}], ['soft', { groupStrength: 0.5 }], ['twoStep', {}], ['twoStepBoxes', {}]];
const MEASURE = [...VALUES, ['soft', { groupStrength: 0.25 }], ['soft', { groupStrength: 1 }]];
const DEF = { strength: 0.7, spacing: 40, exits: 'border' };

const out = { errors: {}, measure: {} };
const browser = await chromium.launch();
try {
    // ── Measurements ──
    for (const [game, views] of ONLY ? [] : [['seedling_playthrough', ['merged', 'separate']], ['seedling_atlas', ['merged']]]) {
        const { context, page, errors } = await openDesktop(browser, game);
        out.measure[game] = {};
        for (const view of views) {
            await switchView(page, view);
            await grabUi(page, view === 'merged');
            const m = {};
            for (const [g, extra] of MEASURE) {
                const key = g === 'soft' ? `soft@${extra.groupStrength}` : g;
                m[key] = row(await runDirection(page, DEF, { grouping: g, ...extra }));
                // a repeat of the default value: the same positions (determinism in the browser)
                if (g === 'twoStep') m.twoStepRepeatSame = (await posKey(page)) === (await (async () => { await runDirection(page, DEF, { grouping: g }); return posKey(page); })());
            }
            out.measure[game][view] = m;
            await runDirection(page, DEF, { grouping: 'none' });
            await setSetting(page, LOOK_KEY, 'graph');
        }
        await switchView(page, 'separate');
        out.errors[game] = errors;
        await context.close();
    }

    // ── Shots ──
    if (!ONLY || ONLY === 'shots') {
        const { context, page, errors } = await openDesktop(browser, 'seedling_playthrough');
        await switchView(page, 'merged');
        await grabUi(page, true);
        await bakesLanded(page);
        out.shots = {};
        for (const [g, extra] of VALUES) {
            out.shots[g] = row(await runDirection(page, DEF, { grouping: g, ...extra }));
            await bakesLanded(page);
            await page.screenshot({ path: join(OUT, `seedling-merged-map-${g}.png`), clip: await graphClip(page) });
        }
        // twoStepBoxes is the last run: zoom on the two largest LINKED floor groups.
        out.zoom = await page.evaluate(async (src) => {
            // eslint-disable-next-line no-new-func
            const ui = new Function(`return ${src}`)();
            const boxes = ui.floorBoxes.report().filter((b) => b.box);
            const of = new Map();
            for (const b of boxes) for (const id of b.members) of.set(id, b);
            // The two NEAREST linked floor groups (the gap between their boxes; ties: the larger pair).
            let best = null;
            const gapOf = (p, q) => Math.max(0, Math.max(p.x1, q.x1) - Math.min(p.x2, q.x2)) + Math.max(0, Math.max(p.y1, q.y1) - Math.min(p.y2, q.y2));
            ui.cy.edges().forEach((e) => {
                const a = of.get(e.data('source')); const c = of.get(e.data('target'));
                if (!a || !c || a === c) return;
                const gap = gapOf(a.box, c.box);
                const size = a.members.length + c.members.length;
                if (!best || gap < best.gap || (gap === best.gap && size > best.size)) best = { a, c, gap, size };
            });
            if (!best) return null;
            const eles = ui.cy.collection([...best.a.members, ...best.c.members].map((id) => ui.cy.getElementById(id)));
            ui.cy.fit(eles, 70);
            ui.floorBoxes.sync();
            return { floorGroups: [best.a.label, best.c.label], sizes: [best.a.members.length, best.c.members.length], gap: Math.round(best.gap) };
        }, UI_SRC);
        await bakesLanded(page);
        await page.screenshot({ path: join(OUT, 'seedling-twoStepBoxes-zoom.png'), clip: await graphClip(page) });
        await evalCy(page, (cy) => cy.fit(30));
        await page.evaluate(() => {
            const panel = document.querySelector('.region-graph-panel-container');
            if (panel.querySelector('#controlsContent')?.style.display === 'none') panel.querySelector('#controlsHeader')?.click();
            const d = panel.querySelector('details.rg-direction-layout');
            if (d) { d.open = true; panel.querySelector('#floorGrouping').value = 'twoStepBoxes'; panel.querySelector('#floorGrouping').scrollIntoView({ block: 'center' }); }
        });
        await page.screenshot({ path: join(OUT, 'seedling-grouping-controls.png'), clip: await graphClip(page) });
        await page.evaluate(() => document.querySelector('.region-graph-panel-container #controlsHeader')?.click());
        await setSetting(page, LOOK_KEY, 'graph');
        await switchView(page, 'separate');
        out.shots.separateTwoStep = row(await runDirection(page, DEF, { grouping: 'twoStep' }));
        await page.screenshot({ path: join(OUT, 'seedling-separate-twoStep.png'), clip: await graphClip(page) });
        await runDirection(page, DEF, { grouping: 'none' });
        out.errors.shots = errors;
        await context.close();
    }
    if (!ONLY || ONLY === 'shots') {
        const { context, page, errors } = await openDesktop(browser, 'alttp');
        out.alttp = await evalCy(page, (cy) => ({ nodes: cy.nodes('.region').length, preset: document.querySelector('#layoutPreset')?.value }));
        await page.screenshot({ path: join(OUT, 'alttp-default.png'), clip: await graphClip(page) });
        await grabUi(page, false, { hasGroups: false });
        out.alttp.values = {};
        const keys = {};
        for (const [g, extra] of VALUES) {
            out.alttp.values[g] = row(await runDirection(page, DEF, { grouping: g, ...extra }));
            keys[g] = await posKey(page);
        }
        out.alttp.allEqualNone = Object.values(keys).every((k) => k === keys.none);
        out.errors.alttp = errors;
        await context.close();
    }
    if (!ONLY || ONLY === 'shots') {
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
        await page.screenshot({ path: join(OUT, 'phone-390-twoStepBoxes.png') });
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
