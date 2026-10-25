const R = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const m = await import(R + 'beamTower.js');
for (const attrs of [{ direction: '0', rate: '2', speed: '0.5' }, { direction: '2', rate: '2', speed: '0.5' }, { direction: '0', rate: '1', speed: '1' }]) {
  let s = m.createBeamTower({ cx: 208, cy: 120, attrs }, { width: 320, height: 240 });
  const seq = [];
  for (let t = 1; t <= 400; t++) { const fired = m.stepBeamTower(s, null); seq.push((fired ? "B" : ".") + s.direction); if (0) seq.push((m.beamIsBeaming(s) ? 'B' : '.') + s.direction); }
  let per = null;
  for (let p = 1; p <= 200 && per === null; p++) { let ok = true; for (let i = 100; i < 300; i++) if (seq[i] !== seq[i + p]) { ok = false; break; } if (ok) per = p; }
  console.log(JSON.stringify(attrs), 'period', per, seq.slice(100, 100 + (per ?? 50)).map((x) => x[0]).join(''));
}
