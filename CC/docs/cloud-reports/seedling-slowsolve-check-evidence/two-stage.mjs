import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`); // run from the worktree root
const { chromium } = require('playwright');
const b = await chromium.launch(); const page = await b.newPage();
await page.goto('http://localhost:8220/frontend/', { waitUntil: 'load' }); await page.waitForTimeout(10000);
const t = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sm = (await import('/frontend/app/core/settingsManager.js')).default;
  const eb = (await import('/frontend/app/core/eventBus.js')).default;
  const fp = await import('/frontend/modules/flashPanel/index.js');
  for (const [k, v] of [['runtime', 'js'], ['seedlingSolverWalk', true], ['seedlingSolveProgressView', 'auto'], ['seedlingSolverUpgradeWindowWork', 85]]) await sm.updateSetting(`moduleSettings.flashPanel.${k}`, v, { persist: false });
  const path = './presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json';
  let loaded = false; eb.subscribe('stateManager:rulesLoaded', () => { loaded = true; }, 'probe');
  eb.publish('files:jsonLoaded', { jsonData: await (await fetch(path)).json(), selectedPlayerId: '1', sourceName: path }, 'tutorials');
  while (!loaded) await sleep(100);
  eb.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'tutorials'); await sleep(4000);
  await window.stateManagerProxy.addItemToInventory('Progressive Sword', 1); await sleep(2000);
  const out = []; const t0 = performance.now();
  const cross = () => ((document.querySelector('.flash-panel-log')?.textContent ?? '').match(/level 12 -> 33: crossing/g) ?? []).length;
  const sample = (tag) => { const p = fp.getActivePanelInstance(); const rt = p?.seedlingPlaybackSurface?.()?.jsRuntime; const v = document.querySelector('.flash-panel-solve-progress'); out.push({ tag, t: Math.round(performance.now() - t0), cross: cross(), lvl: rt?.run?.level, st: rt?.playback?.state, solves: rt?.playback?.solverStats?.solves, keys: rt?.playback?.solverStats?.lastSolve?.keys, win: rt?.playback?.solverUpgradeWindowWork, fin: v?.dataset.final, out: v?.dataset.outcome, vis: v?.dataset.visible, head: (v?.textContent ?? '').slice(13, 95), demo: document.querySelector('.flash-panel-container')?.dataset.solveDemo }); };
  eb.publish('flashPanel:stageSolveDemo', { demo: 'l12-dash-cut' }, 'tutorials');
  for (let i = 0; i < 60; i++) { await sleep(500); sample('A'); if (out.at(-1).cross >= 1) break; }
  await sm.updateSetting('moduleSettings.flashPanel.seedlingSolverUpgradeWindowWork', 0, { persist: false });
  await sleep(100);
  eb.publish('flashPanel:stageSolveDemo', { demo: 'l12-dash-cut' }, 'tutorials');
  for (let i = 0; i < 60; i++) { await sleep(500); sample('B'); if (out.at(-1).cross >= 2 && out.at(-1).st === 'done') break; }
  const log = (document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').filter((l) => /solve demo|12 -> 33|33 -> 12|teleport|arrival/.test(l)).slice(-14);
  return { out, log };
});
let last = '';
for (const r of t.out) { const k = JSON.stringify({ ...r, t: 0 }); if (k !== last) console.log(JSON.stringify(r)); last = k; }
for (const l of t.log) console.log('LOG', l.slice(0, 220));
await b.close();
