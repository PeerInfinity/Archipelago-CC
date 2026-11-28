// p4g fresh-page witness of a captured request's keys (measurement only): the player and every PushableBlockSpear, game vs model.
// usage: node p4g-block.mjs <jsonl> <id> <i> <keys.json> <from> <to>   (env: the solver env the keys were made under)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('playwright');
const R = '/home/user/Archipelago-CC/';
const { takeBoxLockOrExit } = await import(R + 'scripts/procgen/boxLock.js');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(R + 'scripts/procgen/headlessChromium.js');
const { assertLogicOnlyChannel } = await import(R + 'scripts/procgen/seedlingChannel.js');
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const J = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { buildStagedTape } = await import(R + 'frontend/modules/seedlingDemo/botDriverV1.js');
const TF = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const [,, file, id, i, keysFile, from = '280', to = '360'] = process.argv;
takeBoxLockOrExit({ name: 'entry38-shove p4g block witness (scratch)', kind: 'browser' });
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const { passes, source, ...tape0 } = restoreRequest(leg.requests.find((r) => String(r.i) === i).request);
const levelSource = levelSourceFromAtlas(source.records);
const K = JSON.parse(readFileSync(keysFile, 'utf8'));
const perTick = [...tape0.perTick, ...K.keys.slice(tape0.perTick.length).map((k) => new Set(k))];
const sessEquips = new Map([...(tape0.equips ?? new Map()), ...(K.equips ?? [])]);
// slot translation: a tape cannot declare inventory_slots, so a fresh page builds the fresh order
const sess = tape0.staging.inventory_slots;
const fresh = TF.inventorySlotsFor(tape0.staging.seam.items);
const tr = (s) => { const f = fresh.indexOf(sess[s]); if (f < 0) throw new Error(`slot ${s} (item ${sess[s]}) not in fresh ${fresh}`); return f; };
const seam = { ...tape0.staging.seam, primary: tr(tape0.staging.seam.primary), secondary: tr(tape0.staging.seam.secondary) };
const { inventory_slots: _drop, ...rest } = tape0.staging;
const staging = { ...rest, seam, equips: [...sessEquips].map(([t, s]) => ({ t, slot: tr(s) })) };
const tape = TF.parseTape(JSON.parse(JSON.stringify(buildStagedTape({ staging, perTick, name: 'entry38-witness' }))));
// model: the session-slot staging, row by row
const mrun = J.replayTape({ staging: tape0.staging, perTick: [], levelSource, scratchPersistence: true });
const model = [];
perTick.forEach((h, k) => { const s = sessEquips.get(k); if (s !== undefined) mrun.equipNow(s); mrun.advance(h);
  model.push({ t: k + 1, level: mrun.level, x: mrun.state.x, y: mrun.state.y, blocks: [...mrun.entities('pushables').values()].filter((b) => !b.removed).map((b) => `${b.rect.x},${b.rect.y}`).join(';') }); });
console.log('slots', JSON.stringify(sess), '->', JSON.stringify(fresh), 'equips', JSON.stringify(staging.equips), 'ticks', perTick.length);
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const game = new Map();
let status = null;
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html', { waitUntil: 'domcontentloaded' });
  for (let n = 0; n < 960 && !(await page.evaluate(() => !!window.__runtimeReady)); n++) await page.waitForTimeout(250);
  await page.click('#btn-start');
  for (let n = 0; n < 960 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); n++) await page.waitForTimeout(250);
  await assertLogicOnlyChannel(page);
  const loaded = await page.evaluate((j) => String(window.__swfBridge.game.botLoadTape(j)), JSON.stringify(TF.gameVisibleTape(tape)));
  if (loaded !== 'ok') throw new Error('botLoadTape: ' + loaded);
  const started = await page.evaluate(() => String(window.__swfBridge.game.botStart()));
  if (started !== 'ok') throw new Error('botStart: ' + started);
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botStatus()), String(g.botMobiles())]; });
    const s = JSON.parse(raw[0]); const m = JSON.parse(raw[1]);
    if (Number.isInteger(s.tick) && m.tick === s.tick) game.set(s.tick, { t: s.tick, level: s.level, x: s.x, y: s.y,
      blocks: (m.mobiles ?? []).filter((r) => /PushableBlockSpear$/.test(r.cls)).map((r) => `${r.x},${r.y}`).join(';'), hits: s.hits });
    if (s.finished) { status = s; break; }
  }
} finally { await browser.close(); }
writeFileSync(keysFile + '.game.json', JSON.stringify({ status, game: [...game.values()] }));
console.log('status', JSON.stringify({ level: status?.level, x: status?.x, y: status?.y, finished: status?.finished, error: status?.error, tick: status?.tick, hits: status?.hits }));
let firstPlayer = null; let firstBlock = null; let compared = 0;
for (const g of [...game.values()].sort((a, b) => a.t - b.t)) {
  const m = model[g.t - 1]; if (!m) continue; compared += 1;
  if (firstPlayer === null && (g.level !== m.level || Math.abs(g.x - m.x) > 1e-6 || Math.abs(g.y - m.y) > 1e-6)) firstPlayer = { game: g, model: m };
  if (firstBlock === null && g.blocks !== m.blocks) firstBlock = { game: g, model: m };
}
console.log('compared', compared, 'of', model.length, 'first player diff', JSON.stringify(firstPlayer), 'first block diff', JSON.stringify(firstBlock));
for (const g of [...game.values()].sort((a, b) => a.t - b.t)) {
  if (g.t < +from || g.t > +to) continue; const m = model[g.t - 1];
  console.log(`t${g.t} game p(${g.x.toFixed?.(2) ?? g.x},${g.y.toFixed?.(2) ?? g.y}) block ${g.blocks} | model p(${m?.x.toFixed(2)},${m?.y.toFixed(2)}) block ${m?.blocks}`);
}
