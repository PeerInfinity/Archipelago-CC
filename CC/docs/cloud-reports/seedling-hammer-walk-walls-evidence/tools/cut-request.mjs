// Measure-only: cut one captured request row to the given levels' atlas records and gzip it (fixture-sized evidence).
// Usage: node cut-request.mjs <capture.jsonl> <id> <levels comma> <out.json.gz>
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const [file, id, levels, out] = process.argv.slice(2);
const keep = new Set(levels.split(',').map(Number));
const row = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((r) => String(r.id) === id && r.requests);
for (const c of row.requests) c.request.source.records.__map = c.request.source.records.__map.filter(([l]) => keep.has(l));
writeFileSync(out, gzipSync(JSON.stringify(row)));
console.log(out, readFileSync(out).length, 'bytes');
