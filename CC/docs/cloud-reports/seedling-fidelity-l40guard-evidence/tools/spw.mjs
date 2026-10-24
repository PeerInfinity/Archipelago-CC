import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging, solveStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const { parseTape } = await import(R+'tapeFormat.js');
const v = JSON.parse(readFileSync(R+'fixtures/hammer-lb-hx/boot-414.json','utf8'));
const [bx,by]=process.argv[2].split(',').map(Number); v.boot={level:40,x:bx,y:by}; v.seam.items.hasGhostSword=false;
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(v)))), atlasLevelSource());
let minY={};
for (let t=0;t<Number(process.argv[3]);t++){ run.advance(new Set()); for (const s of run.entities('spinnerBodies')) { const r=s.rect??{x:s.x,y:s.y}; if (!minY[s.id]||r.y<minY[s.id].y) minY[s.id]={t:run.ticksCompleted,x:+r.x.toFixed(1),y:+r.y.toFixed(1)}; } }
console.log(JSON.stringify(minY)); console.log('hits', run.ledger('playerHits').length);
console.log('moots', run.shakeBandMoots?.length, JSON.stringify(run.shakeBandMoots?.slice(0,6)), 'hitsAt', run.ledger('playerHits').map(h=>h.t+':'+h.id).join(' '));
