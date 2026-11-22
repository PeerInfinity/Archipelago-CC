// Prints a game run's trace (every N ticks): the player's pixel/tile/terrain and each runner's distance; then the path on the map.
// usage: node trace.mjs <level> <game.json.gz> [every=8]
import fs from 'node:fs'; import zlib from 'node:zlib';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = await import(R + 'scripts/procgen/make-seedling-playthrough-rules.mjs');
const HP = await import(R + 'scripts/procgen/seedlingHolderParking.js');
const [n, file, every = 8] = [Number(process.argv[2]), process.argv[3], Number(process.argv[4] ?? 8)];
const run = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const level = M.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const grid = M.playthroughGridFor(level, { guards: false });
const tt = HP.tileTypesOf(level, grid.width);
const seen = new Set(); const path = new Map();
let minD = Infinity, minAt = null;
console.log('row', JSON.stringify(run.row).slice(0, 400));
for (const r of run.reads) {
    if (r.level !== n || seen.has(r.tick)) continue; seen.add(r.tick);
    const tx = Math.floor(r.x / 16), ty = Math.floor(r.y / 16), i = ty * grid.width + tx;
    if (!path.has(i)) path.set(i, r.tick);
    const runners = (r.mob ?? []).filter((m) => m.startsWith('LavaRunner')).map((m) => m.match(/\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number));
    const ds = runners.map(([x, y]) => Math.hypot(x - r.x, y - r.y));
    for (const d of ds) if (d < minD) { minD = d; minAt = r.tick; }
    if (r.tick % every === 0) console.log(`t${r.tick} p=(${r.x.toFixed(1)},${r.y.toFixed(1)}) tile=${tx},${ty} ${tt.get(i) === 17 ? 'LAVA' : tt.get(i) === 1 ? 'WATER' : 'floor'} hits=${r.hits} runners=${runners.map(([x, y], k) => `(${x.toFixed(0)},${y.toFixed(0)}):${ds[k].toFixed(1)}`).join(' ')}`);
}
console.log(`closest runner ${minD.toFixed(2)} px at t${minAt}`);
const { width, height, cells } = grid;
for (let y = 0; y < height; y += 1) {
    let s = '';
    for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        s += path.has(i) ? '*' : HP.BLOCKING.has(cells[i].kind) ? '#' : tt.get(i) === 17 ? '~' : tt.get(i) === 1 ? 'w' : '.';
    }
    console.log(String(y).padStart(3) + ' ' + s);
}
