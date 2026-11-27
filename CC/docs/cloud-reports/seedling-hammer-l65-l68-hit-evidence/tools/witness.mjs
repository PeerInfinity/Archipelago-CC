// p4g fresh-page witness of a chained plan (measurement only). Usage: node witness.mjs <chain.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module'; const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('@playwright/test');
import { ctx } from './chain.mjs';
const R = '/home/user/Archipelago-CC/';
const { takeBoxLockOrExit } = await import(R + 'scripts/procgen/boxLock.js');
const { HEADLESS_WEBGPU_ARGS } = await import(R + 'scripts/procgen/headlessChromium.js');
const { buildStagedTape } = await import(R + 'frontend/modules/seedlingDemo/botDriverV1.js');
const { parseTape, inventorySlotsFor } = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const { gameVisibleTape } = await import(R + 'frontend/modules/seedlingDemo/wasmPlayback.js').catch(() => ({}));
const TF = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const gv = gameVisibleTape ?? TF.gameVisibleTape;
const { J, levelSource, tape0 } = ctx;
takeBoxLockOrExit({ name: 'l65-l68-hit witness (scratch)', kind: 'browser' });
const chain = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const perTick = chain.perTick.map((k) => new Set(k));
// ⚠ slot translation: a tape cannot declare inventory_slots, so a fresh page builds fresh order
const sess = tape0.staging.inventory_slots;
const fresh = inventorySlotsFor(tape0.staging.seam.items);
const tr = (i) => { const f = fresh.indexOf(sess[i]); if (f < 0) throw new Error(`slot ${i} (item ${sess[i]}) not in fresh ${fresh}`); return f; };
const seam = { ...tape0.staging.seam, primary: tr(tape0.staging.seam.primary), secondary: tr(tape0.staging.seam.secondary) };
const equips = chain.equips.map(([t, s]) => ({ t, slot: tr(s) }));
const { inventory_slots: _drop, ...rest } = tape0.staging;
const staging = { ...rest, seam, equips };
const raw = buildStagedTape({ staging, perTick, name: 'l65-l68-witness' });
const tape = parseTape(JSON.parse(JSON.stringify(raw)));
// model: the original (session slots) vs the translated staging (fresh slots), row by row
const rowsOf = (st, eq) => { const run = J.replayTape({ staging: st, perTick: [], levelSource, scratchPersistence: true }); const rows = [];
  perTick.forEach((h, i) => { const s = eq.get(i); if (s !== undefined) run.equipNow(s); run.advance(h); rows.push([run.level, run.state.x, run.state.y]); });
  return { rows, hits: run.ledger('playerHits'), deaths: run.ledger('playerDeaths').length }; };
const mSess = rowsOf(tape0.staging, new Map(chain.equips));
const mFresh = rowsOf(staging, new Map()); // the staging's equips fire on the run
const md = mSess.rows.findIndex((r, i) => r.some((v, j) => v !== mFresh.rows[i][j]));
console.log('model session vs fresh-slot model: first diff', md, 'hits', mSess.hits.length, mFresh.hits.length, 'slots', JSON.stringify(sess), '->', JSON.stringify(fresh));
const browser = await chromium.launch({ args: [...HEADLESS_WEBGPU_ARGS] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://localhost:8000/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__runtimeReady === true, null, { timeout: 600000 });
  await page.click('#btn-start');
  await page.waitForFunction(() => typeof window.__swfBridge?.game?.botStatus === 'function' && window.__swfBridge.game.botStatus(), null, { timeout: 600000 });
  const loaded = await page.evaluate((j) => window.__swfBridge.game.botLoadTape(j), JSON.stringify(gv(tape)));
  if (loaded !== 'ok') throw new Error('botLoadTape: ' + loaded);
  const started = await page.evaluate(() => window.__swfBridge.game.botStart());
  if (started !== 'ok') throw new Error('botStart: ' + started);
  await page.waitForFunction(() => JSON.parse(window.__swfBridge.game.botStatus()).finished === true, null, { timeout: 1200000, polling: 250 });
  const status = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
  const drained = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botDrain()));
  const obs = drained.ticks;
  writeFileSync(process.argv[2] + '.drain.json', JSON.stringify({ status, obs }));
  const k0 = Object.keys(obs[0] ?? {});
  let first = -1;
  const levels = new Set();
  for (let i = 0; i < Math.min(obs.length, mFresh.rows.length); i++) {
    const o = obs[i]; const m = mFresh.rows[i]; levels.add(o.level);
    if (o.level !== m[0] || Math.abs(o.x - m[1]) > 1e-9 || Math.abs(o.y - m[2]) > 1e-9) { first = i; break; }
  }
  console.log('obs keys', JSON.stringify(k0));
  console.log('game rows', obs.length, 'model rows', mFresh.rows.length, 'levels', JSON.stringify([...levels]), 'first differing row', first,
    first >= 0 ? JSON.stringify({ game: obs[first], model: mFresh.rows[first] }) : '');
  console.log('status', JSON.stringify({ level: status.level, x: status.x, y: status.y, finished: status.finished, error: status.error, hits: status.hits, hits_timer: status.hits_timer, tick: status.tick, tick_count: status.tick_count }));
  console.log('model end', JSON.stringify(mFresh.rows.at(-1)), 'model hits', mFresh.hits.length, 'deaths', mFresh.deaths, 'page errors', errors.length);
} finally { await browser.close(); }
