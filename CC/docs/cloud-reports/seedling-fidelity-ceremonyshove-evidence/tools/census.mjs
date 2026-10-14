// CEREMONYSHOVE D1 (scratch, measure-only): every committed tape through the model (the process's switches): the
// observation stream's md5, each ceremony's start with the chasers in the room (and any i-framed/dying one), the
// shield-bump rows after it, and (ON) the stepped lumps. Run once OFF and once ON and diff.
//   SEEDLING_CEREMONY_SHOVE=0|1 node census.mjs out.jsonl
import { writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const M = `${process.env.REPO ?? process.cwd()}/frontend/modules/seedlingDemo/`;
const { fixtureNames, loadTape } = await import(M + 'fixtures/index.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const LS = atlasLevelSource();
const out = process.argv[2]; writeFileSync(out, '');
for (const name of fixtureNames()) {
  let tape; try { tape = loadTape(name); } catch (e) { appendFileSync(out, JSON.stringify({ name, loadErr: e.message.slice(0, 100) }) + '\n'); continue; }
  let run = null; const obs = []; const cer = []; let err = null; let seen = 0;
  const t0 = Date.now();
  try {
    const st = createTapeStepper(tape, { levelSource: LS, onTick: (a, b, c, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done) { const o = r.value.observation; obs.push([o.t, o.x, o.y, o.level]);
      const cs = run?.ceremonyStarts ?? [];
      while (seen < cs.length) { const c = cs[seen++];
        const ch = (run.entities('chasers') ?? []).filter(b => !b.removed);
        cer.push({ t: c.t, level: c.level, tag: c.tag, bodies: ch.length,
          hot: ch.filter(b => b.hitsTimer > 0 || b.dying || b.destroy).map(b => `${b.id}:ht${b.hitsTimer}${b.dying ? ':dying' : ''}`) }); }
      r = st.next(); }
  } catch (e) { err = e.message.slice(0, 160); }
  const bumps = run ? (run.shieldBumps ?? []) : [];
  for (const c of cer) c.bumpsInCeremony = bumps.filter(b => b.t >= c.t && b.t <= c.t + 400 && b.level === c.level).length; // upper window
  const md5 = createHash('md5').update(JSON.stringify(obs)).digest('hex');
  appendFileSync(out, JSON.stringify({ name, ticks: obs.length, md5, err, cer, lumps: run?.ceremonyLumps ?? null, ms: Date.now() - t0 }) + '\n');
}
