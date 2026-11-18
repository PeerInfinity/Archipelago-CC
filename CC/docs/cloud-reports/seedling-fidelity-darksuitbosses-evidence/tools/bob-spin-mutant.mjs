import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { loadTape } from '../../../../../frontend/modules/seedlingDemo/fixtures/index.js';
import { heldKeysAt } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';
import { createRunForStaging, stagingFromTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
const tape = loadTape('r5-bobboss-fire');
withContactFidelity({ darkSuitBossRetaliation: true }, () => {
  const st = stagingFromTape(tape);
  const run = createRunForStaging({ ...st, noDamage: false, grants: [...tape.grants, { level: 32, items: ['darksuit', ...Array(6).fill('health')] }] }, atlasLevelSource());
  for (let t = 0; t < 1415; t++) { run.advance(t >= 1400 ? new Set(['up']) : heldKeysAt(tape, t));
    if (t >= 1411) { const b = run.entities('bobBoss').get('boss'); console.log(t + 1, JSON.stringify(b ? { spin: b.swordSpin.map((a) => +a.toFixed(4)), swords: b.swords, hits: b.hits } : null)); } }
});
