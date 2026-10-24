// For a game record (game.mjs output): replay the tape in the model, and at every tick ask hazards.axeHitsPlayer
// for each spinning axe in the level against the model's PRE-move box (obs t-1) at update u = t - V.
import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { axeHitsPlayer } = await import(M + 'hazards.js');
const { HITBOX } = await import(M + 'playerPhysicsV1.js');
const g = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const useGame = process.argv.includes('--game');
const tape = parseTape(JSON.stringify(g.tape));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
const col = [];
try { let r = st.next(); while (!r.done) { const o = r.value.observation; col[o.t] = o; r = st.next(); } } catch (e) { console.log('THREW', e.message.slice(0, 300)); }
console.log('HITBOX', JSON.stringify(HITBOX));
const src = useGame ? g.rows : col;
const byT = []; for (const o of src) if (o) byT[o.t] = o;
let V = 0; let lvl = byT[0]?.level;
for (let t = 1; t < byT.length; t++) {
  const p = byT[t - 1]; const o = byT[t]; if (!p || !o) continue;
  if (o.level !== p.level) { V = t; lvl = o.level; continue; }
  const w = run.worldFor(p.level);
  for (const h of (w.combat?.hazards ?? []).filter((x) => x.tag === 'spinningaxe')) {
    const axe = { cx: h.cx, cy: h.cy, rate: Number(h.attrs?.rate ?? 0) };
    const box = { x: p.x - HITBOX.originX, y: p.y - HITBOX.originY, right: p.x - HITBOX.originX + HITBOX.width, bottom: p.y - HITBOX.originY + HITBOX.height };
    const hit = axeHitsPlayer(axe, t - V, box);
    if (hit) console.log(`t${t} u${t - V} ${h.tag}@${h.x},${h.y} rate ${axe.rate} arm ${hit.arm} box@(${p.x.toFixed(2)},${p.y.toFixed(2)}) deg ${hit.line.deg % 360}`);
  }
}
