// MEASUREMENT-ONLY: run a staged-tape view with onTick and print each player hit (tick, source, position).
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const { runTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeRunner.js`);
const { parseTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeFormat.js`);
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
let last = 0; const pos = [];
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const out = runTape(tape, { levelSource: atlasLevelSource(), onTick: (t, st, held, run) => {
  pos.push([t, st.x, st.y, [...(held ?? [])].join('+')]);
  const h = run?.playerHits ?? run?.ledger?.('playerHits') ?? [];
  if (h.length > last) { for (const x of h.slice(last)) console.log('HIT', t, JSON.stringify(x).slice(0, 300), 'at', st.x.toFixed(1), st.y.toFixed(1)); last = h.length; }
} });
console.log('ticks', out.ticks.length, 'final', out.final.level, out.final.x?.toFixed(1), out.final.y?.toFixed(1));
const want = (process.env.WIN ?? '').split(',').map(Number);
if (want.length === 2) for (const p of pos) if (p[0] >= want[0] && p[0] <= want[1]) console.log('POS', p[0], p[1].toFixed(1), p[2].toFixed(1), p[3]);
