// SCRATCH D1 probe 3: the VISIT-ONLY pair. Run A steps the injected tower from t0; run B leaves both BEAMTOWER
// switches OFF for [0, k) (the tower is built at k), then ON — same seam, same tick, same clock. Print the parts that
// differ and whether the two escapes (both searching) answer differently.
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { loadTape } = await import(R + 'fixtures/index.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { heldKeysAt } = await import(R + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { canonicalDigestText } = await import(R + 'levelRun.js');
const { CONTACT_FIDELITY } = await import(R + 'contactFidelity.js');
const sb = await import(R + 'solverBot.js');
const BASE = atlasLevelSource();
const tape = loadTape('r9-solve-18');
const attrs = { direction: '1', rate: '4' };
const sourceWith = (tx, ty) => {
  const rec = BASE(18);
  const mine = { ...rec, entities: [...rec.entities, { type: 'beamtower', x: tx, y: ty, attrs }] };
  return (n) => (n === 18 ? mine : BASE(n));
};
const runAt = (src, k, T = 76) => {
  const st = stagingFromTape(tape);
  const staging = { ...st, noclip: false, noDamage: false, equips: [], persistence: st.persistence.filter((c) => c.at === undefined) };
  const run = createRunForStaging(staging, src);
  const was = { d: CONTACT_FIDELITY.beamTowerDrift, h: CONTACT_FIDELITY.beamTowerBeamHit };
  for (let t = 0; t < T; t += 1) {
    const off = t < k;
    CONTACT_FIDELITY.beamTowerDrift = off ? false : was.d;
    CONTACT_FIDELITY.beamTowerBeamHit = off ? false : was.h;
    try { run.advance(heldKeysAt(tape, t)); } finally { CONTACT_FIDELITY.beamTowerDrift = was.d; CONTACT_FIDELITY.beamTowerBeamHit = was.h; }
  }
  return run;
};
const ask = (run) => {
  const rows = [];
  sb.HAMMER_ESCAPE_TRACE.sink = (r) => rows.push({ ok: r.ok, exp: r.expansions, bound: r.bound });
  const a = sb.pressEscape(run, { state: run.state, at: 76, keys: [heldKeysAt(tape, 76)], pressAt: 77, id: run.entities('spinnerBodies')[0].id });
  sb.HAMMER_ESCAPE_TRACE.sink = null;
  return { a, rows };
};
let found = 0;
for (const [tx, ty] of [[92, 76], [100, 76], [92, 84], [92, 92], [92, 100], [96, 84], [96, 88], [92, 88], [88, 84]]) {
  const src = sourceWith(tx, ty);
  for (const k of [5, 10, 20, 30, 40, 50, 60, 70]) {
    let A, B;
    try { A = runAt(src, 0); B = runAt(src, k); } catch (e) { console.log(tx, ty, k, 'threw', e.message.slice(0, 100)); continue; }
    const pa = A.stateDigest({ parts: true }).parts, pb = B.stateDigest({ parts: true }).parts;
    const diff = Object.keys(pa).filter((p) => pa[p] !== pb[p]);
    const x = ask(A), y = ask(B);
    const differ = canonicalDigestText(x.a) !== canonicalDigestText(y.a);
    const searched = x.rows.some((r) => r.exp > 0) && y.rows.some((r) => r.exp > 0);
    if (diff.join() === 'visit' && differ && searched) {
      found += 1;
      console.log(`tower@${tx},${ty} k=${k}`, 'parts', diff.join(), 'A', x.a.ok, JSON.stringify(x.rows), '| B', y.a.ok, JSON.stringify(y.rows));
    }
  }
}
console.log('found', found);
