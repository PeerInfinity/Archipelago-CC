// the L18 residue sweep (sweep-seedling-l18-residues' solveAt) with seam.items.hasGhostSword = true
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const M = join(process.cwd(), 'frontend', 'modules', 'seedlingDemo');
const { loadTape } = await import(join(M, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(M, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { twoPassSolve } = await import(join(M, 'twoPassSolve.js'));
const { SPINNER } = await import(join(M, 'spinner.js'));
const S = stagingFromTape(loadTape('r9-solve-18'));
const P = SPINNER.hammerPeriod; const R0 = ((S.seam.time % P) + P) % P;
const shiftTo = (r) => ((((r - R0) % P) + P) % P) - P;
const rows = [];
for (let r = 0; r < P; r += 1) {
  const seam = { ...S.seam, items: { ...S.seam.items, hasGhostSword: true }, time: S.seam.time + shiftTo(r) };
  const makeRun = (persistence) => createRunForStaging({ ...S, seam, persistence, equips: [] }, atlasLevelSource());
  const t0 = Date.now(); let out;
  try {
    const res = await twoPassSolve({ makeRun, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: 'r9-solve-18', boot: S.boot,
      persistence: S.persistence.filter((c) => c.at === undefined), gameTick: async () => { throw new Error('no oracle'); } });
    const rp = makeRun(res.persistence); for (const h of res.out.perTick) rp.advance(h);
    const crossed = rp.transitions.map((x) => x.to_level).join() === '19';
    const landed = rp.spinnerPressHits.filter((h) => h.landed);
    out = { r, verdict: rp.playerHits.length === 0 && crossed ? 'SOLVE' : 'SOLVE-BUT-HIT', length: res.out.perTick.length,
      landed: landed.length, ghost: landed.every((h) => h.weapon === 'ghostsword'),
      digest: createHash('md5').update(res.out.perTick.map((h) => [...h].sort().join('+')).join(',')).digest('hex').slice(0, 12) };
  } catch (e) { out = { r, verdict: `REFUSE ${e?.code ?? e?.name}`, head: String(e?.message ?? e).split('\n')[0].slice(0, 160) }; }
  out.s = (Date.now() - t0) / 1000; rows.push(out);
  console.log(`r${String(r).padStart(2)} ${out.verdict.padEnd(22)} ${String(out.length ?? 'R').padStart(4)} ${out.s.toFixed(1)}s ${out.digest ?? ''} landed ${out.landed ?? ''} ${out.head ?? ''}`);
}
const solved = rows.filter((x) => x.verdict === 'SOLVE');
console.log(`# ${solved.length}/${rows.length} solve; lengths: ${rows.map((x) => x.length ?? 'R').join(' ')}`);
