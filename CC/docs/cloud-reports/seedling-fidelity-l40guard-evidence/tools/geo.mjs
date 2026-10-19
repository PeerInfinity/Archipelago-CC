import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging, solveStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const { parseTape } = await import(R+'tapeFormat.js');
const v = JSON.parse(readFileSync(R+'fixtures/hammer-lb-hx/boot-414.json','utf8'));
if (process.argv[2]) { const [x,y]=process.argv[2].split(',').map(Number); v.boot={level:40,x,y}; }
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(v))));
const run = createRunForStaging(staging, atlasLevelSource());
console.log('state', run.state.x, run.state.y);
console.log('chasers', (run.entities('chasers')??[]).map(c=>`${c.id}@(${c.x},${c.y}) tag=${c.tag}`).join(' | '));
console.log('spinners', (run.entities('spinnerBodies')??[]).map(c=>c.id).join(' '));
const w = run.world;
console.log(Object.keys(w).slice(0,40).join(' '));
console.log('tiles type', typeof w.tiles, Array.isArray(w.tiles), w.width, w.height, w.walkableTiles?.constructor?.name);
const solids = w.solids; console.log('solids', solids?.length, JSON.stringify(solids?.[0]));
// grid 16px cells from x 720..1000, y 720..900
const isSolidAt=(x,y)=> (solids??[]).some(s=>{const r=s.rect; return x>=r.x && x<r.right && y>=r.y && y<r.bottom;});
for (let y=640;y<=928;y+=8){ let s=(''+y).padStart(4)+' '; for(let x=640;x<=1000;x+=8){ let c=isSolidAt(x+4,y+4)?'#':'.'; if (Math.abs(x+4-888)<4&&Math.abs(y+4-840)<4) c='G'; if (Math.abs(x+4-880)<5&&Math.abs(y+4-816)<5) c='C'; s+=c;} console.log(s);}
console.log('chests', JSON.stringify(w.chests), 'apItems', JSON.stringify(w.apItems?.slice?.(0,5)));
