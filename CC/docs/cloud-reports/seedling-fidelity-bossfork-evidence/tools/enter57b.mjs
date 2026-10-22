// boot L58 under the L57 door, hold `up` N ticks, then idle; print level/pos per change. Writes a tape to argv[2] if given.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = atlasLevelSource();
const base = JSON.parse(readFileSync(M + 'fixtures/tentaclebeast-witness/tb-idle-s1.json', 'utf8')).tape;
const tape = { ...base, name: 'enter-57-cleared', boot: { level: 58, x: 56, y: 136 }, persistence: [{ level: 57, tag: 0, note: '' }],
  inputs: [{ key: 'up', from: 0, to: 2 }], tick_count: 121, description: 'BOSSFORK D2: L58 -> L57 with {57,0} cleared, then idle on the arrival' };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(tape, null, 1));
for (const on of [false, true]) withContactFidelity({ tentacleBeastFight: on }, () => {
  const st = createTapeStepper(parseTape(JSON.stringify(tape)), { levelSource: SRC });
  let r = st.next(); let last = '';
  const out = [];
  while (!r.done) { const o = r.value.observation; const k = `L${o.level}(${o.x},${o.y})`; if (k !== last) out.push(`t${o.t}:${k}`); last = k; r = st.next(); }
  console.log(on ? 'ON ' : 'OFF', out.slice(0, 12).join(' '), '…', out.length);
});
