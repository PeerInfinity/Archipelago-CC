// Which L78 cells around r5c6 (6,5) are in which LavaTrap disc, rule T's set and rule K's cut (with the arm).
const m = await import('/home/user/Archipelago-CC/scripts/procgen/make-seedling-playthrough-rules.mjs');
const n = Number(process.argv[2] ?? 78);
const level = m.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
m.playthroughGridFor(level);
const pulls = m.playthroughLavaTrapPulls(level);
const T = new Set((m.playthroughTrapTongues.get(n)?.traps ?? []).flatMap((t) => t.cells.map(([x, y]) => `${x},${y}`)));
const K = new Map();
for (const g of m.playthroughChaserGuards.get(n)?.guards ?? []) for (const [x, y] of g.cut) K.set(`${x},${y}`, JSON.stringify(g.arm));
const cells = (process.argv[3] ?? '6,5 5,5 7,5 6,6 6,4 8,5 8,6 11,4 11,5 11,6').split(' ');
for (const c of cells) {
  const inDisc = pulls.filter((p) => p.from.some(([x, y]) => `${x},${y}` === c)).map((p) => p.tile.join(','));
  console.log(c, 'disc of', inDisc.join('|') || '-', 'T', T.has(c), 'K', K.get(c) ?? '-');
}
for (const p of pulls) console.log('trap', p.tile.join(','), 'from', p.from.map((t) => t.join(',')).join(' '), 'yields', JSON.stringify(p.yields));
