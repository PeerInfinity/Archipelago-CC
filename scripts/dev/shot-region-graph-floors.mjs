/**
 * Region Graph, Direction-aware layout, two-step Floor grouping as FLOORS: screenshots and measurements
 * (region-graph-floors).
 *
 * Desktop (1600 × 1000, `layout=desktop`), Direction-aware at its defaults (strength 0.7, spacing 40, border doors):
 *   seedling-merged-map-before.png    seedling_playthrough, merged + map look, twoStepBoxes AS region-graph-dungeon-groups
 *                                     built it (floor links off, box labels = the group's root level)
 *   seedling-merged-map-after.png     the same, with the floors (floor gap 160, the default; floor labels)
 *   seedling-merged-map-gap80.png / -gap320.png   two other floor gaps
 *   seedling-stair-zoom.png           zoomed on one staircase pair: the floor a stair leads to lies in the stair's direction
 *   seedling-separate-twoStepBoxes.png   separate (307 nodes), twoStepBoxes
 *   seedling-floor-controls.png       the Controls' Direction-aware section, open (the Floor gap control)
 *   alttp-default.png                 alttp, its default layout (unchanged); twoStep / twoStepBoxes measured = none
 *   phone-390-twoStepBoxes.png        390 × 844 phone, merged + map, twoStepBoxes
 *
 * Measurements (JSON): seedling_playthrough merged + map and separate, seedling_atlas merged + map: "before" (twoStep,
 * floor links off) and twoStep at floor gaps 0 / 80 / 160 / 320: the FLAT-link angle error (mean / p90; inside a
 * floor group and between two), the VERTICAL-link angle error (mean / p90), the mean flat and vertical link lengths,
 * overlaps, block overlaps, nodes in another's block, the layout's own block (`report.totalMs`) and the longest task.
 * Every wait on a layout is the panel's own settled signal (`rg-layoutsettled`, layoutRun.js).
 *
 * Usage: node scripts/dev/shot-region-graph-floors.mjs --port=8146 --out=CC/docs/region-graph/floors-shots
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
const OUT = arg('out', 'CC/docs/region-graph/floors-shots');
const ONLY = arg('only', null);
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-floors.mjs', kind: 'browser' });

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
    if (b) lcm.buildDirectionLayout = (x, y) => orig.call(lcm, x, y, { floorLinks: false });
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
    if (b) for (const box of ui.floorBoxes?.boxes ?? []) box.label = box.root ?? String(box.floorGroup);
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
const GAPS = [0, 80, 160, 320];

const out = { errors: {}, measure: {} };
const browser = await chromium.launch();
try {
    // ── Measurements ──
    for (const [game, views] of ONLY && ONLY !== 'measure' ? [] : [['seedling_playthrough', ['merged', 'separate']], ['seedling_atlas', ['merged']]]) {
        const { context, page, errors } = await openDesktop(browser, game);
        out.measure[game] = {};
        for (const view of views) {
            await switchView(page, view);
            await grabUi(page, view === 'merged');
            const m = { before: row(await runDirection(page, DEF, { grouping: 'twoStep' }, { before: true })) };
            for (const gap of GAPS) m[`gap${gap}`] = row(await runDirection(page, DEF, { grouping: 'twoStep', floorGap: gap }));
            const k1 = await posKey(page);
            await runDirection(page, DEF, { grouping: 'twoStep', floorGap: GAPS[GAPS.length - 1] });
            m.repeatSame = k1 === (await posKey(page));
            m.boxes = row(await runDirection(page, DEF, { grouping: 'twoStepBoxes', floorGap: 160 }));
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
        const shot = async (name, g, opts) => {
            out.shots[name] = row(await runDirection(page, DEF, g, opts));
            await bakesLanded(page);
            await page.screenshot({ path: join(OUT, `${name}.png`), clip: await graphClip(page) });
        };
        await shot('seedling-merged-map-before', { grouping: 'twoStepBoxes' }, { before: true });
        await shot('seedling-merged-map-gap80', { grouping: 'twoStepBoxes', floorGap: 80 });
        await shot('seedling-merged-map-gap320', { grouping: 'twoStepBoxes', floorGap: 320 });
        await shot('seedling-merged-map-after', { grouping: 'twoStepBoxes', floorGap: 160 });
        // The staircase pair: the vertical edge with the strongest direction between two BOXED floors; zoom on both.
        out.zoom = await page.evaluate(async (src) => {
            // eslint-disable-next-line no-new-func
            const ui = new Function(`return ${src}`)();
            const lcm = ui.layoutControlsManager;
            const inp = lcm.directionLayoutInputs();
            const fl = lcm.floorsOf(inp.model, inp.sidecars, inp.nodes, inp.edges);
            const boxes = ui.floorBoxes.report().filter((b) => b.box);
            const of = new Map();
            for (const b of boxes) for (const id of b.members) of.set(id, b);
            let best = null;
            for (const e of inp.edges) {
                const v = fl.vertical.get(e.id);
                const a = of.get(e.source); const c = of.get(e.target);
                if (!v?.pref || !a || !c || a === c) continue;
                const size = a.members.length + c.members.length;
                const score = v.pref.weight * 100 - size;
                if (!best || score > best.score) best = { e, v, a, c, score };
            }
            if (!best) return null;
            const ps = ui.cy.getElementById(best.e.source).position(); const pt = ui.cy.getElementById(best.e.target).position();
            const dx = pt.x - ps.x; const dy = pt.y - ps.y; const r = Math.hypot(dx, dy);
            const err = Math.acos(Math.max(-1, Math.min(1, (dx * best.v.pref.dx + dy * best.v.pref.dy) / r))) * 180 / Math.PI;
            const eles = ui.cy.collection([...best.a.members, ...best.c.members].map((id) => ui.cy.getElementById(id)));
            ui.cy.fit(eles, 70);
            ui.floorBoxes.sync();
            const exits = fl.exits.filter((x) => (x.fromKey === best.e.source || x.fromKey === best.e.target) && (x.toKey === best.e.source || x.toKey === best.e.target))
                .map((x) => ({ from: x.from, to: x.to, kind: x.kind, exit: x.exitName, u: x.u, v: x.v, dx: x.dx, dy: x.dy }));
            return { edge: [best.e.source, best.e.target], floors: [best.a.label, best.c.label], roots: [best.a.root, best.c.root],
                pref: best.v.pref, actual: { dx: dx / r, dy: dy / r }, angleError: err, length: r, exits };
        }, UI_SRC);
        await bakesLanded(page);
        await page.screenshot({ path: join(OUT, 'seedling-stair-zoom.png'), clip: await graphClip(page) });
        await evalCy(page, (cy) => cy.fit(30));
        await page.evaluate(() => {
            const panel = document.querySelector('.region-graph-panel-container');
            if (panel.querySelector('#controlsContent')?.style.display === 'none') panel.querySelector('#controlsHeader')?.click();
            const d = panel.querySelector('details.rg-direction-layout');
            if (d) { d.open = true; panel.querySelector('#floorGrouping').value = 'twoStepBoxes'; panel.querySelector('#floorGap').scrollIntoView({ block: 'center' }); }
        });
        await page.screenshot({ path: join(OUT, 'seedling-floor-controls.png'), clip: await graphClip(page) });
        await page.evaluate(() => document.querySelector('.region-graph-panel-container #controlsHeader')?.click());
        await setSetting(page, LOOK_KEY, 'graph');
        await switchView(page, 'separate');
        out.shots.separate = row(await runDirection(page, DEF, { grouping: 'twoStepBoxes', floorGap: 160 }));
        await page.screenshot({ path: join(OUT, 'seedling-separate-twoStepBoxes.png'), clip: await graphClip(page) });
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
        for (const [name, g] of [['none', { grouping: 'none' }], ['twoStep', { grouping: 'twoStep' }], ['twoStepBoxes', { grouping: 'twoStepBoxes' }], ['twoStep@600', { grouping: 'twoStep', floorGap: 600 }]]) {
            out.alttp.values[name] = row(await runDirection(page, DEF, g));
            keys[name] = await posKey(page);
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
        out.phone = row(await runDirection(page, DEF, { grouping: 'twoStepBoxes', floorGap: 160 }));
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
