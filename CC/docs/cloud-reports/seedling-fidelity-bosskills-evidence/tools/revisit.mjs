import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const which = process.argv[2];
const base = which === '57' ? JSON.parse(readFileSync('/tmp/claude-0/d1/l57-idle-a.json', 'utf8'))
  : JSON.parse(readFileSync('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/fixtures/lavaboss-witness/kof-solve-203.json', 'utf8')).tape;
const target = which === '57' ? { x: 104, y: 72 } : { x: 152, y: 4 };
const tape = { ...base, persistence: [...(base.persistence ?? []), { level: +which, tag: 0, note: '' }], inputs: [], tick_count: 0, name: `revisit-${which}` };
const staging = stagingFromTape(parseTape(JSON.stringify(tape)));
withContactFidelity({ tentacleBeastFight: true, kingOfFireFight: true }, () => {
  const run = createRunForStaging(staging, atlasLevelSource());
  console.log('boot', run.level, run.state.x, run.state.y, 'tb', JSON.stringify(run.entities('tentacleBeastFight')?.mouth), 'kof', JSON.stringify(run.entities('lavaBossFight')?.boss?.removed));
  const per = [];
  for (let i = 0; i < 1500; i++) {
    const p = run.state; const held = new Set();
    if (Math.abs(p.x - target.x) > 1) held.add(p.x < target.x ? 'right' : 'left');
    if (Math.abs(p.y - target.y) > 1) held.add(p.y < target.y ? 'down' : 'up');
    per.push([...held]);
    const a = run.advance(held);
    if (a?.transition) { console.log('TRANSITION', i, JSON.stringify(a.transition).slice(0, 200)); break; }
  }
  console.log('end', run.level, run.state.x, run.state.y, per.length);
  const inputs = [];
  for (const k of ['up', 'down', 'left', 'right']) { let from = null; for (let t = 0; t <= per.length; t++) { const o = t < per.length && per[t].includes(k); if (o && from === null) from = t; if (!o && from !== null) { inputs.push({ key: k, from, to: t }); from = null; } } }
  inputs.sort((a, b) => a.from - b.from);
  writeFileSync(`/tmp/claude-0/d3/revisit-${which}.json`, JSON.stringify({ ...tape, inputs, tick_count: per.length + 1, description: `bosskills D1: L${which} revisited with {${which},0} cleared` }, null, 1));
});
