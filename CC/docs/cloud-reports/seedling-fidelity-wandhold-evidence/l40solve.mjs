// scratch: solve L40 part 64,144 from a boot with the default switches (+ env SEEDLING_CONTACT_FIDELITY etc.)
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
const { l40buttonStaging, L40BUTTON_GOAL } = await import(join(REPO, 'scripts/procgen/plan-seedling-l40button-witness.mjs'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
const { CONTACT_FIDELITY } = await import(join(MODULE, 'contactFidelity.js'));
const [bx, by] = (process.argv[2] ?? '928,96').split(',').map(Number);
for (const kv of (process.argv[3] ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); CONTACT_FIDELITY[k] = v !== 'false'; }
const staging = await l40buttonStaging({ level: 40, x: bx, y: by });
const levelSource = atlasLevelSource();
const t0 = Date.now();
try {
  const solved = await twoPassSolve({
    makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
    goals: [L40BUTTON_GOAL], name: 'wh', boot: staging.boot, dashMode: 'all',
    persistence: staging.persistence, log: () => {},
  });
  console.log('SOLVED', solved.out.perTick.length, JSON.stringify(solved.out.records.map((r) => r.strategy)), Math.round((Date.now()-t0)/1000), 's');
} catch (e) {
  console.log('THREW', e.constructor.name, Math.round((Date.now()-t0)/1000), 's', String(e.message).slice(0, 1500));
}
