import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [boot, x0, y0, x1, y1] = process.argv.slice(2);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const w = run.world;
const inb = (o) => o.x >= +x0 && o.x <= +x1 && o.y >= +y0 && o.y <= +y1;
for (const k of Object.keys(w)) {
  const v = w[k];
  if (!Array.isArray(v)) continue;
  const hits = v.filter((o) => o && typeof o.x === 'number' && inb(o));
  if (hits.length) console.log(k, hits.map((o) => `${o.id ?? o.tag}@${o.x},${o.y}${o.t!==undefined?` t${o.t}`:''}${o.room!==undefined?` room${o.room}`:''}`).join(' | '));
}
for (const k of ['chasers','spinnerBodies','bobSoldiers','trees','chests']) { try { const e = run.entities(k); const arr = e?.values ? [...e.values()] : e; if (arr) console.log('E', k, arr.filter((o)=>inb(o)).map((o)=>`${o.id}(${o.x},${o.y})`).join(' ')); } catch (err) { console.log('E', k, 'ERR', err.message.slice(0,80)); } }
console.log('state', run.state.x, run.state.y, 'level', run.level);
