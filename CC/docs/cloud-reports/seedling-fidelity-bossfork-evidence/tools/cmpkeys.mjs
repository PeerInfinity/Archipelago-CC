import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const tape = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, inputs: [], tick_count: 0 })));
const SRC = atlasLevelSource();
const per = Array.from({ length: tape.tick_count }, () => new Set());
for (const i of tape.inputs) for (let t = i.from; t < i.to; t += 1) per[t].add(i.key);
withContactFidelity({ kingOfFireFight: true }, () => {
  const run = createRunForStaging(staging, SRC);
  const out = solveSegment({ run, goals: [{ kind: 'clear-tag', tag: { level: 82, tag: 0 }, at: { x: 112, y: 48 }, obstacle: 'lavaboss@112,48' }], name: 'x', boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
  const d = [];
  out.perTick.forEach((k, t) => { const a = [...k].sort().join('+'), b = [...per[t]].sort().join('+'); if (a !== b) d.push(`${t}:${a}|${b}`); });
  console.log(d.length, d.slice(0, 40).join(' '));
});
