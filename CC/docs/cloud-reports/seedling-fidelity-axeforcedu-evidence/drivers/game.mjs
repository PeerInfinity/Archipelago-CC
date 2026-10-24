// AXEFORCEDU copy of AXETIMING's drivers/game.mjs (box-lock name changed).
// The game's own per-tick record of a tape: botDrain obs + the LAST poll's hits/hits_timer at each tick (the Bot's point).
const { chromium } = (await import(process.cwd() + '/node_modules/playwright/index.js')).default;
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.cwd();
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(REPO, 'scripts/procgen/headlessChromium.js'));
const { takeBoxLockOrExit } = await import(join(REPO, 'scripts/procgen/boxLock.js'));
const { gameVisibleTape, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const [file, out] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(file, 'utf8'));
const tape = parseTape(JSON.stringify(raw.tape ?? raw));
takeBoxLockOrExit({ name: 'axeforcedu-game-record', kind: 'browser' });
const URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4f/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const last = new Map(); let obs = []; let mobAt = new Map();
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
  await page.click('#btn-start');
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
  const bot = (n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
  if (await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('load');
  if (await bot('botStart') !== 'ok') throw new Error('start');
  const deadline = Date.now() + 900000;
  while (Date.now() < deadline) {
    const [st, mb] = await page.evaluate(() => [String(window.__swfBridge.game.botStatus()), String(window.__swfBridge.game.botMobiles())]);
    const s = JSON.parse(st);
    last.set(s.tick, { hits: s.hits, hits_timer: s.hits_timer, x: s.x, y: s.y, level: s.level });
    if (process.env.MOB) { const m = JSON.parse(mb); mobAt.set(s.tick, (m.mobiles || []).filter((r) => !/Player$/.test(r.cls)).map((r) => ({ cls: r.cls, x: r.x, y: r.y, anim: r.anim }))); }
    if (s.finished) break;
  }
  obs = JSON.parse(await bot('botDrain')).ticks;
} finally { await browser.close(); }
const rows = obs.map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y, ...(last.get(o.t) ? { hits: last.get(o.t).hits, hits_timer: last.get(o.t).hits_timer } : {}), ...(mobAt.get(o.t) ? { mob: mobAt.get(o.t) } : {}) }));
writeFileSync(out, JSON.stringify({ tape: raw.tape ?? raw, rows }, null, 0));
console.log(`recorded ${rows.length} game rows; hit ticks: ${rows.filter((r, i) => i > 0 && r.hits !== rows[i - 1].hits).map((r) => `t${r.t}(${r.x.toFixed(1)},${r.y.toFixed(1)}) hits ${r.hits}`).join(' ')}`);
