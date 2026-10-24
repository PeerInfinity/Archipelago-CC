// D1: the two instruments on ONE p4f run — the chaser probe's first poll per tick vs the Bot's own obs (botDrain).
const { chromium } = (await import(process.cwd() + '/node_modules/playwright/index.js')).default;
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.cwd();
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(REPO, 'scripts/procgen/headlessChromium.js'));
const { takeBoxLockOrExit } = await import(join(REPO, 'scripts/procgen/boxLock.js'));
const { gameVisibleTape, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const [file, out, upto = '12'] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(file, 'utf8'));
const tape = parseTape(JSON.stringify(raw.tape ?? raw));
takeBoxLockOrExit({ name: 'd1-two-instruments', kind: 'browser' });
const URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4f/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const polls = []; let drained = [];
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
  await page.click('#btn-start');
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
  const bot = (n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
  if (await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('load');
  if (await bot('botStart') !== 'ok') throw new Error('start');
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    const s = JSON.parse(await bot('botStatus'));
    polls.push({ tick: s.tick, level: s.level, x: s.x, y: s.y, dead: s.dead_frames, frozen: s.frozen, buffered: s.buffered });
    if (s.finished || s.tick > Number(upto) + 2) break;
  }
  drained = JSON.parse(await bot('botDrain')).ticks;
} finally { await browser.close(); }
const first = new Map(), last = new Map();
for (const p of polls) { if (!first.has(p.tick)) first.set(p.tick, p); last.set(p.tick, p); }
const rows = [];
for (let t = 0; t <= Number(upto); t++) {
  const o = drained.find((d) => d.t === t);
  rows.push({ t, botObs: o ? [o.x, o.y] : null, firstPoll: first.get(t) ? [first.get(t).x, first.get(t).y, first.get(t).dead] : null,
    lastPoll: last.get(t) ? [last.get(t).x, last.get(t).y, last.get(t).dead] : null, polls: polls.filter((p) => p.tick === t).length });
}
writeFileSync(out, JSON.stringify({ file, polls: polls.length, rows }, null, 1));
for (const r of rows) console.log(JSON.stringify(r));
