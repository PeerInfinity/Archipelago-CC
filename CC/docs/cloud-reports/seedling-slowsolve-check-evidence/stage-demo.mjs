// Scratch: stage a solve demo through flashPanel:stageSolveDemo and sample the Solve Progress view.
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`); // run from the worktree root
const { chromium } = require('playwright');
const [port, demo, mode = 'auto'] = process.argv.slice(2);
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(`http://localhost:${port}/frontend/`, { waitUntil: 'load' }); await page.waitForTimeout(10000);
const t = await page.evaluate(async ({ demo, mode }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sm = (await import('/frontend/app/core/settingsManager.js')).default;
  const eb = (await import('/frontend/app/core/eventBus.js')).default;
  const fp = await import('/frontend/modules/flashPanel/index.js');
  await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
  await sm.updateSetting('moduleSettings.flashPanel.seedlingSolverWalk', true, { persist: false });
  await sm.updateSetting('moduleSettings.flashPanel.seedlingSolveProgressView', mode, { persist: false });
  const path = './presets/seedling_atlas/AP_1/AP_1_rules.json';
  let loaded = false; eb.subscribe('stateManager:rulesLoaded', () => { loaded = true; }, 'probe');
  eb.publish('files:jsonLoaded', { jsonData: await (await fetch(path)).json(), selectedPlayerId: '1', sourceName: path }, 'tutorials');
  while (!loaded) await sleep(100);
  eb.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'tutorials');
  await sleep(3000);
  const t0 = performance.now();
  eb.publish('flashPanel:stageSolveDemo', { demo }, 'tutorials');
  const out = [];
  let rt = null;
  for (;;) {
    await sleep(2000);
    const p = fp.getActivePanelInstance();
    rt ??= p?.seedlingPlaybackSurface?.()?.jsRuntime ?? null;
    const v = document.querySelector('.flash-panel-solve-progress');
    const root = document.querySelector('.flash-panel-container')?.dataset ?? {};
    const work = (v?.textContent.match(/work (\d+) \/ (\d+)/) ?? []).slice(1).join('/');
    const tiles = (v?.textContent.match(/(\d+) of \d+×\d+ tiles reached/) ?? [])[1];
    out.push({ t: Math.round(performance.now() - t0), demo: root.solveDemo, why: root.solveDemoWhy, vis: v?.dataset.visible, final: v?.dataset.final, outcome: v?.dataset.outcome, shows: v?.dataset.shows, work, tiles, state: rt?.playback?.state, flags: rt ? Object.entries(rt.flags).filter(([, x]) => x === true).map(([k]) => k).join(',') : '' });
    if (root.solveDemo === 'refused') break;
    if (rt && ['done', 'failed'].includes(rt.playback.state)) break;
    if (performance.now() - t0 > 400000) break;
  }
  const s = rt?.playback?.solverStats;
  return { out, stats: s && { solves: s.solves, declines: s.declines, expiries: s.expiries, backstops: s.backstops, lastWaitMs: s.lastWaitMs, lastDecline: String(s.lastDecline).slice(0, 300) }, describe: rt?.playback?.describe?.() };
}, { demo, mode });
for (const r of t.out) console.log(JSON.stringify(r));
console.log(JSON.stringify({ stats: t.stats, describe: t.describe }));
await b.close();
