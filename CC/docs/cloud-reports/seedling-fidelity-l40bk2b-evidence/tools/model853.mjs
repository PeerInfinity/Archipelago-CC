import { readFileSync } from 'node:fs';
const { l40LatchModelSamples } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/fidelityL40Latch.js');
const tape = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const m = await l40LatchModelSamples(tape, {});
console.log('error', m.error, 'samples', m.samples.filter(Boolean).length, 'hits', JSON.stringify(m.hits));
const sol = (g) => (g.bodies ?? []).some((b) => b.cls === 'BobSoldier' && b.x > 800 && b.y > 700);
const gone = m.samples.findIndex((g) => g && !sol(g));
console.log('bobsoldier gone from t', gone);
for (const t of [0, 200, 400, 600, 800, 900, 1000, 1100, 1200, 1275, 1300, m.samples.length - 1]) { const g = m.samples[t]; if (g) console.log(t, g.level, g.x.toFixed(1), g.y.toFixed(1), 'bodies', g.bodies.filter((b) => Math.abs(b.x - g.x) < 120 && Math.abs(b.y - g.y) < 120).map((b) => `${b.cls}(${b.x.toFixed(0)},${b.y.toFixed(0)})`).join(' ')); }
