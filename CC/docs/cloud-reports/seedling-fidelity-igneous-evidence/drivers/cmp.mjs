import { readFileSync } from 'node:fs';
const M=(process.env.WT ?? '/home/user/Archipelago-CC')+'/frontend/modules/seedlingDemo/';
const { createTapeStepper } = await import(M+'tapeRunner.js');
const { atlasLevelSource } = await import(M+'levelSource.js');
const [tapeP, outP] = process.argv.slice(2);
const game = {};
for (const l of readFileSync(outP,'utf8').split('\n')) { const m = l.match(/^t(\d+)\s.*?G p\(([-\d.]+),([-\d.]+)/); if (m) game[+m[1]] = [+m[2], +m[3]]; }
const tape = JSON.parse(readFileSync(tapeP,'utf8'));
let run=null; const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t,s,h,rn)=>{run=rn;} });
let r = st.next(), worst=0, first=null, n=0, err=null;
try { while(!r.done){ const o=r.value.observation; const g=game[o.t]; if (g) { n++; const d=Math.max(Math.abs(g[0]-o.x),Math.abs(g[1]-o.y)); if (d>1e-9 && first===null) first={t:o.t,g,m:[o.x,o.y]}; worst=Math.max(worst,d);} r=st.next(); } } catch(e){ err=e.message.slice(0,200); }
console.log(JSON.stringify({tape: tape.name, compared:n, worst, first, err, deaths: run?.playerDeaths?.map?.(d=>({t:d.t,source:d.source})) ?? null, igneous: run?.igneousEvents?.filter(e=>e.event!=='frame')}));
