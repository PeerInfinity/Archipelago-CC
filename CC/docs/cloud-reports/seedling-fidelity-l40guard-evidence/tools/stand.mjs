// model: boot the player at --boot, press --keys (per tick list "k1+k2" or "" ) for --ticks, trace bobsoldier + player
import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging, solveStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const { parseTape } = await import(R+'tapeFormat.js');
const arg=(n,f)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??f;
const v = JSON.parse(readFileSync(R+'fixtures/hammer-lb-hx/boot-414.json','utf8'));
const [bx,by]=arg('boot','824,856').split(',').map(Number); v.boot={level:40,x:bx,y:by};
if (arg('ghost','0')!=='1') v.seam.items.hasGhostSword=false;
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(v))));
const run = createRunForStaging(staging, atlasLevelSource());
const T=Number(arg('ticks','200'));
const script = arg('keys','');  // "0-40:right,41-60:"  ranges
const plan=[]; for (const seg of script.split(',').filter(Boolean)) { const [rg,k]=seg.split(':'); const [a,b]=rg.split('-').map(Number); for(let t=a;t<=b;t++) plan[t]=k?k.split('+'):[]; }
const every=Number(arg('every','5'));
for (let t=0;t<T;t++){
  const keys=new Set(plan[t]??[]);
  run.advance(keys);
  const g=(run.entities('chasers')??[]).find(c=>c.tag==='bobsoldier');
  const h=run.ledger('playerHits').length; const sp=(run.entities('spinnerBodies')??[]).filter(s=>s.y>800).map(s=>`${s.id.split('@')[1]}:${(s.x??s.rect?.x)?.toFixed?.(1)},${(s.y??s.rect?.y)?.toFixed?.(1)}`).join(' ');
  if (t%every===0 || t===T-1) console.log(t+1, 'P', run.state.x.toFixed(2), run.state.y.toFixed(2), 'G', g? `${g.x.toFixed(2)},${g.y.toFixed(2)} v=${(g.vx??0).toFixed(3)},${(g.vy??0).toFixed(3)} hits=${g.hits}/${g.hitsTimer} spin=${JSON.stringify([g.swordSpinning, +(g.swordSpin?.[0]??NaN).toFixed(3), g.swordSpinResetTimer])} d=${Math.hypot(g.x-run.state.x,g.y-run.state.y).toFixed(1)}`:'GONE', 'pHits', h, 'S', sp, [...keys].join('+'));
}
console.log('hits', run.ledger('playerHits').map(x=>`${x.t}:${x.source}:${x.id}`).join(' '));
console.log('keysOf chaser', Object.keys((run.entities('chasers')??[]).find(c=>c.tag==='bobsoldier')??{}).join(' '));
