// Scratch: replay a tape on the model (built-in map, or the delivered set with --delivered) and print its path summary.
import { readFileSync } from 'node:fs';
import { parseTape } from '../../../../frontend/modules/seedlingDemo/tapeFormat.js';
import { runTape } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { loadAtlas } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { patchedMapDocument } from '../../../../frontend/modules/seedlingDemo/seedlingSetPatches.js';
const f = process.argv[2];
const tape = parseTape(JSON.parse(readFileSync(f, 'utf8')));
const src = levelSourceFromAtlas(process.argv.includes('--delivered') ? patchedMapDocument(loadAtlas()) : loadAtlas());
try {
  const out = runTape(tape, { levelSource: src });
  const t = out.ticks;
  console.log('ticks', t.length, 'transitions', JSON.stringify(out.transitions.map((x) => [x.t, x.from_level ?? x.from, x.to_level, x.x ?? x.at?.x, x.y ?? x.at?.y])));
  const step = Math.max(1, Math.floor(t.length / 25));
  console.log(t.filter((_, i) => i % step === 0 || i === t.length - 1).map((o) => `${o.t}:L${o.level}(${Math.round(o.x)},${Math.round(o.y)})`).join(' '));
  console.log('inputs', JSON.stringify(tape.inputs).slice(0, 600));
} catch (e) { console.log('REFUSED', String(e.message).split('\n')[0].slice(0, 300)); }
