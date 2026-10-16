// Scratch D1 probe: time page (JS runtime) solves of candidate levels on seedling_atlas.
// usage: node time-solves.mjs <port> <candidate-id>...
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`); // run from the worktree root
const { chromium } = require('playwright');
const port = process.argv[2];
const CANDS = {
  l6: { level: 6, from: 5, exit: [224, 32], flags: {} },
  l18: { level: 18, from: 16, exit: [176, 112], flags: { hasSword: true }, world: 'seedling_playthrough', grant: ['Progressive Sword'] },
  l18bare: { level: 18, from: 16, exit: [176, 112], flags: {} },
  l40chest39: { level: 40, at: [480, 896], goal: { kind: 'location', level: 40, tag: 13, entityType: 'chest' },
    flags: { hasTorch: true, hasFire: true, hasShield: true, hasSword: true }, world: 'seedling_playthrough', grant: ['Progressive Sword', 'Progressive Shield', 'Fire', 'Light'] },
  l40chest43: { level: 40, at: [320, 592], goal: { kind: 'location', level: 40, tag: 13, entityType: 'chest' },
    flags: { hasTorch: true, hasFire: true, hasShield: true, hasSword: true }, world: 'seedling_playthrough', grant: ['Progressive Sword', 'Progressive Shield', 'Fire', 'Light'] },
  l40pit39: { level: 40, at: [480, 896], exit: [80, 320], flags: { hasTorch: true, hasFire: true, hasShield: true, hasSword: true }, world: 'seedling_playthrough', grant: ['Progressive Sword', 'Progressive Shield', 'Fire', 'Light'] },
};
const ids = process.argv.slice(3);
const browser = await chromium.launch({ headless: true });
for (const id of ids) {
  const c = CANDS[id];
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`[${id}] pageerror ${e.message}`));
  await page.goto(`http://localhost:${port}/frontend/?game=seedling_atlas&seed=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(15000);
  const res = await page.evaluate(async (c) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, ms) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await sleep(100); } };
    const sm = (await import('/frontend/app/core/settingsManager.js')).default;
    const eb = (await import('/frontend/app/core/eventBus.js')).default;
    const fp = await import('/frontend/modules/flashPanel/index.js');
    const { returnKey, returnSpawnTable } = await import('/frontend/modules/flashPanel/seedlingReturnSpawns.js');
    await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
    await sm.updateSetting('moduleSettings.flashPanel.seedlingSolverWalk', true, { persist: false });
    await sm.updateSetting('moduleSettings.flashPanel.seedlingSolveProgressView', 'always', { persist: false });
    const path = `./presets/${c.world ?? 'seedling_atlas'}/AP_1/AP_1_rules.json`;
    const jsonData = await (await fetch(path)).json();
    if (window.moduleManagerApi?.enableModule) await window.moduleManagerApi.enableModule('flashPanel');
    let loaded = false; eb.subscribe('stateManager:rulesLoaded', () => { loaded = true; }, 'tutorials');
    eb.publish('files:jsonLoaded', { jsonData, selectedPlayerId: '1', sourceName: path }, 'tutorials');
    if (!await until(() => loaded, 60000)) return { err: 'rules not loaded' };
    eb.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'tutorials');
    const panel = await until(() => { const p = fp.getActivePanelInstance(); return p?.transport === 'js' && p._apLoadResult ? p : null; }, 60000);
    if (!panel) { const p = fp.getActivePanelInstance(); return { err: 'no js panel', p: !!p, transport: p?.transport, ap: JSON.stringify(p?._apLoadResult)?.slice(0,300), atlas: !!p?.seedlingPlaybackSurface?.()?.atlas, mm: Object.keys(window.moduleManagerApi||{}), log: (document.querySelector('.flash-panel-log')?.textContent ?? '').slice(-800) }; }
    const win = () => { try { return document.getElementById(panel.flashObjectId)?.contentWindow; } catch { return null; } };
    const rt = await until(() => { const r = win()?.__seedlingJsRuntime; return r?.run ? r : null; }, 30000);
    if (!rt) return { err: 'no rt' };
    await until(() => rt.playback.solverWalk === true, 5000);
    const map = await (await fetch('/frontend/modules/flashPanel/atlases/seedling-map.json')).json();
    let at = c.at;
    if (!at) {
      const room = map.levels.find((l) => l.level === c.level);
      const door = room.entities.find((e) => Number(e.attrs?.to) === c.from);
      const sp = returnSpawnTable(map).get(returnKey(c.level, Math.floor(door.x / 16), Math.floor(door.y / 16)));
      at = [sp.x, sp.y];
    }
    const goal = c.goal ?? { kind: 'exit', level: c.level, tiles: [[Math.floor(c.exit[0] / 16), Math.floor(c.exit[1] / 16)]] };
    for (const it of c.grant ?? []) await window.stateManagerProxy.addItemToInventory(it, 1);
    if (c.grant) await window.stateManagerProxy.pingWorker('grant', 5000);
    if (c.grant && !await until(() => Object.entries(c.flags).every(([k, v]) => rt.flags[k] === v), 15000)) return { err: 'grant did not reach page', flags: rt.flags };
    if (!c.grant) { const items = Object.entries(c.flags).map(([property, value]) => ({ class: 'Main', property, value })); if (items.length) rt.queueItems(items); }
    panel._solveProgressView?.feed?.refresh?.();
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [c.level, at[0], at[1]] }]);
    const there = await until(() => rt.run?.level === c.level && Object.entries(c.flags).every(([k, v]) => rt.flags[k] === v), 15000);
    if (!there) return { err: `not in level ${c.level}`, flags: rt.flags, level: rt.run?.level };
    await sleep(500);
    const answer = rt.playback.walkTo(goal);
    const t0 = performance.now();
    rt.playback.play();
    const samples = [];
    let firstSolveAt = null;
    const done = await until(() => {
      const s = rt.playback.solverStats;
      if (firstSolveAt === null && s?.solves > 0) firstSolveAt = performance.now() - t0;
      const v = document.querySelector('.flash-panel-solve-progress');
      if (samples.length < 4000 && Math.round(performance.now() - t0) % 5000 < 110) samples.push({ t: Math.round(performance.now() - t0), state: rt.playback.state, d: v ? { ...v.dataset } : null });
      return ['done', 'failed'].includes(rt.playback.state) || rt.halted;
    }, 330000);
    const wall = performance.now() - t0;
    const s = rt.playback.solverStats;
    const v = document.querySelector('.flash-panel-solve-progress');
    return { at, goal, answer, settled: !!done, state: rt.playback.state, wall: Math.round(wall), firstSolveAt: firstSolveAt && Math.round(firstSolveAt),
      describe: rt.playback.describe(), stats: { ...s, lastSolve: s.lastSolve ? { ...s.lastSolve, goal: undefined, plan: undefined } : null },
      view: v ? { ...v.dataset, text: v.textContent.slice(0, 600) } : null, samples: samples.slice(0, 80),
      log: (document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').filter((l) => /solv|budget|work units|declin|refus/i.test(l)).slice(-15) };
  }, c);
  console.log(JSON.stringify({ id, ...res }));
  await page.close();
}
await browser.close();
