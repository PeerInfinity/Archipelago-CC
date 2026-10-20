// build a staged tape from boot-414's view with a moved boot and a key script "a-b:k1+k2,..."
import { readFileSync, writeFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { buildStagedTape } = await import(R+'botDriverV1.js');
const { parseTape } = await import(R+'tapeFormat.js');
const { stagingFromTape } = await import(R+'tapeRunner.js');
const arg=(n,f)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??f;
const v = JSON.parse(readFileSync(R+'fixtures/hammer-lb-hx/boot-414.json','utf8'));
const [bx,by]=arg('boot').split(',').map(Number); v.boot={level:40,x:bx,y:by};
if (arg('ghost','0')!=='1') v.seam.items.hasGhostSword=false;
const T=Number(arg('ticks'));
const plan=Array.from({length:T},()=>new Set());
for (const seg of arg('keys','').split(',').filter(Boolean)) { const [rg,k]=seg.split(':'); const [a,b]=rg.split('-').map(Number); for(let t=a;t<=b&&t<T;t++) plan[t]=new Set(k?k.split('+'):[]); }
const staging = stagingFromTape(parseTape(JSON.stringify(v)));
const built = buildStagedTape({ staging, perTick: plan, name: arg('name') });
built.description = arg('desc','scratch l40guard witness');
writeFileSync(arg('out'), JSON.stringify(built,null,1)+'\n'); console.log('wrote', arg('out'), T);
