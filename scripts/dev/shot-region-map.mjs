/**
 * Region Map screenshots (region-map step 3b) — drives the running app with Playwright, opens the Region Map panel
 * on a preset, lifts the panel's root into a full-viewport overlay (so the picture does not depend on the layout's
 * column widths), waits for every requested Seedling bake, and writes PNGs:
 *
 *   node scripts/dev/shot-region-map.mjs --port=8140 --out=<dir> [--wait-for-box=<sec>]
 *
 * Shots (one fresh page per preset):
 *   seedling_playthrough-level.png        cells sized by level (the default), fit all (zoomed out: minimum-size squares)
 *   seedling_playthrough-uniform.png      uniform cells, fit all
 *   seedling_playthrough-level-zoom.png   sized by level, zoomed onto the start level (art + squares at tile size)
 *   seedling_playthrough-discovery.png    discovery on, only the start level discovered: the frontier as fog
 *   seedling_playthrough-follow.png       follow player after a region move and a few checks, mid-game
 *   seedling_generated_chestdoor.png      a generated Seedling preset (the stored grid_cell path)
 *   alttp.png                             a classic AP world (generic layout, generic boxes)
 * and `perf.json`: per preset, the panel's counters (open → first paint, paints, art redraws, model build) and the
 * Seedling painter's (bakes, first request → last bake / last redraw).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt = null) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out', null);
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map.mjs', kind: 'browser' });

const HOST = `http://localhost:${PORT}`;
const perf = {};

async function boot(browser, game) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${HOST}/frontend/?game=${game}&seed=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    await page.waitForFunction(async () => {
        const sm = await import('/frontend/modules/stateManager/index.js');
        return !!sm.getLastRawJsonData()?.rawJsonData && (sm.stateManagerProxySingleton.getStaticData()?.regions?.size ?? 0) > 0;
    }, null, { timeout: 90000, polling: 250 });
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
        window.__rmStats = (await import('/frontend/modules/flashPanel/seedlingCompositeMap.js')).seedlingCompositeMapStats;
    });
    await page.waitForFunction(() => window.__rm?.getDebugState()?.lastPaint?.cells > 0, null, { timeout: 30000, polling: 100 });
    return { page, errors };
}

// ⛔ A SYNCHRONOUS predicate: `waitForFunction` with an async one resolves at once (a Promise is truthy).
const settle = async (page) => {
    await page.waitForTimeout(200);
    await page.waitForFunction(() => window.__rmStats().pending === 0, null, { timeout: 120000, polling: 250 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

async function shot(page, name) {
    await settle(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, name) });
    console.log('wrote', name);
}

const setSetting = (page, key, value) => page.evaluate(async ([k, v]) => {
    const sm = (await import('/frontend/app/core/settingsManager.js')).default;
    await sm.updateSetting(`moduleSettings.${k}`, v, { persist: false });
    await new Promise((r) => setTimeout(r, 300));
}, [key, value]);

const record = (page, game) => page.evaluate(() => {
    const st = window.__rmStats();
    const d = window.__rm.getDebugState();
    return {
        cells: d.displayRegions.length, groups: d.groups, layout: d.layoutStats.source, panel: d.counters,
        bakes: { requested: st.requested, baked: st.baked, failed: st.failed, redraws: st.redraws,
            firstRequestToLastBakeMs: st.lastBakeAt != null ? st.lastBakeAt - st.firstRequestAt : null,
            firstRequestToLastRedrawMs: st.lastRedrawAt != null ? st.lastRedrawAt - st.firstRequestAt : null },
    };
}).then((r) => { perf[game] = r; });

const browser = await chromium.launch();
try {
    // ── seedling_playthrough ──
    {
        const { page, errors } = await boot(browser, 'seedling_playthrough');
        await page.evaluate(() => window.__rm.fitAll());
        await shot(page, 'seedling_playthrough-level.png');
        await record(page, 'seedling_playthrough');
        await page.evaluate(() => {
            const p = window.__rm;
            const f = p.frames.get(p.model.layout.start);
            p.setCamera({ x: f.cell.x + f.cell.w / 2, y: f.cell.y + f.cell.h / 2, zoom: Math.min(p.vp.w / f.cell.w, p.vp.h / f.cell.h) * 0.9 });
        });
        await shot(page, 'seedling_playthrough-level-zoom.png');
        await setSetting(page, 'regionMap.cellSize', 'uniform');
        await page.evaluate(() => window.__rm.fitAll());
        await shot(page, 'seedling_playthrough-uniform.png');
        await setSetting(page, 'regionMap.cellSize', 'level');

        // follow player, mid-game: check the accessible locations of the start level, then move into another group
        await page.evaluate(async () => {
            const p = window.__rm;
            const sm = (await import('/frontend/modules/stateManager/index.js')).stateManagerProxySingleton;
            const gs = (await import('/frontend/modules/gameState/singleton.js')).getGameStateSingleton();
            const view = p.view.get();
            const startKey = p.model.layout.start;
            const acc = [...view.locations.values()].filter((l) => l.state === 'accessible'
                && view.regions.get(l.region)?.displayKey === startKey).slice(0, 4);
            for (const l of acc) await sm.checkLocation(l.name);
            const target = [...view.regions.values()].find((r) => r.displayKey !== startKey
                && p.model.groupOf.get(r.displayKey) !== p.model.groupOf.get(startKey) && r.reachable);
            p.follow = true;
            p.controls.follow.checked = true;
            gs.setCurrentRegion(target?.name ?? [...view.regions.keys()][5]);
        });
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
            const p = window.__rm;
            p.camera = { ...p.camera, zoom: p.camera.zoom * 0.35 };
            p._requestPaint();
        });
        await shot(page, 'seedling_playthrough-follow.png');

        // discovery: only the start level discovered
        await setSetting(page, 'discovery.enableDiscoveryMode', true);
        await page.evaluate(async () => {
            const p = window.__rm;
            const disc = (await import('/frontend/modules/discovery/singleton.js')).default;
            const gs = (await import('/frontend/modules/gameState/singleton.js')).getGameStateSingleton();
            disc.clearDiscovery();
            const startKey = p.model.layout.start;
            for (const m of p.view.get().displayGroups.get(startKey)?.members ?? []) disc.discoverRegion(m);
            gs.setCurrentRegion(p.view.get().displayGroups.get(startKey).members[0]);
            await new Promise((r) => setTimeout(r, 600));
            p.fitAll();
        });
        await shot(page, 'seedling_playthrough-discovery.png');
        if (errors.length) console.log('page errors:', errors);
        await page.close();
    }
    for (const game of ['seedling_generated_chestdoor', 'alttp']) {
        const { page, errors } = await boot(browser, game);
        await page.evaluate(() => window.__rm.fitAll());
        await shot(page, `${game}.png`);
        await record(page, game);
        if (errors.length) console.log(`${game} page errors:`, errors);
        await page.close();
    }
} finally {
    await browser.close();
}
writeFileSync(join(OUT, 'perf.json'), `${JSON.stringify(perf, null, 2)}\n`);
console.log(JSON.stringify(perf, null, 2));
