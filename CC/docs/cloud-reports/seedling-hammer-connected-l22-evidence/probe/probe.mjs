// Real-server Seedling Playthrough check. node probe.mjs <server|local> <wsPort> [steps]
// S=<out dir> HTTP_PORT=<dev server port>. Read-only: drives the app through its bus, settings and the JS runtime page.
import { chromium } from '/home/robert/CC/Archipelago-CC-wt-hammer-connected-l22/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { takeBoxLock, releaseBoxLock } from '/home/robert/CC/Archipelago-CC-wt-hammer-connected-l22/scripts/procgen/boxLock.js';
takeBoxLock({ name: `hammer-connected-l22 probe ${process.argv[2]}`, kind: 'own-port', repo: '/home/robert/CC/Archipelago-CC-wt-sdc-connected-events', waitSec: 1800 });
const [scenario, port, stepsArg = ''] = process.argv.slice(2);
const S = process.env.S; const HTTP = process.env.HTTP_PORT || '8130';
const OUT = `${S}/run_${process.env.TAG || scenario}`; mkdirSync(OUT, { recursive: true });
const GAME = process.env.GAME_NAME || 'Seedling Playthrough';
const PRESET = process.env.PRESET_KEY || 'seedling_playthrough';
const SLOT = process.env.SLOT_NAME || 'Sprout';
const STEPS = !stepsArg ? [] : stepsArg.endsWith('.mjs') ? (await import(new URL(stepsArg, `file://${process.cwd()}/`).href)).default : JSON.parse(readFileSync(stepsArg, 'utf8'));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
const errors = [], consoleErr = [], frames = [], consoleAll = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error') consoleErr.push(t.slice(0, 300));
  if (/ap placement|goal|CLIENT_GOAL|StatusUpdate|seed|overlay|server-sent|local .* rules|Loop|mana|halt|refus/i.test(t)) consoleAll.push(`${Date.now()} ${m.type()}: ${t.slice(0, 400)}`); });
page.on('websocket', (ws) => {
  if (!ws.url().includes(`:${port}`)) return;
  const log = (dir) => (f) => { let j; try { j = JSON.parse(f.payload); } catch { return; }
    for (const c of j) if (['LocationChecks','ReceivedItems','RoomUpdate','PrintJSON','StatusUpdate','Connected','LocationScouts','LocationInfo','Connect','RoomInfo'].includes(c.cmd)) frames.push({ t: Date.now(), dir, cmd: c.cmd,
      ...(c.cmd==='Connected'?{slot:c.slot, keys:Object.keys(c.slot_data||{}), checked:c.checked_locations?.length, missing:c.missing_locations?.length}
        :c.cmd==='Connect'?{name:c.name, game:c.game}
        :c.cmd==='LocationChecks'?{locations:c.locations}
        :c.cmd==='StatusUpdate'?{status:c.status}
        :c.cmd==='LocationScouts'?{n:c.locations?.length}
        :c.cmd==='LocationInfo'?{n:c.locations?.length}
        :c.cmd==='ReceivedItems'?{index:c.index, items:c.items}
        :c.cmd==='RoomUpdate'?{checked_locations:c.checked_locations}
        :c.cmd==='PrintJSON'?{text:(c.data||[]).map(p=>p.text).join('')}:{}) }); };
  ws.on('framesent', log('>')); ws.on('framereceived', log('<'));
});
// No preset for the game (Path A has no local doc at all; Path B loads the seed-1 doc by hand).
await page.route('**/presets/preset_files.json', async (route) => {
  const res = await route.fetch(); const json = await res.json(); delete json[PRESET];
  await route.fulfill({ response: res, json });
});
await page.goto(`http://localhost:${HTTP}/frontend/index.html`);
await page.waitForFunction(async () => {
  if (!window.__apSpike) return false;
  const sm = await import('/frontend/modules/stateManager/index.js');
  return !!sm.getLastRawJsonData()?.rawJsonData && !!sm.stateManagerProxySingleton.getStaticData?.();
}, null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  window.__bus = (await import('/frontend/app/core/eventBus.js')).default;
  for (const e of ['files:jsonLoaded', 'ui:activatePanel', 'loops:setLoopMode']) window.__bus.registerPublisher(e, 'probe');
  window.__lines = [];
  window.__bus.subscribe('ui:printToConsole', (d) => window.__lines.push(d.message), 'probe');
  window.__fp = await import('/frontend/modules/flashPanel/index.js');
  window.__sm = await import('/frontend/modules/stateManager/index.js');
  window.__settings = (await import('/frontend/app/core/settingsManager.js')).default;
  await window.__settings.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
});
const R = { scenario, port, stages: {} };
const dump = async (stage) => {
  const d = await page.evaluate(async () => {
    const sm = window.__sm;
    const mh = (await import('/frontend/modules/client/core/messageHandler.js')).default;
    await sm.stateManagerProxySingleton.pingWorker?.('probe', 3000)?.catch?.(() => {});
    const raw = sm.getLastRawJsonData();
    const doc = raw?.rawJsonData; const sd = sm.stateManagerProxySingleton.getStaticData?.();
    const p = window.__fp.getActivePanelInstance?.();
    const ap = p?._apLoadResult;
    const frame = p ? document.getElementById(p.flashObjectId) : null;
    let rt = null; try { rt = frame?.contentWindow?.__seedlingJsRuntime ?? null; } catch {}
    const snap = sm.stateManagerProxySingleton.getLatestStateSnapshot();
    let gs = null; try { gs = (await import('/frontend/modules/gameState/singleton.js')).getGameStateSingleton(); } catch {}
    const reg = (await import('/frontend/app/core/centralRegistry.js')).centralRegistry;
    return {
      source: raw?.source, selectedPlayerInfo: raw?.selectedPlayerInfo ?? null, staticPlayerId: sd?.playerId ?? null,
      game: sd?.game_name ?? doc?.world?.[String(sd?.playerId)]?.game, seed_name: doc?.seed_name,
      worldKeys: Object.keys(doc?.world || {}), playerNames: sd?.player_names ?? doc?.player_names ?? null,
      panel: p ? { transport: p.transport, runtime: p._initRuntime,         apLoad: ap ? { ok: ap.ok, why: ap.why, steps: (ap.steps ?? []).map((s) => s.step ?? s.name ?? s.id ?? null) } : null, apRefusal: p._apLoadRefusal ?? null,
        bindingSelf: window.__fp.getSeedlingRegionGlue?.()?.checkBinding?.selfPlayer ?? null,
        bindingChecked: [...(window.__fp.getSeedlingRegionGlue?.()?.checkBinding?.checked ?? [])],
        entries: [...(window.__fp.getSeedlingRegionGlue?.()?.checkBinding?.table?.entries?.() ?? [])].map(([key, e]) => ({ key, location: e.location, item: e.item, player: e.player, look: e.look ?? null, vanillaItem: e.vanillaItem ?? null, level: e.level, tag: e.tag, rewrite: e.rewrite ?? true, entity: e.entity })),
        delivered: (p._seedlingRealSet?.rooms ?? []).flatMap((r) => (r?.source?.record?.entities ?? []).filter((e) => e.type === 'apitem').map((e) => ({ level: r.id, x: e.x, y: e.y, tag: e.attrs?.tag, look: e.attrs?.look }))),
        setId: p._seedlingRealSet?.set_id ?? null, panelLog: (p.logElement?.textContent ?? '').slice(-6000) } : null,
      rt: rt?.run ? { level: rt.run.level, x: rt.run.state?.x, y: rt.run.state?.y, collected: [...(rt.collected ?? [])].slice(0, 80), halted: rt.halted?.message ?? null, playback: rt.playback?.state ?? null } : null,
      clientSlot: mh.clientSlot ?? null, clientChecked: [...(mh.checkedLocationIds || [])],
      checkedNames: snap?.checkedLocations ? [...snap.checkedLocations] : null,
      inventory: snap?.inventory ? Object.entries(snap.inventory).filter(([, v]) => v > 0) : null,
      mana: gs?.getCurrentMana?.() ?? null, region: gs?.getCurrentRegion?.() ?? null,
      loopMode: reg.getPublicFunction?.('loops', 'isLoopModeActive')?.() ?? null,
    };
  });
  R.stages[stage] = d; return d;
};
const shot = async (name) => {
  const box = await page.evaluate(() => { const p = window.__fp.getActivePanelInstance?.(); const el = p ? document.getElementById(p.flashObjectId) : null; if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; });
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(box ? { clip: { x: box.x, y: box.y, width: box.w, height: box.h } } : {}) });
};
const panelUp = async (label) => {
  await page.evaluate(() => window.__bus.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'probe'));
  await page.waitForFunction(() => { const p = window.__fp.getActivePanelInstance?.(); if (!p?._apLoadResult) return false;
    const f = document.getElementById(p.flashObjectId); try { return !!f?.contentWindow?.__seedlingJsRuntime?.run; } catch { return false; } }, null, { timeout: 90000 })
    .catch(() => { R[`panelTimeout_${label}`] = true; });
  await page.waitForTimeout(2000);
};
await page.waitForFunction(async () => { try { (await import('/frontend/modules/gameState/singleton.js')).getGameStateSingleton(); return true; } catch { return false; } }, null, { timeout: 60000 });
await dump('0_boot');
if (scenario === 'local') {
  const local = await page.evaluate(async () => (await fetch('./presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json')).json());
  await page.evaluate(async (doc) => {
    await new Promise((resolve) => { const un = window.__bus.subscribe('stateManager:rulesLoaded', () => { un?.(); resolve(); }, 'probe');
      window.__bus.publish('files:jsonLoaded', { jsonData: doc, selectedPlayerId: '1', sourceName: 'userLoadedFile' }, 'probe'); });
  }, local);
  await panelUp('before');
  await dump('1_local_doc_before_connect');
  await shot('1_before_connect');
}
if (!process.env.NO_CONNECT) {
// hammer-connected-l22: run 1 received RoomInfo but never sent Connect (a late boot-time connect superseding this one,
// suspected); settle first. CONNECT_SETTLE_MS (default 15000).
await page.waitForTimeout(Number(process.env.CONNECT_SETTLE_MS || 15000));
R.tConnect = Date.now();
await page.evaluate(async (g) => { const mh = (await import('/frontend/modules/client/core/messageHandler.js')).default; mh.clientSlotName = g.slot; mh.chosenGame = g.game; }, { slot: SLOT, game: GAME });
await page.evaluate((p) => window.__apSpike.connect(`ws://localhost:${p}`), port);
const want = scenario === 'server' ? '^Loaded the server-sent ' : '^Loaded the local ';
await page.waitForFunction((re) => window.__lines.some((m) => new RegExp(re).test(m)), want, { timeout: 90000 }).catch(() => { R.loadLineTimeout = true; });
if (R.loadLineTimeout) { console.error('# connect did not load the server rules; aborting before the bot step'); R.aborted = 'no server rules'; writeFileSync(`${OUT}/result.json`, JSON.stringify(R, null, 1)); await browser.close(); releaseBoxLock(); process.exit(3); }
await page.waitForTimeout(3000);
if (!process.env.NO_PANEL) await panelUp('after');
R.consoleLines = await page.evaluate(() => window.__lines.slice());
await dump('2_after_connect');
await shot('2_after_connect');
} else { R.consoleLines = await page.evaluate(() => window.__lines.slice()); }
// Steps: [{ name, eval: "<async body with rt, win, p in scope>", wait }]
for (const st of STEPS) {
  try {
    R[`step_${st.name}`] = await page.evaluate(async (body) => {
      const p = window.__fp.getActivePanelInstance?.() ?? null; const el = p ? document.getElementById(p.flashObjectId) : null; const win = el?.contentWindow ?? null; const rt = win?.__seedlingJsRuntime ?? null;
      const fn = new Function('rt', 'win', 'p', 'bus', 'sm', `return (async () => { ${body} })();`);
      return await fn(rt, win, p, window.__bus, window.__sm);
    }, st.eval);
  } catch (e) { R[`step_${st.name}`] = { error: String(e).slice(0, 500) }; }
  if (st.wait) await page.waitForTimeout(st.wait);
  await dump(`s_${st.name}`); await shot(`s_${st.name}`);
}
R.consoleLinesEnd = await page.evaluate(() => window.__lines.slice());
R.errors = errors; R.consoleAll = consoleAll; R.consoleErrors = consoleErr.slice(0, 60); R.frames = frames;
writeFileSync(`${OUT}/result.json`, JSON.stringify(R, null, 1));
const brief = (v) => v && ({ source: v.source, spi: v.selectedPlayerInfo, pid: v.staticPlayerId, game: v.game, seed: v.seed_name, apLoad: v.panel?.apLoad, refusal: v.panel?.apRefusal, self: v.panel?.bindingSelf, n: v.panel?.entries?.length, nDelivered: v.panel?.delivered?.length, setId: v.panel?.setId, rt: v.rt, inv: v.inventory?.length, mana: v.mana, loop: v.loopMode, region: v.region });
console.log(JSON.stringify({ errors, loadLineTimeout: R.loadLineTimeout, lines: R.consoleLinesEnd.filter((m) => /Load|rules|seed|spoiler|goal|Logged|Not using|did not/i.test(m)).slice(0, 30),
  stages: Object.fromEntries(Object.entries(R.stages).map(([k, v]) => [k, brief(v)])),
  steps: Object.fromEntries(Object.keys(R).filter((k) => k.startsWith('step_')).map((k) => [k, R[k]])),
  wire: frames.filter((f) => ['LocationChecks','StatusUpdate','Connect','Connected'].includes(f.cmd) || (f.cmd === 'PrintJSON' && /Sprout/.test(f.text))) }, null, 1));
await browser.close();
releaseBoxLock();
