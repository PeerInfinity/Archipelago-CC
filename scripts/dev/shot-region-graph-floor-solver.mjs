/**
 * Region Graph floor numbers from the CONSTRAINT SOLVE (region-graph-floor-solver): screenshots and the solve's cost
 * in the browser.
 *
 * Desktop (1600 × 1000, `layout=desktop`), seedling_playthrough, merged + map look, Floor grouping = Two-step +
 * boxes, Direction-aware defaults (strength 0.7, spacing 40, border doors, floor gap 160). The layout is the same in
 * both shots (only the numbers changed); "before" relabels the boxes with region-graph-floors' BFS numbering, run
 * in-page from the base commit's own `floors.js` (`git show <base>:…`, its `floorNumbers` / `floorLabels`):
 *   seedling-merged-map-before.png / -after.png       the whole graph
 *   seedling-level5-level7-before.png / -after.png    zoomed on the former conflicts (`level_5`, `level_7`) and the
 *                                                     floors around them (`level_2`, `level_8`)
 * The cost (JSON): the solve's own time inside the layout (`report.floors.solveMs`, the panel's code on this boot) for
 * merged and separate, 1 cold + 10 warm runs each; and the whole layout's `totalMs`.
 *
 * Bundled (`--bundled`, after `npm run build`): settings via the bundle's `window.settingsManager`; the settle and
 * bake waits import a second module copy there, so they return at once (the cost runs do not depend on them).
 *
 * Usage: node scripts/dev/shot-region-graph-floor-solver.mjs --port=8144 [--bundled] [--out=CC/docs/region-graph/floor-solver-shots]
 *        [--base=63985e6987] [--no-shots]
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
const OUT = arg('out', 'CC/docs/region-graph/floor-solver-shots');
const BASE = arg('base', '63985e6987');
const BUNDLED = process.argv.includes('--bundled');
const SHOTS = !process.argv.includes('--no-shots');
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-floor-solver.mjs', kind: 'browser' });

// The base's BFS numbering, as a function body that returns { floorNumbers, floorLabels }.
const baseSrc = execFileSync('git', ['show', `${BASE}:frontend/modules/regionGraph/floors.js`], { encoding: 'utf8' });
const from = baseSrc.indexOf('const cmp =');
const OLD_SRC = `${baseSrc.slice(from).replace(/^export /gm, '')}\nreturn { floorNumbers, floorLabels };`;
if (from < 0 || !/function floorNumbers/.test(OLD_SRC)) throw new Error(`no BFS numbering in ${BASE}:floors.js`);

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
 * relabel the boxes with the base's BFS numbering (the layout is the same; only the labels differ).
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
        const model = ui.mapLook.regionMapModel().model;
        const labels = old.floorLabels(old.floorNumbers(model));
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

/** Zoom on the former conflicts: the members of the groups `level_5`, `level_7`, `level_2`, `level_8`. */
const zoom = (page) => page.evaluate((uiSrc) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    const model = ui.mapLook.regionMapModel().model;
    const want = new Set(['level_5', 'level_7', 'level_2', 'level_8']);
    const nodes = ui.cy.nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node')
        && want.has(model.groupOf.get(n.data('groupKey') ?? n.data('regionName') ?? n.id())));
    ui.cy.fit(nodes, 60);
    ui.floorBoxes?.sync?.();
    return nodes.length;
}, UI_SRC);

const out = { boot: BUNDLED ? 'bundled' : 'unbundled', base: BASE, errors: [], cost: {} };
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
    // ── the cost: merged (map look) and separate (graph look), 1 cold + 10 warm ──
    for (const view of ['merged', 'separate']) {
        if (view === 'separate') { await setSetting(page, LOOK_KEY, 'graph'); await switchView(page, 'separate'); }
        const runs = [];
        for (let i = 0; i < 11; i += 1) runs.push(await run(page));
        const ms = runs.map((r) => r.floors.solveMs);
        const warm = ms.slice(1).sort((a, b) => a - b);
        out.cost[view] = {
            nodes: runs[0].nodes, coldMs: ms[0], warmMedianMs: warm[5], warmMaxMs: warm[warm.length - 1], ops: runs[0].floors.solveOps,
            exact: runs[0].floors.exact, layoutTotalMs: runs.map((r) => Math.round(r.totalMs)),
            floors: { numbered: runs[0].floors.numbered, ranged: runs[0].floors.ranged, unreached: runs[0].floors.unreached, contradictions: runs[0].floors.contradictions, spans: runs[0].floors.spans },
        };
    }
    if (SHOTS) {
        await setSetting(page, LOOK_KEY, 'map');
        await switchView(page, 'merged');
        await until(page, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 });
        await bakesLanded(page);
        out.shots = {};
        for (const before of [true, false]) {
            const tag = before ? 'before' : 'after';
            const r = await run(page, { before });
            out.shots[tag] = r.labels;
            await bakesLanded(page);
            await page.screenshot({ path: join(OUT, `seedling-merged-map-${tag}.png`), clip: await graphClip(page) });
            out.shots[`${tag}ZoomNodes`] = await zoom(page);
            await bakesLanded(page);
            await page.screenshot({ path: join(OUT, `seedling-level5-level7-${tag}.png`), clip: await graphClip(page) });
        }
        await run(page); // leave the real labels on
    }
    await setSetting(page, LOOK_KEY, 'graph');
    await setSetting(page, VIEW_KEY, 'separate');
    await context.close();
} catch (e) {
    out.failed = String(e?.stack ?? e);
    process.exitCode = 1;
} finally {
    await browser.close();
    console.log(JSON.stringify(out, null, 2));
}
