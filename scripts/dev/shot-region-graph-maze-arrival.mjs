/**
 * The maze's exit ARRIVALS on the Region Graph (maze-arrival-spawns): seedling_playthrough_maze, desktop 1600 × 1000
 * (`layout=desktop`), merged + map look, Dungeon grouping = Two-step + boxes, Direction-aware defaults (strength 0.7,
 * spacing 40, border doors, floor gap 160) — the floor-solver shots' settings, on the maze preset.
 *   maze-merged-map-<tag>.png   the whole graph after the Direction-aware layout, with the floor boxes
 *   <tag>-measure.json          the layout's floors report, the boxes shown (label, root) and the link kinds
 * `--tag=before` is taken with `frontend/modules/mazeRoom/mazeRegionMapHooks.js` swapped for the base's (the caller
 * swaps it: `git show <base>:… > …`, then `git checkout -- …`); the preset is the same in both (the old hook ignores
 * `arrivalTile`). The serve must not cache (`scripts/serve-nocache.py`).
 *
 * Usage: node scripts/dev/shot-region-graph-maze-arrival.mjs --port=8144 --tag=before|after [--out=CC/docs/region-map/maze-arrival-shots]
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
const OUT = arg('out', 'CC/docs/region-map/maze-arrival-shots');
const TAG = arg('tag', 'after');
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-maze-arrival.mjs', kind: 'browser' });

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
const run = (page) => page.evaluate(async (uiSrc) => {
    // eslint-disable-next-line no-new-func
    const ui = new Function(`return ${uiSrc}`)();
    window.__rgUi = ui;
    const D = await import('/frontend/modules/regionGraph/directionLayout.js');
    const G = await import('/frontend/modules/regionGraph/dungeonGroups.js');
    ui.directionSettings = D.normaliseDirectionSettings({ strength: 0.7, spacing: 40, exits: 'border' });
    ui.groupingSettings = { ...G.normaliseGroupingSettings({ grouping: 'twoStepBoxes', groupStrength: 0.5 }), floorGap: 160 };
    const report = ui.layoutControlsManager.runDirectionLayout({ animate: false });
    ui.cy.fit(30);
    ui.dungeonBoxes?.sync?.();
    const model = ui.mapLook.regionMapModel().model;
    const kinds = {};
    for (const l of model.layout.graph.links) kinds[l.kind] = (kinds[l.kind] ?? 0) + 1;
    const shown = [...document.querySelectorAll('.region-graph-panel-container .rg-dungeon-box')].filter((x) => x.style.display === 'block');
    return { floors: report.floors, totalMs: report.totalMs, nodes: report.nodes, groups: model.layout.groups.length, kinds,
        labels: shown.map((x) => [x.textContent, x.dataset.root]) };
}, UI_SRC);

const out = { tag: TAG, errors: [] };
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e)));
    await page.goto(`${HOST}/frontend/?game=seedling_playthrough_maze&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
    await until(page, rulesLoaded);
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    const tab = page.locator('.lm_tab', { hasText: 'Region Graph' }).first();
    await tab.click();
    await tab.evaluate((t) => t.closest('.lm_stack')?.querySelector('.lm_maximise')?.click());
    await cyHas(page, (cy) => cy.nodes('.region').length > 0);
    await settle(page);
    await switchView(page, 'merged');
    await setSetting(page, LOOK_KEY, 'map');
    await until(page, () => !!document.querySelector('.rg-map-look-canvas'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const r = await run(page);
    await page.waitForTimeout(1500);
    out.run = { nodes: r.nodes, groups: r.groups, kinds: r.kinds, totalMs: Math.round(r.totalMs),
        floors: { numbered: r.floors?.numbered, ranged: r.floors?.ranged, unreached: r.floors?.unreached, contradictions: r.floors?.contradictions, spans: r.floors?.spans },
        boxes: r.labels };
    await page.screenshot({ path: join(OUT, `maze-merged-map-${TAG}.png`), clip: await graphClip(page) });
    await setSetting(page, LOOK_KEY, 'graph');
    await setSetting(page, VIEW_KEY, 'separate');
    await context.close();
} catch (e) {
    out.failed = String(e?.stack ?? e);
    process.exitCode = 1;
} finally {
    await browser.close();
    fs.writeFileSync(join(OUT, `${TAG}-measure.json`), `${JSON.stringify(out, null, 2)}\n`);
    console.log(JSON.stringify(out, null, 2));
}
