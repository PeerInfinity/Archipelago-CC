// scratch (L40-CENSUS): the cells within 2 of bosslock@480,352 on the 16 px lattice, whether a box pinned under the lock touches its key line, and what the planner says is there (solverPlanOpts, nodeMargin 0). Usage: node keyline.mjs <capture.jsonl> <id>
const R='/home/user/Archipelago-CC/';const M=R+'frontend/modules/seedlingDemo/';
const {restoreRequest}=await import(R+"scripts/procgen/seedlingSolveRequestCodec.js");
const {levelSourceFromAtlas}=await import(M+'atlasSource.js');
const {replayTape}=await import(M+'jsRuntimeSolver.js');
const {keyLineTouches}=await import(M+'activators.js');
const {nodeCentre,nodeAt,plannerObstacleAt}=await import(M+'botDriverV2.js');
const {playerBoxAt}=await import(M+'playerPhysicsV2.js');
const SB=await import(M+'solverBot.js');
const fs=await import("fs");
for(const l of fs.readFileSync(process.argv[2],"utf8").trim().split("\n")){const r=JSON.parse(l);if(String(r.id)!==process.argv[3])continue;const q=restoreRequest(r.requests[0].request);
const run=replayTape({staging:q.staging,perTick:[],levelSource:levelSourceFromAtlas(q.source.records)});
const row=run.world.activators.find(a=>a.id==='bosslock@480,352');
const opts=SB.solverPlanOpts(run,new Set(),{nodeMargin:0,triggerMargin:0});
const cell=nodeAt((row.rect.x+row.rect.right)/2,(row.rect.y+row.rect.bottom)/2,16);
for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){if(!dx&&!dy)continue;const c=nodeCentre(cell.tx+dx,cell.ty+dy,16);
 let ob; try{ob=plannerObstacleAt(run.world,c.x,c.y,null,opts)}catch(e){ob='ERR '+e.message}
 // pinned from below: box flush against lock bottom
 const touchBelow = c.y>row.rect.bottom ? keyLineTouches(playerBoxAt(c.x, row.rect.bottom + (c.y - c.y) ), row.keyLine) : null;
 const pinned={x:c.x,y:Math.min(c.y,row.rect.bottom+9)}; console.log(c.x,c.y,'touch',keyLineTouches(playerBoxAt(c.x,row.rect.bottom+0),row.keyLine),'obstacle',JSON.stringify(ob)?.slice(0,160));}
}
