import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging, solveStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const { parseTape } = await import(R+'tapeFormat.js');
const v = JSON.parse(readFileSync(R+'fixtures/hammer-lb-hx/boot-414.json','utf8'));
v.boot={level:40,x:720,y:672}; v.seam.items.hasGhostSword=false;
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(v)))), atlasLevelSource());
const P=Number(process.argv[2]), T=Number(process.argv[3]);
try { for (let t=0;t<T;t++){ run.advance(new Set(t===P?['primary']:['down'])); } console.log('done', run.ticksCompleted); }
catch(e){ console.log('THREW at', run.ticksCompleted, e.message.slice(0,400)); }
const sp=run.entities('spinnerBodies').find(s=>s.id==='spinner@816,848'); console.log('spinner', JSON.stringify({hits:sp?.hits,hitsTimer:sp?.hitsTimer}));
console.log('pressHits', JSON.stringify((run.spinnerPressHits??[]).slice(-6)));
