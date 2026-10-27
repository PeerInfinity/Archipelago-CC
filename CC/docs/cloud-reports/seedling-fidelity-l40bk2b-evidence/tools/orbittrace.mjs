await import('/tmp/claude-0/tools/fork853.mjs');
const sb = globalThis.__sb; const at = globalThis.__at;
const id = 'bobsoldier@880,832';
const cands = sb.ORBIT_KILL_CANDIDATES;
const which = (process.env.CAND ?? '0,2').split(',').map(Number);
for (const ci of which) {
  const cand = cands[ci]; const r = at();
  const strike = sb.strikePolicyFor(r, { dashMode: 'all' });
  const h0 = (r.ledger('playerHits') ?? []).length;
  console.log(`== cand ${ci} ${JSON.stringify(cand)}`);
  for (let i = 0; i < 420; i += 1) {
    const held = sb.orbitKillPolicy(r, id, cand, strike);
    if (held === null) { console.log(`removed at ${i}`); break; }
    r.advance(held);
    const c = (r.entities('chasers') ?? []).find((b) => b.id === id);
    const hit = (r.ledger('playerHits') ?? []).length > h0;
    if (i % Number(process.env.EVERY ?? 10) === 0 || hit) console.log(`${i} P(${r.state.x.toFixed(1)},${r.state.y.toFixed(1)}) held ${[...held].join('+')} S(${c?.x.toFixed(1)},${c?.y.toFixed(1)}) hits ${c?.hits} spin ${c?.swordSpin?.toFixed(2)} spinning ${c?.swordSpinning} reset ${c?.swordSpinResetTimer} hT ${c?.hitsTimer}`);
    if (hit) { console.log('HIT', JSON.stringify((r.ledger('playerHits'))[h0])); break; }
  }
}
