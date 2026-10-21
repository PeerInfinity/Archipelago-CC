import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const w = JSON.parse(readFileSync(M + 'fixtures/tentaclebeast-witness/tb-solve-s2.json', 'utf8'));
const SRC = atlasLevelSource();
const staging = stagingFromTape(parseTape(JSON.stringify({ ...w.tape, inputs: [], tick_count: 0 })));
const per = Array.from({ length: w.tape.tick_count }, () => new Set());
for (const i of w.tape.inputs) for (let t = i.from; t < i.to; t += 1) per[t].add(i.key);
const cut = Number(process.argv[2] ?? 789);
withContactFidelity({ tentacleBeastFight: true }, () => {
  const run = createRunForStaging(staging, SRC);
  for (let t = 0; t < cut; t++) run.advance(per[t]);
  const f = run.entities('tentacleBeastFight');
  console.log('at', cut, 'anim', f.beast.anim, 'mouth', JSON.stringify(f.mouth), 'report', JSON.stringify(f.report));
  try {
    const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 64 } }], name: 'd1b', boot: staging.boot, prefix: per.slice(0, cut) });
    const mine = out.perTick.map((k) => [...k].sort().join('+')); const theirs = per.map((k) => [...k].sort().join('+'));
    const d = mine.map((k, t) => (k === theirs[t] ? null : t)).filter((x) => x !== null);
    console.log('SOLVED level', run.level, 'ticks', out.perTick.length, 'witness', per.length, 'diff ticks', d.length, d.slice(0, 5), 'hits', run.damage.hits);
  } catch (e) { console.log('REFUSED', String(e.message).slice(0, 300)); }
});
