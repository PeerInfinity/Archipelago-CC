// SCRATCH: per sampled tick, the model's static body rows (flag from env) vs the game's botMobiles rows.
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [tapeFile, samplesFile] = process.argv.slice(2);
const tape = parseTape(readFileSync(tapeFile, 'utf8'));
const game = JSON.parse(readFileSync(samplesFile, 'utf8'));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
const model = [];
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  const sb = run ? (run.entities('staticBodies') ?? []) : [];
  model[o.t] = { x: o.x, y: o.y, hitsLedger: run ? run.ledger('playerHits').length : 0, sb: Object.fromEntries(sb.map((b) => [b.id, b])),
    spits: run ? (run.entities('shooters') ?? []).flatMap((t) => t.spits.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)}`)) : [] };
  r = st.next();
}
// game body (cx,cy) -> census id: SandTrap entity = oel+8 ; Turret = oel+8
let worst = 0, cmp = 0, bad = [];
for (const f of game.frames) {
  const m = model[f.t]; if (!m) continue;
  if (Math.abs(m.x - f.px) > 1e-9 || Math.abs(m.y - f.py) > 1e-9) bad.push(`t${f.t} player model(${m.x},${m.y}) game(${f.px},${f.py})`);
  for (const b of f.bodies) {
    if (b.cls === 'TurretSpit') continue;
    const id = `${b.cls === 'Turret' ? 'turret' : 'sandtrap'}@${b.x - 8},${b.y - 8}`;
    const mb = m.sb[id];
    const gHits = b.hits, gHt = b.ht, gDie = b.anim === 'die';
    const mHits = mb ? mb.hits : 0, mHt = mb ? mb.hitsTimer : 0, mDie = mb ? (mb.dying && !mb.destroy) : false;
    cmp++;
    if (gHits !== mHits || gHt !== mHt || gDie !== mDie || (b.destroy === true) !== (mb?.destroy === true)) bad.push(`t${f.t} ${id} game h${gHits} ht${gHt} die${gDie} d${b.destroy} | model h${mHits} ht${mHt} die${mDie} d${mb?.destroy} removed${mb?.removed}`);
  }
  // presence: model removed bodies must be absent in game
  for (const [id, mb] of Object.entries(m.sb)) {
    const present = f.bodies.some((b) => b.cls !== 'TurretSpit' && `${b.cls === 'Turret' ? 'turret' : 'sandtrap'}@${b.x - 8},${b.y - 8}` === id);
    if (mb.removed === present) bad.push(`t${f.t} ${id} presence game ${present} model removed ${mb.removed} (removedAt ${mb.removedAt})`);
  }
  const gs = f.bodies.filter((b) => b.cls === 'TurretSpit').map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)}`).sort().join(' ');
  const ms = [...m.spits].sort().join(' ');
  if (gs !== ms) bad.push(`t${f.t} spits game [${gs}] model [${ms}]`);
}
console.log(`${tapeFile}: ${game.frames.length} samples, ${cmp} body comparisons, ${bad.length} disagreement(s); model player hits ${model.at(-1).hitsLedger}`);
for (const b of bad.slice(0, 25)) console.log('  ', b);
