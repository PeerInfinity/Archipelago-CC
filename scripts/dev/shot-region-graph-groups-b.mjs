/**
 * Region Graph groups B screenshots (region-graph-groups-b) — `subRegionView` = separate, nested and merged.
 *
 * Desktop (1600 × 1000, `layout=desktop`), seedling_playthrough:
 *   seedling-separate-fcose.png     separate, the Force-Directed (fcose) preset, fit
 *   seedling-nested-fcose.png       nested, fcose, fit
 *   seedling-merged-fcose.png       merged, fcose, fit
 *   seedling-merged-hover.png       the pointer on a merged node: its sub-regions listed
 *   seedling-merged-edge-hover.png  the pointer on a merged edge with 2+ exits: each exit with its own state
 *   seedling-merged-path.png        a tap on a far group node (the default click actions): the path, highlighted
 *   seedling-merged-largest.png     the largest group (by members), location nodes force-shown, zoomed in
 *   seedling-merged-most-locs.png   the group with the most locations, location nodes force-shown, zoomed in
 * Phone (390 × 844, isMobile, hasTouch, DPR 3, the real mobile layout):
 *   phone-390-merged.png            seedling_playthrough, merged, the Region Graph tab
 *
 * Each context is fresh, so the settings it writes never reach another page or the user's own. Prints the counts
 * (with the LIVE rule engine: merged edges, mixed ones), the path, and any page errors as JSON.
 *
 * Usage: node scripts/dev/shot-region-graph-groups-b.mjs --port=8144 --out=CC/docs/region-graph/groups-b-shots
 *        [--wait-for-box=<sec>]
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
const OUT = arg('out', 'CC/docs/region-graph/groups-b-shots');
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-groups-b.mjs', kind: 'browser' });

const KEY = 'moduleSettings.regionGraph.subRegionView';
const CY = () => document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy ?? null;

const waitRules = (page) => page.waitForFunction(async () => {
    const { stateManagerProxySingleton: sm } = await import('/frontend/modules/stateManager/index.js');
    return (sm.getStaticData?.()?.regions?.size ?? 0) > 0 && !!sm.getLatestStateSnapshot?.();
}, null, { timeout: 90000, polling: 500 });

/** Desktop: click the Region Graph tab and maximise its stack (the graph gets the whole window). */
const openGraph = async (page) => {
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    const tab = page.locator('.lm_tab', { hasText: 'Region Graph' }).first();
    await tab.click();
    await tab.evaluate((t) => t.closest('.lm_stack')?.querySelector('.lm_maximise')?.click());
    await page.waitForTimeout(500);
};

const waitGraph = (page, boxes) => page.waitForFunction(([want, cyFn]) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    if (!cy || cy.nodes('.region').length === 0) return false;
    const n = cy.nodes('.region-group').length;
    return want === 'any' ? n > 0 : n === want;
}, [boxes, CY.toString()], { timeout: 90000, polling: 250 });

/** Wait until no region node moved for 1.5 s (the panel's own layout, and its 1 s animation, are over). */
const settle = async (page) => {
    let last = null; let same = 0;
    for (let k = 0; k < 120 && same < 3; k += 1) {
        await page.waitForTimeout(500);
        const now = await page.evaluate((cyFn) => {
            // eslint-disable-next-line no-new-func
            const cy = new Function(`return (${cyFn})()`)();
            return JSON.stringify(cy?.nodes('.region').map((n) => n.position()) ?? null);
        }, CY.toString());
        same = now === last ? same + 1 : 0;
        last = now;
    }
    await page.waitForTimeout(1200); // the layoutstop handler's 1050 ms timeout (save, reseat, fit)
};

const setView = (page, value) => page.evaluate(async ([k, v]) => {
    const { default: sm } = await import('/frontend/app/core/settingsManager.js');
    await sm.updateSetting(k, v);
}, [KEY, value]);

/** Run the layout editor's Force-Directed (fcose) preset, unanimated, then fit. */
const fcose = (page) => page.evaluate(async (cyFn) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    const { RegionGraphLayoutEditor } = await import('/frontend/modules/regionGraph/regionGraphLayoutEditor.js');
    const opts = { ...new RegionGraphLayoutEditor(cy, document.createElement('div')).layoutPresets['fcose-default'],
        animate: false, randomize: true };
    await new Promise((resolve) => { const l = cy.layout(opts); l.one('layoutstop', resolve); l.run(); });
    // A layout run straight on Cytoscape skips the panel's layoutstop, which re-seats the (locked) player marker:
    // put it at the default offset from the current node, as `updatePlayerLocation` does.
    const cur = cy.nodes('.current')[0];
    const player = cy.getElementById('player');
    if (cur && player.length) { player.unlock(); player.position({ x: cur.position('x') + 30, y: cur.position('y') - 30 }); player.lock(); }
    cy.fit(30);
}, CY.toString());

/** Bring the Region Graph tab to the front again (a click action may open another panel in its stack). */
const showGraphTab = async (page) => {
    await page.locator('.lm_tab', { hasText: 'Region Graph' }).first().click();
    await page.waitForTimeout(800);
};

const counts = (page) => page.evaluate((cyFn) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    const regions = cy.nodes('.region');
    const inside = regions.filter((n) => n.isChild()).length;
    return { boxes: cy.nodes('.region-group').length, membersInside: inside, groupsOfOne: regions.length - inside };
}, CY.toString());

const graphClip = (page) => page.evaluate(() => {
    const r = document.querySelector('.region-graph-panel-container').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
});


const waitMerged = (page) => page.waitForFunction((cyFn) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    return !!cy && cy.nodes('.region-group-merged').length > 0;
}, CY.toString(), { timeout: 90000, polling: 250 });

const evalCy = (page, fn, arg = null) => page.evaluate(([cyFn, fnSrc, a]) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    // eslint-disable-next-line no-new-func
    return new Function('cy', 'a', `return (${fnSrc})(cy, a)`)(cy, a);
}, [CY.toString(), fn.toString(), arg]);

const mergedCounts = (page) => evalCy(page, (cy) => ({
    groupNodes: cy.nodes('.region-group-merged').length,
    regionNodes: cy.nodes('.region').length,
    edges: cy.edges().filter((e) => !e.hasClass('region-location-edge')).length,
    edgesWithExits: cy.edges('[exits]').length,
    multiExitEdges: cy.edges('[exits]').filter((e) => e.data('exits').length > 1).length,
    mixedExits: cy.edges('.mixed-exits').length,
    selfLoops: cy.edges().filter((e) => e.source().id() === e.target().id()).length,
}));

/** Move the real pointer onto element `id` (a node's centre, an edge's midpoint). */
const pointAt = async (page, id) => {
    const p = await evalCy(page, (cy, i) => {
        const el = cy.getElementById(i);
        const r = el.isNode() ? el.renderedPosition() : el.renderedMidpoint();
        const box = cy.container().getBoundingClientRect();
        return { x: box.x + r.x, y: box.y + r.y };
    }, id);
    await page.mouse.move(p.x - 40, p.y - 40);
    await page.mouse.move(p.x, p.y, { steps: 5 });
    await page.waitForTimeout(400);
};

const out = { errors: {} };
const browser = await chromium.launch();
try {
    {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${HOST}/frontend/?game=seedling_playthrough&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
        await waitRules(page);
        await openGraph(page);
        await waitGraph(page, 0);
        await settle(page);
        await fcose(page);
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(OUT, 'seedling-separate-fcose.png'), clip: await graphClip(page) });
        out.separate = await mergedCounts(page);

        await setView(page, 'nested');
        await waitGraph(page, 'any');
        await settle(page);
        await fcose(page);
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(OUT, 'seedling-nested-fcose.png'), clip: await graphClip(page) });
        out.nested = await counts(page);

        const t0 = Date.now();
        await setView(page, 'merged');
        await waitMerged(page);
        out.switchMs = Date.now() - t0;
        await settle(page);
        await fcose(page);
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(OUT, 'seedling-merged-fcose.png'), clip: await graphClip(page) });
        out.merged = await mergedCounts(page);

        // Hover a merged node of 4-6 members (the first by key), zoomed so its label reads.
        out.hoverNode = await evalCy(page, (cy) => {
            const nodes = cy.nodes('.region-group-merged').sort((a, b) => (a.data('groupKey') < b.data('groupKey') ? -1 : 1));
            const n = nodes.filter((g) => g.data('members').length >= 4 && g.data('members').length <= 6)[0] ?? nodes[0];
            cy.fit(n.closedNeighborhood(), 120);
            return { id: n.id(), key: n.data('groupKey'), members: n.data('members').length };
        });
        await page.waitForTimeout(500);
        await pointAt(page, out.hoverNode.id);
        out.hoverNode.box = await page.evaluate(() => document.querySelector('.rg-hover-box')?.textContent ?? null);
        await page.screenshot({ path: join(OUT, 'seedling-merged-hover.png'), clip: await graphClip(page) });

        // Hover a merged edge with 2+ exits (a mixed one if there is one).
        out.hoverEdge = await evalCy(page, (cy) => {
            const many = cy.edges('[exits]').filter((e) => e.data('exits').length > 1);
            const byExits = many.sort((a, b) => b.data('exits').length - a.data('exits').length || (a.id() < b.id() ? -1 : 1));
            const e = byExits.filter((x) => x.hasClass('mixed-exits'))[0] ?? byExits[0];
            cy.fit(e.connectedNodes(), 160);
            return { id: e.id(), exits: e.data('exits').length, mixed: e.hasClass('mixed-exits') };
        });
        await page.waitForTimeout(500);
        await pointAt(page, out.hoverEdge.id);
        out.hoverEdge.box = await page.evaluate(() => document.querySelector('.rg-hover-box')?.textContent ?? null);
        await page.screenshot({ path: join(OUT, 'seedling-merged-edge-hover.png'), clip: await graphClip(page) });
        await page.mouse.move(5, 5);

        // A path: the default click actions, a tap on the reachable group node farthest from the player.
        await page.evaluate(async () => {
            const { default: sm } = await import('/frontend/app/core/settingsManager.js');
            const { defaultClickActions } = await import('/frontend/modules/regionView/clickActions.js');
            await sm.updateSetting('moduleSettings.regionGraph.clickActions', defaultClickActions());
        });
        await page.waitForTimeout(1500);
        await waitMerged(page);
        await settle(page);
        out.path = await page.evaluate(async (cyFn) => {
            // eslint-disable-next-line no-new-func
            const cy = new Function(`return (${cyFn})()`)();
            const { regionOfCell } = await import('/frontend/modules/regionView/regionViewModel.js');
            const { stateManagerProxySingleton: sm } = await import('/frontend/modules/stateManager/index.js');
            const { PathFinder } = await import('/frontend/modules/shared/pathfinder.js');
            const pf = new PathFinder(sm);
            const snap = sm.getLatestStateSnapshot();
            const from = (await import('/frontend/modules/gameState/singleton.js')).getGameStateSingleton().getCurrentRegion?.()
                ?? sm.getStartRegions?.()?.[0];
            let best = null;
            cy.nodes('.region-group-merged').forEach((n) => {
                const r = regionOfCell(n.data('groupKey'), n.data('members'));
                if (snap.regionReachability?.[r] !== 'reachable' && snap.regionReachability?.[r] !== true) return;
                const p = pf.findPath(from, r);
                if (p && (!best || p.steps.length > best.len)) best = { id: n.id(), key: n.data('groupKey'), region: r, len: p.steps.length };
            });
            if (!best) return { none: true, from };
            cy.getElementById(best.id).emit('tap');
            for (let k = 0; k < 40 && cy.edges('.in-path').length === 0; k += 1) await new Promise((res) => setTimeout(res, 100));
            const lit = cy.edges('.in-path');
            return { from, ...best, litEdges: lit.length, litNodes: lit.connectedNodes().map((n) => n.id()),
                internalLit: lit.filter((e) => e.source().id() === e.target().id()).length };
        }, CY.toString());
        await showGraphTab(page);
        await evalCy(page, (cy) => cy.fit(cy.edges('.in-path').connectedNodes(), 80));
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(OUT, 'seedling-merged-path.png'), clip: await graphClip(page) });

        // Location nodes on a big group: force-show, zoomed on the largest group and on the one with the most locations.
        await page.evaluate(async () => {
            const { default: sm } = await import('/frontend/app/core/settingsManager.js');
            await sm.updateSetting('moduleSettings.regionGraph.locationVisibility', 'force-show');
        });
        await page.waitForTimeout(1500);
        await showGraphTab(page);
        await waitMerged(page);
        await settle(page);
        for (const [file, which] of [['seedling-merged-largest.png', 'members'], ['seedling-merged-most-locs.png', 'locations']]) {
            const info = await page.evaluate(async ([cyFn, w]) => {
                // eslint-disable-next-line no-new-func
                const cy = new Function(`return (${cyFn})()`)();
                const { stateManagerProxySingleton: sm } = await import('/frontend/modules/stateManager/index.js');
                const regions = sm.getStaticData().regions;
                const locs = (n) => n.data('members').reduce((a, m) => a + (regions.get(m)?.locations?.length ?? 0), 0);
                const nodes = cy.nodes('.region-group-merged').sort((a, b) => (w === 'members'
                    ? b.data('members').length - a.data('members').length : locs(b) - locs(a))
                    || (a.data('groupKey') < b.data('groupKey') ? -1 : 1));
                const n = nodes[0];
                const ring = cy.nodes(`[anchorNode="${n.id()}"]`);
                cy.fit(n.union(ring), 40);
                return { key: n.data('groupKey'), members: n.data('members').length, locations: locs(n), drawn: ring.length,
                    zoom: Math.round(cy.zoom() * 100) / 100 };
            }, [CY.toString(), which]);
            out[which === 'members' ? 'largestGroup' : 'mostLocations'] = info;
            await page.waitForTimeout(600);
            await page.screenshot({ path: join(OUT, file), clip: await graphClip(page) });
        }
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
        await waitRules(page);
        const tabSel = '.mobile-tab[data-component-type="regionGraphPanel"]';
        for (let k = 0; k < 4 && !(await page.$(tabSel)); k += 1) await page.tap('.mobile-nav-left');
        await page.tap(tabSel);
        await waitGraph(page, 0);
        await setView(page, 'merged');
        await waitMerged(page);
        await settle(page);
        await page.screenshot({ path: join(OUT, 'phone-390-merged.png') });
        out.phone = await mergedCounts(page);
        out.phoneHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        out.errors.phone = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(JSON.stringify(out, null, 2));
