// fidelity REMBODY: the four SKINSWING tapes, removedBodyBlocks OFF vs ON. Usage: node witness-arms.mjs <name>…
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withContactFidelity } from '../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { SKINSWING_WITNESS_DIR, compareSkinSwing, skinSwingModelSamples } from '../../../../frontend/modules/seedlingDemo/fidelitySkinSwing.js';
const names = process.argv.slice(2);
for (const name of names) {
  const rec = JSON.parse(readFileSync(join(SKINSWING_WITNESS_DIR, `${name}.json`), 'utf8'));
  for (const [lab, arm] of [['OFF', { removedBodyBlocks: false }], ['ON', { removedBodyBlocks: true }]]) {
    const m = await skinSwingModelSamples(rec.tape, arm);
    const bad = compareSkinSwing(rec.samples, m.samples);
    console.log(name, lab, 'err', m.error, 'samples', rec.samples.length, m.samples.length, 'diverge', bad.length, bad[0] ?? '');
  }
}
