// MEASUREMENT ONLY: cut one captured request (jsonl row by --id, request --i) to the atlas records of --levels, gzip it.
// Usage: node cut-fixture.mjs --requests=<jsonl> --id=N [--i=K] --levels=12[,13] [--d=<seam offset>] --out=<.json.gz>
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const row = readFileSync(args.requests, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === args.id);
const c = row.requests.find((q) => String(q.i) === String(args.i ?? 0));
const keep = new Set(args.levels.split(',').map(Number));
const req = structuredClone(c.request);
req.source.records.__map = req.source.records.__map.filter(([lv]) => keep.has(lv));
if (args.d) req.staging.seam.time += Number(args.d);
writeFileSync(args.out, gzipSync(JSON.stringify({ id: row.id, key: row.key, requests: [{ ...c, request: req }] }), { level: 9 }));
