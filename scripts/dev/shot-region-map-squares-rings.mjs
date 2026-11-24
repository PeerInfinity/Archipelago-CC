/**
 * Region Map squares-rings screenshots + measures (region-map-squares-rings). Drives the running app with Playwright:
 *
 *   node scripts/dev/shot-region-map-squares-rings.mjs --port=8143 --out=<dir> [--games=a,b] [--phone=0] [--few=<alttp region>]
 *
 * Desktop (1600 × 1000, the panel lifted full-viewport):
 *   alttp-few-zoom.png      an alttp region with few locations (FEW below), the whole cell in view (85 % of the viewport's smaller side)
 *   alttp-few-label.png     the same cell just above the label threshold (cell 64 px wide), cropped
 *   alttp-crowded-zoom.png  alttp's most crowded region (Eastern Palace, 9), zoomed in
 *   alttp-crowded-label.png the same at the label threshold, cropped
 *   alttp-fit.png           Fit all
 *   soe-crowded-zoom.png    the most crowded region over the committed presets (soe `Ingame`, 340), zoomed in
 *   maze-fit.png / maze-art-zoom.png / maze-art-label.png  seedling_playthrough_maze: Fit all, and an untiled cell that
 *                           draws maze art (4 locations) zoomed in and at the label threshold; maze-bare-*.png the
 *                           most crowded untiled maze cell that draws NO art
 *   seedling-ring-out.png   Seedling, the start group at Fit all, cropped (the door rings zoomed out)
 *   seedling-ring-in.png    Seedling, zoomed in on the start level (the rings at their cap)
 * Phone (390 × 844, isMobile, hasTouch, DPR 3, the real mobile layout):
 *   phone-390-alttp.png     the Region Map tab on alttp, camera on FEW's cell
 * and `measure.json`: per preset (alttp, tunic, ladx, seedling_playthrough) the squares drawn and their side
 * (min / max) at Fit all and zoomed in on the most crowded untiled cell (or the start cell), plus the ring radii.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt = null) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out', null);
const FEW = arg('few', 'Sewers Secret Room');
const GAMES = (arg('games', null) ?? 'alttp,tunic,ladx,seedling_playthrough,soe,seedling_playthrough_maze').split(',');
const PHONE_ON = arg('phone', '1') === '1';
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map-squares-rings.mjs', kind: 'browser' });
const HOST = `http://localhost:${PORT}`;

const waitRules = (page) => page.waitForFunction(async () => {
    const sm = await import('/frontend/modules/stateManager/index.js');
    return !!sm.getLastRawJsonData()?.rawJsonData && (sm.stateManagerProxySingleton.getStaticData()?.regions?.size ?? 0) > 0;
}, null, { timeout: 90000, polling: 250 });

const settle = async (page) => {
    const stats = () => page.evaluate(async () => (await import('/frontend/modules/flashPanel/seedlingCompositeMap.js')).seedlingCompositeMapStats());
    let last = -1;
    for (let k = 0; k < 120; k += 1) {
        await page.waitForTimeout(1200);
        const s = await stats();
        if (s.pending === 0 && s.requested === last) break;
        last = s.pending === 0 ? s.requested : -1;
    }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(300);
};

const squareStats = (page) => page.evaluate(() => {
    const p = window.__rm;
    const d = p.getDebugState();
    const sides = d.squares.map((q) => q.side);
    const lp = d.lastPaint;
    return {
        zoom: d.camera.zoom, squares: lp.squares, minSide: sides.length ? Math.min(...sides) : null,
        maxSide: sides.length ? Math.max(...sides) : null, doorRings: lp.doorRings ?? null, ringR: lp.ringR ?? null,
        tileEnds: lp.tileEnds,
    };
});

async function bootDesktop(context, game) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${HOST}/frontend/?game=${game}&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lm_tab', { timeout: 90000 });
    await waitRules(page);
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
    });
    await page.waitForFunction(() => window.__rm?.getDebugState()?.lastPaint?.cells > 0, null, { timeout: 30000, polling: 100 });
    return { page, errors };
}

/** Camera on cell `key` with its cell `px` screen px wide; → the cell's screen rect. */
const camOnCell = (page, key, px) => page.evaluate(([k, w]) => {
    const p = window.__rm;
    const f = p.frames.get(k);
    if (!f) return null;
    // 'in': the whole cell in view, 85 % of the viewport's smaller side
    if (w === 'in') w = Math.min(p.vp.w / f.cell.w, p.vp.h / f.cell.h) * 0.85 * f.cell.w;
    const zoom = w / f.cell.w;
    p.setCamera({ x: f.cell.x + f.cell.w / 2, y: f.cell.y + f.cell.h / 2, zoom });
    const r = p.canvas.getBoundingClientRect();
    return { x: r.x + p.vp.w / 2 - w / 2, y: r.y + p.vp.h / 2 - (f.cell.h * zoom) / 2, w, h: f.cell.h * zoom };
}, [key, px]);

const crowdedKey = (page, want = 'any') => page.evaluate((w) => {
    const p = window.__rm;
    let best = null;
    for (const c of p.model.cells.values()) {
        if (c.tileSource !== 'generic') continue;
        if ((w === 'art' && !c.region) || (w === 'bare' && c.region)) continue;
        // ties: a cell that draws art first (the maze's levels)
        if (!best || c.tiles.length > best.tiles.length || (c.tiles.length === best.tiles.length && c.region && !best.region)) best = c;
    }
    return best ? { key: best.key, n: best.tiles.length, art: !!best.region } : { key: p.model.layout.start, n: null };
}, want);

const shotCell = async (page, key, px, name, pad = 48) => {
    const r = await camOnCell(page, key, px);
    await settle(page);
    const clip = px !== 'in' ? { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + 2 * pad, height: r.h + 2 * pad } : undefined;
    await page.screenshot({ path: join(OUT, name), ...(clip ? { clip } : {}) });
    return { key, cellPx: r.w, ...(await squareStats(page)) };
};

const out = { measures: {} };
const browser = await chromium.launch();
try {
    for (const game of GAMES) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const { page, errors } = await bootDesktop(context, game);
        const crowded = await crowdedKey(page);
        const m = { crowded };
        await page.evaluate(() => window.__rm.fitAll());
        await settle(page);
        m.fit = await squareStats(page);
        if (game === 'alttp' || game === 'seedling_playthrough_maze') await page.screenshot({ path: join(OUT, `${game === 'alttp' ? 'alttp' : 'maze'}-fit.png`) });
        m.untiled = await page.evaluate(() => { const cs = [...window.__rm.model.cells.values()].filter((c) => c.tileSource === 'generic'); return { all: cs.length, art: cs.filter((c) => c.region).length }; });
        if (game === 'seedling_playthrough') {
            // the door rings zoomed out: Fit all, cropped on the start cell's neighbourhood
            const r = await page.evaluate(() => {
                const p = window.__rm;
                const f = p.frames.get(p.model.layout.start);
                const s = p.canvas.getBoundingClientRect();
                const z = p.camera.zoom;
                const cx = s.x + p.vp.w / 2 + (f.cell.x + f.cell.w / 2 - p.camera.x) * z;
                const cy = s.y + p.vp.h / 2 + (f.cell.y + f.cell.h / 2 - p.camera.y) * z;
                return { cx, cy };
            });
            await page.screenshot({ path: join(OUT, 'seedling-ring-out.png'), clip: { x: Math.max(0, r.cx - 200), y: Math.max(0, r.cy - 150), width: 400, height: 300 } });
            m.ringOut = await squareStats(page);
            await page.evaluate(() => {
                const p = window.__rm;
                const f = p.frames.get(p.model.layout.start);
                p.setCamera({ x: f.cell.x + f.cell.w / 2, y: f.cell.y + f.cell.h / 2, zoom: Math.min(p.vp.w / f.cell.w, p.vp.h / f.cell.h) * 1.6 });
            });
            await settle(page);
            await page.screenshot({ path: join(OUT, 'seedling-ring-in.png') });
            m.ringIn = await squareStats(page);
        }
        if (crowded.key) {
            m.zoomCrowded = await shotCell(page, crowded.key, 'in', game === 'alttp' ? 'alttp-crowded-zoom.png' : game === 'soe' ? 'soe-crowded-zoom.png' : game === 'seedling_playthrough_maze' ? 'maze-art-zoom.png' : `${game}-crowded-zoom.png`);
            m.labelCrowded = await shotCell(page, crowded.key, 64, game === 'alttp' ? 'alttp-crowded-label.png' : game === 'seedling_playthrough_maze' ? 'maze-art-label.png' : `${game}-crowded-label.png`);
        }
        if (game === 'seedling_playthrough_maze') {
            m.bare = await crowdedKey(page, 'bare');
            m.zoomBare = await shotCell(page, m.bare.key, 'in', 'maze-bare-zoom.png');
            m.labelBare = await shotCell(page, m.bare.key, 64, 'maze-bare-label.png');
        }
        if (game === 'alttp') {
            m.few = { key: FEW, n: await page.evaluate((k) => window.__rm.model.cells.get(k)?.tiles.length ?? null, FEW) };
            m.zoomFew = await shotCell(page, FEW, 'in', 'alttp-few-zoom.png');
            m.labelFew = await shotCell(page, FEW, 64, 'alttp-few-label.png');
        }
        if (errors.length) m.errors = errors;
        out.measures[game] = m;
        await context.close();
    }
    if (PHONE_ON) {
        const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
        const context = await browser.newContext(PHONE);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${HOST}/frontend/?game=alttp&seed=1`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.mobile-tab', { timeout: 90000 });
        await waitRules(page);
        const tabSel = '.mobile-tab[data-component-type="regionMapPanel"]';
        for (let k = 0; k < 4 && !(await page.$(tabSel)); k += 1) await page.tap('.mobile-nav-left');
        await page.tap(tabSel);
        await page.waitForFunction(async () => {
            const rm = await import('/frontend/modules/regionMap/index.js');
            const p = rm.getPanelInstances()[0];
            window.__rm = p;
            return p && p.root.offsetParent !== null && (p.getDebugState().lastPaint?.cells ?? 0) > 0;
        }, null, { timeout: 30000, polling: 200 });
        await page.evaluate((k) => {
            const p = window.__rm;
            const f = p.frames.get(k);
            p.settings.followPlayer = false;
            p.setCamera({ x: f.cell.x + f.cell.w / 2, y: f.cell.y + f.cell.h / 2, zoom: (p.vp.w * 0.7) / f.cell.w });
        }, FEW);
        await settle(page);
        await page.screenshot({ path: join(OUT, 'phone-390-alttp.png') });
        out.phone = await squareStats(page);
        if (errors.length) out.phoneErrors = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
writeFileSync(join(OUT, 'measure.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
