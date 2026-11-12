// probe: read dead_frames at finish, and again later; compare with latch.dead_frames
import { chromium } from '/home/user/Archipelago-CC/node_modules/playwright/index.mjs';
const REPO = '/home/user/Archipelago-CC';
const { HEADLESS_WEBGPU_ARGS } = await import(`${REPO}/scripts/procgen/headlessChromium.js`);
const { gameVisibleTape, parseTape } = await import(`${REPO}/frontend/modules/seedlingDemo/tapeFormat.js`);
const { readFileSync } = await import('node:fs');
const tape = JSON.parse(readFileSync(`${REPO}/frontend/modules/seedlingDemo/fixtures/tapes/r7-ends-meet-1.json`, 'utf8'));
const URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html';
const browser = await chromium.launch({ args: HEADLESS_WEBGPU_ARGS });
const call = (page, n, a) => page.evaluate(([n, a]) => { const g = window.__swfBridge?.game; return a === undefined ? g[n]() : g[n](a); }, [n, a]);
const N = Number(process.argv[2] || 6);
for (let i = 0; i < N; i++) {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  while (!(await page.evaluate(() => !!window.__runtimeReady))) await page.waitForTimeout(Number(process.argv[4] || 100));
  await page.click('#btn-start');
  while (!(await page.evaluate(() => !!window.__swfBridge?.game?.botSeam))) await page.waitForTimeout(Number(process.argv[4] || 100));
  await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(parseTape(tape))));
  await call(page, 'botStart');
  let st;
  const polls = [];
  for (;;) { st = JSON.parse(await call(page, 'botStatus')); polls.push(st.dead_frames); if (st.finished) break; await page.waitForTimeout(Number(process.argv[3] || 500)); }
  const seam = JSON.parse(await call(page, 'botSeam'));
  await page.waitForTimeout(1000);
  const later = JSON.parse(await call(page, 'botStatus'));
  console.log(JSON.stringify({ run: i, statusDead: st.dead_frames, latchDead: seam.seam['latch.dead_frames'], latchTick: seam.seam['latch.tick'], gameTime: st.game_time, laterDead: later.dead_frames, laterGameTime: later.game_time, polls }));
  await page.close();
}
await browser.close();
