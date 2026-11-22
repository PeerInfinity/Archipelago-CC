// Per-terrain speeds MEASURED off a game run: the player's and each runner's px/tick (Euclidean and max-axis; a step > 5 px, a boot/restart jump, is skipped),
// over consecutive ticks whose start AND end tile are of that terrain. usage: node speeds.mjs <level> <game.json.gz>...
import fs from 'node:fs'; import zlib from 'node:zlib';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = await import(R + 'scripts/procgen/make-seedling-playthrough-rules.mjs');
const HP = await import(R + 'scripts/procgen/seedlingHolderParking.js');
const n = Number(process.argv[2]);
const level = M.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const grid = M.playthroughGridFor(level, { guards: false });
const tt = HP.tileTypesOf(level, grid.width);
const terr = (x, y) => (tt.get(Math.floor(y / 16) * grid.width + Math.floor(x / 16)) === 17 ? 'lava' : tt.get(Math.floor(y / 16) * grid.width + Math.floor(x / 16)) === 1 ? 'water' : 'floor');
for (const file of process.argv.slice(3)) {
    const run = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
    const byT = new Map();
    for (const r of run.reads) if (r.level === n && !byT.has(r.tick)) byT.set(r.tick, r);
    const ticks = [...byT.keys()].sort((a, b) => a - b);
    const acc = {};
    const add = (k, d, ax) => { const a = (acc[k] ??= { n: 0, d: 0, ax: 0, max: 0 }); a.n += 1; a.d += d; a.ax += ax; a.max = Math.max(a.max, d); };
    for (let k = 1; k < ticks.length; k += 1) {
        if (ticks[k] !== ticks[k - 1] + 1) continue;
        const a = byT.get(ticks[k - 1]), b = byT.get(ticks[k]);
        const ta = terr(a.x, a.y), tb = terr(b.x, b.y);
        if (ta === tb && Math.hypot(b.x - a.x, b.y - a.y) <= 5) { const dx = b.x - a.x, dy = b.y - a.y; add('player:' + ta, Math.hypot(dx, dy), Math.max(Math.abs(dx), Math.abs(dy))); }
        const ra = (a.mob ?? []).filter((m) => m.startsWith('LavaRunner')).map((m) => m.match(/\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number));
        const rb = (b.mob ?? []).filter((m) => m.startsWith('LavaRunner')).map((m) => m.match(/\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number));
        if (ra.length !== rb.length) continue;
        ra.forEach(([x0, y0], j) => {
            const [x1, y1] = rb[j]; const d = Math.hypot(x1 - x0, y1 - y0); if (d === 0 || d > 5) return;
            const t0 = terr(x0, y0); if (t0 !== terr(x1, y1)) return;
            add('runner:' + t0, d, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
        });
    }
    console.log(file.split('/').pop());
    for (const [k, a] of Object.entries(acc)) console.log(`  ${k.padEnd(14)} ticks=${String(a.n).padStart(4)} mean=${(a.d / a.n).toFixed(3)} meanMaxAxis=${(a.ax / a.n).toFixed(3)} peak=${a.max.toFixed(3)}`);
}
