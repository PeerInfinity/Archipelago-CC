import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { withStrikeEtaFloor } from '../../../../../frontend/modules/seedlingDemo/solverBot.js';
import { createRunForStaging } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { twoPassSolve } from '../../../../../frontend/modules/seedlingDemo/twoPassSolve.js';
const { l40buttonStaging, L40BUTTON_GOAL } = await import('../../../../../scripts/procgen/plan-seedling-l40button-witness.mjs');
const on = process.argv[2] === '1';
const boot = { level: 40, x: 848, y: 16 };
const staging = await l40buttonStaging(boot);
const levelSource = atlasLevelSource();
const t0 = Date.now();
try {
  const solved = await withStrikeEtaFloor(false, () => withContactFidelity({ movingWait: true, bombBlastBody: true, fineSwingStance: on }, () => twoPassSolve({
    makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
    goals: [L40BUTTON_GOAL], name: 'wandhold', boot: staging.boot, dashMode: 'all', persistence: staging.persistence, log: () => {},
  })));
  console.log('SOLVED', solved.out.perTick.length, JSON.stringify(solved.out.records.map((r) => [r.strategy, r.target ?? r.id, r.stance])));
} catch (e) { console.log('THREW', e.constructor.name, e.message.slice(0, 1500)); }
console.log('secs', (Date.now() - t0) / 1000);
