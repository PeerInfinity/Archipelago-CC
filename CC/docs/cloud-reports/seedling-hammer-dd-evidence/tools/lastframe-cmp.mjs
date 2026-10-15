// SCRATCH (seedling-hammer-dd): compare a probe's --frames (the LAST frame at each tick) with the model's replay of
// the tape in REPO (the process's switches): level, player, player hits, the BobSoldier rows [x, y, hits].
//   REPO=<tree> node lastframe-cmp.mjs <tape.json> <frames.json> <bodyId>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO;
const { parseTape } = await import(join(R, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { createTapeStepper } = await import(join(R, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const { atlasLevelSource } = await import(join(R, 'frontend/modules/seedlingDemo/levelSource.js'));
const [tapeP, framesP, BODY] = process.argv.slice(2);
const tape = parseTape(readFileSync(tapeP, 'utf8'));
const model = new Map(); let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) { const o = r.value.observation;
  const b = run && run.level === 30 ? (run.entities('chasers') ?? []).filter((c) => c.id === BODY && !c.removed) : [];
  model.set(o.t, { level: run?.level, p: [o.x, o.y], hits: run?.ledger('playerHits').length ?? 0, bodies: b.map((c) => [c.x, c.y, c.hits]) });
  r = st.next(); }
const by = new Map(); let end = null;
for (const f of JSON.parse(readFileSync(framesP, 'utf8')).frames) { if (f.status?.finished) end = f.status; if (Number.isInteger(f.tick) && f.tick >= 1 && f.player) by.set(f.tick, f); }
let n = 0; const bad = [];
for (const [t, f] of by) { const m = model.get(t); if (!m) continue; n += 1;
  const g = { level: f.status.level, p: [f.player.x, f.player.y], hits: f.status.hits, bodies: f.bodies.map((b) => [b.x, b.y, b.enemy?.hits ?? null]) };
  if (JSON.stringify(g) !== JSON.stringify(m)) bad.push({ t, g, m }); }
console.log(`compared ${n} ticks (last frame), ${bad.length} differ; game end ${JSON.stringify(end && { tick: end.tick, level: end.level, hits: end.hits })}; model ${tape.tick_count ?? model.size} t, final level ${run?.level}, hits ${run?.ledger('playerHits').length}`);
for (const b of bad.slice(0, 5)) console.log(JSON.stringify(b));
