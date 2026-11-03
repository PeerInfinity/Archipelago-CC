// scratch (CORPSEBUMP2): play a tape JSON (latch2's OUT) on the p4g page headless, compare with the model at 0 px.
// usage: SEEDLING_PORT=9767 OVER='{...}' node witness.mjs <tape.json> [dumpFrom-dumpTo]
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('playwright');
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(ROOT + '/scripts/procgen/headlessChromium.js');
const { assertLogicOnlyChannel } = await import(ROOT + '/scripts/procgen/seedlingChannel.js');
const { takeBoxLockOrExit } = await import(ROOT + '/scripts/procgen/boxLock.js');
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { compareCorpseBumpWitness } = await import(M + 'fidelityCorpseBump.js');
const { l40LatchModelSamples, l40LatchSampleOf } = await import(M + 'fidelityL40Latch.js');
const { gameVisibleTape, parseTape } = await import(M + 'tapeFormat.js');
takeBoxLockOrExit({ name: 'corpsebump2 witness.mjs', kind: 'browser' });
const tapeJson = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const over = process.env.OVER ? JSON.parse(process.env.OVER) : {};
const model = await l40LatchModelSamples(tapeJson, over);
console.log('model error', model.error, 'model hits', JSON.stringify(model.hits));
const tape = parseTape(JSON.stringify(tapeJson));
const URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
let samples = []; let status = null;
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
  await page.click('#btn-start');
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
  await assertLogicOnlyChannel(page);
  const bot = (n, a) => page.evaluate(([name, x]) => { const g = window.__swfBridge.game; return String(x === undefined ? g[name]() : g[name](x)); }, [n, a]);
  if ((await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)))) !== 'ok') throw new Error('load');
  if ((await bot('botStart')) !== 'ok') throw new Error('start');
  const byTick = new Map(); const deadline = Date.now() + 1200000;
  while (Date.now() < deadline) {
    const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botStatus()), String(g.botMobiles())]; });
    const s = JSON.parse(raw[0]); const m = JSON.parse(raw[1]);
    if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, l40LatchSampleOf(s, m));
    if (s.finished) { status = s; break; }
  }
  samples = [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t);
} finally { await browser.close(); }
console.log('status', JSON.stringify(status).slice(0, 300));
const bad = compareCorpseBumpWitness(samples, model.samples);
console.log(`0px compare: ${samples.length} sampled ticks, ${bad.length} differ`, bad.slice(0, 5).join(' ; '));
const badHits = samples.filter((g) => (model.samples[g.t]?.hits ?? null) !== (g.hits ?? 0)).map((g) => `t${g.t} game ${g.hits} model ${model.samples[g.t]?.hits}`);
console.log(`hits compare: ${badHits.length} differ`, badHits.slice(0, 5).join(' ; '));
// the corpse on the game: its tile timeline
let last = null;
for (const g of samples) {
  const t = (g.bodies ?? []).find((b) => b.cls === 'IceTurret');
  const k = t ? `${t.anim ?? 'live'} ${Math.floor(t.x / 16)},${Math.floor(t.y / 16)}` : 'none';
  if (k !== last) { console.log('GAME-TL', `t${g.t}`, k, t ? `(${t.x},${t.y})` : '', `p(${g.x},${g.y})`); last = k; }
}
if (process.argv[3]) { const [a, b] = process.argv[3].split('-').map(Number); for (const g of samples.filter((x) => x.t >= a && x.t <= b)) { const m = model.samples[g.t]; console.log(`t${g.t} game p(${g.x},${g.y}) ${JSON.stringify(g.bodies.filter(x=>x.cls==='IceTurret'))} | model p(${m?.x},${m?.y}) ${JSON.stringify(m?.bodies.filter(x=>x.cls==='IceTurret'))}`); } }
