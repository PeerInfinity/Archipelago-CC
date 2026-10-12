const caps = [];
globalThis.__C4 = (r) => { if (r.at === 'chaserArm') caps.push(r); };
const origLog = console.log; let out = null; console.log = (s) => { out = s; };
await import('./leg.mjs');
console.log = origLog;
const byT = {};
for (const c of caps) { const k = `${c.target} ${c.c.x},${c.c.y}`; byT[k] = c; }
for (const [k, c] of Object.entries(byT)) {
  const presses = c.samples.filter((s) => (s[5] ?? '').includes('primary')).map((s) => s[0]);
  origLog(k, 'danger', JSON.stringify(c.danger), 'death', c.deathTick, 'presses', presses.join(','));
}
origLog(JSON.parse(out).ok, (JSON.parse(out).message ?? '').slice(0, 200));
