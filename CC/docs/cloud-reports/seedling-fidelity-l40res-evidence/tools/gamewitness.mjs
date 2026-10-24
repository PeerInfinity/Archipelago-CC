// scratch (L40RES D1): play a tape on p4g headless, sample EVERY mobile + status each poll (first sample per tick kept + last)
const { createRequire } = await import('node:module'); const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('playwright');
import { readFileSync, writeFileSync } from 'node:fs';
const P = '/home/user/Archipelago-CC/scripts/procgen/';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(P + 'headlessChromium.js');
const { takeBoxLockOrExit } = await import(P + 'boxLock.js');
const { assertLogicOnlyChannel } = await import(P + 'seedlingChannel.js');
const { gameVisibleTape, parseTape } = await import(M + 'tapeFormat.js');
const [file, out] = process.argv.slice(2);
const tape = parseTape(readFileSync(file, 'utf8'));
takeBoxLockOrExit({ name: 'l40res-gamewitness.mjs', kind: 'browser' });
const PAGE = `http://localhost:${process.env.SEEDLING_PORT || '9729'}/frontend/modules/flashPanel/wasm/${process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g'}/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const frames = new Map();
let status = null;
try {
  const page = await browser.newPage();
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
  await page.click('#btn-start');
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
  await assertLogicOnlyChannel(page);
  const bot = (n, a) => page.evaluate(([name, x]) => { const g = window.__swfBridge.game; return String(x === undefined ? g[name]() : g[name](x)); }, [n, a]);
  const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
  if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
  const started = await bot('botStart');
  if (started !== 'ok') throw new Error(`botStart: ${started}`);
  const deadline = Date.now() + 900000;
  while (Date.now() < deadline) {
    const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botMobiles()), String(g.botStatus())]; });
    const m = JSON.parse(raw[0]); const s = JSON.parse(raw[1]);
    const tick = m.tick ?? s.tick;
    const row = { tick, status: s, mobiles: m.mobiles ?? [] };
    if (!frames.has(tick)) frames.set(tick, { first: row }); else frames.get(tick).last = row;
    if (s.finished) { status = s; break; }
  }
} finally { await browser.close(); }
writeFileSync(out, JSON.stringify({ finished: status, frames: [...frames.entries()].map(([t, f]) => ({ t, ...f })) }));
console.log('finished', !!status, 'frames', frames.size);
