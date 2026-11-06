// scratch: ROCK-GONE witness — L40, stand east of breakablerock@176,128 holding left, swing; when does the cell open?
// usage: node rockwit.mjs <variant> [--game]
import { join } from 'node:path';
const R = '/home/user/Archipelago-CC'; const M = R + '/frontend/modules/seedlingDemo';
const { buildTape } = await import(M + '/botDriverV1.js');
const { l40PocketBoot } = await import(M + '/fidelityTurretCircle.js');
const { parseTape, gameVisibleTape } = await import(M + '/tapeFormat.js');
const { createTapeStepper } = await import(M + '/tapeRunner.js');
const { atlasLevelSource } = await import(M + '/levelSource.js');
const variant = process.argv[2] ?? 'plain';
const boot = { level: 40, x: Number(process.env.BX ?? 192), y: Number(process.env.BY ?? 128) };
const VAR = {
  plain: { presses: [10], n: 40 },
  dash: { presses: [10, 20], n: 50 },
};
const v = VAR[variant];
const perTick = [];
for (let t = 0; t < v.n; t += 1) { const h = new Set(['left']); if (v.presses.includes(t)) h.add('primary'); perTick.push(h); }
const base = await l40PocketBoot({}, `rockwit-${variant}`);
const folded = buildTape(perTick, boot, base.name, { noclip: false, noDamage: process.env.ND === '1', noHazards: [], grants: [] });
const tapeJson = { ...base, noDamage: process.env.ND === '1', boot, tick_count: perTick.length, inputs: folded.inputs };
const tape = parseTape(JSON.stringify(tapeJson));
let run = null; const model = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let err = null;
try { let r = st.next(); while (!r.done) { const o = r.value.observation; model[o.t] = { x: o.x, y: o.y, hits: run ? run.damage.hits : 0, rocks: run ? run.rocksBroken.map((k) => `${k.id}:${k.hitTick}/${k.goneAt}`).join(' ') : '' }; r = st.next(); } } catch (e) { err = e.message; }
console.log('model err', err);
let game = [];
if (process.argv.includes('--game')) {
  const pw = (await import(R + '/node_modules/playwright/index.js')).default;
  const { HEADLESS_LOGIC_ONLY_ARGS } = await import(R + '/scripts/procgen/headlessChromium.js');
  const browser = await pw.chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:9776/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html`, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
    await page.click('#btn-start');
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
    const bot = (n, a) => page.evaluate(([name, x]) => { const g = window.__swfBridge.game; return String(x === undefined ? g[name]() : g[name](x)); }, [n, a]);
    console.log('load', await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))), 'start', await bot('botStart'));
    const byTick = new Map(); const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botStatus()), String(g.botMobiles())]; });
      const s = JSON.parse(raw[0]); const m = JSON.parse(raw[1]);
      if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, { x: s.x, y: s.y, hits: s.hits, slash: JSON.stringify(s.slash) });
      if (s.finished) break;
    }
    game = [];
    for (const [t, g] of byTick) game[t] = g;
  } finally { await browser.close(); }
}
for (let t = 0; t < v.n; t += 1) {
  const m = model[t] ?? {}; const g = game[t];
  const dx = g ? (g.x - m.x).toFixed(3) : '';
  console.log(t, 'M', m.x?.toFixed(3), m.y?.toFixed(3), m.hits, g ? `G ${g.x.toFixed(3)} ${g.y.toFixed(3)} ${g.hits} d ${dx} ${g.slash}` : '', t % 5 === 0 || (m.rocks && !model[t - 1]?.rocks) ? m.rocks : '');
}
