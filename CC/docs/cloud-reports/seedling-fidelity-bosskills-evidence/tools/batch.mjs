// scratch: run several tapes on one page, record boss-family samples per tape
const { chromium } = await import('/home/user/Archipelago-CC/node_modules/playwright/index.mjs');
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(R + 'scripts/procgen/headlessChromium.js');
const { gameVisibleTape, parseTape } = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const files = process.argv.slice(2);
const URL = `http://localhost:${process.env.SEEDLING_PORT || 9702}/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const RX = /(LavaBoss|LavaBall|LavaRunner|TentacleBeast|Tentacle|Player)$/;
for (const f of files) {
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
await page.click('#btn-start');
for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
  const tape = parseTape(readFileSync(f, 'utf8'));
  const bot = (n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
  const l = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))); if (l !== 'ok') { console.log(f, 'load', l); continue; }
  const s0 = await bot('botStart'); if (s0 !== 'ok') { console.log(f, 'start', s0); continue; }
  const by = new Map(); let fin = null; const t0 = Date.now();
  while (Date.now() - t0 < 600000) {
    const raw = await page.evaluate(() => [String(window.__swfBridge.game.botMobiles()), String(window.__swfBridge.game.botStatus())]);
    const m = JSON.parse(raw[0]), s = JSON.parse(raw[1]);
    const t = m.tick ?? s.tick;
    if (!by.has(t)) by.set(t, { t, level: s.level, hits: s.hits, cleared: s.persistence_cleared, rng: s.rng, x: s.x, y: s.y,
      rows: (m.mobiles || []).filter(r => RX.test(r.cls)).map(r => ({ c: r.cls.replace(/^.*::/, ''), x: r.x, y: r.y, vx: r.vx, vy: r.vy, a: r.anim, i: r.anim_index, al: r.alpha, d: r.destroy, col: r.collidable, ty: r.type, e: r.enemy && { h: r.enemy.hits, ht: r.enemy.hits_timer, ch: r.enemy.can_hit, dk: r.enemy.hit_by_dark_stuff } })) });
    if (s.finished) { fin = s; break; }
  }
  const out = f.replace(/\.json$/, '.out.json');
  writeFileSync(out, JSON.stringify({ status: fin, samples: [...by.values()].sort((a, b) => a.t - b.t) }));
  await page.close();
  console.log(f, 'samples', by.size, 'end level', fin?.level, 'hits', fin?.hits, 'secs', ((Date.now() - t0) / 1000).toFixed(0));
}
await browser.close();
