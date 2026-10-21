// one-off: dump raw class names + statuses for frames around a tick window
import { chromium } from '/home/user/Archipelago-CC/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { HEADLESS_LOGIC_ONLY_ARGS } from '/home/user/Archipelago-CC/scripts/procgen/headlessChromium.js';
const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { gameVisibleTape, parseTape } = await import(M+'tapeFormat.js');
const tape = parseTape(readFileSync(process.argv[2],'utf8'));
const [lo,hi]=process.argv[3].split('-').map(Number);
const b = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS }); const page = await b.newPage();
await page.goto(`http://localhost:9701/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html`);
while (!(await page.evaluate(()=>!!window.__runtimeReady))) await page.waitForTimeout(250);
await page.click('#btn-start');
while (!(await page.evaluate(()=>!!window.__swfBridge?.game?.botStatus))) await page.waitForTimeout(250);
const bot=(n,a)=>page.evaluate(([n,a])=>String(a===undefined?window.__swfBridge.game[n]():window.__swfBridge.game[n](a)),[n,a]);
console.log(await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))), await bot('botStart'));
for(;;){ const [m,s]=(await page.evaluate(()=>[String(window.__swfBridge.game.botMobiles()),String(window.__swfBridge.game.botStatus())])).map(JSON.parse);
 const t=m.tick??s.tick; if(t>=lo&&t<=hi) console.log(t, s.dead_frames, JSON.stringify((m.mobiles||[]).filter(r=>/Player|NPC/.test(r.cls)).map(r=>[r.anim,r.frame,r.collidable,r.visible,r.type])), s.primary, JSON.stringify(s.inventory_slots), (m.mobiles||[]).map(r=>r.cls.split(':').pop()+'@'+r.x.toFixed(1)+','+r.y.toFixed(1)).join(' '), Object.keys(s).filter(k=>/talk|freeze|frozen|text/i.test(k)).map(k=>k+'='+JSON.stringify(s[k])).join(' '));
 if(s.finished||t>hi) break; }
await b.close();
