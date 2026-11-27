// Motion after "the layout has finished", per layout, on the Region Graph (seedling_atlas) — region-graph-layout-settled.
// usage (from the repo root, a dev server on <port>): node CC/docs/region-graph/layout-settled-probe.mjs <port> <label> [reps]   (BUNDLED=1 for ?bundled=true)
// For each case: the signatures (node positions, rendered sizes, zoom, pan) are sampled SYNCHRONOUSLY at each
// `layoutstop`, at the panel's settle (`rg-layoutsettled`, after only) and at the status "Layout complete"
// (a MutationObserver), and then on every animation frame for 2.5 s after. Reported per marker: the frames whose
// signature differs from the one at the marker, and the last such frame (ms after the marker).
import { chromium } from '@playwright/test';
const [port = '8146', label = '?', repsArg = '1'] = process.argv.slice(2);
const reps = Number(repsArg);
const bundled = process.env.BUNDLED === '1';
const url = `http://localhost:${port}/frontend/?rules=${encodeURIComponent('./presets/seedling_atlas/AP_1/AP_1_rules.json')}${bundled ? '&bundled=true' : ''}`;
const CASES = (process.env.CASES ?? 'view:merged,relayout,preset:fcose-default,preset:hierarchical,preset:grid,preset:direction-aware,preset:cose,supersede').split(',');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const rows = [];
for (let rep = 0; rep < reps; rep += 1) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => console.error('PAGEERR', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy, null, { timeout: 60000 });
  // activate the panel through the app's own bus (bundled: via the module registry is not importable; the tests
  // controller's bus is window-reachable only in test mode, so use the tab header instead)
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.lm_tab, .lm_title')].find((t) => /Region Graph/i.test(t.textContent));
    (tab?.closest('.lm_tab') ?? tab)?.click();
  });
  await page.waitForFunction(() => { const c = document.querySelector('.region-graph-panel-container div[id^="cy-"]'); return c?.clientWidth > 100 && c._cyreg.cy.nodes().length > 5; }, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  if (process.env.PLAYER) await page.evaluate(() => { window.__probePlayer = true; });
  if (process.env.DETAIL) await page.evaluate(() => { window.__probeDetail = true; });
  for (const kase of CASES) {
    const r = await page.evaluate(async (kase) => {
      const root = document.querySelector('.region-graph-panel-container');
      const cy = root.querySelector('div[id^="cy-"]')._cyreg.cy;
      const t0 = performance.now(); const T = () => performance.now() - t0;
      const sig = () => {
        const c = root.querySelector('div[id^="cy-"]')._cyreg.cy;
        return JSON.stringify([c.zoom().toFixed(4), Math.round(c.pan().x), Math.round(c.pan().y),
          c.nodes().filter((n) => !n.hasClass('location-node') && (window.__probePlayer ? n.id() === 'player' : n.id() !== 'player')).map((n) => { const b = n.renderedBoundingBox({ includeLabels: false });
            return [n.id(), Math.round(b.x1), Math.round(b.y1), Math.round(b.x2), Math.round(b.y2)]; })]);
      };
      const markers = []; // { kind, t, sig }
      const mark = (kind) => markers.push({ kind, t: T(), sig: sig() });
      const onStop = () => mark('layoutstop'); const onSettled = () => mark('settled');
      cy.on('layoutstop', onStop); cy.on('rg-layoutsettled', onSettled);
      const bar = root.querySelector('div[style*="position: absolute"]');
      const mo = new MutationObserver(() => { if (/Layout complete/.test(bar?.textContent ?? '') && !markers.some((m) => m.kind === 'complete' && m.t > T() - 50)) mark('complete'); });
      if (bar) mo.observe(bar, { childList: true, characterData: true, subtree: true });
      const frames = []; let live = true;
      const tick = () => { if (!live) return; frames.push({ t: T(), sig: sig() }); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const select = root.querySelector('#layoutPreset');
      const auto = root.querySelector('#autoApplyPreset'); if (auto) auto.checked = true;
      const settingsMod = window.__probeCtx;
      let note = '';
      if (kase.startsWith('view:')) {
        const v = kase.slice(5);
        const radio = root.querySelector(`input[name="subRegionView"][value="${v}"]`) ?? root.querySelector(`select#subRegionView`);
        if (radio?.tagName === 'SELECT') { radio.value = v; radio.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (radio) radio.click(); else note = 'no subRegionView control';
      } else if (kase === 'relayout') {
        root.querySelector('#relayout').click();
      } else if (kase.startsWith('preset:')) {
        select.value = kase.slice(7); select.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (kase === 'supersede') {
        // a Re-layout (cose), then 100 ms later the view switch rebuilds the graph and starts its own layout
        root.querySelector('#relayout').click();
        await new Promise((r) => setTimeout(r, 100));
        const sel = root.querySelector('select#subRegionView');
        sel.value = sel.value === 'merged' ? 'separate' : 'merged'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await new Promise((r) => setTimeout(r, 2800));
      live = false; mo.disconnect(); cy.off('layoutstop', onStop); cy.off('rg-layoutsettled', onSettled);
      const view = root.querySelector('select#subRegionView')?.value;
      const summary = (kind) => {
        const ms = markers.filter((m) => m.kind === kind);
        if (!ms.length) return null;
        const m = ms[ms.length - 1];
        const after = frames.filter((f) => f.t > m.t && f.sig !== m.sig);
        let detail = '';
        if (after.length && window.__probeDetail) { const a = JSON.parse(m.sig), b = JSON.parse(after[after.length - 1].sig); const A = new Map(a[3].map((x) => [x[0], x]));
          detail = ` view ${a.slice(0, 3)}→${b.slice(0, 3)} ` + b[3].filter((x) => JSON.stringify(A.get(x[0])) !== JSON.stringify(x)).slice(0, 3).map((x) => `${x[0]} ${JSON.stringify(A.get(x[0])?.slice(1))}→${JSON.stringify(x.slice(1))}`).join(' ')
            + ' times ' + after.map((f) => Math.round(f.t - m.t)).join(','); }
        return { n: ms.length, at: Math.round(m.t), moved: after.length, last: after.length ? Math.round(after[after.length - 1].t - m.t) : 0, detail };
      };
      // the FIRST layoutstop that a "count layoutstops" reader would take as the end
      const first = markers.find((m) => m.kind === 'layoutstop');
      const afterFirst = first ? frames.filter((f) => f.t > first.t && f.sig !== first.sig) : [];
      return { kase, view, note, preset: select?.value, stop: summary('layoutstop'), settled: summary('settled'), complete: summary('complete'),
        firstStop: first ? { at: Math.round(first.t), moved: afterFirst.length, last: afterFirst.length ? Math.round(afterFirst[afterFirst.length - 1].t - first.t) : 0 } : null };
    }, kase);
    rows.push({ rep, ...r });
  }
  await page.close();
}
await browser.close();
const fmt = (s) => (s ? `${s.n}× @${s.at} moved ${s.moved}f last +${s.last}ms${s.detail}` : '—');
console.log(`## ${label} (${bundled ? 'bundled' : 'ES'}) port ${port}`);
for (const r of rows) {
  console.log(`${String(r.rep).padEnd(2)} ${r.kase.padEnd(24)} [${r.preset}/${r.view}] first-stop: ${r.firstStop ? `@${r.firstStop.at} moved ${r.firstStop.moved}f last +${r.firstStop.last}ms` : '—'} | last-stop: ${fmt(r.stop)} | settled: ${fmt(r.settled)} | "Layout complete": ${fmt(r.complete)} ${r.note}`);
}
