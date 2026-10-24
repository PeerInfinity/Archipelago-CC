import { readFileSync } from 'node:fs';
const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M+'levelSource.js');
const { twoPassSolve } = await import(M+'twoPassSolve.js');
const { createRunForStaging } = await import(M+'tapeRunner.js');
const { CONTACT_FIDELITY } = await import(M+'contactFidelity.js');
const staging = JSON.parse(readFileSync('/home/user/Archipelago-CC/.cache/seedling-survey/through-end/views/step-93-boot.json','utf8'));
for (const kv of (process.argv[2] ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); CONTACT_FIDELITY[k] = v !== 'false'; }
const goals = [{ kind: 'collect-placement', placement: { x: 64, y: 144 }, why: 'L40 part', location: 'Level 040 - Totem Part 64,144' }];
const levelSource = atlasLevelSource();
const t0 = Date.now();
const logs=[];
try {
  const solved = await twoPassSolve({
    makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
    goals, name: 's93', boot: staging.boot, dashMode: 'all',
    persistence: staging.persistence, log: (m) => logs.push(String(m)),
  });
  console.log('SOLVED', solved.out.perTick.length, JSON.stringify(solved.out.records.map((r) => [r.strategy, r.target?.id ?? r.target ?? r.obstacle?.id])), Math.round((Date.now()-t0)/1000), 's');
  globalThis.solved = solved;
} catch (e) {
  console.log('THREW', e.constructor.name, Math.round((Date.now()-t0)/1000), 's', String(e.message).slice(0, 3000));
  console.log(Object.keys(e)); for (const k of Object.keys(e)) console.log(k, (k==="rows"?JSON.stringify(e[k],null,1):JSON.stringify(e[k])?.slice(0,300)));
}
if (process.env.LOGS) console.log(logs.join('\n').slice(0, 20000));
