// SCRATCH (g1): replay a g1-solve tape and report the first tick whose position differs from the solve's trail.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { staging, perTick } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const trail = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const run = createRunForStaging(staging, atlasLevelSource());
for (let t = 0; t < perTick.length; t += 1) {
  run.advance(new Set(perTick[t]));
  const [c, x, y] = trail[t];
  if (Math.abs(x - run.state.x) > 1e-9 || Math.abs(y - run.state.y) > 1e-9) {
    console.log('first divergence at index', t, 'clock', c, 'solve', x, y, 'replay', run.state.x, run.state.y, 'keys', perTick[t - 1], perTick[t], perTick[t + 1]);
    console.log('primary', run.progress('primaryWeapon'), 'equips', JSON.stringify(staging.equips));
    break;
  }
}
