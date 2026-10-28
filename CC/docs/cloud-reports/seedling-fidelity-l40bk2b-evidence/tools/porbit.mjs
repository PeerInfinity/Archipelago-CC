await import('/tmp/claude-0/tools/fork853.mjs');
const sb = globalThis.__sb; const at = globalThis.__at;
const SD = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { chooseHeld } = await import(SD + 'botDriverV1.js');
const { playerBoxAt } = await import(SD + 'playerPhysicsV2.js');
const id = 'bobsoldier@880,832';
const OK = sb.ORBIT_KILL;
const N = Number(process.env.N ?? 85);
const pre = []; { const r = at(); const st = sb.strikePolicyFor(r, { dashMode: 'all' }); for (let i = 0; i < N; i += 1) { const h = sb.orbitKillPolicy(r, id, sb.ORBIT_KILL_CANDIDATES[2], st); pre.push(h); r.advance(h); } }
function free(run, a, b) {
  const opts = run.liveGeometryOpts();
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1));
  for (let i = 1; i <= n; i += 1) if (run.world.collidesSolid(playerBoxAt(a.x + (b.x - a.x) * (i / n), a.y + (b.y - a.y) * (i / n)), opts)) return false;
  return true;
}
function policy(run, cand, strike) {
  const { r, dir, safe } = cand;
  const c = (run.entities('chasers') ?? []).find((b) => b.id === id);
  if (!c) return null;
  const s = run.state;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const phi = Math.atan2(s.y - c.y, s.x - c.x);
  const off = wrap(phi - Math.atan2(Math.sin(-c.swordSpin), Math.cos(-c.swordSpin)));
  const pt = (rad, ang) => ({ x: c.x + rad * Math.cos(ang), y: c.y + rad * Math.sin(ang) });
  // the desired point, projected: the free point (box and straight sweep from the player) at that radius nearest the desired angle
  const atp = (rad, turn) => {
    const want = phi + turn;
    for (let k = 0; k <= 18; k += 1) for (const sg of k ? [1, -1] : [1]) {
      for (const rr of [rad, rad + 4, rad - 4, rad + 8]) {
        const p = pt(rr, want + sg * k * (10 * Math.PI / 180));
        if (free(run, s, p)) return p;
      }
    }
    return pt(rad, want);
  };
  let aim;
  if (c.destroy) aim = atp(Math.max(r, OK.backoff), 0);
  else if (c.swordSpinning) aim = atp(r, dir * OK.step);
  else if (c.swordSpinResetTimer === 0) aim = atp(OK.trigger, dir * OK.step);
  else if (Math.abs(off) < safe) aim = atp(r, (off >= 0 ? 1 : -1) * OK.step);
  else if (c.hitsTimer > 0) aim = atp(OK.backoff, 0);
  else aim = atp(OK.close, 0);
  const held = chooseHeld(s, aim, 1.0);
  if (c.destroy || !strike || s.fall) return held;
  return strike.decide(s, run.entities('strikeBodies'), run.ticksCompleted, held, { slash: run.progress('slashInfo') }).held;
}
const V = process.env.V === '1';
let wins = 0;
for (const [ci, cand] of sb.ORBIT_KILL_CANDIDATES.entries()) {
  const r = at(); for (const h of pre) r.advance(h);
  const strike = sb.strikePolicyFor(r, { dashMode: 'all' });
  const h0 = (r.ledger('playerHits') ?? []).length; let out = 'bound';
  for (let i = 0; i < 420; i += 1) {
    const held = policy(r, cand, strike);
    if (held === null) { out = `REMOVED at ${i} (t${r.ticksCompleted})`; wins += 1; break; }
    r.advance(held);
    const c2 = (r.entities('chasers') ?? []).find((b) => b.id === id);
    if (V && i % 5 === 0) console.log(`  ${i} P(${r.state.x.toFixed(1)},${r.state.y.toFixed(1)}) ${[...held].join('+')} S(${c2?.x.toFixed(1)},${c2?.y.toFixed(1)}) hits ${c2?.hits} spin ${c2?.swordSpin?.toFixed(2)} sp ${c2?.swordSpinning} reset ${c2?.swordSpinResetTimer} hT ${c2?.hitsTimer}`);
    const hits = (r.ledger('playerHits') ?? []).slice(h0);
    if (hits.length) { out = `HIT at ${i} by ${hits[0].source}:${hits[0].id}, body hits ${c2?.hits}`; break; }
  }
  console.log(`cand ${ci} r ${cand.r} dir ${cand.dir} safe ${Math.round(cand.safe * 180 / Math.PI)}: ${out}`);
  if (process.env.ONE) break;
}
console.log('wins', wins);
