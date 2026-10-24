// Scratch: stage l12-dash-cut through the panel's bus event on seedling_playthrough and sample what the UI shows.
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`); // run from the worktree root
const { chromium } = require('playwright');
const [port, windowWork] = process.argv.slice(2);
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(`http://localhost:${port}/frontend/`, { waitUntil: 'load' }); await page.waitForTimeout(10000);
await page.evaluate(() => { window.__solveReqs = []; const orig = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m, ...rest) { try { if (m?.type === 'solve') window.__solveReqs.push(JSON.parse(JSON.stringify(m.request))); } catch {} return orig.call(this, m, ...rest); }; });
const t = await page.evaluate(async ({ windowWork, preset }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sm = (await import('/frontend/app/core/settingsManager.js')).default;
  const eb = (await import('/frontend/app/core/eventBus.js')).default;
  const fp = await import('/frontend/modules/flashPanel/index.js');
  await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
  await sm.updateSetting('moduleSettings.flashPanel.seedlingSolverWalk', true, { persist: false });
  await sm.updateSetting('moduleSettings.flashPanel.seedlingSolveProgressView', 'auto', { persist: false });
  await sm.updateSetting('moduleSettings.flashPanel.seedlingSolverUpgradeWindowWork', Number(windowWork), { persist: false });
  const path = preset;
  let loaded = false; eb.subscribe('stateManager:rulesLoaded', () => { loaded = true; }, 'probe');
  eb.publish('files:jsonLoaded', { jsonData: await (await fetch(path)).json(), selectedPlayerId: '1', sourceName: path }, 'tutorials');
  while (!loaded) await sleep(100);
  eb.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'tutorials');
  await sleep(4000);
  { const p0 = fp.getActivePanelInstance(); let fw = null; for (let i = 0; i < 100 && !fw?.__seedlingJsRuntime; i++) { try { fw = document.getElementById(p0.flashObjectId)?.contentWindow; } catch {} await sleep(200); }
    const orig = fw.Worker.prototype.postMessage; fw.Worker.prototype.postMessage = function (m, ...rest) { try { if (m?.type === 'solve') window.__solveReqs.push(JSON.parse(JSON.stringify(m.request))); } catch {} return orig.call(this, m, ...rest); }; }
  eb.publish('ui:activatePanel', { panelId: 'inventoryPanel' }, 'tutorials'); await sleep(2000);
  const btns = [...document.querySelectorAll('.item-button')]; window.__inv = { n: btns.length, sword: btns.filter((b) => b.dataset.item === 'Progressive Sword').map((b) => ({ vis: b.getBoundingClientRect().width, dis: b.disabled, cls: b.className, parent: b.closest('[class]')?.parentElement?.className })) , sample: btns.slice(0, 8).map((b) => b.dataset.item) };
  await window.stateManagerProxy.addItemToInventory('Progressive Sword', 1);
  await sleep(3000);
  const snap = window.stateManagerProxy.getSnapshot?.();
  const invShape = snap ? Object.keys(snap).slice(0, 30) : null;
  const swordInSnap = snap?.inventory?.['Progressive Sword'] ?? snap?.prog_items?.['Progressive Sword'] ?? null;
  const t0 = performance.now();
  eb.publish('flashPanel:stageSolveDemo', { demo: 'l12-dash-cut' }, 'tutorials');
  const out = []; let rt = null; let lastText = '';
  for (;;) {
    await sleep(500);
    const p = fp.getActivePanelInstance();
    rt ??= p?.seedlingPlaybackSurface?.()?.jsRuntime ?? null;
    const v = document.querySelector('.flash-panel-solve-progress');
    const root = document.querySelector('.flash-panel-container')?.dataset ?? {};
    const text = v?.textContent ?? '';
    const row = { t: Math.round(performance.now() - t0), demo: root.solveDemo, why: root.solveDemoWhy, ds: v ? { ...v.dataset } : null, level: rt?.run?.level, state: rt?.playback?.state };
    if (text !== lastText) { row.text = text.slice(0, 400); lastText = text; }
    out.push(row);
    if (root.solveDemo === 'refused') break;
    if (rt && (['done', 'failed'].includes(rt.playback.state))) { await sleep(1500); break; }
    if (performance.now() - t0 > 120000) break;
  }
  const s = rt?.playback?.solverStats; const ls = s?.lastSolve;
  const log = (document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').slice(-12);
  return { inv: window.__inv, reqs: window.__solveReqs, invShape, swordInSnap, slots: rt?.run?.inventorySlots, out, window: rt?.playback?.solverUpgradeWindowWork, solve: ls && { keys: ls.keys, pass: ls.pass, passes: ls.passes, verbs: ls.verbs, waitMs: ls.waitMs }, finalView: document.querySelector('.flash-panel-solve-progress')?.textContent.slice(0, 500), log };
}, { windowWork, preset: process.env.PRESET ?? './presets/seedling_playthrough/AP_1/AP_1_rules.json' });
if (process.argv[4]) (await import('node:fs')).writeFileSync(process.argv[4], JSON.stringify(t.reqs));
console.log(JSON.stringify(t.inv));
console.log(JSON.stringify({ nreqs: t.reqs.length, invShape: t.invShape, swordInSnap: t.swordInSnap, slots: t.slots, window: t.window, solve: t.solve }));
for (const r of t.out) if (r.text || r.t % 5000 < 500) console.log(JSON.stringify(r));
console.log('FINALVIEW', t.finalView); console.log('LOG', JSON.stringify(t.log));
await b.close();
