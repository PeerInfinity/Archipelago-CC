// MEASUREMENT ONLY (L95-PUNCHER's cut-fixture.mjs, the level a parameter): one captured leg (sweep capture jsonl,
// --id) to a fixture: its request `i` (default the first), the atlas records cut to the given levels (comma list), the page's `result` dropped.
// Usage: node cut-fixture.mjs <requests.jsonl> <id> <levels> <out.json.gz> [<request i>=0]
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const [req, id, level, out] = process.argv.slice(2);
const row = readFileSync(req, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === id);
const { result, ...q } = row.requests.find((c) => String(c.i) === String(process.argv[6] ?? 0));
q.request = { ...q.request, source: { ...q.request.source,
    records: { __map: q.request.source.records.__map.filter(([lv]) => level.split(",").map(Number).includes(lv)) } } };
writeFileSync(out, gzipSync(JSON.stringify({ id: row.id, key: row.key, requests: [q] }), { level: 9 }));
