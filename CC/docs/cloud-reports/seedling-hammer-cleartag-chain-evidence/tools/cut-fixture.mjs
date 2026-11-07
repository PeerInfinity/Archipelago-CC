// MEASUREMENT ONLY: cut one captured leg (sweep capture jsonl, --id) to a fixture: its first request, the atlas
// records cut to level 40, the page's `result` dropped. Usage: node cut-fixture.mjs <requests.jsonl> <id> <out.json.gz>
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const [req, id, out] = process.argv.slice(2);
const row = readFileSync(req, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === id);
const { result, ...q } = row.requests[0];
q.request = { ...q.request, source: { ...q.request.source,
    records: { __map: q.request.source.records.__map.filter(([lv]) => lv === 40) } } };
writeFileSync(out, gzipSync(JSON.stringify({ id: row.id, key: row.key, requests: [q] }), { level: 9 }));
