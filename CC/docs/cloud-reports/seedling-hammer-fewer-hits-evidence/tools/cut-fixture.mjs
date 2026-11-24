// MEASUREMENT ONLY (HIT-TIEBREAK's cut-fixture.mjs, the request index a parameter): cut one captured request of one leg
// to a fixture: that request, the atlas records cut to one level, the page's `result` dropped.
// Usage: node cut-fixture.mjs <requests.jsonl> <id> <i> <level> <out.json.gz>
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const [req, id, i, level, out] = process.argv.slice(2);
const row = readFileSync(req, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === id);
const { result, ...q } = row.requests.find((c) => String(c.i) === i);
q.request = { ...q.request, source: { ...q.request.source,
    records: { __map: q.request.source.records.__map.filter(([lv]) => lv === Number(level)) } } };
writeFileSync(out, gzipSync(JSON.stringify({ id: row.id, key: row.key, requests: [q] }), { level: 9 }));
