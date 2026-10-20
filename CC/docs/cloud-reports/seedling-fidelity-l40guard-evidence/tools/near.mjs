import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging, solveStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const { parseTape } = await import(R+'tapeFormat.js');
const { slashRect, distanceRectPoint } = await import(R+'combatVerbs.js');
const v = JSON.parse(readFileSync(R+'fixtures/hammer-lb-hx/boot-414.json','utf8'));
v.boot={level:40,x:720,y:672}; v.seam.items.hasGhostSword=false;
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(v)))), atlasLevelSource());
const ov=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
for (let t=0;t<Number(process.argv[2]);t++){ run.advance(new Set(['down']));
  const sr=slashRect(run.state.x, run.state.y, 3);
  for (const s of run.entities('spinnerBodies')) { const r=s.rect; if (ov(sr,r) && distanceRectPoint(run.state.x,run.state.y,r)<=16) console.log(run.ticksCompleted, s.id, JSON.stringify(r), 'P', run.state.x.toFixed(2), run.state.y.toFixed(2)); }
}
console.log('hits', run.ledger('playerHits').map(h=>h.t+':'+h.id).join(' '));
