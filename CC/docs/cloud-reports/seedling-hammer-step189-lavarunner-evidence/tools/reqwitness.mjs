#!/usr/bin/env node
// MEASUREMENT-ONLY (chaser-stand): solve ONE captured page request as the worker does (solveAnytime, the request's own
// budget and passes, SEEDLING_* switches from env), then play the request's prefix + the plan ON THE GAME (headless p4g,
// logic-only, fresh page, delivered AP set, under the box lock) — legwitness.mjs's play half (L40-SPINNER-WALLS), with
// the staged tape over the WHOLE key stream (prefix then plan) and the prefix's equips kept.
//   node reqwitness.mjs <capture.jsonl> <id> <i> <out.json> [seamTime]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/home/user/Archipelago-CC';
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const [file, id, i, outFile, seamArg] = process.argv.slice(2);
const row0 = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === String(id));
const cap = row0.requests.find((r) => String(r.i) === String(i)).request;
if (seamArg) cap.staging.seam.time = Number(seamArg);
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { solveAnytime, replayTape } = await M('jsRuntimeSolver.js');
const req = restoreRequest(cap);
const { passes, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
const solve = { ok: a.ok, work: a.work, ticks: a.plan?.solution?.length ?? null, passes: (a.passes ?? []).map(({ ms, ...p }) => p),
  message: a.ok ? null : String(a.message).slice(0, 400) };
solve.answer = a.ok ? (await import('node:crypto')).createHash('sha1').update(JSON.stringify(a.plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12) : null;
console.log('SOLVE', JSON.stringify(solve));
if (!a.ok) { writeFileSync(outFile, JSON.stringify({ solve })); process.exit(0); }
// the model's own replay of prefix + plan (hits after the prefix)
const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null, scratchPersistence: tape.scratchPersistence === true });
const h0 = run.playerHits.length;
a.plan.solution.forEach((h, k) => { const s = a.plan.equipsAt?.get?.(k); if (s !== undefined) run.equipNow(s); run.advance(h); });
const model = { hits: run.playerHits.slice(h0).map((h) => `t${h.t} ${h.source}:${h.id}`), end: { level: run.level, x: run.state.x, y: run.state.y } };
console.log('MODEL', JSON.stringify(model));
const P = tape.perTick.length;
const keys = [...tape.perTick, ...a.plan.solution];
const equips = new Map([...(tape.equips ?? new Map())]);
for (const [k, s] of a.plan.equipsAt ?? []) equips.set(P + k, s);
const { buildStagedTape } = await M('botDriverV1.js');
const { parseTape, gameVisibleTape, inventorySlotsFor } = await M('tapeFormat.js');
const { tapeEquips } = await M('wasmPlayback.js');
// a FRESH page builds its slot array from the held items (legwitness's note), so stage that one
const freshSlots = inventorySlotsFor(tape.staging.seam?.items ?? {});
// ⛓ step189: a slot index is the REQUEST's slot array's (the page's own order); a fresh page's order can differ, so each
// equip is re-aimed at the same ITEM in the fresh array (the request's [0,1,3,2] holds the spear in slot 2; fresh may not)
const reqSlots = tape.staging.inventory_slots ?? freshSlots;
const remapped = [...equips].map(([t, s]) => [t, freshSlots.indexOf(reqSlots[s])]);
console.log('SLOTS', JSON.stringify({ reqSlots, freshSlots, equips: [...equips], remapped }));
const staging = { ...tape.staging, inventory_slots: freshSlots, equips: tapeEquips(remapped) };
const built = buildStagedTape({ staging, perTick: keys, name: `req${id}-${i}` });
const gtape = parseTape(JSON.stringify(built));
const { createRequire } = await import('node:module'); const { chromium } = createRequire(join(R, 'package.json'))('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
const { planLevelSetChunks } = await M('levelSetValidator.js');
const { l25Sets } = await M('fidelityL25ApItem.js');
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
takeBoxLockOrExit({ name: 'step189-lavarunner-witness', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const call = (page, n, x) => page.evaluate(([name, v]) => String(v === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](v)), [n, x]);
const until = async (page, fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100); } };
const page = await browser.newPage();
try {
  await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
  await until(page, () => page.evaluate(() => !!window.__runtimeReady), 180000);
  await page.click('#btn-start');
  await until(page, () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
  await assertLogicOnlyChannel(page);
  const answers = [];
  for (const c of planLevelSetChunks(l25Sets(R).delivered).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
  if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
  const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(gtape)));
  if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
  if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
  const samples = []; const mobs = []; let lastM = -1;
  let lastT = -1; let status; let hitsAtPrefix = null;
  for (const t0 = Date.now(); Date.now() - t0 < 20 * 60 * 1000;) {
    status = JSON.parse(String(await call(page, 'botStatus')));
    if (status.error) throw new Error(status.error);
    if (Number.isInteger(status.tick) && status.tick >= lastT + 5) { lastT = status.tick; samples.push([status.tick, status.level, status.x, status.y, status.hits]); if (process.env.MOBILES && status.tick >= lastM + 10) { lastM = status.tick; mobs.push([status.tick, String(await call(page, 'botMobiles'))]); } }
    if (hitsAtPrefix === null && Number.isInteger(status.tick) && status.tick >= P) hitsAtPrefix = { tick: status.tick, hits: status.hits };
    if (status.finished) break;
    await page.waitForTimeout(10);
  }
  const out = { solve, model, game: { finished: !!status.finished, ticks: gtape.tick_count, prefix: P, hitsAtPrefix,
    end: { level: status.level, x: status.x, y: status.y }, hits: status.hits ?? null } };
  console.log('ROW', JSON.stringify(out.game));
  writeFileSync(outFile, JSON.stringify({ ...out, samples, mobs }));
} finally { await page.close(); await browser.close(); }
