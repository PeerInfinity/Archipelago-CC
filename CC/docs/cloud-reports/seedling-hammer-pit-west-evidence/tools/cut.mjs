// cut a captured request's atlas records to the given levels and write it gzipped (fixture shape: {id,key,requests:[{i,request}]})
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const [reqs, id, levels, out] = process.argv.slice(2);
const keep = new Set(levels.split(',').map(Number));
for (const line of readFileSync(reqs, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (String(row.id) !== id) continue;
    const c = row.requests[0];
    const rec = c.request.source.records;
    const cutRec = { ...rec, __map: rec.__map.filter(([lv]) => keep.has(lv)) };
    const fx = { id: row.id, key: row.key, requests: [{ i: c.i, request: { ...c.request, source: { ...c.request.source, records: cutRec } } }] };
    writeFileSync(out, gzipSync(JSON.stringify(fx), { level: 9 }));
    console.log(out, Object.keys(rec), rec.__map.length, '->', cutRec.__map.length);
}
