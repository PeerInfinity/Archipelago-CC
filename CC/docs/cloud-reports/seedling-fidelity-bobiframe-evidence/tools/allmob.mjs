// scratch (BOBIFRAME D0): play a tape on the game; dump EVERY botMobiles row + botStatus per poll to --out (jsonl).
import { createRequire } from 'node:module'; const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('playwright');
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(ROOT + '/scripts/procgen/headlessChromium.js');
const { takeBoxLockOrExit } = await import(ROOT + '/scripts/procgen/boxLock.js');
const { assertLogicOnlyChannel } = await import(ROOT + '/scripts/procgen/seedlingChannel.js');
const { gameVisibleTape, parseTape } = await import(ROOT + '/frontend/modules/seedlingDemo/tapeFormat.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const tape = parseTape(readFileSync(args.file, 'utf8'));
takeBoxLockOrExit({ name: 'bobiframe-allmob (scratch)', kind: 'browser' });
const URL = `http://localhost:${process.env.SEEDLING_PORT || '9781'}/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
writeFileSync(args.out, '');
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
  await page.click('#btn-start');
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
  await assertLogicOnlyChannel(page);
  const bot = (n, a) => page.evaluate(([name, x]) => { const g = window.__swfBridge.game; return String(x === undefined ? g[name]() : g[name](x)); }, [n, a]);
  { const M = ROOT + '/frontend/modules/seedlingDemo';
    const { vanillaRecordSet } = await import(M + '/levelSetExporter.js');
    const { planLevelSetChunks } = await import(M + '/levelSetValidator.js');
    const RJ = (rel) => JSON.parse(readFileSync(ROOT + '/' + rel, 'utf8'));
    const set = args.set ? JSON.parse(readFileSync(args.set, 'utf8')).deliveredSet : vanillaRecordSet(RJ('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), RJ('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
    const answers = []; for (const c of planLevelSetChunks(set).chunks) answers.push(await bot('botLoadLevels', JSON.stringify(c)));
    console.log('delivered', set.set_id, answers.at(-1), (await bot('botLevelSet')).slice(0, 200)); }
  console.log('load', await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))), 'start', await bot('botStart'));
  const from = Number(args.from ?? 0), to = Number(args.to ?? 1e9);
  const deadline = Date.now() + 600000; let n = 0;
  while (Date.now() < deadline) {
    const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botMobiles()), String(g.botStatus())]; });
    const m = JSON.parse(raw[0]); const s = JSON.parse(raw[1]);
    const t = m.tick ?? s.tick;
    if (t >= from && t <= to) { appendFileSync(args.out, JSON.stringify({ t, st: { tick: s.tick, hits: s.hits, hits_timer: s.hits_timer, camera: s.camera, slash: s.slash, x: s.x, y: s.y, game_time: s.game_time }, m: m.mobiles.filter((r) => /Player|Bob|Spinner/.test(r.cls)) }) + '\n'); n += 1; }
    if (s.finished || t > to) break;
  }
  console.log('rows', n);
} finally { await browser.close(); }
