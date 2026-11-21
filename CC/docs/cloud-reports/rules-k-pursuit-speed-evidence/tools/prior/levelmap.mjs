// One level's grid (K-only, the variant in K_NARROW) with each body's K cut and the cells a game run stood on.
// Usage: K_NARROW=K K_NARROW_NO_T=1 node levelmap.mjs <level> [<run.game.json.gz>]
import fs from 'node:fs'; import zlib from 'node:zlib';
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
const HP = await import(pathToFileURL(path.join(repo, 'scripts/procgen/seedlingHolderParking.js')));
const n = Number(process.argv[2]);
const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
process.env.K_NARROW_REPORT = '1'; globalThis.__kNarrowReport = [];
const g = P.playthroughGridFor(level);
const rows = globalThis.__kNarrowReport.filter((r, i, a) => a.findIndex((z) => z.body === r.body) === i);
const tt = HP.tileTypesOf(level, g.width);
const path_ = new Set();
if (process.argv[3]) {
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[3])));
  for (const x of d.reads) if (x.level === n) path_.add(`${Math.floor(x.x / 16)},${Math.floor(x.y / 16)}`);
}
const ch = { open: '.', wall: '#', sink: '~', gated: 'G', manual: 'M', directional: 'd' };
const variant = process.env.K_SHOW ?? 'K';
for (const r of rows) {
  const cut = new Set(r.cut[variant].map((c) => c.join(',')));
  const cc = new Set(r.perCell.filter((c) => c.c).map((c) => c.cell.join(',')));
  console.log(`\n${r.body}  (${variant} cut: X = (c) reaches, x = (c) does not; o = game path; digits = tile type mod 10 for lava/water)`);
  console.log('    ' + [...Array(g.width).keys()].map((x) => x % 10).join(''));
  for (let y = 0; y < g.height; y++) {
    let s = '';
    for (let x = 0; x < g.width; x++) {
      const k = `${x},${y}`; const c = g.cells[y * g.width + x];
      const sp = r.body.match(/@(\d+),(\d+)/); const bx = Math.floor((+sp[1] + 8) / 16), by = Math.floor((+sp[2] + 8) / 16);
      s += (x === bx && y === by) ? 'E' : cut.has(k) ? (cc.has(k) ? 'X' : 'x') : path_.has(k) ? 'o' : (tt.get(y * g.width + x) === 17 ? 'L' : tt.get(y * g.width + x) === 1 ? 'W' : (ch[c.kind] ?? '?'));
    }
    console.log(String(y).padStart(3) + ' ' + s);
  }
}
