const P = await import(process.cwd() + '/scripts/procgen/make-seedling-playthrough-rules.mjs');
let bad = 0, cells = 0;
for (const id of P.playthroughKillLocks.keys()) {
    const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === id);
    const w = P.killLockWallOf(level); const g = P.playthroughGridFor(level);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) { cells++; if (w(x, y) !== (g.cells[y * g.width + x].kind === 'wall')) { bad++; console.log(`L${id} ${x},${y}`); } }
}
console.log(`phase-2 walls vs final analyzer grid walls: ${cells} cells over ${P.playthroughKillLocks.size} kill-lock levels, ${bad} differ`);
