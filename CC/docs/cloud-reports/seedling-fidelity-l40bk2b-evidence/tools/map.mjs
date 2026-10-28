await import('/tmp/claude-0/tools/fork853.mjs');
const run = globalThis.__run; const w = run.world;
const walk = new Map(w.walkableTiles.map((t) => [`${t.tx},${t.ty}`, t]));
const all = new Map((w.tiles ?? []).map((t) => [`${t.tx},${t.ty}`, t]));
const marks = new Map();
const mark = (x, y, ch) => marks.set(`${Math.floor(x / 16)},${Math.floor(y / 16)}`, ch);
for (const t of w.burnableTrees ?? []) mark(t.x, t.y, 'T');
for (const c of w.chests ?? []) mark(c.x, c.y, 'C');
for (const p of w.pressers ?? []) mark(p.x, p.y, 'b');
for (const c of run.entities('chasers') ?? []) mark(c.x, c.y, c.id.startsWith('bobsoldier') ? 'S' : 'e');
mark(run.state.x, run.state.y, 'P');
const [x0, x1, y0, y1] = (process.env.BOX ?? '40,60,42,58').split(',').map(Number);
console.log('     ' + Array.from({ length: x1 - x0 + 1 }, (_, k) => String((x0 + k) % 10)).join(''));
for (let ty = y0; ty <= y1; ty += 1) {
  let row = '';
  for (let tx = x0; tx <= x1; tx += 1) {
    const k = `${tx},${ty}`;
    row += marks.get(k) ?? (walk.has(k) ? '.' : (all.get(k)?.name?.[0] ?? '#'));
  }
  console.log(String(ty).padStart(3) + '  ' + row + `  y=${ty * 16}`);
}
console.log('x0 px', x0 * 16, 'trees', JSON.stringify((w.burnableTrees ?? []).map((t) => [t.id ?? '', t.x, t.y])).slice(0, 200), 'chests', JSON.stringify((w.chests ?? []).map((t) => [t.x, t.y])).slice(0, 200));
