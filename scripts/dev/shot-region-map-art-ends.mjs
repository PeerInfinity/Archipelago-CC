/**
 * Region Map art-ends screenshots (region-map-art-ends) — the same views as `shot-region-map-link-ends.mjs`, so each can
 * sit beside its link-ends counterpart, plus the new ones. Drives the running app with Playwright:
 *
 *   node scripts/dev/shot-region-map-art-ends.mjs --port=8143 --out=<dir>
 *
 * Desktop (1600 × 1000, the panel lifted full-viewport):
 *   seedling_playthrough-fit.png      Fit all
 *   seedling_playthrough-group.png    zoomed on the start level's group (link-ends' camera)
 *   seedling_playthrough-apart.png    level_12 ↔ level_95, placed apart (link-ends' camera)
 *   seedling_playthrough-tall.png     the line end whose cell is tallest over its art (a tall cell, small art)
 *   seedling_playthrough-short.png    Fit all, cropped on the SHORTEST line with an arrowhead (could the head swallow it?)
 *   seedling_playthrough-short-zoom.png  the same link, zoomed in
 *   alttp-fit.png                     a classic world: no door tiles, every end on the art
 * Phone (390 × 844, isMobile, hasTouch, DPR 3, the real mobile layout):
 *   phone-390-fit.png                 the Region Map tab at Fit all
 *   phone-390-short.png               Fit all, cropped on the shortest headed line (on the phone, shorter than its head)
 *   phone-390-mobile-tab.png          after a two-finger pinch ×3 (link-ends' view)
 * and `measure.json` (each view's paint counts).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt = null) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out', null);
const ONLY = arg('only', null);
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
takeBoxLockOrExit({ name: 'shot-region-map-art-ends.mjs', kind: 'browser' });
const HOST = `http://localhost:${PORT}`;

const waitRules = (page) => page.waitForFunction(async () => {
    const sm = await import('/frontend/modules/stateManager/index.js');
    return !!sm.getLastRawJsonData()?.rawJsonData && (sm.stateManagerProxySingleton.getStaticData()?.regions?.size ?? 0) > 0;
}, null, { timeout: 90000, polling: 250 });

// Settled = no bake pending and the request count unchanged for 1.5 s (a bake is requested a frame or more after the
// camera moves, so "nothing pending" alone can be read before the request).
const settle = async (page) => {
    const stats = () => page.evaluate(async () => (await import('/frontend/modules/flashPanel/seedlingCompositeMap.js')).seedlingCompositeMapStats());
    let last = -1;
    for (let k = 0; k < 120; k += 1) {
        await page.waitForTimeout(1500);
        const s = await stats();
        if (s.pending === 0 && s.requested === last) break;
        last = s.pending === 0 ? s.requested : -1;
    }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(300);
};

const paintStats = (page) => page.evaluate(() => {
    const d = window.__rm.getDebugState();
    const lp = d.lastPaint;
    return { model: { cross: d.links, neighbour: d.neighbourLinks }, drawn: { cross: lp.links, neighbour: lp.neighbourLinks,
        gapMarks: lp.gapMarks, edgeLines: lp.edgeLines, arrowheads: lp.arrowheads, tileEnds: lp.tileEnds, artEnds: lp.artEnds,
        centreEnds: lp.centreEnds, shortHeads: lp.shortHeads }, zoom: d.camera.zoom };
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


const lineInfo = (page) => page.evaluate(async () => {
    const { linkShape } = await import('/frontend/modules/regionMap/regionMapLinkGeometry.js');
    const { worldToScreen } = await import('/frontend/modules/procgenCore/mapCamera.js');
    const p = window.__rm;
    const rows = [];
    for (const l of [...p.model.links, ...p.model.neighbourLinks]) {
        const s = linkShape(l, p.frames);
        if (s?.form !== 'line') continue;
        const a = worldToScreen(p.camera, p.vp, s.seg.x0, s.seg.y0);
        const b = worldToScreen(p.camera, p.vp, s.seg.x1, s.seg.y1);
        rows.push({ from: l.from, to: l.to, kind: l.kind, head: s.head, ends: s.ends, seg: s.seg, screenLen: Math.hypot(b.x - a.x, b.y - a.y), a, b });
    }
    return rows;
});

const out = {};
const browser = await chromium.launch();
try {
    {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const { page, errors } = await bootDesktop(context, 'seedling_playthrough');
        await page.evaluate(() => window.__rm.fitAll());
        await settle(page);
        await page.screenshot({ path: join(OUT, 'seedling_playthrough-fit.png') });
        out.seedling_fit = await paintStats(page);
        // the short link: an arrowhead (8 px) longer than its line at Fit all
        const rows = await lineInfo(page);
        // the shortest headed line (the one a head could swallow), reported even when it is longer than the head
        const short = rows.filter((r) => r.head).sort((x, y) => x.screenLen - y.screenLen).slice(0, 3);
        out.shortAtFit = short.map(({ a: _a, b: _b, ...r }) => r);
        if (short.length) {
            const r = short[0];
            const off = await page.evaluate(() => { const b = window.__rm.canvas.getBoundingClientRect(); return { x: b.x, y: b.y }; });
            const mx = off.x + (r.a.x + r.b.x) / 2;
            const my = off.y + (r.a.y + r.b.y) / 2;
            const clip = { x: Math.max(0, mx - 120), y: Math.max(0, my - 90), width: 240, height: 180 };
            await page.screenshot({ path: join(OUT, 'seedling_playthrough-short.png'), clip });
            await page.evaluate((r) => {
                const p = window.__rm;
                const a = p.frames.get(r.from).cell;
                const b = p.frames.get(r.to).cell;
                const x0 = Math.min(a.x, b.x); const y0 = Math.min(a.y, b.y);
                const x1 = Math.max(a.x + a.w, b.x + b.w); const y1 = Math.max(a.y + a.h, b.y + b.h);
                p.setCamera({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom: Math.min(p.vp.w / (x1 - x0), p.vp.h / (y1 - y0)) * 0.8 });
            }, r);
            await settle(page);
            await page.screenshot({ path: join(OUT, 'seedling_playthrough-short-zoom.png') });
            out.shortZoom = { ...(await paintStats(page)), link: `${r.from} -> ${r.to}` };
        }
        await page.evaluate(() => {
            const p = window.__rm;
            const f = p.frames.get(p.model.layout.start);
            p.setCamera({ x: f.cell.x + f.cell.w / 2, y: f.cell.y + f.cell.h / 2, zoom: Math.min(p.vp.w / f.cell.w, p.vp.h / f.cell.h) * 0.3 });
        });
        await settle(page);
        await page.screenshot({ path: join(OUT, 'seedling_playthrough-group.png') });
        out.seedling_group = await paintStats(page);
        const frame = async (pick, name) => {
            const info = await page.evaluate(pick);
            await settle(page);
            await page.screenshot({ path: join(OUT, name) });
            return { ...info, paint: await paintStats(page) };
        };
        const camOn = String(function camOn(p, l) {
            const a = p.frames.get(l.from).cell;
            const b = p.frames.get(l.to).cell;
            const x0 = Math.min(a.x, b.x); const y0 = Math.min(a.y, b.y);
            const x1 = Math.max(a.x + a.w, b.x + b.w); const y1 = Math.max(a.y + a.h, b.y + b.h);
            p.setCamera({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom: Math.min(p.vp.w / (x1 - x0), p.vp.h / (y1 - y0)) * 0.8 });
        });
        out.apart = await frame(new Function(`return (async () => {
            const { linkShape } = await import('/frontend/modules/regionMap/regionMapLinkGeometry.js');
            ${camOn}
            const p = window.__rm;
            const apart = p.model.neighbourLinks.filter((l) => l.kind === 'join' && linkShape(l, p.frames)?.form === 'line');
            const l = apart.find((x) => [x.from, x.to].sort().join() === 'level_12,level_95') ?? apart[0];
            camOn(p, l);
            const s = linkShape(l, p.frames);
            return { from: l.from, to: l.to, a: l.a, b: l.b, seg: s.seg, ends: s.ends };
        })();`), 'seedling_playthrough-apart.png');
        out.tall = await frame(new Function(`return (async () => {
            const { linkShape } = await import('/frontend/modules/regionMap/regionMapLinkGeometry.js');
            ${camOn}
            const p = window.__rm;
            let best = null;
            for (const l of [...p.model.links, ...p.model.neighbourLinks]) {
                const s = linkShape(l, p.frames);
                if (s?.form !== 'line') continue;
                for (const w of ['from', 'to']) {
                    const f = p.frames.get(l[w]);
                    const slack = f.cell.h / f.h;
                    if (!best || slack > best.slack) best = { slack, l, w, key: f.key, art: { w: f.w, h: f.h }, cell: { w: f.cell.w, h: f.cell.h }, ends: s.ends };
                }
            }
            camOn(p, best.l);
            return { from: best.l.from, to: best.l.to, kind: best.l.kind, tallEnd: best.w, key: best.key, art: best.art, cell: best.cell, ends: best.ends };
        })();`), 'seedling_playthrough-tall.png');
        if (errors.length) out.desktopErrors = errors;
        await context.close();
        const c2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const b2 = await bootDesktop(c2, 'alttp');
        await b2.page.evaluate(() => window.__rm.fitAll());
        await settle(b2.page);
        await b2.page.screenshot({ path: join(OUT, 'alttp-fit.png') });
        out.alttp_fit = await paintStats(b2.page);
        if (b2.errors.length) out.alttpErrors = b2.errors;
        await c2.close();
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
        const tabSel = '.mobile-tab[data-component-type="regionMapPanel"]';
        for (let k = 0; k < 4 && !(await page.$(tabSel)); k += 1) await page.tap('.mobile-nav-left');
        await page.tap(tabSel);
        await page.waitForFunction(async () => {
            const rm = await import('/frontend/modules/regionMap/index.js');
            const p = rm.getPanelInstances()[0];
            window.__rm = p;
            return p && p.root.offsetParent !== null && (p.getDebugState().lastPaint?.cells ?? 0) > 0;
        }, null, { timeout: 30000, polling: 200 });
        await page.evaluate(() => window.__rm.fitAll());
        await settle(page);
        await page.screenshot({ path: join(OUT, 'phone-390-fit.png') });
        out.phone_fit = await paintStats(page);
        {
            const rows = await lineInfo(page);
            const short = rows.filter((r) => r.head).sort((x, y) => x.screenLen - y.screenLen).slice(0, 3);
            out.phoneShortAtFit = short.map(({ a: _a, b: _b, ...r }) => r);
            const r = short[0];
            const off = await page.evaluate(() => { const b = window.__rm.canvas.getBoundingClientRect(); return { x: b.x, y: b.y }; });
            const mx = off.x + (r.a.x + r.b.x) / 2;
            const my = off.y + (r.a.y + r.b.y) / 2;
            await page.screenshot({ path: join(OUT, 'phone-390-short.png'), clip: { x: Math.max(0, mx - 60), y: Math.max(0, my - 45), width: 120, height: 90 } });
        }
        const cdp = await context.newCDPSession(page);
        const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
            type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })),
        });
        const box = await page.evaluate(() => {
            const r = window.__rm.canvas.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
        for (let k = 1; k <= 8; k += 1) {
            const d = 60 + (120 * k) / 8;
            await touch('touchMove', [[cx - d / 2, cy], [cx + d / 2, cy]]);
            await page.waitForTimeout(16);
        }
        await touch('touchEnd', []);
        await page.waitForTimeout(300);
        await settle(page);
        await page.screenshot({ path: join(OUT, 'phone-390-mobile-tab.png') });
        out.phone_pinch = await paintStats(page);
        if (errors.length) out.phoneErrors = errors;
        await context.close();
    }
} finally {
    await browser.close();
}
writeFileSync(join(OUT, 'measure.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
