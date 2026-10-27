import { readFileSync } from 'node:fs';
const { l40LatchModelSamples } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/fidelityL40Latch.js');
const tape = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const live = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const m = await l40LatchModelSamples(tape, {});
// samples[o.t] is the observation BEFORE tick t's input? find alignment offset
for (const off of [0, 1, -1]) {
  let first = null;
  for (let t = 1; t < live.length; t += 1) { const g = m.samples[t + off]; if (!g || !live[t]) continue; if (Math.abs(g.x - live[t][0]) > 1e-9 || Math.abs(g.y - live[t][1]) > 1e-9) { first = t; break; } }
  console.log(`offset ${off}: first divergence at live t${first}`, first ? `live ${live[first]} model ${m.samples[first + off]?.x},${m.samples[first + off]?.y}` : '');
}
