import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
const { l40buttonStaging } = await import(join(REPO, 'scripts/procgen/plan-seedling-l40button-witness.mjs'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
const { CONTACT_FIDELITY } = await import(join(MODULE, 'contactFidelity.js'));
const [bx, by] = (process.argv[2] ?? '144,608').split(',').map(Number);
for (const kv of (process.argv[3] ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); CONTACT_FIDELITY[k] = v !== 'false'; }
const staging = await l40buttonStaging({ level: 39, x: bx, y: by });
staging.persistence = [...(staging.persistence ?? []), { level: 39, tag: 8 }];
console.log('persistence', JSON.stringify(staging.persistence), 'items', JSON.stringify(staging.seam.items));
const levelSource = atlasLevelSource();
const t0 = Date.now();
try {
  const solved = await twoPassSolve({
    makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
    goals: [{ kind: 'collect-placement', placement: { x: 72, y: 40 } }], name: 'wh39', boot: staging.boot, dashMode: 'all',
    persistence: staging.persistence, log: () => {},
  });
  console.log('SOLVED', solved.out.perTick.length, JSON.stringify(solved.out.records.map((r) => r.strategy)), Math.round((Date.now()-t0)/1000), 's');
} catch (e) {
  console.log('THREW', e.constructor.name, Math.round((Date.now()-t0)/1000), 's', String(e.message).slice(0, 2500));
}
