// SCRATCH D1 probe 2: a beamtower injected into L18; XC's t76/t77 press at seam shifts 0 and 45 (hammer phase equal,
// the drift's phase opposite). Grid over the tower's oel point; print the placements where both escapes SEARCH and the
// answers differ.
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { loadTape } = await import(R + 'fixtures/index.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { heldKeysAt } = await import(R + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { canonicalDigestText } = await import(R + 'levelRun.js');
const sb = await import(R + 'solverBot.js');
const BASE = atlasLevelSource();
const tape = loadTape('r9-solve-18');
const [x0, x1, y0, y1, step] = (process.argv[2] ?? '40,140,30,120,4').split(',').map(Number);
const attrs = JSON.parse(process.argv[3] ?? '{"direction":"1","rate":"4"}');
const sourceWith = (tx, ty) => {
  const rec = BASE(18);
  const mine = { ...rec, entities: [...rec.entities, { type: 'beamtower', x: tx, y: ty, attrs }] };
  return (n) => (n === 18 ? mine : BASE(n));
};
const one = (src, shift) => {
  const st = stagingFromTape(tape);
  const staging = { ...st, seam: { ...st.seam, time: st.seam.time + shift }, noclip: false, noDamage: false, equips: [], persistence: st.persistence.filter((c) => c.at === undefined) };
  const run = createRunForStaging(staging, src);
  for (let t = 0; t < 76; t += 1) run.advance(heldKeysAt(tape, t));
  const rows = [];
  sb.HAMMER_ESCAPE_TRACE.sink = (r) => rows.push({ phase: r.phase, ok: r.ok, exp: r.expansions, bound: r.bound });
  const a = sb.pressEscape(run, { state: run.state, at: 76, keys: [heldKeysAt(tape, 76)], pressAt: 77, id: run.entities('spinnerBodies')[0].id });
  sb.HAMMER_ESCAPE_TRACE.sink = null;
  return { run, a, rows, p: `${run.state.x.toFixed(2)},${run.state.y.toFixed(2)},${JSON.stringify(run.state.damage ?? null)}` };
};
const ref = one(BASE, 0);
let hits = 0;
for (let ty = y0; ty <= y1; ty += step) for (let tx = x0; tx <= x1; tx += step) {
  const src = sourceWith(tx, ty);
  let A, B;
  try { A = one(src, 0); B = one(src, 45); } catch (e) { continue; }
  if (A.p !== ref.p || B.p !== ref.p) continue;
  const sA = A.rows.some((r) => r.exp > 0), sB = B.rows.some((r) => r.exp > 0);
  const tA = canonicalDigestText(A.a), tB = canonicalDigestText(B.a);
  const differ = tA !== tB;
  if (sA && sB && differ) {
    hits += 1;
    console.log(`tower@${tx},${ty}`, 'A', A.a.ok, A.a.bound ?? '', JSON.stringify(A.rows), '| B', B.a.ok, B.a.bound ?? '', JSON.stringify(B.rows));
  }
}
console.log('hits', hits);
