/**
 * Region Graph floor LETTERS and the Floor grouping rename (region-graph-floor-rename-letters): screenshots.
 *
 * Desktop (1600 × 1000, `layout=desktop`), seedling_playthrough, merged + map look (Region Map cells), Floor grouping
 * = Two-step + boxes, Direction-aware defaults. The layout and the solve are the same in both shots (no layout or
 * solver change); "before" relabels the boxes with the base commit's own `floorLabels` ("Ground floor", " · k"), run
 * in-page from `git show <base>:frontend/modules/regionGraph/floorSolver.js` over this boot's solve:
 *   seedling-merged-map-before.png / -after.png       the whole graph
 *   seedling-floor-minus1-before.png / -after.png     zoomed on the Floor −1 groups (several letters on one floor)
 *   seedling-floor-controls.png                       the Controls, Direction-aware section ("Floor grouping:", "Floor pull:")
 *   phone-390-twoStepBoxes.png                        390 px phone, merged + map look, Two-step + boxes
 *
 * Usage: node scripts/dev/shot-region-graph-floor-letters.mjs --port=8143 [--bundled] [--out=CC/docs/region-graph/floor-letters-shots]
 *        [--base=b6863466be]
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
};
const PORT = arg('port', process.env.TEST_PORT || '8000');
const OUT = arg('out', 'CC/docs/region-graph/floor-letters-shots');
const BASE = arg('base', 'b6863466be');
const BUNDLED = process.argv.includes('--bundled');
const SHOTS = !process.argv.includes('--no-shots');
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-floor-letters.mjs', kind: 'browser' });

// The base's labels (" · k", "Ground floor"), as a function body that returns { floorLabels }.
const baseSrc = execFileSync('git', ['show', `${BASE}:frontend/modules/regionGraph/floorSolver.js`], { encoding: 'utf8' });
const from = baseSrc.indexOf('const signed =');
const OLD_SRC = `const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);\n${baseSrc.slice(from).replace(/^export /gm, '')}\nreturn { floorLabels };`;
if (from < 0 || !/Ground floor/.test(OLD_SRC)) throw new Error(`no old labels in ${BASE}:floorSolver.js`);

const VIEW_KEY = 'moduleSettings.regionGraph.subRegionView';
const LOOK_KEY = 'moduleSettings.regionGraph.nodeLook';
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
const cyHas = (page, fn, a = null) => until(page, ([cyFn, fnSrc, x]) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    // eslint-disable-next-line no-new-func
    return !!cy && new Function('cy', 'a', `return (${fnSrc})(cy, a)`)(cy, x);
}, [CY.toString(), fn.toString(), a]);
// ⚠ Bundled, a dynamic import() loads a SECOND copy of a module (not the bundle's): the settings go through the
// bundle's own `window.settingsManager`, and the boot is ready when the graph has drawn (no stateManager probe).
const setSetting = (page, k, v) => page.evaluate(async ([key, value]) => {
    const sm = window.settingsManager ?? (await import('/frontend/app/core/settingsManager.js')).default;
    await sm.updateSetting(key, value);
}, [k, v]);
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
const UI_SRC = `(() => {
    const layer = document.querySelector('.region-graph-panel-container .rg-map-look-canvas')?.mapLook;
    if (layer) return layer.ui;
    return window.__rgUi ?? null;
})()`;
const switchView = async (page, view) => {
    await setSetting(page, VIEW_KEY, view);
    await cyHas(page, (cy, v) => (v === 'separate' ? cy.nodes('.region-group-merged').length === 0 && cy.nodes('.region-group').length === 0
        : cy.nodes('.region-group-merged').length > 0), view);
    await settle(page);
};

/**
 * Run the Direction-aware layout (animate off; twoStepBoxes, the defaults) → the report and the boxes shown. `before`:
 * relabel the boxes with the base's labels over the same solve (the layout is the same; only the labels differ).
 */
const run = (page, { before = false } = {}) => page.evaluate(async ([uiSrc, oldSrc, b]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    window.__rgUi = ui;
    const D = await import('/frontend/modules/regionGraph/directionLayout.js');
    const G = await import('/frontend/modules/regionGraph/floorGroups.js');
    ui.directionSettings = D.normaliseDirectionSettings({ strength: 0.7, spacing: 40, exits: 'border' });
    ui.groupingSettings = { ...G.normaliseGroupingSettings({ grouping: 'twoStepBoxes', groupStrength: 0.5 }), floorGap: 160 };
    const report = ui.layoutControlsManager.runDirectionLayout({ animate: false });
    if (b) {
        // eslint-disable-next-line no-new-func
        const old = new Function(oldSrc)();
        const FS = await import('/frontend/modules/regionGraph/floorSolver.js');
        const labels = old.floorLabels(FS.solveFloors(ui.mapLook.regionMapModel().model));
        for (const box of ui.floorBoxes?.boxes ?? []) {
            box.label = labels.get(box.root) ?? box.label;
            if (box.el) { box.el.textContent = box.label; box.el.title = `${box.label} (${box.root})`; }
        }
    }
    ui.cy.fit(30);
    ui.floorBoxes?.sync?.();
    const shown = [...document.querySelectorAll('.region-graph-panel-container .rg-floor-box')].filter((x) => x.style.display === 'block');
    return { floors: report.floors, totalMs: report.totalMs, nodes: report.nodes, labels: shown.map((x) => [x.textContent, x.dataset.root]) };
}, [UI_SRC, OLD_SRC, before]);

/** Zoom on the boxes whose label is on `floor` (e.g. "Floor −1"): every group of that floor. */
const zoomFloor = (page, floorRe) => page.evaluate(([uiSrc, re]) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    const rx = new RegExp(re);
    const boxes = (ui.floorBoxes?.boxes ?? []).filter((b) => rx.test(b.label));
    const ids = new Set(boxes.flatMap((b) => b.members));
    const nodes = ui.cy.nodes().filter((n) => ids.has(n.id()));
    ui.cy.fit(nodes, 60);
    ui.floorBoxes?.sync?.();
    return boxes.map((b) => b.label);
}, [UI_SRC, floorRe]);

const out = { boot: BUNDLED ? 'bundled' : 'unbundled', base: BASE, errors: [], shots: {} };
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e)));
    await page.goto(`${HOST}/frontend/?game=seedling_playthrough&seed=1&layout=desktop${BUNDLED ? '&bundled=true' : ''}`, { waitUntil: 'domcontentloaded' });
    if (!BUNDLED) await until(page, rulesLoaded);
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    const tab = page.locator('.lm_tab', { hasText: 'Region Graph' }).first();
    await tab.click();
    await tab.evaluate((t) => t.closest('.lm_stack')?.querySelector('.lm_maximise')?.click());
    await cyHas(page, (cy) => cy.nodes('.region').length > 0);
    await settle(page);
    await switchView(page, 'merged');
    await setSetting(page, LOOK_KEY, 'map');
    await until(page, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 });
    await bakesLanded(page);
    for (const before of [true, false]) {
        const tag = before ? 'before' : 'after';
        const r = await run(page, { before });
        out.shots[tag] = r.labels;
        await bakesLanded(page);
        await page.screenshot({ path: join(OUT, `seedling-merged-map-${tag}.png`), clip: await graphClip(page) });
        // before: "Floor −1 · k"; after: "Floor −1A" …
        out.shots[`${tag}Zoom`] = await zoomFloor(page, '^Floor \u22121( |[A-Z]|$)');
        await bakesLanded(page);
        await page.screenshot({ path: join(OUT, `seedling-floor-minus1-${tag}.png`), clip: await graphClip(page) });
    }
    await run(page);
    await page.evaluate(() => {
        const panel = document.querySelector('.region-graph-panel-container');
        if (panel.querySelector('#controlsContent')?.style.display === 'none') panel.querySelector('#controlsHeader')?.click();
        const d = panel.querySelector('details.rg-direction-layout');
        if (d) { d.open = true; panel.querySelector('#floorGrouping').value = 'twoStepBoxes'; panel.querySelector('#floorGrouping').scrollIntoView({ block: 'center' }); }
    });
    out.controls = await page.evaluate(() => {
        const panel = document.querySelector('.region-graph-panel-container');
        const txt = (sel) => panel.querySelector(sel)?.closest('label')?.innerText?.replace(/\s+/g, ' ').trim() ?? null;
        return { grouping: txt('#floorGrouping'), pull: txt('#floorGroupStrength'), groupingTitle: panel.querySelector('#floorGrouping')?.closest('label')?.title ?? null };
    });
    await page.screenshot({ path: join(OUT, 'seedling-floor-controls.png'), clip: await graphClip(page) });
    await page.evaluate(() => document.querySelector('.region-graph-panel-container #controlsHeader')?.click());
    await setSetting(page, LOOK_KEY, 'graph');
    await setSetting(page, VIEW_KEY, 'separate');
    await context.close();

    const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
    const pc = await browser.newContext(PHONE);
    const pp = await pc.newPage();
    pp.on('pageerror', (e) => out.errors.push(`phone: ${e}`));
    await pp.goto(`${HOST}/frontend/?game=seedling_playthrough&seed=1${BUNDLED ? '&bundled=true' : ''}`, { waitUntil: 'domcontentloaded' });
    await pp.waitForSelector('.mobile-tab', { timeout: 90000 });
    if (!BUNDLED) await until(pp, rulesLoaded);
    const tabSel = '.mobile-tab[data-component-type="regionGraphPanel"]';
    for (let k = 0; k < 4 && !(await pp.$(tabSel)); k += 1) await pp.tap('.mobile-nav-left');
    await pp.tap(tabSel);
    await cyHas(pp, (cy) => cy.nodes('.region').length > 0);
    await switchView(pp, 'merged');
    await setSetting(pp, LOOK_KEY, 'map');
    await until(pp, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 });
    await bakesLanded(pp);
    const r = await run(pp);
    out.phone = { labels: r.labels.length, sample: r.labels.slice(0, 4), horizontalScroll: await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) };
    await bakesLanded(pp);
    await pp.screenshot({ path: join(OUT, 'phone-390-twoStepBoxes.png') });
    await setSetting(pp, LOOK_KEY, 'graph');
    await setSetting(pp, VIEW_KEY, 'separate');
    await pc.close();
} catch (e) {
    out.failed = String(e?.stack ?? e);
    process.exitCode = 1;
} finally {
    await browser.close();
    console.log(JSON.stringify(out, null, 2));
}
