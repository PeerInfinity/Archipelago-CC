import { readFileSync } from 'node:fs';
const M=(process.env.WT ?? '/home/user/Archipelago-CC')+'/frontend/modules/seedlingDemo/';
const { createTapeStepper } = await import(M+'tapeRunner.js');
const { atlasLevelSource } = await import(M+'levelSource.js');
const tape = JSON.parse(readFileSync(process.argv[2],'utf8'));
const cx = Number(process.argv[3]??40), cy = Number(process.argv[4]??88);
const R = Math.sqrt(512)/2;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource() });
let r = st.next(); const rows=[];
try { while(!r.done){ const o=r.value.observation; const d=Math.hypot(o.x-cx,o.y-cy); rows.push(`t${o.t} (${o.x.toFixed(2)},${o.y.toFixed(2)}) d=${d.toFixed(2)} ${d<=R?'IN':''}`); r=st.next(); } } catch(e){ rows.push('ERR '+e.message.slice(0,300)); }
console.log(rows.join('\n'));
