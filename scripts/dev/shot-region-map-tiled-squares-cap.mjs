/**
 * Region Map tiled-squares-cap screenshots + measures (region-map-tiled-squares-cap). Drives the running app with Playwright:
 *
 *   node scripts/dev/shot-region-map-tiled-squares-cap.mjs --port=8143 --out=<dir> [--prefix=before-|after-] [--games=a,b] [--phone=0]
 *
 * Per preset (default seedling_playthrough, seedling_playthrough_maze, alttp; desktop 1600 × 1000, the panel lifted
 * full-viewport): the squares drawn, skipped, `minSquareSide`, the on-screen tile size and every drawn square's
 * centre, at Fit all and zoomed in on the start cell (the whole cell in view). Shots, Seedling only:
 *   <prefix>seedling-fit.png         Fit all
 *   <prefix>seedling-fit-crop.png    Fit all, cropped 400 × 300 around the start cell
 *   <prefix>seedling-in.png          zoomed in on the start cell
 *   <prefix>phone-390-seedling.png   the 390 × 844 mobile layout (isMobile, DPR 3), Region Map tab, Fit all
 * and `<prefix>measure.json`.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt = null) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out', null);
const GAMES = (arg('games', null) ?? 'seedling_playthrough,seedling_playthrough_maze,alttp').split(',');
const PHONE_ON = arg('phone', '1') === '1';
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map-tiled-squares-cap.mjs', kind: 'browser' });
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
    const lp = d.lastPaint;
    const sides = d.squares.map((q) => q.side);
    // the smallest / largest on-screen tile among the drawn substrate-tiled cells, and every drawn square's centre
    let tileMin = Infinity; let tileMax = 0;
    for (const k of lp.keys) {
        const c = p.model.cells.get(k);
        if (c?.tileSource !== 'substrate' || !c.tiles.length) continue;
        const t = p.frames.get(k).tilePx * p.camera.zoom;
        tileMin = Math.min(tileMin, t); tileMax = Math.max(tileMax, t);
    }
    const tiledKeys = new Set([...p.model.cells.values()].filter((c) => c.tileSource === 'substrate').map((c) => c.key));
    const tiledSides = d.squares.filter((q) => tiledKeys.has(q.key)).map((q) => q.side);
    return {
        zoom: d.camera.zoom, squares: lp.squares,
        minSquareSide: Number.isFinite(lp.minSquareSide) ? lp.minSquareSide : null,
        minSide: sides.length ? Math.min(...sides) : null, maxSide: sides.length ? Math.max(...sides) : null,
        tiledMinSide: tiledSides.length ? Math.min(...tiledSides) : null, tiledMaxSide: tiledSides.length ? Math.max(...tiledSides) : null,
        tileMinPx: Number.isFinite(tileMin) ? tileMin : null, tileMaxPx: tileMax || null,
        centres: d.squares.map((q) => [q.key, q.location, q.sx, q.sy, q.side]),
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


const PREFIX = arg('prefix', '');
const out = { measures: {} };
const browser = await chromium.launch();
try {
    for (const game of GAMES) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const { page, errors } = await bootDesktop(context, game);
        const m = {};
        m.cells = await page.evaluate(() => { const cs = [...window.__rm.model.cells.values()]; return { all: cs.length, tiled: cs.filter((c) => c.tileSource === 'substrate').length, generic: cs.filter((c) => c.tileSource === 'generic').length }; });
        await page.evaluate(() => window.__rm.fitAll());
        await settle(page);
        m.fit = await squareStats(page);
        if (game === 'seedling_playthrough') {
            await page.screenshot({ path: join(OUT, `${PREFIX}seedling-fit.png`) });
            const r = await page.evaluate(() => {
                const p = window.__rm;
                const f = p.frames.get(p.model.layout.start);
                const s = p.canvas.getBoundingClientRect();
                const z = p.camera.zoom;
                return { cx: s.x + p.vp.w / 2 + (f.cell.x + f.cell.w / 2 - p.camera.x) * z, cy: s.y + p.vp.h / 2 + (f.cell.y + f.cell.h / 2 - p.camera.y) * z };
            });
            await page.screenshot({ path: join(OUT, `${PREFIX}seedling-fit-crop.png`), clip: { x: Math.max(0, r.cx - 200), y: Math.max(0, r.cy - 150), width: 400, height: 300 } });
        }
        const start = await page.evaluate(() => window.__rm.model.layout.start);
        m.start = start;
        await camOnCell(page, start, 'in');
        await settle(page);
        m.in = await squareStats(page);
        if (game === 'seedling_playthrough') await page.screenshot({ path: join(OUT, `${PREFIX}seedling-in.png`) });
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
        await page.goto(`${HOST}/frontend/?game=seedling_playthrough&seed=1`, { waitUntil: 'domcontentloaded' });
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
        await page.evaluate(() => { const p = window.__rm; p.settings.followPlayer = false; p.fitAll(); });
        await settle(page);
        await page.screenshot({ path: join(OUT, `${PREFIX}phone-390-seedling.png`) });
        out.phone = await squareStats(page);
        if (errors.length) out.phoneErrors = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
writeFileSync(join(OUT, `${PREFIX}measure.json`), `${JSON.stringify(out)}\n`);
const brief = (s) => s && { zoom: s.zoom, squares: s.squares, minSquareSide: s.minSquareSide, maxSide: s.maxSide, tileMinPx: s.tileMinPx, tileMaxPx: s.tileMaxPx, tiledMaxSide: s.tiledMaxSide };
console.log(JSON.stringify({ measures: Object.fromEntries(Object.entries(out.measures).map(([g, m]) => [g, { cells: m.cells, start: m.start, fit: brief(m.fit), in: brief(m.in), errors: m.errors }])), phone: brief(out.phone), phoneErrors: out.phoneErrors }, null, 2));
