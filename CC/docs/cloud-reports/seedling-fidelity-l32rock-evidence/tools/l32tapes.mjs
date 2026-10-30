const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { loadTape } = await import(M + 'fixtures/index.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { liveClears } = await import(M + 'jsRuntimeCore.js');
const fs = await import('node:fs');
const idx = JSON.parse(fs.readFileSync(M + 'fixtures/tapes/index.json', 'utf8'));
const names = idx.tapes.map((t) => t.file.replace(/\.json$/, ''));
const out = [];
for (const name of names) {
  let tape; try { tape = loadTape(name); } catch (e) { continue; }
  let run = null; const pos = []; let saw32 = false;
  try {
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s2, h, rn) => { run = rn; if (rn?.level === 32) saw32 = true; } });
    let r = st.next(); while (!r.done) { pos.push([r.value.observation.x, r.value.observation.y]); r = st.next(); }
    const rows = run.ledger('bobBossEvents').filter((x) => x.what.startsWith('rock'));
    out.push({ name, saw32, earned: run.ledger('earnedClears').map((c)=>c.level+':'+c.tag+'@'+c.t).join(' '), md5: (await import('node:crypto')).createHash('md5').update(JSON.stringify(pos)).digest('hex').slice(0,8),
      clears: liveClears(run).map((c) => `${c.level}:${c.tag}`).join(' '), rock: rows.map((x) => `${x.what}@${x.t}`).join(' ') });
  } catch (e) { out.push({ name, error: String(e.message).slice(0, 200) }); }
}
for (const o of out) console.log(JSON.stringify(o));
