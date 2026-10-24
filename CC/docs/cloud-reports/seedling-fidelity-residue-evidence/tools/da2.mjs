const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(D+'levelSource.js');
const { createRunForStaging } = await import(D+'tapeRunner.js');
const { arrivalStaging } = await import(D+'fidelityArrival.js');
const { solveSegment, replayOntoFork } = await import(D+'solverBot.js');
const SRC = atlasLevelSource();
const CUT = { kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 }, obstacle: 'rope@160,64' };
const boot = process.argv[2]==='L25' ? { level: 28, x: 96, y: 16 } : { level: 28, x: 16, y: 96 };
const staging = arrivalStaging(boot, { items: ['hasFire'] });
const run = createRunForStaging(staging, SRC);
const out = solveSegment({ run, goals: [{ ...CUT }], name: 'da', boot, forkRun: () => createRunForStaging(staging, SRC) });
console.log('solved', out.perTick.length, 'equips', JSON.stringify(out.equips), 'state', run.state.x, run.state.y, 'hits', run.ledger('playerHits').length);
const ds = (r)=> (r.drills?.bodies ?? []).map(d=>`${d.id}@(${d.x},${d.y})${d.anim}`).join(' ');
console.log('drills', ds(run), 'cam', JSON.stringify(run.cameraNow));
// idle continuation
const K = [[],['right'],['left'],['up'],['down'],['right','up'],['right','down'],['left','up'],['left','down']];
const N = Number(process.argv[3]??3);
let best = null; let ok = 0; let tot=0;
const seqs = [[]]; for (let i=0;i<N;i++){ const n=[]; for (const s of seqs) for (let k=0;k<9;k++) n.push([...s,k]); seqs.splice(0,seqs.length,...n); }
for (const s of seqs) {
  const f = replayOntoFork(createRunForStaging(staging, SRC), out.perTick, out.equips ?? []);
  const h0 = f.ledger('playerHits').length;
  for (const k of s) f.advance(new Set(K[k]));
  for (let i=0;i<10;i++) f.advance(new Set(K[s.at(-1)]));
  tot++;
  if (f.ledger('playerHits').length===h0) { ok++; if(!best) best=s; }
}
console.log('seqs',tot,'hitfree for 13+ ticks', ok, best && best.map(k=>K[k].join('+')||'_'));
