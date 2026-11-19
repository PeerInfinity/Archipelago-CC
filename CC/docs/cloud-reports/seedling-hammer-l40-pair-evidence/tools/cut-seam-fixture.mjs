// cut-seam-fixture.mjs <src fixture.json.gz> <seam> <out.json.gz> <pair.jsonl> <fx> — L40-PAIR: a committed request
// re-stamped to the arrival clock where the pair (PRESS_ESCAPE_SHIELD_CLAIM + PRESS_KILL_CHASERS) loses a clock OFF solves.
// The request is the source's byte for byte except `staging.seam.time`; `measured` carries the pair's refusal (from the
// seam sweep row) and the OFF row's verdict, so a later slice knows what it is looking at.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
const [src, seamS, out, pairPath, fx] = process.argv.slice(2);
const seam = Number(seamS);
const f = JSON.parse(gunzipSync(readFileSync(src)).toString('utf8'));
const r0 = f.requests[0];
const req = { ...r0.request, staging: { ...r0.request.staging, seam: { ...r0.request.staging.seam, time: seam } } };
const row = readFileSync(pairPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((r) => r.fx === fx && r.seam === seam);
const fixture = { id: f.id, key: f.key, seam, source: src.replace(/^.*fixtures\//, 'fixtures/'),
    measured: { budget: 2560, on: row.on, ok: row.ok, work: row.work, passes: row.passes, message: row.message },
    requests: [{ i: r0.i, request: req, passes: null }] };
writeFileSync(out, gzipSync(JSON.stringify(fixture)));
console.log(out, f.key, seam, row.ok, row.work);
