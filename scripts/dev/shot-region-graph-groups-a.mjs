/**
 * Region Graph groups A screenshots (region-graph-groups-a) — `subRegionView` = separate vs nested.
 *
 * Desktop (1600 × 1000, `layout=desktop`):
 *   seedling-separate-fcose.png   seedling_playthrough, separate, the Force-Directed (fcose) preset, fit
 *   seedling-nested-fcose.png     the same world, nested, fcose, fit
 *   seedling-nested-group.png     zoomed on one box (the first by key with 4-6 members)
 *   alttp-nested.png              alttp in nested (no sub-regions: no box; the same picture as separate)
 * Phone (390 × 844, isMobile, hasTouch, DPR 3, the real mobile layout):
 *   phone-390-nested.png          seedling_playthrough, nested, the Region Graph tab
 *
 * Each context is fresh, so the settings it writes (`subRegionView`) never reach another page or the user's own.
 * Prints the counts and any page errors as JSON.
 *
 * Usage: node scripts/dev/shot-region-graph-groups-a.mjs --port=8144 --out=CC/docs/region-graph/groups-a-shots
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
const OUT = arg('out', 'CC/docs/region-graph/groups-a-shots');
const HOST = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-graph-groups-a.mjs', kind: 'browser' });

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
    cy.fit(30);
}, CY.toString());

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

const out = { errors: {} };
const browser = await chromium.launch();
try {
    for (const game of ['seedling_playthrough', 'alttp']) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${HOST}/frontend/?game=${game}&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
        await waitRules(page);
        await openGraph(page);
        await waitGraph(page, 0);
        await settle(page);
        if (game === 'seedling_playthrough') {
            await fcose(page);
            await page.waitForTimeout(800);
            await page.screenshot({ path: join(OUT, 'seedling-separate-fcose.png'), clip: await graphClip(page) });
            out.seedlingSeparate = await counts(page);
            const t0 = Date.now();
            await setView(page, 'nested');
            await waitGraph(page, 'any');
            out.switchMs = Date.now() - t0;
            await settle(page);
            await fcose(page);
            await page.waitForTimeout(800);
            await page.screenshot({ path: join(OUT, 'seedling-nested-fcose.png'), clip: await graphClip(page) });
            out.seedlingNested = await counts(page);
            out.zoomedBox = await page.evaluate((cyFn) => {
                // eslint-disable-next-line no-new-func
                const cy = new Function(`return (${cyFn})()`)();
                // A box of 4-6 members (the first by key), so its members' labels are legible when it fills the view.
                const boxes = cy.nodes('.region-group').sort((a, b) => (a.data('groupKey') < b.data('groupKey') ? -1 : 1));
                const box = boxes.filter((g) => g.children().length >= 4 && g.children().length <= 6)[0] ?? boxes[0];
                cy.fit(box, 60);
                return { key: box.data('groupKey'), members: box.children().length };
            }, CY.toString());
            await page.waitForTimeout(800);
            await page.screenshot({ path: join(OUT, 'seedling-nested-group.png'), clip: await graphClip(page) });
        } else {
            await setView(page, 'nested');
            await page.waitForTimeout(3000); // a rebuild with no box looks the same: give it time, then read
            await waitGraph(page, 0);
            await settle(page);
            await page.screenshot({ path: join(OUT, 'alttp-nested.png'), clip: await graphClip(page) });
            out.alttpNested = await counts(page);
        }
        out.errors[game] = errors;
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
        await setView(page, 'nested');
        await waitGraph(page, 'any');
        await settle(page);
        await page.screenshot({ path: join(OUT, 'phone-390-nested.png') });
        out.phoneNested = await counts(page);
        out.phoneHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        out.errors.phone = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(JSON.stringify(out, null, 2));
