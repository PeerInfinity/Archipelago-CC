// scratch: model replay of a tape; per tick the player, each chaser of a tag, exact-box overlap, and the
// WAIT-mode bound (t0 bodies grown bound*h) overlap
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const D = join(REPO, 'frontend/modules/seedlingDemo');
const { parseTape } = await import(join(D, 'tapeFormat.js'));
const { createTapeStepper } = await import(join(D, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(D, 'levelSource.js'));
const { playerBoxAt } = await import(join(D, 'playerPhysicsV2.js'));
const { chaserBoxAt } = await import(join(D, 'chasers.js'));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const tag = process.argv[3] || 'lavarunner';
const ov = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
const grow = (r, g) => ({ x: r.x - g, y: r.y - g, right: r.right + g, bottom: r.bottom + g });
let run = null; let t0b = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  const ch = (run?.entities('chasers') ?? []).filter((c) => c.tag === tag || c.id.startsWith(tag));
  if (t0b === null) t0b = ch.map((c) => ({ ...c }));
  const pb = playerBoxAt(o.x, o.y);
  const line = ch.map((c) => {
    const b0 = t0b.find((x) => x.id === c.id);
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    const g = b0 ? ov(pb, grow(chaserBoxAt(tag, b0.x, b0.y), 1.5 * o.t)) : null;
    return `${c.id} (${c.x.toFixed(2)},${c.y.toFixed(2)}) v(${c.vx.toFixed(2)},${c.vy.toFixed(2)}) d=${d.toFixed(1)} exact=${ov(pb, chaserBoxAt(tag, c.x, c.y)) ? 'HIT' : '-'} waitBound=${g ? 'X' : '-'}`;
  }).join(' | ');
  console.log(`t${o.t} L${run?.level} p(${o.x.toFixed(2)},${o.y.toFixed(2)}) hits=${run?.player?.hits ?? run?.hits ?? '?'} ${line}`);
  r = st.next();
}
