// MEASUREMENT-ONLY: per tick, player + one chaser (by id) in the run vs the dumped preview (sample t+OFF).
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const { runTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeRunner.js`);
const { parseTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeFormat.js`);
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const prev = JSON.parse(readFileSync(process.argv[3], 'utf8')).prev;
const byT = new Map(prev.samples.map((s) => [s.t, s]));
const OFF = Number(process.env.OFF ?? 1);
let lastHits = 0; let id = null;
runTape(tape, { levelSource: atlasLevelSource(), onTick: (t, st, held, run) => {
  if (t < 1883 || t > 1935) return;
  const all = run.entities('chasers') ?? [];
  if (id === null) id = all.find((c) => Math.abs(c.x - 228) < 1 && Math.abs(c.y - 124.8) < 1)?.id;
  const c = all.find((x) => x.id === id);
  const p = byT.get(t + OFF); const pc = p?.ch.find((x) => x.id === id);
  const h = (run.ledger('playerHits') ?? []).length;
  console.log('T', t, (held && [...held].join('+')) || '-', 'run P', st.x.toFixed(2), st.y.toFixed(2), 'C', c ? `${c.x.toFixed(2)},${c.y.toFixed(2)}` : 'gone',
    '| prev P', p ? `${p.x.toFixed(2)},${p.y.toFixed(2)}` : '-', 'C', pc ? `${pc.x.toFixed(2)},${pc.y.toFixed(2)}` : '-', h > lastHits ? 'HIT' : '', t === 1883 ? id : '');
  lastHits = h;
} });
