/**
 * Region Graph groups C screenshots and timings (region-graph-groups-c) — `subRegionView` = collapsible.
 *
 * Desktop (1600 × 1000, `layout=desktop`), seedling_playthrough:
 *   seedling-collapsible-closed.png    collapsible, every group closed (= merged), fcose, fit: a + badge on each
 *   seedling-collapsible-one-open.png  one group opened with its + badge (a real pointer click), beside closed ones
 *   seedling-collapsible-badge-zoom.png  a closed node's + badge and an open box's − badge, zoomed in
 * Phone (390 × 844, isMobile, hasTouch, DPR 3, the real mobile layout):
 *   phone-390-badge-tapped.png         at the zoom where region labels first show (0.5), a TOUCH tap at a badge's
 *                                      centre: elementFromPoint there is the badge, and the tap opens the group
 *
 * Timings: N open / close pairs by real pointer clicks on seedling_playthrough, each read off the layer
 * (`data-last-toggle-ms`: `setSubRegionGroupOpen`, the rebuild included) and as wall time from the click to the next
 * frame with the box drawn. Prints counts, timings, the badge's on-screen size and any page errors as JSON.
 *
 * Usage: node scripts/dev/shot-region-graph-groups-c.mjs --port=8144 --out=CC/docs/region-graph/groups-c-shots
 *        [--pairs=5]
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
const OUT = arg('out', 'CC/docs/region-graph/groups-c-shots');
const PAIRS = Number(arg('pairs', '5'));
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-groups-c.mjs', kind: 'browser' });

const KEY = 'moduleSettings.regionGraph.subRegionView';
const CY = () => document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy ?? null;

const waitRules = (page) => page.waitForFunction(async () => {
    const { stateManagerProxySingleton: sm } = await import('/frontend/modules/stateManager/index.js');
    return (sm.getStaticData?.()?.regions?.size ?? 0) > 0 && !!sm.getLatestStateSnapshot?.();
}, null, { timeout: 90000, polling: 500 });

const openGraph = async (page) => {
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    const tab = page.locator('.lm_tab', { hasText: 'Region Graph' }).first();
    await tab.click();
    await tab.evaluate((t) => t.closest('.lm_stack')?.querySelector('.lm_maximise')?.click());
    await page.waitForTimeout(500);
};

const evalCy = (page, fn, a = null) => page.evaluate(([cyFn, fnSrc, x]) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    // eslint-disable-next-line no-new-func
    return new Function('cy', 'a', `return (${fnSrc})(cy, a)`)(cy, x);
}, [CY.toString(), fn.toString(), a]);

const waitFor = (page, fn, a = null) => page.waitForFunction(([cyFn, fnSrc, x]) => {
    // eslint-disable-next-line no-new-func
    const cy = new Function(`return (${cyFn})()`)();
    // eslint-disable-next-line no-new-func
    return !!cy && new Function('cy', 'a', `return (${fnSrc})(cy, a)`)(cy, x);
}, [CY.toString(), fn.toString(), a], { timeout: 90000, polling: 100 });

const settle = async (page) => {
    let last = null; let same = 0;
    for (let k = 0; k < 120 && same < 3; k += 1) {
        await page.waitForTimeout(500);
        const now = await evalCy(page, (cy) => JSON.stringify(cy?.nodes().map((n) => n.position()) ?? null));
        same = now === last ? same + 1 : 0;
        last = now;
    }
    await page.waitForTimeout(1200);
};

const setView = (page, value) => page.evaluate(async ([k, v]) => {
    const { default: sm } = await import('/frontend/app/core/settingsManager.js');
    await sm.updateSetting(k, v);
}, [KEY, value]);

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

/** The badge of `key` (or of the first closed group): its centre on the page, size, glyph and what is under its centre. */
const badgeInfo = (page, key = null) => page.evaluate((k) => {
    const all = [...document.querySelectorAll('.region-graph-panel-container .rg-group-badge')];
    const btn = k ? all.find((b) => b.dataset.groupKey === k) : all.find((b) => b.style.display === 'block' && b.dataset.open === 'false');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const g = btn.firstElementChild.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const under = document.elementFromPoint(x, y);
    return { key: btn.dataset.groupKey, open: btn.dataset.open, shown: btn.style.display === 'block', x, y,
        hit: { w: r.width, h: r.height }, visible: { w: g.width, h: g.height }, glyph: btn.textContent,
        underIsBadge: !!under && btn.contains(under), under: under?.tagName ?? null, badges: all.length };
}, key);

const lastToggleMs = (page) => page.evaluate(() => Number(document.querySelector('.region-graph-group-badges')?.dataset.lastToggleMs ?? NaN));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

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
        await waitFor(page, (cy) => cy.nodes('.region').length > 0);
        await settle(page);
        await setView(page, 'collapsible');
        await waitFor(page, (cy) => cy.nodes('.region-group-merged').length > 0);
        await settle(page);
        await fcose(page);
        await page.waitForTimeout(800);
        out.closed = await evalCy(page, (cy) => ({ merged: cy.nodes('.region-group-merged').length, boxes: cy.nodes('.region-group').length
            - cy.nodes('.region-group-merged').length, regions: cy.nodes('.region').length, edges: cy.edges().length, zoom: cy.zoom() }));
        out.closed.badges = await page.evaluate(() => document.querySelectorAll('.rg-group-badge').length);
        await page.screenshot({ path: join(OUT, 'seedling-collapsible-closed.png'), clip: await graphClip(page) });

        // Zoom onto a closed group of 4-6 members (first by key) and its neighbours, so the badge is in reach.
        out.group = await evalCy(page, (cy) => {
            const nodes = cy.nodes('.region-group-merged').sort((a, b) => (a.data('groupKey') < b.data('groupKey') ? -1 : 1));
            const n = nodes.filter((g) => g.data('members').length >= 4 && g.data('members').length <= 6)[0] ?? nodes[0];
            cy.fit(n.closedNeighborhood(), 160);
            return { key: n.data('groupKey'), members: n.data('members').length, zoom: cy.zoom() };
        });
        await page.waitForTimeout(600);
        const opens = []; const closes = []; const openWall = []; const closeWall = [];
        for (let i = 0; i < PAIRS; i += 1) {
            const b = await badgeInfo(page, out.group.key);
            const t0 = Date.now();
            await page.mouse.click(b.x, b.y);
            await waitFor(page, (cy, k) => cy.getElementById(`region-group:${k}`).isParent(), out.group.key);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
            openWall.push(Date.now() - t0);
            opens.push(await lastToggleMs(page));
            await page.waitForTimeout(300);
            if (i === PAIRS - 1) break; // leave the last one open for the shot
            const m = await badgeInfo(page, out.group.key);
            const t1 = Date.now();
            await page.mouse.click(m.x, m.y);
            await waitFor(page, (cy, k) => !cy.getElementById(`region-group:${k}`).isParent(), out.group.key);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
            closeWall.push(Date.now() - t1);
            closes.push(await lastToggleMs(page));
            await page.waitForTimeout(300);
        }
        out.timing = { opens, closes, openWall, closeWall, medianOpenMs: median(opens), medianCloseMs: median(closes),
            medianOpenWallMs: median(openWall), medianCloseWallMs: median(closeWall) };
        out.oneOpen = await evalCy(page, (cy, k) => ({ boxes: cy.nodes('.region-group').length - cy.nodes('.region-group-merged').length,
            merged: cy.nodes('.region-group-merged').length, inside: cy.getElementById(`region-group:${k}`).children().length,
            clicksSelected: cy.nodes(':selected').length }), out.group.key);
        await page.screenshot({ path: join(OUT, 'seedling-collapsible-one-open.png'), clip: await graphClip(page) });

        // Zoomed in: the open box's − and the nearest closed node's +.
        out.zoomed = await evalCy(page, (cy, k) => {
            const box = cy.getElementById(`region-group:${k}`);
            const near = cy.nodes('.region-group-merged').sort((a, b) => {
                const d = (n) => Math.hypot(n.position('x') - box.position('x'), n.position('y') - box.position('y'));
                return d(a) - d(b);
            })[0];
            cy.fit(box.union(near), 60);
            return { near: near.data('groupKey'), zoom: cy.zoom() };
        }, out.group.key);
        await page.waitForTimeout(600);
        out.zoomed.minus = await badgeInfo(page, out.group.key);
        out.zoomed.plus = await badgeInfo(page, out.zoomed.near);
        await page.screenshot({ path: join(OUT, 'seedling-collapsible-badge-zoom.png'), clip: await graphClip(page) });

        // Visibility by zoom: at showRegionNames (0.5) shown, just below hidden.
        out.zoomVisibility = {};
        for (const z of [0.5, 0.49]) {
            await evalCy(page, (cy, zz) => { cy.zoom(zz); cy.center(); }, z);
            await page.waitForTimeout(300);
            out.zoomVisibility[z] = await page.evaluate(() => [...document.querySelectorAll('.rg-group-badge')].filter((b) => b.style.display === 'block').length);
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
        await waitFor(page, (cy) => cy.nodes('.region').length > 0);
        await setView(page, 'collapsible');
        await waitFor(page, (cy) => cy.nodes('.region-group-merged').length > 0);
        await settle(page);
        // The zoom where region labels first show (0.5), centred on a closed group of 4-6 members.
        out.phone = await evalCy(page, (cy) => {
            const nodes = cy.nodes('.region-group-merged').sort((a, b) => (a.data('groupKey') < b.data('groupKey') ? -1 : 1));
            const n = nodes.filter((g) => g.data('members').length >= 4 && g.data('members').length <= 6)[0] ?? nodes[0];
            cy.zoom(0.5);
            cy.center(n);
            return { key: n.data('groupKey'), zoom: cy.zoom() };
        });
        await page.waitForTimeout(600);
        out.phone.badge = await badgeInfo(page, out.phone.key);
        await page.touchscreen.tap(out.phone.badge.x, out.phone.badge.y);
        await waitFor(page, (cy, k) => cy.getElementById(`region-group:${k}`).isParent(), out.phone.key);
        await page.waitForTimeout(500);
        out.phone.afterTap = await evalCy(page, (cy, k) => ({ open: cy.getElementById(`region-group:${k}`).isParent(),
            inside: cy.getElementById(`region-group:${k}`).children().length, selected: cy.nodes(':selected').length,
            zoom: cy.zoom() }), out.phone.key);
        out.phone.minus = await badgeInfo(page, out.phone.key);
        await page.screenshot({ path: join(OUT, 'phone-390-badge-tapped.png') });
        out.phoneHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        out.errors.phone = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(JSON.stringify(out, null, 2));
