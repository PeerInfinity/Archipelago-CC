// one-off: print every botStatus key at one tick
import { chromium } from '/home/user/Archipelago-CC/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { HEADLESS_LOGIC_ONLY_ARGS } from '/home/user/Archipelago-CC/scripts/procgen/headlessChromium.js';
const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { gameVisibleTape, parseTape } = await import(M+'tapeFormat.js');
const tape = parseTape(readFileSync(process.argv[2],'utf8')); const at=Number(process.argv[3]);
const b = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS }); const page = await b.newPage();
await page.goto(`http://localhost:9701/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html`);
while (!(await page.evaluate(()=>!!window.__runtimeReady))) await page.waitForTimeout(250);
await page.click('#btn-start');
while (!(await page.evaluate(()=>!!window.__swfBridge?.game?.botStatus))) await page.waitForTimeout(250);
const bot=(n,a)=>page.evaluate(([n,a])=>String(a===undefined?window.__swfBridge.game[n]():window.__swfBridge.game[n](a)),[n,a]);
console.log(await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))), await bot('botStart'));
for(;;){ const s=JSON.parse(await bot('botStatus')); if(s.tick>=at||s.finished){ for (const [k,v] of Object.entries(s)) console.log(k, JSON.stringify(v).slice(0,200)); break;} }
await b.close();
