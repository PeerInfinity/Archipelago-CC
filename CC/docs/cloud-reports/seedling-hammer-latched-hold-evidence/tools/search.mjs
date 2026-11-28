const R = '/home/user/Archipelago-CC/';
let done = false;
globalThis.__lhProbe = (run, resolved, ctx, H) => {
  if (done) return; done = true;
  const geo = run.liveGeometryOpts();
  const contacts = new Set([...H.senseContacts(run)]);
  const opts = H.solverPlanOpts(run, contacts);
  const open = (r) => resolved.hold.until.test(r);
  const bound = resolved.hold.ticks;
  const hits0 = (run.ledger('playerHits') ?? []).length, deaths0 = (run.ledger('playerDeaths') ?? []).length;
  // map
  const x0 = Math.round(run.state.x), y0 = Math.round(run.state.y);
  let rows = [];
  for (let y = y0 - 112; y <= y0 + 112; y += 8) { let l = ''; for (let x = x0 - 160; x <= x0 + 240; x += 8) {
    const solid = run.world.collidesSolid(H.playerBoxAt(x, y), geo); const me = Math.abs(x - x0) < 4 && Math.abs(y - y0) < 4;
    l += me ? '@' : solid ? '#' : '.'; } rows.push(`${String(y).padStart(4)} ${l}`); }
  console.log(rows.join('\n'));
  const cands = [];
  for (let y = y0 - 128; y <= y0 + 200; y += 16) for (let x = x0 - 160; x <= x0 + 320; x += 16) {
    if (run.world.collidesSolid(H.playerBoxAt(x, y), geo)) continue;
    if (H.plannerObstacleAt(run.world, x, y, null, opts) !== null) continue;
    if (H.planWaypointsOrNull(run.world, run.state, { x, y }, null, opts) === null) continue;
    cands.push({ x, y, d: Math.hypot(x - x0, y - y0) });
  }
  cands.sort((a, b) => a.d - b.d);
  console.log('CANDS', cands.length);
  const t0 = Date.now(); let ok = 0;
  for (const c of cands.slice(0, Number(process.env.NC ?? 60))) {
    const f = ctx.fork(); const keys = [];
    const w = H.forkWalkTo(f, keys, c, opts, null, hits0, deaths0);
    let res;
    if (w.why) res = `walk: ${w.why}`;
    else if (keys.length > bound) res = `walk ${keys.length} > bound`;
    else { const st = H.fadeForkStand(f, keys, open, bound - keys.length + 1, hits0, deaths0); res = st.opened ? `OPEN walk ${keys.length} +stand ${st.ticks}` : `stand: ${st.why}`; if (st.opened) ok++; }
    console.log('C', c.x, c.y, Math.round(c.d), res);
  }
  console.log('OK', ok, 'ms', Date.now() - t0);
  process.exit(0);
};
await import('./solvecap.mjs');
