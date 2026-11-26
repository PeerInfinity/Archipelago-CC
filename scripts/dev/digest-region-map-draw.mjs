/**
 * The Region Map's DRAW-CALL DIGEST, base vs tip (region-graph-map-look). Evidence that moving the cell drawing into
 * `regionMap/regionMapCellDraw.js` left the Region Map's output byte-identical: on one live panel (so the same
 * model, frames and painter bakes), `paint()` is run once with the BASE commit's `RegionMapUI` prototype and once with
 * the tip's, each into a recording 2D context (every method call with its arguments, every property set, numbers
 * to 6 places, images as their size), and the two logs are hashed (SHA-256, first 16 hex). Five cameras per preset:
 * Fit all, Fit all × 4, and the start cell at zoom 0.5, 2 and 6; each waits until every bake has landed.
 *
 * The base class is `git show <base>:frontend/modules/regionMap/regionMapUI.js`, written next to the tip's as
 * `_regionMapUI.base.tmp.js` (so its relative imports resolve to the same modules) and removed afterwards.
 *
 * Usage: node scripts/dev/digest-region-map-draw.mjs --port=8144 --base=75ac248ea6 seedling_playthrough procgen_maze …
 * Prints JSON: per preset, per camera, `{ zoom, base: {calls, d, cells, squares, art, generic, fogged}, tip, same }`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const PORT = arg('port', process.env.TEST_PORT || '8000');
const BASE = arg('base', 'origin/main');
const GAMES = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TMP = 'frontend/modules/regionMap/_regionMapUI.base.tmp.js';
takeBoxLockOrExit({ name: 'digest-region-map-draw.mjs', kind: 'browser' });
fs.writeFileSync(TMP, execFileSync('git', ['show', `${BASE}:frontend/modules/regionMap/regionMapUI.js`]));
process.on('exit', () => { try { fs.unlinkSync(TMP); } catch { /* gone */ } });
const browser = await chromium.launch();
const out = {};
for (const game of GAMES) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/frontend/?game=${game}&seed=1&layout=desktop`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 300; i += 1) { if (await page.evaluate(async () => { const { stateManagerProxySingleton: sm } = await import('/frontend/modules/stateManager/index.js'); return (sm.getStaticData?.()?.regions?.size ?? 0) > 0; })) break; await page.waitForTimeout(300); }
  await page.waitForSelector('.lm_tab', { timeout: 90000 });
  await page.evaluate(async () => {
    const pm = (await import('/frontend/app/core/panelManager.js')).default;
    const rm = await import('/frontend/modules/regionMap/index.js');
    if (!rm.getPanelInstances().length) await pm.createPanelForComponent('regionMapPanel', 'Region Map', 2);
    const p = rm.getPanelInstances()[0];
    const host = document.createElement('div');
    Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#000' });
    document.body.appendChild(host);
    host.appendChild(p.root);
  });
  let ready = false;
  for (let i = 0; i < 300 && !ready; i += 1) { ready = await page.evaluate(async () => { const { getPanelInstances } = await import('/frontend/modules/regionMap/index.js'); const p = getPanelInstances()[0]; return !!p?.model && p.vp.w > 0; }); if (!ready) await page.waitForTimeout(300); }
  if (!ready) { out[game] = { error: 'no panel' }; continue; }
  await page.waitForTimeout(1500);
  const res = await page.evaluate(async () => {
    const { getPanelInstances } = await import('/frontend/modules/regionMap/index.js');
    const Base = (await import('/frontend/modules/regionMap/_regionMapUI.base.tmp.js')).RegionMapUI;
    const Tip = (await import('/frontend/modules/regionMap/regionMapUI.js')).RegionMapUI;
    const p = getPanelInstances()[0];
    const real = p.canvas;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const recorder = () => {
      const oc = new OffscreenCanvas(real.width || 10, real.height || 10); const c = oc.getContext('2d');
      const log = [];
      const enc = (v) => (v && typeof v === 'object' ? `[${v.constructor?.name}${v.width != null ? ` ${v.width}x${v.height}` : ''}]` : typeof v === 'number' ? v.toFixed(6) : String(v));
      const ctx = new Proxy(c, {
        get: (t, k) => { const v = t[k]; if (typeof v === 'function') return (...a) => { log.push(`${String(k)}(${a.map(enc).join(',')})`); return v.apply(t, a); }; return v; },
        set: (t, k, v) => { log.push(`${String(k)}=${enc(v)}`); t[k] = v; return true; },
      });
      return { ctx, log };
    };
    const digest = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
    p.fitAll(); await sleep(300);
    const fit = { ...p.camera };
    const start = p.frames.get(p.model.layout.start) ?? p.frameList[0];
    const c = { x: start.cell.x + start.cell.w / 2, y: start.cell.y + start.cell.h / 2 };
    const cams = { fit, fitX4: { ...fit, zoom: fit.zoom * 4 }, start05: { ...c, zoom: 0.5 }, start2: { ...c, zoom: 2 }, start6: { ...c, zoom: 6 } };
    const rows = {};
    for (const [name, cam] of Object.entries(cams)) {
      p.setCamera(cam);
      let last = -1; for (let i = 0; i < 40; i += 1) { p.paint(); await sleep(150); if (p.counters.artRedraws === last && i > 3) break; last = p.counters.artRedraws; }
      const got = {};
      for (const [tag, cls] of [['base', Base], ['tip', Tip]]) {
        Object.setPrototypeOf(p, cls.prototype);
        const r = recorder();
        p.canvas = { getContext: () => r.ctx, dataset: {}, width: real.width, height: real.height };
        p.paint();
        p.canvas = real;
        got[tag] = { calls: r.log.length, d: await digest(r.log.join('\n')), cells: p._lastPaint?.cells, squares: p._lastPaint?.squares, art: p._lastPaint?.art, generic: p._lastPaint?.generic, fogged: p._lastPaint?.fogged };
      }
      Object.setPrototypeOf(p, Tip.prototype);
      rows[name] = { zoom: +cam.zoom.toFixed(4), ...got, same: got.base.d === got.tip.d && got.base.calls === got.tip.calls };
    }
    return rows;
  });
  out[game] = { res, errors };
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
