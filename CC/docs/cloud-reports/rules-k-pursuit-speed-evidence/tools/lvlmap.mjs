const m = await import('/home/user/Archipelago-CC/scripts/procgen/make-seedling-playthrough-rules.mjs');
const n = Number(process.argv[2]);
const level = m.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const g = m.playthroughGridFor(level);
const base = m.playthroughGridFor(level, { guards: false });
const kg = m.playthroughChaserGuards.get(n);
const K = new Set((kg?.charged ?? []).map(([x, y]) => `${x},${y}`));
const T = new Set((m.playthroughTrapTongues.get(n)?.traps ?? []).flatMap((t) => t.cells.map(([x, y]) => `${x},${y}`)));
console.log('guards', JSON.stringify(kg?.guards?.map((r) => [r.body, r.faster, r.cut.length])), 'dropped', JSON.stringify(kg?.dropped?.map((d) => d.body)));
for (let y = 0; y < g.height; y++) {
  let row = '';
  for (let x = 0; x < g.width; x++) {
    const c = g.cells[y * g.width + x]; const k = `${x},${y}`;
    const ch = c.kind === 'wall' ? '#' : c.kind === 'sink' ? 's' : c.kind === 'manual' ? 'm' : K.has(k) && T.has(k) ? 'X' : K.has(k) ? 'K' : T.has(k) ? 'T' : (c.conditions ?? []).length ? 'g' : c.kind === 'directional' ? 'd' : '.';
    row += ch;
  }
  console.log(String(y).padStart(2), row);
}
