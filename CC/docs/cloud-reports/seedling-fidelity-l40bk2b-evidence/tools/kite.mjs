await import('/tmp/claude-0/tools/fork853.mjs');
const sb = globalThis.__sb; const at = globalThis.__at;
const SD = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { chooseHeld } = await import(SD + 'botDriverV1.js');
const id = 'bobsoldier@880,832';
// phase 1: the cw orbit's own first N ticks (it walks down the shaft and east along the corridor)
const N = Number(process.env.N ?? 85);
const pre = []; { const r = at(); const st = sb.strikePolicyFor(r, { dashMode: 'all' }); for (let i = 0; i < N; i += 1) { const h = sb.orbitKillPolicy(r, id, sb.ORBIT_KILL_CANDIDATES[2], st); pre.push(h); r.advance(h); } }
const Rs = (process.env.RS ?? '18,20,22,24,26,28,30').split(',').map(Number);
const verbose = process.env.V === '1';
for (const R of Rs) for (const mode of (process.env.MODES ?? 'all,none').split(',')) {
  const r = at(); for (const h of pre) r.advance(h);
  const strike = sb.strikePolicyFor(r, { dashMode: mode });
  const h0 = (r.ledger('playerHits') ?? []).length; let out = 'bound';
  for (let i = 0; i < 600; i += 1) {
    const c = (r.entities('chasers') ?? []).find((b) => b.id === id);
    if (!c) { out = `REMOVED at kite tick ${i} (t${r.ticksCompleted})`; break; }
    const s = r.state; const d = Math.hypot(s.x - c.x, s.y - c.y) || 1;
    const ux = (s.x - c.x) / d, uy = (s.y - c.y) / d;
    const aim = { x: c.x + ux * R, y: c.y + uy * R };
    let held = chooseHeld(s, aim, 0.5);
    if (strike && !c.destroy) held = strike.decide(s, r.entities('strikeBodies'), r.ticksCompleted, held, { slash: r.progress('slashInfo') }).held;
    r.advance(held);
    const c2 = (r.entities('chasers') ?? []).find((b) => b.id === id);
    if (verbose && i % 5 === 0) console.log(`  ${i} P(${r.state.x.toFixed(1)},${r.state.y.toFixed(1)}) ${[...held].join('+')} S(${c2?.x.toFixed(1)},${c2?.y.toFixed(1)}) hits ${c2?.hits} spin ${c2?.swordSpin?.toFixed(2)} sp ${c2?.swordSpinning} reset ${c2?.swordSpinResetTimer} hT ${c2?.hitsTimer}`);
    const hits = (r.ledger('playerHits') ?? []).slice(h0);
    if (hits.length) { out = `HIT at kite tick ${i} by ${hits[0].source}:${hits[0].id}, body hits ${c2?.hits}`; break; }
  }
  console.log(`R ${R} dash ${mode}: ${out}`);
}
